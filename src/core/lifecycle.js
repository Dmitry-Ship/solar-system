(() => {
  const namespace = window.SolarSystem;
  if (!namespace || !namespace.core) {
    throw new Error("lifecycle bootstrap failed: missing core namespace.");
  }

  class FrameScheduler {
    constructor(onFrame) {
      this.onFrame = onFrame;
      this.requestId = 0;
      this.lastTimestamp = 0;
      this.isRunning = false;
      this.elapsedSeconds = 0;
      this.maxDeltaSeconds = 0.05;
      this.boundTick = this.tick.bind(this);
    }

    start() {
      if (this.isRunning) return;
      this.isRunning = true;
      this.lastTimestamp = 0;
      this.elapsedSeconds = 0;
      this.requestId = window.requestAnimationFrame(this.boundTick);
    }

    stop() {
      if (!this.isRunning) return;
      this.isRunning = false;
      if (this.requestId) {
        window.cancelAnimationFrame(this.requestId);
        this.requestId = 0;
      }
    }

    tick(timestampMs) {
      if (!this.isRunning) return;

      if (!this.lastTimestamp) {
        this.lastTimestamp = timestampMs;
      }

      const deltaSeconds = Math.min(
        this.maxDeltaSeconds,
        Math.max(0, (timestampMs - this.lastTimestamp) / 1000)
      );
      this.lastTimestamp = timestampMs;
      this.elapsedSeconds += deltaSeconds;

      if (typeof this.onFrame === "function") {
        this.onFrame(deltaSeconds, this.elapsedSeconds);
      }

      this.requestId = window.requestAnimationFrame(this.boundTick);
    }
  }

  namespace.core.FrameScheduler = FrameScheduler;
})();
