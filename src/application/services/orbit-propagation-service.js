(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("orbit propagation service bootstrap failed: missing application services namespace.");
  }

  class OrbitPropagationService {
    constructor(options) {
      this.orbitingBodyState =
        options.orbitingBodyState || options.orbitalMotionState || null;
      this.orbitingBodies = options.orbitingBodies || options.orbitalSourceBodies || [];
      this.sceneObjectRuntimes = options.sceneObjectRuntimes || options.bodyRuntimes || [];
      this.math = options.math;
      this.motionTimeScale = options.motionTimeScale ?? 1;
      this.orbitalPositionScratch = options.orbitalPositionScratch || {
        x: 0,
        y: 0,
        z: 0
      };
    }

    update(deltaSeconds) {
      const motionStep = deltaSeconds * this.motionTimeScale;
      const { math, orbitalPositionScratch } = this;
      const orbitingBodyState = this.orbitingBodyState;

      if (orbitingBodyState?.count) {
        const {
          count,
          bodies,
          meshes,
          orbitRadius,
          theta,
          inclination,
          node,
          eccentricity,
          periapsisArg,
          meanMotion
        } = orbitingBodyState;

        for (let index = 0; index < count; index += 1) {
          const nextTheta = math.normalizeAngle(theta[index] + meanMotion[index] * motionStep);
          theta[index] = nextTheta;

          if (bodies[index]) {
            bodies[index].theta = nextTheta;
          }

          const mesh = meshes[index];
          if (!mesh) continue;

          math.orbitalPositionInto(
            orbitalPositionScratch,
            orbitRadius[index],
            nextTheta,
            inclination[index],
            node[index],
            0,
            eccentricity[index],
            periapsisArg[index]
          );

          mesh.position.set(
            orbitalPositionScratch.x,
            orbitalPositionScratch.y,
            orbitalPositionScratch.z
          );
        }
        return;
      }

      for (const orbitingBody of this.orbitingBodies) {
        orbitingBody.theta = math.normalizeAngle(
          orbitingBody.theta + orbitingBody.meanMotion * motionStep
        );
      }

      for (const runtime of this.sceneObjectRuntimes) {
        const orbitingBody = runtime.orbitingBody || runtime.orbitalSource;
        if (!orbitingBody) continue;

        math.orbitalPositionInto(
          orbitalPositionScratch,
          orbitingBody.orbitRadius,
          orbitingBody.theta,
          orbitingBody.inclination,
          orbitingBody.node,
          0,
          orbitingBody.eccentricity,
          orbitingBody.periapsisArg
        );

        runtime.mesh.position.set(
          orbitalPositionScratch.x,
          orbitalPositionScratch.y,
          orbitalPositionScratch.z
        );
      }
    }
  }

  namespace.application.services.OrbitPropagationService = OrbitPropagationService;
})();
