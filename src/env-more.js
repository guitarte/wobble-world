// More worlds: a lantern garden at sunset, islands above the clouds and a giant
// playroom. Each entry has the sky and light settings and a builder that fills
// a group with scenery and returns its per-frame animation.
import * as THREE from 'three';
import { sceneToon } from './toon.js';

const rnd = (a, b) => a + Math.random() * (b - a);
const std = sceneToon;
const basic = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
const add = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide, fog: false });
const sph = new THREE.SphereGeometry(1, 20, 14), box = new THREE.BoxGeometry(1, 1, 1), cyl = new THREE.CylinderGeometry(1, 1, 1, 16);
const flatDown = (m) => { m.rotation.x = -Math.PI / 2; return m; };
const starGeo = (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.46 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); })();
// drifting specks: petals, dust, sparkles
function specks(g, n, color, size, area, opacity = 0.9) {
  const pos = new Float32Array(n * 3), seed = [];
  for (let i = 0; i < n; i++) { pos[i * 3] = rnd(-area[0], area[0]); pos[i * 3 + 1] = rnd(0, area[1]); pos[i * 3 + 2] = rnd(-area[2], 3); seed.push(rnd(0, 6.28)); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const pts = new THREE.Points(geo, new THREE.PointsMaterial({ color, size, transparent: true, opacity, depthWrite: false })); g.add(pts);
  return { pos, seed, geo, n, area };
}

export const MORE = {
  // ------------------------------------------------------------ sunset garden
  sunset: {
    theme: { top: 0x3b1d6e, mid: 0xff6f61, bot: 0xffd27a, fog: 0xff9a78, far: 230, stars: 0.35, hemi: [0xffe0c0, 0x8a4a7a, 0.55], sun: [0xffd0a0, 1.0], exposure: 1.0 },
    build(g) {
      const ground = flatDown(new THREE.Mesh(new THREE.PlaneGeometry(500, 300), std(0xd9805e))); ground.position.z = -100; g.add(ground);
      const pad = flatDown(new THREE.Mesh(new THREE.CircleGeometry(11, 64), std(0xf2b488))); pad.position.set(0, 0.02, -1); g.add(pad);
      const ring = flatDown(new THREE.Mesh(new THREE.RingGeometry(10.2, 11, 64), basic(0xfff1c9))); ring.position.set(0, 0.04, -1); g.add(ring);
      // the sun going down behind three rows of hills
      const sun = new THREE.Mesh(new THREE.CircleGeometry(34, 64), basic(0xfff4b8, { fog: false })); sun.position.set(-18, 16, -240); g.add(sun);
      const halo = new THREE.Mesh(new THREE.CircleGeometry(60, 48), add(0xffb070, 0.22)); halo.position.set(-18, 16, -239); g.add(halo);
      [[0xb04a7a, -190, 30, 9], [0x8a3a78, -140, 22, 8], [0x652a6a, -95, 15, 7]].forEach(([c, z, h, n], k) => {
        const m = basic(c, { fog: false });
        for (let i = 0; i < n; i++) { const hill = new THREE.Mesh(sph, m); const r = rnd(h * 1.2, h * 2); hill.scale.set(r * 1.5, rnd(h * 0.7, h * 1.3), 4); hill.position.set((i - (n - 1) / 2) * (360 / n) + rnd(-10, 10), -2 + k, z); g.add(hill); }
      });
      // paper lanterns on two sagging lines
      const lanterns = [], cols = [0xff5a5a, 0xffc531, 0xff8a3d, 0xff6fa8, 0xfff1ad];
      [[-9, 11.5], [-17, 13]].forEach(([z, y0], row) => {
        const n = 9 + row * 2, w = 30 + row * 14;
        for (let i = 0; i < n; i++) {
          const u = i / (n - 1) * 2 - 1, L = new THREE.Group();
          const body = new THREE.Mesh(sph, std(cols[(i + row) % 5], { emissive: cols[(i + row) % 5], emissiveIntensity: 0.35 })); body.scale.set(0.62, 0.78, 0.62); L.add(body);
          for (const sg of [-1, 1]) { const cap = new THREE.Mesh(cyl, std(0x3a2148)); cap.scale.set(0.3, 0.12, 0.3); cap.position.y = sg * 0.76; L.add(cap); }
          const tail = new THREE.Mesh(box, basic(0xfff1ad)); tail.scale.set(0.05, 0.6, 0.05); tail.position.y = -1.15; L.add(tail);
          L.position.set(u * w / 2, y0 - (1 - u * u) * 2.2 - 0.95, z); L.userData.p = rnd(0, 6); g.add(L); lanterns.push(L);
        }
        // the line they hang from: an arc of a big circle through both ends and the low point
        const c = w / 2, sag = 2.2, R = (c * c + sag * sag) / (2 * sag), arc = 2 * Math.asin(c / R);
        const line = new THREE.Mesh(new THREE.TorusGeometry(R, 0.035, 4, 48, arc), basic(0x3a2148)); line.position.set(0, y0 - sag + R, z); line.rotation.z = -Math.PI / 2 - arc / 2; g.add(line);
      });
      // tall banners either side
      const banners = [];
      for (let i = 0; i < 8; i++) {
        const side = i % 2 ? 1 : -1, zz = -4 - Math.floor(i / 2) * 9, P = new THREE.Group();
        const pole = new THREE.Mesh(cyl, std(0x6a3a4a)); pole.scale.set(0.12, 9, 0.12); pole.position.y = 4.5; P.add(pole);
        const flag = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 5, 1, 6), std([0xff5a78, 0xffc531, 0x22d3c5, 0x9d6bff][i % 4], { side: THREE.DoubleSide })); flag.position.set(-side * 0.85, 6.2, 0); P.add(flag);
        P.position.set(side * (11.5 + Math.floor(i / 2) * 2.5), 0, zz); g.add(P); banners.push(flag);
      }
      // stepping stones and round bushes
      for (let i = 0; i < 26; i++) { const b = new THREE.Mesh(sph, std(i % 3 ? 0xe86a8a : 0xffa3b8)); const s = rnd(1.2, 2.8), side = i % 2 ? 1 : -1; b.scale.set(s * 1.2, s * 0.8, s); b.position.set(side * rnd(13, 44), s * 0.3, rnd(-60, -4)); g.add(b); }
      const pet = specks(g, 130, 0xffc2d6, 0.32, [26, 16, 30]);
      return (dt, t) => {
        for (const L of lanterns) { L.rotation.z = Math.sin(t * 1.1 + L.userData.p) * 0.12; L.children[0].material.emissiveIntensity = 0.3 + 0.12 * Math.sin(t * 3 + L.userData.p); }
        banners.forEach((f, i) => { const p = f.geometry.attributes.position; for (let k = 0; k < p.count; k++) p.setZ(k, Math.sin(t * 2.2 + p.getY(k) * 0.9 + i) * 0.16 * (1 - (p.getY(k) + 2.5) / 5)); p.needsUpdate = true; });
        for (let i = 0; i < pet.n; i++) { pet.pos[i * 3] += (1.1 + Math.sin(t + pet.seed[i]) * 0.5) * dt; pet.pos[i * 3 + 1] -= (0.7 + (i % 4) * 0.2) * dt; if (pet.pos[i * 3 + 1] < 0) { pet.pos[i * 3 + 1] = pet.area[1]; pet.pos[i * 3] = rnd(-pet.area[0], pet.area[0]); } if (pet.pos[i * 3] > pet.area[0]) pet.pos[i * 3] = -pet.area[0]; }
        pet.geo.attributes.position.needsUpdate = true;
      };
    },
  },

  // ------------------------------------------------------------ above the clouds
  clouds: {
    theme: { top: 0x2466d8, mid: 0x74c0ff, bot: 0xfff0d2, fog: 0xcfe9ff, far: 320, stars: 0, hemi: [0xeaf6ff, 0x9fc8ff, 0.5], sun: [0xfff6e0, 1.05], exposure: 1.0 },
    build(g) {
      // the island everyone stands on
      const top = new THREE.Mesh(new THREE.CylinderGeometry(11.5, 11, 0.7, 48), std(0x8fe36a)); top.position.set(0, -0.35, -1.5); g.add(top);
      const rock = new THREE.Mesh(new THREE.ConeGeometry(10.8, 11, 9), std(0xc49a78)); rock.rotation.x = Math.PI; rock.position.set(0, -6.2, -1.5); g.add(rock);
      for (let i = 0; i < 14; i++) { const a = i / 14 * 6.28, b = new THREE.Mesh(sph, std(i % 2 ? 0x6fd15a : 0xa6ee7a)); b.scale.set(rnd(0.6, 1.1), rnd(0.4, 0.7), rnd(0.6, 1)); b.position.set(Math.cos(a) * 10.6, 0.1, -1.5 + Math.sin(a) * 9); if (b.position.z > 1) continue; g.add(b); }
      // a sea of cloud below, big puffs nearby and soft ones far away
      const puffs = [], white = std(0xffffff, { emissive: 0x93a9cc, emissiveIntensity: 0.55 }), far = basic(0xffffff, { fog: false }), shade = basic(0xdcecff, { fog: false });
      for (let i = 0; i < 12; i++) {
        const c = new THREE.Group();
        for (let k = 0; k < 3; k++) { const b = new THREE.Mesh(sph, white); b.scale.set(rnd(2.4, 4), rnd(1.6, 2.4), rnd(1.8, 2.6)); b.position.set((k - 1) * 2.6, rnd(-0.3, 0.7), rnd(-0.6, 0.6)); c.add(b); }
        const side = i % 2 ? 1 : -1; c.position.set(side * rnd(17, 48), rnd(-7, 13), rnd(-46, -12)); c.userData = { x: c.position.x, y: c.position.y, p: rnd(0, 6) }; g.add(c); puffs.push(c);
      }
      for (let i = 0; i < 46; i++) { const b = new THREE.Mesh(sph, i % 3 ? far : shade); const r = rnd(9, 20); b.scale.set(r * 1.6, r * 0.55, r); b.position.set(rnd(-170, 170), rnd(-26, -10), rnd(-220, -30)); g.add(b); }
      for (let i = 0; i < 10; i++) { const b = new THREE.Mesh(sph, far); const r = rnd(6, 13); b.scale.set(r * 2, r * 0.6, 2); b.position.set(rnd(-150, 150), rnd(18, 60), rnd(-240, -150)); g.add(b); }
      // little islands with a tree and a waterfall each
      const isles = [];
      for (let i = 0; i < 6; i++) {
        const I = new THREE.Group(), s = rnd(2.4, 4.6);
        const t2 = new THREE.Mesh(new THREE.CylinderGeometry(1, 0.95, 0.22, 20), std(0x8fe36a)); I.add(t2);
        const r2 = new THREE.Mesh(new THREE.ConeGeometry(0.95, 1.5, 7), std(0xc49a78)); r2.rotation.x = Math.PI; r2.position.y = -0.86; I.add(r2);
        const trunk = new THREE.Mesh(cyl, std(0x9a6b4b)); trunk.scale.set(0.07, 0.5, 0.07); trunk.position.set(0.3, 0.35, 0); I.add(trunk);
        const leaf = new THREE.Mesh(sph, std([0x35b86b, 0xff8fb3, 0xffd166][i % 3])); leaf.scale.setScalar(0.38); leaf.position.set(0.3, 0.8, 0); I.add(leaf);
        const fall = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 2.2), basic(0xbfeaff, { transparent: true, opacity: 0.8 })); fall.position.set(-0.5, -1.1, 0.72); I.add(fall);
        const side = i % 2 ? 1 : -1; I.position.set(side * rnd(20, 62), rnd(2, 18), rnd(-95, -36)); I.scale.setScalar(s); I.userData = { y: I.position.y, p: rnd(0, 6) }; g.add(I); isles.push(I);
      }
      // kites
      const kites = [], kc = [0xff5a78, 0xffc531, 0x9d6bff, 0x22d3c5];
      for (let i = 0; i < 4; i++) {
        const K = new THREE.Group(), d = new THREE.Mesh(new THREE.CircleGeometry(1, 4), std(kc[i], { side: THREE.DoubleSide })); d.scale.set(0.8, 1.2, 1); K.add(d);
        for (let k = 0; k < 4; k++) { const b = new THREE.Mesh(new THREE.CircleGeometry(0.16, 3), basic(k % 2 ? 0xffffff : kc[(i + 1) % 4], { side: THREE.DoubleSide })); b.position.set(Math.sin(k) * 0.25, -1.5 - k * 0.55, 0); K.add(b); }
        K.position.set((i - 1.5) * 13 + rnd(-3, 3), rnd(11, 17), rnd(-30, -16)); K.userData = { x: K.position.x, y: K.position.y, p: rnd(0, 6) }; g.add(K); kites.push(K);
      }
      const halo = new THREE.Mesh(new THREE.CircleGeometry(40, 40), add(0xfff3c0, 0.3)); halo.position.set(60, 62, -250); g.add(halo);
      return (dt, t) => {
        for (const c of puffs) { c.position.x = c.userData.x + Math.sin(t * 0.15 + c.userData.p) * 2.5; c.position.y = c.userData.y + Math.sin(t * 0.4 + c.userData.p) * 0.5; }
        for (const I of isles) { I.position.y = I.userData.y + Math.sin(t * 0.5 + I.userData.p) * 0.8; I.rotation.y = Math.sin(t * 0.2 + I.userData.p) * 0.2; }
        for (const K of kites) { const u = K.userData; K.position.set(u.x + Math.sin(t * 0.6 + u.p) * 2.2, u.y + Math.sin(t * 0.9 + u.p * 2) * 1.1, K.position.z); K.rotation.z = Math.sin(t * 0.6 + u.p + 1) * 0.35; }
      };
    },
  },

  // ------------------------------------------------------------ the giant playroom
  toybox: {
    theme: { top: 0x6a5cf0, mid: 0xff9ac2, bot: 0xffe9a8, fog: 0xffc9dc, far: 170, stars: 0, hemi: [0xfff4e6, 0xffb3c8, 0.55], sun: [0xfff2dc, 1.0], exposure: 1.0 },
    build(g) {
      const floor = flatDown(new THREE.Mesh(new THREE.PlaneGeometry(260, 200), new THREE.ShaderMaterial({
        vertexShader: `varying vec3 vP; void main(){ vP=(modelMatrix*vec4(position,1.0)).xyz; gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0); }`,
        fragmentShader: `varying vec3 vP; void main(){ vec2 p=vP.xz/3.0; vec2 f=fract(p)-0.5; float c=mod(floor(p.x)+floor(p.y),2.0); vec2 w=fwidth(p)*1.2; float e=smoothstep(0.5-w.x,0.5,abs(f.x))+smoothstep(0.5-w.y,0.5,abs(f.y));
          vec3 col=mix(vec3(1.0,0.93,0.80),vec3(1.0,0.80,0.70),c); col=mix(col,vec3(0.95,0.62,0.62),min(1.0,e)*0.6); float d=clamp(-vP.z/120.0,0.0,1.0); gl_FragColor=vec4(mix(col,vec3(1.0,0.79,0.86),d*d),1.0); }`,
      }))); floor.position.z = -80; g.add(floor);
      const rug = flatDown(new THREE.Mesh(new THREE.CircleGeometry(11, 64), std(0xff8fb8))); rug.position.set(0, 0.02, -1); g.add(rug);
      const rug2 = flatDown(new THREE.Mesh(new THREE.RingGeometry(7.6, 8.4, 64), basic(0xfff1c9))); rug2.position.set(0, 0.04, -1); g.add(rug2);
      // towers of giant blocks
      const bc = [0xff5a78, 0x22d3c5, 0xffc531, 0x9d6bff, 0xff9248, 0x4fd8ff];
      for (let i = 0; i < 12; i++) {
        const side = i % 2 ? 1 : -1, x = side * rnd(13, 40), z = rnd(-44, -5); let y = 0;
        for (let k = 0; k < 1 + (i % 4); k++) { const s = rnd(2.6, 4.6) * (1 - k * 0.14), b = new THREE.Mesh(box, std(bc[(i + k) % 6])); b.scale.setScalar(s); b.position.set(x + rnd(-0.5, 0.5), y + s / 2, z); b.rotation.y = rnd(-0.5, 0.5); y += s; g.add(b); }
      }
      // a ball, a ring stacker and a rocket
      const ball = new THREE.Mesh(sph, std(0x4fd8ff)); ball.scale.setScalar(3.2); ball.position.set(-21, 3.2, -15); g.add(ball);
      const band = new THREE.Mesh(new THREE.TorusGeometry(3.22, 0.28, 8, 40), std(0xffffff)); band.position.copy(ball.position); band.rotation.x = 1.2; g.add(band);
      [0xff5a78, 0xffc531, 0x22d3c5, 0x9d6bff].forEach((c, k) => { const r = new THREE.Mesh(new THREE.TorusGeometry(2.6 - k * 0.5, 0.62, 10, 32), std(c)); r.rotation.x = Math.PI / 2; r.position.set(20, 0.65 + k * 1.2, -13); g.add(r); });
      const pole = new THREE.Mesh(cyl, std(0xfff1c9)); pole.scale.set(0.5, 6.2, 0.5); pole.position.set(20, 3.1, -13); g.add(pole);
      const R = new THREE.Group(); const hull = new THREE.Mesh(cyl, std(0xffffff)); hull.scale.set(2, 7, 2); hull.position.y = 5; R.add(hull);
      const nose = new THREE.Mesh(new THREE.ConeGeometry(2, 3.4, 20), std(0xff5a78)); nose.position.y = 10.2; R.add(nose);
      for (let k = 0; k < 3; k++) { const f = new THREE.Mesh(box, std(0xff5a78)); f.scale.set(0.3, 3, 2.2); const a = k / 3 * 6.28; f.position.set(Math.cos(a) * 2.4, 1.7, Math.sin(a) * 2.4); f.rotation.y = -a; R.add(f); }
      const port = new THREE.Mesh(sph, std(0x4fd8ff)); port.scale.set(0.9, 0.9, 0.3); port.position.set(0, 6.5, 2); R.add(port);
      R.position.set(34, 0, -34); R.rotation.z = -0.06; g.add(R);
      // a toy train that keeps crossing the back of the room
      const train = new THREE.Group();
      [0xff5a78, 0xffc531, 0x22d3c5, 0x9d6bff].forEach((c, k) => {
        const car = new THREE.Group(), b = new THREE.Mesh(box, std(c)); b.scale.set(4.2, k ? 2.2 : 2.8, 2.6); b.position.y = k ? 1.9 : 2.2; car.add(b);
        if (!k) { const ch = new THREE.Mesh(cyl, std(0x3a2148)); ch.scale.set(0.5, 1.6, 0.5); ch.position.set(1.1, 4.3, 0); car.add(ch); const cab = new THREE.Mesh(box, std(0xff9248)); cab.scale.set(1.8, 1.6, 2.6); cab.position.set(-1.2, 4.3, 0); car.add(cab); }
        for (const wx of [-1.3, 1.3]) { const w = new THREE.Mesh(cyl, std(0x3a2148)); w.scale.set(0.8, 0.5, 0.8); w.rotation.x = Math.PI / 2; w.position.set(wx, 0.8, 1.4); car.add(w); }
        car.position.x = -k * 5; train.add(car);
      });
      train.position.set(-60, 0, -52); g.add(train);
      // bunting and a mobile of stars
      const flags = [];
      for (let i = 0; i < 17; i++) { const u = i / 16 * 2 - 1, f = new THREE.Mesh(new THREE.CircleGeometry(0.9, 3), std(bc[i % 6], { side: THREE.DoubleSide })); f.rotation.z = -Math.PI / 2; f.position.set(u * 24, 13.6 - (1 - u * u) * 2.4, -14); g.add(f); flags.push(f); }
      const stars = [];
      for (let i = 0; i < 5; i++) { const s = new THREE.Mesh(starGeo, std(i % 2 ? 0xffc531 : 0xfff1ad)); s.scale.setScalar(0.9); s.position.set((i - 2) * 6.5, 10.2 + (i % 2) * 1.4, -9); g.add(s); stars.push(s); const str = new THREE.Mesh(box, basic(0xffffff)); str.scale.set(0.04, 8, 0.04); str.position.set(s.position.x, s.position.y + 5, -9); g.add(str); }
      const dust = specks(g, 90, 0xffffff, 0.16, [24, 14, 26], 0.7);
      return (dt, t) => {
        train.position.x += dt * 5; if (train.position.x > 85) train.position.x = -70; train.children.forEach((c, k) => { c.position.y = Math.abs(Math.sin(t * 6 + k)) * 0.12; });
        flags.forEach((f, i) => { f.rotation.x = Math.sin(t * 2 + i * 0.7) * 0.3; });
        stars.forEach((s, i) => { s.rotation.y = t * 0.8 + i; s.position.y = 10.2 + (i % 2) * 1.4 + Math.sin(t * 1.3 + i) * 0.25; });
        for (let i = 0; i < dust.n; i++) { dust.pos[i * 3 + 1] += Math.sin(t * 0.6 + dust.seed[i]) * dt * 0.3; dust.pos[i * 3] += Math.cos(t * 0.4 + dust.seed[i]) * dt * 0.25; }
        dust.geo.attributes.position.needsUpdate = true;
      };
    },
  },
};
