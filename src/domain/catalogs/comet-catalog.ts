import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";
import type { CometCatalog } from "../../types/solar-system";

export const cometCatalog: CometCatalog = Object.freeze({
  COMET_DEFINITIONS: rawDefinitions.COMET_DEFINITIONS
});

namespace.domain.catalogs.cometCatalog = cometCatalog;
