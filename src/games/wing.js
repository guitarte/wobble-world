// Wing It: hold your arms out like wings and fly a paper glider through the
// rings. Tip your arms to slide left and right, raise or lower them to climb
// and dive. Stars lead the way, storm clouds get in it.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, clamp, lerp, hex, GEO, INKS, INK_THIN, whiteM, flat, glowM, inked, addFace, paper } from './kit.js';

const Z0 = -92, X_MAX = 6.3, Y_MIN = -0.5, Y_MAX = 3.4, SMALL = 0.55;
// a paper dart seen from behind and above: nose forward (+y), wings swept back
const DART = (() => {
  const n = [0, 1, 0], l = [-0.78, -0.72, 0.14], r = [0.78, -0.72, 0.14], c = [0, -0.5, 0], k = [0, -0.62, -0.34];
  const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute([...n, ...l, ...c, ...n, ...c, ...r, ...n, ...k, ...c], 3)); g.computeVertexNormals(); return g;
})();
const PUFF = flat(0xffffff, { transparent: true, opacity: 0.85, fog: false });

function makeCloud() {
  const g = new THREE.Group(), m = toonMat(0x4a3a7a, { rim: 0xff4f7d });
  for (const [x, y, s] of [[-0.55, -0.05, 0.55], [0, 0.14, 0.72], [0.57, -0.05, 0.52], [0.05, -0.22, 0.6]]) { const b = inked(GEO.sph, m, INKS); b.scale.setScalar(s); b.position.set(x, y, 0); g.add(b); }
  addFace(g, 0.74, 0.1, 0.85, 'angry'); return g;
}

export class WingIt {
  static id = 'wing'; static title = 'Wing It'; static blurb = 'Arms out! Fly through the rings'; static icon = 'wing';
  static colors = ['#3aa0ff', '#2b4fd6']; static theme = 'clouds'; static music = 'sky'; static stars = [1200, 3500, 7000];
  static howto = ['Hold your arms out like wings', 'Tip them like a plane to slide left and right', 'Arms up to climb, arms down to dive', 'Fly through the rings and dodge the storm clouds'];

  constructor(app) {
    this.app = app; this.time = 72; this.elapsed = 0; this.done = false; this.turbo = false; this.items = []; this.gliders = {}; this.puffs = []; this.bots = {};
    this.ringT = 1.5; this.n = 0; this.last = { x: 0, y: 1.6 }; this.streak = [0, 0, 0, 0]; this.passed = [0, 0, 0, 0]; this.folded = [0, 0, 0, 0];
    // the pilots stand small at the bottom so the sky belongs to the gliders
    app.avatarRoot.scale.setScalar(SMALL);
    for (let i = 0; i < 16; i++) { const m = new THREE.Mesh(GEO.sph, PUFF); m.userData = { x: (i % 2 ? 1 : -1) * rnd(8.5, 20), y: rnd(-7, 8), z: rnd(Z0, 6), s: rnd(1, 2.4) }; app.root.add(m); this.puffs.push(m); }
  }
  get speed() { return (22 + Math.min(11, this.elapsed / 5)) * (this.turbo ? 1.2 : 1); }
  start() { this.app.hud.setTimer(this.time); }
  idle(dt, t) { this.fly(dt, t, this.app.players); }

  glider(p) {
    let g = this.gliders[p.slot]; if (g) return g;
    const mesh = new THREE.Group(), body = paper(DART, toonMat(p.color, { side: THREE.DoubleSide, rim: 0xffffff, rimAmt: 0.6 }));
    const fold = new THREE.Mesh(GEO.box, whiteM); fold.scale.set(0.05, 1.5, 0.03); fold.position.set(0, 0.24, 0.02); body.add(fold);
    body.rotation.x = -0.95; mesh.add(body); mesh.scale.setScalar(1.05); this.app.root.add(mesh);
    const mark = new THREE.Mesh(GEO.ring, flat(p.color, { transparent: true, opacity: 0.7, depthWrite: false })); mark.scale.setScalar(0.62); this.app.root.add(mark);
    return (this.gliders[p.slot] = { mesh, body, mark, x: p.j.hipC.x * 0.6, y: 1.2, roll: 0, vy: 0, hurt: 0 });
  }
  // arms -> where the glider wants to be
  fly(dt, t, players) {
    const { app } = this; app.avatarRoot.position.y = app.floorY * (1 - SMALL);
    for (const p of players) {
      const g = this.glider(p), j = p.j, S = p.rig.S, span = (j.haR.x - j.haL.x) / S, open = clamp(span - 0.7, 0, 1);
      const tilt = Math.atan2(j.haR.y - j.haL.y, Math.max(0.3 * S, j.haR.x - j.haL.x)), st = clamp(-tilt / 0.5, -1, 1) * open;
      const h = ((j.haL.y + j.haR.y) / 2 - j.chest.y) / S, tx = Math.sign(st) * Math.pow(Math.abs(st), 1.15) * X_MAX, ty = lerp(Y_MIN, Y_MAX, clamp((h + 0.75) / 1.5, 0, 1));
      this.folded[p.slot] = open < 0.3 && h < -0.5 ? this.folded[p.slot] + dt : 0;
      const ox = g.x, oy = g.y; g.x += (tx - g.x) * Math.min(1, dt * 4.5); g.y += (ty - g.y) * Math.min(1, dt * 4.5); g.hurt = Math.max(0, g.hurt - dt);
      g.roll += (clamp(-(g.x - ox) / Math.max(dt, 1e-3) * 0.09, -0.9, 0.9) - g.roll) * Math.min(1, dt * 8); g.vy = (g.y - oy) / Math.max(dt, 1e-3);
      g.mesh.position.set(g.x, g.y + Math.sin(t * 3 + p.slot) * 0.06, 0.2); g.mesh.rotation.z = g.roll + (g.hurt > 0 ? Math.sin(t * 40) * 0.5 : 0); g.body.rotation.x = -0.95 + clamp(g.vy * 0.05, -0.35, 0.35);
      g.mark.position.set(g.x, g.y, 0.1); g.mark.rotation.z = t * 2;
      if (Math.random() < dt * 30) app.fx.spawn(g.x + rnd(-0.4, 0.4), g.y - 0.55, 0.1, 0, -1.5, 2, p.color, 0.13, 0.4, 0, 1);
    }
    for (const s in this.gliders) if (!players.some(p => p.slot === +s)) { const g = this.gliders[s]; g.mesh.removeFromParent(); g.mark.removeFromParent(); delete this.gliders[s]; }
    const v = this.speed;
    for (const m of this.puffs) { const u = m.userData; u.z += v * dt; if (u.z > 8) { u.z = Z0; u.x = (Math.random() < 0.5 ? 1 : -1) * rnd(8.5, 20); u.y = rnd(-7, 8); } m.position.set(u.x, u.y, u.z); m.scale.set(u.s * 1.7, u.s * 0.8, u.s); }
  }

  add(type, x, y, z = Z0) {
    let mesh, r;
    if (type === 'cloud') { mesh = makeCloud(); r = 1.0; mesh.scale.setScalar(1.15); }
    else if (type === 'star') { mesh = inked(GEO.star, toonMat(0xffd23f), INK_THIN); mesh.scale.setScalar(0.3); r = 0.62; }
    else {
      const gold = type === 'gold'; r = gold ? 0.95 : 1.3; mesh = inked(GEO.torus, toonMat(gold ? 0xffd23f : [0xff5a78, 0x22d3c5, 0x9d6bff, 0xff9248][this.n % 4], { rim: 0xffffff }), INKS); mesh.scale.setScalar(r);
      const glow = new THREE.Mesh(GEO.disc, glowM(gold ? 0xffd23f : 0xffffff, 0.14)); glow.scale.setScalar(0.86); mesh.add(glow);
    }
    this.app.root.add(mesh); const it = { type, mesh, x, y, z, r, ph: rnd(0, 6), hit: false };
    if (type !== 'cloud' && type !== 'star') { it.mark = new THREE.Mesh(GEO.ring, flat(0xffffff, { transparent: true, opacity: 0, depthWrite: false })); it.mark.scale.setScalar(r); it.mark.position.set(x, y, 0.05); this.app.root.add(it.mark); }
    this.items.push(it); return it;
  }
  drop(it) { it.mesh.removeFromParent(); it.mark?.removeFromParent(); this.items.splice(this.items.indexOf(it), 1); }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0) { hud.hint(''); this.done = true; return; }
    if (!this.turbo && this.time <= 14) { this.turbo = true; hud.banner('Tailwind!', '#ffd23f', 1.6, 'Double points'); hud.setStatus('Tailwind! x2'); fx.speedLines(); audio.hype(true); audio.cheer(1); }
    this.fly(dt, t, players);
    hud.hint(players.some(p => this.folded[p.slot] > 2.5) ? 'Hold your arms out like wings to fly' : '');
    const v = this.speed;

    // the course: a ring every couple of seconds, with stars leading from one to the next
    this.ringT -= dt;
    if (this.ringT <= 0 && players.length && this.time > 92 / v + 0.5) {
      this.ringT = Math.max(1.25, 2.1 - this.elapsed / 70); this.n++;
      const x = clamp(this.last.x + rnd(-5.5, 5.5), -X_MAX + 0.6, X_MAX - 0.6), y = rnd(Y_MIN + 0.5, Y_MAX - 0.2), gold = this.n % 6 === 0;
      this.add(gold ? 'gold' : 'ring', x, y);
      for (let i = 1; i <= 2; i++) this.add('star', lerp(this.last.x, x, i / 3), lerp(this.last.y, y, i / 3), Z0 + v * this.ringT * (1 - i / 3));
      if (this.elapsed > 16 && this.n % 3 === 1) { const cx = clamp(x + (Math.random() < 0.5 ? -1 : 1) * rnd(2.6, 3.6), -X_MAX, X_MAX); this.add('cloud', cx, clamp(y + rnd(-1, 1), Y_MIN, Y_MAX), Z0 + v * this.ringT * 0.5); }
      this.last = { x, y };
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh, z0 = it.z; it.z += v * dt;
      const ring = it.type === 'ring' || it.type === 'gold';
      m.position.set(it.x, it.y, it.z);
      if (it.type === 'star') m.rotation.z = t * 3 + it.ph; else if (it.type === 'cloud') m.rotation.z = Math.sin(t * 3 + it.ph) * 0.15; else m.rotation.z = t * 0.6 + it.ph;
      if (it.mark) { const near = clamp(1 + it.z / (v * 2.2), 0, 1); it.mark.material.opacity = it.z < 0 ? near * 0.6 : 0; it.mark.rotation.z = -t; it.mark.scale.setScalar(it.r * (1.5 - 0.5 * near)); }
      if (z0 < 0 && it.z >= 0) {
        let any = false;
        for (const p of players) {
          const g = this.gliders[p.slot]; if (!g) continue; const s = p.slot, d = Math.hypot(g.x - it.x, g.y - it.y), pos = { x: it.x, y: it.y, z: 0.5 };
          if (it.type === 'cloud') {
            if (d > it.r + 0.25) continue; any = true; this.streak[s] = 0; hud.setScore(s, app.scores[s], ''); g.hurt = 0.7;
            audio.zap(); audio.bad(); fx.shake(0.45); fx.flash(0.1); fx.pow(pos, 0xffd23f, 1.4); fx.word(pos, 'ZZZAP!', '#ffd23f', '#4a3a7a'); app.addScore(s, -30, { x: g.x, y: g.y + 0.8 }, { text: '-30', color: '#ff7a9a', sub: '' }); app.avatars[s]?.ouch();
          } else if (it.type === 'star') {
            if (d > it.r) continue; any = true; app.addScore(s, 10 * (this.turbo ? 2 : 1), pos, { cls: 'small', color: '#ffd23f', cheer: 0.2 }); audio.pop(this.n % 8); fx.burst(pos, { count: 8, colors: [0xffd23f, 0xffffff], speed: 4, size: 0.18 });
          } else if (d < it.r - 0.12) {
            any = true; const c = ++this.streak[s], mult = Math.min(5, 1 + Math.floor(c / 4)) * (this.turbo ? 2 : 1), gold = it.type === 'gold'; this.passed[s]++;
            app.addScore(s, (gold ? 150 : 50) * mult, { x: it.x, y: it.y + it.r }, { cls: gold || mult > 2 ? 'big' : '', color: gold ? '#ffd23f' : undefined, sub: mult > 1 ? 'x' + mult : '' });
            if (gold) { audio.gold(); fx.word(pos, 'BULLSEYE!', '#ffd23f', '#fff'); fx.confetti(pos, 36); } else audio.ding(76 + Math.min(14, c));
            if (c === 4 || c === 8 || c === 12) fx.word({ x: g.x, y: g.y + 1.2 }, c + ' IN A ROW!', '#fff', p.css);
            fx.ring(pos, p.color, it.r * 2.2, 0.4, it.r); fx.burst(pos, { count: 18, colors: [p.color, 0xffffff], speed: 7, size: 0.24 }); fx.shake(0.06);
          } else if (ring && this.streak[s] > 0) { this.streak[s] = 0; hud.setScore(s, app.scores[s], ''); }
        }
        it.hit = any; if (any && it.type !== 'cloud') { this.drop(it); continue; }
      }
      if (it.z > 5) this.drop(it);
    }
  }

  results() { return { note: `Most rings: ${Math.max(0, ...this.passed)}` }; }
  botIntent(i, p, bot, t, playing) {
    if (!p) return {};
    const g = this.gliders[p.slot], b = this.bots[i] || (this.bots[i] = { a: 0, b: 0 }); if (!g) return { arms: [[90, 0], [90, 0]] };
    // aim for the nearest thing worth flying through, and keep clear of clouds
    const next = this.items.filter(it => it.z < -1 && it.type !== 'cloud').sort((u, w) => w.z - u.z)[0], tx = next ? next.x : 0, ty = next ? next.y : 1.6;
    // undo the steering maths to find the arm angles that would put the glider there, then trim by what is left
    const st = Math.sign(tx) * Math.pow(Math.min(1, Math.abs(tx) / X_MAX), 1 / 1.15), hh = clamp(((ty - Y_MIN) / (Y_MAX - Y_MIN) * 1.5 - 0.75) / 1.23, -1, 1);
    b.a = clamp(st * 38 + (tx - g.x) * 3, -45, 45); b.b = Math.asin(hh) * 180 / Math.PI + clamp((ty - g.y) * 4, -8, 8);
    return { arms: [[90 + b.b + b.a, 4], [90 + b.b - b.a, 4]], x: bot.home, followPointer: false, snap: 10 };
  }
  dispose() {
    const a = this.app; a.avatarRoot.scale.setScalar(1); a.avatarRoot.position.y = 0; a.hud.hint('');
    for (const it of this.items) { it.mesh.removeFromParent(); it.mark?.removeFromParent(); } for (const s in this.gliders) { this.gliders[s].mesh.removeFromParent(); this.gliders[s].mark.removeFromParent(); } for (const m of this.puffs) m.removeFromParent();
  }
}
