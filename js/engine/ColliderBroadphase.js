/* Spatial preselection of colliders for Environment.resolveMovement (performance pass of
 * 22 Nov 2026). Plain static colliders go into a uniform grid; any collider that resolves its
 * own shape, can switch itself off or exposes a moving position (functions or accessors) is
 * always tested. Queries return collider indices in ascending order, so pushes are applied in
 * exactly the order of the full scan. The grid is rebuilt by its owner at least once per frame. */
const CELL = 24;
const cellKey = (cx, cz) => (cx + 32768) * 65536 + (cz + 32768); // numeric, no string allocation

function isDynamic(collider) {
  if (!collider || typeof collider !== 'object') return true;
  if (typeof collider.resolveMovement === 'function' || typeof collider.isCollisionActive === 'function' || typeof collider.isNavigationActive === 'function') return true;
  for (const key of ['x', 'z', 'radius', 'halfWidth', 'halfDepth', 'rotation']) {
    const descriptor = Object.getOwnPropertyDescriptor(collider, key);
    if (descriptor && (descriptor.get || descriptor.set)) return true;
  }
  return false;
}

function extentOf(collider) {
  const extent = collider.halfWidth != null ? Math.hypot(collider.halfWidth, collider.halfDepth ?? collider.halfWidth) : collider.radius;
  return Number.isFinite(extent) && extent >= 0 && Number.isFinite(collider.x) && Number.isFinite(collider.z) ? extent : null;
}

export class ColliderBroadphase {
  constructor(cell = CELL) { this.cell = cell; this.snapshot = new Float64Array(0); this.source = null; this.length = -1; this.cells = new Map(); this.dynamic = []; this.extent = []; this.stamp = null; }

  /** Rebuild from the current collider list; `stamp` identifies the frame it was built for. */
  rebuild(colliders, stamp = null) {
    this.source = colliders; this.length = colliders.length; this.stamp = stamp;
    this.cells.clear(); this.dynamic = []; this.extent = new Array(colliders.length); this.snapshot = new Float64Array(colliders.length * 3).fill(NaN);
    for (let index = 0; index < colliders.length; index++) {
      const collider = colliders[index];
      const extent = isDynamic(collider) ? null : extentOf(collider);
      if (extent === null) { this.dynamic.push(index); continue; }
      this.extent[index] = extent; this.snapshot[index * 3] = collider.x; this.snapshot[index * 3 + 1] = collider.z; this.snapshot[index * 3 + 2] = extent;
      const minX = Math.floor((collider.x - extent) / this.cell), maxX = Math.floor((collider.x + extent) / this.cell);
      const minZ = Math.floor((collider.z - extent) / this.cell), maxZ = Math.floor((collider.z + extent) / this.cell);
      for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
        const key = cellKey(cx, cz); let bucket = this.cells.get(key);
        if (!bucket) { bucket = []; this.cells.set(key, bucket); }
        bucket.push(index);
      }
    }
    return this;
  }

  /** A new frame only costs a rebuild when the list changed or a static collider moved or resized. */
  isStale(colliders, stamp) {
    if (this.source !== colliders || this.length !== colliders.length) return true;
    if (this.stamp === stamp) return false;
    for (let index = 0; index < colliders.length; index++) {
      const extent = this.extent[index]; if (extent === undefined) continue;
      const collider = colliders[index];
      if (collider.x !== this.snapshot[index * 3] || collider.z !== this.snapshot[index * 3 + 1] || extentOf(collider) !== this.snapshot[index * 3 + 2]) return true;
    }
    this.stamp = stamp; return false;
  }

  /** Indices, ascending, of colliders whose outline may overlap the box [minX, maxX] x [minZ, maxZ]. */
  queryBox(minX, maxX, minZ, maxZ) {
    const found = new Set(this.dynamic);
    for (let cx = Math.floor(minX / this.cell); cx <= Math.floor(maxX / this.cell); cx++) for (let cz = Math.floor(minZ / this.cell); cz <= Math.floor(maxZ / this.cell); cz++) {
      const bucket = this.cells.get(cellKey(cx, cz)); if (!bucket) continue;
      for (const index of bucket) {
        if (found.has(index)) continue;
        const collider = this.source[index], extent = this.extent[index];
        if (collider.x + extent >= minX && collider.x - extent <= maxX && collider.z + extent >= minZ && collider.z - extent <= maxZ) found.add(index);
      }
    }
    return [...found].sort((a, b) => a - b);
  }

  /** Indices, ascending, of colliders whose outline may lie within `reach` of (x, z). */
  query(x, z, reach, after = -1) {
    const found = new Set(this.dynamic.filter(index => index > after));
    const minX = Math.floor((x - reach) / this.cell), maxX = Math.floor((x + reach) / this.cell);
    const minZ = Math.floor((z - reach) / this.cell), maxZ = Math.floor((z + reach) / this.cell);
    for (let cx = minX; cx <= maxX; cx++) for (let cz = minZ; cz <= maxZ; cz++) {
      const bucket = this.cells.get(cellKey(cx, cz)); if (!bucket) continue;
      for (const index of bucket) {
        if (index <= after || found.has(index)) continue;
        const collider = this.source[index], extent = this.extent[index];
        if (Math.abs(collider.x - x) <= extent + reach && Math.abs(collider.z - z) <= extent + reach) found.add(index);
      }
    }
    return [...found].sort((a, b) => a - b);
  }
}
