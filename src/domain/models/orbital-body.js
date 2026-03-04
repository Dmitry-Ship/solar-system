(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.models) {
    throw new Error("orbital-body model bootstrap failed: missing domain models namespace.");
  }

  class OrbitalBody {
    constructor(definition) {
      this.definition = Object.freeze({ ...(definition || {}) });
    }

    toMutableRuntime() {
      return {
        ...this.definition,
        theta: this.definition.theta ?? 0,
        meanMotion: this.definition.meanMotion ?? 0,
        inclination: this.definition.inclination ?? 0,
        node: this.definition.node ?? 0,
        periapsisArg: this.definition.periapsisArg ?? 0,
        eccentricity: this.definition.eccentricity ?? 0
      };
    }
  }

  namespace.domain.models.OrbitalBody = OrbitalBody;
})();
