// Room 2 shared helpers: room-local materials, small prop builders, one-shot effects.
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import * as M from '../../engine/props/materials.js';
import * as F from '../../engine/props/furniture.js';
import { makeCanvas, canvasTexture } from '../../engine/props/textures.js';

const cache = new Map();
const once = (key, make) => { if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };

/**
 * Clear glass for case panes and big flasks. No transmission: any transmissive material makes three.js
 * re-render every opaque object into a transmission target (+100 draw calls here), so this is clearcoat +
 * env reflections at low opacity, single pass.
 */
export function physGlass({ color = '#e8fbf6', roughness = 0.03, opacity = 0.16, unique = false } = {}) {
  const make = () => new THREE.MeshPhysicalMaterial({
    color, metalness: 0, roughness, specularIntensity: 1, clearcoat: 1, clearcoatRoughness: 0.04, envMapIntensity: 1.8,
    side: THREE.DoubleSide, forceSinglePass: true, transparent: true, opacity, depthWrite: false,
  });
  return unique ? make() : once(`pg:${color}:${roughness}:${opacity}`, make);
}

/** Soft round sprite texture (smoke, glows). */
export function softDot() {
  return once('softDot', () => {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    const gr = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,0.55)');
    gr.addColorStop(0.7, 'rgba(255,255,255,0.12)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    return canvasTexture(c);
  });
}

/** Lumpy smoke texture for puffs. */
export function smokeTex() {
  return once('smokeTex', () => {
    const c = makeCanvas(128, 128), g = c.getContext('2d');
    for (let i = 0; i < 14; i++) {
      const x = 64 + (Math.random() - 0.5) * 50, y = 64 + (Math.random() - 0.5) * 50, r = 20 + Math.random() * 26;
      const gr = g.createRadialGradient(x, y, 0, x, y, r);
      gr.addColorStop(0, 'rgba(255,255,255,0.32)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    }
    return canvasTexture(c);
  });
}

/**
 * A coloured smoke puff: sprites expanding and drifting up, then removed. Returns a Promise.
 */
export function smokePuff(ctx, parent, pos, { color = '#7a8a5a', count = 16, radius = 0.7, duration = 2.6, rise = 1.1 } = {}) {
  const grp = new THREE.Group();
  grp.position.set(...pos);
  parent.add(grp);
  const parts = [];
  for (let i = 0; i < count; i++) {
    const mat = new THREE.SpriteMaterial({ map: smokeTex(), color: new THREE.Color(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.15), transparent: true, depthWrite: false, opacity: 0 });
    const s = new THREE.Sprite(mat);
    s.raycast = () => {};
    s.material.rotation = Math.random() * Math.PI * 2;
    const dir = new THREE.Vector3((Math.random() - 0.5) * 2, Math.random() * 0.6 + 0.2, (Math.random() - 0.5) * 2).normalize();
    parts.push({ s, dir, sp: 0.5 + Math.random() * 0.7, sz: 0.25 + Math.random() * 0.35, spin: (Math.random() - 0.5) * 1.5 });
    grp.add(s);
  }
  return ctx.tween.run(duration, (k) => {
    const e = 1 - Math.pow(1 - k, 3);
    for (const p of parts) {
      p.s.position.copy(p.dir).multiplyScalar(radius * e * p.sp);
      p.s.position.y += rise * k * k * 0.8;
      p.s.scale.setScalar(p.sz * (0.4 + e * 1.8));
      p.s.material.opacity = Math.min(1, k * 8) * (1 - k) * 0.85;
      p.s.material.rotation += p.spin * 0.016;
    }
  }).then(() => {
    parent.remove(grp);
    for (const p of parts) p.s.material.dispose();
  });
}

const numCache = new Map();

/** Cream-painted numeral with a dark keyline, wrapped round a cylinder of radius r (facing +Z). ADDED BY polish agent. */
function numeralBand(text, r, h, arc) {
  const key = `band:${text}`;
  let tex = numCache.get(key);
  if (!tex) {
    const W = 256, H = 128, c = makeCanvas(W, H), g = c.getContext('2d');
    g.font = `700 ${H * 1.12}px "Cormorant Garamond", Georgia, serif`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.lineJoin = 'round'; g.lineWidth = 16; g.strokeStyle = 'rgba(42,24,6,0.95)';
    g.strokeText(text, W / 2, H / 2 + H * 0.08);
    g.fillStyle = '#fbefc8'; g.fillText(text, W / 2, H / 2 + H * 0.08);
    tex = canvasTexture(c); tex.anisotropy = 4;
    numCache.set(key, tex);
  }
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 20, 1, true, -arc / 2, arc),
    new THREE.MeshStandardMaterial({ map: tex, emissive: '#fff0c8', emissiveMap: tex, emissiveIntensity: 0.35, transparent: true, roughness: 0.55, metalness: 0.1, depthWrite: false }));
  m.userData.noHighlight = true;
  m.renderOrder = 2;
  return m;
}

/** Stamped brass weight (1/2/4/8). Origin at its base. */
export function weightMesh(n) {
  const g = new THREE.Group(); g.name = `weight${n}`;
  const s = Math.cbrt(n) * 0.012 + 0.006;
  const body = F.lathe([[0, 0], [s * 1.05, 0], [s * 1.1, s * 0.15], [s * 1.0, s * 0.3], [s * 0.95, s * 1.1], [s * 1.0, s * 1.25], [s * 0.7, s * 1.35], [s * 0.35, s * 1.4],
    [s * 0.3, s * 1.6], [s * 0.45, s * 1.8], [s * 0.3, s * 2.0], [0, 2.02 * s]], M.brass({ polished: true }), 24);
  g.add(body);
  // polish: the numeral is painted on a curved band hugging the body (was a flat s*1.3 plane, unreadable from the case view)
  const stamp = numeralBand(String(n), s * 0.975 + 0.0012, s * 0.95, 2.2);
  stamp.position.y = s * 0.68;
  g.add(stamp);
  g.userData.height = 2.02 * s;
  g.userData.radius = s * 1.1;
  return g;
}

/** Brass owl weight with a "7" on its chest. Origin at base. */
export function owlWeight() {
  const g = new THREE.Group(); g.name = 'owl';
  const brass = M.brass({ color: '#b8913e', polished: true });
  const body = F.lathe([[0, 0], [0.034, 0], [0.038, 0.01], [0.04, 0.04], [0.034, 0.068], [0.024, 0.08], [0, 0.082]], brass, 24);
  g.add(body);
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.027, 20, 14), brass);
  head.scale.set(1.1, 0.9, 1); head.position.y = 0.094; g.add(head);
  for (const sx of [-1, 1]) {
    const ear = new THREE.Mesh(new THREE.ConeGeometry(0.008, 0.02, 8), brass);
    ear.position.set(sx * 0.018, 0.118, 0); ear.rotation.z = -sx * 0.35; g.add(ear);
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.009, 12, 10), M.matte('#1a1208', { roughness: 0.3 }));
    eye.position.set(sx * 0.011, 0.097, 0.022); g.add(eye);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.0105, 0.0022, 6, 16), brass);
    ring.position.set(sx * 0.011, 0.097, 0.0215); g.add(ring);
    const wing = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), brass);
    wing.scale.set(0.45, 1.3, 0.9); wing.position.set(sx * 0.034, 0.045, -0.002); g.add(wing);
  }
  const beak = new THREE.Mesh(new THREE.ConeGeometry(0.004, 0.012, 6), brass);
  beak.rotation.x = Math.PI; beak.position.set(0, 0.088, 0.026); g.add(beak);
  const stamp = numeralBand('7', 0.0398, 0.04, 1.5);
  stamp.position.y = 0.04;
  g.add(stamp);
  F.shadowAll(g);
  return g;
}

/** Copper/brass tube along points. */
export function tube(points, radius, mat, { segments = 64, radial = 10, closed = false, tension = 0.2 } = {}) {
  const curve = new THREE.CatmullRomCurve3(points.map((p) => new THREE.Vector3(...p)), closed, 'catmullrom', tension);
  const m = new THREE.Mesh(new THREE.TubeGeometry(curve, segments, radius, radial, closed), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}

/** Merge meshes that share one material into a single mesh (static clutter). */
export function mergeInto(meshes, mat) {
  const geos = meshes.map((m) => { m.updateMatrix(); const g = m.geometry.clone(); g.applyMatrix4(m.matrix); return g.index ? g.toNonIndexed() : g; });
  const out = new THREE.Mesh(mergeGeometries(geos, false), mat);
  out.castShadow = true; out.receiveShadow = true;
  return out;
}

export const tmpV = new THREE.Vector3();

/**
 * Draw-call reduction: merge static meshes that share a material into one mesh per material, per "owner".
 * Owners are the root, every hotspot object / highlight target, and every node flagged userData.dynamic
 * (anything whose transform or visibility changes later). A mesh is merged into its nearest owner, so
 * moving/hiding an owner still moves/hides its merged contents and hover highlight still finds them.
 * Meshes flagged dynamic, with userData.update, shader materials, instancing, invisible materials, hidden
 * meshes and hit proxies are left alone. A node with userData.update is skipped entirely unless it sets
 * userData.mergeInside (then it is an owner and its static children merge into it).
 */
export function mergeStatic(root, ctx) {
  const owners = new Set([root]);
  for (const h of ctx.hotspots._map.values()) {
    owners.add(h.object);
    if (h.highlight && h.highlight.isObject3D) owners.add(h.highlight);
  }
  const buckets = new Map(); // owner → key → meshes
  const keyOf = (m) => {
    const g = m.geometry;
    const attrs = Object.keys(g.attributes).sort().join(',');
    return [m.material.uuid, attrs, m.castShadow ? 1 : 0, m.receiveShadow ? 1 : 0, m.renderOrder, m.userData.noRaycast ? 1 : 0, m.frustumCulled ? 1 : 0].join('|');
  };
  const mergeable = (m) => m.isMesh && !m.isInstancedMesh && !m.isSkinnedMesh && m.visible && !m.userData.dynamic && !m.userData.update
    && !m.userData.hitProxy && !m.userData.noMerge && !Array.isArray(m.material) && m.material.visible !== false
    && !m.material.isShaderMaterial && !m.morphTargetInfluences && !owners.has(m) && m.children.length === 0
    && !!m.geometry.attributes.position;
  const walk = (node, owner) => {
    for (const c of node.children) {
      if (!c.visible) continue;
      const isOwner = owners.has(c) || c.userData.dynamic || c.userData.update || c.isInstancedMesh || c.isPoints || c.isSprite || c.isLight || c.isCamera;
      if (!isOwner && mergeable(c)) {
        let b = buckets.get(owner); if (!b) buckets.set(owner, (b = new Map()));
        const k = keyOf(c); (b.get(k) || b.set(k, []).get(k)).push(c);
      }
      if (c.isPoints || c.isSprite || c.isLight) continue;
      if (c.userData.update && !owners.has(c) && !c.userData.mergeInside) continue; // animated subtree: leave untouched
      walk(c, isOwner ? c : owner);
    }
  };
  root.updateMatrixWorld(true);
  walk(root, root);
  let before = 0, after = 0;
  const inv = new THREE.Matrix4(), mtx = new THREE.Matrix4();
  for (const [owner, b] of buckets) {
    inv.copy(owner.matrixWorld).invert();
    for (const list of b.values()) {
      if (list.length < 2) continue;
      const geos = [];
      for (const m of list) {
        let g = m.geometry.clone();
        if (g.index) g = g.toNonIndexed();
        for (const n of Object.keys(g.morphAttributes)) delete g.morphAttributes[n];
        mtx.multiplyMatrices(inv, m.matrixWorld);
        g.applyMatrix4(mtx);
        if (mtx.determinant() < 0) { // mirrored: flip winding
          const p = g.attributes.position;
          for (let i = 0; i < p.count; i += 3) for (const a of Object.values(g.attributes)) { for (let k = 0; k < a.itemSize; k++) { const t = a.array[(i + 1) * a.itemSize + k]; a.array[(i + 1) * a.itemSize + k] = a.array[(i + 2) * a.itemSize + k]; a.array[(i + 2) * a.itemSize + k] = t; } }
        }
        geos.push(g);
      }
      const merged = mergeGeometries(geos, false);
      if (!merged) continue;
      geos.forEach((g) => g.dispose());
      const out = new THREE.Mesh(merged, list[0].material);
      const s = list[0];
      out.castShadow = s.castShadow; out.receiveShadow = s.receiveShadow; out.renderOrder = s.renderOrder;
      out.frustumCulled = s.frustumCulled; out.name = 'merged:' + (s.name || s.material.type);
      if (s.userData.noRaycast) out.userData.noRaycast = true;
      owner.add(out);
      for (const m of list) m.parent.remove(m);
      before += list.length; after += 1;
    }
  }
  return { before, after };
}
