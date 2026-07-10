# WatchGuard Catalogue Update — Handover

_Last updated: 2026-07-10. Covers the July 2026 catalogue refresh (WGdata `20260710`)._

This note explains **what changed**, **how to re-seed from the CSVs**, and **how / where products render on the front end** (what appears automatically vs. what needs a code edit).

---

## 1. The two CSVs (the source of truth)

| File | Role |
|------|------|
| `src/data/WGdata_YYYYMMDD_HHMMSS.csv` | **Pricing** + product master list from WatchGuard/Leader. `seed.js` always uses the **latest** `WGdata_*.csv` in this folder. |
| `server/data/product-catalog.csv` | **Structure**: `SKU, Name, Method of Delivery, Product Family, Product Group, url in dealershop`. Defines how SKUs group into products and which tab they land in. The `url in dealershop` column is the dealer-shop link, filled by hand. |

To refresh the catalogue you drop in a new `WGdata_*.csv` and regenerate `product-catalog.csv` from it (see §4).

---

## 2. How to re-seed

The app reads from a SQLite DB (`server/products.db`) built from the two CSVs. `products.db` is **git-ignored** — it is always regenerated, never committed.

```bash
npm run seed        # rebuilds server/products.db from product-catalog.csv + latest WGdata_*.csv
```

`seed.js` combines: **structure** (`product-catalog.csv`) + **prices** (RRP column of the latest `WGdata_*.csv`, matched by SKU) + **feature specs** (`src/data/featureSpecs.shared.cjs`, tabletop/mseries/wifi only).

### Deploying the update

The live site (`watchguard.leadersystems.com.au/wg-configurator/`) runs a **live Node backend** (`server/index.js`) serving the API off `products.db`.

- **Production build re-seeds automatically:** `railway:build` = `npm run seed && npm run build`. So committing updated CSVs and redeploying is enough.
- **Manual refresh:** `npm run seed`, then restart the server (`npm start`).
- **Static GitHub-Pages mirror (only if used):** `npm run export-data` regenerates `public/static-data/*.json`, then `npm run deploy`. The live backend does **not** need this step.

---

## 3. How the CSV maps to the UI

`seed.js` turns each catalog row into DB records:

- **Product Family → category** via `familyToCategory()`. The category decides which tab the product belongs to.
- **Product Group → a "product"** (one card). All SKUs sharing a Product Group slug become one card with a licence/term dropdown.
- **Price** joined from WGdata by SKU.

### ⚠️ Ordering rule (important, easy to break)

`seed.js` keys product groups by the **Product Group slug only** and takes the **first-seen row's** family/category. A model like `M290` or `T25` appears in **both** its appliance family (`M-Series`/`T-Series`) **and** `Renewals` (its renewal SKUs). If a Renewals row is seen first, the whole model is miscategorised into the Renewals tab and **disappears from its appliance tab**.

➡️ The catalogue generator (`scripts/generate-catalog-from-wgdata.cjs`) emits **all `Renewals` rows last** so the appliance family always wins. Keep this ordering if you hand-edit the CSV.

---

## 4. Regenerating `product-catalog.csv` from a new WGdata

```bash
node scripts/generate-catalog-from-wgdata.cjs   # writes server/data/product-catalog-new.csv
```

What it does:
- One row per WGdata SKU (excludes the "Accessories" subcategory).
- **Reuses** the existing catalogue's hand-curated Family/Group for SKUs already present; **derives** Family/Group for new SKUs by parsing the product name.
- Leaves `url in dealershop` **blank** (fill by hand), applies the Renewals-last ordering, normalises names.
- Prints a report (family counts, new groups, rows flagged for review).

Review the `-new.csv`, fill the dealer-shop URLs, then replace `product-catalog.csv` with it and re-seed.

---

## 5. Where each product renders (tabs)

Top nav routes → components. **Two rendering modes:**

| Tab (route) | Component | Mode | New products appear automatically? |
|---|---|---|---|
| **Security Appliances** `/` — Tabletop / M-Series / Wi-Fi sub-tabs | `ProductCatalog` | **Dynamic** (from `/api/categories`) | ✅ **Yes** — new appliance/AP groups show up on re-seed |
| **Renewals & Upgrades** `/renewals` | `RenewalsCatalog` | **Dynamic** (T\*/M\* by prefix) | ✅ **Yes** for T-/M-model renewals |
| **Virtual** `/virtual` | `VirtualCatalog` | **Hardcoded** `MODELS` in `useFireboxVData.js` | ❌ needs a `MODELS` entry |
| **Cloud** `/cloud` | `CloudCatalog` | **Hardcoded** `MODELS` in `useFireboxCloudData.js` | ❌ needs a `MODELS` entry |
| **MDR & NDR** `/mdr-ndr` | `MdrNdrCatalog` | **Hardcoded** `PRODUCTS` in `useMdrNdrData.js` | ❌ needs a `PRODUCTS` entry |
| **Endpoint & Mobile** `/endpoint` | `EndpointCatalog` | **Hardcoded** `PRODUCTS` in `useEndpointData.js` | ❌ needs a `PRODUCTS` entry |
| **Identity & Access** `/identity` | `IdentityCatalog` | **Hardcoded** `PRODUCTS` in `useIdentityData.js` | New **terms** on existing products show automatically; new products need an entry |
| **Email Security** `/email` | `EmailCatalog` | **Hardcoded** `PRODUCTS` in `useEmailData.js` | ❌ needs a `PRODUCTS` entry |

The top-level tab bar itself (`TopLevelNav.jsx`) and the appliance sub-tabs (`CategoryBanner.jsx`) are also hardcoded — a genuinely new **tab** needs a nav entry + a `<Route>` in `App.jsx` + a component.

---

## 6. This update: what shows now vs. what needs a front-end edit

**Renders automatically after re-seed (dynamic tabs):**
- New Firebox appliances **T25**, **T85-PoE**, **NV5** → Security Appliances ▸ Tabletop (images auto-load from the partner site by SKU; descriptions added for T25/T85-PoE — NV5 still needs one in `seed.js` `DESCRIPTIONS`).
- New T-/M-model renewals → Renewals & Upgrades.
- New AuthPoint terms → existing AuthPoint card.

**In the data (categorised, not "other") but NOT yet shown — need a `PRODUCTS`/`MODELS` entry keyed by the Product Group slug:**
| Product line | Group slug(s) | Add to |
|---|---|---|
| FireboxV Micro | `FireboxV Micro` | `useFireboxVData.js` `MODELS` |
| Open MDR, Orion, ThreatSync Open | `Open MDR`, `Orion`, `ThreatSync Open` | `useMdrNdrData.js` `PRODUCTS` |
| Endpoint Security Basic/360/Elite/Prime/Servers/Data Retention, Zero-Trust, Managed Zero-Trust | those slugs | `useEndpointData.js` `PRODUCTS` |
| FireCloud, CloudDR | `FireCloud Internet Access`, `FireCloud Total Access`, `CloudDR` | Cloud page (or a new tab) |
| Reporting & Visibility (Compliance Reporting, SIEMFeeder, Dimension Command) | those slugs | MDR/NDR page (or a new "Reporting" tab) |
| MSSP pre-pay points | `MSSP Points` | Renewals page (or a new tab) |
| Wi-Fi Management (generic 1-AP renewals) | `Wi-Fi Management` | shows on Wi-Fi tab but has no image — review placement |

**New families added to `seed.js` `familyToCategory()`** (so none fall into "other"): `FireCloud`→cloud, `CloudDR`→cloud, `Firebox NV-Series`→tabletop, `Reporting & Visibility`→mdr_ndr, `MSSP`→renewals. Re-home these if you'd rather they had their own tabs.

---

## 7. Quick reference — files touched in this update

- `server/data/product-catalog.csv` — regenerated (1,604 products)
- `src/data/WGdata_20260710_115109.csv` — new pricing source
- `server/seed.js` — new family→category mappings + T25/T85-PoE descriptions
- `scripts/generate-catalog-from-wgdata.cjs` — the regenerator (re-run on future WGdata drops)
