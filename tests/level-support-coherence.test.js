import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { sectorSupportPlan, hunterEncounterProvenance } from '../js/data/LevelEncounterPolicy.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
const GameApp=vm.runInNewContext(`${source.slice(source.indexOf('class GameApp'),source.indexOf("window.addEventListener('DOMContentLoaded'"))};GameApp`,{THREE,sectorSupportPlan});
function fixture(levelId,index){
  const game=Object.create(GameApp.prototype), calls={};
  Object.assign(game,{
    ui:{selectedLevel:{id:levelId},showAnnouncement(){}},player:null,player2:null,
    combatDirector:{reset(){}},
    env:{getSectorAt(){return null;},resolveMovement(){}},
    allies:{allies:[],spawnSquad(position,count){calls.allies=count;}},
    marines:{marines:[],clearSquad(){calls.marines=0;},spawnSquad(position,count){calls.marines=count;}},
    synthetics:{androids:[],spawnSquad(position,count){calls.synthetics=count;}},
    badBlood:{clear(){}},weather:{spawnGasPipes(count){calls.gasPipes=count;}},
    clearAPCSupport(){calls.apc=false;},spawnAPCSupport(){calls.apc=true;},
    scheduleMissionTask(){},skimmer:{isMounted:false,spawnAt(){}}
  });
  game.enterBattlefieldSector({id:'sector',index,center:[0,0],objective:{type:'clear'}});
  return calls;
}

test('actual sector router never imports future USCM, synths or industrial pipes into historical forest hunts',()=>{
  for(const levelId of ['val_verde_jungle','prey_comanche_territory','gunnison_forest','game_preserve_planet']){
    for(const index of [0,1,3,5]){
      const calls=fixture(levelId,index);
      assert.equal(calls.marines,0,levelId);assert.equal(calls.synthetics,0,levelId);
      assert.equal(calls.gasPipes,0,levelId);assert.equal(calls.apc,false,levelId);
      assert.equal(calls.allies,index===0?0:1);
    }
  }
});

test('actual future sector router preserves finite future support and its delayed opening',()=>{
  for(const id of ['charon_rogue_base','romulus_station','xenomorph_prime']){
    const opening=fixture(id,0);assert.equal(opening.marines,0);assert.equal(opening.synthetics,0);assert.equal(opening.apc,false);
    const later=fixture(id,3);assert.equal(later.marines,2);assert.equal(later.synthetics,2);assert.equal(later.apc,true);
    const next=fixture(id,4);assert.equal(next.apc,false);
  }
  assert.equal(fixture('stargazer_facility',1).gasPipes,4);
  assert.equal(fixture('stargazer_facility',1).marines,0);
});

test('all eleven location plans and unknown contexts are conservative; named self duels are explicitly alternative',()=>{
  for(const level of LEVELS_DATA){
    const plan=sectorSupportPlan(level.id,0);assert.equal(plan.allies+plan.marines+plan.synthetics,0);assert.equal(Object.isFrozen(plan),true);
  }
  assert.equal(sectorSupportPlan('unknown',3).apc,false);
  assert.equal(sectorSupportPlan('romulus_station',NaN).marines,0);
  for(const [hunter,boss] of [['feral_predator','feral_predator_boss'],['city_hunter','city_hunter_boss'],['jungle_hunter','jungle_hunter_boss']]){
    assert.match(hunterEncounterProvenance(hunter,boss),/DUEL ALTERNATIF/);
    assert.equal(hunterEncounterProvenance('wolf_predator',boss),null);
  }
});
