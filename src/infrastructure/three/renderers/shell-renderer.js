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
        const vertexCount = pointCount * 2;
        const positions = new Float32Array(vertexCount * 3);
        const colors = new Float32Array(vertexCount * 3);
        const indices = new Uint16Array(shell.segments * 6);

        let indexOffset = 0;
        for (let segmentIndex = 0; segmentIndex < shell.segments; segmentIndex += 1) {
          const innerA = segmentIndex * 2;
          const outerA = innerA + 1;
          const innerB = innerA + 2;
          const outerB = innerA + 3;

          indices[indexOffset] = innerA;
          indices[indexOffset + 1] = innerB;
          indices[indexOffset + 2] = outerA;
          indices[indexOffset + 3] = innerB;
          indices[indexOffset + 4] = outerB;
          indices[indexOffset + 5] = outerA;
          indexOffset += 6;
        }

        const geometry = new THREE.BufferGeometry();
        geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
        geometry.setIndex(new THREE.BufferAttribute(indices, 1));
        geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);
        geometry.attributes.color.setUsage(THREE.DynamicDrawUsage);

        const material = new THREE.MeshBasicMaterial({
          transparent: true,
          opacity: shell.opacity,
          vertexColors: true,
          side: THREE.DoubleSide,
          depthWrite: false,
          blending: shell.additive ? THREE.AdditiveBlending : THREE.NormalBlending
        });

        const mesh = new THREE.Mesh(geometry, material);
        mesh.frustumCulled = false;
        shellGroup.add(mesh);

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
        const bandWidthAu = Math.max(0.2, shell.bandWidthAu || 2.2);
        const pulseStrength = Math.max(0, shell.pulseStrength || 0);
        const pulseFrequency = Math.max(0, shell.pulseFrequency || 0);
        const pulseSpeed = Math.max(0, shell.pulseSpeed || 0);
        const pulsePhase = shell.pulsePhase || 0;

        shellRuntimes.push({
          radius: shell.radius,
          cullRadius: (shell.radius + bandWidthAu * 0.5) * maxDistortionScale,
          bandWidthAu,
          minDistortionScale,
          flowDirection,
          flowHighlightStrength: Math.max(0, shell.flowHighlightStrength || 0),
          tailTintStrength: Math.max(0, shell.tailTintStrength || 0),
          baseColor: new THREE.Color(shell.color),
          noseColor: new THREE.Color(shell.noseColor || shell.color),
          tailColor: new THREE.Color(shell.tailColor || shell.color),
          pulseStrength,
          pulseFrequency,
          pulseSpeed,
          pulsePhase,
          noseCompression,
          tailStretch,
          rippleAmplitude,
          rippleFrequency: shell.distortion?.rippleFrequency || 0,
          rippleSpeed: shell.distortion?.rippleSpeed || 0,
          ripplePhase: shell.distortion?.ripplePhase || 0,
          segments: shell.segments,
          mesh,
          positions,
          colors,
          center: new THREE.Vector3(0, 0, 0),
          worldUp: new THREE.Vector3(0, 1, 0),
          worldRight: new THREE.Vector3(1, 0, 0),
          circleCenter: new THREE.Vector3(),
          viewDirection: new THREE.Vector3(),
          basisA: new THREE.Vector3(),
          basisB: new THREE.Vector3(),
          pointScratch: new THREE.Vector3(),
          radialDirection: new THREE.Vector3(),
          innerPoint: new THREE.Vector3(),
          outerPoint: new THREE.Vector3(),
          colorScratch: new THREE.Color()
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
          runtime.mesh.visible = false;
          continue;
        }

        runtime.mesh.visible = true;

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

        let positionOffset = 0;
        let colorOffset = 0;
        for (let pointIndex = 0; pointIndex <= runtime.segments; pointIndex += 1) {
          const angle = (pointIndex / runtime.segments) * turn;
          const cosAngle = Math.cos(angle);
          const sinAngle = Math.sin(angle);

          runtime.pointScratch
            .copy(runtime.circleCenter)
            .addScaledVector(runtime.basisA, circleRadius * cosAngle)
            .addScaledVector(runtime.basisB, circleRadius * sinAngle);

          runtime.radialDirection.copy(runtime.pointScratch).sub(runtime.center);
          const radialLength = runtime.radialDirection.length();
          let noseFactor = 0;
          let tailFactor = 0;
          let pulseFactor = 0;

          if (radialLength > 1e-6) {
            runtime.radialDirection.multiplyScalar(1 / radialLength);

            if (runtime.flowDirection) {
              const flowDot = runtime.radialDirection.dot(runtime.flowDirection);
              noseFactor = Math.max(0, flowDot);
              tailFactor = Math.max(0, -flowDot);

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

            if (runtime.pulseStrength > 1e-6 && runtime.pulseFrequency > 1e-6) {
              pulseFactor =
                0.5 +
                0.5 *
                  Math.sin(
                    angle * runtime.pulseFrequency +
                      runtime.pulsePhase +
                      elapsedSeconds * runtime.pulseSpeed
                  );
            }
          } else {
            runtime.radialDirection.copy(runtime.basisA);
          }

          const widthScale = 1 + runtime.pulseStrength * 0.12 * (pulseFactor - 0.5);
          const halfBandWidth = runtime.bandWidthAu * widthScale * 0.5;

          runtime.innerPoint
            .copy(runtime.pointScratch)
            .addScaledVector(runtime.radialDirection, -halfBandWidth);
          runtime.outerPoint
            .copy(runtime.pointScratch)
            .addScaledVector(runtime.radialDirection, halfBandWidth);

          runtime.positions[positionOffset] = runtime.innerPoint.x;
          runtime.positions[positionOffset + 1] = runtime.innerPoint.y;
          runtime.positions[positionOffset + 2] = runtime.innerPoint.z;
          runtime.positions[positionOffset + 3] = runtime.outerPoint.x;
          runtime.positions[positionOffset + 4] = runtime.outerPoint.y;
          runtime.positions[positionOffset + 5] = runtime.outerPoint.z;
          positionOffset += 6;

          runtime.colorScratch.copy(runtime.baseColor);
          if (runtime.tailTintStrength > 1e-6 && tailFactor > 1e-6) {
            runtime.colorScratch.lerp(
              runtime.tailColor,
              Math.min(1, tailFactor * runtime.tailTintStrength)
            );
          }
          if (runtime.flowHighlightStrength > 1e-6 && noseFactor > 1e-6) {
            runtime.colorScratch.lerp(
              runtime.noseColor,
              Math.min(1, noseFactor * runtime.flowHighlightStrength)
            );
          }

          if (runtime.pulseStrength > 1e-6) {
            const pulseBrightness = 1 + runtime.pulseStrength * (pulseFactor - 0.5);
            runtime.colorScratch.r = Math.min(1, runtime.colorScratch.r * pulseBrightness);
            runtime.colorScratch.g = Math.min(1, runtime.colorScratch.g * pulseBrightness);
            runtime.colorScratch.b = Math.min(1, runtime.colorScratch.b * pulseBrightness);
          }

          runtime.colors[colorOffset] = runtime.colorScratch.r;
          runtime.colors[colorOffset + 1] = runtime.colorScratch.g;
          runtime.colors[colorOffset + 2] = runtime.colorScratch.b;
          runtime.colors[colorOffset + 3] = runtime.colorScratch.r;
          runtime.colors[colorOffset + 4] = runtime.colorScratch.g;
          runtime.colors[colorOffset + 5] = runtime.colorScratch.b;
          colorOffset += 6;
        }

        runtime.mesh.geometry.attributes.position.needsUpdate = true;
        runtime.mesh.geometry.attributes.color.needsUpdate = true;
      }
    }
  }

  namespace.infrastructure.three.renderers.ShellRenderer = ShellRenderer;
})();
