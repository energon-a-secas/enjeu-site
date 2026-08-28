// ── Cards view ───────────────────────────────────────────────
// The catalogue. Browse every printed card, grouped by whatever you are
// actually looking for (deck, element, tier, class, risk, damage, name), narrow
// it with the element / tier / class chips, flip the whole grid over to the
// printed BACKS, and tap any card for the name and the numbers its face
// deliberately does not spell out.
//
// PRINTING IS NOT AFFECTED BY ANY OF THIS. printOrder() below is the only thing
// that decides what the sheet gets, and it reads data.physical (cards.json
// order, copies expanded) and nothing else. The print output is the product and
// the screen is its preview: two players who print the deck have to end up with
// the same sheets in the same order, whatever either screen was sorted by.

import { t } from '../strings.js';
import { escHtml, showToast } from '../utils.js';
import { DECKS, CHECKS } from '../data/cards.js';
import { cardFace, cardBack, FACE } from '../cards/face.js';
import { glyphSvg, artCount } from '../cards/glyphs.js';
// backKind comes from sheet.js: the printer owns which back a card takes, and
// the grid shows that one rather than deciding for itself.
import { renderPrintSheet, backKind } from '../cards/sheet.js';
import { aidFor } from '../game/rules.js';
import { openModal } from '../events.js';

const DECK_CHIP = { attack: '#111', skill: '#111', class: FACE.violet, advantage: FACE.gold, boss: '#111', biome: FACE.brown, life: FACE.fire, aid: '#625c52', mode: FACE.water };

/** The four elements in the order the life cards are boxed, not cycle order. */
const ELEMENTS = ['fire', 'water', 'earth', 'wind'];

const cap = (s) => String(s).charAt(0).toUpperCase() + String(s).slice(1);
const copiesOf = (list) => list.reduce((a, c) => a + (c.copies || 1), 0);
/** Every unique card, in cards.json order. The grid shows uniques with a copies badge. */
const allCards = (data) => DECKS.flatMap((d) => data[d] || []);

// ── The axes ─────────────────────────────────────────────────
/**
 * What the browser may sort, group and filter by. One list, because the toolbar
 * renders from it and the sorter reads from it: a control whose key the sorter
 * does not know is a control that silently does nothing.
 */
export const SORTS = ['deck', 'element', 'tier', 'class', 'check', 'damage', 'name'];

/**
 * A card's value on one axis, or null when the axis does not describe that card
 * at all.
 *
 * Applicability is the whole design here. Only Attack and Skill cards carry a
 * tier, a check and a class lock, and only they take "your" element when they
 * have none of their own (face.js: a card with no element is not colourless, it
 * is whichever one you are). A boss card has a `damage` number too, but it is
 * damage dealt TO the player, which is not the same quantity as an attack's
 * damage and must not be grouped with it.
 *
 * A card an axis does not describe keeps its DECK heading and is listed after
 * the keyed groups. That is deliberate: giving a biome card "tier 0" would file
 * it next to Strike and state something false about it, and dropping it would
 * lose a card from the catalogue, which is the one failure this view cannot
 * have.
 */
export function axis(card, sort) {
  const playable = card.deck === 'attack' || card.deck === 'skill';
  switch (sort) {
    case 'deck': return card.deck;
    case 'element': return card.element || (playable ? 'none' : null);
    case 'tier': return typeof card.tier === 'number' ? String(card.tier) : null;
    case 'class': return playable ? (card.class || 'none') : null;
    case 'check': return playable ? (card.check || 'none') : null;
    case 'damage': return playable && card.damage !== undefined && card.damage !== null ? String(card.damage) : null;
    case 'name': return (card.name || card.id).charAt(0).toUpperCase();
    default: return card.deck;
  }
}

const groupKey = (card, sort) => {
  const v = axis(card, sort);
  return v === null ? `deck:${card.deck}` : `${sort}:${v}`;
};

function groupLabel(key) {
  const cut = key.indexOf(':');
  const name = key.slice(0, cut), v = key.slice(cut + 1);
  switch (name) {
    case 'deck': return t(`cards.deck.${v}`);
    case 'element': return v === 'none' ? t('cards.element.none') : cap(v);
    case 'tier': return `${t('cards.tier._')} ${v}`;
    case 'class': return v === 'none' ? t('cards.klass.none') : cap(v);
    case 'check': return t(`cards.check.${v}`);
    case 'damage': return `${t('cards.corner.damage')} ${v}`;
    default: return v;             // the name sort groups by initial, which is its own label
  }
}

/** Distinct real values of an axis in a list (the 'none' bucket is placed by hand). */
const values = (list, sort, cmp) => [...new Set(list.map((c) => axis(c, sort)).filter((v) => v !== null && v !== 'none'))].sort(cmp);
const num = (a, b) => Number(a) - Number(b);
const alpha = (a, b) => a.localeCompare(b);
/** Biggest hitter first. All In deals "4x bet", which has no fixed number to rank, so it sits last. */
const byDamage = (a, b) => {
  const na = Number(a), nb = Number(b);
  if (Number.isNaN(na) || Number.isNaN(nb)) return Number.isNaN(na) ? 1 : -1;
  return nb - na;
};

/**
 * The headings a sort produces, in order, followed by the deck headings that
 * catch the cards the axis does not describe. Values the data decides (which
 * tiers exist, which damage numbers) are read off the list; orders that meaning
 * decides (deck order, the element order, the risk ramp) are written here.
 */
function orderedKeys(sort, list) {
  const key = (v) => `${sort}:${v}`;
  let keys;
  switch (sort) {
    case 'deck': return DECKS.map((d) => `deck:${d}`);
    case 'element': keys = [...ELEMENTS, 'none'].map(key); break;
    case 'tier': keys = values(list, 'tier', num).map(key); break;
    case 'class': keys = [...values(list, 'class', alpha), 'none'].map(key); break;
    // The risk ramp, rising. "always lands" is its bottom rung and belongs
    // first, which is why check is the one axis whose 'none' is not last.
    case 'check': keys = ['none', ...CHECKS].map(key); break;
    case 'damage': keys = values(list, 'damage', byDamage).map(key); break;
    case 'name': keys = values(list, 'name', alpha).map(key); break;
    default: keys = [];
  }
  return [...keys, ...DECKS.map((d) => `deck:${d}`)];
}

/** Group a list into `[{ key, label, cards, copies }]`, empty groups dropped. */
export function groupCards(list, sort) {
  const bucket = new Map();
  for (const c of list) {
    const k = groupKey(c, sort);
    if (!bucket.has(k)) bucket.set(k, []);
    bucket.get(k).push(c);
  }
  const take = (k, cards) => {
    // Inside a group: alphabetical under the name sort, because that is what the
    // reader is scanning. Everything else keeps cards.json order, which is a
    // designed order and has no reason to be disturbed on screen.
    if (sort === 'name') cards.sort((a, b) => alpha(a.name, b.name));
    return { key: k, label: groupLabel(k), cards, copies: copiesOf(cards) };
  };
  const out = [];
  for (const k of orderedKeys(sort, list)) {
    const cards = bucket.get(k);
    if (!cards || !cards.length) continue;
    out.push(take(k, cards));
    bucket.delete(k);
  }
  // A key orderedKeys did not predict (a fifth element in cards.json, say) is
  // still shown rather than silently dropped.
  for (const [k, cards] of bucket) out.push(take(k, cards));
  return out;
}

// ── Filtering ────────────────────────────────────────────────
const matchesAxis = (card, sort, want) => want === 'all' || axis(card, sort) === String(want);

/**
 * Every card the grid should show: the deck chips and the three axis chips
 * AND-ed together. Filtering and grouping share axis(), so a chip can never
 * select a value no heading would show.
 */
export function filterCards(data, s) {
  const b = s.browse;
  return allCards(data).filter((c) => (s.deckFilter === 'all' || c.deck === s.deckFilter)
    && matchesAxis(c, 'element', b.element)
    && matchesAxis(c, 'tier', b.tier)
    && matchesAxis(c, 'class', b.klass));
}

/** A copy of the state with one chip changed, for the facet counts on the chips. */
function patched(s, key, value) {
  if (key === 'deck') return { ...s, deckFilter: value };
  const field = { element: 'element', tier: 'tier', class: 'klass' }[key];
  return { ...s, browse: { ...s.browse, [field]: value } };
}

// ── Rendering ────────────────────────────────────────────────
function chipRow({ label, action, dataKey, current, options, count }) {
  const id = `fl-${dataKey}`;
  const chips = options.map(({ value, label: text, colour }) => {
    const on = String(current) === String(value);
    const style = colour ? ` style="--chip:${colour}"` : '';
    const dot = colour ? '<span class="dot"></span>' : '';
    return `<button class="chip" data-action="${action}" data-${dataKey}="${escHtml(String(value))}" aria-pressed="${on}"${style}>${dot}${escHtml(text)} <span class="muted">${count(value)}</span></button>`;
  }).join('');
  return `<div class="filter-row">
      <span class="filter-row__label" id="${id}">${escHtml(label)}</span>
      <div class="chips" role="group" aria-labelledby="${id}">${chips}</div>
    </div>`;
}

/**
 * The print controls, and the sentence that keeps a reader from assuming the
 * sheet follows the screen. Deliberately NOT inside the sticky toolbar: at
 * 390px the print button, both segmented controls and that sentence wrapped
 * onto four lines and pushed the sticky block to 385px, which is half a phone.
 * Printing is a decision you make once, so it scrolls away; sorting and
 * filtering is what you reach for while scanning a long grid, so that sticks.
 */
function printRow(s) {
  return `<div class="cards-print">
      <button class="btn btn--primary" data-action="cards-print">${glyphSvg('dice', '', 16)} ${escHtml(t('cards.printAll'))}</button>
      ${s.deckFilter !== 'all' ? `<button class="btn" data-action="cards-print-deck" data-deck="${escHtml(s.deckFilter)}">${escHtml(t('cards.printDeck'))}</button>` : ''}
      <span class="seg" role="group" aria-label="${escHtml(t('cards.paper'))}">
        <button data-action="cards-paper" data-paper="a4" aria-pressed="${s.paper === 'a4'}">${escHtml(t('cards.a4'))}</button>
        <button data-action="cards-paper" data-paper="letter" aria-pressed="${s.paper === 'letter'}">${escHtml(t('cards.letter'))}</button>
      </span>
      <span class="seg" role="group" aria-label="${escHtml(t('cards.backs._'))}">
        ${['none', 'few', 'all'].map((k) => `<button data-action="cards-print-backs" data-backs="${k}" aria-pressed="${(s.withBacks || 'none') === k}">${escHtml(t(`cards.backs.${k}`))}</button>`).join('')}
      </span>
      <span class="small muted cards-print__note">${escHtml(t('cards.printOrder'))}</span>
    </div>`;
}

function toolbar(data, s) {
  const b = s.browse;
  const count = (key) => (value) => copiesOf(filterCards(data, patched(s, key, value)));
  const opt = (value, label, colour) => ({ value, label, colour });

  const deckRow = chipRow({
    label: t('cards.sort.deck'), action: 'cards-deck', dataKey: 'deck', current: s.deckFilter, count: count('deck'),
    options: [opt('all', t('cards.filterAll')), ...DECKS.map((d) => opt(d, t(`cards.deck.${d}`), DECK_CHIP[d] || '#111'))],
  });
  const elementRow = chipRow({
    label: t('cards.element._'), action: 'cards-element', dataKey: 'element', current: b.element, count: count('element'),
    options: [opt('all', t('cards.element.all')), ...ELEMENTS.map((e) => opt(e, cap(e), `var(--${e})`)), opt('none', t('cards.element.none'))],
  });
  const tierRow = chipRow({
    label: t('cards.tier._'), action: 'cards-tier', dataKey: 'tier', current: b.tier, count: count('tier'),
    options: [opt('all', t('cards.tier.all')), ...values(allCards(data), 'tier', num).map((n) => opt(n, `${t('cards.tier._')} ${n}`))],
  });
  const classRow = chipRow({
    label: t('cards.klass._'), action: 'cards-class', dataKey: 'class', current: b.klass, count: count('class'),
    options: [opt('all', t('cards.klass.all')), ...values(allCards(data), 'class', alpha).map((k) => opt(k, cap(k), FACE.violet)), opt('none', t('cards.klass.none'))],
  });

  // Anything the reader changed, so Clear is offered only when there is
  // something to clear. The deck chips count as a filter row here, so Clear
  // clears them too; the backs toggle does not, it is a display mode.
  const dirty = b.sort !== 'deck' || b.element !== 'all' || b.tier !== 'all' || b.klass !== 'all' || s.deckFilter !== 'all';

  return `<div class="cards-toolbar">
      <div class="cards-toolbar__row">
        <label class="field field--inline">
          <span>${escHtml(t('cards.sort._'))}</span>
          <select data-change="cards-sort" aria-label="${escHtml(t('cards.sort._'))}">
            ${SORTS.map((k) => `<option value="${k}"${b.sort === k ? ' selected' : ''}>${escHtml(t(`cards.sort.${k}`))}</option>`).join('')}
          </select>
        </label>
        <button class="btn" data-action="cards-backs" aria-pressed="${!!b.backs}">${escHtml(t(b.backs ? 'cards.showFaces' : 'cards.showBacks'))}</button>
        ${dirty ? `<button class="btn btn--ghost" data-action="cards-reset">${escHtml(t('cards.reset'))}</button>` : ''}
      </div>
      <div class="cards-filters">${deckRow}${elementRow}${tierRow}${classRow}</div>
    </div>`;
}

/** One cell: the face, or the back when the grid is flipped. The name is chrome, never printed on the card. */
function cell(c, aid, backs) {
  // size 'browse' on the back too, so a flipped grid scales exactly like the
  // faces it replaced. 'sheet' is millimetres and would print-size it on screen.
  const art = backs ? cardBack(backKind(c), { size: 'browse' }) : cardFace(c, { size: 'browse', aid });
  const copies = (c.copies || 1) > 1 ? ` <span class="copies">×${c.copies}</span>` : '';
  return `<button class="card-btn" data-action="cards-detail" data-id="${escHtml(c.id)}" aria-label="${escHtml(c.name)}">
        ${art}
        <span>${escHtml(c.name)}${copies}</span>
      </button>`;
}

export function renderCards(s) {
  const data = s.cards;
  const aid = aidFor(data);
  const list = filterCards(data, s);
  const groups = groupCards(list, s.browse.sort);

  const body = groups.length
    ? groups.map((g) => `<section aria-labelledby="grp-${escHtml(g.key)}">
      <div class="deck-head"><h3 id="grp-${escHtml(g.key)}">${escHtml(g.label)}</h3><span>${g.copies} ${escHtml(t('cards.copies'))}</span></div>
      <div class="deck-grid">${g.cards.map((c) => cell(c, aid, s.browse.backs)).join('')}</div>
    </section>`).join('')
    : `<div class="panel cards-empty">
      <p>${escHtml(t('cards.empty'))}</p>
      <button class="btn" data-action="cards-reset">${escHtml(t('cards.reset'))}</button>
    </div>`;

  const artNote = artCount()
    ? `${artCount()} attributed icons from the manifest; the rest are ${t('common.placeholder')}.`
    : `Every face is ${t('common.placeholder')}, drawn in-house by slot id. Drop an attributed SVG into <code>art/</code> and it takes over.`;

  return `
  <div class="container container--wide stack">
    <header class="stack stack--tight">
      <p class="kicker">${escHtml(t('cards.title'))}</p>
      <p class="panel__lead">${escHtml(t('cards.lead'))}</p>
      <p class="small muted">${artNote}</p>
    </header>
    ${printRow(s)}
    ${toolbar(data, s)}
    ${body}
  </div>`;
}

// ── Printing ─────────────────────────────────────────────────
/**
 * The cards the print sheet gets, in the ONE order it ever gets them:
 * data.physical, which data/cards.js builds by walking cards.json deck by deck
 * and expanding copies. state.browse is not read here and must never be. A deck
 * argument narrows the sheet (the Print this deck button) and even then keeps
 * cards.json order inside that deck.
 */
export function printOrder(s, deck = null) {
  const physical = s.cards.physical;
  return deck ? physical.filter((c) => c.deck === deck) : physical;
}

/** Fill the print root and open the browser's print dialog. */
export function printCards(s, deck = null) {
  const pages = renderPrintSheet(printOrder(s, deck), { backs: s.withBacks, paper: s.paper, aid: aidFor(s.cards) });
  // Give the browser one frame to lay the sheet out before the dialog snapshots it.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  return pages;
}

// ── The detail sheet ─────────────────────────────────────────
const CHECK_LABEL = (c) => (c ? t(`cards.check.${c}`) : t('cards.check.none'));

/** The tap-to-reveal panel: the name, the back, and what the face does not say. */
export function showCardDetail(s, id) {
  const c = s.cards.byId[id];
  if (!c) return;
  const aid = aidFor(s.cards);
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push(`<dt>${escHtml(t(`cards.corner.${k}`))}</dt><dd>${v}</dd>`); };
  if (c.deck === 'attack' || c.deck === 'skill') {
    add('actions', c.actions);
    add('bet', c.bet === 'any' ? 'any number of Ready cards' : c.bet === 0 ? 'none' : `${c.bet} life card${c.bet > 1 ? 's' : ''}`);
    add('check', escHtml(CHECK_LABEL(c.check)));
    add('damage', c.damage === '4x bet' ? '4 × what you bet' : c.damage);
    add('tier', c.tier);
    if (c.element) add('element', escHtml(cap(c.element)));
    if (c.class) add('class', `${escHtml(cap(c.class))} only`);
  } else if (c.deck === 'class') add('passive', escHtml(c.passive));
  else if (c.deck === 'advantage') { add('effect', escHtml(c.effect)); add('copies', c.copies); }
  else if (c.deck === 'boss') {
    add('size', c.size); add('life', `${c.life_cards} × ${c.per_card} = ${c.hp}`); add('damage', c.damage);
    if (c.rage) add('rage', c.rage); if (c.note) add('rule', escHtml(c.note));
  } else if (c.deck === 'biome') { if (c.element) add('element', escHtml(cap(c.element))); if (c.rule) add('rule', escHtml(c.rule)); }
  else if (c.deck === 'life') { add('value', typeof c.value === 'number' ? c.value : escHtml(String(c.value))); add('copies', c.copies); if (c.element) add('element', escHtml(cap(c.element))); }
  else if (c.deck === 'aid') add('rule', escHtml(c.content));
  add('icon', `<code>${escHtml(c.icon || 'none')}</code>`);

  const say = (c.deck === 'attack' || c.deck === 'skill')
    ? `<div class="say">${escHtml(t('common.sayIt'))}: <b>${escHtml(c.name)}</b></div>` : '';
  document.getElementById('cardModalTitle').textContent = c.name;
  // Face and back together, because until now the redesigned back existed only
  // on the print sheet and nothing on screen ever showed one.
  document.getElementById('cardModalBody').innerHTML = `
    <div class="card-detail">
      <div class="card-detail__art">
        <figure>${cardFace(c, { size: 'browse', aid })}<figcaption>${escHtml(t('cards.face'))}</figcaption></figure>
        <figure>${cardBack(backKind(c), { size: 'browse' })}<figcaption>${escHtml(t('cards.back'))}</figcaption></figure>
      </div>
      <div>
        <p class="kicker">${escHtml(t(`cards.deck.${c.deck}`))}</p>
        <h3>${escHtml(c.name)}</h3>
        <dl>${rows.join('')}</dl>
        ${say}
      </div>
    </div>`;
  openModal('cardModal');
}

// ── Actions ──────────────────────────────────────────────────
/** Returns true when the view must re-render. See the seam contract in events.js. */
export function onCardsAction(s, act, el, e) {
  const b = s.browse;
  switch (act) {
    // Two ways in: a <select> (the toolbar) hands over el.value, a button hands
    // over data-sort. An unknown key falls back to the boxed order rather than
    // grouping by a key nothing can render.
    case 'sort': { const v = el.dataset.sort || el.value; b.sort = SORTS.includes(v) ? v : 'deck'; return true; }
    case 'element': b.element = el.dataset.element; return true;
    case 'tier': b.tier = el.dataset.tier; return true;
    case 'class': b.klass = el.dataset.class; return true;
    case 'backs': b.backs = !b.backs; return true;
    // Clear means clear: the deck chips read as one more filter row, so they go
    // back to 'all' too. b.backs is a display mode and is left alone.
    case 'reset': b.element = 'all'; b.tier = 'all'; b.klass = 'all'; b.sort = 'deck'; s.deckFilter = 'all'; return true;
    case 'deck': s.deckFilter = el.dataset.deck; return true;
    case 'detail': showCardDetail(s, el.dataset.id); return false;
    // The print controls. `backs` above is the screen toggle and `print-backs`
    // here is how many backs the sheet gets: one letter apart when they were
    // `backs` and `withBacks` in two different files, which is why both now
    // answer to this one handler where the difference is readable.
    case 'paper': s.paper = el.dataset.paper; return true;
    case 'print-backs': s.withBacks = el.dataset.backs; return true;
    // t() does not interpolate (js/strings.js), so the count is composed here.
    case 'print': { const n = printCards(s); showToast(`${n} sheet${n === 1 ? '' : 's'}`); return false; }
    case 'print-deck': { const n = printCards(s, el.dataset.deck); showToast(`${n} sheet${n === 1 ? '' : 's'}`); return false; }
    default: return false;
  }
}
