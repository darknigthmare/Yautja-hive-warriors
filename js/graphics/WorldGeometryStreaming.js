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
  constructor(environment) {
    this.environment = environment; this.zones = []; this.geometries = new Map(); this.instances = new Map();
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
    const positions = (Array.isArray(players) ? players : [players]).map(p => p?.position ?? p).filter(p => Number.isFinite(p?.x) && Number.isFinite(p?.z));
    if (!positions.length) return;
    for (const zone of this.zones) {
      // An entire next room is retained ahead of its visible detail. Geometry
      // restoration is synchronous CPU bookkeeping; uploads occur on rendering.
      zone.resident = positions.some(p => nearby(p, zone.bounds, 160));
      if (zone.controlsVisibility) zone.root.visible = positions.some(p => nearby(p, zone.bounds, 120));
    }
    for (const record of this.geometries.values()) {
      const wanted = record.global || [...record.zones].some(zone => zone.resident);
      if (wanted === record.resident) continue;
      record.resident = wanted;
      if (!wanted) { record.geometry.dispose(); this.evictions++; }
      else {
        for (const attribute of Object.values(record.geometry.attributes)) attribute.needsUpdate = true;
        if (record.geometry.index) record.geometry.index.needsUpdate = true;
        this.restorations++;
      }
    }
    for (const record of this.instances.values()) {
      if (record.resident === record.zone.resident) continue;
      record.resident = record.zone.resident;
      if (!record.resident) { record.mesh.dispose(); this.evictions++; }
      else { record.mesh.instanceMatrix.needsUpdate = true; if (record.mesh.instanceColor) record.mesh.instanceColor.needsUpdate = true; this.restorations++; }
    }
  }

  getStats() {
    let templateBytes = 0, eligibleGpuBytes = 0, residentGeometryCount = 0, residentInstanceCount = 0;
    for (const record of this.geometries.values()) { templateBytes += record.bytes; if (record.resident) { eligibleGpuBytes += record.bytes; residentGeometryCount++; } }
    for (const record of this.instances.values()) { templateBytes += record.bytes; if (record.resident) { eligibleGpuBytes += record.bytes; residentInstanceCount++; } }
    return { zones: this.zones.length, residentZones: this.zones.filter(zone => zone.resident).length,
      residentGeometryCount, residentInstanceCount, templateBytes, eligibleGpuBytes, evictions: this.evictions, restorations: this.restorations,
      metric: 'CPU buffer byte sizes eligible for GPU upload; actual driver memory requires renderer/hardware measurement' };
  }

  dispose() { this.disposed = true; this.zones.length = 0; this.geometries.clear(); this.instances.clear(); this.environment = null; }
}
