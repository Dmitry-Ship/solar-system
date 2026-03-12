import type {
  HudElements,
  VisibilityControlGroup,
  VisibilityControlRenderCallbacks
} from "../../types/solar-system";

interface HudViewOptions {
  document?: Document;
  zoomButtonId?: string;
  namesButtonId?: string;
  orbitsButtonId?: string;
  visibilityControlsRootId?: string;
}

export class HudView {
  private readonly document: Document;
  private readonly zoomButtonId: string;
  private readonly namesButtonId: string;
  private readonly orbitsButtonId: string;
  private readonly visibilityControlsRootId: string;

  constructor(options: HudViewOptions = {}) {
    this.document = options.document || document;
    this.zoomButtonId = options.zoomButtonId || "zoom-toggle";
    this.namesButtonId = options.namesButtonId || "names-toggle";
    this.orbitsButtonId = options.orbitsButtonId || "orbits-toggle";
    this.visibilityControlsRootId =
      options.visibilityControlsRootId || "visibility-controls-root";
  }

  private getButton(buttonId: string): HTMLButtonElement | null {
    const element = this.document.getElementById(buttonId);
    return element instanceof HTMLButtonElement ? element : null;
  }

  getElements(): HudElements {
    return {
      zoomToggleButton: this.getButton(this.zoomButtonId),
      namesToggleButton: this.getButton(this.namesButtonId),
      orbitToggleButton: this.getButton(this.orbitsButtonId),
      visibilityControlsRoot: this.document.getElementById(this.visibilityControlsRootId)
    };
  }

  setBooleanToggleLabel(
    button: HTMLButtonElement | null,
    isEnabled: boolean,
    enabledLabel: string,
    disabledLabel: string
  ): void {
    if (!button) return;
    button.textContent = isEnabled ? enabledLabel : disabledLabel;
    button.setAttribute("aria-pressed", isEnabled ? "true" : "false");
  }

  renderVisibilityControlGroups(
    visibilityControlGroups: VisibilityControlGroup[],
    { onRegisterControl, onToggleControl, isControlVisible }: VisibilityControlRenderCallbacks = {}
  ): void {
    const { visibilityControlsRoot } = this.getElements();
    if (!visibilityControlsRoot) return;

    visibilityControlsRoot.textContent = "";

    for (const visibilityControlGroup of visibilityControlGroups) {
      const groupElement = this.document.createElement("div");
      groupElement.className = "hud-control-group";
      groupElement.setAttribute("aria-label", `${visibilityControlGroup.label} controls`);

      const headingElement = this.document.createElement("div");
      headingElement.className = "hud-control-heading";
      headingElement.textContent = visibilityControlGroup.label;
      groupElement.appendChild(headingElement);

      const controlsElement = this.document.createElement("div");
      controlsElement.className = "hud-controls";

      for (const visibilityControl of visibilityControlGroup.controls) {
        onRegisterControl?.(visibilityControl);

        const button = this.document.createElement("button");
        button.className = "zoom-button";
        button.type = "button";
        button.dataset.visibilityKey = visibilityControl.key;
        button.setAttribute("aria-pressed", "false");
        button.addEventListener("click", () => {
          const isVisible = onToggleControl
            ? onToggleControl(visibilityControl)
            : Boolean(isControlVisible?.(visibilityControl));
          this.setBooleanToggleLabel(
            button,
            isVisible,
            `Hide ${visibilityControl.label}`,
            `Show ${visibilityControl.label}`
          );
        });

        this.setBooleanToggleLabel(
          button,
          Boolean(isControlVisible?.(visibilityControl)),
          `Hide ${visibilityControl.label}`,
          `Show ${visibilityControl.label}`
        );
        controlsElement.appendChild(button);
      }

      if (controlsElement.childElementCount === 0) continue;

      groupElement.appendChild(controlsElement);
      visibilityControlsRoot.appendChild(groupElement);
    }
  }
}
