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
| Dance Class | Coach Dot teaches four moves, then you dance the whole routine. Scored on how well you match each pose on the beat. A four-panel strip at the side shows the move. |
| Dance Battle | Take turns freestyling in the spotlight. Scored on energy, rhythm and variety, with a challenge move each turn and a freeze at the end. |

The dance games come in three styles of original music: pop, K-pop and hip hop.

## Setting up at home

- **Computer:** open the link in Chrome, Edge or Safari on a laptop with a webcam, and stand back until your whole body is in view.
- **iPhone or iPad:** open the link in Safari, turn the device sideways, prop it up facing the room, and use Screen Mirroring (AirPlay) to show it on the TV. Add `?cam=back` to the link to use the rear camera.
- Stand about 2 to 3 metres from the camera. Good, even lighting helps tracking a lot.
- Menus are body-controlled: raise a hand onto a button along the top of the screen and hold it there until the edge fills. Small players get extra reach, so nobody has to jump. The home button in the top left corner leaves a game.
- If the picture from the camera is sideways, it turns itself upright once it sees someone standing on the menu. The Rotate button on the camera preview does it by hand.

No camera? Choose "Try with mouse or touch" on the start screen to steer a character with the pointer alongside computer players.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Handy URL options: `?sim=2` starts with two pretend players (no camera), `?game=jelly|walls|comet|lesson|battle` jumps straight into a game, `?genre=pop|kpop|hiphop` picks the dance music, `?fx=low` turns off the glow and comic print passes, `?rot=90` forces the camera rotation.

Built with Three.js for rendering, MediaPipe Pose Landmarker for body tracking (the model and runtime are bundled in `public/`), and the Web Audio API for all music and sound, which is synthesized live.

Pushing to `main` builds and publishes the site with GitHub Pages.
