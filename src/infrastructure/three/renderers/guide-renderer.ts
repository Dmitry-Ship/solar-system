import type {
  BufferGeometry,
  Group,
  LineBasicMaterial,
  LineDashedMaterial,
  Object3D,
  ShaderMaterial,
  Vector3
} from "three";
import { RuntimeThree } from "../../../runtime/three-globals";
import type {
  DirectionalGuideLine,
  GuideRuntime,
  LabelLayerLike,
  Point3,
  RuntimeThreeModule,
  SceneData,
  SceneObjectRuntime,
  VisibilityRuntime
} from "../../../types/solar-system";

const LIGHT_RAY_MIN_AXIS_LENGTH = 1e-6;
const LIGHT_RAY_MIN_VISIBLE_RADIUS = 1e-6;
const LIGHT_RAY_RADIAL_SEGMENTS = 40;
const LIGHT_RAY_RENDER_ORDER_BASE = 40;

interface GuideMaterialOptions {
  dashPattern?: number[];
  dashScale?: number;
  minDashSize?: number;
  solidOpacityFallback?: number;
  dashedOpacityFallback?: number;
}

interface GuideRendererOptions {
  labelsLayer: LabelLayerLike;
  THREE?: RuntimeThreeModule;
}

function hasDashPattern(pattern: number[]): boolean {
  return Array.isArray(pattern) && pattern.length >= 2;
}

function clampOpacity(opacity: number | undefined, fallback = 1): number {
  const safeOpacity = Number.isFinite(opacity) ? (opacity ?? fallback) : fallback;
  return Math.max(0, Math.min(1, safeOpacity));
}

function createGuideMaterial(
  THREE: RuntimeThreeModule,
  guideLine: DirectionalGuideLine,
  {
    dashPattern = [],
    dashScale = 1,
    minDashSize = 4,
    solidOpacityFallback = 0.8,
    dashedOpacityFallback = 0.7
  }: GuideMaterialOptions = {}
): {
  isDashed: boolean;
  material: LineBasicMaterial | LineDashedMaterial;
} {
  const isDashed = hasDashPattern(dashPattern);
  const opacityFallback = isDashed ? dashedOpacityFallback : solidOpacityFallback;
  const opacity = Math.max(0, Math.min(1, guideLine.opacity ?? opacityFallback));
  const materialOptions: {
    color: string;
    transparent: boolean;
    opacity: number;
    depthTest?: boolean;
    dashSize?: number;
    gapSize?: number;
  } = {
    color: guideLine.color,
    transparent: true,
    opacity
  };
  if (guideLine.depthTest === false) {
    materialOptions.depthTest = false;
  }

  if (isDashed) {
    const dashSize = dashPattern[0] ?? minDashSize;
    const gapSize = dashPattern[1] ?? minDashSize;
    materialOptions.dashSize = Math.max(minDashSize, dashSize * dashScale);
    materialOptions.gapSize = Math.max(minDashSize, gapSize * dashScale);
    return {
      isDashed,
      material: new THREE.LineDashedMaterial(materialOptions)
    };
  }

  return {
    isDashed,
    material: new THREE.LineBasicMaterial(materialOptions)
  };
}

function buildLightRayRadiusProfile(
  guideLine: DirectionalGuideLine,
  pointCount: number
): { radiusProfile: number[]; maxRadius: number } {
  const baseRadius = Math.max(guideLine.lightRayRadiusAu || 0, 0);
  const startRadius = Math.max(guideLine.lightRayStartRadiusAu ?? baseRadius, 0);
  const endRadius = Math.max(guideLine.lightRayEndRadiusAu ?? baseRadius, 0);
  const rawRadiusProfile = Array.isArray(guideLine.lightRayRadiusProfileAu)
    ? guideLine.lightRayRadiusProfileAu
    : null;
  const radiusProfile = new Array<number>(pointCount);
  let maxRadius = 0;

  for (let index = 0; index < pointCount; index += 1) {
    const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
    const fallbackRadius = startRadius + (endRadius - startRadius) * t;
    const candidateRadius =
      rawRadiusProfile && Number.isFinite(rawRadiusProfile[index])
        ? rawRadiusProfile[index]
        : fallbackRadius;
    const safeRadius = Math.max(0, candidateRadius);
    radiusProfile[index] = safeRadius;
    maxRadius = Math.max(maxRadius, safeRadius);
  }

  return { radiusProfile, maxRadius };
}

function buildLightRayOpacityProfile(
  guideLine: DirectionalGuideLine,
  pointCount: number,
  opacityFallback = 0.08
): number[] {
  const peakOpacity = clampOpacity(guideLine.opacity, opacityFallback);
  const rawOpacityProfile =
    Array.isArray(guideLine.lightRayOpacityProfile) &&
    guideLine.lightRayOpacityProfile.length === pointCount
      ? guideLine.lightRayOpacityProfile
      : null;
  const opacityProfile = new Array<number>(pointCount);

  for (let index = 0; index < pointCount; index += 1) {
    opacityProfile[index] = clampOpacity(rawOpacityProfile?.[index], peakOpacity);
  }

  return opacityProfile;
}

function createLightRayBasis(
  THREE: RuntimeThreeModule,
  axisDirection: Vector3
): { basisA: Vector3; basisB: Vector3 } {
  const worldUp = new THREE.Vector3(0, 1, 0);
  const worldRight = new THREE.Vector3(1, 0, 0);
  const basisSeed = Math.abs(axisDirection.dot(worldUp)) > 0.98 ? worldRight : worldUp;
  const basisA = new THREE.Vector3().crossVectors(axisDirection, basisSeed).normalize();
  const basisB = new THREE.Vector3().crossVectors(axisDirection, basisA).normalize();

  return { basisA, basisB };
}

function createLightRayMaterial(
  THREE: RuntimeThreeModule,
  guideLine: DirectionalGuideLine
): ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: guideLine.depthTest !== false,
    side: THREE.DoubleSide,
    blending: THREE.NormalBlending,
    toneMapped: false,
    uniforms: {
      diffuse: { value: new THREE.Color(guideLine.color) }
    },
    vertexShader: `
      attribute float vertexOpacity;
      varying float vVertexOpacity;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        vec4 modelViewPosition = modelViewMatrix * vec4(position, 1.0);
        vVertexOpacity = vertexOpacity;
        vViewNormal = normalize(normalMatrix * normal);
        vViewDirection = normalize(-modelViewPosition.xyz);
        gl_Position = projectionMatrix * modelViewPosition;
      }
    `,
    fragmentShader: `
      uniform vec3 diffuse;
      varying float vVertexOpacity;
      varying vec3 vViewNormal;
      varying vec3 vViewDirection;

      void main() {
        float rim = pow(
          1.0 - abs(dot(normalize(vViewNormal), normalize(vViewDirection))),
          1.85
        );
        float alpha = vVertexOpacity * max(0.08, rim);
        if (alpha <= 0.0) {
          discard;
        }

        gl_FragColor = vec4(diffuse, alpha);
      }
    `
  });
}

function buildLightRayTubeGeometry(
  THREE: RuntimeThreeModule,
  points: Vector3[],
  radiusProfile: number[],
  opacityProfile: number[]
): BufferGeometry | null {
  const pointCount = points.length;
  if (pointCount < 2) return null;

  const axis = new THREE.Vector3().subVectors(points[pointCount - 1], points[0]);
  const axisLength = axis.length();
  if (axisLength <= LIGHT_RAY_MIN_AXIS_LENGTH) {
    return null;
  }

  const axisDirection = axis.clone().multiplyScalar(1 / axisLength);
  const { basisA, basisB } = createLightRayBasis(THREE, axisDirection);
  const ringVertexCount = LIGHT_RAY_RADIAL_SEGMENTS + 1;
  const totalVertexCount = pointCount * ringVertexCount;
  const positions = new Float32Array(totalVertexCount * 3);
  const normals = new Float32Array(totalVertexCount * 3);
  const vertexOpacities = new Float32Array(totalVertexCount);
  const indexCount = (pointCount - 1) * LIGHT_RAY_RADIAL_SEGMENTS * 6;
  const IndexArray = totalVertexCount > 65535 ? Uint32Array : Uint16Array;
  const indices = new IndexArray(indexCount);
  let positionOffset = 0;
  let normalOffset = 0;
  let opacityOffset = 0;
  let indexOffset = 0;

  for (let ringIndex = 0; ringIndex < pointCount; ringIndex += 1) {
    const center = points[ringIndex];
    const radius = Math.max(radiusProfile[ringIndex], LIGHT_RAY_MIN_VISIBLE_RADIUS);
    const ringOpacity = clampOpacity(opacityProfile[ringIndex], 0);

    for (let segmentIndex = 0; segmentIndex <= LIGHT_RAY_RADIAL_SEGMENTS; segmentIndex += 1) {
      const angle = (segmentIndex / LIGHT_RAY_RADIAL_SEGMENTS) * Math.PI * 2;
      const cosAngle = Math.cos(angle);
      const sinAngle = Math.sin(angle);
      const normalX = basisA.x * cosAngle + basisB.x * sinAngle;
      const normalY = basisA.y * cosAngle + basisB.y * sinAngle;
      const normalZ = basisA.z * cosAngle + basisB.z * sinAngle;
      positions[positionOffset] = center.x + normalX * radius;
      positions[positionOffset + 1] = center.y + normalY * radius;
      positions[positionOffset + 2] = center.z + normalZ * radius;
      normals[normalOffset] = normalX;
      normals[normalOffset + 1] = normalY;
      normals[normalOffset + 2] = normalZ;
      vertexOpacities[opacityOffset] = ringOpacity;
      positionOffset += 3;
      normalOffset += 3;
      opacityOffset += 1;
    }
  }

  for (let ringIndex = 0; ringIndex < pointCount - 1; ringIndex += 1) {
    const ringStart = ringIndex * ringVertexCount;
    const nextRingStart = ringStart + ringVertexCount;

    for (let segmentIndex = 0; segmentIndex < LIGHT_RAY_RADIAL_SEGMENTS; segmentIndex += 1) {
      const current = ringStart + segmentIndex;
      const currentNext = current + 1;
      const next = nextRingStart + segmentIndex;
      const nextNext = next + 1;

      indices[indexOffset] = current;
      indices[indexOffset + 1] = next;
      indices[indexOffset + 2] = currentNext;
      indices[indexOffset + 3] = currentNext;
      indices[indexOffset + 4] = next;
      indices[indexOffset + 5] = nextNext;
      indexOffset += 6;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setIndex(new THREE.BufferAttribute(indices, 1));
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("normal", new THREE.BufferAttribute(normals, 3));
  geometry.setAttribute("vertexOpacity", new THREE.BufferAttribute(vertexOpacities, 1));
  geometry.computeBoundingSphere();
  return geometry;
}

function resolveGuideLineLabelAnchorPoint(guideLine: DirectionalGuideLine): Point3 | null {
  if (
    guideLine.labelAnchorPoint &&
    Number.isFinite(guideLine.labelAnchorPoint.x) &&
    Number.isFinite(guideLine.labelAnchorPoint.y) &&
    Number.isFinite(guideLine.labelAnchorPoint.z)
  ) {
    return guideLine.labelAnchorPoint;
  }

  if (!Array.isArray(guideLine.points) || guideLine.points.length < 2) {
    return null;
  }

  const start = guideLine.points[0];
  const end = guideLine.points[guideLine.points.length - 1];
  return {
    x: (start.x + end.x) * 0.5,
    y: (start.y + end.y) * 0.5,
    z: (start.z + end.z) * 0.5
  };
}

export class GuideRenderer {
  private readonly labelsLayer: LabelLayerLike;
  private readonly THREE: RuntimeThreeModule;

  constructor(options: GuideRendererOptions) {
    this.labelsLayer = options.labelsLayer;
    this.THREE = options.THREE ?? RuntimeThree;
  }

  createGuideLineLabelRuntime(
    THREE: RuntimeThreeModule,
    guideLine: DirectionalGuideLine
  ): SceneObjectRuntime | null {
    const rawLabel = typeof guideLine.label === "string" ? guideLine.label.trim() : "";
    if (!rawLabel) {
      return null;
    }

    const anchorPoint = resolveGuideLineLabelAnchorPoint(guideLine);
    if (!anchorPoint) return null;

    const anchorObject = new THREE.Object3D();
    anchorObject.position.set(anchorPoint.x, anchorPoint.y, anchorPoint.z);

    return {
      mesh: anchorObject,
      labelElement: this.labelsLayer.createLabel(rawLabel, {
        objectType: "guide-line"
      }),
      renderRadius: 0,
      minPixelRadius: 0,
      togglesWithVisibilityControl: Boolean(guideLine.visibilityKey),
      visibilityKey: guideLine.visibilityKey,
      defaultVisible: guideLine.initialVisibility,
      labelAnchorPosition: anchorObject.position,
      labelAnchorRadius: 0,
      labelMarginPixels: Math.max(1, guideLine.labelMarginPixels || 8)
    };
  }

  createLightRay(guideLine: DirectionalGuideLine, points: Vector3[]): GuideRuntime | null {
    const { THREE } = this;
    const pointCount = points.length;
    if (pointCount < 2) return null;

    const { radiusProfile, maxRadius } = buildLightRayRadiusProfile(guideLine, pointCount);
    if (maxRadius <= LIGHT_RAY_MIN_VISIBLE_RADIUS) {
      return null;
    }

    const opacityProfile = buildLightRayOpacityProfile(guideLine, pointCount);
    const geometry = buildLightRayTubeGeometry(THREE, points, radiusProfile, opacityProfile);
    if (!geometry) {
      return null;
    }

    const mesh = new THREE.Mesh(geometry, createLightRayMaterial(THREE, guideLine));
    mesh.frustumCulled = false;
    mesh.renderOrder =
      LIGHT_RAY_RENDER_ORDER_BASE + Math.max(0, guideLine.lightRayLayerIndex || 0);

    return {
      object: mesh
    };
  }

  buildGuideLines(
    sceneData: SceneData,
    guideLineGroup: Group,
    guideRuntimes: GuideRuntime[],
    sceneObjectRuntimes: SceneObjectRuntime[],
    visibilityRuntimes: VisibilityRuntime[]
  ): void {
    const { THREE } = this;

    for (const guideLine of sceneData.directionalGuideLines) {
      const points = guideLine.points.map(
        (point) => new THREE.Vector3(point.x, point.y, point.z)
      );
      const isLightRay = guideLine.renderStyle === "lightRay";

      if (isLightRay) {
        const lightRayRuntime = this.createLightRay(guideLine, points);
        if (!lightRayRuntime) continue;
        guideLineGroup.add(lightRayRuntime.object);
        const runtime: GuideRuntime = {
          object: lightRayRuntime.object,
          visibilityKey: guideLine.visibilityKey,
          visibilityLabel: guideLine.visibilityLabel,
          visibilityControlLabel: guideLine.visibilityControlLabel,
          visibilityGroupKey: guideLine.visibilityGroupKey,
          visibilityGroupLabel: guideLine.visibilityGroupLabel,
          initialVisibility: guideLine.initialVisibility ?? false,
          defaultVisible: guideLine.initialVisibility ?? false
        };
        guideRuntimes.push(runtime);
        if (runtime.visibilityKey) {
          visibilityRuntimes.push(runtime);
        }

        const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
        if (labelRuntime) {
          sceneObjectRuntimes.push(labelRuntime);
        }
        continue;
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const { material, isDashed } = createGuideMaterial(THREE, guideLine, {
        dashPattern: guideLine.dashPattern,
        dashScale: 6,
        solidOpacityFallback: 0.8,
        dashedOpacityFallback: 0.7
      });

      const line = new THREE.Line(geometry, material);
      if (isDashed) {
        line.computeLineDistances();
      }
      line.frustumCulled = false;

      guideLineGroup.add(line);
      const runtime: GuideRuntime = {
        object: line,
        visibilityKey: guideLine.visibilityKey,
        visibilityLabel: guideLine.visibilityLabel,
        visibilityControlLabel: guideLine.visibilityControlLabel,
        visibilityGroupKey: guideLine.visibilityGroupKey,
        visibilityGroupLabel: guideLine.visibilityGroupLabel,
        initialVisibility: guideLine.initialVisibility ?? true,
        defaultVisible: guideLine.initialVisibility ?? true
      };
      guideRuntimes.push(runtime);
      if (runtime.visibilityKey) {
        visibilityRuntimes.push(runtime);
      }

      const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
      if (labelRuntime) {
        sceneObjectRuntimes.push(labelRuntime);
      }
    }
  }
}
