(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.systems) {
    throw new Error("simulation system bootstrap failed: missing application systems namespace.");
  }

  class SimulationSystem {
    constructor(options) {
      this.orbitPropagationService = options.orbitPropagationService;
      this.asteroidBeltService = options.asteroidBeltService;
      this.particleRenderer = options.particleRenderer;
      this.beltRuntimes = options.beltRuntimes || [];
      this.controls = options.controls;
      this.guideRenderer = options.guideRenderer;
      this.labelProjectionService = options.labelProjectionService;
      this.postprocessingRenderer = options.postprocessingRenderer;
      this.visibilityService = options.visibilityService;
      this.guideRuntimes = options.guideRuntimes || options.guideLineRuntimes || [];
      this.camera = options.camera;
    }

    update(deltaSeconds) {
      if (this.orbitPropagationService) {
        this.orbitPropagationService.update(deltaSeconds);
      }

      if (this.asteroidBeltService) {
        this.asteroidBeltService.update(deltaSeconds);
      }

      if (this.controls && typeof this.controls.update === "function") {
        this.controls.update();
      }

      if (
        this.particleRenderer &&
        typeof this.particleRenderer.updateAsteroidBeltVisuals === "function"
      ) {
        this.particleRenderer.updateAsteroidBeltVisuals(this.beltRuntimes, this.camera);
      }

      if (this.guideRenderer && typeof this.guideRenderer.updateGuideLineVisuals === "function") {
        this.guideRenderer.updateGuideLineVisuals(this.guideRuntimes, this.camera);
      }

      if (this.visibilityService && typeof this.visibilityService.apply === "function") {
        this.visibilityService.apply();
      }

      if (this.labelProjectionService) {
        this.labelProjectionService.update();
      }

      if (this.postprocessingRenderer && typeof this.postprocessingRenderer.render === "function") {
        this.postprocessingRenderer.render();
      }
    }
  }

  namespace.application.systems.SimulationSystem = SimulationSystem;
})();
