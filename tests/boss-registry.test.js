import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BOSS_REGISTRY, getBossDefinition, bossAllowedInLevel, bossCanAttack } from '../js/data/BossRegistry.js';
import { BossManager } from '../js/entities/Bosses.js';
import { CombatEvents } from '../js/engine/CombatEvents.js';
const audio = new Proxy({}, { get: () => () => {} });
class CPUManager extends BossManager { createBossMesh() { return new THREE.Group(); } }
const player = position => ({ hp:10000, position:new THREE.Vector3(...position), mesh:new THREE.Group(), plasmaEnergy:100,
  radius:1.2, hits:[], takeDamage(amount,acid,attacker,context) { this.hp-=amount; this.hits.push({amount,acid,type:attacker?.type,...context}); } });

test('boss IDs, contexts and attack biology are explicit; an unknown ID cannot erase an encounter', () => {
  assert.equal(getBossDefinition('queen').id,'xenomorph_queen');
  assert.throws(()=>getBossDefinition('__proto__'),/Unknown/);
  for (const definition of Object.values(BOSS_REGISTRY)) { assert.equal(definition.ordinarySpawn,false); assert.equal(definition.unique,true); assert.ok(definition.hp>0); }
  assert.equal(bossCanAttack('feral_predator_boss','spit'),false); assert.equal(bossCanAttack('feral_predator_boss','tail'),false);
  assert.equal(bossAllowedInLevel('feral_predator_boss','prey_comanche_territory'),true);
  assert.equal(bossAllowedInLevel('feral_predator_boss','romulus_station'),false);
  assert.equal(bossAllowedInLevel('feral_predator_boss','romulus_station',{mode:'crossover'}),true);
  assert.equal(bossAllowedInLevel('feral_predator_boss','romulus_station',{mode:'adaptation'}),true);
  const manager=new CPUManager(new THREE.Scene(),audio);manager.spawnBoss('feral_predator_boss',new THREE.Vector3());
  const original=manager.activeBoss;assert.throws(()=>manager.spawnBoss('missing_boss',new THREE.Vector3()),/Unknown/);
  assert.equal(manager.activeBoss.type,original.type);manager.clear();
});

test('each actual boss builder is finite and normalized to its documented game-unit height', () => {
  const manager=new BossManager(new THREE.Scene(),audio);
  for(const definition of Object.values(BOSS_REGISTRY)) {
    manager.spawnBoss(definition.id,new THREE.Vector3());manager.activeBoss.mesh.updateMatrixWorld(true);
    const box=new THREE.Box3().setFromObject(manager.activeBoss.mesh,true);
    assert.ok(Math.abs(box.max.y-box.min.y-definition.height)<1e-4,definition.id);
    assert.ok([...box.min.toArray(),...box.max.toArray()].every(Number.isFinite),definition.id);
    assert.equal(manager.activeBoss.hp,definition.hp);manager.clear();
  }
});

test('mask reorientation is a signal: only the later physical bolt can hurt Feral', () => {
  const manager=new CPUManager(new THREE.Scene(),audio), target=player([15,0,0]);
  manager.spawnBoss('feral_predator_boss',new THREE.Vector3());const boss=manager.activeBoss;
  assert.equal(manager.spitAcidMortar(target),false);assert.equal(manager.triggerTailWhip(target),false);
  assert.equal(manager.armFeralMaskTrap(new THREE.Vector3(4,0,3)),true);assert.equal(boss.hp,boss.maxHp);
  manager.fireBossWeapon(target,'bolt');assert.equal(boss.hp,boss.maxHp);assert.equal(target.hits.length,0);
  for(let frame=0;frame<10;frame++)manager.update(1/60,target);
  assert.equal(boss.hp,boss.maxHp,'the signal itself has no damage, even after several frames');
  for(let frame=0;frame<60;frame++)manager.update(1/60,target);
  assert.equal(boss.hp,boss.maxHp-1200);assert.equal(manager.acidSpitProjectiles.length,0);manager.clear();
});

test('a warned bolt commits to its trajectory and a lateral dodge avoids it', () => {
  const manager=new CPUManager(new THREE.Scene(),audio), target=player([15,0,0]);manager.spawnBoss('feral_predator_boss',new THREE.Vector3());
  manager.fireBossWeapon(target,'bolt');target.position.z=8;
  for(let frame=0;frame<180;frame++) { manager.activeBoss.isStunned=true;manager.activeBoss.stunTimer=10;manager.update(1/60,target); }
  assert.equal(target.hits.length,0);assert.equal(manager.weaponProjectiles.length,0);manager.clear();
});

test('boss damage routes typed counters and terminal events exactly once', () => {
  const manager=new CPUManager(new THREE.Scene(),audio), target=player([2,0,0]), ledger=new CombatEvents({runId:'queen'});manager.combatEvents=ledger;
  manager.spawnBoss('xenomorph_queen',new THREE.Vector3());const queen=manager.activeBoss;
  target.isBlocking=true;manager.triggerTailWhip(target);assert.equal(target.hits[0].blockable,false);assert.equal(target.hits[0].parryable,false);
  const death=manager.takeDamage(1e9);assert.equal(queen.hp,0);assert.equal(death.entityId,ledger.getSnapshot().deaths[0].entityId);
  assert.equal(manager.takeDamage(1e9),null);assert.equal(ledger.getSnapshot().deaths.length,1);assert.equal(manager.activeBoss,null);
  manager.spawnBoss('city_hunter_boss',new THREE.Vector3());manager.applyBossDamage(target,30,'melee');assert.equal(target.hits.at(-1).parryable,true);manager.clear();
});

test('pending broods, projectiles and shockwaves use simulation time and release on cleanup', () => {
  const scene=new THREE.Scene(), manager=new CPUManager(scene,audio), target=player([20,0,0]);let births=0;
  const horde={spawnChestburster(){births++;}};
  manager.spawnBoss('predalien_queen',new THREE.Vector3());manager.triggerPregnantBurstFrenzy(horde);
  manager.update(0,target,horde);assert.equal(births,0);manager.clear();
  manager.update(10,target,horde);assert.equal(births,0);assert.equal(scene.children.length,0);
  manager.spawnBoss('feral_predator_boss',new THREE.Vector3());manager.fireBossWeapon(target);manager.clear();assert.equal(scene.children.length,0);
});

test('a real low-health execution bypasses residual armor, and duplicate or distant requests cannot kill', () => {
  const manager = new CPUManager(new THREE.Scene(),audio), target = player([2,0,0]), ledger = new CombatEvents({runId:'execution'});
  manager.combatEvents = ledger; manager.spawnBoss('awakened_engineer',new THREE.Vector3());
  const victim = manager.activeBoss; victim.hasPhaseShield = true; victim.phaseShieldHp = 1800;
  assert.equal(manager.executeBoss(victim,{player:target}),null,'a full-health enemy has no execution window');
  victim.hp = victim.maxHp * .25; target.position.x=12;
  assert.equal(manager.executeBoss(victim,{player:target}),null,'a distant execution cannot bypass the approach');
  target.position.x=2;
  const event = manager.executeBoss(victim,{player:target});
  assert.equal(event.cause,'execution'); assert.equal(victim.hp,0); assert.equal(victim.phaseShieldHp,0); assert.equal(manager.activeBoss,null);
  assert.equal(manager.executeBoss(victim,{player:target}),null); assert.equal(ledger.getSnapshot().deaths.length,1);
});

test('a physical wall stops the Feral bolt before its target and lethal boss culls remain one death', () => {
  const manager=new CPUManager(new THREE.Scene(),audio), target=player([15,0,0]), ledger=new CombatEvents({runId:'covered-boss'});
  manager.combatEvents=ledger;
  manager.spawnBattleUnit({id:'queen-allocated',sourceBossType:'xenomorph_queen',factionId:'hive',hp:3000,maxHp:3000,position:[0,0]});
  const queen=manager.activeBoss; assert.equal(queen.type,'xenomorph_queen'); assert.equal(queen.hp,3000);
  queen.hp=0; manager.despawnBattleUnit('queen-allocated'); assert.equal(ledger.getSnapshot().deaths.length,1); assert.equal(manager.activeBoss,null);
  manager.spawnBoss('feral_predator_boss',new THREE.Vector3());
  manager.environment={traceSegment(from,to){if(from.x < 4 && to.x >= 4)return {point:from.clone().lerp(to,(4-from.x)/(to.x-from.x)),t:(4-from.x)/(to.x-from.x)};return null;},hasLineOfSight:()=>false};
  manager.fireBossWeapon(target,'bolt'); manager.activeBoss.isStunned=true; manager.activeBoss.stunTimer=10;
  for(let frame=0;frame<90;frame++)manager.update(1/60,target);
  assert.equal(target.hits.length,0); assert.equal(manager.weaponProjectiles.length,0); manager.clear();
});

test('a prepared Feral leap has an airborne arc, commits to its landing and freezes during pause', () => {
  const manager=new CPUManager(new THREE.Scene(),audio), target=player([12,0,0]); manager.spawnBoss('feral_predator_boss',new THREE.Vector3());
  const boss=manager.activeBoss; boss.specialCooldown=0;
  for(let frame=0;frame<180 && !boss.charge;frame++) manager.update(1/60,target);
  assert.equal(boss.charge?.kind,'leap'); const direction=boss.charge.direction.clone();
  target.position.z=20; manager.update(.3,target); assert.ok(boss.mesh.position.y>1.5); assert.deepEqual(boss.charge.direction.toArray(),direction.toArray());
  const paused=boss.mesh.position.clone(); manager.update(0,target); assert.deepEqual(boss.mesh.position.toArray(),paused.toArray());
  manager.update(.6,target); assert.equal(boss.mesh.position.y,0); assert.equal(boss.charge,null); manager.clear();
});
