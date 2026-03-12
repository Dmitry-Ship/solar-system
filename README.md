# solar-system

Interactive Three.js visualization of the Solar System, dwarf planets, comets, belts, and heliosphere structures. The app now runs as a Bun-managed React + TypeScript project, while preserving the layered simulation architecture through module-local compatibility exports.

## Getting started

```bash
bun install
bun run dev
```

Build for production:

```bash
bun run build
```

## Architecture layers

- `src/core`: shared namespace bootstrap and frame scheduler.
- `src/domain`: immutable constants/catalogs, orbital math utilities, and domain models.
- `src/application`: scene-data factories, state, simulation services, and update system.
- `src/infrastructure`: Three.js renderers/controllers and DOM adapters.
- `src/compat`: compatibility facades that populate the shared `namespace.{constants,math,data,app}` API.
- `src/runtime`: Three.js package wiring, composition root (`SolarSystemApplication`), and bootstrapping.
- `src/debug`: smoke-check harness exported as `runSmokeChecks()`.
- `src/App.tsx`: React shell that hosts the canvas and HUD DOM expected by the runtime.

## Compatibility contract

The rewrite preserves the compatibility surface as module exports on the shared namespace object:

- `namespace.constants`
- `namespace.math`
- `namespace.data.createSceneData()`
- `namespace.app.*`

`src/runtime/load-solar-system.ts` loads the architecture by layer order (core -> domain -> application -> infrastructure -> compat -> runtime -> debug) and re-exports `namespace`, `runSmokeChecks`, and `SolarSystemApplication`.

## Data locality

Runtime-critical scene data is now assembled into packed numeric stores where it matters:

- orbiting body motion uses a shared `sceneData.orbitingBodyMotionState` store
- asteroid belts keep packed orbital element arrays plus a shared position buffer
- stars are emitted as point-cloud position buffers instead of object-per-point collections

The compatibility namespace remains intact in memory, while renderers and simulation services consume the denser layouts directly.

## Smoke checks

Import the runtime helpers and execute the smoke checks from app code or a local debug harness:

```js
import { runSmokeChecks } from "./src/runtime/load-solar-system";

runSmokeChecks();
```

The function returns a pass/fail summary and per-check details for namespace contract, scene assembly, math determinism checks, runtime API, and HUD/labels presence.
