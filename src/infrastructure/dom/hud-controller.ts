import type { Group, PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  VisibilityControlGroupFactory,
  type VisibilityControlGroup
} from "../../application/factories/visibility-control-group-factory";
import type {
  MathApi,
  VisibilityKey,
  VisibilityRuntime,
  VisibilityStateLike
} from "../../types/solar-system";

export interface HudVisibilityControlSnapshot {
  key: VisibilityKey;
  label: string;
  groupKey: string;
  isVisible: boolean;
}

export interface HudVisibilityControlGroupSnapshot {
  key: string;
  label: string;
  controls: HudVisibilityControlSnapshot[];
}

export interface HudSnapshot {
  zoomToggleLabel: string;
  namesToggleLabel: string;
  orbitsToggleLabel: string;
  showBodyNames: boolean;
  showOrbits: boolean;
  visibilityControlGroups: HudVisibilityControlGroupSnapshot[];
}

export type HudSubscriber = (snapshot: HudSnapshot) => void;

export interface HudHandle {
  updateZoomToggleLabel: () => void;
  getSnapshot: () => HudSnapshot;
  subscribe: (listener: HudSubscriber) => () => void;
  toggleZoom: () => void;
  toggleNames: () => void;
  toggleOrbits: () => void;
  toggleVisibility: (key: VisibilityKey) => void;
}

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
  private readonly subscribers = new Set<HudSubscriber>();
  private readonly initialVisibilityByKey = new Map<VisibilityKey, boolean>();
  private visibilityControlGroups: VisibilityControlGroup[] = [];
  private isSetup = false;
  private updateZoomToggleLabel: () => void = () => {
    this.emitSnapshot();
  };

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
  }

  private cameraDistance(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  private getZoomToggleLabel(): string {
    return Math.abs(this.cameraDistance() - this.state.minCamera) < 1e-3
      ? "Maximum Zoom"
      : "Minimum Zoom";
  }

  private getNamesToggleLabel(): string {
    return this.state.showBodyNames ? "Hide Body Names" : "Show Body Names";
  }

  private getOrbitsToggleLabel(): string {
    return this.state.showOrbits ? "Hide Orbits" : "Show Orbits";
  }

  private emitSnapshot(): void {
    const snapshot = this.getSnapshot();
    for (const subscriber of this.subscribers) {
      subscriber(snapshot);
    }
  }

  private registerVisibilityControls(): void {
    if (this.isSetup) {
      return;
    }

    this.visibilityControlGroups = this.visibilityControlGroupFactory.create(this.visibilityRuntimes);
    for (const visibilityControlGroup of this.visibilityControlGroups) {
      for (const visibilityControl of visibilityControlGroup.controls) {
        this.initialVisibilityByKey.set(
          visibilityControl.key,
          Boolean(visibilityControl.initialVisibility)
        );
        this.state.registerVisibility(
          visibilityControl.key,
          this.initialVisibilityByKey.get(visibilityControl.key) ?? false,
          visibilityControl.groupKey
        );
      }
    }
    this.isSetup = true;
  }

  getSnapshot(): HudSnapshot {
    return {
      zoomToggleLabel: this.getZoomToggleLabel(),
      namesToggleLabel: this.getNamesToggleLabel(),
      orbitsToggleLabel: this.getOrbitsToggleLabel(),
      showBodyNames: this.state.showBodyNames,
      showOrbits: this.state.showOrbits,
      visibilityControlGroups: this.visibilityControlGroups.map((group) => ({
        key: group.key,
        label: group.label,
        controls: group.controls.map((control) => ({
          key: control.key,
          label: control.label,
          groupKey: control.groupKey,
          isVisible: this.state.isVisibilityEnabled(
            control.key,
            this.initialVisibilityByKey.get(control.key) ?? false
          )
        }))
      }))
    };
  }

  subscribe(listener: HudSubscriber): () => void {
    this.subscribers.add(listener);
    listener(this.getSnapshot());
    return () => {
      this.subscribers.delete(listener);
    };
  }

  toggleZoom(): void {
    const cameraDistance = this.cameraDistance();

    const setCameraDistance = (distanceAu: number) => {
      const clamped = this.math.clamp(distanceAu, this.state.minCamera, this.state.maxCamera);
      const direction = this.camera.position.clone().sub(this.controls.target).normalize();
      this.camera.position.copy(this.controls.target).addScaledVector(direction, clamped);
      this.controls.update();
    };

    const targetDistance =
      Math.abs(cameraDistance - this.state.minCamera) < 1e-3
        ? this.state.maxCamera
        : this.state.minCamera;
    setCameraDistance(targetDistance);
    this.updateZoomToggleLabel();
    this.requestRender?.();
  }

  toggleNames(): void {
    this.state.showBodyNames = !this.state.showBodyNames;
    this.requestRender?.();
    this.emitSnapshot();
  }

  toggleOrbits(): void {
    this.state.showOrbits = !this.state.showOrbits;
    this.onOrbitVisibilityChanged?.(this.state, this.orbitGroup);
    this.requestRender?.();
    this.emitSnapshot();
  }

  toggleVisibility(key: VisibilityKey): void {
    const fallbackVisibility = this.initialVisibilityByKey.get(key) ?? false;
    this.state.toggleVisibility(key, fallbackVisibility);
    this.onVisibilityChanged?.(this.state, this.visibilityRuntimes);
    this.requestRender?.();
    this.emitSnapshot();
  }

  setup(): HudHandle {
    this.registerVisibilityControls();
    this.updateZoomToggleLabel = () => {
      this.emitSnapshot();
    };
    this.emitSnapshot();

    return {
      updateZoomToggleLabel: this.updateZoomToggleLabel,
      getSnapshot: this.getSnapshot.bind(this),
      subscribe: this.subscribe.bind(this),
      toggleZoom: this.toggleZoom.bind(this),
      toggleNames: this.toggleNames.bind(this),
      toggleOrbits: this.toggleOrbits.bind(this),
      toggleVisibility: this.toggleVisibility.bind(this)
    };
  }
}
