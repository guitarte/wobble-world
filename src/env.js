// Worlds: one animated 3D backdrop per game, with a shared sky and lighting rig.
import * as THREE from 'three';
import { EXTRAS } from './env-extras.js';
import { sceneToon, inkGroup, TOON } from './toon.js';

const C = (h) => new THREE.Color(h);
const rnd = (a, b) => a + Math.random() * (b - a);
const std = sceneToon;
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
const sph = new THREE.SphereGeometry(1, 24, 16);
function glowTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.35, 'rgba(255,255,255,.55)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
}
let GLOW = null; const glow = () => (GLOW = GLOW || glowTex());
// a comic bubble: an ink ring with a white shine
function bubbleTex() {
  const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d');
  g.fillStyle = 'rgba(190,245,255,.55)'; g.beginPath(); g.arc(32, 32, 24, 0, 7); g.fill(); g.lineWidth = 7; g.strokeStyle = '#140c2a'; g.stroke();
  g.strokeStyle = '#fff'; g.lineWidth = 5; g.lineCap = 'round'; g.beginPath(); g.arc(32, 32, 15, 3.5, 4.6); g.stroke();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; return t;
}

const THEMES = {
  meadow: { top: 0x1f7dff, mid: 0x62bcff, bot: 0xc9ecff, fog: 0xa9dcff, far: 260, stars: 0, hemi: [0xdff1ff, 0x86c96a, 0.45], sun: [0xfff0d0, 1.05], exposure: 1.0 },
  reef: { top: 0x04205f, mid: 0x0c69ad, bot: 0x22cfc4, fog: 0x0d73a8, far: 75, stars: 0, hemi: [0x9fe8ff, 0x1a6a8a, 0.5], sun: [0xcffcff, 0.72], exposure: 1.05 },
  neon: { top: 0x04010d, mid: 0x2a0a52, bot: 0xff4a9e, fog: 0x1b0638, far: 130, stars: 1, hemi: [0xb48cff, 0x27124a, 0.60], sun: [0xff9ad5, 0.99], exposure: 1.0 },
  space: { top: 0x01020c, mid: 0x100a33, bot: 0x35186a, fog: 0x0a0624, far: 200, stars: 1.6, hemi: [0xa9b8ff, 0x24104a, 0.60], sun: [0xcfe0ff, 1.24], exposure: 1.0 },
  stage: { top: 0x05020c, mid: 0x180735, bot: 0x3a0f5e, fog: 0x12052a, far: 110, stars: 0.25, hemi: [0xd0b8ff, 0x2a1050, 0.65], sun: [0xffffff, 1.05], exposure: 1.0 },
};

export class Environment {
  constructor(scene) {
    this.scene = scene; this.name = null; this.groups = {}; this.updaters = {}; this.floorY = -3.7; this.accent = C(0xff4fa3); this.beatPulse = 0;
    this.u = { uTop: { value: C(0x2f8fff) }, uMid: { value: C(0x8fd3ff) }, uBot: { value: C(0xfff1cf) }, uStars: { value: 0 }, uTime: { value: 0 }, uDot: TOON.uDot };
    this.sky = new THREE.Mesh(new THREE.SphereGeometry(400, 32, 20), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.u,
      vertexShader: `varying vec3 vD; void main(){ vD=normalize(position); gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vD; uniform vec3 uTop,uMid,uBot; uniform float uStars,uTime,uDot;
        float h(vec2 p){ return fract(sin(dot(p,vec2(127.1,311.7)))*43758.5453); }
        // one colour gives way to the next through a field of growing dots, like printed screentone
        float tone(float k, float size){ vec2 p=mat2(0.7071,-0.7071,0.7071,0.7071)*gl_FragCoord.xy/(uDot*size); float d=length(fract(p)-0.5); float r=clamp(k,0.0,1.0)*0.74; return 1.0-smoothstep(r-0.04,r+0.04,d); }
        void main(){ vec3 d=normalize(vD); float y=d.y;
          vec3 c=mix(uMid,uBot,tone(1.0-smoothstep(-0.08,0.2,y),2.6));
          c=mix(c,uTop,1.0-tone(1.0-smoothstep(0.12,0.62,y),3.4));
          vec2 g=vec2(atan(d.x,-d.z)*60.0, y*90.0); vec2 id=floor(g); vec2 f=fract(g)-0.5; float r=h(id);
          float tw=0.5+0.5*sin(uTime*(1.0+r*3.0)+r*40.0);
          float s=step(0.93,r)*max(smoothstep(0.2,0.05,length(f)), smoothstep(0.03,0.0,min(abs(f.x),abs(f.y)))*smoothstep(0.45,0.1,length(f))*step(0.975,r))*tw;
          c+=vec3(s)*uStars*smoothstep(-0.05,0.25,y);
          gl_FragColor=vec4(c,1.0); }`,
    }));
    this.sky.renderOrder = -10; scene.add(this.sky);
    this.hemi = new THREE.HemisphereLight(0xffffff, 0x888888, 1.4); scene.add(this.hemi);
    this.sun = new THREE.DirectionalLight(0xffffff, 2.2); this.sun.position.set(4, 9, 8); scene.add(this.sun);
    this.rim = new THREE.DirectionalLight(0xffffff, 0.5); this.rim.position.set(-6, 3, -6); scene.add(this.rim);
    scene.fog = new THREE.Fog(0xcfeaff, 30, 150);
    this.target = THEMES.meadow;
  }

  set(name, accent) {
    if (accent !== undefined) this.accent.set(accent);
    if (this.name === name) return;
    this.name = name; this.target = THEMES[name];
    if (!this.groups[name]) { const g = new THREE.Group(); this.groups[name] = g; this.scene.add(g); const a = this['build_' + name](g) || (() => {}), b = EXTRAS[name] ? EXTRAS[name](g, this) : null; this.updaters[name] = b ? (dt, t) => { a(dt, t); b(dt, t); } : a; inkGroup(g); }
    for (const k in this.groups) this.groups[k].visible = k === name;
    // snap colours on change (the screen wipe hides it)
    const T = this.target; this.u.uTop.value.set(T.top); this.u.uMid.value.set(T.mid); this.u.uBot.value.set(T.bot); this.u.uStars.value = T.stars;
    this.scene.fog.color.set(T.fog); this.scene.fog.far = T.far; this.scene.fog.near = T.far * 0.3;
    this.hemi.color.set(T.hemi[0]); this.hemi.groundColor.set(T.hemi[1]); this.hemi.intensity = T.hemi[2];
    this.sun.color.set(T.sun[0]); this.sun.intensity = T.sun[1]; this.rim.color.set(T.bot);
  }

  update(dt, t, floorY, beat = 0) {
    this.u.uTime.value = t;
    this.floorY += (floorY - this.floorY) * Math.min(1, dt * 2);
    const g = this.groups[this.name]; if (!g) return;
    g.position.y = this.floorY;
    this.beat = beat; this.beatPulse = Math.pow(1 - (beat % 1), 3);
    this.updaters[this.name](dt, t);
  }

  // ---------------------------------------------------------------- meadow
  build_meadow(g) {
    const ground = new THREE.Mesh(new THREE.PlaneGeometry(500, 300), std(0x7fdc5c)); ground.rotation.x = -Math.PI / 2; ground.position.z = -100; g.add(ground);
    const pad = new THREE.Mesh(new THREE.CircleGeometry(11, 64), std(0xa6ee7a, { roughness: 0.6 })); pad.rotation.x = -Math.PI / 2; pad.position.set(0, 0.02, -1); g.add(pad);
    const hillCols = [0x63cf5a, 0x52c16a, 0x7fdd68, 0x49b877];
    for (let i = 0; i < 9; i++) { const m = new THREE.Mesh(sph, std(hillCols[i % 4])); const r = rnd(14, 30); m.scale.set(r * 1.6, r * 0.6, r); m.position.set((i - 4) * 22 + rnd(-6, 6), -r * 0.12, rnd(-95, -45)); g.add(m); }
    // trees
    for (let i = 0; i < 16; i++) {
      const tr = new THREE.Group(); const s = rnd(1.4, 2.6);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.28, 1.6, 8), std(0x9a6b4b)); trunk.position.y = 0.8; tr.add(trunk);
      const cols = [0x35b86b, 0x2fa863, 0xff8fb3, 0xffd166];
      for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(sph, std(cols[(i + (k === 2 ? i % 2 * 2 : 0)) % 4], { roughness: 0.7 })); b.scale.setScalar(rnd(0.8, 1.15)); b.position.set(rnd(-0.5, 0.5), 2 + k * 0.5, rnd(-0.3, 0.3)); tr.add(b); }
      const side = i % 2 ? 1 : -1; tr.position.set(side * rnd(10, 34), 0, rnd(-40, -6)); tr.scale.setScalar(s); g.add(tr);
    }
    const clouds = [];
    for (let i = 0; i < 9; i++) {
      const c = new THREE.Group(); const m = basic(0xffffff, { fog: false });
      for (let k = 0; k < 5; k++) { const b = new THREE.Mesh(sph, m); b.scale.set(rnd(2, 3.6), rnd(1.3, 2), rnd(1.5, 2.4)); b.position.set((k - 2) * 2.1, rnd(-0.3, 0.6), rnd(-1, 1)); c.add(b); }
      c.position.set(rnd(-70, 70), rnd(14, 30), rnd(-110, -55)); c.userData.v = rnd(0.5, 1.4); g.add(c); clouds.push(c);
    }
    const balloons = [], bc = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xff9248];
    for (let i = 0; i < 10; i++) {
      const b = new THREE.Group(); const m = new THREE.Mesh(sph, std(bc[i % 5])); m.scale.set(0.9, 1.1, 0.9); b.add(m);
      const s = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.015, 2.4), basic(0xffffff)); s.position.y = -2.2; b.add(s);
      b.position.set(rnd(-22, 22), rnd(6, 14), rnd(-30, -8)); b.userData = { y: b.position.y, p: rnd(0, 6) }; g.add(b); balloons.push(b);
    }
    return (dt, t) => {
      for (const c of clouds) { c.position.x += c.userData.v * dt; if (c.position.x > 90) c.position.x = -90; }
      for (const b of balloons) { b.position.y = b.userData.y + Math.sin(t * 0.7 + b.userData.p) * 0.8; b.rotation.z = Math.sin(t * 0.5 + b.userData.p) * 0.1; }
    };
  }

  // ---------------------------------------------------------------- reef
  build_reef(g) {
    const sand = new THREE.Mesh(new THREE.PlaneGeometry(300, 200), std(0xf1dfa6)); sand.rotation.x = -Math.PI / 2; sand.position.z = -70; g.add(sand);
    const cc = [0xff6b9a, 0xff9d47, 0xa77bff, 0x37e0c8, 0xffd84a];
    for (let i = 0; i < 26; i++) {
      const cl = new THREE.Group(); const m = std(cc[i % 5], { roughness: 0.55 });
      const n = 3 + (i % 4);
      for (let k = 0; k < n; k++) {
        if (i % 3 === 0) { const b = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.3, rnd(1.2, 3), 8), m); b.position.set(rnd(-0.8, 0.8), 0.8, rnd(-0.6, 0.6)); b.rotation.z = rnd(-0.5, 0.5); cl.add(b); const tip = new THREE.Mesh(sph, m); tip.scale.setScalar(0.3); tip.position.copy(b.position).add(new THREE.Vector3(-Math.sin(b.rotation.z) * 1, 1, 0)); cl.add(tip); }
        else { const b = new THREE.Mesh(sph, m); b.scale.setScalar(rnd(0.5, 1.1)); b.position.set(rnd(-1, 1), rnd(0.2, 0.9), rnd(-0.8, 0.8)); cl.add(b); }
      }
      const side = i % 2 ? 1 : -1; cl.position.set(side * rnd(3, 30), 0, rnd(-34, -3)); cl.scale.setScalar(rnd(1, 2.2)); g.add(cl);
    }
    const weeds = [];
    for (let i = 0; i < 34; i++) {
      const piv = new THREE.Group(); const hgt = rnd(3, 8);
      const geo = new THREE.CylinderGeometry(0.04, 0.3, hgt, 6, 6); geo.translate(0, hgt / 2, 0);
      const w = new THREE.Mesh(geo, std(i % 3 ? 0x2fbf71 : 0x1f9d8a, { roughness: 0.6 })); piv.add(w);
      piv.position.set(rnd(-34, 34), 0, rnd(-40, -2)); if (Math.abs(piv.position.x) < 6) piv.position.z -= 12; piv.userData.p = rnd(0, 6); g.add(piv); weeds.push(piv);
    }
    const shafts = [];
    for (let i = 0; i < 7; i++) { const s = new THREE.Mesh(new THREE.PlaneGeometry(rnd(3, 6), 60), add(0x9ff5ff, 0.07)); s.position.set((i - 3) * 9, 18, rnd(-30, -12)); s.rotation.z = 0.3; s.material.fog = false; g.add(s); shafts.push(s); }
    const N = 160, pos = new Float32Array(N * 3); for (let i = 0; i < N; i++) { pos[i * 3] = rnd(-30, 30); pos[i * 3 + 1] = rnd(0, 26); pos[i * 3 + 2] = rnd(-35, 2); }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const bub = new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, map: bubbleTex(), transparent: true, alphaTest: 0.4, depthWrite: false })); g.add(bub);
    const fish = [];
    for (let i = 0; i < 14; i++) {
      const f = new THREE.Group(); const m = std(cc[(i + 1) % 5], { roughness: 0.4 });
      const b = new THREE.Mesh(sph, m); b.scale.set(0.6, 0.36, 0.2); f.add(b);
      const tl = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.5, 4), m); tl.rotation.z = -Math.PI / 2; tl.position.x = -0.75; tl.scale.z = 0.3; f.add(tl); f.userData.tail = tl;
      const e = new THREE.Mesh(sph, basic(0x111122)); e.scale.setScalar(0.06); e.position.set(0.35, 0.08, 0.18); f.add(e);
      f.userData.dir = i % 2 ? 1 : -1; f.userData.v = rnd(1.5, 3.5); f.userData.y = rnd(4, 16); f.userData.p = rnd(0, 6);
      f.position.set(rnd(-40, 40), f.userData.y, rnd(-30, -8)); f.scale.set(f.userData.dir * rnd(1, 1.8), rnd(1, 1.8), 1.4); g.add(f); fish.push(f);
    }
    return (dt, t) => {
      for (const w of weeds) { w.rotation.z = Math.sin(t * 1.1 + w.userData.p) * 0.16; w.rotation.x = Math.cos(t * 0.8 + w.userData.p) * 0.08; }
      shafts.forEach((s, i) => { s.rotation.z = 0.3 + Math.sin(t * 0.3 + i) * 0.06; s.material.opacity = 0.05 + 0.03 * Math.sin(t * 0.7 + i * 2); });
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] += dt * (0.8 + (i % 5) * 0.3); pos[i * 3] += Math.sin(t * 2 + i) * dt * 0.3; if (pos[i * 3 + 1] > 26) pos[i * 3 + 1] = 0; }
      bg.attributes.position.needsUpdate = true;
      for (const f of fish) { f.position.x += f.userData.dir * f.userData.v * dt; f.position.y = f.userData.y + Math.sin(t + f.userData.p) * 0.6; f.userData.tail.rotation.y = Math.sin(t * 9 + f.userData.p) * 0.5; if (Math.abs(f.position.x) > 45) f.position.x = -f.userData.dir * 45; }
    };
  }

  // ---------------------------------------------------------------- neon
  build_neon(g) {
    const gu = { uTime: { value: 0 }, uA: { value: C(0x23e6ff) }, uB: { value: C(0xff3fa4) } };
    const grid = new THREE.Mesh(new THREE.PlaneGeometry(260, 260), new THREE.ShaderMaterial({
      uniforms: gu, vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform float uTime; uniform vec3 uA,uB;
        void main(){ vec2 p=vec2(vP.x, vP.z+uTime*14.0)/2.0; vec2 f=abs(fract(p)-0.5); vec2 w=fwidth(p)*1.5;
          float l=max(smoothstep(0.5-w.x-0.03,0.5,f.x), smoothstep(0.5-w.y-0.03,0.5,f.y));
          float d=clamp(-vP.z/110.0,0.0,1.0); vec3 c=mix(uA,uB,d)*l*(1.5-d); c+=vec3(0.03,0.0,0.07);
          float lane=smoothstep(8.6,8.0,abs(vP.x)); c+=uA*0.06*lane;
          gl_FragColor=vec4(mix(c,vec3(0.1,0.02,0.2),d*d),1.0); }`,
    }));
    grid.rotation.x = -Math.PI / 2; grid.position.z = -110; g.add(grid);
    const sun = new THREE.Mesh(new THREE.CircleGeometry(30, 64), new THREE.ShaderMaterial({
      fog: false, transparent: true, vertexShader: `varying vec2 vU; void main(){ vU=uv; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vU; void main(){ vec3 c=mix(vec3(1.0,0.2,0.6),vec3(1.0,0.85,0.25),vU.y); float s=step(0.5,fract(vU.y*14.0-0.2))+step(0.55,vU.y); gl_FragColor=vec4(c*1.25,min(1.0,s)); }`,
    }));
    sun.position.set(0, 17, -200); g.add(sun);
    for (let i = 0; i < 16; i++) { // mountains with neon edges
      const h = rnd(8, 22), geo = new THREE.ConeGeometry(rnd(8, 14), h, 4);
      const m = new THREE.Mesh(geo, basic(0x12052b)); const side = i % 2 ? 1 : -1; m.position.set(side * rnd(22, 80), h / 2, rnd(-170, -60)); m.rotation.y = rnd(0, 1); g.add(m);
      const e = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: i % 2 ? 0x23e6ff : 0xff3fa4 })); m.add(e);
    }
    const pyl = [];
    for (let i = 0; i < 20; i++) {
      const side = i % 2 ? 1 : -1; const p = new THREE.Mesh(new THREE.BoxGeometry(0.5, 7, 0.5), basic(i % 4 < 2 ? 0x23e6ff : 0xff3fa4));
      p.position.set(side * 11.5, 3.5, -Math.floor(i / 2) * 12); g.add(p); pyl.push(p);
      const cap = new THREE.Mesh(new THREE.BoxGeometry(2.2, 0.3, 0.5), p.material); cap.position.set(-side * 0.85, 3.5, 0); p.add(cap);
    }
    return (dt, t) => { gu.uTime.value = t; for (const p of pyl) { p.position.z += dt * 14; if (p.position.z > 12) p.position.z -= 120; } };
  }

  // ---------------------------------------------------------------- space
  build_space(g) {
    const du = { uTime: { value: 0 }, uA: { value: C(0x4fd8ff) }, uB: { value: C(0x9d6bff) } };
    const deck = new THREE.Mesh(new THREE.CircleGeometry(26, 96), new THREE.ShaderMaterial({
      uniforms: du, transparent: true, vertexShader: `varying vec2 vU; void main(){ vU=uv-0.5; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec2 vU; uniform float uTime; uniform vec3 uA,uB;
        void main(){ float r=length(vU)*2.0; float a=atan(vU.y,vU.x); float rings=smoothstep(0.46,0.5,abs(fract(r*7.0-uTime*0.25)-0.5));
          float spokes=smoothstep(0.47,0.5,abs(fract(a*12.0/6.2832)-0.5)); float l=max(rings,spokes*0.6);
          vec3 c=mix(uA,uB,r)*l*1.3+vec3(0.02,0.02,0.08); gl_FragColor=vec4(c,(1.0-smoothstep(0.75,1.0,r))*0.92); }`,
    }));
    deck.rotation.x = -Math.PI / 2; deck.position.z = -6; g.add(deck);
    // ringed planet
    const pc = document.createElement('canvas'); pc.width = 8; pc.height = 128; const px = pc.getContext('2d');
    const bands = ['#ffb36b', '#ff8f6b', '#ffd59a', '#f7a15c', '#ffe2b8', '#e97f5f', '#ffc98a'];
    for (let y = 0; y < 128; y++) { px.fillStyle = bands[Math.floor((y / 128) * 14 + Math.sin(y * 0.3) * 0.8) % bands.length] || bands[0]; px.fillRect(0, y, 8, 1); }
    const ptex = new THREE.CanvasTexture(pc); ptex.colorSpace = THREE.SRGBColorSpace;
    const planet = new THREE.Mesh(new THREE.SphereGeometry(20, 48, 32), std(0xffffff, { map: ptex, fog: false })); planet.position.set(-34, 26, -120); planet.rotation.z = 0.35; g.add(planet);
    const ring = new THREE.Mesh(new THREE.RingGeometry(26, 38, 96), new THREE.MeshBasicMaterial({ color: 0xffe2b8, transparent: true, opacity: 0.55, side: THREE.DoubleSide, fog: false })); ring.rotation.x = Math.PI / 2 - 0.25; planet.add(ring);
    const moon = new THREE.Mesh(sph, std(0x9fd0ff, { fog: false })); moon.scale.setScalar(5); moon.position.set(42, 34, -130); g.add(moon);
    const rock = new THREE.IcosahedronGeometry(1, 0), rocks = new THREE.InstancedMesh(rock, std(0x8a7fb5), 40);
    const rd = []; const d = new THREE.Object3D();
    for (let i = 0; i < 40; i++) rd.push({ x: rnd(-60, 60), y: rnd(2, 40), z: rnd(-110, -25), s: rnd(0.5, 2.6), r: rnd(0, 6), v: rnd(0.2, 1) });
    g.add(rocks);
    // nebula puffs
    for (let i = 0; i < 7; i++) { const m = add([0xff4fa3, 0x4fd8ff, 0x9d6bff][i % 3], 0.16); m.map = glow(); m.fog = false; const n = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), m); n.scale.set(rnd(70, 130), rnd(40, 70), 1); n.position.set(rnd(-110, 110), rnd(5, 60), -190); g.add(n); }
    return (dt, t) => {
      du.uTime.value = t; planet.rotation.y += dt * 0.03;
      rd.forEach((r, i) => { r.x += r.v * dt; if (r.x > 60) r.x = -60; d.position.set(r.x, r.y, r.z); d.rotation.set(r.r + t * r.v * 0.4, r.r + t * 0.2, 0); d.scale.setScalar(r.s); d.updateMatrix(); rocks.setMatrixAt(i, d.matrix); });
      rocks.instanceMatrix.needsUpdate = true;
    };
  }

  // ---------------------------------------------------------------- stage
  build_stage(g) {
    const fu = { uBeat: { value: 0 }, uAccent: { value: this.accent }, uPulse: { value: 0 } };
    const floor = new THREE.Mesh(new THREE.PlaneGeometry(60, 44), new THREE.ShaderMaterial({
      uniforms: fu, vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform float uBeat,uPulse; uniform vec3 uAccent;
        float h(vec2 p){ return fract(sin(dot(p,vec2(12.9898,78.233)))*43758.5453); }
        void main(){ vec2 p=vP.xz/2.0; vec2 id=floor(p); vec2 f=fract(p); float edge=smoothstep(0.0,0.06,f.x)*smoothstep(1.0,0.94,f.x)*smoothstep(0.0,0.06,f.y)*smoothstep(1.0,0.94,f.y);
          float r=h(id+floor(uBeat)); float on=step(0.62,r); vec3 pal=mix(uAccent,vec3(0.2,0.85,1.0),h(id*1.7+floor(uBeat*0.5)));
          vec3 c=mix(vec3(0.05,0.02,0.1), pal*(0.35+0.9*uPulse), on)*edge + vec3(0.02,0.01,0.04);
          float fade=clamp(-vP.z/40.0,0.0,1.0); gl_FragColor=vec4(mix(c,vec3(0.07,0.02,0.16),fade),1.0); }`,
    }));
    floor.rotation.x = -Math.PI / 2; floor.position.z = -14; g.add(floor);
    const wall = new THREE.Mesh(new THREE.PlaneGeometry(90, 40), basic(0x0c0420)); wall.position.set(0, 20, -36); g.add(wall);
    const NB = 30, bars = new THREE.InstancedMesh(new THREE.BoxGeometry(1.3, 1, 0.6), new THREE.MeshBasicMaterial(), NB); const d = new THREE.Object3D(); const bc = new THREE.Color();
    g.add(bars);
    const spots = [];
    for (let i = 0; i < 6; i++) {
      const geo = new THREE.ConeGeometry(4.5, 34, 24, 1, true); geo.translate(0, -17, 0);
      const s = new THREE.Mesh(geo, add(0xffffff, 0.09)); s.position.set((i - 2.5) * 9, 30, -18 - (i % 2) * 8); s.userData.p = i * 1.3; g.add(s); spots.push(s);
    }
    const ball = new THREE.Mesh(new THREE.IcosahedronGeometry(2.2, 2), std(0xd8d8ff)); ball.position.set(0, 11.2, -12); g.add(ball);
    const N = 220, pos = new Float32Array(N * 3), seed = []; for (let i = 0; i < N; i++) seed.push([rnd(0, 6.28), rnd(-1, 1), rnd(10, 34), rnd(0.2, 0.7)]);
    const dg = new THREE.BufferGeometry(); dg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const dots = new THREE.Points(dg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.6, map: glow(), transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false })); g.add(dots);
    const truss = new THREE.Mesh(new THREE.BoxGeometry(70, 0.6, 0.6), basic(0x241040)); truss.position.set(0, 30, -18); g.add(truss);
    return (dt, t) => {
      fu.uBeat.value = this.beat; fu.uPulse.value = this.beatPulse;
      const white = new THREE.Color(0x22d8ff);
      for (let i = 0; i < NB; i++) {
        const h = 2 + (0.5 + 0.5 * Math.sin(i * 1.7 + Math.floor(this.beat * 2) * 2.3)) * 11 * (0.45 + 0.55 * this.beatPulse) + Math.sin(t * 5 + i) * 0.5;
        d.position.set((i - NB / 2 + 0.5) * 1.75, h / 2, -34); d.scale.set(1, h, 1); d.updateMatrix(); bars.setMatrixAt(i, d.matrix);
        bars.setColorAt(i, bc.copy(this.accent).lerp(white, i / NB).multiplyScalar(0.9));
      }
      bars.instanceMatrix.needsUpdate = true; if (bars.instanceColor) bars.instanceColor.needsUpdate = true;
      spots.forEach((s, i) => { s.rotation.z = Math.sin(t * 0.9 + s.userData.p) * 0.5; s.rotation.x = 0.25 + Math.cos(t * 0.7 + s.userData.p) * 0.2; s.material.color.copy(i % 2 ? this.accent : white); s.material.opacity = 0.06 + 0.07 * this.beatPulse; });
      ball.rotation.y = t * 0.5;
      for (let i = 0; i < N; i++) { const s = seed[i], a = s[0] + t * s[3]; pos[i * 3] = Math.cos(a) * s[2]; pos[i * 3 + 1] = 12 + s[1] * 12 + Math.sin(a * 2) * 2; pos[i * 3 + 2] = -14 + Math.sin(a) * s[2] * 0.6; }
      dg.attributes.position.needsUpdate = true;
    };
  }
}
