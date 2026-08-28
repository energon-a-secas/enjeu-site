// House rules over the site's own prose and data: no em dashes (U+2014, spelled as an escape here so this file passes its own check), no banned
// words, walkthrough steps point at rulebook sections that exist, placeholders
// say so, names follow the two-word rule.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STRINGS } from '../js/strings.js';
import { DECKS } from '../js/data/cards.js';
import { STEPS } from '../js/data/walkthrough.js';
import { HEROES, BOSSES, MINION } from '../js/data/placeholders.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
let passed = 0, failed = 0;
function test(name, fn) {
  try { fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (/^neorgon-/.test(f)) continue;              // vendored kits are not ours to restyle
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs|html|md|css)$/.test(f)) out.push(p);
  }
  return out;
}

test('no em dashes in site code, strings, docs or README (house rule; dated plans are exempt and live elsewhere)', () => {
  // css/ is in the list because the stylesheets carry as much prose as the JS:
  // three of them were written this run, entirely in comments explaining layout
  // decisions, and none of that was scanned before.
  const files = [...walk(join(root, 'js')), ...walk(join(root, 'css')), ...walk(join(root, 'tests')), join(root, 'index.html'), join(root, 'README.md'), join(root, 'RULES.md'), ...walk(join(root, 'docs')).filter((f) => f.endsWith('.md'))];
  const bad = files.filter((f) => readFileSync(f, 'utf8').includes('\u2014')).map((f) => f.replace(root + '/', ''));
  assert.deepEqual(bad, []);
});

test('no banned words in UI strings or walkthrough copy (PROJECTS.md section 6)', () => {
  const banned = /\b(powerful|seamless|leverages?|robust|utilize)\b/i;
  const text = JSON.stringify(STRINGS) + ' ' + JSON.stringify(STEPS);
  assert.equal(banned.test(text), false, (text.match(banned) || [])[0]);
});

test('every walkthrough step cites a rulebook section that exists in RULES.md', () => {
  const rules = readFileSync(join(root, 'RULES.md'), 'utf8');
  const sections = [...rules.matchAll(/^## (\d+)\./gm)].map((m) => m[1]);
  for (const st of STEPS) for (const n of st.rule.split(',').map((x) => x.trim())) assert.ok(sections.includes(n), `step ${st.id} cites section ${n}`);
});

test('placeholders are marked and named in two concrete words, no brand', () => {
  for (const p of [...HEROES, ...BOSSES, MINION]) {
    assert.equal(p.placeholder, true, p.id);
    assert.ok(/^[A-Z][a-z]+( [A-Z][a-z]+)?$/.test(p.name), `${p.id}: "${p.name}" is not one or two capitalised words`);
    assert.equal(/lego|playmobil|duplo|mega ?bloks/i.test(p.name), false);
  }
});

test('every t() key the views ask for resolves (a miss renders the raw [key] on screen)', () => {
  const files = walk(join(root, 'js'));
  const asked = new Map();
  for (const f of files) {
    for (const m of readFileSync(f, 'utf8').matchAll(/\bt\(\s*'([\w.]+)'/g)) asked.set(m[1], f.replace(root + '/', ''));
  }
  assert.ok(asked.size > 20, `only ${asked.size} keys scanned`);
  const miss = [...asked].filter(([k]) => {
    let cur = STRINGS.en;
    for (const part of k.split('.')) { if (cur == null || typeof cur !== 'object') return true; cur = cur[part]; }
    return typeof cur !== 'string';
  }).map(([k, where]) => `${k} (${where})`);
  assert.deepEqual(miss, []);
});

test('every enumerated label table is complete (a gap renders the raw [key] on screen)', () => {
  // Views build these keys with template literals, t(`cards.deck.${d}`), which a
  // plain regex never sees. That is exactly how a missing label shipped and drew
  // "[cards.backs.few]" on a button, so each table is checked against the real
  // list it is indexed by rather than by scanning.
  const en = STRINGS.en;
  const table = (k) => k.split('.').reduce((o, p) => (o == null ? o : o[p]), en) || {};
  const missing = [];
  const need = (key, keys) => {
    const t = table(key);
    for (const k of keys) if (typeof t[k] !== 'string') missing.push(`${key}.${k}`);
  };
  need('cards.deck', DECKS);
  need('cards.check', ['none', 'sure', 'even', 'hard', 'wild']);
  need('cards.backs', ['_', 'none', 'few', 'all']);
  need('nav', ['learn', 'cards', 'play', 'about', 'balance']);
  need('play', ['story', 'standard', 'nightmare']);
  need('play.modeHint', ['story', 'standard', 'nightmare']);
  need('balance.style', ['turtle', 'safe', 'adaptive', 'gamble']);
  assert.deepEqual(missing, []);
});

/**
 * The header of js/strings.js promises that a key present in one language and
 * missing in the other is caught here. It was not: both checks below this one
 * walked STRINGS.en and nothing ever read STRINGS.es, so the Spanish table
 * could silently lose a key and the page would render the literal [some.key].
 * A stated guard that does not run is worse than no guard, because it gets
 * quoted. This is the guard the comment describes.
 */
test('every language table has exactly the same keys, in both directions', () => {
  const leaves = (o, at = '') => Object.entries(o).flatMap(([k, v]) =>
    (v && typeof v === 'object' && !Array.isArray(v)) ? leaves(v, at ? `${at}.${k}` : k) : [at ? `${at}.${k}` : k]);
  const langs = Object.keys(STRINGS);
  assert.ok(langs.length >= 2, `expected more than one language table, found ${langs}`);
  const base = new Set(leaves(STRINGS.en));
  for (const l of langs) {
    if (l === 'en') continue;
    const other = new Set(leaves(STRINGS[l]));
    // cards.name is a deliberate one-way overlay: English names live in
    // data/cards.json, so `en` carries no table and cardName falls through.
    const missing = [...base].filter((k) => !other.has(k));
    const extra = [...other].filter((k) => !base.has(k) && !k.startsWith('cards.name.'));
    assert.deepEqual(missing, [], `${l} is missing keys that en has`);
    assert.deepEqual(extra, [], `${l} has keys en does not`);
  }
});

/**
 * The house rule is that the toy brand is never named: only "construction toy",
 * "bricks", "figure". It had no guard, and the rulebook broke it on line 7 for
 * months inside a non-affiliation notice while every other line obeyed it. A
 * legal disclaimer is exactly where the name creeps back in, so the scan covers
 * living prose. Dated records under .forge are what was written at the time.
 */
test('no toy brand is named in any living document', () => {
  const BRANDS = [/\bLEGO\b/i, /\bMega ?Bloks\b/i, /\bK'?NEX\b/i, /\bPlaymobil\b/i];
  const files = [];
  const walk = (dir) => {
    for (const f of readdirSync(dir)) {
      if (['node_modules', '.git', '.forge', 'art', 'print', 'docs/journal'].includes(f)) continue;
      const full = join(dir, f);
      if (statSync(full).isDirectory()) walk(full);
      // This file names the brands in its own pattern list, so it cannot scan itself.
      else if (/\.(md|js|mjs|html|json)$/.test(f) && !f.startsWith('neorgon-') && f !== 'content.test.mjs') files.push(full);
    }
  };
  walk(root);
  const hits = [];
  for (const f of files) {
    const text = readFileSync(f, 'utf8');
    for (const b of BRANDS) {
      const m = b.exec(text);
      if (m) hits.push(`${f.replace(root + '/', '')}: "${m[0]}"`);
    }
  }
  assert.deepEqual(hits, [], 'a brand name reached a living document');
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
