// AI Chat endpoint — streams responses via SSE with tool-calling
// against the product database. Uses OpenRouter API (OpenAI-compatible).
const fs = require('fs');
const path = require('path');

const MODEL = process.env.CHAT_MODEL || 'google/gemini-2.5-flash';
const MAX_TOKENS = 1024;
const API_URL = process.env.CHAT_API_URL || 'https://openrouter.ai/api/v1/chat/completions';

// ── Tool declarations (OpenAI function-calling format) ──────
const TOOLS = [
  {
    type: 'function',
    function: {
      name: 'search_products',
      description: 'Search for WatchGuard products by name, SKU code, or keyword. Returns matching products with name, SKU, price, and category.',
      parameters: {
        type: 'object',
        properties: {
          query: { type: 'string', description: 'Search term — product name, SKU code, or keyword (e.g. "T45", "fireboxv", "endpoint")' },
        },
        required: ['query'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_product_details',
      description: 'Get full details for a specific product by its slug — includes specs, features, all subscription options with prices, and trade-up options.',
      parameters: {
        type: 'object',
        properties: {
          slug: { type: 'string', description: 'Product slug (e.g. "firebox-t45", "firebox-m290", "fireboxv-small")' },
        },
        required: ['slug'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'get_category_products',
      description: 'List all products in a category with their SKUs and prices. Categories: tabletop, mseries, wifi, virtual, cloud, mdr_ndr, endpoint, identity, email, renewals.',
      parameters: {
        type: 'object',
        properties: {
          category: { type: 'string', description: 'Category slug — one of: tabletop, mseries, wifi, virtual, cloud, mdr_ndr, endpoint, identity, email, renewals' },
        },
        required: ['category'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'compare_products',
      description: 'Compare two or more products side by side — shows features, specs, and pricing for all subscription tiers.',
      parameters: {
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
  },
  {
    type: 'function',
    function: {
      name: 'add_to_cart',
      description: 'Add a product to the customer\'s quote cart by SKU code. Use this when the customer asks to add items to their quote/cart. The SKU must be an exact match from the database (e.g. "WGMDRT30101", "WGT45643"). You can specify a quantity.',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'The SKU code of the product to add (e.g. "WGMDRT30101")' },
          quantity: { type: 'number', description: 'Number of units to add (defaults to 1)' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'remove_from_cart',
      description: 'Remove a product from the customer\'s quote cart by its SKU code. Use this when the customer wants to remove an item, change their mind, or replace one product with another (remove the old one first, then add the new one).',
      parameters: {
        type: 'object',
        properties: {
          sku: { type: 'string', description: 'The SKU code of the product to remove' },
        },
        required: ['sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'replace_in_cart',
      description: 'Replace a product in the cart with a different product. Use this when the customer wants to swap, upgrade, or change a product already in their cart (e.g. "change Core MDR to Total MDR", "upgrade to the 3-year option"). This atomically removes the old SKU and adds the new one. ALWAYS use this instead of separate remove + add when swapping products.',
      parameters: {
        type: 'object',
        properties: {
          old_sku: { type: 'string', description: 'The SKU code currently in the cart to remove' },
          new_sku: { type: 'string', description: 'The SKU code of the replacement product to add' },
          quantity: { type: 'number', description: 'Number of units of the new product (defaults to same quantity as old item)' },
        },
        required: ['old_sku', 'new_sku'],
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'show_cart',
      description: 'Open and display the customer\'s quote cart. Use this when the customer asks to see their cart, review their quote, or after making changes to the cart.',
      parameters: {
        type: 'object',
        properties: {},
      },
    },
  },
  {
    type: 'function',
    function: {
      name: 'navigate_to',
      description: 'Navigate the user to a specific product tab or page in the app. Use this when discussing a product category or when the user wants to see/learn more about a product. Categories map to routes: tabletop and mseries = "/" (home), virtual = "/virtual", cloud = "/cloud", mdr_ndr = "/mdr-ndr", endpoint = "/endpoint", identity = "/identity", email = "/email", renewals = "/renewals".',
      parameters: {
        type: 'object',
        properties: {
          route: { type: 'string', description: 'The app route to navigate to (e.g. "/mdr-ndr", "/endpoint", "/virtual")' },
          label: { type: 'string', description: 'Human-readable label for what the user will see (e.g. "MDR & NDR", "Endpoint Security")' },
        },
        required: ['route', 'label'],
      },
    },
  },
];

// ── Tool execution ───────────────────────────────────────────
function executeTool(db, name, args) {
  switch (name) {
    case 'search_products':
      return searchProducts(db, args.query);
    case 'get_product_details':
      return getProductDetails(db, args.slug);
    case 'get_category_products':
      return getCategoryProducts(db, args.category);
    case 'compare_products':
      return compareProducts(db, args.slugs);
    case 'add_to_cart':
      return addToCart(db, args.sku, args.quantity || 1);
    case 'remove_from_cart':
      return removeFromCart(db, args.sku);
    case 'replace_in_cart':
      return replaceInCart(db, args.old_sku, args.new_sku, args.quantity);
    case 'show_cart':
      return { action: 'show_cart' };
    case 'navigate_to':
      return { action: 'navigate', route: args.route, label: args.label };
    default:
      return { error: `Unknown tool: ${name}` };
  }
}

function addToCart(db, sku, quantity) {
  const row = db.prepare(`
    SELECT s.sku_code, s.full_sku, s.name, s.msrp, s.sku_type,
           pg.name AS product_group, pg.slug, pg.category
    FROM skus s
    JOIN product_groups pg ON s.product_group_id = pg.id
    WHERE s.sku_code = ? OR s.full_sku = ?
    LIMIT 1
  `).get(sku, sku);

  if (!row) {
    return { error: `SKU not found: ${sku}. Use search_products to find the correct SKU code.` };
  }

  return {
    action: 'add_to_cart',
    item: {
      sku: row.full_sku || row.sku_code,
      name: row.name,
      description: `${row.product_group} — ${row.sku_type}`,
      unitPrice: row.msrp || 0,
      quantity,
    },
  };
}

function removeFromCart(db, sku) {
  // Look up the full SKU to ensure we send the right one to the frontend
  const row = db.prepare(`
    SELECT sku_code, full_sku FROM skus
    WHERE sku_code = ? OR full_sku = ?
    LIMIT 1
  `).get(sku, sku);

  const resolvedSku = row ? (row.full_sku || row.sku_code) : sku;
  return { action: 'remove_from_cart', sku: resolvedSku };
}

function replaceInCart(db, oldSku, newSku, quantity) {
  // Resolve the old SKU
  const oldRow = db.prepare(`
    SELECT sku_code, full_sku FROM skus
    WHERE sku_code = ? OR full_sku = ?
    LIMIT 1
  `).get(oldSku, oldSku);
  const resolvedOldSku = oldRow ? (oldRow.full_sku || oldRow.sku_code) : oldSku;

  // Look up the new product
  const newRow = db.prepare(`
    SELECT s.sku_code, s.full_sku, s.name, s.msrp, s.sku_type,
           pg.name AS product_group, pg.slug, pg.category
    FROM skus s
    JOIN product_groups pg ON s.product_group_id = pg.id
    WHERE s.sku_code = ? OR s.full_sku = ?
    LIMIT 1
  `).get(newSku, newSku);

  if (!newRow) {
    return { error: `New SKU not found: ${newSku}. Use search_products to find the correct SKU code.` };
  }

  return {
    action: 'replace_in_cart',
    old_sku: resolvedOldSku,
    item: {
      sku: newRow.full_sku || newRow.sku_code,
      name: newRow.name,
      description: `${newRow.product_group} — ${newRow.sku_type}`,
      unitPrice: newRow.msrp || 0,
      quantity: quantity || 1,
    },
  };
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

CRITICAL RULES — VIOLATING THESE IS A FAILURE:
1. **ALWAYS USE TOOLS FOR EVERY PRODUCT QUESTION.** You MUST call a tool before answering ANY question about products, pricing, specs, comparisons, or availability. NEVER answer from your own knowledge — your training data is outdated and has incorrect product names (e.g. there is no "T85" — it's the "T185"). The database is the ONLY source of truth.
   - Customer asks about a product → call search_products or get_product_details
   - Customer asks to compare → call compare_products
   - Customer asks about a category → call get_category_products
   - Customer asks to add to cart → call search_products first, then add_to_cart
   - If you respond about products WITHOUT calling a tool first, you WILL give wrong information.
2. **ZERO INTERNAL NARRATION.** The customer must NEVER see your tool-calling process. NEVER output text like:
   - "I apologize, I used an incorrect SKU" / "Let me search again" / "I'm having trouble finding..."
   - "Let me look that up" / "Searching for..." / "I found the correct SKU"
   - "Thank you for your patience" / "I apologize for the confusion"
   - ANY acknowledgment of failed tool calls, retries, or internal difficulties
   If a tool call fails, silently retry with broader search terms. The customer sees ONLY the final successful result — as if you got it right the first time.
3. **ACTION-ORIENTED.** When a customer asks to add something to cart, DO IT — search → find SKU → add. No unnecessary clarifying questions. If they say "add 20 EPDR 1 year", search "EPDR", find the 1-year 1-50 license SKU, and add with quantity 20.
4. **ACT ON CLEAR REQUESTS.** Only ask clarifying questions when genuinely ambiguous (e.g. "add a firewall" with no model specified). If the customer says "add basic security suite for those" after discussing a specific product, DO IT — don't ask which variant.
5. **NO TEXT UNTIL DONE.** Complete ALL tool calls first, then write your response. Only respond once with the finished answer. Never narrate between tool calls.
6. **SEARCH STRATEGY.** Always search with SHORT, BROAD terms first. "MDR" not "WatchGuard Total MDR 3 Year 1-50 licenses". "EPDR" not "EPDR 1 year 1-50 users". If a search returns results, scan them for the right SKU — do not search again with a longer query. Use get_product_details with the product slug if you need to see all available SKUs for a product group.

Be helpful, concise, and accurate. Use a friendly, professional tone.

${knowledgeDoc}

${catalogSummary}

Guidelines:
- **NEVER guess or construct SKU codes.** WatchGuard SKU codes are not predictable (e.g. the Total Security Suite 1-Year for T185 is "WGT1850081", not "WGT18501"). You MUST use search_products or get_product_details to find the exact SKU before calling add_to_cart. If a search returns no results, try broader terms (e.g. search "T185" instead of "T185 Total Security Suite 1 Year").
- Prices are in AUD RRP (Recommended Retail Price).
- When recommending products, explain why they fit the customer's needs.
- If you don't know something, say so rather than guessing.
- Keep responses concise but informative. Use bullet points and formatting for readability.
- When comparing products, focus on the differences that matter for the customer's use case.
- You can add products to the customer's quote cart using the add_to_cart tool. Always use search_products FIRST to find the correct SKU code, then call add_to_cart with that exact SKU. Always confirm what you added (product name, quantity, and unit price).
- When a customer changes their mind or wants to swap/upgrade/replace a product (e.g. upgrade from Core MDR to Total MDR), use the replace_in_cart tool — it atomically removes the old product and adds the new one. Look at the CURRENT CART CONTENTS (provided in this prompt) to find the exact SKU to replace. Carry over the same quantity from the old item (e.g. if they had 10x Core MDR, replace with 10x Total MDR). NEVER use separate remove + add calls for swaps — always use replace_in_cart.
- Use show_cart when the customer asks to see their cart, review their quote, or after making cart changes. This opens the cart panel for the customer to see.
- When a customer asks about available options/subscriptions for a product, use get_product_details with the product slug (e.g. "firebox-t185") — this returns ALL SKUs including subscriptions, bundles, and trade-ups. This is the most reliable way to show available options.
- When searching, prefer short queries: "T185" finds more than "Firebox T185 Total Security Suite 1-Year".
- Use navigate_to to take the user to relevant product pages when they ask to see or learn more about a category. Route mapping: appliances = "/", virtual = "/virtual", cloud = "/cloud", MDR/NDR = "/mdr-ndr", endpoint = "/endpoint", identity = "/identity", email = "/email", renewals = "/renewals".
- In your text responses, include clickable links to product pages using markdown link syntax: [View MDR & NDR](/mdr-ndr) or [See Endpoint Security](/endpoint). These render as clickable links that navigate the user to that tab. Use them when mentioning product categories.

Cross-sell & Upsell (important — do this naturally after every add-to-cart):
- **Appliance only?** Always suggest adding a security suite (Total Security Suite is the premium option, Basic Security Suite for budget-conscious buyers). Explain that the appliance alone has no security services.
- **Basic Security Suite?** Suggest upgrading to Total Security Suite — highlight the extra features they'd get (APT Blocker, DNSWatch, IntelligentAV, etc.).
- **Shorter term (1-Year)?** Suggest the 3-Year or 5-Year option for better per-year value.
- **Lower-tier appliance?** If the customer mentions a larger office or growing team, suggest the next model up (e.g. T45 → T85, T85 → T145) and explain the throughput/user capacity difference.
- **Firebox appliance?** Suggest complementary products: Wi-Fi access points for wireless coverage, Endpoint Security for device protection, or AuthPoint (Identity) for MFA.
- **Endpoint/Identity/Email?** Suggest bundling with other security layers for unified protection.
- **Trade-up available?** If the customer has an older model, mention trade-up SKUs for discounted upgrades.
- Keep upsell suggestions brief (2-3 sentences max) and frame them as helpful recommendations, not pushy sales. Ask if the customer would like to add the suggested product. If they say yes, use add_to_cart. If they decline, move on without pressing further.`;
}

// ── Main init function ───────────────────────────────────────
function initChat(db) {
  const apiKey = process.env.OPENROUTER_API_KEY;

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

  console.log(`Chat initialized — model: ${MODEL}, provider: OpenRouter, knowledge: ${knowledgeDoc ? 'loaded' : 'missing'}, catalog: ${catalogSummary.split('\n').length} lines`);

  // Health check info
  function isChatAvailable() {
    return !!apiKey;
  }

  // POST /api/chat — SSE streaming response
  async function handleChat(req, res) {
    if (!apiKey) {
      return res.status(503).json({ error: 'Chat unavailable — API key not configured' });
    }

    const { messages, cartItems } = req.body;
    if (!messages || !Array.isArray(messages) || messages.length === 0) {
      return res.status(400).json({ error: 'messages array is required' });
    }

    // Set up SSE
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    try {
      // Build cart context so the AI knows what's currently in the cart
      let cartContext = '';
      if (cartItems && Array.isArray(cartItems) && cartItems.length > 0) {
        const cartLines = cartItems.map(item =>
          `  - ${item.name} (SKU: ${item.sku}, Qty: ${item.quantity}, Unit: $${item.unitPrice?.toFixed(2) || '0.00'})`
        ).join('\n');
        cartContext = `\n\nCURRENT CART CONTENTS (${cartItems.length} item${cartItems.length !== 1 ? 's' : ''}):\n${cartLines}\n\nWhen the customer asks to change, swap, upgrade, or replace a product, use replace_in_cart with the exact SKU from this cart list as old_sku. You MUST use the SKU values shown above — do not guess or search for the old SKU.`;
      } else {
        cartContext = '\n\nCURRENT CART CONTENTS: Empty (no items in cart).';
      }

      // Build OpenAI-format messages array
      const apiMessages = [
        { role: 'system', content: systemPrompt + cartContext },
        ...messages.map(m => ({ role: m.role, content: m.content })),
      ];

      let iterations = 0;
      const MAX_ITERATIONS = 8;
      const pendingCartActions = []; // Buffer cart actions until text streams

      // ── Tool-calling loop: ALL non-streaming until final response ──
      // This prevents intermediate "apology" text from leaking to the user.
      // Only the final response (no tool calls) gets streamed token-by-token.
      while (iterations < MAX_ITERATIONS) {
        iterations++;

        // Force tool use on the first iteration so the model queries the
        // database instead of answering from its training data.
        // After the first tool call, switch to 'auto' so it can respond.
        const toolChoice = iterations === 1 ? 'required' : 'auto';

        const body = {
          model: MODEL,
          messages: apiMessages,
          tools: TOOLS,
          tool_choice: toolChoice,
          max_tokens: MAX_TOKENS,
        };

        const apiRes = await fetch(API_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey}`,
          },
          body: JSON.stringify(body),
        });

        if (!apiRes.ok) {
          const errBody = await apiRes.text();
          console.error('Chat API error:', apiRes.status, errBody);
          const err = new Error(errBody);
          err.status = apiRes.status;
          throw err;
        }

        const data = await apiRes.json();
        const choice = data.choices[0];
        const msg = choice.message;

        // Add assistant message to conversation
        apiMessages.push(msg);

        // No tool calls → this is the final response
        if (!msg.tool_calls || msg.tool_calls.length === 0) {
          if (msg.content) {
            res.write(`data: ${JSON.stringify({ type: 'text_delta', text: msg.content })}\n\n`);
          }
          for (const ca of pendingCartActions) {
            res.write(`data: ${JSON.stringify(ca)}\n\n`);
          }
          break;
        }

        // Has tool calls → execute them all, buffer actions, loop back
        for (const tc of msg.tool_calls) {
          const args = JSON.parse(tc.function.arguments);
          const toolResult = executeTool(db, tc.function.name, args);

          // Buffer frontend actions — emit after final text
          if (toolResult.action === 'add_to_cart') {
            pendingCartActions.push({ type: 'cart_action', action: 'add', item: toolResult.item });
          } else if (toolResult.action === 'remove_from_cart') {
            pendingCartActions.push({ type: 'cart_action', action: 'remove', sku: toolResult.sku });
          } else if (toolResult.action === 'replace_in_cart') {
            pendingCartActions.push({ type: 'cart_action', action: 'replace', old_sku: toolResult.old_sku, item: toolResult.item });
          } else if (toolResult.action === 'show_cart') {
            pendingCartActions.push({ type: 'cart_action', action: 'show' });
          } else if (toolResult.action === 'navigate') {
            pendingCartActions.push({ type: 'navigate', route: toolResult.route, label: toolResult.label });
          }

          apiMessages.push({
            role: 'tool',
            tool_call_id: tc.id,
            content: JSON.stringify(toolResult),
          });
        }
        // Loop back — model will see tool results and decide next step
      }

      res.write(`data: ${JSON.stringify({ type: 'message_stop' })}\n\n`);
      res.end();
    } catch (err) {
      console.error('Chat error:', err.status || err.code, err.message);
      let userMessage = 'Something went wrong. Please try again.';
      const status = err.status || err.httpStatusCode;
      const msg = err.message || '';

      if (status === 401 || msg.includes('API key') || msg.includes('auth')) {
        userMessage = 'AI assistant is not configured — API key is missing or invalid.';
      } else if (status === 429 || msg.includes('quota') || msg.includes('rate')) {
        userMessage = 'Too many requests — the AI is rate-limited. Please wait a minute and try again.';
      } else if (status === 400) {
        userMessage = 'The AI model returned an error processing your request. Please start a new chat and try again.';
      } else if (status === 503 || msg.includes('overloaded') || msg.includes('unavailable')) {
        userMessage = 'The AI service is temporarily unavailable. Please try again in a few minutes.';
      } else if (msg.includes('fetch') || msg.includes('ECONNREFUSED') || msg.includes('network')) {
        userMessage = 'Cannot connect to the AI service — check your internet connection.';
      }

      res.write(`data: ${JSON.stringify({ type: 'error', error: userMessage })}\n\n`);
      res.end();
    }
  }

  return { handleChat, isChatAvailable };
}

module.exports = { initChat };
