// Body tracking: camera + MediaPipe pose -> up to 4 persistent players with
// smoothed joints in "stage" coordinates (x: -8..8, y: -4.5..4.5, mirrored).
import * as THREE from 'three';
import { Follow } from './follow.js';

export const STAGE_H = 9;
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = [0xff4d6d, 0x19c9c0, 0xffc21a, 0x9a5bff];
export const PLAYER_CSS = ['#ff4d6d', '#19c9c0', '#ffc21a', '#9a5bff'];
export const PLAYER_NAMES = ['Ember', 'Zeph', 'Volt', 'Nova'];

// MediaPipe landmark indices
export const L = {
  nose: 0, earL: 7, earR: 8, shL: 11, shR: 12, elL: 13, elR: 14, wrL: 15, wrR: 16,
  hipL: 23, hipR: 24, knL: 25, knR: 26, anL: 27, anR: 28, ftL: 31, ftR: 32,
};

class OneEuro {
  constructor(minCutoff = 1.6, beta = 0.9) { this.mc = minCutoff; this.beta = beta; this.x = null; this.dx = 0; }
  alpha(cutoff, dt) { const tau = 1 / (2 * Math.PI * cutoff); return 1 / (1 + tau / dt); }
  filter(x, dt) {
    if (this.x === null) { this.x = x; return x; }
    const dx = (x - this.x) / dt;
    this.dx += this.alpha(1, dt) * (dx - this.dx);
    const a = this.alpha(this.mc + this.beta * Math.abs(this.dx), dt);
    this.x += a * (x - this.x);
    return this.x;
  }
}

const v3 = () => new THREE.Vector3();
// Sideways pointer reach, in torso lengths: a hand near the body moves the pointer gently,
// and the further it stretches out the faster the pointer runs, so the outermost buttons
// need neither a locked-straight arm nor a step to the side.
const REACH_SIDE = 2.3, REACH_KNEE = 0.5, REACH_EXTRA = 3.2;

// ---- Fitting players to the stage
// People stand at all sorts of distances from the camera, and the camera sits at all
// sorts of heights. Rather than copying the picture, each player is scaled to hero size
// and stood on the stage floor, so a small child at the back of the room has the same
// reach as a grown-up at the front, and nobody's head ends up behind the menu.
export const FLOOR = -3.7;
const HERO_T = 1.28; // a hero's torso; the whole body comes out about 4.4 units tall
// T: torso length in stage units. rel: 0..1 against the tallest player. zoom: 9 / picture height.
// Returns the scale, and k: 0 = hero-sized on the stage floor, 1 = life-size exactly as filmed.
function fitFor(T, rel, zoom) {
  const tgt = HERO_T * (0.88 + 0.12 * rel); // keep a hint of who is taller
  const k = THREE.MathUtils.smoothstep(T * zoom, 2.3, 3.7);
  // Past 2.3 the whole body no longer fits in the picture. Ease back to life-size, so
  // someone sitting right in front of a laptop can still reach the whole screen.
  return { s: k > 0 ? (tgt + (T - tgt) * k) / T : Math.min(1.7, tgt / T), k };
}
export const area = (b) => Math.max(0, b.x1 - b.x0) * Math.max(0, b.y1 - b.y0);
// Is box a sitting on top of box b: nearly the same space, or swallowing most of it?
export function crowds(a, b) {
  if (!b) return false;
  const i = Math.max(0, Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0)) * Math.max(0, Math.min(a.y1, b.y1) - Math.max(a.y0, b.y0));
  return i > 0.6 * area(b) || i > 0.4 * (area(a) + area(b) - i);
}
const JOINTS = ['head', 'neck', 'chest', 'hipC', 'shL', 'shR', 'elL', 'elR', 'wrL', 'wrR', 'haL', 'haR',
  'hipL', 'hipR', 'knL', 'knR', 'anL', 'anR', 'ftL', 'ftR', 'earL', 'earR', 'nose'];

// A Rig turns 33 landmark points into the joints an avatar and the games use.
export class Rig {
  constructor() {
    this.pts = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
    this.j = {}; for (const n of JOINTS) this.j[n] = v3();
    this.S = 1.2;            // torso length = the body's unit of scale
    this.standH = 0;         // tallest recent height
    this.floorY = -3.6;
    this.crouch = 0; this.lean = 0; this.jump = 0; this.energy = 0; this.dip = 0; this.legsSeen = true;
    this.baseHipY = null;
    this.hands = [this.j.haL, this.j.haR];
    this.feet = [this.j.ftL, this.j.ftR];
    this.handVel = [v3(), v3()];
    this.prev = {}; for (const n of JOINTS) this.prev[n] = v3();
    this.fresh = true;
    this.center = this.j.hipC;
  }

  solve(dt) {
    const p = this.pts, j = this.j;
    for (const n of JOINTS) this.prev[n].copy(j[n]);
    const set = (name, i) => j[name].set(p[i].x, p[i].y, 0);
    set('nose', L.nose); set('earL', L.earL); set('earR', L.earR);
    set('shL', L.shL); set('shR', L.shR); set('elL', L.elL); set('elR', L.elR);
    set('wrL', L.wrL); set('wrR', L.wrR); set('hipL', L.hipL); set('hipR', L.hipR);
    j.chest.addVectors(j.shL, j.shR).multiplyScalar(0.5);
    const shW = j.shL.distanceTo(j.shR);
    const hipsSeen = p[L.hipL].v > 0.35 && p[L.hipR].v > 0.35 && p[L.hipL].y < p[L.shL].y;
    if (!hipsSeen) { // sitting close to the camera: invent hips under the shoulders
      const t = this.size ?? Math.max(shW * 1.35, 0.6);
      j.hipL.set(j.shL.x * 0.75 + j.shR.x * 0.25, j.chest.y - t, 0);
      j.hipR.set(j.shR.x * 0.75 + j.shL.x * 0.25, j.chest.y - t, 0);
    }
    j.hipC.addVectors(j.hipL, j.hipR).multiplyScalar(0.5);
    // body size: the tracker's steady measurement when it has one, so bowing towards
    // the camera (which squashes the torso in the picture) does not shrink the hero
    const torso = THREE.MathUtils.clamp(this.size ?? j.chest.distanceTo(j.hipC), 0.45, 3.2);
    this.S += (torso - this.S) * Math.min(1, dt * 3);
    const S = this.S;
    const legsSeen = hipsSeen && p[L.knL].v > 0.3 && p[L.knR].v > 0.3;
    const feetSeen = legsSeen && p[L.anL].v > 0.3 && p[L.anR].v > 0.3;
    if (legsSeen) { set('knL', L.knL); set('knR', L.knR); }
    else {
      // legs out of the picture: plant the feet on the ground under the hips, and fold
      // the knees outward when the hips come down, so a squat still looks like a squat
      const g = Math.min((this.ground ?? j.hipC.y - 1.72 * S) + 0.12 * S, j.hipC.y - 0.5 * S), l = 0.8 * S;
      for (let s = 0; s < 2; s++) {
        const sg = s ? 1 : -1, hip = s ? j.hipR : j.hipL, kn = s ? j.knR : j.knL, an = s ? j.anR : j.anL;
        const dx = sg * 0.08 * S, dy = g - hip.y, d = Math.hypot(dx, dy);
        if (d >= 2 * l) { kn.set(hip.x + dx / d * l, hip.y + dy / d * l, 0); an.set(hip.x + dx / d * 2 * l, hip.y + dy / d * 2 * l, 0); continue; }
        const off = Math.sqrt(l * l - d * d / 4); let px = -dy / d, py = dx / d; if (px * sg < 0) { px = -px; py = -py; }
        kn.set(hip.x + dx / 2 + px * off, hip.y + dy / 2 + py * off, 0); an.set(hip.x + dx, g, 0);
      }
    }
    if (feetSeen) { set('anL', L.anL); set('anR', L.anR); set('ftL', L.ftL); set('ftR', L.ftR); }
    else {
      if (legsSeen) { j.anL.set(j.knL.x, j.knL.y - 0.8 * S, 0); j.anR.set(j.knR.x, j.knR.y - 0.8 * S, 0); }
      j.ftL.set(j.anL.x - 0.25 * S, j.anL.y - 0.1 * S, 0); j.ftR.set(j.anR.x + 0.25 * S, j.anR.y - 0.1 * S, 0);
    }
    j.neck.copy(j.chest); j.neck.y += 0.12 * S;
    j.head.copy(j.nose);
    // hands sit a little past the wrist
    j.haL.copy(j.wrL).addScaledVector(v3().subVectors(j.wrL, j.elL), 0.35);
    j.haR.copy(j.wrR).addScaledVector(v3().subVectors(j.wrR, j.elR), 0.35);

    if (this.fresh) { for (const n of JOINTS) this.prev[n].copy(j[n]); this.fresh = false; }
    const idt = 1 / Math.max(dt, 1e-3);
    this.handVel[0].subVectors(j.haL, this.prev.haL).multiplyScalar(idt);
    this.handVel[1].subVectors(j.haR, this.prev.haR).multiplyScalar(idt);

    // posture metrics
    const feetY = Math.min(j.anL.y, j.anR.y);
    const hNow = (j.head.y + 0.35 * S) - feetY;
    this.standH = Math.max(this.standH - this.standH * 0.015 * dt, hNow);
    const vyHip = (j.hipC.y - this.prev.hipC.y) * idt;
    if (this.baseHipY === null) this.baseHipY = j.hipC.y;
    if (Math.abs(vyHip) < 1.2 * S) this.baseHipY += (j.hipC.y - this.baseHipY) * Math.min(1, dt * 0.6);
    const crouchRaw = THREE.MathUtils.clamp((0.9 - hNow / this.standH) / 0.28, 0, 1);
    this.crouch += (crouchRaw - this.crouch) * Math.min(1, dt * 10);
    this.jump = THREE.MathUtils.clamp((j.hipC.y - this.baseHipY) / (0.45 * S) - 0.35, 0, 1) * (crouchRaw < 0.3 ? 1 : 0);
    // a knee bounce is far too small to count as a crouch: measure it against the hips' resting height
    this.dip = THREE.MathUtils.clamp((this.baseHipY - j.hipC.y) / (0.22 * S), 0, 1);
    this.legsSeen = feetSeen;
    this.lean = Math.atan2(j.chest.x - j.hipC.x, Math.max(0.01, j.chest.y - j.hipC.y));
    // the tracker knows where it stood this player; otherwise the floor is wherever the feet settle
    if (this.ground != null) this.floorY += (this.ground - this.floorY) * Math.min(1, dt * 10);
    else this.floorY += ((feetY - 0.12 * S) - this.floorY) * Math.min(1, dt * (feetY < this.floorY ? 4 : 0.6));
    let e = 0;
    for (const n of ['haL', 'haR', 'elL', 'elR', 'knL', 'knR', 'anL', 'anR', 'head', 'hipC']) e += j[n].distanceTo(this.prev[n]);
    e = e * idt / (10 * S);
    this.energy += (Math.min(e, 4) - this.energy) * Math.min(1, dt * 5);
  }

  // Where a hand points for menu buttons. A hand is a pointer, not a paddle: its
  // movement away from the chest is stretched, so every button can be reached from one
  // spot without walking, and smaller players can still get to the top row.
  get reachUp() { return THREE.MathUtils.clamp((3.3 - this.j.chest.y) / (1.05 * this.S), 1, 3.6); }
  cursorY(h) { const y = this.hands[h].y, sh = this.j.chest.y; return y <= sh ? y : Math.min(3.9, sh + (y - sh) * this.reachUp); }
  uncursorY(y) { const sh = this.j.chest.y; return y <= sh ? y : sh + (y - sh) / this.reachUp; }
  cursorX(h) {
    const c = this.j.chest.x, d = (this.hands[h].x - c) / this.S, a = Math.abs(d), o = Math.max(0, a - REACH_KNEE);
    return THREE.MathUtils.clamp(c + Math.sign(d) * this.S * (REACH_SIDE * a + REACH_EXTRA * o * o), -7.5, 7.5);
  }
  uncursorX(x) {
    const c = this.j.chest.x, X = Math.abs(x - c) / this.S; let a = X / REACH_SIDE;
    if (a > REACH_KNEE) { const B = REACH_SIDE - 2 * REACH_EXTRA * REACH_KNEE, C = REACH_EXTRA * REACH_KNEE * REACH_KNEE - X; a = (-B + Math.sqrt(B * B - 4 * REACH_EXTRA * C)) / (2 * REACH_EXTRA); }
    return c + Math.sign(x - c) * a * this.S;
  }

  // Unit direction of a limb segment, used by the dance games to compare poses.
  dir(a, b, out = v3()) { return out.subVectors(this.j[b], this.j[a]).normalize(); }
}

export class Player {
  constructor(slot) {
    this.slot = slot; this.color = PLAYER_COLORS[slot]; this.css = PLAYER_CSS[slot]; this.name = PLAYER_NAMES[slot];
    this.rig = new Rig();
    this.filters = Array.from({ length: 33 }, () => [new OneEuro(), new OneEuro()]);
    this.target = Array.from({ length: 33 }, () => ({ x: 0, y: 0, v: 0 }));
    this.lastSeen = 0; this.born = 0; this.first = true; this.cx = 0; this.cy = 0; this.box = null;
    // T: steady torso length, floor: where the feet rest, stand: hip height when standing (all as filmed)
    this.fit = { T: 0, floor: null, stand: null, dropT: 0, off: 0, s: 1, k: 0 };
  }
  get j() { return this.rig.j; }
}

export class Tracker {
  constructor() {
    this.players = new Array(MAX_PLAYERS).fill(null);
    this.video = null; this.landmarker = null; this.mode = 'none';
    this.stageW = 16; this.stageH = STAGE_H; this.lastVideoTime = -1; this.lastDetect = 0;
    this.onJoin = null; this.onLeave = null; this.mirror = true;
    this.canvas = document.createElement('canvas'); this.ctx = this.canvas.getContext('2d', { alpha: false });
    this.rotation = 0; this.autoRotate = false; this.sideTurn = 0; this.sideSince = 0;
    this.fit = true; this.cands = []; this.maxSide = 720; this.frameN = 0;
    this.follow = null; this.classic = false; this.patience = 900; // how long a player may be out of sight, in milliseconds
    try { this.rotation = (+localStorage.getItem('ww-rot') || 0) % 360; } catch (e) { /* fine */ }
  }

  get active() { return this.players.filter(Boolean); }
  // Fitted: everyone is scaled to hero size and stood on the stage floor. Not fitted: bodies
  // stay exactly where the camera sees them, for the mirror mode that shows the real picture.
  setFit(on) {
    if (this.fit === on) return; this.fit = on;
    for (const p of this.active) {
      p.first = true; p.filters = Array.from({ length: 33 }, () => [new OneEuro(), new OneEuro()]); p.fit = { T: 0, floor: null, stand: null, dropT: 0, off: 0, s: 1, k: 0 };
      const r = p.rig; r.size = r.ground = undefined; r.fresh = true; r.baseHipY = null; r.standH = 0;
    }
  }
  // half-width of the area players can actually reach, and how much to stretch menu cursors to cover the screen
  // A tall, narrow picture only covers the middle of the stage, so sideways steps are
  // stretched until walking across the picture is walking across the stage.
  get gainX() { return this.fit ? THREE.MathUtils.clamp(14 / this.stageW, 1, 2.4) : 1; }
  get playHalf() { return Math.min(8, this.stageW / 2 * this.gainX); }
  // A short tip about where to stand, or '' when everyone is in a good spot.
  advice() {
    if (this.mode !== 'camera' || !this.fit) return '';
    let close = false, far = false;
    for (const p of this.active) { if (p.fit.k > 0.3) close = true; else if (p.fit.T * 9 / this.stageH < 0.6) far = true; }
    return close ? 'Step back a little so I can see all of you' : far ? 'Come a bit closer' : '';
  }

  // deviceId picks one particular camera, for machines with more than one plugged in.
  async startCamera(facing = 'user', deviceId = null) {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera-api');
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    const open = (which) => navigator.mediaDevices.getUserMedia({ audio: false, video: { ...which, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } } });
    if (deviceId) { try { this.stream = await open({ deviceId: { exact: deviceId } }); } catch (e) { this.stream = null; } } // unplugged since last time
    if (!deviceId || !this.stream) this.stream = await open({ facingMode: facing });
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.playsInline = true; this.video.muted = true; this.video.autoplay = true;
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    this.facing = facing; this.deviceId = this.stream.getVideoTracks()[0]?.getSettings?.().deviceId ?? null;
  }
  async cameras() {
    try { return (await navigator.mediaDevices.enumerateDevices()).filter(d => d.kind === 'videoinput' && d.deviceId); } catch (e) { return []; }
  }
  // Switch to the next camera on this machine. Returns its name, or null if there is only one.
  async nextCamera() {
    const cams = await this.cameras(); if (cams.length < 2) return null;
    const was = this.deviceId, next = cams[(cams.findIndex(c => c.deviceId === was) + 1) % cams.length];
    try { await this.startCamera(this.facing, next.deviceId); } catch (e) { await this.startCamera(this.facing, was); return null; }
    this.clear();
    try { localStorage.setItem('ww-cam', this.deviceId); } catch (e) { /* fine */ }
    return (cams.find(c => c.deviceId === this.deviceId)?.label || 'Camera').replace(/\s*\([0-9a-f]{4}:[0-9a-f]{4}\)\s*$/i, '');
  }
  // Everybody off the stage: the picture has changed under them.
  clear() {
    for (let i = 0; i < MAX_PLAYERS; i++) if (this.players[i]) { const p = this.players[i]; this.players[i] = null; this.onLeave?.(p); }
    this.cands = []; this.follow?.reset(this.lastDetect);
  }

  async loadModel(base, only) {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(base + 'mp');
    const model = new Uint8Array(await (await fetch(base + 'models/pose_landmarker_lite.task')).arrayBuffer());
    let delegate = only ?? 'GPU';
    const make = async (options) => {
      const go = () => PoseLandmarker.createFromOptions(fileset, { baseOptions: { modelAssetBuffer: model, delegate }, ...options });
      try { return await go(); } catch (e) { if (delegate === 'CPU') throw e; delegate = 'CPU'; return go(); }
    };
    // Each player gets a follower of their own (see follow.js). The older way, one model
    // looking at the whole picture for everybody, stays as a fallback.
    if (!this.classic) {
      try { this.follow = new Follow(this, make); await this.follow.start(); this.patience = 1100; }
      catch (e) { console.warn('following is not available, using whole-picture tracking', e); this.follow = null; }
    }
    if (!this.follow) this.landmarker = await make({
      runningMode: 'VIDEO', numPoses: MAX_PLAYERS,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    this.mode = 'camera';
  }

  // Called every frame. Runs detection when the camera has a new frame.
  update(now, dt) {
    if (this.mode === 'camera' && this.video && this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const frame = this.drawFrame(); this.frameN++;
      const aspect = frame.width / Math.max(1, frame.height);
      // fill the 16-wide stage; a squarer camera gets its top and bottom cropped a little
      // A tall, narrow picture shows the whole body in the middle of the stage instead.
      if (aspect >= 1) { this.stageW = Math.max(16, STAGE_H * aspect); this.stageH = this.stageW / aspect; }
      else { this.stageH = STAGE_H; this.stageW = STAGE_H * aspect; }
      if (this.follow) {
        const sets = []; this.follow.step(now, sets);
        if (this.autoRotate) this.checkUpright(sets, frame, now);
      } else {
        let res = null;
        try { res = this.landmarker.detectForVideo(frame, now); } catch (e) { /* skip frame */ }
        if (res) { if (this.autoRotate) this.checkUpright(res.landmarks, frame, now); this.ingest(res.landmarks, now); }
      }
    }
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = this.players[i]; if (!p) continue;
      // someone hidden behind another player is waited for a little longer than someone who walked off
      if (now - p.lastSeen > (p.hidden ? 2.5 * this.patience : this.patience)) { this.players[i] = null; this.onLeave?.(p); continue; }
      const k = p.first ? 1 : 1 - Math.exp(-dt * 28);
      for (let n = 0; n < 33; n++) {
        const c = p.rig.pts[n], t = p.target[n];
        c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.v = t.v;
      }
      p.first = false;
      p.rig.solve(dt);
    }
  }

  // Copy the camera frame to a canvas, turned so people stand upright. Some
  // phones and stands deliver the picture sideways.
  drawFrame() {
    const v = this.video, vw = v.videoWidth, vh = v.videoHeight, k = Math.min(1, (this.follow ? 1280 : this.maxSide) / Math.max(vw, vh));
    const side = this.rotation % 180 !== 0, cw = Math.round((side ? vh : vw) * k), ch = Math.round((side ? vw : vh) * k);
    const c = this.canvas; if (c.width !== cw || c.height !== ch) { c.width = cw; c.height = ch; }
    const g = this.ctx; g.setTransform(1, 0, 0, 1, 0, 0); g.translate(cw / 2, ch / 2); g.rotate(this.rotation * Math.PI / 180); g.drawImage(v.el ?? v, -vw * k / 2, -vh * k / 2, vw * k, vh * k);
    return c;
  }
  // Copy one piece of that upright picture (x, y, w, h in its own dots) so that it fills a
  // canvas of cw by ch. Anything beyond the edge of the picture comes out black.
  paint(g, cw, ch, x, y, w, h) {
    const c = this.canvas, x0 = Math.max(0, x), y0 = Math.max(0, y), x1 = Math.min(c.width, x + w), y1 = Math.min(c.height, y + h), kx = cw / w, ky = ch / h;
    g.setTransform(1, 0, 0, 1, 0, 0);
    if (x0 > x || y0 > y || x1 < x + w || y1 < y + h) { g.fillStyle = '#000'; g.fillRect(0, 0, cw, ch); }
    if (x1 > x0 && y1 > y0) g.drawImage(c, x0, y0, x1 - x0, y1 - y0, (x0 - x) * kx, (y0 - y) * ky, (x1 - x0) * kx, (y1 - y0) * ky);
  }
  setRotation(deg) {
    this.rotation = ((deg % 360) + 360) % 360; this.sideT = 0;
    try { localStorage.setItem('ww-rot', this.rotation); } catch (e) { /* fine */ }
    this.clear();
    this.onRotate?.(this.rotation);
  }
  // If the clearest body in view has been lying sideways or upside down for a
  // moment, the picture is turned: rotate it so that body stands upright.
  checkUpright(sets, frame, now) {
    let turn = 0;
    for (const lm of sets) {
      if (!lm || ((lm[11].visibility ?? 1) + (lm[12].visibility ?? 1) + (lm[23].visibility ?? 1) + (lm[24].visibility ?? 1)) / 4 < 0.6) continue;
      const dx = ((lm[23].x + lm[24].x) - (lm[11].x + lm[12].x)) * frame.width, dy = ((lm[23].y + lm[24].y) - (lm[11].y + lm[12].y)) * frame.height;
      if (Math.abs(dx) > 1.7 * Math.abs(dy)) turn = dx > 0 ? 90 : 270; else if (dy < 0 && Math.abs(dy) > 1.7 * Math.abs(dx)) turn = 180;
      break;
    }
    if (!turn || turn !== this.sideTurn) { this.sideTurn = turn; this.sideSince = now; return; }
    if (now - this.sideSince > 1200) { this.sideTurn = 0; this.setRotation(this.rotation + turn); }
  }

  // One detected body in stage units (mirrored), with what the fit needs to know about it.
  measure(lm) {
    const W = this.stageW, H = this.stageH, pts = [];
    for (let n = 0; n < 33; n++) {
      const l = lm[n], inside = l.x > -0.04 && l.x < 1.04 && l.y > -0.04 && l.y < 1.04;
      pts.push({ x: (this.mirror ? 0.5 - l.x : l.x - 0.5) * W, y: (0.5 - l.y) * H, v: inside ? (l.visibility ?? 1) : 0 });
    }
    const a = pts[11], b = pts[12], hl = pts[23], hr = pts[24];
    if ((a.v + b.v) / 2 < 0.45) return null;
    const shx = (a.x + b.x) / 2, shy = (a.y + b.y) / 2, shW = Math.hypot(a.x - b.x, a.y - b.y);
    const hips = hl.v > 0.35 && hr.v > 0.35 && hl.y < a.y;
    const T = hips ? Math.max(0.3, Math.hypot(shx - (hl.x + hr.x) / 2, shy - (hl.y + hr.y) / 2)) : Math.max(shW * 1.35, 0.6);
    const hipY = hips ? (hl.y + hr.y) / 2 : shy - T;
    const feet = hips && pts[25].v > 0.3 && pts[26].v > 0.3 && pts[27].v > 0.3 && pts[28].v > 0.3;
    // the space the body takes up, for telling people (and false alarms) apart
    let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
    for (const n of [0, 11, 12, 23, 24, 25, 26, 27, 28]) { const q = pts[n]; if (n > 12 && q.v < 0.3) continue; x0 = Math.min(x0, q.x); x1 = Math.max(x1, q.x); y0 = Math.min(y0, q.y); y1 = Math.max(y1, q.y); }
    return {
      pts, T, hipY, shx, shy, hipOff: hips ? ((hl.x + hr.x) / 2 - shx) / 2 : 0, feetY: feet ? Math.min(pts[27].y, pts[28].y) : null,
      box: { x0: x0 - 0.25 * T, x1: x1 + 0.25 * T, y0, y1: y1 + 0.4 * T },
      cx: (a.x + b.x + hl.x + hr.x) / 4, cy: (a.y + b.y + hl.y + hr.y) / 4, used: false,
    };
  }

  // sets: array of 33-landmark arrays in normalized image coordinates
  ingest(sets, now) {
    const dt = Math.max(1e-3, (now - this.lastDetect) / 1000) || 1 / 30; this.lastDetect = now;
    const dets = [];
    for (const lm of sets) { const d = lm && lm.length >= 33 && this.measure(lm); if (d) dets.push(d); }
    // Match detections to existing players, nearest first. A body can only have moved
    // so far since it was last seen, and it cannot suddenly be twice the size: that
    // keeps a false alarm next to a player from stealing their hero.
    const pairs = [];
    this.players.forEach((p, i) => {
      if (!p) return;
      const T = p.fit.T || 1.2, reach = Math.max(1, 1.2 * T) * (1 + 2.5 * Math.min(0.9, (now - p.lastSeen) / 1000)), young = now - p.born < 1200;
      dets.forEach((d, k) => { const dist = Math.hypot(p.cx - d.cx, p.cy - d.cy); if (dist <= reach && (young || !this.fit || d.T < 1.8 * T)) pairs.push({ i, k, dist: dist / reach }); });
    });
    pairs.sort((a, b) => a.dist - b.dist);
    const taken = new Set();
    for (const { i, k } of pairs) {
      if (taken.has(i) || dets[k].used) continue;
      taken.add(i); dets[k].used = true; this.feed(this.players[i], dets[k], now, dt);
    }
    // Anyone left over is new. The model now and then sees a second "person" on top of a
    // real one, or one giant made out of two people, so a newcomer has to stand clear of
    // the players already here and stay in view for a moment before joining.
    for (const c of this.cands) c.hit = false;
    const fresh = dets.filter(q => !q.used);
    for (const d of fresh) {
      if (this.players.some(p => p && crowds(d.box, p.box)) || fresh.some(o => o !== d && area(o.box) < area(d.box) && crowds(d.box, o.box))) continue;
      let c = null, best = 2.2;
      for (const q of this.cands) { const dist = Math.hypot(q.cx - d.cx, q.cy - d.cy); if (!q.hit && dist < best) { best = dist; c = q; } }
      if (!c) { c = { since: now, n: 0 }; this.cands.push(c); }
      c.cx = d.cx; c.cy = d.cy; c.n++; c.hit = true; c.miss = 0;
      if (c.n < 3 || now - c.since < 300) continue;
      const slot = this.players.findIndex(p => !p); if (slot < 0) continue;
      this.admit(slot, d, now, dt); c.done = true;
    }
    this.cands = this.cands.filter(c => !c.done && (c.hit || ++c.miss < 2));
  }

  // Somebody new takes a place on the stage.
  admit(slot, d, now, dt) {
    const p = new Player(slot); p.born = now; this.players[slot] = p;
    this.feed(p, d, now, dt); this.onJoin?.(p); return p;
  }

  feed(p, d, now, dt) {
    p.lastSeen = now; p.cx = d.cx; p.cy = d.cy; p.box = d.box;
    let s = 1, ox = 0, oy = 0;
    if (this.fit) {
      const f = p.fit, young = now - p.born < 1200;
      // Body size follows growth quickly and shrinking slowly: bending over squashes the
      // torso in the picture for a moment, and that must not blow the hero up.
      f.T = f.T ? f.T + (d.T - f.T) * Math.min(1, dt * (d.T > f.T || young ? 2.5 : 0.12)) : d.T;
      let fl;
      if (d.feetY !== null) { fl = d.feetY - 0.12 * f.T; f.stand = d.hipY; f.dropT = 0; }
      else {
        // Feet out of the picture: work the floor out from how high the hips ride when
        // standing. A short dip is a squat; a long one means the player really moved.
        if (f.stand === null) f.stand = d.hipY;
        const drop = f.stand - d.hipY;
        if (drop <= 0) { f.stand -= drop * Math.min(1, dt * 1.5); f.dropT = 0; }
        else { f.dropT = drop > 0.15 * f.T ? f.dropT + dt : 0; f.stand -= drop * Math.min(1, dt * (f.dropT > 2.5 ? 1.5 : 0.1)); }
        fl = f.stand - 1.72 * f.T;
      }
      f.floor = f.floor === null ? fl : f.floor + (fl - f.floor) * Math.min(1, dt * (fl < f.floor || young ? 6 : 0.7));
      let hi = f.T; for (const q of this.players) if (q) hi = Math.max(hi, q.fit.T);
      const r = fitFor(f.T, f.T / hi, 9 / this.stageH); s = f.s = r.s; f.k = r.k;
      f.off += (d.hipOff - f.off) * Math.min(1, dt * 8);
      const px = d.shx + f.off; // the point the body is scaled around: midway between shoulders and hips
      ox = px * (this.gainX - s); oy = (FLOOR - f.floor * s) * (1 - r.k);
      p.rig.size = f.T * s; p.rig.ground = f.floor * s + oy;
    }
    for (let n = 0; n < 33; n++) {
      const q = d.pts[n], t = p.target[n];
      t.x = p.filters[n][0].filter(q.x * s + ox, dt);
      t.y = p.filters[n][1].filter(q.y * s + oy, dt);
      t.v = q.v;
    }
  }
}
