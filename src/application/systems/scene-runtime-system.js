(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.application || !namespace.application.systems) {
    throw new Error(
      "scene runtime system bootstrap failed: missing application systems namespace."
    );
  }

  class SceneRuntimeSystem {
    constructor(options = {}) {
      const THREE = options.THREE || window.THREE;
      if (!THREE) {
        throw new Error("SceneRuntimeSystem: THREE is required.");
      }

      this.THREE = THREE;
      this.scene = options.scene;
      this.constants = options.constants;
      this.math = options.math;
      this.bodyRenderer = options.bodyRenderer;
      this.orbitRenderer = options.orbitRenderer;
      this.particleRenderer = options.particleRenderer;
      this.guideRenderer = options.guideRenderer;
      this.postprocessingRenderer = options.postprocessingRenderer;

      this.orbitGroup = null;
      this.guideLineGroup = null;
      this.particleGroup = null;
      this.bodyGroup = null;
      this.bodyGeometry = null;
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.visibilityRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];
    }

    createSceneGroups() {
      const { THREE } = this;
      return {
        orbitGroup: new THREE.Group(),
        guideLineGroup: new THREE.Group(),
        particleGroup: new THREE.Group(),
        bodyGroup: new THREE.Group()
      };
    }

    initialize() {
      Object.assign(this, this.createSceneGroups());
      this.scene.add(this.orbitGroup);
      this.scene.add(this.guideLineGroup);
      this.scene.add(this.particleGroup);
      this.scene.add(this.bodyGroup);

      this.bodyGeometry = new this.THREE.SphereGeometry(1, 20, 12);
      this.sceneObjectRuntimes = [];
      this.guideRuntimes = [];
      this.visibilityRuntimes = [];
      this.beltRuntimes = [];
      this.orbitingBodies = [];
      return this;
    }

    build(sceneData) {
      this.particleRenderer.buildStarField(sceneData, this.particleGroup);
      this.particleRenderer.buildOortCloud(sceneData, this.particleGroup);
      this.guideRenderer.buildGuideLines(
        sceneData,
        this.guideLineGroup,
        this.guideRuntimes,
        this.sceneObjectRuntimes,
        this.visibilityRuntimes
      );
      this.particleRenderer.buildAsteroidBelts(
        sceneData,
        this.particleGroup,
        this.beltRuntimes,
        this.math
      );
      this.orbitRenderer.buildOrbitingBodies(
        sceneData,
        this.orbitGroup,
        this.bodyGroup,
        this.bodyGeometry,
        this.sceneObjectRuntimes,
        this.orbitingBodies,
        this.math
      );
      this.bodyRenderer.buildFixedBodies(
        sceneData,
        this.bodyGroup,
        this.bodyGeometry,
        this.sceneObjectRuntimes
      );
      this.createSunRuntime();
      return this;
    }

    createSunRuntime() {
      const sunRuntime = this.bodyRenderer.createBodyRuntime(
        {
          name: "Sun",
          color: "#ffce6b",
          renderRadius: this.constants.SUN_RADIUS_KM / this.constants.KM_PER_AU,
          minPixelRadius: 2.6,
          fixedPosition: { x: 0, y: 0, z: 0 },
          emissive: true
        },
        this.bodyGroup,
        this.bodyGeometry
      );
      this.sceneObjectRuntimes.push(sunRuntime);
      this.postprocessingRenderer.markBloomObject(sunRuntime.mesh);
    }
  }

  namespace.application.systems.SceneRuntimeSystem = SceneRuntimeSystem;
})();
