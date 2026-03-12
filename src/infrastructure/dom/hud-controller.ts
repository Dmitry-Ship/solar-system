import type { Group, PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { VisibilityControlGroupFactory } from "../../application/factories/visibility-control-group-factory";
import { HudView } from "./hud-view";
import type {
  HudHandle,
  MathApi,
  VisibilityRuntime,
  VisibilityStateLike
} from "../../types/solar-system";

interface HudControllerOptions {
  state: VisibilityStateLike;
  controls: OrbitControls;
  orbitGroup: Group | null;
  visibilityRuntimes?: VisibilityRuntime[];
  guideRuntimes?: VisibilityRuntime[];
  guideLineRuntimes?: VisibilityRuntime[];
  camera: PerspectiveCamera;
  math: Pick<MathApi, "clamp">;
  onOrbitVisibilityChanged?: (state: VisibilityStateLike, orbitGroup: Group | null) => void;
  onVisibilityChanged?: (state: VisibilityStateLike, visibilityRuntimes: VisibilityRuntime[]) => void;
  requestRender?: () => void;
  visibilityControlGroupFactory?: VisibilityControlGroupFactory;
  view?: HudView;
  document?: Document;
}

export class HudController {
  private readonly state: VisibilityStateLike;
  private readonly controls: OrbitControls;
  private readonly orbitGroup: Group | null;
  private readonly visibilityRuntimes: VisibilityRuntime[];
  private readonly camera: PerspectiveCamera;
  private readonly math: Pick<MathApi, "clamp">;
  private readonly onOrbitVisibilityChanged?: (
    state: VisibilityStateLike,
    orbitGroup: Group | null
  ) => void;
  private readonly onVisibilityChanged?: (
    state: VisibilityStateLike,
    visibilityRuntimes: VisibilityRuntime[]
  ) => void;
  private readonly requestRender?: () => void;
  private readonly visibilityControlGroupFactory: VisibilityControlGroupFactory;
  private readonly view: HudView;
  private updateZoomToggleLabel: () => void = () => {};

  constructor(options: HudControllerOptions) {
    this.state = options.state;
    this.controls = options.controls;
    this.orbitGroup = options.orbitGroup;
    this.visibilityRuntimes =
      options.visibilityRuntimes ||
      options.guideRuntimes ||
      options.guideLineRuntimes ||
      [];
    this.camera = options.camera;
    this.math = options.math;
    this.onOrbitVisibilityChanged = options.onOrbitVisibilityChanged;
    this.onVisibilityChanged = options.onVisibilityChanged;
    this.requestRender = options.requestRender;
    this.visibilityControlGroupFactory =
      options.visibilityControlGroupFactory || new VisibilityControlGroupFactory();
    this.view = options.view || new HudView({ document: options.document });
  }

  setupZoomToggle(zoomToggleButton: HTMLButtonElement | null): void {
    const cameraDistance = () => this.camera.position.distanceTo(this.controls.target);
    this.updateZoomToggleLabel = () => {
      if (!zoomToggleButton) return;
      zoomToggleButton.textContent =
        Math.abs(cameraDistance() - this.state.minCamera) < 1e-3
          ? "Maximum Zoom"
          : "Minimum Zoom";
    };

    const setCameraDistance = (distanceAu: number) => {
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
      this.requestRender?.();
    });
  }

  setupNamesToggle(namesToggleButton: HTMLButtonElement | null): void {
    if (!namesToggleButton) return;

    namesToggleButton.addEventListener("click", () => {
      this.state.showBodyNames = !this.state.showBodyNames;
      this.view.setBooleanToggleLabel(
        namesToggleButton,
        this.state.showBodyNames,
        "Hide Names",
        "Show Names"
      );
      this.requestRender?.();
    });

    this.view.setBooleanToggleLabel(
      namesToggleButton,
      this.state.showBodyNames,
      "Hide Names",
      "Show Names"
    );
  }

  setupOrbitToggle(orbitToggleButton: HTMLButtonElement | null): void {
    if (!orbitToggleButton) return;

    orbitToggleButton.addEventListener("click", () => {
      this.state.showOrbits = !this.state.showOrbits;
      this.onOrbitVisibilityChanged?.(this.state, this.orbitGroup);
      this.view.setBooleanToggleLabel(
        orbitToggleButton,
        this.state.showOrbits,
        "Hide Orbits",
        "Show Orbits"
      );
      this.requestRender?.();
    });

    this.view.setBooleanToggleLabel(
      orbitToggleButton,
      this.state.showOrbits,
      "Hide Orbits",
      "Show Orbits"
    );
  }

  setupVisibilityControls(): void {
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
        this.onVisibilityChanged?.(this.state, this.visibilityRuntimes);
        this.requestRender?.();
        return isVisible;
      },
      isControlVisible: (visibilityControl) =>
        this.state.isVisibilityEnabled(
          visibilityControl.key,
          visibilityControl.initialVisibility
        )
    });
  }

  setup(): HudHandle {
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
