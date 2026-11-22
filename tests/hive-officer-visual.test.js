import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

// AUD-025/031: the 567 warriors that lead their group in the operations used the plain warrior
// model. A leading warrior now wears the hive officer model; its type and stats do not change.
const audio = new Proxy({}, { get: () => () => {} });
const unit = (id, extra = {}) => ({ id, actorType: 'xenomorph', position: [0, 0], hp: 150, maxHp: 150, factionId: 'dark_hive', ...extra });

test('a leading warrior wears the hive officer model and keeps its warrior profile', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  const leader = horde.spawnBattleUnit(unit('lead', { officer: true })), soldier = horde.spawnBattleUnit(unit('line'));
  assert.equal(leader.mesh.name, 'creature-officer');
  assert.equal(soldier.mesh.name, 'creature-warrior');
  assert.equal(leader.type, soldier.type, 'same strategic type');
  assert.equal(leader.hp, soldier.hp); assert.equal(leader.maxHp, soldier.maxHp);
});
