// ── Learn view ───────────────────────────────────────────────
// Hero, the walkthrough (data/walkthrough.js), the dice bridge, and the
// rulebook itself (RULES.md fetched and rendered, the single canonical text).

import { state } from '../state.js';
import { t } from '../strings.js';
import { escHtml, renderMarkdown } from '../utils.js';
import { cardFace, lifeMini, FACE } from '../cards/face.js';
import { glyphSvg, glyphPath, GLYPH_SIZE } from '../cards/glyphs.js';
import { ladderTable, fidelity, DICE } from '../game/rules.js';
import { STEPS, REACTIONS, TURN } from '../data/walkthrough.js';
import { figureSvg } from '../game/figures.js';
import { BOSSES, heroFor } from '../data/placeholders.js';

let rulebookHtml = null, rulebookLoading = false;
function ensureRulebook() {
  if (rulebookHtml || rulebookLoading) return;
  rulebookLoading = true;
  fetch('RULES.md').then((r) => (r.ok ? r.text() : Promise.reject(r.status)))
    .then((md) => { rulebookHtml = renderMarkdown(md); })
    .catch(() => { rulebookHtml = '<p class="muted">RULES.md did not load. It ships in the repo next to this page.</p>'; })
    .finally(() => { rulebookLoading = false; document.dispatchEvent(new CustomEvent('enjeu:rerender')); });
}

const pips = (n) => `<span class="pips">${'<i></i>'.repeat(n)}</span>`;

function heroArt() {
  const h = heroFor(state.element || 'fire');
  const b = BOSSES[0];
  return `<svg viewBox="0 0 360 200" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="a hero figure faces a brick boss, with life cards between them">
    <g transform="translate(10 40) scale(1.1)">${figureSvg(h).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(200 10) scale(1.5)">${figureSvg(b).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(140 120) scale(0.09)">${lifeMini(h.element).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
    <g transform="translate(176 112) rotate(90 315 440) scale(0.09)">${lifeMini(h.element).replace(/<svg[^>]*>|<\/svg>/g, '')}</g>
  </svg>`;
}

function statesVisual() {
  const el = state.element || 'fire';
  const c = state.cards.byId[`life-${el}`];
  const face = cardFace(c, { size: 'hand' });
  return `<div class="states">
    <div class="state"><div class="state__face">${face}</div><h4>Ready</h4><p>upright. You may bet it. It guards you.</p></div>
    <div class="state state--spent"><div class="state__face">${face}</div><h4>Spent</h4><p>sideways. You bet it or guarded with it. Back next turn.</p></div>
    <div class="state state--broken"><div class="state__face">${face}</div><h4>Broken</h4><p>face down. Gone for the level.</p></div>
  </div>`;
}

function attacksVisual() {
  return `<div class="action-cards" style="max-width:420px">${['strike', 'focus', 'all-in'].map((id) => {
    const c = state.cards.byId[id];
    return `<a class="action-card" href="#/cards/attack" data-action="go" data-view="cards" data-param="attack">${cardFace(c, { size: 'hand' })}<span>${escHtml(c.name)}</span></a>`;
  }).join('')}</div>`;
}

function turnVisual() {
  return `<div class="strip" style="grid-template-columns: repeat(4, minmax(0, 1fr))">${TURN.map((s, i) => `
    <div class="strip__cell">${glyphSvg(s.glyph, '', 36)}<b>${i + 1}. ${escHtml(s.name)}</b><span>${escHtml(s.note)}</span></div>`).join('')}</div>`;
}

function ladderVisual() {
  const { rows } = ladderTable(state.cards.ladder);
  const die = state.die || 'd20';
  return `<div class="table-wrap"><table class="ladder">
    <thead><tr><th>${escHtml(t('learn.step'))}</th><th>${escHtml(t('learn.odds'))}</th>${DICE.map((d) => `<th>${d}</th>`).join('')}</tr></thead>
    <tbody>${rows.map((r) => `<tr><td>${pips(r.pips)} ${escHtml(r.step.charAt(0).toUpperCase() + r.step.slice(1))}</td><td>${r.odds}%</td>${DICE.map((d) => `<td class="${d === die ? 'is-mine' : ''}">${r.targets[d]}+</td>`).join('')}</tr>`).join('')}</tbody>
  </table></div>
  <p class="small muted">Your die, ${die}, is the highlighted column. Change it in Play.</p>`;
}

function reactionsVisual() {
  return `<div class="strip">${REACTIONS.map((r) => `
    <div class="strip__cell"><div class="die-face" style="width:44px;height:44px;font-size:20px;margin:0 auto 6px">${r.roll}</div>${glyphSvg(r.glyph, '', 28)}<b>${escHtml(r.name)}</b><span>${escHtml(r.note)}</span></div>`).join('')}</div>`;
}

function cycleVisual() {
  const cyc = state.cards.element_cycle;            // water beats fire, fire beats wind, wind beats earth, earth beats water
  const pos = { water: [160, 30], fire: [290, 120], wind: [160, 210], earth: [30, 120] };
  const col = { fire: FACE.fire, water: FACE.water, earth: FACE.earth, wind: FACE.wind };
  let out = `<svg viewBox="0 0 320 240" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="the element cycle"><defs><marker id="arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5 0 10z" fill="#1c1917"/></marker></defs>`;
  for (const [a, b] of Object.entries(cyc)) {
    if (a.startsWith('$') || !pos[a] || !pos[b]) continue;   // cards.json keeps a $note beside the four pairs
    const [x1, y1] = pos[a], [x2, y2] = pos[b];
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
    out += `<line x1="${x1 + ux * 34}" y1="${y1 + uy * 34}" x2="${x2 - ux * 36}" y2="${y2 - uy * 36}" stroke="#1c1917" stroke-width="3" marker-end="url(#arr)"/>`;
  }
  for (const [el, [x, y]] of Object.entries(pos)) {
    out += `<circle cx="${x}" cy="${y}" r="28" fill="${col[el]}"/>`;
    const k = 36 / GLYPH_SIZE;
    out += `<g transform="translate(${x - 18} ${y - 18}) scale(${k})"><path d="${glyphPath(el)}" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round"/></g>`;
  }
  return out + `</svg>`;
}

function unlocksVisual() {
  const classes = state.cards.class.map((c) => `<a class="action-card" href="#/cards/class">${cardFace(c, { size: 'hand' })}<span>${escHtml(c.name)}</span></a>`).join('');
  const camp = state.cards.boss.filter((b) => b.rage).map((b, i) => `<tr><td>${i + 1}</td><td>${b.size}</td><td>${b.life_cards} × ${b.per_card}</td><td>${b.hp}</td><td>${b.damage}</td><td>${b.rage}</td></tr>`).join('');
  return `<div class="row" style="align-items:flex-start; gap: var(--space-8)">
    <div class="cycle">${cycleVisual()}</div>
    <div class="grow stack stack--tight">
      <div class="action-cards" style="max-width:460px">${classes}</div>
      <div class="table-wrap"><table class="ladder"><thead><tr><th>Level</th><th>Size</th><th>Life</th><th>Total</th><th>Damage</th><th>Rage</th></tr></thead><tbody>${camp}</tbody></table></div>
    </div>
  </div>`;
}

function componentsVisual() {
  const decks = ['attack', 'skill', 'class', 'advantage', 'boss', 'biome', 'life', 'aid'];
  return `<div class="row" style="gap: var(--space-8); align-items:flex-start">
    <div class="table-wrap"><table class="ladder"><tbody>${decks.map((d) => `<tr><td>${escHtml(t(`cards.deck.${d}`))}</td><td>${(state.cards[d] || []).reduce((a, c) => a + (c.copies || 1), 0)}</td></tr>`).join('')}<tr><td><b>Total</b></td><td><b>${state.cards.physical.length}</b></td></tr></tbody></table></div>
    <div class="stack stack--tight">
      <a class="btn btn--primary" href="#/cards">${escHtml(t('learn.ctaCards'))}</a>
      <a class="btn" href="#/play">${escHtml(t('learn.ctaPlay'))}</a>
      <p class="small muted">${escHtml(t('play.placeholderNote'))}</p>
    </div>
  </div>`;
}

const VISUALS = { states: statesVisual, attacks: attacksVisual, turn: turnVisual, ladder: ladderVisual, reactions: reactionsVisual, unlocks: unlocksVisual, components: componentsVisual };

export function renderLearn(s) {
  ensureRulebook();
  const fid = fidelity(s.cards.ladder);
  return `<div class="container stack stack--loose">
    <section class="hero" id="learn-top">
      <div class="stack stack--tight">
        <p class="kicker">${escHtml(t('learn.heroKicker'))}</p>
        <h2>${t('learn.heroTitle')}</h2>
        <p>${escHtml(t('learn.heroLead'))}</p>
        <div class="row">
          <a class="btn btn--primary btn--lg" href="#/play">${glyphSvg('strike', '', 18)} ${escHtml(t('learn.ctaFirst'))}</a>
          <a class="btn btn--lg" href="#/cards">${glyphSvg('dice', '', 18)} ${escHtml(t('learn.ctaCards'))}</a>
        </div>
      </div>
      <div class="hero__art">${heroArt()}</div>
    </section>

    <section class="stack" id="learn-walkthrough" aria-labelledby="wt-title">
      <p class="kicker" id="wt-title">${escHtml(t('learn.walkthroughKicker'))}</p>
      <div class="steps">${STEPS.map((st) => `
        <article class="step" id="learn-${st.id}">
          <div class="step__num" aria-hidden="true"></div>
          <div>
            <h3>${escHtml(st.title)} <small class="muted" style="font-size:0.6em;font-weight:600">rules §${escHtml(st.rule)}</small></h3>
            ${st.body.map((p) => `<p>${escHtml(p)}</p>`).join('')}
            <div class="step__visual">${VISUALS[st.visual]?.() || ''}</div>
          </div>
        </article>`).join('')}</div>
    </section>

    <section class="panel stack stack--tight" id="learn-dice">
      <h3 class="panel__title">${escHtml(t('learn.bridgeTitle'))}</h3>
      <p class="panel__lead">${escHtml(t('learn.bridgeLead'))}</p>
      ${ladderVisual()}
      <p class="small muted">Worst gap between a step's stated odds and the die's real odds: ${fid.map((f) => `${f.die} ${(f.gap * 100).toFixed(1)}`).join(' · ')} points.</p>
    </section>

    <section class="stack stack--tight" id="learn-rulebook">
      <h3 class="panel__title">${escHtml(t('learn.rulebookTitle'))}</h3>
      <p class="panel__lead">${escHtml(t('learn.rulebookLead'))}</p>
      <div class="panel rulebook">${rulebookHtml || `<p class="muted">${escHtml(t('common.loading'))}</p>`}</div>
    </section>
  </div>`;
}
