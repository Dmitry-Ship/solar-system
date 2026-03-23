import type {
  Camera,
  Color,
  Group,
  Material,
  Object3D,
  PerspectiveCamera,
  Points,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Texture,
  Vector2,
  Vector3,
  WebGLRenderTarget,
  WebGLRenderer
} from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

type ThreeModule = typeof import("three");

export interface Point3 {
  x: number;
  y: number;
  z: number;
}

export interface OrbitPlanePoint {
  x: number;
  z: number;
}

export interface SimulationConstants {
  SCENE_OUTER_AU: number;
  SOLAR_GRAVITATIONAL_LENS_AU: number;
  SUN_RADIUS_KM: number;
  KM_PER_AU: number;
}

export interface OrbitingBodyDefinition {
  name: string;
  au: number;
  radiusKm: number;
  color: string;
  inclinationDeg: number;
  nodeDeg: number;
  periapsisArgDeg: number;
  eccentricity: number;
  minPixelRadius?: number;
  orbitColor?: string;
}

export interface OrbitingBody extends OrbitingBodyDefinition {
  theta: number;
  inclination: number;
  node: number;
  periapsisArg: number;
  orbitRadius: number;
  renderRadius: number;
  orbitColor: string;
  orbitOpacity: number;
  orbitPath: Point3[];
}

export interface VoyagerDefinition {
  name: string;
  color: string;
  position: Point3;
  minPixelRadius: number;
  radiusKm: number;
}

export interface VoyagerSceneBody extends VoyagerDefinition {
  renderRadius: number;
}

export interface DriftingBodyDefinition {
  name: string;
  color: string;
  radiusKm: number;
  startAu?: number;
  minPixelRadius?: number;
  position?: Point3;
}

export interface DriftingBody extends DriftingBodyDefinition, Point3 {
  renderRadius: number;
}

export interface DirectionalMarkerDefinition {
  name: string;
  label: string;
  color: string;
  raHours: number;
  decDeg: number;
  minPixelRadius: number;
}

export interface DirectionalMarker extends Point3 {
  name: string;
  label: string;
  color: string;
  minPixelRadius: number;
}

export interface TrajectoryDefinition {
  name: string;
  label: string;
  visibilityLabel?: string;
  visibilityControlLabel?: string;
  launchMarkerName: string;
  approachMarkerName?: string;
  firstFocalMarkerName: string;
  secondFocalMarkerName: string;
  solarAssistRadiusAu?: number;
  solarFlybyPeriapsisDirection?: Point3;
  firstFocalBranchStartDistanceAu?: number;
  firstFocalBranchJoinDistanceAu?: number;
  firstFocalBranchEndDistanceAu?: number;
  color?: string;
}

export type OrbitRenderGroupKey = "planets" | "dwarfPlanets" | "comets";
export type GuideRenderStyle = "line" | "lightRay";
export type LightRayVisibilityKey = `light-ray:${string}`;
export type TrajectoryVisibilityKey = `trajectory:${string}`;
export type VisibilityKey =
  | LightRayVisibilityKey
  | TrajectoryVisibilityKey
  | (string & {});
export type VisibilityGroupKey =
  | "light-rays"
  | "trajectories"
  | "visibility"
  | (string & {});

export interface OrbitRenderGroupConfig {
  key: OrbitRenderGroupKey;
  segments: number;
  orbitColor?: string;
}

export interface AsteroidBeltConfig {
  name: string;
  innerAu: number;
  outerAu: number;
  maxInclinationDeg: number;
  eccentricityMin: number;
  eccentricityMax: number;
  count: number;
  color: string;
  alpha: number;
  particleSize?: number;
  opacityScale?: number;
  maxOpacity?: number;
  minOpacityFactor?: number;
  fadeStartAngularRadius?: number;
  fadeEndAngularRadius?: number;
}

export interface AsteroidBelt extends AsteroidBeltConfig {
  particleCount: number;
  positions: Float32Array;
}

export interface StarField {
  count: number;
  positions: Float32Array;
}

export interface VisibilityDescriptor {
  visibilityKey?: VisibilityKey;
  visibilityLabel?: string;
  visibilityControlLabel?: string;
  visibilityGroupKey?: VisibilityGroupKey;
  visibilityGroupLabel?: string;
  initialVisibility?: boolean;
}

export interface DirectionalGuideLine extends VisibilityDescriptor {
  points: Point3[];
  color: string;
  renderStyle: GuideRenderStyle;
  opacity: number;
  lightRayRadiusAu: number;
  lightRayStartRadiusAu: number;
  lightRayEndRadiusAu: number;
  lightRayRadiusProfileAu: number[];
  lightRayOpacityProfile: number[];
  lightRayLayerIndex: number;
  dashPattern: number[];
  depthTest?: boolean;
  label: string;
  labelAnchorPoint: Point3 | null;
  labelMarginPixels?: number;
}

export interface MathApi {
  clamp(value: number, min: number, max: number): number;
  degToRad(deg: number): number;
  equatorialToEcliptic(vector: Point3, obliquityDeg?: number): Point3;
  hyperbolicBranchPoints(
    startDirection: Point3,
    endDirection: Point3,
    periapsisDistance: number,
    endpointDistance: number,
    segments: number,
    preferredPeriapsisDirection?: Point3
  ): Point3[];
  normalizeAngle(value: number): number;
  normalizeVector(vector: Point3): Point3;
  orbitPlanePointInto(
    out: OrbitPlanePoint,
    semiMajorAxis: number,
    angle: number,
    eccentricity?: number,
    angleIsEccentricAnomaly?: boolean
  ): OrbitPlanePoint;
  orbitPoints(
    semiMajorAxis: number,
    inclination: number,
    node: number,
    segments: number,
    eccentricity?: number,
    periapsisArg?: number
  ): Point3[];
  orbitalPositionInto(
    out: Point3,
    semiMajorAxis: number,
    theta: number,
    inclination: number,
    node: number,
    height?: number,
    eccentricity?: number,
    periapsisArg?: number
  ): Point3;
  pointOnRadiusAlongDirection(directionSource: Point3, radius: number): Point3;
  randomUnitVector3D(random?: () => number): Point3;
  rotateOrbitFrame(
    x: number,
    z: number,
    inclination: number,
    node: number,
    periapsisArg: number,
    height?: number
  ): Point3;
  rotateOrbitFrameInto(
    out: Point3,
    x: number,
    z: number,
    inclination: number,
    node: number,
    periapsisArg: number,
    height?: number
  ): Point3;
  solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number;
  unitVectorFromEquatorialRaDec(raHours: number, decDeg: number): Point3;
}

export interface SceneData {
  planets: OrbitingBody[];
  dwarfPlanets: OrbitingBody[];
  comets: OrbitingBody[];
  orbitRenderGroupConfigs: OrbitRenderGroupConfig[];
  orbitRenderGroups: OrbitRenderGroupConfig[];
  voyagers: VoyagerSceneBody[];
  driftingBodies: DriftingBody[];
  directionalMarkers: DirectionalMarker[];
  directionalGuideLines: DirectionalGuideLine[];
  asteroidBelts: AsteroidBelt[];
  stars: StarField;
}

export interface SceneDataApi {
  createSceneData(): SceneData;
}

export interface VisibilityRuntime extends VisibilityDescriptor {
  defaultVisible?: boolean;
  visibilityTarget?: { visible: boolean } | null;
  object?: Object3D | null;
  mesh?: Object3D | null;
}

export interface VisibilityStateLike {
  minCamera: number;
  maxCamera: number;
  showBodyNames: boolean;
  showOrbits: boolean;
  registerVisibility(
    key: VisibilityKey,
    initialVisibility?: boolean,
    groupKey?: VisibilityGroupKey
  ): void;
  toggleVisibility(key: VisibilityKey, fallbackVisibility?: boolean): boolean;
  isVisibilityEnabled(key: VisibilityKey, fallbackVisibility?: boolean): boolean;
}

export interface SceneObjectRuntime extends VisibilityRuntime {
  mesh: Object3D;
  labelElement: HTMLDivElement | null;
  renderRadius: number;
  minPixelRadius: number;
  orbitingBody?: OrbitingBody | null;
  orbitalSource?: OrbitingBody | null;
  togglesWithNamesButton?: boolean;
  togglesWithVisibilityControl?: boolean;
  labelAnchorPosition: Vector3 | null;
  labelAnchorRadius: number;
  labelMarginPixels: number;
}

export interface GuideRuntime extends VisibilityRuntime {
  object: Object3D;
}

export interface BeltRuntime {
  belt: AsteroidBelt;
  points: Points;
  innerAu: number;
  outerAu: number;
  baseOpacity: number;
  minOpacityFactor: number;
  fadeStartAngularRadius: number;
  fadeEndAngularRadius: number;
}

export interface BodyRenderConfig {
  name: string;
  label?: string;
  color: string;
  renderRadius: number;
  minPixelRadius?: number;
  objectType?: string;
  fixedPosition?: Point3;
  lit?: boolean;
  emissive?: boolean;
  orbitingBody?: OrbitingBody | null;
  orbitalSource?: OrbitingBody | null;
  togglesWithNamesButton?: boolean;
  labelAnchorPosition?: Point3;
  labelAnchorRadius?: number;
  labelMarginPixels?: number;
}

export interface ComposerLike {
  renderToScreen: boolean;
  renderTarget2: { texture: Texture };
  addPass(pass: object): void;
  render(): void;
  setSize(width: number, height: number): void;
  setPixelRatio?(pixelRatio: number): void;
}

export interface ShaderPassLike {
  needsSwap: boolean;
}

export interface RuntimeThreeModule extends ThreeModule {
  OrbitControls: new (object: Camera, domElement?: HTMLElement) => OrbitControls;
  Pass: new (...args: unknown[]) => object;
  RenderPass: new (
    scene: Scene,
    camera: Camera,
    overrideMaterial?: Material | null,
    clearColor?: Color | null,
    clearAlpha?: number | null
  ) => object;
  ShaderPass: new (shader: ShaderMaterial, textureId?: string) => ShaderPassLike;
  EffectComposer: new (
    renderer: WebGLRenderer,
    renderTarget?: WebGLRenderTarget
  ) => ComposerLike;
  UnrealBloomPass: new (
    resolution: Vector2,
    strength: number,
    radius: number,
    threshold: number
  ) => object;
  CopyShader: Record<string, unknown>;
  LuminosityHighPassShader: Record<string, unknown>;
}

export interface PostprocessingConfig {
  renderer: WebGLRenderer;
  scene: Scene;
  camera: PerspectiveCamera;
  width: number;
  height: number;
  bloomStrength: number;
  bloomRadius: number;
  bloomThreshold: number;
  THREE?: RuntimeThreeModule;
}

export interface SceneRuntimeSnapshot {
  orbitGroup: Group;
  guideLineGroup: Group;
  particleGroup: Group;
  bodyGroup: Group;
  bodyGeometry: SphereGeometry;
  sceneObjectRuntimes: SceneObjectRuntime[];
  guideRuntimes: GuideRuntime[];
  visibilityRuntimes: VisibilityRuntime[];
  beltRuntimes: BeltRuntime[];
  orbitingBodies: OrbitingBody[];
}
