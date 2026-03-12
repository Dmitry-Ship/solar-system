import { rawDefinitions as raw } from "./raw-definitions";
import { SIMULATION_CONSTANTS as constants } from "../constants/simulation-constants";
import type { MarkerCatalog, MatryoshkaConeLayerDefinition } from "../../types/solar-system";

  const DIRECTIONAL_CONE_MAX_WIDTH_AU = 100;
  const DIRECTIONAL_CONE_TIP_RADIUS_AU =
    (constants.SUN_RADIUS_KM / constants.KM_PER_AU) * 2;
  const DIRECTIONAL_SOURCE_CONE_COLOR = "#93d7ff";
  const DIRECTIONAL_SOURCE_CONE_DASH_PATTERN = [12, 8];
  const DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU = 1500;
  const MATRYOSHKA_CONE_STRUCTURE_MAX_WIDTH_AU =
    DIRECTIONAL_CONE_MAX_WIDTH_AU * 6.5;
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
    const spacingAu =
      normalizedMaxStructureWidthAu / Math.max(0.5, normalizedConeCount - 0.5);

    return Array.from({ length: normalizedConeCount }, (_, index) => {
      const layerProgress =
        normalizedConeCount <= 1 ? 1 : index / (normalizedConeCount - 1);
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
    DIRECTIONAL_MARKER_DEFINITIONS: raw.DIRECTIONAL_MARKER_DEFINITIONS,
    TRAJECTORY_DEFINITIONS: raw.TRAJECTORY_DEFINITIONS || [],
    DIRECTIONAL_CONE_MAX_WIDTH_AU,
    DIRECTIONAL_CONE_TIP_RADIUS_AU,
    DIRECTIONAL_SOURCE_CONE_COLOR,
    DIRECTIONAL_SOURCE_CONE_DASH_PATTERN,
    DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU:
      DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU,
    MATRYOSHKA_CONE_ALPHA,
    MATRYOSHKA_CONE_LAYER_DEFINITIONS
});
