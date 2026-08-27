// ── Cards view ───────────────────────────────────────────────
// Browse the 90 cards by deck, tap one to learn its name and what it does
// (the face never says), and print all of them or one deck.

import { state, save } from '../state.js';
import { t } from '../strings.js';
import { escHtml } from '../utils.js';
import { DECKS } from '../data/cards.js';
import { cardFace, FACE } from '../cards/face.js';
import { glyphSvg, artCount } from '../cards/glyphs.js';
import { renderPrintSheet } from '../cards/sheet.js';
import { ladderForAid } from '../game/rules.js';
import { openModal } from '../events.js';

const DECK_CHIP = { attack: '#111', skill: '#111', class: FACE.violet, advantage: FACE.gold, boss: '#111', biome: FACE.brown, life: FACE.fire, aid: '#625c52' };

function deckCards(data, deck) {
  return (data[deck] || []);
}

export function renderCards(s) {
  const data = s.cards;
  const decks = s.deckFilter === 'all' ? DECKS : [s.deckFilter];
  const aid = { ladder: ladderForAid(data) };
  const total = data.physical.length;

  const chips = ['all', ...DECKS].map((d) => {
    const on = s.deckFilter === d;
    const label = d === 'all' ? t('cards.filterAll') : t(`cards.deck.${d}`);
    const n = d === 'all' ? total : deckCards(data, d).reduce((a, c) => a + (c.copies || 1), 0);
    return `<button class="chip" data-action="deck-filter" data-deck="${d}" aria-pressed="${on}" style="--chip:${DECK_CHIP[d] || '#111'}"><span class="dot"></span>${escHtml(label)} <span class="muted">${n}</span></button>`;
  }).join('');

  const groups = decks.map((deck) => {
    const list = deckCards(data, deck);
    if (!list.length) return '';
    const n = list.reduce((a, c) => a + (c.copies || 1), 0);
    const grid = list.map((c) => `
      <button class="card-btn" data-action="card-detail" data-id="${escHtml(c.id)}" aria-label="${escHtml(c.name)}">
        ${cardFace(c, { size: 'browse', aid })}
        <span>${escHtml(c.name)}${(c.copies || 1) > 1 ? ` <span class="copies">×${c.copies}</span>` : ''}</span>
      </button>`).join('');
    return `<section aria-labelledby="deck-${deck}">
      <div class="deck-head"><h3 id="deck-${deck}">${escHtml(t(`cards.deck.${deck}`))}</h3><span>${n} ${t('cards.copies')}</span></div>
      <div class="deck-grid">${grid}</div>
    </section>`;
  }).join('');

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
    <div class="cards-toolbar">
      <div class="chips" role="group" aria-label="Deck">${chips}</div>
      <div class="row">
        <button class="btn btn--primary" data-action="print-all">${glyphSvg('dice', '', 16)} ${escHtml(t('cards.printAll'))}</button>
        ${s.deckFilter !== 'all' ? `<button class="btn" data-action="print-deck" data-deck="${s.deckFilter}">${escHtml(t('cards.printDeck'))}</button>` : ''}
        <span class="seg" role="group" aria-label="${escHtml(t('cards.paper'))}">
          <button data-action="paper" data-paper="a4" aria-pressed="${s.paper === 'a4'}">${t('cards.a4')}</button>
          <button data-action="paper" data-paper="letter" aria-pressed="${s.paper === 'letter'}">${t('cards.letter')}</button>
        </span>
        <button class="chip" data-action="toggle-backs" aria-pressed="${s.withBacks}"><span class="dot" style="--chip:#1c1917"></span>${escHtml(t('cards.backs'))}</button>
      </div>
    </div>
    ${groups}
  </div>`;
}

/** Fill the print root and open the browser's print dialog. */
export function printCards(s, deck = null) {
  const data = s.cards;
  const physical = deck ? data.physical.filter((c) => c.deck === deck) : data.physical;
  const pages = renderPrintSheet(physical, { backs: s.withBacks, paper: s.paper, aid: { ladder: ladderForAid(data) } });
  // Give the browser one frame to lay the sheet out before the dialog snapshots it.
  requestAnimationFrame(() => requestAnimationFrame(() => window.print()));
  return pages;
}

const CHECK_LABEL = (c) => c ? t(`cards.check.${c}`) : t('cards.check.none');

/** The tap-to-reveal panel: the name and what the face does not say. */
export function showCardDetail(s, id) {
  const c = s.cards.byId[id];
  if (!c) return;
  const aid = { ladder: ladderForAid(s.cards) };
  const rows = [];
  const add = (k, v) => { if (v !== undefined && v !== null && v !== '') rows.push(`<dt>${escHtml(t(`cards.corner.${k}`))}</dt><dd>${v}</dd>`); };
  if (c.deck === 'attack' || c.deck === 'skill') {
    add('actions', c.actions);
    add('bet', c.bet === 'any' ? 'any number of Ready cards' : c.bet === 0 ? 'none' : `${c.bet} life card${c.bet > 1 ? 's' : ''}`);
    add('check', escHtml(CHECK_LABEL(c.check)));
    add('damage', c.damage === '3x bet' ? '3 × what you bet' : c.damage);
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
  document.getElementById('cardModalBody').innerHTML = `
    <div class="card-detail">
      <div>${cardFace(c, { size: 'browse', aid })}</div>
      <div>
        <p class="kicker">${escHtml(t(`cards.deck.${c.deck}`))}</p>
        <h3>${escHtml(c.name)}</h3>
        <dl>${rows.join('')}</dl>
        ${say}
      </div>
    </div>`;
  openModal('cardModal');
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
