// Live screenshots of games at chosen moments.
//   node tools/shots.cjs '[["sim=3&game=bowl&fast","bowl",9], ...]'   (URL options, picture name, seconds of play to skip to)
// Needs the preview server: npm run build && npx vite preview --port 4173 --strictPort
// and a Playwright with Chromium on the machine. Pictures go in ./shots/.
require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const jobs = JSON.parse(process.argv[2]);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  for (const [q, name, simT, clip] of jobs) {
    const p = await b.newPage({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: clip ? 2 : 1 });
    p.on('pageerror', e => console.log(name, '[pageerror]', e.message.slice(0, 300)));
    await p.goto('http://localhost:4173/?' + q, { timeout: 90000 });
    await p.waitForTimeout(2500);
    // fast-forward game time without drawing, then let it run live briefly so effects and text look natural
    await p.evaluate((n) => { const a = window.__ww; a.renderer.setAnimationLoop(null); a.noRender = true; let now = performance.now(); for (let i = 0; i < n; i++) { now += 33.3; a.frame(now); } const off = now - performance.now(); a.renderer.setAnimationLoop(() => a.frame(performance.now() + off)); a.noRender = false; document.querySelectorAll('.popup').forEach(e => e.remove()); document.getElementById('count').className = ''; document.getElementById('banner').className = ''; }, Math.round(simT * 30));
    await p.waitForTimeout(6000);
    await p.screenshot({ path: `shots/real-${name}.png`, ...(clip ? { clip: { x: clip[0], y: clip[1], width: clip[2], height: clip[3] } } : {}) });
    console.log(name, await p.evaluate(() => { const a = window.__ww; return JSON.stringify({ phase: a.phase, t: a.t.toFixed(1), scores: a.scores }); }));
    await p.close();
  }
  await b.close();
})();
