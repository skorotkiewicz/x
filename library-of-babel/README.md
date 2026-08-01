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

Each page contains 40 lines of 80 symbols. The browser alphabet contains letters `a` through `v`, a comma, a period, and a space.

A page address contains the room, wall, shelf, volume, and page numbers. The same address always generates the same title and text.

## Search an open page

Open a book and use the **Find** field to search its current page. The search is not case-sensitive.

Use **Previous match** and **Next match** to move between results. You can also press `Enter` or `Shift+Enter` in the search field.

## Search from the command line

The project provides two Node.js search tools. Select the tool that matches your use case.

### Search browser pages

`search-web.js` uses the same alphabet, address seed, title generator, and page generator as the browser explorer. Every result identifies the same text in the browser.

Show all options:

```sh
node search-web.js --help
```

Check generator parity:

```sh
node search-web.js --self-test
```

Search selected browser pages:

```sh
node search-web.js "wizard" --q 0 --r 0
node search-web.js "abc" --radius 1 --max-results 10
node search-web.js "abc" --rooms 20 --page 1
node search-web.js "abc" --wall 1 --shelf 3 --volume 8 --page 20
```

The search is not case-sensitive. Use address filters to keep scans small.

`search-web.js` cannot calculate a guaranteed result directly. The browser generator has only a 32-bit seed and is not invertible.

### Search the separate direct model

`search.js` uses a separate invertible page model. It requires a Node.js version that supports `BigInt`.

Direct search calculates one page that contains the search text:

```sh
node search.js "wizard"
node search.js "wxyz, zzz." --direct
```

The separate model also supports finite scans:

```sh
node search.js "abc" --scan --radius 1 --max-results 10
```

Run `node search.js --help` to see all options.

> [!IMPORTANT]
> `search.js` does not use the browser page generator. Use `search-web.js` when you need an address that matches the browser explorer.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Contains the interface, Three.js scene, controls, and browser page generator |
| `search-web.js` | Scans pages that match the browser generator |
| `search.js` | Provides direct and scan searches for a separate page model |
| `README.md` | Describes setup and use |

## Current limits

- The explorer has no touch controls.
- The browser needs network access for the Three.js module.
- The generated text is deterministic pseudorandom text.
- The project has no server, account system, or shared library state.
