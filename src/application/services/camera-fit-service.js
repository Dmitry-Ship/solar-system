(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("camera fit service bootstrap failed: missing application services namespace.");
  }

  class CameraFitService {
    constructor(options) {
      this.constants = options.constants;
      this.math = options.math;
    }

    computeInitialDistance(camera, state) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("CameraFitService: missing THREE.");
      }

      const fitDistance =
        (this.constants.SCENE_OUTER_AU /
          Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) /
        Math.max(0.05, this.constants.SCENE_SCREEN_RADIUS_RATIO);

      return this.math.clamp(
        fitDistance * this.constants.INITIAL_SCENE_FIT_MULTIPLIER,
        state.minCamera,
        state.maxCamera
      );
    }
  }

  namespace.application.services.CameraFitService = CameraFitService;
})();
