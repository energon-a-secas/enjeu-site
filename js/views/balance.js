// ── Balance view ─────────────────────────────────────────────
// The batch simulator in the browser: the same engine the runner uses,
// played thousands of times by the four stand-in styles, in a Worker so the
// page stays alive. Shows the published tools/sim.py table beside the run.

import { state } from '../state.js';
import { t } from '../strings.js';
import { escHtml, showToast } from '../utils.js';
import { STYLES } from '../game/strategies.js';
import { PUBLISHED } from '../data/published.js';

let worker = null;
let rows = [];          // cells so far, in level x style order
let progress = 0;       // 0..20
let running = false;
let lastOpts = null;

const fmt = (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : 'n/a');
const byKey = (rs) => Object.fromEntries(rs.map((r) => [`${r.level}:${r.style}`, r]));

function table(cellsByKey, trials, caption) {
  const best = {};
  for (let L = 1; L <= 5; L++) {
    let b = -1;
    for (const s of STYLES) { const c = cellsByKey[`${L}:${s}`]; if (c && c.win > b) { b = c.win; best[L] = s; } }
  }
  let product = 1, complete = true;
  for (let L = 1; L <= 5; L++) { const c = cellsByKey[`${L}:adaptive`]; if (c) product *= c.win / 100; else complete = false; }
  return `<div class="table-wrap"><table class="bal-grid">
    <caption class="kicker" style="text-align:left;padding-bottom:6px">${escHtml(caption)}</caption>
    <thead><tr><th>${escHtml(t('balance.cols.level'))}</th>${STYLES.map((s) => `<th>${escHtml(t(`balance.style.${s}`))} ${escHtml(t('balance.cols.win'))}</th>`).join('')}<th>adaptive ${escHtml(t('balance.cols.rounds'))}</th><th>adaptive ${escHtml(t('balance.cols.broken'))}</th></tr></thead>
    <tbody>${[1, 2, 3, 4, 5].map((L) => `<tr><td>${L}</td>${STYLES.map((s) => { const c = cellsByKey[`${L}:${s}`]; return `<td class="${best[L] === s ? 'best' : ''}">${c ? fmt(c.win) + '%' : '…'}</td>`; }).join('')}<td>${fmt(cellsByKey[`${L}:adaptive`]?.rounds)}</td><td>${fmt(cellsByKey[`${L}:adaptive`]?.broken)}</td></tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">${trials.toLocaleString()} fights per cell. ${complete ? `Five-level run completion on the adaptive line: <b>${fmt(product * 100)}%</b>.` : ''}</p>`;
}

export function renderBalance(s) {
  const b = s.balance;
  const pub = byKey(PUBLISHED.rows.flatMap((r) => PUBLISHED.styles.map((st, i) => ({ level: r.level, style: st, win: r.win[i], rounds: st === 'adaptive' ? r.rounds : NaN, broken: st === 'adaptive' ? r.broken : NaN }))));
  const mine = byKey(rows);
  return `<div class="container container--wide stack">
    <header class="stack stack--tight">
      <p class="kicker">${escHtml(t('balance.title'))}</p>
      <p class="panel__lead">${escHtml(t('balance.lead'))}</p>
    </header>
    <div class="panel stack stack--tight">
      <div class="row" style="gap: var(--space-6); align-items:flex-end">
        <label class="field"><span>${escHtml(t('balance.trials'))}</span>
          <select data-change="bal-trials">${[500, 1000, 2000, 5000, 10000].map((n) => `<option value="${n}" ${b.trials === n ? 'selected' : ''}>${n.toLocaleString()}</option>`).join('')}</select></label>
        <div class="field"><span>${escHtml(t('balance.bonus'))}</span>
          <span class="seg">${[0, 25, 50].map((n) => `<button data-action="bal-bonus" data-bonus="${n}" aria-pressed="${b.bonus === n}">+${n}</button>`).join('')}</span></div>
        <label class="field"><span>${escHtml(t('balance.klass'))}</span>
          <select data-change="bal-klass">${['none', 'knight', 'mage', 'hunter', 'necromancer'].map((k) => `<option value="${k}" ${b.klass === k ? 'selected' : ''}>${k === 'none' ? escHtml(t('balance.none')) : k}</option>`).join('')}</select></label>
        <button class="chip" data-action="bal-advantage" aria-pressed="${!!b.advantage}" ${b.legacy ? 'disabled' : ''}><span class="dot" style="--chip:#eab308"></span>${escHtml(t('balance.advantage'))}</button>
        <button class="chip" data-action="bal-legacy" aria-pressed="${!!b.legacy}" title="${escHtml(t('balance.legacyHint'))}"><span class="dot" style="--chip:#625c52"></span>${escHtml(t('balance.legacy'))}</button>
      </div>
      <p class="small muted">${escHtml(t('balance.legacyHint'))}</p>
      <div class="row">
        ${running ? `<button class="btn btn--danger" data-action="bal-stop">${escHtml(t('balance.stop'))}</button>` : `<button class="btn btn--primary btn--lg" data-action="bal-run">${escHtml(t('balance.run'))}</button>`}
        <div class="grow progress" aria-label="progress"><i style="width:${(progress / 20) * 100}%"></i></div>
        <span class="small muted">${running ? `${escHtml(t('balance.running'))} ${progress}/20` : rows.length ? `${rows.length}/20 cells` : ''}</span>
      </div>
    </div>
    ${rows.length ? `<div class="panel">${table(mine, lastOpts?.trials || b.trials, `This run: ${lastOpts?.legacy ? 'tools/sim.py legacy rules' : 'rulebook rules'}${lastOpts?.bonus ? `, +${lastOpts.bonus} bonus` : ''}${lastOpts?.klass && lastOpts.klass !== 'none' ? `, ${lastOpts.klass}` : ''}${lastOpts?.advantage ? ', Advantage deck' : ''}`)}</div>` : ''}
    <div class="panel panel--sunk">${table(pub, PUBLISHED.trials, 'Published: docs/BALANCE.md, tools/sim.py, seed 7, no bonus, no classes, no Advantage')}</div>
  </div>`;
}

function start(s) {
  if (running) return;
  if (!window.Worker) { showToast('No Worker support in this browser'); return; }
  rows = []; progress = 0; running = true;
  const opts = { legacy: !!s.balance.legacy, bonus: s.balance.bonus || 0, klass: s.balance.klass || 'none', advantage: !!s.balance.advantage && !s.balance.legacy, seed: 7 };
  lastOpts = { ...opts, trials: s.balance.trials };
  worker = new Worker('js/game/sim-worker.js', { type: 'module' });
  worker.onmessage = (e) => {
    if (e.data.type === 'cell') {
      rows.push(e.data.cell); progress = e.data.done;
      // Patch the progress readout in place. A full render per cell replaced the
      // whole view twenty times a run: it snapped open selects shut, ate the
      // click of anyone mid-press on Stop, and clobbered other views entirely.
      if (state.view === 'balance') {
        const bar = document.querySelector('.progress i');
        if (bar) bar.style.width = `${(progress / 20) * 100}%`;
        const label = document.querySelector('.progress + .small');
        if (label) label.textContent = `${t('balance.running')} ${progress}/20`;
      }
      return;
    }
    if (e.data.type === 'done') {
      rows = e.data.rows; progress = 20; running = false; worker.terminate(); worker = null;
      document.dispatchEvent(new CustomEvent('enjeu:rerender'));
    }
  };
  worker.onerror = (e) => { running = false; showToast(`Simulator error: ${e.message}`); console.error(e); document.dispatchEvent(new CustomEvent('enjeu:rerender')); };
  // Strip the derived indexes; the worker rebuilds them (and byId would be a second copy of every card).
  const { byId, physical, ...raw } = s.cards;
  worker.postMessage({ data: raw, opts, trials: s.balance.trials });
}

function stop() {
  if (worker) { worker.terminate(); worker = null; }
  running = false;
}

/** Returns true when the view must re-render. */
export function onBalanceAction(s, act, el) {
  const b = s.balance;
  switch (act) {
    case 'trials': b.trials = Number(el.value) || 2000; return false;
    case 'bonus': b.bonus = Number(el.dataset.bonus) || 0; return true;
    case 'klass': b.klass = el.value; return false;
    case 'advantage': b.advantage = !b.advantage; return true;
    case 'legacy': b.legacy = !b.legacy; if (b.legacy) b.advantage = false; return true;
    case 'run': start(s); return true;
    case 'stop': stop(); return true;
    default: return false;
  }
}
