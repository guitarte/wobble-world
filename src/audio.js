// All sound is synthesized live with Web Audio: original music in several
// styles from a small step sequencer, plus every sound effect.
const _ = null;
const mtof = (m) => 440 * Math.pow(2, (m - 69) / 12);

// chords: semitone offsets from the track root. lead: one entry per 8th note over 4 bars.
const TRACKS = {
  menu: {
    bpm: 104, root: 60, chords: [[0, 4, 7], [-3, 0, 4], [5, 9, 12], [7, 11, 14]],
    k: 'x.......x.......', s: '....x.......x...', h: 'x.x.x.x.x.x.x.x.', bass: '0.....0.0...5...', arp: '0.1.2.3.2.1.2.1.',
    lead: [4, _, 7, _, 9, 7, 4, _, 2, _, 4, _, 0, _, _, _, 4, _, 7, _, 9, 12, 9, _, 7, _, 4, 2, 0, _, _, _], leadType: 'bell', pad: true,
  },
  jelly: {
    bpm: 120, root: 65, chords: [[0, 4, 7], [-3, 0, 4], [-7, -3, 0], [-5, -1, 2]],
    k: 'x.....x.x.......', s: '....x.......x..x', h: '..x...x...x...x.', bass: '0..0..5.0..0..8.', arp: '0.2.1.2.3.2.1.2.',
    lead: [0, _, 4, 7, _, 4, 7, 9, 7, _, 4, _, 2, _, _, _, 0, _, 4, 7, _, 9, 12, 9, 7, 4, 2, _, 0, _, _, _], leadType: 'bell', pad: true,
  },
  walls: {
    bpm: 128, root: 57, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    k: 'x...x...x...x...', s: '....x.......x...', h: '..x...x...x...x.', bass: '0.0.0.0.0.0.0.8.', arp: '0123012301230123',
    lead: [12, _, _, 15, 17, _, 19, _, 17, _, 15, _, 12, _, _, _, 19, _, _, 22, 19, _, 17, _, 15, _, 17, _, 15, _, 12, _], leadType: 'saw', pad: true,
  },
  comet: {
    bpm: 140, root: 62, chords: [[0, 3, 7], [-4, 0, 3], [-2, 2, 5], [-5, -2, 2]],
    k: 'x...x...x...x.x.', s: '....x.......x...', h: 'x.xxx.xxx.xxx.xx', bass: '0.00.0.00.00.0.8', arp: '0.2.3.2.1.2.3.4.',
    lead: [12, _, 15, _, 19, _, _, 17, _, 15, _, 12, _, _, 10, _, 12, _, 15, _, 19, _, 22, _, 24, _, 22, 19, 15, _, _, _], leadType: 'square', pad: true,
  },
  pop: {
    bpm: 116, root: 67, chords: [[0, 4, 7], [-5, -1, 2], [-3, 0, 4], [-7, -3, 0]],
    k: 'x...x...x...x...', s: '....x.......x...', c: '....x.......x...', h: '..x...x...x...x.', bass: '0..0..0.5..0..8.', stab: 'x.....x...x.....',
    arp: '..2.3...2.3.4...',
    lead: [4, 4, 7, _, 9, _, 7, 4, 2, _, 4, _, 7, _, _, _, 4, 4, 7, _, 9, _, 12, 9, 7, _, 4, _, 2, _, 0, _], leadType: 'bell', pad: true,
  },
  kpop: {
    bpm: 126, root: 66, chords: [[0, 3, 7], [-4, 0, 3], [3, 7, 10], [-2, 2, 5]],
    k: 'x..x..x...x.x...', s: '....x.......x...', c: '....x.......x.xx', h: 'xxxxxxxxxxxxxxxx', bass: '0..0..0...0.8...', stab: 'x..x..x.....x...',
    lead: [12, _, 15, 12, 19, _, 17, _, 15, _, 12, _, 10, 12, _, _, 12, _, 15, 12, 19, _, 22, _, 24, _, 22, 19, 17, 15, 12, _], leadType: 'saw', pad: false,
  },
  hiphop: {
    bpm: 92, root: 60, swing: 0.22, chords: [[0, 3, 7, 10], [-4, 0, 3, 7], [3, 7, 10, 14], [-2, 2, 5, 8]],
    k: 'x.....x...x..x..', s: '....x.......x...', c: '....x.......x...', h: 'x.x.x.x.x.x.x.xx', bass: '0.....0...0..8..', bassType: '808', stab: '..x.......x.....',
    lead: [_, _, 12, _, 15, _, 12, 10, _, _, 7, _, 10, _, _, _, _, _, 12, _, 15, _, 17, 15, _, 12, _, 10, 12, _, _, _], leadType: 'bell', pad: false,
  },
};

export class AudioEngine {
  constructor() { this.ctx = null; this.track = null; this.step = 0; this.nextTime = 0; this.startTime = 0; this.muted = false; this.intensity = 1; }

  init() {
    if (this.ctx) { this.ctx.resume(); return; }
    const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
    const ctx = this.ctx = new AC();
    this.comp = ctx.createDynamicsCompressor(); this.comp.threshold.value = -14; this.comp.ratio.value = 5; this.comp.attack.value = 0.004; this.comp.release.value = 0.2;
    this.master = ctx.createGain(); this.master.gain.value = 0.85; this.comp.connect(this.master); this.master.connect(ctx.destination);
    this.music = ctx.createGain(); this.music.gain.value = 0.5;
    this.musicLP = ctx.createBiquadFilter(); this.musicLP.type = 'lowpass'; this.musicLP.frequency.value = 18000;
    this.music.connect(this.musicLP); this.musicLP.connect(this.comp);
    this.sfx = ctx.createGain(); this.sfx.gain.value = 0.8; this.sfx.connect(this.comp);
    // reverb from a generated impulse
    const len = ctx.sampleRate * 1.8, ir = ctx.createBuffer(2, len, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) { const d = ir.getChannelData(ch); for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 2.6); }
    this.rev = ctx.createConvolver(); this.rev.buffer = ir; const rg = ctx.createGain(); rg.gain.value = 0.3; this.rev.connect(rg); rg.connect(this.comp);
    // tempo delay
    this.delay = ctx.createDelay(1); this.delay.delayTime.value = 0.3; const fb = ctx.createGain(); fb.gain.value = 0.32;
    this.delay.connect(fb); fb.connect(this.delay); const dg = ctx.createGain(); dg.gain.value = 0.3; this.delay.connect(dg); dg.connect(this.comp);
    const nl = ctx.sampleRate; this.noise = ctx.createBuffer(1, nl, ctx.sampleRate); const nd = this.noise.getChannelData(0); for (let i = 0; i < nl; i++) nd[i] = Math.random() * 2 - 1;
    setInterval(() => this.schedule(), 25);
  }
  get ready() { return !!this.ctx; }
  get now() { return this.ctx ? this.ctx.currentTime : 0; }

  // --- low-level voices
  env(g, t, a, d, peak, sus = 0.0001) { g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(peak, t + a); g.gain.exponentialRampToValueAtTime(Math.max(sus, 0.0001), t + a + d); }
  osc(type, freq, t, dur, peak, dest, o = {}) {
    const c = this.ctx, os = c.createOscillator(), g = c.createGain(); os.type = type; os.frequency.setValueAtTime(freq, t);
    if (o.to) os.frequency.exponentialRampToValueAtTime(o.to, t + (o.toTime ?? dur));
    if (o.detune) os.detune.value = o.detune;
    this.env(g, t, o.attack ?? 0.005, dur, peak);
    let out = g;
    if (o.lp) { const f = c.createBiquadFilter(); f.type = 'lowpass'; f.frequency.setValueAtTime(o.lp, t); if (o.lpTo) f.frequency.exponentialRampToValueAtTime(o.lpTo, t + dur); f.Q.value = o.q ?? 1; g.connect(f); out = f; }
    os.connect(g); out.connect(dest); if (o.rev) out.connect(this.rev); if (o.delay) out.connect(this.delay);
    os.start(t); os.stop(t + dur + (o.attack ?? 0.005) + 0.05);
  }
  noiseHit(t, dur, peak, type, freq, dest, q = 1, toFreq) {
    const c = this.ctx, s = c.createBufferSource(), g = c.createGain(), f = c.createBiquadFilter(); s.buffer = this.noise; s.loop = true;
    f.type = type; f.frequency.setValueAtTime(freq, t); if (toFreq) f.frequency.exponentialRampToValueAtTime(toFreq, t + dur); f.Q.value = q;
    this.env(g, t, 0.002, dur, peak); s.connect(f); f.connect(g); g.connect(dest); s.start(t, Math.random()); s.stop(t + dur + 0.05);
    return g;
  }

  // --- music
  playMusic(name) {
    if (!this.ctx) { this.pending = name; return; }
    if (this.trackName === name && this.track) return;
    this.trackName = name; this.track = TRACKS[name]; this.step = 0; this.hypeOn = false;
    this.nextTime = this.ctx.currentTime + 0.08; this.startTime = this.nextTime;
    this.delay.delayTime.value = 60 / this.track.bpm * 0.75;
    this.music.gain.cancelScheduledValues(this.now); this.music.gain.setTargetAtTime(0.5, this.now, 0.05);
    this.setMuffle(false);
  }
  stopMusic() { this.track = null; this.trackName = null; }
  setMuffle(on) { if (this.ctx) this.musicLP.frequency.setTargetAtTime(on ? 500 : 18000, this.now, 0.08); }
  duck(on) { if (this.ctx) this.music.gain.setTargetAtTime(on ? 0.12 : 0.5, this.now, 0.1); }
  get bpm() { return this.track ? this.track.bpm : 120; }
  // beats since the track started (fractional). Games use this to stay on the beat.
  get beat() { return this.track ? (this.ctx.currentTime - this.startTime) / (60 / this.track.bpm) : 0; }

  schedule() {
    const T = this.track; if (!T || !this.ctx) return;
    const sd = 60 / T.bpm / 4;
    while (this.nextTime < this.ctx.currentTime + 0.14) {
      const st = this.step, s16 = st % 16, bar = Math.floor(st / 16);
      const t = this.nextTime + ((s16 % 2) ? (T.swing || 0) * sd : 0);
      this.playStep(T, t, s16, bar, sd);
      this.step++; this.nextTime += sd;
    }
  }
  // Each tune is arranged over 16 bars so it keeps moving: a groove to start,
  // the melody, a breakdown that builds with a drum roll, then a full chorus.
  // Games can also call hype(true) to jump to the chorus for a finale.
  playStep(T, t, s, bar, sd) {
    const m = this.music, ch = T.chords[bar % T.chords.length], root = T.root, hit = (p) => p && p[s % p.length] === 'x';
    const b16 = bar % 16, sec = this.hypeOn ? 3 : b16 >> 2, q = bar % 4;
    const breakdown = sec === 2 && q < 2, build = sec === 2 && q === 3, chorus = sec === 3;
    const fill = q === 3 && s >= 12 && !build;
    if (s === 0 && q === 0 && bar > 0 && (chorus || sec === 1)) this.crash(t);
    if (build && s === 0) this.riser(t, sd * 16);
    // drums
    const kick = breakdown ? s === 0 : build ? (s < 12 && s % 4 === 0) : (hit(T.k) || (chorus && T.bpm >= 110 && s % 4 === 0));
    if (kick) { this.osc('sine', 150, t, 0.22, 0.95, m, { to: 42, toTime: 0.12 }); this.noiseHit(t, 0.02, 0.2, 'lowpass', 1200, m); }
    const roll = build && (s < 8 ? s % 2 === 0 : true);
    if (roll || (!breakdown && (hit(T.s) || (fill && s % 2 === 0 && T.bpm > 100)))) { const v = roll ? 0.12 + 0.3 * (s / 16) : 0.42; this.noiseHit(t, 0.16, v, 'bandpass', 1900, m, 0.8); this.osc('triangle', 210, t, 0.09, v * 0.7, m, { to: 140 }); }
    if (fill && T.bpm <= 100) this.osc('sine', mtof(57 - (s - 12) * 3), t, 0.2, 0.5, m, { to: mtof(46 - (s - 12) * 3), toTime: 0.16 });
    if (!breakdown && !build && (hit(T.c) || (chorus && hit(T.s)))) { for (const o of [0, 0.011, 0.023]) this.noiseHit(t + o, 0.09, 0.2, 'bandpass', 1300, m, 1.4).connect(this.rev); }
    if (hit(T.h) && !build) this.noiseHit(t, 0.035, s % 4 === 2 ? 0.16 : 0.09, 'highpass', 7500, m);
    if (chorus && s % 4 === 2) this.noiseHit(t, 0.13, 0.1, 'highpass', 6200, m);
    if (chorus && s % 2 === 1) this.noiseHit(t, 0.025, 0.045, 'highpass', 9000, m);
    // bass
    const b = T.bass && T.bass[s], bassOn = !breakdown && !(build && s >= 12);
    if (bassOn && b && b !== '.') {
      const n = root + ch[0] - 24 + (b === '5' ? 7 : b === '8' ? 12 : 0);
      if (T.bassType === '808') this.osc('sine', mtof(n + 12) * 1.3, t, 0.55, 0.8, m, { to: mtof(n + 12), toTime: 0.06 });
      else { this.osc('sawtooth', mtof(n + 12), t, sd * 1.8, 0.3, m, { lp: 900, lpTo: 180, q: 4 }); this.osc('sine', mtof(n), t, sd * 1.8, 0.4, m); }
    } else if (bassOn && chorus && T.bassType !== '808' && s % 4 === 2) this.osc('sawtooth', mtof(root + ch[0]), t, sd * 1.4, 0.2, m, { lp: 1100, lpTo: 220, q: 4 });
    // harmony
    const a = T.arp && T.arp[s];
    if (a && a !== '.') {
      const i = +a, n = root + ch[i % 3] + 12 * Math.floor(i / 3) + 12; this.osc('triangle', mtof(n), t, 0.16, 0.13, m, { delay: true }); this.osc('square', mtof(n), t, 0.1, 0.03, m, { lp: 2400 });
      if (chorus) this.osc('triangle', mtof(n + 12), t + sd, 0.12, 0.06, m, { delay: true });
    }
    if ((hit(T.stab) && !breakdown) || (chorus && !T.stab && s % 8 === 6)) for (const c of ch) { this.osc('sawtooth', mtof(root + c + 12), t, 0.16, 0.07, m, { lp: 3200, lpTo: 600, detune: 8, rev: true }); this.osc('sawtooth', mtof(root + c + 12), t, 0.16, 0.07, m, { lp: 3200, lpTo: 600, detune: -8 }); }
    if ((T.pad || breakdown) && s === 0) for (const c of ch) this.osc('sawtooth', mtof(root + c), t, sd * 15, breakdown ? 0.05 : 0.035, m, { attack: 0.25, lp: breakdown ? 1700 : 1100, detune: (c % 2 ? 7 : -7), rev: true });
    // melody: sits out the first two bars, and is doubled an octave up in the chorus
    if (T.lead && s % 2 === 0 && !(sec === 0 && q < 2) && !build) {
      const n = T.lead[((bar % 4) * 8 + s / 2) % T.lead.length];
      if (n !== null && n !== undefined) {
        const base = root + n + (T.leadType === 'bell' ? 12 : 0);
        this.leadNote(T.leadType, base, t, sd * 2.4, breakdown ? 0.7 : 1);
        if (chorus) this.leadNote('bell', base + (T.leadType === 'bell' ? 12 : 24), t, sd * 2, 0.45);
      }
    }
  }
  leadNote(type, n, t, dur, v = 1) {
    const f = mtof(n), m = this.music;
    if (type === 'bell') { this.osc('sine', f, t, dur * 1.6, 0.17 * v, m, { rev: true, delay: true }); this.osc('sine', f * 3.01, t, 0.12, 0.05 * v, m); this.osc('triangle', f * 2, t, dur, 0.04 * v, m); }
    else if (type === 'saw') { this.osc('sawtooth', f, t, dur, 0.09 * v, m, { lp: 3800, lpTo: 900, q: 3, detune: 9, delay: true }); this.osc('sawtooth', f, t, dur, 0.09 * v, m, { lp: 3800, lpTo: 900, q: 3, detune: -9, rev: true }); }
    else { this.osc('square', f, t, dur, 0.07 * v, m, { lp: 2600, delay: true, rev: true }); }
  }
  crash(t) { this.noiseHit(t, 1.3, 0.26, 'highpass', 4200, this.music, 0.5).connect(this.rev); this.noiseHit(t, 0.25, 0.16, 'bandpass', 900, this.music, 0.6); }
  riser(t, dur) { const g = this.noiseHit(t, dur, 0.001, 'bandpass', 500, this.music, 2.5, 7000); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.2, t + dur * 0.97); g.gain.exponentialRampToValueAtTime(0.0001, t + dur + 0.04); }
  // Jump the music to its chorus for a finale (and back).
  hype(on) { if (this.hypeOn === on) return; this.hypeOn = on; if (on && this.ctx && this.track) this.crash(this.now + 0.02); }

  // --- sound effects
  tone(type, n, dur, vol, o = {}) { if (this.ctx) this.osc(type, mtof(n), this.now + (o.at || 0), dur, vol, this.sfx, o); }
  pop(combo = 0) {
    if (!this.ctx) return; const t = this.now, sc = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24], n = 72 + sc[Math.min(combo, sc.length - 1)];
    this.osc('sine', mtof(n) * 0.6, t, 0.1, 0.5, this.sfx, { to: mtof(n) * 1.5, toTime: 0.06 });
    this.osc('triangle', mtof(n + 12), t + 0.03, 0.16, 0.16, this.sfx, { rev: true });
    this.noiseHit(t, 0.05, 0.22, 'highpass', 3000, this.sfx);
  }
  ding(n = 84) { this.tone('sine', n, 0.5, 0.3, { rev: true }); this.tone('sine', n + 7, 0.5, 0.2, { at: 0.07, rev: true }); }
  gold() { [84, 88, 91, 96].forEach((n, i) => this.tone('triangle', n, 0.3, 0.22, { at: i * 0.055, rev: true })); }
  bad() { if (!this.ctx) return; this.tone('sawtooth', 46, 0.35, 0.3, { to: 55, lp: 700 }); this.tone('square', 40, 0.35, 0.16, { lp: 500 }); this.noiseHit(this.now, 0.2, 0.25, 'lowpass', 700, this.sfx); }
  tick() { this.tone('sine', 96, 0.04, 0.12); }
  hover() { this.tone('triangle', 79, 0.08, 0.12); }
  select() { [72, 76, 79, 84, 88].forEach((n, i) => this.tone('triangle', n, 0.25, 0.22, { at: i * 0.05, rev: true })); this.whoosh(); }
  count() { this.tone('square', 72, 0.16, 0.2, { lp: 2000 }); this.tone('sine', 72, 0.2, 0.3); }
  go() { [72, 76, 79, 84].forEach(n => this.tone('sawtooth', n, 0.6, 0.11, { lp: 3000, rev: true })); this.tone('sine', 84, 0.6, 0.3); }
  whoosh(up = true) { if (this.ctx) this.noiseHit(this.now, 0.4, 0.28, 'bandpass', up ? 400 : 3000, this.sfx, 1.5, up ? 3500 : 300); }
  smash() { if (!this.ctx) return; const t = this.now; this.noiseHit(t, 0.4, 0.6, 'lowpass', 2600, this.sfx, 0.7, 200).connect(this.rev); this.osc('sine', 120, t, 0.35, 0.8, this.sfx, { to: 35 }); }
  zap() { this.tone('sawtooth', 96, 0.18, 0.16, { to: 180, lp: 5000 }); }
  block(n = 0) { if (!this.ctx) return; const t = this.now; this.osc('triangle', mtof(64 + n), t, 0.22, 0.4, this.sfx, { to: mtof(76 + n), toTime: 0.08, rev: true }); this.noiseHit(t, 0.08, 0.3, 'bandpass', 2400, this.sfx, 2); }
  join() { this.tone('triangle', 76, 0.2, 0.25, { rev: true }); this.tone('triangle', 83, 0.3, 0.25, { at: 0.1, rev: true }); }
  perfect() { [79, 84, 88, 91].forEach((n, i) => this.tone('sine', n, 0.4, 0.16, { at: i * 0.03, rev: true })); }
  good() { this.tone('sine', 79, 0.2, 0.18, { rev: true }); }
  scratch() { if (this.ctx) { this.noiseHit(this.now, 0.25, 0.4, 'bandpass', 2500, this.sfx, 3, 500); this.tone('sawtooth', 70, 0.25, 0.2, { to: 90, lp: 1500 }); } }
  cheer(dur = 1.6) {
    if (!this.ctx) return; const t = this.now;
    for (const f of [900, 1500, 2300, 3200]) { const g = this.noiseHit(t, dur, 0.001, 'bandpass', f, this.sfx, 1.2); g.gain.cancelScheduledValues(t); g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(0.1, t + 0.25); g.gain.exponentialRampToValueAtTime(0.0001, t + dur); g.connect(this.rev); }
  }
  fanfare() { const seq = [[72, 0], [76, 0.12], [79, 0.24], [84, 0.36], [79, 0.52], [84, 0.64], [88, 0.8]]; for (const [n, at] of seq) { this.tone('sawtooth', n, 0.35, 0.12, { at, lp: 3500, rev: true }); this.tone('triangle', n + 12, 0.35, 0.14, { at }); } this.cheer(2.4); }
  freeze() { [96, 91, 84, 79].forEach((n, i) => this.tone('sine', n, 0.5, 0.14, { at: i * 0.04, rev: true })); }
}
