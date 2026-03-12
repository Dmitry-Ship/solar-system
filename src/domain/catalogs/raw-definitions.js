(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.catalogs) {
    throw new Error("raw definitions bootstrap failed: missing domain catalogs namespace.");
  }

  const PLANET_DEFINITIONS = [
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

  const DWARF_PLANET_DEFINITIONS = [
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

  const COMET_DEFINITIONS = [
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

  const VOYAGERS = [
    {
      name: "Voyager 1",
      color: "#ffb36a",
      position: { x: -31.907038, y: -135.14229, z: 97.779917 },
      minPixelRadius: 1.45,
      radiusKm: 0.005
    },
    {
      name: "Voyager 2",
      color: "#7ed7ff",
      position: { x: 39.370762, y: -104.309856, z: -88.304409 },
      minPixelRadius: 1.45,
      radiusKm: 0.005
    }
  ];

  const DRIFTING_BODIES = [];

  const DIRECTIONAL_MARKER_DEFINITIONS = [
    {
      name: "61 Cygni",
      label: "61 Cygni (11.4 light-years)",
      color: "#ffb878",
      raHours: 21 + 6 / 60 + 53.94 / 3600,
      decDeg: 38 + 44 / 60 + 57.9 / 3600,
      minPixelRadius: 2.5
    },
    {
      name: "Gliese 300",
      label: "Gliese 300 (26 light years)",
      color: "#ff6f63",
      raHours: 8 + 12 / 60 + 40.8889728169 / 3600,
      decDeg: -(21 + 33 / 60 + 6.982558553 / 3600),
      minPixelRadius: 2.5
    }
  ];

  const TRAJECTORY_DEFINITIONS = [
    {
      name: "61 Cygni Transfer",
      label: "",
      visibilityLabel: "61 Cygni trajectory",
      launchMarkerName: "61 Cygni",
      firstFocalMarkerName: "Gliese 300",
      secondFocalMarkerName: "61 Cygni",
      solarAssistRadiusAu: 0.01,
      color: "#ffd36e"
    }
  ];

  namespace.domain.catalogs.rawDefinitions = Object.freeze({
    PLANET_DEFINITIONS,
    DWARF_PLANET_DEFINITIONS,
    COMET_DEFINITIONS,
    VOYAGERS,
    DRIFTING_BODIES,
    DIRECTIONAL_MARKER_DEFINITIONS,
    TRAJECTORY_DEFINITIONS
  });
})();
