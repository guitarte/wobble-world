// Finding several players at once, and keeping hold of each of them.
//
// The pose model works in two halves: it first has to notice a person in a small square
// copy of the whole picture, and from then on it follows them closely. Noticing is the
// weak half. When a few people stand back from a wide webcam, each of them is only a few
// dozen dots tall in that small copy, and of a group standing together the model tends to
// report only the clearest person. So the halves are split up here.
//   - Every player has a follower of their own, which only ever looks at a close-up cut
//     around that one player, taken from the camera picture at full sharpness. Who is who
//     can no longer be mixed up, because a follower never looks at anybody else.
//   - A scout looks for newcomers. It goes over the picture piece by piece, zoomed in,
//     with the players it already knows painted out, so it only finds new people.
import { MAX_PLAYERS, area, crowds } from './tracking.js';

const CUT = 384;        // a close-up is this many dots square
const SPAN = 5.6;       // and this many torso lengths across: room for raised arms and a jump
const SCOUT = 512;      // the longest side of the piece the scout looks at
const JOIN_MS = 300, JOIN_HITS = 5; // a newcomer has to be followed this long before joining
const MEMORY_MS = 8000; // how long a player's spot and hero are kept for them after they go
const GREY = '#7d7d7d';

// Does this sighting look like a person standing in the room? Clutter on a shelf can pass
// for a tiny body, and so can a pattern lying on its side.
function sane(d, biggest) {
  const P = d.pts, shy = (P[11].y + P[12].y) / 2, shx = (P[11].x + P[12].x) / 2;
  if (d.T < 0.36 || d.T < 0.3 * biggest) return false;        // too small to be a player
  if (P[0].v > 0.5 && P[0].y < shy + 0.12 * d.T) return false; // the head belongs above the shoulders
  if (P[23].v > 0.5 && P[24].v > 0.5) {
    const hx = (P[23].x + P[24].x) / 2 - shx, hy = (P[23].y + P[24].y) / 2 - shy;
    if (hy > 0 || Math.abs(hx) > Math.abs(hy)) return false;   // and the hips below them
  }
  return true;
}
const strayed = (t, d) => Math.hypot(d.cx - t.ax, d.cy - t.ay) / t.T;
// Are these two sightings one and the same body? Head, chest and hips all coincide. (Left
// and right are not compared: seen from the side, the model often swaps them.)
function same(a, b) {
  const A = a.pts, B = b.pts, mid = (P, i, j) => [(P[i].x + P[j].x) / 2, (P[i].y + P[j].y) / 2];
  const far = (p, q) => Math.hypot(p[0] - q[0], p[1] - q[1]);
  const s = far([A[0].x, A[0].y], [B[0].x, B[0].y]) + far(mid(A, 11, 12), mid(B, 11, 12)) + far(mid(A, 23, 24), mid(B, 23, 24));
  return s / 3 < 0.4 * Math.min(a.T, b.T);
}

// One pose model with the little canvas it looks at.
class Eye {
  constructor(lm) { this.lm = lm; this.canvas = document.createElement('canvas'); this.canvas.width = this.canvas.height = CUT; this.g = this.canvas.getContext('2d', { alpha: false }); this.ts = 0; }
  stamp(now) { return this.ts = Math.max(this.ts + 1, now); }
  // Show it nothing, so it lets go of whoever it was following and looks afresh next time.
  forget(now) { this.g.setTransform(1, 0, 0, 1, 0, 0); this.g.fillStyle = '#000'; this.g.fillRect(0, 0, CUT, CUT); try { this.lm.detectForVideo(this.canvas, this.stamp(now)); } catch (e) { /* fine */ } }
}

export class Follow {
  // make(options) builds a pose model
  constructor(tracker, make) {
    this.tr = tracker; this.make = make; this.tracks = []; this.pool = []; this.scout = null; this.memory = [];
    this.tiles = []; this.tile = 0; this.n = 0; this.lastScan = -9; this.keen = 0; this.UW = 0; this.UH = 0;
    this.cost = 6; this.budget = 26; // milliseconds: what one look costs, and what a frame may spend
  }
  // Everything is made up front, so nobody walking in mid-game causes a hitch. Each model
  // takes a fair amount of memory (about 90 MB); if they cannot all be made, none are kept.
  async start() {
    const made = [];
    try {
      made.push(this.scout = new Eye(await this.make({ runningMode: 'IMAGE', numPoses: MAX_PLAYERS, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.5 })));
      for (let i = 0; i < MAX_PLAYERS; i++) { const e = await this.follower(); made.push(e); this.pool.push(e); }
    } catch (e) { for (const m of made) { try { m.lm.close(); } catch (err) { /* fine */ } } throw e; }
  }
  async follower() { return new Eye(await this.make({ runningMode: 'VIDEO', numPoses: 1, minPoseDetectionConfidence: 0.4, minPosePresenceConfidence: 0.5, minTrackingConfidence: 0.5 })); }
  reset(now = 0) {
    for (const t of this.tracks) { t.eye.forget(now); this.pool.push(t.eye); }
    this.tracks = []; this.memory = []; this.tile = 0; this.keen = 0;
  }

  // The pieces of the picture the scout goes over in turn: all of it, then squares as tall
  // as the picture, then a row of smaller squares for people standing far back.
  layout() {
    const W = this.UW, H = this.UH, wide = W >= H, long = Math.max(W, H), short = Math.min(W, H);
    const tiles = [{ x: 0, y: 0, w: W, h: H }];
    const row = (s, off) => {
      const n = long - s < 0.1 * s ? 1 : Math.ceil((long - s) / (s * 0.5)) + 1;
      for (let i = 0; i < n; i++) { const at = n > 1 ? (long - s) * i / (n - 1) : (long - s) / 2; tiles.push(wide ? { x: at, y: off, w: s, h: s } : { x: off, y: at, w: s, h: s }); }
    };
    if (long > 1.15 * short) row(short, 0);
    row(0.64 * short, 0.18 * short);
    this.tiles = tiles; this.tile = 0;
  }

  // Stage units (as measure() gives them) to dots in the upright picture.
  px(x) { const tr = this.tr; return (0.5 - (tr.mirror ? 1 : -1) * x / tr.stageW) * this.UW; }
  py(y) { return (0.5 - y / this.tr.stageH) * this.UH; }
  get unit() { return this.UH / this.tr.stageH; }
  cutFor(d, T) { const s = Math.max(64, SPAN * T * this.unit); return { x: this.px(d.shx) - s / 2, y: this.py(d.shy - d.T / 2) - s / 2, s }; }

  // Paint grey over everyone already followed (other than `but`). The model that notices
  // people likes to report only the clearest person of a group standing together; with
  // that person painted out, it reports the next one. The whole body is covered, limbs
  // and all: a pair of legs left standing under a grey patch gets taken for a small person.
  paintOut(g, x, y, k, but, now) {
    g.setTransform(k, 0, 0, k, -x * k, -y * k); g.fillStyle = g.strokeStyle = GREY; g.lineJoin = g.lineCap = 'round';
    for (const t of this.tracks) {
      if (t === but || !t.d || now - t.seen > 400) continue;
      const P = (n) => [this.px(t.d.pts[n].x), this.py(t.d.pts[n].y)], T = t.d.T * this.unit;
      const line = (w, ...ns) => { g.lineWidth = w * T; g.beginPath(); ns.forEach((n, i) => { const [a, b] = P(n); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.stroke(); };
      const [nx, ny] = P(0); g.beginPath(); g.arc(nx, ny, 0.62 * T, 0, 7); g.fill();
      g.lineWidth = 0.5 * T; g.beginPath(); [11, 12, 24, 23].forEach((n, i) => { const [a, b] = P(n); if (i) g.lineTo(a, b); else g.moveTo(a, b); }); g.closePath(); g.fill(); g.stroke();
      line(0.42, 11, 13, 15, 19); line(0.42, 12, 14, 16, 20); line(0.5, 23, 25, 27, 31); line(0.5, 24, 26, 28, 32);
    }
    g.setTransform(1, 0, 0, 1, 0, 0);
  }

  // Could this sighting be the body this follower is after? A body can only have moved so
  // far since it was last seen, and it cannot suddenly be twice the size.
  plausible(t, d, now) {
    // A newcomer's follower sometimes comes up with the person next to them instead, when
    // people stand in a row. Nobody is following that person either, so they are just as welcome.
    if (!t.hits) return sane(d, this.biggest()) && !this.taken(d, t, now);
    const far = Math.hypot(d.cx - t.cx, d.cy - t.cy);
    if (far > this.reach(t, now)) return false;
    if (!t.miss) return d.T < 1.9 * t.T && d.T > t.T / 2.4;
    // when two players are lost at once, each can only be found again nearer to where they
    // were than to where the other one was
    if (this.tracks.some((o) => o !== t && o.player && o.miss && Math.hypot(d.cx - o.cx, d.cy - o.cy) < far)) return false;
    // Finding somebody (again) is held to a stricter standard than keeping hold of them:
    // about the right size, and not a shape sitting on top of another player.
    return d.T < 1.6 * t.T && d.T > 0.6 * t.T && !this.taken(d, t, now);
  }
  // How far a player can have got since they were last seen.
  reach(t, now) { return Math.max(1, 1.2 * t.T) * (1 + 1.5 * Math.min(1, (now - t.seen) / 1000)); }
  biggest() { let big = 0; for (const t of this.tracks) if (t.player) big = Math.max(big, t.T); return big; }
  // Is this sighting really somebody else who is already followed, or a shape found on
  // top of them (head and shoulders both inside their outline)?
  taken(d, but, now) {
    const on = (b, n) => d.pts[n].x > b.x0 && d.pts[n].x < b.x1 && d.pts[n].y > b.y0 && d.pts[n].y < b.y1;
    return this.tracks.some((t) => t !== but && t.d && now - t.seen < 400 && (same(d, t.d) || (on(t.box, 0) && on(t.box, 11) && on(t.box, 12))));
  }

  // How much of this sighting's head and chest lies on top of players who are already
  // followed, from 0 to 1. Two people standing close can leave the model seeing a third
  // "person" made of bits of both, so a newcomer has to stand clear of the others to join.
  covered(d, but, now) {
    const P = d.pts, mid = (i, j) => ({ x: (P[i].x + P[j].x) / 2, y: (P[i].y + P[j].y) / 2 }), sh = mid(11, 12), hip = mid(23, 24);
    const spots = [P[0], P[11], P[12], P[23], P[24], sh, hip, { x: (sh.x + hip.x) / 2, y: (sh.y + hip.y) / 2 }];
    const others = this.tracks.filter((t) => t !== but && t.player && t.d && now - t.seen < 400);
    let n = 0;
    for (const q of spots) if (others.some((t) => { const b = t.box, m = 0.2 * t.T; return q.x > b.x0 + m && q.x < b.x1 - m && q.y > b.y0 && q.y < b.y1; })) n++;
    return n / spots.length;
  }

  // A follower that slid across onto somebody else's player goes back to look where its
  // own player was a moment ago.
  sendBack(t) {
    const c = t.cut; c.x = this.px(t.ax) - c.s / 2; c.y = this.py(t.ay - 0.5 * t.T) - c.s / 2;
    t.cx = t.ax; t.cy = t.ay; t.d = null;
  }

  // One follower takes one look at its player.
  look(t, now, sets) {
    const tr = this.tr, e = t.eye, c = t.cut;
    tr.paint(e.g, CUT, CUT, c.x, c.y, c.s, c.s);
    // Searching: look past the others. Someone lost in a hug is half painted out along with
    // their partner, though, so every other try goes without the paint.
    if (!t.hits || t.miss % 2 === 1) this.paintOut(e.g, c.x, c.y, CUT / c.s, t, now);
    let res = null; try { res = e.lm.detectForVideo(e.canvas, e.stamp(now)); } catch (err) { /* skip */ }
    const raw = res?.landmarks?.[0]; t.now = null; t.looked = now;
    if (!raw || raw.length < 33) return;
    const lm = raw.map((l) => ({ x: (c.x + l.x * c.s) / this.UW, y: (c.y + l.y * c.s) / this.UH, visibility: l.visibility }));
    const d = tr.measure(lm); if (!d) return;
    if (!this.plausible(t, d, now)) { t.wrong = true; return; }
    t.now = d; sets.push(lm);
  }

  // Called for every new camera frame. sets collects what was seen, for the upright check.
  step(now, sets) {
    const tr = this.tr, UW = tr.canvas.width, UH = tr.canvas.height; // the upright picture
    if (UW !== this.UW || UH !== this.UH) { this.UW = UW; this.UH = UH; this.layout(); }
    this.n++;
    // players the tracker has let go of: keep their spot for them for a while
    this.tracks = this.tracks.filter((t) => {
      if (!t.player || tr.players[t.player.slot] === t.player) return true;
      this.memory.push({ slot: t.player.slot, cx: t.cx, cy: t.cy, T: t.T, until: now + MEMORY_MS });
      t.eye.forget(now); this.pool.push(t.eye); return false;
    });
    this.memory = this.memory.filter((m) => m.until > now && !tr.players[m.slot]);

    // Followers first. On a slow machine they take turns, so the game itself never stalls.
    const t0 = performance.now(), max = Math.max(1, Math.floor(this.budget / this.cost));
    const due = [...this.tracks].sort((a, b) => a.looked - b.looked).slice(0, max);
    for (const t of due) this.look(t, now, sets);
    // Two followers on one body: the one that has only just found it lets go, or else the
    // one that has strayed furthest from where it was a moment ago.
    for (const a of due) {
      if (!a.now) continue;
      for (const b of this.tracks) {
        if (a === b) continue;
        const live = due.includes(b), bd = live ? b.now : (now - b.seen < 150 ? b.d : null);
        if (!bd || !same(a.now, bd)) continue;
        const ja = strayed(a, a.now), jb = strayed(b, bd);
        const lose = (!!a.miss !== !!b.miss) ? (a.miss ? a : b) : (!a.player !== !b.player) ? (a.player ? b : a)
          : Math.abs(ja - jb) > 0.15 ? (ja > jb ? a : b) : (a.born > b.born ? a : b);
        this.sendBack(lose);
        if (lose === a) { a.now = null; a.wrong = true; break; }
        if (live) { b.now = null; b.wrong = true; } else { b.miss++; b.eye.forget(now); }
      }
    }
    for (const t of due) {
      const d = t.now, dt = Math.max(1e-3, Math.min(0.25, (now - (t.fed || now - 33)) / 1000)); t.fed = now;
      if (!d) {
        t.miss++; if (t.wrong) { t.eye.forget(now); t.wrong = false; }
        // lost from view right where another player is standing: most likely hidden behind them
        if (t.player) t.player.hidden = this.tracks.some((o) => { const b = o.box, m = 0.5 * o.T; return o !== t && o.d && now - o.seen < 400 && t.cx > b.x0 - m && t.cx < b.x1 + m && t.cy > b.y0 - m && t.cy < b.y1 + m; });
        continue;
      }
      if (!t.player && this.covered(d, t, now) > 0.5) { t.miss++; continue; } // not standing clear yet
      if (!t.hits) { t.T = d.T; t.ax = d.cx; t.ay = d.cy; t.cut = this.cutFor(d, d.T); }
      t.hits++; t.miss = 0; t.seen = now; t.d = d; t.cx = d.cx; t.cy = d.cy; t.box = d.box;
      const ka = Math.min(1, dt * 1.5); t.ax += (d.cx - t.ax) * ka; t.ay += (d.cy - t.ay) * ka; // where they were a moment ago
      t.T += (d.T - t.T) * Math.min(1, dt * (d.T > t.T ? 5 : 0.6));
      // the close-up glides after the player; a jerk would shake the follower off
      const c = t.cut, g = this.cutFor(d, t.T), k = Math.min(1, dt * 14);
      c.x += (g.x + (g.s - c.s) / 2 - c.x) * k; c.y += (g.y + (g.s - c.s) / 2 - c.y) * k;
      const ks = Math.min(1, dt * 4), ds = (g.s - c.s) * ks; c.x -= ds / 2; c.y -= ds / 2; c.s += ds;
      if (t.player) { t.player.hidden = false; tr.feed(t.player, d, now, dt); }
      else if (t.hits >= JOIN_HITS && now - t.born >= JOIN_MS) this.join(t, d, now, dt);
    }
    // a newcomer that could not be held on to was a false alarm
    this.tracks = this.tracks.filter((t) => {
      if (t.player || (t.miss < 4 && now - t.born < 2500)) return true;
      t.eye.forget(now); this.pool.push(t.eye); return false;
    });

    // Then the scout, while there is room for another player or somebody has gone missing.
    // It looks at every frame while people are arriving, and now and then once things settle.
    let looks = due.length;
    const since = this.n - this.lastScan, lost = this.tracks.some((t) => t.player && t.miss > 2);
    const room = this.tracks.length < MAX_PLAYERS && this.pool.length > 0;
    const every = !this.tracks.length || this.n < this.keen || lost ? 1 : 3;
    if ((room || lost) && since >= every && (looks < max || since >= 6)) { this.scan(now, sets); looks++; }
    if (looks) this.cost += ((performance.now() - t0) / looks - this.cost) * 0.1;
  }

  scan(now, sets) {
    const tr = this.tr, e = this.scout, tl = this.tiles[this.tile++ % this.tiles.length]; this.lastScan = this.n;
    const k = Math.min(1, SCOUT / Math.max(tl.w, tl.h)), cw = Math.round(tl.w * k), ch = Math.round(tl.h * k), cv = e.canvas;
    if (cv.width !== cw || cv.height !== ch) { cv.width = cw; cv.height = ch; }
    tr.paint(e.g, cw, ch, tl.x, tl.y, tl.w, tl.h);
    this.paintOut(e.g, tl.x, tl.y, k, null, now);
    let res = null; try { res = e.lm.detect(cv); } catch (err) { return; }
    const fresh = [], big = this.biggest(); let found = false;
    for (const raw of res?.landmarks ?? []) {
      if (!raw || raw.length < 33) continue;
      // someone cut in half by the edge of this piece is seen whole in the next one
      const inside = (n) => raw[n].x > 0.02 && raw[n].x < 0.98 && raw[n].y > 0.02 && raw[n].y < 0.98;
      const whole = tl.w === this.UW && tl.h === this.UH;
      if (!whole && !(inside(11) && inside(12) && inside(0))) continue;
      const lm = raw.map((l) => ({ x: (tl.x + l.x * tl.w) / this.UW, y: (tl.y + l.y * tl.h) / this.UH, visibility: l.visibility }));
      const d = tr.measure(lm); if (!d) continue;
      sets.push(lm); if (sane(d, big)) fresh.push(d);
    }
    for (const d of fresh) {
      // not somebody who is being followed already, and not one giant made out of two people
      if (this.taken(d, null, now) || this.covered(d, null, now) > 0.5 || this.tracks.some((t) => t.d && now - t.seen < 400 && crowds(d.box, t.box))) continue;
      // a player who slipped away from their follower: point it at them again
      let back = null, best = 1e9;
      for (const t of this.tracks) {
        if (!t.hits || !t.miss) continue;
        const dist = Math.hypot(d.cx - t.cx, d.cy - t.cy);
        if (dist < best && dist < this.reach(t, now) && d.T < 1.6 * t.T && d.T > 0.6 * t.T) { best = dist; back = t; }
      }
      found = true;
      if (back) { back.cut = this.cutFor(d, back.T); back.cx = back.ax = d.cx; back.cy = back.ay = d.cy; back.d = d; back.box = d.box; back.seen = now; back.miss = 1; continue; }
      if (this.tracks.length >= MAX_PLAYERS || !this.pool.length) continue;
      this.tracks.push({ eye: this.pool.pop(), cut: this.cutFor(d, d.T), born: now, seen: now, looked: 0, hits: 0, miss: 0, cx: d.cx, cy: d.cy, ax: d.cx, ay: d.cy, T: d.T, box: d.box, d, player: null });
    }
    // where there is one newcomer there are often more: look at the same piece again next
    if (found) { this.keen = this.n + 45; this.tile--; }
  }

  // A newcomer becomes a player. Someone coming back to where they stood a moment ago gets
  // their own hero (and their score) back; a new face gets a hero nobody is waiting for.
  join(t, d, now, dt) {
    const tr = this.tr, free = [];
    for (let s = 0; s < MAX_PLAYERS; s++) if (!tr.players[s]) free.push(s);
    if (!free.length) return;
    let slot = -1, best = 3.5;
    for (const m of this.memory) { const dist = Math.hypot(d.cx - m.cx, d.cy - m.cy) / Math.max(1, m.T); if (free.includes(m.slot) && dist < best) { best = dist; slot = m.slot; } }
    if (slot < 0) slot = free.find((s) => !this.memory.some((m) => m.slot === s)) ?? free[0];
    this.memory = this.memory.filter((m) => m.slot !== slot);
    t.player = tr.admit(slot, d, now, dt);
  }
}
