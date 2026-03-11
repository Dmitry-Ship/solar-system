(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error(
      "runtime visibility service bootstrap failed: missing application services namespace."
    );
  }

  class RuntimeVisibilityService {
    constructor(options = {}) {
      this.state = options.state;
    }

    resolveVisibilityTarget(runtime) {
      if (runtime?.visibilityTarget) return runtime.visibilityTarget;
      if (runtime?.object) return runtime.object;
      if (runtime?.mesh) return runtime.mesh;
      return null;
    }

    isRuntimeVisible(runtime) {
      const defaultVisibility = runtime?.defaultVisible ?? true;
      if (typeof runtime?.visibilityKey !== "string" || !runtime.visibilityKey) {
        return Boolean(defaultVisibility);
      }

      if (typeof this.state?.isVisibilityEnabled === "function") {
        return this.state.isVisibilityEnabled(runtime.visibilityKey, defaultVisibility);
      }

      return Boolean(defaultVisibility);
    }

    apply(runtime) {
      const target = this.resolveVisibilityTarget(runtime);
      if (!target || !("visible" in target)) {
        return null;
      }

      const isVisible = this.isRuntimeVisible(runtime);
      target.visible = isVisible;
      return isVisible;
    }
  }

  namespace.application.services.RuntimeVisibilityService = RuntimeVisibilityService;
})();
