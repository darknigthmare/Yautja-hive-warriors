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

test('the rite opens after the eight worlds, its triad is chosen on the bridge, and Blooded is given once', async () => {
  const { ASCENSION_WORLDS, ritekitGates } = await import('../js/data/AscensionWorlds.js');
  const { prepareBossEncounter } = await import('../js/data/BossEncounterValidation.js');
  const { LEVELS_DATA } = await import('../js/data/levelsData.js');
  const progress = new AscensionProgress(memory());
  assert.equal(progress.riteOpen(), false); assert.equal(progress.completeRite(), false);
  for (const world of ASCENSION_WORLDS) progress.complete(world.id);
  const lines = [], hub = new AscensionShipHub(new THREE.Scene(), progress, { onLine: line => lines.push(line) }).build();
  try {
    assert.ok(hub.targets().includes('rite'));
    hub.interact({ position: new THREE.Vector3(0, 0, 14) });
    assert.deepEqual(progress.triad(), ['Harek', 'Tov']); assert.match(lines.at(-1), /Il est à toi/);
  } finally { hub.dispose(); }
  const gates = ritekitGates(progress.state.tools);
  assert.equal(gates.has('burner_rifle'), false); assert.equal(gates.has('mines'), false); assert.equal(gates.has('combistick'), true);
  const pyramid = LEVELS_DATA.find(level => level.id === 'antarctic_pyramid');
  assert.equal(prepareBossEncounter({ level: pyramid, bossType: 'praetorian', mode: 'rite' }).bossType, 'praetorian');
  assert.throws(() => prepareBossEncounter({ level: pyramid, bossType: 'xenomorph_queen', mode: 'rite' }));
  assert.equal(progress.completeRite(), true); assert.equal(progress.completeRite(), false, 'once');
  assert.equal(progress.state.blooded, true);
});
