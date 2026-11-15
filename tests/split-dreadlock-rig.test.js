import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createSplitDreadlockRig } from '../js/graphics/SplitDreadlockRig.js';
import { createYautjaArticulation } from '../js/graphics/YautjaArticulation.js';

// Synthetic topology fixture, never a likeness/reference approval.
function fixture() {
  const root = new THREE.Group(), head = new THREE.Group(); head.name = 'FixtureHeadAttachment'; root.add(head);
  const positions = [], colors = [], uv = [], triangles = [], selections = [], rootVertices = [], curves = [];
  for (let strand = 0; strand < 2; strand++) {
    const offset = positions.length / 3, x = strand ? 0.18 : -0.18;
    const joints = [[x, 1.5, 0], [x + 0.035, 1.2, 0.035], [x + 0.07, 0.9, 0.07]];
    for (let ring = 0; ring < 5; ring++) for (let edge = 0; edge < 3; edge++) {
      const t = ring / 4, theta = edge * Math.PI * 2 / 3;
      positions.push(x + 0.07 * t + Math.cos(theta) * 0.012, 1.5 - 0.6 * t, 0.07 * t + Math.sin(theta) * 0.012);
      colors.push(0.2 + strand * 0.1, 0.1, 0.05); uv.push(edge / 2, t);
      if (!ring) rootVertices.push(offset + edge);
    }
    for (let ring = 0; ring < 4; ring++) for (let edge = 0; edge < 3; edge++) {
      const a = offset + ring * 3 + edge, b = offset + ring * 3 + (edge + 1) % 3;
      triangles.push(a, a + 3, b, b, a + 3, b + 3);
    }
    const vertices = Array.from({ length: 15 }, (_, i) => offset + i); selections.push(vertices);
    curves.push({ id: `strand${strand}`, joints, vertices, radius: 0.03, rootBlendLength: 0.045,
      stiffness: strand ? 100 : 20, damping: 4, gravityScale: 0, maxAngle: 1.2 });
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geometry.setIndex(triangles); geometry.addGroup(0, triangles.length, 0); geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ vertexColors: true });
  const mesh = new THREE.Mesh(geometry, material); mesh.name = 'FixtureMeasuredHair'; head.add(mesh); root.updateMatrixWorld(true);
  return { root, head, mesh, geometry, material, selections, descriptor: { version: 1, namespace: 'FixtureHair', rootVertices, chains: curves } };
}
const worldVertex = (mesh, index) => mesh.localToWorld(mesh.getVertexPosition(index, new THREE.Vector3()));
const close = (a, b, reason) => assert.ok(a.distanceTo(b) < 1e-6, reason ?? `${a.toArray()} != ${b.toArray()}`);

test('measured skinning preserves all source surfaces and neutral pose, including authored matrices', () => {
  const f = fixture(); f.mesh.position.set(0.2, 0.3, -0.4); f.mesh.rotation.set(0.1, 0.2, -0.1); f.mesh.scale.setScalar(1.3);
  f.head.position.set(2, 3, -1); f.head.rotation.set(0.2, 0.7, -0.1); f.head.scale.setScalar(1.4);
  f.mesh.updateMatrix(); f.mesh.matrixAutoUpdate = false; f.root.updateMatrixWorld(true);
  const original = f.mesh.toJSON(), before = Array.from({ length: 30 }, (_, i) => worldVertex(f.mesh, i));
  const rig = createSplitDreadlockRig(f.mesh, f.descriptor); f.head.add(rig.mesh); f.root.updateMatrixWorld(true); rig.mesh.skeleton.update();
  assert.equal(rig.mesh.isSkinnedMesh, true); assert.equal(rig.mesh.matrixAutoUpdate, false);
  assert.deepEqual(rig.mesh.matrix.elements, f.mesh.matrix.elements); assert.notEqual(rig.mesh.geometry, f.geometry);
  assert.equal(rig.mesh.material, f.material); assert.deepEqual(rig.mesh.geometry.index.array, f.geometry.index.array);
  for (const [name, attribute] of Object.entries(f.geometry.attributes)) {
    assert.notEqual(rig.mesh.geometry.attributes[name], attribute, name);
    assert.deepEqual(rig.mesh.geometry.attributes[name].array, attribute.array, name);
  }
  assert.deepEqual(rig.mesh.geometry.groups, f.geometry.groups);
  before.forEach((point, i) => close(worldVertex(rig.mesh, i), point, 'binding must not change any rest vertex'));
  assert.deepEqual(f.mesh.toJSON(), original); assert.equal(rig.chains.size, 2);
  const indices = rig.mesh.geometry.attributes.skinIndex, weights = rig.mesh.geometry.attributes.skinWeight;
  for (let i = 0; i < 30; i++) {
    const sum = weights.getX(i) + weights.getY(i) + weights.getZ(i) + weights.getW(i);
    assert.ok(Math.abs(sum - 1) < 1e-6);
    for (const slot of ['getX', 'getY', 'getZ', 'getW']) assert.ok(indices[slot](i) < rig.mesh.skeleton.bones.length);
  }
  rig.dispose();
});

test('real weighted strand surfaces lag their moving head while cap vertices stay anchored', () => {
  const f = fixture(), rig = createSplitDreadlockRig(f.mesh, f.descriptor); f.head.add(rig.mesh);
  const physics = createYautjaArticulation(f.root, rig.articulationDescriptor, { gravity: [0, 0, 0] });
  const before = worldVertex(rig.mesh, 12), cap = worldVertex(rig.mesh, 0);
  f.head.position.x = 0.18; physics.update(1 / 60);
  close(worldVertex(rig.mesh, 0), cap.clone().add(new THREE.Vector3(0.18, 0, 0)), 'cap surface is anchored to the head');
  const rigidTip = before.clone().add(new THREE.Vector3(0.18, 0, 0));
  assert.ok(worldVertex(rig.mesh, 12).distanceTo(rigidTip) > 0.02, 'surface vertices must move independently, not only helper bones');
  for (let frame = 0; frame < 24; frame++) physics.update(1 / 60, { wind: [0.4, 0, 0.1] });
  assert.ok(rig.chains.get('strand0').bones[0].quaternion.angleTo(rig.chains.get('strand1').bones[0].quaternion) > 0.005);
  physics.reset(); close(worldVertex(rig.mesh, 12), rigidTip);
  physics.dispose(); rig.dispose();
});

test('unselected and explicitly capped vertices stay rigid instead of acquiring inferred strand ownership', () => {
  const f = fixture(); f.descriptor.chains = [f.descriptor.chains[0]];
  const rig = createSplitDreadlockRig(f.mesh, f.descriptor); f.head.add(rig.mesh);
  const physics = createYautjaArticulation(f.root, rig.articulationDescriptor, { gravity: [0, 0, 0] });
  const original = worldVertex(rig.mesh, 27); f.head.position.x = 0.2;
  for (let frame = 0; frame < 8; frame++) physics.update(1 / 60);
  close(worldVertex(rig.mesh, 27), original.clone().add(new THREE.Vector3(0.2, 0, 0)));
  assert.equal(rig.diagnostics.unselectedVerticesAnchored, true);
  physics.dispose(); rig.dispose();
});

test('actor instances have private weights, bones and physics and dispose only owned resources once', () => {
  const f = fixture(), a = createSplitDreadlockRig(f.mesh, f.descriptor), b = createSplitDreadlockRig(f.mesh, { ...f.descriptor, namespace: 'OtherActorHair' });
  const first = new THREE.Group(), second = new THREE.Group(); first.add(a.mesh); second.add(b.mesh);
  const pa = createYautjaArticulation(first, a.articulationDescriptor, { gravity: [0, 0, 0] });
  const pb = createYautjaArticulation(second, b.articulationDescriptor, { gravity: [0, 0, 0] });
  const before = worldVertex(b.mesh, 12); first.position.x = 0.15; pa.update(1 / 60);
  close(worldVertex(b.mesh, 12), before); assert.notEqual(a.mesh.geometry.attributes.skinWeight.array, b.mesh.geometry.attributes.skinWeight.array);
  let own = 0, original = 0, material = 0;
  a.mesh.geometry.addEventListener('dispose', () => own++); f.geometry.addEventListener('dispose', () => original++); f.material.addEventListener('dispose', () => material++);
  pa.dispose(); assert.equal(a.dispose(), true); assert.equal(a.dispose(), false);
  assert.equal(a.mesh.parent, null); assert.equal(own, 1); assert.equal(original, 0); assert.equal(material, 0);
  assert.equal(pb.update(1 / 60), true); pb.dispose(); b.dispose();
});

test('invalid or ambiguous curve classifications fail before changing the source', () => {
  const f = fixture(), before = f.mesh.toJSON();
  const invalid = change => { const d = structuredClone(f.descriptor); change(d); assert.throws(() => createSplitDreadlockRig(f.mesh, d), /SplitDreadlockRig/); };
  invalid(d => d.chains[1].vertices.push(4));
  invalid(d => d.chains[1].id = d.chains[0].id);
  invalid(d => d.rootVertices = []);
  invalid(d => d.rootVertices.push(d.rootVertices[0]));
  invalid(d => d.chains[0].joints[1] = d.chains[0].joints[0]);
  invalid(d => d.chains[0].joints[1][0] = NaN);
  invalid(d => d.chains[0].radius = 0.00001);
  invalid(d => d.chains[0].vertices = [500]);
  invalid(d => { d.chains[0].allVertices = true; delete d.chains[0].vertices; });
  invalid(d => delete d.namespace);
  assert.deepEqual(f.mesh.toJSON(), before);
  f.mesh.scale.set(1, 2, 1); assert.throws(() => createSplitDreadlockRig(f.mesh, f.descriptor), /uniform/);
});

test('inactive geometry cannot satisfy the two genuinely weighted segment requirement', () => {
  const f = fixture(); f.geometry.setDrawRange(0, 3);
  assert.throws(() => createSplitDreadlockRig(f.mesh, f.descriptor), /two non-tip/);
  f.geometry.setDrawRange(0, Infinity); f.geometry.clearGroups(); f.mesh.material = [f.material];
  assert.throws(() => createSplitDreadlockRig(f.mesh, f.descriptor), /no rendered/);
  f.geometry.addGroup(0, 12, 0);
  assert.throws(() => createSplitDreadlockRig(f.mesh, f.descriptor), /two non-tip/);
  f.mesh.material = f.material;
  const single = createSplitDreadlockRig(f.mesh, f.descriptor);
  assert.equal(single.chains.size, 2, 'a single material renders the whole draw range regardless of groups');
  single.dispose();
});
