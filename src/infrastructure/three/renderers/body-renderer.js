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
        orbitalSource: config.orbitalSource || null,
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

    buildFixedBodies(sceneData, bodyGroup, bodyGeometry, bodyRuntimes, constants) {
      const THREE = window.THREE;
      if (!THREE) {
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
            fixedPosition: voyager.position
          },
          bodyGroup,
          bodyGeometry
        );
        bodyRuntimes.push(runtime);
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
        bodyRuntimes.push(runtime);
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
        bodyRuntimes.push(runtime);
      }

      const heliopauseMarkerDirection = new THREE.Vector3(
        constants.HELIOPAUSE_FLOW_DIRECTION.x,
        constants.HELIOPAUSE_FLOW_DIRECTION.y,
        constants.HELIOPAUSE_FLOW_DIRECTION.z
      ).normalize();

      const heliopauseMarker = this.createBodyRuntime(
        {
          name: "Heliopause",
          color: "#8ccfff",
          renderRadius: 0,
          minPixelRadius: 1,
          objectType: "boundary",
          lit: false,
          labelAnchorPosition: { x: 0, y: 0, z: 0 },
          labelAnchorRadius: constants.HELIOPAUSE_AU,
          fixedPosition: {
            x: heliopauseMarkerDirection.x * constants.HELIOPAUSE_AU,
            y: heliopauseMarkerDirection.y * constants.HELIOPAUSE_AU,
            z: heliopauseMarkerDirection.z * constants.HELIOPAUSE_AU
          }
        },
        bodyGroup,
        bodyGeometry
      );
      bodyRuntimes.push(heliopauseMarker);

      const oortCloudOuterAu = Math.max(
        constants.HELIOPAUSE_AU,
        sceneData?.oortCloud?.outerAu || constants.SCENE_OUTER_AU
      );
      const oortCloudLabelAnchor = this.createLabelAnchorRuntime({
        name: "Oort Cloud",
        label: "Oort Cloud",
        fixedPosition: {
          x: heliopauseMarkerDirection.x * oortCloudOuterAu,
          y: heliopauseMarkerDirection.y * oortCloudOuterAu,
          z: heliopauseMarkerDirection.z * oortCloudOuterAu
        },
        objectType: "boundary",
        labelMarginPixels: 10
      });
      bodyRuntimes.push(oortCloudLabelAnchor);
    }
  }

  namespace.infrastructure.three.renderers.BodyRenderer = BodyRenderer;
})();
