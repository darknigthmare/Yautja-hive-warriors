/* GPU-buffer residency by the union of both players' nearby zones.
 * BufferGeometry.dispose() and InstancedMesh.dispose() release Three's GPU
 * allocations; their typed CPU arrays remain the restoration templates.
 * Returning marks those same attributes for upload before the next draw.
 * Materials/textures and coarse world boundaries remain shared/resident. */
const bytesOf = geometry => {
  const arrays = new Set(Object.values(geometry.attributes).map(a => a.array));
  if (geometry.index) arrays.add(geometry.index.array);
  return [...arrays].reduce((sum, array) => sum + array.byteLength, 0);
};
function nearby(position, bounds, margin) {
  const x = Math.max(bounds.minX, Math.min(bounds.maxX, position.x)), z = Math.max(bounds.minZ, Math.min(bounds.maxZ, position.z));
  return Math.hypot(position.x - x, position.z - z) <= margin;
}

export class WorldGeometryStreaming {
  constructor(environment, { restoreBudgetBytes = 2 * 1024 * 1024 } = {}) {
    if (!Number.isSafeInteger(restoreBudgetBytes) || restoreBudgetBytes < 0) throw new RangeError('Streaming restore budget must be nonnegative bytes');
    this.environment = environment; this.zones = []; this.geometries = new Map(); this.instances = new Map();
    this.restoreBudgetBytes = restoreBudgetBytes; this.pendingResources = 0; this.pendingBytes = 0;
    this.lastRestoredBytes = 0; this.lastMandatoryRestoredBytes = 0; this.lastAheadRestoredBytes = 0; this.lastUpdateCpuMs = 0; this.maxUpdateCpuMs = 0;
    this.evictions = 0; this.restorations = 0; this.disposed = false;
    const layout = environment.battlefieldLayout, owners = new Map();
    if (!layout) return;
    const add = (id, root, bounds, controlsVisibility = false) => {
      if (!root) return;
      const zone = { id, root, bounds, resident: true, controlsVisibility };
      this.zones.push(zone); root.traverse(node => { if (node.isMesh) owners.set(node, zone); });
    };
    for (const sector of layout.sectors) add(`sector:${sector.id}`, environment.sectorVisuals.get(sector.id), sector.bounds);
    add('insertion-floor', environment.root.getObjectByName('detail-tessellated-ground'), layout.sectors[0].bounds, true);
    for (const corridor of layout.corridors) {
      add(`corridor:${corridor.id}`, environment.corridorVisuals.get(corridor.id), corridor.bounds);
      add(`floor:${corridor.id}`, environment.root.getObjectByName(corridor.id), corridor.bounds, true);
    }
    for (const gate of layout.gates) add(`gate:${gate.id}`, environment.gateVisuals.get(gate.id)?.frame, gate.bounds);
    for (const bridge of environment.tacticalBridges?.values() ?? []) {
      const s = bridge.spec, x = s.axis === 'x' ? s.halfSpan + 4 : s.halfWidth + 4, z = s.axis === 'z' ? s.halfSpan + 4 : s.halfWidth + 4;
      add(`bridge:${bridge.id}`, bridge.root, { minX: s.center[0] - x, maxX: s.center[0] + x, minZ: s.center[1] - z, maxZ: s.center[1] + z }, true);
    }
    environment.root.traverse(mesh => {
      if (!mesh.isMesh) return;
      const zone = owners.get(mesh);
      if (!this.geometries.has(mesh.geometry)) this.geometries.set(mesh.geometry, { geometry: mesh.geometry, zones: new Set(), global: false, resident: true, bytes: bytesOf(mesh.geometry) });
      const record = this.geometries.get(mesh.geometry);
      if (zone) record.zones.add(zone); else record.global = true;
      if (mesh.isInstancedMesh && zone) this.instances.set(mesh, { mesh, zone, resident: true,
        bytes: mesh.instanceMatrix.array.byteLength + (mesh.instanceColor?.array.byteLength ?? 0) });
    });
  }

  update(players) {
    if (this.disposed) return;
    const startedAt = performance.now();
    const positions = (Array.isArray(players) ? players : [players]).map(p => p?.position ?? p).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z));
    if (!positions.length) return;
    this.lastRestoredBytes = 0; this.lastMandatoryRestoredBytes = 0; this.lastAheadRestoredBytes = 0;
    for (const zone of this.zones) {
      // An entire next room is retained ahead of its visible detail. Geometry
      // restoration is synchronous CPU bookkeeping; uploads occur on rendering.
      zone.resident = positions.some(p => nearby(p, zone.bounds, 160));
      zone.mustDraw = positions.some(p => nearby(p, zone.bounds, 120));
      zone.distance = Math.min(...positions.map(p => Math.hypot(p.x - Math.max(zone.bounds.minX, Math.min(zone.bounds.maxX, p.x)), p.z - Math.max(zone.bounds.minZ, Math.min(zone.bounds.maxZ, p.z)))));
      if (zone.controlsVisibility) zone.root.visible = positions.some(p => nearby(p, zone.bounds, 120));
    }
    const queue = [];
    for (const record of this.geometries.values()) {
      const wanted = record.global || [...record.zones].some(zone => zone.resident);
      if (wanted === record.resident) continue;
      if (!wanted) { record.resident = false; record.geometry.dispose(); this.evictions++; }
      else queue.push({ record, mandatory: record.global || [...record.zones].some(zone => zone.mustDraw), distance: Math.min(...[...record.zones].map(zone => zone.distance)) });
    }
    for (const record of this.instances.values()) {
      if (record.resident === record.zone.resident) continue;
      if (!record.zone.resident) { record.resident = false; record.mesh.dispose(); this.evictions++; }
      else queue.push({ record, mandatory: record.zone.mustDraw, distance: record.zone.distance });
    }
    queue.sort((a, b) => Number(b.mandatory) - Number(a.mandatory) || a.distance - b.distance);
    this.pendingResources = 0; this.pendingBytes = 0;
    for (const item of queue) {
      const { record, mandatory } = item;
      // Ahead-of-view work is bounded. A teleport or the second camera may
      // demand immediate visible terrain: report that overage explicitly and
      // restore it now rather than rendering an absent floor.
      if (!mandatory && this.lastAheadRestoredBytes + record.bytes > this.restoreBudgetBytes) { this.pendingResources++; this.pendingBytes += record.bytes; continue; }
      if (record.geometry) {
        for (const attribute of Object.values(record.geometry.attributes)) attribute.needsUpdate = true;
        if (record.geometry.index) record.geometry.index.needsUpdate = true;
      } else { record.mesh.instanceMatrix.needsUpdate = true; if (record.mesh.instanceColor) record.mesh.instanceColor.needsUpdate = true; }
      record.resident = true; this.restorations++; this.lastRestoredBytes += record.bytes;
      if (mandatory) this.lastMandatoryRestoredBytes += record.bytes; else this.lastAheadRestoredBytes += record.bytes;
    }
    this.lastUpdateCpuMs = performance.now() - startedAt; this.maxUpdateCpuMs = Math.max(this.maxUpdateCpuMs, this.lastUpdateCpuMs);
  }

  getStats() {
    let templateBytes = 0, eligibleGpuBytes = 0, residentGeometryCount = 0, residentInstanceCount = 0;
    for (const record of this.geometries.values()) { templateBytes += record.bytes; if (record.resident) { eligibleGpuBytes += record.bytes; residentGeometryCount++; } }
    for (const record of this.instances.values()) { templateBytes += record.bytes; if (record.resident) { eligibleGpuBytes += record.bytes; residentInstanceCount++; } }
    return { zones: this.zones.length, residentZones: this.zones.filter(zone => zone.resident).length,
      residentGeometryCount, residentInstanceCount, templateBytes, eligibleGpuBytes, evictions: this.evictions, restorations: this.restorations,
      restoreBudgetBytes: this.restoreBudgetBytes, pendingResources: this.pendingResources, pendingBytes: this.pendingBytes,
      lastRestoredBytes: this.lastRestoredBytes, lastMandatoryRestoredBytes: this.lastMandatoryRestoredBytes, lastAheadRestoredBytes: this.lastAheadRestoredBytes,
      lastUpdateCpuMs: this.lastUpdateCpuMs, maxUpdateCpuMs: this.maxUpdateCpuMs,
      metric: 'CPU buffer byte sizes eligible for GPU upload; actual driver memory requires renderer/hardware measurement' };
  }

  dispose() { this.disposed = true; this.zones.length = 0; this.geometries.clear(); this.instances.clear(); this.pendingResources = 0; this.pendingBytes = 0; this.environment = null; }
}
