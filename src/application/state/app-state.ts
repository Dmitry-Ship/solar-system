import type {
  LightRayVisibilityKey,
  PovTargetKey,
  VisibilityGroupKey,
  VisibilityKey
} from "../../types/solar-system";

const MIN_CAMERA_DISTANCE_AU = 0.1;
const MAX_CAMERA_DISTANCE_AU = 6000;

export class AppState {
    showBodyNames: boolean;
    showOrbits: boolean;
    showLightRays: boolean;
    currentPov: PovTargetKey;
    visibilityByKey: Partial<Record<VisibilityKey, boolean>>;
    visibilityGroupByKey: Partial<Record<VisibilityKey, VisibilityGroupKey>>;
    lightRayVisibilityByKey: Partial<Record<VisibilityKey, boolean>>;
    minCamera: number;
    maxCamera: number;

    constructor() {
      this.showBodyNames = false;
      this.showOrbits = true;
      this.showLightRays = false;
      this.currentPov = "sun";
      this.visibilityByKey = Object.create(null);
      this.visibilityGroupByKey = Object.create(null);
      this.lightRayVisibilityByKey = this.visibilityByKey;
      this.minCamera = MIN_CAMERA_DISTANCE_AU;
      this.maxCamera = MAX_CAMERA_DISTANCE_AU;
    }

    registerVisibility(
      key: VisibilityKey,
      initialVisibility = false,
      groupKey?: VisibilityGroupKey
    ): void {
      if (typeof key !== "string" || !key) return;
      if (!(key in this.visibilityByKey)) {
        this.visibilityByKey[key] = Boolean(initialVisibility);
      }

      if (typeof groupKey === "string" && groupKey) {
        this.visibilityGroupByKey[key] = groupKey;
      } else if (!(key in this.visibilityGroupByKey)) {
        delete this.visibilityGroupByKey[key];
      }

      this.syncLegacyVisibilityAggregates();
    }

    isVisibilityEnabled(key: VisibilityKey, fallbackVisibility = true): boolean {
      if (typeof key !== "string" || !key) {
        return Boolean(fallbackVisibility);
      }

      return key in this.visibilityByKey
        ? Boolean(this.visibilityByKey[key])
        : Boolean(fallbackVisibility);
    }

    setVisibility(key: VisibilityKey, isVisible: boolean): boolean {
      if (typeof key !== "string" || !key) return false;
      this.visibilityByKey[key] = Boolean(isVisible);
      this.syncLegacyVisibilityAggregates();
      return this.visibilityByKey[key];
    }

    toggleVisibility(key: VisibilityKey, fallbackVisibility = false): boolean {
      return this.setVisibility(key, !this.isVisibilityEnabled(key, fallbackVisibility));
    }

    isAnyVisibilityEnabled(groupKey?: VisibilityGroupKey): boolean {
      return Object.keys(this.visibilityByKey).some(
        (key) =>
          this.visibilityGroupByKey[key as VisibilityKey] === groupKey &&
          Boolean(this.visibilityByKey[key as VisibilityKey])
      );
    }

    syncLegacyVisibilityAggregates(): void {
      this.showLightRays = this.isAnyVisibilityEnabled("light-rays");
    }

    registerLightRay(key: LightRayVisibilityKey, initialVisibility = false): void {
      this.registerVisibility(key, initialVisibility, "light-rays");
    }

    isLightRayVisible(key: LightRayVisibilityKey): boolean {
      if (typeof key !== "string" || !key) {
        return Boolean(this.showLightRays);
      }

      return this.isVisibilityEnabled(key, false);
    }

    setLightRayVisibility(key: LightRayVisibilityKey, isVisible: boolean): boolean {
      return this.setVisibility(key, isVisible);
    }

    toggleLightRayVisibility(key: LightRayVisibilityKey): boolean {
      return this.toggleVisibility(key, false);
    }

    setPov(pov: PovTargetKey): PovTargetKey {
      this.currentPov = pov;
      return this.currentPov;
    }
  }
