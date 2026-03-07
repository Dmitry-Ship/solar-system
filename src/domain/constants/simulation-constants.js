(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.constants) {
    throw new Error("simulation constants bootstrap failed: missing domain constants namespace.");
  }

  const SIMULATION_CONSTANTS = Object.freeze({
    SCENE_OUTER_AU: 3000,
    SOLAR_GRAVITATIONAL_LENS_AU: 550,
    SUN_RADIUS_KM: 696340,
    KM_PER_AU: 149597870.7
  });

  namespace.domain.constants.SIMULATION_CONSTANTS = SIMULATION_CONSTANTS;
})();
