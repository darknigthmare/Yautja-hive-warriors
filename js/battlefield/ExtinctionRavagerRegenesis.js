/* AVP: Extinction Colossal Resilience, original Musou timing values.
 * Source-specific signed-profile upgrade, no free extra soldier life. */
import { validExtinctionCasteUnit } from './ExtinctionCastePolicy.js';
export const RAVAGER_REGENESIS = Object.freeze({
  upgrade:'colossal-resilience',duration:12,recoveryFraction:.5,
  nearDeathFraction:.12,maxHitFraction:.65,kineticReduction:.18,
  upgradePurchaseUIImplemented:false,sourceVisualFidelity1to1Verified:false
});
const valid=x=>Number.isFinite(x)&&x>=0;
const fire=type=>typeof type==='string'&&/fire|flame|napalm|burn|incendiary/i.test(type);
export function isUpgradedRavager(sim,unit){
  return validExtinctionCasteUnit(unit,sim?.config?.id)&&
    unit.actorType==='ravager'&&
    sim.config.profiles?.find(p=>p.id===unit.profileId)?.extinctionUpgrade===
      RAVAGER_REGENESIS.upgrade;
}
export function applyRavagerRemoteHit(sim,unit,damage,{damageType='kinetic'}={}){
  if(!isUpgradedRavager(sim,unit)||unit.state!=='distant'||!valid(damage)||
    !(unit.hp>0))return null;
  const isFire=fire(damageType);
  const actual=isFire?damage:damageType==='kinetic'?
    damage*(1-RAVAGER_REGENESIS.kineticReduction):damage;
  unit.damageTaken+=actual;
  if(unit.ravagerCatalepsy&&isFire){
    unit.hp=0;unit.incapacitated=false;delete unit.ravagerCatalepsy;
    return {killed:true,cataleptic:false,damage:actual,reason:'fire_finisher'};
  }
  unit.hp=Math.max(0,unit.hp-actual);
  if(unit.ravagerCatalepsy){
    if(unit.hp===0){unit.incapacitated=false;delete unit.ravagerCatalepsy;}
    return {killed:unit.hp===0,cataleptic:unit.hp>0,damage:actual,reason:'cataleptic_hit'};
  }
  if(!isFire&&!unit.ravagerRegenesisSpent&&
     unit.hp<=unit.maxHp*RAVAGER_REGENESIS.nearDeathFraction&&
     actual<=unit.maxHp*RAVAGER_REGENESIS.maxHitFraction){
    unit.hp=Math.max(1,unit.hp);
    unit.incapacitated=true;
    unit.ravagerRegenesisSpent=true;
    unit.ravagerCatalepsy={startedAt:sim.time,recoverAt:sim.time+RAVAGER_REGENESIS.duration};
    return {killed:false,cataleptic:true,damage:actual,reason:'catalepsy_started'};
  }
  return {killed:unit.hp===0,cataleptic:false,damage:actual,
    reason:isFire?'fire_blocks_regenesis':'ordinary_damage'};
}
export function advanceRavagerRegenesis(sim){
  let recovered=0;
  for(const unit of sim.units.values()){
    const state=unit.ravagerCatalepsy;
    if(!state||sim.time<state.recoverAt)continue;
    if(!isUpgradedRavager(sim,unit)||unit.state!=='distant'||!(unit.hp>0))continue;
    unit.hp=Math.max(unit.hp,Math.ceil(unit.maxHp*RAVAGER_REGENESIS.recoveryFraction));
    unit.incapacitated=false;delete unit.ravagerCatalepsy;
    sim._emit('ravager_regenesis_complete',{unitId:unit.id,hp:unit.hp},2);
    recovered++;
  }
  return recovered;
}
export function validateSavedRavagerRegenesis(sim,original,unit,time){
  if(!isUpgradedRavager(sim,original)){
    if(unit.ravagerCatalepsy!==undefined||unit.ravagerRegenesisSpent!==undefined)
      throw new Error('invalid saved Ravager regenesis');
    return true;
  }
  if(unit.ravagerRegenesisSpent!==undefined&&
     typeof unit.ravagerRegenesisSpent!=='boolean')
    throw new Error('invalid saved Ravager regenesis');
  const cat=unit.ravagerCatalepsy;
  if(cat===undefined)return true;
  if(!cat||typeof cat!=='object'||Array.isArray(cat)||
     Object.keys(cat).sort().join('|')!=='recoverAt|startedAt'||
     !valid(cat.startedAt)||cat.startedAt>time||
     !valid(cat.recoverAt)||Math.abs(cat.recoverAt-cat.startedAt-
        RAVAGER_REGENESIS.duration)>1e-6||
     !unit.ravagerRegenesisSpent||unit.state!=='distant'||
     !unit.incapacitated||!(unit.hp>0))
    throw new Error('invalid saved Ravager regenesis');
  return true;
}
