# Card layout

The brief was "simple to see and play as Uno." That means a card carries **no body text
at all** — the picture is the name, and the player says the name out loud. Everything a
player needs mid-turn lives in the four corners, and three of the four are pip counts, so
you read them without reading.

Card size is poker, **63 × 88 mm**. The drafts are already at that proportion.

## The four corners

```
   ┌─────────────────────────┐
   │ ◗ bet          check ◖  │   ●   = 25 life
   │                         │   ●●  = 50 life
   │        ╭───────╮        │   ●●● = 75 life
   │        │       │        │
   │        │ GLYPH │        │   check pips:
   │        │       │        │   (blank) always lands
   │        ╰───────╯        │   ●    Sure  75%
   │                         │   ●●   Even  50%
   │ ◗ tier      damage ◖    │   ●●●  Hard  25%
   └─────────────────────────┘   ●●●● Wild  15%
```

| Corner | Carries | Read it |
|---|---|---|
| **top-left** | **Bet** — life cards you must stake | pips |
| **top-right** | **Check** — which rung of the ladder | pips |
| **bottom-left** | **Tier** — 0–4, when the card enters the game | numeral |
| **bottom-right** | **Damage** | numeral |

Your drafts already put tier and damage in the bottom corners (`0 | 25`, `3 | 50`), which
is why those two stayed where they were. The top corners were empty and now carry the two
things a player actually decides on: what it costs, and how likely it is.

In play you read three things: **pips top-left** (what it costs me), **pips top-right**
(how likely), **numeral bottom-right** (what I get). Tier only matters while building the
decks, which is why it is the one number that sits out of the way.

## Frames and marks

| Signal | Means |
|---|---|
| Oval frame, black on white | Skill / attack card |
| Coloured face, big central numeral | Life card |
| **Doubled** outer frame | Costs **2 actions**. A single frame means 1. |
| Small class glyph beside the tier | Class-locked — only that class may take it |
| Element sigil, top-left | Which element the card belongs to |

Absence is the default everywhere: one action unless the frame is doubled, no class lock
unless a glyph says so, no check unless there are pips. That keeps a Strike card almost
empty, which is correct — it is the simplest thing in the game.

## Life cards

Life cards carry a coloured face, the value **25** centred and large, and the element sigil
in the top-left. Both colour **and** sigil, always — the deck has to stay readable for
colour-blind players, and a red card with no fire glyph fails that.

| Element | Face | Sigil |
|---|---|---|
| Fire | red | flame |
| Water | blue | droplet |
| Earth | green | mountain |
| Wind | grey | swirl |
| Extra (any) | white | none |
| Boss | black | crown |

## The naming rule

Every card gets a name a player would enjoy shouting. Two words maximum, concrete, no
system vocabulary.

Good: **Ice Spear. Earthquake. Soul Strike. Stone Wall. Meteor.**
Bad: Tier 3 Area Attack. Damage Modifier B. Buff Card.

The name never appears on the card. It lives in the rulebook's card list and in the
player's mouth. That is the entire point of an iconographic deck: the table stays clear,
and the story is told out loud instead of read silently.

## The icon test

From the board-game-design reference, and it is not negotiable:

> Show an icon to somebody who has never played. Three seconds. If they cannot **guess**
> the meaning — not work it out, guess — redesign it. If any blind playtester asks about
> an icon, that icon is wrong.

Run this before committing to a single printed sheet. Iconography is the failure mode this
kind of deck dies of, and it is cheap to catch now and expensive to catch after 89 cards
are laid out.
