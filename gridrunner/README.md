# GRIDRUNNER: Pulse

GRIDRUNNER: Pulse is a music-driven browser shooter with roguelike upgrades. Ride a solid-light trail across a generated neon track. Shoot enemy ships, force them into trails, and survive the final boss.

The game uses one `index.html` file. It has no build step and no external dependencies.

## Start the game

1. Open a terminal in the project directory.
2. Start a local web server:

   ```sh
   python3 -m http.server 8000
   ```

3. Open [http://localhost:8000](http://localhost:8000) in a browser.
4. Select a track, weapon, and trail.
5. Select **Enter the Grid**.

You can also open `index.html` directly. A local server gives more consistent browser audio behavior.

## Controls

| Action | Keyboard |
| --- | --- |
| Steer left | `A` or `Left Arrow` |
| Steer right | `D` or `Right Arrow` |
| Fire | `Space` |
| Phase dash | `Shift` |
| Pause or resume | `P` |
| Select an upgrade | `1`, `2`, `3`, or select a card |

Touch controls appear on narrow screens.

## Game loop

1. Select a built-in track or load a local audio file.
2. Steer across the track and avoid solid trails, hazards, and hostile shots.
3. Fire at enemy ships or force them into a light trail.
4. Time turns, dashes, and kills with the beat to charge the sync meter.
5. Select one of three random upgrades at each checkpoint.
6. Destroy the Chorus Guardian before the track ends.

A full sync meter starts Pulse Overdrive. Overdrive increases the fire rate and score gain for six seconds.

The run ends when you leave the track, lose all integrity, or fail to destroy the boss. A new run uses a new seed and removes all run upgrades.

## Tracks and audio

The built-in tracks use seeded energy profiles and synthesized audio. Each track has its own BPM, duration, difficulty, and hazard pattern.

You can load an audio file from the track menu. The browser measures its energy and estimates a BPM from 80 through 180. The game uses this data to shape the track and place hazards.

Audio processing occurs in your browser. The game does not upload the selected file. The file must be 60 MB or smaller. Supported audio formats depend on your browser.

The BPM estimate is approximate. Music with strong half-time or double-time rhythms can produce a different BPM than expected.

## Progression

Each run awards data from the final score. Data and completed tracks unlock weapons, trail colors, and the Redline remix.

The browser stores the best score, data, clears, and total kills in local storage. The game has no account or remote save.

To reset all progression, run this command in the browser developer console and reload the page:

```js
localStorage.removeItem('gridrunner-pulse-meta')
```

## Browser requirements

Use a current browser with JavaScript, Canvas 2D, Web Audio, and local storage support. The game supports a keyboard and provides touch controls on small screens.

## Project files

- `index.html` contains the complete game.
- `PLAN.md` contains the original game concept.
