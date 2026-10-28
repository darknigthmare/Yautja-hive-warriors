// Observation only: delegates every real draw unchanged, records scalar IDs,
// and removes disposed geometry entries. No persistent geometry references.
export function installGeometryTrace() {
  const renderer = window.game.renderer.renderer;
  const q = window.__geometryTrace = { cycle: 0, resident: new Map(), seen: new WeakSet(), newShared: [] };
  q.onDispose = event => { q.resident.delete(event.target.uuid); };
  const original = renderer.renderBufferDirect;
  renderer.renderBufferDirect = function (camera, scene, geometry, material, object, group) {
    if (geometry && !q.resident.has(geometry.uuid)) {
      let actor = object;
      while (actor && !actor.userData?.visualProfile?.kind) actor = actor.parent;
      const owners = [];
      for (const name of ['horde', 'bosses', 'synthetics', 'gore']) if (window.game[name]?.sharedResources?.has(geometry)) owners.push(name);
      const row = { uuid: geometry.uuid, kind: actor?.userData.visualProfile.kind ?? null,
        lod: actor?.userData.detailLevel ?? null, part: object?.name || object?.type || null,
        owners, firstDrawCycle: q.cycle, vertices: geometry.attributes.position?.count ?? 0 };
      q.resident.set(geometry.uuid, row);
      if (owners.length) q.newShared.push({ ...row });
      if (!q.seen.has(geometry)) { q.seen.add(geometry); geometry.addEventListener('dispose', q.onDispose); }
    }
    return original.call(this, camera, scene, geometry, material, object, group);
  };
  q.beginCycle = () => { q.cycle++; q.newShared.length = 0; };
  const sample = window.__restartResourceQA.sample;
  window.__restartResourceQA.sample = label => {
    const result = sample(label), g = window.game;
    const actors = g.horde.aliens.map(actor => ({ type: actor.type, position: actor.mesh.position.toArray().map(value => Math.round(value * 1000) / 1000),
      lod: actor.mesh.userData.detailLevel ?? null, source: actor.mesh.userData.visualSource ?? null }));
    const shared = [...q.resident.values()].filter(row => row.owners.length);
    const counts = {};
    for (const row of shared) { const key = row.owners.join(',') + ':' + row.kind + ':lod' + row.lod; counts[key] = (counts[key] ?? 0) + 1; }
    result.geometryTrace = { actors, renderedResidentCount: q.resident.size, sharedRenderedCounts: counts,
      sharedRendered: shared.map(row => ({ ...row })), newlyRenderedShared: q.newShared.map(row => ({ ...row })),
      hordeRetainedGeometryCount: [...g.horde.sharedResources].filter(resource => resource.isBufferGeometry).length,
      environmentGeometryKeys: [...g.env.geometries.keys()].sort() };
    return result;
  };
}
