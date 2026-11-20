import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';

/* AUD-028: a security synthetic and an industrial one react differently to an intrusion and the
 * industrial one stays bound to its post. Real managers, real battle units (AFF-16 and AFF-13). */
const audio = new Proxy({}, { get: () => () => {} });
function runtime(operationId) {
  const { config } = createOperationScene({ operationId, mapSeed: 0 }), scene = new THREE.Scene();
  const env = { hasLineOfSight: () => true, resolveAgentMovement() {}, resolveMovement() {}, getElevationAt: () => 0 };
  const recorder = kind => ({ kind, spawnBattleUnit(unit) { return { mesh: { position: new THREE.Vector3(unit.position[0], 0, unit.position[1]), userData: {} }, battleUnitId: unit.id, type: unit.actorType, radius: 1, hp: 100 }; }, despawnBattleUnit() { return null; } });
  const marines = new ColonialMarinesManager(scene, audio), synthetics = new SyntheticsManager(scene, audio);
  const game = { horde: recorder('xenomorph'), marines, allies: recorder('yautja'), synthetics, bosses: recorder('queen'), env, player: null, player2: null };
  const bridge = new BattleActorBridge(game);
  const sim = new BattleSimulation(config, { spawnGroup: (group, units) => bridge.spawnGroup(group, units), despawnGroup: (group, units) => bridge.despawnGroup(group, units) });
  bridge.simulation = sim;
  for (const manager of [marines, synthetics]) { manager.battleSimulation = sim; manager.environment = env; }
  return { sim, synthetics, dispose() { sim.dispose(); marines.clearSquad?.(); synthetics.clearSquad?.(); } };
}
function firstSynthetic(world, type) {
  for (const front of world.sim.fronts.values()) {
    world.sim.update(.25, { players: [{ id: 'player1', hp: 100, position: [...front.position] }] });
    const actor = world.synthetics.androids.find(item => item.type === type && item.hp > 0);
    if (actor) return actor;
  }
  return null;
}
const intruder = position => ({ hp: 1000, position, isCloaked: false, takeDamage() {}, mesh: { position } });

test('an industrial Working Joe warns, then contains, and returns to its post when the intruder leaves', () => {
  const world = runtime('AFF-13');
  try {
    const joe = firstSynthetic(world, 'working_joe');
    assert.ok(joe, 'AFF-13 renders a Working Joe');
    assert.equal(joe.syntheticDuty, 'industrial');
    const near = intruder(joe.serviceAnchor.clone().add(new THREE.Vector3(4, 0, 0)));
    world.synthetics.hostileToPlayers = true;
    world.synthetics.update(.25, near, { aliens: [] });
    const states = [joe.mesh.userData.syntheticState];
    for (let i = 0; i < 8; i++) { world.synthetics.update(.25, near, { aliens: [] }); states.push(joe.mesh.userData.syntheticState); }
    assert.ok(states.includes('intrusion-warning'), `warns first: ${states.join(',')}`);
    const far = intruder(joe.serviceAnchor.clone().add(new THREE.Vector3(80, 0, 0)));
    world.synthetics.update(.25, far, { aliens: [] });
    assert.ok(['service', 'avoid-intrusion'].includes(joe.mesh.userData.syntheticState), `stays bound to its post: ${joe.mesh.userData.syntheticState}`);
  } finally { world.dispose(); }
});

test('a Weyland-Yutani security synthetic engages without the service warning', () => {
  const world = runtime('AFF-16');
  try {
    const guard = firstSynthetic(world, 'weyland_combat');
    assert.ok(guard, 'AFF-16 renders a combat synthetic');
    assert.equal(guard.syntheticDuty, 'security');
    const far = intruder(guard.mesh.position.clone().add(new THREE.Vector3(30, 0, 0)));
    world.synthetics.hostileToPlayers = true;
    const states = [];
    for (let i = 0; i < 8; i++) { world.synthetics.update(.25, far, { aliens: [] }); states.push(guard.mesh.userData.syntheticState); }
    assert.equal(states.includes('intrusion-warning'), false, `no service warning: ${states.join(',')}`);
  } finally { world.dispose(); }
});
