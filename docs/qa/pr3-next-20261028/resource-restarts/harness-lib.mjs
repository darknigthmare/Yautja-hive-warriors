import assert from 'node:assert/strict';
import { resolve } from 'node:path';

export function parseOptions(argv) {
  const options = { expectedIndex: null, expectedSource: null, output: null, warmups: 5, measured: 10, port: 4329 };
  for (let index = 0; index < argv.length; index++) {
    const argument = argv[index];
    if (argument === '--expected-index') options.expectedIndex = argv[++index];
    else if (argument === '--expected-source') options.expectedSource = argv[++index];
    else if (argument === '--output') { const value = argv[++index]; assert.ok(value, 'Explicit output path required'); options.output = resolve(value); }
    else if (argument === '--warmups') options.warmups = Number(argv[++index]);
    else if (argument === '--port') options.port = Number(argv[++index]);
    else throw new Error('Unknown option: ' + argument);
  }
  assert.match(options.expectedIndex ?? '', /^[a-f0-9]{64}$/, 'ROOT must supply the final index SHA256 before any browser launch');
  assert.match(options.expectedSource ?? '', /^[a-f0-9]{40}$/, 'ROOT must supply the final source commit before any browser launch');
  assert.ok(options.output, 'Explicit output path required');
  assert.ok(Number.isInteger(options.warmups) && options.warmups >= 2 && options.warmups <= 20, 'Warmups must be 2 to 20');
  assert.ok(Number.isInteger(options.port) && options.port > 1024 && options.port < 65536, 'Preview port must be valid');
  return options;
}

// Serialized into the page by Playwright. Keep references local and return
// only scalar status fields; fulfilled asset values can contain whole graphs.
export async function settleAssetPromises({ timeoutMs = 120000 } = {}) {
  let game = window.game, timer, results;
  const promises = [Promise.resolve(game.player.generatedVisualReady)];
  game.renderer.scene.traverse(node => {
    if (node._importedCreatureRequest?.ready) promises.push(node._importedCreatureRequest.ready);
  });
  const count = promises.length;
  try {
    results = await Promise.race([
      Promise.allSettled(promises),
      new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('Async asset settle deadline')), timeoutMs); })
    ]);
    return { awaitedPromises: count, settled: results.map(result => result.status), playerState: game.player.generatedVisualState,
      playerError: game.player.generatedVisualError ?? null };
  } finally {
    clearTimeout(timer); promises.length = 0; results = null; game = null;
  }
}

// Every long-lived resource reference below is weak. The only persistent
// texture identifiers are strings, never Three.js objects or fulfilled assets.
export function installResourceDiagnostics() {
  const q = window.__restartResourceQA = {
    seen: new WeakSet(), disposed: new WeakSet(), sharedByUuid: new Map(), textureDisposeUuids: new Set(),
    totals: { geometries: 0, materials: 0, textures: 0 }
  };
  q.onDispose = event => {
    const resource = event.target;
    if (q.disposed.has(resource)) return;
    q.disposed.add(resource);
    if (resource.isBufferGeometry) q.totals.geometries++;
    else if (resource.isMaterial) q.totals.materials++;
    else if (resource.isTexture) {
      q.totals.textures++;
      if (q.sharedByUuid.has(resource.uuid)) q.textureDisposeUuids.add(resource.uuid);
    }
  };
  q.observe = resource => {
    if (!resource?.addEventListener || q.seen.has(resource)) return;
    q.seen.add(resource); resource.addEventListener('dispose', q.onDispose);
  };
  q.textureState = (uuid, texture) => ({ uuid, alive: Boolean(texture), name: texture?.name ?? null,
    width: texture?.image?.width ?? texture?.image?.data?.width ?? null,
    height: texture?.image?.height ?? texture?.image?.data?.height ?? null,
    observedDisposed: q.textureDisposeUuids.has(uuid),
    gpuAllocated: Boolean(texture && !q.disposed.has(texture) && window.game.renderer.renderer.properties.get(texture).__webglTexture) });
  q.sample = label => {
    const g = window.game, scene = g.renderer.scene, geometries = new Set(), materials = new Set(), textures = new Set();
    let nodes = 0, renderableNodes = 0;
    function material(value) {
      if (!value) return;
      materials.add(value); q.observe(value);
      for (const item of Object.values(value)) if (item?.isTexture) { textures.add(item); q.observe(item); }
      for (const uniform of Object.values(value.uniforms ?? {})) if (uniform?.value?.isTexture) { textures.add(uniform.value); q.observe(uniform.value); }
    }
    scene.traverse(node => {
      nodes++; if (node.isMesh || node.isLine || node.isPoints) renderableNodes++;
      if (node.geometry) { geometries.add(node.geometry); q.observe(node.geometry); }
      for (const value of Array.isArray(node.material) ? node.material : [node.material]) material(value);
    });
    const imported = new Map();
    for (const value of g.player?._importedCharacter?.adapter?.materials ?? []) {
      for (const texture of Object.values(value)) if (texture?.isTexture) {
        imported.set(texture.uuid, texture); q.observe(texture); q.sharedByUuid.set(texture.uuid, new WeakRef(texture));
      }
    }
    const info = g.renderer.renderer.info;
    return {
      label, playing: g.isPlaying, paused: g.isPaused, playerPresent: Boolean(g.player), playerHP: g.player?.hp ?? null,
      generatedState: g.player?.generatedVisualState ?? null, generatedError: g.player?.generatedVisualError ?? null,
      alienTypes: g.horde.aliens.map(actor => actor.type),
      scene: { children: scene.children.length, nodes, renderableNodes, geometries: geometries.size, materials: materials.size, textures: textures.size },
      gpuCounters: { geometries: info.memory.geometries, textures: info.memory.textures, programs: info.programs?.length ?? 0 },
      render: { calls: info.render.calls, triangles: info.render.triangles },
      sharedImportedTextures: [...imported].map(([uuid, texture]) => q.textureState(uuid, texture)).sort((a, b) => a.uuid.localeCompare(b.uuid)),
      sharedCachedTextures: [...q.sharedByUuid].map(([uuid, ref]) => q.textureState(uuid, ref.deref())).sort((a, b) => a.uuid.localeCompare(b.uuid)),
      disposeEvents: { ...q.totals },
      hordeCachedPlayers: g.horde._livingPlayers?.length ?? 0,
      liveActors: {
        aliens: g.horde.getActiveCombatants().length, allies: g.allies.allies.length, marines: g.marines.marines.length,
        synthetics: g.synthetics.androids.length, hounds: g.hellHounds.hounds.length,
        bosses: g.bosses.getActiveBosses?.().length ?? Number(Boolean(g.bosses.activeBoss)), badBlood: Number(Boolean(g.badBlood.badBlood))
      },
      pending: { spawns: g.horde.pendingSpawnCount ?? g.horde.pendingSpawns?.length ?? 0,
        projectiles: g.projectiles?.length ?? 0, missionTasks: g.missionTasks?.length ?? 0,
        dropshipStrikes: g.dropship.pendingStrikes.length, dropshipRockets: g.dropship.microRockets.length,
        dropshipNapalm: g.dropship.napalmPools.length, apcActive: Boolean(g.apc.getCombatant()),
        environmentGeometries: g.env.geometries?.length ?? null, environmentMaterials: g.env.materials?.length ?? null }
    };
  };
}

export function trend(values) {
  assert.ok(values.length > 0 && values.every(Number.isFinite), 'Trend requires finite measurements');
  const changes = values.slice(1).map((value, index) => value - values[index]);
  return { values, min: Math.min(...values), max: Math.max(...values), firstToLast: values.at(-1) - values[0],
    growthSteps: changes.filter(value => value > 0).length, allTenStable: values.every(value => value === values[0]) };
}

export function assessCycles(cycles, measuredCount = 10) {
  const measured = cycles.filter(cycle => cycle.phase === 'measured');
  assert.equal(measured.length, measuredCount, 'All ten measured restarts are required');
  assert.ok(measured.every(cycle => cycle.status === 'completed'), 'A measured restart did not complete');
  const trends = {};
  for (const key of ['geometries', 'textures', 'programs']) trends['gpu' + key[0].toUpperCase() + key.slice(1)] = trend(measured.map(cycle => cycle.cleanupSettled.gpuCounters[key]));
  for (const key of ['children', 'nodes', 'renderableNodes', 'geometries', 'materials', 'textures']) trends['scene' + key[0].toUpperCase() + key.slice(1)] = trend(measured.map(cycle => cycle.cleanupSettled.scene[key]));
  const textureUuids = measured[0].active.sharedImportedTextures.map(texture => texture.uuid).sort();
  assert.ok(textureUuids.length > 0, 'At least one actual imported texture must be rendered');
  const validTexture = texture => texture?.alive && texture.width > 0 && texture.height > 0 && texture.gpuAllocated && !texture.observedDisposed;
  const texturesResident = measured.every(cycle => {
    const active = cycle.active.sharedImportedTextures;
    return JSON.stringify(active.map(texture => texture.uuid).sort()) === JSON.stringify(textureUuids) && active.every(validTexture) &&
      textureUuids.every(uuid => validTexture(cycle.cleanupSettled.sharedCachedTextures.find(texture => texture.uuid === uuid)));
  });
  const playersReleased = measured.every(cycle => cycle.cleanupSettled.hordeCachedPlayers === 0 && !cycle.cleanupSettled.playerPresent &&
    !cycle.cleanupSettled.playing && Object.values(cycle.cleanupSettled.liveActors).every(count => count === 0));
  const countersStable = Object.values(trends).every(value => value.allTenStable);
  const heaps = measured.map(cycle => cycle.cpuHeap?.usedSize);
  const heap = heaps.every(Number.isFinite) ? { ...trend(heaps), kind: 'CPU JavaScript heap after forced CDP GC; not VRAM, RSS or ordinary play usage',
    firstToLastPercent: (heaps.at(-1) - heaps[0]) / heaps[0] * 100,
    assessment: heaps.at(-1) > heaps[0] ? 'positive_delta_observed_no_general_leak_claim' : 'no_positive_endpoint_delta_no_general_leak_claim' } :
    { available: false, assessment: 'heap_unavailable_no_memory_claim' };
  return { countersStable, texturesResident, playersReleased, textureUuids, trends, cpuHeapAfterGC: heap,
    passedResourceCriterion: countersStable && texturesResident && playersReleased };
}
