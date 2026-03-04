(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const { constants, math, dataDefinitions } = namespace;

  if (!constants || !math || !dataDefinitions) {
    throw new Error(
      "SolarSystem data bootstrap failed: missing constants, math, or data definitions."
    );
  }

  const {
    PLANET_DEFINITIONS,
    DWARF_PLANET_DEFINITIONS,
    COMET_DEFINITIONS,
    VOYAGERS,
    DRIFTING_BODIES,
    DIRECTIONAL_MARKER_DEFINITIONS,
    DIRECTIONAL_CONE_MAX_WIDTH_AU,
    DIRECTIONAL_CONE_TIP_RADIUS_AU,
    DIRECTIONAL_SOURCE_CONE_COLOR,
    DIRECTIONAL_SOURCE_CONE_DASH_PATTERN,
    DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU,
    MATRYOSHKA_CONE_LAYER_DEFINITIONS,
    STAR_DISTANCE_MIN_AU,
    STAR_DISTANCE_MAX_AU,
    DIRECTIONAL_MARKER_DISTANCE_AU,
    ASTEROID_BELT_CONFIGS,
    OORT_CLOUD_CONFIG,
    ORBIT_RENDER_GROUPS
  } = dataDefinitions;
  const MAX_MATRYOSHKA_FOCAL_OFFSET_AU =
    MATRYOSHKA_CONE_LAYER_DEFINITIONS.reduce(
      (maxOffsetAu, layerDefinition) =>
        Math.max(maxOffsetAu, layerDefinition.focalOffsetAu ?? 0),
      0
    );
  const DIRECTIONAL_GUIDE_POST_FOCAL_END_DISTANCE_AU =
    constants.SOLAR_GRAVITATIONAL_LENS_AU +
    MAX_MATRYOSHKA_FOCAL_OFFSET_AU +
    DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU;
  const SPACECRAFT_TRAJECTORY_STOP_DISTANCE_AU = 2500;

  function seedBodies(definitions, defaultOrbitColor) {
    return definitions.map((item) => ({
      ...item,
      theta: Math.random() * Math.PI * 2,
      // Approximate Kepler's third law: period ~ a^(3/2), so mean motion ~ a^(-3/2).
      meanMotion:
        item.speed ||
        constants.EARTH_MEAN_MOTION / Math.pow(Math.max(item.au || 1, 1e-6), 1.5),
      inclination: math.degToRad(item.inclinationDeg || 0),
      node: math.degToRad(item.nodeDeg || 0),
      periapsisArg: math.degToRad(item.periapsisArgDeg || 0),
      eccentricity: math.clamp(item.eccentricity || 0, 0, 0.999),
      orbitColor: item.orbitColor || defaultOrbitColor
    }));
  }

  function markerOnSphereFromRaDec(
    name,
    sphereRadiusAu,
    raHours,
    decDeg,
    color,
    minPixelRadius = 2.3,
    label = name
  ) {
    // Convert catalog coordinates (RA/Dec) to ecliptic space, then place on a fixed sphere.
    const equatorial = math.unitVectorFromEquatorialRaDec(raHours, decDeg);
    const eclipticDirection = math.normalizeVector(
      math.equatorialToEcliptic(equatorial)
    );
    return {
      name,
      label,
      color,
      minPixelRadius,
      x: eclipticDirection.x * sphereRadiusAu,
      y: eclipticDirection.y * sphereRadiusAu,
      z: eclipticDirection.z * sphereRadiusAu
    };
  }

  function createDriftingBodies(definitions) {
    return definitions.map((item) => {
      if (item.position) {
        return {
          ...item,
          x: item.position.x,
          y: item.position.y,
          z: item.position.z
        };
      }

      const direction = math.randomUnitVector3D();
      return {
        ...item,
        x: direction.x * item.startAu,
        y: direction.y * item.startAu,
        z: direction.z * item.startAu
      };
    });
  }

  function createAsteroidBelt(config) {
    const particles = [];
    const maxInclinationRad = math.degToRad(config.maxInclinationDeg);

    for (let i = 0; i < config.count; i += 1) {
      const au = config.innerAu + Math.random() * (config.outerAu - config.innerAu);
      const eccentricity =
        config.eccentricityMin +
        Math.random() * (config.eccentricityMax - config.eccentricityMin);
      const inclination = maxInclinationRad * Math.pow(Math.random(), 1.8);

      particles.push({
        au,
        eccentricity,
        theta: Math.random() * Math.PI * 2,
        inclination,
        node: Math.random() * Math.PI * 2,
        periapsisArg: Math.random() * Math.PI * 2,
        meanMotion:
          (constants.EARTH_MEAN_MOTION / Math.pow(Math.max(au, 0.2), 1.5)) *
          (config.timeScale || 1)
      });
    }

    return {
      ...config,
      particles
    };
  }

  function createOortCloud(config) {
    const particles = [];
    const innerCubed = Math.pow(config.innerAu, 3);
    const outerCubed = Math.pow(config.outerAu, 3);

    for (let i = 0; i < config.count; i += 1) {
      // Sample radius in cubic space so particle density is roughly uniform by volume.
      const radius = Math.cbrt(innerCubed + Math.random() * (outerCubed - innerCubed));
      const theta = Math.random() * Math.PI * 2;
      const yUnit = Math.random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));

      particles.push({
        x: radius * radial * Math.cos(theta),
        y: radius * yUnit,
        z: radius * radial * Math.sin(theta)
      });
    }

    return {
      ...config,
      particles
    };
  }

  function createStars(count) {
    const items = [];
    for (let i = 0; i < count; i += 1) {
      const distance =
        STAR_DISTANCE_MIN_AU +
        Math.random() * (STAR_DISTANCE_MAX_AU - STAR_DISTANCE_MIN_AU);
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      items.push({
        x: distance * Math.sin(phi) * Math.cos(theta),
        y: distance * Math.cos(phi),
        z: distance * Math.sin(phi) * Math.sin(theta)
      });
    }
    return items;
  }

  function clonePoint(point) {
    return {
      x: point.x,
      y: point.y,
      z: point.z
    };
  }

  function offsetPointAlongDirection(point, direction, distance) {
    return {
      x: point.x + direction.x * distance,
      y: point.y + direction.y * distance,
      z: point.z + direction.z * distance
    };
  }

  function cubicBezierPoint(pointA, controlA, controlB, pointB, t) {
    const u = 1 - t;
    const uu = u * u;
    const tt = t * t;
    const uuu = uu * u;
    const ttt = tt * t;
    return {
      x:
        pointA.x * uuu +
        3 * controlA.x * uu * t +
        3 * controlB.x * u * tt +
        pointB.x * ttt,
      y:
        pointA.y * uuu +
        3 * controlA.y * uu * t +
        3 * controlB.y * u * tt +
        pointB.y * ttt,
      z:
        pointA.z * uuu +
        3 * controlA.z * uu * t +
        3 * controlB.z * u * tt +
        pointB.z * ttt
    };
  }

  function createCubicBezierPolyline(
    pointA,
    controlA,
    controlB,
    pointB,
    segmentCount
  ) {
    const safeSegments = Math.max(2, Math.floor(segmentCount || 0));
    const points = [];
    for (let index = 0; index <= safeSegments; index += 1) {
      const t = index / safeSegments;
      points.push(cubicBezierPoint(pointA, controlA, controlB, pointB, t));
    }
    return points;
  }

  function createLinearPolyline(pointA, pointB, segmentCount) {
    const safeSegments = Math.max(1, Math.floor(segmentCount || 0));
    const points = [];
    for (let index = 0; index <= safeSegments; index += 1) {
      const t = index / safeSegments;
      points.push({
        x: pointA.x + (pointB.x - pointA.x) * t,
        y: pointA.y + (pointB.y - pointA.y) * t,
        z: pointA.z + (pointB.z - pointA.z) * t
      });
    }
    return points;
  }

  function resolveGuideLinePoints(marker, options) {
    const fallbackStartPoint =
      options.startPoint ||
      math.pointOnRadiusAlongDirection(
        marker,
        -constants.SOLAR_GRAVITATIONAL_LENS_AU
      );
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
      lightRayEndRadiusAu:
        lightRayRadiusProfileAu[lightRayRadiusProfileAu.length - 1] || 0
    };
  }

  function directionalGuideLineFromMarker(marker, color, options = {}) {
    if (!marker) return null;

    const lightRayRadiusAu = options.lightRayRadiusAu ?? 0;
    const fallbackStartRadiusAu =
      options.lightRayStartRadiusAu ?? lightRayRadiusAu;
    const fallbackEndRadiusAu = options.lightRayEndRadiusAu ?? lightRayRadiusAu;
    const points = resolveGuideLinePoints(marker, options);
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
      labelAnchorPoint: options.labelAnchorPoint
        ? clonePoint(options.labelAnchorPoint)
        : null,
      labelMarginPixels: options.labelMarginPixels
    };
  }

  function createMatryoshkaConeLayer(sourceMarker, layerDefinition) {
    const focalDistanceAu =
      constants.SOLAR_GRAVITATIONAL_LENS_AU +
      (layerDefinition.focalOffsetAu ?? 0);
    // Keep the light-ray-to-cone junction anchored at the Sun.
    const incomingTransitionPoint = { x: 0, y: 0, z: 0 };
    const focalPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -focalDistanceAu
    );
    const endDistanceAu = DIRECTIONAL_GUIDE_POST_FOCAL_END_DISTANCE_AU;
    const endPoint = math.pointOnRadiusAlongDirection(sourceMarker, -endDistanceAu);
    const coneMaxWidthAu =
      DIRECTIONAL_CONE_MAX_WIDTH_AU *
      layerDefinition.maxWidthScale;
    const incomingRadiusAu = coneMaxWidthAu * 0.5;
    const focalRadiusAu =
      DIRECTIONAL_CONE_TIP_RADIUS_AU *
      layerDefinition.tipRadiusScale;
    const incomingTransitionDistanceAu = Math.hypot(
      incomingTransitionPoint.x,
      incomingTransitionPoint.y,
      incomingTransitionPoint.z
    );
    const convergenceSpanAu = incomingTransitionDistanceAu + focalDistanceAu;
    const divergenceSpanAu = endDistanceAu - focalDistanceAu;
    const prePinchRadiusDeltaAu = Math.max(0, incomingRadiusAu - focalRadiusAu);
    const divergenceSlope =
      prePinchRadiusDeltaAu / Math.max(convergenceSpanAu, 1e-6);
    const outgoingRadiusAu = focalRadiusAu + divergenceSpanAu * divergenceSlope;
    return [
      directionalGuideLineFromMarker(sourceMarker, DIRECTIONAL_SOURCE_CONE_COLOR, {
        points: [sourceMarker, incomingTransitionPoint, focalPoint, endPoint],
        renderStyle: "lightRay",
        opacity: layerDefinition.alpha ?? 0.55,
        lightRayRadiusProfileAu: [
          incomingRadiusAu,
          incomingRadiusAu,
          focalRadiusAu,
          outgoingRadiusAu
        ],
        lightRayDashPattern: DIRECTIONAL_SOURCE_CONE_DASH_PATTERN
      })
    ].filter(Boolean);
  }

  function createMatryoshkaFocalLineHighlight(sourceMarker) {
    if (!sourceMarker) return null;

    const focalDistancesAu = MATRYOSHKA_CONE_LAYER_DEFINITIONS.map(
      (layerDefinition) =>
        constants.SOLAR_GRAVITATIONAL_LENS_AU +
        (layerDefinition.focalOffsetAu ?? 0)
    )
      .filter((distanceAu) => Number.isFinite(distanceAu))
      .sort((a, b) => a - b);
    if (focalDistancesAu.length < 2) return null;

    const firstPinchDistanceAu = focalDistancesAu[0];
    const lastPinchDistanceAu = focalDistancesAu[focalDistancesAu.length - 1];
    if (lastPinchDistanceAu <= firstPinchDistanceAu + 1e-6) return null;

    const firstPinchPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -firstPinchDistanceAu
    );
    const lastPinchPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -lastPinchDistanceAu
    );
    const highlightRadiusAu = Math.max(
      DIRECTIONAL_CONE_TIP_RADIUS_AU * 320,
      DIRECTIONAL_CONE_MAX_WIDTH_AU * 0.012
    );
    const midPinchDistanceAu = (firstPinchDistanceAu + lastPinchDistanceAu) * 0.5;
    const labelAnchorPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -midPinchDistanceAu
    );

    return directionalGuideLineFromMarker(sourceMarker, "#ffe7a2", {
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
    });
  }

  function createMatryoshkaSourceGuideShape(sourceMarker) {
    if (!sourceMarker) return [];

    const guideLines = [];

    for (const layerDefinition of MATRYOSHKA_CONE_LAYER_DEFINITIONS) {
      guideLines.push(...createMatryoshkaConeLayer(sourceMarker, layerDefinition));
    }

    const focalLineHighlight = createMatryoshkaFocalLineHighlight(sourceMarker);
    if (focalLineHighlight) {
      guideLines.push(focalLineHighlight);
    }

    return guideLines;
  }

  function createSpacecraftTrajectoryGuideLine(sourceMarker, oppositeSideReferenceMarker) {
    if (!sourceMarker || !oppositeSideReferenceMarker) return null;

    const focalLineOuterPoint = math.pointOnRadiusAlongDirection(
      oppositeSideReferenceMarker,
      -SPACECRAFT_TRAJECTORY_STOP_DISTANCE_AU
    );
    const focalLinePoint = math.pointOnRadiusAlongDirection(
      oppositeSideReferenceMarker,
      -constants.SOLAR_GRAVITATIONAL_LENS_AU
    );
    const focalAxisOutwardDirection = math.normalizeVector({
      x: -oppositeSideReferenceMarker.x,
      y: -oppositeSideReferenceMarker.y,
      z: -oppositeSideReferenceMarker.z
    });
    const focalAxisInwardDirection = {
      x: -focalAxisOutwardDirection.x,
      y: -focalAxisOutwardDirection.y,
      z: -focalAxisOutwardDirection.z
    };

    const sourceToFocalOuterVector = {
      x: focalLineOuterPoint.x - sourceMarker.x,
      y: focalLineOuterPoint.y - sourceMarker.y,
      z: focalLineOuterPoint.z - sourceMarker.z
    };
    const sourceToFocalOuterDistanceAu = Math.hypot(
      sourceToFocalOuterVector.x,
      sourceToFocalOuterVector.y,
      sourceToFocalOuterVector.z
    );
    if (sourceToFocalOuterDistanceAu <= 1e-6) return null;

    const sourceApproachDirection = math.normalizeVector(sourceToFocalOuterVector);
    const firstTurnStartHandleAu = sourceToFocalOuterDistanceAu * 0.72;
    const firstTurnEndHandleAu = sourceToFocalOuterDistanceAu * 0.26;
    const firstTurnControlA = offsetPointAlongDirection(
      sourceMarker,
      sourceApproachDirection,
      firstTurnStartHandleAu
    );
    const firstTurnControlB = offsetPointAlongDirection(
      focalLineOuterPoint,
      focalAxisOutwardDirection,
      firstTurnEndHandleAu
    );
    const turnIntoFocalLinePoints = createCubicBezierPolyline(
      sourceMarker,
      firstTurnControlA,
      firstTurnControlB,
      focalLineOuterPoint,
      54
    );
    const focalRunPoints = createLinearPolyline(
      focalLineOuterPoint,
      focalLinePoint,
      26
    );

    const exitPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -SPACECRAFT_TRAJECTORY_STOP_DISTANCE_AU
    );
    const focalToExitVector = {
      x: exitPoint.x - focalLinePoint.x,
      y: exitPoint.y - focalLinePoint.y,
      z: exitPoint.z - focalLinePoint.z
    };
    const focalToExitDistanceAu = Math.hypot(
      focalToExitVector.x,
      focalToExitVector.y,
      focalToExitVector.z
    );
    if (focalToExitDistanceAu <= 1e-6) return null;

    const exitDirection = math.normalizeVector({
      x: -sourceMarker.x,
      y: -sourceMarker.y,
      z: -sourceMarker.z
    });
    const secondTurnStartHandleAu = Math.max(
      constants.SOLAR_GRAVITATIONAL_LENS_AU * 0.38,
      focalToExitDistanceAu * 0.28
    );
    const secondTurnEndHandleAu = Math.max(
      constants.HELIOPAUSE_AU * 1.1,
      focalToExitDistanceAu * 0.2
    );
    const secondTurnControlA = offsetPointAlongDirection(
      focalLinePoint,
      focalAxisInwardDirection,
      secondTurnStartHandleAu
    );
    const secondTurnControlB = offsetPointAlongDirection(
      exitPoint,
      exitDirection,
      -secondTurnEndHandleAu
    );
    const turnOutPoints = createCubicBezierPolyline(
      focalLinePoint,
      secondTurnControlA,
      secondTurnControlB,
      exitPoint,
      56
    );
    const trajectoryPoints = [
      ...turnIntoFocalLinePoints,
      ...focalRunPoints.slice(1),
      ...turnOutPoints.slice(1)
    ];
    const labelAnchorPoint =
      trajectoryPoints[Math.floor(trajectoryPoints.length * 0.64)] || exitPoint;

    return directionalGuideLineFromMarker(sourceMarker, "#ffe8a6", {
      points: trajectoryPoints,
      opacity: 0.96,
      dashPattern: [10, 6],
      depthTest: false,
      label: "spacecraft trajectory",
      labelAnchorPoint,
      labelMarginPixels: 10
    });
  }

  function createOrbitOpacityCalculator(orbitingBodies) {
    let minOrbitBodyRadiusKm = Infinity;
    let maxOrbitBodyRadiusKm = 0;
    for (const body of orbitingBodies) {
      const safeRadius = Math.max(1, body.radiusKm || 1);
      minOrbitBodyRadiusKm = Math.min(minOrbitBodyRadiusKm, safeRadius);
      maxOrbitBodyRadiusKm = Math.max(maxOrbitBodyRadiusKm, safeRadius);
    }

    const minLog = Math.log(minOrbitBodyRadiusKm);
    const maxLog = Math.log(maxOrbitBodyRadiusKm);
    const logSpan = maxLog - minLog;

    return function orbitOpacityForBodyRadius(radiusKm) {
      const minOpacity = 0.1;
      const maxOpacity = 0.4;
      const safeRadius = Math.max(1, radiusKm || 1);
      if (logSpan < 1e-9) return maxOpacity;

      const t = math.clamp((Math.log(safeRadius) - minLog) / logSpan, 0, 1);
      return minOpacity + (maxOpacity - minOpacity) * t;
    };
  }

  function prepareOrbitGroupBodies(
    sourceBodies,
    group,
    orbitOpacityForBodyRadius
  ) {
    const shouldUseRadiusOrbitOpacity = group.key !== "comets";
    const groupOrbitColor = group.orbitColor || constants.ORBIT_COLOR;

    for (const body of sourceBodies) {
      body.orbitRadius = body.au;
      body.renderRadius = body.radiusKm / constants.KM_PER_AU;
      body.orbitColor = groupOrbitColor;
      body.orbitOpacity = shouldUseRadiusOrbitOpacity
        ? orbitOpacityForBodyRadius(body.radiusKm)
        : 0.1;
      body.orbitPath = math.orbitPoints(
        body.orbitRadius,
        body.inclination,
        body.node,
        group.segments,
        body.eccentricity,
        body.periapsisArg
      );
    }
  }

  function createSceneData() {
    const planets = seedBodies(PLANET_DEFINITIONS, constants.ORBIT_COLOR);
    const dwarfPlanets = seedBodies(
      DWARF_PLANET_DEFINITIONS,
      constants.ORBIT_COLOR
    );
    const comets = seedBodies(COMET_DEFINITIONS, constants.ORBIT_COLOR);
    const orbitingBodies = [...planets, ...dwarfPlanets];
    const orbitOpacityForBodyRadius = createOrbitOpacityCalculator(orbitingBodies);
    const orbitGroupBodies = {
      planets,
      dwarfPlanets,
      comets
    };

    for (const group of ORBIT_RENDER_GROUPS) {
      const sourceBodies = orbitGroupBodies[group.key] || [];
      prepareOrbitGroupBodies(sourceBodies, group, orbitOpacityForBodyRadius);
    }

    const directionalMarkers = DIRECTIONAL_MARKER_DEFINITIONS.map((definition) =>
      markerOnSphereFromRaDec(
        definition.name,
        DIRECTIONAL_MARKER_DISTANCE_AU,
        definition.raHours,
        definition.decDeg,
        definition.color,
        definition.minPixelRadius,
        definition.label
      )
    );
    const directionalMarkerByName = Object.fromEntries(
      directionalMarkers.map((marker) => [marker.name, marker])
    );

    const c61Marker = directionalMarkerByName["61 Cygni"] || null;
    const gliese300Marker = directionalMarkerByName["Gliese 300"] || null;

    const directionalGuideLines = createMatryoshkaSourceGuideShape(gliese300Marker);
    const spacecraftTrajectoryGuideLine = createSpacecraftTrajectoryGuideLine(
      c61Marker,
      gliese300Marker
    );
    if (spacecraftTrajectoryGuideLine) {
      directionalGuideLines.push(spacecraftTrajectoryGuideLine);
    }

    const voyagers = VOYAGERS.map((voyager) => ({
      ...voyager,
      position: { ...voyager.position },
      renderRadius: voyager.radiusKm / constants.KM_PER_AU
    }));
    const driftingBodies = createDriftingBodies(DRIFTING_BODIES).map((body) => ({
      ...body,
      renderRadius: body.radiusKm / constants.KM_PER_AU
    }));
    const asteroidBelts = ASTEROID_BELT_CONFIGS.map((beltConfig) => {
      const belt = createAsteroidBelt(beltConfig);
      for (const particle of belt.particles) {
        particle.orbitRadius = particle.au;
      }
      return belt;
    });

    return {
      planets,
      dwarfPlanets,
      comets,
      orbitRenderGroups: ORBIT_RENDER_GROUPS,
      voyagers,
      driftingBodies,
      directionalMarkers,
      directionalGuideLines,
      asteroidBelts,
      oortCloud: createOortCloud(OORT_CLOUD_CONFIG),
      stars: createStars(1700)
    };
  }

  namespace.data = {
    createSceneData
  };
})();
