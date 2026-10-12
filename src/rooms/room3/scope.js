// Room 3 — the view through the telescope eyepiece.
// A small group parked right in front of the eyepiece camera pose. Everything in it draws on top of the room
// (depthTest off, high renderOrder) and a shader vignette masks it to a circle. Drag to pan the field.
import * as THREE from 'three';
import { starfieldTexture, rng } from '../../engine/props/textures.js';
import { starPoints, randomStar, moonTextures, moonMesh } from './sky.js';
import { FELIS, FELIS_TAIL, FELIS_AT, OTHERS, drawGlyph, tex } from './art.js';

const FIELD_W = 3.6, FIELD_H = 2.4;      // sky field extent (local units, field plane at z = -1)
const VIEW_R = 0.33;                      // viewport radius at the field plane
const PAN_X = 1.4, PAN_Y = 0.8;           // clamp for the view centre
const FELIS_SCALE = 0.72;
const RO = 100;                           // base renderOrder

const vignetteFrag = /* glsl */`
  uniform float uR; uniform float uFade;
  varying vec2 vUv;
  void main(){
    vec2 p = (vUv - 0.5) * 3.0;            // plane is 3x3 units
    float d = length(p);
    float a = smoothstep(uR * 0.9, uR * 1.005, d);
    // a thin brass rim and faint reticle ticks
    float rim = smoothstep(0.012, 0.0, abs(d - uR * 1.01)) * 0.55;
    float tick = 0.0;
    if (d > uR * 0.86 && d < uR * 0.97) tick = max(smoothstep(0.0025, 0.0, abs(p.x)), smoothstep(0.0025, 0.0, abs(p.y))) * 0.35;
    vec3 col = vec3(0.79, 0.62, 0.29) * rim + vec3(0.7, 0.8, 1.0) * tick;
    float alpha = max(a, max(rim, tick));
    gl_FragColor = vec4(mix(col, vec3(0.0), a) , max(alpha, 1.0 - uFade));
  }`;
const vignetteVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;

function segLines(points, { color = '#ffe7b0', glow = 1.5, width = 0.0042, ro = RO + 2 } = {}) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(glow), transparent: true, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false });
  const segs = [];
  let total = 0;
  for (let i = 0; i < points.length - 1; i++) {
    const a = new THREE.Vector2(...points[i]), b = new THREE.Vector2(...points[i + 1]);
    const len = a.distanceTo(b);
    if (len < 1e-4) continue;
    const geo = new THREE.PlaneGeometry(1, width);
    geo.translate(0.5, 0, 0);
    const m = new THREE.Mesh(geo, mat);
    m.position.set(a.x, a.y, 0.002);
    m.rotation.z = Math.atan2(b.y - a.y, b.x - a.x);
    m.scale.x = 0.0001;
    m.renderOrder = ro;
    m.raycast = () => {};
    g.add(m);
    segs.push({ m, len, start: total });
    total += len;
  }
  g.userData.mat = mat;
  g.userData.setProgress = (k) => {
    const L = k * total;
    for (const s of segs) {
      const f = THREE.MathUtils.clamp((L - s.start) / s.len, 0, 1);
      s.m.scale.x = Math.max(0.0001, f * s.len);
      s.m.visible = f > 0;
    }
  };
  return g;
}

export class ScopeView {
  constructor(ctx) {
    this.ctx = ctx;
    const g = this.group = new THREE.Group();
    g.name = 'r3.scopeView';
    g.visible = false;
    g.scale.setScalar(0.1);
    this.offset = new THREE.Vector2(0, 0);

    // pannable sky field
    const field = this.field = new THREE.Group();
    field.position.z = -1;
    g.add(field);
    const bgTex = starfieldTexture({ w: 2048, h: 1365, count: 3200, seed: 404, band: true, bg: '#03040b' });
    const bg = new THREE.Mesh(new THREE.PlaneGeometry(FIELD_W + 1.2, FIELD_H + 1.0), new THREE.MeshBasicMaterial({ map: bgTex, depthTest: false, fog: false, color: new THREE.Color(1.05, 1.08, 1.25) }));
    bg.renderOrder = RO;
    bg.raycast = () => {}; bg.userData.noRaycast = true;
    field.add(bg);

    // thousands of twinkling stars
    const r = rng(808);
    const stars = [];
    for (let i = 0; i < 2600; i++) {
      const s = randomStar(r);
      s.size *= 1.35;
      stars.push({ p: [(r() - 0.5) * (FIELD_W + 1.0), (r() - 0.5) * (FIELD_H + 0.8), 0.001], ...s });
    }
    // milky band diagonal
    for (let i = 0; i < 1800; i++) {
      const u = (r() - 0.5) * (FIELD_W + 1.0);
      const off = (r() + r() + r() - 1.5) * 0.28;
      const s = randomStar(r); s.color = s.color.map((c) => c * 0.55); s.size *= 0.9;
      stars.push({ p: [u, u * 0.35 - 0.15 + off, 0.001], ...s });
    }
    // constellation stars (brighter)
    const constStar = (x, y, b = 2.0, size = 6.5) => stars.push({ p: [x, y, 0.003], size, color: [b, b * 0.97, b * 0.9], seed: r() });
    const felisPts = [...FELIS.slice(0, -1), ...FELIS_TAIL.slice(1)].map(([x, y]) => [FELIS_AT[0] + x * FELIS_SCALE, FELIS_AT[1] + y * FELIS_SCALE]);
    felisPts.forEach(([x, y]) => constStar(x, y, 2.4, 7.5));
    for (const o of OTHERS) {
      const seen = new Set();
      for (const [x, y] of o.pts) { const k = `${x},${y}`; if (seen.has(k)) continue; seen.add(k); constStar(o.at[0] + x, o.at[1] + y, 1.7, 6); }
    }
    const pts = this.points = starPoints(stars, { scale: 1, depthTest: false, renderOrder: RO + 1 });
    field.add(pts);

    // Felis lines
    const fl = (arr) => arr.map(([x, y]) => [FELIS_AT[0] + x * FELIS_SCALE, FELIS_AT[1] + y * FELIS_SCALE]);
    this.felisLines = [segLines(fl(FELIS)), segLines(fl(FELIS_TAIL))];
    this.felisLines.forEach((l) => { l.userData.setProgress(0); field.add(l); });
    // others: faint lines that draw when centred
    this.others = OTHERS.map((o) => {
      const lines = segLines(o.pts.map(([x, y]) => [o.at[0] + x, o.at[1] + y]), { color: '#a9c4ff', glow: 0.9, width: 0.004 });
      lines.userData.setProgress(0);
      field.add(lines);
      return { ...o, lines, shown: false };
    });

    // moon (clickable, winks)
    this.moonTex = moonTextures();
    const moon = this.moon = moonMesh(0.13, this.moonTex[0], { depthTest: false, intensity: 1.5 });
    moon.renderOrder = RO + 3;
    moon.position.set(-0.55, -0.12, 0.01);
    field.add(moon);
    this.moonHome = moon.position.clone();
    this.moonUnderFelis = new THREE.Vector3(FELIS_AT[0] + 0.0, FELIS_AT[1] - 0.2, 0.01);

    // faint glyph of the planet configuration (upper-left of Felis, inside the viewport)
    const glyph = this.glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.16), new THREE.MeshBasicMaterial({ map: tex(drawGlyph(512)), transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glyph.position.set(FELIS_AT[0] - 0.19, FELIS_AT[1] + 0.12, 0.004);
    glyph.renderOrder = RO + 2;
    glyph.raycast = () => {}; glyph.userData.noRaycast = true;
    field.add(glyph);

    // drag surface (fixed, invisible but raycastable when active)
    const drag = this.dragProxy = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), new THREE.MeshBasicMaterial({ visible: false }));
    drag.position.z = -1.001;
    g.add(drag);

    // vignette mask
    const vmat = this.vmat = new THREE.ShaderMaterial({
      uniforms: { uR: { value: VIEW_R * 0.97 }, uFade: { value: 1 } },
      vertexShader: vignetteVert, fragmentShader: vignetteFrag,
      transparent: true, depthTest: false, depthWrite: false, fog: false,
    });
    const mask = new THREE.Mesh(new THREE.PlaneGeometry(3, 3), vmat);
    mask.position.z = -0.97;
    mask.renderOrder = RO + 10;
    mask.raycast = () => {}; mask.userData.noRaycast = true;
    g.add(mask);

    // final: a faint twinkle at the eyepiece edge pointing toward Felis while it is out of view
    const gc = document.createElement('canvas'); gc.width = gc.height = 64;
    const gg = gc.getContext('2d');
    const rad = gg.createRadialGradient(32, 32, 0, 32, 32, 32);
    rad.addColorStop(0, 'rgba(255,248,225,1)'); rad.addColorStop(0.18, 'rgba(255,230,170,0.55)'); rad.addColorStop(1, 'rgba(255,210,140,0)');
    gg.fillStyle = rad; gg.fillRect(0, 0, 64, 64);
    gg.fillStyle = 'rgba(255,245,215,0.9)';
    gg.beginPath(); gg.moveTo(32, 2); gg.lineTo(34, 30); gg.lineTo(62, 32); gg.lineTo(34, 34); gg.lineTo(32, 62); gg.lineTo(30, 34); gg.lineTo(2, 32); gg.lineTo(30, 30); gg.closePath(); gg.fill();
    const gt = new THREE.CanvasTexture(gc); gt.colorSpace = THREE.SRGBColorSpace;
    const glim = this.glimmer = new THREE.Mesh(new THREE.PlaneGeometry(0.06, 0.06), new THREE.MeshBasicMaterial({ map: gt, transparent: true, opacity: 0, depthTest: false, depthWrite: false, blending: THREE.AdditiveBlending, fog: false }));
    glim.position.z = -0.985;
    glim.renderOrder = RO + 5;
    glim.raycast = () => {}; glim.userData.noRaycast = true;
    g.add(glim);
    this.cueEnabled = true;

    this._lastOther = -1;
    this._moonWink = 0;
  }

  /** Park the view in front of a camera pose. */
  place(camPos, lookAt) {
    const m = new THREE.Matrix4().lookAt(camPos, lookAt, new THREE.Vector3(0, 1, 0));
    this.group.quaternion.setFromRotationMatrix(m);
    this.group.position.copy(camPos);
  }

  setOffset(x, y) {
    this.offset.set(THREE.MathUtils.clamp(x, -PAN_X, PAN_X), THREE.MathUtils.clamp(y, -PAN_Y, PAN_Y));
    this.field.position.x = this.offset.x;
    this.field.position.y = this.offset.y;
  }

  /** px→field units for a drag delta */
  dragBy(dx, dy) {
    const fov = this.ctx.camera.camera.fov * Math.PI / 180;
    const k = (2 * Math.tan(fov / 2) * 0.97) / Math.max(1, window.innerHeight);
    this.setOffset(this.offset.x + dx * k, this.offset.y - dy * k);
  }

  /** Distance from the viewport centre to Felis' centre, in field units. */
  felisDist() { return Math.hypot(FELIS_AT[0] + this.offset.x, FELIS_AT[1] + this.offset.y); }

  /** Which silly constellation (index into OTHERS) is near the centre, or -1. */
  otherAtCentre(radius = 0.14) {
    let best = -1, bd = radius;
    this.others.forEach((o, i) => { const d = Math.hypot(o.at[0] + this.offset.x, o.at[1] + this.offset.y); if (d < bd) { bd = d; best = i; } });
    return best;
  }

  felisTarget() { return new THREE.Vector2(-FELIS_AT[0], -FELIS_AT[1] + 0.06); }

  /** Solved visuals instantly (restore from state). */
  showSolved() {
    this.cueEnabled = false;
    this.felisLines.forEach((l) => l.userData.setProgress(1));
    this.moon.position.copy(this.moonUnderFelis);
    this.glyph.material.opacity = 0.8;
  }

  wink() {
    this.moon.material.map = this.moonTex[1];
    this._moonWink = 0.7;
  }

  update(dt, t) {
    if (!this.group.visible) return;
    this.points.userData.update(dt, t);
    if (this._moonWink > 0) {
      this._moonWink -= dt;
      if (this._moonWink <= 0) this.moon.material.map = this.moonTex[0];
    }
    this.glyph.material.color.setScalar(0.85 + 0.15 * Math.sin(t * 1.7));
    // Felis cue: only while Felis is outside the eyepiece; a soft twinkle every ~3.5 s
    const fx = FELIS_AT[0] + this.offset.x, fy = FELIS_AT[1] + this.offset.y, fd = Math.hypot(fx, fy);
    const want = this.cueEnabled && fd > VIEW_R * 0.95;
    const m = this.glimmer.material;
    if (want) {
      const rr = VIEW_R * 0.84;
      this.glimmer.position.x = (fx / fd) * rr; this.glimmer.position.y = (fy / fd) * rr;
      const ph = (t % 3.5) / 3.5;
      const tw = ph < 0.3 ? Math.sin((ph / 0.3) * Math.PI) : 0;
      m.opacity = 0.1 + 0.32 * tw;
      this.glimmer.rotation.z = t * 0.4;
      this.glimmer.scale.setScalar(0.8 + 0.4 * tw);
    } else m.opacity = Math.max(0, m.opacity - dt * 2);
  }
}
