/* Carrier cargo consists ONLY of Facehugger units already allocated in
 * the SAME Extinction hive and its signed battle budget. Never birth, mint,
 * import, or replace any creature ID. This first tranche models six normal
 * sockets; the 12-slot upgrade remains reserved for a separately audited
 * source variant, not a free client-side toggle. */
import { validExtinctionCasteUnit } from './ExtinctionCastePolicy.js';

export const CARRIER_CARGO_RULES=Object.freeze({
  ordinaryCapacity:6,upgradedCapacity:12,maxBoardDistance:14,
  upgradeImplemented:false,source:'Aliens versus Predator: Extinction',
  visualFidelity1to1Verified:false
});
const p2=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const living=u=>u?.hp>0&&['distant','active'].includes(u.state);
export function planFiniteCarrierLoad(sim,carrierId,facehuggerIds) {
  const carrier=sim?.units?.get(carrierId),group=sim?.groups?.get(carrier?.groupId);
  if(!validExtinctionCasteUnit(carrier,sim?.config?.id)||
    !living(carrier)||carrier.state!=='distant'||carrier.carrierCargoIds!==undefined||
    !group||group.materialized||group.path.length||
    !Array.isArray(facehuggerIds)||!facehuggerIds.length||
    facehuggerIds.length>CARRIER_CARGO_RULES.ordinaryCapacity||
    new Set(facehuggerIds).size!==facehuggerIds.length)
    return {accepted:false,reason:'carrier_not_available_or_oversubscribed'};
  const checked=[];
  for(const id of facehuggerIds){
    const unit=sim.units.get(id);
    if(!unit||!living(unit)||unit.state!=='distant'||
       unit.actorType!=='facehugger'||unit.species!=='xenomorph'||
       unit.groupId!==carrier.groupId||unit.factionId!==carrier.factionId||
       unit.carriedByCarrierId!==undefined||unit.infection||
       !p2(unit.position)||!p2(carrier.position)||
       dist(unit.position,carrier.position)>CARRIER_CARGO_RULES.maxBoardDistance)
      return {accepted:false,reason:'invalid_finite_facehugger'};
    checked.push(unit.id);
  }
  return {accepted:true,carrierId,facehuggerIds:checked};
}
export function validateFiniteCarrierCargo(sim,units){
  const held=new Set();
  for(const carrier of units.values()){
    if(carrier.carrierCargoIds===undefined)continue;
    const ids=carrier.carrierCargoIds;
    if(!validExtinctionCasteUnit(carrier,sim?.config?.id)||
       !living(carrier)||!Array.isArray(ids)||!ids.length||
       ids.length>CARRIER_CARGO_RULES.ordinaryCapacity||
       new Set(ids).size!==ids.length||!p2(carrier.position))
      throw new Error('invalid saved Carrier cargo');
    for(const id of ids){
      const unit=units.get(id);
      if(!unit||!living(unit)||unit.state!=='distant'||
         unit.species!=='xenomorph'||unit.actorType!=='facehugger'||
         unit.groupId!==carrier.groupId||unit.factionId!==carrier.factionId||
         unit.carriedByCarrierId!==carrier.id||unit.infection||
         !p2(unit.position)||dist(unit.position,carrier.position)>.005||
         held.has(id))throw new Error('invalid saved Carrier cargo');
      held.add(id);
    }
  }
  for(const unit of units.values())
    if(unit.carriedByCarrierId!==undefined&&!held.has(unit.id))
      throw new Error('invalid saved Carrier cargo');
  return true;
}
/** Release the SAME previously allocated IDs; no reserve or free spawns. */
export function releaseFiniteCarrierCargo(carrier,units,count=Infinity){
  if(!Array.isArray(carrier?.carrierCargoIds)||!carrier.carrierCargoIds.length||
    !(Number.isSafeInteger(count)&&count>0||count===Infinity))return [];
  const released=carrier.carrierCargoIds.splice(0,count);
  for(const id of released){
    const unit=units.get(id);
    if(unit?.carriedByCarrierId===carrier.id)delete unit.carriedByCarrierId;
  }
  if(!carrier.carrierCargoIds.length)delete carrier.carrierCargoIds;
  return released;
}
