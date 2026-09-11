# Enjeu: the expansion ladder

The base game is finished and printable: 111 cards, 13 sheets, one player, one die.
This document plans what grows on top of it, and in what order, so that a table can
stop at any rung and still be playing a complete game.

Everything here is **additive and droppable**. Nothing in this document changes a
printed card face. The 111 cards you already have stay correct forever. That is a
hard constraint, not a preference: cards have been sent to a printing service.

---

## 1. The spine: one stake became four

The game is named for what it does. *Enjeu* is what is at stake, and the whole of
the base game is a single trade: a life card in your hand is either **damage you
deal** or **damage you survive**, and never both. One currency, one tension, and it
is enough to carry five levels.

Every module below adds exactly one new thing to stake. That is the test each one
had to pass, and it is what keeps the game from becoming bookkeeping:

| Stake | What it means at the table | Module |
|---|---|---|
| Life cards | The base game. Bet or guard. | shipped |
| **Position** | Where your figure is standing is now something that can hurt it | M1 Terrain |
| **Tempo** | Give up this turn to make the next one enormous | M2 Preparation |
| **Knowledge** | Spend an action to find out instead of to hit | M3 Wits |
| **Possessions** | Things you keep between levels, and can lose | M4 Binder |

M5, M6 and M7 add no new stake. They add new *hands to play with*: creatures that
act for you, a second player who runs the boss, and stories to fight through.

A module that cannot be described as a new stake or a new hand is a module that is
adding tracking for its own sake, and it does not get built.

---

## 2. The one new primitive: the Mark

Six of the seven modules need some way to say "this figure is on fire now". Building
that six times, six different ways, is how a light game becomes a heavy one. So it
gets built **once**, and every module afterwards is data.

> **A Mark is a brick you put under a figure.**
> It does one thing. It goes away.

The complete rules, all five of them:

1. A Mark sits under the figure it affects, where everyone can see it.
2. Every Mark fires at the **start of the round**, all at once, for every figure.
3. A Mark ends when its card says. Most end by themselves.
4. **The same Mark twice does not stack.** The second one just refreshes the first.
5. Every Mark is small: 25 a round when it ticks, one rung when it shifts.
   **Charged is the single named exception** at +50 once, because a whole action
   bought it. No two Marks ever combine into one bigger number.

Rules 4 and 5 are the important ones. They are what stop a figure from accumulating
an unreadable pile, and they mean a child never has to add two modifiers together.
Every Mark in every future module obeys them, or it does not ship.

Rule 2 is the one that turned out to carry the weight in practice. Marks were
first written to fire at the end of the hero's turn, and measured out as very
nearly **free**: a card Spent to guard 25 of poison Recovers at the top of the
next round, before the hero needs to bet it again. Firing after Recover instead
costs a card of betting capacity for that round, paid in the game's own
currency. One moment when everything pays is also why nobody at the table has to
remember whose turn a trigger belonged to.

### The six Marks

Brick colours, because a construction toy already has these on the table:

| Mark | Brick | What it does | How it ends |
|---|---|---|---|
| **Poison** | green | Lose 25 at the start of each round | Spend an action to shake it off |
| **Frozen** | light blue | Lose your next action. A boss loses its whole turn | By itself, after one turn |
| **Burning** | red | Lose 25 at the start of the round, then it goes out | Hide first and it goes out instead |
| **Marked** | white | Attacks against this figure are one step easier | When an attack lands |
| **Charged** | yellow | Your next landed attack deals +50 | As soon as a hit costs you a card |
| **Snared** | brown | Cannot Run, cannot Hide | Spend an action to break free |

**Marks apply to the boss and to minions exactly as they apply to you.** That is
the whole payoff of the terrain module: a poisoned boss loses 25 a round, and you
did that by pushing it into a swamp rather than by hitting it.

Two of these six exist to make later modules possible. **Charged** is how M2
prepares a devastating attack. **Marked** is what M3's Analyze produces. They are
introduced in M1 so that the primitive is complete on arrival and no later module
has to widen it.

### Where a hazard actually *is*

There is no board and there will not be one. Movement is already free in this game,
and position is fiction that the table agrees on. A hazard card says *place a brick,
that is the swamp*. Whether your figure is standing in it is a thing you and the
table can see. Being in it gives you a Mark, and the Mark is the only part the rules
care about.

This is the cheapest possible answer, and it is also the right one: it keeps the
game playable on a rug with whatever is lying there, which is the whole premise.

---

## 3. The modules

### M1: Terrain, the ground fights too  ·  SHIPPED

**Adds:** position as a stake. The Mark primitive. Four biome rules that did not exist.

Built and playable, in both languages. `js/game/marks.js` owns the primitive,
`RULES.terrain.md` and `RULES.terrain.es.md` are the rulebooks, the 14 cards
have faces and export as print-ready PNGs (`python3 tools/export_cards.py
--module terrain`), and a table switches it on from the setup screen. Proven
droppable by `make parity`: the 20-cell balance table is identical to the base
game at 4,000 fights a cell in all three modes.

Two defects were found building it, and both were older than the module. The
runner's Hide button and the simulator's bots each decided what was playable
from raw flags rather than from the engine's own predicate, so a Snared hero was
offered a Run that would throw; `tests/fuzz.test.mjs` now plays 600 chaotic
fights a run to keep that class of gap closed. And two glyphs turned out to be
the same picture at 30 mm, which only looking at them rendered could reveal.

The four elemental biome cards ship today with `rule: null`. They give an element
bonus and nothing else, which is why a table shuffles past them. They each get one
object you can use, once per level, for one action:

| Biome | The object | What it does |
|---|---|---|
| Volcano | A lava vent | The boss or one minion takes 50 and is **Burning** |
| River | The current | The boss loses its next reaction. It is swept off its feet |
| Mountain | A rockfall | The boss takes 75. You are **Snared** by the scree |
| Desert | A sinkhole | The boss is **Snared**. It cannot Brace while snared |

**These cost nothing to print.** Biome card faces carry no text at all: the rule
lives in the rulebook, which is exactly why this is free. A deck already printed
gains four new rules the moment its owner reads the new page.

**New cards:** 6 Mark reference cards, 8 Hazard cards. **2 sheets.**

A Hazard card is drawn at the start of a level and describes one dangerous thing
about this place: a tar pit, a frozen lake, a nest of thorns. It Marks whoever is
in it, and it is as much a tool as a threat.

**Droppable because:** leave the Hazard cards in the box and the biomes revert to
element bonuses. Nothing else refers to them.

---

### M2: Preparation, wind up and swing  ·  SHIPPED

**Adds:** tempo as a stake.

Every action in the base game resolves the instant you take it. There is no way to
say "I am setting something up", and setting something up is most of what makes a
fight feel like a plan rather than a sequence.

One new action, and it is the whole module:

> **Prepare.** Spend one action. Take **Charged**. Your next landed attack deals +50.
> You lose it as soon as a hit costs you a card.

That last clause is the entire design. Charging is not free power, it is a bet that
you can survive a round without spending yourself defending, which is precisely the
bet the base game is already about. It adds a new decision without adding a new kind
of decision.

**Objects** ride along in this module: a small deck of things on the table that a
level might have. A brazier, a cart, a chandelier, a rope bridge. Each is one action
and one use, and most of them Mark something.

**New cards:** 1 Prepare action card, 10 Object cards. **2 sheets.**

**Droppable because:** it is one action card. Remove it and no other module notices,
except that M5's vehicles become slightly weaker.

---

### M3: Wits, think your way out  ·  SHIPPED

**Adds:** knowledge as a stake.

This is the module for the child who does not want to hit things, and it is the one
that most changes the *feel* of the game. Three actions, none of which deal damage:

> **Scout** (1 action, check Even). Look at the boss's reaction die before you commit
> your turn.
>
> **Analyze** (1 action, check Even). **Mark** the boss. Attacks against it are one
> step easier until one lands.
>
> **Parley** (1 action, check Hard, once per level). The boss skips its next reaction.
> Fail, and it Roars instead.

Scout is nearly free to build: the engine already foretells the boss's die for the
Knight's Taunt, so the machinery exists and this is a second door into it.

Parley is the "arguing" ask, and it is deliberately a Hard check with a real
downside. Talking your way out of a fight should be a gamble, not a discount.

**New cards:** 3 action cards, 1 aid card. **1 sheet.**

Built. `RULES.wits.md` / `RULES.wits.es.md`, module id `wits`, and the one
decision worth recording: they are **cards, not buttons**. All three resolve
through `attack()`, so the hand, the plan lane, the target chips, the inspector,
the roll dialog, the Rune and the Hunter's reroll work on them with no new view
code at all. It is also the right answer for the player this module is for: an
option you have to remember is not an option, and these lie in the hand next to
Strike.

Parley's *failure* turned out to be the module's engine rather than its cost. A
failed Parley substitutes this round's reaction for a Roar, so trading away a
Ruin is a good round and trading away a Brace is the worst move in the module,
and the only way to know which you are buying is to have paid an action to Scout
first. Scout is the question and Parley is the answer.

**Droppable because:** three cards, no dependencies beyond Terrain's two bricks.
Measured rather than argued (`node tools/checks/wits.mjs`): turtle, safe,
adaptive and gamble all move **0.00** points with the module in the hand. That is
partly a property of the bots, which never pick a zero-damage card, so the real
guarantee is structural: Marked eases a *check*, Strike has none, so a player who
only ever Strikes gains literally nothing. The line to watch is Analyze into All
In, which takes the level 1 one-turn kill from 49.9% to 63.5%; if that ever needs
a lever it is Analyze's own check, never Marked's step, because Marked belongs to
Terrain and later modules are written against it.

---

### M4: The Binder, things you keep

**Adds:** possessions as a stake. This is the campaign layer.

Named for what the user asked for, and built on the idiom the game already uses.
Grudge established it: *the card under the boss card is the save file*. There is no
app state, no account, no cloud. Paper remembers.

**The binder** is one printed A4 sheet with numbered slots. After you clear a level
you **Book** one item you found: you slide its card into a slot, and it is yours for
the rest of the campaign. Slots are finite, so a full binder means choosing what to
throw away, which is the only thing that makes an inventory interesting.

Items come in two kinds:

- **Printed items**, about eighteen of them, each doing one small thing once. A rope,
  a lantern, a whetstone, an antidote that clears any Mark.
- **Blank items**, six of them, that the table writes itself. A child who says "I want
  a sword that sets things on fire" gets to make that card, and the adult sets its
  cost. This is the "custom and defined" part, and it is the reason the blanks exist
  rather than being an oversight.

**New cards:** 18 item cards, 6 blanks. **3 sheets, plus one binder sheet.**

**Droppable because:** the binder is a separate sheet of paper. No binder, no items,
and every other module is unaffected.

**Note on the Greed Island framing.** The source was checked rather than
remembered, because the vocabulary is worth borrowing and the mechanics mostly
are not. What is actually in it: a binder of **100 numbered "specified" slots
plus 45 free slots**, filling the 100 being the win condition; **40 spell cards**,
single use, that vanish when cast; and a rank scale whose number is a **global
conversion limit**, meaning how many copies may exist in the whole game at once.
"Book" and "Gain" are keywords on a ring, not spell cards, which is the detail
most retellings get wrong.

What ports: specified slots versus free slots, a finite binder that forces a
choice, and the rule that a spell can never directly harm a player. What does
not port is the conversion limit, which is global server state that a solo
print-and-play has nothing to enforce with. Do not build it.

### M5: Summons and vehicles, more than yourself

**Adds:** no new stake. A second thing to command.

The Ally advantage card already summons a companion that strikes for 25 and can be
targeted. M5 is that idea properly: a small deck of creatures with their own life
cards and their own action, and a handful of vehicles you can ride.

A vehicle changes your action economy rather than your damage. Ride a cart and you
get a fourth action but cannot Hide. That is a stake trade, not a power-up.

**New cards:** 6 summon cards, 4 vehicle cards. **2 sheets.**

**Droppable because:** nothing else refers to them. They do use Marks, so this module
wants M1 in play, and it is the first one with a soft dependency.

---

### M6: The Boss Seat, two players and versus  ·  SHIPPED

**Adds:** the other side of the table.

The user asked for a two-player mode and a versus mode. The game already ships
**Sidekick**, which is co-op: two players, one shared life pool, and the Sidekick owns
Strike and Run. That is the two-player mode, and it needs deepening rather than
inventing.

Versus is the empty chair the game has always implied. Someone has been rolling the
boss's d6 this whole time. Give that job to a person:

> The boss player holds the five reaction cards as a **hand** instead of rolling.
> Each turn they play one. They cannot play a reaction again until they have played
> all five.

The hand is what makes it a game rather than a bully. The boss player is choosing
*when* to spend Ruin, not whether to spend it every turn, and the hero can count what
is left. The existing DM dial (friendly / assisted / hardcore) becomes the handicap.

The constraint is not decoration. Fantasy Flight removed the human overlord seat
outright in Mansions of Madness 2e and replaced it with an app, and Descent moved
the same way; a free-hand adversary is a low-fun seat, and an adult playing it
against a child becomes a person losing on purpose. A hand of five that must be
spent before it repeats keeps the seat interesting and keeps the child able to
plan against it.

**New cards:** 6 reaction cards, 1 aid. **1 sheet.**

Built, and three review findings changed it. The deck is **six** cards, not five,
because the six faces of the die are the whole promise. The Row is swept every
**three**, not six: fights are 3.4 to 5.5 rounds, so a six-card cycle never
completed, and drawing without replacement measured EASIER than the die rather
than harder. And the **co-op cards were cut**, because they existed to repair a
base-game defect (the Sidekick owned Strike and Run, both checkless, while the
rulebook promised the second player a roll). That was fixed where it belonged and
where it costs nothing: RULES.md section 8b now says **Strike and Invention**,
which has a Wild check and a bet, so the second player throws real dice.

The module also refuses to print the claim its first draft led with. "The boss
player can never hit harder than the die" is true across a completed cycle and
false inside a fight, which is the only place anybody plays.

**Droppable because:** solo play is unchanged and remains the default, and the
engine never learns about any of it: `reveal()` hands `bossRoll` the same 1..6 a
die would. Measured (`node tools/checks/seat.mjs`, 2,500 fights a cell): hand 1
lands within about three points of the die everywhere, hand 2 and hand 3 are
steeply harder, and turtle level 1 falls rather than rises, so the module cannot
become the fix for the base game's defect.

---

### M7: Chronicles, stories to fight through

**Adds:** a reason.

Scenario cards: a named boss, a place, and an objective that is not always "kill it".
Hold out five rounds. Get the cart to the bridge. Fell it without breaking a single
card. Objectives are where terrain, preparation and wits stop being options and start
being the only way through, which is what makes a module ladder feel earned rather
than optional.

This module is written last on purpose. It is the only one that *consumes* the others
rather than adding a mechanism, so writing it earlier would mean writing stories for
rules that did not exist yet.

**New cards:** 5 scenario cards per arc. **1 sheet per arc.**

---

## 4. The print budget

| Set | Cards | Sheets | Cumulative |
|---|---|---|---|
| Base game | 111 | 13 | 13 |
| M1 Terrain | 14 | 2 | 15 |
| M2 Preparation | 11 | 2 | 17 |
| M3 Wits | 4 | 1 | 18 |
| M4 Binder | 24 | 3 + 1 sheet | 22 |
| M5 Summons and vehicles | 10 | 2 | 24 |
| M6 Boss Seat | 8 | 1 | 25 |
| M7 Chronicles, per arc | 5 | 1 | 26 |

Nobody prints all of that at once, and the table is arranged so nobody has to. The
existing Cards page already offers print scopes (Essentials, First Game); each module
becomes another scope, and a household prints the two sheets for the module it wants
to try on a wet Sunday.

---

## 5. Build order, and what depends on what

```
M1 Terrain ──┬──> M2 Preparation      (uses Charged)
             ├──> M3 Wits             (uses Marked)
             ├──> M5 Summons          (uses Marks generally)
             └──> M7 Chronicles       (objectives reference hazards)

M4 Binder    ── independent
M6 Boss Seat ── independent
```

M1 first, and not only because the user named poison and ice. It is the module that
installs the primitive four other modules are written against. Building M2 or M3
first would mean building a private version of Marks and then throwing it away.

M4 and M6 have no dependencies and can be built in any order after M1, or before it
if a session wants a change of pace.

---

## 6. What the table looks like

The user asked about layout. Here is what a fully-loaded table has on it, and it is
worth noticing that it stays legible because every piece of state is a physical thing
in one place rather than a number on a sheet:

- **The wall**: the boss's life cards, face up, one per 100. This is the health bar
  and you read it by looking.
- **Your pool**: life cards, Ready face up, Spent turned sideways, Broken face down.
- **Under each figure**: its Marks, as bricks. At most a few, because Marks do not stack.
- **Under the boss card**: any Grudges. The save file.
- **Beside the table**: the binder sheet, if M4 is in play.
- **The biome card and any hazard**: face up where everyone can see the place.

No trackers, no dials, no pen except for writing a custom item.

---

## 7. Prior art, and what it ruled out

The condition system was checked against published designs before it was built,
because "a light game that added conditions and stopped being light" is a very
well populated category.

**What the good ones do.** Marvel Champions ships exactly **three** status cards,
each discarded by the next relevant event rather than tracked on a timer, and a
character may never hold two of the same. Ironsworn ships eight fixed debilities,
none of them a dice modifier, each cleared by a named move rather than a roll.
Both refuse the thing that makes conditions expensive: a per-condition roll every
round.

**What the bad ones do.** Pathfinder shipped more than two dozen conditions and
then sold a 55-card accessory to track them; the second edition's deck runs past
a hundred and includes cards whose only job is holding a condition's *duration*.
A game that needs a separate product to track its own state has over-tracked.
Fourth-edition D&D's "save ends" is the named cautionary case.

**How that shaped this.** Six Marks, and only four of them are things that happen
*to* you. None asks for a roll. None stacks. None is a pip modifier: Marked moves
a whole rung, which is the game's existing vocabulary because Roar already does
it. And the damage burns the Ready / Spent / Broken track the game already has
rather than introducing a second currency, which was the single most consistent
recommendation across every design examined.

**The one warning worth repeating.** The most common way an optional module
becomes mandatory is that it quietly repairs a defect in the base game.
Terraforming Mars ships drafting as a variant and almost nobody plays without it,
because it removes luck the base game left in. Enjeu had exactly such a defect (a
turtle strategy that never bet a card won 67.7% of level 1) and it was fixed
**in the base game**, on 2026-09-05, where it belonged: Skitter's off-balance
opening is now only taken by an attack that bet a life card. Turtle level 1 fell
to 49.6% and no other style moved by a point.

That is the pattern to copy, not the exception to it. Three of the seven module
reviews caught a module reaching for the same repair, and each time the answer
was the same: if a module is the only reason the game is balanced, the game is
not balanced. Section 8 restates it as a rule.

---

## 8. What this deliberately does not do

Named so that a future session does not quietly add them back:

- **No board and no zones.** Movement stays free and position stays fiction. Zones
  would double the rules of every module above for one point of tactical depth.
- **No stacking conditions.** Rule 4 of the Mark is non-negotiable. It is the single
  line holding back the accounting.
- **No numbers that are not multiples of 25.** The base game's arithmetic promise.
- **No hidden information the solo player has to hide from themselves.** Rules out a
  whole family of otherwise attractive scouting mechanics.
- **No module that fixes a base-game imbalance.** That would make it mandatory, and
  a mandatory module is not a module. If terrain turns out to be the only way to beat
  level 5, level 5 is what gets changed.

That last one is the discipline that keeps the ladder honest, and it is the failure
mode most worth watching for as these get built.
