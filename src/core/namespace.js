(() => {
  const root = (window.SolarSystem = window.SolarSystem || {});

  root.core = root.core || {};
  root.domain = root.domain || {};
  root.application = root.application || {};
  root.infrastructure = root.infrastructure || {};
  root.runtime = root.runtime || {};
  root.compat = root.compat || {};
  root.debug = root.debug || {};

  root.domain.constants = root.domain.constants || {};
  root.domain.math = root.domain.math || {};
  root.domain.models = root.domain.models || {};
  root.domain.catalogs = root.domain.catalogs || {};

  root.application.state = root.application.state || {};
  root.application.factories = root.application.factories || {};
  root.application.services = root.application.services || {};
  root.application.systems = root.application.systems || {};

  root.infrastructure.three = root.infrastructure.three || {};
  root.infrastructure.three.renderers =
    root.infrastructure.three.renderers || {};
  root.infrastructure.three.controllers =
    root.infrastructure.three.controllers || {};
  root.infrastructure.dom = root.infrastructure.dom || {};
})();
