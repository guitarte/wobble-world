// Freeze Frame: musical statues. Dance while the music plays and Snapper the
// camera bot snoozes. When the music cuts out, freeze like a statue: Snapper
// wakes up and sweeps its searchlight over the floor, looking for a wobble.
// Then it takes the picture, and everyone still frozen scores.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, clamp, lerp, GEO, INKS, INK_THIN, whiteM, inkM, blushM, flat, glowM, inked } from './kit.js';
import { demoPose } from './dance.js';

const D = Math.PI / 180, GRACE = 0.45, CREAM = 0xfff1d6, HOVER = 2.2; // Snapper flies just under the clock
const LAMP = { move: 0x6fd934, warn: 0xffc531, freeze: 0xff3d5a };
const BEAM = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([0, 0, 0, -0.5, -1, 0, 0.5, -1, 0]), 3)); return g; })();
// what the pretend players do when the music stops
const STATUES = [
  { arms: [[150, 0], [150, 0]] }, { arms: [[92, 0], [18, 12]], lean: 0.1 }, { arms: [[50, -100], [50, -100]], crouch: 0.65 },
  { arms: [[18, 12], [18, 12]] }, { arms: [[125, 0], [-95, -30]], lean: -0.14 }, { arms: [[120, 0], [120, 0]], legs: [{ dx: -0.11, lift: 0 }, { dx: 0.11, lift: 0 }] },
];

// Snapper: a sleepy flying camera with one big lens for an eye.
function makeSnapper() {
  const g = new THREE.Group(), cream = toonMat(CREAM, { rim: 0xffffff }), teal = toonMat(0x22c8d8), dark = toonMat(0x2a2350);
  const body = inked(GEO.box, cream, INKS); body.scale.set(1.75, 1.15, 0.8); g.add(body);
  const band = inked(GEO.box, teal, INK_THIN); band.scale.set(1.77, 0.26, 0.82); band.position.y = -0.34; g.add(band);
  const barrel = inked(GEO.cyl, dark, INKS); barrel.rotation.x = Math.PI / 2; barrel.scale.set(0.5, 0.3, 0.5); barrel.position.set(0, 0.08, 0.5); g.add(barrel);
  const glass = new THREE.Mesh(GEO.disc, flat(0x0d0d24)); glass.scale.setScalar(0.42); glass.position.set(0, 0.08, 0.66); g.add(glass);
  const iris = new THREE.Mesh(GEO.disc, flat(0x4fd8ff)); iris.scale.setScalar(0.27); iris.position.set(0, 0.08, 0.67); g.add(iris);
  const pupil = new THREE.Mesh(GEO.disc, inkM); pupil.scale.setScalar(0.15); pupil.position.set(0, 0.08, 0.68); g.add(pupil);
  const glint = new THREE.Mesh(GEO.disc, whiteM); glint.scale.setScalar(0.055); pupil.add(glint); glint.position.set(-0.5, 0.5, 0.01); glint.scale.setScalar(0.36);
  const lid = new THREE.Mesh(GEO.disc, flat(CREAM)); lid.position.set(0, 0.08, 0.7); g.add(lid);
  const sleep = new THREE.Mesh(GEO.smile, inkM); sleep.scale.set(2.5, 1.0, 2.3); sleep.position.set(0, 0.1, 0.72); sleep.rotation.z = Math.PI; g.add(sleep);
  for (const sg of [-1, 1]) { const b = new THREE.Mesh(GEO.disc, blushM); b.scale.set(0.16, 0.1, 1); b.position.set(sg * 0.66, -0.08, 0.41); g.add(b); }
  // a viewfinder bump, and a lamp on a stalk that shows its mood
  const bump = inked(GEO.box, dark, INK_THIN); bump.scale.set(0.5, 0.2, 0.5); bump.position.set(-0.45, 0.67, 0); g.add(bump);
  const stalk = inked(GEO.cyl, dark, INK_THIN); stalk.scale.set(0.045, 0.3, 0.045); stalk.position.set(0.52, 0.72, 0); g.add(stalk);
  const lamp = inked(GEO.sph, flat(LAMP.move), INK_THIN); lamp.scale.setScalar(0.17); lamp.position.set(0.52, 0.98, 0); g.add(lamp);
  const halo = new THREE.Mesh(GEO.disc, glowM(LAMP.move, 0.45)); halo.scale.setScalar(0.45); halo.position.set(0.52, 0.98, 0.06); g.add(halo);
  // two little rotors keep it in the air
  const rotors = [];
  for (const sg of [-1, 1]) {
    const arm = inked(GEO.box, teal, INK_THIN); arm.scale.set(0.42, 0.12, 0.12); arm.position.set(sg * 1.05, 0.2, 0); g.add(arm);
    const mast = inked(GEO.cyl, dark, INK_THIN); mast.scale.set(0.04, 0.3, 0.04); mast.position.set(sg * 1.22, 0.38, 0); g.add(mast);
    const r = inked(GEO.box, cream, INK_THIN); r.scale.set(0.95, 0.035, 0.14); r.position.set(sg * 1.22, 0.55, 0); g.add(r); rotors.push(r);
  }
  return { g, lid, sleep, pupil, iris, lamp, halo, rotors };
}

export class FreezeFrame {
  static id = 'freeze'; static title = 'Freeze Frame'; static blurb = 'Dance, then freeze when the music stops'; static icon = 'freeze';
  static colors = ['#35c8e8', '#3a4fd0']; static theme = 'stage'; static music = 'funk'; static stars = [800, 1500, 2300]; static ar = true;
  static howto = ['Dance while the music plays: big moves score more', 'When the music stops, freeze like a statue', 'Snapper the camera bot spots anyone who wobbles', 'Freeze in a big bold pose for a bonus'];

  constructor(app) {
    this.app = app; app.env.accent.set(0x35c8e8);
    this.time = 72; this.done = false; this.phase = 'move'; this.T = 6.5; this.fT = 0; this.round = 0; this.clock = 0; this.finale = false;
    this.st = {}; this.rings = {}; this.sweep = 0; this.aim = 0; this.bx = 0; this.open = 0; this.lock = 0; this.lockX = 0; this.zT = 1; this.caughtN = 0;
    this.bot = makeSnapper(); app.root.add(this.bot.g); this.bot.g.scale.setScalar(0.85); this.bot.g.position.set(0, HOVER, -1.2);
    this.beam = new THREE.Mesh(BEAM, glowM(0xfff3b0, 0)); this.beam.visible = false; app.root.add(this.beam);
    this.pool = new THREE.Mesh(GEO.disc, glowM(0xfff3b0, 0)); this.pool.rotation.x = -Math.PI / 2; this.pool.visible = false; app.root.add(this.pool);
  }
  start() { this.app.hud.setTimer(this.time); this.app.hud.setStatus('Dance!'); this.app.hud.banner('Dance!', '#ffd23f', 0.9); }
  state(slot) { return this.st[slot] || (this.st[slot] = { bank: 0, wig: 0, out: false, streak: 0, best: 0 }); }
  sub(s) { return s.streak > 1 ? `x${s.streak}` : ''; }
  lamp(c) { this.bot.lamp.material.color.set(c); this.bot.halo.material.color.set(c); }
  // a pose with some shape to it: a hand in the air, a squat, a lean, a wide stance or one foot up
  cool(p) {
    const j = p.j, S = p.rig.S;
    return j.haL.y > j.head.y + 0.3 * S || j.haR.y > j.head.y + 0.3 * S || p.rig.crouch > 0.5 || Math.abs(p.rig.lean) > 0.22
      || (p.rig.legsSeen && (Math.abs(j.anL.x - j.anR.x) > 1.25 * S || Math.abs(j.anL.y - j.anR.y) > 0.35 * S));
  }

  idle(dt, t) { this.animate(dt, t, this.app.players); }
  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app;
    this.clock += dt; this.time -= dt; this.T -= dt; hud.setTimer(this.time);
    if (!this.finale && this.time <= 17 && this.phase === 'move') { this.finale = true; hud.banner('Quick freezes!', '#ffd23f', 1.5, 'Double points'); fx.speedLines(); audio.hype(true); audio.cheer(1); }
    const X2 = this.finale ? 2 : 1;

    if (this.phase !== 'freeze') {
      if (this.phase === 'move' && this.time <= 0) { this.done = true; return; }
      // the bigger you dance, the faster the points tick up
      for (const p of players) {
        const s = this.state(p.slot), e = clamp(p.rig.energy - 0.25, 0, 2.2); s.bank += e * 20 * X2 * dt;
        if (s.bank >= 10) { const n = Math.floor(s.bank / 10) * 10; s.bank -= n; app.addScore(p.slot, n, null, { cheer: 0, sub: this.sub(s) }); }
        if (e > 0.3 && Math.random() < dt * 9) fx.burst(p.rig.hands[Math.random() < 0.5 ? 0 : 1], { count: 1, color: p.color, speed: 2, size: 0.2, gravity: -1 });
      }
      if (this.T <= 0 && this.phase === 'move') { this.phase = 'warn'; this.T = this.finale ? 0.5 : 0.95; this.lamp(LAMP.warn); audio.tick(); hud.setStatus('Wait for it...'); }
      else if (this.T <= 0) {
        this.phase = 'freeze'; this.round++; this.T = rnd(2.6, 3.7) * (this.finale ? 0.85 : 1); this.fT = 0; this.sweep = Math.random() < 0.5 ? 0.6 : Math.PI + 0.6; this.lock = 0;
        for (const k in this.st) { this.st[k].wig = 0; this.st[k].out = false; }
        audio.scratch(); audio.freeze(); audio.setMuffle(true); audio.duck(true);
        hud.banner('Freeze!', '#8feaff', 1.0); hud.setStatus('<b>FREEZE!</b>'); fx.flash(0.1); this.lamp(LAMP.freeze);
      }
    } else {
      this.fT += dt;
      for (const p of players) {
        const s = this.state(p.slot), e = p.rig.energy, S = p.rig.S; if (s.out || this.fT < GRACE) continue;
        s.wig = e > 0.7 ? s.wig + dt : Math.max(0, s.wig - dt * 0.5);
        if (s.wig > 0.35 || e > 1.6) {
          s.out = true; s.streak = 0; s.wig = 0; this.lock = 0.8; this.lockX = p.j.hipC.x; this.caughtN++;
          const pos = { x: p.j.head.x, y: p.j.head.y + 0.9 * S, z: 0.5 };
          app.addScore(p.slot, -60, pos, { text: '-60', color: '#ff7a9a', sub: '' }); fx.word({ x: pos.x, y: pos.y + 0.7, z: 0.5 }, 'MOVED!', '#fff', '#ff3d5a');
          audio.bad(); audio.zap(); fx.shake(0.3); app.avatars[p.slot]?.ouch();
        } else if (Math.random() < dt * 5) fx.spawn(p.j.chest.x + rnd(-0.8, 0.8) * S, p.j.chest.y + rnd(-1.4, 1.2) * S, 0.5, 0, 0.4, 0, 0xbff4ff, 0.14, 0.7, 0, 1);
      }
      if (this.T <= 0) {
        // click! everyone still frozen is in the picture
        let any = false; fx.flash(0.32); audio.tick();
        for (const p of players) {
          const s = this.state(p.slot), S = p.rig.S; if (s.out) continue; any = true; s.streak++; s.best = Math.max(s.best, s.streak);
          const cool = this.cool(p), pts = (100 + 20 * Math.min(5, s.streak - 1) + (cool ? 50 : 0)) * X2, pos = { x: p.j.head.x, y: p.j.head.y + 0.9 * S, z: 0.5 };
          app.addScore(p.slot, pts, pos, { cls: cool ? 'big' : '', sub: this.sub(s), cheer: 1 });
          if (cool) fx.word({ x: pos.x, y: pos.y + 0.8, z: 0.5 }, 'COOL POSE!', '#8feaff', p.css);
          fx.burst(p.j.chest, { count: 16, colors: [0x8feaff, 0xffffff, p.color], speed: 6, size: 0.24 }); fx.ring(p.j.chest, 0x8feaff, 2.2 * S, 0.4);
        }
        if (any) audio.perfect(); else audio.ding(60);
        audio.setMuffle(false); audio.duck(false); this.lamp(LAMP.move);
        this.phase = 'move'; this.T = this.finale ? rnd(2.4, 3.6) : Math.max(3.8, 7 - this.round * 0.45) + rnd(-0.5, 0.8);
        if (this.time > 0.5) { hud.banner('Dance!', '#ffd23f', 0.8); hud.setStatus(this.finale ? 'Dance! x2' : 'Dance!'); }
      }
    }
    this.animate(dt, t, players);
  }

  animate(dt, t, players) {
    const { app } = this, b = this.bot, fr = this.phase === 'freeze', k = app.ws, ground = app.ground, half = app.half;
    // where Snapper looks: it sweeps the floor, and whips round to anyone it catches
    this.lock = Math.max(0, this.lock - dt);
    if (fr && !this.lock) this.sweep += dt * 1.7;
    const tx = !fr ? 0 : this.lock ? this.lockX : Math.sin(this.sweep) * Math.max(1, half - 1.2);
    this.aim = lerp(this.aim, tx, 1 - Math.exp(-dt * (this.lock ? 14 : fr ? 7 : 3)));
    this.bx = lerp(this.bx, fr ? this.aim * 0.5 : Math.sin(t * 0.5) * 0.8, 1 - Math.exp(-dt * 3));
    const by = HOVER + Math.sin(t * 2.2) * 0.07 + (fr ? 0.05 : app.env.beatPulse * 0.08 - 0.05);
    b.g.position.set(this.bx, by, -1.2); b.g.rotation.z = fr ? clamp((this.bx - this.aim) * 0.05, -0.3, 0.3) : Math.sin(t * 1.3) * 0.09;
    this.open = lerp(this.open, this.phase === 'move' ? 0 : this.phase === 'warn' ? 0.4 : 1, 1 - Math.exp(-dt * 16));
    const c = 1 - this.open; b.lid.scale.set(0.44, Math.max(0.001, 0.44 * c), 1); b.lid.position.y = 0.52 - 0.44 * c; b.sleep.visible = c > 0.92;
    b.pupil.position.x = clamp((this.aim - this.bx) * 0.05, -0.13, 0.13); b.pupil.position.y = 0.08 - 0.1 * this.open;
    b.iris.material.color.set(this.lock ? 0xff5a78 : 0x4fd8ff);
    for (const r of b.rotors) r.rotation.y += dt * 32;
    b.halo.scale.setScalar(0.45 * (1 + (fr ? 0.3 : 0.12) * Math.sin(t * (fr ? 12 : 4))));
    if (!fr && this.phase === 'move') { this.zT -= dt; if (this.zT <= 0) { this.zT = 1.5; app.fx.popup({ x: this.bx + 1.2, y: by + 0.5, z: -1.2 }, 'z', '#bff4ff'); } }

    // the searchlight
    const o = this.beam.material, want = fr ? 0.2 : 0; o.opacity = lerp(o.opacity, want, 1 - Math.exp(-dt * 10)); this.beam.visible = this.pool.visible = o.opacity > 0.01;
    if (this.beam.visible) {
      const sx = this.bx, sy = by - 0.2, dx = this.aim - sx, dy = ground - sy, col = this.lock ? 0xff5a78 : 0xfff3b0;
      this.beam.position.set(sx, sy, -1.25); this.beam.rotation.z = Math.atan2(dx, -dy); this.beam.scale.set(3.0 * k, Math.hypot(dx, dy), 1); o.color.set(col);
      this.pool.position.set(this.aim, ground + 0.04, -0.6); this.pool.scale.set(1.9 * k, 0.8 * k, 1); this.pool.material.color.set(col); this.pool.material.opacity = o.opacity * 1.3;
    }

    // a ring at each player's feet: icy while they hold still, redder as they wobble
    for (const s in this.rings) if (!players.some(p => p.slot === +s)) { this.rings[s].removeFromParent(); delete this.rings[s]; }
    for (const p of players) {
      let r = this.rings[p.slot];
      if (!r) { r = this.rings[p.slot] = new THREE.Mesh(GEO.ring, flat(0x8feaff, { transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide })); r.rotation.x = -Math.PI / 2; app.root.add(r); }
      const s = this.state(p.slot), m = r.material; m.opacity = lerp(m.opacity, fr ? 0.95 : 0, 1 - Math.exp(-dt * 10)); r.visible = m.opacity > 0.02;
      if (s.out) m.color.set(0xff3d5a); else m.color.set(0x8feaff).lerp(WARN, clamp(s.wig / 0.35, 0, 1));
      r.position.set(p.j.hipC.x, ground + 0.05, 0.1); r.scale.setScalar((s.out ? 0.75 : 1.05 + 0.05 * Math.sin(t * 5)) * p.rig.S);
    }
  }

  results() { const best = Math.max(0, ...Object.values(this.st).map(s => s.best)); return { note: best > 1 ? `Best run: ${best} freezes in a row` : `Snapper caught ${this.caughtN} wobbles` }; }
  lookTarget() { return { x: this.bx, y: HOVER }; }
  botIntent(i, p, bot, t, playing) {
    if (!playing) return {};
    // someone playing with a mouse or a finger dances by wiggling it, and freezes by holding it still
    const sim = this.app.sim;
    if (i === 0 && (this.manual ||= !!sim?.pointerActive)) { const pt = sim.pointer, hands = [null, null]; hands[pt.x >= bot.x ? 1 : 0] = { x: pt.x, y: pt.y }; return { hands, handSpeed: 40, x: bot.x }; }
    const a = this.app.audio, pose = demoPose(i, a.ready && a.track ? a.beat : this.clock * (a.bpm / 60));
    const dance = { arms: pose.a, crouch: pose.c, lean: pose.l * D, sway: pose.s, legs: pose.legs, snap: 20, followPointer: false };
    if (this.phase !== 'freeze') return dance;
    // one pretend player is slow to stop now and then, so Snapper has someone to catch
    if (i === 1 && this.round % 3 === 2 && this.fT < 1.4) return dance;
    return { ...STATUES[(i * 2 + this.round) % STATUES.length], snap: 22, followPointer: false };
  }
  dispose() { const a = this.app.audio; a.setMuffle(false); a.duck(false); for (const s in this.rings) this.rings[s].removeFromParent(); this.bot.g.removeFromParent(); this.beam.removeFromParent(); this.pool.removeFromParent(); }
}
const WARN = new THREE.Color(0xffa23a);
