// The heroes: slim, cel-shaded comic characters driven by a player's joints.
// Each one has their own hair, outfit, hand-drawn manga face and something
// that flutters behind them (a scarf, twin tails, long hair, goggle straps).
import * as THREE from 'three';
import { toonMat, inkMat, inked, shadeOf, tint, INK } from './toon.js';

const UP = new THREE.Vector3(0, 1, 0), FWD = new THREE.Vector3(0, 0, 1);
const tA = new THREE.Vector3(), tB = new THREE.Vector3(), tC = new THREE.Vector3();
const G = {
  sphere: new THREE.SphereGeometry(1, 24, 18),
  limb: new THREE.CylinderGeometry(0.84, 1, 1, 14, 1, true),      // tapers toward the far end
  flare: new THREE.CylinderGeometry(1.35, 1, 1, 14, 1, true),     // widens toward the far end
  torso: new THREE.LatheGeometry([[0, -0.07], [0.5, -0.05], [0.7, 0.02], [0.72, 0.25], [0.86, 0.55], [1, 0.8], [0.99, 0.93], [0.86, 1.04], [0.6, 1.11], [0.3, 1.15], [0, 1.16]].map(([x, y]) => new THREE.Vector2(x, y)), 22),
  band: new THREE.CylinderGeometry(1, 1, 1, 20, 1, true),
  cone: (() => { const g = new THREE.ConeGeometry(1, 1, 12); g.translate(0, 0.5, 0); return g; })(),
  torus: new THREE.TorusGeometry(1, 0.3, 10, 24),
  thin: new THREE.TorusGeometry(1, 0.11, 8, 28),
  arc: new THREE.TorusGeometry(1, 0.13, 8, 20, Math.PI),
  disc: new THREE.CircleGeometry(1, 28),
  face: new THREE.SphereGeometry(1.016, 22, 16, Math.PI / 2 - 0.86, 1.72, Math.PI / 2 - 0.86, 1.72),
  star: (() => { const s = new THREE.Shape(); for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 + Math.PI / 2, r = i % 2 ? 0.45 : 1; s[i ? 'lineTo' : 'moveTo'](Math.cos(a) * r, Math.sin(a) * r); } return new THREE.ExtrudeGeometry(s, { depth: 0.3, bevelEnabled: false }); })(),
};

// name, hoodie, trousers, accent, skin, hair, lower-leg colour, glove colour, style flags
export const HEROES = [
  { name: 'Ember', main: 0xff4d6d, dark: 0x2b2d6e, accent: 0xffd23f, skin: 0xffcfa8, hair: 0xf1ecff, shin: 0x2b2d6e, glove: 0xffffff, shoe: 0xff4d6d, emblem: 'flame', long: true },
  { name: 'Zeph', main: 0x19c9c0, dark: 0x27407a, accent: 0xff7ab8, skin: 0xa5694a, hair: 0x4046d8, shin: 0xffffff, glove: 0xffffff, shoe: 0xff7ab8, emblem: 'wave', long: false },
  { name: 'Volt', main: 0xffc21a, dark: 0x3b2f86, accent: 0x23e6ff, skin: 0xf6c9a0, hair: 0x2f7bff, shin: 0x3b2f86, glove: 0x23e6ff, shoe: 0x23e6ff, emblem: 'bolt', long: true },
  { name: 'Nova', main: 0x9a5bff, dark: 0x2c1d66, accent: 0x7dffb0, skin: 0x6f4530, hair: 0xff8fe0, shin: 0x2c1d66, glove: 0x7dffb0, shoe: 0xffffff, emblem: 'star', long: true, flare: true },
  { name: 'Dot', main: 0xf6f2ff, dark: 0x2c1d66, accent: 0xff4fa3, skin: 0xcf9468, hair: 0x2a2358, shin: 0x2c1d66, glove: 0xffffff, shoe: 0xff4fa3, emblem: 'note', long: true },
];
const css = (hex) => '#' + new THREE.Color(hex).getHexString();

// ------------------------------------------------------------------ faces
const FACE_CACHE = new Map();
function faceTexture(hero, expr) {
  const key = hero.name + expr + hero.accent; if (FACE_CACHE.has(key)) return FACE_CACHE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 256; const g = c.getContext('2d');
  const ink = '#1a1030', iris = css(hero.accent === 0xffd23f ? 0xff8a1f : hero.accent), brow = new THREE.Color(hero.hair).getHSL({}).l > 0.75 ? '#5b4a9a' : css(tint(hero.hair, 0x000000, 0.35));
  g.lineCap = 'round'; g.lineJoin = 'round';
  // blush
  for (const sg of [-1, 1]) {
    g.fillStyle = 'rgba(255,90,120,0.32)'; g.beginPath(); g.ellipse(128 + sg * 86, 172, 20, 11, 0, 0, 7); g.fill();
    g.strokeStyle = 'rgba(214,50,90,0.6)'; g.lineWidth = 3; for (let k = -1; k <= 1; k++) { g.beginPath(); g.moveTo(128 + sg * 86 + k * 9 - 4, 178); g.lineTo(128 + sg * 86 + k * 9 + 4, 166); g.stroke(); }
  }
  for (const sg of [-1, 1]) {
    const cx = 128 + sg * 53, cy = 124;
    if (expr === 'blink' || expr === 'happy') {
      g.strokeStyle = ink; g.lineWidth = 9; g.beginPath();
      if (expr === 'happy') { g.moveTo(cx - 26, cy + 12); g.quadraticCurveTo(cx, cy - 26, cx + 26, cy + 12); }
      else { g.moveTo(cx - 26, cy + 2); g.quadraticCurveTo(cx, cy + 18, cx + 26, cy + 2); }
      g.stroke();
    } else {
      const wide = expr === 'wow', ry = wide ? 38 : 34, rx = 26;
      g.fillStyle = '#fff'; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.fill();
      g.save(); g.clip();
      const gr = g.createLinearGradient(0, cy - 26, 0, cy + 30); gr.addColorStop(0, '#1a1030'); gr.addColorStop(0.5, iris); gr.addColorStop(1, '#ffffff');
      g.fillStyle = gr; g.beginPath(); g.ellipse(cx, cy + 5, wide ? 15 : 20, wide ? 20 : 28, 0, 0, 7); g.fill();
      g.fillStyle = ink; g.beginPath(); g.ellipse(cx, cy + 3, wide ? 6 : 9, wide ? 8 : 13, 0, 0, 7); g.fill();
      g.fillStyle = '#fff'; g.beginPath(); g.arc(cx - 9, cy - 12, 8.5, 0, 7); g.fill(); g.beginPath(); g.arc(cx + 9, cy + 15, 4.2, 0, 7); g.fill();
      g.restore();
      g.strokeStyle = ink; g.lineWidth = 4; g.beginPath(); g.ellipse(cx, cy, rx, ry, 0, 0, 7); g.stroke();
      // heavy upper lash with a flick at the outer corner
      g.lineWidth = 10; g.beginPath(); g.ellipse(cx, cy, rx + 1, ry + 1, 0, Math.PI * 1.06, Math.PI * 1.94); g.stroke();
      g.lineWidth = 7; g.beginPath(); g.moveTo(cx + sg * 24, cy - 16); g.lineTo(cx + sg * 37, cy - 25); g.stroke();
    }
    // eyebrows
    g.strokeStyle = brow; g.lineWidth = 9; g.beginPath();
    const inner = cx - sg * 24, outer = cx + sg * 28;
    if (expr === 'grit') { g.moveTo(inner, cy - 40); g.lineTo(outer, cy - 58); }
    else if (expr === 'wow' || expr === 'happy') { g.moveTo(inner, cy - 58); g.quadraticCurveTo(cx, cy - 72, outer, cy - 58); }
    else { g.moveTo(inner, cy - 52); g.quadraticCurveTo(cx, cy - 61, outer, cy - 53); }
    g.stroke();
  }
  // nose
  g.strokeStyle = 'rgba(26,16,48,0.55)'; g.lineWidth = 3.5; g.beginPath(); g.moveTo(126, 164); g.lineTo(131, 169); g.stroke();
  // mouth
  g.strokeStyle = ink; g.lineWidth = 5; g.translate(0, 12);
  if (expr === 'happy') {
    g.fillStyle = '#7a1838'; g.beginPath(); g.moveTo(98, 172); g.quadraticCurveTo(128, 178, 158, 172); g.quadraticCurveTo(150, 214, 128, 214); g.quadraticCurveTo(106, 214, 98, 172); g.closePath(); g.fill(); g.stroke();
    g.save(); g.clip(); g.fillStyle = '#ff7a9c'; g.beginPath(); g.ellipse(128, 212, 20, 13, 0, 0, 7); g.fill(); g.fillStyle = '#fff'; g.fillRect(100, 170, 56, 9); g.restore();
  } else if (expr === 'wow') { g.fillStyle = '#7a1838'; g.beginPath(); g.ellipse(128, 192, 11, 14, 0, 0, 7); g.fill(); g.stroke(); }
  else if (expr === 'grit') { g.fillStyle = '#fff'; g.beginPath(); g.moveTo(100, 178); g.quadraticCurveTo(128, 184, 158, 174); g.quadraticCurveTo(152, 200, 128, 200); g.quadraticCurveTo(106, 200, 100, 178); g.closePath(); g.fill(); g.stroke(); g.lineWidth = 2.5; g.beginPath(); g.moveTo(104, 189); g.lineTo(154, 187); g.stroke(); }
  else { g.beginPath(); g.moveTo(108, 180); g.quadraticCurveTo(130, 198, 152, 178); g.stroke(); g.lineWidth = 3; g.beginPath(); g.moveTo(152, 172); g.lineTo(156, 180); g.stroke(); }
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; FACE_CACHE.set(key, t); return t;
}
const EMBLEM_CACHE = new Map();
function emblemTexture(kind, color) {
  const key = kind + color; if (EMBLEM_CACHE.has(key)) return EMBLEM_CACHE.get(key);
  const c = document.createElement('canvas'); c.width = c.height = 128; const g = c.getContext('2d');
  g.lineJoin = 'round'; g.lineCap = 'round'; g.strokeStyle = '#1a1030'; g.lineWidth = 9; g.fillStyle = css(color); g.beginPath();
  if (kind === 'bolt') { [[76, 10], [34, 70], [60, 70], [48, 118], [96, 52], [68, 52]].forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](x, y)); g.closePath(); }
  else if (kind === 'star') { for (let i = 0; i < 10; i++) { const a = i / 10 * Math.PI * 2 - Math.PI / 2, r = i % 2 ? 24 : 54; g[i ? 'lineTo' : 'moveTo'](64 + Math.cos(a) * r, 66 + Math.sin(a) * r); } g.closePath(); }
  else if (kind === 'flame') { g.moveTo(64, 10); g.bezierCurveTo(112, 50, 108, 118, 64, 118); g.bezierCurveTo(20, 118, 18, 70, 44, 46); g.bezierCurveTo(46, 66, 58, 66, 64, 10); g.closePath(); }
  else if (kind === 'wave') { g.moveTo(12, 84); g.bezierCurveTo(30, 20, 78, 20, 84, 62); g.bezierCurveTo(86, 80, 66, 82, 66, 66); g.bezierCurveTo(52, 96, 96, 104, 116, 74); g.bezierCurveTo(112, 118, 30, 124, 12, 84); g.closePath(); }
  else { g.ellipse(44, 96, 20, 15, -0.3, 0, 7); g.moveTo(108, 84); g.ellipse(92, 84, 18, 14, -0.3, 0, 7); g.moveTo(62, 92); g.lineTo(62, 26); g.lineTo(108, 14); g.lineTo(108, 80); g.lineTo(98, 80); g.lineTo(98, 34); g.lineTo(72, 41); g.lineTo(72, 92); g.closePath(); }
  g.stroke(); g.fill();
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; EMBLEM_CACHE.set(key, t); return t;
}

// ------------------------------------------------------------------ ribbons
// A flat strip that trails from an anchor with a little rope physics: scarves,
// pigtails, long hair. Drawn as ink + shadow tone + highlight tone.
class Ribbon {
  constructor(parent, o) {
    this.o = { n: 7, len: 1.4, width: 0.14, tip: 0.2, z: -0.3, wind: 1, stiff: 0.03, flutter: 0.5, rate: 8, rest: [0, -1], shape: 'taper', ...o };
    const n = this.o.n; this.p = []; this.q = [];
    for (let i = 0; i < n; i++) { this.p.push(new THREE.Vector2()); this.q.push(new THREE.Vector2()); }
    this.pos = new Float32Array(n * 6 * 3); const colr = new Float32Array(n * 6 * 3), idx = [];
    const cols = [new THREE.Color(INK), shadeOf(this.o.color, 0.8), new THREE.Color(this.o.color)];
    for (let i = 0; i < n; i++) for (let k = 0; k < 6; k++) cols[k >> 1].toArray(colr, (i * 6 + k) * 3);
    for (let s = 0; s < 3; s++) for (let i = 0; i < n - 1; i++) { const a = i * 6 + s * 2, b = a + 6; idx.push(a, a + 1, b, a + 1, b + 1, b); }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(this.pos, 3)); geo.setAttribute('color', new THREE.BufferAttribute(colr, 3)); geo.setIndex(idx);
    geo.boundingSphere = new THREE.Sphere(new THREE.Vector3(), 1e4);
    this.mesh = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide })); this.mesh.frustumCulled = false; parent.add(this.mesh);
    this.fresh = true; this.acc = 0; this.tt = Math.random() * 10;
  }
  width(u) { const o = this.o; return o.shape === 'leaf' ? o.width * (0.35 + 0.9 * Math.sin(Math.PI * Math.pow(u, 0.75))) * (u > 0.97 ? 0.15 : 1) : o.width * (1 - (1 - o.tip) * u); }
  update(ax, ay, S, dt, t, rx, ry, inkW) {
    const o = this.o, n = o.n, L = o.len * S / (n - 1), p = this.p, q = this.q;
    if (this.fresh || Math.hypot(p[0].x - ax, p[0].y - ay) > 6) { for (let i = 0; i < n; i++) { p[i].set(ax + rx * L * i, ay + ry * L * i); q[i].copy(p[i]); } this.fresh = false; }
    this.acc = Math.min(this.acc + dt, 0.1); const h = 1 / 60, px = -ry, py = rx;
    while (this.acc >= h) {
      this.acc -= h; this.tt += h; const tt = this.tt;
      p[0].set(ax, ay);
      for (let i = 1; i < n; i++) {
        const u = i / (n - 1), vx = (p[i].x - q[i].x) * 0.93, vy = (p[i].y - q[i].y) * 0.93; q[i].copy(p[i]);
        const fl = Math.sin(tt * o.rate - i * 1.25 + o.z * 40) * o.flutter * u * 26;
        const gx = (o.wind * (3 + 2 * Math.sin(tt * 1.7 + o.z * 30)) + px * fl) * S, gy = (-9 + py * fl) * S;
        p[i].x += vx + gx * h * h + (ax + rx * L * i - p[i].x) * o.stiff; p[i].y += vy + gy * h * h + (ay + ry * L * i - p[i].y) * o.stiff;
      }
      for (let k = 0; k < 3; k++) for (let i = 1; i < n; i++) { const dx = p[i].x - p[i - 1].x, dy = p[i].y - p[i - 1].y, d = Math.hypot(dx, dy) || 1e-4; p[i].x = p[i - 1].x + dx / d * L; p[i].y = p[i - 1].y + dy / d * L; }
    }
    const pos = this.pos;
    for (let i = 0; i < n; i++) {
      const a = p[Math.max(0, i - 1)], b = p[Math.min(n - 1, i + 1)]; let tx = b.x - a.x, ty = b.y - a.y; const d = Math.hypot(tx, ty) || 1; tx /= d; ty /= d;
      const nx = -ty, ny = tx, w = this.width(i / (n - 1)) * S, zz = o.z * S, x = p[i].x, y = p[i].y, j = i * 18;
      const put = (k, off, z) => { pos[j + k * 3] = x + nx * off; pos[j + k * 3 + 1] = y + ny * off; pos[j + k * 3 + 2] = z; };
      put(0, -w - inkW, zz); put(1, w + inkW, zz); put(2, -w, zz + 0.012); put(3, w, zz + 0.012); put(4, -w * 0.2, zz + 0.024); put(5, w, zz + 0.024);
    }
    this.mesh.geometry.attributes.position.needsUpdate = true;
  }
}

// ------------------------------------------------------------------ the hero
export class Avatar {
  // color is used for the coach's accent; style picks the hero (0-3 players, 4 coach)
  constructor(color, style = 0) {
    this.group = new THREE.Group(); this.style = style;
    const H = this.hero = style === 4 ? { ...HEROES[4], accent: color, shoe: color } : HEROES[style % 4];
    const rim = tint(H.accent, 0xffffff, 0.45);
    const tm = (c, o = {}) => toonMat(c, { rim, ...o });
    this.ink = inkMat(0.04); this.inkThin = inkMat(0.025);
    this.mat = { main: tm(H.main), dark: tm(H.dark), accent: tm(H.accent), skin: tm(H.skin, { shade: tint(H.skin, 0x8a2f6a, 0.34), rimAmt: 0.6 }), hair: tm(H.hair, { spec: 1 }), shin: tm(H.shin), glove: tm(H.glove), shoe: tm(H.shoe), white: tm(0xffffff) };
    this.allMats = Object.values(this.mat);
    const mk = (geo, mat, parent = this.group, ink = this.ink) => { const m = inked(geo, mat, ink); parent.add(m); return m; };
    const M = this.mat;

    this.torso = mk(G.torso, M.main); this.hem = mk(G.band, M.accent); this.pelvis = mk(G.sphere, M.dark);
    this.neck = mk(G.band, M.skin); this.collar = mk(G.torus, style === 0 ? M.accent : M.main);
    this.emblem = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ map: emblemTexture(H.emblem, H.accent), transparent: true, depthWrite: false })); this.group.add(this.emblem);
    const sleeve = M.main, fore = H.long ? M.main : M.skin;
    this.segs = {
      uaL: mk(G.limb, sleeve), uaR: mk(G.limb, sleeve), faL: mk(H.flare ? G.flare : G.limb, fore), faR: mk(H.flare ? G.flare : G.limb, fore),
      thL: mk(G.limb, M.dark), thR: mk(G.limb, M.dark), shinL: mk(H.flare ? G.flare : G.limb, M.shin), shinR: mk(H.flare ? G.flare : G.limb, M.shin),
    };
    this.balls = { shL: mk(G.sphere, sleeve), shR: mk(G.sphere, sleeve), elL: mk(G.sphere, fore), elR: mk(G.sphere, fore), knL: mk(G.sphere, M.dark), knR: mk(G.sphere, M.dark) };
    this.hands = [mk(G.sphere, M.glove), mk(G.sphere, M.glove)]; this.cuffs = [mk(G.torus, M.accent), mk(G.torus, M.accent)];
    this.feet = [0, 1].map(() => { const f = new THREE.Group(); this.group.add(f); const up = mk(G.sphere, M.shoe, f); up.scale.set(0.62, 0.52, 1); up.position.set(0, 0.2, 0); const sole = mk(G.sphere, M.white, f); sole.scale.set(0.68, 0.22, 1.08); sole.position.set(0, -0.2, 0.02); const toe = mk(G.sphere, M.white, f, null); toe.scale.set(0.5, 0.36, 0.4); toe.position.set(0, 0.08, 0.78); return f; });

    // head
    this.head = new THREE.Group(); this.group.add(this.head);
    const skull = mk(G.sphere, M.skin, this.head); skull.scale.set(1, 1.06, 0.97);
    for (const sg of [-1, 1]) { const e = mk(G.sphere, M.skin, this.head); e.scale.set(0.12, 0.2, 0.16); e.position.set(sg * 0.98, -0.08, 0.02); }
    this.faceMat = new THREE.MeshBasicMaterial({ map: faceTexture(H, 'neutral'), transparent: true, depthWrite: false });
    this.face = new THREE.Mesh(G.face, this.faceMat); this.face.renderOrder = 2; this.head.add(this.face);
    this.ribbons = []; this.wobblers = [];
    this.buildHair(style, mk);

    this.shadow = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: 0x140c2a, transparent: true, opacity: 0.3, depthWrite: false })); this.shadow.rotation.x = -Math.PI / 2; this.shadow.renderOrder = -1; this.group.add(this.shadow);
    this.pop = 0; this.popV = 0; this.blinkT = 2; this.happy = 0; this.wow = 0; this.grit = 0; this.bounce = 0; this.spring = 0; this.springV = 0; this.lastHeadX = 0; this.flash = 0; this.expr = 'neutral';
    this.R = 0.4; this.yaw = 0; this.roll = 0;
  }

  spike(mk, mat, base, dir, len, rad, flat = 1) {
    const s = mk(G.cone, mat, this.head); s.position.set(...base); tA.set(...dir).normalize(); s.quaternion.setFromUnitVectors(UP, tA); s.scale.set(rad, len, rad * flat); return s;
  }
  buildHair(style, mk) {
    const M = this.mat, H = this.hero, hd = this.head, hair = M.hair;
    const cap = mk(G.sphere, hair, hd); cap.scale.set(1.07, 1.04, 1.06); cap.position.set(0, 0.2, -0.16);
    const rib = (o) => { const r = new Ribbon(this.group, o); this.ribbons.push(r); return r; };
    if (style === 0) { // Ember: swept-back spikes and a long scarf
      const sp = [[-0.75, 0.75, -0.1, -0.9, 0.7, -0.2, 0.85, 0.36], [-0.35, 1.05, 0, -0.45, 1, 0, 1.0, 0.4], [0.1, 1.15, -0.05, 0.15, 1, -0.1, 1.15, 0.42], [0.55, 1.0, -0.1, 0.7, 0.85, -0.1, 1.0, 0.4], [0.85, 0.6, -0.15, 1, 0.45, -0.2, 0.8, 0.34], [-0.2, 0.9, -0.7, -0.2, 0.7, -0.8, 0.9, 0.4], [0.4, 0.85, -0.7, 0.4, 0.6, -0.8, 0.85, 0.38]];
      for (const s of sp) this.spike(mk, hair, s.slice(0, 3), s.slice(3, 6), s[6], s[7]);
      for (const [x, tilt, len] of [[-0.5, 0.35, 0.55], [-0.12, 0.1, 0.7], [0.3, -0.25, 0.6], [0.66, -0.5, 0.45]]) this.spike(mk, hair, [x, 0.72, 0.78], [tilt, -1, 0.12], len, 0.24, 0.55);
      for (const sg of [-1, 1]) rib({ anchor: [sg * 0.25, 0, -0.55, 'neck'], n: 11, len: 1.55 + sg * 0.2, width: 0.13, tip: 0.55, color: H.accent, z: -0.42 + sg * 0.03, wind: 0.9, stiff: 0.02, flutter: 0.45, rate: 6 + sg, rest: [0.62, -0.78] });
    } else if (style === 1) { // Zeph: twin tails with pink ties and a blunt fringe
      for (const sg of [-1, 1]) {
        const bun = mk(G.sphere, hair, hd); bun.scale.setScalar(0.4); bun.position.set(sg * 0.8, 0.9, -0.1);
        const tie = mk(G.torus, M.accent, hd); tie.scale.setScalar(0.2); tie.position.set(sg * 0.7, 0.72, -0.1); tie.rotation.set(Math.PI / 2, sg * 0.6, 0);
        rib({ anchor: [sg * 0.95, 0.85, -0.2, 'head'], n: 8, len: 1.7, width: 0.19, color: H.hair, z: -0.36, wind: 0.5, stiff: 0.03, rest: [sg * 0.45, -0.9], shape: 'leaf' });
      }
      for (let k = -2; k <= 2; k++) this.spike(mk, hair, [k * 0.3, 0.8 - Math.abs(k) * 0.04, 0.74 - Math.abs(k) * 0.06], [k * 0.08, -1, 0.14], 0.5 - Math.abs(k) * 0.04, 0.2, 0.5);
      const band = mk(G.arc, M.accent, hd, this.inkThin); band.scale.set(1.13, 1.13, 1.7); band.position.set(0, 0.16, -0.02); band.rotation.x = -0.12;
    } else if (style === 2) { // Volt: lightning quiff, goggles pushed up
      for (const [b, d, l, r] of [[[-0.25, 0.85, 0.35], [-0.25, 0.9, 0.55], 1.0, 0.4], [[0.15, 0.95, 0.3], [0.3, 1, 0.5], 1.35, 0.46], [[0.5, 0.85, 0.15], [0.9, 0.75, 0.3], 1.05, 0.4], [[-0.7, 0.75, -0.1], [-1, 0.55, -0.1], 0.7, 0.34], [[0.85, 0.5, -0.2], [1, 0.2, -0.3], 0.6, 0.3], [[0, 0.9, -0.6], [0, 0.6, -1], 0.8, 0.4]]) this.spike(mk, hair, b, d, l, r);
      for (const [x, tilt, len] of [[-0.45, 0.3, 0.4], [0.5, -0.4, 0.42]]) this.spike(mk, hair, [x, 0.74, 0.78], [tilt, -1, 0.1], len, 0.22, 0.55);
      const strap = mk(G.thin, M.dark, hd, null); strap.scale.setScalar(1.05); strap.rotation.x = Math.PI / 2 - 0.18; strap.position.y = 0.52;
      for (const sg of [-1, 1]) {
        const ring = mk(G.torus, M.accent, hd, this.inkThin); ring.scale.setScalar(0.23); ring.position.set(sg * 0.34, 0.6, 0.88); ring.rotation.x = -0.3;
        const lens = new THREE.Mesh(G.disc, new THREE.MeshBasicMaterial({ color: 0xd8fbff })); lens.scale.setScalar(0.2); lens.position.set(sg * 0.34, 0.6, 0.9); lens.rotation.x = -0.3; hd.add(lens);
        rib({ anchor: [sg * 0.3, 0.45, -0.95, 'head'], n: 6, len: 0.9, width: 0.07, tip: 0.6, color: H.accent, z: -0.4, wind: 1.4, stiff: 0.02, rest: [0.8, -0.5] });
      }
    } else if (style === 3) { // Nova: long flowing hair, a star clip and one curl that will not sit down
      for (const sg of [-1, 1]) this.spike(mk, hair, [sg * 0.9, 0.42, 0.3], [sg * 0.18, -1, 0.05], 1.5, 0.27, 0.6);
      for (const [x, tilt, len] of [[-0.42, 0.5, 0.62], [0, 0.15, 0.5], [0.4, -0.45, 0.66]]) this.spike(mk, hair, [x, 0.76, 0.76], [tilt, -1, 0.12], len, 0.3, 0.5);
      for (const k of [-1, 0, 1]) rib({ anchor: [k * 0.55, 0.1, -0.7, 'head'], n: 8, len: 1.9 - Math.abs(k) * 0.25, width: 0.24, color: H.hair, z: -0.4 - Math.abs(k) * 0.02, wind: 0.6, stiff: 0.025, rest: [k * 0.3, -0.95], shape: 'leaf' });
      const piv = new THREE.Group(); piv.position.set(0.1, 1.2, 0); hd.add(piv); const curl = mk(G.cone, hair, piv, this.inkThin); curl.scale.set(0.09, 0.6, 0.09); curl.rotation.z = -0.5; piv.userData.base = 0; this.wobblers.push(piv);
      const clip = mk(G.star, M.accent, hd, this.inkThin); clip.scale.setScalar(0.2); clip.position.set(0.66, 0.6, 0.72); clip.rotation.set(0, 0.6, 0.3);
    } else { // Dot the coach: cap on backwards, headphones, ponytail
      const brim = mk(G.sphere, M.accent, hd); brim.scale.set(0.7, 0.1, 0.6); brim.position.set(0, 0.78, -1.05); brim.rotation.x = 0.35;
      const crown = mk(G.sphere, M.accent, hd); crown.scale.set(1.09, 0.8, 1.08); crown.position.set(0, 0.5, -0.12);
      for (const [x, tilt, len] of [[-0.3, 0.3, 0.42], [0.1, 0, 0.5], [0.45, -0.4, 0.4]]) this.spike(mk, M.hair, [x, 0.62, 0.84], [tilt, -1, 0.15], len, 0.24, 0.5);
      const bandH = mk(G.arc, M.dark, hd, this.inkThin); bandH.scale.set(1.14, 1.2, 1.4); bandH.position.y = 0.1;
      for (const sg of [-1, 1]) { const cup = mk(G.sphere, M.dark, hd); cup.scale.set(0.2, 0.36, 0.36); cup.position.set(sg * 1.08, 0, 0.02); const pad = mk(G.sphere, M.accent, hd, null); pad.scale.set(0.1, 0.24, 0.24); pad.position.set(sg * 1.24, 0, 0.02); }
      rib({ anchor: [0, 0.3, -0.95, 'head'], n: 7, len: 1.3, width: 0.2, color: H.hair, z: -0.4, wind: 0.8, stiff: 0.03, rest: [0.35, -0.94], shape: 'leaf' });
    }
  }

  cheer(amount = 1) { this.happy = Math.max(this.happy, amount); this.bounce = 1; }
  ouch() { this.wow = 1.1; this.flash = 1; }
  focus(sec = 1) { this.grit = sec; }
  popIn() { this.pop = 0; this.popV = 0; for (const r of this.ribbons) r.fresh = true; }

  seg(mesh, a, b, r, z) {
    tA.subVectors(b, a); const len = tA.length() || 1e-3;
    mesh.position.copy(a).addScaledVector(tA, 0.5); mesh.position.z = z;
    mesh.quaternion.setFromUnitVectors(UP, tA.multiplyScalar(1 / len)); mesh.scale.set(r, len, r);
  }
  ball(mesh, p, r, z) { mesh.position.set(p.x, p.y, z); mesh.scale.setScalar(r); }

  update(rig, dt, t) {
    const j = rig.j, S = rig.S, sdt = Math.min(dt, 0.033);
    this.popV += ((1 - this.pop) * 140 - this.popV * 14) * sdt; this.pop += this.popV * sdt;
    const ps = Math.max(0.001, this.pop);
    this.group.scale.setScalar(ps); this.group.position.set(j.hipC.x * (1 - ps), j.hipC.y * (1 - ps), 0);
    this.happy = Math.max(0, this.happy - dt * 0.9); this.wow = Math.max(0, this.wow - dt); this.grit = Math.max(0, this.grit - dt); this.bounce = Math.max(0, this.bounce - dt * 3); this.flash = Math.max(0, this.flash - dt * 6);
    const inkW = 0.02 + 0.014 * S; this.ink.uniforms.uThick.value = inkW; this.inkThin.uniforms.uThick.value = inkW * 0.6;
    for (const m of this.allMats) m.uniforms.uFlash.value = this.flash * 0.8;
    const squash = 1 + Math.sin(this.bounce * Math.PI) * 0.1;

    // torso
    tA.subVectors(j.chest, j.hipC); const tl = tA.length() || 1e-3; tA.multiplyScalar(1 / tl);
    const shW = Math.max(j.shL.distanceTo(j.shR), 0.6 * S), hw = shW * 0.52, dp = shW * 0.34;
    const q = this.torso.quaternion.setFromUnitVectors(UP, tA);
    this.torso.position.copy(j.hipC).addScaledVector(tA, tl * 0.03); this.torso.scale.set(hw * squash, tl * 0.94 / squash, dp);
    this.hem.position.copy(j.hipC).addScaledVector(tA, tl * 0.07); this.hem.quaternion.copy(q); this.hem.scale.set(hw * 0.74, 0.12 * S, dp * 0.76);
    this.pelvis.position.copy(j.hipC).addScaledVector(tA, -0.05 * S); this.pelvis.quaternion.copy(q); this.pelvis.scale.set(hw * 0.74, 0.27 * S, dp * 0.72);
    this.emblem.position.copy(j.hipC).addScaledVector(tA, tl * 0.62); this.emblem.position.z = dp * 0.93 + 0.01; this.emblem.quaternion.copy(q); this.emblem.scale.setScalar(0.2 * S); this.emblem.rotateX(-0.12);

    // limbs: slim, with big gloves and trainers
    const ra = 0.105 * S, rl = 0.135 * S, za = 0.26 * S, zl = -0.04 * S;
    this.seg(this.segs.uaL, j.shL, j.elL, ra, za * 0.55); this.seg(this.segs.faL, j.elL, j.wrL, ra * 0.84, za);
    this.seg(this.segs.uaR, j.shR, j.elR, ra, za * 0.55); this.seg(this.segs.faR, j.elR, j.wrR, ra * 0.84, za);
    this.seg(this.segs.thL, j.hipL, j.knL, rl, zl); this.seg(this.segs.shinL, j.knL, j.anL, rl * 0.84, zl);
    this.seg(this.segs.thR, j.hipR, j.knR, rl, zl); this.seg(this.segs.shinR, j.knR, j.anR, rl * 0.84, zl);
    this.ball(this.balls.shL, j.shL, ra * 1.12, za * 0.4); this.ball(this.balls.shR, j.shR, ra * 1.12, za * 0.4);
    this.ball(this.balls.elL, j.elL, ra * 0.86, za * 0.8); this.ball(this.balls.elR, j.elR, ra * 0.86, za * 0.8);
    this.ball(this.balls.knL, j.knL, rl * 0.86, zl); this.ball(this.balls.knR, j.knR, rl * 0.86, zl);
    const hr = 0.19 * S * (1 + this.happy * 0.12);
    [[j.elL, j.wrL, j.haL], [j.elR, j.wrR, j.haR]].forEach(([el, wr, ha], i) => {
      tB.subVectors(wr, el).normalize(); const hnd = this.hands[i], cf = this.cuffs[i];
      hnd.position.set(ha.x, ha.y, za * 1.1); hnd.quaternion.setFromUnitVectors(UP, tB); hnd.scale.set(hr * 0.9, hr * 1.12, hr * 0.8);
      cf.position.set(wr.x, wr.y, za * 1.02); cf.quaternion.setFromUnitVectors(FWD, tB); cf.scale.setScalar(ra * 0.95);
    });
    [[j.anL, j.ftL, -1], [j.anR, j.ftR, 1]].forEach(([an, ft, sg], i) => {
      const f = this.feet[i]; f.position.set((an.x + ft.x) / 2, Math.min(an.y, ft.y) - 0.02 * S, 0.1 * S); f.scale.setScalar(0.31 * S); f.rotation.set(0.05, sg * 0.42, 0);
    });

    // head
    const R = this.R = 0.4 * S;
    const hx = j.nose.x, hy = Math.max(j.nose.y + 0.05 * S, j.chest.y + 0.47 * S);
    this.head.position.set(hx, hy, 0.12 * S); this.head.scale.setScalar(R);
    const ex = j.earR.x - j.earL.x, ey = j.earR.y - j.earL.y, ed = Math.hypot(ex, ey) || 1;
    const hk = Math.min(1, dt * 12); // ease the head so jittery ear tracking cannot make it twitch
    this.roll += (THREE.MathUtils.clamp(Math.atan2(ey, Math.abs(ex) + 1e-3), -0.6, 0.6) - this.roll) * hk;
    this.yaw += (THREE.MathUtils.clamp((j.nose.x - (j.earL.x + j.earR.x) / 2) / ed * 1.4, -0.65, 0.65) - this.yaw) * hk;
    const roll = this.roll, yaw = this.yaw;
    this.head.rotation.set(0, yaw, roll);
    // neck and collar
    tC.set(j.chest.x, j.chest.y + 0.08 * S, 0.02 * S); tB.set(hx, hy - R * 0.6, 0.06 * S);
    this.seg(this.neck, tC, tB, 0.085 * S, 0.04 * S);
    this.collar.position.set(j.chest.x, j.chest.y + 0.13 * S, 0.03 * S); this.collar.quaternion.copy(q); this.collar.rotateX(Math.PI / 2 - 0.28); this.collar.scale.set(0.24 * S, 0.21 * S, (this.style === 0 ? 0.3 : 0.2) * S);

    // springy bits follow the head
    const hv = (hx - this.lastHeadX) / Math.max(dt, 1e-3); this.lastHeadX = hx;
    this.springV += (-this.spring * 90 - this.springV * 7 - hv * 3.5) * sdt; this.spring += this.springV * sdt; this.spring = THREE.MathUtils.clamp(this.spring, -1, 1);
    for (const w of this.wobblers) w.rotation.z = w.userData.base + this.spring * 0.7;
    const cr = Math.cos(roll), sr = Math.sin(roll);
    for (const r of this.ribbons) {
      const a = r.o.anchor; let ax, ay;
      if (a[3] === 'head') { const lx = a[0] * Math.cos(yaw) * R, ly = a[1] * R; ax = hx + lx * cr - ly * sr; ay = hy + lx * sr + ly * cr; }
      else { ax = j.chest.x + a[0] * S; ay = j.chest.y + (0.16 + a[1]) * S; }
      const rx = r.o.rest[0] * cr - r.o.rest[1] * sr, ry = r.o.rest[0] * sr + r.o.rest[1] * cr;
      r.update(ax, ay, S, dt, t, rx, ry, inkW * 0.8);
    }

    // face: blink, and react
    this.blinkT -= dt; if (this.blinkT < -0.11) this.blinkT = 1.4 + Math.random() * 3.2;
    const expr = this.wow > 0 ? 'wow' : this.happy > 0.25 ? 'happy' : this.grit > 0 ? 'grit' : this.blinkT < 0 ? 'blink' : 'neutral';
    if (expr !== this.expr) { this.expr = expr; this.faceMat.map = faceTexture(this.hero, expr); }

    // flat comic shadow
    const lift = Math.max(0, Math.min(j.anL.y, j.anR.y) - rig.floorY);
    const sw = (0.95 * S) / (1 + lift * 0.35);
    this.shadow.position.set(j.hipC.x, rig.floorY + 0.03, 0.15); this.shadow.scale.set(sw, sw * 0.62, 1); this.shadow.material.opacity = 0.34 / (1 + lift * 0.5);
  }

  dispose() { this.group.removeFromParent(); for (const m of this.allMats) m.dispose(); this.ink.dispose(); this.inkThin.dispose(); for (const r of this.ribbons) { r.mesh.geometry.dispose(); r.mesh.material.dispose(); } }
}
