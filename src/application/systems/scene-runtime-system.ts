import { namespace } from "../../core/namespace";
import type { Group, Scene, SphereGeometry } from "three";
import type {
  BeltRuntime,
  BodyRenderConfig,
  GuideRuntime,
  MathApi,
  OrbitingBody,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime,
  SceneRuntimeSnapshot,
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
    private readonly scene: Scene;
    private readonly constants: SimulationConstants;
    private readonly math: MathApi;
    private readonly bodyRenderer: BodyRenderer;
    private readonly orbitRenderer: OrbitRenderer;
    private readonly particleRenderer: ParticleRenderer;
    private readonly guideRenderer: GuideRenderer;
    private readonly postprocessingRenderer: PostprocessingRenderer;
    orbitGroup: Group | null;
    guideLineGroup: Group | null;
    particleGroup: Group | null;
    bodyGroup: Group | null;
    bodyGeometry: SphereGeometry | null;
    sceneObjectRuntimes: SceneObjectRuntime[];
    guideRuntimes: GuideRuntime[];
    visibilityRuntimes: VisibilityRuntime[];
    beltRuntimes: BeltRuntime[];
    orbitingBodies: OrbitingBody[];

    constructor(options: SceneRuntimeSystemOptions) {
      const THREE = options.THREE || namespace.runtime.THREE;
      if (!THREE) {
        throw new Error("SceneRuntimeSystem: THREE is required.");
      }

      this.THREE = THREE;
      this.scene = options.scene;
      this.constants = options.constants;
      this.math = options.math;
      this.bodyRenderer = options.bodyRenderer;
      this.orbitRenderer = options.orbitRenderer;
      this.particleRenderer = options.particleRenderer;
      this.guideRenderer = options.guideRenderer;
      this.postprocessingRenderer = options.postprocessingRenderer;

      this.orbitGroup = null;
      this.guideLineGroup = null;
      this.particleGroup = null;
      this.bodyGroup = null;
      this.bodyGeometry = null;
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.visibilityRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];
    }

    createSceneGroups(): Pick<
      SceneRuntimeSnapshot,
      "orbitGroup" | "guideLineGroup" | "particleGroup" | "bodyGroup"
    > {
      const { THREE } = this;
      return {
        orbitGroup: new THREE.Group(),
        guideLineGroup: new THREE.Group(),
        particleGroup: new THREE.Group(),
        bodyGroup: new THREE.Group()
      };
    }

    initialize(): this {
      Object.assign(this, this.createSceneGroups());
      if (!this.orbitGroup || !this.guideLineGroup || !this.particleGroup || !this.bodyGroup) {
        throw new Error("SceneRuntimeSystem: failed to initialize scene groups.");
      }
      this.scene.add(this.orbitGroup);
      this.scene.add(this.guideLineGroup);
      this.scene.add(this.particleGroup);
      this.scene.add(this.bodyGroup);

      this.bodyGeometry = new this.THREE.SphereGeometry(1, 20, 12);
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.visibilityRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];
      return this;
    }

    build(sceneData: SceneData): this {
      if (!this.particleGroup || !this.guideLineGroup || !this.bodyGroup || !this.orbitGroup || !this.bodyGeometry) {
        throw new Error("SceneRuntimeSystem: initialize() must be called before build().");
      }
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
        this.orbitingBodies,
        this.math
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
      if (!this.bodyGroup || !this.bodyGeometry) {
        throw new Error("SceneRuntimeSystem: initialize() must be called before createSunRuntime().");
      }
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

namespace.application.systems.SceneRuntimeSystem = SceneRuntimeSystem;
