// The cauldron, its burner, the paddle, and the self-filling elixir flask (R2-P4).
import * as THREE from 'three';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as L from '../../engine/props/lights.js';
import { CAULDRON } from './set.js';
import { physGlass, softDot } from './util.js';

export const LIQ = {
  cold: { c1: '#2f4844', c2: '#4d6a66', glow: 0.25 },
  clear: { c1: '#2f9a82', c2: '#86e0c8', glow: 0.55 },
  jar_fish: { c1: '#4f86d0', c2: '#b4d8ff', glow: 0.7 },
  jar_moon: { c1: '#8462d4', c2: '#d0bcff', glow: 0.72 },
  jar_dawn: { c1: '#dc6a46', c2: '#ffbe7c', glow: 0.78 },
  bruise: { c1: '#4a1676', c2: '#c060f0', glow: 1.6 },
};
export const ORDER = ['jar_fish', 'jar_moon', 'jar_dawn'];

const liqVert = /* glsl */`varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`;
const liqFrag = /* glsl */`
  uniform float uTime; uniform float uSwirl; uniform float uGlow; uniform float uBoil;
  uniform vec3 uColor; uniform vec3 uColor2;
  varying vec2 vUv;
  float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p){ vec2 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
    return mix(mix(hash(i), hash(i+vec2(1,0)), f.x), mix(hash(i+vec2(0,1)), hash(i+vec2(1,1)), f.x), f.y); }
  void main(){
    vec2 p = vUv - 0.5;
    float r = length(p) * 2.0;
    float a = atan(p.y, p.x);
    float spin = uTime * (0.15 + uSwirl * 3.5);
    float tw = a + spin + r * (1.5 + uSwirl * 9.0);
    vec2 q = vec2(cos(tw), sin(tw)) * r;
    float n = noise(q * 3.0 + uTime * 0.25) * 0.6 + noise(q * 7.0 - uTime * 0.4) * 0.4;
    float bands = 0.5 + 0.5 * sin(tw * 3.0 + n * 4.0);
    vec3 col = mix(uColor, uColor2, smoothstep(0.35, 1.0, bands * n * 1.6) * (0.35 + uSwirl * 0.6));
    // foam / boil specks
    float boil = smoothstep(0.82, 0.95, noise(p * 26.0 + vec2(uTime * 0.7, -uTime * 0.5))) * uBoil;
    col += uColor2 * boil * 0.6;
    float centre = 1.0 - smoothstep(0.0, 1.0, r) * 0.45;
    float rim = smoothstep(0.86, 1.0, r);
    col *= centre;
    col = mix(col, col * 0.35, rim);
    gl_FragColor = vec4(col * uGlow, 1.0);
  }`;

export function buildCauldron(room) {
  const { ctx } = room;
  const G = room.group;
  const root = new THREE.Group(); root.name = 'cauldron';
  root.position.set(CAULDRON.x, 0, CAULDRON.z);
  G.add(root);
  const iron = M.iron({ color: '#2e2d2b', roughness: 0.55 });
  const ironDark = M.iron({ color: '#1e1d1c', roughness: 0.7 });

  // --- burner stand
  const stand = new THREE.Group();
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.36, 0.025, 10, 40), ironDark); ring.rotation.x = Math.PI / 2; ring.position.y = 0.36; stand.add(ring);
  for (let i = 0; i < 4; i++) {
    const a = (i / 4) * Math.PI * 2 + Math.PI / 4;
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.03, 0.38, 8), ironDark);
    leg.position.set(Math.cos(a) * 0.38, 0.19, Math.sin(a) * 0.38); leg.rotation.set(Math.sin(a) * -0.06, 0, Math.cos(a) * 0.06); stand.add(leg);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), ironDark); foot.position.set(Math.cos(a) * 0.39, 0, Math.sin(a) * 0.39); stand.add(foot);
  }
  // burner ring (gas)
  const burnerRing = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.022, 10, 36), M.brass({ color: '#9a7a3a' })); burnerRing.rotation.x = Math.PI / 2; burnerRing.position.y = 0.12; stand.add(burnerRing);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.12, 14), M.brass({ color: '#9a7a3a' })); hub.position.y = 0.06; stand.add(hub);
  for (let i = 0; i < 3; i++) { const sp = new THREE.Mesh(new THREE.CylinderGeometry(0.01, 0.01, 0.2, 6), M.brass({ color: '#9a7a3a' })); const a = (i / 3) * Math.PI * 2; sp.rotation.z = Math.PI / 2; sp.rotation.y = -a; sp.position.set(Math.cos(a) * 0.1, 0.12, Math.sin(a) * 0.1); stand.add(sp); }
  F.shadowAll(stand);
  root.add(stand);

  // flames (blue), off until lit
  const flames = new THREE.Group(); flames.position.y = 0.135;
  const outerM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#2f7cff').multiplyScalar(2.2), transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const innerM = new THREE.MeshBasicMaterial({ color: new THREE.Color('#bfe4ff').multiplyScalar(1.6), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false });
  const fgo = new THREE.ConeGeometry(0.022, 0.12, 8, 1, true); fgo.translate(0, 0.06, 0);
  const fgi = new THREE.ConeGeometry(0.011, 0.06, 6, 1, true); fgi.translate(0, 0.03, 0);
  // 16 flame jets as two instanced meshes (2 draw calls instead of 32)
  const jets = [];
  const NJ = 16;
  const jetOuter = new THREE.InstancedMesh(fgo, outerM, NJ), jetInner = new THREE.InstancedMesh(fgi, innerM, NJ);
  for (const im of [jetOuter, jetInner]) { im.raycast = () => {}; im.castShadow = false; im.frustumCulled = false; im.userData.dynamic = true; flames.add(im); }
  for (let i = 0; i < NJ; i++) {
    const a = (i / NJ) * Math.PI * 2;
    const j = new THREE.Object3D(); j.position.set(Math.cos(a) * 0.2, 0, Math.sin(a) * 0.2); j.rotation.set(Math.sin(a) * 0.25, 0, -Math.cos(a) * 0.25);
    jets.push(j);
  }
  const flameHalo = new THREE.Sprite(new THREE.SpriteMaterial({ map: softDot(), color: new THREE.Color('#3a7cff'), transparent: true, opacity: 0.0, blending: THREE.AdditiveBlending, depthWrite: false }));
  flameHalo.scale.set(0.9, 0.35, 1); flameHalo.position.y = 0.08; flameHalo.raycast = () => {};
  flames.add(flameHalo);
  flames.scale.setScalar(0.001); flames.visible = false; flames.userData.dynamic = true;
  root.add(flames);
  const burnerLight = new THREE.PointLight('#4a8cff', 0, 2.8, 2); burnerLight.position.y = 0.25; root.add(burnerLight);

  // --- the pot
  const pot = new THREE.Group(); pot.position.y = 0.36; root.add(pot);
  const prof = [[0.0, 0.0], [0.22, 0.0], [0.36, 0.06], [0.45, 0.18], [0.485, 0.33], [0.47, 0.47], [0.43, 0.56], [0.43, 0.6], [0.465, 0.615], [0.47, 0.645], [0.44, 0.655],
    [0.41, 0.64], [0.405, 0.58], [0.44, 0.47], [0.455, 0.33], [0.42, 0.19], [0.33, 0.08], [0.0, 0.05]];
  const body = F.lathe(prof, iron, 48); pot.add(body);
  const band = new THREE.Mesh(new THREE.TorusGeometry(0.487, 0.012, 8, 48), ironDark); band.rotation.x = Math.PI / 2; band.position.y = 0.33; pot.add(band);
  for (const s of [-1, 1]) {
    const lug = new THREE.Mesh(new THREE.TorusGeometry(0.07, 0.014, 8, 20), ironDark); lug.position.set(s * 0.49, 0.5, 0); lug.rotation.y = Math.PI / 2; pot.add(lug);
    const boss = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), ironDark); boss.position.set(s * 0.47, 0.56, 0); pot.add(boss);
  }
  F.shadowAll(pot);
  const RIM_Y = 0.36 + 0.655;
  const SURF_Y = 0.36 + 0.585;

  // --- liquid
  const liqMat = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 }, uSwirl: { value: 0 }, uGlow: { value: 1 }, uBoil: { value: 0 }, uColor: { value: new THREE.Color(LIQ.cold.c1) }, uColor2: { value: new THREE.Color(LIQ.cold.c2) } },
    vertexShader: liqVert, fragmentShader: liqFrag, toneMapped: false,
  });
  const liquid = new THREE.Mesh(new THREE.CircleGeometry(0.418, 48), liqMat);
  liquid.rotation.x = -Math.PI / 2; liquid.position.y = SURF_Y;
  root.add(liquid);
  // blorps: little domes that swell and pop
  const blorpMat = new THREE.MeshBasicMaterial({ color: '#ffffff', transparent: true, opacity: 0.55, toneMapped: false });
  const blorpGeo = new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2);
  const blorps = [];
  for (let i = 0; i < 6; i++) {
    const b = new THREE.Mesh(blorpGeo, blorpMat); b.raycast = () => {}; b.userData.dynamic = true;
    b.position.y = SURF_Y; b.userData.phase = Math.random(); b.userData.speed = 0.35 + Math.random() * 0.4;
    root.add(b); blorps.push(b);
  }
  const bubbles = P.bubbles({ origin: [0, SURF_Y, 0], radius: 0.34, rise: 0.08, count: 60, size: 0.035, color: '#e0fff6', opacity: 0.0 });
  root.add(bubbles);
  const steam = P.embers({ origin: [0, SURF_Y + 0.02, 0], spread: 0.28, rise: 1.6, count: 36, color: '#8fc8b8', color2: '#d0f0e8', size: 0.22, opacity: 0.0 });
  root.add(steam);
  const column = L.lightShaft({ from: [0, SURF_Y + 0.02, 0], to: [0, SURF_Y + 1.1, 0], radiusTop: 0.4, radiusBottom: 0.28, color: '#7fd0bc', opacity: 0.0, square: false });
  root.add(column);
  const potLight = new THREE.PointLight('#7fd0bc', 0, 3.2, 2); potLight.position.y = SURF_Y + 0.35; root.add(potLight);

  // --- paddle
  const paddlePivot = new THREE.Group(); paddlePivot.position.y = SURF_Y; paddlePivot.userData.dynamic = true; root.add(paddlePivot);
  const paddle = new THREE.Group();
  const pw = M.oak({ tint: '#9a7448' });
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.022, 1.15, 10), pw); shaft.position.y = 0.32; paddle.add(shaft);
  const blade = F.rbox(0.1, 0.32, 0.022, pw, 0.01); blade.position.y = -0.3; paddle.add(blade);
  const knob = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), pw); knob.position.y = 0.9; paddle.add(knob);
  F.shadowAll(paddle);
  paddle.position.set(0.18, 0, 0.12); paddle.rotation.set(0.28, 0, -0.42);
  paddlePivot.add(paddle);
  paddlePivot.rotation.y = 0.6;
  const paddleProxy = ctx.hotspots.proxyBox(0.16, 1.0, 0.16); paddleProxy.position.y = 0.45; paddle.add(paddleProxy);

  // --- elixir flask on the stool
  const flask = new THREE.Group(); flask.name = 'elixirFlask';
  flask.position.set(0.85 - CAULDRON.x, 0.62, -0.25 - CAULDRON.z);
  const fprof = [[0, 0.002], [0.03, 0], [0.058, 0.03], [0.062, 0.06], [0.045, 0.1], [0.018, 0.125], [0.016, 0.19], [0.02, 0.195]];
  const fglass = F.lathe(fprof, physGlass({ color: '#f4eaff', opacity: 0.3 }), 28); fglass.castShadow = false; flask.add(fglass);
  const fLiqMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(LIQ.bruise.c2).multiplyScalar(1.4), toneMapped: false });
  const fliq = F.lathe([[0, 0.006], [0.026, 0.006], [0.05, 0.032], [0.054, 0.06], [0.04, 0.095], [0, 0.095]], fLiqMat, 24); fliq.castShadow = false;
  fliq.scale.y = 0.001; fliq.visible = false; fliq.userData.dynamic = true; flask.add(fliq);
  const fcork = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.014, 0.025, 10), M.matte('#a88058')); fcork.position.y = 0.2; flask.add(fcork);
  const ftag = new THREE.Mesh(new THREE.PlaneGeometry(0.04, 0.025), M.parchment()); ftag.position.set(0.03, 0.15, 0.02); ftag.rotation.set(0, 0.6, -0.4); flask.add(ftag);
  root.add(flask);
  const flaskSpark = P.sparkles({ box: [0.16, 0.24, 0.16], center: [flask.position.x, flask.position.y + 0.1, flask.position.z], count: 20, color: '#e0b0ff', color2: '#ffffff', size: 0.03, opacity: 0 });
  root.add(flaskSpark);

  // ---------------------------------------------------------------- state & animation
  const c1 = new THREE.Color(), c2 = new THREE.Color();
  const cur = { c1: new THREE.Color(LIQ.cold.c1), c2: new THREE.Color(LIQ.cold.c2), glow: LIQ.cold.glow, lit: 0, swirl: 0, solved: false };
  let litTarget = 0;
  let lookToken = 0;
  const api = {
    root, liquid, paddle, paddleProxy, flask, fliq, RIM_Y, SURF_Y,
    surfaceWorld: () => root.localToWorld(new THREE.Vector3(0, SURF_Y, 0)),
    setLit(lit, animate) {
      litTarget = lit ? 1 : 0;
      flames.visible = true;
      if (!animate) cur.lit = litTarget;
    },
    /** Set the liquid look. spec: { c1, c2, glow } */
    setLook(spec, duration = 0) {
      const token = ++lookToken; // a newer look always wins over an older, still-running tween
      const from = { a: cur.c1.clone(), b: cur.c2.clone(), g: cur.glow };
      const to = { a: new THREE.Color(spec.c1), b: new THREE.Color(spec.c2), g: spec.glow };
      if (!duration) { cur.c1.copy(to.a); cur.c2.copy(to.b); cur.glow = to.g; return Promise.resolve(); }
      return ctx.tween.run(duration, (k) => { if (token !== lookToken) return; cur.c1.copy(from.a).lerp(to.a, k); cur.c2.copy(from.b).lerp(to.b, k); cur.glow = from.g + (to.g - from.g) * k; }, { ease: 'inOutSine' });
    },
    /** Look for a list of ingredient adds (mixing tints). */
    lookFor(adds, lit) {
      if (!lit) return LIQ.cold;
      let a = new THREE.Color(LIQ.clear.c1), b = new THREE.Color(LIQ.clear.c2), g = LIQ.clear.glow;
      for (const id of adds) { const s = LIQ[id]; if (!s) continue; a.lerp(new THREE.Color(s.c1), 0.68); b.lerp(new THREE.Color(s.c2), 0.68); g = g * 0.4 + s.glow * 0.6; }
      return { c1: '#' + a.getHexString(), c2: '#' + b.getHexString(), glow: g };
    },
    async stir(seconds = 2.6) {
      const p = ctx.tween.to(paddlePivot.rotation, { y: paddlePivot.rotation.y + Math.PI * 2 * 3 }, { duration: seconds, ease: 'inOutSine' });
      await ctx.tween.run(seconds, (k) => { cur.swirl = Math.sin(k * Math.PI); });
      await p;
      cur.swirl = 0;
    },
    setSolvedGlow(on) { cur.solved = on; },
    showFlaskFull(full) { fliq.visible = full; fliq.scale.y = full ? 1 : 0.001; flaskSpark.userData.setOpacity(full ? 1 : 0); },
    async fillFlask() {
      fliq.visible = true;
      ctx.audio.play('pour', { gain: 0.6 });
      flaskSpark.userData.setOpacity(1);
      await ctx.tween.to(fliq.scale, { y: 1 }, { duration: 1.6, ease: 'inOutSine' });
      ctx.audio.play('sparkle');
    },
    hideFlask() { flask.visible = false; flaskSpark.visible = false; },
  };

  root.userData.update = (dt, t) => {
    cur.lit += (litTarget - cur.lit) * Math.min(1, dt * 2.5);
    const L1 = cur.lit;
    // flames
    flames.scale.setScalar(Math.max(0.001, L1));
    flames.visible = L1 > 0.01;
    if (flames.visible) {
      for (let i = 0; i < jets.length; i++) {
        const j = jets[i]; j.scale.y = 0.75 + 0.35 * Math.sin(t * 17 + i * 1.7) * Math.sin(t * 7.3 + i); j.updateMatrix();
        jetOuter.setMatrixAt(i, j.matrix); jetInner.setMatrixAt(i, j.matrix);
      }
      jetOuter.instanceMatrix.needsUpdate = jetInner.instanceMatrix.needsUpdate = true;
    }
    flameHalo.material.opacity = 0.55 * L1;
    burnerLight.intensity = L1 * (3.2 + Math.sin(t * 23) * 0.25 + Math.sin(t * 9) * 0.2);
    // liquid
    const pulse = cur.solved ? 0.18 * Math.sin(t * 2.2) : 0;
    liqMat.uniforms.uTime.value = t;
    liqMat.uniforms.uSwirl.value = cur.swirl;
    liqMat.uniforms.uGlow.value = cur.glow * (1 + pulse);
    liqMat.uniforms.uBoil.value = L1;
    liqMat.uniforms.uColor.value.copy(cur.c1);
    liqMat.uniforms.uColor2.value.copy(cur.c2);
    c1.copy(cur.c1).lerp(cur.c2, 0.4);
    blorpMat.color.copy(c1).multiplyScalar(cur.glow * 1.2);
    for (const b of blorps) {
      const ph = (b.userData.phase + t * b.userData.speed) % 1;
      if (ph < b.userData.last) { const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 0.32; b.position.x = Math.cos(a) * r; b.position.z = Math.sin(a) * r; }
      b.userData.last = ph;
      const s = L1 * Math.sin(ph * Math.PI) * (0.02 + 0.025 * b.userData.speed) * (1 + cur.swirl);
      b.scale.set(s, s * 0.7, s);
      b.visible = s > 0.002;
    }
    bubbles.userData.setOpacity(0.75 * L1);
    bubbles.material.uniforms.uColor.value.copy(cur.c2);
    steam.userData.setOpacity((0.08 + 0.1 * cur.swirl + (cur.solved ? 0.06 : 0)) * L1);
    steam.material.uniforms.uColor.value.copy(c1).multiplyScalar(0.8);
    steam.material.uniforms.uColor2.value.copy(cur.c2).multiplyScalar(0.7);
    column.userData.setOpacity((0.05 + 0.08 * cur.swirl + (cur.solved ? 0.12 : 0)) * Math.max(0.25, L1) * cur.glow);
    column.material.uniforms.uColor.value.copy(c1);
    column.userData.update(dt, t);
    potLight.color.copy(c1);
    potLight.intensity = (0.4 + cur.glow * 1.3 * (1 + pulse * 2) + cur.swirl * 1.5) * Math.max(0.2, L1);
    c2.set(0);
  };

  return api;
}
