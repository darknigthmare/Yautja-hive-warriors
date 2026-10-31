import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattlefieldNavigation } from '../js/engine/BattlefieldNavigation.js';

const single={id:'sector',center:[0,0],bounds:{minX:-27,maxX:27,minZ:-27,maxZ:27}};
const here=(x,z)=>new THREE.Vector3(x,0,z);
const inside=(p,b)=>p.x>=b.minX&&p.x<=b.maxX&&p.z>=b.minZ&&p.z<=b.maxZ;
function smallEnvironment({floor=[single.bounds],colliders=[],layout=null}={}){
  const l=layout??{sectors:[single],corridors:[],strategicRoutes:[],corridorWidth:18};
  return {
    colliders,acidTrenches:[],battlefieldLayout:l,openGates:new Set(),
    isGateOpen(id){return this.openGates.has(id);},
    getSectorAt(point){return l.sectors.find(sector=>inside(point,sector.bounds))??null;},
    accessibleBattlefieldRects(){return floor;}
  };
}
const wall=(halfWidth,halfDepth)=>({
  x:0,z:0,halfWidth,halfDepth,rotation:0,baseY:0,height:4
});
const round=p=>[Math.round(p.x*100)/100,Math.round(p.z*100)/100];

test('a room-spanning solid wall has no safe A* detour: an agent holds rather than crossing it',()=>{
  const env=smallEnvironment({colliders:[wall(28,2)]});
  const navigator=new BattlefieldNavigation(env);
  const from=here(0,-18),goal=here(0,18),original=from.clone();
  for(let i=0;i<5;i++)
    assert.deepEqual(round(navigator.waypoint(from,goal,.65)),round(from));
  assert.deepEqual(from.toArray(),original.toArray());
  env.colliders=[];navigator.gridCache.clear();
  assert.deepEqual(round(navigator.waypoint(from,goal,.65)),round(goal),
    'when the wall is actually removed the route becomes legal again');
});

test('a missing floor strip blocks direct guidance even without a single collision mesh',()=>{
  const left={minX:-27,maxX:-2,minZ:-27,maxZ:27};
  const right={minX:2,maxX:27,minZ:-27,maxZ:27};
  const navigator=new BattlefieldNavigation(smallEnvironment({floor:[left,right]}));
  const from=here(-18,0),goal=here(18,0);
  const safe=navigator.waypoint(from,goal,.65);
  assert.deepEqual(round(safe),round(from),
    'a clear line of sight is not traversable terrain: the floor is discontinuous');
  assert.equal(navigator.localPath(from,goal,.65).length,0);
});

test('a smaller prop still permits real 3D navigation around its corners without phasing through it',()=>{
  const env=smallEnvironment({colliders:[wall(3,3)]});
  const navigator=new BattlefieldNavigation(env);
  const from=here(-18,0),goal=here(18,0);
  let moved=0,bypassed=false;
  for(let frame=0;frame<300&&from.distanceTo(goal)>1;frame++){
    const target=navigator.waypoint(from,goal,.65);
    const delta=target.clone().sub(from);const length=delta.length();
    assert.ok(length>.0001,'the open detour should always offer forward progress');
    const step=Math.min(.5,length);
    from.addScaledVector(delta.normalize(),step);moved+=step;
    const dx=from.x-THREE.MathUtils.clamp(from.x,-3,3);
    const dz=from.z-THREE.MathUtils.clamp(from.z,-3,3);
    assert.ok(Math.hypot(dx,dz)>=.64,
      `agent intersected solid cover at ${from.x.toFixed(2)},${from.z.toFixed(2)}`);
    if(Math.abs(from.z)>3.65)bypassed=true;
  }
  assert.ok(bypassed,'the route must physically go around the box');
  assert.ok(from.distanceTo(goal)<1,'a valid alternative must remain traversable');
  assert.ok(moved<90,'no teleport or unbounded circling');
});

test('a closed physical gate blocks the corridor, but an opened gate restores a safe route',()=>{
  const sectors=[
    {id:'west',center:[-90,0],bounds:{minX:-120,maxX:-50,minZ:-27,maxZ:27}},
    {id:'east',center:[90,0],bounds:{minX:50,maxX:120,minZ:-27,maxZ:27}}
  ];
  const corridor={id:'hall',from:'west',to:'east',center:[0,0],
    bounds:{minX:-52,maxX:52,minZ:-9,maxZ:9}};
  const layout={sectors,corridors:[corridor],strategicRoutes:[],gates:[
    {id:'security-gate',corridorId:'hall',from:'west',to:'east'}]};
  const env=smallEnvironment({layout,floor:[...sectors.map(s=>s.bounds),corridor.bounds]});
  const navigator=new BattlefieldNavigation(env);
  const from=here(-85,0),goal=here(85,0);
  assert.deepEqual(round(navigator.waypoint(from,goal,.7)),round(from),
    'a locked corridor must not be bypassed through clear visual space');
  env.openGates.add('security-gate');
  const next=navigator.waypoint(from,goal,.7);
  assert.ok(next.distanceTo(from)>1,'opened gate permits guidance again');
  assert.ok(next.z===0&&next.x<=85&&next.x>=-90);
});

test('navigation retains its finite no-map fallback and input validation for moving NPCs',()=>{
  const env=smallEnvironment();
  const nav=new BattlefieldNavigation(env);
  assert.equal(nav.waypoint(null,here(1,1)),null);
  assert.equal(nav.waypoint(here(0,0),here(NaN,1)),null);
  const from=here(-10,0),to=here(10,0);
  assert.deepEqual(round(nav.waypoint(from,to,.7)),round(to));
  assert.equal(nav.localPath(from,to,.7).length>0,true);
});
