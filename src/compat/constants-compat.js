(() => {
  const namespace = window.SolarSystem;
  const constants = namespace?.domain?.constants?.SIMULATION_CONSTANTS;
  if (!namespace || !constants) {
    throw new Error("constants compatibility bootstrap failed: missing simulation constants.");
  }

  namespace.constants = constants;
})();
