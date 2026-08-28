// ── About view ───────────────────────────────────────────────
// Two halves. Where the game came from, in the owner's words, and who drew
// the pictures on the cards.
//
// The credits half is BUILT FROM data/art-manifest.json at load time, never
// typed out here: CREDITS.md is generated from that same file by
// tools/credits.py, and a hand-kept second copy of an attribution list is a
// copy that goes stale on the next download. A slot counts as credited on the
// same rule js/cards/glyphs.js uses to serve art/<id>.svg (source AND creator
// AND licence), so this page names exactly the icons the cards actually print.

import { t } from '../strings.js';
import { escHtml } from '../utils.js';

let manifest = null, loading = false, failed = false;

/**
 * Fetch the manifest once, then repaint through the event events.js listens
 * for. Guarded the way learn.js guards its RULES.md fetch: the view has to be
 * renderable to a string under node, where there is no document to repaint and
 * no base URL to fetch against, and an unguarded fetch would reject inside
 * .finally() and take the process with it.
 */
function ensureManifest() {
  if (typeof document === 'undefined' || typeof fetch !== 'function') return;
  if (manifest || loading) return;
  loading = true;
  fetch('data/art-manifest.json')
    .then((r) => (r.ok ? r.json() : Promise.reject(r.status)))
    .then((json) => { manifest = json; failed = false; })
    .catch(() => { failed = true; })
    .finally(() => { loading = false; document.dispatchEvent(new CustomEvent('enjeu:rerender')); });
}

/** The credited slots, alphabetical, the same order and rule as CREDITS.md. */
function credited() {
  return (manifest?.slots || [])
    .filter((s) => s.source && s.creator && s.licence)
    .sort((a, b) => a.id.localeCompare(b.id));
}

/** The slots the cards still draw in house: no art, so the glyph stands. */
function inHouse() {
  return (manifest?.slots || []).filter((s) => !(s.source && s.creator && s.licence));
}

function stat(n, label) {
  return `<div class="about-stat"><b>${n}</b><span>${escHtml(label)}</span></div>`;
}

function creditsTable() {
  const rows = credited();
  if (!rows.length) return '';
  return `<div class="table-wrap"><table class="about-credits">
    <thead><tr>
      <th>${escHtml(t('about.cols.icon'))}</th>
      <th>${escHtml(t('about.cols.use'))}</th>
      <th>${escHtml(t('about.cols.creator'))}</th>
      <th>${escHtml(t('about.cols.licence'))}</th>
    </tr></thead>
    <tbody>${rows.map((s) => `<tr>
      <td><a href="${escHtml(s.source)}" target="_blank" rel="noopener noreferrer"><code>${escHtml(s.id)}</code></a></td>
      <td>${escHtml(s.use)}</td>
      <td>${escHtml(s.creator)}</td>
      <td>${escHtml(s.licence)}</td>
    </tr>`).join('')}</tbody>
  </table></div>`;
}

function artPanel() {
  if (failed) return `<p class="small muted">${escHtml(t('about.artFail'))}</p>`;
  if (!manifest) return `<p class="small muted">${escHtml(t('about.artLoading'))}</p>`;
  const rows = credited();
  const creators = new Set(rows.map((s) => s.creator));
  return `<div class="about-stats">
      ${stat(rows.length, t('about.statCredited'))}
      ${stat(creators.size, t('about.statCreators'))}
      ${stat(inHouse().length, t('about.statInHouse'))}
    </div>
    <p class="panel__lead">${escHtml(t('about.artInHouse'))}</p>
    ${creditsTable()}
    <p class="small muted">${escHtml(t('about.creditsNote'))}</p>`;
}

function licenceTable() {
  const rows = [
    [t('about.licence.codeWhat'), t('about.licence.codeIs')],
    [t('about.licence.artWhat'), t('about.licence.artIs')],
    [t('about.licence.glyphsWhat'), t('about.licence.glyphsIs')],
  ];
  return `<div class="table-wrap"><table class="about-licence">
    <thead><tr><th>${escHtml(t('about.cols.what'))}</th><th>${escHtml(t('about.cols.licence'))}</th></tr></thead>
    <tbody>${rows.map(([what, is]) => `<tr><td>${escHtml(what)}</td><td>${escHtml(is)}</td></tr>`).join('')}</tbody>
  </table></div>`;
}

/**
 * @param {object} s the shared state, for the view contract in js/render.js.
 *   This page reads none of it: it is the one view with nothing to remember.
 */
export function renderAbout(s) {
  ensureManifest();
  return `<div class="container stack">
    <header class="stack stack--tight">
      <p class="kicker">${escHtml(t('about.title'))}</p>
      <p class="panel__lead">${escHtml(t('about.lead'))}</p>
    </header>

    <section class="panel stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.originTitle'))}</h2>
      <p>${escHtml(t('about.origin1'))}</p>
      <p>${escHtml(t('about.origin2'))}</p>
      <p>${escHtml(t('about.origin3'))}</p>
    </section>

    <section class="panel stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.secondTitle'))}</h2>
      <p>${escHtml(t('about.second1'))}</p>
      <p>${escHtml(t('about.second2'))}</p>
    </section>

    <section class="panel stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.tableTitle'))}</h2>
      <p>${escHtml(t('about.table1'))}</p>
      <p>${escHtml(t('about.table2'))}</p>
    </section>

    <section class="panel stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.spellsTitle'))}</h2>
      <p>${escHtml(t('about.spells1'))}</p>
      <p>${escHtml(t('about.spells2'))}</p>
      <p>${escHtml(t('about.spells3'))}</p>
    </section>

    <section class="panel stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.artTitle'))}</h2>
      <p>${escHtml(t('about.artLead'))}</p>
      ${artPanel()}
    </section>

    <section class="panel panel--sunk stack stack--tight about-prose">
      <h2 class="panel__title">${escHtml(t('about.licenceTitle'))}</h2>
      <p>${escHtml(t('about.licenceLead'))}</p>
      ${licenceTable()}
      <p class="small muted">${escHtml(t('about.licenceNote'))}</p>
    </section>
  </div>`;
}
