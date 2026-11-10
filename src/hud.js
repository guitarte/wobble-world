// Everything drawn in HTML on top of the 3D scene: score chips, banners, the
// countdown, body-controlled buttons, hand cursors and the results board.
import { PLAYER_CSS, PLAYER_NAMES } from './tracking.js';

const $ = (id) => document.getElementById(id);
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html !== undefined) e.innerHTML = html; return e; };

export const ICONS = {
  jelly: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="52" rx="38" ry="34" fill="#fff" opacity=".28"/><path d="M24 58c0-22 16-38 36-38s36 16 36 38c0 8-8 6-12 12s-8 2-12 8-8 0-12 4-8-6-12-4-8-2-12-8-12-4-12-12z" fill="#ff7fb0"/><path d="M40 82q-4 14 2 24M60 88q4 12-2 24M80 82q6 12 0 24" stroke="#ffb3d1" stroke-width="6" fill="none" stroke-linecap="round"/><circle cx="48" cy="54" r="7" fill="#fff"/><circle cx="72" cy="54" r="7" fill="#fff"/><circle cx="49" cy="55" r="3.5" fill="#2a1a3a"/><circle cx="73" cy="55" r="3.5" fill="#2a1a3a"/><path d="M52 68q8 7 16 0" stroke="#2a1a3a" stroke-width="3.5" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="36" rx="9" ry="5" fill="#fff" opacity=".6" transform="rotate(-25 44 36)"/></svg>`,
  walls: `<svg viewBox="0 0 120 120"><rect x="12" y="14" width="96" height="92" rx="12" fill="#23e6ff"/><rect x="12" y="14" width="96" height="92" rx="12" fill="none" stroke="#fff" stroke-width="4" opacity=".6"/><path d="M60 30a11 11 0 1 1 0 22 11 11 0 0 1 0-22zM22 50l26 6h24l26-6v12l-24 6v38H62V88h-4v18H46V68l-24-6z" fill="#1b0a3d"/></svg>`,
  comet: `<svg viewBox="0 0 120 120"><path d="M12 16l62 44-26 22z" fill="#ffd84a" opacity=".55"/><path d="M26 22l52 40-18 14z" fill="#ff9248" opacity=".8"/><circle cx="78" cy="76" r="27" fill="#ff5a78"/><circle cx="78" cy="76" r="27" fill="none" stroke="#fff" stroke-width="4" opacity=".5"/><circle cx="68" cy="68" r="7" fill="#fff" opacity=".7"/><circle cx="88" cy="84" r="5" fill="#c93a5c"/><circle cx="74" cy="90" r="3.5" fill="#c93a5c"/></svg>`,
  lesson: `<svg viewBox="0 0 120 120"><circle cx="60" cy="26" r="14" fill="#fff"/><path d="M60 42v34M60 50L30 30M60 50l30-20M60 76L40 108M60 76l22 30" stroke="#fff" stroke-width="11" stroke-linecap="round" fill="none"/><path d="M96 62l3 8 8 3-8 3-3 8-3-8-8-3 8-3zM22 64l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill="#ffd84a"/></svg>`,
  battle: `<svg viewBox="0 0 120 120"><circle cx="30" cy="30" r="11" fill="#ff5a78"/><path d="M30 42v28M30 50L12 38M30 50l16 10M30 70L18 100M30 70l14 28" stroke="#ff5a78" stroke-width="9" stroke-linecap="round" fill="none"/><circle cx="90" cy="30" r="11" fill="#22d3c5"/><path d="M90 42v28M90 50l18-14M90 50L74 60M90 70l12 30M90 70L76 98" stroke="#22d3c5" stroke-width="9" stroke-linecap="round" fill="none"/><path d="M64 34L52 60h10l-6 24 16-30H62z" fill="#ffd84a"/></svg>`,
  pop: `<svg viewBox="0 0 120 120"><path d="M60 14l12 30 32 3-24 21 8 32-28-17-28 17 8-32-24-21 32-3z" fill="#fff"/></svg>`,
  kpop: `<svg viewBox="0 0 120 120"><path d="M60 102S16 74 16 44a22 22 0 0 1 44-6 22 22 0 0 1 44 6c0 30-44 58-44 58z" fill="#fff"/></svg>`,
  hiphop: `<svg viewBox="0 0 120 120"><rect x="14" y="38" width="92" height="56" rx="12" fill="#fff"/><circle cx="40" cy="66" r="15" fill="#2a1a3a"/><circle cx="80" cy="66" r="15" fill="#2a1a3a"/><circle cx="40" cy="66" r="5" fill="#fff"/><circle cx="80" cy="66" r="5" fill="#fff"/><path d="M34 38V24h52v14" stroke="#fff" stroke-width="8" fill="none"/></svg>`,
  again: `<svg viewBox="0 0 120 120"><path d="M60 24a36 36 0 1 0 34 24" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round"/><path d="M58 6l26 18-26 18z" fill="#fff"/></svg>`,
  hero: `<svg viewBox="0 0 120 120"><path d="M22 58L14 22l22 14L48 8l12 22L72 8l12 28 22-14-8 36z" fill="#ffd84a"/><circle cx="60" cy="72" r="36" fill="#fff"/><ellipse cx="46" cy="70" rx="7" ry="10" fill="#2a1a3a"/><ellipse cx="74" cy="70" rx="7" ry="10" fill="#2a1a3a"/><path d="M46 90q14 12 28 0" stroke="#2a1a3a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  more: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="#fff"/><path d="M48 34l30 26-30 26z" fill="#2a1a3a"/></svg>`,
  back: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="#fff"/><path d="M72 34L42 60l30 26z" fill="#2a1a3a"/></svg>`,
  ok: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="46" fill="#fff"/><path d="M36 62l16 16 32-36" stroke="#12a877" stroke-width="13" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
  make: `<svg viewBox="0 0 120 120"><path d="M26 94l8-30 44-44 22 22-44 44z" fill="#fff"/><path d="M26 94l8-30 22 22z" fill="#ffd84a"/><path d="M92 62l4 11 11 4-11 4-4 11-4-11-11-4 11-4zM24 14l3 9 9 3-9 3-3 9-3-9-9-3 9-3z" fill="#ffd84a"/></svg>`,
  mirror: `<svg viewBox="0 0 120 120"><rect x="12" y="30" width="96" height="66" rx="12" fill="#fff"/><path d="M40 30l8-14h24l8 14z" fill="#fff"/><circle cx="60" cy="63" r="22" fill="#2a1a3a"/><circle cx="60" cy="63" r="12" fill="#4fd8ff"/><circle cx="54" cy="57" r="4" fill="#fff"/></svg>`,
  chop: `<svg viewBox="0 0 120 120"><path d="M14 66l52-34 40 6-34 28z" fill="#fff"/><path d="M66 32l6 34H14z" fill="#ffe1ea"/><path d="M72 66l-10 34-20-34z" fill="#ff9ab4"/><path d="M20 106L104 14" stroke="#2a1a3a" stroke-width="13" stroke-linecap="round"/><path d="M20 106L104 14" stroke="#ffd84a" stroke-width="6" stroke-linecap="round"/></svg>`,
  balloon: `<svg viewBox="0 0 120 120"><ellipse cx="60" cy="46" rx="34" ry="38" fill="#ff5a78"/><path d="M52 82h16l-4 10h-8z" fill="#ff5a78"/><path d="M60 92q-12 10 0 18" stroke="#fff" stroke-width="4" fill="none" stroke-linecap="round"/><ellipse cx="44" cy="28" rx="7" ry="12" fill="#fff" opacity=".7" transform="rotate(24 44 28)"/><circle cx="50" cy="50" r="4.5" fill="#2a1a3a"/><circle cx="72" cy="50" r="4.5" fill="#2a1a3a"/><path d="M52 62q9 8 18 0" stroke="#2a1a3a" stroke-width="4" fill="none" stroke-linecap="round"/></svg>`,
  wing: `<svg viewBox="0 0 120 120"><circle cx="80" cy="40" r="28" fill="none" stroke="#ffd84a" stroke-width="9"/><path d="M6 80l96-42-40 64-10-24z" fill="#fff"/><path d="M52 78l50-40-40 64z" fill="#bfe0ff"/></svg>`,
  laser: `<svg viewBox="0 0 120 120"><rect x="6" y="66" width="18" height="30" rx="5" fill="#fff"/><rect x="96" y="66" width="18" height="30" rx="5" fill="#fff"/><path d="M24 81h72" stroke="#23e6ff" stroke-width="11" stroke-linecap="round"/><path d="M24 81h72" stroke="#fff" stroke-width="3"/><circle cx="60" cy="18" r="10" fill="#fff"/><path d="M60 30v18M60 36l-16-8M60 36l16-8M60 48l-13 12M60 48l13 12" stroke="#fff" stroke-width="8" stroke-linecap="round" fill="none"/></svg>`,
  trot: `<svg viewBox="0 0 120 120"><path d="M30 42l18 4 16 24 34 8q14 3 14 16H24z" fill="#fff"/><path d="M22 94h92v9H22z" fill="#ffd84a"/><path d="M58 60l9-6M66 71l9-6" stroke="#ff5a78" stroke-width="5" stroke-linecap="round"/><path d="M4 54h18M2 70h16M6 86h12" stroke="#fff" stroke-width="6" stroke-linecap="round"/></svg>`,
  freeze: `<svg viewBox="0 0 120 120"><circle cx="58" cy="64" r="46" fill="#fff"/><circle cx="58" cy="64" r="32" fill="#2a1a3a"/><rect x="43" y="48" width="11" height="32" rx="3" fill="#4fd8ff"/><rect x="62" y="48" width="11" height="32" rx="3" fill="#4fd8ff"/><path d="M100 6l4 11 11 4-11 4-4 11-4-11-11-4 11-4z" fill="#ffd84a"/></svg>`,
  dot: `<svg viewBox="0 0 120 120"><path d="M14 16h92a8 8 0 0 1 8 8v50a8 8 0 0 1-8 8H60l-24 24V82H14a8 8 0 0 1-8-8V24a8 8 0 0 1 8-8z" fill="#fff"/><circle cx="42" cy="44" r="7" fill="#2a1a3a"/><circle cx="78" cy="44" r="7" fill="#2a1a3a"/><path d="M44 58q16 13 32 0" stroke="#2a1a3a" stroke-width="6" fill="none" stroke-linecap="round"/></svg>`,
  bowl: `<svg viewBox="0 0 120 120"><path d="M78 10q9 0 9 11t-5 15q11 13 9 36t-13 32H66q-11-9-13-32t9-36q-5-4-5-15t9-11z" fill="#fff"/><path d="M60 37h34" stroke="#ff5a78" stroke-width="6"/><circle cx="36" cy="80" r="28" fill="#4fd8ff"/><circle cx="27" cy="70" r="4.5" fill="#2a1a3a"/><circle cx="41" cy="68" r="4.5" fill="#2a1a3a"/><circle cx="36" cy="82" r="4.5" fill="#2a1a3a"/></svg>`,
  pow: `<svg viewBox="0 0 120 120"><rect x="8" y="10" width="48" height="22" rx="5" fill="#ff5a78"/><rect x="64" y="10" width="48" height="22" rx="5" fill="#ffd84a"/><rect x="6" y="38" width="28" height="22" rx="5" fill="#22d3c5"/><rect x="86" y="38" width="28" height="22" rx="5" fill="#b18cff"/><path d="M60 36l6 13 14-3-8 12 9 11-15-1-6 14-6-14-15 1 9-11-8-12 14 3z" fill="#fff"/><circle cx="60" cy="100" r="13" fill="#fff"/></svg>`,
  topple: `<svg viewBox="0 0 120 120"><rect x="34" y="86" width="52" height="24" rx="5" fill="#22d3c5"/><rect x="26" y="60" width="48" height="24" rx="5" fill="#ffd84a" transform="rotate(-5 50 72)"/><rect x="44" y="34" width="46" height="24" rx="5" fill="#ff5a78" transform="rotate(7 67 46)"/><rect x="36" y="8" width="40" height="24" rx="5" fill="#fff" transform="rotate(-10 56 20)"/><path d="M102 30q8 9 0 19M16 38q-8 9 0 19" stroke="#fff" stroke-width="5" fill="none" stroke-linecap="round"/></svg>`,
  home: `<svg viewBox="0 0 120 120"><path d="M16 60l44-40 44 40" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 58v42h24V76h12v24h24V58" fill="#fff"/></svg>`,
};

export class HUD {
  constructor(app) {
    this.app = app; this.buttons = []; this.chips = {}; this.cursors = [];
    this.scoresEl = $('scores'); this.bannerEl = $('banner'); this.countEl = $('count'); this.btnEl = $('buttons');
    this.curEl = $('cursors'); this.hintEl = $('hint'); this.titleEl = $('gtitle'); this.timerEl = $('timer'); this.statusEl = $('status');
    this.sideEl = $('strip'); this.howEl = $('howto'); this.resEl = $('results'); this.wipeEl = $('wipe'); this.topEl = $('top');
    for (let i = 0; i < 8; i++) { const c = el('div', 'cursor'); c.style.setProperty('--pc', PLAYER_CSS[i >> 1]); this.curEl.appendChild(c); this.cursors.push(c); }
    this.tags = PLAYER_NAMES.map((n, i) => { const t = el('div', 'nametag', n); t.style.setProperty('--pc', PLAYER_CSS[i]); $('tags').appendChild(t); return t; });
  }

  // ----- top bar
  showTop(title) { this.topEl.classList.add('on'); this.titleEl.textContent = title; this.timerEl.textContent = ''; this.statusEl.innerHTML = ''; }
  hideTop() { this.topEl.classList.remove('on'); this.scoresEl.innerHTML = ''; this.chips = {}; this.side(''); }
  setTimer(sec) { const s = Math.max(0, Math.ceil(sec)); const txt = s; if (this.timerEl.textContent !== String(txt)) { this.timerEl.textContent = txt; this.timerEl.classList.toggle('low', s <= 10); } }
  setStatus(html) { if (this.statusEl.innerHTML !== html) this.statusEl.innerHTML = html; }
  setScore(slot, score, sub) {
    let c = this.chips[slot];
    if (!c) {
      c = this.chips[slot] = el('div', 'chip'); c.style.setProperty('--pc', PLAYER_CSS[slot]);
      c.innerHTML = `<i></i><b>${PLAYER_NAMES[slot]}</b><span>0</span><em></em>`; this.scoresEl.appendChild(c); c.dataset.v = '0';
    }
    if (c.dataset.v !== String(score)) { c.dataset.v = score; c.querySelector('span').textContent = score.toLocaleString(); c.classList.remove('bump'); void c.offsetWidth; c.classList.add('bump'); }
    if (sub !== undefined) c.querySelector('em').textContent = sub;
  }
  removeScore(slot) { this.chips[slot]?.remove(); delete this.chips[slot]; }

  // ----- a strip down the left edge: move pictures in the dance games
  side(html, color) { if (this.sideHtml !== html) { this.sideHtml = html; this.sideEl.innerHTML = html; this.sideOn = -1; } if (color) this.sideEl.style.setProperty('--ac', color); this.sideEl.classList.toggle('on', !!html); }
  sideActive(i) { if (this.sideOn === i) return; this.sideOn = i; this.sideEl.querySelectorAll('.pic').forEach((e, k) => e.classList.toggle('on', k === i)); }

  // ----- big moments
  banner(text, color = '#fff', dur = 1.3, sub = '', cls = '') {
    this.bannerEl.innerHTML = `<div style="color:${color}">${text}</div>${sub ? `<small>${sub}</small>` : ''}`;
    this.bannerEl.className = ''; void this.bannerEl.offsetWidth; this.bannerEl.className = 'show ' + cls; this.bannerEl.style.setProperty('--d', dur + 's');
  }
  count(text) { this.countEl.textContent = text; this.countEl.className = ''; void this.countEl.offsetWidth; this.countEl.className = 'show'; }
  hint(text) { this.hintEl.textContent = text || ''; this.hintEl.classList.toggle('on', !!text); }
  howto(game, extra = '') {
    this.howEl.innerHTML = `<div class="how-card" style="--c1:${game.colors[0]};--c2:${game.colors[1]}"><div class="how-icon">${ICONS[game.icon]}</div><div><h2>${game.title}</h2>${extra ? `<div class="tag">${extra}</div>` : ''}<ul>${game.howto.map(l => `<li>${l}</li>`).join('')}</ul></div></div>`;
    this.howEl.classList.add('on');
  }
  hideHowto() { this.howEl.classList.remove('on'); }
  async wipe(color, mid) {
    this.wipeEl.style.setProperty('--wc', color); this.wipeEl.className = 'in';
    await new Promise(r => setTimeout(r, 480)); await mid?.(); this.wipeEl.className = 'out';
    await new Promise(r => setTimeout(r, 450)); this.wipeEl.className = '';
  }

  // ----- body-controlled buttons. x, y, w, h are in stage units.
  setButtons(defs) {
    this.btnEl.innerHTML = ''; this.buttons = [];
    for (const d of defs) {
      const b = el('button', 'btn ' + (d.cls || ''), `<div class="btn-fill"></div><div class="btn-body">${d.html}</div>`);
      b.style.cssText += `left:calc(50% + ${d.x - d.w / 2} * var(--u));top:calc(50% - ${d.y + d.h / 2} * var(--u));width:calc(${d.w} * var(--u));height:calc(${d.h} * var(--u));`;
      if (d.colors) { b.style.setProperty('--c1', d.colors[0]); b.style.setProperty('--c2', d.colors[1]); }
      const rec = { ...d, el: b, p: 0, hot: false, fired: false, dwell: d.dwell ?? 1.25 };
      b.addEventListener('click', () => { rec.by = undefined; this.fire(rec); });
      this.btnEl.appendChild(b); this.buttons.push(rec);
    }
  }
  clearButtons() { this.btnEl.innerHTML = ''; this.buttons = []; }
  // one choice at a time: once a button has gone off, the rest wait for the screen to change.
  // A repeat button (a hero to try on, a colour to pick) can be chosen again and again.
  fire(b) {
    if (this.buttons.some(x => x.fired)) return;
    const by = b.by ?? this.only ?? this.app.players[0]?.slot ?? 0;
    this.app.audio.select();
    if (b.repeat) { b.p = 0; b.armed = false; b.hot = false; b.el.classList.remove('hot'); b.onSelect(by); return; }
    b.fired = true; b.el.classList.add('fired'); b.onSelect(by);
  }
  // a player's colour and name follow their hero
  identity(slot) {
    for (const h of [0, 1]) this.cursors[slot * 2 + h].style.setProperty('--pc', PLAYER_CSS[slot]);
    this.tags[slot].textContent = PLAYER_NAMES[slot]; this.tags[slot].style.setProperty('--pc', PLAYER_CSS[slot]);
    const c = this.chips[slot]; if (c) { c.style.setProperty('--pc', PLAYER_CSS[slot]); c.querySelector('b').textContent = PLAYER_NAMES[slot]; }
  }
  updateButtons(players, dt) {
    let n = 0; const show = this.buttons.some(b => !b.quiet);
    // On menus a hand is a stretched pointer. The quiet home button during a game uses the
    // hand itself, so nobody leaves a game by accident with a big dance move.
    const cx = (p, h) => (show ? p.rig.cursorX(h) : p.rig.hands[h].x);
    if (this.app.sim) players = players.filter(p => p.slot === 0); // without a camera only the pointer's hero chooses
    if (this.only != null && players.some(p => p.slot === this.only)) players = players.filter(p => p.slot === this.only); // one player is building a hero
    for (const p of players) for (let h = 0; h < 2; h++) {
      const c = this.cursors[p.slot * 2 + h];
      c.style.transform = `translate(calc(${cx(p, h)} * var(--u)), calc(${-p.rig.cursorY(h)} * var(--u)))`; c.classList.toggle('on', show); c.dataset.live = '1'; n++;
    }
    // name tags float over each hero's head while choosing
    const ph = this.app.phase, tagsOn = ph === 'menu' || ph === 'genre' || ph === 'results';
    this.tags.forEach((t, i) => {
      const p = this.app.players.find(q => q.slot === i); t.classList.toggle('on', !!p && tagsOn); t.classList.toggle('win', ph === 'results' && !!this.app.winSlots?.includes(i)); if (!p) return;
      const y = Math.max(-4.12, p.rig.floorY - 0.32);
      t.style.transform = `translate(-50%, -50%) translate(calc(${Math.max(-7.4, Math.min(7.4, p.rig.j.hipC.x))} * var(--u)), calc(${-y} * var(--u))) rotate(${i % 2 ? 3 : -3}deg)`;
    });
    for (const c of this.cursors) { if (!c.dataset.live) c.classList.remove('on'); delete c.dataset.live; }
    // nothing sits above a menu button, so a hand stretched higher than its top edge still counts
    // The quiet home button also wants one calm hand: two hands in the air, or a hand flying past, is somebody playing.
    const m = 0.15, on = (p, h, b) => {
      if (b.quiet && (p.rig.hands[1 - h].y > p.j.chest.y || p.rig.handVel[h].length() > 2.5 * p.rig.S)) return false;
      const dy = p.rig.cursorY(h) - b.y; return Math.abs(cx(p, h) - b.x) < b.w / 2 + m && dy > -b.h / 2 - m && (dy < b.h / 2 + m || !b.quiet);
    };
    const pointed = new Set();
    for (const p of players) {
      const mine = [0, 1].map(h => this.buttons.find(b => !b.fired && on(p, h, b)));
      // two hands on two different buttons is a cheer or a star jump, not a choice
      if (mine[0] && mine[1] && mine[0] !== mine[1]) continue;
      for (const b of mine) if (b) { pointed.add(b); b.by = p.slot; }
    }
    for (const b of this.buttons) {
      if (b.fired) continue;
      let hot = pointed.has(b);
      // A hand that is already resting where a new button appears does not count until
      // it has moved away once, so one long reach cannot pick two things in a row.
      if (!b.armed) { if (hot) hot = false; else b.armed = true; }
      if (hot && !b.hot) this.app.audio.hover();
      b.hot = hot; b.p = Math.max(0, Math.min(1, b.p + (hot ? dt / b.dwell : -dt * 1.8)));
      b.el.classList.toggle('hot', hot); b.el.style.setProperty('--p', b.p.toFixed(3));
      if (b.p >= 1) this.fire(b);
    }
  }

  // ----- results
  showResults({ title, rows, stars, best, isBest, note }) {
    const starHtml = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'lit' : ''}" style="animation-delay:${0.5 + i * 0.25}s">★</span>`).join('');
    // a short, wide card: it has to leave the heroes' faces in view below it
    const rank = rows.map(r => 1 + rows.filter(o => o.score > r.score).length); // equal scores share a place
    this.resEl.innerHTML = `<div class="res-card"><div class="res-head"><h2>${title}</h2><div class="stars">${starHtml}</div></div>
      <div class="rows ${rows.length < 2 ? 'one' : ''}">${rows.map((r, i) => `<div class="row ${rank[i] === 1 ? 'win' : ''}" style="--pc:${r.css};animation-delay:${0.2 + i * 0.15}s"><b>${r.badge ?? rank[i]}</b><i></i><span>${r.name}</span><strong data-to="${r.score}">0</strong></div>`).join('')}</div>
      <div class="res-foot"><div class="best ${isBest ? 'new' : ''}">${isBest ? 'New best score!' : (best ? `Best: ${best.toLocaleString()}` : '')}</div>${note ? `<div class="note">${note}</div>` : ''}</div></div>`;
    this.resEl.classList.add('on');
    const t0 = performance.now();
    const tick = () => {
      const k = Math.min(1, (performance.now() - t0 - 400) / 1200); if (!this.resEl.classList.contains('on')) return;
      this.resEl.querySelectorAll('strong').forEach(s => { s.textContent = Math.round(+s.dataset.to * Math.max(0, 1 - Math.pow(1 - k, 3))).toLocaleString(); });
      if (k < 1) requestAnimationFrame(tick);
    }; tick();
  }
  hideResults() { this.resEl.classList.remove('on'); }
}
