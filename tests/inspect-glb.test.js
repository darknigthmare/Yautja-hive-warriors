import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFileSync } from 'node:child_process';
import { inspectGLB, inspectGLBFile, GLBInspectionError } from '../scripts/inspect-glb.mjs';

const JSON_CHUNK = 0x4e4f534a, BIN_CHUNK = 0x004e4942;
const minimal = () => ({ asset: { version: '2.0' } });
function chunk(type, data) {
  const body = Buffer.alloc(Math.ceil(data.length / 4) * 4, type === JSON_CHUNK ? 0x20 : 0);
  data.copy(body); const result = Buffer.alloc(body.length + 8);
  result.writeUInt32LE(body.length, 0); result.writeUInt32LE(type, 4); body.copy(result, 8);
  return result;
}
function pack(chunks) {
  const body = Buffer.concat(chunks), result = Buffer.alloc(body.length + 12);
  result.writeUInt32LE(0x46546c67, 0); result.writeUInt32LE(2, 4); result.writeUInt32LE(result.length, 8); body.copy(result, 12);
  return result;
}
function glb(document, binary) {
  const chunks = [chunk(JSON_CHUNK, Buffer.from(JSON.stringify(document)))];
  if (binary !== undefined) chunks.push(chunk(BIN_CHUNK, binary));
  return pack(chunks);
}
// Header-only image fixtures exercise metadata parsing, not image decoding or
// production assets. The report explicitly declines payload validation.
function pngHeader(width = 32, height = 16) {
  const data = Buffer.alloc(24); Buffer.from('89504e470d0a1a0a', 'hex').copy(data);
  data.writeUInt32BE(13, 8); data.write('IHDR', 12); data.writeUInt32BE(width, 16); data.writeUInt32BE(height, 20); return data;
}
function webpHeader(type, width, height) {
  const length = type === 'VP8L' ? 5 : 10;
  const data = Buffer.alloc(20 + length + length % 2);
  data.write('RIFF'); data.writeUInt32LE(data.length - 8, 4); data.write('WEBP', 8); data.write(type, 12); data.writeUInt32LE(length, 16);
  if (type === 'VP8X') { data.writeUIntLE(width - 1, 24, 3); data.writeUIntLE(height - 1, 27, 3); }
  else if (type === 'VP8L') { data[20] = 0x2f; data.writeUInt32LE((width - 1) | ((height - 1) << 14), 21); }
  else { Buffer.from([0x9d, 0x01, 0x2a]).copy(data, 23); data.writeUInt16LE(width, 26); data.writeUInt16LE(height, 28); }
  return data;
}
function rigFixture() {
  return {
    asset: { version: '2.0' }, scene: 0, scenes: [{ name: 'Main', nodes: [0] }],
    buffers: [{ byteLength: 24 }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 24 }],
    accessors: [
      { count: 9, componentType: 5126, type: 'VEC3' }, { count: 6, componentType: 5123, type: 'SCALAR' },
      { count: 5, componentType: 5126, type: 'VEC3' }, { count: 4, componentType: 5126, type: 'VEC3' },
      { count: 3, componentType: 5126, type: 'SCALAR', min: [0.5], max: [2.5] }, { count: 3, componentType: 5126, type: 'VEC4' },
      { count: 9, componentType: 5121, type: 'VEC4' }, { count: 9, componentType: 5126, type: 'VEC4' }
    ],
    meshes: [
      { name: 'Hunter', primitives: [{ indices: 1, attributes: { POSITION: 0, NORMAL: 0, TEXCOORD_0: 0, JOINTS_0: 6, WEIGHTS_0: 7 }, material: 0 }, { attributes: { POSITION: 0 } }] },
      { name: 'Claws', primitives: [{ mode: 5, attributes: { POSITION: 2 } }, { mode: 6, attributes: { POSITION: 3 } }] }
    ],
    nodes: [{ name: 'Root', children: [1, 2, 4] }, { name: 'Body', mesh: 0, skin: 0 }, { name: 'mixamorig:Hips', children: [3] }, { name: 'Hand' }, { name: 'Claws', mesh: 1 }, { name: 'Detached', mesh: 0 }],
    skins: [{ name: 'Rig', skeleton: 2, joints: [2, 3] }],
    animations: [{ name: 'Idle', samplers: [{ input: 4, output: 5 }], channels: [{ sampler: 0, target: { node: 3, path: 'rotation' } }] }],
    materials: [{ name: 'Armor', pbrMetallicRoughness: { metallicFactor: 0.72, roughnessFactor: 0.38, baseColorFactor: [1, 0.8, 0.6, 1], baseColorTexture: { index: 0 } }, normalTexture: { index: 0 }, alphaMode: 'MASK', doubleSided: true }],
    textures: [{ source: 0 }], images: [{ bufferView: 0, mimeType: 'image/png' }]
  };
}

test('GLB inspection separates definition, node-instance and visible scene triangle counts', () => {
  const bytes = glb(rigFixture(), pngHeader());
  const report = inspectGLB(bytes, { sourceName: 'fixture.glb' });
  assert.equal(report.totals.meshDefinitionTriangles, 10);
  assert.equal(report.totals.allNodeInstanceTriangles, 15);
  assert.equal(report.totals.defaultSceneTriangles, 10);
  assert.deepEqual(report.meshes.map(mesh => mesh.primitives.map(p => p.triangleCount)), [[2, 3], [3, 2]]);
  assert.equal(report.meshes[0].primitives[0].hasSkinWeights, true);
  assert.deepEqual(report.hierarchy.roots, [0, 5]);
  assert.deepEqual(report.hierarchy.nodesWithSkins, [{ node: 1, name: 'Body', mesh: 0, skin: 0 }]);
  assert.deepEqual(report.skins[0].joints.map(joint => [joint.name, joint.parent, joint.parentJoint]), [['mixamorig:Hips', 0, null], ['Hand', 2, 2]]);
  assert.equal(report.animations[0].durationSeconds, 2);
  assert.equal(report.animations[0].channels[0].targetName, 'Hand');
  assert.equal(report.materials[0].textures.normal, 0);
  assert.equal(report.materials[0].metallicFactor, 0.72);
  assert.deepEqual([report.images[0].format, report.images[0].width, report.images[0].height], ['png', 32, 16]);
  assert.deepEqual(report.warnings, []);
  assert.deepEqual(report, inspectGLB(bytes, { sourceName: 'fixture.glb' }), 'same bytes yield a deterministic JSON report');
});

test('container corruption is rejected before JSON or binary metadata is trusted', () => {
  const valid = glb(minimal());
  const cases = [
    [Buffer.alloc(8), 'GLB_HEADER'],
    [Buffer.from(valid), 'GLB_MAGIC', data => data.writeUInt32LE(0, 0)],
    [Buffer.from(valid), 'GLB_VERSION', data => data.writeUInt32LE(1, 4)],
    [Buffer.from(valid), 'GLB_LENGTH', data => data.writeUInt32LE(data.length + 1, 8)],
    [Buffer.from(valid), 'GLB_CHUNK', data => data.writeUInt32LE(0xfffffffc, 12)],
    [Buffer.from(valid), 'GLB_CHUNK', data => data.writeUInt32LE(3, 12)],
    [pack([chunk(BIN_CHUNK, Buffer.alloc(4))]), 'GLB_JSON'],
    [pack([chunk(JSON_CHUNK, Buffer.from('{not json'))]), 'GLB_JSON'],
    [pack([chunk(JSON_CHUNK, Buffer.from(JSON.stringify(minimal()))), chunk(JSON_CHUNK, Buffer.from('{}'))]), 'GLB_JSON'],
    [pack([chunk(JSON_CHUNK, Buffer.from(JSON.stringify(minimal()))), chunk(BIN_CHUNK, Buffer.alloc(0)), chunk(BIN_CHUNK, Buffer.alloc(0))]), 'GLB_BIN'],
    [glb({ asset: { version: '1.0' } }), 'GLB_ASSET'],
    [glb({ ...minimal(), nodes: {} }), 'GLB_STRUCTURE']
  ];
  for (const [bytes, code, mutate] of cases) {
    mutate?.(bytes);
    assert.throws(() => inspectGLB(bytes), error => error instanceof GLBInspectionError && error.code === code);
  }
  assert.throws(() => inspectGLB('not bytes'), error => error.code === 'GLB_INPUT');
  const trailing = Buffer.concat([valid, Buffer.from([0, 0])]); trailing.writeUInt32LE(trailing.length, 8);
  assert.throws(() => inspectGLB(trailing), error => error.code === 'GLB_CHUNK');
});

test('URI privacy excludes signed paths, credentials, queries and inline image data', () => {
  const png = pngHeader(64, 128);
  const report = inspectGLB(glb({ ...minimal(),
    buffers: [{ uri: 'https://user:private-password@cdn.example.com/private/model.bin?signature=secret-token', byteLength: 8 }],
    images: [{ uri: 'data:image/png;base64,' + png.toString('base64') }, { uri: '../textures/private.png' }, { uri: '//images.example.org/texture.png?token=another-secret' }]
  }));
  assert.deepEqual(report.externalURIs, [
    { location: 'buffers[0].uri', kind: 'remote', host: 'cdn.example.com' },
    { location: 'images[1].uri', kind: 'relative', host: null },
    { location: 'images[2].uri', kind: 'remote', host: 'images.example.org' }
  ]);
  assert.equal(report.images[0].width, 64);
  assert.equal(report.images[0].height, 128);
  const json = JSON.stringify(report);
  for (const privateText of ['private-password', 'secret-token', 'another-secret', 'base64', png.toString('base64'), '../textures/private.png']) assert.equal(json.includes(privateText), false);
});

test('embedded PNG, JPEG and all common WebP headers expose dimensions without decoding', () => {
  const headers = [pngHeader(77, 55), Buffer.from('ffd8ffe100040000ffc0000b080010002001011100ffd9', 'hex'), webpHeader('VP8X', 1024, 512), webpHeader('VP8L', 64, 32), webpHeader('VP8 ', 320, 240)];
  const binary = Buffer.concat(headers);
  let offset = 0;
  const bufferViews = headers.map(data => { const view = { buffer: 0, byteOffset: offset, byteLength: data.length }; offset += data.length; return view; });
  const report = inspectGLB(glb({ ...minimal(), buffers: [{ byteLength: binary.length }], bufferViews, images: headers.map((_, index) => ({ bufferView: index })) }, binary));
  assert.deepEqual(report.images.map(image => [image.format, image.width, image.height]), [['png', 77, 55], ['jpeg', 32, 16], ['webp', 1024, 512], ['webp', 64, 32], ['webp', 320, 240]]);
  assert.equal(report.limits.validatesImagePayload, false);
  // Data-URI buffers can contain the image at a non-triplet-aligned offset.
  const prefixed = Buffer.concat([Buffer.from([0, 1, 2, 3, 4]), pngHeader(12, 13)]);
  const embedded = inspectGLB(glb({ ...minimal(), buffers: [{ uri: 'data:application/octet-stream;base64,' + prefixed.toString('base64'), byteLength: prefixed.length }], bufferViews: [{ buffer: 0, byteOffset: 5, byteLength: 24 }], images: [{ bufferView: 0 }] }));
  assert.deepEqual([embedded.images[0].width, embedded.images[0].height], [12, 13]);
});

test('compression, missing dimensions and invalid binary ranges remain explicit', () => {
  const ktx = Buffer.alloc(28); Buffer.from('ab4b5458203230bb0d0a1a0a', 'hex').copy(ktx); ktx.writeUInt32LE(2048, 20); ktx.writeUInt32LE(1024, 24);
  const report = inspectGLB(glb({ ...minimal(), extensionsRequired: ['KHR_draco_mesh_compression'],
    buffers: [{ byteLength: ktx.length }], bufferViews: [{ buffer: 0, byteOffset: 0, byteLength: 28, extensions: { EXT_meshopt_compression: {} } }, { buffer: 0, byteOffset: 99999, byteLength: 8 }],
    images: [{ bufferView: 0 }, { bufferView: 1 }, { uri: 'https://textures.example.com/a.webp?sig=secret' }],
    textures: [{ extensions: { KHR_texture_basisu: { source: 0 } } }]
  }, ktx));
  assert.deepEqual(report.unsupportedCompression, ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu']);
  assert.deepEqual([report.images[0].format, report.images[0].width, report.images[0].height], ['ktx2', 2048, 1024]);
  assert.equal(report.images[1].width, null);
  assert.equal(report.images[2].width, null);
  assert.ok(report.warnings.some(warning => warning.includes('outside its binary buffer')));
  assert.equal(report.textures[0].requiresBasisTranscoder, true);
});

test('cycles, missing references and unknown counts cannot hang or become false zero-triangle claims', () => {
  const report = inspectGLB(glb({ ...minimal(),
    nodes: [{ name: 'A', children: [1, 1, 999] }, { name: 'B', children: [0], mesh: 0 }], scenes: [{ nodes: [0] }],
    meshes: [{ primitives: [{ attributes: { POSITION: 42 } }] }],
    animations: [{ samplers: [null], channels: [{ sampler: 9, target: { node: 999, path: 'rotation' } }] }]
  }));
  assert.equal(report.totals.meshDefinitionTriangles, null);
  assert.equal(report.totals.defaultSceneTriangles, null);
  assert.equal(report.scenes[0].nodeCount, 2);
  assert.equal(report.animations[0].durationSeconds, null);
  assert.ok(report.warnings.some(warning => warning.includes('cycle')));
  assert.ok(report.warnings.some(warning => warning.includes('repeats a child')));
  assert.ok(report.warnings.some(warning => warning.includes('missing node')));
  const unknownChunk = inspectGLB(pack([chunk(JSON_CHUNK, Buffer.from(JSON.stringify(minimal()))), chunk(0x12345678, Buffer.alloc(4))]));
  assert.equal(unknownChunk.file.chunks[1].type, '0x12345678');
});

test('CLI saves deterministic JSON, prints only a summary and protects the source file', async () => {
  const directory = await mkdtemp(join(tmpdir(), 'inspect-glb-test-'));
  const input = join(directory, 'fixture.glb'), output = join(directory, 'reports', 'inspection.json');
  const bytes = glb(rigFixture(), pngHeader());
  try {
    await writeFile(input, bytes);
    const script = resolve('scripts/inspect-glb.mjs');
    const stdout = execFileSync(process.execPath, [script, input, '--output', output], { encoding: 'utf8' });
    assert.match(stdout, /scene triangles 10/);
    assert.match(stdout, /JSON inspection report saved/);
    assert.equal(stdout.includes('"hierarchy"'), false);
    assert.deepEqual(JSON.parse(await readFile(output, 'utf8')), await inspectGLBFile(input));
    assert.throws(() => execFileSync(process.execPath, [script, input, '--output', input], { stdio: 'pipe' }), error => error.status === 2);
    assert.deepEqual(await readFile(input), bytes);
    assert.throws(() => execFileSync(process.execPath, [script, input, '--unknown'], { stdio: 'pipe' }), error => error.status === 2);
  } finally { await rm(directory, { recursive: true, force: true }); }
});
