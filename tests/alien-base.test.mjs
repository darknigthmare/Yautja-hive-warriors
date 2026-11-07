import test from 'node:test';
import assert from 'node:assert/strict';
import { ULTIMATE_YAUTJA_ARMORY, CHARACTERS_DATA, resolveAlienBaseIdentityV1 } from '../js/data/charactersData.js';
test('all 36 Yautja weapons and gadgets resolve exactly',()=>{
 assert.equal(ULTIMATE_YAUTJA_ARMORY.length,36);
 for(const entry of ULTIMATE_YAUTJA_ARMORY){assert.ok(entry.sharedEntityId,entry.id);assert.equal(entry.sharedEntityId,resolveAlienBaseIdentityV1('armory',entry.id)?.id)}
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
