(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.createGuideCylinder = function createGuideCylinder(guideLine, points) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("createGuideCylinder: missing THREE.");
    }

    if (points.length < 2) return null;

    const start = points[0].clone();
    const end = points[points.length - 1].clone();
    const axis = new THREE.Vector3().subVectors(end, start);
    const axisLength = axis.length();
    const baseRadius = Math.max(guideLine.cylinderRadiusAu || 0, 0);
    const startRadius = Math.max(guideLine.cylinderStartRadiusAu ?? baseRadius, 0);
    const endRadius = Math.max(guideLine.cylinderEndRadiusAu ?? baseRadius, 0);

    if (axisLength <= 1e-6 || Math.max(startRadius, endRadius) <= 1e-6) return null;

    const axisDirection = axis.clone().multiplyScalar(1 / axisLength);
    const worldUp = new THREE.Vector3(0, 1, 0);
    const worldRight = new THREE.Vector3(1, 0, 0);
    const basisSeed =
      Math.abs(axisDirection.dot(worldUp)) > 0.98 ? worldRight : worldUp;
    const basisA = new THREE.Vector3()
      .crossVectors(axisDirection, basisSeed)
      .normalize();
    const basisB = new THREE.Vector3()
      .crossVectors(axisDirection, basisA)
      .normalize();

    const isDashed =
      Array.isArray(guideLine.cylinderDashPattern) &&
      guideLine.cylinderDashPattern.length >= 2;
    const material = isDashed
      ? new THREE.LineDashedMaterial({
          color: guideLine.color,
          transparent: true,
          opacity: Math.max(guideLine.startAlpha ?? 0.7, guideLine.endAlpha ?? 0.7),
          dashSize: Math.max(4, guideLine.cylinderDashPattern[0]),
          gapSize: Math.max(4, guideLine.cylinderDashPattern[1]),
          depthWrite: false
        })
      : new THREE.LineBasicMaterial({
          color: guideLine.color,
          transparent: true,
          opacity: Math.max(guideLine.startAlpha ?? 0.7, guideLine.endAlpha ?? 0.7),
          depthWrite: false
        });

    const cylinderGroup = new THREE.Group();
    const radialSegments = 120;
    const fullTurn = Math.PI * 2;

    function createCylinderRim(center, rimRadius) {
      const rimPoints = [];
      for (let i = 0; i <= radialSegments; i += 1) {
        const angle = (i / radialSegments) * fullTurn;
        const point = center
          .clone()
          .addScaledVector(basisA, Math.cos(angle) * rimRadius)
          .addScaledVector(basisB, Math.sin(angle) * rimRadius);
        rimPoints.push(point);
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

    const showStartRim = guideLine.showStartRim !== false;
    const showEndRim = guideLine.showEndRim !== false;
    if (showStartRim && startRadius > 1e-8) {
      const startRim = createCylinderRim(start, startRadius);
      cylinderGroup.add(startRim);
    }
    if (showEndRim && endRadius > 1e-8) {
      const endRim = createCylinderRim(end, endRadius);
      cylinderGroup.add(endRim);
    }

    const sideLinePositionsA = new Float32Array(6);
    const sideLinePositionsB = new Float32Array(6);
    const sideGeometryA = new THREE.BufferGeometry();
    const sideGeometryB = new THREE.BufferGeometry();
    sideGeometryA.setAttribute(
      "position",
      new THREE.BufferAttribute(sideLinePositionsA, 3)
    );
    sideGeometryB.setAttribute(
      "position",
      new THREE.BufferAttribute(sideLinePositionsB, 3)
    );
    sideGeometryA.attributes.position.setUsage(THREE.DynamicDrawUsage);
    sideGeometryB.attributes.position.setUsage(THREE.DynamicDrawUsage);

    const sideLineA = new THREE.Line(sideGeometryA, material);
    const sideLineB = new THREE.Line(sideGeometryB, material);
    sideLineA.frustumCulled = false;
    sideLineB.frustumCulled = false;
    cylinderGroup.add(sideLineA);
    cylinderGroup.add(sideLineB);

    const center = new THREE.Vector3().addVectors(start, end).multiplyScalar(0.5);
    const viewDirection = new THREE.Vector3();
    const viewDirectionPerpendicular = new THREE.Vector3();
    const edgeDirection = new THREE.Vector3();
    const startEdgeOffset = new THREE.Vector3();
    const endEdgeOffset = new THREE.Vector3();
    const startPoint = new THREE.Vector3();
    const endPoint = new THREE.Vector3();

    function update(camera) {
      viewDirection.subVectors(camera.position, center);
      const viewAxisDot = viewDirection.dot(axisDirection);
      viewDirectionPerpendicular.copy(axisDirection).multiplyScalar(viewAxisDot);
      viewDirectionPerpendicular.subVectors(viewDirection, viewDirectionPerpendicular);

      if (viewDirectionPerpendicular.lengthSq() <= 1e-12) {
        edgeDirection.copy(basisA);
      } else {
        viewDirectionPerpendicular.normalize();
        edgeDirection.crossVectors(axisDirection, viewDirectionPerpendicular);
        if (edgeDirection.lengthSq() <= 1e-12) {
          edgeDirection.copy(basisA);
        } else {
          edgeDirection.normalize();
        }
      }

      startEdgeOffset.copy(edgeDirection).multiplyScalar(startRadius);
      endEdgeOffset.copy(edgeDirection).multiplyScalar(endRadius);

      startPoint.copy(start).add(startEdgeOffset);
      endPoint.copy(end).add(endEdgeOffset);
      sideLinePositionsA[0] = startPoint.x;
      sideLinePositionsA[1] = startPoint.y;
      sideLinePositionsA[2] = startPoint.z;
      sideLinePositionsA[3] = endPoint.x;
      sideLinePositionsA[4] = endPoint.y;
      sideLinePositionsA[5] = endPoint.z;

      startPoint.copy(start).sub(startEdgeOffset);
      endPoint.copy(end).sub(endEdgeOffset);
      sideLinePositionsB[0] = startPoint.x;
      sideLinePositionsB[1] = startPoint.y;
      sideLinePositionsB[2] = startPoint.z;
      sideLinePositionsB[3] = endPoint.x;
      sideLinePositionsB[4] = endPoint.y;
      sideLinePositionsB[5] = endPoint.z;

      sideGeometryA.attributes.position.needsUpdate = true;
      sideGeometryB.attributes.position.needsUpdate = true;

      if (isDashed) {
        sideLineA.computeLineDistances();
        sideLineB.computeLineDistances();
      }
    }

    cylinderGroup.frustumCulled = false;
    return {
      object: cylinderGroup,
      update
    };
  };

  app.updateGuideLineVisuals = function updateGuideLineVisuals(
    guideLineRuntimes,
    camera
  ) {
    for (const runtime of guideLineRuntimes) {
      if (typeof runtime.update === "function") {
        runtime.update(camera);
      }
    }
  };

  app.buildGuideLines = function buildGuideLines(
    sceneData,
    guideLineGroup,
    guideLineRuntimes
  ) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildGuideLines: missing THREE.");
    }

    for (const guideLine of sceneData.directionalGuideLines) {
      const points = guideLine.points.map(
        (point) => new THREE.Vector3(point.x, point.y, point.z)
      );
      const isCylinder = guideLine.renderStyle === "cylinder";

      if (isCylinder) {
        const cylinderRuntime = app.createGuideCylinder(guideLine, points);
        if (!cylinderRuntime) continue;
        guideLineGroup.add(cylinderRuntime.object);
        guideLineRuntimes.push({
          object: cylinderRuntime.object,
          update: cylinderRuntime.update
        });
        continue;
      }

      const geometry = new THREE.BufferGeometry().setFromPoints(points);
      const isDashed =
        Array.isArray(guideLine.dashPattern) && guideLine.dashPattern.length >= 2;
      const material = isDashed
        ? new THREE.LineDashedMaterial({
            color: guideLine.color,
            transparent: true,
            opacity: Math.max(guideLine.startAlpha ?? 0.7, guideLine.endAlpha ?? 0.7),
            dashSize: Math.max(4, guideLine.dashPattern[0] * 6),
            gapSize: Math.max(4, guideLine.dashPattern[1] * 6)
          })
        : new THREE.LineBasicMaterial({
            color: guideLine.color,
            transparent: true,
            opacity: Math.max(guideLine.startAlpha ?? 0.8, guideLine.endAlpha ?? 0.8)
          });

      const line = new THREE.Line(geometry, material);
      if (isDashed) {
        line.computeLineDistances();
      }
      line.frustumCulled = false;

      guideLineGroup.add(line);
      guideLineRuntimes.push({ object: line });
    }
  };

  app.applyGuideLineVisibility = function applyGuideLineVisibility(
    state,
    guideLineRuntimes
  ) {
    for (const runtime of guideLineRuntimes) {
      runtime.object.visible = state.showDirectionalGuides;
    }
  };
})();
