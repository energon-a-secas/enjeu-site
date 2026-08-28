# Art

Enjeu's card art comes from **The Noun Project**. That was a deliberate choice; this file
records what it costs and how to stay on the right side of it.

## The licensing shape

Noun Project icons are offered two ways: free under **CC BY**, where attribution is a
condition of use rather than a courtesy, or under a **paid royalty-free licence** with no
attribution requirement. Terms differ per icon and per download, so the manifest records
creator and licence **per slot**, filled in from each icon's own page at download time.

For a game meant to be printed and shared, the CC BY route has three consequences worth
being deliberate about:

1. **Every distributed copy carries the credits page.** Printable pack, PDF, repo. The
   attribution travels with the art.
2. **Forks inherit the obligation.** Someone who remixes Enjeu takes on the same
   attribution duty, and they will only know that if the repo tells them plainly.
3. **The art cannot be MIT or CC0**, so this repo licenses in two halves, see below.

None of that blocks anything. It just has to be done properly, which is what
`tools/credits.py` enforces.

## The workflow

```bash
python3 tools/credits.py --check     # what is still missing
python3 tools/credits.py             # writes CREDITS.md, or refuses
python3 tools/credits.py --selftest  # prove the refusal still fires
```

1. Download an icon from its page in `data/art-manifest.json`.
2. Save the SVG to `art/<slot-id>.svg`.
3. Fill that slot's `creator` and `licence` from the page you downloaded it from.
4. Re-run `tools/credits.py`.

The script **refuses to write CREDITS.md** while any slot that has art is missing its
creator or licence, and refuses to write an empty one. That refusal is the guard: a
printable pack shipping with a half-filled attribution page is the one failure mode here
with a legal edge on it. `--selftest` trips all four refusal paths on purpose, because a
guard nobody has watched fail is not a guard.

Current state: **56 complete and credited across 21 creators, 5 slots deliberately in-house** (the boss sizes). Regenerate this count with `python3 tools/credits.py`; do not retype it.

## Three things wrong with the supplied list

Found while building the manifest.

**One malformed URL.** The rune stone and treasure chest lines were spliced together:

```
https://thenounproject.com/icon/item-rune-stone-23
https://thenounproject.com/icon/item-treasure-chest-2360145/60138/
```

The `60138/` tail belongs to the rune stone. Reconstructed as `item-rune-stone-2360138`,
flagged in the manifest: **verify that id before downloading**, it is a guess from the
fragments.

**Three duplicates.** `skill-magic-earthquake-2360193` appears under both Special 50 and
Special 100; `classes-necromancer-2360015` and `classes-hunter-2360018` appear under both
Classes and Special 100. 42 unique icons from 45 lines.

**Nine slots have no art.** All In, Meteor, the five boss sizes, the life marker and the
boss-life marker. Meteor is the notable one. It is the signature tier-4 card, the thing
the whole "stay grounded until level 5" arc builds toward, and nothing in the list depicts
one.

## Repo licensing

Two halves, because they cannot be one:

| What | Licence |
|---|---|
| Rules, card data, tools, and all text | MIT |
| Card art in `art/` | per `CREDITS.md`: CC BY unless a slot says otherwise |

Say this in the README too. Someone forking the repo needs to hit it before they
redistribute, not after.

## The alternative, recorded not argued

[`boardwright-site/js/icons.js`](../../boardwright-site/js/icons.js) holds 33 original
glyphs, drawn in-house on a 24×24 stroked grid specifically so exports carry no
attribution burden. Cross-referenced against this manifest it covers roughly 28 of the 42
slots outright: all four elements, both hats, the item set, the magic set, the weapon set,
wolf, plus, dice, heart, crown.

It was considered and not taken. It is written down here so that if the attribution
workload turns out to be tedious at 42 icons, the fallback is a known quantity rather
than a rediscovery.
