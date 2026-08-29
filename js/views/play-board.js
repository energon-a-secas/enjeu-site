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

import { t, cardName, bossLines } from '../strings.js';
import { escHtml } from '../utils.js';
import { cardFace, cardBack, lifeMini, riskDots } from '../cards/face.js';
import { glyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor, MINION } from '../data/placeholders.js';
import { legalAttacks, ready, spent, broken, alive, bossHp, raging, effectiveStep, attackDamage, reviveStep, ALLY_DEF } from '../game/engine.js';
import { targetFor, dieMax, stepOdds, reactionFor } from '../game/rules.js';
import { validatePlan, planActions, attackFor, betFor, readyAt, runeSpare, pickable, awaitingStep } from './play-plan.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

/**
 * A boss reaction, named in the player's language. cards.json carries the
 * English name and now an id; the id is what the string table is keyed on, so
 * the board, the printed aid and the rulebook all say the same word. Before
 * this the board said "Brace" while the Spanish rulebook said "Aguante".
 */
/**
 * How hard a hit reads. Every hit used to shake the boss the same 6px, so a
 * 300-damage All In landed with the weight of a 25 Strike. Three classes keyed
 * off the number the player already watched being computed.
 */
const hitWeight = (dealt) => (dealt >= 300 ? 'hit-xl' : dealt >= 100 ? 'hit-big' : '');

const reactionName = (p) => (p?.kind ? t(`play.reactionName.${p.kind}`) : p?.name || '');

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

/**
 * The boss's life, as the wall of cards it is on the table. This is the board's
 * centre of gravity, so it draws EVERY card: the old pile capped at 8 with a
 * "+12" badge, which is right for a pile in a corner and wrong for the thing the
 * whole fight is about. Twenty cards that visibly come apart is the point.
 *
 * The leading card is drawn part-broken, and that detail is load-bearing rather
 * than decorative. Damage arrives in 25s and a card is worth 100, so a wall of
 * whole cards only moves on one hit in four: as a progress bar it would be
 * COARSER than the numeral it replaces. The fraction makes it exact to 25.
 */
const WALL_SHAPE = { 1: 1, 2: 2, 3: 3, 4: 4, 5: 5, 6: 3, 7: 4, 8: 4, 9: 5, 10: 5, 11: 4, 12: 6, 20: 5 };
export function wallShape(cards, narrow = false) {
  if (cards <= 0) return { cols: 1, rows: 1 };
  if (narrow) { const cols = Math.min(cards, 10); return { cols, rows: Math.ceil(cards / cols) }; }
  const cols = WALL_SHAPE[cards] || Math.min(cards, 6);
  return { cols, rows: Math.ceil(cards / cols) };
}

function bossWall(f, ui = {}) {
  const per = f.boss.perCard || 100;
  const whole = Math.floor(f.boss.body / per);
  const part = f.boss.body - whole * per;                 // 0, 25, 50 or 75
  const cards = whole + (part > 0 ? 1 : 0);
  const { cols, rows } = wallShape(cards + (ui.wallFell || 0));
  const lead = part > 0
    ? `<span class="lc-part" style="--frac:${(part / per).toFixed(2)}" aria-hidden="true">${lifeMini('boss')}</span>`
    : '';
  // The cards this exact hit knocked off, rendered one more frame so the child
  // sees a brick fall out of the wall instead of noticing, a beat later, that
  // the wall is shorter. They keep their grid cell for the frame; reduced
  // motion zeroes the keyframe and they are simply gone, which is the old
  // behaviour exactly.
  const falling = `<span class="lc-falls" aria-hidden="true">${lifeMini('boss')}</span>`.repeat(ui.fx === 'hit' || ui.fx === 'boss-felled' ? (ui.wallFell || 0) : 0);
  return `<div class="wall" style="--wall-cols:${cols};--wall-rows:${rows}"
    role="img" aria-label="${escHtml(t('play.bossLife'))}: ${f.boss.body} / ${f.boss.maxHp}"
    >${falling}${lead}${lifeMini('boss').repeat(whole)}</div>`;
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
  const slot = (label, art, note, id) => {
    const title = `${label}: ${note || t('play.inTheBox')}`;
    const inner = `<span class="tbl-slot__art">${art || '<span class="stack-of is-empty"></span>'}</span>
      <span class="tbl-slot__n">${escHtml(note || '')}</span>`;
    return id
      ? `<button class="tbl-slot" data-action="cards-detail" data-id="${escHtml(id)}" title="${escHtml(title)}" aria-label="${escHtml(title)}">${inner}</button>`
      : `<div class="tbl-slot" title="${escHtml(title)}" aria-label="${escHtml(title)}" role="img">${inner}</div>`;
  };
  // Only the piles that exist. Three of the six were hard-coded empty in a First
  // Game (no draw pile, no Advantage deck, and no extra lives outside a Village),
  // so half the rail was dashed outlines promising piles the mode cannot have.
  // The boss pile is gone from here entirely: the wall in the middle of the duel
  // IS the boss pile, and drawing it twice made the smaller copy the wrong one.
  const rows = [
    slot(t('play.biomeCard'), biome ? cardFace(biome, { size: 'mini' }) : '', biome?.name || '', biome?.id),
    first ? '' : slot(t('play.drawPile'), stackOf(cardBack('skill', { size: 'mini' }), run.skillPool.length), String(run.skillPool.length)),
    first ? '' : slot(t('play.advPile'), stackOf(cardBack('skill', { size: 'mini' }), run.advDeck.length), String(run.advDeck.length)),
    run.extraLives ? slot(t('play.extraPile'), stackOf(lifeMini('extra'), run.extraLives), String(run.extraLives)) : '',
    run.secondWind && sw ? slot(t('play.secondWind'), cardFace(sw, { size: 'mini' }), 'in play', sw.id) : '',
  ].filter(Boolean);
  return `<aside class="panel panel--tight fight-table" aria-label="${escHtml(t('play.table'))}">${rows.join('')}</aside>`;
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
      <b>${escHtml(reactionName(p))}</b><span>${what}</span></p>`;
  }
  const say = bossLines() || {};
  // The endings own the bubble outright: on a win the figure is felled and the
  // old idle lines ('It is not standing straight any more') read as a boss that
  // is still up, which was a verified incoherence next to the victory banner.
  if (f.phase === 'won') return `<p class="bubble is-said" role="status">${escHtml((say.win || [])[f.level % (say.win?.length || 1)] || '')}</p>`;
  if (f.phase === 'lost' || f.phase === 'stall') return `<p class="bubble is-said" role="status">${escHtml((say.loss || [])[f.level % (say.loss?.length || 1)] || '')}</p>`;
  if (ui.event && say.events?.[ui.event]) return `<p class="bubble is-event" role="status">${escHtml(say.events[ui.event])}</p>`;
  if (ui.bossSaid) return `<p class="bubble is-said" role="status">${escHtml(ui.bossSaid)}</p>`;
  if (raging(f)) return `<p class="bubble is-alarm" role="status"><b>${escHtml(t('play.rage'))}</b></p>`;
  if (f.round === f.boss.rage - 1) return `<p class="bubble is-alert" role="status">${escHtml(t('play.rageSoon'))}</p>`;
  return `<p class="bubble" role="status">${escHtml(bossIdle(f))}</p>`;
}

/**
 * What the boss says while nothing is resolving. This is the line most often on
 * the screen, and it was one sentence forever.
 *
 * The state lines come first and the most specific wins, so the boss reacts to
 * what is actually on the table: it cannot find you while you are Hidden, it
 * eyes the Ally, it notices when you are nearly out of cards. What is left
 * rotates BY ROUND rather than at random, because render() runs on every click
 * and a random line would flicker a new sentence every time you picked a card.
 */
function bossIdle(f) {
  const say = bossLines();
  if (!say) return t('play.bossWatch');
  if (f.hero.hidden) return say.hidden;
  if (f.boss.braced) return say.braced;
  if (f.boss.minions.length) return say.minions;
  if (f.hero.ally) return say.allyNear;
  if (bossHp(f) <= f.boss.maxHp * 0.34) return say.bossHurt;
  if (alive(f) <= 1) return say.heroHurt;
  // Each boss gets its own two lines INTERLEAVED into the shared rotation, not
  // appended: the level 1 boss rages from round 4, so lines parked at the tail
  // of a six-line rotation would never be reachable before the bubble switches
  // to the Rage alarm. Round 1 still opens on 'The boss watches you.'
  const base = say.idle || [];
  const own = say.bossIdle?.[f.boss.id] || [];
  const idle = base.flatMap((l, i) => (own[i] ? [l, own[i]] : [l]));
  // Rounds start at 1, so without the offset the first thing a player ever
  // sees is the second line and 'The boss watches you.' never opens a fight.
  return idle.length ? idle[(f.round - 1) % idle.length] : t('play.bossWatch');
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
  if (f.pending) { big = f.pending.roll; note = `d6 · ${reactionName(f.pending)}`; cls = 'is-rolling'; }
  else if (wait) {
    big = `${targetFor(f.die, wait.step)}+`;
    note = `${wait.a.name} · ${cap(wait.step)}`;
    cls = 'is-waiting';
  } else if (ui.last && ui.last.roll !== null && ui.last.roll !== undefined) {
    big = ui.last.roll;
    note = ui.last.hit ? t('play.hit') : t('play.miss');
    cls = `is-rolling ${ui.last.hit ? 'is-good' : 'is-bad'}`;
  } else {
    // The die you actually chose, drawn as that die. A generic d6 pip face sat
    // under the label "d20" for every player who picked one, which is the same
    // caption-fights-picture defect the teaching slide had.
    big = glyphSvg(`die-${f.die.replace(/^\d+/, '')}`, '', 34) || glyphSvg('dice', '', 30);
    note = f.die;
  }
  // It lives beside the hand, not opposite the boss. The old cell was 504x169
  // and 93.3% empty, and it sat 300px above the roll button, the typed-roll box
  // and the verdict, which is where a player is actually looking while rolling.
  return `<div class="die-cell"><div class="die-face ${cls}">${big}</div><small class="muted">${escHtml(note)}</small></div>`;
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
  // Only what is actually on. Five dimmed slots were drawn permanently so the
  // row would not reflow, and in a First Game three of the five could never
  // light up at all: Relic, Rune and Ally are set only by playAdvantage, which
  // that mode never reaches. Five labelled boxes meaning "you do not have this"
  // is a promise the mode cannot keep. The row reserves its height in CSS
  // instead, so nothing jumps when the first one arrives.
  const on = [
    f.hero.relic ? slot(t('play.relic'), glyphSvg('adv-relic', '', 22), true) : '',
    f.hero.rune > 0 ? slot(t('play.rune'), glyphSvg('adv-rune', '', 22), true, `${t('play.rune')} ${f.hero.rune}`) : '',
    f.hero.shield > 0 ? slot(t('play.bubbleSlot'), glyphSvg('bubble', '', 22), true, `${f.hero.shield} absorbed`) : '',
    f.hero.hidden ? slot(t('play.hidden'), glyphSvg('eye', '', 22), true) : '',
    f.hero.ally || ui.fx === 'ally-gone' ? ally : '',
  ].filter(Boolean).join('');
  return `<div class="gear-row" aria-label="${escHtml(t('play.shelf'))}">${on}</div>`;
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
  const logOpen = s.play?.logOpen !== false;
  const fx = ui.fx || '';
  const bossRing = (ui.target === undefined || ui.target === 'body') ? 'is-target' : '';
  const last = f.log.length ? f.log[f.log.length - 1] : null;

  return `
  <div class="container container--wide board-fit">
    <div class="fight-bar">
      <div class="fight-bar__who">
        <b>${escHtml(roster.name || f.boss.name)}</b>
        <span class="muted small">${f.boss.size}${roster.element ? ` · ${escHtml(cap(roster.element))}` : ''} · ${escHtml(t('play.level'))} ${f.level} · <span class="round-chip ${ui.roundNew ? 'round-pop' : ''} ${f.round === f.boss.rage - 1 ? 'round-warn' : ''} ${raging(f) ? 'round-rage' : ''}">${escHtml(t('play.round'))} ${f.round}</span> · ${escHtml(biome?.name || '')}${biome?.rule ? ` (${escHtml(biome.rule)})` : ''}</span>
      </div>
      <div class="row"><span class="chip" aria-pressed="false">${f.die} · ${escHtml(t(`play.${f.mode}`))}</span>
        <button class="btn btn--ghost btn--sm" data-action="play-log" aria-pressed="${logOpen}">${glyphSvg('book', '', 16)} ${escHtml(t(logOpen ? 'play.logHide' : 'play.logShow'))}</button>
        <button class="btn btn--ghost btn--sm ${ui.confirmAbandon ? 'btn--danger' : ''}" data-action="play-abandon">${escHtml(t(ui.confirmAbandon ? 'play.abandonSure' : 'play.abandon'))}</button></div>
    </div>
    <div class="fight-grid" data-log="${logOpen ? 'open' : 'closed'}">
      ${tablePanel(s, run, f)}
      <div class="fight-main">
        <div class="duel ${raging(f) ? 'is-raging' : ''} ${ui.rageIn ? 'rage-in' : ''} duel--${escHtml(biome?.id || 'plain')}">
          <div class="duel__hero">
            <div class="figure ${fx === 'hurt' ? 'is-hit' : ''}">
              ${figureSvg({ ...hero, klass: run.klass })}<b>${escHtml(hero.name)}</b>
              ${fx === 'hurt' && ui.took ? `<span class="fx-num fx-num--bad">-${ui.took}</span>` : ''}
            </div>
            <div class="pile-label">${escHtml(t('play.ready'))} ${ready(f)} · ${escHtml(t('play.spent'))} ${spent(f)} · ${escHtml(t('play.broken'))} ${broken(f)}</div>
            <div class="pile">${heroPile(f)}</div>
            ${shelf(f, ui)}
          </div>
          <div class="duel__wall">
            <div class="wall-count"><b>${bossHp(f)}</b><span class="muted small">/ ${f.boss.maxHp}</span>${f.boss.braced ? '<span class="chip">Braced</span>' : ''}</div>
            ${bossWall(f, ui)}
          </div>
          <div class="duel__boss ${bossRing}">
            ${bubble(f, ui)}
            <div class="figure ${fx === 'hit' || fx === 'boss-felled' ? `is-hit ${hitWeight(ui.dealt)}` : ''} ${fx === 'miss' ? 'is-missed' : ''} ${f.phase === 'won' ? 'is-felled' : ''}">
              ${figureSvg(roster)}<b>${escHtml(roster.name || '')}</b>
              ${(fx === 'hit' || fx === 'boss-felled') && ui.dealt ? `<span class="fx-num fx-num--bad ${hitWeight(ui.dealt)}">-${ui.dealt}</span>` : ''}
              ${fx === 'miss' ? `<span class="fx-num">${escHtml(t('play.miss'))}</span>` : ''}
            </div>
            ${targets(f, ui, roster)}
          </div>
        </div>
        ${last ? `<p class="log-tick ${last.cls}">${escHtml(last.text)}</p>` : ''}
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
    // The child throws the REAL d6 and taps the face it shows. Hero rolls
    // always accepted the physical die; the boss's was the one screen-only
    // roll in the game, and it is also the single best job to hand a small
    // child. Each chip teaches its consequence underneath, in the reaction's
    // own name. The auto-roll stays as the primary so Enter still works and a
    // table with no d6 loses nothing.
    const faces = [1, 2, 3, 4, 5, 6].map((n) => {
      const rx = f.data ? reactionFor(f.data, n) : null;
      const label = rx?.id ? t(`play.reactionName.${rx.id}`) : '';
      return `<button class="die-chip" data-action="play-boss-face" data-face="${n}" aria-label="${n}: ${escHtml(label)}">
        <span class="die-chip__n">${n}</span><small>${escHtml(label)}</small></button>`;
    }).join('');
    return `<div class="row row--between"><b>${escHtml(t('play.bossTurn'))}</b>
      <button class="btn btn--primary btn--lg" data-action="play-boss-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.bossRollFor'))}</button></div>
      <div class="boss-ask"><span class="pile-label">${escHtml(t('play.bossAsk'))}</span>
      <div class="die-chips">${faces}</div></div>`;
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
      <div class="grow"><b>${escHtml(reactionName(p))}</b>${what}${atAlly ? ` · ${escHtml(t('play.aimedAtAlly'))}` : ''}</div>
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
    // What the card DOES, on hover and in the accessible name. The face carries
    // no words by design, so until now the only way to learn what a Bubble was
    // for was to read the rulebook: the board showed a picture, a cost and a
    // number, and never the reason.
    const what = t(`play.what.${a.id}`);
    const explains = !what.startsWith('[');
    return `<button class="action-card ${n ? 'is-queued' : ''}" data-action="play-pick" data-id="${a.id}"
      ${can[a.id] ? '' : 'aria-disabled="true"'}
      ${explains ? `title="${escHtml(`${cardName(a)}. ${what}`)}"` : ''}
      aria-label="${escHtml(explains ? `${cardName(a)}. ${what}` : cardName(a))}">
      ${cardFace(a, { size: 'hand' })}
      <span>${escHtml(cardName(a))}${n ? ` <b class="qty">x${n}</b>` : ''}</span>
      <small class="ac-meta">${escHtml(meta)}${step ? ` ${riskDots(step)}` : ''}</small></button>`;
  }).join('');

  const adv = f.hero.advantage.map((id) => {
    const c = s.cards.byId[id];
    const on = id === 'barrier' && ui.reaction === 'barrier';
    return `<button class="action-card ${on ? 'is-queued' : ''}" data-action="play-adv" data-id="${id}" aria-pressed="${on}"
      title="${escHtml(`${cardName(c)}. ${c.effect || ''}`.trim())}" aria-label="${escHtml(`${cardName(c)}. ${c.effect || ''}`.trim())}">
      ${cardFace(c, { size: 'mini' })}<span>${escHtml(cardName(c))}</span></button>`;
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
      <div class="hand-row">
        ${dieCell(f, ui)}
        <div class="action-cards hand-attacks">${hand}</div>
        ${adv ? `<div class="adv-hand"><span class="pile-label">${escHtml(t('play.advHand'))}</span><div class="action-cards">${adv}</div></div>` : ''}
      </div>
    </div>
    <div class="band band--plan">${planLane(s, f, ui, plan)}${plan.length ? `<button class="btn btn--ghost btn--sm plan-undo" data-action="play-undo-last">${escHtml(t('play.undoLast'))}</button>` : ''}</div>
    <div class="band band--go">${wait ? rollPanel(f, ui, wait) : planBar(f, ui, plan)}${verdict(ui)}</div>`;
}

function planLane(s, f, ui, plan) {
  const justQueued = ui.fx === 'queued' ? plan.length - 1 : -1;
  const at = ui.at || 0;
  const hasBarrier = f.hero.advantage.includes('barrier') || ui.reaction === 'barrier';
  const steps = plan.map((st, i) => {
    const settled = i === justQueued ? ' just-queued' : '';
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
    return `<li class="plan-step ${ui.awaiting === i ? 'is-now' : ''} ${i < at ? 'is-done' : ''}${settled}">
      <button class="plan-num" data-action="play-unqueue" data-i="${i}" aria-label="${escHtml(t('play.planStep'))} ${i + 1}" title="${escHtml(t('play.planStep'))} ${i + 1}">${i + 1}</button>
      ${cardFace(a, { size: 'mini' })}
      <span class="plan-what"><b>${escHtml(cardName(a))}</b><small>${bet ? `${escHtml(t('play.bet'))} ${bet}` : ''}${step ? ` ${riskDots(step)}` : ''}${st.rune ? ' auto' : ''}</small></span>
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
      <b>${escHtml(t('play.planStep'))} ${i + 1}: ${escHtml(cardName(a))}</b>
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
