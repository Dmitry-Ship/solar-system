(() => {
  const namespace = window.SolarSystem;
  const raw = namespace?.domain?.catalogs?.rawDefinitions;
  if (!raw) {
    throw new Error("comet catalog bootstrap failed: missing raw definitions.");
  }

  namespace.domain.catalogs.cometCatalog = Object.freeze({
    COMET_DEFINITIONS: raw.COMET_DEFINITIONS
  });
})();
