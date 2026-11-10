// Comet Keeper: comets fly out of deep space toward the players. Block them
// with any part of your body before they hit the shield, and step out of the
// way of the dark void mines. Everyone shares the shield.
import * as THREE from 'three';

const sph = new THREE.SphereGeometry(1, 20, 14);
const ringGeo = new THREE.RingGeometry(0.9, 1, 48);
const mineGeo = new THREE.IcosahedronGeometry(1, 0);
const rnd = (a, b) => a + Math.random() * (b - a);
const lerp = (a, b, k) => a + (b - a) * k;
const KIND = {
  comet: { color: 0x4fd8ff, r: 0.42, hit: 0.95 },
  gold: { color: 0xffd23f, r: 0.36, hit: 0.9 },
  mine: { color: 0xff3d7f, r: 0.6, hit: 0.85 },
};
const ZS = -90;

export class CometKeeper {
  static id = 'comet'; static title = 'Comet Keeper'; static blurb = 'Block the comets, dodge the mines'; static icon = 'comet';
  static colors = ['#5b6bff', '#1a1060']; static theme = 'space'; static music = 'comet'; static stars = [500, 1100, 1800];
  static howto = ['Block blue and gold comets with any part of your body', 'Watch the rings to see where they will land', 'Step away from the red mines', 'Protect the shield together'];

  constructor(app) { this.app = app; this.items = []; this.time = 70; this.elapsed = 0; this.spawnT = 1; this.hearts = 5; this.done = false; this.streak = 0; this.turn = 0; this.flash = 0; }
  start() { this.showHearts(); this.app.hud.setTimer(this.time); }
  showHearts() { this.app.hud.setStatus('Shield ' + [0, 1, 2, 3, 4].map(i => `<span class="heart ${i < this.hearts ? '' : 'off'}">♥</span>`).join('')); }

  spawn(type, p, avoid) {
    const K = KIND[type], floor = this.app.floorY, H = THREE.MathUtils.clamp(p.rig.standH || 3.5, 2, 6.5);
    let tx, ty;
    if (type === 'mine') { tx = p.j.hipC.x; ty = floor + 0.62 * H; }
    else { for (let k = 0; k < 6; k++) { tx = p.j.hipC.x + rnd(-0.44, 0.44) * H; ty = floor + rnd(0.28, 1.2) * H; if (!avoid || Math.hypot(tx - avoid.tx, ty - avoid.ty) > 1.6) break; } }
    tx = THREE.MathUtils.clamp(tx, -7.3, 7.3); ty = THREE.MathUtils.clamp(ty, -4, 4);
    const g = new THREE.Group();
    if (type === 'mine') {
      const m = new THREE.Mesh(mineGeo, new THREE.MeshStandardMaterial({ color: 0x2a0f3f, roughness: 0.4, flatShading: true, emissive: 0xff2060, emissiveIntensity: 0.5 })); g.add(m);
      const wf = new THREE.Mesh(mineGeo, new THREE.MeshBasicMaterial({ color: K.color, wireframe: true })); wf.scale.setScalar(1.25); g.add(wf);
    } else {
      g.add(new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: new THREE.Color(K.color).lerp(new THREE.Color(0xffffff), 0.45) })));
      const halo = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending, depthWrite: false })); halo.scale.setScalar(1.7); g.add(halo);
    }
    g.scale.setScalar(K.r); this.app.root.add(g);
    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false })); ring.position.set(tx, ty, 0.2); this.app.root.add(ring);
    const dot = new THREE.Mesh(sph, new THREE.MeshBasicMaterial({ color: K.color, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false })); dot.scale.setScalar(0.12); ring.add(dot);
    const T = lerp(2.8, 1.75, Math.min(1, this.elapsed / 60));
    const it = { type, K, g, ring, tx, ty, sx: tx * 0.2 + rnd(-14, 14), sy: rnd(4, 22), k: 0, T, slot: p.slot, done: false };
    this.items.push(it); return it;
  }

  update(dt, t, players) {
    const { fx, audio, hud } = this.app;
    this.time -= dt; this.elapsed += dt; hud.setTimer(this.time);
    if (this.time <= 0 || this.hearts <= 0) {
      if (this.hearts > 0) for (const p of players) this.app.addScore(p.slot, this.hearts * 40, { x: p.j.head.x, y: p.j.head.y + 1.3 }, { text: `Shield bonus +${this.hearts * 40}` });
      this.done = true; return;
    }
    this.spawnT -= dt;
    if (this.spawnT <= 0 && players.length) {
      const p = players[this.turn++ % players.length]; const r = Math.random();
      const type = r < 0.16 && this.elapsed > 10 ? 'mine' : r < 0.28 ? 'gold' : 'comet';
      const a = this.spawn(type, p);
      if (type !== 'mine' && this.elapsed > 22 && Math.random() < 0.35) this.spawn('comet', p, a);
      this.spawnT = lerp(1.5, 0.62, Math.min(1, this.elapsed / 60)) / Math.sqrt(players.length);
    }

    for (let i = this.items.length - 1; i >= 0; i--) {
      const it = this.items[i], K = it.K;
      it.k += dt / it.T; const k = it.k, e = k * k * 0.35 + k * 0.65;
      const x = lerp(it.sx, it.tx, e), y = lerp(it.sy, it.ty, e) + Math.sin(e * Math.PI) * 2, z = lerp(ZS, 0, e);
      it.g.position.set(x, y, z); it.g.rotation.set(t * 2, t * 1.4, 0);
      if (it.type !== 'mine') for (let n = 0; n < 2; n++) fx.spawn(x + rnd(-0.2, 0.2), y + rnd(-0.2, 0.2), z - 0.5, rnd(-1, 1), rnd(-1, 1), -14, K.color, 0.5, 0.4, 0, 0.5);
      else if (Math.random() < dt * 25) fx.spawn(x, y, z, rnd(-2, 2), rnd(-2, 2), -6, K.color, 0.35, 0.4, 0, 1);
      it.ring.scale.setScalar(K.hit * (1 + (1 - Math.min(1, k)) * 1.3)); it.ring.material.opacity = Math.min(0.9, k * k * 1.3); it.ring.rotation.z = t * (it.type === 'mine' ? -3 : 1.5);

      // who is touching the landing spot?
      let who = null, at = null;
      if (k > 0.84) for (const p of players) {
        const j = p.j, S = p.rig.S;
        for (const pt of [j.haL, j.haR, j.ftL, j.ftR, j.head, j.elL, j.elR, j.knL, j.knR, j.chest, j.hipC]) if (Math.hypot(pt.x - it.tx, pt.y - it.ty) < K.hit * 0.62 + 0.3 * S) { who = p; at = pt; break; }
        if (who) break;
      }
      const pos = { x: it.tx, y: it.ty, z: 0.4 };
      if (it.type === 'mine') {
        if (k < 1) continue;
        if (who) { this.loseHeart(pos, 'Boom!'); this.streak = 0; }
        else { const p = players.find(q => q.slot === it.slot); if (p) this.app.addScore(p.slot, 15, pos, { text: 'Dodged! +15', cls: 'small' }); audio.whoosh(false); }
        this.remove(i); continue;
      }
      if (who) {
        this.streak++; const pts = (it.type === 'gold' ? 60 : 20) + Math.min(30, this.streak * 2); const perfect = k > 0.93;
        this.app.addScore(who.slot, pts + (perfect ? 10 : 0), pos, { text: (perfect ? 'Perfect +' : '+') + (pts + (perfect ? 10 : 0)), color: it.type === 'gold' ? '#ffd23f' : undefined, cls: it.type === 'gold' || perfect ? 'big' : '', sub: this.streak >= 5 ? this.streak + ' streak' : '' });
        if (it.type === 'gold') audio.gold(); else audio.block(Math.min(12, this.streak));
        fx.burst(pos, { count: 36, colors: [K.color, 0xffffff], speed: 10, size: 0.3, gravity: 0 }); fx.ring(pos, K.color, 2.6, 0.4); fx.shake(0.14);
        if (this.streak % 10 === 0) { hud.banner(this.streak + ' in a row!', '#4fd8ff', 1); audio.cheer(1); }
        this.remove(i); continue;
      }
      if (k >= 1.03) { this.loseHeart(pos, 'Shield hit!'); this.streak = 0; this.remove(i); }
    }
  }
  loseHeart(pos, text) {
    const { fx, audio } = this.app; this.hearts--; this.showHearts(); audio.smash(); audio.bad(); fx.shake(0.8);
    fx.burst(pos, { count: 50, colors: [0xff3d7f, 0xffa0c0], speed: 12, size: 0.35 }); fx.ring(pos, 0xff3d7f, 9, 0.7); fx.popup(pos, text, '#ff7a9a', 'big');
    for (const s of [0, 1, 2, 3]) if (this.app.hud.chips[s]) this.app.hud.setScore(s, this.app.scores[s], '');
  }
  remove(i) { const it = this.items[i]; it.g.removeFromParent(); it.ring.removeFromParent(); this.items.splice(i, 1); }

  results() { return { title: this.hearts > 0 ? 'The shield held!' : 'Shield down!', note: this.hearts > 0 ? `${this.hearts} of 5 shield hearts left` : 'Try to block every comet next time' }; }
  lookTarget(p) { let b = null; for (const it of this.items) if (!b || it.k > b.k) b = it; return b ? { x: b.tx, y: b.ty } : null; }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const mine = this.items.filter(it => it.slot === p.slot).sort((a, b) => b.k - a.k);
    const hands = [null, null]; let x = bot.x; const reach = bot.h * 0.36;
    const danger = mine.find(it => it.type === 'mine' && it.k > 0.3);
    for (const it of mine) {
      if (it.type === 'mine' || it.k < 0.35) continue;
      if (Math.abs(it.tx - bot.x) > reach && !danger) { x = it.tx; }
      const side = it.tx >= bot.x ? 1 : 0; if (!hands[side]) hands[side] = { x: it.tx, y: it.ty }; else if (!hands[1 - side]) hands[1 - side] = { x: it.tx, y: it.ty };
    }
    if (danger) { const dir = (bot.x - danger.tx) >= 0 ? 1 : -1; x = danger.tx + dir * bot.h * 0.55; if (Math.abs(x) > 7) x = danger.tx - dir * bot.h * 0.55; for (let s = 0; s < 2; s++) hands[s] = hands[s] && Math.abs(hands[s].x - danger.tx) > 1.2 ? hands[s] : null; }
    return { hands, x, handSpeed: 12 };
  }
  dispose() { for (const it of this.items) { it.g.removeFromParent(); it.ring.removeFromParent(); } }
}
