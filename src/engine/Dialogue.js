// Dialogue box (typewriter + blips + queue), narrator captions, and two-option choices.

const CAT_SVG = `
<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="ocbg" cx="50%" cy="38%" r="70%"><stop offset="0" stop-color="#7a5a3e"/><stop offset="1" stop-color="#2a1b12"/></radialGradient>
    <radialGradient id="oceye" cx="40%" cy="40%" r="60%"><stop offset="0" stop-color="#ffd27a"/><stop offset="1" stop-color="#d98a1c"/></radialGradient>
  </defs>
  <rect width="100" height="100" fill="url(#ocbg)"/>
  <g stroke="#1e1612" stroke-width="2.2" stroke-linejoin="round" stroke-linecap="round">
    <!-- body/bib -->
    <path d="M18 104 Q22 74 50 72 Q78 74 82 104 Z" fill="#8d8f93"/>
    <path d="M36 104 Q40 80 50 79 Q60 80 64 104 Z" fill="#f2efe8" stroke-width="1.6"/>
    <!-- ears (right one notched) -->
    <path d="M22 44 L24 14 L44 30 Z" fill="#8d8f93"/>
    <path d="M27 36 L28 21 L38 30 Z" fill="#d9a3a0" stroke-width="1.2"/>
    <path d="M78 44 L77 14 L66 22 L63 19 L58 29 Z" fill="#8d8f93"/>
    <path d="M73 36 L73 22 L64 30 Z" fill="#d9a3a0" stroke-width="1.2"/>
    <!-- head -->
    <path d="M50 26 C74 26 84 40 82 56 C80 72 66 80 50 80 C34 80 20 72 18 56 C16 40 26 26 50 26 Z" fill="#9a9ca1"/>
  </g>
  <!-- tabby stripes -->
  <g stroke="#5f6166" stroke-width="2.6" stroke-linecap="round" fill="none">
    <path d="M50 29 L50 39"/><path d="M43 30 L45 38"/><path d="M57 30 L55 38"/>
    <path d="M20 54 L28 55"/><path d="M21 61 L29 60"/><path d="M80 54 L72 55"/><path d="M79 61 L71 60"/>
  </g>
  <!-- muzzle -->
  <path d="M38 62 C38 55 46 54 50 58 C54 54 62 55 62 62 C62 70 56 74 50 74 C44 74 38 70 38 62 Z" fill="#f2efe8" stroke="#1e1612" stroke-width="1.6"/>
  <!-- eyes -->
  <g stroke="#1e1612" stroke-width="1.8">
    <ellipse cx="37" cy="49" rx="7.5" ry="6.2" fill="url(#oceye)"/>
    <ellipse cx="63" cy="49" rx="7.5" ry="6.2" fill="url(#oceye)"/>
  </g>
  <ellipse cx="37" cy="49.5" rx="1.8" ry="5" fill="#1e1612"/>
  <ellipse cx="63" cy="49.5" rx="1.8" ry="5" fill="#1e1612"/>
  <circle cx="35" cy="47" r="1.4" fill="#fff"/><circle cx="61" cy="47" r="1.4" fill="#fff"/>
  <!-- half-lidded, unimpressed -->
  <path d="M29 47 Q37 41 45 47 L45 44 Q37 39 29 44 Z" fill="#9a9ca1" stroke="#1e1612" stroke-width="1.4"/>
  <path d="M55 47 Q63 41 71 47 L71 44 Q63 39 55 44 Z" fill="#9a9ca1" stroke="#1e1612" stroke-width="1.4"/>
  <g class="oc-eyelid"><rect x="28" y="42" width="18" height="14" rx="6" fill="#9a9ca1"/><rect x="54" y="42" width="18" height="14" rx="6" fill="#9a9ca1"/></g>
  <!-- nose + mouth -->
  <path d="M47 60 L53 60 L50 64 Z" fill="#c9787a" stroke="#1e1612" stroke-width="1.2" stroke-linejoin="round"/>
  <path class="oc-mouth" style="transform-origin:50px 66px" d="M46 67 Q50 69 50 65 Q50 69 54 67" fill="none" stroke="#1e1612" stroke-width="1.4" stroke-linecap="round"/>
  <!-- whiskers -->
  <g stroke="#f7f4ee" stroke-width="0.9" opacity="0.85">
    <path d="M40 64 L18 61"/><path d="M40 66 L19 68"/><path d="M60 64 L82 61"/><path d="M60 66 L81 68"/>
  </g>
</svg>`;

const SPEAKERS = {
  cat: { name: 'The Cat', pitch: 0.62, portrait: true, blip: true },
  quince: { name: 'Bartholomew Quince', pitch: 0.78, portrait: false, blip: true },
  narrator: { name: '', pitch: 1, portrait: false, blip: false },
};

function escapeHtml(s) {
  return s.replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
}

/** Parse *emphasis* into tokens [{ch, em}]. */
function tokenize(text) {
  const out = [];
  let em = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (ch === '*') { em = !em; continue; }
    out.push({ ch, em });
  }
  return out;
}
function tokensToHtml(tokens, n) {
  let html = '', em = false;
  for (let i = 0; i < n; i++) {
    const t = tokens[i];
    if (t.em !== em) { html += t.em ? '<em>' : '</em>'; em = t.em; }
    html += escapeHtml(t.ch);
  }
  if (em) html += '</em>';
  return html;
}

export class Dialogue {
  constructor(ctx) {
    this.ctx = ctx;
    this.cps = 42;            // characters per second
    this.isOpen = false;      // true while a blocking line/choice is on screen
    this._queue = Promise.resolve();
    this._pending = 0;
    this._line = null;        // { tokens, shown, done, resolve }

    const el = document.createElement('div');
    el.className = 'oc-dialog oc-hidden';
    el.innerHTML = `
      <div class="oc-portrait">${CAT_SVG}</div>
      <div class="oc-dialog-body">
        <div class="oc-speaker"></div>
        <div class="oc-text"></div>
        <div class="oc-choices"></div>
      </div>
      <div class="oc-next"></div>`;
    ctx.ui.appendChild(el);
    this.el = el;
    this.portraitEl = el.querySelector('.oc-portrait');
    this.speakerEl = el.querySelector('.oc-speaker');
    this.textEl = el.querySelector('.oc-text');
    this.choicesEl = el.querySelector('.oc-choices');
    el.addEventListener('click', (e) => { if (!e.target.closest('.oc-choice')) this.advance(); });

    this.captionEl = document.createElement('div');
    this.captionEl.className = 'oc-caption oc-hidden';
    ctx.ui.appendChild(this.captionEl);
    this._captionTimer = null;

    window.addEventListener('keydown', (e) => {
      if (!this.isOpen) return;
      if (e.code === 'Space' || e.code === 'Enter') { e.preventDefault(); this.advance(); }
    });
  }

  // ---- content resolution ---------------------------------------------------
  /** Merge extra keys into the script (existing keys are NOT overwritten unless overwrite=true). */
  addScript(entries, { overwrite = false } = {}) {
    const s = this.ctx.script;
    for (const [k, v] of Object.entries(entries)) if (overwrite || !(k in s)) s[k] = v;
  }

  has(key) { return !!this.ctx.script && key in this.ctx.script; }

  /**
   * Normalise a key or raw content into an array of {who, text}.
   * - string key → script lookup; unknown string → narrator line with that text
   * - script string → narrator line; array of strings → random one; array of line-arrays → random one
   */
  resolve(keyOrLines) {
    let v = keyOrLines;
    if (typeof v === 'string') {
      if (this.ctx.script && v in this.ctx.script) v = this.ctx.script[v];
      else if (/^[\w.-]+$/.test(v) && v.includes('.')) {
        console.warn(`[dialogue] missing script key "${v}"`);
        return [];
      }
    }
    if (v == null) return [];
    if (typeof v === 'string') return [{ who: 'narrator', text: v }];
    if (Array.isArray(v)) {
      if (v.length === 0) return [];
      if (typeof v[0] === 'string') return [{ who: 'narrator', text: v[Math.floor(Math.random() * v.length)] }];
      if (Array.isArray(v[0])) return this.resolve(v[Math.floor(Math.random() * v.length)]);
      return v.map((l) => (typeof l === 'string' ? { who: 'narrator', text: l } : l));
    }
    if (typeof v === 'object' && v.text) return [v];
    return [];
  }

  // ---- public API -------------------------------------------------------------
  /** Say a script key (or raw lines). Calls serialize. Resolves after the last line is dismissed. */
  say(keyOrLines) {
    const lines = this.resolve(keyOrLines);
    return this._enqueue(() => this._playLines(lines));
  }

  sayLines(lines) { return this.say(lines); }

  /** Two-option choice. Resolves with the chosen index (0/1) after the reply is played. */
  choice(keyOrDef) {
    const def = typeof keyOrDef === 'string' ? this.ctx.script?.[keyOrDef] : keyOrDef;
    if (!def) { console.warn(`[dialogue] missing choice "${keyOrDef}"`); return Promise.resolve(-1); }
    return this._enqueue(async () => {
      const prompt = this.resolve(def.prompt || []);
      for (let i = 0; i < prompt.length - 1; i++) await this._showLine(prompt[i]);
      const last = prompt[prompt.length - 1] || { who: 'narrator', text: '' };
      const idx = await this._showLine(last, def.options || []);
      const reply = this.resolve(def.options?.[idx]?.reply || []);
      await this._playLines(reply, true);
      return idx;
    });
  }

  /** Narrator caption: non-blocking, auto-dismisses. Accepts a script key or text. */
  caption(keyOrText, { duration } = {}) {
    let text = keyOrText;
    if (typeof keyOrText === 'string' && this.ctx.script && keyOrText in this.ctx.script) {
      const lines = this.resolve(keyOrText);
      text = lines.map((l) => l.text).join(' ');
    } else if (Array.isArray(keyOrText)) {
      text = keyOrText[Math.floor(Math.random() * keyOrText.length)];
    }
    if (!text) return;
    const el = this.captionEl;
    el.innerHTML = tokensToHtml(tokenize(text), tokenize(text).length);
    el.classList.remove('oc-hidden');
    clearTimeout(this._captionTimer);
    const ms = (duration ?? Math.max(2.5, text.split(/\s+/).length * 0.32 + 1)) * 1000;
    this._captionTimer = setTimeout(() => el.classList.add('oc-hidden'), ms);
  }

  hideCaption() { clearTimeout(this._captionTimer); this.captionEl.classList.add('oc-hidden'); }

  /** Complete the current typewriter line, or advance if already complete. */
  advance() {
    const l = this._line;
    if (!l || l.choices) return;
    if (!l.done) { l.shown = l.tokens.length; this._renderLine(); return; }
    this._line = null;
    l.resolve(0);
  }
  skip() { this.advance(); }

  /** Is anything queued or showing? */
  get busy() { return this._pending > 0; }

  // ---- internals -------------------------------------------------------------
  _enqueue(fn) {
    this._pending++;
    const p = this._queue.then(fn).catch((e) => { console.error(e); }).finally(() => {
      this._pending--;
      if (this._pending === 0) this._close();
    });
    this._queue = p;
    return p;
  }

  async _playLines(lines, keepOpen = false) {
    for (const l of lines) await this._showLine(l);
  }

  _close() {
    this.isOpen = false;
    this.el.classList.add('oc-hidden');
    this.portraitEl.classList.remove('oc-talk');
  }

  _showLine(line, choices = null) {
    const who = line.who || 'narrator';
    const sp = SPEAKERS[who] || { name: who, pitch: 1, portrait: false, blip: true };
    this.isOpen = true;
    this.hideCaption();
    const el = this.el;
    el.classList.remove('oc-hidden', 'oc-done');
    el.classList.toggle('oc-narrator', who === 'narrator');
    this.portraitEl.style.display = sp.portrait ? '' : 'none';
    this.portraitEl.style.filter = who === 'quince' ? 'sepia(0.35) hue-rotate(-10deg) saturate(1.2)' : '';
    this.speakerEl.textContent = sp.name;
    this.speakerEl.style.display = sp.name ? '' : 'none';
    this.choicesEl.innerHTML = '';
    const tokens = tokenize(String(line.text ?? ''));
    return new Promise((resolve) => {
      this._line = { tokens, shown: 0, acc: 0, done: false, resolve, sp, choices, blipAcc: 0 };
      this._renderLine();
    });
  }

  _renderLine() {
    const l = this._line;
    if (!l) return;
    this.textEl.innerHTML = tokensToHtml(l.tokens, l.shown);
    if (l.shown >= l.tokens.length && !l.done) {
      l.done = true;
      this.el.classList.add('oc-done');
      this.portraitEl.classList.remove('oc-talk');
      if (l.choices && l.choices.length) {
        this.el.classList.remove('oc-done');
        l.choices.forEach((opt, i) => {
          const b = document.createElement('button');
          b.className = 'oc-choice';
          b.type = 'button';
          b.textContent = opt.text;
          b.addEventListener('click', (e) => {
            e.stopPropagation();
            this.ctx.audio?.play('click');
            this._line = null;
            this.choicesEl.innerHTML = '';
            l.resolve(i);
          });
          this.choicesEl.appendChild(b);
        });
      }
    }
  }

  /** Called by Game every frame. */
  update(dt) {
    const l = this._line;
    if (!l || l.done) return;
    const before = l.shown;
    l.acc += dt * this.cps;
    const add = Math.floor(l.acc);
    if (add > 0) {
      l.acc -= add;
      l.shown = Math.min(l.tokens.length, l.shown + add);
      if (l.sp.blip) {
        this.portraitEl.classList.add('oc-talk');
        for (let i = before; i < l.shown; i++) {
          const ch = l.tokens[i].ch;
          if (/[\s.,!?…—-]/.test(ch)) continue;
          if (++l.blipAcc % 2 === 0) {
            const jitter = 1 + (Math.random() - 0.5) * 0.12;
            this.ctx.audio?.blip(l.sp.pitch * jitter, { who: this._lineWho(l) });
          }
        }
      }
      this._renderLine();
    }
  }

  _lineWho(l) {
    return l.sp === SPEAKERS.cat ? 'cat' : l.sp === SPEAKERS.quince ? 'quince' : 'narrator';
  }
}
