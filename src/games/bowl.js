// Wobble Bowl: everyone bowls at once, each on a toy lane that ramps up behind
// them. Let a hand hang down to pick up the ball, then swing it up to send
// the ball rolling. Bumpers keep it on the lane, and you get two balls a rack.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, clamp, lerp, GEO, INKS, INK_THIN, whiteM, inkM, flat, inked } from './kit.js';

const SMALL = 0.6;                              // the bowlers stand small so the lanes can be seen
const TILT = 0.58, LEN = 8.6, HW = 1.45, Y0 = -1.55, Z0 = -0.7;
const RB = 0.34, RP = 0.25, HEAD = LEN - 2.55, GAP = 0.72, HIT = RB + RP * 0.72, TOUCH = RP * 1.36;   // ball and pin sizes, and where the front pin stands
const ST = Math.sin(TILT), CT = Math.cos(TILT), V = new THREE.Vector3(), V2 = new THREE.Vector3(), AX = new THREE.Vector3();
const PIN = new THREE.LatheGeometry([[0.001, 0], [0.17, 0], [0.25, 0.22], [0.26, 0.42], [0.2, 0.66], [0.135, 0.84], [0.13, 0.94], [0.175, 1.06], [0.17, 1.16], [0.1, 1.24], [0.001, 1.25]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
const CHEV = (() => { const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(new Float32Array([-0.3, 0, 0.12, 0.3, 0, 0.12, 0, 0, -0.26]), 3)); return g; })();
const WHITE = toonMat(0xfffaf0, { rim: 0xffffff }), GOLD = toonMat(0xffd23f, { rim: 0xfff6c8, rimAmt: 0.8 }), RED = toonMat(0xff4d6d), LEG = toonMat(0x6a5acd), SLAB = toonMat(0xd9a05b);
let WOOD = null;
function wood() {
  if (WOOD) return WOOD; const c = document.createElement('canvas'); c.width = 256; c.height = 1024; const g = c.getContext('2d');
  g.fillStyle = '#ffe2a8'; g.fillRect(0, 0, 256, 1024);
  for (let i = 0; i < 8; i++) { g.fillStyle = i % 2 ? 'rgba(255,255,255,0.16)' : 'rgba(214,150,70,0.14)'; g.fillRect(i * 32, 0, 32, 1024); g.fillStyle = 'rgba(120,70,30,0.25)'; g.fillRect(i * 32, 0, 2, 1024); }
  g.fillStyle = '#ffc97a'; g.fillRect(0, 0, 256, 300);                       // the pin deck, at the far end
  g.fillStyle = '#140c2a'; g.fillRect(0, 296, 256, 6); g.fillRect(0, 940, 256, 8);
  g.fillStyle = '#ff5a78'; for (let i = 0; i < 5; i++) { const x = 44 + i * 42, y = 700 - Math.abs(i - 2) * -40; g.beginPath(); g.moveTo(x, y - 34); g.lineTo(x + 13, y + 14); g.lineTo(x - 13, y + 14); g.fill(); }
  g.fillStyle = '#140c2a'; for (let i = 0; i < 7; i++) { g.beginPath(); g.arc(32 + i * 32, 880, 5, 0, 7); g.fill(); }
  WOOD = new THREE.CanvasTexture(c); WOOD.colorSpace = THREE.SRGBColorSpace; WOOD.anisotropy = 4; return WOOD;
}
// a point on a lane (x across, s along, up off the surface) in stage space
const world = (L, x, s, up, out = V) => out.set(L.x + x, Y0 + up * CT + s * ST, Z0 + up * ST - s * CT);

function makePin() {
  const g = new THREE.Group(), body = inked(PIN, WHITE, INK_THIN); g.add(body);
  const band = new THREE.Mesh(GEO.cyl, RED); band.scale.set(0.147, 0.085, 0.147); band.position.y = 0.89; g.add(band);
  for (const sg of [-1, 1]) { const e = new THREE.Mesh(GEO.disc, inkM); e.scale.set(0.034, 0.044, 1); e.position.set(sg * 0.09, 0.5, 0.262); g.add(e); }
  const m = new THREE.Mesh(GEO.smile, inkM); m.scale.setScalar(0.55); m.position.set(0, 0.41, 0.268); m.rotation.z = Math.PI; g.add(m);
  return { g, body };
}

export class WobbleBowl {
  static id = 'bowl'; static title = 'Wobble Bowl'; static blurb = 'Swing your arm and knock the pins flying'; static icon = 'bowl';
  static colors = ['#ff9248', '#c2386b']; static theme = 'toybox'; static music = 'bowl'; static stars = [450, 900, 1400];
  static howto = ['Let one hand hang down to pick up your ball', 'Swing it up fast to bowl', 'Swing a little sideways to steer', 'Knock all six down for a strike!'];

  constructor(app) { this.app = app; this.time = 75; this.done = false; this.finale = false; this.lanes = {}; this.hintT = 7; }
  start() { this.app.hud.setTimer(this.time); this.app.hud.hint('Hand down to pick up the ball, then swing it up!'); }
  idle(dt, t) { this.layout(dt, this.app.players); for (const p of this.app.players) this.show(this.lane(p), p, dt, t, false); }

  lane(p) {
    let L = this.lanes[p.slot]; if (L) return L;
    const g = new THREE.Group(); g.rotation.x = TILT; this.app.root.add(g);
    const top = new THREE.Mesh(new THREE.PlaneGeometry(HW * 2, LEN), new THREE.MeshBasicMaterial({ map: wood() })); top.rotation.x = -Math.PI / 2; top.position.set(0, 0, -LEN / 2); g.add(top);
    const slab = inked(GEO.box, SLAB, INKS); slab.scale.set(HW * 2 + 0.4, 0.26, LEN + 0.3); slab.position.set(0, -0.14, -LEN / 2); g.add(slab);
    const mat = toonMat(p.color, { rim: 0xffffff, rimAmt: 0.5 });
    for (const sg of [-1, 1]) { const b = inked(GEO.box, mat, INK_THIN); b.scale.set(0.2, 0.3, LEN + 0.1); b.position.set(sg * (HW + 0.1), 0.13, -LEN / 2); g.add(b); }
    const back = inked(GEO.box, mat, INKS); back.scale.set(HW * 2 + 0.4, 1.0, 0.2); back.position.set(0, 0.48, -LEN - 0.1); g.add(back);
    const star = new THREE.Mesh(GEO.star, whiteM); star.scale.set(0.3, 0.3, 0.05); star.position.set(0, 0.5, -LEN + 0.02); g.add(star);
    // stilts, so the ramp stands on the floor like a toy
    for (const [sx, s] of [[-1, LEN - 0.5], [1, LEN - 0.5], [-1, LEN * 0.45], [1, LEN * 0.45]]) {
      const leg = new THREE.Group(); leg.position.set(sx * (HW - 0.1), -0.25, -s); leg.rotation.x = -TILT; g.add(leg);
      const len = Y0 + s * ST - this.app.env.floorY, post = inked(GEO.cyl, LEG, INK_THIN); post.scale.set(0.09, len, 0.09); post.position.y = -len / 2; leg.add(post);
    }
    const guide = [0, 1, 2].map(i => { const m = new THREE.Mesh(CHEV, flat(p.color, { transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false })); m.position.set(0, 0.03, -0.55 - i * 0.6); g.add(m); return m; });
    const shadow = new THREE.Mesh(GEO.disc, flat(0x140c2a, { transparent: true, opacity: 0.28, depthWrite: false })); shadow.rotation.x = -Math.PI / 2; shadow.scale.setScalar(RB * 0.95); shadow.visible = false; g.add(shadow);
    // the ball: the player's colour, with a white band so you can see it roll
    const ball = new THREE.Group(), skin = inked(GEO.sph, mat, INKS); skin.scale.setScalar(RB); ball.add(skin);
    const band = new THREE.Mesh(GEO.torus, whiteM); band.scale.setScalar(RB * 0.93); band.rotation.y = Math.PI / 2; ball.add(band);
    this.app.root.add(ball);
    L = this.lanes[p.slot] = { slot: p.slot, g, guide, shadow, ball, x: p.j.hipC.x, pins: [], old: [], state: 'ready', T: 0, n: 1, b: null, hits: 0, streak: 0, strikes: 0, spares: 0, aim: 0,
      arm: [{ t: 0, on: false, peak: 0, rx: 0, ry: 0 }, { t: 0, on: false, peak: 0, rx: 0, ry: 0 }], held: -1, bp: new THREE.Vector3(p.j.hipC.x, Y0, 0), botAim: 0 };
    this.rack(L); return L;
  }
  // six fresh pins drop in, front one first
  rack(L) {
    let k = 0;
    for (let r = 0; r < 3; r++) for (let i = 0; i <= r; i++) {
      const pin = makePin(); if (this.finale) pin.body.material = GOLD; L.g.add(pin.g);
      L.pins.push({ ...pin, x: (i - r / 2) * GAP, s: HEAD + r * GAP * 0.84, vx: 0, vs: 0, down: false, counted: false, tip: 0, dx: 0, dz: -1, in: 1 + k++ * 0.12, sq: 0, out: -1 });
    }
  }
  // share the stage out between whoever is playing, left to right in the order they stand
  layout(dt, players) {
    for (const s in this.lanes) if (!players.some(p => p.slot === +s)) { const L = this.lanes[s]; L.g.removeFromParent(); L.ball.removeFromParent(); delete this.lanes[s]; }
    const sorted = [...players].sort((a, b) => a.j.hipC.x - b.j.hipC.x), n = sorted.length, W = Math.min(4.4, 15.2 / Math.max(1, n));
    sorted.forEach((p, i) => { const L = this.lane(p); L.x += ((i - (n - 1) / 2) * W - L.x) * Math.min(1, dt * 4); L.g.position.set(L.x, Y0, Z0); const a = this.app.avatars[p.slot]; if (a) a.size = SMALL; });
  }

  knock(L, q) {
    if (q.down) return; const { fx, audio } = this.app, sp = Math.hypot(q.vx, q.vs) || 1;
    q.down = true; q.dx = q.vx / sp; q.dz = -q.vs / sp; L.hits++;
    audio.block(L.hits * 2); if (L.hits === 1) { audio.smash(); fx.hitstop(0.05); fx.shake(0.2); }
    fx.burst(world(L, q.x, q.s, 0.7), { count: 8, colors: [0xffffff, 0xffd23f, 0xff5a78], speed: 5, size: 0.2 });
  }

  // the ball and the pins slide about on the flat of the lane
  physics(L, dt) {
    const { fx, audio } = this.app, b = L.b, N = 3, h = dt / N;
    for (let k = 0; k < N; k++) {
      if (b && b.s < 0) b.s += b.vs * h;                       // still in the air on its way to the lane
      else if (b) {
        b.x += b.vx * h; b.s += b.vs * h; b.vs = Math.max(b.vs, 3.5);
        if (Math.abs(b.x) > HW - RB) { b.x = Math.sign(b.x) * (HW - RB); b.vx *= -0.75; audio.tick(); fx.burst(world(L, b.x + Math.sign(b.x) * RB, b.s, 0.3), { count: 5, color: 0xffffff, speed: 3, size: 0.16 }); }
        for (const q of L.pins) {
          const dx = q.x - b.x, ds = q.s - b.s, d = Math.hypot(dx, ds); if (d >= HIT || d < 1e-4 || q.in > 0.4) continue;
          const nx = dx / d, ns = ds / d, vn = (b.vx - q.vx) * nx + (b.vs - q.vs) * ns; if (vn <= 0) continue;
          q.vx += nx * vn * 1.08 + rnd(-0.7, 0.7); q.vs += ns * vn * 1.08; b.vx -= nx * vn * 0.2; b.vs -= ns * vn * 0.2; this.knock(L, q);
        }
      }
      for (const q of L.pins) {
        const sp = Math.hypot(q.vx, q.vs); if (sp < 0.02) continue;
        const f = Math.exp(-2.6 * h); q.x += q.vx * h; q.s += q.vs * h; q.vx *= f; q.vs *= f;
        if (Math.abs(q.x) > HW - RP) { q.x = Math.sign(q.x) * (HW - RP); q.vx *= -0.5; }
        if (q.s > LEN - 0.4) { q.s = LEN - 0.4; q.vs *= -0.4; }
        if (sp < 1) continue;
        // a flying pin takes its neighbours with it
        for (const r of L.pins) {
          if (r === q) continue; const dx = r.x - q.x, ds = r.s - q.s, d = Math.hypot(dx, ds); if (d >= TOUCH || d < 1e-4) continue;
          const nx = dx / d, ns = ds / d, vn = (q.vx - r.vx) * nx + (q.vs - r.vs) * ns; if (vn <= 0) continue;
          r.vx += nx * vn * 0.56; r.vs += ns * vn * 0.56; q.vx -= nx * vn * 0.6; q.vs -= ns * vn * 0.6; this.knock(L, r);
        }
      }
    }
    if (b && b.s > LEN - 0.55) { fx.burst(world(L, b.x, LEN - 0.3, 0.4), { count: 10, colors: [0xffffff, 0xffd23f], speed: 4, size: 0.2 }); audio.tick(); L.b = null; L.state = 'settle'; L.T = 0.85; }
  }

  // count up what the ball did
  score(L, p) {
    const { app } = this, { fx, audio } = app, X2 = this.finale ? 2 : 1;
    const fresh = L.pins.filter(q => q.down && !q.counted), left = L.pins.filter(q => !q.down).length, pos = world(L, 0, LEN - 1.3, 1.9).clone();
    for (const q of fresh) q.counted = true;
    const sub = () => L.strikes ? `${L.strikes}★` : '';
    if (fresh.length) app.addScore(p.slot, fresh.length * 10 * X2, pos, { sub: sub(), cheer: 0.5 }); else { fx.popup(pos, 'Missed!', '#ff9ab0'); audio.bad(); }
    if (!left) {
      const strike = L.n === 1; L.streak = strike ? L.streak + 1 : 0; if (strike) L.strikes++; else L.spares++;
      const up = { x: pos.x, y: pos.y + 0.75, z: pos.z };
      app.addScore(p.slot, (strike ? 60 + 30 * Math.min(3, L.streak - 1) : 30) * X2, up, { cls: 'big', color: '#ffd23f', sub: sub(), cheer: 1 });
      fx.word(up, strike ? (L.streak >= 3 ? 'TURKEY!' : L.streak === 2 ? 'DOUBLE!' : 'STRIKE!') : 'SPARE!', '#ffd23f', p.css); fx.confetti(pos, strike ? 60 : 28); fx.ring(pos, 0xffd23f, 2.6, 0.45);
      if (strike) { audio.fanfare(); audio.cheer(1); fx.speedLines(); fx.shake(0.35); } else audio.perfect();
    } else if (L.n === 1) { L.n = 2; L.streak = 0; for (const q of L.pins) if (q.down) q.out = 0.25; L.state = 'ready'; return; }
    else L.streak = 0;
    // clear the deck and set up the next rack
    for (const q of L.pins) q.out = 0.3; L.old.push(...L.pins); L.pins = []; L.state = 'rack'; L.T = 0.4;
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app;
    this.time -= dt; hud.setTimer(this.time);
    if (this.hintT > 0 && (this.hintT -= dt) <= 0) hud.hint('');
    if (!this.finale && this.time <= 17) {
      this.finale = true; hud.banner('Golden pins!', '#ffd23f', 1.5, 'Double points'); hud.setStatus('Golden pins x2'); fx.speedLines(); audio.hype(true); audio.cheer(1);
      for (const s in this.lanes) for (const q of this.lanes[s].pins) q.body.material = GOLD;
    }
    this.layout(dt, players);
    let busy = false;
    for (const p of players) {
      const L = this.lane(p), j = p.j, S = p.rig.S, hipY = j.hipC.y;
      if (L.state === 'ready') {
        let go = -1;
        for (let h = 0; h < 2; h++) {
          const hd = p.rig.hands[h], v = p.rig.handVel[h], a = L.arm[h];
          if (!a.on) {
            // a hand resting below the hip picks the ball up
            a.t = hd.y < hipY && v.length() < 2.4 * S ? a.t + dt : 0;
            if (a.t > 0.2 && this.time > 0) { a.on = true; a.peak = 0; a.rx = hd.x - j.hipC.x; a.ry = hd.y; if (!L.arm[1 - h].on) { audio.hover(); L.botAim = rnd(-0.7, 0.7); } }
          } else {
            // remember where the hand was hanging, so the swing can be measured from there
            if (v.length() < 1.5 * S && hd.y < hipY) { a.rx = hd.x - j.hipC.x; a.ry = hd.y; }
            a.peak = Math.max(a.peak - 5 * S * dt, v.y);
            if (hd.y > hipY + 0.3 * S) { if (a.peak > 2 * S && go < 0 && this.time > 0) go = h; else { a.on = false; a.t = 0; } }
          }
        }
        L.held = L.arm[0].on && L.arm[1].on ? (p.rig.hands[0].y < p.rig.hands[1].y ? 0 : 1) : L.arm[0].on ? 0 : L.arm[1].on ? 1 : -1;
        if (L.held >= 0) L.aim = clamp(L.arm[L.held].rx / S * 0.5, -(HW - RB - 0.12), HW - RB - 0.12);
        if (go >= 0) {
          const hd = p.rig.hands[go], a = L.arm[go], sp = 8 + 7 * clamp((a.peak / S - 2) / 5, 0, 1);
          const x = clamp(a.rx / S * 0.5, -(HW - RB - 0.12), HW - RB - 0.12), ang = clamp((hd.x - j.hipC.x - a.rx) / Math.max(0.3 * S, hd.y - a.ry) * 0.6, -0.32, 0.32);
          L.b = { x, s: -1.1, vx: Math.sin(ang) * sp, vs: Math.cos(ang) * sp, from: L.bp.clone(), roll: 0 }; L.state = 'roll'; L.hits = 0; L.held = -1;
          for (const q of L.arm) { q.on = false; q.t = 0; } audio.whoosh(); app.avatars[p.slot]?.cheer(0.3);
        }
      } else {
        busy = true;
        for (const q of L.arm) { q.on = false; q.t = 0; }
        if (L.state === 'roll') this.physics(L, dt);
        else if (L.state === 'settle') { this.physics(L, dt); if ((L.T -= dt) <= 0) this.score(L, p); }
        else if ((L.T -= dt) <= 0) { this.rack(L); L.n = 1; L.state = 'ready'; }
      }
      this.show(L, p, dt, t, true);
    }
    if (this.time <= 0 && (!busy || this.time < -4)) this.done = true;
  }

  // put everything where it should be drawn
  show(L, p, dt, t, playing) {
    const j = p.j, fl = p.rig.floorY, b = L.b, ball = L.ball;
    if (b) {
      if (b.s < 0) { const u = clamp(1 + b.s / 1.1, 0, 1); world(L, b.x, 0, RB, V2); L.bp.lerpVectors(b.from, V2, u); L.bp.y += Math.sin(u * Math.PI) * 0.45; }
      else world(L, b.x, b.s, RB, L.bp);
      ball.rotation.x -= b.vs * dt / RB * 0.6; ball.scale.setScalar(1);
      L.shadow.visible = b.s >= 0; L.shadow.position.set(b.x, 0.02, -b.s);
    } else {
      L.shadow.visible = false;
      // waiting on the ball return, or riding in the hand that picked it up
      const k = 1 - Math.exp(-dt * 22), hd = L.held >= 0 ? p.rig.hands[L.held] : null;
      if (hd) V2.set(j.hipC.x + SMALL * (hd.x - j.hipC.x), fl + SMALL * (hd.y - fl) - 0.12, 0.45); else world(L, -HW + 0.55, 0.3, RB + 0.06 * Math.sin(t * 4), V2);
      L.bp.lerp(V2, k); ball.rotation.x = lerp(ball.rotation.x, 0, k);
      ball.scale.setScalar(lerp(ball.scale.x, L.state === 'ready' && playing ? (hd ? 0.8 : 1) : 0.001, k));
    }
    ball.position.copy(L.bp);
    L.guide.forEach((m, i) => { const on = L.held >= 0 && playing; m.material.opacity = lerp(m.material.opacity, on ? 0.45 + 0.4 * Math.max(0, Math.sin(t * 9 - i * 1.2)) : 0, 1 - Math.exp(-dt * 12)); m.position.x = L.aim; m.visible = m.material.opacity > 0.02; });
    for (const q of L.pins) {
      if (q.in > 0 && (q.in -= dt * 2.4) <= 0) { q.in = 0; q.sq = 1; }
      q.sq = Math.max(0, q.sq - dt * 5); if (q.down) q.tip = Math.min(1, q.tip + dt / 0.2);
      const drop = Math.min(1, q.in), e = 1 - (1 - q.tip) * (1 - q.tip), sq = 1 - 0.22 * Math.sin(q.sq * Math.PI);
      q.g.position.set(q.x, drop * (2 - drop) * 2.2 + 0.2 * e, -q.s); q.g.visible = q.in < 1; q.g.scale.set(2 - sq, sq, 2 - sq);
      if (q.down) q.g.quaternion.setFromAxisAngle(AX.set(q.dz, 0, -q.dx).normalize(), e * 1.5); else q.g.rotation.set(0, 0, Math.sin(t * 3 + q.x * 5) * 0.03);
      if (q.out >= 0) { q.out -= dt; const k = clamp(q.out / 0.25, 0, 1); q.g.scale.setScalar(k); if (q.out <= 0) { q.g.removeFromParent(); q.dead = true; } }
    }
    if (L.pins.some(q => q.dead)) L.pins = L.pins.filter(q => !q.dead);
    for (const q of L.old) { q.out -= dt; q.g.scale.setScalar(clamp(q.out / 0.3, 0, 1)); if (q.out <= 0) q.g.removeFromParent(); }
    if (L.old.length && L.old[0].out <= 0) L.old = L.old.filter(q => q.out > 0);
  }

  results() {
    const all = Object.values(this.lanes), st = Math.max(0, ...all.map(L => L.strikes)), sp = Math.max(0, ...all.map(L => L.spares));
    return { note: st ? `Most strikes: ${st}` : sp ? `Most spares: ${sp}` : 'Swing a little harder next time!' };
  }
  lookTarget(p) { const L = this.lanes[p.slot]; return L ? { x: L.bp.x, y: L.bp.y } : null; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p || (i === 0 && this.app.sim?.pointerActive)) return {};   // a mouse or a finger can swing the hand itself
    const L = this.lanes[p.slot]; if (!L || L.state !== 'ready') return { x: bot.x, followPointer: false };
    const side = i % 2 ? 0 : 1, sg = side ? 1 : -1, hipY = p.j.hipC.y, a = L.arm[side], hands = [null, null];
    // hang the hand, wait a moment, then swing it up and a touch inward
    if (a.on && a.t > 0.5 + 0.12 * i) { hands[side] = { x: bot.x + sg * 0.8 - sg * 0.28 + L.botAim, y: hipY + 2.2 }; return { hands, handSpeed: 9 + i * 2, x: bot.x, followPointer: false }; }
    if (a.on) a.t += 1 / 30;
    hands[side] = { x: bot.x + sg * 0.8, y: hipY - 0.8 }; return { hands, handSpeed: 9, x: bot.x, followPointer: false };
  }
  dispose() { this.app.hud.hint(''); for (const s in this.lanes) { this.lanes[s].g.removeFromParent(); this.lanes[s].ball.removeFromParent(); } }
}
