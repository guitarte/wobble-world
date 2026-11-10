// A parametric cartoon skeleton. It drives the dance coach, and it also drives
// the pretend players used when there is no camera (preview and testing).
import { STAGE_H } from './tracking.js';

const D = Math.PI / 180;
export const REST_ARM = [14, 12];

function ik(sx, sy, tx, ty, l1, l2, preferOut) {
  let dx = tx - sx, dy = ty - sy;
  let d = Math.hypot(dx, dy) || 1e-4;
  const dc = Math.min(Math.max(d, Math.abs(l1 - l2) + 0.01), l1 + l2 - 0.005);
  const base = Math.atan2(dy, dx);
  const A = Math.acos(Math.min(1, Math.max(-1, (l1 * l1 + dc * dc - l2 * l2) / (2 * l1 * dc))));
  const e1 = [sx + l1 * Math.cos(base + A), sy + l1 * Math.sin(base + A)];
  const e2 = [sx + l1 * Math.cos(base - A), sy + l1 * Math.sin(base - A)];
  const score = (e) => -e[1] + preferOut * e[0] * 0.5;
  const e = score(e1) > score(e2) ? e1 : e2;
  const hx = sx + dx / d * dc, hy = sy + dy / d * dc;
  const fx = hx - e[0], fy = hy - e[1], fl = Math.hypot(fx, fy) || 1;
  return [e[0], e[1], e[0] + fx / fl * l2, e[1] + fy / fl * l2];
}

// o: { x, floor, h, crouch, lean (rad), jump (units), arms:[L,R], legs:[L,R], tilt }
//   arm = [shoulderDeg, elbowDeg]  (0 = hanging down, 90 = straight out, 180 = straight up)
//      or { x, y } hand target in stage units
//   leg = { dx, lift } in units of body height
// "L" is the left side of the screen. Returns 33 [x, y] points in stage units.
export function buildSkeleton(o, out) {
  const P = out || Array.from({ length: 33 }, () => [0, 0]);
  const h = o.h, c = o.crouch || 0, lean = o.lean || 0;
  const y0 = o.floor + (o.jump || 0);
  const hipY = y0 + h * (0.04 + 0.49 * (1 - 0.6 * c));
  const hipX = o.x + (o.sway || 0) * h;
  const torso = h * 0.29 * (1 - 0.08 * c);
  const scx = hipX + Math.sin(lean) * torso, scy = hipY + Math.cos(lean) * torso;
  const cl = Math.cos(lean), sl = Math.sin(lean);
  const put = (i, x, y) => { P[i][0] = x; P[i][1] = y; };
  const shHalf = h * 0.115, hipHalf = h * 0.062;
  const ua = h * 0.16, fa = h * 0.145, ul = h * 0.245, ll = h * 0.245;
  for (let s = 0; s < 2; s++) {
    const sg = s === 0 ? -1 : 1;
    const shx = scx + sg * shHalf * cl, shy = scy - sg * shHalf * sl;
    put(11 + s, shx, shy);
    const arm = (o.arms && o.arms[s]) || REST_ARM;
    let ex, ey, wx, wy;
    if (Array.isArray(arm)) {
      const a = arm[0] * D - sg * lean * 0.5, b = a + arm[1] * D;
      ex = shx + sg * Math.sin(a) * ua; ey = shy - Math.cos(a) * ua;
      wx = ex + sg * Math.sin(b) * fa; wy = ey - Math.cos(b) * fa;
    } else {
      [ex, ey, wx, wy] = ik(shx, shy, arm.x, arm.y, ua, fa * 1.0, sg);
    }
    put(13 + s, ex, ey); put(15 + s, wx, wy);
    const hx = wx + (wx - ex) * 0.25, hy = wy + (wy - ey) * 0.25;
    put(17 + s, hx, hy); put(19 + s, hx, hy); put(21 + s, hx, hy);
    const hpx = hipX + sg * hipHalf, hpy = hipY;
    put(23 + s, hpx, hpy);
    const leg = (o.legs && o.legs[s]) || { dx: 0, lift: 0 };
    const ax = o.x + sg * h * (0.075 + 0.05 * c) + (leg.dx || 0) * h, ay = y0 + h * 0.04 + (leg.lift || 0) * h;
    const k = ik(hpx, hpy, ax, ay, ul, ll, 0);
    // knees bend outward
    let kx = k[0], ky = k[1];
    if ((kx - (hpx + ax) / 2) * sg < 0) kx = (hpx + ax) - kx;
    put(25 + s, kx, ky); put(27 + s, ax, ay);
    put(29 + s, ax - sg * h * 0.01, ay - h * 0.03); put(31 + s, ax + sg * h * 0.06, ay - h * 0.035);
  }
  const tilt = lean * 1.2 + (o.tilt || 0);
  const nx = scx + Math.sin(tilt) * h * 0.105, ny = scy + Math.cos(tilt) * h * 0.105;
  put(0, nx, ny);
  for (let s = 0; s < 2; s++) {
    const sg = s === 0 ? -1 : 1;
    put(1 + s * 3, nx + sg * h * 0.012, ny + h * 0.015); put(2 + s * 3, nx + sg * h * 0.02, ny + h * 0.015); put(3 + s * 3, nx + sg * h * 0.028, ny + h * 0.015);
    put(7 + s, nx + sg * h * 0.045, ny + h * 0.008); put(9 + s, nx + sg * h * 0.015, ny - h * 0.02);
  }
  return P;
}

const lerp = (a, b, k) => a + (b - a) * k;

class Bot {
  constructor(i, n) {
    this.i = i;
    this.h = [4.2, 3.6, 4.4, 3.2][i];
    this.home = n === 1 ? 0 : (i - (n - 1) / 2) * (11 / Math.max(1, n - 1)) * (n === 2 ? 0.5 : 1);
    this.x = this.home; this.floor = -3.7; this.crouch = 0; this.lean = 0; this.jump = 0; this.vy = 0;
    this.arms = [[...REST_ARM], [...REST_ARM]];
    this.hand = [null, null]; // current IK hand positions when reaching
    this.legs = [{ dx: 0, lift: 0 }, { dx: 0, lift: 0 }];
    this.P = null; this.phase = i * 1.7;
  }
  step(dt, t, intent) {
    const it = intent || {};
    const tx = it.x ?? this.home;
    const maxV = 4.2 * dt;
    this.x += Math.max(-maxV, Math.min(maxV, tx - this.x));
    this.crouch = lerp(this.crouch, it.crouch ?? 0, Math.min(1, dt * 9));
    this.lean = lerp(this.lean, it.lean ?? 0, Math.min(1, dt * 9));
    if (it.jump && this.jump <= 0.001) this.vy = 7.5;
    this.vy -= 26 * dt; this.jump = Math.max(0, this.jump + this.vy * dt); if (this.jump === 0) this.vy = 0;
    const breathe = Math.sin(t * 2 + this.phase) * 2;
    for (let s = 0; s < 2; s++) {
      const hTarget = it.hands && it.hands[s];
      if (hTarget) {
        const cur = this.hand[s] || { x: this.x + (s ? 0.6 : -0.6), y: this.floor + this.h * 0.5 };
        const dx = hTarget.x - cur.x, dy = hTarget.y - cur.y, d = Math.hypot(dx, dy);
        const sp = (it.handSpeed ?? 11) * dt;
        if (d > sp) { cur.x += dx / d * sp; cur.y += dy / d * sp; } else { cur.x = hTarget.x; cur.y = hTarget.y; }
        this.hand[s] = cur;
      } else {
        this.hand[s] = null;
        const a = (it.arms && it.arms[s]) || [REST_ARM[0] + breathe, REST_ARM[1]];
        const k = Math.min(1, dt * (it.snap ?? 14));
        this.arms[s][0] = lerp(this.arms[s][0], a[0], k); this.arms[s][1] = lerp(this.arms[s][1], a[1], k);
      }
      const lg = (it.legs && it.legs[s]) || { dx: 0, lift: 0 };
      this.legs[s].dx = lerp(this.legs[s].dx, lg.dx || 0, Math.min(1, dt * 12));
      this.legs[s].lift = lerp(this.legs[s].lift, lg.lift || 0, Math.min(1, dt * 12));
    }
    this.P = buildSkeleton({
      x: this.x, floor: this.floor, h: this.h, crouch: this.crouch, lean: this.lean, jump: this.jump,
      sway: it.sway || 0, tilt: it.tilt || 0,
      arms: [this.hand[0] || this.arms[0], this.hand[1] || this.arms[1]], legs: this.legs,
    }, this.P);
  }
  // remember where the IK arm ended so switching back to angles is smooth
}

// Feeds pretend players into the tracker, as if they came from the camera.
export class SimSource {
  constructor(tracker, count) {
    this.tracker = tracker; this.bots = [];
    for (let i = 0; i < count; i++) this.bots.push(new Bot(i, count));
    this.pointer = { x: 0, y: 0, t: -1e9, down: false };
    this.acc = 0; this.intentFn = null;
    tracker.mode = 'sim'; tracker.stageW = 16; tracker.stageH = STAGE_H;
  }
  setPointer(x, y, now) { this.pointer.x = x; this.pointer.y = y; this.pointer.t = now; }
  get pointerActive() { return performance.now() - this.pointer.t < 2500; }
  update(now, dt, t) {
    const players = this.tracker.players;
    this.bots.forEach((b, i) => {
      let intent = this.intentFn ? (this.intentFn(i, players[i], b, t) || {}) : {};
      if (i === 0 && this.pointerActive && intent.followPointer !== false) {
        const pt = this.pointer; intent = { ...intent };
        const side = pt.x >= b.x ? 1 : 0;
        const hands = intent.hands ? [...intent.hands] : [null, null];
        hands[side] = { x: pt.x, y: pt.y }; if (!intent.hands) hands[1 - side] = null;
        intent.hands = hands; intent.handSpeed = 40;
        const reach = b.h * 0.33;
        intent.x = Math.abs(pt.x - b.x) > reach ? pt.x - Math.sign(pt.x - b.x) * reach * 0.9 : b.x;
      }
      b.step(dt, t, intent);
    });
    this.acc += dt;
    if (this.acc < 1 / 30) return;
    this.acc = 0;
    const sets = this.bots.map(b => b.P.map(([x, y]) => ({ x: 0.5 - x / 16, y: 0.5 - y / STAGE_H, visibility: 1 })));
    this.tracker.ingest(sets, now);
  }
}
