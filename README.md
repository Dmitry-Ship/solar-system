# solar-system

Interactive Three.js visualization of the Solar System, dwarf planets, comets, belts, and heliosphere structures. The app runs as a Bun-managed React + TypeScript project with a layered simulation architecture composed through direct module exports.

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

- `src/domain`: immutable constants/catalogs, orbital math utilities, and domain models.
- `src/application`: scene-data factories, state, simulation services, and update system.
- `src/infrastructure`: Three.js renderers/controllers and DOM adapters.
- `src/runtime`: Three.js package wiring, the public runtime API surface, composition root (`SolarSystemApplication`), and bootstrapping.
- `src/debug`: smoke-check harness exported as `runSmokeChecks()`.
- `src/App.tsx`: React shell that hosts the canvas and HUD DOM expected by the runtime.

## Compatibility contract

The public compatibility surface is available as direct module exports:

- `constants`
- `math`
- `data.createSceneData()`
- `app.*`

`src/runtime/load-solar-system.ts` re-exports `constants`, `math`, `data`, `app`, `runSmokeChecks`, `sceneDataFactory`, and `SolarSystemApplication`.

## Data locality

Runtime-critical scene data is now assembled into packed numeric stores where it matters:

- orbiting body motion uses a shared `sceneData.orbitingBodyMotionState` store
- asteroid belts keep packed orbital element arrays plus a shared position buffer
- stars are emitted as point-cloud position buffers instead of object-per-point collections

The public exports remain available for external consumers, while renderers and simulation services consume the denser layouts directly.

## Smoke checks

Import the runtime helpers and execute the smoke checks from app code or a local debug harness:

```js
import { runSmokeChecks } from "./src/runtime/load-solar-system";

runSmokeChecks();
```

The function returns a pass/fail summary and per-check details for the public API, scene assembly, math determinism checks, runtime API, and HUD/labels presence.
