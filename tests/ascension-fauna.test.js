import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { FaunaEncounter } from '../js/engine/FaunaEncounter.js';
import { ASCENSION_WORLDS, ascensionWorld } from '../js/data/AscensionWorlds.js';
import { AscensionProgress } from '../js/data/AscensionProgress.js';
import { bossAllowedInLevel } from '../js/data/BossRegistry.js';

/* Spec 002 SC-002: fauna is an ordinary horde actor with a recorded death, a finite herd and no
 * xenomorph side effect; great prey exist only in the Ascension mode. */
const audio = new Proxy({}, { get: () => () => {} });
const world = ascensionWorld('vara_kesh');
const sector = (index, objective) => ({ index, center: [0, 0], objective });

test('a herd is finite, sized for its sector objective, and never reinforced', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), encounter = new FaunaEncounter(horde, world);
  assert.equal(encounter.spawnSector(sector(0, { type: 'kills', target: 12 }), new THREE.Vector3()), 14);
  assert.equal(horde.aliens.length, 14);
  assert.ok(horde.aliens.every(animal => animal.isFauna && animal.type === 'fauna_herd'));
  assert.equal(encounter.reinforce(30), 0);
  assert.equal(horde.aliens.length, 14, 'no animal is invented');
  assert.equal(encounter.spawnSector(sector(3, { type: 'kills', target: 30 }), new THREE.Vector3()), 32);
});

test('a fauna death is recorded once, without acid or parasite, and a scattered herd stays in the world', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), encounter = new FaunaEncounter(horde, world);
  encounter.spawnSector(sector(0, { type: 'kills', target: 4 }), new THREE.Vector3());
  const leader = encounter.spawnLeader(sector(1, { type: 'commander' }), new THREE.Vector3(5, 0, 5));
  const victim = horde.aliens.find(animal => animal.role === 'herd'), defeats = [];
  horde.onDefeated = event => defeats.push(event);
  const hits = horde.checkMeleeHits({ origin: victim.mesh.position.clone(), radius: .5, damage: 10000, targetOnly: victim });
  assert.equal(hits.length, 1); assert.equal(hits[0].killed, true);
  assert.equal(horde.acidSplashes.length, 0, 'no acid from fauna');
  assert.equal(horde.acidPools.length + horde.zeroGAcidGlobules.length + horde.chestbursters.length, 0, 'no xenomorph biology on a fauna death');
  const before = horde.deadCount; horde.defeatAlien(victim); horde.defeatAlien(victim);
  assert.ok(horde.deadCount - before <= 1, 'one recorded death');
  leader.hp = 0; encounter.update();
  const herd = horde.aliens.filter(animal => animal.role === 'herd');
  assert.ok(herd.length > 0 && herd.every(animal => animal.isFleeing), 'the herd of a fallen leader flees');
  const count = herd.length, player = { hp: 100, position: new THREE.Vector3(0, 0, 0) };
  for (let i = 0; i < 300; i++) horde.update(1 / 30, player);
  assert.equal(horde.aliens.filter(animal => animal.role === 'herd').length, count, 'a fleeing animal is never removed silently');
});

test('great prey belong to the Ascension mode only, and progress opens the worlds in order', () => {
  for (const item of ASCENSION_WORLDS) {
    assert.equal(bossAllowedInLevel(item.prey.bossId, 'val_verde_jungle', { mode: 'ascension' }), true);
    assert.equal(bossAllowedInLevel(item.prey.bossId, 'val_verde_jungle', { mode: 'crossover' }), false);
  }
  assert.equal(bossAllowedInLevel('jungle_hunter_boss', 'val_verde_jungle', { mode: 'ascension' }), false);
  const memory = new Map(), storage = { getItem: key => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, value) };
  const progress = new AscensionProgress(storage);
  assert.deepEqual(progress.unlockedWorlds().map(item => item.id), ['vara_kesh']);
  assert.equal(progress.complete('eshra'), null, 'worlds are hunted in order');
  assert.equal(progress.complete('vara_kesh').ability, 'netgun');
  assert.deepEqual(new AscensionProgress(storage).unlockedWorlds().map(item => item.id), ['vara_kesh', 'eshra']);
  memory.set('yautja-ascension-v1', '{"version":9}');
  assert.deepEqual(new AscensionProgress(storage).state.completed, [], 'a foreign record starts fresh');
});

test('Kharuun’s burrower cannot be struck under the sand and surfaces beside the hunter', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), encounter = new FaunaEncounter(horde, ascensionWorld('kharuun'));
  const burrower = encounter.spawnLeader({ index: 1, center: [0, 0], objective: { type: 'commander' } }, new THREE.Vector3(0, 0, 10));
  const player = { hp: 1000, position: new THREE.Vector3(0, 0, 0), takeDamage() {} };
  let dived = false;
  for (let i = 0; i < 300 && !dived; i++) { horde.update(1 / 30, player); dived = burrower.isBurrowed; }
  assert.equal(dived, true);
  assert.equal(horde.checkMeleeHits({ origin: burrower.mesh.position.clone(), radius: 50, damage: 100 }).length, 0, 'no hit under the sand');
  for (let i = 0; i < 90; i++) horde.update(1 / 30, player);
  assert.equal(burrower.isBurrowed, false);
  assert.ok(burrower.mesh.position.distanceTo(player.position) < 8, 'it surfaces beside the hunter');
});

test('the Unblooded kit opens one tool per hunted world and refuses the rest of the arsenal', async () => {
  const { ascensionToolGates } = await import('../js/data/AscensionWorlds.js');
  const { Player } = await import('../js/entities/Player.js');
  const { CHARACTERS_DATA } = await import('../js/data/charactersData.js');
  class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
  const player = new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA[0], audio);
  try {
    player.kitLocks = { tools: ascensionToolGates([]), cloak: true, shoulderCannon: true };
    assert.equal(player.canUseArsenalEquipment('combistick'), true);
    assert.equal(player.canUseArsenalEquipment('netgun'), false);
    assert.equal(player.canUseArsenalEquipment('m41a'), false);
    assert.equal(player.toggleCloak(), false); assert.equal(player.isCloaked, false);
    player.kitLocks = { tools: ascensionToolGates(['netgun', 'tripwire_mine']), cloak: false };
    assert.equal(player.canUseArsenalEquipment('netgun'), true);
    assert.equal(player.canUseArsenalEquipment('mines'), true);
    assert.equal(player.canUseArsenalEquipment('smart_disc'), false);
    player.toggleCloak(); assert.equal(player.isCloaked, true);
  } finally { player.dispose(); }
});
