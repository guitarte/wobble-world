import '@fontsource/fredoka/400.css';
import '@fontsource/fredoka/500.css';
import '@fontsource/fredoka/600.css';
import '@fontsource/fredoka/700.css';
import '@fontsource/bangers/400.css';
import './style.css';
import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { ComicPass } from './comic.js';
import { TOON } from './toon.js';
import { MARKUP } from './markup.js';
import { Tracker, Rig, PLAYER_COLORS, PLAYER_CSS, PLAYER_NAMES } from './tracking.js';
import { SimSource, buildSkeleton } from './sim.js';
import { Avatar } from './avatar.js';
import { HeroBook, portrait, makeHero, choicesOf, PALETTE, CUTS, EXTRAS, NAMES, HAIR_STYLES, EMBLEMS } from './heroes.js';
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { Environment } from './env.js';
import { HUD, ICONS } from './hud.js';
import { JellyJam } from './games/jelly.js';
import { ShapeUp } from './games/walls.js';
import { CometKeeper } from './games/comet.js';
import { DanceClass, DanceBattle, GENRES, demoPose, lessonOf, lessonsDone, lessonMoves, DEBUG as DANCE } from './games/dance.js';
import { PaperChop } from './games/chop.js';
import { BalloonBop } from './games/balloon.js';
import { LaserLeap } from './games/laser.js';
import { WingIt } from './games/wing.js';
import { TurboTrot } from './games/trot.js';
import { PowBlocks } from './games/pow.js';
import { ToppleTower } from './games/topple.js';
import { FreezeFrame } from './games/freeze.js';
import { DotSays } from './games/dotsays.js';
import { WobbleBowl } from './games/bowl.js';
import { Mirror } from './mirror.js';
import { StageCam } from './stagecam.js';

// The game library, a page of five at a time. The mirror page needs a real camera: it
// shows the players themselves, in their own room, with the game drawn on top.
const PAGES = [
  { name: 'Action', games: [JellyJam, ShapeUp, CometKeeper, PaperChop, PowBlocks] },
  { name: 'Sports and party', games: [BalloonBop, WingIt, LaserLeap, TurboTrot, WobbleBowl] },
  { name: 'Dance and brain', games: [DanceClass, DanceBattle, FreezeFrame, DotSays, ToppleTower] },
  { name: 'Mirror mode', camera: true, opts: { ar: true }, games: [BalloonBop, PaperChop, JellyJam, PowBlocks, ToppleTower, FreezeFrame] },
];
const GAMES = [...new Set(PAGES.flatMap(p => p.games))];
// The hero creator, one choice at a time.
const STEPS = [
  { key: 'hairStyle', title: 'Hair', opts: HAIR_STYLES }, { key: 'hair', title: 'Hair colour', opts: PALETTE.hair, color: true }, { key: 'skin', title: 'Skin', opts: PALETTE.skin, color: true },
  { key: 'main', title: 'Outfit colour', opts: PALETTE.main, color: true }, { key: 'accent', title: 'Trim colour', opts: PALETTE.accent, color: true }, { key: 'cut', title: 'Outfit', opts: CUTS, full: true },
  { key: 'emblem', title: 'Badge', opts: EMBLEMS }, { key: 'extra', title: 'Extras', opts: EXTRAS, full: true }, { key: 'name', title: 'Name', opts: NAMES, text: true },
];
const LOOKS = { spikes: 'Spikes', tails: 'Twin tails', quiff: 'Quiff', flow: 'Long', afro: 'Curls', mohawk: 'Crest', bob: 'Bob', pony: 'Ponytail', buns: 'Buns', hoodie: 'Hoodie', tee: 'T-shirt', flares: 'Flares', none: 'Nothing', scarf: 'Scarf', cape: 'Cape' };
const cssOf = (c) => '#' + new THREE.Color(c).getHexString();
const cap = (t) => t[0].toUpperCase() + t.slice(1);
const CAM_D = 13;
const LOOK_UP = { x: 0, y: 3.2 };
const SITE = 'https://guitarte.github.io/wobble-world/';
const qs = new URLSearchParams(location.search);
const $ = (id) => document.getElementById(id);

class App {
  constructor() {
    this.rootEl = $('ww'); this.rootEl.innerHTML = MARKUP;
    const canvas = $('c');
    this.lowFx = qs.get('fx') === 'low';
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, powerPreference: 'high-performance' });
    this.renderer.toneMapping = THREE.NeutralToneMapping; this.renderer.toneMappingExposure = 1.0;
    // sharpness: start from what suited this device last time, and keep adjusting (see pace())
    this.prMax = +qs.get('pr') || Math.min(window.devicePixelRatio || 1, 1.75); this.prFloor = 0.75; this.prCeil = this.prMax; this.goodN = 0; this.lastStep = null;
    let saved = 0; try { saved = +localStorage.getItem('ww-pr') || 0; } catch (e) { /* fine */ }
    this.pixelRatio = qs.has('pr') || !saved ? this.prMax : THREE.MathUtils.clamp(saved, this.prFloor, this.prMax);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 600); this.camera.position.set(0, 0, CAM_D);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.38;
    this.env = new Environment(this.scene);
    this.root = new THREE.Group(); this.scene.add(this.root);       // game objects live here
    this.avatarRoot = new THREE.Group(); this.scene.add(this.avatarRoot);
    this.fx = new FX(this.scene, this.camera, $('popups'));
    this.cam = new StageCam(this.camera, CAM_D); this.fx.cam = this.cam;
    this.audio = new AudioEngine();
    this.hud = new HUD(this);
    this.heroes = new HeroBook(); this.page = 0;
    this.mirror = new Mirror(this); this.ar = false; this.ws = 1;
    this.tracker = new Tracker(); this.sim = null;
    this.avatars = new Array(4).fill(null);
    this.scores = [0, 0, 0, 0]; this.seen = new Set();
    this.phase = 'boot'; this.phaseT = 0; this.game = null; this.t = 0; this.last = performance.now(); this.floorY = -3.7;
    this.fpsAcc = 0; this.fpsN = 0; this.air = [0, 0, 0, 0]; this.ember = 0; this.awayT = 0; this.paused = false; this.awardQ = [];
    this.resetFeel();

    this.composer = new EffectComposer(this.renderer, new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, samples: 4 }));
    this.composer.addPass(new RenderPass(this.scene, this.camera));
    this.bloom = new UnrealBloomPass(new THREE.Vector2(256, 256), 0.38, 0.45, 1.0); this.composer.addPass(this.bloom);
    this.composer.addPass(new OutputPass());
    this.comic = new ComicPass(); this.composer.addPass(this.comic);

    this.tracker.onJoin = (p) => this.onJoin(p); this.tracker.onLeave = (p) => this.onLeave(p);
    window.addEventListener('resize', () => this.resize()); this.resize();
    window.addEventListener('pointermove', (e) => this.pointer(e)); window.addEventListener('pointerdown', (e) => this.pointer(e));
    window.addEventListener('keydown', (e) => { if (e.key === 'Escape' && this.phase !== 'boot' && this.phase !== 'menu') this.toMenu(); });
    $('b-cam').addEventListener('click', () => this.bootCamera());
    $('b-sim').addEventListener('click', () => this.bootSim(2));
    this.env.set('meadow');
    if (qs.has('sim')) this.bootSim(+qs.get('sim') || 2, true); else this.startDemo();
    this.renderer.setAnimationLoop(() => this.frame());
    if (qs.has('fps')) { this.fpsEl = document.createElement('div'); this.fpsEl.id = 'fps'; this.rootEl.appendChild(this.fpsEl); }
    window.__ww = this; this.dance = DANCE; // handy for testing
  }

  // ------------------------------------------------------------ boot
  async bootCamera() {
    const msg = $('boot-msg'), btn = $('b-cam'); btn.disabled = true; this.audio.init();
    try {
      msg.textContent = 'Asking for the camera…';
      let saved = null; try { saved = localStorage.getItem('ww-cam'); } catch (e) { /* fine */ }
      // A computer gives every player a pose model of their own. Phones and tablets have
      // less memory to spare, so there one model follows everybody (see follow.js).
      const handheld = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent) || (navigator.maxTouchPoints > 1 && /Macintosh/.test(navigator.userAgent));
      const ways = ['follow', 'shared', 'classic']; // heaviest first; ?track= picks one by hand
      let way = ways.includes(qs.get('track')) ? qs.get('track') : null;
      const store = (k, v) => { try { if (v === undefined) return localStorage.getItem(k); if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) { /* fine */ } return null; };
      if (!way) {
        way = ways.includes(store('ww-track')) ? store('ww-track') : handheld ? 'shared' : 'follow';
        // The last visit started loading this tracking and never got as far as the menu: most
        // likely the browser ran out of memory and threw the page away. Take the next lighter
        // way from now on, so that nobody gets stuck on a page that keeps crashing.
        if (store('ww-track-try') === way && way !== 'classic') { way = ways[ways.indexOf(way) + 1]; store('ww-track', way); }
        store('ww-track-try', way);
        const made = () => store('ww-track-try', null);
        this.trackMade = () => setTimeout(made, 6000); addEventListener('pagehide', made);
      }
      this.tracker.classic = way === 'classic'; this.tracker.shared = way === 'shared';
      await this.tracker.startCamera(qs.get('cam') === 'back' ? 'environment' : 'user', qs.has('cam') ? null : saved);
      msg.textContent = 'Loading body tracking…';
      await this.tracker.loadModel(new URL('.', document.baseURI).href, qs.has('cpu') ? 'CPU' : undefined);
      $('pip').prepend(this.tracker.canvas);
      if (qs.has('rot')) this.tracker.setRotation(+qs.get('rot'));
      $('b-rot').addEventListener('click', () => { this.tracker.setRotation(this.tracker.rotation + 90); this.manualRot = true; });
      // more than one camera on this machine: offer to switch between them
      this.tracker.cameras().then((cams) => { if (cams.length > 1) $('b-cams').hidden = false; });
      $('b-cams').addEventListener('click', async () => {
        const b = $('b-cams'); if (b.disabled) return; b.disabled = true;
        const name = await this.tracker.nextCamera().catch(() => null); b.disabled = false;
        if (name) { this.pipAr = 0; this.hud.banner(name, '#fff', 1.6, 'Camera switched', 'low'); }
      });
      this.tracker.onRotate = () => { if (this.phase === 'menu') this.hud.banner('Camera turned', '#fff', 1.1, '', 'low'); };
      this.trackMade?.();
      this.begin();
    } catch (e) {
      console.warn(e); btn.disabled = false; try { localStorage.removeItem('ww-track-try'); } catch (err) { /* fine */ }
      const blocked = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.message === 'no-camera-api');
      const embedded = window.self !== window.top;
      if (blocked && embedded) msg.innerHTML = `This preview can't use a camera. Play with your body at <a href="${SITE}" target="_blank" rel="noopener">${SITE.replace('https://', '')}</a>, or try the mouse and touch mode here.`;
      else msg.textContent = blocked ? 'Camera access was blocked. Allow the camera for this page in your browser, then try again.' : 'Could not start the camera. Check that nothing else is using it, then try again.';
    }
  }
  bootSim(n, auto = false) { if (!auto) this.audio.init(); this.sim = new SimSource(this.tracker, n); this.sim.intentFn = (i, p, b, t) => this.botIntent(i, p, b, t); this.begin(); }
  // The four heroes dance on the title screen until someone starts playing.
  startDemo() {
    this.demo = [0, 1, 2, 3].map(i => { const a = new Avatar(this.heroes.hero(i)); this.avatarRoot.add(a.group); return { a, rig: new Rig(), P: null, x: [-6.5, -4.7, 4.7, 6.5][i], h: [3.7, 4.5, 4.3, 3.5][i] }; });
  }
  updateDemo(dt, t) {
    this.demo.forEach((d, i) => {
      const ps = demoPose(i, t * 2);
      d.P = buildSkeleton({ x: d.x, floor: this.floorY, h: d.h, crouch: ps.c, lean: ps.l * Math.PI / 180, sway: ps.s, arms: ps.a, legs: ps.legs }, d.P);
      for (let k = 0; k < 33; k++) { const p = d.rig.pts[k]; p.x = d.P[k][0]; p.y = d.P[k][1]; p.v = 1; }
      d.rig.solve(dt); d.a.update(d.rig, dt, t); if (Math.floor(t * 2) % 8 === i * 2 && d.a.happy < 0.3) d.a.cheer(1);
    });
  }
  begin() {
    if (this.demo) { for (const d of this.demo) d.a.dispose(); this.demo = null; }
    $('boot').classList.add('gone');
    try { navigator.wakeLock?.request('screen').catch(() => {}); } catch (e) { /* optional */ }
    const g = qs.get('game'); const G = g && GAMES.find(x => x.id === g);
    this.page = (+qs.get('page') || 1) - 1;
    if (G) this.startGame(G, { genre: qs.get('genre') || 'pop', lesson: qs.has('lesson') ? +qs.get('lesson') - 1 : undefined, ar: qs.has('ar') }); else this.enterMenu();
  }
  // Mirror mode on or off. In it, bodies stay where the camera sees them and the heroes step aside.
  setAR(on) {
    on = !!on && (this.tracker.mode === 'camera' || qs.has('ar')); if (this.ar === on) return; this.ar = on;
    if (this.tracker.mode === 'camera') { this.tracker.setFit(!on); this.tracker.maxSide = on ? 1280 : 720; }
    this.mirror.set(on); this.avatarRoot.visible = !on; this.env.hidden = on; this.rootEl.classList.toggle('ar', on);
    this.bloom.strength = on ? 0.22 : 0.38; this.comic.uniforms.uInk.value = on ? 0.7 : 1;
    if (!on) this.ws = 1;
  }
  // Where the ground is, and how far to each side players can reach. Games size and place
  // things with these (and with ws, the players' size against a hero's) so they work in mirror mode too.
  get ground() { return this.floorY; }
  setWorld(name, accent) { this.env.set(name, accent); this.audio.setAmbience(this.ar ? null : name); }
  get half() { return this.tracker.playHalf; }

  resize() {
    const w = this.rootEl.clientWidth || window.innerWidth, h = this.rootEl.clientHeight || window.innerHeight;
    this.u = Math.min(w / 16, h / 9); this.rootEl.style.setProperty('--u', this.u + 'px');
    this.camera.aspect = w / h; this.camera.fov = 2 * Math.atan((h / 2 / this.u) / CAM_D) * 180 / Math.PI; this.camera.updateProjectionMatrix();
    this.renderer.setPixelRatio(this.pixelRatio); this.renderer.setSize(w, h, false);
    this.composer.setPixelRatio(this.pixelRatio); this.composer.setSize(w, h);
    this.fx.pmat.uniforms.uScale.value = h * this.pixelRatio * 0.55;
    TOON.uDot.value = Math.max(4, h * this.pixelRatio / 118); this.comic.uniforms.uDot.value = TOON.uDot.value * 0.8;
    this.w = w; this.h = h;
    $('rotate').classList.toggle('on', h > w * 1.15 && matchMedia('(pointer: coarse)').matches);
  }
  pointer(e) {
    if (!this.sim) return; const r = this.rootEl.getBoundingClientRect();
    this.ptr = { x: (e.clientX - r.left - r.width / 2) / this.u, y: -(e.clientY - r.top - r.height / 2) / this.u };
    this.sim.setPointer(this.ptr.x, this.ptr.y, performance.now()); this.aimPointer();
  }
  // On menus the hand is a stretched pointer, so aim the pretend player's hand where its cursor lands under the real pointer.
  aimPointer() {
    if (!this.sim || !this.ptr) return; let { x, y } = this.ptr;
    if (this.phase === 'menu' || this.phase === 'genre' || this.phase === 'results') { const p0 = this.players.find(p => p.slot === 0); if (p0) { x = p0.rig.uncursorX(x); y = p0.rig.uncursorY(y); } }
    this.sim.pointer.x = x; this.sim.pointer.y = y;
  }

  get players() { return this.tracker.active; }
  onJoin(p) {
    const a = new Avatar(this.heroes.hero(p.slot)); this.avatars[p.slot] = a; this.avatarRoot.add(a.group); a.popIn();
    this.audio.join(); this.joinFx = p;
    if (this.phase === 'play' || this.phase === 'intro' || this.phase === 'count') this.hud.setScore(p.slot, this.scores[p.slot]);
  }
  onLeave(p) {
    const a = this.avatars[p.slot]; if (a) { this.fx.burst(p.j.hipC, { count: 30, color: p.color, speed: 5 }); a.dispose(); this.avatars[p.slot] = null; }
  }
  // ------------------------------------------------------------ feel
  resetFeel() {
    this.heat = [0, 0, 0, 0]; this.heatIdle = [0, 0, 0, 0]; this.fire = [false, false, false, false];
    this.stats = [0, 1, 2, 3].map(() => ({ t: 0, hand: 0, jumps: 0, travel: 0, reach: 0, low: 0, fire: 0 }));
    for (let s = 0; s < 4; s++) this.hud?.setHot(s, false);
  }
  // Everything a body does that deserves an answer, whatever the game: dust and a thump when
  // feet land, a glow that builds while a player keeps scoring, and a tally for the awards.
  feel(p, a, dt, playing) {
    const s = p.slot, r = p.rig, j = r.j, S = r.S, whole = this.avatarRoot.scale.x === 1;
    const lift = Math.min(j.anL.y, j.anR.y) - r.floorY, up = r.legsSeen ? lift > 0.36 * S : r.jump > 0.6;
    if (up) this.air[s] += dt;
    else if (!r.legsSeen || lift < 0.22 * S) {
      if (this.air[s] > 0.09 && this.air[s] < 1.3) {
        const hard = Math.min(1, 0.55 + this.air[s]); a?.land(hard); this.audio.thud(hard); this.fx.shake(0.03);
        if (whole && (r.legsSeen || !this.ar)) this.fx.dust({ x: j.hipC.x, y: r.floorY, z: 0.2 }, S * (a?.size ?? 1));
        if (playing) this.stats[s].jumps++;
      }
      this.air[s] = 0;
    }
    this.heatIdle[s] += dt; if (this.heatIdle[s] > 1.3) this.heat[s] = Math.max(0, this.heat[s] - dt * 0.12);
    if (this.fire[s] && (this.heat[s] < 0.5 || !playing)) { this.fire[s] = false; this.hud.setHot(s, false); }
    if (a) a.heat += ((this.fire[s] ? 1 : 0) - a.heat) * Math.min(1, dt * 7);
    if (this.fire[s] && whole) { // embers climb off a player who is on fire
      this.ember += dt * 34;
      while (this.ember > 1) {
        this.ember--; const k = Math.floor(Math.random() * 3), c = [0xffd23f, 0xff7a1a, p.color][k];
        if (k) { const h = r.hands[k - 1]; this.fx.spawn(h.x + (Math.random() - 0.5) * 0.3 * S, h.y + (Math.random() - 0.5) * 0.3 * S, 0.4, (Math.random() - 0.5) * 1.2, 1.5 + Math.random() * 2.5, 0, c, 0.24 * S, 0.5, -2, 1.2); }
        else this.fx.solid.spawn(j.hipC.x + (Math.random() - 0.5) * 1.5 * S, r.floorY + Math.random() * 1.6 * S, -0.3, (Math.random() - 0.5) * 0.8, 2.2 + Math.random() * 2.5, 0, c, 0.17 * S, 0.55, -1.5, 1);
      }
    }
    if (!playing) return;
    const st = this.stats[s]; st.t += dt; st.hand += (r.handVel[0].length() + r.handVel[1].length()) * dt / S; st.travel += Math.abs(j.hipC.x - r.prev.hipC.x) / S;
    if (Math.max(j.haL.y, j.haR.y) > j.head.y + 0.25 * S) st.reach += dt; if (r.crouch > 0.5) st.low += dt; if (this.fire[s]) st.fire += dt;
  }
  ignite(slot) {
    this.fire[slot] = true; this.hud.setHot(slot, true); this.audio.fire(); this.avatars[slot]?.cheer(1); this.cam.punch(0.12);
    const p = this.tracker.players[slot]; if (!p) return;
    this.fx.word({ x: p.j.head.x, y: Math.min(2.4, p.j.head.y + 1.5 * p.rig.S) }, 'ON FIRE!', '#ffd23f', '#ff5a36');
    this.fx.ring(p.j.chest, 0xffd23f, 3.2, 0.5); this.fx.burst(p.j.chest, { count: 36, colors: [0xffd23f, 0xff7a1a, 0xffffff], speed: 9, up: 3 });
  }
  // One award each, and no two alike: whatever a player did more of than the others.
  giveAwards(slots) {
    const AW = [['hand', 'Fastest hands', 2.6], ['jumps', 'Jumping bean', 0.07], ['travel', 'Always on the move', 0.55], ['reach', 'Reach for the sky', 0.3], ['low', 'Low and sneaky', 0.14], ['fire', 'Red hot', 0.22]];
    const rate = (s, k) => this.stats[s][k] / Math.max(8, this.stats[s].t), left = new Set(AW.map(a => a[0])), out = [];
    for (const s of slots) {
      let best = null, bv = 0.45; // has to be a fair showing to earn the title
      for (const [k, name, typical] of AW) {
        if (!left.has(k)) continue; const mine = rate(s, k) / typical; let others = 0, n = 0;
        for (const o of slots) if (o !== s) { others += rate(o, k) / typical; n++; }
        const v = mine * (n ? 0.6 + 0.8 * mine / (mine + others / n + 1e-6) : 1); if (v > bv) { bv = v; best = [k, name]; }
      }
      if (best) left.delete(best[0]);
      out.push({ slot: s, text: best ? best[1] : ['Cool as ice', 'Smooth mover', 'Steady hands', 'Team spirit'][out.length % 4] });
    }
    return out;
  }

  botIntent(i, p, bot, t) {
    if ((this.phase === 'play' || this.phase === 'count' || this.phase === 'intro') && this.game?.botIntent) return this.game.botIntent(i, p, bot, t, this.phase === 'play');
    if (this.phase === 'menu' || this.phase === 'genre' || this.phase === 'results') { // idle: wave now and then
      const w = i > 0 && Math.sin(t * 0.5 + i * 2.2) > 0.6; return w ? { arms: i % 2 ? [null, [70 + Math.sin(t * 9) * 14, 70]] : [[70 + Math.sin(t * 9) * 14, 70], null] } : {};
    }
    return {};
  }

  // ------------------------------------------------------------ menu
  exitButton() { return { x: -7.2, y: 3.75, w: 1.1, h: 1.1, dwell: 1.6, cls: 'exit', quiet: true, html: ICONS.home, onSelect: () => this.toMenu() }; }
  enterMenu() {
    this.cleanupGame(); this.phase = 'menu'; this.setAR(false); this.cam.baseTo = 0; this.cam.beat = 0.3;
    if (this.make) { const { slot } = this.make; this.make = null; this.heroes.wear(slot, null); this.dress(slot); } // a hero left half-made is dropped
    this.hud.only = null;
    this.setWorld('meadow'); this.audio.playMusic('menu'); this.audio.duck(false);
    $('menu-title').classList.add('on'); $('pip').classList.toggle('on', this.tracker.mode === 'camera');
    this.showMenu();
  }
  sideButton(x, html, colors, onSelect, o = {}) { return { x, y: 0.3, w: 2.1, h: 1.5, cls: 'side mini', colors, html, onSelect, ...o }; }
  showMenu() {
    const pages = PAGES.filter(pg => !pg.camera || this.tracker.mode === 'camera' || qs.has('ar')), pg = pages[this.page % pages.length], n = pg.games.length;
    this.page %= pages.length;
    $('menu-note').textContent = pg.camera ? 'Mirror mode: see yourself in the game!' : `${pg.name} (${this.page + 1} of ${pages.length}): hold a hand on a game to play!`;
    const cards = pg.games.map((G, i) => {
      const best = this.best(G.id);
      return { x: (i - (n - 1) / 2) * (n > 5 ? 2.58 : 3.08), y: 2.5, w: n > 5 ? 2.44 : 2.84, h: 2.3, cls: n > 5 ? 'slim' : '', colors: G.colors, html: `${ICONS[G.icon]}<h3>${G.title}</h3><p>${G.blurb}</p>${best ? `<span class="bestv">Best ${best.toLocaleString()}</span>` : ''}`, onSelect: () => (G.dance ? this.enterGenre(G) : this.startGame(G, pg.opts)) };
    });
    if (pg.camera) for (const c of cards) c.html += `<span class="cam">${ICONS.mirror}</span>`;
    cards.push(this.sideButton(-6.85, `${ICONS.hero}<h3>Heroes</h3>`, ['#ff8a3d', '#d6306f'], () => this.enterHeroes()));
    if (pages.length > 1) cards.push(this.sideButton(6.85, `${ICONS.more}<h3>More games</h3>`, ['#8f6bff', '#5a35d6'], () => { this.page = (this.page + 1) % pages.length; this.showMenu(); }, { repeat: true }));
    this.hud.setButtons(cards);
  }

  // ------------------------------------------------------------ heroes
  // Put a player slot into the hero it should be wearing now.
  dress(slot) {
    this.heroes.apply(slot);
    const p = this.tracker.players[slot]; if (p) { p.color = PLAYER_COLORS[slot]; p.css = PLAYER_CSS[slot]; p.name = PLAYER_NAMES[slot]; }
    const old = this.avatars[slot];
    if (old) { old.dispose(); const a = new Avatar(this.heroes.hero(slot)); this.avatars[slot] = a; this.avatarRoot.add(a.group); a.popIn(); if (p) { this.fx.burst(p.j.chest, { count: 30, color: p.color, speed: 7, size: 0.3 }); this.fx.ring(p.j.chest, p.color, 2.6, 0.5); } }
    this.fx.dropSwoosh(slot * 2); this.fx.dropSwoosh(slot * 2 + 1); this.hud.identity(slot);
  }
  enterHeroes() {
    if (this.busy) return; this.busy = true;
    this.hud.wipe('#ff8a3d', () => {
      this.phase = 'genre'; this.hud.only = null; $('menu-title').classList.add('on'); $('menu-note').textContent = 'Hold a hand on a hero to become them';
      this.showHeroes(); this.hud.banner('Pick your hero', '#fff', 1.8, '', 'low');
    }).then(() => { this.busy = false; });
  }
  showHeroes() {
    const all = this.heroes.roster, pages = Math.ceil(all.length / 4), pg = (this.heroPage || 0) % pages, list = all.slice(pg * 4, pg * 4 + 4);
    const cards = list.map((h, i) => ({
      x: (i - 2) * 3.08, y: 2.5, w: 2.84, h: 2.3, cls: 'hero', repeat: true, colors: [cssOf(h.main), cssOf(h.dark)],
      html: `<img src="${portrait(this.renderer, h)}" alt=""><h3>${h.name}</h3>${this.players.some(p => this.heroes.picks[p.slot] === h.id) ? '<span class="bestv">In play</span>' : ''}`, onSelect: (by) => this.pickHero(by, h),
    }));
    cards.push({ x: 2 * 3.08, y: 2.5, w: 2.84, h: 2.3, cls: 'hero', repeat: true, colors: ['#8f6bff', '#5a35d6'], html: `${ICONS.more}<h3>More heroes</h3><p>Page ${pg + 1} of ${pages}</p>`, onSelect: () => { this.heroPage = pg + 1; this.showHeroes(); } });
    cards.push(this.sideButton(-6.85, `${ICONS.make}<h3>Make your own</h3>`, ['#ff8a3d', '#d6306f'], (by) => this.enterCreator(by)));
    cards.push(this.sideButton(6.85, `${ICONS.ok}<h3>Done</h3>`, ['#2fe0a0', '#12a877'], () => this.toMenu()));
    this.hud.setButtons(cards);
  }
  pickHero(slot, h) {
    const other = this.heroes.takenBy(h.id);
    if (other >= 0 && other !== slot) {
      if (this.tracker.players[other]) { this.audio.bad(); this.hud.banner(`${PLAYER_NAMES[other]} is in play`, '#ffd23f', 1.2, 'Pick another hero', 'low'); return; }
      this.heroes.choose(other, this.heroes.picks[slot]); // nobody is using it: trade places
    }
    this.heroes.choose(slot, h.id); this.dress(slot); this.audio.gold(); this.showHeroes();
  }
  enterCreator(slot) {
    if (this.busy) return; this.busy = true;
    const cur = this.heroes.hero(slot), c = choicesOf(cur);
    if (cur.custom) c.id = cur.id; else { delete c.id; c.name = NAMES[Math.floor(Math.random() * NAMES.length)]; }
    this.make = { slot, c, step: 0, page: 0 };
    this.hud.wipe('#ff8a3d', () => { this.hud.only = slot; this.wearDraft(); this.showCreator(); this.hud.banner('Make your hero', '#fff', 1.6, 'Hold a hand on a card to try it on', 'low'); }).then(() => { this.busy = false; });
  }
  wearDraft() { const m = this.make; this.heroes.wear(m.slot, makeHero({ ...m.c, id: m.c.id || 'draft' })); this.dress(m.slot); }
  showCreator() {
    const m = this.make, st = STEPS[m.step], per = st.opts.length > 5 ? 4 : 5, pages = Math.ceil(st.opts.length / per), pg = m.page % pages, list = st.opts.slice(pg * per, pg * per + per);
    const n = list.length + (pages > 1 ? 1 : 0), xs = (i) => (i - (n - 1) / 2) * 3.08, last = m.step === STEPS.length - 1;
    $('menu-note').textContent = `Step ${m.step + 1} of ${STEPS.length}: ${st.title}`;
    const cards = list.map((v, i) => {
      const html = st.color ? `<i class="swatch" style="background:${cssOf(v)}"></i>` : st.text ? `<h3 class="word">${v}</h3>`
        : `<img class="${st.full ? 'full' : ''}" src="${portrait(this.renderer, makeHero({ ...m.c, [st.key]: v }), 224, st.full)}" alt=""><h3>${LOOKS[v] || cap(v)}</h3>`;
      return { x: xs(i), y: 2.5, w: 2.84, h: 2.3, cls: 'hero opt', repeat: true, colors: [cssOf(m.c.main), '#2a2148'], html: html + (m.c[st.key] === v ? '<span class="bestv">Picked</span>' : ''), onSelect: () => { m.c[st.key] = v; this.wearDraft(); this.showCreator(); } };
    });
    if (pages > 1) cards.push({ x: xs(n - 1), y: 2.5, w: 2.84, h: 2.3, cls: 'hero', repeat: true, colors: ['#8f6bff', '#5a35d6'], html: `${ICONS.more}<h3>More</h3><p>Page ${pg + 1} of ${pages}</p>`, onSelect: () => { m.page = pg + 1; this.showCreator(); } });
    cards.push(this.sideButton(-6.85, `${ICONS.back}<h3>Back</h3>`, ['#8f6bff', '#5a35d6'], () => { if (m.step === 0) this.leaveCreator(false); else { m.step--; m.page = 0; this.showCreator(); } }, { repeat: m.step > 0 }));
    cards.push(this.sideButton(6.85, last ? `${ICONS.ok}<h3>Done</h3>` : `${ICONS.more}<h3>Next</h3>`, ['#2fe0a0', '#12a877'], () => { if (last) this.leaveCreator(true); else { m.step++; m.page = 0; this.showCreator(); } }, { repeat: !last }));
    this.hud.setButtons(cards);
  }
  leaveCreator(save) {
    const { slot, c } = this.make; this.make = null; this.hud.only = null;
    if (save) { this.heroes.keep(slot, c); this.audio.fanfare(); } else this.heroes.wear(slot, null);
    this.dress(slot); this.heroPage = save ? Math.floor((this.heroes.roster.length - 1) / 4) : 0; this.enterHeroes();
  }
  toMenu() { if (this.busy) return; this.busy = true; this.hud.wipe('#9a5bff', () => this.enterMenu()).then(() => { this.busy = false; }); }
  enterGenre(G) {
    if (this.busy) return; this.busy = true;
    this.hud.wipe(G.colors[0], () => {
      this.phase = 'genre'; $('menu-title').classList.remove('on'); this.setWorld('stage', 0xff4fa3); this.audio.playMusic('pop');
      this.hud.setButtons([this.exitButton(), ...Object.entries(GENRES).map(([id, g], i) => ({
        x: (i - 1) * 4.3, y: 2.3, w: 3.6, h: 2.6, colors: g.colors, html: `${ICONS[id]}<h3>${g.name}</h3><p>${g.blurb}</p>`, onSelect: () => (G === DanceClass ? this.enterLesson(G, id) : this.startGame(G, { genre: id })),
      }))]);
      this.hud.banner('Pick your music', '#fff', 1.8, '', 'low');
    }).then(() => { this.busy = false; });
  }
  // Dance Class: choose which set of four moves to learn.
  enterLesson(G, id) {
    const g = GENRES[id], n = g.lessons.length, next = lessonOf(g), done = lessonsDone(g);
    this.hud.setButtons([this.exitButton(), ...g.lessons.map((_, i) => ({
      x: (i - (n - 1) / 2) * 4.3, y: 2.15, w: 3.7, h: 2.9, cls: 'lesson', colors: g.colors,
      html: `<h3>Lesson ${i + 1}</h3><em>${g.titles[i]}</em><p>${lessonMoves(g, i).join('<br>')}</p>${done & (1 << i) ? '<span class="bestv">Done ★</span>' : i === next ? '<span class="bestv">Up next</span>' : ''}`,
      onSelect: () => this.startGame(G, { genre: id, lesson: i }),
    }))]);
    this.hud.banner('Pick a lesson', '#fff', 1.8, '', 'low'); this.audio.playMusic(g.music);
  }

  // ------------------------------------------------------------ game flow
  best(id) { try { return +localStorage.getItem('ww-best-' + id) || 0; } catch (e) { return 0; } }
  cleanupGame() {
    this.game?.dispose?.(); this.game = null; this.root.clear(); this.fx.clear(); for (const a of this.avatars) if (a) a.size = 1;
    this.paused = false; this.awayT = 0; this.rootEl.classList.remove('paused'); this.awardQ = []; this.resetFeel();
    this.hud.hideTop(); this.hud.hideHowto(); this.hud.hideResults(); this.hud.clearButtons(); this.hud.hint('');
    $('menu-title').classList.remove('on'); $('pip').classList.remove('on');
  }
  startGame(G, opts = {}) {
    if (this.busy) return; this.busy = true; this.lastGame = [G, opts];
    this.hud.wipe(G.colors[0], () => {
      this.cleanupGame(); this.setAR(opts.ar && G.ar); this.cam.swoop(); this.cam.beat = G.dance ? 1 : 0.3; this.cam.baseTo = 0;
      const genre = G.dance ? GENRES[opts.genre || 'pop'] : null;
      this.setWorld(G.theme, genre?.accent); this.audio.playMusic(genre ? genre.music : G.music); this.audio.duck(false); this.audio.setMuffle(false);
      this.scores = [0, 0, 0, 0]; this.seen = new Set();
      this.game = new G(this, opts);
      this.hud.showTop(G.title); for (const p of this.players) this.hud.setScore(p.slot, 0);
      this.hud.howto(G, this.game.label || genre?.name || (this.ar ? 'Mirror mode' : '')); this.hud.setButtons([this.exitButton()]);
      this.phase = 'intro'; this.phaseT = qs.has('fast') ? 0.3 : 4.2;
    }).then(() => { this.busy = false; });
  }
  addScore(slot, pts, pos, o = {}) {
    this.scores[slot] = Math.max(0, this.scores[slot] + pts); this.hud.setScore(slot, this.scores[slot], o.sub);
    if (pos) this.fx.popup(pos, o.text ?? (pts > 0 ? '+' + pts : String(pts)), o.color ?? PLAYER_CSS[slot], o.cls || '');
    if (pts > 0 && o.cheer !== 0) this.avatars[slot]?.cheer(o.cheer ?? 0.5);
    if (this.phase === 'play') {
      // keep scoring and the heat builds; slower games give more for each success. A penalty puts the fire out.
      if (pts > 0 && o.cheer !== 0 && o.heat !== 0) {
        this.heat[slot] = Math.min(1.35, this.heat[slot] + (o.heat ?? 0.09 + Math.min(0.26, this.heatIdle[slot] * 0.085))); this.heatIdle[slot] = 0;
        if (!this.fire[slot] && this.heat[slot] >= 1) this.ignite(slot);
      } else if (pts < 0) { if (this.fire[slot]) { this.audio.fizzle(); this.hud.setHot(slot, false); } this.heat[slot] = 0; this.fire[slot] = false; }
    }
    let lead = -1, top = 0; for (const s of this.seen) { if (this.scores[s] > top) { top = this.scores[s]; lead = s; } else if (this.scores[s] === top) lead = -1; }
    this.hud.setLeader(this.seen.size > 1 ? lead : -1);
  }
  // The round is over: everything stops dead for a breath while the whistle goes, then the scoreboard.
  finish() {
    if (this.phase !== 'play') return; this.phase = 'finish'; this.phaseT = qs.has('fast') ? 0.05 : 1.75; this.setPaused(false);
    const timed = typeof this.game.time === 'number' && this.game.time <= 0.05;
    this.hud.banner(timed ? "Time's up!" : 'Finish!', '#ffd23f', 1.7, '', 'finish'); this.hud.clearButtons(); this.hud.hint('');
    this.audio.whistle(); this.audio.setMuffle(true); this.fx.speedLines(); this.fx.impact(); this.fx.shake(0.35); this.cam.punch(0.3);
    for (const p of this.players) this.avatars[p.slot]?.cheer(1);
  }
  toResults() {
    this.phase = 'results'; this.phaseT = 0; this.audio.setMuffle(false);
    this.avatarRoot.scale.setScalar(1); this.avatarRoot.position.set(0, 0, 0); for (const a of this.avatars) if (a) a.size = 1; // heroes a game shrank are full size again for the results
    const G = this.game.constructor; const custom = this.game.results?.() || {};
    const slots = [...this.seen].sort((a, b) => this.scores[b] - this.scores[a]);
    const rows = custom.rows || slots.map(s => ({ name: PLAYER_NAMES[s], css: PLAYER_CSS[s], score: this.scores[s], slot: s }));
    const top = custom.score ?? (rows[0]?.score || 0);
    const stars = custom.stars ?? G.stars.filter(v => top >= v).length;
    const best = this.best(G.id), isBest = top > best && top > 0;
    if (isBest) { try { localStorage.setItem('ww-best-' + G.id, top); } catch (e) { /* fine */ } }
    this.hud.hideTop(); this.hud.clearButtons(); this.hud.hint('');
    this.hud.showResults({ title: custom.title || (rows.length > 1 ? (rows[1].score === rows[0].score ? "It's a tie!" : `${rows[0].name} wins!`) : 'Nice moves!'), rows, stars, best, isBest, note: custom.note });
    this.audio.duck(true); this.audio.fanfare();
    this.winSlots = rows.filter(r => r.slot !== undefined && r.score === rows[0].score).map(r => r.slot); this.nextRing = 0.6; for (const w of this.winSlots) this.avatars[w]?.cheer(1);
    this.fx.confetti({ x: -5, y: 0 }, 70); this.fx.confetti({ x: 5, y: 0 }, 70);
    this.resultsBtns = false; this.nextFw = 0.9; this.fwLeft = 3 + stars * 4; this.fx.speedLines();
    // the camera eases toward the winners, and everyone still on stage gets an award
    this.cam.baseTo = 0.035; this.winTune = false;
    const here = slots.filter(s => this.tracker.players[s]);
    this.awardQ = this.giveAwards(here).map((w, i) => ({ ...w, at: 1.9 + i * 0.45 }));
    this.resetFeel();
  }
  setPaused(on) {
    if (this.paused === on) return; this.paused = on; this.rootEl.classList.toggle('paused', on); this.awayT = 0;
    if (this.audio.ready) { this.audio.setMuffle(on); this.audio.duck(on, 0.25); this.audio.pause(on); }
    if (!on && this.phase === 'play') { this.hud.banner('Go!', '#7cf05a', 0.9); this.cam.punch(0.15); }
  }

  // ------------------------------------------------------------ frame
  frame(fakeNow) {
    const now = fakeNow ?? performance.now(); const dt = Math.min(0.05, (now - this.last) / 1000); this.frames = (this.frames || 0) + 1; this.last = now; this.t += dt; const t = this.t;
    this.aimPointer(); this.sim?.update(now, dt, t);
    this.tracker.update(now, dt);
    const players = this.players;
    let fy = 0, size = 0; const playing = this.phase === 'play' || this.phase === 'finish';
    for (const p of players) {
      fy += p.rig.floorY; size += p.rig.S; this.seen.add(p.slot);
      const a = this.avatars[p.slot]; if (!a) { this.feel(p, null, dt, playing); continue; }
      this.feel(p, a, dt, playing);
      // eyes on the action in a game, on the scoreboard afterwards, and on each other's antics otherwise
      a.update(p.rig, dt, t, (playing && this.game?.lookTarget?.(p)) || (this.phase === 'results' ? LOOK_UP : null));
      for (let h = 0; h < 2; h++) this.fx.swoosh(p.slot * 2 + h, p.rig.hands[h], p.color, p.rig.handVel[h].length(), p.rig.S, dt);
    }
    if (this.joinFx) { const p = this.joinFx; this.joinFx = null; this.fx.burst(p.j.chest, { count: 40, color: p.color, speed: 7, size: 0.3 }); this.fx.ring(p.j.chest, p.color, 3, 0.6); this.fx.popup({ x: p.j.head.x, y: Math.min(0.8, p.j.head.y + 1.2) }, p.name + ' joined!', p.css); }
    if (this.demo) this.updateDemo(dt, t);
    if (players.length) this.floorY += (THREE.MathUtils.clamp(fy / players.length, -4.4, -1.5) - this.floorY) * Math.min(1, dt * 2);
    this.env.update(dt, t, this.floorY, this.audio.ready ? this.audio.beat : t * 2);
    if (this.ar && players.length) this.ws += (THREE.MathUtils.clamp(size / players.length / 1.28, 0.4, 1.4) - this.ws) * Math.min(1, dt * 3);
    this.mirror.update(dt, t, players);

    this.tracker.autoRotate = this.phase === 'menu' && !this.manualRot && !qs.has('rot');
    // the little camera preview takes the shape of the picture, wide or tall
    const cv = this.tracker.canvas, ar = cv.width / Math.max(1, cv.height);
    if (this.tracker.mode === 'camera' && ar !== this.pipAr) { this.pipAr = ar; const w = ar >= 1 ? 2.3 : Math.max(1.25, 2.3 * ar); $('pip').style.setProperty('--pw', w); $('pip').style.setProperty('--ph', w / ar); }
    if (this.phase === 'menu' || this.phase === 'genre') this.hud.hint(players.length ? this.tracker.advice() : (this.sim ? '' : 'Step in front of the camera to join'));
    else if (this.phase === 'intro') {
      this.phaseT -= dt; this.game.idle?.(dt, t);
      if (this.phaseT <= 0) { this.hud.hideHowto(); this.phase = 'count'; this.phaseT = 0; this.countN = 4; }
    } else if (this.phase === 'count') {
      this.phaseT -= dt; this.game.idle?.(dt, t);
      if (this.phaseT <= 0) {
        this.countN--; this.phaseT = qs.has('fast') ? 0.1 : 0.8;
        if (this.countN > 0) { this.hud.count(this.countN); this.audio.count(); this.cam.punch(0.07); }
        else { this.hud.count('GO!'); this.audio.go(); this.cam.punch(0.2); this.phase = 'play'; this.game.start(); }
      }
    } else if (this.phase === 'play') {
      // nobody in front of a real camera: hold the round until someone steps back in
      if (this.tracker.mode === 'camera') {
        if (players.length ? this.paused : !this.paused) { this.awayT += dt; if (this.awayT > (this.paused ? 0.35 : 1.1)) this.setPaused(!this.paused); } else this.awayT = 0;
      }
      if (!this.paused) this.game.update(this.fx.stopT > 0 ? dt * 0.06 : dt, t, players);
      if (this.game.done) this.finish();
    } else if (this.phase === 'finish') {
      this.phaseT -= dt; if (this.phaseT <= 0) this.toResults();
    } else if (this.phase === 'results') {
      this.phaseT += dt; this.fx.rain(dt * 0.5);
      if (this.awardQ.length && this.phaseT > this.awardQ[0].at) {
        const w = this.awardQ.shift(), wp = this.tracker.players[w.slot];
        if (wp) { this.hud.setAward(w.slot, w.text); this.audio.award(); this.avatars[w.slot]?.cheer(0.8); this.fx.burst({ x: wp.j.hipC.x, y: wp.rig.floorY + 0.3, z: 0.5 }, { count: 14, colors: [wp.color, 0xffffff], speed: 5, up: 3 }); }
      }
      if (!this.winTune && this.phaseT > 2.9) { this.winTune = true; this.audio.playMusic('win'); }
      // the winner stands in a pulsing gold ring
      if (this.phaseT > this.nextRing) {
        this.nextRing = this.phaseT + 0.75;
        for (const wp of players) if (this.winSlots.includes(wp.slot)) { this.fx.ring(wp.rig.j.chest, 0xffd23f, 2.3, 0.7, 0.5); this.avatars[wp.slot]?.cheer(0.4); }
      }
      // fireworks: one for every star earned, then a few more for luck
      if (this.phaseT > this.nextFw && this.fwLeft > 0) { this.fwLeft--; this.nextFw = this.phaseT + 0.35 + Math.random() * 0.5; const c = PLAYER_COLORS[Math.floor(Math.random() * 4)]; this.fx.firework((Math.random() - 0.5) * 13, 0.5 + Math.random() * 3, c); this.audio.pop(Math.floor(Math.random() * 8)); }
      if (this.phaseT > 2.2 && !this.resultsBtns) {
        this.resultsBtns = true; const [G, opts] = this.lastGame;
        this.hud.setButtons([
          { x: -6, y: 1.95, w: 3, h: 2.3, cls: 'side', colors: ['#2fe0a0', '#12a877'], html: `${ICONS.again}<h3>Play again</h3>`, onSelect: () => this.startGame(G, opts) },
          { x: 6, y: 1.95, w: 3, h: 2.3, cls: 'side', colors: ['#8f6bff', '#5a35d6'], html: `${ICONS.home}<h3>Menu</h3>`, onSelect: () => this.toMenu() },
        ]);
      }
    }
    this.hud.updateButtons(players, dt);
    this.fx.update(dt); this.audio.endFrame(this.fx.takeMark());
    this.cam.update(dt, t, { players, shake: this.fx.shakeAmt, beatPulse: this.env.beatPulse, ar: this.ar }); this.camera.updateMatrixWorld();
    if (this.noRender) return;
    // the colour plates sit almost square, and slip apart when something hits hard
    const cu = this.comic.uniforms; cu.uFlash.value = this.fx.flashAmt; cu.uImpact.value = this.fx.impactAmt > 0.3 ? 1 : 0;
    cu.uSlip.value = (this.ar ? 0.15 : 0.32) + Math.min(1.2, this.fx.shakeAmt) * 2.6;
    if (this.lowFx) this.renderer.render(this.scene, this.camera); else this.composer.render(dt);

    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 2) { this.fps = this.fpsN / this.fpsAcc; this.fpsAcc = 0; this.fpsN = 0; this.pace(this.fps); }
  }
  // Keep it smooth by trading sharpness for speed, in both directions. Drop quickly when frames
  // are being missed; creep back up when there is room; and if dropping did not help (the body
  // tracking is the slow part, not the drawing), put the sharpness back and stop trying.
  pace(fps) {
    if (this.fpsEl) this.fpsEl.textContent = `${fps.toFixed(0)} fps · sharpness ${this.pixelRatio.toFixed(2)} of ${this.prMax.toFixed(2)} · ${this.players.length} in view${this.tracker.follow ? ` · tracking ${this.tracker.follow.cost.toFixed(1)} ms a look${this.tracker.follow.shared ? ', one model for all' : ''}` : this.tracker.mode === 'camera' ? ' · whole-picture tracking' : ''}`;
    if (qs.has('sim') || qs.has('pr') || this.lowFx || this.busy || document.hidden) { this.lastStep = null; this.goodN = 0; return; }
    const step = (to) => { this.lastStep = { from: this.pixelRatio, fps }; this.pixelRatio = to; this.goodN = 0; this.resize(); try { localStorage.setItem('ww-pr', to.toFixed(2)); } catch (e) { /* fine */ } };
    const last = this.lastStep; this.lastStep = null;
    if (last && last.from > this.pixelRatio && fps < last.fps * 1.12) { this.prFloor = last.from; step(last.from); this.lastStep = null; return; } // dropping bought nothing
    if (last && last.from < this.pixelRatio && fps < 52) { this.prCeil = last.from; step(last.from); this.lastStep = null; return; }             // climbing cost frames
    if (fps < 46 && this.pixelRatio > this.prFloor + 0.01) step(Math.max(this.prFloor, this.pixelRatio - 0.2));
    else if (fps > 57 && this.pixelRatio < Math.min(this.prMax, this.prCeil) - 0.01) { if (++this.goodN >= 5) step(Math.min(this.prMax, this.prCeil, this.pixelRatio + 0.1)); }
    else this.goodN = 0;
  }
}

new App();
