/* The M577 carries EXISTING finite USCM identities, and uses the declared
 * physical battle route for optional one-leg movement. Never an RTS factory. */
import * as THREE from 'three';
import { APC_SECTION_RULES } from './APCSectionManifest.js';
import { APCConvoyDrive } from './APCConvoyDrive.js';

const point = p => Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const valid = p => p?.isVector3&&[p.x,p.y,p.z].every(Number.isFinite);
const dist = (a,b) => Math.hypot(a[0]-b[0],a[1]-b[1]);

export class APCMarineService {
  constructor(apc,simulation,environment,{feedback=()=>{},actors=()=>[],onMove=()=>{}}={}){
    this.apc=apc;this.simulation=simulation;this.environment=environment;
    this.feedback=feedback;this.actors=actors;this.onMove=onMove;
    this.disposed=false;this.lastResult=null;this.drive=new APCConvoyDrive(this);
  }

  get ownerFaction(){return this.apc?.policy?.context?.factionId??null;}
  get manifest(){return this.simulation?.getAPCManifest?.()??null;}
  get available(){return !this.disposed&&!!this.simulation&&!this.simulation.disposed&&
    this.apc?.isSupportActive?.()===true&&!!this.ownerFaction;}
  /** Live hull and persisted occupants must share the same XZ origin.
   * The client must refuse an unsafe exit rather than silently teleport
   * seated Marines when a support was moved without simulation authority. */
  validateCarrierPosition(){
    const manifest=this.manifest;
    if(!manifest)return{accepted:true};
    const position=this.apc?.mesh?.position;
    if(!this.available||!valid(position)||!point(manifest.position)||
      dist([position.x,position.z],manifest.position)>.05)
      return{accepted:false,reason:'carrier_manifest_position_mismatch'};
    return{accepted:true};
  }
  getHUDState(){
    const m=this.manifest;
    const playerFaction=this.simulation?.config?.playerFaction;
    const allied=this.ownerFaction&&playerFaction&&
      (this.ownerFaction===playerFaction||
        this.simulation?.relationship?.(this.ownerFaction,playerFaction)==='allied');
    const available=this.available&&!!allied&&this.validateCarrierPosition().accepted;
    return {available,passengers:m?.passengers.length??0,
      crew:m?.crew.length??0,
      capacity:APC_SECTION_RULES.passengerSeats,crewPositions:APC_SECTION_RULES.crewPositions,
      frontId:m?.frontId??null,canDrive:!!m&&!!m.crew.length&&!this.drive.active&&available,
      canStop:this.drive.active&&available,canDisembark:available&&!!m&&!m.transit&&!this.drive.active,
      ...this.drive.state(),visualFidelity1to1Verified:false};
  }
  _result(result){
    this.lastResult=result;
    if(result.accepted)this.feedback(result.event==='board'
      ? `USCM M577 : ${result.passengers.length}/12 Marines embarqués.`
      :`USCM M577 : ${result.passengerCount}/12 Marines débarqués.`);
    return result;
  }

  boardNearest(){
    if(!this.available||this.manifest)return this._result({accepted:false,reason:'apc_unavailable_or_occupied'});
    const pos=this.apc.mesh.position,origin=[pos.x,pos.z],front=this.environment.getSectorAt?.(pos);
    const groups=[...this.simulation.groups.values()].filter(group=>{
      const faction=this.simulation.factions.get(group.factionId);
      return faction?.species==='human'&&
        (group.factionId===this.ownerFaction||
          this.simulation.relationship(group.factionId,this.ownerFaction)==='allied')&&
        !group.apcCarrierId&&!group.path.length&&
        point(group.position)&&dist(group.position,origin)<=APC_SECTION_RULES.maxBoardDistance;
    }).sort((a,b)=>dist(a.position,origin)-dist(b.position,origin)||a.id.localeCompare(b.id));
    for(const group of groups){
      // Real scene floors and the group front must agree: no boarding a squad
      // through a wall or from the other deck at the same XZ.
      const level=this.environment.getElevationAt?.(group.position[0],
        group.position[1],pos.y);
      if(Number.isFinite(level)&&Math.abs(level-pos.y)>APC_SECTION_RULES.maxFloorDifference)continue;
      // The door is not a teleport across a sealed wall. Existing navigation
      // and scene collision remain authoritative; ignore only the APC's own
      // hull while checking visibility to its access hatch.
      if(this.environment.hasLineOfSight){
        const doorway=pos.clone().add(new THREE.Vector3(4.2,1,0));
        const from=new THREE.Vector3(group.position[0],(level??pos.y)+1,
          group.position[1]);
        if(!this.environment.hasLineOfSight(from,doorway,{ignoreOwner:'apc'}))continue;
      }
      if(front&&this.environment.battlefieldLayout?.frontAnchorIds){
        const anchorIndex=this.environment.battlefieldLayout.frontAnchorIds.indexOf(front.id);
        if(anchorIndex>=0&&[...this.simulation.fronts.keys()][anchorIndex]!==group.frontId)continue;
      }
      const candidate=this.simulation.boardAPC(group.id,{
        ownerFaction:this.ownerFaction,frontId:group.frontId,position:origin});
      if(candidate.accepted)return this._result({...candidate,event:'board'});
    }
    return this._result({accepted:false,reason:'no_allied_marine_group_in_range'});
  }

  requestTravel(targetFrontId){return this.drive.request(targetFrontId);}
  stopTravel(){return this.drive.stop();}
  update(delta){return this.drive.update(delta);}

  /** The carrier's real starboard side, then fallback around the back.
   * Every passenger is placed atomically, and none are teleported across decks.
   */
  disembark(){
    const manifest=this.manifest;
    if(!this.available||!manifest)return this._result({accepted:false,reason:'apc_or_manifest_unavailable'});
    if(this.drive.active||manifest.transit!==undefined)
      return this._result({accepted:false,reason:'carrier_in_transit'});
    const consistency=this.validateCarrierPosition();
    if(!consistency.accepted)return this._result(consistency);
    const apc=this.apc.mesh,origin=apc.position,heading=apc.rotation.y;
    const nav=this.environment.navigation;
    if(!nav?.canStand||!nav.safeSpawnNear)
      return this._result({accepted:false,reason:'physical_navigation_unavailable'});
    const occupied=this.actors().map(item=>item?.actor??item)
      .filter(a=>a?.mesh?.position?.isVector3).map(a=>({
        position:a.mesh.position,radius:a.radius??.8
      }));
    const placements=[],occupants=[...manifest.crew,...manifest.passengers],
      baseZ=[2,0,-2,4,-4,6,-6,8,-8,10,-10,12,14,16,18];
    const toWorld=(side,longitudinal)=>new THREE.Vector3(
      origin.x+side*Math.cos(heading)+longitudinal*Math.sin(heading),
      origin.y,
      origin.z-side*Math.sin(heading)+longitudinal*Math.cos(heading)
    );
    for(let seat=0;seat<occupants.length;seat++){
      let found=null;
      for(let trial=0;trial<20;trial++){
        const dz=baseZ[(seat+trial)%baseZ.length],side=trial<10?4.9:-4.9;
        const target=toWorld(side,dz);
        const floor=this.environment.getElevationAt?.(target.x,target.z,origin.y);
        if(!Number.isFinite(floor)||Math.abs(floor-origin.y)>APC_SECTION_RULES.maxFloorDifference)continue;
        target.y=floor;
        if(!nav.canStand(target,.8))continue;
        const adjusted=nav.safeSpawnNear(target,.8,occupied,3);
        if(!valid(adjusted)||!nav.canStand(adjusted,.8)||
          this.environment.hasLineOfSight?.(
            new THREE.Vector3(origin.x+4.1*Math.cos(heading),origin.y+1,
              origin.z-4.1*Math.sin(heading)),
            adjusted.clone().add(new THREE.Vector3(0,1,0)),
            {ignoreOwner:'apc'})===false||
          Math.abs(adjusted.y-origin.y)>APC_SECTION_RULES.maxFloorDifference||
          Math.hypot(adjusted.x-origin.x,adjusted.z-origin.z)>APC_SECTION_RULES.maxExitDistance)continue;
        found=adjusted;break;
      }
      if(!found)return this._result({accepted:false,reason:'no_safe_marine_dismount',seat});
      occupied.push({position:found,radius:.8});
      placements.push({unitId:occupants[seat],position:[found.x,found.z]});
    }
    const answer=this.simulation.disembarkAPC(placements,manifest.frontId);
    return this._result({...answer,event:'disembark'});
  }

  carrierDestroyed(killerFaction=null){
    this.drive.stop('carrier_destroyed');
    return this.simulation?.destroyAPCManifest(killerFaction)??{accepted:false,reason:'no_simulation'};
  }

  /** A mission changing sectors should attempt safe disembark, not dispose
   * an occupied carrier and then mint a new unrelated crew/section. */
  beforeRedeploy(){
    if(!this.manifest)return{accepted:true};
    return this.disembark();
  }

  dispose(){this.drive.dispose();this.disposed=true;this.apc=null;this.simulation=null;this.environment=null;this.actors=()=>{};this.onMove=()=>{};}
}
