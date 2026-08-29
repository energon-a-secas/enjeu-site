// ── Play: the screens that are not the board ─────────────────
// Setup, and the four between-levels steps (class, draft, Advantage draw, and
// the two endings). These are ordinary scrolling pages: only the fight has to
// fit the viewport, so keeping them out of play.js keeps that file about the
// board and nothing else.

import { t, cardName } from '../strings.js';
import { escHtml } from '../utils.js';
import { cardFace, lifeMini } from '../cards/face.js';
import { glyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor } from '../data/placeholders.js';
import { DICE } from '../game/rules.js';

const ELEMENTS = ['fire', 'water', 'earth', 'wind'];
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

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
      <span class="muted small">${escHtml(cap(L.element || 'fire'))} · ${L.die} · ${escHtml(t(`play.${L.mode}`))} · ${escHtml(L.kind === 'first' ? t('play.firstGame') : t('play.fullRun'))}</span>
    </button>` : '';

  const slides = [
    `<div class="setup-grid">
      <button class="panel ${kind === 'first' ? 'panel--accent' : ''}" data-action="play-kind" data-kind="first" aria-pressed="${kind === 'first'}" style="text-align:left;cursor:pointer;font:inherit">
        <p class="kicker">${escHtml(t('learn.ctaFirst'))}</p>
        <h3 class="panel__title">${escHtml(t('play.firstGame'))}</h3>
        <p class="panel__lead">${escHtml(t('play.firstGameLead'))}</p>
      </button>
      <button class="panel ${kind === 'full' ? 'panel--accent' : ''}" data-action="play-kind" data-kind="full" aria-pressed="${kind === 'full'}" style="text-align:left;cursor:pointer;font:inherit">
        <p class="kicker">5 levels</p>
        <h3 class="panel__title">${escHtml(t('play.fullRun'))}</h3>
        <p class="panel__lead">${escHtml(t('play.fullRunLead'))}</p>
      </button>
    </div>${fastLane}`,

    `<div class="panel stack stack--tight">
      <p class="kicker">${escHtml(t('play.element'))}</p>
      <div class="pick" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        ${ELEMENTS.map((el) => { const h = heroFor(el); return `
        <button class="btn btn--${el}" data-action="play-element" data-element="${el}" aria-pressed="${s.element === el}">
          <span class="figure">${figureSvg(h)}</span>
          <span><span class="dot"></span> ${escHtml(cap(el))}<br><small class="muted">${escHtml(h.name)}</small></span>
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
      <div class="sw-pick ${s.secondWind ? 'panel--accent' : ''}">
        <div class="sw-pick__card">${sw ? cardFace(sw, { size: 'mini' }) : ''}</div>
        <label class="sw-pick__text">
          <span class="row"><input type="checkbox" data-change="play-second-wind" ${s.secondWind ? 'checked' : ''}> <b>${escHtml(t('play.secondWind'))}</b></span>
          <small class="muted">${escHtml(t('play.secondWindHint'))}</small>
        </label>
      </div>
    </div>`,

    `<div class="panel stack stack--tight table-slide">
      <p class="panel__lead">${escHtml(t('play.setup.tableLead'))}</p>
      <ol class="table-steps">
        <li><span class="table-steps__art">${lifeMini('boss').repeat(4)}</span>${escHtml(t('play.setup.tableBoss'))}</li>
        <li><span class="table-steps__art figure">${figureSvg(heroFor(s.element || 'fire'))}</span>${escHtml(t('play.setup.tableHero'))}</li>
        <li><span class="table-steps__art">${lifeMini(s.element || 'fire').repeat(4)}</span>${escHtml(t('play.setup.tableLife'))}</li>
      </ol>
    </div>`,
  ];

  const nav = `<div class="row row--between setup-nav">
    <span>${st > 0 ? `<button class="btn btn--ghost" data-action="play-setup-step" data-step="${st - 1}">${escHtml(t('play.setup.back'))}</button>` : ''}</span>
    ${st < 3
    ? `<button class="btn btn--primary btn--lg" data-action="play-setup-step" data-step="${st + 1}">${escHtml(t('play.setup.next'))} ›</button>`
    : `<button class="btn btn--primary btn--lg" data-action="play-start">${escHtml(t('play.start'))}: ${escHtml(kind === 'first' ? t('play.firstGame') : t('play.fullRun'))} ${glyphSvg('strike', '', 18)}</button>`}
  </div>`;

  return `
  <div class="container stack">
    <header class="stack stack--tight">
      <p class="kicker">${escHtml(t('play.title'))}</p>
      <h2 class="panel__title">${escHtml(t('play.setupTitle'))}</h2>
    </header>
    ${inProgress ? `<div class="panel panel--accent row row--between"><div><b>${escHtml(t('play.resume'))}</b>: level ${s.run.level}, round ${s.run.fight?.round || 1}.</div><div class="row"><button class="btn btn--primary" data-action="play-resume">${escHtml(t('play.resume'))}</button><button class="btn btn--ghost" data-action="play-abandon">${escHtml(t('play.abandon'))}</button></div></div>` : ''}
    ${stepper}
    ${slides[st]}
    ${nav}
    <p class="small muted">${escHtml(t('play.placeholderNote'))}</p>
  </div>`;
}

export function renderClassPick(s, run) {
  const sel = run.ui?.pickClass || null;
  const chosen = sel ? s.cards.byId[sel] : null;
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared</p>
    <h2 class="panel__title">${escHtml(t('play.pickClass'))}</h2>
    <div class="draft">${s.cards.class.map((c) => `
      <button class="action-card ${sel === c.id ? 'is-picked' : ''}" data-action="play-class" data-id="${c.id}" aria-pressed="${sel === c.id}">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small" style="white-space:normal">${escHtml(c.passive)}</span></button>`).join('')}</div>
    <div class="row confirm-bar">${chosen
    ? `<button class="btn btn--primary btn--lg" data-action="play-class-confirm">${escHtml(t('play.confirmKeep'))} ${escHtml(cardName(chosen))} ${glyphSvg('strike', '', 16)}</button>`
    : `<span class="muted small">${escHtml(t('play.pickFirst'))}</span>`}</div>
  </div>`;
}

export function renderDraft(s, run) {
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared · ${escHtml(t('play.draftLead'))}</p>
    <h2 class="panel__title">${escHtml(t('play.draftTitle'))}</h2>
    <div class="draft">${run.draft.map((id) => { const c = s.cards.byId[id]; const on = run.ui?.pickSkill === id; return `
      <button class="action-card ${on ? 'is-picked' : ''}" data-action="play-draft" data-id="${id}" aria-pressed="${on}">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small">tier ${c.tier} · bet ${c.bet} · ${c.damage} · ${escHtml(t(`cards.check.${c.check || 'none'}`))}${c.element ? ` · ${cap(c.element)}` : ''}</span></button>`; }).join('')}</div>
    <div class="row confirm-bar">${run.ui?.pickSkill
    ? `<button class="btn btn--primary btn--lg" data-action="play-draft-confirm">${escHtml(t('play.confirmKeep'))} ${escHtml(cardName(s.cards.byId[run.ui.pickSkill]))} ${glyphSvg('strike', '', 16)}</button>`
    : `<span class="muted small">${escHtml(t('play.pickFirst'))}</span>`}</div>
  </div>`;
}

export function renderAdvantage(s, run) {
  const drawn = run.ui?.drawn || [];
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared</p>
    <h2 class="panel__title">${escHtml(t('play.advDraw'))}</h2>
    <div class="draft">${drawn.map((id) => { const c = s.cards.byId[id]; return `<div class="action-card" style="cursor:default">${cardFace(c, { size: 'browse' })}<b>${escHtml(cardName(c))}</b><span class="small" style="white-space:normal">${escHtml(c.effect)}</span></div>`; }).join('')}</div>
    <p class="small muted">${escHtml(t('play.advHand'))}: ${run.hand.map((id) => escHtml(s.cards.byId[id].name)).join(', ') || 'none'}</p>
    <div class="row"><button class="btn btn--primary btn--lg" data-action="play-next-level">${escHtml(t('play.nextLevel'))} ${run.level + 1}</button></div>
  </div>`;
}

function history(run) {
  return `<div class="table-wrap"><table class="ladder"><thead><tr><th>Level</th><th>Result</th><th>Rounds</th><th>Broken</th></tr></thead><tbody>
    ${run.history.map((h) => `<tr><td>${h.level}</td><td>${h.outcome}</td><td>${h.rounds}</td><td>${h.broken}</td></tr>`).join('')}</tbody></table></div>`;
}

export function renderDone(s, run) {
  const first = run.kind === 'first';
  return `<div class="container stack">
    <div class="banner banner--win">${escHtml(first ? 'You beat the First Game.' : t('play.runWon'))}</div>
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
