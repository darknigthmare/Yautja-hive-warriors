import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createImportedPartRegions } from '../js/graphics/ImportedPartRegions.js';

// Synthetic topology and poses only; these fixtures make no likeness or GPU claims.
function fixture({ indexed = true, skinned = true } = {}) {
  const scene = new THREE.Group(); scene.name = 'SyntheticSource';
  scene.position.set(2, -1, 3); scene.rotation.set(0.1, 0.24, -0.12); scene.scale.setScalar(1.2);
  const holder = new THREE.Group(); holder.name = 'AuthoredMeshParent';
  holder.position.set(-0.3, 0.5, 0.7); holder.rotation.set(-0.16, 0.2, 0.1); scene.add(holder);
  let geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([
    0, 0, 0, 1, 0, 0, 0, 1, 0, 1, 1, 0, 2, 0, 0, 2, 1, 0,
    200, 200, 200, 201, 201, 201 // Unreferenced vertices must not inflate any region.
  ], 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute([
    0, 0, 0.3, 0, 0, 1, 0.3, 1, 1, 0, 1, 1, 0.7, 0.2, 0.8, 0.3
  ], 2));
  geometry.setAttribute('normal', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [0, 0, 1]).flat(), 3));
  geometry.setAttribute('tangent', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [1, 0, 0, -1]).flat(), 4));
  geometry.setAttribute('testLabel', new THREE.Uint16BufferAttribute([11, 22, 33, 44, 55, 66, 77, 88], 1));
  geometry.setAttribute('color', new THREE.Uint8BufferAttribute(Array.from({ length: 8 }, (_, i) => [i * 20, 80, 200]).flat(), 3, true));
  if (skinned) {
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(Array.from({ length: 8 }, (_, i) => [i < 3 ? 0 : 1, 0, 0, 0]).flat(), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array.from({ length: 8 }, () => [1, 0, 0, 0]).flat(), 4));
  }
  const morph = new THREE.Float32BufferAttribute(Array.from({ length: 8 }, (_, i) => [i * 0.01, 0, i * 0.04]).flat(), 3);
  morph.name = 'SyntheticExpression'; geometry.morphAttributes.position = [morph]; geometry.morphTargetsRelative = true;
  geometry.setIndex([0, 1, 2, 2, 1, 3, 1, 4, 3, 3, 4, 5]);
  geometry.addGroup(0, 3, 0); geometry.addGroup(3, 6, 1); geometry.addGroup(9, 3, 0);
  if (!indexed) { const old = geometry; geometry = geometry.toNonIndexed(); old.dispose(); }
  geometry.setDrawRange(3, 6);
  const texture = new THREE.DataTexture(new Uint8Array([240, 180, 100, 255]), 1, 1);
  const materials = [new THREE.MeshStandardMaterial({ map: texture }), new THREE.MeshStandardMaterial({ map: texture })];
  materials[0].name = 'SharedSourceMaterial'; materials[1].name = 'SecondSourceMaterial';
  const mesh = skinned ? new THREE.SkinnedMesh(geometry, materials) : new THREE.Mesh(geometry, materials);
  mesh.name = 'SourceSurface'; mesh.position.set(0.15, 0.4, -0.2); mesh.rotation.set(0.06, -0.15, 0.09);
  mesh.updateMatrix(); mesh.matrixAutoUpdate = false; holder.add(mesh);
  mesh.morphTargetInfluences[0] = 0.6;
  const rig = new THREE.Group(); rig.name = 'AuthoredArmature'; scene.add(rig);
  const rootBone = new THREE.Bone(); rootBone.name = 'SourceRootBone'; rig.add(rootBone);
  const tipBone = new THREE.Bone(); tipBone.name = 'SourceTipBone'; tipBone.position.set(0.5, 0.9, -0.1); rootBone.add(tipBone);
  const attachment = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.2, 0.1), materials[0]);
  attachment.name = 'PreservedBoneAttachment'; attachment.position.set(0.1, 0.2, 0.3); tipBone.add(attachment);
  const light = new THREE.PointLight(0x88aaff, 0.4); light.name = 'PreservedLight'; scene.add(light);
  scene.updateMatrixWorld(true);
  if (skinned) mesh.bind(new THREE.Skeleton([rootBone, tipBone]), mesh.matrixWorld);
  scene.updateMatrixWorld(true);
  const descriptor = { version: 1, meshes: [{ meshIndex: 0, triangleCount: 4,
    regions: [{ id: 'hair', faces: [0, 2] }], unassignedId: 'unclassified-static' }] };
  return { gltf: { scene, animations: [] }, scene, holder, mesh, geometry, materials, texture, rootBone, tipBone, attachment, descriptor };
}

const round = value => Math.round(value * 1e6) / 1e6 || 0;
const attributeValues = (attribute, index) => Array.from({ length: attribute.itemSize }, (_, component) =>
  attribute[['getX', 'getY', 'getZ', 'getW'][component]](index));
function faceRecords(mesh, rendered = false) {
  const geometry = mesh.geometry, count = geometry.index?.count ?? geometry.attributes.position.count;
  const result = [];
  for (let start = 0; start < count; start += 3) {
    let materialIndex = null;
    if (rendered) {
      if (start < geometry.drawRange.start || start + 3 > geometry.drawRange.start + geometry.drawRange.count) continue;
      if (Array.isArray(mesh.material)) {
        const group = geometry.groups.find(value => start >= value.start && start + 3 <= value.start + value.count);
        if (!group || !mesh.material[group.materialIndex]?.visible) continue;
        materialIndex = group.materialIndex;
      } else if (!mesh.material.visible) continue;
    }
    const vertices = [0, 1, 2].map(offset => geometry.index ? geometry.index.getX(start + offset) : start + offset);
    const record = {
      position: vertices.map(index => mesh.localToWorld(mesh.getVertexPosition(index, new THREE.Vector3())).toArray().map(round)),
      uv: vertices.map(index => attributeValues(geometry.attributes.uv, index).map(round))
    };
    if (rendered) record.materialIndex = materialIndex;
    result.push(record);
  }
  return result;
}
const sortedRecords = records => records.map(value => JSON.stringify(value)).sort();
const regionFaces = (result, rendered = false) => [...result.regions.values()].flatMap(mesh => faceRecords(mesh, rendered));
const allMeshes = scene => { const meshes = []; scene.traverse(node => { if (node.isMesh) meshes.push(node); }); return meshes; };
const materialSet = scene => new Set(allMeshes(scene).flatMap(mesh => Array.isArray(mesh.material) ? mesh.material : [mesh.material]));
const geometrySet = scene => new Set(allMeshes(scene).map(mesh => mesh.geometry));

for (const indexed of [true, false]) {
  test(`${indexed ? 'indexed' : 'unindexed'} regions preserve each authored world triangle once, UVs and rendered material coverage`, () => {
    const f = fixture({ indexed }), original = f.scene.toJSON();
    const allBefore = faceRecords(f.mesh), drawnBefore = faceRecords(f.mesh, true);
    const result = createImportedPartRegions(f.gltf, f.descriptor);
    assert.equal(result.regions instanceof Map, true);
    assert.deepEqual([...result.regions.keys()].sort(), ['hair', 'unclassified-static']);
    result.scene.updateMatrixWorld(true);
    assert.equal(result.scene.getObjectByName('PreservedLight').isPointLight, true);
    assert.equal(result.scene.getObjectByName('PreservedBoneAttachment').parent.name, 'SourceTipBone');
    assert.equal(allMeshes(result.scene).length, 3, 'source mesh is replaced by its two regions without a duplicate full surface');
    assert.deepEqual(sortedRecords(regionFaces(result)), sortedRecords(allBefore));
    assert.deepEqual(sortedRecords(regionFaces(result, true)), sortedRecords(drawnBefore));
    assert.equal(regionFaces(result).length, 4);
    const authoredNode = result.scene.getObjectByName(f.mesh.name);
    assert.equal(authoredNode.parent.name, f.holder.name);
    assert.deepEqual(authoredNode.matrix.elements, f.mesh.matrix.elements);
    assert.equal(authoredNode.matrixAutoUpdate, false);
    for (const mesh of result.regions.values()) {
      assert.equal(mesh.parent, authoredNode);
      assert.deepEqual(mesh.matrixWorld.elements, f.mesh.matrixWorld.elements);
      assert.notEqual(mesh.geometry, f.geometry);
      assert.deepEqual(mesh.morphTargetInfluences, f.mesh.morphTargetInfluences);
      assert.notEqual(mesh.morphTargetInfluences, f.mesh.morphTargetInfluences);
      assert.deepEqual(mesh.morphTargetDictionary, f.mesh.morphTargetDictionary);
    }
    assert.deepEqual(f.scene.toJSON(), original, 'cached source scene and geometry stay unchanged');
    result.dispose();
  });
}

test('regions compact every vertex and morph attribute while preserving shared indexed vertices and typed values', () => {
  const f = fixture(), result = createImportedPartRegions(f.gltf, f.descriptor);
  for (const [id, region] of result.regions) {
    const expectedVertices = id === 'hair' ? [0, 1, 2, 3, 4] : [1, 2, 3, 4, 5];
    assert.equal(region.geometry.attributes.position.count, expectedVertices.length);
    assert.equal(region.geometry.index.count, 6);
    const sourceByLabel = new Map(Array.from({ length: f.geometry.attributes.testLabel.count }, (_, i) => [f.geometry.attributes.testLabel.getX(i), i]));
    const actualSourceVertices = [];
    for (let vertex = 0; vertex < region.geometry.attributes.position.count; vertex++) {
      const sourceVertex = sourceByLabel.get(region.geometry.attributes.testLabel.getX(vertex));
      actualSourceVertices.push(sourceVertex);
      for (const [name, source] of Object.entries(f.geometry.attributes)) {
        const actual = region.geometry.attributes[name];
        assert.notEqual(actual.array, source.array, name);
        assert.equal(actual.count, expectedVertices.length, name);
        assert.equal(actual.array.constructor, source.array.constructor, name);
        assert.equal(actual.itemSize, source.itemSize, name);
        assert.equal(actual.normalized, source.normalized, name);
        assert.deepEqual(attributeValues(actual, vertex), attributeValues(source, sourceVertex), name);
      }
      const actualMorph = region.geometry.morphAttributes.position[0], sourceMorph = f.geometry.morphAttributes.position[0];
      assert.notEqual(actualMorph.array, sourceMorph.array);
      assert.deepEqual(attributeValues(actualMorph, vertex), attributeValues(sourceMorph, sourceVertex));
      assert.equal(actualMorph.name, sourceMorph.name);
    }
    assert.deepEqual(actualSourceVertices.sort((a, b) => a - b), expectedVertices);
    assert.equal(region.geometry.morphTargetsRelative, true);
  }
  result.dispose();
});

test('bounded face ranges select the same triangles as face indices and reject overlapping or ambiguous ranges', () => {
  const f = fixture(), descriptor = structuredClone(f.descriptor);
  delete descriptor.meshes[0].regions[0].faces;
  descriptor.meshes[0].regions[0].faceRanges = [[0, 1], [2, 1]];
  const result = createImportedPartRegions(f.gltf, descriptor);
  assert.deepEqual(sortedRecords(regionFaces(result)), sortedRecords(faceRecords(f.mesh)));
  assert.deepEqual(sortedRecords(faceRecords(result.regions.get('hair'))), sortedRecords([faceRecords(f.mesh)[0], faceRecords(f.mesh)[2]]));
  assert.deepEqual(sortedRecords(regionFaces(result, true)), sortedRecords(faceRecords(f.mesh, true)));
  result.dispose();
  const original = f.scene.toJSON();
  const invalid = change => {
    const next = structuredClone(descriptor); change(next.meshes[0].regions[0]);
    assert.throws(() => createImportedPartRegions(f.gltf, next));
    assert.deepEqual(f.scene.toJSON(), original);
  };
  invalid(region => region.faces = [0, 2]);
  invalid(region => region.faceRanges = [[0, 2], [1, 1]]);
  invalid(region => region.faceRanges = [[3, 2]]);
  invalid(region => region.faceRanges = [[0, 0]]);
  invalid(region => region.faceRanges = [[-1, 1]]);
  invalid(region => region.faceRanges = [[0, 0.5]]);
  invalid(region => region.faceRanges = [[0, Infinity]]);
  invalid(region => region.faceRanges = [[0, 1, 2]]);
});

test('interleaved glTF vertex data remains aligned when regions use a compact vertex set', () => {
  const f = fixture(), values = [];
  for (let vertex = 0; vertex < f.geometry.attributes.position.count; vertex++) {
    values.push(...attributeValues(f.geometry.attributes.position, vertex), ...attributeValues(f.geometry.attributes.uv, vertex));
  }
  const buffer = new THREE.InterleavedBuffer(new Float32Array(values), 5);
  f.geometry.setAttribute('position', new THREE.InterleavedBufferAttribute(buffer, 3, 0));
  f.geometry.setAttribute('uv', new THREE.InterleavedBufferAttribute(buffer, 2, 3));
  const before = buffer.array.slice(), expected = sortedRecords(faceRecords(f.mesh));
  const result = createImportedPartRegions(f.gltf, f.descriptor);
  result.scene.updateMatrixWorld(true);
  assert.deepEqual(sortedRecords(regionFaces(result)), expected);
  for (const region of result.regions.values()) {
    assert.equal(region.geometry.attributes.position.count, 5);
    assert.equal(region.geometry.attributes.uv.count, 5);
    region.geometry.attributes.position.setX(0, 900);
    assert.deepEqual(buffer.array, before, 'compact data must not reuse the cached interleaved buffer');
  }
  result.dispose();
});

test('interleaved normalized skin weights preserve actual skin deformation and private storage', () => {
  const f = fixture(), values = [];
  for (let vertex = 0; vertex < f.geometry.attributes.position.count; vertex++) {
    values.push(...attributeValues(f.geometry.attributes.skinIndex, vertex), ...attributeValues(f.geometry.attributes.skinWeight, vertex).map(value => value * 65535));
  }
  const buffer = new THREE.InterleavedBuffer(new Uint16Array(values), 8);
  f.geometry.setAttribute('skinIndex', new THREE.InterleavedBufferAttribute(buffer, 4, 0));
  f.geometry.setAttribute('skinWeight', new THREE.InterleavedBufferAttribute(buffer, 4, 4, true));
  const original = buffer.array.slice(), result = createImportedPartRegions(f.gltf, f.descriptor);
  f.tipBone.rotation.y = 0.41;
  result.scene.getObjectByName(f.tipBone.name).rotation.y = 0.41;
  f.scene.updateMatrixWorld(true); result.scene.updateMatrixWorld(true);
  assert.deepEqual(sortedRecords(regionFaces(result)), sortedRecords(faceRecords(f.mesh)));
  for (const region of result.regions.values()) {
    const weights = region.geometry.attributes.skinWeight;
    assert.equal(weights.normalized, true); assert.equal(weights.array.constructor, Uint16Array);
    for (let vertex = 0; vertex < weights.count; vertex++) assert.equal(attributeValues(weights, vertex).reduce((sum, value) => sum + value, 0), 1);
    weights.setX(0, 0.25);
    assert.deepEqual(buffer.array, original);
  }
  result.dispose();
});

test('animation clips targeting the authored morph node continue to deform every region of one actor', () => {
  const f = fixture();
  const clip = new THREE.AnimationClip('SyntheticMorphAnimation', 1, [new THREE.NumberKeyframeTrack('SourceSurface.morphTargetInfluences[0]', [0, 1], [0.6, 1])]);
  f.gltf.animations.push(clip);
  const a = createImportedPartRegions(f.gltf, f.descriptor), b = createImportedPartRegions(f.gltf, f.descriptor);
  const beforeA = sortedRecords(regionFaces(a)), beforeB = sortedRecords(regionFaces(b));
  const mixer = new THREE.AnimationMixer(a.scene); mixer.clipAction(clip).play(); mixer.update(0.5);
  a.scene.updateMatrixWorld(true);
  for (const region of a.regions.values()) assert.ok(Math.abs(region.morphTargetInfluences[0] - 0.8) < 1e-6);
  assert.notDeepEqual(sortedRecords(regionFaces(a)), beforeA, 'the animation reaches region vertex positions');
  assert.deepEqual(sortedRecords(regionFaces(b)), beforeB);
  assert.equal(f.mesh.morphTargetInfluences[0], 0.6);
  const sourceMixer = new THREE.AnimationMixer(f.scene); sourceMixer.clipAction(clip).play(); sourceMixer.update(0.5);
  assert.deepEqual(sortedRecords(regionFaces(a)), sortedRecords(faceRecords(f.mesh)));
  mixer.stopAllAction(); mixer.uncacheRoot(a.scene); sourceMixer.stopAllAction(); sourceMixer.uncacheRoot(f.scene);
  a.dispose(); b.dispose();
});

test('cloned bones deform actual region surfaces with the same pose as the original mesh', () => {
  const f = fixture(), a = createImportedPartRegions(f.gltf, f.descriptor), b = createImportedPartRegions(f.gltf, f.descriptor);
  a.scene.updateMatrixWorld(true); b.scene.updateMatrixWorld(true);
  const beforeA = sortedRecords(regionFaces(a)), beforeB = sortedRecords(regionFaces(b));
  const actorTip = a.scene.getObjectByName(f.tipBone.name);
  assert.notEqual(actorTip, f.tipBone); assert.notEqual(actorTip, b.scene.getObjectByName(f.tipBone.name));
  actorTip.rotation.z = 0.48; actorTip.position.x += 0.2;
  a.scene.updateMatrixWorld(true);
  assert.notDeepEqual(sortedRecords(regionFaces(a)), beforeA, 'the selected surface, not just a helper bone, moves');
  assert.deepEqual(sortedRecords(regionFaces(b)), beforeB, 'another actor retains its pose');
  f.tipBone.rotation.z = 0.48; f.tipBone.position.x += 0.2; f.scene.updateMatrixWorld(true);
  assert.deepEqual(sortedRecords(regionFaces(a)), sortedRecords(faceRecords(f.mesh)), 'posed regions reproduce source skinning');
  for (const mesh of a.regions.values()) {
    assert.equal(mesh.isSkinnedMesh, true);
    assert.equal(mesh.skeleton.bones[1], actorTip);
    assert.notEqual(mesh.skeleton, f.mesh.skeleton);
    assert.notEqual(mesh.skeleton.boneInverses[0], f.mesh.skeleton.boneInverses[0]);
    assert.deepEqual(mesh.skeleton.boneInverses[0].elements, f.mesh.skeleton.boneInverses[0].elements);
  }
  const hairA = a.regions.get('hair'), hairB = b.regions.get('hair');
  const originalWeight = hairB.geometry.attributes.skinWeight.getX(0);
  hairA.geometry.attributes.skinWeight.setX(0, 0.25);
  assert.equal(hairB.geometry.attributes.skinWeight.getX(0), originalWeight);
  assert.equal(f.geometry.attributes.skinWeight.getX(0), originalWeight);
  hairA.morphTargetInfluences[0] = 0.9;
  assert.equal(hairB.morphTargetInfluences[0], 0.6);
  assert.equal(f.mesh.morphTargetInfluences[0], 0.6);
  a.dispose(); b.dispose();
});

test('all actor geometry and materials are private, shared source materials are cached, and disposal never touches textures or another actor', () => {
  const f = fixture(), a = createImportedPartRegions(f.gltf, f.descriptor), b = createImportedPartRegions(f.gltf, f.descriptor);
  const ownedGeometry = geometrySet(a.scene), ownedMaterials = materialSet(a.scene);
  const sourceGeometry = geometrySet(f.scene), sourceMaterials = materialSet(f.scene);
  assert.equal(ownedMaterials.size, sourceMaterials.size, 'one private clone per distinct source material');
  assert.equal(a.regions.get('hair').material[0], a.scene.getObjectByName(f.attachment.name).material);
  let disposedGeometry = 0, disposedMaterials = 0, sourceDisposals = 0, otherDisposals = 0, textureDisposals = 0;
  for (const geometry of ownedGeometry) {
    assert.equal(sourceGeometry.has(geometry), false); assert.equal(geometrySet(b.scene).has(geometry), false);
    geometry.addEventListener('dispose', () => disposedGeometry++);
  }
  for (const material of ownedMaterials) {
    assert.equal(sourceMaterials.has(material), false); assert.equal(materialSet(b.scene).has(material), false);
    assert.equal(material.map, f.texture); material.addEventListener('dispose', () => disposedMaterials++);
  }
  for (const resource of [...sourceGeometry, ...sourceMaterials]) resource.addEventListener('dispose', () => sourceDisposals++);
  for (const resource of [...geometrySet(b.scene), ...materialSet(b.scene)]) resource.addEventListener('dispose', () => otherDisposals++);
  f.texture.addEventListener('dispose', () => textureDisposals++);
  a.regions.get('hair').material[0].color.set(0x123456);
  assert.notEqual(a.regions.get('hair').material[0].color.getHex(), b.regions.get('hair').material[0].color.getHex());
  a.dispose(); a.dispose();
  assert.equal(disposedGeometry, ownedGeometry.size); assert.equal(disposedMaterials, ownedMaterials.size);
  assert.equal(sourceDisposals, 0); assert.equal(otherDisposals, 0); assert.equal(textureDisposals, 0);
  b.scene.getObjectByName(f.tipBone.name).rotation.x = 0.2; b.scene.updateMatrixWorld(true);
  assert.equal(regionFaces(b).length, 4, 'the second actor remains usable after disposal');
  b.dispose(); assert.equal(textureDisposals, 0); assert.equal(sourceDisposals, 0);
});

test('rigid imported surfaces retain their type and unassigned triangles receive no inferred category', () => {
  const f = fixture({ skinned: false }), result = createImportedPartRegions(f.gltf, f.descriptor);
  assert.equal(result.regions.get('hair').isSkinnedMesh, undefined);
  assert.equal(result.regions.get('unclassified-static').isSkinnedMesh, undefined);
  assert.equal(result.regions.size, 2);
  assert.equal(faceRecords(result.regions.get('unclassified-static')).length, 2);
  assert.deepEqual(sortedRecords(regionFaces(result)), sortedRecords(faceRecords(f.mesh)));
  result.dispose();
});

test('descriptor validation rejects ambiguous, unbounded or duplicate face ownership before mutating the cache', () => {
  const f = fixture(), original = f.scene.toJSON();
  const invalid = change => {
    const descriptor = structuredClone(f.descriptor); change(descriptor);
    assert.throws(() => createImportedPartRegions(f.gltf, descriptor));
    assert.deepEqual(f.scene.toJSON(), original);
  };
  invalid(d => d.version = 2);
  invalid(d => delete d.meshes[0].triangleCount);
  invalid(d => d.meshes[0].triangleCount = 3);
  invalid(d => d.meshes[0].meshIndex = 999);
  invalid(d => d.meshes[0].meshIndex = 0.5);
  invalid(d => d.meshes.push(structuredClone(d.meshes[0])));
  invalid(d => d.meshes[0].regions[0].faces.push(0));
  invalid(d => d.meshes[0].regions.push({ id: 'other', faces: [2] }));
  invalid(d => d.meshes[0].regions.push({ id: 'hair', faces: [1] }));
  invalid(d => d.meshes[0].unassignedId = 'hair');
  invalid(d => d.meshes[0].regions[0].faces = [-1]);
  invalid(d => d.meshes[0].regions[0].faces = [4]);
  invalid(d => d.meshes[0].regions[0].faces = [0.5]);
  invalid(d => d.meshes[0].regions[0].faces = [NaN]);
  invalid(d => d.meshes[0].regions[0].faces = [Infinity]);
  invalid(d => delete d.meshes[0].regions[0].faces);
  invalid(d => { delete d.meshes[0].regions[0].faces; d.meshes[0].regions[0].allFaces = true; });
  invalid(d => d.meshes.push({ meshIndex: 1, triangleCount: 12, regions: [{ id: 'hair', faces: [0] }], unassignedId: 'accessory-static' }));
});

test('malformed geometry, nonfinite data and foreign skeleton bones are rejected', () => {
  const invalid = change => {
    const f = fixture(); change(f);
    assert.throws(() => createImportedPartRegions(f.gltf, f.descriptor));
  };
  invalid(f => f.geometry.attributes.position.setX(0, NaN));
  invalid(f => f.geometry.attributes.uv.setY(1, Infinity));
  invalid(f => f.geometry.morphAttributes.position[0].setZ(1, NaN));
  invalid(f => f.geometry.setIndex([0, 1, 99, 2, 1, 3, 1, 4, 3, 3, 4, 5]));
  invalid(f => f.geometry.setIndex([0, 1, 2, 2, 1, 3, 1, 4, 3, 3, 4]));
  invalid(f => f.geometry.setAttribute('testLabel', new THREE.Uint16BufferAttribute([1, 2], 1)));
  invalid(f => f.geometry.deleteAttribute('skinWeight'));
  invalid(f => f.geometry.deleteAttribute('skinIndex'));
  invalid(f => f.geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(Array(24).fill(1 / 3), 3)));
  invalid(f => f.geometry.attributes.skinWeight.setX(0, -1));
  invalid(f => f.geometry.attributes.skinWeight.setX(0, NaN));
  invalid(f => f.geometry.attributes.skinIndex.setX(0, 7));
  invalid(f => f.mesh.skeleton.bones[1] = new THREE.Bone());
  invalid(f => f.mesh.skeleton.boneInverses[1].elements[0] = Infinity);
  invalid(f => f.mesh.bindMatrix.elements[0] = NaN);
  invalid(f => f.scene.position.x = NaN);
  invalid(f => { f.holder.matrixAutoUpdate = false; f.holder.matrix.elements[12] = Infinity; });
});
