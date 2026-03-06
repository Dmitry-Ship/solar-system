(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.constants) {
    throw new Error("simulation constants bootstrap failed: missing domain constants namespace.");
  }

  const maxZoomAu = 6000;

  const SIMULATION_CONSTANTS = Object.freeze({
    SCENE_OUTER_AU: 3000,
    SOLAR_GRAVITATIONAL_LENS_AU: 550,
    MIN_ZOOM_AU: 0.1,
    MAX_ZOOM_AU: maxZoomAu,
    NEAR_CLIP: 0.08,
    SCENE_SCREEN_RADIUS_RATIO: 0.44,
    INITIAL_SCENE_FIT_MULTIPLIER: 1.08,
    SUN_RADIUS_KM: 696340,
    KM_PER_AU: 149597870.7,
    ORBIT_COLOR: "#b0bdc1",
    OORT_CLOUD_COLOR: "#d4e4ff",
    EARTH_MEAN_MOTION: 0.020,
    EARTH_OBLIQUITY_DEG_J2000: 23.4392911,
    BACKGROUND_COLOR: "#000000",
    SUN_BLOOM_STRENGTH: 5.4,
    SUN_BLOOM_RADIUS: 0.55,
    SUN_BLOOM_THRESHOLD: 0.72
  });

  namespace.domain.constants.SIMULATION_CONSTANTS = SIMULATION_CONSTANTS;
})();
