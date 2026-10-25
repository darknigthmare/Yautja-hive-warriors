import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSplitYautjaAssembly, jungleHunterSplitPilotDescriptor } from '../js/graphics/SplitYautjaAssembly.js';
import { createYautjaArticulation } from '../js/graphics/YautjaArticulation.js';

// Synthetic 23-part layout. These boxes test assembly/ownership, not likeness.
function fixture({ transformed = false } = {}) {
  const scene = new THREE.Group(); scene.name = 'SYNTHETIC_SPLIT_FIXTURE';
  const geometry = new THREE.BoxGeometry(0.04, 0.12, 0.03), texture = new THREE.Texture();
  const material = new THREE.MeshStandardMaterial({ color: 0x345678, map: texture });
  const nested = new THREE.Group(); nested.name = 'authored-wrapper'; scene.add(nested);
  if (transformed) {
    scene.position.set(0.4, -0.3, 0.2); scene.rotation.set(0.1, 0.3, -0.2); scene.scale.set(1.3, 0.8, 1.1);
    nested.rotation.set(0.2, -0.4, 0.3); nested.position.set(-0.2, 0.3, 0.1);
  }
  for (let index = 0; index < 23; index++) {
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `model_part${index}`;
    mesh.position.set((index % 5) * 0.08 - 0.16, Math.floor(index / 5) * 0.15, (index % 3) * 0.05);
    mesh.rotation.set(index * 0.01, index * 0.02, 0);
    if (index % 2) nested.add(mesh); else scene.add(mesh);
  }
  // Freeze authored matrices before the source immutability checks.
  scene.updateMatrixWorld(true);
  return { gltf: { scene, animations: [] }, geometry, material, texture };
}
const position = mesh => mesh.getWorldPosition(new THREE.Vector3());
const close = (a, b, reason) => assert.ok(a.distanceTo(b) < 1e-6, reason ?? `${a.toArray()} != ${b.toArray()}`);
const worldVertex = (mesh, at) => new THREE.Vector3().fromBufferAttribute(mesh.geometry.attributes.position, at).applyMatrix4(mesh.matrixWorld);
const tick = rig => { for (let frame = 0; frame < 60; frame++) rig.update(1 / 60); };

test('reviewed classification recomposes every part and both hands without changing source geometry or transforms', () => {
  const f = fixture({ transformed: true }), original = f.gltf.scene.toJSON();
  const assembly = createSplitYautjaAssembly(f.gltf, jungleHunterSplitPilotDescriptor());
  assembly.root.updateMatrixWorld(true);
  assert.equal(assembly.parts.size, 23); assert.equal(assembly.diagnostics.triangles, 23 * 12);
  assert.deepEqual(assembly.anatomyRoot.children.map(mesh => mesh.name).sort(), ['model_part10', 'model_part14', 'model_part22', 'model_part7']);
  for (const [name, mesh] of assembly.parts) {
    const source = f.gltf.scene.getObjectByName(name);
    assert.notEqual(mesh, source); assert.notEqual(mesh.geometry, source.geometry); assert.notEqual(mesh.material, source.material);
    assert.equal(mesh.material.map, f.texture);
    for (let at = 0; at < mesh.geometry.attributes.position.count; at++) close(worldVertex(mesh, at), worldVertex(source, at), 'nested nonuniform transforms/shear must not shift source vertices');
    assert.deepEqual(mesh.geometry.index.array, source.geometry.index.array);
  }
  assert.deepEqual(f.gltf.scene.toJSON(), original);
  assert.equal(assembly.hair.get('dreadlock-bouquets').parts.length, 8);
  assert.equal(assembly.equipment.get('right-blade-assembly').root.parent, assembly.equipment.get('right-gauntlet').root);
  assert.equal(assembly.articulationDescriptor.wristblades.length, 0, 'the pilot classification must not fabricate a measured rail');
  assert.equal(assembly.articulationDescriptor.gauntlets.length, 0, 'the closed console does not establish an opening hinge');
  assembly.dispose();
});

test('explicit measured slider moves only the blade assembly in its parent frame and preserves authored extension', () => {
  const f = fixture(), config = jungleHunterSplitPilotDescriptor();
  const cuff = config.equipment.find(value => value.id === 'right-gauntlet'); cuff.pivot = [-0.2, 0.4, 0.1];
  const blade = config.equipment.find(value => value.id === 'right-blade-assembly'); blade.pivot = [-0.24, 0.28, 0.12];
  blade.mechanism = { kind: 'slider', axis: [0, -2, 0], travel: 0.17, restState: 'extended' };
  const assembly = createSplitYautjaAssembly(f.gltf, config), host = new THREE.Group();
  host.position.set(4, 2, -1); host.rotation.set(0.2, 0.7, -0.3); host.scale.setScalar(1.7); host.add(assembly.root); host.updateMatrixWorld(true);
  const bladeMesh = assembly.parts.get('model_part13'), cuffMesh = assembly.parts.get('model_part18'), hand = assembly.parts.get('model_part10');
  const beforeBlade = position(bladeMesh), beforeCuff = position(cuffMesh), beforeHand = position(hand);
  const expectedTravel = new THREE.Vector3(0, 0.17, 0).applyMatrix3(new THREE.Matrix3().setFromMatrix4(assembly.equipment.get('right-gauntlet').root.matrixWorld));
  const rig = createYautjaArticulation(assembly.root, assembly.articulationDescriptor);
  rig.setBladeExtension('right-blade-assembly', 1); tick(rig); close(position(bladeMesh), beforeBlade);
  rig.setBladeExtension('right-blade-assembly', 0); tick(rig);
  close(position(bladeMesh), beforeBlade.clone().add(expectedTravel)); close(position(cuffMesh), beforeCuff); close(position(hand), beforeHand);
  rig.dispose(); close(position(bladeMesh), beforeBlade); assembly.dispose();
});

test('an explicitly placed plate hinge rotates around its supplied pivot independently of the housing', () => {
  const f = fixture(), config = jungleHunterSplitPilotDescriptor();
  const plate = config.equipment.find(value => value.id === 'left-console-plate-candidate');
  plate.pivot = [0.2, 0.3, -0.1]; plate.mechanism = { kind: 'hinge', axis: [1, 0, 0], angle: 1.1, restState: 'closed' };
  const assembly = createSplitYautjaAssembly(f.gltf, config), group = assembly.equipment.get(plate.id).root;
  const plateMesh = assembly.parts.get('model_part9'), wall = assembly.parts.get('model_part6');
  assembly.root.updateMatrixWorld(true); const before = worldVertex(plateMesh, 0), beforeWall = position(wall), pivot = position(group);
  const expected = before.clone().sub(pivot).applyAxisAngle(new THREE.Vector3(1, 0, 0), 1.1).add(pivot);
  const rig = createYautjaArticulation(assembly.root, assembly.articulationDescriptor); rig.setGauntletOpen(plate.id, 1); tick(rig);
  close(worldVertex(plateMesh, 0), expected); close(position(wall), beforeWall); close(position(group), pivot);
  rig.dispose(); assembly.dispose();
});

test('measurements and descriptor sockets use source coordinates while excluding the actor world transform', () => {
  const f = fixture(), config = jungleHunterSplitPilotDescriptor();
  config.equipment.find(value => value.id === 'right-gauntlet').pivot = [-0.3, 0.2, 0.1];
  config.sockets = [{ id: 'right-wrist', parent: 'right-gauntlet', position: [-0.24, 0.18, 0.09], label: 'synthetic measured wrist' }];
  const assembly = createSplitYautjaAssembly(f.gltf, config), bounds = assembly.measureBounds(['model_part13']);
  const projection = assembly.measureProjection(['model_part13'], [0, 3, 0]);
  assert.ok(Math.abs(projection.length - bounds.size[1]) < 1e-6);
  close(position(assembly.sockets.get('right-wrist')), new THREE.Vector3(-0.24, 0.18, 0.09));
  const host = new THREE.Group(); host.rotation.set(0.2, -0.4, 0.1); host.position.set(-8, 5, 3); host.scale.setScalar(2); host.add(assembly.root);
  const transformed = assembly.measureBounds(['model_part13']);
  close(new THREE.Vector3(...bounds.min), new THREE.Vector3(...transformed.min)); close(new THREE.Vector3(...bounds.max), new THREE.Vector3(...transformed.max));
  assert.equal(assembly.sockets.get('right-wrist').userData.splitSocket.positionSource, 'explicit descriptor');
  assert.throws(() => assembly.measureProjection(['model_part13'], [0, 0, 0]), /zero/);
  assert.throws(() => assembly.measureBounds(['missing']), /missing/);
  assembly.dispose(); assert.throws(() => assembly.measureBounds(['model_part13']), /disposed/);
});

test('cooperative assemblies own separate mutable geometry/materials and dispose no cache textures or peer resources', () => {
  const f = fixture(), original = f.gltf.scene.toJSON(), a = createSplitYautjaAssembly(f.gltf, jungleHunterSplitPilotDescriptor()), b = createSplitYautjaAssembly(f.gltf, jungleHunterSplitPilotDescriptor());
  const meshA = a.parts.get('model_part13'), meshB = b.parts.get('model_part13');
  assert.notEqual(meshA.geometry, meshB.geometry); assert.notEqual(meshA.material, meshB.material);
  const originalX = meshB.geometry.attributes.position.getX(0); meshA.geometry.attributes.position.setX(0, originalX + 1); meshA.material.opacity = 0.3;
  assert.equal(meshB.geometry.attributes.position.getX(0), originalX); assert.equal(meshB.material.opacity, 1);
  let cacheGeometryDisposed = 0, cacheMaterialDisposed = 0, textureDisposed = 0, peerDisposed = 0, ownDisposed = 0;
  f.geometry.addEventListener('dispose', () => cacheGeometryDisposed++); f.material.addEventListener('dispose', () => cacheMaterialDisposed++); f.texture.addEventListener('dispose', () => textureDisposed++);
  meshB.geometry.addEventListener('dispose', () => peerDisposed++); meshA.geometry.addEventListener('dispose', () => ownDisposed++);
  a.dispose(); a.dispose(); assert.equal(ownDisposed, 1); assert.equal(peerDisposed, 0);
  assert.equal(cacheGeometryDisposed, 0); assert.equal(cacheMaterialDisposed, 0); assert.equal(textureDisposed, 0);
  assert.deepEqual(f.gltf.scene.toJSON(), original); b.dispose(); assert.equal(peerDisposed, 1);
});

test('a private hair skin replacement preserves all rest vertices, triangles and affine transforms', () => {
  const f = fixture({ transformed: true }), assembly = createSplitYautjaAssembly(f.gltf, jungleHunterSplitPilotDescriptor()), old = assembly.parts.get('model_part3');
  const replacement = new THREE.SkinnedMesh(old.geometry.clone(), old.material); old.visible = false;
  const matrix = old.matrix.clone(), previousParent = old.parent;
  assert.equal(assembly.replacePart(old.name, replacement), old); assert.equal(old.parent, null);
  assert.equal(replacement.parent, previousParent); assert.equal(replacement.matrixAutoUpdate, false); assert.equal(replacement.visible, false);
  assert.deepEqual(replacement.matrix.elements, matrix.elements); assert.equal(assembly.hair.get('dreadlock-bouquets').parts.includes(replacement), true);
  assert.equal(assembly.parts.get('model_part3'), replacement);
  const changed = new THREE.Mesh(replacement.geometry.clone(), replacement.material); changed.geometry.attributes.position.setX(0, 9);
  assert.throws(() => assembly.replacePart('model_part3', changed), /original rest positions/);
  let replacementDisposed = 0; replacement.geometry.addEventListener('dispose', () => replacementDisposed++);
  assembly.dispose(); assert.equal(replacementDisposed, 0, 'hair builder owns new replacement geometry');
  replacement.geometry.dispose(); changed.geometry.dispose();
});

test('incomplete anatomy, duplicated/unknown parts, parent cycles and unmeasured mechanisms fail before use', () => {
  const f = fixture();
  const missingHand = jungleHunterSplitPilotDescriptor(); missingHand.anatomy.parts = missingHand.anatomy.parts.filter(name => name !== 'model_part14');
  assert.throws(() => createSplitYautjaAssembly(f.gltf, missingHand), /both hands/);
  const sameHands = jungleHunterSplitPilotDescriptor(); sameHands.anatomy.requiredParts.leftHand = 'model_part10';
  assert.throws(() => createSplitYautjaAssembly(f.gltf, sameHands), /distinct/);
  const duplicate = jungleHunterSplitPilotDescriptor(); duplicate.equipment[0].parts.push('model_part22');
  assert.throws(() => createSplitYautjaAssembly(f.gltf, duplicate), /more than once/);
  const orphan = jungleHunterSplitPilotDescriptor(); orphan.equipment.pop();
  assert.throws(() => createSplitYautjaAssembly(f.gltf, orphan), /unassigned/);
  const missing = jungleHunterSplitPilotDescriptor(); missing.hair[0].parts.push('not-a-part');
  assert.throws(() => createSplitYautjaAssembly(f.gltf, missing), /missing source/);
  const cycle = jungleHunterSplitPilotDescriptor(); cycle.equipment[0].parent = cycle.equipment[1].id;
  assert.throws(() => createSplitYautjaAssembly(f.gltf, cycle), /cycle/);
  for (const mechanism of [
    { kind: 'slider', axis: [0, 0, 0], travel: 1, restState: 'extended' },
    { kind: 'slider', axis: [0, 1, 0], restState: 'extended' },
    { kind: 'hinge', axis: [1, 0, 0], angle: NaN, restState: 'closed' }
  ]) {
    const config = jungleHunterSplitPilotDescriptor(); config.equipment[1].mechanism = mechanism;
    assert.throws(() => createSplitYautjaAssembly(f.gltf, config), /axis|travel|angle/);
  }
});
