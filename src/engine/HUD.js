// HUD: top-right menu (volume / fullscreen / restart), top-left timer, Back button for focus views, toasts, dev fps.

const ICON = {
  sound: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/></svg>',
  muted: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" fill-opacity=".2"/><path d="M17 9l5 6M22 9l-5 6"/></svg>',
  full: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5"/></svg>',
  unfull: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 4v5H4M15 4v5h5M9 20v-5H4M15 20v-5h5"/></svg>',
  restart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 3-6.7"/><path d="M3 4v5h5"/></svg>',
  back: '<svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M15 5l-7 7 7 7"/></svg>',
};

function fmtTime(s) {
  s = Math.max(0, Math.floor(s));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

export class HUD {
  constructor(ctx) {
    this.ctx = ctx;
    const ui = ctx.ui;

    this.menu = document.createElement('div');
    this.menu.className = 'oc-menu';
    this.soundBtn = this._btn(ICON.sound, 'Volume', () => this.toggleVolume());
    this.soundBtn.setAttribute('aria-haspopup', 'true');
    this.soundBtn.setAttribute('aria-expanded', 'false');
    this.fullBtn = this._btn(ICON.full, 'Fullscreen', () => this.toggleFullscreen());
    this.restartBtn = this._btn(ICON.restart, 'Restart', () => this.confirmRestart());
    this.menu.append(this.soundBtn, this.fullBtn, this.restartBtn);
    ui.appendChild(this.menu);

    // volume popover: a brass slider under the speaker button
    this.volumeEl = document.createElement('div');
    this.volumeEl.className = 'oc-volume oc-hidden';
    this.volumeEl.innerHTML = `<label><span class="oc-volume-label">Volume</span>
      <input type="range" min="0" max="100" step="1" value="100" aria-label="Volume"></label>`;
    this.volumeInput = this.volumeEl.querySelector('input');
    this.volumeEl.addEventListener('pointerdown', (e) => e.stopPropagation());
    this.volumeInput.addEventListener('input', () => this.setVolume(this.volumeInput.value / 100));
    this.volumeInput.addEventListener('change', () => this.ctx.audio?.play('click', { gain: 0.5 }));
    this.volumeInput.addEventListener('keydown', (e) => { if (e.key === 'Escape') { e.stopPropagation(); this.showVolume(false); this.soundBtn.focus(); } });
    ui.appendChild(this.volumeEl);
    document.addEventListener('pointerdown', (e) => { if (this.volumeOpen && !this.volumeEl.contains(e.target) && !this.soundBtn.contains(e.target)) this.showVolume(false); });

    this.timer = document.createElement('div');
    this.timer.className = 'oc-timer';
    this.timer.textContent = '0:00';
    ui.appendChild(this.timer);

    this.back = document.createElement('button');
    this.back.className = 'oc-back oc-hidden';
    this.back.type = 'button';
    this.back.innerHTML = `${ICON.back}<span>Back</span><kbd>Esc</kbd>`;
    this.back.addEventListener('click', () => this.ctx.camera.exitFocus());
    ui.appendChild(this.back);

    this.toastEl = document.createElement('div');
    this.toastEl.className = 'oc-toast oc-hidden';
    ui.appendChild(this.toastEl);

    this.fpsEl = null;
    this._fps = { frames: 0, t: 0 };
    this._lastTimerText = '';

    document.addEventListener('fullscreenchange', () => {
      this.fullBtn.innerHTML = document.fullscreenElement ? ICON.unfull : ICON.full;
    });
    this.setVisible(false);
  }

  _btn(svg, title, fn) {
    const b = document.createElement('button');
    b.className = 'oc-iconbtn';
    b.type = 'button';
    b.title = title;
    b.setAttribute('aria-label', title);
    b.innerHTML = svg;
    b.addEventListener('click', (e) => { e.stopPropagation(); this.ctx.audio?.play('click', { gain: 0.5 }); fn(); });
    return b;
  }

  setVisible(b) {
    this.visible = b;
    this.menu.classList.toggle('oc-hud-hidden', !b);
    this.timer.classList.toggle('oc-hud-hidden', !b);
    if (!b) { this.showBack(false); this.showVolume(false); }
  }

  showBack(b) { this.back.classList.toggle('oc-hidden', !b); }

  toggleVolume() { this.showVolume(!this.volumeOpen); }
  showVolume(b) {
    this.volumeOpen = !!b;
    this.volumeEl.classList.toggle('oc-hidden', !b);
    this.soundBtn.setAttribute('aria-expanded', b ? 'true' : 'false');
    if (b) { this.syncVolume(); this.volumeInput.focus({ preventScroll: true }); }
  }
  /** v is the slider position 0..1. Persisted; the icon goes quiet at zero. */
  setVolume(v) {
    const a = this.ctx.audio;
    a.setVolume(v);
    try { localStorage.setItem('ordinary-cat.volume', String(v)); localStorage.removeItem('ordinary-cat.muted'); } catch (e) { /* ignore */ }
    this.syncVolume();
  }
  syncVolume() {
    const a = this.ctx.audio, v = a ? a.getVolume() : 1;
    this.volumeInput.value = String(Math.round(v * 100));
    this.volumeInput.style.setProperty('--v', `${Math.round(v * 100)}%`);
    this.soundBtn.innerHTML = (!a || a.muted || v <= 0) ? ICON.muted : ICON.sound;
  }

  toggleFullscreen() {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => this.toast('Fullscreen unavailable'));
  }

  /** Parchment confirm dialog. Resolves true/false. */
  confirm({ title = 'Are you sure?', text = '', ok = 'Yes', cancel = 'Cancel' } = {}) {
    return new Promise((resolve) => {
      const back = document.createElement('div');
      back.className = 'oc-modal-backdrop';
      back.innerHTML = `<div class="oc-confirm"><h3></h3><p></p><div class="oc-row">
        <button class="oc-btn oc-ghost" data-v="0" type="button"></button><button class="oc-btn" data-v="1" type="button"></button></div></div>`;
      back.querySelector('h3').textContent = title;
      back.querySelector('p').textContent = text;
      back.querySelector('[data-v="0"]').textContent = cancel;
      back.querySelector('[data-v="1"]').textContent = ok;
      const done = (v) => { back.classList.add('oc-closing'); setTimeout(() => back.remove(), 200); this._confirmClose = null; resolve(v); };
      this._confirmClose = () => done(false);
      back.addEventListener('click', (e) => {
        const b = e.target.closest('[data-v]');
        if (b) done(b.dataset.v === '1');
        else if (e.target === back) done(false);
      });
      this.ctx.ui.appendChild(back);
    });
  }

  async confirmRestart() {
    const ok = await this.confirm({ title: 'Start over?', text: 'Your progress will be forgotten. The cat will pretend not to notice.', ok: 'Restart', cancel: 'Keep playing' });
    if (ok) this.ctx.game.restart();
  }

  /** @param {{ variant?: string }} [opts]  variant 'nudge' = quieter serif styling (onboarding hint) */
  toast(text, ms = 2200, { variant } = {}) {
    this.toastEl.textContent = text;
    this.toastEl.classList.toggle('oc-nudge', variant === 'nudge');
    this.toastEl.classList.remove('oc-hidden');
    clearTimeout(this._toastT);
    this._toastT = setTimeout(() => this.toastEl.classList.add('oc-hidden'), ms);
  }

  enableFps() {
    if (this.fpsEl) return;
    this.fpsEl = document.createElement('div');
    this.fpsEl.className = 'oc-fps';
    this.fpsEl.textContent = '-- fps';
    this.ctx.ui.appendChild(this.fpsEl);
  }

  update(dt) {
    const txt = fmtTime(this.ctx.state.elapsed);
    if (txt !== this._lastTimerText) { this.timer.textContent = txt; this._lastTimerText = txt; }
    if (this.fpsEl) {
      const f = this._fps;
      f.frames++; f.t += dt;
      if (f.t >= 0.5) {
        const info = this.ctx.game.lastFrameInfo || { calls: 0, triangles: 0 };
        this.fpsEl.textContent = `${Math.round(f.frames / f.t)} fps · ${info.calls} calls · ${(info.triangles / 1000).toFixed(0)}k tris`;
        f.frames = 0; f.t = 0;
      }
    }
  }
}

export { fmtTime };
