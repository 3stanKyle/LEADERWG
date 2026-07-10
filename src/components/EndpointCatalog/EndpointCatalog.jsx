import React, { useState } from 'react';
import {
  ShoppingCartSimple,
  ShieldCheck,
  Cube,
  CheckCircle,
  XCircle,
  Info,
} from '@phosphor-icons/react';
import styles from './EndpointCatalog.module.css';
import { useEndpointData, PRODUCTS } from './hooks/useEndpointData.js';
import { useQuote } from '../../context/QuoteContext.jsx';
import { formatPrice } from '../../data/productPrices.js';

/* ─── Tab definitions ─── */
const TAB_ORDER = ['watchguard', 'panda'];
const TAB_LABELS = {
  watchguard: 'WatchGuard Endpoint',
  panda: 'Legacy Panda',
};
const TAB_ICONS = {
  watchguard: ShieldCheck,
  panda: Cube,
};

/* ─── Badge CSS class map ─── */
const BADGE_CLASSES = {
  Good: styles.tierBadgeGood,
  Better: styles.tierBadgeBetter,
  Best: styles.tierBadgeBest,
  Premium: styles.tierBadgePremium,
};

/* ═══════════════════════════════════════════════════════════
   Reusable SKU display
   ═══════════════════════════════════════════════════════════ */
function SkuLink({ sku, url }) {
  if (!sku) return null;
  if (url) {
    return (
      <a href={url} target="_blank" rel="noopener noreferrer" className={styles.skuLink}>
        {sku}
      </a>
    );
  }
  return <span className={styles.skuCode}>{sku}</span>;
}

/* ═══════════════════════════════════════════════════════════
   Product Card — one per product line
   ═══════════════════════════════════════════════════════════ */
function ProductCard({ product, data, onAdd, variant }) {
  const { selections, setSelection, getAvailableTerms, getSkuForSelection, getPriceForSelection, getUrlForSelection } = data;
  const sel = selections[product.key] || {};
  const tier = sel.tier || product.tiers[0];
  const terms = getAvailableTerms(product.key, tier);
  const term = sel.term || terms[0];
  const sku = getSkuForSelection(product.key, tier, term);
  const price = getPriceForSelection(product.key, tier, term);
  const url = getUrlForSelection(product.key, tier, term);

  const handleTierChange = (e) => {
    const newTier = e.target.value;
    setSelection(product.key, 'tier', newTier);
    const newTerms = getAvailableTerms(product.key, newTier);
    if (newTerms.length && !newTerms.includes(sel.term)) {
      setSelection(product.key, 'term', newTerms[0]);
    }
  };

  const imageUrl = sku ? `https://www.leadersystems.com.au/Images/${sku}.jpg` : null;

  if (variant === 'wide') {
    return (
      <div className={styles.wideCard}>
        <div className={styles.wideBody}>
          <div className={styles.wideConfigSide}>
            <div className={styles.cardHeader}>
              <h3 className={styles.cardName}>{product.label}</h3>
              {product.badge && (
                <span className={`${styles.tierBadge} ${BADGE_CLASSES[product.badge] || ''}`}>
                  {product.badge}
                </span>
              )}
            </div>
            <p className={styles.cardDesc}>{product.description}</p>

            <div className={styles.fieldGroup}>
              <label className={styles.fieldLabel}>License Tier</label>
              <select
                className={styles.selectField}
                value={tier}
                onChange={handleTierChange}
              >
                {product.tiers.map((t) => (
                  <option key={t} value={t}>{t} licenses</option>
                ))}
              </select>
            </div>

            {terms.length > 0 && (
              <div className={styles.fieldGroup}>
                <label className={styles.fieldLabel}>Subscription Term</label>
                <select
                  className={styles.selectField}
                  value={term}
                  onChange={(e) => setSelection(product.key, 'term', e.target.value)}
                >
                  {terms.map((t) => (
                    <option key={t} value={t}>{t}</option>
                  ))}
                </select>
              </div>
            )}

            <div className={styles.priceRow}>
              <span className={styles.price}>{formatPrice(price)}</span>
              <span className={styles.priceNote}>MSRP <span className={styles.perSeat}>per user</span></span>
            </div>

            <button
              className={styles.addBtn}
              disabled={!sku}
              onClick={() =>
                onAdd({
                  sku,
                  name: product.label,
                  description: `${tier} licenses (${term})`,
                  unitPrice: price || 0,
                  image: imageUrl,
                })
              }
              title="Add to quote cart"
            >
              <ShoppingCartSimple size={14} weight="bold" />
              Add to Quote
            </button>
            <SkuLink sku={sku} url={url} />
          </div>
          {imageUrl && (
            <div className={styles.wideImageSide}>
              <img src={imageUrl} alt={product.label} className={styles.cardImage} />
            </div>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.productCard}>
      {imageUrl && (
        <div className={styles.cardImageWrap}>
          <img src={imageUrl} alt={product.label} className={styles.cardImage} />
        </div>
      )}
      <div className={styles.cardBody}>
        <div className={styles.cardHeader}>
          <h3 className={styles.cardName}>{product.label}</h3>
          {product.badge && (
            <span className={`${styles.tierBadge} ${BADGE_CLASSES[product.badge] || ''}`}>
              {product.badge}
            </span>
          )}
        </div>
        <p className={styles.cardDesc}>{product.description}</p>

        <div className={styles.fieldGroup}>
          <label className={styles.fieldLabel}>License Tier</label>
          <select
            className={styles.selectField}
            value={tier}
            onChange={handleTierChange}
          >
            {product.tiers.map((t) => (
              <option key={t} value={t}>{t} licenses</option>
            ))}
          </select>
        </div>

        {terms.length > 0 && (
          <div className={styles.fieldGroup}>
            <label className={styles.fieldLabel}>Subscription Term</label>
            <select
              className={styles.selectField}
              value={term}
              onChange={(e) => setSelection(product.key, 'term', e.target.value)}
            >
              {terms.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>
        )}

        <div className={styles.priceBlock}>
          <div className={styles.priceRow}>
            <span className={styles.price}>{formatPrice(price)}</span>
            <span className={styles.priceNote}>MSRP <span className={styles.perSeat}>per user</span></span>
          </div>
        </div>

        <button
          className={styles.addBtn}
          disabled={!sku}
          onClick={() =>
            onAdd({
              sku,
              name: product.label,
              description: `${tier} licenses (${term})`,
              unitPrice: price || 0,
              image: imageUrl,
            })
          }
          title="Add to quote cart"
        >
          <ShoppingCartSimple size={14} weight="bold" />
          Add to Quote
        </button>
        <SkuLink sku={sku} url={url} />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Banner — gradient only (no image)
   ═══════════════════════════════════════════════════════════ */
function EndpointBanner() {
  return (
    <div className={styles.bannerWrap}>
      <div className={`${styles.bannerFallback} ${styles.bannerFallbackEndpoint}`} />
      <div className={styles.bannerOverlay}>
        <h2 className={styles.bannerHeadline}>Endpoint & Mobile Security</h2>
        <p className={styles.bannerDescription}>
          Protect every device — laptops, desktops, servers, and mobile — with WatchGuard's
          unified endpoint security platform. From antivirus and EDR to zero-trust application
          classification, DNS filtering, and full disk encryption.
        </p>
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Category Tabs (WatchGuard Endpoint / Legacy Panda)
   ═══════════════════════════════════════════════════════════ */
function CategoryTabs({ activeTab, setActiveTab, productCounts }) {
  return (
    <div className={styles.tabBar}>
      {TAB_ORDER.map((key) => {
        const Icon = TAB_ICONS[key];
        return (
          <button
            key={key}
            className={`${styles.tabBtn} ${activeTab === key ? styles.tabActive : ''}`}
            onClick={() => setActiveTab(key)}
          >
            <Icon size={16} weight={activeTab === key ? 'fill' : 'duotone'} />
            {TAB_LABELS[key]}
            {productCounts?.[key] != null && (
              <span className={styles.tabCount}>{productCounts[key]}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Info Callout — link to Legacy Panda tab
   ═══════════════════════════════════════════════════════════ */
function InfoCallout({ onSwitch }) {
  return (
    <div className={styles.infoCallout}>
      <Info size={16} weight="fill" />
      <span>
        Looking for legacy Panda Endpoint Protection Plus?{' '}
        <button className={styles.infoCalloutBtn} onClick={onSwitch}>
          See the Legacy Panda tab
        </button>
      </span>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Comparison Table — EPP vs EDR vs EPDR vs Advanced EPDR
   ═══════════════════════════════════════════════════════════ */
function Check() {
  return <CheckCircle size={18} weight="fill" className={styles.checkIcon} />;
}
function NoCheck() {
  return <XCircle size={16} weight="regular" className={styles.noCheckIcon} />;
}

// Columns are in capability order: Basic < Prime < 360 < Elite (Elite is the flagship).
const COMPARISON_ROWS = [
  { feature: 'Next-gen antivirus & anti-malware',                    basic: true,  prime: true,  s360: true,  elite: true },
  { feature: 'Ransomware protection',                                basic: true,  prime: true,  s360: true,  elite: true },
  { feature: 'AI-powered behavioral threat detection',               basic: true,  prime: true,  s360: true,  elite: true },
  { feature: 'URL filtering, device control & host firewall',        basic: true,  prime: true,  s360: true,  elite: true },
  { feature: 'Anti-exploit / zero-day protection',                   basic: false, prime: true,  s360: true,  elite: true },
  { feature: 'Full EDR — endpoint isolation, response & root cause', basic: false, prime: true,  s360: true,  elite: true },
  { feature: 'Threat hunting (MITRE ATT&CK)',                        basic: false, prime: true,  s360: true,  elite: true },
  { feature: 'Zero-Trust Application Service (deny-by-default)',     basic: false, prime: false, s360: true,  elite: true },
  { feature: 'Lateral-movement detection & containment',            basic: false, prime: false, s360: true,  elite: true },
  { feature: 'Advanced investigation — IOC/STIX/YARA, GenAI, remote shell', basic: false, prime: false, s360: false, elite: true },
];

function EndpointComparisonTable() {
  return (
    <section className={styles.comparisonSection}>
      <h2 className={styles.comparisonHeadline}>Which Endpoint Solution Is Right for You?</h2>
      <p className={styles.comparisonDesc}>
        WatchGuard offers four tiers of endpoint security. Each level builds on the one before it,
        adding more advanced detection, response, and threat hunting capabilities. (Prime sits
        between Basic and 360 — Elite is the flagship.)
      </p>
      <div className={styles.tableWrap}>
        <table className={styles.comparisonTable}>
          <thead>
            <tr>
              <th>Feature</th>
              <th>Basic</th>
              <th>Prime</th>
              <th>360</th>
              <th>Elite</th>
            </tr>
          </thead>
          <tbody>
            {COMPARISON_ROWS.map((row) => (
              <tr key={row.feature}>
                <td><strong>{row.feature}</strong></td>
                <td>{row.basic ? <Check /> : <NoCheck />}</td>
                <td>{row.prime ? <Check /> : <NoCheck />}</td>
                <td>{row.s360 ? <Check /> : <NoCheck />}</td>
                <td>{row.elite ? <Check /> : <NoCheck />}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/* ═══════════════════════════════════════════════════════════
   Section Header
   ═══════════════════════════════════════════════════════════ */
function SectionHeader({ title, subtitle }) {
  return (
    <div className={styles.sectionDivider}>
      <h2 className={styles.sectionTitle}>{title}</h2>
      {subtitle && <p className={styles.sectionSubtitle}>{subtitle}</p>}
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════
   Main EndpointCatalog Component
   ═══════════════════════════════════════════════════════════ */
export default function EndpointCatalog() {
  const [activeTab, setActiveTab] = useState('watchguard');
  const data = useEndpointData();
  const { addItem } = useQuote();
  const handleAdd = (item) => addItem(item);

  const wgProducts = PRODUCTS.filter((p) => p.group === 'watchguard');
  const pandaProducts = PRODUCTS.filter((p) => p.group === 'panda');

  const coreProducts = wgProducts.filter((p) => p.section === 'core');
  const moduleProducts = wgProducts.filter((p) => p.section === 'modules');
  const dnsProducts = wgProducts.filter((p) => p.section === 'dns');
  const bundleProducts = wgProducts.filter((p) => p.section === 'bundle');

  const productCounts = {
    watchguard: wgProducts.length,
    panda: pandaProducts.length,
  };

  return (
    <div className={styles.catalog}>
      {/* ─── Banner ─── */}
      <EndpointBanner />

      {/* ─── Category Tabs ─── */}
      <CategoryTabs
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        productCounts={productCounts}
      />

      {/* ─── WatchGuard Endpoint Tab ─── */}
      {activeTab === 'watchguard' && (
        <>
          <InfoCallout onSwitch={() => setActiveTab('panda')} />

          {/* Core Endpoint Protection — 4-column */}
          <SectionHeader
            title="Core Endpoint Protection"
            subtitle="Four tiers from baseline antivirus to advanced threat hunting — pick the level that fits your customer."
          />
          <div className={styles.coreGrid}>
            {coreProducts.map((product) => (
              <ProductCard key={product.key} product={product} data={data} onAdd={handleAdd} />
            ))}
          </div>

          {/* Comparison Table — right below core products */}
          <EndpointComparisonTable />

          {/* Add-On Modules — 3-column */}
          <SectionHeader
            title="Endpoint Add-On Modules"
            subtitle="Extend any endpoint subscription with encryption, patching, and advanced reporting."
          />
          <div className={styles.modulesGrid}>
            {moduleProducts.map((product) => (
              <ProductCard key={product.key} product={product} data={data} onAdd={handleAdd} />
            ))}
          </div>

          {/* DNS & Mobile + User Security Bundle — wide cards side by side */}
          <div className={styles.dualCardRow}>
            {dnsProducts.map((product) => (
              <ProductCard key={product.key} product={product} data={data} onAdd={handleAdd} variant="wide" />
            ))}
            {bundleProducts.map((product) => (
              <ProductCard key={product.key} product={product} data={data} onAdd={handleAdd} variant="wide" />
            ))}
          </div>
        </>
      )}

      {/* ─── Legacy Panda Tab ─── */}
      {activeTab === 'panda' && (
        <>
          <SectionHeader
            title="Legacy Panda Products"
            subtitle="Same underlying WatchGuard endpoint platform with Panda-branded SKUs. For customers on existing Panda licenses."
          />
          <div className={styles.productGrid}>
            {pandaProducts.map((product) => (
              <ProductCard key={product.key} product={product} data={data} onAdd={handleAdd} />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
