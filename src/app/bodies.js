(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.createBodyRuntime = function createBodyRuntime(
    config,
    bodyGroup,
    bodyGeometry,
    labelsLayer
  ) {
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
      labelElement: app.createLabelElement(
        labelsLayer,
        config.label || config.name,
        {
          objectType: config.objectType
        }
      ),
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
  };

  app.createLabelAnchorRuntime = function createLabelAnchorRuntime(config, labelsLayer) {
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
      labelElement: app.createLabelElement(
        labelsLayer,
        config.label || config.name || "",
        {
          objectType: config.objectType
        }
      ),
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
  };

  app.buildOrbitLine = function buildOrbitLine(points, color, opacity) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildOrbitLine: missing THREE.");
    }

    const geometry = new THREE.BufferGeometry();
    const positionArray = new Float32Array(points.length * 3);

    let offset = 0;
    for (const point of points) {
      positionArray[offset] = point.x;
      positionArray[offset + 1] = point.y;
      positionArray[offset + 2] = point.z;
      offset += 3;
    }

    geometry.setAttribute("position", new THREE.BufferAttribute(positionArray, 3));
    const material = new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity
    });

    return new THREE.Line(geometry, material);
  };

  app.buildOrbitingBodies = function buildOrbitingBodies(
    sceneData,
    orbitGroup,
    bodyGroup,
    bodyGeometry,
    bodyRuntimes,
    orbitalSourceBodies,
    labelsLayer,
    math
  ) {
    const orbitalPositionScratch = { x: 0, y: 0, z: 0 };
    const namesToggleTargetGroups = new Set(["planets", "dwarfPlanets", "comets"]);
    const labelObjectTypeByGroupKey = {
      planets: "planet",
      dwarfPlanets: "dwarf-planet",
      comets: "comet"
    };

    for (const group of sceneData.orbitRenderGroups) {
      const sourceBodies = sceneData[group.key] || [];
      for (const sourceBody of sourceBodies) {
        const orbitLine = app.buildOrbitLine(
          sourceBody.orbitPath,
          sourceBody.orbitColor,
          sourceBody.orbitOpacity
        );
        orbitGroup.add(orbitLine);

        const fallbackMinPixelRadius = group.key === "planets" ? 1.25 : 1.1;
        const runtime = app.createBodyRuntime(
          {
            name: sourceBody.name,
            color: sourceBody.color,
            renderRadius: sourceBody.renderRadius,
            minPixelRadius: sourceBody.minPixelRadius || fallbackMinPixelRadius,
            orbitalSource: sourceBody,
            objectType: labelObjectTypeByGroupKey[group.key] || "orbiting-body",
            togglesWithNamesButton: namesToggleTargetGroups.has(group.key)
          },
          bodyGroup,
          bodyGeometry,
          labelsLayer
        );

        math.orbitalPositionInto(
          orbitalPositionScratch,
          sourceBody.orbitRadius,
          sourceBody.theta,
          sourceBody.inclination,
          sourceBody.node,
          0,
          sourceBody.eccentricity,
          sourceBody.periapsisArg
        );

        runtime.mesh.position.set(
          orbitalPositionScratch.x,
          orbitalPositionScratch.y,
          orbitalPositionScratch.z
        );

        bodyRuntimes.push(runtime);
        orbitalSourceBodies.push(sourceBody);
      }
    }
  };

  app.buildFixedBodies = function buildFixedBodies(
    sceneData,
    bodyGroup,
    bodyGeometry,
    bodyRuntimes,
    labelsLayer,
    constants
  ) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("buildFixedBodies: missing THREE.");
    }

    for (const voyager of sceneData.voyagers) {
      const runtime = app.createBodyRuntime(
        {
          name: voyager.name,
          color: voyager.color,
          renderRadius: voyager.renderRadius,
          minPixelRadius: voyager.minPixelRadius || 2.1,
          objectType: "spacecraft",
          fixedPosition: voyager.position
        },
        bodyGroup,
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    for (const body of sceneData.driftingBodies) {
      const runtime = app.createBodyRuntime(
        {
          name: body.name,
          color: body.color,
          renderRadius: body.renderRadius,
          minPixelRadius: body.minPixelRadius || 1.5,
          objectType: "interstellar-object",
          fixedPosition: body
        },
        bodyGroup,
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    for (const marker of sceneData.directionalMarkers) {
      const runtime = app.createBodyRuntime(
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
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    const heliopauseMarkerDirection = new THREE.Vector3(
      constants.HELIOPAUSE_FLOW_DIRECTION.x,
      constants.HELIOPAUSE_FLOW_DIRECTION.y,
      constants.HELIOPAUSE_FLOW_DIRECTION.z
    ).normalize();

    const heliopauseMarker = app.createBodyRuntime(
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
      bodyGeometry,
      labelsLayer
    );
    bodyRuntimes.push(heliopauseMarker);

    const oortCloudOuterAu = Math.max(
      constants.HELIOPAUSE_AU,
      sceneData?.oortCloud?.outerAu || constants.SCENE_OUTER_AU
    );
    const oortCloudLabelAnchor = app.createLabelAnchorRuntime(
      {
        name: "Oort Cloud",
        label: "Oort Cloud",
        fixedPosition: {
          x: heliopauseMarkerDirection.x * oortCloudOuterAu,
          y: heliopauseMarkerDirection.y * oortCloudOuterAu,
          z: heliopauseMarkerDirection.z * oortCloudOuterAu
        },
        objectType: "boundary",
        labelMarginPixels: 10
      },
      labelsLayer
    );
    bodyRuntimes.push(oortCloudLabelAnchor);
  };

  app.createOrbitingBodiesUpdater = function createOrbitingBodiesUpdater(options) {
    const { orbitalSourceBodies, bodyRuntimes, math } = options;
    const orbitalPositionScratch = options.orbitalPositionScratch || { x: 0, y: 0, z: 0 };
    const motionTimeScale = options.motionTimeScale ?? 1;

    return function updateOrbitingBodies(deltaSeconds) {
      for (const body of orbitalSourceBodies) {
        body.theta = math.normalizeAngle(
          body.theta + body.meanMotion * deltaSeconds * motionTimeScale
        );
      }

      for (const runtime of bodyRuntimes) {
        if (!runtime.orbitalSource) continue;

        const source = runtime.orbitalSource;
        math.orbitalPositionInto(
          orbitalPositionScratch,
          source.orbitRadius,
          source.theta,
          source.inclination,
          source.node,
          0,
          source.eccentricity,
          source.periapsisArg
        );

        runtime.mesh.position.set(
          orbitalPositionScratch.x,
          orbitalPositionScratch.y,
          orbitalPositionScratch.z
        );
      }
    };
  };
})();
