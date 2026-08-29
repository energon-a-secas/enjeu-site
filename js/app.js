// ── Entry point ──────────────────────────────────────────────
// Load the two data files, restore state, route, render, bind. Under 50 lines.

import { state, loadSaved } from './state.js';
import { loadCards } from './data/cards.js';
import { setArtManifest, loadArt } from './cards/glyphs.js';
import { syncFromHash } from './navigate.js';
import { render, renderError } from './render.js';
import { bindEvents } from './events.js';
import { initInspector } from './views/inspect.js';
import { t } from './strings.js';
import { reattach } from './game/run.js';

async function init() {
  loadSaved(state);
  syncFromHash();
  render(state);           // "loading" until the data lands
  bindEvents();
  initInspector();
  try {
    const [cards, manifest] = await Promise.all([
      loadCards('data/cards.json'),
      fetch('data/art-manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    state.cards = cards;
    setArtManifest(manifest);
    // Inlined, not linked: an <image> cannot be recoloured on paper. See the
    // note above loadArt in cards/glyphs.js. Failure is survivable, the cards
    // fall back to the in-house glyphs, so this does not join the try above.
    await loadArt().catch((err) => console.warn('art did not load', err));
    if (state.run) reattach(state.run, cards);
  } catch (err) {
    renderError(t('common.loadFail'));
    console.error(err);
    return;
  }
  render(state);
}

init();
