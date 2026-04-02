# AI Chatbot Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a customer-facing AI chatbot to the WatchGuard product configurator — an animated floating orb that expands into a chat panel, powered by Claude Haiku with tool-calling access to the product database.

**Architecture:** New `server/chat.js` module handles Anthropic API calls with SSE streaming and tool execution against existing SQLite. New `ChatBubble` + `ChatPanel` React components provide the UI. A curated knowledge document and auto-generated catalog summary form the system prompt.

**Tech Stack:** Anthropic SDK (`@anthropic-ai/sdk`), Express SSE streaming, React, CSS Modules with keyframe animations, Phosphor Icons.

**Spec:** `docs/superpowers/specs/2026-04-02-ai-chatbot-design.md`

---

## File Structure

| Action | File | Responsibility |
|--------|------|---------------|
| Create | `server/chat.js` | Chat endpoint: system prompt assembly, Anthropic API streaming, tool execution loop |
| Create | `server/data/watchguard-knowledge.md` | Curated WatchGuard product knowledge for system prompt |
| Modify | `server/index.js` | Mount `/api/chat` and `/api/health` routes, pass `db` to chat module |
| Modify | `package.json` | Add `@anthropic-ai/sdk` dependency |
| Create | `src/components/ChatBubble/ChatBubble.jsx` | Floating orb + open/close state + health-check visibility |
| Create | `src/components/ChatBubble/ChatPanel.jsx` | Chat UI: message list, input, streaming, markdown rendering |
| Create | `src/components/ChatBubble/ChatBubble.module.css` | All chat styling: animated orb, panel, messages, transitions |
| Modify | `src/App.jsx` | Render `<ChatBubble />` at app root |

---

### Task 1: Install Anthropic SDK

**Files:**
- Modify: `package.json`

- [ ] **Step 1: Install the dependency**

Run from the worktree root:

```bash
cd .worktrees/feature-ai-chatbot && npm install @anthropic-ai/sdk
```

Expected: `package.json` gains `"@anthropic-ai/sdk"` in dependencies, `package-lock.json` updated.

- [ ] **Step 2: Verify installation**

```bash
cd .worktrees/feature-ai-chatbot && node -e "const Anthropic = require('@anthropic-ai/sdk'); console.log('SDK loaded:', typeof Anthropic)"
```

Expected: `SDK loaded: function`

- [ ] **Step 3: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add package.json package-lock.json
git commit -m "chore: add @anthropic-ai/sdk dependency"
```

---

### Task 2: Create WatchGuard Knowledge Document

**Files:**
- Create: `server/data/watchguard-knowledge.md`

- [ ] **Step 1: Write the knowledge document**

Create `server/data/watchguard-knowledge.md` with the following content. This is the curated knowledge that gets injected into the chatbot's system prompt. Keep it factual and concise (~1,500–2,000 words).

```markdown
# WatchGuard Product Knowledge

## Product Line Overview

### Security Appliances (Firebox)
- **T-Series (Tabletop)**: Compact desktop firewalls for small and mid-size businesses. Models: T25, T25-W, T45, T45-W, T85, T85-W (W = built-in Wi-Fi).
- **M-Series (Rackmount)**: High-performance 1U rackmount firewalls for mid-size to large enterprises. Models: M290, M390, M490, M590, M690.
- All Firebox appliances run Fireware OS and support the WatchGuard Unified Security Platform.

### Virtual & Cloud Firewalls
- **FireboxV**: Virtual appliances for VMware, Hyper-V, and KVM. Sizes: Small, Medium, Large, XLarge. Same Fireware OS and feature set as hardware.
- **Firebox Cloud**: Purpose-built for AWS and Azure. Same Fireware management. Sizes: Small, Medium, Large, XLarge.

### Endpoint Security
- **WatchGuard EPDR** (Endpoint Protection, Detection & Response): Full endpoint suite — antivirus, EDR, patch management, encryption, vulnerability assessment. The flagship endpoint product.
- **WatchGuard EDR** (Endpoint Detection & Response): EDR-only, pairs with existing third-party antivirus.
- **WatchGuard EPP** (Endpoint Protection Platform): Antivirus and protection without EDR. Entry-level.
- **WatchGuard ADR** (Advanced Detection & Response): Advanced threat hunting and response for SOC teams.

### Identity & Access
- **AuthPoint MFA**: Cloud-based multi-factor authentication. Mobile push, QR code, OTP. No hardware tokens required.
- **AuthPoint Total Identity Security**: MFA + single sign-on (SSO) + dark web credential monitoring + corporate password management.

### Email Security
- **WatchGuard Email Security**: Cloud-based email protection — anti-spam, anti-phishing, DLP, email encryption, archiving.

### Managed Detection & Response
- **WatchGuard MDR**: 24/7 threat monitoring and response service by WatchGuard's SOC team. For partners who want to offer MDR without building a SOC.
- **ThreatSync+ NDR**: Network Detection and Response — AI-powered network traffic analysis for threat detection.

## Sizing Guidelines

### Firebox Appliances by User Count
| Model | Recommended Users | Throughput (Firewall) | Use Case |
|-------|------------------|-----------------------|----------|
| T25 / T25-W | 1–15 | 3.92 Gbps | Home office, micro-business |
| T45 / T45-W | 15–30 | 3.92 Gbps | Small office, retail |
| T85 / T85-W | 30–60 | 3.92 Gbps | Mid-size office, branch |
| M290 | 50–150 | 5.8 Gbps | Mid-size business HQ |
| M390 | 150–300 | 18 Gbps | Large office, campus |
| M490 | 300–500 | 28 Gbps | Enterprise, data center edge |
| M590 | 500–1,000 | 40 Gbps | Large enterprise |
| M690 | 1,000–2,500 | 55 Gbps | Large enterprise, service provider |

These are rough guidelines. Actual sizing depends on enabled security services, traffic patterns, and VPN usage. When UTM services are fully enabled, throughput is lower than raw firewall throughput.

### Per-User Products
Endpoint, Identity, Email, MDR, and NDR products are licensed per user with tier-based pricing:
- 1–50 users, 51–100, 101–250, 251–500, 501–1000, 1001–5000
- Lower per-user cost at higher tiers
- Available in 1-year and 3-year terms

## Subscription Tiers (Security Appliances)

### Basic Security Suite (BSS)
Includes: Intrusion Prevention (IPS), Gateway AntiVirus, URL Filtering (WebBlocker), Application Control, Reputation Enabled Defense, Network Discovery, SpamBlocker. Standard support included.

### Total Security Suite (TSS)
Everything in BSS plus: APT Blocker (sandboxing), DNSWatch (DNS-level protection), IntelligentAV (AI-powered malware detection), ThreatSync (XDR correlation), EDR Core, WatchGuard Cloud visibility. Gold support included.

**Recommendation**: Total Security Suite is the best value for most customers. It adds critical advanced threat protection that Basic lacks.

## Term Length Guidance

- **1-Year**: Highest per-year cost. Good for trials or uncertain deployments.
- **3-Year**: Best price-per-year for most customers. Recommended default. Typically 15–20% savings vs buying 1-year three times.
- **5-Year**: Available for some products. Lowest per-year cost but requires longer commitment.

**Default recommendation**: 3-year term for the best balance of savings and flexibility.

## Renewal vs Trade-Up

- **Renewal**: Extends subscriptions on the same hardware. Choose this when the current appliance still meets performance needs.
- **Trade-Up**: Upgrades to newer hardware at a discount (trade in old appliance). Choose this when the appliance is aging (3+ years), performance is insufficient, or the customer needs features only in newer models.
- **Lapsed subscriptions**: If security subscriptions expire, the appliance continues to route traffic but security services stop. Re-activation requires purchasing a new subscription.

## Common Recommendations

### Small Office (5–20 users)
Firebox T25 or T45 with Total Security Suite (3-Year). Add AuthPoint MFA for secure remote access.

### Mid-Size Business (50–200 users)
Firebox M290 or M390 with Total Security Suite (3-Year). Add WatchGuard EPDR for endpoint protection and AuthPoint Total Identity Security.

### Multi-Site / Branch Office
Hub: M-Series at HQ. Branches: T-Series at each site. All managed through WatchGuard Cloud with BOVPN (Branch Office VPN) between sites.

### Remote Workforce
AuthPoint MFA + EPDR on all endpoints. Firebox with Mobile VPN configured. Consider AuthPoint Total Identity Security for SSO and password management.

## Competitor Positioning

- **vs Fortinet**: WatchGuard is easier to deploy and manage, with a unified security platform. Fortinet requires more expertise but offers higher raw throughput at similar price points.
- **vs SonicWall**: Similar market positioning. WatchGuard has stronger cloud management and a more modern interface. SonicWall has a larger installed base in SMB.
- **vs Cisco Meraki**: Meraki is cloud-only management with simpler setup but less granular control. WatchGuard offers both cloud and on-premise management with deeper security features.

## Key Selling Points
- **Unified Security Platform**: Single pane of glass for network, endpoint, identity, and Wi-Fi security
- **WatchGuard Cloud**: Centralized management, reporting, and visibility across all products
- **ThreatSync (XDR)**: Cross-product threat correlation — network events + endpoint events analyzed together
- **Partner-Friendly**: 100% channel model, strong partner programs, competitive margins
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add server/data/watchguard-knowledge.md
git commit -m "docs: add WatchGuard knowledge base for chatbot system prompt"
```

---

### Task 3: Create Chat Backend (`server/chat.js`)

**Files:**
- Create: `server/chat.js`

This is the core backend module. It exports an `initChat(db)` function that returns the Express route handler. It handles: system prompt assembly, catalog summary generation, Anthropic API streaming with tool use, and tool execution against SQLite.

- [ ] **Step 1: Create `server/chat.js`**

```javascript
// AI Chat endpoint — streams Claude responses via SSE with tool-calling
// against the product database.
const Anthropic = require('@anthropic-ai/sdk');
const fs = require('fs');
const path = require('path');

const MODEL = process.env.CHAT_MODEL || 'claude-haiku-4-5-20251001';
const MAX_TOKENS = 1024;

// ── Tool definitions for Claude ──────────────────────────────
const TOOLS = [
  {
    name: 'search_products',
    description: 'Search for WatchGuard products by name, SKU code, or keyword. Returns matching products with name, SKU, price, and category.',
    input_schema: {
      type: 'object',
      properties: {
        query: { type: 'string', description: 'Search term — product name, SKU code, or keyword (e.g. "T45", "fireboxv", "endpoint")' },
      },
      required: ['query'],
    },
  },
  {
    name: 'get_product_details',
    description: 'Get full details for a specific product by its slug — includes specs, features, all subscription options with prices, and trade-up options.',
    input_schema: {
      type: 'object',
      properties: {
        slug: { type: 'string', description: 'Product slug (e.g. "firebox-t45", "firebox-m290", "fireboxv-small")' },
      },
      required: ['slug'],
    },
  },
  {
    name: 'get_category_products',
    description: 'List all products in a category with their SKUs and prices. Categories: tabletop, mseries, wifi, virtual, cloud, mdr_ndr, endpoint, identity, email, renewals.',
    input_schema: {
      type: 'object',
      properties: {
        category: { type: 'string', description: 'Category slug — one of: tabletop, mseries, wifi, virtual, cloud, mdr_ndr, endpoint, identity, email, renewals' },
      },
      required: ['category'],
    },
  },
  {
    name: 'compare_products',
    description: 'Compare two or more products side by side — shows features, specs, and pricing for all subscription tiers.',
    input_schema: {
      type: 'object',
      properties: {
        slugs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Array of product slugs to compare (e.g. ["firebox-t45", "firebox-t85"])',
        },
      },
      required: ['slugs'],
    },
  },
];

// ── Tool execution ───────────────────────────────────────────
function executeTool(db, name, input) {
  switch (name) {
    case 'search_products':
      return searchProducts(db, input.query);
    case 'get_product_details':
      return getProductDetails(db, input.slug);
    case 'get_category_products':
      return getCategoryProducts(db, input.category);
    case 'compare_products':
      return compareProducts(db, input.slugs);
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function searchProducts(db, query) {
  const pattern = `%${query}%`;
  const rows = db.prepare(`
    SELECT s.sku_code, s.full_sku, s.name, s.msrp, s.sku_type,
           s.subscription_type, s.term_years,
           pg.name AS product_group, pg.slug, pg.category
    FROM skus s
    JOIN product_groups pg ON s.product_group_id = pg.id
    WHERE s.name LIKE ? OR s.sku_code LIKE ? OR s.full_sku LIKE ? OR pg.name LIKE ?
    ORDER BY pg.name, s.sku_type, s.name
    LIMIT 30
  `).all(pattern, pattern, pattern, pattern);
  return { results: rows, count: rows.length };
}

function getProductDetails(db, slug) {
  const group = db.prepare(`
    SELECT id, slug, name, family, category, description, image_file
    FROM product_groups WHERE slug = ?
  `).get(slug);
  if (!group) return { error: `Product not found: ${slug}` };

  const skus = db.prepare(`
    SELECT sku_code, full_sku, name, msrp, sku_type, subscription_type, term_years
    FROM skus WHERE product_group_id = ?
    ORDER BY sku_type, subscription_type, term_years
  `).all(group.id);

  const features = db.prepare(`
    SELECT feature_category, feature_name, feature_value
    FROM product_features WHERE product_group_id = ?
    ORDER BY sort_order
  `).all(group.id);

  return { ...group, skus, features };
}

function getCategoryProducts(db, category) {
  const groups = db.prepare(`
    SELECT id, slug, name, family, category, description
    FROM product_groups WHERE category = ? ORDER BY name
  `).all(category);
  if (!groups.length) return { error: `Category not found: ${category}` };

  return groups.map(g => {
    const skus = db.prepare(`
      SELECT sku_code, full_sku, name, msrp, sku_type, subscription_type, term_years
      FROM skus WHERE product_group_id = ? ORDER BY sku_type, name
    `).all(g.id);
    return { ...g, skus };
  });
}

function compareProducts(db, slugs) {
  return slugs.map(slug => getProductDetails(db, slug));
}

// ── Catalog summary generator ────────────────────────────────
function generateCatalogSummary(db) {
  const groups = db.prepare(`
    SELECT pg.name, pg.category, COUNT(s.id) AS sku_count
    FROM product_groups pg
    LEFT JOIN skus s ON s.product_group_id = pg.id
    GROUP BY pg.id
    ORDER BY pg.category, pg.name
  `).all();

  const byCategory = {};
  for (const g of groups) {
    if (!byCategory[g.category]) byCategory[g.category] = [];
    byCategory[g.category].push(g.name);
  }

  const CATEGORY_LABELS = {
    tabletop: 'Security Appliances (T-Series)',
    mseries: 'Security Appliances (M-Series)',
    wifi: 'Wi-Fi Access Points',
    virtual: 'Virtual Firewalls',
    cloud: 'Cloud Firewalls',
    mdr_ndr: 'MDR & NDR',
    endpoint: 'Endpoint Security',
    identity: 'Identity & Access',
    email: 'Email Security',
    renewals: 'Appliance Renewals',
  };

  let summary = 'PRODUCT CATALOG SUMMARY (Leader Systems — Australian Distributor):\n';
  for (const [cat, products] of Object.entries(byCategory)) {
    const label = CATEGORY_LABELS[cat] || cat;
    summary += `- ${label}: ${products.join(', ')}\n`;
  }

  const totalGroups = groups.length;
  const totalSkus = db.prepare('SELECT COUNT(*) AS c FROM skus').get().c;
  summary += `\nTotal: ${totalGroups} product groups, ${totalSkus} SKUs across ${Object.keys(byCategory).length} categories.\n`;
  summary += 'Use the provided tools to look up specific product details, pricing, and features.\n';

  return summary;
}

// ── System prompt assembly ───────────────────────────────────
function buildSystemPrompt(knowledgeDoc, catalogSummary) {
  return `You are a WatchGuard product assistant for Leader Systems, an authorized Australian distributor. You help customers find the right WatchGuard security products.

Be helpful, concise, and accurate. Use a friendly, professional tone.

${knowledgeDoc}

${catalogSummary}

Guidelines:
- Use the provided tools to look up specific product details and prices — do not guess or make up SKUs or prices.
- Prices are in AUD RRP (Recommended Retail Price).
- When recommending products, explain why they fit the customer's needs.
- If you don't know something, say so rather than guessing.
- Keep responses concise but informative. Use bullet points and formatting for readability.
- When comparing products, focus on the differences that matter for the customer's use case.`;
}

// ── Main init function ───────────────────────────────────────
function initChat(db) {
  const apiKey = process.env.ANTHROPIC_API_KEY;

  // Load knowledge document
  let knowledgeDoc = '';
  const knowledgePath = path.join(__dirname, 'data', 'watchguard-knowledge.md');
  try {
    knowledgeDoc = fs.readFileSync(knowledgePath, 'utf-8');
  } catch (err) {
    console.warn('Warning: watchguard-knowledge.md not found, chatbot will have limited knowledge');
  }

  // Generate catalog summary from DB
  const catalogSummary = generateCatalogSummary(db);
  const systemPrompt = buildSystemPrompt(knowledgeDoc, catalogSummary);

  console.log(`Chat initialized — model: ${MODEL}, knowledge: ${knowledgeDoc ? 'loaded' : 'missing'}, catalog: ${catalogSummary.split('\n').length} lines`);

  // Health check info
  function isChatAvailable() {
    return !!apiKey;
  }

  // POST /api/chat — SSE streaming response
  async function handleChat(req, res) {
    if (!apiKey) {
      return res.status(503).json({ error: 'Chat unavailable — API key not configured' });
    }

    const { messages } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const client = new Anthropic({ apiKey });

    try {
      // Conversation loop — handles tool use iterations
      let currentMessages = messages.map(m => ({ role: m.role, content: m.content }));

      while (true) {
        // Collect the full response (need to check for tool_use)
        const response = await client.messages.create({
          model: MODEL,
          max_tokens: MAX_TOKENS,
          system: systemPrompt,
          tools: TOOLS,
          messages: currentMessages,
        });

        // Check if Claude wants to use tools
        const toolUseBlocks = response.content.filter(b => b.type === 'tool_use');
        const textBlocks = response.content.filter(b => b.type === 'text');

        // Stream any text content to the client
        for (const block of textBlocks) {
          if (block.text) {
            res.write(`data: ${JSON.stringify({ type: 'text_delta', text: block.text })}\n\n`);
          }
        }

        // If no tool calls, we're done
        if (toolUseBlocks.length === 0 || response.stop_reason === 'end_turn') {
          if (toolUseBlocks.length === 0) break;
        }

        // Execute tools and continue the conversation
        if (toolUseBlocks.length > 0) {
          // Add assistant response to conversation
          currentMessages.push({ role: 'assistant', content: response.content });

          // Execute each tool and add results
          const toolResults = toolUseBlocks.map(toolBlock => {
            const result = executeTool(db, toolBlock.name, toolBlock.input);
            return {
              type: 'tool_result',
              tool_use_id: toolBlock.id,
              content: JSON.stringify(result),
            };
          });

          currentMessages.push({ role: 'user', content: toolResults });

          // Continue the loop — Claude will process tool results
          continue;
        }

        break;
      }

      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      res.end();
    } catch (err) {
      console.error('Chat error:', err.message);
      res.write(`data: ${JSON.stringify({ type: 'error', error: 'Something went wrong. Please try again.' })}\n\n`);
      res.end();
    }
  }

  return { handleChat, isChatAvailable };
}

module.exports = { initChat };
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add server/chat.js
git commit -m "feat: add chat backend with Claude tool-calling and SSE streaming"
```

---

### Task 4: Mount Chat Routes in Express

**Files:**
- Modify: `server/index.js:1-18` (imports and initialization)
- Modify: `server/index.js:160-173` (before production static serving)

- [ ] **Step 1: Add chat imports and initialization after db init**

In `server/index.js`, after line 17 (`const db = initDb();`), add the chat initialization:

```javascript
// After: const db = initDb();
// Add:
const { initChat } = require('./chat');
const { handleChat, isChatAvailable } = initChat(db);
```

- [ ] **Step 2: Add health and chat endpoints**

In `server/index.js`, after the `/api/products/:slug/subscriptions` route (after line 161) and before the production static serving block, add:

```javascript
// ── GET /api/health ──────────────────────────────────────────
app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', chat: isChatAvailable() });
});

// ── POST /api/chat ───────────────────────────────────────────
app.post('/api/chat', handleChat);
```

- [ ] **Step 3: Verify the server starts**

```bash
cd .worktrees/feature-ai-chatbot && node -e "
  const { seedIfNeeded } = require('./server/seed');
  seedIfNeeded();
  console.log('Seed OK');
  const { initDb } = require('./server/db');
  const db = initDb();
  console.log('DB OK');
  const { initChat } = require('./server/chat');
  const { handleChat, isChatAvailable } = initChat(db);
  console.log('Chat OK, available:', isChatAvailable());
"
```

Expected: `Seed OK`, `DB OK`, `Chat OK, available: false` (no API key set yet).

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add server/index.js
git commit -m "feat: mount /api/health and /api/chat endpoints"
```

---

### Task 5: Create Chat Bubble CSS

**Files:**
- Create: `src/components/ChatBubble/ChatBubble.module.css`

This is the most visually complex piece — the animated Siri-style orb with fire colors.

- [ ] **Step 1: Create the CSS module**

```css
/* ── Floating Orb ─────────────────────────────────────────── */
.bubble {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0;

  /* Fiery orb gradient */
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, #FF6B35 0%, #FF4500 40%, #E94560 80%, #C62828 100%);
  background-size: 100% 100%, 200% 200%;

  /* Glow */
  box-shadow:
    0 0 20px rgba(255, 69, 0, 0.4),
    0 0 40px rgba(255, 69, 0, 0.2),
    0 4px 12px rgba(0, 0, 0, 0.3);

  /* Animations */
  animation: orbPulse 3s ease-in-out infinite, orbShift 8s ease-in-out infinite;
  transition: transform 0.2s ease, box-shadow 0.2s ease;
}

.bubble:hover {
  transform: scale(1.1);
  box-shadow:
    0 0 30px rgba(255, 69, 0, 0.6),
    0 0 60px rgba(255, 69, 0, 0.3),
    0 6px 16px rgba(0, 0, 0, 0.4);
}

.bubble:active {
  transform: scale(0.95);
}

.bubbleIcon {
  color: white;
  filter: drop-shadow(0 1px 2px rgba(0, 0, 0, 0.3));
  position: relative;
  z-index: 1;
}

/* Inner glow overlay — pseudo-element for extra depth */
.bubble::before {
  content: '';
  position: absolute;
  inset: 3px;
  border-radius: 50%;
  background: radial-gradient(circle at 30% 30%, rgba(255, 255, 255, 0.25) 0%, transparent 60%);
  pointer-events: none;
}

/* Subtle ring pulse */
.bubble::after {
  content: '';
  position: absolute;
  inset: -4px;
  border-radius: 50%;
  border: 2px solid rgba(255, 107, 53, 0.3);
  animation: ringPulse 3s ease-in-out infinite;
  pointer-events: none;
}

@keyframes orbPulse {
  0%, 100% {
    box-shadow:
      0 0 20px rgba(255, 69, 0, 0.4),
      0 0 40px rgba(255, 69, 0, 0.2),
      0 4px 12px rgba(0, 0, 0, 0.3);
  }
  50% {
    box-shadow:
      0 0 28px rgba(255, 69, 0, 0.5),
      0 0 56px rgba(255, 69, 0, 0.25),
      0 4px 12px rgba(0, 0, 0, 0.3);
  }
}

@keyframes orbShift {
  0%, 100% { background-position: 0% 0%, 0% 0%; }
  33%      { background-position: 0% 0%, 100% 50%; }
  66%      { background-position: 0% 0%, 50% 100%; }
}

@keyframes ringPulse {
  0%, 100% { opacity: 0.5; transform: scale(1); }
  50%      { opacity: 0; transform: scale(1.3); }
}

/* ── Tooltip ──────────────────────────────────────────────── */
.tooltip {
  position: absolute;
  bottom: 68px;
  right: 0;
  background: #1e1e2e;
  color: #e0e0e0;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 12px;
  white-space: nowrap;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
  animation: tooltipFade 0.3s ease;
  pointer-events: none;
}

.tooltip::after {
  content: '';
  position: absolute;
  bottom: -6px;
  right: 20px;
  width: 12px;
  height: 12px;
  background: #1e1e2e;
  transform: rotate(45deg);
}

@keyframes tooltipFade {
  from { opacity: 0; transform: translateY(4px); }
  to   { opacity: 1; transform: translateY(0); }
}

/* ── Chat Panel ───────────────────────────────────────────── */
.panel {
  position: fixed;
  bottom: 24px;
  right: 24px;
  z-index: 9999;
  width: 380px;
  height: 520px;
  background: #1e1e2e;
  border-radius: 16px;
  box-shadow: 0 8px 32px rgba(0, 0, 0, 0.5);
  display: flex;
  flex-direction: column;
  overflow: hidden;

  /* Slide-up entrance */
  animation: panelIn 0.3s ease;
}

@keyframes panelIn {
  from { opacity: 0; transform: translateY(20px) scale(0.95); }
  to   { opacity: 1; transform: translateY(0) scale(1); }
}

/* ── Panel Header ─────────────────────────────────────────── */
.header {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 14px 16px;
  background: linear-gradient(135deg, #2a1a0e 0%, #1e1e2e 100%);
  border-bottom: 1px solid rgba(255, 107, 53, 0.15);
  flex-shrink: 0;
}

.headerOrb {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background:
    radial-gradient(circle at 35% 35%, rgba(255, 255, 255, 0.2) 0%, transparent 50%),
    radial-gradient(circle at 50% 50%, #FF6B35 0%, #FF4500 60%, #E94560 100%);
  box-shadow: 0 0 8px rgba(255, 69, 0, 0.4);
  flex-shrink: 0;
}

.headerTitle {
  flex: 1;
  font-size: 14px;
  font-weight: 600;
  color: #e0e0e0;
}

.closeBtn {
  background: transparent;
  border: none;
  color: #888;
  cursor: pointer;
  padding: 4px;
  display: flex;
  align-items: center;
  border-radius: 6px;
  transition: background 0.15s, color 0.15s;
}

.closeBtn:hover {
  background: rgba(255, 255, 255, 0.1);
  color: #e0e0e0;
}

/* ── Messages ─────────────────────────────────────────────── */
.messages {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.messages::-webkit-scrollbar {
  width: 4px;
}

.messages::-webkit-scrollbar-thumb {
  background: rgba(255, 255, 255, 0.15);
  border-radius: 2px;
}

.msgBot {
  align-self: flex-start;
  max-width: 85%;
  background: #2a2a3e;
  color: #e0e0e0;
  padding: 10px 14px;
  border-radius: 12px 12px 12px 4px;
  font-size: 13px;
  line-height: 1.5;
}

.msgUser {
  align-self: flex-end;
  max-width: 85%;
  background: linear-gradient(135deg, #FF4500, #E94560);
  color: #fff;
  padding: 10px 14px;
  border-radius: 12px 12px 4px 12px;
  font-size: 13px;
  line-height: 1.5;
}

/* Markdown-ish styling inside bot messages */
.msgBot strong { color: #FF6B35; }
.msgBot ul, .msgBot ol { margin: 4px 0; padding-left: 18px; }
.msgBot li { margin: 2px 0; }
.msgBot code {
  background: rgba(255, 255, 255, 0.08);
  padding: 1px 5px;
  border-radius: 3px;
  font-size: 12px;
}

/* ── Typing Indicator ─────────────────────────────────────── */
.typing {
  align-self: flex-start;
  display: flex;
  gap: 4px;
  padding: 12px 16px;
  background: #2a2a3e;
  border-radius: 12px 12px 12px 4px;
}

.typingDot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FF6B35;
  animation: typingBounce 1.2s ease-in-out infinite;
}

.typingDot:nth-child(2) { animation-delay: 0.15s; }
.typingDot:nth-child(3) { animation-delay: 0.3s; }

@keyframes typingBounce {
  0%, 60%, 100% { transform: translateY(0); opacity: 0.4; }
  30%           { transform: translateY(-6px); opacity: 1; }
}

/* ── Input Area ───────────────────────────────────────────── */
.inputArea {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 12px 16px;
  border-top: 1px solid rgba(255, 255, 255, 0.08);
  background: #1a1a28;
  flex-shrink: 0;
}

.input {
  flex: 1;
  background: #2a2a3e;
  border: 1px solid rgba(255, 255, 255, 0.08);
  border-radius: 8px;
  padding: 8px 12px;
  color: #e0e0e0;
  font-size: 13px;
  outline: none;
  transition: border-color 0.15s;
  font-family: inherit;
}

.input::placeholder {
  color: #666;
}

.input:focus {
  border-color: rgba(255, 107, 53, 0.4);
}

.sendBtn {
  background: linear-gradient(135deg, #FF4500, #E94560);
  border: none;
  color: white;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: opacity 0.15s, transform 0.1s;
  flex-shrink: 0;
}

.sendBtn:hover { opacity: 0.9; }
.sendBtn:active { transform: scale(0.95); }
.sendBtn:disabled {
  opacity: 0.4;
  cursor: not-allowed;
  transform: none;
}

/* ── Responsive ───────────────────────────────────────────── */
@media (max-width: 440px) {
  .panel {
    width: calc(100vw - 16px);
    height: calc(100vh - 80px);
    bottom: 8px;
    right: 8px;
    border-radius: 12px;
  }
}
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add src/components/ChatBubble/ChatBubble.module.css
git commit -m "feat: add chat bubble and panel CSS with animated fire orb"
```

---

### Task 6: Create ChatPanel Component

**Files:**
- Create: `src/components/ChatBubble/ChatPanel.jsx`

- [ ] **Step 1: Create `ChatPanel.jsx`**

```jsx
import React, { useState, useRef, useEffect } from 'react';
import { X, PaperPlaneRight } from '@phosphor-icons/react';
import styles from './ChatBubble.module.css';

const API_BASE = import.meta.env.VITE_API_URL || '/api';

const WELCOME_MESSAGE = {
  role: 'assistant',
  content: "Hi! I can help you find the right WatchGuard product, look up pricing, compare models, or answer technical questions. What are you looking for?",
};

// Lightweight markdown: bold, italic, bullets, numbered lists, inline code
function renderMarkdown(text) {
  const lines = text.split('\n');
  const elements = [];
  let listItems = [];
  let listType = null; // 'ul' or 'ol'
  let key = 0;

  function flushList() {
    if (listItems.length > 0) {
      const Tag = listType === 'ol' ? 'ol' : 'ul';
      elements.push(<Tag key={key++}>{listItems}</Tag>);
      listItems = [];
      listType = null;
    }
  }

  function inlineFormat(str) {
    const parts = [];
    let remaining = str;
    let i = 0;

    // Process inline formatting: **bold**, *italic*, `code`
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*|`(.+?)`)/g;
    let lastIndex = 0;
    let match;

    while ((match = regex.exec(remaining)) !== null) {
      if (match.index > lastIndex) {
        parts.push(remaining.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(<strong key={i++}>{match[2]}</strong>);
      } else if (match[3]) {
        parts.push(<em key={i++}>{match[3]}</em>);
      } else if (match[4]) {
        parts.push(<code key={i++}>{match[4]}</code>);
      }
      lastIndex = regex.lastIndex;
    }

    if (lastIndex < remaining.length) {
      parts.push(remaining.slice(lastIndex));
    }

    return parts.length > 0 ? parts : [str];
  }

  for (const line of lines) {
    const trimmed = line.trim();

    // Bullet list
    if (/^[-*]\s+/.test(trimmed)) {
      if (listType !== 'ul') flushList();
      listType = 'ul';
      listItems.push(<li key={key++}>{inlineFormat(trimmed.replace(/^[-*]\s+/, ''))}</li>);
      continue;
    }

    // Numbered list
    if (/^\d+\.\s+/.test(trimmed)) {
      if (listType !== 'ol') flushList();
      listType = 'ol';
      listItems.push(<li key={key++}>{inlineFormat(trimmed.replace(/^\d+\.\s+/, ''))}</li>);
      continue;
    }

    flushList();

    if (trimmed === '') {
      continue;
    }

    elements.push(<p key={key++} style={{ margin: '4px 0' }}>{inlineFormat(trimmed)}</p>);
  }

  flushList();
  return elements;
}

// Load/save conversation from sessionStorage
const STORAGE_KEY = 'wg-chat-history';

function loadHistory() {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (stored) return JSON.parse(stored);
  } catch { /* ignore */ }
  return [WELCOME_MESSAGE];
}

function saveHistory(messages) {
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(messages));
  } catch { /* ignore */ }
}

export default function ChatPanel({ onClose }) {
  const [messages, setMessages] = useState(loadHistory);
  const [input, setInput] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const messagesEndRef = useRef(null);
  const inputRef = useRef(null);

  // Persist messages to sessionStorage
  useEffect(() => {
    saveHistory(messages);
  }, [messages]);

  // Auto-scroll to bottom
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isStreaming]);

  // Focus input on mount
  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  async function handleSend() {
    const text = input.trim();
    if (!text || isStreaming) return;

    const userMsg = { role: 'user', content: text };
    const updatedMessages = [...messages, userMsg];
    setMessages(updatedMessages);
    setInput('');
    setIsStreaming(true);

    // Prepare API messages (exclude welcome message from context if it's the default)
    const apiMessages = updatedMessages
      .filter(m => m !== WELCOME_MESSAGE)
      .map(m => ({ role: m.role, content: m.content }));

    try {
      const res = await fetch(`${API_BASE}/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: apiMessages }),
      });

      if (!res.ok) {
        throw new Error(`Server error: ${res.status}`);
      }

      // Read SSE stream
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n');
        buffer = lines.pop(); // keep incomplete line in buffer

        for (const line of lines) {
          if (!line.startsWith('data: ')) continue;
          const jsonStr = line.slice(6);
          try {
            const event = JSON.parse(jsonStr);
            if (event.type === 'text_delta') {
              assistantText += event.text;
              setMessages(prev => {
                const last = prev[prev.length - 1];
                if (last && last.role === 'assistant' && last._streaming) {
                  return [...prev.slice(0, -1), { role: 'assistant', content: assistantText, _streaming: true }];
                }
                return [...prev, { role: 'assistant', content: assistantText, _streaming: true }];
              });
            } else if (event.type === 'error') {
              assistantText = event.error;
              setMessages(prev => [...prev, { role: 'assistant', content: assistantText }]);
            }
          } catch { /* skip malformed JSON */ }
        }
      }

      // Finalize the streaming message
      if (assistantText) {
        setMessages(prev => {
          const last = prev[prev.length - 1];
          if (last && last._streaming) {
            return [...prev.slice(0, -1), { role: 'assistant', content: assistantText }];
          }
          return prev;
        });
      }
    } catch (err) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: "Sorry, I couldn't connect to the server. Please try again.",
      }]);
    } finally {
      setIsStreaming(false);
    }
  }

  function handleKeyDown(e) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  }

  return (
    <div className={styles.panel}>
      {/* Header */}
      <div className={styles.header}>
        <div className={styles.headerOrb} />
        <span className={styles.headerTitle}>WatchGuard Assistant</span>
        <button className={styles.closeBtn} onClick={onClose} aria-label="Close chat">
          <X size={18} weight="bold" />
        </button>
      </div>

      {/* Messages */}
      <div className={styles.messages}>
        {messages.map((msg, i) => (
          <div key={i} className={msg.role === 'user' ? styles.msgUser : styles.msgBot}>
            {msg.role === 'assistant' ? renderMarkdown(msg.content) : msg.content}
          </div>
        ))}
        {isStreaming && !messages[messages.length - 1]?._streaming && (
          <div className={styles.typing}>
            <div className={styles.typingDot} />
            <div className={styles.typingDot} />
            <div className={styles.typingDot} />
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className={styles.inputArea}>
        <input
          ref={inputRef}
          className={styles.input}
          type="text"
          placeholder="Ask about WatchGuard products..."
          value={input}
          onChange={e => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          disabled={isStreaming}
        />
        <button
          className={styles.sendBtn}
          onClick={handleSend}
          disabled={isStreaming || !input.trim()}
          aria-label="Send message"
        >
          <PaperPlaneRight size={18} weight="bold" />
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add src/components/ChatBubble/ChatPanel.jsx
git commit -m "feat: add ChatPanel component with SSE streaming and markdown rendering"
```

---

### Task 7: Create ChatBubble Component

**Files:**
- Create: `src/components/ChatBubble/ChatBubble.jsx`

- [ ] **Step 1: Create `ChatBubble.jsx`**

```jsx
import React, { useState, useEffect, useCallback } from 'react';
import { ChatCircleDots } from '@phosphor-icons/react';
import styles from './ChatBubble.module.css';
import ChatPanel from './ChatPanel.jsx';

const API_BASE = import.meta.env.VITE_API_URL || '/api';
const TOOLTIP_KEY = 'wg-chat-tooltip-dismissed';

export default function ChatBubble() {
  const [isOpen, setIsOpen] = useState(false);
  const [chatAvailable, setChatAvailable] = useState(false);
  const [showTooltip, setShowTooltip] = useState(false);

  // Check if chat backend is available
  const checkHealth = useCallback(async () => {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (!res.ok) throw new Error();
      const data = await res.json();
      setChatAvailable(data.chat === true);
    } catch {
      setChatAvailable(false);
    }
  }, []);

  useEffect(() => {
    checkHealth();

    // Recheck on window focus (handles server restart)
    function onFocus() { checkHealth(); }
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [checkHealth]);

  // Show tooltip for first-time visitors
  useEffect(() => {
    if (!chatAvailable || isOpen) return;
    const dismissed = localStorage.getItem(TOOLTIP_KEY);
    if (!dismissed) {
      setShowTooltip(true);
      const timer = setTimeout(() => {
        setShowTooltip(false);
        localStorage.setItem(TOOLTIP_KEY, '1');
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [chatAvailable, isOpen]);

  function handleOpen() {
    setIsOpen(true);
    setShowTooltip(false);
    localStorage.setItem(TOOLTIP_KEY, '1');
  }

  if (!chatAvailable) return null;

  if (isOpen) {
    return <ChatPanel onClose={() => setIsOpen(false)} />;
  }

  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 9999 }}>
      {showTooltip && (
        <div className={styles.tooltip}>Ask me anything about WatchGuard</div>
      )}
      <button className={styles.bubble} onClick={handleOpen} aria-label="Open chat assistant">
        <ChatCircleDots size={26} weight="fill" className={styles.bubbleIcon} />
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add src/components/ChatBubble/ChatBubble.jsx
git commit -m "feat: add ChatBubble orb component with health-check visibility"
```

---

### Task 8: Integrate ChatBubble into App

**Files:**
- Modify: `src/App.jsx:1-15` (imports)
- Modify: `src/App.jsx:64-66` (after QuoteCartPanel)

- [ ] **Step 1: Add import**

In `src/App.jsx`, after line 14 (`import QuoteCartPanel ...`), add:

```javascript
import ChatBubble from './components/ChatBubble/ChatBubble.jsx';
```

- [ ] **Step 2: Render ChatBubble**

In `src/App.jsx`, after the `<QuoteCartPanel>` closing tag (line 65) and before the sticky banner conditional, add:

```jsx
      {/* AI Chat Assistant */}
      <ChatBubble />
```

- [ ] **Step 3: Verify the app builds**

```bash
cd .worktrees/feature-ai-chatbot && npx vite build 2>&1 | tail -5
```

Expected: Build succeeds with no errors.

- [ ] **Step 4: Commit**

```bash
cd .worktrees/feature-ai-chatbot
git add src/App.jsx
git commit -m "feat: render ChatBubble in app root"
```

---

### Task 9: Manual Verification

**Files:** None (testing only)

- [ ] **Step 1: Start the dev server**

```bash
cd .worktrees/feature-ai-chatbot && npm run dev
```

- [ ] **Step 2: Verify health endpoint (no API key)**

Open `http://localhost:3001/api/health` in a browser.

Expected: `{"status":"ok","chat":false}` — and the chat bubble should NOT appear in the app.

- [ ] **Step 3: Set API key and restart**

Stop the server, set the API key, and restart:

```bash
cd .worktrees/feature-ai-chatbot && ANTHROPIC_API_KEY=your-key-here npm run dev
```

- [ ] **Step 4: Verify health endpoint (with API key)**

Open `http://localhost:3001/api/health`.

Expected: `{"status":"ok","chat":true}`

- [ ] **Step 5: Verify the orb appears**

Open `http://localhost:5173` in a browser.

Expected:
- Animated fiery orb in the bottom-right corner with pulsing glow
- "Ask me anything about WatchGuard" tooltip appears for 5 seconds
- Orb scales up on hover

- [ ] **Step 6: Verify the chat panel**

Click the orb.

Expected:
- Panel slides up with smooth animation
- Header shows "WatchGuard Assistant" with mini orb and close button
- Welcome message displays
- Input field is focused

- [ ] **Step 7: Test a conversation**

Type "What firewall do you recommend for a 30 person office?" and press Enter.

Expected:
- User message appears right-aligned in orange-red
- Typing dots animate while waiting
- Response streams in progressively
- Response references specific products (likely T45 or T85) with actual prices from the database
- Markdown formatting renders correctly (bold, bullets)

- [ ] **Step 8: Test product lookup**

Type "How much is the Firebox M290?" and press Enter.

Expected: Response includes specific pricing from the database via tool calling. Prices should match what's shown in the configurator.

- [ ] **Step 9: Verify GitHub Pages behavior**

```bash
cd .worktrees/feature-ai-chatbot && npx vite build && npx vite preview
```

Open the preview URL. Expected: No chat bubble visible (health check fails against static preview).
