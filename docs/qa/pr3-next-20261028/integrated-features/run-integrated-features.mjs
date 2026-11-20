// Controlled integration acceptance in a frozen production build.
// Browser execution requires ROOT's explicit scheduling flag and hash inputs.
import assert from 'node:assert/strict';
import { spawn } from 'node:child_process';
import { createHash } from 'node:crypto';
import { createReadStream, existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { LEVELS_DATA } from '../../../../js/data/levelsData.js';
import { CHARACTERS_DATA } from '../../../../js/data/charactersData.js';
import { finishMissionInsertion } from '../../../../tests/helpers/finish-insertion.mjs';

const root=resolve(import.meta.dirname,'../../../..');
const options={port:4319,expectedIndex:null,expectedSource:null,output:null,allowBrowser:false,cases:null};
for(let n=2;n<process.argv.length;n++){
  const flag=process.argv[n];
  if(flag==='--expected-index')options.expectedIndex=process.argv[++n];
  else if(flag==='--expected-source')options.expectedSource=process.argv[++n];
  else if(flag==='--output')options.output=resolve(process.argv[++n]);
  else if(flag==='--port')options.port=Number(process.argv[++n]);
  else if(flag==='--cases')options.cases=process.argv[++n].split(',');
  else if(flag==='--root-browser-go')options.allowBrowser=true;
  else throw new Error(`Unknown argument: ${flag}`);
}
assert.equal(options.allowBrowser,true,'No Chromium before ROOT gives GO and supplies --root-browser-go');
assert.match(options.expectedIndex??'',/^[a-f0-9]{64}$/);
assert.match(options.expectedSource??'',/^[a-f0-9]{40}$/);
assert.ok(options.output,'A new explicit proof directory is required');
assert.ok(Number.isInteger(options.port)&&options.port>1024&&options.port<65536);
const hashFile=async path=>{const hash=createHash('sha256');for await(const bytes of createReadStream(path))hash.update(bytes);return hash.digest('hex');};
async function tree(directory,prefix=''){
  const rows=[];for(const entry of await readdir(directory,{withFileTypes:true})){
    const path=resolve(directory,entry.name),name=prefix+entry.name;
    if(entry.isDirectory())rows.push(...await tree(path,name+'/'));else rows.push({path:name,sha256:await hashFile(path)});
  }return rows.sort((a,b)=>a.path.localeCompare(b.path));
}
const report={schemaVersion:1,status:'running',startedAt:new Date().toISOString(),humanTesters:0,fidelity1to1Verified:false,
  selectedCases:options.cases,fullFourCaseCoverage:!options.cases,
  scope:'Controlled UI and actual runtime integration acceptance; not natural victories, human playtesting or a measured reproduction of a film.',
  assistances:['deterministic advancement through the actual insertion cinematic','paused fixture setup between steps','up to five seconds of normal strategic updates at60Hz to wait for actual allocated allies to materialize; placement25U from an existing group only if needed','player placement beside actual world pickups and an actual allocated ally','camera framing of the existing actors','controlled fatal callback on an actual allocated allied actor and 0.35 s of its real falling posture','deterministic advancement of the actual three-second rescue channel','placement of two existing hostile actors on a physically clear shooting lane','direct damage through an active APC combatant to exercise destruction'],
  cases:[],errors:[],failedRequests:[],externalRequests:[]};
let browser,context,page,server,before,currentCase='boot';const baseURL=`http://127.0.0.1:${options.port}`;
const save=()=>writeFile(resolve(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
await mkdir(options.output,{recursive:false});

try{
  assert.equal(await hashFile(resolve(root,'dist/index.html')),options.expectedIndex,'Frozen HTML differs from ROOT authorization');
  before=await tree(resolve(root,'dist'));report.indexSha256=options.expectedIndex;report.distTreeSha256=createHash('sha256').update(JSON.stringify(before)).digest('hex');
  report.buildInfo=JSON.parse(await readFile(resolve(root,'dist/build-info.json'),'utf8'));
  assert.equal(report.buildInfo.sourceCommit,options.expectedSource,'Build source differs from ROOT authorization');
  server=spawn(process.execPath,['node_modules/vite/bin/vite.js','preview','--host','127.0.0.1','--port',String(options.port),'--strictPort'],{cwd:root,stdio:'ignore'});
  let ready=false;for(let n=0;n<100;n++){try{ready=(await fetch(baseURL)).ok;}catch{}if(ready)break;await new Promise(done=>setTimeout(done,100));}
  assert.ok(ready,'Frozen preview did not start');
  assert.equal(createHash('sha256').update(Buffer.from(await(await fetch(baseURL)).arrayBuffer())).digest('hex'),options.expectedIndex,'Preview must serve the authorized bytes');
  browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-unsafe-swiftshader']});
  context=await browser.newContext({viewport:{width:1000,height:760}});page=await context.newPage();page.setDefaultTimeout(30000);
  page.on('pageerror',error=>report.errors.push({case:currentCase,message:error.message,stack:error.stack}));
  page.on('console',message=>{if(message.type()==='error')report.errors.push({case:currentCase,message:message.text()});});
  page.on('requestfailed',request=>report.failedRequests.push({case:currentCase,url:request.url(),failure:request.failure()}));
  page.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==baseURL)report.externalRequests.push({case:currentCase,url:request.url()});});

  async function boot(){await page.goto(baseURL,{waitUntil:'networkidle',timeout:180000});await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});}
  async function freeze(){await page.evaluate(()=>{game.isPaused=true;game.keys={};document.activeElement?.blur();});}
  async function frame(seconds=1/60){await page.evaluate(delta=>{const prior=game.isPaused;game.isPaused=false;try{game.update(delta);}finally{game.isPaused=prior;}game.renderer.requestRender();},seconds);}
  async function readyMission(){
    await page.waitForFunction(()=>game.isPlaying&&Boolean(game.player),null,{timeout:180000});await freeze();
    await page.evaluate(async()=>{let timer;try{await Promise.race([Promise.resolve(game.player.generatedVisualReady),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Visual did not settle in 90 s')),90000);})]);}finally{clearTimeout(timer);}});
    const insertion=await finishMissionInsertion(page);assert.equal(insertion.visible,true);await frame();await freeze();return insertion;
  }
  async function start({mode='hunt',levelId='gunnison_forest',characterId='jungle_hunter',seed='0',difficulty='standard'}={}){
    await page.locator('#btn-start-game').click();
    const charIndex=CHARACTERS_DATA.findIndex(item=>item.id===characterId);assert.ok(charIndex>=0);await page.locator('.char-btn-card').nth(charIndex).click();
    await page.locator('#btn-confirm-char').click();await page.selectOption('#mission-mode-select',mode);
    await page.locator('.level-card').nth(LEVELS_DATA.findIndex(item=>item.id===levelId)).click();
    if(mode==='fronts'){await page.selectOption('#operation-select','pilot');await page.selectOption('#operation-layout-select',seed);await page.selectOption('#operation-difficulty-select',difficulty);}
    await page.locator('#btn-launch-mission').click();await page.selectOption('#fidelity-mode-select','adapted');await page.locator('#btn-confirm-loadout').click({timeout:180000});return readyMission();
  }
  async function screenshot(name){await page.evaluate(()=>game.renderer.requestRender());await page.screenshot({path:resolve(options.output,name+'.png')});}
  async function checkpoint(){
    if(await page.locator('#pause-menu').isVisible()){await page.locator('#btn-resume-game').click();await freeze();}
    if(!await page.locator('#operation-panel details').evaluate(element=>element.open))await page.locator('#operation-panel summary').click();
    await page.locator('#operation-panel [data-save]').click();return page.evaluate(()=>JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1')));
  }
  async function resume(){
    await page.reload({waitUntil:'networkidle',timeout:180000});await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});
    await page.locator('#btn-start-game').click();await page.locator('#btn-confirm-char').click();
    // Current menu choices must not overwrite the saved scene.
    await page.selectOption('#mission-mode-select','fronts');await page.selectOption('#operation-layout-select','2');await page.selectOption('#operation-difficulty-select','cautious');
    await page.locator('#btn-resume-operation').click();return readyMission();
  }
  async function caseRun(id,run){
    if(options.cases&&!options.cases.includes(id))return;
    currentCase=id;const row={id,status:'running'};report.cases.push(row);await save();
    try{await run(row);row.status='passed';await screenshot(id);}catch(error){row.status='failed';row.error=error.stack??error.message;try{await screenshot(id+'-failure');}catch{}throw error;}finally{await save();}
  }

  await boot();
  await caseRun('scene-seed-difficulty-checkpoint',async row=>{
    row.insertion=await start({mode:'fronts',seed:'1',difficulty:'aggressive'});
    row.before=await page.evaluate(()=>({seed:game.operationMapSeed,layoutSeed:game.env.battlefieldLayout.mapSeed,difficulty:game.operationDifficulty,difficultyConfig:game.battleSimulation.config.difficulty,id:game.campaignRunId,hud:document.getElementById('hud-wave-counter')?.textContent,score:game.score,skulls:game.sessionSkulls,conserved:game.battleSimulation.assertConservation()}));
    assert.equal(row.before.seed,1);assert.equal(row.before.layoutSeed,1);assert.equal(row.before.difficulty,'aggressive');assert.equal(row.before.difficultyConfig.id,'aggressive');assert.match(row.before.hud,/FRONTS/);assert.equal(row.before.conserved,true);
    await page.locator('#btn-hud-map').click();row.commandMap=await page.locator('#command-map-modal [data-mission-status]').textContent();assert.match(row.commandMap,/Terrain 1/);assert.match(row.commandMap,/Offensif/);await page.locator('#command-map-modal [data-close]').click();
    const saved=await checkpoint();row.checkpoint={scene:saved.scene,campaignRunId:saved.campaignRunId,supportMission:saved.supports.apc.policy.missionId};
    assert.equal(saved.scene.mapSeed,1);assert.equal(saved.scene.difficultyId,'aggressive');assert.equal(saved.supports.apc.policy.missionId,saved.campaignRunId);
    await resume();row.after=await page.evaluate(()=>({seed:game.operationMapSeed,difficulty:game.operationDifficulty,id:game.campaignRunId,supportId:game.apc.policy.missionId,hud:document.getElementById('hud-wave-counter')?.textContent,conserved:game.battleSimulation.assertConservation(),score:game.score,skulls:game.sessionSkulls}));
    assert.equal(row.after.seed,1);assert.equal(row.after.difficulty,'aggressive');assert.equal(row.after.id,row.before.id);assert.equal(row.after.supportId,row.before.id);assert.match(row.after.hud,/FRONTS/);assert.equal(row.after.conserved,true);assert.equal(row.after.score,row.before.score);assert.equal(row.after.skulls,row.before.skulls);
  });

  await caseRun('allocated-ally-three-second-rescue',async row=>{
    row.materialization=await page.evaluate(()=>{
      const g=game,start=g.battleSimulation.time;let steps=0,repositioned=null;
      const find=()=>[...g.battleBridge.actors.values()].find(({actor,manager})=>manager===g.allies&&actor.hp>0&&!actor.isDowned&&g.battleSimulation.getUnit(actor.battleUnitId)?.factionId===g.battleSimulation.config.playerFaction&&!g.battleSimulation.getUnit(actor.battleUnitId)?.uniqueId);
      while(!find()&&steps<120){g.updateBattleOperation(1/60);steps++;}
      if(!find()){
        const group=[...g.battleSimulation.groups.values()].find(group=>group.factionId===g.battleSimulation.config.playerFaction&&group.state!=='reserve'&&group.units.some(id=>g.battleSimulation.getUnit(id)?.hp>0));
        if(group){g.player.position.set(group.position[0]+25,0,group.position[1]);g.player.position.y=g.env.getPlacementElevationAt(g.player.position.x,g.player.position.z);g.env.resolveMovement(g.player.position,g.player.radius??.6,g.player.getCollisionHeight());g.player.mesh.position.copy(g.player.position);repositioned={groupId:group.id,groupPosition:[...group.position],playerPosition:g.player.position.toArray()};}
      }
      while(!find()&&steps<300){g.updateBattleOperation(1/60);steps++;}
      return {found:find()?.actor.battleUnitId??null,steps,simulationSeconds:g.battleSimulation.time-start,repositioned,actorCount:g.battleBridge.actors.size,conserved:g.battleSimulation.assertConservation(),groups:g.battleSimulation.getHUDState().groups.filter(group=>group.factionId===g.battleSimulation.config.playerFaction).map(group=>({id:group.id,state:group.state,materialized:group.materialized,position:group.position})),journal:g.battleSimulation.getTacticalJournal(8)};
    });
    assert.ok(row.materialization.found,'Actual allocated allied Yautja must materialize within the bounded normal fixture updates');assert.equal(row.materialization.conserved,true);
    row.fixture=await page.evaluate(()=>{
      const g=game;g.updateBattleOperation(1/60);
      const entry=[...g.battleBridge.actors.values()].find(({actor,manager})=>manager===g.allies&&actor.hp>0&&!actor.isDowned&&g.battleSimulation.getUnit(actor.battleUnitId)?.factionId===g.battleSimulation.config.playerFaction&&!g.battleSimulation.getUnit(actor.battleUnitId)?.uniqueId);
      if(!entry)throw new Error('No actual allocated allied Yautja is materialized');const actor=entry.actor,id=actor.battleUnitId;
      const before={id,hp:actor.hp,maxHp:actor.maxHp,medicomps:g.player.medicompCharges,dead:g.battleSimulation.deaths.size,score:g.score,skulls:g.sessionSkulls};
      const offsets=[[2,0],[-2,0],[0,2],[0,-2]];let placed=false;
      for(const[x,z]of offsets){g.player.position.copy(actor.mesh.position);g.player.position.x+=x;g.player.position.z+=z;g.env.resolveMovement(g.player.position,g.player.radius??.6,g.player.getCollisionHeight());
        if(g.player.position.distanceTo(actor.mesh.position)<3&&g.env.hasLineOfSight(g.player.position.clone().add({x:0,y:1.2,z:0}),actor.mesh.position.clone().add({x:0,y:.6,z:0}))){placed=true;break;}}
      if(!placed)throw new Error('No physically reachable rescuer position');g.player.mesh.position.copy(g.player.position);
      entry.manager.defeatCombatant(actor,{cause:'controlled-browser-fixture-lethal-callback',killerFaction:g.battleSimulation.config.factions.find(f=>f.id!==g.battleSimulation.config.playerFaction).id});
      g.allyRescue.update(.35);g.updateBattleOperation(1/1000);g._qaRescueId=id;g.renderer.camera.position.copy(g.player.position).add({x:8,y:6,z:10});g.renderer.camera.lookAt(actor.mesh.position.clone().add({x:0,y:1,z:0}));g.renderer.requestRender();return {...before,downed:actor.isDowned,posture:actor.mesh.userData.rescueState,unit:g.battleSimulation.getUnit(id).incapacitated,prompt:g.allyRescue.getPrompt(g.player),position:g.player.position.toArray()};
    });
    assert.ok(row.fixture.medicomps>0,'Use the actual finite starter stock');assert.equal(row.fixture.downed,true);assert.equal(row.fixture.posture,'downed');assert.equal(row.fixture.unit,true);assert.ok(row.fixture.prompt);
    await screenshot('ally-actual-downed');await page.evaluate(()=>{game.isPaused=false;document.activeElement?.blur();});await page.keyboard.press('e');await freeze();
    row.channel=await page.evaluate(()=>{
      const g=game,channel=g.allyRescue.getState().channels.find(item=>item.unitId===g._qaRescueId);if(!channel)throw new Error('Real E input did not admit the rescue');
      const advance=Math.max(0,2.9-channel.progress);g.allyRescue.update(advance);const before=g.allyRescue.getState();
      const partial={record:before.records.find(item=>item.unitId===g._qaRescueId),channel:before.channels.find(item=>item.unitId===g._qaRescueId),stock:g.player.medicompCharges};
      g.allyRescue.update(.1);g.updateBattleOperation(1/1000);return {partial,after:g.allyRescue.getState().records.find(item=>item.unitId===g._qaRescueId),stock:g.player.medicompCharges,actorHp:g.battleBridge.actors.get(g._qaRescueId)?.actor.hp,unit:g.battleSimulation.getUnit(g._qaRescueId),dead:g.battleSimulation.deaths.size,score:g.score,skulls:g.sessionSkulls};
    });
    assert.equal(row.channel.partial.record.status,'downed');assert.ok(row.channel.partial.channel.progress>=2.89&&row.channel.partial.channel.progress<3);assert.equal(row.channel.partial.stock,row.fixture.medicomps);
    assert.equal(row.channel.after.status,'rescued');assert.equal(row.channel.stock,row.fixture.medicomps-1);assert.ok(row.channel.actorHp>0);assert.equal(row.channel.unit.incapacitated,false);assert.equal(row.channel.dead,row.fixture.dead);assert.equal(row.channel.score,row.fixture.score);assert.equal(row.channel.skulls,row.fixture.skulls);
    const saved=await checkpoint();row.saved={record:saved.rescue.records.find(item=>item.unitId===row.fixture.id),stock:saved.playerStates[0].medicompCharges,run:saved.campaignRunId};assert.equal(row.saved.record.status,'rescued');assert.equal(row.saved.stock,row.fixture.medicomps-1);
    await resume();row.resumed=await page.evaluate(id=>({record:game.allyRescue.getState().records.find(item=>item.unitId===id),stock:game.player.medicompCharges,run:game.campaignRunId,conserved:game.battleSimulation.assertConservation()}),row.fixture.id);
    assert.equal(row.resumed.record.status,'rescued');assert.equal(row.resumed.stock,row.saved.stock);assert.equal(row.resumed.run,row.saved.run);assert.equal(row.resumed.conserved,true);
  });

  await caseRun('finite-support-roof-refusal-destruction',async row=>{
    await boot();
    row.insertion=await start({levelId:'la_rooftops'});
    row.refusal=await page.evaluate(()=>{
      const g=game,surface=(g.env.referenceWalkSurfaces??[]).find(surface=>['deck','solid-deck'].includes(surface.kind)&&surface.heightAt((surface.bounds.minX+surface.bounds.maxX)/2,(surface.bounds.minZ+surface.bounds.maxZ)/2)>2),bridge=[...g.env.tacticalBridges.values()].find(bridge=>!bridge.destroyed&&bridge.spec.height>2);
      if(!surface&&!bridge)throw new Error('No actual raised deck exists for the physical-roof refusal test');
      const point=surface?[(surface.bounds.minX+surface.bounds.maxX)/2,(surface.bounds.minZ+surface.bounds.maxZ)/2]:bridge.spec.center;
      const target=g.player.position.clone().set(point[0],0,point[1]),from=target.clone().add({x:0,y:.3,z:0}),hit=g.env.traceSegment(from,from.clone().add({x:0,y:180,z:0}),{radius:.5,ignoreOwner:'apc'});
      if(!hit)throw new Error('Selected actual deck did not physically block the sky');const before=g.dropship.getSupportState(),answer=g.dropship.triggerAirstrike(target,g.horde),after=g.dropship.getSupportState();
      g.ui.showAnnouncement(answer.message);return {surface:surface?.id??bridge.id,roofOwner:hit.collider.owner,target:target.toArray(),answer,before,after};
    });
    assert.equal(row.refusal.answer.accepted,false);assert.equal(row.refusal.answer.reason,'air_blocked');assert.deepEqual(row.refusal.after.remaining,row.refusal.before.remaining);assert.equal(row.refusal.after.flying,false);
    row.apc=await page.evaluate(()=>{
      const g=game,position=g.player.position.clone().add({x:-10,y:0,z:-5});if(!g.spawnAPCSupport(position))throw new Error('Adapted outdoor APC setup declined');
      const target=g.apc.getCombatant(),collider=g._apcNavigationCollider,before={hp:target.hp,colliderPresent:g.env.colliders.includes(collider),stocks:g.apc.getSupportState().remaining};
      const attacker=g.horde.aliens.find(actor=>actor.hp>0)??[...(g.battleBridge?.actors?.values()??[])].map(entry=>entry.actor).find(actor=>actor.hp>0&&g.battleSimulation?.areHostile(g.battleSimulation.config.playerFaction,actor.factionId));const applied=target.takeDamage(target.hp+1,attacker);
      g.ui.updateHUD(g.player,g.horde,g.bosses,g.waveIndex,g.totalWaves,g.score,{supports:{apc:g.apc.getSupportState(),cheyenne:g.dropship.getSupportState()}});g.renderer.requestRender();
      return {before,applied,damageSource:attacker?.battleUnitId??attacker?.combatId??'controlled-direct-damage-without-attacker',after:g.apc.getSupportState(),meshPresent:Boolean(g.apc.mesh),colliderPresent:g.env.colliders.includes(collider),activeCollider:collider.isCollisionActive(),targetHp:target.hp,providerIds:g.getSupportCombatants().map(target=>target.id),hud:document.getElementById('hud-support-status').textContent};
    });
    assert.equal(row.apc.before.colliderPresent,true);assert.equal(row.apc.applied,2500);assert.equal(row.apc.after.hp,0);assert.equal(row.apc.meshPresent,false);assert.equal(row.apc.colliderPresent,false);assert.equal(row.apc.activeCollider,false);assert.equal(row.apc.targetHp,0);assert.equal(row.apc.providerIds.length,0);assert.match(row.apc.hud,/APC DÉTRUIT/);
  });

  await caseRun('prey-tools-real-pickups-first-arrow',async row=>{
    await boot();
    row.insertion=await start({levelId:'prey_comanche_territory',characterId:'feral_predator'});
    await page.evaluate(()=>{
      game._qaInteractions=[];const original=game.handlePlayerInteraction;
      game.handlePlayerInteraction=function(player){const event={before:{position:player.position.toArray(),paused:this.isPaused,visible:this.player.mesh.visible,drop:this.dropPod.isActive},checks:[]};this._qaInteractions.push(event);this._qaInputTrace=event;try{return original.call(this,player);}finally{event.after={position:player.position.toArray(),arsenal:this.player.getArsenalState().lastRefusal,equipment:this.player.serializePreyEquipment()};this._qaInputTrace=null;}};
      const names=new Set();for(let proto=game.env;proto;proto=Object.getPrototypeOf(proto))for(const name of Object.getOwnPropertyNames(proto))if(/^check.*Interaction$/.test(name)&&typeof game.env[name]==='function')names.add(name);
      for(const name of names){const original=game.env[name];game.env[name]=function(...args){const result=original.apply(this,args);if(game._qaInputTrace)game._qaInputTrace.checks.push({name,result:Boolean(result)});return result;};}
    });
    async function interactAt(prop){
      const placement=await page.evaluate(name=>{const prop=game.env[name];if(!prop||!prop.group?.parent)throw new Error('Actual PREY pickup missing: '+name);game.player.position.copy(prop.pos);game.player.mesh.position.copy(game.player.position);game.keys={};game.isPaused=false;document.activeElement?.blur();return {requested:prop.pos.toArray(),placementHeight:game.env.getPlacementElevationAt(prop.pos.x,prop.pos.z),elevationWithCurrentY:game.env.getElevationAt(prop.pos.x,prop.pos.z,prop.pos.y)};},prop);
      const beforeInput=await page.evaluate(name=>({actual:game.player.position.toArray(),distance:game.player.position.distanceTo(game.env[name].pos),paused:game.isPaused,level:game.ui.selectedLevel.id}),prop);
      await page.keyboard.press('e');await freeze();return {placement,beforeInput,afterInput:await page.evaluate(()=>({actual:game.player.position.toArray(),events:game._qaInteractions}))};
    }
    row.bowPosition=await interactAt('taabeRockPerch');row.bow=await page.evaluate(()=>({equipment:game.player.serializePreyEquipment(),claimed:game.env.taabeRockPerch.isClaimed,weapon:game.player.getWeaponState()}));
    assert.equal(row.bow.claimed,true);assert.equal(row.bow.equipment.hasTaabeBow,true);assert.equal(row.bow.equipment.taabeArrowAmmo,6);assert.equal(row.bow.weapon.id,'taabe_bow');
    row.axePosition=await interactAt('naruTomahawkTree');row.axe=await page.evaluate(()=>({equipment:game.player.serializePreyEquipment(),claimed:game.env.naruTomahawkTree.isClaimed}));assert.equal(row.axe.claimed,true);assert.equal(row.axe.equipment.naruAxeCharges,4);
    await page.locator('#btn-hud-weapons').click();row.wheel=await page.locator('#wheel-items-container').textContent();assert.match(row.wheel,/Arc de Taabe/);assert.match(row.wheel,/Hache de Naru/);await screenshot('prey-owned-tools-wheel');await page.getByRole('button',{name:/Arc de Taabe/}).click();
    row.lane=await page.evaluate(()=>{
      const g=game,actors=g.horde.aliens.filter(a=>a.hp>0&&!a.isLatched).slice(0,2);if(actors.length!==2)throw new Error('Two actual living hostile actors required');
      const sector=g.env.battlefieldLayout.sectors[0],base=g.player.position.clone().set(sector.center[0],0,sector.center[1]);let found=null;
      for(const[dx,dz]of[[0,1],[1,0],[0,-1],[-1,0]]){
        const p=base.clone();p.y=g.env.getPlacementElevationAt(p.x,p.z);g.env.resolveMovement(p,g.player.radius??.6,g.player.getCollisionHeight());
        const near=p.clone().add({x:dx*12,y:0,z:dz*12}),far=p.clone().add({x:dx*16,y:0,z:dz*16});near.y=g.env.getElevationAt(near.x,near.z,p.y);far.y=g.env.getElevationAt(far.x,far.z,p.y);
        if(Math.abs(near.y-p.y)>.3||Math.abs(far.y-p.y)>.3||g.env.traceSegment(p.clone().add({x:0,y:1.5,z:0}),far.clone().add({x:0,y:1.5,z:0}),{radius:.2}))continue;
        found={p,near,far,angle:Math.atan2(dx,dz)};break;
      }
      if(!found)throw new Error('No physically clear deterministic shooting lane');g.player.position.copy(found.p);g.player.mesh.position.copy(found.p);g.player.rotationY=found.angle;g.player.mesh.rotation.y=found.angle;
      actors[0].mesh.position.copy(found.near);actors[1].mesh.position.copy(found.far);g._qaArrowActors=actors;
      const saved=actors.map(a=>({id:a.combatId??a.id??null,hp:a.hp,position:a.mesh.position.toArray()}));g.renderer.camera.position.copy(found.p).add({x:0,y:8,z:-12});g.renderer.camera.lookAt(found.near);g.renderer.requestRender();return {actors:saved,origin:found.p.toArray(),angle:found.angle,energy:g.player.plasmaEnergy,ammo:g.player.taabeArrowAmmo,score:g.score,skulls:g.sessionSkulls,dead:g.horde.deadCount};
    });
    await screenshot('prey-bow-held');await page.evaluate(()=>{game.isPaused=false;game.keys={};document.activeElement?.blur();});await page.mouse.click(500,350);await freeze();
    row.shot=await page.evaluate(()=>{
      const g=game,p=g.projectiles.find(p=>p.projectileKind==='taabe_arrow');const before=p?{kind:p.projectileKind,mesh:p.mesh.name,singleMesh:p.mesh.isMesh,pierce:p.pierceRemaining}:null;
      const prior=g.isPaused;g.isPaused=false;let simulated=0;
      try{while(g.projectiles.some(p=>p.projectileKind==='taabe_arrow')&&simulated<1.2){g.update(1/60);simulated+=1/60;}}finally{g.isPaused=prior;}
      const [first,second]=g._qaArrowActors;return {before,simulated,remaining:g.projectiles.filter(p=>p.projectileKind==='taabe_arrow').length,firstHp:first.hp,secondHp:second.hp,ammo:g.player.taabeArrowAmmo,energy:g.player.plasmaEnergy,active:g.player.activeWeapon,hud:document.getElementById('hud-plasma-text').textContent,score:g.score,skulls:g.sessionSkulls,dead:g.horde.deadCount};
    });
    assert.ok(row.shot.before,'Actual click must create a wooden projectile before its first impact');assert.equal(row.shot.before.mesh,'taabe-wooden-arrow');assert.equal(row.shot.before.singleMesh,true);assert.equal(row.shot.before.pierce,0);assert.equal(row.shot.remaining,0);assert.ok(row.shot.firstHp<row.lane.actors[0].hp);assert.equal(row.shot.secondHp,row.lane.actors[1].hp);assert.equal(row.shot.ammo,5);assert.equal(row.shot.energy,row.lane.energy);assert.match(row.shot.hud,/FLÈCHES DE TAABE/);
    assert.ok(Number.isFinite(row.shot.score)&&row.shot.score>=row.lane.score&&row.shot.score<=row.lane.score+5000);assert.ok(row.shot.skulls>=row.lane.skulls&&row.shot.skulls<=row.lane.skulls+1);assert.ok(row.shot.dead>=row.lane.dead&&row.shot.dead<=row.lane.dead+1);
    await page.locator('#btn-hud-weapons').click();await page.getByRole('button',{name:/Hache de Naru/}).click();await page.evaluate(()=>{game.isPaused=false;document.activeElement?.blur();});await page.mouse.click(500,350);await freeze();
    row.axeSwing=await page.evaluate(()=>({charges:game.player.naruAxeCharges,weapon:game.player.activeWeapon,held:Boolean(game.player._preyWeaponVisuals.get('naru_axe')?.visible)}));assert.equal(row.axeSwing.charges,3);assert.equal(row.axeSwing.weapon,'naru_axe');assert.equal(row.axeSwing.held,true);
  });



  report.status=report.cases.length===(options.cases?.length??4)&&report.cases.every(row=>row.status==='passed')&&!report.errors.length&&!report.failedRequests.length&&!report.externalRequests.length?'passed':'failed';
}catch(error){report.status='failed';report.error=error.stack??error.message;}
finally{
  await context?.close();await browser?.close();server?.kill('SIGTERM');
  if(before){report.distUnchanged=JSON.stringify(before)===JSON.stringify(await tree(resolve(root,'dist')));if(!report.distUnchanged){report.status='failed';report.error='Frozen build changed during browser fixture';}}
  report.endedAt=new Date().toISOString();report.durationSeconds=(Date.parse(report.endedAt)-Date.parse(report.startedAt))/1000;await save();
  process.stdout.write(JSON.stringify({status:report.status,cases:report.cases.map(row=>({id:row.id,status:row.status})),errors:report.errors.length,failedRequests:report.failedRequests.length,distUnchanged:report.distUnchanged})+'\n');
}
if(report.status!=='passed')process.exitCode=1;
