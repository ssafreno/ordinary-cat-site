// ROOM 2 — THE LABORATORY (DESIGN §5). Valves → recipe → scale → cauldron, then up the spiral stair.
// Helpers: set.js (dressing), valves.js (R2-P1), jars.js (R2-P2), scale.js (R2-P3), cauldron.js (R2-P4),
// stairs.js (gate + missing step), vials.js (instanced glass notes), lines.js (room-local extra lines).
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as P from '../../engine/props/particles.js';
import * as T from '../../engine/props/textures.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { buildSet, BENCH, SHELF, shelfTop, WINDOW, CAULDRON, ALEMBIC } from './set.js';
import { buildValves } from './valves.js';
import { buildCauldron, LIQ, ORDER } from './cauldron.js';
import { buildCase, buildDrawers, CASE } from './scale.js';
import { buildStairs } from './stairs.js';
import { buildJars, jarSlots } from './jars.js';
import { vialSet, scatterSpecs } from './vials.js';
import { weightMesh, smokePuff, mergeStatic } from './util.js';
import { R2_LINES } from './lines.js';

const CAT_SPOT = { position: [SHELF.x - 0.62, shelfTop(5), SHELF.z + 0.02], rotationY: 1.25, pose: 'loaf' };
const JAR_ITEMS = { fish: 'jar_fish', moon: 'jar_moon', dawn: 'jar_dawn' };

function makeChalkTexture() {
  const W = 1536, H = 972;
  const base = T.chalkboardTexture({
    w: W, h: H, size: 50, padding: 90, seed: 14, title: 'ELIXIR OF REVERSION',
    lines: [
      { text: 'i.    A scale from the one that never shuts its eyes', erase: 0.08 },
      { text: 'ii.   Three drops of what the moon left on the sill', erase: 0.06 },
      { text: 'iii.  A pinch of what the dawn is made of' },
      { text: '' },
      { text: 'Stir until the colour of a bruise at dusk.', erase: 0.22, align: 'center' },
    ],
  });
  const c = T.makeCanvas(W, H), g = c.getContext('2d');
  g.drawImage(base.image, 0, 0);
  const chalk = (fn, alpha = 0.55, width = 4, color = '#eef0e6') => { g.save(); g.globalAlpha = alpha; g.strokeStyle = color; g.fillStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; fn(); g.restore(); };
  // a fish in the margin (somebody drew it)
  chalk(() => {
    g.translate(1330, 800);
    g.beginPath(); g.ellipse(0, 0, 70, 32, 0, 0, Math.PI * 2); g.stroke();
    g.beginPath(); g.moveTo(66, 0); g.lineTo(118, -30); g.lineTo(112, 30); g.closePath(); g.stroke();
    g.beginPath(); g.arc(-38, -6, 7, 0, Math.PI * 2); g.fill();
    g.beginPath(); g.arc(-38, -6, 13, 0, Math.PI * 2); g.stroke(); // wide open: it never shuts its eyes
    for (let i = 0; i < 3; i++) { g.beginPath(); g.arc(-5 + i * 22, 2, 14, -0.9, 0.9); g.stroke(); }
  }, 0.5, 4);
  // crossed-out fourth line
  chalk(() => {
    g.font = '600 38px "Cormorant Garamond", Georgia, serif';
    g.fillText('iv.  one cat hair (fresh)', 110, 700);
    g.lineWidth = 5; g.beginPath(); g.moveTo(100, 690); g.lineTo(560, 684); g.stroke();
    g.beginPath(); g.moveTo(100, 700); g.lineTo(560, 702); g.stroke();
  }, 0.4, 4);
  // arithmetic in the corner and a small moon
  chalk(() => {
    g.font = 'italic 600 34px "Cormorant Garamond", Georgia, serif';
    g.fillText('7 — the only honest number', 980, 120);
    g.beginPath(); g.arc(120, 120, 34, 0.6, Math.PI * 2 - 0.6); g.arc(140, 120, 26, Math.PI * 2 - 1.0, 1.0, true); g.stroke();
  }, 0.35, 3);
  return T.canvasTexture(c);
}

export default class Room2 extends Room {
  static id = 'room2';
  static title = 'The Laboratory';
  static vantage = { position: [0.2, 1.6, 2.9], lookAt: [-0.1, 1.25, -1.0], yawLimit: 80, pitchLimit: 28, fov: 60 };
  static puzzleOrder = ['valves', 'recipe', 'scale', 'cauldron'];

  // POLISH: the floor by the stair read bare and cold from the vantage; a crate, a slumped stack of books
  // and a guttered (unlit, no light) candle stub give it a warm, lived-in corner. Static: merged below.
  _buildClutter() {
    const g = new THREE.Group(); g.name = 'polishClutter';
    g.position.set(3.0, 0, 1.95); g.rotation.y = -1.35;
    const crate = F.rbox(0.46, 0.34, 0.4, M.wood({ tint: '#7a5a38', planks: 3, seed: 9 }), 0.012);
    crate.position.y = 0.17; g.add(crate);
    const lid = F.rbox(0.5, 0.025, 0.44, M.wood({ tint: '#6a4c2e', planks: 4, seed: 4 }), 0.006);
    lid.position.set(0.02, 0.352, 0.01); lid.rotation.y = 0.12; g.add(lid);
    const cols = ['#5a2a22', '#2f4a3a', '#6b5530', '#3a3354'];
    let y = 0.365;
    cols.slice(0, 3).forEach((color, i) => { const b = F.book({ w: 0.045, h: 0.24 - i * 0.02, d: 0.17, color }); b.rotation.set(0, 0.3 + i * 0.35, Math.PI / 2); b.position.set(-0.06 + i * 0.01, y + 0.0225, 0.02); y += 0.045; g.add(b); });
    const lean = F.book({ w: 0.05, h: 0.26, d: 0.18, color: cols[3] }); lean.position.set(0.33, 0.125, 0.1); lean.rotation.set(0, -0.4, -0.32); g.add(lean);
    const stub = F.candle({ holder: 'dish', light: false, h: 0.05, r: 0.024 }); stub.position.set(0.12, 0.365, -0.08); g.add(stub);
    this.group.add(g);
  }

  async build() {
    const { ctx } = this;
    const { state, hotspots, dialogue } = ctx;
    dialogue.addScript(R2_LINES);
    this.background = new THREE.Color('#06090a');
    this.fog = new THREE.FogExp2('#0a1413', 0.032); // POLISH: was 0.035 (murky at the far wall)
    this.envIntensity = 0.65;
    this.exposure = 1.1; // POLISH: was 1.05
    this.bloom = { strength: 0.55, threshold: 0.8, radius: 0.55 };

    this.chalkTexture = makeChalkTexture();
    this.set = buildSet(this);
    // QA: the cat on the top shelf read as a dark lump from the vantage; a small warm key light makes him pop
    const catKey = new THREE.PointLight('#ffd2a0', 2.2, 1.8, 2);
    catKey.position.set(CAT_SPOT.position[0] + 0.25, CAT_SPOT.position[1] + 0.55, CAT_SPOT.position[2] + 0.65);
    this.group.add(catKey);
    this.cauldron = buildCauldron(this);
    this.valves = buildValves(this);
    this.case = buildCase(this);
    this.drawers = buildDrawers(this, { position: [BENCH.x - 0.1, BENCH.h, BENCH.z - 0.2] });
    this.stairs = buildStairs(this);
    this.jars = buildJars(this);
    this._buildVials();
    this._buildWeights();
    this._buildHotspots();
    this._buildClutter();

    // ---- restore from state
    const lit = state.isSolved('valves');
    this.cauldron.setLit(lit, false);
    const adds = state.get('room2.cauldron.adds', []);
    if (state.isSolved('cauldron')) {
      this.cauldron.setLook(LIQ.bruise);
      this.cauldron.setSolvedGlow(true);
      this.cauldron.hideFlask();
    } else {
      this.cauldron.setLook(this.cauldron.lookFor(adds, lit));
    }
    this.stairs.setOpen(state.isSolved('cauldron'), false);
    this._batT = 6; this._batSteps = 0; this._unseen = 0;
    // candles animate only their flame/light; let their wax, drips and holders merge
    this.group.traverse((o) => { if (o.userData.flame && o.userData.flameY !== undefined) { o.userData.mergeInside = true; o.userData.flame.userData.dynamic = true; } });
    const m = mergeStatic(this.group, ctx);
    // the moon shadow is almost entirely static: refresh it ~5x a second instead of every frame (saves ~90 calls)
    this._shadowLights = [];
    this.group.traverse((o) => { if (o.isLight && o.castShadow && o.shadow) { o.shadow.autoUpdate = false; o.shadow.needsUpdate = true; this._shadowLights.push(o); } });
    this._shadowT = 0;
    if (ctx.game.flags?.dev) console.info(`[room2] merged ${m.before} static meshes into ${m.after}`);
    // small things don't need to cast into the moonlight shadow map (halves the shadow pass)
    const sc = new THREE.Vector3(), sph = new THREE.Sphere();
    this.group.updateMatrixWorld(true);
    this.group.traverse((o) => {
      if (!o.isMesh || !o.castShadow) return;
      if (!o.geometry.boundingSphere) o.geometry.computeBoundingSphere();
      o.getWorldScale(sc);
      if (o.geometry.boundingSphere.radius * Math.max(sc.x, sc.y, sc.z) < 0.09) o.castShadow = false;
    });
  }

  // ------------------------------------------------------------------------------------------- vials
  _buildVials() {
    const { ctx } = this;
    const specs = scatterSpecs({ jarSlots: jarSlots(), catZone: [CAT_SPOT.position[0] - 0.36, CAT_SPOT.position[0] + 0.48] });
    const vials = vialSet(specs);
    this.group.add(vials);
    let n = 0;
    ctx.hotspots.add({
      id: 'r2.vials', object: vials, label: 'Glowing vial', highlight: false, scope: 'any',
      onClick: ({ hit }) => {
        const s = vials.userData.entryFor(hit);
        if (!s) return;
        ctx.audio.glassNote(s.note);
        vials.userData.pulse(s);
        if (n++ % 6 === 0) ctx.dialogue.caption('caption.vials');
      },
    });
    // a rack of eight graduated test tubes on the bench: a glass xylophone, C major
    const notes = [0, 2, 4, 5, 7, 9, 11, 12];
    const rackSpecs = notes.map((note, i) => ({
      shape: 'tube', pos: [BENCH.x + 0.2, BENCH.h + 0.035, BENCH.z - 0.72 - i * 0.042], color: ['#3fe0c0', '#40c8ff', '#5af08a', '#b080ff', '#ffb040', '#ff7090', '#c8f060', '#7af0ff'][i],
      glow: 1.4, fill: 1 - i * 0.09, note, s: 1,
    }));
    const rack = vialSet(rackSpecs, { glassOpacity: 0.32 });
    this.group.add(rack);
    // the wooden rack itself
    const wood = new THREE.MeshStandardMaterial({ color: '#7a5232', roughness: 0.7 });
    const zc = BENCH.z - 0.72 - 3.5 * 0.042;
    const rb = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.38), wood); rb.position.set(BENCH.x + 0.2, BENCH.h + 0.006, zc);
    const rt = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.38), wood); rt.position.set(BENCH.x + 0.2, BENCH.h + 0.08, zc);
    for (const m of [rb, rt]) { m.castShadow = true; m.receiveShadow = true; this.group.add(m); }
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.09, 0.012), wood); p.position.set(BENCH.x + 0.2, BENCH.h + 0.045, zc + s * 0.185); p.castShadow = true; this.group.add(p); }
    ctx.hotspots.add({
      id: 'r2.rack', object: rack, label: 'Rack of tuned vials', scope: 'any',
      onClick: ({ hit }) => {
        const s = rack.userData.entryFor(hit);
        if (!s) return;
        ctx.audio.glassNote(s.note);
        rack.userData.pulse(s);
      },
    });
    this.vials = vials; this.rack = rack;
  }

  // ------------------------------------------------------------------------------------------- weights
  _buildWeights() {
    const { ctx } = this;
    const { state } = ctx;
    const spots = {
      w1: { parent: this.group, pos: [BENCH.x + 0.24, BENCH.h, -0.17], rot: 0.4 },
      w2: { parent: this.group, pos: [-3.43, 1.6325, -0.8], rot: 1.2 },
      w4: { parent: this.drawers.drawers[1].interior, pos: [0.04, 0, 0.0], rot: 0.3 },
      w8: { parent: this.group, pos: [WINDOW.x + 0.25, WINDOW.y - WINDOW.r - 0.05, WINDOW.z + 0.24], rot: -0.9 },
    };
    this.weightMeshes = {};
    let found = state.get('room2.weights.found', 0);
    for (const [id, sp] of Object.entries(spots)) {
      const m = weightMesh({ w1: 1, w2: 2, w4: 4, w8: 8 }[id]);
      m.position.set(...sp.pos); m.rotation.y = sp.rot;
      sp.parent.add(m);
      const glint = P.sparkles({ box: [0.05, 0.05, 0.05], center: [0, 0.04, 0], count: 3, color: '#fff2c0', color2: '#ffffff', size: 0.045, opacity: 0.9 });
      m.add(glint);
      // final: a periodic star glint (one short flash every ~4.5 s, staggered per weight) so the eye finds the small
      // weights; it lives on the weight, so it disappears with it once picked up.
      const star = new THREE.Sprite(new THREE.SpriteMaterial({ map: glintTexture(), color: '#fff4d0', transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending }));
      star.position.set(0.012, { w1: 0.03, w2: 0.035, w4: 0.045, w8: 0.06 }[id], 0.012);
      star.raycast = () => {}; star.userData.noRaycast = true; star.userData.noHighlight = true;
      m.add(star);
      const phase = { w1: 0, w2: 1.6, w4: 3.0, w8: 0.8 }[id], base = { w1: 0.075, w2: 0.085, w4: 0.06, w8: 0.16 }[id];
      this.animate((dt, t) => {
        if (!m.visible) return;
        const k = ((t + phase) % 4.5) / 0.55;
        const f = k < 1 ? Math.sin(k * Math.PI) : 0;
        star.material.opacity = 0.9 * f;
        star.material.rotation = t * 0.8;
        star.scale.setScalar(base * (0.35 + 0.65 * f));
      });
      // polish: bigger click volumes (were 0.1 m, ~15 px from the vantage); the drawer one stays snug inside the drawer
      const ps = { w1: 0.18, w2: 0.2, w4: 0.11, w8: 0.3 }[id]; // w8 sits ~7 m away on the high sill
      const proxy = ctx.hotspots.proxyBox(ps, ps * 0.8, ps); proxy.position.y = ps * 0.4 - 0.01; m.add(proxy);
      if (state.get(`room2.weight.${id}.taken`) || state.isSolved('scale')) m.visible = false; // QA: no stray w8 after the solve
      this.weightMeshes[id] = m;
      ctx.hotspots.add({
        id: `r2.weight.${id}`, object: m, label: 'Brass weight', scope: 'any',
        enabled: () => !state.get(`room2.weight.${id}.taken`) && !state.isSolved('scale'),
        onClick: () => {
          state.set(`room2.weight.${id}.taken`, true);
          found = state.inc('room2.weights.found');
          ctx.audio.play('pickup');
          ctx.inventory.add(id, { from: m });
          m.visible = false;
          const pool = ctx.script['caption.weight.found'];
          ctx.dialogue.caption(Array.isArray(pool) ? pool[(found - 1) % pool.length] : 'caption.weight.found');
        },
      });
    }
  }

  // ------------------------------------------------------------------------------------------- hotspots
  _buildHotspots() {
    const { ctx } = this;
    const { state, hotspots, dialogue } = ctx;
    const S = this.set;

    // chalkboard → paper
    hotspots.add({
      id: 'r2.chalkboard', object: S.chalkboard.userData.board, highlight: S.chalkboard, label: 'Chalkboard',
      onClick: async () => {
        dialogue.caption('caption.chalkboard');
        ctx.audio.play('paperRustle', { gain: 0.4 });
        await ctx.papers.show('chalkboard');
        if (!state.get('room2.chalkboard.read')) { state.set('room2.chalkboard.read', true); this._checkRecipe(); }
      },
    });

    // ingredient shelf focus
    hotspots.add({
      id: 'r2.shelf', object: S.shelf, label: 'Ingredient shelves',
      onClick: () => {
        ctx.camera.focus({ position: [SHELF.x, 1.48, SHELF.z + 1.3], lookAt: [SHELF.x, 1.36, SHELF.z], scope: 'focus:r2.shelf', onExit: () => dialogue.hideCaption() });
        dialogue.caption('caption.r2.shelf');
      },
    });

    // cauldron
    const C = this.cauldron;
    const useJar = (item) => () => this._addIngredient(item);
    hotspots.add({
      id: 'r2.cauldron', object: C.root, label: () => (state.isSolved('valves') ? 'Cauldron (simmering)' : 'Cauldron (cold)'),
      scope: ['room', 'focus:r2.cauldron'],
      onClick: () => {
        if (!ctx.camera.inFocus) ctx.camera.focus({ position: [CAULDRON.x + 0.15, 2.05, CAULDRON.z + 1.35], lookAt: [CAULDRON.x, 0.95, CAULDRON.z], scope: 'focus:r2.cauldron', onExit: () => dialogue.hideCaption() });
        if (!state.isSolved('valves')) { dialogue.caption('caption.burner.cold'); return; }
        if (state.isSolved('cauldron')) { dialogue.caption('caption.r2.cauldron.done'); return; }
        const n = state.get('room2.cauldron.adds', []).length;
        dialogue.caption(n === 0 ? 'caption.r2.cauldron.base' : n < 3 ? 'caption.r2.cauldron.partial' : 'caption.r2.cauldron.full');
      },
      useItem: { jar_fish: useJar('jar_fish'), jar_moon: useJar('jar_moon'), jar_dawn: useJar('jar_dawn') },
    });
    hotspots.add({
      id: 'r2.paddle', object: C.paddle, label: 'Stirring paddle', scope: ['room', 'focus:r2.cauldron'],
      onClick: () => {
        if (!ctx.camera.inFocus) ctx.camera.focus({ position: [CAULDRON.x + 0.15, 2.05, CAULDRON.z + 1.35], lookAt: [CAULDRON.x, 0.95, CAULDRON.z], scope: 'focus:r2.cauldron', onExit: () => dialogue.hideCaption() });
        this._stir();
      },
      useItem: { jar_fish: useJar('jar_fish'), jar_moon: useJar('jar_moon'), jar_dawn: useJar('jar_dawn') },
    });
    hotspots.add({
      id: 'r2.flask', object: C.flask, label: 'Empty flask', scope: ['room', 'focus:r2.cauldron'],
      enabled: () => C.flask.visible,
      onClick: () => dialogue.caption('caption.r2.flask'),
    });

    // stairs
    hotspots.add({
      id: 'r2.stairs', object: this.stairs.root, label: () => (state.isSolved('cauldron') ? 'Up to the observatory' : 'Spiral stair (gated)'),
      onClick: () => {
        if (!state.isSolved('cauldron')) {
          ctx.audio.play('zap', { gain: 0.35 });
          ctx.transitions.flash('#8ff0d8', 0.3, 0.35);
          dialogue.caption('caption.stairs.blocked');
          return;
        }
        if (ctx.game.registry.has('room3')) { ctx.audio.play('footstep'); ctx.game.goToRoom('room3'); }
        else dialogue.caption('caption.r2.stairs.notyet');
      },
    });

    // back to the study
    hotspots.add({
      id: 'r2.door', object: S.door, label: 'Door to the study',
      onClick: () => {
        if (ctx.game.registry.has('room1')) { ctx.audio.play('doorOpen', { gain: 0.6 }); ctx.game.goToRoom('room1'); }
        else dialogue.caption('caption.r2.door');
      },
    });

    // flavour
    hotspots.add({
      id: 'r2.window', object: S.window, label: 'Round window', scope: ['room', 'focus:r2.window'],
      onClick: () => {
        if (ctx.camera.scope !== 'focus:r2.window') ctx.camera.focus({ position: [WINDOW.x - 0.25, WINDOW.y - 0.05, WINDOW.z + 1.35], lookAt: [WINDOW.x, WINDOW.y - 0.25, WINDOW.z], scope: 'focus:r2.window', onExit: () => dialogue.hideCaption() });
        dialogue.caption('caption.window');
      },
    });
    hotspots.add({ id: 'r2.mortar', object: S.mortar, label: 'Mortar and pestle', scope: ['room', 'focus:r2.case'], onClick: () => { ctx.audio.play('stoneGrind', { gain: 0.25, pitch: 2 }); dialogue.caption('caption.r2.mortar'); } });
    S.herbs.forEach((h, i) => hotspots.add({ id: `r2.herbs${i}`, object: h, label: 'Dried herbs', onClick: () => { ctx.tween.to(h.rotation, { x: 0.12 }, { duration: 0.25, ease: 'outQuad' }).then(() => ctx.tween.to(h.rotation, { x: 0 }, { duration: 1.4, ease: 'outElastic' })); dialogue.caption('caption.r2.herbs'); } }));
    hotspots.add({ id: 'r2.alembic', object: S.alembic.retort, label: 'Bubbling retort', onClick: () => { ctx.audio.play('splash', { gain: 0.25, pitch: 1.6 }); dialogue.caption('caption.r2.alembic'); } });
    hotspots.add({ id: 'r2.hat', object: S.hat, label: 'Pointed hat', onClick: () => { dialogue.caption('caption.r2.hat'); ctx.cat.react?.('earFlickR'); } });
    hotspots.add({ id: 'r2.tank', object: S.tank, label: 'Gas tank', onClick: () => { ctx.audio.play('clockTick', { gain: 0.6, pitch: 0.6 }); dialogue.caption('caption.r2.tank'); } });
  }

  // ------------------------------------------------------------------------------------------- puzzle flow
  takeJar(key, mesh) {
    const { ctx } = this;
    const { state } = ctx;
    const item = JAR_ITEMS[key];
    if (!item || state.get(`room2.jar.${key}.taken`)) return;
    state.set(`room2.jar.${key}.taken`, true);
    ctx.audio.play('pickup');
    ctx.audio.glassNote(key === 'fish' ? 4 : key === 'moon' ? 7 : 12);
    ctx.inventory.add(item, { from: mesh });
    if (key === 'dawn') this.case.hideJar(); else mesh.visible = false;
    ctx.dialogue.caption(`caption.r2.jar.${key}`);
    this._checkRecipe();
  }

  _checkRecipe() {
    const { state, dialogue } = this.ctx;
    if (state.isSolved('recipe')) return;
    if (state.get('room2.chalkboard.read') && state.get('room2.jar.fish.taken') && state.get('room2.jar.moon.taken')) {
      state.solve('recipe');
      this.ctx.tween.delay(0.8).then(() => dialogue.say('react.recipe.solved'));
    }
  }

  async onValvesSolved() {
    const { ctx } = this;
    const { state } = ctx;
    state.solve('valves');
    ctx.hotspots.lock();
    try {
      ctx.audio.play('gasHiss');
      await ctx.tween.delay(0.9);
      await ctx.camera.exitFocus();
      ctx.camera.lookAtPoint([CAULDRON.x, 0.7, CAULDRON.z]);
      await ctx.tween.delay(0.5);
      ctx.audio.play('flameIgnite');
      this.cauldron.setLit(true, true);
      P.burst(ctx, this.group, [CAULDRON.x, 0.2, CAULDRON.z], { color: '#7ab8ff', color2: '#ffffff', count: 60, radius: 0.5 });
      const adds = state.get('room2.cauldron.adds', []);
      this.cauldron.setLook(this.cauldron.lookFor(adds, true), 2.5);
      ctx.audio.setLoopGain('bubble', 1.0, 2);
      await ctx.tween.delay(1.2);
      ctx.dialogue.caption('caption.r2.burner.lit');
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('react.valves.solved');
  }

  onDrawerOpened(i) {
    const { state, dialogue, camera } = this.ctx;
    if (camera.scope !== 'focus:r2.drawers') {
      const p = new THREE.Vector3(); this.drawers.drawers[i].interior.getWorldPosition(p);
      camera.focus({ position: [p.x + 0.75, p.y + 0.62, p.z + 0.05], lookAt: [p.x + 0.17, p.y, p.z], scope: 'focus:r2.drawers', onExit: () => dialogue.hideCaption() });
    }
    if (i === 1) dialogue.caption(state.get('room2.weight.w4.taken') ? 'caption.r2.drawer.empty' : 'caption.r2.drawer.ends');
    else dialogue.caption(i === 0 ? 'caption.r2.drawer.odds' : 'caption.r2.drawer.sundries');
  }

  onScaleChanged(sum) {
    const { ctx } = this;
    if (sum === 7) {
      ctx.hotspots.lock();
      ctx.tween.delay(0.9).then(async () => {
        try {
          ctx.state.solve('scale');
          for (const w of ['w1', 'w2', 'w4', 'w8']) if (ctx.inventory.has(w)) ctx.inventory.remove(w);
          for (const [w, m] of Object.entries(this.weightMeshes || {})) if (!ctx.state.get(`room2.weight.${w}.taken`)) m.visible = false;
          await this.case.solve();
        } finally { ctx.hotspots.unlock(); }
        await ctx.dialogue.say('react.scale.solved');
      });
      return;
    }
    this._wrongScale = (this._wrongScale || 0) + 1;
    if (sum > 7 ? this._wrongScale % 2 === 1 : this._wrongScale % 3 === 2) {
      // QA: the pool is picked at random, so "Too much… the eight" could play when the pan was light; pick by direction
      const pool = ctx.script['react.scale.wrong'];
      const lines = Array.isArray(pool) && Array.isArray(pool[0]) && pool.length >= 3
        ? (sum > 7 ? pool[2] : pool[this._wrongScale % 2]) : 'react.scale.wrong';
      ctx.tween.delay(0.7).then(() => ctx.dialogue.say(lines));
    }
  }

  _addIngredient(item) {
    const { ctx } = this;
    const { state, dialogue } = ctx;
    if (!state.isSolved('valves')) { ctx.audio.play('error', { gain: 0.3 }); dialogue.caption('caption.burner.cold'); return; }
    if (state.isSolved('cauldron')) { dialogue.caption('caption.r2.cauldron.done'); return; }
    if (this._stirring) return;
    const adds = state.get('room2.cauldron.adds', []);
    if (adds.length >= 3) { dialogue.caption('caption.r2.cauldron.full'); return; }
    adds.push(item);
    state.set('room2.cauldron.adds', adds);
    if (!ctx.camera.inFocus) ctx.camera.focus({ position: [CAULDRON.x + 0.15, 2.05, CAULDRON.z + 1.35], lookAt: [CAULDRON.x, 0.95, CAULDRON.z], scope: 'focus:r2.cauldron', onExit: () => dialogue.hideCaption() });
    this._pourAnim(item);
    dialogue.caption(`caption.r2.add.${item}`);
  }

  async _pourAnim(item) {
    const { ctx } = this;
    const look = this.cauldron.lookFor(ctx.state.get('room2.cauldron.adds', []), true);
    const ing = LIQ[item];
    const surf = [CAULDRON.x, this.cauldron.SURF_Y, CAULDRON.z];
    // a little jar tips over the rim and pours
    const { jar } = await import('../../engine/props/furniture.js');
    const j = jar({ r: 0.045, h: 0.12, contents: ing.c1, glow: 0.8, lid: 'none' });
    j.position.set(surf[0] + 0.2, surf[1] + 0.32, surf[2] + 0.25);
    j.traverse((o) => { o.userData.noRaycast = true; });
    this.group.add(j);
    this._pouring = (this._pouring || 0) + 1;
    try {
    await ctx.tween.to(j.rotation, { z: 2.1, x: -0.3 }, { duration: 0.45, ease: 'inOutSine' });
    ctx.audio.play('pour', { gain: 0.6 });
    P.burst(ctx, this.group, [surf[0] + 0.08, surf[1] + 0.2, surf[2] + 0.1], { color: ing.c2, color2: ing.c1, count: 40, radius: 0.18, duration: 0.9, size: 0.02 });
    await ctx.tween.delay(0.35);
    ctx.audio.play('splash', { gain: 0.6 });
    this.cauldron.setLook(look, 1.1);
    await ctx.tween.to(j.rotation, { z: 0, x: 0 }, { duration: 0.35, ease: 'inOutSine' });
    await ctx.tween.to(j.position, { y: j.position.y + 0.25 }, { duration: 0.3, ease: 'inQuad' });
    } finally { this.group.remove(j); this._pouring--; }
  }

  async _stir() {
    const { ctx } = this;
    const { state, dialogue } = ctx;
    if (!state.isSolved('valves')) { dialogue.caption('caption.burner.cold'); return; }
    if (state.isSolved('cauldron')) { dialogue.caption('caption.r2.paddle'); return; }
    if (this._stirring || this._pouring) return;
    const adds = state.get('room2.cauldron.adds', []);
    if (adds.length < 3) {
      ctx.audio.play('splash', { gain: 0.3, pitch: 0.8 });
      this.cauldron.stir(1.0);
      dialogue.caption(adds.length ? 'caption.r2.paddle.early' : 'caption.r2.paddle');
      return;
    }
    this._stirring = true;
    ctx.hotspots.lock();
    dialogue.hideCaption();
    if (!ctx.camera.inFocus) ctx.camera.focus({ position: [CAULDRON.x + 0.15, 2.05, CAULDRON.z + 1.35], lookAt: [CAULDRON.x, 0.95, CAULDRON.z], scope: 'focus:r2.cauldron', onExit: () => dialogue.hideCaption() });
    ctx.audio.play('splash', { gain: 0.5 });
    const ok = adds.length === 3 && adds.every((a, i) => a === ORDER[i]);
    await this.cauldron.stir(ok ? 2.8 : 1.8); // final: a wrong brew turns sooner (was 2.8 s either way)
    if (ok) await this._brewSuccess();
    else await this._brewFail();
    this._stirring = false;
  }

  async _brewSuccess() {
    const { ctx } = this;
    const { state } = ctx;
    const C = this.cauldron;
    try {
      state.solve('cauldron');
      ctx.audio.play('success');
      C.setSolvedGlow(true);
      await C.setLook(LIQ.bruise, 1.8);
      ctx.renderer.pulseBloom?.(1.4, 1.6);
      P.burst(ctx, this.group, [CAULDRON.x, C.SURF_Y + 0.1, CAULDRON.z], { color: '#d070ff', color2: '#ffe0ff', count: 110, radius: 0.7 });
      await ctx.tween.delay(0.4);
      await C.fillFlask();
      for (const j of ORDER) if (ctx.inventory.has(j)) ctx.inventory.remove(j);
      ctx.inventory.add('elixir', { from: C.flask });
      C.hideFlask();
      await ctx.tween.delay(0.6);
      await ctx.camera.exitFocus({ all: true });
      ctx.camera.lookAtPoint(this.stairs.gateWorld().toArray());
      await ctx.tween.delay(0.6);
      ctx.audio.play('unlock');
      await this.stairs.setOpen(true, true);
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('react.cauldron.solved');
    await ctx.dialogue.say('react.stairs.open');
  }

  async _brewFail() {
    const { ctx } = this;
    const C = this.cauldron;
    const adds = ctx.state.get('room2.cauldron.adds', []);
    const look = C.lookFor(adds, true);
    try {
      ctx.audio.play('whump');
      ctx.camera.shake(0.06, 0.6);
      ctx.cat.react?.('flinch');
      ctx.transitions.flash(look.c2, 0.25, 0.35);
      smokePuff(ctx, this.group, [CAULDRON.x, C.SURF_Y + 0.15, CAULDRON.z], { color: new THREE.Color(look.c1).lerp(new THREE.Color('#6a6a50'), 0.4).getStyle(), count: 18, radius: 0.8, duration: 2.8 });
      P.burst(ctx, this.group, [CAULDRON.x, C.SURF_Y + 0.1, CAULDRON.z], { color: look.c2, color2: '#555544', count: 70, radius: 0.9, size: 0.035 });
      ctx.state.set('room2.cauldron.adds', []);
      // final: the cat's line now lands ~1.5 s after the whump (was after the full 1.6 s clear-out and more);
      // the liquid keeps clearing underneath the dialogue
      C.setLook(LIQ.clear, 1.6);
      await ctx.tween.delay(1.5);
    } finally { ctx.hotspots.unlock(); }
    await ctx.dialogue.say('react.cauldron.wrong');
  }

  prereqMet(id) {
    const s = this.ctx.state;
    if (id === 'cauldron') return s.isSolved('valves') && s.isSolved('scale') && s.isSolved('recipe');
    return true;
  }

  // ------------------------------------------------------------------------------------------- lifecycle
  _placeCat() {
    const { ctx } = this;
    ctx.cat.placeAt(this.group, {
      ...CAT_SPOT,
      hotspot: {
        useItem: {
          sardines: () => {
            const seen = ctx.state.get('room2.sardines.cat', 0);
            ctx.state.set('room2.sardines.cat', seen + 1);
            const pool = ctx.script['react.sardines.cat'];
            ctx.cat.react?.('perk');
            ctx.dialogue.say(Array.isArray(pool) && Array.isArray(pool[0]) ? pool[Math.min(seen, pool.length - 1)] : 'react.sardines.cat');
          },
          parcel: () => ctx.dialogue.say('react.parcel.cat'),
        },
      },
    });
  }

  enter() {
    const { ctx } = this;
    const { state } = ctx;
    this._placeCat();
    ctx.audio.setRoomAmbience('room2');
    this._bubblePending = true; // Game re-applies the room bed after enter(); boost the bubbling on the next frame
    if (!state.get('room2.intro.seen')) {
      state.set('room2.intro.seen', true);
      ctx.tween.delay(0.9).then(async () => {
        await ctx.dialogue.say('room2.intro');
        if (!state.get('room2.choice.seen')) {
          state.set('room2.choice.seen', true);
          await ctx.dialogue.choice('choice.room2.wizard');
        }
      });
    }
  }

  enterTitle() { this._placeCat(); }

  exit() {
    this.ctx.cat.lookAt(null);
  }

  update(dt, t) {
    const { ctx } = this;
    if (this._bubblePending) { this._bubblePending = false; if (ctx.state.isSolved('valves')) ctx.audio.setLoopGain('bubble', 1.0, 2); }
    this._updateBat(dt);
    this._shadowT += dt;
    if (this._shadowT > 0.2) { this._shadowT = 0; for (const l of this._shadowLights) l.shadow.needsUpdate = true; }
  }

  // The cat bats his vial toward the shelf edge now and then; it never falls, and creeps home when nobody looks.
  _updateBat(dt) {
    const { ctx } = this;
    const J = this.jars;
    if (!J || ctx.game.currentRoom !== this) return;
    const bat = J.bat;
    const world = this._tmpV || (this._tmpV = new THREE.Vector3());
    bat.getWorldPosition(world);
    const cam = ctx.camera.camera;
    const fwd = this._tmpF || (this._tmpF = new THREE.Vector3());
    cam.getWorldDirection(fwd);
    const to = world.clone().sub(cam.position).normalize();
    const watched = fwd.dot(to) > 0.75;
    this._batT -= dt;
    if (this._batT <= 0 && !this._batting && watched && !ctx.dialogue.isOpen) {
      this._batT = 9 + Math.random() * 9;
      if (bat.position.z < J.edgeZ - 0.005) {
        this._batting = true;
        ctx.cat.lookAt(world.clone());
        ctx.tween.delay(0.7).then(async () => {
          ctx.cat.react?.('earFlickL');
          const nz = Math.min(J.edgeZ, bat.position.z + 0.035 + Math.random() * 0.02);
          ctx.audio.play('click', { gain: 0.25, pitch: 2.2 });
          await ctx.tween.to(bat.position, { z: nz, x: bat.position.x - 0.01 }, { duration: 0.35, ease: 'outCubic' });
          if (nz >= J.edgeZ - 0.001) { ctx.tween.to(bat.rotation, { z: 0.08 }, { duration: 0.2 }).then(() => ctx.tween.to(bat.rotation, { z: 0 }, { duration: 0.6, ease: 'outElastic' })); ctx.cat.react?.('tailFlick'); }
          await ctx.tween.delay(1.2);
          ctx.cat.lookAt(null);
          this._batting = false;
        });
      }
    }
    // unobserved for a few seconds → an unseen hand slides it back
    if (!watched && bat.position.z > J.batHome.z + 0.01) {
      this._unseen += dt;
      if (this._unseen > 2.5) { bat.position.copy(J.batHome); this._unseen = 0; }
    } else this._unseen = 0;
  }
}

// final: four-point star sprite for the weight glints
let _glintTex = null;
function glintTexture() {
  if (_glintTex) return _glintTex;
  const c = document.createElement('canvas'); c.width = c.height = 64;
  const g = c.getContext('2d');
  const rad = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  rad.addColorStop(0, 'rgba(255,255,240,1)'); rad.addColorStop(0.15, 'rgba(255,240,200,0.6)'); rad.addColorStop(1, 'rgba(255,220,150,0)');
  g.fillStyle = rad; g.fillRect(0, 0, 64, 64);
  g.fillStyle = 'rgba(255,250,230,0.95)';
  g.beginPath(); g.moveTo(32, 0); g.lineTo(34.5, 29.5); g.lineTo(64, 32); g.lineTo(34.5, 34.5); g.lineTo(32, 64); g.lineTo(29.5, 34.5); g.lineTo(0, 32); g.lineTo(29.5, 29.5); g.closePath(); g.fill();
  _glintTex = new THREE.CanvasTexture(c); _glintTex.colorSpace = THREE.SRGBColorSpace;
  return _glintTex;
}
