// ── Print sheet (contract C7) ────────────────────────────────
// Fills #printSheet with one .print-cell per physical card (copies expanded),
// 9 per A4 page; print.css does the paging. Nothing here is visible on
// screen. The caller decides which cards and whether to add backs.

import { cardFace, cardBack } from './face.js';

/**
 * @param {object[]} physical  cards with copies already expanded (data/cards.js)
 * @param {{backs?: boolean, aid?: object, paper?: 'a4'|'letter'}} opts
 * @returns {number} pages filled
 */
export function renderPrintSheet(physical, opts = {}) {
  const host = document.getElementById('printSheet');
  if (!host) return 0;
  // A selector-scoped @page (html.sk-letter @page {...}) is invalid CSS and was
  // silently dropped, so the Letter toggle printed A4. The size is set here: a
  // later @page overrides print.css's A4 base. Letter portrait is 279.4mm tall;
  // 3 rows of 88mm + two 2mm gutters need 268mm, so Letter gets 5mm margins.
  let pageStyle = document.getElementById('pageSizeStyle');
  if (!pageStyle) { pageStyle = document.createElement('style'); pageStyle.id = 'pageSizeStyle'; document.head.appendChild(pageStyle); }
  pageStyle.textContent = opts.paper === 'letter' ? '@page { size: Letter portrait; margin: 5mm; }' : '';
  const cells = physical.map((c) => `<div class="print-cell">${cardFace(c, { size: 'sheet', aid: opts.aid })}</div>`);
  if (opts.backs) {
    // One page of nine backs: enough to sleeve a hand, not a full mirror run.
    for (let i = 0; i < 9; i++) cells.push(`<div class="print-cell">${cardBack()}</div>`);
  }
  host.innerHTML = cells.join('');
  return Math.ceil(cells.length / 9);
}

export function clearPrintSheet() {
  const host = document.getElementById('printSheet');
  if (host) host.innerHTML = '';
}
