# Library of Babel

Library of Babel is a browser-based Three.js experiment. It presents a series of connected hexagonal library rooms.

The project generates each book title and page from its address. It does not store a library database.

## Run the explorer

You need a desktop browser with WebGL support. You also need an internet connection to load Three.js from unpkg.

1. Start a static file server from the project directory.

   ```sh
   cd library-of-babel
   python3 -m http.server 8000
   ```

2. Open <http://localhost:8000>.

The project has no build step and no package installation.

## Controls

| Action | Control |
| --- | --- |
| Look around | Move the mouse |
| Walk | Use `W`, `A`, `S`, `D`, or the arrow keys |
| Move faster | Hold `Shift` |
| Open a book | Aim at the book and click |
| Use a passage | Walk through it or click it |
| Close a dialog | Press `Escape` |

Select a start room with the `Q` and `R` fields. The explorer calculates `S` as `-Q-R`.

The browser stores the last room coordinates in local storage. It uses these coordinates the next time you open the explorer.

## Library model

Each room contains the following items:

- 4 book walls
- 5 shelves on each wall
- 32 volumes on each shelf
- 410 pages in each volume

Each page contains 40 lines of 80 symbols. The browser alphabet contains letters `a` through `z`, a comma, a period, and a space.

A page address contains the room, wall, shelf, volume, and page numbers. The same address always generates the same title and text.

## Search in the browser

Open a book and use the **Find** field to search its current page. The search is not case-sensitive.

Use **Previous match** and **Next match** to move between results. You can also press `Enter` or `Shift+Enter` in the search field.

Use **Search all** on the start screen or room panel to find text in the full library. The explorer calculates one matching address directly.

A full-library search jumps to the room and opens the matching page. Queries of 80 symbols or fewer also appear highlighted.

## Search from the command line

The command-line tools require a Node.js version that supports `BigInt`.

### Direct search

`search.js` uses the same alphabet and page generator as the browser explorer. Direct search calculates one matching address without scanning rooms.

```sh
node search.js "wizard"
node search.js "wxyz, zzz." --direct
```

### Scan search

Use `--scan` when you want to check a finite set of addresses.

```sh
node search.js "abc" --scan --radius 1 --max-results 10
node search.js "abc" --scan --rooms 20 --page 1
```

`search-web.js` is a scan-only wrapper around `search.js`.

```sh
node search-web.js "abc" --wall 1 --shelf 3 --volume 8 --page 20
node search-web.js --self-test
```

Run `node search.js --help` to see all direct and scan options.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Contains the interface, Three.js scene, controls, search, and page generator |
| `search.js` | Provides direct and scan searches for the shared page model |
| `search-web.js` | Provides a scan-only wrapper around `search.js` |
| `README.md` | Describes setup and use |

## Current limits

- The explorer has no touch controls.
- The browser needs network access for the Three.js module.
- The generated text is deterministic pseudorandom text.
- The project has no server, account system, or shared library state.
