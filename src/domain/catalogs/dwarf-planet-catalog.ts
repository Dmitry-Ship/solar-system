import { namespace } from "../../core/namespace";
import { rawDefinitions } from "./raw-definitions";

export const dwarfPlanetCatalog = Object.freeze({
  DWARF_PLANET_DEFINITIONS: rawDefinitions.DWARF_PLANET_DEFINITIONS
});

namespace.domain.catalogs.dwarfPlanetCatalog = dwarfPlanetCatalog;
