import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { createCreatureModel } from '../js/graphics/CreatureModels.js';
import { createMarineModel, createHonorGuardModel } from '../js/graphics/SupportModels.js';
import { decorateClanOfficer } from '../js/graphics/PackMarks.js';

// AUD-031: leader, support, parasite and heavy roles read by silhouette alone. Each model's
// triangles are rasterized in black and white (no material, no colour) from the front and the
// side, at one fixed world scale so size is part of the outline, centred on the model origin.
const N = 64, SPAN = 5;
function silhouette(object, view) {
  object.updateMatrixWorld(true);
  const minY = new THREE.Box3().setFromObject(object).min.y, grid = new Uint8Array(N * N);
  const v = [new THREE.Vector3(), new THREE.Vector3(), new THREE.Vector3()];
  const project = p => [((view === 'front' ? p.x : p.z) / SPAN + .5) * N, (1 - (p.y - minY) / SPAN) * N];
  object.traverse(mesh => {
    const position = mesh.isMesh ? mesh.geometry?.attributes?.position : null, index = mesh.geometry?.index;
    if (!position) return;
    for (let t = 0, count = (index ? index.count : position.count) / 3; t < count; t++) {
      const P = [0, 1, 2].map(k => project(v[k].fromBufferAttribute(position, index ? index.getX(t * 3 + k) : t * 3 + k).applyMatrix4(mesh.matrixWorld)));
      const area = (P[1][0] - P[0][0]) * (P[2][1] - P[0][1]) - (P[2][0] - P[0][0]) * (P[1][1] - P[0][1]);
      if (Math.abs(area) < 1e-9) continue;
      const xs = P.map(p => p[0]), ys = P.map(p => p[1]);
      for (let y = Math.max(0, Math.floor(Math.min(...ys))); y <= Math.min(N - 1, Math.ceil(Math.max(...ys))); y++)
        for (let x = Math.max(0, Math.floor(Math.min(...xs))); x <= Math.min(N - 1, Math.ceil(Math.max(...xs))); x++) {
          const edge = (a, b) => (b[0] - a[0]) * (y + .5 - a[1]) - (b[1] - a[1]) * (x + .5 - a[0]);
          const w = [edge(P[0], P[1]), edge(P[1], P[2]), edge(P[2], P[0])];
          if (w.every(value => value >= 0) || w.every(value => value <= 0)) grid[y * N + x] = 1;
        }
    }
  });
  return grid;
}
const overlap = (a, b) => { let both = 0, either = 0; for (let i = 0; i < a.length; i++) { both += a[i] & b[i]; either += a[i] | b[i]; } return either ? both / either : 1; };
const outline = model => ({ front: silhouette(model, 'front'), side: silhouette(model, 'side') });
// The most telling of the two views decides; 1 means identical outlines.
const bestView = (a, b) => Math.min(overlap(a.front, b.front), overlap(a.side, b.side));

const FACTIONS = {
  xenomorph: { line: [createCreatureModel('warrior')], leader: [createCreatureModel('officer')], heavy: [createCreatureModel('crusher')], parasite: [createCreatureModel('facehugger')] },
  yautja: { line: [createHonorGuardModel(0)], leader: [(() => { const model = createHonorGuardModel(1); decorateClanOfficer(model); return model; })()] },
  human: { line: [createMarineModel('marine')], support: [createMarineModel('medic'), createMarineModel('commtech')], heavy: [createMarineModel('smartgunner'), createMarineModel('exosuit')] }
};
const outlines = Object.fromEntries(Object.entries(FACTIONS).map(([faction, roles]) =>
  [faction, Object.fromEntries(Object.entries(roles).map(([role, models]) => [role, models.map(outline)]))]));

test('every role of a faction differs from every other role of that faction without colour', () => {
  for (const [faction, roles] of Object.entries(outlines)) {
    const names = Object.keys(roles);
    for (let i = 0; i < names.length; i++) for (let j = i + 1; j < names.length; j++)
      for (const a of roles[names[i]]) for (const b of roles[names[j]]) {
        const value = bestView(a, b);
        assert.ok(value <= .8, `${faction}: ${names[i]} and ${names[j]} share ${value.toFixed(2)} of their best outline`);
      }
  }
});

test('the parasite is unmistakable against every other combatant', () => {
  const parasite = outlines.xenomorph.parasite[0];
  for (const [faction, roles] of Object.entries(outlines)) for (const [role, list] of Object.entries(roles)) if (role !== 'parasite')
    for (const other of list) assert.ok(Math.max(overlap(parasite.front, other.front), overlap(parasite.side, other.side)) <= .2, `${faction} ${role}`);
});

test('the silhouette never reads a material: the same geometry in any colour has the same outline', () => {
  const model = createMarineModel('smartgunner'), before = outline(model);
  model.traverse(mesh => { if (mesh.isMesh) mesh.material = new THREE.MeshBasicMaterial({ color: 0xff00ff }); });
  const after = outline(model);
  assert.equal(overlap(before.front, after.front), 1); assert.equal(overlap(before.side, after.side), 1);
});
