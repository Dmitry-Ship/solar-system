(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.systems) {
    throw new Error("simulation system bootstrap failed: missing application systems namespace.");
  }

  class SimulationSystem {
    constructor(options) {
      this.orbitPropagationService = options.orbitPropagationService;
      this.asteroidBeltService = options.asteroidBeltService;
      this.controls = options.controls;
      this.shellRenderer = options.shellRenderer;
      this.guideRenderer = options.guideRenderer;
      this.labelProjectionService = options.labelProjectionService;
      this.postprocessingRenderer = options.postprocessingRenderer;
      this.shellRuntimes = options.shellRuntimes || [];
      this.guideLineRuntimes = options.guideLineRuntimes || [];
      this.camera = options.camera;
    }

    update(deltaSeconds, elapsedSeconds) {
      if (this.orbitPropagationService) {
        this.orbitPropagationService.update(deltaSeconds);
      }

      if (this.asteroidBeltService) {
        this.asteroidBeltService.update(deltaSeconds);
      }

      if (this.controls && typeof this.controls.update === "function") {
        this.controls.update();
      }

      if (this.shellRenderer && typeof this.shellRenderer.updateHeliosphereShells === "function") {
        this.shellRenderer.updateHeliosphereShells(
          this.shellRuntimes,
          this.camera,
          elapsedSeconds
        );
      }

      if (this.guideRenderer && typeof this.guideRenderer.updateGuideLineVisuals === "function") {
        this.guideRenderer.updateGuideLineVisuals(this.guideLineRuntimes, this.camera);
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
