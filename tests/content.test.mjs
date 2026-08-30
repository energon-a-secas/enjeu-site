// House rules over the site's own prose and data: no em dashes (U+2014, spelled as an escape here so this file passes its own check), no banned
// words, walkthrough steps point at rulebook sections that exist, placeholders
// say so, names follow the two-word rule.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { STRINGS } from '../js/strings.js';
import { DECKS, useCards } from '../js/data/cards.js';
import { DM_STYLES } from '../js/game/engine.js';
import { STEPS } from '../js/data/walkthrough.js';
import { HEROES, BOSSES, MINION } from '../js/data/placeholders.js';


const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));
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
  const files = [...walk(join(root, 'js')), ...walk(join(root, 'css')), ...walk(join(root, 'tests')), join(root, 'index.html'), join(root, 'README.md'), join(root, 'RULES.md'), join(root, 'RULES.es.md'), ...walk(join(root, 'docs')).filter((f) => f.endsWith('.md'))];
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
  // The tables added with break points and the DM dial. `play.outcome` is here
  // because it was first written as `play.hist`, which ALREADY EXISTED as the
  // history table's column headers: the object literal collapsed, key parity
  // still passed in both directions (both languages lost the same key), and the
  // run summary rendered a raw [play.hist.win]. Parity cannot catch a key that
  // was never reachable; only checking a table against the list that indexes it can.
  need('play.outcome', ['win', 'loss']);
  need('play.brk', ['title', 'say', 'wound', 'cripple', 'trophy', 'woundHint', 'crippleHint', 'trophyHint', 'left', 'costs', 'free', 'held', 'broke', 'cancel']);
  need('play.dm', DM_STYLES);
  need('play.dm', DM_STYLES.map((k) => `${k}Hint`));
  need('cards.step', ['sure', 'even', 'hard', 'wild']);
  need('cards.effect', data.physical.map((c) => c.id));
  need('play.reactionName', (data.boss_reaction || []).map((r) => r.id));
  need('play.signatureName', [...new Set(data.boss.filter((b) => b.signature).map((b) => b.signature.id))]);
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

/**
 * A test that is written and never runs is worse than no test, because it gets
 * counted. It has now happened twice in two days: three new cases in
 * tests/play.test.mjs and one in tests/cards.test.mjs, both caught only because
 * the reported count did not move, and nobody remembers what the count was.
 *
 * There are two suite shapes here and only one is vulnerable. A QUEUED suite
 * (`test()` pushes, one loop drains at the end) silently drops anything declared
 * below that loop. An IMMEDIATE suite (`test()` calls fn right away) cannot.
 * This checks the queued ones for orphans and checks that the immediate ones
 * really are immediate, so a suite cannot quietly change shape and lose its tail.
 */
/**
 * The deck size is typed out in words in four places across two languages, and
 * it has gone stale three times: 94, then 105, then 110, each time next to a
 * drawing that counted the real deck for itself. Words cannot be derived, so
 * they get checked instead.
 */
test('the card count spelled out in prose is the deck that actually exists', () => {
  const WORDS = {
    110: ['a hundred and ten', 'ciento diez'],
    111: ['a hundred and eleven', 'ciento once'],
    112: ['a hundred and twelve', 'ciento doce'],
  };
  const n = data.physical.length;
  const right = WORDS[n];
  assert.ok(right, `no spelled-out form on record for ${n} cards: add it here and to the copy`);
  const wrong = Object.entries(WORDS).filter(([k]) => Number(k) !== n).flatMap(([, v]) => v);
  const hay = JSON.stringify(STRINGS).toLowerCase();
  for (const w of wrong) {
    assert.equal(hay.includes(w), false, `the string table still says "${w}" and the deck is ${n}`);
  }
  // And at least one language says the right number, so this cannot pass by the
  // copy simply having dropped every mention.
  assert.ok(right.some((w) => hay.includes(w)), `no copy anywhere states the deck size (${n})`);
});

test('no test file registers a case that never runs', () => {
  const files = readdirSync(join(root, 'tests')).filter((f) => f.endsWith('.test.mjs'));
  assert.ok(files.length >= 8, `expected the whole suite, saw ${files.length}`);
  const bad = [];
  for (const f of files) {
    const src = readFileSync(join(root, 'tests', f), 'utf8');
    const declared = [...src.matchAll(/^test\(/gm)].map((m) => m.index);
    if (!declared.length) { bad.push(`${f}: no test() call sites at all`); continue; }
    const queued = /queue\.push\(/.test(src);
    if (queued) {
      const runner = src.search(/for \(const \[[^\]]+\] of queue\)/);
      if (runner < 0) { bad.push(`${f}: queues its cases and never drains the queue`); continue; }
      const orphans = declared.filter((at) => at > runner).length;
      if (orphans) bad.push(`${f}: ${orphans} case(s) declared below the runner, so they never run`);
    } else {
      // An immediate suite has to actually invoke the case it was handed.
      const fn = src.match(/function test\(name, fn\) \{[\s\S]{0,220}?\n\}/);
      if (!fn || !/\bfn\(\)/.test(fn[0])) bad.push(`${f}: test() never calls the function it is given`);
    }
  }
  assert.deepEqual(bad, []);
});

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
