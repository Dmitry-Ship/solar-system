(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.setupHudControls = function setupHudControls(
    state,
    controls,
    guideLineRuntimes,
    camera,
    math
  ) {
    const zoomToggleButton = document.getElementById("zoom-toggle");
    const namesToggleButton = document.getElementById("names-toggle");
    const lightRayToggleButton = document.getElementById("light-ray-toggle");

    function updateBooleanToggleLabel(button, isEnabled, enabledLabel, disabledLabel) {
      if (!button) return;
      button.textContent = isEnabled ? enabledLabel : disabledLabel;
      button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }

    function cameraDistance() {
      return camera.position.distanceTo(controls.target);
    }

    function updateZoomToggleLabel() {
      if (!zoomToggleButton) return;
      zoomToggleButton.textContent =
        Math.abs(cameraDistance() - state.minCamera) < 1e-3
          ? "Maximum Zoom"
          : "Minimum Zoom";
    }

    function setCameraDistance(distanceAu) {
      const clamped = math.clamp(distanceAu, state.minCamera, state.maxCamera);
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(direction, clamped);
      controls.update();
    }

    if (zoomToggleButton) {
      zoomToggleButton.addEventListener("click", () => {
        const targetDistance =
          Math.abs(cameraDistance() - state.minCamera) < 1e-3
            ? state.maxCamera
            : state.minCamera;
        setCameraDistance(targetDistance);
        updateZoomToggleLabel();
      });
    }

    if (namesToggleButton) {
      namesToggleButton.addEventListener("click", () => {
        state.showBodyNames = !state.showBodyNames;
        updateBooleanToggleLabel(
          namesToggleButton,
          state.showBodyNames,
          "Hide Names",
          "Show Names"
        );
      });

      updateBooleanToggleLabel(
        namesToggleButton,
        state.showBodyNames,
        "Hide Names",
        "Show Names"
      );
    }

    if (lightRayToggleButton) {
      lightRayToggleButton.addEventListener("click", () => {
        state.showDirectionalGuides = !state.showDirectionalGuides;
        app.applyGuideLineVisibility(state, guideLineRuntimes);
        updateBooleanToggleLabel(
          lightRayToggleButton,
          state.showDirectionalGuides,
          "Hide Light Rays",
          "Show Light Rays"
        );
      });

      updateBooleanToggleLabel(
        lightRayToggleButton,
        state.showDirectionalGuides,
        "Hide Light Rays",
        "Show Light Rays"
      );
    }

    controls.addEventListener("change", updateZoomToggleLabel);
    updateZoomToggleLabel();

    return {
      updateZoomToggleLabel
    };
  };
})();
