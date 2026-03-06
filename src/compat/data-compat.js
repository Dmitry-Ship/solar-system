(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("data compatibility bootstrap failed: missing application factories.");
  }

  const constants = namespace.domain.constants.SIMULATION_CONSTANTS;
  const math = namespace.domain.math.OrbitalMath;
  const rawDefinitions = namespace.domain.catalogs.rawDefinitions;

  const GuideLineFactory = namespace.application.factories.GuideLineFactory;
  const SceneDataFactory = namespace.application.factories.SceneDataFactory;
  const OrbitalBody = namespace.domain.models.OrbitalBody;
  const FixedBody = namespace.domain.models.FixedBody;
  const SceneData = namespace.domain.models.SceneData;

  if (
    !constants ||
    !math ||
    !rawDefinitions ||
    !GuideLineFactory ||
    !SceneDataFactory ||
    !OrbitalBody ||
    !FixedBody ||
    !SceneData
  ) {
    throw new Error("data compatibility bootstrap failed: missing dependencies.");
  }

  const guideLineFactory = new GuideLineFactory({
    constants,
    math,
    markerCatalog: namespace.domain.catalogs.markerCatalog
  });

  const sceneDataFactory = new SceneDataFactory({
    constants,
    math,
    orbitalBodyModel: OrbitalBody,
    fixedBodyModel: FixedBody,
    sceneDataModel: SceneData,
    planetCatalog: namespace.domain.catalogs.planetCatalog,
    dwarfPlanetCatalog: namespace.domain.catalogs.dwarfPlanetCatalog,
    cometCatalog: namespace.domain.catalogs.cometCatalog,
    markerCatalog: namespace.domain.catalogs.markerCatalog,
    beltCatalog: namespace.domain.catalogs.beltCatalog,
    rawDefinitions,
    guideLineFactory,
    random: Math.random
  });

  namespace.compat.sceneDataFactory = sceneDataFactory;
  namespace.data = {
    createSceneData() {
      return sceneDataFactory.createSceneData();
    }
  };
})();
