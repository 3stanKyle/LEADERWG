import React from 'react';
import { ShoppingCartSimple } from '@phosphor-icons/react';
import styles from '../ProductCatalog.module.css';

const formatPrice = (p) => {
  if (!p || p === 0) return 'TBC';
  return '$' + Math.round(p).toLocaleString('en-AU');
};

// A SKU with no price must not be quotable — an unpriced licence added to a
// quote reaches the customer as a $0 line item.
const isQuotable = (sub) => Boolean(sub) && sub.msrp > 0;

const termLabel = (y) => (y === 1 ? '1 Year' : `${y} Years`);

/**
 * SubscriptionRow
 * ───────────────
 * Renders the licence-selector row as flat grid items.
 * The label cell + one cell per product.
 */
export default function SubscriptionRow({
  products,
  getSelection,
  setSubType,
  setTermYears,
  getSubscriptionTypes,
  getAvailableTerms,
  getCurrentSub,
  onAddSubscription,
}) {
  return (
    <>
      <div className={styles.subLabelCell}>
        <div>
          Watchguard Licence
          <a
            href="#security-bundles"
            className={styles.bundlesLink}
            onClick={(e) => {
              e.preventDefault();
              document.getElementById('security-bundles')?.scrollIntoView({ behavior: 'smooth' });
            }}
          >
            What are the WatchGuard security service bundles?
          </a>
        </div>
      </div>
      {products.map((product) => {
        const subTypes = getSubscriptionTypes(product.slug);
        const terms = getAvailableTerms(product.slug);
        const sel = getSelection(product.slug);
        const currentSub = getCurrentSub(product.slug);

        return (
          <div key={`sub-${product.slug}`} className={styles.subCell}>
            {subTypes.length > 0 ? (
              <>
                <select
                  className={styles.subSelect}
                  value={sel.subType || ''}
                  onChange={(e) => setSubType(product.slug, e.target.value)}
                >
                  {subTypes.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>

                <select
                  className={styles.subSelect}
                  value={sel.termYears || 1}
                  onChange={(e) => setTermYears(product.slug, Number(e.target.value))}
                >
                  {terms.map((y) => (
                    <option key={y} value={y}>
                      {termLabel(y)}
                    </option>
                  ))}
                </select>

                <div className={styles.subPrice}>
                  {currentSub ? formatPrice(currentSub.msrp) : '—'}
                  {currentSub && <span className={styles.priceNote}>MSRP</span>}
                </div>

                <button
                  className={styles.addSubBtn}
                  onClick={() => onAddSubscription(product)}
                  disabled={!isQuotable(currentSub)}
                  title="Add subscription to quote cart"
                >
                  <ShoppingCartSimple size={14} weight="bold" />
                  Add to Quote
                </button>

                {currentSub?.url && (
                  <a
                    href={currentSub.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={styles.skuLink}
                  >
                    {currentSub.full_sku}
                  </a>
                )}
              </>
            ) : (
              <span className={styles.noSub}>—</span>
            )}
          </div>
        );
      })}
    </>
  );
}
