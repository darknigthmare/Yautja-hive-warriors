/* Original playable crossing: two ramps, a raised deck and a visible gap.
 * It demonstrates terrain destruction, not a measured film location. */
import * as THREE from 'three';

export function makeTacticalBridgeSpec(layout) {
  if (layout.mapId !== 'LD-01' || !layout.strategicMode) return null;
  const route = layout.strategicRoutes.find(route => route.id === 'route-insertion-relay-flank');
  if (!route || route.waypoints.length < 4) return null;
  const a = route.waypoints[1], b = route.waypoints[2], axis = a[0] === b[0] ? 'z' : 'x';
  return { id: 'bridge-LD01-north', routeId: route.id, corridorId: 'tactical-0-2', axis,
    center: [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], halfSpan: 24, plateauHalf: 12,
    halfWidth: layout.corridorWidth / 2 - .5, height: 3, maxHp: 600,
    provenance: 'Original tactical bridge, no measured screen reconstruction' };
}

export class TacticalBridge {
  constructor(environment, spec) {
    this.environment = environment; this.spec = spec; this.id = spec.id;
    this.hp = spec.maxHp; this.destroyed = false; this.collapseTime = 0; this.sabotage = null;
    this.fallingActors = new Map(); this.raycaster = new THREE.Raycaster();
    const e = environment, s = spec;
    this.root = new THREE.Group(); this.root.name = s.id; this.root.position.set(s.center[0], 0, s.center[1]);
    if (s.axis === 'z') this.root.rotation.y = Math.PI / 2;
    e.root.add(this.root);
    this.deck = new THREE.Group(); this.deck.name = `${s.id}-walkable-deck`; this.root.add(this.deck);
    e.box(e.wallMat, [0, s.height - .18, 0], [s.plateauHalf * 2, .36, s.halfWidth * 2], this.deck);
    const rampRun = s.halfSpan - s.plateauHalf, rampLength = Math.hypot(rampRun, s.height);
    for (const side of [-1, 1]) {
      const ramp = e.box(e.wallMat, [side * (s.plateauHalf + rampRun / 2), s.height / 2 - .18, 0], [rampLength, .36, s.halfWidth * 2], this.deck);
      ramp.rotation.z = -side * Math.atan2(s.height, rampRun);
      for (const z of [-s.halfWidth, s.halfWidth]) {
        e.box(e.trimMat, [side * (s.plateauHalf + rampRun / 2), s.height / 2 + .15, z], [rampLength, .14, .22], this.deck).rotation.z = ramp.rotation.z;
      }
    }
    // Rail posts leave the crossing's full useful central width available.
    for (const z of [-s.halfWidth, s.halfWidth]) {
      e.box(e.trimMat, [0, s.height + .9, z], [s.plateauHalf * 2, .16, .18], this.deck);
      for (const x of [-10, 0, 10]) e.box(e.wallMat, [x, s.height + .4, z], [.18, 1, .18], this.deck);
    }
    const pit = e.box(e.darkMat, [0, -5.2, 0], [s.halfSpan * 2, .4, s.halfWidth * 2 + 1], this.root); pit.name = `${s.id}-visible-gap`;
    this.console = e.box(e.trimMat, [-s.halfSpan - 3, .8, -s.halfWidth + 2], [1, 1.6, 1], this.root);
    this.console.name = `${s.id}-sabotage-console`;
    this.consolePosition = new THREE.Vector3(); this.root.updateMatrixWorld(true); this.console.getWorldPosition(this.consolePosition);
    const halfX = s.axis === 'x' ? s.halfSpan : s.halfWidth, halfZ = s.axis === 'z' ? s.halfSpan : s.halfWidth;
    this.gapCollider = { x: s.center[0], z: s.center[1], halfWidth: halfX, halfDepth: halfZ,
      rotation: 0, height: Infinity, owner: s.id, enabled: false, blocksProjectiles: false,
      resolveMovement: (position, radius) => {
        if (!this.destroyed || this.fallingActors.has(position) || position.y < -1) return;
        const along = s.axis === 'x' ? position.x - s.center[0] : position.z - s.center[1];
        const across = s.axis === 'x' ? position.z - s.center[1] : position.x - s.center[0];
        if (Math.abs(along) > s.halfSpan + radius || Math.abs(across) > s.halfWidth + radius) return;
        position[s.axis] = s.center[s.axis === 'x' ? 0 : 1] + Math.sign(along || 1) * (s.halfSpan + radius);
      } };
    e.colliders.push(this.gapCollider);
    const deckHalfX = s.axis === 'x' ? s.plateauHalf : s.halfWidth, deckHalfZ = s.axis === 'z' ? s.plateauHalf : s.halfWidth;
    this.deckCollider = { x: s.center[0], z: s.center[1], halfWidth: deckHalfX, halfDepth: deckHalfZ,
      rotation: 0, baseY: s.height - .36, height: .36, owner: s.id, enabled: true, blocksMovement: false, blocksNavigation: false,
      // A walkable support must block downward bolts while permitting walkers
      // to traverse its top. The callback never uses render visibility.
      resolveMovement: (position, radius) => {
        const surface = this.elevationAt(position.x, position.z);
        if (this.destroyed || surface === null || position.y >= surface - .25 || position.y + 2.4 <= surface - .36) return;
        const dx = position.x - s.center[0], dz = position.z - s.center[1];
        const along = s.axis === 'x' ? dx : dz, across = s.axis === 'x' ? dz : dx;
        if (Math.abs(along) > s.halfSpan + radius || Math.abs(across) > s.halfWidth + radius) return;
        const coordinate = Math.abs(along) <= s.plateauHalf && s.plateauHalf - Math.abs(along) < s.halfWidth - Math.abs(across) ? s.axis : (s.axis === 'x' ? 'z' : 'x');
        const value = coordinate === s.axis ? along : across, half = coordinate === s.axis ? s.plateauHalf : s.halfWidth;
        position[coordinate] = s.center[coordinate === 'x' ? 0 : 1] + Math.sign(value || 1) * (half + radius);
      }, isCollisionActive: () => !this.destroyed };
    this.deckCollider.traceSegment = (from, to) => this.traceDeck(from, to);
    e.colliders.push(this.deckCollider);
    for (const side of [-1, 1]) {
      const x = s.center[0] + (s.axis === 'x' ? side * 8 : 0), z = s.center[1] + (s.axis === 'z' ? side * 8 : 0);
      const post = { x, z, halfWidth: s.axis === 'x' ? 1 : s.halfWidth, halfDepth: s.axis === 'z' ? 1 : s.halfWidth,
        baseY: -5, height: s.height - .35 + 5, rotation: 0, enabled: true, owner: `${s.id}-support`, blocksNavigation: false, isCollisionActive: () => !this.destroyed };
      e.colliders.push(post);
      e.box(e.wallMat, [side * 8, (s.height - 5) / 2 - .2, 0], [2, s.height + 5 - .4, s.halfWidth * 2], this.deck);
    }
    this.root.userData.tacticalBridge = { id: s.id, routeId: s.routeId, destructible: true, geometryProvenance: s.provenance };
  }

  elevationAt(x, z) {
    const s = this.spec, along = s.axis === 'x' ? x - s.center[0] : z - s.center[1];
    const across = s.axis === 'x' ? z - s.center[1] : x - s.center[0];
    if (Math.abs(along) > s.halfSpan || Math.abs(across) > s.halfWidth) return null;
    if (this.destroyed) return -5;
    return s.height * Math.min(1, (s.halfSpan - Math.abs(along)) / (s.halfSpan - s.plateauHalf));
  }

  interact(player) {
    if (this.sabotage || !player?.position || player.hp <= 0 || player.position.distanceTo(this.consolePosition) > 5) return false;
    this.sabotage = { player, action: this.destroyed ? 'repair' : 'destroy', remaining: this.destroyed ? 6 : 3 };
    this.environment.game?.ui?.showAnnouncement(this.destroyed ? 'RECONSTRUCTION DU PONT : protégez le dispositif pendant 6 secondes.' : 'SABOTAGE DU PONT : restez près du dispositif pendant 3 secondes.');
    return true;
  }

  repair() {
    if (!this.destroyed) return false;
    this.destroyed = false; this.hp = this.spec.maxHp; this.collapseTime = 0; this.sabotage = null;
    this.deck.position.set(0, 0, 0); this.deck.rotation.set(0, 0, 0); this.deck.visible = true;
    this.deckCollider.enabled = true; this.gapCollider.enabled = false;
    for (const state of this.fallingActors.values()) delete state.actor._terrainFall;
    this.fallingActors.clear();
    this.environment.navigation.gridCache.clear(); this.environment.navigation.actorPaths = new WeakMap();
    const route = this.environment.battlefieldLayout.strategicRoutes.find(route => route.id === this.spec.routeId); route.open = true;
    const simulation = this.environment.game?.battleSimulation;
    const bound = [...(simulation?.routes?.values() ?? [])].find(route => route.id === this.spec.routeId || route.physicalRouteId === this.spec.routeId || route.id === `bound-${this.spec.routeId}`);
    if (bound) simulation.setRouteOpen(bound.id, true, 'bridge_repaired');
    this.environment.onTerrainChanged?.({ type: 'bridge_repaired', bridgeId: this.id, routeId: this.spec.routeId });
    return true;
  }

  damage(amount, cause = 'player-sabotage') {
    if (this.destroyed || !Number.isFinite(amount) || amount <= 0) return false;
    this.hp = Math.max(0, this.hp - amount);
    if (this.hp) return true;
    const game = this.environment.game;
    const actors = [game?.player, game?.player2, ...(game?.horde?.aliens ?? []), ...(game?.marines?.marines ?? []), ...(game?.allies?.allies ?? []), ...(game?.synthetics?.androids ?? [])];
    for (const actor of actors) {
      const position = actor?.position ?? actor?.mesh?.position;
      if (!position || actor.hp <= 0 || actor.isFlying || actor.flying || this.elevationAt(position.x, position.z) === null || position.y < .5) continue;
      const state = { actor, position, height: position.y, velocity: 0, landed: false, player: actor === game?.player || actor === game?.player2 };
      this.fallingActors.set(position, state); actor._terrainFall = state;
    }
    this.destroyed = true; this.deckCollider.enabled = false; this.gapCollider.enabled = true; this.sabotage = null;
    this.environment.navigation.gridCache.clear(); this.environment.navigation.actorPaths = new WeakMap();
    const route = this.environment.battlefieldLayout.strategicRoutes.find(route => route.id === this.spec.routeId); route.open = false;
    const simulation = this.environment.game?.battleSimulation;
    const bound = [...(simulation?.routes?.values() ?? [])].find(route => route.id === this.spec.routeId || route.physicalRouteId === this.spec.routeId || route.id === `bound-${this.spec.routeId}`);
    if (bound) simulation.setRouteOpen(bound.id, false, 'bridge_destroyed');
    this.environment.onTerrainChanged?.({ type: 'bridge_destroyed', bridgeId: this.id, routeId: this.spec.routeId, cause });
    return true;
  }

  update(delta) {
    for (const [position, state] of this.fallingActors) {
      const height = this.elevationAt(position.x, position.z);
      if (height === null || state.actor.hp <= 0) { delete state.actor._terrainFall; this.fallingActors.delete(position); continue; }
      if (!state.landed) {
        state.velocity -= 26 * delta; state.height = Math.max(-5, state.height + state.velocity * delta);
        position.y = state.height;
        if (state.height <= -5) {
          state.landed = true; delete state.actor._terrainFall;
          if (state.player) state.actor.takeDamage?.(30, false, null, { cause: 'terrain-fall' });
          else if (this.environment.game?.horde?.aliens?.includes(state.actor)) this.environment.game.horde.applyDamage?.(state.actor, 30, { cause: 'environment-bridge-collapse', killerFaction: 'neutral' });
          else {
            state.actor.lastDamageFaction = 'neutral'; state.actor.hp = Math.max(0, state.actor.hp - 30);
            if (state.actor.hp <= 0) {
              const details = { cause: 'environment-bridge-collapse', killerFaction: 'neutral' }, game = this.environment.game;
              if (game?.marines?.marines?.includes(state.actor)) game.marines.defeatCombatant?.(state.actor, details);
              else if (game?.allies?.allies?.includes(state.actor)) game.allies.defeatCombatant?.(state.actor, details);
              else if (game?.synthetics?.androids?.includes(state.actor)) game.synthetics.defeatSynthetic?.(state.actor, details);
            }
          }
        }
        state.actor.mesh?.position.copy(position);
      }
    }
    if (this.sabotage) {
      const { player } = this.sabotage;
      if (player.hp <= 0 || player.position.distanceTo(this.consolePosition) > 5) this.sabotage = null;
      else { this.sabotage.remaining -= delta; if (this.sabotage.remaining <= 0) { if (this.sabotage.action === 'repair') this.repair(); else this.damage(this.spec.maxHp); } }
    }
    if (!this.destroyed || this.collapseTime >= 1) return;
    this.collapseTime = Math.min(1, this.collapseTime + delta);
    this.deck.position.y = -5 * this.collapseTime * this.collapseTime; this.deck.rotation.z = this.collapseTime * .3;
    if (this.collapseTime >= 1) this.deck.visible = false;
  }

  traceDeck(from, to) {
    if (this.destroyed) return null;
    const direction = new THREE.Vector3().subVectors(to, from), length = direction.length();
    if (length < 1e-8) return null;
    this.root.updateMatrixWorld(true); this.raycaster.set(from, direction.divideScalar(length)); this.raycaster.near = 0; this.raycaster.far = length;
    const hit = this.raycaster.intersectObject(this.deck, true)[0]; if (!hit) return null;
    const normal = hit.face?.normal.clone().applyMatrix3(new THREE.Matrix3().getNormalMatrix(hit.object.matrixWorld)).normalize() ?? new THREE.Vector3(0, 1, 0);
    return { point: hit.point, distance: hit.distance, t: hit.distance / length, normal, collider: this.deckCollider };
  }

  dispose() { for (const state of this.fallingActors.values()) delete state.actor._terrainFall; this.fallingActors.clear(); this.sabotage = null; }

  serialize() { return { id: this.id, hp: this.hp, destroyed: this.destroyed }; }
  restore(saved) { if (saved?.id !== this.id || !Number.isFinite(saved.hp) || saved.hp < 0 || saved.hp > this.spec.maxHp || Boolean(saved.destroyed) !== (saved.hp === 0)) return false; if (saved.destroyed) this.damage(this.spec.maxHp, 'restored-destruction'); else { this.repair(); this.hp = saved.hp; } return true; }
}
