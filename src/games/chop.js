// Paper Chop: folded-paper critters flutter up from below. Slice them with a
// fast hand, chain several in one swing, and leave the thunder clouds alone.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, pick, lerp, clamp, hex, GEO, INKS, INK_THIN, inkM, whiteM, flat, inked, addFace, paper, swing } from './kit.js';

const DART = (() => { const g = new THREE.ConeGeometry(0.4, 1.5, 4); g.rotateZ(-Math.PI / 2); return g; })(); // nose along +x
const WING = (() => { const s = new THREE.Shape(); s.moveTo(0.3, 0); s.lineTo(-0.8, 0.9); s.lineTo(-0.3, 0); s.closePath(); const g = new THREE.ExtrudeGeometry(s, { depth: 0.08, bevelEnabled: false }); g.translate(0, 0, -0.04); return g; })();
const OCTA = new THREE.OctahedronGeometry(0.62), TETRA = new THREE.TetrahedronGeometry(0.8), EAR = new THREE.ConeGeometry(0.22, 0.5, 3), BIT = new THREE.TetrahedronGeometry(0.34);
const PAPER = [0xfff6e6, 0xffdbe6, 0xd9f4ff, 0xe6ffd9, 0xfff1ad], TIPS = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xff9248];
const MATS = new Map(); const mat = (c, o) => { const k = c + (o ? 'r' : ''); if (!MATS.has(k)) MATS.set(k, toonMat(c, o || { rim: 0xffffff, rimAmt: 0.5 })); return MATS.get(k); };
const WORDS = ['SNIP!', 'SWISH!', 'SHHHK!', 'CHOP!'];

function critter(type) {
  const g = new THREE.Group(); let color = 0xffffff;
  if (type === 'cloud') {
    color = 0x4a3a7a; const m = mat(color, { rim: 0xff4f7d });
    for (const [x, y, s] of [[-0.5, -0.05, 0.5], [0, 0.12, 0.66], [0.52, -0.05, 0.48], [0.05, -0.2, 0.55]]) { const b = inked(GEO.sph, m, INKS); b.scale.setScalar(s); b.position.set(x, y, 0); g.add(b); }
    addFace(g, 0.68, 0.08, 0.8, 'angry');
    const bolt = inked(GEO.cone, mat(0xffd23f), INK_THIN); bolt.scale.set(0.16, 0.6, 0.1); bolt.position.set(0.05, -0.55, 0.2); bolt.rotation.z = Math.PI - 0.3; g.add(bolt);
  } else if (type === 'star') {
    color = 0xffd23f; const s = inked(GEO.star, mat(color), INKS); s.scale.setScalar(0.62); g.add(s); addFace(g, 0.12, -0.04, 0.5, 'wow');
  } else {
    color = pick(PAPER); const body = mat(color), tip = mat(pick(TIPS)), kind = Math.floor(rnd(0, 3));
    if (kind === 0) { // a bird: a folded dart with two wings
      g.add(paper(DART, body));
      for (const sg of [-1, 1]) { const w = paper(WING, tip); w.position.set(-0.05, 0.05, sg * 0.1); w.rotation.x = sg * 0.55; g.add(w); }
      addFace(g, 0.31, 0.02, 0.5); g.userData.flap = g.children.slice(1, 3);
    } else if (kind === 1) { // a frog: a squashed diamond with pop-up eyes
      const b = paper(OCTA, body); b.scale.set(1.2, 0.8, 0.9); g.add(b);
      for (const sg of [-1, 1]) { const e = inked(GEO.sph, tip, INK_THIN); e.scale.setScalar(0.2); e.position.set(sg * 0.3, 0.42, 0.2); g.add(e); const k = new THREE.Mesh(GEO.disc, inkM); k.scale.setScalar(0.08); k.position.set(sg * 0.3, 0.44, 0.4); g.add(k); }
      const m = new THREE.Mesh(GEO.smile, inkM); m.scale.setScalar(1.6); m.position.set(0, 0.05, 0.5); m.rotation.z = Math.PI; g.add(m);
    } else { // a fox: a pyramid with two ears
      const b = paper(TETRA, body); b.rotation.set(0.6, 0.8, 0); g.add(b);
      for (const sg of [-1, 1]) { const e = paper(EAR, tip, INK_THIN); e.position.set(sg * 0.36, 0.55, 0); e.rotation.z = -sg * 0.35; g.add(e); }
      addFace(g, 0.42, 0.0, 0.62);
    }
  }
  g.userData.color = color; return g;
}

export class PaperChop {
  static id = 'chop'; static title = 'Paper Chop'; static blurb = 'Slice the paper critters with fast hands'; static icon = 'chop';
  static colors = ['#ff8a3d', '#c2264b']; static theme = 'sunset'; static music = 'chop'; static stars = [900, 2000, 3400]; static ar = true;
  static howto = ['Swing a fast hand through the paper critters', 'Slice a few in a row to build a combo', 'Do not chop the thunder clouds', 'Gold stars are worth the most'];

  constructor(app) {
    this.app = app; this.items = []; this.time = 70; this.elapsed = 0; this.spawnT = 0.5; this.flockT = 13; this.queue = []; this.done = false; this.storm = false;
    this.chain = [0, 0, 0, 0]; this.chainT = [0, 0, 0, 0]; this.stun = [0, 0, 0, 0]; this.sliced = [0, 0, 0, 0];
    this.slashes = Array.from({ length: 8 }, () => { const m = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.1), flat(0xffffff, { transparent: true, depthWrite: false })); const k = new THREE.Mesh(new THREE.PlaneGeometry(1.06, 0.2), flat(0x140c2a, { transparent: true, depthWrite: false })); k.position.z = -0.01; m.add(k); m.visible = false; m.renderOrder = 7; k.renderOrder = 6; m.userData = { t: 1, ink: k }; app.root.add(m); return m; });
    this.slashI = 0;
  }
  start() { this.app.hud.setTimer(this.time); }

  launch(type, p, dx) {
    const { app } = this, k = app.ws, S = p ? p.rig.S : 1.28 * k, half = app.half - 0.7 * k;
    const cx = p ? p.j.hipC.x : rnd(-half, half), head = p ? p.j.head.y : app.ground + 3.9 * k;
    const x = clamp(cx + (dx ?? rnd(-2.3, 2.3)) * S, -half, half), y0 = Math.min(app.ground - 1.2 * k, -5.3), apex = head + rnd(-1.0, 1.0) * S, g = 6 * k;
    const mesh = critter(type); app.root.add(mesh);
    const it = { mesh, type, x, y: y0, vx: clamp((cx - x) * 0.25, -1, 1) * k + rnd(-0.5, 0.5) * k, vy: Math.sqrt(2 * g * Math.max(1, apex - y0)), g, r: (type === 'star' ? 0.5 : type === 'cloud' ? 0.72 : 0.62) * k, rot: rnd(-0.4, 0.4), vr: rnd(-1.6, 1.6), age: 0, life: 0 };
    mesh.scale.setScalar(0.01); mesh.position.set(x, y0, 0.3); this.items.push(it); return it;
  }
  slash(x, y, a, len) { const m = this.slashes[this.slashI]; this.slashI = (this.slashI + 1) % this.slashes.length; m.position.set(x, y, 0.9); m.rotation.z = a; m.scale.set(len, 1, 1); m.userData.t = 0; m.visible = true; }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, k = app.ws;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0) { this.done = true; return; }
    if (!this.storm && this.time <= 13) { this.storm = true; hud.banner('Paper storm!', '#ffd23f', 1.6, 'Double points'); hud.setStatus('Storm! x2'); fx.speedLines(); audio.hype(true); audio.cheer(1); }
    for (let s = 0; s < 4; s++) { this.stun[s] -= dt; if (this.chain[s] > 0) { this.chainT[s] -= dt; if (this.chainT[s] <= 0) { this.chain[s] = 0; hud.setScore(s, app.scores[s], ''); } } }
    for (const m of this.slashes) { if (!m.visible) continue; const u = m.userData; u.t += dt * 6; m.material.opacity = u.ink.material.opacity = 1 - u.t; m.scale.y = 1 + u.t; if (u.t >= 1) m.visible = false; }

    // launching: a steady stream, and now and then a whole flock in a fan
    if (players.length) {
      this.spawnT -= dt * (lerp(0.75, 1.5, Math.min(1, this.elapsed / 55)) + 0.3 * players.length) * (this.storm ? 1.9 : 1);
      if (this.spawnT <= 0) { this.spawnT += 1; const r = Math.random(); this.launch(!this.storm && this.elapsed > 8 && r < 0.13 ? 'cloud' : r < 0.26 ? 'star' : 'critter', pick(players)); }
      this.flockT -= dt;
      if (this.flockT <= 0) { this.flockT = 12; const p = pick(players); for (let i = 0; i < 5; i++) this.queue.push({ at: this.elapsed + i * 0.16, p, dx: (i - 2) * 1.0 }); audio.whoosh(); }
      while (this.queue.length && this.queue[0].at <= this.elapsed) { const q = this.queue.shift(); if (players.includes(q.p)) this.launch('critter', q.p, q.dx); }
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh;
      it.age += dt; it.vy -= it.g * dt; it.x += it.vx * dt; it.y += it.vy * dt; it.rot += it.vr * dt;
      m.position.set(it.x, it.y, 0.3); m.rotation.z = it.type === 'cloud' ? Math.sin(t * 3 + it.x) * 0.15 : it.rot;
      if (it.life > 0) { it.life -= dt; m.scale.setScalar(it.r * Math.max(0.01, it.life / 0.6)); if (it.life <= 0) { m.removeFromParent(); this.items.splice(i, 1); } continue; } // a falling scrap
      m.scale.setScalar(it.r / 0.62 * Math.min(1, it.age * 5));
      if (m.userData.flap) m.userData.flap.forEach((w, n) => { w.rotation.x = (n ? 1 : -1) * (0.55 + Math.sin(t * 12 + it.x) * 0.45); });
      if (it.y < Math.min(app.ground - 2 * k, -5.6) && it.vy < 0) { m.removeFromParent(); this.items.splice(i, 1); continue; }
      let by = null, hand = -1;
      for (const p of players) { if (this.stun[p.slot] > 0) continue; hand = swing(p, it.x, it.y, it.r, 3); if (hand >= 0) { by = p; break; } }
      if (!by) continue;
      const s = by.slot, v = by.rig.handVel[hand], a = Math.atan2(v.y, v.x), pos = { x: it.x, y: it.y, z: 0.6 }, col = m.userData.color;
      this.slash(it.x, it.y, a, it.r * 4.2);
      if (it.type === 'cloud') {
        this.stun[s] = 1.2; this.chain[s] = 0; audio.zap(); audio.bad(); fx.shake(0.5); fx.flash(0.12); fx.hitstop(0.07);
        fx.burst(pos, { count: 26, colors: [0xffd23f, 0x4a3a7a], speed: 9 }); fx.pow(pos, 0xffd23f, 1.4 * k); fx.word(pos, 'ZZZAP!', '#ffd23f', '#4a3a7a');
        app.addScore(s, -40, { x: it.x, y: it.y - 0.9 * k }, { text: '-40', color: '#ff7a9a', sub: '' }); app.avatars[s]?.ouch();
      } else {
        const c = ++this.chain[s]; this.chainT[s] = 0.9; this.sliced[s]++;
        const pts = (it.type === 'star' ? 40 : 10) * Math.min(5, c) * (this.storm ? 2 : 1);
        app.addScore(s, pts, pos, { cls: it.type === 'star' || c >= 3 ? 'big' : '', color: it.type === 'star' ? '#ffd23f' : undefined, sub: c > 1 ? 'x' + Math.min(5, c) : '' });
        if (it.type === 'star') { audio.gold(); fx.word(pos, 'SHINE!', '#ffd23f', '#fff'); } else audio.pop(Math.min(10, c - 1));
        if (c === 4 || c === 8 || c === 12) { fx.word({ x: by.j.head.x, y: by.j.head.y + 1.4 * by.rig.S }, c + ' CHAIN!', '#fff', by.css); audio.ding(79 + c); }
        else if (it.type !== 'star' && Math.random() < 0.14) fx.word(pos, pick(WORDS), '#fff', hex(col)).classList.add('small');
        fx.pow(pos, 0xffffff, it.r * 1.6); fx.confetti(pos, 12, [col, 0xffffff, col], 4); fx.burst(pos, { count: 10, colors: [col, 0xffffff], speed: 6, size: 0.2 }); fx.shake(0.06); app.avatars[s]?.focus(0.4);
        // two scraps fly apart across the cut
        for (const sg of [-1, 1]) { const b = paper(BIT, mat(col)); app.root.add(b); this.items.push({ mesh: b, type: 'scrap', x: it.x, y: it.y, vx: -Math.sin(a) * sg * 3.2 * k + it.vx, vy: Math.cos(a) * sg * 3.2 * k + 2 * k, g: it.g, r: it.r * 1.1, rot: rnd(0, 6), vr: sg * 9, age: 1, life: 0.6 }); }
      }
      m.removeFromParent(); this.items.splice(this.items.indexOf(it), 1);
    }
  }

  results() { const n = Math.max(0, ...this.sliced); return { note: `Most critters sliced: ${n}` }; }
  lookTarget(p) { let best = null, bd = 1e9; for (const it of this.items) { if (it.life > 0) continue; const d = Math.hypot(it.x - p.j.head.x, it.y - p.j.head.y); if (d < bd) { bd = d; best = it; } } return best; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const sx = bot.x, sy = bot.floor + bot.h * 0.8, reach = bot.h * 0.4, clouds = this.items.filter(it => it.type === 'cloud');
    const cands = this.items.filter(it => it.type !== 'cloud' && !it.life && it.y > bot.floor + bot.h * 0.3 && it.y < bot.floor + bot.h * 1.25 && !clouds.some(c => Math.hypot(c.x - it.x, c.y - it.y) < 1.5))
      .map(it => ({ it, d: Math.hypot(it.x - sx, it.y - sy) })).sort((a, b) => a.d - b.d);
    const c = cands[0]; if (!c) return { x: bot.x };
    if (c.d > reach + 0.4) return { x: Math.abs(c.it.x - bot.home) < 2.4 ? c.it.x : bot.x };
    const side = c.it.x >= sx ? 1 : 0, ph = Math.sin(t * 20 + i) > 0 ? 1 : -1, hands = [null, null];
    hands[side] = { x: c.it.x + ph * 0.9, y: c.it.y + ph * 0.5 };
    return { hands, x: bot.x, handSpeed: 18 };
  }
  dispose() { for (const it of this.items) it.mesh.removeFromParent(); for (const m of this.slashes) m.removeFromParent(); }
}
