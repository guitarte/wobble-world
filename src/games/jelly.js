// Jelly Jam: pop drifting jellies with any part of your body. Combos, gold
// jellies, giant jellies that split, a rainbow jelly that starts a frenzy,
// spiky urchins to avoid, and King Jelly, who shows up for the finale.
import * as THREE from 'three';
import { toonMat, inkMat, inked, shadeOf, INK } from '../toon.js';

const sph = new THREE.SphereGeometry(1, 24, 16);
const dome = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, 0, Math.PI * 0.6);
const skirt = new THREE.TorusGeometry(0.93, 0.13, 8, 28);
const tent = new THREE.CylinderGeometry(0.075, 0.03, 1, 6); tent.translate(0, -0.5, 0);
const spike = new THREE.ConeGeometry(0.17, 0.62, 8); spike.translate(0, 0.3, 0);
const crownG = new THREE.ConeGeometry(0.2, 0.5, 4); crownG.translate(0, 0.25, 0);
const disc = new THREE.CircleGeometry(1, 20);
const COLORS = [0xff6fa8, 0x4fd8ff, 0xa97bff, 0x5df0a0, 0xff9a4d];
const rnd = (a, b) => a + Math.random() * (b - a);
const hex = (c) => '#' + new THREE.Color(c).getHexString();
const inkM = new THREE.MeshBasicMaterial({ color: INK }), whiteM = new THREE.MeshBasicMaterial({ color: 0xffffff }), blushM = new THREE.MeshBasicMaterial({ color: 0xff3d7a, transparent: true, opacity: 0.55 });
const INKS = inkMat(0.045), INK_BIG = inkMat(0.06);
const smileG = new THREE.TorusGeometry(0.13, 0.03, 6, 12, Math.PI);

function face(g, z, y, s, angry) {
  for (const sg of [-1, 1]) {
    const w = new THREE.Mesh(disc, whiteM); w.scale.set(0.17 * s, 0.2 * s, 1); w.position.set(sg * 0.3 * s, y, z); g.add(w);
    const k = new THREE.Mesh(disc, inkM); k.scale.set(0.1 * s, 0.13 * s, 1); k.position.set(sg * 0.28 * s, y - 0.02 * s, z + 0.01); g.add(k);
    const h = new THREE.Mesh(disc, whiteM); h.scale.setScalar(0.04 * s); h.position.set(sg * 0.28 * s - 0.03 * s, y + 0.04 * s, z + 0.02); g.add(h);
    const b = new THREE.Mesh(disc, blushM); b.scale.set(0.12 * s, 0.07 * s, 1); b.position.set(sg * 0.52 * s, y - 0.2 * s, z - 0.03); g.add(b);
    if (angry) { const br = new THREE.Mesh(disc, inkM); br.scale.set(0.2 * s, 0.045 * s, 1); br.position.set(sg * 0.3 * s, y + 0.24 * s, z + 0.02); br.rotation.z = -sg * 0.45; g.add(br); }
  }
  const m = new THREE.Mesh(smileG, inkM); m.scale.setScalar(s); m.position.set(0, y - 0.14 * s, z + 0.01); m.rotation.z = angry ? 0 : Math.PI; if (angry) m.position.y -= 0.14 * s; g.add(m);
}

function makeJelly(type) {
  const g = new THREE.Group(), king = type === 'king';
  const color = type === 'gold' ? 0xffd23f : king ? 0xb04dff : type === 'rainbow' ? 0xffffff : COLORS[Math.floor(Math.random() * COLORS.length)];
  const mat = toonMat(color, { rim: 0xffffff, rimAmt: 0.8, side: THREE.DoubleSide }), light = toonMat(new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.45));
  const d = inked(dome, mat, king ? INK_BIG : INKS); d.scale.set(1, 0.95, 1); d.position.y = -0.15; g.add(d);
  const sk = inked(skirt, light, king ? INK_BIG : INKS); sk.rotation.x = Math.PI / 2; sk.position.y = -0.42; sk.scale.set(1, 1, 1.1); g.add(sk);
  const shine = new THREE.Mesh(disc, whiteM); shine.scale.set(0.2, 0.1, 1); shine.position.set(-0.42, 0.42, 0.72); shine.rotation.z = 0.6; g.add(shine);
  const tents = [];
  for (let i = 0; i < 5; i++) { const t = new THREE.Mesh(tent, light); t.position.set((i - 2) * 0.32, -0.5, 0.1 * (i % 2)); t.scale.y = rnd(0.7, 1.1); g.add(t); tents.push(t); }
  face(g, 0.93, 0.0, king ? 0.8 : 1, king);
  if (type === 'gold') { const st = new THREE.Mesh(crownG, whiteM); st.scale.set(0.5, 0.5, 0.2); st.position.set(0, 0.74, 0); g.add(st); }
  if (king) {
    const gold = toonMat(0xffd23f, { rim: 0xffffff });
    const band = inked(new THREE.CylinderGeometry(0.46, 0.5, 0.16, 16), gold, INKS); band.position.y = 0.76; g.add(band);
    for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2, c = inked(crownG, gold, INKS); c.position.set(Math.cos(a) * 0.4, 0.8, Math.sin(a) * 0.4); c.scale.set(0.8, 0.8 + (i % 2) * 0.3, 0.8); g.add(c); }
    const gem = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: 0xff4d6d })); gem.scale.setScalar(0.09); gem.position.set(0, 0.78, 0.5); g.add(gem);
  }
  g.userData = { mat, light, tents, color, dome: d };
  return g;
}
function makeUrchin() {
  const g = new THREE.Group();
  const m = toonMat(0x4a2378, { rim: 0xff4f7d }), tip = toonMat(0xff4f7d);
  const body = inked(sph, m, INKS); body.scale.setScalar(0.62); g.add(body);
  for (let i = 0; i < 14; i++) { const s = inked(spike, i % 3 ? m : tip, INKS); const v = new THREE.Vector3(rnd(-1, 1), rnd(-1, 1), rnd(-0.5, 0.5)).normalize(); s.position.copy(v).multiplyScalar(0.5); s.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), v); g.add(s); }
  for (const sg of [-1, 1]) {
    const e = new THREE.Mesh(disc, whiteM); e.scale.set(0.15, 0.11, 1); e.position.set(sg * 0.22, 0.06, 0.64); e.rotation.z = -sg * 0.5; g.add(e);
    const k = new THREE.Mesh(disc, inkM); k.scale.setScalar(0.055); k.position.set(sg * 0.2, 0.04, 0.65); g.add(k);
    const br = new THREE.Mesh(disc, inkM); br.scale.set(0.2, 0.05, 1); br.position.set(sg * 0.22, 0.2, 0.66); br.rotation.z = -sg * 0.6; g.add(br);
  }
  g.userData = { color: 0xff4f7d, tents: [], mat: m };
  return g;
}
const POPS = ['POP!', 'BLOOP!', 'SPLISH!', 'PLOP!'];

export class JellyJam {
  static id = 'jelly'; static title = 'Jelly Jam'; static blurb = 'Pop the jellies, dodge the spiky ones'; static icon = 'jelly';
  static colors = ['#25d6c8', '#0c69ad']; static theme = 'reef'; static music = 'jelly'; static stars = [1500, 3500, 6000]; static ar = true;
  static howto = ['Pop jellies with your hands, feet or head', 'Keep popping to build a combo', 'Stay away from the spiky urchins', 'Punch King Jelly when he shows up!'];

  constructor(app) {
    this.app = app; this.items = []; this.time = 75; this.done = false; this.spawnT = 0; this.elapsed = 0; this.frenzy = 0;
    this.combo = [0, 0, 0, 0]; this.comboT = [0, 0, 0, 0]; this.stun = [0, 0, 0, 0]; this.rainbowAt = [20, 42]; this.hurry = false; this.king = null; this.kingAt = 52; this.kingDone = false;
  }
  start() { this.app.hud.setTimer(this.time); }

  spawn(type, x, y, small) {
    const urchin = type === 'urchin';
    const mesh = urchin ? makeUrchin() : makeJelly(type); this.app.root.add(mesh);
    const k = this.app.ws, r = (small ? 0.42 : type === 'king' ? 1.75 : type === 'big' ? 1.2 : type === 'gold' ? 0.52 : urchin ? 0.7 : rnd(0.6, 0.78)) * k; // in mirror mode everything is sized to the players
    const players = this.app.players;
    if (x === undefined) {
      const w = this.app.tracker.playHalf - 0.6; x = rnd(-w, w);
      if (players.length && Math.random() < 0.65) { const p = players[Math.floor(Math.random() * players.length)]; x = THREE.MathUtils.clamp(p.j.hipC.x + rnd(-3.2, 3.2) * k, -w, w); }
      y = -5.6 - r;
    }
    const sp = (type === 'gold' ? 2.9 : type === 'big' ? 1.1 : rnd(1.3, 2.1)) * (1 + this.elapsed / 120) * (0.5 + 0.5 * k);
    const it = { mesh, type, x, y, r, vy: sp, vx: small ? rnd(-2, 2) : 0, ph: rnd(0, 6), hp: type === 'big' ? 3 : 1, cool: 0, age: 0, dead: 0, hue: rnd(0, 1), squash: 0 };
    mesh.position.set(x, y, 0); mesh.scale.setScalar(0.01); this.items.push(it); return it;
  }
  bossBar() { const k = this.king; this.app.hud.setStatus(k ? `<span class="bossbar"><b>King Jelly</b><i><u style="width:${Math.max(0, k.hp / k.max * 100).toFixed(0)}%"></u></i></span>` : ''); }

  update(dt, t, players) {
    const { fx, audio, hud } = this.app;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 10 && !this.hurry) { this.hurry = true; if (!this.king) hud.banner('Hurry!', '#ffc21a', 1); }
    if (this.time <= 0) { if (this.king) hud.setStatus(''); this.done = true; return; }
    if (this.frenzy > 0) { this.frenzy -= dt; if (this.frenzy <= 0 && !this.king) hud.setStatus(''); }
    if (this.rainbowAt.length && this.elapsed > this.rainbowAt[0]) { this.rainbowAt.shift(); this.spawn('rainbow'); }
    if (!this.king && !this.kingDone && this.elapsed > this.kingAt && players.length) {
      const k = this.king = this.spawn('king', 0, 7.5); k.max = k.hp = 14 + players.length * 8; k.vy = 0;
      hud.banner('King Jelly!', '#d59bff', 1.8, 'Punch him as fast as you can'); fx.speedLines(); audio.whoosh(false); audio.cheer(0.8); audio.hype(true); this.bossBar();
    }

    // spawning
    const rate = (1.0 + this.elapsed / 70 * 1.5 + players.length * 0.35) * (this.frenzy > 0 ? 3 : 1) * (this.king ? 0.45 : 1);
    this.spawnT -= dt * rate;
    while (this.spawnT <= 0) {
      this.spawnT += 1; const r = Math.random();
      const type = this.frenzy > 0 ? (r < 0.3 ? 'gold' : 'norm') : (r < 0.1 && this.elapsed > 10 ? 'urchin' : r < 0.18 ? 'gold' : r < 0.25 ? 'big' : 'norm');
      this.spawn(type);
    }

    for (let s = 0; s < 4; s++) { this.stun[s] -= dt; if (this.combo[s] > 0) { this.comboT[s] -= dt; if (this.comboT[s] <= 0) { this.combo[s] = 0; hud.setScore(s, this.app.scores[s], ''); } } }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], m = it.mesh, ud = m.userData;
      if (it.dead > 0) { it.dead -= dt * 5; const f = Math.floor((1 - it.dead) * 4) / 4; m.scale.setScalar(it.r * (1 + f * 0.9)); if (it.dead <= 0) { m.removeFromParent(); this.items.splice(i, 1); } continue; }
      it.age += dt; it.cool -= dt; it.squash = Math.max(0, it.squash - dt * 5);
      const pulse = Math.sin(t * 4 + it.ph), grow = Math.min(1, it.age * 4);
      if (it.type === 'king') { this.updateKing(it, dt, t, players, pulse); continue; }
      it.y += it.vy * dt; it.x += (Math.sin(t * 1.3 + it.ph) * 0.7 + it.vx) * dt; it.vx *= Math.exp(-2 * dt);
      m.position.set(it.x, it.y, 0);
      if (it.type === 'urchin') { m.scale.setScalar(it.r * grow * 1.15); m.rotation.z = t * 0.8 + it.ph; }
      else {
        const q = it.squash;
        m.scale.set(it.r * grow * (1 - pulse * 0.08 + q * 0.2), it.r * grow * (1 + pulse * 0.1 - q * 0.2), it.r * grow); m.rotation.z = Math.sin(t * 1.3 + it.ph) * 0.2;
        ud.tents.forEach((tn, k) => { tn.rotation.z = Math.sin(t * 5 + it.ph + k) * 0.35; });
        if (it.type === 'rainbow') { const c = ud.mat.uniforms.uColor.value.setHSL((t * 0.4 + it.hue) % 1, 0.95, 0.6); ud.mat.uniforms.uShade.value.copy(shadeOf(c)); ud.light.uniforms.uColor.value.copy(c).lerp(whiteM.color, 0.5); }
      }
      if (it.type === 'gold' && Math.random() < dt * 20) fx.spawn(it.x + rnd(-0.4, 0.4), it.y + rnd(-0.4, 0.4), 0.3, 0, -0.5, 0, 0xffd23f, 0.16, 0.5, 0, 1);
      if (it.y > 5.8 + it.r) { m.removeFromParent(); this.items.splice(i, 1); continue; }
      if (it.cool > 0) continue;
      // touch test
      let hitBy = null;
      for (const p of players) {
        if (this.stun[p.slot] > 0) continue; const S = p.rig.S, j = p.j;
        const pts = [[j.haL, 0.36], [j.haR, 0.36], [j.ftL, 0.3], [j.ftR, 0.3], [j.head, 0.5]];
        for (const [pt, pr] of pts) { if (Math.hypot(pt.x - it.x, pt.y - it.y) < it.r * (it.type === 'urchin' ? 0.8 : 1) + pr * S) { hitBy = p; break; } }
        if (hitBy) break;
      }
      if (!hitBy) continue;
      const s = hitBy.slot, pos = { x: it.x, y: it.y, z: 0.5 };
      if (it.type === 'urchin') {
        this.stun[s] = 1.2; this.combo[s] = 0; audio.bad(); fx.shake(0.5); fx.hitstop(0.08); fx.burst(pos, { count: 26, colors: [0xff4f7d, 0x6a2ca0], speed: 8 }); fx.pow(pos, 0xff4f7d, 1.3); fx.word(pos, 'OUCH!', '#fff', '#ff4f7d');
        this.app.addScore(s, -30, { x: it.x, y: it.y - 0.9 }, { text: '-30', color: '#ff7a9a', sub: '' }); this.app.avatars[s]?.ouch(); it.dead = 1; continue;
      }
      it.hp--; it.cool = 0.25;
      if (it.hp > 0) { audio.block(it.hp * 3); fx.burst(pos, { count: 12, color: ud.color, speed: 5 }); fx.pow(pos, 0xffffff, 0.8); it.squash = 1; it.vy += 0.6; it.r *= 0.92; this.app.addScore(s, 5, pos, { cls: 'small' }); continue; }
      this.combo[s]++; this.comboT[s] = 2.2; const c = this.combo[s]; const mult = Math.min(5, 1 + Math.floor(c / 5)) * (this.frenzy > 0 ? 2 : 1);
      const base = it.type === 'gold' ? 50 : it.type === 'big' ? 30 : it.type === 'rainbow' ? 100 : 10;
      this.app.addScore(s, base * mult, pos, { sub: mult > 1 ? 'x' + mult : '', cls: it.type === 'norm' ? '' : 'big', color: it.type === 'gold' ? '#ffd23f' : undefined });
      if (c % 5 === 0) { fx.word({ x: hitBy.j.head.x, y: hitBy.j.head.y + 1.5 }, c + ' COMBO!', '#fff', hitBy.css); audio.ding(79 + Math.min(12, c / 5 * 2)); }
      if (it.type === 'gold') { audio.gold(); fx.word(pos, 'KA-CHING!', '#ffd23f', '#fff'); } else audio.pop(Math.min(10, c - 1));
      if (it.type === 'big') { fx.word(pos, 'SPLAT!', '#fff', hex(ud.color)); fx.hitstop(0.06); }
      else if (it.type === 'norm' && Math.random() < 0.22) fx.word(pos, POPS[Math.floor(Math.random() * POPS.length)], '#fff', hex(ud.color)).classList.add('small');
      fx.pow(pos, ud.color, it.r * 1.5);
      fx.burst(pos, { count: it.type === 'norm' ? 16 : 36, colors: [ud.color, 0xffffff], speed: 7, size: 0.26 }); fx.ring(pos, ud.color, it.r * 2.4, 0.4); fx.shake(it.type === 'norm' ? 0.05 : 0.2);
      if (it.type === 'big') for (let k = 0; k < 3; k++) { const n = this.spawn('norm', it.x + rnd(-0.5, 0.5), it.y + rnd(-0.3, 0.5), true); n.cool = 0.5; n.vx = (k - 1) * 3; n.vy = 2.4; }
      if (it.type === 'rainbow') { this.frenzy = 7; hud.banner('Jelly frenzy!', '#7fe3ff', 1.5, 'Double points'); if (!this.king) hud.setStatus('Frenzy! x2'); audio.cheer(1.2); fx.confetti(pos, 50); fx.speedLines(); }
      it.dead = 1;
    }
  }

  // The boss floats above the players and takes a hit from every fast punch.
  updateKing(it, dt, t, players, pulse) {
    const { fx, audio, hud } = this.app, m = it.mesh, ud = m.userData, q = it.squash;
    it.x += (Math.sin(t * 0.7) * 3.6 - it.x) * Math.min(1, dt * 1.5); it.y += (1.9 + Math.sin(t * 1.1) * 0.6 - it.y) * Math.min(1, dt * 1.6);
    m.position.set(it.x + (Math.random() - 0.5) * q * 0.15, it.y, -0.3);
    m.scale.set(it.r * (1 + q * 0.18 - pulse * 0.05), it.r * (1 - q * 0.2 + pulse * 0.06), it.r); m.rotation.z = Math.sin(t * 1.3) * 0.12;
    ud.tents.forEach((tn, k) => { tn.rotation.z = Math.sin(t * 5 + k) * 0.35; });
    ud.mat.uniforms.uFlash.value = ud.light.uniforms.uFlash.value = q > 0.75 ? 0.5 : 0;
    for (const p of players) for (let h = 0; h < 2; h++) {
      const hd = p.rig.hands[h]; if (it.cool > 0 || it.hp <= 0 || Math.hypot(hd.x - it.x, hd.y - it.y) > it.r + 0.3 * p.rig.S || p.rig.handVel[h].length() < 2.2 * p.rig.S) continue;
      const pos = { x: (hd.x + it.x) / 2, y: (hd.y + it.y) / 2, z: 0.6 };
      it.hp--; it.cool = 0.13; it.squash = 1; audio.block(12 - (it.hp % 6)); fx.pow(pos, 0xffd23f, 0.9); fx.burst(pos, { count: 10, colors: [0xd59bff, 0xffffff], speed: 6 }); fx.shake(0.12);
      this.app.addScore(p.slot, 15, pos, { cls: 'small', cheer: 0.3 }); this.app.avatars[p.slot]?.focus(0.6); this.bossBar();
      if (it.hp % 6 === 0 && it.hp > 0) { fx.word(pos, ['BAM!', 'BIFF!', 'WHAM!'][(it.hp / 6) % 3], '#fff', '#ff4d6d'); const n = this.spawn('gold', it.x + rnd(-1, 1), it.y - 1, true); n.vy = 1.5; n.cool = 0.4; }
      if (it.hp <= 0) {
        const c = { x: it.x, y: it.y, z: 0.5 }; fx.hitstop(0.12); fx.speedLines(); fx.shake(0.9); fx.flash(0.2); audio.smash(); audio.cheer(1.5); audio.fanfare();
        fx.word(c, 'KA-POW!', '#ffd23f', '#ff4d6d'); fx.confetti(c, 90); fx.burst(c, { count: 70, colors: [0xb04dff, 0xffd23f, 0xffffff], speed: 12, size: 0.34 }); fx.ring(c, 0xffd23f, 6, 0.6);
        this.app.addScore(p.slot, 300, { x: it.x, y: it.y + 1.2 }, { cls: 'big', color: '#ffd23f', cheer: 1 });
        for (const o of players) if (o !== p) this.app.addScore(o.slot, 150, { x: o.j.head.x, y: o.j.head.y + 1.3 }, { text: 'Team bonus +150', cls: 'small', cheer: 1 });
        for (let k = 0; k < 6; k++) { const n = this.spawn('gold', it.x + rnd(-1.5, 1.5), it.y + rnd(-1, 1), true); n.vx = rnd(-4, 4); n.vy = rnd(0.5, 2.5); n.cool = 0.5; }
        this.king = null; this.kingDone = true; this.frenzy = Math.max(this.frenzy, 6); hud.setStatus('Frenzy! x2'); hud.banner('King Jelly popped!', '#ffd23f', 1.6, 'Jelly frenzy: double points'); it.dead = 1;
      }
    }
  }

  lookTarget(p) { let best = null, bd = 1e9; for (const it of this.items) { const d = Math.hypot(it.x - p.j.head.x, it.y - p.j.head.y); if (d < bd) { bd = d; best = it; } } return best; }

  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const sx = bot.x, sy = bot.floor + bot.h * 0.8, reach = bot.h * 0.36;
    if (this.king && this.king.y < 3.6) { // run under the king and punch upward with both fists in turn
      const k = this.king, up = Math.sin(t * 13 + i) > 0;
      const bx = k.x + (i - 1) * 1.7; return { x: bx, hands: [{ x: bx - 0.4, y: up ? k.y - 0.4 : sy - 0.4 }, { x: bx + 0.4, y: up ? sy - 0.4 : k.y - 0.4 }], handSpeed: 14 };
    }
    const cands = this.items.filter(it => it.type !== 'urchin' && it.type !== 'king' && !it.dead && it.y > bot.floor && it.y < bot.floor + bot.h * 1.25).map(it => ({ it, d: Math.hypot(it.x - sx, it.y - sy) })).sort((a, b) => a.d - b.d);
    const hands = [null, null]; let goX;
    for (const c of cands) { if (c.d > reach + 0.6) { if (goX === undefined && Math.abs(c.it.x - bot.home) < 5) goX = c.it.x; continue; } const side = c.it.x >= sx ? 1 : 0; if (!hands[side]) hands[side] = { x: c.it.x, y: c.it.y }; }
    return { hands, x: goX ?? bot.x, handSpeed: 9 };
  }
  dispose() { for (const it of this.items) it.mesh.removeFromParent(); }
}
