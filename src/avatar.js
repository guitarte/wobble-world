// The Wobbles: chunky vinyl-toy characters driven by a player's joints.
import * as THREE from 'three';

const UP = new THREE.Vector3(0, 1, 0);
const tmpA = new THREE.Vector3(), tmpB = new THREE.Vector3();
const G = {
  sphere: new THREE.SphereGeometry(1, 28, 20),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 16, 1, true),
  cone: new THREE.ConeGeometry(1, 1, 20),
  torus: new THREE.TorusGeometry(1, 0.22, 10, 28, Math.PI),
  band: new THREE.TorusGeometry(1, 0.09, 10, 40),
};

function shadowTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d'); const gr = g.createRadialGradient(64, 64, 4, 64, 64, 64);
  gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}
let SHADOW_TEX = null;

const toy = (color, extra = {}) => new THREE.MeshPhysicalMaterial({
  color, roughness: 0.38, metalness: 0.0, clearcoat: 0.7, clearcoatRoughness: 0.25, ...extra,
});

export class Avatar {
  // style: 0 cat ears, 1 bunny ears, 2 antenna, 3 horns, 4 coach headband
  constructor(color, style = 0) {
    this.group = new THREE.Group();
    this.style = style;
    const base = new THREE.Color(color);
    const dark = base.clone().multiplyScalar(0.72);
    const light = base.clone().lerp(new THREE.Color(0xffffff), 0.62);
    this.mat = {
      body: toy(base), limb: toy(dark), light: toy(light),
      hand: toy(base.clone().lerp(new THREE.Color(0xffffff), 0.3), { emissive: base, emissiveIntensity: 0.35 }),
      white: toy(0xdfe0ea), black: toy(0x1a1326, { roughness: 0.2 }),
      cheek: new THREE.MeshBasicMaterial({ color: 0xff8fa8, transparent: true, opacity: 0.75 }),
      glow: new THREE.MeshBasicMaterial({ color: base.clone().lerp(new THREE.Color(0xffffff), 0.3) }),
    };
    const mk = (geo, mat, parent = this.group) => { const m = new THREE.Mesh(geo, mat); parent.add(m); return m; };
    this.body = mk(G.sphere, this.mat.body);
    this.belly = mk(G.sphere, this.mat.light);
    this.segs = {}; this.balls = {};
    for (const n of ['uaL', 'uaR', 'faL', 'faR', 'thL', 'thR', 'shinL', 'shinR']) this.segs[n] = mk(G.cyl, this.mat.limb);
    for (const n of ['shL', 'shR', 'elL', 'elR', 'knL', 'knR', 'hipL', 'hipR']) this.balls[n] = mk(G.sphere, this.mat.limb);
    this.handL = mk(G.sphere, this.mat.hand); this.handR = mk(G.sphere, this.mat.hand);
    this.footL = mk(G.sphere, this.mat.white); this.footR = mk(G.sphere, this.mat.white);

    // head and face
    this.head = new THREE.Group(); this.group.add(this.head);
    mk(G.sphere, this.mat.body, this.head);
    this.eyes = [];
    for (const sg of [-1, 1]) {
      const eye = new THREE.Group(); eye.position.set(sg * 0.36, 0.1, 0.84); this.head.add(eye);
      const w = mk(G.sphere, this.mat.white, eye); w.scale.set(0.25, 0.28, 0.14);
      const p = mk(G.sphere, this.mat.black, eye); p.scale.set(0.13, 0.15, 0.08); p.position.z = 0.1;
      const hl = mk(G.sphere, this.mat.white, eye); hl.scale.setScalar(0.045); hl.position.set(0.05, 0.06, 0.17);
      eye.userData.pupil = p; this.eyes.push(eye);
      const ch = mk(G.sphere, this.mat.cheek, this.head); ch.scale.set(0.15, 0.1, 0.04); ch.position.set(sg * 0.6, -0.2, 0.74); ch.lookAt(ch.position.clone().multiplyScalar(2));
    }
    this.smile = mk(G.torus, this.mat.black, this.head); this.smile.scale.setScalar(0.16); this.smile.position.set(0, -0.2, 0.93); this.smile.rotation.z = Math.PI;
    this.mouth = mk(G.sphere, this.mat.black, this.head); this.mouth.scale.set(0.2, 0.2, 0.08); this.mouth.position.set(0, -0.28, 0.9); this.mouth.visible = false;
    this.wobblers = [];
    this.buildStyle(style, mk);

    if (!SHADOW_TEX) SHADOW_TEX = shadowTexture();
    this.shadow = mk(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: SHADOW_TEX, transparent: true, depthWrite: false }));
    this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = -1;

    this.pop = 0; this.popV = 0; this.blinkT = 2; this.happy = 0; this.bounce = 0; this.spring = 0; this.springV = 0; this.lastHeadX = 0;
    this.look = new THREE.Vector2();
  }

  buildStyle(style, mk) {
    const H = this.head;
    if (style === 0) {
      for (const sg of [-1, 1]) {
        const e = mk(G.cone, this.mat.body, H); e.scale.set(0.3, 0.5, 0.22); e.position.set(sg * 0.56, 0.86, 0); e.rotation.z = -sg * 0.35;
        const i = mk(G.cone, this.mat.light, H); i.scale.set(0.17, 0.3, 0.12); i.position.set(sg * 0.55, 0.82, 0.1); i.rotation.z = -sg * 0.35;
      }
    } else if (style === 1) {
      for (const sg of [-1, 1]) {
        const piv = new THREE.Group(); piv.position.set(sg * 0.32, 0.8, 0); H.add(piv);
        const e = mk(G.sphere, this.mat.body, piv); e.scale.set(0.17, 0.6, 0.12); e.position.y = 0.5;
        const i = mk(G.sphere, this.mat.light, piv); i.scale.set(0.09, 0.42, 0.06); i.position.set(0, 0.5, 0.09);
        piv.userData.base = -sg * 0.18; this.wobblers.push(piv);
      }
    } else if (style === 2) {
      const piv = new THREE.Group(); piv.position.set(0, 0.92, 0); H.add(piv);
      const st = mk(G.cyl, this.mat.limb, piv); st.scale.set(0.035, 0.55, 0.035); st.position.y = 0.27;
      const b = mk(G.sphere, this.mat.glow, piv); b.scale.setScalar(0.17); b.position.y = 0.6;
      piv.userData.base = 0; this.wobblers.push(piv);
    } else if (style === 3) {
      for (const sg of [-1, 1]) {
        const e = mk(G.cone, this.mat.white, H); e.scale.set(0.14, 0.42, 0.14); e.position.set(sg * 0.5, 0.92, 0); e.rotation.z = -sg * 0.5;
      }
      for (let k = -1; k <= 1; k++) { const s = mk(G.cone, this.mat.light, H); s.scale.set(0.1, 0.26, 0.1); s.position.set(k * 0.16, 1.05 - Math.abs(k) * 0.05, 0); s.rotation.z = -k * 0.3; }
    } else {
      const band = mk(G.band, this.mat.glow, H); band.scale.setScalar(1.0); band.rotation.x = Math.PI / 2 - 0.25; band.position.y = 0.42;
      const piv = new THREE.Group(); piv.position.set(0, 0.95, 0); H.add(piv);
      for (let k = 0; k < 3; k++) { const s = mk(G.sphere, this.mat.light, piv); s.scale.set(0.12, 0.3, 0.12); s.position.set((k - 1) * 0.16, 0.2, 0); s.rotation.z = -(k - 1) * 0.5; }
      piv.userData.base = 0; this.wobblers.push(piv);
    }
  }

  cheer(amount = 1) { this.happy = Math.max(this.happy, amount); this.bounce = 1; }
  popIn() { this.pop = 0; this.popV = 0; }

  seg(mesh, a, b, r, z) {
    tmpA.subVectors(b, a); const len = tmpA.length() || 1e-3;
    mesh.position.copy(a).addScaledVector(tmpA, 0.5); mesh.position.z = z;
    mesh.quaternion.setFromUnitVectors(UP, tmpA.multiplyScalar(1 / len));
    mesh.scale.set(r, len, r);
  }
  ball(mesh, p, r, z) { mesh.position.set(p.x, p.y, z); mesh.scale.setScalar(r); }

  update(rig, dt, t, lookAt) {
    const j = rig.j, S = rig.S;
    // pop-in spring
    this.popV += ((1 - this.pop) * 140 - this.popV * 14) * dt; this.pop += this.popV * dt;
    const ps = Math.max(0.001, this.pop);
    this.group.scale.setScalar(ps);
    this.group.position.set(j.hipC.x * (1 - ps), j.hipC.y * (1 - ps), 0);
    this.happy = Math.max(0, this.happy - dt * 0.9); this.bounce = Math.max(0, this.bounce - dt * 3);
    const squash = 1 + Math.sin(this.bounce * Math.PI) * 0.12;

    // body bean
    tmpA.subVectors(j.chest, j.hipC); const tl = tmpA.length() || 1e-3; tmpA.multiplyScalar(1 / tl);
    const shW = Math.max(j.shL.distanceTo(j.shR), 0.55 * S);
    this.body.position.copy(j.hipC).addScaledVector(tmpA, tl * 0.52);
    this.body.quaternion.setFromUnitVectors(UP, tmpA);
    this.body.scale.set(shW * 0.74 * squash, tl * 0.86 / squash, shW * 0.56);
    this.belly.position.copy(this.body.position).addScaledVector(tmpA, -tl * 0.08); this.belly.position.z = shW * 0.2;
    this.belly.quaternion.copy(this.body.quaternion);
    this.belly.scale.set(shW * 0.5, tl * 0.58, shW * 0.44);

    const ra = 0.15 * S, rl = 0.185 * S, za = 0.3 * S, zl = -0.06 * S;
    this.seg(this.segs.uaL, j.shL, j.elL, ra, za * 0.6); this.seg(this.segs.faL, j.elL, j.wrL, ra * 0.95, za);
    this.seg(this.segs.uaR, j.shR, j.elR, ra, za * 0.6); this.seg(this.segs.faR, j.elR, j.wrR, ra * 0.95, za);
    this.seg(this.segs.thL, j.hipL, j.knL, rl, zl); this.seg(this.segs.shinL, j.knL, j.anL, rl * 0.9, zl);
    this.seg(this.segs.thR, j.hipR, j.knR, rl, zl); this.seg(this.segs.shinR, j.knR, j.anR, rl * 0.9, zl);
    this.ball(this.balls.shL, j.shL, ra * 1.15, za * 0.4); this.ball(this.balls.shR, j.shR, ra * 1.15, za * 0.4);
    this.ball(this.balls.elL, j.elL, ra, za * 0.8); this.ball(this.balls.elR, j.elR, ra, za * 0.8);
    this.ball(this.balls.knL, j.knL, rl, zl); this.ball(this.balls.knR, j.knR, rl, zl);
    this.ball(this.balls.hipL, j.hipL, rl * 1.05, zl); this.ball(this.balls.hipR, j.hipR, rl * 1.05, zl);
    const hr = 0.24 * S * (1 + this.happy * 0.15);
    this.ball(this.handL, j.haL, hr, za * 1.1); this.ball(this.handR, j.haR, hr, za * 1.1);
    for (const [foot, an, ft] of [[this.footL, j.anL, j.ftL], [this.footR, j.anR, j.ftR]]) {
      tmpB.addVectors(an, ft).multiplyScalar(0.5);
      foot.position.set(tmpB.x, tmpB.y - 0.03 * S, 0.06 * S); foot.scale.set(0.3 * S, 0.19 * S, 0.34 * S);
    }

    // head
    const R = 0.52 * S;
    const hx = j.nose.x, hy = Math.max(j.nose.y + 0.1 * S, j.chest.y + 0.42 * S);
    this.head.position.set(hx, hy, 0.16 * S); this.head.scale.setScalar(R);
    const ex = j.earR.x - j.earL.x, ey = j.earR.y - j.earL.y, ed = Math.hypot(ex, ey) || 1;
    const roll = Math.atan2(ey, Math.abs(ex) + 1e-3);
    const yaw = THREE.MathUtils.clamp((j.nose.x - (j.earL.x + j.earR.x) / 2) / ed * 1.4, -0.7, 0.7);
    this.head.rotation.set(0, yaw, THREE.MathUtils.clamp(roll, -0.6, 0.6));

    // springy ears and antennae follow head motion
    const hv = (hx - this.lastHeadX) / Math.max(dt, 1e-3); this.lastHeadX = hx;
    this.springV += (-this.spring * 90 - this.springV * 7 - hv * 3.5) * dt; this.spring += this.springV * dt;
    this.spring = THREE.MathUtils.clamp(this.spring, -1, 1);
    for (const w of this.wobblers) w.rotation.z = w.userData.base + this.spring * 0.6;

    // eyes: blink, and look toward a point of interest
    this.blinkT -= dt; if (this.blinkT < -0.12) this.blinkT = 1.5 + Math.random() * 3.5;
    const blink = this.blinkT < 0 ? 0.12 : 1;
    let lx = 0, ly = 0;
    if (lookAt) { lx = THREE.MathUtils.clamp((lookAt.x - hx) / (3 * S), -1, 1); ly = THREE.MathUtils.clamp((lookAt.y - hy) / (3 * S), -1, 1); }
    this.look.x += (lx - this.look.x) * Math.min(1, dt * 8); this.look.y += (ly - this.look.y) * Math.min(1, dt * 8);
    for (const e of this.eyes) {
      e.scale.y = this.happy > 0.5 ? 0.55 : blink;
      e.userData.pupil.position.x = this.look.x * 0.08; e.userData.pupil.position.y = this.look.y * 0.08;
    }
    const open = this.happy > 0.15;
    this.mouth.visible = open; this.smile.visible = !open;
    if (open) this.mouth.scale.set(0.2, 0.12 + this.happy * 0.14, 0.08);

    // blob shadow on the floor
    const lift = Math.max(0, Math.min(j.anL.y, j.anR.y) - rig.floorY);
    const sw = (2.2 * S) / (1 + lift * 0.4);
    this.shadow.position.set(j.hipC.x, rig.floorY + 0.02, 0.1); this.shadow.scale.set(sw, sw * 0.8, 1);
    this.shadow.material.opacity = 0.8 / (1 + lift * 0.6);
  }

  dispose() { this.group.removeFromParent(); for (const m of Object.values(this.mat)) m.dispose(); }
}
