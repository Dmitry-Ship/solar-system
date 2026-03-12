import { namespace } from "../../core/namespace";
import { RuntimeVisibilityService } from "./runtime-visibility-service";

export class VisibilityService {
    [key: string]: any;

    constructor(options: any) {
      this.state = options.state;
      this.visibilityRuntimes = options.visibilityRuntimes || [];
      this.runtimeVisibility =
        options.runtimeVisibility || new RuntimeVisibilityService({ state: this.state });
    }

    apply() {
      for (const runtime of this.visibilityRuntimes) {
        this.runtimeVisibility.apply(runtime);
      }
    }
  }

namespace.application.services.VisibilityService = VisibilityService;
