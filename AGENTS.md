# Solar System Frontend Architecture

## File layout

- `index.html`: document shell and script loading order by architecture layer.
- `styles.css`: visual styles for HUD and labels.
- `src/core/*.js`: namespace bootstrap, contracts, DI container, frame lifecycle.
- `src/domain/constants/*.js`: immutable simulation constants.
- `src/domain/math/*.js`: deterministic orbital math utilities.
- `src/domain/models/*.js`: domain model wrappers for immutable definitions.
- `src/domain/catalogs/*.js`: static catalogs and scene configuration definitions.
- `src/application/state/*.js`: app state models.
- `src/application/factories/*.js`: scene-data and guide-line assembly factories.
- `src/application/services/*.js`: simulation services (orbit, belts, labels, camera fit).
- `src/application/systems/*.js`: runtime update orchestration.
- `src/infrastructure/dom/*.js`: DOM adapters (HUD and labels layer).
- `src/infrastructure/three/renderers/*.js`: Three.js render/runtime modules.
- `src/infrastructure/three/controllers/*.js`: camera and control adapters.
- `src/compat/*.js`: legacy `window.SolarSystem.{constants,math,data,app}` facades.
- `src/runtime/*.js`: composition root and animation frame loop.
- `src/debug/*.js`: smoke-check/debug utilities.

## Design principles

- Keep deterministic math in `src/domain/math/` and avoid DOM/canvas access there.
- Keep static catalog/config source data in `src/domain/catalogs/`.
- Keep random generation and scene-data assembly in `src/application/factories/`.
- Keep runtime orchestration in `src/runtime/` and `src/application/systems/`.
- Keep rendering behavior in `src/infrastructure/three/renderers/`.
- Keep browser-global compatibility in `src/compat/` only.

## Common changes

- Add or update planets, dwarf bodies, and comets in `src/domain/catalogs/raw-definitions.js`.
- Tune camera/zoom constants in `src/domain/constants/simulation-constants.js`.
- Adjust rendering in relevant infrastructure modules:
  - labels: `src/infrastructure/dom/labels-layer.js`
  - bodies/orbits: `src/infrastructure/three/renderers/body-renderer.js`, `src/infrastructure/three/renderers/orbit-renderer.js`
  - guide lines: `src/infrastructure/three/renderers/guide-renderer.js`
  - shells: `src/infrastructure/three/renderers/shell-renderer.js`
  - particle systems: `src/infrastructure/three/renderers/particle-renderer.js`
