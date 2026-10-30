import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { getBattleOperationConfig, BATTLE_OPERATIONS } from '../js/data/BattleCatalog.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { sourceUnitVisualKind } from '../js/data/SourceActorPresentation.js';
import { initialSpecialistStocks, restoreSpecialistStocks, SPECIALIST_ATTACKS } from '../js/data/SourceSpecialistCombat.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { applyBattleSplashDamage } from '../js/engine/BattleActorSupport.js';

const make = () => new BattleSimulation(getBattleOperationConfig('AFF-27'));
const find = (sim, role) => [...sim.units.values()].find(unit => sourceUnitVisualKind(unit) === role);
const active = (...units) => { for (const unit of units) unit.state = 'active'; };
const close = (leader, patient, distance = 3) => { patient.position = [leader.position[0] + distance, leader.position[1]]; };

test('role supplies belong only to allocated Extinction specialists, not arbitrary Marine IDs', () => {
  const sim = make();
  try {
    for (const [role, field, amount] of [['commtech','repairParts',3],['sniper','sniperRounds',6],
      ['sadar','sadarMissiles',4],['exosuit','exosuitArmor',100]]) {
      const unit = find(sim, role);
      assert.ok(unit, role);
      assert.equal(unit[field], amount);
      assert.deepEqual(initialSpecialistStocks(unit), { [field]: amount });
    }
    const marine = [...sim.units.values()].find(unit => unit.actorType === 'marine' && !sourceUnitVisualKind(unit));
    assert.deepEqual(initialSpecialistStocks(marine), {});
    assert.throws(() => restoreSpecialistStocks({ ...marine, sadarMissiles: 4 }, marine), /Unexpected specialist stock/);
  } finally { sim.dispose(); }
});

test('SADAR and Sniper ammunition can be spent once per shot and never restock by reprising detail', () => {
  const sim = make();
  try {
    const sniper = find(sim,'sniper'), sadar = find(sim,'sadar');
    assert.equal(sim.consumeSpecialistAmmo(sniper.id,'sniper'), null, 'cannot fire a distant unmaterialized soldier');
    active(sniper,sadar);
    assert.equal(sim.consumeSpecialistAmmo(sadar.id,'sniper'), null);
    for(let i=5;i>=0;i--) assert.equal(sim.consumeSpecialistAmmo(sniper.id,'sniper')?.roundsRemaining,i);
    for(let i=3;i>=0;i--) assert.equal(sim.consumeSpecialistAmmo(sadar.id,'sadar')?.roundsRemaining,i);
    assert.equal(sim.consumeSpecialistAmmo(sniper.id,'sniper'),null);
    assert.equal(sim.consumeSpecialistAmmo(sadar.id,'sadar'),null);
    sniper.state=sadar.state='distant';
    const saved=sim.saveState(), resumed=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{ assert.equal(resumed.getUnit(sniper.id).sniperRounds,0);assert.equal(resumed.getUnit(sadar.id).sadarMissiles,0);}
    finally{resumed.dispose();}
  } finally { sim.dispose(); }
});

test('CommTech repairs existing synthetics and the single Exosuit, never human riflemen or foes', () => {
  const sim = make();
  try{
    const tech=find(sim,'commtech'), exo=find(sim,'exosuit');
    const machine=[...sim.units.values()].find(unit=>unit.species==='synthetic'&&unit.factionId===tech.factionId);
    const rifleman=[...sim.units.values()].find(unit=>unit.species==='human'&&unit.factionId===tech.factionId&&!sourceUnitVisualKind(unit));
    assert.ok(machine);assert.ok(rifleman);
    active(tech,exo,machine,rifleman);
    machine.hp-=110;exo.hp-=90;rifleman.hp-=70;
    close(tech,machine);close(tech,exo);close(tech,rifleman);
    assert.equal(sim.applyCommTechRepair(tech.id,rifleman.id),null);
    assert.equal(sim.applyCommTechRepair(tech.id,machine.id)?.amount,100);
    assert.equal(sim.applyCommTechRepair(tech.id,exo.id)?.amount,90);
    assert.equal(tech.repairParts,1);
    machine.hp-=40;machine.position=[tech.position[0]+20,tech.position[1]];
    assert.equal(sim.applyCommTechRepair(tech.id,machine.id),null);
    machine.position=[tech.position[0]+2,tech.position[1]];
    machine.incapacitated=true;
    assert.equal(sim.applyCommTechRepair(tech.id,machine.id),null);
    machine.incapacitated=false;
    assert.equal(sim.applyCommTechRepair(tech.id,machine.id)?.amount,40);
    assert.equal(sim.applyCommTechRepair(tech.id,machine.id),null);
    assert.equal(tech.repairParts,0);
  }finally{sim.dispose();}
});

test('Exosuit armor absorbs finite damage and survives save/reload with one pilot identity', () => {
  const sim=make();
  try{
    const exo=find(sim,'exosuit'); active(exo);
    assert.equal(sim.absorbExosuitDamage(exo.id,60),30);
    assert.equal(exo.exosuitArmor,70);
    assert.equal(sim.absorbExosuitDamage(exo.id,120),60);
    assert.equal(exo.exosuitArmor,10);
    assert.equal(sim.absorbExosuitDamage(exo.id,80),70);
    assert.equal(exo.exosuitArmor,0);
    assert.equal(sim.absorbExosuitDamage(exo.id,60),60);
    exo.state='distant';
    const saved=sim.saveState();
    const restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{assert.equal(restored.getUnit(exo.id).exosuitArmor,0);}finally{restored.dispose();}
    const corrupt=structuredClone(saved);
    corrupt.units.find(unit=>unit.id===exo.id).exosuitArmor=300;
    assert.throws(()=>BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),corrupt),/invalid saved specialist stock/);
  }finally{sim.dispose();}
});

test('old checkpoints without special supplies resume at zero, not a fresh kit',()=>{
  const sim=make();
  try{
    const saved=sim.saveState();
    for(const unit of saved.units)for(const field of ['repairParts','sniperRounds','sadarMissiles','exosuitArmor'])
      delete unit[field];
    const restored=BattleSimulation.fromState(getBattleOperationConfig('AFF-27'),saved);
    try{
      for(const [role,field] of [['commtech','repairParts'],['sniper','sniperRounds'],['sadar','sadarMissiles'],['exosuit','exosuitArmor']])
        assert.equal(find(restored,role)[field],0);
    }finally{restored.dispose();}
  }finally{sim.dispose();}
});

test('SADAR launched from a materialized Marine takes time, stays finite and damages hostiles only',()=>{
  const scene=new THREE.Scene(), manager=new ColonialMarinesManager(scene,{});
  const owner={factionId:'human_force',mesh:new THREE.Group(),hp:150,battleUnitId:'owner'};
  const target={factionId:'hive',mesh:new THREE.Group(),hp:220,maxHp:220,radius:1};
  target.mesh.position.set(0,0,10);
  const other={factionId:'hive',mesh:new THREE.Group(),hp:220,maxHp:220,radius:1};
  other.mesh.position.set(1.5,0,10.2);
  const friend={factionId:'human_force',mesh:new THREE.Group(),hp:220,maxHp:220,radius:1};
  friend.mesh.position.set(1.2,0,10.3);
  for(const actor of [target,other,friend])actor.combatManager=manager;
  manager.battleSimulation={areHostile:(a,b)=>a!==b};
  manager.environment={hasLineOfSight:()=>true};
  manager.combatActorsProvider=()=>[target,other,friend];
  const direct={isBattleNPC:true,actor:target,get hp(){return target.hp;},
    get position(){return target.mesh.position;},
    takeDamage(amount){target.hp-=amount;}};
  try{
    manager.queueSadarMissile(owner,direct,false,null);
    assert.equal(manager.specialistMissiles.length,1);
    assert.equal(target.hp,220,'the impact must not be instantaneous');
    for(let i=0;i<100&&manager.specialistMissiles.length;i++)manager.updateSpecialistMissiles(.05);
    assert.equal(manager.specialistMissiles.length,0);
    assert.ok(target.hp<220);
    assert.ok(other.hp<220);
    assert.equal(friend.hp,220);
    assert.ok(SPECIALIST_ATTACKS.sadar.splashRadius<5);
    manager.environment={hasLineOfSight:()=>false};
    const hp=target.hp;
    manager.queueSadarMissile(owner,direct,false,null);
    manager.updateSpecialistMissiles(.05);
    assert.equal(target.hp,hp,'wall-blocked missile cannot impact');
    assert.equal(manager.specialistMissiles.length,0);
  }finally{manager.clearSquad();}
});

test('splash respects individual wall cover, ownership, dead targets and duplicate candidates',()=>{
  const owner={factionId:'human_force'};
  const creature=(x,faction='hive')=>({factionId:faction,hp:120,maxHp:120,mesh:new THREE.Group(),radius:.8});
  const direct=creature(0), open=creature(2), wall=creature(3), friendly=creature(1,'human_force');
  direct.mesh.position.set(0,0,.4);open.mesh.position.set(2,0,0);wall.mesh.position.set(3,0,0);friendly.mesh.position.set(1,0,0);
  const manager={battleSimulation:{areHostile:(a,b)=>a!==b},
    environment:{hasLineOfSight:(_origin,destination)=>destination.x!==3},
    combatActorsProvider:()=>[direct,open,open,wall,friendly]};
  const result=applyBattleSplashDamage(manager,owner,new THREE.Vector3(0,0,0),
    {radius:4,damage:25,exclude:direct});
  assert.equal(result.length,1);
  assert.ok(open.hp<120);
  assert.equal(wall.hp,120);assert.equal(friendly.hp,120);assert.equal(direct.hp,120);
});

test('offscreen fronts consume the same finite rounds and plate buffer as close combat',()=>{
  const sim=make();
  try {
    const sniper=find(sim,'sniper'),sadar=find(sim,'sadar'),exosuit=find(sim,'exosuit');
    const xeno=[...sim.units.values()].find(unit=>unit.species==='xenomorph');
    assert.ok(sniper&&sadar&&exosuit&&xeno);
    // Isolate one front's attacker/defender while keeping all unit IDs intact.
    for(const unit of sim.units.values())unit.state='reserve';
    sniper.state='distant';sadar.state='distant';xeno.state='distant';xeno.hp=10000;xeno.maxHp=10000;
    sniper.nextAttack=0;sadar.nextAttack=0;xeno.nextAttack=1e9;
    const front=[...sim.fronts.values()][0];
    for(const id of new Set([sniper.groupId,sadar.groupId,exosuit.groupId,xeno.groupId])){
      const group=sim.groups.get(id);
      group.frontId=front.id;group.position=[...front.position];group.path=[];
      group.order={type:'attack',frontId:front.id,issuer:'test'};group.reconstitution=null;
    }
    for(let shot=0;shot<6;shot++){
      sim.time=10+shot*4;sim._remoteCombat();
      assert.equal(sniper.sniperRounds,5-shot);
      assert.equal(sadar.sadarMissiles,Math.max(0,3-shot));
    }
    const hp=xeno.hp;sim.time=40;sim._remoteCombat();
    assert.equal(sniper.sniperRounds,0);
    assert.equal(sadar.sadarMissiles,0);
    assert.equal(xeno.hp,hp,'neither weapon can fire when offscreen ammunition is exhausted');
    sniper.state=sadar.state='reserve';exosuit.state='distant';xeno.nextAttack=0;
    exosuit.hp=exosuit.maxHp;sim.time=100;
    const armor=exosuit.exosuitArmor;
    sim._remoteCombat();
    assert.ok(exosuit.exosuitArmor<armor,'offscreen Exosuit loses armor');
    assert.ok(exosuit.hp<exosuit.maxHp,'armor does not make the unit invulnerable');
  }finally{sim.dispose();}
});

test('no additional soldiers, bosses or backups arise from source specialist activation',()=>{
  for(const operation of BATTLE_OPERATIONS){
    const newConfig=getBattleOperationConfig(operation.id,{allowHumanController:true});
    const oldConfig=getBattleOperationConfig(operation.id,{allowHumanController:true,rosterDetail:'legacy'});
    assert.deepEqual(newConfig.budgets,oldConfig.budgets,operation.id);
    assert.deepEqual(newConfig.groups.map(g=>g.units.map(u=>u.id)),
      oldConfig.groups.map(g=>g.units.map(u=>u.id)),operation.id);
  }
});
