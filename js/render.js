// ── Master render ────────────────────────────────────────────
import { state } from './state.js';
import { t } from './strings.js';
import { escHtml } from './utils.js';
import { VIEWS } from './navigate.js';
import { DECKS } from './data/cards.js';
import { glyphSvg } from './cards/glyphs.js';
import { renderLearn } from './views/learn.js';
import { renderCards } from './views/cards.js';
import { renderPlay } from './views/play.js';
import { renderBalance } from './views/balance.js';

const NAV_ICON = { learn: 'book', cards: 'dice', play: 'strike', balance: 'trend-up' };

export function renderNav(s) {
  const nav = document.getElementById('skNav');
  if (!nav) return;
  nav.innerHTML = VIEWS.map((v) => `
    <a class="sk-tab" role="tab" href="#/${v}" aria-selected="${s.view === v}" data-view="${v}">
      ${glyphSvg(NAV_ICON[v], '', 16)}<span>${escHtml(t(`nav.${v}`))}</span>
    </a>`).join('');
}

export function render(s) {
  renderNav(s);
  const root = document.getElementById('viewRoot');
  if (!root) return;
  if (!s.cards) {
    root.innerHTML = `<div class="container"><p class="muted">${escHtml(t('common.loading'))}</p></div>`;
    return;
  }
  switch (s.view) {
    case 'cards':
      // #/cards/<deck> (the Learn view links these) selects the deck chip once.
      if (s.param && (s.param === 'all' || DECKS.includes(s.param))) { s.deckFilter = s.param; s.param = null; }
      root.innerHTML = renderCards(s);
      break;
    case 'play': root.innerHTML = renderPlay(s); break;
    case 'balance': root.innerHTML = renderBalance(s); break;
    default: root.innerHTML = renderLearn(s);
  }
  document.title = `${t(`nav.${s.view}`)} | Enjeu`;
  // The active view on the root element, so a view's own stylesheet can claim the
  // viewport (Learn is a slide deck and Play is a board: both are sized to fit and
  // scroll inside their panels, while Cards and Balance are ordinary long pages).
  document.documentElement.dataset.view = s.view;
}

export function renderError(msg) {
  const root = document.getElementById('viewRoot');
  if (root) root.innerHTML = `<div class="container"><div class="panel panel--danger">${escHtml(msg)}</div></div>`;
}
