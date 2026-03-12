import { namespace } from "../core/namespace";
import { RuntimeThree } from "../runtime/three-globals";
import { BodyRenderer } from "../infrastructure/three/renderers/body-renderer";
import { OrbitRenderer } from "../infrastructure/three/renderers/orbit-renderer";
import { ParticleRenderer } from "../infrastructure/three/renderers/particle-renderer";
import { GuideRenderer } from "../infrastructure/three/renderers/guide-renderer";
import { PostprocessingRenderer } from "../infrastructure/three/renderers/postprocessing-renderer";
import { LabelsLayer } from "../infrastructure/dom/labels-layer";
import { HudController } from "../infrastructure/dom/hud-controller";
import { setInitialCameraPlacement as applyInitialCameraPlacement } from "../infrastructure/three/controllers/camera-controller";
import { VisibilityService } from "../application/services/visibility-service";
import { LabelProjectionService } from "../application/services/label-projection-service";

const THREE = RuntimeThree;

function createLabelAdapter(layer) {
    return {
      createLabel(text, options: any = {}) {
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

export const app = (namespace.app = namespace.app || {});

  app.createLabelsLayer = function createLabelsLayer() {
    const labelsLayer = new LabelsLayer();
    namespace.compat.labelsLayer = labelsLayer;
    return labelsLayer.createLayer();
  };

  app.createLabelElement = function createLabelElement(layer, text, options = {}) {
    return createLabelAdapter(layer).createLabel(text, options);
  };

  app.createBodyRuntime = function createBodyRuntime(
    config,
    bodyGroup,
    bodyGeometry,
    labelsLayerElement
  ) {
    const renderer = new BodyRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement),
      THREE
    });
    return renderer.createBodyRuntime(config, bodyGroup, bodyGeometry);
  };

  app.createLabelAnchorRuntime = function createLabelAnchorRuntime(config, labelsLayerElement) {
    const renderer = new BodyRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement),
      THREE
    });
    return renderer.createLabelAnchorRuntime(config);
  };

  app.buildOrbitLine = function buildOrbitLine(points, color, opacity) {
    const renderer = new OrbitRenderer({ bodyRenderer: null, THREE });
    return renderer.buildOrbitLine(points, color, opacity);
  };

  app.buildOrbitingBodies = function buildOrbitingBodies(
    sceneData,
    orbitGroup,
    bodyGroup,
    bodyGeometry,
    sceneObjectRuntimes,
    orbitingBodies,
    labelsLayerElement,
    math
  ) {
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
  };

  app.buildFixedBodies = function buildFixedBodies(
    sceneData,
    bodyGroup,
    bodyGeometry,
    sceneObjectRuntimes,
    labelsLayerElement
  ) {
    const bodyRenderer = new BodyRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement),
      THREE
    });
    bodyRenderer.buildFixedBodies(
      sceneData,
      bodyGroup,
      bodyGeometry,
      sceneObjectRuntimes
    );
  };

  app.buildStarField = function buildStarField(sceneData, particleGroup) {
    const renderer = new ParticleRenderer({ THREE });
    renderer.buildStarField(sceneData, particleGroup);
  };

  app.buildAsteroidBelts = function buildAsteroidBelts(
    sceneData,
    particleGroup,
    beltRuntimes,
    math,
    orbitalPositionScratch
  ) {
    const renderer = new ParticleRenderer({ THREE });
    renderer.buildAsteroidBelts(
      sceneData,
      particleGroup,
      beltRuntimes,
      math,
      orbitalPositionScratch
    );
  };

  app.updateAsteroidBeltVisuals = function updateAsteroidBeltVisuals(
    beltRuntimes,
    camera
  ) {
    const renderer = new ParticleRenderer({ THREE });
    renderer.updateAsteroidBeltVisuals(beltRuntimes, camera);
  };

  app.createLightRay = function createLightRay(guideLine, points) {
    const renderer = new GuideRenderer({
      labelsLayer: {
        createLabel() {
          return null;
        }
      },
      THREE
    });
    return renderer.createLightRay(guideLine, points);
  };

  app.buildGuideLines = function buildGuideLines(
    sceneData,
    guideLineGroup,
    guideRuntimes,
    labelsLayerElement,
    sceneObjectRuntimes,
    visibilityRuntimes
  ) {
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
  };

  app.applyGuideLineVisibility = function applyGuideLineVisibility(state, guideRuntimes) {
    const service = new VisibilityService({
      state,
      visibilityRuntimes: guideRuntimes
    });
    service.apply();
  };

  app.applyOrbitVisibility = function applyOrbitVisibility(state, orbitGroup) {
    const renderer = new OrbitRenderer({ bodyRenderer: null, THREE });
    renderer.applyOrbitVisibility(state, orbitGroup);
  };

  app.setupHudControls = function setupHudControls(
    state,
    controls,
    guideRuntimes,
    camera,
    math,
    orbitGroup,
    requestRender
  ) {
    const controller = new HudController({
      state,
      controls,
      orbitGroup,
      visibilityRuntimes: guideRuntimes,
      camera,
      math,
      onOrbitVisibilityChanged: app.applyOrbitVisibility,
      onVisibilityChanged: app.applyGuideLineVisibility,
      requestRender
    });
    return controller.setup();
  };

  app.setInitialCameraPlacement = function setInitialCameraPlacement(
    camera,
    controls,
    constants,
    state,
    math
  ) {
    applyInitialCameraPlacement({
      camera,
      controls,
      state,
      constants,
      math
    });
  };

  app.createBodyVisualScaleAndLabelsUpdater =
    function createBodyVisualScaleAndLabelsUpdater(options) {
      const service = new LabelProjectionService({ ...options, THREE });
      return service.update.bind(service);
    };

  app.createSelectiveBloomRenderer = function createSelectiveBloomRenderer(config) {
    return new PostprocessingRenderer({ ...config, THREE });
  };
