/* Optional controlled-route assistance for the existing mountable skimmer.
 * It drives the real vehicle along real corridors while the battle continues.
 * Ownership, contested fronts, closed terrain and nearby enemies can stop it. */
import * as THREE from 'three';

const planarDistance = (a, b) => Math.hypot(a.x - b.x, a.z - b.z);
const point = (p, y = .5) => new THREE.Vector3(p[0], y, p[1]);
export class OperationTransport {
  constructor(environment, skimmer, simulation, { hostilesProvider = () => [], feedback = () => {} } = {}) {
    this.environment = environment; this.skimmer = skimmer; this.simulation = simulation;
    this.hostilesProvider = hostilesProvider; this.feedback = feedback; this.driver = null; this.journey = null; this.lastResult = null;
  }
  isPassenger(player) { return this.skimmer.isMounted && this.driver === player; }
  _safeFront(front) { return !!front && !front.contested && this.simulation.relationship(front.owner, this.simulation.config.playerFaction) === 'allied'; }
  _frontAt(position) { return [...this.simulation.fronts.values()].filter(front => planarDistance(position, point(front.position)) <= front.radius).sort((a, b) => planarDistance(position, point(a.position)) - planarDistance(position, point(b.position)))[0] ?? null; }
  _threatAt(position) {
    const faction = this.simulation.config.playerFaction;
    for (const actor of this.hostilesProvider() ?? []) {
      const p = actor?.position?.isVector3 ? actor.position : actor?.mesh?.position;
      if (!p || actor.hp <= 0 || (actor.factionId && !this.simulation.areHostile(faction, actor.factionId))) continue;
      if (planarDistance(position, p) < 24) return true;
    }
    for (const group of this.simulation.groups.values()) {
      if (group.state === 'reserve' || !this.simulation.areHostile(faction, group.factionId) || !group.units.some(id => { const unit = this.simulation.units.get(id); return unit?.hp > 0 && !['reserve', 'dead', 'evacuated', 'captured'].includes(unit.state); })) continue;
      if (planarDistance(position, point(group.position)) < 24) return true;
    }
    return false;
  }
  _safeRoute(route) {
    const physicalId = route.physicalRouteId ?? route.id.replace(/^bound-/, '');
    return route.open && this.environment.isTacticalRouteAvailable(physicalId) &&
      (route.physicalGateIds ?? []).every(id => this.environment.isGateOpen(id)) &&
      this._safeFront(this.simulation.fronts.get(route.from)) && this._safeFront(this.simulation.fronts.get(route.to)) &&
      Array.isArray(route.waypoints) && route.waypoints.length >= 2;
  }
  _path(fromId, toId) {
    const distances = new Map([[fromId, 0]]), paths = new Map([[fromId, []]]), pending = new Set(this.simulation.fronts.keys());
    while (pending.size) {
      let current = null, distance = Infinity;
      for (const id of pending) if ((distances.get(id) ?? Infinity) < distance) { distance = distances.get(id); current = id; }
      if (!current) return null; if (current === toId) return paths.get(current); pending.delete(current);
      for (const route of this.simulation.routes.values()) {
        if (!this._safeRoute(route)) continue;
        const next = route.from === current ? route.to : route.to === current ? route.from : null; if (!next || !pending.has(next)) continue;
        const candidate = distance + route.travelSeconds;
        if (candidate < (distances.get(next) ?? Infinity)) { distances.set(next, candidate); paths.set(next, [...paths.get(current), { route, from: current, to: next }]); }
      }
    }
    return null;
  }
  destinations(player) {
    const from = this._frontAt(player?.position ?? this.skimmer.position);
    if (!this._safeFront(from)) return [];
    return [...this.simulation.fronts.values()].filter(front => front.id !== from.id && this._safeFront(front) && this._path(from.id, front.id)).map(front => ({ id: front.id, label: front.label }));
  }
  interact(player) {
    if (!player?.position || player.hp <= 0 || this.skimmer.mountCooldown > 0) return false;
    if (this.isPassenger(player)) {
      if (this.journey) { this.cancel('manual_stop'); return true; }
      this.skimmer.isMounted = false; this.skimmer.mountCooldown = .5; player.mesh.visible = true;
      const exit = this.skimmer.position.clone().add(new THREE.Vector3(3, 0, 0)); this.environment.resolveMovement(exit, .75);
      player.position.copy(exit); player.position.y = this.environment.getElevationAt(exit.x, exit.z); player.mesh.position.copy(player.position); this.driver = null;
      return true;
    }
    if (this.skimmer.isMounted || !this.skimmer.mesh.visible || planarDistance(player.position, this.skimmer.position) > 4.5) return false;
    this.driver = player; this.skimmer.isMounted = true; this.skimmer.mountCooldown = .5;
    player.mesh.visible = false; player.position.copy(this.skimmer.position); return true;
  }
  requestTravel(player, targetId) {
    const refuse = reason => { this.lastResult = { accepted: false, reason }; return this.lastResult; };
    if (this.simulation.disposed || this.simulation.result) return refuse('operation_finished');
    if (!this.isPassenger(player)) return refuse('mount_required');
    if (this.journey) return refuse('already_travelling');
    const from = this._frontAt(this.skimmer.position), target = this.simulation.fronts.get(targetId);
    if (!this._safeFront(from) || !this._safeFront(target)) return refuse('controlled_uncontested_front_required');
    if (from.id === target.id) return refuse('already_at_destination');
    if (this._threatAt(this.skimmer.position)) return refuse('enemy_nearby');
    const path = this._path(from.id, target.id); if (!path) return refuse('no_controlled_route');
    const waypoints = [this.skimmer.position.clone(), point(from.position)];
    for (const leg of path) {
      const points = leg.route.from === leg.from ? leg.route.waypoints : [...leg.route.waypoints].reverse();
      for (const p of points) if (planarDistance(waypoints.at(-1), point(p)) > .01) waypoints.push(point(p));
    }
    let length = 0; for (let i = 1; i < waypoints.length; i++) length += planarDistance(waypoints[i - 1], waypoints[i]);
    const speed = Math.min(this.skimmer.speed, length / 8), duration = 2 + length / speed;
    this.journey = { fromId: from.id, toId: target.id, path, waypoints, waypoint: 1, boarding: 2, elapsed: 0, duration, speed, stuck: 0 };
    this.feedback(`Transport vers ${target.label} · environ ${Math.ceil(duration)} s. Le trajet s'arrête en cas de menace.`);
    return this.lastResult = { accepted: true, duration, targetId };
  }
  cancel(reason = 'cancelled') {
    if (!this.journey) return false;
    this.journey = null; this.lastResult = { accepted: false, reason };
    this.feedback(reason === 'enemy_nearby' ? 'Transport interrompu : ennemi proche. Contrôle manuel disponible.' : 'Transport interrompu : route indisponible. Contrôle manuel disponible.');
    return true;
  }
  update(delta, player, keys = {}) {
    if (!Number.isFinite(delta) || delta <= 0) return false;
    if (!this.driver && this.skimmer.isMounted) this.driver = player; // Legacy G boarding remains supported.
    if (this.driver && (!this.skimmer.isMounted || this.driver.hp <= 0)) { this.cancel('driver_unavailable'); if (this.driver.mesh) this.driver.mesh.visible = true; this.driver = null; }
    const j = this.journey; if (!j || !this.driver) return false;
    if (this.simulation.disposed || this.simulation.result) { this.cancel('operation_finished'); return false; }
    if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyG'].some(key => keys[key])) { this.cancel('manual_stop'); return false; }
    if (j.path.some(leg => !this._safeRoute(leg.route))) { this.cancel('route_lost'); return false; }
    if (this._threatAt(this.skimmer.position)) { this.cancel('enemy_nearby'); return false; }
    const dt = Math.min(delta, .25); j.elapsed += dt; this.skimmer.mountCooldown = Math.max(0, this.skimmer.mountCooldown - dt);
    if (j.boarding > 0) { j.boarding = Math.max(0, j.boarding - dt); this.skimmer.updateVisual(dt, false); return true; }
    let remaining = j.speed * dt;
    while (remaining > 1e-7 && j.waypoint < j.waypoints.length) {
      const target = j.waypoints[j.waypoint], distance = planarDistance(this.skimmer.position, target);
      if (distance < .03) { j.waypoint++; continue; }
      const stride = Math.min(remaining, distance, 1), next = this.skimmer.position.clone(), direction = target.clone().sub(next).setY(0).normalize();
      next.addScaledVector(direction, stride);
      if (this._threatAt(next)) { this.cancel('enemy_nearby'); this._syncPose(dt, true); return true; }
      next.y = this.environment.getElevationAt(next.x, next.z) + .5;
      const desired = next.clone(); this.environment.resolveMovement(next, 1.2);
      if (planarDistance(next, desired) > .1) { j.stuck += dt; if (j.stuck > .4) this.cancel('physical_obstacle'); this._syncPose(dt, false); return true; }
      j.stuck = 0; this.skimmer.position.copy(next); remaining -= stride;
      this.skimmer.rotationY = Math.atan2(direction.x, direction.z);
    }
    this._syncPose(dt, true);
    if (j.waypoint >= j.waypoints.length) { this.lastResult = { accepted: true, reason: 'arrived', targetId: j.toId, duration: j.elapsed }; this.feedback('Transport arrivé. E pour débarquer.'); this.journey = null; }
    return true;
  }
  _syncPose(delta, moving) {
    this.skimmer.mesh.position.copy(this.skimmer.position); this.skimmer.mesh.rotation.y = this.skimmer.rotationY;
    if (this.driver) { this.driver.position.copy(this.skimmer.position); this.driver.mesh.position.copy(this.driver.position); }
    this.skimmer.updateVisual(delta, moving);
  }
  getState() { return this.journey ? { active: true, targetId: this.journey.toId, remaining: Math.max(0, this.journey.duration - this.journey.elapsed), boarding: this.journey.boarding > 0 } : { active: false, result: this.lastResult }; }
  dispose() { this.journey = null; if (this.driver?.mesh) this.driver.mesh.visible = true; this.driver = null; this.skimmer.isMounted = false; }
}
