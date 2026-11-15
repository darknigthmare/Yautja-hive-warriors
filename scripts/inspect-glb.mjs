#!/usr/bin/env node
/* Inspect GLB metadata without a GPU, decoder, network access or dependencies. */
import { readFile, writeFile, stat, mkdir } from 'node:fs/promises';
import { basename, dirname, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';

const JSON_CHUNK = 0x4e4f534a;
const BIN_CHUNK = 0x004e4942;
const MAX_FILE_BYTES = 256 * 1024 * 1024;
const MAX_JSON_BYTES = 16 * 1024 * 1024;
const IMAGE_HEADER_BYTES = 256 * 1024;
const COMPRESSION_EXTENSIONS = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_meshopt_compression', 'KHR_texture_basisu'];
const MODES = ['points', 'lines', 'line-loop', 'line-strip', 'triangles', 'triangle-strip', 'triangle-fan'];

export class GLBInspectionError extends Error {
  constructor(code, message) { super(message); this.name = 'GLBInspectionError'; this.code = code; }
}
function fail(code, message) { throw new GLBInspectionError(code, message); }
const indexIn = (value, array) => Number.isInteger(value) && value >= 0 && value < array.length;
const finite = value => typeof value === 'number' && Number.isFinite(value);
function label(value, fallback) {
  if (typeof value !== 'string' || !value) return fallback;
  if (/^data:|[a-z][a-z0-9+.-]*:\/\//i.test(value)) return '[URI-like name omitted]';
  return value.replace(/[\u0000-\u001f\u007f]/g, '').slice(0, 160) || fallback;
}
function entries(value, name) {
  if (value === undefined) return [];
  if (!Array.isArray(value)) fail('GLB_STRUCTURE', `${name} must be an array.`);
  if (value.length > 100000) fail('GLB_LIMIT', `${name} exceeds the metadata inspection limit.`);
  return value;
}
function object(value) { return value && typeof value === 'object' && !Array.isArray(value) ? value : {}; }
function uriInfo(uri) {
  if (typeof uri !== 'string') return { kind: 'invalid', host: null };
  if (/^data:/i.test(uri)) return { kind: 'data', host: null };
  try {
    if (/^https?:\/\//i.test(uri) || uri.startsWith('//')) return { kind: 'remote', host: new URL(uri, 'https://invalid.local').hostname };
  } catch { return { kind: 'invalid', host: null }; }
  return { kind: /^[a-z][a-z0-9+.-]*:/i.test(uri) ? 'other-scheme' : 'relative', host: null };
}
function inlineImageHeader(uri, byteOffset = 0, byteLength = IMAGE_HEADER_BYTES) {
  const comma = uri.indexOf(',');
  if (comma < 0 || comma > 256 || !/;base64$/i.test(uri.slice(0, comma))) return null;
  // Decode only the bounded header prefix. Never serialize the URI or its data.
  const skip = byteOffset % 3, start = comma + 1 + Math.floor(byteOffset / 3) * 4;
  const length = Math.min(byteLength, IMAGE_HEADER_BYTES);
  return Buffer.from(uri.slice(start, start + Math.ceil((length + skip) / 3) * 4), 'base64').subarray(skip, skip + length);
}

function imageDimensions(data) {
  const unknown = { format: 'unknown', width: null, height: null };
  if (!data?.length) return unknown;
  if (data.length >= 24 && data.subarray(0, 8).equals(Buffer.from('89504e470d0a1a0a', 'hex')) && data.toString('ascii', 12, 16) === 'IHDR') {
    return { format: 'png', width: data.readUInt32BE(16) || null, height: data.readUInt32BE(20) || null };
  }
  if (data.length >= 28 && data.subarray(0, 12).equals(Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex'))) {
    return { format: 'ktx2', width: data.readUInt32LE(20) || null, height: data.readUInt32LE(24) || null };
  }
  if (data.length >= 12 && data.toString('ascii', 0, 4) === 'RIFF' && data.toString('ascii', 8, 12) === 'WEBP') {
    for (let offset = 12; offset + 8 <= data.length;) {
      const type = data.toString('ascii', offset, offset + 4), length = data.readUInt32LE(offset + 4), at = offset + 8;
      if (type === 'VP8X' && length >= 10 && at + 10 <= data.length) return { format: 'webp', width: 1 + data.readUIntLE(at + 4, 3), height: 1 + data.readUIntLE(at + 7, 3) };
      if (type === 'VP8L' && length >= 5 && at + 5 <= data.length && data[at] === 0x2f) {
        const bits = data.readUInt32LE(at + 1);
        return { format: 'webp', width: (bits & 0x3fff) + 1, height: ((bits >>> 14) & 0x3fff) + 1 };
      }
      if (type === 'VP8 ' && length >= 10 && at + 10 <= data.length && data.subarray(at + 3, at + 6).equals(Buffer.from([0x9d, 0x01, 0x2a]))) {
        return { format: 'webp', width: (data.readUInt16LE(at + 6) & 0x3fff) || null, height: (data.readUInt16LE(at + 8) & 0x3fff) || null };
      }
      offset = at + length + (length % 2);
    }
    return { ...unknown, format: 'webp' };
  }
  if (data.length >= 2 && data[0] === 0xff && data[1] === 0xd8) {
    const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    for (let offset = 2; offset < data.length;) {
      if (data[offset++] !== 0xff) continue;
      while (offset < data.length && data[offset] === 0xff) offset++;
      if (offset >= data.length) break;
      const marker = data[offset++];
      if (marker === 0xda || marker === 0xd9) break;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd8)) continue;
      if (offset + 2 > data.length) break;
      const length = data.readUInt16BE(offset);
      if (length < 2) break;
      if (frameMarkers.has(marker) && length >= 8 && offset + 8 <= data.length) return { format: 'jpeg', width: data.readUInt16BE(offset + 5) || null, height: data.readUInt16BE(offset + 3) || null };
      offset += length;
    }
    return { ...unknown, format: 'jpeg' };
  }
  return unknown;
}

function parseContainer(input) {
  if (!Buffer.isBuffer(input) && !(input instanceof Uint8Array) && !(input instanceof ArrayBuffer)) fail('GLB_INPUT', 'Inspection expects GLB bytes.');
  const data = Buffer.isBuffer(input) ? input : Buffer.from(input);
  if (data.length > MAX_FILE_BYTES) fail('GLB_LIMIT', 'GLB exceeds the 256 MiB inspection limit.');
  if (data.length < 12) fail('GLB_HEADER', 'GLB header is truncated.');
  if (data.readUInt32LE(0) !== 0x46546c67) fail('GLB_MAGIC', 'Input is not a GLB file.');
  if (data.readUInt32LE(4) !== 2) fail('GLB_VERSION', 'Only GLB version 2 is supported.');
  if (data.readUInt32LE(8) !== data.length) fail('GLB_LENGTH', 'Declared GLB length does not match the file length.');
  const chunks = [];
  let document, binary;
  for (let offset = 12; offset < data.length;) {
    if (offset + 8 > data.length) fail('GLB_CHUNK', 'Chunk header is truncated.');
    const length = data.readUInt32LE(offset), type = data.readUInt32LE(offset + 4), start = offset + 8;
    if (length % 4) fail('GLB_CHUNK', 'Chunk length must be aligned to four bytes.');
    if (start + length > data.length) fail('GLB_CHUNK', 'Chunk extends beyond the declared container.');
    if (!chunks.length && type !== JSON_CHUNK) fail('GLB_JSON', 'The first GLB chunk must be JSON.');
    chunks.push({ type: type === JSON_CHUNK ? 'JSON' : type === BIN_CHUNK ? 'BIN' : `0x${type.toString(16).padStart(8, '0')}`, byteOffset: start, byteLength: length });
    if (type === JSON_CHUNK) {
      if (document !== undefined) fail('GLB_JSON', 'Multiple JSON chunks are invalid.');
      if (length > MAX_JSON_BYTES) fail('GLB_LIMIT', 'JSON metadata exceeds the 16 MiB inspection limit.');
      try { document = JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(data.subarray(start, start + length))); }
      catch { fail('GLB_JSON', 'JSON chunk is not valid UTF-8 JSON.'); }
    } else if (type === BIN_CHUNK) {
      if (binary !== undefined) fail('GLB_BIN', 'Multiple BIN chunks are invalid.');
      binary = data.subarray(start, start + length);
    }
    offset = start + length;
  }
  if (!document || typeof document !== 'object' || Array.isArray(document)) fail('GLB_JSON', 'GLB must contain a JSON object.');
  if (document.asset?.version !== '2.0') fail('GLB_ASSET', 'The JSON asset.version must be 2.0.');
  return { data, document, binary, chunks };
}

export function inspectGLB(input, { sourceName = 'buffer.glb' } = {}) {
  const { data, document: gltf, binary, chunks } = parseContainer(input);
  const warnings = [], seenWarnings = new Set();
  let warningsSuppressed = 0;
  function warn(message) {
    if (seenWarnings.has(message)) return;
    if (warnings.length < 200) { seenWarnings.add(message); warnings.push(message); } else warningsSuppressed++;
  }
  const accessors = entries(gltf.accessors, 'accessors'), meshes = entries(gltf.meshes, 'meshes');
  const nodes = entries(gltf.nodes, 'nodes'), skins = entries(gltf.skins, 'skins');
  const animations = entries(gltf.animations, 'animations'), materials = entries(gltf.materials, 'materials');
  const textures = entries(gltf.textures, 'textures'), images = entries(gltf.images, 'images');
  const buffers = entries(gltf.buffers, 'buffers'), views = entries(gltf.bufferViews, 'bufferViews');
  const scenes = entries(gltf.scenes, 'scenes');
  const extensionNames = new Set([...entries(gltf.extensionsUsed, 'extensionsUsed'), ...entries(gltf.extensionsRequired, 'extensionsRequired')].filter(x => typeof x === 'string' && /^[A-Za-z0-9_]{1,100}$/.test(x)));
  function extensions(value) { for (const key of Object.keys(object(value))) if (/^[A-Za-z0-9_]{1,100}$/.test(key)) extensionNames.add(key); }
  const externalURIs = [];
  function resource(uri, location) {
    const info = uriInfo(uri);
    if (info.kind !== 'data') externalURIs.push({ location, ...info });
    return info;
  }
  buffers.forEach((buffer, index) => { if (object(buffer).uri !== undefined) resource(buffer.uri, `buffers[${index}].uri`); });
  views.forEach(view => extensions(object(view).extensions));
  if (buffers[0] && !buffers[0].uri) {
    const size = buffers[0].byteLength;
    if (!Number.isSafeInteger(size) || size < 0) warn('buffers[0].byteLength is invalid.');
    else if (!binary && size) warn('The implicit binary buffer is missing.');
    else if (binary && (size > binary.length || binary.length - size > 3)) warn('BIN length does not match buffers[0].byteLength and allowed padding.');
  }
  function accessorCount(index, location) {
    const count = indexIn(index, accessors) ? accessors[index]?.count : null;
    if (!Number.isSafeInteger(count) || count < 0) { warn(`${location} has no valid accessor count.`); return null; }
    return count;
  }
  function sum(values) {
    if (values.some(value => value === null)) return null;
    const total = values.reduce((a, b) => a + b, 0);
    if (!Number.isSafeInteger(total)) fail('GLB_LIMIT', 'Triangle totals exceed safe numeric limits.');
    return total;
  }
  const meshReports = meshes.map((mesh, meshIndex) => {
    const primitives = entries(object(mesh).primitives, `meshes[${meshIndex}].primitives`).map((primitive, primitiveIndex) => {
      const p = object(primitive), location = `meshes[${meshIndex}].primitives[${primitiveIndex}]`;
      extensions(p.extensions);
      const vertexCount = accessorCount(p.attributes?.POSITION, `${location}.attributes.POSITION`);
      const indexCount = p.indices === undefined ? null : accessorCount(p.indices, `${location}.indices`);
      const count = p.indices === undefined ? vertexCount : indexCount, mode = p.mode ?? 4;
      let triangleCount = null;
      if (Number.isInteger(mode) && mode >= 0 && mode <= 6) {
        if (mode < 4) triangleCount = 0;
        else if (count !== null) triangleCount = mode === 4 ? Math.floor(count / 3) : Math.max(0, count - 2);
        if (mode === 4 && count !== null && count % 3) warn(`${location} has an incomplete triangle list.`);
      } else warn(`${location}.mode is unsupported.`);
      if (p.material !== undefined && !indexIn(p.material, materials)) warn(`${location}.material references a missing material.`);
      return { index: primitiveIndex, mode: MODES[mode] || 'unsupported', vertexCount, indexCount, triangleCount,
        material: indexIn(p.material, materials) ? p.material : null,
        hasNormals: p.attributes?.NORMAL !== undefined, hasUVs: p.attributes?.TEXCOORD_0 !== undefined,
        hasTangents: p.attributes?.TANGENT !== undefined, hasSkinWeights: p.attributes?.JOINTS_0 !== undefined && p.attributes?.WEIGHTS_0 !== undefined,
        morphTargetCount: entries(p.targets, `${location}.targets`).length };
    });
    return { index: meshIndex, name: label(mesh?.name, `mesh_${meshIndex}`), triangleCount: sum(primitives.map(p => p.triangleCount)), primitives };
  });
  const parents = nodes.map(() => []), children = nodes.map(() => []);
  nodes.forEach((node, index) => {
    const seenChildren = new Set();
    for (const child of entries(object(node).children, `nodes[${index}].children`)) {
      if (!indexIn(child, nodes)) { warn(`nodes[${index}].children references a missing node.`); continue; }
      if (seenChildren.has(child)) { warn(`nodes[${index}] repeats a child reference.`); continue; }
      seenChildren.add(child);
      children[index].push(child); parents[child].push(index);
    }
  });
  parents.forEach((list, index) => { if (list.length > 1) warn(`nodes[${index}] has multiple parents.`); });
  // Kahn's traversal validates the graph without recursion or unbounded cycles.
  const degree = parents.map(list => list.length), queue = degree.flatMap((value, i) => value === 0 ? [i] : []);
  for (let at = 0; at < queue.length; at++) for (const child of children[queue[at]]) if (--degree[child] === 0) queue.push(child);
  if (queue.length !== nodes.length) warn('The node hierarchy contains a cycle.');
  const jointNodes = new Set();
  const skinReports = skins.map((skin, skinIndex) => {
    const joints = entries(object(skin).joints, `skins[${skinIndex}].joints`).filter(index => {
      if (!indexIn(index, nodes)) { warn(`skins[${skinIndex}].joints references a missing node.`); return false; }
      jointNodes.add(index); return true;
    });
    const jointSet = new Set(joints);
    return { index: skinIndex, name: label(skin?.name, `skin_${skinIndex}`), skeletonRoot: indexIn(skin?.skeleton, nodes) ? skin.skeleton : null,
      inverseBindMatricesAccessor: indexIn(skin?.inverseBindMatrices, accessors) ? skin.inverseBindMatrices : null,
      joints: joints.map(index => {
        let ancestor = parents[index][0], parentJoint = null;
        const visited = new Set([index]);
        while (ancestor !== undefined && !visited.has(ancestor)) {
          if (jointSet.has(ancestor)) { parentJoint = ancestor; break; }
          visited.add(ancestor); ancestor = parents[ancestor][0];
        }
        return { node: index, name: label(nodes[index]?.name, `node_${index}`), parent: parents[index][0] ?? null, parentJoint };
      }) };
  });
  const nodeReports = nodes.map((node, index) => {
    if (node?.mesh !== undefined && !indexIn(node.mesh, meshes)) warn(`nodes[${index}].mesh references a missing mesh.`);
    if (node?.skin !== undefined && !indexIn(node.skin, skins)) warn(`nodes[${index}].skin references a missing skin.`);
    return { index, name: label(node?.name, `node_${index}`), parent: parents[index][0] ?? null, parents: parents[index], children: children[index],
      mesh: indexIn(node?.mesh, meshes) ? node.mesh : null, skin: indexIn(node?.skin, skins) ? node.skin : null, isJoint: jointNodes.has(index) };
  });
  const sceneReports = scenes.map((scene, sceneIndex) => {
    const roots = entries(object(scene).nodes, `scenes[${sceneIndex}].nodes`).filter(index => {
      if (!indexIn(index, nodes)) { warn(`scenes[${sceneIndex}].nodes references a missing node.`); return false; } return true;
    });
    const reached = new Set(), pending = [...roots], triangleCounts = [];
    while (pending.length) {
      const index = pending.pop(); if (reached.has(index)) continue; reached.add(index);
      const mesh = nodeReports[index].mesh; if (mesh !== null) triangleCounts.push(meshReports[mesh].triangleCount);
      for (const child of children[index]) pending.push(child);
    }
    return { index: sceneIndex, name: label(scene?.name, `scene_${sceneIndex}`), roots, nodeCount: reached.size, triangleCount: sum(triangleCounts) };
  });
  const animationReports = animations.map((animation, animationIndex) => {
    const samplers = entries(object(animation).samplers, `animations[${animationIndex}].samplers`).map((sampler, index) => {
      sampler = object(sampler);
      const input = indexIn(sampler?.input, accessors) ? object(accessors[sampler.input]) : {};
      const start = finite(input.min?.[0]) ? input.min[0] : null, end = finite(input.max?.[0]) ? input.max[0] : null;
      if (start === null || end === null || end < start) warn(`animations[${animationIndex}].samplers[${index}] has no valid timing bounds.`);
      return { index, inputAccessor: indexIn(sampler?.input, accessors) ? sampler.input : null,
        outputAccessor: indexIn(sampler?.output, accessors) ? sampler.output : null,
        keyframeCount: accessorCount(sampler?.input, `animations[${animationIndex}].samplers[${index}].input`),
        interpolation: ['LINEAR', 'STEP', 'CUBICSPLINE'].includes(sampler?.interpolation ?? 'LINEAR') ? (sampler.interpolation ?? 'LINEAR') : 'unsupported',
        startSeconds: start, endSeconds: end, durationSeconds: start !== null && end !== null && end >= start ? end - start : null };
    });
    const complete = samplers.length > 0 && samplers.every(s => s.durationSeconds !== null);
    const start = complete ? samplers.reduce((min, s) => Math.min(min, s.startSeconds), Infinity) : null;
    const end = complete ? samplers.reduce((max, s) => Math.max(max, s.endSeconds), -Infinity) : null;
    const channels = entries(object(animation).channels, `animations[${animationIndex}].channels`).map((channel, index) => ({ index,
      sampler: indexIn(channel?.sampler, samplers) ? channel.sampler : null,
      targetNode: indexIn(channel?.target?.node, nodes) ? channel.target.node : null,
      targetName: indexIn(channel?.target?.node, nodes) ? nodeReports[channel.target.node].name : null,
      path: ['translation', 'rotation', 'scale', 'weights'].includes(channel?.target?.path) ? channel.target.path : 'unsupported' }));
    return { index: animationIndex, name: label(animation?.name, `animation_${animationIndex}`), durationSeconds: complete ? end - start : null,
      startSeconds: start, endSeconds: end, timingSource: 'accessor-min-max', samplers, channels };
  });
  const imageReports = images.map((image, imageIndex) => {
    const img = object(image), location = `images[${imageIndex}]`;
    let header = null, source, byteLength = null;
    if (img.uri !== undefined) {
      source = resource(img.uri, `${location}.uri`);
      if (source.kind === 'data') header = inlineImageHeader(img.uri);
    } else if (indexIn(img.bufferView, views)) {
      const view = object(views[img.bufferView]), offset = view.byteOffset ?? 0, size = view.byteLength;
      source = { kind: 'bufferView', bufferView: img.bufferView };
      const validRange = Number.isSafeInteger(offset) && Number.isSafeInteger(size) && offset >= 0 && size >= 0;
      if (view.buffer === 0 && !buffers[0]?.uri && binary && validRange && offset + size <= Math.min(binary.length, buffers[0]?.byteLength ?? binary.length)) {
        byteLength = size; header = binary.subarray(offset, offset + Math.min(size, IMAGE_HEADER_BYTES));
      } else if (indexIn(view.buffer, buffers) && uriInfo(buffers[view.buffer]?.uri).kind === 'data' && validRange && offset + size <= buffers[view.buffer]?.byteLength) {
        byteLength = size; header = inlineImageHeader(buffers[view.buffer].uri, offset, size);
      } else warn(`${location}.bufferView is external, missing or outside its binary buffer.`);
    } else { source = { kind: 'missing' }; warn(`${location} has no readable image source.`); }
    const dimensions = imageDimensions(header);
    if (img.mimeType === 'image/ktx2' || dimensions.format === 'ktx2' || (typeof img.uri === 'string' && /\.ktx2(?:[?#]|$)/i.test(img.uri))) extensionNames.add('KHR_texture_basisu');
    return { index: imageIndex, name: label(img.name, `image_${imageIndex}`), source,
      mimeType: ['image/png', 'image/jpeg', 'image/webp', 'image/ktx2'].includes(img.mimeType) ? img.mimeType : null,
      byteLength, ...dimensions, headerBytesScanned: header?.length ?? 0 };
  });
  const textureReports = textures.map((texture, index) => {
    extensions(object(texture).extensions);
    const source = texture?.extensions?.KHR_texture_basisu?.source ?? texture?.source;
    if (!indexIn(source, images)) warn(`textures[${index}].source references a missing image.`);
    return { index, name: label(texture?.name, `texture_${index}`), sourceImage: indexIn(source, images) ? source : null,
      sampler: Number.isInteger(texture?.sampler) ? texture.sampler : null, requiresBasisTranscoder: texture?.extensions?.KHR_texture_basisu !== undefined };
  });
  function textureIndex(info, location) {
    if (!info) return null;
    if (!indexIn(info.index, textures)) { warn(`${location} references a missing texture.`); return null; }
    return info.index;
  }
  const materialReports = materials.map((material, index) => {
    const m = object(material), pbr = object(m.pbrMetallicRoughness), at = `materials[${index}]`;
    return { index, name: label(m.name, `material_${index}`), metallicFactor: finite(pbr.metallicFactor) ? pbr.metallicFactor : 1,
      roughnessFactor: finite(pbr.roughnessFactor) ? pbr.roughnessFactor : 1,
      baseColorFactor: Array.isArray(pbr.baseColorFactor) && pbr.baseColorFactor.length === 4 && pbr.baseColorFactor.every(finite) ? pbr.baseColorFactor : [1, 1, 1, 1],
      alphaMode: ['OPAQUE', 'MASK', 'BLEND'].includes(m.alphaMode ?? 'OPAQUE') ? (m.alphaMode ?? 'OPAQUE') : 'unsupported', doubleSided: m.doubleSided === true,
      textures: { baseColor: textureIndex(pbr.baseColorTexture, `${at}.baseColorTexture`), metallicRoughness: textureIndex(pbr.metallicRoughnessTexture, `${at}.metallicRoughnessTexture`),
        normal: textureIndex(m.normalTexture, `${at}.normalTexture`), occlusion: textureIndex(m.occlusionTexture, `${at}.occlusionTexture`), emissive: textureIndex(m.emissiveTexture, `${at}.emissiveTexture`) } };
  });
  const defaultScene = indexIn(gltf.scene, scenes) ? gltf.scene : scenes.length ? 0 : null;
  if (gltf.scene !== undefined && !indexIn(gltf.scene, scenes)) warn('The default scene index is invalid; scene zero is used for the report when available.');
  return {
    schemaVersion: 1, file: { name: label(basename(sourceName), 'asset.glb'), byteLength: data.length, glbVersion: 2, chunks }, assetVersion: '2.0',
    totals: { meshes: meshes.length, primitives: meshReports.reduce((n, mesh) => n + mesh.primitives.length, 0), nodes: nodes.length,
      skins: skins.length, joints: jointNodes.size, animations: animations.length, materials: materials.length, textures: textures.length, images: images.length,
      meshDefinitionTriangles: sum(meshReports.map(mesh => mesh.triangleCount)),
      allNodeInstanceTriangles: sum(nodeReports.filter(node => node.mesh !== null).map(node => meshReports[node.mesh].triangleCount)),
      defaultSceneTriangles: defaultScene === null ? null : sceneReports[defaultScene].triangleCount },
    defaultScene, meshes: meshReports, scenes: sceneReports,
    hierarchy: { roots: nodeReports.filter(node => !node.parents.length).map(node => node.index), nodes: nodeReports,
      nodesWithSkins: nodeReports.filter(node => node.skin !== null).map(node => ({ node: node.index, name: node.name, mesh: node.mesh, skin: node.skin })) },
    skins: skinReports, animations: animationReports, materials: materialReports, textures: textureReports, images: imageReports,
    extensionsUsed: [...extensionNames].sort(), unsupportedCompression: COMPRESSION_EXTENSIONS.filter(name => extensionNames.has(name)),
    externalURIs, warnings, warningsSuppressed,
    limits: { imageHeaderBytes: IMAGE_HEADER_BYTES, decodesGeometry: false, validatesImagePayload: false }
  };
}

export async function inspectGLBFile(filePath) {
  let size;
  try { size = (await stat(filePath)).size; } catch (error) { fail('GLB_IO', `Cannot read GLB file (${error.code || 'I/O error'}).`); }
  if (size > MAX_FILE_BYTES) fail('GLB_LIMIT', 'GLB exceeds the 256 MiB inspection limit.');
  let data;
  try { data = await readFile(filePath); } catch (error) { fail('GLB_IO', `Cannot read GLB file (${error.code || 'I/O error'}).`); }
  return inspectGLB(data, { sourceName: basename(filePath) });
}

async function main(args) {
  if (args.includes('--help') || args.includes('-h')) { console.log('Usage: node scripts/inspect-glb.mjs model.glb [--output report.json]'); return; }
  let input, output;
  for (let i = 0; i < args.length; i++) {
    if (args[i] === '--output') {
      if (!args[i + 1] || args[i + 1].startsWith('--')) fail('GLB_USAGE', '--output requires a report file path.');
      output = args[++i];
    } else if (args[i].startsWith('-') || input) fail('GLB_USAGE', 'Expected one GLB file and optional --output path.');
    else input = args[i];
  }
  if (!input) fail('GLB_USAGE', 'A GLB file is required. Use --help for usage.');
  if (output && resolve(input) === resolve(output)) fail('GLB_USAGE', 'The report must not overwrite the GLB input.');
  const report = await inspectGLBFile(input);
  if (output) { await mkdir(dirname(resolve(output)), { recursive: true }); await writeFile(output, `${JSON.stringify(report, null, 2)}\n`); }
  const counts = report.totals;
  console.log(`GLB v2: ${report.file.name} (${report.file.byteLength} bytes)`);
  console.log(`Meshes ${counts.meshes} · nodes ${counts.nodes} · joints ${counts.joints} · scene triangles ${counts.defaultSceneTriangles ?? 'unknown'}`);
  console.log(`Materials ${counts.materials} · textures ${counts.textures} · images ${counts.images} · animations ${counts.animations}`);
  if (report.unsupportedCompression.length) console.log(`Decoder/transcoder required: ${report.unsupportedCompression.join(', ')}`);
  if (report.externalURIs.length) console.log(`External resources ${report.externalURIs.length}; hosts: ${[...new Set(report.externalURIs.map(uri => uri.host || uri.kind))].join(', ')}`);
  if (report.warnings.length) console.log(`Metadata warnings ${report.warnings.length}${report.warningsSuppressed ? '+' : ''}`);
  if (output) console.log('JSON inspection report saved.');
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) {
  main(process.argv.slice(2)).catch(error => {
    console.error(`${error instanceof GLBInspectionError ? error.code : 'GLB_IO'}: ${error instanceof GLBInspectionError ? error.message : 'Could not save the inspection report.'}`);
    process.exitCode = error.code === 'GLB_USAGE' ? 2 : 1;
  });
}
