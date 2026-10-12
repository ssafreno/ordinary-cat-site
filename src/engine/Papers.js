// Parchment panel for readable documents (ctx.papers). Content from content/papers.js (ctx.paperDefs):
//   papers[key] = { title, body: 'text with \n', style: 'letter'|'diary'|'page'|'chalk', signature? }

function esc(s) {
  return String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}
function fmt(s) {
  return esc(s).replace(/\*([^*]+)\*/g, '<em>$1</em>');
}

export class Papers {
  constructor(ctx) {
    this.ctx = ctx;
    this.isOpen = false;
    this._close = null;
  }

  /** Add/override paper definitions at runtime (rooms/test content). Existing keys are kept unless overwrite. */
  add(entries, { overwrite = false } = {}) {
    const p = this.ctx.paperDefs;
    for (const [k, v] of Object.entries(entries)) if (overwrite || !(k in p)) p[k] = v;
  }

  /** Show a paper by key (or a {title, body, style} object). Resolves when closed. */
  show(keyOrDef) {
    const def = typeof keyOrDef === 'string' ? this.ctx.paperDefs?.[keyOrDef] : keyOrDef;
    if (!def) { console.warn(`[papers] missing paper "${keyOrDef}"`); return Promise.resolve(); }
    if (this.isOpen) this.hide();
    this.ctx.audio?.play('page');
    this.ctx.dialogue?.hideCaption?.(); // QA: a lingering caption drew over the bottom of the paper
    this.isOpen = true;
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'oc-modal-backdrop';
      const style = ['letter', 'diary', 'page', 'chalk'].includes(def.style) ? def.style : 'letter';
      const paper = document.createElement('div');
      paper.className = `oc-paper oc-${style}`;
      paper.innerHTML = `
        <button class="oc-close" type="button" aria-label="Close">✕</button>
        ${def.title ? `<h2>${fmt(def.title)}</h2>` : ''}
        <div class="oc-paper-body">${fmt(def.body || '')}</div>
        ${def.signature ? `<div class="oc-paper-sig">${fmt(def.signature)}</div>` : ''}`;
      back.appendChild(paper);
      this.ctx.ui.appendChild(back);
      const close = () => {
        if (!back.isConnected || back.classList.contains('oc-closing')) return;
        back.classList.add('oc-closing');
        setTimeout(() => back.remove(), 200);
        this.isOpen = false;
        this._close = null;
        this.ctx.audio?.play('page', { gain: 0.5, pitch: 0.85 });
        resolve();
      };
      this._close = close;
      paper.querySelector('.oc-close').addEventListener('click', close);
      back.addEventListener('click', (e) => { if (e.target === back) close(); });
    });
  }

  hide() { this._close?.(); }
}
