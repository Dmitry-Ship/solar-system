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
      this.visibilityRuntimes =
        options.visibilityRuntimes || options.guideRuntimes || options.guideLineRuntimes || [];
      this.camera = options.camera;
      this.math = options.math;
      this.onOrbitVisibilityChanged = options.onOrbitVisibilityChanged;
      this.onVisibilityChanged = options.onVisibilityChanged;
    }

    getVisibilityControlGroups() {
      const groupsByKey = new Map();

      for (const runtime of this.visibilityRuntimes) {
        const visibilityKey =
          typeof runtime?.visibilityKey === "string" ? runtime.visibilityKey.trim() : "";
        if (!visibilityKey) continue;

        const groupKey =
          typeof runtime?.visibilityGroupKey === "string" && runtime.visibilityGroupKey.trim()
            ? runtime.visibilityGroupKey.trim()
            : "visibility";
        const groupLabel =
          typeof runtime?.visibilityGroupLabel === "string" && runtime.visibilityGroupLabel.trim()
            ? runtime.visibilityGroupLabel.trim()
            : "Visibility";
        const controlLabel =
          typeof runtime?.visibilityControlLabel === "string" &&
          runtime.visibilityControlLabel.trim()
            ? runtime.visibilityControlLabel.trim()
            : typeof runtime?.visibilityLabel === "string" && runtime.visibilityLabel.trim()
              ? runtime.visibilityLabel.trim()
              : visibilityKey;

        if (!groupsByKey.has(groupKey)) {
          groupsByKey.set(groupKey, {
            key: groupKey,
            label: groupLabel,
            controlsByKey: new Map()
          });
        }

        const group = groupsByKey.get(groupKey);
        if (group.controlsByKey.has(visibilityKey)) continue;

        group.controlsByKey.set(visibilityKey, {
          key: visibilityKey,
          label: controlLabel,
          initialVisibility: runtime.initialVisibility ?? runtime.defaultVisible ?? false,
          groupKey
        });
      }

      return Array.from(groupsByKey.values()).map((group) => ({
        key: group.key,
        label: group.label,
        controls: Array.from(group.controlsByKey.values())
      }));
    }

    setup() {
      const zoomToggleButton = document.getElementById("zoom-toggle");
      const namesToggleButton = document.getElementById("names-toggle");
      const orbitToggleButton = document.getElementById("orbits-toggle");
      const visibilityControlsRoot = document.getElementById("visibility-controls-root");

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

      if (visibilityControlsRoot) {
        const visibilityControlGroups = this.getVisibilityControlGroups();
        visibilityControlsRoot.textContent = "";

        for (const visibilityControlGroup of visibilityControlGroups) {
          const groupElement = document.createElement("div");
          groupElement.className = "hud-control-group";
          groupElement.setAttribute("aria-label", `${visibilityControlGroup.label} controls`);

          const headingElement = document.createElement("div");
          headingElement.className = "hud-control-heading";
          headingElement.textContent = visibilityControlGroup.label;
          groupElement.appendChild(headingElement);

          const controlsElement = document.createElement("div");
          controlsElement.className = "hud-controls";

          for (const visibilityControl of visibilityControlGroup.controls) {
            this.state.registerVisibility(
              visibilityControl.key,
              visibilityControl.initialVisibility,
              visibilityControl.groupKey
            );

            const button = document.createElement("button");
            button.className = "zoom-button";
            button.type = "button";
            button.dataset.visibilityKey = visibilityControl.key;
            button.setAttribute("aria-pressed", "false");
            button.addEventListener("click", () => {
              const isVisible = this.state.toggleVisibility(
                visibilityControl.key,
                visibilityControl.initialVisibility
              );
              if (typeof this.onVisibilityChanged === "function") {
                this.onVisibilityChanged(this.state, this.visibilityRuntimes);
              }
              updateBooleanToggleLabel(
                button,
                isVisible,
                `Hide ${visibilityControl.label}`,
                `Show ${visibilityControl.label}`
              );
            });

            updateBooleanToggleLabel(
              button,
              this.state.isVisibilityEnabled(
                visibilityControl.key,
                visibilityControl.initialVisibility
              ),
              `Hide ${visibilityControl.label}`,
              `Show ${visibilityControl.label}`
            );
            controlsElement.appendChild(button);
          }

          if (controlsElement.childElementCount === 0) continue;

          groupElement.appendChild(controlsElement);
          visibilityControlsRoot.appendChild(groupElement);
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
