import type {
  VisibilityKey,
  VisibilityRuntime
} from "../../types/solar-system";

interface RuntimeVisibilityServiceOptions {
  state?: {
    isVisibilityEnabled?(key: VisibilityKey, fallbackVisibility?: boolean): boolean;
  };
}

export class RuntimeVisibilityService {
    private readonly state: RuntimeVisibilityServiceOptions["state"];

    constructor(options: RuntimeVisibilityServiceOptions = {}) {
      this.state = options.state;
    }

    resolveVisibilityTarget(runtime: VisibilityRuntime): { visible: boolean } | null {
      if (runtime.visibilityTarget) return runtime.visibilityTarget;
      if (runtime.object) return runtime.object;
      if (runtime.mesh) return runtime.mesh;
      return null;
    }

    isRuntimeVisible(runtime: VisibilityRuntime): boolean {
      const defaultVisibility = runtime.defaultVisible ?? true;
      if (typeof runtime.visibilityKey !== "string" || !runtime.visibilityKey) {
        return Boolean(defaultVisibility);
      }

      if (typeof this.state?.isVisibilityEnabled === "function") {
        return this.state.isVisibilityEnabled(runtime.visibilityKey, defaultVisibility);
      }

      return Boolean(defaultVisibility);
    }

    apply(runtime: VisibilityRuntime): boolean | null {
      const target = this.resolveVisibilityTarget(runtime);
      if (!target || !("visible" in target)) {
        return null;
      }

      const isVisible = this.isRuntimeVisible(runtime);
      target.visible = isVisible;
      return isVisible;
    }
  }
