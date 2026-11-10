// The page skeleton, injected into #ww so the same bundle works on the hosted
// site and inside an embedded preview.
export const MARKUP = `
<canvas id="c"></canvas>
<div id="zoom"></div>
<div id="ui">
  <div id="top"><div id="tleft"><div id="gtitle"></div><div id="status"></div></div><div id="timer"></div><div id="scores"></div></div>
  <div id="strip"></div>
  <div id="buttons"></div>
  <div id="menu-title"><span class="logo small">Wobble World</span><em>Hold a hand on a game to play!</em></div>
  <div id="tags"></div>
  <div id="cursors"></div>
  <div id="popups"></div>
  <div id="banner"></div>
  <div id="count"></div>
  <div id="hint"></div>
  <div id="howto"></div>
  <div id="results"></div>
</div>
<div id="pip"><button id="b-rot" type="button" aria-label="Rotate camera picture">Rotate ⟳</button></div>
<div id="wipe"></div>
<div id="boot">
  <div class="boot-inner">
    <div class="logo" aria-label="Wobble World">${'Wobble'.split('').map((c, i) => `<span style="--i:${i}">${c}</span>`).join('')}<br>${'World'.split('').map((c, i) => `<span style="--i:${i + 6}">${c}</span>`).join('')}</div>
    <p class="tag">Your body is the controller.</p>
    <div class="boot-btns">
      <button id="b-cam" class="big primary">Play with camera</button>
      <button id="b-sim" class="big">Try with mouse or touch</button>
    </div>
    <p id="boot-msg"></p>
    <ul class="tips">
      <li>Stand the screen or phone where it can see your whole body, about 2 to 3 metres away.</li>
      <li>On an iPhone, turn it sideways and mirror the screen to your TV with AirPlay.</li>
      <li>Up to 4 players. Just step into view to join.</li>
    </ul>
  </div>
</div>
<div id="rotate"><div>Turn your phone sideways</div></div>
`;
