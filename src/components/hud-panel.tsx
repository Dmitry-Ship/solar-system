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
  zoomToggleLabel: "Minimum Zoom",
  namesToggleLabel: "Show Body Names",
  orbitsToggleLabel: "Hide Orbits",
  showBodyNames: false,
  showOrbits: true,
  visibilityControlGroups: []
};

export function HudPanel({
  snapshot,
  onToggleZoom,
  onToggleNames,
  onToggleOrbits,
  onToggleVisibility
}: HudPanelProps) {
  const hud = snapshot ?? FALLBACK_HUD_SNAPSHOT;

  return (
    <section className="hud" aria-label="Instructions">
      <div className="hud-controls">
        <button id="zoom-toggle" className="zoom-button" type="button" onClick={onToggleZoom}>
          Switch to {hud.zoomToggleLabel}
        </button>
        <button
          id="names-toggle"
          className="zoom-button"
          type="button"
          aria-pressed={hud.showBodyNames}
          onClick={onToggleNames}
        >
          {hud.namesToggleLabel}
        </button>
        <button
          id="orbits-toggle"
          className="zoom-button"
          type="button"
          aria-pressed={hud.showOrbits}
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
                  className="zoom-button"
                  type="button"
                  data-visibility-key={control.key}
                  aria-pressed={control.isVisible}
                  onClick={() => onToggleVisibility(control.key)}
                >
                  {control.isVisible ? `Hide ${control.label}` : `Show ${control.label}`}
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
