(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("shell renderer bootstrap failed: missing three renderers namespace.");
  }

  class ShellRenderer {
    constructor(options) {
      this.constants = options.constants;
      this.shellCatalog = options.shellCatalog;
    }

    buildHeliosphereShells(shellGroup) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("buildHeliosphereShells: missing THREE.");
      }

      const heliopauseFlowDirection = new THREE.Vector3(
        this.constants.HELIOPAUSE_FLOW_DIRECTION.x,
        this.constants.HELIOPAUSE_FLOW_DIRECTION.y,
        this.constants.HELIOPAUSE_FLOW_DIRECTION.z
      ).normalize();

      const shellRuntimes = [];

      for (const shell of this.shellCatalog.HELIOSPHERE_SHELL_CONFIGS) {
        const pointCount = shell.segments + 1;
        const positions = new Float32Array(pointCount * 3);
        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

        const material = new THREE.LineDashedMaterial({
          color: shell.color,
          transparent: true,
          opacity: shell.opacity,
          dashSize: shell.dashSize,
          gapSize: shell.gapSize,
          depthWrite: false,
          blending: shell.additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });

        const line = new THREE.Line(geometry, material);
        line.frustumCulled = false;
        shellGroup.add(line);

        const flowDirectionSource = shell.distortion?.flowDirection || heliopauseFlowDirection;
        const flowDirection = new THREE.Vector3(
          flowDirectionSource.x,
          flowDirectionSource.y,
          flowDirectionSource.z
        ).normalize();

        const noseCompression = shell.distortion?.noseCompression || 0;
        const tailStretch = shell.distortion?.tailStretch || 0;
        const rippleAmplitude = shell.distortion?.rippleAmplitude || 0;
        const maxDistortionScale = 1 + tailStretch + Math.abs(rippleAmplitude);
        const minDistortionScale = Math.max(
          0.6,
          1 - noseCompression - Math.abs(rippleAmplitude)
        );

        shellRuntimes.push({
          radius: shell.radius,
          cullRadius: shell.radius * maxDistortionScale,
          minDistortionScale,
          flowDirection,
          noseCompression,
          tailStretch,
          rippleAmplitude,
          rippleFrequency: shell.distortion?.rippleFrequency || 0,
          rippleSpeed: shell.distortion?.rippleSpeed || 0,
          ripplePhase: shell.distortion?.ripplePhase || 0,
          segments: shell.segments,
          line,
          positions,
          center: new THREE.Vector3(0, 0, 0),
          worldUp: new THREE.Vector3(0, 1, 0),
          worldRight: new THREE.Vector3(1, 0, 0),
          circleCenter: new THREE.Vector3(),
          viewDirection: new THREE.Vector3(),
          basisA: new THREE.Vector3(),
          basisB: new THREE.Vector3(),
          pointScratch: new THREE.Vector3(),
          radialDirection: new THREE.Vector3()
        });
      }

      return shellRuntimes;
    }

    updateHeliosphereShells(shellRuntimes, camera, elapsedSeconds = 0) {
      const turn = Math.PI * 2;

      for (const runtime of shellRuntimes) {
        runtime.viewDirection.subVectors(runtime.center, camera.position);
        const distanceToCenter = runtime.viewDirection.length();

        if (distanceToCenter <= runtime.cullRadius + 1e-6) {
          runtime.line.visible = false;
          continue;
        }

        runtime.line.visible = true;

        runtime.viewDirection.multiplyScalar(1 / distanceToCenter);

        const planeOffset = (runtime.radius * runtime.radius) / distanceToCenter;
        const circleRadius =
          runtime.radius *
          Math.sqrt(
            Math.max(
              0,
              1 -
                (runtime.radius * runtime.radius) /
                  (distanceToCenter * distanceToCenter)
            )
          );

        runtime.circleCenter
          .copy(runtime.center)
          .addScaledVector(runtime.viewDirection, -planeOffset);

        const axis =
          Math.abs(runtime.viewDirection.dot(runtime.worldUp)) > 0.98
            ? runtime.worldRight
            : runtime.worldUp;
        runtime.basisA.crossVectors(runtime.viewDirection, axis).normalize();
        runtime.basisB.crossVectors(runtime.viewDirection, runtime.basisA).normalize();

        let offset = 0;
        for (let pointIndex = 0; pointIndex <= runtime.segments; pointIndex += 1) {
          const angle = (pointIndex / runtime.segments) * turn;
          const cosAngle = Math.cos(angle);
          const sinAngle = Math.sin(angle);

          runtime.pointScratch
            .copy(runtime.circleCenter)
            .addScaledVector(runtime.basisA, circleRadius * cosAngle)
            .addScaledVector(runtime.basisB, circleRadius * sinAngle);

          if (runtime.flowDirection) {
            runtime.radialDirection.copy(runtime.pointScratch).sub(runtime.center);
            const radialLength = runtime.radialDirection.length();

            if (radialLength > 1e-6) {
              runtime.radialDirection.multiplyScalar(1 / radialLength);
              const flowDot = runtime.radialDirection.dot(runtime.flowDirection);
              const noseFactor = Math.max(0, flowDot);
              const tailFactor = Math.max(0, -flowDot);

              let distortionScale =
                1 - runtime.noseCompression * noseFactor * noseFactor +
                runtime.tailStretch * tailFactor * tailFactor;

              if (runtime.rippleAmplitude > 1e-6 && runtime.rippleFrequency > 1e-6) {
                const rippleEnvelope = 0.35 + noseFactor * 0.65 + tailFactor * 0.45;
                distortionScale +=
                  runtime.rippleAmplitude *
                  rippleEnvelope *
                  Math.sin(
                    angle * runtime.rippleFrequency +
                      runtime.ripplePhase +
                      elapsedSeconds * runtime.rippleSpeed
                  );
              }

              distortionScale = Math.max(runtime.minDistortionScale, distortionScale);

              runtime.pointScratch
                .copy(runtime.center)
                .addScaledVector(runtime.radialDirection, runtime.radius * distortionScale);
            }
          }

          runtime.positions[offset] = runtime.pointScratch.x;
          runtime.positions[offset + 1] = runtime.pointScratch.y;
          runtime.positions[offset + 2] = runtime.pointScratch.z;
          offset += 3;
        }

        runtime.line.geometry.attributes.position.needsUpdate = true;
        runtime.line.computeLineDistances();
      }
    }
  }

  namespace.infrastructure.three.renderers.ShellRenderer = ShellRenderer;
})();
