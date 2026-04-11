import type { OrbitingBodyDefinition } from "../../types/solar-system";

export interface PlanetCatalog {
  PLANET_DEFINITIONS: OrbitingBodyDefinition[];
}

const PLANET_DEFINITIONS: OrbitingBodyDefinition[] = [
  {
    name: "Mercury",
    au: 0.387098,
    radiusKm: 2439.7,
    color: "#c5c7cc",
    inclinationDeg: 7.005014,
    nodeDeg: 48.330539,
    periapsisArgDeg: 29.124279,
    eccentricity: 0.20563
  },
  {
    name: "Venus",
    au: 0.723327,
    radiusKm: 6051.8,
    color: "#e9c784",
    inclinationDeg: 3.39459,
    nodeDeg: 76.678375,
    periapsisArgDeg: 55.185415,
    eccentricity: 0.006756
  },
  {
    name: "Earth 🌎",
    au: 1.000372,
    radiusKm: 6371,
    color: "#5ea7ff",
    // Derived from the guide marker so Earth stays opposite the 61 Cygni direction.
    initialOppositionMarkerName: "61 Cygni",
    inclinationDeg: 0.000267,
    nodeDeg: 163.974871,
    periapsisArgDeg: 297.76718,
    eccentricity: 0.017042
  },
  {
    name: "Mars",
    au: 1.523678,
    radiusKm: 3389.5,
    color: "#d8845f",
    inclinationDeg: 1.849877,
    nodeDeg: 49.561999,
    periapsisArgDeg: 286.537358,
    eccentricity: 0.093315
  },
  {
    name: "Jupiter",
    au: 5.205109,
    radiusKm: 69911,
    color: "#dcb68f",
    inclinationDeg: 1.304656,
    nodeDeg: 100.488862,
    periapsisArgDeg: 275.119706,
    eccentricity: 0.048923
  },
  {
    name: "Saturn",
    au: 9.581452,
    radiusKm: 58232,
    color: "#e6cf96",
    inclinationDeg: 2.484369,
    nodeDeg: 113.693013,
    periapsisArgDeg: 335.900649,
    eccentricity: 0.055599
  },
  {
    name: "Uranus",
    au: 19.229938,
    radiusKm: 25362,
    color: "#98ebef",
    inclinationDeg: 0.772381,
    nodeDeg: 73.962918,
    periapsisArgDeg: 96.607973,
    eccentricity: 0.044394
  },
  {
    name: "Neptune",
    au: 30.097004,
    radiusKm: 24622,
    color: "#5f84ff",
    inclinationDeg: 1.773472,
    nodeDeg: 131.769343,
    periapsisArgDeg: 266.822132,
    eccentricity: 0.011148
  },
  {
    name: "Planet Nine (Hypothetical)",
    // Median of remaining Brown et al. (2024) reference-population objects
    // after ZTF + DES + PS1 detectability cuts.
    au: 499.24,
    radiusKm: 13634,
    color: "#9fb2d9",
    inclinationDeg: 17.2,
    nodeDeg: 93.13,
    periapsisArgDeg: 151.95,
    eccentricity: 0.286
  }
];

export const planetCatalog: PlanetCatalog = {
  PLANET_DEFINITIONS
};
