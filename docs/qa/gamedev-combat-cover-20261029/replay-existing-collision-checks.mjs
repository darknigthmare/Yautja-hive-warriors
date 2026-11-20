// Replay six unchanged, pinned CPU cases without loading the unrelated APC/WebGL fixture.
// The complete source suites and the APC case are deliberately outside this replay.
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import * as THREE from 'three';
import { traceCombatSegment, hasCombatLineOfSight } from '../../../js/engine/CombatGeometry.js';
import { traceSingleProjectileImpact } from '../../../js/engine/SingleProjectileImpact.js';
const root = fileURLToPath(new URL('../../../', import.meta.url));
const expected = [{"path":"js/engine/SingleProjectileImpact.js","sha":"40c5d11abf9c507fcc62e7e057760d8f81713920"},{"path":"tests/combat-geometry.test.js","sha":"480bd83c5bb135a4a91b51b6f9dfdc2e4544eee6"},{"path":"tests/runtime-final-wiring.test.js","sha":"cbc9b666d6d51edbb7497d9c4945bfe9aed51009"},{"path":"js/engine/CombatGeometry.js","sha":"b178b47897dd1538e1b71df2981d179a1c9fa96f"}];
for (const {path,sha} of expected) {
 const bytes=fs.readFileSync(root+path);
 const actual=crypto.createHash('sha1').update(Buffer.from('blob '+bytes.length+'\0')).update(bytes).digest('hex');
 assert.equal(actual,sha,'unchanged source '+path);
}
function blocks(source) {
 const starts=[...source.matchAll(/^test\(/gm)].map(match=>match.index);
 return starts.map((start,i)=>source.slice(start,starts[i+1]??source.length));
}
const geometry=fs.readFileSync(root+'tests/combat-geometry.test.js','utf8');
const definitions=geometry.slice(geometry.indexOf('const vec ='),geometry.indexOf("\ntest("));
const selected=blocks(geometry).filter(block=>!block.startsWith("test('APC rays"));
assert.equal(selected.length,5);
new Function('test','assert','THREE','traceCombatSegment','hasCombatLineOfSight',definitions+'\n'+selected.join('\n'))(test,assert,THREE,traceCombatSegment,hasCombatLineOfSight);
const runtime=fs.readFileSync(root+'tests/runtime-final-wiring.test.js','utf8');
const environment=runtime.slice(runtime.indexOf('const environment='),runtime.indexOf('\nfunction supportGame'));
const arrow=blocks(runtime).find(block=>block.startsWith("test('wooden arrow sweep"));
assert.ok(arrow);
new Function('test','assert','THREE','traceCombatSegment','hasCombatLineOfSight','traceSingleProjectileImpact',environment+'\n'+arrow)(test,assert,THREE,traceCombatSegment,hasCombatLineOfSight,traceSingleProjectileImpact);
