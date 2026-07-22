# Signal in the Dark

A one-page Three.js experiment comparing two simplified strategies:

- **Sweep searchlight:** the rescuer moves through an expanding search pattern and must illuminate the missing person.
- **Raise beacon:** the rescuer stays put while a mobile missing person tries to recognize and approach an omnidirectional light.

## Run

```bash
cd signal-in-the-dark
python3 -m http.server 8080
```

Open `http://localhost:8080`.

The page imports Three.js from a pinned CDN URL, so the first load needs internet access.

## Experiment

Use the presets first:

- **Mobile hiker** usually favors the beacon.
- **Injured** makes the stationary beacon ineffective because the missing person cannot approach it.
- **Dense forest** increases line-of-sight occlusion and can produce mixed results.

Run the Monte Carlo comparison after each change. Both strategies receive the same random worlds and starting positions.

## Important limitation

This is a conceptual toy model, not validated search-and-rescue guidance. It intentionally isolates a few variables and omits weather, terrain elevation, batteries, sound, radios, group behavior, panic, injuries, and official rescue protocols.
