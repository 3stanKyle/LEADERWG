// Express API server for WatchGuard BOM Configurator
const express = require('express');
const path = require('path');
const cors = require('cors');
const { initDb } = require('./db');
const { seedIfNeeded } = require('./seed');
const { SECTION_DEFS } = require('../src/data/featureSpecs.shared.cjs');

const app = express();
const PORT = process.env.PORT || 3001;
const IS_PRODUCTION = process.env.NODE_ENV === 'production';

app.use(cors());
app.use(express.json());

seedIfNeeded();
const db = initDb();
const { initChat } = require('./chat');
const { handleChat, isChatAvailable } = initChat(db);

// ── Category labels ───────────────────────────────────────
const CATEGORY_LABELS = {
  tabletop: 'Firebox Tabletop (T-Series)',
  mseries:  'Firebox Rackmount (M-Series)',
  wifi:     'Wi-Fi 6 Access Points',
  virtual:  'FireboxV Virtual Appliances',
  cloud:    'Firebox Cloud',
  mdr_ndr:  'MDR & NDR',
  endpoint: 'Endpoint & Mobile',
  identity: 'Identity & Access',
  email:    'Email Security',
  renewals: 'Appliance Renewals',
};

// ── GET /api/categories ───────────────────────────────────
// Returns all product families with their product groups (dynamic)
app.get('/api/categories', (_req, res) => {
  const groups = db.prepare(`
    SELECT id, slug, name, family, category, description, image_file
    FROM product_groups
    ORDER BY family, name
  `).all();

  const categories = {};

  for (const g of groups) {
    if (!categories[g.category]) {
      categories[g.category] = {
        label: CATEGORY_LABELS[g.category] || g.family,
        products: [],
      };
    }

    // Attach a representative SKU (appliance or first per_user_subscription)
    const representative = db.prepare(`
      SELECT sku_code, full_sku, name, msrp, url
      FROM skus
      WHERE product_group_id = ? AND sku_type IN ('appliance', 'per_user_subscription')
      ORDER BY sku_type, name
      LIMIT 1
    `).get(g.id);

    categories[g.category].products.push({
      ...g,
      appliance: representative || null,
    });
  }

  res.json(categories);
});

// ── GET /api/categories/:category ─────────────────────────
// Returns a single category with all product groups and ALL their SKUs
app.get('/api/categories/:category', (req, res) => {
  const groups = db.prepare(`
    SELECT id, slug, name, family, category, description, image_file
    FROM product_groups WHERE category = ? ORDER BY name
  `).all(req.params.category);

  if (!groups.length) return res.status(404).json({ error: 'Category not found' });

  const result = groups.map(g => {
    const skus = db.prepare(`
      SELECT sku_code, full_sku, name, msrp, delivery_method, url,
             sku_type, subscription_type, term_years
      FROM skus WHERE product_group_id = ? ORDER BY name
    `).all(g.id);
    return { ...g, skus };
  });

  res.json({ label: CATEGORY_LABELS[req.params.category] || groups[0].family, products: result });
});

// ── GET /api/products/:slug ───────────────────────────────
// Returns a single product group with all its SKUs and features
app.get('/api/products/:slug', (req, res) => {
  const group = db.prepare(`
    SELECT id, slug, name, family, category, description, image_file
    FROM product_groups WHERE slug = ?
  `).get(req.params.slug);

  if (!group) return res.status(404).json({ error: 'Product not found' });

  const allSkus = db.prepare(`
    SELECT id, sku_code, full_sku, name, msrp, delivery_method, url, sku_type, subscription_type, term_years
    FROM skus WHERE product_group_id = ?
    ORDER BY sku_type, subscription_type, term_years
  `).all(group.id);

  const features = db.prepare(`
    SELECT feature_category, feature_name, feature_value, sort_order
    FROM product_features WHERE product_group_id = ?
    ORDER BY id
  `).all(group.id);

  // Group features by category
  const featureGroups = {};
  for (const f of features) {
    if (!featureGroups[f.feature_category]) featureGroups[f.feature_category] = [];
    featureGroups[f.feature_category].push({ name: f.feature_name, value: f.feature_value });
  }

  // Separate SKU types
  const appliance     = allSkus.find(s => s.sku_type === 'appliance') || null;
  const subscriptions = allSkus.filter(s => s.sku_type === 'subscription');
  const tradeUps      = allSkus.filter(s => s.sku_type === 'trade_up');
  const ha            = allSkus.filter(s => s.sku_type === 'high_availability');
  const bundles       = allSkus.filter(s => s.sku_type === 'activation_bundle');

  res.json({
    ...group,
    appliance,
    subscriptions,
    tradeUps,
    highAvailability: ha,
    activationBundles: bundles,
    specSections: SECTION_DEFS[group.category] || [],
    features: featureGroups,
  });
});

// ── GET /api/products/:slug/subscriptions ─────────────────
// Returns just the subscriptions for a product group (for dropdown)
app.get('/api/products/:slug/subscriptions', (req, res) => {
  const group = db.prepare(`SELECT id FROM product_groups WHERE slug = ?`).get(req.params.slug);
  if (!group) return res.status(404).json({ error: 'Product not found' });

  const subs = db.prepare(`
    SELECT sku_code, full_sku, name, msrp, url, subscription_type, term_years
    FROM skus
    WHERE product_group_id = ? AND sku_type = 'subscription'
    ORDER BY subscription_type, term_years
  `).all(group.id);

  // Group by subscription_type
  const grouped = {};
  for (const s of subs) {
    if (!grouped[s.subscription_type]) grouped[s.subscription_type] = [];
    grouped[s.subscription_type].push(s);
  }

  res.json(grouped);
});

// ── GET /api/health ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', chat: isChatAvailable() });
});

// ── POST /api/chat ───────────────────────────────────────────
app.post('/api/chat', handleChat);

// ── Serve frontend in production ──────────────────────────
// On Railway, Express serves both the API and the built Vite frontend.
// In local dev, Vite's dev server handles the frontend separately.
if (IS_PRODUCTION) {
  const distPath = path.join(__dirname, '..', 'dist');
  app.use(express.static(distPath));
  // SPA fallback — serve index.html for any non-API route
  // Express 5 requires named wildcard parameters (bare '*' is invalid)
  app.get('/{*splat}', (_req, res) => {
    res.sendFile(path.join(distPath, 'index.html'));
  });
}

// ── Start ─────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`WatchGuard API running on http://localhost:${PORT}${IS_PRODUCTION ? ' (production)' : ''}`);
});
