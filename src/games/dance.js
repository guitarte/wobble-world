// The dance games. A coach character (Dot) shows moves on the beat.
//   Dance Class:  learn four moves one at a time, then string them together.
//   Dance Battle: freestyle turns in the spotlight, judged on energy, rhythm and style.
// Music comes in three original styles: pop, K-pop and hip hop.
import * as THREE from 'three';
import { sceneToon, inkGroup } from '../toon.js';
import { Rig, PLAYER_CSS, PLAYER_NAMES } from '../tracking.js';
import { buildSkeleton } from '../sim.js';
import { Avatar } from '../avatar.js';

const D = Math.PI / 180, RISE = 1.9;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const P = (aL, aR, o = {}) => ({ a: [aL, aR], c: 0, l: 0, s: 0, legs: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }], ...o });
const DOWN = [18, 12], HIP = [50, -100];
const WIDE = [{ dx: -0.1, lift: 0 }, { dx: 0.1, lift: 0 }];

const MOVES = {
  sunshine: { name: 'Sunshine', keys: [P([150, 0], [150, 0]), P([45, 10], [45, 10], { c: 0.3 }), P([150, 0], [150, 0]), P([45, 10], [45, 10], { c: 0.3 })] },
  pointit: { name: 'Point It', keys: [P(HIP, [140, 0], { l: 6 }), P(HIP, [35, 0], { c: 0.2 }), P([140, 0], HIP, { l: -6 }), P([35, 0], HIP, { c: 0.2 })] },
  clapstep: { name: 'Clap Step', keys: [P([70, 90], [70, 90], { s: -0.07, legs: [{ dx: -0.1, lift: 0 }, { dx: 0, lift: 0 }] }), P([35, 115], [35, 115], { c: 0.15 }), P([70, 90], [70, 90], { s: 0.07, legs: [{ dx: 0, lift: 0 }, { dx: 0.1, lift: 0 }] }), P([35, 115], [35, 115], { c: 0.15 })] },
  starjump: { name: 'Star Pop', keys: [P([105, 0], [105, 0], { legs: WIDE }), P([20, 40], [20, 40], { c: 0.55 }), P([105, 0], [105, 0], { legs: WIDE }), P([20, 40], [20, 40], { c: 0.55 })] },
  heart: { name: 'Big Heart', keys: [P([160, 65], [160, 65]), P([90, 0], [90, 0]), P([160, 65], [160, 65]), P([25, 10], [25, 10], { c: 0.35 })] },
  sharp: { name: 'Sharp Point', keys: [P([90, 0], [20, -110], { l: -5 }), P(DOWN, DOWN, { c: 0.25 }), P([20, -110], [90, 0], { l: 5 }), P([130, 30], [130, 30])] },
  robot: { name: 'Robot Arms', keys: [P([90, 90], [90, -90]), P([90, -90], [90, 90]), P([90, 90], [90, -90]), P([90, 90], [90, 90])] },
  wave: { name: 'Side Wave', keys: [P([100, 0], [100, 0], { l: -14, s: -0.04 }), P([60, 70], [60, 70], { c: 0.2 }), P([100, 0], [100, 0], { l: 14, s: 0.04 }), P([60, 70], [60, 70], { c: 0.2 })] },
  bounce: { name: 'The Bounce', keys: [P([40, 85], [40, 85], { c: 0.55 }), P([30, 60], [30, 60]), P([40, 85], [40, 85], { c: 0.55, l: 8 }), P([30, 60], [30, 60])] },
  dab: { name: 'The Dab', keys: [P([125, 0], [90, 160], { l: -8 }), P([30, 45], [30, 45], { c: 0.35 }), P([90, 160], [125, 0], { l: 8 }), P([30, 45], [30, 45], { c: 0.35 })] },
  roof: { name: 'Raise the Roof', keys: [P([105, 75], [105, 75], { c: 0.3 }), P([145, 35], [145, 35]), P([105, 75], [105, 75], { c: 0.3 }), P([145, 35], [145, 35])] },
  rock: { name: 'Rock Step', keys: [P([30, 95], [60, 60], { s: -0.08, l: -9, c: 0.25 }), P([35, 115], [35, 115]), P([60, 60], [30, 95], { s: 0.08, l: 9, c: 0.25 }), P([35, 115], [35, 115])] },
};

export const GENRES = {
  pop: { name: 'Pop', blurb: 'Bright and bouncy', music: 'pop', accent: 0xff4fa3, colors: ['#ff6fb5', '#d42f7c'], moves: ['sunshine', 'pointit', 'clapstep', 'starjump'] },
  kpop: { name: 'K-Pop', blurb: 'Sharp and sparkly', music: 'kpop', accent: 0x8a6bff, colors: ['#8f7bff', '#4d2fd0'], moves: ['heart', 'sharp', 'robot', 'wave'] },
  hiphop: { name: 'Hip Hop', blurb: 'Laid back and bouncy', music: 'hiphop', accent: 0xffa62b, colors: ['#ffb347', '#e06a12'], moves: ['bounce', 'dab', 'roof', 'rock'] },
};

function mix(a, b, u) {
  return { a: [[lerp(a.a[0][0], b.a[0][0], u), lerp(a.a[0][1], b.a[0][1], u)], [lerp(a.a[1][0], b.a[1][0], u), lerp(a.a[1][1], b.a[1][1], u)]],
    c: lerp(a.c, b.c, u), l: lerp(a.l, b.l, u), s: lerp(a.s, b.s, u),
    legs: [0, 1].map(i => ({ dx: lerp(a.legs[i].dx, b.legs[i].dx, u), lift: lerp(a.legs[i].lift, b.legs[i].lift, u) })) };
}
// Hold each pose for the first part of its beat, then glide to the next one.
function poseAt(move, beat) {
  const n = move.keys.length, k = ((Math.floor(beat) % n) + n) % n, f = beat - Math.floor(beat);
  const u = clamp((f - 0.5) / 0.5, 0, 1); return mix(move.keys[k], move.keys[(k + 1) % n], u * u * (3 - 2 * u));
}
// Poses for the heroes dancing on the title screen.
const DEMO = ['sunshine', 'wave', 'roof', 'heart'];
export const demoPose = (i, beat) => poseAt(MOVES[DEMO[(i + Math.floor(beat / 8)) % 4]], beat);
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
// 0..1: how closely a player's arms and crouch match a pose (compared as seen on screen, like a mirror)
function matchPose(rig, pose) {
  let s = 0; const m = (d) => clamp((d - 0.1) / 0.72, 0, 1);
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1, a = pose.a[side][0] * D, b = a + pose.a[side][1] * D, sfx = side ? 'R' : 'L';
    rig.dir('sh' + sfx, 'el' + sfx, tA); rig.dir('el' + sfx, 'wr' + sfx, tB);
    s += m(tA.x * sg * Math.sin(a) - tA.y * Math.cos(a)) * 0.5 + m(tB.x * sg * Math.sin(b) - tB.y * Math.cos(b)) * 0.5;
  }
  return (s / 2) * 0.82 + (1 - Math.min(1, Math.abs(rig.crouch - pose.c) * 1.4)) * 0.18;
}
// A little drawing of a pose, for the move strip at the side of the screen.
function picto(pose) {
  const S = buildSkeleton({ x: 0, floor: 0, h: 1, crouch: pose.c, lean: pose.l * D, sway: pose.s, arms: pose.a, legs: pose.legs });
  const pt = (i) => `${(S[i][0] * 100).toFixed(1)} ${(-S[i][1] * 100).toFixed(1)}`;
  const limbs = `M${pt(15)}L${pt(13)}L${pt(11)}M${pt(16)}L${pt(14)}L${pt(12)}M${pt(27)}L${pt(25)}L${pt(23)}M${pt(28)}L${pt(26)}L${pt(24)}`, body = `M${pt(11)}L${pt(12)}L${pt(24)}L${pt(23)}Z`;
  const hx = (S[0][0] * 100).toFixed(1), hy = (-S[0][1] * 100 - 3).toFixed(1);
  return `<svg viewBox="-64 -132 128 140"><g stroke-linecap="round" stroke-linejoin="round"><path d="${limbs}" fill="none" stroke="#140c2a" stroke-width="19"/><path d="${body}" fill="#140c2a" stroke="#140c2a" stroke-width="19"/><circle cx="${hx}" cy="${hy}" r="15" fill="#140c2a"/><path d="${limbs}" fill="none" stroke="#fff" stroke-width="10"/><path d="${body}" fill="#fff" stroke="#fff" stroke-width="10"/><circle cx="${hx}" cy="${hy}" r="10.5" fill="#fff"/></g></svg>`;
}
const intentFor = (pose, extra = {}) => ({ arms: pose.a, crouch: pose.c, lean: pose.l * D, sway: pose.s, legs: pose.legs, snap: 20, followPointer: false, ...extra });

class Coach {
  constructor(app, accent) {
    this.app = app; this.rig = new Rig(); this.holder = new THREE.Group(); this.holder.position.z = -4.5; app.root.add(this.holder);
    this.avatar = new Avatar(accent, 4); this.holder.add(this.avatar.group); this.h = 4.8; this.x = 0; this.P = null;
    const riser = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 3.1, RISE, 40), sceneToon(0x3a1c6e, { emissive: accent, emissiveIntensity: 0.25 }));
    this.riser = riser; this.holder.add(riser); inkGroup(riser);
    this.rim = new THREE.Mesh(new THREE.TorusGeometry(2.62, 0.07, 8, 60), new THREE.MeshBasicMaterial({ color: accent })); this.rim.rotation.x = Math.PI / 2; this.holder.add(this.rim);
  }
  update(pose, dt, t) {
    const floor = this.app.floorY; this.riser.position.y = floor + RISE / 2; this.rim.position.y = floor + RISE + 0.02;
    const step = Math.floor(t * 12); // the coach is animated "on twos", like a comic in motion
    if (step !== this.step || !this.P) {
      this.step = step; this.P = buildSkeleton({ x: this.x, floor: floor + RISE, h: this.h, crouch: pose.c, lean: pose.l * D, sway: pose.s, arms: pose.a, legs: pose.legs }, this.P);
      for (let i = 0; i < 33; i++) { const p = this.rig.pts[i]; p.x = this.P[i][0]; p.y = this.P[i][1]; p.v = 1; }
    }
    this.rig.solve(dt); this.avatar.update(this.rig, dt, t, null);
    this.rim.scale.setScalar(1 + this.app.env.beatPulse * 0.06);
  }
}

class DanceBase {
  constructor(app, opts) {
    this.app = app; this.genre = GENRES[opts.genre || 'pop']; this.moves = this.genre.moves.map(id => MOVES[id]);
    this.coach = new Coach(app, this.genre.accent); this.clock = 0; this.b0 = null; this.done = false; this.lastBeat = -1; this.idlePose = P(DOWN, DOWN);
  }
  beatNow() { const a = this.app.audio; return a.ready && a.track ? a.beat : this.clock * (a.bpm / 60); }
  idle(dt, t) { this.clock += dt; this.coach.update(poseAt(this.moves[0], this.beatNow()), dt, t); }
  start() { this.b0 = Math.ceil((this.beatNow() + 0.5) / 4) * 4; }
  lookTarget() { return { x: this.coach.rig.j.head.x, y: this.coach.rig.j.head.y }; }
  dispose() { this.coach.avatar.dispose(); }
}

// ------------------------------------------------------------------ Dance Class
export class DanceClass extends DanceBase {
  static id = 'lesson'; static title = 'Dance Class'; static blurb = 'Learn the moves with Coach Dot'; static icon = 'lesson'; static dance = true;
  static colors = ['#ff6fb5', '#8a3bd6']; static theme = 'stage'; static stars = [2400, 4200, 5800];
  static howto = ['Watch Coach Dot show a move', 'Then copy it in time with the beat', 'You are a mirror: move the same side as the coach', 'Finish with the whole routine'];

  constructor(app, opts) {
    super(app, opts); this.segs = []; let at = 0;
    const add = (move, mode, beats, i) => { this.segs.push({ move, mode, beats, at, i }); at += beats; };
    this.moves.forEach((m, i) => { add(m, 'watch', 4, i); add(m, 'dance', 12, i); });
    for (let r = 0; r < 2; r++) this.moves.forEach((m, i) => add(m, 'remix', 4, i));
    this.total = at; this.seg = null; this.best = [0, 0, 0, 0]; this.streak = [0, 0, 0, 0]; this.pose = this.idlePose;
  }
  update(dt, t, players) {
    const { hud, fx, audio } = this.app; this.clock += dt;
    const beat = this.beatNow() - this.b0;
    if (beat < 0) { this.coach.update(this.idlePose, dt, t); return; }
    if (beat >= this.total) { this.done = true; return; }
    const seg = this.segs.find(s => beat < s.at + s.beats); const local = beat - seg.at;
    if (seg !== this.seg) {
      this.seg = seg;
      if (seg.mode === 'watch') { hud.banner(seg.move.name, '#fff', 1.6, 'Watch the coach'); audio.ding(); }
      else if (seg.mode === 'dance') { hud.banner('Your turn!', '#ffd23f', 1.1); audio.go(); }
      else if (seg === this.segs.find(s => s.mode === 'remix')) { hud.banner('The whole routine!', '#ffd23f', 1.5); audio.cheer(1.2); audio.hype(true); fx.speedLines(); }
      hud.setStatus(seg.mode === 'remix' ? `Routine: ${seg.move.name}` : `Move ${seg.i + 1} of 4: ${seg.move.name}`);
      hud.side(`<h4>${seg.move.name}</h4>` + seg.move.keys.map((k, i) => `<div class="pic"><b>${i + 1}</b>${picto(k)}</div>`).join(''), this.genre.colors[0]);
    }
    hud.sideActive(Math.floor(local) % 4);
    this.pose = poseAt(seg.move, local); this.coach.update(this.pose, dt, t);
    hud.setTimer(Math.ceil((this.total - beat) / (audio.bpm / 60)));
    if (seg.mode === 'watch') return;
    const k = Math.floor(local), f = local - k, held = seg.move.keys[k % 4];
    for (const p of players) if (f < 0.5) this.best[p.slot] = Math.max(this.best[p.slot], matchPose(p.rig, held));
    const bi = Math.floor(beat);
    if (f >= 0.5 && this.lastBeat !== bi) {
      this.lastBeat = bi;
      for (const p of players) {
        const s = p.slot, m = this.best[s]; this.best[s] = 0; const at = { x: p.j.head.x, y: p.j.head.y + 1.3 };
        if (m >= 0.78) { this.streak[s]++; this.app.addScore(s, 100, at, { text: 'Perfect!', color: '#ffd23f', cls: 'big', sub: this.streak[s] >= 3 ? this.streak[s] + ' streak' : '', cheer: 0.9 }); fx.ring(p.j.chest, 0xffd23f, 2.6, 0.4); fx.pow(p.j.haL, 0xffd23f, 0.7); fx.pow(p.j.haR, 0xffd23f, 0.7); fx.burst(p.j.haL, { count: 8, color: 0xffd23f, speed: 5 }); fx.burst(p.j.haR, { count: 8, color: 0xffd23f, speed: 5 });
          if (this.streak[s] % 5 === 0) { fx.word({ x: p.j.head.x, y: p.j.head.y + 2.1 }, this.streak[s] >= 10 ? 'ON FIRE!' : 'SO SMOOTH!', '#fff', p.css); audio.cheer(0.6); } if (s === players[0].slot) audio.perfect(); }
        else if (m >= 0.58) { this.streak[s]++; this.app.addScore(s, 60, at, { text: 'Great!', color: '#7fe3ff', sub: this.streak[s] >= 3 ? this.streak[s] + ' streak' : '' }); if (s === players[0].slot) audio.good(); }
        else if (m >= 0.4) { this.streak[s] = 0; this.app.addScore(s, 30, at, { text: 'Good', color: '#fff', cls: 'small', sub: '' }); }
        else { this.streak[s] = 0; fx.popup(at, 'Keep going', 'rgba(255,255,255,.7)', 'small'); this.app.hud.setScore(s, this.app.scores[s], ''); }
      }
    }
  }
  results() { const top = Math.max(0, ...this.app.scores); return { title: top >= 4200 ? 'Dance star!' : 'Class dismissed!', note: `${this.genre.name} routine complete` }; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !this.seg || this.seg.mode === 'watch') return { followPointer: false };
    const sloppy = i % 2 ? 18 * Math.sin(t * 3 + i) : 0; const ps = this.pose;
    return intentFor(ps, { arms: [[ps.a[0][0] + sloppy, ps.a[0][1]], [ps.a[1][0] - sloppy, ps.a[1][1]]] });
  }
}

// ------------------------------------------------------------------ Dance Battle
const PROMPTS = [
  { say: 'Hands up high!', test: (r) => r.j.haL.y > r.j.head.y + 0.3 * r.S && r.j.haR.y > r.j.head.y + 0.3 * r.S, intent: { arms: [[165, 0], [165, 0]] } },
  { say: 'Get low!', test: (r) => r.crouch > 0.55, intent: { crouch: 1 } },
  { say: 'Go big and wide!', test: (r) => Math.abs(r.j.haL.x - r.j.haR.x) > 3.3 * r.S, intent: { arms: [[92, 0], [92, 0]] } },
  { say: 'Lean way over!', test: (r) => Math.abs(r.lean) > 0.2, intent: { lean: 0.32 } },
  { say: 'Jump!', test: (r) => r.jump > 0.45, intent: { jump: true } },
];
const TAGS = [
  ['Hands up', (r) => r.j.haL.y > r.j.head.y + 0.3 * r.S && r.j.haR.y > r.j.head.y + 0.3 * r.S],
  ['Low', (r) => r.crouch > 0.55], ['Wide', (r) => Math.abs(r.j.haL.x - r.j.haR.x) > 3.3 * r.S],
  ['Lean', (r) => Math.abs(r.lean) > 0.2], ['Jump', (r) => r.jump > 0.45],
  ['Left up', (r) => r.j.haL.y > r.j.head.y + 0.3 * r.S && r.j.haR.y < r.j.chest.y],
  ['Right up', (r) => r.j.haR.y > r.j.head.y + 0.3 * r.S && r.j.haL.y < r.j.chest.y],
  ['Cross', (r) => r.j.haL.x > r.j.haR.x + 0.5 * r.S], ['Kick', (r) => Math.max(r.j.anL.y, r.j.anR.y) > Math.min(r.j.anL.y, r.j.anR.y) + 0.7 * r.S],
];
const TURN = 8, FINALE = 16;

export class DanceBattle extends DanceBase {
  static id = 'battle'; static title = 'Dance Battle'; static blurb = 'Freestyle in the spotlight'; static icon = 'battle'; static dance = true;
  static colors = ['#ffb347', '#d6306f']; static theme = 'stage'; static stars = [1200, 2200, 3200];
  static howto = ['Take turns to freestyle in the spotlight', 'Move big, move on the beat, and mix up your moves', 'Hit the challenge move for a bonus', 'Everyone dances the finale, then FREEZE!'];

  constructor(app, opts) {
    super(app, opts);
    this.spot = new THREE.Mesh(new THREE.ConeGeometry(2.6, 20, 32, 1, true).translate(0, -10, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    app.root.add(this.spot); this.spotX = 0; this.rival = 0; this.turnIdx = -1; this.turnScore = 0; this.lastPlayerTurn = 420;
  }
  start() {
    super.start(); const slots = this.app.players.map(p => p.slot);
    this.solo = slots.length <= 1; const cont = this.solo ? [slots[0] ?? 0, 'cpu'] : slots; const rounds = slots.length >= 4 ? 2 : slots.length === 3 ? 3 : 4;
    this.turns = []; for (let r = 0; r < rounds; r++) for (const c of cont) this.turns.push({ who: c, prompt: PROMPTS[(this.turns.length * 2 + r) % PROMPTS.length] });
    this.total = this.turns.length * TURN + FINALE; this.phase = 'turns'; this.freezeT = 0;
  }
  active(players) { // who is dancing for points right now
    if (this.phase === 'finale') return players; const tn = this.turns?.[this.turnIdx]; if (!tn || tn.who === 'cpu') return []; return players.filter(p => p.slot === tn.who);
  }
  beginTurn(i, players) {
    const { hud, audio } = this.app; this.turnIdx = i; const tn = this.turns[i]; this.turnScore = 0; this.tags = new Set(); this.promptDone = false; this.eAcc = 0; this.nearMax = 0; this.midE = 0;
    if (tn.who === 'cpu') { hud.banner('DJ Dot\'s turn', '#ff8fd0', 1.4, 'Watch and get ready'); this.cpuTarget = Math.max(260, this.lastPlayerTurn * (0.78 + Math.random() * 0.3)); }
    else { hud.banner(`${PLAYER_NAMES[tn.who]}'s turn!`, PLAYER_CSS[tn.who], 1.6, 'Challenge: ' + tn.prompt.say); }
    hud.setStatus(tn.who === 'cpu' ? 'DJ Dot is dancing' : 'Challenge: ' + tn.prompt.say); audio.ding(tn.who === 'cpu' ? 76 : 84); this.styleCard(tn.who);
  }
  endTurn() {
    const tn = this.turns[this.turnIdx]; if (!tn) return; const { fx, audio } = this.app;
    if (tn.who === 'cpu') { fx.popup({ x: 0, y: 3.2 }, `DJ Dot: ${Math.round(this.rival).toLocaleString()}`, '#ff8fd0', 'big'); }
    else { this.lastPlayerTurn = this.turnScore; const p = this.app.players.find(q => q.slot === tn.who); if (p) { fx.popup({ x: p.j.head.x, y: p.j.head.y + 2 }, `${Math.round(this.turnScore)} points!`, p.css, 'big'); fx.confetti(p.j.chest, 40); } }
    audio.cheer(1.3);
  }
  // the list of style moves to collect during a turn
  styleCard(who) {
    const hud = this.app.hud; if (who === 'cpu' || who === undefined) { hud.side(''); return; }
    hud.side('<h4>Style moves</h4>' + TAGS.map(([n]) => `<div class="tagrow ${this.tags.has(who + n) ? 'on' : ''}">${n}</div>`).join(''), PLAYER_CSS[who]);
  }
  give(p, pts, text, cls = 'small', color) { this.turnScore += pts; this.app.addScore(p.slot, pts, { x: p.j.head.x + (Math.random() - 0.5) * 1.5, y: p.j.head.y + 1.2 + Math.random() * 0.6 }, { text, cls, color }); }

  update(dt, t, players) {
    const { hud, fx, audio } = this.app; this.clock += dt;
    const beat = this.beatNow() - this.b0; const floor = this.app.floorY;
    const move = this.moves[Math.floor(Math.max(0, beat) / 4) % this.moves.length];
    this.coach.update(beat < 0 ? this.idlePose : poseAt(move, beat), dt, t);
    this.botPose = poseAt(this.moves[(Math.floor(Math.max(0, beat) / 4) + 1) % this.moves.length], beat);
    if (beat < 0) return;

    if (this.phase === 'freeze') {
      this.freezeT += dt;
      if (this.freezeT > 0.6) for (const p of players) if (p.rig.energy > 0.45) this.moved.add(p.slot);
      if (this.freezeT > 3.1) {
        for (const p of players) { if (!this.moved.has(p.slot)) { this.give(p, 200, 'Ice cold! +200', 'big', '#9fe8ff'); fx.ring(p.j.chest, 0x9fe8ff, 3, 0.5); } else fx.popup({ x: p.j.head.x, y: p.j.head.y + 1.3 }, 'Wiggled!', '#ff9ab5'); }
        audio.setMuffle(false); this.done = true;
      }
      return;
    }
    if (beat >= this.total) {
      this.phase = 'freeze'; this.moved = new Set(); this.spot.material.opacity = 0; hud.banner('FREEZE!', '#9fe8ff', 2.6, 'Hold your pose'); fx.speedLines(); hud.side(''); hud.setStatus('Freeze!'); audio.scratch(); audio.freeze(); audio.setMuffle(true); return;
    }
    const ti = Math.floor(beat / TURN);
    if (ti < this.turns.length) { if (ti !== this.turnIdx) { if (this.turnIdx >= 0) this.endTurn(); this.beginTurn(ti, players); } }
    else if (this.phase !== 'finale') { this.endTurn(); this.phase = 'finale'; this.turnIdx = -1; this.tags = new Set(); this.promptDone = true; hud.banner('Everybody dance!', '#ffd23f', 1.6, 'Double points'); hud.setStatus('Finale! Double points'); audio.cheer(1.6); audio.hype(true); hud.side(''); fx.speedLines(); }
    hud.setTimer(Math.ceil((this.total - beat) / (audio.bpm / 60)));

    const tn = this.turns[this.turnIdx]; const act = this.active(players); const mult = this.phase === 'finale' ? 2 : 1;
    const f = beat - Math.floor(beat), bi = Math.floor(beat), onBeat = this.lastBeat !== bi; if (onBeat) this.lastBeat = bi;

    // spotlight follows whoever has the floor
    let sx = null; if (tn?.who === 'cpu') sx = 0; else if (act.length === 1) sx = act[0].j.hipC.x;
    if (sx !== null) { this.spotX += (sx - this.spotX) * Math.min(1, dt * 6); this.spot.position.set(this.spotX, floor + 20, tn?.who === 'cpu' ? -4.5 : 0); this.spot.material.opacity = 0.06 + 0.04 * this.app.env.beatPulse; }
    else this.spot.material.opacity = 0;

    if (tn?.who === 'cpu') { this.rival += this.cpuTarget / TURN * (audio.bpm / 60) * dt; this.rivalChip(); return; }
    for (const p of act) {
      const r = p.rig, s = p.slot; p._e = (p._e || 0) + Math.min(r.energy, 2.4) * 48 * mult * dt;
      if (f < 0.2 || f > 0.82) p._near = Math.max(p._near || 0, r.energy); else if (f > 0.4 && f < 0.6) p._mid = r.energy;
      if (r.energy > 0.5 && Math.random() < dt * 10) fx.burst(r.hands[Math.random() < 0.5 ? 0 : 1], { count: 1, color: p.color, speed: 2, size: 0.2, gravity: -1 });
      if (this.phase !== 'finale' && !this.promptDone && tn.prompt.test(r)) { this.promptDone = true; this.give(p, 150, '+150', 'big', '#ffd23f'); fx.word({ x: p.j.head.x, y: p.j.head.y + 2 }, 'NAILED IT!', '#ffd23f', p.css); audio.gold(); fx.confetti(p.j.chest, 30); this.app.avatars[s]?.cheer(1); }
      for (const [name, test] of TAGS) { const key = s + name; if (!this.tags.has(key) && test(r)) { this.tags.add(key); this.give(p, 50 * mult, `${name}! +${50 * mult}`, '', '#7fe3ff'); audio.ding(86); fx.pow(r.hands[0], 0x7fe3ff, 0.7); if (this.phase !== 'finale') this.styleCard(s); } }
      if (onBeat) {
        const e = Math.round(p._e || 0); p._e = 0; if (e > 4) this.give(p, e, '+' + e);
        if ((p._near || 0) > 0.7 && (p._near || 0) > (p._mid || 0) * 1.15) { this.give(p, 40 * mult, 'On the beat!', '', '#ffd23f'); fx.ring({ x: p.j.hipC.x, y: floor + 0.2 }, p.color, 2.4, 0.35); }
        p._near = 0;
      }
    }
    if (this.solo) this.rivalChip();
  }
  rivalChip() {
    const hud = this.app.hud; let c = hud.chips.cpu;
    if (!c) { c = hud.chips.cpu = document.createElement('div'); c.className = 'chip'; c.style.setProperty('--pc', '#ff8fd0'); c.innerHTML = '<i></i><b>DJ Dot</b><span>0</span>'; hud.scoresEl.appendChild(c); }
    c.querySelector('span').textContent = Math.round(this.rival).toLocaleString();
  }
  results() {
    if (!this.solo) return { note: `${this.genre.name} battle` };
    const s = this.turns[0].who, mine = this.app.scores[s], cpu = Math.round(this.rival);
    const rows = [{ name: PLAYER_NAMES[s], css: PLAYER_CSS[s], score: mine, slot: s }, { name: 'DJ Dot', css: '#ff8fd0', score: cpu }].sort((a, b) => b.score - a.score);
    return { rows, score: mine, title: mine >= cpu ? 'You beat DJ Dot!' : 'DJ Dot takes it!', note: mine >= cpu ? `${this.genre.name} battle champion` : 'So close. Go again?' };
  }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p || !this.turns) return { followPointer: false };
    if (this.phase === 'freeze') return { arms: [[130, 40], [40, -60]], lean: 0.1, snap: 30, followPointer: false };
    const tn = this.turns[this.turnIdx]; const on = this.phase === 'finale' || (tn && tn.who === p.slot);
    if (!on) return { crouch: 0.15 * this.app.env.beatPulse, followPointer: false };
    const local = (this.beatNow() - this.b0) % TURN; const it = intentFor(this.botPose);
    if (tn && local > 2 && local < 4) Object.assign(it, tn.prompt.intent);
    if (local > 5 && local < 6) it.jump = true;
    if (local > 6) { it.arms = [[20, -110], [150, 0]]; it.crouch = 0.8; }
    return it;
  }
  dispose() { super.dispose(); this.spot.removeFromParent(); this.app.audio.setMuffle(false); }
}
