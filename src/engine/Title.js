// Title screen overlay. The 3D background (a slowly panning room) is managed by Game.showTitle().

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

  hide() {
    const el = this.el;
    if (!el) return;
    el.classList.add('oc-hidden');
    setTimeout(() => el.remove(), 1000);
    this.el = null;
  }
}
