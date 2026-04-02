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
