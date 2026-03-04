(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.controllers
  ) {
    throw new Error("camera controller bootstrap failed: missing three controllers namespace.");
  }

  class CameraController {
    constructor(options) {
      this.camera = options.camera;
      this.controls = options.controls;
      this.state = options.state;
      this.cameraFitService = options.cameraFitService;
    }

    setInitialPlacement() {
      const initialDistance = this.cameraFitService.computeInitialDistance(
        this.camera,
        this.state
      );

      const yaw = -0.55;
      const pitch = 0.35;
      const cosPitch = Math.cos(pitch);

      this.camera.position.set(
        Math.sin(yaw) * cosPitch * initialDistance,
        Math.sin(pitch) * initialDistance,
        Math.cos(yaw) * cosPitch * initialDistance
      );

      this.controls.target.set(0, 0, 0);
      this.camera.lookAt(this.controls.target);
      this.controls.update();
    }
  }

  namespace.infrastructure.three.controllers.CameraController = CameraController;
})();
