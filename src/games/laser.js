// Laser Leap: little robots ride along the floor and the ceiling carrying
// laser beams across the stage. Jump the short ones that come along the
// floor, duck under the long ones that hang from above, and grab the stars
// in between.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, pick, clamp, GEO, INKS, INK_THIN, inkM, whiteM, flat, glowM, inked, near } from './kit.js';

const LOW = 0x23e6ff, HIGH = 0xff3fa4, HIGH_Y = 3.05, TOP = 4.12;
const ARROW = (() => { const s = new THREE.Shape(); s.moveTo(0, 0.5); s.lineTo(0.5, -0.1); s.lineTo(0.2, -0.1); s.lineTo(0.2, -0.5); s.lineTo(-0.2, -0.5); s.lineTo(-0.2, -0.1); s.lineTo(-0.5, -0.1); s.closePath(); return new THREE.ShapeGeometry(s); })();
const BODY = toonMat(0x39407a, { rim: 0xffffff, rimAmt: 0.6 }), WHEEL = toonMat(0x1d2148);

function makeBeam(type) {
  const g = new THREE.Group(), c = type === 'low' ? LOW : HIGH, dir = type === 'low' ? 1 : -1;
  // the robot: a pod with one big eye, wheels on the floor or a rotor on the ceiling
  const pod = inked(GEO.sph, BODY, INKS); pod.scale.set(0.52, 0.25, 0.4); pod.position.y = dir * 0.2; g.add(pod);
  const eye = new THREE.Mesh(GEO.disc, whiteM); eye.scale.setScalar(0.17); eye.position.set(0, dir * 0.22, 0.37); g.add(eye);
  const pupil = new THREE.Mesh(GEO.disc, flat(c)); pupil.scale.setScalar(0.1); pupil.position.set(0, dir * 0.22, 0.38); g.add(pupil);
  const spin = [];
  for (const sg of [-1, 1]) { const w = inked(GEO.cyl, WHEEL, INK_THIN); w.scale.set(0.15, 0.1, 0.15); w.rotation.x = Math.PI / 2; w.position.set(sg * 0.3, dir * 0.06, 0.2); g.add(w); spin.push(w); }
  const horn = inked(GEO.cone, toonMat(c), INK_THIN); horn.scale.set(0.12, 0.16, 0.12); horn.position.y = dir * 0.38; if (dir < 0) horn.rotation.z = Math.PI; g.add(horn);
  // the beam itself: a white-hot core in a coloured glow
  const beam = new THREE.Group(); beam.position.y = dir * 0.5; g.add(beam);
  const core = new THREE.Mesh(GEO.box, whiteM); core.scale.set(0.07, 1, 0.07); core.position.y = dir * 0.5; beam.add(core);
  const glow = new THREE.Mesh(GEO.box, glowM(c, 0.75)); glow.scale.set(0.42, 1, 0.02); glow.position.y = dir * 0.5; beam.add(glow);
  const halo = new THREE.Mesh(GEO.box, glowM(c, 0.28)); halo.scale.set(1.2, 1.25, 0.02); halo.position.y = dir * 0.5; beam.add(halo);
  const tip = new THREE.Mesh(GEO.sph, flat(0xffffff)); tip.scale.setScalar(0.13); g.add(tip);
  const pool = new THREE.Mesh(GEO.disc, glowM(c, 0.35)); pool.scale.set(1.5, 0.5, 1); pool.position.set(0, dir * 0.05, 0.05); g.add(pool);
  // arrows that say what to do: up for jump, down for duck
  const arrows = [];
  for (let i = 0; i < 2; i++) { const a = new THREE.Mesh(ARROW, flat(c, { transparent: true })); a.scale.setScalar(0.56); a.rotation.z = dir > 0 ? 0 : Math.PI; g.add(a); arrows.push(a); const k = new THREE.Mesh(ARROW, flat(0x140c2a, { transparent: true })); k.scale.setScalar(1.3); k.position.z = -0.02; a.add(k); }
  g.userData = { beam, tip, arrows, spin, c, dir };
  return g;
}

export class LaserLeap {
  static id = 'laser'; static title = 'Laser Leap'; static blurb = 'Jump the low beams, duck the high ones'; static icon = 'laser';
  static colors = ['#12b5d6', '#5a2bd6']; static theme = 'neon'; static music = 'arcade'; static stars = [700, 1500, 2500];
  static howto = ['Blue beams roll along the floor: jump over them', 'Pink beams hang from above: duck under them', 'Clear beams in a row to multiply your score', 'Grab the gold stars in between'];

  constructor(app) {
    this.app = app; this.beams = []; this.orbs = []; this.time = 70; this.elapsed = 0; this.nextT = 1.2; this.orbT = 2; this.done = false; this.storm = false; this.flip = 0;
    this.streak = [0, 0, 0, 0]; this.cleared = [0, 0, 0, 0];
    this.rails = [LOW, HIGH].map((c, i) => { const r = new THREE.Mesh(GEO.box, flat(c)); r.scale.set(19, 0.05, 0.05); r.position.set(0, i ? TOP + 0.3 : -3.7, 0.3); app.root.add(r); return r; });
  }
  start() { this.app.hud.setTimer(this.time); }

  launch(type, side, speed, back = 0) {
    const mesh = makeBeam(type); this.app.root.add(mesh);
    this.beams.push({ type, mesh, x: side * (9.6 + back), dir: -side, speed, win: {}, told: false });
  }
  wave() {
    const e = this.elapsed, sp = (3.6 + Math.min(2.2, e / 24)) * (this.storm ? 1.12 : 1), side = Math.random() < 0.5 ? -1 : 1, r = Math.random(), a = this.flip++ % 2 ? 'high' : 'low', b = a === 'low' ? 'high' : 'low';
    let gap = this.storm ? 2.0 : Math.max(2.3, 3.4 - e / 40);
    if (e < 13 || r < 0.3) this.launch(a, side, sp);
    else if (r < 0.55) { this.launch(a, side, sp); this.launch(a, side, sp, 3.0); gap += 0.6; }
    else if (r < 0.8) { this.launch(a, side, sp); this.launch(b, side, sp, 3.6); gap += 0.8; }
    else { this.launch(a, side, sp); this.launch(b, -side, sp, 2.5); gap += 0.5; }
    this.nextT = gap; this.app.audio.tone('square', a === 'low' ? 64 : 76, 0.14, 0.1, { to: a === 'low' ? 520 : 300, lp: 2600 });
  }
  clear(type, p) {
    const g = this.app.ground;
    return type === 'low' ? (Math.min(p.j.anL.y, p.j.anR.y) > g + 0.42 || p.rig.jump > 0.3) : (p.j.head.y + 0.4 * p.rig.S < g + HIGH_Y - 0.05 || p.rig.crouch > 0.5);
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, ground = app.ground;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0) { this.done = true; return; }
    if (!this.storm && this.time <= 14) { this.storm = true; hud.banner('Laser storm!', '#ffd23f', 1.6, 'Double points'); hud.setStatus('Storm! x2'); fx.speedLines(); audio.hype(true); audio.cheer(1); }
    this.rails[0].position.y = ground + 0.03;
    this.nextT -= dt; if (this.nextT <= 0 && players.length) this.wave();

    for (let i = this.beams.length - 1; i >= 0; i--) {
      const b = this.beams[i], m = b.mesh, ud = m.userData, low = b.type === 'low';
      b.x += b.dir * b.speed * dt;
      if (Math.abs(b.x) > 11) { m.removeFromParent(); this.beams.splice(i, 1); continue; }
      const y0 = low ? ground : TOP, len = low ? 0.34 : TOP - 0.5 - (ground + HIGH_Y), flick = 1 + Math.sin(t * 40 + i) * 0.15;
      m.position.set(b.x, y0, 0.3); ud.beam.scale.set(flick, len, 1); ud.tip.position.y = ud.dir * (0.5 + len); ud.tip.scale.setScalar(0.11 + 0.05 * Math.sin(t * 30));
      for (const w of ud.spin) w.rotation.y = -b.dir * t * 9;
      ud.arrows.forEach((a, k) => { const u = (t * 1.6 + k * 0.5) % 1; a.position.set(-b.dir * 0.55, low ? 1.15 + u * 0.7 : -(TOP - ground - HIGH_Y) - 0.3 - u * 0.7, 0.1); a.material.opacity = a.children[0].material.opacity = Math.sin(u * Math.PI); });
      if (Math.random() < dt * 24) fx.spawn(b.x, y0 + ud.dir * (0.5 + len), 0.4, rnd(-1.5, 1.5), rnd(-1, 2), 0, ud.c, 0.12, 0.35, 3, 1);
      if (!b.told && Math.abs(b.x) < 8.6) { b.told = true; fx.word({ x: Math.sign(b.x) * 6.2, y: low ? ground + 1.5 : ground + HIGH_Y + 0.4 }, low ? 'JUMP!' : 'DUCK!', '#fff', low ? '#12b5d6' : '#ff3fa4').classList.add('small'); }

      // judge each player as the beam passes through the space they stand in
      for (const p of players) {
        const s = p.slot, w = 0.42 * p.rig.S + 0.12, inside = Math.abs(b.x - p.j.hipC.x) < w; let rec = b.win[s];
        if (inside) { if (!rec) rec = b.win[s] = { n: 0, ok: 0, done: false }; if (!rec.done) { rec.n++; if (this.clear(b.type, p)) rec.ok++; } continue; }
        if (!rec || rec.done) continue;
        rec.done = true; const head = { x: p.j.head.x, y: p.j.head.y + 1.1 * p.rig.S };
        if (rec.ok >= rec.n * 0.5) {
          const c = ++this.streak[s], mult = Math.min(5, 1 + Math.floor(c / 3)) * (this.storm ? 2 : 1); this.cleared[s]++;
          app.addScore(s, 50 * mult, head, { sub: mult > 1 ? 'x' + mult : '', cls: mult > 2 ? 'big' : '' }); audio.ding(76 + Math.min(14, c * 2));
          fx.ring({ x: p.j.hipC.x, y: low ? ground + 0.3 : p.j.head.y }, ud.c, 1.8, 0.4); fx.burst({ x: p.j.hipC.x, y: low ? ground + 0.5 : p.j.head.y + 0.6 }, { count: 10, colors: [ud.c, 0xffffff], speed: 5, size: 0.2 });
          if (c === 3 || c === 6 || c === 10) fx.word(head, c === 3 ? 'NICE!' : c === 6 ? 'SUPER!' : 'UNSTOPPABLE!', '#fff', p.css);
        } else {
          const pos = { x: p.j.hipC.x, y: low ? ground + 0.5 : p.j.head.y, z: 0.6 };
          this.streak[s] = 0; hud.setScore(s, app.scores[s], ''); audio.zap(); audio.bad(); fx.shake(0.4); fx.flash(0.1); fx.hitstop(0.05);
          fx.pow(pos, ud.c, 1.3); fx.burst(pos, { count: 22, colors: [ud.c, 0xffffff], speed: 8 }); fx.word(pos, 'ZAP!', '#fff', low ? '#12b5d6' : '#ff3fa4');
          app.addScore(s, -25, head, { text: '-25', color: '#ff7a9a', sub: '' }); app.avatars[s]?.ouch();
        }
      }
    }

    // gold stars to grab between beams
    this.orbT -= dt;
    if (this.orbT <= 0 && players.length && this.orbs.length < 3) {
      this.orbT = rnd(1.6, 2.6); const p = pick(players), S = p.rig.S;
      const mesh = inked(GEO.star, toonMat(0xffd23f), INK_THIN); mesh.scale.setScalar(0.01); app.root.add(mesh);
      this.orbs.push({ mesh, x: clamp(p.j.hipC.x + rnd(-1.5, 1.5) * S, -7, 7), y: ground + rnd(1.5, 3.9) * S / 1.28 + 0.6, age: 0, life: 4.5 });
    }
    for (let i = this.orbs.length - 1; i >= 0; i--) {
      const o = this.orbs[i]; o.age += dt;
      const sc = 0.36 * Math.min(1, o.age * 6) * Math.min(1, (o.life - o.age) * 4); o.mesh.position.set(o.x, o.y + Math.sin(t * 3 + o.x) * 0.12, 0.3); o.mesh.scale.setScalar(Math.max(0.01, sc)); o.mesh.rotation.z = Math.sin(t * 2 + o.x) * 0.4;
      let by = null; for (const p of players) if (near(p, o.x, o.y, 0.34, ['haL', 'haR'])) { by = p; break; }
      if (by) { const pos = { x: o.x, y: o.y, z: 0.5 }; app.addScore(by.slot, 20 * (this.storm ? 2 : 1), pos, { color: '#ffd23f', cheer: 0.3 }); audio.gold(); fx.burst(pos, { count: 12, colors: [0xffd23f, 0xffffff], speed: 5, size: 0.2 }); fx.ring(pos, 0xffd23f, 1.2, 0.3); }
      if (by || o.age > o.life) { o.mesh.removeFromParent(); this.orbs.splice(i, 1); }
    }
  }

  results() { return { note: `Most beams cleared: ${Math.max(0, ...this.cleared)}` }; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const out = { x: bot.home }, w = 0.42 * p.rig.S + 0.12;
    for (const b of this.beams) {
      const d = (bot.x - b.x) * b.dir; // how far the beam still has to travel to reach me
      if (b.type === 'low' && d > 0 && d < w + b.speed * 0.12) out.jump = true;
      if (b.type === 'high' && d < w + b.speed * 0.4 && d > -w - 0.4) out.crouch = 1;
    }
    const o = this.orbs.find(q => Math.abs(q.x - bot.x) < bot.h * 0.3 && q.y < bot.floor + bot.h * 1.1);
    if (o && !out.crouch) { const hands = [null, null]; hands[o.x >= bot.x ? 1 : 0] = { x: o.x, y: o.y }; out.hands = hands; }
    else if (this.orbs[0] && Math.abs(this.orbs[0].x - bot.home) < 2) out.x = this.orbs[0].x;
    return out;
  }
  dispose() { for (const b of this.beams) b.mesh.removeFromParent(); for (const o of this.orbs) o.mesh.removeFromParent(); for (const r of this.rails) r.removeFromParent(); }
}
