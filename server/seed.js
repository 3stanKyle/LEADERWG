// Seed the database from product-catalog.csv (structure) + WGdata_*.csv (prices)
//
// Product structure (groups, URLs, delivery method) comes from:
//   server/data/product-catalog.csv          — rarely changes, only when adding new products
//
// Prices come from:
//   src/data/WGdata_YYYYMMDD_HHMMSS.csv      — the single source of truth for all pricing
//
// To update prices: drop a new WGdata CSV into src/data/ and restart the dev server.
// Run manually: node server/seed.js

const fs = require('fs');
const path = require('path');
const { initDb, DB_PATH } = require('./db');
const { buildFeatureRecords } = require('../src/data/featureSpecs.shared.cjs');

const CATALOG_CSV_PATH = path.join(__dirname, 'data', 'product-catalog.csv');
const WGDATA_DIR = path.join(__dirname, '..', 'src', 'data');
const FEATURE_SPECS_PATH = path.join(__dirname, '..', 'src', 'data', 'featureSpecs.shared.cjs');

// ── Parse CSV (handles quoted fields with commas) ─────────
function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQuotes = !inQuotes;
    } else if (ch === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current.trim());
  return fields;
}

function parsePrice(raw) {
  if (!raw) return 0;
  const cleaned = raw.replace(/[$,\s]/g, '');
  const val = parseFloat(cleaned);
  return isNaN(val) ? 0 : val;
}

// ── WGdata price loader ───────────────────────────────────
// Finds the latest WGdata_*.csv in src/data/ and reads the RRP column
// Format: STOCK CODE, SUBCATEGORY NAME, SHORT DESCRIPTION, IMAGE, MANUFACTURER, MFR SKU, DBP, RRP
function findLatestWGDataCsv() {
  const files = fs
    .readdirSync(WGDATA_DIR)
    .filter((file) => /^WGdata_.*\.csv$/i.test(file))
    .sort();

  if (files.length === 0) return null;
  return path.join(WGDATA_DIR, files[files.length - 1]);
}

function loadPriceMap() {
  const latestCsv = findLatestWGDataCsv();
  if (!latestCsv) {
    return { priceMap: new Map(), source: null };
  }

  const raw = fs.readFileSync(latestCsv, 'utf-8');
  const lines = raw.split(/\r?\n/).filter((line) => line.trim());
  const priceMap = new Map();

  for (const line of lines.slice(1)) {
    const fields = parseCsvLine(line);
    if (fields.length < 8) continue;

    const fullSku = fields[0].trim();
    const rrp = parsePrice(fields[7]);
    if (fullSku && rrp > 0) {
      priceMap.set(fullSku, Math.round(rrp));
    }
  }

  return { priceMap, source: path.basename(latestCsv) };
}

function getSeedSourceFiles() {
  const latestWGDataCsv = findLatestWGDataCsv();
  return [CATALOG_CSV_PATH, latestWGDataCsv, FEATURE_SPECS_PATH].filter(Boolean);
}

// ── Classify SKU type from name ───────────────────────────
function classifySku(name, deliveryMethod) {
  if (deliveryMethod === 'Physical') return { type: 'appliance', subType: null };
  const lower = name.toLowerCase();
  // Per-user subscription products (Endpoint, Identity, Email, MDR/NDR)
  if (/\d+[-\s]+(?:to\s+)?\d+\s+(?:users|licenses)|\d+\+?\s+(?:users|licenses)/i.test(name)) {
    return { type: 'per_user_subscription', subType: null };
  }
  if (lower.includes('points activation bundle')) return { type: 'activation_bundle', subType: null };
  if (lower.includes('trade up')) {
    if (lower.includes('total security'))       return { type: 'trade_up', subType: 'Total Security Suite' };
    if (lower.includes('basic security'))       return { type: 'trade_up', subType: 'Basic Security Suite' };
    return { type: 'trade_up', subType: null };
  }
  if (lower.includes('high availability'))      return { type: 'high_availability', subType: 'High Availability' };
  const isRenewal = lower.includes('renewal') || lower.includes('upgrade');
  if (lower.includes('total security')) {
    return { type: 'subscription', subType: isRenewal ? 'Total Security Renewal' : 'Total Security Suite' };
  }
  if (lower.includes('basic security')) {
    return { type: 'subscription', subType: isRenewal ? 'Basic Security Renewal' : 'Basic Security Suite' };
  }
  if (lower.includes('standard support')) {
    return { type: 'subscription', subType: isRenewal ? 'Standard Support Renewal' : 'Standard Support' };
  }
  if (lower.includes('gold support')) {
    return { type: 'subscription', subType: isRenewal ? 'Gold Support Renewal' : 'Gold Support' };
  }
  if (lower.includes('usp wi-fi'))              return { type: 'subscription', subType: 'USP Wi-Fi' };
  if (lower.includes('standard wi-fi'))         return { type: 'subscription', subType: 'Standard Wi-Fi' };
  // Individual security service subscriptions
  if (lower.includes('webblocker'))             return { type: 'subscription', subType: 'WebBlocker' };
  if (lower.includes('spamblocker'))            return { type: 'subscription', subType: 'spamBlocker' };
  if (lower.includes('gateway antivirus'))      return { type: 'subscription', subType: 'Gateway AntiVirus' };
  if (lower.includes('intrusion prevention'))   return { type: 'subscription', subType: 'Intrusion Prevention Service' };
  if (lower.includes('reputation enabled'))     return { type: 'subscription', subType: 'Reputation Enabled Defense' };
  if (lower.includes('application control'))    return { type: 'subscription', subType: 'Application Control' };
  if (lower.includes('apt blocker'))            return { type: 'subscription', subType: 'APT Blocker' };
  if (lower.includes('network discovery'))      return { type: 'subscription', subType: 'Network Discovery' };
  if (lower.includes('cloud') && lower.includes('data retention')) return { type: 'subscription', subType: 'Cloud Data Retention' };
  return { type: 'other', subType: null };
}

// ── Extract term years from name ──────────────────────────
function extractTerm(name) {
  const m = name.match(/(\d+)[- ](?:year|yr)/i);
  if (m) return parseInt(m[1], 10);
  if (/1-month/i.test(name)) return 0;
  return null;
}

// ── Map Product Family to category ────────────────────────
function familyToCategory(family) {
  const map = {
    'Access Points':     'wifi',
    'M-Series':          'mseries',
    'T-Series':          'tabletop',
    'Virtual':           'virtual',
    'Cloud':             'cloud',
    'MDR & NDR':         'mdr_ndr',
    'Endpoint & Mobile': 'endpoint',
    'Identity & Access': 'identity',
    'Email Security':    'email',
    'Renewals':          'renewals',
    // ── New WatchGuard product lines (2026 catalogue) ────────────────
    // Routed into the closest existing tab so they are not "other".
    // NOTE: the front-end tab list + per-tab product cards are hardcoded,
    // so to make these render as cards you must also add matching config
    // entries in the relevant hook (see handover notes). Until then they
    // are categorised here but won't appear as new cards on their own.
    'FireCloud':          'cloud',      // cloud-delivered firewall / SASE
    'CloudDR':            'cloud',      // WatchGuard Cloud log data-retention
    'Firebox NV-Series':  'tabletop',   // new compact Firebox hardware (NV5)
    'Reporting & Visibility': 'mdr_ndr', // Compliance Reporting, SIEMFeeder, Dimension Command
    'MSSP':               'renewals',   // MSSP pre-pay point packs (licensing/commercial)
  };
  return map[family] || 'other';
}

// ── Map product group slug to image file ──────────────────
const IMAGE_MAP = {
  'AP130':   'AP130.jpg',
  'AP230W':  'AP230W.jpg',
  'AP330':   'AP330.jpg',
  'AP332CR': 'AP332CER.jpg',
  'AP430CR': 'AP430CR.jpg',
  'AP432':   'AP432.jpg',
  'M290':    'm295.jpg',
  'M295':    'm295.jpg',
  'M390':    'm395.jpg',
  'M395':    'm395.jpg',
  'M4800':   'm4800.jpg',
  'M495':    'm495.jpg',
  'M5800':   'm5800.jpg',
  'M590':    'm595.jpg',
  'M595':    'm595.jpg',
  'M690':    'm695.jpg',
  'M695':    'm695.jpg',
  'T115-W':  'T115-W.jpg',
  'T125':    'T125.jpg',
  'T125-W':  'T125-W.jpg',
  'T145':    'T145.jpg',
  'T145-W':  'T145.jpg',
  'T185':    'T185.jpg',
  'T25-W':   'T115-W.jpg',
  'T45-CW':  'T145.jpg',
  'T45-PoE': 'T145.jpg',
  'T45-W-PoE': 'T145.jpg',
};

// ── Map Product Group to friendly display name ────────────
function groupToDisplayName(slug, family) {
  if (family === 'Access Points') return `WatchGuard ${slug}`;
  if (family === 'M-Series')      return `Firebox ${slug}`;
  if (family === 'T-Series')      return `Firebox ${slug}`;
  if (family === 'Virtual')       return slug;  // "FireboxV Small" etc.
  if (family === 'Cloud')         return slug;  // "Firebox Cloud Small" etc.
  if (family === 'Renewals')      return `Firebox ${slug}`;
  // Per-user products keep their product name as-is
  return slug;
}

// ── Short descriptions ───────────────────────────────────
const DESCRIPTIONS = {
  'AP130':   'Entry-level Wi-Fi 6 for small offices and remote workers',
  'AP230W':  'Wall-plate AP with built-in switch for hospitality',
  'AP330':   'Medium-density AP for retail and K-12 schools',
  'AP332CR': 'Rugged outdoor AP for retail and manufacturing',
  'AP430CR': 'High-density outdoor AP for stadiums and campuses',
  'AP432':   'High-density 4x4 AP for large campuses',
  'M290':    'Rackmount UTM for small-medium businesses',
  'M295':    'Rackmount UTM for medium-sized businesses',
  'M390':    'Mid-range rackmount firewall for growing networks',
  'M395':    'High-throughput firewall for demanding networks',
  'M4800':   'Data center firewall with 40Gb fiber options',
  'M495':    'Enterprise-grade security with modular expansion',
  'M5800':   'Enterprise flagship with unrestricted VPN tunnels',
  'M590':    'High-performance rackmount for large organizations',
  'M595':    'Advanced threat protection for large organizations',
  'M690':    'High-capacity firewall for enterprise campuses',
  'M695':    'Maximum performance rackmount appliance',
  'T115-W':  'Entry-level firewall with built-in Wi-Fi 7 for small offices',
  'T125':    'Compact UTM appliance for small business networks',
  'T125-W':  'Compact UTM appliance with built-in Wi-Fi 7 antennas',
  'T145':    'Mid-range tabletop firewall with SFP+ connectivity',
  'T145-W':  'Mid-range tabletop firewall with Wi-Fi 7',
  'T185':    'High-performance tabletop for growing businesses',
  'T25-W':   'Entry-level firewall with Wi-Fi for home offices',
  'T45-CW':  'Cellular WAN tabletop firewall with 5G/LTE',
  'T45-PoE': 'Tabletop firewall with Power over Ethernet ports',
  'T45-W-PoE': 'Tabletop firewall with Wi-Fi and PoE ports',
  // New 2026 tabletop models
  'T25':     'Entry-level tabletop firewall for small and home offices',
  'T85-PoE': 'Top-of-range tabletop firewall with PoE for busy branch offices',
  'NV5':     'Ultra-compact, enterprise-grade gateway tabletop appliance',
  // Virtual appliances
  'FireboxV Small':  'Virtual firewall for small cloud deployments',
  'FireboxV Medium': 'Virtual firewall for medium cloud workloads',
  'FireboxV Large':  'Virtual firewall for large cloud environments',
  'FireboxV XLarge': 'Virtual firewall for enterprise cloud infrastructure',
  // Cloud appliances
  'Firebox Cloud Small':  'Cloud-native firewall for small AWS/Azure deployments',
  'Firebox Cloud Medium': 'Cloud-native firewall for medium cloud workloads',
  'Firebox Cloud Large':  'Cloud-native firewall for large cloud environments',
  'Firebox Cloud XLarge': 'Cloud-native firewall for enterprise cloud infrastructure',
  // MDR & NDR
  'Core MDR':              'Managed detection and response for endpoints',
  'Core MDR for Microsoft': 'MDR optimized for Microsoft 365 environments',
  'Total MDR':             'Comprehensive managed detection and response',
  'ThreatSync+ NDR':       'Network detection and response with AI correlation',
  'Total NDR':             'Full-spectrum network detection and response',
  'ThreatSync+ SaaS':      'SaaS application threat detection and response',
  // Endpoint & Mobile
  'EPP':                   'Endpoint Protection Platform — antivirus and threat prevention',
  'EDR':                   'Endpoint Detection and Response — advanced threat hunting',
  'EPDR':                  'Combined EPP + EDR for complete endpoint security',
  'Advanced EPDR':         'EPDR with zero-trust application service and threat hunting',
  'Full Encryption':       'Full disk encryption add-on for endpoint protection',
  'Patch Management':      'Automated patch management for OS and third-party apps',
  'Advanced Reporting Tool': 'Advanced security reporting and analytics',
  'DNSWatchGO':            'DNS-level protection and content filtering for remote users',
  'Passport':              'User security bundle: DNSWatchGO + AuthPoint + EPDR',
  'Panda EPP+':            'Legacy Panda endpoint protection plus',
  'Panda AD360':           'Legacy Panda full-spectrum endpoint security',
  'Panda Patch Management': 'Legacy Panda automated patch management',
  // Identity & Access
  'AuthPoint':             'Cloud-based multi-factor authentication (MFA)',
  'Total Identity Security': 'AuthPoint MFA + dark web monitoring + credentials manager',
  // Email Security
  'Panda Email Protection': 'Cloud email security with anti-spam and anti-phishing',
};

// ── Seed shared feature data ──────────────────────────────
function seedFeatures(db, groupId, slug, category) {
  const insert = db.prepare(`
    INSERT INTO product_features (product_group_id, feature_category, feature_name, feature_value, sort_order)
    VALUES (?, ?, ?, ?, ?)
  `);

  for (const feature of buildFeatureRecords(category, slug)) {
    insert.run(
      groupId,
      feature.featureCategory,
      feature.featureName,
      feature.featureValue,
      feature.sortOrder,
    );
  }
}

// ── MAIN ──────────────────────────────────────────────────
function seed() {
  const raw = fs.readFileSync(CATALOG_CSV_PATH, 'utf-8');
  const lines = raw.split(/\r?\n/).filter(l => l.trim());
  const rows = lines.slice(1);

  // Load prices from the WGdata CSV (single source of truth)
  const { priceMap, source: priceSource } = loadPriceMap();

  const db = initDb();

  // Clear existing data
  db.exec('DELETE FROM product_features');
  db.exec('DELETE FROM skus');
  db.exec('DELETE FROM product_groups');

  // Collect unique product groups
  const groupSet = new Map();
  const parsedRows = [];

  for (const line of rows) {
    const fields = parseCsvLine(line);
    if (fields.length < 6) continue;

    // URL is always last, group second-to-last, etc. — parse from both ends.
    const fullSku = fields[0];
    const name = fields[1];
    const url = fields[fields.length - 1];
    const group = fields[fields.length - 2];
    const family = fields[fields.length - 3];
    const deliveryMethod = fields[fields.length - 4];
    const price = priceMap.get(fullSku) ?? 0;
    const skuCode = fullSku.replace(/^NWG-/, '');
    const { type, subType } = classifySku(name, deliveryMethod);
    const term = extractTerm(name);

    if (!groupSet.has(group)) {
      groupSet.set(group, { family, category: familyToCategory(family) });
    }

    parsedRows.push({ fullSku, skuCode, name, msrp: price, deliveryMethod, family, group, url, type, subType, term });
  }

  // Insert product groups
  const insertGroup = db.prepare(`
    INSERT INTO product_groups (slug, name, family, category, description, image_file)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const groupIdMap = {};

  for (const [slug, info] of groupSet.entries()) {
    const displayName = groupToDisplayName(slug, info.family);
    const desc = DESCRIPTIONS[slug] || '';
    const img = IMAGE_MAP[slug] || null;
    const result = insertGroup.run(slug, displayName, info.family, info.category, desc, img);
    groupIdMap[slug] = result.lastInsertRowid;
    seedFeatures(db, result.lastInsertRowid, slug, info.category);
  }

  // Insert SKUs
  const insertSku = db.prepare(`
    INSERT INTO skus (sku_code, full_sku, name, msrp, delivery_method, product_group_id, url, sku_type, subscription_type, term_years)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((rows) => {
    for (const r of rows) {
      insertSku.run(
        r.skuCode, r.fullSku, r.name, r.msrp, r.deliveryMethod,
        groupIdMap[r.group], r.url, r.type, r.subType, r.term
      );
    }
  });

  insertMany(parsedRows);

  // Summary
  const groupCount = db.prepare('SELECT COUNT(*) as c FROM product_groups').get().c;
  const skuCount = db.prepare('SELECT COUNT(*) as c FROM skus').get().c;
  const featureCount = db.prepare('SELECT COUNT(*) as c FROM product_features').get().c;
  const pricedCount = db.prepare('SELECT COUNT(*) as c FROM skus WHERE msrp > 0').get().c;

  console.log(`Seeded successfully:`);
  console.log(`  ${groupCount} product groups`);
  console.log(`  ${skuCount} SKUs (${pricedCount} with prices, ${skuCount - pricedCount} showing TBC)`);
  console.log(`  ${featureCount} feature entries`);
  if (priceSource) {
    console.log(`  pricing source: ${priceSource}`);
  } else {
    console.log('  WARNING: No WGdata_*.csv found in src/data/ — all prices will show TBC');
  }

  db.close();
}

function seedIfNeeded() {
  const sourceFiles = getSeedSourceFiles();

  if (!fs.existsSync(DB_PATH)) {
    seed();
    return;
  }

  const dbMtime = fs.statSync(DB_PATH).mtimeMs;
  const newestSourceMtime = sourceFiles.reduce((latest, filePath) => {
    const mtime = fs.statSync(filePath).mtimeMs;
    return Math.max(latest, mtime);
  }, 0);

  if (newestSourceMtime > dbMtime) {
    seed();
  }
}

if (require.main === module) {
  seed();
}

module.exports = {
  seed,
  seedIfNeeded,
};
