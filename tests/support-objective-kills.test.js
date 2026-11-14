import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { SentryGun } from '../js/entities/SentryGun.js';
import { FalconDrone } from '../js/entities/FalconDrone.js';
import { BattlefieldProgression } from '../js/engine/BattlefieldProgression.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';

const audio = new Proxy({}, { get: () => () => {} });
class CpuDrone extends FalconDrone {
  buildDroneMesh() { this.mesh = new THREE.Group(); }
}

for (const source of ['sentry', 'falcon']) {
  test(`${source}: killing the real horde objective commander opens its gate exactly once before resource disposal`, () => {
    const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio);
    const layout = createBattlefieldLayout({ environmentType: 'forest' });
    const progression = new BattlefieldProgression(layout);
    progression.update([{ hp: 1000, position: new THREE.Vector3(...[layout.sectors[0].center[0], 0, layout.sectors[0].center[1]]) }]);
    progression.recordKill({ count: layout.sectors[0].objective.target });
    const sector = layout.sectors[1];
    progression.update([{ hp: 1000, position: new THREE.Vector3(sector.center[0], 0, sector.center[1]) }]);
    assert.equal(progression.isGateOpen(layout.gates[1].id), false);
    const geometry = new THREE.BoxGeometry(), material = new THREE.MeshBasicMaterial();
    const mesh = new THREE.Mesh(geometry, material); mesh.position.set(...[sector.center[0], 0, sector.center[1]]); scene.add(mesh);
    const commander = { mesh, hp: 10, maxHp: 350, type: 'officer', isOfficer: true, objectiveCommander: true };
    horde.aliens.push(commander);
    let disposed = false, reports = 0;
    geometry.addEventListener('dispose', () => { disposed = true; });
    horde.onDefeated = record => {
      assert.equal(disposed, false, 'objective notification must precede disposal of its world object');
      assert.equal(record.kind, 'commander');
      assert.deepEqual(record.position.toArray(), mesh.position.toArray());
      reports++;
      progression.recordKill({ ...record, sectorId: sector.id });
    };
    if (source === 'sentry') {
      const sentry = new SentryGun(scene, audio);
      const deployed = { ammo: 20, flashLight: { intensity: 0 } };
      sentry.fireBurst(deployed, commander, horde);
      sentry.fireBurst(deployed, commander, horde);
    } else {
      const drone = new CpuDrone(scene, audio);
      drone.firePlasmaStrafing(commander, horde);
      drone.firePlasmaStrafing(commander, horde);
      drone.clear();
    }
    assert.equal(reports, 1);
    assert.equal(horde.deadCount, 1);
    assert.equal(horde.aliens.length, 0);
    assert.equal(disposed, true);
    assert.equal(progression.isGateOpen(layout.gates[1].id), true, 'support fire must not leave a completed commander objective softlocked');
    horde.clearWave();
    assert.equal(scene.children.length, 0);
  });
}
