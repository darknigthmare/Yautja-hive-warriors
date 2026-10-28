import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { operationSceneOptions, createMissionSupportContext } from '../js/engine/MissionRuntimeContext.js';
import { traceSingleProjectileImpact } from '../js/engine/SingleProjectileImpact.js';
import { traceCombatSegment, hasCombatLineOfSight } from '../js/engine/CombatGeometry.js';
import { createPreyArrowMesh } from '../js/graphics/PreyEquipment.js';
import { APCVehicle } from '../js/entities/APCVehicle.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { snapshotOperationPlayer, restoreOperationPlayer } from '../js/battlefield/OperationPlayerState.js';
import { WeaponWheel } from '../js/ui/WeaponWheel.js';
import { commandMapMissionStatus } from '../js/ui/CommandMap.js';
import { SentryGun } from '../js/entities/SentryGun.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { canAccessLegacyAir, canHitLegacyAirTarget } from '../js/engine/LegacyAirstrikePolicy.js';

// Exercise the real router methods without constructing WebGL/audio/browser
// services. No router method is rewritten or duplicated by this fixture.
const source=readFileSync(new URL('../js/main.js',import.meta.url),'utf8');
const GameApp=vm.runInNewContext(`${source.slice(source.indexOf('class GameApp'),source.indexOf("window.addEventListener('DOMContentLoaded'"))};GameApp`,{THREE,createMissionSupportContext,operationSceneOptions,traceSingleProjectileImpact,createPreyArrowMesh,canAccessLegacyAir,canHitLegacyAirTarget});
const audio=new Proxy({}, {get:()=>()=>{}});
const environment=(colliders=[])=>({colliders,navigation:{gridCache:new Map(),actorPaths:new WeakMap()},resolveMovement(){},getPlacementElevationAt:()=>0,
  traceSegment(from,to,options){return traceCombatSegment(from,to,this.colliders,options);},
  hasLineOfSight(from,to,options){return hasCombatLineOfSight(from,to,this.colliders,options);}});
function supportGame(levelId='gunnison_forest',fidelityMode='adapted'){
  const scene=new THREE.Scene(),game=Object.create(GameApp.prototype);
  Object.assign(game,{missionRun:'current-render-run',activeLoadout:{fidelityMode},env:environment(),orbital:{},ui:{selectedLevel:{id:levelId},showAnnouncement(){}},apc:new APCVehicle(scene,null,null),dropship:new CheyenneDropship(scene,null,null)});
  return game;
}

test('old checkpoints recover the original seed/difficulty despite different menu settings, while new saves retain both',()=>{
  assert.deepEqual(operationSceneOptions({version:1},{mapSeed:2,difficultyId:'aggressive'}),{mapSeed:0,difficultyId:'standard'});
  assert.deepEqual(operationSceneOptions({scene:{mapSeed:1,difficultyId:'cautious'}}),{mapSeed:1,difficultyId:'cautious'});
  assert.deepEqual(operationSceneOptions(null,{mapSeed:2,difficultyId:'aggressive'}),{mapSeed:2,difficultyId:'aggressive'});
});

test('command map reports the active terrain/difficulty and real pending phase threats, omitting cancelled threats',()=>{
  const text=commandMapMissionStatus({label:'Fronts'},{mapSeed:2,difficultyLabel:'Agressif',phaseThreats:[{label:'Renfort ennemi vers la réserve',status:'announced',remaining:6.1},{label:'Ancienne menace',status:'cancelled'}]});
  assert.match(text,/Terrain 2/);assert.match(text,/Agressif/);assert.match(text,/Renfort ennemi vers la réserve · 7 s/);assert.doesNotMatch(text,/Ancienne menace/);
});

test('actual support context denies unknown maps and historical faithful tech, and checks a real roof and APC ownership',()=>{
  const env=environment();
  const context=(levelId,fidelityMode='adapted')=>createMissionSupportContext({missionId:'run',levelId,fidelityMode,environment:env});
  assert.equal(context('prey_comanche_territory','faithful').allowed,false);
  assert.equal(context('unknown').allowed,false);
  assert.equal(context('gunnison_forest').canAccessAir(new THREE.Vector3()),true);
  assert.equal(context('romulus_station').canAccessAir(new THREE.Vector3()),false);
  env.colliders.push({x:0,z:0,halfWidth:10,halfDepth:10,baseY:5,height:.5});
  assert.equal(context('gunnison_forest').canAccessAir(new THREE.Vector3()),false);
  env.colliders=[{x:0,z:0,radius:4,height:4,owner:'apc'}];
  assert.equal(context('gunnison_forest').canFireAt(new THREE.Vector3(0,2,0),new THREE.Vector3(0,2,20)),true);
  env.colliders.push({x:0,z:10,radius:3,height:5,owner:'wall'});
  assert.equal(context('gunnison_forest').canFireAt(new THREE.Vector3(0,2,0),new THREE.Vector3(0,2,20)),false);
});

test('router binds support checkpoints to the persistent campaign run, retains wounds/ammo and reattaches only a real collider',()=>{
  const game=supportGame();game.initializeMissionSupports({campaignRunId:'persistent-campaign-run'});
  assert.equal(game.spawnAPCSupport(new THREE.Vector3()),true);game.apc.policy.spend({rounds:13});game.apc.takeDamage(350);
  const saved={version:1,apc:game.apc.serialize(),cheyenne:game.dropship.serialize()};
  game.clearAPCSupport();game.missionRun='another-render-run';game.initializeMissionSupports({campaignRunId:'persistent-campaign-run'});game.restoreMissionSupports(saved);
  assert.equal(game.apc.policy.missionId,'persistent-campaign-run');assert.equal(game.apc.hp,2150);assert.equal(game.apc.getSupportState().remaining.rounds,35);
  assert.equal(game.env.colliders.length,1);assert.equal(game.getSupportCombatants().length,1);
  game.apc.takeDamage(9999,{id:'attacker'});assert.equal(game.env.colliders.length,0);assert.equal(game.getSupportCombatants().length,0);
  game.initializeMissionSupports({campaignRunId:'persistent-campaign-run'});game.restoreMissionSupports(saved);assert.equal(game.apc.hp,0);assert.equal(game.apc.mesh,null);
  game.clearAPCSupport();game.dropship.clear();
  const denied=supportGame('prey_comanche_territory','faithful');denied.initializeMissionSupports();assert.equal(denied.spawnAPCSupport(new THREE.Vector3()),false);assert.deepEqual(denied.env.colliders,[]);
});

test('wooden arrow sweep chooses the first physical hostile body and the nearest physical cover',()=>{
  const actor=z=>({hp:1000,mesh:new THREE.Group(),radius:1});const near=actor(),far=actor();near.mesh.position.z=4;far.mesh.position.z=8;
  const targets=[{actor:far,kind:'horde'},{actor:near,kind:'horde'}],from=new THREE.Vector3(0,1.5,0),to=new THREE.Vector3(0,1.5,20),env=environment();
  assert.equal(traceSingleProjectileImpact(from,to,targets,env).actor,near);
  env.colliders.push({x:0,z:2,halfWidth:5,halfDepth:.2,height:5});assert.equal(traceSingleProjectileImpact(from,to,targets,env).kind,'wall');
  env.colliders[0].z=12;assert.equal(traceSingleProjectileImpact(from,to,targets,env).actor,near);
  near.hp=0;assert.equal(traceSingleProjectileImpact(from,to,targets,env).actor,far);
  near.hp=1000;assert.equal(traceSingleProjectileImpact(from,to,targets,env,actor=>actor!==near).actor,far);
});

test('router dispatches Taabe to its owned mesh and actual Horde hit query only damages the first body once',()=>{
  const scene=new THREE.Scene(),game=Object.create(GameApp.prototype),horde=new XenomorphHorde(scene,audio,null),env=environment();horde.environment=env;
  const actor=z=>{const mesh=new THREE.Group();mesh.position.z=z;return {hp:1000,mesh,radius:1,type:'regular'};};
  const first=actor(4),overlap=actor(4.2);horde.aliens.push(first,overlap);
  Object.assign(game,{renderer:{scene},horde,synthetics:{androids:[]},bosses:{activeBoss:null},env,projectiles:[],ui:{showAnnouncement(){}},audio,particles:{emitSparks(){}},registerHits(){}});
  const owner={position:new THREE.Vector3(),taabeArrowAmmo:1,fireCompoundBow(){this.taabeArrowAmmo--;return {origin:new THREE.Vector3(0,1.5,0),direction:new THREE.Vector3(0,0,1),speed:48,damage:240,pierceRemaining:0,life:1.5,projectileKind:'taabe_arrow'};}};
  assert.equal(game.dispatchSelectedProjectile({id:'taabe_bow',actionMethod:'fireCompoundBow'},false,owner),true);
  const p=game.projectiles[0];assert.equal(p.mesh.isMesh,true);assert.equal(p.projectileKind,'taabe_arrow');assert.equal(owner.taabeArrowAmmo,0);
  assert.equal(game.advancePreyArrow(p,.2),true);assert.equal(first.hp,760);assert.equal(overlap.hp,1000);assert.equal(p.pierceRemaining,0);
  game.removeEffectMesh(p.mesh);horde.clearWave();
});

test('router boss hit passes actual heavy counterplay and origin, while physical cover prevents damage/interruption',()=>{
  class CombatOnlyManager extends BossManager{createBossMesh(){return new THREE.Group();}}
  const manager=new CombatOnlyManager(new THREE.Scene(),audio);manager.spawnBoss('predalien_queen',new THREE.Vector3());
  const game=Object.create(GameApp.prototype);Object.assign(game,{bosses:manager,horde:null,env:environment()});
  const boss=manager.activeBoss;boss.pressureAction='embryos';
  game.hitBossFromPlayer(100,new THREE.Vector3(0,0,5),'heavy');assert.equal(boss.isStunned,true);assert.equal(boss.pressureAction,null);
  boss.isStunned=false;boss.pressureAction='embryos';const hp=boss.hp;game.env.colliders.push({x:0,z:2.5,halfWidth:5,halfDepth:.4,height:5});
  game.hitBossFromPlayer(100,new THREE.Vector3(0,0,5),'charged');assert.equal(boss.hp,hp);assert.equal(boss.pressureAction,'embryos');assert.equal(boss.isStunned,false);manager.clear();
});

test('full player snapshot restores PREY possession before selecting the spent bow, without inventing possession from old flat ammo',()=>{
  class OfflinePlayer extends Player{loadGeneratedVisual(){return Promise.resolve(false);}}
  const make=()=>new OfflinePlayer(new THREE.Scene(),CHARACTERS_DATA.find(row=>row.id==='feral_predator'),audio),player=make(),restored=make();
  try{player.equipPreyWeapon('taabe_bow',{sourceLevelId:'prey_comanche_territory'});player.taabeArrowAmmo=1;player.fireCompoundBow();
    const saved=snapshotOperationPlayer(player);restoreOperationPlayer(restored,saved,environment());
    assert.equal(restored.hasTaabeBow,true);assert.equal(restored.taabeArrowAmmo,0);assert.equal(restored.activeWeapon,'taabe_bow');assert.equal(restored.fireCompoundBow(),null);
    const legacy=make();try{restoreOperationPlayer(legacy,{position:[0,0],taabeArrowAmmo:12,activeWeapon:'taabe_bow'},environment());assert.equal(legacy.hasTaabeBow,false);assert.equal(legacy.taabeArrowAmmo,0);}finally{legacy.dispose();}
  }finally{player.dispose();restored.dispose();}
});

test('wheel adds only the current input owner’s actually acquired PREY tools',()=>{
  const previous=globalThis.document,previousHTMLElement=globalThis.HTMLElement;globalThis.document={getElementById:()=>null};globalThis.HTMLElement=class{};
  try{const player={serializePreyEquipment:()=>({hasTaabeBow:true,hasNaruAxe:false,taabeArrowAmmo:0})},wheel=new WeaponWheel(()=>{},()=>player);
    wheel.open();assert.ok(wheel.weapons.find(row=>row.id==='taabe_bow'));assert.equal(wheel.weapons.some(row=>row.id==='naru_axe'),false);
    wheel.close();wheel.inputOwner={serializePreyEquipment:()=>({hasNaruAxe:true,naruAxeCharges:2})};wheel.open();assert.equal(wheel.weapons.some(row=>row.id==='taabe_bow'),false);assert.ok(wheel.weapons.find(row=>row.id==='naru_axe'));
  }finally{globalThis.document=previous;globalThis.HTMLElement=previousHTMLElement;}
});

function realInteractionFixture(){
  class OfflinePlayer extends Player{loadGeneratedVisual(){return Promise.resolve(false);}}
  const scene=new THREE.Scene(),game=Object.create(GameApp.prototype),environment=new EnvironmentManager(scene),player=new OfflinePlayer(scene,CHARACTERS_DATA.find(row=>row.id==='feral_predator'),audio),messages=[];
  Object.assign(game,{isPlaying:true,isPaused:false,player,dropPod:{isActive:false},photoMode:{isActive:false},env:environment,sentryGun:new SentryGun(scene,audio,null),audio,ui:{selectedLevel:{id:'prey_comanche_territory'},showAnnouncement:message=>messages.push(message)},horde:{aliens:[]},bosses:{activeBoss:null}});environment.game=game;
  environment.taabeRockPerch={pos:new THREE.Vector3(-22,3.8,14),isClaimed:false};environment.naruTomahawkTree={pos:new THREE.Vector3(-8,1.8,18),isClaimed:false};
  const previous=globalThis.window;globalThis.window={game};
  return {game,player,environment,messages,dispose(){game.sentryGun.clear();player.dispose();environment.clearEnvironment();globalThis.window=previous;}};
}

test('real E router falls through the real no-sentry refusal object and acquires Taabe from reachable ground',()=>{
  const fixture=realInteractionFixture();try{
    const {game,player,environment,messages}=fixture;player.position.set(-22,0,14);
    assert.deepEqual(game.sentryGun.reloadSentry(player.position,250),{success:false,reason:'too_far'});
    game.handlePlayerInteraction(player);
    assert.equal(environment.taabeRockPerch.isClaimed,true);assert.equal(player.hasTaabeBow,true);assert.equal(player.taabeArrowAmmo,6);assert.equal(player.activeWeapon,'taabe_bow');assert.equal(messages.some(message=>message.includes('CHARGEUR RECHARGÉ')),false);
  }finally{fixture.dispose();}
});

test('real E router falls through a full nearby real sentry and acquires Naru without reloading it',()=>{
  const fixture=realInteractionFixture();try{
    const {game,player,environment,messages}=fixture;player.position.copy(environment.naruTomahawkTree.pos);game.sentryGun.deploySentry(player.position.clone());const sentry=game.sentryGun.sentries[0];sentry.ammo=sentry.maxAmmo;
    assert.deepEqual(game.sentryGun.reloadSentry(player.position,250),{success:false,reason:'full'});
    game.handlePlayerInteraction(player);assert.equal(environment.naruTomahawkTree.isClaimed,true);assert.equal(player.naruAxeCharges,4);assert.equal(player.activeWeapon,'naru_axe');assert.equal(sentry.ammo,sentry.maxAmmo);assert.equal(messages.some(message=>message.includes('CHARGEUR RECHARGÉ')),false);
  }finally{fixture.dispose();}
});

test('a real successful sentry reload still consumes E once and leaves a nearby PREY pickup untouched',()=>{
  const fixture=realInteractionFixture();try{
    const {game,player,environment,messages}=fixture;player.position.copy(environment.naruTomahawkTree.pos);game.sentryGun.deploySentry(player.position.clone());const sentry=game.sentryGun.sentries[0];sentry.ammo=sentry.maxAmmo-300;
    const before=sentry.ammo;game.handlePlayerInteraction(player);assert.equal(sentry.ammo,before+250);assert.equal(environment.naruTomahawkTree.isClaimed,false);assert.equal(player.hasNaruAxe,false);assert.equal(messages.filter(message=>message.includes('CHARGEUR RECHARGÉ')).length,1);
  }finally{fixture.dispose();}
});

test('planetary barrage refuses a real roof or unknown context before spending any honor',()=>{
  const game=supportGame();game.initializeMissionSupports();let spent=0,hit=0;
  Object.assign(game,{player:{position:new THREE.Vector3()},forge:{getBalance:()=>8000,honorLedger:{spend(){spent++;return true;}}},horde:{aliens:[],checkMeleeHits(){hit++;return[];}},bosses:{activeBoss:null}});
  game.env.colliders.push({x:0,z:0,halfWidth:10,halfDepth:10,baseY:5,height:.5});assert.equal(game.callPlanetaryOrbitalBarrage(),false);assert.equal(spent,0);assert.equal(hit,0);
  game.env.colliders=[];game.missionSupportContext=null;assert.equal(game.callPlanetaryOrbitalBarrage(),false);assert.equal(spent,0);assert.equal(hit,0);
});

test('planetary barrage spends once for open footprints and excludes a covered boss and a distant boss from direct damage',()=>{
  const game=supportGame();game.initializeMissionSupports();let spent=0,bossHits=0,explosions=0;const boss={hp:5000,mesh:new THREE.Group()};boss.mesh.position.set(11,0,0);
  Object.assign(game,{player:{position:new THREE.Vector3()},forge:{getBalance:()=>8000,honorLedger:{spend(){spent++;return true;}}},horde:{aliens:[],eggs:[],chestbursters:[],checkMeleeHits(){return[];}},bosses:{activeBoss:boss,takeDamage(){bossHits++;}},synthetics:{androids:[]},particles:{emitExplosion(){explosions++;}},_supportTransaction:0,refreshMothershipBridgeUI(){},closeTacticalModal(){},triggerCameraShake(){}});
  game.env.colliders.push({x:11,z:0,halfWidth:1,halfDepth:1,baseY:5,height:.5});assert.equal(game.callPlanetaryOrbitalBarrage(),true);assert.equal(spent,1);assert.equal(bossHits,0);assert.equal(explosions,8);
  game.env.colliders=[];boss.mesh.position.set(0,0,90);assert.equal(game.callPlanetaryOrbitalBarrage(),true);assert.equal(spent,2);assert.equal(bossHits,0);
});
