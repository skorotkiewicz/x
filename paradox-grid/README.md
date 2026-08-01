# Paradox Grid

http://sekor.eu.org/x/paradox-grid/

Paradox Grid is a single-file arena game for the browser. It uses Canvas 2D and the Web Audio API.

Cast bolts to build temporary walls across a collapsing grid. Clear each sector, use limited rewinds, and defeat the Warden Prime.

## Run the game

You need a desktop browser with Canvas 2D and Web Audio support.

1. Start a static file server from the repository root.

   ```sh
   python3 -m http.server 8000
   ```

2. Open <http://localhost:8000/paradox-grid/>.

The game has no build step and no package installation.

## Controls

| Action | Control |
| --- | --- |
| Move | `W`, `A`, `S`, `D`, or the arrow keys |
| Aim | Move the mouse |
| Cast | Hold the left mouse button |
| Dash | `Shift` or `Space` |
| Rewind | `R` or the right mouse button |
| Pause or resume | `Escape` or `P` |
| Mute or unmute | `M` |
| Select a school | `1` through `4`, arrow keys, or click |
| Select a boon | `1` through `3` or click |

The browser starts the audio system after keyboard or mouse input.

## Objective

Each run contains eight sectors. The grid starts to decay from its edges after a short grace period.

Destroy every enemy to open the gate on the right side. Enter the gate to complete the sector and select a boon.

Sector 4 contains the Hexwarden. Sector 8 contains the Warden Prime. Defeat the Warden Prime and enter the gate to win.

The HUD shows health, energy, dash charges, grid integrity, shards, kills, time, and available rewinds.

## Casting and walls

Each bolt creates temporary trail walls as it crosses grid tiles. Walls can block movement, enemy attacks, and later bolts.

Trail durability and lifetime depend on the selected school and installed vault upgrades. The collapsing plane also removes grid tiles over time.

Enemies can drop shards, health, or energy. The game banks collected shards after death, an aborted run, or victory.

## Schools

| School | Main traits |
| --- | --- |
| Chronomancer | Starts with two rewinds and records a five-second temporal depth |
| Pyromancer | Deals more damage and burns enemies that touch fresh trails |
| Warden | Has more health, stronger walls, and repairs remaining trail walls after rewind |
| Voidwalker | Fires piercing bolts and slows enemies near trail walls |

Each school also changes health, damage, cast rate, wall strength, wall lifetime, and rewind depth.

## Rewind

The game records an arena snapshot every 0.25 seconds. A rewind uses one charge and restores an older snapshot.

A snapshot contains the following arena state:

- Grid terrain and decay progress
- Trail walls and permanent walls
- Living enemies
- Uncollected pickups

Rewind clears active player bullets, enemy bullets, and lasers. Enemies killed after the selected snapshot return.

Rewind does not restore the player position, health, energy, kills, or collected shard total. The Mending Rewind vault upgrade restores 20 health.

Each sector restores the available rewind charges. A new sector must record enough timeline data before rewind becomes ready.

## Run boons

After each completed sector, select one of three random boons. Boons last until the current run ends.

Boons can change the following systems:

- Spell damage and cast rate
- Trail lifetime
- Health, energy, and energy recovery
- Knockback, piercing, life leech, and split casts
- Dash and rewind charges
- Rewind depth

Boons have common, rare, and epic rarities.

## The Vault

Spend banked shards on permanent upgrades in the Vault.

| Upgrade | Effect | Cost |
| --- | --- | ---: |
| Fleeting Loop | Shorten trails by 45 percent and increase cast rate by 25 percent | 70 shards |
| Mending Rewind | Restore 20 health after rewind | 90 shards |
| Bulwark Weave | Increase trail-wall integrity by 120 percent | 110 shards |
| Deep Memory | Add two seconds to rewind depth | 130 shards |
| Volatile Thread | Make expired trails damage nearby enemies | 160 shards |
| Echo Rewind | Add one rewind charge to each sector | 220 shards |

Vault upgrades stay active for later runs in the same browser profile.

## Saved progress

The game stores progress in `localStorage` under the key `paradox_grid_v1`.

Saved data includes:

- Banked shards
- Incursion and victory counts
- Deepest reached sector
- Purchased vault upgrades
- Sound preference

Use **Wipe Save Data** in the Vault to remove this progress.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Contains the interface, game loop, rendering, audio, data, and saved progression |
| `README.md` | Describes setup and gameplay |

## Current limits

- The game requires a keyboard and mouse. It has no touch controls.
- An active run does not persist after a reload.
- Saved progress belongs to the current browser origin and profile.
- Clearing site data removes saved progress.
- Google Fonts require network access. The game uses local font fallbacks when the request fails.
