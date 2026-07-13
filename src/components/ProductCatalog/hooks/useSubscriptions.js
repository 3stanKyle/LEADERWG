import { useState, useCallback, useEffect } from 'react';

/**
 * useSubscriptions
 * ────────────────
 * Manages per-product subscription state (selected type, term) and
 * exposes helpers to derive available options and the currently-selected SKU.
 *
 * @param {Object} productDetails – { [slug]: { subscriptions: [...], ... } }
 * @param {string} activeTab – triggers a reset when the tab changes
 */
// Only show new security suites — renewals/upgrades live in the Renewals section below
// Only show new security suites — renewals/upgrades live in the Renewals section below
const NEW_SUITE_TYPES = [
  'Standard Support', 'Basic Security Suite', 'Total Security Suite',
  'Standard Wi-Fi', 'USP Wi-Fi',
];

// Lowest term-length offered for a given subscription type on a product.
// Some products only offer a licence at a single term (e.g. NV5 Standard
// Support is 5-year only), so defaulting the selector to "1 year" would point
// at a SKU that doesn't exist and show no price. Falls back to 1 only when the
// type has no term-bearing SKUs.
const firstTermFor = (data, subType) => {
  const terms = [
    ...new Set(
      (data?.subscriptions || [])
        .filter((s) => s.subscription_type === subType)
        .map((s) => s.term_years)
        .filter((t) => t > 0),
    ),
  ].sort((a, b) => a - b);
  return terms[0] || 1;
};

export default function useSubscriptions(productDetails, activeTab) {
  // { [slug]: { subType: string, termYears: number } }
  const [selections, setSelections] = useState({});

  // Reset when tab changes
  useEffect(() => {
    setSelections({});
  }, [activeTab]);

  // Initialise defaults whenever productDetails arrives for a slug
  useEffect(() => {
    if (!productDetails) return;
    setSelections((prev) => {
      const next = { ...prev };
      Object.entries(productDetails).forEach(([slug, data]) => {
        if (next[slug]) return; // already initialised
        const types = [...new Set((data.subscriptions || []).map((s) => s.subscription_type))]
          .filter((t) => NEW_SUITE_TYPES.includes(t));
        types.sort((a, b) => NEW_SUITE_TYPES.indexOf(a) - NEW_SUITE_TYPES.indexOf(b));
        const defaultType = types[0] || '';
        next[slug] = { subType: defaultType, termYears: firstTermFor(data, defaultType) };
      });
      return next;
    });
  }, [productDetails]);

  const getSelection = useCallback(
    (slug) => selections[slug] || { subType: '', termYears: 1 },
    [selections],
  );

  const setSubType = useCallback((slug, subType) => {
    setSelections((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], subType, termYears: firstTermFor(productDetails?.[slug], subType) },
    }));
  }, [productDetails]);

  const setTermYears = useCallback((slug, termYears) => {
    setSelections((prev) => ({
      ...prev,
      [slug]: { ...prev[slug], termYears },
    }));
  }, []);

  const getSubscriptionTypes = useCallback(
    (slug) => {
      const d = productDetails[slug];
      if (!d?.subscriptions) return [];
      const types = [...new Set(d.subscriptions.map((s) => s.subscription_type))]
        .filter((t) => NEW_SUITE_TYPES.includes(t));
      return types.sort((a, b) => NEW_SUITE_TYPES.indexOf(a) - NEW_SUITE_TYPES.indexOf(b));
    },
    [productDetails],
  );

  const getAvailableTerms = useCallback(
    (slug) => {
      const sel = getSelection(slug);
      const d = productDetails[slug];
      if (!d?.subscriptions) return [];
      return [
        ...new Set(
          d.subscriptions
            .filter((s) => s.subscription_type === sel.subType)
            .map((s) => s.term_years)
            .filter((t) => t > 0),
        ),
      ].sort((a, b) => a - b);
    },
    [productDetails, getSelection],
  );

  const getCurrentSub = useCallback(
    (slug) => {
      const sel = getSelection(slug);
      const d = productDetails[slug];
      if (!d?.subscriptions) return null;
      return (
        d.subscriptions.find(
          (s) => s.subscription_type === sel.subType && s.term_years === sel.termYears,
        ) || null
      );
    },
    [productDetails, getSelection],
  );

  return {
    getSelection,
    setSubType,
    setTermYears,
    getSubscriptionTypes,
    getAvailableTerms,
    getCurrentSub,
  };
}
