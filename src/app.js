(() => {
  const THREE = window.THREE;

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }

  function bootstrap() {
    if (
      !THREE ||
      !THREE.OrbitControls ||
      !THREE.ShaderPass ||
      !THREE.CopyShader ||
      !THREE.LuminosityHighPassShader ||
      !THREE.EffectComposer ||
      !THREE.RenderPass ||
      !THREE.UnrealBloomPass
    ) {
      throw new Error(
        "Three.js bootstrap failed: missing THREE, OrbitControls, or postprocessing classes."
      );
    }

    const namespace = (window.SolarSystem = window.SolarSystem || {});
    const { constants, data, math } = namespace;

    if (!constants || !data || !math) {
      throw new Error("SolarSystem bootstrap failed: missing required modules.");
    }

    const canvas = document.getElementById("scene");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected canvas element with id "scene".');
    }

    const sceneData = data.createSceneData();
    prepareSceneCaches(sceneData, constants, math);

    const state = {
      showBodyNames: true,
      showDirectionalGuides: true,
      minCamera: constants.MIN_ZOOM_AU,
      maxCamera: constants.MAX_ZOOM_AU
    };

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      powerPreference: "high-performance"
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    if ("outputColorSpace" in renderer && THREE.SRGBColorSpace) {
      renderer.outputColorSpace = THREE.SRGBColorSpace;
    } else if ("outputEncoding" in renderer && THREE.sRGBEncoding !== undefined) {
      renderer.outputEncoding = THREE.sRGBEncoding;
    }
    renderer.setClearColor(constants.BACKGROUND_COLOR, 1);

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      48,
      Math.max(1, window.innerWidth) / Math.max(1, window.innerHeight),
      constants.NEAR_CLIP,
      constants.SCENE_OUTER_AU * 12
    );

    const composer = new THREE.EffectComposer(renderer);
    const renderPass = new THREE.RenderPass(scene, camera);
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(
        Math.max(1, window.innerWidth),
        Math.max(1, window.innerHeight)
      ),
      constants.SUN_BLOOM_STRENGTH,
      constants.SUN_BLOOM_RADIUS,
      constants.SUN_BLOOM_THRESHOLD
    );
    composer.addPass(renderPass);
    composer.addPass(bloomPass);

    const controls = new THREE.OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.08;
    controls.enablePan = false;
    controls.rotateSpeed = 0.68;
    controls.zoomSpeed = 0.05;
    controls.minDistance = state.minCamera;
    controls.maxDistance = state.maxCamera;
    controls.target.set(0, 0, 0);

    canvas.addEventListener("pointerdown", () => {
      canvas.classList.add("dragging");
    });
    window.addEventListener("pointerup", () => {
      canvas.classList.remove("dragging");
    });

    const labelsLayer = createLabelsLayer();

    scene.add(new THREE.AmbientLight("#ffffff", 0.5));
    const sunLight = new THREE.PointLight("#ffd794", 1.2, 0, 0);
    scene.add(sunLight);

    const orbitGroup = new THREE.Group();
    const shellGroup = new THREE.Group();
    const guideLineGroup = new THREE.Group();
    const particleGroup = new THREE.Group();
    const bodyGroup = new THREE.Group();

    scene.add(orbitGroup);
    scene.add(shellGroup);
    scene.add(guideLineGroup);
    scene.add(particleGroup);
    scene.add(bodyGroup);

    const bodyGeometry = new THREE.SphereGeometry(1, 20, 12);
    const bodyRuntimes = [];
    const guideLineRuntimes = [];
    const beltRuntimes = [];
    const orbitalSourceBodies = [];
    const orbitalPositionScratch = { x: 0, y: 0, z: 0 };
    const projectionScratch = new THREE.Vector3();

    buildStarField(sceneData, particleGroup);
    buildOortCloud(sceneData, particleGroup);
    const heliosphereShellRuntimes = buildHeliosphereShells(constants, shellGroup);
    buildGuideLines(sceneData, guideLineGroup, guideLineRuntimes);
    buildAsteroidBelts(sceneData, particleGroup, beltRuntimes, math, orbitalPositionScratch);
    buildOrbitingBodies(
      sceneData,
      orbitGroup,
      bodyGroup,
      bodyGeometry,
      bodyRuntimes,
      orbitalSourceBodies,
      labelsLayer,
      math
    );
    buildFixedBodies(sceneData, bodyGroup, bodyGeometry, bodyRuntimes, labelsLayer, constants);

    const sunRuntime = createBodyRuntime(
      {
        name: "Sun",
        color: "#ffce6b",
        renderRadius: constants.SUN_RADIUS_KM / constants.KM_PER_AU,
        minPixelRadius: 2.6,
        fixedPosition: { x: 0, y: 0, z: 0 },
        emissive: true
      },
      bodyGroup,
      bodyGeometry,
      labelsLayer
    );
    bodyRuntimes.push(sunRuntime);

    const hud = setupHudControls(
      state,
      controls,
      guideLineRuntimes,
      labelsLayer,
      camera,
      math
    );

    setInitialCameraPlacement(camera, controls, constants, state, math);

    const clock = new THREE.Clock();
    const motionTimeScale = 1;

    function updateOrbitingBodies(deltaSeconds) {
      for (const body of orbitalSourceBodies) {
        body.theta = normalizeAngle(body.theta + body.meanMotion * deltaSeconds * motionTimeScale);
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
    }

    function updateAsteroidBelts(deltaSeconds) {
      for (const beltRuntime of beltRuntimes) {
        const { belt, positions, geometry } = beltRuntime;
        let offset = 0;

        for (const particle of belt.particles) {
          particle.theta = normalizeAngle(
            particle.theta + particle.meanMotion * deltaSeconds * motionTimeScale
          );

          math.orbitalPositionInto(
            orbitalPositionScratch,
            particle.orbitRadius,
            particle.theta,
            particle.inclination,
            particle.node,
            0,
            particle.eccentricity,
            particle.periapsisArg
          );

          positions[offset] = orbitalPositionScratch.x;
          positions[offset + 1] = orbitalPositionScratch.y;
          positions[offset + 2] = orbitalPositionScratch.z;
          offset += 3;
        }

        geometry.attributes.position.needsUpdate = true;
      }
    }

    function updateBodyVisualScaleAndLabels() {
      const viewportWidth = renderer.domElement.clientWidth;
      const viewportHeight = renderer.domElement.clientHeight;
      const halfFovTangent = Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5);

      for (const runtime of bodyRuntimes) {
        const distance = Math.max(1e-6, camera.position.distanceTo(runtime.mesh.position));
        const pixelsPerWorldUnit = viewportHeight / (2 * distance * halfFovTangent);

        const pixelRadius = Math.max(
          runtime.minPixelRadius,
          runtime.renderRadius * pixelsPerWorldUnit
        );
        const worldRadius = Math.max(1e-6, pixelRadius / pixelsPerWorldUnit);

        runtime.mesh.scale.setScalar(worldRadius);
        runtime.pixelRadius = pixelRadius;

        if (!runtime.labelElement) continue;

        if (!state.showBodyNames) {
          runtime.labelElement.style.display = "none";
          continue;
        }

        const labelAnchorPosition = runtime.labelAnchorPosition || runtime.mesh.position;
        projectionScratch.copy(labelAnchorPosition).project(camera);
        const isVisible =
          projectionScratch.z > -1 &&
          projectionScratch.z < 1 &&
          projectionScratch.x > -1.15 &&
          projectionScratch.x < 1.15 &&
          projectionScratch.y > -1.15 &&
          projectionScratch.y < 1.15;

        if (!isVisible) {
          runtime.labelElement.style.display = "none";
          continue;
        }

        let labelPixelRadius = pixelRadius;
        if (runtime.labelAnchorRadius > 0) {
          const labelAnchorDistance = camera.position.distanceTo(labelAnchorPosition);
          if (labelAnchorDistance <= runtime.labelAnchorRadius + 1e-6) {
            runtime.labelElement.style.display = "none";
            continue;
          }

          const anchorPixelsPerWorldUnit =
            viewportHeight / (2 * labelAnchorDistance * halfFovTangent);
          labelPixelRadius = runtime.labelAnchorRadius * anchorPixelsPerWorldUnit;
        }

        const screenX = (projectionScratch.x * 0.5 + 0.5) * viewportWidth;
        const screenY =
          (-projectionScratch.y * 0.5 + 0.5) * viewportHeight -
          labelPixelRadius -
          runtime.labelMarginPixels;

        runtime.labelElement.style.display = "block";
        runtime.labelElement.style.transform = `translate(-50%, -100%) translate(${screenX.toFixed(
          2
        )}px, ${screenY.toFixed(2)}px)`;
      }
    }

    function resize() {
      const width = Math.max(1, window.innerWidth);
      const height = Math.max(1, window.innerHeight);
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 2);

      renderer.setPixelRatio(pixelRatio);
      renderer.setSize(width, height, false);
      if (typeof composer.setPixelRatio === "function") {
        composer.setPixelRatio(pixelRatio);
      }
      composer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();

      controls.minDistance = state.minCamera;
      controls.maxDistance = state.maxCamera;
      hud.updateZoomToggleLabel();
    }

    function animate() {
      requestAnimationFrame(animate);

      const deltaSeconds = Math.min(clock.getDelta(), 0.05);
      updateOrbitingBodies(deltaSeconds);
      updateAsteroidBelts(deltaSeconds);

      controls.update();
      updateHeliosphereShells(
        heliosphereShellRuntimes,
        camera,
        clock.elapsedTime || 0
      );
      updateGuideLineVisuals(guideLineRuntimes, camera);
      updateBodyVisualScaleAndLabels();
      composer.render();
    }

    window.addEventListener("resize", resize);
    resize();
    applyGuideLineVisibility(state, guideLineRuntimes);
    animate();
  }

  function normalizeAngle(value) {
    const turn = Math.PI * 2;
    let result = value % turn;
    if (result < 0) result += turn;
    return result;
  }

  function prepareSceneCaches(sceneData, constants, math) {
    const auToUnits = (au) => au;
    const renderRadiusFromKm = (radiusKm) => radiusKm / constants.KM_PER_AU;

    for (const group of sceneData.orbitRenderGroups) {
      const sourceBodies = sceneData[group.key] || [];
      const shouldUseRadiusOrbitOpacity = group.key !== "comets";

      for (const body of sourceBodies) {
        body.orbitRadius = auToUnits(body.au);
        body.renderRadius = renderRadiusFromKm(body.radiusKm);
        body.orbitOpacity = shouldUseRadiusOrbitOpacity
          ? sceneData.orbitOpacityForBodyRadius(body.radiusKm)
          : 0.05;
        body.orbitPath = math.orbitPoints(
          body.orbitRadius,
          body.inclination,
          body.node,
          group.segments,
          body.eccentricity,
          body.periapsisArg
        );
      }
    }

    for (const voyager of sceneData.voyagers) {
      voyager.renderRadius = renderRadiusFromKm(voyager.radiusKm);
    }

    for (const body of sceneData.driftingBodies) {
      body.renderRadius = renderRadiusFromKm(body.radiusKm);
    }

    for (const belt of sceneData.asteroidBelts) {
      for (const particle of belt.particles) {
        particle.orbitRadius = auToUnits(particle.au);
      }
    }
  }

  function createLabelsLayer() {
    const existingLayer = document.getElementById("labels-layer");
    if (existingLayer) {
      existingLayer.remove();
    }

    const layer = document.createElement("div");
    layer.id = "labels-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  }

  function createLabelElement(layer, text) {
    const label = document.createElement("div");
    label.className = "body-label";
    label.textContent = text;
    layer.appendChild(label);
    return label;
  }

  function createBodyRuntime(config, bodyGroup, bodyGeometry, labelsLayer) {
    const material = new THREE.MeshBasicMaterial({
      color: config.color,
      toneMapped: false
    });
    if (config.emissive) {
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
      name: config.name,
      labelElement: createLabelElement(labelsLayer, config.label || config.name),
      renderRadius: config.renderRadius || 0,
      minPixelRadius: config.minPixelRadius || 1,
      orbitalSource: config.orbitalSource || null,
      pixelRadius: config.minPixelRadius || 1,
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

  function buildOrbitLine(points, color, opacity) {
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
      opacity: opacity
    });

    return new THREE.Line(geometry, material);
  }

  function buildOrbitingBodies(
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

    for (const group of sceneData.orbitRenderGroups) {
      const sourceBodies = sceneData[group.key] || [];
      for (const sourceBody of sourceBodies) {
        const orbitLine = buildOrbitLine(
          sourceBody.orbitPath,
          sourceBody.orbitColor,
          sourceBody.orbitOpacity
        );
        orbitGroup.add(orbitLine);

        const fallbackMinPixelRadius = group.key === "planets" ? 1.25 : 1.1;
        const runtime = createBodyRuntime(
          {
            name: sourceBody.name,
            color: sourceBody.color,
            renderRadius: sourceBody.renderRadius,
            minPixelRadius: sourceBody.minPixelRadius || fallbackMinPixelRadius,
            orbitalSource: sourceBody
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
  }

  function buildFixedBodies(
    sceneData,
    bodyGroup,
    bodyGeometry,
    bodyRuntimes,
    labelsLayer,
    constants
  ) {
    for (const voyager of sceneData.voyagers) {
      const runtime = createBodyRuntime(
        {
          name: voyager.name,
          color: voyager.color,
          renderRadius: voyager.renderRadius,
          minPixelRadius: voyager.minPixelRadius || 2.1,
          fixedPosition: voyager.position
        },
        bodyGroup,
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    for (const body of sceneData.driftingBodies) {
      const runtime = createBodyRuntime(
        {
          name: body.name,
          color: body.color,
          renderRadius: body.renderRadius,
          minPixelRadius: body.minPixelRadius || 1.5,
          fixedPosition: body
        },
        bodyGroup,
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    for (const marker of sceneData.directionalMarkers) {
      const runtime = createBodyRuntime(
        {
          name: marker.name,
          label: marker.label,
          color: marker.color,
          renderRadius: 0,
          minPixelRadius: marker.minPixelRadius || 2.3,
          fixedPosition: marker
        },
        bodyGroup,
        bodyGeometry,
        labelsLayer
      );
      bodyRuntimes.push(runtime);
    }

    const lensMarker = createBodyRuntime(
      {
        name: "Solar Gravitational Lens",
        color: "#88d3ff",
        renderRadius: 0,
        minPixelRadius: 1,
        labelAnchorPosition: { x: 0, y: 0, z: 0 },
        labelAnchorRadius: constants.SOLAR_GRAVITATIONAL_LENS_AU,
        fixedPosition: {
          x: constants.SOLAR_GRAVITATIONAL_LENS_AU,
          y: 0,
          z: 0
        }
      },
      bodyGroup,
      bodyGeometry,
      labelsLayer
    );
    bodyRuntimes.push(lensMarker);

    const heliopauseMarkerDirection = new THREE.Vector3(
      constants.HELIOPAUSE_FLOW_DIRECTION.x,
      constants.HELIOPAUSE_FLOW_DIRECTION.y,
      constants.HELIOPAUSE_FLOW_DIRECTION.z
    ).normalize();

    const heliopauseMarker = createBodyRuntime(
      {
        name: "Heliopause (Solar Wind / ISM Boundary)",
        color: "#8ccfff",
        renderRadius: 0,
        minPixelRadius: 1,
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
  }

  function buildStarField(sceneData, particleGroup) {
    const positions = new Float32Array(sceneData.stars.length * 3);
    let offset = 0;
    for (const star of sceneData.stars) {
      positions[offset] = star.x;
      positions[offset + 1] = star.y;
      positions[offset + 2] = star.z;
      offset += 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const stars = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: "#dbe6ff",
        size: 1.2,
        transparent: true,
        opacity: 0.72,
        sizeAttenuation: false,
        depthWrite: false
      })
    );

    particleGroup.add(stars);
  }

  function buildOortCloud(sceneData, particleGroup) {
    const particles = sceneData.oortCloud.particles;
    const positions = new Float32Array(particles.length * 3);
    let offset = 0;

    for (const particle of particles) {
      positions[offset] = particle.x;
      positions[offset + 1] = particle.y;
      positions[offset + 2] = particle.z;
      offset += 3;
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));

    const oortCloud = new THREE.Points(
      geometry,
      new THREE.PointsMaterial({
        color: sceneData.oortCloud.color,
        size: 2.2,
        transparent: true,
        opacity: Math.min(0.05, sceneData.oortCloud.alpha),
        sizeAttenuation: true,
        depthWrite: false
      })
    );

    particleGroup.add(oortCloud);
  }

  function buildAsteroidBelts(
    sceneData,
    particleGroup,
    beltRuntimes,
    math,
    orbitalPositionScratch
  ) {
    for (const belt of sceneData.asteroidBelts) {
      const positions = new Float32Array(belt.particles.length * 3);
      const geometry = new THREE.BufferGeometry();
      geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
      geometry.attributes.position.setUsage(THREE.DynamicDrawUsage);

      const points = new THREE.Points(
        geometry,
        new THREE.PointsMaterial({
          color: belt.color,
          size: 1.15,
          transparent: true,
          opacity: Math.min(0.1, belt.alpha * 1.2),
          sizeAttenuation: false,
          depthWrite: false
        })
      );

      particleGroup.add(points);
      beltRuntimes.push({ belt, points, geometry, positions });

      let offset = 0;
      for (const particle of belt.particles) {
        math.orbitalPositionInto(
          orbitalPositionScratch,
          particle.orbitRadius,
          particle.theta,
          particle.inclination,
          particle.node,
          0,
          particle.eccentricity,
          particle.periapsisArg
        );

        positions[offset] = orbitalPositionScratch.x;
        positions[offset + 1] = orbitalPositionScratch.y;
        positions[offset + 2] = orbitalPositionScratch.z;
        offset += 3;
      }

      geometry.attributes.position.needsUpdate = true;
    }
  }

  function buildHeliosphereShells(constants, shellGroup) {
    const heliopauseFlowDirection = new THREE.Vector3(
      constants.HELIOPAUSE_FLOW_DIRECTION.x,
      constants.HELIOPAUSE_FLOW_DIRECTION.y,
      constants.HELIOPAUSE_FLOW_DIRECTION.z
    ).normalize();

    const shellConfigs = [
      {
        radius: constants.HELIOPAUSE_AU + constants.HELIOPAUSE_MIXING_BAND_AU,
        color: "#86d8ff",
        opacity: 0.32,
        dashSize: 14,
        gapSize: 8,
        segments: 190,
        additive: true,
        distortion: {
          flowDirection: heliopauseFlowDirection,
          noseCompression: 0.22,
          tailStretch: 0.32,
          rippleAmplitude: 0.02,
          rippleFrequency: 7.5,
          rippleSpeed: 0.75,
          ripplePhase: 2.2
        }
      },
      {
        radius: constants.SOLAR_GRAVITATIONAL_LENS_AU,
        color: "#93d7ff",
        opacity: 0.52,
        dashSize: 12,
        gapSize: 8,
        segments: 180
      }
    ];

    const shellRuntimes = [];

    for (const shell of shellConfigs) {
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
        flowDirection: shell.distortion?.flowDirection
          ? shell.distortion.flowDirection.clone()
          : null,
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

  function updateHeliosphereShells(shellRuntimes, camera, elapsedSeconds = 0) {
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
          Math.max(0, 1 - (runtime.radius * runtime.radius) / (distanceToCenter * distanceToCenter))
        );

      runtime.circleCenter.copy(runtime.center).addScaledVector(runtime.viewDirection, -planeOffset);

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

  function createGuideCylinder(guideLine, points) {
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
      Array.isArray(guideLine.cylinderDashPattern) && guideLine.cylinderDashPattern.length >= 2;
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
    sideGeometryA.setAttribute("position", new THREE.BufferAttribute(sideLinePositionsA, 3));
    sideGeometryB.setAttribute("position", new THREE.BufferAttribute(sideLinePositionsB, 3));
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
      viewDirectionPerpendicular
        .copy(axisDirection)
        .multiplyScalar(viewAxisDot);
      viewDirectionPerpendicular.subVectors(
        viewDirection,
        viewDirectionPerpendicular
      );

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
  }

  function updateGuideLineVisuals(guideLineRuntimes, camera) {
    for (const runtime of guideLineRuntimes) {
      if (typeof runtime.update === "function") {
        runtime.update(camera);
      }
    }
  }

  function buildGuideLines(sceneData, guideLineGroup, guideLineRuntimes) {
    for (const guideLine of sceneData.directionalGuideLines) {
      const points = guideLine.points.map(
        (point) => new THREE.Vector3(point.x, point.y, point.z)
      );
      const isCylinder = guideLine.renderStyle === "cylinder";

      if (isCylinder) {
        const cylinderRuntime = createGuideCylinder(guideLine, points);
        if (!cylinderRuntime) continue;
        guideLineGroup.add(cylinderRuntime.object);
        guideLineRuntimes.push({
          tag: guideLine.tag || null,
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
      guideLineRuntimes.push({ tag: guideLine.tag || null, object: line });
    }
  }

  function setupHudControls(
    state,
    controls,
    guideLineRuntimes,
    labelsLayer,
    camera,
    math
  ) {
    const zoomToggleButton = document.getElementById("zoom-toggle");
    const namesToggleButton = document.getElementById("names-toggle");
    const guideLineToggleButton = document.getElementById("guide-line-toggle");

    function updateBooleanToggleLabel(button, isEnabled, enabledLabel, disabledLabel) {
      if (!button) return;
      button.textContent = isEnabled ? enabledLabel : disabledLabel;
      button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
    }

    function cameraDistance() {
      return camera.position.distanceTo(controls.target);
    }

    function updateZoomToggleLabel() {
      if (!zoomToggleButton) return;
      zoomToggleButton.textContent =
        Math.abs(cameraDistance() - state.minCamera) < 1e-3
          ? "Maximum Zoom"
          : "Minimum Zoom";
    }

    function setCameraDistance(distanceAu) {
      const clamped = math.clamp(distanceAu, state.minCamera, state.maxCamera);
      const direction = camera.position.clone().sub(controls.target).normalize();
      camera.position.copy(controls.target).addScaledVector(direction, clamped);
      controls.update();
    }

    if (zoomToggleButton) {
      zoomToggleButton.addEventListener("click", () => {
        const targetDistance =
          Math.abs(cameraDistance() - state.minCamera) < 1e-3
            ? state.maxCamera
            : state.minCamera;
        setCameraDistance(targetDistance);
        updateZoomToggleLabel();
      });
    }

    if (namesToggleButton) {
      namesToggleButton.addEventListener("click", () => {
        state.showBodyNames = !state.showBodyNames;
        labelsLayer.style.display = state.showBodyNames ? "block" : "none";
        updateBooleanToggleLabel(
          namesToggleButton,
          state.showBodyNames,
          "Hide Body Names",
          "Show Body Names"
        );
      });

      updateBooleanToggleLabel(
        namesToggleButton,
        state.showBodyNames,
        "Hide Body Names",
        "Show Body Names"
      );
    }

    if (guideLineToggleButton) {
      guideLineToggleButton.addEventListener("click", () => {
        state.showDirectionalGuides = !state.showDirectionalGuides;
        applyGuideLineVisibility(state, guideLineRuntimes);
        updateBooleanToggleLabel(
          guideLineToggleButton,
          state.showDirectionalGuides,
          "Hide Lines",
          "Show Lines"
        );
      });

      updateBooleanToggleLabel(
        guideLineToggleButton,
        state.showDirectionalGuides,
        "Hide Lines",
        "Show Lines"
      );
    }

    controls.addEventListener("change", updateZoomToggleLabel);
    updateZoomToggleLabel();

    return {
      updateZoomToggleLabel
    };
  }

  function applyGuideLineVisibility(state, guideLineRuntimes) {
    for (const runtime of guideLineRuntimes) {
      runtime.object.visible = state.showDirectionalGuides;
    }
  }

  function setInitialCameraPlacement(camera, controls, constants, state, math) {
    const fitDistance =
      (constants.SCENE_OUTER_AU / Math.tan(THREE.MathUtils.degToRad(camera.fov) * 0.5)) /
      Math.max(0.05, constants.SCENE_SCREEN_RADIUS_RATIO);

    const initialDistance = math.clamp(
      fitDistance * constants.INITIAL_SCENE_FIT_MULTIPLIER,
      state.minCamera,
      state.maxCamera
    );

    const yaw = -0.55;
    const pitch = 0.35;
    const cosPitch = Math.cos(pitch);

    camera.position.set(
      Math.sin(yaw) * cosPitch * initialDistance,
      Math.sin(pitch) * initialDistance,
      Math.cos(yaw) * cosPitch * initialDistance
    );

    controls.target.set(0, 0, 0);
    camera.lookAt(controls.target);
    controls.update();
  }
})();
