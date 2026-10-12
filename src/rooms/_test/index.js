// ENGINE test room — exercises every engine API. Reach it with ?room=_test&dev=1
// (add &keep to keep the save across reloads and verify persistence).
import * as THREE from 'three';
import { Room } from '../../engine/Room.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import * as P from '../../engine/props/particles.js';
import * as L from '../../engine/props/lights.js';
import { makeTextPlane, makeCanvasPlane } from '../../engine/props/text.js';

const c = (text) => ({ who: 'cat', text });
const n = (text) => ({ who: 'narrator', text });

const SCRIPT = {
  '_test.intro': [n('A test chamber. Everything here exists to be poked.'), c("Don't mind me. I'm an ordinary *test* cat.")],
  'early._test': [c('Look around first. Drag to turn your head. Or don\'t. I\'m a cat.')],
  'hint._test_box.1': [c('That box on the pedestal looks pleased with itself.')],
  'hint._test_box.2': [c('There is a note on the little table. Notes are for reading, I am told.')],
  'hint._test_box.3': [c('Moon, sun, star. Left to right. Honestly.')],
  'hint._test_drawer.1': [c('Desks have drawers. Drawers have locks. Locks have keys.')],
  'hint._test_drawer.2': [c('The jar on the shelf rattles. Jars should not rattle.')],
  'hint._test_drawer.3': [c('Take the key from the jar. Use it on the desk drawer.')],
  'idle._test': [[c('I have nothing further to add.')], [c('Frankly, you are doing fine.')], [c('One imagines the engine works.')]],
  '_test.books': ['"Unit Tests for the Arcane"', '"Raycasting: A Memoir"', '"So You\'ve Been Turned Into a Test Fixture"'],
  '_test.zap': 'The rune bites. Your fingers hum for a while.',
  '_test.door.open': 'The door is open. Beyond it: more test. Nowhere to go.',
  '_test.drawer.locked': [c('Locked. One imagines there is a key. One is a cat, so one does not.')],
  '_test.drawer.open': [c('It sticks. You have to lift and— I imagine. Cats don\'t use drawers.')],
  '_test.jar.key': 'You fish a small brass key out of the jar.',
  '_test.jar.empty': 'An empty jar. It looks relieved.',
  '_test.window': 'Rain, or the idea of rain. You toggle it with your mind.',
  '_test.frame.close': 'A portrait of a cat. Remarkably ordinary. Suspiciously so.',
  '_test.lever': 'Clunk. Nothing happens. Deeply satisfying.',
  '_test.box.solved': [n('The dials click home. The lid lifts on its own.'), c('Oh good. It works. I mean — what a surprise.')],
  '_test.choice': {
    prompt: [c('Sit in my chair, would you? Go on. I dare you.')],
    options: [
      { text: 'Sit down anyway.', reply: [c('Bold. Wrong, but bold.')] },
      { text: 'Apologise to the chair.', reply: [c('The chair accepts. I do not.')] },
    ],
  },
};
const PAPERS = {
  '_test.note': { title: 'A note', style: 'diary', body: 'As the night goes:\nfirst the *moon*, then the *sun*, then the *star*.\n\nLeft to right. Don\'t make me write it twice.\n— B.Q.' },
  '_test.letter': { title: 'Engine Test Letter', style: 'letter', body: 'Dear Courier,\n\nIf you are reading this, the drawer opened, the key was consumed, and the paper panel works.\n\nKindly do not touch the cat.', signature: '— The Management' },
  '_test.chalk': { title: 'TEST RECIPE', style: 'chalk', body: 'i.   Raycast one hotspot\nii.  Tween one camera\niii. Stir until it renders' },
};

const SYMBOLS = ['moon', 'sun', 'star', 'eye'];
const SOLUTION = [0, 1, 2]; // moon, sun, star

function drawSymbol(g, kind, x, y, s) {
  g.save(); g.translate(x, y);
  g.fillStyle = '#f3dc9a'; g.strokeStyle = '#2b1a10'; g.lineWidth = s * 0.08;
  g.beginPath();
  if (kind === 'moon') { g.arc(0, 0, s * 0.4, 0.4, Math.PI * 2 - 0.4); g.arc(s * 0.18, 0, s * 0.3, Math.PI * 2 - 0.9, 0.9, true); }
  else if (kind === 'sun') { for (let i = 0; i < 16; i++) { const a = (i / 16) * Math.PI * 2, r = i % 2 ? s * 0.25 : s * 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2 - Math.PI / 2, r = i % 2 ? s * 0.17 : s * 0.42; g.lineTo(Math.cos(a) * r, Math.sin(a) * r); } }
  else { g.ellipse(0, 0, s * 0.42, s * 0.22, 0, 0, Math.PI * 2); }
  g.closePath(); g.fill(); g.stroke();
  if (kind === 'eye') { g.fillStyle = '#2b1a10'; g.beginPath(); g.arc(0, 0, s * 0.1, 0, Math.PI * 2); g.fill(); }
  g.restore();
}

export default class TestRoom extends Room {
  static id = '_test';
  static title = 'Engine Test Chamber';
  static vantage = { position: [0, 1.6, 2.4], lookAt: [0, 1.25, -1], yawLimit: 70, pitchLimit: 25 };
  static puzzleOrder = ['_test_box', '_test_drawer'];

  async build() {
    const { ctx } = this;
    const { hotspots, state, dialogue, papers } = ctx;
    dialogue.addScript(SCRIPT);
    papers.add(PAPERS);
    const G = this.group;

    this.background = new THREE.Color('#0b0806');
    this.fog = new THREE.FogExp2('#140d08', 0.035);
    this.envIntensity = 0.4;

    // ---- shell & lighting -------------------------------------------------------------------
    G.add(F.roomShell({ w: 6, d: 6, h: 3.6, wainscot: 0.9, beams: 3 }));
    G.add(L.ambientRig({ hemi: 0.4, ambientIntensity: 0.22 }));
    const moon = L.keyLight({ color: '#9fb8ff', intensity: 6, position: [0.6, 3.2, -4.5], target: [0.4, 0, 0.6], angle: 0.45 });
    G.add(moon);
    const fire = L.flickerLight({ color: '#ff9a4a', intensity: 3.5, distance: 7, castShadow: true });
    fire.position.set(2.2, 0.9, -2.2);
    G.add(fire);

    const rug = F.rug({ w: 2.2, d: 2.8 }); rug.position.set(0, 0, -0.2); G.add(rug);

    // ---- north wall: bookshelf, window, portrait ----------------------------------------------
    const shelf = F.bookshelf({ w: 1.6, h: 2.3, seed: 4 });
    shelf.position.set(-1.7, 0, -2.78);
    G.add(shelf);
    hotspots.add({ id: 'bookshelf', object: shelf, label: 'Bookshelf', onClick: () => dialogue.caption('_test.books') });

    const win = F.windowFrame({ w: 1.0, h: 1.7, rain: 0.8, shaftTarget: [0.3, -0.95, 2.6] });
    win.position.set(0.5, 0.95, -2.98);
    G.add(win);
    G.add(P.dustMotes({ box: [1.4, 1.8, 2.4], center: [0.6, 1.0, -1.7], count: 260 }));
    let rain = true;
    hotspots.add({ id: 'window', object: win.userData.glass, label: 'Window', onClick: () => { rain = !rain; win.userData.setRain(rain ? 0.8 : 0); dialogue.caption('_test.window'); } });

    const frame = F.pictureFrame({
      w: 0.62, h: 0.8, style: 'gilt',
      draw: (g, w, h) => {
        const gr = g.createRadialGradient(w / 2, h * 0.45, 10, w / 2, h / 2, w);
        gr.addColorStop(0, '#5a4636'); gr.addColorStop(1, '#1a120c'); g.fillStyle = gr; g.fillRect(0, 0, w, h);
        g.fillStyle = '#8d8f93'; g.beginPath(); g.ellipse(w / 2, h * 0.62, w * 0.3, h * 0.28, 0, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.arc(w / 2, h * 0.36, w * 0.2, 0, Math.PI * 2); g.fill();
        g.beginPath(); g.moveTo(w * 0.33, h * 0.3); g.lineTo(w * 0.36, h * 0.14); g.lineTo(w * 0.45, h * 0.24); g.fill();
        g.beginPath(); g.moveTo(w * 0.67, h * 0.3); g.lineTo(w * 0.64, h * 0.14); g.lineTo(w * 0.55, h * 0.24); g.fill();
        g.fillStyle = '#f0a830'; g.beginPath(); g.arc(w * 0.43, h * 0.35, w * 0.03, 0, 7); g.arc(w * 0.57, h * 0.35, w * 0.03, 0, 7); g.fill();
      },
    });
    frame.position.set(2.0, 1.75, -2.99);
    G.add(frame);
    hotspots.add({
      id: 'portrait', object: frame, label: 'Portrait',
      onClick: () => ctx.camera.focus({ position: [2.0, 1.75, -2.2], lookAt: [2.0, 1.75, -3], scope: 'focus:portrait' }),
    });
    hotspots.add({ id: 'portrait.canvas', object: frame.userData.canvas, label: 'The sitter', scope: 'focus:portrait', onClick: () => dialogue.caption('_test.frame.close') });

    // ---- west wall: rune door -----------------------------------------------------------------
    const door = F.door({ rune: true, frame: 'stone' });
    door.position.set(-2.98, 0, -0.4);
    door.rotation.y = Math.PI / 2;
    G.add(door);
    this.door = door;
    hotspots.add({
      id: 'door', object: door, label: () => (state.isSolved('_test_box') ? 'Door (unsealed)' : 'Sealed door'),
      onClick: () => {
        if (!state.isSolved('_test_box')) {
          ctx.audio.play('zap');
          ctx.transitions.flash('#bfe3ff', 0.4);
          ctx.camera.shake(0.05);
          ctx.cat.react?.('flinch');
          dialogue.caption('_test.zap');
        } else if (ctx.game.registry.has('room1')) ctx.game.goToRoom('room1');
        else {
          ctx.tween.to(door.userData.leaf.rotation, { y: -1.2 }, { duration: 1.2, ease: 'inOutSine' });
          dialogue.caption('_test.door.open');
        }
      },
    });

    // ---- reading corner: armchair, side table, candle, note -----------------------------------
    const chair = F.armchair();
    chair.position.set(-1.7, 0, 0.6); chair.rotation.y = 0.7;
    G.add(chair);
    hotspots.add({ id: 'armchair', object: chair, label: 'Armchair', onClick: () => dialogue.choice('_test.choice') });

    const side = F.table({ w: 0.55, d: 0.55, h: 0.62 });
    side.position.set(-2.2, 0, -0.9);
    G.add(side);
    const cndl = F.candle({ holder: 'stick' });
    cndl.position.set(-2.32, 0.62, -1.0);
    G.add(cndl);
    hotspots.add({ id: 'candle', object: cndl, label: 'Candle', onClick: () => { cndl.userData.setLit(!cndl.userData.lit); ctx.audio.play('candleLight'); } });
    const note = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.2), M.parchment());
    note.rotation.set(-Math.PI / 2, 0, 0.3); note.position.set(-2.1, 0.625, -0.82);
    note.receiveShadow = true;
    G.add(note);
    hotspots.add({ id: 'note', object: note, label: 'A note', onClick: () => papers.show('_test.note') });

    // ---- east wall: desk with drawer, wall shelf with jars, chalkboard -----------------------
    const desk = F.desk({ w: 1.5 });
    desk.position.set(2.6, 0, 0.1); desk.rotation.y = -Math.PI / 2;
    G.add(desk);
    this.desk = desk;
    const drawer = desk.userData.drawer;
    const letter = new THREE.Mesh(new THREE.PlaneGeometry(0.2, 0.26), M.parchment());
    letter.rotation.x = -Math.PI / 2; letter.position.y = 0.002;
    desk.userData.drawerInterior.add(letter);
    const openDrawer = (animate) => {
      const z = drawer.userData.closedZ ?? (drawer.userData.closedZ = drawer.position.z);
      if (animate) return ctx.tween.to(drawer.position, { z: z + 0.32 }, { duration: 0.7, ease: 'outCubic' });
      drawer.position.z = z + 0.32;
    };
    hotspots.add({
      id: 'drawer', object: drawer, label: 'Desk drawer',
      enabled: () => !state.isSolved('_test_drawer'),
      onClick: () => dialogue.say('_test.drawer.locked'),
      useItem: {
        key_brass: () => {
          ctx.inventory.remove('key_brass');
          ctx.audio.play('unlock');
          openDrawer(true);
          state.solve('_test_drawer');
          dialogue.say('_test.drawer.open');
        },
      },
    });
    hotspots.add({ id: 'letter', object: letter, label: 'Letter', enabled: () => state.isSolved('_test_drawer'), onClick: () => papers.show('_test.letter') });
    if (state.isSolved('_test_drawer')) openDrawer(false);

    const flask = F.bottle({ shape: 'flask', r: 0.05, h: 0.2, color: '#9adbb8', contents: '#3fbf7f', glow: 0.9 });
    flask.position.set(2.75, 0.78, 0.55);
    G.add(flask);
    G.add(P.bubbles({ origin: [2.75, 0.8, 0.55], radius: 0.035, rise: 0.08, count: 25, size: 0.012 }));
    const dcandle = F.candle({ holder: 'dish', light: true, intensity: 0.8 });
    dcandle.position.set(2.7, 0.78, -0.45);
    G.add(dcandle);

    const wshelf = F.wallShelf({ w: 1.3 });
    wshelf.position.set(2.99, 1.65, 0.1); wshelf.rotation.y = -Math.PI / 2;
    G.add(wshelf);
    const labels = [['KEYS\n(probably)', '#c9a24a', 0.4], ['Frog\nOpinions', '#5a8a3a', 0.2], ['Bottled\nSighs', '#8aa0c8', 0.6]];
    const jars = labels.map(([t, col, glow], i) => {
      const j = F.jar({ label: t, contents: col, glow, lid: i === 1 ? 'cloth' : i === 2 ? 'brass' : 'cork' });
      j.position.set(-0.4 + i * 0.4, 0, 0.12);
      wshelf.add(j);
      return j;
    });
    const keyJar = jars[0];
    if (state.get('_test.key.taken')) keyJar.userData.setContents('#c9a24a', 0.1, 0.15);
    hotspots.add({
      id: 'keyjar', object: keyJar, label: 'Jar labelled KEYS',
      onClick: () => {
        if (state.get('_test.key.taken')) { dialogue.caption('_test.jar.empty'); return; }
        state.set('_test.key.taken', true);
        keyJar.userData.setContents('#c9a24a', 0.1, 0.15);
        ctx.inventory.add('key_brass', { from: keyJar });
        dialogue.caption('_test.jar.key');
      },
    });
    jars.slice(1).forEach((j, i) => hotspots.add({ id: `jar${i + 1}`, object: j, label: 'A jar', onClick: () => { ctx.audio.glassNote(i * 4); dialogue.caption(i ? 'Sighs, bottled. Mostly yours, soon.' : 'Mostly about rain.'); } }));

    const board = new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.65), M.chalkboard({ title: 'TEST RECIPE', lines: ['i.   Raycast one hotspot', { text: 'ii.  Tween one camera', erase: 0.4 }, 'iii. Stir until it renders'] }));
    board.position.set(2.985, 1.55, -1.7); board.rotation.y = -Math.PI / 2;
    const boardFrame = F.pictureFrame({ w: 1.12, h: 0.77, border: 0.06, style: 'walnut', texture: board.material.map });
    boardFrame.position.set(2.995, 1.55, -1.7); boardFrame.rotation.y = -Math.PI / 2;
    G.add(boardFrame);
    hotspots.add({ id: 'chalkboard', object: boardFrame, label: 'Chalkboard', onClick: () => papers.show('_test.chalk') });

    // ---- brazier with embers -----------------------------------------------------------------
    const brazier = new THREE.Group();
    brazier.add(F.lathe([[0, 0.55], [0.22, 0.6], [0.28, 0.78], [0.3, 0.8], [0, 0.66]], M.iron(), 24));
    for (let i = 0; i < 3; i++) {
      const leg = F.rbox(0.03, 0.66, 0.03, M.iron(), 0.008);
      const a = (i / 3) * Math.PI * 2; leg.position.set(Math.cos(a) * 0.2, 0.33, Math.sin(a) * 0.2); leg.rotation.z = Math.cos(a) * 0.15; leg.rotation.x = -Math.sin(a) * 0.15;
      brazier.add(leg);
    }
    const coals = new THREE.Mesh(new THREE.SphereGeometry(0.24, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2), M.glowing({ color: '#ff5a1a', glow: 1.6, roughness: 0.9 }));
    coals.scale.y = 0.35; coals.position.y = 0.74;
    brazier.add(coals);
    brazier.position.set(2.2, 0, -2.2);
    G.add(brazier);
    G.add(P.embers({ origin: [2.2, 0.8, -2.2], spread: 0.18, rise: 1.3, count: 50 }));
    hotspots.add({ id: 'brazier', object: brazier, label: 'Brazier', onClick: () => { fire.userData.baseIntensity = 7; fire.userData.setLit(true, 0.05); ctx.cat.react?.('flinch'); ctx.tween.delay(0.6).then(() => { fire.userData.baseIntensity = 3.5; fire.userData.setLit(true, 0.8); }); dialogue.caption('It flares. The cat pretends not to have flinched.'); } });

    // ---- pedestal + puzzle box (focus view with 3D controls) -----------------------------------
    const ped = F.pedestal({ h: 0.95, r: 0.17 });
    ped.position.set(0.3, 0, -0.7);
    G.add(ped);
    const plaque = makeTextPlane('PROPERTY OF B. QUINCE', { width: 0.2, font: '700 48px "Cormorant Garamond", Georgia, serif', color: '#3a2410', bg: '#c9a24a' });
    plaque.position.set(0.3, 0.6, -0.7 + 0.115); plaque.rotation.x = -0.05;
    G.add(plaque);

    const box = new THREE.Group();
    box.position.set(0.3, 0.95, -0.7);
    G.add(box);
    const bw = 0.34, bh = 0.18, bd = 0.24;
    const body = F.rbox(bw, bh, bd, M.mahogany(), 0.012); body.position.y = bh / 2; box.add(body);
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const corner = F.rbox(0.03, bh + 0.004, 0.03, M.brass(), 0.004); corner.position.set(sx * (bw / 2 - 0.012), bh / 2, sz * (bd / 2 - 0.012)); box.add(corner);
    }
    const lidPivot = new THREE.Group(); lidPivot.position.set(0, bh, -bd / 2); box.add(lidPivot);
    const lid = F.rbox(bw + 0.01, 0.04, bd + 0.01, M.mahogany(), 0.012); lid.position.set(0, 0.02, bd / 2); lidPivot.add(lid);
    const inlay = makeCanvasPlane(0.2, 0.12, (g, w, h) => { g.fillStyle = '#1a0f08'; g.fillRect(0, 0, w, h); drawSymbol(g, 'moon', w * 0.25, h / 2, h * 0.6); drawSymbol(g, 'sun', w * 0.5, h / 2, h * 0.6); drawSymbol(g, 'star', w * 0.75, h / 2, h * 0.6); });
    inlay.rotation.x = -Math.PI / 2; inlay.position.set(0, 0.041, bd / 2); lidPivot.add(inlay);
    inlay.visible = false; // the clue is in the note; inlay shows after solving
    const glow = new THREE.PointLight('#ffd27a', 0, 1.2, 2); glow.position.set(0, bh - 0.02, 0); box.add(glow);
    const sparkle = P.sparkles({ box: [0.25, 0.2, 0.18], center: [0, bh + 0.06, 0], count: 30 });
    sparkle.visible = false; box.add(sparkle);
    this.box = { lidPivot, glow, sparkle, inlay };

    hotspots.add({
      id: 'box', object: box, label: 'Puzzle box',
      onClick: () => ctx.camera.focus({ position: [0.3, 1.42, -0.18], lookAt: [0.3, 1.04, -0.7], scope: 'focus:box', onExit: () => ctx.dialogue.hideCaption() }),
    });

    // dials (click to rotate one step)
    const dialTex = makeCanvasPlane(0.1, 0.1, (g, w, h) => {
      g.fillStyle = '#c9a24a'; g.beginPath(); g.arc(w / 2, h / 2, w / 2, 0, 7); g.fill();
      g.fillStyle = '#2b1a10'; g.beginPath(); g.arc(w / 2, h / 2, w * 0.44, 0, 7); g.fill();
      SYMBOLS.forEach((s, i) => { const a = -Math.PI / 2 + (i * Math.PI) / 2; drawSymbol(g, s, w / 2 + Math.cos(a) * w * 0.28, h / 2 + Math.sin(a) * h * 0.28, w * 0.26); });
    }, { px: 256 }).material.map;
    this.dials = [];
    const dialVals = state.get('_test.box.dials', [3, 3, 3]);
    for (let i = 0; i < 3; i++) {
      const dial = new THREE.Group();
      dial.position.set(-0.1 + i * 0.1, bh / 2, bd / 2 + 0.004);
      const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.044, 0.014, 32), M.brass());
      rim.rotation.x = Math.PI / 2; dial.add(rim);
      const face = new THREE.Mesh(new THREE.CircleGeometry(0.04, 32), new THREE.MeshStandardMaterial({ map: dialTex, roughness: 0.5, metalness: 0.3 }));
      face.position.z = 0.0075; dial.add(face);
      box.add(dial);
      // symbol i is drawn at angle -90° + i*90° (canvas y-down). Rotating the disc by +i*90° about z brings symbol i to the top pointer.
      dial.userData.value = dialVals[i];
      dial.rotation.z = (dialVals[i] * Math.PI) / 2;
      this.dials.push(dial);
      hotspots.add({
        id: `dial${i}`, object: dial, label: 'Dial', scope: 'focus:box',
        enabled: () => !state.isSolved('_test_box'),
        onClick: () => {
          dial.userData.value = (dial.userData.value + 1) % 4;
          ctx.audio.play('ratchet');
          ctx.tween.to(dial.rotation, { z: dial.rotation.z + Math.PI / 2 }, { duration: 0.25, ease: 'outBack' });
          state.set('_test.box.dials', this.dials.map((d) => d.userData.value));
          this._checkBox();
        },
      });
    }
    // little pointer above each dial
    for (let i = 0; i < 3; i++) {
      const ptr = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.016, 3), M.brass({ polished: true }));
      ptr.rotation.z = Math.PI; ptr.position.set(-0.1 + i * 0.1, bh / 2 + 0.054, bd / 2 + 0.008);
      box.add(ptr);
    }
    // drag lever on the right side (tests onDrag)
    const leverPivot = new THREE.Group(); leverPivot.position.set(bw / 2 + 0.01, bh * 0.6, 0.02); box.add(leverPivot);
    const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.1, 10), M.brass()); arm.position.y = 0.05; leverPivot.add(arm);
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.018, 16, 12), M.velvet({ color: '#7a1c22' })); ball.position.y = 0.1; leverPivot.add(ball);
    leverPivot.rotation.x = -0.5;
    let leverFired = false;
    hotspots.add({
      id: 'lever', object: leverPivot, label: 'Lever (drag)', scope: 'focus:box',
      onDragStart: () => { leverFired = false; },
      onDrag: ({ dy }) => {
        leverPivot.rotation.x = THREE.MathUtils.clamp(leverPivot.rotation.x + dy * 0.01, -0.5, 1.1);
        if (leverPivot.rotation.x > 1.0 && !leverFired) { leverFired = true; ctx.audio.play('unlock', { gain: 0.5 }); dialogue.caption('_test.lever'); ctx.camera.shake(0.01); }
      },
      onDragEnd: () => ctx.tween.to(leverPivot.rotation, { x: -0.5 }, { duration: 0.5, ease: 'outBack' }),
      onClick: () => dialogue.caption('Drag it. Levers are for dragging.'),
    });

    if (state.isSolved('_test_box')) this._showBoxSolved(false);
  }

  _checkBox() {
    const ok = this.dials.every((d, i) => d.userData.value === SOLUTION[i]);
    if (!ok || this.ctx.state.isSolved('_test_box')) return;
    this.ctx.state.solve('_test_box');
    this._showBoxSolved(true);
  }

  async _showBoxSolved(animate) {
    const { ctx } = this;
    const { lidPivot, glow, sparkle, inlay } = this.box;
    sparkle.visible = true; inlay.visible = true;
    if (!animate) {
      lidPivot.rotation.x = -1.9; glow.intensity = 1.2; this.door.userData.setRune(0);
      return;
    }
    ctx.hotspots.lock();
    await ctx.tween.delay(0.3);
    ctx.audio.play('success');
    P.burst(ctx, this.group, [0.3, 1.2, -0.7], { count: 90 });
    ctx.tween.to(glow, { intensity: 1.2 }, { duration: 1 });
    await ctx.tween.to(lidPivot.rotation, { x: -1.9 }, { duration: 1.1, ease: 'outBack' });
    ctx.hotspots.unlock();
    await ctx.dialogue.say('_test.box.solved');
    await ctx.camera.exitFocus();
    ctx.camera.lookAtPoint([-2.9, 1.6, -0.4]);
    ctx.audio.play('unlock');
    await this.door.userData.setRune(0, 1.2);
  }

  prereqMet(id) {
    if (id === '_test_drawer') return true;
    return true;
  }

  enter() {
    const { ctx } = this;
    ctx.cat.placeAt(this.group, { position: [2.55, 0.78, 0.0], rotationY: -Math.PI / 2 - 0.5, pose: 'sit' });
    if (!ctx.state.get('_test.intro.seen')) {
      ctx.state.set('_test.intro.seen', true);
      ctx.tween.delay(0.8).then(() => ctx.dialogue.say('_test.intro'));
    }
  }

  enterTitle() {
    this.ctx.cat.placeAt(this.group, { position: [2.55, 0.78, 0.0], rotationY: -Math.PI / 2 - 0.5, pose: 'sit' });
  }

  exit() {}

  update(dt, t) {}
}
