import { RuntimeVisibilityService } from "./runtime-visibility-service";
import type { VisibilityRuntime } from "../../types/solar-system";

interface VisibilityServiceOptions {
  visibilityRuntimes: VisibilityRuntime[];
  runtimeVisibility: RuntimeVisibilityService;
}

export class VisibilityService {
  private readonly visibilityRuntimes: VisibilityRuntime[];
  private readonly runtimeVisibility: RuntimeVisibilityService;

  constructor(options: VisibilityServiceOptions) {
    this.visibilityRuntimes = options.visibilityRuntimes;
    this.runtimeVisibility = options.runtimeVisibility;
  }

  apply(): void {
    for (const runtime of this.visibilityRuntimes) {
      this.runtimeVisibility.apply(runtime);
    }
  }
}
