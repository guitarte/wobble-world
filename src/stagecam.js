// The camera operator. The stage itself never moves (bodies and buttons have to
// line up with it), so the camera swings around its centre instead: things on
// the stage stay put while the world behind them slides, which is what gives
// the picture depth. On top of that it punches in on big hits, shakes like a
// hand-held camera rather than a rattling box, nods on the beat and swoops in
// when a game starts.
import * as THREE from 'three';

const clamp = THREE.MathUtils.clamp;
// smooth wobble in -1..1: three sines that never line up
const wob = (t, a, b, c) => (Math.sin(t * a) + Math.sin(t * b + 1.7) * 0.7 + Math.sin(t * c + 4.1) * 0.45) / 2.15;

export class StageCam {
  constructor(camera, dist) {
    this.camera = camera; this.dist = dist;
    this.yaw = 0; this.pitch = 0;          // where the swing has eased to
    this.zoom = 0; this.zoomV = 0;         // punch-in spring (fraction of the distance)
    this.base = 0;                         // a held push-in or pull-back, eased
    this.baseTo = 0; this.beat = 0; this.swing = 1;
    this.v = new THREE.Vector3();
  }
  // a quick shove toward the stage that springs back
  punch(a) { this.zoomV += clamp(a, -1, 1) * 1.9; }
  // start pulled back and high, then settle: used as a game opens
  swoop() { this.zoom = -0.16; this.zoomV = 0; this.pitch = 0.07; }
  // o: players, shake (0..1.2), beatPulse (1 on the beat, falling to 0), ar
  update(dt, t, o) {
    const k = Math.min(dt, 0.05);
    // follow the middle of the players, a little, and never stop drifting
    let cx = 0, cy = 0; const n = o.players.length;
    for (const p of o.players) { cx += p.j.hipC.x; cy += p.j.head.y; }
    if (n) { cx /= n; cy /= n; }
    const amt = this.swing * (o.ar ? 0 : 1); // the real room in mirror mode must not slide about
    const yawTo = (clamp(cx * 0.0075, -0.05, 0.05) + wob(t, 0.23, 0.31, 0.13) * 0.016) * amt;
    const pitchTo = (clamp(cy * 0.004, -0.012, 0.016) + wob(t + 40, 0.19, 0.27, 0.11) * 0.009) * amt;
    this.yaw += (yawTo - this.yaw) * Math.min(1, k * 1.6); this.pitch += (pitchTo - this.pitch) * Math.min(1, k * 1.6);
    // punch spring: quick out, a little overshoot on the way back
    this.zoomV += (-this.zoom * 190 - this.zoomV * 17) * k; this.zoom = clamp(this.zoom + this.zoomV * k, -0.25, 0.09);
    this.base += (this.baseTo - this.base) * Math.min(1, k * 1.2);
    const d = this.dist * (1 - this.zoom - this.base - this.beat * o.beatPulse * 0.012);
    const cp = Math.cos(this.pitch);
    this.camera.position.set(Math.sin(this.yaw) * cp * d, Math.sin(this.pitch) * d, Math.cos(this.yaw) * cp * d);
    this.camera.lookAt(0, 0, 0);
    // hand-held shake: fast and smooth, with a twist, fading as the hit fades
    const s = Math.pow(Math.min(1.2, o.shake), 1.25) * 0.2;
    if (s > 0.0005) {
      this.camera.position.x += wob(t, 71, 113, 47) * s; this.camera.position.y += wob(t + 9, 83, 59, 101) * s;
      this.camera.rotation.z += wob(t + 3, 67, 97, 43) * s * 0.035;
    }
  }
  // where a point on the stage lands on screen, in stage units from the centre
  // (the same units the menus and name tags are laid out in)
  toStage(x, y, z, halfW, halfH, out) {
    this.v.set(x, y, z).project(this.camera); out.x = this.v.x * halfW; out.y = this.v.y * halfH; return out;
  }
}
