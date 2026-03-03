# Solar System Frontend Architecture

## File layout

- `index.html`: document shell and script loading order.
- `styles.css`: all visual styles.
- `src/constants.js`: shared immutable configuration values.
- `src/math.js`: pure math and orbital utility functions.
- `src/data/definitions.js`: static catalogs and scene configuration definitions.
- `src/data.js`: scene-data factory logic (`createSceneData`).
- `src/app.js`: runtime wiring and main animation loop.
- `src/app/*.js`: render/runtime submodules (bodies, particles, guides, shells, labels, HUD, camera, helpers).

## Design principles

- Keep deterministic math in `src/math.js` and avoid DOM/canvas access there.
- Keep catalog/config source data in `src/data/definitions.js`.
- Keep random generation and scene-data assembly in `src/data.js`.
- Keep `src/app.js` as orchestration only; put feature logic into `src/app/*.js`.
- Keep `index.html` thin so UI structure changes do not risk simulation logic.

## Common changes

- Add or update planets, dwarf bodies, and comets in `src/data/definitions.js`.
- Tune camera/zoom constants in `src/constants.js`.
- Adjust rendering in relevant `src/app/*.js` modules:
  - labels: `src/app/labels.js`
  - bodies/orbits: `src/app/bodies.js`
  - guide lines: `src/app/guides.js`
  - shells: `src/app/shells.js`
  - particle systems: `src/app/particles.js`
