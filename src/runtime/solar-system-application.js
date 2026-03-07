(() => {
  const namespace = window.SolarSystem;
  if (!namespace) {
    throw new Error("runtime bootstrap failed: missing namespace.");
  }

  const AppState = namespace.application.state.AppState;
  const VisibilityService = namespace.application.services.VisibilityService;
  const LabelProjectionService = namespace.application.services.LabelProjectionService;

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
  if (!setInitialCameraPlacement) {
    throw new Error(
      "runtime bootstrap failed: missing setInitialCameraPlacement helper."
    );
  }

  const RUNTIME_RENDER_CONFIG = Object.freeze({
    backgroundColor: "#000000",
    nearClip: 0.08,
    cameraFarDistanceMultiplier: 12,
    bloomStrength: 5.4,
    bloomRadius: 0.55,
    bloomThreshold: 0.72
  });

  class SolarSystemApplication {
    constructor(options = {}) {
      this.canvasId = options.canvasId || "scene";
      this.constants = options.constants || namespace.constants;
      this.sceneDataApi = options.data || namespace.data;
      this.data = this.sceneDataApi;
      this.math = options.math || namespace.math;
      this.THREE = options.THREE || window.THREE;

      this.initialized = false;
      this.canvas = null;
      this.labelsLayerElement = null;

      this.handleResize = this.resize.bind(this);
      this.handleControlsChange = this.renderScene.bind(this);
      this.handlePointerDown = this.onPointerDown.bind(this);
      this.handlePointerUp = this.onPointerUp.bind(this);
    }

    assertThreeDependencies() {
      const { THREE } = this;
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

    createRenderer() {
      const { THREE } = this;
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
      renderer.setClearColor(RUNTIME_RENDER_CONFIG.backgroundColor, 1);

      return renderer;
    }

    createScene() {
      const { THREE } = this;
      const scene = new THREE.Scene();
      scene.add(new THREE.AmbientLight("#ffffff", 0.5));
      scene.add(new THREE.PointLight("#ffd794", 1.2, 0, 0));
      return scene;
    }

    createCamera() {
      const { THREE } = this;
      const { width, height } = this.getViewportSize();
      return new THREE.PerspectiveCamera(
        48,
        width / height,
        RUNTIME_RENDER_CONFIG.nearClip,
        this.constants.SCENE_OUTER_AU * RUNTIME_RENDER_CONFIG.cameraFarDistanceMultiplier
      );
    }

    createPostprocessingRenderer() {
      const { THREE } = this;
      const { width, height } = this.getViewportSize();
      return new PostprocessingRenderer({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width,
        height,
        bloomStrength: RUNTIME_RENDER_CONFIG.bloomStrength,
        bloomRadius: RUNTIME_RENDER_CONFIG.bloomRadius,
        bloomThreshold: RUNTIME_RENDER_CONFIG.bloomThreshold
      });
    }

    createControls() {
      const { THREE } = this;
      const controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      controls.enableDamping = false;
      controls.enablePan = false;
      controls.rotateSpeed = 0.68;
      controls.zoomSpeed = 0.05;
      controls.minDistance = this.state.minCamera;
      controls.maxDistance = this.state.maxCamera;
      controls.target.set(0, 0, 0);
      return controls;
    }

    createSceneGroups() {
      const { THREE } = this;
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
      this.state = new AppState();
    }

    initializeLabelsLayer() {
      this.labelsLayer = new LabelsLayer();
      this.labelsLayerElement = this.labelsLayer.createLayer();
    }

    initializeRuntimeCollections() {
      const { THREE } = this;
      Object.assign(this, this.createSceneGroups());
      this.attachSceneGroups();

      this.bodyGeometry = new THREE.SphereGeometry(1, 20, 12);
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.visibilityRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];

      this.bodyRuntimes = this.sceneObjectRuntimes;
      this.guideLineRuntimes = this.guideRuntimes;
      this.orbitalSourceBodies = this.orbitingBodies;
    }

    initializeRenderers() {
      this.bodyRenderer = new BodyRenderer({ 
        labelsLayer: this.labelsLayer,
        THREE: this.THREE 
      });
      this.orbitRenderer = new OrbitRenderer({ 
        bodyRenderer: this.bodyRenderer,
        THREE: this.THREE 
      });
      this.particleRenderer = new ParticleRenderer({ THREE: this.THREE });
      this.guideRenderer = new GuideRenderer({ 
        labelsLayer: this.labelsLayer,
        THREE: this.THREE 
      });
    }

    initializeVisibilityService() {
      this.visibilityService = new VisibilityService({
        state: this.state,
        visibilityRuntimes: this.visibilityRuntimes
      });
    }

    buildSceneContents() {
      this.particleRenderer.buildStarField(this.sceneData, this.particleGroup);
      this.particleRenderer.buildOortCloud(this.sceneData, this.particleGroup);
      this.guideRenderer.buildGuideLines(
        this.sceneData,
        this.guideLineGroup,
        this.guideRuntimes,
        this.sceneObjectRuntimes,
        this.visibilityRuntimes
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
        visibilityRuntimes: this.visibilityRuntimes,
        camera: this.camera,
        math: this.math,
        onOrbitVisibilityChanged: this.orbitRenderer.applyOrbitVisibility.bind(
          this.orbitRenderer
        ),
        onVisibilityChanged: this.visibilityService.apply.bind(this.visibilityService),
        requestRender: this.renderScene.bind(this)
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

    initializeViewServices() {
      const { THREE } = this;
      this.labelProjectionService = new LabelProjectionService({
        renderer: this.renderer,
        camera: this.camera,
        sceneObjectRuntimes: this.sceneObjectRuntimes,
        state: this.state,
        projectionScratch: new THREE.Vector3(),
        THREE: this.THREE
      });
    }

    registerEvents() {
      this.canvas.addEventListener("pointerdown", this.handlePointerDown);
      window.addEventListener("pointerup", this.handlePointerUp);
      window.addEventListener("resize", this.handleResize);
      this.controls.addEventListener("change", this.handleControlsChange);
    }

    renderScene() {
      if (!this.renderer || !this.camera) return;

      this.orbitRenderer.applyOrbitVisibility(this.state, this.orbitGroup);
      this.visibilityService.apply();
      this.particleRenderer.updateAsteroidBeltVisuals(this.beltRuntimes, this.camera);
      this.labelProjectionService.update();
      this.postprocessingRenderer.render();
    }

    initialize() {
      if (this.initialized) return;

      this.assertThreeDependencies();

      this.createCanvas();
      this.initializeState();

      this.renderer = this.createRenderer();
      this.scene = this.createScene();
      this.camera = this.createCamera();
      this.postprocessingRenderer = this.createPostprocessingRenderer();
      this.controls = this.createControls();

      this.initializeLabelsLayer();
      this.initializeRuntimeCollections();
      this.initializeRenderers();
      this.buildSceneContents();
      this.initializeVisibilityService();
      this.initializeHud();
      this.initializeCameraPlacement();
      this.initializeViewServices();
      this.registerEvents();
      this.resize();

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

      if (this.initialized) {
        this.renderScene();
      }
    }

    start() {
      if (!this.initialized) {
        this.initialize();
      }
      this.renderScene();
    }

    stop() {}

    dispose() {
      this.stop();
      window.removeEventListener("resize", this.handleResize);
      window.removeEventListener("pointerup", this.handlePointerUp);
      if (this.controls) {
        this.controls.removeEventListener("change", this.handleControlsChange);
        if (typeof this.controls.dispose === "function") {
          this.controls.dispose();
        }
      }
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
