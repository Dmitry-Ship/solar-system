# Solar System

Interactive Three.js visualization of the Solar System and nearby deep-space reference geometry, built with Bun, React, TypeScript, and Vite. The scene includes planets, dwarf planets, comets, asteroid belts, star fields, directional markers, transfer trajectories, and guide-line overlays, with a React HUD driving a layered simulation/runtime stack.

## What the app does

- Renders orbiting bodies from catalog-driven scene data.
- Projects labels and HUD state from the Three.js runtime into the DOM.
- Exposes a direct runtime API for loading scene data, math helpers, and app controls.
- Includes smoke checks for public exports, scene assembly, deterministic math, and runtime presence.

## Development

Install dependencies and start the local dev server:

```bash
bun install
bun run dev
```

Additional scripts:

```bash
bun run build
bun run preview
```

## HUD controls

The React shell in `src/App.tsx` mounts the Three.js canvas and renders a control panel once the runtime is ready. The HUD currently exposes:

- zoom toggle
- body-name toggle
- orbit-visibility toggle
- point-of-view presets for `Sun`, `Earth`, and `61 Cygni`
- grouped visibility toggles generated from scene runtime metadata

## Architecture

The codebase is split into explicit layers:

- `src/domain`: immutable constants, catalogs, and orbital math primitives
- `src/application`: scene-data factories, app state, and simulation/runtime services
- `src/infrastructure`: Three.js renderers/controllers plus DOM adapters for labels and HUD state
- `src/runtime`: composition root, Three.js bootstrap, public API, and application startup
- `src/debug`: smoke-check harness for basic runtime and API verification

The React layer stays thin. `src/App.tsx` creates `SolarSystemApplication`, subscribes to HUD snapshots, and forwards user actions back into the runtime.

## Runtime API

The main compatibility surface lives in `src/runtime/public-api.ts` and is re-exported by `src/runtime/load-solar-system.ts`.

Available exports:

- `constants`: simulation constants
- `math`: orbital and geometry helpers
- `data.createSceneData()`: catalog-to-scene-data assembly
- `sceneDataFactory`: direct factory instance
- `app`: runtime helpers and app-level controls
- `SolarSystemApplication`: composition-root class
- `runSmokeChecks()`: debug verification entry point

## Scene composition

Scene data is assembled from domain catalogs and packed into runtime-friendly structures where it matters:

- orbiting body motion shares dense numeric state
- asteroid belts use packed orbital arrays and shared position buffers
- stars render from point-cloud buffers instead of object-per-star instances

The factory currently builds data for major planets, dwarf planets, comets, nearby directional markers such as `61 Cygni` and `Gliese 300`, transfer trajectories, and Voyager probe markers.

## Smoke checks

You can run the built-in smoke checks from app code or a local debug harness:

```ts
import { runSmokeChecks } from "./src/runtime/load-solar-system";

const result = runSmokeChecks();
console.log(result);
```

The checks cover:

- public API presence
- scene-data generation
- deterministic Earth positioning across scene rebuilds
- directional-marker scaling
- orbital math parity
- runtime/HUD availability
