// Body tracking: camera + MediaPipe pose -> up to 4 persistent players with
// smoothed joints in "stage" coordinates (x: -8..8, y: -4.5..4.5, mirrored).
import * as THREE from 'three';

export const STAGE_H = 9;
export const MAX_PLAYERS = 4;
export const PLAYER_COLORS = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff];
export const PLAYER_CSS = ['#ff5a78', '#22d3c5', '#ffc531', '#9d6bff'];
export const PLAYER_NAMES = ['Pip', 'Mint', 'Sunny', 'Plum'];

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
    this.crouch = 0; this.lean = 0; this.jump = 0; this.energy = 0;
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
      const t = Math.max(shW * 1.35, 0.6);
      j.hipL.set(j.shL.x * 0.75 + j.shR.x * 0.25, j.chest.y - t, 0);
      j.hipR.set(j.shR.x * 0.75 + j.shL.x * 0.25, j.chest.y - t, 0);
    }
    j.hipC.addVectors(j.hipL, j.hipR).multiplyScalar(0.5);
    const torso = THREE.MathUtils.clamp(j.chest.distanceTo(j.hipC), 0.45, 3.2);
    this.S += (torso - this.S) * Math.min(1, dt * 3);
    const S = this.S;
    const legsSeen = hipsSeen && p[L.knL].v > 0.3 && p[L.knR].v > 0.3;
    const feetSeen = legsSeen && p[L.anL].v > 0.3 && p[L.anR].v > 0.3;
    if (legsSeen) { set('knL', L.knL); set('knR', L.knR); }
    else { j.knL.set(j.hipL.x - 0.05 * S, j.hipL.y - 0.8 * S, 0); j.knR.set(j.hipR.x + 0.05 * S, j.hipR.y - 0.8 * S, 0); }
    if (feetSeen) { set('anL', L.anL); set('anR', L.anR); set('ftL', L.ftL); set('ftR', L.ftR); }
    else {
      j.anL.set(j.knL.x, j.knL.y - 0.8 * S, 0); j.anR.set(j.knR.x, j.knR.y - 0.8 * S, 0);
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
    this.lean = Math.atan2(j.chest.x - j.hipC.x, Math.max(0.01, j.chest.y - j.hipC.y));
    this.floorY += ((feetY - 0.12 * S) - this.floorY) * Math.min(1, dt * (feetY < this.floorY ? 4 : 0.6));
    let e = 0;
    for (const n of ['haL', 'haR', 'elL', 'elR', 'knL', 'knR', 'anL', 'anR', 'head', 'hipC']) e += j[n].distanceTo(this.prev[n]);
    e = e * idt / (10 * S);
    this.energy += (Math.min(e, 4) - this.energy) * Math.min(1, dt * 5);
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
    this.lastSeen = 0; this.born = 0; this.first = true; this.cx = 0; this.cy = 0;
  }
  get j() { return this.rig.j; }
}

export class Tracker {
  constructor() {
    this.players = new Array(MAX_PLAYERS).fill(null);
    this.video = null; this.landmarker = null; this.mode = 'none';
    this.stageW = 16; this.stageH = STAGE_H; this.lastVideoTime = -1; this.lastDetect = 0;
    this.onJoin = null; this.onLeave = null; this.mirror = true;
  }

  get active() { return this.players.filter(Boolean); }

  async startCamera(facing = 'user') {
    if (!navigator.mediaDevices?.getUserMedia) throw new Error('no-camera-api');
    if (this.stream) this.stream.getTracks().forEach(t => t.stop());
    this.stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 }, frameRate: { ideal: 30 } },
    });
    if (!this.video) {
      this.video = document.createElement('video');
      this.video.playsInline = true; this.video.muted = true; this.video.autoplay = true;
    }
    this.video.srcObject = this.stream;
    await this.video.play();
    this.facing = facing;
  }

  async loadModel(base) {
    const { FilesetResolver, PoseLandmarker } = await import('@mediapipe/tasks-vision');
    const fileset = await FilesetResolver.forVisionTasks(base + 'mp');
    const make = (delegate) => PoseLandmarker.createFromOptions(fileset, {
      baseOptions: { modelAssetPath: base + 'models/pose_landmarker_lite.task', delegate },
      runningMode: 'VIDEO', numPoses: MAX_PLAYERS,
      minPoseDetectionConfidence: 0.5, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5,
    });
    try { this.landmarker = await make('GPU'); } catch (e) { this.landmarker = await make('CPU'); }
    this.mode = 'camera';
  }

  // Called every frame. Runs detection when the camera has a new frame.
  update(now, dt) {
    if (this.mode === 'camera' && this.video && this.video.readyState >= 2 && this.video.currentTime !== this.lastVideoTime) {
      this.lastVideoTime = this.video.currentTime;
      const aspect = this.video.videoWidth / Math.max(1, this.video.videoHeight);
      // fill the 16-wide stage; a squarer camera gets its top and bottom cropped a little
      this.stageW = Math.max(16, STAGE_H * aspect); this.stageH = this.stageW / aspect;
      let res = null;
      try { res = this.landmarker.detectForVideo(this.video, now); } catch (e) { /* skip frame */ }
      if (res) this.ingest(res.landmarks, now);
    }
    for (let i = 0; i < MAX_PLAYERS; i++) {
      const p = this.players[i]; if (!p) continue;
      if (now - p.lastSeen > 900) { this.players[i] = null; this.onLeave?.(p); continue; }
      const k = p.first ? 1 : 1 - Math.exp(-dt * 28);
      for (let n = 0; n < 33; n++) {
        const c = p.rig.pts[n], t = p.target[n];
        c.x += (t.x - c.x) * k; c.y += (t.y - c.y) * k; c.v = t.v;
      }
      p.first = false;
      p.rig.solve(dt);
    }
  }

  // sets: array of 33-landmark arrays in normalized image coordinates
  ingest(sets, now) {
    const dt = Math.max(1e-3, (now - this.lastDetect) / 1000) || 1 / 30; this.lastDetect = now;
    const W = this.stageW, H = this.stageH;
    const dets = [];
    for (const lm of sets) {
      if (!lm || lm.length < 33) continue;
      const vis = ((lm[11].visibility ?? 1) + (lm[12].visibility ?? 1)) / 2;
      if (vis < 0.45) continue;
      const mx = (x) => (this.mirror ? 0.5 - x : x - 0.5) * W;
      const cx = mx((lm[11].x + lm[12].x + lm[23].x + lm[24].x) / 4);
      const my = (y) => (0.5 - y) * H;
      const cy = my((lm[11].y + lm[12].y + lm[23].y + lm[24].y) / 4);
      dets.push({ lm, cx, cy, mx, my, used: false });
    }
    // match detections to existing players, nearest first
    const pairs = [];
    this.players.forEach((p, i) => { if (p) dets.forEach((d, k) => pairs.push({ i, k, dist: Math.hypot(p.cx - d.cx, p.cy - d.cy) })); });
    pairs.sort((a, b) => a.dist - b.dist);
    const taken = new Set();
    for (const { i, k, dist } of pairs) {
      if (taken.has(i) || dets[k].used || dist > 3.5) continue;
      taken.add(i); dets[k].used = true; this.feed(this.players[i], dets[k], now, dt);
    }
    for (const d of dets) {
      if (d.used) continue;
      const slot = this.players.findIndex(p => !p); if (slot < 0) break;
      const p = new Player(slot); p.born = now; this.players[slot] = p;
      this.feed(p, d, now, dt); this.onJoin?.(p);
    }
  }

  feed(p, d, now, dt) {
    p.lastSeen = now; p.cx = d.cx; p.cy = d.cy;
    for (let n = 0; n < 33; n++) {
      const l = d.lm[n], t = p.target[n];
      t.x = p.filters[n][0].filter(d.mx(l.x), dt);
      t.y = p.filters[n][1].filter(d.my(l.y), dt);
      t.v = l.visibility ?? 1;
    }
  }
}
