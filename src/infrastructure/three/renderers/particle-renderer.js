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

  function buildPositionBufferFromPoints(points) {
    if (!Array.isArray(points) || points.length === 0) {
      return new Float32Array(0);
    }

    const positions = new Float32Array(points.length * 3);
    let offset = 0;
    for (const point of points) {
      positions[offset] = point.x;
      positions[offset + 1] = point.y;
      positions[offset + 2] = point.z;
      offset += 3;
    }
    return positions;
  }

  function resolvePointCloudPositions(pointCloud, fallbackPoints) {
    if (pointCloud?.positions instanceof Float32Array) {
      return pointCloud.positions;
    }

    return buildPositionBufferFromPoints(fallbackPoints);
  }

  function populateBeltPositionsFromParticles(positions, particles, math, orbitalPositionScratch) {
    let offset = 0;

    for (const particle of particles) {
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
  }

  class ParticleRenderer {
    static clamp01(value) {
      return Math.min(1, Math.max(0, value));
    }

    static inverseLerp(start, end, value) {
      if (Math.abs(end - start) < 1e-6) {
        return value >= end ? 1 : 0;
      }

      return ParticleRenderer.clamp01((value - start) / (end - start));
    }

    static smoothstep(start, end, value) {
      const t = ParticleRenderer.inverseLerp(start, end, value);
      return t * t * (3 - 2 * t);
    }

    buildStarField(sceneData, particleGroup) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("buildStarField: missing THREE.");
      }

      const positions = resolvePointCloudPositions(sceneData.stars, sceneData.stars);

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

      const oortCloud = sceneData.oortCloud;
      const positions = resolvePointCloudPositions(oortCloud, oortCloud?.particles);

      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

      const oortCloudPoints = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: oortCloud.color,
          size: 3,
          transparent: true,
          opacity: Math.min(0.1, oortCloud.alpha * 0.75),
          sizeAttenuation: true,
          depthWrite: false
        })
      );

      particleGroup.add(oortCloudPoints);
    }

    buildAsteroidBelts(sceneData, particleGroup, beltRuntimes, math, orbitalPositionScratch) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("buildAsteroidBelts: missing THREE.");
      }

      const orbitalPosition = orbitalPositionScratch || { x: 0, y: 0, z: 0 };

      for (const belt of sceneData.asteroidBelts) {
        const particleCount =
          belt.particleCount ??
          belt.orbitRadius?.length ??
          belt.particles?.length ??
          0;
        const positions =
          belt.positions instanceof Float32Array
            ? belt.positions
            : new Float32Array(particleCount * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
        const baseOpacity = Math.min(
          belt.maxOpacity ?? 0.22,
          belt.alpha * (belt.opacityScale ?? 0.2)
        );

        const points = new THREE.Points(
          geometry,
          new THREE.PointsMaterial({
            color: belt.color,
            size: belt.particleSize ?? 0.02,
            transparent: true,
            opacity: baseOpacity,
            sizeAttenuation: true,
            depthWrite: false
          })
        );

        particleGroup.add(points);
        beltRuntimes.push({
          belt,
          count: particleCount,
          geometry,
          positions,
          points,
          orbitRadius: belt.orbitRadius || null,
          theta: belt.theta || null,
          inclination: belt.inclination || null,
          node: belt.node || null,
          eccentricity: belt.eccentricity || null,
          periapsisArg: belt.periapsisArg || null,
          meanMotion: belt.meanMotion || null,
          innerAu: belt.innerAu,
          outerAu: belt.outerAu,
          baseOpacity,
          minOpacityFactor: belt.minOpacityFactor ?? 0.12,
          fadeStartAngularRadius: belt.fadeStartAngularRadius ?? 0.08,
          fadeEndAngularRadius: belt.fadeEndAngularRadius ?? 0.02
        });

        if (!(belt.positions instanceof Float32Array) && Array.isArray(belt.particles)) {
          populateBeltPositionsFromParticles(
            positions,
            belt.particles,
            math,
            orbitalPosition
          );
        }

        geometry.attributes.position.needsUpdate = true;
      }
    }

    updateAsteroidBeltVisuals(beltRuntimes, camera) {
      if (!camera || !Array.isArray(beltRuntimes) || beltRuntimes.length === 0) {
        return;
      }

      const cameraDistance = Math.max(camera.position.length(), 1e-4);

      for (const beltRuntime of beltRuntimes) {
        const {
          points,
          baseOpacity,
          minOpacityFactor,
          fadeStartAngularRadius,
          fadeEndAngularRadius,
          innerAu,
          outerAu
        } = beltRuntime;
        if (!points || !points.material) {
          continue;
        }

        const beltRadius = ((innerAu || 0) + (outerAu || 0)) * 0.5;
        const angularRadius = beltRadius / cameraDistance;
        const closeVisibility = ParticleRenderer.smoothstep(
          fadeEndAngularRadius,
          fadeStartAngularRadius,
          angularRadius
        );
        const opacityFactor =
          minOpacityFactor + (1 - minOpacityFactor) * closeVisibility;
        points.material.opacity = baseOpacity * opacityFactor;
      }
    }
  }

  namespace.infrastructure.three.renderers.ParticleRenderer = ParticleRenderer;
})();
