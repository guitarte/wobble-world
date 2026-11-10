// Fast-forward one whole game with pretend players and print the scores and any errors.
//   node tools/play.cjs <game id> [players] [genre, plus extra options like 'pop&ar=1'] [seconds to screenshot at, comma separated]
// Needs the preview server: npm run build && npx vite preview --port 4173 --strictPort
// and a Playwright with Chromium on the machine. Pictures go in ./shots/.
require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const [game, sim = '2', genre = 'pop', shotAt = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  const errs = [];
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text().slice(0, 300)); });
  p.on('pageerror', e => errs.push('PAGEERROR ' + e.message.slice(0, 400) + (e.stack || '').split('\n').slice(0, 4).join(' | ')));
  await p.goto(`http://localhost:4173/?sim=${sim}&game=${game}&genre=${genre}&fast`);
  await p.waitForTimeout(2500);
  const shots = shotAt ? shotAt.split(',').map(Number) : [];
  let simT = 0, out;
  for (let chunk = 0; chunk < 400; chunk++) {
    out = await p.evaluate((n) => {
      const a = window.__ww; a.renderer.setAnimationLoop(null); a.noRender = true; window.__now = window.__now || performance.now();
      const log = window.__log = window.__log || []; let lastPhase = a.phase;
      for (let i = 0; i < n; i++) { window.__now += 33.3; a.frame(window.__now); if (a.phase !== lastPhase) { log.push(a.phase + '@' + a.t.toFixed(1)); lastPhase = a.phase; } }
      return { phase: a.phase, t: a.t, scores: a.scores, log, status: document.getElementById('status').textContent, players: a.players.length };
    }, 30);
    simT += 1;
    if (shots.length && simT >= shots[0]) { shots.shift(); await p.evaluate(() => { const a = window.__ww; a.noRender = false; window.__now += 33; a.frame(window.__now); a.noRender = true; }); await p.waitForTimeout(300); await p.screenshot({ path: `shots/${game}-${genre}-${simT}.png` }); }
    if (out.phase === 'results' || errs.length) break;
  }
  await p.waitForTimeout(200);
  const res = await p.evaluate(() => document.querySelector('.res-card')?.innerText.replace(/\n+/g, ' | '));
  if (process.env.EVAL) console.log('  eval:', JSON.stringify(await p.evaluate(process.env.EVAL)));
  console.log(game, genre, JSON.stringify({ phase: out.phase, t: out.t.toFixed(1), scores: out.scores, log: out.log }), '\n  results:', res, errs.length ? '\n  ERRORS: ' + errs.join('\n  ') : '');
  await b.close();
})();
