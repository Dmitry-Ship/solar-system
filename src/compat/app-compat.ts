import type { Group, PerspectiveCamera, SphereGeometry, Vector3 } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { RuntimeThree } from "../runtime/three-globals";
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
import { VisibilityService } from "../application/services/visibility-service";
import { LabelProjectionService } from "../application/services/label-projection-service";
import type {
  BeltRuntime,
  BodyRenderConfig,
  DirectionalGuideLine,
  GuideRuntime,
  MathApi,
  PostprocessingConfig,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime,
  SimulationConstants,
  VisibilityRuntime,
  VisibilityStateLike
} from "../types/solar-system";

const THREE: RuntimeThreeModule = RuntimeThree;

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

function buildOrbitLine(points: { x: number; y: number; z: number }[], color: string, opacity: number) {
  const renderer = new OrbitRenderer({ bodyRenderer: null, THREE });
  return renderer.buildOrbitLine(points, color, opacity);
}

function buildOrbitingBodies(
  sceneData: SceneData,
  orbitGroup: Group,
  bodyGroup: Group,
  bodyGeometry: SphereGeometry,
  sceneObjectRuntimes: SceneObjectRuntime[],
  orbitingBodies: SceneData["planets"],
  labelsLayerElement: HTMLElement,
  math: MathApi
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
    orbitingBodies,
    math
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
  orbitalPositionScratch?: { x: number; y: number; z: number }
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
  const service = new VisibilityService({
    state,
    visibilityRuntimes: guideRuntimes
  });
  service.apply();
}

function applyOrbitVisibility(
  state: Pick<VisibilityStateLike, "showOrbits">,
  orbitGroup: Group | null
): void {
  const renderer = new OrbitRenderer({ bodyRenderer: null, THREE });
  renderer.applyOrbitVisibility(state, orbitGroup);
}

function setupHudControls(
  state: VisibilityStateLike,
  controls: OrbitControls,
  guideRuntimes: VisibilityRuntime[],
  camera: PerspectiveCamera,
  math: Pick<MathApi, "clamp">,
  orbitGroup: Group | null,
  requestRender?: () => void
): HudHandle {
  const controller = new HudController({
    state,
    controls,
    orbitGroup,
    visibilityRuntimes: guideRuntimes,
    camera,
    math,
    onOrbitVisibilityChanged: applyOrbitVisibility,
    onVisibilityChanged: applyGuideLineVisibility,
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
  const service = new LabelProjectionService({ ...options, THREE });
  return service.update.bind(service);
}

function createSelectiveBloomRenderer(
  config: Omit<PostprocessingConfig, "THREE">
): PostprocessingRenderer {
  return new PostprocessingRenderer({ ...config, THREE });
}

export const app = Object.freeze({
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
});
