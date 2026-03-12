import { namespace } from "../core/namespace";
import { AppState } from "../application/state/app-state";
import { SceneRuntimeSystem } from "../application/systems/scene-runtime-system";
import { VisibilityService } from "../application/services/visibility-service";
import { LabelProjectionService } from "../application/services/label-projection-service";
import { RuntimeVisibilityService } from "../application/services/runtime-visibility-service";
import { LabelsLayer } from "../infrastructure/dom/labels-layer";
import { HudController } from "../infrastructure/dom/hud-controller";
import { BodyRenderer } from "../infrastructure/three/renderers/body-renderer";
import { OrbitRenderer } from "../infrastructure/three/renderers/orbit-renderer";
import { ParticleRenderer } from "../infrastructure/three/renderers/particle-renderer";
import { GuideRenderer } from "../infrastructure/three/renderers/guide-renderer";
import { PostprocessingRenderer } from "../infrastructure/three/renderers/postprocessing-renderer";
import { setInitialCameraPlacement } from "../infrastructure/three/controllers/camera-controller";
import { RuntimeThree } from "./three-globals";

const RUNTIME_RENDER_CONFIG = Object.freeze({
  backgroundColor: "#000000",
  nearClip: 0.08,
  cameraFarDistanceMultiplier: 12,
  bloomStrength: 5.4,
  bloomRadius: 0.55,
  bloomThreshold: 0.72
});

export class SolarSystemApplication {
  [key: string]: any;

  constructor(options: any = {}) {
    this.canvasId = options.canvasId || "scene";
    this.document = options.document || document;
    this.hostWindow = options.window || this.document.defaultView;
    this.constants = options.constants || namespace.constants;
    this.sceneDataApi = options.data || namespace.data;
    this.data = this.sceneDataApi;
    this.math = options.math || namespace.math;
    this.THREE = options.THREE || RuntimeThree;

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
    const viewportWidth =
      this.hostWindow?.innerWidth ||
      this.document.documentElement?.clientWidth ||
      this.canvas?.clientWidth ||
      1;
    const viewportHeight =
      this.hostWindow?.innerHeight ||
      this.document.documentElement?.clientHeight ||
      this.canvas?.clientHeight ||
      1;

    return {
      width: Math.max(1, viewportWidth),
      height: Math.max(1, viewportHeight)
    };
  }

  getPixelRatio() {
    return Math.min(this.hostWindow?.devicePixelRatio || 1, 2);
  }

  createCanvas() {
    const canvas = this.document.getElementById(this.canvasId);
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

  initializeState() {
    this.sceneData = this.sceneDataApi.createSceneData();
    this.state = new AppState();
  }

  initializeLabelsLayer() {
    this.labelsLayer = new LabelsLayer();
    this.labelsLayerElement = this.labelsLayer.createLayer();
  }

  initializeRuntimeCollections() {
    this.sceneRuntime = new SceneRuntimeSystem({
      scene: this.scene,
      constants: this.constants,
      math: this.math,
      bodyRenderer: this.bodyRenderer,
      orbitRenderer: this.orbitRenderer,
      particleRenderer: this.particleRenderer,
      guideRenderer: this.guideRenderer,
      postprocessingRenderer: this.postprocessingRenderer,
      THREE: this.THREE
    }).initialize();
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
    this.runtimeVisibility = new RuntimeVisibilityService({ state: this.state });
    this.visibilityService = new VisibilityService({
      state: this.state,
      visibilityRuntimes: this.sceneRuntime.visibilityRuntimes,
      runtimeVisibility: this.runtimeVisibility
    });
  }

  buildSceneContents() {
    this.sceneRuntime.build(this.sceneData);
  }

  initializeHud() {
    this.hudController = new HudController({
      state: this.state,
      controls: this.controls,
      orbitGroup: this.sceneRuntime.orbitGroup,
      visibilityRuntimes: this.sceneRuntime.visibilityRuntimes,
      camera: this.camera,
      math: this.math,
      onOrbitVisibilityChanged: this.orbitRenderer.applyOrbitVisibility.bind(this.orbitRenderer),
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
      sceneObjectRuntimes: this.sceneRuntime.sceneObjectRuntimes,
      state: this.state,
      projectionScratch: new THREE.Vector3(),
      runtimeVisibility: this.runtimeVisibility,
      THREE: this.THREE
    });
  }

  registerEvents() {
    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.hostWindow?.addEventListener("pointerup", this.handlePointerUp);
    this.hostWindow?.addEventListener("resize", this.handleResize);
    this.controls.addEventListener("change", this.handleControlsChange);
  }

  renderScene() {
    if (!this.renderer || !this.camera) {
      return;
    }

    this.orbitRenderer.applyOrbitVisibility(this.state, this.sceneRuntime.orbitGroup);
    this.visibilityService.apply();
    this.particleRenderer.updateAsteroidBeltVisuals(this.sceneRuntime.beltRuntimes, this.camera);
    this.labelProjectionService.update();
    this.postprocessingRenderer.render();
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    this.assertThreeDependencies();

    this.createCanvas();
    this.initializeState();

    this.renderer = this.createRenderer();
    this.scene = this.createScene();
    this.camera = this.createCamera();
    this.postprocessingRenderer = this.createPostprocessingRenderer();
    this.controls = this.createControls();

    this.initializeLabelsLayer();
    this.initializeRenderers();
    this.initializeRuntimeCollections();
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
    if (!this.initialized && !this.renderer) {
      return;
    }

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
    this.hostWindow?.removeEventListener("resize", this.handleResize);
    this.hostWindow?.removeEventListener("pointerup", this.handlePointerUp);
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
