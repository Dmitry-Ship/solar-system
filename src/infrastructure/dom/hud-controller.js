(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.infrastructure || !namespace.infrastructure.dom) {
    throw new Error("hud controller bootstrap failed: missing infrastructure DOM namespace.");
  }

  class HudController {
    constructor(options) {
      this.state = options.state;
      this.controls = options.controls;
      this.orbitGroup = options.orbitGroup;
      this.guideRuntimes = options.guideRuntimes || options.guideLineRuntimes || [];
      this.camera = options.camera;
      this.math = options.math;
      this.onOrbitVisibilityChanged = options.onOrbitVisibilityChanged;
      this.onGuideVisibilityChanged = options.onGuideVisibilityChanged;
    }

    setup() {
      const zoomToggleButton = document.getElementById("zoom-toggle");
      const namesToggleButton = document.getElementById("names-toggle");
      const orbitToggleButton = document.getElementById("orbits-toggle");
      const lightRayToggleButton = document.getElementById("light-ray-toggle");
      const spacecraftTrajectoryToggleButton = document.getElementById(
        "spacecraft-trajectory-toggle"
      );

      const updateBooleanToggleLabel = (
        button,
        isEnabled,
        enabledLabel,
        disabledLabel
      ) => {
        if (!button) return;
        button.textContent = isEnabled ? enabledLabel : disabledLabel;
        button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
      };

      const cameraDistance = () => this.camera.position.distanceTo(this.controls.target);

      this.updateZoomToggleLabel = () => {
        if (!zoomToggleButton) return;
        zoomToggleButton.textContent =
          Math.abs(cameraDistance() - this.state.minCamera) < 1e-3
            ? "Maximum Zoom"
            : "Minimum Zoom";
      };

      const setCameraDistance = (distanceAu) => {
        const clamped = this.math.clamp(distanceAu, this.state.minCamera, this.state.maxCamera);
        const direction = this.camera.position.clone().sub(this.controls.target).normalize();
        this.camera.position.copy(this.controls.target).addScaledVector(direction, clamped);
        this.controls.update();
      };

      if (zoomToggleButton) {
        zoomToggleButton.addEventListener("click", () => {
          const targetDistance =
            Math.abs(cameraDistance() - this.state.minCamera) < 1e-3
              ? this.state.maxCamera
              : this.state.minCamera;
          setCameraDistance(targetDistance);
          this.updateZoomToggleLabel();
        });
      }

      if (namesToggleButton) {
        namesToggleButton.addEventListener("click", () => {
          this.state.showBodyNames = !this.state.showBodyNames;
          updateBooleanToggleLabel(
            namesToggleButton,
            this.state.showBodyNames,
            "Hide Names",
            "Show Names"
          );
        });

        updateBooleanToggleLabel(
          namesToggleButton,
          this.state.showBodyNames,
          "Hide Names",
          "Show Names"
        );
      }

      if (orbitToggleButton) {
        orbitToggleButton.addEventListener("click", () => {
          this.state.showOrbits = !this.state.showOrbits;
          if (typeof this.onOrbitVisibilityChanged === "function") {
            this.onOrbitVisibilityChanged(this.state, this.orbitGroup);
          }
          updateBooleanToggleLabel(
            orbitToggleButton,
            this.state.showOrbits,
            "Hide Orbits",
            "Show Orbits"
          );
        });

        updateBooleanToggleLabel(
          orbitToggleButton,
          this.state.showOrbits,
          "Hide Orbits",
          "Show Orbits"
        );
      }

      if (lightRayToggleButton) {
        lightRayToggleButton.addEventListener("click", () => {
          this.state.showLightRays = !this.state.showLightRays;
          if (typeof this.onGuideVisibilityChanged === "function") {
            this.onGuideVisibilityChanged(this.state, this.guideRuntimes);
          }
          updateBooleanToggleLabel(
            lightRayToggleButton,
            this.state.showLightRays,
            "Hide Light Rays",
            "Show Light Rays"
          );
        });

        updateBooleanToggleLabel(
          lightRayToggleButton,
          this.state.showLightRays,
          "Hide Light Rays",
          "Show Light Rays"
        );
      }

      if (spacecraftTrajectoryToggleButton) {
        spacecraftTrajectoryToggleButton.addEventListener("click", () => {
          this.state.showSpacecraftTrajectory = !this.state.showSpacecraftTrajectory;
          if (typeof this.onGuideVisibilityChanged === "function") {
            this.onGuideVisibilityChanged(this.state, this.guideRuntimes);
          }
          updateBooleanToggleLabel(
            spacecraftTrajectoryToggleButton,
            this.state.showSpacecraftTrajectory,
            "Hide Spacecraft Trajectory",
            "Show Spacecraft Trajectory"
          );
        });

        updateBooleanToggleLabel(
          spacecraftTrajectoryToggleButton,
          this.state.showSpacecraftTrajectory,
          "Hide Spacecraft Trajectory",
          "Show Spacecraft Trajectory"
        );
      }

      this.controls.addEventListener("change", this.updateZoomToggleLabel);
      this.updateZoomToggleLabel();

      return {
        updateZoomToggleLabel: this.updateZoomToggleLabel
      };
    }
  }

  namespace.infrastructure.dom.HudController = HudController;
})();
