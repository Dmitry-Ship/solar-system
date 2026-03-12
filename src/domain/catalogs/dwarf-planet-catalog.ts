import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";
import type { DwarfPlanetCatalog } from "../../types/solar-system";

export const dwarfPlanetCatalog: DwarfPlanetCatalog = Object.freeze({
  DWARF_PLANET_DEFINITIONS: rawDefinitions.DWARF_PLANET_DEFINITIONS
});

namespace.domain.catalogs.dwarfPlanetCatalog = dwarfPlanetCatalog;
