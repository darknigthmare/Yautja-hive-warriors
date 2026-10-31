/* Aliens / USCM M577 finite crew and passenger manifest.
 * 2 crew positions + 12 passenger places, distinct EXISTING battle identities.
 * A synthetic of the Extinction section may act as crew; no new Marine spawned.
 * No RTS troop production, and no 1:1 cabin mesh claim.
 */
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';

export const APC_SECTION_RULES=Object.freeze({
  vehicleId:'m577-apc',passengerSeats:12,crewPositions:2,
  maxBoardDistance:22,maxFloorDifference:1.8,maxExitDistance:18,
  visualFidelity1to1Verified:false
});
const point=p=>Array.isArray(p)&&p.length===2&&p.every(n=>Number.isFinite(n)&&Math.abs(n)<=10000);
const id=v=>typeof v==='string'&&/^[a-zA-Z0-9_.:-]{1,128}$/.test(v);
const eq=(a,b)=>point(a)&&point(b)&&Math.hypot(a[0]-b[0],a[1]-b[1])<=.002;
const dist=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const fail=()=>{throw new Error('invalid saved APC marine manifest');};
const active=u=>u&&u.hp>0&&['active','distant'].includes(u.state);
const boarded=u=>u.apcSeat!==undefined||u.apcCrewRole!==undefined;
const marine=u=>u?.species==='human'&&
  ['marine','human','smartgunner','flametrooper'].includes(u.actorType);
const synthetic=u=>u?.species==='synthetic'&&
  ['synthetic','working_joe','weyland_combat'].includes(u.actorType);

export function canBoardM577Unit(unit){
  return active(unit)&&marine(unit)&&unit.incapacitated!==true&&
    !unit.infection&&!boarded(unit)&&sourceUnitVisualKind(unit)!=='exosuit';
}
export function canCrewM577Unit(unit){
  return active(unit)&&(marine(unit)||synthetic(unit))&&unit.incapacitated!==true&&
    !unit.infection&&!boarded(unit)&&sourceUnitVisualKind(unit)!=='exosuit';
}

export function planM577Embark(sim,groupId,{ownerFaction,frontId,position}={}){
  const group=sim?.groups?.get(groupId);
  if(!group||sim.disposed||sim.result||sim.paused||sim.apcManifest||
    !sim.factions.has(ownerFaction)||!sim.factions.has(group.factionId)||
    sim.factions.get(group.factionId).species!=='human'||
    (ownerFaction!==group.factionId&&sim.relationship(ownerFaction,group.factionId)!=='allied')||
    group.frontId!==frontId||group.path.length>0||group.reconstitution?.required||
    !point(position)||!sim.fronts.has(frontId)||
    dist(position,sim.fronts.get(frontId).position)>sim.fronts.get(frontId).radius+15)
    return {accepted:false,reason:'unavailable_or_hostile_carrier'};
  const units=group.units.map(unitId=>sim.units.get(unitId));
  const live=units.filter(active);
  if(live.length===0||live.length>APC_SECTION_RULES.passengerSeats+APC_SECTION_RULES.crewPositions||
    live.some(unit=>!canCrewM577Unit(unit)||dist(unit.position,position)>
      APC_SECTION_RULES.maxBoardDistance)||
    units.some(unit=>!active(unit)&&!['dead','evacuated','captured'].includes(unit.state)))
    return {accepted:false,reason:'squad_not_boardable'};

  // Synthetic section members may operate the vehicle but cannot be counted
  // as human passengers. The crew is drawn entirely from the allocated squad.
  const nonPassengers=live.filter(unit=>!canBoardM577Unit(unit));
  const humanCrew=live.filter(unit=>canBoardM577Unit(unit));
  if(nonPassengers.length>APC_SECTION_RULES.crewPositions ||
     humanCrew.length+nonPassengers.length>APC_SECTION_RULES.passengerSeats+APC_SECTION_RULES.crewPositions)
    return {accepted:false,reason:'squad_exceeds_apc_cabin'};
  const crew=[...nonPassengers,...humanCrew].slice(0,APC_SECTION_RULES.crewPositions);
  const crewSet=new Set(crew.map(unit=>unit.id));
  const passengers=live.filter(unit=>!crewSet.has(unit.id));
  if(passengers.length>APC_SECTION_RULES.passengerSeats||
     passengers.some(unit=>!canBoardM577Unit(unit)))
    return{accepted:false,reason:'nonpassenger_cannot_use_seat'};
  return{accepted:true,groupId,factionId:group.factionId,ownerFaction,frontId,
    position:[...position],crew:crew.map(u=>u.id),
    passengers:passengers.map(u=>u.id)};
}

export function validateM577Manifest(manifest,sim,units,groups,savedTime){
  if(manifest===undefined||manifest===null){
    if([...units.values()].some(boarded)||
       [...groups.values()].some(group=>group.apcCarrierId!==undefined&&group.apcCarrierId!==null))fail();
    return null;
  }
  const group=groups.get(manifest?.groupId);
  if(!manifest||manifest.version!==1||manifest.vehicleId!==APC_SECTION_RULES.vehicleId||
    !id(manifest.groupId)||!group||!id(manifest.factionId)||
    !id(manifest.ownerFaction)||!sim.factions.has(manifest.ownerFaction)||
    group.factionId!==manifest.factionId||
    sim.factions.get(manifest.factionId)?.species!=='human'||
    (manifest.ownerFaction!==manifest.factionId&&
      sim.relationship(manifest.ownerFaction,manifest.factionId)!=='allied')||
    !sim.fronts.has(manifest.frontId)||group.frontId!==manifest.frontId||
    group.state!=='distant'||group.materialized===true||group.path.length>0||
    group.apcCarrierId!==manifest.vehicleId||
    !point(manifest.position)||!eq(group.position,manifest.position)||
    dist(manifest.position,sim.fronts.get(manifest.frontId).position)>
      sim.fronts.get(manifest.frontId).radius+15||
    !Number.isFinite(manifest.boardedAt)||manifest.boardedAt<0||
    manifest.boardedAt>savedTime||
    !Array.isArray(manifest.passengers)||!Array.isArray(manifest.crew)||
    manifest.passengers.length>APC_SECTION_RULES.passengerSeats||
    manifest.crew.length>APC_SECTION_RULES.crewPositions||
    manifest.crew.length+manifest.passengers.length===0)fail();
  const occupants=[...manifest.crew,...manifest.passengers];
  if(new Set(occupants).size!==occupants.length)fail();
  for(let seat=0;seat<occupants.length;seat++){
    const unit=units.get(occupants[seat]),isCrew=seat<manifest.crew.length;
    const crewRole=seat===0?'driver':'commander';
    if(!unit||unit.groupId!==group.id||!group.units.includes(unit.id)||
      !active(unit)||unit.state!=='distant'||unit.incapacitated||unit.infection||
      !eq(unit.position,manifest.position)||
      (isCrew?(unit.apcCrewRole!==crewRole||unit.apcSeat!==undefined||
        !(marine(unit)||synthetic(unit))||sourceUnitVisualKind(unit)==='exosuit')
        :(unit.apcSeat!==seat-manifest.crew.length||
          unit.apcCrewRole!==undefined||!marine(unit)||sourceUnitVisualKind(unit)==='exosuit')))fail();
  }
  const occupied=new Set(occupants);
  for(const unit of units.values()){
    if(boarded(unit)&&!occupied.has(unit.id))fail();
    if(group.units.includes(unit.id)&&active(unit)&&!occupied.has(unit.id))fail();
  }
  for(const other of groups.values()){
    if(other.id!==group.id&&other.apcCarrierId!==undefined&&other.apcCarrierId!==null)fail();
  }
  return JSON.parse(JSON.stringify(manifest));
}
