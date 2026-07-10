#!/usr/bin/env node
/**
 * generate-catalog-from-wgdata.cjs
 *
 * Builds a fresh product-catalog CSV from the latest WGdata_*.csv.
 *
 * Rules:
 *   - Rows come from the latest WGdata (one row per STOCK CODE).
 *   - "Watchguard Accessories" subcategory is EXCLUDED (per request).
 *   - Name          ← WGdata SHORT DESCRIPTION (whitespace-normalized)
 *   - url in dealershop ← left BLANK (filled by hand later)
 *   - Method of Delivery / Product Family / Product Group:
 *       * If the SKU already exists in the current product-catalog.csv with a
 *         valid family → REUSE that hand-curated classification (highest fidelity).
 *       * Otherwise → DERIVE it from the description using the rules below,
 *         matching the existing catalog's conventions.
 *
 * Output: server/data/product-catalog-new.csv  (non-destructive)
 */

const fs = require('fs');
const path = require('path');

const ROOT = path.resolve(__dirname, '..');
const SRC_DATA = path.join(ROOT, 'src', 'data');
const SERVER_DATA = path.join(ROOT, 'server', 'data');
const OUT = path.join(SERVER_DATA, 'product-catalog-new.csv');

const EXCLUDE_SUBCATEGORIES = new Set(['Watchguard Accessories']);

// Families the app (seed.js familyToCategory) already understands.
const KNOWN_FAMILIES = new Set([
  'Access Points', 'M-Series', 'T-Series', 'Virtual', 'Cloud',
  'MDR & NDR', 'Endpoint & Mobile', 'Identity & Access', 'Email Security', 'Renewals',
]);

// ── CSV helpers ──────────────────────────────────────────────────
function parseCSVLine(line) {
  const fields = [];
  let cur = '', q = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') q = !q;
    else if (ch === ',' && !q) { fields.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  fields.push(cur.trim());
  return fields;
}
function csvField(val) {
  if (val == null) return '';
  const s = String(val);
  return (s.includes(',') || s.includes('"') || s.includes('\n'))
    ? '"' + s.replace(/"/g, '""') + '"'
    : s;
}
const normName = (s) => String(s || '').replace(/\s+/g, ' ').trim();

// ── Load latest WGdata ───────────────────────────────────────────
function latestWGdata() {
  const files = fs.readdirSync(SRC_DATA)
    .filter(f => /^WGdata_.*\.csv$/.test(f)).sort();
  if (!files.length) throw new Error('No WGdata_*.csv in src/data/');
  return files[files.length - 1];
}

// ── Load current catalog classification (SKU → {delivery, family, group}) ──
function loadExistingClassification() {
  const p = path.join(SERVER_DATA, 'product-catalog.csv');
  const lines = fs.readFileSync(p, 'utf8').split('\n').filter(l => l.trim());
  const map = new Map();
  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    if (!f[0]) continue;
    const [sku, , delivery, family, group] = f;
    const url = f[5] || ''; // "url in dealershop" — preserve existing dealer-shop links
    // Only reuse when the family is one the app recognises (skips the 1 buggy row).
    if (KNOWN_FAMILIES.has(family) && group) {
      map.set(f[0].replace(/^﻿/, ''), { delivery, family, group, url });
    }
  }
  return map;
}

// ── Derive classification for a NEW SKU from its description ──────
// Returns { delivery, family, group, flag } where flag marks a brand-new /
// judgment-call product line for human review.
function deriveNew(name, subcat) {
  const n = normName(name);
  const isPhysical = /appliance only|nfr hardware/i.test(n);
  const delivery = isPhysical ? 'Physical' : 'Electronic';
  const E = (family, group, flag = false) => ({ delivery: 'Electronic', family, group, flag });
  const P = (family, group, flag = false) => ({ delivery, family, group, flag });

  // 1) Standalone product lines (name-keyed) ─ specific before generic.
  if (/core mdr for microsoft/i.test(n)) return E('MDR & NDR', 'Core MDR for Microsoft');
  if (/open mdr/i.test(n))               return E('MDR & NDR', 'Open MDR');
  if (/\bcore mdr\b/i.test(n))           return E('MDR & NDR', 'Core MDR');
  if (/total ndr/i.test(n))              return E('MDR & NDR', 'Total NDR');
  if (/threatsync open/i.test(n))        return E('MDR & NDR', 'ThreatSync Open');
  if (/authpoint/i.test(n))              return E('Identity & Access', 'AuthPoint');

  if (/endpoint security for servers/i.test(n))     return E('Endpoint & Mobile', 'Endpoint Security for Servers');
  if (/endpoint security.*data retention/i.test(n)) return E('Endpoint & Mobile', 'Endpoint Security Data Retention');
  if (/endpoint security 360/i.test(n))             return E('Endpoint & Mobile', 'Endpoint Security 360');
  if (/endpoint security basic/i.test(n))           return E('Endpoint & Mobile', 'Endpoint Security Basic');
  if (/endpoint security elite/i.test(n))           return E('Endpoint & Mobile', 'Endpoint Security Elite');
  if (/endpoint security prime/i.test(n))           return E('Endpoint & Mobile', 'Endpoint Security Prime');

  // Zero-Trust Application Service is a per-seat endpoint product (verified by review panel).
  if (/managed zero-trust/i.test(n))         return E('Endpoint & Mobile', 'Managed Zero-Trust');
  if (/zero-trust/i.test(n))                 return E('Endpoint & Mobile', 'Zero-Trust');
  // Orion = ThreatSync Full Suite (SKU prefix WGTSFS) — XDR, belongs with ThreatSync in MDR & NDR.
  if (/\borion\b/i.test(n))                  return E('MDR & NDR', 'Orion');

  // Brand-new lines with no existing app family (flagged for review).
  if (/firecloud total access/i.test(n))     return E('FireCloud', 'FireCloud Total Access', true);
  if (/firecloud internet access/i.test(n))  return E('FireCloud', 'FireCloud Internet Access', true);
  if (/clouddr/i.test(n))                    return E('CloudDR', 'CloudDR', true);
  if (/compliance reporting/i.test(n))       return E('Reporting & Visibility', 'Compliance Reporting', true);
  if (/siemfeeder/i.test(n))                 return E('Reporting & Visibility', 'SIEMFeeder', true);
  if (/dimension command/i.test(n))          return E('Reporting & Visibility', 'Dimension Command', true);
  if (/mssp.*pre pay points/i.test(n))       return E('MSSP', 'MSSP Points', true);

  // 2) Cloud / Virtual appliance sizes (before generic Firebox model).
  let m;
  if ((m = n.match(/firebox cloud (small|medium|large|xlarge)/i)))
    return E('Cloud', 'Firebox Cloud ' + cap(m[1]));
  if ((m = n.match(/fireboxv (micro|small|medium|large|xlarge)/i)))
    return E('Virtual', 'FireboxV ' + cap(m[1]));

  // 3) Access Point model-specific (Wi-Fi management / NFR renewals).
  if ((m = n.match(/\bAP(\d+[A-Z]*)\b/i)))
    return E('Access Points', 'AP' + m[1].toUpperCase());

  // 4) Generic AP Wi-Fi management / renewal (no model — "1 AP").
  if (/wi-fi management|wi-fi renewal/i.test(n))
    return E('Access Points', 'Wi-Fi Management', true);

  // 5) Firebox hardware model (Tabletop / Rackmount / NV).
  const isRenewal = /renewal|upgrade/i.test(n);
  // Preserve the model's original casing (T85-PoE, T45-W-PoE, T115-W …).
  if ((m = n.match(/firebox\s+(T\d+[\w-]*)/i))) {
    const model = m[1];
    return isRenewal ? P('Renewals', model) : P('T-Series', model);
  }
  if ((m = n.match(/firebox\s+(M\d+[\w-]*)/i))) {
    const model = m[1];
    return isRenewal ? P('Renewals', model) : P('M-Series', model);
  }
  if ((m = n.match(/firebox\s+(NV\d+[\w-]*)/i)))
    return P('Firebox NV-Series', m[1], true);

  // 6) Fallback by subcategory (should be rare).
  return E('Uncategorized', normName(subcat) || 'Unknown', true);
}
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase()
  .replace(/^xlarge$/, 'XLarge');

// ── Main ─────────────────────────────────────────────────────────
function main() {
  const wgFile = latestWGdata();
  console.log('Source WGdata:', wgFile);
  const existing = loadExistingClassification();
  console.log('Reusable classifications from current catalog:', existing.size);

  const lines = fs.readFileSync(path.join(SRC_DATA, wgFile), 'utf8')
    .split('\n').filter(l => l.trim());

  const out = [];
  const stats = { total: 0, excluded: 0, reused: 0, derived: 0 };
  const flagged = [];
  const famCount = {};
  const newGroupsByFamily = {}; // family -> Set(groups) that are NOT in existing catalog

  const existingGroups = new Set([...existing.values()].map(v => v.family + '|' + v.group));

  for (let i = 1; i < lines.length; i++) {
    const f = parseCSVLine(lines[i]);
    const sku = f[0];
    const subcat = f[1];
    const desc = f[2];
    if (!sku) continue;
    stats.total++;
    if (EXCLUDE_SUBCATEGORIES.has(subcat)) { stats.excluded++; continue; }

    const name = normName(desc);
    let cls = existing.get(sku);
    let flag = false;
    if (cls) {
      stats.reused++;
    } else {
      cls = deriveNew(desc, subcat);
      flag = cls.flag;
      stats.derived++;
      const key = cls.family + '|' + cls.group;
      if (!existingGroups.has(key)) {
        (newGroupsByFamily[cls.family] = newGroupsByFamily[cls.family] || new Set()).add(cls.group);
      }
      if (flag) flagged.push({ sku, name, family: cls.family, group: cls.group });
    }
    famCount[cls.family] = (famCount[cls.family] || 0) + 1;

    // Preserve the existing dealer-shop URL for carried-over SKUs; new SKUs stay blank.
    out.push({ family: cls.family, line: [sku, csvField(name), cls.delivery, cls.family, cls.group, csvField(cls.url || '')].join(',') });
  }

  // seed.js keys product groups by slug only and takes the FIRST-seen row's
  // family/category. A model slug (e.g. M290, T25) appears in BOTH its appliance
  // family (M-Series/T-Series) AND "Renewals". To make the appliance family win
  // the category — matching the original catalogue and the live site — emit all
  // Renewals rows LAST (stable sort keeps WGdata order within each bucket).
  out.sort((a, b) => (a.family === 'Renewals' ? 1 : 0) - (b.family === 'Renewals' ? 1 : 0));

  const header = '﻿SKU,Name,Method of Delivery,Product Family,Product Group,url in dealershop';
  fs.writeFileSync(OUT, header + '\n' + out.map(o => o.line).join('\n') + '\n', 'utf8');

  // ── Report ──
  console.log('\n=== Row stats ===');
  console.log(`  WGdata rows:        ${stats.total}`);
  console.log(`  Excluded (Accessories): ${stats.excluded}`);
  console.log(`  Reused from catalog: ${stats.reused}`);
  console.log(`  Derived (new):       ${stats.derived}`);
  console.log(`  Output rows:         ${out.length}`);

  console.log('\n=== Product Family distribution (output) ===');
  Object.entries(famCount).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => {
      const known = KNOWN_FAMILIES.has(k) ? '' : '   ← NEW family (app shows as "other")';
      console.log('  ' + String(v).padStart(4) + '  ' + k + known);
    });

  console.log('\n=== New Product Groups added (not in current catalog) ===');
  for (const [fam, gs] of Object.entries(newGroupsByFamily)) {
    console.log('  [' + fam + ']  ' + [...gs].sort().join(' | '));
  }

  console.log(`\n=== Flagged rows for human review: ${flagged.length} ===`);
  const byFam = {};
  for (const r of flagged) (byFam[r.family + ' / ' + r.group] = byFam[r.family + ' / ' + r.group] || 0)
    , byFam[r.family + ' / ' + r.group]++;
  Object.entries(byFam).sort((a, b) => b[1] - a[1])
    .forEach(([k, v]) => console.log('  ' + String(v).padStart(4) + '  ' + k));

  console.log('\n✓ Wrote', path.relative(ROOT, OUT), `(${out.length} rows + header)`);
}

main();
