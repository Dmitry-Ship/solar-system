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

    createBodyMaterial(config) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createBodyMaterial: missing THREE.");
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

      return material;
    }

    createSpacecraftMesh(config, material) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createSpacecraftMesh: missing THREE.");
      }

      const group = new THREE.Group();
      const baseMaterial = material;
      const busMaterial = new THREE.MeshLambertMaterial({ color: "#c6ccd7" });
      const boomMaterial = new THREE.MeshLambertMaterial({ color: "#8b93a1" });

      const antenna = new THREE.Mesh(
        new THREE.CylinderGeometry(0.52, 0.38, 0.08, 20),
        baseMaterial
      );
      antenna.rotation.z = Math.PI * 0.5;
      antenna.position.x = -0.34;
      group.add(antenna);

      const antennaMast = new THREE.Mesh(
        new THREE.CylinderGeometry(0.045, 0.045, 0.42, 10),
        boomMaterial
      );
      antennaMast.rotation.z = Math.PI * 0.5;
      antennaMast.position.x = -0.02;
      group.add(antennaMast);

      const bus = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.2, 0.18), busMaterial);
      bus.position.x = 0.26;
      group.add(bus);

      const longBoom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.018, 0.018, 1.15, 8),
        boomMaterial
      );
      longBoom.rotation.z = Math.PI * 0.5;
      longBoom.position.x = 0.1;
      group.add(longBoom);

      const rtgBoom = new THREE.Mesh(
        new THREE.CylinderGeometry(0.014, 0.014, 0.72, 8),
        boomMaterial
      );
      rtgBoom.position.set(0.08, -0.26, 0);
      rtgBoom.rotation.z = Math.PI * 0.32;
      group.add(rtgBoom);

      const rtg = new THREE.Mesh(
        new THREE.CylinderGeometry(0.04, 0.04, 0.22, 10),
        busMaterial
      );
      rtg.position.set(0.18, -0.56, 0);
      rtg.rotation.z = Math.PI * 0.32;
      group.add(rtg);

      return group;
    }

    createRenderableMesh(config, bodyGeometry, material) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createRenderableMesh: missing THREE.");
      }

      if (config.objectType === "spacecraft") {
        return this.createSpacecraftMesh(config, material);
      }

      return new THREE.Mesh(bodyGeometry, material);
    }

    disableFrustumCulling(object3D) {
      object3D.traverse((child) => {
        child.frustumCulled = false;
      });
    }

    createBodyRuntime(config, bodyGroup, bodyGeometry) {
      const THREE = window.THREE;
      if (!THREE) {
        throw new Error("createBodyRuntime: missing THREE.");
      }

      const material = this.createBodyMaterial(config);
      const mesh = this.createRenderableMesh(config, bodyGeometry, material);
      mesh.position.set(
        config.fixedPosition?.x || 0,
        config.fixedPosition?.y || 0,
        config.fixedPosition?.z || 0
      );
      this.disableFrustumCulling(mesh);
      bodyGroup.add(mesh);

      return {
        mesh,
        labelElement: this.labelsLayer.createLabel(config.label || config.name, {
          objectType: config.objectType
        }),
        orbitStateIndex: Number.isInteger(config.orbitStateIndex)
          ? config.orbitStateIndex
          : -1,
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
            minPixelRadius: voyager.minPixelRadius || 1.6,
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
