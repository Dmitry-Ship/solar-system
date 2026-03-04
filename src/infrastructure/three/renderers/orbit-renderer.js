(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("orbit renderer bootstrap failed: missing three renderers namespace.");
  }

  class OrbitRenderer {
    constructor(options) {
      this.bodyRenderer = options.bodyRenderer;
    }

    buildOrbitLine(points, color, opacity) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("buildOrbitLine: missing THREE.");
      }

      const geometry = new THREE.BufferGeometry();
      const positionArray = new Float32Array(points.length * 3);

      let offset = 0;
      for (const point of points) {
        positionArray[offset] = point.x;
        positionArray[offset + 1] = point.y;
        positionArray[offset + 2] = point.z;
        offset += 3;
      }

      geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity
      });

      return new THREE.Line(geometry, material);
    }

    buildOrbitingBodies(
      sceneData,
      orbitGroup,
      bodyGroup,
      bodyGeometry,
      bodyRuntimes,
      orbitalSourceBodies,
      math
    ) {
      const orbitalPositionScratch = { x: 0, y: 0, z: 0 };
      const namesToggleTargetGroups = new Set(["planets", "dwarfPlanets", "comets"]);
      const labelObjectTypeByGroupKey = {
        planets: "planet",
        dwarfPlanets: "dwarf-planet",
        comets: "comet"
      };

      for (const group of sceneData.orbitRenderGroups) {
        const sourceBodies = sceneData[group.key] || [];
        for (const sourceBody of sourceBodies) {
          const orbitLine = this.buildOrbitLine(
            sourceBody.orbitPath,
            sourceBody.orbitColor,
            sourceBody.orbitOpacity
          );
          orbitGroup.add(orbitLine);

          const fallbackMinPixelRadius = group.key === "planets" ? 1.25 : 1.1;
          const runtime = this.bodyRenderer.createBodyRuntime(
            {
              name: sourceBody.name,
              color: sourceBody.color,
              renderRadius: sourceBody.renderRadius,
              minPixelRadius: sourceBody.minPixelRadius || fallbackMinPixelRadius,
              orbitalSource: sourceBody,
              objectType: labelObjectTypeByGroupKey[group.key] || "orbiting-body",
              togglesWithNamesButton: namesToggleTargetGroups.has(group.key)
            },
            bodyGroup,
            bodyGeometry
          );

          math.orbitalPositionInto(
            orbitalPositionScratch,
            sourceBody.orbitRadius,
            sourceBody.theta,
            sourceBody.inclination,
            sourceBody.node,
            0,
            sourceBody.eccentricity,
            sourceBody.periapsisArg
          );

          runtime.mesh.position.set(
            orbitalPositionScratch.x,
            orbitalPositionScratch.y,
            orbitalPositionScratch.z
          );

          bodyRuntimes.push(runtime);
          orbitalSourceBodies.push(sourceBody);
        }
      }
    }
  }

  namespace.infrastructure.three.renderers.OrbitRenderer = OrbitRenderer;
})();
