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
      for (const body of this.orbitalSourceBodies) {
        body.theta = this.math.normalizeAngle(
          body.theta + body.meanMotion * deltaSeconds * this.motionTimeScale
        );
      }

      for (const runtime of this.bodyRuntimes) {
        if (!runtime.orbitalSource) continue;

        const source = runtime.orbitalSource;
        this.math.orbitalPositionInto(
          this.orbitalPositionScratch,
          source.orbitRadius,
          source.theta,
          source.inclination,
          source.node,
          0,
          source.eccentricity,
          source.periapsisArg
        );

        runtime.mesh.position.set(
          this.orbitalPositionScratch.x,
          this.orbitalPositionScratch.y,
          this.orbitalPositionScratch.z
        );
      }
    }
  }

  namespace.application.services.OrbitPropagationService = OrbitPropagationService;
})();
