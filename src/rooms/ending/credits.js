// ENDING — credits: a dark dawn-ridge stage with the cat walking along the bottom, an HTML roll, and an end card.
import * as THREE from 'three';
import * as T from '../../engine/props/textures.js';
import * as P from '../../engine/props/particles.js';

export function fmtTime(s) {
  s = Math.max(0, Math.floor(s || 0));
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const mm = String(m).padStart(h ? 2 : 1, '0'), ss = String(sec).padStart(2, '0');
  return h ? `${h}:${mm}:${ss}` : `${mm}:${ss}`;
}

const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));

const CSS = `
.oce-credits { position: fixed; inset: 0; z-index: 20; pointer-events: none; }
.oce-credits > * { pointer-events: auto; }
.oce-roll { position: absolute; left: 0; right: 0; top: 0; bottom: 30vh; overflow: hidden; pointer-events: none;
  -webkit-mask-image: linear-gradient(180deg, transparent 0, #000 14%, #000 80%, transparent 100%);
          mask-image: linear-gradient(180deg, transparent 0, #000 14%, #000 80%, transparent 100%); }
.oce-track { position: absolute; left: 50%; top: 0; width: min(720px, 92vw); transform: translateX(-50%); text-align: center; will-change: transform; }
.oce-line { font: 500 clamp(19px, 2.1vw, 25px)/1.5 var(--serif); color: rgba(240, 227, 196, 0.92); text-shadow: 0 2px 14px rgba(0,0,0,0.85); padding: 3px 0; }
.oce-line.oce-gap { height: 1.6em; }
.oce-line.oce-title { font: 500 clamp(40px, 5.4vw, 66px)/1.1 var(--serif); letter-spacing: 0.04em; color: #f6e9c9; margin-bottom: 0.25em;
  text-shadow: 0 0 34px rgba(255, 180, 90, 0.35), 0 4px 18px rgba(0,0,0,0.8); }
.oce-line.oce-title em { font-style: italic; color: var(--brass-hi); }
.oce-line.oce-time { font-style: italic; color: var(--brass-hi); }
.oce-role { display: block; font: 600 11px var(--sans); letter-spacing: 0.32em; text-transform: uppercase; color: rgba(236, 208, 138, 0.78); margin-top: 0.6em; }
.oce-name { display: block; font: italic 500 clamp(20px, 2.3vw, 27px)/1.35 var(--serif); color: #f3e6c6; }
.oce-skip { position: absolute; right: 22px; bottom: calc(22px + env(safe-area-inset-bottom, 0px)); padding: 7px 14px; border-radius: 4px; cursor: pointer;
  font: 600 11px var(--sans); letter-spacing: 0.24em; text-transform: uppercase; color: rgba(240,227,196,0.6);
  background: rgba(28, 18, 12, 0.45); border: none; box-shadow: inset 0 0 0 1px rgba(201, 162, 74, 0.35); transition: color .2s, box-shadow .2s, opacity .6s; }
.oce-skip:hover { color: var(--parch); box-shadow: inset 0 0 0 1px rgba(201, 162, 74, 0.8); }
.oce-end { position: absolute; left: 50%; top: 42%; transform: translate(-50%, -50%); display: flex; flex-direction: column; align-items: center; text-align: center;
  padding: 34px 44px 30px; min-width: min(420px, 90vw); border-radius: 6px; color: var(--ink);
  background: var(--parchment-bg); box-shadow: 0 18px 50px rgba(0,0,0,0.6), inset 0 0 0 1px rgba(110, 75, 35, 0.45), inset 0 0 36px rgba(120, 80, 30, 0.28);
  opacity: 0; transition: opacity 1.2s ease, transform 1.2s ease; }
.oce-end.oce-show { opacity: 1; transform: translate(-50%, -52%); }
.oce-end h2 { margin: 0; font: italic 600 clamp(38px, 4.6vw, 54px)/1 var(--serif); color: var(--ink); }
.oce-end .oce-end-time { margin: 12px 0 4px; font: 600 15px var(--sans); letter-spacing: 0.22em; text-transform: uppercase; color: var(--ink-soft); }
.oce-end .oce-end-sub { margin: 4px 0 22px; font: italic 500 19px/1.35 var(--serif); color: var(--ink-soft); }
.oce-end .oce-end-btns { display: flex; flex-direction: column; gap: 10px; }
.oce-end .oc-title-btn.oc-secondary { color: var(--parch); }
`;

function ensureCss() {
  if (document.getElementById('oce-credits-css')) return;
  const s = document.createElement('style');
  s.id = 'oce-credits-css';
  s.textContent = CSS;
  document.head.appendChild(s);
}

/** Credits roll overlay. `lines` = script credits.lines with {time} already substituted. */
export function createCreditsOverlay(ctx, { lines, time }) {
  ensureCss();
  const el = document.createElement('div');
  el.className = 'oce-credits';
  const rows = lines.map((raw, i) => {
    const t = String(raw);
    if (!t.trim()) return '<div class="oce-line oce-gap"></div>';
    if (i === 0) return `<div class="oce-line oce-title">An <em>Ordinary</em> Cat</div>`;
    if (t.includes(time)) return `<div class="oce-line oce-time">${esc(t)}</div>`;
    const dash = t.indexOf(' — ');
    if (dash > 0) return `<div class="oce-line"><span class="oce-role">${esc(t.slice(0, dash))}</span><span class="oce-name">${esc(t.slice(dash + 3))}</span></div>`;
    return `<div class="oce-line">${esc(t)}</div>`;
  }).join('');
  el.innerHTML = `
    <div class="oce-roll"><div class="oce-track">${rows}</div></div>
    <button class="oce-skip" type="button">Skip ›</button>
    <div class="oce-end" aria-live="polite">
      <h2>You escaped.</h2>
      <div class="oce-end-time">in ${esc(time)}</div>
      <div class="oce-end-sub">Parcel delivered. Signature obtained.</div>
      <div class="oce-end-btns">
        <button class="oc-title-btn" data-act="again" type="button">Play again</button>
        <button class="oc-title-btn oc-secondary" data-act="title" type="button">Back to title</button>
      </div>
    </div>`;
  ctx.ui.appendChild(el);
  const track = el.querySelector('.oce-track');
  const roll = el.querySelector('.oce-roll');
  const skip = el.querySelector('.oce-skip');
  const end = el.querySelector('.oce-end');
  end.style.visibility = 'hidden';

  let anim = null;
  const api = {
    el,
    /** Scroll the roll; resolves when done (or skipped). */
    roll({ pxPerSec = 34 } = {}) {
      const h0 = roll.clientHeight, h1 = track.scrollHeight;
      const dist = h0 + h1;
      anim = track.animate([{ transform: `translate(-50%, ${h0}px)` }, { transform: `translate(-50%, ${-h1}px)` }], { duration: (dist / pxPerSec) * 1000, easing: 'linear', fill: 'forwards' });
      return new Promise((res) => {
        anim.onfinish = res; anim.oncancel = res;
        skip.addEventListener('click', () => { ctx.audio?.play('click'); anim.finish(); }, { once: true });
      });
    },
    /** Show the end card; resolves with 'again' | 'title'. */
    showEnd() {
      skip.style.opacity = '0'; skip.style.pointerEvents = 'none';
      end.style.visibility = '';
      requestAnimationFrame(() => end.classList.add('oce-show'));
      return new Promise((res) => {
        end.addEventListener('click', (e) => {
          const b = e.target.closest('[data-act]');
          if (!b) return;
          ctx.audio?.play('click');
          end.querySelectorAll('button').forEach((x) => { x.disabled = true; });
          res(b.dataset.act);
        });
      });
    },
    dispose() { anim?.cancel(); el.remove(); },
  };
  return api;
}

/** The credits stage: a dark ridge against a dawn horizon, far from the main set. Cat walks along z = 0, y = 0. */
export function buildCreditsStage() {
  const G = new THREE.Group(); G.name = 'creditsStage';
  // horizon: gradient sky with stars fading into a dawn band at the bottom
  const w = 1024, h = 512, c = T.makeCanvas(w, h), g = c.getContext('2d'), r = T.rng(8);
  const gr = g.createLinearGradient(0, 0, 0, h);
  gr.addColorStop(0, '#05081a'); gr.addColorStop(0.45, '#0e1434'); gr.addColorStop(0.7, '#3a2a4a'); gr.addColorStop(0.86, '#b0607a'); gr.addColorStop(0.95, '#ffb98a'); gr.addColorStop(1, '#ffe2b0');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 900; i++) {
    const x = r() * w, y = Math.pow(r(), 1.6) * h * 0.7, m = Math.pow(r(), 3);
    g.fillStyle = `rgba(255,255,255,${(0.25 + m * 0.75) * (1 - y / (h * 0.7))})`;
    g.beginPath(); g.arc(x, y, 0.5 + m * 1.4, 0, Math.PI * 2); g.fill();
  }
  const sun = g.createRadialGradient(w * 0.62, h * 1.02, 0, w * 0.62, h * 1.02, w * 0.4);
  sun.addColorStop(0, 'rgba(255,240,210,0.9)'); sun.addColorStop(0.25, 'rgba(255,190,130,0.35)'); sun.addColorStop(1, 'rgba(255,170,120,0)');
  g.fillStyle = sun; g.fillRect(0, 0, w, h);
  const skyTex = T.canvasTexture(c);
  const sky = new THREE.Mesh(new THREE.PlaneGeometry(36, 18), new THREE.MeshBasicMaterial({ map: skyTex, fog: false, toneMapped: false, color: new THREE.Color(0.85, 0.85, 0.85) }));
  sky.position.set(0, 6.4, -14);
  G.add(sky);
  // far hills silhouettes
  const hills = (z, y0, amp, color, seed) => {
    const shape = new THREE.Shape();
    const rr = T.rng(seed);
    shape.moveTo(-24, -2);
    for (let x = -24; x <= 24; x += 0.5) shape.lineTo(x, y0 + amp * (0.5 + 0.5 * Math.sin(x * 0.35 + seed)) + rr() * 0.05);
    shape.lineTo(24, -2);
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), new THREE.MeshBasicMaterial({ color, fog: false }));
    m.position.z = z;
    G.add(m);
  };
  hills(-12, -0.2, 0.9, '#2a1d33', 3);
  hills(-8, -0.4, 0.5, '#170f1e', 9);
  // the ridge the cat walks on: a dark rounded slab, lit from behind
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(30, 1, 3), new THREE.MeshStandardMaterial({ color: '#191320', roughness: 0.95 }));
  ridge.position.set(0, -0.5, -0.6); ridge.receiveShadow = true;
  G.add(ridge);
  // grass tufts along the ridge edge, for a soft silhouette line
  const tufts = new THREE.Group();
  const tuftM = new THREE.MeshStandardMaterial({ color: '#120d16', roughness: 1 });
  for (let i = 0; i < 160; i++) {
    const b = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.06 + Math.random() * 0.08, 4), tuftM);
    b.position.set(-12 + Math.random() * 24, 0.03, -0.9 + Math.random() * 0.5);
    b.rotation.z = (Math.random() - 0.5) * 0.5;
    tufts.add(b);
  }
  G.add(tufts);
  // lights: warm rim from the horizon, cool fill from the front, a soft key
  G.add(new THREE.HemisphereLight('#3a4a8a', '#0a0610', 0.6));
  const rim = new THREE.DirectionalLight('#ffbf8a', 3.4);
  rim.position.set(1.5, 1.2, -6); rim.target.position.set(0, 0.2, 0);
  G.add(rim, rim.target);
  const fill = new THREE.DirectionalLight('#8aa0ff', 0.55);
  fill.position.set(-2, 2, 5);
  G.add(fill);
  const key = new THREE.SpotLight('#ffe0b8', 6, 10, 0.5, 0.9, 1.2);
  key.position.set(0, 3, 2.5); key.target.position.set(0, 0, 0);
  G.add(key, key.target);
  // drifting fireflies / motes
  G.add(P.dustMotes({ box: [8, 2.4, 2], center: [0, 1.2, -0.8], count: 90, color: '#ffd9a0', size: 0.03, opacity: 0.7 }));
  return G;
}
