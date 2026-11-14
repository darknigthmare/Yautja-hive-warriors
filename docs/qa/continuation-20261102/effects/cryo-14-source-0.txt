import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';

const audio = new Proxy({}, { get: () => () => {} });
function fixture() {
  const scene = new THREE.Scene(), env = new EnvironmentManager(scene), horde = new XenomorphHorde(scene, audio);
  env.root = new THREE.Group(); env.referenceRoot = new THREE.Group(); env.root.add(env.referenceRoot); scene.add(env.root); env.envObjects.push(env.root);
  env.cryoStasisSector = { pos: new THREE.Vector3(), consolePos: new THREE.Vector3(), pods: [], cooldown: 0 };
  const player = { position: new THREE.Vector3(), hp: 700, maxHp: 1000, factionId: 'player_clan', takeDamage() {} };
  const spawn = (id, hp = 1000, position = [0, 0], factionId = 'hive') => horde.spawnBattleUnit({ id, actorType: 'warrior', factionId, position, hp, maxHp: hp });
  return { env, horde, player, spawn, clear() { env.clearEnvironment(); horde.clearWave(); } };
}
function disposalCounts(pool) {
  const counts = { geometry: 0, material: 0 };
  pool.mesh.geometry.addEventListener('dispose', () => counts.geometry++);
  pool.mesh.material.addEventListener('dispose', () => counts.material++);
  return counts;
}

test('the real cryo console removes only nearby Horde-owned acid pools and disposes each private resource once', () => {
  const f = fixture(), { env, horde, player } = f;
  horde.spawnAcidPool(new THREE.Vector3()); horde.spawnAcidPool(new THREE.Vector3(40, 0, 0));
  const [near, far] = horde.acidPools, nearDisposed = disposalCounts(near), farDisposed = disposalCounts(far);
  try {
    assert.equal(env.checkCryoPodInteraction(player, audio, null, horde), true);
    assert.deepEqual(horde.acidPools, [far]); assert.equal(near.mesh.parent, null); assert.ok(far.mesh.parent);
    assert.deepEqual(nearDisposed, { geometry: 1, material: 1 }); assert.deepEqual(farDisposed, { geometry: 0, material: 0 });
    assert.equal(horde.removeAcidPool(near), false, 'a second source cannot remove or dispose the same pool again');
    assert.equal(horde.removeAcidPool({ mesh: far.mesh }), false, 'matching geometry does not establish ownership of another pool entry');
    env.clearEnvironment(); assert.ok(far.mesh.parent); assert.deepEqual(farDisposed, { geometry: 0, material: 0 });
    horde.update(10.1, player); assert.deepEqual(farDisposed, { geometry: 1, material: 1 });
    horde.clearWave(); assert.deepEqual(nearDisposed, { geometry: 1, material: 1 }); assert.deepEqual(farDisposed, { geometry: 1, material: 1 });
  } finally { f.clear(); }
});

test('cryo does not recolor shared real creature materials for a mesh-root representation or dispose a distant peer', () => {
  const f = fixture(), { env, horde, player, spawn } = f, victim = spawn('cryo-mesh'), peer = spawn('distant-peer', 1000, [40, 0]);
  const root = victim.mesh;
  let part, sharedPeer;
  root.traverse(node => { if (!part && node.isMesh && node.material?.color && horde.sharedResources.has(node.material)) part = node; });
  peer.mesh.traverse(node => { if (node.material === part?.material) sharedPeer = node; });
  assert.ok(part && sharedPeer, 'both real manager-created models must use the same cached material');
  const material = part.material, before = material.color.getHex(); let disposed = 0;
  material.addEventListener('dispose', () => disposed++);
  // The interaction accepts an Object3D root. Exercise its Mesh form using the
  // manager's actual rendered part and cached material, without cloning either.
  victim.mesh = part;
  try {
    assert.equal(env.checkCryoPodInteraction(player, audio, null, horde), true);
    assert.equal(material.color.getHex(), before); assert.equal(sharedPeer.material, material);
    assert.equal(victim.isStunned, true); assert.equal(peer.isStunned === true, false); assert.equal(peer.hp, 1000);
    victim.mesh = root; env.clearEnvironment(); horde.clearWave(); assert.equal(disposed, 0, 'shared creature resources remain owned by their cache');
  } finally { victim.mesh = root; f.clear(); }
});

test('cryo damage uses the real death ledger once and preserves allied identities', () => {
  const f = fixture(), { env, horde, player, spawn } = f;
  const victim = spawn('cryo-lethal', 100), survivor = spawn('cryo-survivor'), ally = spawn('cryo-allied', 1000, [0, 1], 'player_clan');
  const ledger = new CombatEvents({ runId: 'cryo-operation' }); horde.combatEvents = ledger;
  const simulation = { config: { playerFaction: 'player_clan' }, areHostile(a, b) { return a !== b; } };
  env.game = { battleSimulation: simulation }; horde.battleSimulation = simulation;
  try {
    assert.equal(env.checkCryoPodInteraction(player, audio, null, horde), true);
    const deaths = ledger.getSnapshot().deaths;
    assert.equal(deaths.length, 1); assert.equal(deaths[0].entityId, victim.battleUnitId);
    assert.equal(deaths[0].cause, 'cryo-stasis'); assert.equal(deaths[0].killerFaction, 'player_clan');
    assert.equal(horde.aliens.includes(victim), false); assert.equal(victim.hp, 0);
    assert.equal(survivor.hp, 760); assert.equal(survivor.stunTimer, 6);
    assert.equal(ally.hp, 1000); assert.equal(ally.isStunned === true, false);
    assert.equal(env.checkCryoPodInteraction(player, audio, null, horde), true, 'the cooling console acknowledges input without repeating its effect');
    assert.equal(ledger.getSnapshot().deaths.length, 1); assert.equal(survivor.hp, 760);
  } finally { f.clear(); }
});

test('a six-second cryo stun holds a marching actor and expires even after camouflage removes its target', () => {
  const f = fixture(), { env, horde, player, spawn } = f, victim = spawn('hidden-target-stun');
  try {
    env.checkCryoPodInteraction(player, audio, null, horde); assert.equal(victim.isStunned, true);
    victim.battleOrderTarget = [20, 0]; player.position.set(100, 0, 0); player.isCloaked = true;
    const held = victim.mesh.position.clone(); horde.update(.5, player);
    assert.ok(victim.mesh.position.distanceTo(held) < 1e-8, 'march orders cannot bypass the active cryo stun');
    horde.update(5.6, player); assert.equal(victim.isStunned, false); assert.ok(victim.stunTimer <= 0);
  } finally { f.clear(); }
});
