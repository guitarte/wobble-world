// Packs the production build into one self-contained HTML fragment for an
// embedded preview (no camera there, so the tracking runtime is left out).
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
const css = readFileSync('dist/index.css', 'utf8');
const js = readFileSync('dist/app.js', 'utf8').replace(/<\/script/gi, '<\\/script');
const out = process.argv[2] || 'dist-preview/wobble-world.html';
mkdirSync(out.replace(/\/[^/]*$/, ''), { recursive: true });
writeFileSync(out, `<title>Wobble World</title>
<meta name="claude:viewport-fit-sides" content="cover">
<style>${css}</style>
<div id="ww"></div>
<script type="module">${js}</script>
`);
console.log(out, (css.length + js.length) / 1e6, 'MB');
