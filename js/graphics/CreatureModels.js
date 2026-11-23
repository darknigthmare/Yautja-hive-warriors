/* Cached, continuously sculpted anatomy with independently animated actors. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { sculptCreature } from './CreatureSculpt.js';
import { getGeneratedAssetEntry, loadGeneratedAsset } from './GeneratedAssetLibrary.js';
import { requestImportedCreature } from './ImportedCreature.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

const profiles = new Map();
const PALE = new Set(['neomorph', 'offspring', 'facehugger', 'chestburster']);
const SINGLE_DETAIL = new Set(['egg', 'facehugger', 'chestburster']);
const actorPosition = new THREE.Vector3();
const cameraPositions = [new THREE.Vector3(), new THREE.Vector3()];
let cameraCount = 0;
function createProfile(kind) {
  const pale = PALE.has(kind), egg = kind === 'egg';
  const color = ({ drone: 0x242a2c, runner: 0x55443a, red_warrior: 0x5c3030, officer: 0x3c2e31, neomorph: 0xbeb4a6,
    facehugger: 0xac987d, chestburster: 0xb1967a, offspring: 0xc8c1b1, egg: 0x6b5d49,
    predalien: 0x494638, empress: 0x35313f,
    carrier: 0x353c2d, ravager: 0x222b28 })[kind] ?? 0x30363b;
  const materialType = egg ? 'leather' : pale ? 'skin' : 'chitin';
  const materials = {
    body: createSurfaceMaterial(materialType, { color, roughness: pale ? 0.65 : 0.52, metalness: pale ? 0.01 : 0.035, envMapIntensity: 0.62 }),
    skull: createSurfaceMaterial(pale ? 'skin' : 'chitin', { color, roughness: pale ? 0.58 : kind === 'drone' ? 0.21 : 0.3, metalness: pale ? 0 : 0.04, envMapIntensity: kind === 'drone' ? 0.9 : 0.7 }),
    ridges: createSurfaceMaterial(pale ? 'skin' : 'chitin', { color: pale ? 0xaaa090 : 0x303b3e, roughness: 0.54, metalness: 0.02, envMapIntensity: 0.5 }),
    tooth: createSurfaceMaterial('bone', { color: pale ? 0xbdb3a0 : 0x939989, roughness: 0.4, metalness: 0.08, envMapIntensity: 0.5 }),
    dark: createSurfaceMaterial(pale ? 'skin' : 'chitin', { color: 0x101316, roughness: 0.58, metalness: 0.01 }),
    flesh: createSurfaceMaterial('skin', { color: 0x8c7563, roughness: 0.58, metalness: 0 }),
    gland: createSurfaceMaterial('skin', { color: 0x606f3c, emissive: 0x29351b, emissiveIntensity: 0.28, roughness: 0.48, metalness: 0 })
  };
  const sculpt = sculptCreature(kind);
  const mid = SINGLE_DETAIL.has(kind) ? sculpt : sculptCreature(kind, 0.55);
  const far = SINGLE_DETAIL.has(kind) ? sculpt : sculptCreature(kind, 0.3);
  const resources = new Set();
  let triangles = 0, vertices = 0, standingMinY = 0, standingMaxY = 0;
  const lodTriangles = [0, 0, 0];
  for (let index = 0; index < sculpt.parts.length; index++) {
    const part = sculpt.parts[index];
    if (mid.parts[index]?.name !== part.name || far.parts[index]?.name !== part.name) throw new Error(`Creature LOD anatomy differs: ${kind}/${part.name}`);
    part.detailGeometries = [part.geometry, mid.parts[index].geometry, far.parts[index].geometry];
    part.material = materials[part.material];
    for (let level = 0; level < 3; level++) {
      const geometry = part.detailGeometries[level];
      resources.add(geometry);
      lodTriangles[level] += (geometry.index?.count ?? geometry.attributes.position.count) / 3;
    }
    resources.add(part.material);
    triangles += (part.geometry.index?.count ?? part.geometry.attributes.position.count) / 3;
    vertices += part.geometry.attributes.position.count;
    if (['carapace', 'cranium', 'leg-left', 'leg-right'].includes(part.name)) {
      standingMinY = Math.min(standingMinY, part.geometry.boundingBox.min.y + part.pivot[1]);
      standingMaxY = Math.max(standingMaxY, part.geometry.boundingBox.max.y + part.pivot[1]);
    }
  }
  const merged = mergeBodyParts(sculpt.parts, materials.body);
  merged?.geometries.forEach(geometry => resources.add(geometry));
  return { ...sculpt, resources, triangles, vertices, lodTriangles, standingHeight: standingMaxY - standingMinY, merged };
}

/* Draw-call pass (23 Nov 2026): a limbed creature's body-material parts (limbs, tail, carapace) are
 * one SkinnedMesh per actor. Each part is rigidly bound to one bone at its own pivot, so rotating a
 * bone moves exactly that part as rotating the old mesh did; three LOD geometries keep the swap. */
function mergeBodyParts(parts, bodyMaterial) {
  const body = parts.filter(part => part.material === bodyMaterial);
  if (!parts.some(part => part.name === 'leg-left') || body.length < 3) return null;
  const shared = Object.keys(body[0].geometry.attributes).filter(key => body.every(part => part.detailGeometries.every(geometry => geometry.attributes[key])));
  const indexed = body.every(part => part.detailGeometries.every(geometry => geometry.index));
  const geometries = [0, 1, 2].map(level => {
    const pieces = body.map((part, index) => {
      let geometry = part.detailGeometries[level].clone();
      if (!indexed && geometry.index) geometry = geometry.toNonIndexed();
      for (const key of Object.keys(geometry.attributes)) if (!shared.includes(key)) geometry.deleteAttribute(key);
      geometry.morphAttributes = {};
      geometry.translate(...part.pivot);
      const count = geometry.attributes.position.count, skinIndex = new Uint16Array(count * 4), skinWeight = new Float32Array(count * 4);
      for (let vertex = 0; vertex < count; vertex++) { skinIndex[vertex * 4] = index + 1; skinWeight[vertex * 4] = 1; }
      geometry.setAttribute('skinIndex', new THREE.Uint16BufferAttribute(skinIndex, 4));
      geometry.setAttribute('skinWeight', new THREE.Float32BufferAttribute(skinWeight, 4));
      return geometry;
    });
    const geometry = mergeGeometries(pieces, false); pieces.forEach(piece => piece.dispose());
    if (!geometry) throw new Error('creature body merge failed');
    geometry.computeBoundingBox(); geometry.computeBoundingSphere();
    // Limbs swing a little around their pivots: keep culling conservative.
    geometry.boundingSphere.radius *= 1.25; // the box stays exact for measurements (footprint, silhouettes)
    return geometry;
  });
  return { names: body.map(part => part.name), pivots: body.map(part => [...part.pivot]), geometries, material: bodyMaterial };
}

export function createCreatureModel(kind = 'warrior', retained = null) {
  if (!profiles.has(kind)) profiles.set(kind, createProfile(kind));
  const profile = profiles.get(kind);
  const group = new THREE.Group(); group.name = `creature-${kind}`;
  group.scale.setScalar(profile.scale);
  group.userData.visualProfile = { kind, triangles: profile.triangles, vertices: profile.vertices,
    drawCalls: profile.parts.length, midTriangles: profile.lodTriangles[1], farTriangles: profile.lodTriangles[2],
    standingHeight: profile.standingHeight, ...profile.features };
  group.userData.detailLevel = 0;
  group.userData.visualSource = 'procedural';
  group._creatureRig = {}; group._creatureMeshes = [];
  const merged = profile.merged;
  for (const part of profile.parts) {
    if (merged?.names.includes(part.name)) continue;
    const mesh = new THREE.Mesh(part.geometry, part.material);
    mesh.userData.detailGeometries = part.detailGeometries;
    mesh.name = part.name; mesh.position.set(...part.pivot);
    mesh.castShadow = true; mesh.receiveShadow = true;
    group.add(mesh); group._creatureRig[part.name] = mesh; group._creatureMeshes.push(mesh);
  }
  if (merged) {
    const root = new THREE.Bone(); root.name = 'creature-root'; const bones = [root];
    merged.names.forEach((name, index) => {
      const bone = new THREE.Bone(); bone.name = name; bone.position.set(...merged.pivots[index]);
      root.add(bone); bones.push(bone); group._creatureRig[name] = bone;
    });
    const mesh = new THREE.SkinnedMesh(merged.geometries[0], merged.material);
    mesh.name = 'creature-body'; mesh.userData.detailGeometries = merged.geometries; mesh.userData.ownsSkeleton = true;
    mesh.castShadow = true; mesh.receiveShadow = true;
    mesh.add(root); group.add(mesh); group.updateMatrixWorld(true);
    mesh.bind(new THREE.Skeleton(bones));
    mesh.boundingSphere = merged.geometries[0].boundingSphere.clone(); mesh.boundingBox = merged.geometries[0].boundingBox.clone();
    group._creatureMeshes.push(mesh);
  }
  profile.resources.forEach(resource => retained?.add(resource));
  // Asset-free and server/test usage stay entirely procedural. A manager-owned
  // retention set is required so clearing one wave cannot dispose cache buffers.
  if (kind === 'warrior' && typeof window !== 'undefined' && retained?.add) {
    const key = 'xenomorph_warrior', entry = getGeneratedAssetEntry(key);
    if (entry) requestImportedCreature(group, { key, entry, retained, loadTemplate: () => loadGeneratedAsset(key) });
  }
  return group;
}

function chooseCreatureDetail(object) {
  if (!object._creatureRig || !object.visible) return;
  object.getWorldPosition(actorPosition);
  let nearest = Infinity;
  for (let i = 0; i < cameraCount; i++) nearest = Math.min(nearest, actorPosition.distanceToSquared(cameraPositions[i]));
  const level = nearest < 18 * 18 ? 0 : nearest < 38 * 38 ? 1 : 2;
  if (object.userData.detailLevel === level) return;
  for (let i = 0; i < object.children.length; i++) {
    const mesh = object.children[i], details = mesh.userData.detailGeometries;
    if (details) mesh.geometry = details[level];
  }
  object.userData.detailLevel = level;
  object._importedCreatureAdapter?.setDetailLevel(level);
}

// Called once before rendering/shadow passes. The callback and vector pool are
// reused: one world-position lookup per actor, one per camera, no steady-frame
// allocations and a single coherent level for all of an actor's moving parts.
export function updateCreatureDetail(scene, cameras) {
  cameraCount = 0;
  for (let i = 0; i < cameras.length; i++) {
    const camera = cameras[i];
    if (!camera?.getWorldPosition) continue;
    if (!cameraPositions[cameraCount]) cameraPositions[cameraCount] = new THREE.Vector3();
    camera.getWorldPosition(cameraPositions[cameraCount++]);
  }
  if (!cameraCount) return;
  scene.traverse(chooseCreatureDetail);
}

export function animateCreatureModel(group, phase, moving = true) {
  const rig = group?._creatureRig;
  if (!rig) return;
  const drone = group.userData.visualProfile?.kind === 'drone';
  const stride = moving ? Math.sin(phase) * (drone ? 0.18 : 0.24) : 0;
  if (rig['leg-left']) rig['leg-left'].rotation.x = stride;
  if (rig['leg-right']) rig['leg-right'].rotation.x = -stride * 0.92;
  if (rig['arm-left']) rig['arm-left'].rotation.x = -stride * 0.55 - (drone ? 0.19 : 0.07);
  if (rig['arm-right']) rig['arm-right'].rotation.x = stride * 0.68 + (drone ? 0.19 : 0.1);
  if (rig.cranium) rig.cranium.rotation.x = Math.sin(phase * (drone ? 0.22 : 0.35)) * (drone ? 0.013 : 0.008);
  if (rig.tail) rig.tail.rotation.y = Math.sin(phase * 0.38) * 0.11;
  if (rig['wing-left']) rig['wing-left'].rotation.y = Math.sin(phase * 0.55) * 0.12;
  if (rig['wing-right']) rig['wing-right'].rotation.y = -Math.sin(phase * 0.55) * 0.12;
  group._importedCreatureAdapter?.update(phase, moving);
}

export function createEggModel(retained = null) {
  const group = createCreatureModel('egg', retained);
  group.children.filter(part => part.name.startsWith('petal-')).forEach((petal, index) => {
    const angle = index * Math.PI / 2;
    petal.rotation.x = Math.sin(angle) * 0.14;
    petal.rotation.z = -Math.cos(angle) * 0.14;
  });
  return group;
}

/** The cached full-detail geometry of one anatomical part, whether it is a mesh or a bone of the merged body. */
export function creaturePartGeometry(object, name) {
  const node = object?.getObjectByName?.(name);
  if (node?.isMesh && !node.isSkinnedMesh) return node.geometry;
  const kind = object?.userData?.visualProfile?.kind;
  return profiles.get(kind)?.parts.find(part => part.name === name)?.geometry ?? null;
}

export function getCreatureProfileStats(kind) {
  return { ...createCreatureModel(kind).userData.visualProfile };
}
