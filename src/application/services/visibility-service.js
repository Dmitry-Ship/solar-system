(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("visibility service bootstrap failed: missing application services namespace.");
  }
  const RuntimeVisibilityService = namespace.application.services.RuntimeVisibilityService;
  if (!RuntimeVisibilityService) {
    throw new Error(
      "visibility service bootstrap failed: missing runtime visibility service."
    );
  }

  class VisibilityService {
    constructor(options) {
      this.state = options.state;
      this.visibilityRuntimes = options.visibilityRuntimes || [];
      this.runtimeVisibility =
        options.runtimeVisibility || new RuntimeVisibilityService({ state: this.state });
    }

    apply() {
      for (const runtime of this.visibilityRuntimes) {
        this.runtimeVisibility.apply(runtime);
      }
    }
  }

  namespace.application.services.VisibilityService = VisibilityService;
})();
