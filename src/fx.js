// Juice, comic-book style: ink-outlined sparks, starburst impacts, shock rings,
// hand swooshes, lettering that pops out of the action, speed lines, confetti
// and screen shake. Impacts are animated "on twos" so they snap like drawings.
import * as THREE from 'three';
import { INK } from './toon.js';

const MAXC = 420, MAXR = 24, MAXB = 16;
const col = new THREE.Color();

// A pool of round particles. Glow ones add light; solid ones are flat dots with an ink edge.
class Dots {
  constructor(scene, max, solid) {
    this.max = max; this.cursor = 0;
    this.pos = new Float32Array(max * 3); this.colr = new Float32Array(max * 3); this.size = new Float32Array(max); this.alpha = new Float32Array(max);
    this.vel = new Float32Array(max * 3); this.life = new Float32Array(max); this.maxLife = new Float32Array(max);
    this.grav = new Float32Array(max); this.drag = new Float32Array(max); this.size0 = new Float32Array(max);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(this.colr, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1)); g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: solid ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: solid
        ? `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5*vA) discard; vec3 c=mix(vC, vec3(0.08,0.05,0.16), step(0.33*vA, d)); c=mix(c, vec3(1.0), step(d, 0.12*vA)); gl_FragColor=vec4(c,1.0); }`
        : `varying vec3 vC; varying float vA; void main(){ float d=length(gl_PointCoord-0.5); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); a=a*a+smoothstep(0.16,0.0,d)*0.8; gl_FragColor=vec4(vC*a*vA,1.0); }`,
    });
    this.points = new THREE.Points(g, this.mat); this.points.frustumCulled = false; this.points.renderOrder = solid ? 9 : 10; scene.add(this.points);
  }
  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 1.5) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % this.max;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z; this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    col.set(color); this.colr[i * 3] = col.r; this.colr[i * 3 + 1] = col.g; this.colr[i * 3 + 2] = col.b;
    this.size0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }
  update(dt) {
    for (let i = 0; i < this.max; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; this.size[i] = 0; continue; }
      this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.maxLife[i]), d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, k * 2.2); this.size[i] = this.size0[i] * (0.4 + 0.6 * k);
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.color.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;
  }
  clear() { this.life.fill(0); }
}

function burstShape(n, r2, jitter) {
  const s = new THREE.Shape();
  for (let i = 0; i < n * 2; i++) { const a = i / (n * 2) * Math.PI * 2, r = i % 2 ? r2 : 1 - ((i * 7) % 5) * jitter; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); }
  return new THREE.ShapeGeometry(s);
}

// A brush stroke that follows a fast hand.
class Swoosh {
  constructor(scene, color) {
    this.n = 12; this.h = []; for (let i = 0; i < this.n; i++) this.h.push({ x: 0, y: 0 });
    this.pos = new Float32Array(this.n * 6 * 3); const c = new Float32Array(this.n * 6 * 3), idx = [];
    const cols = [new THREE.Color(INK), new THREE.Color(color), new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.8)];
    for (let i = 0; i < this.n; i++) for (let k = 0; k < 6; k++) cols[k >> 1].toArray(c, (i * 6 + k) * 3);
    for (let s = 0; s < 3; s++) for (let i = 0; i < this.n - 1; i++) { const a = i * 6 + s * 2, b = a + 6; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.setIndex(idx);
    this.mesh = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, depthWrite: false })); this.mesh.frustumCulled = false; this.mesh.renderOrder = 6; this.mesh.visible = false; scene.add(this.mesh);
    this.w = 0; this.fresh = true; this.seen = 0;
  }
  push(x, y, speed, S, dt) {
    const h = this.h, n = this.n; if (this.fresh) { for (const p of h) { p.x = x; p.y = y; } this.fresh = false; this.lx = x; this.ly = y; this.acc = 0; }
    // record the path at a fixed rate so the stroke is the same length at any frame rate
    this.acc += Math.min(dt, 0.1); const steps = Math.min(n, Math.floor(this.acc * 72)); this.acc -= steps / 72;
    for (let k = 1; k <= steps; k++) { for (let i = n - 1; i > 0; i--) { h[i].x = h[i - 1].x; h[i].y = h[i - 1].y; } const u = k / steps; h[0].x = this.lx + (x - this.lx) * u; h[0].y = this.ly + (y - this.ly) * u; }
    if (steps) { this.lx = x; this.ly = y; }
    const want = THREE.MathUtils.clamp((speed - 5 * S) / (6 * S), 0, 1); this.w += (want - this.w) * Math.min(1, dt * (want > this.w ? 30 : 6));
    this.mesh.visible = this.w > 0.08; if (!this.mesh.visible) return;
    const pos = this.pos, W = 0.13 * S * this.w, z = 0.5;
    for (let i = 0; i < n; i++) {
      const a = h[Math.max(0, i - 1)], b = h[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const u = i / (n - 1), w = W * Math.pow(1 - u, 1.25) * Math.min(1, u * 5 + 0.45), nx = -ty, ny = tx, j = i * 18, ink = Math.min(0.03, w * 0.5);
      const hx = i ? h[i].x : x, hy = i ? h[i].y : y;
      const put = (k, off, zz) => { pos[j + k * 3] = hx + nx * off; pos[j + k * 3 + 1] = hy + ny * off; pos[j + k * 3 + 2] = zz; };
      put(0, -w - ink, z); put(1, w + ink, z); put(2, -w, z + 0.01); put(3, w, z + 0.01); put(4, -w * 0.3, z + 0.02); put(5, w * 0.45, z + 0.02);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

export class FX {
  constructor(scene, camera, popupLayer) {
    this.scene = scene; this.camera = camera; this.layer = popupLayer; this.shakeAmt = 0; this.stopT = 0; this.flashAmt = 0; this.clock = 0;
    this.glow = new Dots(scene, 1800, false); this.solid = new Dots(scene, 1400, true);
    const self = this; this.pmat = { uniforms: { uScale: { set value(v) { self.glow.mat.uniforms.uScale.value = v; self.solid.mat.uniforms.uScale.value = v; }, get value() { return self.glow.mat.uniforms.uScale.value; } } } };
    this.zoomEl = document.getElementById('zoom');

    // --- confetti
    this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.17, 0.28), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAXC);
    this.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.conf.frustumCulled = false; this.conf.count = 0;
    this.cData = []; this.dummy = new THREE.Object3D(); scene.add(this.conf);

    // --- shock rings: a flat coloured band with ink on both edges
    this.rings = []; const rg = new THREE.RingGeometry(0.925, 1, 48), rk = new THREE.RingGeometry(0.9, 1.028, 48);
    for (let i = 0; i < MAXR; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, side: THREE.DoubleSide }));
      const k = new THREE.Mesh(rk, new THREE.MeshBasicMaterial({ color: INK, transparent: true, depthWrite: false, side: THREE.DoubleSide })); k.position.z = -0.01; m.add(k);
      m.visible = false; m.renderOrder = 7; k.renderOrder = 6; m.userData = { t: 0, dur: 1, r0: 0, r1: 1, ink: k }; scene.add(m); this.rings.push(m);
    }
    this.ringI = 0;

    // --- starburst impacts
    this.bursts = []; const bg = [burstShape(9, 0.5, 0.06), burstShape(12, 0.62, 0.04)];
    for (let i = 0; i < MAXB; i++) {
      const g = new THREE.Group(); const geo = bg[i % 2];
      const ink = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: INK, depthWrite: false })); ink.scale.setScalar(1.16);
      const mid = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ depthWrite: false })); mid.position.z = 0.01;
      const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color: 0xffffff, depthWrite: false })); core.position.z = 0.02; core.scale.setScalar(0.55); core.rotation.z = 0.3;
      g.add(ink, mid, core); g.visible = false; g.userData = { t: 0, size: 1, mid }; g.traverse(o => { o.renderOrder = 8; }); scene.add(g); this.bursts.push(g);
    }
    this.burstI = 0;
    this.swooshes = new Map();
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 1.5) { this.glow.spawn(x, y, z, vx, vy, vz, color, size, life, grav, drag); }
  // A spray of sparks. Most are flat inked dots, a few glow.
  burst(p, o = {}) {
    const n = o.count ?? 24, sp = o.speed ?? 6, colors = o.colors || [o.color ?? 0xffffff], solid = o.solid ?? 0.6;
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * (o.flat ? 0.3 : 2), s = sp * (0.35 + Math.random() * 0.65), isSolid = Math.random() < solid;
      (isSolid ? this.solid : this.glow).spawn(p.x, p.y, (p.z ?? 0) + (isSolid ? 0.2 : 0), Math.cos(a) * s, Math.sin(a) * s + (o.up ?? 0), e * s * 0.5,
        colors[k % colors.length], (o.size ?? 0.22) * (0.5 + Math.random()) * (isSolid ? 1.25 : 1), (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), o.gravity ?? 4, o.drag ?? 2.2);
    }
  }
  trail(p, color, size = 0.18) {
    this.glow.spawn(p.x + (Math.random() - 0.5) * 0.15, p.y + (Math.random() - 0.5) * 0.15, (p.z ?? 0) + 0.3, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0, color, size, 0.45, -0.5, 1);
  }
  ring(p, color, r1 = 2, dur = 0.5, r0 = 0.2) {
    const m = this.rings[this.ringI]; this.ringI = (this.ringI + 1) % MAXR;
    m.position.set(p.x, p.y, (p.z ?? 0) + 0.2); m.material.color.set(color); m.visible = true; m.userData.t = 0; m.userData.dur = dur; m.userData.r0 = r0; m.userData.r1 = r1;
  }
  // The classic comic impact: a jagged starburst that snaps in and out.
  pow(p, color = 0xffd23f, size = 1) {
    const g = this.bursts[this.burstI]; this.burstI = (this.burstI + 1) % MAXB;
    g.position.set(p.x, p.y, (p.z ?? 0) + 0.35); g.rotation.z = Math.random() * 6.28; g.userData.t = 0; g.userData.size = size; g.userData.mid.material.color.set(color); g.visible = true; g.scale.setScalar(size * 0.5);
  }
  // Brush-stroke trail for one hand. Call every frame with the hand position.
  swoosh(id, p, color, speed, S, dt) {
    let s = this.swooshes.get(id); if (!s) { s = new Swoosh(this.scene, color); this.swooshes.set(id, s); }
    s.seen = this.clock; s.push(p.x, p.y, speed, S, dt);
  }
  confetti(p, count = 60, colors = [0xff4d6d, 0x19c9c0, 0xffc21a, 0x9a5bff, 0xffffff], spread = 7) {
    for (let k = 0; k < count; k++) {
      if (this.cData.length >= MAXC) this.cData.shift();
      const a = Math.random() * Math.PI * 2, s = spread * (0.3 + Math.random() * 0.7);
      this.cData.push({ x: p.x, y: p.y, z: (p.z ?? 0) + Math.random(), vx: Math.cos(a) * s, vy: Math.abs(Math.sin(a)) * s + 3, vz: (Math.random() - 0.5) * 3,
        rx: Math.random() * 6, ry: Math.random() * 6, sx: (Math.random() - 0.5) * 14, sy: (Math.random() - 0.5) * 14, life: 2.6 + Math.random() * 1.5, c: colors[k % colors.length] });
    }
  }
  rain(dt, w = 8) { // gentle confetti from the top of the screen
    this.rainAcc = (this.rainAcc || 0) + dt * 30;
    while (this.rainAcc > 1) { this.rainAcc--; this.confetti({ x: (Math.random() - 0.5) * 2 * w, y: 5.5, z: 0 }, 1, undefined, 1.5); }
  }
  // A rocket that bursts into a ring of sparks, for the results screen.
  firework(x, y, color) {
    const p = { x, y, z: -2 }; this.pow(p, color, 1.5); this.ring(p, color, 3.2, 0.7, 0.4);
    for (let k = 0; k < 26; k++) { const a = k / 26 * Math.PI * 2, s = 6 + (k % 2) * 2.5; this.solid.spawn(x, y, -2, Math.cos(a) * s, Math.sin(a) * s, 0, k % 3 ? color : 0xffffff, 0.32, 1.1, 3.5, 1.6); }
    for (let k = 0; k < 16; k++) { const a = Math.random() * 6.28, s = 3 + Math.random() * 4; this.glow.spawn(x, y, -2, Math.cos(a) * s, Math.sin(a) * s, 0, color, 0.3, 0.9, 3, 1.6); }
  }
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }
  hitstop(sec = 0.07) { this.stopT = Math.max(this.stopT, sec); }
  flash(a = 0.18) { this.flashAmt = Math.max(this.flashAmt, Math.min(0.25, a)); }
  speedLines() { const z = this.zoomEl; if (!z) return; z.classList.remove('go'); void z.offsetWidth; z.classList.add('go'); }

  popup(p, text, color = '#fff', cls = '') {
    const v = new THREE.Vector3(p.x, p.y, p.z ?? 0).project(this.camera);
    const el = document.createElement('div');
    el.className = 'popup ' + cls; el.textContent = text; el.style.color = color; el.style.setProperty('--r', ((Math.random() - 0.5) * 16).toFixed(1) + 'deg');
    el.style.left = ((v.x * 0.5 + 0.5) * 100) + '%'; el.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%';
    this.layer.appendChild(el); setTimeout(() => el.remove(), 1100); return el;
  }
  // Lettering on a starburst: POW! ZAP! CRASH!
  word(p, text, color = '#ffd23f', burst = '#fff') { const el = this.popup({ x: THREE.MathUtils.clamp(p.x, -6.6, 6.6), y: THREE.MathUtils.clamp(p.y, -3, 3.2), z: p.z }, text, color, 'word'); el.style.setProperty('--bc', burst); return el; }

  update(dt) {
    this.clock += dt; this.stopT = Math.max(0, this.stopT - dt); this.flashAmt = Math.max(0, this.flashAmt - dt * 1.6);
    this.glow.update(dt); this.solid.update(dt);
    let n = 0;
    for (let i = this.cData.length - 1; i >= 0; i--) {
      const c = this.cData[i]; c.life -= dt; if (c.life <= 0) { this.cData.splice(i, 1); continue; }
      c.vx *= Math.exp(-1.6 * dt); c.vy = c.vy * Math.exp(-1.6 * dt) - 5 * dt; c.x += c.vx * dt + Math.sin(c.life * 5 + c.rx) * dt; c.y += c.vy * dt; c.z += c.vz * dt;
      c.rx += c.sx * dt; c.ry += c.sy * dt;
    }
    for (const c of this.cData) {
      this.dummy.position.set(c.x, c.y, c.z); this.dummy.rotation.set(c.rx, c.ry, 0); this.dummy.scale.setScalar(Math.min(1, c.life * 2));
      this.dummy.updateMatrix(); this.conf.setMatrixAt(n, this.dummy.matrix); this.conf.setColorAt(n, col.set(c.c)); n++;
    }
    this.conf.count = n; this.conf.instanceMatrix.needsUpdate = true; if (this.conf.instanceColor) this.conf.instanceColor.needsUpdate = true;

    for (const m of this.rings) {
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = Math.floor(u.t / u.dur * 7) / 7; // on twos
      if (u.t >= u.dur) { m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(u.r0 + (u.r1 - u.r0) * e); m.material.opacity = u.ink.material.opacity = k > 0.7 ? 0.45 : 1;
    }
    for (const g of this.bursts) {
      if (!g.visible) continue; const u = g.userData; u.t += dt; const f = Math.floor(u.t * 14);
      if (f > 3) { g.visible = false; continue; }
      g.scale.setScalar(u.size * [0.55, 1.25, 1.0, 0.8][f]); if (f === 2) g.rotation.z += 0.02;
    }
    for (const [id, s] of this.swooshes) if (this.clock - s.seen > 0.2) { s.mesh.visible = false; s.fresh = true; s.w = 0; }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
  }
  clear() { this.glow.clear(); this.solid.clear(); this.cData.length = 0; for (const m of this.rings) m.visible = false; for (const g of this.bursts) g.visible = false; }
}
