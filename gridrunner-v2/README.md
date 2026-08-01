# GRIDRUNNER: PULSE

http://sekor.eu.org/x/gridrunner-v2/

GRIDRUNNER: PULSE is a single-file rhythm-combat game for the browser. It uses Canvas 2D and the Web Audio API.

Steer through an audio-reactive track while the ship fires automatically. Cut enemies with the trail, collect shards, and defeat the Warden.

## Run the game

You need a modern browser with Canvas 2D and Web Audio support.

1. Start a static file server from the repository root.

   ```sh
   python3 -m http.server 8000
   ```

2. Open <http://localhost:8000/gridrunner-v2/>.

The game has no build step and no package installation.

## Controls

| Action | Control |
| --- | --- |
| Steer left | `A` or `Arrow Left` |
| Steer right | `D` or `Arrow Right` |
| Dash | `Shift` after you get the Phase Dash upgrade |
| Pause or resume | `P` or `Escape` |
| Select an upgrade | `1`, `2`, `3`, or click a card |
| Reroll upgrades | `R` or the reroll button |
| Start or retry | `Enter` or the screen button |

On a touch device, press the left or right half of the play area to steer. A dash button appears on coarse-pointer devices.

## Gameplay

1. Select a track, weapon, trail color, and available boons.
2. Steer through each track section while the weapon fires automatically.
3. Destroy enemies near the beat to get more sync and increase the combo.
4. Select one upgrade after each completed section.
5. Defeat the Warden in the final section.

The track edges, enemy shots, and the ship trail can damage the ship. Ramps provide brief air time and invulnerability.

Sync affects the rarity of offered upgrades. A reroll costs 25 sync.

The final rank uses the average sync value from completed sections. The available ranks are `S`, `A`, `B`, `C`, and `D`.

## Built-in tracks

| Track | Style | BPM | Difficulty |
| --- | --- | ---: | ---: |
| Neon Artery | Synth | 128 | 1 |
| Volt Cathedral | Doom | 100 | 2 |
| Redline Phantom | Drum and bass | 172 | 3 |

Each built-in track creates its music with the Web Audio API. Track sections control the music pattern, speed, width, enemies, and visual intensity.

## Custom audio

Select **Drop Audio File** to create a track from a local audio file. The browser performs all analysis locally.

The analyzer detects tempo, energy, bass activity, and onsets. It divides the audio into six sectors and adds a Warden encounter.

The browser must support the selected audio format. A custom track remains available only for the current page session.

## Upgrades

Section rewards offer three random upgrades. Higher sync increases the chance of rare and epic choices.

Upgrade effects include the following categories:

- Weapon damage, fire rate, projectiles, homing, piercing, and ricochet
- Trail length, trail damage, explosions, slowing, and collision immunity
- Hull, repair, shard collection, wall grinding, and dash effects

Some upgrades can appear more than once during a run.

## Progress and unlocks

Enemies drop shards during a run. A victory also grants 500 shards.

The game saves the following progress in `localStorage`:

- Shards
- Run and victory counts
- Best score for each track
- Weapons and trail colors
- Purchased boons
- Overdrive access

Victories unlock more equipment. Specific achievements provide additional unlocks:

- The first victory unlocks the Vice trail and Scatterhorn weapon.
- Three victories unlock the Solar trail.
- An `S` rank unlocks the Acid trail and Overdrive.
- A Redline Phantom victory unlocks the Rail Spine weapon.

Overdrive increases combat difficulty and score rewards.

## Permanent boons

| Boon | Effect | Cost |
| --- | --- | ---: |
| Reinforced Hull | Add one maximum hull point | 800 shards |
| Charged Start | Start each run with 25 sync | 600 shards |
| Scav Field | Increase the shard collection radius | 500 shards |

A purchased boon stays active for later runs in the same browser profile.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Contains the interface, game loop, rendering, audio, tracks, and saved progression |
| `README.md` | Describes setup and gameplay |

## Current limits

- Progress belongs to the current browser origin and profile.
- Clearing site data removes saved progress.
- Custom audio tracks do not persist after a reload.
- Google Fonts require network access. The game uses local font fallbacks when the request fails.
