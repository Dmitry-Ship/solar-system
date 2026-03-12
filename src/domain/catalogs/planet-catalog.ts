import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";

export const planetCatalog = Object.freeze({
  PLANET_DEFINITIONS: rawDefinitions.PLANET_DEFINITIONS
});

namespace.domain.catalogs.planetCatalog = planetCatalog;
