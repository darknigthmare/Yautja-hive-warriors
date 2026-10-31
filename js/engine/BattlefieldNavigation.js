/* Navigation follows the rooms and actual corridor polylines. The local grid
 * handles clustered convex cover; it is rebuilt after a gate change or when a
 * moving obstacle invalidates the next step. Render visibility is irrelevant. */
import * as THREE from 'three';

const distance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
function trenchAt(point, trench, margin = 0) {
  return point.x >= trench.minX - margin && point.x <= trench.maxX + margin && point.z >= trench.minZ - margin && point.z <= trench.maxZ + margin &&
    !(trench.bridges ?? []).some(bridge => point.x >= bridge.minX + margin && point.x <= bridge.maxX - margin && point.z >= bridge.minZ - margin && point.z <= bridge.maxZ + margin);
}
function segmentRectangle(from, to, minX, maxX, minZ, maxZ) {
  let low = 0, high = 1;
  for (const [origin, delta, min, max] of [[from.x, to.x - from.x, minX, maxX], [from.z, to.z - from.z, minZ, maxZ]]) {
    if (Math.abs(delta) < 1e-9) { if (origin < min || origin > max) return false; }
    else { const a = (min - origin) / delta, b = (max - origin) / delta; low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); }
  }
  return low < high - 1e-7 && high > 1e-7 && low < 1 - 1e-7;
}
function active(c, point) { return c.blocksNavigation !== false && c.enabled !== false && c.solid !== false && (!c.isCollisionActive || c.isCollisionActive()) && (!point || !c.isNavigationActive || c.isNavigationActive(point)); }
function intersects(point, collider, radius) {
  if (!active(collider, point) || point.y > (collider.baseY ?? 0) + collider.height + .2 || point.y + 1.4 < (collider.baseY ?? 0)) return false;
  if (collider.navigationTest) return collider.navigationTest(point, radius);
  const dx = point.x - collider.x, dz = point.z - collider.z;
  if (collider.halfWidth == null) return Math.hypot(dx, dz) < collider.radius + radius;
  const cos = Math.cos(collider.rotation ?? 0), sin = Math.sin(collider.rotation ?? 0);
  const x = dx * cos - dz * sin, z = dx * sin + dz * cos;
  return Math.hypot(x - THREE.MathUtils.clamp(x, -collider.halfWidth, collider.halfWidth), z - THREE.MathUtils.clamp(z, -collider.halfDepth, collider.halfDepth)) < radius;
}
function clearSegment(environment, from, to, radius) {
  for (const trench of environment.acidTrenches ?? []) {
    if (from.y > .65 || trenchAt(from, trench)) continue;
    if (trench.maxX + radius < Math.min(from.x, to.x) || trench.minX - radius > Math.max(from.x, to.x) || trench.maxZ + radius < Math.min(from.z, to.z) || trench.minZ - radius > Math.max(from.z, to.z)) continue;
    let cursor = trench.minX - radius;
    for (const bridge of [...trench.bridges].sort((a, b) => a.minX - b.minX)) {
      if (segmentRectangle(from, to, cursor, bridge.minX + radius, trench.minZ - radius, trench.maxZ + radius)) return false;
      cursor = Math.max(cursor, bridge.maxX - radius);
    }
    if (segmentRectangle(from, to, cursor, trench.maxX + radius, trench.minZ - radius, trench.maxZ + radius)) return false;
  }
  for (const c of environment.colliders) {
    if (!active(c, from) || from.y > (c.baseY ?? 0) + c.height + .2 || from.y + 1.4 < (c.baseY ?? 0)) continue;
    const extent = (c.radius ?? Math.hypot(c.halfWidth, c.halfDepth)) + radius;
    if (c.x + extent < Math.min(from.x, to.x) || c.x - extent > Math.max(from.x, to.x) || c.z + extent < Math.min(from.z, to.z) || c.z - extent > Math.max(from.z, to.z)) continue;
    if (c.navigationTest) {
      const steps = Math.max(1, Math.ceil(distance(from, to) / .5));
      for (let i = 0; i <= steps; i++) if (c.navigationTest(new THREE.Vector3(THREE.MathUtils.lerp(from.x, to.x, i / steps), from.y, THREE.MathUtils.lerp(from.z, to.z, i / steps)), radius)) return false;
      continue;
    }
    if (c.halfWidth == null) {
      const dx = to.x - from.x, dz = to.z - from.z, lengthSq = dx * dx + dz * dz;
      const t = lengthSq ? THREE.MathUtils.clamp(((c.x - from.x) * dx + (c.z - from.z) * dz) / lengthSq, 0, 1) : 0;
      if (Math.hypot(from.x + t * dx - c.x, from.z + t * dz - c.z) < extent) return false;
      continue;
    }
    const cos = Math.cos(c.rotation ?? 0), sin = Math.sin(c.rotation ?? 0);
    const x = (from.x - c.x) * cos - (from.z - c.z) * sin, z = (from.x - c.x) * sin + (from.z - c.z) * cos;
    const dx = (to.x - from.x) * cos - (to.z - from.z) * sin, dz = (to.x - from.x) * sin + (to.z - from.z) * cos;
    let low = 0, high = 1;
    for (const [origin, delta, half] of [[x, dx, c.halfWidth + radius], [z, dz, c.halfDepth + radius]]) {
      if (Math.abs(delta) < 1e-9) { if (Math.abs(origin) >= half) { low = 2; break; } }
      else { const a = (-half - origin) / delta, b = (half - origin) / delta; low = Math.max(low, Math.min(a, b)); high = Math.min(high, Math.max(a, b)); }
    }
    if (low < high - 1e-7 && high > 1e-7 && low < 1 - 1e-7) return false;
  }
  return true;
}

function floorSegment(environment, from, to, radius) {
  const rectangles = environment.accessibleBattlefieldRects();
  if (!rectangles) return true;
  const steps = Math.max(1, Math.ceil(distance(from, to) / 3));
  for (let i = 0; i <= steps; i++) {
    const x = THREE.MathUtils.lerp(from.x, to.x, i / steps), z = THREE.MathUtils.lerp(from.z, to.z, i / steps);
    if (!rectangles.some(b => x >= b.minX + radius && x <= b.maxX - radius && z >= b.minZ + radius && z <= b.maxZ - radius)) return false;
  }
  return true;
}

function shortest(nodes, edges, start, end) {
  const cost = new Map([[start, 0]]), parent = new Map(), queue = new Set(nodes.keys());
  while (queue.size) {
    let current = null, best = Infinity;
    for (const id of queue) if ((cost.get(id) ?? Infinity) < best) { current = id; best = cost.get(id); }
    if (current === null || current === end) break;
    queue.delete(current);
    for (const next of edges.get(current) ?? []) {
      const candidate = best + distance(nodes.get(current), nodes.get(next));
      if (candidate < (cost.get(next) ?? Infinity)) { cost.set(next, candidate); parent.set(next, current); }
    }
  }
  if (!cost.has(end)) return [];
  const path = [end]; while (path[0] !== start) path.unshift(parent.get(path[0]));
  return path.map(id => nodes.get(id).clone());
}

export class BattlefieldNavigation {
  constructor(environment) { this.environment = environment; this.actorPaths = new WeakMap(); this.gridCache = new Map(); }

  strategicPath(from, target) {
    const environment = this.environment, layout = environment.battlefieldLayout;
    if (!layout) return [target.clone()];
    const nodes = new Map(), edges = new Map(), segments = [];
    const add = p => { const id = `${p[0]},${p[1]}`; if (!nodes.has(id)) { nodes.set(id, new THREE.Vector3(p[0], from.y, p[1])); edges.set(id, new Set()); } return id; };
    const connect = (a, b) => { edges.get(a).add(b); edges.get(b).add(a); };
    for (const sector of layout.sectors) add(sector.center);
    const line = points => { for (let i = 1; i < points.length; i++) { const a = add(points[i - 1]), b = add(points[i]); connect(a, b); segments.push([a, b]); } };
    for (const corridor of layout.corridors.filter(c => !c.tactical)) {
      const gate = layout.gates.find(g => g.corridorId === corridor.id);
      if (gate && !environment.isGateOpen(gate.id)) continue;
      line([layout.sectors.find(s => s.id === corridor.from).center, layout.sectors.find(s => s.id === corridor.to).center]);
    }
    for (const route of layout.strategicRoutes.filter(r => r.id.endsWith('-flank') || r.id.endsWith('-outer'))) {
      if (!layout.strategicMode || route.open === false || route.physicalGateIds.some(id => !environment.isGateOpen(id))) continue;
      line(route.waypoints);
    }
    const attach = (point, id) => {
      nodes.set(id, point.clone()); edges.set(id, new Set());
      const room = environment.getSectorAt(point);
      if (room) { connect(id, add(room.center)); return; }
      let nearest = null, best = Infinity;
      for (const [a, b] of segments) {
        const p = nodes.get(a), q = nodes.get(b), delta = q.clone().sub(p);
        const t = THREE.MathUtils.clamp(point.clone().sub(p).dot(delta) / delta.lengthSq(), 0, 1);
        const projection = p.clone().addScaledVector(delta, t), d = distance(point, projection);
        if (d < best) { best = d; nearest = { a, b, projection }; }
      }
      if (nearest && best <= layout.corridorWidth) {
        const projection = add([nearest.projection.x, nearest.projection.z]); connect(id, projection); connect(projection, nearest.a); connect(projection, nearest.b);
      }
    };
    attach(from, '@start'); attach(target, '@goal');
    return shortest(nodes, edges, '@start', '@goal').slice(1);
  }

  localPath(from, target, radius) {
    const environment = this.environment, room = environment.getSectorAt(from);
    if (!room || environment.getSectorAt(target)?.id !== room.id) return [target.clone()];
    const step = 3, b = room.bounds, width = Math.floor((b.maxX - b.minX - 2) / step) + 1;
    const depth = Math.floor((b.maxZ - b.minZ - 2) / step) + 1;
    const key = `${room.id}/${Math.ceil(radius * 10)}/${from.y.toFixed(3)}/${environment.openGates.size}/${this.usingVerticalAccess ? 1 : 0}`;
    let grid = this.gridCache.get(key);
    if (!grid) {
      const clear = new Uint8Array(width * depth), candidates = environment.colliders.filter(c => {
        const extent = c.radius ?? Math.hypot(c.halfWidth, c.halfDepth);
        return active(c) && c.x + extent >= b.minX && c.x - extent <= b.maxX && c.z + extent >= b.minZ && c.z - extent <= b.maxZ;
      });
      for (let z = 0; z < depth; z++) for (let x = 0; x < width; x++) {
        const point = new THREE.Vector3(b.minX + 1 + x * step, from.y, b.minZ + 1 + z * step);
        const unsafeFloor = from.y <= .65 && (environment.acidTrenches ?? []).some(trench => trenchAt(point, trench, radius + .12));
        // The collision grid must also obey the actually constructed floor
        // union. Otherwise A* may walk through empty space between two rooms.
        const absentFloor = !floorSegment(environment, point, point, radius + .12);
        clear[z * width + x] = absentFloor || unsafeFloor ||
          candidates.some(c => intersects(point, c, radius + .12)) ? 0 : 1;
      }
      grid = { clear }; this.gridCache.set(key, grid);
      if (this.gridCache.size > 32) this.gridCache.delete(this.gridCache.keys().next().value);
    }
    const pointAt = id => new THREE.Vector3(b.minX + 1 + id % width * step, from.y, b.minZ + 1 + Math.floor(id / width) * step);
    const nearest = point => {
      let best = Infinity, result = -1;
      for (let id = 0; id < grid.clear.length; id++) if (grid.clear[id]) {
        const p = pointAt(id), d = distance(point, p);
        if (d < best && floorSegment(environment, point, p, radius) && clearSegment(environment, point, p, radius)) { best = d; result = id; }
      }
      return result;
    };
    const start = nearest(from), end = nearest(target);
    if (start < 0 || end < 0) return [];
    const costs = new Map([[start, 0]]), parent = new Map(), open = new Set([start]);
    while (open.size) {
      let current = -1, best = Infinity;
      for (const id of open) { const f = costs.get(id) + distance(pointAt(id), pointAt(end)); if (f < best) { best = f; current = id; } }
      if (current === end) break;
      open.delete(current);
      const x = current % width, z = Math.floor(current / width);
      for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const nx = x + dx, nz = z + dz, next = nz * width + nx;
        if (nx < 0 || nz < 0 || nx >= width || nz >= depth || !grid.clear[next]) continue;
        if (!floorSegment(environment, pointAt(current), pointAt(next), radius) || !clearSegment(environment, pointAt(current), pointAt(next), radius)) continue;
        const cost = costs.get(current) + Math.hypot(dx, dz) * step;
        if (cost + 1e-6 < (costs.get(next) ?? Infinity)) { costs.set(next, cost); parent.set(next, current); open.add(next); }
      }
    }
    if (!costs.has(end)) return [];
    const path = [end]; while (path[0] !== start) path.unshift(parent.get(path[0]));
    return [...path.map(pointAt), target.clone()];
  }

  waypoint(from, target, radius = .65) {
    if (!from || !target || ![from.x, from.z, target.x, target.z].every(Number.isFinite)) return null;
    const environment = this.environment;
    // Never return an unobstructed *line* that crosses a missing floor
    // polygon, nor a destination when A* found no physical route.
    const navigable = point => floorSegment(environment, from, point, radius) &&
      clearSegment(environment, from, point, radius);
    let goal = target;
    if (environment.getSectorAt(from)?.id !== environment.getSectorAt(target)?.id || !environment.getSectorAt(from)) {
      const path = this.strategicPath(from, target);
      if (!path.length) return from.clone();
      // A raised insertion can make the room center inaccessible from the
      // ramp foot. Advance only when the next actual route segment is safe.
      const room = environment.getSectorAt(from);
      if (room && path.length > 1 && path[0].x === room.center[0] && path[0].z === room.center[1] &&
          floorSegment(environment, from, path[1], radius) && clearSegment(environment, from, path[1], radius)) path.shift();
      goal = path.find(point => distance(point, from) > 1.5) ?? target;
      // A follower already inside the room need not return to its exact center
      // each frame. Advance past centers only while the real floor connects
      // the segment; this keeps L-shaped corridors from becoming diagonals.
      for (const point of path) {
        if (distance(point, from) < 1.5) continue;
        if (!floorSegment(environment, from, point, radius) || !clearSegment(environment, from, point, radius)) break;
        goal = point;
      }
    }
    if (navigable(goal)) { this.actorPaths.delete(from); return goal.clone(); }
    const signature = `${Math.round(goal.x)},${Math.round(goal.z)},${Math.round(from.y)},${environment.openGates.size},${this.usingVerticalAccess ? 1 : 0}`;
    let cached = this.actorPaths.get(from);
    if (!cached || cached.signature !== signature || !cached.points.length) {
      cached = { signature, points: this.localPath(from, goal, radius) }; this.actorPaths.set(from, cached);
    }
    while (cached.points.length > 1 && distance(from, cached.points[0]) < 1) cached.points.shift();
    if (cached.points.length && !navigable(cached.points[0])) {
      // Lifts, vehicles and removable cover can change after grid creation.
      this.gridCache.clear(); cached.points = this.localPath(from, goal, radius);
    }
    // Skip visible intermediate grid points, without cutting a cover corner.
    while (cached.points.length > 1 && navigable(cached.points[1])) cached.points.shift();
    // A wall spanning the entire room or a void between decks has no safe
    // detour. Hold the actor in place rather than force it through geometry.
    const next = cached.points[0];
    return next && navigable(next) ? next.clone() : from.clone();
  }
}
