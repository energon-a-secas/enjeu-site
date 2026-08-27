// ── Play view ────────────────────────────────────────────────
// The runner: set up a run, fight a level with the placeholder figures and
// the real card faces, walk the level-end steps, carry on. Every rule
// resolution is a call into game/engine.js or game/run.js; this file only
// asks the human what the strategies decide for themselves.

import { t } from '../strings.js';
import { escHtml, showToast } from '../utils.js';
import { cardFace, lifeMini } from '../cards/face.js';
import { glyphSvg } from '../cards/glyphs.js';
import { figureSvg } from '../game/figures.js';
import { heroFor, MINION } from '../data/placeholders.js';
import { legalAttacks, attack, reroll, hide, endTurn, bossRoll, resolveBoss, playAdvantage, ready, spent, broken, bossHp, raging, effectiveStep, attackDamage } from '../game/engine.js';
import { DICE, targetFor, rollDie, dieMax, stepOdds } from '../game/rules.js';
import { newRun, startLevel, levelWon, levelLost, chooseClass, revealDraft, takeSkill, drawAdvantage, nextLevel } from '../game/run.js';

const ELEMENTS = ['fire', 'water', 'earth', 'wind'];
const pips = (n) => `<span class="pips">${'<i></i>'.repeat(n)}</span>`;
const STEP_PIPS = { sure: 1, even: 2, hard: 3, wild: 4 };
const cap = (s) => (s ? s.charAt(0).toUpperCase() + s.slice(1) : '');

export function renderPlay(s) {
  const run = s.run;
  if (!run || run.stage === 'setup') return renderSetup(s);
  switch (run.stage) {
    case 'fight': return renderFight(s, run);
    case 'class': return renderClassPick(s, run);
    case 'draft': return renderDraft(s, run);
    case 'advantage': return renderAdvantage(s, run);
    case 'done': return renderDone(s, run);
    case 'lost': return renderLost(s, run);
    default: return renderSetup(s);
  }
}

// ── Setup ────────────────────────────────────────────────────
function renderSetup(s) {
  const kind = s.runKind || 'first';
  const hero = heroFor(s.element);
  const inProgress = s.run && !['setup', 'done', 'lost'].includes(s.run.stage);
  return `
  <div class="container stack">
    <header class="stack stack--tight">
      <p class="kicker">${escHtml(t('play.title'))}</p>
      <h2 class="panel__title">${escHtml(t('play.setupTitle'))}</h2>
    </header>
    ${inProgress ? `<div class="panel panel--accent row row--between"><div><b>${escHtml(t('play.resume'))}</b>: level ${s.run.level}, round ${s.run.fight?.round || 1}.</div><div class="row"><button class="btn btn--primary" data-action="play-resume">${escHtml(t('play.resume'))}</button><button class="btn btn--ghost" data-action="play-abandon">${escHtml(t('play.abandon'))}</button></div></div>` : ''}
    <div class="setup-grid">
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
    </div>
    <div class="panel stack stack--tight">
      <p class="kicker">${escHtml(t('play.element'))}</p>
      <div class="pick" style="grid-template-columns: repeat(auto-fit, minmax(180px, 1fr))">
        ${ELEMENTS.map((el) => { const h = heroFor(el); return `
        <button class="btn btn--${el}" data-action="play-element" data-element="${el}" aria-pressed="${s.element === el}">
          <span class="figure">${figureSvg(h)}</span>
          <span><span class="dot"></span> ${escHtml(cap(el))}<br><small class="muted">${escHtml(h.name)}</small></span>
        </button>`; }).join('')}
      </div>
      <div class="row" style="gap: var(--space-6)">
        <div class="field"><span>${escHtml(t('play.die'))}</span>
          <span class="seg" role="group">${DICE.map((d) => `<button data-action="play-die" data-die="${d}" aria-pressed="${s.die === d}">${d}</button>`).join('')}</span></div>
        <div class="field"><span>${escHtml(t('play.mode'))}</span>
          <span class="seg" role="group">${['story', 'standard', 'nightmare'].map((m) => `<button data-action="play-mode" data-mode="${m}" aria-pressed="${s.mode === m}">${escHtml(t(`play.${m}`))}</button>`).join('')}</span>
          <small class="muted">${escHtml(t(`play.modeHint.${s.mode}`))}</small></div>
      </div>
    </div>
    <div class="row">
      <button class="btn btn--primary btn--lg" data-action="play-start">${escHtml(t('play.start'))}: ${escHtml(kind === 'first' ? t('play.firstGame') : t('play.fullRun'))} ${glyphSvg('strike', '', 18)}</button>
    </div>
    <p class="small muted">${escHtml(t('play.placeholderNote'))}</p>
  </div>`;
}

// ── The fight ────────────────────────────────────────────────
function piles(f) {
  const order = { ready: 0, spent: 1, broken: 2 };
  const cards = [...f.hero.pool].sort((a, b) => order[a.st] - order[b.st]);
  return cards.map((c) => lifeMini(c.kind, c.st === 'spent' ? 'is-spent' : c.st === 'broken' ? 'is-broken' : '')).join('');
}

function bossPile(f) {
  const bodyCards = Math.ceil(f.boss.body / f.boss.perCard);
  const shown = Math.min(bodyCards, 10);
  return `${lifeMini('boss').repeat(shown)}${bodyCards > 10 ? `<b class="muted">+${bodyCards - 10}</b>` : ''}`;
}

function renderFight(s, run) {
  const f = run.fight;
  const ui = run.ui || {};
  const roster = f.roster || {};
  const hero = heroFor(run.element);
  const rage = raging(f);
  const biome = s.cards.byId[f.biomeCard];
  const hpPct = Math.round((100 * bossHp(f)) / (f.boss.maxHp || 1));

  const minions = f.boss.minions.map((m, i) => `
    <button class="minion" data-action="play-target" data-target="${i}" aria-pressed="${ui.target === i}">
      ${figureSvg({ ...MINION, element: roster.element }, {})}<span>${escHtml(MINION.name)} ${m.hp}</span></button>`).join('');
  const targetRow = f.boss.minions.length ? `<div class="minions"><button class="minion" data-action="play-target" data-target="body" aria-pressed="${ui.target === undefined || ui.target === 'body'}">${glyphSvg('crown', '', 20)} <span>${escHtml(t('play.body'))}</span></button>${minions}</div>` : '';

  const hand = f.hero.advantage.map((id, i) => {
    const c = s.cards.byId[id];
    const playable = id !== 'barrier' && (f.phase === 'act' || f.phase === 'boss');
    return `<div class="action-card" style="cursor:default">${cardFace(c, { size: 'hand' })}<span>${escHtml(c.name)}</span>
      ${playable ? `<button class="btn btn--sm" data-action="play-adv" data-id="${id}" data-i="${i}">${escHtml(t('play.playAdv'))}</button>` : `<small class="muted">${id === 'barrier' ? 'when the boss acts' : ''}</small>`}</div>`;
  }).join('');

  return `
  <div class="container container--wide stack">
    <div class="row row--between">
      <div>
        <p class="kicker">${escHtml(t('play.level'))} ${f.level} · ${escHtml(t('play.round'))} ${f.round} · ${escHtml(biome?.name || '')}${biome?.rule ? ` (${escHtml(biome.rule)})` : ''}</p>
        <h2 class="panel__title">${escHtml(roster.name || f.boss.name)} <small class="muted">${f.boss.size}${roster.element ? ` · ${cap(roster.element)}` : ''}</small></h2>
      </div>
      <div class="row"><span class="chip" aria-pressed="false">${f.die} · ${escHtml(t(`play.${f.mode}`))}</span><button class="btn btn--ghost btn--sm" data-action="play-abandon">${escHtml(t('play.abandon'))}</button></div>
    </div>
    ${rage ? `<div class="banner banner--rage">${escHtml(t('play.rage'))}</div>` : f.round === f.boss.rage - 1 ? `<div class="banner banner--rage" style="opacity:.8">${escHtml(t('play.rageSoon'))}</div>` : ''}
    <div class="play">
      <div class="board">
        <div class="arena">
          <div class="arena__row">
            <div class="figure ${ui.bossHit ? 'is-hit' : ''}">${figureSvg(roster)}<b>${escHtml(roster.name || '')}</b><span>${escHtml(t('common.placeholder'))}</span></div>
            <div class="stack stack--tight">
              <div class="hp"><span>${bossHp(f)}</span><div class="bar"><i style="width:${hpPct}%"></i></div><span class="muted small">/ ${f.boss.maxHp}</span></div>
              <div class="pile-label">${escHtml(t('play.boss'))}: ${Math.ceil(f.boss.body / f.boss.perCard)} × ${f.boss.perCard}${f.boss.braced ? ' · Braced' : ''}</div>
              <div class="pile">${bossPile(f)}</div>
              ${targetRow}
            </div>
          </div>
          <div class="arena__row arena__row--hero">
            <div class="stack stack--tight">
              <div class="pile-label">${escHtml(t('play.ready'))} ${ready(f)} · ${escHtml(t('play.spent'))} ${spent(f)} · ${escHtml(t('play.broken'))} ${broken(f)}${f.hero.hidden ? ` · ${escHtml(t('play.hidden'))}` : ''}${f.hero.rune ? ' · Rune ready' : ''}${f.hero.relic ? ' · Relic' : ''}${f.hero.ally ? ' · Ally' : ''}</div>
              <div class="pile">${piles(f)}</div>
              ${hand ? `<div class="pile-label">${escHtml(t('play.advHand'))}</div><div class="adv-hand">${hand}</div>` : ''}
            </div>
            <div class="figure ${ui.heroHit ? 'is-hit' : ''}">${figureSvg({ ...hero, klass: run.klass })}<b>${escHtml(hero.name)}</b><span>${escHtml(cap(run.element))}${run.klass ? ` · ${escHtml(cap(run.klass))}` : ''}</span></div>
          </div>
        </div>
        <div class="panel actions">${renderActions(s, run, f, ui)}</div>
      </div>
      <aside class="side">
        <div class="panel panel--tight">
          <p class="kicker">${escHtml(t('play.log'))}</p>
          <ul class="log">${f.log.slice(-40).reverse().map((l) => `<li class="${l.cls}">${escHtml(l.text)}</li>`).join('')}</ul>
        </div>
      </aside>
    </div>
  </div>`;
}

function renderActions(s, run, f, ui) {
  if (f.phase === 'won') {
    return `<div class="banner banner--win">${escHtml(t('play.won'))}</div>
      <div class="row"><button class="btn btn--primary btn--lg" data-action="play-continue">${escHtml(run.kind === 'first' || f.level >= 5 ? 'Finish' : t('play.nextLevel'))}</button></div>`;
  }
  if (f.phase === 'lost' || f.phase === 'stall') {
    return `<div class="banner banner--lose">${escHtml(t('play.lost'))}</div>
      <div class="row"><button class="btn btn--primary btn--lg" data-action="play-lost">${escHtml(t('play.newRun'))}</button></div>`;
  }
  if (f.phase === 'boss') {
    const p = f.pending;
    if (!p) return `<div class="row row--between"><b>${escHtml(t('play.bossTurn'))}</b><button class="btn btn--primary btn--lg" data-action="play-boss-roll">${glyphSvg('dice', '', 18)} ${escHtml(t('play.bossRoll'))}</button></div>`;
    const hasBarrier = f.hero.advantage.includes('barrier');
    return `<div class="row" style="gap: var(--space-4)">
        <div class="die-face is-rolling">${p.roll}</div>
        <div class="grow"><b>${escHtml(p.name)}</b>${p.dmg ? `: ${p.dmg} damage${p.rage ? ', unguardable' : ''}` : p.kind === 'brace' ? ': no damage, halves what it takes next turn' : p.kind === 'summon' ? `: ${p.chunk} of its life moves under a minion` : ''}</div>
      </div>
      <div class="row">
        ${hasBarrier ? `<button class="btn btn--primary" data-action="play-resolve" data-barrier="1">${glyphSvg('adv-barrier', '', 16)} ${escHtml(t('play.barrierPrompt'))}</button><button class="btn" data-action="play-resolve" data-barrier="0">${escHtml(t('play.letItHappen'))}</button>`
                                  : `<button class="btn btn--primary" data-action="play-resolve" data-barrier="0">Continue</button>`}
      </div>`;
  }
  // phase act
  const attacks = legalAttacks(f);
  const sel = attacks.find((a) => a.id === ui.attackId && a.canAfford);
  const slots = `<div class="slots">${[0, 1, 2].map((i) => `<i class="${i < 3 - f.actionsLeft ? 'used' : ''}"></i>`).join('')}<span>${f.actionsLeft} ${escHtml(t('play.actionsLeft'))}</span></div>`;
  const cards = attacks.map((a) => `
    <button class="action-card" data-action="play-pick" data-id="${a.id}" aria-pressed="${ui.attackId === a.id}" ${a.canAfford ? '' : 'aria-disabled="true"'} aria-label="${escHtml(a.name)}">
      ${cardFace(a, { size: 'hand' })}<span>${escHtml(a.name)}</span></button>`).join('');

  let resolve = '';
  if (sel) {
    const step = effectiveStep(f, sel);
    const bet = sel.bet === 'any' ? Math.max(1, Math.min(ui.bet || 1, ready(f))) : (sel.bet || 0);
    const need = targetFor(f.die, step);
    const dmg = attackDamage(f, sel, bet);
    const betPicker = sel.bet === 'any' ? `<div class="row"><b>${escHtml(t('play.bet'))}</b> ${Array.from({ length: ready(f) }, (_, i) => i + 1).map((n) => `<button class="btn btn--sm" data-action="play-bet" data-bet="${n}" aria-pressed="${bet === n}">${n}</button>`).join('')} <span class="muted small">${escHtml(t('play.betHint'))}</span></div>` : '';
    const runeRow = f.hero.rune > 0 && step ? `<label class="row"><input type="checkbox" data-change="play-rune" ${ui.useRune ? 'checked' : ''}> ${escHtml(t('play.useRune'))}</label>` : '';
    const checkLine = step ? `${pips(STEP_PIPS[step])} ${escHtml(cap(step))}, ${Math.round(stepOdds(step) * 100)}%: ${escHtml(t('play.need'))} <b>${need}+</b> on ${f.die}` : escHtml(t('cards.check.none'));
    resolve = `<div class="panel panel--sunk stack stack--tight">
      <div class="row row--between"><b>${escHtml(sel.name)}</b><span>${checkLine}</span><span>${dmg} damage${f.boss.braced ? ' (Braced: halved)' : ''}</span></div>
      ${betPicker}${runeRow}
      <div class="row">
        <button class="btn btn--primary btn--lg" data-action="play-roll">${glyphSvg('dice', '', 18)} ${escHtml(step && !(ui.useRune && f.hero.rune) ? t('play.roll') : 'Go')}</button>
        ${step ? `<span class="muted small">${escHtml(t('play.typeRoll'))}</span><input type="number" min="1" max="${dieMax(f.die)}" value="${ui.typed || ''}" data-change="play-typed" style="width:72px;min-height:36px;padding:0 8px;border:2px solid var(--border-strong);border-radius:8px;font:inherit"><button class="btn btn--sm" data-action="play-go-typed">Go</button>` : ''}
      </div>
    </div>`;
  }
  const last = ui.last ? `<div class="row" style="gap: var(--space-4)">
      ${ui.last.roll !== null && ui.last.roll !== undefined ? `<div class="die-face is-rolling">${ui.last.roll}</div>` : ''}
      <div class="verdict ${ui.last.hit ? 'hit' : 'miss'}">${escHtml(ui.last.name)}: ${ui.last.auto ? 'lands' : ui.last.hit ? t('play.hit') : t('play.miss')}${ui.last.dealt ? `, ${ui.last.dealt} damage` : ''}</div>
      ${f.hero.lastMiss && !f.hero.hunterUsed ? `<button class="btn" data-action="play-reroll">${escHtml(t('play.reroll'))}</button>` : ''}
    </div>` : '';
  const hideBtn = f.hero.hideAvailable && !f.hero.hidden ? `<button class="btn btn--sm" data-action="play-hide" title="${escHtml(t('play.hideHint'))}">${glyphSvg('eye', '', 16)} ${escHtml(t('play.hide'))}</button>` : '';
  return `<div class="row row--between">${slots}<div class="row">${hideBtn}<button class="btn ${f.actionsLeft === 0 ? 'btn--primary' : ''}" data-action="play-end-turn">${escHtml(t('play.endTurn'))} ${glyphSvg('skip', '', 16)}</button></div></div>
    <div class="action-cards">${cards}</div>
    ${resolve}${last}`;
}

// ── Level-end screens ────────────────────────────────────────
function renderClassPick(s, run) {
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared</p>
    <h2 class="panel__title">${escHtml(t('play.pickClass'))}</h2>
    <div class="draft">${s.cards.class.map((c) => `
      <button class="action-card" data-action="play-class" data-id="${c.id}">${cardFace(c, { size: 'browse' })}<b>${escHtml(c.name)}</b><span class="small" style="white-space:normal">${escHtml(c.passive)}</span></button>`).join('')}</div>
  </div>`;
}

function renderDraft(s, run) {
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared · ${escHtml(t('play.draftLead'))}</p>
    <h2 class="panel__title">${escHtml(t('play.draftTitle'))}</h2>
    <div class="draft">${run.draft.map((id) => { const c = s.cards.byId[id]; return `
      <button class="action-card" data-action="play-draft" data-id="${id}">${cardFace(c, { size: 'browse' })}<b>${escHtml(c.name)}</b><span class="small">tier ${c.tier} · bet ${c.bet} · ${c.damage} · ${escHtml(t(`cards.check.${c.check || 'none'}`))}${c.element ? ` · ${cap(c.element)}` : ''}</span></button>`; }).join('')}</div>
  </div>`;
}

function renderAdvantage(s, run) {
  const drawn = run.ui?.drawn || [];
  return `<div class="container stack">
    <p class="kicker">${escHtml(t('play.level'))} ${run.level} cleared</p>
    <h2 class="panel__title">${escHtml(t('play.advDraw'))}</h2>
    <div class="draft">${drawn.map((id) => { const c = s.cards.byId[id]; return `<div class="action-card" style="cursor:default">${cardFace(c, { size: 'browse' })}<b>${escHtml(c.name)}</b><span class="small" style="white-space:normal">${escHtml(c.effect)}</span></div>`; }).join('')}</div>
    <p class="small muted">${escHtml(t('play.advHand'))}: ${run.hand.map((id) => escHtml(s.cards.byId[id].name)).join(', ') || 'none'}</p>
    <div class="row"><button class="btn btn--primary btn--lg" data-action="play-next-level">${escHtml(t('play.nextLevel'))} ${run.level + 1}</button></div>
  </div>`;
}

function history(run) {
  return `<div class="table-wrap"><table class="ladder"><thead><tr><th>Level</th><th>Result</th><th>Rounds</th><th>Broken</th></tr></thead><tbody>
    ${run.history.map((h) => `<tr><td>${h.level}</td><td>${h.outcome}</td><td>${h.rounds}</td><td>${h.broken}</td></tr>`).join('')}</tbody></table></div>`;
}
function renderDone(s, run) {
  const first = run.kind === 'first';
  return `<div class="container stack">
    <div class="banner banner--win">${escHtml(first ? 'You beat the First Game.' : t('play.runWon'))}</div>
    ${history(run)}
    <div class="row">${first ? `<button class="btn btn--primary btn--lg" data-action="play-go-full">${escHtml(t('play.fullRun'))}</button>` : ''}<button class="btn btn--lg" data-action="play-new-run">${escHtml(t('play.newRun'))}</button></div>
  </div>`;
}
function renderLost(s, run) {
  return `<div class="container stack">
    <div class="banner banner--lose">${escHtml(t('play.lost'))} ${escHtml(t('play.level'))} ${run.level}.</div>
    ${history(run)}
    <div class="row"><button class="btn btn--primary btn--lg" data-action="play-new-run">${escHtml(t('play.newRun'))}</button></div>
  </div>`;
}

// ── Actions ──────────────────────────────────────────────────
/** Returns true when the view must re-render. */
export function onPlayAction(s, act, el, e) {
  const run = s.run;
  const f = run?.fight;
  const ui = run ? (run.ui ||= {}) : null;
  const d = el.dataset;
  try {
    switch (act) {
      case 'kind': s.runKind = d.kind; return true;
      case 'element': s.element = d.element; return true;
      case 'die': s.die = d.die; return true;
      case 'mode': s.mode = d.mode; return true;
      case 'start': {
        s.run = newRun(s.cards, { kind: s.runKind || 'first', element: s.element, die: s.die, mode: s.mode });
        startLevel(s.run, s.cards);
        return true;
      }
      case 'resume': return true;
      case 'abandon': s.run = null; showToast('Run abandoned'); return true;
      case 'new-run': s.run = null; return true;
      case 'go-full': s.runKind = 'full'; s.run = null; return true;
      // fight
      case 'pick': {
        const a = f ? legalAttacks(f).find((x) => x.id === d.id) : null;
        if (a && !a.canAfford) {
          // aria-disabled instead of disabled so this click arrives and can explain itself
          showToast(`${a.name}: ${a.actions > f.actionsLeft ? t('play.needActions') : t('play.needBet')}`);
          return false;
        }
        ui.attackId = ui.attackId === d.id ? null : d.id; ui.bet = 1; ui.target = ui.target ?? 'body'; ui.useRune = false; return true;
      }
      case 'bet': ui.bet = Number(d.bet); return true;
      case 'target': ui.target = d.target === 'body' ? 'body' : Number(d.target); return true;
      case 'rune': ui.useRune = !!el.checked; return false;
      case 'typed': ui.typed = Number(el.value) || null; return false;
      case 'roll': return doAttack(s, run, f, ui, ui.typed ?? null);
      case 'go-typed': { if (!ui.typed) { showToast('Type your roll first'); return false; } return doAttack(s, run, f, ui, ui.typed); }
      case 'reroll': {
        const r = reroll(f, { roll: rollDie(f.die, Math.random) });
        ui.last = { name: 'Reroll', hit: r.hit, dealt: r.dealt, roll: null, auto: false };
        ui.bossHit = r.hit; ui.heroHit = false; return true;
      }
      case 'hide': hide(f); return true;
      case 'adv': {
        const r = playAdvantage(f, d.id);
        if (r.draw) { const drawn = run.advDeck.splice(0, r.draw); f.hero.advantage.push(...drawn); showToast(`Drew ${drawn.length}`); }
        return true;
      }
      case 'end-turn': {
        ui.attackId = null; ui.last = null; ui.bossHit = false;
        endTurn(f);
        if (f.phase === 'lost') levelLost(run);
        return true;
      }
      case 'boss-roll': { bossRoll(f, 1 + Math.floor(Math.random() * 6)); return true; }
      case 'resolve': {
        const before = broken(f);
        const r = resolveBoss(f, { barrier: d.barrier === '1' });
        ui.heroHit = broken(f) > before || spent(f) > 0; ui.bossHit = false;
        if (r === 'again') showToast('Castle: the boss acts again');
        if (f.phase === 'lost' || f.phase === 'stall') levelLost(run);
        return true;
      }
      // level end
      case 'continue': {
        levelWon(run);
        if (run.stage === 'draft') revealDraft(run, s.cards);
        return true;
      }
      case 'class': chooseClass(run, d.id); revealDraft(run, s.cards); return true;
      case 'draft': takeSkill(run, d.id); ui.drawn = drawAdvantage(run, 1); return true;
      case 'next-level': nextLevel(run, s.cards); return true;
      case 'lost': s.run = null; return true;
      default: return false;
    }
  } catch (err) {
    showToast(err.message);
    console.warn(err);
    return true;
  }
}

function doAttack(s, run, f, ui, typedRoll) {
  const a = legalAttacks(f).find((x) => x.id === ui.attackId && x.canAfford);
  if (!a) { showToast('Pick a card you can afford'); return false; }
  const step = effectiveStep(f, a);
  // A typed physical roll is clamped to the chosen die's range; nothing else validates it.
  if (typedRoll != null) typedRoll = Math.max(1, Math.min(dieMax(f.die), Math.round(typedRoll)));
  const roll = step ? (typedRoll ?? rollDie(f.die, Math.random)) : null;
  const target = typeof ui.target === 'number' && f.boss.minions[ui.target] ? ui.target : 'body';
  const r = attack(f, a, { bet: ui.bet || 1, target, roll, useRune: ui.useRune && f.hero.rune > 0 });
  ui.last = { name: a.name, hit: r.hit, auto: r.auto, dealt: r.dealt, roll: r.auto ? null : roll, need: r.need };
  ui.bossHit = r.hit; ui.heroHit = false; ui.useRune = false; ui.typed = null;
  // Keep the card selected while it is still affordable, so the resolve panel
  // (and its Roll button) survives repeat attacks instead of vanishing each time.
  if (!legalAttacks(f).some((x) => x.id === a.id && x.canAfford)) ui.attackId = null;
  if (typeof ui.target === 'number' && !f.boss.minions[ui.target]) ui.target = 'body';
  return true;
}
