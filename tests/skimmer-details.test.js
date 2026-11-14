import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSkimmerModel, createDropshipModel } from '../js/graphics/SupportModels.js';
import { YautjaSkimmer } from '../js/entities/YautjaSkimmer.js';
import { disposeObject } from '../js/engine/SceneResources.js';

const audio = new Proxy({}, { get: () => () => {} });

test('skimmer barrels face the same world direction as vehicle movement and shots', () => {
  const skimmer = new YautjaSkimmer(new THREE.Scene(), audio);
  const player = { hp: 100, position: new THREE.Vector3(), mesh: new THREE.Group() };
  const attacks = [];
  const horde = { checkMeleeHits(attack) { attacks.push(attack); return []; } };
  skimmer.spawnAt(new THREE.Vector3(8, 0, 12));
  skimmer.isMounted = true;
  skimmer.update(0.1, player, horde, { KeyA: true, Space: true });
  skimmer.mesh.updateMatrixWorld(true);
  const forward = new THREE.Vector3(Math.sin(skimmer.rotationY), 0, Math.cos(skimmer.rotationY));
  const cannon = skimmer.mesh.getObjectByProperty('isMesh', true);
  assert.ok(cannon);
  const chargeMeshes = [];
  skimmer.mesh.traverse(node => {
    if (node.isMesh && node.material.name === 'skimmer-cannon-charge') chargeMeshes.push(node);
  });
  assert.equal(chargeMeshes.length, 1, 'both emitters share one draw surface');
  const center = new THREE.Box3().setFromObject(chargeMeshes[0]).getCenter(new THREE.Vector3());
  assert.ok(center.sub(skimmer.position).dot(forward) > 2.7, 'rendered muzzles are in front, not behind the player');
  const shot = attacks.find(attack => attack.damage === 260);
  assert.ok(shot.origin.clone().sub(skimmer.position).dot(forward) > 3.9);
  assert.ok(skimmer.position.x < 8, 'the vehicle moves toward the visible nose');
  disposeObject(skimmer.mesh);
});

test('propulsion and hover animate the visual child while preserving gameplay position', () => {
  const skimmer = new YautjaSkimmer(new THREE.Scene(), audio);
  const player = { hp: 100, position: new THREE.Vector3(), mesh: new THREE.Group() };
  skimmer.spawnAt(new THREE.Vector3(2, 0, 4));
  const position = skimmer.position.clone();
  const root = skimmer.mesh.position.clone();
  skimmer.update(0.5, player, null, {});
  assert.ok(skimmer.visual.position.y > 0 && skimmer.visual.position.y <= 0.035);
  assert.deepEqual(skimmer.position.toArray(), position.toArray());
  assert.deepEqual(skimmer.mesh.position.toArray(), root.toArray());
  skimmer.updateVisual(0.5, true);
  assert.ok(skimmer.propulsionMaterials.get('skimmer-exhaust').emissiveIntensity > 2);
  skimmer.weaponFlash = 1;
  skimmer.updateVisual(1 / 60, true);
  assert.ok(skimmer.propulsionMaterials.get('skimmer-cannon-charge').emissiveIntensity > 2);
  skimmer.clear();
  assert.equal(skimmer.visual.position.y, 0);
  assert.equal(skimmer.propulsionMaterials.get('skimmer-exhaust').emissiveIntensity, 0.65);
  assert.equal(skimmer.propulsionMaterials.get('skimmer-cannon-charge').emissiveIntensity, 0.2);
  disposeObject(skimmer.mesh);
});

test('skimmer visual motors have the same result at 30 and 120 simulation updates', () => {
  const run = fps => {
    const skimmer = new YautjaSkimmer(new THREE.Scene(), audio);
    skimmer.weaponFlash = 1;
    for (let frame = 0; frame < fps; frame++) skimmer.updateVisual(1 / fps, true);
    const state = [skimmer.visual.position.y, skimmer.throttle, skimmer.weaponFlash];
    disposeObject(skimmer.mesh);
    return state;
  };
  const a = run(30), b = run(120);
  for (let i = 0; i < a.length; i++) assert.ok(Math.abs(a[i] - b[i]) < 1e-10);
});

test('vehicle detail pass keeps bounded draw calls, finite normals and UVs', () => {
  for (const build of [createSkimmerModel, createDropshipModel]) {
    const model = build();
    let triangles = 0, meshes = 0;
    model.traverse(node => {
      if (!node.isMesh) return;
      meshes++;
      triangles += (node.geometry.index?.count ?? node.geometry.attributes.position.count) / 3;
      for (const attribute of ['position', 'normal', 'uv']) assert.ok(node.geometry.attributes[attribute].array.every(Number.isFinite));
    });
    assert.ok(triangles < 38000, `${triangles} triangles`);
    assert.ok(meshes <= 10, `${meshes} draw surfaces`);
    disposeObject(model);
  }
});
