// Listen to the game without ears: start it with sound on, and report how loud it is, how much
// of the sound differs between left and right (the "side" level), and the highest peak, on the
// menu, in a game, at the finish and on the scoreboard. Also prints any audio errors.
//   node tools/listen.cjs [game title, as on its menu card]
// Needs the preview server: npm run build && npx vite preview --port 4173 --strictPort
const { chromium } = require('playwright');
(async () => {
  const title = (process.argv[2] || 'Jelly Jam').toLowerCase();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required'] });
  const p = await b.newPage({ viewport: { width: 640, height: 360 } });
  const errs = []; p.on('console', m => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.text().slice(0, 200)); }); p.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 300)));
  await p.goto('http://localhost:4173/?fx=low&pr=0.5', { timeout: 90000 });
  await p.waitForTimeout(1500);
  await p.click('#b-sim');
  await p.evaluate(() => {
    const au = window.__ww.audio, c = au.ctx, sp = c.createChannelSplitter(2); au.limit.connect(sp);
    const an = [0, 1].map(i => { const n = c.createAnalyser(); n.fftSize = 4096; sp.connect(n, i); return n; }), L = new Float32Array(4096), R = new Float32Array(4096);
    window.__meter = () => { an[0].getFloatTimeDomainData(L); an[1].getFloatTimeDomainData(R); let m = 0, s = 0, pk = 0; for (let i = 0; i < 4096; i++) { const mid = (L[i] + R[i]) / 2, side = (L[i] - R[i]) / 2; m += mid * mid; s += side * side; pk = Math.max(pk, Math.abs(L[i]), Math.abs(R[i])); } return { mid: Math.sqrt(m / 4096), side: Math.sqrt(s / 4096), pk, track: au.trackName, amb: au.ambName }; };
  });
  const sample = async (label, n = 14) => { let mid = 0, side = 0, pk = 0, last; for (let i = 0; i < n; i++) { await p.waitForTimeout(230); last = await p.evaluate(() => window.__meter()); mid += last.mid / n; side += last.side / n; pk = Math.max(pk, last.pk); } console.log(label.padEnd(11), `loudness ${mid.toFixed(3)}  side ${side.toFixed(3)} (${(side / (mid + 1e-6) * 100).toFixed(0)}% of the middle)  peak ${pk.toFixed(2)}  tune: ${last.track}, world sound: ${last.amb}`); };
  const until = async (cond) => { for (let i = 0; i < 300; i++) { if (await p.evaluate(cond)) return; await p.waitForTimeout(200); } };
  await sample('menu');
  await p.evaluate((t) => window.__ww.hud.buttons.find(b => b.html.toLowerCase().includes('<h3>' + t))?.onSelect(0), title);
  await until(() => window.__ww.phase === 'play' && window.__ww.game.elapsed > 4 || window.__ww.t > 60); await sample('in game', 20);
  await p.evaluate(() => { window.__ww.game.done = true; });
  await until(() => window.__ww.phase === 'finish'); await sample('finish', 4);
  await until(() => window.__ww.phase === 'results' && window.__ww.phaseT > 4); await sample('scoreboard');
  console.log(errs.length ? 'PROBLEMS:\n  ' + [...new Set(errs)].join('\n  ') : 'no errors or warnings');
  await b.close();
})();
