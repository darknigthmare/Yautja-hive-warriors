import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createMarineModel, createSyntheticModel, createHonorGuardModel, createHoundModel,
  createAPCModel, createDropPodModel, createDropshipModel, createSkimmerModel, createSkullTrophy } from '../js/graphics/SupportModels.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { DropPodEntrance } from '../js/entities/DropPodEntrance.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { SentryGun } from '../js/entities/SentryGun.js';
import { FalconDrone } from '../js/entities/FalconDrone.js';
import { YautjaSkimmer } from '../js/entities/YautjaSkimmer.js';
import { YautjaAlliesManager } from '../js/entities/YautjaAllies.js';
import { HellHoundsManager } from '../js/entities/HellHounds.js';
import { YautjaCitadel } from '../js/entities/YautjaCitadel.js';
import { disposeObject } from '../js/engine/SceneResources.js';
import { loftGeometry, sweptLimb, sculptedFaceGeometry, tireGeometry } from '../js/graphics/SupportSculpt.js';

const audio = new Proxy({}, { get: () => () => {} });
const origin = () => new THREE.Vector3();
function stats(group) {
  let triangles = 0, meshes = 0;
  const materials = new Set();
  group.traverse(mesh => {
    if (!mesh.isMesh) return;
    meshes++;
    const position = mesh.geometry.attributes.position;
    assert.ok(position && mesh.geometry.attributes.normal && mesh.geometry.attributes.uv);
    assert.equal(position.array.every(Number.isFinite), true, 'all model coordinates must stay finite');
    triangles += (mesh.geometry.index?.count ?? position.count) / 3;
    materials.add(mesh.material);
  });
  return { triangles, meshes, materials };
}

for (const [name, build, min, max, maxMeshes] of [
  ['marine', () => createMarineModel(true), 30000, 46000, 12],
  ['flametrooper', () => createMarineModel(false), 30000, 46000, 12],
  ['synthetic', createSyntheticModel, 28000, 48000, 16],
  ['honor guard', createHonorGuardModel, 34000, 54000, 9],
  ['hound', () => createHoundModel(new THREE.MeshStandardMaterial(), new THREE.MeshStandardMaterial()), 22000, 38000, 5],
  ['APC', () => createAPCModel().group, 26000, 44000, 14],
  ['dropship', createDropshipModel, 20000, 38000, 10],
  ['pod', () => createDropPodModel().group, 28000, 44000, 11],
  ['skimmer', createSkimmerModel, 22000, 38000, 10]
]) {
  test(`${name}: detailed finite model stays inside its rendering budget`, () => {
    const group = build();
    const result = stats(group);
    assert.ok(result.triangles >= min && result.triangles <= max, `${result.triangles} triangles`);
    assert.ok(result.meshes <= maxMeshes, `${result.meshes} draw meshes`);
    assert.ok(new THREE.Box3().setFromObject(group).getSize(new THREE.Vector3()).length() > 1);
    disposeObject(group);
  });
}

test('support actors have textured surfaces and anatomically complete silhouettes', () => {
  for (const group of [createMarineModel(), createSyntheticModel(), createHonorGuardModel()]) {
    const { materials } = stats(group);
    assert.ok([...materials].some(material => material.map && material.normalMap && material.roughnessMap));
    const bounds = new THREE.Box3().setFromObject(group);
    assert.ok(bounds.min.y < 0.15, 'boots meet the ground');
    assert.ok(bounds.max.y > 3, 'head and helmet extend above the torso');
    disposeObject(group);
  }
});

test('synthetic bisection retains its named pivots and material ownership', () => {
  const scene = new THREE.Scene(), manager = new SyntheticsManager(scene, audio, null);
  manager.spawnSquad(origin(), 1);
  const synthetic = manager.androids[0];
  for (const name of ['head', 'visor', 'torso', 'legs', 'gun']) assert.ok(synthetic.mesh.getObjectByName(name));
  const legMaterials = new Set();
  synthetic.mesh.getObjectByName('legs').traverse(mesh => { if (mesh.isMesh) legMaterials.add(mesh.material); });
  manager.bisectSynthetic(synthetic);
  assert.equal(manager.severedProps.length, 1);
  synthetic.mesh.traverse(mesh => { if (mesh.isMesh) assert.equal(legMaterials.has(mesh.material), false); });
  manager.clearSquad();
  assert.equal(scene.children.length, 0);
});

test('vehicle turret and capsule hatch remain independently movable and cleanup owns every buffer', () => {
  const scene = new THREE.Scene(), apc = new APCVehicle(scene, audio, null), pod = new DropPodEntrance(scene, audio, null);
  apc.spawn(origin());
  assert.ok(apc.turretMesh.parent === apc.mesh);
  apc.turretMesh.rotation.y = 0.8;
  assert.equal(apc.mesh.rotation.y, 0);
  let apcDisposals = 0;
  apc.mesh.traverse(mesh => { if (mesh.isMesh) mesh.geometry.addEventListener('dispose', () => apcDisposals++); });
  apc.clear();
  assert.ok(apcDisposals >= 8);
  pod.triggerDrop(origin());
  const hatch = pod.doorMesh;
  assert.ok(hatch.parent === pod.podMesh);
  const hinges = [...hatch.children], closedOrigins = hinges.map(hinge => hinge.position.clone());
  pod.update(2.2);
  assert.ok(hatch.userData.opening > 0 && hatch.userData.opening < 1, 'the landed hatch opens progressively');
  assert.ok(hinges.every((hinge, i) => hinge.position.equals(closedOrigins[i])), 'hinges do not teleport away');
  assert.ok(hinges[0].rotation.y < 0 && hinges[1].rotation.y > 0, 'the two leaves open independently');
  pod.update(pod.duration - 2.2);
  assert.equal(hatch.userData.opening, 1);
  pod.update(21.1);
  assert.equal(pod.podMesh, null);
  assert.equal(scene.children.length, 0);
});

test('detailed support squads and persistent equipment still follow gameplay lifecycle APIs', () => {
  const scene = new THREE.Scene();
  const marines = new ColonialMarinesManager(scene, audio), allies = new YautjaAlliesManager(scene, audio), hounds = new HellHoundsManager(scene, audio);
  marines.spawnSquad(origin(), 4); allies.spawnSquad(origin(), 3); hounds.summonPack(origin());
  assert.equal(marines.marines.length, 4); assert.equal(allies.allies.length, 3); assert.equal(hounds.hounds.length, 2);
  marines.clearSquad(); allies.clearSquad(); hounds.dismissPack();
  assert.equal(scene.children.length, 0);
  const sentry = new SentryGun(scene, audio), drone = new FalconDrone(scene, audio), skimmer = new YautjaSkimmer(scene, audio);
  const deployed = sentry.deploySentry(origin());
  assert.ok(deployed.swivel.getObjectByName('sentry-mechanical-details'));
  assert.ok(drone.leftWing.getObjectByName('articulated-wing-panels'));
  assert.ok(drone.rightWing.getObjectByName('articulated-wing-panels'));
  assert.ok(stats(skimmer.mesh).triangles > 1400);
  sentry.clear(); drone.clear(); skimmer.clear();
});

test('dropship keeps strike cancellation while replacing the box hull', () => {
  const scene = new THREE.Scene(), ship = new CheyenneDropship(scene, audio, null);
  ship.triggerAirstrike(origin(), { checkMeleeHits() {} });
  assert.ok(stats(ship.shipMesh).triangles > 3000);
  assert.equal(ship.pendingStrikes.length, 5);
  ship.clear();
  assert.equal(ship.pendingStrikes.length, 0);
  assert.equal(scene.children.length, 0);
});

test('citadel trophies are recognizable separate skull families with bounded buffers', () => {
  for (const kind of ['human', 'engineer', 'trex', 'queen']) {
    const skull = createSkullTrophy(kind, new THREE.MeshStandardMaterial());
    const result = stats(skull);
    assert.ok(result.triangles > 12000 && result.triangles < 30000);
    assert.ok(result.meshes <= 2);
    disposeObject(skull);
  }
  const scene = new THREE.Scene(), citadel = new YautjaCitadel(scene);
  citadel.buildCitadelRoom(12);
  assert.ok(stats(citadel.citadelGroup).triangles < 500000);
  citadel.buildCitadelRoom(4);
  assert.equal(scene.children.length, 1);
});


test('sculpted faces and bodies keep adult proportions and actual facial volume', () => {
  const face = sculptedFaceGeometry(); face.computeBoundingBox();
  const faceHeight = face.boundingBox.max.y - face.boundingBox.min.y;
  assert.ok(face.boundingBox.max.z > 0.16, 'nose and facial planes have modeled depth');
  for (const model of [createMarineModel(), createSyntheticModel()]) {
    const bounds = new THREE.Box3().setFromObject(model);
    const headsTall = (bounds.max.y - bounds.min.y) / faceHeight;
    assert.ok(headsTall >= 7.2 && headsTall <= 8.2, `${headsTall} head heights`);
    disposeObject(model);
  }
  face.dispose();
});

test('fitted marine armor covers the chest continuously without cloth clipping through', () => {
  const model = createMarineModel(); model.updateMatrixWorld(true);
  const raycaster = new THREE.Raycaster();
  for (const x of [-0.1, 0, 0.1]) for (const y of [2.02, 2.3, 2.48, 2.64]) {
    raycaster.set(new THREE.Vector3(x, y, 2), new THREE.Vector3(0, 0, -1));
    const hits = raycaster.intersectObject(model, true).filter(hit => hit.point.z < 0.4);
    assert.ok(hits.length, `missing chest at ${x},${y}`);
    assert.equal(hits[0].object.material.name, 'armor', `cloth protrudes at ${x},${y}`);
  }
  disposeObject(model);
});

test('lofted anatomy and hull surfaces retain finite normals, UVs and outward winding', () => {
  for (const axis of ['y', 'z']) {
    const geometry = loftGeometry([[0, 0.3, 0.2], [0.5, 0.5, 0.4], [1, 0.25, 0.15]], { axis, radial: 32, rows: 20 });
    const normal = geometry.attributes.normal;
    const row = 10, index = row * 33;
    assert.ok(normal.getX(index) > 0.7, `${axis} side faces outward`);
    assert.ok(geometry.attributes.uv.array.every(Number.isFinite));
    assert.ok(normal.array.every(Number.isFinite));
    geometry.dispose();
  }
  const limb = sweptLimb([[0, 0, 0, 0.1], [0.1, 0.5, 0.1, 0.2], [0, 1, 0.2, 0.08]]);
  assert.ok(limb.attributes.position.count > 500);
  assert.ok(limb.attributes.normal.array.every(Number.isFinite)); limb.dispose();
  const tire = tireGeometry(1.03, 0.78); tire.computeBoundingBox();
  const size = tire.boundingBox.getSize(new THREE.Vector3());
  assert.ok(size.x > 0.7 && size.x < 0.85);
  assert.ok(size.y > 2 && size.z > 2);
  assert.ok(tire.attributes.position.count > 1000); tire.dispose();
});
