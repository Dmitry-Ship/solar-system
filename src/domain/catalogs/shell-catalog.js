(() => {
  const namespace = window.SolarSystem;
  const raw = namespace?.domain?.catalogs?.rawDefinitions;
  const constants = namespace?.domain?.constants?.SIMULATION_CONSTANTS;

  if (!raw || !constants) {
    throw new Error("shell catalog bootstrap failed: missing dependencies.");
  }

  namespace.domain.catalogs.shellCatalog = Object.freeze({
    HELIOSPHERE_SHELL_CONFIGS: Object.freeze([
      Object.freeze({
        radius: constants.HELIOPAUSE_AU + constants.HELIOPAUSE_MIXING_BAND_AU,
        color: "#86d8ff",
        opacity: 0.32,
        dashSize: 14,
        gapSize: 8,
        segments: 190,
        additive: true,
        distortion: Object.freeze({
          flowDirection: constants.HELIOPAUSE_FLOW_DIRECTION,
          noseCompression: 0.22,
          tailStretch: 0.32,
          rippleAmplitude: 0.02,
          rippleFrequency: 7.5,
          rippleSpeed: 0.75,
          ripplePhase: 2.2
        })
      })
    ]),
    VOYAGERS: raw.VOYAGERS,
    DRIFTING_BODIES: raw.DRIFTING_BODIES
  });
})();
