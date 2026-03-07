(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.state) {
    throw new Error("app-state bootstrap failed: missing application state namespace.");
  }

  class AppState {
    constructor(constants) {
      this.showBodyNames = false;
      this.showOrbits = true;
      this.showLightRays = false;
      this.lightRayVisibilityByKey = Object.create(null);
      this.minCamera = constants.MIN_ZOOM_AU;
      this.maxCamera = constants.MAX_ZOOM_AU;
    }

    registerLightRay(key, initialVisibility = false) {
      if (typeof key !== "string" || !key) return;
      if (!(key in this.lightRayVisibilityByKey)) {
        this.lightRayVisibilityByKey[key] = Boolean(initialVisibility);
      }
      this.syncLightRayAggregateVisibility();
    }

    isLightRayVisible(key) {
      if (typeof key !== "string" || !key) {
        return Boolean(this.showLightRays);
      }

      return Boolean(this.lightRayVisibilityByKey[key]);
    }

    setLightRayVisibility(key, isVisible) {
      if (typeof key !== "string" || !key) return false;
      this.lightRayVisibilityByKey[key] = Boolean(isVisible);
      this.syncLightRayAggregateVisibility();
      return this.lightRayVisibilityByKey[key];
    }

    toggleLightRayVisibility(key) {
      return this.setLightRayVisibility(key, !this.isLightRayVisible(key));
    }

    syncLightRayAggregateVisibility() {
      this.showLightRays = Object.keys(this.lightRayVisibilityByKey).some((key) =>
        Boolean(this.lightRayVisibilityByKey[key])
      );
    }
  }

  namespace.application.state.AppState = AppState;
})();
