// House rules over the site's own prose and data: no em dashes (U+2014, spelled as an escape here so this file passes its own check), no banned
// words, walkthrough steps point at rulebook sections that exist, placeholders
// say so, names follow the two-word rule.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STRINGS } from '../js/strings.js';
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

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
