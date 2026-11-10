// Balloon Bop: keep the balloons off the ground, together. Every bop scores,
// a long rally multiplies it, and each balloon that touches the floor costs
// the team a heart. Made to shine in mirror mode, in your own living room.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, pick, clamp, hex, GEO, INKS, INK_THIN, whiteM, flat, inked, addFace, hearts } from './kit.js';

const COLS = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xff9248, 0x4fd8ff, 0x6fd934];
const STRING = (() => { const g = new THREE.BoxGeometry(0.035, 0.5, 0.035); g.translate(0, -0.25, 0); return g; })();
const SHADOW = flat(0x140c2a, { transparent: true, opacity: 0.3, depthWrite: false });
const TOUCH = [['haL', 0.36], ['haR', 0.36], ['head', 0.5], ['elL', 0.24], ['elR', 0.24], ['knL', 0.26], ['knR', 0.26], ['ftL', 0.3], ['ftR', 0.3]];
const WORDS = ['BOP!', 'BOING!', 'BONK!', 'BAP!'];

function makeBalloon(type) {
  const g = new THREE.Group(), color = type === 'gold' ? 0xffd23f : pick(COLS), m = toonMat(color, { rim: 0xffffff, rimAmt: 0.85 });
  const body = inked(GEO.sph, m, INKS); body.scale.set(1, 1.16, 1); g.add(body);
  const knot = inked(GEO.cone, m, INK_THIN); knot.scale.set(0.17, 0.2, 0.17); knot.position.y = -1.3; g.add(knot);
  const shine = new THREE.Mesh(GEO.disc, whiteM); shine.scale.set(0.13, 0.26, 1); shine.position.set(-0.45, 0.5, 0.82); shine.rotation.z = 0.5; g.add(shine);
  addFace(g, 0.97, 0.02, 1.05, type === 'gold' ? 'wow' : 'happy');
  const string = new THREE.Group(); string.position.y = -1.3; g.add(string);
  let at = string; for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(STRING, whiteM); if (i) s.position.y = -0.5; at.add(s); at = s; }
  if (type === 'gold') { const st = inked(GEO.star, toonMat(0xffffff), INK_THIN); st.scale.setScalar(0.3); st.position.set(0, 1.42, 0); g.add(st); }
  g.userData = { m, color, string };
  return g;
}

export class BalloonBop {
  static id = 'balloon'; static title = 'Balloon Bop'; static blurb = 'Keep the balloons off the ground'; static icon = 'balloon';
  static colors = ['#ff5a78', '#a8246b']; static theme = 'toybox'; static music = 'toy'; static stars = [800, 1800, 3200]; static ar = true;
  static howto = ['Bop the balloons back up with hands, head or feet', 'Work together: a long rally multiplies the score', 'A balloon on the floor costs the team a heart', 'The gold balloon is worth extra'];

  constructor(app) {
    this.app = app; this.items = []; this.time = 75; this.elapsed = 0; this.lives = 5; this.rally = 0; this.bestRally = 0; this.done = false;
    this.queue = []; this.goldT = 13; this.windT = 19; this.wind = 0; this.windLeft = 0; this.party = false;
  }
  start() { this.app.hud.setTimer(this.time); this.status(); this.queue.push(0.2); }
  status() { this.app.hud.setStatus(hearts(this.lives, 5) + (this.rally >= 4 ? ` Rally ${this.rally}` : '')); }
  get mult() { return Math.min(5, 1 + Math.floor(this.rally / 8)) * (this.party ? 2 : 1); }

  add(type = 'norm') {
    const { app } = this, k = app.ws, half = Math.max(1, app.half - 1.1 * k), p = app.players.length ? pick(app.players) : null;
    const x = p ? clamp(p.j.hipC.x + rnd(-2.4, 2.4) * p.rig.S, -half, half) : rnd(-half, half);
    const mesh = makeBalloon(type); app.root.add(mesh);
    const shadow = new THREE.Mesh(GEO.disc, SHADOW); shadow.rotation.x = -Math.PI / 2; app.root.add(shadow);
    const it = { mesh, shadow, type, x, y: 4.6 + 1.5 * k, vx: rnd(-0.5, 0.5) * k, vy: -0.6 * k, r: (type === 'gold' ? 0.56 : 0.82) * k, cool: 0, squash: 0, ph: rnd(0, 6), hits: 0, dead: 0, sway: 0 };
    mesh.position.set(x, it.y, 0.2); this.items.push(it); return it;
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, k = app.ws, half = Math.max(1, app.half - 0.3 * k), ground = app.ground;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0 || this.lives <= 0) { this.done = true; return; }
    if (!this.party && this.time <= 14) { this.party = true; hud.banner('Balloon party!', '#ffd23f', 1.6, 'Double points'); fx.speedLines(); audio.hype(true); audio.cheer(1); this.queue.push(0.3, 1.1); }
    // how many balloons are in play grows as the game goes on
    const want = Math.min(4, 1 + Math.floor(this.elapsed / 16) + (players.length > 2 ? 1 : 0)) + (this.party ? 1 : 0);
    if (players.length && this.items.filter(it => it.type === 'norm' && !it.dead).length + this.queue.length < want) this.queue.push(1.0);
    for (let i = this.queue.length - 1; i >= 0; i--) { this.queue[i] -= dt; if (this.queue[i] <= 0 && players.length) { this.queue.splice(i, 1); this.add(); audio.whoosh(false); } }
    this.goldT -= dt; if (this.goldT <= 0 && players.length) { this.goldT = rnd(15, 21); this.add('gold'); audio.ding(88); }
    // now and then the wind picks up
    this.windT -= dt;
    if (this.windT <= 0) { this.windT = rnd(17, 24); this.wind = (Math.random() < 0.5 ? -1 : 1) * 2.6; this.windLeft = 3; hud.banner('Whoosh!', '#bfeaff', 1.2, 'Here comes the wind'); audio.whoosh(); }
    if (this.windLeft > 0) { this.windLeft -= dt; for (let n = 0; n < 2; n++) fx.spawn(-Math.sign(this.wind) * 8.5, rnd(-3, 4), 0.5, this.wind * 7, 0, 0, 0xffffff, 0.12, 0.6, 0, 0.2); if (this.windLeft <= 0) this.wind = 0; }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh, ud = m.userData, gold = it.type === 'gold';
      if (it.dead > 0) { it.dead -= dt * 5; m.scale.setScalar(it.r * (1 + (1 - it.dead) * 0.7)); if (it.dead <= 0) { m.removeFromParent(); it.shadow.removeFromParent(); this.items.splice(i, 1); } continue; }
      it.cool -= dt; it.squash = Math.max(0, it.squash - dt * 4);
      // light as a balloon: a gentle fall with plenty of air drag
      const term = (gold ? 2.5 : 1.55 + Math.min(0.5, this.elapsed / 120)) * k;
      it.vy -= (gold ? 3.2 : 2.3) * k * dt; if (it.vy < -term) it.vy += (-term - it.vy) * Math.min(1, dt * 5); else if (it.vy > 0) it.vy *= Math.exp(-0.7 * dt);
      it.vx = it.vx * Math.exp(-0.9 * dt) + this.wind * k * dt; it.x += it.vx * dt; it.y += it.vy * dt;
      if (Math.abs(it.x) > half - it.r) { it.x = Math.sign(it.x) * (half - it.r); it.vx = -it.vx * 0.7; }
      if (it.y > 4.5 - it.r * 0.9 && it.vy > 0) { it.y = 4.5 - it.r * 0.9; it.vy = -it.vy * 0.4; }
      it.sway += (clamp(-it.vx * 0.12 / k, -0.5, 0.5) - it.sway) * Math.min(1, dt * 4);
      const q = it.squash, low = it.y - it.r < ground + 1.5 * k && it.vy < 0;
      m.position.set(it.x, it.y, 0.2); m.rotation.z = it.sway + Math.sin(t * 2 + it.ph) * 0.06;
      m.scale.set(it.r * (1 + q * 0.22), it.r * (1 - q * 0.2), it.r);
      ud.string.rotation.z = -it.sway * 1.6 + Math.sin(t * 3 + it.ph) * 0.15; ud.string.children[0].children[0].rotation.z = Math.sin(t * 3.4 + it.ph) * 0.3;
      ud.m.uniforms.uFlash.value = low ? 0.2 + 0.2 * Math.sin(t * 16) : 0;
      const hgt = Math.max(0, it.y - ground); it.shadow.position.set(it.x, ground + 0.03, 0.2); it.shadow.scale.setScalar(it.r * clamp(1.1 - hgt * 0.1 / k, 0.35, 1.1));
      if (gold && Math.random() < dt * 14) fx.spawn(it.x + rnd(-0.4, 0.4) * k, it.y + rnd(-0.4, 0.4) * k, 0.5, 0, -0.4, 0, 0xffd23f, 0.15, 0.5, 0, 1);

      // on the floor: pop
      if (it.y - it.r * 1.1 < ground) {
        const pos = { x: it.x, y: ground + it.r, z: 0.5 }; it.dead = 1;
        fx.burst(pos, { count: 22, colors: [ud.color, 0xffffff], speed: 7, size: 0.24 }); fx.pow(pos, ud.color, 1.2 * k);
        if (gold) { audio.block(0); continue; }
        this.lives--; this.rally = 0; this.status(); audio.bad(); audio.pop(0); fx.shake(0.35); fx.word(pos, 'POP!', '#fff', hex(ud.color));
        for (const p of players) app.avatars[p.slot]?.ouch();
        if (this.lives === 1) hud.banner('Last heart!', '#ff7a9a', 1.2);
        continue;
      }
      if (it.cool > 0) continue;
      let by = null, pt = null, name = '';
      for (const p of players) { for (const [n, pr] of TOUCH) { const c = p.j[n]; if (Math.hypot(c.x - it.x, c.y - it.y) < it.r + pr * p.rig.S) { by = p; pt = c; name = n; break; } } if (by) break; }
      if (!by) continue;
      // bop it away from whatever touched it, and always a little upward
      const S = by.rig.S, prev = by.rig.prev[name], idt = 1 / Math.max(dt, 1 / 120);
      let nx = it.x - pt.x, ny = it.y - pt.y; const d = Math.hypot(nx, ny) || 1; nx /= d; ny /= d;
      const pvx = clamp((pt.x - prev.x) * idt, -12 * S, 12 * S), pvy = clamp((pt.y - prev.y) * idt, -12 * S, 12 * S), push = clamp(pvx * nx + pvy * ny, 0, 9 * S);
      const sp = (gold ? 5.6 : 4.4) * k + push * 0.5;
      it.vx = nx * sp * 0.75 + pvx * 0.12; it.vy = Math.max(ny * sp, (gold ? 3.6 : 3.0) * k) + Math.max(0, pvy) * 0.1; it.cool = 0.28; it.squash = 1; it.hits++;
      const s = by.slot, pos = { x: (it.x + pt.x) / 2, y: (it.y + pt.y) / 2, z: 0.6 };
      this.rally++; this.bestRally = Math.max(this.bestRally, this.rally); this.status();
      const mult = this.mult;
      if (gold && it.hits >= 3) {
        it.dead = 1; audio.gold(); fx.word(pos, 'KA-CHING!', '#ffd23f', '#fff'); fx.confetti(pos, 40); fx.ring(pos, 0xffd23f, 2.6 * k, 0.45);
        app.addScore(s, 100 * mult, { x: it.x, y: it.y + it.r }, { cls: 'big', color: '#ffd23f', sub: mult > 1 ? 'x' + mult : '' });
      } else {
        app.addScore(s, (gold ? 30 : 10) * mult, { x: it.x, y: it.y + it.r }, { color: gold ? '#ffd23f' : undefined, sub: mult > 1 ? 'x' + mult : '', cheer: 0.35 });
        audio.pop(Math.min(10, this.rally % 11)); if (gold) audio.ding(84 + it.hits * 2);
      }
      fx.pow(pos, 0xffffff, 0.75 * k); fx.burst(pos, { count: 8, colors: [ud.color, 0xffffff], speed: 5, size: 0.2 });
      if (push > 5 * S) { fx.word(pos, pick(WORDS), '#fff', hex(ud.color)).classList.add('small'); fx.shake(0.1); }
      if (this.rally % 8 === 0) { fx.word({ x: 0, y: 2.6 }, `RALLY ${this.rally}!`, '#fff', '#ff5a78'); audio.ding(79 + Math.min(12, this.rally / 4)); for (const p of players) app.avatars[p.slot]?.cheer(0.8); }
    }
  }

  results() { return { title: this.lives <= 0 ? 'All popped!' : undefined, note: `Longest rally: ${this.bestRally} bops` }; }
  lookTarget(p) { let best = null, bd = 1e9; for (const it of this.items) { const d = Math.hypot(it.x - p.j.head.x, it.y - p.j.head.y); if (!it.dead && d < bd) { bd = d; best = it; } } return best; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const bots = this.app.sim.bots, sy = bot.floor + bot.h * 0.8, reach = bot.h * 0.4, up = [[150, 15], [150, 15]];
    // each pretend player looks after the balloons nearest to where they stand, lowest first
    const mine = this.items.filter(it => !it.dead && bots.every(o => o === bot || Math.abs(o.home - it.x) >= Math.abs(bot.home - it.x))).sort((a, b) => a.y - b.y)[0];
    if (!mine) return { x: bot.home, arms: up };
    const hands = [null, null];
    if (mine.y < sy + reach + mine.r && mine.vy < 0.5) { const side = mine.x >= bot.x ? 1 : 0; hands[side] = { x: mine.x, y: mine.y - mine.r * 0.4 }; }
    return { x: mine.x + mine.vx * 0.3, hands, arms: up, handSpeed: 12 };
  }
  dispose() { for (const it of this.items) { it.mesh.removeFromParent(); it.shadow.removeFromParent(); } }
}
