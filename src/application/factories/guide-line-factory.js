(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.factories) {
    throw new Error("guide-line factory bootstrap failed: missing application factories namespace.");
  }

  class GuideLineFactory {
    constructor(options) {
      this.constants = options.constants;
      this.math = options.math;
      this.markerCatalog = options.markerCatalog;

      this.maxMatryoshkaFocalOffsetAu =
        this.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.reduce(
          (maxOffsetAu, layerDefinition) =>
            Math.max(maxOffsetAu, layerDefinition.focalOffsetAu ?? 0),
          0
        );
      this.directionalGuidePostFocalEndDistanceAu =
        this.constants.SOLAR_GRAVITATIONAL_LENS_AU +
        this.maxMatryoshkaFocalOffsetAu +
        this.markerCatalog.DIRECTIONAL_GUIDE_POST_FOCAL_BASE_EXTENSION_AU;
      this.spacecraftTrajectoryStopDistanceAu = 2500;
      this.spacecraftTrajectorySolarAssistApproachDistanceAu =
        this.constants.HELIOPAUSE_AU * 0.9;
      this.spacecraftTrajectorySolarAssistDepartureDistanceAu =
        this.constants.HELIOPAUSE_AU * 1.2;
      this.spacecraftTrajectorySolarAssistPerihelionAu = Math.max(
        (this.constants.SUN_RADIUS_KM / this.constants.KM_PER_AU) * 80,
        0.35
      );
    }

    clonePoint(point) {
      return {
        x: point.x,
        y: point.y,
        z: point.z
      };
    }

    offsetPointAlongDirection(point, direction, distance) {
      return {
        x: point.x + direction.x * distance,
        y: point.y + direction.y * distance,
        z: point.z + direction.z * distance
      };
    }

    cubicBezierPoint(pointA, controlA, controlB, pointB, t) {
      const u = 1 - t;
      const uu = u * u;
      const tt = t * t;
      const uuu = uu * u;
      const ttt = tt * t;
      return {
        x:
          pointA.x * uuu +
          3 * controlA.x * uu * t +
          3 * controlB.x * u * tt +
          pointB.x * ttt,
        y:
          pointA.y * uuu +
          3 * controlA.y * uu * t +
          3 * controlB.y * u * tt +
          pointB.y * ttt,
        z:
          pointA.z * uuu +
          3 * controlA.z * uu * t +
          3 * controlB.z * u * tt +
          pointB.z * ttt
      };
    }

    createCubicBezierPolyline(pointA, controlA, controlB, pointB, segmentCount) {
      const safeSegments = Math.max(2, Math.floor(segmentCount || 0));
      const points = [];
      for (let index = 0; index <= safeSegments; index += 1) {
        const t = index / safeSegments;
        points.push(this.cubicBezierPoint(pointA, controlA, controlB, pointB, t));
      }
      return points;
    }

    createLinearPolyline(pointA, pointB, segmentCount) {
      const safeSegments = Math.max(1, Math.floor(segmentCount || 0));
      const points = [];
      for (let index = 0; index <= safeSegments; index += 1) {
        const t = index / safeSegments;
        points.push({
          x: pointA.x + (pointB.x - pointA.x) * t,
          y: pointA.y + (pointB.y - pointA.y) * t,
          z: pointA.z + (pointB.z - pointA.z) * t
        });
      }
      return points;
    }

    vectorLength(vector) {
      return Math.hypot(vector.x, vector.y, vector.z);
    }

    distanceBetweenPoints(pointA, pointB) {
      return Math.hypot(pointB.x - pointA.x, pointB.y - pointA.y, pointB.z - pointA.z);
    }

    crossVectors(vectorA, vectorB) {
      return {
        x: vectorA.y * vectorB.z - vectorA.z * vectorB.y,
        y: vectorA.z * vectorB.x - vectorA.x * vectorB.z,
        z: vectorA.x * vectorB.y - vectorA.y * vectorB.x
      };
    }

    dotVectors(vectorA, vectorB) {
      return vectorA.x * vectorB.x + vectorA.y * vectorB.y + vectorA.z * vectorB.z;
    }

    resolveSpacecraftTrajectoryTurnNormal(entryDirection, exitDirection) {
      let turnNormal = this.crossVectors(entryDirection, exitDirection);
      if (this.vectorLength(turnNormal) <= 1e-6) {
        const fallbackAxis =
          Math.abs(entryDirection.z) < 0.92
            ? { x: 0, y: 0, z: 1 }
            : { x: 0, y: 1, z: 0 };
        turnNormal = this.crossVectors(entryDirection, fallbackAxis);
      }
      return this.math.normalizeVector(turnNormal);
    }

    buildSpacecraftSolarAssistPoints(
      focalLinePoint,
      exitPoint,
      focalAxisInwardDirection,
      exitDirection
    ) {
      const entryDirection = this.math.normalizeVector(focalLinePoint);
      const turnNormal = this.resolveSpacecraftTrajectoryTurnNormal(
        entryDirection,
        exitDirection
      );
      const perihelionBlendVector = {
        x: entryDirection.x + exitDirection.x,
        y: entryDirection.y + exitDirection.y,
        z: entryDirection.z + exitDirection.z
      };
      let perihelionDirection =
        this.vectorLength(perihelionBlendVector) > 1e-6
          ? this.math.normalizeVector(perihelionBlendVector)
          : this.math.normalizeVector(this.crossVectors(turnNormal, entryDirection));
      if (this.vectorLength(perihelionDirection) <= 1e-6) {
        perihelionDirection = entryDirection;
      }

      const perihelionTangentVector = {
        x: exitDirection.x - entryDirection.x,
        y: exitDirection.y - entryDirection.y,
        z: exitDirection.z - entryDirection.z
      };
      let perihelionTangentDirection =
        this.vectorLength(perihelionTangentVector) > 1e-6
          ? this.math.normalizeVector(perihelionTangentVector)
          : this.math.normalizeVector(this.crossVectors(turnNormal, perihelionDirection));
      if (this.dotVectors(perihelionTangentDirection, exitDirection) < 0) {
        perihelionTangentDirection = {
          x: -perihelionTangentDirection.x,
          y: -perihelionTangentDirection.y,
          z: -perihelionTangentDirection.z
        };
      }

      const solarAssistApproachPoint = this.math.pointOnRadiusAlongDirection(
        focalLinePoint,
        this.spacecraftTrajectorySolarAssistApproachDistanceAu
      );
      const solarAssistDeparturePoint = this.math.pointOnRadiusAlongDirection(
        exitDirection,
        this.spacecraftTrajectorySolarAssistDepartureDistanceAu
      );
      const perihelionPoint = this.math.pointOnRadiusAlongDirection(
        perihelionDirection,
        this.spacecraftTrajectorySolarAssistPerihelionAu
      );

      const approachToPerihelionDistanceAu = this.distanceBetweenPoints(
        solarAssistApproachPoint,
        perihelionPoint
      );
      const perihelionToDepartureDistanceAu = this.distanceBetweenPoints(
        perihelionPoint,
        solarAssistDeparturePoint
      );
      const solarAssistApproachHandleAu = approachToPerihelionDistanceAu * 0.55;
      const perihelionHandleAu =
        Math.min(approachToPerihelionDistanceAu, perihelionToDepartureDistanceAu) * 0.42;
      const solarAssistDepartureHandleAu = perihelionToDepartureDistanceAu * 0.52;

      const solarApproachRunPoints = this.createLinearPolyline(
        focalLinePoint,
        solarAssistApproachPoint,
        22
      );
      const solarAssistEntryPoints = this.createCubicBezierPolyline(
        solarAssistApproachPoint,
        this.offsetPointAlongDirection(
          solarAssistApproachPoint,
          focalAxisInwardDirection,
          solarAssistApproachHandleAu
        ),
        this.offsetPointAlongDirection(
          perihelionPoint,
          perihelionTangentDirection,
          -perihelionHandleAu
        ),
        perihelionPoint,
        48
      );
      const solarAssistExitPoints = this.createCubicBezierPolyline(
        perihelionPoint,
        this.offsetPointAlongDirection(
          perihelionPoint,
          perihelionTangentDirection,
          perihelionHandleAu
        ),
        this.offsetPointAlongDirection(
          solarAssistDeparturePoint,
          exitDirection,
          -solarAssistDepartureHandleAu
        ),
        solarAssistDeparturePoint,
        52
      );
      const outboundCruisePoints = this.createLinearPolyline(
        solarAssistDeparturePoint,
        exitPoint,
        32
      );

      return [
        ...solarApproachRunPoints,
        ...solarAssistEntryPoints.slice(1),
        ...solarAssistExitPoints.slice(1),
        ...outboundCruisePoints.slice(1)
      ];
    }

    resolveGuideLinePoints(marker, options) {
      const fallbackStartPoint =
        options.startPoint ||
        this.math.pointOnRadiusAlongDirection(
          marker,
          -this.constants.SOLAR_GRAVITATIONAL_LENS_AU
        );
      const fallbackEndPoint = options.endPoint || {
        x: marker.x,
        y: marker.y,
        z: marker.z
      };

      if (Array.isArray(options.points) && options.points.length >= 2) {
        return options.points.map((point) => this.clonePoint(point));
      }

      return [fallbackStartPoint, fallbackEndPoint];
    }

    buildLightRayRadiusProfile(
      points,
      options,
      fallbackStartRadiusAu,
      fallbackEndRadiusAu
    ) {
      const rawRadiusProfile =
        Array.isArray(options.lightRayRadiusProfileAu) &&
        options.lightRayRadiusProfileAu.length === points.length
          ? options.lightRayRadiusProfileAu
          : null;

      const lightRayRadiusProfileAu = points.map((_, index) => {
        const t = points.length <= 1 ? 0 : index / (points.length - 1);
        const fallbackRadius =
          fallbackStartRadiusAu + (fallbackEndRadiusAu - fallbackStartRadiusAu) * t;
        const radius = rawRadiusProfile?.[index] ?? fallbackRadius;
        return Math.max(0, Number.isFinite(radius) ? radius : 0);
      });

      return {
        lightRayRadiusProfileAu,
        lightRayStartRadiusAu: lightRayRadiusProfileAu[0] || 0,
        lightRayEndRadiusAu:
          lightRayRadiusProfileAu[lightRayRadiusProfileAu.length - 1] || 0
      };
    }

    directionalGuideLineFromMarker(marker, color, options = {}) {
      if (!marker) return null;

      const lightRayRadiusAu = options.lightRayRadiusAu ?? 0;
      const fallbackStartRadiusAu =
        options.lightRayStartRadiusAu ?? lightRayRadiusAu;
      const fallbackEndRadiusAu = options.lightRayEndRadiusAu ?? lightRayRadiusAu;
      const points = this.resolveGuideLinePoints(marker, options);
      const {
        lightRayRadiusProfileAu,
        lightRayStartRadiusAu,
        lightRayEndRadiusAu
      } = this.buildLightRayRadiusProfile(
        points,
        options,
        fallbackStartRadiusAu,
        fallbackEndRadiusAu
      );

      return {
        points,
        color,
        renderStyle: options.renderStyle || "line",
        visibilityKey: options.visibilityKey || "lightRays",
        opacity: options.opacity ?? 0.96,
        showStartRim: options.showStartRim ?? true,
        showEndRim: options.showEndRim ?? true,
        lightRayRadiusAu,
        lightRayStartRadiusAu,
        lightRayEndRadiusAu,
        lightRayRadiusProfileAu,
        lightRayDashPattern: options.lightRayDashPattern || [],
        dashPattern: options.dashPattern || [],
        depthTest: options.depthTest,
        label: options.label || "",
        labelAnchorPoint: options.labelAnchorPoint
          ? this.clonePoint(options.labelAnchorPoint)
          : null,
        labelMarginPixels: options.labelMarginPixels
      };
    }

    createMatryoshkaConeLayer(sourceMarker, layerDefinition) {
      const focalDistanceAu =
        this.constants.SOLAR_GRAVITATIONAL_LENS_AU +
        (layerDefinition.focalOffsetAu ?? 0);
      const incomingTransitionPoint = { x: 0, y: 0, z: 0 };
      const focalPoint = this.math.pointOnRadiusAlongDirection(
        sourceMarker,
        -focalDistanceAu
      );
      const endDistanceAu = this.directionalGuidePostFocalEndDistanceAu;
      const endPoint = this.math.pointOnRadiusAlongDirection(sourceMarker, -endDistanceAu);
      const coneMaxWidthAu =
        this.markerCatalog.DIRECTIONAL_CONE_MAX_WIDTH_AU * layerDefinition.maxWidthScale;
      const incomingRadiusAu = coneMaxWidthAu * 0.5;
      const focalRadiusAu =
        this.markerCatalog.DIRECTIONAL_CONE_TIP_RADIUS_AU * layerDefinition.tipRadiusScale;
      const incomingTransitionDistanceAu = Math.hypot(
        incomingTransitionPoint.x,
        incomingTransitionPoint.y,
        incomingTransitionPoint.z
      );
      const convergenceSpanAu = incomingTransitionDistanceAu + focalDistanceAu;
      const divergenceSpanAu = endDistanceAu - focalDistanceAu;
      const prePinchRadiusDeltaAu = Math.max(0, incomingRadiusAu - focalRadiusAu);
      const divergenceSlope =
        prePinchRadiusDeltaAu / Math.max(convergenceSpanAu, 1e-6);
      const outgoingRadiusAu = focalRadiusAu + divergenceSpanAu * divergenceSlope;
      return [
        this.directionalGuideLineFromMarker(
          sourceMarker,
          this.markerCatalog.DIRECTIONAL_SOURCE_CONE_COLOR,
          {
            points: [sourceMarker, incomingTransitionPoint, focalPoint, endPoint],
            renderStyle: "lightRay",
            opacity: layerDefinition.alpha ?? 0.55,
            lightRayRadiusProfileAu: [
              incomingRadiusAu,
              incomingRadiusAu,
              focalRadiusAu,
              outgoingRadiusAu
            ],
            lightRayDashPattern: this.markerCatalog.DIRECTIONAL_SOURCE_CONE_DASH_PATTERN
          }
        )
      ].filter(Boolean);
    }

    createMatryoshkaFocalLineHighlight(sourceMarker) {
      if (!sourceMarker) return null;

      const focalDistancesAu = this.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS.map(
        (layerDefinition) =>
          this.constants.SOLAR_GRAVITATIONAL_LENS_AU +
          (layerDefinition.focalOffsetAu ?? 0)
      )
        .filter((distanceAu) => Number.isFinite(distanceAu))
        .sort((a, b) => a - b);
      if (focalDistancesAu.length < 2) return null;

      const firstPinchDistanceAu = focalDistancesAu[0];
      const lastPinchDistanceAu = focalDistancesAu[focalDistancesAu.length - 1];
      if (lastPinchDistanceAu <= firstPinchDistanceAu + 1e-6) return null;

      const firstPinchPoint = this.math.pointOnRadiusAlongDirection(
        sourceMarker,
        -firstPinchDistanceAu
      );
      const lastPinchPoint = this.math.pointOnRadiusAlongDirection(
        sourceMarker,
        -lastPinchDistanceAu
      );
      const highlightRadiusAu = Math.max(
        this.markerCatalog.DIRECTIONAL_CONE_TIP_RADIUS_AU * 320,
        this.markerCatalog.DIRECTIONAL_CONE_MAX_WIDTH_AU * 0.012
      );
      const midPinchDistanceAu = (firstPinchDistanceAu + lastPinchDistanceAu) * 0.5;
      const labelAnchorPoint = this.math.pointOnRadiusAlongDirection(
        sourceMarker,
        -midPinchDistanceAu
      );

      return this.directionalGuideLineFromMarker(sourceMarker, "#ffe7a2", {
        points: [firstPinchPoint, lastPinchPoint],
        renderStyle: "lightRay",
        opacity: 0.92,
        lightRayStartRadiusAu: highlightRadiusAu,
        lightRayEndRadiusAu: highlightRadiusAu,
        showStartRim: false,
        showEndRim: false,
        depthTest: false,
        label: "focal line",
        labelAnchorPoint,
        labelMarginPixels: 12
      });
    }

    createMatryoshkaSourceGuideShape(sourceMarker) {
      if (!sourceMarker) return [];

      const guideLines = [];

      for (const layerDefinition of this.markerCatalog.MATRYOSHKA_CONE_LAYER_DEFINITIONS) {
        guideLines.push(...this.createMatryoshkaConeLayer(sourceMarker, layerDefinition));
      }

      const focalLineHighlight = this.createMatryoshkaFocalLineHighlight(sourceMarker);
      if (focalLineHighlight) {
        guideLines.push(focalLineHighlight);
      }

      return guideLines;
    }

    createMatryoshkaSourceGuideShapes(sourceMarkers) {
      if (!Array.isArray(sourceMarkers) || sourceMarkers.length === 0) {
        return [];
      }

      const guideLines = [];
      for (const sourceMarker of sourceMarkers) {
        guideLines.push(...this.createMatryoshkaSourceGuideShape(sourceMarker));
      }

      return guideLines;
    }

    createSpacecraftTrajectoryGuideLine(sourceMarker, oppositeSideReferenceMarker) {
      if (!sourceMarker || !oppositeSideReferenceMarker) return null;

      const focalLineOuterPoint = this.math.pointOnRadiusAlongDirection(
        oppositeSideReferenceMarker,
        -this.spacecraftTrajectoryStopDistanceAu
      );
      const focalLinePoint = this.math.pointOnRadiusAlongDirection(
        oppositeSideReferenceMarker,
        -this.constants.SOLAR_GRAVITATIONAL_LENS_AU
      );
      const focalAxisOutwardDirection = this.math.normalizeVector({
        x: -oppositeSideReferenceMarker.x,
        y: -oppositeSideReferenceMarker.y,
        z: -oppositeSideReferenceMarker.z
      });
      const focalAxisInwardDirection = {
        x: -focalAxisOutwardDirection.x,
        y: -focalAxisOutwardDirection.y,
        z: -focalAxisOutwardDirection.z
      };

      const sourceToFocalOuterVector = {
        x: focalLineOuterPoint.x - sourceMarker.x,
        y: focalLineOuterPoint.y - sourceMarker.y,
        z: focalLineOuterPoint.z - sourceMarker.z
      };
      const sourceToFocalOuterDistanceAu = Math.hypot(
        sourceToFocalOuterVector.x,
        sourceToFocalOuterVector.y,
        sourceToFocalOuterVector.z
      );
      if (sourceToFocalOuterDistanceAu <= 1e-6) return null;

      const sourceApproachDirection = this.math.normalizeVector(sourceToFocalOuterVector);
      const firstTurnStartHandleAu = sourceToFocalOuterDistanceAu * 0.72;
      const firstTurnEndHandleAu = sourceToFocalOuterDistanceAu * 0.26;
      const firstTurnControlA = this.offsetPointAlongDirection(
        sourceMarker,
        sourceApproachDirection,
        firstTurnStartHandleAu
      );
      const firstTurnControlB = this.offsetPointAlongDirection(
        focalLineOuterPoint,
        focalAxisOutwardDirection,
        firstTurnEndHandleAu
      );
      const turnIntoFocalLinePoints = this.createCubicBezierPolyline(
        sourceMarker,
        firstTurnControlA,
        firstTurnControlB,
        focalLineOuterPoint,
        54
      );
      const focalRunPoints = this.createLinearPolyline(
        focalLineOuterPoint,
        focalLinePoint,
        26
      );

      const exitPoint = this.math.pointOnRadiusAlongDirection(
        sourceMarker,
        -this.spacecraftTrajectoryStopDistanceAu
      );
      const exitDirection = this.math.normalizeVector({
        x: -sourceMarker.x,
        y: -sourceMarker.y,
        z: -sourceMarker.z
      });
      const solarAssistPoints = this.buildSpacecraftSolarAssistPoints(
        focalLinePoint,
        exitPoint,
        focalAxisInwardDirection,
        exitDirection
      );
      if (solarAssistPoints.length < 2) return null;

      const trajectoryPoints = [
        ...turnIntoFocalLinePoints,
        ...focalRunPoints.slice(1),
        ...solarAssistPoints.slice(1)
      ];

      return this.directionalGuideLineFromMarker(sourceMarker, "#63ff8a", {
        points: trajectoryPoints,
        visibilityKey: "spacecraftTrajectory",
        opacity: 0.96,
        dashPattern: [10, 6],
        depthTest: false
      });
    }
  }

  namespace.application.factories.GuideLineFactory = GuideLineFactory;
})();
