import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';

const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
const hunter = () => new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'jungle_hunter'), audio);
const guard = z => { const mesh = new THREE.Group(); mesh.position.set(0, 0, z);
  return { battleUnitId: 'guard', factionId: 'hive', hp: 500, maxHp: 500, type: 'warrior', radius: 1, mesh }; };
const simulation = { config: { playerFaction: 'clan' }, areHostile: (a, b) => a !== b };

test('the stealth opening hides an uncloaked hunter from distant hive senses until it is revealed', () => {
  const player = hunter(), observer = guard(12);
  const manager = { battleSimulation: simulation, combatActorsProvider: () => [player], time: 1 };
  try {
    assert.equal(player.isCloaked, false);
    assert.equal(selectBattleTarget(manager, observer, [player]), player, 'without the opening the hunter is visible');
    assert.ok(player.beginInsertionConcealment(25));
    assert.equal(selectBattleTarget(manager, observer, [player]), null, 'distant guard cannot locate the hunter');
    observer.mesh.position.z = 5;
    assert.equal(selectBattleTarget(manager, observer, [player]), player, 'close senses still find the hunter');
    observer.mesh.position.z = 12;
    const hp = player.hp; player.takeDamage(10);
    assert.equal(player.hp, hp - 10, 'the opening gives no damage reduction');
    player.update(1 / 60);
    assert.equal(player.isInsertionConcealed, false);
    assert.equal(player.insertionConcealmentEndReason, 'revealed');
    assert.equal(selectBattleTarget(manager, observer, [player]), player);
  } finally { player.dispose(); }
});

test('the stealth opening expires on its own', () => {
  const player = hunter();
  try {
    player.beginInsertionConcealment(2);
    player.update(1); assert.equal(player.isInsertionConcealed, true);
    player.update(1.1); assert.equal(player.isInsertionConcealed, false);
    assert.equal(player.insertionConcealmentEndReason, 'expired');
  } finally { player.dispose(); }
});
