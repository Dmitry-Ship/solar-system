(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("scene-data factory bootstrap failed: missing application factories namespace.");
  }

  class SceneDataFactory {
    constructor(options) {
      this.constants = options.constants;
      this.math = options.math;
      this.random = options.random || Math.random;

      this.planetCatalog = options.planetCatalog;
      this.dwarfPlanetCatalog = options.dwarfPlanetCatalog;
      this.cometCatalog = options.cometCatalog;
      this.markerCatalog = options.markerCatalog;
      this.beltCatalog = options.beltCatalog;
      this.rawDefinitions = options.rawDefinitions;
      this.guideLineFactory = options.guideLineFactory;
    }

    createOrbitingBody(bodyDefinition, defaultOrbitColor) {
      const orbitRadius = Math.max(bodyDefinition.au || 1, 1e-6);
      return {
        ...bodyDefinition,
        theta: this.random() * Math.PI * 2,
        meanMotion:
          bodyDefinition.speed ||
          this.constants.EARTH_MEAN_MOTION / Math.pow(orbitRadius, 1.5),
        inclination: this.math.degToRad(bodyDefinition.inclinationDeg || 0),
        node: this.math.degToRad(bodyDefinition.nodeDeg || 0),
        periapsisArg: this.math.degToRad(bodyDefinition.periapsisArgDeg || 0),
        eccentricity: this.math.clamp(bodyDefinition.eccentricity || 0, 0, 0.999),
        orbitColor: bodyDefinition.orbitColor || defaultOrbitColor
      };
    }

    createOrbitingBodies(definitions, defaultOrbitColor) {
      return definitions.map((definition) =>
        this.createOrbitingBody(definition, defaultOrbitColor)
      );
    }

    markerOnSphereFromRaDec(
      name,
      sphereRadiusAu,
      raHours,
      decDeg,
      color,
      minPixelRadius = 2.3,
      label = name
    ) {
      const equatorial = this.math.unitVectorFromEquatorialRaDec(raHours, decDeg);
      const eclipticDirection = this.math.normalizeVector(
        this.math.equatorialToEcliptic(equatorial)
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

    createDriftingBodies(definitions) {
      return definitions.map((bodyDefinition) => {
        if (bodyDefinition.position) {
          return {
            ...bodyDefinition,
            x: bodyDefinition.position.x,
            y: bodyDefinition.position.y,
            z: bodyDefinition.position.z
          };
        }

        const direction = this.math.randomUnitVector3D(this.random);
        return {
          ...bodyDefinition,
          x: direction.x * bodyDefinition.startAu,
          y: direction.y * bodyDefinition.startAu,
          z: direction.z * bodyDefinition.startAu
        };
      });
    }

    createVoyagerSceneBodies(definitions) {
      return definitions.map((voyagerDefinition) => ({
        ...voyagerDefinition,
        position: { ...voyagerDefinition.position },
        renderRadius: voyagerDefinition.radiusKm / this.constants.KM_PER_AU
      }));
    }

    createRenderableDriftingBodies(definitions) {
      return this.createDriftingBodies(definitions).map((driftingBody) => ({
        ...driftingBody,
        renderRadius: driftingBody.radiusKm / this.constants.KM_PER_AU
      }));
    }

    createAsteroidBelt(beltConfig) {
      const particles = [];
      const maxInclinationRad = this.math.degToRad(beltConfig.maxInclinationDeg);

      for (let i = 0; i < beltConfig.count; i += 1) {
        const au =
          beltConfig.innerAu +
          this.random() * (beltConfig.outerAu - beltConfig.innerAu);
        const eccentricity =
          beltConfig.eccentricityMin +
          this.random() * (beltConfig.eccentricityMax - beltConfig.eccentricityMin);
        const inclination = maxInclinationRad * Math.pow(this.random(), 1.8);

        particles.push({
          au,
          orbitRadius: au,
          eccentricity,
          theta: this.random() * Math.PI * 2,
          inclination,
          node: this.random() * Math.PI * 2,
          periapsisArg: this.random() * Math.PI * 2,
          meanMotion:
            (this.constants.EARTH_MEAN_MOTION / Math.pow(Math.max(au, 0.2), 1.5)) *
            (beltConfig.timeScale || 1)
        });
      }

      return {
        ...beltConfig,
        particles
      };
    }

    createOortCloud(cloudConfig) {
      const particles = [];
      const innerCubed = Math.pow(cloudConfig.innerAu, 3);
      const outerCubed = Math.pow(cloudConfig.outerAu, 3);

      for (let i = 0; i < cloudConfig.count; i += 1) {
        const radius = Math.cbrt(innerCubed + this.random() * (outerCubed - innerCubed));
        const theta = this.random() * Math.PI * 2;
        const yUnit = this.random() * 2 - 1;
        const radial = Math.sqrt(Math.max(0, 1 - yUnit * yUnit));

        particles.push({
          x: radius * radial * Math.cos(theta),
          y: radius * yUnit,
          z: radius * radial * Math.sin(theta)
        });
      }

      return {
        ...cloudConfig,
        particles
      };
    }

    createStars(count) {
      const starPositions = [];
      for (let i = 0; i < count; i += 1) {
        const distance =
          this.beltCatalog.STAR_DISTANCE_MIN_AU +
          this.random() *
            (this.beltCatalog.STAR_DISTANCE_MAX_AU -
              this.beltCatalog.STAR_DISTANCE_MIN_AU);
        const theta = this.random() * Math.PI * 2;
        const phi = Math.acos(2 * this.random() - 1);
        starPositions.push({
          x: distance * Math.sin(phi) * Math.cos(theta),
          y: distance * Math.cos(phi),
          z: distance * Math.sin(phi) * Math.sin(theta)
        });
      }
      return starPositions;
    }

    createOrbitOpacityCalculator(orbitingBodies) {
      if (!orbitingBodies.length) {
        return () => 0.4;
      }

      let minOrbitBodyRadiusKm = Infinity;
      let maxOrbitBodyRadiusKm = 0;
      for (const orbitingBody of orbitingBodies) {
        const safeRadius = Math.max(1, orbitingBody.radiusKm || 1);
        minOrbitBodyRadiusKm = Math.min(minOrbitBodyRadiusKm, safeRadius);
        maxOrbitBodyRadiusKm = Math.max(maxOrbitBodyRadiusKm, safeRadius);
      }

      const minLog = Math.log(minOrbitBodyRadiusKm);
      const maxLog = Math.log(maxOrbitBodyRadiusKm);
      const logSpan = maxLog - minLog;

      return (radiusKm) => {
        const minOpacity = 0.1;
        const maxOpacity = 0.4;
        const safeRadius = Math.max(1, radiusKm || 1);
        if (logSpan < 1e-9) return maxOpacity;

        const t = this.math.clamp((Math.log(safeRadius) - minLog) / logSpan, 0, 1);
        return minOpacity + (maxOpacity - minOpacity) * t;
      };
    }

    applyOrbitRenderMetadata(
      orbitingBodies,
      orbitRenderGroupConfig,
      orbitOpacityForBodyRadius
    ) {
      const shouldUseRadiusOrbitOpacity = orbitRenderGroupConfig.key !== "comets";
      const orbitColor =
        orbitRenderGroupConfig.orbitColor || this.constants.ORBIT_COLOR;

      for (const orbitingBody of orbitingBodies) {
        orbitingBody.orbitRadius = orbitingBody.au;
        orbitingBody.renderRadius = orbitingBody.radiusKm / this.constants.KM_PER_AU;
        orbitingBody.orbitColor = orbitColor;
        orbitingBody.orbitOpacity = shouldUseRadiusOrbitOpacity
          ? orbitOpacityForBodyRadius(orbitingBody.radiusKm)
          : 0.1;
        orbitingBody.orbitPath = this.math.orbitPoints(
          orbitingBody.orbitRadius,
          orbitingBody.inclination,
          orbitingBody.node,
          orbitRenderGroupConfig.segments,
          orbitingBody.eccentricity,
          orbitingBody.periapsisArg
        );
      }
    }

    createSceneData() {
      const planets = this.createOrbitingBodies(
        this.planetCatalog.PLANET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );
      const dwarfPlanets = this.createOrbitingBodies(
        this.dwarfPlanetCatalog.DWARF_PLANET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );
      const comets = this.createOrbitingBodies(
        this.cometCatalog.COMET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );

      const orbitOpacityBodies = [...planets, ...dwarfPlanets];
      const orbitOpacityForBodyRadius = this.createOrbitOpacityCalculator(orbitOpacityBodies);
      const orbitingBodiesByGroupKey = {
        planets,
        dwarfPlanets,
        comets
      };
      const orbitRenderGroupConfigs = this.beltCatalog.ORBIT_RENDER_GROUPS;

      for (const orbitRenderGroupConfig of orbitRenderGroupConfigs) {
        this.applyOrbitRenderMetadata(
          orbitingBodiesByGroupKey[orbitRenderGroupConfig.key] || [],
          orbitRenderGroupConfig,
          orbitOpacityForBodyRadius
        );
      }

      const directionalMarkers = this.markerCatalog.DIRECTIONAL_MARKER_DEFINITIONS.map(
        (definition) =>
          this.markerOnSphereFromRaDec(
            definition.name,
            this.markerCatalog.DIRECTIONAL_MARKER_DISTANCE_AU,
            definition.raHours,
            definition.decDeg,
            definition.color,
            definition.minPixelRadius,
            definition.label
          )
      );
      const directionalGuideLines =
        this.guideLineFactory.createMatryoshkaSourceGuideShapes(directionalMarkers);

      return {
        planets,
        dwarfPlanets,
        comets,
        orbitRenderGroupConfigs,
        orbitRenderGroups: orbitRenderGroupConfigs,
        voyagers: this.createVoyagerSceneBodies(this.rawDefinitions.VOYAGERS),
        driftingBodies: this.createRenderableDriftingBodies(
          this.rawDefinitions.DRIFTING_BODIES
        ),
        directionalMarkers,
        directionalGuideLines,
        asteroidBelts: this.beltCatalog.ASTEROID_BELT_CONFIGS.map((beltConfig) =>
          this.createAsteroidBelt(beltConfig)
        ),
        oortCloud: this.createOortCloud(this.beltCatalog.OORT_CLOUD_CONFIG),
        stars: this.createStars(1700)
      };
    }
  }

  namespace.application.factories.SceneDataFactory = SceneDataFactory;
})();
