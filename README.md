# Wobble World

A family motion-game console that runs in a web browser. A camera watches the room, tracks up to four bodies, and turns each player into a chunky toy character on screen. No controllers: your body is the controller.

**Play it:** https://guitarte.github.io/wobble-world/

## Games

| Game | What you do |
| --- | --- |
| Jelly Jam | Pop drifting jellies with hands, feet or head. Combos, gold jellies, giant jellies that split, frenzy mode, and spiky urchins to avoid. |
| Shape Up | Walls rush toward you with a hole cut to each player's size. Duck, make a star, reach up or scoot sideways to slip through. Touch the gems for a perfect. |
| Comet Keeper | Block comets before they hit the shared shield, and step out of the way of the mines. |
| Dance Class | Coach Dot teaches four moves, then you dance the whole routine. Scored on how well you match each pose on the beat. |
| Dance Battle | Take turns freestyling in the spotlight. Scored on energy, rhythm and variety, with a challenge move each turn and a freeze at the end. |

The dance games come in three styles of original music: pop, K-pop and hip hop.

## Setting up at home

- **Computer:** open the link in Chrome, Edge or Safari on a laptop with a webcam, and stand back until your whole body is in view.
- **iPhone or iPad:** open the link in Safari, turn the device sideways, prop it up facing the room, and use Screen Mirroring (AirPlay) to show it on the TV. Add `?cam=back` to the link to use the rear camera.
- Stand about 2 to 3 metres from the camera. Good, even lighting helps tracking a lot.
- Menus are body-controlled: hold a hand on a button until the ring fills. The home button in the top left corner leaves a game.

No camera? Choose "Try with mouse or touch" on the start screen to steer a character with the pointer alongside computer players.

## Development

```
npm install
npm run dev      # local dev server
npm run build    # production build in dist/
```

Handy URL options: `?sim=2` starts with two pretend players (no camera), `?game=jelly|walls|comet|lesson|battle` jumps straight into a game, `?genre=pop|kpop|hiphop` picks the dance music, `?fx=low` turns off the glow pass.

Built with Three.js for rendering, MediaPipe Pose Landmarker for body tracking (the model and runtime are bundled in `public/`), and the Web Audio API for all music and sound, which is synthesized live.

Pushing to `main` builds and publishes the site with GitHub Pages.
