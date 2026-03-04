(() => {
  const namespace = window.SolarSystem;
  const raw = namespace?.domain?.catalogs?.rawDefinitions;
  if (!raw) {
    throw new Error("dwarf planet catalog bootstrap failed: missing raw definitions.");
  }

  namespace.domain.catalogs.dwarfPlanetCatalog = Object.freeze({
    DWARF_PLANET_DEFINITIONS: raw.DWARF_PLANET_DEFINITIONS
  });
})();
