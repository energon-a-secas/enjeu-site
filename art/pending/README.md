# art/pending

A downloaded icon that has been formatted for a card face but cannot be served
yet. `art/` is scanned by `tests/cards.test.mjs`: a `.svg` sitting there with no
slot in `data/art-manifest.json` fails the suite, because an undeclared file is
art nobody credited and `artSrc()` would never serve it anyway.

So the normalized copy waits here, and the untouched download waits in
`art/original/`.

## Promoting one

Two things are needed, and neither can be guessed:

1. Its **source URL, creator and licence**. Inventing them is the exact legal
   exposure the manifest exists to prevent.
2. A **slot id**, which is also the glyph it replaces (`js/cards/glyphs.js`), and
   the filename: `art/<slot-id>.svg`.

Then add the slot to `data/art-manifest.json`, move the file to `art/<slot-id>.svg`,
and run `python3 tools/credits.py` plus `node tests/cards.test.mjs`.

## Waiting

| File | Formatted | Needs |
|---|---|---|
| `hide.svg` | `viewBox="0 0 100 100"`, attribution band cropped, content centred (49.99, 50.0), Illustrator `switch`/`foreignObject` wrapper removed | attribution, and a decision on the slot id: the Hide rule is drawn today by the `eye` glyph, whose slot is already filled by a different credited download |
