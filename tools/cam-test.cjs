// Start the real game with a recording standing in for the camera, and report who joins.
//   node tools/cam-test.cjs <recording.y4m> [seconds] [extra url options]
// Needs the dev server (npx vite --port 5173 --strictPort). A picture goes in ./shots/.
// Make a recording with: ffmpeg -i clip.mp4 -vf scale=1280:720 -pix_fmt yuv420p clip.y4m
const { chromium } = require('playwright');
(async () => {
  const [file, secs = '20', extra = ''] = process.argv.slice(2);
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--use-fake-ui-for-media-stream', '--use-fake-device-for-media-stream', `--use-file-for-fake-video-capture=${require('path').resolve(file)}`] });
  const p = await b.newPage({ viewport: { width: 1280, height: 720 } });
  p.on('console', m => { if (m.type() === 'error' || /following|followers/.test(m.text())) console.log('  console:', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('  PAGEERROR', e.message.slice(0, 400)));
  await p.goto('http://localhost:5173/?' + extra);
  await p.click('#b-cam');
  // Without a graphics card, drawing the game starves the tracking of processor time: NODRAW=1 skips the drawing.
  if (process.env.NODRAW) await p.evaluate(() => { window.__ww.noRender = true; });
  const t0 = Date.now(); let last = '';
  while (Date.now() - t0 < +secs * 1000) {
    await p.waitForTimeout(1000);
    const s = await p.evaluate(() => { const a = window.__ww, tr = a.tracker, f = tr.follow; return JSON.stringify({ phase: a.phase, mode: tr.mode, engine: f ? (f.shared ? 'shared' : 'follow') : 'classic', players: tr.players.map(q => q ? q.slot + 1 : 0).join(''), tracks: f?.tracks.length, cost: f && +f.cost.toFixed(0), msg: document.getElementById('boot-msg')?.textContent.slice(0, 60) }); });
    if (s !== last) console.log(((Date.now() - t0) / 1000).toFixed(0).padStart(3) + 's', last = s);
  }
  require('fs').mkdirSync('shots', { recursive: true }); await p.screenshot({ path: 'shots/cam-test.png' });
  await b.close();
})();
