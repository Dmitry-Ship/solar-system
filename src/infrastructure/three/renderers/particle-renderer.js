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

      const positions = sceneData.stars.positions;

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
      const positions = oortCloud.positions;

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

      for (const belt of sceneData.asteroidBelts) {
        const positions = belt.positions;
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
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
          points,
          innerAu: belt.innerAu,
          outerAu: belt.outerAu,
          baseOpacity,
          minOpacityFactor: belt.minOpacityFactor ?? 0.12,
          fadeStartAngularRadius: belt.fadeStartAngularRadius ?? 0.08,
          fadeEndAngularRadius: belt.fadeEndAngularRadius ?? 0.02
        });
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
