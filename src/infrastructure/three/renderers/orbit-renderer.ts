import type { Group, SphereGeometry } from "three";
import { RuntimeThree } from "../../../runtime/three-globals";
import type { BodyRenderer } from "./body-renderer";
import type {
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
const MIN_ORBIT_OPACITY_FACTOR = 0.06;

function squaredDistance(a: Point3, b: Point3): number {
  const dx = a.x - b.x;
  const dy = a.y - b.y;
  const dz = a.z - b.z;
  return dx * dx + dy * dy + dz * dz;
}

function buildOrbitOpacityProfile(
  points: Point3[],
  peakOpacity: number,
  orbitingBodyPosition?: Point3 | null
): Float32Array {
  const profile = new Float32Array(points.length);
  if (!points.length) {
    return profile;
  }

  const safePeakOpacity = Math.max(0, Math.min(1, peakOpacity));
  if (!orbitingBodyPosition || points.length <= 2) {
    profile.fill(safePeakOpacity);
    return profile;
  }

  const uniquePointCount = points.length > 1 ? points.length - 1 : points.length;
  let closestPointIndex = 0;
  let closestDistance = Number.POSITIVE_INFINITY;

  for (let index = 0; index < uniquePointCount; index += 1) {
    const candidateDistance = squaredDistance(points[index], orbitingBodyPosition);
    if (candidateDistance < closestDistance) {
      closestDistance = candidateDistance;
      closestPointIndex = index;
    }
  }

  const farthestPointDistance = Math.max(1, uniquePointCount * 0.5);
  for (let index = 0; index < uniquePointCount; index += 1) {
    const directDistance = Math.abs(index - closestPointIndex);
    const wrappedDistance = Math.min(directDistance, uniquePointCount - directDistance);
    const normalizedDistance = Math.min(1, wrappedDistance / farthestPointDistance);
    const opacityFactor =
      MIN_ORBIT_OPACITY_FACTOR +
      (1 - MIN_ORBIT_OPACITY_FACTOR) * (Math.cos(normalizedDistance * Math.PI) * 0.5 + 0.5);
    profile[index] = safePeakOpacity * opacityFactor;
  }

  if (points.length > uniquePointCount) {
    profile[points.length - 1] = profile[0];
  }

  return profile;
}

function createOrbitMaterial(THREE: RuntimeThreeModule, color: string) {
  return new THREE.ShaderMaterial({
    transparent: true,
    toneMapped: false,
    uniforms: {
      diffuse: { value: new THREE.Color(color) }
    },
    vertexShader: `
      attribute float vertexOpacity;
      varying float vVertexOpacity;

      void main() {
        vVertexOpacity = vertexOpacity;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 diffuse;
      varying float vVertexOpacity;

      void main() {
        if (vVertexOpacity <= 0.0) {
          discard;
        }

        gl_FragColor = vec4(diffuse, vVertexOpacity);
      }
    `
  });
}

interface OrbitRendererOptions {
  bodyRenderer: BodyRenderer;
  THREE?: RuntimeThreeModule;
}

export class OrbitRenderer {
  private readonly bodyRenderer: BodyRenderer;
  private readonly THREE: RuntimeThreeModule;

  constructor(options: OrbitRendererOptions) {
    this.bodyRenderer = options.bodyRenderer;
    this.THREE = options.THREE ?? RuntimeThree;
  }

  static buildOrbitLine(
    THREE: RuntimeThreeModule,
    points: Point3[],
    color: string,
    opacity: number,
    orbitingBodyPosition?: Point3 | null
  ) {
    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(points.length * 3);
    const opacityArray = buildOrbitOpacityProfile(points, opacity, orbitingBodyPosition);

    let offset = 0;
    for (const point of points) {
      positionArray[offset] = point.x;
      positionArray[offset + 1] = point.y;
      positionArray[offset + 2] = point.z;
      offset += 3;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
    geometry.setAttribute("vertexOpacity", new THREE.BufferAttribute(opacityArray, 1));
    const material = createOrbitMaterial(THREE, color);

    return new THREE.Line(geometry, material);
  }

  buildOrbitLine(
    points: Point3[],
    color: string,
    opacity: number,
    orbitingBodyPosition?: Point3 | null
  ) {
    return OrbitRenderer.buildOrbitLine(
      this.THREE,
      points,
      color,
      opacity,
      orbitingBodyPosition
    );
  }

  buildOrbitingBodies(
    sceneData: SceneData,
    orbitGroup: Group,
    bodyGroup: Group,
    bodyGeometry: SphereGeometry,
    sceneObjectRuntimes: SceneObjectRuntime[],
    orbitingBodies: OrbitingBody[]
  ): void {
    for (const orbitRenderGroup of sceneData.orbitGroups) {
      const orbitingBodiesInGroup = sceneData[orbitRenderGroup.key];
      for (const orbitingBody of orbitingBodiesInGroup) {
        const orbitLine = this.buildOrbitLine(
          orbitingBody.orbit.path,
          orbitingBody.orbit.color,
          orbitingBody.orbit.opacity,
          orbitingBody.position
        );
        orbitGroup.add(orbitLine);

        const fallbackMinPixelRadius = orbitRenderGroup.key === "planets" ? 1.25 : 1.1;
        const runtime = this.bodyRenderer.createBodyRuntime(
          {
            name: orbitingBody.name,
            color: orbitingBody.color,
            renderRadius: orbitingBody.renderRadius,
            minPixelRadius: orbitingBody.minPixelRadius ?? fallbackMinPixelRadius,
            orbitingBody,
            objectType: LABEL_OBJECT_TYPE_BY_GROUP_KEY[orbitRenderGroup.key],
            togglesWithNamesButton: NAMES_TOGGLE_TARGET_GROUPS.has(orbitRenderGroup.key)
          },
          bodyGroup,
          bodyGeometry
        );

        runtime.mesh.position.set(
          orbitingBody.position.x,
          orbitingBody.position.y,
          orbitingBody.position.z
        );

        sceneObjectRuntimes.push(runtime);
        orbitingBodies.push(orbitingBody);
      }
    }
  }

  static applyOrbitVisibility(
    state: Pick<VisibilityStateLike, "showOrbits">,
    orbitGroup: Group
  ): void {
    orbitGroup.visible = state.showOrbits;
  }

  applyOrbitVisibility(state: Pick<VisibilityStateLike, "showOrbits">, orbitGroup: Group): void {
    OrbitRenderer.applyOrbitVisibility(state, orbitGroup);
  }
}
