(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("scene-data factory bootstrap failed: missing application factories namespace.");
  }
  const buildDirectionalGuideLines = namespace.application.factories.buildDirectionalGuideLines;
  if (!buildDirectionalGuideLines) {
    throw new Error("scene-data factory bootstrap failed: missing directional guide-line builder.");
  }

  const DEFAULT_ORBIT_COLOR = "#b0bdc1";

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
    }

    createOrbitingBody(bodyDefinition) {
      return {
        ...bodyDefinition,
        theta: this.random() * Math.PI * 2,
        inclination: this.math.degToRad(bodyDefinition.inclinationDeg || 0),
        node: this.math.degToRad(bodyDefinition.nodeDeg || 0),
        periapsisArg: this.math.degToRad(bodyDefinition.periapsisArgDeg || 0),
        eccentricity: this.math.clamp(bodyDefinition.eccentricity || 0, 0, 0.999)
      };
    }

    createOrbitingBodies(definitions) {
      return definitions.map((definition) => this.createOrbitingBody(definition));
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

    resolveDirectionalMarkerDistanceAu(markerDefinition, defaultDistanceAu) {
      return Number.isFinite(markerDefinition?.distanceAu)
        ? markerDefinition.distanceAu
        : defaultDistanceAu;
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
      const particleCount = beltConfig.count;
      const positions = new Float32Array(particleCount * 3);
      const maxInclinationRad = this.math.degToRad(beltConfig.maxInclinationDeg);
      const orbitalPositionScratch = { x: 0, y: 0, z: 0 };

      for (let index = 0; index < particleCount; index += 1) {
        const au =
          beltConfig.innerAu +
          this.random() * (beltConfig.outerAu - beltConfig.innerAu);
        const particleEccentricity =
          beltConfig.eccentricityMin +
          this.random() * (beltConfig.eccentricityMax - beltConfig.eccentricityMin);
        const particleInclination = maxInclinationRad * Math.pow(this.random(), 1.8);
        const particleTheta = this.random() * Math.PI * 2;
        const particleNode = this.random() * Math.PI * 2;
        const particlePeriapsisArg = this.random() * Math.PI * 2;
        const positionOffset = index * 3;

        this.math.orbitalPositionInto(
          orbitalPositionScratch,
          au,
          particleTheta,
          particleInclination,
          particleNode,
          0,
          particleEccentricity,
          particlePeriapsisArg
        );

        positions[positionOffset] = orbitalPositionScratch.x;
        positions[positionOffset + 1] = orbitalPositionScratch.y;
        positions[positionOffset + 2] = orbitalPositionScratch.z;
      }

      return {
        ...beltConfig,
        particleCount,
        positions
      };
    }

    createStars(count) {
      const positions = new Float32Array(count * 3);

      for (let index = 0; index < count; index += 1) {
        const distance =
          this.beltCatalog.STAR_DISTANCE_MIN_AU +
          this.random() *
            (this.beltCatalog.STAR_DISTANCE_MAX_AU -
              this.beltCatalog.STAR_DISTANCE_MIN_AU);
        const theta = this.random() * Math.PI * 2;
        const phi = Math.acos(2 * this.random() - 1);
        const positionOffset = index * 3;
        positions[positionOffset] = distance * Math.sin(phi) * Math.cos(theta);
        positions[positionOffset + 1] = distance * Math.cos(phi);
        positions[positionOffset + 2] = distance * Math.sin(phi) * Math.sin(theta);
      }

      return {
        count,
        positions
      };
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
      const orbitColor = orbitRenderGroupConfig.orbitColor || DEFAULT_ORBIT_COLOR;

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
      const planets = this.createOrbitingBodies(this.planetCatalog.PLANET_DEFINITIONS);
      const dwarfPlanets = this.createOrbitingBodies(
        this.dwarfPlanetCatalog.DWARF_PLANET_DEFINITIONS
      );
      const comets = this.createOrbitingBodies(this.cometCatalog.COMET_DEFINITIONS);

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
      const directionalMarkerDistanceAu =
        (this.beltCatalog.STAR_DISTANCE_MIN_AU + this.beltCatalog.STAR_DISTANCE_MAX_AU) * 0.5;
      const directionalMarkers = this.markerCatalog.DIRECTIONAL_MARKER_DEFINITIONS.map(
        (definition) =>
          this.markerOnSphereFromRaDec(
            definition.name,
            this.resolveDirectionalMarkerDistanceAu(
              definition,
              directionalMarkerDistanceAu
            ),
            definition.raHours,
            definition.decDeg,
            definition.color,
            definition.minPixelRadius,
            definition.label
          )
      );
      const directionalGuideLines =
        buildDirectionalGuideLines(directionalMarkers, {
          constants: this.constants,
          math: this.math,
          markerCatalog: this.markerCatalog
        });

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
        stars: this.createStars(1700)
      };
    }
  }

  namespace.application.factories.SceneDataFactory = SceneDataFactory;
})();
