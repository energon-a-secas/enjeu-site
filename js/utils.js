// ── Shared utilities ─────────────────────────────────────────
// Small, pure helpers. No DOM assumptions beyond the three that say so.

const _els = {};
/** Cached element lookup by id. */
export function $(id) {
  return _els[id] || (_els[id] = document.getElementById(id));
}

/** Escape HTML special characters. */
export function escHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

let _toastTimer = null;
/** Temporary toast in the corner. */
export function showToast(msg) {
  let el = document.getElementById('app-toast');
  if (!el) {
    el = document.createElement('div');
    el.id = 'app-toast';
    el.className = 'toast';
    el.setAttribute('role', 'status');
    document.body.appendChild(el);
  }
  el.textContent = msg;
  el.classList.add('visible');
  clearTimeout(_toastTimer);
  _toastTimer = setTimeout(() => el.classList.remove('visible'), 2200);
}

export function debounce(fn, ms) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export const clamp = (n, lo, hi) => Math.min(hi, Math.max(lo, n));

/**
 * Seeded RNG (mulberry32). The engine takes rolls from outside, so a seeded
 * stream is what makes a batch run reproducible and a test deterministic.
 * @param {number} seed
 * @returns {() => number} uniform in [0, 1)
 */
export function rng(seed) {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Integer in [1, n] from a uniform source. */
export const rollInt = (next, n) => 1 + Math.floor(next() * n);

/** Fisher-Yates in place, from a uniform source. */
export function shuffle(arr, next = Math.random) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/**
 * Minimal Markdown renderer for RULES.md: headings, paragraphs, bold/italic,
 * inline code, links, bullet and numbered lists, pipe tables, blockquotes,
 * fenced code, rules. Good enough for the rulebook, not a general parser.
 * Headings are shifted down two levels so the rulebook's H1 sits under the
 * view's own H2.
 */
export function renderMarkdown(src) {
  const lines = escHtml(src).split(/\r?\n/);
  const out = [];
  let list = null, inCode = false, para = [], table = null;

  const inline = (s) => s
    .replace(/`([^`]+)`/g, '<code>$1</code>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/(^|[^*])\*([^*]+)\*/g, '$1<em>$2</em>')
    .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>')
    .replace(/\[([^\]]+)\]\((#[^\s)]*)\)/g, '<a href="$2">$1</a>')
    .replace(/\[([^\]]+)\]\(([^\s)]+\.md[^\s)]*)\)/g, '$1');

  const flushPara = () => { if (para.length) { out.push(`<p>${inline(para.join(' '))}</p>`); para = []; } };
  const closeList = () => { if (list) { out.push(`</${list}>`); list = null; } };
  const closeTable = () => {
    if (!table) return;
    const [head, ...rows] = table;
    const cells = (r, tag) => r.map((c) => `<${tag}>${inline(c.trim())}</${tag}>`).join('');
    out.push(`<table><thead><tr>${cells(head, 'th')}</tr></thead><tbody>${rows.map((r) => `<tr>${cells(r, 'td')}</tr>`).join('')}</tbody></table>`);
    table = null;
  };
  const slug = (s) => s.toLowerCase().replace(/<[^>]+>/g, '').replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');

  for (const line of lines) {
    if (/^```/.test(line)) {
      flushPara(); closeList(); closeTable();
      out.push(inCode ? '</code></pre>' : '<pre><code>');
      inCode = !inCode;
      continue;
    }
    if (inCode) { out.push(`${line}\n`); continue; }

    if (/^\|/.test(line)) {
      flushPara(); closeList();
      const cells = line.replace(/^\||\|$/g, '').split('|');
      if (cells.every((c) => /^\s*:?-{2,}:?\s*$/.test(c))) continue; // separator row
      (table ||= []).push(cells);
      continue;
    }
    closeTable();

    const h = /^(#{1,6})\s+(.*)$/.exec(line);
    if (h) {
      flushPara(); closeList();
      const level = Math.min(h[1].length + 2, 6);
      out.push(`<h${level} id="rb-${slug(h[2])}">${inline(h[2])}</h${level}>`);
      continue;
    }
    if (/^---+$/.test(line.trim())) { flushPara(); closeList(); out.push('<hr>'); continue; }
    const quote = /^>\s?(.*)$/.exec(line);
    if (quote) { flushPara(); closeList(); out.push(`<blockquote>${inline(quote[1])}</blockquote>`); continue; }

    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    if (ul || ol) {
      flushPara();
      const want = ul ? 'ul' : 'ol';
      if (list !== want) { closeList(); out.push(`<${want}>`); list = want; }
      out.push(`<li>${inline((ul || ol)[1])}</li>`);
      continue;
    }
    if (/^\s{2,}\S/.test(line) && list) { // continuation line inside a list item
      out[out.length - 1] = out[out.length - 1].replace(/<\/li>$/, ` ${inline(line.trim())}</li>`);
      continue;
    }
    if (!line.trim()) { flushPara(); closeList(); continue; }
    para.push(line.trim());
  }
  flushPara(); closeList(); closeTable();
  if (inCode) out.push('</code></pre>');
  return out.join('\n');
}
