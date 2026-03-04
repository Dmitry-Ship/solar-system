(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.state) {
    throw new Error("app-state bootstrap failed: missing application state namespace.");
  }

  class AppState {
    constructor(constants) {
      this.showBodyNames = true;
      this.showDirectionalGuides = false;
      this.minCamera = constants.MIN_ZOOM_AU;
      this.maxCamera = constants.MAX_ZOOM_AU;
    }
  }

  namespace.application.state.AppState = AppState;
})();
