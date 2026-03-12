import { namespace } from "../../core/namespace";

const MIN_CAMERA_DISTANCE_AU = 0.1;
const MAX_CAMERA_DISTANCE_AU = 6000;

export class AppState {
    showBodyNames: boolean;
    showOrbits: boolean;
    showLightRays: boolean;
    visibilityByKey: Record<string, boolean>;
    visibilityGroupByKey: Record<string, string>;
    lightRayVisibilityByKey: Record<string, boolean>;
    minCamera: number;
    maxCamera: number;

    constructor() {
      this.showBodyNames = false;
      this.showOrbits = true;
      this.showLightRays = false;
      this.visibilityByKey = Object.create(null);
      this.visibilityGroupByKey = Object.create(null);
      this.lightRayVisibilityByKey = this.visibilityByKey;
      this.minCamera = MIN_CAMERA_DISTANCE_AU;
      this.maxCamera = MAX_CAMERA_DISTANCE_AU;
    }

    registerVisibility(key: string, initialVisibility = false, groupKey = ""): void {
      if (typeof key !== "string" || !key) return;
      if (!(key in this.visibilityByKey)) {
        this.visibilityByKey[key] = Boolean(initialVisibility);
      }

      if (typeof groupKey === "string" && groupKey) {
        this.visibilityGroupByKey[key] = groupKey;
      } else if (!(key in this.visibilityGroupByKey)) {
        this.visibilityGroupByKey[key] = "";
      }

      this.syncLegacyVisibilityAggregates();
    }

    isVisibilityEnabled(key: string, fallbackVisibility = true): boolean {
      if (typeof key !== "string" || !key) {
        return Boolean(fallbackVisibility);
      }

      return key in this.visibilityByKey
        ? Boolean(this.visibilityByKey[key])
        : Boolean(fallbackVisibility);
    }

    setVisibility(key: string, isVisible: boolean): boolean {
      if (typeof key !== "string" || !key) return false;
      this.visibilityByKey[key] = Boolean(isVisible);
      this.syncLegacyVisibilityAggregates();
      return this.visibilityByKey[key];
    }

    toggleVisibility(key: string, fallbackVisibility = false): boolean {
      return this.setVisibility(key, !this.isVisibilityEnabled(key, fallbackVisibility));
    }

    isAnyVisibilityEnabled(groupKey = ""): boolean {
      return Object.keys(this.visibilityByKey).some(
        (key) =>
          this.visibilityGroupByKey[key] === groupKey && Boolean(this.visibilityByKey[key])
      );
    }

    syncLegacyVisibilityAggregates(): void {
      this.showLightRays = this.isAnyVisibilityEnabled("light-rays");
    }

    registerLightRay(key: string, initialVisibility = false): void {
      this.registerVisibility(key, initialVisibility, "light-rays");
    }

    isLightRayVisible(key: string): boolean {
      if (typeof key !== "string" || !key) {
        return Boolean(this.showLightRays);
      }

      return this.isVisibilityEnabled(key, false);
    }

    setLightRayVisibility(key: string, isVisible: boolean): boolean {
      return this.setVisibility(key, isVisible);
    }

    toggleLightRayVisibility(key: string): boolean {
      return this.toggleVisibility(key, false);
    }
  }

namespace.application.state.AppState = AppState;
