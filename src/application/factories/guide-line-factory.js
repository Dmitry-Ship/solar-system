(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("guide-line factory bootstrap failed: missing application factories namespace.");
  }

  const MATRYOSHKA_PRE_SUN_POINT_COUNT = 18;
  const MATRYOSHKA_POST_SUN_COLLAPSE_POINT_COUNT = 12;
  const MATRYOSHKA_POST_FOCUS_EXPANSION_POINT_COUNT = 16;
  const MATRYOSHKA_PRE_SUN_EXPANSION_POWER = 1.75;
  const MATRYOSHKA_OUTER_SOURCE_RADIUS_FACTOR = 0.045;
  const MATRYOSHKA_INNER_SOURCE_RADIUS_FACTOR = 0.018;
  const MATRYOSHKA_SOURCE_RADIUS_MIN_MULTIPLIER = 18;
  const MATRYOSHKA_SOURCE_OPACITY_FACTOR = 0.34;
  const MATRYOSHKA_FOCUS_OPACITY_FACTOR = 0.62;
  const MATRYOSHKA_END_OPACITY_FACTOR = 0.42;

  function clamp01(value) {
    return Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  }

  function lerp(start, end, t) {
    return start + (end - start) * t;
  }

  function clonePoint(point) {
    return {
      x: point.x,
      y: point.y,
      z: point.z
    };
  }

  function pointMagnitude(point) {
    return Math.hypot(point.x, point.y, point.z);
  }

  function buildLightRayVisibilityKey(name) {
    const normalizedName = typeof name === "string" ? name.trim().toLowerCase() : "";
    if (!normalizedName) {
      return "light-ray";
    }

    return `light-ray:${normalizedName.replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "")}`;
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

  function buildLightRayOpacityProfile(points, options, fallbackOpacity) {
    const rawOpacityProfile =
      Array.isArray(options.lightRayOpacityProfile) &&
      options.lightRayOpacityProfile.length === points.length
        ? options.lightRayOpacityProfile
        : null;

    return points.map((_, index) => {
      const fallback = Math.max(0, Number.isFinite(fallbackOpacity) ? fallbackOpacity : 0);
      const opacity = rawOpacityProfile?.[index] ?? fallback;
      return clamp01(opacity);
    });
  }

  function buildDirectionalGuideLine(marker, color, options = {}, dependencies) {
    if (!marker) return null;

    const lightRayRadiusAu = options.lightRayRadiusAu ?? 0;
    const fallbackStartRadiusAu = options.lightRayStartRadiusAu ?? lightRayRadiusAu;
    const fallbackEndRadiusAu = options.lightRayEndRadiusAu ?? lightRayRadiusAu;
    const points = resolveGuideLinePoints(marker, options, dependencies);
    const opacity = options.opacity ?? 0.96;
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
    const lightRayOpacityProfile = buildLightRayOpacityProfile(points, options, opacity);

    return {
      points,
      color,
      renderStyle: options.renderStyle || "line",
      opacity,
      showStartRim: options.showStartRim ?? true,
      showEndRim: options.showEndRim ?? true,
      lightRayRadiusAu,
      lightRayStartRadiusAu,
      lightRayEndRadiusAu,
      lightRayRadiusProfileAu,
      lightRayOpacityProfile,
      lightRayLayerIndex: Number.isFinite(options.lightRayLayerIndex)
        ? Math.max(0, Math.floor(options.lightRayLayerIndex))
        : 0,
      lightRayDashPattern: options.lightRayDashPattern || [],
      dashPattern: options.dashPattern || [],
      depthTest: options.depthTest,
      visibilityKey: options.visibilityKey || "",
      visibilityLabel: options.visibilityLabel || "",
      label: options.label || "",
      labelAnchorPoint: options.labelAnchorPoint ? clonePoint(options.labelAnchorPoint) : null,
      labelMarginPixels: options.labelMarginPixels
    };
  }

  function buildMatryoshkaCylinderProfile(
    sourceMarker,
    sourceRadiusAu,
    sunCrossingRadiusAu,
    peakOpacity,
    focusDistanceAu,
    postFocusEndDistanceAu,
    math
  ) {
    const points = [];
    const lightRayRadiusProfileAu = [];
    const lightRayOpacityProfile = [];
    const sourceDistanceAu = pointMagnitude(sourceMarker);
    const focalPointRadiusAu = 0;
    const focusSlopeAuPerAu = sunCrossingRadiusAu / Math.max(focusDistanceAu, 1e-6);

    for (let step = 0; step <= MATRYOSHKA_PRE_SUN_POINT_COUNT; step += 1) {
      const t = MATRYOSHKA_PRE_SUN_POINT_COUNT <= 0 ? 1 : step / MATRYOSHKA_PRE_SUN_POINT_COUNT;
      const distanceAu = sourceDistanceAu * (1 - t);
      const radiusAu = lerp(
        sourceRadiusAu,
        sunCrossingRadiusAu,
        Math.pow(t, MATRYOSHKA_PRE_SUN_EXPANSION_POWER)
      );
      const opacity = lerp(
        peakOpacity * MATRYOSHKA_SOURCE_OPACITY_FACTOR,
        peakOpacity,
        Math.pow(t, 1.15)
      );
      points.push(
        step === 0
          ? clonePoint(sourceMarker)
          : math.pointOnRadiusAlongDirection(sourceMarker, distanceAu)
      );
      lightRayRadiusProfileAu.push(radiusAu);
      lightRayOpacityProfile.push(opacity);
    }

    for (let step = 1; step <= MATRYOSHKA_POST_SUN_COLLAPSE_POINT_COUNT; step += 1) {
      const t =
        MATRYOSHKA_POST_SUN_COLLAPSE_POINT_COUNT <= 0
          ? 1
          : step / MATRYOSHKA_POST_SUN_COLLAPSE_POINT_COUNT;
      const distanceAu = focusDistanceAu * t;
      const radiusAu = lerp(sunCrossingRadiusAu, focalPointRadiusAu, t);
      const opacity = lerp(
        peakOpacity,
        peakOpacity * MATRYOSHKA_FOCUS_OPACITY_FACTOR,
        Math.pow(t, 0.9)
      );
      points.push(math.pointOnRadiusAlongDirection(sourceMarker, -distanceAu));
      lightRayRadiusProfileAu.push(radiusAu);
      lightRayOpacityProfile.push(opacity);
    }

    for (let step = 1; step <= MATRYOSHKA_POST_FOCUS_EXPANSION_POINT_COUNT; step += 1) {
      const t =
        MATRYOSHKA_POST_FOCUS_EXPANSION_POINT_COUNT <= 0
          ? 1
          : step / MATRYOSHKA_POST_FOCUS_EXPANSION_POINT_COUNT;
      const distanceAu = lerp(focusDistanceAu, postFocusEndDistanceAu, t);
      const radiusAu = focusSlopeAuPerAu * Math.max(0, distanceAu - focusDistanceAu);
      const opacity = lerp(
        peakOpacity * MATRYOSHKA_FOCUS_OPACITY_FACTOR,
        peakOpacity * MATRYOSHKA_END_OPACITY_FACTOR,
        Math.pow(t, 0.95)
      );
      points.push(math.pointOnRadiusAlongDirection(sourceMarker, -distanceAu));
      lightRayRadiusProfileAu.push(radiusAu);
      lightRayOpacityProfile.push(opacity);
    }

    return { points, lightRayRadiusProfileAu, lightRayOpacityProfile };
  }

  function createMatryoshkaConeLayer(
    sourceMarker,
    layerDefinition,
    layerIndex,
    layerCount,
    dependencies
  ) {
    const {
      constants,
      math,
      markerCatalog,
      directionalGuideSharedEndDistanceAu
    } = dependencies;
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
    const { points, lightRayRadiusProfileAu, lightRayOpacityProfile } =
      buildMatryoshkaCylinderProfile(
        sourceMarker,
        sourceRadiusAu,
        sunCrossingRadiusAu,
        peakOpacity,
        focusDistanceAu,
        directionalGuideSharedEndDistanceAu,
        math
      );

    return [
      buildDirectionalGuideLine(
        sourceMarker,
        markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR,
        {
          points,
          renderStyle: "lightRay",
          opacity: peakOpacity,
          lightRayRadiusProfileAu,
          lightRayOpacityProfile,
          lightRayLayerIndex: layerIndex,
          visibilityKey: buildLightRayVisibilityKey(sourceMarker.name),
          visibilityLabel: sourceMarker.name
        },
        dependencies
      )
    ].filter(Boolean);
  }

  function createMatryoshkaSourceGuideShape(sourceMarker, dependencies) {
    if (!sourceMarker) return [];

    const guideLines = [];
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

    return guideLines;
  }

  function buildDirectionalGuideLines(sourceMarkers, dependencies) {
    if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0) {
      return [];
    }

    const maxMatryoshkaFocusDistanceAu =
      dependencies.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.reduce(
        (maxDistanceAu, layerDefinition) =>
          Math.max(
            maxDistanceAu,
            dependencies.constants.SOLAR_GRAVITATIONAL_LENS_AU +
              (layerDefinition.focalOffsetAu ?? 0)
          ),
        dependencies.constants.SOLAR_GRAVITATIONAL_LENS_AU
      );
    const guideLineDependencies = {
      ...dependencies,
      directionalGuideSharedEndDistanceAu:
        maxMatryoshkaFocusDistanceAu +
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
