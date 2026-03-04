(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  const BLOOM_LAYER_INDEX = 1;

  app.createSelectiveBloomRenderer = function createSelectiveBloomRenderer(config) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("createSelectiveBloomRenderer: missing THREE.");
    }

    const bloomLayer = new THREE.Layers();
    bloomLayer.set(BLOOM_LAYER_INDEX);

    const savedVisibility = Object.create(null);

    const bloomComposer = new THREE.EffectComposer(config.renderer);
    bloomComposer.renderToScreen = false;
    bloomComposer.addPass(new THREE.RenderPass(config.scene, config.camera));
    const bloomPass = new THREE.UnrealBloomPass(
      new THREE.Vector2(config.width, config.height),
      config.bloomStrength,
      config.bloomRadius,
      config.bloomThreshold
    );
    bloomComposer.addPass(bloomPass);

    const mixPass = new THREE.ShaderPass(
      new THREE.ShaderMaterial({
        uniforms: {
          baseTexture: { value: null },
          bloomTexture: { value: bloomComposer.renderTarget2.texture }
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

    const finalComposer = new THREE.EffectComposer(config.renderer);
    finalComposer.addPass(new THREE.RenderPass(config.scene, config.camera));
    finalComposer.addPass(mixPass);

    function hideNonBloomObjects(object) {
      if (!object || !object.material || bloomLayer.test(object.layers)) {
        return;
      }

      savedVisibility[object.uuid] = object.visible;
      object.visible = false;
    }

    function restoreVisibility(object) {
      if (!Object.prototype.hasOwnProperty.call(savedVisibility, object.uuid)) {
        return;
      }

      object.visible = savedVisibility[object.uuid];
      delete savedVisibility[object.uuid];
    }

    return {
      markBloomObject(object3d) {
        if (object3d && object3d.layers) {
          object3d.layers.enable(BLOOM_LAYER_INDEX);
        }
      },

      render() {
        config.scene.traverse(hideNonBloomObjects);
        bloomComposer.render();
        config.scene.traverse(restoreVisibility);
        finalComposer.render();
      },

      setSize(width, height) {
        bloomComposer.setSize(width, height);
        finalComposer.setSize(width, height);
      },

      setPixelRatio(pixelRatio) {
        if (typeof bloomComposer.setPixelRatio === "function") {
          bloomComposer.setPixelRatio(pixelRatio);
        }

        if (typeof finalComposer.setPixelRatio === "function") {
          finalComposer.setPixelRatio(pixelRatio);
        }
      }
    };
  };
})();
