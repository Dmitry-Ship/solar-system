# solar-system

Interactive Three.js visualization of the Solar System, dwarf planets, comets, belts, and heliosphere structures.

## Architecture layers

- `src/core`: namespace bootstrap and frame scheduler.
- `src/domain`: immutable constants/catalogs, orbital math utilities, and domain models.
- `src/application`: scene-data factories, state, simulation services, and update system.
- `src/infrastructure`: Three.js renderers/controllers and DOM adapters.
- `src/compat`: legacy `window.SolarSystem.{constants,math,data,app}` facades.
- `src/runtime`: composition root (`SolarSystemApplication`) and bootstrap.
- `src/debug`: smoke-check harness (`window.SolarSystem.debug.runSmokeChecks()`).

## Compatibility contract

The rewrite preserves the public global API:

- `window.SolarSystem.constants`
- `window.SolarSystem.math`
- `window.SolarSystem.data.createSceneData()`
- `window.SolarSystem.app.*`

`index.html` now loads scripts by layer order (core -> domain -> application -> infrastructure -> compat -> runtime -> debug) while still using script tags and no bundler.

## Data locality

Runtime-critical scene data is now assembled into packed numeric stores where it matters:

- orbiting body motion uses a shared `sceneData.orbitingBodyMotionState` store
- asteroid belts keep packed orbital element arrays plus a shared position buffer
- stars are emitted as point-cloud position buffers instead of object-per-point collections

The legacy `window.SolarSystem` entry points remain intact, while renderers and simulation services consume the denser layouts directly.

## Smoke checks

Open the app, then run in browser console:

```js
window.SolarSystem.debug.runSmokeChecks();
```

The function returns a pass/fail summary and per-check details for namespace contract, scene assembly, math determinism checks, runtime API, and HUD/labels presence.
