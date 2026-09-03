# CLAUDE.md: Enjeu

Enjeu: a print-and-play boss-rush card game for one player, one die, and the construction-toy bricks and figures already on the table. The site teaches it (visual walkthrough plus RULES.md rendered in place), prints it (111 cards, 9 per A4, 13 sheets) and runs it (a First Game or five-level run with stand-in figures, and a batch balance table in a Worker). `data/cards.json` is the one card source, shared with the Python tools; `RULES.md` is the one rulebook. Card faces carry numerals, pips and glyphs only: the name never prints, the player says it out loud.

**Live:** https://enjeu.neorgon.com (GitHub Pages, repo `energon-a-secas/enjeu-site`) · **Port:** 8871

## Run

```bash
make serve      # http://localhost:8871 (ES modules, must be served over HTTP)
make test       # node tests: cards, content, dice bridge, engine + BALANCE.md parity
make check      # the Python checkers and their selftests (card linter, credits, dice bridge)
make sim        # tools/sim.py, the published balance table
make cards      # every card as a print-ready PNG, face and back (needs make serve)
```

## Architecture

| Module | Owns |
|---|---|
| `js/app.js` | load `data/cards.json` + `data/art-manifest.json`, route, render, bind (under 50 lines) |
| `js/state.js` | `state` (view, run, die, mode, filters), `localStorage['enjeu-state']` |
| `js/navigate.js` | hash routes `#/learn` `#/cards` `#/play` `#/balance`, `reveal()` |
| `js/render.js` · `js/events.js` | view switch; one delegated `data-action` click handler, modal a11y |
| `js/strings.js` | every UI string (`t('play.start')`): the EN/ES seam, key-parity tested |
| `js/views/logline.js` | the fight log's Spanish: engine lines stay English (sim parity), patterns translate at display time |
| `js/data/cards.js` | fetch + index cards.json (`byId`, `physical` = copies expanded, 111) |
| `js/cards/glyphs.js` | 59 original 24x24 stroked glyphs keyed by art-manifest slot id; `artSrc()` override |
| `js/cards/face.js` | `cardFace(card, opts)`: the four-corner SVG on a 630x880 grid (10 units per mm) |
| `js/cards/sheet.js` | fills `#printSheet`; `css/print.css` pages it 3x3 per A4 |
| `js/game/rules.js` | ladder, mode dial, dice bridge port (`bestTarget`), element cycle, reaction rows, `aidFor` (what a printed reference card draws from) |
| `js/game/engine.js` | one fight, every rule; `legacy` flag reproduces tools/sim.py's simplifications; break points and the DM dial (`DM_DEFAULTS`, `canBreak`, `breakPart`) |
| `js/game/strategies.js` | turtle / safe / adaptive / gamble (sim.py `choose` ported) + Advantage heuristics |
| `js/game/sim.js` · `sim-worker.js` | the 20-cell table, off the main thread |
| `js/game/run.js` | the campaign: First Game or 5 levels, class pick, draft 3 keep 1, Advantage draws |
| `js/game/figures.js` · `js/data/placeholders.js` | brick-built stand-in heroes, bosses, minion (`placeholder: true`) |
| `js/views/*.js` | learn (walkthrough + rulebook + play-now slide), cards (browse, tap, print scopes), play (runner + first-run tour), balance |
| `js/views/inspect.js` | the one card popover: hover on mouse, press-and-hold on touch, fed by `cards.effect` strings |
| `js/cards/png.js` | one card, one PNG for a printing service: flatten onto the card's own field colour, size presets, filenames that pair a face with its back |
| `tools/*.py` | unchanged design-baseline checkers: `sim.py`, `lint_cards.py`, `dice_bridge.py`, `credits.py` |

Vendored from `packages/neorgon-ui/`, never edit in place: `js/neorgon-header.js`, `js/neorgon-footer.js`, `css/neorgon-*.css`.

## Data

- `data/cards.json`: all 111 cards (the Python linter and the JS tests both count them)
- `data/art-manifest.json`: 75 art slots (70 credited, 5 in-house on purpose); a slot renders `art/<id>.svg` only once it has creator AND licence
- `localStorage['enjeu-state']`: filters, die, mode, and the run in progress (no card data: the fight's `data` pointer is non-enumerable)

## Conventions

- Zero build step. Light print-and-play dialect: the page carries its own tokens and does not link the CDN `base.css` (PROPOSED row in `docs/design/dialects.md`).
- No text on a card face beyond numerals and pips (boss cards may carry their size code; the four player aids are reference cards). `tests/cards.test.mjs` fails on anything else.
- Never name a brand: "construction toy", "bricks", "minifigure".
- Rolls come from outside the engine (a human's die or a seeded stream), never from inside it.
- No em dashes anywhere (content test scans js, tests, index.html, README, RULES, docs).

## Gotchas

- **CSS beats SVG presentation attributes.** The first pass declared `fill`/`stroke` on `.face`/`.pip` in `cards.css` and every coloured life card printed white. `cards.css` sizes faces only; all colour lives inline in the SVG, which is also what the printer needs.
- **Browsers cache plain `http.server` assets, and it looks like broken buttons.** A page can run a mix of old and new ES modules after an edit (it bit the build twice, and the user once after the rename). `make serve` now runs `tools/serve.py`, the same server plus `Cache-Control: no-cache`, so a plain reload is always current; in Playwright still clear with CDP `Network.clearBrowserCache` + `setCacheDisabled` when the server was started the old way.
- **`legacy` is parity, not a rules mode to ship.** It reproduces three tools/sim.py simplifications (Brace never halves, Summon moves a flat 100, Roar flattens the next check to Even) so `tests/engine.test.mjs` can check BALANCE.md within 4 points. It also skips break points and the Run penalty, which arrived after sim.py was last a source of truth. The rulebook mode is still the harsher of the two; the gap is a design decision recorded in `.forge/brief-2026-08-15-baseline.md`, not a bug to "fix" in the engine.
- **The rulebook-mode win rates in this file were stale for two weeks, so measure rather than quote.** The line that used to sit here said "turtle 0 everywhere" and turtle was in fact winning 42.8% of level 1. Re-measure with the engine, not from memory: at 4,000 fights per cell, seed 11, after the 2026-08-30 rule changes, adaptive is 88.5/80.2/61.8/59.2/53.5 and turtle 67.7/16.1/0.8/0/0. The turtle row is a known open defect (a strategy that never bets a card should not win two thirds of level 1); it comes from the boss now falling on its body alone, which makes a Summon a discount the player never repays.
- **Break points are off the balance table on purpose.** `canBreak` returns false under `legacy`, and no strategy in `js/game/strategies.js` calls `breakPart`, because a break requires a human to say what part they went for. The dial is a table setting (`state.dm`), so a run carries it and the simulator never sees it.
- **Rulings the rulebook did not make** live in the header comment of `js/game/engine.js`, which now says which of them were promoted into RULES.md on 2026-08-28 and which four are still only in the code. Change the rulebook first, the engine second.
- **`element_cycle` in cards.json carries a `$note` key.** Anything iterating it must skip `$`-prefixed keys (the Learn cycle drawing did not, once).
- **Breaking a part needs a landed attack to hang off.** `f.hero.breakWindow` is set by `attack()` when a hit deals damage, and cleared by the break itself, by `endTurn` and at the top of every round. One attack, one break: without that window the button would be a free action a player could tap all turn, and "I stabbed it in the eye" would stop describing anything that happened.
- **Advantage cards in a fight live in `fight.hero.advantage`**, the deck in `run.advDeck`, and the between-levels hand in `run.hand`. Chest draws from the deck straight into the fight hand.
- **The worker receives cards.json without `byId`/`physical`** (it re-indexes); posting the indexed object would clone every card twice.
- **Print sizes are millimetres on the SVG**, not `zoom` tricks: `.print-cell .sk-card { width: 63mm; height: 88mm }`. Do not add `overflow: hidden` to a cell; an overflow must print visibly wrong.

- **Two guards were added on 2026-08-30 because they had already failed silently.** `tests/content.test.mjs` now scans `RULES.es.md` for em dashes (it never had, and that is half the prose), and its enumerated-label test now checks `play.outcome`, `play.brk`, `play.dm`, `cards.step`, `cards.effect` and the reaction/signature tables against the lists that index them. Key parity alone cannot catch a duplicate key: `play.hist` was declared twice in BOTH languages, the object literal collapsed, parity passed in both directions, and the run summary rendered a raw `[play.hist.win]`.

## Do not touch

- `js/neorgon-*.js` and `css/neorgon-*.css`: vendored kits, regenerated by `packages/neorgon-ui/sync-*.sh`.
- `RULES.md`, `data/cards.json`, `data/art-manifest.json`, `tools/*.py`, `docs/*.md`: the design baseline. A rule the site needs is a rulebook change first.
