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
  const OrbitPropagationService = namespace.application.services.OrbitPropagationService;
  const AsteroidBeltService = namespace.application.services.AsteroidBeltService;
  const LabelProjectionService = namespace.application.services.LabelProjectionService;
  if (!applyInitialCameraPlacement) {
    throw new Error("app compatibility bootstrap failed: missing setInitialCameraPlacement helper.");
  }

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
      labelsLayer: createLabelAdapter(labelsLayerElement)
    });
    return renderer.createBodyRuntime(config, bodyGroup, bodyGeometry);
  };

  app.createLabelAnchorRuntime = function createLabelAnchorRuntime(config, labelsLayerElement) {
    const renderer = new BodyRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement)
    });
    return renderer.createLabelAnchorRuntime(config);
  };

  app.buildOrbitLine = function buildOrbitLine(points, color, opacity) {
    const renderer = new OrbitRenderer({ bodyRenderer: null });
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
      labelsLayer: createLabelAdapter(labelsLayerElement)
    });
    const orbitRenderer = new OrbitRenderer({ bodyRenderer });
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
      labelsLayer: createLabelAdapter(labelsLayerElement)
    });
    bodyRenderer.buildFixedBodies(
      sceneData,
      bodyGroup,
      bodyGeometry,
      sceneObjectRuntimes,
      constants
    );
  };

  app.createOrbitingBodiesUpdater = function createOrbitingBodiesUpdater(options) {
    const service = new OrbitPropagationService(options);
    return service.update.bind(service);
  };

  app.buildStarField = function buildStarField(sceneData, particleGroup) {
    const renderer = new ParticleRenderer();
    renderer.buildStarField(sceneData, particleGroup);
  };

  app.buildOortCloud = function buildOortCloud(sceneData, particleGroup) {
    const renderer = new ParticleRenderer();
    renderer.buildOortCloud(sceneData, particleGroup);
  };

  app.buildAsteroidBelts = function buildAsteroidBelts(
    sceneData,
    particleGroup,
    beltRuntimes,
    math,
    orbitalPositionScratch
  ) {
    const renderer = new ParticleRenderer();
    renderer.buildAsteroidBelts(
      sceneData,
      particleGroup,
      beltRuntimes,
      math,
      orbitalPositionScratch
    );
  };

  app.createAsteroidBeltsUpdater = function createAsteroidBeltsUpdater(options) {
    const service = new AsteroidBeltService(options);
    return service.update.bind(service);
  };

  app.updateAsteroidBeltVisuals = function updateAsteroidBeltVisuals(
    beltRuntimes,
    camera
  ) {
    const renderer = new ParticleRenderer();
    renderer.updateAsteroidBeltVisuals(beltRuntimes, camera);
  };

  app.createLightRay = function createLightRay(guideLine, points) {
    const renderer = new GuideRenderer({
      labelsLayer: {
        createLabel() {
          return null;
        }
      }
    });
    return renderer.createLightRay(guideLine, points);
  };

  app.updateGuideLineVisuals = function updateGuideLineVisuals(guideRuntimes, camera) {
    const renderer = new GuideRenderer({ labelsLayer: null });
    renderer.updateGuideLineVisuals(guideRuntimes, camera);
  };

  app.buildGuideLines = function buildGuideLines(
    sceneData,
    guideLineGroup,
    guideRuntimes,
    labelsLayerElement,
    sceneObjectRuntimes
  ) {
    const renderer = new GuideRenderer({
      labelsLayer: createLabelAdapter(labelsLayerElement)
    });
    renderer.buildGuideLines(
      sceneData,
      guideLineGroup,
      guideRuntimes,
      sceneObjectRuntimes
    );
  };

  app.applyGuideLineVisibility = function applyGuideLineVisibility(state, guideRuntimes) {
    const renderer = new GuideRenderer({ labelsLayer: null });
    renderer.applyGuideLineVisibility(state, guideRuntimes);
  };

  app.applyOrbitVisibility = function applyOrbitVisibility(state, orbitGroup) {
    const renderer = new OrbitRenderer({ bodyRenderer: null });
    renderer.applyOrbitVisibility(state, orbitGroup);
  };

  app.setupHudControls = function setupHudControls(
    state,
    controls,
    guideRuntimes,
    camera,
    math,
    orbitGroup
  ) {
    const controller = new HudController({
      state,
      controls,
      orbitGroup,
      guideRuntimes,
      camera,
      math,
      onOrbitVisibilityChanged: app.applyOrbitVisibility,
      onGuideVisibilityChanged: app.applyGuideLineVisibility
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
      const service = new LabelProjectionService(options);
      return service.update.bind(service);
    };

  app.createSelectiveBloomRenderer = function createSelectiveBloomRenderer(config) {
    return new PostprocessingRenderer(config);
  };
})();
