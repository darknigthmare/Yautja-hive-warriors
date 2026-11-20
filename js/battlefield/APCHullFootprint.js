/* M577 conservative XZ hull footprint against registered physical cover.
 * Unlike nine point samples, this rejects small solid objects hidden BETWEEN
 * those samples. The road navigation still validates all floor probes, gates
 * and custom navigationTest colliders. This is not film prop mesh fidelity. */
import { APC_NAVIGATION } from '../graphics/APCModel.js';

const finite = (...v) => v.every(Number.isFinite);
const basis = yaw => ({
  side: [Math.cos(yaw),-Math.sin(yaw)],
  fore: [Math.sin(yaw), Math.cos(yaw)]
});
const dot=(a,b)=>a[0]*b[0]+a[1]*b[1];

/** Complete oriented footprint vs a solid round/rotated-box collider.
 * Null for a custom collider that needs its own navigationTest sampling. */
export function m577HullIntersectsCollider(position,yaw,collider) {
  if(!position?.isVector3||!finite(position.x,position.y,position.z,yaw)||
    !collider||collider.owner==='apc'||collider.blocksNavigation===false||
    collider.enabled===false||collider.solid===false)return false;
  if(typeof collider.isCollisionActive==='function'&&
    collider.isCollisionActive()===false)return false;
  // Dynamic gates and bridges can expose an occupancy predicate dependent
  // on the actor's position, vertical layer or phase. Never overrule that
  // authoritative predicate with an unconditional static rectangle check.
  if(typeof collider.navigationTest==='function'||
     typeof collider.isNavigationActive==='function')return null;
  if(!finite(collider.x,collider.z))return null;
  const base=collider.baseY??0,height=collider.height??0;
  if(!finite(base,height)||height<0)return null;
  // The real navigation predicate counts actors rooted on the deck as tall
  // enough to interact with cover; use the M577 full navigation hull height.
  if(position.y>(base+height+.2)||
     position.y+APC_NAVIGATION.height<base)return false;
  const body=basis(yaw),center=[
    position.x+APC_NAVIGATION.centerZ*body.fore[0],
    position.z+APC_NAVIGATION.centerZ*body.fore[1]
  ];
  const d=[collider.x-center[0],collider.z-center[1]];
  if(collider.halfWidth===undefined||collider.halfWidth===null){
    if(!finite(collider.radius)||collider.radius<0)return null;
    const x=dot(d,body.side),z=dot(d,body.fore);
    const outsideX=Math.max(0,Math.abs(x)-APC_NAVIGATION.halfWidth);
    const outsideZ=Math.max(0,Math.abs(z)-APC_NAVIGATION.halfDepth);
    return Math.hypot(outsideX,outsideZ)<=collider.radius+1e-8;
  }
  if(!finite(collider.halfWidth,collider.halfDepth,collider.rotation??0)||
     collider.halfWidth<0||collider.halfDepth<0)return null;
  const obstacle=basis(collider.rotation??0);
  // The separating-axis theorem checks both axes of both oriented boxes.
  // It catches even a very thin vertical rod lying inside the full hull.
  for(const axis of [body.side,body.fore,obstacle.side,obstacle.fore]){
    const a=APC_NAVIGATION.halfWidth*Math.abs(dot(body.side,axis))+
      APC_NAVIGATION.halfDepth*Math.abs(dot(body.fore,axis));
    const b=collider.halfWidth*Math.abs(dot(obstacle.side,axis))+
      collider.halfDepth*Math.abs(dot(obstacle.fore,axis));
    if(Math.abs(dot(d,axis))>a+b+1e-8)return false;
  }
  return true;
}

/** Block only known solid registered colliders. Unknown custom polygon
 * navigation stays in the existing physically sampled canStand contract. */
export function m577HullBlocked(position,yaw,colliders=[]) {
  if(!Array.isArray(colliders))return true;
  for(const collider of colliders)
    if(m577HullIntersectsCollider(position,yaw,collider)===true)return true;
  return false;
}
