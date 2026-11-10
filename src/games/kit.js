// Shared bits for the games: maths, common shapes and materials, cute faces,
// folded-paper meshes and touch tests.
import * as THREE from 'three';
import { inkMat, inked, INK } from '../toon.js';

export const rnd = (a, b) => a + Math.random() * (b - a);
export const pick = (a) => a[Math.floor(Math.random() * a.length)];
export const lerp = (a, b, k) => a + (b - a) * k;
export const clamp = THREE.MathUtils.clamp;
export const hex = (c) => '#' + new THREE.Color(c).getHexString();
export const UP = new THREE.Vector3(0, 1, 0);

export const GEO = {
  sph: new THREE.SphereGeometry(1, 22, 16),
  disc: new THREE.CircleGeometry(1, 20),
  box: new THREE.BoxGeometry(1, 1, 1),
  cyl: new THREE.CylinderGeometry(1, 1, 1, 18),
  cone: (() => { const g = new THREE.ConeGeometry(1, 1, 14); g.translate(0, 0.5, 0); return g; })(),
  torus: new THREE.TorusGeometry(1, 0.16, 10, 36),
  ring: new THREE.RingGeometry(0.84, 1, 40),
  smile: new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI),
  star: (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.46 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } const g = new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); g.translate(0, 0, -0.15); return g; })(),
};
export const INKS = inkMat(0.045), INK_THIN = inkMat(0.028), INK_BIG = inkMat(0.065);
export const inkM = new THREE.MeshBasicMaterial({ color: INK }), whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff });
export const blushM = new THREE.MeshBasicMaterial({ color: 0xff3d7a, transparent: true, opacity: 0.55 });
export const flat = (color, o = {}) => new THREE.MeshBasicMaterial({ color, ...o });
export const glowM = (color, opacity = 1) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false, side: THREE.DoubleSide });
export { inked };

// Two eyes, blush and a mouth on the front of something round. mood: happy | angry | wow | sleepy
export function addFace(g, z, y = 0, s = 1, mood = 'happy') {
  const parts = [];
  for (const sg of [-1, 1]) {
    const w = new THREE.Mesh(GEO.disc, whiteM); w.scale.set(0.17 * s, (mood === 'sleepy' ? 0.05 : 0.2) * s, 1); w.position.set(sg * 0.3 * s, y, z); g.add(w);
    const k = new THREE.Mesh(GEO.disc, inkM); k.scale.set(0.1 * s, (mood === 'sleepy' ? 0.04 : 0.13) * s, 1); k.position.set(sg * 0.28 * s, y - 0.02 * s, z + 0.01); g.add(k);
    const h = new THREE.Mesh(GEO.disc, whiteM); h.scale.setScalar(0.04 * s); h.position.set(sg * 0.28 * s - 0.03 * s, y + 0.04 * s, z + 0.02); g.add(h);
    const b = new THREE.Mesh(GEO.disc, blushM); b.scale.set(0.12 * s, 0.07 * s, 1); b.position.set(sg * 0.52 * s, y - 0.2 * s, z - 0.02); g.add(b);
    if (mood === 'angry') { const br = new THREE.Mesh(GEO.disc, inkM); br.scale.set(0.2 * s, 0.045 * s, 1); br.position.set(sg * 0.3 * s, y + 0.24 * s, z + 0.02); br.rotation.z = -sg * 0.45; g.add(br); }
    parts.push(w, k);
  }
  let m;
  if (mood === 'wow') { m = new THREE.Mesh(GEO.disc, inkM); m.scale.set(0.08 * s, 0.1 * s, 1); m.position.set(0, y - 0.24 * s, z + 0.01); }
  else { m = new THREE.Mesh(GEO.smile, inkM); m.scale.setScalar(s); m.position.set(0, y - (mood === 'angry' ? 0.28 : 0.14) * s, z + 0.01); m.rotation.z = mood === 'angry' ? 0 : Math.PI; }
  g.add(m); return parts;
}

// Folded paper: flat facets for the colour, a rounded copy for the ink line so it stays unbroken.
const FACETS = new Map();
export function paper(geo, mat, ink = INKS) {
  let f = FACETS.get(geo);
  if (!f) {
    const facet = geo.index ? geo.toNonIndexed() : geo.clone(); facet.computeVertexNormals();
    const round = geo.clone(), p = round.attributes.position, n = new Float32Array(p.count * 3), v = new THREE.Vector3();
    round.computeBoundingBox(); const c = round.boundingBox.getCenter(new THREE.Vector3());
    for (let i = 0; i < p.count; i++) { v.fromBufferAttribute(p, i).sub(c).normalize(); n[i * 3] = v.x; n[i * 3 + 1] = v.y; n[i * 3 + 2] = v.z; }
    round.setAttribute('normal', new THREE.BufferAttribute(n, 3)); f = { facet, round }; FACETS.set(geo, f);
  }
  const m = new THREE.Mesh(f.facet, mat);
  if (ink) { const h = new THREE.Mesh(f.round, ink); h.matrixAutoUpdate = false; m.add(h); m.userData.hull = h; }
  return m;
}

// The first of a player's body points that touches a circle, or null.
const TOUCH = ['haL', 'haR', 'head'];
export function near(p, x, y, r, names = TOUCH) {
  const j = p.j, S = p.rig.S;
  for (const n of names) { const pt = j[n]; if (Math.hypot(pt.x - x, pt.y - y) < r + (n === 'head' ? 0.48 : 0.32) * S) return pt; }
  return null;
}
// Which hand, if any, is swinging fast through a circle. Returns 0, 1 or -1.
export function swing(p, x, y, r, speed = 3) {
  const S = p.rig.S;
  for (let h = 0; h < 2; h++) { const hd = p.rig.hands[h]; if (p.rig.handVel[h].length() > speed * S && Math.hypot(hd.x - x, hd.y - y) < r + 0.32 * S) return h; }
  return -1;
}
export const hearts = (n, max) => Array.from({ length: max }, (_, i) => `<span class="heart ${i < n ? '' : 'off'}">♥</span>`).join('');
