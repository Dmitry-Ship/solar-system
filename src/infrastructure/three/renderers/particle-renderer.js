(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("particle renderer bootstrap failed: missing three renderers namespace.");
  }

  class ParticleRenderer {
    buildStarField(sceneData, particleGroup) {
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
    }

    buildOortCloud(sceneData, particleGroup) {
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
          size: 3,
          transparent: true,
          opacity: Math.min(0.1, sceneData.oortCloud.alpha * 0.75),
          sizeAttenuation: true,
          depthWrite: false
        })
      );

      particleGroup.add(oortCloud);
    }

    buildAsteroidBelts(sceneData, particleGroup, beltRuntimes, math, orbitalPositionScratch) {
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
            size: 0.02,
            transparent: true,
            opacity: Math.min(0.22, belt.alpha * 0.2),
            sizeAttenuation: true,
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
    }
  }

  namespace.infrastructure.three.renderers.ParticleRenderer = ParticleRenderer;
})();
