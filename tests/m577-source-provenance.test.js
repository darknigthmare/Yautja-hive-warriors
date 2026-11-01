import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { APC_SECTION_RULES } from '../js/battlefield/APCSectionManifest.js';
import { APC_RUNNING_GEAR } from '../js/graphics/APCModel.js';
import { M577_DRIVE_POLICY } from '../js/battlefield/APCConvoyDrive.js';

// This is a SOURCE COVERAGE gate, not a runtime screenshot/1:1 proof.
const file=new URL('../docs/audits/2026-11-01/M577_Cheyenne_Exigences_Sources.csv',import.meta.url);
function parseSemicolonCSV(input) {
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
  if(quoted)throw new Error('Malformed quoted source matrix');
  if(cell||row.length){row.push(cell);rows.push(row);}
  const columns=rows.shift();
  if(!columns||columns.length!==8)throw new Error('Missing M577 source columns');
  return rows.map(row=>{
    if(row.length!==columns.length)throw new Error('Broken source CSV row');
    return Object.fromEntries(columns.map((column,index)=>[column,row[index]]));
  });
}
const rows=parseSemicolonCSV(readFileSync(file,'utf8'));
const byId=new Map(rows.map(row=>[row.ID,row]));

test('all fourteen sourced APC/Cheyenne gaps retain unique IDs and honest unverified visual status',()=>{
  assert.equal(rows.length,14);
  assert.equal(byId.size,rows.length);
  for(let i=1;i<=14;i++){
    const id='M577-'+String(i).padStart(3,'0'),entry=byId.get(id);
    assert.ok(entry,'source contract '+id+' is missing');
    assert.ok(entry['Exigence de référence'].length>8);
    assert.ok(entry['Implémentation constatée'].length>5);
    assert.ok(entry['Manquants'].length>10);
    assert.equal(entry['Visuel 1:1 certifié'],'non',
      'a source citation and a procedural mesh never prove exact licensed geometry');
    if(entry['Type de source']!=='Concept original Yautja Hive Warrior')
      assert.match(entry['Lien de référence'],/^https:\/\//);
  }
});

test('source-declared 2+12 slots and four wheels agree with the finite implemented M577',()=>{
  assert.equal(APC_SECTION_RULES.crewPositions,2);
  assert.equal(APC_SECTION_RULES.passengerSeats,12);
  assert.equal(APC_RUNNING_GEAR.wheelCount,4);
  assert.match(byId.get('M577-001')['Exigence de référence'],/2.*12/);
  assert.match(byId.get('M577-002')['Exigence de référence'],/Quatre roues/);
  assert.equal(APC_RUNNING_GEAR.visualFidelity1to1Verified,false);
});

test('source registry keeps original acceleration and missing Cheyenne cargo separate from 1:1 claims',()=>{
  assert.ok(M577_DRIVE_POLICY.acceleration>0);
  assert.equal(M577_DRIVE_POLICY.visualFidelity1to1Verified,false);
  assert.match(byId.get('M577-003')['Manquants'],/km\/h/);
  assert.match(byId.get('M577-011')['Manquants'],/arrimage/);
  assert.equal(byId.get('M577-011')['Visuel 1:1 certifié'],'non');
});
