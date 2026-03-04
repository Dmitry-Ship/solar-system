(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.core) {
    throw new Error("service-container bootstrap failed: missing core namespace.");
  }

  class ServiceContainer {
    constructor() {
      this.registry = new Map();
    }

    register(name, instance) {
      const key = typeof name === "string" ? name.trim() : "";
      if (!key) {
        throw new Error("ServiceContainer.register requires a non-empty name.");
      }
      this.registry.set(key, instance);
      return instance;
    }

    resolve(name) {
      const key = typeof name === "string" ? name.trim() : "";
      if (!this.registry.has(key)) {
        throw new Error(`ServiceContainer.resolve failed: ${key} is not registered.`);
      }
      return this.registry.get(key);
    }

    has(name) {
      return this.registry.has(name);
    }

    clear() {
      this.registry.clear();
    }
  }

  namespace.core.ServiceContainer = ServiceContainer;
})();
