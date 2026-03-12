import { namespace } from "../../core/namespace";

  const SCENE_SCREEN_RADIUS_RATIO = 0.44;
  const INITIAL_SCENE_FIT_MULTIPLIER = 1.08;
  const MIN_SCENE_SCREEN_RADIUS_RATIO = 0.05;

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

export function computeInitialCameraDistance({ camera, state, constants, math }) {
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
