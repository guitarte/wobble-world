// Dot Says: Coach Dot calls out things to do. If the call starts with
// "Dot says", do it as fast as you can. If it does not, it is a trick, and
// anyone who moves gets caught out. The calls come faster as the game goes on.
import { rnd, pick, clamp } from './kit.js';
import { Coach } from './dance.js';

const P = (aL, aR, o = {}) => ({ a: [aL, aR], c: 0, l: 0, s: 0, legs: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }], ...o });
const UP = [165, 8], REST = [18, 12], HEAD = [125, 108], WIDE = [90, 0], CLAP = [40, -150], HIP = [50, -100], OUT = [62, 10], STAR = [130, 0];
const APART = [{ dx: -0.12, lift: 0 }, { dx: 0.12, lift: 0 }], ONE = [{ dx: 0, lift: 0.17 }, { dx: 0, lift: 0 }];
const both = (j, f) => f(j.haL) && f(j.haR);

// pose: how the coach shows it.  bot: how a pretend player does it.  test: has this player done it?
// hold: how long they must keep it (seconds).  legs: needs the camera to see the feet.
const ACTS = [
  { name: 'Hands up!', pose: () => P(UP, UP), bot: { arms: [UP, UP] }, test: (p, j, S) => both(j, h => h.y > j.head.y + 0.6 * S) },
  { name: 'Hands on your head!', pose: () => P(HEAD, HEAD), bot: { arms: [HEAD, HEAD] }, test: (p, j, S) => both(j, h => h.distanceTo(j.head) < 0.85 * S) },
  { name: 'Arms out wide!', pose: () => P(WIDE, WIDE), bot: { arms: [WIDE, WIDE] }, test: (p, j, S) => both(j, h => Math.abs(h.y - j.chest.y) < 0.55 * S && Math.abs(h.x - j.chest.x) > 1.2 * S) },
  { name: 'Squat down low!', pose: () => P(CLAP, CLAP, { c: 0.85 }), bot: { arms: [CLAP, CLAP], crouch: 0.95 }, test: (p) => p.rig.crouch > 0.5 },
  { name: 'Jump!', hold: 0, pose: (e) => P(OUT, OUT, { j: Math.max(0, Math.sin(e * 7)) * 0.8 }), bot: { jump: true }, test: (p) => p.rig.jump > 0.3 },
  { name: 'One hand up!', pose: () => P(UP, REST), bot: { arms: [UP, REST] }, test: (p, j, S) => (j.haL.y > j.head.y + 0.5 * S) !== (j.haR.y > j.head.y + 0.5 * S) && Math.min(j.haL.y, j.haR.y) < j.chest.y },
  { name: 'Lean to the side!', pose: () => P(OUT, OUT, { l: 17 }), bot: { arms: [OUT, OUT], lean: 0.32 }, test: (p) => Math.abs(p.rig.lean) > 0.19 },
  { name: 'Hands together!', pose: () => P(CLAP, CLAP), bot: { arms: [CLAP, CLAP] }, test: (p, j, S) => j.haL.distanceTo(j.haR) < 0.5 * S && j.haL.y > j.hipC.y + 0.2 * S },
  { name: 'Make a star!', legs: true, pose: () => P(STAR, STAR, { legs: APART }), bot: { arms: [STAR, STAR], legs: APART }, test: (p, j, S) => both(j, h => h.y > j.chest.y + 0.3 * S && Math.abs(h.x - j.chest.x) > 0.8 * S) && Math.abs(j.anL.x - j.anR.x) > 1.1 * S },
  { name: 'Stand on one leg!', legs: true, hold: 0.4, pose: () => P(OUT, OUT, { legs: ONE }), bot: { arms: [OUT, OUT], legs: ONE }, test: (p, j, S) => Math.abs(j.anL.y - j.anR.y) > 0.35 * S },
];

export class DotSays {
  static id = 'dot'; static title = 'Dot Says'; static blurb = 'Only move when Coach Dot says so'; static icon = 'dot';
  static colors = ['#5fd04a', '#1f8f6a']; static theme = 'meadow'; static music = 'toy'; static stars = [1000, 1900, 2800];
  static howto = ['Coach Dot calls out something to do', 'If you see DOT SAYS, do it fast', 'No DOT SAYS? It is a trick: do not move!', 'Quick answers and long runs score more'];

  constructor(app) {
    this.app = app; this.time = 75; this.done = false; this.phase = 'rest'; this.T = 2.0; this.W = 3.6; this.n = 0; this.clock = 0; this.finale = false;
    this.st = {}; this.act = null; this.trick = false; this.lastTrick = true; this.recent = []; this.tricks = 0; this.fooledN = 0; this.first = false;
    this.coach = new Coach(app, 0x5fd04a); this.coach.h = 3.9; this.coach.rise = 3.2; this.coach.wide = 0.6; // high enough to be seen over a player standing in the middle
    this.coach.riser.material.color.set(0xfff1d6); this.coach.riser.material.emissiveIntensity = 0.08;
  }
  start() { this.app.hud.setTimer(this.time); this.app.hud.setStatus('Watch for DOT SAYS'); }
  state(slot) { return this.st[slot] || (this.st[slot] = { done: false, hold: 0, was: false, fooled: false, streak: 0, best: 0 }); }
  sub(s) { return s.streak > 1 ? `x${s.streak}` : ''; }
  beat() { const a = this.app.audio; return a.ready && a.track ? a.beat : this.clock * (a.bpm / 60); }
  restPose() { const b = this.beat(); return P(HIP, HIP, { c: 0.1 * Math.max(0, Math.sin(b * Math.PI * 2)), s: Math.sin(b * Math.PI) * 0.015 }); }
  idle(dt, t) { this.clock += dt; this.coach.update(this.restPose(), dt, t); }

  call(players) {
    const { hud, audio } = this.app, seen = players.every(p => p.rig.legsSeen);
    const pool = ACTS.filter(a => !this.recent.includes(a) && (seen || !a.legs));
    this.act = pick(pool); this.recent.push(this.act); if (this.recent.length > 3) this.recent.shift();
    this.n++; this.trick = this.n > 2 && !this.lastTrick && Math.random() < 0.32; this.lastTrick = this.trick; if (this.trick) this.tricks++;
    this.W = this.trick ? 2.3 : this.finale ? 2.3 : Math.max(2.5, 3.7 - this.n * 0.07); this.T = this.W; this.phase = 'call'; this.first = false;
    for (const k in this.st) Object.assign(this.st[k], { done: false, hold: 0, was: false, fooled: false });
    hud.banner(this.act.name, '#fff', this.W + 0.3, 'Dot says', this.trick ? 'says trick' : 'says'); hud.setStatus(`Call ${this.n}`);
    if (this.trick) audio.tick(); else { audio.ding(84); audio.ding(91); }
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app;
    this.clock += dt; this.time -= dt; this.T -= dt; hud.setTimer(this.time);
    const X2 = this.finale ? 2 : 1;
    if (this.phase === 'rest') {
      this.coach.update(this.restPose(), dt, t);
      if (this.time <= 0) { this.done = true; return; }
      if (!this.finale && this.time <= 17) { this.finale = true; this.T = 1.5; hud.banner('Lightning round!', '#ffd23f', 1.4, 'Double points', 'said'); fx.speedLines(); audio.hype(true); audio.cheer(1); return; }
      if (this.T <= 0 && players.length) this.call(players);
      return;
    }
    const act = this.act, el = this.W - this.T, need = act.hold ?? 0.22;
    this.coach.update(act.pose(el), dt, t);
    let waiting = 0;
    for (const p of players) {
      const s = this.state(p.slot), S = p.rig.S; if (s.done) continue;
      const ok = act.test(p, p.j, S), pos = { x: p.j.head.x, y: p.j.head.y + 0.9 * S, z: 0.5 };
      if (this.trick) {
        // anyone who happened to be standing like that already is let off, until they move out of it
        if (ok && el < 0.5) s.was = true; else if (!ok) s.was = false;
        s.hold = ok && !s.was ? s.hold + dt : 0;
        if (ok && !s.was && s.hold >= Math.min(need, 0.15)) {
          s.done = s.fooled = true; s.streak = 0; this.fooledN++;
          app.addScore(p.slot, -50, pos, { text: '-50', color: '#ff7a9a', sub: '' }); fx.word({ x: pos.x, y: pos.y + 0.7, z: 0.5 }, 'GOTCHA!', '#fff', '#9d6bff');
          audio.bad(); fx.shake(0.25); app.avatars[p.slot]?.ouch();
        }
        continue;
      }
      s.hold = ok ? s.hold + dt : 0;
      if (ok && s.hold >= need) {
        s.done = true; s.streak++; s.best = Math.max(s.best, s.streak);
        const first = !this.first && players.length > 1; this.first = true;
        const pts = (50 + Math.round(50 * clamp(1 - el / this.W, 0, 1) / 5) * 5 + 10 * Math.min(5, s.streak - 1) + (first ? 20 : 0)) * X2;
        app.addScore(p.slot, pts, pos, { cls: first ? 'big' : '', sub: this.sub(s), cheer: 1 });
        if (first) fx.word({ x: pos.x, y: pos.y + 0.8, z: 0.5 }, 'FIRST!', '#ffd23f', p.css);
        fx.burst(p.j.chest, { count: 14, colors: [p.color, 0xffffff, 0x5fd04a], speed: 6, size: 0.24 }); fx.ring(p.j.chest, 0x5fd04a, 2 * S, 0.35);
        if (s.streak > 2) audio.perfect(); else audio.good();
      } else waiting++;
    }
    // everyone has done it: no need to wait out the clock
    if (!this.trick && !waiting && players.length && this.T > 0.55) this.T = 0.55;
    if (this.T > 0) return;

    let fooled = 0, sharp = 0;
    for (const p of players) {
      const s = this.state(p.slot), S = p.rig.S, pos = { x: p.j.head.x, y: p.j.head.y + 0.9 * S, z: 0.5 };
      if (this.trick) {
        if (s.fooled) { fooled++; continue; }
        sharp++; s.streak++; s.best = Math.max(s.best, s.streak);
        app.addScore(p.slot, 60 * X2, pos, { color: '#c9a8ff', sub: this.sub(s), cheer: 0.8 }); fx.burst(p.j.chest, { count: 10, colors: [0xc9a8ff, 0xffffff], speed: 5, size: 0.22 });
      } else if (!s.done) { s.streak = 0; fx.popup(pos, 'Too slow!', '#ff9ab0'); hud.setScore(p.slot, app.scores[p.slot], ''); }
    }
    if (this.trick) {
      if (fooled) { hud.banner('Gotcha!', '#c9a8ff', 1.0, 'Dot did not say', 'said'); audio.scratch(); }
      else { hud.banner('Not fooled!', '#8ff06a', 1.0, 'Dot did not say', 'said'); audio.good(); }
      if (sharp) audio.ding(72);
    }
    this.phase = 'rest'; this.T = this.trick ? 1.25 : this.finale ? 0.6 : 0.9; this.act = null;
  }

  results() { const best = Math.max(0, ...Object.values(this.st).map(s => s.best)); return { note: best > 2 ? `Best run: ${best} right in a row` : `Dot tried ${this.tricks} tricks` }; }
  lookTarget() { const h = this.coach.rig.j.head; return { x: h.x, y: h.y }; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || this.phase !== 'call' || !p) return { followPointer: false };
    const s = this.state(p.slot), el = this.W - this.T;
    if (s.done || el < 0.5 + 0.22 * i) return { followPointer: false };
    // one pretend player falls for every other trick
    if (this.trick && !(i === 1 && this.tricks % 2 === 1)) return { followPointer: false };
    return { ...this.act.bot, snap: 18, followPointer: false };
  }
  dispose() { this.coach.avatar.dispose(); }
}
