(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.services) {
    throw new Error("camera fit service bootstrap failed: missing application services namespace.");
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function computeInitialCameraDistance({ camera, state, constants, math }) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("computeInitialCameraDistance: missing THREE.");
    }

    const fitDistance =
      (constants.SCENE_OUTER_AU / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) /
      Math.max(0.05, constants.SCENE_SCREEN_RADIUS_RATIO);
    const clampValue = typeof math?.clamp === "function" ? math.clamp : clamp;

    return clampValue(
      fitDistance * constants.INITIAL_SCENE_FIT_MULTIPLIER,
      state.minCamera,
      state.maxCamera
    );
  }

  namespace.application.services.computeInitialCameraDistance = computeInitialCameraDistance;
})();
