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

    getLightRayControls() {
      const controlsByKey = new Map();

      for (const runtime of this.guideRuntimes) {
        const visibilityKey =
          typeof runtime?.visibilityKey === "string" ? runtime.visibilityKey.trim() : "";
        if (!visibilityKey || controlsByKey.has(visibilityKey)) continue;

        controlsByKey.set(visibilityKey, {
          key: visibilityKey,
          label:
            typeof runtime.visibilityLabel === "string" && runtime.visibilityLabel.trim()
              ? runtime.visibilityLabel.trim()
              : visibilityKey
        });
      }

      return Array.from(controlsByKey.values());
    }

    setup() {
      const zoomToggleButton = document.getElementById("zoom-toggle");
      const namesToggleButton = document.getElementById("names-toggle");
      const orbitToggleButton = document.getElementById("orbits-toggle");
      const lightRayControlsContainer = document.getElementById("light-ray-controls");

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

      if (lightRayControlsContainer) {
        const lightRayControls = this.getLightRayControls();
        lightRayControlsContainer.textContent = "";
        const lightRayControlGroup = lightRayControlsContainer.closest(".hud-control-group");
        if (lightRayControlGroup) {
          lightRayControlGroup.hidden = lightRayControls.length === 0;
        }

        for (const lightRayControl of lightRayControls) {
          this.state.registerLightRay(lightRayControl.key, false);

          const button = document.createElement("button");
          button.className = "zoom-button";
          button.type = "button";
          button.dataset.lightRayKey = lightRayControl.key;
          button.setAttribute("aria-pressed", "false");
          button.addEventListener("click", () => {
            const isVisible = this.state.toggleLightRayVisibility(lightRayControl.key);
            if (typeof this.onGuideVisibilityChanged === "function") {
              this.onGuideVisibilityChanged(this.state, this.guideRuntimes);
            }
            updateBooleanToggleLabel(
              button,
              isVisible,
              `Hide ${lightRayControl.label} Ray`,
              `Show ${lightRayControl.label} Ray`
            );
          });

          updateBooleanToggleLabel(
            button,
            this.state.isLightRayVisible(lightRayControl.key),
            `Hide ${lightRayControl.label} Ray`,
            `Show ${lightRayControl.label} Ray`
          );
          lightRayControlsContainer.appendChild(button);
        }
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
