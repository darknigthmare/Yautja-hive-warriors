/* Orthogonal traversable regions and their true union boundary. Tactical
 * detours are physical corridors, not a second line painted on the minimap. */
export function variantSectorCenters(variant) {
  const columns = variant.columns, rows = Math.ceil(variant.sectors / columns);
  const gapX = Math.max(185, (variant.width - 132) / (columns - 1));
  const gapZ = Math.max(185, (variant.depth - 132) / (rows - 1));
  const flip = ['parallel-lines', 'bastion', 'split-wing'].includes(variant.pattern) ? -1 : 1;
  return Array.from({ length: variant.sectors }, (_, index) => {
    const row = Math.floor(index / columns), col = index % columns;
    return [flip * (row % 2 ? columns - 1 - col : col) * gapX, -row * gapZ];
  });
}

export function createStrategicRoutes(layout) {
  const sectors = layout.sectors, first = sectors[0], relay = sectors[2], last = sectors.at(-1);
  const routes = [];
  const add = (id, from, to, waypoints) => {
    waypoints = waypoints.filter((point, index) => !index || point[0] !== waypoints[index - 1][0] || point[1] !== waypoints[index - 1][1]);
    let length = 0; for (let i = 1; i < waypoints.length; i++) length += Math.hypot(waypoints[i][0] - waypoints[i - 1][0], waypoints[i][1] - waypoints[i - 1][1]);
    routes.push({ id, from: from.id, to: to.id, waypoints: waypoints.map(point => [...point]), travelSeconds: length / 6, open: true, physicalGateIds: [] });
  };
  const count = Math.min(layout.variant?.fronts ?? 3, sectors.length);
  const indices = [0, 2];
  for (let i = 2; i < count - 1; i++) indices.push(Math.round((sectors.length - 1) * i / (count - 1)));
  indices.push(sectors.length - 1);
  const anchors = [...new Set(indices)].map(index => sectors[index]);
  for (let i = 1; i < anchors.length; i++) {
    const from = anchors[i - 1], to = anchors[i];
    add(`route-${from.id}-${to.id}-main`, from, to, sectors.slice(from.index, to.index + 1).map(sector => sector.center));
    routes.at(-1).physicalGateIds = layout.gates.filter(gate => sectors.find(s => s.id === gate.from).index >= from.index && sectors.find(s => s.id === gate.to).index <= to.index).map(gate => gate.id);
  }
  const tactical = [], tacticalGates = [];
  if (layout.strategicMode) {
    const roomBounds = layout.bounds, margin = 42, north = roomBounds.maxZ + margin, east = roomBounds.maxX + margin, west = roomBounds.minX - margin;
    const firstFlank = first.center[0] !== relay.center[0]
      ? [first.center, [first.center[0], north], [relay.center[0], north], relay.center]
      : [first.center, [west, first.center[1]], [west, relay.center[1]], relay.center];
    const outerFlank = relay.center[1] !== last.center[1]
      ? [relay.center, [east, relay.center[1]], [east, last.center[1]], last.center]
      : [relay.center, [relay.center[0], north], [last.center[0], north], last.center];
    add('route-insertion-relay-flank', first, relay, firstFlank);
    add(`route-relay-${last.id}-outer`, relay, last, outerFlank);
    const halfWidth = layout.corridorWidth / 2;
    for (const route of routes.filter(route => !route.physicalGateIds.length)) {
      const a = route.waypoints[0], corner = route.waypoints[1], axis = a[0] === corner[0] ? 'z' : 'x';
      const center = [...corner], coordinate = axis === 'x' ? 0 : 1;
      center[coordinate] -= Math.sign(corner[coordinate] - a[coordinate]) * 18;
      const id = `gate-${route.id}`;
      tacticalGates.push({ id, from: route.from, to: route.to, center, axis, tactical: true, routeId: route.id,
        bounds: { minX: center[0] - (axis === 'x' ? 1 : halfWidth), maxX: center[0] + (axis === 'x' ? 1 : halfWidth),
          minZ: center[1] - (axis === 'z' ? 1 : halfWidth), maxZ: center[1] + (axis === 'z' ? 1 : halfWidth) } });
      route.physicalGateIds = [id];
    }
    for (const [routeIndex, points, from, to] of [[0, firstFlank, first.id, relay.id], [1, outerFlank, relay.id, last.id]]) {
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1], b = points[i], axis = a[0] === b[0] ? 'z' : 'x';
        if (a[0] === b[0] && a[1] === b[1]) continue;
        const bounds = { minX: Math.min(a[0], b[0]) - halfWidth, maxX: Math.max(a[0], b[0]) + halfWidth,
          minZ: Math.min(a[1], b[1]) - halfWidth, maxZ: Math.max(a[1], b[1]) + halfWidth };
        tactical.push({ id: `tactical-${routeIndex}-${i}`, from, to, axis, tactical: true,
          center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], bounds });
      }
    }
  }
  return { routes, tactical, tacticalGates, frontAnchorIds: anchors.map(sector => sector.id) };
}

function subtract(intervals, start, end) {
  const next = [];
  for (const [a, b] of intervals) {
    if (end <= a || start >= b) next.push([a, b]);
    else { if (start > a) next.push([a, start]); if (end < b) next.push([end, b]); }
  }
  return next;
}

export function battlefieldUnionBoundary(rectangles) {
  const edges = [], epsilon = 1e-7;
  for (let id = 0; id < rectangles.length; id++) {
    const r = rectangles[id];
    for (const [axis, at, start, end, outward] of [
      ['x', r.minX, r.minZ, r.maxZ, -1], ['x', r.maxX, r.minZ, r.maxZ, 1],
      ['z', r.minZ, r.minX, r.maxX, -1], ['z', r.maxZ, r.minX, r.maxX, 1]]) {
      let pieces = [[start, end]];
      const sample = at + outward * epsilon;
      for (let other = 0; other < rectangles.length; other++) {
        if (other === id) continue;
        const q = rectangles[other];
        if (axis === 'x' && sample > q.minX && sample < q.maxX) pieces = subtract(pieces, q.minZ, q.maxZ);
        if (axis === 'z' && sample > q.minZ && sample < q.maxZ) pieces = subtract(pieces, q.minX, q.maxX);
      }
      for (const [a, b] of pieces) if (b - a > epsilon) edges.push({ axis, at, start: a, end: b });
    }
  }
  return edges;
}
