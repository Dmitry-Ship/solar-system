import type { Group, PerspectiveCamera } from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import {
  VisibilityControlGroupFactory,
  type VisibilityControlGroup
} from "../../application/factories/visibility-control-group-factory";
import type {
  HudStateLike,
  MathApi,
  Point3,
  PovTargetKey,
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
  isZoomedIn: boolean;
  namesToggleLabel: string;
  orbitsToggleLabel: string;
  currentPov: PovTargetKey;
  showBodyNames: boolean;
  showOrbits: boolean;
  visibilityControlGroups: HudVisibilityControlGroupSnapshot[];
}

export type HudSubscriber = (snapshot: HudSnapshot) => void;

export interface HudHandle {
  updateZoomToggleLabel: () => void;
  getSnapshot: () => HudSnapshot;
  subscribe: (listener: HudSubscriber) => () => void;
  setPov: (pov: PovTargetKey) => void;
  toggleZoom: () => void;
  toggleNames: () => void;
  toggleOrbits: () => void;
  toggleVisibility: (key: VisibilityKey) => void;
}

interface HudControllerOptions {
  state: HudStateLike;
  controls: OrbitControls;
  orbitGroup: Group;
  visibilityRuntimes: VisibilityRuntime[];
  camera: PerspectiveCamera;
  math: Pick<MathApi, "clamp">;
  onOrbitVisibilityChanged?: (state: VisibilityStateLike, orbitGroup: Group) => void;
  onVisibilityChanged?: (state: VisibilityStateLike, visibilityRuntimes: VisibilityRuntime[]) => void;
  requestRender?: () => void;
  resolvePovTarget?: (pov: PovTargetKey) => Point3 | null;
  visibilityControlGroupFactory?: VisibilityControlGroupFactory;
}

export class HudController {
  private readonly state: HudStateLike;
  private readonly controls: OrbitControls;
  private readonly orbitGroup: Group;
  private readonly visibilityRuntimes: VisibilityRuntime[];
  private readonly camera: PerspectiveCamera;
  private readonly math: Pick<MathApi, "clamp">;
  private readonly onOrbitVisibilityChanged?: (
    state: VisibilityStateLike,
    orbitGroup: Group
  ) => void;
  private readonly onVisibilityChanged?: (
    state: VisibilityStateLike,
    visibilityRuntimes: VisibilityRuntime[]
  ) => void;
  private readonly requestRender?: () => void;
  private readonly resolvePovTarget?: (pov: PovTargetKey) => Point3 | null;
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
    this.visibilityRuntimes = options.visibilityRuntimes;
    this.camera = options.camera;
    this.math = options.math;
    this.onOrbitVisibilityChanged = options.onOrbitVisibilityChanged;
    this.onVisibilityChanged = options.onVisibilityChanged;
    this.requestRender = options.requestRender;
    this.resolvePovTarget = options.resolvePovTarget;
    this.visibilityControlGroupFactory =
      options.visibilityControlGroupFactory || new VisibilityControlGroupFactory();
  }

  private cameraDistance(): number {
    return this.camera.position.distanceTo(this.controls.target);
  }

  private isZoomedIn(): boolean {
    return Math.abs(this.cameraDistance() - this.state.minCamera) < 1e-3;
  }

  private getZoomToggleLabel(): string {
    return this.isZoomedIn() ? "Near" : "Far";
  }

  private getNamesToggleLabel(): string {
    return "Names";
  }

  private getOrbitsToggleLabel(): string {
    return "Orbits";
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
        const initialVisibility = Boolean(visibilityControl.initialVisibility);
        this.initialVisibilityByKey.set(visibilityControl.key, initialVisibility);
        this.state.registerVisibility(
          visibilityControl.key,
          initialVisibility,
          visibilityControl.groupKey
        );
      }
    }
    this.isSetup = true;
  }

  getSnapshot(): HudSnapshot {
    return {
      zoomToggleLabel: this.getZoomToggleLabel(),
      isZoomedIn: this.isZoomedIn(),
      namesToggleLabel: this.getNamesToggleLabel(),
      orbitsToggleLabel: this.getOrbitsToggleLabel(),
      currentPov: this.state.currentPov,
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
            this.initialVisibilityByKey.get(control.key)!
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

  private moveCameraTarget(targetPoint: Point3): void {
    const currentTarget = this.controls.target.clone();
    const nextTarget = currentTarget.clone().set(targetPoint.x, targetPoint.y, targetPoint.z);
    const targetDelta = nextTarget.clone().sub(currentTarget);

    this.camera.position.add(targetDelta);
    this.controls.target.copy(nextTarget);
    this.camera.lookAt(this.controls.target);
    this.controls.update();
  }

  setPov(pov: PovTargetKey): void {
    if (pov === this.state.currentPov) {
      this.emitSnapshot();
      return;
    }

    const targetPoint =
      pov === "sun" ? { x: 0, y: 0, z: 0 } : this.resolvePovTarget?.(pov);
    if (!targetPoint) {
      return;
    }

    this.state.setPov(pov);
    this.moveCameraTarget(targetPoint);
    this.updateZoomToggleLabel();
    this.requestRender?.();
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
      setPov: this.setPov.bind(this),
      toggleZoom: this.toggleZoom.bind(this),
      toggleNames: this.toggleNames.bind(this),
      toggleOrbits: this.toggleOrbits.bind(this),
      toggleVisibility: this.toggleVisibility.bind(this)
    };
  }
}
