import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";

export const cometCatalog = Object.freeze({
  COMET_DEFINITIONS: rawDefinitions.COMET_DEFINITIONS
});

namespace.domain.catalogs.cometCatalog = cometCatalog;
