// Pow Blocks: a wall of comic-book bricks hangs overhead and a bouncy ball
// does the smashing. Your hands, head, elbows and feet are the bats: keep the
// ball in the air and aim it at the bricks. Lose every ball and the team
// loses a heart.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, pick, clamp, hex, GEO, INKS, INK_THIN, inkM, whiteM, glowM, inked, addFace, hearts } from './kit.js';

const COLS = [0xff5a78, 0xffc531, 0x22d3c5, 0x9d6bff, 0xff9248, 0x4fd8ff];
const WORDS = ['POW!', 'BAM!', 'ZAP!', 'BOP!', 'WHAM!', 'KRAK!'];
const BW = 1.5, BH = 0.6, ROWS = [3.0, 2.38, 1.76];
const BATS = [['haL', 0.42], ['haR', 0.42], ['head', 0.5], ['elL', 0.25], ['elR', 0.25], ['ftL', 0.32], ['ftR', 0.32]];
const MATS = new Map(); const mat = (c) => { if (!MATS.has(c)) MATS.set(c, toonMat(c, { rim: 0xffffff, rimAmt: 0.5 })); return MATS.get(c); };
const STEEL = toonMat(0x7d86b8, { rim: 0xffffff }), GOLD = toonMat(0xffd23f, { rim: 0xffffff });
const shineM = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55 });

function makeBrick(type, color) {
  const g = new THREE.Group(), m = type === 'tough' ? STEEL : type === 'gold' ? GOLD : mat(color);
  const body = inked(GEO.box, m, INKS); body.scale.set(BW - 0.12, BH - 0.12, 0.5); g.add(body);
  const shine = new THREE.Mesh(GEO.box, shineM); shine.scale.set(BW - 0.5, 0.07, 0.02); shine.position.set(-0.08, BH / 2 - 0.17, 0.26); g.add(shine);
  if (type === 'tough') for (const sx of [-1, 1]) for (const sy of [-1, 1]) { const r = new THREE.Mesh(GEO.disc, inkM); r.scale.setScalar(0.045); r.position.set(sx * (BW / 2 - 0.2), sy * (BH / 2 - 0.17), 0.26); g.add(r); }
  if (type === 'gold') { const s = new THREE.Mesh(GEO.star, whiteM); s.scale.set(0.17, 0.17, 0.05); s.position.z = 0.27; g.add(s); }
  g.userData = { color: type === 'tough' ? 0x7d86b8 : type === 'gold' ? 0xffd23f : color, body };
  return g;
}

export class PowBlocks {
  static id = 'pow'; static title = 'Pow Blocks'; static blurb = 'Bat the ball up to smash the bricks'; static icon = 'pow';
  static colors = ['#8f6bff', '#3a2bb8']; static theme = 'space'; static music = 'arcade'; static stars = [900, 2000, 3400]; static ar = true;
  static howto = ['Bat the ball upward with hands, head or feet', 'Smash the bricks: more in one go scores more', 'Steel bricks take two hits, gold ones give a second ball', 'Do not let the last ball hit the floor'];

  constructor(app) {
    this.app = app; this.bricks = []; this.balls = []; this.time = 75; this.elapsed = 0; this.lives = 5; this.wave = 0; this.done = false; this.blitz = false;
    this.serveT = 0.4; this.waveT = 0; this.smashed = 0; this.build();
  }
  start() { this.app.hud.setTimer(this.time); this.status(); }
  status() { this.app.hud.setStatus(hearts(this.lives, 5) + ` Wall ${this.wave}`); }

  build() {
    const half = this.app.half, cols = Math.max(3, Math.floor((half * 2 - 0.9) / BW)), w = this.wave++;
    for (let r = 0; r < 3; r++) for (let c = 0; c < cols; c++) {
      const mid = Math.abs(c - (cols - 1) / 2);
      // each wall has its own shape
      const on = w % 4 === 0 ? r > 0 : w % 4 === 1 ? (r + c) % 2 === 0 || r === 2 : w % 4 === 2 ? mid <= (cols - 1) / 2 - (2 - r) * 1.5 : true;
      if (!on) continue;
      const type = (w > 0 && r === 0 && c % 3 === 1) || (w > 1 && r === 1 && c % 4 === 0) ? 'tough' : (r + c * 2 + w) % 9 === 4 ? 'gold' : 'norm';
      const mesh = makeBrick(type, COLS[(c + r * 2 + w) % COLS.length]); this.app.root.add(mesh);
      const b = { mesh, type, x: (c - (cols - 1) / 2) * BW, y: ROWS[r], hp: type === 'tough' ? 2 : 1, age: -(r * 0.08 + c * 0.03), shake: 0 };
      mesh.position.set(b.x, b.y + 3, -0.2); this.bricks.push(b);
    }
  }
  serve(from) {
    const { app } = this, k = app.ws, p = app.players.length ? pick(app.players) : null;
    const mesh = new THREE.Group(), body = inked(GEO.sph, toonMat(0xffffff, { rim: 0x4fd8ff }), INKS); mesh.add(body); addFace(mesh, 0.96, 0, 1.1, 'wow');
    const glow = new THREE.Mesh(GEO.disc, glowM(0xffffff, 0.22)); glow.scale.setScalar(1.9); glow.position.z = -0.3; mesh.add(glow); app.root.add(mesh);
    const x = from ? from.x : (p ? clamp(p.j.hipC.x + rnd(-1.5, 1.5), -app.half + 1, app.half - 1) : 0), a = rnd(-0.5, 0.5);
    const ball = { mesh, x, y: from ? from.y : 1.4, vx: Math.sin(a), vy: from ? 0.6 : -1, r: 0.27 * k, owner: null, combo: 0, cool: 0, boost: 0, spin: 0 };
    const n = Math.hypot(ball.vx, ball.vy); ball.vx /= n; ball.vy /= n; this.balls.push(ball); return ball;
  }
  get speed() { return (4.6 + Math.min(1.8, this.wave * 0.45) + (this.blitz ? 0.8 : 0)) * (0.55 + 0.45 * this.app.ws); }

  smash(b, ball, players) {
    const { app } = this, { fx, audio } = app, pos = { x: b.x, y: b.y, z: 0.4 }, col = b.mesh.userData.color;
    const s = ball.owner ?? players[0]?.slot; b.hp--;
    if (b.hp > 0) { b.shake = 1; b.mesh.userData.body.material = mat(0xb7bfe6); audio.block(2); fx.burst(pos, { count: 8, color: 0xffffff, speed: 4, size: 0.18 }); if (s != null) app.addScore(s, 5, pos, { cls: 'small', cheer: 0 }); return; }
    const c = ++ball.combo, pts = (b.type === 'gold' ? 100 : b.type === 'tough' ? 30 : 10) * Math.min(8, c) * (this.blitz ? 2 : 1); this.smashed++;
    if (s != null) app.addScore(s, pts, pos, { cls: c >= 3 || b.type === 'gold' ? 'big' : '', color: b.type === 'gold' ? '#ffd23f' : undefined, sub: c > 1 ? 'x' + Math.min(8, c) : '', cheer: 0.4 });
    if (b.type === 'gold') { audio.gold(); fx.word(pos, 'BONUS BALL!', '#ffd23f', '#fff'); this.serve({ x: b.x, y: b.y - 0.3 }).owner = ball.owner; } else audio.pop(Math.min(10, c - 1));
    if (c === 3 || c === 5 || c === 8) fx.word(pos, c === 8 ? 'MEGA COMBO!' : pick(WORDS), '#fff', hex(col)); else if (Math.random() < 0.2) fx.word(pos, pick(WORDS), '#fff', hex(col)).classList.add('small');
    fx.pow(pos, col, 1.2); fx.burst(pos, { count: 16, colors: [col, 0xffffff], speed: 7, size: 0.26 }); fx.confetti(pos, 8, [col, 0xffffff], 4); fx.shake(0.07);
    b.mesh.removeFromParent(); this.bricks.splice(this.bricks.indexOf(b), 1);
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, k = app.ws, half = app.half, ground = app.ground;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0 || this.lives <= 0) { this.done = true; return; }
    if (!this.blitz && this.time <= 14) { this.blitz = true; hud.banner('Brick blitz!', '#ffd23f', 1.6, 'Double points'); fx.speedLines(); audio.hype(true); audio.cheer(1); if (this.balls.length) this.serve(); }
    for (const b of this.bricks) { b.age += dt; b.shake = Math.max(0, b.shake - dt * 5); const drop = Math.max(0, 1 - Math.max(0, b.age) * 3.5); b.mesh.position.set(b.x + Math.sin(t * 60) * b.shake * 0.05, b.y + drop * drop * 3, -0.2); b.mesh.visible = b.age > -0.01; b.mesh.rotation.z = Math.sin(t * 1.5 + b.x) * 0.015; }
    // a cleared wall is worth a bonus, and a new one drops in
    if (!this.bricks.length && !this.waveT) { this.waveT = 1.1; hud.banner('Wall smashed!', '#7dffb0', 1.2, '+200 each'); audio.fanfare(); fx.confetti({ x: 0, y: 2.6 }, 80); for (const p of players) app.addScore(p.slot, 200, { x: p.j.head.x, y: p.j.head.y + 1.2 * p.rig.S }, { cls: 'big', cheer: 1 }); }
    if (this.waveT) { this.waveT -= dt; if (this.waveT <= 0) { this.waveT = 0; this.build(); this.status(); } }
    if (!this.balls.length && players.length) { this.serveT -= dt; if (this.serveT <= 0) { this.serve(); audio.whoosh(false); } }

    const sp0 = this.speed;
    for (let i = this.balls.length - 1; i >= 0; i--) {
      const b = this.balls[i]; b.cool -= dt; b.boost = Math.max(0, b.boost - dt * 1.2); b.r = 0.27 * k;
      const sp = sp0 * (1 + b.boost * 0.35); let steps = Math.max(1, Math.ceil(sp * dt / (b.r * 0.8)));
      for (let n = 0; n < steps; n++) {
        b.x += b.vx * sp * dt / steps; b.y += b.vy * sp * dt / steps;
        if (Math.abs(b.x) > half - b.r) { b.x = Math.sign(b.x) * (half - b.r); b.vx = -Math.sign(b.x) * Math.abs(b.vx); audio.tick(); }
        if (b.y > 4.42 - b.r) { b.y = 4.42 - b.r; b.vy = -Math.abs(b.vy); audio.tick(); }
        // bricks: bounce off whichever face was hit
        for (const br of this.bricks) {
          if (br.age < 0.3) continue; const dx = b.x - br.x, dy = b.y - br.y, hx = BW / 2 - 0.05, hy = BH / 2 - 0.05;
          const cx = clamp(dx, -hx, hx), cy = clamp(dy, -hy, hy); if (Math.hypot(dx - cx, dy - cy) > b.r) continue;
          if (Math.abs(dx) / hx > Math.abs(dy) / hy) b.vx = Math.sign(dx) * Math.abs(b.vx); else b.vy = Math.sign(dy) * Math.abs(b.vy);
          this.smash(br, b, players); break;
        }
      }
      // bats: any part of a player
      if (b.cool <= 0) for (const p of players) {
        let hit = null, name = ''; const S = p.rig.S;
        for (const [nm, pr] of BATS) { const c = p.j[nm]; if (Math.hypot(c.x - b.x, c.y - b.y) < b.r + pr * S) { hit = c; name = nm; break; } }
        if (!hit) continue;
        const prev = p.rig.prev[name], idt = 1 / Math.max(dt, 1 / 120), pvx = clamp((hit.x - prev.x) * idt, -10 * S, 10 * S), pvy = clamp((hit.y - prev.y) * idt, -10 * S, 10 * S);
        let nx = b.x - hit.x, ny = b.y - hit.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
        const dot = b.vx * nx + b.vy * ny; if (dot < 0) { b.vx -= 2 * dot * nx; b.vy -= 2 * dot * ny; }
        b.vx += pvx / sp * 0.35; b.vy += pvy / sp * 0.35; if (ny > -0.35) b.vy = Math.max(b.vy, 0.55); // from below or the side it always goes up
        const push = Math.hypot(pvx, pvy); b.boost = clamp(push / (7 * S), 0, 1); b.cool = 0.22; b.owner = p.slot; b.combo = 0;
        const pos = { x: (b.x + hit.x) / 2, y: (b.y + hit.y) / 2, z: 0.6 }; audio.block(4 + (p.slot * 2)); fx.pow(pos, p.color, 0.7 * k); fx.burst(pos, { count: 6, colors: [p.color, 0xffffff], speed: 4, size: 0.18 });
        if (push > 5 * S) { fx.shake(0.1); fx.word(pos, 'WHACK!', '#fff', p.css).classList.add('small'); } app.avatars[p.slot]?.focus(0.4);
        break;
      }
      // never let it settle into a flat, endless bounce
      let n = Math.hypot(b.vx, b.vy) || 1; b.vx /= n; b.vy /= n; if (Math.abs(b.vy) < 0.32) { b.vy = (b.vy < 0 ? -1 : 1) * 0.32; n = Math.hypot(b.vx, b.vy); b.vx /= n; b.vy /= n; }
      b.spin -= b.vx * sp * dt / b.r * 0.5; b.mesh.position.set(b.x, b.y, 0.3); b.mesh.scale.setScalar(b.r); b.mesh.rotation.z = Math.sin(b.spin) * 0.5;
      if (Math.random() < dt * 40) fx.spawn(b.x, b.y, 0.1, 0, 0, 0, b.owner != null ? app.tracker.players[b.owner]?.color ?? 0xffffff : 0xffffff, 0.16 * k, 0.3, 0, 1);
      if (b.y < ground - 0.3) {
        const pos = { x: b.x, y: ground + 0.2, z: 0.5 }; b.mesh.removeFromParent(); this.balls.splice(i, 1); fx.burst(pos, { count: 16, color: 0xffffff, speed: 6 }); fx.ring(pos, 0xffffff, 1.6, 0.35);
        if (this.balls.length) { audio.block(0); continue; }
        this.lives--; this.serveT = 1.1; this.status(); audio.bad(); fx.shake(0.4); fx.word(pos, 'SPLAT!', '#fff', '#ff5a78'); for (const p of players) app.avatars[p.slot]?.ouch();
        if (this.lives === 1) hud.banner('Last heart!', '#ff7a9a', 1.2);
      }
    }
  }

  results() { return { title: this.lives <= 0 ? 'Out of hearts!' : undefined, note: `Bricks smashed: ${this.smashed}` }; }
  lookTarget() { return this.balls[0] || null; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const bots = this.app.sim.bots, sy = bot.floor + bot.h * 0.95, up = [[155, 10], [155, 10]], sp = this.speed;
    // stand where the next falling ball will come down, if nobody else is nearer
    let best = null, bx = 0, bt = 1e9;
    for (const b of this.balls) {
      if (b.vy >= 0) continue; const tt = (b.y - sy) / (-b.vy * sp); if (tt < -0.2 || tt > bt) continue;
      let x = b.x + b.vx * sp * tt; const lim = this.app.half - b.r; if (Math.abs(x) > lim) x = Math.sign(x) * (2 * lim - Math.abs(x));
      if (bots.some(o => o !== bot && Math.abs(o.x - x) < Math.abs(bot.x - x) - 0.01)) continue;
      best = b; bx = x; bt = tt;
    }
    if (!best) return { x: bot.home * 0.8, arms: up };
    const hands = [null, null];
    if (Math.hypot(best.x - bot.x, best.y - sy) < bot.h * 0.5) hands[best.x >= bot.x ? 1 : 0] = { x: best.x, y: best.y - best.r };
    return { x: bx, hands, arms: up, handSpeed: 13 };
  }
  dispose() { for (const b of this.bricks) b.mesh.removeFromParent(); for (const b of this.balls) b.mesh.removeFromParent(); }
}
