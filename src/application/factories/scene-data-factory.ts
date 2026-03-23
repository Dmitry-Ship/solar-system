import { buildDirectionalGuideLines } from "./guide-line-factory";
import type { BeltCatalog } from "../../domain/catalogs/belt-catalog";
import type { CometCatalog } from "../../domain/catalogs/comet-catalog";
import type { DwarfPlanetCatalog } from "../../domain/catalogs/dwarf-planet-catalog";
import type { MarkerCatalog } from "../../domain/catalogs/marker-catalog";
import type { PlanetCatalog } from "../../domain/catalogs/planet-catalog";
import type { SceneBodyCatalog } from "../../domain/catalogs/scene-body-catalog";
import type {
  AsteroidBelt,
  AsteroidBeltConfig,
  DirectionalMarkerDefinition,
  DirectionalMarker,
  DriftingBody,
  DriftingBodyDefinition,
  MathApi,
  OrbitRenderGroupConfig,
  OrbitRenderGroupKey,
  OrbitingBody,
  OrbitingBodyDefinition,
  Point3,
  SceneData,
  SimulationConstants,
  StarField,
  VoyagerDefinition,
  VoyagerSceneBody
} from "../../types/solar-system";

const DEFAULT_ORBIT_COLOR = "#b0bdc1";
const INITIAL_OPPOSITION_THETA_SAMPLE_COUNT = 1440;

interface SceneDataFactoryOptions {
  constants: SimulationConstants;
  math: MathApi;
  random?: () => number;
  planetCatalog: PlanetCatalog;
  dwarfPlanetCatalog: DwarfPlanetCatalog;
  cometCatalog: CometCatalog;
  markerCatalog: MarkerCatalog;
  beltCatalog: BeltCatalog;
  sceneBodyCatalog: SceneBodyCatalog;
}

export class SceneDataFactory {
  private readonly constants: SimulationConstants;
  private readonly math: MathApi;
  private readonly random: () => number;
  private readonly planetCatalog: PlanetCatalog;
  private readonly dwarfPlanetCatalog: DwarfPlanetCatalog;
  private readonly cometCatalog: CometCatalog;
  private readonly markerCatalog: MarkerCatalog;
  private readonly beltCatalog: BeltCatalog;
  private readonly sceneBodyCatalog: SceneBodyCatalog;

  constructor(options: SceneDataFactoryOptions) {
    this.constants = options.constants;
    this.math = options.math;
    this.random = options.random ?? Math.random;
    this.planetCatalog = options.planetCatalog;
    this.dwarfPlanetCatalog = options.dwarfPlanetCatalog;
    this.cometCatalog = options.cometCatalog;
    this.markerCatalog = options.markerCatalog;
    this.beltCatalog = options.beltCatalog;
    this.sceneBodyCatalog = options.sceneBodyCatalog;
  }

  createOrbitingBody(bodyDefinition: OrbitingBodyDefinition): OrbitingBody {
    const theta = Number.isFinite(bodyDefinition.initialThetaDeg)
      ? this.math.degToRad(bodyDefinition.initialThetaDeg ?? 0)
      : this.random() * Math.PI * 2;
    return {
      ...bodyDefinition,
      theta,
      inclination: this.math.degToRad(bodyDefinition.inclinationDeg || 0),
      node: this.math.degToRad(bodyDefinition.nodeDeg || 0),
      periapsisArg: this.math.degToRad(bodyDefinition.periapsisArgDeg || 0),
      eccentricity: this.math.clamp(bodyDefinition.eccentricity || 0, 0, 0.999),
      orbitRadius: bodyDefinition.au,
      renderRadius: bodyDefinition.radiusKm / this.constants.KM_PER_AU,
      orbitColor: bodyDefinition.orbitColor ?? DEFAULT_ORBIT_COLOR,
      orbitOpacity: 0.4,
      orbitPath: []
    };
  }

  createOrbitingBodies(definitions: OrbitingBodyDefinition[]): OrbitingBody[] {
    return definitions.map((definition) => this.createOrbitingBody(definition));
  }

  normalizeLookupName(name: string): string {
    return typeof name === "string" ? name.trim().toLowerCase() : "";
  }

  pointMagnitude(point: Point3): number {
    return Math.hypot(point.x, point.y, point.z);
  }

  normalizePoint(point: Point3): Point3 {
    const magnitude = this.pointMagnitude(point);
    if (magnitude <= 1e-9) {
      return { x: 0, y: 0, z: 0 };
    }

    return {
      x: point.x / magnitude,
      y: point.y / magnitude,
      z: point.z / magnitude
    };
  }

  dotPoint(a: Point3, b: Point3): number {
    return a.x * b.x + a.y * b.y + a.z * b.z;
  }

  findDirectionalMarkerByName(
    directionalMarkers: DirectionalMarker[],
    markerName: string
  ): DirectionalMarker | null {
    const normalizedMarkerName = this.normalizeLookupName(markerName);
    if (!normalizedMarkerName) {
      return null;
    }

    return (
      directionalMarkers.find(
        (directionalMarker) =>
          this.normalizeLookupName(directionalMarker.name) === normalizedMarkerName
      ) ?? null
    );
  }

  resolveOrbitThetaOppositeMarker(
    orbitingBody: OrbitingBody,
    targetMarker: DirectionalMarker
  ): number {
    const markerDirection = this.normalizePoint(targetMarker);
    const orbitalPosition = { x: 0, y: 0, z: 0 };
    let bestTheta = orbitingBody.theta;
    let bestDot = Number.POSITIVE_INFINITY;

    for (let step = 0; step < INITIAL_OPPOSITION_THETA_SAMPLE_COUNT; step += 1) {
      const theta = (step / INITIAL_OPPOSITION_THETA_SAMPLE_COUNT) * Math.PI * 2;
      this.math.orbitalPositionInto(
        orbitalPosition,
        orbitingBody.orbitRadius,
        theta,
        orbitingBody.inclination,
        orbitingBody.node,
        0,
        orbitingBody.eccentricity,
        orbitingBody.periapsisArg
      );

      const positionDirection = this.normalizePoint(orbitalPosition);
      const oppositionDot = this.dotPoint(positionDirection, markerDirection);
      if (oppositionDot < bestDot) {
        bestDot = oppositionDot;
        bestTheta = theta;
      }
    }

    return bestTheta;
  }

  applyDirectionalMarkerPhaseConstraints(
    orbitingBodies: OrbitingBody[],
    directionalMarkers: DirectionalMarker[]
  ): void {
    for (const orbitingBody of orbitingBodies) {
      const markerName = orbitingBody.initialOppositionMarkerName;
      if (typeof markerName !== "string" || !markerName.trim()) {
        continue;
      }

      const targetMarker = this.findDirectionalMarkerByName(directionalMarkers, markerName);
      if (!targetMarker) {
        continue;
      }

      orbitingBody.theta = this.resolveOrbitThetaOppositeMarker(orbitingBody, targetMarker);
    }
  }

  markerOnSphereFromRaDec(
    name: string,
    sphereRadiusAu: number,
    raHours: number,
    decDeg: number,
    color: string,
    minPixelRadius = 2.3,
    label = name
  ): DirectionalMarker {
    const equatorial = this.math.unitVectorFromEquatorialRaDec(raHours, decDeg);
    const eclipticDirection = this.math.normalizeVector(
      this.math.equatorialToEcliptic(equatorial)
    );
    return {
      name,
      label,
      color,
      minPixelRadius,
      x: eclipticDirection.x * sphereRadiusAu,
      y: eclipticDirection.y * sphereRadiusAu,
      z: eclipticDirection.z * sphereRadiusAu
    };
  }

  resolveDirectionalMarkerDistanceScaleAuPerLightYear(
    definitions: DirectionalMarkerDefinition[]
  ): number {
    let minimumDistanceLightYears = Number.POSITIVE_INFINITY;

    for (const definition of definitions) {
      const distanceLightYears = definition.distanceLightYears ?? Number.NaN;
      if (Number.isFinite(distanceLightYears) && distanceLightYears > 0) {
        minimumDistanceLightYears = Math.min(minimumDistanceLightYears, distanceLightYears);
      }
    }

    if (!Number.isFinite(minimumDistanceLightYears)) {
      return 0;
    }

    return this.beltCatalog.STAR_DISTANCE_MIN_AU / minimumDistanceLightYears;
  }

  resolveDirectionalMarkerDistanceAu(
    definition: DirectionalMarkerDefinition,
    distanceScaleAuPerLightYear: number,
    fallbackDistanceAu: number
  ): number {
    const distanceLightYears = definition.distanceLightYears ?? Number.NaN;
    if (
      Number.isFinite(distanceLightYears) &&
      distanceLightYears > 0 &&
      Number.isFinite(distanceScaleAuPerLightYear) &&
      distanceScaleAuPerLightYear > 0
    ) {
      return distanceLightYears * distanceScaleAuPerLightYear;
    }

    return fallbackDistanceAu;
  }

  createDriftingBodies(definitions: DriftingBodyDefinition[]): Array<DriftingBodyDefinition & Point3> {
    return definitions.map((bodyDefinition) => {
      if (bodyDefinition.position) {
        return {
          ...bodyDefinition,
          x: bodyDefinition.position.x,
          y: bodyDefinition.position.y,
          z: bodyDefinition.position.z
        };
      }

      const direction = this.math.randomUnitVector3D(this.random);
      const startAu = bodyDefinition.startAu ?? 0;
      return {
        ...bodyDefinition,
        x: direction.x * startAu,
        y: direction.y * startAu,
        z: direction.z * startAu
      };
    });
  }

  createVoyagerSceneBodies(definitions: VoyagerDefinition[]): VoyagerSceneBody[] {
    return definitions.map((voyagerDefinition) => ({
      ...voyagerDefinition,
      position: { ...voyagerDefinition.position },
      renderRadius: voyagerDefinition.radiusKm / this.constants.KM_PER_AU
    }));
  }

  createLocalTrajectoryTargets(orbitingBodies: OrbitingBody[]): Array<Point3 & { name: string }> {
    return orbitingBodies.map((orbitingBody) => {
      const position = this.math.orbitalPositionInto(
        { x: 0, y: 0, z: 0 },
        orbitingBody.orbitRadius,
        orbitingBody.theta,
        orbitingBody.inclination,
        orbitingBody.node,
        0,
        orbitingBody.eccentricity,
        orbitingBody.periapsisArg
      );

      return {
        name: orbitingBody.name,
        x: position.x,
        y: position.y,
        z: position.z
      };
    });
  }

  createRenderableDriftingBodies(definitions: DriftingBodyDefinition[]): DriftingBody[] {
    return this.createDriftingBodies(definitions).map((driftingBody) => ({
      ...driftingBody,
      renderRadius: driftingBody.radiusKm / this.constants.KM_PER_AU
    }));
  }

  createAsteroidBelt(beltConfig: AsteroidBeltConfig): AsteroidBelt {
    const particleCount = beltConfig.count;
    const positions = new Float32Array(particleCount * 3);
    const maxInclinationRad = this.math.degToRad(beltConfig.maxInclinationDeg);
    const orbitalPositionScratch: Point3 = { x: 0, y: 0, z: 0 };

    for (let index = 0; index < particleCount; index += 1) {
      const au = beltConfig.innerAu + this.random() * (beltConfig.outerAu - beltConfig.innerAu);
      const particleEccentricity =
        beltConfig.eccentricityMin +
        this.random() * (beltConfig.eccentricityMax - beltConfig.eccentricityMin);
      const particleInclination = maxInclinationRad * Math.pow(this.random(), 1.8);
      const particleTheta = this.random() * Math.PI * 2;
      const particleNode = this.random() * Math.PI * 2;
      const particlePeriapsisArg = this.random() * Math.PI * 2;
      const positionOffset = index * 3;

      this.math.orbitalPositionInto(
        orbitalPositionScratch,
        au,
        particleTheta,
        particleInclination,
        particleNode,
        0,
        particleEccentricity,
        particlePeriapsisArg
      );

      positions[positionOffset] = orbitalPositionScratch.x;
      positions[positionOffset + 1] = orbitalPositionScratch.y;
      positions[positionOffset + 2] = orbitalPositionScratch.z;
    }

    return {
      ...beltConfig,
      particleCount,
      positions
    };
  }

  createStars(count: number): StarField {
    const positions = new Float32Array(count * 3);

    for (let index = 0; index < count; index += 1) {
      const distance =
        this.beltCatalog.STAR_DISTANCE_MIN_AU +
        this.random() *
          (this.beltCatalog.STAR_DISTANCE_MAX_AU - this.beltCatalog.STAR_DISTANCE_MIN_AU);
      const theta = this.random() * Math.PI * 2;
      const phi = Math.acos(2 * this.random() - 1);
      const positionOffset = index * 3;
      positions[positionOffset] = distance * Math.sin(phi) * Math.cos(theta);
      positions[positionOffset + 1] = distance * Math.cos(phi);
      positions[positionOffset + 2] = distance * Math.sin(phi) * Math.sin(theta);
    }

    return {
      count,
      positions
    };
  }

  createOrbitOpacityCalculator(orbitingBodies: OrbitingBody[]): (radiusKm: number) => number {
    if (!orbitingBodies.length) {
      return () => 0.4;
    }

    let minOrbitBodyRadiusKm = Infinity;
    let maxOrbitBodyRadiusKm = 0;
    for (const orbitingBody of orbitingBodies) {
      const safeRadius = Math.max(1, orbitingBody.radiusKm || 1);
      minOrbitBodyRadiusKm = Math.min(minOrbitBodyRadiusKm, safeRadius);
      maxOrbitBodyRadiusKm = Math.max(maxOrbitBodyRadiusKm, safeRadius);
    }

    const minLog = Math.log(minOrbitBodyRadiusKm);
    const maxLog = Math.log(maxOrbitBodyRadiusKm);
    const logSpan = maxLog - minLog;

    return (radiusKm: number) => {
      const minOpacity = 0.1;
      const maxOpacity = 0.4;
      const safeRadius = Math.max(1, radiusKm || 1);
      if (logSpan < 1e-9) return maxOpacity;

      const t = this.math.clamp((Math.log(safeRadius) - minLog) / logSpan, 0, 1);
      return minOpacity + (maxOpacity - minOpacity) * t;
    };
  }

  applyOrbitRenderMetadata(
    orbitingBodies: OrbitingBody[],
    orbitRenderGroupConfig: OrbitRenderGroupConfig,
    orbitOpacityForBodyRadius: (radiusKm: number) => number
  ): void {
    const shouldUseRadiusOrbitOpacity = orbitRenderGroupConfig.key !== "comets";
    const orbitColor = orbitRenderGroupConfig.orbitColor || DEFAULT_ORBIT_COLOR;

    for (const orbitingBody of orbitingBodies) {
      orbitingBody.orbitRadius = orbitingBody.au;
      orbitingBody.renderRadius = orbitingBody.radiusKm / this.constants.KM_PER_AU;
      orbitingBody.orbitColor = orbitColor;
      orbitingBody.orbitOpacity = shouldUseRadiusOrbitOpacity
        ? orbitOpacityForBodyRadius(orbitingBody.radiusKm)
        : 0.1;
      orbitingBody.orbitPath = this.math.orbitPoints(
        orbitingBody.orbitRadius,
        orbitingBody.inclination,
        orbitingBody.node,
        orbitRenderGroupConfig.segments,
        orbitingBody.eccentricity,
        orbitingBody.periapsisArg
      );
    }
  }

  createSceneData(): SceneData {
    const fallbackDirectionalMarkerDistanceAu =
      (this.beltCatalog.STAR_DISTANCE_MIN_AU + this.beltCatalog.STAR_DISTANCE_MAX_AU) * 0.5;
    const directionalMarkerDistanceScaleAuPerLightYear =
      this.resolveDirectionalMarkerDistanceScaleAuPerLightYear(
        this.markerCatalog.DIRECTIONAL_MARKER_DEFINITIONS
      );
    const directionalMarkers = this.markerCatalog.DIRECTIONAL_MARKER_DEFINITIONS.map(
      (definition) =>
        this.markerOnSphereFromRaDec(
          definition.name,
          this.resolveDirectionalMarkerDistanceAu(
            definition,
            directionalMarkerDistanceScaleAuPerLightYear,
            fallbackDirectionalMarkerDistanceAu
          ),
          definition.raHours,
          definition.decDeg,
          definition.color,
          definition.minPixelRadius,
          definition.label
        )
    );
    const planets = this.createOrbitingBodies(this.planetCatalog.PLANET_DEFINITIONS);
    const dwarfPlanets = this.createOrbitingBodies(
      this.dwarfPlanetCatalog.DWARF_PLANET_DEFINITIONS
    );
    const comets = this.createOrbitingBodies(this.cometCatalog.COMET_DEFINITIONS);
    this.applyDirectionalMarkerPhaseConstraints(planets, directionalMarkers);
    this.applyDirectionalMarkerPhaseConstraints(dwarfPlanets, directionalMarkers);
    this.applyDirectionalMarkerPhaseConstraints(comets, directionalMarkers);

    const orbitOpacityBodies = [...planets, ...dwarfPlanets];
    const orbitOpacityForBodyRadius = this.createOrbitOpacityCalculator(orbitOpacityBodies);
    const orbitingBodiesByGroupKey: Record<OrbitRenderGroupKey, OrbitingBody[]> = {
      planets,
      dwarfPlanets,
      comets
    };
    const orbitRenderGroupConfigs = this.beltCatalog.ORBIT_RENDER_GROUPS;

    for (const orbitRenderGroupConfig of orbitRenderGroupConfigs) {
      this.applyOrbitRenderMetadata(
        orbitingBodiesByGroupKey[orbitRenderGroupConfig.key],
        orbitRenderGroupConfig,
        orbitOpacityForBodyRadius
      );
    }

    const localTrajectoryTargets = this.createLocalTrajectoryTargets(planets);
    const directionalGuideLines = buildDirectionalGuideLines(directionalMarkers, {
      constants: this.constants,
      math: this.math,
      markerCatalog: this.markerCatalog,
      localTrajectoryTargets
    });

    return {
      planets,
      dwarfPlanets,
      comets,
      orbitRenderGroupConfigs,
      orbitRenderGroups: orbitRenderGroupConfigs,
      voyagers: this.createVoyagerSceneBodies(this.sceneBodyCatalog.VOYAGERS),
      driftingBodies: this.createRenderableDriftingBodies(
        this.sceneBodyCatalog.DRIFTING_BODIES
      ),
      directionalMarkers,
      directionalGuideLines,
      asteroidBelts: this.beltCatalog.ASTEROID_BELT_CONFIGS.map((beltConfig) =>
        this.createAsteroidBelt(beltConfig)
      ),
      stars: this.createStars(1700)
    };
  }
}
