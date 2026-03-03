(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.setInitialCameraPlacement = function setInitialCameraPlacement(
    camera,
    controls,
    constants,
    state,
    math
  ) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("setInitialCameraPlacement: missing THREE.");
    }

    const fitDistance =
      (constants.SCENE_OUTER_AU / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) /
      Math.max(0.05, constants.SCENE_SCREEN_RADIUS_RATIO);

    const initialDistance = math.clamp(
      fitDistance * constants.INITIAL_SCENE_FIT_MULTIPLIER,
      state.minCamera,
      state.maxCamera
    );

    const yaw = -0.55;
    const pitch = 0.35;
    const cosPitch = Math.cos(pitch);

    camera.position.set(
      Math.sin(yaw) * cosPitch * initialDistance,
      Math.sin(pitch) * initialDistance,
      Math.cos(yaw) * cosPitch * initialDistance
    );

    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
  };
})();
