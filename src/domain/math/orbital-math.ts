import type { MathApi, OrbitPlanePoint, Point3 } from "../../types/solar-system";

const EARTH_OBLIQUITY_DEG_J2000 = 23.4392911;
const orbitPlaneScratch: OrbitPlanePoint = { x: 0, z: 0 };

export class OrbitalMath {
    static degToRad(deg: number): number {
      return (deg * Math.PI) / 180;
    }

    static clamp(value: number, min: number, max: number): number {
      return Math.max(min, Math.min(max, value));
    }

    static normalizeAngleSigned(value: number): number {
      const turn = Math.PI * 2;
      let result = value % turn;
      if (result <= -Math.PI) result += turn;
      if (result > Math.PI) result -= turn;
      return result;
    }

    static normalizeAngle(value: number): number {
      const turn = Math.PI * 2;
      let result = value % turn;
      if (result < 0) result += turn;
      return result;
    }

    static normalizeVector(vector: Point3): Point3 {
      const length = Math.hypot(vector.x, vector.y, vector.z);
      if (length < 1e-9) return { x: 0, y: 0, z: 0 };
      const invLength = 1 / length;
      return {
        x: vector.x * invLength,
        y: vector.y * invLength,
        z: vector.z * invLength
      };
    }

    static vectorMagnitude(vector: Point3): number {
      return Math.hypot(vector.x, vector.y, vector.z);
    }

    static scaleVector(vector: Point3, scalar: number): Point3 {
      return {
        x: vector.x * scalar,
        y: vector.y * scalar,
        z: vector.z * scalar
      };
    }

    static addVectors(a: Point3, b: Point3): Point3 {
      return {
        x: a.x + b.x,
        y: a.y + b.y,
        z: a.z + b.z
      };
    }

    static dotProduct(a: Point3, b: Point3): number {
      return a.x * b.x + a.y * b.y + a.z * b.z;
    }

    static crossProduct(a: Point3, b: Point3): Point3 {
      return {
        x: a.y * b.z - a.z * b.y,
        y: a.z * b.x - a.x * b.z,
        z: a.x * b.y - a.y * b.x
      };
    }

    static orthogonalUnitVector(vector: Point3): Point3 {
      const normalizedVector = OrbitalMath.normalizeVector(vector);
      const axisSeed =
        Math.abs(normalizedVector.x) <= Math.abs(normalizedVector.y) &&
        Math.abs(normalizedVector.x) <= Math.abs(normalizedVector.z)
          ? { x: 1, y: 0, z: 0 }
          : Math.abs(normalizedVector.y) <= Math.abs(normalizedVector.z)
            ? { x: 0, y: 1, z: 0 }
            : { x: 0, y: 0, z: 1 };
      return OrbitalMath.normalizeVector(
        OrbitalMath.crossProduct(normalizedVector, axisSeed)
      );
    }

    static randomUnitVector3D(random: () => number = Math.random): Point3 {
      const theta = random() * Math.PI * 2;
      const y = random() * 2 - 1;
      const radial = Math.sqrt(Math.max(0, 1 - y * y));
      return {
        x: radial * Math.cos(theta),
        y,
        z: radial * Math.sin(theta)
      };
    }

    static unitVectorFromEquatorialRaDec(raHours: number, decDeg: number): Point3 {
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
      vector: Point3,
      obliquityDeg = EARTH_OBLIQUITY_DEG_J2000
    ): Point3 {
      const epsilon = OrbitalMath.degToRad(obliquityDeg);
      const cosEpsilon = Math.cos(epsilon);
      const sinEpsilon = Math.sin(epsilon);
      return {
        x: vector.x,
        y: vector.y * cosEpsilon + vector.z * sinEpsilon,
        z: -vector.y * sinEpsilon + vector.z * cosEpsilon
      };
    }

    static pointOnRadiusAlongDirection(directionSource: Point3, radius: number): Point3 {
      const direction = OrbitalMath.normalizeVector(directionSource);
      return {
        x: direction.x * radius,
        y: direction.y * radius,
        z: direction.z * radius
      };
    }

    static hyperbolicBranchPoints(
      startDirection: Point3,
      endDirection: Point3,
      periapsisDistance: number,
      endpointDistance: number,
      segments: number,
      preferredPeriapsisDirection?: Point3
    ): Point3[] {
      const startUnit = OrbitalMath.normalizeVector(startDirection);
      const endUnit = OrbitalMath.normalizeVector(endDirection);
      const safePeriapsisDistance = Math.max(
        1e-6,
        Number.isFinite(periapsisDistance) ? periapsisDistance : 0
      );
      const safeEndpointDistance = Math.max(
        safePeriapsisDistance + 1e-6,
        Number.isFinite(endpointDistance) ? endpointDistance : 0
      );
      const segmentCount = Math.max(2, Math.floor(Number.isFinite(segments) ? segments : 0));
      const startPoint = OrbitalMath.pointOnRadiusAlongDirection(startUnit, safeEndpointDistance);
      const endPoint = OrbitalMath.pointOnRadiusAlongDirection(endUnit, safeEndpointDistance);

      if (
        OrbitalMath.vectorMagnitude(startUnit) < 1e-9 ||
        OrbitalMath.vectorMagnitude(endUnit) < 1e-9
      ) {
        return [startPoint, endPoint];
      }

      let planeNormal = OrbitalMath.crossProduct(startUnit, endUnit);
      if (OrbitalMath.vectorMagnitude(planeNormal) < 1e-9) {
        planeNormal = OrbitalMath.orthogonalUnitVector(startUnit);
      } else {
        planeNormal = OrbitalMath.normalizeVector(planeNormal);
      }

      const radiusRatio = safeEndpointDistance / safePeriapsisDistance;
      const summedDirections = OrbitalMath.addVectors(startUnit, endUnit);
      const candidatePeriapsisDirections: Point3[] = [];
      const normalizedPreferredPeriapsisDirection =
        preferredPeriapsisDirection &&
        OrbitalMath.vectorMagnitude(preferredPeriapsisDirection) >= 1e-9
          ? OrbitalMath.normalizeVector(preferredPeriapsisDirection)
          : null;

      if (normalizedPreferredPeriapsisDirection) {
        candidatePeriapsisDirections.push(normalizedPreferredPeriapsisDirection);
        candidatePeriapsisDirections.push(
          OrbitalMath.scaleVector(normalizedPreferredPeriapsisDirection, -1)
        );
      }

      if (OrbitalMath.vectorMagnitude(summedDirections) >= 1e-9) {
        const bisectorDirection = OrbitalMath.normalizeVector(summedDirections);
        candidatePeriapsisDirections.push(bisectorDirection);
        candidatePeriapsisDirections.push(OrbitalMath.scaleVector(bisectorDirection, -1));
      } else {
        const perpendicularDirection = OrbitalMath.normalizeVector(
          OrbitalMath.crossProduct(planeNormal, startUnit)
        );
        candidatePeriapsisDirections.push(perpendicularDirection);
        candidatePeriapsisDirections.push(
          OrbitalMath.scaleVector(perpendicularDirection, -1)
        );
      }

      const evaluateCandidate = (periapsisDirection: Point3) => {
        const startProjection = OrbitalMath.dotProduct(startUnit, periapsisDirection);
        const endProjection = OrbitalMath.dotProduct(endUnit, periapsisDirection);
        const symmetryError = Math.abs(startProjection - endProjection);
        const cosTrueAnomaly = OrbitalMath.clamp(
          (startProjection + endProjection) * 0.5,
          -0.999999,
          0.999999
        );
        const denominator = 1 - radiusRatio * cosTrueAnomaly;
        if (denominator <= 1e-9) {
          return null;
        }

        const eccentricity = (radiusRatio - 1) / denominator;
        if (!(eccentricity > 1 + 1e-6) || !Number.isFinite(eccentricity)) {
          return null;
        }

        let transverseDirection = OrbitalMath.normalizeVector(
          OrbitalMath.crossProduct(planeNormal, periapsisDirection)
        );
        if (OrbitalMath.vectorMagnitude(transverseDirection) < 1e-9) {
          transverseDirection = OrbitalMath.orthogonalUnitVector(periapsisDirection);
        }

        let startTrueAnomaly = Math.atan2(
          OrbitalMath.dotProduct(startUnit, transverseDirection),
          OrbitalMath.dotProduct(startUnit, periapsisDirection)
        );
        let endTrueAnomaly = Math.atan2(
          OrbitalMath.dotProduct(endUnit, transverseDirection),
          OrbitalMath.dotProduct(endUnit, periapsisDirection)
        );

        if (startTrueAnomaly > endTrueAnomaly) {
          transverseDirection = OrbitalMath.scaleVector(transverseDirection, -1);
          startTrueAnomaly = -startTrueAnomaly;
          endTrueAnomaly = -endTrueAnomaly;
        }

        if (!(startTrueAnomaly < 0 && endTrueAnomaly > 0)) {
          return null;
        }

        return {
          eccentricity,
          endTrueAnomaly,
          periapsisDirection,
          startTrueAnomaly,
          symmetryError,
          transverseDirection
        };
      };

      let selectedCandidate: {
        eccentricity: number;
        endTrueAnomaly: number;
        periapsisDirection: Point3;
        startTrueAnomaly: number;
        symmetryError: number;
        transverseDirection: Point3;
      } | null = null;
      for (const periapsisDirection of candidatePeriapsisDirections) {
        const candidate = evaluateCandidate(periapsisDirection);
        if (!candidate) {
          continue;
        }

        if (
          !selectedCandidate ||
          candidate.symmetryError < selectedCandidate.symmetryError
        ) {
          selectedCandidate = candidate;
        }
      }

      if (!selectedCandidate) {
        return [startPoint, endPoint];
      }

      const semiLatusRectum =
        safePeriapsisDistance * (1 + selectedCandidate.eccentricity);
      const branchPoints = [];

      for (let index = 0; index <= segmentCount; index += 1) {
        const t = segmentCount <= 0 ? 0 : index / segmentCount;
        const trueAnomaly =
          selectedCandidate.startTrueAnomaly +
          (selectedCandidate.endTrueAnomaly - selectedCandidate.startTrueAnomaly) * t;
        const denominator = Math.max(
          1e-6,
          1 + selectedCandidate.eccentricity * Math.cos(trueAnomaly)
        );
        const radius = semiLatusRectum / denominator;
        const cosTrueAnomaly = Math.cos(trueAnomaly);
        const sinTrueAnomaly = Math.sin(trueAnomaly);
        const direction = {
          x:
            selectedCandidate.periapsisDirection.x * cosTrueAnomaly +
            selectedCandidate.transverseDirection.x * sinTrueAnomaly,
          y:
            selectedCandidate.periapsisDirection.y * cosTrueAnomaly +
            selectedCandidate.transverseDirection.y * sinTrueAnomaly,
          z:
            selectedCandidate.periapsisDirection.z * cosTrueAnomaly +
            selectedCandidate.transverseDirection.z * sinTrueAnomaly
        };

        branchPoints.push(OrbitalMath.scaleVector(direction, radius));
      }

      branchPoints[0] = startPoint;
      branchPoints[branchPoints.length - 1] = endPoint;
      return branchPoints;
    }

    static solveEccentricAnomaly(meanAnomaly: number, eccentricity: number): number {
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
      out: OrbitPlanePoint,
      semiMajorAxis: number,
      angle: number,
      eccentricity = 0,
      angleIsEccentricAnomaly = false
    ): OrbitPlanePoint {
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

    static rotateOrbitFrame(
      x: number,
      z: number,
      inclination: number,
      node: number,
      periapsisArg: number,
      height = 0
    ): Point3 {
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
      out: Point3,
      x: number,
      z: number,
      inclination: number,
      node: number,
      periapsisArg: number,
      height = 0
    ): Point3 {
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
      out: Point3,
      semiMajorAxis: number,
      theta: number,
      inclination: number,
      node: number,
      height = 0,
      eccentricity = 0,
      periapsisArg = 0
    ): Point3 {
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
      semiMajorAxis: number,
      inclination: number,
      node: number,
      segments: number,
      eccentricity = 0,
      periapsisArg = 0
    ): Point3[] {
      const points: Point3[] = [];
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

const mathContract: MathApi = OrbitalMath;
