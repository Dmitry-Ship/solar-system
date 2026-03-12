import { namespace } from "../../core/namespace";
import type { MathApi, SimulationConstants, VisibilityStateLike } from "../../types/solar-system";
import type { PerspectiveCamera } from "three";

const SCENE_SCREEN_RADIUS_RATIO = 0.44;
const INITIAL_SCENE_FIT_MULTIPLIER = 1.08;
const MIN_SCENE_SCREEN_RADIUS_RATIO = 0.05;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

interface CameraFitOptions {
  camera: PerspectiveCamera;
  state: Pick<VisibilityStateLike, "minCamera" | "maxCamera">;
  constants: SimulationConstants;
  math?: Pick<MathApi, "clamp">;
}

export function computeInitialCameraDistance({
  camera,
  state,
  constants,
  math
}: CameraFitOptions): number {
    const fitDistance =
      (constants.SCENE_OUTER_AU / Math.tan((camera.fov * Math.PI) / 360)) /
      Math.max(MIN_SCENE_SCREEN_RADIUS_RATIO, SCENE_SCREEN_RADIUS_RATIO);
    const clampValue = typeof math?.clamp === "function" ? math.clamp : clamp;

    return clampValue(
      fitDistance * INITIAL_SCENE_FIT_MULTIPLIER,
      state.minCamera,
      state.maxCamera
    );
}

namespace.application.services.computeInitialCameraDistance = computeInitialCameraDistance;
