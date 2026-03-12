import "./three-globals";

import "../core/dependency-container";
import "../core/module-registry";
import "../core/namespace";

import "../domain/constants/simulation-constants";
import "../domain/math/orbital-math";
import "../domain/catalogs/raw-definitions";
import "../domain/catalogs/planet-catalog";
import "../domain/catalogs/dwarf-planet-catalog";
import "../domain/catalogs/comet-catalog";
import "../domain/catalogs/marker-catalog";
import "../domain/catalogs/belt-catalog";

import "../application/state/app-state";
import "../application/factories/guide-line-factory";
import "../application/factories/visibility-control-group-factory";
import "../application/factories/scene-data-factory";
import "../application/services/runtime-visibility-service";
import "../application/services/visibility-service";
import "../application/services/label-projection-service";
import "../application/services/camera-fit-service";
import "../application/systems/scene-runtime-system";

import "../infrastructure/dom/labels-layer";
import "../infrastructure/dom/hud-view";
import "../infrastructure/dom/hud-controller";
import "../infrastructure/three/renderers/body-renderer";
import "../infrastructure/three/renderers/orbit-renderer";
import "../infrastructure/three/renderers/particle-renderer";
import "../infrastructure/three/renderers/guide-renderer";
import "../infrastructure/three/renderers/postprocessing-renderer";
import "../infrastructure/three/controllers/camera-controller";

import "../compat/constants-compat";
import "../compat/math-compat";
import "../compat/data-compat";
import "../compat/app-compat";

import { namespace } from "../core/namespace";
import { runSmokeChecks } from "../debug/smoke-checks";
import { SolarSystemApplication } from "./solar-system-application";

export { namespace, runSmokeChecks, SolarSystemApplication };
