// ENDING — a thin pose layer on top of createWizard() (Cat.js owns the figure; we only post-process its joints).
// createWizard().update() rewrites arms/head every frame; rig.update() calls it and then blends our pose on top.
import * as THREE from 'three';
import { createWizard } from '../../engine/Cat.js';

const lerp = (a, b, k) => a + (b - a) * k;
const near = (a, b) => Math.abs(a - b) < 1e-3;

// Poses: per limb { x, z, ex, ez } (shoulder X/Z, elbow X/Z rotations); head { x (down +), y (left +) }.
// L = his left arm (+X), R = his right arm (-X). Missing limb = let the base animation through (weight 0).
export const POSES = {
  idle: {},
  hands: { L: { x: -0.25, z: -0.3, ex: -1.4, ez: 0.0 }, R: { x: -0.25, z: 0.3, ex: -1.4, ez: 0.0 }, head: { x: 0.4, y: 0 } },
  handL: { L: { x: -0.45, z: -0.12, ex: -1.55, ez: 0.0 }, head: { x: 0.3, y: 0.3 } },
  tail: { head: { x: 0.25, y: 1.0 }, L: { x: 0.25, z: 0.25, ex: -0.4, ez: 0 } },
  shrug: { L: { x: -0.35, z: 0.55, ex: -1.3, ez: 0.0 }, R: { x: -0.35, z: -0.55, ex: -1.3, ez: 0.0 }, head: { x: -0.05, y: 0.15 } },
  reach: { R: { x: -1.5, z: 0.12, ex: -0.25, ez: 0 }, head: { x: -0.05, y: 0 } },
  offer: { R: { x: -1.0, z: 0.2, ex: -0.55, ez: 0 }, head: { x: 0.1, y: 0 } },
  hold: { L: { x: -0.42, z: -0.06, ex: -1.15, ez: 0.0 }, R: { x: -0.42, z: 0.06, ex: -1.15, ez: 0.0 }, head: { x: 0.3, y: 0 } },
  sign: { L: { x: -0.42, z: -0.06, ex: -1.15, ez: 0.0 }, R: { x: -0.5, z: 0.45, ex: -1.3, ez: 0.0 }, head: { x: 0.45, y: -0.1 } },
  present: { L: { x: -0.4, z: -0.3, ex: -1.2, ez: 0.0 }, R: { x: -0.4, z: 0.3, ex: -1.2, ez: 0.0 }, head: { x: 0.0, y: 0 } },
  bookUnderArm: { L: { x: -0.25, z: -0.15, ex: -1.35, ez: 0.0 }, head: { x: 0.0, y: 0 } },
};

export function createRiggedWizard() {
  const wiz = createWizard();
  const inner = wiz.group.children[0];
  const upper = inner.children.find((o) => o.isGroup && near(o.position.y, 1.0));
  const headPivot = upper.children.find((o) => o.isGroup && near(o.position.y, 0.5));
  const shoulders = upper.children.filter((o) => o.isGroup && near(o.position.y, 0.4));
  const limb = (sh) => ({ sh, el: sh.children.find((o) => o.isGroup) });
  const arms = { L: limb(shoulders.find((o) => o.position.x > 0)), R: limb(shoulders.find((o) => o.position.x < 0)) };
  // the right hand mesh (for the quill)
  arms.R.hand = arms.R.el.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry');
  arms.L.hand = arms.L.el.children.find((o) => o.isMesh && o.geometry.type === 'SphereGeometry');

  // live pose values (tweened)
  const cur = {
    L: { x: 0, z: 0, ex: 0, ez: 0, w: 0 },
    R: { x: 0, z: 0, ex: 0, ez: 0, w: 0 },
    head: { x: 0, y: 0, w: 0 },
    jitter: 0, // scribble jitter on the right arm (signing)
  };

  let walkPhase = 0, walking = 0;
  const rig = {
    wiz, group: wiz.group, arms, headPivot, upper, cur,
    wave: () => wiz.wave(),
    bow: () => wiz.bow(),

    /** Blend to a named pose (or a pose object). Limbs absent from the pose fade back to the base animation. */
    pose(ctx, name, duration = 0.7) {
      const p = typeof name === 'string' ? POSES[name] : name;
      const jobs = [];
      for (const k of ['L', 'R', 'head']) {
        ctx.tween.kill(cur[k]);
        if (p[k]) jobs.push(ctx.tween.to(cur[k], { ...p[k], w: 1 }, { duration, ease: 'inOutSine' }));
        else jobs.push(ctx.tween.to(cur[k], { w: 0 }, { duration, ease: 'inOutSine' }));
      }
      return Promise.all(jobs);
    },

    setWalking(v) { walking = v; },

    update(dt, t) {
      wiz.update(dt, t);
      for (const k of ['L', 'R']) {
        const c = cur[k], a = arms[k];
        if (c.w > 0.0005) {
          a.sh.rotation.x = lerp(a.sh.rotation.x, c.x, c.w);
          a.sh.rotation.z = lerp(a.sh.rotation.z, c.z, c.w);
          a.el.rotation.x = lerp(a.el.rotation.x, c.ex, c.w);
          a.el.rotation.z = lerp(a.el.rotation.z, c.ez, c.w);
        }
      }
      if (cur.jitter > 0) {
        const j = cur.jitter;
        arms.R.sh.rotation.z += Math.sin(t * 17) * 0.06 * j + Math.sin(t * 5.3) * 0.08 * j;
        arms.R.el.rotation.x += Math.sin(t * 23 + 1) * 0.07 * j;
      }
      if (walking > 0) {
        walkPhase += dt * 6.2;
        // arms swing opposite to the stride
        arms.L.sh.rotation.x += Math.sin(walkPhase) * 0.22 * walking;
        arms.R.sh.rotation.x -= Math.sin(walkPhase) * 0.22 * walking;
      }
      const h = cur.head;
      if (h.w > 0.0005) {
        headPivot.rotation.x = lerp(headPivot.rotation.x, h.x, h.w);
        headPivot.rotation.y = lerp(headPivot.rotation.y, h.y, h.w);
      }
    },
  };
  return rig;
}

/**
 * Walk the wizard to `to` (parent-local) with a gentle bob and footsteps, then optionally turn to face `faceYaw`.
 * @returns Promise
 */
export async function walkWizard(ctx, rig, to, { speed = 0.85, faceYaw = null } = {}) {
  const g = rig.group;
  const from = g.position.clone();
  const target = new THREE.Vector3(...to);
  const dx = target.x - from.x, dz = target.z - from.z;
  const dist = Math.hypot(dx, dz);
  const turnTo = async (yaw, dur) => {
    let y0 = g.rotation.y;
    while (yaw - y0 > Math.PI) yaw -= Math.PI * 2;
    while (yaw - y0 < -Math.PI) yaw += Math.PI * 2;
    await ctx.tween.to(g.rotation, { y: yaw }, { duration: dur, ease: 'inOutSine' });
  };
  if (dist > 0.01) {
    await turnTo(Math.atan2(dx, dz), 0.6);
    const dur = dist / speed;
    let lastStep = 0;
    rig.setWalking(0);
    const w = { v: 0 };
    ctx.tween.to(w, { v: 1 }, { duration: 0.3 });
    await ctx.tween.run(dur, (k) => {
      g.position.lerpVectors(from, target, k);
      const phase = k * dur * 3.1; // ~1.55 steps per second
      g.position.y = Math.abs(Math.sin(phase * Math.PI)) * 0.022;
      g.rotation.z = Math.sin(phase * Math.PI) * 0.025;
      rig.setWalking(w.v * (k < 0.9 ? 1 : (1 - k) * 10));
      const step = Math.floor(phase);
      if (step !== lastStep) { lastStep = step; ctx.audio.play('footstep', { gain: 0.7 }); }
    }, { ease: 'inOutSine' });
    g.position.y = 0; g.rotation.z = 0;
    rig.setWalking(0);
  }
  if (faceYaw != null) await turnTo(faceYaw, 0.7);
}
