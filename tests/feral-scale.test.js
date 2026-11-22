import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BossManager } from '../js/entities/Bosses.js';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { EnvironmentManager } from '../js/entities/Environment.js';

// AUD-124: the Feral boss is measured against the playable hunters and the Prey map's
// accesses, not sized from a comment. Game units; no claim of 1:1 film scale.
test('the Feral boss stands within 10 % above a playable hunter and fits every Prey passage', () => {
  const manager = new BossManager(new THREE.Scene(), new Proxy({}, { get: () => () => {} }));
  const boss = manager.spawnBoss('feral_predator_boss', new THREE.Vector3());
  const bounds = new THREE.Box3().setFromObject(boss.mesh, true), height = bounds.max.y - bounds.min.y;
  const hunterHeight = GENERATED_ASSETS.feral_predator.characterRig.height;
  assert.equal(hunterHeight, GENERATED_ASSETS.jungle_hunter.characterRig.height, 'the playable Feral shares the hunters\' calibrated height');
  const ratio = height / hunterHeight;
  assert.ok(ratio >= 1 && ratio <= 1.1, `boss/hunter height ${ratio.toFixed(3)}: a boss uplift, not a giant`);
  const level = LEVELS_DATA.find(item => item.id === 'prey_comanche_territory');
  assert.equal(level.bossType, 'feral_predator_boss', 'the Prey hunt ends with the Feral');
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment({ ...level, battlefield: true });
  for (const corridor of env.battlefieldLayout.corridors) {
    const width = Math.min(corridor.bounds.maxX - corridor.bounds.minX, corridor.bounds.maxZ - corridor.bounds.minZ);
    assert.ok(boss.footprintRadius * 2 + 2 <= width, `${corridor.id}: ${width} too narrow for a ${(boss.footprintRadius * 2).toFixed(2)} body`);
  }
  manager.clear();
});
