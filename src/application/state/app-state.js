(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.state) {
    throw new Error("app-state bootstrap failed: missing application state namespace.");
  }

  class AppState {
    constructor(constants) {
      this.showBodyNames = true;
      this.showOrbits = true;
      this.showLightRays = false;
      this.showSpacecraftTrajectory = false;
      this.minCamera = constants.MIN_ZOOM_AU;
      this.maxCamera = constants.MAX_ZOOM_AU;

      Object.defineProperty(this, "showDirectionalGuides", {
        enumerable: true,
        configurable: true,
        get: () => this.showLightRays && this.showSpacecraftTrajectory,
        set: (isVisible) => {
          const nextValue = Boolean(isVisible);
          this.showLightRays = nextValue;
          this.showSpacecraftTrajectory = nextValue;
        }
      });
    }
  }

  namespace.application.state.AppState = AppState;
})();
