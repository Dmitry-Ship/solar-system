(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("orbit propagation service bootstrap failed: missing application services namespace.");
  }

  class OrbitPropagationService {
    constructor(options) {
      this.orbitalSourceBodies = options.orbitalSourceBodies;
      this.bodyRuntimes = options.bodyRuntimes;
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

      for (const body of this.orbitalSourceBodies) {
        body.theta = math.normalizeAngle(body.theta + body.meanMotion * motionStep);
      }

      for (const runtime of this.bodyRuntimes) {
        const source = runtime.orbitalSource;
        if (!source) continue;

        math.orbitalPositionInto(
          orbitalPositionScratch,
          source.orbitRadius,
          source.theta,
          source.inclination,
          source.node,
          0,
          source.eccentricity,
          source.periapsisArg
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
