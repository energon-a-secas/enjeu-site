// ── Learn view ───────────────────────────────────────────────
// A horizontal slide deck, not a page: the cover, one walkthrough step per
// slide (data/walkthrough.js), the dice bridge, then the whole rulebook
// (RULES.md or RULES.es.md fetched and rendered, the canonical text in the
// language the reader picked) as the last slide.
// The page itself never scrolls; only the rulebook slide scrolls, inside
// itself. css/learn.css claims the viewport through html[data-view="learn"].

import { state, save } from '../state.js';
import { t, getLang, cardName } from '../strings.js';
import { escHtml, renderMarkdown } from '../utils.js';
import { cardFace, cardBack, lifeMini, riskDots, FACE } from '../cards/face.js';
import { glyphSvg, glyphPath, GLYPH_SIZE } from '../cards/glyphs.js';
import { ladderTable, fidelity, DICE } from '../game/rules.js';
import { STEPS, REACTIONS, TURN, COPY } from '../data/walkthrough.js';
import { DECKS } from '../data/cards.js';
import { figureSvg } from '../game/figures.js';
import { BOSSES, heroFor } from '../data/placeholders.js';

/**
 * The rulebook, one entry per language. RULES.md and RULES.es.md are the same
 * document twice, same headings, same tables, same section numbers, so the
 * citations on every step slide land on the same section whichever one is open.
 *
 * Keyed by language rather than held in one variable because switching language
 * has to switch the rulebook, and a single cache would keep serving the first
 * one fetched. Each is fetched once and kept: going back is free.
 */
const rulebookHtml = {};
const rulebookLoading = new Set();
function ensureRulebook() {
  // Guarded so the whole deck can be rendered to a string under `node` (see
  // tests/learn.test.mjs): there is no document to repaint and no base URL to
  // fetch the rulebook against, and an unguarded fetch would reject into a
  // ReferenceError inside .finally() and take the test process with it.
  if (typeof document === 'undefined' || typeof fetch !== 'function') return;
  const lang = getLang();
  if (rulebookHtml[lang] || rulebookLoading.has(lang)) return;
  rulebookLoading.add(lang);
  const file = t('learn.rulebookFile');
  const fail = t('learn.rulebookFail');
  fetch(file).then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .then((md) => { rulebookHtml[lang] = renderMarkdown(md); })
    .catch(() => { rulebookHtml[lang] = `<p class="muted">${escHtml(fail)}</p>`; })
    .finally(() => { rulebookLoading.delete(lang); document.dispatchEvent(new CustomEvent('enjeu:rerender')); });
}

/**
 * ── The deck ─────────────────────────────────────────────────
 * Learn is a slide deck, not a page: one walkthrough step per slide, then the
 * dice bridge, then the whole rulebook as the last slide (it scrolls inside
 * itself, and the page around it never does). The count lives here because both
 * the rail and the key handler need it and neither owns it.
 */
export const SLIDE_PLAY = STEPS.length;   // unnumbered: the invitation, not a lesson
export const SLIDE_DICE = STEPS.length + 1;
export const SLIDE_RULEBOOK = STEPS.length + 2;
export const SLIDE_COUNT = STEPS.length + 3;
export const clampSlide = (n) => Math.max(0, Math.min(SLIDE_COUNT - 1, Number(n) || 0));

/** Deep-link slugs, one per slide: #/learn/<slug>. Derived, never a second list. */
export const SLIDE_SLUGS = [...STEPS.map((st) => st.id), 'play-now', 'dice', 'rulebook'];
/** The slide a slug opens, or -1. */
export const slideForSlug = (slug) => SLIDE_SLUGS.indexOf(String(slug || ''));
/**
 * Rail labels: the step's own title, then the two closing slides. A function and
 * not a const: the last two come from the string table, and a const evaluated at
 * module load froze them in whatever language the page started in.
 */
const slideTitles = () => [...STEPS.map((st) => st.title), t('learn.slide.playNow'), t('learn.slide.dice'), t('learn.slide.rulebook')];
/**
 * Which chapter each slide sits in, derived from the steps the same way the
 * titles are. The two closing slides are Advanced: the full eight-die bridge and
 * the rulebook are reference, and neither is needed to finish a first fight.
 */
export const SLIDE_CHAPTERS = [...STEPS.map((st) => st.chapter || 'advanced'), 'try', 'reference', 'reference'];
/** The last slide of Basics: the one that tells the reader they can stop there. */
export const LAST_BASIC = SLIDE_CHAPTERS.lastIndexOf('basics');

/** Move the deck and repaint, for the handlers that are not the click seam. */
function goSlide(to) {
  const next = clampSlide(to);
  if (next === state.learnStep) return;
  state.learnStep = next;
  save(state);
  // learn.js cannot import render.js (render.js imports this file), so the
  // repaint goes through the event events.js already listens for.
  document.dispatchEvent(new CustomEvent('enjeu:rerender'));
}

// ── Touch: one horizontal swipe, one slide ────────────────────
// Installed ONCE for the life of the page. The deck's markup is replaced on
// every slide change, so a listener bound after each render would pile up one
// per slide seen. Mouse drags are left alone: they select text.
let gesturesOn = false, downX = 0, downY = 0, downOk = false;
function installGestures() {
  if (gesturesOn || typeof document === 'undefined') return;
  gesturesOn = true;
  document.addEventListener('pointerdown', (e) => {
    downOk = state.view === 'learn' && e.isPrimary && e.pointerType !== 'mouse'
      && !!e.target?.closest?.('.deck__stage');
    downX = e.clientX; downY = e.clientY;
  }, { passive: true });
  document.addEventListener('pointerup', (e) => {
    if (!downOk) return;
    downOk = false;
    const dx = e.clientX - downX, dy = e.clientY - downY;
    // Sideways and deliberate, or the rulebook's own vertical scroll would
    // flick the reader off the slide.
    if (Math.abs(dx) < 48 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
    goSlide(state.learnStep + (dx < 0 ? 1 : -1));
  }, { passive: true });
}

/**
 * A deep link wins over the saved slide, exactly once. The param is consumed
 * here (as render.js does for #/cards/<deck>) because leaving it set would snap
 * every later Next back to the linked slide.
 */
function openSlide(s) {
  if (s.param) {
    const i = slideForSlug(s.param);
    if (i !== -1) s.learnStep = i;
    s.param = null;
  }
  s.learnStep = clampSlide(s.learnStep);
  syncHash(s.learnStep);
  return s.learnStep;
}

/**
 * Write the URL, never assign to location.hash: assigning fires hashchange,
 * which renders the view a second time. A hash that is not ours (a rulebook
 * anchor, #rb-the-boss) is left exactly as the reader followed it.
 */
function syncHash(i) {
  if (typeof location === 'undefined' || typeof history === 'undefined') return;
  const h = location.hash;
  if (h && h !== '#' && !/^#\/?learn(\/|$)/.test(h)) return;
  const want = i === 0 ? '#/learn' : `#/learn/${SLIDE_SLUGS[i]}`;
  if (h === want) return;
  history.replaceState(null, '', want);
}

// ── Teaching visuals ─────────────────────────────────────────
// Every one takes the state it reads, so a slide can be rendered to a string
// without the module singleton being set up first.

function heroArt(s) {
  const h = heroFor(s.element || 'fire');
  const b = BOSSES[0];
  return `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="a hero figure faces a brick boss, with life cards between them">
    <g transform="translate(10 40) scale(1.1)">${figureSvg(h).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(200 10) scale(1.5)">${figureSvg(b).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(140 118) scale(0.09)">${lifeMini(h.element).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <!-- The second card is Spent: turned sideways, the game's own gesture. The
         rotation has to come AFTER the scale, or its centre (315 440, in card
         units) is scaled with it and the card lands off the viewBox, which is
         exactly what the first version of this drawing did. -->
    <g transform="translate(152 34) scale(0.09) rotate(90 315 440)">${lifeMini(h.element).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
  </svg>`;
}

function statesVisual(s) {
  const el = s.element || 'fire';
  const c = s.cards.byId[`life-${el}`];
  const face = cardFace(c, { size: 'hand' });
  // Broken is the printed BACK of the card, from face.js, because that is what
  // the player is looking at on the table. A mirrored face would teach a card
  // the printer never makes.
  const art = [face, face, cardBack(el, { size: 'hand' })];
  const cls = ['', ' state--spent', ' state--broken'];
  return `<div class="states">${COPY.states.map((st, i) => `
    <div class="state${cls[i]}"><div class="state__face">${art[i]}</div><h4>${escHtml(st.name)}</h4><p>${escHtml(st.note)}</p></div>`).join('')}
  </div>`;
}

function attacksVisual(s) {
  // Derived from data.attack, never listed here. This slide's copy already says
  // five cards; a hardcoded trio drew three of them next to that sentence, which
  // is the same defect run.js records having shipped once when Bubble was added
  // and no hand ever dealt it.
  const deck = s.cards.attack.map((c) => c.id);
  const wide = deck.length > 4 ? ' action-cards--wide' : '';
  return `<div class="action-cards action-cards--${deck.length === 4 ? 'four' : deck.length === 3 ? 'three' : 'five'}${wide}">${deck.map((id) => {
    const c = s.cards.byId[id];
    return `<button type="button" class="action-card" data-action="cards-detail" data-id="${c.id}" data-inspect="${c.id}">${cardFace(c, { size: 'hand' })}<span>${escHtml(cardName(c))}</span></button>`;
  }).join('')}</div>`;
}

function turnVisual() {
  return `<div class="strip strip--four">${TURN.map((s, i) => `
    <div class="strip__cell">${glyphSvg(s.glyph, '', 36)}<b>${i + 1}. ${escHtml(s.name)}</b><span>${escHtml(s.note)}</span></div>`).join('')}</div>`;
}

/**
 * The name of a check step. It used to be the raw id with its first letter
 * raised ('sure' -> 'Sure'), which is a name in exactly one language; the ladder
 * has its own four words in each, so the table is asked instead.
 */
const stepName = (step) => t(`cards.step.${step}`);

/** The four checks, on the same traffic light the card prints (face.js riskDots). */
function checkLegend() {
  return `<div class="checks">${[['sure', 75], ['even', 50], ['hard', 25], ['wild', 15]].map(([step, odds]) => `
    <span class="checks__item">${riskDots(step)}<b>${escHtml(stepName(step))}</b><i>${odds}%</i></span>`).join('')}</div>`;
}

/**
 * The check, as the step slide teaches it: the ramp, and the number for the
 * ONE die the reader owns. All eight dice are the dice-bridge slide's job; the
 * full table in half a slide scrolls sideways and shows a single column.
 */
function checksVisual(s) {
  const { rows } = ladderTable(s.cards.ladder);
  const die = s.die && DICE.includes(s.die) ? s.die : 'd20';
  return `${checkLegend()}
  <div class="table-wrap"><table class="ladder">
    <thead><tr><th>${escHtml(t('learn.step'))}</th><th>${escHtml(t('learn.odds'))}</th><th>${escHtml(die)}</th></tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${riskDots(r.step)} ${escHtml(stepName(r.step))}</td><td>${r.odds}%</td><td class="is-mine">${r.targets[die]}+</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">${escHtml(COPY.yourDie.replace('{die}', die))}</p>`;
}

/** The whole bridge: four steps by eight dice, for the dice slide. */
function ladderVisual(s) {
  const { rows } = ladderTable(s.cards.ladder);
  const die = s.die && DICE.includes(s.die) ? s.die : 'd20';
  return `${checkLegend()}
  <div class="table-wrap"><table class="ladder">
    <thead><tr><th>${escHtml(t('learn.step'))}</th><th>${escHtml(t('learn.odds'))}</th>${DICE.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${riskDots(r.step)} ${escHtml(stepName(r.step))}</td><td>${r.odds}%</td>${DICE.map((d) => `<td class="${d === die ? 'is-mine' : ''}">${r.targets[d]}+</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">${escHtml(COPY.yourColumn.replace('{die}', die))}</p>`;
}

function reactionsVisual() {
  return `<div class="strip">${REACTIONS.map((r) => `
    <div class="strip__cell"><span class="strip__die" aria-hidden="true">${r.roll}</span>${glyphSvg(r.glyph, '', 28)}<b>${escHtml(r.name)}</b><span>${escHtml(r.note)}</span></div>`).join('')}</div>`;
}

/**
 * One snapshot of the Damage Track: the four bands, the brick standing on the
 * current total, and the die that counts hundreds. It is drawn here rather than
 * reusing the printed aid card (face.js) because the card is deliberately empty:
 * it has nowhere to show a brick, since on the table the brick is a brick.
 */
function trackSnap(mark, hundreds, label) {
  const w = 50, gap = 7, boxes = [25, 50, 75, 100];
  const dieX = boxes.length * (w + gap) + 8;
  let out = `<svg class="track__snap" viewBox="0 0 ${dieX + 46} 60" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escHtml(label)}">`;
  boxes.forEach((n, i) => {
    const x = i * (w + gap), on = n === mark;
    out += `<rect x="${x}" y="14" width="${w}" height="42" rx="7" fill="${on ? FACE.gold : '#fffdf7'}" stroke="#57534e" stroke-width="2"/>`;
    out += `<text x="${x + w / 2}" y="43" text-anchor="middle" font-size="19" font-weight="800" fill="#1c1917">${n}</text>`;
    // The brick, two studs and all, sitting ON the band rather than inside it:
    // that is the gesture the card asks for and a filled box alone did not read
    // as a piece you move.
    if (on) {
      out += `<rect x="${x + 9}" y="2" width="${w - 18}" height="13" rx="3" fill="#b91c1c"/>`;
      out += `<circle cx="${x + w / 2 - 7}" cy="1" r="4" fill="#b91c1c"/><circle cx="${x + w / 2 + 7}" cy="1" r="4" fill="#b91c1c"/>`;
    }
  });
  out += `<rect x="${dieX}" y="14" width="42" height="42" rx="7" fill="#fdf3d3" stroke="#a16207" stroke-width="2"/>`;
  out += `<text x="${dieX + 21}" y="11" text-anchor="middle" font-size="11" font-weight="700" fill="#a16207">×100</text>`;
  if (hundreds) out += `<text x="${dieX + 21}" y="45" text-anchor="middle" font-size="21" font-weight="800" fill="#78350f">${hundreds}</text>`;
  return out + '</svg>';
}

/** The track worked through, one row per deal, in the rulebook's own sequence. */
function trackVisual() {
  return `<ol class="track">${COPY.track.map((st) => `
    <li class="track__row">
      <b class="track__deal">${escHtml(st.deal)}</b>
      ${trackSnap(st.mark, st.hundreds, `${st.deal}: ${st.note}`)}
      <span class="track__note">${escHtml(st.note)}</span>
    </li>`).join('')}</ol>`;
}

function cycleVisual(s) {
  const cyc = s.cards.element_cycle;            // water beats fire, fire beats wind, wind beats earth, earth beats water
  const pos = { water: [160, 30], fire: [290, 120], wind: [160, 210], earth: [30, 120] };
  const col = { fire: FACE.fire, water: FACE.water, earth: FACE.earth, wind: FACE.wind };
  let out = `<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="the element cycle"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="#1c1917"/></marker></defs>`;
  for (const [a, b] of Object.entries(cyc)) {
    if (a.startsWith('$') || !pos[a] || !pos[b]) continue;   // cards.json keeps a $note beside the four pairs
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    out += `<line x1="${x1 + ux * 34}" y1="${y1 + uy * 34}" x2="${x2 - ux * 36}" y2="${y2 - uy * 36}" stroke="#1c1917" stroke-width="3" marker-end="url(#arr)"/>`;
  }
  for (const [el, [x, y]] of Object.entries(pos)) {
    out += `<circle cx="${x}" cy="${y}" r="28" fill="${col[el]}"/>`;
    const k = 36 / GLYPH_SIZE;
    out += `<g transform="translate(${x - 18} ${y - 18}) scale(${k})"><path d="${glyphPath(el)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return out + `</svg>`;
}

/**
 * The classes you pick from, and the five bosses behind them. Stacked, because
 * the visual owns one half of the slide and the elements drawing owns its own
 * slide: the two together were taller than the frame and the boss table lost
 * its last rows off the bottom.
 */
function levelsVisual(s) {
  const classes = s.cards.class.map((c) => `<button type="button" class="action-card" data-action="cards-detail" data-id="${c.id}" data-inspect="${c.id}">${cardFace(c, { size: 'hand' })}<span>${escHtml(cardName(c))}</span></button>`).join('');
  const camp = s.cards.boss.filter((b) => b.rage).map((b, i) => `<tr><td>${i + 1}</td><td>${b.size}</td><td>${b.life_cards} × ${b.per_card}</td><td>${b.damage}</td><td>${b.rage}</td></tr>`).join('');
  return `<div class="action-cards action-cards--four">${classes}</div>
  <div class="table-wrap"><table class="ladder ladder--tight">
    <thead><tr>${COPY.campaign.map((h) => `<th>${escHtml(h)}</th>`).join('')}</tr></thead>
    <tbody>${camp}</tbody>
  </table></div>`;
}

/**
 * What is in the box, as one count per deck and two ways in. A nine-row table
 * said the same thing and did not fit: the number is the only part being
 * compared, so it is a grid of cells and the total is one line of prose under it.
 *
 * The decks come from DECKS, not from a list written here. A hand-written list
 * left the Gentle mode card out, so nine cells summed to 91 under a caption
 * saying 92, which is the exact failure this slide exists to avoid.
 */
function componentsVisual(s) {
  return `<div class="strip strip--counts">${DECKS.map((d) => `
    <div class="strip__cell"><b>${(s.cards[d] || []).reduce((a, c) => a + (c.copies || 1), 0)}</b><span>${escHtml(t(`cards.deck.${d}`))}</span></div>`).join('')}</div>
  <p class="small muted">${escHtml(COPY.sheets.replace('{n}', s.cards.physical.length))}</p>
  <div class="row">
    <a class="btn btn--primary" href="#/cards">${escHtml(t('learn.ctaCards'))}</a>
    <a class="btn" href="#/play">${escHtml(t('learn.ctaPlay'))}</a>
  </div>
  <p class="small muted">${escHtml(t('play.placeholderNote'))}</p>`;
}

const VISUALS = { hero: heroArt, states: statesVisual, attacks: attacksVisual, turn: turnVisual, ladder: checksVisual, reactions: reactionsVisual, track: trackVisual, elements: cycleVisual, levels: levelsVisual, components: componentsVisual };
// A visual that is wider than it is tall gets the whole width of the slide, with
// the copy above it. Half a slide is about 470px: the boss's six reactions
// squeezed into that wrap to one word a line and the longest name spills out of
// its cell. Everything else reads better beside its copy than under it.
// The track is wide for the same reason: each of its three rows is a caption, a
// four-band drawing and a sentence on one line, and half a slide breaks that
// line in three places.
const WIDE = new Set(['reactions', 'track']);

// ── The slides ───────────────────────────────────────────────

const CHEV = {
  left: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M15 5l-7 7 7 7"/></svg>',
  right: '<svg class="chev" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" aria-hidden="true"><path d="M9 5l7 7-7 7"/></svg>',
};

/** The rules citation, as a jump to the rulebook slide rather than a dead label. */
const ruleLink = (rule) => `<button type="button" class="slide__rule" data-action="learn-step" data-step="${SLIDE_RULEBOOK}">${escHtml(t('learn.rulesRef'))}${escHtml(rule)}</button>`;

/**
 * Every slide is a paper panel that scrolls INSIDE itself and an inner block
 * centred with auto margins. The centring is on the inner block on purpose:
 * `justify-content: center` on the scroller itself makes the top of a too-tall
 * slide unreachable, while an auto margin collapses to zero and lets it scroll.
 */
const slideShell = (cls, id, inner) =>
  `<article class="slide ${cls}" id="learn-${escHtml(id)}" aria-labelledby="slideTitle"><div class="slide__in">${inner}</div></article>`;

function coverSlide(s, st) {
  // heroTitle carries its own <em> emphasis, so it is the one string on the page
  // interpolated unescaped. Everything else goes through escHtml.
  return slideShell('slide--cover', st.id, `
    <div class="slide__text">
      <p class="kicker">${escHtml(t('learn.heroKicker'))}</p>
      <h2 class="cover__title" id="slideTitle">${t('learn.heroTitle')}</h2>
      <p class="cover__lead">${escHtml(t('learn.heroLead'))}</p>
      <div class="row">
        <a class="btn btn--primary" href="#/play">${glyphSvg('strike', '', 18)} ${escHtml(t('learn.ctaPlayNow'))}</a>
        <a class="btn" href="#/cards">${glyphSvg('dice', '', 18)} ${escHtml(t('learn.ctaCards'))}</a>
      </div>
    </div>
    <div class="slide__visual slide__visual--hero">${heroArt(s)}</div>`);
}

/**
 * The unnumbered slide after the lessons: play it right now, nothing to print.
 * A fresh visitor who reads the deck top to bottom used to leave believing the
 * site was a manual for a physical product; the one mention of on-screen play
 * was a footnote seven clicks deep.
 */
function playNowSlide(s) {
  return slideShell('slide--cover', 'play-now', `
    <div class="slide__text">
      <p class="kicker">${escHtml(t('learn.playNowKicker'))}</p>
      <h2 class="cover__title" id="slideTitle">${escHtml(t('learn.playNowTitle'))}</h2>
      <p class="cover__lead">${escHtml(t('learn.playNowLead'))}</p>
      <div class="row">
        <a class="btn btn--primary" href="#/play">${glyphSvg('strike', '', 18)} ${escHtml(t('learn.playNowCta'))}</a>
        <a class="btn" href="#/cards">${glyphSvg('dice', '', 18)} ${escHtml(t('learn.ctaCards'))}</a>
      </div>
      <p class="muted small">${escHtml(t('learn.playNowDesktop'))}</p>
    </div>
    <div class="slide__visual slide__visual--hero">${heroArt(s)}</div>`);
}

function stepSlide(s, st, i) {
  if (st.cover) return coverSlide(s, st);
  // The last basics slide says so, in place. Without it the chapter break is only
  // a gap in the rail, and a reader who has learned enough to play has no way to
  // know that from the deck.
  const end = i === LAST_BASIC ? `<p class="slide__handoff">${escHtml(COPY.basicsEnd)}</p>` : '';
  return slideShell(WIDE.has(st.visual) ? 'slide--wide' : '', st.id, `
    <div class="slide__text">
      <h3 class="slide__title" id="slideTitle"><span class="slide__n" aria-hidden="true">${i + 1}</span>${escHtml(st.title)}</h3>
      ${st.body.map((p) => `<p>${escHtml(p)}</p>`).join('')}
      ${end}
      ${ruleLink(st.rule)}
    </div>
    <div class="slide__visual">${VISUALS[st.visual]?.(s) || ''}</div>`);
}

function diceSlide(s) {
  const fid = fidelity(s.cards.ladder);
  return slideShell('slide--wide', 'dice', `
    <div class="slide__text">
      <h3 class="slide__title" id="slideTitle">${escHtml(t('learn.bridgeTitle'))}</h3>
      <p>${escHtml(t('learn.bridgeLead'))}</p>
      <p class="small muted">${escHtml(t('learn.fidelityLead'))} ${fid.map((f) => `${escHtml(f.die)} ${(f.gap * 100).toFixed(1)}`).join(' · ')} ${escHtml(t('learn.fidelityUnit'))}</p>
    </div>
    <div class="slide__visual slide__visual--table">${ladderVisual(s)}</div>`);
}

function rulebookSlide() {
  return slideShell('slide--rulebook', 'rulebook', `
    <div class="slide__head">
      <h3 class="slide__title" id="slideTitle">${escHtml(t('learn.rulebookTitle'))}</h3>
      <p class="small muted">${escHtml(t('learn.rulebookLead'))}</p>
    </div>
    <div class="rulebook">${rulebookHtml[getLang()] || `<p class="muted">${escHtml(t('common.loading'))}</p>`}</div>`);
}

const slideFor = (s, i) => (i === SLIDE_RULEBOOK ? rulebookSlide()
  : i === SLIDE_PLAY ? playNowSlide(s)
  : i === SLIDE_DICE ? diceSlide(s)
    : stepSlide(s, STEPS[i], i));

// ── The deck chrome ──────────────────────────────────────────

const chapterLabel = (n) => COPY.chapter[SLIDE_CHAPTERS[n]] || SLIDE_CHAPTERS[n];

function deckHead(i) {
  // The rail is grouped rather than one flat run of numbers, so the reader can
  // see at a glance that most of the deck is the part they need and where they
  // are allowed to stop. The labels are hidden on a narrow screen (css/learn.css),
  // where the dots already own the whole width; the group boundary survives as a
  // gap, and the sr-only name on every dot still carries its chapter.
  let dots = '', chapter = null;
  slideTitles().forEach((title, n) => {
    if (SLIDE_CHAPTERS[n] !== chapter) {
      if (chapter !== null) dots += '</div></div>';
      chapter = SLIDE_CHAPTERS[n];
      dots += `<div class="rail__group"><span class="rail__label" aria-hidden="true">${escHtml(chapterLabel(n))}</span><div class="rail__dots">`;
    }
    dots += `
    <button type="button" class="rail__dot" data-action="learn-step" data-step="${n}"${n === i ? ' aria-current="true"' : ''}>
      <span aria-hidden="true">${n === SLIDE_PLAY ? glyphSvg('strike', '', 12) : n + 1}</span><span class="sr-only">${escHtml(chapterLabel(n))}: ${escHtml(title)}</span>
    </button>`;
  });
  dots += '</div></div>';
  return `<div class="deck__head">
    <p class="kicker deck__kicker">${escHtml(t('learn.walkthroughKicker'))}</p>
    <nav class="rail" aria-label="${escHtml(t('learn.contents'))}">${dots}</nav>
    <p class="deck__count small muted"><b class="deck__chapter">${escHtml(chapterLabel(i))}</b>${i + 1} ${escHtml(t('learn.slideOf'))} ${SLIDE_COUNT}</p>
  </div>`;
}

function deckFoot(i) {
  const atStart = i === 0 ? ' disabled' : '';
  const atEnd = i === SLIDE_COUNT - 1 ? ' disabled' : '';
  return `<div class="deck__foot">
    <button type="button" class="btn deck__btn" data-action="learn-prev"${atStart}>${CHEV.left}${escHtml(t('learn.prev'))}</button>
    <p class="deck__hint small muted">${escHtml(t('learn.deckHint'))}</p>
    <button type="button" class="btn btn--primary deck__btn" data-action="learn-next"${atEnd}>${escHtml(t('learn.next'))}${CHEV.right}</button>
  </div>`;
}

// Which way the last move went, so the entering slide animates from the side it
// came from. Transient (a render memo), which is why it is not in state.
let lastSlide = 0;

export function renderLearn(s) {
  ensureRulebook();
  installGestures();
  const i = openSlide(s);
  const dir = i < lastSlide ? 'back' : 'fwd';
  lastSlide = i;
  return `<section class="deck" data-slide="${i}" data-dir="${dir}">
    ${deckHead(i)}
    <div class="deck__stage">${slideFor(s, i)}</div>
    ${deckFoot(i)}
  </section>`;
}

// ── Actions ──────────────────────────────────────────────────
/** Returns true when the view must re-render. See the seam contract in events.js. */
export function onLearnAction(s, act, el, e) {
  switch (act) {
    case 'step': {
      const to = clampSlide(el.dataset.step);
      if (to === s.learnStep) return false;
      s.learnStep = to;
      return true;
    }
    case 'prev': case 'next': {
      const to = clampSlide(s.learnStep + (act === 'next' ? 1 : -1));
      if (to === s.learnStep) return false;
      s.learnStep = to;
      return true;
    }
    default: return false;
  }
}

/** Arrows and Home/End walk the deck. Returns true when the view must re-render. */
export function onLearnKey(s, e) {
  // The rulebook is the one slide that scrolls inside itself, so on it the page
  // keys belong to the reader: PageDown pages the rules, End reaches the last
  // section. Only the two horizontal arrows still move the deck.
  const onRulebook = s.learnStep === SLIDE_RULEBOOK;
  if (onRulebook && e.key !== 'ArrowLeft' && e.key !== 'ArrowRight') return false;
  const to = e.key === 'ArrowRight' || e.key === 'PageDown' ? s.learnStep + 1
    : e.key === 'ArrowLeft' || e.key === 'PageUp' ? s.learnStep - 1
      : e.key === 'Home' ? 0
        : e.key === 'End' ? SLIDE_COUNT - 1
          : null;
  if (to === null) return false;
  e.preventDefault();
  const next = clampSlide(to);
  if (next === s.learnStep) return false;
  s.learnStep = next;
  return true;
}
