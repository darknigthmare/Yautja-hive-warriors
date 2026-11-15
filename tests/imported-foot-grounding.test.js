import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createImportedFootGrounding } from '../js/graphics/ImportedFootGrounding.js';

const SHA = 'b'.repeat(64);
const close = (a, b, message) => assert.ok(Math.abs(a - b) <= 1e-6, message ?? `${a} != ${b}`);

// Synthetic geometry with an interior vertex at a different X coordinate.
// Hull contact must agree with ALL actual skinned vertices, not a bone pivot.
function fixture() {
  const actor = new THREE.Group(); actor.position.set(12, 7, -9); actor.rotation.y = 0.7; actor.scale.set(1.3, 1.1, 0.9);
  const root = new THREE.Group(); root.position.set(0.2, 0.03, -0.15); actor.add(root);
  const material = new THREE.MeshStandardMaterial({ roughness: 0.72, metalness: 0.3 });
  const regions = [];
  for (const [side, x, dy] of [['Right', -0.3, 0], ['Left', 0.3, 0.02]]) {
    const upLeg = new THREE.Bone(); upLeg.name = side + 'UpLeg'; upLeg.position.set(x, 1, 0); root.add(upLeg);
    const foot = new THREE.Bone(); foot.name = side + 'Foot'; foot.position.y = -0.8; upLeg.add(foot);
    const geometry = new THREE.BufferGeometry();
    const yz = [[0, 0.3], [0.5, 0.3], [0.5, 0.5], [0, 0.5], [0.1, 0.4], [0.2, 0.35]];
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(yz.flatMap(([y, z], i) => [x + (i === 4 ? 0.08 : 0), y + dy - root.position.y, z]), 3));
    geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(yz.flatMap(() => [0, 1, 0, 0]), 4));
    geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(yz.flatMap(() => [0.3, 0.7, 0, 0]), 4));
    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(yz.flatMap(([y, z]) => [y, z]), 2));
    geometry.setIndex([0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4, 0, 4, 5]);
    const mesh = new THREE.SkinnedMesh(geometry, material); mesh.name = side + 'Leg'; root.add(mesh);
    actor.updateMatrixWorld(true); const skeleton = new THREE.Skeleton([upLeg, foot]); mesh.bind(skeleton, mesh.matrixWorld);
    regions.push({ mesh, upLeg, foot });
  }
  const refresh = () => { actor.updateMatrixWorld(true); for (const { mesh } of regions) mesh.skeleton.update(); };
  refresh();
  const point = (mesh, i) => mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(actor.matrixWorld.clone().invert());
  const config = { version: 1, calibrated: true, sourceSha256: SHA, motionGain: 0.2, maxOffset: 0.15,
    regions: regions.map(({ mesh, upLeg }) => ({ regionId: mesh.name, upLegBone: upLeg.name,
      vertexCount: mesh.geometry.attributes.position.count, triangleCount: mesh.geometry.index.count / 3,
      supportVertexIndices: [0, 1, 2, 3], restSupportYZ: [0, 1, 2, 3].map(i => { const p = point(mesh, i); return [p.y, p.z]; }) })) };
  const minimum = () => { refresh(); return Math.min(...regions.flatMap(({ mesh }) => Array.from({ length: mesh.geometry.attributes.position.count }, (_, i) => point(mesh, i).y))); };
  return { actor, root, regions, config, refresh, minimum };
}

test('convex support plants actual vertices in the actor frame across21poses and preserves physical/PBR/skin data', () => {
  const f = fixture(), initialY = f.root.position.y, actorTransform = f.actor.matrix.toArray();
  const buffers = f.regions.map(({ mesh }) => ({ attributes: Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key, attr]) => [key, [...attr.array]])),
    index: [...mesh.geometry.index.array], bind: mesh.bindMatrix.toArray(), inverses: mesh.skeleton.boneInverses.map(matrix => matrix.toArray()), material: mesh.material.toJSON() }));
  const solver = createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA });
  let disposedResource = false;
  for (const { mesh } of f.regions) {
    for (const resource of [mesh.geometry, mesh.material]) resource.addEventListener('dispose', () => { disposedResource = true; });
    mesh.skeleton.dispose = () => { disposedResource = true; };
  }
  const offsets = [];
  for (let phase = -10; phase <= 10; phase++) {
    f.regions.forEach(({ upLeg }) => { upLeg.rotation.x = phase / 100; });
    f.refresh(); assert.equal(solver.apply(), true, solver.diagnostics.lastError);
    close(f.minimum(), 0, 'closest actual sole must contact local actor ground');
    offsets.push(solver.offsetY); close(f.root.position.y, initialY + solver.offsetY);
    const previous = solver.offsetY; assert.equal(solver.apply(), true); close(solver.offsetY, previous, 'apply must not accumulate offsets');
  }
  assert.ok(Math.min(...offsets) < -0.01, 'floating is corrected downward');
  assert.ok(Math.max(...offsets) > 0.01, 'penetration is corrected upward');
  assert.deepEqual(f.actor.matrix.toArray(), actorTransform, 'physical actor transform remains unchanged');
  f.regions.forEach(({ mesh }, i) => {
    assert.deepEqual(Object.fromEntries(Object.entries(mesh.geometry.attributes).map(([key, attr]) => [key, [...attr.array]])), buffers[i].attributes);
    assert.deepEqual([...mesh.geometry.index.array], buffers[i].index);
    assert.deepEqual(mesh.bindMatrix.toArray(), buffers[i].bind);
    assert.deepEqual(mesh.skeleton.boneInverses.map(matrix => matrix.toArray()), buffers[i].inverses);
    assert.deepEqual(mesh.material.toJSON(), buffers[i].material);
  });
  const xz = [f.root.position.x, f.root.position.z], q = f.root.quaternion.toArray(), scale = f.root.scale.toArray();
  solver.reset(); close(f.root.position.y, initialY); close(solver.offsetY, 0);
  solver.dispose(); solver.dispose(); assert.equal(solver.apply(), false);
  assert.deepEqual([f.root.position.x, f.root.position.z], xz); assert.deepEqual(f.root.quaternion.toArray(), q); assert.deepEqual(f.root.scale.toArray(), scale);
  assert.equal(disposedResource, false, 'controller owns no GPU resources');
  f.regions.forEach(({ upLeg }) => { upLeg.rotation.x = 0; }); f.refresh();
  createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA }).dispose();
});

test('runtime refuses excessive offset, mixed-axis articulation, calf motion and external root ownership, then recovers', () => {
  const f = fixture(), solver = createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA }), initialY = f.root.position.y;
  assert.throws(() => createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA }), /already has/);
  f.regions.forEach(({ upLeg }) => { upLeg.position.y -= 0.3; }); f.refresh();
  assert.equal(solver.apply(), false); assert.match(solver.diagnostics.lastError, /bound/); close(f.root.position.y, initialY);
  f.regions.forEach(({ upLeg }) => { upLeg.position.y += 0.3; });
  f.regions[0].upLeg.rotation.z = 0.04; f.refresh(); assert.equal(solver.apply(), false); assert.match(solver.diagnostics.lastError, /depends on X/);
  f.regions[0].upLeg.rotation.z = 0; f.regions[0].foot.rotation.x = 0.02; f.refresh();
  assert.equal(solver.apply(), false); assert.match(solver.diagnostics.lastError, /relative pose/);
  f.regions[0].foot.rotation.x = 0; f.refresh(); assert.equal(solver.apply(), true);
  f.regions[0].mesh.morphTargetInfluences = [0.1]; assert.equal(solver.apply(), false); assert.match(solver.diagnostics.lastError, /morph/);
  f.regions[0].mesh.morphTargetInfluences = [];
  f.root.position.y += 0.02; assert.equal(solver.apply(), false); assert.match(solver.diagnostics.lastError, /outside grounding/); close(f.root.position.y, initialY);
  assert.equal(solver.apply(), true); assert.equal(solver.diagnostics.lastError, null); assert.equal(solver.diagnostics.refusals, 5); solver.dispose();
});

test('calibration rejects wrong asset, gain, geometry, hull and cross-leg weights before claiming the clone', () => {
  const bad = mutate => { const f = fixture(); mutate(f); assert.throws(() => createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA }), /ImportedFootGrounding/); };
  bad(f => { f.config.sourceSha256 = 'a'.repeat(64); });
  for (const gain of [0, -1, 1.01, NaN]) bad(f => { f.config.motionGain = gain; });
  bad(f => { f.config.maxOffset = 0.151; });
  bad(f => { f.root.position.y += 0.3; f.config.regions.forEach(region => region.restSupportYZ.forEach(yz => { yz[0] += 0.3; })); });
  bad(f => { f.config.regions[0].triangleCount++; });
  bad(f => { f.regions[0].mesh.morphTargetInfluences = [0.1]; });
  bad(f => { f.config.regions[0].restSupportYZ[0][0] += 0.01; });
  bad(f => { f.config.regions[0].supportVertexIndices.reverse(); f.config.regions[0].restSupportYZ.reverse(); });
  bad(f => { f.config.regions[0].supportVertexIndices = [0, 1, 4]; f.config.regions[0].restSupportYZ = [0, 1, 4].map(i => {
    const mesh = f.regions[0].mesh, p = mesh.getVertexPosition(i, new THREE.Vector3()).applyMatrix4(mesh.matrixWorld).applyMatrix4(f.actor.matrixWorld.clone().invert()); return [p.y, p.z]; }); });
  bad(f => { f.regions[0].mesh.skeleton.bones[1] = f.regions[1].foot; });
  bad(f => { f.regions[0].mesh.geometry.attributes.skinWeight.setX(0, 0.5); });
});

test('calibration before actor attachment remains valid after actor yaw and translation', () => {
  const f = fixture(); f.root.removeFromParent(); f.root.updateMatrixWorld(true);
  // Its actor-local rest coordinates remain identical when detached.
  const solver = createImportedFootGrounding(f.root, f.config, { sourceSha256: SHA });
  f.actor.add(f.root); f.actor.position.set(-30, 11, 4); f.actor.rotation.y = -1.5;
  f.regions[0].upLeg.rotation.x = -0.1; f.regions[1].upLeg.rotation.x = 0.1; f.refresh();
  assert.equal(solver.apply(), true, solver.diagnostics.lastError); close(f.minimum(), 0); solver.dispose();
});
