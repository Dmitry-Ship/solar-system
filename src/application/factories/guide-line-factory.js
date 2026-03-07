(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("guide-line factory bootstrap failed: missing application factories namespace.");
  }

  const MATRYOSHKA_SEGMENT_POINT_COUNT = 26;
  const MATRYOSHKA_PRE_SUN_EXPANSION_POWER = 3.75;
  const MATRYOSHKA_OUTER_SOURCE_RADIUS_FACTOR = 0.045;
  const MATRYOSHKA_INNER_SOURCE_RADIUS_FACTOR = 0.018;
  const MATRYOSHKA_SOURCE_RADIUS_MIN_MULTIPLIER = 18;
  const LIGHT_RAY_DISTANCE_FADE_POWER = 2.2;

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

  function pointDistance(a, b) {
    return Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z);
  }

  function buildDistanceFadeProfile(points, marker) {
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
      const normalizedDistance = clamp01(
        (distance - minDistanceFromSource) / Math.max(distanceRange, 1e-6)
      );
      return 1 - Math.pow(normalizedDistance, LIGHT_RAY_DISTANCE_FADE_POWER);
    });
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

  function buildLightRayOpacityProfile(points, marker, options, fallbackOpacity) {
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
      return rawOpacityProfile
        ? Math.min(opacity, distanceLimitedOpacity)
        : distanceLimitedOpacity;
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
    const lightRayOpacityProfile = buildLightRayOpacityProfile(points, marker, options, opacity);

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

    for (let step = 0; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
      const t = MATRYOSHKA_SEGMENT_POINT_COUNT <= 0 ? 1 : step / MATRYOSHKA_SEGMENT_POINT_COUNT;
      const distanceAu = sourceDistanceAu * (1 - t);
      const radiusAu = lerp(
        sourceRadiusAu,
        sunCrossingRadiusAu,
        Math.pow(t, MATRYOSHKA_PRE_SUN_EXPANSION_POWER)
      );
      const opacity = peakOpacity;
      points.push(
        step === 0
          ? clonePoint(sourceMarker)
          : math.pointOnRadiusAlongDirection(sourceMarker, distanceAu)
      );
      lightRayRadiusProfileAu.push(radiusAu);
      lightRayOpacityProfile.push(opacity);
    }

    for (let step = 1; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
      const t =
        MATRYOSHKA_SEGMENT_POINT_COUNT <= 0 ? 1 : step / MATRYOSHKA_SEGMENT_POINT_COUNT;
      const distanceAu = focusDistanceAu * t;
      const radiusAu = lerp(sunCrossingRadiusAu, focalPointRadiusAu, t);
      const opacity = peakOpacity;
      points.push(math.pointOnRadiusAlongDirection(sourceMarker, -distanceAu));
      lightRayRadiusProfileAu.push(radiusAu);
      lightRayOpacityProfile.push(opacity);
    }

    for (let step = 1; step <= MATRYOSHKA_SEGMENT_POINT_COUNT; step += 1) {
      const t =
        MATRYOSHKA_SEGMENT_POINT_COUNT <= 0 ? 1 : step / MATRYOSHKA_SEGMENT_POINT_COUNT;
      const distanceAu = lerp(focusDistanceAu, postFocusEndDistanceAu, t);
      const radiusAu = focusSlopeAuPerAu * Math.max(0, distanceAu - focusDistanceAu);
      const opacity = peakOpacity;
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
          visibilityLabel: sourceMarker.name,
          visibilityControlLabel: `${sourceMarker.name} Ray`,
          visibilityGroupKey: "light-rays",
          visibilityGroupLabel: "Light Rays",
          initialVisibility: false
        },
        dependencies
      )
    ].filter(Boolean);
  }

  function createMatryoshkaFocalLine(sourceMarker, dependencies) {
    if (!sourceMarker) return null;

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

    return buildDirectionalGuideLine(
      sourceMarker,
      markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR,
      {
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
      },
      dependencies
    );
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

    const focalLine = createMatryoshkaFocalLine(sourceMarker, dependencies);
    if (focalLine) {
      guideLines.push(focalLine);
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
