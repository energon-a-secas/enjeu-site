// The shared seam: the things every view is required to ask for rather than draw
// itself, plus the persistence of the settings they store.
//
// This file exists because of a real bug. A card redesign landed in the print
// sheet and the screen kept showing the old thing, and the cause was not stale
// art: it was second renderers. `lifeMini` carried its own life-card grammar,
// Learn and Play each drew their own black check dots while the printed card
// uses a traffic light, and the redesigned card backs existed nowhere but the
// print sheet. Those duplicates are gone. These tests fail if one comes back.
import assert from 'node:assert/strict';
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { cardFace, cardBack, lifeMini, riskDots, RISK, PIPS } from '../js/cards/face.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8'));

// Queued and awaited, not run on the spot: two of these are async, and a runner
// that calls fn() inside a try counts a pass the moment the Promise is returned,
// with the assertions inside it never waited on. cards.test.mjs had that bug.
let passed = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);
function walk(dir, out = []) {
  for (const f of readdirSync(dir)) {
    const p = join(dir, f);
    if (/^neorgon-/.test(f)) continue;              // vendored kits are not ours
    if (statSync(p).isDirectory()) walk(p, out); else if (f.endsWith('.js')) out.push(p);
  }
  return out;
}
const viewFiles = () => walk(join(root, 'js/views')).concat(walk(join(root, 'js/data')));

// ── The check vocabulary: one traffic light, counted the same everywhere ──

test('riskDots draws one dot per pip, in the colour the card prints', () => {
  for (const [step, n] of Object.entries(PIPS)) {
    const html = riskDots(step);
    assert.equal((html.match(/<i><\/i>/g) || []).length, n, `${step} should draw ${n}`);
    assert.ok(html.includes(`--risk:${RISK[step]}`), `${step} should carry ${RISK[step]}`);
  }
});

test('riskDots draws nothing for a card with no check (it always lands)', () => {
  assert.equal(riskDots('none'), '');
  assert.equal(riskDots(undefined), '');
  assert.equal(riskDots('not-a-step'), '');
});

test('no view draws its own check dots (that is what riskDots is for)', () => {
  // The two views used to hold a local `pips` helper and a STEP_PIPS table, so
  // the page taught a black-dot ladder while the paper printed a coloured one.
  const bad = [];
  for (const f of viewFiles()) {
    const src = readFileSync(f, 'utf8');
    if (/\bSTEP_PIPS\b/.test(src)) bad.push(`${f}: STEP_PIPS`);
    if (/^(const|function|let)\s+pips\b/m.test(src)) bad.push(`${f}: local pips helper`);
  }
  assert.deepEqual(bad, []);
});

// ── The card backs: on screen, not only on paper ──────────────

test('cardBack renders a real card at every size a view can ask for', () => {
  for (const size of ['sheet', 'hand', 'mini']) {
    const html = cardBack('skill', { size, cls: 'lc' });
    assert.ok(html.startsWith('<svg'), size);
    assert.ok(html.includes(`sk-card--${size}`), `${size} class`);
    assert.ok(html.includes('lc'), `${size} keeps the caller's class`);
    assert.ok(html.includes('viewBox="0 0 630 880"'), `${size} keeps the print grid`);
  }
});

test('cardBack still defaults to the print sheet, which calls it with no options', () => {
  assert.ok(cardBack('skill').includes('sk-card--sheet'));
  assert.ok(cardBack().startsWith('<svg'));
});

// ── Life minis: the printed face, or the printed back ─────────

test('a life mini IS the printed card, at mini size', () => {
  for (const k of ['fire', 'water', 'earth', 'wind', 'extra', 'boss']) {
    const html = lifeMini(k);
    assert.ok(html.includes('sk-card--mini'), k);
    assert.ok(html.includes('<title>'), `${k} names itself for a screen reader`);
  }
});

test('the four element minis are four different cards', () => {
  const drawn = ['fire', 'water', 'earth', 'wind'].map((e) => lifeMini(e));
  assert.equal(new Set(drawn).size, 4);
});

test('a Broken mini renders the real back, never a mirrored face', () => {
  const broken = lifeMini('fire', 'is-broken');
  assert.ok(broken.includes('sk-card--mini'));
  assert.ok(broken.includes('is-broken'), 'keeps the state class the CSS reads');
  assert.equal(/rotateY/.test(broken), false, 'a mirrored face is not a card back');
  assert.notEqual(broken, lifeMini('fire'), 'face down must not look like face up');
});

test('a Spent mini is the face plus its state class (the CSS turns it sideways)', () => {
  const spent = lifeMini('water', 'is-spent');
  assert.ok(spent.includes('is-spent') && spent.includes('lc'));
  assert.ok(spent.includes('<title>'), 'a Spent card is still face up');
});

test('an unknown life kind renders nothing rather than an empty card', () => {
  assert.equal(lifeMini('nope'), '');
});

test('no stylesheet fakes a card back by mirroring a face', () => {
  // A rotateY on a card face shows the face backwards, not the back. Once the
  // renderer had the real back, the mirroring had to go, in both views.
  // Comments are stripped first: the stylesheets explain WHY the mirroring is
  // gone, and a check that trips on its own explanation teaches people to delete
  // the explanation.
  const css = ['css/learn.css', 'css/play.css', 'css/browse.css', 'css/cards.css', 'css/style.css'];
  const bad = css.filter((f) => /rotateY/.test(readFileSync(join(root, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')));
  assert.deepEqual(bad, []);
});

// ── Every card still draws ────────────────────────────────────

test('cardFace renders every card in the data with no gaps', () => {
  const all = Object.values(data).filter(Array.isArray).flat().filter((c) => c && c.id);
  assert.ok(all.length >= 60, `expected the whole catalogue, saw ${all.length}`);
  for (const c of all) {
    const html = cardFace(c, { size: 'hand' });
    assert.ok(html.startsWith('<svg'), c.id);
    assert.ok(html.includes('viewBox="0 0 630 880"'), `${c.id} keeps the print grid`);
  }
});

// ── Persisted settings ────────────────────────────────────────

test('a save from an older build comes back with the newer keys defaulted', async () => {
  // The bug this covers was silent: loadSaved merged the nested settings onto
  // `s.balance` AFTER the loop above it had already replaced `s.balance`, so the
  // merge protected nothing and any key added later read undefined for every
  // returning visitor. The defaults are now snapshotted at module load.
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => (store.has(k) ? store.get(k) : null),
    setItem: (k, v) => store.set(k, String(v)),
    removeItem: (k) => store.delete(k),
  };
  store.set('enjeu-state', JSON.stringify({
    die: 'd12', learnStep: 3,
    browse: { sort: 'element' },                   // predates element/tier/klass/backs
    balance: { trials: 500 },                      // predates the rest of its keys
  }));
  const { state, loadSaved } = await import('../js/state.js');
  loadSaved(state);
  assert.equal(state.die, 'd12', 'a saved scalar survives');
  assert.equal(state.browse.sort, 'element', 'a saved nested key survives');
  assert.equal(state.browse.element, 'all', 'a missing nested key is defaulted');
  assert.equal(state.browse.tier, 'all');
  assert.equal(state.browse.klass, 'all');
  assert.equal(state.browse.backs, false, 'a false default must not read undefined');
  assert.equal(state.balance.trials, 500, 'balance keeps what was saved');
  assert.ok(Object.keys(state.balance).length > 1, 'and defaults the rest');
  assert.equal(state.view, 'learn', 'an unpersisted field is not restored');
});

test('Second Wind defaults on for the First Game and off for the five-level run', async () => {
  const { secondWindDefault } = await import('../js/state.js');
  assert.equal(secondWindDefault('first'), true);
  assert.equal(secondWindDefault('full'), false);
});

for (const [name, fn] of queue) {                 // in declaration order
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
