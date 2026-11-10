// Topple Tower: blocks drift down from the sky. Step under them to stack
// them on your head, then keep steady, because the taller the tower the more
// it sways, and a sudden move sends the top tumbling. Six blocks makes a tower
// that flies off to the bank.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, pick, clamp, hex, GEO, INKS, INK_THIN, whiteM, inked, addFace } from './kit.js';

const COLS = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xff9248, 0x4fd8ff, 0x6fd934];
const BANK = 6;
const SPIKE = (() => { const g = new THREE.ConeGeometry(0.13, 0.4, 6); g.translate(0, 0.2, 0); return g; })();

function makeBlock(type, w, h, color) {
  const g = new THREE.Group();
  if (type === 'cactus') {
    const m = toonMat(0x4fbf5a, { rim: 0xe6ff9a }), tip = toonMat(0xfff1ad);
    const body = inked(GEO.sph, m, INKS); body.scale.set(0.5, 0.46, 0.45); g.add(body);
    for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, s = inked(SPIKE, tip, INK_THIN); s.position.set(Math.cos(a) * 0.42, Math.sin(a) * 0.38, 0); s.rotation.z = a - Math.PI / 2; g.add(s); }
    addFace(g, 0.46, 0.02, 0.62, 'angry'); g.userData = { color: 0x4fbf5a }; return g;
  }
  const m = toonMat(color, { rim: 0xffffff, rimAmt: 0.6 }), body = inked(GEO.box, m, INKS); body.scale.set(w, h, 0.72); g.add(body);
  const shine = new THREE.Mesh(GEO.box, whiteM); shine.scale.set(w * 0.62, h * 0.1, 0.02); shine.position.set(-w * 0.1, h * 0.3, 0.37); g.add(shine);
  if (type === 'gold') { const s = new THREE.Mesh(GEO.star, whiteM); s.scale.set(h * 0.3, h * 0.3, 0.05); s.position.z = 0.38; g.add(s); } else addFace(g, 0.37, -h * 0.08, h * 1.25);
  g.userData = { color, m }; return g;
}

export class ToppleTower {
  static id = 'topple'; static title = 'Topple Tower'; static blurb = 'Stack blocks on your head. Steady now!'; static icon = 'topple';
  static colors = ['#22b8a6', '#1b5fa8']; static theme = 'clouds'; static music = 'sneak'; static stars = [500, 1100, 1800]; static ar = true;
  static howto = ['Step under a falling block to catch it on your head', 'Move gently: a tall tower sways and topples', 'Six blocks make a tower, and a tower goes to the bank', 'Do not catch the prickly cactus'];

  constructor(app) { this.app = app; this.time = 75; this.elapsed = 0; this.done = false; this.rush = false; this.stacks = {}; this.falling = []; this.loose = []; this.wait = {}; this.towers = [0, 0, 0, 0]; this.tallest = 0; }
  start() { this.app.hud.setTimer(this.time); }
  stack(slot) { return this.stacks[slot] || (this.stacks[slot] = []); }
  top(p) { const st = this.stack(p.slot), S = p.rig.S; let y = p.j.head.y + 0.42 * S; for (const b of st) y += b.h; const last = st[st.length - 1]; return { x: last ? last.x : p.j.head.x, y, w: last ? last.w : 0.9 * S }; }

  drop(p) {
    const { app } = this, k = app.ws, half = Math.max(1.2, app.half - 0.9 * k), r = Math.random();
    const type = this.elapsed > 12 && r < 0.14 ? 'cactus' : r < 0.26 ? 'gold' : 'block', w = type === 'cactus' ? 1.0 * k : rnd(0.95, 1.35) * k, h = (type === 'cactus' ? 0.9 : 0.44) * k;
    const color = type === 'gold' ? 0xffd23f : pick(COLS), mesh = makeBlock(type, w / k, h / k, color); mesh.scale.setScalar(k); app.root.add(mesh);
    const x = clamp(p.j.hipC.x + (Math.random() < 0.5 ? -1 : 1) * rnd(0.8, 2.7) * p.rig.S, -half, half);
    this.falling.push({ mesh, type, x, x0: x, y: 4.6 + h, w, h, color, vy: (1.45 + Math.min(0.9, this.elapsed / 70)) * (this.rush ? 1.25 : 1) * (0.6 + 0.4 * k), ph: rnd(0, 6), for: p.slot });
  }
  // blocks that fell off, or a tower on its way to the bank
  toss(b, vx, vy, bank) { this.loose.push({ mesh: b.mesh, x: b.x, y: b.y, vx, vy, vr: rnd(-6, 6), life: bank ? 1.1 : 1.6, bank }); }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, k = app.ws, ground = app.ground;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0) { this.done = true; return; }
    if (!this.rush && this.time <= 14) { this.rush = true; hud.banner('Block rush!', '#ffd23f', 1.6, 'Double points'); hud.setStatus('Rush! x2'); fx.speedLines(); audio.hype(true); audio.cheer(1); }
    const X2 = this.rush ? 2 : 1;

    for (const p of players) {
      const s = p.slot, st = this.stack(s), S = p.rig.S;
      // one block at a time for each player
      if (!this.falling.some(f => f.for === s)) { this.wait[s] = (this.wait[s] ?? 0.4) - dt; if (this.wait[s] <= 0) { this.wait[s] = this.rush ? 0.25 : 0.55; this.drop(p); } }
      // the tower: each block follows the one below on a spring, looser the higher it sits
      let below = p.j.head.x, y = p.j.head.y + 0.42 * S, wBelow = 0.9 * S, fell = -1;
      for (let i = 0; i < st.length; i++) {
        const b = st[i], om = 30 / (1 + 0.3 * i), target = below + b.off;
        for (let n = 0; n < 2; n++) { b.v += (om * om * (target - b.x) - om * b.v) * dt / 2; b.x += b.v * dt / 2; }
        b.y = y + b.h / 2; b.squash = Math.max(0, b.squash - dt * 5);
        const lean = clamp((b.x - target) / b.w, -1, 1);
        b.mesh.position.set(b.x, b.y, 0.25); b.mesh.rotation.z = -lean * 0.5; b.mesh.scale.set(k * (1 + b.squash * 0.15), k * (1 - b.squash * 0.25), k);
        if (fell < 0 && Math.abs(b.x - target) > 0.46 * Math.min(b.w, wBelow)) fell = i;
        below = b.x; y += b.h; wBelow = b.w;
      }
      if (fell >= 0) {
        const gone = st.splice(fell); for (const b of gone) this.toss(b, b.v * 0.6 + rnd(-1, 1), rnd(1, 3) * k);
        audio.bad(); audio.block(0); fx.shake(0.3); fx.word({ x: gone[0].x, y: gone[0].y }, gone.length > 2 ? 'TIMBER!' : 'WHOOPS!', '#fff', '#ff5a78'); app.avatars[s]?.ouch(); hud.setScore(s, app.scores[s], `${st.length}/${BANK}`);
      }
    }
    for (const s in this.stacks) if (!players.some(p => p.slot === +s)) { for (const b of this.stacks[s]) b.mesh.removeFromParent(); delete this.stacks[s]; }

    for (let i = this.falling.length - 1; i >= 0; i--) {
      const f = this.falling[i]; f.y -= f.vy * dt; f.x = f.x0 + Math.sin(t * 1.4 + f.ph) * 0.35 * k;
      f.mesh.position.set(f.x, f.y, 0.25); f.mesh.rotation.z = Math.sin(t * 2 + f.ph) * 0.12;
      let done = false;
      for (const p of players) {
        const top = this.top(p), bottom = f.y - f.h / 2;
        if (bottom > top.y || bottom < top.y - Math.max(0.3 * k, f.vy * dt * 2) || Math.abs(f.x - top.x) > (f.w + top.w) / 2 * 0.82) continue;
        const s = p.slot, st = this.stack(s), pos = { x: f.x, y: top.y, z: 0.5 }; done = true;
        if (f.type === 'cactus') {
          const gone = st.splice(Math.max(0, st.length - 2)); for (const b of gone) this.toss(b, rnd(-3, 3), rnd(2, 4) * k);
          f.mesh.removeFromParent(); audio.zap(); audio.bad(); fx.shake(0.45); fx.pow(pos, 0x4fbf5a, 1.3 * k); fx.burst(pos, { count: 20, colors: [0x4fbf5a, 0xfff1ad], speed: 7 }); fx.word(pos, 'OUCH!', '#fff', '#4fbf5a');
          app.addScore(s, -20, { x: f.x, y: top.y + 0.6 }, { text: '-20', color: '#ff7a9a', sub: `${st.length}/${BANK}` }); app.avatars[s]?.ouch(); break;
        }
        // caught: it keeps a little of how far off-centre it landed
        const off = clamp(f.x - top.x, -top.w * 0.35, top.w * 0.35) * 0.7;
        st.push({ mesh: f.mesh, w: f.w, h: f.h, off, x: top.x + off, y: top.y + f.h / 2, v: 0, squash: 1, color: f.color }); for (const b of st) b.squash = Math.max(b.squash, 0.5);
        const n = st.length; this.tallest = Math.max(this.tallest, n);
        app.addScore(s, (f.type === 'gold' ? 50 : 10) * n * X2, pos, { color: f.type === 'gold' ? '#ffd23f' : undefined, sub: `${n}/${BANK}`, cheer: 0.4 });
        if (f.type === 'gold') audio.gold(); else audio.block(n * 2); fx.burst(pos, { count: 10, colors: [f.color, 0xffffff], speed: 4, size: 0.2 }); fx.ring(pos, f.color, 1.3 * k, 0.3);
        if (n >= BANK) {
          const c = { x: top.x, y: top.y - 0.6, z: 0.5 }; this.towers[s]++;
          st.forEach((b, j) => this.toss(b, (j - 2.5) * 0.4, (7 + j) * k, true)); st.length = 0;
          app.addScore(s, 200 * X2, { x: c.x, y: c.y + 1 }, { cls: 'big', color: '#ffd23f', sub: `0/${BANK}`, cheer: 1 });
          audio.fanfare(); fx.word(c, 'TOWER!', '#ffd23f', p.css); fx.confetti(c, 60); fx.speedLines(); fx.ring(c, 0xffd23f, 3.2, 0.5);
        }
        break;
      }
      if (done) { this.falling.splice(i, 1); continue; }
      if (f.y - f.h / 2 < ground) { const pos = { x: f.x, y: ground + 0.2, z: 0.4 }; fx.burst(pos, { count: 10, colors: [f.color, 0xffffff], speed: 4, size: 0.2 }); fx.pow(pos, 0xffffff, 0.7 * k); audio.tick(); f.mesh.removeFromParent(); this.falling.splice(i, 1); }
    }

    for (let i = this.loose.length - 1; i >= 0; i--) {
      const b = this.loose[i]; b.life -= dt; b.vy -= (b.bank ? -6 : 14) * k * dt; b.x += b.vx * dt; b.y += b.vy * dt;
      b.mesh.position.set(b.x, b.y, 0.25); b.mesh.rotation.z += b.vr * dt; if (b.bank && Math.random() < dt * 30) fx.spawn(b.x, b.y, 0.2, 0, -1, 0, 0xffd23f, 0.16, 0.5, 0, 1);
      if (b.life <= 0 || b.y < ground - 1) { b.mesh.removeFromParent(); this.loose.splice(i, 1); }
    }
  }

  results() { const n = Math.max(0, ...this.towers); return { note: n ? `Most towers banked: ${n}` : `Tallest stack: ${this.tallest} blocks` }; }
  lookTarget(p) { return this.falling.find(f => f.for === p.slot) || null; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const f = this.falling.find(q => q.for === p.slot); if (!f) return { x: bot.x };
    const top = this.top(p), dx = f.x - top.x;
    if (f.type === 'cactus') return { x: Math.abs(dx) < 1.3 ? bot.x - Math.sign(dx || 1) * 1.2 : bot.x };
    return { x: bot.x + dx, arms: [[60, 30], [60, 30]] };
  }
  dispose() { for (const s in this.stacks) for (const b of this.stacks[s]) b.mesh.removeFromParent(); for (const f of this.falling) f.mesh.removeFromParent(); for (const b of this.loose) b.mesh.removeFromParent(); }
}
