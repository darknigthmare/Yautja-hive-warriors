import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { OrbitalStrikeManager } from '../js/engine/OrbitalStrike.js';
import { createMissionSupportContext } from '../js/engine/MissionRuntimeContext.js';
import { canAccessLegacyAir, canHitLegacyAirTarget } from '../js/engine/LegacyAirstrikePolicy.js';
import { traceCombatSegment } from '../js/engine/CombatGeometry.js';

function context(colliders = []) {
  return createMissionSupportContext({ missionId: 'legacy-roof-test', levelId: 'la_rooftops', fidelityMode: 'adapted',
    environment: { traceSegment: (from, to, options) => traceCombatSegment(from, to, colliders, options) } });
}
const roof = (x = 0, z = 0, halfWidth = 10, halfDepth = 10) => ({ x, z, halfWidth, halfDepth, minY: 4, maxY: 5, height: 5 });
function playerFixture(supportContext) {
  const calls = [], intervals = [], effects = new Set();
  return { calls, intervals, effects, player: { missionSupportContext: supportContext, position: new THREE.Vector3(), rotationY: 0,
    hp: 1000, plasmaEnergy: 100, dropshipBombingCooldown: 0, activeDropshipBombs: [], canUseArsenalEquipment: () => true,
    schedule(callback) { calls.push(callback); return calls.length; }, scheduleInterval(callback) { intervals.push(callback); return intervals.length; },
    cancelTimer() {}, _addOwnedEffect(effect) { effects.add(effect); }, _removeOwnedEffect(effect) { effects.delete(effect); },
    _canDamageLegacyAlien: () => true, _canHitLegacyAlien: () => true, _defeatLegacyAlien() {} } };
}

test('legacy access uses physical sky rays for every footprint point and refuses unknown/era contexts', () => {
  assert.equal(canAccessLegacyAir(context(), new THREE.Vector3(), 4.8), true);
  assert.equal(canAccessLegacyAir(context([roof()]), new THREE.Vector3(), 4.8), false);
  assert.equal(canAccessLegacyAir(undefined, new THREE.Vector3()), false);
  assert.equal(canAccessLegacyAir(createMissionSupportContext({ missionId: 'prey', levelId: 'prey_comanche_territory', fidelityMode: 'faithful', environment: { traceSegment: () => null } }), new THREE.Vector3()), false);
  const queried = [];
  assert.equal(canAccessLegacyAir({ allowed: true, canAccessAir: point => { queried.push(point.toArray()); return true; } }, new THREE.Vector3(20, 0, 30), 5), true);
  assert.equal(queried.length, 9); assert.ok(queried.some(point => point[0] === 25));
});

test('orbital refuses a hangar before cooldown, effects, actor damage or boss damage and permits outdoors', () => {
  const scene = new THREE.Scene(), orbital = new OrbitalStrikeManager(scene, { playMusouBlast() {} });
  let hits = 0, bossDamage = 0;
  const alien = { mesh: new THREE.Group(), hp: 2000 }, boss = { activeBoss: { mesh: new THREE.Group() }, takeDamage(amount) { bossDamage += amount; } };
  const horde = { aliens: [alien], checkMeleeHits() { hits++; return []; } };
  orbital.supportContext = context([roof()]);
  assert.equal(orbital.triggerStrike(new THREE.Vector3(), horde, boss, {}), false);
  assert.equal(orbital.cooldown, 0); assert.equal(scene.children.length, 0); assert.equal(hits, 0); assert.equal(bossDamage, 0); assert.equal(alien.hp, 2000);
  orbital.supportContext = context(); assert.equal(orbital.triggerStrike(new THREE.Vector3(), horde, boss, {}), true);
  assert.equal(orbital.cooldown, 30); assert.equal(hits, 1); assert.equal(bossDamage, 2000); orbital.clear();
});

test('an open orbital origin cannot damage a separate covered boss or alien within its radius', () => {
  const scene = new THREE.Scene(), orbital = new OrbitalStrikeManager(scene, { playMusouBlast() {} });
  const covered = { mesh: new THREE.Group() }; covered.mesh.position.set(10, 0, 0);
  orbital.supportContext = context([roof(10, 0, 1, 1)]);
  let alienDamage = 0, bossDamage = 0;
  assert.equal(canHitLegacyAirTarget(orbital.supportContext, covered), false);
  assert.equal(orbital.triggerStrike(new THREE.Vector3(), { aliens: [covered], checkMeleeHits() { alienDamage++; return []; } },
    { activeBoss: covered, takeDamage() { bossDamage++; } }, {}), true);
  assert.equal(alienDamage, 0); assert.equal(bossDamage, 0); orbital.clear();
});

test('infiltration refuses a covered distant impact before any cooldown, resource or scheduled effect changes', () => {
  const { player, calls, effects } = playerFixture(context([roof(0, 25.2, 2, 2)]));
  assert.equal(Player.prototype.callInfiltrationDropshipBombing.call(player, { aliens: [] }, {}, {}, {}), false);
  assert.equal(player.dropshipBombingCooldown, 0); assert.equal(player.hp, 1000); assert.equal(player.plasmaEnergy, 100);
  assert.equal(calls.length, 0); assert.equal(effects.size, 0); assert.equal(player.activeDropshipBombs.length, 0);
});

test('an accepted infiltration rechecks the real roof at delayed impacts and cancels pending damage', () => {
  const colliders = [], { player, calls } = playerFixture(context(colliders));
  const alien = { mesh: new THREE.Group(), hp: 1000 }; alien.mesh.position.z = 4.2;
  let bossDamage = 0;
  assert.equal(Player.prototype.callInfiltrationDropshipBombing.call(player, { aliens: [alien] }, { activeBoss: alien, takeDamage() { bossDamage++; } }, {}, {}), true);
  assert.equal(player.dropshipBombingCooldown, 28); assert.equal(calls.length, 6);
  colliders.push(roof(0, 14, 15, 25)); for (const callback of calls) callback();
  assert.equal(alien.hp, 1000); assert.equal(bossDamage, 0); assert.equal(player.activeDropshipBombs.length, 0);
  assert.equal(player.dropshipBombingCooldown, 28, 'A later cancelled strike does not refund its existing cooldown');
});

test('outdoor infiltration emits its six existing impacts and closed roofs also stop subsequent burn ticks', () => {
  const colliders = [], { player, calls } = playerFixture(context(colliders));
  const alien = { mesh: new THREE.Group(), hp: 10000 }; alien.mesh.position.z = 4.2;
  assert.equal(Player.prototype.callInfiltrationDropshipBombing.call(player, { aliens: [alien] }, {}, {}, {}), true);
  for (const callback of calls) callback(); assert.equal(player.activeDropshipBombs.length, 6); assert.ok(alien.hp < 10000);
  const hp = alien.hp; colliders.push(roof(0, 14, 15, 25));
  Player.prototype.updateDualPlasmaBeam.call(player, .25, { aliens: [alien] }, {}, {});
  assert.equal(alien.hp, hp); assert.equal(player.activeDropshipBombs.length, 0);
});
