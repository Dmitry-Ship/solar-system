(() => {
  const namespace = window.SolarSystem || {};

  class ModuleRegistry {
    constructor() {
      this._modules = new Map();
      this._initialized = false;
    }

    register(name, factory, dependencies = []) {
      this._modules.set(name, { factory, dependencies, instance: null });
    }

    get(name) {
      const module = this._modules.get(name);
      if (!module) {
        throw new Error(`Module not registered: ${name}`);
      }

      if (!module.instance) {
        module.instance = module.factory(this);
      }
      return module.instance;
    }

    has(name) {
      return this._modules.has(name);
    }

    getOrNull(name) {
      if (!this.has(name)) return null;
      return this.get(name);
    }
  }

  const registry = new ModuleRegistry();

  namespace.core = namespace.core || {};
  namespace.core.registry = registry;
  namespace.core.ModuleRegistry = ModuleRegistry;

  if (typeof module !== "undefined" && module.exports) {
    module.exports = { ModuleRegistry, registry };
  }
})();
