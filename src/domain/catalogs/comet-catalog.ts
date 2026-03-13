import type { OrbitingBodyDefinition } from "../../types/solar-system";

export interface CometCatalog {
  COMET_DEFINITIONS: OrbitingBodyDefinition[];
}

const COMET_DEFINITIONS: OrbitingBodyDefinition[] = [
  {
    name: "1P/Halley",
    au: 17.834,
    radiusKm: 11,
    minPixelRadius: 1.35,
    color: "#d9e6ff",
    orbitColor: "#bfd9ff",
    inclinationDeg: 162.26,
    nodeDeg: 58.42,
    periapsisArgDeg: 111.33,
    eccentricity: 0.96714
  },
  {
    name: "2P/Encke",
    au: 2.216,
    radiusKm: 2.4,
    minPixelRadius: 1.2,
    color: "#ffe6c6",
    orbitColor: "#f7d7b3",
    inclinationDeg: 11.78,
    nodeDeg: 334.57,
    periapsisArgDeg: 186.54,
    eccentricity: 0.8483
  },
  {
    name: "67P/Churyumov-Gerasimenko",
    au: 3.463,
    radiusKm: 2,
    minPixelRadius: 1.2,
    color: "#f0e9dc",
    orbitColor: "#d9ccbb",
    inclinationDeg: 7.04,
    nodeDeg: 50.15,
    periapsisArgDeg: 12.74,
    eccentricity: 0.6406
  },
  {
    name: "109P/Swift-Tuttle",
    au: 26.092,
    radiusKm: 13,
    minPixelRadius: 1.35,
    color: "#d7f2ff",
    orbitColor: "#9bd7f2",
    inclinationDeg: 113.45,
    nodeDeg: 139.44,
    periapsisArgDeg: 152.98,
    eccentricity: 0.9632
  },
  {
    name: "C/1995 O1 (Hale-Bopp)",
    au: 186,
    radiusKm: 30,
    minPixelRadius: 1.45,
    color: "#e2f1ff",
    orbitColor: "#9fc7ff",
    inclinationDeg: 89.4,
    nodeDeg: 282.47,
    periapsisArgDeg: 130.59,
    eccentricity: 0.995
  },
  {
    name: "9P/Tempel 1",
    au: 3.153,
    radiusKm: 3,
    minPixelRadius: 1.2,
    color: "#efe7d8",
    orbitColor: "#d8c7ab",
    inclinationDeg: 10.47,
    nodeDeg: 68.93,
    periapsisArgDeg: 178.93,
    eccentricity: 0.517
  },
  {
    name: "19P/Borrelly",
    au: 3.614,
    radiusKm: 2.5,
    minPixelRadius: 1.2,
    color: "#e8e2d6",
    orbitColor: "#c9bda8",
    inclinationDeg: 30.31,
    nodeDeg: 75.37,
    periapsisArgDeg: 353.29,
    eccentricity: 0.624
  },
  {
    name: "21P/Giacobini-Zinner",
    au: 3.53,
    radiusKm: 2,
    minPixelRadius: 1.2,
    color: "#f3dec7",
    orbitColor: "#d9b998",
    inclinationDeg: 31.8,
    nodeDeg: 195.4,
    periapsisArgDeg: 172.8,
    eccentricity: 0.706
  },
  {
    name: "46P/Wirtanen",
    au: 3.09,
    radiusKm: 0.6,
    minPixelRadius: 1.2,
    color: "#f6ebd9",
    orbitColor: "#dbc8aa",
    inclinationDeg: 11.75,
    nodeDeg: 82.2,
    periapsisArgDeg: 356.3,
    eccentricity: 0.659
  },
  {
    name: "55P/Tempel-Tuttle",
    au: 10.33,
    radiusKm: 1.8,
    minPixelRadius: 1.2,
    color: "#e5eef9",
    orbitColor: "#b7cde6",
    inclinationDeg: 162.5,
    nodeDeg: 235.27,
    periapsisArgDeg: 172.5,
    eccentricity: 0.905
  },
  {
    name: "81P/Wild 2",
    au: 3.45,
    radiusKm: 2.5,
    minPixelRadius: 1.2,
    color: "#efe2ce",
    orbitColor: "#d1ba99",
    inclinationDeg: 3.24,
    nodeDeg: 136.4,
    periapsisArgDeg: 41.1,
    eccentricity: 0.538
  },
  {
    name: "103P/Hartley",
    au: 3.47,
    radiusKm: 0.7,
    minPixelRadius: 1.2,
    color: "#f1e4d1",
    orbitColor: "#d7b996",
    inclinationDeg: 13.6,
    nodeDeg: 219.8,
    periapsisArgDeg: 181.3,
    eccentricity: 0.695
  },
  {
    name: "153P/Ikeya-Zhang",
    au: 51.2,
    radiusKm: 3,
    minPixelRadius: 1.3,
    color: "#e0efff",
    orbitColor: "#a7cbf3",
    inclinationDeg: 28.1,
    nodeDeg: 93.4,
    periapsisArgDeg: 34.7,
    eccentricity: 0.99
  }
];

export const cometCatalog: CometCatalog = Object.freeze({
  COMET_DEFINITIONS
});
