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

import { t, cardName, bossLines, elementName } from '../strings.js';
import { logLine } from './logline.js';
import { escHtml } from '../utils.js';
import { cardFace, cardBack, lifeMini, riskDots } from '../cards/face.js';
import { glyphSvg, artGlyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor, MINION } from '../data/placeholders.js';
import { lastLevel } from '../game/run.js';
import { legalAttacks, ready, spent, broken, alive, bossHp, raging, effectiveStep, attackDamage, reviveStep, ALLY_DEF, canBreak, breakStepFor, breakCost, BREAK_REWARDS } from '../game/engine.js';
import { targetFor, dieMax, stepOdds, reactionFor } from '../game/rules.js';
import { validatePlan, planActions, attackFor, betFor, readyAt, runeSpare, pickable, awaitingStep, betRoom } from './play-plan.js';

const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');
/** A check step's name, in the reader's language (cards.step.<id>). */
const stepName = (step) => (step ? t(`cards.step.${step}`) : '');

/**
 * A biome's rule, translated. cards.json carries the English sentence and the
 * string table carries both, keyed by card id; a Spanish board used to print
 * the English one in brackets after a Spanish name.
 */
const biomeRule = (b) => {
  if (!b?.rule) return '';
  const k = t(`cards.effect.${b.id}`);
  return k.startsWith('[') ? b.rule : k;
};

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

const reactionName = (p) => (p?.sig ? t(`play.signatureName.${p.sig}`)
  : p?.kind ? t(`play.reactionName.${p.kind}`) : p?.name || '');

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
  // The wall's GEOMETRY comes from the boss at full life, never from what is
  // left of it. --wall-card in css/play.css divides the available space by the
  // column and row counts, so counts that shrank with the wall made every
  // surviving card grow: a 20 card boss down to two was rendering them at the
  // 148px ceiling, wider than it had ever drawn a card, and the whole board
  // reflowed around it. Sizing from the maximum means a card is one size for
  // the whole fight and losing one takes a card off the wall rather than
  // inflating its neighbours, which is also what happens on a real table.
  const maxCards = Math.max(1, Math.ceil((f.boss.maxHp || f.boss.body) / per));
  const { cols } = wallShape(maxCards);
  const rows = Math.ceil(maxCards / cols);
  const lead = part > 0
    ? `<span class="lc-part" style="--frac:${(part / per).toFixed(2)}" aria-hidden="true">${lifeMini('boss')}</span>`
    : '';
  // The cards this exact hit knocked off, rendered one more frame so the child
  // sees a brick fall out of the wall instead of noticing, a beat later, that
  // the wall is shorter. They keep their grid cell for the frame; reduced
  // motion zeroes the keyframe and they are simply gone, which is the old
  // behaviour exactly.
  const falling = `<span class="lc-falls" aria-hidden="true">${lifeMini('boss')}</span>`.repeat(ui.fx === 'hit' || ui.fx === 'boss-felled' ? (ui.wallFell || 0) : 0);
  // Every card in the wall says what it is worth on hover, and the leading one
  // says how much of it is left. The wall is the boss's life and a player asked
  // the obvious question of it: how much is each of those? The aria-label above
  // still carries the total, so a screen reader hears the number without having
  // to walk twenty cards.
  const each = `${escHtml(t('play.bossLife'))}: ${per}`;
  const partLabel = `${escHtml(t('play.bossLife'))}: ${part} / ${per}`;
  const card = `<span class="lc-hit" title="${each}" aria-hidden="true">${lifeMini('boss')}</span>`;
  return `<div class="wall" style="--wall-cols:${cols};--wall-rows:${rows}"
    role="img" aria-label="${escHtml(t('play.bossLife'))}: ${f.boss.body} / ${f.boss.maxHp}"
    >${falling}${part > 0 ? `<span class="lc-hit" title="${partLabel}" aria-hidden="true">${lead}</span>` : ''}${card.repeat(whole)}</div>`;
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
    slot(t('play.biomeCard'), biome ? cardFace(biome, { size: 'mini' }) : '', biome ? cardName(biome) : '', biome?.id),
    first ? '' : slot(t('play.drawPile'), stackOf(cardBack('skill', { size: 'mini' }), run.skillPool.length), String(run.skillPool.length)),
    first ? '' : slot(t('play.advPile'), stackOf(cardBack('skill', { size: 'mini' }), run.advDeck.length), String(run.advDeck.length)),
    run.extraLives ? slot(t('play.extraPile'), stackOf(lifeMini('extra'), run.extraLives), String(run.extraLives)) : '',
    run.secondWind && sw ? slot(t('play.secondWind'), cardFace(sw, { size: 'mini' }), t('play.shelf'), sw.id) : '',
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
      ? `${p.dmg} ${escHtml(t('play.damage'))}, ${escHtml(p.rage ? t('play.unguardable') : at)}`
      : p.kind === 'brace' ? escHtml(t('play.braceWhat'))
        : p.kind === 'summon' ? `${p.chunk} ${escHtml(t('play.summonWhat'))}` : '';
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
  if (ui.bossSaid) return `<p class="bubble is-said" role="status">${escHtml(logLine(ui.bossSaid))}</p>`;
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
  else if (f.foretold) { big = f.foretold; note = `d6 · ${escHtml(cardName({ id: 'taunt', name: 'Taunt' }))}`; cls = 'is-waiting'; }
  else if (wait) {
    big = `${targetFor(f.die, wait.step)}+`;
    note = `${cardName(wait.a)} · ${stepName(wait.step)}`;
    cls = 'is-waiting';
  } else if (ui.last && ui.last.roll !== null && ui.last.roll !== undefined) {
    big = ui.last.roll;
    note = ui.last.hit ? t('play.hit') : t('play.miss');
    cls = `is-rolling ${ui.last.hit ? 'is-good' : 'is-bad'}`;
  } else {
    // The die you actually chose, drawn as that die. A generic d6 pip face sat
    // under the label "d20" for every player who picked one, which is the same
    // caption-fights-picture defect the teaching slide had.
    big = artGlyphSvg(`die-${f.die.replace(/^\d+/, '')}`, '', 34) || glyphSvg('dice', '', 30);
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
  const slot = (label, glyph, on, note) => `<div class="gear ${on ? 'is-on' : ''}" title="${escHtml(`${label}: ${on ? note || t('play.shelf') : t('play.slotEmpty')}`)}">
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
    f.hero.shield > 0 ? slot(t('play.bubbleSlot'), glyphSvg('bubble', '', 22), true, `${f.hero.shield} ${t('play.absorbed')}`) : '',
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
  const logOpen = s.play?.logShown === true;
  const fx = ui.fx || '';
  // The gold ring answers "which target will my attacks hit". With no minions
  // on the table there is no choice to show, and the permanent square outline
  // around the boss read as decoration gone wrong.
  const bossRing = f.boss.minions.length && (ui.target === undefined || ui.target === 'body') ? 'is-target' : '';
  const tour = tourState(s, f);
  const last = f.log.length ? f.log[f.log.length - 1] : null;

  return `
  <div class="container container--wide board-fit" ${tour ? `data-tour-on="${tour.key}"` : ''}>
    <div class="fight-bar">
      <div class="fight-bar__who">
        <b>${escHtml(roster.name || f.boss.name)}</b>
        <span class="muted small">${f.boss.size}${roster.element ? ` · ${escHtml(elementName(roster.element))}` : ''} · ${escHtml(t('play.level'))} ${f.level} · <span class="round-chip ${ui.roundNew ? 'round-pop' : ''} ${f.round === f.boss.rage - 1 ? 'round-warn' : ''} ${raging(f) ? 'round-rage' : ''}">${escHtml(t('play.round'))} ${f.round}</span>${biome ? ` · ${escHtml(cardName(biome))}${biomeRule(biome) ? ` (${escHtml(biomeRule(biome))})` : ''}` : ''}</span>
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
            <div class="pile" data-tour="life">${heroPile(f)}</div>
            ${shelf(f, ui)}
          </div>
          <div class="duel__wall" data-tour="wall">
            <div class="wall-count"><b>${bossHp(f)}</b><span class="muted small">/ ${f.boss.maxHp}</span>${f.boss.braced ? `<span class="chip">${escHtml(t('play.reactionName.brace'))}</span>` : ''}</div>
            ${bossWall(f, ui)}
          </div>
          <div class="duel__boss ${bossRing}">
            ${bubble(f, ui)}
            <div class="figure ${fx === 'hit' || fx === 'boss-felled' || fx === 'break-ok' ? `is-hit ${hitWeight(ui.dealt)}` : ''} ${fx === 'miss' || fx === 'break-no' ? 'is-missed' : ''} ${f.phase === 'won' ? 'is-felled' : ''}">
              ${figureSvg(roster)}<b>${escHtml(roster.name || '')}</b>
              ${(fx === 'hit' || fx === 'boss-felled' || fx === 'break-ok') && ui.dealt ? `<span class="fx-num fx-num--bad ${hitWeight(ui.dealt)}">-${ui.dealt}</span>` : ''}
              ${fx === 'miss' || fx === 'break-no' ? `<span class="fx-num">${escHtml(t('play.miss'))}</span>` : ''}
            </div>
            ${targets(f, ui, roster)}
          </div>
        </div>
        ${last ? `<p class="log-tick ${last.cls}">${escHtml(logLine(last.text))}</p>` : ''}
        <div class="panel actions">${renderActions(s, run, f, ui)}</div>
      </div>
      ${!logOpen ? '' : `<aside class="panel panel--tight fight-log-below">
        <p class="kicker">${escHtml(t('play.log'))}</p>
        <ul class="log">${f.log.slice(-60).reverse().map((l) => `<li class="${l.cls}">${escHtml(logLine(l.text))}</li>`).join('')}</ul>
      </aside>`}
    </div>
    ${tour ? tourCallout(tour) : ''}
  </div>`;
}

// ── The action panel, one phase at a time ────────────────────
/**
 * The first-fight tour: four sentences, each pointing at the region it names.
 * It lives on the SESSION (s.play), not the run: one tour per device, and
 * skipping it is remembered. Only the hero's own turn shows it; the boss
 * phase has its own teaching row.
 */
const TOUR_STEPS = ['wall', 'life', 'hand', 'go'];
function tourState(s, f) {
  const play = s.play ||= {};
  if (play.tourDone || f.phase !== 'act') return null;
  const step = Math.max(0, Math.min(TOUR_STEPS.length - 1, play.tourStep || 0));
  return { key: TOUR_STEPS[step], step, last: step === TOUR_STEPS.length - 1 };
}
function tourCallout(tour) {
  return `<div class="tour-callout" role="dialog" aria-label="${escHtml(t(`play.tour.${tour.key}`))}">
    <p>${escHtml(t(`play.tour.${tour.key}`))}</p>
    <div class="row">
      <button class="btn btn--sm btn--primary" data-action="play-tour-next">${escHtml(t(tour.last ? 'play.tour.done' : 'play.tour.next'))}</button>
      ${tour.last ? '' : `<button class="btn btn--sm btn--ghost" data-action="play-tour-skip">${escHtml(t('play.tour.skip'))}</button>`}
    </div>
  </div>`;
}

function renderActions(s, run, f, ui) {
  if (f.phase === 'won') {
    return `<div class="banner banner--win">${escHtml(t('play.won'))}</div>
      <div class="row"><button class="btn btn--primary btn--lg" data-action="play-continue">${escHtml(f.level >= lastLevel(run.kind) ? t('play.finish') : t('play.nextLevel'))}</button></div>`;
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
    ? `${escHtml(t('play.downLadder'))} ${riskDots(step)} <b>${escHtml(stepName(step))}</b>: ${escHtml(t('play.need'))} <b>${need}+</b> ${escHtml(f.die)}`
    : `<b>${escHtml(t('play.downFree'))}</b>`;
  return `<div class="banner banner--lose">${escHtml(t('play.down'))} · ${escHtml(t('play.secondWind'))}</div>
    <div class="row row--between"><span>${line}</span>
      ${step ? `<span class="row"><span class="muted small">${escHtml(t('play.typeRoll'))}</span>${typedInput(f, ui)}</span>` : ''}</div>
    <div class="row">
      <button class="btn btn--primary btn--lg" data-action="play-revive">${glyphSvg('revive', '', 18)} ${escHtml(t('play.reviveTry'))}</button>
      <button class="btn btn--ghost" data-action="play-give-up">${escHtml(t('play.reviveGiveUp'))}</button>
    </div>`;
}

/**
 * The popup's shell, and the reason it is a function rather than three literals.
 *
 * render() replaces the board's markup WHOLESALE on every action, so the
 * backdrop element is destroyed and rebuilt every time you click anything while
 * a popup is open. Its entry animation fades the scrim up from transparent, and
 * replaying that on every click meant each die throw flashed the full bright
 * page for 200ms before it darkened again: reported as the page refreshing,
 * white and hard on the eyes, which is exactly what it was.
 *
 * The scrim therefore does not animate at all. A one-shot entry was tried first
 * and abandoned: gating it on "did a popup exist in the previous render" is
 * correct on paper and could not be demonstrated in the browser, and an
 * animation nobody can prove fires exactly once is an animation that will flash
 * again the next time the render path changes. The fade was decoration and the
 * decoration was the harm. The function stays because three copies of this
 * markup is how the three popups drift apart.
 */
function backdrop(inner, label, cls = '') {
  return `<div class="rm-backdrop"><div class="rm ${cls}" role="dialog" aria-modal="true"
    aria-label="${label}">${inner}</div></div>`;
}

/**
 * The boss's turn, in the SAME popup the hero's rolls use.
 *
 * It was plain in-flow markup until 2026-08-30, and on a phone that put the
 * face it rolled 15px below the fold and the only button that continues the
 * game 65px below it (measured at 390x844; at 360x740 it was 169px). The
 * player tapped "roll for the boss", nothing visibly happened, and the game
 * looked frozen. A fixed-position dialog is not decoration here: it is the
 * difference between seeing the die and not.
 *
 * The button that THROWS is the primary, and the six faces are the quiet row
 * underneath. That is the right way round: the throw is the thing to do, and
 * typing in a result is the fallback for a table that has its own d6 on it.
 */
function renderBoss(s, f, ui) {
  const p = f.pending;
  return backdrop(p ? bossPending(f, ui, p) : bossThrow(f, ui), escHtml(t('play.bossTurn')), 'rm--boss');
}

/** The six faces, each teaching its consequence in the reaction's own name. */
function faceChips(f, action) {
  return [1, 2, 3, 4, 5, 6].map((n) => {
    const rx = f.data ? reactionFor(f.data, n) : null;
    const sig = f.boss.signature;
    const label = sig && sig.roll === n ? t(`play.signatureName.${sig.id}`) : rx?.id ? t(`play.reactionName.${rx.id}`) : '';
    return `<button class="die-chip ${sig && sig.roll === n ? 'die-chip--sig' : ''}" data-action="${action}" data-face="${n}" aria-label="${n}: ${escHtml(label)}">
      <span class="die-chip__n">${n}</span><small>${escHtml(label)}</small></button>`;
  }).join('');
}

function bossThrow(f, ui) {
  return `<p class="rm-what"><b>${escHtml(t('play.bossTurn'))}</b><span>${escHtml(t('play.bossAskHow'))}</span></p>
    <div class="rm-die">${dieThrow(f, ui, null, 'd6')}</div>
    <div class="row rm-row rm-row--one">
      <button class="btn btn--primary btn--lg" data-action="play-boss-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.bossThrow'))}</button>
    </div>
    <div class="boss-ask"><small class="muted">${escHtml(t('play.bossOwnDie'))}</small>
    <div class="die-chips">${faceChips(f, 'play-boss-face')}</div></div>`;
}

function bossPending(f, ui, p) {
  const hasBarrier = f.hero.advantage.includes('barrier');
  const parked = ui.reaction === 'barrier' && hasBarrier;
  const atAlly = p.at === 'ally' && f.hero.ally;
  const what = p.dmg ? `${p.dmg} ${t('play.damage')}${p.rage ? `, ${t('play.unguardable')}` : ''}`
    : p.kind === 'brace' ? t('play.braceWhat')
      : p.kind === 'summon' ? `${p.chunk} ${t('play.summonWhat')}` : '';
  // A parked Barrier is a declared intention, not an automatic cancel: Brace
  // deals nothing, and spending the card on it would be a waste the player
  // never chose. Parking makes it the primary button, so Enter plays it.
  const barrierBtn = hasBarrier
    ? `<button class="btn ${parked ? 'btn--primary btn--lg' : ''}" data-action="play-resolve" data-barrier="1">${glyphSvg('adv-barrier', '', 16)} ${escHtml(t('play.barrierPrompt'))}</button>` : '';
  // Cover is never the primary: letting the Ally's defense do its job is the
  // free option, and taking the hit whole instead is the deliberate one.
  const coverBtn = atAlly
    ? `<button class="btn" data-action="play-resolve" data-barrier="0" data-cover="1" title="${escHtml(t('play.coverHint'))}">${glyphSvg('shield', '', 16)} ${escHtml(t('play.cover'))}</button>` : '';
  const letLabel = atAlly ? `${t('play.ally')}: ${ALLY_DEF} ${t('play.allyDef')}` : hasBarrier ? t('play.letItHappen') : t('play.takeIt');
  const letBtn = `<button class="btn ${parked ? '' : 'btn--primary btn--lg'}" data-action="play-resolve" data-barrier="0">${escHtml(letLabel)}</button>`;
  return `<p class="rm-what"><b>${escHtml(t('play.bossThrown'))} ${p.roll}: ${escHtml(reactionName(p))}</b>
      <span>${escHtml(what)}${atAlly ? ` \u00b7 ${escHtml(t('play.aimedAtAlly'))}` : ''}</span></p>
    <div class="rm-die">${dieThrow(f, ui, p.roll, 'd6', ui.fx === 'boss-die')}</div>
    <div class="row rm-row">${parked ? barrierBtn + letBtn + coverBtn : letBtn + coverBtn + barrierBtn}</div>`;
}

const typedInput = (f, ui) => `<input type="number" min="1" max="${dieMax(f.die)}" value="${ui.typed || ''}" data-change="play-typed" class="typed-roll" aria-label="${escHtml(t('play.typeRoll'))}">`;

// ── Phase: your turn (the hand, the plan lane, one button) ────
function renderTurn(s, run, f, ui) {
  // Taunt was played and the table has not yet said what the real d6 showed.
  // Nothing else on the turn can sensibly continue: the whole point of the
  // card is to act on the answer.
  if (f.awaitForetell) {
    const faces = [1, 2, 3, 4, 5, 6].map((n) => {
      const rx = f.data ? reactionFor(f.data, n) : null;
      const sig = f.boss.signature;
      const label = sig && sig.roll === n ? t(`play.signatureName.${sig.id}`) : rx?.id ? t(`play.reactionName.${rx.id}`) : '';
      return `<button class="die-chip" data-action="play-foretell-face" data-face="${n}">
        <span class="die-chip__n">${n}</span><small>${escHtml(label)}</small></button>`;
    }).join('');
    return `<div class="row row--between"><b>${escHtml(cardName(s.cards.byId.taunt))}</b></div>
      <div class="boss-ask"><span class="pile-label">${escHtml(t('play.bossAsk'))}</span>
      <div class="die-chips">${faces}</div></div>`;
  }
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
      `${a.actions} ${a.actions > 1 ? t('play.manyActions') : t('play.oneAction')}`,
      a.bet === 'any' ? `${t('play.bet')} ${t('play.betAny')}` : a.bet ? `${t('play.bet')} ${a.bet}` : '',
    ].filter(Boolean).join(' · ');
    // What the card DOES lives in cards.effect (all 68 cards, both languages)
    // and reaches sighted players through the inspector popover: hover on a
    // mouse, press-and-hold on touch. The accessible name carries the same
    // sentence, so a screen reader hears what a hover shows. play.what keeps
    // the six First Game tone lines as a fallback.
    const what = [`cards.effect.${a.id}`, `play.what.${a.id}`].map((k) => t(k)).find((v) => !v.startsWith('[')) || '';
    return `<button class="action-card ${n ? 'is-queued' : ''}" data-action="play-pick" data-id="${a.id}" data-inspect="${a.id}"
      ${can[a.id] ? '' : 'aria-disabled="true"'}
      aria-label="${escHtml(what ? `${cardName(a)}. ${what}` : cardName(a))}">
      ${cardFace(a, { size: 'hand' })}
      <span>${escHtml(cardName(a))}${n ? ` <b class="qty">x${n}</b>` : ''}</span>
      <small class="ac-meta">${escHtml(meta)}${step ? ` ${riskDots(step)}` : ''}</small></button>`;
  }).join('');

  const adv = f.hero.advantage.map((id) => {
    const c = s.cards.byId[id];
    const on = id === 'barrier' && ui.reaction === 'barrier';
    return `<button class="action-card ${on ? 'is-queued' : ''}" data-action="play-adv" data-id="${id}" data-inspect="${id}" aria-pressed="${on}"
      aria-label="${escHtml(`${cardName(c)}. ${c.effect || ''}`.trim())}">
      ${cardFace(c, { size: 'mini' })}<span>${escHtml(cardName(c))}</span></button>`;
  }).join('');

  // Three bands: what you hold, what you have declared, and what resolves it.
  // The plan lane brings its own heading, and the resolve band's button says
  // what it is, so only the first band spends a line on a label: the board has
  // ~560px of height on a 720px screen and a redundant label costs 16 of them.
  const wait = awaitingStep(f, ui);
  return `<div class="turn-head">
      ${slots}<div class="row">${rerollBtn}${hideBtn}</div>
    </div>
    <div class="band band--cards">
      <div class="hand-row">
        ${dieCell(f, ui)}
        <div class="action-cards hand-attacks" data-tour="hand">${hand}</div>
        ${adv ? `<div class="adv-hand"><span class="pile-label">${escHtml(t('play.advHand'))}</span><div class="action-cards">${adv}</div></div>` : ''}
      </div>
    </div>
    <div class="band band--plan">${planLane(s, f, ui, plan, wait)}</div>
    ${!ui.resolveOpen && !ui.breakOpen && canBreak(f) ? `<div class="band band--break">${breakOffer(f)}</div>` : ''}
    <div class="band band--go" data-tour="go">${ui.resolveOpen || plan.length ? '' : planBar(f, ui, plan)}</div>
    ${ui.resolveOpen || ui.breakOpen ? resolveModal(f, ui, plan, wait) : ''}`;
}

function planLane(s, f, ui, plan, wait) {
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
    const room = a.bet === 'any' ? betRoom(f, plan, i) : 0;
    // Pips, not a numeral strip: each one is a life card you are staking,
    // drawn at the 63x88 card ratio, filled up to the bet. The count in words
    // already lives on the step ("Bet 3"), so the row can afford to be quiet.
    const bets = a.bet === 'any'
      ? `<span class="plan-bet" role="group" aria-label="${escHtml(t('play.bet'))}">${Array.from({ length: room }, (_, k) => k + 1).map((n) => `<button class="plan-pip ${n <= bet ? 'is-staked' : ''}" data-action="play-step-bet" data-i="${i}" data-bet="${n}" aria-pressed="${bet === n}" aria-label="${escHtml(t('play.bet'))} ${n}"></button>`).join('')}</span>` : '';
    const rune = step && (st.rune || spare > 0)
      ? `<button class="plan-rune" data-action="play-rune-step" data-i="${i}" aria-pressed="${!!st.rune}" title="${escHtml(t('play.attachTo'))} ${i + 1}">${glyphSvg('adv-rune', '', 15)}</button>` : '';
    const tgt = f.boss.minions.length
      ? `<button class="plan-tgt" data-action="play-step-target" data-i="${i}">${escHtml(typeof st.target === 'number' ? `${MINION.name} ${st.target + 1}` : t('play.body'))}</button>` : '';
    // Draggable only before the lane starts resolving: a step already played is
    // a thing that happened, not a thing you can re-order.
    const movable = at === 0 && !wait && !ui.resolveOpen;
    return `<li class="plan-step ${ui.awaiting === i ? 'is-now' : ''} ${i < at ? 'is-done' : ''}${settled}" data-inspect="${a.id}"
      ${movable ? `draggable="true" data-step-i="${i}"` : ''}>
      <button class="plan-num" data-action="play-unqueue" data-i="${i}" aria-label="${escHtml(t('play.planStep'))} ${i + 1}" title="${escHtml(t('play.planStep'))} ${i + 1}">${i + 1}</button>
      ${movable && plan.length > 1 ? `<span class="plan-move" aria-hidden="true" title="${escHtml(t('play.reorder'))}">${glyphSvg('grip', '', 13)}</span>
      <button class="plan-bump" data-action="play-move-step" data-i="${i}" data-to="${i - 1}" ${i === 0 ? 'aria-disabled="true"' : ''} aria-label="${escHtml(t('play.moveEarlier'))}">\u2039</button>
      <button class="plan-bump" data-action="play-move-step" data-i="${i}" data-to="${i + 1}" ${i === plan.length - 1 ? 'aria-disabled="true"' : ''} aria-label="${escHtml(t('play.moveLater'))}">\u203a</button>` : ''}
      ${cardFace(a, { size: 'mini' })}
      <span class="plan-what"><b>${escHtml(cardName(a))}</b><small>${bet ? `${escHtml(t('play.bet'))} ${bet}` : ''}${step ? ` ${riskDots(step)}` : ''}${st.rune ? ` ${escHtml(t('play.autoStep'))}` : ''}</small></span>
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
  // The turn's buttons live ON the lane's own line, pinned right: the owner's
  // sketch, and it hands the fight box back the border and 52px row the old
  // resolve band cost. Gated on plan.length && !wait so exactly one primary
  // exists in .actions at any moment (Enter's contract): Resolve here, Skip in
  // the go band when the lane is empty, Roll in the roll panel while waiting.
  const v = plan.length ? validatePlan(f, plan) : null;
  const actions = plan.length && !wait && !ui.resolveOpen ? `<div class="plan-actions" data-tour="go">
      <button class="btn btn--ghost btn--sm" data-action="play-undo-last">${escHtml(t('play.undoLast'))}</button>
      <button class="btn btn--ghost btn--sm" data-action="play-clear-plan">${escHtml(t('play.clearPlan'))}</button>
      <button class="btn btn--ghost btn--sm" data-action="play-end-turn">${escHtml(t('play.endTurn'))} ${glyphSvg('skip', '', 16)}</button>
      <button class="btn btn--primary" data-action="play-resolve-plan" ${v.ok ? '' : 'aria-disabled="true"'}>${glyphSvg('dice', '', 18)} ${escHtml(t('play.resolvePlan'))}</button>
    </div>` : '';
  return `<div class="plan-wrap">
    <div class="row row--between"><span class="pile-label">${escHtml(t('play.plan'))}</span><small class="muted">${escHtml(plan.length ? t('play.planHint') : f.actionsLeft <= 0 ? t('play.outOfActions') : t('play.planEmpty'))}</small><small class="muted plan-keys">${escHtml(t('play.keys'))}</small></div>
    <div class="plan-row"><ul class="plan">${steps}${react}</ul>${actions}</div>
    ${ui.error ? `<div class="plan-error">${escHtml(reasonText(ui.error))}</div>` : ''}
  </div>`;
}

/**
 * Break a part (RULES.md section 7). Only ever on screen in the window a landed
 * attack opens, which is why it is a band that comes and goes rather than a
 * button that greys out: a control you cannot use most of the time teaches
 * nothing, and this one is a prompt to SAY something out loud.
 *
 * The three rewards are the buttons. None is the primary: picking a reward is
 * the player's call and Enter belongs to the turn's own next step, so the
 * one-primary contract in .actions is untouched.
 */
/**
 * The board's break prompt: one line, one button, and it opens the dialog.
 *
 * The picker used to live here in full. On a 360x740 phone that grew the pinned
 * action panel past the viewport, so sticky clamped it to the top of its own
 * containing block and its opaque background covered the entire arena, with the
 * turn's only primary 85px below the fold. The dialog already fits and is
 * already where the player is looking one beat after the hit, so the board keeps
 * the invitation and the dialog keeps the choice.
 */
function breakOffer(f) {
  const left = Math.max(0, (f.dm?.cap || 0) - f.boss.breaks);
  return `<div class="row brk-offer">
    <span class="pile-label">${glyphSvg('break', '', 16)} ${escHtml(t('play.brk.title'))}</span>
    <small class="muted">${left} ${escHtml(t('play.brk.left'))}</small>
    <span class="grow"></span>
    <button class="btn btn--sm" data-action="play-break-open">${escHtml(t('play.brk.say'))}</button>
    <button class="btn btn--ghost btn--sm" data-action="play-break-skip">${escHtml(t('play.brk.cancel'))}</button>
  </div>`;
}

function breakRow(f, ui, inModal = false) {
  const step = breakStepFor(f);
  const need = step ? targetFor(f.die, step) : null;
  const cost = breakCost(f);
  const left = Math.max(0, (f.dm?.cap || 0) - f.boss.breaks);
  const how = step
    ? `${riskDots(step)} ${escHtml(stepName(step))}: ${escHtml(t('play.need'))} <b>${need}+</b>`
    : `<b>${escHtml(t('play.brk.free'))}</b>`;
  const hint = { wound: t('play.brk.woundHint').replace('{n}', f.dm.wound), cripple: t('play.brk.crippleHint').replace('{n}', f.dm.cripple), trophy: t('play.brk.trophyHint') };
  const glyph = { wound: 'break', cripple: 'trend-down', trophy: 'trophy' };
  const picks = BREAK_REWARDS.map((id) => `<button class="brk-pick" data-action="play-break" data-reward="${id}">
      ${glyphSvg(glyph[id], '', 22)}<b>${escHtml(t(`play.brk.${id}`))}</b><small>${escHtml(hint[id])}</small></button>`).join('');
  return `<div class="brk ${inModal ? 'brk--modal' : ''}">
    <div class="row row--between">
      <span class="pile-label">${glyphSvg('break', '', 16)} ${escHtml(t('play.brk.title'))}</span>
      <small class="muted">${escHtml(t('play.brk.say'))}</small>
      <small class="muted">${how}${cost ? ` \u00b7 ${escHtml(t('play.brk.costs'))}` : ''} \u00b7 ${left} ${escHtml(t('play.brk.left'))}</small>
    </div>
    <div class="brk-picks">${picks}</div>
    <div class="row">${step ? `<span class="muted small">${escHtml(t('play.typeRoll'))}</span>${typedInput(f, ui)}` : ''}
      <span class="grow"></span>
      <button class="btn btn--ghost btn--sm" data-action="play-break-skip">${escHtml(t('play.brk.cancel'))}</button></div>
  </div>`;
}

function planBar(f, ui, plan) {
  // Only the EMPTY lane reaches this band now: a queued plan carries its own
  // buttons on the lane's line (planLane). With nothing queued the one thing
  // left to do is hand the turn over, so Skip is the primary and Enter takes it.
  return `<div class="row plan-bar">
    <button class="btn btn--primary" data-action="play-end-turn">${escHtml(t(f.actionsLeft <= 0 ? 'play.endTurn' : 'play.skipTurn'))} ${glyphSvg('skip', '', 16)}</button>
  </div>`;
}

/**
 * The resolve popup: the throw gets a stage. Three states, one element:
 * the CHOOSER (throw each die, or resolve it all at once), the THROW (one
 * check at a time, the die front and centre, the physical-die typed input
 * kept), and the LEDGER (every result, then Close). Rendered inside the
 * .actions panel so Enter reaches its primary, and the lane's own buttons
 * hide while it is up, so the one-primary contract holds in every state.
 */
function resolveModal(f, ui, plan, wait) {
  let body;
  // Opened from the board's one-line offer, with no lane resolving behind it.
  // Same picker, same dialog, so there is one place a break is ever chosen.
  if (ui.breakOpen && !ui.resolveOpen) {
    body = `${breakVerdict(f, ui)}${canBreak(f) ? breakRow(f, ui, true) : ''}
      <div class="row rm-row"><button class="btn btn--primary" data-action="play-break-close">${escHtml(t('play.rm.close'))}</button></div>`;
    return backdrop(body, escHtml(t('play.brk.title')));
  }
  if (wait) {
    const { i, st, a, step } = wait;
    const need = targetFor(f.die, step);
    const dmg = attackDamage(f, a, betFor(a, st));
    body = `<p class="rm-what"><b>${escHtml(t('play.planStep'))} ${i + 1}: ${escHtml(cardName(a))}</b>
        <span>${riskDots(step)} ${escHtml(stepName(step))}, ${Math.round(stepOdds(step) * 100)}%: ${escHtml(t('play.need'))} <b>${need}+</b> ${escHtml(f.die)} · ${dmg} ${escHtml(t('play.damage'))}${f.boss.braced ? ` · ${escHtml(t('play.bracedHalved'))}` : ''}</span></p>
      <div class="rm-die">${dieThrow(f, ui)}</div>
      <div class="row rm-row">
        <button class="btn btn--primary btn--lg" data-action="play-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.throw'))}</button>
        <span class="muted small">${escHtml(t('play.typeRoll'))}</span>${typedInput(f, ui)}
        <button class="btn btn--sm" data-action="play-go-typed">${escHtml(t('play.go'))}</button>
        <span class="grow"></span>
        <button class="btn btn--ghost btn--sm" data-action="play-resolve-all" title="${escHtml(t('play.resolveAllHint'))}">${escHtml(t('play.resolveAll'))}</button>
      </div>
      ${ledger(ui, false)}`;
  } else if (ui.results && ui.results.length) {
    // The LAST throw of the lane lands here (the check that ended it), so the
    // die still gets its tumble: without this, a one-check turn never showed
    // the animation at all, the stage vanished the instant the roll resolved.
    // ui.last is wiped by resetPlan when the lane completes, so the roll is
    // read from the ledger's own tail, gated by the one-shot fx that marks
    // "a step landed on THIS render".
    const tail = ui.results[ui.results.length - 1];
    // A break sets its OWN fx ('break-ok'/'break-no') precisely so it cannot
    // re-satisfy this guard: it used to set 'hit'/'miss', which replayed the
    // last attack's die and its toss animation while the break's own roll was
    // never shown at all.
    const justRolled = (ui.fx === 'hit' || ui.fx === 'miss' || ui.fx === 'boss-felled') && tail?.roll !== null && tail?.roll !== undefined;
    // Mid-lane or finished? A lane the player is walking a beat at a time pauses
    // here after every step, including the ones that need no die, so a Bubble
    // gets its own moment instead of arriving already resolved in a list beside
    // somebody else's roll.
    const left = (ui.plan?.length || 0) - (ui.at || 0);
    const more = ui.resolveMode === 'step' && left > 0 && f.phase === 'act';
    body = `${justRolled ? `<div class="rm-die">${dieThrow(f, ui, tail.roll)}</div>` : ''}${ledger(ui, !more)}
      ${breakVerdict(f, ui)}${!more && canBreak(f) ? breakRow(f, ui, true) : ''}
      <div class="row rm-row">${more
    ? `<button class="btn btn--primary btn--lg" data-action="play-resolve-next">${escHtml(t('play.rm.next'))} ›</button>
         <span class="muted small">${escHtml(t('play.rm.step'))} ${(ui.at || 0) + 1} ${escHtml(t('play.rm.of'))} ${ui.plan.length}</span>
         <span class="grow"></span>
         <button class="btn btn--ghost btn--sm" data-action="play-resolve-all" title="${escHtml(t('play.resolveAllHint'))}">${escHtml(t('play.resolveAll'))}</button>`
    : `<button class="btn btn--primary" data-action="play-resolve-close">${escHtml(t('play.rm.close'))}</button>`}</div>`;
  } else {
    const n = plan.filter((st) => effectiveStep(f, attackFor(f, st.id))).length;
    // The lead is written to be followed by a count ("This turn holds 2 rolls
    // to make."), so with nothing to count it has to be REPLACED, not extended:
    // appending gave "This turn holds Everything lands on its own."
    const lead = n
      ? `${t('play.rm.lead')} ${n} ${t(n > 1 ? 'play.rm.checks' : 'play.rm.check')}.`
      : t('play.rm.noChecks');
    body = `<p class="rm-what">${escHtml(lead)}</p>
      <div class="row rm-row">
        <button class="btn btn--primary btn--lg" data-action="play-resolve-throw">${glyphSvg('dice', '', 18)} ${escHtml(t('play.rm.throw'))}</button>
        <button class="btn" data-action="play-resolve-fast">${escHtml(t('play.rm.fast'))}</button>
        <span class="grow"></span>
        <button class="btn btn--ghost btn--sm" data-action="play-resolve-close">${escHtml(t('play.rm.back'))}</button>
      </div>`;
  }
  return backdrop(body, escHtml(t('play.resolvePlan')));
}

/**
 * What the break just did: its own die on the same stage, and one line saying
 * whether the part came off. Before this the break silently reused the last
 * attack's die, so the one roll the player had just asked for was the one roll
 * the screen never showed.
 */
function breakVerdict(f, ui) {
  const b = ui.breakRoll;
  if (!b) return '';
  return `${b.roll === null ? '' : `<div class="rm-die">${dieThrow(f, ui, b.roll)}</div>`}
    <p class="rm-what ${b.ok ? 'is-good' : 'is-bad'}"><b>${escHtml(t(b.ok ? 'play.brk.broke' : 'play.brk.held'))}</b>
      ${b.ok ? `<span>${escHtml(t(`play.brk.${b.reward}`))}</span>` : ''}</p>`;
}

/** The throw's ledger: what has landed so far, or the whole turn at the end. */
function ledger(ui, done) {
  if (!ui.results?.length) return '';
  const rows = ui.results.map((r) => `<li class="${r.hit ? 'good' : 'bad'}">
      ${r.roll !== null && r.roll !== undefined ? `<span class="rm-roll">${r.roll}</span>` : '<span class="rm-roll rm-roll--auto">·</span>'}
      <b>${escHtml(cardName({ id: r.id, name: r.name }))}</b> ${escHtml(r.auto ? t('play.lands') : r.hit ? t('play.hit') : t('play.miss'))}${r.dealt ? `, ${r.dealt} ${escHtml(t('play.damage'))}` : ''}</li>`).join('');
  return `<ul class="rm-ledger ${done ? 'is-done' : ''}">${rows}</ul>`;
}

/**
 * The die on its stage. A 3D-feeling tumble is layered on by CSS when a roll
 * has just landed (ui.last carries it); at rest it shows the die waiting.
 * The visual is deliberately one function so the animation technique can be
 * swapped without touching the modal.
 */
function dieThrow(f, ui, roll, die = null, animate = true) {
  const which = die || f.die;
  // `undefined` means "show the last roll if there is one"; an explicit null
  // means "show nothing yet". They were the same value before, so the boss's
  // un-thrown d6 stage inherited whatever the hero had last rolled and printed
  // a 17 on a six-sided die, tossed, above the button offering to throw it.
  const n = roll === undefined
    ? (ui.last && ui.last.roll !== null && ui.last.roll !== undefined ? ui.last.roll : null)
    : roll;
  const m = /^(\d*)d(\d+)$/.exec(which) || [null, '', '20'];
  const count = Number(m[1] || 1);
  const sides = Number(m[2]);
  // The tumble is a CSS animation on markup render() replaces wholesale, so it
  // replays on EVERY render that carries a number. The hero's rolls gate it on a
  // one-shot fx; the boss's did not, so its d6 re-threw itself every time the
  // player toggled the log while the reaction was still pending.
  const tossed = n !== null && animate ? 'is-tossed' : '';
  // The site's die is a rounded square with one big numeral (the die-cell,
  // the ledger chips, the learn slides): the throw uses the same face, so
  // there is exactly ONE number to read. The 3D solid landed on the right
  // face and still read wrong: neighbouring faces at this size shout as
  // loudly as the landed one. Pre-throw the face shows the die's own glyph.
  const one = (landed, extra = '') => `<div class="die-face die-toss ${tossed} ${extra}">
      ${landed !== null ? `<b>${landed}</b>` : artGlyphSvg(`die-d${sides}`, 'die-toss__glyph', 34)}</div>`;
  let dice;
  if (count <= 1) {
    dice = one(n);
  } else {
    // The engine hands back the SUM; the split shown is theatre and must be
    // deterministic (render() replaces wholesale, and a random split would
    // reshuffle on every unrelated repaint). Greedy from the ceiling keeps
    // every companion die legal for any total.
    const split = [];
    let left = n;
    for (let k = count; k >= 1; k--) {
      const v = n === null ? null : Math.max(1, Math.min(sides, left - (k - 1)));
      split.push(v); if (v !== null) left -= v;
    }
    dice = split.map((v, k) => one(v, k === 1 ? 'die-toss--b' : k === 2 ? 'die-toss--c' : '')).join('');
  }
  return `<div class="die-stage ${n !== null ? 'has-rolled' : ''}">
    <div class="die-stage__dice">${dice}</div>
    <small class="muted die-stage__which">${escHtml(which)}</small>
  </div>`;
}

