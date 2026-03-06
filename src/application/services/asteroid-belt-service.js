(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("asteroid belt service bootstrap failed: missing application services namespace.");
  }

  class AsteroidBeltService {
    constructor(options) {
      this.beltRuntimes = options.beltRuntimes;
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

      for (const beltRuntime of this.beltRuntimes) {
        const { belt, positions, geometry } = beltRuntime;
        let offset = 0;

        for (const particle of belt.particles) {
          particle.theta = math.normalizeAngle(particle.theta + particle.meanMotion * motionStep);

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

  namespace.application.services.AsteroidBeltService = AsteroidBeltService;
})();
