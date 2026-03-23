import type { HudSnapshot } from "../infrastructure/dom/hud-controller";
import type { VisibilityKey } from "../types/solar-system";

interface HudPanelProps {
  snapshot: HudSnapshot | null;
  onToggleZoom: () => void;
  onToggleNames: () => void;
  onToggleOrbits: () => void;
  onToggleVisibility: (key: VisibilityKey) => void;
}

const FALLBACK_HUD_SNAPSHOT: HudSnapshot = {
  zoomToggleLabel: "Far",
  isZoomedIn: false,
  namesToggleLabel: "Names",
  orbitsToggleLabel: "Orbits",
  showBodyNames: false,
  showOrbits: true,
  visibilityControlGroups: []
};

function formatVisibilityButtonLabel(label: string, groupKey: string): string {
  const trimmedLabel = label.trim();
  if (!trimmedLabel) {
    return "Item";
  }

  const compactLabel =
    groupKey === "trajectories"
      ? trimmedLabel.replace(/\s+trajectory$/i, "")
      : groupKey === "light-rays"
        ? trimmedLabel.replace(/\s+ray$/i, "")
        : trimmedLabel;

  return compactLabel.trim() || trimmedLabel;
}

export function HudPanel({
  snapshot,
  onToggleZoom,
  onToggleNames,
  onToggleOrbits,
  onToggleVisibility
}: HudPanelProps) {
  const hud = snapshot ?? FALLBACK_HUD_SNAPSHOT;

  return (
    <section className="hud" aria-label="Scene controls">
      <div className="hud-controls">
        <button
          id="zoom-toggle"
          className="hud-button"
          type="button"
          aria-pressed={hud.isZoomedIn}
          data-state={hud.isZoomedIn ? "near" : "far"}
          title={`Zoom: ${hud.zoomToggleLabel}`}
          onClick={onToggleZoom}
        >
          {hud.zoomToggleLabel}
        </button>
        <button
          id="names-toggle"
          className="hud-button"
          type="button"
          aria-pressed={hud.showBodyNames}
          title={`Names ${hud.showBodyNames ? "on" : "off"}`}
          onClick={onToggleNames}
        >
          {hud.namesToggleLabel}
        </button>
        <button
          id="orbits-toggle"
          className="hud-button"
          type="button"
          aria-pressed={hud.showOrbits}
          title={`Orbits ${hud.showOrbits ? "on" : "off"}`}
          onClick={onToggleOrbits}
        >
          {hud.orbitsToggleLabel}
        </button>
      </div>
      <div id="visibility-controls-root" aria-label="Visibility controls">
        {hud.visibilityControlGroups.map((group) => (
          <div
            key={group.key}
            className="hud-control-group"
            aria-label={`${group.label} controls`}
          >
            <div className="hud-control-heading">{group.label}</div>
            <div className="hud-controls">
              {group.controls.map((control) => (
                <button
                  key={control.key}
                  className="hud-button"
                  type="button"
                  data-visibility-key={control.key}
                  aria-pressed={control.isVisible}
                  title={`${group.label}: ${control.label} ${control.isVisible ? "on" : "off"}`}
                  onClick={() => onToggleVisibility(control.key)}
                >
                  {formatVisibilityButtonLabel(control.label, group.key)}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
