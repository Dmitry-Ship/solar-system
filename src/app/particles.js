(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.buildStarField = function buildStarField(sceneData, particleGroup) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildStarField: missing THREE.");
    }

    const positions = new Float32Array(sceneData.stars.length * 3);
    let offset = 0;
    for (const star of sceneData.stars) {
      positions[offset] = star.x;
      positions[offset + 1] = star.y;
      positions[offset + 2] = star.z;
      offset += 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#dbe6ff",
        size: 1.2,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: false,
        depthWrite: false
      })
    );

    particleGroup.add(stars);
  };

  app.buildOortCloud = function buildOortCloud(sceneData, particleGroup) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildOortCloud: missing THREE.");
    }

    const particles = sceneData.oortCloud.particles;
    const positions = new Float32Array(particles.length * 3);
    let offset = 0;

    for (const particle of particles) {
      positions[offset] = particle.x;
      positions[offset + 1] = particle.y;
      positions[offset + 2] = particle.z;
      offset += 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const oortCloud = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: sceneData.oortCloud.color,
        size: 2.2,
        transparent: true,
        opacity: Math.min(0.05, sceneData.oortCloud.alpha),
        sizeAttenuation: true,
        depthWrite: false
      })
    );

    particleGroup.add(oortCloud);
  };

  app.buildAsteroidBelts = function buildAsteroidBelts(
    sceneData,
    particleGroup,
    beltRuntimes,
    math,
    orbitalPositionScratch
  ) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildAsteroidBelts: missing THREE.");
    }

    for (const belt of sceneData.asteroidBelts) {
      const positions = new Float32Array(belt.particles.length * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: belt.color,
          size: 1.15,
          transparent: true,
          opacity: Math.min(0.1, belt.alpha * 1.2),
          sizeAttenuation: false,
          depthWrite: false
        })
      );

      particleGroup.add(points);
      beltRuntimes.push({ belt, geometry, positions });

      let offset = 0;
      for (const particle of belt.particles) {
        math.orbitalPositionInto(
          orbitalPositionScratch,
          particle.orbitRadius,
          particle.theta,
          particle.inclination,
          particle.node,
          0,
          particle.eccentricity,
          particle.periapsisArg
        );

        positions[offset] = orbitalPositionScratch.x;
        positions[offset + 1] = orbitalPositionScratch.y;
        positions[offset + 2] = orbitalPositionScratch.z;
        offset += 3;
      }

      geometry.attributes.position.needsUpdate = true;
    }
  };

  app.createAsteroidBeltsUpdater = function createAsteroidBeltsUpdater(options) {
    const { beltRuntimes, math, normalizeAngle } = options;
    const orbitalPositionScratch = options.orbitalPositionScratch || { x: 0, y: 0, z: 0 };
    const motionTimeScale = options.motionTimeScale ?? 1;

    return function updateAsteroidBelts(deltaSeconds) {
      for (const beltRuntime of beltRuntimes) {
        const { belt, positions, geometry } = beltRuntime;
        let offset = 0;

        for (const particle of belt.particles) {
          particle.theta = normalizeAngle(
            particle.theta + particle.meanMotion * deltaSeconds * motionTimeScale
          );

          math.orbitalPositionInto(
            orbitalPositionScratch,
            particle.orbitRadius,
            particle.theta,
            particle.inclination,
            particle.node,
            0,
            particle.eccentricity,
            particle.periapsisArg
          );

          positions[offset] = orbitalPositionScratch.x;
          positions[offset + 1] = orbitalPositionScratch.y;
          positions[offset + 2] = orbitalPositionScratch.z;
          offset += 3;
        }

        geometry.attributes.position.needsUpdate = true;
      }
    };
  };
})();
