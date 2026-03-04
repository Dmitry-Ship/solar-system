(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.models) {
    throw new Error("guide-line model bootstrap failed: missing domain models namespace.");
  }

  class GuideLine {
    constructor(definition) {
      this.definition = Object.freeze({ ...(definition || {}) });
    }

    toLegacyShape() {
      return { ...this.definition };
    }
  }

  namespace.domain.models.GuideLine = GuideLine;
})();
