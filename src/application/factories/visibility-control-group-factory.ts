import type {
  VisibilityGroupKey,
  VisibilityKey,
  VisibilityRuntime
} from "../../types/solar-system";

export interface VisibilityControl {
  key: VisibilityKey;
  label: string;
  initialVisibility: boolean;
  groupKey: VisibilityGroupKey;
}

export interface VisibilityControlGroup {
  key: VisibilityGroupKey;
  label: string;
  controls: VisibilityControl[];
}

interface VisibilityControlGroupDraft {
  key: VisibilityGroupKey;
  label: string;
  controlsByKey: Map<VisibilityKey, VisibilityControl>;
}

export class VisibilityControlGroupFactory {
  create(visibilityRuntimes: VisibilityRuntime[] = []): VisibilityControlGroup[] {
    const groupsByKey = new Map<VisibilityGroupKey, VisibilityControlGroupDraft>();

    for (const runtime of visibilityRuntimes) {
      const visibilityKey =
        typeof runtime?.visibilityKey === "string" ? runtime.visibilityKey.trim() : "";
      if (!visibilityKey) continue;

      const groupKey =
        typeof runtime?.visibilityGroupKey === "string" && runtime.visibilityGroupKey.trim()
          ? runtime.visibilityGroupKey.trim()
          : "visibility";
      const groupLabel =
        typeof runtime?.visibilityGroupLabel === "string" && runtime.visibilityGroupLabel.trim()
          ? runtime.visibilityGroupLabel.trim()
          : "Visibility";
      const controlLabel =
        typeof runtime?.visibilityControlLabel === "string" &&
        runtime.visibilityControlLabel.trim()
          ? runtime.visibilityControlLabel.trim()
          : typeof runtime?.visibilityLabel === "string" && runtime.visibilityLabel.trim()
            ? runtime.visibilityLabel.trim()
            : visibilityKey;

      if (!groupsByKey.has(groupKey)) {
        groupsByKey.set(groupKey, {
          key: groupKey,
          label: groupLabel,
          controlsByKey: new Map()
        });
      }

      const group = groupsByKey.get(groupKey);
      if (!group) continue;
      if (group.controlsByKey.has(visibilityKey)) continue;

      group.controlsByKey.set(visibilityKey, {
        key: visibilityKey,
        label: controlLabel,
        initialVisibility: runtime.initialVisibility ?? runtime.defaultVisible ?? false,
        groupKey
      });
    }

    return Array.from(groupsByKey.values()).map((group): VisibilityControlGroup => ({
      key: group.key,
      label: group.label,
      controls: Array.from(group.controlsByKey.values())
    }));
  }
}
