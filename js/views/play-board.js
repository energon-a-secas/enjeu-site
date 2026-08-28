// ── Play: the board ──────────────────────────────────────────
// One screen, one turn, no scrolling. The board is a duel seen from your
// chair: the decks you are not touching down the left as a narrow rail, the
// arena in the middle, the log on the right until you close it.
//
// The arena is a 2x2 diagonal, which is the whole reason the rebuild happened.
// The boss sits top-right and speaks over its own head; you sit bottom-left
// with your hand, your plan and your gear underneath; the die sits in the
// empty cell opposite the boss, showing what the next roll is for; the shelf
// fills the last cell with what you already have in play. Before this the boss
// and the hero shared one middle band, a third of the board below the buttons
// was empty, and everything that should have felt like a fight was a line of
// text in the log.
//
// Height is the scarce resource here, not width: everything card-shaped is
// sized from vh in css/play.css so the whole board shrinks with the window
// instead of pushing the resolve button off the bottom of it.
//
// Every card, card back and row of check dots comes from cards/face.js. There
// is deliberately no second renderer in this file: the last one drew cards no
// printer would ever produce.
//
// Motion is CSS only, keyed to `ui.fx`, which play.js clears at the top of
// every action. css/style.css:334 zeroes every animation and transition under
// prefers-reduced-motion, and that rule can only protect motion the CSS owns:
// a JS timer or a rAF loop here would run anyway.

import { t } from '../strings.js';
import { escHtml } from '../utils.js';
import { cardFace, cardBack, lifeMini, riskDots } from '../cards/face.js';
import { glyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor, MINION } from '../data/placeholders.js';
import { legalAttacks, ready, spent, broken, bossHp, raging, effectiveStep, attackDamage, reviveStep, ALLY_DEF } from '../game/engine.js';
import { targetFor, dieMax, stepOdds } from '../game/rules.js';
import { validatePlan, planActions, attackFor, betFor, readyAt, runeSpare, pickable, awaitingStep } from './play-plan.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * A refusal from play-plan.js as a sentence. Mapped rather than interpolated:
 * `t()` renders a missing key as `[play.key]` on screen, and 'gone' (the card
 * left your hand mid-plan) has no line of its own in strings.js.
 */
export const reasonText = (r) => (r === 'tooManyActions' || r === 'notEnoughReady'
  ? t(`play.${r}`) : t('play.planEmpty'));

// ── Piles ────────────────────────────────────────────────────
function heroPile(f) {
  const order = { ready: 0, spent: 1, broken: 2 };
  return [...f.hero.pool].sort((a, b) => order[a.st] - order[b.st])
    .map((c) => lifeMini(c.kind, c.st === 'spent' ? 'is-spent' : c.st === 'broken' ? 'is-broken' : '')).join('');
}

function bossPile(f) {
  const cards = Math.ceil(f.boss.body / f.boss.perCard);
  const shown = Math.min(cards, 8);
  return `${lifeMini('boss').repeat(shown)}${cards > 8 ? `<b class="muted">+${cards - 8}</b>` : ''}`;
}

/** A face-down pile as a small offset stack, never a spread: the fit is the point. */
function stackOf(html, n, max = 3) {
  const k = Math.min(Math.max(n, 0), max);
  if (!k) return '<span class="stack-of is-empty"></span>';
  return `<span class="stack-of">${Array.from({ length: k }, (_, i) => `<span class="stack-of__c" style="--i:${i}">${html}</span>`).join('')}</span>`;
}

// ── The rest of the table ────────────────────────────────────
/**
 * What a real table would show and a screen usually hides: the piles you are
 * not touching this turn. A rail, not a column: the label that used to sit
 * beside each pile clipped itself to "ge" and "es" in 158px, so it moved into
 * the title and the aria-label and the rail kept the 90px for the arena.
 *
 * Hover enlarges the card (pure CSS, css/play.css). A slot whose card is face
 * UP is also clickable and opens the shared card modal from views/cards.js: a
 * face-DOWN pile is not, because clicking a draw pile to read it would be
 * peeking, and the game does not let you do that at a real table either.
 */
function tablePanel(s, run, f) {
  const first = run.kind === 'first';
  const biome = s.cards.byId[f.biomeCard];
  const sw = s.cards.byId['second-wind'];
  const bossCards = Math.ceil(f.boss.body / f.boss.perCard);
  const slot = (label, art, note, id) => {
    const title = `${label}: ${note || t('play.inTheBox')}`;
    const inner = `<span class="tbl-slot__art">${art || '<span class="stack-of is-empty"></span>'}</span>
      <span class="tbl-slot__n">${escHtml(note || '')}</span>`;
    return id
      ? `<button class="tbl-slot" data-action="cards-detail" data-id="${escHtml(id)}" title="${escHtml(title)}" aria-label="${escHtml(title)}">${inner}</button>`
      : `<div class="tbl-slot" title="${escHtml(title)}" aria-label="${escHtml(title)}" role="img">${inner}</div>`;
  };
  return `<aside class="panel panel--tight fight-table" aria-label="${escHtml(t('play.table'))}">
    ${slot(t('play.biomeCard'), biome ? cardFace(biome, { size: 'mini' }) : '', biome?.name || '', biome?.id)}
    ${slot(t('play.drawPile'), first ? '' : stackOf(cardBack('skill', { size: 'mini' }), run.skillPool.length), first ? '' : String(run.skillPool.length))}
    ${slot(t('play.advPile'), first ? '' : stackOf(cardBack('skill', { size: 'mini' }), run.advDeck.length), first ? '' : String(run.advDeck.length))}
    ${slot(t('play.extraPile'), run.extraLives ? stackOf(lifeMini('extra'), run.extraLives) : '', run.extraLives ? String(run.extraLives) : '')}
    ${slot(t('play.secondWind'), run.secondWind && sw ? cardFace(sw, { size: 'mini' }) : '', run.secondWind ? 'in play' : '', run.secondWind ? sw?.id : null)}
    ${slot(t('play.bossPile'), stackOf(cardBack('boss', { size: 'mini' }), bossCards), `${bossCards} × ${f.boss.perCard}`)}
  </aside>`;
}

// ── The boss speaks ──────────────────────────────────────────
/**
 * A speech bubble over the boss's head. It replaces reading the log for intent,
 * and it replaces the full-width `.banner--rage` that used to say the same
 * thing a second time two rows higher up.
 *
 * The Barrier and Cover buttons deliberately stay in the action panel and are
 * NOT moved in here: onPlayKey binds Enter to `.actions .btn--primary`, and
 * play.test.mjs pins that panel to exactly one primary button so Enter can
 * never be ambiguous. A control in the bubble would be a control the keyboard
 * cannot reach.
 */
function bubble(f, ui) {
  const p = f.pending;
  if (p) {
    const at = p.at === 'ally' && f.hero.ally ? t('play.aimedAtAlly') : t('play.aimedAtYou');
    const what = p.dmg
      ? `${p.dmg} damage, ${escHtml(p.rage ? t('play.unguardable') : at)}`
      : p.kind === 'brace' ? 'no damage, and it halves what it takes next turn'
        : p.kind === 'summon' ? `${p.chunk} of its life moves under a minion` : '';
    return `<p class="bubble ${p.rage || p.kind === 'ruin' ? 'is-alarm' : 'is-alert'}" role="status">
      <b>${escHtml(p.name)}</b><span>${what}</span></p>`;
  }
  if (ui.bossSaid) return `<p class="bubble is-said" role="status">${escHtml(ui.bossSaid)}</p>`;
  if (raging(f)) return `<p class="bubble is-alarm" role="status"><b>${escHtml(t('play.rage'))}</b></p>`;
  if (f.round === f.boss.rage - 1) return `<p class="bubble is-alert" role="status">${escHtml(t('play.rageSoon'))}</p>`;
  return `<p class="bubble" role="status">${escHtml(t('play.bossWatch'))}</p>`;
}

// ── The die in the empty cell ────────────────────────────────
/**
 * One die, opposite the boss, always saying what the next roll is about: the
 * number a queued check needs, the number that was actually thrown, or the
 * boss's own d6. Idle it shows the die you chose, so the cell is never blank.
 */
function dieCell(f, ui) {
  const wait = f.phase === 'act' ? awaitingStep(f, ui) : null;
  let big, note, cls = '';
  if (f.pending) { big = f.pending.roll; note = `d6 · ${f.pending.name}`; cls = 'is-rolling'; }
  else if (wait) {
    big = `${targetFor(f.die, wait.step)}+`;
    note = `${wait.a.name} · ${cap(wait.step)}`;
    cls = 'is-waiting';
  } else if (ui.last && ui.last.roll !== null && ui.last.roll !== undefined) {
    big = ui.last.roll;
    note = ui.last.hit ? t('play.hit') : t('play.miss');
    cls = `is-rolling ${ui.last.hit ? 'is-good' : 'is-bad'}`;
  } else { big = glyphSvg('dice', '', 30); note = f.die; }
  return `<div class="arena__die"><div class="die-face ${cls}">${big}</div><small class="muted">${escHtml(note)}</small></div>`;
}

// ── The gear shelf ───────────────────────────────────────────
/**
 * What you already have in play, as five slots that are always there. It
 * replaces a `·`-joined status string in which the Relic and the Ally were the
 * words "Relic" and "Ally" and nothing else. An empty slot is drawn dimmed
 * rather than omitted, so the shelf does not reflow every time one fills.
 *
 * The Ally slot carries its 50 defense as a numeral, because the boss can now
 * aim at it (RULES.md section 7) and a figure you can lose needs to be a figure
 * you can see.
 */
function shelf(f, ui) {
  const slot = (label, glyph, on, note) => `<div class="gear ${on ? 'is-on' : ''}" title="${escHtml(`${label}: ${on ? note || 'in play' : t('play.slotEmpty')}`)}">
    ${glyph}<small>${escHtml(on ? note || label : label)}</small></div>`;
  const ally = f.hero.ally
    ? `<div class="gear gear--ally is-on ${ui.fx === 'ally-hit' ? 'is-struck' : ''}" title="${escHtml(`${t('play.ally')}: ${ALLY_DEF} ${t('play.allyDef')}`)}">
        ${figureSvg({ ...MINION, name: t('play.ally') }, {})}<small>${ALLY_DEF} ${escHtml(t('play.allyDef'))}</small></div>`
    : `<div class="gear gear--ally ${ui.fx === 'ally-gone' ? 'is-lost' : ''}" title="${escHtml(`${t('play.ally')}: ${ui.fx === 'ally-gone' ? t('play.allyGone') : t('play.slotEmpty')}`)}">
        ${glyphSvg('adv-ally', '', 22)}<small>${escHtml(ui.fx === 'ally-gone' ? t('play.allyGone') : t('play.ally'))}</small></div>`;
  return `<div class="arena__shelf">
    <span class="pile-label">${escHtml(t('play.shelf'))}</span>
    <div class="gear-row">
      ${slot(t('play.relic'), glyphSvg('adv-relic', '', 22), f.hero.relic)}
      ${slot(t('play.rune'), glyphSvg('adv-rune', '', 22), f.hero.rune > 0, `${t('play.rune')} ${f.hero.rune}`)}
      ${slot(t('play.bubbleSlot'), glyphSvg('bubble', '', 22), f.hero.shield > 0, `${f.hero.shield} absorbed`)}
      ${slot(t('play.hidden'), glyphSvg('eye', '', 22), f.hero.hidden)}
      ${ally}
    </div>
  </div>`;
}

// ── Target selection ─────────────────────────────────────────
/**
 * The body chip is always present, even with no minion on the table, so the
 * strip does not appear and disappear and so "which one am I hitting" has an
 * answer before it becomes a question. The selected chip and the figure it
 * points at both get the same gold ring, which draws the link instead of
 * implying it.
 */
function targets(f, ui, roster) {
  // Stringified on purpose: the chips key on the minion's index as a string
  // (it arrives from a data attribute) while onPlayAction stores the selection
  // as a Number, so a strict compare between the two is always false and the
  // ring never left the body.
  const sel = String(ui.target ?? 'body');
  const chip = (key, art, label, hp) => `<button class="minion ${sel === key ? 'is-target' : ''}" data-action="play-target" data-target="${key}" aria-pressed="${sel === key}">
    ${art}<span>${escHtml(label)}${hp === undefined ? '' : ` ${hp}`}</span></button>`;
  return `<div class="targets"><span class="pile-label">${escHtml(t('play.target'))}</span>
    ${chip('body', glyphSvg('crown', '', 18), t('play.body'), f.boss.body)}
    ${f.boss.minions.map((m, i) => chip(String(i), figureSvg({ ...MINION, element: roster.element }, {}), `${MINION.name} ${i + 1}`, m.hp)).join('')}
  </div>`;
}

// ── The fight ────────────────────────────────────────────────
export function renderFight(s, run) {
  const f = run.fight;
  const ui = run.ui || {};
  const roster = f.roster || {};
  const hero = heroFor(run.element);
  const biome = s.cards.byId[f.biomeCard];
  const hpPct = Math.round((100 * bossHp(f)) / (f.boss.maxHp || 1));
  const logOpen = s.play?.logOpen !== false;
  const fx = ui.fx || '';
  const bossRing = (ui.target === undefined || ui.target === 'body') ? 'is-target' : '';
  const last = f.log.length ? f.log[f.log.length - 1] : null;

  return `
  <div class="container container--wide board-fit">
    <div class="fight-bar">
      <div class="fight-bar__who">
        <b>${escHtml(roster.name || f.boss.name)}</b>
        <span class="muted small">${f.boss.size}${roster.element ? ` · ${escHtml(cap(roster.element))}` : ''} · ${escHtml(t('play.level'))} ${f.level} · ${escHtml(t('play.round'))} ${f.round} · ${escHtml(biome?.name || '')}${biome?.rule ? ` (${escHtml(biome.rule)})` : ''}</span>
      </div>
      <div class="row"><span class="chip" aria-pressed="false">${f.die} · ${escHtml(t(`play.${f.mode}`))}</span>
        <button class="btn btn--ghost btn--sm" data-action="play-log" aria-pressed="${logOpen}">${glyphSvg('book', '', 16)} ${escHtml(t(logOpen ? 'play.logHide' : 'play.logShow'))}</button>
        <button class="btn btn--ghost btn--sm" data-action="play-abandon">${escHtml(t('play.abandon'))}</button></div>
    </div>
    <div class="fight-grid" data-log="${logOpen ? 'open' : 'closed'}">
      ${tablePanel(s, run, f)}
      <div class="fight-main">
        <div class="arena">
          <div class="arena__boss ${bossRing}">
            ${bubble(f, ui)}
            <div class="arena__side">
              <div class="figure ${fx === 'hit' ? 'is-hit' : ''} ${fx === 'miss' ? 'is-missed' : ''}">
                ${figureSvg(roster)}<b>${escHtml(roster.name || '')}</b>
                ${fx === 'hit' && ui.dealt ? `<span class="fx-num fx-num--bad">-${ui.dealt}</span>` : ''}
                ${fx === 'miss' ? `<span class="fx-num">${escHtml(t('play.miss'))}</span>` : ''}
              </div>
              <div class="arena__stat">
                <div class="hp"><span>${bossHp(f)}</span><div class="bar"><i style="width:${hpPct}%"></i></div><span class="muted small">/ ${f.boss.maxHp}</span>${f.boss.braced ? '<span class="chip">Braced</span>' : ''}</div>
                <div class="pile pile--boss">${bossPile(f)}</div>
              </div>
            </div>
            ${targets(f, ui, roster)}
          </div>
          ${dieCell(f, ui)}
          <div class="arena__hero">
            <div class="arena__side">
              <div class="figure ${fx === 'hurt' ? 'is-hit' : ''}">
                ${figureSvg({ ...hero, klass: run.klass })}<b>${escHtml(hero.name)}</b>
                ${fx === 'hurt' && ui.took ? `<span class="fx-num fx-num--bad">-${ui.took}</span>` : ''}
              </div>
              <div class="arena__stat">
                <div class="pile-label">${escHtml(t('play.ready'))} ${ready(f)} · ${escHtml(t('play.spent'))} ${spent(f)} · ${escHtml(t('play.broken'))} ${broken(f)}</div>
                <div class="pile">${heroPile(f)}</div>
              </div>
            </div>
          </div>
          ${shelf(f, ui)}
        </div>
        ${logOpen || !last ? '' : `<p class="log-tick ${last.cls}">${escHtml(last.text)}</p>`}
        <div class="panel actions">${renderActions(s, run, f, ui)}</div>
      </div>
      ${!logOpen ? '' : `<aside class="panel panel--tight fight-side">
        <p class="kicker">${escHtml(t('play.log'))}</p>
        <ul class="log">${f.log.slice(-60).reverse().map((l) => `<li class="${l.cls}">${escHtml(l.text)}</li>`).join('')}</ul>
      </aside>`}
    </div>
  </div>`;
}

// ── The action panel, one phase at a time ────────────────────
function renderActions(s, run, f, ui) {
  if (f.phase === 'won') {
    return `<div class="banner banner--win">${escHtml(t('play.won'))}</div>
      <div class="row"><button class="btn btn--primary btn--lg" data-action="play-continue">${escHtml(run.kind === 'first' || f.level >= 5 ? 'Finish' : t('play.nextLevel'))}</button></div>`;
  }
  if (f.phase === 'lost' || f.phase === 'stall') {
    return `<div class="banner banner--lose">${escHtml(t('play.lost'))}</div>
      <div class="row"><button class="btn btn--primary btn--lg" data-action="play-lost">${escHtml(t('play.newRun'))}</button></div>`;
  }
  if (f.phase === 'down') return renderDown(s, f, ui);
  if (f.phase === 'boss') return renderBoss(s, f, ui);
  return renderTurn(s, run, f, ui);
}

/**
 * Down, with Second Wind in play. The first comeback each level is free and
 * every one after climbs the ladder: engine.reviveStep is the authority, this
 * only shows what it says.
 */
function renderDown(s, f, ui) {
  const step = reviveStep(f);
  const need = step ? targetFor(f.die, step) : null;
  const line = step
    ? `${escHtml(t('play.downLadder'))} ${riskDots(step)} <b>${escHtml(cap(step))}</b>: ${escHtml(t('play.need'))} <b>${need}+</b> on ${f.die}`
    : `<b>${escHtml(t('play.downFree'))}</b>`;
  return `<div class="banner banner--lose">${escHtml(t('play.down'))} · ${escHtml(t('play.secondWind'))}</div>
    <div class="row row--between"><span>${line}</span>
      ${step ? `<span class="row"><span class="muted small">${escHtml(t('play.typeRoll'))}</span>${typedInput(f, ui)}</span>` : ''}</div>
    <div class="row">
      <button class="btn btn--primary btn--lg" data-action="play-revive">${glyphSvg('revive', '', 18)} ${escHtml(t('play.reviveTry'))}</button>
      <button class="btn btn--ghost" data-action="play-give-up">${escHtml(t('play.reviveGiveUp'))}</button>
    </div>`;
}

function renderBoss(s, f, ui) {
  const p = f.pending;
  if (!p) {
    return `<div class="row row--between"><b>${escHtml(t('play.bossTurn'))}</b>
      <button class="btn btn--primary btn--lg" data-action="play-boss-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.bossRoll'))}</button></div>`;
  }
  const hasBarrier = f.hero.advantage.includes('barrier');
  const parked = ui.reaction === 'barrier' && hasBarrier;
  const atAlly = p.at === 'ally' && f.hero.ally;
  const what = p.dmg ? `: ${p.dmg} damage${p.rage ? ', unguardable' : ''}`
    : p.kind === 'brace' ? ': no damage, halves what it takes next turn'
      : p.kind === 'summon' ? `: ${p.chunk} of its life moves under a minion` : '';
  // A parked Barrier is a declared intention, not an automatic cancel: Brace
  // deals nothing, and spending the card on it would be a waste the player
  // never chose. Parking makes it the primary button, so Enter plays it.
  const barrierBtn = hasBarrier
    ? `<button class="btn ${parked ? 'btn--primary btn--lg' : ''}" data-action="play-resolve" data-barrier="1">${glyphSvg('adv-barrier', '', 16)} ${escHtml(t('play.barrierPrompt'))}</button>` : '';
  // Cover is never the primary button: letting the Ally's 50 defense do its job
  // is the free option, and taking the hit whole instead is the deliberate one.
  const coverBtn = atAlly
    ? `<button class="btn" data-action="play-resolve" data-barrier="0" data-cover="1" title="${escHtml(t('play.coverHint'))}">${glyphSvg('shield', '', 16)} ${escHtml(t('play.cover'))}</button>` : '';
  const letLabel = atAlly ? `${t('play.ally')}: ${ALLY_DEF} ${t('play.allyDef')}` : hasBarrier ? t('play.letItHappen') : 'Continue';
  const letBtn = `<button class="btn ${parked ? '' : 'btn--primary'}" data-action="play-resolve" data-barrier="0">${escHtml(letLabel)}</button>`;
  return `<div class="row" style="gap: var(--space-4)">
      <div class="die-face is-rolling">${p.roll}</div>
      <div class="grow"><b>${escHtml(p.name)}</b>${what}${atAlly ? ` · ${escHtml(t('play.aimedAtAlly'))}` : ''}</div>
    </div>
    <div class="row">${parked ? barrierBtn + letBtn + coverBtn : letBtn + coverBtn + barrierBtn}</div>`;
}

const typedInput = (f, ui) => `<input type="number" min="1" max="${dieMax(f.die)}" value="${ui.typed || ''}" data-change="play-typed" class="typed-roll" aria-label="${escHtml(t('play.typeRoll'))}">`;

// ── Phase: your turn (the hand, the plan lane, one button) ────
function renderTurn(s, run, f, ui) {
  const plan = ui.plan || [];
  const can = pickable(f, plan);
  const planned = planActions(f, plan);
  const used = 3 - f.actionsLeft;
  const dots = [0, 1, 2].map((i) => `<i class="${i < used ? 'used' : i < used + planned ? 'planned' : ''}"></i>`).join('');
  const slots = `<div class="slots">${dots}<span>${f.actionsLeft - planned} ${escHtml(t('play.actionsLeft'))}</span></div>`;
  const hideBtn = f.hero.hideAvailable && !f.hero.hidden
    ? `<button class="btn btn--sm" data-action="play-hide" title="${escHtml(t('play.hideHint'))}">${glyphSvg('eye', '', 16)} ${escHtml(t('play.hide'))}</button>` : '';
  const rerollBtn = f.hero.lastMiss && !f.hero.hunterUsed ? `<button class="btn btn--sm" data-action="play-reroll">${escHtml(t('play.reroll'))}</button>` : '';

  // Cost, stake and risk under every card in hand, read off the card itself.
  // Picking a combination used to mean reading the hint line under the lane
  // after the fact; now the three numbers that decide the pick are on the thing
  // being picked.
  const hand = legalAttacks(f).map((a) => {
    const n = plan.filter((st) => st.id === a.id).length;
    const step = effectiveStep(f, a);
    const meta = [
      `${a.actions} ${a.actions > 1 ? 'actions' : 'action'}`,
      a.bet === 'any' ? `${t('play.bet')} any` : a.bet ? `${t('play.bet')} ${a.bet}` : '',
    ].filter(Boolean).join(' · ');
    return `<button class="action-card ${n ? 'is-queued' : ''}" data-action="play-pick" data-id="${a.id}"
      ${can[a.id] ? '' : 'aria-disabled="true"'} aria-label="${escHtml(a.name)}">
      ${cardFace(a, { size: 'hand' })}
      <span>${escHtml(a.name)}${n ? ` <b class="qty">x${n}</b>` : ''}</span>
      <small class="ac-meta">${escHtml(meta)}${step ? ` ${riskDots(step)}` : ''}</small></button>`;
  }).join('');

  const adv = f.hero.advantage.map((id) => {
    const c = s.cards.byId[id];
    const on = id === 'barrier' && ui.reaction === 'barrier';
    return `<button class="action-card ${on ? 'is-queued' : ''}" data-action="play-adv" data-id="${id}" aria-pressed="${on}" aria-label="${escHtml(c.name)}">
      ${cardFace(c, { size: 'mini' })}<span>${escHtml(c.name)}</span></button>`;
  }).join('');

  // Three bands: what you hold, what you have declared, and what resolves it.
  // The plan lane brings its own heading, and the resolve band's button says
  // what it is, so only the first band spends a line on a label: the board has
  // ~560px of height on a 720px screen and a redundant label costs 16 of them.
  const wait = awaitingStep(f, ui);
  return `<div class="turn-head">
      ${slots}<div class="row">${rerollBtn}${hideBtn}
      <button class="btn ${!plan.length && !Object.values(can).some(Boolean) ? 'btn--primary' : ''}" data-action="play-end-turn">${escHtml(t('play.endTurn'))} ${glyphSvg('skip', '', 16)}</button></div>
    </div>
    <div class="band band--cards">
      <span class="pile-label">${escHtml(t('play.bandCards'))}</span>
      <div class="hand-row">
        <div class="action-cards hand-attacks">${hand}</div>
        ${adv ? `<div class="adv-hand"><span class="pile-label">${escHtml(t('play.advHand'))}</span><div class="action-cards">${adv}</div></div>` : ''}
      </div>
    </div>
    <div class="band band--plan">${planLane(s, f, ui, plan)}</div>
    <div class="band band--go">${wait ? rollPanel(f, ui, wait) : planBar(f, ui, plan)}${verdict(ui)}</div>`;
}

function planLane(s, f, ui, plan) {
  const at = ui.at || 0;
  const hasBarrier = f.hero.advantage.includes('barrier') || ui.reaction === 'barrier';
  const steps = plan.map((st, i) => {
    const a = attackFor(f, st.id);
    if (!a) return '';
    const step = effectiveStep(f, a);
    const bet = betFor(a, st);
    const spare = runeSpare(f, plan);
    const room = readyAt(f, plan, i) + (a.bet === 'any' ? bet : 0);
    const bets = a.bet === 'any'
      ? `<span class="plan-bet">${Array.from({ length: Math.max(room, 1) }, (_, k) => k + 1).map((n) => `<button data-action="play-step-bet" data-i="${i}" data-bet="${n}" aria-pressed="${bet === n}">${n}</button>`).join('')}</span>` : '';
    const rune = step && (st.rune || spare > 0)
      ? `<button class="plan-rune" data-action="play-rune-step" data-i="${i}" aria-pressed="${!!st.rune}" title="${escHtml(t('play.attachTo'))} ${i + 1}">${glyphSvg('adv-rune', '', 15)}</button>` : '';
    const tgt = f.boss.minions.length
      ? `<button class="plan-tgt" data-action="play-step-target" data-i="${i}">${escHtml(typeof st.target === 'number' ? `${MINION.name} ${st.target + 1}` : t('play.body'))}</button>` : '';
    return `<li class="plan-step ${ui.awaiting === i ? 'is-now' : ''} ${i < at ? 'is-done' : ''}">
      <button class="plan-num" data-action="play-unqueue" data-i="${i}" aria-label="${escHtml(t('play.planStep'))} ${i + 1}" title="${escHtml(t('play.planStep'))} ${i + 1}">${i + 1}</button>
      ${cardFace(a, { size: 'mini' })}
      <span class="plan-what"><b>${escHtml(a.name)}</b><small>${bet ? `${escHtml(t('play.bet'))} ${bet}` : ''}${step ? ` ${riskDots(step)}` : ''}${st.rune ? ' auto' : ''}</small></span>
      ${bets}${tgt}${rune}
    </li>`;
  }).join('');
  const react = hasBarrier ? `<li class="plan-step plan-step--react ${ui.reaction ? 'is-on' : ''}">
      <button class="plan-num plan-num--react" data-action="play-park" data-id="barrier" title="${escHtml(t('play.reactionHint'))}">${glyphSvg('shield', '', 15)}</button>
      ${ui.reaction === 'barrier' ? cardFace(s.cards.byId.barrier, { size: 'mini' }) : ''}
      <span class="plan-what"><b>${escHtml(t('play.reaction'))}</b><small>${escHtml(t('play.reactionHint'))}</small></span>
    </li>` : '';
  // The keyboard hint sits on this row, not in the table aside: that column is
  // 158px wide and the same sentence wrapped to four lines there.
  return `<div class="plan-wrap">
    <div class="row row--between"><span class="pile-label">${escHtml(t('play.plan'))}</span><small class="muted">${escHtml(plan.length ? t('play.planHint') : t('play.planEmpty'))}</small><small class="muted plan-keys">${escHtml(t('play.keys'))}</small></div>
    <ul class="plan">${steps}${react}</ul>
    ${ui.error ? `<div class="plan-error">${escHtml(reasonText(ui.error))}</div>` : ''}
  </div>`;
}

function planBar(f, ui, plan) {
  if (!plan.length) return '';
  const v = validatePlan(f, plan);
  return `<div class="row plan-bar">
    <button class="btn btn--primary btn--lg" data-action="play-resolve-plan" ${v.ok ? '' : 'aria-disabled="true"'}>${glyphSvg('dice', '', 18)} ${escHtml(t('play.resolvePlan'))}</button>
    <button class="btn btn--ghost btn--sm" data-action="play-clear-plan">${escHtml(t('play.clearPlan'))}</button>
    ${v.ok ? '' : `<span class="plan-error">${escHtml(reasonText(v.reason))}</span>`}
  </div>`;
}

/** The lane has stopped on a step that needs a die. The roll comes from here. */
function rollPanel(f, ui, wait) {
  const { i, st, a, step } = wait;
  const need = targetFor(f.die, step);
  const dmg = attackDamage(f, a, betFor(a, st));
  return `<div class="panel panel--sunk roll-now">
    <div class="row row--between">
      <b>${escHtml(t('play.planStep'))} ${i + 1}: ${escHtml(a.name)}</b>
      <span>${riskDots(step)} ${escHtml(cap(step))}, ${Math.round(stepOdds(step) * 100)}%: ${escHtml(t('play.need'))} <b>${need}+</b> on ${f.die}</span>
      <span>${dmg} damage${f.boss.braced ? ' (Braced: halved)' : ''}</span>
    </div>
    <div class="row">
      <button class="btn btn--primary btn--lg" data-action="play-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.roll'))}</button>
      <span class="muted small">${escHtml(t('play.typeRoll'))}</span>${typedInput(f, ui)}
      <button class="btn btn--sm" data-action="play-go-typed">Go</button>
    </div>
  </div>`;
}

function verdict(ui) {
  if (!ui.last) return '';
  const l = ui.last;
  return `<div class="row verdict-row">
    ${l.roll !== null && l.roll !== undefined ? `<div class="die-face is-rolling">${l.roll}</div>` : ''}
    <div class="verdict ${l.hit ? 'hit' : 'miss'}">${escHtml(l.name)}: ${l.auto ? 'lands' : l.hit ? escHtml(t('play.hit')) : escHtml(t('play.miss'))}${l.dealt ? `, ${l.dealt} damage` : ''}</div>
  </div>`;
}
