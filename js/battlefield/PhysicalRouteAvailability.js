/* Read-only physical authorization for Musou front travel.
 * No orders, spawning or RTS commands: the simulation owns finite groups,
 * Environment owns gate/bridge state. Cross-level elevation geometry is still
 * resolved by the physical navigation and vehicle systems.
 */
const identifier = value => typeof value === 'string' && value.length > 0 && value.length <= 160;

/** "opening" is a request to UNLOCK a logical route by a real mission event.
 * It may precede the physical gate-opening animation. It must still refuse
 * destroyed bridges; normal travel always requires the gates to be open.
 */
export function physicalOperationRouteAvailable(environment, route, { opening = false } = {}) {
  const layout = environment?.battlefieldLayout;
  if (!route || !layout || !Array.isArray(layout.gates) ||
      !Array.isArray(layout.strategicRoutes) || !Array.isArray(route.physicalGateIds) ||
      route.physicalGateIds.length > 128 || !route.physicalGateIds.every(identifier) ||
      typeof environment.isGateOpen !== 'function' ||
      typeof environment.isTacticalRouteAvailable !== 'function') return false;

  if (route.physicalRouteId !== null && route.physicalRouteId !== undefined) {
    if (!identifier(route.physicalRouteId)) return false;
    const physical = layout.strategicRoutes.find(candidate => candidate.id === route.physicalRouteId);
    if (!physical || (!opening && physical.open === false) ||
        !environment.isTacticalRouteAvailable(route.physicalRouteId)) return false;
  }

  // Unknown gates are never authorized, even by a mission opening event.
  if (route.physicalGateIds.some(gateId => !layout.gates.some(gate => gate.id === gateId))) return false;
  if (opening) return true;
  for (const gateId of route.physicalGateIds) {
    if (!environment.isGateOpen(gateId)) return false;
  }
  return true;
}
