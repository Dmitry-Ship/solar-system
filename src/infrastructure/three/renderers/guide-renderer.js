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
  const LIGHT_RAY_OPACITY_FALLOFF_POWER = 1.35;
  const LIGHT_RAY_END_OPACITY_FACTOR = 0.22;

  function hasDashPattern(pattern) {
    return Array.isArray(pattern) && pattern.length >= 2;
  }

  function clampOpacity(opacity, fallback = 1) {
    return Math.max(0, Math.min(1, Number.isFinite(opacity) ? opacity : fallback));
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

  function buildLightRayOpacityProfile(guideLine, pointCount, opacityFallback = 0.7) {
    const startOpacity = clampOpacity(guideLine.opacity, opacityFallback);
    const endOpacityFactor = clampOpacity(
      guideLine.lightRayEndOpacityFactor,
      LIGHT_RAY_END_OPACITY_FACTOR
    );
    const rawOpacityProfile =
      Array.isArray(guideLine.lightRayOpacityProfile) &&
      guideLine.lightRayOpacityProfile.length === pointCount
        ? guideLine.lightRayOpacityProfile
        : null;
    const opacityProfile = new Array(pointCount);

    for (let index = 0; index < pointCount; index += 1) {
      const t = pointCount <= 1 ? 0 : index / (pointCount - 1);
      const easedFade = Math.pow(1 - t, LIGHT_RAY_OPACITY_FALLOFF_POWER);
      const fallbackOpacity =
        startOpacity * (endOpacityFactor + (1 - endOpacityFactor) * easedFade);
      opacityProfile[index] = clampOpacity(rawOpacityProfile?.[index], fallbackOpacity);
    }

    return opacityProfile;
  }

  function createLightRayBasis(THREE, axisDirection) {
    const worldUp = new THREE.Vector3(0, 1, 0);
    const worldRight = new THREE.Vector3(1, 0, 0);
    const basisSeed = Math.abs(axisDirection.dot(worldUp)) > 0.98 ? worldRight : worldUp;
    const basisA = new THREE.Vector3().crossVectors(axisDirection, basisSeed).normalize();
    const basisB = new THREE.Vector3().crossVectors(axisDirection, basisA).normalize();

    return { basisA, basisB };
  }

  function createLightRayMaterial(
    THREE,
    guideLine,
    {
      dashPattern = [],
      dashScale = 1,
      minDashSize = 4,
      depthWrite
    } = {}
  ) {
    const isDashed = hasDashPattern(dashPattern);
    const dashSize = isDashed ? Math.max(minDashSize, dashPattern[0] * dashScale) : 0;
    const gapSize = isDashed ? Math.max(minDashSize, dashPattern[1] * dashScale) : 0;
    const material = new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: depthWrite ?? false,
      depthTest: guideLine.depthTest !== false,
      uniforms: {
        diffuse: { value: new THREE.Color(guideLine.color) },
        dashEnabled: { value: isDashed ? 1 : 0 },
        dashSize: { value: dashSize },
        gapSize: { value: gapSize }
      },
      vertexShader: `
        attribute float lineDistance;
        attribute float vertexOpacity;
        varying float vLineDistance;
        varying float vVertexOpacity;

        void main() {
          vLineDistance = lineDistance;
          vVertexOpacity = vertexOpacity;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        uniform vec3 diffuse;
        uniform float dashEnabled;
        uniform float dashSize;
        uniform float gapSize;
        varying float vLineDistance;
        varying float vVertexOpacity;

        void main() {
          if (dashEnabled > 0.5) {
            float dashCycle = dashSize + gapSize;
            if (dashCycle > 0.0 && mod(vLineDistance, dashCycle) > dashSize) {
              discard;
            }
          }

          float alpha = vVertexOpacity;
          if (alpha <= 0.0) {
            discard;
          }

          gl_FragColor = vec4(diffuse, alpha);
        }
      `
    });

    return { isDashed, material };
  }

  function updateLineDistances(lineRuntime) {
    const { positions, lineDistances, pointCount, geometry } = lineRuntime;
    let cumulativeDistance = 0;
    lineDistances[0] = 0;

    for (let index = 1; index < pointCount; index += 1) {
      const currentOffset = index * 3;
      const previousOffset = currentOffset - 3;
      const deltaX = positions[currentOffset] - positions[previousOffset];
      const deltaY = positions[currentOffset + 1] - positions[previousOffset + 1];
      const deltaZ = positions[currentOffset + 2] - positions[previousOffset + 2];
      cumulativeDistance += Math.hypot(deltaX, deltaY, deltaZ);
      lineDistances[index] = cumulativeDistance;
    }

    geometry.attributes.lineDistance.needsUpdate = true;
  }

  function createLightRayRim(
    THREE,
    center,
    radius,
    basisA,
    basisB,
    material,
    opacity
  ) {
    const fullTurn = Math.PI * 2;
    const pointCount = LIGHT_RAY_RIM_SEGMENTS + 1;
    const positions = new Float32Array(pointCount * 3);
    const opacities = new Float32Array(pointCount);
    const lineDistances = new Float32Array(pointCount);
    let previousX = 0;
    let previousY = 0;
    let previousZ = 0;
    let cumulativeDistance = 0;

    for (let index = 0; index < pointCount; index += 1) {
      const angle = (index / LIGHT_RAY_RIM_SEGMENTS) * fullTurn;
      const x = center.x + basisA.x * Math.cos(angle) * radius + basisB.x * Math.sin(angle) * radius;
      const y = center.y + basisA.y * Math.cos(angle) * radius + basisB.y * Math.sin(angle) * radius;
      const z = center.z + basisA.z * Math.cos(angle) * radius + basisB.z * Math.sin(angle) * radius;
      const offset = index * 3;
      positions[offset] = x;
      positions[offset + 1] = y;
      positions[offset + 2] = z;
      opacities[index] = opacity;

      if (index > 0) {
        cumulativeDistance += Math.hypot(x - previousX, y - previousY, z - previousZ);
        lineDistances[index] = cumulativeDistance;
      }

      previousX = x;
      previousY = y;
      previousZ = z;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("vertexOpacity", new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute("lineDistance", new THREE.BufferAttribute(lineDistances, 1));

    const rim = new THREE.Line(geometry, material);
    rim.frustumCulled = false;
    return rim;
  }

  function createDynamicLine(THREE, pointCount, material, opacityProfile) {
    const positions = new Float32Array(pointCount * 3);
    const lineDistances = new Float32Array(pointCount);
    const opacities = new Float32Array(pointCount);
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute("vertexOpacity", new THREE.BufferAttribute(opacities, 1));
    geometry.setAttribute("lineDistance", new THREE.BufferAttribute(lineDistances, 1));
    geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
    geometry.attributes.lineDistance.setUsage(THREE.DynamicDrawUsage);

    for (let index = 0; index < pointCount; index += 1) {
      opacities[index] = clampOpacity(opacityProfile?.[index], 1);
    }

    const line = new THREE.Line(geometry, material);
    line.frustumCulled = false;

    return { positions, lineDistances, geometry, line, pointCount };
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

  function areGuideLinesVisible(state) {
    return Boolean(state?.showLightRays);
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
        togglesWithLightRaysButton: true,
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
      const opacityProfile = buildLightRayOpacityProfile(guideLine, pointCount);
      if (axisLength <= LIGHT_RAY_MIN_AXIS_LENGTH || maxRadius <= LIGHT_RAY_MIN_AXIS_LENGTH) {
        return null;
      }

      const axisDirection = axis.clone().multiplyScalar(1 / axisLength);
      const { basisA, basisB } = createLightRayBasis(THREE, axisDirection);
      const { material, isDashed } = createLightRayMaterial(THREE, guideLine, {
        dashPattern: guideLine.lightRayDashPattern,
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
          opacityProfile[0] || 0
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
          opacityProfile[pointCount - 1] || 0
        );
        lightRayGroup.add(endRim);
      }

      const sideRuntimeA = createDynamicLine(THREE, pointCount, material, opacityProfile);
      const sideRuntimeB = createDynamicLine(THREE, pointCount, material, opacityProfile);
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
          updateLineDistances(sideRuntimeA);
          updateLineDistances(sideRuntimeB);
        }
      }

      lightRayGroup.frustumCulled = false;
      return {
        object: lightRayGroup,
        update
      };
    }

    updateGuideLineVisuals(guideRuntimes, camera) {
      for (const runtime of guideRuntimes) {
        if (typeof runtime.update === "function") {
          runtime.update(camera);
        }
      }
    }

    buildGuideLines(
      sceneData,
      guideLineGroup,
      guideRuntimes,
      sceneObjectRuntimes
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
          guideRuntimes.push({
            object: lightRayRuntime.object,
            update: lightRayRuntime.update
          });
          if (Array.isArray(sceneObjectRuntimes)) {
            const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
            if (labelRuntime) {
              sceneObjectRuntimes.push(labelRuntime);
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
        guideRuntimes.push({
          object: line
        });
        if (Array.isArray(sceneObjectRuntimes)) {
          const labelRuntime = this.createGuideLineLabelRuntime(THREE, guideLine);
          if (labelRuntime) {
            sceneObjectRuntimes.push(labelRuntime);
          }
        }
      }
    }

    applyGuideLineVisibility(state, guideRuntimes) {
      for (const runtime of guideRuntimes) {
        runtime.object.visible = areGuideLinesVisible(state);
      }
    }
  }

  namespace.infrastructure.three.renderers.GuideRenderer = GuideRenderer;
})();
