import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';

// AUD-090: the hunter's area powers reached the boss by distance alone, through walls,
// while the same powers already respected cover against every other target.
const reach = Player.prototype.bossInReach;
const boss = position => ({ activeBoss: { mesh: { position: new THREE.Vector3(...position) }, definition: { height: 6 } } });
const hunter = lineOfSight => ({ gameContext: { env: { hasLineOfSight: (from, to) => { hunter.calls.push([from.toArray(), to.toArray()]); return lineOfSight; } } } });
hunter.calls = [];

test('an area power reaches the boss only within its radius and with a clear line', () => {
  const origin = new THREE.Vector3(0, 0, 0);
  assert.equal(reach.call(hunter(true), boss([0, 0, 5]), origin, 6), true);
  assert.equal(reach.call(hunter(true), boss([0, 0, 7]), origin, 6), false, 'outside the radius');
  assert.equal(reach.call(hunter(false), boss([0, 0, 5]), origin, 6), false, 'a wall stands between them');
  assert.equal(reach.call(hunter(true), { activeBoss: null }, origin, 6), false, 'no boss');
  // The line goes from chest height at the impact to the boss body, not along the ground.
  const [from, to] = hunter.calls.at(-1);
  assert.ok(Math.abs(from[1] - 1.2) < 1e-9); assert.ok(Math.abs(to[1] - 2.4) < 1e-9);
  // Without an environment (menus, unit tests), the distance rule alone still applies.
  assert.equal(reach.call({}, boss([0, 0, 5]), origin, 6), true);
});

test('no hunter power damages the boss by distance alone any more', () => {
  const source = readFileSync(new URL('../js/entities/Player.js', import.meta.url), 'utf8');
  assert.equal((source.match(/bosses\.activeBoss\.mesh\.position\.distanceTo\(/g) ?? []).length, 0);
  assert.ok((source.match(/this\.bossInReach\(bosses,/g) ?? []).length >= 15);
});
