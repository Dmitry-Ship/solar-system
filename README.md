# solar-system

Interactive Three.js visualization of the Solar System, dwarf planets, comets, belts, and heliosphere structures.

## Project structure

- `index.html`: document shell + script loading order.
- `styles.css`: HUD and label styling.
- `src/constants.js`: immutable simulation/render constants.
- `src/math.js`: pure math/orbital utilities.
- `src/data/definitions.js`: static catalogs and scene configuration constants.
- `src/data.js`: procedural scene-data factories (`createSceneData`).
- `src/app.js`: runtime bootstrap + frame loop orchestration.
- `src/app/*.js`: focused runtime modules:
  - `helpers.js`: cache preparation + generic helpers.
  - `labels.js`: labels DOM layer + body/label scaling updater.
  - `bodies.js`: body runtime creation + orbit/fixed-body builders.
  - `particles.js`: stars/oort/belt builders + belt updater.
  - `shells.js`: heliosphere shell construction + animation update.
  - `guides.js`: directional guide lines/light rays.
  - `hud.js`: UI control wiring.
  - `camera.js`: initial camera placement.

## Development notes

- Most data edits (new planets/comets/markers/config values) happen in `src/data/definitions.js`.
- Simulation math and coordinate transforms belong in `src/math.js`.
- Rendering behavior changes belong in `src/app/*.js` modules, not in `src/data.js`.
- `src/app.js` should stay thin: bootstrap, wire modules, run loop.
