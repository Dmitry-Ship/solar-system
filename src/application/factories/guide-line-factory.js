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
    }

    clonePoint(point) {
      return {
        x: point.x,
        y: point.y,
        z: point.z
      };
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
  }

  namespace.application.factories.GuideLineFactory = GuideLineFactory;
})();
