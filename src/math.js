(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const { constants } = namespace;
  const orbitPlaneScratch = { x: 0, z: 0 };

  function degToRad(deg) {
    return (deg * Math.PI) / 180;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function normalizeAngleSigned(value) {
    const turn = Math.PI * 2;
    let result = value % turn;
    if (result <= -Math.PI) result += turn;
    if (result > Math.PI) result -= turn;
    return result;
  }

  function normalizeVector(vector) {
    const length = Math.hypot(vector.x, vector.y, vector.z);
    if (length < 1e-9) return { x: 0, y: 0, z: 0 };
    const invLength = 1 / length;
    return {
      x: vector.x * invLength,
      y: vector.y * invLength,
      z: vector.z * invLength
    };
  }

  function randomUnitVector3D() {
    const theta = Math.random() * Math.PI * 2;
    const y = Math.random() * 2 - 1;
    const radial = Math.sqrt(Math.max(0, 1 - y * y));
    return {
      x: radial * Math.cos(theta),
      y,
      z: radial * Math.sin(theta)
    };
  }

  function unitVectorFromEquatorialRaDec(raHours, decDeg) {
    const ra = degToRad(raHours * 15);
    const dec = degToRad(decDeg);
    const cosDec = Math.cos(dec);
    return {
      x: cosDec * Math.cos(ra),
      y: cosDec * Math.sin(ra),
      z: Math.sin(dec)
    };
  }

  function equatorialToEcliptic(
    vector,
    obliquityDeg = constants.EARTH_OBLIQUITY_DEG_J2000
  ) {
    const epsilon = degToRad(obliquityDeg);
    const cosEpsilon = Math.cos(epsilon);
    const sinEpsilon = Math.sin(epsilon);
    return {
      x: vector.x,
      y: vector.y * cosEpsilon + vector.z * sinEpsilon,
      z: -vector.y * sinEpsilon + vector.z * cosEpsilon
    };
  }

  function pointOnRadiusAlongDirection(directionSource, radius) {
    const direction = normalizeVector(directionSource);
    return {
      x: direction.x * radius,
      y: direction.y * radius,
      z: direction.z * radius
    };
  }

  // Solve Kepler's equation (M = E - e * sin(E)) with Newton-Raphson iteration.
  function solveEccentricAnomaly(meanAnomaly, eccentricity) {
    const e = clamp(eccentricity, 0, 0.999);
    if (e < 1e-6) return meanAnomaly;

    const normalizedMeanAnomaly = normalizeAngleSigned(meanAnomaly);
    let eccentricAnomaly =
      e < 0.8
        ? normalizedMeanAnomaly
        : normalizedMeanAnomaly +
          0.85 * e * Math.sign(Math.sin(normalizedMeanAnomaly) || 1);

    // Higher iteration cap keeps convergence stable for very eccentric comet orbits.
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

  function orbitPlanePointInto(
    out,
    semiMajorAxis,
    angle,
    eccentricity = 0,
    angleIsEccentricAnomaly = false
  ) {
    const e = clamp(eccentricity, 0, 0.999);
    if (e < 1e-6) {
      out.x = Math.cos(angle) * semiMajorAxis;
      out.z = Math.sin(angle) * semiMajorAxis;
      return out;
    }

    const eccentricAnomaly = angleIsEccentricAnomaly
      ? angle
      : solveEccentricAnomaly(angle, e);
    out.x = semiMajorAxis * (Math.cos(eccentricAnomaly) - e);
    out.z = semiMajorAxis * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
    return out;
  }

  function rotateOrbitFrame(
    x,
    z,
    inclination,
    node,
    periapsisArg,
    height = 0
  ) {
    return rotateOrbitFrameInto(
      { x: 0, y: 0, z: 0 },
      x,
      z,
      inclination,
      node,
      periapsisArg,
      height
    );
  }

  function rotateOrbitFrameInto(
    out,
    x,
    z,
    inclination,
    node,
    periapsisArg,
    height = 0
  ) {
    // Apply periapsis rotation -> inclination tilt -> ascending-node rotation.
    const cosW = Math.cos(periapsisArg);
    const sinW = Math.sin(periapsisArg);
    const xw = x * cosW - z * sinW;
    const zw = x * sinW + z * cosW;

    const cosI = Math.cos(inclination);
    const sinI = Math.sin(inclination);
    const y1 = height * cosI - zw * sinI;
    const z1 = height * sinI + zw * cosI;

    const cosN = Math.cos(node);
    const sinN = Math.sin(node);
    out.x = xw * cosN - z1 * sinN;
    out.y = y1;
    out.z = xw * sinN + z1 * cosN;
    return out;
  }

  function orbitalPositionInto(
    out,
    semiMajorAxis,
    theta,
    inclination,
    node,
    height = 0,
    eccentricity = 0,
    periapsisArg = 0
  ) {
    orbitPlanePointInto(orbitPlaneScratch, semiMajorAxis, theta, eccentricity, false);
    return rotateOrbitFrameInto(
      out,
      orbitPlaneScratch.x,
      orbitPlaneScratch.z,
      inclination,
      node,
      periapsisArg,
      height
    );
  }

  function orbitPoints(
    semiMajorAxis,
    inclination,
    node,
    segments,
    eccentricity = 0,
    periapsisArg = 0
  ) {
    const points = [];
    // Sample by eccentric anomaly to keep ellipse geometry consistent.
    for (let i = 0; i <= segments; i += 1) {
      const eccentricAnomaly = (i / segments) * Math.PI * 2;
      const point = orbitPlanePointInto(
        orbitPlaneScratch,
        semiMajorAxis,
        eccentricAnomaly,
        eccentricity,
        true
      );
      points.push(
        rotateOrbitFrame(point.x, point.z, inclination, node, periapsisArg)
      );
    }
    return points;
  }

  namespace.math = {
    clamp,
    degToRad,
    equatorialToEcliptic,
    normalizeVector,
    orbitPlanePointInto,
    orbitPoints,
    orbitalPositionInto,
    pointOnRadiusAlongDirection,
    randomUnitVector3D,
    rotateOrbitFrame,
    rotateOrbitFrameInto,
    solveEccentricAnomaly,
    unitVectorFromEquatorialRaDec
  };
})();
