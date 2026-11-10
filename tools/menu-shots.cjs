// A screenshot of every menu page, including the mirror page.
//   node tools/menu-shots.cjs
// Needs the preview server: npm run build && npx vite preview --port 4173 --strictPort
// and a Playwright with Chromium on the machine. Pictures go in ./shots/.
require('fs').mkdirSync('shots', { recursive: true });
const { chromium } = require('playwright');
(async () => {
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('pageerror', e => console.log('[pageerror]', e.message.slice(0, 300)));
  await p.goto('http://localhost:4173/?sim=2&ar=1', { timeout: 90000 });
  await p.waitForTimeout(3000);
  const n = await p.evaluate(() => document.querySelectorAll('#buttons .btn').length);
  for (let i = 0; i < 4; i++) {
    await p.evaluate((k) => { const a = window.__ww; a.page = k; a.showMenu(); }, i);
    await p.waitForTimeout(2500);
    await p.screenshot({ path: `shots/menu-${i + 1}.png` });
    console.log(i + 1, await p.evaluate(() => document.getElementById('menu-note').textContent + ' | ' + [...document.querySelectorAll('#buttons .btn h3')].map(e => e.textContent).join(', ')));
  }
  await b.close();
})();
