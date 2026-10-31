/* Finite, opt-in USCM M577 convoy: a real hull moves along a declared
 * one-leg route while its ORIGINAL crew and passengers retain their IDs.
 * Any missing floor, closed physical gate or obstructed full hull stops the
 * carrier. No RTS troop production, no cinematographic steering claim. */
import * as THREE from 'three';
import { M577_ROUTE_RULES } from './APCSectionManifest.js';
import { physicalOperationRouteAvailable } from './PhysicalRouteAvailability.js';
import { APC_NAVIGATION } from '../graphics/APCModel.js';

export const M577_DRIVE_POLICY=Object.freeze({
  speed:4.8,stepLength:.6,maxDelta:.25,maxStepsPerUpdate:8,
  maxCenterHeightStep:.75,maxBodyHeightDelta:1.25,
  hullSide:2.35,hullFore:4.5,collisionRadius:.4,
  visualFidelity1to1Verified:false
});
const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const point=p=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const isVector=p=>p?.isVector3&&[p.x,p.y,p.z].every(Number.isFinite);
const relationOk=(sim,owner,other)=>owner===other||
  !!other&&sim.relationship(owner,other)==='allied';
const rotated=(center,side,longitudinal,angle)=>
  new THREE.Vector3(center.x+side*Math.cos(angle)+longitudinal*Math.sin(angle),
    center.y,center.z-side*Math.sin(angle)+longitudinal*Math.cos(angle));

export class APCConvoyDrive {
  constructor(service){this.service=service;this.journey=null;this.lastResult=null;}
  get active(){return !!this.journey;}
  _result(accepted,reason,extra={}) {
    this.lastResult={accepted,reason,...extra};
    return this.lastResult;
  }
  _routeOpen(route){
    const s=this.service,sim=s.simulation;
    return !!route?.open&&
      physicalOperationRouteAvailable(s.environment,route)&&
      sim?.routeAvailabilityProvider?.(route)!==false;
  }
  _frontFriendly(id,owner){
    const sim=this.service.simulation,front=sim?.fronts?.get(id);
    return !!front&&!front.contested&&relationOk(sim,owner,front.owner);
  }
  /** Only adjacent front legs, never an implicit multi-front jump.
   * Each subsequent leg requires a fresh order from an authorized player. */
  request(targetFrontId) {
    const s=this.service,sim=s.simulation,m=s.manifest,apc=s.apc;
    if(this.active)return this._result(false,'convoy_already_moving');
    if(!s.available||!s.validateCarrierPosition().accepted)
      return this._result(false,'carrier_unavailable_or_desynced');
    if(!m||!Array.isArray(m.crew)||m.crew.length<1||
      !(sim.units.get(m.crew[0])?.hp>0))
      return this._result(false,'real_driver_required');
    if(!this._frontFriendly(m.frontId,m.ownerFaction)||
      !this._frontFriendly(targetFrontId,m.ownerFaction)||
      m.frontId===targetFrontId)return this._result(false,'friendly_adjacent_front_required');
    const choices=[...sim.routes.values()].filter(route=>
      ((route.from===m.frontId&&route.to===targetFrontId)||
       (route.to===m.frontId&&route.from===targetFrontId))&&this._routeOpen(route))
      .sort((a,b)=>a.travelSeconds-b.travelSeconds||a.id.localeCompare(b.id));
    const route=m.transit?
      choices.find(row=>row.id===m.transit.routeId&&
        m.transit.fromFrontId===m.frontId&&
        m.transit.toFrontId===targetFrontId):choices[0];
    if(!route)return this._result(false,m.transit?'convoy_route_still_blocked':'no_physical_adjacent_route');
    const waypoints=(route.from===m.frontId?route.waypoints:[...route.waypoints].reverse())
      .map(item=>[...item]);
    let index=0;
    if(m.transit){
      // Resume on the nearest segment of the exact signed route.
      let best=Infinity,indexOfSegment=1,segmentT=0;
      for(let i=1;i<waypoints.length;i++){
        const a=waypoints[i-1],b=waypoints[i],dx=b[0]-a[0],dz=b[1]-a[1],
          norm=dx*dx+dz*dz,t=norm>1e-9?
          Math.max(0,Math.min(1,((m.position[0]-a[0])*dx+
            (m.position[1]-a[1])*dz)/norm)):0;
        const d=distance(m.position,[a[0]+t*dx,a[1]+t*dz]);
        if(d<best){best=d;indexOfSegment=i;segmentT=t;}
      }
      if(best>M577_ROUTE_RULES.maxRouteOffset)
        return this._result(false,'carrier_outside_signed_road');
      index=indexOfSegment+(segmentT>.999&&indexOfSegment<waypoints.length-1?1:0);
    }
    this.journey={routeId:route.id,targetFrontId,waypoints,index,meters:0};
    s.feedback('M577 : convoi engagé sur route physique vers '+sim.fronts.get(targetFrontId).label+'.');
    return this._result(true,'convoy_started',{routeId:route.id,targetFrontId});
  }
  stop(reason='manual_stop'){
    if(!this.journey)return this._result(false,'convoy_not_moving');
    this.journey=null;
    this.service.feedback(reason==='manual_stop'?
      'M577 : convoi arrêté. Les Marines restent dans le véhicule.':
      'M577 : déplacement interrompu ('+reason+'). Aucun soldat déplacé artificiellement.');
    return this._result(true,reason);
  }
  _canOccupy(position,yaw){
    const s=this.service,env=s.environment,nav=env?.navigation;
    if(!isVector(position)||!nav?.canStand||!env?.getElevationAt)return false;
    for(const side of [-M577_DRIVE_POLICY.hullSide,0,M577_DRIVE_POLICY.hullSide]){
      for(const longitudinal of [-M577_DRIVE_POLICY.hullFore,0,M577_DRIVE_POLICY.hullFore]){
        const sample=rotated(position,side,longitudinal,yaw);
        const y=env.getElevationAt(sample.x,sample.z,position.y);
        if(!Number.isFinite(y)||Math.abs(y-position.y)>
           M577_DRIVE_POLICY.maxBodyHeightDelta)return false;
        sample.y=y;
        if(!nav.canStand(sample,M577_DRIVE_POLICY.collisionRadius,
          {ignoreOwner:'apc'}))return false;
      }
    }
    // The hull must not sweep straight through a second physical actor.
    for(const entry of s.actors?.()??[]){
      const actor=entry?.actor??entry,p=actor?.mesh?.position??actor?.position;
      if(!isVector(p)||!(actor?.hp>0))continue;
      if(Math.abs(p.y-position.y)>3.5)continue;
      const relative=p.clone().sub(position),
        side=relative.x*Math.cos(yaw)-relative.z*Math.sin(yaw),
        fore=relative.x*Math.sin(yaw)+relative.z*Math.cos(yaw);
      const r=actor.radius??.75;
      if(Math.abs(side)<APC_NAVIGATION.halfWidth+r&&
        Math.abs(fore)<APC_NAVIGATION.halfDepth+r)return false;
    }
    return true;
  }
  _moveToward(target,step){
    const s=this.service,m=s.manifest,apc=s.apc,p=apc?.mesh?.position;
    if(!m||!isVector(p)||!point(target))return false;
    const separation=distance([p.x,p.z],target);
    if(separation<=1e-9)return true;
    const stride=Math.min(step,separation),dx=(target[0]-p.x)/separation,
      dz=(target[1]-p.z)/separation;
    const next=new THREE.Vector3(p.x+dx*stride,p.y,p.z+dz*stride);
    const floor=s.environment.getElevationAt?.(next.x,next.z,p.y);
    if(!Number.isFinite(floor)||Math.abs(floor-p.y)>
      M577_DRIVE_POLICY.maxCenterHeightStep)return false;
    next.y=floor;
    const yaw=Math.atan2(dx,dz);
    // Check both the old and the new footprint orientation: a sharp turn
    // cannot swing the long rear hull through a closed wall or missing floor.
    const startYaw=apc.mesh.rotation.y;
    const turn=Math.atan2(Math.sin(yaw-startYaw),Math.cos(yaw-startYaw));
    if(!this._canOccupy(next,startYaw)||
       !this._canOccupy(next,startYaw+turn*.5)||
       !this._canOccupy(next,yaw))return false;
    // The signed battle state accepts the step before the physical mesh moves.
    if(!s.simulation.moveAPCManifest([next.x,next.z],m.frontId))return false;
    apc.mesh.position.copy(next);apc.mesh.rotation.y=yaw;
    apc.lastPosition?.copy?.(next);
    s.onMove();
    return true;
  }
  update(delta){
    const j=this.journey,s=this.service,m=s.manifest,sim=s.simulation;
    if(!j||!Number.isFinite(delta)||delta<=0)return false;
    if(!m||sim.disposed||sim.result||!s.available||
      !s.validateCarrierPosition().accepted){this.stop('carrier_unavailable');return false;}
    const route=sim.routes.get(j.routeId);
    if(!this._routeOpen(route)){this.stop('physical_route_closed');return false;}
    if(!this._frontFriendly(j.targetFrontId,m.ownerFaction)){
      this.stop('destination_contested');return false;
    }
    let remaining=M577_DRIVE_POLICY.speed*Math.min(delta,M577_DRIVE_POLICY.maxDelta);
    for(let tries=0;tries<M577_DRIVE_POLICY.maxStepsPerUpdate&&remaining>1e-6&&this.journey;tries++){
      const current=s.apc.mesh.position,target=j.waypoints[j.index];
      if(!target){
        if(!s.manifest?.transit||!sim.completeAPCTransit()){
          this.stop('arrival_not_authorized');return false;
        }
        this.journey=null;this._result(true,'arrived',{targetFrontId:j.targetFrontId});
        s.feedback('M577 : arrivé au front. Débarquement désormais possible.');
        return true;
      }
      const gap=distance([current.x,current.z],target);
      if(gap<=.2){
        if(j.index===0&&!m.transit){
          // An invalid floor or obstructed body cannot even mark a parked
          // carrier as "in transit" before its first genuine wheel movement.
          if(!this._canOccupy(current,s.apc.mesh.rotation.y)){
            this.stop('terrain_or_collision_blocked');return false;
          }
          if(!sim.beginAPCTransit(j.routeId,j.targetFrontId)){
            this.stop('transit_not_authorized');return false;
          }
        }
        j.index++;continue;
      }
      const stride=Math.min(remaining,gap,M577_DRIVE_POLICY.stepLength);
      if(!this._moveToward(target,stride)){
        this.stop('terrain_or_collision_blocked');return false;
      }
      j.meters+=stride;remaining-=stride;
    }
    return true;
  }
  state(){
    return {travelling:this.active,targetFrontId:this.journey?.targetFrontId??null,
      transit:this.service.manifest?.transit!==undefined,
      lastReason:this.lastResult?.reason??null};
  }
  dispose(){this.journey=null;this.service=null;}
}
