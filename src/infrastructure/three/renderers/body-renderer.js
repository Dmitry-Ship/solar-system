(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("body renderer bootstrap failed: missing three renderers namespace.");
  }

  class BodyRenderer {
    constructor(options) {
      this.labelsLayer = options.labelsLayer;
    }

    createBodyRuntime(config, bodyGroup, bodyGeometry) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createBodyRuntime: missing THREE.");
      }

      const useLitMaterial = !config.emissive && config.lit !== false;
      const material = useLitMaterial
        ? new THREE.MeshLambertMaterial({
            color: config.color
          })
        : new THREE.MeshBasicMaterial({
            color: config.color,
            toneMapped: false
          });
      if (!useLitMaterial && config.emissive) {
        material.transparent = true;
        material.opacity = 0.95;
      }

      const mesh = new THREE.Mesh(bodyGeometry, material);
      mesh.position.set(
        config.fixedPosition?.x || 0,
        config.fixedPosition?.y || 0,
        config.fixedPosition?.z || 0
      );
      mesh.frustumCulled = false;
      bodyGroup.add(mesh);

      return {
        mesh,
        labelElement: this.labelsLayer.createLabel(config.label || config.name, {
          objectType: config.objectType
        }),
        renderRadius: config.renderRadius || 0,
        minPixelRadius: config.minPixelRadius || 1,
        orbitingBody: config.orbitingBody || config.orbitalSource || null,
        orbitalSource: config.orbitingBody || config.orbitalSource || null,
        togglesWithNamesButton: Boolean(config.togglesWithNamesButton),
        labelAnchorPosition: config.labelAnchorPosition
          ? new THREE.Vector3(
              config.labelAnchorPosition.x || 0,
              config.labelAnchorPosition.y || 0,
              config.labelAnchorPosition.z || 0
            )
          : null,
        labelAnchorRadius: Math.max(0, config.labelAnchorRadius || 0),
        labelMarginPixels: Math.max(1, config.labelMarginPixels || 5)
      };
    }

    createLabelAnchorRuntime(config) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createLabelAnchorRuntime: missing THREE.");
      }

      const mesh = new THREE.Object3D();
      mesh.position.set(
        config.fixedPosition?.x || 0,
        config.fixedPosition?.y || 0,
        config.fixedPosition?.z || 0
      );

      return {
        mesh,
        labelElement: this.labelsLayer.createLabel(config.label || config.name || "", {
          objectType: config.objectType
        }),
        renderRadius: 0,
        minPixelRadius: 0,
        labelAnchorPosition: config.labelAnchorPosition
          ? new THREE.Vector3(
              config.labelAnchorPosition.x || 0,
              config.labelAnchorPosition.y || 0,
              config.labelAnchorPosition.z || 0
            )
          : null,
        labelAnchorRadius: Math.max(0, config.labelAnchorRadius || 0),
        labelMarginPixels: Math.max(1, config.labelMarginPixels || 5)
      };
    }

    buildFixedBodies(sceneData, bodyGroup, bodyGeometry, sceneObjectRuntimes) {
      if (!window.THREE) {
        throw new Error("buildFixedBodies: missing THREE.");
      }

      for (const voyager of sceneData.voyagers) {
        const runtime = this.createBodyRuntime(
          {
            name: voyager.name,
            color: voyager.color,
            renderRadius: voyager.renderRadius,
            minPixelRadius: voyager.minPixelRadius || 2.1,
            objectType: "spacecraft",
            fixedPosition: voyager.position,
            togglesWithNamesButton: true
          },
          bodyGroup,
          bodyGeometry
        );
        sceneObjectRuntimes.push(runtime);
      }

      for (const body of sceneData.driftingBodies) {
        const runtime = this.createBodyRuntime(
          {
            name: body.name,
            color: body.color,
            renderRadius: body.renderRadius,
            minPixelRadius: body.minPixelRadius || 1.5,
            objectType: "interstellar-object",
            fixedPosition: body
          },
          bodyGroup,
          bodyGeometry
        );
        sceneObjectRuntimes.push(runtime);
      }

      for (const marker of sceneData.directionalMarkers) {
        const runtime = this.createBodyRuntime(
          {
            name: marker.name,
            label: marker.label,
            color: marker.color,
            renderRadius: 0,
            minPixelRadius: marker.minPixelRadius || 2.3,
            objectType: "directional-marker",
            fixedPosition: marker,
            lit: false
          },
          bodyGroup,
          bodyGeometry
        );
        sceneObjectRuntimes.push(runtime);
      }

    }
  }

  namespace.infrastructure.three.renderers.BodyRenderer = BodyRenderer;
})();
