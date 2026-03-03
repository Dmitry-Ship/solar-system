(() => {
  const THREE = window.THREE;

  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", bootstrap, { once: true });
  } else {
    bootstrap();
  }

  function bootstrap() {
    assertThreeDependencies();

    const namespace = (window.SolarSystem = window.SolarSystem || {});
    const { constants, data, math, app } = namespace;

    if (!constants || !data || !math || !app) {
      throw new Error(
        "SolarSystem bootstrap failed: missing constants, data, math, or app modules."
      );
    }

    const requiredAppFunctions = [
      "normalizeAngle",
      "prepareSceneCaches",
      "createLabelsLayer",
      "createBodyRuntime",
      "buildStarField",
      "buildOortCloud",
      "buildHeliosphereShells",
      "buildGuideLines",
      "buildAsteroidBelts",
      "buildOrbitingBodies",
      "buildFixedBodies",
      "setupHudControls",
      "setInitialCameraPlacement",
      "updateHeliosphereShells",
      "updateGuideLineVisuals",
      "applyGuideLineVisibility",
      "createOrbitingBodiesUpdater",
      "createAsteroidBeltsUpdater",
      "createBodyVisualScaleAndLabelsUpdater"
    ];

    for (const functionName of requiredAppFunctions) {
      if (typeof app[functionName] !== "function") {
        throw new Error(`SolarSystem bootstrap failed: missing app.${functionName}.`);
      }
    }

    const canvas = document.getElementById("scene");
    if (!(canvas instanceof HTMLCanvasElement)) {
      throw new Error('Expected canvas element with id "scene".');
    }

    const sceneData = data.createSceneData();
    app.prepareSceneCaches(sceneData, constants, math);

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

    const labelsLayer = app.createLabelsLayer();

    scene.add(new THREE.AmbientLight("#ffffff", 0.5));
    scene.add(new THREE.PointLight("#ffd794", 1.2, 0, 0));

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

    app.buildStarField(sceneData, particleGroup);
    app.buildOortCloud(sceneData, particleGroup);
    const heliosphereShellRuntimes = app.buildHeliosphereShells(constants, shellGroup);
    app.buildGuideLines(
      sceneData,
      guideLineGroup,
      guideLineRuntimes,
      labelsLayer,
      bodyRuntimes
    );
    app.buildAsteroidBelts(
      sceneData,
      particleGroup,
      beltRuntimes,
      math,
      orbitalPositionScratch
    );
    app.buildOrbitingBodies(
      sceneData,
      orbitGroup,
      bodyGroup,
      bodyGeometry,
      bodyRuntimes,
      orbitalSourceBodies,
      labelsLayer,
      math
    );
    app.buildFixedBodies(
      sceneData,
      bodyGroup,
      bodyGeometry,
      bodyRuntimes,
      labelsLayer,
      constants
    );

    const sunRuntime = app.createBodyRuntime(
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

    const hud = app.setupHudControls(
      state,
      controls,
      guideLineRuntimes,
      labelsLayer,
      camera,
      math
    );

    app.setInitialCameraPlacement(camera, controls, constants, state, math);

    const motionTimeScale = 1;
    const updateOrbitingBodies = app.createOrbitingBodiesUpdater({
      orbitalSourceBodies,
      bodyRuntimes,
      math,
      normalizeAngle: app.normalizeAngle,
      orbitalPositionScratch,
      motionTimeScale
    });
    const updateAsteroidBelts = app.createAsteroidBeltsUpdater({
      beltRuntimes,
      math,
      normalizeAngle: app.normalizeAngle,
      orbitalPositionScratch,
      motionTimeScale
    });
    const updateBodyVisualScaleAndLabels = app.createBodyVisualScaleAndLabelsUpdater(
      {
        renderer,
        camera,
        bodyRuntimes,
        state,
        projectionScratch: new THREE.Vector3()
      }
    );

    const clock = new THREE.Clock();

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
      app.updateHeliosphereShells(heliosphereShellRuntimes, camera, clock.elapsedTime || 0);
      app.updateGuideLineVisuals(guideLineRuntimes, camera);
      updateBodyVisualScaleAndLabels();
      composer.render();
    }

    window.addEventListener("resize", resize);
    resize();
    app.applyGuideLineVisibility(state, guideLineRuntimes);
    animate();
  }

  function assertThreeDependencies() {
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
  }
})();
