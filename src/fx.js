// Juice: glowing particles, confetti, shockwave rings, floating score text, screen shake.
import * as THREE from 'three';

const MAXP = 3500, MAXC = 420, MAXR = 28;
const col = new THREE.Color();

export class FX {
  constructor(scene, camera, popupLayer) {
    this.camera = camera; this.layer = popupLayer; this.shakeAmt = 0; this.flashEl = null;
    // --- additive point particles
    this.n = 0; this.cursor = 0;
    this.pos = new Float32Array(MAXP * 3); this.colr = new Float32Array(MAXP * 3);
    this.size = new Float32Array(MAXP); this.alpha = new Float32Array(MAXP);
    this.vel = new Float32Array(MAXP * 3); this.life = new Float32Array(MAXP); this.maxLife = new Float32Array(MAXP);
    this.grav = new Float32Array(MAXP); this.drag = new Float32Array(MAXP); this.size0 = new Float32Array(MAXP);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    g.setAttribute('color', new THREE.BufferAttribute(this.colr, 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(this.size, 1));
    g.setAttribute('aAlpha', new THREE.BufferAttribute(this.alpha, 1));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e5);
    this.pmat = new THREE.ShaderMaterial({
      uniforms: { uScale: { value: 600 } }, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `attribute float aSize; attribute float aAlpha; attribute vec3 color; varying vec3 vC; varying float vA; uniform float uScale;
        void main(){ vC=color; vA=aAlpha; vec4 mv=modelViewMatrix*vec4(position,1.0); gl_PointSize=aSize*uScale/max(0.1,-mv.z); gl_Position=projectionMatrix*mv; }`,
      fragmentShader: `varying vec3 vC; varying float vA;
        void main(){ vec2 p=gl_PointCoord-0.5; float d=length(p); if(d>0.5) discard; float a=smoothstep(0.5,0.0,d); a=a*a+smoothstep(0.16,0.0,d)*0.8;
          gl_FragColor=vec4(vC*a*vA,1.0); }`,
    });
    this.points = new THREE.Points(g, this.pmat); this.points.frustumCulled = false; this.points.renderOrder = 10;
    scene.add(this.points);

    // --- confetti
    this.conf = new THREE.InstancedMesh(new THREE.PlaneGeometry(0.16, 0.26), new THREE.MeshBasicMaterial({ side: THREE.DoubleSide }), MAXC);
    this.conf.instanceMatrix.setUsage(THREE.DynamicDrawUsage); this.conf.frustumCulled = false; this.conf.count = 0;
    this.cData = []; this.dummy = new THREE.Object3D();
    scene.add(this.conf);

    // --- rings
    this.rings = [];
    const rg = new THREE.RingGeometry(0.82, 1, 48);
    for (let i = 0; i < MAXR; i++) {
      const m = new THREE.Mesh(rg, new THREE.MeshBasicMaterial({ transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide }));
      m.visible = false; m.userData = { t: 0, dur: 1, r0: 0, r1: 1 }; scene.add(m); this.rings.push(m);
    }
    this.ringI = 0;
  }

  spawn(x, y, z, vx, vy, vz, color, size, life, grav = 0, drag = 1.5) {
    const i = this.cursor; this.cursor = (this.cursor + 1) % MAXP;
    this.pos[i * 3] = x; this.pos[i * 3 + 1] = y; this.pos[i * 3 + 2] = z;
    this.vel[i * 3] = vx; this.vel[i * 3 + 1] = vy; this.vel[i * 3 + 2] = vz;
    col.set(color); this.colr[i * 3] = col.r; this.colr[i * 3 + 1] = col.g; this.colr[i * 3 + 2] = col.b;
    this.size0[i] = size; this.life[i] = life; this.maxLife[i] = life; this.grav[i] = grav; this.drag[i] = drag;
  }

  burst(p, o = {}) {
    const n = o.count ?? 24, sp = o.speed ?? 6, colors = o.colors || [o.color ?? 0xffffff];
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2, e = (Math.random() - 0.5) * (o.flat ? 0.3 : 2), s = sp * (0.35 + Math.random() * 0.65);
      this.spawn(p.x, p.y, p.z ?? 0, Math.cos(a) * s, Math.sin(a) * s + (o.up ?? 0), e * s * 0.5,
        colors[k % colors.length], (o.size ?? 0.22) * (0.5 + Math.random()), (o.life ?? 0.7) * (0.6 + Math.random() * 0.6), o.gravity ?? 4, o.drag ?? 2.2);
    }
  }
  trail(p, color, size = 0.18) {
    this.spawn(p.x + (Math.random() - 0.5) * 0.15, p.y + (Math.random() - 0.5) * 0.15, (p.z ?? 0) + 0.3, (Math.random() - 0.5) * 0.6, (Math.random() - 0.5) * 0.6, 0, color, size, 0.45, -0.5, 1);
  }
  ring(p, color, r1 = 2, dur = 0.5, r0 = 0.2) {
    const m = this.rings[this.ringI]; this.ringI = (this.ringI + 1) % MAXR;
    m.position.set(p.x, p.y, (p.z ?? 0) + 0.2); m.material.color.set(color); m.visible = true;
    m.userData = { t: 0, dur, r0, r1 };
  }
  confetti(p, count = 60, colors = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xffffff], spread = 7) {
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
  shake(a) { this.shakeAmt = Math.min(1.2, this.shakeAmt + a); }

  popup(p, text, color = '#fff', cls = '') {
    const v = new THREE.Vector3(p.x, p.y, p.z ?? 0).project(this.camera);
    const el = document.createElement('div');
    el.className = 'popup ' + cls; el.textContent = text; el.style.color = color;
    el.style.left = ((v.x * 0.5 + 0.5) * 100) + '%'; el.style.top = ((-v.y * 0.5 + 0.5) * 100) + '%';
    this.layer.appendChild(el); setTimeout(() => el.remove(), 1100);
  }

  update(dt) {
    for (let i = 0; i < MAXP; i++) {
      if (this.life[i] <= 0) { this.alpha[i] = 0; continue; }
      this.life[i] -= dt; const k = Math.max(0, this.life[i] / this.maxLife[i]);
      const d = Math.exp(-this.drag[i] * dt);
      this.vel[i * 3] *= d; this.vel[i * 3 + 1] = this.vel[i * 3 + 1] * d - this.grav[i] * dt; this.vel[i * 3 + 2] *= d;
      this.pos[i * 3] += this.vel[i * 3] * dt; this.pos[i * 3 + 1] += this.vel[i * 3 + 1] * dt; this.pos[i * 3 + 2] += this.vel[i * 3 + 2] * dt;
      this.alpha[i] = Math.min(1, k * 2.2); this.size[i] = this.size0[i] * (0.4 + 0.6 * k);
    }
    const a = this.points.geometry.attributes; a.position.needsUpdate = a.color.needsUpdate = a.aSize.needsUpdate = a.aAlpha.needsUpdate = true;

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
      if (!m.visible) continue; const u = m.userData; u.t += dt; const k = u.t / u.dur;
      if (k >= 1) { m.visible = false; continue; }
      const e = 1 - Math.pow(1 - k, 3); m.scale.setScalar(u.r0 + (u.r1 - u.r0) * e); m.material.opacity = (1 - k) * 0.9;
    }
    this.shakeAmt = Math.max(0, this.shakeAmt - dt * 2.5);
  }
  clear() { this.life.fill(0); this.cData.length = 0; for (const m of this.rings) m.visible = false; }
}
