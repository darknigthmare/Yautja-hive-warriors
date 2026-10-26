import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BadBloodManager } from '../js/entities/BadBloodEncounter.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';

const audio=new Proxy({}, {get:()=>()=>{}});
class CPUEncounter extends BadBloodManager { createBadBloodMesh(){return new THREE.Group();} }
const fighter=x=>({hp:1000,position:new THREE.Vector3(x,0,0),mesh:new THREE.Group(),trophies:[],recordTrophy(...entry){this.trophies.push(entry);},takeDamage(amount){this.hp-=amount;}});

test('the cooperative duel stays bound to its participant and emits only one centrally scored death',()=>{
  const manager=new CPUEncounter(new THREE.Scene(),audio), ledger=new CombatEvents({runId:'duel'}), p1=fighter(30),p2=fighter(0),game={score:0,sessionSkulls:0};
  manager.combatEvents=ledger;manager.centralDeathScoring=true;manager.spawnAmbush(p2.position);manager.badBlood.hp=600;manager.startHonorDuel(p2);
  const timer=manager.duelTimer;manager.update(0,p1);assert.equal(manager.duelTimer,timer);
  for(const key of ['KeyF','Space','KeyE'])assert.equal(manager.handleDuelInput(key,p1,null,null,null,game),true);
  assert.equal(manager.badBlood,null);assert.equal(manager.isDueling,false);assert.equal(game.score,0);assert.equal(game.sessionSkulls,0);
  assert.equal(p1.trophies.length,0);assert.equal(p2.trophies.length,0);
  assert.equal(ledger.getSnapshot().deaths.length,1);assert.equal(ledger.getSnapshot().deaths[0].honorValue,3000);
  assert.equal(manager.handleDuelInput('KeyE',p2,null,null,null,game),false);assert.equal(ledger.getSnapshot().deaths.length,1);
});

test('losing a duel participant cancels its UI state, and raw lethal encounter damage is harvested once',()=>{
  const manager=new CPUEncounter(new THREE.Scene(),audio), ledger=new CombatEvents({runId:'duel-cancel'}),p1=fighter(30),p2=fighter(0);
  manager.combatEvents=ledger;manager.spawnAmbush(p2.position);manager.startHonorDuel(p2);p2.hp=0;
  manager.update(1/60,p1);assert.equal(manager.isDueling,false);assert.equal(manager.duelTarget,null);assert.equal(p1.hp,1000);
  manager.badBlood.hp=0;manager.update(1/60,p1);manager.update(1/60,p1);
  assert.equal(manager.badBlood,null);assert.equal(manager.isActive,false);assert.equal(ledger.getSnapshot().deaths.length,1);
});
