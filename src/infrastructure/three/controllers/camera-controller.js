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
  const computeInitialCameraDistance =
    namespace.application?.services?.computeInitialCameraDistance;
  if (!computeInitialCameraDistance) {
    throw new Error(
      "camera controller bootstrap failed: missing computeInitialCameraDistance helper."
    );
  }

  function setInitialCameraPlacement({ camera, controls, state, constants, math }) {
    const initialDistance = computeInitialCameraDistance({
      camera,
      state,
      constants,
      math
    });
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
  }

  namespace.infrastructure.three.controllers.setInitialCameraPlacement =
    setInitialCameraPlacement;
})();
