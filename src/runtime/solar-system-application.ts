import type { PerspectiveCamera, Scene, WebGLRenderer } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { AppState } from "../application/state/app-state";
import { SceneRuntimeSystem } from "../application/systems/scene-runtime-system";
import { VisibilityService } from "../application/services/visibility-service";
import { LabelProjectionService } from "../application/services/label-projection-service";
import { RuntimeVisibilityService } from "../application/services/runtime-visibility-service";
import { LabelsLayer } from "../infrastructure/dom/labels-layer";
import {
  HudController,
  type HudHandle,
  type HudSnapshot,
  type HudSubscriber
} from "../infrastructure/dom/hud-controller";
import { BodyRenderer } from "../infrastructure/three/renderers/body-renderer";
import { OrbitRenderer } from "../infrastructure/three/renderers/orbit-renderer";
import { ParticleRenderer } from "../infrastructure/three/renderers/particle-renderer";
import { GuideRenderer } from "../infrastructure/three/renderers/guide-renderer";
import { PostprocessingRenderer } from "../infrastructure/three/renderers/postprocessing-renderer";
import { setInitialCameraPlacement } from "../infrastructure/three/controllers/camera-controller";
import { constants as defaultConstants, data as defaultData, math as defaultMath } from "./public-api";
import { RuntimeThree } from "./three-globals";
import type {
  MathApi,
  Point3,
  PovTargetKey,
  RuntimeThreeModule,
  SceneData,
  SceneDataApi,
  SimulationConstants
} from "../types/solar-system";

const RUNTIME_RENDER_CONFIG = Object.freeze({
  backgroundColor: "#000000",
  nearClip: 0.08,
  cameraFarDistanceMultiplier: 12,
  sceneFarClipPaddingMultiplier: 1.2,
  bloomStrength: 1.0,
  bloomRadius: 0.7,
  bloomThreshold: 0.4
});

interface SolarSystemApplicationOptions {
  canvasId?: string;
  document?: Document;
  window?: Window | null;
  constants?: SimulationConstants;
  data?: SceneDataApi;
  math?: MathApi;
  THREE?: RuntimeThreeModule;
}

export class SolarSystemApplication {
  readonly data: SceneDataApi;
  private readonly canvasId: string;
  private readonly document: Document;
  private readonly hostWindow: Window | null;
  private readonly constants: SimulationConstants;
  private readonly math: MathApi;
  private readonly THREE: RuntimeThreeModule;
  private initialized = false;
  private canvas: HTMLCanvasElement | null = null;
  private labelsLayerElement: HTMLDivElement | null = null;
  private sceneData: SceneData | null = null;
  private state: AppState | null = null;
  private renderer: WebGLRenderer | null = null;
  private scene: Scene | null = null;
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private labelsLayer: LabelsLayer | null = null;
  private bodyRenderer: BodyRenderer | null = null;
  private orbitRenderer: OrbitRenderer | null = null;
  private particleRenderer: ParticleRenderer | null = null;
  private guideRenderer: GuideRenderer | null = null;
  private postprocessingRenderer: PostprocessingRenderer | null = null;
  private sceneRuntime: SceneRuntimeSystem | null = null;
  private runtimeVisibility: RuntimeVisibilityService | null = null;
  private visibilityService: VisibilityService | null = null;
  private hud: HudHandle | null = null;
  private labelProjectionService: LabelProjectionService | null = null;
  private readonly handleResize: () => void;
  private readonly handleControlsChange: () => void;
  private readonly handlePointerDown: () => void;
  private readonly handlePointerUp: () => void;

  constructor(options: SolarSystemApplicationOptions = {}) {
    const constants = options.constants ?? defaultConstants;
    const data = options.data ?? defaultData;
    const math = options.math ?? defaultMath;
    const THREE = options.THREE ?? RuntimeThree;

    this.canvasId = options.canvasId || "scene";
    this.document = options.document || document;
    this.hostWindow = options.window || this.document.defaultView;
    this.constants = constants;
    this.data = data;
    this.math = math;
    this.THREE = THREE;

    this.handleResize = this.resize.bind(this);
    this.handleControlsChange = this.onControlsChange.bind(this);
    this.handlePointerDown = this.onPointerDown.bind(this);
    this.handlePointerUp = this.onPointerUp.bind(this);
  }

  assertThreeDependencies(): void {
    const { THREE } = this;
    if (
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

  getViewportSize(): { width: number; height: number } {
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

  getPixelRatio(): number {
    return Math.min(this.hostWindow?.devicePixelRatio || 1, 2);
  }

  createCanvas(): HTMLCanvasElement {
    const canvas = this.document.getElementById(this.canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`Expected canvas element with id "${this.canvasId}".`);
    }

    this.canvas = canvas;
    return canvas;
  }

  createRenderer(): WebGLRenderer {
    const { THREE } = this;
    const canvas = this.canvas;
    if (!canvas) {
      throw new Error("SolarSystemApplication: canvas must be created before renderer.");
    }

    const { width, height } = this.getViewportSize();
    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });

    renderer.setPixelRatio(this.getPixelRatio());
    renderer.setSize(width, height, false);
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else {
      const legacyEncoding =
        "sRGBEncoding" in THREE && typeof THREE.sRGBEncoding === "number"
          ? THREE.sRGBEncoding
          : undefined;
      if (legacyEncoding !== undefined) {
        (renderer as WebGLRenderer & { outputEncoding?: number }).outputEncoding = legacyEncoding;
      }
    }
    renderer.setClearColor(RUNTIME_RENDER_CONFIG.backgroundColor, 1);

    return renderer;
  }

  createScene(): Scene {
    const { THREE } = this;
    const scene = new THREE.Scene();
    scene.add(new THREE.AmbientLight("#ffffff", 0.5));
    scene.add(new THREE.PointLight("#ffd794", 2.5, 0, 0));
    return scene;
  }

  resolveSceneFarClipDistance(): number {
    const defaultFarDistance =
      this.constants.SCENE_OUTER_AU * RUNTIME_RENDER_CONFIG.cameraFarDistanceMultiplier;
    if (!this.sceneData) {
      return defaultFarDistance;
    }

    let maxSceneDistanceAu = this.constants.SCENE_OUTER_AU;
    const updateMaxDistance = (x: number, y: number, z: number) => {
      maxSceneDistanceAu = Math.max(maxSceneDistanceAu, Math.hypot(x, y, z));
    };

    for (const marker of this.sceneData.directionalMarkers) {
      updateMaxDistance(marker.x, marker.y, marker.z);
    }

    for (const guideLine of this.sceneData.directionalGuideLines) {
      for (const point of guideLine.points) {
        updateMaxDistance(point.x, point.y, point.z);
      }
    }

    const starPositions = this.sceneData.stars.positions;
    for (let index = 0; index < starPositions.length; index += 3) {
      updateMaxDistance(starPositions[index], starPositions[index + 1], starPositions[index + 2]);
    }

    return Math.max(
      defaultFarDistance,
      maxSceneDistanceAu * RUNTIME_RENDER_CONFIG.sceneFarClipPaddingMultiplier
    );
  }

  createCamera(): PerspectiveCamera {
    const { THREE } = this;
    const { width, height } = this.getViewportSize();
    return new THREE.PerspectiveCamera(
      48,
      width / height,
      RUNTIME_RENDER_CONFIG.nearClip,
      this.resolveSceneFarClipDistance()
    );
  }

  createPostprocessingRenderer(): PostprocessingRenderer {
    if (!this.renderer || !this.scene || !this.camera) {
      throw new Error("SolarSystemApplication: renderer, scene, and camera must exist.");
    }

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

  createControls(): OrbitControls {
    const { THREE } = this;
    if (!this.camera || !this.renderer || !this.state) {
      throw new Error("SolarSystemApplication: camera, renderer, and state must exist.");
    }

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

  initializeState(): void {
    this.sceneData = this.data.createSceneData();
    this.state = new AppState();
  }

  initializeLabelsLayer(): void {
    this.labelsLayer = new LabelsLayer();
    this.labelsLayerElement = this.labelsLayer.createLayer();
  }

  initializeRuntimeCollections(): void {
    if (
      !this.scene ||
      !this.bodyRenderer ||
      !this.orbitRenderer ||
      !this.particleRenderer ||
      !this.guideRenderer ||
      !this.postprocessingRenderer
    ) {
      throw new Error("SolarSystemApplication: renderers and scene must be initialized.");
    }

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

  initializeRenderers(): void {
    if (!this.labelsLayer) {
      throw new Error("SolarSystemApplication: labels layer must be initialized.");
    }

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

  initializeVisibilityService(): void {
    if (!this.state || !this.sceneRuntime) {
      throw new Error("SolarSystemApplication: state and runtime collections must exist.");
    }

    this.runtimeVisibility = new RuntimeVisibilityService({ state: this.state });
    this.visibilityService = new VisibilityService({
      state: this.state,
      visibilityRuntimes: this.sceneRuntime.visibilityRuntimes,
      runtimeVisibility: this.runtimeVisibility
    });
  }

  buildSceneContents(): void {
    if (!this.sceneRuntime || !this.sceneData) {
      throw new Error("SolarSystemApplication: scene runtime and scene data must exist.");
    }

    this.sceneRuntime.build(this.sceneData);
  }

  resolveOrbitingBodyPosition(bodyName: string): Point3 | null {
    const runtimePosition = this.sceneRuntime?.sceneObjectRuntimes.find(
      (runtime) => runtime.orbitingBody?.name === bodyName
    )?.mesh.position;
    if (runtimePosition) {
      return {
        x: runtimePosition.x,
        y: runtimePosition.y,
        z: runtimePosition.z
      };
    }

    const orbitingBody = this.sceneData?.planets.find((planet) => planet.name === bodyName);
    if (!orbitingBody) {
      return null;
    }

    return this.math.orbitalPositionInto(
      { x: 0, y: 0, z: 0 },
      orbitingBody.orbitRadius,
      orbitingBody.theta,
      orbitingBody.inclination,
      orbitingBody.node,
      0,
      orbitingBody.eccentricity,
      orbitingBody.periapsisArg
    );
  }

  resolvePovTarget(pov: PovTargetKey): Point3 | null {
    if (pov === "sun") {
      return { x: 0, y: 0, z: 0 };
    }

    if (pov === "earth") {
      return this.resolveOrbitingBodyPosition("Earth 🌎");
    }

    const marker = this.sceneData?.directionalMarkers.find(
      (directionalMarker) => directionalMarker.name === pov
    );
    return marker
      ? {
          x: marker.x,
          y: marker.y,
          z: marker.z
        }
      : null;
  }

  initializeHud(): void {
    if (
      !this.state ||
      !this.controls ||
      !this.sceneRuntime ||
      !this.camera ||
      !this.orbitRenderer ||
      !this.visibilityService
    ) {
      throw new Error("SolarSystemApplication: HUD dependencies are missing.");
    }

    this.hud = new HudController({
      state: this.state,
      controls: this.controls,
      orbitGroup: this.sceneRuntime.orbitGroup,
      visibilityRuntimes: this.sceneRuntime.visibilityRuntimes,
      camera: this.camera,
      math: this.math,
      onOrbitVisibilityChanged: this.orbitRenderer.applyOrbitVisibility.bind(this.orbitRenderer),
      onVisibilityChanged: this.visibilityService.apply.bind(this.visibilityService),
      resolvePovTarget: this.resolvePovTarget.bind(this),
      requestRender: this.renderScene.bind(this)
    }).setup();
  }

  initializeCameraPlacement(): void {
    if (!this.camera || !this.controls || !this.state) {
      throw new Error("SolarSystemApplication: camera placement dependencies are missing.");
    }

    setInitialCameraPlacement({
      camera: this.camera,
      controls: this.controls,
      state: this.state,
      constants: this.constants,
      math: this.math
    });
  }

  initializeViewServices(): void {
    const { THREE } = this;
    if (!this.renderer || !this.camera || !this.sceneRuntime || !this.state || !this.runtimeVisibility) {
      throw new Error("SolarSystemApplication: view service dependencies are missing.");
    }

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

  registerEvents(): void {
    if (!this.canvas || !this.controls) {
      throw new Error("SolarSystemApplication: canvas and controls must exist before events.");
    }

    this.canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.hostWindow?.addEventListener("pointerup", this.handlePointerUp);
    this.hostWindow?.addEventListener("resize", this.handleResize);
    this.controls.addEventListener("change", this.handleControlsChange);
  }

  renderScene(): void {
    if (
      !this.renderer ||
      !this.camera ||
      !this.sceneRuntime ||
      !this.orbitRenderer ||
      !this.visibilityService ||
      !this.particleRenderer ||
      !this.labelProjectionService ||
      !this.postprocessingRenderer ||
      !this.state
    ) {
      return;
    }

    this.orbitRenderer.applyOrbitVisibility(this.state, this.sceneRuntime.orbitGroup);
    this.visibilityService.apply();
    this.particleRenderer.updateAsteroidBeltVisuals(this.sceneRuntime.beltRuntimes, this.camera);
    this.labelProjectionService.update();
    this.postprocessingRenderer.render();
  }

  initialize(): void {
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

    this.initialized = true;
    this.resize();
  }

  onPointerDown(): void {
    this.canvas?.classList.add("dragging");
  }

  onPointerUp(): void {
    this.canvas?.classList.remove("dragging");
  }

  onControlsChange(): void {
    this.renderScene();
    this.hud?.updateZoomToggleLabel();
  }

  getHudSnapshot(): HudSnapshot | null {
    return this.hud?.getSnapshot() ?? null;
  }

  subscribeToHud(listener: HudSubscriber): () => void {
    return this.hud?.subscribe(listener) ?? (() => {});
  }

  toggleZoom(): void {
    this.hud?.toggleZoom();
  }

  toggleNames(): void {
    this.hud?.toggleNames();
  }

  toggleOrbits(): void {
    this.hud?.toggleOrbits();
  }

  toggleVisibility(key: Parameters<HudHandle["toggleVisibility"]>[0]): void {
    this.hud?.toggleVisibility(key);
  }

  setPov(pov: Parameters<HudHandle["setPov"]>[0]): void {
    this.hud?.setPov(pov);
  }

  resize(): void {
    if (
      !this.renderer ||
      !this.postprocessingRenderer ||
      !this.camera ||
      !this.controls ||
      !this.state
    ) {
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
    this.hud?.updateZoomToggleLabel();

    if (this.initialized) {
      this.renderScene();
    }
  }

  start(): void {
    if (!this.initialized) {
      this.initialize();
    }
    this.renderScene();
  }

  stop(): void {}

  dispose(): void {
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
    this.hud = null;
    this.initialized = false;
  }
}
