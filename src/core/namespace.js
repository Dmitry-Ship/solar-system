(() => {
  const container = (window.SolarSystem && window.SolarSystem.container) || null;
  const namespace = (window.SolarSystem = window.SolarSystem || {});

  namespace.core = namespace.core || {};
  namespace.core.container = container;

  namespace.domain = namespace.domain || {};
  namespace.application = namespace.application || {};
  namespace.infrastructure = namespace.infrastructure || {};
  namespace.runtime = namespace.runtime || {};
  namespace.compat = namespace.compat || {};
  namespace.debug = namespace.debug || {};

  namespace.domain.constants = namespace.domain.constants || {};
  namespace.domain.math = namespace.domain.math || {};
  namespace.domain.catalogs = namespace.domain.catalogs || {};

  namespace.application.state = namespace.application.state || {};
  namespace.application.factories = namespace.application.factories || {};
  namespace.application.services = namespace.application.services || {};
  namespace.application.systems = namespace.application.systems || {};

  namespace.infrastructure.three = namespace.infrastructure.three || {};
  namespace.infrastructure.three.renderers = namespace.infrastructure.three.renderers || {};
  namespace.infrastructure.three.controllers = namespace.infrastructure.three.controllers || {};
  namespace.infrastructure.dom = namespace.infrastructure.dom || {};

  function registerService(key, Factory) {
    if (container) {
      container.register(key, (c) => new Factory(c));
    }
    namespace[key] = Factory;
  }

  function registerInstance(key, instance) {
    if (container) {
      container.registerInstance(key, instance);
    }
    namespace[key] = instance;
  }

  namespace.core.registerService = registerService;
  namespace.core.registerInstance = registerInstance;
})();
