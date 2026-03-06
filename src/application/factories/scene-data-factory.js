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

    createOrbitalBody(item, defaultOrbitColor) {
      const orbitRadius = Math.max(item.au || 1, 1e-6);
      return {
        ...item,
        theta: this.random() * Math.PI * 2,
        meanMotion:
          item.speed ||
          this.constants.EARTH_MEAN_MOTION / Math.pow(orbitRadius, 1.5),
        inclination: this.math.degToRad(item.inclinationDeg || 0),
        node: this.math.degToRad(item.nodeDeg || 0),
        periapsisArg: this.math.degToRad(item.periapsisArgDeg || 0),
        eccentricity: this.math.clamp(item.eccentricity || 0, 0, 0.999),
        orbitColor: item.orbitColor || defaultOrbitColor
      };
    }

    seedBodies(definitions, defaultOrbitColor) {
      return definitions.map((item) => this.createOrbitalBody(item, defaultOrbitColor));
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
      return definitions.map((item) => {
        if (item.position) {
          return {
            ...item,
            x: item.position.x,
            y: item.position.y,
            z: item.position.z
          };
        }

        const direction = this.math.randomUnitVector3D(this.random);
        return {
          ...item,
          x: direction.x * item.startAu,
          y: direction.y * item.startAu,
          z: direction.z * item.startAu
        };
      });
    }

    createVoyagers(definitions) {
      return definitions.map((voyager) => ({
        ...voyager,
        position: { ...voyager.position },
        renderRadius: voyager.radiusKm / this.constants.KM_PER_AU
      }));
    }

    createDriftingBodiesWithRenderRadius(definitions) {
      return this.createDriftingBodies(definitions).map((body) => ({
        ...body,
        renderRadius: body.radiusKm / this.constants.KM_PER_AU
      }));
    }

    createAsteroidBelt(config) {
      const particles = [];
      const maxInclinationRad = this.math.degToRad(config.maxInclinationDeg);

      for (let i = 0; i < config.count; i += 1) {
        const au = config.innerAu + this.random() * (config.outerAu - config.innerAu);
        const eccentricity =
          config.eccentricityMin +
          this.random() * (config.eccentricityMax - config.eccentricityMin);
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
            (config.timeScale || 1)
        });
      }

      return {
        ...config,
        particles
      };
    }

    createOortCloud(config) {
      const particles = [];
      const innerCubed = Math.pow(config.innerAu, 3);
      const outerCubed = Math.pow(config.outerAu, 3);

      for (let i = 0; i < config.count; i += 1) {
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
        ...config,
        particles
      };
    }

    createStars(count) {
      const items = [];
      for (let i = 0; i < count; i += 1) {
        const distance =
          this.beltCatalog.STAR_DISTANCE_MIN_AU +
          this.random() *
            (this.beltCatalog.STAR_DISTANCE_MAX_AU -
              this.beltCatalog.STAR_DISTANCE_MIN_AU);
        const theta = this.random() * Math.PI * 2;
        const phi = Math.acos(2 * this.random() - 1);
        items.push({
          x: distance * Math.sin(phi) * Math.cos(theta),
          y: distance * Math.cos(phi),
          z: distance * Math.sin(phi) * Math.sin(theta)
        });
      }
      return items;
    }

    createOrbitOpacityCalculator(orbitingBodies) {
      if (!orbitingBodies.length) {
        return () => 0.4;
      }

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

      return (radiusKm) => {
        const minOpacity = 0.1;
        const maxOpacity = 0.4;
        const safeRadius = Math.max(1, radiusKm || 1);
        if (logSpan < 1e-9) return maxOpacity;

        const t = this.math.clamp((Math.log(safeRadius) - minLog) / logSpan, 0, 1);
        return minOpacity + (maxOpacity - minOpacity) * t;
      };
    }

    prepareOrbitGroupBodies(sourceBodies, group, orbitOpacityForBodyRadius) {
      const shouldUseRadiusOrbitOpacity = group.key !== "comets";
      const groupOrbitColor = group.orbitColor || this.constants.ORBIT_COLOR;

      for (const body of sourceBodies) {
        body.orbitRadius = body.au;
        body.renderRadius = body.radiusKm / this.constants.KM_PER_AU;
        body.orbitColor = groupOrbitColor;
        body.orbitOpacity = shouldUseRadiusOrbitOpacity
          ? orbitOpacityForBodyRadius(body.radiusKm)
          : 0.1;
        body.orbitPath = this.math.orbitPoints(
          body.orbitRadius,
          body.inclination,
          body.node,
          group.segments,
          body.eccentricity,
          body.periapsisArg
        );
      }
    }

    createSceneData() {
      const planets = this.seedBodies(
        this.planetCatalog.PLANET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );
      const dwarfPlanets = this.seedBodies(
        this.dwarfPlanetCatalog.DWARF_PLANET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );
      const comets = this.seedBodies(
        this.cometCatalog.COMET_DEFINITIONS,
        this.constants.ORBIT_COLOR
      );

      const orbitingBodies = [...planets, ...dwarfPlanets];
      const orbitOpacityForBodyRadius = this.createOrbitOpacityCalculator(orbitingBodies);
      const orbitGroupBodies = {
        planets,
        dwarfPlanets,
        comets
      };

      for (const group of this.beltCatalog.ORBIT_RENDER_GROUPS) {
        this.prepareOrbitGroupBodies(
          orbitGroupBodies[group.key] || [],
          group,
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
      const c61Marker =
        directionalMarkers.find((marker) => marker.name === "61 Cygni") || null;
      const gliese300Marker =
        directionalMarkers.find((marker) => marker.name === "Gliese 300") || null;

      const directionalGuideLines =
        this.guideLineFactory.createMatryoshkaSourceGuideShapes(directionalMarkers);
      const spacecraftTrajectoryGuideLine =
        this.guideLineFactory.createSpacecraftTrajectoryGuideLine(
          c61Marker,
          gliese300Marker
        );
      if (spacecraftTrajectoryGuideLine) {
        directionalGuideLines.push(spacecraftTrajectoryGuideLine);
      }

      return {
        planets,
        dwarfPlanets,
        comets,
        orbitRenderGroups: this.beltCatalog.ORBIT_RENDER_GROUPS,
        voyagers: this.createVoyagers(this.rawDefinitions.VOYAGERS),
        driftingBodies: this.createDriftingBodiesWithRenderRadius(
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
