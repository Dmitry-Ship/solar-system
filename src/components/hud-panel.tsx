import type { HudSnapshot } from "../infrastructure/dom/hud-controller";
import type { PovTargetKey, VisibilityKey } from "../types/solar-system";

interface HudPanelProps {
  snapshot: HudSnapshot;
  onSetPov: (pov: PovTargetKey) => void;
  onToggleZoom: () => void;
  onToggleNames: () => void;
  onToggleOrbits: () => void;
  onToggleVisibility: (key: VisibilityKey) => void;
}

const POV_OPTIONS: PovTargetKey[] = ["sun", "earth", "61 Cygni"];

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
  onSetPov,
  onToggleZoom,
  onToggleNames,
  onToggleOrbits,
  onToggleVisibility
}: HudPanelProps) {
  return (
    <section className="hud" aria-label="Scene controls">
      <div className="hud-controls">
        <button
          id="zoom-toggle"
          className="hud-button"
          type="button"
          aria-pressed={snapshot.isZoomedIn}
          data-state={snapshot.isZoomedIn ? "near" : "far"}
          title={`Zoom: ${snapshot.zoomToggleLabel}`}
          onClick={onToggleZoom}
        >
          {snapshot.zoomToggleLabel}
        </button>
        <button
          id="names-toggle"
          className="hud-button"
          type="button"
          aria-pressed={snapshot.showBodyNames}
          title={`Names ${snapshot.showBodyNames ? "on" : "off"}`}
          onClick={onToggleNames}
        >
          {snapshot.namesToggleLabel}
        </button>
        <button
          id="orbits-toggle"
          className="hud-button"
          type="button"
          aria-pressed={snapshot.showOrbits}
          title={`Orbits ${snapshot.showOrbits ? "on" : "off"}`}
          onClick={onToggleOrbits}
        >
          {snapshot.orbitsToggleLabel}
        </button>
      </div>
      <fieldset className="hud-control-group hud-radio-group">
        <legend className="hud-control-heading">POV</legend>
        <div className="hud-radio-options">
          {POV_OPTIONS.map((option) => {
            const isChecked = snapshot.currentPov === option;

            return (
              <label
                key={option}
                className="hud-radio-option"
                data-checked={isChecked}
              >
                <input
                  className="hud-radio-input"
                  type="radio"
                  name="scene-pov"
                  value={option}
                  checked={isChecked}
                  onChange={() => onSetPov(option)}
                />
                <span>{option}</span>
              </label>
            );
          })}
        </div>
      </fieldset>
      <div id="visibility-controls-root" aria-label="Visibility controls">
        {snapshot.visibilityControlGroups.map((group) => (
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
