(() => {
  const namespace = window.SolarSystem;
  if (
    !namespace ||
    !namespace.infrastructure ||
    !namespace.infrastructure.three ||
    !namespace.infrastructure.three.renderers
  ) {
    throw new Error("postprocessing renderer bootstrap failed: missing three renderers namespace.");
  }

  const BLOOM_LAYER_INDEX = 1;

  class PostprocessingRenderer {
    constructor(config) {
      const THREE = config.THREE || window.THREE;
      if (!THREE) {
        throw new Error("PostprocessingRenderer: missing THREE.");
      }

      this.THREE = THREE;
      this.config = config;
      this.bloomLayer = new THREE.Layers();
      this.bloomLayer.set(BLOOM_LAYER_INDEX);
      this.savedVisibility = Object.create(null);

      this.bloomComposer = new THREE.EffectComposer(config.renderer);
      this.bloomComposer.renderToScreen = false;
      this.bloomComposer.addPass(new THREE.RenderPass(config.scene, config.camera));
      const bloomPass = new THREE.UnrealBloomPass(
        new THREE.Vector2(config.width, config.height),
        config.bloomStrength,
        config.bloomRadius,
        config.bloomThreshold
      );
      this.bloomComposer.addPass(bloomPass);

      const mixPass = new THREE.ShaderPass(
        new THREE.ShaderMaterial({
          uniforms: {
            baseTexture: { value: null },
            bloomTexture: { value: this.bloomComposer.renderTarget2.texture }
          },
          vertexShader: `
            varying vec2 vUv;

            void main() {
              vUv = uv;
              gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
          `,
          fragmentShader: `
            uniform sampler2D baseTexture;
            uniform sampler2D bloomTexture;

            varying vec2 vUv;

            void main() {
              gl_FragColor = texture2D(baseTexture, vUv) + vec4(1.0) * texture2D(bloomTexture, vUv);
            }
          `,
          defines: {}
        }),
        "baseTexture"
      );
      mixPass.needsSwap = true;

      this.finalComposer = new THREE.EffectComposer(config.renderer);
      this.finalComposer.addPass(new THREE.RenderPass(config.scene, config.camera));
      this.finalComposer.addPass(mixPass);

      this.hideNonBloomObjects = this.hideNonBloomObjects.bind(this);
      this.restoreVisibility = this.restoreVisibility.bind(this);
    }

    hideNonBloomObjects(object) {
      if (!object || !object.material || this.bloomLayer.test(object.layers)) {
        return;
      }

      this.savedVisibility[object.uuid] = object.visible;
      object.visible = false;
    }

    restoreVisibility(object) {
      if (!Object.prototype.hasOwnProperty.call(this.savedVisibility, object.uuid)) {
        return;
      }

      object.visible = this.savedVisibility[object.uuid];
      delete this.savedVisibility[object.uuid];
    }

    markBloomObject(object3d) {
      if (object3d && object3d.layers) {
        object3d.layers.enable(BLOOM_LAYER_INDEX);
      }
    }

    render() {
      this.config.scene.traverse(this.hideNonBloomObjects);
      this.bloomComposer.render();
      this.config.scene.traverse(this.restoreVisibility);
      this.finalComposer.render();
    }

    setSize(width, height) {
      this.bloomComposer.setSize(width, height);
      this.finalComposer.setSize(width, height);
    }

    setPixelRatio(pixelRatio) {
      if (typeof this.bloomComposer.setPixelRatio === "function") {
        this.bloomComposer.setPixelRatio(pixelRatio);
      }

      if (typeof this.finalComposer.setPixelRatio === "function") {
        this.finalComposer.setPixelRatio(pixelRatio);
      }
    }
  }

  namespace.infrastructure.three.renderers.PostprocessingRenderer = PostprocessingRenderer;
})();
