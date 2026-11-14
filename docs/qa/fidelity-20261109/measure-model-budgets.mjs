// CPU inventory only: no renderer, browser, paid service or source modification.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import { readFile, readdir, writeFile } from 'node:fs/promises';
import { relative, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
const args = process.argv.slice(2), value = flag => args[args.indexOf(flag) + 1];
assert.ok(args.length === 4 && args.includes('--source-root') && args.includes('--output'));
const root = resolve(value('--source-root')), output = resolve(value('--output'));
assert.ok(['/workspace/Yautja-continue-20261109', '/workspace/Yautja-fidelity-20261109'].includes(root));
assert.ok(output.startsWith('/workspace/qa/fidelity-20261109/'));
const sha = bytes => createHash('sha256').update(bytes).digest('hex');
async function fingerprint() {
  const files = [], walk = async directory => { for (const entry of await readdir(directory, { withFileTypes: true })) { const path = resolve(directory, entry.name); if (entry.isDirectory()) await walk(path); else if (/\.(?:js|css)$/.test(entry.name)) files.push(path); } };
  await walk(resolve(root, 'js')); await walk(resolve(root, 'css')); for (const name of ['index.html', 'package.json', 'package-lock.json', 'vite.config.js']) files.push(resolve(root, name));
  const hash = createHash('sha256'); for (const path of files.sort()) hash.update(relative(root, path) + '\0').update(await readFile(path)).update('\0'); return { files: files.length, sha256: hash.digest('hex') };
}
const before = await fingerprint(), { Box3, Vector3, REVISION } = await import(pathToFileURL(resolve(root, 'node_modules/three/build/three.module.js')).href);
const models = await import(pathToFileURL(resolve(root, 'js/graphics/SupportModels.js')).href), surfaces = await import(pathToFileURL(resolve(root, 'js/graphics/SurfaceLibrary.js')).href);
const measure = group => {
  const geometries = new Set(), materials = new Set(), buffers = new Set(), staticBuffers = new Set(), morphBuffers = new Set(), instanceBuffers = new Set();
  let meshes = 0, instances = 0, triangles = 0, vertices = 0, malformedAttributes = 0, morphAttributes = 0;
  const attributeBuffer = attribute => (attribute.isInterleavedBufferAttribute ? attribute.data.array : attribute.array).buffer;
  const attribute = (a, category) => { if (!a) { malformedAttributes++; return; } const array = a.isInterleavedBufferAttribute ? a.data.array : a.array; if ([...array].some(n => !Number.isFinite(n))) malformedAttributes++; const buffer = attributeBuffer(a); buffers.add(buffer); category.add(buffer); };
  group.updateMatrixWorld(true); group.traverse(object => { if (!object.isMesh) return; meshes++;
    const geometry = object.geometry, count = object.isInstancedMesh ? object.count : 1, p = geometry.getAttribute('position'); instances += count; triangles += (geometry.index?.count ?? p.count) / 3 * count; vertices += p.count * count;
    for (const material of Array.isArray(object.material) ? object.material : [object.material]) materials.add(material);
    if (!geometries.has(geometry)) { geometries.add(geometry); for (const name of ['position', 'normal', 'uv']) if (!geometry.getAttribute(name)) malformedAttributes++;
      for (const a of Object.values(geometry.attributes)) attribute(a, staticBuffers); if (geometry.index) attribute(geometry.index, staticBuffers);
      for (const attributes of Object.values(geometry.morphAttributes)) for (const a of attributes) { morphAttributes++; attribute(a, morphBuffers); }
    }
    if (object.isInstancedMesh) { attribute(object.instanceMatrix, instanceBuffers); if (object.instanceColor) attribute(object.instanceColor, instanceBuffers); }
  });
  const bytes = set => [...set].reduce((sum, buffer) => sum + buffer.byteLength, 0), box = new Box3().setFromObject(group);
  return { triangles, vertices, meshes, meshInstances: instances, geometries: geometries.size, materials: materials.size, malformedAttributes, morphAttributes,
    buffers: { totalUniqueBytes: bytes(buffers), staticAttributeBytes: bytes(staticBuffers), morphAttributeBytes: bytes(morphBuffers), instanceAttributeBytes: bytes(instanceBuffers), uniqueArrayBuffers: buffers.size,
      scope: 'Unique retained geometry attribute/index/morph and instance matrix/color ArrayBuffers in this factory result. Categories may alias; totalUniqueBytes deduplicates all. Excludes JS objects, textures, driver allocation, GPU mipmaps and renderer resources.' },
    bounds: { min: box.min.toArray(), max: box.max.toArray(), size: box.getSize(new Vector3()).toArray() }, anatomy: group.userData.anatomy ?? null, weaponKind: group.userData.weaponKind ?? null, visualSource: group.userData.visualSource ?? null };
};
const report = { schemaVersion: 1, sourceRoot: root, sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { cwd: root, encoding: 'utf8' }).trim(), before, engine: REVISION, humanTesters: 0, fidelity1to1Verified: false, hardwarePerformanceMeasured: false, models: {}, limitations: ['Studio uniqueGeometryBytes counts static geometry only. This complementary CPU report includes morph and instance data without changing the frozen studio fixture.', 'Triangles count all mesh instances; meshes and materials count unique scene objects/materials. Renderer draw calls and GPU allocation require separate measurement.'] };
for (const role of ['marine', 'smartgunner', 'flametrooper', 'medic', 'commtech', 'sniper', 'sadar', 'exosuit']) report.models['marine:' + role] = measure(models.createMarineModel(role));
for (const index of [0, 1]) report.models['honor-guard:' + index] = measure(models.createHonorGuardModel(index));
report.models.synthetic = measure(models.createSyntheticModel()); const pod = models.createDropPodModel();
for (const opening of [0, 1]) { pod.updateOpening(opening); report.models['capsule:' + opening] = measure(pod.group); }
report.surfacesInstantiatedByModels = surfaces.getSurfaceStats(); report.after = await fingerprint(); assert.deepEqual(before, report.after, 'Source changed during CPU inventory');
for (const model of Object.values(report.models)) assert.equal(model.malformedAttributes, 0);
await writeFile(output, JSON.stringify(report, null, 2) + '\n', { flag: 'wx' }); console.log(JSON.stringify({ status: 'measured', output, source: before, models: Object.keys(report.models).length }));
