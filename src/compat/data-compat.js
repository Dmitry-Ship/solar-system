(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("data compatibility bootstrap failed: missing application factories.");
  }

  const constants = namespace.domain.constants.SIMULATION_CONSTANTS;
  const math = namespace.domain.math.OrbitalMath;
  const rawDefinitions = namespace.domain.catalogs.rawDefinitions;

  const SceneDataFactory = namespace.application.factories.SceneDataFactory;

  if (!constants || !math || !rawDefinitions || !SceneDataFactory) {
    throw new Error("data compatibility bootstrap failed: missing dependencies.");
  }

  const sceneDataFactory = new SceneDataFactory({
    constants,
    math,
    planetCatalog: namespace.domain.catalogs.planetCatalog,
    dwarfPlanetCatalog: namespace.domain.catalogs.dwarfPlanetCatalog,
    cometCatalog: namespace.domain.catalogs.cometCatalog,
    markerCatalog: namespace.domain.catalogs.markerCatalog,
    beltCatalog: namespace.domain.catalogs.beltCatalog,
    rawDefinitions,
    random: Math.random
  });

  namespace.compat.sceneDataFactory = sceneDataFactory;
  namespace.data = {
    createSceneData() {
      return sceneDataFactory.createSceneData();
    }
  };
})();
