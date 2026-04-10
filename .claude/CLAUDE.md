# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

WatchGuard Product Configurator — a React+Vite product catalog and quote builder for WatchGuard hardware, subscriptions, and cloud/virtual products sold through the Leader Systems partner channel. Live at https://leadermarketing.github.io/LEADERWG/.

## Commands

```bash
npm run dev              # Start Vite (port 5173) + Express API (port 3001) concurrently
npm run dev:frontend     # Vite only
npm run dev:backend      # Express only
npm run seed             # Force full database re-seed from CSVs
npm run export-data      # Export DB to static JSON (REQUIRED before deploy)
npm run build            # Vite production build
npm run deploy           # export-data + build + push to gh-pages
```

There are no tests or linting configured. Verification is manual (run dev server, check tabs).

After any data change (CSV edits, seed.js changes), always run `npm run export-data` to regenerate `public/static-data/`.

## Data Architecture (Critical)

Two CSV files seed the SQLite database — understand this or you'll break things:

| File | Purpose | Location |
|------|---------|----------|
| `server/data/product-catalog.csv` | **Structure**: 1,262 SKUs — names, families, groups, delivery method, dealer URLs | 6 columns, no prices |
| `src/data/WGdata_*.csv` | **Pricing**: RRP for every SKU from Leader Systems datafeed | Column 1 = SKU, Column 8 = RRP |

`server/seed.js` merges both into `server/products.db` (SQLite). The Express API serves it; on GitHub Pages, pre-exported static JSON files are used instead. The database auto-reseeds when source files are newer than `products.db`.

**product-catalog.csv columns**: `SKU, Name, Method of Delivery, Product Family, Product Group, url in dealershop`

**DB schema** (3 tables): `product_groups` (75 rows) → `skus` (1,262 rows) → `product_features` (337 rows). `sku_type` values: `appliance`, `subscription`, `trade_up`, `high_availability`, `activation_bundle`.

## Architecture — Two Hook Families

All catalog tabs fetch data through `src/hooks/useCatalogApi.js` which tries the Express API first, then falls back to `public/static-data/category-{slug}.json`. Two shared hooks sit on top:

### `useApplianceCatalog(category)` — for Virtual, Cloud, Renewals
Builds lookups keyed by `model → serviceType → term → { sku, price, url }`. Used by tabs where products are hardware models with subscription tiers (Basic Security, Total Security, etc.) and term lengths (1/3/5 Year).

### `usePerUserCatalog(category, productConfig)` — for Endpoint, Identity, Email, MDR/NDR
Builds lookups keyed by `product → licenseTier → term → { sku, price, url }`. Used by tabs where products have per-user pricing across license tiers (1-50, 51-100, etc.). The `productConfig` array is defined in each component's `hooks/use*Data.js` file and defines product metadata (label, description, section grouping). **Important**: this hook returns `products` (lowercase) — components must destructure the lowercase name.

### ProductCatalog (Security Appliances) — special case
The `/` route uses `src/components/ProductCatalog/hooks/useProductData.js` which fetches individual product data via `/api/products/:slug`. It also uses `src/data/productSkus/` (T-Series, M-Series, Wi-Fi) and `src/data/productPrices.js` for the client-side SKU→price mapping. This is the only tab that still uses the legacy client-side SKU system.

### ApplianceRenewals — merges multiple categories
`useApplianceRenewals` and `useRenewalsData` each fetch from multiple API categories (renewals + tabletop + mseries) and merge the lookups, because renewal SKUs for a given model may live in different database categories.

## Deployment (Three Environments)

| Environment | Platform | Backend | Base path |
|-------------|----------|---------|-----------|
| **Local dev** | Vite + Express | Express on port 3001, Vite proxies `/api` | `/` |
| **Production** | Railway | Express + SQLite, serves built frontend | `/` |
| **Staging** | GitHub Pages | None — static JSON fallback | `/LEADERWG/` |

`useCatalogApi` tries the Express API first, then falls back to `public/static-data/*.json`. Static JSON must be committed before pushing to GitHub Pages. GitHub Actions runs `npm ci` + `npm run build` but does NOT run `export-data`. Railway runs `npm run railway:build` (seeds DB + builds frontend) and `npm start`.

## Key Patterns

- **Vite base path**: Defaults to `/` for Railway production. Set `VITE_BASE_PATH=/LEADERWG/` for GitHub Pages staging. Configured in `vite.config.mjs`.
- **Quote cart**: `QuoteContext.jsx` (React Context + useReducer). Persists across tabs. `addItem({ sku, name, description, unitPrice })` is the standard interface. PDF export via jsPDF.
- **`formatPrice(null)` returns `'TBC'`** — when data is loading, all lookups return null. Always guard with a loading check before rendering prices, or users see a flash of "TBC" on every price.
- **seed.js parses CSV from both ends** — `fields[0]` and `fields[1]` from the left, `fields[-1]`, `fields[-2]`, etc. from the right. This handles unquoted prices with commas (e.g. `$2,300.00`) that split into extra fields. If you change CSV columns, understand this parser.
- **CSS Modules**: Every component uses `*.module.css` for scoped styling.
- **Icons**: Phosphor Icons (`@phosphor-icons/react`). Import individual icons, not the full set.
- **Dealer URLs**: Encrypted permanent links in product-catalog.csv. Each SKU maps to a unique URL on the Leader Systems partner site.

## Adding Products

**Appliances**: Add rows to `product-catalog.csv` + specs to `src/data/featureSpecs.shared.cjs` + image mapping in `server/seed.js` (`IMAGE_MAP` and `DESCRIPTIONS`).

**Everything else** (Virtual, Cloud, Endpoint, etc.): Add rows to `product-catalog.csv` with correct Product Family and Product Group. Re-seed and export.

## Gotchas

- `server/products.db` is auto-generated — never edit it directly.
- `public/static-data/` JSON files are auto-generated — never edit directly. Always regenerate via `npm run export-data`.
- The `dist/` directory is gitignored. Don't try to commit build artifacts.
- Backend files use CommonJS (`require`/`module.exports`). Frontend files use ESM (`import`/`export`). `featureSpecs.shared.cjs` is CJS because it's shared by both.
- When creating git worktrees, use `.worktrees/` directory (already in `.gitignore`).

## AI Chatbot (LionBot)

`server/chat.js` — an agentic AI product assistant using OpenRouter API (OpenAI-compatible format). Has tool-calling against the SQLite database and can perform actions on the frontend (cart management, page navigation). Responses stream via SSE.

### Backend (`server/chat.js`)
- **API**: OpenRouter at `https://openrouter.ai/api/v1/chat/completions`. `OPENROUTER_API_KEY` env var required (set in `.env`, gitignored).
- **Model**: Defaults to `google/gemini-2.5-flash`. Override with `CHAT_MODEL` env var. Must support OpenAI-format tool calling.
- **System prompt**: Built from `server/data/watchguard-knowledge.md` + auto-generated catalog summary from the database. Includes cross-sell/upsell instructions and action-oriented behavior rules.
- **Tool declarations** (OpenAI function format): `search_products`, `get_product_details`, `get_category_products`, `compare_products`, `add_to_cart`, `remove_from_cart`, `show_cart`, `navigate_to`.
- **Tool loop**: Non-streaming for tool-calling iterations (fast round-trips), streaming for the final text response (token-by-token). Cart/navigation actions are buffered and emitted after text completes so they appear simultaneously.
- **SSE event types**: `text_delta` (streamed text), `cart_action` (add/remove/show), `navigate` (route change), `error` (user-facing error message), `message_stop` (end of response).
- `tool_choice: 'auto'` is required — without it, some models (e.g. Gemini Flash via OpenRouter) won't call tools.

### Frontend (`src/components/ChatBubble/`)
- **ChatBubble.jsx**: Floating orb button (bottom-right). Only renders when `/api/health` returns `chat: true`. Passes `onOpenCart` callback from App.jsx.
- **ChatPanel.jsx**: Chat UI with SSE streaming, markdown rendering, and action handling. Uses `useQuote()` for cart operations and `useNavigate()` for page routing.
- **Cart integration**: `addItem()` for adds, `removeItemBySku(sku)` for removes (handles `NWG-` prefix matching). `show_cart` opens the QuoteCartPanel.
- **Navigation**: `navigate_to` tool changes the app route. Markdown links like `[View MDR](/mdr-ndr)` render as clickable links via `window.__chatNavigate`.
- **Conversation history**: Stored in `sessionStorage`. Reset button (↺) clears history and starts fresh.
- **Suggested questions**: 4 starter chips shown on welcome screen, disappear after first message.
- The chatbot is backend-only — on GitHub Pages (no Express), the bubble won't appear.

### SKU Format Gotcha
The database has two SKU fields: `sku_code` (e.g. `WGMDR30101`) and `full_sku` (e.g. `NWG-WGMDR30101`). The cart stores `full_sku`. The `removeItemBySku` reducer handles flexible matching between both formats. The `addToCart` function in chat.js always returns `full_sku`. The `removeFromCart` function resolves the SKU against the database before sending to the frontend.
