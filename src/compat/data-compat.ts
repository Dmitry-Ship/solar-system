import { SIMULATION_CONSTANTS } from "../domain/constants/simulation-constants";
import { OrbitalMath } from "../domain/math/orbital-math";
import { rawDefinitions } from "../domain/catalogs/raw-definitions";
import { planetCatalog } from "../domain/catalogs/planet-catalog";
import { dwarfPlanetCatalog } from "../domain/catalogs/dwarf-planet-catalog";
import { cometCatalog } from "../domain/catalogs/comet-catalog";
import { markerCatalog } from "../domain/catalogs/marker-catalog";
import { beltCatalog } from "../domain/catalogs/belt-catalog";
import { SceneDataFactory } from "../application/factories/scene-data-factory";

export const sceneDataFactory = new SceneDataFactory({
  constants: SIMULATION_CONSTANTS,
  math: OrbitalMath,
  planetCatalog,
  dwarfPlanetCatalog,
  cometCatalog,
  markerCatalog,
  beltCatalog,
  rawDefinitions,
  random: Math.random
});

export const data = {
  createSceneData() {
    return sceneDataFactory.createSceneData();
  }
};
