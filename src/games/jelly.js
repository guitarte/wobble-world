// Jelly Jam: pop drifting jellies with any part of your body. Combos, gold
// jellies, giant jellies that split, a rainbow jelly that starts a frenzy, and
// spiky urchins to avoid.
import * as THREE from 'three';

const sph = new THREE.SphereGeometry(1, 24, 16);
const dome = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.62);
const tent = new THREE.CylinderGeometry(0.05, 0.02, 1, 6); tent.translate(0, -0.5, 0);
const spike = new THREE.ConeGeometry(0.16, 0.6, 8); spike.translate(0, 0.3, 0);
const COLORS = [0xff7fb0, 0x7fe3ff, 0xb18cff, 0x8dffb0, 0xffa66b];
const rnd = (a, b) => a + Math.random() * (b - a);
const eyeM = new THREE.MeshBasicMaterial({ color: 0x24143a });

function makeJelly(type) {
  const g = new THREE.Group();
  const color = type === 'gold' ? 0xffd23f : type === 'rainbow' ? 0xffffff : COLORS[Math.floor(Math.random() * COLORS.length)];
  const mat = new THREE.MeshPhysicalMaterial({ color, roughness: 0.15, clearcoat: 1, transparent: true, opacity: 0.82, emissive: color, emissiveIntensity: type === 'gold' ? 0.7 : 0.35, side: THREE.DoubleSide });
  const d = new THREE.Mesh(dome, mat); d.scale.set(1, 0.95, 1); d.position.y = -0.15; g.add(d);
  const core = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.6) })); core.scale.setScalar(0.34); core.position.y = 0.1; g.add(core);
  const tents = [];
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(tent, mat); t.position.set((i - 2) * 0.32, -0.45, 0.1 * (i % 2)); t.scale.y = rnd(0.7, 1.1); g.add(t); tents.push(t); }
  for (const sg of [-1, 1]) { const e = new THREE.Mesh(sph, eyeM); e.scale.set(0.09, 0.12, 0.05); e.position.set(sg * 0.3, 0.05, 0.86); g.add(e); }
  g.userData = { mat, tents, color, dome: d };
  return g;
}
function makeUrchin() {
  const g = new THREE.Group();
  const m = new THREE.MeshStandardMaterial({ color: 0x3a1d5c, roughness: 0.5, emissive: 0xff2d6f, emissiveIntensity: 0.25 });
  g.add(new THREE.Mesh(sph, m)); g.children[0].scale.setScalar(0.62);
  const tip = new THREE.MeshBasicMaterial({ color: 0xff4f7d });
  for (let i = 0; i < 16; i++) { const s = new THREE.Mesh(spike, i % 3 ? m : tip); const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-0.6, 0.6)).normalize(); s.position.copy(v).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); g.add(s); }
  for (const sg of [-1, 1]) { const e = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0xffffff })); e.scale.set(0.13, 0.09, 0.05); e.position.set(sg * 0.22, 0.08, 0.6); e.rotation.z = sg * 0.5; g.add(e); }
  g.userData = { color: 0xff4f7d, tents: [] };
  return g;
}

export class JellyJam {
  static id = 'jelly'; static title = 'Jelly Jam'; static blurb = 'Pop the jellies, dodge the spiky ones'; static icon = 'jelly';
  static colors = ['#25d6c8', '#0c69ad']; static theme = 'reef'; static music = 'jelly'; static stars = [1000, 2500, 4500];
  static howto = ['Pop jellies with your hands, feet or head', 'Keep popping to build a combo', 'Gold jellies are worth 50', 'Stay away from the spiky urchins'];

  constructor(app) {
    this.app = app; this.items = []; this.time = 70; this.done = false; this.spawnT = 0; this.elapsed = 0; this.frenzy = 0;
    this.combo = [0, 0, 0, 0]; this.comboT = [0, 0, 0, 0]; this.stun = [0, 0, 0, 0]; this.rainbowAt = [22, 48]; this.hurry = false;
  }
  start() { this.app.hud.setTimer(this.time); }

  spawn(type, x, y, small) {
    const urchin = type === 'urchin';
    const mesh = urchin ? makeUrchin() : makeJelly(type); this.app.root.add(mesh);
    const r = small ? 0.42 : type === 'big' ? 1.2 : type === 'gold' ? 0.52 : urchin ? 0.7 : rnd(0.6, 0.78);
    const players = this.app.players;
    if (x === undefined) {
      x = rnd(-7.2, 7.2);
      if (players.length && Math.random() < 0.65) { const p = players[Math.floor(Math.random() * players.length)]; x = THREE.MathUtils.clamp(p.j.hipC.x + rnd(-3.2, 3.2), -7.4, 7.4); }
      y = -5.6 - r;
    }
    const sp = (type === 'gold' ? 2.9 : type === 'big' ? 1.1 : rnd(1.3, 2.1)) * (1 + this.elapsed / 120);
    const it = { mesh, type, x, y, r, vy: sp, vx: small ? rnd(-2, 2) : 0, ph: rnd(0, 6), hp: type === 'big' ? 3 : 1, cool: 0, age: 0, dead: 0, hue: rnd(0, 1) };
    mesh.position.set(x, y, 0); mesh.scale.setScalar(0.01); this.items.push(it); return it;
  }

  update(dt, t, players) {
    const { fx, audio, hud } = this.app;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 10 && !this.hurry) { this.hurry = true; hud.banner('Hurry!', '#ffc531', 1); }
    if (this.time <= 0) { this.done = true; return; }
    if (this.frenzy > 0) { this.frenzy -= dt; if (this.frenzy <= 0) hud.setStatus(''); }
    if (this.rainbowAt.length && this.elapsed > this.rainbowAt[0]) { this.rainbowAt.shift(); this.spawn('rainbow'); }

    // spawning
    const rate = (1.0 + this.elapsed / 70 * 1.5 + players.length * 0.35) * (this.frenzy > 0 ? 3 : 1);
    this.spawnT -= dt * rate;
    while (this.spawnT <= 0) {
      this.spawnT += 1; const r = Math.random();
      const type = this.frenzy > 0 ? (r < 0.3 ? 'gold' : 'norm') : (r < 0.1 && this.elapsed > 10 ? 'urchin' : r < 0.18 ? 'gold' : r < 0.25 ? 'big' : 'norm');
      this.spawn(type);
    }

    for (let s = 0; s < 4; s++) { this.stun[s] -= dt; if (this.combo[s] > 0) { this.comboT[s] -= dt; if (this.comboT[s] <= 0) { this.combo[s] = 0; hud.setScore(s, this.app.scores[s], ''); } } }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh, ud = m.userData;
      if (it.dead > 0) { it.dead -= dt * 5; m.scale.setScalar(it.r * (1 + (1 - it.dead) * 0.8)); if (it.dead <= 0) { m.removeFromParent(); this.items.splice(i, 1); } continue; }
      it.age += dt; it.cool -= dt;
      it.y += it.vy * dt; it.x += (Math.sin(t * 1.3 + it.ph) * 0.7 + it.vx) * dt; it.vx *= Math.exp(-2 * dt);
      const pulse = Math.sin(t * 4 + it.ph);
      const grow = Math.min(1, it.age * 4);
      m.position.set(it.x, it.y, 0);
      if (it.type === 'urchin') { m.scale.setScalar(it.r * grow * 1.15); m.rotation.z = t * 0.8 + it.ph; }
      else {
        m.scale.set(it.r * grow * (1 - pulse * 0.08), it.r * grow * (1 + pulse * 0.1), it.r * grow); m.rotation.z = Math.sin(t * 1.3 + it.ph) * 0.2;
        ud.tents.forEach((tn, k) => { tn.rotation.z = Math.sin(t * 5 + it.ph + k) * 0.35; });
        if (it.type === 'rainbow') { ud.mat.color.setHSL((t * 0.4 + it.hue) % 1, 0.9, 0.62); ud.mat.emissive.copy(ud.mat.color); }
      }
      if (it.type === 'gold' && Math.random() < dt * 20) fx.spawn(it.x + rnd(-0.4, 0.4), it.y + rnd(-0.4, 0.4), 0.3, 0, -0.5, 0, 0xffd23f, 0.16, 0.5, 0, 1);
      if (it.y > 5.8 + it.r) { m.removeFromParent(); this.items.splice(i, 1); continue; }
      if (it.cool > 0) continue;
      // touch test
      let hitBy = null, hitAt = null;
      for (const p of players) {
        if (this.stun[p.slot] > 0) continue; const S = p.rig.S, j = p.j;
        const pts = [[j.haL, 0.36], [j.haR, 0.36], [j.ftL, 0.3], [j.ftR, 0.3], [j.head, 0.5]];
        for (const [pt, pr] of pts) { if (Math.hypot(pt.x - it.x, pt.y - it.y) < it.r * (it.type === 'urchin' ? 0.8 : 1) + pr * S) { hitBy = p; hitAt = pt; break; } }
        if (hitBy) break;
      }
      if (!hitBy) continue;
      const s = hitBy.slot, pos = { x: it.x, y: it.y, z: 0.5 };
      if (it.type === 'urchin') {
        this.stun[s] = 1.2; this.combo[s] = 0; audio.bad(); fx.shake(0.5); fx.burst(pos, { count: 26, colors: [0xff4f7d, 0x6a2ca0], speed: 8 });
        this.app.addScore(s, -30, pos, { text: 'Ouch! -30', color: '#ff7a9a', sub: '' }); it.dead = 1; continue;
      }
      it.hp--; it.cool = 0.25;
      if (it.hp > 0) { audio.block(it.hp * 3); fx.burst(pos, { count: 12, color: ud.color, speed: 5 }); it.vy += 0.6; it.r *= 0.92; this.app.addScore(s, 5, pos, { cls: 'small' }); continue; }
      this.combo[s]++; this.comboT[s] = 2.2; const c = this.combo[s]; const mult = Math.min(5, 1 + Math.floor(c / 5)) * (this.frenzy > 0 ? 2 : 1);
      const base = it.type === 'gold' ? 50 : it.type === 'big' ? 30 : it.type === 'rainbow' ? 100 : 10;
      this.app.addScore(s, base * mult, pos, { sub: mult > 1 ? 'x' + mult : '', cls: it.type === 'norm' ? '' : 'big', color: it.type === 'gold' ? '#ffd23f' : undefined });
      if (c % 5 === 0) { fx.popup({ x: hitBy.j.head.x, y: hitBy.j.head.y + 1.4 }, c + ' combo!', '#fff', 'small'); audio.ding(79 + Math.min(12, c / 5 * 2)); }
      if (it.type === 'gold') audio.gold(); else audio.pop(Math.min(10, c - 1));
      fx.burst(pos, { count: it.type === 'norm' ? 22 : 44, colors: [ud.color, 0xffffff], speed: 7, size: 0.26 }); fx.ring(pos, ud.color, it.r * 2.6, 0.45); fx.shake(it.type === 'norm' ? 0.05 : 0.2);
      if (it.type === 'big') for (let k = 0; k < 3; k++) { const n = this.spawn('norm', it.x + rnd(-0.5, 0.5), it.y + rnd(-0.3, 0.5), true); n.cool = 0.5; n.vx = (k - 1) * 3; n.vy = 2.4; }
      if (it.type === 'rainbow') { this.frenzy = 7; hud.banner('Jelly frenzy!', '#7fe3ff', 1.5, 'Double points'); hud.setStatus('Frenzy! x2'); audio.cheer(1.2); fx.confetti(pos, 50); }
      it.dead = 1;
    }
  }

  lookTarget(p) { let best = null, bd = 1e9; for (const it of this.items) { const d = Math.hypot(it.x - p.j.head.x, it.y - p.j.head.y); if (d < bd) { bd = d; best = it; } } return best; }

  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const sx = bot.x, sy = bot.floor + bot.h * 0.8, reach = bot.h * 0.36;
    const cands = this.items.filter(it => it.type !== 'urchin' && !it.dead && it.y > bot.floor && it.y < bot.floor + bot.h * 1.25).map(it => ({ it, d: Math.hypot(it.x - sx, it.y - sy) })).sort((a, b) => a.d - b.d);
    const hands = [null, null]; let goX;
    for (const c of cands) { if (c.d > reach + 0.6) { if (goX === undefined && Math.abs(c.it.x - bot.home) < 5) goX = c.it.x; continue; } const side = c.it.x >= sx ? 1 : 0; if (!hands[side]) hands[side] = { x: c.it.x, y: c.it.y }; }
    return { hands, x: goX ?? bot.x, handSpeed: 9 };
  }
  dispose() { for (const it of this.items) it.mesh.removeFromParent(); }
}
