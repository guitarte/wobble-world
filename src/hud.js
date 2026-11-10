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
  home: `<svg viewBox="0 0 120 120"><path d="M16 60l44-40 44 40" stroke="#fff" stroke-width="12" fill="none" stroke-linecap="round" stroke-linejoin="round"/><path d="M30 58v42h24V76h12v24h24V58" fill="#fff"/></svg>`,
};

export class HUD {
  constructor(app) {
    this.app = app; this.buttons = []; this.chips = {}; this.cursors = [];
    this.scoresEl = $('scores'); this.bannerEl = $('banner'); this.countEl = $('count'); this.btnEl = $('buttons');
    this.curEl = $('cursors'); this.hintEl = $('hint'); this.titleEl = $('gtitle'); this.timerEl = $('timer'); this.statusEl = $('status');
    this.howEl = $('howto'); this.resEl = $('results'); this.wipeEl = $('wipe'); this.topEl = $('top');
    for (let i = 0; i < 8; i++) { const c = el('div', 'cursor'); c.style.setProperty('--pc', PLAYER_CSS[i >> 1]); this.curEl.appendChild(c); this.cursors.push(c); }
  }

  // ----- top bar
  showTop(title) { this.topEl.classList.add('on'); this.titleEl.textContent = title; this.timerEl.textContent = ''; this.statusEl.innerHTML = ''; }
  hideTop() { this.topEl.classList.remove('on'); this.scoresEl.innerHTML = ''; this.chips = {}; }
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

  // ----- big moments
  banner(text, color = '#fff', dur = 1.3, sub = '') {
    this.bannerEl.innerHTML = `<div style="color:${color}">${text}</div>${sub ? `<small>${sub}</small>` : ''}`;
    this.bannerEl.className = ''; void this.bannerEl.offsetWidth; this.bannerEl.className = 'show'; this.bannerEl.style.setProperty('--d', dur + 's');
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
      b.addEventListener('click', () => this.fire(rec));
      this.btnEl.appendChild(b); this.buttons.push(rec);
    }
  }
  clearButtons() { this.btnEl.innerHTML = ''; this.buttons = []; }
  fire(b) { if (b.fired) return; b.fired = true; b.el.classList.add('fired'); this.app.audio.select(); b.onSelect(); }
  updateButtons(players, dt) {
    let n = 0; const show = this.buttons.some(b => !b.quiet);
    const gain = this.app.tracker.reachGain, cx = (x) => Math.max(-7.8, Math.min(7.8, x * gain));
    for (const p of players) for (let h = 0; h < 2; h++) {
      const c = this.cursors[p.slot * 2 + h], pos = p.rig.hands[h];
      c.style.transform = `translate(calc(${cx(pos.x)} * var(--u)), calc(${-pos.y} * var(--u)))`; c.classList.toggle('on', show); c.dataset.live = '1'; n++;
    }
    for (const c of this.cursors) { if (!c.dataset.live) c.classList.remove('on'); delete c.dataset.live; }
    for (const b of this.buttons) {
      if (b.fired) continue;
      let hot = false; const m = 0.15;
      for (const p of players) for (const hnd of p.rig.hands) if (Math.abs(cx(hnd.x) - b.x) < b.w / 2 + m && Math.abs(hnd.y - b.y) < b.h / 2 + m) hot = true;
      if (hot && !b.hot) this.app.audio.hover();
      b.hot = hot; b.p = Math.max(0, Math.min(1, b.p + (hot ? dt / b.dwell : -dt * 1.8)));
      b.el.classList.toggle('hot', hot); b.el.style.setProperty('--p', b.p.toFixed(3));
      if (b.p >= 1) this.fire(b);
    }
  }

  // ----- results
  showResults({ title, rows, stars, best, isBest, note }) {
    const starHtml = [0, 1, 2].map(i => `<span class="star ${i < stars ? 'lit' : ''}" style="animation-delay:${0.5 + i * 0.25}s">★</span>`).join('');
    this.resEl.innerHTML = `<div class="res-card"><h2>${title}</h2><div class="stars">${starHtml}</div>
      <div class="rows">${rows.map((r, i) => `<div class="row ${i === 0 ? 'win' : ''}" style="--pc:${r.css};animation-delay:${0.2 + i * 0.15}s"><b>${r.badge ?? (i + 1)}</b><i></i><span>${r.name}</span><strong data-to="${r.score}">0</strong></div>`).join('')}</div>
      <div class="best ${isBest ? 'new' : ''}">${isBest ? 'New best score!' : (best ? `Best: ${best.toLocaleString()}` : '')}</div>${note ? `<div class="note">${note}</div>` : ''}</div>`;
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
