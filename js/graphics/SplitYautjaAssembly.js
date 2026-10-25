/* Optional runtime assembly of already separated GLB parts. No loading or activation. */
import * as THREE from 'three';

const fail = message => { throw new Error(`SplitYautjaAssembly: ${message}`); };
const finiteVector = (value, label, fallback) => {
  value ??= fallback;
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) fail(`invalid ${label}`);
  return new THREE.Vector3(...value);
};
const identifier = value => {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9_-]{0,79}$/i.test(value)) fail('component/socket ids must be short identifiers');
  return value;
};
const list = (value, label) => {
  if (!Array.isArray(value) || !value.length || value.some(name => typeof name !== 'string' || !name)) fail(`${label} needs explicit part names`);
  return value;
};

/**
 * createSplitYautjaAssembly(gltf, descriptor, options={})
 *
 * descriptor.version=1. anatomy.parts lists ALL anatomical fragments, including
 * both hands; anatomy.requiredParts declares body/leftHand/rightHand names.
 * equipment/hair are arrays of {id,label,parts,pivot?:[x,y,z],parent?:id}.
 * Every source Mesh must occur exactly once. Labels are explicit declarations,
 * never inferred from model_partN or a vertex color. No hidden flesh is added.
 *
 * Pivots and socket positions are in the loaded scene's assembled coordinates
 * under an identity actor parent, including the scene's own authored transform.
 * They are NOT centers automatically inferred from a bounding box. Parent ids
 * may name another component or anatomy/equipment/hair. Empty grouping nodes do
 * not create a skeleton. Whole source matrices and every triangle are retained.
 *
 * Optional equipment.mechanism:
 * {kind:'slider',axis:[x,y,z],travel,speed?,restState:'extended'|'retracted'} or
 * {kind:'hinge',axis:[x,y,z],angle,speed?,restState:'open'|'closed'}.
 * Axis/travel are PARENT-LOCAL, as required by YautjaArticulation. No rail/pivot
 * is guessed. articulationDescriptor can be passed to createYautjaArticulation
 * only when it contains a real configured mechanism (or later hair chains).
 *
 * Objects, geometry and materials are private; cached textures remain shared.
 * The unrigged source must not contain SkinnedMesh/Bone/InstancedMesh. Recompose
 * anatomy BEFORE a body rig. This is not a rigging, retexturing or mesh service.
 */
export function createSplitYautjaAssembly(gltf, descriptor, options = {}) {
  if (!gltf?.scene?.isObject3D || descriptor?.version !== 1) fail('a loaded scene and descriptor version1 are required');
  const maxVertices = options.maxVertices ?? 2_000_000;
  if (!Number.isInteger(maxVertices) || maxVertices < 1) fail('invalid vertex budget');
  const source = gltf.scene.clone(true), sourceMeshes = [], names = new Map();
  source.updateMatrixWorld(true);
  let totalVertices = 0, totalTriangles = 0;
  source.traverse(node => {
    if (node.isSkinnedMesh || node.isBone || node.isInstancedMesh) fail('only unrigged, non-instanced split parts are supported');
    if (!node.isMesh) return;
    if (!node.name || names.has(node.name)) fail(`part names must be unique: ${node.name}`);
    const position = node.geometry?.attributes.position, index = node.geometry?.index;
    if (!position || position.itemSize !== 3) fail(`${node.name}: missing 3D positions`);
    totalVertices += position.count;
    if (totalVertices > maxVertices) fail('vertex budget exceeded');
    for (let at = 0; at < position.count; at++) {
      if (![position.getX(at), position.getY(at), position.getZ(at)].every(Number.isFinite)) fail(`${node.name}: non-finite vertex`);
    }
    const count = index?.count ?? position.count;
    if (count % 3) fail(`${node.name}: triangle index count is not aligned`);
    if (index) for (let at = 0; at < index.count; at++) {
      const value = index.getX(at);
      if (!Number.isInteger(value) || value < 0 || value >= position.count) fail(`${node.name}: invalid triangle index`);
    }
    if (!node.matrixWorld.elements.every(Number.isFinite) || Math.abs(node.matrixWorld.determinant()) < 1e-12) fail(`${node.name}: invalid assembled transform`);
    if (sourceMeshes.length >= 512) fail('too many split meshes');
    totalTriangles += count / 3; sourceMeshes.push(node); names.set(node.name, node);
  });
  if (!sourceMeshes.length) fail('no renderable split parts');
  const anatomyParts = list(descriptor.anatomy?.parts, 'anatomy');
  const required = descriptor.anatomy.requiredParts;
  if (!required || ['body', 'leftHand', 'rightHand'].some(role => typeof required[role] !== 'string' || !anatomyParts.includes(required[role]))) fail('declare body and both hands inside anatomy.requiredParts');
  if (new Set([required.body, required.leftHand, required.rightHand]).size !== 3) fail('body and both hand declarations must identify distinct split parts');
  const equipmentValues = descriptor.equipment ?? [], hairValues = descriptor.hair ?? [];
  if (!Array.isArray(equipmentValues) || !Array.isArray(hairValues) || equipmentValues.length > 64 || hairValues.length > 64) fail('invalid component arrays');
  const ids = new Set(['anatomy', 'equipment', 'hair']), claimed = new Set();
  const claim = (partNames, owner) => {
    for (const name of list(partNames, owner)) {
      if (!names.has(name)) fail(`${owner}: missing source part ${name}`);
      if (claimed.has(name)) fail(`part assigned more than once: ${name}`);
      claimed.add(name);
    }
  };
  claim(anatomyParts, 'anatomy');
  const values = [...equipmentValues.map(value => ({ ...value, category: 'equipment' })), ...hairValues.map(value => ({ ...value, category: 'hair' }))];
  for (const value of values) {
    identifier(value.id);
    if (ids.has(value.id) || typeof value.label !== 'string' || !value.label.trim()) fail('components need unique ids and explicit labels');
    ids.add(value.id); claim(value.parts, value.id);
    value.pivot = finiteVector(value.pivot, `${value.id} pivot`, [0, 0, 0]);
    value.parent ??= value.category;
  }
  if (claimed.size !== sourceMeshes.length) fail(`unassigned source parts: ${sourceMeshes.filter(mesh => !claimed.has(mesh.name)).map(mesh => mesh.name).join(', ')}`);
  const definitions = new Map(values.map(value => [value.id, value]));
  const visited = new Set(), visiting = new Set();
  const visit = value => {
    if (visited.has(value.id)) return;
    if (visiting.has(value.id)) fail('component parent cycle');
    if (!ids.has(value.parent)) fail(`${value.id}: unknown parent ${value.parent}`);
    visiting.add(value.id);
    if (definitions.has(value.parent)) visit(definitions.get(value.parent));
    visiting.delete(value.id); visited.add(value.id);
  };
  values.forEach(visit);

  const root = new THREE.Group(); root.name = 'split-yautja-assembly';
  const anatomyRoot = new THREE.Group(); anatomyRoot.name = 'split-anatomy';
  const equipmentRoot = new THREE.Group(); equipmentRoot.name = 'split-equipment';
  const hairRoot = new THREE.Group(); hairRoot.name = 'split-hair'; root.add(anatomyRoot, equipmentRoot, hairRoot);
  if ([root, anatomyRoot, equipmentRoot, hairRoot].some(group => names.has(group.name))) fail('source name collides with an assembly root');
  const groups = new Map([['anatomy', anatomyRoot], ['equipment', equipmentRoot], ['hair', hairRoot]]);
  const equipment = new Map(), hair = new Map(), parts = new Map(), sockets = new Map();
  const geometryCopies = new Map(), materialCopies = new Map();
  const articulationDescriptor = { version: 1, dreadlocks: [], wristblades: [], gauntlets: [] };
  let disposed = false;
  const dispose = () => {
    if (disposed) return;
    disposed = true; root.removeFromParent();
    geometryCopies.forEach(geometry => geometry.dispose()); materialCopies.forEach(material => material.dispose());
  };
  try {
    for (const value of values) {
      const group = new THREE.Group(); group.name = `split-${value.category}-${value.id}`;
      if (names.has(group.name)) fail('source name collides with an assembly group');
      group.userData.splitComponent = { id: value.id, label: value.label, category: value.category };
      groups.set(value.id, group);
    }
    for (const value of values) {
      const group = groups.get(value.id), parent = groups.get(value.parent), parentPivot = definitions.get(value.parent)?.pivot ?? new THREE.Vector3();
      group.position.copy(value.pivot).sub(parentPivot); parent.add(group);
      (value.category === 'equipment' ? equipment : hair).set(value.id, { root: group, label: value.label, parts: [] });
    }
    root.updateMatrixWorld(true);
    const ownerByName = new Map(anatomyParts.map(name => [name, 'anatomy']));
    values.forEach(value => value.parts.forEach(name => ownerByName.set(name, value.id)));
    const inverse = new THREE.Matrix4();
    for (const mesh of sourceMeshes) {
      const originalMatrix = mesh.matrixWorld.clone(), parentId = ownerByName.get(mesh.name), parent = groups.get(parentId);
      if (!geometryCopies.has(mesh.geometry)) geometryCopies.set(mesh.geometry, mesh.geometry.clone());
      mesh.geometry = geometryCopies.get(mesh.geometry);
      const material = value => {
        if (!value?.isMaterial) fail(`${mesh.name}: missing material`);
        if (!materialCopies.has(value)) materialCopies.set(value, value.clone());
        return materialCopies.get(value);
      };
      mesh.material = Array.isArray(mesh.material) ? mesh.material.map(material) : material(mesh.material);
      mesh.removeFromParent(); parent.add(mesh);
      mesh.matrix.copy(inverse.copy(parent.matrixWorld).invert().multiply(originalMatrix));
      mesh.matrix.decompose(mesh.position, mesh.quaternion, mesh.scale);
      // Keep exact affine transforms, including shear in a nested source scene.
      mesh.matrixAutoUpdate = false; mesh.matrixWorldNeedsUpdate = true;
      parts.set(mesh.name, mesh);
      (equipment.get(parentId) ?? hair.get(parentId))?.parts.push(mesh);
    }
    const socketIds = new Set();
    if (!Array.isArray(descriptor.sockets ?? [])) fail('sockets must be an array');
    for (const value of descriptor.sockets ?? []) {
      identifier(value.id);
      if (socketIds.has(value.id)) fail('socket ids must be unique');
      socketIds.add(value.id);
      const parentId = value.parent ?? 'anatomy', parent = groups.get(parentId);
      if (!parent) fail(`socket ${value.id}: unknown parent`);
      const socket = new THREE.Group(); socket.name = `split-socket-${value.id}`;
      if (names.has(socket.name)) fail('source name collides with a socket');
      socket.position.copy(finiteVector(value.position, `${value.id} socket position`)).sub(definitions.get(parentId)?.pivot ?? new THREE.Vector3());
      socket.userData.splitSocket = { id: value.id, label: value.label ?? value.id, positionSource: 'explicit descriptor' };
      parent.add(socket); sockets.set(value.id, socket);
    }
    for (const value of values) {
      const mechanism = value.mechanism;
      if (!mechanism) continue;
      if (value.category !== 'equipment') fail('hair requires weighted chains, not a rigid mechanism');
      const axis = finiteVector(mechanism.axis, `${value.id} mechanism axis`);
      if (!Number.isFinite(axis.lengthSq()) || axis.lengthSq() < 1e-12) fail('mechanism axis must be finite and not zero');
      const common = { id: value.id, axis: axis.normalize().toArray(), restState: mechanism.restState };
      if (mechanism.speed !== undefined) {
        if (!Number.isFinite(mechanism.speed) || mechanism.speed < 0.001 || mechanism.speed > 1000) fail('invalid mechanism speed');
        common.speed = mechanism.speed;
      }
      if (mechanism.kind === 'slider') {
        if (!Number.isFinite(mechanism.travel) || mechanism.travel < 1e-7 || mechanism.travel > 1e5 || !['extended', 'retracted'].includes(mechanism.restState)) fail('a slider needs a measured travel and explicit restState');
        articulationDescriptor.wristblades.push({ ...common, nodes: [groups.get(value.id).name], travel: mechanism.travel });
      } else if (mechanism.kind === 'hinge') {
        if (!Number.isFinite(mechanism.angle) || Math.abs(mechanism.angle) > Math.PI * 2 || !['open', 'closed'].includes(mechanism.restState)) fail('a hinge needs an angle and explicit restState');
        articulationDescriptor.gauntlets.push({ ...common, node: groups.get(value.id).name, angle: mechanism.angle });
      } else fail('unknown mechanism kind');
    }
    const selected = partNames => list(partNames, 'measurement').map(name => {
      if (!parts.has(name)) fail(`measurement: missing part ${name}`);
      return parts.get(name);
    });
    const measure = (partNames, axis) => {
      if (disposed) fail('assembly is disposed');
      root.updateWorldMatrix(true, true);
      if (Math.abs(root.matrixWorld.determinant()) < 1e-12) fail('measurement requires an invertible actor transform');
      const toRoot = new THREE.Matrix4().copy(root.matrixWorld).invert(), transform = new THREE.Matrix4(), point = new THREE.Vector3(), bounds = new THREE.Box3();
      let minimum = Infinity, maximum = -Infinity;
      for (const mesh of selected(partNames)) {
        transform.multiplyMatrices(toRoot, mesh.matrixWorld);
        const position = mesh.geometry.attributes.position;
        for (let at = 0; at < position.count; at++) {
          point.fromBufferAttribute(position, at).applyMatrix4(transform); bounds.expandByPoint(point);
          if (axis) { const projected = point.dot(axis); minimum = Math.min(minimum, projected); maximum = Math.max(maximum, projected); }
        }
      }
      return axis ? { axis: axis.toArray(), minimum, maximum, length: maximum - minimum } : { min: bounds.min.toArray(), max: bounds.max.toArray(), center: bounds.getCenter(new THREE.Vector3()).toArray(), size: bounds.getSize(new THREE.Vector3()).toArray() };
    };
    const measurements = { coordinateSpace: 'assembled source coordinates; actor world transform excluded', parts: {}, anatomy: measure(anatomyParts), all: measure([...parts.keys()]) };
    for (const [name, mesh] of parts) measurements.parts[name] = { ...measure([name]), vertices: mesh.geometry.attributes.position.count, triangles: (mesh.geometry.index?.count ?? mesh.geometry.attributes.position.count) / 3, hasUVs: Boolean(mesh.geometry.attributes.uv), hasNormals: Boolean(mesh.geometry.attributes.normal) };
    const diagnostics = { sourceMeshCount: sourceMeshes.length, assembledMeshCount: parts.size, vertices: totalVertices, triangles: totalTriangles,
      declaredRequiredAnatomy: { ...required }, anatomicalParts: [...anatomyParts], componentLabelsAreDeclarations: true,
      generatedGeometry: false, originalTransformsPreserved: true, privateGeometryAndMaterials: true, texturesShared: true,
      hasBodySkeleton: false, hasHairChains: false, geometryNamesDoNotEstablishCanonicalLikeness: true,
      mechanismsConfigured: articulationDescriptor.wristblades.length + articulationDescriptor.gauntlets.length };
    // A hair builder may replace a private static part with a private skin. It
    // owns that replacement's new GPU resources and must dispose before assembly.
    const replacePart = (name, replacement) => {
      if (disposed) fail('assembly is disposed');
      const previous = parts.get(name);
      if (!previous || !replacement?.isMesh || replacement === previous || replacement.parent) fail('replacement must be a new unparented Mesh for an existing part');
      const before = previous.geometry, after = replacement.geometry, a = before.attributes.position, b = after?.attributes.position;
      if (b?.itemSize !== 3 || b.count !== a.count || (before.index?.count ?? null) !== (after.index?.count ?? null)) fail('replacement must preserve the part vertex grid and triangles');
      for (let at = 0; at < a.count; at++) if (a.getX(at) !== b.getX(at) || a.getY(at) !== b.getY(at) || a.getZ(at) !== b.getZ(at)) fail('replacement must preserve original rest positions');
      if (before.index) for (let at = 0; at < before.index.count; at++) if (before.index.getX(at) !== after.index.getX(at)) fail('replacement must preserve original triangle indices');
      if (before.drawRange.start !== after.drawRange.start || before.drawRange.count !== after.drawRange.count || before.groups.length !== after.groups.length || before.groups.some((group, at) => ['start', 'count', 'materialIndex'].some(key => group[key] !== after.groups[at][key]))) fail('replacement must preserve triangle groups and drawRange');
      replacement.name = name;
      replacement.position.copy(previous.position); replacement.quaternion.copy(previous.quaternion); replacement.scale.copy(previous.scale);
      replacement.matrix.copy(previous.matrix); replacement.matrixAutoUpdate = previous.matrixAutoUpdate; replacement.matrixWorldNeedsUpdate = true;
      replacement.visible = previous.visible; replacement.layers.mask = previous.layers.mask; replacement.renderOrder = previous.renderOrder;
      replacement.castShadow = previous.castShadow; replacement.receiveShadow = previous.receiveShadow;
      replacement.frustumCulled = replacement.isSkinnedMesh ? false : previous.frustumCulled;
      const parent = previous.parent; previous.removeFromParent(); parent.add(replacement); parts.set(name, replacement);
      for (const collection of [equipment, hair]) for (const component of collection.values()) {
        const at = component.parts.indexOf(previous); if (at >= 0) component.parts[at] = replacement;
      }
      return previous;
    };
    return { root, anatomyRoot, equipmentRoot, hairRoot, parts, equipment, hair, sockets, measurements, diagnostics, articulationDescriptor,
      measureBounds: partNames => measure(partNames), measureProjection: (partNames, value) => {
        const axis = finiteVector(value, 'projection axis'); if (!Number.isFinite(axis.lengthSq()) || axis.lengthSq() < 1e-12) fail('invalid or zero projection axis');
        return measure(partNames, axis.normalize());
      }, replacePart, dispose };
  } catch (error) { dispose(); throw error; }
}

/** Reviewed classification of this ONE pilot GLB. No rail/hinge calibration. */
export function jungleHunterSplitPilotDescriptor() {
  const parts = (...indices) => indices.map(index => `model_part${index}`);
  return { version: 1,
    anatomy: { parts: parts(7, 10, 14, 22), requiredParts: { body: 'model_part22', rightHand: 'model_part10', leftHand: 'model_part14' } },
    hair: [{ id: 'dreadlock-bouquets', label: 'Reviewed hair fragments and connected bouquets; no chains yet', parts: parts(2, 3, 5, 12, 15, 16, 20, 21) }],
    equipment: [
      { id: 'right-gauntlet', label: 'Right cuff and small unclassified wrist strip; not a verified second blade', parts: parts(1, 18) },
      { id: 'right-blade-assembly', label: 'One existing curved wrist-weapon assembly; not two canonical blades', parts: parts(13), parent: 'right-gauntlet' },
      { id: 'left-gauntlet-housing', label: 'Left forearm housing and rim fragments', parts: parts(4, 6, 8) },
      { id: 'left-console-plate-candidate', label: 'Closed upper plate candidate; hinge and interior unverified', parts: parts(9), parent: 'left-gauntlet-housing' },
      { id: 'left-armor-fragments', label: 'Shoulder and upper-arm armor fragments; mounts uncalibrated', parts: parts(0, 11, 17) },
      { id: 'shoulder-caster', label: 'Separate shoulder plasma caster; mount uncalibrated', parts: parts(19) }
    ], sockets: [] };
}
