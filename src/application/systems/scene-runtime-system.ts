import type { Group, Scene, SphereGeometry } from "three";
import { RuntimeThree } from "../../runtime/three-globals";
import type {
  BeltRuntime,
  BodyRenderConfig,
  GuideRuntime,
  MathApi,
  OrbitingBody,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime,
  SimulationConstants,
  VisibilityRuntime
} from "../../types/solar-system";
import type { BodyRenderer } from "../../infrastructure/three/renderers/body-renderer";
import type { GuideRenderer } from "../../infrastructure/three/renderers/guide-renderer";
import type { OrbitRenderer } from "../../infrastructure/three/renderers/orbit-renderer";
import type { ParticleRenderer } from "../../infrastructure/three/renderers/particle-renderer";
import type { PostprocessingRenderer } from "../../infrastructure/three/renderers/postprocessing-renderer";

interface SceneRuntimeSystemOptions {
  scene: Scene;
  constants: SimulationConstants;
  math: MathApi;
  bodyRenderer: BodyRenderer;
  orbitRenderer: OrbitRenderer;
  particleRenderer: ParticleRenderer;
  guideRenderer: GuideRenderer;
  postprocessingRenderer: PostprocessingRenderer;
  THREE?: RuntimeThreeModule;
}

export class SceneRuntimeSystem {
  private readonly THREE: RuntimeThreeModule;
  private readonly constants: SimulationConstants;
  private readonly math: MathApi;
  private readonly bodyRenderer: BodyRenderer;
  private readonly orbitRenderer: OrbitRenderer;
  private readonly particleRenderer: ParticleRenderer;
  private readonly guideRenderer: GuideRenderer;
  private readonly postprocessingRenderer: PostprocessingRenderer;
  readonly orbitGroup: Group;
  readonly guideLineGroup: Group;
  readonly particleGroup: Group;
  readonly bodyGroup: Group;
  readonly bodyGeometry: SphereGeometry;
  readonly sceneObjectRuntimes: SceneObjectRuntime[] = [];
  readonly guideRuntimes: GuideRuntime[] = [];
  readonly visibilityRuntimes: VisibilityRuntime[] = [];
  readonly beltRuntimes: BeltRuntime[] = [];
  readonly orbitingBodies: OrbitingBody[] = [];

  constructor(options: SceneRuntimeSystemOptions) {
    this.THREE = options.THREE ?? RuntimeThree;
    this.constants = options.constants;
    this.math = options.math;
    this.bodyRenderer = options.bodyRenderer;
    this.orbitRenderer = options.orbitRenderer;
    this.particleRenderer = options.particleRenderer;
    this.guideRenderer = options.guideRenderer;
    this.postprocessingRenderer = options.postprocessingRenderer;

    this.orbitGroup = new this.THREE.Group();
    this.guideLineGroup = new this.THREE.Group();
    this.particleGroup = new this.THREE.Group();
    this.bodyGroup = new this.THREE.Group();
    options.scene.add(this.orbitGroup, this.guideLineGroup, this.particleGroup, this.bodyGroup);
    this.bodyGeometry = new this.THREE.SphereGeometry(1, 20, 12);
  }

  build(sceneData: SceneData): this {
    this.particleRenderer.buildStarField(sceneData, this.particleGroup);
    this.guideRenderer.buildGuideLines(
      sceneData,
      this.guideLineGroup,
      this.guideRuntimes,
      this.sceneObjectRuntimes,
      this.visibilityRuntimes
    );
    this.particleRenderer.buildAsteroidBelts(
      sceneData,
      this.particleGroup,
      this.beltRuntimes,
      this.math
    );
    this.orbitRenderer.buildOrbitingBodies(
      sceneData,
      this.orbitGroup,
      this.bodyGroup,
      this.bodyGeometry,
      this.sceneObjectRuntimes,
      this.orbitingBodies
    );
    this.bodyRenderer.buildFixedBodies(
      sceneData,
      this.bodyGroup,
      this.bodyGeometry,
      this.sceneObjectRuntimes
    );
    this.createSunRuntime();
    return this;
  }

  createSunRuntime(): void {
    const sunRuntime = this.bodyRenderer.createBodyRuntime(
      <BodyRenderConfig>{
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
}
