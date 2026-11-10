// Who is who: the hero roster, heroes that players build themselves, which
// hero each player slot uses, and little portraits rendered from the real 3D
// characters for the menus.
import * as THREE from 'three';
import { Avatar, HEROES, HAIR_STYLES, EMBLEMS } from './avatar.js';
import { Rig, PLAYER_COLORS, PLAYER_CSS, PLAYER_NAMES } from './tracking.js';
import { buildSkeleton } from './sim.js';

const KEY = 'ww-heroes-v1';
const hexCss = (c) => '#' + new THREE.Color(c).getHexString();

export const PALETTE = {
  main: [0xff4d6d, 0xff8a3d, 0xffc21a, 0x6fd934, 0x19c9c0, 0x4d8dff, 0x9a5bff, 0xf04ad0, 0xf6f2ff, 0x4a4f73],
  accent: [0xffd23f, 0xff7ab8, 0x23e6ff, 0x7dffb0, 0xff5a36, 0xffffff, 0xb48cff, 0x8dff5a],
  hair: [0x241a3a, 0x5a3a22, 0xb5651d, 0xf4d35e, 0xf1ecff, 0xff5a5a, 0xff8fe0, 0x4046d8, 0x16b8a6, 0x8dff5a],
  skin: [0xffdcc2, 0xffcfa8, 0xe8b088, 0xc98a5e, 0xa5694a, 0x6f4530],
};
export const CUTS = ['hoodie', 'tee', 'flares'];
export const EXTRAS = ['none', 'scarf', 'cape'];
export const NAMES = ['Ace', 'Blip', 'Comet', 'Dash', 'Echo', 'Fizz', 'Gizmo', 'Halo', 'Jinx', 'Kiwi', 'Luna', 'Moxie', 'Nix', 'Orbit', 'Pip', 'Quill', 'Rocket', 'Sky', 'Turbo', 'Vex', 'Wink', 'Yoyo', 'Zap', 'Zuzu'];
export { HAIR_STYLES, EMBLEMS };

// A hero someone made is stored as a handful of choices; the rest of the outfit follows from them.
export function makeHero(c) {
  const dark = new THREE.Color(0x2a2a6c).lerp(new THREE.Color(c.main), 0.07).getHex();
  return {
    id: c.id, name: c.name, custom: c, main: c.main, accent: c.accent, skin: c.skin, hair: c.hair, hairStyle: c.hairStyle, emblem: c.emblem, extra: c.extra,
    dark, shin: c.cut === 'tee' ? 0xffffff : dark, glove: c.cut === 'flares' ? c.accent : 0xffffff, shoe: c.accent, long: c.cut !== 'tee', flare: c.cut === 'flares',
  };
}
const pick = (a) => a[Math.floor(Math.random() * a.length)];
export function randomChoices() {
  const main = pick(PALETTE.main); let accent = pick(PALETTE.accent); if (accent === main) accent = 0xffffff;
  return { name: pick(NAMES), main, accent, skin: pick(PALETTE.skin), hair: pick(PALETTE.hair), hairStyle: pick(HAIR_STYLES), emblem: pick(EMBLEMS), extra: pick(EXTRAS), cut: pick(CUTS) };
}
// The choices that would rebuild a ready-made hero, as a starting point for the creator.
export function choicesOf(h) {
  if (h.custom) return { ...h.custom };
  return { name: h.name, main: h.main, accent: h.accent, skin: h.skin, hair: h.hair, hairStyle: h.hairStyle === 'cap' ? 'spikes' : h.hairStyle, emblem: h.emblem, extra: h.extra || 'none', cut: h.flare ? 'flares' : h.long ? 'hoodie' : 'tee' };
}

export class HeroBook {
  constructor() {
    this.customs = []; this.picks = ['ember', 'zeph', 'volt', 'nova'];
    try {
      const d = JSON.parse(localStorage.getItem(KEY) || 'null');
      if (d && Array.isArray(d.customs)) this.customs = d.customs.filter(c => c && c.id && c.hairStyle).slice(0, 4);
      if (d && Array.isArray(d.picks)) d.picks.slice(0, 4).forEach((id, i) => { if (this.byId(id)) this.picks[i] = id; });
    } catch (e) { /* start fresh */ }
    for (let s = 0; s < 4; s++) this.apply(s);
  }
  save() { try { localStorage.setItem(KEY, JSON.stringify({ customs: this.customs, picks: this.picks })); } catch (e) { /* fine */ } }
  get roster() { return [...HEROES, ...this.customs.map(makeHero)]; }
  byId(id) { return this.roster.find(h => h.id === id) || null; }
  hero(slot) { return this.temp?.[slot] || this.byId(this.picks[slot]) || HEROES[slot]; }
  takenBy(id) { return this.picks.indexOf(id); }
  // the game's colour and name for a player slot follow the hero in it
  apply(slot) { const h = this.hero(slot); PLAYER_COLORS[slot] = h.main; PLAYER_CSS[slot] = hexCss(h.main); PLAYER_NAMES[slot] = h.name; }
  choose(slot, id) { this.picks[slot] = id; if (this.temp) this.temp[slot] = null; this.apply(slot); this.save(); }
  // a hero being edited is worn but not saved yet
  wear(slot, hero) { this.temp = this.temp || []; this.temp[slot] = hero; this.apply(slot); }
  keep(slot, choices) {
    const c = { ...choices, id: choices.id || 'made-' + Date.now().toString(36) };
    const i = this.customs.findIndex(x => x.id === c.id);
    if (i >= 0) this.customs[i] = c; else { if (this.customs.length >= 4) { const old = this.customs.find(x => !this.picks.includes(x.id) || this.picks[slot] === x.id) || this.customs[0]; this.customs.splice(this.customs.indexOf(old), 1); } this.customs.push(c); }
    for (let s = 0; s < 4; s++) if (!this.byId(this.picks[s])) this.picks[s] = HEROES[s].id;
    this.choose(slot, c.id); return c;
  }
}

// ------------------------------------------------------------------ portraits
let studio = null;
const LUT = Uint8Array.from({ length: 256 }, (_, i) => { const c = i / 255; return Math.round(255 * (c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055)); });
const shots = new Map();
// A head-and-shoulders picture of a hero, as a data URL. Drawn once and remembered.
export function portrait(renderer, hero, size = 224, full = false) {
  const key = JSON.stringify([hero.main, hero.dark, hero.accent, hero.skin, hero.hair, hero.hairStyle, hero.emblem, hero.extra, hero.long, hero.flare, size, full]);
  if (shots.has(key)) return shots.get(key);
  if (!studio) {
    studio = { scene: new THREE.Scene(), cam: new THREE.OrthographicCamera(-1.32, 1.32, 1.32, -1.32, 0.1, 40), rig: new Rig(), canvas: document.createElement('canvas') };
    studio.cam.position.set(0, 0, 13);
  }
  if (!studio.rt || studio.rt.width !== size) { studio.rt?.dispose(); studio.rt = new THREE.WebGLRenderTarget(size, size, { samples: 4 }); studio.buf = new Uint8Array(size * size * 4); }
  const { scene, cam, rig, rt, buf, canvas } = studio;
  const a = new Avatar(hero); a.pop = 1; a.popV = 0; scene.add(a.group);
  const P = buildSkeleton({ x: 0, floor: -3.7, h: 4.4, arms: full ? [[38, 14], [38, 14]] : [[24, 18], [24, 18]], tilt: 0.06 });
  for (let k = 0; k < 33; k++) { const p = rig.pts[k]; p.x = P[k][0]; p.y = P[k][1]; p.v = 1; }
  for (let i = 0; i < 24; i++) { rig.solve(1 / 30); a.pop = 1; a.popV = 0; a.blinkT = 2; a.update(rig, 1 / 30, i / 30); }
  a.shadow.visible = false;
  // head and shoulders, or the whole outfit
  const half = full ? 2.5 : 1.32; cam.left = -half; cam.right = half; cam.top = half; cam.bottom = -half; cam.updateProjectionMatrix();
  cam.position.set(rig.j.nose.x, full ? -3.7 + 2.42 : rig.j.nose.y - 0.12 * rig.S, 13); cam.updateMatrixWorld();
  const prev = renderer.getRenderTarget(), col = new THREE.Color(); renderer.getClearColor(col); const alpha = renderer.getClearAlpha();
  renderer.setRenderTarget(rt); renderer.setClearColor(0x000000, 0); renderer.clear(); renderer.render(scene, cam);
  renderer.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  renderer.setRenderTarget(prev); renderer.setClearColor(col, alpha);
  scene.remove(a.group); a.dispose();
  canvas.width = canvas.height = size; const g = canvas.getContext('2d'), img = g.createImageData(size, size);
  // the picture comes back upside down and in linear light: flip it and encode it for the screen
  for (let y = 0; y < size; y++) { const src = (size - 1 - y) * size * 4, dst = y * size * 4; for (let i = 0; i < size * 4; i++) img.data[dst + i] = (i & 3) === 3 ? buf[src + i] : LUT[buf[src + i]]; }
  g.putImageData(img, 0, 0);
  const url = canvas.toDataURL('image/png'); shots.set(key, url); return url;
}
