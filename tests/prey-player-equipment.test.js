import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { createPreyWeaponVisual, createPreyArrowMesh, PREY_LEVEL_ID } from '../js/graphics/PreyEquipment.js';
import { disposeObject } from '../js/engine/SceneResources.js';
import { snapshotOperationPlayer, restoreOperationPlayer } from '../js/battlefield/OperationPlayerState.js';

class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
const audio=new Proxy({}, {get:()=>()=>{}});
const makePlayer=()=>new OfflinePlayer(new THREE.Scene(),CHARACTERS_DATA.find(data=>data.id==='feral_predator'),audio);
function inPrey(callback) {
  const previous=globalThis.window;
  const environment=new EnvironmentManager(new THREE.Scene());
  globalThis.window={gameInstance:{ui:{selectedLevel:{id:PREY_LEVEL_ID}},env:environment}};
  const player=makePlayer();
  try{return callback(player,environment);}finally{player.dispose();globalThis.window=previous;}
}

test('real Taabe pickup equips the wooden bow, grants six finite arrows once and never spends or refills plasma',()=>inPrey((player,environment)=>{
  environment.taabeRockPerch={pos:new THREE.Vector3(),isClaimed:false};
  const energy=player.plasmaEnergy;
  assert.equal(player.equipPreyWeapon('taabe_bow'),true); assert.equal(player.taabeArrowAmmo,0);
  assert.equal(player.fireCompoundBow(),null);
  assert.equal(environment.checkTaabeWarBowInteraction(player),true);
  assert.equal(player.taabeArrowAmmo,6);assert.equal(player.activeWeapon,'taabe_bow');
  const state=player.getWeaponState();assert.equal(state.actionMethod,'fireCompoundBow');assert.equal(state.rangedResource,'arrows');assert.equal(state.actionAmmo,6);assert.equal(state.plasmaCost,0);
  const visual=player._preyWeaponVisuals.get('taabe_bow');
  assert.equal(visual.parent,player.leftArm);assert.equal(visual.visible,true);assert.equal(player.secWeaponMesh.visible,false);
  assert.ok(visual.getObjectByName('wooden-bow-stave'));assert.equal(visual.getObjectByName('tendon-bowstring').isMesh,true);
  assert.equal(player.lightAttack(),null);assert.equal(player.heavyAttack(),null);
  for(let shot=0;shot<6;shot++){
    const arrow=player.fireCompoundBow();assert.equal(arrow.projectileKind,'taabe_arrow');assert.equal(arrow.ammoCost,1);assert.equal(arrow.energyCost,0);assert.equal(arrow.pierceRemaining,0);
    assert.equal(arrow.speed,48);assert.equal(arrow.damage,240);assert.equal(arrow.life,1.5);
    assert.equal(player.fireCompoundBow(),null);player.update(0);assert.equal(player.fireCompoundBow(),null);player.update(.91);
  }
  assert.equal(player.taabeArrowAmmo,0);assert.equal(player.fireCompoundBow(),null);assert.equal(player.plasmaEnergy,energy);
  assert.equal(environment.checkTaabeWarBowInteraction(player),false);assert.equal(player.taabeArrowAmmo,0);
  assert.equal(player.equipPreyWeapon('taabe_bow'),true);assert.equal(player.taabeArrowAmmo,0);
}));

test('real Naru pickup creates a right-hand tethered axe and spends exactly four admitted physical swings',()=>inPrey((player,environment)=>{
  environment.naruTomahawkTree={pos:new THREE.Vector3(),isClaimed:false};
  assert.equal(environment.checkNaruTomahawkInteraction(player),true);assert.equal(player.naruAxeCharges,4);
  const held=player._preyWeaponVisuals.get('naru_axe');assert.equal(held.parent,player.rightArm);assert.ok(held.getObjectByName('coiled-retrieval-tether'));assert.ok(held.getObjectByName('flaked-tomahawk-head'));
  assert.equal(player.secWeaponMesh.visible,false);assert.equal(player.getWeaponState().actionResource,'axe_charges');
  player.stamina=0;assert.equal(player.lightAttack(),null);assert.equal(player.naruAxeCharges,4);player.stamina=100;
  const energy=player.plasmaEnergy;
  for(let strike=0;strike<4;strike++){
    const hit=strike%2?player.heavyAttack():player.lightAttack();
    assert.ok(hit.damage>0&&hit.radius<5);assert.ok(hit.hitDelay>0);assert.equal(player.naruAxeCharges,3-strike);
    assert.equal(player.lightAttack(),null);assert.equal(player.heavyAttack(),null);assert.equal(player.naruAxeCharges,3-strike);
    if(strike%2)assert.equal(hit.chargeType,'prey_axe');
    player.update(1.5);player.stamina=100;
  }
  assert.equal(player.lightAttack(),null);assert.equal(player.heavyAttack(),null);assert.equal(player.plasmaEnergy,energy);
  assert.equal(environment.checkNaruTomahawkInteraction(player),false);assert.equal(player.naruAxeCharges,0);
}));

test('faithful kits and other missions reject human Prey tools without consuming the pickup or granting stock',()=>inPrey((player,environment)=>{
  environment.taabeRockPerch={pos:new THREE.Vector3(),isClaimed:false};
  player.applyLoadout({fidelityMode:'faithful'});
  assert.equal(environment.checkTaabeWarBowInteraction(player),true);assert.equal(environment.taabeRockPerch.isClaimed,false);
  assert.equal(player.hasTaabeBow,false);assert.equal(player.taabeArrowAmmo,0);assert.equal(player.selectWeapon('taabe_bow'),false);
  player.applyLoadout({fidelityMode:'adapted'});
  globalThis.window.gameInstance.ui.selectedLevel.id='jungle_1987';
  assert.equal(player.equipPreyWeapon('taabe_bow',{sourceLevelId:PREY_LEVEL_ID}),false);
  assert.equal(player.equipPreyWeapon('naru_axe'),false);assert.equal(player.hasNaruAxe,false);
}));

test('grizzly supplies and Feral rack recover actual bounded HP which damage consumes and checkpoints retain',()=>inPrey((player,environment)=>{
  const initialShield=player.shield;
  environment.grizzlyBearCarcass={pos:new THREE.Vector3(),isSkinned:false};
  environment.feralArsenalStation={pos:new THREE.Vector3(),isClaimed:false};
  player.hp=player.maxHp-300;player.feralBoltAmmo=3;
  assert.equal(environment.checkGrizzlyBearTrophyInteraction(player),true);assert.equal(player.hp,player.maxHp-150);assert.equal(player.shield,initialShield);
  player.takeDamage(100,false);assert.equal(player.hp,player.maxHp-250);
  assert.equal(environment.checkFeralArsenalInteraction(player),true);assert.equal(player.hp,player.maxHp-150);assert.equal(player.feralBoltAmmo,9);assert.equal(player.activeWeapon,'crossbow');assert.equal(player.shield,initialShield);
  const saved=snapshotOperationPlayer(player);player.hp=1;player.feralBoltAmmo=0;
  restoreOperationPlayer(player,saved,environment);assert.equal(player.hp,player.maxHp-150);assert.equal(player.feralBoltAmmo,9);
  assert.equal(environment.checkGrizzlyBearTrophyInteraction(player),false);assert.equal(environment.checkFeralArsenalInteraction(player),false);assert.equal(player.hp,player.maxHp-150);
  environment.grizzlyBearCarcass={pos:new THREE.Vector3(),isSkinned:false};environment.feralArsenalStation={pos:new THREE.Vector3(),isClaimed:false};
  player.hp=player.maxHp-1;environment.checkGrizzlyBearTrophyInteraction(player);assert.equal(player.hp,player.maxHp);
  environment.checkFeralArsenalInteraction(player);assert.equal(player.hp,player.maxHp);assert.equal(player.feralBoltAmmo,12);assert.equal(player.shield,initialShield);
}));

test('save/reload preserves exhausted stocks, partial bow cooldown and buff time without a refill or extra life',()=>inPrey((player)=>{
  player.equipPreyWeapon('taabe_bow');player.taabeArrowAmmo=1;player.fireCompoundBow();player.update(.2);
  player.equipPreyWeapon('naru_axe');player.naruAxeCharges=0;player.applyOrangeFlowerBuff(19);player.applyPreyMudCamouflage(12);player.applyTaabeWarAgility(7);
  const saved=JSON.parse(JSON.stringify(player.serializePreyEquipment())), other=makePlayer();
  try{
    assert.equal(other.restorePreyEquipment(saved),true);assert.equal(other.activeWeapon,'naru_axe');assert.equal(other.taabeArrowAmmo,0);assert.equal(other.naruAxeCharges,0);
    assert.equal(other.lightAttack(),null);assert.equal(other.orangeFlowerTimer,19);assert.equal(other.taabeWarTimer,7);assert.equal(other.mudCoatedTimer,12);assert.equal(other.compoundBowCooldown,saved.bowCooldown);
    other.selectWeapon('taabe_bow',false);assert.equal(other.fireCompoundBow(),null);other.update(0);assert.equal(other.compoundBowCooldown,saved.bowCooldown);
    const before=other.serializePreyEquipment();
    for(const mutation of [{taabeArrowAmmo:13},{naruAxeCharges:-1},{hasTaabeBow:false,taabeArrowAmmo:1},{selected:'m41a'},{orangeFlowerRemaining:Infinity}]){
      assert.equal(other.restorePreyEquipment({...saved,...mutation}),false);assert.deepEqual(other.serializePreyEquipment(),before);
    }
  }finally{other.dispose();}
}));

test('Taabe agility changes actual travel by 30 percent once and expires at 25 seconds at30/60/120fps; pause freezes it',()=>{
  for(const hz of[30,60,120])inPrey(player=>{
    const speed=player.moveSpeed;player.move(new THREE.Vector3(1,0,0),1);assert.ok(Math.abs(player.position.x-speed)<1e-9);player.position.set(0,0,0);
    player.applyTaabeWarAgility();player.applyTaabeWarAgility();player.move(new THREE.Vector3(1,0,0),1);assert.ok(Math.abs(player.position.x-speed*1.3)<1e-9);
    player.update(0);assert.equal(player.taabeWarTimer,25);
    for(let frame=0;frame<25*hz;frame++)player.update(1/hz);
    // Floating point time can leave a sub-frame residue; the next real tick
    // must close it, never extend by another duration.
    player.update(1/hz);assert.equal(player.isTaabeWarActive,false);assert.equal(player.taabeWarTimer,0);
    player.position.set(0,0,0);player.move(new THREE.Vector3(1,0,0),1);assert.ok(Math.abs(player.position.x-speed)<1e-9);
  });
});

test('orange flower attenuates heat temporarily, mud reduces actual acid damage by40 percent, and neither toggles technological cloak',()=>inPrey(player=>{
  const hp=player.hp;
  player.applyOrangeFlowerBuff();assert.equal(player.getThermalSignatureMultiplier(),.35);assert.equal(player.isCloaked,false);
  player.applyPreyMudCamouflage();assert.equal(player.isCloaked,false);
  player.takeDamage(100,true);assert.equal(player.hp,hp-60);
  player.takeDamage(100,false);assert.equal(player.hp,hp-160);
  player.update(0);assert.equal(player.orangeFlowerTimer,35);assert.equal(player.mudCoatedTimer,30);
  player.update(30);assert.equal(player.isMudCoated,false);assert.equal(player.getThermalSignatureMultiplier(),.35);
  const before=player.hp;player.takeDamage(100,true);assert.equal(player.hp,before-100);
  player.update(5);assert.equal(player.isOrangeFlowerActive,false);assert.equal(player.getThermalSignatureMultiplier(),1);assert.equal(player.isCloaked,false);
  player.toggleCloak();player.applyOrangeFlowerBuff(.1);player.update(.2);assert.equal(player.isCloaked,true,'expiry preserves an independently enabled cloak');player.toggleCloak();
  assert.equal(player.applyOrangeFlowerBuff(Infinity),false);assert.equal(player.applyTaabeWarAgility(NaN),false);assert.equal(player.applyPreyMudCamouflage(-1),false);
}));

test('solid arrow and held tool geometry use finite bounded authored detail and can be fully disposed',()=>{
  const arrow=createPreyArrowMesh();assert.equal(arrow.isMesh,true);assert.equal(arrow.userData.projectileKind,'taabe_arrow');assert.equal(arrow.material.emissive.getHex(),0);
  arrow.geometry.computeBoundingBox();assert.ok(arrow.geometry.boundingBox.max.z>.9);assert.ok(arrow.geometry.boundingBox.min.z<-.7);
  for(const id of['taabe_bow','naru_axe']){
    const visual=createPreyWeaponVisual(id);let triangles=0;const materials=new Set();
    visual.traverse(child=>{if(child.geometry){const position=child.geometry.attributes.position;assert.ok([...position.array].every(Number.isFinite));triangles+=(child.geometry.index?.count??position.count)/3;materials.add(child.material);}});
    assert.ok(triangles>1500&&triangles<12000);assert.ok(materials.size<=4);assert.equal(visual.userData.fidelity1to1Verified,false);
    disposeObject(visual);
  }
  let geometryDisposed=0,materialDisposed=0;arrow.geometry.addEventListener('dispose',()=>geometryDisposed++);arrow.material.addEventListener('dispose',()=>materialDisposed++);disposeObject(arrow);assert.equal(geometryDisposed,1);assert.equal(materialDisposed,1);
});

test('held tools follow native hand sockets with compensated GLB scale and survive removal of the imported body exactly once',()=>inPrey(player=>{
  player.equipPreyWeapon('naru_axe');const visual=player._preyWeaponVisuals.get('naru_axe');
  const native=new THREE.Group(),leftHand=new THREE.Group(),rightHand=new THREE.Group();native.scale.setScalar(.01);native.add(leftHand,rightHand);player.mesh.add(native);
  const originalArmor=player.armorMaterials,originalSkin=player.skinMaterials;
  let sawDetached=false,disposals=0;
  visual.traverse(child=>child.geometry?.addEventListener('dispose',()=>disposals++));
  player._importedCharacter={adapter:{sockets:{leftHand,rightHand},materials:[],visualGroundOffsetY:0,dispose(){sawDetached=visual.parent!==rightHand;disposeObject(native);}},cameraEyeHeight:3.4,
    records:[],hidden:new Map(),laserStarts:[],laserBaseY:0,skinMaterials:originalSkin,armorMaterials:originalArmor};
  player._syncPreyWeaponVisuals();assert.equal(visual.parent,rightHand);assert.ok(Math.abs(visual.scale.x-100)<1e-8);
  const before=new THREE.Box3().setFromObject(visual).getSize(new THREE.Vector3());assert.ok(before.y>.8&&before.y<2);
  player._removeImportedCharacter();assert.equal(sawDetached,true);assert.equal(disposals,0,'replacing the body must not free the still-owned tool');
  player._syncPreyWeaponVisuals();assert.equal(visual.parent,player.rightArm);assert.equal(visual.scale.x,1);
  const count=player._preyWeaponVisuals.size;
  for(let frame=0;frame<120;frame++)player.update(0);
  assert.equal(player._preyWeaponVisuals.size,count);assert.equal(disposals,0);
  let geometries=0;visual.traverse(child=>{if(child.geometry)geometries++;});
  player.dispose();assert.equal(disposals,geometries);assert.equal(player._preyWeaponVisuals.size,0);
}));

test('actual player height prevents walking or pouncing through a low overhead deck',()=>inPrey((player,environment)=>{
  const height=player.getCollisionHeight();assert.ok(height>=player.cameraEyeHeight+.35&&height>=2.4);
  environment.halfSize=100;
  const canopy={x:0,z:2,halfWidth:3,halfDepth:.2,baseY:height-.2,height:.2,rotation:0};environment.colliders.push(canopy);
  player.position.set(0,0,1.8);player.move(new THREE.Vector3(),.01);assert.ok(player.position.z<1.1,'the head cannot enter a low overhead slab');
  environment.colliders.length=0;
  const roof=new THREE.Mesh(new THREE.BoxGeometry(20,.2,20),new THREE.MeshBasicMaterial());roof.position.y=height+.25;environment.scene.add(roof);
  environment.registerReferenceWalkSurface(roof,{id:'test-roof',bounds:{minX:-10,maxX:10,minZ:-10,maxZ:10},heightAt:()=>height+.35});
  player.position.set(0,0,0);player.isLeaping=true;player.leapVelocityY=12;player.update(.04);
  assert.ok(player.position.y<=.126);assert.equal(player.leapVelocityY,0);
  disposeObject(roof);
}));
