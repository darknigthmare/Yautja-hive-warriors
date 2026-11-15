/* Rendering-independent TPS boom collision. Solve after smoothing/shake so
 * interpolation cannot put the final camera behind a wall. No meshes hide. */
import * as THREE from 'three';
import { traceCombatSegment } from './CombatGeometry.js';
const finitePoint=point=>point?.isVector3 ? [point.x,point.y,point.z].every(Number.isFinite) : Array.isArray(point)&&point.length===3&&point.every(Number.isFinite);
const vector=point=>point?.isVector3 ? point.clone() : new THREE.Vector3(...point);

/** Radius enclosing the camera near-plane rectangle. Does not change FOV. */
export function cameraNearPlaneRadius(camera,{minimum=.25,maximum=1.2}={}) {
  if(!camera || ![camera.near,camera.fov,camera.aspect,camera.zoom??1,minimum,maximum].every(Number.isFinite) || camera.near<=0 || camera.aspect<=0 || camera.fov<=0 || camera.fov>=179 || (camera.zoom??1)<=0 || minimum<0 || maximum<minimum)throw new TypeError('A finite perspective camera and valid radius bounds are required');
  const halfHeight=camera.near*Math.tan(camera.fov*Math.PI/360)/(camera.zoom??1);
  return Math.min(maximum,Math.max(minimum,Math.hypot(halfHeight,halfHeight*camera.aspect)));
}

/**
 * world is the physical collider array, or an environment exposing colliders
 * (preferred) / traceSegment. A collider may opt out with blocksCamera:false.
 * minDistance is a framing preference, never permission to cross an obstacle.
 */
export function resolveThirdPersonCamera(anchor,desired,world=[],{radius=.32,padding=.08,minDistance=.45,ignoreOwner,ignore=new Set()}={}) {
  if(!finitePoint(anchor)||!finitePoint(desired)||![radius,padding,minDistance].every(Number.isFinite)||radius<0||padding<0||minDistance<0||!(ignore instanceof Set))throw new TypeError('Camera collision needs finite positions and nonnegative dimensions');
  const from=vector(anchor),requested=vector(desired),direction=requested.clone().sub(from),requestedDistance=direction.length();
  if(requestedDistance<1e-8)return {position:requested,collided:false,resolved:true,anchorBlocked:false,compressed:requestedDistance<minDistance,distance:requestedDistance,requestedDistance,hit:null};
  const colliders=Array.isArray(world) ? world : world?.colliders;
  let hit=null;
  if(Array.isArray(colliders)) {
    // Projectile permeability is independent of solid camera collision: a pane
    // can let projectiles through while still occupying physical space.
    const physical=[];
    for(const collider of colliders) {
      if(!collider || collider.blocksCamera===false || ignore.has(collider))continue;
      if(collider.blocksProjectiles===false || collider.projectileBlocker===false)physical.push({...collider,blocksProjectiles:true,projectileBlocker:true,_cameraSource:collider});
      else physical.push(collider);
    }
    hit=traceCombatSegment(from,requested,physical,{radius,ignoreOwner});
    if(hit?.collider?._cameraSource)hit={...hit,collider:hit.collider._cameraSource};
  } else if(typeof world?.traceSegment==='function')hit=world.traceSegment(from,requested,{radius,ignoreOwner,ignore});
  else throw new TypeError('Camera collision requires physical colliders or traceSegment');
  if(!hit)return {position:requested,collided:false,resolved:true,anchorBlocked:false,compressed:requestedDistance<minDistance,distance:requestedDistance,requestedDistance,hit:null};
  if(!Number.isFinite(hit.t)||hit.t<0||hit.t>1)throw new TypeError('Physical camera traces must return a finite segment fraction');
  const anchorBlocked=hit.t<=1e-8,distance=Math.max(0,Math.min(requestedDistance,hit.t*requestedDistance-padding));
  const position=from.addScaledVector(direction.normalize(),distance);
  return {position,collided:true,resolved:!anchorBlocked,anchorBlocked,compressed:distance<minDistance,distance,requestedDistance,hit};
}
