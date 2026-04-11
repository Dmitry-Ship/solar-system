import type { Group, PerspectiveCamera, SphereGeometry, Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { SIMULATION_CONSTANTS } from "../domain/constants/simulation-constants";
import { OrbitalMath } from "../domain/math/orbital-math";
import { planetCatalog } from "../domain/catalogs/planet-catalog";
import { dwarfPlanetCatalog } from "../domain/catalogs/dwarf-planet-catalog";
import { cometCatalog } from "../domain/catalogs/comet-catalog";
import { markerCatalog } from "../domain/catalogs/marker-catalog";
import { beltCatalog } from "../domain/catalogs/belt-catalog";
import { sceneBodyCatalog } from "../domain/catalogs/scene-body-catalog";
import { SceneDataFactory } from "../application/factories/scene-data-factory";
import { VisibilityService } from "../application/services/visibility-service";
import { LabelProjectionService } from "../application/services/label-projection-service";
import { RuntimeVisibilityService } from "../application/services/runtime-visibility-service";
import { BodyRenderer } from "../infrastructure/three/renderers/body-renderer";
import { OrbitRenderer } from "../infrastructure/three/renderers/orbit-renderer";
import { ParticleRenderer } from "../infrastructure/three/renderers/particle-renderer";
import { GuideRenderer } from "../infrastructure/three/renderers/guide-renderer";
import { PostprocessingRenderer } from "../infrastructure/three/renderers/postprocessing-renderer";
import {
  LabelsLayer,
  type LabelLayerLike,
  type LabelOptions
} from "../infrastructure/dom/labels-layer";
import {
  HudController,
  type HudHandle
} from "../infrastructure/dom/hud-controller";
import { setInitialCameraPlacement as applyInitialCameraPlacement } from "../infrastructure/three/controllers/camera-controller";
import { RuntimeThree } from "./three-globals";
import type {
  BeltRuntime,
  BodyRenderConfig,
  DirectionalGuideLine,
  GuideRuntime,
  HudStateLike,
  MathApi,
  Point3,
  PostprocessingConfig,
  PovTargetKey,
  SceneData,
  SceneDataApi,
  SceneObjectRuntime,
  SimulationConstants,
  VisibilityRuntime,
  VisibilityStateLike
} from "../types/solar-system";

const THREE = RuntimeThree;

export const constants = SIMULATION_CONSTANTS;
export const math: MathApi = OrbitalMath;

export const sceneDataFactory = new SceneDataFactory({
  constants: SIMULATION_CONSTANTS,
  math: OrbitalMath,
  planetCatalog,
  dwarfPlanetCatalog,
  cometCatalog,
  markerCatalog,
  beltCatalog,
  sceneBodyCatalog,
  random: Math.random
});

export const data: SceneDataApi = {
  createSceneData: sceneDataFactory.createSceneData.bind(sceneDataFactory)
};

function createLabelAdapter(layer: HTMLElement): LabelLayerLike {
  return {
    createLabel(text: string, options: LabelOptions = {}) {
      const label = document.createElement("div");
      label.className = "body-label";
      label.textContent = text;
      const objectType =
        typeof options.objectType === "string" ? options.objectType.trim() : "";
      if (objectType) {
        label.dataset.objectType = objectType;
      }
      layer.appendChild(label);
      return label;
    }
  };
}

function createLabelsLayer(): HTMLDivElement {
  const labelsLayer = new LabelsLayer();
  return labelsLayer.createLayer();
}

function createLabelElement(
  layer: HTMLElement,
  text: string,
  options: LabelOptions = {}
): HTMLDivElement | null {
  return createLabelAdapter(layer).createLabel(text, options);
}

function createBodyRuntime(
  config: BodyRenderConfig,
  bodyGroup: Group,
  bodyGeometry: SphereGeometry,
  labelsLayerElement: HTMLElement
): SceneObjectRuntime {
  const renderer = new BodyRenderer({
    labelsLayer: createLabelAdapter(labelsLayerElement),
    THREE
  });
  return renderer.createBodyRuntime(config, bodyGroup, bodyGeometry);
}

function createLabelAnchorRuntime(
  config: BodyRenderConfig,
  labelsLayerElement: HTMLElement
): SceneObjectRuntime {
  const renderer = new BodyRenderer({
    labelsLayer: createLabelAdapter(labelsLayerElement),
    THREE
  });
  return renderer.createLabelAnchorRuntime(config);
}

function buildOrbitLine(
  points: Point3[],
  color: string,
  opacity: number,
  orbitingBodyPosition?: Point3 | null
) {
  return OrbitRenderer.buildOrbitLine(THREE, points, color, opacity, orbitingBodyPosition);
}

function buildOrbitingBodies(
  sceneData: SceneData,
  orbitGroup: Group,
  bodyGroup: Group,
  bodyGeometry: SphereGeometry,
  sceneObjectRuntimes: SceneObjectRuntime[],
  orbitingBodies: SceneData["planets"],
  labelsLayerElement: HTMLElement
): void {
  const bodyRenderer = new BodyRenderer({
    labelsLayer: createLabelAdapter(labelsLayerElement),
    THREE
  });
  const orbitRenderer = new OrbitRenderer({ bodyRenderer, THREE });
  orbitRenderer.buildOrbitingBodies(
    sceneData,
    orbitGroup,
    bodyGroup,
    bodyGeometry,
    sceneObjectRuntimes,
    orbitingBodies
  );
}

function buildFixedBodies(
  sceneData: SceneData,
  bodyGroup: Group,
  bodyGeometry: SphereGeometry,
  sceneObjectRuntimes: SceneObjectRuntime[],
  labelsLayerElement: HTMLElement
): void {
  const bodyRenderer = new BodyRenderer({
    labelsLayer: createLabelAdapter(labelsLayerElement),
    THREE
  });
  bodyRenderer.buildFixedBodies(sceneData, bodyGroup, bodyGeometry, sceneObjectRuntimes);
}

function buildStarField(sceneData: SceneData, particleGroup: Group): void {
  const renderer = new ParticleRenderer({ THREE });
  renderer.buildStarField(sceneData, particleGroup);
}

function buildAsteroidBelts(
  sceneData: SceneData,
  particleGroup: Group,
  beltRuntimes: BeltRuntime[],
  math?: MathApi,
  orbitalPositionScratch?: Point3
): void {
  const renderer = new ParticleRenderer({ THREE });
  renderer.buildAsteroidBelts(
    sceneData,
    particleGroup,
    beltRuntimes,
    math,
    orbitalPositionScratch
  );
}

function updateAsteroidBeltVisuals(
  beltRuntimes: BeltRuntime[],
  camera: PerspectiveCamera | null
): void {
  const renderer = new ParticleRenderer({ THREE });
  renderer.updateAsteroidBeltVisuals(beltRuntimes, camera);
}

function createLightRay(guideLine: DirectionalGuideLine, points: Vector3[]): GuideRuntime | null {
  const renderer = new GuideRenderer({
    labelsLayer: {
      createLabel() {
        return null;
      }
    },
    THREE
  });
  return renderer.createLightRay(guideLine, points);
}

function buildGuideLines(
  sceneData: SceneData,
  guideLineGroup: Group,
  guideRuntimes: GuideRuntime[],
  labelsLayerElement: HTMLElement,
  sceneObjectRuntimes: SceneObjectRuntime[],
  visibilityRuntimes: VisibilityRuntime[]
): void {
  const renderer = new GuideRenderer({
    labelsLayer: createLabelAdapter(labelsLayerElement),
    THREE
  });
  renderer.buildGuideLines(
    sceneData,
    guideLineGroup,
    guideRuntimes,
    sceneObjectRuntimes,
    visibilityRuntimes
  );
}

function applyGuideLineVisibility(
  state: VisibilityStateLike,
  guideRuntimes: VisibilityRuntime[]
): void {
  const runtimeVisibility = new RuntimeVisibilityService({ state });
  const service = new VisibilityService({
    visibilityRuntimes: guideRuntimes,
    runtimeVisibility
  });
  service.apply();
}

function applyOrbitVisibility(
  state: Pick<VisibilityStateLike, "showOrbits">,
  orbitGroup: Group
): void {
  OrbitRenderer.applyOrbitVisibility(state, orbitGroup);
}

function setupHudControls(
  state: HudStateLike,
  controls: OrbitControls,
  guideRuntimes: VisibilityRuntime[],
  camera: PerspectiveCamera,
  mathApi: Pick<MathApi, "clamp">,
  orbitGroup: Group,
  requestRender?: () => void,
  resolvePovTarget?: (pov: PovTargetKey) => Point3 | null
): HudHandle {
  const controller = new HudController({
    state,
    controls,
    orbitGroup,
    visibilityRuntimes: guideRuntimes,
    camera,
    math: mathApi,
    onOrbitVisibilityChanged: applyOrbitVisibility,
    onVisibilityChanged: applyGuideLineVisibility,
    resolvePovTarget,
    requestRender
  });
  return controller.setup();
}

function setInitialCameraPlacement(
  camera: PerspectiveCamera,
  controls: OrbitControls,
  constants: SimulationConstants,
  state: Pick<VisibilityStateLike, "minCamera" | "maxCamera">,
  math?: Pick<MathApi, "clamp">
): void {
  applyInitialCameraPlacement({
    camera,
    controls,
    state,
    constants,
    math
  });
}

function createBodyVisualScaleAndLabelsUpdater(
  options: ConstructorParameters<typeof LabelProjectionService>[0]
) {
  const runtimeVisibility =
    options.runtimeVisibility ?? new RuntimeVisibilityService({ state: options.state });
  const projectionScratch = options.projectionScratch ?? new THREE.Vector3();
  const service = new LabelProjectionService({
    ...options,
    projectionScratch,
    runtimeVisibility
  });
  return service.update.bind(service);
}

function createSelectiveBloomRenderer(
  config: Omit<PostprocessingConfig, "THREE">
): PostprocessingRenderer {
  return new PostprocessingRenderer({ ...config, THREE });
}

export const app = {
  createLabelsLayer,
  createLabelElement,
  createBodyRuntime,
  createLabelAnchorRuntime,
  buildOrbitLine,
  buildOrbitingBodies,
  buildFixedBodies,
  buildStarField,
  buildAsteroidBelts,
  updateAsteroidBeltVisuals,
  createLightRay,
  buildGuideLines,
  applyGuideLineVisibility,
  applyOrbitVisibility,
  setupHudControls,
  setInitialCameraPlacement,
  createBodyVisualScaleAndLabelsUpdater,
  createSelectiveBloomRenderer
};
