(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.infrastructure || !namespace.infrastructure.dom) {
    throw new Error("labels layer bootstrap failed: missing infrastructure DOM namespace.");
  }

  class LabelsLayer {
    constructor() {
      this.layerElement = null;
    }

    createLayer() {
      const existingLayer = document.getElementById("labels-layer");
      if (existingLayer) {
        existingLayer.remove();
      }

      const layer = document.createElement("div");
      layer.id = "labels-layer";
      layer.setAttribute("aria-hidden", "true");
      document.body.appendChild(layer);
      this.layerElement = layer;
      return layer;
    }

    createLabel(text, options = {}) {
      if (!this.layerElement) {
        this.createLayer();
      }

      const label = document.createElement("div");
      label.className = "body-label";
      label.textContent = text;
      const objectType =
        typeof options.objectType === "string" ? options.objectType.trim() : "";
      if (objectType) {
        label.dataset.objectType = objectType;
      }
      this.layerElement.appendChild(label);
      return label;
    }
  }

  namespace.infrastructure.dom.LabelsLayer = LabelsLayer;
})();
