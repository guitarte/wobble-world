# Wobble World

A family motion-game console that runs in a web browser. A camera watches the room, tracks up to four bodies, and turns each player into a comic-book hero on screen. No controllers: your body is the controller.

The whole thing is drawn like a living comic: cel-shaded heroes with ink outlines and manga faces, halftone dots, misprinted colour edges, starburst impacts and big lettering. Players start as Ember, Zeph, Volt and Nova, can swap to other heroes or build their own, and Coach Dot runs the dance floor.

**Play it:** https://guitarte.github.io/wobble-world/

## Games

Fifteen games, spread over three pages of the menu. Point at "More games" to turn the page.

| Game | What you do |
| --- | --- |
| Jelly Jam | Pop drifting jellies with hands, feet or head. Combos, gold jellies, giant jellies that split, frenzy mode, spiky urchins to avoid, and King Jelly to punch out at the end. |
| Shape Up | Walls rush toward you with a hole cut to each player's size. Duck, make a star, reach up or scoot sideways to slip through. Touch the gems for a perfect. The last three walls come fast and score double. |
| Comet Keeper | Block comets before they hit the shared shield, and step out of the way of the mines. It ends with a meteor shower bonus round. |
| Paper Chop | Paper critters leap up over a sunset garden. Slice them with fast hands. Slicing a few in a row builds a combo, gold stars are worth the most, and thunder clouds are best left alone. |
| Pow Blocks | Bat a bouncing ball upward with hands, head or feet to smash walls of bricks. Steel bricks take two hits, gold ones give a second ball, and the team shares five hearts. |
| Balloon Bop | Keep the balloons off the ground together. Every bop builds the rally, gold balloons pop for a bonus after three bops, and gusts of wind push everything sideways. |
| Wing It | Hold your arms out like wings to fly a paper glider: tip them to slide sideways, raise them to climb. Fly through the rings and dodge the storm clouds. |
| Laser Leap | Robots slide in with laser beams. Jump the low blue ones and duck under the high pink ones. Clearing beams in a row builds a multiplier, and there are gold stars to grab in between. |
| Turbo Trot | A 150 metre race run on the spot. Lift your knees and pump your arms to speed up, and jump the hurdles. |
| Wobble Bowl | Everyone bowls at once on toy lanes. Let a hand hang down to pick up the ball, swing it up to bowl, and swing a little sideways to steer. Strikes in a row score extra. |
| Dance Class | Pick a style and a lesson. Coach Dot teaches four real moves one at a time, with a tip for each, then you dance the whole routine. Scored on how well you match each count on the beat. A four-panel strip at the side shows the move. |
| Dance Battle | Take turns freestyling in the spotlight. Scored on energy, rhythm and variety. Each turn has a challenge move drawn at the side, a list of real style moves to collect, and a freeze at the end. |
| Freeze Frame | Musical statues. Dance while the music plays, then freeze when it stops. Snapper the camera bot sweeps its searchlight looking for wobbles, then takes the picture. Bold poses score a bonus. |
| Dot Says | Coach Dot calls out things to do. If the call says DOT SAYS, do it fast. If it does not, it is a trick, and anyone who moves is caught out. |
| Topple Tower | Step under falling blocks to stack them on your head, then move gently, because a tall tower sways. Six blocks make a tower that flies off to the bank. Do not catch the cactus. |

Every game ends with a double-points finale, and every game has its own original music.

### Polish that runs through every game

- **A living camera.** The stage never moves, so bodies and buttons always line up, but the camera swings gently around it as players move, which slides the world behind them and gives the picture depth. It punches in on big hits, nods on the beat in the dance games, swoops in as a game opens and eases toward the winners at the end.
- **Heroes that react.** Their eyes follow whatever matters in the game (the nearest jelly, the ball, Coach Dot), they breathe, and they squash and kick up dust when they land a jump.
- **On fire.** Keep scoring without a slip and a hero catches fire: a jagged power flare behind them, embers off their hands and a burning score chip. A penalty puts it out. It is only for show and does not change the score.
- **Big hits.** The misprinted colour edges sit almost square and slip apart only when something hits hard, and the biggest moments get a one-frame ink-and-paper impact frame.
- **The finish.** When a round ends everything stops dead for a breath with a whistle and a banner, then the scoreboard counts up, the stars slam in one at a time, and every player gets an award for something they did more of than anyone else (fastest hands, jumping bean, always on the move and so on). The leader wears a crown on their score chip during the round.
- **Sound in stereo.** Effects come from the side of the room they happen on, the busiest ones never sound quite the same twice, the music is spread left and right and pumps with the kick drum, each world has its own quiet backdrop (birds, bubbles, wind), and the last ten seconds of a round tick.
- **Pause.** With a camera, a round waits if everyone steps out of view and carries on when someone steps back in.
- **Smoothness.** The picture's sharpness is adjusted while you play to hold a steady frame rate, in both directions, and the setting that suited the device is remembered for next time.

### Mirror mode

With a camera, a fourth menu page appears: Mirror mode. The games on it (Balloon Bop, Paper Chop, Jelly Jam, Pow Blocks, Topple Tower and Freeze Frame) show the live camera picture of your real room and your real selves, with the game drawn on top, instead of the heroes and the cartoon world. Each player gets a ring in their colour around each hand, and everything in the game is sized to how big the players look on camera.

### Heroes

Point at "Heroes" on the menu to change who you are. Each player picks from eight ready-made heroes, or builds their own in the creator: hair, hair colour, skin, outfit and trim colours, outfit cut, badge, extras (scarf or cape) and a name. Heroes you build are saved on the device.

The dance games come in three styles of original music: pop, K-pop and hip hop.

### The dance moves

The moves are real ones from hip hop, pop and K-pop classes, with their real names. They were chosen because one camera facing the dancer can read them: clear arm shapes, knee lifts, leans and bounces. Moves that depend on turning away, rolling the body towards the camera, or fine footwork (body rolls, pivot turns, the Roger Rabbit, the moonwalk) are left out, because a front camera cannot judge them fairly.

| Style | Lesson | Moves |
| --- | --- | --- |
| Hip hop | 1. Grooves | The Bounce, Two-Step, Raise the Roof, The Dab |
| Hip hop | 2. Old-school classics | Running Man, Cabbage Patch, Top Rock, Milly Rock |
| Hip hop | 3. Party moves | The Floss, The Whip, The Nae Nae, The Woah |
| Pop | 1. First steps | Step Touch, High V Low V, Star Jump, The Point |
| Pop | 2. Travelling steps | Grapevine, Jazz Square, Kick Ball Change, Lunge and Reach |
| K-pop | 1. Sharp shapes | Big Heart, The Robot, Fist Pump, Hip Sway |
| K-pop | 2. Waves and points | Arm Wave, Tutting, Lock and Point, Criss Cross |

Arms always count towards the score. A knee lift, a lean or a knee bounce counts when the move calls for one, and legs are left out of the score when the camera cannot see them. Finished lessons are remembered on the device. All moves live in the `MOVES` table at the top of `src/games/dance.js`, four counts each, so adding one is a single line.

## Setting up at home

- **Computer:** open the link in Chrome, Edge or Safari on a laptop with a webcam, and stand back until your whole body is in view.
- **iPhone or iPad:** open the link in Safari, turn the device sideways, prop it up facing the room, and use Screen Mirroring (AirPlay) to show it on the TV. Add `?cam=back` to the link to use the rear camera.
- Stand about 2 to 3 metres from the camera. Good, even lighting helps tracking a lot.
- Wherever you stand, you are fitted to hero size and stood on the stage floor, so a small child at the back of the room has the same reach as a grown-up at the front, and a camera that is tilted or cuts off your feet still works. If someone is too close for the camera to see all of them, a tip on the menu asks them to step back.
- Menus are body-controlled: point a hand at a button along the top of the screen and hold it there until the edge fills. Your hand works like a pointer, so you can reach every button from one spot. Choose with one hand: two arms in the air are read as a cheer, not a choice. The home button in the top left corner leaves a game.
- If the picture from the camera is sideways, it turns itself upright once it sees someone standing on the menu. The Rotate button on the camera preview does it by hand.

No camera? Choose "Try with mouse or touch" on the start screen to steer a character with the pointer alongside computer players.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Handy URL options: `?sim=2` starts with two pretend players (no camera), `?game=<id>` jumps straight into a game (`jelly`, `walls`, `comet`, `chop`, `pow`, `balloon`, `wing`, `laser`, `trot`, `bowl`, `lesson`, `battle`, `freeze`, `dot`, `topple`), `?ar=1` plays it in mirror mode, `?page=2` opens the menu on a given page, `?genre=pop|kpop|hiphop` picks the dance music, `?lesson=2` picks the dance lesson, `?fx=low` turns off the glow and comic print passes, `?rot=90` forces the camera rotation, `?fps` shows the frame rate and the current sharpness at the bottom of the screen, `?pr=1` fixes the sharpness.

Built with Three.js for rendering, MediaPipe Pose Landmarker for body tracking (the model and runtime are bundled in `public/`), and the Web Audio API for all music and sound, which is synthesized live.

Testing without a camera: with the preview server running (`npm run build && npx vite preview --port 4173 --strictPort`), `node tools/play.cjs <game>` fast-forwards a whole game with pretend players and prints scores and errors, `node tools/until.cjs` fast-forwards to a chosen moment and takes a picture, and `node tools/listen.cjs` starts the sound and reports loudness, stereo spread and peaks.

Pushing to `main` builds and publishes the site with GitHub Pages.
