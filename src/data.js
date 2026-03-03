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
    DIRECTIONAL_GUIDE_PARALLEL_SECTION_END_AU,
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
        Math.max(maxOffsetAu, Math.max(0, layerDefinition.focalOffsetAu || 0)),
      0
    );
  const DIRECTIONAL_GUIDE_POST_FOCAL_END_DISTANCE_AU =
    constants.SOLAR_GRAVITATIONAL_LENS_AU +
    MAX_MATRYOSHKA_FOCAL_OFFSET_AU +
    DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU;

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

  function directionalGuideLineFromMarker(marker, color, options = {}) {
    if (!marker) return null;

    const cylinderRadiusAu = options.cylinderRadiusAu ?? 0;
    const fallbackStartRadiusAu =
      options.cylinderStartRadiusAu ?? cylinderRadiusAu;
    const fallbackEndRadiusAu = options.cylinderEndRadiusAu ?? cylinderRadiusAu;
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
    const points =
      Array.isArray(options.points) && options.points.length >= 2
        ? options.points.map((point) => ({
            x: point.x,
            y: point.y,
            z: point.z
          }))
        : [fallbackStartPoint, fallbackEndPoint];
    const rawRadiusProfile =
      Array.isArray(options.cylinderRadiusProfileAu) &&
      options.cylinderRadiusProfileAu.length === points.length
        ? options.cylinderRadiusProfileAu
        : null;
    const cylinderRadiusProfileAu = points.map((_, index) => {
      const t = points.length <= 1 ? 0 : index / (points.length - 1);
      const fallbackRadius =
        fallbackStartRadiusAu + (fallbackEndRadiusAu - fallbackStartRadiusAu) * t;
      const radius = rawRadiusProfile?.[index] ?? fallbackRadius;
      return Math.max(0, Number.isFinite(radius) ? radius : 0);
    });
    const cylinderStartRadiusAu = cylinderRadiusProfileAu[0] || 0;
    const cylinderEndRadiusAu =
      cylinderRadiusProfileAu[cylinderRadiusProfileAu.length - 1] || 0;

    return {
      points,
      color,
      renderStyle: options.renderStyle || "line",
      showStartRim: options.showStartRim ?? true,
      showEndRim: options.showEndRim ?? true,
      cylinderRadiusAu,
      cylinderStartRadiusAu,
      cylinderEndRadiusAu,
      cylinderRadiusProfileAu,
      cylinderDashPattern: options.cylinderDashPattern || [],
      startAlpha: options.startAlpha ?? 0.96,
      endAlpha: options.endAlpha ?? 0.1,
      dashPattern: options.dashPattern || []
    };
  }

  function createMatryoshkaConeLayer(sourceMarker, layerDefinition) {
    const focalDistanceAu =
      constants.SOLAR_GRAVITATIONAL_LENS_AU +
      Math.max(0, layerDefinition.focalOffsetAu || 0);
    const incomingTransitionPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      DIRECTIONAL_GUIDE_PARALLEL_SECTION_END_AU
    );
    const focalPoint = math.pointOnRadiusAlongDirection(
      sourceMarker,
      -focalDistanceAu
    );
    const endDistanceAu = DIRECTIONAL_GUIDE_POST_FOCAL_END_DISTANCE_AU;
    const endPoint = math.pointOnRadiusAlongDirection(sourceMarker, -endDistanceAu);
    const coneMaxWidthAu =
      DIRECTIONAL_CONE_MAX_WIDTH_AU *
      Math.max(0.05, layerDefinition.maxWidthScale || 0);
    const incomingRadiusAu = coneMaxWidthAu * 0.5;
    const focalRadiusAu =
      DIRECTIONAL_CONE_TIP_RADIUS_AU *
      Math.max(0.05, layerDefinition.tipRadiusScale || 0);
    const convergenceSpanAu =
      DIRECTIONAL_GUIDE_PARALLEL_SECTION_END_AU + focalDistanceAu;
    const divergenceSpanAu = endDistanceAu - focalDistanceAu;
    const prePinchRadiusDeltaAu = Math.max(0, incomingRadiusAu - focalRadiusAu);
    const divergenceSlope =
      prePinchRadiusDeltaAu / Math.max(convergenceSpanAu, 1e-6);
    const outgoingRadiusAu = focalRadiusAu + divergenceSpanAu * divergenceSlope;
    const alpha = Math.max(0.08, Math.min(0.95, layerDefinition.alpha ?? 0.55));

    return [
      directionalGuideLineFromMarker(sourceMarker, DIRECTIONAL_SOURCE_CONE_COLOR, {
        points: [sourceMarker, incomingTransitionPoint, focalPoint, endPoint],
        renderStyle: "cylinder",
        cylinderRadiusProfileAu: [
          incomingRadiusAu,
          incomingRadiusAu,
          focalRadiusAu,
          outgoingRadiusAu
        ],
        cylinderDashPattern: DIRECTIONAL_SOURCE_CONE_DASH_PATTERN,
        startAlpha: alpha,
        endAlpha: alpha
      })
    ].filter(Boolean);
  }

  function createMatryoshkaSourceGuideShape(sourceMarker) {
    if (!sourceMarker) return [];

    const guideLines = [];

    for (const layerDefinition of MATRYOSHKA_CONE_LAYER_DEFINITIONS) {
      guideLines.push(...createMatryoshkaConeLayer(sourceMarker, layerDefinition));
    }

    return guideLines;
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
      const minOpacity = 0.0001;
      const maxOpacity = 0.2;
      const safeRadius = Math.max(1, radiusKm || 1);
      if (logSpan < 1e-9) return maxOpacity;

      const t = math.clamp((Math.log(safeRadius) - minLog) / logSpan, 0, 1);
      return minOpacity + (maxOpacity - minOpacity) * t;
    };
  }

  function createSceneData() {
    const planets = seedBodies(PLANET_DEFINITIONS, constants.ORBIT_COLOR);
    const dwarfPlanets = seedBodies(
      DWARF_PLANET_DEFINITIONS,
      constants.ORBIT_COLOR
    );
    const comets = seedBodies(COMET_DEFINITIONS, constants.ORBIT_COLOR);
    const orbitingBodies = [...planets, ...dwarfPlanets];

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

    const gliese300Marker = directionalMarkerByName["Gliese 300"] || null;

    const directionalGuideLines = createMatryoshkaSourceGuideShape(gliese300Marker);

    return {
      planets,
      dwarfPlanets,
      comets,
      orbitRenderGroups: ORBIT_RENDER_GROUPS,
      orbitOpacityForBodyRadius: createOrbitOpacityCalculator(orbitingBodies),
      voyagers: VOYAGERS.map((voyager) => ({
        ...voyager,
        position: { ...voyager.position }
      })),
      driftingBodies: createDriftingBodies(DRIFTING_BODIES),
      directionalMarkers,
      directionalGuideLines,
      asteroidBelts: ASTEROID_BELT_CONFIGS.map((belt) => createAsteroidBelt(belt)),
      oortCloud: createOortCloud(OORT_CLOUD_CONFIG),
      stars: createStars(1700)
    };
  }

  namespace.data = {
    createSceneData
  };
})();
