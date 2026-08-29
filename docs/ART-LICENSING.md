# Noun Project icons in Enjeu: licence review

**Scope:** whether Enjeu's use of ~69 Noun Project icons complies with the licence they were
obtained under, and whether the Noun Project API credentials should be used for future icons.
**Date of review:** 2026-08-29. Noun Project Terms of Use effective date at time of reading:
February 28, 2023.
**Status:** research finding. Compiled from primary sources by a research agent and reviewed;
every claim is traced to a source in the table at the end. Where something could not be
verified it says so, in its own section.

## Summary

- Enjeu's overall approach is sound: CC BY 3.0 permits cropping, recolouring and
  redistribution, and Noun Project's own guidance explicitly allows the credit to live in an
  "About" or "Credits" section rather than beside each icon.
- Three small gaps exist, all in the distributed files rather than on the site: the shipped
  SVGs carry no licence URI, no creator, and no statement that they were modified.
- CC BY 3.0 requires a licence URI with every copy you distribute and requires adaptations to
  be marked as changed. A public repo of stripped SVGs met neither until the fixes below.
- The fix is mechanical: inject a metadata header into each SVG from the existing manifest,
  add the licence URI and the icon title, and add one "what we changed" line.
- **Do not fetch shippable icons through the API.** Its terms forbid caching vector files and
  distributing icons, which is precisely what this project does; the manual CC BY route
  grants those rights and the API route withdraws them. Use the API as a catalogue (search,
  metadata for the manifest), never as a supply line.

## What we do today

- 69 SVGs in `art/`, one per manifest slot id, downloaded manually from thenounproject.com
  while logged in to a free account, via the "Continue With Attribution" flow.
- `data/art-manifest.json` records per icon: `id`, `use`, `source` (the icon's URL),
  `creator`, `licence`.
- `tools/credits.py` generates `CREDITS.md` from the manifest and refuses to write while any
  used slot lacks a creator or licence.
- `js/views/about.js` builds the same table in the browser from the manifest, so the About
  page cannot drift from the cards. Credits render in English and Spanish.
- The SVGs were modified: the baked-in "Created by X from the Noun Project" text element was
  removed (the credit lives on the About page and in CREDITS.md instead), the viewBox was
  cropped, and colour is applied at render time via CSS `currentColor`.
- Repo licence is MIT, covering the code and rules, not the art. The site footer says so.

## The manual free download terms

**Which licence, and which version.** The Terms of Use, section 3(A), list exactly three icon
licences: Public Domain, "Creative Commons Attribution License (CC BY 3.0)", and a paid
Royalty-Free License. The CC BY link in the terms resolves to **Attribution 3.0 Unported**.
No occurrence of "3.0 US" was found on any Noun Project page read for this review, so
recording "CC BY 3.0" is correct; the missing piece was the URI, not the version.

**What CC BY 3.0 Unported actually requires** (from the legal code):

- Section 3(b) grants the right to create adaptations provided the adaptation "takes
  reasonable steps to clearly label, demarcate or otherwise identify that changes were made
  to the original Work". The licence's own example: "The original work has been modified."
- Section 4(a): "You must include a copy of, or the Uniform Resource Identifier (URI) for,
  this License with every copy of the Work You Distribute or Publicly Perform."
- Section 4(b): keep copyright notices intact and provide, reasonable to the medium, the
  original author's name, the title of the work if supplied, the URI the licensor specifies,
  and for an adaptation a credit identifying the use. Placement: "may be implemented in any
  reasonable manner."

**Where Noun Project says the credit may go.** Their medium-specific guidance favours this
project directly: for applications and for internet use, the credit may live "in the 'About'
or 'Credits' section". For print: on the same page as the icon, in a Credits section, or at
the end. When crediting many icons, linking to an external credits page is acceptable, with
the hyperlink placed on the icon name.

**On the baked-in text.** Noun Project describes it as a convenience, not a mandatory element
of the file: free downloads "include a line of text with the creator credit containing the
hyperlink. You can copy/paste this text into projects."

**Modification is expressly allowed.** From their help centre: "Yes, you can modify and build
upon the symbol as long as you follow proper attribution requirements."

**Two clauses to stay clear of.** Terms section 2 forbids scraping and "large scale copying
of Content", explicitly including public domain content. Sixty-nine hand-picked downloads
are neither; scripting the web download flow would be.

**If Enjeu ever becomes a printed product for sale.** Section 3(A) treats items for resale
separately: a paid licence, or full attribution in legible font on the item, and a purchased
licence covers up to 1,000 units. Not triggered by a free print-and-play PDF; this is the
clause that would bite first if that changed.

## The API terms (free trial)

There is no separate standalone API contract; the API is governed by the Terms of Use plus
an "Unacceptable Uses" list and help-centre articles. Free trial: 30 days or $5 in value, no
card required, 150 icon calls per month (an "icon call" is any request that includes an icon
ID). SVG retrieval is available on the trial.

**The blocking issue: caching and distribution.** The "Prohibited Use Cases for Noun Project
API" article (updated 2026-03-18) lists, verbatim:

> - Caching vector files - caching of vector icon files (SVG, EPS, etc) is not permitted and
>   is against our terms.
> - Distributing icons - this also includes but is not limited to any tools that allow users
>   to export icon files without any modifications (e.g. text added, etc.).

The API docs repeat the distribution point more bluntly: "Distributing icons, including for
free." Storing SVGs in a public repo and shipping them in a print-and-play game is exactly
caching plus distribution, so icons must not be sourced through the API.

**Which licence API icons carry.** The API's documented responses label every icon
`"license_description": "creative-commons-attribution"` and hand back a prebuilt attribution
string. The Terms grant royalty-free rights only through purchase; a free trial has
purchased nothing.

## Modification and attribution analysis

**(a) Removing the baked-in credit, crediting on the About page instead.**
Rendering icons on cards and the site: permitted, squarely within Noun Project's own
guidance. Redistributing the SVG files in a public repo: this is where the practice was
thin. CC BY 3.0 4(a) requires the licence URI with every distributed copy, and 4(b) requires
copyright notices kept intact; a stripped SVG in `art/` carried neither, and the About page
does not travel with the file when someone lifts a single SVG out of the repo. Fixed by the
injected metadata headers (below). Practitioner precedent for this exact workflow exists
(the NounCleaner tool strips the text and compiles a separate attribution file).

**(b) Cropping the viewBox.** Permitted as an adaptation; the condition is section 3(b)'s
mark-your-changes duty, which the injected header now satisfies.

**(c) Recolouring.** Permitted on the same basis. `currentColor` recolouring happens at
render time and does not alter the stored file, so the file-level modifications that need
marking are the crop and the removed text, not the colour.

**(d) API versus manual, for this project.**

| | Manual free download (CC BY 3.0) | API free trial |
|---|---|---|
| Who grants the rights | The icon's creator, via a public licence | Noun Project, via a contract |
| Store SVGs permanently in the repo | Granted | Prohibited (caching vector files) |
| Ship the icons in a print-and-play game | Granted, with attribution | Prohibited (distributing icons) |
| Duration | Perpetual, for the copyright's duration | 30 days, or $5 of value |
| Survives if you stop paying | Yes | No |

**A sensible use for the API credentials.** Searching and browsing for candidate icons is a
service call, not a distribution, and the response's `attribution` field is a clean source
for the manifest's `creator` value. The file that ships still comes from the normal CC BY
download. Catalogue, not supply line.

## Compliance gaps and fixes

1. **Distributed SVGs carried no licence URI, creator, or source** (CC BY 3.0 4(a)/4(b)).
   Fixed: `tools/credits.py` injects a generated metadata comment into each credited SVG
   from the manifest (creator, source URL, licence + URI, what was modified). Generated, so
   it cannot drift.
2. **Nothing stated that the icons were modified** (3(b)). Fixed: the injected header names
   the changes, and CREDITS.md plus the About page carry one sentence saying credit was
   relocated, the viewBox cropped, and colour applied at render time.
3. **The licence was a bare string.** Fixed: CREDITS.md and the About table link the licence
   to https://creativecommons.org/licenses/by/3.0/.
4. **The visible credit label is the slot id, not the icon's title.** Open: adding a `title`
   field per manifest slot (extractable from each file's `<title>` element) would satisfy
   4(b)(ii) fully. Low risk, worth doing on the next art pass.
5. **Printable PDFs, when they ship, need a credits page** per the Print rule. Plan it in,
   rather than retrofitting.
6. **Never route shippable icons through the API.** If the credentials are ever used in a
   script that writes into `art/`, that script is the thing to review.

**Public domain icons, if any are encountered:** no attribution is legally required and
commercial use is fine, but record them honestly (`"licence": "Public Domain"`, URI
https://creativecommons.org/publicdomain/mark/1.0/), keep naming the creator anyway, and
remember the bulk-copying prohibition still applies.

## Could not determine

- What licence version the download dialog displayed when these icons were pulled; the Terms
  link to Unported today, which is the best available evidence. [unverified]
- Whether the free-trial API grant is royalty-free: the marketing page says all icons are,
  the Terms grant royalty-free rights only through purchase, and no clause resolves the
  conflict. [unverified]
- Whether Noun Project objects to a public repo of stripped CC BY SVGs. Under CC BY the
  creator has granted redistribution; no Noun Project statement addresses the
  manual-download case. This open question is why gap 1 was worth closing. [unverified]
- Two contradictions recorded rather than resolved in our favour: the help centre asserts a
  caching prohibition "against our terms" that the Terms document itself never states, and
  the developers page markets API icons as royalty-free while the API's own responses label
  them attribution-licensed.

## Sources

| URL | What it supports |
|---|---|
| https://thenounproject.com/legal/terms-of-use/ | The three icon licences, CC BY 3.0 link, resale rules, anti-scraping and large-scale-copying clauses, API governed by these Terms |
| https://creativecommons.org/licenses/by/3.0/legalcode | Attribution 3.0 Unported: 3(b) mark changes, 4(a) licence URI with every copy, 4(b) notices, author, title, URI, "any reasonable manner" |
| https://help.thenounproject.com/hc/en-us/articles/200509948 | Medium-specific credit rules: About or Credits section for applications and internet; print rules |
| https://help.thenounproject.com/hc/en-us/articles/200509928 | Credit format; the baked-in line is a copy-paste convenience |
| https://help.thenounproject.com/hc/en-us/articles/200744853 | External credits page acceptable; hyperlink on the icon name |
| https://help.thenounproject.com/hc/en-us/articles/115006103188 | "Yes, you can modify and build upon the symbol" |
| https://help.thenounproject.com/hc/en-us/articles/200509798 | The three licence types; public domain carries no restrictions |
| https://help.thenounproject.com/hc/en-us/articles/47964341999131 | Prohibited API uses: caching vector files, distributing icons |
| https://api.thenounproject.com/getting_started.html | "Distributing icons, including for free"; usage limits |
| https://api.thenounproject.com/documentation.html | API responses: `license_description: creative-commons-attribution`, prebuilt attribution string |
| https://thenounproject.com/developers/ | Trial pricing table: 150 icon calls/month, $5 cap, 30 days; the royalty-free marketing claim |
| https://help.thenounproject.com/hc/en-us/articles/46640116758427 | SVGs available on Free Trial and Pro |
| https://github.com/teamcoltra/NounCleaner | Practitioner precedent for stripping embedded credits into a compiled attribution file |
| https://creativecommons.org/publicdomain/mark/1.0/ | The PD Mark the Terms point to |

Note on method: help.thenounproject.com returns HTTP 403 to plain page fetches; those
articles were read through Zendesk's public JSON API on the same host, which serves the same
content. The human URLs are cited above.
