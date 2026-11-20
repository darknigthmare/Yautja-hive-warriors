import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { CombatEvents } from '../js/engine/CombatEvents.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { YautjaAlliesManager } from '../js/entities/YautjaAllies.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';

const audio = new Proxy({}, { get: () => () => {} });
const unit = (id = 'hive.line.1', factionId = 'hive') => ({ id, profileId: 'warrior', groupId: `${factionId}.squad`, factionId,
  species: 'xenomorph', actorType: 'warrior', officer: false, hp: 120, maxHp: 120, position: [8, 0] });

test('one persistent death identity survives duplicate sources, reentrant callbacks and pool reuse', () => {
  const events = new CombatEvents({ runId: 'operation-7' }), received = [];
  const actor = { battleUnitId: 'unit-4', type: 'warrior', mesh: new THREE.Group() };
  events.subscribe(event => { received.push(event.id); assert.equal(events.recordDeath({ entity: actor }), null); });
  const result = events.recordDeath({ entity: actor, cause: 'plasma', killerFaction: 'player_clan' });
  assert.equal(result.entityId, 'unit-4'); assert.equal(result.killerFaction, 'player_clan');
  assert.deepEqual(result.position, [0, 0, 0]); assert.equal(events.recordDeath({ entityId: 'unit-4', cause: 'support' }), null);
  assert.equal(received.length, 1); assert.equal(events.getSnapshot().deaths.length, 1);
  const first = { mesh: actor.mesh }, second = { mesh: actor.mesh };
  assert.notEqual(events.entityId(first), events.entityId(second), 'a new pooled actor is not the old mesh lifetime');
  events.reset('operation-8'); assert.ok(events.recordDeath({ entity: actor }));
  assert.equal(events.getSnapshot().deaths.length, 1);
});

test('materialization preserves identity and HP without scoring culls; death scores and disposes once', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), ledger = new CombatEvents({ runId: 'clan' });
  horde.combatEvents = ledger;
  const specification = unit(), actor = horde.spawnBattleUnit(specification, { targetPosition: [15, 5] });
  assert.equal(horde.spawnBattleUnit(specification).mesh.uuid, actor.mesh.uuid);
  actor.hp = 73; actor.mesh.position.set(10, 0, 3);
  const snapshot = horde.despawnBattleUnit(specification);
  assert.deepEqual(snapshot, { id: specification.id, hp: 73, position: [10, 3] });
  assert.equal(ledger.getSnapshot().deaths.length, 0); assert.equal(horde.deadCount, 0); assert.equal(horde.aliens.length, 0);
  const restored = horde.spawnBattleUnit({ ...specification, hp: snapshot.hp, position: snapshot.position });
  assert.equal(restored.hp, 73); assert.equal(restored.battleUnitId, specification.id);
  const event = horde.defeatAlien(restored, { cause: 'faction-combat', killerFaction: 'humans' });
  assert.equal(event.entityId, specification.id); assert.equal(event.killerFaction, 'humans');
  assert.equal(horde.defeatAlien(restored), null); assert.equal(horde.deadCount, 1); assert.equal(horde.aliens.length, 0);
  horde.clearWave();
});

test('damage delivered by scenery is harvested once even after the last player dies', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio), ledger = new CombatEvents({ runId: 'weather' });
  horde.combatEvents = ledger; const actor = horde.spawnBattleUnit(unit());
  actor.hp = -90; actor.lastDamageFaction = 'human_rivals';
  horde.update(1 / 60, { hp: 0, position: new THREE.Vector3() });
  horde.update(1 / 60, { hp: 0, position: new THREE.Vector3() });
  assert.equal(horde.deadCount, 1); assert.equal(ledger.getSnapshot().deaths.length, 1);
  assert.equal(ledger.getSnapshot().deaths[0].killerFaction, 'human_rivals');
  assert.equal(horde.aliens.length, 0); horde.clearWave();
});

test('three species use explicit relationships, not hardcoded human-versus-xenomorph targeting', () => {
  const scene = new THREE.Scene(), horde = new XenomorphHorde(scene, audio), humans = new ColonialMarinesManager(scene, audio), hunters = new YautjaAlliesManager(scene, audio);
  const simulation = { config: { playerFaction: 'player_clan' }, areHostile(a,b) { return a !== b && ![a,b].includes('player_clan'); } };
  const xeno = horde.spawnBattleUnit(unit('xeno-1', 'hive'));
  const human = humans.spawnBattleUnit({ ...unit('human-1','mercenaries'), actorType:'marine', species:'human', hp:1000, maxHp:1000, position:[9,0] });
  const hunter = hunters.spawnBattleUnit({ ...unit('hunter-1','player_clan'), actorType:'yautja', species:'yautja', hp:1000, maxHp:1000, position:[11,0] });
  const player = { hp:1000, position:new THREE.Vector3(9,0,1), takeDamage(amount) { this.hp -= amount; } };
  for (const manager of [horde,humans,hunters]) { manager.battleSimulation = simulation; manager.combatActorsProvider = () => [xeno,human,hunter,player]; }
  for (let frame=0;frame<180;frame++) { horde.update(1/60,player); humans.update(1/60,player,horde); hunters.update(1/60,player.position,horde); }
  assert.equal(player.hp,1000); assert.equal(hunter.hp,1000, 'allied clan is not attacked merely for being a Yautja');
  assert.ok(xeno.hp < 120 || human.hp < 1000, 'the two explicitly hostile NPC factions actually fight');
  horde.clearWave(); humans.clearSquad(); hunters.clearSquad();
});

test('an allocated synthetic has one terminal death; tactical despawn never manufactures another', () => {
  const manager = new SyntheticsManager(new THREE.Scene(), audio), ledger = new CombatEvents({runId:'synth'});
  manager.combatEvents = ledger;
  const actor = manager.spawnBattleUnit({...unit('synth-1','wy'),actorType:'synthetic',species:'synthetic'});
  assert.ok(manager.defeatSynthetic(actor,{cause:'harvest'}));
  assert.equal(manager.defeatSynthetic(actor),null); assert.equal(ledger.getSnapshot().deaths.length,1);
  assert.equal(manager.androids.length,0); manager.clearSquad();
});

test('a raw lethal hit is recorded before culling, including an already observed death', () => {
  const scene = new THREE.Scene(), ledger = new CombatEvents({runId:'late-cull'});
  for (const [manager, actorType, collection] of [[new XenomorphHorde(scene,audio),'warrior','aliens'],[new ColonialMarinesManager(scene,audio),'marine','marines'],[new YautjaAlliesManager(scene,audio),'yautja','allies'],[new SyntheticsManager(scene,audio),'synthetic','androids']]) {
    manager.combatEvents=ledger;
    const actor=manager.spawnBattleUnit({...unit(`raw-${actorType}`),actorType});
    actor.hp=-1; actor.lastDamageFaction='hazard';
    const snapshot=manager.despawnBattleUnit(actor.battleUnitId);
    assert.equal(snapshot.hp,0); assert.equal(manager[collection].length,0);
    assert.equal(ledger.hasDeath(actor),true);
    assert.equal(manager.despawnBattleUnit(actor.battleUnitId),null);
    const observed=manager.spawnBattleUnit({...unit(`observed-${actorType}`),actorType}); observed.hp=0;
    const event=ledger.recordDeath({entity:observed,cause:'bridge-observation'}); observed.combatDeathEvent=event;
    manager.despawnBattleUnit(observed.battleUnitId); assert.equal(manager[collection].length,0);
    if (manager.deadCount !== undefined) assert.equal(manager.deadCount,2);
  }
  assert.equal(ledger.getSnapshot().deaths.length,8);
});

test('retreat beats an adjacent hostile target instead of permitting a free attack', () => {
  const manager=new YautjaAlliesManager(new THREE.Scene(),audio);
  const actor=manager.spawnBattleUnit({...unit('retreating','clan'),actorType:'bad_blood',position:[0,0]}, {order:{type:'retreat'},targetPosition:[-20,0]});
  const target={hp:1000,factionId:'hive',mesh:new THREE.Group()}; target.mesh.position.set(1,0,0);
  manager.battleSimulation={config:{playerFaction:'player_clan'},areHostile:(a,b)=>a!==b};
  manager.combatActorsProvider=()=>[actor,target];
  for(let frame=0;frame<120;frame++)manager.update(1/60,new THREE.Vector3(),{aliens:[]});
  assert.ok(actor.mesh.position.x < -15); assert.equal(target.hp,1000); assert.equal(actor._npcPreparation,0);
  manager.clearSquad();
});

test('synthetic hit queries respect faction truces and the shared physical cover', () => {
  const manager=new SyntheticsManager(new THREE.Scene(),audio), actor=manager.spawnBattleUnit({...unit('neutral-synth','wy'),actorType:'synthetic',position:[0,0]});
  let hostile=false, visible=true;
  manager.battleSimulation={config:{playerFaction:'clan'},areHostile:()=>hostile}; manager.environment={hasLineOfSight:()=>visible};
  const attack={origin:new THREE.Vector3(),damage:20,radius:3};
  assert.equal(manager.checkHits(attack).length,0); assert.equal(actor.hp,120);
  hostile=true; visible=false; assert.equal(manager.checkHits(attack).length,0); assert.equal(actor.hp,120);
  visible=true; assert.equal(manager.checkHits(attack).length,1); assert.equal(actor.hp,100);
  manager.clearSquad();
});

test('raw lethal scenery damage preserves a boiler detonation exactly once', () => {
  const horde=new XenomorphHorde(new THREE.Scene(),audio), ledger=new CombatEvents({runId:'boiler'});
  horde.combatEvents=ledger;
  const actor=horde.spawnBattleUnit({...unit('boiler-1'),actorType:'boiler'});
  actor.hp=0; const player={hp:1000,position:new THREE.Vector3(50,0,0)};
  horde.update(1/60,player); horde.update(1/60,player);
  assert.equal(horde.deadCount,1); assert.equal(ledger.getSnapshot().deaths.length,1);
  assert.equal(horde.acidPools.length,1); assert.equal(actor._boilerDetonated,true); assert.equal(horde.aliens.length,0);
  horde.clearWave();
});

test('zero-delta cleanup records a boiler death but defers its blast until simulation resumes',()=>{
  const horde=new XenomorphHorde(new THREE.Scene(),audio),actor=horde.spawnBattleUnit({...unit('paused-boiler'),actorType:'boiler'});
  const player={hp:1000,position:new THREE.Vector3(8,0,0),takeDamage(amount){this.hp-=amount;}};actor.hp=0;
  horde.update(0,player);horde.update(0,player);assert.equal(horde.deadCount,1);assert.equal(horde.acidPools.length,0);assert.equal(player.hp,1000);
  horde.update(1/60,player);assert.equal(horde.acidPools.length,1);assert.ok(player.hp<1000);assert.equal(horde.deadCount,1);
  horde.clearWave();
});
