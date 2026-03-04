(() => {
  const namespace = window.SolarSystem;
  const BaseScheduler = namespace?.core?.FrameScheduler;
  if (!namespace || !BaseScheduler) {
    throw new Error("frame-loop bootstrap failed: missing FrameScheduler.");
  }

  class FrameLoop extends BaseScheduler {}

  namespace.runtime.FrameLoop = FrameLoop;
})();
