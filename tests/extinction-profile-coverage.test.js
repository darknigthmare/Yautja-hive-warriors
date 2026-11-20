import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { BATTLE_CATALOG_DATA } from '../js/data/BattleCatalogData.js';
import { EXTINCTION_SOURCE_COLS, ORIGINAL_EXTINCTION_CATALOG_COUNT, extinctionCSV } from '../scripts/export-extinction-fidelity-gaps.mjs';
import { BattleActorBridge } from '../js/battlefield/BattleActorBridge.js';
import { SPECIALIST_ATTACKS } from '../js/data/SourceSpecialistCombat.js';

// Source fields can contain quoted semicolons or newlines; matching the whole
// file can accidentally validate one profile using another profile's wording.
function extinctionRows(input) {
  const data=input.replace(/^\uFEFF/,'');let rows=[],row=[],cell='',quoted=false;
  for(let i=0;i<data.length;i++){
    const c=data[i];
    if(c==='"'){
      if(quoted&&data[i+1]==='"'){cell+='"';i++;}
      else quoted=!quoted;
    }else if(c===';'&&!quoted){row.push(cell);cell='';}
    else if(c==='\n'&&!quoted){
      row.push(cell.replace(/\r$/,''));rows.push(row);row=[];cell='';
    }else cell+=c;
  }
  assert.equal(quoted,false,'all quoted source cells must terminate');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const columns=rows.shift();assert.deepEqual(columns,EXTINCTION_SOURCE_COLS);
  return rows.map(values=>{
    assert.equal(values.length,columns.length,'each profile owns one complete source record');
    return Object.fromEntries(columns.map((column,index)=>[column,values[index]]));
  });
}

test('all Extinction source profiles are covered without claiming source visual parity',()=>{
  const profiles=BATTLE_CATALOG_DATA.profiles.filter(p=>/Extinction/i.test(p.work??''));
  assert.equal(profiles.length,ORIGINAL_EXTINCTION_CATALOG_COUNT);
  const source=extinctionCSV();
  assert.ok(source.startsWith('\uFEFF'));
  const rows=extinctionRows(source),byId=new Map(rows.map(row=>[row.Identifiant,row]));
  assert.equal(rows.length,profiles.length);assert.equal(byId.size,profiles.length);
  for(const p of profiles){
    const record=byId.get(p.id);assert.ok(record,'source profile '+p.id+' is missing');
    assert.ok(p.missingWork,'each unfinished profile retains a concrete next step');
    assert.equal(record['Fidélité visuelle 1:1 certifiée'],'non');
    assert.equal(record['Statut audit source (historique)'],p.codeStatus??'',
      'current mechanics must not rewrite the retained historical source finding');
  }
  const file=readFileSync(new URL('../docs/audits/2026-11-01/Extinction_29_Profils_Manquants_1to1.csv',import.meta.url),'utf8');
  assert.equal(source,file,'Excel export and source catalogue must stay synchronized');
});

test('Carrier/Ravager materialize only as source-scoped partial runtimes, never 1:1 visual assets',()=>{
  const profiles=BATTLE_CATALOG_DATA.profiles.filter(p=>['XEN-009','XEN-010'].includes(p.id));
  assert.deepEqual(profiles.map(p=>p.name),['Carrier','Ravager']);
  for(const [index,profile] of profiles.entries()){
    const type=index?'ravager':'carrier';
    const config={id:'AFF-27',groups:[{units:[{profileId:profile.id}]}],
      profiles:[{id:profile.id,species:'xeno',actorType:type}]};
    assert.deepEqual(BattleActorBridge.unsupportedProfiles(config),[],
      'the exact Extinction source profile is supported on LV-742 only');
    assert.deepEqual(BattleActorBridge.unsupportedProfiles({...config,id:'AFF-14'}),
      [profile.id], 'a Dark Descent mission cannot inherit Extinction castes');
    const record=extinctionRows(extinctionCSV()).find(row=>row.Identifiant===profile.id);
    assert.equal(record['Fidélité visuelle 1:1 certifiée'],'non',
      'partial source mechanics must not certify the visual assets of either caste');
    assert.ok(record['État du runtime actuel (contrôle de code)'].length>20);

  }
});

test('real Medic/CommTech specialist mechanics exist but do not imply exact models',()=>{
  assert.ok(SPECIALIST_ATTACKS.medic&&SPECIALIST_ATTACKS.commtech);
  const c=extinctionCSV();
  assert.match(c,/HUM-037[^\r\n]*applyMedicHeal/);
  assert.match(c,/HUM-038[^\r\n]*applyCommTechRepair/);
  assert.match(c,/YAU-034[^\r\n]*clan_hunter/);
});
