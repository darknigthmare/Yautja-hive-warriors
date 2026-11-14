import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

// Exercise the real Player laser geometry and method without asset requests.
class CpuPlayer extends Player {
  loadGeneratedVisual() { return Promise.resolve(false); }
}

test('laser lock stays on its world target during positive and negative visual grounding offsets', async () => {
  const audio = new Proxy({}, { get: () => () => {} });
  const player = new CpuPlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === 'city_hunter'), audio);
  await player.generatedVisualReady;
  try {
    const target = new THREE.Vector3(20, 4, 10), originalTarget = target.clone();
    const starts = player.laserGroup.children.map(line => new THREE.Vector3().fromBufferAttribute(line.geometry.attributes.position, 0));
    for (const yaw of [-1.2, 0.7]) {
      player.mesh.position.set(5, 2, -7); player.mesh.rotation.y = yaw;
      for (const offset of [-0.15, 0, 0.15]) {
        player.laserGroup.position.y = offset;
        player.updateLaserLock(target);
        const centroid = new THREE.Vector3();
        player.laserGroup.children.forEach((line, index) => {
          const positions = line.geometry.attributes.position;
          const endpoint = line.localToWorld(new THREE.Vector3().fromBufferAttribute(positions, 1));
          centroid.add(endpoint);
          assert.deepEqual(new THREE.Vector3().fromBufferAttribute(positions, 0).toArray(), starts[index].toArray(), 'aiming preserves the calibrated emitter');
        });
        centroid.multiplyScalar(1 / player.laserGroup.children.length);
        assert.ok(centroid.distanceTo(target) < 2e-6, `world target drift at yaw ${yaw}, offset ${offset}: ${centroid.distanceTo(target)}`);
        assert.equal(player.laserGroup.position.y, offset);
        assert.deepEqual(player.mesh.position.toArray(), [5, 2, -7]);
        assert.deepEqual(target.toArray(), originalTarget.toArray());
      }
    }
  } finally { player.dispose(); }
});
