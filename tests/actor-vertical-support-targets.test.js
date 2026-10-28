import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';

const audio = new Proxy({}, { get: () => () => {} });
const unit = (id, actorType, position = [0, 0]) => ({ id, actorType, position, hp: 150, maxHp: 150, factionId: 'dark_hive' });
function player(position) {
  return { hp: 1000, position, hits: [], takeDamage(amount, _, source) { this.hp -= amount; this.hits.push({ amount, position: source?.mesh?.position.clone() }); },
    triggerFacehuggerLatch() { this.isFacehuggerLatched = true; } };
}
function catwalkFixture() {
  const e = new EnvironmentManager(new THREE.Scene()); e.halfSize = 500;
  e.root = new THREE.Group(); e.referenceRoot = new THREE.Group(); e.root.add(e.referenceRoot);
  e.scene.add(e.root); e.envObjects.push(e.root); e.buildIndustrialCatwalks(); return e;
}

test('a real warrior below a player uses the complete ramp before its first 3D melee strike', () => {
  const e = catwalkFixture(), horde = new XenomorphHorde(e.scene, audio), director = new CombatDirector({ graceSeconds: 0 });
  horde.environment = e; horde.combatDirector = director;
  const actor = horde.spawnBattleUnit(unit('upper-warrior', 'warrior', [-28, 18]));
  const target = player(new THREE.Vector3(-28, 5.4, 18)); let passedFoot = false, maxStep = 0;
  for (let frame = 0; frame < 2400 && !target.hits.length; frame++) {
    const before = actor.mesh.position.clone(); director.update(1 / 60, [target]); horde.update(1 / 60, target);
    maxStep = Math.max(maxStep, actor.mesh.position.distanceTo(before));
    if (actor.mesh.position.z >= 44 && actor.mesh.position.y < .5) passedFoot = true;
    if (actor.mesh.position.y < 4.8) assert.equal(target.hits.length, 0, 'no damage through the visible deck');
  }
  assert.equal(passedFoot, true); assert.equal(target.hits.length, 1); assert.ok(target.hits[0].position.y > 5.3);
  assert.ok(maxStep < .19); assert.ok(actor.mesh.children.length > 3);
  horde.clearWave(); e.clearEnvironment();
});

test('a real Working Joe with zero initial XZ separation climbs the access and grabs only at its real height', () => {
  const e = catwalkFixture(), manager = new SyntheticsManager(e.scene, audio), director = new CombatDirector({ graceSeconds: 0 });
  manager.environment = e; manager.combatDirector = director;
  const actor = manager.spawnBattleUnit(unit('upper-joe', 'working_joe', [-28, 18]));
  const target = player(new THREE.Vector3(-28, 5.4, 18)); let passedFoot = false, maxStep = 0;
  for (let frame = 0; frame < 3000 && !target.hits.length; frame++) {
    const before = actor.mesh.position.clone(); director.update(1 / 60, [target]); manager.update(1 / 60, target, { aliens: [] });
    maxStep = Math.max(maxStep, actor.mesh.position.distanceTo(before));
    if (actor.mesh.position.z >= 44 && actor.mesh.position.y < .5) passedFoot = true;
    if (actor.mesh.position.y < 4.8) assert.equal(target.hits.length, 0);
  }
  assert.equal(passedFoot, true); assert.equal(target.hits.length, 1); assert.ok(target.hits[0].position.y > 5.3);
  assert.ok(maxStep < .15); assert.ok(actor.mesh.children.length > 3);
  manager.clearSquad(); e.clearEnvironment();
});

test('a real warrior destroys the actual finite APC without using it as a hunter, spawn anchor or parasite host', () => {
  const scene = new THREE.Scene(), e = new EnvironmentManager(scene), apc = new APCVehicle(scene, audio, null), deaths = [];
  e.halfSize = 500;
  apc.beginMission({ missionId: 'warrior-vs-apc', allowed: true, factionId: 'player_clan', onDestroyed: event => deaths.push(event) });
  assert.equal(apc.spawn(new THREE.Vector3()), true); const combatant = apc.getCombatant();
  assert.equal(combatant.collisionOwner, 'apc'); assert.equal(combatant.canBeFacehugged, false);
  e.colliders.push(apc.getNavigationCollider());
  const horde = new XenomorphHorde(scene, audio), director = new CombatDirector({ graceSeconds: 7 });
  horde.environment = e; horde.combatDirector = director; horde.supportTargetsProvider = () => [apc.getCombatant()];
  const actor = horde.spawnBattleUnit(unit('apc-warrior', 'warrior', [8, 0]));
  const p1 = player(new THREE.Vector3(200, 0, 0)), p2 = player(new THREE.Vector3(220, 0, 0));
  for (let frame = 0; frame < 18000 && apc.hp > 0; frame++) { director.update(1 / 60, [p1, p2]); horde.update(1 / 60, p1, p2); }
  assert.equal(apc.hp, 0); assert.equal(apc.getCombatant(), null); assert.equal(deaths.length, 1);
  assert.equal(deaths[0].killerFaction, actor.factionId); assert.deepEqual(horde._livingPlayers, [p1, p2]);
  assert.equal(p1.hp, 1000); assert.equal(p2.hp, 1000); assert.equal(combatant.isFacehuggerLatched, undefined);
  assert.equal(combatant.isRoyalFacehuggerLatched, undefined); assert.equal(typeof combatant.triggerFacehuggerLatch, 'undefined');
  p2.position.copy(actor.mesh.position).add(new THREE.Vector3(1, 0, 0));
  for (let frame = 0; frame < 180 && !p2.hits.length; frame++) { director.update(1 / 60, [p1, p2]); horde.update(1 / 60, p1, p2); }
  assert.equal(p1.hp, 1000); assert.equal(p2.hits.length, 1, 'the destroyed support cannot hide the surviving cooperative target');
  horde.clearWave(); apc.clear(); e.clearEnvironment();
});

test('an allocated Working Joe respects real wall cover then destroys a hostile APC through the NPC damage contract', () => {
  const scene = new THREE.Scene(), e = new EnvironmentManager(scene), apc = new APCVehicle(scene, audio, null), deaths = [];
  e.halfSize = 500;
  apc.beginMission({ missionId: 'joe-vs-apc', allowed: true, factionId: 'player_clan', onDestroyed: event => deaths.push(event) }); apc.spawn(new THREE.Vector3());
  e.colliders.push(apc.getNavigationCollider()); e.addBoxCollider(6, 0, .3, 100, 5); const wall = e.colliders.at(-1);
  const manager = new SyntheticsManager(scene, audio); manager.environment = e;
  manager.battleSimulation = { groups: new Map(), time: 0, config: { playerFaction: 'player_clan' }, areHostile: (a, b) => a !== b };
  manager.combatActorsProvider = () => [apc.getCombatant()];
  const actor = manager.spawnBattleUnit({ ...unit('apc-joe', 'working_joe', [8, 0]), factionId: 'weyland_yutani' });
  const target = player(new THREE.Vector3(200, 0, 0));
  for (let frame = 0; frame < 180; frame++) manager.update(1 / 60, target, { aliens: [] });
  assert.equal(apc.hp, 2500, 'ignoring the target hull must not ignore a separate wall');
  e.colliders.splice(e.colliders.indexOf(wall), 1);
  for (let frame = 0; frame < 30000 && apc.hp > 0; frame++) manager.update(1 / 60, target, { aliens: [] });
  assert.equal(apc.hp, 0); assert.equal(deaths.length, 1); assert.equal(deaths[0].killerFaction, actor.factionId); assert.equal(target.hp, 1000);
  manager.clearSquad(); apc.clear(); e.clearEnvironment();
});

test('ordinary and royal facehuggers ignore both real supports and retarget an organic hunter', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio), apc = new APCVehicle(scene, audio, null), ship = new CheyenneDropship(scene, audio, null);
  const context = { missionId: 'parasite-hosts', allowed: true, factionId: 'player_clan', canAccessAir: () => true };
  apc.beginMission(context); apc.spawn(new THREE.Vector3()); ship.beginMission(context); assert.equal(ship.triggerAirstrike(new THREE.Vector3(), horde).accepted, true);
  const supports = [apc.getCombatant(), ship.getCombatant()]; horde.supportTargetsProvider = () => supports;
  const regular = horde.spawnBattleUnit(unit('ordinary-parasite', 'facehugger', [1, 0]));
  horde.spawnRoyalFacehugger(new THREE.Vector3(1, 0, 0)); const royal = horde.royalFacehuggers[0];
  const target = player(new THREE.Vector3(10, 0, 0));
  for (let frame = 0; frame < 250 && !(regular.isLatched && royal.isLatched); frame++) horde.update(1 / 60, target);
  assert.equal(regular.isLatched, true); assert.equal(royal.isLatched, true); assert.strictEqual(royal.latchedTo, target);
  assert.equal(target.isFacehuggerLatched, true); assert.equal(target.isRoyalFacehuggerLatched, true);
  for (const support of supports) { assert.equal(support.isFacehuggerLatched, undefined); assert.equal(support.isRoyalFacehuggerLatched, undefined); assert.equal(typeof support.triggerFacehuggerLatch, 'undefined'); }
  assert.equal(apc.hp, 2500); assert.equal(ship.hp, 1800); horde.clearWave(); apc.clear(); ship.clear();
});

test('targetOnly applies an impact to one real actor without damaging nearby horde or synthetic actors', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio), synthetics = new SyntheticsManager(scene, audio);
  const a = horde.spawnBattleUnit(unit('first-xeno', 'warrior')), b = horde.spawnBattleUnit(unit('second-xeno', 'warrior'));
  const c = synthetics.spawnBattleUnit(unit('first-joe', 'working_joe')), d = synthetics.spawnBattleUnit(unit('second-joe', 'working_joe'));
  const attack = { origin: new THREE.Vector3(), damage: 10, radius: 2, type: 'taabe-arrow' };
  assert.equal(horde.checkMeleeHits({ ...attack, targetOnly: b }).length, 1); assert.equal(a.hp, 150); assert.equal(b.hp, 140);
  assert.equal(synthetics.checkHits({ ...attack, targetOnly: d }).length, 1); assert.equal(c.hp, 150); assert.equal(d.hp, 140);
  horde.clearWave(); synthetics.clearSquad();
});
