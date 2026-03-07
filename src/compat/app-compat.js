(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.infrastructure || !namespace.application) {
    throw new Error("app compatibility bootstrap failed: missing architecture namespaces.");
  }

  const BodyRenderer = namespace.infrastructure.three.renderers.BodyRenderer;
  const OrbitRenderer = namespace.infrastructure.three.renderers.OrbitRenderer;
  const ParticleRenderer = namespace.infrastructure.three.renderers.ParticleRenderer;
  const GuideRenderer = namespace.infrastructure.three.renderers.GuideRenderer;
  const PostprocessingRenderer =
    namespace.infrastructure.three.renderers.PostprocessingRenderer;
  const LabelsLayer = namespace.infrastructure.dom.LabelsLayer;
  const HudController = namespace.infrastructure.dom.HudController;
  const applyInitialCameraPlacement =
    namespace.infrastructure.three.controllers.setInitialCameraPlacement;
  const VisibilityService = namespace.application.services.VisibilityService;
  const LabelProjectionService = namespace.application.services.LabelProjectionService;
  if (!applyInitialCameraPlacement) {
    throw new Error("app compatibility bootstrap failed: missing setInitialCameraPlacement helper.");
  }

  const THREE = window.THREE;

  function createLabelAdapter(layer) {
    return {
      createLabel(text, options = {}) {
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

  const app = (namespace.app = namespace.app || {});

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
    labelsLayerElement,
    constants
  ) {
    const bodyRenderer = new BodyRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement),
      THREE
    });
    bodyRenderer.buildFixedBodies(
      sceneData,
      bodyGroup,
      bodyGeometry,
      sceneObjectRuntimes,
      constants
    );
  };

  app.buildStarField = function buildStarField(sceneData, particleGroup) {
    const renderer = new ParticleRenderer({ THREE });
    renderer.buildStarField(sceneData, particleGroup);
  };

  app.buildOortCloud = function buildOortCloud(sceneData, particleGroup) {
    const renderer = new ParticleRenderer({ THREE });
    renderer.buildOortCloud(sceneData, particleGroup);
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
})();
