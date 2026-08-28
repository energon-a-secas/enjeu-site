# Enjeu: Rules

**Players:** 1 · **Play time:** ~15 minutes per level, ~60 minutes for a five-level run · **Ages:** 10+

**You supply:** one die, any of d20, d12, d10, d8, d6, d4, 2d6 or 3d6, plus your own
minifigures and bricks. **Enjeu** is not affiliated with, endorsed by, or connected to
the LEGO Group; it works with any construction toy you already own.

---

## 1. What this is

You fight five bosses, one per level. You build each boss out of whatever bricks you have,
and you play your hero as a minifigure. The cards carry the damage. You and the bricks
carry the story.

Cards have almost no text on purpose. A card's picture *is* its name; say the name out
loud when you play it. "Ice Spear." "Earthquake." "Meteor." The rules live here; the table
stays clear.

## 2. The one rule that matters

**Balance your attack and your defense.**

The cards in front of you are both at once. You spend them to attack, and the ones you
have not spent are what keeps you standing.

Life cards sit in front of you in one of three states:

| State | How it sits | What it does |
|---|---|---|
| **Ready** | upright | You may bet it. It guards you. |
| **Spent** | turned sideways | You bet it this turn. It returns to Ready at the start of your next turn. |
| **Broken** | face down in a pile | Gone for the rest of the level. |

When the boss deals damage, you **must** guard: discard 25 damage per card.

- Guard with a **Ready** card and it becomes **Spent**: it comes back next turn. You lost nothing.
- If you have no Ready cards, you **must** guard with **Spent** cards instead, and those become
  **Broken**: gone.

So betting costs you nothing *as long as you leave enough Ready to guard the incoming hit*.
Bet past that line and you start paying for it permanently. Do not be greedy: that line is
the whole game.

You are **Down** when you must Break a card and have none left. The level ends and you lose.

## 3. Setup

1. Pick your **element**: Fire, Water, Earth or Wind. Take that element's 4 life cards.
   Place them Ready. This choice lasts the whole run. You **may not** change it later.
2. Take the four **Attack** cards: Strike, Focus, All In, Bubble. These are always available.
3. Draw 1 **Biome** card and 1 **Boss** card for level 1 (or follow the campaign in §9).
4. Place the boss's life cards face up beside its build. The boss card states how much
   **each** of its life cards is worth.
5. Draw 1 **Advantage** card. Keep it face up. You **may** play it at any time.

## 4. Turn structure

Each round runs in this order:

1. **Recover.** Turn all your Spent cards upright. They are Ready again.
2. **Act.** Take up to **3 actions** (§5).
3. **Minions strike.** Each minion in play deals 25 damage to you. Guard it.
4. **The boss acts.** Roll one die on the boss's reaction table (§7). Guard what it deals.

Repeat until the boss falls or you go Down.

## 5. Actions

You have 3 actions per turn. You **may** repeat any action.

| Card | Actions | You bet | Damage | Check |
|---|---|---|---|---|
| **Strike** | 1 | none | 25 | none, it always lands |
| **Focus** | 1 | 1 card | 75 | ● Sure |
| **All In** | 2 | any number of Ready cards | 4× what you bet | ●● Even |
| **Bubble** | 1 | nothing | none: it absorbs 25 | none, it always works |

Betting turns those cards sideways (Spent) **whether the attack lands or not**. A missed
attack still costs you the life.

When you **Strike**, you **may** also do one of these for free:

- **Move**: reposition your minifigure. This has no mechanical effect; it is there so the
  fight has a place and a shape. Use it to tell the story.
- **Hide**: the next damage you take this round is halved, rounded down to the nearest 25.

**Bubble** is the brake. It costs an action and no cards, and the next 25 damage
you take this round is absorbed instead of landing. Notice when that is worth
doing: a Ready card already guards for free, so a Bubble buys you nothing while
you still have Ready cards. It earns its place under **Rage**, when damage cannot
be guarded at all and every 25 you fail to absorb breaks a card for good. An
unused Bubble pops at the start of your next turn; you cannot save them up.

**All In** is the swing. Bet 4 cards and you deal 400 on a coin flip, or nothing at all,
and you end the turn with no guard at all. It is how you finish a boss a round early, and
how you lose a run.

### Checks

Four steps. Roll your die, meet or beat the number for the die you own:

| Step | Odds | d20 | d12 | d10 | d8 | d6 | d4 | 2d6 | 3d6 |
|---|---|---|---|---|---|---|---|---|---|
| ● **Sure** | 75% | 6+ | 4+ | 3+ | 3+ | 2+ | 2+ | 6+ | 9+ |
| ●● **Even** | 50% | 11+ | 7+ | 6+ | 5+ | 4+ | 3+ | 7+ | 11+ |
| ●●● **Hard** | 25% | 16+ | 10+ | 8+ | 7+ | 5+ | 4+ | 9+ | 13+ |
| ●●●● **Wild** | 15% | 18+ | 11+ | 9+ | 8+ | 6+ | 4+ | 10+ | 14+ |

**No d20? Throw three d6.** It tracks the ladder within 1.2 percentage points at every step,
closer than any other substitute. One lone d6 works too and runs slightly in your favour.
Full derivation and fidelity ranking: [docs/DICE-BRIDGE.md](docs/DICE-BRIDGE.md).

## 6. Elements and biomes

Each element beats one other: **Water** quenches **Fire**, Fire consumes **Wind**,
Wind erodes **Earth**, Earth dams Water.

- Attacking a boss of the element yours beats: **+25 damage** on every attack that lands.
- The biome has an element too. Attacking with that element: **+25 damage**.

These stack. A Fire hero in a Volcano fighting a Wind boss adds +50 to every landed attack.
There is no penalty for a bad matchup: you simply do not get the bonus.

| Biome | Element | Also |
|---|---|---|
| Volcano | Fire | none |
| River | Water | none |
| Mountain | Earth | none |
| Desert | Wind | none |
| Forest | none | Hide costs 0 actions. |
| Village | none | You start the level with 1 extra Ready life card. |
| Castle | none | The boss acts twice on round 1. |

## 7. The boss

Each boss card states its **size**, the **value of each of its life cards**, its **Damage**,
its **element**, and its **Rage** round. Roll one die each round and read its reaction table.
The default table, which a boss card **may** override row by row:

| Roll (d6) | The boss… |
|---|---|
| 1 | **Brace**: deals no damage. Until the end of your next turn, halve all damage it takes, rounded down to the nearest 25. |
| 2–3 | **Strike**: deals its Damage. |
| 4 | **Summon**: moves 2 of its life cards under a new minifigure. If it has 2 or fewer cards left, or 3 minions already, it Strikes instead. |
| 5 | **Roar**: deals its Damage. Your next check is one step harder. |
| 6 | **Ruin**: deals double its Damage. |

If you use a die other than a d6, read the table with a d6 or divide your roll into six
equal bands. The reaction table is the one place the game wants a flat six.

### Minions

A minion's life is the cards the boss put under it. **Damage you deal a minion is damage
you deal the boss**: those cards were the boss's life. So you never waste an action on a
minion; you only choose whether to clear the small pile and stop the chip damage, or keep
hammering the big one.

### The Ally

If you have played the **Ally** Advantage card, there is a second figure on your side of the
table, and the boss can see it.

- While the Ally is in play, the boss's **Strike** hits the **Ally** instead of you.
- The Ally has **50 defense**. Subtract 50 from that damage. Anything left over sends the
  Ally away: take the figure off the table.
- **Brace, Summon, Roar and Ruin always come for you.** The Ally draws the plain attack and
  nothing else.
- Before the damage is applied you **may cover** the Ally: say so, take the hit yourself at
  its full value, and guard it as normal (§2). The Ally stays.
- From the **Rage** round on, the boss ignores the Ally and comes for you, for the same reason
  your guard stops working. Rage goes through everything, and it is not a hit you can hand to
  somebody else.

The Ally's own free 25 Strike at the start of each of your turns is unchanged.

That defense is why the card is worth keeping alive. Against a level 1 or 2 boss (Damage 50)
the Ally absorbs a Strike completely and stays for the rest of the level. From level 3 up
(75, then 100) one Strike is enough to send it away, and covering for it is a real choice:
you take the whole hit to keep the figure, or you let the figure go.

### Rage

From the **Rage** round onward, the boss deals **double** Damage, and you **cannot** guard
it with Ready cards. Every point goes straight to Broken.

Rage is why you cannot win by playing it safe. Turtling behind Strike is survivable for a
while and then it is not.

### Keeping count

The boss's life is the pile of cards beside its build, so the count is already on the
table: take a card off when its value comes off. Nothing else is needed, and this
paragraph is optional.

If you would rather read one running number, use the **Damage Track** aid card. Every
value in this game is a multiple of 25, so the track is 25, 50, 75, 100 and a box for a
die that counts hundreds. Stand a brick on the total you have dealt and move it along.
When the total passes 100, move the brick back to the amount over and turn the die in the
×100 box up by one.

> Deal 25: brick on 25. Deal 50 more: brick on 75. Deal 50 more, and that is 125, so the
> brick goes back to 25 and the die turns up to 1.

A die showing nothing is under 100. The track is a counter, not a rule: it changes no
number in this rulebook.

## 8. Winning a level

The boss falls when its life cards run out. Then, in this order:

1. Return **all** your Broken cards to Ready. You start the next level whole.
2. Take **1** white Extra Life card. It is Ready.
3. **After level 1 only:** choose a class: Knight, Mage, Hunter or Necromancer.
4. Shuffle the next tier of Skill cards into the skill pool. Reveal **3**, keep **1**,
   return the rest to the pool.
5. Draw **1** Advantage card.

If you reveal a Skill card marked with a class that is not yours, discard it and reveal
a replacement.

### Classes

| Class | Passive |
|---|---|
| **Knight** | Once per round, guard 25 damage without discarding a card. |
| **Mage** | Your Focus deals +25. |
| **Hunter** | Once per round, reroll one failed check. |
| **Necromancer** | When a minion falls, take one of its life cards as a Ready life card of your own. |

## 8b. Second Wind, the gentle game

An optional card. Put it in play for a softer run, or leave it in the box.

When you would go **Down**, you may come back instead:

| Comeback | Roll |
|---|---|
| 1st this level | free, no roll |
| 2nd | ● Sure |
| 3rd | ●● Even |
| 4th | ●●● Hard |
| 5th and after | ●●●● Wild |

Come back with **2** of your Broken cards returned to Ready. Fail the roll and the
level ends exactly as it would without the card. The count resets every level.

It exists so a ten-year-old does not lose fifteen minutes of play to one bad
round. Measured over 4,000 fights per level, it lifts a careful player about 1 to
4 points per level and a whole five-level run from 6.4% to 8.3%; it helps a
reckless player most, which is the point of a safety net.

## 9. The campaign

Five levels. These numbers come out of `tools/sim.py`; see
[docs/BALANCE.md](docs/BALANCE.md) for what was measured and what is still a guess.

| Level | Boss size | Life cards × value | Total | Damage | Rage |
|---|---|---|---|---|---|
| 1 | M | 8 × 50 | 400 | 50 | 4 |
| 2 | L | 7 × 100 | 700 | 50 | 4 |
| 3 | L | 10 × 100 | 1000 | 75 | 4 |
| 4 | XL | 8 × 150 | 1200 | 100 | 4 |
| 5 | UM | 10 × 200 | 2000 | 100 | 5 |

You win the run by clearing level 5.

## 10. Components

94 cards, poker size **63 × 88 mm**, on 300gsm card stock. Home printers: 9 per A4 sheet,
so 11 sheets, the last one part empty. It was exactly 10 sheets until the first
playtest on 2026-08-27 asked for two more cards, Bubble and Second Wind; the
round number lost to cards a real player wanted. The same playtest asked for two more
player aids, the boss's reaction table and the Damage Track, and 11 sheets absorbed both.
Every card is distinguished by **both** colour and a shape or sigil, so
the deck stays readable without colour vision.

**Backs.** A life card's back is its own element colour, snapped across the
middle: a Broken card sits face down, so the card itself reads as broken rather
than carrying a picture of something broken. Every other card gets the unbroken
pool back, because a skill waiting in the draft pile is not damaged. Printing
backs is optional (none, four, or one per card) and they are solid colour, which
is a real amount of ink on a home printer.

| Deck | Cards |
|---|---|
| Element life: 4 elements × 4 | 16 |
| Extra life: white | 5 |
| Boss life: 2 sets × 5 | 10 |
| Attack: Strike, Focus, All In, Bubble | 4 |
| Class | 4 |
| Skill: 5 base + 4 tiers × 5 | 25 |
| Advantage: 6 kinds × 2 | 12 |
| Boss: S, M, L, L, XL, UM | 6 |
| Biome | 7 |
| Player aid: checks, turn order, boss reactions, damage track | 4 |
| **Total** | **94** |

The two L cards are not a duplicate: levels 2 and 3 are both size L with different life
and Damage, and the S card exists only as a summon. `tools/lint_cards.py` counts the deck
from `data/cards.json`, so this table is checkable rather than remembered.

Dice and figures are yours. The game ships no dice and no miniatures, which is deliberate:
it is a print-and-play, and every component it does not include is a component you do not
pay for.

---

## Quick reference

- 3 actions. Bet Ready cards. They come back next turn.
- Guard with Ready → Spent (free). Guard with Spent → Broken (gone).
- Keep enough Ready to guard the boss's Damage, or pay for it.
- Rage doubles the boss and ignores your guard. Kill it before then.
- Every value in this game is a multiple of 25.
