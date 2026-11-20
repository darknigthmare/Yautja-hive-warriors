import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';

/* CTRL-083: a generic rifleman is its own weapon actor, not a relabelled smartgunner. */
const audio = new Proxy({}, { get: () => () => {} });
const vertices = mesh => { let count = 0; mesh.traverse(node => { count += node.geometry?.attributes?.position?.count ?? 0; }); return count; };

test('rifleman, smartgunner and flamethrower spawn as distinct weapon actors', () => {
  const manager = new ColonialMarinesManager(new THREE.Scene(), audio), group = { id: 'g', units: [] };
  try {
    const spawn = (id, actorType) => manager.spawnBattleUnit({ id, actorType, species: 'human', profileId: `original_human_${id}`, factionId: 'human_force', position: [0, 0], hp: 100, maxHp: 100 }, group);
    const rifle = spawn('rifle', 'marine'), smart = spawn('smart', 'smartgunner'), flame = spawn('flame', 'flametrooper');
    assert.deepEqual([rifle.type, smart.type, flame.type], ['marine', 'smartgunner', 'flametrooper']);
    assert.deepEqual([rifle.mesh.userData.weaponKind, smart.mesh.userData.weaponKind, flame.mesh.userData.weaponKind], ['marine', 'smartgunner', 'flametrooper']);
    assert.notEqual(vertices(rifle.mesh), vertices(smart.mesh), 'the rifleman does not carry the smartgun model');
    assert.notEqual(rifle.damage, flame.damage);
  } finally { manager.clearSquad?.(); }
});
