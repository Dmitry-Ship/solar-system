(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("visibility service bootstrap failed: missing application services namespace.");
  }

  function resolveVisibilityTarget(runtime) {
    if (runtime?.visibilityTarget) return runtime.visibilityTarget;
    if (runtime?.object) return runtime.object;
    if (runtime?.mesh) return runtime.mesh;
    return null;
  }

  function isRuntimeVisible(state, runtime) {
    const defaultVisibility = runtime?.defaultVisible ?? true;
    if (typeof runtime?.visibilityKey !== "string" || !runtime.visibilityKey) {
      return Boolean(defaultVisibility);
    }

    if (typeof state?.isVisibilityEnabled === "function") {
      return state.isVisibilityEnabled(runtime.visibilityKey, defaultVisibility);
    }

    return Boolean(defaultVisibility);
  }

  class VisibilityService {
    constructor(options) {
      this.state = options.state;
      this.visibilityRuntimes = options.visibilityRuntimes || [];
    }

    apply() {
      for (const runtime of this.visibilityRuntimes) {
        const target = resolveVisibilityTarget(runtime);
        if (!target || !("visible" in target)) continue;
        target.visible = isRuntimeVisible(this.state, runtime);
      }
    }
  }

  namespace.application.services.VisibilityService = VisibilityService;
})();
