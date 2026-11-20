// Reproduce warm actor construction; no renderer, browser, frame or GPU timing.
import { buildClanHunterModel, getClanHunterVisualCacheStats } from '../../../../js/graphics/ClanHunterModel.js';
import { disposeObject } from '../../../../js/engine/SceneResources.js';
const samples = [];
let coldMs;
for (let index = 0; index < 10; index++) {
  const start = performance.now(), root = buildClanHunterModel(index);
  const elapsed = performance.now() - start;
  if (index) samples.push(elapsed); else coldMs = elapsed;
  disposeObject(root);
}
const sorted = [...samples].sort((a, b) => a - b);
console.log(JSON.stringify({ measuredAt: new Date().toISOString(), node: process.version, platform: process.platform,
  kind: 'Synchronous CPU-side construction in the cloud Node process; excludes rendering and GPU.',
  beforeWarmObservedMs: [253.1187500000001, 226.76125599999978],
  beforeNote: 'Two observations of the uncached indexed/morph authoring path in this same workspace before optimization, not an FPS benchmark.',
  afterColdMs: coldMs, afterWarmMs: samples, afterWarmMedianMs: sorted[Math.floor(sorted.length / 2)],
  constantCpuTemplate: getClanHunterVisualCacheStats() }, null, 2));
