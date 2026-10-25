import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { applyBoneRestCorrections } from '../js/graphics/BoneRestCorrections.js';

const SHA = 'b'.repeat(64);
const near = (a, b, tolerance = 1e-8) => assert.ok(a.distanceTo(b) <= tolerance, `${a.toArray()} != ${b.toArray()}`);
const worldVertex = (mesh, vertex) => mesh.getVertexPosition(vertex, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld);
function fixture({ scale = 1, affine = false, sharedInverses = false } = {}) {
  const scene = new THREE.Group(); scene.name = 'PrivateRoot'; scene.scale.setScalar(scale);
  if (affine) { scene.position.set(.8, 1.1, -.7); scene.rotation.set(.2, -.3, .1); scene.scale.set(1.3, .8, 1.1); }
  const shoulder = new THREE.Bone(); shoulder.name = 'LeftShoulder'; scene.add(shoulder);
  const arm = new THREE.Bone(); arm.name = 'LeftArm'; arm.position.set(1, 0, 0); shoulder.add(arm);
  const forearm = new THREE.Bone(); forearm.name = 'LeftForeArm'; forearm.position.set(1, 0, 0); arm.add(forearm);
  const hand = new THREE.Bone(); hand.name = 'LeftHand'; hand.position.set(1, 0, 0); forearm.add(hand);
  const material = new THREE.MeshStandardMaterial();
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([2, 0, 0, 2, .5, 0, 2, 0, .5], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute([1, 0, 0, 0, 1, 2, 0, 0, 2, 3, 0, 0], 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute([1, 0, 0, 0, .5, .5, 0, 0, .4, .6, 0, 0], 4)); geometry.setIndex([0, 1, 2]);
  const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = 'BodyA'; scene.add(mesh);
  const mesh2 = new THREE.SkinnedMesh(geometry, material); mesh2.name = 'BodyB'; scene.add(mesh2);
  const marker = new THREE.Mesh(new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, .1, 0, 0, 0, .1, 0], 3)), material); marker.name = 'NonSkinnedMarker'; marker.position.set(.3, .4, .2); arm.add(marker);
  scene.updateMatrixWorld(true);
  const skeleton = new THREE.Skeleton([shoulder, arm, forearm, hand]); mesh.bind(skeleton);
  const skeleton2 = new THREE.Skeleton([shoulder, arm, forearm, hand], sharedInverses ? skeleton.boneInverses : skeleton.boneInverses.map(matrix => matrix.clone())); mesh2.bind(skeleton2, mesh.bindMatrix);
  scene.updateMatrixWorld(true);
  return { scene, shoulder, arm, forearm, hand, marker, mesh, mesh2, skeleton, skeleton2, descriptor: { version: 1, calibrated: true, sourceSha256: SHA, joints: [{ bone: 'LeftArm', parent: 'LeftShoulder', position: [1.5, 0, 0] }] } };
}
const apply = f => applyBoneRestCorrections(f.scene, f.descriptor, { sourceSha256: SHA, privateScene: true });

test('measured pivot changes real rotation center while all rest vertices and descendants stay fixed', () => {
  const f = fixture(), surfaces = [f.mesh, f.mesh2, f.marker].map(mesh => Array.from({ length: mesh.geometry.attributes.position.count }, (_, vertex) => worldVertex(mesh, vertex)));
  const descendants = [f.forearm, f.hand, f.marker].map(node => node.matrixWorld.clone());
  const result = apply(f); assert.equal(result.applied, true); assert.equal(result.diagnostics.trianglesVerified, 3); assert.ok(result.diagnostics.maxRestWorldError < 1e-7);
  near(f.arm.position, new THREE.Vector3(1.5, 0, 0));
  [f.mesh, f.mesh2, f.marker].forEach((mesh, at) => surfaces[at].forEach((point, vertex) => near(worldVertex(mesh, vertex), point)));
  [f.forearm, f.hand, f.marker].forEach((node, at) => assert.deepEqual(node.matrixWorld.elements, descendants[at].elements));
  f.arm.rotation.z = Math.PI / 2; f.scene.updateMatrixWorld(true);
  near(worldVertex(f.mesh, 0), new THREE.Vector3(1.5, .5, 0));
  near(f.forearm.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(1.5, .5, 0));
});

test('every skin gets private compensated inverses; cached source nodes, matrices and geometry stay unchanged', () => {
  const source = fixture({ affine: true, sharedInverses: true });
  const sourceNodes = []; source.scene.traverse(node => sourceNodes.push({ node, position: node.position.toArray(), matrix: node.matrixWorld.toArray() }));
  const originalInverseArray = source.skeleton.boneInverses, originalInverses = originalInverseArray.map(matrix => matrix.toArray());
  const cachedPositions = Array.from(source.mesh.geometry.attributes.position.array), cachedUV = Array.from(source.mesh.geometry.attributes.uv.array);
  const privateScene = cloneSkeleton(source.scene);
  const result = applyBoneRestCorrections(privateScene, source.descriptor, { sourceSha256: SHA, privateScene: true });
  assert.equal(result.diagnostics.skeletons, 2); assert.equal(result.diagnostics.inverseBindMatricesCloned, 8);
  const a = privateScene.getObjectByName('BodyA').skeleton, b = privateScene.getObjectByName('BodyB').skeleton;
  assert.notEqual(a.boneInverses, originalInverseArray); assert.notEqual(b.boneInverses, originalInverseArray); assert.notEqual(a.boneInverses, b.boneInverses);
  for (let i = 0; i < 4; i++) { assert.notEqual(a.boneInverses[i], originalInverseArray[i]); assert.notEqual(a.boneInverses[i], b.boneInverses[i]); }
  sourceNodes.forEach(({ node, position, matrix }) => { assert.deepEqual(node.position.toArray(), position); assert.deepEqual(node.matrixWorld.toArray(), matrix); });
  assert.deepEqual(originalInverseArray.map(matrix => matrix.toArray()), originalInverses);
  assert.deepEqual(Array.from(source.mesh.geometry.attributes.position.array), cachedPositions); assert.deepEqual(Array.from(source.mesh.geometry.attributes.uv.array), cachedUV);
});

test('centimetre armature and a large measured parent-local translation preserve world surfaces', () => {
  const f = fixture({ scale: .01 });
  f.descriptor.joints[0].position = [-24.129454994679115, -6.445566247060389, 4.8692597110073725];
  const before = [f.mesh, f.mesh2, f.marker].flatMap(mesh => Array.from({ length: mesh.geometry.attributes.position.count }, (_, vertex) => ({ mesh, vertex, point: worldVertex(mesh, vertex) })));
  const result = apply(f); assert.ok(result.diagnostics.maxRestWorldError < 1e-6);
  before.forEach(({ mesh, vertex, point }) => near(worldVertex(mesh, vertex), point, 1e-6));
});

test('a manual affine child keeps its complete world matrix without a decomposition', () => {
  const f = fixture({ affine: true });
  f.marker.matrixAutoUpdate = false; f.marker.matrix.set(1, .2, 0, .3, 0, 1, .1, .4, 0, 0, 1, .2, 0, 0, 0, 1); f.scene.updateMatrixWorld(true);
  const before = f.marker.matrixWorld.clone(); apply(f);
  f.marker.matrixWorld.elements.forEach((value, index) => assert.ok(Math.abs(value - before.elements[index]) < 1e-8));
  assert.equal(f.marker.matrixAutoUpdate, false); assert.equal(f.marker.matrix.elements[4], .2);
});

test('failed world-surface proof rolls back every node, flags, bind and inverse-array identity', () => {
  const f = fixture(), snapshots = []; f.arm.rotation.z = Math.PI * 3; f.scene.updateMatrixWorld(true);
  f.scene.traverse(node => snapshots.push({ node, position: node.position.toArray(), rotation: node.rotation.toArray(), quaternion: node.quaternion.toArray(), matrix: node.matrix.toArray(), world: node.matrixWorld.toArray(), dirty: node.matrixWorldNeedsUpdate }));
  const inverses = [f.skeleton.boneInverses, f.skeleton2.boneInverses], inverseValues = inverses.map(list => list.map(matrix => matrix.toArray()));
  const bind = f.mesh.bindMatrixInverse.toArray(), native = f.mesh.getVertexPosition; let calls = 0;
  f.mesh.getVertexPosition = function (vertex, target) { native.call(this, vertex, target); if (++calls > this.geometry.attributes.position.count) target.x += 1; return target; };
  assert.throws(() => apply(f), /world rest surface/);
  snapshots.forEach(({ node, position, rotation, quaternion, matrix, world, dirty }) => { assert.deepEqual(node.position.toArray(), position); assert.deepEqual(node.rotation.toArray(), rotation); assert.deepEqual(node.quaternion.toArray(), quaternion); assert.deepEqual(node.matrix.toArray(), matrix); assert.deepEqual(node.matrixWorld.toArray(), world); assert.equal(node.matrixWorldNeedsUpdate, dirty); });
  assert.equal(f.skeleton.boneInverses, inverses[0]); assert.equal(f.skeleton2.boneInverses, inverses[1]);
  assert.deepEqual(inverses.map(list => list.map(matrix => matrix.toArray())), inverseValues); assert.deepEqual(f.mesh.bindMatrixInverse.toArray(), bind);
});

test('hash, parent, private ownership and overlapping joint guards fail without mutation', () => {
  const f = fixture(), original = f.arm.position.toArray();
  assert.throws(() => applyBoneRestCorrections(f.scene, f.descriptor, { sourceSha256: SHA }), /private scene/);
  assert.throws(() => applyBoneRestCorrections(f.scene, f.descriptor, { sourceSha256: 'c'.repeat(64), privateScene: true }), /SHA/);
  const wrongParent = structuredClone(f.descriptor); wrongParent.joints[0].parent = 'WrongParent'; assert.throws(() => applyBoneRestCorrections(f.scene, wrongParent, { sourceSha256: SHA, privateScene: true }), /parent/);
  const overlapping = structuredClone(f.descriptor); overlapping.joints.push({ bone: 'LeftForeArm', parent: 'LeftArm', position: [1, 0, 0] }); assert.throws(() => applyBoneRestCorrections(f.scene, overlapping, { sourceSha256: SHA, privateScene: true }), /ancestor/);
  assert.deepEqual(f.arm.position.toArray(), original);
});
