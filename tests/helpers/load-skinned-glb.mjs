/** CPU-only source-art fixture loader: no network, image decoder or GPU.
 * It preserves accessors, transforms, inverse binds and real linear bone clips. */
import { readFile } from 'node:fs/promises';
import * as THREE from 'three';
export async function loadSkinnedGlb(path) {
  const file = await readFile(path), length = file.readUInt32LE(12);
  const data = JSON.parse(file.toString('utf8', 20, 20 + length));
  const binary = file.subarray(28 + length, 28 + length + file.readUInt32LE(20 + length));
  const types = { 5120: Int8Array, 5121: Uint8Array, 5122: Int16Array, 5123: Uint16Array, 5125: Uint32Array, 5126: Float32Array };
  const widths = { SCALAR: 1, VEC2: 2, VEC3: 3, VEC4: 4, MAT4: 16 };
  const attribute = id => {
    const a = data.accessors[id], view = data.bufferViews[a.bufferView], Type = types[a.componentType], size = widths[a.type];
    if (a.sparse || !Type || !size) throw new Error('Unsupported CPU GLB accessor');
    const offset = binary.byteOffset + (view.byteOffset ?? 0) + (a.byteOffset ?? 0), stride = view.byteStride ?? Type.BYTES_PER_ELEMENT * size;
    let array;
    if (stride === Type.BYTES_PER_ELEMENT * size && offset % Type.BYTES_PER_ELEMENT === 0) array = new Type(binary.buffer, offset, a.count * size).slice();
    else {
      array = new Type(a.count * size);
      for (let i = 0; i < a.count; i++) for (let c = 0; c < size; c++) array[i * size + c] = new Type(binary.buffer.slice(offset + i * stride + c * Type.BYTES_PER_ELEMENT, offset + i * stride + (c + 1) * Type.BYTES_PER_ELEMENT))[0];
    }
    return new THREE.BufferAttribute(array, size, a.normalized ?? false);
  };
  const joints = new Set((data.skins ?? []).flatMap(skin => skin.joints));
  const names = { POSITION: 'position', NORMAL: 'normal', TEXCOORD_0: 'uv', TANGENT: 'tangent', JOINTS_0: 'skinIndex', WEIGHTS_0: 'skinWeight' };
  const materials = (data.materials ?? []).map((material, i) => new THREE.MeshStandardMaterial({ name: material.name ?? `fixture-material-${i}` }));
  const nodes = (data.nodes ?? []).map((node, i) => {
    let result;
    if (node.mesh !== undefined) {
      const p = data.meshes[node.mesh].primitives[0], geometry = new THREE.BufferGeometry();
      for (const [key, id] of Object.entries(p.attributes)) geometry.setAttribute(names[key] ?? key, attribute(id));
      if (p.indices !== undefined) geometry.setIndex(attribute(p.indices));
      result = node.skin === undefined ? new THREE.Mesh(geometry, materials[p.material]) : new THREE.SkinnedMesh(geometry, materials[p.material]);
    } else result = joints.has(i) ? new THREE.Bone() : new THREE.Group();
    result.name = node.name ?? `node_${i}`;
    if (node.matrix) { result.matrix.fromArray(node.matrix); result.matrix.decompose(result.position, result.quaternion, result.scale); result.matrixAutoUpdate = false; }
    else { if (node.translation) result.position.fromArray(node.translation); if (node.rotation) result.quaternion.fromArray(node.rotation); if (node.scale) result.scale.fromArray(node.scale); }
    return result;
  });
  nodes.forEach((node, i) => (data.nodes[i].children ?? []).forEach(child => node.add(nodes[child])));
  const scene = new THREE.Group(); (data.scenes[data.scene ?? 0].nodes ?? []).forEach(id => scene.add(nodes[id])); scene.updateMatrixWorld(true);
  nodes.forEach((node, i) => {
    const id = data.nodes[i].skin; if (id === undefined) return;
    const source = data.skins[id], matrices = attribute(source.inverseBindMatrices), inverses = [];
    for (let j = 0; j < matrices.count; j++) inverses.push(new THREE.Matrix4().fromArray(matrices.array, j * 16));
    node.bind(new THREE.Skeleton(source.joints.map(index => nodes[index]), inverses), new THREE.Matrix4()); node.normalizeSkinWeights();
  });
  scene.updateMatrixWorld(true); scene.traverse(node => { if (node.isSkinnedMesh) node.skeleton.update(); });
  const animations = (data.animations ?? []).map((animation, id) => {
    const tracks = animation.channels.map(channel => {
      const sampler = animation.samplers[channel.sampler], times = attribute(sampler.input).array, values = attribute(sampler.output).array;
      if (!['LINEAR', 'STEP', undefined].includes(sampler.interpolation)) throw new Error('CPU fixture needs real supported linear/step tracks');
      const property = { translation: 'position', rotation: 'quaternion', scale: 'scale' }[channel.target.path];
      const Track = property === 'quaternion' ? THREE.QuaternionKeyframeTrack : THREE.VectorKeyframeTrack;
      return new Track(`${nodes[channel.target.node].name}.${property}`, times, values, sampler.interpolation === 'STEP' ? THREE.InterpolateDiscrete : THREE.InterpolateLinear);
    });
    return new THREE.AnimationClip(animation.name ?? `clip_${id}`, -1, tracks);
  });
  return { scene, scenes: [scene], animations, data };
}
