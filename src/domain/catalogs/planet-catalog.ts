import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";
import type { PlanetCatalog } from "../../types/solar-system";

export const planetCatalog: PlanetCatalog = Object.freeze({
  PLANET_DEFINITIONS: rawDefinitions.PLANET_DEFINITIONS
});

namespace.domain.catalogs.planetCatalog = planetCatalog;
