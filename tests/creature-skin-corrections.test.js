import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { geometryAttributeHash, getCorrectedCreatureTemplate } from '../js/graphics/CreatureSkinCorrections.js';

function fixture() {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,1,1,0],3));
  geometry.setIndex([0,1,2,1,3,2]);
  geometry.setAttribute('skinIndex',new THREE.Uint16BufferAttribute([1,0,0,0,1,0,0,0,0,0,0,0,0,0,0,0],4));
  geometry.setAttribute('skinWeight',new THREE.Float32BufferAttribute([.8,.2,0,0,1,0,0,0,1,0,0,0,1,0,0,0],4));
  const hips=new THREE.Bone();hips.name='Hips';const leg=new THREE.Bone();leg.name='Leg';hips.add(leg);
  const mesh=new THREE.SkinnedMesh(geometry,new THREE.MeshStandardMaterial());mesh.name='SyntheticTail';mesh.add(hips);mesh.bind(new THREE.Skeleton([hips,leg]));
  const scene=new THREE.Group();scene.add(mesh);
  const gltf={scene,animations:[new THREE.AnimationClip('walk',1,[new THREE.VectorKeyframeTrack('Hips.position',[0,1],[0,0,0,0,0,1])])]};
  const config={calibrated:true,id:'explicit-synthetic-tail-test',meshes:[{meshName:mesh.name,vertexCount:4,indexCount:6,positionHash:geometryAttributeHash(geometry.attributes.position),indexHash:geometryAttributeHash(geometry.index),skinIndexHash:geometryAttributeHash(geometry.attributes.skinIndex),skinWeightHash:geometryAttributeHash(geometry.attributes.skinWeight),targetBone:'Hips',vertexRanges:[[0,2]]}]};
  return{gltf,config,mesh,geometry};
}

test('no opt-in keeps the identical source template',()=>{
 const {gltf}=fixture();assert.equal(getCorrectedCreatureTemplate(gltf).template,gltf);
 assert.throws(()=>getCorrectedCreatureTemplate(gltf,{calibrated:false}),/calibrated correction required/);
});

test('explicit tail correction edits selected weights only, keeps rest geometry and source intact, and is shared',()=>{
 const {gltf,config,mesh,geometry}=fixture();
 const before=Object.fromEntries(Object.entries(geometry.attributes).map(([k,v])=>[k,Array.from(v.array)]));
 const inverse=mesh.skeleton.boneInverses.map(m=>m.elements.slice());
 const first=getCorrectedCreatureTemplate(gltf,config),second=getCorrectedCreatureTemplate(gltf,structuredClone(config));
 assert.equal(first,second);assert.notEqual(first.template,gltf);assert.notEqual(first.template.scene,gltf.scene);
 const corrected=first.template.scene.getObjectByName(mesh.name);assert.notEqual(corrected.geometry,geometry);
 assert.equal(corrected.material,mesh.material);assert.equal(first.template.animations,gltf.animations);
 for(const name of ['position','skinIndex','skinWeight'])assert.deepEqual(Array.from(geometry.attributes[name].array),before[name]);
 assert.deepEqual(Array.from(corrected.geometry.attributes.position.array),before.position);
 assert.deepEqual(Array.from(corrected.geometry.index.array),Array.from(geometry.index.array));
 assert.deepEqual(Array.from(corrected.geometry.attributes.skinIndex.array).slice(0,8),[0,0,0,0,0,0,0,0]);
 assert.deepEqual(Array.from(corrected.geometry.attributes.skinWeight.array).slice(0,8),[1,0,0,0,1,0,0,0]);
 for(const name of ['skinIndex','skinWeight'])assert.deepEqual(Array.from(corrected.geometry.attributes[name].array).slice(8),before[name].slice(8));
 assert.notEqual(corrected.skeleton.bones[0],mesh.skeleton.bones[0]);
 assert.deepEqual(mesh.skeleton.boneInverses.map(m=>m.elements),inverse);
 assert.equal(first.diagnostics.meshes[0].selectedVertices,2);
});

test('wrong assets, missing bones and malformed ranges are rejected instead of guessing anatomy',()=>{
 for(const change of [c=>c.meshes[0].positionHash='fnv1a32:00000000',c=>c.meshes[0].skinWeightHash='fnv1a32:00000000',c=>c.meshes[0].targetBone='Unknown',c=>c.meshes[0].vertexRanges=[[0,3],[2,1]],c=>c.meshes[0].vertexRanges=[[3,2]],c=>c.meshes[0].vertexRanges=[[0,4]],c=>c.meshes[0].vertexCount=5]){
  const {gltf,config}=fixture();change(config);assert.throws(()=>getCorrectedCreatureTemplate(gltf,config),/CreatureSkinCorrections/);
 }
});

test('calibration with source-skin fingerprints refuses applying to an already corrected derivative',()=>{
 const{gltf,config}=fixture();const{template}=getCorrectedCreatureTemplate(gltf,config);
 assert.throws(()=>getCorrectedCreatureTemplate(template,config),/skinIndexHash does not match calibrated source/);
});

test('disjoint anatomical groups use different bones on one cloned geometry and reject overlap',()=>{
 const {gltf,config,geometry}=fixture();
 config.meshes[0].bindings=[{name:'tail',targetBone:'Hips',vertexRanges:[[0,1]]},{name:'foot',targetBone:'Leg',vertexRanges:[[3,1]]}];
 const result=getCorrectedCreatureTemplate(gltf,config),changed=result.template.scene.getObjectByName('SyntheticTail').geometry;
 assert.notEqual(changed,geometry);assert.equal(changed.attributes.skinIndex.getX(0),0);assert.equal(changed.attributes.skinIndex.getX(3),1);
 assert.equal(changed.attributes.skinIndex.getX(1),geometry.attributes.skinIndex.getX(1));
 assert.equal(result.diagnostics.meshes[0].selectedVertices,2);
 assert.deepEqual(result.diagnostics.meshes[0].bindings.map(b=>b.targetBone),['Hips','Leg']);
 const bad=structuredClone(config);bad.meshes[0].bindings[1].vertexRanges=[[0,1]];
 assert.throws(()=>getCorrectedCreatureTemplate(gltf,bad),/bindings cannot overlap/);
});
