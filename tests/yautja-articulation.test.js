import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { createYautjaArticulation } from '../js/graphics/YautjaArticulation.js';

// Minimal weighted strands and mechanical pieces, strictly synthetic QA assets.
function fixture() {
  const root = new THREE.Group(); root.name = 'SYNTHETIC_YAUTJA_ARTICULATION_FIXTURE';
  const head = new THREE.Bone(); head.name = 'Head'; head.position.y = 1.5; root.add(head);
  const bones = [head], chains = [];
  for (const [label, x, lengths] of [['A', -0.2, [0.3, 0.35]], ['B', 0.2, [0.22, 0.27]]]) {
    let parent = head; const nodes = [];
    for (let i = 0; i < 3; i++) {
      const bone = new THREE.Bone(); bone.name = `Dread_${label}_${i}`;
      if (i === 0) bone.position.set(x, 0, 0); else bone.position.set(0, -lengths[i - 1], 0.04);
      parent.add(bone); parent = bone; nodes.push(bone); bones.push(bone);
    }
    chains.push(nodes);
  }
  root.updateMatrixWorld(true);
  const positions = [], indices = [], weights = [];
  for (const nodes of chains) for (let segment = 0; segment < 2; segment++) {
    const a = nodes[segment].getWorldPosition(new THREE.Vector3()), b = nodes[segment + 1].getWorldPosition(new THREE.Vector3());
    for (const point of [a.clone().add(new THREE.Vector3(-0.015, 0, 0)), a.clone().add(new THREE.Vector3(0.015, 0, 0)), a.clone().lerp(b, 0.8)]) {
      positions.push(...point.toArray()); indices.push(bones.indexOf(nodes[segment]), 0, 0, 0); weights.push(1, 0, 0, 0);
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(indices, 4));
  geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(weights, 4));
  geometry.computeVertexNormals();
  const material = new THREE.MeshStandardMaterial({ color: 0x33221a });
  const hair = new THREE.SkinnedMesh(geometry, material); hair.name = 'WeightedSyntheticHair'; root.add(hair);
  hair.bind(new THREE.Skeleton(bones));
  const wrist = new THREE.Group(); wrist.name = 'WristAttachment'; wrist.position.set(0.5, 0.7, 0); root.add(wrist);
  const blade = new THREE.Mesh(new THREE.BoxGeometry(0.025, 0.25, 0.025), material); blade.name = 'SeparateBlade'; blade.position.set(0.1, 0, 0.2); blade.rotation.y = 0.1; wrist.add(blade);
  const lid = new THREE.Group(); lid.name = 'MeasuredGauntletHinge'; lid.rotation.y = 0.2; wrist.add(lid);
  const plate = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.015, 0.18), material); plate.position.z = 0.09; lid.add(plate);
  root.updateMatrixWorld(true);
  return { root, head, hair, blade, lid, chains, geometry, material };
}
function descriptor() {
  return { version: 1,
    dreadlocks: [
      { id: 'strand-a', nodes: ['Dread_A_0', 'Dread_A_1', 'Dread_A_2'], stiffness: 25, damping: 5, maxAngle: 1.2 },
      { id: 'strand-b', nodes: ['Dread_B_0', 'Dread_B_1', 'Dread_B_2'], stiffness: 80, damping: 8, maxAngle: 1.2 }
    ],
    wristblades: [{ id: 'right-blades', nodes: ['SeparateBlade'], axis: [0, 0, 1], travel: 0.3, speed: 2, restState: 'extended' }],
    gauntlets: [{ id: 'computer-lid', node: 'MeasuredGauntletHinge', axis: [1, 0, 0], angle: 1.1, speed: 2, restState: 'closed' }] };
}
const world = node => node.getWorldPosition(new THREE.Vector3());
const nodes = (root, label) => [0, 1, 2].map(i => root.getObjectByName(`Dread_${label}_${i}`));
const closeVector = (a, b, reason) => assert.ok(a.distanceTo(b) < 1e-6, reason ?? `${a.toArray()} != ${b.toArray()}`);
const tick = (rig, count = 60, state) => { for (let i = 0; i < count; i++) rig.update(1 / 60, state); };
const pose = root => {
  const result = [];
  root.traverse(node => result.push([node.name, node.position.toArray(), node.quaternion.toArray(), node.visible]));
  return result;
};

test('each weighted strand responds to inertia while roots and segment lengths remain anchored', () => {
  const f = fixture(), originalHead = f.head.quaternion.clone(), rig = createYautjaArticulation(f.root, descriptor());
  const lengths = f.chains.map(chain => [world(chain[0]).distanceTo(world(chain[1])), world(chain[1]).distanceTo(world(chain[2]))]);
  const tipStart = world(f.chains[0][2]);
  f.head.position.x = 0.15; rig.update(1 / 60);
  const relativeLag = world(f.chains[0][2]).x - tipStart.x - 0.15;
  assert.ok(relativeLag < -0.02, 'strand tip must lag an accelerating anchor instead of moving rigidly with the head');
  for (let frame = 0; frame < 30; frame++) {
    f.head.position.x = 0.15 + Math.sin(frame * 0.12) * 0.1;
    rig.update(1 / 60, { wind: [0.7, 0, 0] });
    for (let c = 0; c < f.chains.length; c++) {
      const chain = f.chains[c], anchor = f.head.localToWorld(chain[0].position.clone());
      closeVector(world(chain[0]), anchor);
      for (let i = 0; i < 2; i++) assert.ok(Math.abs(world(chain[i]).distanceTo(world(chain[i + 1])) - lengths[c][i]) < 1e-6, 'strand segment length must not stretch');
    }
  }
  assert.ok(f.chains[0][0].quaternion.angleTo(f.chains[1][0].quaternion) > 0.005, 'different strands retain independent physical states');
  assert.ok(f.head.quaternion.angleTo(originalHead) < 1e-8, 'head bobbing is not strand animation');
  const rigidHeadVertex = new THREE.Vector3().fromBufferAttribute(f.geometry.attributes.position, 5).add(new THREE.Vector3(f.head.position.x, 0, 0));
  assert.ok(f.hair.getVertexPosition(5, new THREE.Vector3()).distanceTo(rigidHeadVertex) > 0.005, 'weighted surface must deform beyond rigid head translation');
  rig.dispose();
});

test('blades slide on their measured parent-local rail and lids rotate about their own hinge', () => {
  const f = fixture(), rig = createYautjaArticulation(f.root, descriptor());
  const originalBlade = f.blade.position.clone(), bladeRotation = f.blade.quaternion.clone(), lidPosition = f.lid.position.clone(), lidRotation = f.lid.quaternion.clone();
  rig.setBladeExtension('right-blades', 1); tick(rig, 2, { detailLevel: 2 });
  closeVector(f.blade.position, originalBlade, 'already extended authored blades must not extend twice');
  rig.setBladeExtension('right-blades', 0); rig.setGauntletOpen('computer-lid', 1); tick(rig, 30, { detailLevel: 2 });
  closeVector(f.blade.position, originalBlade.clone().add(new THREE.Vector3(0, 0, -0.3)));
  assert.ok(f.blade.quaternion.angleTo(bladeRotation) < 1e-8);
  const expectedLid = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), 1.1).multiply(lidRotation);
  assert.ok(f.lid.quaternion.angleTo(expectedLid) < 1e-6); closeVector(f.lid.position, lidPosition);
  rig.setGauntletOpen('computer-lid', 0); tick(rig, 30, { detailLevel: 2 });
  assert.ok(f.lid.quaternion.angleTo(lidRotation) < 1e-6);
  closeVector(f.blade.position, originalBlade.clone().add(new THREE.Vector3(0, 0, -0.3)), 'closing the lid must not move an independent blade motor');
  rig.dispose();
});

test('pause and delta0 freeze every mechanism, and long frame gaps have bounded catch-up', () => {
  const f = fixture(), rig = createYautjaArticulation(f.root, descriptor());
  rig.setBladeExtension('right-blades', 0); rig.setGauntletOpen('computer-lid', 1);
  const before = pose(f.root);
  for (let i = 0; i < 10; i++) assert.equal(rig.update(30, { paused: true }), false);
  assert.equal(rig.update(0), false); assert.deepEqual(pose(f.root), before);
  assert.throws(() => rig.update(-0.1), /delta/); assert.throws(() => rig.update(NaN), /delta/);
  rig.update(10);
  const amount = rig.getState().wristblades[0].amount;
  assert.ok(amount >= 0.8 - 1e-9 && amount < 1, 'a resumed long frame advances motors by at most.1 simulation seconds');
  rig.dispose();
});

test('changing the strand solver budget never changes independent mechanical actuator timing', () => {
  const first = fixture(), second = fixture();
  const a = createYautjaArticulation(first.root, descriptor(), { fixedStep: 1 / 120, maxSubsteps: 1 });
  const b = createYautjaArticulation(second.root, descriptor(), { fixedStep: 1 / 60, maxSubsteps: 8 });
  a.setBladeExtension('right-blades', 0); b.setBladeExtension('right-blades', 0);
  a.setGauntletOpen('computer-lid', 1); b.setGauntletOpen('computer-lid', 1);
  for (let i = 0; i < 10; i++) { a.update(0.05); b.update(0.05); }
  closeVector(first.blade.position, second.blade.position);
  assert.ok(first.lid.quaternion.angleTo(second.lid.quaternion) < 1e-6);
  assert.equal(a.getState().wristblades[0].amount, 0); assert.equal(b.getState().gauntlets[0].amount, 1);
  a.dispose(); b.dispose();
});

test('LOD/FPS transitions reset strand energy while wrist mechanisms continue without changing visibility/materials', () => {
  const f = fixture(), rig = createYautjaArticulation(f.root, descriptor());
  const original = f.chains.map(chain => chain.map(bone => bone.quaternion.clone()));
  f.head.position.x += 0.2; tick(rig, 5);
  assert.ok(f.chains.some((chain, c) => chain.some((bone, i) => bone.quaternion.angleTo(original[c][i]) > 0.01)), 'the LOD transition is tested after a strand has acquired real motion');
  rig.setBladeExtension('right-blades', 0); rig.update(1 / 60, { detailLevel: 2 });
  f.chains.forEach((chain, c) => chain.forEach((bone, i) => assert.ok(bone.quaternion.angleTo(original[c][i]) < 1e-6)));
  assert.ok(f.blade.position.z < 0.2, 'blade motor must remain live at far LOD');
  const opacity = f.material.opacity, visible = f.hair.visible;
  f.head.position.x += 1; tick(rig, 10, { headVisible: false });
  assert.equal(f.material.opacity, opacity); assert.equal(f.hair.visible, visible, 'ImportedCharacter owns triangle visibility, not this physics modifier');
  rig.update(1 / 60, { detailLevel: 0, headVisible: true });
  for (const chain of f.chains) assert.ok(world(chain[2]).distanceTo(world(chain[0])) < 0.7, 'hidden time must not build explosive velocity');
  rig.dispose();
});

test('two cooperative clones have separate physics and commands without changing cached poses or GPU ownership', () => {
  const source = fixture(), sourcePose = pose(source.root), first = cloneSkeleton(source.root), second = cloneSkeleton(source.root);
  const a = createYautjaArticulation(first, descriptor()), b = createYautjaArticulation(second, descriptor());
  first.getObjectByName('Head').position.x += 0.2; a.setBladeExtension('right-blades', 0); tick(a, 20);
  assert.ok(nodes(first, 'A')[0].quaternion.angleTo(nodes(second, 'A')[0].quaternion) > 0.01);
  assert.equal(second.getObjectByName('SeparateBlade').position.z, 0.2); assert.deepEqual(pose(source.root), sourcePose);
  let geometryDisposed = 0, materialDisposed = 0;
  source.root.traverse(node => { node.geometry?.addEventListener('dispose', () => geometryDisposed++); });
  source.material.addEventListener('dispose', () => materialDisposed++);
  a.dispose(); a.dispose(); assert.equal(a.update(1 / 60), false); assert.equal(a.setBladeExtension('right-blades', 1), false);
  assert.equal(geometryDisposed, 0); assert.equal(materialDisposed, 0); assert.deepEqual(pose(source.root), sourcePose);
  assert.equal(b.update(1 / 60), true); b.dispose();
  const again = createYautjaArticulation(first, descriptor()); again.dispose(); // Claims are released.
});

test('fixed-step gravity/wind agree across frame rates and reset/teleport/scale changes stay finite', () => {
  const first = fixture(), second = fixture();
  const a = createYautjaArticulation(first.root, descriptor()), b = createYautjaArticulation(second.root, descriptor());
  for (let i = 0; i < 60; i++) a.update(1 / 60, { wind: [0.7, 0, 0.1] });
  for (let i = 0; i < 30; i++) b.update(1 / 30, { wind: [0.7, 0, 0.1] });
  closeVector(world(first.chains[0][2]), world(second.chains[0][2]), 'stationary forced simulation must not depend on rendering frame rate');
  first.root.position.set(100, 20, -50); first.root.scale.setScalar(1.8); a.update(1 / 60);
  for (const chain of first.chains) assert.ok(world(chain[2]).distanceTo(world(chain[0])) < 1.3);
  a.reset();
  assert.equal(a.getState().wristblades[0].amount, 1); assert.equal(a.getState().gauntlets[0].amount, 0);
  first.root.scale.set(1, 2, 1); assert.throws(() => a.update(1 / 60), /uniform/);
  a.dispose(); b.dispose();
});

test('bindings reject shared chains, missing/ambiguous/cache nodes and fake unweighted/body articulation', () => {
  const f = fixture(), config = descriptor();
  config.dreadlocks[1].nodes = config.dreadlocks[0].nodes;
  assert.throws(() => createYautjaArticulation(f.root, config), /shared/);
  config.dreadlocks = [{ id: 'fake-head', nodes: [f.head, ...f.chains[0].slice(0, 2)] }];
  assert.throws(() => createYautjaArticulation(f.root, config), /body|helper/);
  const bodyMotor = descriptor(); bodyMotor.gauntlets[0].node = f.head;
  assert.throws(() => createYautjaArticulation(f.root, bodyMotor), /body animation/);
  const forbiddenMotor = descriptor(); forbiddenMotor.wristblades[0].nodes = ['SeparateBlade'];
  assert.throws(() => createYautjaArticulation(f.root, forbiddenMotor, { forbiddenNodes: [f.blade] }), /body animation/);
  const cloned = cloneSkeleton(f.root), foreign = descriptor(); foreign.dreadlocks[0].nodes = f.chains[0];
  assert.throws(() => createYautjaArticulation(cloned, foreign), /foreign/);
  const duplicate = new THREE.Group(); duplicate.name = 'SeparateBlade'; f.root.add(duplicate);
  assert.throws(() => createYautjaArticulation(f.root, descriptor()), /ambiguous/); f.root.remove(duplicate);
  // Skin attributes outside rendered indices are not proof of a weighted strand.
  f.geometry.setDrawRange(6, 6);
  assert.throws(() => createYautjaArticulation(f.root, descriptor()), /genuinely weighted/);
  f.geometry.setDrawRange(0, Infinity);
  const rig = createYautjaArticulation(f.root, descriptor());
  assert.throws(() => createYautjaArticulation(f.root, descriptor()), /shared/);
  rig.dispose();
});
