(() => {
  const namespace = window.SolarSystem;
  if (!namespace) {
    throw new Error("runtime bootstrap failed: missing namespace.");
  }

  const AppState = namespace.application.state.AppState;
  const OrbitPropagationService = namespace.application.services.OrbitPropagationService;
  const AsteroidBeltService = namespace.application.services.AsteroidBeltService;
  const LabelProjectionService = namespace.application.services.LabelProjectionService;
  const CameraFitService = namespace.application.services.CameraFitService;
  const SimulationSystem = namespace.application.systems.SimulationSystem;

  const LabelsLayer = namespace.infrastructure.dom.LabelsLayer;
  const HudController = namespace.infrastructure.dom.HudController;
  const BodyRenderer = namespace.infrastructure.three.renderers.BodyRenderer;
  const OrbitRenderer = namespace.infrastructure.three.renderers.OrbitRenderer;
  const ParticleRenderer = namespace.infrastructure.three.renderers.ParticleRenderer;
  const GuideRenderer = namespace.infrastructure.three.renderers.GuideRenderer;
  const ShellRenderer = namespace.infrastructure.three.renderers.ShellRenderer;
  const PostprocessingRenderer =
    namespace.infrastructure.three.renderers.PostprocessingRenderer;
  const CameraController = namespace.infrastructure.three.controllers.CameraController;
  const FrameLoop = namespace.runtime.FrameLoop;

  class SolarSystemApplication {
    constructor(options = {}) {
      this.canvasId = options.canvasId || "scene";
      this.constants = options.constants || namespace.constants;
      this.data = options.data || namespace.data;
      this.math = options.math || namespace.math;

      this.initialized = false;
      this.frameLoop = null;
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

    initialize() {
      if (this.initialized) return;

      this.assertThreeDependencies();

      const THREE = window.THREE;
      const canvas = document.getElementById(this.canvasId);
      if (!(canvas instanceof HTMLCanvasElement)) {
        throw new Error(`Expected canvas element with id \"${this.canvasId}\".`);
      }
      this.canvas = canvas;

      this.sceneData = this.data.createSceneData();
      this.state = new AppState(this.constants);

      this.renderer = new THREE.WebGLRenderer({
        canvas: this.canvas,
        antialias: true,
        powerPreference: "high-performance"
      });
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer.setSize(window.innerWidth, window.innerHeight, false);
      if ("outputColorSpace" in this.renderer && THREE.SRGBColorSpace) {
        this.renderer.outputColorSpace = THREE.SRGBColorSpace;
      } else if ("outputEncoding" in this.renderer && THREE.sRGBEncoding !== undefined) {
        this.renderer.outputEncoding = THREE.sRGBEncoding;
      }
      this.renderer.setClearColor(this.constants.BACKGROUND_COLOR, 1);

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(
        48,
        Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
        this.constants.NEAR_CLIP,
        this.constants.SCENE_OUTER_AU * 12
      );

      this.postprocessingRenderer = new PostprocessingRenderer({
        renderer: this.renderer,
        scene: this.scene,
        camera: this.camera,
        width: Math.max(1, window.innerWidth),
        height: Math.max(1, window.innerHeight),
        bloomStrength: this.constants.SUN_BLOOM_STRENGTH,
        bloomRadius: this.constants.SUN_BLOOM_RADIUS,
        bloomThreshold: this.constants.SUN_BLOOM_THRESHOLD
      });

      this.controls = new THREE.OrbitControls(this.camera, this.renderer.domElement);
      this.controls.enableDamping = true;
      this.controls.dampingFactor = 0.08;
      this.controls.enablePan = false;
      this.controls.rotateSpeed = 0.68;
      this.controls.zoomSpeed = 0.05;
      this.controls.minDistance = this.state.minCamera;
      this.controls.maxDistance = this.state.maxCamera;
      this.controls.target.set(0, 0, 0);

      this.canvas.addEventListener("pointerdown", this.handlePointerDown);
      window.addEventListener("pointerup", this.handlePointerUp);

      this.labelsLayer = new LabelsLayer();
      this.labelsLayerElement = this.labelsLayer.createLayer();

      this.scene.add(new THREE.AmbientLight("#ffffff", 0.5));
      this.scene.add(new THREE.PointLight("#ffd794", 1.2, 0, 0));

      this.orbitGroup = new THREE.Group();
      this.shellGroup = new THREE.Group();
      this.guideLineGroup = new THREE.Group();
      this.particleGroup = new THREE.Group();
      this.bodyGroup = new THREE.Group();

      this.scene.add(this.orbitGroup);
      this.scene.add(this.shellGroup);
      this.scene.add(this.guideLineGroup);
      this.scene.add(this.particleGroup);
      this.scene.add(this.bodyGroup);

      this.bodyGeometry = new THREE.SphereGeometry(1, 20, 12);
      this.bodyRuntimes = [];
      this.guideLineRuntimes = [];
      this.beltRuntimes = [];
      this.orbitalSourceBodies = [];
      this.orbitalPositionScratch = { x: 0, y: 0, z: 0 };

      this.bodyRenderer = new BodyRenderer({ labelsLayer: this.labelsLayer });
      this.orbitRenderer = new OrbitRenderer({ bodyRenderer: this.bodyRenderer });
      this.particleRenderer = new ParticleRenderer();
      this.guideRenderer = new GuideRenderer({ labelsLayer: this.labelsLayer });
      this.shellRenderer = new ShellRenderer({
        constants: this.constants,
        shellCatalog: namespace.domain.catalogs.shellCatalog
      });

      this.particleRenderer.buildStarField(this.sceneData, this.particleGroup);
      this.particleRenderer.buildOortCloud(this.sceneData, this.particleGroup);
      this.shellRuntimes = this.shellRenderer.buildHeliosphereShells(this.shellGroup);
      this.guideRenderer.buildGuideLines(
        this.sceneData,
        this.guideLineGroup,
        this.guideLineRuntimes,
        this.bodyRuntimes
      );
      this.particleRenderer.buildAsteroidBelts(
        this.sceneData,
        this.particleGroup,
        this.beltRuntimes,
        this.math,
        this.orbitalPositionScratch
      );
      this.orbitRenderer.buildOrbitingBodies(
        this.sceneData,
        this.orbitGroup,
        this.bodyGroup,
        this.bodyGeometry,
        this.bodyRuntimes,
        this.orbitalSourceBodies,
        this.math
      );
      this.bodyRenderer.buildFixedBodies(
        this.sceneData,
        this.bodyGroup,
        this.bodyGeometry,
        this.bodyRuntimes,
        this.constants
      );

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
      this.bodyRuntimes.push(sunRuntime);
      this.postprocessingRenderer.markBloomObject(sunRuntime.mesh);

      this.hudController = new HudController({
        state: this.state,
        controls: this.controls,
        guideLineRuntimes: this.guideLineRuntimes,
        camera: this.camera,
        math: this.math,
        onGuideVisibilityChanged: this.guideRenderer.applyGuideLineVisibility.bind(
          this.guideRenderer
        )
      });
      this.hud = this.hudController.setup();

      this.cameraController = new CameraController({
        camera: this.camera,
        controls: this.controls,
        state: this.state,
        cameraFitService: new CameraFitService({
          constants: this.constants,
          math: this.math
        })
      });
      this.cameraController.setInitialPlacement();

      this.orbitPropagationService = new OrbitPropagationService({
        orbitalSourceBodies: this.orbitalSourceBodies,
        bodyRuntimes: this.bodyRuntimes,
        math: this.math,
        orbitalPositionScratch: this.orbitalPositionScratch,
        motionTimeScale: 1
      });
      this.asteroidBeltService = new AsteroidBeltService({
        beltRuntimes: this.beltRuntimes,
        math: this.math,
        orbitalPositionScratch: this.orbitalPositionScratch,
        motionTimeScale: 1
      });
      this.labelProjectionService = new LabelProjectionService({
        renderer: this.renderer,
        camera: this.camera,
        bodyRuntimes: this.bodyRuntimes,
        state: this.state,
        projectionScratch: new THREE.Vector3()
      });

      this.simulationSystem = new SimulationSystem({
        orbitPropagationService: this.orbitPropagationService,
        asteroidBeltService: this.asteroidBeltService,
        controls: this.controls,
        shellRenderer: this.shellRenderer,
        guideRenderer: this.guideRenderer,
        labelProjectionService: this.labelProjectionService,
        postprocessingRenderer: this.postprocessingRenderer,
        shellRuntimes: this.shellRuntimes,
        guideLineRuntimes: this.guideLineRuntimes,
        camera: this.camera
      });

      window.addEventListener("resize", this.handleResize);
      this.resize();
      this.guideRenderer.applyGuideLineVisibility(this.state, this.guideLineRuntimes);

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

      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

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

      this.frameLoop = new FrameLoop((deltaSeconds, elapsedSeconds) => {
        this.simulationSystem.update(deltaSeconds, elapsedSeconds);
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
        this.canvas.removeEventListener("pointerdown", this.handlePointerDown);
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
