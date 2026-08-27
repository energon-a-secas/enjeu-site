// ── Entry point ──────────────────────────────────────────────
// Load the two data files, restore state, route, render, bind. Under 50 lines.

import { state, loadSaved } from './state.js';
import { loadCards } from './data/cards.js';
import { setArtManifest } from './cards/glyphs.js';
import { syncFromHash } from './navigate.js';
import { render, renderError } from './render.js';
import { bindEvents } from './events.js';
import { t } from './strings.js';
import { reattach } from './game/run.js';

async function init() {
  loadSaved(state);
  syncFromHash();
  render(state);           // "loading" until the data lands
  bindEvents();
  try {
    const [cards, manifest] = await Promise.all([
      loadCards('data/cards.json'),
      fetch('data/art-manifest.json').then((r) => (r.ok ? r.json() : null)).catch(() => null),
    ]);
    state.cards = cards;
    setArtManifest(manifest);
    if (state.run) reattach(state.run, cards);
  } catch (err) {
    renderError(t('common.loadFail'));
    console.error(err);
    return;
  }
  render(state);
}

init();
