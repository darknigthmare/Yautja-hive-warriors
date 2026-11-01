import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { humanSquadRole, hasFriendlyFireLane } from '../js/engine/FactionSquadRoles.js';
import { emitNPCShot, updateNPCShots } from '../js/graphics/NPCCombatFeedback.js';

const audio = new Proxy({}, { get: () => () => {} });
const player = x => ({ hp: 10000, position: new THREE.Vector3(x, 0, 0), hits: [], takeDamage(damage, _, source) { this.hp -= damage; this.hits.push(source.battleUnitId); } });
const unit = (id, actorType = 'marine', position = [0, 0], role = 'line') =>
  ({ id, actorType, species: actorType === 'marine' ? 'human' : 'synthetic', groupId: 'section', factionId: 'opposition', position, role, hp: 150, maxHp: 150 });
function bind(manager) {
  manager.battleSimulation = { time: 0, groups: new Map(), fronts: new Map([['home', { position: [0, 0] }]]), config: { playerFaction: 'player' }, areHostile: (a, b) => a !== b };
  manager.environment = { hasLineOfSight: () => true, resolveAgentMovement() {} };
  return manager;
}
const group = ids => ({ id: 'section', units: ids, frontId: 'home', reserveOriginId: 'home', position: [0, 0], targetPosition: [70, 0], order: { type: 'attack' } });

test('ordinary allocated soldiers retain rifle weapons and stable tactical roles after reverse materialization', () => {
  const spec = group(['a', 'b', 'c', 'd']);
  const manager = bind(new ColonialMarinesManager(new THREE.Scene(), audio));
  const first = manager.spawnBattleUnit(unit('a'), spec), point = manager.spawnBattleUnit(unit('b'), spec);
  assert.equal(first.type, 'marine'); assert.equal(point.type, 'marine');
  assert.equal(first.squadRole, 'rifleman'); assert.equal(point.squadRole, 'pointman');
  manager.despawnBattleUnit('b');
  assert.equal(manager.spawnBattleUnit(unit('b'), spec).squadRole, 'pointman');
  assert.equal(humanSquadRole(unit('c', 'marine', [0, 0], 'heavy'), spec), 'rifleman', 'a tactical role does not invent an unallocated smartgun');
  manager.clearSquad();
});

test('an actual fire team alternates movement and covering fire without changing damage or identity', () => {
  const scene = new THREE.Scene(), manager = bind(new ColonialMarinesManager(scene, audio));
  const spec = group(['rifle', 'point']);
  const rifle = manager.spawnBattleUnit(unit('rifle', 'marine', [0, -2]), spec);
  const point = manager.spawnBattleUnit(unit('point', 'marine', [0, 2]), spec);
  const target = player(18);
  for (let i = 0; i < 26; i++) manager.update(.1, target, { aliens: [] });
  assert.equal(rifle.mesh.position.x, 0); assert.ok(point.mesh.position.x > 3);
  assert.equal(rifle.tacticalState, 'covering'); assert.ok(target.hits.includes('rifle'), 'the stationary soldier really fires');
  const firstX = rifle.mesh.position.x;
  for (let i = 0; i < 8; i++) manager.update(.1, target, { aliens: [] });
  assert.ok(rifle.mesh.position.x > firstX, 'the second rank advances during its next window');
  assert.deepEqual(manager.marines.map(actor => actor.battleUnitId), ['rifle', 'point']);
  manager.clearSquad(); assert.equal(scene.children.length, 0);
});

test('a wounded human withdraws physically, releases its attack and gains neither HP nor immunity', () => {
  const manager = bind(new ColonialMarinesManager(new THREE.Scene(), audio));
  const actor = manager.spawnBattleUnit(unit('wounded'), group(['wounded'])); actor.hp = 25;
  const target = player(5); actor._localAttackPreparation = { target, kind: 'ranged', elapsed: .7, windup: .8 };
  for (let i = 0; i < 7; i++) manager.update(.1, target, { aliens: [] });
  assert.ok(actor.mesh.position.x < -3.5); assert.equal(actor.hp, 25);
  assert.equal(actor._localAttackPreparation, null); assert.equal(target.hits.length, 0);
  assert.ok(actor.mesh.position.distanceTo(target.position) < 10, 'withdrawal is a finite gap, not fleeing off the map');
  for (let i = 0; i < 30; i++) manager.update(.1, target, { aliens: [] });
  assert.ok(target.hits.length > 0, 'a completed withdrawal does not permanently disarm the soldier');
  manager.clearSquad();
});

test('a friendly body blocks an ordinary shot and the rear soldier finds a lateral lane', () => {
  const manager = bind(new ColonialMarinesManager(new THREE.Scene(), audio)), spec = group(['rear', 'front']);
  const rear = manager.spawnBattleUnit(unit('rear'), spec), front = manager.spawnBattleUnit(unit('front', 'marine', [8, 0]), spec);
  const target = player(18);
  assert.equal(hasFriendlyFireLane(rear, target.position, manager.marines), false);
  manager.update(.1, target, { aliens: [] });
  assert.ok(Math.abs(rear.mesh.position.z) > .1); assert.equal(rear._localAttackPreparation, null);
  front.mesh.position.x = 22;
  assert.equal(hasFriendlyFireLane(rear, target.position, manager.marines), true, 'a body behind the target does not occlude it');
  front.mesh.position.set(8, 8, 0);
  assert.equal(hasFriendlyFireLane(rear, target.position, manager.marines), true, 'another floor does not occlude a shot');
  manager.clearSquad();
});

test('an industrial synthetic remains in its service area while security pursues the same distant intrusion', () => {
  const joeManager = bind(new SyntheticsManager(new THREE.Scene(), audio));
  const securityManager = bind(new SyntheticsManager(new THREE.Scene(), audio));
  const joe = joeManager.spawnBattleUnit(unit('joe', 'working_joe'), group(['joe']));
  const guard = securityManager.spawnBattleUnit(unit('guard', 'weyland_combat'), group(['guard']));
  const target = player(70);
  for (let i = 0; i < 90; i++) { joeManager.update(.1, target, { aliens: [] }); securityManager.update(.1, target, { aliens: [] }); }
  assert.ok(joe.mesh.position.length() < 3); assert.equal(joe.mesh.userData.syntheticState, 'service');
  assert.ok(guard.mesh.position.x > 50); assert.ok(target.hits.includes('guard')); assert.equal(target.hits.includes('joe'), false);
  joeManager.clearSquad(); securityManager.clearSquad();
});

test('a Working Joe gives a visible timed warning before containment and a civilian never attacks', () => {
  const manager = bind(new SyntheticsManager(new THREE.Scene(), audio));
  const joe = manager.spawnBattleUnit(unit('joe', 'working_joe'), group(['joe']));
  const civilian = manager.spawnBattleUnit(unit('civil', 'synthetic', [-3, 0], 'civilian'), group(['civil']));
  assert.equal(civilian.mesh.getObjectByName('gun'), undefined, 'a service civilian has no military rifle');
  const target = player(2);
  for (let i = 0; i < 10; i++) manager.update(.1, target, { aliens: [] });
  assert.equal(target.hits.length, 0); assert.equal(joe.mesh.userData.syntheticState, 'intrusion-warning');
  assert.ok(joe.mesh.getObjectByName('synthetic-intrusion-warning').visible);
  for (let i = 0; i < 80; i++) manager.update(.1, target, { aliens: [] });
  assert.ok(target.hits.includes('joe')); assert.equal(target.hits.includes('civil'), false);
  assert.equal(joe.intrusionWarning.visible, false); assert.equal(civilian.mesh.userData.syntheticState, 'avoid-intrusion');
  target.position.x = 70; manager.update(.1, target, { aliens: [] });
  assert.equal(joe.intrusionTime, 0); assert.equal(joe.intrusionTarget, null);
  manager.clearSquad();
});

test('real hits emit bounded tracers and impacts, cover emits none, and all owned feedback buffers dispose', () => {
  const scene = new THREE.Scene(), manager = bind(new ColonialMarinesManager(scene, audio));
  const actor = manager.spawnBattleUnit(unit('shooter'), group(['shooter']));
  const target = player(12); manager.environment.hasLineOfSight = () => false;
  for (let i = 0; i < 30; i++) manager.update(.1, target, { aliens: [] });
  assert.equal(target.hits.length, 0); assert.equal(manager.npcShotEffects?.length ?? 0, 0);
  manager.environment.hasLineOfSight = () => true; actor.mesh.position.set(0, 0, 0);
  let seen = false;
  for (let i = 0; i < 60; i++) { manager.update(.1, target, { aliens: [] }); if (manager.npcShotEffects?.length) seen = true; }
  assert.equal(seen, true); assert.ok(target.hits.length > 0);
  for (let i = 0; i < 40; i++) emitNPCShot(manager, new THREE.Vector3(), target.position);
  assert.equal(manager.npcShotEffects.length, 16);
  let disposed = 0;
  for (const effect of manager.npcShotEffects) effect.mesh.traverse(node => node.geometry?.addEventListener('dispose', () => disposed++));
  updateNPCShots(manager, .3); assert.equal(manager.npcShotEffects.length, 0); assert.equal(disposed, 32);
  manager.clearSquad(); assert.equal(scene.children.length, 0);
});

test('two real hostile NPC managers exchange damage and visible impacts while the player remains out of contact', () => {
  const scene = new THREE.Scene(), marines = bind(new ColonialMarinesManager(scene, audio)), synthetics = bind(new SyntheticsManager(scene, audio));
  const marine = marines.spawnBattleUnit(unit('marine'), group(['marine']));
  const security = synthetics.spawnBattleUnit({ ...unit('security', 'weyland_combat', [12, 0]), factionId: 'corporate' }, group(['security']));
  const provider = () => [...marines.marines, ...synthetics.androids];
  marines.combatActorsProvider = synthetics.combatActorsProvider = provider;
  const target = player(900); let marineFX = false, syntheticFX = false;
  for (let i = 0; i < 120; i++) {
    marines.update(.05, target, { aliens: [] }); synthetics.update(.05, target, { aliens: [] });
    marineFX ||= (marines.npcShotEffects?.length ?? 0) > 0;
    syntheticFX ||= (synthetics.npcShotEffects?.length ?? 0) > 0;
  }
  assert.ok(marine.hp > 0 && marine.hp < 150); assert.ok(security.hp > 0 && security.hp < 150);
  assert.equal(marineFX, true); assert.equal(syntheticFX, true); assert.equal(target.hp, 10000); assert.equal(target.hits.length, 0);
  assert.equal(marine.lastDamageFaction, 'corporate'); assert.equal(security.lastDamageFaction, 'opposition');
  marines.clearSquad(); synthetics.clearSquad(); assert.equal(scene.children.length, 0);
});
