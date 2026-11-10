// Turbo Trot: a running race where you run on the spot. Every knee you lift
// (or arm you pump) pushes your lane of track along. Jump the hurdles or
// stumble, and be first through the finish arch.
import * as THREE from 'three';
import { toonMat } from '../toon.js';
import { rnd, clamp, GEO, INKS, INK_THIN, whiteM, flat, inked } from './kit.js';

const RACE = 150, U = 1.7, LIMIT = 62;           // metres to run, stage units per metre, seconds allowed
const HURDLES = [16, 31, 47, 62, 78, 95, 110, 126, 139];
const POST = toonMat(0xffffff), BAR = toonMat(0xff5a78), CONE = toonMat(0xff9248);
let CHECK = null;
function checker() {
  if (CHECK) return CHECK; const c = document.createElement('canvas'); c.width = 256; c.height = 64; const g = c.getContext('2d');
  for (let y = 0; y < 2; y++) for (let x = 0; x < 8; x++) { g.fillStyle = (x + y) % 2 ? '#140c2a' : '#fff'; g.fillRect(x * 32, y * 32, 32, 32); }
  CHECK = new THREE.CanvasTexture(c); CHECK.colorSpace = THREE.SRGBColorSpace; CHECK.magFilter = THREE.NearestFilter; return CHECK;
}
const trackMat = (color) => new THREE.ShaderMaterial({
  transparent: true, uniforms: { uOff: { value: 0 }, uColor: { value: new THREE.Color(color) } },
  vertexShader: `varying vec2 vU; varying float vZ; void main(){ vU=uv; vec4 w=modelMatrix*vec4(position,1.0); vZ=w.z; gl_Position=projectionMatrix*viewMatrix*w; }`,
  fragmentShader: `varying vec2 vU; varying float vZ; uniform float uOff; uniform vec3 uColor;
    void main(){ float s=uOff-vZ; vec3 c=mix(vec3(0.93,0.42,0.30),vec3(0.86,0.34,0.27),step(0.5,fract(s/6.8)));
      c=mix(c,vec3(1.0),step(fract(s/3.4),0.05)*0.85); c=mix(c,uColor,smoothstep(2.6,0.0,abs(vZ))*0.55);
      float edge=step(0.47,abs(vU.x-0.5)); c=mix(c,vec3(1.0),edge);
      gl_FragColor=vec4(c,1.0-smoothstep(38.0,66.0,-vZ)); }`,
});

export class TurboTrot {
  static id = 'trot'; static title = 'Turbo Trot'; static blurb = 'Run on the spot and jump the hurdles'; static icon = 'trot';
  static colors = ['#ff8a3d', '#d6304a']; static theme = 'meadow'; static music = 'race'; static stars = [900, 1500, 2000];
  static howto = ['Run on the spot: lift those knees!', 'Pumping your arms counts too', 'Jump when a hurdle reaches you', 'First through the finish arch wins'];

  constructor(app) {
    this.app = app; this.flowers = []; app.env.groups.meadow?.traverse(o => { if (o.name === 'flowers' && o.visible) { o.visible = false; this.flowers.push(o); } }); // the track needs a clear field
    this.lanes = {}; this.clock = 0; this.done = false; this.endAt = null; this.order = []; this.statusKey = '';
  }
  start() { this.app.hud.setTimer(LIMIT); this.app.hud.banner('Run!', '#ffd23f', 0.9); }
  idle(dt, t) { this.layout(dt, this.app.players); }

  lane(p) {
    let L = this.lanes[p.slot]; if (L) return L;
    const g = new THREE.Group(); this.app.root.add(g);
    const track = new THREE.Mesh(new THREE.PlaneGeometry(1, 80), trackMat(p.color)); track.rotation.x = -Math.PI / 2; track.position.z = -34; g.add(track);
    // hurdles: two posts and a striped bar
    const hurdles = HURDLES.map(at => {
      const h = new THREE.Group(); for (const sg of [-1, 1]) { const post = inked(GEO.box, POST, INK_THIN); post.scale.set(0.09, 0.62, 0.09); post.position.set(sg * 0.5, 0.31, 0); h.add(post); }
      const bar = inked(GEO.box, BAR, INKS); bar.scale.set(1.16, 0.16, 0.08); bar.position.y = 0.6; h.add(bar);
      for (let i = 0; i < 3; i++) { const w = new THREE.Mesh(GEO.box, whiteM); w.scale.set(0.16, 0.165, 0.085); w.position.set((i - 1) * 0.36, 0.6, 0); h.add(w); }
      h.visible = false; g.add(h); return { at, mesh: h, state: 0, best: 0, fall: 0 };
    });
    const cones = []; for (let i = 0; i < 10; i++) { const c = inked(GEO.cone, CONE, INK_THIN); c.scale.set(0.14, 0.34, 0.14); g.add(c); cones.push(c); }
    // the finish: a checkered banner between two tall posts
    const arch = new THREE.Group(); for (const sg of [-1, 1]) { const post = inked(GEO.cyl, toonMat(p.color), INKS); post.scale.set(0.09, 3.4, 0.09); post.position.set(sg * 0.5, 1.7, 0); arch.add(post); }
    const flag = new THREE.Mesh(GEO.box, new THREE.MeshBasicMaterial({ map: checker() })); flag.scale.set(1.0, 0.6, 0.05); flag.position.y = 3.1; arch.add(flag); arch.visible = false; g.add(arch);
    L = this.lanes[p.slot] = { slot: p.slot, g, track, hurdles, cones, arch, x: p.j.hipC.x, w: 3, dist: 0, v: 0, knee: 0, hand: 0, steps: 0, cleared: 0, time: null, stumble: 0, air: 0 };
    return L;
  }
  // share the stage out between whoever is playing, left to right in the order they stand
  layout(dt, players) {
    for (const s in this.lanes) if (!players.some(p => p.slot === +s)) { this.lanes[s].g.removeFromParent(); delete this.lanes[s]; }
    const sorted = [...players].sort((a, b) => a.j.hipC.x - b.j.hipC.x), n = sorted.length, W = Math.min(4.2, 15 / Math.max(1, n)), ground = Math.max(this.app.ground, this.app.env.floorY) + 0.03;
    sorted.forEach((p, i) => {
      const L = this.lane(p), tx = (i - (n - 1) / 2) * W; L.x += (tx - L.x) * Math.min(1, dt * 4); L.w += (W - 0.3 - L.w) * Math.min(1, dt * 4);
      L.g.position.set(L.x, ground + 0.03, 0); L.track.scale.x = L.w; L.track.material.uniforms.uOff.value = L.dist * U;
      const hw = L.w / 2;
      for (const h of L.hurdles) {
        const z = -(h.at - L.dist) * U; h.mesh.visible = z > -62 && z < 5; if (!h.mesh.visible) continue;
        h.mesh.position.z = z; h.mesh.scale.set(L.w * 0.86, 1, 1); h.mesh.rotation.x = -h.fall * 1.45;
      }
      L.cones.forEach((c, k) => { const zz = -(((k * 6.8 - L.dist * U) % 68) + 68) % 68 + 4; c.position.set((k % 2 ? 1 : -1) * (hw + 0.12), 0, zz); });
      const az = -(RACE - L.dist) * U; L.arch.visible = az > -64 && az < 6; L.arch.position.z = az; L.arch.scale.x = L.w;
    });
  }

  update(dt, t, players) {
    const { app } = this, { fx, audio, hud } = app, ground = app.ground;
    this.clock += dt; hud.setTimer(this.endAt !== null ? this.endAt - this.clock : LIMIT - this.clock);
    for (const p of players) {
      const L = this.lane(p), j = p.j, S = p.rig.S, s = p.slot, pts = p.rig.pts; if (L.time !== null) { L.v *= Math.exp(-1.5 * dt); L.dist += L.v * dt; continue; }
      // a stride is one swap of which knee (or which hand) is higher
      let push = 0;
      if (pts[25].v > 0.3 && pts[26].v > 0.3) { const d = (j.knL.y - j.knR.y) / S; if (Math.abs(d) > 0.1 && Math.sign(d) !== L.knee) { L.knee = Math.sign(d); push += 1; } }
      const hd = (j.haL.y - j.haR.y) / S; if (Math.abs(hd) > 0.22 && Math.sign(hd) !== L.hand) { L.hand = Math.sign(hd); push += 0.6; }
      L.stumble = Math.max(0, L.stumble - dt);
      if (push) { L.steps++; L.v += push * 1.3 * (L.stumble > 0 ? 0.4 : 1); if (L.steps % 2 === 0 && L.v > 2) fx.burst({ x: j.hipC.x + rnd(-0.3, 0.3), y: ground + 0.1, z: 0.3 }, { count: 3, color: 0xffffff, speed: 2, size: 0.18, life: 0.35, solid: 1 }); }
      L.v = Math.min(9, L.v * Math.exp(-0.95 * dt)); L.dist += L.v * dt;
      if (L.v > 6 && Math.random() < dt * 20) fx.spawn(j.hipC.x + rnd(-0.6, 0.6), ground + rnd(0.5, 3.6), 0.4, 0, 0, 9, 0xffffff, 0.09, 0.3, 0, 0.2);
      hud.setScore(s, app.scores[s], Math.max(0, Math.ceil(RACE - L.dist)) + ' m');
      // hurdles: the jump has to be in the air as the bar goes by
      const up = Math.max(p.rig.jump, clamp((Math.min(j.anL.y, j.anR.y) - ground - 0.25) / 0.3, 0, 1));
      for (const h of L.hurdles) {
        if (h.state === 2) { if (h.fall > 0 && h.fall < 1) h.fall = Math.min(1, h.fall + dt * 6); continue; }
        const gap = h.at - L.dist; if (gap > 0.7) break;
        h.state = 1; h.best = Math.max(h.best, up); if (gap > -0.5) continue;
        h.state = 2; const pos = { x: j.hipC.x, y: ground + 1.2, z: 0.5 };
        if (h.best > 0.25) { L.cleared++; L.v = Math.min(9, L.v + 1.2); app.addScore(s, 50, pos, { cheer: 0.5 }); audio.ding(79 + L.cleared); fx.ring({ x: j.hipC.x, y: ground + 0.4 }, p.color, 1.8, 0.35); if (L.cleared % 3 === 0) fx.word({ x: j.head.x, y: j.head.y + 1.2 }, 'FLYING!', '#fff', p.css); }
        else { h.fall = 0.01; L.v *= 0.3; L.stumble = 1; audio.bad(); audio.block(0); fx.shake(0.3); fx.pow(pos, 0xffffff, 1.1); fx.word(pos, 'OOF!', '#fff', '#ff5a78'); app.avatars[s]?.ouch(); }
      }
      if (L.dist >= RACE) {
        L.time = this.clock; this.order.push(s); const place = this.order.length, head = { x: j.head.x, y: j.head.y + 1.3 };
        app.addScore(s, 1000 + Math.max(0, Math.round((48 - L.time) * 30)) - (place - 1) * 150, head, { cls: 'big', color: '#ffd23f', cheer: 1 });
        fx.word(head, ['1ST!', '2ND!', '3RD!', '4TH!'][place - 1], '#ffd23f', p.css); fx.confetti({ x: j.hipC.x, y: ground + 3 }, 60); audio.fanfare(); fx.speedLines(); hud.setScore(s, app.scores[s], L.time.toFixed(1) + ' s');
        if (place === 1 && players.length > 1) { this.endAt = Math.min(LIMIT, this.clock + 10); hud.banner(`${p.name} is home!`, p.css, 1.4, 'Everyone else: 10 seconds'); }
      }
    }
    this.layout(dt, players);
    // a race bar under the title: who is where
    const key = players.map(p => Math.round(Math.min(1, this.lanes[p.slot].dist / RACE) * 50)).join(',');
    if (key !== this.statusKey) { this.statusKey = key; hud.setStatus(`<span class="race">${players.map(p => `<i style="left:${Math.min(100, this.lanes[p.slot].dist / RACE * 100).toFixed(0)}%;background:${p.css}"></i>`).join('')}</span>`); }
    const left = players.filter(p => this.lanes[p.slot].time === null).length;
    if (!this.finT && players.length && left === 0) this.finT = this.clock + 1.6;
    if ((this.finT && this.clock > this.finT) || this.clock > (this.endAt ?? LIMIT)) {
      for (const p of players) { const L = this.lanes[p.slot]; if (L.time === null) app.addScore(p.slot, Math.round(L.dist * 4), null); }
      this.done = true;
    }
  }

  results() {
    const times = Object.values(this.lanes).filter(L => L.time !== null).map(L => L.time);
    return { note: times.length ? `Fastest run: ${Math.min(...times).toFixed(1)} seconds` : 'So close! Lift those knees a little faster' };
  }
  botIntent(i, p, bot, t, playing) {
    if (!playing || !p) return {};
    const L = this.lanes[p.slot]; if (!L || L.time !== null) return { arms: [[150, 10], [150, 10]] };
    const up = Math.sin(t * [4.2, 3.5, 4.6, 3.1][i] * Math.PI + i) > 0, next = L.hurdles.find(h => h.state < 2);
    return { legs: [{ lift: up ? 0.2 : 0 }, { lift: up ? 0 : 0.2 }], arms: [[up ? 14 : 44, 80], [up ? 44 : 14, 80]], jump: !!next && next.at - L.dist < 0.6 + L.v * 0.12 && (i !== 1 || next.at !== 62), followPointer: false, snap: 20 };
  }
  dispose() { for (const s in this.lanes) this.lanes[s].g.removeFromParent(); for (const o of this.flowers) o.visible = true; }
}
