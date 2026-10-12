// ENDING — the payoff cinematic + credits. No hotspots: the player just clicks through dialogue.
// Entry contract (from room3): play the ritual flash, `await transitions.whiteOut()`, then
//   ctx.game.goToRoom('ending', { fade: false })
// so the screen stays white; enter() then fades in *from white*. Any other entry (dev ?room=ending, Continue)
// fades in from black.
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as P from '../../engine/props/particles.js';
import { buildSet, doorPoint, DOOR_R, DOOR_A } from './set.js';
import { makeParcel, makeBook, makeQuill } from './props.js';
import { createRiggedWizard, walkWizard } from './wizardRig.js';
import { buildCreditsStage, createCreditsOverlay, fmtTime } from './credits.js';

const ABORT = Symbol('ending-abort');
const V = (x, y, z) => new THREE.Vector3(x, y, z);
const BEST_KEY = 'ordinary-cat.best'; // survives "Play again" (which wipes the save); read by Title for its badge

// fallback lines (only used if the WRITER's keys are missing)
const q = (text) => ({ who: 'quince', text });
const FALLBACK = {
  'ending.transform': [q('…Ah.')],
  'ending.door': [q('Right. Your door.')],
  'ending.parcel': [q("You'll be wanting a signature.")],
  'ending.last': [q('Thank you, courier.')],
  'credits.lines': ['AN ORDINARY CAT', 'You escaped in {time}.'],
};

// Where he stands at the door, and the unit vector from the door back toward the circle.
const AT_DOOR = doorPoint(DOOR_R - 0.8);
const TO_CIRCLE = V(-Math.sin(DOOR_A), 0, -Math.cos(DOOR_A));
const SIDE = V(TO_CIRCLE.z, 0, -TO_CIRCLE.x); // perpendicular on the floor

export default class Ending extends Room {
  static id = 'ending';
  static title = 'The Rite of Reversion';
  static vantage = { position: [1.55, 1.5, 3.3], lookAt: [0, 1.2, 0], yawLimit: 0, pitchLimit: 0, fov: 36 };
  static puzzleOrder = [];

  async build() {
    this.background = new THREE.Color('#060a1c');
    this.fog = new THREE.FogExp2('#0a1030', 0.05);
    this.envIntensity = 0.55;
    this.exposure = 1.05;
    this.bloom = { strength: 0.7, threshold: 0.72, radius: 0.6 };

    this.set = buildSet();
    this.parts = this.set.userData.parts;
    this.group.add(this.set);

    this.rig = createRiggedWizard();
    this.rig.group.traverse((o) => { if (o.isMesh) { o.castShadow = true; o.userData.noRaycast = true; } });
    this.set.add(this.rig.group);

    this.parcel = makeParcel();
    this.book = makeBook();
    this.quill = makeQuill();

    this.stage = buildCreditsStage();
    this.stage.position.set(0, 0, 200);
    this.stage.visible = false;
    this.group.add(this.stage);

    this._shot = { pos: V(1.55, 1.5, 3.3), look: V(0, 1.2, 0), fov: 36 };
    this._run = 0;
  }

  // ------------------------------------------------------------------ helpers
  get script() { return this.ctx.script || {}; }
  lines(key) { return this.script[key] || FALLBACK[key] || []; }

  /** Cut (dur = 0) or glide the cinematic camera. */
  shot(pos, look, fov = this._shot.fov, dur = 0, ease = 'inOutSine') {
    const s = this._shot;
    const p0 = s.pos.clone(), l0 = s.look.clone(), f0 = s.fov;
    const p1 = Array.isArray(pos) ? V(...pos) : pos.clone(), l1 = Array.isArray(look) ? V(...look) : look.clone();
    this.ctx.tween.kill(s);
    if (!dur) { s.pos.copy(p1); s.look.copy(l1); s.fov = fov; return Promise.resolve(); }
    s.k = 0;
    return this.ctx.tween.to(s, { k: 1 }, {
      duration: dur, ease,
      onUpdate: () => { s.pos.lerpVectors(p0, p1, s.k); s.look.lerpVectors(l0, l1, s.k); s.fov = f0 + (fov - f0) * s.k; },
    });
  }

  _applyShot(t) {
    const cam = this.ctx.camera;
    const s = this._shot;
    // a breath of hand-held drift so the frame is never dead still
    const drift = V(Math.sin(t * 0.37) * 0.012, Math.sin(t * 0.51 + 1) * 0.008, Math.sin(t * 0.29 + 2) * 0.01);
    cam.vantage.position.copy(s.pos).add(drift);
    const d = s.look.clone().sub(cam.vantage.position).normalize();
    cam.vantage.yaw = Math.atan2(-d.x, -d.z);
    cam.vantage.pitch = Math.asin(THREE.MathUtils.clamp(d.y, -1, 1));
    cam.yaw = cam.targetYaw = 0; cam.pitch = cam.targetPitch = 0;
    if (Math.abs(cam.camera.fov - s.fov) > 1e-3) { cam.camera.fov = s.fov; cam.vantage.fov = s.fov; cam.camera.updateProjectionMatrix(); }
  }

  /** Reset every moving part of the set to the "just transformed" configuration. */
  _resetSet() {
    const p = this.parts;
    const r = this.rig;
    r.group.position.set(0, 0, 0);
    r.group.rotation.set(0, 0.42, 0);
    r.group.visible = true;
    for (const k of ['L', 'R', 'head']) { this.ctx.tween.kill(r.cur[k]); r.cur[k].w = 0; }
    r.cur.jitter = 0;
    p.door.userData.leaf.rotation.y = 0;
    p.door.userData.setRune(1);
    p.runeLight.intensity = 3.0;
    p.dawn.material.color.setScalar(0);
    p.doorLight.intensity = 0;
    p.shaft.userData.setOpacity(0);
    p.spill.material.opacity = 0;
    p.dawnMotes.userData.setOpacity(0);
    p.inlayLevel.v = 1;
    for (const c of p.candles) c.userData.setLit(true);
    this.parcel.removeFromParent();
    this.book.removeFromParent();
    this.quill.removeFromParent();
    this.set.visible = true;
    this.stage.visible = false;
  }

  /** Awaitable that throws ABORT if the room was left (or re-entered) meanwhile. */
  _guard(run) {
    return async (p) => { const v = await p; if (run !== this._run) throw ABORT; return v; };
  }

  _project(v3) {
    const v = v3.clone().project(this.ctx.camera.camera);
    return { x: (v.x * 0.5 + 0.5) * window.innerWidth, y: (-v.y * 0.5 + 0.5) * window.innerHeight };
  }

  /** The parcel leaves the inventory bar and flies to `worldPos` on screen. */
  _flyParcelOut(worldPos) {
    const { inventory } = this.ctx;
    if (!inventory.has('parcel')) return Promise.resolve();
    const slot = inventory._slotRect?.('parcel');
    const from = slot && slot.width > 0 ? { x: slot.left + slot.width / 2, y: slot.top + slot.height / 2 } : { x: window.innerWidth / 2, y: window.innerHeight - 50 };
    const to = this._project(worldPos);
    const img = document.createElement('img');
    img.src = inventory.icon('parcel', 256).toDataURL();
    img.className = 'oc-fly';
    const big = 120;
    img.style.width = img.style.height = big + 'px';
    document.body.appendChild(img);
    inventory.remove('parcel');
    this.ctx.audio.play('swoosh');
    const a = img.animate([
      { transform: `translate(${from.x - big / 2}px, ${from.y - big / 2}px) scale(0.45)`, opacity: 1 },
      { transform: `translate(${(from.x + to.x) / 2 - big / 2}px, ${Math.min(from.y, to.y) - 120 - big / 2}px) scale(1.0) rotate(-8deg)`, opacity: 1, offset: 0.5 },
      { transform: `translate(${to.x - big / 2}px, ${to.y - big / 2}px) scale(0.6) rotate(0deg)`, opacity: 0 },
    ], { duration: 1100, easing: 'cubic-bezier(.45,0,.3,1)', fill: 'forwards' });
    // finish events only dispatch on a rendered frame; the game-clock fallback keeps the cinematic from ever hanging on it
    return new Promise((res) => {
      const done = () => { img.remove(); res(); };
      a.onfinish = done; a.oncancel = done;
      this.ctx.tween.delay(1.3).then(done);
    });
  }

  // ------------------------------------------------------------------ lifecycle
  enter({ from } = {}) {
    const run = ++this._run;
    this._sequence(run, from).catch((e) => { if (e !== ABORT) console.error('[ending]', e); });
  }

  async _sequence(run, from) {
    const ctx = this.ctx;
    const w = this._guard(run);
    const { tween, audio, dialogue, renderer, transitions, inventory, hud } = ctx;
    const say = (line) => (line ? w(dialogue.say(line)) : w(Promise.resolve()));
    const T = this.lines('ending.transform'), D = this.lines('ending.door'), Pc = this.lines('ending.parcel'), Ls = this.lines('ending.last');
    const p = this.parts, rig = this.rig;

    ctx.game.stopTimer();
    ctx.hotspots.enabled = false;   // cinematic: clicks only advance dialogue
    ctx.camera.enabled = false;
    ctx.cat.setVisible(false);      // the cat is… otherwise engaged
    inventory.deselect?.();
    inventory.setVisible(false);    // no UI chrome over the cinematic (restored in exit())
    this._resetSet();
    this.shot(V(2.15, 1.75, 4.6), V(0, 1.25, 0), 34);

    // Game starts its own short fadeIn right after enter() returns; take over on the next microtask.
    await w(Promise.resolve());
    audio.setRoomAmbience('ending');
    const fromRitual = from === 'room3';
    const bloom = this.bloom;
    if (fromRitual) {
      transitions.fadeFrom('#fffaf0', 3.2);
      renderer.setExposure(2.2);
      renderer.setBloom(2.4, bloom);
      p.inlayLevel.v = 3;
      tween.run(3.6, (k) => {
        renderer.setExposure(2.2 + (this.exposure - 2.2) * k);
        renderer.setBloom(2.4 + (bloom.strength - 2.4) * k, bloom);
        p.inlayLevel.v = 3 - 2 * k;
      }, { ease: 'outCubic' });
      audio.play('sparkle', { gain: 0.8 });
    } else {
      transitions.fadeFrom('#000', 1.8);
      p.inlayLevel.v = 2;
      tween.to(p.inlayLevel, { v: 1 }, { duration: 3, ease: 'outCubic' });
    }
    P.burst(ctx, this.set, [0, 1.0, 0], { color: '#ffe2a0', color2: '#c9a0ff', count: 140, radius: 1.3, duration: 2.4, size: 0.035 });
    await w(this.shot(V(1.55, 1.5, 3.3), V(0, 1.2, 0), 36, 4.2));

    // ---- 1. ending.transform ----------------------------------------------------------------
    await say(T[0]);                          // "The light folds in…"
    rig.pose(ctx, { head: { x: 0.12, y: -0.25 } }, 0.6);
    await say(T[1]);                          // "…Ah."
    this.shot(V(1.4, 1.6, 2.9), V(0, 1.3, 0), 34, 1.6);
    await w(rig.pose(ctx, 'hands', 0.9));
    await w(tween.delay(0.4));
    rig.pose(ctx, 'handL', 0.5);
    await w(tween.delay(0.5));
    rig.pose(ctx, { head: { x: 0.1, y: 0.0 } }, 0.5);
    rig.wave();                               // wiggles the fingers at himself
    await say(T[2]);                          // "Hands. Hello, hands."
    // notices the tail: turns to look at it
    this.shot(V(1.9, 1.95, 2.7), V(0, 0.72, 0), 40, 1.8);
    tween.to(rig.group.rotation, { y: 0.42 + 2.3 }, { duration: 1.4, ease: 'inOutSine' });
    rig.pose(ctx, 'tail', 1.0);
    await w(tween.delay(0.9));
    await say(T[3]);                          // "The tail has stayed…"
    await w(tween.to(rig.group.rotation, { y: 0.42 }, { duration: 1.1, ease: 'inOutSine' }));
    rig.pose(ctx, 'shrug', 0.6);
    this.shot(V(1.55, 1.5, 3.3), V(0, 1.2, 0), 36, 1.2);
    await say(T[4]);                          // "We'll call it a draft."
    rig.pose(ctx, 'idle', 0.7);

    // ---- 2. ending.door ------------------------------------------------------------------------
    await w(tween.delay(0.3));
    await say(D[0]);                          // "Right. Your door."
    this.shot(V(2.4, 1.85, 3.4), V(-1.3, 1.1, -1.5), 46, 2.4);
    await w(walkWizard(ctx, rig, AT_DOOR.toArray(), { speed: 0.9, faceYaw: DOOR_A }));
    // over-the-shoulder on the door
    const rightOf = V(-Math.cos(DOOR_A), 0, Math.sin(DOOR_A)); // his right hand side while facing the door
    const behind = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 2.5).addScaledVector(rightOf, 1.0).setY(1.75);
    this.shot(behind, doorPoint(DOOR_R, 1.25), 42, 1.4);
    await w(rig.pose(ctx, 'reach', 0.9));
    const runeWorld = new THREE.Vector3();
    p.door.userData.rune.getWorldPosition(runeWorld);
    audio.play('unlock');
    P.burst(ctx, this.set, this.set.worldToLocal(runeWorld.clone()).toArray(), { color: '#bfe0ff', color2: '#ffffff', count: 70, radius: 0.5, duration: 1.4 });
    tween.to(p.door.userData, { runeIntensity: 0 }, { duration: 1.6, ease: 'inQuad' }); // game-clock driven (setRune uses rAF time)
    tween.to(p.runeLight, { intensity: 0 }, { duration: 1.6, ease: 'inQuad' });
    const n2 = dialogue.say(D[1]);            // "He touches the rune. It sighs and goes out."
    await w(tween.delay(1.0));
    rig.pose(ctx, 'idle', 0.8);
    await w(n2);
    // the door swings open onto dawn
    audio.play('doorOpen');
    tween.to(p.door.userData.leaf.rotation, { y: -1.45 }, { duration: 2.6, ease: 'inOutCubic' });
    await w(tween.delay(0.35));
    tween.run(2.6, (k) => {
      p.dawn.material.color.setScalar(0.95 * k);
      p.doorLight.intensity = 24 * k;
      p.shaft.userData.setOpacity(0.2 * k);
      p.spill.material.opacity = 0.55 * k;
      p.dawnMotes.userData.setOpacity(0.65 * k);
    }, { ease: 'inOutSine' });
    audio.play('sparkle', { gain: 0.5 });
    await w(tween.delay(1.2));
    // pull back so the doorway light pours toward us, then he turns round
    const front = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 2.5).addScaledVector(SIDE, 0.45).setY(1.45);
    await w(this.shot(front, AT_DOOR.clone().setY(1.25), 40, 2.0));
    const faceCam = Math.atan2(front.x - AT_DOOR.x, front.z - AT_DOOR.z);
    await w(walkWizard(ctx, rig, AT_DOOR.toArray(), { faceYaw: faceCam }));
    await say(D[2]);                          // "It only opens for the master of the tower…"

    // ---- 3. ending.parcel ---------------------------------------------------------------------
    const mid = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 2.3).addScaledVector(SIDE, 0.35).setY(1.5);
    this.shot(mid, AT_DOOR.clone().setY(1.12), 38, 1.4);
    rig.pose(ctx, 'offer', 0.7);
    await say(Pc[0]);                         // "You'll be wanting a signature."
    // parcel leaves the inventory and lands in his hands
    const holdLocal = V(0, 0.98, 0.33);
    const holdWorld = rig.group.localToWorld(holdLocal.clone());
    rig.pose(ctx, 'hold', 0.9);
    await w(this._flyParcelOut(holdWorld));
    inventory.setVisible(false);
    this.parcel.position.copy(holdLocal);
    this.parcel.rotation.set(0, 0, 0);
    this.parcel.scale.setScalar(0.01);
    rig.group.add(this.parcel);
    audio.play('drop', { gain: 0.6 });
    await w(tween.to(this.parcel.scale, { x: 1, y: 1, z: 1 }, { duration: 0.45, ease: 'outBack' }));
    // tilt the parcel toward us a touch so the label reads
    tween.to(this.parcel.rotation, { x: 0.55 }, { duration: 0.6 });
    // the quill appears in his right hand
    this.quill.scale.setScalar(0.001);
    this.quill.position.set(0, -0.03, 0.02);
    this.quill.rotation.set(0.6, 0, -0.5);
    rig.arms.R.hand.add(this.quill);
    tween.to(this.quill.scale, { x: 1, y: 1, z: 1 }, { duration: 0.4, ease: 'outBack' });
    const close = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 2.0).setY(1.6);
    this.shot(close, AT_DOOR.clone().addScaledVector(TO_CIRCLE, 0.3).setY(1.15), 36, 1.2);
    const n3 = dialogue.say(Pc[1]);           // "He signs with a flourish. The warded seal opens…"
    await w(rig.pose(ctx, 'sign', 0.6));
    audio.play('paperRustle', { gain: 0.6 });
    tween.to(rig.cur, { jitter: 1 }, { duration: 0.2 });
    const sig = { k: 0 };
    let lastScratch = 0;
    await w(tween.to(sig, { k: 1 }, {
      duration: 1.8, ease: 'inOutSine',
      onUpdate: () => {
        this.parcel.userData.signature(sig.k);
        if (sig.k - lastScratch > 0.18) { lastScratch = sig.k; audio.play('page', { gain: 0.35, pitch: 1.4 + Math.random() * 0.4 }); }
      },
    }));
    tween.to(rig.cur, { jitter: 0 }, { duration: 0.2 });
    tween.to(this.quill.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: 0.35 });
    rig.pose(ctx, 'hold', 0.5);
    await w(tween.delay(0.35));
    // the seal pops
    const pu = this.parcel.userData;
    audio.play('unlock', { gain: 0.6, pitch: 1.3 });
    audio.play('sparkle');
    P.burst(ctx, this.parcel, [0, pu.size.H + 0.02, 0], { color: '#ff9a7a', color2: '#ffe2a0', count: 60, radius: 0.25, duration: 1.0, size: 0.02 });
    tween.to(pu.seal.position, { y: pu.size.H + 0.12, x: 0.06 }, { duration: 0.5, ease: 'outQuad' });
    tween.to(pu.seal.rotation, { x: 2.2, z: 1.2 }, { duration: 0.5 });
    tween.to(pu.seal.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: 0.5, delay: 0.25 });
    tween.to(pu.strings.scale, { x: 1.3, z: 1.3 }, { duration: 0.25 }).then(() => { pu.strings.visible = false; });
    await w(tween.delay(0.4));
    // the wrapping opens
    audio.play('paperRustle');
    for (const f of pu.flaps) tween.to(f.rotation, { z: -2.5 * f.userData.side }, { duration: 0.9, ease: 'outBack' });
    // the book rests inside, cover up
    this.book.position.set(0, 0.03, 0);
    this.book.rotation.set(-Math.PI / 2, 0, 0);
    this.book.scale.setScalar(0.88);
    this.parcel.add(this.book);
    await w(n3);
    // book rises and turns to face us
    const bookAt = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 0.5).setY(1.5);
    const camBook = bookAt.clone().addScaledVector(TO_CIRCLE, 0.66).add(V(0, -0.02, 0));
    this.set.attach(this.book);
    const q0 = this.book.quaternion.clone();
    const dummy = new THREE.Object3D(); dummy.position.copy(bookAt); dummy.lookAt(camBook); const q1 = dummy.quaternion.clone();
    const p0 = this.book.position.clone(), s0 = this.book.scale.x;
    audio.play('sparkle');
    audio.play('success', { gain: 0.7 });
    rig.pose(ctx, { L: { x: -0.95, z: -0.6, ex: -0.7, ez: 0 }, R: { x: -0.95, z: 0.6, ex: -0.7, ez: 0 }, head: { x: 0.0, y: 0 } }, 0.8);
    tween.to(this.parcel.scale, { x: 0.001, y: 0.001, z: 0.001 }, { duration: 0.6, delay: 0.6, ease: 'inBack' });
    const bookSparkles = P.sparkles({ box: [0.5, 0.6, 0.2], center: [0, 0, 0], count: 26, color: '#fff2c0', color2: '#ffd08a', size: 0.03 });
    this.book.add(bookSparkles);
    const unSpark = this.animate(bookSparkles);
    this.shot(camBook, bookAt.clone().add(V(0, -0.035, 0)), 34, 1.8);
    await w(tween.run(1.8, (k) => {
      this.book.position.lerpVectors(p0, bookAt, k);
      this.book.quaternion.slerpQuaternions(q0, q1, k);
      this.book.scale.setScalar(s0 + (1 - s0) * k);
      this.book.userData.halo.material.opacity = 0.55 * k;
    }, { ease: 'inOutCubic' }));
    const bob = this.animate((dt, t) => { this.book.position.y = bookAt.y + Math.sin(t * 1.6) * 0.008; });
    await w(tween.delay(0.6));
    await say(Pc[2]);                         // "Inside: Transfiguration Reversal for the Terminally Confident."
    await w(tween.delay(0.5));
    // back out to him
    this.shot(mid, AT_DOOR.clone().setY(1.2), 38, 1.4);
    rig.pose(ctx, 'present', 0.8);
    bob();
    const handsBook = rig.group.localToWorld(V(0, 1.02, 0.34));
    tween.to(this.book.userData.halo.material, { opacity: 0 }, { duration: 1.0 });
    await w(tween.to(this.book.position, { x: handsBook.x, y: handsBook.y, z: handsBook.z }, { duration: 1.0, ease: 'inOutSine' }));
    unSpark(); bookSparkles.removeFromParent();
    rig.group.attach(this.book);
    await say(Pc[3]);                         // "Ah. That arrived. I ordered it a week ago."
    // tuck it under his arm
    rig.pose(ctx, 'bookUnderArm', 0.8);
    tween.to(this.book.position, { x: 0.27, y: 1.04, z: 0.05 }, { duration: 0.8, ease: 'inOutSine' });
    tween.to(this.book.rotation, { x: 0, y: Math.PI / 2, z: 0.12 }, { duration: 0.8, ease: 'inOutSine' });
    await say(Pc[4]);                         // "Well. Good to have a spare."

    // ---- 4. ending.last -------------------------------------------------------------------------
    const wide = AT_DOOR.clone().addScaledVector(TO_CIRCLE, 3.0).addScaledVector(SIDE, -0.55).setY(1.38);
    this.shot(wide, AT_DOOR.clone().setY(1.25), 40, 2.2);
    await w(tween.delay(0.6));
    await say(Ls[0]);                         // "Thank you, courier…"
    rig.wave();
    await say(Ls[1]);                         // "…Do leave the sardines."
    await w(tween.delay(0.4));

    // ---- 5. white-out → credits -----------------------------------------------------------------
    audio.play('whiteout');
    renderer.setBloom(1.6, bloom);
    await w(transitions.whiteOut(1.8));
    await w(tween.delay(0.5));
    await this._credits(run);
  }

  async _credits(run) {
    const ctx = this.ctx;
    const w = this._guard(run);
    const { tween, audio, transitions, state, renderer, hud, inventory } = ctx;
    const time = fmtTime(state.elapsed);

    // completion: in the save (state) and in a key that survives a reset (for the title badge)
    state.set('game.completed', true);
    state.set('game.completedTime', Math.floor(state.elapsed));
    try {
      const best = parseFloat(localStorage.getItem(BEST_KEY));
      if (state.elapsed >= 1 && (!(best > 0) || state.elapsed < best)) // skip dev jumps (elapsed 0)
        localStorage.setItem(BEST_KEY, String(Math.floor(state.elapsed)));
    } catch (e) { /* storage blocked */ }
    state.save();

    // swap to the credits stage
    hud.setVisible(false);
    inventory.setVisible(false);
    this.set.visible = false;
    this.stage.visible = true;
    ctx.scene.fog = null;
    ctx.scene.background = new THREE.Color('#05081a');
    renderer.setBloom(0.6, { threshold: 0.75, radius: 0.55 });
    renderer.setExposure(1.0);
    const S = this.stage.position;
    this.shot(V(S.x, S.y + 0.62, S.z + 4.4), V(S.x, S.y + 1.12, S.z), 32);

    const cat = ctx.cat;
    cat.placeAt(this.stage, { position: [-3.2, 0, 0], rotationY: Math.PI / 2, pose: 'stand' });
    cat.setVisible(true);
    cat.lookAt(null);

    const lines = this.lines('credits.lines').map((l) => String(l).split('{time}').join(time));
    this._overlay?.dispose();
    const overlay = createCreditsOverlay(ctx, { lines, time });
    this._overlay = overlay;

    transitions.fadeIn(2.4);
    const rollDone = overlay.roll({ pxPerSec: 36 });

    // the cat's little walk across the bottom of the credits
    const catWalk = (async () => {
      await w(tween.delay(1.6));
      await w(cat.walkTo([-0.35, 0, 0], { duration: 7.5 }));
      await w(tween.delay(0.4));
      await w(tween.to(cat.group.rotation, { y: 0.25 }, { duration: 0.7, ease: 'inOutSine' }));
      cat.lookAt(ctx.camera.camera.position);
      await w(tween.delay(0.8));
      audio.play('purr', { gain: 0.6 });
      await w(cat.react('slowBlink'));
      await w(tween.delay(2.2));
      cat.lookAt(null);
      await w(cat.react('tailFlick'));
      await w(cat.walkTo([3.4, 0, 0], { duration: 9 }));
    })();
    catWalk.catch(() => {});

    await w(rollDone);
    // end card; if the cat already left, he strolls back in and settles in the middle
    const settle = (async () => {
      await catWalk.catch(() => {});
      if (run !== this._run) return;
      cat.placeAt(this.stage, { position: [3.4, 0, 0], rotationY: -Math.PI / 2, pose: 'stand' });
      await cat.walkTo([0.15, 0, 0.2], { duration: 6 });
      if (run !== this._run) return;
      await tween.to(cat.group.rotation, { y: -0.3 }, { duration: 0.6 });
      cat.setPose('loaf', 1.0);
      audio.play('meow', { gain: 0.5 });
    })();
    settle.catch(() => {});
    audio.play('success', { gain: 0.8 });
    const act = await w(overlay.showEnd());
    await w(transitions.fadeOut(0.9));
    this._leave(act);
  }

  /** 'again' = wipe the save and return to a fresh title; 'title' = keep the (completed) save and return to the title. */
  _leave(act) {
    const { state } = this.ctx;
    if (act === 'again') {
      state.reset();
      state.persist = false; // don't let beforeunload re-save the finished run
    } else {
      state.save();
    }
    // Drop dev jump flags (?room=…) so the reload lands on the title; keep harmless view flags.
    const q = new URLSearchParams(location.search);
    const keep = new URLSearchParams();
    for (const k of ['dev', 'mute', 'nobloom', 'lowq']) if (q.has(k)) keep.set(k, q.get(k));
    const qs = keep.toString();
    location.href = location.pathname + (qs ? `?${qs}` : '');
  }

  update(dt, t) {
    if (this.rig) this.rig.update(dt, t);
    this._applyShot(t);
  }

  exit() {
    this._run++;
    const ctx = this.ctx;
    this._overlay?.dispose(); this._overlay = null;
    ctx.hotspots.enabled = true;
    ctx.camera.enabled = true;
    ctx.cat.setVisible(true);
    ctx.hud.setVisible(true);
    ctx.inventory.setVisible(true);
  }
}
