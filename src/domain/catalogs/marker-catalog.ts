import { SIMULATION_CONSTANTS as constants } from "../constants/simulation-constants";
import type {
  DirectionalMarkerDefinition,
  Point3,
  TrajectoryDefinition
} from "../../types/solar-system";

export interface MatryoshkaConeLayerDefinition {
  lengthExtensionAu: number;
  maxWidthScale: number;
  tipRadiusScale: number;
  focalOffsetAu: number;
}

export interface MarkerCatalog {
  DIRECTIONAL_MARKER_DEFINITIONS: DirectionalMarkerDefinition[];
  TRAJECTORY_DEFINITIONS: TrajectoryDefinition[];
  DIRECTIONAL_CONE_MAX_WIDTH_AU: number;
  DIRECTIONAL_CONE_TIP_RADIUS_AU: number;
  DIRECTIONAL_SOURCE_CONE_COLOR: string;
  DIRECTIONAL_SOURCE_CONE_DASH_PATTERN: number[];
  DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU: number;
  MATRYOSHKA_CONE_ALPHA: number;
  MATRYOSHKA_CONE_LAYER_DEFINITIONS: MatryoshkaConeLayerDefinition[];
}

const DIRECTIONAL_MARKER_DEFINITIONS: DirectionalMarkerDefinition[] = [
  {
    name: "61 Cygni",
    label: "61 Cygni (11.4 light-years)",
    color: "#ffb878",
    distanceLightYears: 11.4,
    raHours: 21 + 6 / 60 + 53.94 / 3600,
    decDeg: 38 + 44 / 60 + 57.9 / 3600,
    minPixelRadius: 2.5
  },
  {
    name: "Gliese 300",
    label: "Gliese 300 (26 light years)",
    color: "#ff6f63",
    distanceLightYears: 26,
    raHours: 8 + 12 / 60 + 40.8889728169 / 3600,
    decDeg: -(21 + 33 / 60 + 6.982558553 / 3600),
    minPixelRadius: 2.5
  }
];

const TRAJECTORY_DEFINITIONS: TrajectoryDefinition[] = [
  {
    name: "61 Cygni Transfer",
    visibilityLabel: "61 Cygni trajectory",
    launchMarkerName: "61 Cygni",
    approachMarkerName: "61 Cygni",
    exitMarkerName: "61 Cygni",
    solarAssistRadiusAu: 0.01,
    solarFlybyPeriapsisDirection: { x: 0, y: 1, z: 0 } satisfies Point3,
    routePoints: [
      {
        key: "common-path-transition",
        distanceAu: 5000,
        location: "inbound"
      },
      {
        key: "branching-point",
        distanceAu: 3000,
        location: "inbound"
      },
      {
        key: "sun-passage",
        distanceAu: 0.01,
        location: "outbound"
      }
    ],
    routeSegments: [
      {
        label: "extrapolation",
        startPointKey: "launch",
        endPointKey: "common-path-transition",
        color: "#ffd36e",
        dashPattern: [10, 6]
      },
      {
        label: "common path",
        startPointKey: "common-path-transition",
        endPointKey: "branching-point",
        color: "#ffd36e"
      },
      {
        label: "transmitter path",
        startPointKey: "branching-point",
        endPointKey: "exit",
        color: "#7dd3fc"
      }
    ],
    localBranches: [
      {
        label: "lander path",
        sourcePointKey: "sun-passage",
        targetBodyName: "Earth 🌎",
        color: "#4ade80"
      }
    ],
    focalBranches: [
      {
        label: "observer path",
        sourcePointKey: "branching-point",
        targetMarkerName: "Gliese 300",
        joinDistanceAu: 750,
        endDistanceAu: 750,
        color: "#f472b6"
      }
    ],
    color: "#ffd36e"
  }
];

const DIRECTIONAL_CONE_MAX_WIDTH_AU = 100;
const DIRECTIONAL_CONE_TIP_RADIUS_AU = (constants.SUN_RADIUS_KM / constants.KM_PER_AU) * 2;
const DIRECTIONAL_SOURCE_CONE_COLOR = "#93d7ff";
const DIRECTIONAL_SOURCE_CONE_DASH_PATTERN = [12, 8];
const DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU = 1500;
const MATRYOSHKA_CONE_STRUCTURE_MAX_WIDTH_AU = DIRECTIONAL_CONE_MAX_WIDTH_AU * 6.5;
const MATRYOSHKA_CONE_COUNT = 10;
const MATRYOSHKA_MIN_LAYER_WIDTH_SCALE = 0.05;
const MATRYOSHKA_REFERENCE_INNER_LAYER_MAX_WIDTH_SCALE = 0.25;
const MATRYOSHKA_REFERENCE_INNER_LAYER_TIP_RADIUS_SCALE = 0.2;
const MATRYOSHKA_OUTER_LAYER_TIP_RADIUS_SCALE = 1.05;
const MATRYOSHKA_CONE_ALPHA = 0.055;

function lerp(start: number, end: number, t: number): number {
  return start + (end - start) * t;
}

function normalizeMatryoshkaConeCount(coneCount: number): number {
  return Math.max(1, Math.floor(Number.isFinite(coneCount) ? coneCount : 0));
}

function minimumMatryoshkaStructureWidthAu(coneCount: number): number {
  return (
    DIRECTIONAL_CONE_MAX_WIDTH_AU *
    MATRYOSHKA_MIN_LAYER_WIDTH_SCALE *
    Math.max(1, coneCount * 2 - 1)
  );
}

function incomingRadiusForWidthScale(maxWidthScale: number): number {
  return DIRECTIONAL_CONE_MAX_WIDTH_AU * maxWidthScale * 0.5;
}

function focalRadiusForTipScale(tipRadiusScale: number): number {
  return DIRECTIONAL_CONE_TIP_RADIUS_AU * tipRadiusScale;
}

const MATRYOSHKA_SHARED_CONE_SLOPE =
  (incomingRadiusForWidthScale(MATRYOSHKA_REFERENCE_INNER_LAYER_MAX_WIDTH_SCALE) -
    focalRadiusForTipScale(MATRYOSHKA_REFERENCE_INNER_LAYER_TIP_RADIUS_SCALE)) /
  constants.SOLAR_GRAVITATIONAL_LENS_AU;

function focalOffsetForMaxWidthScale(maxWidthScale: number, tipRadiusScale: number): number {
  const incomingRadiusAu = incomingRadiusForWidthScale(maxWidthScale);
  const focalRadiusAu = focalRadiusForTipScale(tipRadiusScale);
  const focalDistanceAu =
    (incomingRadiusAu - focalRadiusAu) / MATRYOSHKA_SHARED_CONE_SLOPE;
  return Math.max(0, focalDistanceAu - constants.SOLAR_GRAVITATIONAL_LENS_AU);
}

function createMatryoshkaConeLayerDefinition({
  maxWidthAu,
  tipRadiusScale,
  pinchesAtLensSphereEdge = false
}: {
  maxWidthAu: number;
  tipRadiusScale: number;
  pinchesAtLensSphereEdge?: boolean;
}): MatryoshkaConeLayerDefinition {
  const normalizedMaxWidthScale = Math.max(
    MATRYOSHKA_MIN_LAYER_WIDTH_SCALE,
    (Number.isFinite(maxWidthAu) ? maxWidthAu : 0) / DIRECTIONAL_CONE_MAX_WIDTH_AU
  );
  const normalizedTipRadiusScale = Math.max(
    MATRYOSHKA_MIN_LAYER_WIDTH_SCALE,
    Number.isFinite(tipRadiusScale) ? tipRadiusScale : 0
  );

  return {
    lengthExtensionAu: 0,
    maxWidthScale: normalizedMaxWidthScale,
    tipRadiusScale: normalizedTipRadiusScale,
    focalOffsetAu: pinchesAtLensSphereEdge
      ? 0
      : focalOffsetForMaxWidthScale(normalizedMaxWidthScale, normalizedTipRadiusScale)
  };
}

function createMatryoshkaConeLayerDefinitions(
  maxStructureWidthAu: number,
  coneCount: number
): MatryoshkaConeLayerDefinition[] {
  const normalizedConeCount = normalizeMatryoshkaConeCount(coneCount);
  const normalizedMaxStructureWidthAu = Math.max(
    minimumMatryoshkaStructureWidthAu(normalizedConeCount),
    Number.isFinite(maxStructureWidthAu) ? maxStructureWidthAu : 0
  );
  const spacingAu = normalizedMaxStructureWidthAu / Math.max(0.5, normalizedConeCount - 0.5);

  return Array.from({ length: normalizedConeCount }, (_, index) => {
    const layerProgress = normalizedConeCount <= 1 ? 1 : index / (normalizedConeCount - 1);
    const maxWidthAu = spacingAu * (normalizedConeCount - index - 0.5);
    const tipRadiusScale = lerp(
      MATRYOSHKA_OUTER_LAYER_TIP_RADIUS_SCALE,
      MATRYOSHKA_REFERENCE_INNER_LAYER_TIP_RADIUS_SCALE,
      layerProgress
    );

    return createMatryoshkaConeLayerDefinition({
      maxWidthAu,
      tipRadiusScale,
      pinchesAtLensSphereEdge: index === normalizedConeCount - 1
    });
  });
}

const MATRYOSHKA_CONE_LAYER_DEFINITIONS = createMatryoshkaConeLayerDefinitions(
  MATRYOSHKA_CONE_STRUCTURE_MAX_WIDTH_AU,
  MATRYOSHKA_CONE_COUNT
);

export const markerCatalog: MarkerCatalog = Object.freeze({
  DIRECTIONAL_MARKER_DEFINITIONS,
  TRAJECTORY_DEFINITIONS,
  DIRECTIONAL_CONE_MAX_WIDTH_AU,
  DIRECTIONAL_CONE_TIP_RADIUS_AU,
  DIRECTIONAL_SOURCE_CONE_COLOR,
  DIRECTIONAL_SOURCE_CONE_DASH_PATTERN,
  DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU,
  MATRYOSHKA_CONE_ALPHA,
  MATRYOSHKA_CONE_LAYER_DEFINITIONS
});
