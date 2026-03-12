import { namespace } from "../core/namespace";
import { OrbitalMath } from "../domain/math/orbital-math";

export const math = Object.freeze({
  clamp: OrbitalMath.clamp,
  degToRad: OrbitalMath.degToRad,
  equatorialToEcliptic: OrbitalMath.equatorialToEcliptic,
  hyperbolicBranchPoints: OrbitalMath.hyperbolicBranchPoints,
  normalizeAngle: OrbitalMath.normalizeAngle,
  normalizeVector: OrbitalMath.normalizeVector,
  orbitPlanePointInto: OrbitalMath.orbitPlanePointInto,
  orbitPoints: OrbitalMath.orbitPoints,
  orbitalPositionInto: OrbitalMath.orbitalPositionInto,
  pointOnRadiusAlongDirection: OrbitalMath.pointOnRadiusAlongDirection,
  randomUnitVector3D: OrbitalMath.randomUnitVector3D,
  rotateOrbitFrame: OrbitalMath.rotateOrbitFrame,
  rotateOrbitFrameInto: OrbitalMath.rotateOrbitFrameInto,
  solveEccentricAnomaly: OrbitalMath.solveEccentricAnomaly,
  unitVectorFromEquatorialRaDec: OrbitalMath.unitVectorFromEquatorialRaDec
});

namespace.math = math;
