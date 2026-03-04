(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.normalizeAngle = function normalizeAngle(value) {
    const turn = Math.PI * 2;
    let result = value % turn;
    if (result < 0) result += turn;
    return result;
  };

  app.prepareSceneCaches = function prepareSceneCaches(sceneData, constants, math) {
    const renderRadiusFromKm = (radiusKm) => radiusKm / constants.KM_PER_AU;

    for (const group of sceneData.orbitRenderGroups) {
      const sourceBodies = sceneData[group.key] || [];
      const shouldUseRadiusOrbitOpacity = group.key !== "comets";
      const groupOrbitColor = group.orbitColor || constants.ORBIT_COLOR;

      for (const body of sourceBodies) {
        body.orbitRadius = body.au;
        body.renderRadius = renderRadiusFromKm(body.radiusKm);
        body.orbitColor = groupOrbitColor;
        body.orbitOpacity = shouldUseRadiusOrbitOpacity
          ? sceneData.orbitOpacityForBodyRadius(body.radiusKm)
          : 0.05;
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

    for (const voyager of sceneData.voyagers) {
      voyager.renderRadius = renderRadiusFromKm(voyager.radiusKm);
    }

    for (const body of sceneData.driftingBodies) {
      body.renderRadius = renderRadiusFromKm(body.radiusKm);
    }

    for (const belt of sceneData.asteroidBelts) {
      for (const particle of belt.particles) {
        particle.orbitRadius = particle.au;
      }
    }
  };
})();
