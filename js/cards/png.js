// ── Card images for a printer ────────────────────────────────
// One card, one PNG, at a size a print-on-demand service will accept.
//
// The screen and the home printer both take the card as it is drawn: a rounded
// rectangle inset 1.5mm inside a 63 x 88mm box, with paper showing around it
// (js/cards/face.js frame()). Send that to a printing service and the inset is
// TRANSPARENT: the corners come out clear, the border comes out clear, and
// whatever the service composites underneath becomes part of your card.
//
// So a printable card is not the card. It is the card on an opaque field of its
// own colour, run all the way to the edge, because the service trims the sheet
// and rounds the corners itself and needs ink out there to trim into. The field
// colour is read from the card's own first <rect> rather than recomputed here,
// so it cannot disagree with what the card actually drew.
//
// Everything above the rasteriser is pure and runs in node, which is what
// tests/png.test.mjs drives. Only toPngBlob needs a browser.

/** SVG user units per millimetre. The card is 630 x 880 units = 63 x 88 mm. */
export const UNITS_PER_MM = 10;
export const CARD_MM = { w: 63, h: 88 };

/**
 * The sizes offered, and why each one exists.
 *
 * `standard` is the default because the service this was built for asks for at
 * least 750 x 1050 px, and a 63 x 88mm card at a true 300 DPI is 744 x 1039:
 * BELOW that floor on both axes, because the service's number assumes a
 * 63.5 x 88.9mm card and ours is 63 x 88. Scaling to clear the floor while
 * keeping the card's real proportions gives 756 x 1056. Nothing is stretched.
 */
export const PRINT_SIZES = {
  standard: { scale: 1.2, bleedMm: 0, dpi: 305 },
  bleed: { scale: 1.2, bleedMm: 3, dpi: 305 },
  high: { scale: 2.4, bleedMm: 0, dpi: 610 },
};

/** The pixel size a preset produces, bleed included. */
export function printSize(preset = 'standard') {
  const p = PRINT_SIZES[preset] || PRINT_SIZES.standard;
  const bleed = p.bleedMm * UNITS_PER_MM;
  return {
    width: Math.round((CARD_MM.w * UNITS_PER_MM + bleed * 2) * p.scale),
    height: Math.round((CARD_MM.h * UNITS_PER_MM + bleed * 2) * p.scale),
    bleedMm: p.bleedMm,
    dpi: p.dpi,
  };
}

/**
 * The card's own field colour, read off the rect it painted. Every face goes
 * through frame() and every back opens with the same shape, so the first rect
 * with a fill IS the field. Reading it back beats recomputing it: a recomputed
 * copy is a second source of truth that drifts the first time a deck changes
 * palette, and this one is measured from the artwork itself.
 */
export function fieldColour(svg, fallback = '#fffdf7') {
  const m = /<rect\b[^>]*\bfill="([^"]+)"/.exec(svg || '');
  return m && m[1] !== 'none' ? m[1] : fallback;
}

/**
 * The card, made printable: opaque, edge to edge, optionally with bleed.
 * `bleedMm` extends the field outward past the trim so a service has ink to cut
 * into; the artwork itself does not grow, which is correct, because the outer
 * 1.5mm of this design is field colour anyway.
 */
export function printableSvg(svg, { bleedMm = 0 } = {}) {
  const vb = /viewBox="([^"]+)"/.exec(svg || '');
  if (!vb) return svg;
  const [minX, minY, w, h] = vb[1].trim().split(/[\s,]+/).map(Number);
  const bleed = bleedMm * UNITS_PER_MM;
  const x = minX - bleed, y = minY - bleed;
  const W = w + bleed * 2, H = h + bleed * 2;
  const inner = svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>[\s\S]*$/, '');
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${x} ${y} ${W} ${H}" width="${W}" height="${H}">`
    + `<rect x="${x}" y="${y}" width="${W}" height="${H}" fill="${fieldColour(svg)}"/>`
    + inner + '</svg>';
}

/** `007-all-in-face-es.png`: sorts in deck order, says which side and which language. */
export function cardFileName(card, index, side = 'face', lang = 'en') {
  const n = String(index + 1).padStart(3, '0');
  const id = String(card?.id || 'card').replace(/[^a-z0-9-]/gi, '-').toLowerCase();
  return `${n}-${id}-${side}-${lang}.png`;
}

/**
 * Rasterise an SVG string to a PNG blob. Browser only.
 *
 * The card is drawn through an Image, which is a sandboxed SVG context: it
 * cannot fetch anything. That is exactly why js/app.js awaits loadArt() before
 * the first render and js/cards/face.js INLINES the attributed art rather than
 * referencing it. If art had stayed an <image href>, every exported card would
 * have come out with a hole where its picture is, and nothing would have said so.
 */
export function toPngBlob(svg, width, height) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml;charset=utf-8' }));
    img.onload = () => {
      try {
        const c = document.createElement('canvas');
        c.width = width; c.height = height;
        const g = c.getContext('2d');
        g.imageSmoothingEnabled = true;
        g.imageSmoothingQuality = 'high';
        g.drawImage(img, 0, 0, width, height);
        c.toBlob((b) => (b ? resolve(b) : reject(new Error('canvas produced no image'))), 'image/png');
      } catch (e) { reject(e); } finally { URL.revokeObjectURL(url); }
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('the card did not rasterise')); };
    img.src = url;
  });
}

/** One card, ready to save. Browser only. */
export async function cardPng(svg, preset = 'standard') {
  const { width, height, bleedMm } = printSize(preset);
  return toPngBlob(printableSvg(svg, { bleedMm }), width, height);
}

/** Hand a blob to the browser as a download. */
export function saveBlob(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  // Revoking immediately cancels the download in some browsers; one frame is enough.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
