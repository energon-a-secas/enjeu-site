// The play board: the plan lane, the click path, and Second Wind.
//
// The lane is tested through the same two entry points the screen uses, and no
// third one: views/play-plan.js for the rules of a declared turn, and
// onPlayAction for the click path (so a refusal the mouse would hit is a
// refusal here). Rolls are always handed in; nothing below lets the engine
// invent one, which is the invariant the whole project rests on.
//
// Queued and awaited rather than called inside a try: a test that passes by
// returning a Promise is worse than no test (tests/cards.test.mjs, same
// runner, was fixed for exactly that).
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { useCards } from '../js/data/cards.js';
import { newFight, playAdvantage, take, bossRoll, endTurn, resolveBoss, ready, spent, broken, bossHp, attack, reviveStep, attemptRevive } from '../js/game/engine.js';
import { newRun, startLevel } from '../js/game/run.js';
import { validatePlan, queueStep, unqueueStep, setStepBet, toggleStepRune, advancePlan, planActions, pickable, betRoom } from '../js/views/play-plan.js';
import { onPlayAction, renderPlay, onPlayKey } from '../js/views/play.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const data = useCards(JSON.parse(readFileSync(join(root, 'data/cards.json'), 'utf8')));

// showToast writes into the page. Node has no page, and a refusal that cannot
// speak is still a refusal, so give it somewhere harmless to speak into.
const said = [];
globalThis.document = {
  getElementById: () => null,
  createElement: () => ({ classList: { add: (c) => said.push(c), remove: () => {} }, setAttribute: () => {}, set textContent(v) { said.push(v); } }),
  body: { appendChild: () => {} },
};

let passed = 0, failed = 0;
const queue = [];
const test = (name, fn) => queue.push([name, fn]);

const ATTACKS = data.attack;                    // Strike, Focus, All In, Bubble
const L1 = data.byId['boss-m'];
const fight = (over = {}) => newFight(data, {
  level: 1, boss: L1,
  hero: { element: 'fire', klass: null, pool: over.pool || ['fire', 'fire', 'fire', 'fire'], attacks: ATTACKS },
  die: 'd20', mode: 'standard', ...over,
});
/** The shape onPlayAction expects around a fight, without the campaign noise. */
const session = (f) => ({ cards: data, run: { kind: 'first', element: 'fire', fight: f, ui: {}, stage: 'fight', history: [], skillPool: [], advDeck: [], hand: [], extraLives: 0, secondWind: !!f.hero.secondWind } });
const click = (s, act, dataset = {}) => onPlayAction(s, act, { dataset }, null);
const ids = (plan) => plan.map((st) => st.id);

// ── 1. Building the lane ─────────────────────────────────────
test('three clicks on one card queue three steps, in the order they were clicked', () => {
  const s = session(fight());
  click(s, 'pick', { id: 'strike' });
  click(s, 'pick', { id: 'focus' });
  click(s, 'pick', { id: 'strike' });
  assert.deepEqual(ids(s.run.ui.plan), ['strike', 'focus', 'strike']);
  assert.equal(planActions(s.run.fight, s.run.ui.plan), 3);
});

test('unqueue drops the step you clicked, not the last one', () => {
  const s = session(fight());
  for (const id of ['strike', 'focus', 'strike']) click(s, 'pick', { id });
  click(s, 'unqueue', { i: '1' });
  assert.deepEqual(ids(s.run.ui.plan), ['strike', 'strike']);
  click(s, 'unqueue', { i: '0' });
  assert.deepEqual(ids(s.run.ui.plan), ['strike']);
  assert.deepEqual(ids(unqueueStep(s.run.ui.plan, 9)), ['strike'], 'an index off the end changes nothing');
});

// ── 2. The two refusals ──────────────────────────────────────
test('a plan over the three-action budget is REFUSED, not clamped or silently dropped', () => {
  const f = fight();
  const s = session(f);
  click(s, 'pick', { id: 'all-in' });            // 2 actions
  assert.equal(s.run.ui.plan.length, 1);
  const again = click(s, 'pick', { id: 'all-in' });   // would be 4 of 3
  assert.equal(again, false, 'the refusal does not re-render, it explains itself');
  assert.equal(s.run.ui.plan.length, 1, 'and the plan is untouched');
  assert.equal(queueStep(f, s.run.ui.plan, 'all-in').reason, 'tooManyActions');
  assert.equal(pickable(f, s.run.ui.plan)['all-in'], false, 'the hand shows it as unavailable');
  assert.equal(pickable(f, s.run.ui.plan).strike, true, 'the 1-action card is still offered');
});

test('a plan whose LATER step has no Ready card left to bet is refused, with that reason', () => {
  const f = fight();                              // 4 Ready
  const s = session(f);
  click(s, 'pick', { id: 'all-in' });
  click(s, 'step-bet', { i: '0', bet: '4' });      // All In stakes all four
  assert.equal(s.run.ui.plan[0].bet, 4);
  const v = validatePlan(f, [...s.run.ui.plan, { id: 'focus', bet: 0, target: 'body', rune: false }]);
  assert.equal(v.ok, false);
  assert.equal(v.reason, 'notEnoughReady');
  assert.equal(v.at, 1, 'and it names the step that cannot be paid for');
  assert.equal(click(s, 'pick', { id: 'focus' }), false);
  assert.equal(s.run.ui.plan.length, 1);
  // Betting more than exists is refused too, rather than quietly clamped: the
  // number the player typed IS the plan.
  assert.equal(setStepBet(f, s.run.ui.plan, 0, 5).ok, false);
});

// ── 3. Resolving ─────────────────────────────────────────────
test('resolving a plan lands exactly where calling the engine step by step lands', () => {
  const lane = fight(), byHand = fight();
  const ui = { plan: [{ id: 'strike', bet: 0, target: 'body', rune: false }, { id: 'focus', bet: 1, target: 'body', rune: false }], at: 0 };
  const first = advancePlan(lane, ui, null);
  assert.equal(first.awaiting, 1, 'Strike needs no die, so the lane stops on Focus');
  const second = advancePlan(lane, ui, 15);       // Sure on d20 needs 6+
  assert.equal(second.done, true);

  attack(byHand, byHand.hero.attacks.find((a) => a.id === 'strike'), { target: 'body' });
  attack(byHand, byHand.hero.attacks.find((a) => a.id === 'focus'), { bet: 1, target: 'body', roll: 15 });

  assert.equal(bossHp(lane), bossHp(byHand));
  assert.equal(lane.actionsLeft, byHand.actionsLeft);
  assert.deepEqual([ready(lane), spent(lane), broken(lane)], [ready(byHand), spent(byHand), broken(byHand)]);
  assert.equal(lane.stats.attacks, byHand.stats.attacks);
  assert.deepEqual(lane.log.map((l) => l.text), byHand.log.map((l) => l.text));
});

test('the lane re-checks itself as it goes and STOPS loudly rather than skipping a step', () => {
  const f = fight({ pool: ['fire', 'fire'] });
  // Legal when declared: 2 actions, 2 bets, 2 Ready.
  const ui = { plan: [{ id: 'focus', bet: 0, target: 'body', rune: false }, { id: 'focus', bet: 0, target: 'body', rune: false }], at: 0 };
  assert.equal(validatePlan(f, ui.plan).ok, true, 'legal when it was declared');
  assert.equal(advancePlan(f, ui, 15).awaiting, 1, 'step 1 resolved, step 2 wants a die');
  take(f, 25, true);                              // the last Ready card breaks between steps
  const r = advancePlan(f, ui, 15);
  assert.equal(r.error, 'notEnoughReady', 'the reason, not a silent skip');
  assert.equal(r.at, 1, 'named at the step that cannot be paid for');
  assert.equal(ui.at, 1, 'the lane did not move past it');
  assert.equal(f.actionsLeft, 2, 'and nothing was spent on the step that was refused');
});

test('a Rune attached to a step makes that step succeed with no die at all', () => {
  const f = fight();
  f.hero.advantage.push('rune');
  playAdvantage(f, 'rune');
  assert.equal(f.hero.rune, 1);
  const q = queueStep(f, [], 'focus');
  const withRune = toggleStepRune(f, q.plan, 0);
  assert.equal(withRune.ok, true);
  assert.equal(withRune.plan[0].rune, true);
  assert.equal(toggleStepRune(f, withRune.plan, 0).ok, true, 'and it can be taken back off');

  const ui = { plan: withRune.plan, at: 0 };
  const r = advancePlan(f, ui, null);              // no roll offered, and none needed
  assert.equal(r.done, true, 'the lane did not stop for a die');
  assert.equal(ui.last.auto, true);
  assert.equal(ui.last.hit, true);
  assert.equal(f.hero.rune, 0, 'the Rune was spent on that check');
  assert.equal(bossHp(f), 400 - 75);
  // A second step cannot claim the same Rune.
  const two = queueStep(f, ui.plan, 'focus');
  assert.equal(toggleStepRune(f, two.plan, 1).ok, false);
});

// ── 4. Second Wind ───────────────────────────────────────────
test('Second Wind: the run puts the card in play and the fight reaches Down instead of lost', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  assert.equal(run.fight.hero.secondWind, true);
  const f = run.fight;
  take(f, 5 * 25, true);                           // more than the pool can owe
  assert.equal(f.phase, 'down', 'Down, not lost: the comeback has not been offered yet');
  assert.equal(reviveStep(f), null, 'the first comeback each level is free');
});

test('Second Wind: the first comeback is free, returns 2 Broken as Ready, then the ladder climbs', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  const f = run.fight;
  const s = { cards: data, run };
  take(f, 5 * 25, true);
  assert.equal(broken(f), 4);

  click(s, 'revive');                              // free: no die is thrown
  assert.equal(f.hero.revives, 1);
  assert.equal(ready(f), 2, 'back up with 2 cards standing');
  assert.equal(broken(f), 2);
  assert.equal(f.phase, 'act');
  assert.equal(reviveStep(f), 'sure', 'the ladder starts climbing for the next one');

  take(f, 5 * 25, true);                           // down again, same level
  assert.equal(f.phase, 'down');
  run.ui.typed = 6;                                // Sure on d20 needs 6+, typed so it is not a coin flip
  click(s, 'revive');
  assert.equal(f.hero.revives, 2);
  assert.equal(ready(f), 2);
  assert.equal(reviveStep(f), 'even', 'and again');

  take(f, 5 * 25, true);
  run.ui.typed = 1;                                // a failed comeback ends the level
  click(s, 'revive');
  assert.equal(f.phase, 'lost');
  assert.equal(run.stage, 'lost');
});

test('Second Wind after the boss acts puts the round back, instead of gifting a free turn', () => {
  const f = fight({ pool: ['fire'], secondWind: true });
  const s = session(f);
  f.phase = 'boss';
  const p = bossRoll(f, 6);                        // Ruin: double damage
  assert.equal(p.dmg, 100);
  click(s, 'resolve', { barrier: '0' });
  assert.equal(f.phase, 'down');
  assert.equal(f.round, 1, 'the round did not advance while the hero was Down');
  click(s, 'revive');
  assert.equal(f.phase, 'act');
  assert.equal(f.round, 2, 'the comeback resumes the fight, it does not repeat the turn');
  assert.equal(f.actionsLeft, 3);
});

test('declining the comeback ends the level without inventing a die roll', () => {
  const f = fight({ pool: ['fire'], secondWind: true });
  const s = session(f);
  take(f, 5 * 25, true);
  assert.equal(f.phase, 'down');
  const before = f.log.length;
  click(s, 'give-up');
  assert.equal(f.phase, 'lost');
  assert.equal(f.hero.revives, 0, 'no attempt was recorded');
  assert.equal(f.log.length, before, 'and no roll was written into the log');
});

// ── 5. The markup the keyboard is an alias for ───────────────
/**
 * The keyboard alias must not steal Enter from whatever is focused. It used to:
 * onPlayKey claimed Enter unconditionally and preventDefault'd it, so a keyboard
 * user who tabbed to "Abandon run" and pressed Enter resolved their turn instead,
 * and while a primary action existed (most of a fight) no other control on the
 * board could be activated with Enter at all.
 */
test('Enter belongs to the focused control, and only reaches the board when nothing is focused', () => {
  const clicked = [];
  const primary = { click: () => clicked.push('primary') };
  const saved = globalThis.document;
  globalThis.document = {
    querySelectorAll: (sel) => (sel === '.actions .btn--primary' ? [primary] : []),
  };
  try {
    const press = (target) => {
      clicked.length = 0;
      let prevented = false;
      onPlayKey({}, { key: 'Enter', target, preventDefault: () => { prevented = true; } });
      return { clicked: [...clicked], prevented };
    };
    // A focused button keeps its own Enter.
    const onButton = press({ closest: (sel) => (/button/.test(sel) ? {} : null) });
    assert.deepEqual(onButton.clicked, [], 'Enter on a button must not reach the board');
    assert.equal(onButton.prevented, false, 'and must not be preventDefault-ed away');
    // With nothing focused, Enter is the board's.
    const onBody = press({ closest: () => null });
    assert.deepEqual(onBody.clicked, ['primary'], 'Enter still resolves the turn from the board');
    assert.equal(onBody.prevented, true);
  } finally {
    globalThis.document = saved;
  }
});

test('betRoom is what could LEGALLY be staked: other steps subtract, your own stake does not double', () => {
  const f = fight();
  let plan = queueStep(f, [], 'all-in', {}).plan;
  plan = queueStep(f, plan, 'focus', {}).plan;
  // Pool of 4: Focus stakes 1, so All In can reach at most 3. The old ceiling
  // said readyAt(0) + own bet = 4 + 1 = 5 and rendered dead buttons past 3.
  assert.equal(betRoom(f, plan, 0), 3, 'every Ready card no other step has claimed');
  plan[0].bet = 3;
  assert.equal(betRoom(f, plan, 0), 3, 'raising your own bet must not raise your own ceiling');
});

test('Resolve opens a chooser: throw each die or resolve at once, one primary either way', () => {
  const s = session(fight());
  s.play = { tourDone: true };
  click(s, 'pick', { id: 'focus' });
  click(s, 'resolve-plan');
  let html = renderPlay(s);
  assert.ok(html.includes('rm-backdrop'), 'the popup opens instead of advancing');
  assert.ok(html.includes('data-action="play-resolve-throw"'));
  assert.ok(html.includes('data-action="play-resolve-fast"'));
  const actions = html.slice(html.indexOf('<div class="panel actions">'));
  assert.equal(actions.split('btn--primary').length - 1, 1, 'the modal primary is the only one');
  assert.equal(s.run.fight.actionsLeft, 3, 'opening the chooser resolves nothing: actions are spent by the throw, not the door');

  click(s, 'resolve-fast');
  html = renderPlay(s);
  assert.ok(html.includes('rm-ledger'), 'the fast path shows the ledger');
  assert.ok(html.includes('data-action="play-resolve-close"'));
  const ui = s.run.ui;
  assert.equal(ui.results.length, 1, 'one step, one result row');
  click(s, 'resolve-close');
  assert.ok(!renderPlay(s).includes('rm-backdrop'), 'Done closes the stage');
});

test('the first fight offers the tour: four steps, skippable, remembered on the session', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  const s = { cards: data, run, view: 'play' };
  let html = renderPlay(s);
  assert.ok(html.includes('tour-callout'), 'a fresh session gets the tour');
  assert.ok(html.includes('data-tour-on="wall"'), 'and it starts at the boss wall');
  onPlayAction(s, 'tour-next', { dataset: {} }, null);
  html = renderPlay(s);
  assert.ok(html.includes('data-tour-on="life"'), 'Next walks the steps');
  onPlayAction(s, 'tour-skip', { dataset: {} }, null);
  assert.equal(s.play.tourDone, true, 'Skip is remembered');
  html = renderPlay(s);
  assert.ok(!html.includes('tour-callout'), 'and the tour never comes back');
  // The last step closes it too.
  const s2 = { cards: data, run, view: 'play', play: { tourStep: 3 } };
  onPlayAction(s2, 'tour-next', { dataset: {} }, null);
  assert.equal(s2.play.tourDone, true, 'Got it on the last step closes it');
});

test('the board renders the hooks onPlayKey clicks: play-pick, play-unqueue, one primary in .actions', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  // tourDone: this test is about the ACTIONS panel; the first-run tour has its
  // own test below, and its Next button lives outside .actions on purpose
  // (Enter clicks '.actions .btn--primary', so the tour never captures it).
  const s = { cards: data, run, view: 'play', play: { tourDone: true } };
  let html = renderPlay(s);
  assert.ok(html.includes('data-action="play-pick"'), 'a hand a digit can pick');
  assert.ok(html.includes('data-action="play-abandon"'));
  assert.ok(!html.includes('[play.'), 'no unresolved string key on the board');
  assert.ok(!html.includes('onclick'), 'no inline handlers');

  click(s, 'pick', { id: 'strike' });
  html = renderPlay(s);
  assert.ok(html.includes('data-action="play-unqueue"'), 'a numbered step Backspace can drop');
  assert.ok(html.includes('data-action="play-resolve-plan"'));
  const actions = html.slice(html.indexOf('<div class="panel actions">'));
  const primaries = actions.split('btn--primary').length - 1;
  assert.equal(primaries, 1, 'exactly one primary button, so Enter is never ambiguous');
  assert.ok(actions.indexOf('data-action="play-resolve-plan"') > -1);

  // And the rest of the table is on screen. A First Game has no face-down pile
  // at all now: it has no skill pool and no Advantage deck, and the boss's life
  // is face UP on the wall, which is where RULES.md setup step 4 puts it on a
  // real table. The rail used to draw all three as dashed outlines regardless.
  assert.ok(html.includes('On the table'));
  assert.ok(!html.includes('card back'), 'a First Game has no face-down pile to draw');
  const full = newRun(data, { kind: 'full', element: 'fire', die: 'd20', mode: 'standard', secondWind: false });
  startLevel(full, data);
  const fullHtml = renderPlay({ cards: data, run: full, view: 'play' });
  assert.ok(fullHtml.includes('card back'), 'a full run does have face-down piles, and they use the printed back');
});

test('the Second Wind toggle is on the setup screen, wired without an inline handler', () => {
  // Setup became four slides; the toggle lives on slide 3 ("How kind the game
  // is") and the stepper is how you reach it, so this walks there like a player.
  const s = { cards: data, run: null, runKind: 'first', secondWind: true, die: 'd20', mode: 'standard', element: 'fire', view: 'play' };
  const slide1 = renderPlay(s);
  assert.ok(slide1.includes('data-action="play-setup-step"'), 'the stepper is on screen');
  assert.ok(!slide1.includes('data-action="play-start"'), 'Start waits on the last slide');
  onPlayAction(s, 'setup-step', { dataset: { step: '2' } }, null);
  const html = renderPlay(s);
  assert.ok(html.includes('data-change="play-second-wind"'));
  assert.ok(html.includes('Second Wind'));
  assert.ok(html.includes('checked'), 'and it starts armed for a First Game');
  onPlayAction(s, 'setup-step', { dataset: { step: '3' } }, null);
  assert.ok(renderPlay(s).includes('data-action="play-start"'), 'the table slide carries Start');
  onPlayAction(s, 'second-wind', { checked: false, dataset: {} }, null);
  assert.equal(s.secondWind, false);
  onPlayAction(s, 'kind', { dataset: { kind: 'full' } }, null);
  assert.equal(s.secondWind, false, 'the five-level run leaves the card in the box');
  onPlayAction(s, 'kind', { dataset: { kind: 'first' } }, null);
  assert.equal(s.secondWind, true);
});

test('a saved run stays small: no card, deck or rendered string rides along in the plan', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  const s = { cards: data, run };
  click(s, 'pick', { id: 'all-in' });
  click(s, 'step-bet', { i: '0', bet: '2' });
  for (const st of run.ui.plan) assert.deepEqual(Object.keys(st).sort(), ['bet', 'id', 'rune', 'target']);
  const size = JSON.stringify(run).length;
  assert.ok(size < 6000, `a saved run should stay a few KB, got ${size}`);
  assert.ok(!JSON.stringify(run).includes('<svg'), 'no rendered markup in the save');
});

// ── 5. The board ─────────────────────────────────────────────
test('the log starts closed, opens on click below the board, and the choice is not stored on the run', () => {
  const run = newRun(data, { kind: 'first', element: 'fire', die: 'd20', mode: 'standard', secondWind: true });
  startLevel(run, data);
  const s = { cards: data, run, view: 'play' };
  let html = renderPlay(s);
  assert.ok(html.includes('data-log="closed"'), 'the log starts closed: it earns its space only when asked for');
  assert.ok(!html.includes('<ul class="log">'), 'a closed log is not even rendered');
  assert.ok(html.includes('log-tick'), 'but the last line always shows, as one line');

  onPlayAction(s, 'log', { dataset: {} }, null);
  assert.equal(s.play.logShown, true);
  html = renderPlay(s);
  assert.ok(html.includes('data-log="open"'));
  assert.ok(html.includes('fight-log-below'), 'the open log is a full-width row below the board, not a side column');
  assert.ok(html.includes('<ul class="log">'));
  // run.ui is wiped every level by game/run.js, so a preference cannot live there.
  assert.equal(run.ui.logShown, undefined);
});

test('the Cover button is offered only for a Strike aimed at a standing Ally', () => {
  const withAlly = () => {
    const s = session(fight());
    s.run.fight.hero.advantage.push('ally');
    playAdvantage(s.run.fight, 'ally');
    endTurn(s.run.fight);
    bossRoll(s.run.fight, 2);           // 2 is Strike, the only reaction that looks at the Ally
    return s;
  };
  // Read from the log, not from the pool: resolveBoss starts the next round on
  // its way out and Recover has already stood the guarding cards back up.
  const logText = (f, from) => f.log.slice(from).map((l) => l.text).join(' ');

  const s = withAlly();
  assert.equal(s.run.fight.pending.at, 'ally');
  assert.ok(renderPlay(s).includes('data-cover="1"'), 'the offer to step in front of it');
  let mark = s.run.fight.log.length;
  click(s, 'resolve', { barrier: '0', cover: '1' });
  assert.match(logText(s.run.fight, mark), /cover the Ally and take it whole/);
  assert.match(logText(s.run.fight, mark), /Guarded 50 with 2 Ready cards/, 'the hero paid for it, whole');
  assert.ok(s.run.fight.hero.ally, 'and the Ally is still standing');

  // Declining is the free option: the Ally's own defense eats a level-1 Strike.
  const s2 = withAlly();
  mark = s2.run.fight.log.length;
  click(s2, 'resolve', { barrier: '0' });
  assert.match(logText(s2.run.fight, mark), /50 defense absorbs all 50/);
  assert.ok(!/Guarded/.test(logText(s2.run.fight, mark)), 'nothing reached the hero');
  assert.ok(s2.run.fight.hero.ally);

  // No Ally on the table, no offer to cover one.
  const s3 = session(fight());
  endTurn(s3.run.fight);
  bossRoll(s3.run.fight, 2);
  assert.ok(!renderPlay(s3).includes('data-cover'), 'nothing to cover, nothing offered');
});

test('the target strip always offers the boss, and the ring follows what you press', () => {
  const s = session(fight());
  const f = s.run.fight;
  let html = renderPlay(s);
  assert.ok(html.includes('data-action="play-target"') && html.includes('data-target="body"'),
    'the body chip is there before there is anything else to hit');
  assert.match(html, /class="minion is-target"[^>]*data-target="body"[^>]*aria-pressed="true"/);

  endTurn(f);
  bossRoll(f, 4);                        // 4 is Summon: life moves under a new figure
  resolveBoss(f, {});
  assert.equal(f.boss.minions.length, 1, 'a second target on the table');
  html = renderPlay(s);
  assert.equal(html.split('data-action="play-target"').length - 1, 2, 'one chip each');

  click(s, 'target', { target: '0' });
  html = renderPlay(s);
  assert.match(html, /data-target="0"[^>]*aria-pressed="true"/);
  assert.ok(!/data-target="body"[^>]*aria-pressed="true"/.test(html), 'and only one is pressed');
});

// ── 6. Iteration 1: the fight's heartbeat ────────────────────
test('the boss d6 accepts the face the child actually threw', () => {
  const s = session(fight());
  click(s, 'end-turn');
  const html = renderPlay(s);
  assert.ok(html.includes('data-action="play-boss-face"'), 'six face chips are offered');
  assert.ok((html.match(/play-boss-face/g) || []).length >= 6, 'all six faces');
  click(s, 'boss-face', { face: '4' });
  assert.equal(s.run.fight.pending.roll, 4, 'the typed face reaches bossRoll, no screen random');
  assert.equal(s.run.fight.pending.name, 'Summon');
});

test('abandon is two-tap: the first arms it, anything else disarms it', () => {
  const s = session(fight());
  click(s, 'abandon');
  assert.ok(s.run, 'one tap must not end a run');
  assert.equal(s.run.ui.confirmAbandon, true);
  click(s, 'pick', { id: 'strike' });
  assert.equal(s.run.ui.confirmAbandon, false, 'any other action stands down');
  click(s, 'abandon'); click(s, 'abandon');
  assert.equal(s.run, null, 'two taps in a row do abandon');
});

test('the wall renders the card this hit knocked off, weighted by the damage', () => {
  const s = session(fight());
  for (const id of ['all-in']) click(s, 'pick', { id });
  click(s, 'step-bet', { i: '0', bet: '3' });
  click(s, 'resolve-plan');        // opens the chooser
  click(s, 'resolve-throw');       // step mode: advance to the check
  click(s, 'go-typed');            // needs a roll; use typed path
  s.run.ui.typed = 20; click(s, 'go-typed');
  const ui = s.run.ui;
  if (ui.last?.hit) {
    assert.ok(ui.dealt >= 300, `a 3-card All In deals 300+, got ${ui.dealt}`);
    assert.ok(ui.wallFell >= 3, `300 damage fells 3 wall cards, got ${ui.wallFell}`);
    const html = renderPlay(s);
    assert.ok(html.includes('hit-xl'), 'a 300+ hit carries the xl weight class');
    assert.ok((html.match(/lc-falls/g) || []).length === ui.wallFell, 'each felled card renders once, falling');
  } else {
    assert.equal(ui.event, 'whiff', 'a missed bet is the whiff event');
  }
});

test('the endings own the bubble: win fells the figure, loss stays kind', () => {
  const s = session(fight());
  const f = s.run.fight;
  f.boss.body = 25;
  click(s, 'pick', { id: 'strike' });
  click(s, 'resolve-plan');
  click(s, 'resolve-fast');
  assert.equal(f.phase, 'won');
  const html = renderPlay(s);
  assert.ok(html.includes('is-felled'), 'the boss figure falls over');
  assert.ok(html.includes('one brick at a time') || html.includes('The wall is gone'), 'a win line, not an idle line');
  const g = session(fight());
  g.run.fight.phase = 'lost';
  const lost = renderPlay(g);
  assert.ok(lost.includes('it will wait') || lost.includes('rematch'), 'losing lands gently');
});

test('the boss notices the Ally, and each boss has its own idle lines', () => {
  const s = session(fight());
  s.run.fight.hero.ally = { def: 50 };
  assert.ok(renderPlay(s).includes('the small one beside you'), 'the allyNear line finally fires');
  s.run.fight.hero.ally = null;
  s.run.fight.round = 2;          // the interleave puts the boss's own line second
  const html = renderPlay(s);
  assert.ok(html.includes('clicks its shell') || html.includes('sure of itself'), 'the level 1 boss speaks as the Beetle');
});

test('draft and class picks need a confirm; undo-last is a visible button', () => {
  const run = newRun(data, { kind: 'full', element: 'fire', die: 'd20', mode: 'standard', secondWind: false });
  startLevel(run, data);
  const s = { cards: data, run, view: 'play' };
  run.stage = 'class'; run.ui = {};
  click(s, 'class', { id: 'knight' });
  assert.ok(!run.klass, 'one tap must not commit a class');
  assert.equal(run.ui.pickClass, 'knight');
  click(s, 'class-confirm');
  assert.equal(run.klass, 'knight', 'the confirm commits it');
  const t2 = session(fight());
  click(t2, 'pick', { id: 'strike' }); click(t2, 'pick', { id: 'focus' });
  assert.ok(renderPlay(t2).includes('data-action="play-undo-last"'), 'undo is visible, not hover-only');
  click(t2, 'undo-last');
  assert.deepEqual(ids(t2.run.ui.plan), ['strike']);
});


for (const [name, fn] of queue) {
  try { await fn(); passed++; console.log(`  ok   ${name}`); }
  catch (e) { failed++; console.log(`  FAIL ${name}\n       ${e.message}`); }
}
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
