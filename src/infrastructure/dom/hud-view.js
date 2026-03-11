(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.infrastructure || !namespace.infrastructure.dom) {
    throw new Error("hud view bootstrap failed: missing infrastructure DOM namespace.");
  }

  class HudView {
    constructor(options = {}) {
      this.document = options.document || document;
      this.zoomButtonId = options.zoomButtonId || "zoom-toggle";
      this.namesButtonId = options.namesButtonId || "names-toggle";
      this.orbitsButtonId = options.orbitsButtonId || "orbits-toggle";
      this.visibilityControlsRootId =
        options.visibilityControlsRootId || "visibility-controls-root";
    }

    getElements() {
      return {
        zoomToggleButton: this.document.getElementById(this.zoomButtonId),
        namesToggleButton: this.document.getElementById(this.namesButtonId),
        orbitToggleButton: this.document.getElementById(this.orbitsButtonId),
        visibilityControlsRoot: this.document.getElementById(this.visibilityControlsRootId)
      };
    }

    setBooleanToggleLabel(button, isEnabled, enabledLabel, disabledLabel) {
      if (!button) return;
      button.textContent = isEnabled ? enabledLabel : disabledLabel;
      button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }

    renderVisibilityControlGroups(
      visibilityControlGroups,
      { onRegisterControl, onToggleControl, isControlVisible } = {}
    ) {
      const { visibilityControlsRoot } = this.getElements();
      if (!visibilityControlsRoot) return;

      visibilityControlsRoot.textContent = "";

      for (const visibilityControlGroup of visibilityControlGroups) {
        const groupElement = this.document.createElement("div");
        groupElement.className = "hud-control-group";
        groupElement.setAttribute("aria-label", `${visibilityControlGroup.label} controls`);

        const headingElement = this.document.createElement("div");
        headingElement.className = "hud-control-heading";
        headingElement.textContent = visibilityControlGroup.label;
        groupElement.appendChild(headingElement);

        const controlsElement = this.document.createElement("div");
        controlsElement.className = "hud-controls";

        for (const visibilityControl of visibilityControlGroup.controls) {
          if (typeof onRegisterControl === "function") {
            onRegisterControl(visibilityControl);
          }

          const button = this.document.createElement("button");
          button.className = "zoom-button";
          button.type = "button";
          button.dataset.visibilityKey = visibilityControl.key;
          button.setAttribute("aria-pressed", "false");
          button.addEventListener("click", () => {
            const isVisible =
              typeof onToggleControl === "function"
                ? onToggleControl(visibilityControl)
                : Boolean(isControlVisible?.(visibilityControl));
            this.setBooleanToggleLabel(
              button,
              isVisible,
              `Hide ${visibilityControl.label}`,
              `Show ${visibilityControl.label}`
            );
          });

          this.setBooleanToggleLabel(
            button,
            Boolean(isControlVisible?.(visibilityControl)),
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
  }

  namespace.infrastructure.dom.HudView = HudView;
})();
