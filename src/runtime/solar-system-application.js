(() => {
  const namespace = window.SolarSystem;
  if (!namespace) {
    throw new Error("runtime bootstrap failed: missing namespace.");
  }

  const AppState = namespace.application.state.AppState;
  const OrbitPropagationService = namespace.application.services.OrbitPropagationService;
  const AsteroidBeltService = namespace.application.services.AsteroidBeltService;
  const LabelProjectionService = namespace.application.services.LabelProjectionService;
  const SimulationSystem = namespace.application.systems.SimulationSystem;

  const LabelsLayer = namespace.infrastructure.dom.LabelsLayer;
  const HudController = namespace.infrastructure.dom.HudController;
  const BodyRenderer = namespace.infrastructure.three.renderers.BodyRenderer;
  const OrbitRenderer = namespace.infrastructure.three.renderers.OrbitRenderer;
  const ParticleRenderer = namespace.infrastructure.three.renderers.ParticleRenderer;
  const GuideRenderer = namespace.infrastructure.three.renderers.GuideRenderer;
  const PostprocessingRenderer =
    namespace.infrastructure.three.renderers.PostprocessingRenderer;
  const setInitialCameraPlacement =
    namespace.infrastructure.three.controllers.setInitialCameraPlacement;
  const FrameScheduler = namespace.core.FrameScheduler;
  if (!setInitialCameraPlacement || !FrameScheduler) {
    throw new Error(
      "runtime bootstrap failed: missing setInitialCameraPlacement helper or FrameScheduler."
    );
  }

  class SolarSystemApplication {
    constructor(options = {}) {
      this.canvasId = options.canvasId || "scene";
      this.constants = options.constants || namespace.constants;
      this.sceneDataApi = options.data || namespace.data;
      this.data = this.sceneDataApi;
      this.math = options.math || namespace.math;

      this.initialized = false;
      this.frameLoop = null;
      this.canvas = null;
      this.labelsLayerElement = null;

      this.handleResize = this.resize.bind(this);
      this.handlePointerDown = this.onPointerDown.bind(this);
      this.handlePointerUp = this.onPointerUp.bind(this);
    }

    assertThreeDependencies() {
      const THREE = window.THREE;
      if (
        !THREE ||
        !THREE.OrbitControls ||
        !THREE.ShaderPass ||
        !THREE.CopyShader ||
        !THREE.LuminosityHighPassShader ||
        !THREE.EffectComposer ||
        !THREE.RenderPass ||
        !THREE.UnrealBloomPass
      ) {
        throw new Error(
          "Three.js bootstrap failed: missing THREE, OrbitControls, or postprocessing classes."
        );
      }
    }

    getViewportSize() {
      return {
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight)
      };
    }

    getPixelRatio() {
      return Math.min(window.devicePixelRatio || 1, 2);
    }

    createCanvas() {
      const canvas = document.getElementById(this.canvasId);
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`Expected canvas element with id "${this.canvasId}".`);
      }

      this.canvas = canvas;
      return canvas;
    }

    createRenderer(THREE) {
      const { width, height } = this.getViewportSize();
      const renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance"
      });

      renderer.setPixelRatio(this.getPixelRatio());
      renderer.setSize(width, height, false);
      if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
        renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
        renderer.outputEncoding = THREE.sRGBEncoding;
      }
      renderer.setClearColor(this.constants.BACKGROUND_COLOR, 1);

      return renderer;
    }

    createScene(THREE) {
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight("#ffffff", 0.5));
      scene.add(new THREE.PointLight("#ffd794", 1.2, 0, 0));
      return scene;
    }

    createCamera(THREE) {
      const { width, height } = this.getViewportSize();
      return new THREE.PerspectiveCamera(
        48,
        width / height,
        this.constants.NEAR_CLIP,
        this.constants.SCENE_OUTER_AU * 12
      );
    }

    createPostprocessingRenderer() {
      const { width, height } = this.getViewportSize();
      return new PostprocessingRenderer({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width,
        height,
        bloomStrength: this.constants.SUN_BLOOM_STRENGTH,
        bloomRadius: this.constants.SUN_BLOOM_RADIUS,
        bloomThreshold: this.constants.SUN_BLOOM_THRESHOLD
      });
    }

    createControls(THREE) {
      const controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      controls.enableDamping = true;
      controls.dampingFactor = 0.08;
      controls.enablePan = false;
      controls.rotateSpeed = 0.68;
      controls.zoomSpeed = 0.05;
      controls.minDistance = this.state.minCamera;
      controls.maxDistance = this.state.maxCamera;
      controls.target.set(0, 0, 0);
      return controls;
    }

    createSceneGroups(THREE) {
      return {
        orbitGroup: new THREE.Group(),
        guideLineGroup: new THREE.Group(),
        particleGroup: new THREE.Group(),
        bodyGroup: new THREE.Group()
      };
    }

    attachSceneGroups() {
      this.scene.add(this.orbitGroup);
      this.scene.add(this.guideLineGroup);
      this.scene.add(this.particleGroup);
      this.scene.add(this.bodyGroup);
    }

    initializeState() {
      this.sceneData = this.sceneDataApi.createSceneData();
      this.state = new AppState(this.constants);
    }

    initializeLabelsLayer() {
      this.labelsLayer = new LabelsLayer();
      this.labelsLayerElement = this.labelsLayer.createLayer();
    }

    initializeRuntimeCollections(THREE) {
      Object.assign(this, this.createSceneGroups(THREE));
      this.attachSceneGroups();

      this.bodyGeometry = new THREE.SphereGeometry(1, 20, 12);
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];

      // Preserve legacy property names for the compat facade.
      this.bodyRuntimes = this.sceneObjectRuntimes;
      this.guideLineRuntimes = this.guideRuntimes;
      this.orbitalSourceBodies = this.orbitingBodies;
    }

    initializeRenderers() {
      this.bodyRenderer = new BodyRenderer({ labelsLayer: this.labelsLayer });
      this.orbitRenderer = new OrbitRenderer({ bodyRenderer: this.bodyRenderer });
      this.particleRenderer = new ParticleRenderer();
      this.guideRenderer = new GuideRenderer({ labelsLayer: this.labelsLayer });
    }

    buildSceneContents() {
      this.particleRenderer.buildStarField(this.sceneData, this.particleGroup);
      this.particleRenderer.buildOortCloud(this.sceneData, this.particleGroup);
      this.guideRenderer.buildGuideLines(
        this.sceneData,
        this.guideLineGroup,
        this.guideRuntimes,
        this.sceneObjectRuntimes
      );
      this.particleRenderer.buildAsteroidBelts(
        this.sceneData,
        this.particleGroup,
        this.beltRuntimes,
        this.math
      );
      this.orbitRenderer.buildOrbitingBodies(
        this.sceneData,
        this.orbitGroup,
        this.bodyGroup,
        this.bodyGeometry,
        this.sceneObjectRuntimes,
        this.orbitingBodies,
        this.math
      );
      this.bodyRenderer.buildFixedBodies(
        this.sceneData,
        this.bodyGroup,
        this.bodyGeometry,
        this.sceneObjectRuntimes
      );
      this.createSunRuntime();
    }

    createSunRuntime() {
      const sunRuntime = this.bodyRenderer.createBodyRuntime(
        {
          name: "Sun",
          color: "#ffce6b",
          renderRadius: this.constants.SUN_RADIUS_KM / this.constants.KM_PER_AU,
          minPixelRadius: 2.6,
          fixedPosition: { x: 0, y: 0, z: 0 },
          emissive: true
        },
        this.bodyGroup,
        this.bodyGeometry
      );
      this.sceneObjectRuntimes.push(sunRuntime);
      this.postprocessingRenderer.markBloomObject(sunRuntime.mesh);
    }

    initializeHud() {
      this.hudController = new HudController({
        state: this.state,
        controls: this.controls,
        orbitGroup: this.orbitGroup,
        guideRuntimes: this.guideRuntimes,
        camera: this.camera,
        math: this.math,
        onOrbitVisibilityChanged: this.orbitRenderer.applyOrbitVisibility.bind(
          this.orbitRenderer
        ),
        onGuideVisibilityChanged: this.guideRenderer.applyGuideLineVisibility.bind(
          this.guideRenderer
        )
      });
      this.hud = this.hudController.setup();
    }

    initializeCameraPlacement() {
      setInitialCameraPlacement({
        camera: this.camera,
        controls: this.controls,
        state: this.state,
        constants: this.constants,
        math: this.math
      });
    }

    initializeSimulationServices(THREE) {
      this.orbitPropagationService = new OrbitPropagationService({
        orbitingBodies: this.orbitingBodies,
        sceneObjectRuntimes: this.sceneObjectRuntimes,
        math: this.math,
        motionTimeScale: 1
      });
      this.asteroidBeltService = new AsteroidBeltService({
        beltRuntimes: this.beltRuntimes,
        math: this.math,
        motionTimeScale: 1
      });
      this.labelProjectionService = new LabelProjectionService({
        renderer: this.renderer,
        camera: this.camera,
        sceneObjectRuntimes: this.sceneObjectRuntimes,
        state: this.state,
        projectionScratch: new THREE.Vector3()
      });
    }

    initializeSimulationSystem() {
      this.simulationSystem = new SimulationSystem({
        orbitPropagationService: this.orbitPropagationService,
        asteroidBeltService: this.asteroidBeltService,
        particleRenderer: this.particleRenderer,
        beltRuntimes: this.beltRuntimes,
        controls: this.controls,
        guideRenderer: this.guideRenderer,
        labelProjectionService: this.labelProjectionService,
        postprocessingRenderer: this.postprocessingRenderer,
        guideRuntimes: this.guideRuntimes,
        camera: this.camera
      });
    }

    registerEvents() {
      this.canvas.addEventListener("pointerdown", this.handlePointerDown);
      window.addEventListener("pointerup", this.handlePointerUp);
      window.addEventListener("resize", this.handleResize);
    }

    applyInitialRenderState() {
      this.resize();
      this.orbitRenderer.applyOrbitVisibility(this.state, this.orbitGroup);
      this.guideRenderer.applyGuideLineVisibility(this.state, this.guideRuntimes);
      this.particleRenderer.updateAsteroidBeltVisuals(this.beltRuntimes, this.camera);
    }

    initialize() {
      if (this.initialized) return;

      this.assertThreeDependencies();

      const THREE = window.THREE;
      this.createCanvas();
      this.initializeState();

      this.renderer = this.createRenderer(THREE);
      this.scene = this.createScene(THREE);
      this.camera = this.createCamera(THREE);
      this.postprocessingRenderer = this.createPostprocessingRenderer();
      this.controls = this.createControls(THREE);

      this.initializeLabelsLayer();
      this.initializeRuntimeCollections(THREE);
      this.initializeRenderers();
      this.buildSceneContents();
      this.initializeHud();
      this.initializeCameraPlacement();
      this.initializeSimulationServices(THREE);
      this.initializeSimulationSystem();
      this.registerEvents();
      this.applyInitialRenderState();

      this.initialized = true;
    }

    onPointerDown() {
      if (this.canvas) {
        this.canvas.classList.add("dragging");
      }
    }

    onPointerUp() {
      if (this.canvas) {
        this.canvas.classList.remove("dragging");
      }
    }

    resize() {
      if (!this.initialized && !this.renderer) return;

      const { width, height } = this.getViewportSize();
      const pixelRatio = this.getPixelRatio();

      this.renderer.setPixelRatio(pixelRatio);
      this.renderer.setSize(width, height, false);
      this.postprocessingRenderer.setPixelRatio(pixelRatio);
      this.postprocessingRenderer.setSize(width, height);
      this.camera.aspect = width / height;
      this.camera.updateProjectionMatrix();

      this.controls.minDistance = this.state.minCamera;
      this.controls.maxDistance = this.state.maxCamera;
      if (this.hud && typeof this.hud.updateZoomToggleLabel === "function") {
        this.hud.updateZoomToggleLabel();
      }
    }

    start() {
      if (!this.initialized) {
        this.initialize();
      }
      if (this.frameLoop) {
        this.frameLoop.start();
        return;
      }

      this.frameLoop = new FrameScheduler((deltaSeconds) => {
        this.simulationSystem.update(deltaSeconds);
      });
      this.frameLoop.start();
    }

    stop() {
      if (this.frameLoop) {
        this.frameLoop.stop();
      }
    }

    dispose() {
      this.stop();
      window.removeEventListener("resize", this.handleResize);
      window.removeEventListener("pointerup", this.handlePointerUp);
      if (this.canvas) {
        this.canvas.classList.remove("dragging");
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
      }
      if (this.labelsLayerElement) {
        this.labelsLayerElement.remove();
        this.labelsLayerElement = null;
      }
      this.initialized = false;
    }
  }

  namespace.runtime.SolarSystemApplication = SolarSystemApplication;

  function bootstrap() {
    const app = new SolarSystemApplication();
    namespace.runtime.appInstance = app;
    app.start();
  }

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }
})();
