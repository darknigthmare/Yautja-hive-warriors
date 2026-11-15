import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createImportedCharacter } from '../js/graphics/ImportedCharacter.js';

// Meshy-style exact bone names, centimetre armature and genuinely weighted legs.
function fixture() {
  const scene = new THREE.Group(), armature = new THREE.Group(); armature.name = 'Armature'; armature.scale.setScalar(0.01); scene.add(armature);
  const hips = new THREE.Bone(); hips.name = 'Hips'; hips.position.y = 210; armature.add(hips);
  const bones = [hips], legs = {};
  for (const [side, x] of [['Left', 20], ['Right', -20]]) {
    const upper = new THREE.Bone(); upper.name = `${side}UpLeg`; upper.position.set(x, -15, 0); upper.rotation.x = side === 'Left' ? 0.15 : -0.2; hips.add(upper);
    const lower = new THREE.Bone(); lower.name = `${side}Leg`; lower.position.set(0, -70, 0); lower.rotation.x = side === 'Left' ? 0.45 : 0.7; upper.add(lower);
    const foot = new THREE.Bone(); foot.name = `${side}Foot`; foot.position.set(0, -65, 0); lower.add(foot);
    bones.push(upper, lower, foot); legs[side.toLowerCase()] = { upper, lower, foot };
  }
  scene.updateMatrixWorld(true);
  const positions = [], weights = [], indices = [];
  for (const { upper, lower, foot } of Object.values(legs)) for (const bone of [upper, lower, foot]) {
    const p = bone.getWorldPosition(new THREE.Vector3()).multiplyScalar(100);
    for (const offset of [[-3, 0, 0], [3, 0, 0], [0, 9, 1]]) {
      positions.push(p.x + offset[0], p.y + offset[1], p.z + offset[2]);
      weights.push(1, 0, 0, 0); indices.push(bones.indexOf(bone), 0, 0, 0);
    }
  }
  const geometry = new THREE.BufferGeometry(); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3)); geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4)); geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4)); geometry.computeVertexNormals();
  const mesh = new THREE.SkinnedMesh(geometry, new THREE.MeshStandardMaterial()); mesh.name = 'SyntheticLegSkin'; armature.add(mesh); scene.updateMatrixWorld(true); mesh.bind(new THREE.Skeleton(bones));
  return { gltf: { scene, animations: [] }, legs };
}

test('Meshy UpLeg aliases remain the animated thighs while static LowerLeg offsets target the calves', () => {
  const f = fixture(), original = f.gltf.scene.toJSON(), correction = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -0.4);
  const owner = { leftLeg: new THREE.Group(), rightLeg: new THREE.Group() };
  const adapter = createImportedCharacter(owner, f.gltf, { poseOffsets: { leftLowerLeg: correction.toArray() } });
  assert.equal(adapter.bones.leftLeg.name, 'LeftUpLeg'); assert.equal(adapter.bones.rightLeg.name, 'RightUpLeg');
  assert.equal(adapter.bones.leftLowerLeg.name, 'LeftLeg'); assert.equal(adapter.bones.rightLowerLeg.name, 'RightLeg');
  const expected = f.legs.left.lower.quaternion.clone().multiply(correction), thighRest = f.legs.left.upper.quaternion.clone();
  assert.ok(adapter.bones.leftLowerLeg.quaternion.angleTo(expected) < 1e-7);
  for (let frame = 0; frame < 20; frame++) {
    owner.leftLeg.rotation.x = Math.sin(frame * 0.2) * 0.3; adapter.update(1 / 60, true);
    assert.ok(adapter.bones.leftLowerLeg.quaternion.angleTo(expected) < 1e-7, 'static calf correction must not be reset or animated as a second thigh');
  }
  owner.leftLeg.rotation.x = 0; adapter.update(0, false);
  assert.ok(adapter.bones.leftLeg.quaternion.angleTo(thighRest) < 1e-7);
  assert.ok(adapter.bones.rightLowerLeg.quaternion.angleTo(f.legs.right.lower.quaternion) < 1e-7);
  adapter.dispose(); assert.deepEqual(f.gltf.scene.toJSON(), original);
});

test('static calf corrections remain finite under centimetre rigs, normalized character height and world scale', () => {
  const f = fixture(), options = { height: 4.31, poseOffsets: { leftLowerLeg: [-0.2, 0, 0], rightLowerLeg: [-0.5, 0, 0] } };
  const a = createImportedCharacter({}, f.gltf, options), b = createImportedCharacter({}, f.gltf, options);
  const host = new THREE.Group(); host.position.set(5, 2, -4); host.rotation.set(0.2, 0.5, -0.1); host.scale.setScalar(1.8); host.add(a.root); host.updateMatrixWorld(true);
  a.update(0.016, false); b.update(0.016, false);
  for (const role of ['leftLowerLeg', 'rightLowerLeg', 'leftFoot', 'rightFoot']) {
    const expected = b.bones[role].getWorldPosition(new THREE.Vector3()).applyMatrix4(host.matrixWorld);
    assert.ok(a.bones[role].getWorldPosition(new THREE.Vector3()).distanceTo(expected) < 1e-6);
    assert.ok(a.bones[role].quaternion.toArray().every(Number.isFinite));
  }
  a.dispose(); b.dispose();
});
