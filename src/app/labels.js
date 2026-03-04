(() => {
  const namespace = (window.SolarSystem = window.SolarSystem || {});
  const app = (namespace.app = namespace.app || {});

  app.createLabelsLayer = function createLabelsLayer() {
    const existingLayer = document.getElementById("labels-layer");
    if (existingLayer) {
      existingLayer.remove();
    }

    const layer = document.createElement("div");
    layer.id = "labels-layer";
    layer.setAttribute("aria-hidden", "true");
    document.body.appendChild(layer);
    return layer;
  };

  app.createLabelElement = function createLabelElement(layer, text, options = {}) {
    const label = document.createElement("div");
    label.className = "body-label";
    label.textContent = text;
    const objectType =
      typeof options.objectType === "string" ? options.objectType.trim() : "";
    if (objectType) {
      label.dataset.objectType = objectType;
    }
    layer.appendChild(label);
    return label;
  };

  app.createBodyVisualScaleAndLabelsUpdater = function createBodyVisualScaleAndLabelsUpdater(
    options
  ) {
    const THREE = window.THREE;
    if (!THREE) {
      throw new Error("createBodyVisualScaleAndLabelsUpdater: missing THREE.");
    }

    const { renderer, camera, bodyRuntimes, state } = options;
    const projectionScratch = options.projectionScratch || new THREE.Vector3();

    return function updateBodyVisualScaleAndLabels() {
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

        if (!runtime.labelElement) continue;

        if (
          (!state.showBodyNames && runtime.togglesWithNamesButton) ||
          (runtime.requiresDirectionalGuides && !state.showDirectionalGuides)
        ) {
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
    };
  };
})();
