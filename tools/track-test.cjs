// Run the real tracker over folders of recorded frames and report how well it finds and
// keeps hold of several players at once.
//   node tools/track-test.cjs <folder of clips> [clip names, comma separated] [picture frame]
// Each clip is a folder of numbered JPEGs (ffmpeg -i clip.mp4 -vf fps=30 clip/%04d.jpg). A
// file <clip>/people.txt holding a number says how many people are really in the picture.
// Needs the dev server: npx vite --port 5173 --strictPort. Pictures go in ./shots/.
const fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
(async () => {
  const [dir, only = '', drawAt = ''] = process.argv.slice(2);
  const clips = fs.readdirSync(dir).filter(n => fs.statSync(path.join(dir, n)).isDirectory() && (!only || only.split(',').includes(n))).sort();
  const b = await chromium.launch({ args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
  const p = await b.newPage({ viewport: { width: 1000, height: 600 } });
  p.on('console', m => { if (m.type() === 'error' && !/favicon/.test(m.text())) console.log('  console:', m.text().slice(0, 300)); });
  p.on('pageerror', e => console.log('  PAGEERROR', e.message.slice(0, 400)));
  await p.route('**/clips/**', (r) => r.fulfill({ path: path.join(dir, decodeURIComponent(new URL(r.request().url()).pathname.replace(/^\/clips\//, ''))) }));
  await p.goto('http://localhost:5173/tools/track-lab.html' + (process.env.LAB || ''));
  await p.waitForFunction('window.labReady', null, { timeout: 120000 });
  const opts = process.env.OPTS ? JSON.parse(process.env.OPTS) : {}, fopts = process.env.FOPTS ? JSON.parse(process.env.FOPTS) : {};
  fs.mkdirSync('shots', { recursive: true });
  let all = 0, got = 0;
  for (const clip of clips) {
    const files = fs.readdirSync(path.join(dir, clip)).filter(n => /\.jpe?g$/.test(n)).sort();
    const want = fs.existsSync(path.join(dir, clip, 'people.txt')) ? +fs.readFileSync(path.join(dir, clip, 'people.txt'), 'utf8') : 0;
    const draw = drawAt ? +drawAt : files.length - 1;
    const r = await p.evaluate(([fr, draw, opts, fopts]) => window.lab.run(fr, { draw, opts, fopts }), [files.map(f => `/clips/${clip}/${f}`), draw, opts, fopts]);
    await (await p.$('#view')).screenshot({ path: `shots/track-${clip}.png` });
    const counts = r.log.map(row => row.filter(Boolean).length);
    const hist = {}; for (const c of counts) hist[c] = (hist[c] || 0) + 1;
    // time until everyone is in, and how much of the clip everyone stays in after that
    const full = want ? counts.findIndex(c => c >= want) : -1;
    const held = full >= 0 ? counts.slice(full).filter(c => c === want).length / (counts.length - full) : 0;
    const share = want ? counts.reduce((s, c) => s + Math.min(c, want), 0) / (want * counts.length) : 0;
    const extra = want ? counts.filter(c => c > want).length : 0;
    if (process.env.TIMELINE) for (let sl = 0; sl < 4; sl++) console.log(`   P${sl + 1} ` + r.log.map((row, f) => f % 2 ? '' : row[sl] ? Math.min(9, Math.max(0, Math.round(row[sl][0] * 10 + 5))) : '.').join(''));
    all += want * counts.length; got += counts.reduce((s, c) => s + Math.min(c, want), 0);
    console.log(`${clip.padEnd(12)} people ${want}  seen ${(share * 100).toFixed(0).padStart(3)}%  all in after ${full < 0 ? ' never' : (full / 30).toFixed(1).padStart(5) + 's'}  then held ${(held * 100).toFixed(0).padStart(3)}%  too many ${extra}  joins ${r.events.filter(e => 'join' in e).length} leaves ${r.events.filter(e => 'leave' in e).length}  ${r.ms.toFixed(0)}ms/frame  players/frames ${JSON.stringify(hist)}`);
  }
  console.log(`overall: ${(100 * got / Math.max(1, all)).toFixed(1)}% of people on screen were in play`);
  await b.close();
})();
