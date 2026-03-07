(() => {
  class DependencyContainer {
    constructor() {
      this._services = new Map();
      this._factories = new Map();
      this._singletons = new Map();
    }

    register(key, factory) {
      this._factories.set(key, factory);
      this._singletons.delete(key);
    }

    registerInstance(key, instance) {
      this._singletons.set(key, instance);
      this._factories.delete(key);
    }

    get(key) {
      if (this._singletons.has(key)) {
        return this._singletons.get(key);
      }

      const factory = this._factories.get(key);
      if (!factory) {
        throw new Error(`Dependency not registered: ${key}`);
      }

      const instance = factory(this);
      this._singletons.set(key, instance);
      return instance;
    }

    has(key) {
      return this._factories.has(key) || this._singletons.has(key);
    }

    getOrNull(key) {
      if (!this.has(key)) return null;
      return this.get(key);
    }

    clear() {
      this._services.clear();
      this._factories.clear();
      this._singletons.clear();
    }
  }

  const container = new DependencyContainer();

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { DependencyContainer, container };
  } else {
    window.SolarSystem = window.SolarSystem || {};
    window.SolarSystem.container = container;
  }
})();
