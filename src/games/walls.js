// Shape Up: glowing walls rush at you. Each player gets a cut-out sized to
// their own body. Make the shape to slip through, and touch the gems for a
// perfect.
import * as THREE from 'three';
import { toonMat, inked, sceneToon, INK, THIN_INK } from '../toon.js';

const COLS = 32, ROWS = 18, CELL = 0.5, Z0 = -78;
const box = new THREE.BoxGeometry(CELL * 0.86, CELL * 0.86, CELL);
const back = new THREE.BoxGeometry(CELL * 1.01, CELL * 1.01, CELL * 0.9);
const inkWall = new THREE.MeshBasicMaterial({ color: INK });
const tile = new THREE.PlaneGeometry(CELL, CELL);
const gemGeo = new THREE.OctahedronGeometry(0.34);
const gemMat = toonMat(0xffd23f, { rim: 0xffffff });
const PAL = [[0x23e6ff, 0x2b6bff], [0xff4fa3, 0xb03bff], [0xffd23f, 0xff7a3d], [0x4dffa6, 0x16b9c9]];
const R = (a, b, c, d) => [a, b, c, d];
// rectangles [x0, x1, y0, y1] and gems [x, y] in units of the player's height
const POSES = {
  stand: { say: 'Stand tall!', rects: [R(-0.24, 0.24, 0, 1.12)], gems: [], arms: [[12, 8], [12, 8]] },
  duck: { say: 'Duck!', rects: [R(-0.38, 0.38, 0, 0.74)], gems: [], crouch: 1, arms: [[25, 60], [25, 60]] },
  star: { say: 'Star shape!', rects: [R(-0.24, 0.24, 0, 1.12), R(-0.68, 0.68, 0.6, 1.0)], gems: [[-0.5, 0.82], [0.5, 0.82]], arms: [[90, 0], [90, 0]] },
  reach: { say: 'Reach up high!', rects: [R(-0.24, 0.24, 0, 1.12), R(-0.58, -0.08, 0.8, 1.48), R(0.08, 0.58, 0.8, 1.48)], gems: [[-0.3, 1.16], [0.3, 1.16]], arms: [[150, 0], [150, 0]] },
  armL: { say: 'Left hand up!', rects: [R(-0.24, 0.24, 0, 1.12), R(-0.46, 0.02, 0.85, 1.5)], gems: [[-0.17, 1.22]], arms: [[170, 0], [12, 8]] },
  armR: { say: 'Right hand up!', rects: [R(-0.24, 0.24, 0, 1.12), R(-0.02, 0.46, 0.85, 1.5)], gems: [[0.17, 1.22]], arms: [[12, 8], [170, 0]] },
};
// the last three come fast and score double
const RUSH = 3;
const ORDER = [['stand', 0], ['duck', 0], ['star', 0], ['reach', 0], ['stand', -1], ['armL', 0], ['duck', 1], ['star', 0], ['armR', -1], ['reach', 1], ['duck', 0], ['star', -1], ['armL', 1], ['reach', 0], ['star', 0], ['duck', 0], ['reach', 0]];
const tmpC = new THREE.Color(), dummy = new THREE.Object3D();

export class ShapeUp {
  static id = 'walls'; static title = 'Shape Up'; static blurb = 'Make the shape to fit through the wall'; static icon = 'walls';
  static colors = ['#b03bff', '#2b1a8f']; static theme = 'neon'; static music = 'walls'; static stars = [900, 1900, 3000];
  static howto = ['A wall is coming with a hole shaped just for you', 'Copy the glowing shape to slip through', 'Touch the gems for a perfect', 'The last three walls come fast and score double'];

  constructor(app) { this.app = app; this.n = 0; this.wall = null; this.gap = 1.2; this.done = false; this.streak = [0, 0, 0, 0]; this.debris = []; }
  start() { this.app.hud.setStatus(`Wall 1 of ${ORDER.length}`); }

  spawnWall() {
    const [poseId, step] = ORDER[this.n]; const pose = POSES[poseId]; const pal = PAL[this.n % PAL.length];
    const floor = this.app.floorY; const open = new Uint8Array(COLS * ROWS); const holes = {}; const gems = [];
    for (const p of this.app.players) {
      const H = THREE.MathUtils.clamp(p.rig.standH || 3.5, 2, 6.5);
      const half = this.app.tracker.playHalf, pad = Math.min(half, 0.7 * H * (poseId === 'star' ? 1 : 0.5) * (half < 8 ? 0.4 : 1));
      const cx = THREE.MathUtils.clamp(p.j.hipC.x + step * 0.55 * H, -half + pad, half - pad);
      holes[p.slot] = { cx, H, pose };
      for (const [x0, x1, y0, y1] of pose.rects) for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
        const x = -8 + (c + 0.5) * CELL, y = (r + 0.5) * CELL;
        if (x > cx + x0 * H - 0.12 && x < cx + x1 * H + 0.12 && y < y1 * H + 0.12 && y >= y0 * H - 0.3) open[r * COLS + c] = 1;
      }
      for (const [gx, gy] of pose.gems) {
        const m = inked(gemGeo, gemMat, THIN_INK); m.position.set(cx + gx * H, floor + gy * H, 0.4); this.app.root.add(m);
        gems.push({ m, slot: p.slot, got: false });
      }
    }
    let count = 0; for (let i = 0; i < open.length; i++) if (!open[i]) count++;
    const mat = sceneToon(0xffffff, { emissive: pal[0], emissiveIntensity: 0.25 });
    const mesh = new THREE.InstancedMesh(box, mat, count); const cells = []; let k = 0;
    const ink = new THREE.InstancedMesh(back, inkWall, count); ink.instanceMatrix = mesh.instanceMatrix; ink.frustumCulled = false; mesh.add(ink);
    const ghost = new THREE.InstancedMesh(tile, new THREE.MeshBasicMaterial({ color: pal[0], transparent: true, opacity: 0.16, blending: THREE.AdditiveBlending, depthWrite: false }), open.length - count); let g = 0;
    for (let r = 0; r < ROWS; r++) for (let c = 0; c < COLS; c++) {
      const x = -8 + (c + 0.5) * CELL, y = (r + 0.5) * CELL; dummy.position.set(x, y, 0); dummy.rotation.set(0, 0, 0); dummy.scale.setScalar(1); dummy.updateMatrix();
      if (open[r * COLS + c]) { ghost.setMatrixAt(g++, dummy.matrix); continue; }
      // cells that border the hole glow brighter
      let edge = false; for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) { const rr = r + dr, cc = c + dc; if (rr >= 0 && rr < ROWS && cc >= 0 && cc < COLS && open[rr * COLS + cc]) edge = true; }
      mesh.setMatrixAt(k, dummy.matrix); tmpC.set(pal[0]).lerp(new THREE.Color(pal[1]), r / ROWS); if (edge) tmpC.set(0xffffff); else if ((r + c) % 2) tmpC.multiplyScalar(0.8);
      mesh.setColorAt(k, tmpC); cells.push([x, y]); k++;
    }
    mesh.position.set(0, floor, Z0); ghost.position.set(0, floor, 0.05); mesh.frustumCulled = false; ghost.frustumCulled = false;
    this.app.root.add(mesh, ghost);
    const rush = this.n >= ORDER.length - RUSH; const T = rush ? 2.35 : Math.max(2.5, 4.3 - this.n * 0.14);
    if (this.n === ORDER.length - RUSH) { this.app.fx.speedLines(); this.app.audio.cheer(0.8); this.app.audio.hype(true); }
    this.wall = { mesh, ghost, mat, open, cells, holes, gems, z: Z0, v: -Z0 / T, state: 'approach', floor, pal, pose, step, rush };
    const say = step ? (step < 0 ? 'Scoot left! ' : 'Scoot right! ') : '';
    this.app.hud.banner(say + pose.say, rush ? '#ffd23f' : '#fff', rush ? 1.1 : 1.4, this.n === ORDER.length - RUSH ? 'Final rush! Double points' : ''); this.app.audio.whoosh(true);
    this.app.hud.setStatus(`Wall ${this.n + 1} of ${ORDER.length}`);
  }

  blocked(w, x, y) {
    const c = Math.floor((x + 8) / CELL), r = Math.floor((y - w.floor) / CELL);
    if (c < 0 || c >= COLS || r < 0 || r >= ROWS) return false; return !w.open[r * COLS + c];
  }

  judge(w) {
    const { fx, audio } = this.app; let anyFail = false, anyPass = false;
    for (const p of this.app.players) {
      const j = p.j, s = p.slot; let hits = 0; const bad = [];
      for (const n of ['nose', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'hipL', 'hipR', 'knL', 'knR']) if (this.blocked(w, j[n].x, j[n].y)) { hits++; bad.push(j[n]); }
      const head = { x: j.head.x, y: j.head.y + 1.3 };
      if (hits >= 2) {
        anyFail = true; this.streak[s] = 0; fx.word(head, 'CRASH!', '#fff', '#ff4d6d'); fx.pow(bad[0], 0xffffff, 1.6); fx.burst(bad[0], { count: 40, colors: [w.pal[0], 0xffffff], speed: 10 }); this.app.avatars[s]?.ouch();
        this.app.hud.setScore(s, this.app.scores[s], '');
      } else {
        anyPass = true; this.streak[s]++; const st = this.streak[s]; let pts = 100 + Math.min(4, st - 1) * 25; let got = 0, need = 0; const H = w.holes[s]?.H || 3.5;
        for (const gm of w.gems) if (gm.slot === s) { need++; if (Math.min(j.haL.distanceTo(gm.m.position), j.haR.distanceTo(gm.m.position)) < 0.28 * (w.holes[s]?.H || 3.5) + 0.3) { got++; gm.got = true; fx.burst(gm.m.position, { count: 20, color: 0xfff27a, speed: 6 }); fx.pow(gm.m.position, 0xffd23f, 0.9); } }
        pts += got * 50; if (w.rush) pts *= 2; const perfect = need > 0 ? got === need : true;
        fx.word(head, perfect ? 'PERFECT!' : 'WHOOSH!', perfect ? '#ffd23f' : '#fff', p.css);
        this.app.addScore(s, pts, { x: j.chest.x, y: j.chest.y - 0.2 * H }, { cls: perfect ? 'big' : '', sub: st > 1 ? st + ' in a row' : '', cheer: 1 });
        fx.ring(j.chest, p.color, 3.2, 0.5);
      }
    }
    for (const gm of w.gems) gm.m.removeFromParent();
    w.ghost.removeFromParent();
    if (anyFail) {
      audio.smash(); audio.bad(); fx.shake(0.9); fx.hitstop(0.09);
      const n = w.cells.length; w.pos = new Float32Array(n * 3); w.vel = new Float32Array(n * 3); w.rot = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) { const [x, y] = w.cells[i]; w.pos[i * 3] = x; w.pos[i * 3 + 1] = y; w.vel[i * 3] = (Math.random() - 0.5) * 9 + x * 0.5; w.vel[i * 3 + 1] = Math.random() * 9 + 1; w.vel[i * 3 + 2] = -6 - Math.random() * 14; w.rot[i * 3] = Math.random() * 9; w.rot[i * 3 + 1] = Math.random() * 9; }
      w.state = 'shatter'; w.t = 0;
    } else { if (anyPass) { audio.perfect(); audio.whoosh(false); } w.state = 'pass'; }
    this.n++; this.gap = this.n >= ORDER.length - RUSH ? 0.5 : 0.9;
  }

  update(dt, t, players) {
    const w = this.wall;
    if (!w) {
      this.gap -= dt;
      if (this.gap <= 0) { if (this.n >= ORDER.length) { this.done = true; return; } if (players.length) this.spawnWall(); }
      return;
    }
    if (w.state === 'approach') {
      w.z += w.v * dt; w.mesh.position.z = w.z;
      const k = 1 - w.z / Z0; w.ghost.material.opacity = 0.1 + 0.16 * k + 0.05 * Math.sin(t * 10);
      for (const gm of w.gems) { gm.m.rotation.y = t * 3; gm.m.scale.setScalar(1 + Math.sin(t * 6) * 0.15); }
      if (w.rush && Math.random() < dt * 30) this.app.fx.spawn((Math.random() - 0.5) * 15, w.floor + Math.random() * 8.5, w.z, 0, 0, 30, w.pal[0], 0.5, 0.5, 0, 0);
      if (w.z >= -0.2) this.judge(w);
    } else if (w.state === 'pass') {
      w.z += w.v * 1.4 * dt; w.mesh.position.z = w.z;
      if (w.z > 15) { this.removeWall(); }
    } else {
      w.t += dt; const n = w.cells.length;
      for (let i = 0; i < n; i++) {
        w.vel[i * 3 + 1] -= 22 * dt; for (let a = 0; a < 3; a++) w.pos[i * 3 + a] += w.vel[i * 3 + a] * dt;
        if (w.pos[i * 3 + 1] < 0.2 && w.vel[i * 3 + 1] < 0) { w.vel[i * 3 + 1] *= -0.4; w.pos[i * 3 + 1] = 0.2; }
        dummy.position.set(w.pos[i * 3], w.pos[i * 3 + 1], w.pos[i * 3 + 2]); dummy.rotation.set(w.rot[i * 3] * w.t, w.rot[i * 3 + 1] * w.t, 0); dummy.scale.setScalar(Math.max(0.01, 1 - w.t / 1.5)); dummy.updateMatrix(); w.mesh.setMatrixAt(i, dummy.matrix);
      }
      w.mesh.instanceMatrix.needsUpdate = true;
      if (w.t > 1.5) this.removeWall();
    }
  }
  removeWall() { const w = this.wall; if (!w) return; w.mesh.removeFromParent(); w.ghost.removeFromParent(); w.mat.dispose(); w.mesh.dispose(); w.ghost.dispose(); for (const gm of w.gems) gm.m.removeFromParent(); this.wall = null; }

  lookTarget() { const w = this.wall; return w && w.state === 'approach' ? { x: 0, y: 1 } : null; }
  botIntent(i, p, bot, t, playing) {
    const w = this.wall; const h = w && p && w.holes[p.slot];
    if (!playing || !h || w.state !== 'approach') return { followPointer: false };
    return { x: h.cx, crouch: h.pose.crouch || 0, arms: h.pose.arms, followPointer: false };
  }
  dispose() { this.removeWall(); }
}
