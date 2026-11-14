import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { AscensionShipHub } from '../js/engine/AscensionShipHub.js';
import { AscensionProgress } from '../js/data/AscensionProgress.js';

/* HW-DEC-108: La Lame Patiente answers [E] at its places; the bridge stays closed to Unblooded. */
const memory = () => { const data = new Map(); return { getItem: key => data.get(key) ?? null, setItem: (key, value) => data.set(key, value) }; };

test('the ship shows earned tools and prey, cycles open worlds and launches from the drop bay', () => {
  const storage = memory(), progress = new AscensionProgress(storage); progress.complete('vara_kesh');
  const scene = new THREE.Scene(), lines = [], launched = [];
  const hub = new AscensionShipHub(scene, progress, { onLine: line => lines.push(line), onLaunch: id => launched.push(id) }).build();
  try {
    assert.deepEqual(hub.places.map(place => place.id), ['bay', 'map', 'rack', 'skulls', 'bridge']);
    assert.ok(hub.group.getObjectByName('rack-netgun')); assert.ok(hub.group.getObjectByName('skull-vara_kesh'));
    assert.ok(hub.group.getObjectByName('saar') && hub.group.getObjectByName('kaedh'));
    assert.equal(hub.targetWorldId, 'eshra', 'the next world is the default target');
    const at = (x, z) => ({ position: new THREE.Vector3(x, 0, z) });
    hub.interact(at(6, -9)); assert.equal(hub.targetWorldId, 'vara_kesh', 'the map cycles the open worlds only');
    hub.interact(at(6, -9)); assert.equal(hub.targetWorldId, 'eshra');
    hub.interact(at(0, -12)); assert.deepEqual(launched, ['eshra']);
    hub.interact(at(0, 14)); assert.match(lines.at(-1), /Pas encore/);
    assert.equal(hub.interact(at(30, 30)), false, 'nothing to use far from the places');
  } finally { hub.dispose(); }
  assert.equal(scene.children.length, 0, 'the ship leaves no object behind');
});
