/* A real City Hunter plate, carried rigidly by its actual forearm bone.
 * The original lid/UV/texture are retained. A measured, covered patch of the
 * private armour-shell clone is opened; no skin or cached geometry is cut.
 * The new interior and hinge are local modelling, not a recovered film prop. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { CITY_HUNTER_CONSOLE } from './CityHunterMechanismsCalibration.js';

const fail = message => { throw new Error(`CityHunterMechanisms: ${message}`); };
const clamp01 = value => THREE.MathUtils.clamp(value, 0, 1);
const smooth = value => value * value * (3 - 2 * value);
const MODES = Object.freeze({ scan: 0xff673b, emp: 0xff632f, heal: 0xffa44a, nuke: 0xff2b18 });

function glyphTexture() {
  const width = 256, height = 128, bytes = new Uint8Array(width * height * 4);
  for (let at = 0; at < bytes.length; at += 4) { bytes[at] = 7; bytes[at + 1] = 11; bytes[at + 2] = 11; bytes[at + 3] = 255; }
  const rect = (x, y, w, h, value = 235) => {
    for (let row = y; row < y + h; row++) for (let col = x; col < x + w; col++) {
      const at = (row * width + col) * 4; bytes[at] = value; bytes[at + 1] = value; bytes[at + 2] = value;
    }
  };
  // Discrete etched display segments; no external font, image or DOM canvas.
  for (let group = 0; group < 4; group++) {
    const x = 18 + group * 58;
    rect(x, 20, 25, 5); rect(x + 6, 34, 5, 46); rect(x, 86, 29, 5);
    rect(x + 21, 39, 5, group % 2 ? 34 : 20); rect(x + 16, 64, 20, 5);
    if (group % 2 === 0) rect(x + 34, 26, 5, 17);
    rect(x, 105, 37, 2, 80);
  }
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.name = 'city-console-local-segments'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearMipmapLinearFilter;
  texture.generateMipmaps = true; texture.needsUpdate = true;
  return texture;
}

export function installCityHunterMechanisms(adapter, { sourceSha256 } = {}) {
  const measured = CITY_HUNTER_CONSOLE;
  if (sourceSha256 !== measured.sourceSha256) fail('source SHA-256 does not match the measured corrected body');
  if (!adapter?.root?.isObject3D || !adapter.model?.isObject3D) fail('requires a private imported-character adapter');
  if (adapter.root.getObjectByName('city-left-console-hinge')) fail('console is already installed');
  const matches = [];
  adapter.model.traverse(node => { if (node.name === measured.sourceNode) matches.push(node); });
  if (matches.length !== 1 || !matches[0].isSkinnedMesh) fail('measured plate is missing or ambiguous');
  const source = matches[0], geometry = source.geometry;
  if (source.bindMode !== 'attached' || Array.isArray(source.material)) fail('unsupported plate binding or materials');
  const position = geometry.getAttribute('position'), indices = geometry.index;
  if (position?.count !== measured.vertices || indices?.count !== measured.triangles * 3) fail('measured plate topology changed');
  geometry.computeBoundingBox();
  for (const [edge, values] of Object.entries(measured.bounds)) for (let axis = 0; axis < 3; axis++) {
    if (Math.abs(geometry.boundingBox[edge].getComponent(axis) - values[axis]) > 2e-6) fail('measured plate bounds changed');
  }
  const joint = source.skeleton.bones.findIndex(bone => bone.name === measured.bone);
  if (joint < 0 || source.skeleton.bones.filter(bone => bone.name === measured.bone).length !== 1) fail('measured forearm bone is missing or ambiguous');
  const bone = source.skeleton.bones[joint], skinIndex = geometry.getAttribute('skinIndex'), skinWeight = geometry.getAttribute('skinWeight');
  if (!skinIndex || !skinWeight) fail('plate has no measured skin binding');
  let maximumWeightError = 0;
  for (let vertex = 0; vertex < position.count; vertex++) {
    let retained = 0, other = 0;
    for (let component = 0; component < 4; component++) {
      const weight = skinWeight.getComponent(vertex, component);
      if (!Number.isFinite(weight) || weight < 0) fail('invalid plate skin weight');
      if (skinIndex.getComponent(vertex, component) === joint) retained += weight;
      else other += weight;
    }
    maximumWeightError = Math.max(maximumWeightError, Math.abs(retained - 1), other);
  }
  if (maximumWeightError > 1e-7) fail('plate is not a rigid surface of the measured forearm bone');
  const housingMatches = [];
  adapter.model.traverse(node => { if (node.name === measured.housingPatch.node) housingMatches.push(node); });
  if (housingMatches.length !== 1 || !housingMatches[0].isSkinnedMesh) fail('measured armour housing is missing or ambiguous');
  const housing = housingMatches[0], originalHousingGeometry = housing.geometry;
  if (originalHousingGeometry.attributes.position.count !== measured.housingPatch.vertices || originalHousingGeometry.index?.count !== measured.housingPatch.triangles * 3) fail('measured armour housing topology changed');
  const housingJoint = housing.skeleton.bones.findIndex(value => value === bone);
  if (housingJoint < 0) fail('armour housing does not share the measured forearm');
  const removeFaces = new Set();
  for (const [start, count] of measured.housingPatch.faceRanges) for (let face = start; face < start + count; face++) {
    if (!Number.isInteger(face) || face < 0 || face >= measured.housingPatch.triangles || removeFaces.has(face)) fail('invalid measured armour patch');
    for (let corner = 0; corner < 3; corner++) {
      const vertex = originalHousingGeometry.index.getX(face * 3 + corner);
      let retained = 0, other = 0;
      for (let component = 0; component < 4; component++) {
        const weight = originalHousingGeometry.attributes.skinWeight.getComponent(vertex, component);
        if (!Number.isFinite(weight) || weight < 0) fail('invalid armour patch skin weight');
        if (originalHousingGeometry.attributes.skinIndex.getComponent(vertex, component) === housingJoint) retained += weight;
        else other += weight;
      }
      if (Math.abs(retained - 1) > 1e-7 || other > 1e-7) fail('armour patch contains nonrigid skin');
    }
    removeFaces.add(face);
  }
  if (removeFaces.size !== measured.housingPatch.removedTriangles) fail('measured armour patch count changed');
  adapter.root.updateMatrixWorld(true); source.skeleton.update();
  const toBone = source.skeleton.boneInverses[joint].clone().multiply(source.bindMatrix);
  if (!toBone.elements.every(Number.isFinite) || Math.abs(toBone.determinant()) < 1e-12) fail('invalid measured bind transform');
  const u = new THREE.Vector3(...measured.u), v = new THREE.Vector3(...measured.v), n = new THREE.Vector3(...measured.n);
  const center = new THREE.Vector3(...measured.center);
  const point = (x, y, z) => center.clone().addScaledVector(u, x).addScaledVector(v, y).addScaledVector(n, z);
  const hingeNative = point(measured.hinge.u, measured.hinge.v, measured.hinge.n);
  const pivot = hingeNative.clone().applyMatrix4(toBone), axis = u.clone().transformDirection(toBone);
  const hinge = new THREE.Group(); hinge.name = 'city-left-console-hinge'; hinge.position.copy(pivot);
  hinge.userData.cityHunterMechanism = { id: measured.id, interpretation: 'locally-modelled-hinge-for-original-plate' };
  const consoleRoot = new THREE.Group(); consoleRoot.name = 'city-left-console-board';
  consoleRoot.matrixAutoUpdate = false; consoleRoot.matrix.copy(toBone);
  const ownedGeometries = new Set(), materials = [], textures = [];
  const originalVisible = source.visible;
  hinge.visible = consoleRoot.visible = originalVisible;
  let replacement, restMaxVertexError = 0, disposed = false, amount = 0, target = 0, holdRemaining = 0, mode = 'scan', clock = 0;
  const ownGeometry = value => { ownedGeometries.add(value); return value; };
  const ownMaterial = value => { materials.push(value); return value; };
  const dispose = () => {
    if (disposed) return;
    disposed = true; hinge.removeFromParent(); consoleRoot.removeFromParent(); source.visible = originalVisible;
    housing.geometry = originalHousingGeometry;
    ownedGeometries.forEach(value => value.dispose()); materials.forEach(value => value.dispose()); textures.forEach(value => value.dispose());
  };
  try {
    const repairedHousing = ownGeometry(originalHousingGeometry.clone()), retainedIndices = [];
    for (let face = 0; face < measured.housingPatch.triangles; face++) if (!removeFaces.has(face)) {
      for (let corner = 0; corner < 3; corner++) retainedIndices.push(originalHousingGeometry.index.getX(face * 3 + corner));
    }
    repairedHousing.setIndex(new THREE.BufferAttribute(new Uint32Array(retainedIndices), 1));
    repairedHousing.clearGroups(); repairedHousing.computeBoundingSphere();
    const lidGeometry = ownGeometry(geometry.clone());
    lidGeometry.applyMatrix4(toBone); lidGeometry.translate(-pivot.x, -pivot.y, -pivot.z);
    lidGeometry.computeBoundingBox(); lidGeometry.computeBoundingSphere();
    replacement = new THREE.Mesh(lidGeometry, source.material);
    replacement.name = 'city-left-console-lid-surface'; replacement.castShadow = replacement.receiveShadow = true;
    replacement.userData.importedPartRegion = { ...source.userData.importedPartRegion, mechanismReplacement: true };
    hinge.add(replacement);
    // Native-coordinate board details fit inside the measured plate footprint.
    const shell = ownMaterial(new THREE.MeshStandardMaterial({ name: 'city-console-housing', color: 0x222c29, metalness: 0.72, roughness: 0.5 }));
    const trim = ownMaterial(new THREE.MeshStandardMaterial({ name: 'city-console-contacts', color: 0x9b855f, metalness: 0.86, roughness: 0.37 }));
    const texture = glyphTexture(); textures.push(texture);
    const screen = ownMaterial(new THREE.MeshStandardMaterial({ name: 'city-console-display', color: 0x4a2418, map: texture,
      emissive: MODES.scan, emissiveMap: texture, emissiveIntensity: 0.8, metalness: 0.12, roughness: 0.43 }));
    const indicator = ownMaterial(new THREE.MeshStandardMaterial({ name: 'city-console-indicators', color: 0x4a2418, emissive: MODES.scan, emissiveIntensity: 1, roughness: 0.4 }));
    const frame = new THREE.Matrix4().makeBasis(u, v, n);
    const add = (shape, material, x, y, z, name) => {
      const mesh = new THREE.Mesh(ownGeometry(shape), material); mesh.name = name;
      mesh.position.copy(point(x, y, z)); mesh.quaternion.setFromRotationMatrix(frame);
      mesh.castShadow = mesh.receiveShadow = true; consoleRoot.add(mesh); return mesh;
    };
    const config = measured.interior;
    add(new THREE.BoxGeometry(config.width, config.height, 0.008, 2, 2, 1), shell, config.u, config.v, config.n, 'city-console-recess');
    // Front is -n, away from the underlying forearm, behind the closed source lid.
    const display = new THREE.PlaneGeometry(0.132, 0.070, 1, 1); display.rotateY(Math.PI);
    add(display, screen, config.u - 0.008, config.v + 0.010, config.n - 0.0042, 'city-console-emissive-glyphs');
    for (const side of [-1, 1]) {
      add(new THREE.BoxGeometry(0.006, 0.095, 0.005), trim, config.u + side * 0.080, config.v, config.n - 0.002, `city-console-side-rail-${side}`);
      for (const row of [-1, 1]) {
        add(new THREE.CylinderGeometry(0.004, 0.004, 0.004, 12).rotateX(Math.PI / 2), trim,
          config.u + side * 0.078, config.v + row * 0.045, config.n - 0.005, `city-console-fastener-${side}-${row}`);
      }
    }
    for (let key = 0; key < 5; key++) {
      add(new THREE.BoxGeometry(0.018, 0.011, 0.006), trim, config.u - 0.052 + key * 0.026, config.v - 0.041, config.n - 0.005, `city-console-key-${key}`);
      add(new THREE.BoxGeometry(0.006, 0.0025, 0.0007), indicator, config.u - 0.052 + key * 0.026, config.v - 0.041, config.n - 0.0086, `city-console-key-inlay-${key}`);
    }
    for (let track = 0; track < 4; track++) add(new THREE.BoxGeometry(0.003, 0.039, 0.0008), trim,
      config.u + 0.058 + track * 0.0045, config.v + 0.011, config.n - 0.0044, `city-console-circuit-track-${track}`);
    // The small stationary details cost one draw per material, not one per key.
    for (const material of materials) {
      const entries = consoleRoot.children.filter(mesh => mesh.material === material);
      if (entries.length < 2) continue;
      const prepared = entries.map(mesh => { mesh.updateMatrix(); return mesh.geometry.clone().applyMatrix4(mesh.matrix); });
      const merged = mergeGeometries(prepared, false);
      prepared.forEach(value => value.dispose());
      if (!merged) fail('console details could not be batched');
      const mesh = new THREE.Mesh(ownGeometry(merged), material); mesh.name = `${material.name}-details`;
      mesh.castShadow = mesh.receiveShadow = true;
      for (const previous of entries) { consoleRoot.remove(previous); ownedGeometries.delete(previous.geometry); previous.geometry.dispose(); }
      consoleRoot.add(mesh);
    }
    bone.add(hinge, consoleRoot); adapter.root.updateMatrixWorld(true);
    const expected = new THREE.Vector3(), actual = new THREE.Vector3();
    for (let vertex = 0; vertex < position.count; vertex++) {
      source.getVertexPosition(vertex, expected).applyMatrix4(source.matrixWorld);
      actual.fromBufferAttribute(lidGeometry.getAttribute('position'), vertex).applyMatrix4(replacement.matrixWorld);
      restMaxVertexError = Math.max(restMaxVertexError, actual.distanceTo(expected));
    }
    if (restMaxVertexError > 2e-5) fail('rigid conversion would change the measured closed plate');
    housing.geometry = repairedHousing;
    source.visible = false;
    const renderState = () => {
      // At exact rest, render the original closed assembly itself. This avoids
      // exposing the new recess through tiny gaps in the generated lid edge.
      const actuated = amount > 0;
      source.visible = originalVisible && !actuated;
      hinge.visible = consoleRoot.visible = originalVisible && actuated;
      housing.geometry = actuated ? repairedHousing : originalHousingGeometry;
      hinge.quaternion.setFromAxisAngle(axis, smooth(amount) * measured.hinge.angle);
      const pulse = 0.7 + Math.sin(clock * (mode === 'nuke' ? 13 : 5)) * 0.18;
      screen.emissive.setHex(MODES[mode]); indicator.emissive.setHex(MODES[mode]);
      screen.emissiveIntensity = amount > 0 ? pulse : 0.06;
      indicator.emissiveIntensity = amount > 0 ? pulse * 1.2 : 0.06;
    };
    const move = delta => { amount += Math.sign(target - amount) * Math.min(Math.abs(target - amount), delta * 3); };
    const update = (delta = 0, state = {}) => {
      if (disposed || state.paused) return false;
      if (!Number.isFinite(delta) || delta < 0) fail('update requires finite nonnegative simulation time');
      clock += delta;
      let remainder = delta;
      if (holdRemaining > 0 && Number.isFinite(holdRemaining)) {
        const openingTime = Math.min(remainder, holdRemaining); move(openingTime);
        holdRemaining = Math.max(0, holdRemaining - openingTime); remainder -= openingTime;
        if (holdRemaining === 0) target = 0;
      }
      if (remainder > 0) move(remainder);
      renderState(); return true;
    };
    const setGauntletOpen = (id, value) => {
      if (disposed || id !== measured.id || !Number.isFinite(value)) return false;
      target = clamp01(value); holdRemaining = Infinity; return true;
    };
    const trigger = (requested = 'scan', holdSeconds = 2.5) => {
      if (disposed || !Object.hasOwn(MODES, requested) || !Number.isFinite(holdSeconds) || holdSeconds < 0 || holdSeconds > 60) return false;
      mode = requested; target = holdSeconds > 0 ? 1 : 0; holdRemaining = holdSeconds; return true;
    };
    const reset = () => { if (disposed) return false; amount = target = holdRemaining = clock = 0; mode = 'scan'; renderState(); return true; };
    const getState = () => ({ id: measured.id, amount, target, angle: smooth(amount) * measured.hinge.angle,
      mode, holdRemaining: Number.isFinite(holdRemaining) ? holdRemaining : null, disposed });
    renderState();
    let extraTriangles = 0, extraDrawMeshes = 0; consoleRoot.traverse(mesh => { if (mesh.isMesh) { extraDrawMeshes++; extraTriangles += (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3; } });
    return { id: measured.id, hinge, lid: replacement, consoleRoot, source, housing, materials, update, trigger, setGauntletOpen, getState, reset, dispose,
      diagnostics: { sourceSha256, sourceNode: source.name, sourceVertices: position.count, sourceTriangles: indices.count / 3,
        visibleReplacementTriangles: lidGeometry.index.count / 3, rigidBone: bone.name, maximumWeightError,
        closedMaxVertexError: restMaxVertexError, texture: 'original PBR material borrowed; source UVs copied unchanged',
        addedConsoleTriangles: extraTriangles, addedConsoleDrawMeshes: extraDrawMeshes, addedMaterials: materials.length,
        housingPatch: { node: housing.name, removedCoveredArmourTriangles: removeFaces.size, skinTrianglesRemoved: 0,
          retainedTriangles: retainedIndices.length / 3, cacheModified: false, sourceVerticesModified: 0 },
        hingeName: hinge.name, bladeExtractionActivated: false,
        interpretation: 'original plate retained; hinge and electronics modelled locally, not a certified film mechanism' } };
  } catch (error) { dispose(); throw error; }
}
