(() => {
  const namespace = window.SolarSystem;
  const raw = namespace?.domain?.catalogs?.rawDefinitions;
  if (!raw) {
    throw new Error("belt catalog bootstrap failed: missing raw definitions.");
  }

  namespace.domain.catalogs.beltCatalog = Object.freeze({
    STAR_DISTANCE_MIN_AU: raw.STAR_DISTANCE_MIN_AU,
    STAR_DISTANCE_MAX_AU: raw.STAR_DISTANCE_MAX_AU,
    ASTEROID_BELT_CONFIGS: raw.ASTEROID_BELT_CONFIGS,
    OORT_CLOUD_CONFIG: raw.OORT_CLOUD_CONFIG,
    ORBIT_RENDER_GROUPS: raw.ORBIT_RENDER_GROUPS
  });
})();
