import { namespace } from "../../core/namespace";
import { VisibilityControlGroupFactory } from "../../application/factories/visibility-control-group-factory";
import { HudView } from "./hud-view";

export class HudController {
    [key: string]: any;

    constructor(options: any) {
      this.state = options.state;
      this.controls = options.controls;
      this.orbitGroup = options.orbitGroup;
      this.visibilityRuntimes =
        options.visibilityRuntimes || options.guideRuntimes || options.guideLineRuntimes || [];
      this.camera = options.camera;
      this.math = options.math;
      this.onOrbitVisibilityChanged = options.onOrbitVisibilityChanged;
      this.onVisibilityChanged = options.onVisibilityChanged;
      this.requestRender = options.requestRender;
      this.visibilityControlGroupFactory =
        options.visibilityControlGroupFactory || new VisibilityControlGroupFactory();
      this.view = options.view || new HudView({ document: options.document });
    }

    updateZoomToggleLabel() {}

    setupZoomToggle(zoomToggleButton) {
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

      if (!zoomToggleButton) return;

      zoomToggleButton.addEventListener("click", () => {
        const targetDistance =
          Math.abs(cameraDistance() - this.state.minCamera) < 1e-3
            ? this.state.maxCamera
            : this.state.minCamera;
        setCameraDistance(targetDistance);
        this.updateZoomToggleLabel();
        if (typeof this.requestRender === "function") {
          this.requestRender();
        }
      });
    }

    setupNamesToggle(namesToggleButton) {
      if (!namesToggleButton) return;

      namesToggleButton.addEventListener("click", () => {
        this.state.showBodyNames = !this.state.showBodyNames;
        this.view.setBooleanToggleLabel(
          namesToggleButton,
          this.state.showBodyNames,
          "Hide Names",
          "Show Names"
        );
        if (typeof this.requestRender === "function") {
          this.requestRender();
        }
      });

      this.view.setBooleanToggleLabel(
        namesToggleButton,
        this.state.showBodyNames,
        "Hide Names",
        "Show Names"
      );
    }

    setupOrbitToggle(orbitToggleButton) {
      if (!orbitToggleButton) return;

      orbitToggleButton.addEventListener("click", () => {
        this.state.showOrbits = !this.state.showOrbits;
        if (typeof this.onOrbitVisibilityChanged === "function") {
          this.onOrbitVisibilityChanged(this.state, this.orbitGroup);
        }
        this.view.setBooleanToggleLabel(
          orbitToggleButton,
          this.state.showOrbits,
          "Hide Orbits",
          "Show Orbits"
        );
        if (typeof this.requestRender === "function") {
          this.requestRender();
        }
      });

      this.view.setBooleanToggleLabel(
        orbitToggleButton,
        this.state.showOrbits,
        "Hide Orbits",
        "Show Orbits"
      );
    }

    setupVisibilityControls() {
      const visibilityControlGroups = this.visibilityControlGroupFactory.create(
        this.visibilityRuntimes
      );
      this.view.renderVisibilityControlGroups(visibilityControlGroups, {
        onRegisterControl: (visibilityControl) => {
          this.state.registerVisibility(
            visibilityControl.key,
            visibilityControl.initialVisibility,
            visibilityControl.groupKey
          );
        },
        onToggleControl: (visibilityControl) => {
          const isVisible = this.state.toggleVisibility(
            visibilityControl.key,
            visibilityControl.initialVisibility
          );
          if (typeof this.onVisibilityChanged === "function") {
            this.onVisibilityChanged(this.state, this.visibilityRuntimes);
          }
          if (typeof this.requestRender === "function") {
            this.requestRender();
          }
          return isVisible;
        },
        isControlVisible: (visibilityControl) =>
          this.state.isVisibilityEnabled(
            visibilityControl.key,
            visibilityControl.initialVisibility
          )
      });
    }

    setup() {
      const { zoomToggleButton, namesToggleButton, orbitToggleButton } =
        this.view.getElements();

      this.setupZoomToggle(zoomToggleButton);
      this.setupNamesToggle(namesToggleButton);
      this.setupOrbitToggle(orbitToggleButton);
      this.setupVisibilityControls();

      this.controls.addEventListener("change", this.updateZoomToggleLabel);
      this.updateZoomToggleLabel();

      return {
        updateZoomToggleLabel: this.updateZoomToggleLabel
      };
    }
  }

namespace.infrastructure.dom.HudController = HudController;
