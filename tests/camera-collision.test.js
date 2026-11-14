import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { resolveThirdPersonCamera, cameraNearPlaneRadius } from '../js/engine/CameraCollision.js';
import { traceCombatSegment } from '../js/engine/CombatGeometry.js';
const v=(x,y=2,z=0)=>new THREE.Vector3(x,y,z);
const wall={x:5,z:0,halfWidth:.5,halfDepth:10,height:6};

test('TPS camera stops its swept near-plane volume in front of a real wall without mutating any input',()=>{
  const anchor=v(0),desired=v(10),result=resolveThirdPersonCamera(anchor,desired,[wall]);
  assert.equal(result.collided,true);assert.equal(result.resolved,true);assert.ok(Math.abs(result.position.x-4.1)<1e-8);
  assert.equal(traceCombatSegment(anchor,result.position,[wall],{radius:.32}),null);
  assert.deepEqual(anchor.toArray(),[0,2,0]);assert.deepEqual(desired.toArray(),[10,2,0]);assert.equal(wall.halfWidth,.5);
  assert.equal(wall.mesh,undefined,'collision does not alter render objects or visibility');
});

test('two walls at a corner constrain diagonal camera motion and remain safe after smoothing or shake',()=>{
  const corner=[{x:4,z:0,halfWidth:.2,halfDepth:10,height:6},{x:0,z:4,halfWidth:10,halfDepth:.2,height:6}];
  const anchor=v(0),desired=v(8,3,8),first=resolveThirdPersonCamera(anchor,desired,corner);
  assert.equal(first.collided,true);assert.ok(first.position.x<3.5 && first.position.z<3.5);
  const camera=first.position.clone();
  for(let frame=0;frame<120;frame++) {
    const candidate=camera.clone().lerp(v(8+Math.sin(frame)*2,3,8-Math.cos(frame)*2),.2).add(v(.1,0,.1));
    const solved=resolveThirdPersonCamera(anchor,candidate,corner);camera.copy(solved.position);
    assert.equal(traceCombatSegment(anchor,camera,corner,{radius:.32}),null);
  }
});

test('cooperative cameras solve independently for two anchors and never share a collision distance',()=>{
  const p1=new THREE.PerspectiveCamera(60,16/9,.1,100),p2=new THREE.PerspectiveCamera(60,8/9,.1,100);
  const a1=v(0),a2=v(0,2,20),d1=v(10),d2=v(10,2,20);
  const r1=resolveThirdPersonCamera(a1,d1,[wall],{radius:cameraNearPlaneRadius(p1)}),r2=resolveThirdPersonCamera(a2,d2,[wall],{radius:cameraNearPlaneRadius(p2)});
  p1.position.copy(r1.position);p2.position.copy(r2.position);
  assert.equal(r1.collided,true);assert.equal(r2.collided,false);assert.deepEqual(p2.position.toArray(),[10,2,20]);
  const saved=p1.position.clone();resolveThirdPersonCamera(a2,v(30,2,20),[wall]);assert.deepEqual(p1.position.toArray(),saved.toArray());
});

test('rotated walls, cylinder props, low cover and hidden render meshes use physical geometry',()=>{
  const rotated={x:5,z:0,halfWidth:3,halfDepth:.2,height:6,rotation:Math.PI/2,mesh:{visible:false}};
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[rotated]).collided,true);assert.equal(rotated.mesh.visible,false);
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[{x:5,z:0,radius:1,height:3}]).collided,true);
  assert.equal(resolveThirdPersonCamera(v(0,5),v(10,5),[{...wall,height:2}]).collided,false);
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[{...wall,enabled:false}]).collided,false);
});

test('close cover takes priority over minimum framing distance and an embedded anchor is reported honestly',()=>{
  const close={...wall,x:1,halfWidth:.5},result=resolveThirdPersonCamera(v(0),v(10),[close],{radius:.32,padding:.08,minDistance:2});
  assert.ok(result.distance<2);assert.equal(result.compressed,true);assert.ok(result.position.x<.2);
  const embedded=resolveThirdPersonCamera(v(1),v(10),[close]);assert.equal(embedded.anchorBlocked,true);assert.equal(embedded.resolved,false);assert.deepEqual(embedded.position.toArray(),[1,2,0]);
  assert.deepEqual(resolveThirdPersonCamera(v(0),v(0),[]).position.toArray(),[0,2,0]);
});

test('camera opt-out, projectile permeability and custom moving physics stay explicit',()=>{
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[{...wall,blocksCamera:false}]).collided,false);
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[{...wall,blocksProjectiles:false}]).collided,true);
  const custom={resolveMovement(){},traceSegment(from,to,{radius}){assert.equal(radius,.32);return {t:.4,point:from.clone().lerp(to,.4)};}};
  assert.ok(resolveThirdPersonCamera(v(0),v(10),[custom]).position.x<4);
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[custom],{ignore:new Set([custom])}).collided,false);
  assert.equal(resolveThirdPersonCamera(v(0),v(10),[{resolveMovement(){},...wall}]).collided,false,'a conservative navigation envelope is not a physical wall');
});

test('near-plane sizing is finite and malformed camera or trace inputs fail before corrupting a camera',()=>{
  const camera=new THREE.PerspectiveCamera(75,16/9,.2,100);assert.ok(cameraNearPlaneRadius(camera)>=.25);
  assert.throws(()=>resolveThirdPersonCamera([NaN,0,0],[1,2,3],[]),/finite/);
  assert.throws(()=>resolveThirdPersonCamera(v(0),v(1),[],{radius:-1}),/nonnegative/);
  assert.throws(()=>cameraNearPlaneRadius({near:0,fov:60,aspect:1}),/finite/);
});
