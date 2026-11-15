/* CPU wall time and complete-frame renderer counters. No GPU timing is inferred. */
export class FrameTelemetry {
  constructor({ capacity = 120, softwareRenderer = false } = {}) {
    this.capacity = Math.max(2, Math.min(600, Math.trunc(capacity) || 120));
    this.softwareRenderer = Boolean(softwareRenderer);
    this.samples = [];
    this.previousStart = null;
  }

  record({ startedAt, endedAt, render = {}, memory = {}, views = 1, postprocessing = false }) {
    if (![startedAt, endedAt].every(Number.isFinite) || endedAt < startedAt) return;
    const interval = this.previousStart === null ? null : startedAt - this.previousStart;
    // A suspended tab or menu is not a representative frame-time sample.
    if (interval !== null && (interval <= 0 || interval > 1000)) this.samples.length = 0;
    this.previousStart = startedAt;
    const nonnegative = value => Number.isFinite(value) ? Math.max(0, value) : 0;
    this.samples.push({ renderCpuMs: endedAt - startedAt, frameIntervalMs: interval > 0 && interval <= 1000 ? interval : null,
      calls: nonnegative(render.calls), triangles: nonnegative(render.triangles), lines: nonnegative(render.lines), points: nonnegative(render.points),
      geometries: nonnegative(memory.geometries), textures: nonnegative(memory.textures), views, postprocessing: Boolean(postprocessing) });
    if (this.samples.length > this.capacity) this.samples.shift();
  }

  snapshot() {
    const last = this.samples.at(-1);
    if (!last) return { samples: 0, softwareRenderer: this.softwareRenderer, gpuTimeAvailable: false };
    const intervals = this.samples.map(sample => sample.frameIntervalMs).filter(Number.isFinite).sort((a, b) => a - b);
    const mean = values => values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : null;
    const averageIntervalMs = mean(intervals);
    return { ...last, samples: this.samples.length, softwareRenderer: this.softwareRenderer, gpuTimeAvailable: false,
      averageRenderCpuMs: mean(this.samples.map(sample => sample.renderCpuMs)), averageIntervalMs,
      observedFps: averageIntervalMs ? 1000 / averageIntervalMs : null,
      p95FrameIntervalMs: intervals.length ? intervals[Math.ceil(intervals.length * .95) - 1] : null,
      counterScope: 'complete-frame-including-shadows-postprocessing-and-both-views' };
  }

  reset() { this.samples.length = 0; this.previousStart = null; }
}
