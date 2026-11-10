# Wobble World

A family motion-game console that runs in a web browser. A camera watches the room, tracks up to four bodies, and turns each player into a comic-book hero on screen. No controllers: your body is the controller.

The whole thing is drawn like a living comic: cel-shaded heroes with ink outlines and manga faces, halftone dots, misprinted colour edges, starburst impacts and big lettering. The four heroes are Ember, Zeph, Volt and Nova, and Coach Dot runs the dance floor.

**Play it:** https://guitarte.github.io/wobble-world/

## Games

| Game | What you do |
| --- | --- |
| Jelly Jam | Pop drifting jellies with hands, feet or head. Combos, gold jellies, giant jellies that split, frenzy mode, spiky urchins to avoid, and King Jelly to punch out at the end. |
| Shape Up | Walls rush toward you with a hole cut to each player's size. Duck, make a star, reach up or scoot sideways to slip through. Touch the gems for a perfect. The last three walls come fast and score double. |
| Comet Keeper | Block comets before they hit the shared shield, and step out of the way of the mines. It ends with a meteor shower bonus round. |
| Dance Class | Pick a style and a lesson. Coach Dot teaches four real moves one at a time, with a tip for each, then you dance the whole routine. Scored on how well you match each count on the beat. A four-panel strip at the side shows the move. |
| Dance Battle | Take turns freestyling in the spotlight. Scored on energy, rhythm and variety. Each turn has a challenge move drawn at the side, a list of real style moves to collect, and a freeze at the end. |

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
- Menus are body-controlled: point a hand at a button along the top of the screen and hold it there until the edge fills. Your hand works like a pointer, so you can reach every button from one spot. The home button in the top left corner leaves a game.
- If the picture from the camera is sideways, it turns itself upright once it sees someone standing on the menu. The Rotate button on the camera preview does it by hand.

No camera? Choose "Try with mouse or touch" on the start screen to steer a character with the pointer alongside computer players.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Handy URL options: `?sim=2` starts with two pretend players (no camera), `?game=jelly|walls|comet|lesson|battle` jumps straight into a game, `?genre=pop|kpop|hiphop` picks the dance music, `?lesson=2` picks the dance lesson, `?fx=low` turns off the glow and comic print passes, `?rot=90` forces the camera rotation.

Built with Three.js for rendering, MediaPipe Pose Landmarker for body tracking (the model and runtime are bundled in `public/`), and the Web Audio API for all music and sound, which is synthesized live.

Pushing to `main` builds and publishes the site with GitHub Pages.
