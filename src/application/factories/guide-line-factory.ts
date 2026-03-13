import type {
  MarkerCatalog,
  MatryoshkaConeLayerDefinition
} from "../../domain/catalogs/marker-catalog";
import type {
  DirectionalGuideLine,
  DirectionalMarker,
  MathApi,
  Point3,
  SimulationConstants,
  TrajectoryDefinition
} from "../../types/solar-system";

const MATRYOSHKA_SEGMENT_POINT_COUNT = 26;
const MATRYOSHKA_PRE_SUN_EXPANSION_POWER = 3.75;
const MATRYOSHKA_OUTER_SOURCE_RADIUS_FACTOR = 0.045;
const MATRYOSHKA_INNER_SOURCE_RADIUS_FACTOR = 0.018;
const MATRYOSHKA_SOURCE_RADIUS_MIN_MULTIPLIER = 18;
const LIGHT_RAY_DISTANCE_FADE_POWER = 2.2;
const TRAJECTORY_SOLAR_ASSIST_SEGMENT_COUNT = 64;

interface GuideLineFactoryDependencies {
  constants: SimulationConstants;
  math: MathApi;
  markerCatalog: MarkerCatalog;
}

interface ResolvedGuideLineDependencies extends GuideLineFactoryDependencies {
  focalLineMinDistanceAu: number;
  focalLineMaxDistanceAu: number;
  directionalGuideSharedEndDistanceAu: number;
}

interface DirectionalGuideLineOptions {
  points: Point3[];
  renderStyle?: DirectionalGuideLine["renderStyle"];
  opacity?: number;
  lightRayRadiusAu?: number;
  lightRayStartRadiusAu?: number;
  lightRayEndRadiusAu?: number;
  lightRayRadiusProfileAu?: number[];
  lightRayOpacityProfile?: number[];
  lightRayLayerIndex?: number;
  dashPattern?: number[];
  depthTest?: boolean;
  visibilityKey?: string;
  visibilityLabel?: string;
  visibilityControlLabel?: string;
  visibilityGroupKey?: string;
  visibilityGroupLabel?: string;
  initialVisibility?: boolean;
  label?: string;
  labelAnchorPoint?: Point3 | null;
  labelMarginPixels?: number;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
}

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function clonePoint(point: Point3): Point3 {
  return {
    x: point.x,
    y: point.y,
    z: point.z
  };
}

function pointMagnitude(point: Point3): number {
  return Math.hypot(point.x, point.y, point.z);
}

function pointDistance(a: Point3, b: Point3): number {
  return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
}

function scalePoint(point: Point3, scalar: number): Point3 {
  return {
    x: point.x * scalar,
    y: point.y * scalar,
    z: point.z * scalar
  };
}

function normalizePoint(point: Point3): Point3 {
  const magnitude = pointMagnitude(point);
  if (magnitude <= 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }

  return scalePoint(point, 1 / magnitude);
}

function appendUniquePoint(points: Point3[], point: Point3 | null | undefined): void {
  if (!point) {
    return;
  }

  if (points.length === 0 || pointDistance(points[points.length - 1], point) > 1e-6) {
    points.push(clonePoint(point));
  }
}

function buildDistanceFadeProfile(points: Point3[], marker: Point3 | null): number[] | null {
  if (!marker) {
    return null;
  }

  const distances = points.map((point) => pointDistance(point, marker));
  const minDistanceFromSource = distances.reduce(
    (minDistance, distance) => Math.min(minDistance, distance),
    Number.POSITIVE_INFINITY
  );
  const maxDistanceFromSource = distances.reduce(
    (maxDistance, distance) => Math.max(maxDistance, distance),
    0
  );
  const distanceRange = maxDistanceFromSource - minDistanceFromSource;
  if (distanceRange <= 1e-6) {
    return points.map(() => 1);
  }

  return distances.map((distance) => {
    const normalizedDistance = clamp01((distance - minDistanceFromSource) / distanceRange);
    return 1 - Math.pow(normalizedDistance, LIGHT_RAY_DISTANCE_FADE_POWER);
  });
}

function buildLightRayVisibilityKey(name: string): string {
  const normalizedName = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!normalizedName) {
    return "light-ray";
  }

  return `light-ray:${normalizedName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function buildTrajectoryVisibilityKey(name: string): string {
  const normalizedName = typeof name === "string" ? name.trim().toLowerCase() : "";
  if (!normalizedName) {
    return "trajectory";
  }

  return `trajectory:${normalizedName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
}

function buildLightRayRadiusProfile(
  points: Point3[],
  options: DirectionalGuideLineOptions,
  fallbackStartRadiusAu: number,
  fallbackEndRadiusAu: number
): {
  lightRayRadiusProfileAu: number[];
  lightRayStartRadiusAu: number;
  lightRayEndRadiusAu: number;
} {
  const rawRadiusProfile =
    Array.isArray(options.lightRayRadiusProfileAu) &&
    options.lightRayRadiusProfileAu.length === points.length
      ? options.lightRayRadiusProfileAu
      : null;

  const lightRayRadiusProfileAu = points.map((_, index) => {
    const t = points.length <= 1 ? 0 : index / (points.length - 1);
    const fallbackRadius =
      fallbackStartRadiusAu + (fallbackEndRadiusAu - fallbackStartRadiusAu) * t;
    const radius = rawRadiusProfile?.[index] ?? fallbackRadius;
    return Math.max(0, Number.isFinite(radius) ? radius : 0);
  });

  return {
    lightRayRadiusProfileAu,
    lightRayStartRadiusAu: lightRayRadiusProfileAu[0] ?? 0,
    lightRayEndRadiusAu: lightRayRadiusProfileAu[lightRayRadiusProfileAu.length - 1] ?? 0
  };
}

function buildLightRayOpacityProfile(
  points: Point3[],
  marker: Point3 | null,
  options: DirectionalGuideLineOptions,
  fallbackOpacity: number
): number[] {
  const fallback = clamp01(fallbackOpacity);
  const rawOpacityProfile =
    Array.isArray(options.lightRayOpacityProfile) &&
    options.lightRayOpacityProfile.length === points.length
      ? options.lightRayOpacityProfile
      : null;
  const baseOpacityProfile = rawOpacityProfile
    ? rawOpacityProfile.map((opacity) => clamp01(opacity ?? fallback))
    : points.map(() => fallback);
  const distanceFadeProfile = buildDistanceFadeProfile(points, marker);

  if (!distanceFadeProfile) {
    return baseOpacityProfile;
  }

  let sourcePointIndex = 0;
  for (let index = 1; index < distanceFadeProfile.length; index += 1) {
    if (distanceFadeProfile[index] > distanceFadeProfile[sourcePointIndex]) {
      sourcePointIndex = index;
    }
  }

  const sourceOpacity = clamp01(baseOpacityProfile[sourcePointIndex] ?? fallback);
  return baseOpacityProfile.map((opacity, index) => {
    const distanceLimitedOpacity = sourceOpacity * distanceFadeProfile[index];
    return rawOpacityProfile ? Math.min(opacity, distanceLimitedOpacity) : distanceLimitedOpacity;
  });
}

function buildDirectionalGuideLine(
  marker: Point3 | null,
  color: string,
  options: DirectionalGuideLineOptions
): DirectionalGuideLine | null {
  if (!marker) {
    return null;
  }

  const lightRayRadiusAu = options.lightRayRadiusAu ?? 0;
  const fallbackStartRadiusAu = options.lightRayStartRadiusAu ?? lightRayRadiusAu;
  const fallbackEndRadiusAu = options.lightRayEndRadiusAu ?? lightRayRadiusAu;
  const points = options.points.map((point) => clonePoint(point));
  const opacity = options.opacity ?? 0.96;
  const { lightRayRadiusProfileAu, lightRayStartRadiusAu, lightRayEndRadiusAu } =
    buildLightRayRadiusProfile(points, options, fallbackStartRadiusAu, fallbackEndRadiusAu);
  const lightRayOpacityProfile = buildLightRayOpacityProfile(points, marker, options, opacity);
  const lightRayLayerIndex = Number.isFinite(options.lightRayLayerIndex)
    ? Math.max(0, Math.floor(options.lightRayLayerIndex ?? 0))
    : 0;

  return {
    points,
    color,
    renderStyle: options.renderStyle || "line",
    opacity,
    lightRayRadiusAu,
    lightRayStartRadiusAu,
    lightRayEndRadiusAu,
    lightRayRadiusProfileAu,
    lightRayOpacityProfile,
    lightRayLayerIndex,
    dashPattern: options.dashPattern || [],
    depthTest: options.depthTest,
    visibilityKey: options.visibilityKey || "",
    visibilityLabel: options.visibilityLabel || "",
    visibilityControlLabel: options.visibilityControlLabel || "",
    visibilityGroupKey: options.visibilityGroupKey || "",
    visibilityGroupLabel: options.visibilityGroupLabel || "",
    initialVisibility: options.initialVisibility ?? true,
    label: options.label || "",
    labelAnchorPoint: options.labelAnchorPoint ? clonePoint(options.labelAnchorPoint) : null,
    labelMarginPixels: options.labelMarginPixels
  };
}

function buildMatryoshkaCylinderProfile(
  sourceMarker: Point3,
  sourceRadiusAu: number,
  sunCrossingRadiusAu: number,
  peakOpacity: number,
  focusDistanceAu: number,
  postFocusEndDistanceAu: number,
  math: MathApi
): {
  points: Point3[];
  lightRayRadiusProfileAu: number[];
  lightRayOpacityProfile: number[];
} {
  const points: Point3[] = [];
  const lightRayRadiusProfileAu: number[] = [];
  const lightRayOpacityProfile: number[] = [];
  const sourceDistanceAu = pointMagnitude(sourceMarker);
  const focusSlopeAuPerAu = sunCrossingRadiusAu / Math.max(focusDistanceAu, 1e-6);

  for (let step = 0; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
    const t = step / MATRYOSHKA_SEGMENT_POINT_COUNT;
    const distanceAu = sourceDistanceAu * (1 - t);
    const radiusAu = lerp(
      sourceRadiusAu,
      sunCrossingRadiusAu,
      Math.pow(t, MATRYOSHKA_PRE_SUN_EXPANSION_POWER)
    );
    points.push(
      step === 0
        ? clonePoint(sourceMarker)
        : math.pointOnRadiusAlongDirection(sourceMarker, distanceAu)
    );
    lightRayRadiusProfileAu.push(radiusAu);
    lightRayOpacityProfile.push(peakOpacity);
  }

  for (let step = 1; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
    const t = step / MATRYOSHKA_SEGMENT_POINT_COUNT;
    const distanceAu = focusDistanceAu * t;
    const radiusAu = lerp(sunCrossingRadiusAu, 0, t);
    points.push(math.pointOnRadiusAlongDirection(sourceMarker, -distanceAu));
    lightRayRadiusProfileAu.push(radiusAu);
    lightRayOpacityProfile.push(peakOpacity);
  }

  for (let step = 1; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
    const t = step / MATRYOSHKA_SEGMENT_POINT_COUNT;
    const distanceAu = lerp(focusDistanceAu, postFocusEndDistanceAu, t);
    const radiusAu = focusSlopeAuPerAu * Math.max(0, distanceAu - focusDistanceAu);
    points.push(math.pointOnRadiusAlongDirection(sourceMarker, -distanceAu));
    lightRayRadiusProfileAu.push(radiusAu);
    lightRayOpacityProfile.push(peakOpacity);
  }

  return { points, lightRayRadiusProfileAu, lightRayOpacityProfile };
}

function createMatryoshkaConeLayer(
  sourceMarker: DirectionalMarker,
  layerDefinition: MatryoshkaConeLayerDefinition,
  layerIndex: number,
  layerCount: number,
  dependencies: ResolvedGuideLineDependencies
): DirectionalGuideLine[] {
  const { constants, math, markerCatalog, directionalGuideSharedEndDistanceAu } = dependencies;
  const layerProgress = layerCount <= 1 ? 1 : layerIndex / (layerCount - 1);
  const normalizedLayerProgress = clamp01(layerProgress);
  const focusDistanceAu =
    constants.SOLAR_GRAVITATIONAL_LENS_AU + (layerDefinition.focalOffsetAu ?? 0);
  const coneMaxWidthAu =
    markerCatalog.DIRECTIONAL_CONE_MAX_WIDTH_AU * layerDefinition.maxWidthScale;
  const sunCrossingRadiusAu = coneMaxWidthAu * 0.5;
  const sourceRadiusFactor = lerp(
    MATRYOSHKA_OUTER_SOURCE_RADIUS_FACTOR,
    MATRYOSHKA_INNER_SOURCE_RADIUS_FACTOR,
    normalizedLayerProgress
  );
  const sourceRadiusAu = Math.max(
    markerCatalog.DIRECTIONAL_CONE_TIP_RADIUS_AU * MATRYOSHKA_SOURCE_RADIUS_MIN_MULTIPLIER,
    sunCrossingRadiusAu * sourceRadiusFactor
  );
  const peakOpacity = markerCatalog.MATRYOSHKA_CONE_ALPHA ?? 0.08;
  const { points, lightRayRadiusProfileAu, lightRayOpacityProfile } = buildMatryoshkaCylinderProfile(
    sourceMarker,
    sourceRadiusAu,
    sunCrossingRadiusAu,
    peakOpacity,
    focusDistanceAu,
    directionalGuideSharedEndDistanceAu,
    math
  );
  const guideLine = buildDirectionalGuideLine(sourceMarker, markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR, {
    points,
    renderStyle: "lightRay",
    opacity: peakOpacity,
    lightRayRadiusProfileAu,
    lightRayOpacityProfile,
    lightRayLayerIndex: layerIndex,
    visibilityKey: buildLightRayVisibilityKey(sourceMarker.name),
    visibilityLabel: sourceMarker.name,
    visibilityControlLabel: `${sourceMarker.name} Ray`,
    visibilityGroupKey: "light-rays",
    visibilityGroupLabel: "Light Rays",
    initialVisibility: false
  });

  return guideLine ? [guideLine] : [];
}

function createMatryoshkaFocalLine(
  sourceMarker: DirectionalMarker | null,
  dependencies: ResolvedGuideLineDependencies
): DirectionalGuideLine | null {
  if (!sourceMarker) {
    return null;
  }

  const { constants, math, markerCatalog } = dependencies;
  const focalPoints = markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.map((layerDefinition) =>
    math.pointOnRadiusAlongDirection(
      sourceMarker,
      -(constants.SOLAR_GRAVITATIONAL_LENS_AU + (layerDefinition.focalOffsetAu ?? 0))
    )
  );

  if (focalPoints.length < 2) {
    return null;
  }

  focalPoints.sort((a, b) => pointMagnitude(a) - pointMagnitude(b));
  return buildDirectionalGuideLine(sourceMarker, markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR, {
    points: focalPoints,
    opacity: 0.48,
    dashPattern: markerCatalog.DIRECTIONAL_SOURCE_CONE_DASH_PATTERN,
    depthTest: false,
    visibilityKey: buildLightRayVisibilityKey(sourceMarker.name),
    visibilityLabel: sourceMarker.name,
    visibilityControlLabel: `${sourceMarker.name} Ray`,
    visibilityGroupKey: "light-rays",
    visibilityGroupLabel: "Light Rays",
    initialVisibility: false,
    label: "focal line"
  });
}

function createMatryoshkaSourceGuideShape(
  sourceMarker: DirectionalMarker | null,
  dependencies: ResolvedGuideLineDependencies
): DirectionalGuideLine[] {
  if (!sourceMarker) {
    return [];
  }

  const guideLines: DirectionalGuideLine[] = [];
  const layerDefinitions = dependencies.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS;
  const layerCount = layerDefinitions.length;
  for (let index = 0; index < layerCount; index += 1) {
    guideLines.push(
      ...createMatryoshkaConeLayer(
        sourceMarker,
        layerDefinitions[index],
        index,
        layerCount,
        dependencies
      )
    );
  }

  const focalLine = createMatryoshkaFocalLine(sourceMarker, dependencies);
  if (focalLine) {
    guideLines.push(focalLine);
  }

  return guideLines;
}

function resolveMatryoshkaFocalDistanceRange(
  layerDefinitions: MatryoshkaConeLayerDefinition[] | null | undefined,
  lensDistanceAu: number
): { minDistanceAu: number; maxDistanceAu: number } {
  if (!Array.isArray(layerDefinitions) || layerDefinitions.length === 0) {
    return {
      minDistanceAu: lensDistanceAu,
      maxDistanceAu: lensDistanceAu
    };
  }

  let minDistanceAu = Number.POSITIVE_INFINITY;
  let maxDistanceAu = lensDistanceAu;
  for (const layerDefinition of layerDefinitions) {
    const distanceAu = lensDistanceAu + (layerDefinition.focalOffsetAu ?? 0);
    minDistanceAu = Math.min(minDistanceAu, distanceAu);
    maxDistanceAu = Math.max(maxDistanceAu, distanceAu);
  }

  return {
    minDistanceAu: Number.isFinite(minDistanceAu) ? minDistanceAu : lensDistanceAu,
    maxDistanceAu
  };
}

function findMarkerByName(
  sourceMarkers: DirectionalMarker[],
  markerName: string
): DirectionalMarker | null {
  const normalizedMarkerName = typeof markerName === "string" ? markerName.trim() : "";
  if (!normalizedMarkerName) {
    return null;
  }

  return (
    sourceMarkers.find(
      (sourceMarker) => sourceMarker.name.trim().toLowerCase() === normalizedMarkerName.toLowerCase()
    ) || null
  );
}

function appendHyperbolicAssistPoints(
  points: Point3[],
  startDirection: Point3,
  endDirection: Point3,
  periapsisDistanceAu: number,
  endpointDistanceAu: number,
  segmentCount: number,
  math: MathApi
): void {
  const hyperbolaPoints = math.hyperbolicBranchPoints(
    startDirection,
    endDirection,
    periapsisDistanceAu,
    endpointDistanceAu,
    segmentCount
  );
  if (!Array.isArray(hyperbolaPoints) || hyperbolaPoints.length === 0) {
    return;
  }

  for (const hyperbolaPoint of hyperbolaPoints) {
    appendUniquePoint(points, hyperbolaPoint);
  }
}

function createTrajectoryGuideLine(
  trajectoryDefinition: TrajectoryDefinition | null,
  sourceMarkers: DirectionalMarker[],
  dependencies: ResolvedGuideLineDependencies
): DirectionalGuideLine | null {
  if (!trajectoryDefinition) {
    return null;
  }

  const launchMarker = findMarkerByName(sourceMarkers, trajectoryDefinition.launchMarkerName);
  const firstFocalMarker = findMarkerByName(
    sourceMarkers,
    trajectoryDefinition.firstFocalMarkerName
  );
  const secondFocalMarker = findMarkerByName(
    sourceMarkers,
    trajectoryDefinition.secondFocalMarkerName
  );
  if (!launchMarker || !firstFocalMarker || !secondFocalMarker) {
    return null;
  }

  const { focalLineMinDistanceAu, focalLineMaxDistanceAu } = dependencies;
  const firstFocalDirection = normalizePoint(
    dependencies.math.pointOnRadiusAlongDirection(firstFocalMarker, -1)
  );
  const secondFocalDirection = normalizePoint(
    dependencies.math.pointOnRadiusAlongDirection(secondFocalMarker, -1)
  );
  const focalMidDistanceAu = (focalLineMinDistanceAu + focalLineMaxDistanceAu) * 0.5;
  const firstFocalMidpoint = scalePoint(firstFocalDirection, focalMidDistanceAu);
  const secondFocalEndPoint = scalePoint(secondFocalDirection, focalLineMaxDistanceAu);
  const solarAssistRadiusAu = Number.isFinite(trajectoryDefinition.solarAssistRadiusAu)
    ? trajectoryDefinition.solarAssistRadiusAu ?? 0.25
    : 0.25;
  const points: Point3[] = [];

  appendUniquePoint(points, launchMarker);
  appendUniquePoint(points, firstFocalMidpoint);
  appendHyperbolicAssistPoints(
    points,
    firstFocalDirection,
    secondFocalDirection,
    solarAssistRadiusAu,
    focalLineMinDistanceAu,
    TRAJECTORY_SOLAR_ASSIST_SEGMENT_COUNT,
    dependencies.math
  );
  appendUniquePoint(points, secondFocalEndPoint);

  const trajectoryLabel =
    typeof trajectoryDefinition.label === "string"
      ? trajectoryDefinition.label.trim()
      : trajectoryDefinition.name;
  const trajectoryVisibilityLabel =
    typeof trajectoryDefinition.visibilityLabel === "string" &&
    trajectoryDefinition.visibilityLabel.trim()
      ? trajectoryDefinition.visibilityLabel.trim()
      : trajectoryLabel || trajectoryDefinition.name;
  const trajectoryVisibilityControlLabel =
    typeof trajectoryDefinition.visibilityControlLabel === "string" &&
    trajectoryDefinition.visibilityControlLabel.trim()
      ? trajectoryDefinition.visibilityControlLabel.trim()
      : trajectoryVisibilityLabel;

  return buildDirectionalGuideLine(launchMarker, trajectoryDefinition.color || "#ffd36e", {
    points,
    opacity: 0.94,
    depthTest: false,
    visibilityKey: buildTrajectoryVisibilityKey(trajectoryDefinition.name),
    visibilityLabel: trajectoryVisibilityLabel,
    visibilityControlLabel: trajectoryVisibilityControlLabel,
    visibilityGroupKey: "trajectories",
    visibilityGroupLabel: "Trajectories",
    initialVisibility: true,
    label: trajectoryLabel,
    labelAnchorPoint: firstFocalMidpoint,
    labelMarginPixels: 10
  });
}

function createTrajectoryGuideLines(
  sourceMarkers: DirectionalMarker[],
  dependencies: ResolvedGuideLineDependencies
): DirectionalGuideLine[] {
  return dependencies.markerCatalog.TRAJECTORY_DEFINITIONS.map((trajectoryDefinition) =>
    createTrajectoryGuideLine(trajectoryDefinition, sourceMarkers, dependencies)
  ).filter((guideLine): guideLine is DirectionalGuideLine => guideLine !== null);
}

export function buildDirectionalGuideLines(
  sourceMarkers: DirectionalMarker[],
  dependencies: GuideLineFactoryDependencies
): DirectionalGuideLine[] {
  if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0) {
    return [];
  }

  const { minDistanceAu: focalLineMinDistanceAu, maxDistanceAu: maxMatryoshkaFocusDistanceAu } =
    resolveMatryoshkaFocalDistanceRange(
      dependencies.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS,
      dependencies.constants.SOLAR_GRAVITATIONAL_LENS_AU
    );
  const guideLineDependencies: ResolvedGuideLineDependencies = {
    ...dependencies,
    focalLineMinDistanceAu,
    focalLineMaxDistanceAu: maxMatryoshkaFocusDistanceAu,
    directionalGuideSharedEndDistanceAu:
      maxMatryoshkaFocusDistanceAu +
      dependencies.markerCatalog.DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU
  };

  const guideLines: DirectionalGuideLine[] = [];
  for (const sourceMarker of sourceMarkers) {
    guideLines.push(...createMatryoshkaSourceGuideShape(sourceMarker, guideLineDependencies));
  }
  guideLines.push(...createTrajectoryGuideLines(sourceMarkers, guideLineDependencies));

  return guideLines;
}
