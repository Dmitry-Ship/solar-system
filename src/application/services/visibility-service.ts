import type { RuntimeVisibilityService } from "./runtime-visibility-service";
import type { VisibilityRuntime } from "../../types/solar-system";

export interface VisibilityServiceOptions {
  visibilityRuntimes: VisibilityRuntime[];
  runtimeVisibility: Pick<RuntimeVisibilityService, "apply">;
}

export function applyVisibilityRuntimes(options: VisibilityServiceOptions): void {
  for (const runtime of options.visibilityRuntimes) {
    options.runtimeVisibility.apply(runtime);
  }
}

export function createVisibilityApplier(options: VisibilityServiceOptions): () => void {
  return () => {
    applyVisibilityRuntimes(options);
  };
}
