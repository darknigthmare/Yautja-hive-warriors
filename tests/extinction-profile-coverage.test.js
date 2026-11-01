import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BATTLE_CATALOG_DATA } from '../js/data/BattleCatalogData.js';
import { ORIGINAL_EXTINCTION_CATALOG_COUNT, extinctionCSV } from '../scripts/export-extinction-fidelity-gaps.mjs';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { SPECIALIST_ATTACKS } from '../js/data/SourceSpecialistCombat.js';

test('all Extinction source profiles are covered without claiming source visual parity',()=>{
  const profiles=BATTLE_CATALOG_DATA.profiles.filter(p=>/Extinction/i.test(p.work??''));
  assert.equal(profiles.length,ORIGINAL_EXTINCTION_CATALOG_COUNT);
  const source=extinctionCSV();
  assert.ok(source.startsWith('\uFEFF'));
  for(const p of profiles){
    assert.ok(source.includes('"'+p.id+'";'));
    assert.ok(p.missingWork,'each unfinished profile retains a concrete next step');
  }
  assert.equal((source.match(/;"non"\r\n/g)??[]).length,profiles.length);
  const file=readFileSync(new URL('../docs/audits/2026-11-01/Extinction_29_Profils_Manquants_1to1.csv',import.meta.url),'utf8');
  assert.equal(source,file,'Excel export and source catalogue must stay synchronized');
});

test('Carrier/Ravager are documented source units, not falsely declared playable 1:1',()=>{
  const profiles=BATTLE_CATALOG_DATA.profiles.filter(p=>['XEN-009','XEN-010'].includes(p.id));
  assert.deepEqual(profiles.map(p=>p.name),['Carrier','Ravager']);
  for(const [index,profile] of profiles.entries()){
    const type=index?'ravager':'carrier';
    const config={groups:[{units:[{profileId:profile.id}]}],
      profiles:[{id:profile.id,species:'xeno',actorType:type}]};
    assert.deepEqual(BattleActorBridge.unsupportedProfiles(config),[profile.id],
      'a catalogue profile is not a materialized combat unit');
    assert.match(extinctionCSV(),new RegExp('"'+profile.id+'";[^\r\n]*ABSENTS'));
  }
});

test('real Medic/CommTech specialist mechanics exist but do not imply exact models',()=>{
  assert.ok(SPECIALIST_ATTACKS.medic&&SPECIALIST_ATTACKS.commtech);
  const c=extinctionCSV();
  assert.match(c,/HUM-037[^\r\n]*applyMedicHeal/);
  assert.match(c,/HUM-038[^\r\n]*applyCommTechRepair/);
  assert.match(c,/YAU-034[^\r\n]*clan_hunter/);
});
