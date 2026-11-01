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
