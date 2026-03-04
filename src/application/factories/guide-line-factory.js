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
      const focalToExitVector = {
        x: exitPoint.x - focalLinePoint.x,
        y: exitPoint.y - focalLinePoint.y,
        z: exitPoint.z - focalLinePoint.z
      };
      const focalToExitDistanceAu = Math.hypot(
        focalToExitVector.x,
        focalToExitVector.y,
        focalToExitVector.z
      );
      if (focalToExitDistanceAu <= 1e-6) return null;

      const exitDirection = this.math.normalizeVector({
        x: -sourceMarker.x,
        y: -sourceMarker.y,
        z: -sourceMarker.z
      });
      const secondTurnStartHandleAu = Math.max(
        this.constants.SOLAR_GRAVITATIONAL_LENS_AU * 0.38,
        focalToExitDistanceAu * 0.28
      );
      const secondTurnEndHandleAu = Math.max(
        this.constants.HELIOPAUSE_AU * 1.1,
        focalToExitDistanceAu * 0.2
      );
      const secondTurnControlA = this.offsetPointAlongDirection(
        focalLinePoint,
        focalAxisInwardDirection,
        secondTurnStartHandleAu
      );
      const secondTurnControlB = this.offsetPointAlongDirection(
        exitPoint,
        exitDirection,
        -secondTurnEndHandleAu
      );
      const turnOutPoints = this.createCubicBezierPolyline(
        focalLinePoint,
        secondTurnControlA,
        secondTurnControlB,
        exitPoint,
        56
      );
      const trajectoryPoints = [
        ...turnIntoFocalLinePoints,
        ...focalRunPoints.slice(1),
        ...turnOutPoints.slice(1)
      ];

      return this.directionalGuideLineFromMarker(sourceMarker, "#63ff8a", {
        points: trajectoryPoints,
        opacity: 0.96,
        dashPattern: [10, 6],
        depthTest: false
      });
    }
  }

  namespace.application.factories.GuideLineFactory = GuideLineFactory;
})();
