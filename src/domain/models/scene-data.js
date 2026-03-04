(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.models) {
    throw new Error("scene-data model bootstrap failed: missing domain models namespace.");
  }

  class SceneData {
    constructor(payload) {
      this.payload = payload || {};
    }

    toLegacyShape() {
      return {
        planets: this.payload.planets || [],
        dwarfPlanets: this.payload.dwarfPlanets || [],
        comets: this.payload.comets || [],
        orbitRenderGroups: this.payload.orbitRenderGroups || [],
        voyagers: this.payload.voyagers || [],
        driftingBodies: this.payload.driftingBodies || [],
        directionalMarkers: this.payload.directionalMarkers || [],
        directionalGuideLines: this.payload.directionalGuideLines || [],
        asteroidBelts: this.payload.asteroidBelts || [],
        oortCloud: this.payload.oortCloud || { particles: [] },
        stars: this.payload.stars || []
      };
    }
  }

  namespace.domain.models.SceneData = SceneData;
})();
