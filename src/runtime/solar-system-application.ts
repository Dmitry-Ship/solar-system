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

const RUNTIME_RENDER_CONFIG = {
  backgroundColor: "#000000",
  nearClip: 0.08,
  cameraFarDistanceMultiplier: 12,
  sceneFarClipPaddingMultiplier: 1.2,
  bloomStrength: 1.0,
  bloomRadius: 0.7,
  bloomThreshold: 0.4
};

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
  private camera: PerspectiveCamera | null = null;
  private controls: OrbitControls | null = null;
  private orbitRenderer: OrbitRenderer | null = null;
  private particleRenderer: ParticleRenderer | null = null;
  private postprocessingRenderer: PostprocessingRenderer | null = null;
  private sceneRuntime: SceneRuntimeSystem | null = null;
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

    this.canvasId = options.canvasId ?? "scene";
    this.document = options.document ?? document;
    this.hostWindow = options.window ?? this.document.defaultView;
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
    const { documentElement } = this.document;
    const viewportWidth = this.hostWindow?.innerWidth ?? documentElement.clientWidth;
    const viewportHeight = this.hostWindow?.innerHeight ?? documentElement.clientHeight;

    return {
      width: Math.max(1, viewportWidth),
      height: Math.max(1, viewportHeight)
    };
  }

  getPixelRatio(): number {
    return Math.min(this.hostWindow?.devicePixelRatio ?? 1, 2);
  }

  createCanvas(): HTMLCanvasElement {
    const canvas = this.document.getElementById(this.canvasId);
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error(`Expected canvas element with id "${this.canvasId}".`);
    }

    this.canvas = canvas;
    return canvas;
  }

  createRenderer(canvas: HTMLCanvasElement): WebGLRenderer {
    const { THREE } = this;
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

  resolveSceneFarClipDistance(sceneData: SceneData): number {
    const defaultFarDistance =
      this.constants.SCENE_OUTER_AU * RUNTIME_RENDER_CONFIG.cameraFarDistanceMultiplier;
    let maxSceneDistanceAu = this.constants.SCENE_OUTER_AU;
    const updateMaxDistance = (x: number, y: number, z: number) => {
      maxSceneDistanceAu = Math.max(maxSceneDistanceAu, Math.hypot(x, y, z));
    };

    for (const marker of sceneData.directionalMarkers) {
      updateMaxDistance(marker.x, marker.y, marker.z);
    }

    for (const guideLine of sceneData.directionalGuideLines) {
      for (const point of guideLine.points) {
        updateMaxDistance(point.x, point.y, point.z);
      }
    }

    const starPositions = sceneData.stars.positions;
    for (let index = 0; index < starPositions.length; index += 3) {
      updateMaxDistance(starPositions[index], starPositions[index + 1], starPositions[index + 2]);
    }

    return Math.max(
      defaultFarDistance,
      maxSceneDistanceAu * RUNTIME_RENDER_CONFIG.sceneFarClipPaddingMultiplier
    );
  }

  createCamera(sceneData: SceneData): PerspectiveCamera {
    const { THREE } = this;
    const { width, height } = this.getViewportSize();
    return new THREE.PerspectiveCamera(
      48,
      width / height,
      RUNTIME_RENDER_CONFIG.nearClip,
      this.resolveSceneFarClipDistance(sceneData)
    );
  }

  createPostprocessingRenderer(
    renderer: WebGLRenderer,
    scene: Scene,
    camera: PerspectiveCamera
  ): PostprocessingRenderer {
    const { width, height } = this.getViewportSize();
    return new PostprocessingRenderer({
      renderer,
      scene,
      camera,
      width,
      height,
      bloomStrength: RUNTIME_RENDER_CONFIG.bloomStrength,
      bloomRadius: RUNTIME_RENDER_CONFIG.bloomRadius,
      bloomThreshold: RUNTIME_RENDER_CONFIG.bloomThreshold
    });
  }

  createControls(
    camera: PerspectiveCamera,
    renderer: WebGLRenderer,
    state: AppState
  ): OrbitControls {
    const { THREE } = this;
    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = false;
    controls.enablePan = false;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.1;
    controls.minDistance = state.minCamera;
    controls.maxDistance = state.maxCamera;
    controls.target.set(0, 0, 0);
    return controls;
  }

  initializeState(): { sceneData: SceneData; state: AppState } {
    const sceneData = this.data.createSceneData();
    const state = new AppState();
    this.sceneData = sceneData;
    this.state = state;
    return { sceneData, state };
  }

  initializeLabelsLayer(): LabelsLayer {
    const labelsLayer = new LabelsLayer();
    this.labelsLayerElement = labelsLayer.createLayer();
    return labelsLayer;
  }

  initializeRuntimeCollections(options: {
    scene: Scene;
    bodyRenderer: BodyRenderer;
    orbitRenderer: OrbitRenderer;
    particleRenderer: ParticleRenderer;
    guideRenderer: GuideRenderer;
    postprocessingRenderer: PostprocessingRenderer;
  }): SceneRuntimeSystem {
    const sceneRuntime = new SceneRuntimeSystem({
      scene: options.scene,
      constants: this.constants,
      math: this.math,
      bodyRenderer: options.bodyRenderer,
      orbitRenderer: options.orbitRenderer,
      particleRenderer: options.particleRenderer,
      guideRenderer: options.guideRenderer,
      postprocessingRenderer: options.postprocessingRenderer,
      THREE: this.THREE
    });
    this.sceneRuntime = sceneRuntime;
    return sceneRuntime;
  }

  initializeRenderers(labelsLayer: LabelsLayer): {
    bodyRenderer: BodyRenderer;
    orbitRenderer: OrbitRenderer;
    particleRenderer: ParticleRenderer;
    guideRenderer: GuideRenderer;
  } {
    const bodyRenderer = new BodyRenderer({
      labelsLayer,
      THREE: this.THREE
    });
    const orbitRenderer = new OrbitRenderer({
      bodyRenderer,
      THREE: this.THREE
    });
    const particleRenderer = new ParticleRenderer({ THREE: this.THREE });
    const guideRenderer = new GuideRenderer({
      labelsLayer,
      THREE: this.THREE
    });
    this.orbitRenderer = orbitRenderer;
    this.particleRenderer = particleRenderer;

    return {
      bodyRenderer,
      orbitRenderer,
      particleRenderer,
      guideRenderer
    };
  }

  initializeVisibilityService(
    state: AppState,
    sceneRuntime: SceneRuntimeSystem
  ): { runtimeVisibility: RuntimeVisibilityService; visibilityService: VisibilityService } {
    const runtimeVisibility = new RuntimeVisibilityService({ state });
    const visibilityService = new VisibilityService({
      visibilityRuntimes: sceneRuntime.visibilityRuntimes,
      runtimeVisibility
    });
    this.visibilityService = visibilityService;
    return { runtimeVisibility, visibilityService };
  }

  buildSceneContents(sceneRuntime: SceneRuntimeSystem, sceneData: SceneData): void {
    sceneRuntime.build(sceneData);
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

    return {
      x: orbitingBody.position.x,
      y: orbitingBody.position.y,
      z: orbitingBody.position.z
    };
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

  initializeHud(options: {
    state: AppState;
    controls: OrbitControls;
    sceneRuntime: SceneRuntimeSystem;
    camera: PerspectiveCamera;
    orbitRenderer: OrbitRenderer;
    visibilityService: VisibilityService;
  }): HudHandle {
    const hud = new HudController({
      state: options.state,
      controls: options.controls,
      orbitGroup: options.sceneRuntime.orbitGroup,
      visibilityRuntimes: options.sceneRuntime.visibilityRuntimes,
      camera: options.camera,
      math: this.math,
      onOrbitVisibilityChanged: options.orbitRenderer.applyOrbitVisibility.bind(
        options.orbitRenderer
      ),
      onVisibilityChanged: options.visibilityService.apply.bind(options.visibilityService),
      resolvePovTarget: this.resolvePovTarget.bind(this),
      requestRender: this.renderScene.bind(this)
    }).setup();
    this.hud = hud;
    return hud;
  }

  initializeCameraPlacement(
    camera: PerspectiveCamera,
    controls: OrbitControls,
    state: AppState
  ): void {
    setInitialCameraPlacement({
      camera,
      controls,
      state,
      constants: this.constants,
      math: this.math
    });
  }

  initializeViewServices(
    renderer: WebGLRenderer,
    camera: PerspectiveCamera,
    sceneRuntime: SceneRuntimeSystem,
    state: AppState,
    runtimeVisibility: RuntimeVisibilityService
  ): LabelProjectionService {
    const { THREE } = this;
    const labelProjectionService = new LabelProjectionService({
      renderer,
      camera,
      sceneObjectRuntimes: sceneRuntime.sceneObjectRuntimes,
      state,
      projectionScratch: new THREE.Vector3(),
      runtimeVisibility
    });
    this.labelProjectionService = labelProjectionService;
    return labelProjectionService;
  }

  registerEvents(canvas: HTMLCanvasElement, controls: OrbitControls): void {
    canvas.addEventListener("pointerdown", this.handlePointerDown);
    this.hostWindow?.addEventListener("pointerup", this.handlePointerUp);
    this.hostWindow?.addEventListener("resize", this.handleResize);
    controls.addEventListener("change", this.handleControlsChange);
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
    const canvas = this.createCanvas();
    const { sceneData, state } = this.initializeState();
    const renderer = this.createRenderer(canvas);
    const scene = this.createScene();
    const camera = this.createCamera(sceneData);
    const postprocessingRenderer = this.createPostprocessingRenderer(renderer, scene, camera);
    const controls = this.createControls(camera, renderer, state);
    const labelsLayer = this.initializeLabelsLayer();
    const { bodyRenderer, orbitRenderer, particleRenderer, guideRenderer } =
      this.initializeRenderers(labelsLayer);
    const sceneRuntime = this.initializeRuntimeCollections({
      scene,
      bodyRenderer,
      orbitRenderer,
      particleRenderer,
      guideRenderer,
      postprocessingRenderer
    });
    this.buildSceneContents(sceneRuntime, sceneData);
    const { runtimeVisibility, visibilityService } = this.initializeVisibilityService(
      state,
      sceneRuntime
    );
    this.initializeHud({
      state,
      controls,
      sceneRuntime,
      camera,
      orbitRenderer,
      visibilityService
    });
    this.initializeCameraPlacement(camera, controls, state);
    this.initializeViewServices(renderer, camera, sceneRuntime, state, runtimeVisibility);
    this.renderer = renderer;
    this.camera = camera;
    this.controls = controls;
    this.postprocessingRenderer = postprocessingRenderer;
    this.registerEvents(canvas, controls);

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
