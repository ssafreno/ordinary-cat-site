// Title screen overlay. The 3D background (a slowly panning room) is managed by Game.showTitle().

const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

export class Title {
  constructor(ctx) {
    this.ctx = ctx;
    this.el = null;
  }

  /** Show the overlay. Resolves with 'new' | 'continue'. */
  show({ canContinue = false } = {}) {
    const el = document.createElement('div');
    el.className = 'oc-title';
    // QA: the ending stores a best time "for the title badge", but nothing showed it
    let best = 0;
    try { best = Math.floor(parseFloat(localStorage.getItem('ordinary-cat.best'))) || 0; } catch (e) { /* storage blocked */ }
    const bestTxt = best > 0 ? `Best escape ${Math.floor(best / 60)}:${String(best % 60).padStart(2, '0')} · ` : '';
    el.innerHTML = `
      <div class="oc-title-kicker">Pennywhistle &amp; Daughters present</div>
      <h1>An <em>Ordinary</em> Cat</h1>
      <div class="oc-title-sub">An escape room. Three rooms. One very ordinary cat.</div>
      <div class="oc-title-buttons">
        <button class="oc-title-btn" data-act="${canContinue ? 'continue' : 'new'}" type="button">${canContinue ? 'Continue' : 'New Game'}</button>
        ${canContinue ? '<button class="oc-title-btn oc-secondary" data-act="new" type="button">New Game</button>' : ''}
      </div>
      <div class="oc-title-foot">${bestTxt}Drag to look · Click to interact</div>`;
    this.ctx.ui.appendChild(el);
    this.el = el;
    const resume = () => this.ctx.audio?.resume?.();
    el.addEventListener('pointerdown', resume, { once: true });
    return new Promise((resolve) => {
      el.addEventListener('click', async (e) => {
        const b = e.target.closest('[data-act]');
        if (!b) return;
        resume();
        const act = b.dataset.act;
        if (act === 'new' && canContinue) {
          const ok = await this.ctx.hud.confirm({ title: 'New game?', text: 'This will forget your current progress.', ok: 'Start fresh', cancel: 'Never mind' });
          if (!ok) return;
        }
        this.ctx.audio?.play('click');
        resolve(act);
      });
    });
  }

  /**
   * Prelude note over black, shown once after New Game (playtest: players didn't know they were a courier).
   * Rendered as a physical delivery docket from Pennywhistle & Daughters (content: script 'prelude.note').
   * No timer: it stays until the player clicks anywhere, presses any key, or presses the button.
   * Resolves after the note has been dismissed and faded out.
   */
  prelude(note) {
    if (!note || !Array.isArray(note.rows) || !note.rows.length) return Promise.resolve();
    const el = document.createElement('div');
    el.className = 'oc-prelude';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', note.heading || 'Courier instructions');
    const rows = note.rows.map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
    el.innerHTML = `
      <div class="oc-prelude-sheet">
        <div class="oc-prelude-head">
          ${note.firm ? `<div class="oc-prelude-firm">${esc(note.firm)}</div>` : ''}
          ${note.trade ? `<div class="oc-prelude-trade">${esc(note.trade)}</div>` : ''}
        </div>
        <div class="oc-prelude-rule" aria-hidden="true"><span>❧</span></div>
        <div class="oc-prelude-titlerow">
          ${note.heading ? `<h2>${esc(note.heading)}</h2>` : ''}
          ${note.ref ? `<span class="oc-prelude-ref">${esc(note.ref)}</span>` : ''}
        </div>
        <dl class="oc-prelude-rows">${rows}</dl>
        <div class="oc-prelude-foot">
          ${note.scrawl ? `<div class="oc-prelude-scrawl">${esc(note.scrawl)}</div>` : ''}
          ${note.stamp ? `<div class="oc-prelude-stamp" aria-hidden="true">${esc(note.stamp)}</div>` : ''}
        </div>
        <button class="oc-prelude-btn" type="button">${esc(note.button || 'Continue')}</button>
      </div>
      ${note.hint ? `<div class="oc-prelude-hint">${esc(note.hint)}</div>` : ''}`;
    document.body.appendChild(el);
    return new Promise((resolve) => {
      let done = false, armed = false;
      const finish = () => {
        if (done || !armed) return; done = true;
        window.removeEventListener('keydown', finish);
        el.classList.add('oc-hidden');
        setTimeout(() => { el.remove(); resolve(); }, 650);
      };
      el.addEventListener('click', () => { if (armed) this.ctx.audio?.play?.('page', { gain: 0.5, pitch: 0.9 }); finish(); });
      window.addEventListener('keydown', finish);
      requestAnimationFrame(() => el.classList.add('oc-shown'));
      // Arm after the fade-in has begun so a stray double-click on New Game can't skip the note unread.
      setTimeout(() => { armed = true; el.querySelector('.oc-prelude-btn')?.focus({ preventScroll: true }); }, 450);
    });
  }

  hide() {
    const el = this.el;
    if (!el) return;
    el.classList.add('oc-hidden');
    setTimeout(() => el.remove(), 1000);
    this.el = null;
  }
}
