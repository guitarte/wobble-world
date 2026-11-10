// The dance games. A coach character (Dot) shows moves on the beat.
//   Dance Class:  learn four moves one at a time, then string them together.
//   Dance Battle: freestyle turns in the spotlight, judged on energy, rhythm and style.
// Music comes in three original styles: pop, K-pop and hip hop.
import * as THREE from 'three';
import { sceneToon, inkGroup } from '../toon.js';
import { Rig, PLAYER_CSS, PLAYER_NAMES } from '../tracking.js';
import { buildSkeleton } from '../sim.js';
import { Avatar, COACH } from '../avatar.js';

const D = Math.PI / 180, RISE = 1.9;
const clamp = THREE.MathUtils.clamp, lerp = THREE.MathUtils.lerp;
const P = (aL, aR, o = {}) => ({ a: [aL, aR], c: 0, l: 0, s: 0, legs: [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }], ...o });
const DOWN = [18, 12], HIP = [50, -100];

// Arm shapes are [shoulder, elbow] in degrees: 0 hangs down, 90 points out to the side,
// 180 points up, and a negative angle reaches across the body.
const CHEST = [40, -150], LOW = [22, -40], OPEN = [45, 5], CROSS = [10, -130], X_LOW = [5, -60];
const step = (l, r, lift = [0, 0]) => [{ dx: l, lift: lift[0] }, { dx: r, lift: lift[1] }];

// Real moves from hip hop, pop and K-pop classes, chosen because a single camera facing
// the dancer can read them: clear arm shapes, knee lifts, leans and bounces rather than
// spins, floor work or fine footwork. Each has four counts (the Grapevine has eight).
//   tip: what a teacher would say.  pulse: knees bounce on every beat.
//   sig: the count that makes the move recognisable on its own (for Dance Battle).
const MOVES = {
  // ---- hip hop: grooves and party dances
  bounce: { name: 'The Bounce', tip: 'Bend your knees on every beat and stay loose', pulse: 0.5,
    keys: [P([35, -90], [35, -90], { l: -4 }), P([26, -55], [26, -55]), P([35, -90], [35, -90], { l: 4 }), P([26, -55], [26, -55])] },
  twostep: { name: 'Two-Step', tip: 'Step out, feet together, and swing your arms the same way', pulse: 0.25,
    keys: [P([50, 10], [-15, -45], { s: -0.05, l: -5, legs: step(-0.05, 0.05) }), P(CHEST, CHEST, { s: -0.1 }), P([-15, -45], [50, 10], { s: -0.05, l: 5, legs: step(-0.05, 0.05) }), P(CHEST, CHEST)] },
  roof: { name: 'Raise the Roof', tip: 'Palms up, and push the ceiling twice', sig: 1,
    keys: [P([105, 75], [105, 75], { c: 0.3 }), P([145, 35], [145, 35]), P([105, 75], [105, 75], { c: 0.3 }), P([145, 35], [145, 35])] },
  dab: { name: 'The Dab', tip: 'Drop your face into one elbow and shoot the other arm out', sig: 0,
    keys: [P([125, 0], [-95, -30], { l: -8 }), P([25, -60], [25, -60], { c: 0.3 }), P([-95, -30], [125, 0], { l: 8 }), P([25, -60], [25, -60], { c: 0.3 })] },
  runningman: { name: 'Running Man', tip: 'Knee up and fists in, then slide the foot back and push down', pulse: 0.15, sig: 0,
    keys: [P(CHEST, CHEST, { legs: step(0, 0, [0.15, 0]) }), P([30, -8], [30, -8]), P(CHEST, CHEST, { legs: step(0, 0, [0, 0.15]) }), P([30, -8], [30, -8])] },
  cabbage: { name: 'Cabbage Patch', tip: 'Fists together, and stir a great big pot', pulse: 0.2, sig: 0,
    keys: [P([25, 148], [-60, -57], { s: -0.04, l: -6 }), P([30, -75], [30, -75], { c: 0.2 }), P([-60, -57], [25, 148], { s: 0.04, l: 6 }), P(CHEST, CHEST)] },
  toprock: { name: 'Top Rock', tip: 'Cross your arms, then step across and swing them open', pulse: 0.15, sig: 1,
    keys: [P(CROSS, CROSS, { c: 0.1 }), P([82, 10], [82, 10], { l: 5, legs: step(0.12, 0) }), P(CROSS, CROSS, { c: 0.1 }), P([82, 10], [82, 10], { l: -5, legs: step(0, -0.12) })] },
  millyrock: { name: 'Milly Rock', tip: 'Sweep one arm out wide as you step that way, then the other', pulse: 0.2, sig: 0,
    keys: [P([88, 15], [15, -55], { s: -0.06, l: -6, legs: step(-0.06, 0.03) }), P(LOW, LOW), P([15, -55], [88, 15], { s: 0.06, l: 6, legs: step(-0.03, 0.06) }), P(LOW, LOW)] },
  floss: { name: 'The Floss', tip: 'Both arms swing one way while your hips go the other', sig: 0,
    keys: [P([38, 0], [-38, 0], { s: 0.05 }), P([-38, 0], [38, 0], { s: -0.05 }), P([38, 0], [-38, 0], { s: 0.05 }), P([-38, 0], [38, 0], { s: -0.05 })] },
  whip: { name: 'The Whip', tip: 'Feet wide, drop low, and punch out like you grabbed a steering wheel', sig: 0,
    keys: [P(HIP, [78, 6], { c: 0.4, l: 4, legs: step(-0.09, 0.09) }), P(HIP, [62, -25], { c: 0.25, legs: step(-0.09, 0.09) }), P([78, 6], HIP, { c: 0.4, l: -4, legs: step(-0.09, 0.09) }), P([62, -25], HIP, { c: 0.25, legs: step(-0.09, 0.09) })] },
  naenae: { name: 'The Nae Nae', tip: 'One hand in the air, knees bent, and rock from side to side', sig: 0,
    keys: [P(LOW, [150, -35], { c: 0.3, l: 8, s: 0.04, legs: step(-0.08, 0.08) }), P(LOW, [140, -65], { c: 0.3, l: -8, s: -0.04, legs: step(-0.08, 0.08) }), P([150, -35], LOW, { c: 0.3, l: -8, s: -0.04, legs: step(-0.08, 0.08) }), P([140, -65], LOW, { c: 0.3, l: 8, s: 0.04, legs: step(-0.08, 0.08) })] },
  woah: { name: 'The Woah', tip: 'Roll your fists, then lock it and freeze', sig: 2,
    keys: [P([30, -95], [30, -95], { c: 0.3 }), P([48, -140], [48, -140], { c: 0.15 }), P([80, -170], [-30, -40], { c: 0.25, l: -10 }), P([80, -170], [-30, -40], { c: 0.25, l: -10 })] },

  // ---- pop: the steps a pop or jazz class starts with
  steptouch: { name: 'Step Touch', tip: 'Step out, bring your feet together, and clap', pulse: 0.15,
    keys: [P(OPEN, OPEN, { s: -0.05, legs: step(-0.05, 0.05) }), P(CHEST, CHEST, { s: -0.1 }), P(OPEN, OPEN, { s: -0.05, legs: step(-0.05, 0.05) }), P(CHEST, CHEST)] },
  highv: { name: 'High V, Low V', tip: 'Strong straight arms: reach up to a V, then down to a V', sig: 0,
    keys: [P([150, 0], [150, 0]), P([42, 0], [42, 0], { c: 0.25 }), P([150, 0], [150, 0]), P([42, 0], [42, 0], { c: 0.25 })] },
  starjump: { name: 'Star Jump', tip: 'Jump out into a star, then tuck back in', sig: 0,
    keys: [P([122, 0], [122, 0], { legs: step(-0.11, 0.11) }), P(CHEST, CHEST, { c: 0.5 }), P([122, 0], [122, 0], { legs: step(-0.11, 0.11) }), P(CHEST, CHEST, { c: 0.5 })] },
  point: { name: 'The Point', tip: 'Point to the sky, then down across your body. Other hand on your hip', sig: 0,
    keys: [P(HIP, [140, 0], { l: 6 }), P(HIP, [-40, 0], { c: 0.2, l: -4 }), P([140, 0], HIP, { l: -6 }), P([-40, 0], HIP, { c: 0.2, l: 4 })] },
  grapevine: { name: 'Grapevine', tip: 'Step, cross behind, step, clap. Then come back the other way', pulse: 0.12,
    keys: [P(OPEN, OPEN, { s: -0.06, legs: step(-0.07, 0) }), P(X_LOW, X_LOW, { s: -0.11, legs: step(0, -0.15) }), P(OPEN, OPEN, { s: -0.17, legs: step(-0.07, 0) }), P(CHEST, CHEST, { s: -0.2 }),
      P(OPEN, OPEN, { s: -0.14, legs: step(0, 0.07) }), P(X_LOW, X_LOW, { s: -0.09, legs: step(0.15, 0) }), P(OPEN, OPEN, { s: -0.03, legs: step(0, 0.07) }), P(CHEST, CHEST)] },
  jazzsquare: { name: 'Jazz Square', tip: 'Cross, back, side, front: draw a box with your feet',
    keys: [P(X_LOW, X_LOW, { legs: step(0, -0.14) }), P([35, -110], [35, -110], { c: 0.12, s: -0.02 }), P([80, 0], [80, 0], { s: 0.04, legs: step(-0.06, 0.08) }), P(HIP, HIP)] },
  kickball: { name: 'Kick Ball Change', tip: 'Kick, step back on the ball of your foot, and change', sig: 0,
    keys: [P([90, 0], [90, 0], { legs: step(0, 0, [0, 0.17]) }), P([35, -110], [35, -110], { c: 0.15 }), P([42, 0], [42, 0]), P(CHEST, CHEST)] },
  lunge: { name: 'Lunge and Reach', tip: 'Step wide into a lunge and reach up and over', sig: 0,
    keys: [P(HIP, [200, 0], { c: 0.3, s: -0.1, l: -10, legs: step(-0.13, 0.03) }), P(LOW, LOW), P([200, 0], HIP, { c: 0.3, s: 0.1, l: 10, legs: step(-0.03, 0.13) }), P(LOW, LOW)] },

  // ---- K-pop: sharp shapes and point moves
  heart: { name: 'Big Heart', tip: 'Make a heart over your head, then open it out', sig: 0,
    keys: [P([160, 65], [160, 65]), P([90, 0], [90, 0]), P([160, 65], [160, 65]), P([25, 10], [25, 10], { c: 0.35 })] },
  robot: { name: 'The Robot', tip: 'Square elbows. One arm up, one down, and switch', sig: 0,
    keys: [P([90, 90], [90, -90]), P([90, -90], [90, 90]), P([90, 90], [90, -90]), P([90, 90], [90, 90])] },
  fistpump: { name: 'Fist Pump', tip: 'Punch one fist to the sky, bounce, then the other', pulse: 0.2, sig: 0,
    keys: [P(CHEST, [172, 0]), P(CHEST, CHEST, { c: 0.2 }), P([172, 0], CHEST), P(CHEST, CHEST, { c: 0.2 })] },
  hipsway: { name: 'Hip Sway', tip: 'Hands on your hips and sway. Then one hand behind your head',
    keys: [P(HIP, HIP, { s: -0.05, l: 5 }), P(HIP, HIP, { s: 0.05, l: -5 }), P(HIP, [130, 140], { s: -0.05, l: 5 }), P(HIP, [130, 140], { s: 0.05, l: -5 })] },
  armwave: { name: 'Arm Wave', tip: 'Send a wave from one hand, through your shoulders, to the other',
    keys: [P([80, 42], [90, 0]), P([112, -42], [90, 0], { l: -4 }), P([90, 0], [112, -42], { l: 4 }), P([90, 0], [80, 42])] },
  tutting: { name: 'Tutting', tip: 'Flat hands and right angles, like a wall painting', sig: 3,
    keys: [P([90, 90], [90, 90]), P([90, 180], [90, 180]), P([90, 90], [90, -90]), P([160, 110], [90, 180])] },
  lockpoint: { name: 'Lock and Point', tip: 'Drop into the lock with elbows out, then point sharp to the corner', sig: 1,
    keys: [P([65, -100], [65, -100], { c: 0.4 }), P(HIP, [130, 0], { l: 5 }), P([65, -100], [65, -100], { c: 0.4 }), P([130, 0], HIP, { l: -5 })] },
  crisscross: { name: 'Criss Cross', tip: 'Jump your feet apart, then cross them. Arms do the same', pulse: 0.2, sig: 1,
    keys: [P([52, 0], [52, 0], { legs: step(-0.11, 0.11) }), P(CROSS, CROSS, { legs: step(0.1, -0.1) }), P([52, 0], [52, 0], { legs: step(-0.11, 0.11) }), P(LOW, LOW, { c: 0.2 })] },
};

// Each style is taught as lessons of four moves, easiest first. Dance Class moves on
// to the next lesson every time one is finished.
export const GENRES = {
  pop: { name: 'Pop', blurb: 'Bright and bouncy', music: 'pop', accent: 0xff4fa3, colors: ['#ff6fb5', '#d42f7c'],
    titles: ['First steps', 'Travelling steps'], lessons: [['steptouch', 'highv', 'starjump', 'point'], ['grapevine', 'jazzsquare', 'kickball', 'lunge']] },
  kpop: { name: 'K-Pop', blurb: 'Sharp and sparkly', music: 'kpop', accent: 0x8a6bff, colors: ['#8f7bff', '#4d2fd0'],
    titles: ['Sharp shapes', 'Waves and points'], lessons: [['heart', 'robot', 'fistpump', 'hipsway'], ['armwave', 'tutting', 'lockpoint', 'crisscross']] },
  hiphop: { name: 'Hip Hop', blurb: 'Laid back and bouncy', music: 'hiphop', accent: 0xffa62b, colors: ['#ffb347', '#e06a12'],
    titles: ['Grooves', 'Old-school classics', 'Party moves'], lessons: [['bounce', 'twostep', 'roof', 'dab'], ['runningman', 'cabbage', 'toprock', 'millyrock'], ['floss', 'whip', 'naenae', 'woah']] },
};
for (const [id, g] of Object.entries(GENRES)) g.id = id;
const lessonKey = (g) => 'ww-lesson-' + g.id;
// Which lesson comes next for a style, and which ones have been finished (remembered on this device).
export function lessonOf(g) { try { return (+localStorage.getItem(lessonKey(g)) || 0) % g.lessons.length; } catch (e) { return 0; } }
export function lessonsDone(g) { try { return +localStorage.getItem(lessonKey(g) + '-done') || 0; } catch (e) { return 0; } }
export const lessonMoves = (g, i) => g.lessons[i].map(id => MOVES[id].name);

function mix(a, b, u) {
  return { a: [[lerp(a.a[0][0], b.a[0][0], u), lerp(a.a[0][1], b.a[0][1], u)], [lerp(a.a[1][0], b.a[1][0], u), lerp(a.a[1][1], b.a[1][1], u)]],
    c: lerp(a.c, b.c, u), l: lerp(a.l, b.l, u), s: lerp(a.s, b.s, u),
    legs: [0, 1].map(i => ({ dx: lerp(a.legs[i].dx, b.legs[i].dx, u), lift: lerp(a.legs[i].lift, b.legs[i].lift, u) })) };
}
// Hold each pose for the first part of its beat, then glide to the next one. Groove
// moves also dip the knees on every beat, deepest right on the beat.
function poseAt(move, beat) {
  const n = move.keys.length, k = ((Math.floor(beat) % n) + n) % n, f = beat - Math.floor(beat);
  const u = clamp((f - 0.5) / 0.5, 0, 1), ps = mix(move.keys[k], move.keys[(k + 1) % n], u * u * (3 - 2 * u));
  if (move.pulse) ps.c += move.pulse * (0.5 + 0.5 * Math.cos(f * Math.PI * 2));
  return ps;
}
// The same pose facing the other way.
const flip = (p) => ({ ...p, a: [p.a[1], p.a[0]], l: -p.l, s: -p.s, legs: [{ dx: -p.legs[1].dx, lift: p.legs[1].lift }, { dx: -p.legs[0].dx, lift: p.legs[0].lift }] });
// Poses for the heroes dancing on the title screen.
const DEMO = ['highv', 'armwave', 'roof', 'heart', 'toprock', 'point', 'robot', 'millyrock'];
export const demoPose = (i, beat) => poseAt(MOVES[DEMO[(i + Math.floor(beat / 8)) % DEMO.length]], beat);
const tA = new THREE.Vector3(), tB = new THREE.Vector3();
// 0..1: how closely a player matches a pose (compared as seen on screen, like a mirror).
// Arms always count. A knee lift, a lean or a bounce counts when the pose calls for one,
// and legs are left out when the camera cannot see them.
function matchPose(rig, pose, bounce = 0) {
  let arms = 0; const m = (d) => clamp((d - 0.1) / 0.72, 0, 1);
  for (let side = 0; side < 2; side++) {
    const sg = side ? 1 : -1, a = pose.a[side][0] * D, b = a + pose.a[side][1] * D, sfx = side ? 'R' : 'L';
    rig.dir('sh' + sfx, 'el' + sfx, tA); rig.dir('el' + sfx, 'wr' + sfx, tB);
    arms += m(tA.x * sg * Math.sin(a) - tA.y * Math.cos(a)) * 0.25 + m(tB.x * sg * Math.sin(b) - tB.y * Math.cos(b)) * 0.25;
  }
  let score = arms * 0.82, total = 0.82;
  const add = (w, v) => { score += w * clamp(v, 0, 1); total += w; };
  add(0.18, 1 - Math.abs(rig.crouch - pose.c) * 1.4);
  const lift = Math.max(pose.legs[0].lift, pose.legs[1].lift);
  if (lift > 0.08 && rig.legsSeen) add(0.3, (Math.abs(rig.j.anL.y - rig.j.anR.y) / rig.S - 0.2) / 0.4);
  if (Math.abs(pose.l) >= 8) add(0.15, rig.lean * Math.sign(pose.l) / (Math.abs(pose.l) * D * 0.6));
  if (bounce) add(0.25, rig.dip / 0.5);
  return score / total;
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
    this.avatar = new Avatar({ ...COACH, accent, shoe: accent }); this.holder.add(this.avatar.group); this.h = 4.8; this.x = 0; this.P = null;
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
    this.app = app; this.genre = GENRES[opts.genre || 'pop'];
    this.lesson = opts.lesson != null ? ((opts.lesson % this.genre.lessons.length) + this.genre.lessons.length) % this.genre.lessons.length : lessonOf(this.genre);
    this.moves = this.pickMoves().map(id => MOVES[id]);
    this.coach = new Coach(app, this.genre.accent); this.clock = 0; this.b0 = null; this.done = false; this.lastBeat = -1; this.idlePose = P(DOWN, DOWN);
  }
  pickMoves() { return this.genre.lessons[this.lesson]; }
  beatNow() { const a = this.app.audio; return a.ready && a.track ? a.beat : this.clock * (a.bpm / 60); }
  idle(dt, t) { this.clock += dt; this.coach.update(poseAt(this.moves[0], this.beatNow()), dt, t); }
  start() { this.b0 = Math.ceil((this.beatNow() + 0.5) / 4) * 4; }
  lookTarget() { return { x: this.coach.rig.j.head.x, y: this.coach.rig.j.head.y }; }
  dispose() { this.coach.avatar.dispose(); }
}

// ------------------------------------------------------------------ Dance Class
const WATCH = 8, DANCE = 12;
export class DanceClass extends DanceBase {
  static id = 'lesson'; static title = 'Dance Class'; static blurb = 'Learn real moves with Coach Dot'; static icon = 'lesson'; static dance = true;
  static colors = ['#ff6fb5', '#8a3bd6']; static theme = 'stage'; static stars = [2400, 4200, 5800];
  static howto = ['Watch Coach Dot show a move', 'Then copy it in time with the beat', 'You are a mirror: move the same side as the coach', 'Finish with the whole routine'];

  constructor(app, opts) {
    super(app, opts); this.segs = []; let at = 0;
    const add = (move, mode, beats, i) => { this.segs.push({ move, mode, beats, at, i }); at += beats; };
    this.moves.forEach((m, i) => { add(m, 'watch', WATCH, i); add(m, 'dance', DANCE, i); });
    for (let r = 0; r < 2; r++) this.moves.forEach((m, i) => add(m, 'remix', 4, i));
    this.total = at; this.seg = null; this.best = [0, 0, 0, 0]; this.streak = [0, 0, 0, 0]; this.pose = this.idlePose;
    this.label = `${this.genre.name} lesson ${this.lesson + 1}: ${this.genre.titles[this.lesson]}`;
  }
  update(dt, t, players) {
    const { hud, fx, audio } = this.app; this.clock += dt;
    const beat = this.beatNow() - this.b0;
    if (beat < 0) { this.coach.update(this.idlePose, dt, t); return; }
    if (beat >= this.total) { this.done = true; return; }
    const seg = this.segs.find(s => beat < s.at + s.beats); const local = beat - seg.at, n = seg.move.keys.length;
    if (seg !== this.seg) {
      this.seg = seg;
      if (seg.mode === 'watch') { hud.banner(seg.move.name, '#fff', 1.5, 'Watch the coach'); audio.ding(); }
      else if (seg.mode === 'dance') { hud.banner('Your turn!', '#ffd23f', 1.1); audio.go(); }
      else if (seg === this.segs.find(s => s.mode === 'remix')) { hud.banner('The whole routine!', '#ffd23f', 1.5); audio.cheer(1.2); audio.hype(true); fx.speedLines(); }
      hud.setStatus(seg.mode === 'remix' ? `Routine: ${seg.move.name}` : `Move ${seg.i + 1} of 4: ${seg.move.name}`);
      hud.hint(seg.mode === 'remix' ? '' : seg.move.tip); // what a teacher would say, for as long as the move is being learned
    }
    // the move strip shows four counts at a time; an eight-count move turns the page
    const page = Math.floor(local / 4) % (n / 4) * 4;
    hud.side(`<h4>${seg.move.name}</h4>` + seg.move.keys.slice(page, page + 4).map((k, i) => `<div class="pic"><b>${page + i + 1}</b>${picto(k)}</div>`).join(''), this.genre.colors[0]);
    hud.sideActive(Math.floor(local) % 4);
    this.pose = poseAt(seg.move, local); this.coach.update(this.pose, dt, t);
    hud.setTimer(Math.ceil((this.total - beat) / (audio.bpm / 60)));
    if (seg.mode === 'watch') return;
    const k = Math.floor(local), f = local - k, held = seg.move.keys[k % n];
    for (const p of players) if (f < 0.5) this.best[p.slot] = Math.max(this.best[p.slot], matchPose(p.rig, held, seg.move.pulse || 0));
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
  results() {
    const top = Math.max(0, ...this.app.scores), g = this.genre, count = g.lessons.length, next = (this.lesson + 1) % count;
    try { localStorage.setItem(lessonKey(g), next); localStorage.setItem(lessonKey(g) + '-done', lessonsDone(g) | (1 << this.lesson)); } catch (e) { /* fine */ }
    return { title: top >= 4200 ? 'Dance star!' : 'Class dismissed!', note: `${g.name} lesson ${this.lesson + 1} done: ${this.moves.map(m => m.name).join(', ')}.${next ? ` Up next: lesson ${next + 1}, ${g.titles[next]}` : ''}` };
  }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !this.seg || this.seg.mode === 'watch') return { followPointer: false };
    const sloppy = i % 2 ? 18 * Math.sin(t * 3 + i) : 0; const ps = this.pose;
    return intentFor(ps, { arms: [[ps.a[0][0] + sloppy, ps.a[0][1]], [ps.a[1][0] - sloppy, ps.a[1][1]]] });
  }
}

// ------------------------------------------------------------------ Dance Battle
const handsUp = (r) => r.j.haL.y > r.j.head.y + 0.3 * r.S && r.j.haR.y > r.j.head.y + 0.3 * r.S;
const BASICS = [
  { name: 'Hands Up', test: handsUp, intent: { arms: [[165, 0], [165, 0]] } },
  { name: 'Get Low', test: (r) => r.crouch > 0.55, intent: { crouch: 1 } },
  { name: 'Jump', test: (r) => r.jump > 0.45, intent: { jump: true } },
];
// A real move counts when its signature count is hit, facing either way.
const styleFor = (m) => { const k = m.keys[m.sig], kf = flip(k); return { name: m.name, key: k, test: (r) => Math.max(matchPose(r, k), matchPose(r, kf)) >= 0.84, intent: intentFor(k) }; };
const TURN = 8, FINALE = 16;

export class DanceBattle extends DanceBase {
  static id = 'battle'; static title = 'Dance Battle'; static blurb = 'Freestyle in the spotlight'; static icon = 'battle'; static dance = true;
  static colors = ['#ffb347', '#d6306f']; static theme = 'stage'; static stars = [1200, 2200, 3200];
  static howto = ['Take turns to freestyle in the spotlight', 'Move big, move on the beat, and mix up your moves', 'Hit the challenge move for a bonus', 'Everyone dances the finale, then FREEZE!'];

  constructor(app, opts) {
    super(app, opts);
    this.spot = new THREE.Mesh(new THREE.ConeGeometry(2.6, 20, 32, 1, true).translate(0, -10, 0), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide }));
    app.root.add(this.spot); this.spotX = 0; this.rival = 0; this.turnIdx = -1; this.turnScore = 0; this.lastPlayerTurn = 420;
    // this battle's style moves: five real ones from the chosen music style, and the basics
    const real = this.moves.filter(m => m.sig != null).sort(() => Math.random() - 0.5).slice(0, 5).map(styleFor);
    this.styles = [...real, ...BASICS]; this.label = `${this.genre.name} battle`;
  }
  pickMoves() { return this.genre.lessons.flat(); } // the coach dances everything from this style
  start() {
    super.start(); const slots = this.app.players.map(p => p.slot);
    this.solo = slots.length <= 1; const cont = this.solo ? [slots[0] ?? 0, 'cpu'] : slots; const rounds = slots.length >= 4 ? 2 : slots.length === 3 ? 3 : 4;
    this.turns = []; for (let r = 0; r < rounds; r++) for (const c of cont) this.turns.push({ who: c, prompt: this.styles[(this.turns.length * 3 + r) % this.styles.length] });
    this.total = this.turns.length * TURN + FINALE; this.phase = 'turns'; this.freezeT = 0;
  }
  active(players) { // who is dancing for points right now
    if (this.phase === 'finale') return players; const tn = this.turns?.[this.turnIdx]; if (!tn || tn.who === 'cpu') return []; return players.filter(p => p.slot === tn.who);
  }
  beginTurn(i, players) {
    const { hud, audio } = this.app; this.turnIdx = i; const tn = this.turns[i]; this.turnScore = 0; this.tags = new Set(); this.promptDone = false; this.eAcc = 0; this.nearMax = 0; this.midE = 0;
    if (tn.who === 'cpu') { hud.banner('DJ Dot\'s turn', '#ff8fd0', 1.4, 'Watch and get ready'); this.cpuTarget = Math.max(260, this.lastPlayerTurn * (0.78 + Math.random() * 0.3)); }
    else { hud.banner(`${PLAYER_NAMES[tn.who]}'s turn!`, PLAYER_CSS[tn.who], 1.6, 'Challenge: ' + tn.prompt.name); }
    hud.setStatus(tn.who === 'cpu' ? 'DJ Dot is dancing' : 'Challenge: ' + tn.prompt.name); audio.ding(tn.who === 'cpu' ? 76 : 84); this.styleCard(tn.who);
  }
  endTurn() {
    const tn = this.turns[this.turnIdx]; if (!tn) return; const { fx, audio } = this.app;
    if (tn.who === 'cpu') { fx.popup({ x: 0, y: 3.2 }, `DJ Dot: ${Math.round(this.rival).toLocaleString()}`, '#ff8fd0', 'big'); }
    else { this.lastPlayerTurn = this.turnScore; const p = this.app.players.find(q => q.slot === tn.who); if (p) { fx.popup({ x: p.j.head.x, y: p.j.head.y + 2 }, `${Math.round(this.turnScore)} points!`, p.css, 'big'); fx.confetti(p.j.chest, 40); } }
    audio.cheer(1.3);
  }
  // the challenge move, drawn, and the list of style moves to collect during a turn
  styleCard(who) {
    const hud = this.app.hud; if (who === 'cpu' || who === undefined) { hud.side(''); return; }
    const pr = this.turns[this.turnIdx]?.prompt, done = (n) => this.tags.has(who + n);
    hud.side((pr?.key ? `<h4>Challenge</h4><div class="pic ${this.promptDone ? '' : 'on'}">${picto(pr.key)}</div>` : '') + '<h4>Style moves</h4>' + this.styles.map(st => `<div class="tagrow ${done(st.name) ? 'on' : ''}">${st.name}</div>`).join(''), PLAYER_CSS[who]);
  }
  give(p, pts, text, cls = 'small', color) { this.turnScore += pts; this.app.addScore(p.slot, pts, { x: p.j.head.x + (Math.random() - 0.5) * 1.5, y: p.j.head.y + 1.2 + Math.random() * 0.6 }, { text, cls, color }); }

  update(dt, t, players) {
    const { hud, fx, audio } = this.app; this.clock += dt;
    const beat = this.beatNow() - this.b0; const floor = this.app.floorY;
    const tn0 = beat >= 0 && this.phase === 'turns' ? this.turns[Math.floor(beat / TURN)] : null;
    // on a player's turn the coach shows their challenge move; otherwise she dances through the style
    const cyc = this.moves[Math.floor(Math.max(0, beat) / 4) % this.moves.length];
    const shown = tn0 && tn0.who !== 'cpu' && tn0.prompt.key ? this.moves.find(m => m.name === tn0.prompt.name) : cyc;
    this.coach.update(beat < 0 ? this.idlePose : poseAt(shown, beat), dt, t);
    this.botPose = poseAt(this.moves[(Math.floor(Math.max(0, beat) / 4) + 1) % this.moves.length], beat);
    if (beat < 0) return;

    if (this.phase === 'freeze') {
      this.freezeT += dt;
      // give everyone a moment to react, and remember that a camera never holds a still body
      // perfectly still: only a real, lasting wiggle counts
      if (this.freezeT > 1.2) for (const p of players) {
        if (p.rig.energy > 0.6) p._wig = (p._wig || 0) + dt;
        if (p._wig > 0.3 || p.rig.energy > 1.4) this.moved.add(p.slot);
      }
      if (this.freezeT > 3.1) {
        for (const p of players) { if (!this.moved.has(p.slot)) { this.give(p, 200, 'Ice cold! +200', 'big', '#9fe8ff'); fx.ring(p.j.chest, 0x9fe8ff, 3, 0.5); } else fx.popup({ x: p.j.head.x, y: p.j.head.y + 1.3 }, 'Wiggled!', '#ff9ab5'); }
        audio.setMuffle(false); this.done = true;
      }
      return;
    }
    if (beat >= this.total) {
      this.phase = 'freeze'; this.moved = new Set(); for (const p of players) p._wig = 0; this.spot.material.opacity = 0; hud.banner('FREEZE!', '#9fe8ff', 2.6, 'Hold your pose'); fx.speedLines(); hud.side(''); hud.setStatus('Freeze!'); audio.scratch(); audio.freeze(); audio.setMuffle(true); return;
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
      const r = p.rig, s = p.slot; p._e = (p._e || 0) + Math.min(Math.max(0, r.energy - 0.25) * 1.12, 2.4) * 48 * mult * dt;
      if (f < 0.2 || f > 0.82) p._near = Math.max(p._near || 0, r.energy); else if (f > 0.4 && f < 0.6) p._mid = r.energy;
      if (r.energy > 0.5 && Math.random() < dt * 10) fx.burst(r.hands[Math.random() < 0.5 ? 0 : 1], { count: 1, color: p.color, speed: 2, size: 0.2, gravity: -1 });
      if (this.phase !== 'finale' && !this.promptDone && tn.prompt.test(r)) { this.promptDone = true; this.tags.add(s + tn.prompt.name); this.give(p, 150, '+150', 'big', '#ffd23f'); fx.word({ x: p.j.head.x, y: p.j.head.y + 2 }, 'NAILED IT!', '#ffd23f', p.css); audio.gold(); fx.confetti(p.j.chest, 30); this.app.avatars[s]?.cheer(1); this.styleCard(s); }
      for (const st of this.styles) { const key = s + st.name; if (!this.tags.has(key) && st.test(r)) { this.tags.add(key); this.give(p, 50 * mult, `${st.name}! +${50 * mult}`, '', '#7fe3ff'); audio.ding(86); fx.pow(r.hands[0], 0x7fe3ff, 0.7); if (this.phase !== 'finale') this.styleCard(s); } }
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
    if (tn && local > 2 && local < 4) Object.assign(it, tn.prompt.intent, { followPointer: false });
    if (local > 5 && local < 6) it.jump = true;
    if (local > 6) { it.arms = [[20, -110], [150, 0]]; it.crouch = 0.8; }
    return it;
  }
  dispose() { super.dispose(); this.spot.removeFromParent(); this.app.audio.setMuffle(false); }
}

// for the move sheet used when checking the drawings
export const DEBUG = { MOVES, picto };
