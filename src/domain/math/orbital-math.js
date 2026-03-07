(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.domain || !namespace.domain.math) {
    throw new Error("orbital-math bootstrap failed: missing domain math namespace.");
  }

  const EARTH_OBLIQUITY_DEG_J2000 = 23.4392911;
  const orbitPlaneScratch = { x: 0, z: 0 };

  class OrbitalMath {
    static degToRad(deg) {
      return (deg * Math.PI) / 180;
    }

    static clamp(value, min, max) {
      return Math.max(min, Math.min(max, value));
    }

    static normalizeAngleSigned(value) {
      const turn = Math.PI * 2;
      let result = value % turn;
      if (result <= -Math.PI) result += turn;
      if (result > Math.PI) result -= turn;
      return result;
    }

    static normalizeAngle(value) {
      const turn = Math.PI * 2;
      let result = value % turn;
      if (result < 0) result += turn;
      return result;
    }

    static normalizeVector(vector) {
      const length = Math.hypot(vector.x, vector.y, vector.z);
      if (length < 1e-9) return { x: 0, y: 0, z: 0 };
      const invLength = 1 / length;
      return {
        x: vector.x * invLength,
        y: vector.y * invLength,
        z: vector.z * invLength
      };
    }

    static randomUnitVector3D(random = Math.random) {
      const theta = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      return {
        x: radial * Math.cos(theta),
        y,
        z: radial * Math.sin(theta)
      };
    }

    static unitVectorFromEquatorialRaDec(raHours, decDeg) {
      const ra = OrbitalMath.degToRad(raHours * 15);
      const dec = OrbitalMath.degToRad(decDeg);
      const cosDec = Math.cos(dec);
      return {
        x: cosDec * Math.cos(ra),
        y: cosDec * Math.sin(ra),
        z: Math.sin(dec)
      };
    }

    static equatorialToEcliptic(
      vector,
      obliquityDeg = EARTH_OBLIQUITY_DEG_J2000
    ) {
      const epsilon = OrbitalMath.degToRad(obliquityDeg);
      const cosEpsilon = Math.cos(epsilon);
      const sinEpsilon = Math.sin(epsilon);
      return {
        x: vector.x,
        y: vector.y * cosEpsilon + vector.z * sinEpsilon,
        z: -vector.y * sinEpsilon + vector.z * cosEpsilon
      };
    }

    static pointOnRadiusAlongDirection(directionSource, radius) {
      const direction = OrbitalMath.normalizeVector(directionSource);
      return {
        x: direction.x * radius,
        y: direction.y * radius,
        z: direction.z * radius
      };
    }

    static solveEccentricAnomaly(meanAnomaly, eccentricity) {
      const e = OrbitalMath.clamp(eccentricity, 0, 0.999);
      if (e < 1e-6) return meanAnomaly;

      const normalizedMeanAnomaly = OrbitalMath.normalizeAngleSigned(meanAnomaly);
      let eccentricAnomaly =
        e < 0.8
          ? normalizedMeanAnomaly
          : normalizedMeanAnomaly +
            0.85 * e * Math.sign(Math.sin(normalizedMeanAnomaly) || 1);

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

    static orbitPlanePointInto(
      out,
      semiMajorAxis,
      angle,
      eccentricity = 0,
      angleIsEccentricAnomaly = false
    ) {
      const e = OrbitalMath.clamp(eccentricity, 0, 0.999);
      if (e < 1e-6) {
        out.x = Math.cos(angle) * semiMajorAxis;
        out.z = Math.sin(angle) * semiMajorAxis;
        return out;
      }

      const eccentricAnomaly = angleIsEccentricAnomaly
        ? angle
        : OrbitalMath.solveEccentricAnomaly(angle, e);
      out.x = semiMajorAxis * (Math.cos(eccentricAnomaly) - e);
      out.z = semiMajorAxis * Math.sqrt(1 - e * e) * Math.sin(eccentricAnomaly);
      return out;
    }

    static rotateOrbitFrame(x, z, inclination, node, periapsisArg, height = 0) {
      return OrbitalMath.rotateOrbitFrameInto(
        { x: 0, y: 0, z: 0 },
        x,
        z,
        inclination,
        node,
        periapsisArg,
        height
      );
    }

    static rotateOrbitFrameInto(
      out,
      x,
      z,
      inclination,
      node,
      periapsisArg,
      height = 0
    ) {
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

    static orbitalPositionInto(
      out,
      semiMajorAxis,
      theta,
      inclination,
      node,
      height = 0,
      eccentricity = 0,
      periapsisArg = 0
    ) {
      OrbitalMath.orbitPlanePointInto(
        orbitPlaneScratch,
        semiMajorAxis,
        theta,
        eccentricity,
        false
      );
      return OrbitalMath.rotateOrbitFrameInto(
        out,
        orbitPlaneScratch.x,
        orbitPlaneScratch.z,
        inclination,
        node,
        periapsisArg,
        height
      );
    }

    static orbitPoints(
      semiMajorAxis,
      inclination,
      node,
      segments,
      eccentricity = 0,
      periapsisArg = 0
    ) {
      const points = [];
      for (let i = 0; i <= segments; i += 1) {
        const eccentricAnomaly = (i / segments) * Math.PI * 2;
        const point = OrbitalMath.orbitPlanePointInto(
          orbitPlaneScratch,
          semiMajorAxis,
          eccentricAnomaly,
          eccentricity,
          true
        );
        points.push(
          OrbitalMath.rotateOrbitFrame(
            point.x,
            point.z,
            inclination,
            node,
            periapsisArg
          )
        );
      }
      return points;
    }
  }

  namespace.domain.math.OrbitalMath = OrbitalMath;
})();
