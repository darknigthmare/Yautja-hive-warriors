/* Offline CPU calibration. Requires Python 3 + NumPy/SciPy for exact convex
 * hulls; those dependencies are never loaded by the game. No model is edited. */
import { createHash } from 'node:crypto';
import { readFile, writeFile } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { loadSkinnedGlb } from '../tests/helpers/load-skinned-glb.mjs';
import { GENERATED_ASSETS } from '../js/graphics/GeneratedAssetManifest.js';

const expected = {
  rigged: '202b5d7d635cdb14fcf8af430faba3207d5668f43f85d9d9dca1f81cc0d8a97e',
  walk: 'ae87707f9fa53e246d629c44c454ec6b58b98e0396330e9561476f43bc0e43da',
  run: '7944bc681cef08d822905b099a79963710517dd14898e0c526dcced2cf7b827d'
};
const source = async name => {
  const url = new URL(`../public/models/big-chap-${name}.glb`, import.meta.url);
  if (createHash('sha256').update(await readFile(url)).digest('hex') !== expected[name]) throw new Error(`Measured Big Chap ${name} source changed`);
  return loadSkinnedGlb(url);
};
const gltf = await source('rigged'), entry = GENERATED_ASSETS.xenomorph_warrior;
const correction = entry.creatureRig.skinCorrections.meshes[0], positions = gltf.scene.getObjectByName('char1').geometry.attributes.position;
const clipReferences = {};
for (const name of ['walk', 'run']) {
  const clip = await source(name);
  clipReferences[name] = { sourceSha256: expected[name], quaternions: Object.fromEntries(clip.animations[0].tracks
    .filter(track => /^(Left|Right)(Foot|ToeBase)\.quaternion$/.test(track.name))
    .map(track => [track.name.split('.')[0], Array.from(track.values.slice(0, 4))])) };
}
const feet = [
  { name: 'left', parentBone: 'LeftLeg', sourceFootBone: 'LeftFoot', sourceToeBone: 'LeftToeBase', anklePivot: [.187, .235, .014], toePivot: [.234, .065, .159], forward: [.38, 0, .925], calfBlendY: [.18, .34], toeBlend: [.12, .235] },
  { name: 'right', parentBone: 'RightLeg', sourceFootBone: 'RightFoot', sourceToeBone: 'RightToeBase', anklePivot: [-.084, .235, -.661], toePivot: [-.13, .075, -.591], forward: [-.43, 0, .903], calfBlendY: [.18, .35], toeBlend: [.075, .16] }
];
const regions = [];
for (let side = 0; side < feet.length; side++) {
  feet[side].vertexRanges = correction.bindings[side + 1].vertexRanges;
  const points = [];
  for (const [start, count] of feet[side].vertexRanges) for (let i = start; i < start + count; i++) points.push([i, positions.getX(i), positions.getY(i), positions.getZ(i)]);
  regions.push(points);
}
const config = { calibrated: true, id: 'big-chap-measured-ankles-v1-20261025', sourceSha256: expected.rigged,
  meshName: correction.meshName, vertexCount: correction.vertexCount, indexCount: correction.indexCount,
  positionHash: correction.positionHash, indexHash: correction.indexHash, levels: 16, feet, clipReferences,
  motion: { ankleGain: .5, toeGain: .5, maxAnkleRadians: .18, maxToeRadians: .12 },
  ground: { groundY: 0, clearance: .005, maxCorrection: .18, contactBand: .16, fullContactBand: .06 } };
const python = String.raw`
import sys,json,math,base64
import numpy as np
from scipy.spatial import ConvexHull,QhullError
payload=json.load(sys.stdin);cfg=payload['config'];total=0
def smooth(a,b,v):
 t=max(0,min(1,(v-a)/(b-a)));return t*t*(3-2*t)
for foot,points in zip(cfg['feet'],payload['regions']):
 groups={};levels=[];forward=np.array(foot['forward']);forward/=np.linalg.norm(forward)
 foot['forward']=forward.tolist();foot['lateralAxis']=[-forward[2],0,forward[0]]
 for point in points:
  vertex,x,y,z=point;ankle=1-smooth(*foot['calfBlendY'],y)
  longitudinal=float((np.array([x,y,z])-np.array(foot['anklePivot']))@forward)
  toe=smooth(*foot['toeBlend'],longitudinal)*(1-smooth(.1,.18,y))
  level=int(math.floor(ankle*cfg['levels']+.5)) if ankle<1 or toe==0 else cfg['levels']+int(math.floor(toe*cfg['levels']+.5))
  levels.append(level);groups.setdefault(level,[]).append(point)
 foot['vertexLevels']={'encoding':'base64-u8','count':len(levels),'data':base64.b64encode(bytes(levels)).decode()}
 foot['supports']=[]
 for level,rows in sorted(groups.items()):
  coordinates=np.array([point[1:] for point in rows])
  try:
   hull=ConvexHull(coordinates);vertices=[rows[i][0] for i in hull.vertices]
   error=float(np.max(hull.equations[:,:3]@coordinates.T+hull.equations[:,3,None]))
  except QhullError:
   vertices=[point[0] for point in rows];error=0
  foot['supports'].append({'level':level,'vertices':vertices,'selected':len(rows),'maximumOutsideError':error});total+=len(vertices)
cfg['supportVertices']=total
print(json.dumps(cfg,separators=(',',':')))
`;
const measured = execFileSync('python3', ['-c', python], { input: JSON.stringify({ config, regions }), encoding: 'utf8', maxBuffer: 2 * 1024 * 1024 }).trim();
const output = new URL('../js/graphics/BigChapAnkleCalibration.js', import.meta.url);
const contents = '// Source-measured ankle/toe pivots and exact per-weight convex supports.\nexport const BIG_CHAP_ANKLE_RIG = ' + measured + ';\n';
if (process.argv.includes('--check')) {
  if (await readFile(output, 'utf8') !== contents) throw new Error('Big Chap ankle calibration is stale');
} else await writeFile(output, contents);
const summary = JSON.parse(measured);
console.log(JSON.stringify({ sourceSha256: summary.sourceSha256, supportVertices: summary.supportVertices,
  feet: summary.feet.map(foot => ({ name: foot.name, vertices: foot.vertexLevels.count, groups: foot.supports.length })) }));
