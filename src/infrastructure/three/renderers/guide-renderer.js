(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("guide renderer bootstrap failed: missing three renderers namespace.");
  }

  const LIGHT_RAY_MIN_AXIS_LENGTH = 1e-6;
  const LIGHT_RAY_MIN_VISIBLE_RADIUS = 1e-8;
  const EDGE_FALLBACK_EPSILON = 1e-12;
  const LIGHT_RAY_RIM_SEGMENTS = 120;

  function hasDashPattern(pattern) {
    return Array.isArray(pattern) && pattern.length >= 2;
  }

  function createGuideMaterial(
    THREE,
    guideLine,
    {
      dashPattern = [],
      dashScale = 1,
      minDashSize = 4,
      solidOpacityFallback = 0.8,
      dashedOpacityFallback = 0.7,
      depthWrite
    } = {}
  ) {
    const isDashed = hasDashPattern(dashPattern);
    const opacityFallback = isDashed ? dashedOpacityFallback : solidOpacityFallback;
    const opacity = Math.max(0, Math.min(1, guideLine.opacity ?? opacityFallback));
    const materialOptions = {
      color: guideLine.color,
      transparent: true,
      opacity
    };
    if (guideLine.depthTest === false) {
      materialOptions.depthTest = false;
    }
    if (depthWrite !== undefined) {
      materialOptions.depthWrite = depthWrite;
    }

    if (isDashed) {
      materialOptions.dashSize = Math.max(minDashSize, dashPattern[0] * dashScale);
      materialOptions.gapSize = Math.max(minDashSize, dashPattern[1] * dashScale);
      return {
        isDashed,
        material: new THREE.LineDashedMaterial(materialOptions)
      };
    }

    return {
      isDashed,
      material: new THREE.LineBasicMaterial(materialOptions)
    };
  }

  function buildLightRayRadiusProfile(guideLine, pointCount) {
    const baseRadius = Math.max(guideLine.lightRayRadiusAu || 0, 0);
    const startRadius = Math.max(guideLine.lightRayStartRadiusAu ?? baseRadius, 0);
    const endRadius = Math.max(guideLine.lightRayEndRadiusAu ?? baseRadius, 0);
    const rawRadiusProfile = Array.isArray(guideLine.lightRayRadiusProfileAu)
      ? guideLine.lightRayRadiusProfileAu
      : null;
    const radiusProfile = new Array(pointCount);
    let maxRadius = 0;

    for (let index = 0; index < pointCount; index += 1) {
      const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
      const fallbackRadius = startRadius + (endRadius - startRadius) * t;
      const candidateRadius =
        rawRadiusProfile && Number.isFinite(rawRadiusProfile[index])
          ? rawRadiusProfile[index]
          : fallbackRadius;
      const safeRadius = Math.max(0, candidateRadius);
      radiusProfile[index] = safeRadius;
      maxRadius = Math.max(maxRadius, safeRadius);
    }

    return { radiusProfile, maxRadius };
  }

  function createLightRayBasis(THREE, axisDirection) {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const worldRight = new THREE.Vector3(1, 0, 0);
    const basisSeed = Math.abs(axisDirection.dot(worldUp)) > 0.98 ? worldRight : worldUp;
    const basisA = new THREE.Vector3().crossVectors(axisDirection, basisSeed).normalize();
    const basisB = new THREE.Vector3().crossVectors(axisDirection, basisA).normalize();

    return { basisA, basisB };
  }

  function createLightRayRim(THREE, center, radius, basisA, basisB, material, isDashed) {
    const rimPoints = [];
    const fullTurn = Math.PI * 2;

    for (let index = 0; index <= LIGHT_RAY_RIM_SEGMENTS; index += 1) {
      const angle = (index / LIGHT_RAY_RIM_SEGMENTS) * fullTurn;
      rimPoints.push(
        center
          .clone()
          .addScaledVector(basisA, Math.cos(angle) * radius)
          .addScaledVector(basisB, Math.sin(angle) * radius)
      );
    }

    const rim = new THREE.Line(
      new THREE.BufferGeometry().setFromPoints(rimPoints),
      material
    );
    if (isDashed) {
      rim.computeLineDistances();
    }
    rim.frustumCulled = false;
    return rim;
  }

  function createDynamicLine(THREE, pointCount, material) {
    const positions = new Float32Array(pointCount * 3);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;

    return { positions, geometry, line };
  }

  function resolveGuideLineLabelAnchorPoint(guideLine) {
    if (
      guideLine.labelAnchorPoint &&
      Number.isFinite(guideLine.labelAnchorPoint.x) &&
      Number.isFinite(guideLine.labelAnchorPoint.y) &&
      Number.isFinite(guideLine.labelAnchorPoint.z)
    ) {
      return guideLine.labelAnchorPoint;
    }

    if (!Array.isArray(guideLine.points) || guideLine.points.length < 2) {
      return null;
    }

    const start = guideLine.points[0];
    const end = guideLine.points[guideLine.points.length - 1];
    return {
      x: (start.x + end.x) * 0.5,
      y: (start.y + end.y) * 0.5,
      z: (start.z + end.z) * 0.5
    };
  }

  class GuideRenderer {
    constructor(options) {
      this.labelsLayer = options.labelsLayer;
    }

    createGuideLineLabelRuntime(THREE, guideLine) {
      const rawLabel = typeof guideLine.label === "string" ? guideLine.label.trim() : "";
      if (!rawLabel || !this.labelsLayer) {
        return null;
      }

      const anchorPoint = resolveGuideLineLabelAnchorPoint(guideLine);
      if (!anchorPoint) return null;

      const anchorObject = new THREE.Object3D();
      anchorObject.position.set(anchorPoint.x, anchorPoint.y, anchorPoint.z);

      return {
        mesh: anchorObject,
        labelElement: this.labelsLayer.createLabel(rawLabel, {
          objectType: "guide-line"
        }),
        renderRadius: 0,
        minPixelRadius: 0,
        requiresDirectionalGuides: true,
        labelAnchorPosition: anchorObject.position,
        labelAnchorRadius: 0,
        labelMarginPixels: Math.max(1, guideLine.labelMarginPixels || 8)
      };
    }

    createLightRay(guideLine, points) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createLightRay: missing THREE.");
      }

      const pointCount = points.length;
      if (pointCount < 2) return null;

      const start = points[0].clone();
      const end = points[pointCount - 1].clone();
      const axis = new THREE.Vector3().subVectors(end, start);
      const axisLength = axis.length();
      const { radiusProfile, maxRadius } = buildLightRayRadiusProfile(guideLine, pointCount);
      if (axisLength <= LIGHT_RAY_MIN_AXIS_LENGTH || maxRadius <= LIGHT_RAY_MIN_AXIS_LENGTH) {
        return null;
      }

      const axisDirection = axis.clone().multiplyScalar(1 / axisLength);
      const { basisA, basisB } = createLightRayBasis(THREE, axisDirection);
      const { material, isDashed } = createGuideMaterial(THREE, guideLine, {
        dashPattern: guideLine.lightRayDashPattern,
        solidOpacityFallback: 0.7,
        dashedOpacityFallback: 0.7,
        depthWrite: false
      });

      const lightRayGroup = new THREE.Group();

      const showStartRim = guideLine.showStartRim !== false;
      const showEndRim = guideLine.showEndRim !== false;
      const profileStartRadius = radiusProfile[0] || 0;
      const profileEndRadius = radiusProfile[pointCount - 1] || 0;
      if (showStartRim && profileStartRadius > LIGHT_RAY_MIN_VISIBLE_RADIUS) {
        const startRim = createLightRayRim(
          THREE,
          start,
          profileStartRadius,
          basisA,
          basisB,
          material,
          isDashed
        );
        lightRayGroup.add(startRim);
      }
      if (showEndRim && profileEndRadius > LIGHT_RAY_MIN_VISIBLE_RADIUS) {
        const endRim = createLightRayRim(
          THREE,
          end,
          profileEndRadius,
          basisA,
          basisB,
          material,
          isDashed
        );
        lightRayGroup.add(endRim);
      }

      const sideRuntimeA = createDynamicLine(THREE, pointCount, material);
      const sideRuntimeB = createDynamicLine(THREE, pointCount, material);
      lightRayGroup.add(sideRuntimeA.line);
      lightRayGroup.add(sideRuntimeB.line);

      const center = new THREE.Vector3();
      for (const point of points) {
        center.add(point);
      }
      center.multiplyScalar(1 / pointCount);

      const viewDirection = new THREE.Vector3();
      const viewDirectionPerpendicular = new THREE.Vector3();
      const edgeDirection = new THREE.Vector3();
      const edgeOffset = new THREE.Vector3();
      const sidePoint = new THREE.Vector3();

      function update(camera) {
        viewDirection.subVectors(camera.position, center);
        const viewAxisDot = viewDirection.dot(axisDirection);
        viewDirectionPerpendicular.copy(axisDirection).multiplyScalar(viewAxisDot);
        viewDirectionPerpendicular.subVectors(viewDirection, viewDirectionPerpendicular);

        if (viewDirectionPerpendicular.lengthSq() <= EDGE_FALLBACK_EPSILON) {
          edgeDirection.copy(basisA);
        } else {
          viewDirectionPerpendicular.normalize();
          edgeDirection.crossVectors(axisDirection, viewDirectionPerpendicular);
          if (edgeDirection.lengthSq() <= EDGE_FALLBACK_EPSILON) {
            edgeDirection.copy(basisA);
          } else {
            edgeDirection.normalize();
          }
        }

        for (let i = 0; i < pointCount; i += 1) {
          const radius = radiusProfile[i];
          const baseIndex = i * 3;
          const point = points[i];

          edgeOffset.copy(edgeDirection).multiplyScalar(radius);
          sidePoint.copy(point).add(edgeOffset);
          sideRuntimeA.positions[baseIndex] = sidePoint.x;
          sideRuntimeA.positions[baseIndex + 1] = sidePoint.y;
          sideRuntimeA.positions[baseIndex + 2] = sidePoint.z;

          sidePoint.copy(point).sub(edgeOffset);
          sideRuntimeB.positions[baseIndex] = sidePoint.x;
          sideRuntimeB.positions[baseIndex + 1] = sidePoint.y;
          sideRuntimeB.positions[baseIndex + 2] = sidePoint.z;
        }

        sideRuntimeA.geometry.attributes.position.needsUpdate = true;
        sideRuntimeB.geometry.attributes.position.needsUpdate = true;

        if (isDashed) {
          sideRuntimeA.line.computeLineDistances();
          sideRuntimeB.line.computeLineDistances();
        }
      }

      lightRayGroup.frustumCulled = false;
      return {
        object: lightRayGroup,
        update
      };
    }

    updateGuideLineVisuals(guideLineRuntimes, camera) {
      for (const runtime of guideLineRuntimes) {
        if (typeof runtime.update === "function") {
          runtime.update(camera);
        }
      }
    }

    buildGuideLines(
      sceneData,
      guideLineGroup,
      guideLineRuntimes,
      bodyRuntimes
    ) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("buildGuideLines: missing THREE.");
      }

      for (const guideLine of sceneData.directionalGuideLines) {
        const points = guideLine.points.map(
          (point) => new THREE.Vector3(point.x, point.y, point.z)
        );
        const isLightRay = guideLine.renderStyle === "lightRay";

        if (isLightRay) {
          const lightRayRuntime = this.createLightRay(guideLine, points);
          if (!lightRayRuntime) continue;
          guideLineGroup.add(lightRayRuntime.object);
          guideLineRuntimes.push({
            object: lightRayRuntime.object,
            update: lightRayRuntime.update
          });
          if (Array.isArray(bodyRuntimes)) {
            const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
            if (labelRuntime) {
              bodyRuntimes.push(labelRuntime);
            }
          }
          continue;
        }

        const geometry = new THREE.BufferGeometry().setFromPoints(points);
        const { material, isDashed } = createGuideMaterial(THREE, guideLine, {
          dashPattern: guideLine.dashPattern,
          dashScale: 6,
          solidOpacityFallback: 0.8,
          dashedOpacityFallback: 0.7
        });

        const line = new THREE.Line(geometry, material);
        if (isDashed) {
          line.computeLineDistances();
        }
        line.frustumCulled = false;

        guideLineGroup.add(line);
        guideLineRuntimes.push({ object: line });
        if (Array.isArray(bodyRuntimes)) {
          const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
          if (labelRuntime) {
            bodyRuntimes.push(labelRuntime);
          }
        }
      }
    }

    applyGuideLineVisibility(state, guideLineRuntimes) {
      for (const runtime of guideLineRuntimes) {
        runtime.object.visible = state.showDirectionalGuides;
      }
    }
  }

  namespace.infrastructure.three.renderers.GuideRenderer = GuideRenderer;
})();
