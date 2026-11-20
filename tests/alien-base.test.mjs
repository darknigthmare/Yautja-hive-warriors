import test from 'node:test';
import assert from 'node:assert/strict';
import { ULTIMATE_YAUTJA_ARMORY, CHARACTERS_DATA, resolveAlienBaseIdentityV1 } from '../js/data/charactersData.js';
import { YAUTJA_ALIEN_BASE_V1, ALIEN_BASE_V2_CROSSREF_PREVIEW, getAlienBaseCrossReferencesV2 } from '../js/data/charactersData.js';
import { getAlienBaseRecord, ALIEN_BASE_REFERENCE_COUNTS, validateAlienBaseSnapshot } from '../js/data/AlienBaseRegistry.js';
test('all 36 Yautja weapons and gadgets resolve exactly',()=>{
 assert.equal(ULTIMATE_YAUTJA_ARMORY.length,36);
 for(const entry of ULTIMATE_YAUTJA_ARMORY){assert.ok(entry.sharedEntityId,entry.id);assert.equal(entry.sharedEntityId,resolveAlienBaseIdentityV1('armory',entry.id)?.id)}
});

test('local bindings remain unique and do not alias the public battle registry namespace',()=>{
 const ids=[...ULTIMATE_YAUTJA_ARMORY,...CHARACTERS_DATA].map(record=>record.sharedEntityId);
 assert.equal(new Set(ids).size,43);
 assert.equal(Object.keys(YAUTJA_ALIEN_BASE_V1.entities).length,43);
 for(const entry of ULTIMATE_YAUTJA_ARMORY){
   const publicRecord=getAlienBaseRecord('armory','yhw:armory:'+entry.id);
   assert.equal(publicRecord?.legacyId,entry.id);
   assert.equal(publicRecord.admission,'reference-only');
   assert.equal(publicRecord.visual1to1,false);
   assert.equal(getAlienBaseRecord('armory',entry.sharedEntityId),null);
 }
 assert.equal(ALIEN_BASE_REFERENCE_COUNTS.armory,36);
 assert.equal(validateAlienBaseSnapshot().valid,true);
});

test('documentary metadata cannot change JSON, object-spread or local save IDs',()=>{
 for(const entry of [...ULTIMATE_YAUTJA_ARMORY,...CHARACTERS_DATA]){
   const before=JSON.stringify(entry), localId=entry.id;
   const serialized=JSON.parse(before), copied={...entry};
   for(const field of ['sharedEntityId','sharedSourceRefsV2']){
     assert.equal(Object.hasOwn(serialized,field),false,entry.id+'/'+field);
     assert.equal(Object.hasOwn(copied,field),false,entry.id+'/'+field);
   }
   assert.throws(()=>{entry.sharedEntityId='forged';},TypeError);
   assert.equal(entry.id,localId);
   assert.equal(JSON.stringify(entry),before);
 }
});

test('v1 identity entries and bindings cannot be retargeted through nested references',()=>{
 const identity=resolveAlienBaseIdentityV1('characters','city_hunter');
 assert.throws(()=>{identity.id='character.yautja.jungle_hunter';},TypeError);
 assert.throws(()=>{YAUTJA_ALIEN_BASE_V1.groups.characters.city_hunter.id='forged';},TypeError);
 assert.throws(()=>{YAUTJA_ALIEN_BASE_V1.entities['character.yautja.city_hunter']={id:'forged'};},TypeError);
 assert.strictEqual(resolveAlienBaseIdentityV1('characters','city_hunter'),identity);
 assert.equal(identity.id,'character.yautja.city_hunter');
});

test('unknown, inherited and non-string keys cannot masquerade as source identities',()=>{
 const poison={toString(){throw Error('must not coerce lookup keys');}};
 for(const value of ['missing','__proto__','constructor','toString','hasOwnProperty',null,undefined,{},[],Symbol('key'),poison]){
   assert.equal(resolveAlienBaseIdentityV1(value,'jungle_hunter'),null);
   assert.equal(resolveAlienBaseIdentityV1('characters',value),null);
   assert.equal(resolveAlienBaseIdentityV1('armory',value),null);
   assert.deepEqual(getAlienBaseCrossReferencesV2(value),[]);
   assert.equal(Object.isFrozen(getAlienBaseCrossReferencesV2(value)),true);
 }
});

test('preview provenance remains deeply read-only and cannot become a canon certificate',()=>{
 const references=getAlienBaseCrossReferencesV2('character.yautja.jungle_hunter');
 assert.throws(()=>references.push({repository:'forged'}),TypeError);
 assert.throws(()=>{references[0].blobSha='forged';},TypeError);
 assert.throws(()=>{ALIEN_BASE_V2_CROSSREF_PREVIEW.references['character.yautja.jungle_hunter']=[];},TypeError);
 assert.throws(()=>{ALIEN_BASE_V2_CROSSREF_PREVIEW.status='canon-certified';},TypeError);
 assert.equal(ALIEN_BASE_V2_CROSSREF_PREVIEW.status,'unmerged-documentary-cross-references');
 for(const character of CHARACTERS_DATA)assert.equal(character.reference.fidelity1to1Verified,false);
});
test('the seven existing characters retain their stats and separate identities',()=>{
 assert.equal(CHARACTERS_DATA.length,7);
 for(const character of CHARACTERS_DATA)assert.equal(character.sharedEntityId,resolveAlienBaseIdentityV1('characters',character.id)?.id);
 assert.equal(CHARACTERS_DATA.find(e=>e.id==='jungle_hunter').stats.hp,1000);
 assert.equal(Object.keys(CHARACTERS_DATA[0]).includes('sharedEntityId'),false);
 assert.equal(resolveAlienBaseIdentityV1('armory','inexistent'),null);
});


test('Alien_base v2 preview adds 14 documentary sources to 12 existing identities without changing saved IDs', async()=>{
 const { ALIEN_BASE_V2_CROSSREF_PREVIEW, getAlienBaseCrossReferencesV2 }=await import('../js/data/charactersData.js');
 const records=[...ULTIMATE_YAUTJA_ARMORY,...CHARACTERS_DATA];
 assert.equal(records.length,43);
 const changed=records.filter(x=>x.sharedSourceRefsV2?.length);
 assert.equal(changed.length,12);
 assert.equal(changed.reduce((n,x)=>n+x.sharedSourceRefsV2.length,0),14);
 assert.equal(ALienBaseCount(),12);
 function ALienBaseCount(){return Object.keys(ALIEN_BASE_V2_CROSSREF_PREVIEW.references).length}
 for(const item of changed){
   assert.equal(Object.keys(item).includes('sharedSourceRefsV2'),false);
   assert.ok(item.sharedEntityId);
   assert.strictEqual(item.sharedSourceRefsV2,getAlienBaseCrossReferencesV2(item.sharedEntityId));
   for(const source of item.sharedSourceRefsV2){
     assert.ok(['darknigthmare/yautja-apex-hunt','darknigthmare/yautja-la-longue-chasse'].includes(source.repository));
     assert.match(source.blobSha,/^[a-f0-9]{40}$/);
     assert.ok(source.path&&source.localId);
   }
 }
 assert.equal(getAlienBaseCrossReferencesV2('nonexistent').length,0);
 assert.equal(CHARACTERS_DATA.find(x=>x.id==='jungle_hunter').stats.hp,1000);
 assert.equal(ALIEN_BASE_V2_CROSSREF_PREVIEW.status,'unmerged-documentary-cross-references');
});
