# Enjeu: The Boss Seat

**An expansion module.** The base game is complete without it. Leave these cards
in the box and nothing else changes.

**What it adds:** the empty chair. Somebody has been rolling the boss's die this
whole time, and this module gives that job to a person.

Needs nothing. It touches only who supplies the boss's number.

---

## 1. The die becomes six cards

Take the six reaction cards out. They are the six sides of the boss's die, in
order, and two of them are Strike because the die has Strike on two faces.

| Face | Card | What it does |
|---|---|---|
| 1 | **Brace** | No damage, and it halves what it takes until the end of your next turn |
| 2 | **Strike** | Its Damage |
| 3 | **Strike** | Its Damage |
| 4 | **Summon** | Two of its life cards move under a new figure |
| 5 | **Roar** | Its Damage, and your next check is one step harder |
| 6 | **Ruin** | Double Damage |

Shuffle all six. The boss player takes a hand, and the rest is a face-down pile.

> **1.** Deal the boss player a hand. **How many is the whole difficulty dial**,
> and it is the same dial the rest of the game uses: **Friendly 1, Assisted 2,
> Hardcore 3.**
>
> **2.** At the start of every round, before the hero does anything, the boss
> player puts one card from their hand **face down** in front of the boss.
> Unless a card is already lying there.
>
> **3.** When the boss acts, turn it over. That is what it does. Resolve it
> exactly as the rulebook already says.
>
> **4.** Then it lies face up in the **Row**, and the boss player draws back up
> to their hand if the pile still has cards.
>
> **5.** **When the Row reaches three, sweep it.** Shuffle all six back
> together and deal a new hand. Also sweep if the boss player's hand ever runs
> out first.

---

## 2. Why a hand of one is the gentle setting

With one card, the boss player has no choice at all: they hold what they were
dealt and they play it. That is the point. An adult who wants to be gentle
should not have to pretend to be, and pretending is what a child notices.

With two, there is a decision every round. With three, there is a plan.

**The hand size is the handicap.** Nothing else about the boss changes: its
Damage, its Rage round and its signature move are what the rulebook says.

---

## 3. The two things that stop it being cruel

**Ruin may not be the first card of a fight.** Meeting double damage before you
have taken a single turn teaches a child nothing except that the game is unfair.
After round one it is available like anything else.

**From the Rage round on, the card goes down face up.** Rage is when the fight
is decided, and a child who can see the worst coming can still do something
about it. This costs the boss player their bluff at exactly the moment the bluff
would matter most, which is deliberate.

---

## 4. What this module does not claim

It would be easy to write "the boss player can never hit harder than the die,
they can only choose when". It is not true, and it was measured before it was
cut.

It is true across a completed cycle of six cards. Fights in this game last
between three and five rounds, so the cycle almost never completes: the boss
plays its best three cards and you never meet the rest. Sweeping every three
instead of every six is what makes the promise bite inside a real fight, and it
is why rule 5 says three.

Even so: **a second player choosing well is harder than a die, and that is what
you came for.** If you want the die's odds, roll the die. If you want somebody
across the table deciding when the hammer falls, take the seat, and set the hand
size to say how hard you want them to be able to think.

---

## 5. What it measures

Because "an adult across the table" is not a number, these were measured with a
bot playing the seat, 2,500 fights a cell, against the same fight run with a die
(`node tools/checks/seat.mjs`).

**Hand 1 is the die, near enough.** Every cell lands within about three points.
The one consistent gap is that level 1 is a couple of points kinder, which is
the "Ruin never opens a fight" rule doing exactly what it was put there to do.

**Hands 2 and 3 are harder, and steeply.** A boss player who always spends their
biggest card takes a careful hero from 88% to 77% at level 1, and from 28% to
17% at level 3. Against a player who never bets a life card it is brutal: 49%
down to 24% at hand 2, and to 5% at hand 3.

**And the patient play is the weaker one.** Holding Ruin back for the Rage round
measured six to twelve points EASIER for the hero than simply spending the
biggest card each turn, because most fights end before Rage arrives and the boss
spent them playing its small cards.

That is worth knowing rather than hiding, because it hands you a second dial. If
you want to go gentle without visibly going gentle, **hold the hammer.** It
tells a better story and it costs you the fight, and the child cannot see you
doing it.

---

## 6. Two players without the seat

If you want a second player and not an opponent, you do not need this module.
The base game already has the **Sidekick** card: one shared life pool, and the
second player owns Strike and Invention. See
[RULES.md section 8b](RULES.md).

That used to say Strike and Run, which handed the second player two cards with
no check and then told them to roll. It says Invention now, which has a Wild
check and a bet, so they throw real dice and say a made-up spell out loud.

---

## 7. Components

| Deck | Cards |
|---|---|
| Reaction: the six faces | 6 |
| The Seat (a player aid) | 1 |
| **Total** | **7** |

One A4 sheet.

---

## Quick reference

- Six cards are the six faces. Two of them are Strike.
- Hand of 1, 2 or 3. That is the whole difficulty dial.
- Commit face down before the hero acts. Turn it over when the boss acts.
- Sweep the Row after three, or when the hand runs out.
- Ruin never opens a fight. From Rage on, commit face up.
