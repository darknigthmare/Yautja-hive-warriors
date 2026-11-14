import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';

const player = () => ({ hp: 1000, position: new THREE.Vector3(), mesh: new THREE.Group(), takeDamage() {} });

test('wave cleanup releases both cached cooperative player graphs and only the next run supplies new targets', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), {});
  const first = player(), second = player(), next = player();
  horde.update(1 / 60, first, second);
  assert.deepEqual(horde._livingPlayers, [first, second]);
  horde.clearWave();
  assert.deepEqual(horde._livingPlayers, []);
  horde.clearWave();
  assert.deepEqual(horde._livingPlayers, []);
  horde.update(1 / 60, next);
  assert.deepEqual(horde._livingPlayers, [next]);
  assert.ok(!horde._livingPlayers.includes(first) && !horde._livingPlayers.includes(second));
  horde.clearWave();
});
