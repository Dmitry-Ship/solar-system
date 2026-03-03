# Solar System Frontend Architecture

## File layout

- `index.html`: document shell and HUD markup only.
- `styles.css`: all visual styles.
- `src/constants.js`: shared immutable configuration values.
- `src/math.js`: pure math and orbital utility functions.
- `src/data.js`: static catalogs and procedural scene-data factories.
- `src/app.js`: runtime wiring (state, input handlers, projection, rendering loop).

## Design principles

- Keep deterministic math helpers in `src/math.js` and avoid DOM/canvas access there.
- Keep source data and random seed generation in `src/data.js`; avoid rendering code in that layer.
- Restrict `src/app.js` to scene orchestration and frame-by-frame updates.
- Keep `index.html` thin so UI structure changes do not risk simulation logic.

## Common changes

- Add or update planets, dwarf bodies, and comets in `src/data.js` definition lists.
- Tune camera/zoom constants in `src/constants.js`.
- Adjust drawing styles in `src/app.js` draw functions or `styles.css` for HUD/UI.
- Reuse `drawOrbitalGroupAndCollectBodies` in `src/app.js` to avoid copy-paste loops.
