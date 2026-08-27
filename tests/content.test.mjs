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
    if (f === 'neorgon-header.js' || f === 'neorgon-footer.js') continue; // vendored kits are not ours to restyle
    if (statSync(p).isDirectory()) walk(p, out); else if (/\.(js|mjs|html|md)$/.test(f)) out.push(p);
  }
  return out;
}

test('no em dashes in site code, strings, docs or README (house rule; dated plans are exempt and live elsewhere)', () => {
  const files = [...walk(join(root, 'js')), ...walk(join(root, 'tests')), join(root, 'index.html'), join(root, 'README.md'), join(root, 'RULES.md'), ...walk(join(root, 'docs')).filter((f) => f.endsWith('.md'))];
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
  need('nav', ['learn', 'cards', 'play', 'balance']);
  need('play', ['story', 'standard', 'nightmare']);
  need('play.modeHint', ['story', 'standard', 'nightmare']);
  need('balance.style', ['turtle', 'safe', 'adaptive', 'gamble']);
  assert.deepEqual(missing, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
