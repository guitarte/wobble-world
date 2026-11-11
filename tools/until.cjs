// Fast-forward a game until something is true, then let it run live for a moment and take a picture.
//   node tools/until.cjs 'sim=2&game=jelly' 'a.fire.some(Boolean)' on-fire [live ms] [x,y,w,h to crop, at double size]
// The condition is JavaScript with the app as `a`. Leave `fast` out of the options to keep the finish moment at full length.
// Needs the preview server: npm run build && npx vite preview --port 4173 --strictPort
require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const [q, cond, name, live = '1500', clip] = process.argv.slice(2), c = clip && clip.split(',').map(Number);
  const [vw, vh] = (process.env.VIEW || '1280x720').split('x').map(Number), view = { width: vw, height: vh }; // VIEW=844x390 for a phone on its side
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: view, deviceScaleFactor: c ? 2 : 1 });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await p.goto('http://localhost:4173/?' + q, { timeout: 90000 });
  await p.waitForTimeout(2500);
  let ok = false;
  for (let chunk = 0; chunk < 600 && !ok; chunk++) {
    ok = await p.evaluate((cond) => {
      const a = window.__ww; a.renderer.setAnimationLoop(null); a.noRender = true; window.__now = window.__now || performance.now();
      const test = new Function('a', 'return (' + cond + ')');
      for (let i = 0; i < 15; i++) { window.__now += 33.3; a.frame(window.__now); if (test(a)) return true; }
      return false;
    }, cond);
  }
  // Play on for the "live" part in step with the clock, so lettering and other page animations keep time
  // with the game (drawing every frame is far too slow here), then draw the last frame only.
  await p.evaluate(() => document.querySelectorAll('.popup').forEach(e => e.remove())); // score pop-ups pile up during a fast-forward, because the clock that clears them stood still
  for (let i = 0, n = Math.round(+live / 33.3); i < n; i++) { await p.evaluate(() => { window.__now += 33.3; window.__ww.frame(window.__now); }); await p.waitForTimeout(26); }
  await p.evaluate(() => { const a = window.__ww; a.noRender = false; window.__now += 33.3; a.frame(window.__now); });
  await p.waitForTimeout(150);
  await p.screenshot({ path: `shots/${name}.png`, ...(c ? { clip: { x: c[0], y: c[1], width: c[2], height: c[3] } } : {}) });
  console.log(name, ok ? 'reached' : 'NOT reached', await p.evaluate(() => { const a = window.__ww; return JSON.stringify({ phase: a.phase, t: a.t.toFixed(1), scores: a.scores, fire: a.fire }); }));
  await b.close();
})();
