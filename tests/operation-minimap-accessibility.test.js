import test from 'node:test';
import assert from 'node:assert/strict';
import { UIManager } from '../js/ui/UIManager.js';

test('the actual fronts minimap draws monochrome role shapes, stale hollow reports and dashed closed routes',()=>{
 const calls=[],styles=[],ctx=new Proxy({}, {get:(object,key)=>object[key]??((...args)=>calls.push([key,...args])),set:(object,key,value)=>{object[key]=value;if(key==='fillStyle')styles.push(value);return true;}});
 const ui={minimapCtx:ctx,minimapCanvas:{width:224,height:224},presentationPreferences:{get:()=>({palette:'monochrome',symbols:true,reducedFlashes:true})},_operationHUD:{layout:{bounds:{minX:0,maxX:200,minZ:0,maxZ:200},sectors:[]},state:{playerFaction:'clan',relationships:{clan:'allied',hive:'hostile',civilian:'neutral'},routes:[{open:false,waypoints:[[0,0],[200,0]]}],fronts:[{id:'home',label:'Départ',position:[10,10],owner:'clan'},{id:'enemy',label:'Objectif',position:[190,190],owner:'hive',intelState:'unknown'}],groups:[{id:'a',label:'Alliés',position:[20,20],factionId:'clan',alive:2,precisePositionKnown:true},{id:'b',label:'Rapport ennemi',position:[150,150],factionId:'hive',alive:2,precisePositionKnown:false},{id:'c',label:'Neutres',position:[100,100],factionId:'civilian',alive:2,precisePositionKnown:true}]},players:[{id:'player1',position:[30,30],hp:100}],objectives:{tasks:[{position:[170,170],label:'Relais',available:true,status:'pending'}]}}};
 UIManager.prototype.renderOperationMap.call(ui);
 const glyphs=calls.filter(([name])=>name==='fillText').map(([,text])=>text);assert.ok(glyphs.includes('P'));assert.ok(glyphs.includes('X'));assert.ok(glyphs.includes('O'));assert.ok(glyphs.includes('Objectif ?'));
 assert.ok(calls.some(([name,dashes])=>name==='setLineDash'&&dashes.length===2));assert.ok(calls.some(([name])=>name==='rect'),'neutral square uses real non-color shape');assert.ok(calls.some(([name])=>name==='closePath'),'triangles, stars and diamonds use their real outlines');
 assert.ok(styles.includes('#FFFFFF'));assert.equal(styles.some(color=>['#ef817d','#76b6f0','#c7bb94','#ddffb1'].includes(color)),false,'legacy faction and objective colors no longer bypass monochrome preferences');
 const baseline=calls.filter(([name])=>name==='fill').length;ui._operationHUD.state.groups[1].precisePositionKnown=true;calls.length=0;UIManager.prototype.renderOperationMap.call(ui);assert.equal(calls.filter(([name])=>name==='fill').length,baseline+1,'a stale report remains hollow until contact is actually current');
});
