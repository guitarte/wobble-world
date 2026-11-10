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
import { FX } from './fx.js';
import { AudioEngine } from './audio.js';
import { Environment } from './env.js';
import { HUD, ICONS } from './hud.js';
import { JellyJam } from './games/jelly.js';
import { ShapeUp } from './games/walls.js';
import { CometKeeper } from './games/comet.js';
import { DanceClass, DanceBattle, GENRES, demoPose, lessonOf, lessonsDone, lessonMoves, DEBUG as DANCE } from './games/dance.js';

const GAMES = [JellyJam, ShapeUp, CometKeeper, DanceClass, DanceBattle];
const CAM_D = 13;
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
    this.pixelRatio = +qs.get('pr') || Math.min(window.devicePixelRatio || 1, 1.75);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(40, 16 / 9, 0.1, 600); this.camera.position.set(0, 0, CAM_D);
    const pm = new THREE.PMREMGenerator(this.renderer); this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environmentIntensity = 0.38;
    this.env = new Environment(this.scene);
    this.root = new THREE.Group(); this.scene.add(this.root);       // game objects live here
    this.avatarRoot = new THREE.Group(); this.scene.add(this.avatarRoot);
    this.fx = new FX(this.scene, this.camera, $('popups'));
    this.audio = new AudioEngine();
    this.hud = new HUD(this);
    this.tracker = new Tracker(); this.sim = null;
    this.avatars = new Array(4).fill(null);
    this.scores = [0, 0, 0, 0]; this.seen = new Set();
    this.phase = 'boot'; this.phaseT = 0; this.game = null; this.t = 0; this.last = performance.now(); this.floorY = -3.7;
    this.fpsAcc = 0; this.fpsN = 0;

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
    window.__ww = this; this.dance = DANCE; // handy for testing
  }

  // ------------------------------------------------------------ boot
  async bootCamera() {
    const msg = $('boot-msg'), btn = $('b-cam'); btn.disabled = true; this.audio.init();
    try {
      msg.textContent = 'Asking for the camera…';
      await this.tracker.startCamera(qs.get('cam') === 'back' ? 'environment' : 'user');
      msg.textContent = 'Loading body tracking…';
      await this.tracker.loadModel(new URL('.', document.baseURI).href);
      $('pip').prepend(this.tracker.canvas);
      if (qs.has('rot')) this.tracker.setRotation(+qs.get('rot'));
      $('b-rot').addEventListener('click', () => { this.tracker.setRotation(this.tracker.rotation + 90); this.manualRot = true; });
      this.tracker.onRotate = () => { if (this.phase === 'menu') this.hud.banner('Camera turned', '#fff', 1.1, '', 'low'); };
      this.begin();
    } catch (e) {
      console.warn(e); btn.disabled = false;
      const blocked = e && (e.name === 'NotAllowedError' || e.name === 'SecurityError' || e.message === 'no-camera-api');
      const embedded = window.self !== window.top;
      if (blocked && embedded) msg.innerHTML = `This preview can't use a camera. Play with your body at <a href="${SITE}" target="_blank" rel="noopener">${SITE.replace('https://', '')}</a>, or try the mouse and touch mode here.`;
      else msg.textContent = blocked ? 'Camera access was blocked. Allow the camera for this page in your browser, then try again.' : 'Could not start the camera. Check that nothing else is using it, then try again.';
    }
  }
  bootSim(n, auto = false) { if (!auto) this.audio.init(); this.sim = new SimSource(this.tracker, n); this.sim.intentFn = (i, p, b, t) => this.botIntent(i, p, b, t); this.begin(); }
  // The four heroes dance on the title screen until someone starts playing.
  startDemo() {
    this.demo = [0, 1, 2, 3].map(i => { const a = new Avatar(PLAYER_COLORS[i], i); this.avatarRoot.add(a.group); return { a, rig: new Rig(), P: null, x: [-6.5, -4.7, 4.7, 6.5][i], h: [3.7, 4.5, 4.3, 3.5][i] }; });
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
    if (G) this.startGame(G, { genre: qs.get('genre') || 'pop', lesson: qs.has('lesson') ? +qs.get('lesson') - 1 : undefined }); else this.enterMenu();
  }

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
    const a = new Avatar(p.color, p.slot); this.avatars[p.slot] = a; this.avatarRoot.add(a.group); a.popIn();
    this.audio.join(); this.joinFx = p;
    if (this.phase === 'play' || this.phase === 'intro' || this.phase === 'count') this.hud.setScore(p.slot, this.scores[p.slot]);
  }
  onLeave(p) {
    const a = this.avatars[p.slot]; if (a) { this.fx.burst(p.j.hipC, { count: 30, color: p.color, speed: 5 }); a.dispose(); this.avatars[p.slot] = null; }
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
    this.cleanupGame(); this.phase = 'menu';
    this.env.set('meadow'); this.audio.playMusic('menu'); this.audio.duck(false);
    $('menu-title').classList.add('on'); $('pip').classList.toggle('on', this.tracker.mode === 'camera');
    this.hud.setButtons(GAMES.map((G, i) => {
      const best = this.best(G.id);
      return { x: (i - 2) * 3.08, y: 2.5, w: 2.84, h: 2.3, colors: G.colors, html: `${ICONS[G.icon]}<h3>${G.title}</h3><p>${G.blurb}</p>${best ? `<span class="bestv">Best ${best.toLocaleString()}</span>` : ''}`, onSelect: () => (G.dance ? this.enterGenre(G) : this.startGame(G)) };
    }));
  }
  toMenu() { if (this.busy) return; this.busy = true; this.hud.wipe('#9a5bff', () => this.enterMenu()).then(() => { this.busy = false; }); }
  enterGenre(G) {
    if (this.busy) return; this.busy = true;
    this.hud.wipe(G.colors[0], () => {
      this.phase = 'genre'; $('menu-title').classList.remove('on'); this.env.set('stage', 0xff4fa3); this.audio.playMusic('pop');
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
    this.game?.dispose?.(); this.game = null; this.root.clear(); this.fx.clear();
    this.hud.hideTop(); this.hud.hideHowto(); this.hud.hideResults(); this.hud.clearButtons(); this.hud.hint('');
    $('menu-title').classList.remove('on'); $('pip').classList.remove('on');
  }
  startGame(G, opts = {}) {
    if (this.busy) return; this.busy = true; this.lastGame = [G, opts];
    this.hud.wipe(G.colors[0], () => {
      this.cleanupGame();
      const genre = G.dance ? GENRES[opts.genre || 'pop'] : null;
      this.env.set(G.theme, genre?.accent); this.audio.playMusic(genre ? genre.music : G.music); this.audio.duck(false);
      this.scores = [0, 0, 0, 0]; this.seen = new Set();
      this.game = new G(this, opts);
      this.hud.showTop(G.title); for (const p of this.players) this.hud.setScore(p.slot, 0);
      this.hud.howto(G, this.game.label || genre?.name); this.hud.setButtons([this.exitButton()]);
      this.phase = 'intro'; this.phaseT = qs.has('fast') ? 0.3 : 4.2;
    }).then(() => { this.busy = false; });
  }
  addScore(slot, pts, pos, o = {}) {
    this.scores[slot] = Math.max(0, this.scores[slot] + pts); this.hud.setScore(slot, this.scores[slot], o.sub);
    if (pos) this.fx.popup(pos, o.text ?? (pts > 0 ? '+' + pts : String(pts)), o.color ?? PLAYER_CSS[slot], o.cls || '');
    if (pts > 0) this.avatars[slot]?.cheer(o.cheer ?? 0.5);
  }
  finish() {
    if (this.phase !== 'play') return; this.phase = 'results'; this.phaseT = 0;
    const G = this.game.constructor; const custom = this.game.results?.() || {};
    const slots = [...this.seen].sort((a, b) => this.scores[b] - this.scores[a]);
    const rows = custom.rows || slots.map(s => ({ name: PLAYER_NAMES[s], css: PLAYER_CSS[s], score: this.scores[s], slot: s }));
    const top = custom.score ?? (rows[0]?.score || 0);
    const stars = custom.stars ?? G.stars.filter(v => top >= v).length;
    const best = this.best(G.id), isBest = top > best && top > 0;
    if (isBest) { try { localStorage.setItem('ww-best-' + G.id, top); } catch (e) { /* fine */ } }
    this.hud.hideTop(); this.hud.clearButtons(); this.hud.hint('');
    this.hud.showResults({ title: custom.title || (rows.length > 1 ? `${rows[0].name} wins!` : 'Nice moves!'), rows, stars, best, isBest, note: custom.note });
    this.audio.duck(true); this.audio.fanfare();
    const w = rows[0]?.slot; if (w !== undefined) this.avatars[w]?.cheer(1);
    this.fx.confetti({ x: -5, y: 0 }, 70); this.fx.confetti({ x: 5, y: 0 }, 70);
    this.resultsBtns = false; this.nextFw = 0.9; this.fwLeft = 3 + stars * 4; this.fx.speedLines();
  }

  // ------------------------------------------------------------ frame
  frame(fakeNow) {
    const now = fakeNow ?? performance.now(); const dt = Math.min(0.05, (now - this.last) / 1000); this.frames = (this.frames || 0) + 1; this.last = now; this.t += dt; const t = this.t;
    this.aimPointer(); this.sim?.update(now, dt, t);
    this.tracker.update(now, dt);
    const players = this.players;
    let fy = 0;
    for (const p of players) {
      fy += p.rig.floorY; this.seen.add(p.slot);
      const a = this.avatars[p.slot]; if (!a) continue;
      a.update(p.rig, dt, t, this.game?.lookTarget?.(p) || null);
      for (let h = 0; h < 2; h++) this.fx.swoosh(p.slot * 2 + h, p.rig.hands[h], p.color, p.rig.handVel[h].length(), p.rig.S, dt);
    }
    if (this.joinFx) { const p = this.joinFx; this.joinFx = null; this.fx.burst(p.j.chest, { count: 40, color: p.color, speed: 7, size: 0.3 }); this.fx.ring(p.j.chest, p.color, 3, 0.6); this.fx.popup({ x: p.j.head.x, y: Math.min(0.8, p.j.head.y + 1.2) }, p.name + ' joined!', p.css); }
    if (this.demo) this.updateDemo(dt, t);
    if (players.length) this.floorY += (THREE.MathUtils.clamp(fy / players.length, -4.4, -1.5) - this.floorY) * Math.min(1, dt * 2);
    this.env.update(dt, t, this.floorY, this.audio.ready ? this.audio.beat : t * 2);

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
        if (this.countN > 0) { this.hud.count(this.countN); this.audio.count(); }
        else { this.hud.count('GO!'); this.audio.go(); this.phase = 'play'; this.game.start(); }
      }
    } else if (this.phase === 'play') {
      this.game.update(this.fx.stopT > 0 ? dt * 0.06 : dt, t, players);
      if (this.game.done) this.finish();
    } else if (this.phase === 'results') {
      this.phaseT += dt; this.fx.rain(dt * 0.5);
      // fireworks: one for every star earned, then a few more for luck
      if (this.phaseT > this.nextFw && this.fwLeft > 0) { this.fwLeft--; this.nextFw = this.phaseT + 0.35 + Math.random() * 0.5; const c = PLAYER_COLORS[Math.floor(Math.random() * 4)]; this.fx.firework((Math.random() - 0.5) * 13, 0.5 + Math.random() * 3, c); this.audio.pop(Math.floor(Math.random() * 8)); }
      if (this.phaseT > 2.2 && !this.resultsBtns) {
        this.resultsBtns = true; const [G, opts] = this.lastGame;
        this.hud.setButtons([
          { x: -6, y: 1.4, w: 3, h: 2.4, cls: 'side', colors: ['#2fe0a0', '#12a877'], html: `${ICONS.again}<h3>Play again</h3>`, onSelect: () => this.startGame(G, opts) },
          { x: 6, y: 1.4, w: 3, h: 2.4, cls: 'side', colors: ['#8f6bff', '#5a35d6'], html: `${ICONS.home}<h3>Menu</h3>`, onSelect: () => this.toMenu() },
        ]);
      }
    }
    this.hud.updateButtons(players, dt);
    this.fx.update(dt);
    const s = this.fx.shakeAmt * 0.25;
    this.camera.position.set((Math.random() - 0.5) * s, (Math.random() - 0.5) * s, CAM_D); this.camera.rotation.set(0, 0, (Math.random() - 0.5) * s * 0.03);
    if (this.noRender) return;
    this.comic.uniforms.uFlash.value = this.fx.flashAmt;
    if (this.lowFx) this.renderer.render(this.scene, this.camera); else this.composer.render(dt);

    // keep it smooth on slower devices by lowering the render resolution
    this.fpsAcc += dt; this.fpsN++;
    if (this.fpsAcc > 3) {
      const fps = this.fpsN / this.fpsAcc; this.fps = fps; this.fpsAcc = 0; this.fpsN = 0;
      if (fps < 42 && this.pixelRatio > 0.8 && !qs.has('sim')) { this.pixelRatio = Math.max(0.75, this.pixelRatio - 0.25); this.resize(); }
    }
  }
}

new App();
