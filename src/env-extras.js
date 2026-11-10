// Second layer of scenery: the small living details in each world.
import * as THREE from 'three';
import { sceneToon } from './toon.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const sph = new THREE.SphereGeometry(1, 16, 12);
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const std = sceneToon;
const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const dummy = new THREE.Object3D(), col = new THREE.Color();

// Streaks that cross the sky now and then.
function shootingStars(g, n, color, yMin, yMax, z) {
  const stars = [];
  for (let i = 0; i < n; i++) { const m = new THREE.Mesh(new THREE.PlaneGeometry(9, 0.16), add(color, 0)); m.userData = { wait: rnd(1, 9), t: 0 }; g.add(m); stars.push(m); }
  return (dt) => {
    for (const s of stars) {
      const u = s.userData;
      if (u.wait > 0) { u.wait -= dt; if (u.wait <= 0) { u.t = 0; u.x = rnd(-90, 60); u.y = rnd(yMin, yMax); u.a = rnd(-0.5, -0.2); s.rotation.z = u.a; } continue; }
      u.t += dt * 1.6; const d = u.t * 70; s.position.set(u.x + Math.cos(u.a) * d, u.y + Math.sin(u.a) * d, z); s.material.opacity = Math.sin(Math.min(1, u.t) * Math.PI) * 0.9;
      if (u.t >= 1) { u.wait = rnd(2, 10); s.material.opacity = 0; }
    }
  };
}

export const EXTRAS = {
  meadow(g) {
    // flowers
    const cols = [0xff6fa5, 0xffffff, 0xffd84a, 0xb18cff, 0xff9248];
    const N = 260, petals = new THREE.InstancedMesh(sph, std(0xffffff, { roughness: 0.5 }), N), stems = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.03, 0.03, 1, 5), std(0x3fae5a), N);
    for (let i = 0; i < N; i++) {
      const side = i % 2 ? 1 : -1, x = side * rnd(1.5, 30), z = rnd(-34, 4), h = rnd(0.3, 0.7);
      dummy.position.set(x, h / 2, z); dummy.scale.set(1, h, 1); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); stems.setMatrixAt(i, dummy.matrix);
      dummy.position.set(x, h, z); dummy.scale.set(0.16, 0.1, 0.16); dummy.updateMatrix(); petals.setMatrixAt(i, dummy.matrix); petals.setColorAt(i, col.set(cols[i % 5]));
    }
    petals.name = stems.name = 'flowers'; g.add(petals, stems); // named so a game that lays a track across the meadow can clear them away
    // rainbow
    const rb = [0xff5a78, 0xff9248, 0xffd84a, 0x4dffa6, 0x4fd8ff, 0x9d6bff];
    rb.forEach((c, i) => { const m = new THREE.Mesh(new THREE.TorusGeometry(60 - i * 1.6, 0.8, 6, 80, Math.PI), basic(c, { transparent: true, opacity: 0.5, fog: false })); m.position.set(18, -4, -150); g.add(m); });
    // sun with a soft halo
    const sun = new THREE.Mesh(sph, basic(0xfff3b0, { fog: false })); sun.scale.setScalar(7); sun.position.set(-60, 52, -180); g.add(sun);
    const halo = new THREE.Mesh(sph, add(0xfff0a0, 0.18)); halo.scale.setScalar(13); halo.position.copy(sun.position); g.add(halo);
    // butterflies
    const flies = [];
    for (let i = 0; i < 9; i++) {
      const b = new THREE.Group(), m = basic(cols[i % 5], { side: THREE.DoubleSide });
      const wg = new THREE.CircleGeometry(0.22, 10); wg.translate(0.2, 0, 0);
      const l = new THREE.Mesh(wg, m), r = new THREE.Mesh(wg, m); r.scale.x = -1; b.add(l, r); b.userData = { l, r, p: rnd(0, 6), cx: rnd(-12, 12), cy: rnd(1.5, 6), cz: rnd(-14, -3), s: rnd(0.4, 0.9) };
      g.add(b); flies.push(b);
    }
    // kites
    const kites = [];
    for (let i = 0; i < 3; i++) { const k = new THREE.Mesh(new THREE.CircleGeometry(1.6, 4), basic([0xff5a78, 0x22d3c5, 0xffc531][i], { side: THREE.DoubleSide, fog: false })); k.position.set(-30 + i * 28, 24 + i * 3, -70); k.userData.p = i * 2; g.add(k); kites.push(k); }
    return (dt, t) => {
      for (const b of flies) { const u = b.userData, a = t * u.s + u.p; b.position.set(u.cx + Math.cos(a) * 3, u.cy + Math.sin(a * 2.3) * 0.8, u.cz + Math.sin(a) * 2); b.rotation.y = -a; const f = Math.sin(t * 16 + u.p) * 1.1; u.l.rotation.y = f; u.r.rotation.y = -f; }
      halo.scale.setScalar(13 + Math.sin(t * 0.8) * 0.8);
      for (const k of kites) { k.position.x += Math.sin(t * 0.4 + k.userData.p) * dt * 1.5; k.rotation.z = Math.sin(t * 0.9 + k.userData.p) * 0.3; }
    };
  },

  reef(g) {
    // rippling light on the sand
    const cu = { uTime: { value: 0 } };
    const ca = new THREE.Mesh(new THREE.PlaneGeometry(120, 70), new THREE.ShaderMaterial({
      uniforms: cu, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
      fragmentShader: `varying vec3 vP; uniform float uTime;
        void main(){ vec2 p=vP.xz*0.55; float t=uTime*0.6; float c=0.0;
          for(int i=0;i<3;i++){ float fi=float(i); p+=vec2(sin(p.y*1.3+t+fi*1.7),cos(p.x*1.1-t*0.8+fi))*0.5; c+=abs(sin(p.x+t)*sin(p.y-t*0.7)); }
          c=pow(1.0-c/3.0,5.0); float fade=clamp(1.0+vP.z/42.0,0.0,1.0); gl_FragColor=vec4(vec3(0.6,1.0,0.95)*c*1.4*fade,1.0); }`,
    }));
    ca.rotation.x = -Math.PI / 2; ca.position.set(0, 0.04, -24); g.add(ca);
    // a whale gliding past in the distance
    const whale = new THREE.Group(), wm = basic(0x0a4a86, { fog: true });
    const body = new THREE.Mesh(sph, wm); body.scale.set(11, 3.4, 3); whale.add(body);
    const tail = new THREE.Mesh(new THREE.ConeGeometry(2.6, 6, 4), wm); tail.rotation.z = Math.PI / 2; tail.position.x = -12; tail.scale.z = 0.3; whale.add(tail);
    const fluke = new THREE.Mesh(new THREE.ConeGeometry(3, 2.4, 3), wm); fluke.rotation.z = -Math.PI / 2; fluke.position.x = -15.5; fluke.scale.z = 0.2; whale.add(fluke);
    const fin = new THREE.Mesh(new THREE.ConeGeometry(1.2, 4, 4), wm); fin.position.set(3, -3, 1); fin.rotation.z = 0.6; fin.scale.z = 0.3; whale.add(fin);
    whale.position.set(-80, 17, -58); g.add(whale);
    // treasure chest
    const chest = new THREE.Group(); const wood = std(0x9a5b2c), gold = std(0xffd23f, { metalness: 0.8, roughness: 0.25, emissive: 0xffa800, emissiveIntensity: 0.5 });
    const base = new THREE.Mesh(new THREE.BoxGeometry(2.4, 1.2, 1.5), wood); base.position.y = 0.6; chest.add(base);
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.75, 0.75, 2.4, 12, 1, false, 0, Math.PI), wood); lid.rotation.z = Math.PI / 2; lid.rotation.y = 0; lid.position.set(0, 1.2, -0.75); lid.rotation.x = -1.0; chest.add(lid);
    for (let i = 0; i < 9; i++) { const c = new THREE.Mesh(sph, gold); c.scale.set(0.22, 0.22, 0.08); c.position.set(rnd(-0.9, 0.9), 1.25 + rnd(0, 0.25), rnd(-0.4, 0.4)); c.rotation.x = rnd(0, 3); chest.add(c); }
    for (const x of [-0.8, 0.8]) { const band = new THREE.Mesh(new THREE.BoxGeometry(0.18, 1.26, 1.56), gold); band.position.set(x, 0.6, 0); chest.add(band); }
    chest.position.set(-11.5, 0, -9); chest.rotation.y = 0.5; g.add(chest);
    const glint = new THREE.Mesh(sph, add(0xffe27a, 0.3)); glint.scale.setScalar(1.6); glint.position.set(-11.5, 1.6, -9); g.add(glint);
    // starfish and shells
    for (let i = 0; i < 14; i++) { const s = new THREE.Mesh(new THREE.CircleGeometry(0.5, 5), std([0xff7a59, 0xffb3d1, 0xfff0c9][i % 3], { side: THREE.DoubleSide })); s.rotation.x = -Math.PI / 2; s.rotation.z = rnd(0, 6); s.position.set(rnd(-16, 16), 0.05, rnd(-14, 3)); g.add(s); }
    // bubble columns
    const N = 60, pos = new Float32Array(N * 3), cols = [-13.5, 10, 17];
    for (let i = 0; i < N; i++) { pos[i * 3] = cols[i % 3] + rnd(-0.3, 0.3); pos[i * 3 + 1] = rnd(0, 20); pos[i * 3 + 2] = -9 - (i % 3) * 3; }
    const bg = new THREE.BufferGeometry(); bg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.add(new THREE.Points(bg, new THREE.PointsMaterial({ color: 0xffffff, size: 0.5, transparent: true, opacity: 0.5, depthWrite: false })));
    return (dt, t) => {
      cu.uTime.value = t;
      whale.position.x += dt * 2.2; if (whale.position.x > 90) whale.position.x = -90; whale.position.y = 17 + Math.sin(t * 0.3) * 1.5; tail.rotation.y = Math.sin(t * 1.2) * 0.25; fluke.position.z = Math.sin(t * 1.2) * 1.2;
      glint.scale.setScalar(1.5 + Math.sin(t * 3) * 0.3);
      for (let i = 0; i < N; i++) { pos[i * 3 + 1] += dt * (2.5 + (i % 4) * 0.5); pos[i * 3] += Math.sin(t * 3 + i) * dt * 0.4; if (pos[i * 3 + 1] > 20) { pos[i * 3 + 1] = 0.5; pos[i * 3] = cols[i % 3]; } }
      bg.attributes.position.needsUpdate = true;
    };
  },

  neon(g) {
    // city skyline on the horizon
    const c = document.createElement('canvas'); c.width = 64; c.height = 128; const x = c.getContext('2d');
    x.fillStyle = '#0b0320'; x.fillRect(0, 0, 64, 128);
    for (let r = 0; r < 16; r++) for (let k = 0; k < 6; k++) if (Math.random() < 0.55) { x.fillStyle = ['#ffd84a', '#23e6ff', '#ff4fa3', '#fff'][Math.floor(Math.random() * 4)]; x.fillRect(5 + k * 10, 5 + r * 8, 5, 4); }
    const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace; tex.magFilter = THREE.NearestFilter;
    const N = 46, towers = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), new THREE.MeshBasicMaterial({ map: tex, fog: false }), N);
    for (let i = 0; i < N; i++) { const side = i % 2 ? 1 : -1, w = rnd(5, 9), h = rnd(10, 34); dummy.position.set(side * (38 + Math.floor(i / 2) * 5.2 + rnd(0, 2)), h / 2, -185 + rnd(-6, 6)); dummy.scale.set(w, h, w); dummy.rotation.set(0, 0, 0); dummy.updateMatrix(); towers.setMatrixAt(i, dummy.matrix); }
    g.add(towers);
    // palm trees along the road
    const palms = [];
    for (let i = 0; i < 10; i++) {
      const p = new THREE.Group(), side = i % 2 ? 1 : -1; const tm = basic(0x1a0838), lm = basic(i % 4 < 2 ? 0xff4fa3 : 0x23e6ff);
      const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.3, 8, 6), tm); trunk.position.y = 4; trunk.rotation.z = side * 0.08; p.add(trunk);
      for (let k = 0; k < 6; k++) { const leaf = new THREE.Mesh(new THREE.ConeGeometry(0.35, 3.6, 4), lm); const a = k / 6 * Math.PI * 2; leaf.position.set(Math.cos(a) * 1.5, 8 - 0.5, Math.sin(a) * 1.5); leaf.rotation.z = -Math.cos(a) * 1.9 + (Math.cos(a) >= 0 ? -0 : 0); leaf.rotation.x = Math.sin(a) * 1.9; p.add(leaf); }
      p.position.set(side * 16, 0, -Math.floor(i / 2) * 24 - 6); g.add(p); palms.push(p);
    }
    const stars = shootingStars(g, 3, 0xffffff, 40, 80, -190);
    return (dt, t) => { stars(dt); for (const p of palms) { p.position.z += dt * 14; if (p.position.z > 12) p.position.z -= 120; } };
  },

  space(g) {
    const stars = shootingStars(g, 4, 0xbfe6ff, 20, 70, -170);
    // a friendly flying saucer doing laps
    const ufo = new THREE.Group();
    const disc = new THREE.Mesh(sph, std(0xc9d4ff)); disc.scale.set(2.4, 0.5, 2.4); ufo.add(disc);
    const dome = new THREE.Mesh(sph, std(0x7fffe0, { transparent: true, opacity: 0.8, emissive: 0x22d3c5, emissiveIntensity: 0.5 })); dome.scale.set(1.1, 0.9, 1.1); dome.position.y = 0.4; ufo.add(dome);
    const lights = [];
    for (let i = 0; i < 8; i++) { const l = new THREE.Mesh(sph, basic(0xffd84a)); l.scale.setScalar(0.18); const a = i / 8 * Math.PI * 2; l.position.set(Math.cos(a) * 2.1, -0.1, Math.sin(a) * 2.1); ufo.add(l); lights.push(l); }
    g.add(ufo);
    // a small rocket in the distance
    const rocket = new THREE.Group(); const rb = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 2.6, 12), std(0xffffff)); rocket.add(rb);
    const nose = new THREE.Mesh(new THREE.ConeGeometry(0.6, 1.2, 12), std(0xff5a78)); nose.position.y = 1.9; rocket.add(nose);
    for (let i = 0; i < 3; i++) { const f = new THREE.Mesh(new THREE.ConeGeometry(0.5, 1, 3), std(0xff5a78)); const a = i / 3 * Math.PI * 2; f.position.set(Math.cos(a) * 0.7, -1.1, Math.sin(a) * 0.7); rocket.add(f); }
    const flame = new THREE.Mesh(new THREE.ConeGeometry(0.45, 1.8, 10), add(0xffb347, 0.9)); flame.rotation.x = Math.PI; flame.position.y = -2.2; rocket.add(flame);
    rocket.rotation.z = -1.1; g.add(rocket);
    // glowing shield posts around the deck
    const posts = [];
    for (let i = 0; i < 10; i++) { const a = Math.PI * (0.15 + 0.7 * i / 9); const p = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.2, 3, 8), basic(0x4fd8ff)); p.position.set(Math.cos(a) * 22, 1.5, -6 - Math.sin(a) * 20); g.add(p); const orb = new THREE.Mesh(sph, add(0x9d6bff, 0.8)); orb.scale.setScalar(0.5); orb.position.y = 1.8; p.add(orb); posts.push(orb); }
    return (dt, t) => {
      stars(dt);
      const a = t * 0.35; ufo.position.set(Math.cos(a) * 34, 15 + Math.sin(a * 2) * 3, -55 + Math.sin(a) * 18); ufo.rotation.y = t * 2; ufo.rotation.z = Math.sin(a) * 0.2;
      lights.forEach((l, i) => l.material.color.setHSL(((t * 0.8 + i / 8) % 1), 1, 0.6));
      rocket.position.set(((t * 5) % 160) - 80, 30 + Math.sin(t * 0.5) * 3, -100); flame.scale.y = 1 + Math.sin(t * 30) * 0.25;
      posts.forEach((o, i) => o.scale.setScalar(0.45 + 0.2 * Math.sin(t * 3 + i)));
    };
  },

  stage(g, env) {
    // crowd along the back, bouncing on the beat with glow sticks
    const N = 70, bodies = new THREE.InstancedMesh(new THREE.CapsuleGeometry(0.5, 0.9, 4, 8), basic(0x1c0b3a), N), heads = new THREE.InstancedMesh(sph, basic(0x241046), N), sticks = new THREE.InstancedMesh(new THREE.BoxGeometry(0.12, 0.9, 0.12), new THREE.MeshBasicMaterial(), N);
    const seed = []; for (let i = 0; i < N; i++) { const row = i % 3; seed.push({ x: (Math.floor(i / 3) - N / 6) * 2.3 + rnd(-0.5, 0.5) + row * 0.8, z: -24 - row * 2.6, y: row * 0.9, p: rnd(0, 6), s: rnd(0.85, 1.2), hue: Math.random() }); }
    g.add(bodies, heads, sticks);
    // lasers from the lighting truss
    const lasers = [];
    for (let i = 0; i < 8; i++) { const geo = new THREE.PlaneGeometry(0.14, 60); geo.translate(0, -30, 0); const l = new THREE.Mesh(geo, add(0xffffff, 0.5)); l.position.set((i - 3.5) * 5, 30, -22); l.userData.p = i * 0.8; g.add(l); lasers.push(l); }
    // speaker stacks
    const cones = [];
    for (const sx of [-21, 21]) for (let k = 0; k < 3; k++) {
      const b = new THREE.Mesh(new THREE.BoxGeometry(4.4, 4.2, 3), basic(0x150828)); b.position.set(sx, 2.1 + k * 4.3, -20); g.add(b);
      const edge = new THREE.LineSegments(new THREE.EdgesGeometry(b.geometry), new THREE.LineBasicMaterial({ color: 0x6a3df0 })); b.add(edge);
      const cone = new THREE.Mesh(new THREE.CircleGeometry(1.5, 24), basic(0x2c1463)); cone.position.z = 1.52; b.add(cone);
      const dust = new THREE.Mesh(new THREE.CircleGeometry(0.6, 20), basic(0x6a3df0)); dust.position.z = 0.02; cone.add(dust); cones.push(cone);
    }
    // glowing sign above the stage
    const sign = new THREE.Mesh(new THREE.TorusGeometry(3.6, 0.18, 8, 5), basic(0xffffff)); sign.position.set(0, 21, -33); sign.rotation.z = Math.PI / 2 + 0.31; g.add(sign);
    const sign2 = new THREE.Mesh(new THREE.TorusGeometry(2.2, 0.14, 8, 5), basic(0xffffff)); sign2.position.copy(sign.position); sign2.rotation.z = sign.rotation.z + Math.PI / 5; g.add(sign2);
    const white = new THREE.Color(0x22d8ff);
    return (dt, t) => {
      const pulse = env.beatPulse, beat = env.beat;
      for (let i = 0; i < N; i++) {
        const s = seed[i], hop = Math.abs(Math.sin((beat + (i % 2) * 0.5) * Math.PI)) * 0.55 * s.s;
        dummy.rotation.set(0, 0, Math.sin(beat * Math.PI + s.p) * 0.08); dummy.position.set(s.x, 1.0 + s.y + hop, s.z); dummy.scale.setScalar(s.s); dummy.updateMatrix(); bodies.setMatrixAt(i, dummy.matrix);
        dummy.position.y += 1.25 * s.s; dummy.scale.setScalar(0.48 * s.s); dummy.updateMatrix(); heads.setMatrixAt(i, dummy.matrix);
        dummy.position.set(s.x + 0.7 * s.s, 2.4 + s.y + hop * 1.6, s.z + 0.3); dummy.rotation.set(0, 0, Math.sin(beat * Math.PI * 0.5 + s.p) * 0.7); dummy.scale.setScalar(i % 2 ? 1 : 0.001); dummy.updateMatrix(); sticks.setMatrixAt(i, dummy.matrix);
        sticks.setColorAt(i, col.copy(s.hue > 0.5 ? env.accent : white));
      }
      bodies.instanceMatrix.needsUpdate = heads.instanceMatrix.needsUpdate = sticks.instanceMatrix.needsUpdate = true; if (sticks.instanceColor) sticks.instanceColor.needsUpdate = true;
      lasers.forEach((l, i) => { l.rotation.z = Math.sin(t * 0.8 + l.userData.p) * 0.9; l.rotation.x = 0.5 + Math.sin(t * 0.5 + i) * 0.25; l.material.color.copy(i % 2 ? env.accent : white); l.material.opacity = 0.15 + 0.5 * pulse; });
      for (const c of cones) c.scale.setScalar(1 + pulse * 0.14);
      sign.material.color.copy(env.accent); sign2.material.color.copy(white); sign.rotation.z += dt * 0.3; sign2.rotation.z -= dt * 0.4; sign.scale.setScalar(1 + pulse * 0.08);
    };
  },
};
