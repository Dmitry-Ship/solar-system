import { namespace } from "../../core/namespace";
import { SIMULATION_CONSTANTS } from "../constants/simulation-constants";

const STAR_DISTANCE_MIN_AU = SIMULATION_CONSTANTS.SCENE_OUTER_AU * 3.8;
const STAR_DISTANCE_MAX_AU = SIMULATION_CONSTANTS.SCENE_OUTER_AU * (3.8 + 4.5);
const ASTEROID_BELT_CONFIGS = [
  {
    name: "Main Belt",
    innerAu: 2.06,
    outerAu: 3.27,
    maxInclinationDeg: 34,
    eccentricityMin: 0.01,
    eccentricityMax: 0.35,
    count: 7000,
    color: "#a9a28f",
    alpha: 1.05
  },
  {
    name: "Kuiper Belt",
    innerAu: 30,
    outerAu: 55,
    maxInclinationDeg: 35,
    eccentricityMin: 0.02,
    eccentricityMax: 0.45,
    count: 7000,
    color: "#c8d4f0",
    alpha: 1.25,
    particleSize: 0.038,
    opacityScale: 0.28,
    maxOpacity: 0.34
  }
];

const ORBIT_RENDER_GROUPS = [
  {
    key: "planets",
    segments: 220,
    orbitColor: "#74a9ff"
  },
  {
    key: "dwarfPlanets",
    segments: 260,
    orbitColor: "#8ccf9f"
  },
  {
    key: "comets",
    segments: 320,
    orbitColor: "#f2bf78"
  }
];

export const beltCatalog = Object.freeze({
  STAR_DISTANCE_MIN_AU,
  STAR_DISTANCE_MAX_AU,
  ASTEROID_BELT_CONFIGS,
  ORBIT_RENDER_GROUPS
});

namespace.domain.catalogs.beltCatalog = beltCatalog;
