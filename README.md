# WatchGuard Product Configurator

A React + Vite product catalogue and quote-building tool for WatchGuard hardware, subscriptions, and cloud/virtual products. Built for the Leader Systems partner channel — resellers use this to browse the full WatchGuard portfolio and build quotes to send to Leader account managers.

Staging preview (static): **https://3stankyle.github.io/LEADERWG/**

---

## Table of Contents

- [Tech Stack](#tech-stack)
- [Getting Started](#getting-started)
- [Deployment](#deployment)
- [Project Structure](#project-structure)
- [Data Architecture](#data-architecture)
- [Updating Prices](#updating-prices)
- [Updating Product Specs](#updating-product-specs)
- [Adding New Products](#adding-new-products)
- [Deploying to GitHub Pages (Staging)](#deploying-to-github-pages-staging)

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 18, React Router v7, Vite |
| Backend | Node.js, Express 5 |
| Database | SQLite via `better-sqlite3` |
| Icons | Phosphor Icons |
| PDF export | jsPDF + jsPDF-AutoTable |
| Production hosting | Node.js + Express + SQLite (self-hosted live backend) |
| Staging preview | GitHub Pages (static JSON, no backend) |

---

## Getting Started

```bash
npm install
npm run dev
```

This starts both the Vite dev server (frontend, port 5173) and the Express API (backend, port 3001). On first run — or whenever a source data file changes — the database is automatically re-seeded.

**All commands:**

| Command | What it does |
|---------|-------------|
| `npm run dev` | Start frontend + backend concurrently |
| `npm run dev:frontend` | Start Vite only (no backend) |
| `npm run dev:backend` | Start Express only |
| `npm run seed` | Force a full database re-seed |
| `npm run export-data` | Export database to static JSON (required before deploy) |
| `npm run build` | Vite production build |
| `npm run preview` | Preview the production build locally |
| `npm run deploy` | export-data + build + push to `gh-pages` branch |

---

## Deployment

This app has two deployment targets with different purposes:

| Environment | Platform | URL | Backend | Purpose |
|-------------|----------|-----|---------|---------|
| **Production** | Self-hosted Node server | [watchguard.leadersystems.com.au](https://watchguard.leadersystems.com.au/) | Express + SQLite (live) | The real, production app with a live database |
| **Staging** | GitHub Pages | [3stankyle.github.io/LEADERWG](https://3stankyle.github.io/LEADERWG/) | None (static JSON) | Static preview for internal testing — no backend, data is pre-exported JSON snapshots |

### Production — self-hosted Node backend

Production runs the full application as a single Node service: the Express API + SQLite database + built React frontend, served together from `https://watchguard.leadersystems.com.au/`.

**How it works:**
1. `npm run seed` builds `server/products.db` from the CSV sources
2. `npm run build` produces the Vite frontend into `dist/`
3. `npm start` launches Express in production mode, serving both the API (`/api/*`) and the built frontend
4. The React app fetches data from `/api` on the same origin — no CORS, no fallback needed

To ship a data/price update: drop in the new CSVs, run `npm run seed`, then restart the server (see [Updating Prices](#updating-prices)).

### Staging — GitHub Pages

GitHub Pages serves a **flat, static preview** of the app. There is no backend — all data comes from pre-exported JSON files in `public/static-data/`. This is purely for internal colleagues to preview and interact with the UI before production deployment.

See [Deploying to GitHub Pages (Staging)](#deploying-to-github-pages-staging) for instructions.

### Key differences between environments

| Aspect | Production (self-hosted) | Staging (GitHub Pages) |
|--------|---------------------|----------------------|
| Data source | Live SQLite database via Express API | Pre-exported static JSON files |
| Data freshness | Always current (re-seed + restart) | Snapshot from last `npm run deploy` |
| Base URL path | `/` | `/LEADERWG/` |
| API calls | `/api/*` on same origin | Skipped entirely — loads JSON directly |

---

## Project Structure

```
├── src/
│   ├── App.jsx                            # Root component + routing
│   ├── components/
│   │   ├── ProductCatalog/                # Security Appliances tab
│   │   │   ├── ProductCatalog.jsx
│   │   │   ├── hooks/                     # useProductData, useSubscriptions, etc.
│   │   │   └── parts/                     # ProductColumns, SubscriptionRow, SpecsSection
│   │   ├── ApplianceRenewals/             # Renewal cards (embedded in ProductCatalog)
│   │   ├── RenewalsCatalog/               # Renewals/Upgrades tab (all appliance families)
│   │   ├── VirtualCatalog/                # Virtual tab (FireboxV)
│   │   ├── CloudCatalog/                  # Cloud tab (Firebox Cloud)
│   │   ├── EndpointCatalog/               # Endpoint & Mobile tab
│   │   ├── IdentityCatalog/               # Identity & Access tab
│   │   ├── EmailCatalog/                  # Email Security tab
│   │   ├── MdrNdrCatalog/                 # MDR & NDR tab
│   │   ├── TopLevelNav/                   # Navigation bar
│   │   ├── QuoteCartPanel/                # Quote cart + PDF export
│   │   └── ...
│   ├── hooks/
│   │   ├── useCatalogApi.js               # Generic fetch hook (API + static-JSON fallback)
│   │   ├── useApplianceCatalog.js         # Shared hook for appliance-style catalogs
│   │   └── usePerUserCatalog.js           # Shared hook for per-user subscription catalogs
│   ├── context/
│   │   └── QuoteContext.jsx               # Quote cart state (React Context)
│   └── data/
│       ├── WGdata_YYYYMMDD_HHMMSS.csv     # ★ SINGLE PRICING SOURCE — drop new file here
│       ├── featureSpecs.shared.cjs        # Product specs (shared by frontend + backend)
│       ├── featureSpecs.js                # ESM wrapper for the above
│       ├── productPrices.js               # Price lookups (reads WGdata CSV)
│       ├── productSkus.js                 # SKU code mapping (T-Series, M-Series, Wi-Fi only)
│       └── productSkus/
│           ├── tabletop.js                # T-Series SKU codes
│           ├── mSeries.js                 # M-Series SKU codes
│           └── wifi.js                    # Wi-Fi AP SKU codes
│
├── server/
│   ├── index.js                           # Express API (4 category endpoints)
│   ├── seed.js                            # Builds SQLite DB from CSV sources
│   ├── db.js                              # SQLite schema
│   ├── products.db                        # Auto-generated database (do not edit)
│   └── data/
│       └── product-catalog.csv            # ★ ALL 1,604 SKUs — structure, URLs, grouping
│
├── scripts/
│   ├── export-static-data.cjs            # DB → static JSON for GitHub Pages
│   └── generate-catalog-from-wgdata.cjs  # Regenerates product-catalog.csv from a new WGdata CSV
│
├── public/
│   └── static-data/                       # Pre-exported JSON (GitHub Pages fallback)
│       ├── categories.json
│       ├── category-{slug}.json           # Per-category data (10 categories)
│       └── product-{slug}.json            # Per-product data (90 products)
│
└── dist/                                  # Vite build output
```

---

## Data Architecture

### Single source of truth for pricing

All pricing across every tab comes from one file:

```
src/data/WGdata_YYYYMMDD_HHMMSS.csv
```

This is the CSV export from the Leader Systems datafeed. It contains every WatchGuard SKU with current DBP and RRP values. The app uses the **RRP column** (column 8).

There are no other price files. If you see prices that are wrong, you need a fresh WGdata export.

### Two files, two responsibilities

| File | Lives in | Purpose | How often it changes |
|------|----------|---------|---------------------|
| `WGdata_*.csv` | `src/data/` | **Pricing** — RRP for every SKU | Whenever prices change |
| `product-catalog.csv` | `server/data/` | **Product structure** — all 1,604 SKUs, their grouping, and partner order URLs | Only when adding/removing products |

The product catalog CSV defines *what products exist* (names, product families, groups, delivery method, partner ordering URLs) for all product categories — appliances, virtual, cloud, endpoint, identity, email, MDR/NDR, and renewals. It does **not** contain prices — those come exclusively from the WGdata CSV.

**product-catalog.csv format** (6 columns):

```
SKU, Name, Method of Delivery, Product Family, Product Group, url in dealershop
```

| Column | Example | Purpose |
|--------|---------|---------|
| `SKU` | `NWG-WGM290000` | Full SKU code (matches WGdata STOCK CODE for price lookup) |
| `Name` | `WatchGuard Firebox M290` | Display name |
| `Method of Delivery` | `Physical` or `Electronic` | How the product is fulfilled |
| `Product Family` | `M-Series`, `Endpoint`, etc. | Groups into categories |
| `Product Group` | `M290`, `AuthPoint`, etc. | Groups SKUs into a single product page |
| `url in dealershop` | `https://partner.leadersystems...` | Encrypted permanent link to Leader Systems dealer shop |

The dealer shop URLs are encrypted, auto-generated permanent links. Each SKU maps to a unique URL on the Leader Systems partner site. If URLs need bulk updating (e.g. site migration), update the URL column in this CSV and re-seed.

> **TODO:** Build a `scripts/check-dealer-urls.cjs` validation script that checks all dealer shop URLs for dead links (HEAD request, report non-200 responses).

### How data flows to the frontend

```
   ┌──────────────────────┐   ┌──────────────────────┐
   │  product-catalog.csv │   │  WGdata_*.csv        │
   │  (1,604 SKUs + URLs) │   │  (pricing — RRP)     │
   └──────────┬───────────┘   └──────────┬───────────┘
              │                           │
              └─────────┬─────────────────┘
                        ▼
              ┌──────────────────┐
              │  seed.js          │
              │  → SQLite DB      │
              └────────┬──────────┘
                       │
              ┌────────┼────────────┐
              ▼                     ▼
   ┌─────────────────┐   ┌──────────────────┐
   │  Express API     │   │  static JSON     │
   │  (port 3001)     │   │  (GitHub Pages)  │
   └────────┬─────────┘   └────────┬─────────┘
            └────────┬─────────────┘
                     ▼
   ┌─────────────────────────────────┐
   │  All catalog tabs               │
   │  useCatalogApi → usePerUser /   │
   │  useApplianceCatalog hooks      │
   └─────────────────────────────────┘
```

`seed.js` combines `product-catalog.csv` (structure, URLs) with `WGdata_*.csv` (prices) to populate the SQLite database. The Express API serves category endpoints. On GitHub Pages, pre-exported static JSON files are used instead. All catalog components fetch data through shared hooks (`useCatalogApi` → `usePerUserCatalog` or `useApplianceCatalog`).

### How the backend serves data

**API endpoints (Express, port 3001):**

| Endpoint | Returns |
|----------|---------|
| `GET /api/categories` | All categories with product groups |
| `GET /api/categories/:category` | All product groups + SKUs for a category |
| `GET /api/products/:slug` | Full product detail — all SKUs, specs, prices |
| `GET /api/products/:slug/subscriptions` | Subscriptions only (grouped by type) |

**Frontend fallback:** The `useProductData` hook calls `fetchWithFallback()` which tries the API first. If unreachable (GitHub Pages), it loads `public/static-data/{file}.json` instead.

### Auto-reseed trigger

`seedIfNeeded()` runs every time the Express server starts. It compares the modification time of `server/products.db` against:

- `server/data/product-catalog.csv`
- `src/data/WGdata_*.csv` (latest)
- `src/data/featureSpecs.shared.cjs`

If **any** file is newer than the database, a full re-seed runs automatically.

### Database schema

```
product_groups   id, slug, name, family, category, description, image_file
skus             id, sku_code, full_sku, name, msrp, delivery_method,
                 product_group_id, url, sku_type, subscription_type, term_years
product_features id, product_group_id, feature_category, feature_name,
                 feature_value, sort_order
```

`sku_type` values: `appliance` | `subscription` | `trade_up` | `high_availability` | `activation_bundle`

---

## Updating Prices

### Step by step

1. Export a fresh CSV from the Leader Systems datafeed
2. Save it as `WGdata_YYYYMMDD_HHMMSS.csv` in `src/data/`
3. Delete the old `WGdata_*.csv` to keep the repo clean
4. Restart the dev server — the database re-seeds automatically

The console will confirm:
```
Seeded successfully:
  90 product groups
  1604 SKUs (1603 with prices, 1 showing TBC)
  388 feature entries
  pricing source: WGdata_20260710_115109.csv
```

### WGdata CSV format

The datafeed CSV must have these 8 columns:

```
STOCK CODE | SUBCATEGORY NAME | SHORT DESCRIPTION | IMAGE | MANUFACTURER | MFR SKU | DBP | RRP
```

The app uses **column 1** (`STOCK CODE`, e.g. `NWG-WGM290000`) as the SKU lookup key and **column 8** (`RRP`) as the price. All other columns are ignored by the price system.

### Before deploying

After updating prices locally, regenerate the static JSON for GitHub Pages:

```bash
npm run export-data
```

This must be committed before pushing to production. For the staging preview, `npm run deploy` re-exports the data as part of the deploy.

---

## Updating Product Specs

The comparison specs (UTM throughput, firewall throughput, VPN tunnels, etc.) have a single source of truth:

```
src/data/featureSpecs.shared.cjs
```

This file is shared between the frontend UI and the backend seed. After editing:

1. Restart the dev server (auto-reseeds)
2. Run `npm run export-data` before deploying

---

## Adding New Products

### To the Security Appliances tab

1. **Add SKUs to `server/data/product-catalog.csv`** — one row per SKU (appliance + subscriptions + HA). The `Product Group` column becomes the product slug.

2. **Add specs to `src/data/featureSpecs.shared.cjs`** — performance figures, interfaces, etc.

3. **Add an image** — place in `public/images/` and add the slug-to-filename mapping in the `IMAGE_MAP` object in `server/seed.js`. Also add the product description to `DESCRIPTIONS` in the same file.

4. **Ensure the WGdata CSV has prices** for the new SKUs — the datafeed should include them automatically.

5. **Re-seed and export:**
   ```bash
   node server/seed.js
   npm run export-data
   ```

### To any other tab (Virtual, Cloud, Endpoint, Identity, Email, MDR/NDR, Renewals)

All product data for these tabs lives in `product-catalog.csv`. To add a new SKU:

1. **Add rows to `server/data/product-catalog.csv`** — one row per SKU with the correct Product Family and Product Group
2. **Ensure the WGdata CSV has prices** for the new SKUs
3. **Re-seed and export:**
   ```bash
   node server/seed.js
   npm run export-data
   ```

The frontend hooks (`useApplianceCatalog`, `usePerUserCatalog`) automatically pick up new data from the API.

---

## Deploying to GitHub Pages (Staging)

> **Note:** GitHub Pages is for **staging/preview only** — it serves static JSON with no backend. Production runs on the self-hosted Node backend with a live database. See [Deployment](#deployment) for details.

The staging preview lives on the `gh-pages` branch and is published **manually** with a single command — there is no CI/CD, so it only updates when you run the deploy.

### Workflow

```bash
# 1. Make your changes (code, data, prices) and commit them to main
git add -A
git commit -m "your message"
git push

# 2. Publish the static preview to gh-pages
npm run deploy
```

`npm run deploy` runs `export-data` (DB → static JSON), builds with the `/LEADERWG/` base path, and pushes `dist/` to the `gh-pages` branch. The live preview updates a minute or two later.

### After deploy

Hard refresh the site (**Ctrl+F5**) — GitHub Pages can serve cached assets.

### Optional: preview before pushing

```bash
npm run export-data
npm run build
npm run preview
```

---

## Application Tabs

| Tab | Route | Status | Component | Data source |
|-----|-------|--------|-----------|-------------|
| Security Appliances | `/` | Live | `ProductCatalog` | SQLite DB / static JSON |
| Virtual | `/virtual` | Live | `VirtualCatalog` | SQLite DB / static JSON |
| Cloud | `/cloud` | Live | `CloudCatalog` | SQLite DB / static JSON |
| Renewals/Upgrades | `/renewals` | Live | `RenewalsCatalog` | SQLite DB / static JSON |
| MDR & NDR | `/mdr-ndr` | Live | `MdrNdrCatalog` | SQLite DB / static JSON |
| Endpoint & Mobile | `/endpoint` | Live | `EndpointCatalog` | SQLite DB / static JSON |
| Identity & Access | `/identity` | Live | `IdentityCatalog` | SQLite DB / static JSON |
| Email Security | `/email` | Live | `EmailCatalog` | SQLite DB / static JSON |

### Security Appliances sub-tabs

| Sub-tab | Products |
|---------|---------|
| Firebox Tabletop (T-Series) | T25-W, T45-PoE, T45-W-PoE, T45-CW, T115-W, T125, T125-W, T145, T145-W, T185 |
| Firebox Rackmount (M-Series) | M290, M295, M390, M395, M495, M590, M595, M690, M695, M4800, M5800 |
| Wi-Fi 6 Access Points | AP130, AP230W, AP330, AP332CR, AP430CR, AP432 |
