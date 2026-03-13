export interface LabelOptions {
  objectType?: string;
}

export interface LabelLayerLike {
  createLabel(text: string, options?: LabelOptions): HTMLDivElement | null;
}

export class LabelsLayer implements LabelLayerLike {
  private layerElement: HTMLDivElement | null = null;

  createLayer(): HTMLDivElement {
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

  createLabel(text: string, options: LabelOptions = {}): HTMLDivElement {
    const layerElement = this.layerElement ?? this.createLayer();
    const label = document.createElement("div");
    label.className = "body-label";
    label.textContent = text;
    const objectType =
      typeof options.objectType === "string" ? options.objectType.trim() : "";
    if (objectType) {
      label.dataset.objectType = objectType;
    }
    layerElement.appendChild(label);
    return label;
  }
}
