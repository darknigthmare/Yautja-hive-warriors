// Run only when ROOT has allocated the sole Chromium slot and frozen the build.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { chromium } from 'playwright';
import { CHARACTERS_DATA } from '../../../js/data/charactersData.js';
import { LEVELS_DATA } from '../../../js/data/levelsData.js';
import { finishMissionInsertion } from '../../../tests/helpers/finish-insertion.mjs';

const usage=`Run only after ROOT freezes the build and grants the exclusive Chromium slot:
  node docs/qa/continuation-20261102/verify-ui-command.mjs \\
    --root-browser-go --base-url http://127.0.0.1:PORT \\
    --expected-source SOURCE_SHA40 --expected-index INDEX_SHA256 \\
    --output /workspace/qa/continuation-20261102/ui-final-RUN

--help and --check-config do not access the network, launch Chromium or write files.
--check-config validates the remaining arguments without requiring --root-browser-go.
`;
if(process.argv.includes('--help')){console.log(usage);process.exit(0);}
const root=resolve(import.meta.dirname,'../../..'),options={baseURL:null,expectedIndex:null,expectedSource:null,output:null,go:false,checkConfig:false};
for(let index=2;index<process.argv.length;index++){
 const flag=process.argv[index];
 if(flag==='--root-browser-go')options.go=true;
 else if(flag==='--check-config')options.checkConfig=true;
 else{const value=process.argv[++index];assert.ok(value&&!value.startsWith('--'),`Missing value for ${flag}`);if(flag==='--base-url')options.baseURL=value.replace(/\/$/,'');else if(flag==='--expected-index')options.expectedIndex=value;else if(flag==='--expected-source')options.expectedSource=value;else if(flag==='--output')options.output=resolve(value);else throw new Error(`Unknown flag ${flag}`);}
}
assert.match(options.expectedIndex??'',/^[a-f0-9]{64}$/);assert.match(options.expectedSource??'',/^[a-f0-9]{40}$/);assert.ok(options.output);assert.ok(options.baseURL);assert.ok(['http:','https:'].includes(new URL(options.baseURL).protocol));
if(options.checkConfig){console.log(JSON.stringify({status:'configuration_valid_only',root,...options,browserLaunched:false,networkAccessed:false,filesWritten:false}));process.exit(0);}
assert.equal(options.go,true,'ROOT must grant the Chromium slot explicitly');
const hash=bytes=>createHash('sha256').update(bytes).digest('hex');
async function tree(directory,prefix=''){const files=[];for(const entry of await readdir(directory,{withFileTypes:true})){const path=resolve(directory,entry.name),name=prefix+entry.name;if(entry.isDirectory())files.push(...await tree(path,name+'/'));else files.push({path:name,sha256:hash(await readFile(path))});}return files.sort((a,b)=>a.path.localeCompare(b.path));}
const report={schemaVersion:1,status:'running',startedAt:new Date().toISOString(),sourceCommit:options.expectedSource,indexSha256:options.expectedIndex,humanTesters:0,hardwarePerformanceVerified:false,fidelity1to1Verified:false,
 scope:'Eight scoped desktop UI cases: real controls, finite command state, preserved checkpoints, controlled player defeat, actual strategic critical-front expiry through the normal main update/end flow and optional evolved-caste selection with signed identities. No natural victory, human comprehension, hardware FPS or source-film fidelity claimed.',
 historicalHarness:'The six prior cases are retained from the November 1 helper. These executions and their source/index pins are new; previous runs remain separate historical evidence.',
 assistances:['Insertion advanced by the existing actual game.update helper at 1/60','Strategic and rendering updates paused between input steps to preserve comparable state','Controlled public update at 1/60 after actual cloak key input','Controlled player HP=0 followed by actual game.update for case 6 only','Case 7 records deaths of existing finite NPC IDs through the simulation owner to isolate the strategic deadline without resetting player HP or inventing units','Case 7 captures the authored critical front for an actual hostile faction, saves/reloads the genuine operation checkpoint and advances the real updateBattleOperation loop until its unchanged deadline expires; no result injection or manual endGame call','Finite CSS transitions completed only for static screenshot capture'],cases:[],errors:[],failedRequests:[],externalRequests:[]};
await mkdir(options.output);const save=()=>writeFile(resolve(options.output,'report.json'),JSON.stringify(report,null,2)+'\n');
let browser,context,page,current='boot';const before=await tree(resolve(root,'dist'));
try{
 assert.equal(hash(await readFile(resolve(root,'dist/index.html'))),options.expectedIndex);report.buildInfo=JSON.parse(await readFile(resolve(root,'dist/build-info.json'),'utf8'));assert.equal(report.buildInfo.sourceCommit,options.expectedSource);
 const response=await fetch(options.baseURL,{signal:AbortSignal.timeout(15000)});assert.equal(response.status,200);assert.equal(hash(Buffer.from(await response.arrayBuffer())),options.expectedIndex);
 report.harnessSha256=hash(await readFile(import.meta.filename));report.insertionHelperSha256=hash(await readFile(resolve(root,'tests/helpers/finish-insertion.mjs')));
 report.helperSourcesBefore=[];
 for(const [path,snapshot] of [[import.meta.filename,'harness-source.mjs'],[resolve(root,'tests/helpers/finish-insertion.mjs'),'insertion-helper-source.mjs']]){
  const bytes=await readFile(path);await writeFile(resolve(options.output,snapshot),bytes);
  report.helperSourcesBefore.push({path:path.slice(root.length+1),sha256:hash(bytes),snapshot});
 }
 browser=await chromium.launch({executablePath:process.env.CHROMIUM_PATH||(existsSync('/usr/bin/chromium')?'/usr/bin/chromium':undefined),args:['--no-sandbox','--enable-unsafe-swiftshader']});
 context=await browser.newContext({viewport:{width:1600,height:1000}});page=await context.newPage();page.setDefaultTimeout(30000);
 page.on('pageerror',error=>report.errors.push({case:current,message:error.message,stack:error.stack}));page.on('console',message=>{if(message.type()==='error')report.errors.push({case:current,message:message.text()});});
 page.on('requestfailed',request=>report.failedRequests.push({case:current,url:request.url(),failure:request.failure()}));page.on('request',request=>{const url=new URL(request.url());if(/^https?:$/.test(url.protocol)&&url.origin!==new URL(options.baseURL).origin)report.externalRequests.push({case:current,url:request.url()});});
 const screenshot=async name=>{await page.screenshot({path:resolve(options.output,name+'.png'),animations:'disabled'});};
 const freeze=()=>page.evaluate(()=>{game.isPaused=true;game.keys={};document.activeElement?.blur();});
 async function caseRun(id,run){current=id;const row={id,status:'running'};report.cases.push(row);await save();try{await run(row);row.status='passed';}catch(error){row.status='failed';row.error=error.stack;try{await screenshot(id+'-failure');}catch{}throw error;}finally{await save();}}
 async function boot(){await page.goto(options.baseURL,{waitUntil:'networkidle',timeout:180000});await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});}
 async function ready(){await page.waitForFunction(()=>game.isPlaying&&Boolean(game.player),null,{timeout:180000});await freeze();await page.evaluate(async()=>{let timer;try{await Promise.race([Promise.resolve(game.player.generatedVisualReady),new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error('Imported visual did not settle')),90000);})]);}finally{clearTimeout(timer);}});const insertion=await finishMissionInsertion(page);assert.equal(insertion.visible,true);await freeze();return insertion;}
 const map='#command-map-modal';
 await boot();
 await caseRun('preferences-monochrome-reduced',async row=>{
  await page.locator('#btn-open-options').click();await page.selectOption('#setting-map-palette','monochrome');await page.locator('#setting-reduced-flashes').check();await page.locator('#setting-marker-symbols').check();
  row.preferences=await page.evaluate(()=>game.ui.presentationPreferences.get());assert.equal(row.preferences.palette,'monochrome');assert.equal(row.preferences.reducedFlashes,true);assert.equal(row.preferences.symbols,true);await screenshot(current);await page.locator('#btn-close-options').click();
 });
 await caseRun('codex-ranks-engineers',async row=>{
  await page.locator('#btn-open-codex').click();row.tabs={};
  for(const tab of ['ranks','engineers']){
   await page.locator(`.codex-tab-btn[data-tab="${tab}"]`).click();row.tabs[tab]=await page.locator('#codex-content-container .codex-entry-card').evaluateAll(cards=>cards.map(card=>({title:card.querySelector('h3')?.textContent,context:card.querySelector('.codex-entry-context')?.textContent,sources:[...card.querySelectorAll('.codex-entry-sources a')].map(link=>({label:link.textContent,url:link.href,rel:link.rel}))})));
   row.tabStates??={};row.tabStates[tab]=await page.locator('.codex-tab-btn').evaluateAll(buttons=>buttons.map(button=>({id:button.dataset.tab,active:button.classList.contains('active'),pressed:button.getAttribute('aria-pressed')})));assert.equal(row.tabStates[tab].find(button=>button.id===tab)?.active,true);assert.equal(row.tabStates[tab].find(button=>button.id===tab)?.pressed,'true');assert.equal(row.tabStates[tab].filter(button=>button.active).length,1);assert.ok(row.tabs[tab].length>0);assert.ok(row.tabs[tab].every(card=>card.context?.length&&card.sources.length&&card.sources.every(source=>source.url.startsWith('https://')&&source.rel.includes('noopener'))));await screenshot('codex-'+tab);const detail=page.locator('#codex-content-container .codex-entry-card').filter({has:page.locator('h3').filter({hasText:tab==='ranks'?/^ALPHA/i:/^FERAL/i})});if(await detail.count()){await detail.first().scrollIntoViewIfNeeded();await screenshot('codex-'+tab+'-source-detail');}
  }
  assert.ok(row.tabs.ranks.some(card=>/Alpha/i.test(card.title)));assert.ok(row.tabs.engineers.some(card=>/Feral/i.test(card.title)));await page.locator('#btn-close-codex').click();
 });
 await caseRun('briefing-and-command-map',async row=>{
  await page.locator('#btn-start-game').click();await page.locator('.char-btn-card').nth(CHARACTERS_DATA.findIndex(character=>character.id==='jungle_hunter')).click();await page.locator('#btn-confirm-char').click();await page.selectOption('#mission-mode-select','fronts');await page.locator('.level-card').nth(LEVELS_DATA.findIndex(level=>level.id==='val_verde_jungle')).click();await page.selectOption('#operation-select','pilot');await page.selectOption('#operation-layout-select','1');await page.selectOption('#operation-difficulty-select','standard');await page.locator('#btn-launch-mission').click();
  row.briefing=await page.locator('.operation-briefing').textContent();assert.match(row.briefing,/Chasseur déployé/);assert.match(row.briefing,/Jungle Hunter|JUNGLE HUNTER/);await screenshot('character-briefing');await page.selectOption('#fidelity-mode-select','adapted');await page.locator('#btn-confirm-loadout').click({timeout:180000});row.insertion=await ready();
  row.before=await page.evaluate(()=>({ids:[...game.battleSimulation.units.keys()].sort(),allocated:game.battleSimulation.initialAllocated,run:game.campaignRunId,hp:game.player.hp,score:game.score,conserved:game.battleSimulation.assertConservation()}));
  // Keep the simulation paused while Playwright checks and clicks the genuine UI.
  // The first final attempt released RAF updates here before hit-testing, and
  // timed out in SwiftShader without any JavaScript or network error.
  await page.evaluate(()=>{game.isPaused=true;game.ui.showScreen(game.ui.inGameHud);});await page.locator('#btn-hud-map').click();
  row.selection=await page.evaluate(()=>{const state=game.battleSimulation.getHUDState(),group=state.groups.find(group=>group.factionId===state.playerFaction&&group.alive>0&&group.officerHP>0&&group.state!=='reserve');if(!group)throw new Error('No allocated living commandable captain');const front=state.fronts.find(front=>front.id!==group.frontId&&game.battleSimulation._path(group.frontId,front.id));if(!front)throw new Error('No different reachable front');return{groupId:group.id,groupLabel:group.label,frontId:front.id,frontLabel:front.label};});
  await page.selectOption(`${map} [data-groups]`,[row.selection.groupId]);await page.selectOption(`${map} [data-front]`,row.selection.frontId);await page.selectOption(`${map} [data-order]`,'defend');
  row.preview=await page.locator(`${map} [data-route-preview]`).textContent();assert.match(row.preview,/trajet|déjà sur ce front/);assert.ok(row.preview.includes(row.selection.groupLabel));row.comparison=await page.locator(`${map} [data-front-comparison] article`).count();row.frontCount=await page.evaluate(()=>game.battleSimulation.fronts.size);assert.equal(row.comparison,row.frontCount);await screenshot('map-compared-fronts');await page.locator(`${map} [data-front-comparison]`).scrollIntoViewIfNeeded();await screenshot('map-front-comparison-detail');
  await page.locator(`${map} [data-send]`).click();row.orderFeedback=await page.locator(`${map} [data-feedback]`).textContent();row.order=await page.evaluate(id=>game.battleSimulation.getGroup(id).order,row.selection.groupId);assert.equal(row.order.type,'defend');assert.equal(row.order.frontId,row.selection.frontId);assert.match(row.orderFeedback,/ORDRE ACCEPTÉ/);
  await page.locator(`${map} [data-delegate]`).click();row.delegated=await page.evaluate(id=>game.battleSimulation.getGroup(id).delegated,row.selection.groupId);row.delegateFeedback=await page.locator(`${map} [data-feedback]`).textContent();assert.equal(row.delegated,true);assert.match(row.delegateFeedback,/CAPITAINE DÉLÉGUÉ/);await page.locator(`${map} [data-feedback]`).scrollIntoViewIfNeeded();await screenshot('map-captain-delegated');
  await page.selectOption(`${map} [data-tactic]`,'hold_line');await page.locator(`${map} [data-tactics]`).click();row.tactic=await page.evaluate(id=>game.battleSimulation.getGroup(id).tactic,row.selection.groupId);row.tacticFeedback=await page.locator(`${map} [data-feedback]`).textContent();assert.equal(row.tactic.type,'hold_line');assert.match(row.tacticFeedback,/20 s.*30 s/);await page.locator(`${map} [data-feedback]`).scrollIntoViewIfNeeded();await screenshot('map-tactic-feedback');
  row.after=await page.evaluate(()=>({ids:[...game.battleSimulation.units.keys()].sort(),allocated:game.battleSimulation.initialAllocated,conserved:game.battleSimulation.assertConservation(),preferences:game.ui.presentationPreferences.get()}));assert.deepEqual(row.after.ids,row.before.ids);assert.equal(row.after.allocated,row.before.allocated);assert.equal(row.after.conserved,true);assert.equal(row.after.preferences.palette,'monochrome');await page.locator(`${map} [data-close]`).click();await freeze();report.commandSelection=row.selection;report.initial=row.before;
 });
 await caseRun('combat-readability-real-cloak',async row=>{
  await page.evaluate(()=>{game.isPaused=false;game.ui.showScreen(game.ui.inGameHud);document.activeElement?.blur();});await page.keyboard.press('f');await freeze();
  row.state=await page.evaluate(()=>{const prior=game.isPaused;game.isPaused=false;try{game.update(1/60);}finally{game.isPaused=prior;}return{combat:game.player.getCombatState(),costs:document.getElementById('hud-combat-costs').textContent,status:document.getElementById('hud-combat-state').textContent};});assert.equal(row.state.combat.stealth.concealed,true);assert.match(row.state.status,/CAMOUFLÉ/);assert.match(row.state.costs,/Léger.*Lourd.*END/);row.minimap=await page.locator('#minimap-canvas').evaluate(canvas=>{const pixels=canvas.getContext('2d').getImageData(0,0,canvas.width,canvas.height).data,legacy=new Set(['199,187,148','221,255,177','119,228,196','239,129,125']),counts={};for(let index=0;index<pixels.length;index+=4){const rgb=Array.from(pixels.slice(index,index+3)).join(',');if(legacy.has(rgb))counts[rgb]=(counts[rgb]??0)+1;}return{width:canvas.width,height:canvas.height,legacyMarkerPixels:counts,legend:document.querySelector('.minimap-legend')?.textContent};});assert.deepEqual(row.minimap.legacyMarkerPixels,{},'Fronts minimap must not bypass monochrome with its old faction/neutral/player marker colors');assert.match(row.minimap.legend,/◇ Allié/);assert.match(row.minimap.legend,/Creux/);await screenshot(current);await page.locator('#minimap-canvas').screenshot({path:resolve(options.output,'fronts-minimap-monochrome-detail.png'),animations:'disabled'});
 });
 await caseRun('pause-save-reload-command-identity',async row=>{
  await page.locator('#btn-pause-game').click();row.paused=await page.evaluate(()=>({paused:game.isPaused,time:game.battleSimulation.time,hp:game.player.hp}));assert.equal(row.paused.paused,true);await page.waitForTimeout(500);row.afterPause=await page.evaluate(()=>({time:game.battleSimulation.time,hp:game.player.hp}));assert.equal(row.afterPause.time,row.paused.time);assert.equal(row.afterPause.hp,row.paused.hp);await screenshot('mission-paused');await page.locator('#btn-resume-game').click();await freeze();
  const details=page.locator('#operation-panel details');if(!await details.evaluate(node=>node.open))await page.locator('#operation-panel summary').click();await page.locator('#operation-panel [data-save]').click();
  row.saved=await page.evaluate(()=>{const saved=JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));return{run:saved.campaignRunId,ids:saved.simulation.units.map(unit=>unit.id).sort(),scene:saved.scene,hp:saved.playerStates[0].hp,group:saved.simulation.groups.find(group=>group.id===game.commandMap.root.querySelector('[data-groups]').value),preferences:game.ui.presentationPreferences.get()};});assert.equal(row.saved.run,report.initial.run);assert.deepEqual(row.saved.ids,report.initial.ids);assert.equal(row.saved.group.delegated,true);assert.equal(row.saved.group.tactic.type,'hold_line');
  await page.reload({waitUntil:'networkidle',timeout:180000});await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});await page.locator('#btn-start-game').click();await page.locator('#btn-confirm-char').click();await page.locator('#btn-resume-operation').click();row.insertion=await ready();
  row.resumed=await page.evaluate(id=>({run:game.campaignRunId,ids:[...game.battleSimulation.units.keys()].sort(),group:game.battleSimulation.getGroup(id),preferences:game.ui.presentationPreferences.get(),scene:{mapSeed:game.operationMapSeed,difficultyId:game.operationDifficulty,deploymentPlan:game.operationDeploymentPlan??'authored',extinctionVariant:game.extinctionVariant??'none'},conserved:game.battleSimulation.assertConservation(),characterId:game.ui.selectedChar.id}),report.commandSelection.groupId);assert.equal(row.resumed.run,row.saved.run);assert.deepEqual(row.resumed.ids,row.saved.ids);assert.deepEqual(row.resumed.scene,row.saved.scene);assert.equal(row.resumed.group.delegated,true);assert.equal(row.resumed.group.order.frontId,report.commandSelection.frontId);assert.equal(row.resumed.group.tactic.type,'hold_line');assert.equal(row.resumed.preferences.palette,'monochrome');assert.equal(row.resumed.preferences.reducedFlashes,true);assert.equal(row.resumed.conserved,true);assert.equal(row.resumed.characterId,'jungle_hunter');await screenshot(current);
 });
 await caseRun('controlled-defeat-character-debrief',async row=>{
  row.before=await page.evaluate(()=>({time:game.battleSimulation.time,character:game.ui.selectedChar.name,groups:[...game.battleSimulation.groups.values()].map(group=>({id:group.id,label:group.label}))}));
  await page.evaluate(()=>{game.player.hp=0;game.isPaused=false;game.update(1/60);});await page.waitForFunction(()=>!game.isPlaying&&!document.getElementById('game-over-screen').classList.contains('hidden'));
  row.text=await page.locator('#battle-debrief').textContent();assert.match(row.text,/Chasseur déployé/);assert.ok(row.text.includes(row.before.character));assert.match(row.text,/Temps de bataille/);assert.match(row.text,/Groupes du clan/);assert.match(row.text,/vaincus/);row.after=await page.evaluate(()=>({playerCleared:game.player===null,playing:game.isPlaying}));assert.equal(row.after.playerCleared,true);assert.equal(row.after.playing,false);await screenshot(current);
 });
 await caseRun('critical-front-expiry-restored-live-player-debrief',async row=>{
  // A fresh replay keeps the authored operation/configuration and all original
  // finite IDs. Only the independent NPC battle is shortened for this case.
  await page.locator('#btn-replay').click();
  await page.locator('#btn-confirm-loadout').click({timeout:180000});
  row.insertion=await ready();
  row.isolation=await page.evaluate(()=>{
    const g=game,sim=g.battleSimulation;
    if(!sim||!g.player||g.player.hp<=0)throw new Error('Critical expiry requires a living hunter and an actual operation');
    const ids=[...sim.units.keys()].sort(),playerHP=g.player.hp;
    const frontId=sim.config.objectives?.loseFronts?.[0],front=sim.getFront(frontId);
    const hostile=sim.config.factions.find(faction=>sim.areHostile(sim.config.playerFaction,faction.id));
    if(!front||!hostile)throw new Error('The authored operation has no critical front or hostile faction');
    let recordedDeaths=0;
    for(const id of ids)if(sim.recordDeath({entityId:id,cause:'qa_strategic_deadline_isolation'}))recordedDeaths++;
    if([...sim.units.values()].some(unit=>unit.state!=='dead'))throw new Error('NPC isolation did not retire every existing allocated unit');
    if(!sim.captureBase(frontId,hostile.id,'qa_isolate_authored_critical_front'))throw new Error('The real front capture was refused');
    g.updateBattleOperation(.25);
    const state=sim.getHUDState(),loss=state.criticalFronts.find(loss=>loss.frontId===frontId);
    if(!g.isPlaying||sim.getResult()||!loss)throw new Error('Capture must announce a deadline before deciding the outcome');
    if(g.player.hp!==playerHP)throw new Error('NPC-only isolation changed the player HP');
    return{ids,playerHP,frontId,frontLabel:front.label,hostileFaction:hostile.id,recordedDeaths,
      time:sim.time,deadline:loss.deadline,graceSeconds:loss.graceSeconds,
      returnTravelSeconds:loss.returnTravelSeconds,conserved:sim.assertConservation(),
      alert:document.querySelector('#operation-panel [data-alert]').textContent};
  });
  assert.deepEqual(row.isolation.ids,report.initial.ids);
  assert.ok(row.isolation.recordedDeaths>0);assert.equal(row.isolation.conserved,true);
  assert.ok(row.isolation.playerHP>0);assert.ok(row.isolation.deadline>row.isolation.time);
  assert.match(row.isolation.alert,/DÉFAITE IMMINENTE/);assert.ok(row.isolation.alert.includes(row.isolation.frontLabel));
  await screenshot('critical-front-warning');
  const details=page.locator('#operation-panel details');
  if(!await details.evaluate(node=>node.open))await page.locator('#operation-panel summary').click();
  await page.locator('#operation-panel [data-save]').click();
  row.saved=await page.evaluate(frontId=>{
    const saved=JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));
    const loss=saved?.simulation?.criticalLosses?.find(loss=>loss.frontId===frontId);
    if(!loss)throw new Error('The real operation checkpoint omitted its active critical deadline');
    return{run:saved.campaignRunId,ids:saved.simulation.units.map(unit=>unit.id).sort(),
      deadIds:saved.simulation.units.filter(unit=>unit.state==='dead').map(unit=>unit.id).sort(),
      time:saved.simulation.time,deadline:loss.deadline,playerHP:saved.playerStates[0].hp,result:saved.simulation.result};
  },row.isolation.frontId);
  assert.deepEqual(row.saved.ids,row.isolation.ids);assert.deepEqual(row.saved.deadIds,row.saved.ids);
  assert.equal(row.saved.deadline,row.isolation.deadline);assert.equal(row.saved.result,null);assert.ok(row.saved.playerHP>0);
  await page.reload({waitUntil:'networkidle',timeout:180000});
  await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});
  await page.locator('#btn-start-game').click();await page.locator('#btn-confirm-char').click();
  await page.locator('#btn-resume-operation').click();row.resumeInsertion=await ready();
  row.resumed=await page.evaluate(frontId=>{
    const g=game,sim=g.battleSimulation,loss=sim.getHUDState().criticalFronts.find(loss=>loss.frontId===frontId);
    if(!loss)throw new Error('The active critical front was lost during checkpoint restoration');
    g.updateBattleOperation(1/60);
    return{run:g.campaignRunId,ids:[...sim.units.keys()].sort(),
      deadIds:[...sim.units.values()].filter(unit=>unit.state==='dead').map(unit=>unit.id).sort(),
      time:sim.time,deadline:loss.deadline,playerHP:g.player.hp,result:sim.getResult(),
      conserved:sim.assertConservation(),alert:document.querySelector('#operation-panel [data-alert]').textContent};
  },row.isolation.frontId);
  assert.equal(row.resumed.run,row.saved.run);assert.deepEqual(row.resumed.ids,row.saved.ids);
  assert.deepEqual(row.resumed.deadIds,row.saved.deadIds);assert.equal(row.resumed.deadline,row.saved.deadline);
  assert.equal(row.resumed.result,null);assert.equal(row.resumed.playerHP,row.saved.playerHP);
  assert.equal(row.resumed.conserved,true);assert.ok(row.resumed.alert.includes(row.isolation.frontLabel));
  await screenshot('critical-front-restored-warning');
  row.expiry=await page.evaluate(()=>{
    const g=game,sim=g.battleSimulation,player=g.player;
    const deadline=sim.getHUDState().criticalDeadline;
    const maximumUpdates=Math.ceil((deadline-sim.time)/.25)+4;
    if(!Number.isFinite(maximumUpdates)||maximumUpdates<1||maximumUpdates>10000)throw new Error('Unexpected authored critical return window');
    let updates=0,hpBeforeAutomaticEnd=player.hp;
    while(g.isPlaying&&!sim.getResult()&&updates<maximumUpdates){
      hpBeforeAutomaticEnd=g.player.hp;
      g.updateBattleOperation(.25);updates++;
    }
    // updateBattleOperation itself observes result and calls the normal endGame
    // flow, which snapshots the cause before clearMissionState destroys actors.
    const result=sim.getResult();
    if(!result||g.isPlaying)throw new Error('The real strategic deadline did not drive the normal end-of-mission flow');
    return{updates,deadline,result,hpBeforeAutomaticEnd,remainingPlayerHP:player.hp,
      ids:[...sim.units.keys()].sort(),conserved:sim.assertConservation(),
      simulationDisposed:sim.disposed,simulationCleared:g.battleSimulation==null,
      playerCleared:g.player===null,checkpointCleared:localStorage.getItem('yautja-operation-checkpoint-v1')===null};
  });
  await page.waitForFunction(()=>!game.isPlaying&&!document.getElementById('game-over-screen').classList.contains('hidden'));
  row.subtitle=await page.locator('#end-subtitle').textContent();
  row.debriefReason=await page.locator('#battle-debrief > p').first().textContent();
  row.debriefText=await page.locator('#battle-debrief').textContent();
  assert.equal(row.expiry.result.outcome,'defeat');assert.equal(row.expiry.result.reason,'critical_front_lost');
  assert.deepEqual(row.expiry.result.fronts,[row.isolation.frontId]);
  assert.ok(Math.abs(row.expiry.result.time-row.expiry.deadline)<=.251);
  assert.ok(row.expiry.hpBeforeAutomaticEnd>0);assert.ok(row.expiry.remainingPlayerHP>0);
  assert.deepEqual(row.expiry.ids,row.saved.ids);assert.equal(row.expiry.conserved,true);
  assert.equal(row.expiry.simulationDisposed,true);assert.equal(row.expiry.simulationCleared,true);
  assert.equal(row.expiry.playerCleared,true);assert.equal(row.expiry.checkpointCleared,true);
  assert.ok(row.subtitle.includes(row.isolation.frontLabel));assert.ok(row.debriefReason.includes(row.isolation.frontLabel));
  assert.match(row.subtitle,/front critique.*repris.*délai/);assert.match(row.debriefReason,/front critique.*repris.*délai/);
  assert.doesNotMatch(row.subtitle,/conditions de poursuite|chasseurs ont été vaincus/);
  await screenshot(current);
 });
 await caseRun('evolved-caste-menu-briefing-checkpoint-identity',async row=>{
  await page.locator('#btn-menu-return').click();await page.locator('#btn-start-game').click();
  await page.locator('#btn-confirm-char').click();await page.selectOption('#mission-mode-select','fronts');
  const base='#extinction-variant-enabled',upgrade='#extinction-variant-upgraded',upgradeLabel='#extinction-upgrade-label';
  await page.selectOption('#operation-select','AFF-27');
  assert.equal(await page.locator(base).isEnabled(),true);
  assert.equal(await page.locator(upgrade).isChecked(),false);assert.equal(await page.locator(upgrade).isDisabled(),true);
  assert.equal(await page.locator(upgradeLabel).isVisible(),false);
  await page.locator(base).check();assert.equal(await page.locator(upgrade).isEnabled(),true);
  assert.equal(await page.locator(upgradeLabel).isVisible(),true);await page.locator(upgrade).check();
  await page.selectOption('#operation-select','pilot');
  row.ineligible=await page.evaluate(()=>({base:document.getElementById('extinction-variant-enabled').checked,
    upgraded:document.getElementById('extinction-variant-upgraded').checked,
    disabled:document.getElementById('extinction-variant-upgraded').disabled,
    hidden:document.getElementById('extinction-upgrade-label').classList.contains('hidden')}));
  assert.deepEqual(row.ineligible,{base:false,upgraded:false,disabled:true,hidden:true});
  await page.selectOption('#operation-select','AFF-27');await page.locator(base).check();
  assert.equal(await page.locator(upgrade).isChecked(),false);
  await page.locator('#btn-launch-mission').click();
  row.basic={variant:await page.evaluate(()=>game.extinctionVariant),briefing:await page.locator('.operation-briefing').textContent()};
  assert.equal(row.basic.variant,'carrier-ravager');assert.match(row.basic.briefing,/Variante optionnelle.*Carrier et Ravager.*6 parasites.*capacité 6/);
  await screenshot('basic-caste-briefing');await page.locator('#btn-back-to-levels').click();
  await page.locator(upgrade).check();await screenshot('evolved-caste-selection');
  await page.locator('#btn-launch-mission').click();
  row.evolved={variant:await page.evaluate(()=>game.extinctionVariant),briefing:await page.locator('.operation-briefing').textContent()};
  assert.equal(row.evolved.variant,'carrier-ravager-enhanced');
  assert.match(row.evolved.briefing,/Variante évoluée.*Supercarrier.*6 parasites.*capacité 12.*Résilience colossale.*catalepsie/);
  await screenshot('evolved-caste-briefing');await page.locator('#btn-confirm-loadout').click({timeout:180000});
  row.insertion=await ready();
  row.started=await page.evaluate(()=>{
    const g=game,sim=g.battleSimulation,carrier=[...sim.units.values()].find(unit=>unit.profileId==='XEN-009'),ravager=[...sim.units.values()].find(unit=>unit.profileId==='XEN-010');
    if(!carrier||!ravager)throw new Error('Selected caste profiles are absent from the actual bound simulation');
    return{operationId:sim.config.id,variant:g.extinctionVariant,signedVariant:sim.config.context.extinctionCasteVariant,
      scene:{mapSeed:g.operationMapSeed,difficultyId:g.operationDifficulty,deploymentPlan:g.operationDeploymentPlan??'authored',extinctionVariant:g.extinctionVariant??'none'},
      run:g.campaignRunId,digest:sim.digest,ids:[...sim.units.keys()].sort(),allocated:sim.initialAllocated,conserved:sim.assertConservation(),
      carrierId:carrier.id,cargoIds:[...(carrier.carrierCargoIds??[])],
      cargo:(carrier.carrierCargoIds??[]).map(id=>{const unit=sim.units.get(id);return{id:unit.id,carrierId:unit.carriedByCarrierId,actorType:unit.actorType,groupId:unit.groupId};}),
      carrierGroupId:carrier.groupId,carrierUpgrade:sim.config.profiles.find(profile=>profile.id===carrier.profileId).extinctionUpgrade,
      ravagerId:ravager.id,ravagerUpgrade:sim.config.profiles.find(profile=>profile.id===ravager.profileId).extinctionUpgrade,playerHP:g.player.hp};
  });
  assert.equal(row.started.operationId,'AFF-27');assert.equal(row.started.variant,'carrier-ravager-enhanced');
  assert.equal(row.started.signedVariant,row.started.variant);assert.equal(row.started.carrierUpgrade,'supercarrier-genome');
  assert.equal(row.started.ravagerUpgrade,'colossal-resilience');assert.equal(row.started.cargoIds.length,6);
  assert.equal(new Set(row.started.cargoIds).size,6);assert.equal(row.started.ids.length,row.started.allocated);
  assert.equal(row.started.conserved,true);assert.ok(row.started.playerHP>0);
  for(const cargo of row.started.cargo){assert.ok(row.started.ids.includes(cargo.id));assert.equal(cargo.carrierId,row.started.carrierId);assert.equal(cargo.actorType,'facehugger');assert.equal(cargo.groupId,row.started.carrierGroupId);}
  const details=page.locator('#operation-panel details');
  if(!await details.evaluate(node=>node.open))await page.locator('#operation-panel summary').click();
  await page.locator('#operation-panel [data-save]').click();
  row.saved=await page.evaluate(()=>{
    const saved=JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));
    const carrier=saved.simulation.units.find(unit=>unit.profileId==='XEN-009');
    return{run:saved.campaignRunId,scene:saved.scene,digest:saved.simulation.configDigest,
      ids:saved.simulation.units.map(unit=>unit.id).sort(),carrierId:carrier.id,cargoIds:carrier.carrierCargoIds};
  });
  assert.deepEqual(row.saved.scene,row.started.scene);assert.equal(row.saved.digest,row.started.digest);
  assert.deepEqual(row.saved.ids,row.started.ids);assert.deepEqual(row.saved.cargoIds,row.started.cargoIds);
  await page.reload({waitUntil:'networkidle',timeout:180000});await page.waitForFunction(()=>Boolean(window.game),null,{timeout:180000});
  await page.locator('#btn-start-game').click();await page.locator('#btn-confirm-char').click();
  await page.locator('#btn-resume-operation').click();row.resumeInsertion=await ready();
  row.resumed=await page.evaluate(carrierId=>{
    const g=game,sim=g.battleSimulation,carrier=sim.units.get(carrierId);
    if(!carrier)throw new Error('Restoration replaced the actual Carrier identity');
    return{run:g.campaignRunId,variant:g.extinctionVariant,signedVariant:sim.config.context.extinctionCasteVariant,
      scene:{mapSeed:g.operationMapSeed,difficultyId:g.operationDifficulty,deploymentPlan:g.operationDeploymentPlan??'authored',extinctionVariant:g.extinctionVariant??'none'},
      digest:sim.digest,ids:[...sim.units.keys()].sort(),carrierId:carrier.id,cargoIds:[...(carrier.carrierCargoIds??[])],
      cargo:(carrier.carrierCargoIds??[]).map(id=>({id,carrierId:sim.units.get(id).carriedByCarrierId})),
      carrierUpgrade:sim.config.profiles.find(profile=>profile.id==='XEN-009').extinctionUpgrade,
      ravagerUpgrade:sim.config.profiles.find(profile=>profile.id==='XEN-010').extinctionUpgrade,conserved:sim.assertConservation()};
  },row.saved.carrierId);
  assert.equal(row.resumed.run,row.saved.run);assert.deepEqual(row.resumed.scene,row.saved.scene);
  assert.equal(row.resumed.variant,'carrier-ravager-enhanced');assert.equal(row.resumed.signedVariant,row.resumed.variant);
  assert.equal(row.resumed.digest,row.saved.digest);assert.deepEqual(row.resumed.ids,row.saved.ids);
  assert.equal(row.resumed.carrierId,row.saved.carrierId);assert.deepEqual(row.resumed.cargoIds,row.saved.cargoIds);
  assert.equal(row.resumed.carrierUpgrade,'supercarrier-genome');assert.equal(row.resumed.ravagerUpgrade,'colossal-resilience');
  assert.equal(row.resumed.conserved,true);for(const cargo of row.resumed.cargo)assert.equal(cargo.carrierId,row.saved.carrierId);
  await screenshot(current);
  await page.locator('#btn-pause-game').click();await page.locator('#btn-pause-menu-return').click();
  row.cleanup=await page.evaluate(()=>({playing:game.isPlaying,playerCleared:game.player===null,simulationCleared:game.battleSimulation==null}));
  assert.equal(row.cleanup.playing,false);assert.equal(row.cleanup.playerCleared,true);assert.equal(row.cleanup.simulationCleared,true);
 });
 report.status=report.cases.length===8&&report.cases.every(row=>row.status==='passed')&&!report.errors.length&&!report.failedRequests.length&&!report.externalRequests.length?'passed':'failed';
}catch(error){report.status='failed';report.error=error.stack;}
finally{
 await context?.close();await browser?.close();report.distUnchanged=JSON.stringify(before)===JSON.stringify(await tree(resolve(root,'dist')));if(!report.distUnchanged)report.status='failed';
 report.helperSourcesAfter=[];
 for(const file of report.helperSourcesBefore??[])report.helperSourcesAfter.push({path:file.path,sha256:hash(await readFile(resolve(root,file.path)))});
 report.helpersUnchanged=(report.helperSourcesBefore?.length===2)&&report.helperSourcesBefore.every(file=>report.helperSourcesAfter.find(after=>after.path===file.path)?.sha256===file.sha256);
 if(!report.helpersUnchanged)report.status='failed';
 report.finishedAt=new Date().toISOString();report.durationSeconds=(Date.parse(report.finishedAt)-Date.parse(report.startedAt))/1000;await save();await writeFile(resolve(options.output,'manifest.json'),JSON.stringify({schemaVersion:1,files:await tree(options.output)},null,2)+'\n');console.log(JSON.stringify({status:report.status,cases:report.cases.map(row=>({id:row.id,status:row.status})),errors:report.errors.length,failedRequests:report.failedRequests.length,distUnchanged:report.distUnchanged,helpersUnchanged:report.helpersUnchanged}));if(report.status!=='passed')process.exitCode=1;
}
