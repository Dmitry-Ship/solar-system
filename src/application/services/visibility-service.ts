import { RuntimeVisibilityService } from "./runtime-visibility-service";
import type { VisibilityRuntime, VisibilityStateLike } from "../../types/solar-system";

interface VisibilityServiceOptions {
  state: VisibilityStateLike;
  visibilityRuntimes?: VisibilityRuntime[];
  runtimeVisibility?: RuntimeVisibilityService;
}

export class VisibilityService {
  private readonly state: VisibilityStateLike;
  private readonly visibilityRuntimes: VisibilityRuntime[];
  private readonly runtimeVisibility: RuntimeVisibilityService;

  constructor(options: VisibilityServiceOptions) {
    this.state = options.state;
    this.visibilityRuntimes = options.visibilityRuntimes || [];
    this.runtimeVisibility =
      options.runtimeVisibility || new RuntimeVisibilityService({ state: this.state });
  }

  apply(): void {
    for (const runtime of this.visibilityRuntimes) {
      this.runtimeVisibility.apply(runtime);
    }
  }
}
