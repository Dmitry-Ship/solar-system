(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("guide-line factory bootstrap failed: missing application factories namespace.");
  }

  function clonePoint(point) {
    return {
      x: point.x,
      y: point.y,
      z: point.z
    };
  }

  function resolveGuideLinePoints(marker, options, dependencies) {
    const { constants, math } = dependencies;
    const fallbackStartPoint =
      options.startPoint ||
      math.pointOnRadiusAlongDirection(marker, -constants.SOLAR_GRAVITATIONAL_LENS_AU);
    const fallbackEndPoint = options.endPoint || {
      x: marker.x,
      y: marker.y,
      z: marker.z
    };

    if (Array.isArray(options.points) && options.points.length >= 2) {
      return options.points.map((point) => clonePoint(point));
    }

    return [fallbackStartPoint, fallbackEndPoint];
  }

  function buildLightRayRadiusProfile(
    points,
    options,
    fallbackStartRadiusAu,
    fallbackEndRadiusAu
  ) {
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
      lightRayStartRadiusAu: lightRayRadiusProfileAu[0] || 0,
      lightRayEndRadiusAu: lightRayRadiusProfileAu[lightRayRadiusProfileAu.length - 1] || 0
    };
  }

  function buildDirectionalGuideLine(marker, color, options = {}, dependencies) {
    if (!marker) return null;

    const lightRayRadiusAu = options.lightRayRadiusAu ?? 0;
    const fallbackStartRadiusAu = options.lightRayStartRadiusAu ?? lightRayRadiusAu;
    const fallbackEndRadiusAu = options.lightRayEndRadiusAu ?? lightRayRadiusAu;
    const points = resolveGuideLinePoints(marker, options, dependencies);
    const {
      lightRayRadiusProfileAu,
      lightRayStartRadiusAu,
      lightRayEndRadiusAu
    } = buildLightRayRadiusProfile(
      points,
      options,
      fallbackStartRadiusAu,
      fallbackEndRadiusAu
    );

    return {
      points,
      color,
      renderStyle: options.renderStyle || "line",
      opacity: options.opacity ?? 0.96,
      showStartRim: options.showStartRim ?? true,
      showEndRim: options.showEndRim ?? true,
      lightRayRadiusAu,
      lightRayStartRadiusAu,
      lightRayEndRadiusAu,
      lightRayRadiusProfileAu,
      lightRayDashPattern: options.lightRayDashPattern || [],
      dashPattern: options.dashPattern || [],
      depthTest: options.depthTest,
      label: options.label || "",
      labelAnchorPoint: options.labelAnchorPoint ? clonePoint(options.labelAnchorPoint) : null,
      labelMarginPixels: options.labelMarginPixels
    };
  }

  function createMatryoshkaConeLayer(sourceMarker, layerDefinition, dependencies) {
    const { constants, math, markerCatalog, directionalGuidePostFocalEndDistanceAu } =
      dependencies;
    const focalDistanceAu =
      constants.SOLAR_GRAVITATIONAL_LENS_AU + (layerDefinition.focalOffsetAu ?? 0);
    const incomingTransitionPoint = { x: 0, y: 0, z: 0 };
    const focalPoint = math.pointOnRadiusAlongDirection(sourceMarker, -focalDistanceAu);
    const endDistanceAu = directionalGuidePostFocalEndDistanceAu;
    const endPoint = math.pointOnRadiusAlongDirection(sourceMarker, -endDistanceAu);
    const coneMaxWidthAu =
      markerCatalog.DIRECTIONAL_CONE_MAX_WIDTH_AU * layerDefinition.maxWidthScale;
    const incomingRadiusAu = coneMaxWidthAu * 0.5;
    const focalRadiusAu =
      markerCatalog.DIRECTIONAL_CONE_TIP_RADIUS_AU * layerDefinition.tipRadiusScale;
    const incomingTransitionDistanceAu = Math.hypot(
      incomingTransitionPoint.x,
      incomingTransitionPoint.y,
      incomingTransitionPoint.z
    );
    const convergenceSpanAu = incomingTransitionDistanceAu + focalDistanceAu;
    const divergenceSpanAu = endDistanceAu - focalDistanceAu;
    const prePinchRadiusDeltaAu = Math.max(0, incomingRadiusAu - focalRadiusAu);
    const divergenceSlope = prePinchRadiusDeltaAu / Math.max(convergenceSpanAu, 1e-6);
    const outgoingRadiusAu = focalRadiusAu + divergenceSpanAu * divergenceSlope;

    return [
      buildDirectionalGuideLine(
        sourceMarker,
        markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR,
        {
          points: [sourceMarker, incomingTransitionPoint, focalPoint, endPoint],
          renderStyle: "lightRay",
          opacity: markerCatalog.MATRYOSHKA_CONE_ALPHA ?? 0.35,
          lightRayRadiusProfileAu: [
            incomingRadiusAu,
            incomingRadiusAu,
            focalRadiusAu,
            outgoingRadiusAu
          ],
          lightRayDashPattern: markerCatalog.DIRECTIONAL_SOURCE_CONE_DASH_PATTERN
        },
        dependencies
      )
    ].filter(Boolean);
  }

  function createMatryoshkaFocalLineHighlight(sourceMarker, dependencies) {
    if (!sourceMarker) return null;

    const { constants, math, markerCatalog } = dependencies;
    const focalDistancesAu = markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.map(
      (layerDefinition) =>
        constants.SOLAR_GRAVITATIONAL_LENS_AU + (layerDefinition.focalOffsetAu ?? 0)
    )
      .filter((distanceAu) => Number.isFinite(distanceAu))
      .sort((a, b) => a - b);
    if (focalDistancesAu.length < 2) return null;

    const firstPinchDistanceAu = focalDistancesAu[0];
    const lastPinchDistanceAu = focalDistancesAu[focalDistancesAu.length - 1];
    if (lastPinchDistanceAu <= firstPinchDistanceAu + 1e-6) return null;

    const firstPinchPoint = math.pointOnRadiusAlongDirection(sourceMarker, -firstPinchDistanceAu);
    const lastPinchPoint = math.pointOnRadiusAlongDirection(sourceMarker, -lastPinchDistanceAu);
    const highlightRadiusAu = Math.max(
      markerCatalog.DIRECTIONAL_CONE_TIP_RADIUS_AU * 320,
      markerCatalog.DIRECTIONAL_CONE_MAX_WIDTH_AU * 0.012
    );
    const midPinchDistanceAu = (firstPinchDistanceAu + lastPinchDistanceAu) * 0.5;
    const labelAnchorPoint = math.pointOnRadiusAlongDirection(sourceMarker, -midPinchDistanceAu);

    return buildDirectionalGuideLine(
      sourceMarker,
      "#ffe7a2",
      {
        points: [firstPinchPoint, lastPinchPoint],
        renderStyle: "lightRay",
        opacity: 0.92,
        lightRayStartRadiusAu: highlightRadiusAu,
        lightRayEndRadiusAu: highlightRadiusAu,
        showStartRim: false,
        showEndRim: false,
        depthTest: false,
        label: "focal line",
        labelAnchorPoint,
        labelMarginPixels: 12
      },
      dependencies
    );
  }

  function createMatryoshkaSourceGuideShape(sourceMarker, dependencies) {
    if (!sourceMarker) return [];

    const guideLines = [];
    for (const layerDefinition of dependencies.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS) {
      guideLines.push(...createMatryoshkaConeLayer(sourceMarker, layerDefinition, dependencies));
    }

    const focalLineHighlight = createMatryoshkaFocalLineHighlight(sourceMarker, dependencies);
    if (focalLineHighlight) {
      guideLines.push(focalLineHighlight);
    }

    return guideLines;
  }

  function buildDirectionalGuideLines(sourceMarkers, dependencies) {
    if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0) {
      return [];
    }

    const maxMatryoshkaFocalOffsetAu =
      dependencies.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.reduce(
        (maxOffsetAu, layerDefinition) =>
          Math.max(maxOffsetAu, layerDefinition.focalOffsetAu ?? 0),
        0
      );
    const guideLineDependencies = {
      ...dependencies,
      directionalGuidePostFocalEndDistanceAu:
        dependencies.constants.SOLAR_GRAVITATIONAL_LENS_AU +
        maxMatryoshkaFocalOffsetAu +
        dependencies.markerCatalog.DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU
    };

    const guideLines = [];
    for (const sourceMarker of sourceMarkers) {
      guideLines.push(...createMatryoshkaSourceGuideShape(sourceMarker, guideLineDependencies));
    }

    return guideLines;
  }

  namespace.application.factories.buildDirectionalGuideLines = buildDirectionalGuideLines;
})();
