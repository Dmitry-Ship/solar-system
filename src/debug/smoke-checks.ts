import { getAppInstance } from "../runtime/app-runtime";
import { app, constants, data, math } from "../runtime/public-api";
import type { MathApi, Point3, SceneData } from "../types/solar-system";

interface SmokeCheckResult {
  name: string;
  passed: boolean;
  details: string;
}

function createResult(name: string, passed: boolean, details = ""): SmokeCheckResult {
  return { name, passed: Boolean(passed), details };
}

function approxEqual(a: number, b: number, tolerance = 1e-9): boolean {
  return Math.abs(a - b) <= tolerance;
}

function pointMagnitude(point: Point3): number {
  return Math.hypot(point.x, point.y, point.z);
}

function normalizePoint(point: Point3): Point3 {
  const magnitude = pointMagnitude(point);
  if (magnitude <= 1e-9) {
    return { x: 0, y: 0, z: 0 };
  }

  return {
    x: point.x / magnitude,
    y: point.y / magnitude,
    z: point.z / magnitude
  };
}

function dotPoint(a: Point3, b: Point3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z;
}

function referenceSolveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
  const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
  const normalizeAngleSigned = (value: number) => {
    const turn = Math.PI * 2;
    let result = value % turn;
    if (result <= -Math.PI) result += turn;
    if (result > Math.PI) result -= turn;
    return result;
  };

  const e = clamp(eccentricity, 0, 0.999);
  if (e < 1e-6) return meanAnomaly;

  const normalizedMeanAnomaly = normalizeAngleSigned(meanAnomaly);
  let eccentricAnomaly =
    e < 0.8
      ? normalizedMeanAnomaly
      : normalizedMeanAnomaly + 0.85 * e * Math.sign(Math.sin(normalizedMeanAnomaly) || 1);

  for (let i = 0; i < 15; i += 1) {
    const sinE = Math.sin(eccentricAnomaly);
    const cosE = Math.cos(eccentricAnomaly);
    const delta =
      (eccentricAnomaly - e * sinE - normalizedMeanAnomaly) /
      Math.max(1e-7, 1 - e * cosE);
    eccentricAnomaly -= delta;
    if (Math.abs(delta) < 1e-10) break;
  }
  return eccentricAnomaly;
}

function getErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

export function runSmokeChecks() {
  const results: SmokeCheckResult[] = [];
  const dataApi = data;
  const mathApi = math;

  const hasPublicExports = constants && math && data && app;
  results.push(
    createResult(
      "Public API",
      Boolean(hasPublicExports),
      hasPublicExports
        ? "Required public exports exist."
        : "Missing a required public export."
    )
  );

  let sceneData: SceneData | null = null;
  try {
    if (!dataApi) {
      throw new Error("Scene data API missing.");
    }

    sceneData = dataApi.createSceneData();
    const sceneDataSecondPass = dataApi.createSceneData();
    const hasStars =
      sceneData.stars?.positions instanceof Float32Array && sceneData.stars.count > 0;
    const validSceneData =
      Array.isArray(sceneData.planets) &&
      sceneData.planets.length > 0 &&
      Array.isArray(sceneData.dwarfPlanets) &&
      sceneData.dwarfPlanets.length > 0 &&
      Array.isArray(sceneData.comets) &&
      sceneData.comets.length > 0 &&
      hasStars;
    results.push(
      createResult(
        "Scene Assembly",
        validSceneData,
        validSceneData ? "Scene data collections were generated." : "Scene data shape is invalid."
      )
    );

    const earthA = sceneData.planets.find((planet) => planet.name === "Earth 🌎") ?? null;
    const earthB = sceneDataSecondPass.planets.find((planet) => planet.name === "Earth 🌎") ?? null;
    const earthPositionA =
      earthA &&
      mathApi?.orbitalPositionInto(
        { x: 0, y: 0, z: 0 },
        earthA.orbitRadius,
        earthA.theta,
        earthA.inclination,
        earthA.node,
        0,
        earthA.eccentricity,
        earthA.periapsisArg
      );
    const earthPositionB =
      earthB &&
      mathApi?.orbitalPositionInto(
        { x: 0, y: 0, z: 0 },
        earthB.orbitRadius,
        earthB.theta,
        earthB.inclination,
        earthB.node,
        0,
        earthB.eccentricity,
        earthB.periapsisArg
      );
    const deterministicEarthPosition =
      !!earthA &&
      !!earthB &&
      approxEqual(earthA.theta, earthB.theta) &&
      !!earthPositionA &&
      !!earthPositionB &&
      approxEqual(earthPositionA.x, earthPositionB.x) &&
      approxEqual(earthPositionA.y, earthPositionB.y) &&
      approxEqual(earthPositionA.z, earthPositionB.z);
    results.push(
      createResult(
        "Earth Position Determinism",
        deterministicEarthPosition,
        deterministicEarthPosition
          ? "Earth keeps the same orbital phase across scene rebuilds."
          : "Earth phase or position changes across scene rebuilds."
      )
    );

    const cygniMarker = sceneData.directionalMarkers.find((marker) => marker.name === "61 Cygni") ?? null;
    const earthOppositionDot =
      earthPositionA && cygniMarker
        ? dotPoint(normalizePoint(earthPositionA), normalizePoint(cygniMarker))
        : Number.NaN;
    const earthOppositionOk =
      !!earthPositionA && !!cygniMarker && Number.isFinite(earthOppositionDot) && earthOppositionDot <= -0.95;
    results.push(
      createResult(
        "Earth Opposition to 61 Cygni",
        earthOppositionOk,
        earthOppositionOk
          ? "Earth is positioned on the orbital side opposite the 61 Cygni direction."
          : "Earth is not opposite enough to the 61 Cygni direction."
      )
    );
  } catch (error) {
    results.push(
      createResult("Scene Assembly", false, `Scene factory threw: ${getErrorMessage(error)}`)
    );
  }

  try {
    if (!mathApi) {
      throw new Error("Math API missing.");
    }

    const refValue = referenceSolveEccentricAnomaly(1.23456789, 0.42);
    const appValue = mathApi.solveEccentricAnomaly(1.23456789, 0.42);
    const eccentricAnomalyParity = approxEqual(refValue, appValue, 1e-9);
    results.push(
      createResult(
        "Math Parity (solveEccentricAnomaly)",
        eccentricAnomalyParity,
        eccentricAnomalyParity
          ? "Eccentric anomaly result is within tolerance."
          : `Expected ${refValue}, got ${appValue}.`
      )
    );

    const outA = { x: 0, y: 0, z: 0 };
    const outB = { x: 0, y: 0, z: 0 };
    mathApi.orbitalPositionInto(outA, 2.5, 0.6, 0.2, 0.8, 0, 0.3, 0.7);
    mathApi.orbitalPositionInto(outB, 2.5, 0.6, 0.2, 0.8, 0, 0.3, 0.7);
    const orbitalPositionParity =
      approxEqual(outA.x, outB.x) && approxEqual(outA.y, outB.y) && approxEqual(outA.z, outB.z);
    results.push(
      createResult(
        "Math Parity (orbitalPositionInto)",
        orbitalPositionParity,
        orbitalPositionParity
          ? "Orbital position deterministic output verified."
          : "Orbital position mismatch."
      )
    );

    const pointsA = mathApi.orbitPoints(3.1, 0.1, 0.2, 36, 0.15, 0.4);
    const pointsB = mathApi.orbitPoints(3.1, 0.1, 0.2, 36, 0.15, 0.4);
    const orbitPointsParity =
      pointsA.length === pointsB.length &&
      pointsA.every(
        (point, index) =>
          approxEqual(point.x, pointsB[index].x) &&
          approxEqual(point.y, pointsB[index].y) &&
          approxEqual(point.z, pointsB[index].z)
      );
    results.push(
      createResult(
        "Math Parity (orbitPoints)",
        orbitPointsParity,
        orbitPointsParity ? "Orbit path deterministic output verified." : "Orbit points mismatch."
      )
    );

    const branchA = mathApi.hyperbolicBranchPoints(
      { x: -0.5678143101438957, y: 0.2415277395028577, z: -0.7869251935517452 },
      { x: 0.5088777817497282, y: -0.5681616041774725, z: 0.6467115236177233 },
      0.05,
      550,
      48
    );
    const branchB = mathApi.hyperbolicBranchPoints(
      { x: -0.5678143101438957, y: 0.2415277395028577, z: -0.7869251935517452 },
      { x: 0.5088777817497282, y: -0.5681616041774725, z: 0.6467115236177233 },
      0.05,
      550,
      48
    );
    const branchMinRadius = branchA.reduce(
      (minRadius, point) => Math.min(minRadius, pointMagnitude(point)),
      Number.POSITIVE_INFINITY
    );
    const hyperbolaParity =
      branchA.length === branchB.length &&
      branchA.every(
        (point, index) =>
          approxEqual(point.x, branchB[index].x) &&
          approxEqual(point.y, branchB[index].y) &&
          approxEqual(point.z, branchB[index].z)
      ) &&
      approxEqual(pointMagnitude(branchA[0]), 550, 1e-6) &&
      approxEqual(pointMagnitude(branchA[branchA.length - 1]), 550, 1e-6) &&
      branchMinRadius <= 0.051;
    results.push(
      createResult(
        "Math Parity (hyperbolicBranchPoints)",
        hyperbolaParity,
        hyperbolaParity
          ? "Hyperbolic branch deterministic output verified."
          : "Hyperbolic branch points are unstable or miss the periapsis constraint."
      )
    );
  } catch (error) {
    results.push(createResult("Math Parity", false, `Math check failed: ${getErrorMessage(error)}`));
  }

  const appInstance = getAppInstance();
  const lifecycleOk =
    !!appInstance &&
    typeof appInstance.start === "function" &&
    typeof appInstance.stop === "function" &&
    typeof appInstance.resize === "function";
  results.push(
    createResult(
      "Runtime API",
      lifecycleOk,
      lifecycleOk ? "Runtime start/stop/resize methods exist." : "Missing runtime lifecycle methods."
    )
  );

  const namesToggleButton = document.getElementById("names-toggle");
  const orbitsToggleButton = document.getElementById("orbits-toggle");
  const lightRayToggleButtons = Array.from(
    document.querySelectorAll("#visibility-controls-root [data-visibility-key]")
  );
  const zoomToggleButton = document.getElementById("zoom-toggle");
  const expectedLightRayToggleCount = new Set(
    (sceneData?.directionalGuideLines || [])
      .map((guideLine) => guideLine.visibilityKey)
      .filter(Boolean)
  ).size;
  const uiButtonsPresent =
    !!namesToggleButton &&
    !!orbitsToggleButton &&
    lightRayToggleButtons.length === expectedLightRayToggleCount &&
    !!zoomToggleButton;
  results.push(
    createResult(
      "UI Controls Presence",
      uiButtonsPresent,
      uiButtonsPresent ? "HUD controls are present." : "One or more HUD controls missing."
    )
  );

  const labelsLayer = document.getElementById("labels-layer");
  results.push(
    createResult(
      "Labels Layer",
      !!labelsLayer,
      labelsLayer ? "Labels layer is present." : "Labels layer is missing."
    )
  );

  const trajectoryGuideLines = sceneData?.directionalGuideLines || [];
  const commonPathGuideLine =
    trajectoryGuideLines.find((guideLine) => guideLine.label === "common path") ?? null;
  const observerPathGuideLine =
    trajectoryGuideLines.find((guideLine) => guideLine.label === "observer path") ?? null;
  const transmitterPathGuideLine =
    trajectoryGuideLines.find((guideLine) => guideLine.label === "transmitter path") ?? null;
  const landerPathGuideLine =
    trajectoryGuideLines.find((guideLine) => guideLine.label === "lander path") ?? null;
  const trajectoryBranchColors = [
    commonPathGuideLine?.color,
    observerPathGuideLine?.color,
    transmitterPathGuideLine?.color,
    landerPathGuideLine?.color
  ].filter((color): color is string => typeof color === "string" && color.length > 0);
  const trajectorySegmentationOk =
    !!commonPathGuideLine &&
    !!observerPathGuideLine &&
    !!transmitterPathGuideLine &&
    !!landerPathGuideLine &&
    commonPathGuideLine.points.length > 1 &&
    observerPathGuideLine.points.length > 1 &&
    transmitterPathGuideLine.points.length > 1 &&
    landerPathGuideLine.points.length > 1 &&
    new Set(trajectoryBranchColors).size === 4 &&
    commonPathGuideLine.visibilityKey === observerPathGuideLine.visibilityKey &&
    commonPathGuideLine.visibilityKey === transmitterPathGuideLine.visibilityKey &&
    commonPathGuideLine.visibilityKey === landerPathGuideLine.visibilityKey;
  results.push(
    createResult(
      "Trajectory Segmentation",
      trajectorySegmentationOk,
      trajectorySegmentationOk
        ? "Common, observer, transmitter, and lander paths are present with shared visibility and unique colors."
        : "Trajectory paths are missing or do not use unique colors within the shared visibility grouping."
    )
  );

  const landerPathTail = landerPathGuideLine?.points.slice(-4) ?? [];
  const landerPathFlatTail =
    landerPathTail.length >= 2 &&
    landerPathTail.every(
      (point) => Math.abs(point.y - (landerPathTail[0]?.y ?? point.y)) <= 1e-9
    );
  const landerPathStartsOnTransmitter =
    !!landerPathGuideLine &&
    !!transmitterPathGuideLine &&
    transmitterPathGuideLine.points.some(
      (point) =>
        Math.hypot(
          point.x - (landerPathGuideLine.points[0]?.x ?? point.x),
          point.y - (landerPathGuideLine.points[0]?.y ?? point.y),
          point.z - (landerPathGuideLine.points[0]?.z ?? point.z)
        ) <= 1e-9
    );
  const landerPathOk =
    !!landerPathGuideLine &&
    landerPathGuideLine.points.length > 1 &&
    landerPathGuideLine.visibilityKey === transmitterPathGuideLine?.visibilityKey &&
    landerPathStartsOnTransmitter &&
    landerPathFlatTail;
  results.push(
    createResult(
      "Lander Trajectory Branch",
      landerPathOk,
      landerPathOk
        ? "Lander path starts on the transmitter path and finishes with an ecliptic-parallel approach."
        : "Lander path is missing, detached from the transmitter path, or does not flatten into the ecliptic approach."
    )
  );

  const summary = {
    total: results.length,
    passed: results.filter((item) => item.passed).length,
    failed: results.filter((item) => !item.passed).length
  };

  return {
    summary,
    results
  };
}
