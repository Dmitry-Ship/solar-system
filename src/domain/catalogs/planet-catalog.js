(() => {
  const namespace = window.SolarSystem;
  const raw = namespace?.domain?.catalogs?.rawDefinitions;
  if (!raw) {
    throw new Error("planet catalog bootstrap failed: missing raw definitions.");
  }

  namespace.domain.catalogs.planetCatalog = Object.freeze({
    PLANET_DEFINITIONS: raw.PLANET_DEFINITIONS
  });
})();
