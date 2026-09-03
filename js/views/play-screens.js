// ── Play: the screens that are not the board ─────────────────
// Setup, and the four between-levels steps (class, draft, Advantage draw, and
// the two endings). These are ordinary scrolling pages: only the fight has to
// fit the viewport, so keeping them out of play.js keeps that file about the
// board and nothing else.

import { t, cardName, elementName } from '../strings.js';
import { escHtml } from '../utils.js';
import { cardFace, lifeMini } from '../cards/face.js';
import { glyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor, BOSSES } from '../data/placeholders.js';
import { lastLevel, shapeOf } from '../game/run.js';
import { DICE } from '../game/rules.js';
import { DM_STYLES } from '../game/engine.js';
import { riskDots } from '../cards/face.js';

const ELEMENTS = ['fire', 'water', 'earth', 'wind'];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * A run kind's name. There are three of them now, and every place that said one
 * was written as `kind === 'first' ? firstGame : fullRun`, which quietly called
 * a Quick run a Full run the moment the third kind existed: the setup screen
 * offered "Start: Full run" under a Quick card the player had just chosen.
 */
const KIND_NAME = { first: 'play.firstGame', quick: 'play.quickRun', full: 'play.fullRun' };
const kindName = (k) => t(KIND_NAME[k] || KIND_NAME.full);

/**
 * What a card does, in the reader's language. cards.json is the source of the
 * English and the string table carries both, keyed by card id. Reading
 * `c.passive` / `c.effect` straight off the data is how a Spanish player came to
 * pick a class from four English sentences: the picture and the name turned over
 * with the language toggle and the only line that said what the card DOES did not.
 */
const effectOf = (c) => {
  const k = t(`cards.effect.${c.id}`);
  return k.startsWith('[') ? (c.passive || c.effect || '') : k;
};

export function renderSetup(s) {
  // Setup is four slides, not a form. A form asks for settings; a table ritual
  // walks the family to the fight, and the last slide is the one thing no
  // settings page can do: it says what to BUILD. Merged from four proposals in
  // the ideation round; the fast lane was the non-negotiable survivor.
  const kind = s.runKind || 'first';
  const st = Math.max(0, Math.min(3, s.setupStep || 0));
  const inProgress = s.run && !['setup', 'done', 'lost'].includes(s.run.stage);
  const sw = s.cards.byId['second-wind'];
  const L = s.playLast;

  const stepper = `<nav class="setup-steps" aria-label="${escHtml(t('play.setupTitle'))}">${[0, 1, 2, 3].map((i) => `
    <button class="setup-step ${i === st ? 'is-here' : ''} ${i < st ? 'is-done' : ''}" data-action="play-setup-step" data-step="${i}" aria-current="${i === st ? 'step' : 'false'}">
      <span>${i + 1}</span><small>${escHtml(t(`play.setup.step${i + 1}`))}</small></button>`).join('')}</nav>`;

  const fastLane = L ? `
    <button class="panel panel--sunk row fast-lane" data-action="play-setup-again" style="cursor:pointer;font:inherit;text-align:left">
      <b>${escHtml(t('play.setup.again'))}</b>
      <span class="muted small">${escHtml(elementName(L.element || 'fire'))} · ${L.die} · ${escHtml(t(`play.${L.mode}`))} · ${escHtml(kindName(L.kind))}</span>
    </button>` : '';

  // The three ways in. They were two panels of identical shape and colour with
  // the same three lines of text, and the owner reported reading them as one
  // thing: a menu you can overlook is not a menu. Each one now says its LENGTH
  // as a row of level pips and a wall-clock estimate, carries the boss it ends
  // on, and takes its own accent. The length is the question being asked.
  const KINDS = [
    { id: 'first', name: t('play.firstGame'), lead: t('play.firstGameLead') },
    { id: 'quick', name: t('play.quickRun'), lead: t('play.quickRunLead') },
    { id: 'full', name: t('play.fullRun'), lead: t('play.fullRunLead') },
  ];
  const kindCard = (k) => {
    const n = lastLevel(k.id);
    const pips = Array.from({ length: 5 }, (_, i) => `<i class="${i < n ? 'is-on' : ''}"></i>`).join('');
    // The boss this run ENDS on, taken from the shape rather than written down
    // beside it: a Quick run stops at three levels but its last stop is the
    // level 5 boss, and a hardcoded 3 put the middle boss on the card as if it
    // were the climax.
    const sh = shapeOf(k.id);
    const roster = BOSSES.find((b) => b.level === sh.bosses[sh.levels - 1]);
    return `<button class="kind ${kind === k.id ? 'is-on' : ''}" data-kind-id="${k.id}" data-action="play-kind" data-kind="${k.id}" aria-pressed="${kind === k.id}">
      <span class="kind__len"><span class="kind__pips" aria-hidden="true">${pips}</span>
        <b>${escHtml(t(`play.kindLevels.${k.id}`))}</b><small>${escHtml(t(`play.kindMinutes.${k.id}`))}</small></span>
      <span class="kind__fig figure">${figureSvg(roster)}</span>
      <span class="kind__name">${escHtml(k.name)}</span>
      <span class="kind__who">${escHtml(t(`play.kindWho.${k.id}`))}</span>
      <span class="kind__lead">${escHtml(k.lead)}</span>
    </button>`;
  };

  const slides = [
    `<div class="kind-grid">${KINDS.map(kindCard).join('')}</div>${fastLane}`,

    `<div class="panel stack stack--tight">
      <p class="kicker">${escHtml(t('play.element'))}</p>
      <div class="pick" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        ${ELEMENTS.map((el) => { const h = heroFor(el); return `
        <button class="btn btn--${el}" data-action="play-element" data-element="${el}" aria-pressed="${s.element === el}">
          <span class="figure">${figureSvg(h, { cls: s.element === el ? 'fig--cheer' : '' })}</span>
          <span><span class="dot"></span> ${escHtml(elementName(el))}<br><small class="muted">${escHtml(h.name)}</small></span>
        </button>`; }).join('')}
      </div>
    </div>`,

    `<div class="panel stack stack--tight">
      <div class="row" style="gap: var(--space-6)">
        <div class="field"><span>${escHtml(t('play.die'))}</span>
          <span class="seg" role="group">${DICE.map((d) => `<button data-action="play-die" data-die="${d}" aria-pressed="${s.die === d}">${d}</button>`).join('')}</span></div>
        <div class="field"><span>${escHtml(t('play.mode'))}</span>
          <span class="seg" role="group">${['story', 'standard', 'nightmare'].map((m) => `<button data-action="play-mode" data-mode="${m}" aria-pressed="${s.mode === m}">${escHtml(t(`play.${m}`))}</button>`).join('')}</span>
          <small class="muted">${escHtml(t(`play.modeHint.${s.mode}`))}</small></div>
      </div>
      <div class="sw-pick opt ${s.secondWind ? 'is-on' : ''}">
        <div class="sw-pick__card">${sw ? cardFace(sw, { size: 'mini' }) : ''}</div>
        <label class="sw-pick__text">
          <span class="row"><input type="checkbox" data-change="play-second-wind" ${s.secondWind ? 'checked' : ''}> <b>${escHtml(t('play.secondWind'))}</b></span>
          <small class="muted">${escHtml(t('play.secondWindHint'))}</small>
        </label>
      </div>
      <div class="sw-pick opt ${s.simple ? 'is-on' : ''}">
        <label class="sw-pick__text">
          <span class="row"><input type="checkbox" data-change="play-simple" ${s.simple ? 'checked' : ''}> <b>${escHtml(t('play.simpleMode'))}</b></span>
          <small class="muted">${escHtml(t('play.simpleModeHint'))}</small>
        </label>
      </div>
      ${dmDial(s)}
    </div>`,

    `<div class="panel stack stack--tight table-slide">
      <p class="panel__lead">${escHtml(t('play.setup.tableLead'))}</p>
      <p class="muted small">${escHtml(t('play.setup.tableSkip'))}</p>
      <ol class="table-steps">
        <li><span class="table-steps__art">${lifeMini('boss').repeat(4)}</span>${escHtml(t('play.setup.tableBoss'))}</li>
        <li><span class="table-steps__art figure">${figureSvg(heroFor(s.element || 'fire'), { cls: 'fig--cheer' })}</span>${escHtml(t('play.setup.tableHero'))}</li>
        <li><span class="table-steps__art">${lifeMini(s.element || 'fire').repeat(4)}</span>${escHtml(t('play.setup.tableLife'))}</li>
      </ol>
    </div>`,
  ];

  const nav = `<div class="row row--between setup-nav">
    <span>${st > 0 ? `<button class="btn btn--ghost" data-action="play-setup-step" data-step="${st - 1}">${escHtml(t('play.setup.back'))}</button>` : ''}</span>
    ${st < 3
    ? `<button class="btn btn--primary btn--lg" data-action="play-setup-step" data-step="${st + 1}">${escHtml(t('play.setup.next'))} ›</button>`
    : `<button class="btn btn--primary btn--lg" data-action="play-start">${glyphSvg('play', '', 18)} ${escHtml(t('play.start'))}: ${escHtml(kindName(kind))}</button>`}
  </div>`;

  // The title stands on its edge down the left margin, the way a word runs down
  // the spine of a book or the edge of a boxed game. It buys back the whole band
  // it used to occupy across the top, which is the space the three run cards
  // needed, and it gives the screen a mark that is this game's rather than the
  // default centred heading every setup screen has.
  return `
  <div class="container setup-shell">
    <div class="spine" aria-hidden="true"><span>${escHtml(t('play.setupTitle'))}</span></div>
    <div class="stack setup-slide">
    <h2 class="sr-only">${escHtml(t('play.setupTitle'))}</h2>
    ${inProgress ? `<div class="panel panel--accent row row--between"><div><b>${escHtml(t('play.resume'))}</b>: ${escHtml(t('play.level'))} ${s.run.level}, ${escHtml(t('play.round')).toLowerCase()} ${s.run.fight?.round || 1}.</div><div class="row"><button class="btn btn--primary" data-action="play-resume">${escHtml(t('play.resume'))}</button><button class="btn btn--ghost" data-action="play-abandon">${escHtml(t('play.abandon'))}</button></div></div>` : ''}
    ${stepper}
    ${slides[st]}
    ${nav}
    <p class="small muted setup-keys">${escHtml(t('play.setup.keys'))}</p>
    <p class="small muted">${escHtml(t('play.placeholderNote'))}</p>
    </div>
  </div>`;
}

/**
 * The break dial (RULES.md section 7). Three styles and four numbers, and the
 * numbers are visible rather than hidden behind an Advanced link, because the
 * whole rule is "this is the grown-up's call" and a call you cannot see the
 * terms of is not one you are making.
 *
 * The check each style asks for is drawn with riskDots and not spelled out, so
 * the dial teaches the same four-rung ladder as every other check in the game.
 * A cap of 0 turns the rule off, which is a legitimate way to play and is why
 * the row goes down to zero rather than stopping at one.
 */
function dmDial(s) {
  const dm = s.dm || {};
  const on = !!dm.on;
  const CHECK = { friendly: null, assisted: dm.step || 'hard', hardcore: 'wild' };
  const styles = DM_STYLES.map((id) => `
    <button class="dm-style ${dm.style === id ? 'is-on' : ''}" data-action="play-dm-style" data-style="${id}" aria-pressed="${dm.style === id}">
      <span class="row"><b>${escHtml(t(`play.dm.${id}`))}</b>${CHECK[id] ? riskDots(CHECK[id]) : ''}</span>
      <small class="muted">${escHtml(t(`play.dm.${id}Hint`))}</small>
    </button>`).join('');
  const caps = [0, 1, 2, 3, 4].map((n) => `<button data-action="play-dm-cap" data-cap="${n}" aria-pressed="${(dm.cap ?? 2) === n}">${n}</button>`).join('');
  // Off by default and folded away when off. Break points are the one mechanic
  // here that asks the table to invent something, so it is an opt-in rather
  // than a thing a family has to notice and switch off: the game is complete
  // without it, and a settings screen that shows every dial at once is how a
  // simple game stops looking simple.
  return `<div class="dm-dial opt ${on ? 'is-on' : ''}">
    <label class="sw-pick__text">
      <span class="row"><input type="checkbox" data-change="play-dm-on" ${on ? 'checked' : ''}>
        <b>${glyphSvg('break', '', 18)} ${escHtml(t('play.dm.enable'))}</b></span>
      <small class="muted">${escHtml(t('play.dm.enableHint'))}</small>
    </label>
    ${!on ? '' : `<div class="dm-open">
    <div class="row row--between"><b>${escHtml(t('play.dm.title'))}</b></div>
    <div class="dm-styles">${styles}</div>
    <div class="row" style="gap: var(--space-5); flex-wrap: wrap">
      <div class="field"><span>${escHtml(t('play.dm.cap'))}</span><span class="seg" role="group">${caps}</span></div>
      <label class="field"><span>${escHtml(t('play.dm.wound'))}</span>
        <input type="number" min="0" max="200" step="25" value="${dm.wound ?? 50}" data-change="play-dm-num" data-key="wound" class="typed-roll"></label>
      <label class="field"><span>${escHtml(t('play.dm.cripple'))}</span>
        <input type="number" min="0" max="100" step="25" value="${dm.cripple ?? 25}" data-change="play-dm-num" data-key="cripple" class="typed-roll"></label>
    </div></div>`}
  </div>`;
}

export function renderClassPick(s, run) {
  const sel = run.ui?.pickClass || null;
  const chosen = sel ? s.cards.byId[sel] : null;
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} ${escHtml(t('play.levelCleared'))}</p>
    <h2 class="panel__title">${escHtml(t('play.pickClass'))}</h2>
    <div class="draft">${s.cards.class.map((c) => `
      <button class="action-card ${sel === c.id ? 'is-picked' : ''}" data-action="play-class" data-id="${c.id}" aria-pressed="${sel === c.id}">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small" style="white-space:normal">${escHtml(effectOf(c))}</span></button>`).join('')}</div>
    <div class="row confirm-bar">${chosen
    ? `<button class="btn btn--primary btn--lg" data-action="play-class-confirm">${escHtml(t('play.confirmKeep'))} ${escHtml(cardName(chosen))} ${glyphSvg('strike', '', 16)}</button>`
    : `<span class="muted small">${escHtml(t('play.pickFirst'))}</span>`}</div>
  </div>`;
}

export function renderDraft(s, run) {
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} ${escHtml(t('play.levelCleared'))} · ${escHtml(t('play.draftLead'))}</p>
    <h2 class="panel__title">${escHtml(t('play.draftTitle'))}</h2>
    <div class="draft">${run.draft.map((id) => { const c = s.cards.byId[id]; const on = run.ui?.pickSkill === id; return `
      <button class="action-card ${on ? 'is-picked' : ''}" data-action="play-draft" data-id="${id}" aria-pressed="${on}">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small">${escHtml(t('cards.corner.tier'))} ${c.tier} · ${escHtml(t('cards.corner.bet'))} ${c.bet} · ${c.damage} · ${escHtml(t(`cards.check.${c.check || 'none'}`))}${c.element ? ` · ${escHtml(elementName(c.element))}` : ''}</span></button>`; }).join('')}</div>
    <div class="row confirm-bar">${run.ui?.pickSkill
    ? `<button class="btn btn--primary btn--lg" data-action="play-draft-confirm">${escHtml(t('play.confirmKeep'))} ${escHtml(cardName(s.cards.byId[run.ui.pickSkill]))} ${glyphSvg('strike', '', 16)}</button>`
    : `<span class="muted small">${escHtml(t('play.pickFirst'))}</span>`}</div>
  </div>`;
}

export function renderAdvantage(s, run) {
  const drawn = run.ui?.drawn || [];
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} ${escHtml(t('play.levelCleared'))}</p>
    <h2 class="panel__title">${escHtml(t('play.advDraw'))}</h2>
    <div class="draft">${drawn.map((id) => { const c = s.cards.byId[id]; return `<div class="action-card" style="cursor:default">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small" style="white-space:normal">${escHtml(effectOf(c))}</span></div>`; }).join('')}</div>
    <p class="small muted">${escHtml(t('play.advHand'))}: ${run.hand.map((id) => escHtml(cardName(s.cards.byId[id]))).join(', ') || escHtml(t('cards.val.none'))}</p>
    <div class="row"><button class="btn btn--primary btn--lg" data-action="play-next-level">${escHtml(t('play.nextLevel'))} ${run.level + 1}</button></div>
  </div>`;
}

function history(run) {
  return `<div class="table-wrap"><table class="ladder"><thead><tr><th>${escHtml(t('play.hist.level'))}</th><th>${escHtml(t('play.hist.result'))}</th><th>${escHtml(t('play.hist.rounds'))}</th><th>${escHtml(t('play.hist.broken'))}</th></tr></thead><tbody>
    ${run.history.map((h) => `<tr><td>${h.level}</td><td>${escHtml(t(`play.outcome.${h.outcome}`))}</td><td>${h.rounds}</td><td>${h.broken}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderDone(s, run) {
  const first = run.kind === 'first';
  return `<div class="container stack">
    <div class="banner banner--win">${escHtml(first ? t('play.firstWon') : t('play.runWon'))}</div>
    ${history(run)}
    <div class="row">${first ? `<button class="btn btn--primary btn--lg" data-action="play-go-full">${escHtml(t('play.fullRun'))}</button>` : ''}<button class="btn btn--lg" data-action="play-new-run">${escHtml(t('play.newRun'))}</button></div>
  </div>`;
}

export function renderLost(s, run) {
  return `<div class="container stack">
    <div class="banner banner--lose">${escHtml(t('play.lost'))} ${escHtml(t('play.level'))} ${run.level}.</div>
    ${history(run)}
    <div class="row"><button class="btn btn--primary btn--lg" data-action="play-new-run">${escHtml(t('play.newRun'))}</button></div>
  </div>`;
}
