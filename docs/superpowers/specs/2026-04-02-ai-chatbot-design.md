# AI Chatbot for WatchGuard Product Configurator

**Date:** 2026-04-02
**Branch:** feature/ai-chatbot
**Status:** Design approved

## Overview

Add a customer-facing AI chatbot to the WatchGuard product configurator that serves as a product advisor, catalog assistant, and WatchGuard knowledge base. Appears as an animated floating bubble in the bottom-right corner, powered by Claude (Haiku), with product data access through tool calling against the existing SQLite database.

## Requirements

- **Audience**: Reseller/partner customers browsing the configurator
- **Capabilities**: Product recommendations, SKU/price lookups, feature comparisons, WatchGuard knowledge Q&A
- **UI**: Floating animated orb (Siri-style sphere, orange-red WatchGuard fire colors) that expands into a chat panel
- **Backend**: Proxied through Express — API key never exposed to client
- **GitHub Pages**: Chatbot hidden automatically (no backend = no bubble)
- **Cart integration**: Not in v1 (future agent upgrade path)
- **LLM**: Claude Haiku via Anthropic SDK, swappable via isolated module

## Architecture

```
┌─────────────────────────────────────────────┐
│  Frontend (React)                           │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │  ChatBubble   │  │  Existing App      │  │
│  │  (animated    │──│  (ProductCatalog,   │  │
│  │   orb + panel)│  │   QuoteCart, etc.)  │  │
│  └───────┬───────┘  └────────────────────┘  │
│          │ POST /api/chat (SSE stream)      │
└──────────┼──────────────────────────────────┘
           │
┌──────────▼──────────────────────────────────┐
│  Express Backend                            │
│  ┌───────────────┐  ┌────────────────────┐  │
│  │  server/      │  │  server/index.js   │  │
│  │  chat.js      │──│  (existing routes) │  │
│  │               │  └────────────────────┘  │
│  │  - System     │  ┌────────────────────┐  │
│  │    prompt      │──│  server/db.js      │  │
│  │  - Tool exec  │  │  (SQLite queries)  │  │
│  │  - Anthropic  │  └────────────────────┘  │
│  │    SDK call   │                          │
│  └───────┬───────┘                          │
│          │                                  │
│  ┌───────▼───────┐  ┌────────────────────┐  │
│  │  Anthropic    │  │  watchguard-       │  │
│  │  API (Haiku)  │  │  knowledge.md      │  │
│  │               │  │  + catalog summary  │  │
│  └───────────────┘  └────────────────────┘  │
└─────────────────────────────────────────────┘
```

## Backend Design

### New file: `server/chat.js`

Exports an Express route handler for `POST /api/chat` that streams responses via SSE.

**Initialization (at server start):**
1. Load `server/data/watchguard-knowledge.md` into memory
2. Query SQLite to generate a condensed catalog summary (~300-500 tokens) listing all product families, groups, and model names
3. Compose the system prompt from knowledge doc + catalog summary

**System prompt structure:**
```
You are a WatchGuard product assistant for Leader Systems, an authorized distributor. You help customers find the right WatchGuard security products.

[Contents of watchguard-knowledge.md]

[Auto-generated catalog summary]

Guidelines:
- Be helpful, concise, and accurate
- Use the provided tools to look up specific product details and prices
- If you don't know something, say so rather than guessing
- Prices are in AUD RRP
- When recommending products, explain why they fit the customer's needs
- Do not make up SKUs or prices — always use tool results
```

**Tool definitions (Claude function calling):**

| Tool | Parameters | Description |
|------|-----------|-------------|
| `search_products` | `query: string` | Fuzzy search across product names and SKU codes. Returns matching products with name, SKU, price, category. |
| `get_product_details` | `slug: string` | Full product info: specs, features, subscriptions, prices. Uses existing `/api/products/:slug` query logic. |
| `get_category_products` | `category: string` | All product groups and SKUs in a category. Uses existing `/api/categories/:category` query logic. |
| `compare_products` | `slugs: string[]` | Side-by-side comparison of 2+ products: features, specs, pricing for all subscription tiers. |

Tools execute queries against the existing SQLite database using functions from `server/db.js`. No new data layer.

**Request/response flow:**
1. Frontend sends `POST /api/chat` with `{ messages: [{ role, content }, ...] }`
2. Server prepends system prompt (knowledge + catalog summary)
3. Calls Anthropic API with streaming enabled + tool definitions
4. If Claude calls a tool → execute against SQLite, feed result back to Claude
5. Stream final text response to frontend via SSE (`text/event-stream`)
6. Each SSE event: `data: {"type":"text_delta","text":"..."}` or `data: {"type":"message_stop"}`

**Error handling:**
- Missing `ANTHROPIC_API_KEY` → endpoint returns 503 with `{ error: "Chat unavailable" }`
- Anthropic API errors → stream an error message to the client
- Tool execution errors → return error to Claude so it can respond gracefully

### New endpoint: `GET /api/health`

Returns `{ status: "ok", chat: true|false }` — frontend uses this to decide whether to show the bubble. `chat` is `true` only if `ANTHROPIC_API_KEY` is configured.

### server/index.js changes

- Import and mount chat handler: `app.post('/api/chat', chatHandler)`
- Add health endpoint: `app.get('/api/health', ...)`
- At startup: load knowledge doc, generate catalog summary, pass to chat module

### New dependency

- `@anthropic-ai/sdk` — Anthropic's official Node.js SDK

### Environment

- `ANTHROPIC_API_KEY` — required env var for chat functionality
- `CHAT_MODEL` — optional, defaults to `claude-haiku-4-5-20251001`, configurable for easy upgrades

## Frontend Design

### New component: `src/components/ChatBubble/`

Three files:
- `ChatBubble.jsx` — main component, open/closed state, feature detection
- `ChatPanel.jsx` — the expanded chat UI
- `ChatBubble.module.css` — all styling including animated orb

### The Orb (closed state)

- Fixed position: `bottom: 24px; right: 24px`
- ~56px diameter animated sphere
- Layered radial gradients: orange-red palette (#FF4500 → #FF6B35 → #E94560)
- CSS animations:
  - Slow pulsing glow (box-shadow breathe effect)
  - Subtle color-shift gradient rotation (feels alive, like Siri's orb)
  - Hover: intensified glow + slight scale-up (1.1x)
- First-visit tooltip: "Ask me anything about WatchGuard" (dismisses on click or after 5 seconds, stored in localStorage)
- Click opens the chat panel

### The Panel (open state)

- Slides up from orb position with smooth CSS transition (transform + opacity)
- Dimensions: ~380px wide × ~520px tall
- Rounded corners, dark theme matching the app's existing aesthetic
- **Header**: "WatchGuard Assistant" label + minimize button (back to orb)
- **Message area**: Scrollable container
  - Bot messages: left-aligned, dark background (#252540), supports basic markdown rendering via a lightweight parser (bold, italic, bullet lists, numbered lists, inline code). No full markdown library — a small utility function handles the common cases to keep bundle size minimal.
  - User messages: right-aligned, orange-red background (#E94560)
  - Auto-scrolls to newest message
- **Streaming indicator**: Animated pulsing dots while Claude is responding
- **Input area**: Text input with placeholder "Ask about WatchGuard products..." + send button (Phosphor PaperPlaneRight icon). Disabled during streaming. Enter key to send.
- **Welcome message**: Pre-loaded bot message on first open — "Hi! I can help you find the right WatchGuard product, look up pricing, compare models, or answer technical questions. What are you looking for?"

### Visibility logic

1. On mount, fetch `GET /api/health`
2. If response has `chat: true` → render the orb
3. If fetch fails or `chat: false` → render nothing
4. Rechecks on window focus (handles server restart)

### Conversation state

- Managed via `useState` — array of `{ role: 'user'|'assistant', content: string }`
- Full history sent with each `/api/chat` request (Claude needs context)
- Persisted in `sessionStorage` so it survives page navigation but clears on tab close
- No cross-session persistence (each visit starts fresh)

### App.jsx integration

```jsx
// After <Outlet /> and QuoteCartPanel, outside routes
<ChatBubble />
```

Renders at the app root level so it persists across all tab navigations.

## WatchGuard Knowledge Document

### New file: `server/data/watchguard-knowledge.md`

Curated markdown document (~1,500-2,000 words) included in the system prompt. Editable without code changes.

**Sections:**
1. **Product Line Overview** — what each family is and who it's for (T-Series = SMB, M-Series = midrange/enterprise, FireboxV = virtual, AuthPoint = identity, EPDR = endpoint, etc.)
2. **Sizing Guidelines** — user-count-to-model mapping (T25: 1-15 users, T45: 15-30, T85: 30-60, M290: 50-150, M390: 150-300, etc.)
3. **Subscription Tiers** — Basic Security Suite vs Total Security Suite contents, individual service descriptions (APT Blocker, DNSWatch, IntelligentAV, ThreatSync, etc.)
4. **Common Recommendations** — typical bundles for small office, mid-size business, multi-site, remote workforce scenarios
5. **Term Guidance** — 1-year vs 3-year vs 5-year trade-offs, why 3-year is the sweet spot
6. **Renewal vs Trade-Up** — when each makes sense, what happens when subscriptions lapse
7. **Competitor Positioning** — brief factual comparisons vs Fortinet, SonicWall, Meraki

**Token budget:** ~2,000 words ≈ ~2,500 tokens. Combined with catalog summary (~400 tokens), total system prompt is ~3,000 tokens per request.

## Auto-Generated Catalog Summary

Generated at server startup by querying SQLite. Not a static file.

**Format:**
```
PRODUCT CATALOG SUMMARY (Leader Systems):
- Security Appliances: Firebox T25, T25-W, T45, T45-W, T85, M290, M390, M490, M590, M690
- Virtual Firewalls: FireboxV Small, Medium, Large, XLarge
- Cloud Firewalls: FireboxCloud Small, Medium, Large, XLarge
- Endpoint Security: WatchGuard EPDR, EDR, EPP, ADR (per-user tiers: 1-50, 51-100, 101-250, 251-500, 501-1000, 1001-5000)
- Identity Security: AuthPoint MFA, AuthPoint Total Identity Security (per-user tiers: ...)
- Email Security: Email Security (per-user tiers: ...)
- MDR/NDR: WatchGuard MDR, ThreatSync+ NDR (per-user tiers: ...)
- Appliance Renewals: [lists models with available renewals]

Total: 75 product groups, 1,262 SKUs across 8 categories.
Use the provided tools to look up specific product details, prices, and features.
```

Regenerated on each server start to stay in sync with the database.

## Deployment

### Local development
- `npm run dev` starts both Vite + Express as before
- Set `ANTHROPIC_API_KEY` in `.env` or shell environment
- Chatbot works immediately

### GitHub Pages
- No changes to build/deploy process
- `/api/health` fetch fails → bubble doesn't render → zero impact

### Railway / Production
- Set `ANTHROPIC_API_KEY` environment variable in Railway dashboard
- Optionally set `CHAT_MODEL` to upgrade from Haiku
- Chat endpoint available automatically

## Cost Estimate

- **Haiku input**: ~$0.80/M tokens → system prompt (~3K tokens) = ~$0.0024/request
- **Haiku output**: ~$4/M tokens → average response (~200 tokens) = ~$0.0008/request
- **Per conversation** (avg 5 exchanges): ~$0.015
- **100 conversations/day**: ~$1.50/day, ~$45/month

Upgradeable to Sonnet (~10x cost) or Opus via `CHAT_MODEL` env var.

## Future Enhancements (Out of Scope for v1)

- **Cart integration**: Let chatbot add items to quote via QuoteContext actions (agent upgrade)
- **Rate limiting**: Per-IP throttling on `/api/chat`
- **Conversation analytics**: Log common questions to improve knowledge doc
- **Multi-language support**: System prompt variants
- **Suggested questions**: Quick-action buttons in the chat panel ("Compare firewalls", "Help me size a firewall")
