import type { OrbitingBodyDefinition } from "../../types/solar-system";

export interface DwarfPlanetCatalog {
  DWARF_PLANET_DEFINITIONS: OrbitingBodyDefinition[];
}

const DWARF_PLANET_DEFINITIONS: OrbitingBodyDefinition[] = [
  {
    name: "Ceres",
    au: 2.765616,
    radiusKm: 469.7,
    color: "#b9b6b0",
    inclinationDeg: 10.587887,
    nodeDeg: 80.249631,
    periapsisArgDeg: 73.299755,
    eccentricity: 0.079576
  },
  {
    name: "Pluto",
    au: 39.588629,
    radiusKm: 1188.3,
    color: "#d5c5b2",
    inclinationDeg: 17.147711,
    nodeDeg: 110.292384,
    periapsisArgDeg: 113.709002,
    eccentricity: 0.251838
  },
  {
    name: "Orcus",
    au: 39.335776,
    radiusKm: 458,
    color: "#c4bcae",
    inclinationDeg: 20.555526,
    nodeDeg: 268.385942,
    periapsisArgDeg: 73.722492,
    eccentricity: 0.22173
  },
  {
    name: "Ixion",
    au: 39.350537,
    radiusKm: 310,
    color: "#b4aba4",
    inclinationDeg: 19.670412,
    nodeDeg: 71.092958,
    periapsisArgDeg: 300.658572,
    eccentricity: 0.244233
  },
  {
    name: "2002 MS4",
    au: 41.595308,
    radiusKm: 467,
    color: "#afb8cf",
    inclinationDeg: 17.703949,
    nodeDeg: 216.186223,
    periapsisArgDeg: 215.216085,
    eccentricity: 0.148694
  },
  {
    name: "Salacia",
    au: 42.11465,
    radiusKm: 423,
    color: "#a8bfd9",
    inclinationDeg: 23.927126,
    nodeDeg: 280.26263,
    periapsisArgDeg: 309.477696,
    eccentricity: 0.103379
  },
  {
    name: "Varuna",
    au: 43.178234,
    radiusKm: 334,
    color: "#c6b29f",
    inclinationDeg: 17.138124,
    nodeDeg: 97.210302,
    periapsisArgDeg: 273.220622,
    eccentricity: 0.052545
  },
  {
    name: "Haumea",
    au: 43.005499,
    radiusKm: 816,
    color: "#b9d1ef",
    inclinationDeg: 28.208406,
    nodeDeg: 121.79729,
    periapsisArgDeg: 240.888336,
    eccentricity: 0.195775
  },
  {
    name: "Quaoar",
    au: 43.14768,
    radiusKm: 555,
    color: "#dcc7ab",
    inclinationDeg: 7.991371,
    nodeDeg: 188.96328,
    periapsisArgDeg: 163.923138,
    eccentricity: 0.035839
  },
  {
    name: "Makemake",
    au: 45.510682,
    radiusKm: 715,
    color: "#e8d2b2",
    inclinationDeg: 29.032306,
    nodeDeg: 79.268921,
    periapsisArgDeg: 297.075422,
    eccentricity: 0.160425
  },
  {
    name: "Varda",
    au: 45.538062,
    radiusKm: 361,
    color: "#a8b4cf",
    inclinationDeg: 21.514033,
    nodeDeg: 184.121478,
    periapsisArgDeg: 184.974333,
    eccentricity: 0.143008
  },
  {
    name: "FarFarOut",
    au: 80.167485,
    radiusKm: 200,
    color: "#cbbfd7",
    inclinationDeg: 18.675119,
    nodeDeg: 68.357449,
    periapsisArgDeg: 231.855396,
    eccentricity: 0.655404
  },
  {
    name: "2012 VP113",
    au: 269.733437,
    radiusKm: 225,
    color: "#c8b6ab",
    inclinationDeg: 23.996571,
    nodeDeg: 90.902198,
    periapsisArgDeg: 294.289749,
    eccentricity: 0.701051
  },
  {
    name: "2004 VN112",
    au: 346.77519,
    radiusKm: 120,
    color: "#aab9c9",
    inclinationDeg: 25.49988,
    nodeDeg: 66.039618,
    periapsisArgDeg: 327.268055,
    eccentricity: 0.863405
  },
  {
    name: "Gonggong",
    au: 66.893669,
    radiusKm: 615,
    color: "#e2cdc0",
    inclinationDeg: 30.866261,
    nodeDeg: 336.840096,
    periapsisArgDeg: 206.641607,
    eccentricity: 0.503167
  },
  {
    name: "Eris",
    au: 67.996365,
    radiusKm: 1163,
    color: "#dfe4f8",
    inclinationDeg: 43.868932,
    nodeDeg: 36.027173,
    periapsisArgDeg: 150.732461,
    eccentricity: 0.436965
  },
  {
    name: "Sedna",
    au: 549.540528,
    radiusKm: 500,
    color: "#c6b8ad",
    inclinationDeg: 11.925917,
    nodeDeg: 144.478727,
    periapsisArgDeg: 311.009771,
    eccentricity: 0.861297
  },
  {
    name: "2013 SY99",
    au: 839.931669,
    radiusKm: 100,
    color: "#b8c6a7",
    inclinationDeg: 4.222627,
    nodeDeg: 29.518772,
    periapsisArgDeg: 32.206234,
    eccentricity: 0.940569
  },
  {
    name: "2015 TG387",
    au: 1389.351654,
    radiusKm: 180,
    color: "#c4b0a2",
    inclinationDeg: 11.67911,
    nodeDeg: 301.134472,
    periapsisArgDeg: 118.1304,
    eccentricity: 0.953417
  }
];

export const dwarfPlanetCatalog: DwarfPlanetCatalog = {
  DWARF_PLANET_DEFINITIONS
};
