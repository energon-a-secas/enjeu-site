# DESIGN.md: Enjeu

## Theme decision (the scene sentence)

*A child and an adult at a kitchen table in daylight, a boss built from bricks, a printed
deck and one die between them.*

That scene forces **light**. The page is paper, because the product is paper: what a card
looks like on screen must be what the printer produces. A white card on the fleet's dark
default would preview nothing. Recorded as the `print-and-play-light` dialect in
`docs/design/dialects.md` (PROPOSED), the same scene pieza signed, with its own palette.

## Colour: six flat faces and gold

The cards fix the palette and the page follows it. Every value is a plain hex because the
faces are SVG presentation attributes that have to print exactly.

```
--fire  #dc2626   --water #2563eb   --earth #16a34a   --wind #64748b
--extra #ffffff   --boss  #111111   --gold  #eab308 (the bet; the hub accent)
```

Paper surfaces: `--bg #f6f3eb`, `--surface-1 #fffdf8`, `--surface-2 #f0ebde`. Ink is warm
near-black (`#1c1917`), never `#000` on the page; the cards use `#111` on purpose because
that is what prints. Gold is a **fill** with dark text (9:1) and never small text on paper;
links and gold text use `--gold-deep #a16207` (5.6:1 on `--surface-1`).

Colour is never the only signal: every card face carries a sigil as well as a colour, and
every state (Ready, Spent, Broken) is a posture as well as an opacity.

## The motif: the bet

Pips (round dots), chips, a card turned sideways. Panels and buttons carry a **hard 3px
bottom edge** (`--table-edge`), a card lying on the table, no blur and no glass. Life cards
in the runner turn 90 degrees when Spent and flip when Broken, the physical gesture the
rules describe. Nothing is studded or brick-shaped on the page; the bricks are the user's.

## Typography

System stack, heavy weights for the numbers that matter: card numerals are 900 weight at
300 units on a 630-unit face, tabular figures everywhere numbers line up (ladder, balance
grid, hit points). Headings 800 to 900, body 1rem at 1.5, measure under 62ch. Kicker labels
are 0.78rem uppercase with 0.12em tracking.

## Motion

Ease-out only (`--ease-out: cubic-bezier(0.22, 1, 0.36, 1)`). Sanctioned moments: a card
turning sideways or flipping (600ms), a die wobble on a roll (500ms), a figure shake on a
hit (400ms), a button pressing into its table edge. `prefers-reduced-motion` collapses all of
it.

## Header

`data-header-mode="content"`, `data-header-skin="custom"`: a dark felt-and-gold bar
(`#2b2416` to `#0b0906`, accent `#facc15`) declared as tokens in `css/style.css` under the
kit's exact selector. The four tabs live inside `.header-actions` with `data-keep-mobile`
and scroll sideways when the bar is narrow.

## Bans honoured

No em dashes. No glassmorphism, no soft ambient shadows, no bounce. No text on a card
face beyond numerals and pips (and size codes on boss cards). No brand named anywhere.
No colour that is not also a shape.
