(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.models) {
    throw new Error("fixed-body model bootstrap failed: missing domain models namespace.");
  }

  class FixedBody {
    constructor(definition) {
      this.definition = Object.freeze({ ...(definition || {}) });
    }

    toMutableRuntime() {
      const position = this.definition.position || this.definition.fixedPosition || {};
      return {
        ...this.definition,
        x: position.x ?? this.definition.x ?? 0,
        y: position.y ?? this.definition.y ?? 0,
        z: position.z ?? this.definition.z ?? 0
      };
    }
  }

  namespace.domain.models.FixedBody = FixedBody;
})();
