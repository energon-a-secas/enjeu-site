# CLAUDE.md: Enjeu

Enjeu: a print-and-play boss-rush card game for one player, one die, and the construction-toy bricks and figures already on the table. The site teaches it (visual walkthrough plus RULES.md rendered in place), prints it (110 cards, 9 per A4, 13 sheets) and runs it (a First Game or five-level run with stand-in figures, and a batch balance table in a Worker). `data/cards.json` is the one card source, shared with the Python tools; `RULES.md` is the one rulebook. Card faces carry numerals, pips and glyphs only: the name never prints, the player says it out loud.

**Live:** https://enjeu.neorgon.com (GitHub Pages, repo `energon-a-secas/enjeu-site`) · **Port:** 8871

## Run

```bash
make serve      # http://localhost:8871 (ES modules, must be served over HTTP)
make test       # node tests: cards, content, dice bridge, engine + BALANCE.md parity
make check      # the Python checkers and their selftests (card linter, credits, dice bridge)
make sim        # tools/sim.py, the published balance table
```

## Architecture

| Module | Owns |
|---|---|
| `js/app.js` | load `data/cards.json` + `data/art-manifest.json`, route, render, bind (under 50 lines) |
| `js/state.js` | `state` (view, run, die, mode, filters), `localStorage['enjeu-state']` |
| `js/navigate.js` | hash routes `#/learn` `#/cards` `#/play` `#/balance`, `reveal()` |
| `js/render.js` · `js/events.js` | view switch; one delegated `data-action` click handler, modal a11y |
| `js/strings.js` | every UI string (`t('play.start')`): the i18n seam, English only for now |
| `js/data/cards.js` | fetch + index cards.json (`byId`, `physical` = copies expanded, 110) |
| `js/cards/glyphs.js` | 59 original 24x24 stroked glyphs keyed by art-manifest slot id; `artSrc()` override |
| `js/cards/face.js` | `cardFace(card, opts)`: the four-corner SVG on a 630x880 grid (10 units per mm) |
| `js/cards/sheet.js` | fills `#printSheet`; `css/print.css` pages it 3x3 per A4 |
| `js/game/rules.js` | ladder, mode dial, dice bridge port (`bestTarget`), element cycle, reaction rows |
| `js/game/engine.js` | one fight, every rule; `legacy` flag reproduces tools/sim.py's simplifications |
| `js/game/strategies.js` | turtle / safe / adaptive / gamble (sim.py `choose` ported) + Advantage heuristics |
| `js/game/sim.js` · `sim-worker.js` | the 20-cell table, off the main thread |
| `js/game/run.js` | the campaign: First Game or 5 levels, class pick, draft 3 keep 1, Advantage draws |
| `js/game/figures.js` · `js/data/placeholders.js` | brick-built stand-in heroes, bosses, minion (`placeholder: true`) |
| `js/views/*.js` | learn (walkthrough + rulebook), cards (browse, tap, print), play (runner), balance |
| `tools/*.py` | unchanged design-baseline checkers: `sim.py`, `lint_cards.py`, `dice_bridge.py`, `credits.py` |

Vendored from `packages/neorgon-ui/`, never edit in place: `js/neorgon-header.js`, `js/neorgon-footer.js`, `css/neorgon-*.css`.

## Data

- `data/cards.json`: all 110 cards (the Python linter and the JS tests both count them)
- `data/art-manifest.json`: 75 art slots (69 credited, 5 in-house on purpose, 1 pending: taunt); a slot renders `art/<id>.svg` only once it has creator AND licence
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
- **`legacy` is parity, not a rules mode to ship.** It reproduces three tools/sim.py simplifications (Brace never halves, Summon moves a flat 100 and the fight ends on the body alone, Roar flattens the next check to Even) so `tests/engine.test.mjs` can check BALANCE.md within 4 points. The rulebook mode is markedly harsher (adaptive 79.5/71.1/51.2/47.4/46.2 percent by level at 20,000 fights per cell, turtle 0 everywhere); that gap is a design decision recorded in `.forge/brief.md`, not a bug to "fix" in the engine.
- **Rulings the rulebook did not make** live in the header comment of `js/game/engine.js`, which now says which of them were promoted into RULES.md on 2026-08-28 and which four are still only in the code. Change the rulebook first, the engine second.
- **`element_cycle` in cards.json carries a `$note` key.** Anything iterating it must skip `$`-prefixed keys (the Learn cycle drawing did not, once).
- **Advantage cards in a fight live in `fight.hero.advantage`**, the deck in `run.advDeck`, and the between-levels hand in `run.hand`. Chest draws from the deck straight into the fight hand.
- **The worker receives cards.json without `byId`/`physical`** (it re-indexes); posting the indexed object would clone every card twice.
- **Print sizes are millimetres on the SVG**, not `zoom` tricks: `.print-cell .sk-card { width: 63mm; height: 88mm }`. Do not add `overflow: hidden` to a cell; an overflow must print visibly wrong.

## Do not touch

- `js/neorgon-*.js` and `css/neorgon-*.css`: vendored kits, regenerated by `packages/neorgon-ui/sync-*.sh`.
- `RULES.md`, `data/cards.json`, `data/art-manifest.json`, `tools/*.py`, `docs/*.md`: the design baseline. A rule the site needs is a rulebook change first.
