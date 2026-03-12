import type { Group, SphereGeometry } from "three";
import { RuntimeThree } from "../../../runtime/three-globals";
import type { BodyRenderer } from "./body-renderer";
import type {
  MathApi,
  OrbitRenderGroupKey,
  OrbitingBody,
  Point3,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime,
  VisibilityStateLike
} from "../../../types/solar-system";

const NAMES_TOGGLE_TARGET_GROUPS = new Set<OrbitRenderGroupKey>([
  "planets",
  "dwarfPlanets",
  "comets"
]);
const LABEL_OBJECT_TYPE_BY_GROUP_KEY: Record<OrbitRenderGroupKey, string> = {
  planets: "planet",
  dwarfPlanets: "dwarf-planet",
  comets: "comet"
};

interface OrbitRendererOptions {
  bodyRenderer: BodyRenderer | null;
  THREE?: RuntimeThreeModule;
}

export class OrbitRenderer {
  private readonly bodyRenderer: BodyRenderer | null;
  private readonly THREE: RuntimeThreeModule;

  constructor(options: OrbitRendererOptions) {
    this.bodyRenderer = options.bodyRenderer;
    const THREE = options.THREE || RuntimeThree;
    if (!THREE) {
      throw new Error("OrbitRenderer: THREE is required.");
    }
    this.THREE = THREE;
  }

  buildOrbitLine(points: Point3[], color: string, opacity: number) {
    const { THREE } = this;
    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(points.length * 3);

    let offset = 0;
    for (const point of points) {
      positionArray[offset] = point.x;
      positionArray[offset + 1] = point.y;
      positionArray[offset + 2] = point.z;
      offset += 3;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity
    });

    return new THREE.Line(geometry, material);
  }

  buildOrbitingBodies(
    sceneData: SceneData,
    orbitGroup: Group,
    bodyGroup: Group,
    bodyGeometry: SphereGeometry,
    sceneObjectRuntimes: SceneObjectRuntime[],
    orbitingBodies: OrbitingBody[],
    math: MathApi
  ): void {
    if (!this.bodyRenderer) {
      throw new Error("OrbitRenderer: bodyRenderer is required for orbiting bodies.");
    }

    const orbitalPositionScratch = { x: 0, y: 0, z: 0 };
    const orbitRenderGroupConfigs = sceneData.orbitRenderGroupConfigs || sceneData.orbitRenderGroups;
    for (const orbitRenderGroup of orbitRenderGroupConfigs) {
      const orbitingBodiesInGroup = sceneData[orbitRenderGroup.key] || [];
      for (const orbitingBody of orbitingBodiesInGroup) {
        const orbitLine = this.buildOrbitLine(
          orbitingBody.orbitPath,
          orbitingBody.orbitColor,
          orbitingBody.orbitOpacity
        );
        orbitGroup.add(orbitLine);

        const fallbackMinPixelRadius = orbitRenderGroup.key === "planets" ? 1.25 : 1.1;
        const runtime = this.bodyRenderer.createBodyRuntime(
          {
            name: orbitingBody.name,
            color: orbitingBody.color,
            renderRadius: orbitingBody.renderRadius,
            minPixelRadius: orbitingBody.minPixelRadius || fallbackMinPixelRadius,
            orbitingBody,
            objectType: LABEL_OBJECT_TYPE_BY_GROUP_KEY[orbitRenderGroup.key],
            togglesWithNamesButton: NAMES_TOGGLE_TARGET_GROUPS.has(orbitRenderGroup.key)
          },
          bodyGroup,
          bodyGeometry
        );

        math.orbitalPositionInto(
          orbitalPositionScratch,
          orbitingBody.orbitRadius,
          orbitingBody.theta,
          orbitingBody.inclination,
          orbitingBody.node,
          0,
          orbitingBody.eccentricity,
          orbitingBody.periapsisArg
        );

        runtime.mesh.position.set(
          orbitalPositionScratch.x,
          orbitalPositionScratch.y,
          orbitalPositionScratch.z
        );

        sceneObjectRuntimes.push(runtime);
        orbitingBodies.push(orbitingBody);
      }
    }
  }

  applyOrbitVisibility(state: Pick<VisibilityStateLike, "showOrbits">, orbitGroup: Group | null): void {
    if (!orbitGroup) return;
    orbitGroup.visible = state.showOrbits;
  }
}
