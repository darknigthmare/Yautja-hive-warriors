/* PREDATOR: HIVE WARRIORS - Main Game Router (v12.0 Apex Transcendent Edition) */

import * as THREE from 'three';
import { GamepadGameBridge } from './engine/GamepadGameBridge.js';
import { cameraNearPlaneRadius, resolveThirdPersonCamera } from './engine/CameraCollision.js';
import { EngineRenderer } from './engine/Renderer.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { GoreEngine } from './engine/GoreEngine.js';
import { OrbitalStrikeManager } from './engine/OrbitalStrike.js';
import { StoryCampaignManager } from './engine/StoryCampaign.js';
import { CombatEvents } from './engine/CombatEvents.js';
import { CombatDirector } from './engine/CombatDirector.js';
import { BattlefieldMission } from './engine/BattlefieldMission.js';
import { BattleCampaignRecord, CLAN_CAMPAIGN_ARC_ID } from './battlefield/BattleCampaignRecord.js';
import { BattleSimulation } from './battlefield/BattleSimulation.js';
import { combatRewardIdentity } from './battlefield/OperationRewards.js';
import { snapshotOperationPlayer, restoreOperationPlayer } from './battlefield/OperationPlayerState.js';
import { disposeBattleOperation } from './battlefield/BattleOperationLifecycle.js';
import { BattleActorBridge } from './battlefield/BattleActorBridge.js';
import { prepareBossEncounter } from './data/BossEncounterValidation.js';
import { AllyRescueSystem } from './battlefield/AllyRescueSystem.js';
import { BossPhasePressure } from './battlefield/BossPhasePressure.js';
import { CompanionLoadouts, COMPANION_KITS } from './battlefield/CompanionLoadouts.js';
import { HIVE_CONFLICT_ID } from './battlefield/HiveConflictScenario.js';
import { OperationTransport } from './entities/OperationTransport.js';
import { operationAlertState, captureBattleDebrief, hiveCoordinationFeedback } from './ui/OperationPanel.js';
import { OperationObjectives } from './battlefield/OperationObjectives.js';
import { createOperationScene } from './battlefield/OperationScene.js';
import { OperationBriefing } from './ui/OperationBriefing.js';
import { OperationWorld } from './battlefield/OperationWorld.js';
import { mountSourceCatalogue } from './ui/SourceCatalogue.js';
import { CommandMap, battleCommandFeedback } from './ui/CommandMap.js';
import { OperationPanel } from './ui/OperationPanel.js';
import { getBattlefieldMapVariant } from './data/BattlefieldMapVariants.js';
import { BATTLE_OPERATIONS, getBattleOperationConfig, getBattleOperationScene } from './data/BattleCatalog.js';
import { WeatherSystem } from './engine/WeatherSystem.js';
import { UIManager } from './ui/UIManager.js';
import { ForgeShop } from './ui/ForgeShop.js';
import { SandboxEditor } from './ui/SandboxEditor.js';
import { PhotoMode } from './ui/PhotoMode.js';
import { LoadoutScreen } from './ui/LoadoutScreen.js';
import { WeaponWheel } from './ui/WeaponWheel.js';
import { LoreCodexManager } from './ui/LoreCodex.js';
import { Player } from './entities/Player.js';
import { XenomorphHorde } from './entities/XenomorphHorde.js';
import { BossManager } from './entities/Bosses.js';
import { YautjaAlliesManager } from './entities/YautjaAllies.js';
import { YautjaSkimmer } from './entities/YautjaSkimmer.js';
import { YautjaCitadel } from './entities/YautjaCitadel.js';
import { ColonialMarinesManager } from './entities/ColonialMarines.js';
import { SyntheticsManager } from './entities/Synthetics.js';
import { BadBloodManager } from './entities/BadBloodEncounter.js';
import { HellHoundsManager } from './entities/HellHounds.js';
import { DropPodEntrance } from './entities/DropPodEntrance.js';
import { CheyenneDropship } from './entities/CheyenneDropship.js';
import { APCVehicle } from './entities/APCVehicle.js';
import { SentryGun } from './entities/SentryGun.js';
import { FalconDrone } from './entities/FalconDrone.js';
import { EnvironmentManager } from './entities/Environment.js';
import { CHARACTERS_DATA } from './data/charactersData.js';
import { LEVELS_DATA } from './data/levelsData.js';
import { disposeObject } from './engine/SceneResources.js';
import { createPreyArrowMesh } from './graphics/PreyEquipment.js';
import { operationSceneOptions, createMissionSupportContext } from './engine/MissionRuntimeContext.js';
import { traceSingleProjectileImpact } from './engine/SingleProjectileImpact.js';
import { canAccessLegacyAir, canHitLegacyAirTarget } from './engine/LegacyAirstrikePolicy.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.renderer = new EngineRenderer(this.container);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem(this.renderer.scene);
    this.gore = new GoreEngine(this.renderer.scene);
    this.orbital = new OrbitalStrikeManager(this.renderer.scene, this.audio);
    this.weather = new WeatherSystem(this.renderer.scene);
    this.forge = new ForgeShop(this.audio);
    this.ui = new UIManager();
    this.campaign = new StoryCampaignManager(this.ui);
    this.photoMode = new PhotoMode(this.renderer, this.renderer.scene, this.renderer.camera);
    this.citadel = new YautjaCitadel(this.renderer.scene);
    this.codex = new LoreCodexManager();
    this.env = new EnvironmentManager(this.renderer.scene);
    this.env.game = this;
    this.horde = new XenomorphHorde(this.renderer.scene, this.audio, this.gore);
    this.horde.environment = this.env;
    this.bosses = new BossManager(this.renderer.scene, this.audio);
    this.allies = new YautjaAlliesManager(this.renderer.scene, this.audio);
    this.skimmer = new YautjaSkimmer(this.renderer.scene, this.audio);
    this.marines = new ColonialMarinesManager(this.renderer.scene, this.audio);
    this.synthetics = new SyntheticsManager(this.renderer.scene, this.audio, this.particles);
    this.badBlood = new BadBloodManager(this.renderer.scene, this.audio);
    this.combatDirector = new CombatDirector({ graceSeconds: 8 });
    for (const manager of [this.horde, this.bosses, this.marines, this.synthetics, this.badBlood, this.allies]) {
      manager.combatDirector = this.combatDirector;
      manager.environment = this.env;
    }
    this.combatEvents = new CombatEvents({ runId: 'idle' });
    this._processedHitRecords = new WeakSet();
    this._registeredDeathHits = new Set();
    this._rewardedDeaths = new Set();
    this.combatEvents.subscribe(event => this.onCombatDeath(event));
    for (const manager of [this.horde, this.bosses, this.marines, this.synthetics, this.badBlood, this.allies]) manager.combatEvents = this.combatEvents;
    for (const manager of [this.horde, this.bosses, this.marines, this.synthetics, this.badBlood, this.allies]) manager.centralDeathScoring = true;
    this.battlefield = null;
    this.battlefieldProgression = null;
    this.hellHounds = new HellHoundsManager(this.renderer.scene, this.audio);
    this.dropPod = new DropPodEntrance(this.renderer.scene, this.audio, this.particles);
    this.dropship = new CheyenneDropship(this.renderer.scene, this.audio, this.particles);
    this.apc = new APCVehicle(this.renderer.scene, this.audio, this.particles);
    this.horde.supportTargetsProvider = () => this.getSupportCombatants();
    this.synthetics.supportTargetsProvider = () => this.getSupportCombatants();
    this.sentryGun = new SentryGun(this.renderer.scene, this.audio, this.particles);
    this.falconDrone = new FalconDrone(this.renderer.scene, this.audio, this.particles);
    this.pathogenPools = [];
    this.pathogenCooldown = 0;
    this.holoDecoys = [];

    this.weaponWheel = new WeaponWheel((weaponId) => {
      const owner = this.weaponWheel.inputOwner ?? this.player;
      if (owner?.selectWeapon?.(weaponId)) this.ui.showAnnouncement(`ARME SÉLECTIONNÉE : ${weaponId.toUpperCase()}`);
      else this.ui.showAnnouncement(owner?.getArsenalState?.().lastRefusal?.message ?? 'Cette arme ne fait pas partie de cet arsenal.');
    }, () => this.player);

    this.loadoutScreen = new LoadoutScreen((loadoutConfig) => {
      this.activeLoadout = loadoutConfig;
      this.startMission();
    });

    this.sandbox = new SandboxEditor((config) => this.startSandboxMission(config));

    this.player = null;
    this.player2 = null;
    this.isCoOp = false;
    this.activeLoadout = null;
    this.isFirstPerson = false;
    this.missionMode = 'hunt';
    this.operationId = 'pilot';
    this.operationDifficulty='standard';
    this.operationMapSeed=0;
    let campaignStorage = null; try { campaignStorage=globalThis.localStorage; } catch {}
    this.battleCampaign = new BattleCampaignRecord({storage:campaignStorage});
    this.campaignArcId = null; this.campaignRunId = null;
    this.battleSimulation = null;
    this.battleBridge = null;
    this.operationObjectives = null;
    this.operationWorld = null;
    this.commandMap = new CommandMap({preferences:()=>this.ui.presentationPreferences.get(),onClose:()=>this.closeTacticalModal('command-map-modal'),onCommand:command=>this.dispatchBattleCommand(command)});
    this.operationBriefing = new OperationBriefing(document.getElementById('loadout-prep-screen'));
    this.operationPanel = new OperationPanel({ onOrder: (id, order) => this.issueBattleOrder(id, order), onAction: (type, frontId) => this.battleAction(type, frontId), onCheckpoint: () => this.saveOperation(), onMap: () => this.openCommandMap() });
    this.pendingChapter = null;
    this.bossSpawned = false;
    this.missionTasks = [];
    this.missionEffects = [];
    this._nukeSequence = 0;
    this.missionRun = null;
    this.rewardSessionId = null; this._suspendOperation = false;
    this._supportTransaction = 0;

    this.projectiles = [];
    this.isPlaying = false;
    this.isPaused = false;

    this.waveIndex = 1;
    this.totalWaves = 5;
    this.score = 0;
    this.sessionSkulls = 0;
    this.comboHits = 0;
    this.announcedMilestones = {};
    this.nukeCountingDown = false;
    this.motionTrackerTimer = 0;
    this.battlefieldMorale = 50.0; // 0 to 100% (50 = balanced tug-of-war)
    this.trueMusouActive = false;
    this.vanguardFrenzyActive = false;

    // Musou Dynamic Camera & Screen Impact
    this.cameraShakeIntensity = 0;
    this.cameraShakeTimer = 0;
    this.cameraFovTimer = 0;
    this.cameraFovDuration = 0;
    this.targetCameraFov = 60;
    this.baseFov = 60;
    // v48.0 Bullet-Time Camera & Endless Musou Mode
    this.bulletTimeTimer = 0;
    // v51.0 Tactical Weapon Wheel Time Dilation
    this.isTimeDilated = false;
    this.isEndlessMode = false; // Finite missions are the default; survival must be selected before deployment.

    this.keys = {};
    this.gamepadBridge = new GamepadGameBridge(this);
    this.setupEventListeners();
    this.lastTime = performance.now();
    this.animate();
  }

  setupOperationSelection() {
    mountSourceCatalogue(this.ui.levelSelectMenu);
    const mode = document.getElementById('mission-mode-select');
    const select = document.getElementById('operation-select');
    const hiveOption=document.createElement('option');hiveOption.value=HIVE_CONFLICT_ID;hiveOption.textContent='Deux ruches rivales — scénario original';select.append(hiveOption);
    for (const operation of BATTLE_OPERATIONS) {
      const option = document.createElement('option'); option.value = operation.id;
      option.textContent = `${operation.id} · ${operation.title}${operation.requiresHumanController ? ' — contrôleur humain indisponible' : ''}`;
      option.disabled = operation.requiresHumanController; select.append(option);
    }
    const update = () => {
      document.getElementById('operation-select-label').classList.toggle('hidden', mode.value !== 'fronts');
      document.getElementById('operation-difficulty-label').classList.toggle('hidden',mode.value!=='fronts');
      document.getElementById('operation-layout-label').classList.toggle('hidden',mode.value!=='fronts');
      const arcEligible=mode.value==='fronts'&&/^AFF-0[1-5]$/.test(select.value);
      document.getElementById('campaign-arc-label').classList.toggle('hidden',!arcEligible);
      document.getElementById('campaign-arc-enabled').disabled=!arcEligible;
      if(!arcEligible)document.getElementById('campaign-arc-enabled').checked=false;
      const scene = mode.value === 'fronts' && BATTLE_OPERATIONS.some(operation=>operation.id===select.value) ? getBattleOperationScene(select.value) : null;
      document.getElementById('operation-provenance').textContent = scene ? `${scene.mapName} : scène adaptée au terrain ${scene.levelId}. Objectifs originaux ; géographie 1:1 non vérifiée.` : mode.value === 'fronts' ? 'Trois fronts reliés par des corridors et des contournements. Population finie ; positions lointaines signalées par rapports.' : mode.value === 'survival' ? 'Survie sans victoire finale. Les vagues continuent jusqu’à la défaite ou au retour au menu.' : 'Chasse finie : six secteurs, objectifs locaux, portes et boss final.';
    };
    mode.addEventListener('change', update); select.addEventListener('change', update); update();
    document.getElementById('btn-reset-campaign-arc').addEventListener('click',()=>{this.battleCampaign.resetArc(CLAN_CAMPAIGN_ARC_ID);this.updateCampaignDebrief();});
    this.updateCampaignDebrief();
    try { document.getElementById('btn-resume-operation').classList.toggle('hidden', !localStorage.getItem('yautja-operation-checkpoint-v1')); } catch {}
    document.getElementById('btn-resume-operation').addEventListener('click', () => {
      try {
        const saved=JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));
        if(saved?.version!==1 || !LEVELS_DATA.some(level=>level.id===saved.levelId)) throw new Error('invalid');
        this.missionMode='fronts';this.operationId=saved.operationId;this.isCoOp=saved.players===2;
        this.renderer.setSplitScreen(this.isCoOp);this.ui.selectedLevel=LEVELS_DATA.find(level=>level.id===saved.levelId);
        this.ui.selectedChar=CHARACTERS_DATA.find(character=>character.id===saved.characterId)??CHARACTERS_DATA[0];
        this.activeLoadout=saved.loadout;document.getElementById('fidelity-mode-select').value=saved.loadout?.fidelityMode??'adapted';this.startMission({resumeOperation:saved});
      } catch { this.isPlaying=false;this.isPaused=false;this.clearMissionState();this.ui.showScreen(this.ui.levelSelectMenu);this.ui.showAnnouncement('Sauvegarde indisponible ou incompatible. Une nouvelle opération peut être lancée.'); }
    });
  }

  startBattleOperation(saved = null) {
    for (const gate of this.env.battlefieldLayout.gates) this.env.openGate(gate.id);
    const {config}=createOperationScene({operationId:this.operationId,level:this.ui.selectedLevel,players:this.isCoOp?2:1,layout:this.env.battlefieldLayout,mapSeed:this.operationMapSeed,difficultyId:this.operationDifficulty});
    this.campaignArcId=saved?.campaignArcId??(document.getElementById('campaign-arc-enabled').checked&&/^AFF-0[1-5]$/.test(this.operationId)?CLAN_CAMPAIGN_ARC_ID:null);
    this.campaignRunId=saved?.campaignRunId??this.missionRun;
    this.rewardSessionId=this.campaignRunId;
    const unsupported=BattleActorBridge.unsupportedProfiles(config);
    if(unsupported.length) throw new Error(`Profils sans acteur de combat : ${unsupported.join(', ')}`);
    const bridge=this.battleBridge=new BattleActorBridge(this);
    const callbacks={canObserve:(value,observer)=>this.env.hasLineOfSight(new THREE.Vector3(observer.position[0],(this.env.getElevationAt(observer.position[0],observer.position[1])??0)+1.5,observer.position[1]),new THREE.Vector3(value.position[0],(this.env.getElevationAt(value.position[0],value.position[1])??0)+1.5,value.position[1])),history:this.battleCampaign.historyFor(config,{arcId:this.campaignArcId}),spawnGroup:(group,units)=>bridge.spawnGroup(group,units),despawnGroup:(group,units)=>bridge.despawnGroup(group,units),announce:event=>this.handleBattleAnnouncement(event)};
    this.battleSimulation=saved?BattleSimulation.fromState(config,saved.simulation,callbacks):new BattleSimulation(config,callbacks);
    this.battleBridge.bind(this.battleSimulation);
    this.allyRescue=new AllyRescueSystem({simulation:this.battleSimulation,actors:bridge.actors,players:()=>[this.player,this.player2].filter(Boolean),environment:this.env});
    this.allyRescue.bindManager(this.allies);
    if(saved?.rescue)this.allyRescue.restore(saved.rescue);
    this.bossPhasePressure=new BossPhasePressure({simulation:this.battleSimulation,getBoss:()=>this.bosses.activeBoss,announce:event=>this.operationPanel.feedback(event.label)});
    if(saved?.bossPressure)this.bossPhasePressure.restore(saved.bossPressure);
    this.battleSimulation.routeAvailabilityProvider=route=>this.env.isTacticalRouteAvailable?.(route.physicalRouteId??route.id.replace(/^bound-/,''))!==false;
    if(saved?.tacticalWorld)this.env.restoreTacticalWorld?.(saved.tacticalWorld);
    this.companionLoadouts=new CompanionLoadouts({simulation:this.battleSimulation,actors:bridge.actors,players:()=>[this.player,this.player2].filter(Boolean),environment:this.env});
    if(saved?.companions)this.companionLoadouts.restore(saved.companions);
    this.operationTransport=new OperationTransport(this.env,this.skimmer,this.battleSimulation,{hostilesProvider:()=>[...bridge.actors.values()].map(entry=>entry.actor),feedback:message=>this.operationPanel.feedback(message)});
    this._seenStrategicAlerts=new Set();
    for(const route of this.battleSimulation.getHUDState().routes)this.syncOperationRoute(route.id,route.open,route);
    if(config.operationObjectives) {
      this.operationObjectives=new OperationObjectives(config,this.battleSimulation,{onFeedback:message=>this.operationPanel.feedback(message),onEvent:event=>{this.operationPanel.feedback(event.label??'Objectif mis à jour.');if(event.type==='route_opened')this.syncOperationRoute(event.routeId,true,event);},resolvePosition:(point,navigation)=>this.resolveOperationMovement(point,navigation)});
      if(saved?.objectives)this.operationObjectives.restore(saved.objectives);
      this.operationWorld=new OperationWorld(this.renderer.scene,this.env,this.operationObjectives,config.playerFaction,config.factions.find(faction=>faction.id!==config.playerFaction)?.id);
    }
    this.totalWaves=3;
  }

  resolveOperationMovement(point, navigation = {}) {
    const position = new THREE.Vector3(point[0], 0, point[1]);
    if (navigation.origin && navigation.target && Number.isFinite(navigation.step)) {
      const origin = new THREE.Vector3(navigation.origin[0], 0, navigation.origin[1]);
      const target = new THREE.Vector3(navigation.target[0], 0, navigation.target[1]);
      const waypoint = this.env.getNavigationWaypoint?.(origin, target, .6) ?? target;
      const direction = waypoint.clone().sub(origin).setY(0);
      const distance = Math.min(direction.length(), navigation.step);
      position.copy(origin).addScaledVector(direction.normalize(), distance);
      this.env.resolveMovement(position, .6);
    } else this.env.resolveMovement(position, .6);
    return [position.x, position.z];
  }

  updateBattleOperation(delta) {
    if(!this.battleSimulation)return;
    const players=[this.player,this.player2].filter(Boolean).map((player,index)=>({id:index?'player2':'player1',position:[player.position.x,player.position.z],hp:player.hp}));
    this.battleBridge.sync();this.battleSimulation.update(delta,{players,paused:false});
    this.allyRescue?.update(delta);
    this.bossPhasePressure?.update(delta);
    this.companionLoadouts?.update(delta);
    this.operationObjectives?.update(delta,players);
    const state=this.battleSimulation.getHUDState(), objectives=this.operationObjectives?.getHUDState();
    state.phaseThreats=this.bossPhasePressure?.getHUDState().threats??[];
    state.rescue=this.allyRescue?.getState();
    const rescuePrompts=[this.player,this.player2].map((player,index)=>{const prompt=player&&this.allyRescue?.getPrompt(player);return prompt?`${this.isCoOp?`J${index+1} : `:''}${prompt.label.replace('[E]',this.gamepadBridge.inputMode==='gamepad'?'[X]':index?'[ENTRÉE]':'[E]')}`:null;}).filter(Boolean),rescueNode=document.getElementById('ally-rescue-prompt');
    if(rescueNode){rescueNode.classList.toggle('hidden',!rescuePrompts.length);rescueNode.textContent=rescuePrompts.join(' · ');}
    for(const alert of state.alerts??[])if(alert.priority>=3&&!this._seenStrategicAlerts.has(alert.id)){this._seenStrategicAlerts.add(alert.id);this.ui.showAnnouncement(operationAlertState(state,objectives,players).text);break;}
    this.operationWorld?.update(objectives);this.operationPanel.update(state,objectives,players);this.ui.updateOperationHUD(state,this.env.battlefieldLayout,players,objectives);
    if(state.result){this.endGame(state.result.outcome==='victory');return;}
  }

  observeBattleCampaign() {
    if(this.battleSimulation&&this.campaignArcId)this.battleCampaign.observe(this.battleSimulation.config,this.battleSimulation,{arcId:this.campaignArcId,runId:this.campaignRunId});
  }

  recordBattleOutcome(result) {
    if(!this.battleSimulation||!this.campaignArcId)return;
    this.battleCampaign.recordOutcome(this.battleSimulation.config,this.battleSimulation,result,{arcId:this.campaignArcId,runId:this.campaignRunId,characterId:this.ui.selectedChar.id,narrative:this.operationObjectives});
    this.updateCampaignDebrief();
  }

  updateCampaignDebrief() {
    const debrief=this.battleCampaign.getDebrief(CLAN_CAMPAIGN_ARC_ID);
    const dead=debrief.individuals.filter(individual=>individual.state==='dead').length;
    document.getElementById('campaign-arc-debrief').textContent=debrief.recordedRuns?`Arc original : ${debrief.recordedRuns} opérations enregistrées · ${dead} chefs vaincus restent absents · ${debrief.fronts.length} états de fronts conservés. ${debrief.social?.label??''} · statut narratif inchangé. Les autres opérations restent indépendantes.`:'Les opérations sont indépendantes. Cet arc optionnel conserve les chefs vaincus et les résultats entre AFF-01 et AFF-05.';
  }

  syncOperationRoute(routeId, open, details = {}) {
    const route = this.battleSimulation?.getHUDState().routes.find(item => item.id === routeId);
    const gateIds = details.physicalGateIds ?? route?.physicalGateIds;
    if (gateIds?.length) for (const gateId of gateIds) this.env.setGateOpen?.(gateId, open);
    else this.env.setOperationRouteOpen?.(details.physicalRouteId ?? routeId?.replace(/^bound-/, ''), open);
  }

  handleBattleAnnouncement(event) {
    if(event.type==='route_changed')this.syncOperationRoute(event.routeId,event.open);
    if(event.type==='unit_died')this.observeBattleCampaign();
    if(event.type==='hive_coordination_disrupted') {
      const message=hiveCoordinationFeedback(event,[...(this.battleSimulation?.groups.values()??[])],[...(this.battleSimulation?.fronts.values()??[])]);
      this.operationPanel.feedback(message);this.ui.showAnnouncement(message);
    }

  }

  openCommandMap() {
    if(!this.battleSimulation||!this.isPlaying||this.dropPod.isActive)return;
    const players=[this.player,this.player2].filter(Boolean).map((player,index)=>({id:index?'player2':'player1',position:[player.position.x,player.position.z],hp:player.hp}));
    this.commandMap.update(this.battleSimulation.getHUDState(),this.env.battlefieldLayout,players,this.isCoOp,this.commandMapExtras());
    this.toggleTacticalModal('command-map-modal');
  }

  commandMapExtras() {
    const state=this.battleSimulation.getHUDState();
    return{relationships:Object.fromEntries(this.battleSimulation.config.factions.map(faction=>[faction.id,this.battleSimulation.relationship(state.playerFaction,faction.id)])),units:this.battleSimulation.getActiveUnits().filter(unit=>unit.factionId===state.playerFaction&&!unit.uniqueId).map((unit,index)=>({id:unit.id,label:`Combattant ${index+1} · ${this.battleSimulation.getGroup(unit.groupId)?.label??''}`})),hostileGroups:state.groups.filter(group=>this.battleSimulation.areHostile(state.playerFaction,group.factionId)),companions:this.companionLoadouts?.getState(),phaseThreats:this.bossPhasePressure?.getHUDState().threats??[],difficultyLabel:this.battleSimulation.config.difficulty?.label??'Standard',mapSeed:this.operationMapSeed};
  }

  dispatchBattleCommand(command) {
    if(!this.battleSimulation)return{accepted:false};
    const{kind,groupIds,frontId,issuer,type}=command;let answer;
    if(kind==='formation'){const answers=groupIds.map(id=>this.battleSimulation.setFormation(id,command.formation,issuer));answer=answers.find(item=>!item.accepted)??answers[0]??{accepted:false};}
    else if(kind==='companionEquip'){const kit=COMPANION_KITS[command.kitId];answer=kit?this.companionLoadouts.register(command.unitId,{role:kit.role,allowedRoles:['medic','scout','engineer','support']}):{accepted:false};if(answer.accepted)answer=this.companionLoadouts.equip(command.unitId,command.kitId);}
    else if(kind==='companionAbility')answer=this.companionLoadouts.queueOrder(command.unitId,{type:command.ability,targetPlayerId:command.targetPlayerId,targetGroupId:command.targetGroupId,frontId});
    else if(kind==='transport')answer=this.operationTransport.requestTravel(issuer==='player2'?this.player2:this.player,frontId);
    else if(kind==='delegate')answer=this.battleSimulation.delegateFront(groupIds[0],frontId,issuer);
    else if(kind==='reinforce')answer=this.battleSimulation.requestReinforcements(this.battleSimulation.config.playerFaction,frontId);
    else if(kind==='tactic')answer=this.battleSimulation.issueTactic(groupIds,{type,frontId,issuer});
    else { const answers=groupIds.map(id=>this.issueBattleOrder(id,{type,frontId,issuer}));answer=answers.find(result=>!result?.accepted)??answers[0]??{accepted:false}; }
    this.commandMap.update(this.battleSimulation.getHUDState(),this.env.battlefieldLayout,[this.player,this.player2].filter(Boolean).map(player=>({position:[player.position.x,player.position.z],hp:player.hp})),this.isCoOp,this.commandMapExtras());
    return answer;
  }

  issueBattleOrder(groupId, order) {
    if(!this.battleSimulation||!this.isPlaying||this.dropPod.isActive)return;
    const answer=this.battleSimulation.issueOrder(groupId,{...order,issuer:order.issuer??'player1'});
    this.operationPanel.feedback(battleCommandFeedback(answer));return answer;
  }

  battleAction(type, frontId) {
    if(!this.battleSimulation||!this.player||this.dropPod.isActive)return;
    const result=this.battleSimulation.interact({id:'player1',position:[this.player.position.x,this.player.position.z],hp:this.player.hp},{type,frontId});
    this.operationPanel.feedback(result.accepted?'Action effectuée sur le front.':result.reason??'Approchez-vous du front.');
  }

  clearOperationCheckpoint() {
    try { const saved=JSON.parse(localStorage.getItem('yautja-operation-checkpoint-v1'));if(saved?.campaignRunId===this.campaignRunId){localStorage.removeItem('yautja-operation-checkpoint-v1');document.getElementById('btn-resume-operation').classList.add('hidden');} } catch {}
  }

  abandonOperation() {
    if(!this.battleSimulation||!this.isPlaying)return;
    this.recordBattleOutcome({outcome:'withdrawn',reason:'player_abandoned_operation'});this.clearOperationCheckpoint();
    this._abandonOperation=true;this.returnToMenu();
  }

  saveOperation() {
    if(!this.battleSimulation||!this.isPlaying||this.dropPod.isActive)return;
    this.battleBridge.sync();
    const snapshot={version:1,score:this.score,sessionSkulls:this.sessionSkulls,sessionDefeats:this._sessionDefeats,campaignArcId:this.campaignArcId,campaignRunId:this.campaignRunId,levelId:this.ui.selectedLevel.id,operationId:this.operationId,players:this.isCoOp?2:1,characterId:this.ui.selectedChar.id,loadout:this.activeLoadout,scene:{mapSeed:this.operationMapSeed,difficultyId:this.operationDifficulty},simulation:this.battleSimulation.saveState(),objectives:this.operationObjectives?.serialize(),tacticalWorld:this.env.serializeTacticalWorld?.(),preyInteractions:this.env.serializePreyInteractions?.(),supports:{version:1,apc:this.apc.serialize(),cheyenne:this.dropship.serialize()},companions:this.companionLoadouts?.serialize(),rescue:this.allyRescue?.serialize(),bossPressure:this.bossPhasePressure?.serialize(),playerStates:[this.player,this.player2].filter(Boolean).map(snapshotOperationPlayer)};
    try{localStorage.setItem('yautja-operation-checkpoint-v1',JSON.stringify(snapshot));this.operationPanel.feedback('Opération sauvegardée : identités, blessures, pertes et objectifs conservés.');document.getElementById('btn-resume-operation').classList.remove('hidden');}catch{this.operationPanel.feedback('Stockage indisponible : la partie reste active en mémoire.');}
  }

  setupEventListeners() {
    this.setupDeclarativeControls();
    this.setupOperationSelection();

    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'hunt';
      this.campaign.reset?.();
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-open-citadel').addEventListener('click', () => {
      this.audio.init();
      this.citadel.buildCitadelRoom(this.ui.trophyStats.skullsCollected);
      this.citadel.show();
      this.renderer.requestRender();
      this.ui.showAnnouncement('🏰 CITADELLE YAUTJA: STATION DE POLISSAGE DES TROPHÉES AU LASER');
    });

    document.getElementById('btn-open-story').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'campaign';
      this.operationBriefing.render(null);
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      const firstChapter = this.campaign.startCampaign();
      this.selectChapterLevel(firstChapter);
      this.ui.showAnnouncement(firstChapter.title);
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-open-coop').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'hunt';
      this.campaign.reset?.();
      this.isCoOp = true;
      this.renderer.setSplitScreen(true);
      this.citadel.hide();
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-confirm-char').addEventListener('click', () => {
      this.ui.showScreen(this.ui.levelSelectMenu);
    });

    document.getElementById('btn-back-to-char').addEventListener('click', () => {
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-launch-mission').addEventListener('click', () => {
      this.missionMode = document.getElementById('mission-mode-select').value;
      this.operationId = document.getElementById('operation-select').value;
      this.operationDifficulty=document.getElementById('operation-difficulty-select').value;
      this.operationMapSeed=Number(document.getElementById('operation-layout-select').value);
      if(this.missionMode==='fronts'){const scene=createOperationScene({operationId:this.operationId,level:this.ui.selectedLevel,players:this.isCoOp?2:1,mapSeed:this.operationMapSeed,difficultyId:this.operationDifficulty});scene.characterBriefing=this.battleCampaign.getCharacterBriefing(scene.config,{arcId:document.getElementById('campaign-arc-enabled').checked&&/^AFF-0[1-5]$/.test(this.operationId)?CLAN_CAMPAIGN_ARC_ID:null,characterId:this.ui.selectedChar.id});this.operationBriefing.render(scene);}else this.operationBriefing.render(null);
      if (this.missionMode === 'fronts' && BATTLE_OPERATIONS.some(operation=>operation.id===this.operationId)) this.ui.selectedLevel = LEVELS_DATA.find(level => level.id === getBattleOperationScene(this.operationId).levelId);
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-open-sandbox').addEventListener('click', () => {
      this.missionMode = 'sandbox';
      this.campaign.reset?.();
      this.ui.showScreen(document.getElementById('sandbox-modal'));
    });

    document.getElementById('btn-close-sandbox').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-forge').addEventListener('click', () => {
      this.ui.showScreen(document.getElementById('forge-modal'));
    });

    document.getElementById('btn-close-forge').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-trophies').addEventListener('click', () => {
      this.ui.updateTrophyRoom();
      this.ui.showScreen(this.ui.trophyModal);
    });

    document.getElementById('btn-close-trophies').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-options').addEventListener('click', () => {
      this.ui.showScreen(this.ui.optionsModal);
    });

    document.getElementById('btn-close-options').addEventListener('click', () => {
      this.ui.showScreen(this.isPlaying ? document.getElementById('pause-menu') : this.ui.mainMenu);
    });

    document.getElementById('btn-replay').addEventListener('click', () => {
      if (this.pendingChapter) {
        this.selectChapterLevel(this.pendingChapter);
        this.pendingChapter = null;
      } else if (this.missionMode === 'campaign' && !this.campaign.isActive) {
        this.selectChapterLevel(this.campaign.startCampaign());
      }
      if (this.missionMode === 'sandbox') {
        this.ui.showScreen(document.getElementById('sandbox-modal'));
        return;
      }
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-menu-return').addEventListener('click', () => {
      this.returnToMenu();
    });

    document.getElementById('btn-hud-weapons').addEventListener('click',()=>{if(this.isPlaying&&!this.dropPod.isActive)this.toggleWeaponWheel();});
    document.getElementById('btn-hud-map').addEventListener('click',()=>this.openCommandMap());
    document.getElementById('btn-hud-details').addEventListener('click',()=>document.getElementById('setting-detailed-hud').click());
    document.getElementById('btn-pause-game')?.addEventListener('click', () => this.togglePause(true));
    document.getElementById('btn-resume-game')?.addEventListener('click', () => this.togglePause(false));
    document.getElementById('btn-pause-menu-return')?.addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-abandon-operation')?.addEventListener('click', () => this.abandonOperation());
    document.getElementById('btn-pause-options')?.addEventListener('click', () => this.ui.showScreen(this.ui.optionsModal));
    document.getElementById('btn-back-to-menu')?.addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-back-to-levels')?.addEventListener('click', () => {
      this.ui.showScreen(this.missionMode === 'campaign' ? this.ui.mainMenu : this.ui.levelSelectMenu);
    });

    document.getElementById('btn-snap-photo').addEventListener('click', () => {
      this.photoMode.takeSnapshot();
    });

    document.getElementById('btn-exit-photo').addEventListener('click', () => {
      if (this.player) this.photoMode.toggle(this.player.position);
    });

    document.getElementById('btn-buy-hp').addEventListener('click', () => {
      const cost = this.forge.buyUpgrade('hp');
      if (cost > 0) this.ui.showAnnouncement('🛡️ SANTÉ AMÉLIORÉE AU MAXIMUM !');
    });

    document.getElementById('btn-buy-dmg').addEventListener('click', () => {
      const cost = this.forge.buyUpgrade('damage');
      if (cost > 0) this.ui.showAnnouncement('⚔️ DÉGÂTS DÉVASTATEURS BOOSTÉS !');
    });

    document.getElementById('btn-laser-cyan').addEventListener('click', () => {
      this.forge.selectLaserColor('#00d2ff');
      if (this.player) this.player.setLaserColor(0x00d2ff);
    });

    document.getElementById('btn-laser-red').addEventListener('click', () => {
      this.forge.selectLaserColor('#ff1a1a');
      if (this.player) this.player.setLaserColor(0xff1a1a);
    });

    document.getElementById('btn-laser-green').addEventListener('click', () => {
      this.forge.selectLaserColor('#39ff14');
      if (this.player) this.player.setLaserColor(0x39ff14);
    });

    // Hotkeys
    window.addEventListener('keydown', (e) => {
      if (e.target instanceof HTMLElement && (e.target.matches('input, select, textarea, [contenteditable="true"]') || (e.code !== 'Escape' && e.target.closest('button,summary,a,[role="button"]')))) return;
      if (e.code === 'Escape' && this.isPlaying) {
        e.preventDefault();
        if (this._tacticalModal) { this.closeTacticalModal(); return; }
        if (this.photoMode.isActive) this.photoMode.toggle(this.player.position);
        else if (this.weaponWheel.isOpen) this.weaponWheel.close();
        else this.togglePause(!this.isPaused);
        return;
      }
      if (this.isPlaying && this.dropPod.isActive) {
        if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        return;
      }
      this.keys[e.code] = true;

      if (!this.isPlaying || this.isPaused) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (this.photoMode.isActive) {
        if (e.code === 'KeyO') this.photoMode.toggle(this.player.position);
        return;
      }
      if (this.weaponWheel.isOpen && e.code !== 'KeyR') return;
      if (this.isCoOp && this.player2 && ['Enter', 'Numpad0', 'NumpadDecimal'].includes(e.code)) {
        e.preventDefault();
        if (e.code === 'Enter' && this.allyRescue?.interact(this.player2).accepted) return;
        if (e.code === 'Enter' && this.battlefield?.interact(this.player2)) return;
        this.performCoopAttack(e.code);
        return;
      }
      if (this.player?.hp <= 0) return;
      if (this.skimmer.isMounted && ['Space', 'ShiftLeft', 'ShiftRight', 'KeyG'].includes(e.code)) return;

      // Chantier 10: Bad Blood Honor Duel Clashing Blades QTE Input Interception
      if (this.badBlood && this.badBlood.isDueling) {
        if (this.badBlood.handleDuelInput(e.code, this.badBlood.duelTarget ?? this.player, this.ui, this.gore, this.particles, this)) {
          return;
        }
      }

      // First-Person Bio-Mask View Toggle [I Key]
      if (e.code === 'KeyI' && this.player) {
        this.isFirstPerson = !this.isFirstPerson;
        const fpsOverlay = document.getElementById('first-person-mask-overlay');
        if (this.isFirstPerson) {
          fpsOverlay.classList.remove('hidden');
          this.player.headMesh.visible = false;
          this.ui.showAnnouncement('🎭 VUE PREMIÈRE PERSONNE BIO-MASQUE ACTIVÉE');
        } else {
          fpsOverlay.classList.add('hidden');
          this.player.headMesh.visible = true;
          this.ui.showAnnouncement('🎭 VUE TROISIÈME PERSONNE RESTAURÉE');
        }
      }

      // Lucas QA Audit #4: Tactical Hunter Shadow Dash [Alt Key] (I-Frames & Cloaked After-Image)
      if ((e.code === 'AltLeft' || e.code === 'AltRight') && this.player && !e.repeat) {
        if (!this.keys['KeyM']) {
          e.preventDefault();
          this.player.performHunterShadowDash(this.particles, this.audio);
        }
      }

      // Prowl Roosting Perch Mode [J Key] / Chantier 1 (v50.0): Yautja Infiltration Dropship Carpet-Bombing [Shift + J]
      if (e.code === 'KeyJ' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.callInfiltrationDropshipBombing(this.horde, this.bosses, this.particles, this.audio, this.ui);
        } else {
          const isPerched = this.player.togglePerch();
          this.ui.showAnnouncement(isPerched ? '🌲 AFFÛT PERCHÉ EN HAUTEUR : DOMINANCE VERTICALE' : '⚡ PLONGEON D\'ASSASSINAT FURTIF AU SOL !');
        }
      }

      // Feral Hex-Shield [C Key]
      if (e.code === 'KeyC' && this.player) {
        const isBlock = this.player.toggleShieldBlock();
        this.ui.showAnnouncement(isBlock ? '🛡️ BOUCLIER HEXAGONAL FERAL DÉPLOYÉ (PARADE 100%)' : '🛡️ BOUCLIER RÉTRACTÉ');
      }

      // Clan Warhorn [K Key]
      if (e.code === 'KeyK' && this.player) {
        this.player.soundWarhorn();
        this.ui.showAnnouncement('📯 COR DE GUERRE ANCESTRAL DU CLAN : FRAPPE +50% & VITESSE !');
      }

      // Chantier 4 & Lucas QA (v53.0): Chest-Thumping Challenge Roar [H Key] / Hell-Hounds Pack [Shift + H]
      if (e.code === 'KeyH' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          if(this.battleSimulation){this.ui.showAnnouncement('Cette opération utilise uniquement ses forces préallouées ; la meute ne peut pas être invoquée.');return;}
          this.hellHounds.summonPack(this.player.position, 2);
          this.ui.showAnnouncement('🐕 MEUTE DE CHIENS DE CHASSE HELL-HOUNDS DÉPLOYÉE !');
        } else {
          this.player.performPredatorChestThumpRoar(this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui);
        }
      }

      // Audio Mimicry Voice Lure [Shift + Y] / Yautja Thermal Plasma Tripwire Mine [Y Key] (Chantier 5 & Elena QA)
      if (e.code === 'KeyY' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.triggerVoiceMimicryDecoy(this.horde, this.audio, this.ui, this.particles);
        } else {
          if (this.player.deployTripwireMine(this.renderer.scene, this.particles)) {
            this.ui.showAnnouncement('🕸️ MINE TRIPWIRE PLASMA YAUTJA DÉPLOYÉE (3 FAISCEAUX LASER) !');
          } else {
            this.ui.showAnnouncement('⏳ MINE EN RECHARGE OU MAXIMUM DE 3 MINES ATTEINT');
          }
        }
      }

      // QA Audit #1 Fix: Toggle Tactical Keybind Reference Overlay [F1 Key]
      if (e.code === 'F1') {
        e.preventDefault();
        const helpOverlay = document.getElementById('qa-tactical-help-overlay');
        if (helpOverlay) helpOverlay.classList.toggle('hidden');
      }

      // Chantier 9 (v50.0): Toggle Persistent Yautja Clan Honor Vault Modal [F2 Key]
      if (e.code === 'F2') {
        e.preventDefault();
        this.toggleClanHonorVaultModal();
      }

      // Chantier 1 (v51.0): Toggle Sacred Clan Weapon Forge Modal [F3 Key]
      if (e.code === 'F3') {
        e.preventDefault();
        this.toggleClanForgeModal();
      }

      // Chantier 3 & Elena QA (v52.0): Mothership Tactical Command Bridge [F4 Key]
      if (e.code === 'F4') {
        e.preventDefault();
        this.toggleMothershipBridgeModal();
      }

      // Segmented Spine Whip [Digit 1] / Chantier 1 (v49.0): Yautja Heavy Gravity Maul [Shift + Digit 1]
      if ((e.code === 'Digit1' || e.code === 'Numpad1') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.performMaulEarthshaker(this.horde, this.bosses, this.synthetics, this.env, this.particles, this.ui);
        } else {
          this.performSpineWhip();
        }
      }

      // Engineer Black Pathogen Mutagen Urn Bombardment [Digit 2] (Prometheus 2012)
      if ((e.code === 'Digit2' || e.code === 'Numpad2') && this.player) {
        this.triggerPathogenUrnStrike();
      }

      // Laser-Guided Flechette Volley [Digit 3] / Chantier 7 (v49.0): Seegson High-Voltage Bolt Gun [Shift + Digit 3]
      if ((e.code === 'Digit3' || e.code === 'Numpad3') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireSeegsonBoltGun(this.horde, this.bosses, this.synthetics, this.particles, this.ui);
        } else {
          this.triggerLaserGuidedFlechettes();
        }
      }

      // UA 571-C Automated Remote Sentry Gun [Digit 4] (Aliens 1986 Special Edition)
      if ((e.code === 'Digit4' || e.code === 'Numpad4') && this.player) {
        this.deploySentryGun();
      }

      // Falconer Biomechanical Falcon Drone [Digit 5] (Predators 2010 Canon 1:1)
      if ((e.code === 'Digit5' || e.code === 'Numpad5') && this.player) {
        this.launchFalconDrone();
      }

      // Alpha Predator Primordial Dragon Bone Scythe [Digit 6] (NECA / Hunting Grounds Lore)
      if ((e.code === 'Digit6' || e.code === 'Numpad6') && this.player) {
        this.performBoneScytheCleave();
      }

      // Yautja Charged Compound Bow [Digit 7] / Chantier 3 (v48): USCM M77 Gauss Railgun Rifle [Shift + Digit 7]
      if ((e.code === 'Digit7' || e.code === 'Numpad7') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireM77GaussRifle(this.horde, this.bosses, this.synthetics, this.env, this.particles, this.ui);
        } else {
          this.fireCompoundBow();
        }
      }

      // Holographic Decoy [Digit 8] / Chantier 5 (v48): Bishop Reprogrammed Android Squad & Anti-Grav Disruptor [Shift + Digit 8]
      if ((e.code === 'Digit8' || e.code === 'Numpad8') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          if (this.env && this.env.deployReprogrammedAndroidSquad) {
            this.env.deployReprogrammedAndroidSquad(this.player, this.audio, this.ui);
          }
          this.player.deployAntiGravDisruptor(this.horde, this.synthetics, this.particles);
        } else {
          this.deployHoloDecoy();
        }
      }

      // Chantier 2 (v47): Ancient Yautja Plasma Scythe [Shift + Digit 6] (AvP Extinction 2003)
      if ((e.code === 'Digit6' || e.code === 'Numpad6') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.togglePlasmaScythe(this.ui);
        }
      }

      // Yautja Dual-Bladed Plasma Glaive Cyclone [Digit 9] / Chantier 5 (v47): USCM M41A Underbarrel 30mm HEDP Grenade [Shift + Digit 9]
      if ((e.code === 'Digit9' || e.code === 'Numpad9') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireM41AGrenade(this.ui, this.horde, this.bosses, this.synthetics, this.env, this.particles);
        } else {
          if (this.player.triggerPlasmaGlaive(this.horde, this.synthetics, this.bosses)) {
            this.ui.showAnnouncement('⚡ TOURBILLON DE PLASMA GLAIVE ACTIVÉ : CYCLONE DÉFLECTEUR 360° !');
          } else {
            this.ui.showAnnouncement('⏳ PLASMA GLAIVE EN RECHARGE...');
          }
        }
      }

      // Royal Jelly Berserker Rage Stimulant [Digit 0] / Chantier 8 (v54.0): Burner Heavy Plasma Blast [Shift + Digit 0]
      if ((e.code === 'Digit0' || e.code === 'Numpad0') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireBurnerHeavyPlasma(this.horde, this.bosses, this.synthetics, this.particles, this.audio, this.ui);
        } else {
          if (this.player.consumeRoyalJelly()) {
            this.ui.showAnnouncement('👑 GELÉE ROYALE CONSOMMÉE : FUREUR BERSERKER YAUTJA ACTIVÉE (+45% VIT, +100% DÉGÂTS) !');
            this.particles.emitGoldRageSparks(this.player.position, 25);
          } else if (this.player.isBerserkerActive) {
            this.ui.showAnnouncement('🔥 RAGE BERSERKER DÉJÀ ACTIVE !');
          } else {
            this.ui.showAnnouncement('❌ AUCUNE FLASQUE DE GELÉE ROYALE DISPONIBLE');
          }
        }
      }

      // Collapsible 6-Blade Shuriken [L Key] (AVP 2004 Celtic / Scar Lore)
      if (e.code === 'KeyL' && this.player) {
        this.throwShuriken();
      }

      // Gauntlet EMP Overcharge Pulse [U Key]
      if (e.code === 'KeyU' && this.player) {
        if (this.player.triggerGauntletEMP(this.horde, this.synthetics)) {
          if (this.horde && this.horde.zeroGAcidGlobules) {
            this.horde.zeroGAcidGlobules.forEach(g => {
              const repelDir = g.mesh.position.clone().sub(this.player.position).normalize();
              g.driftVel.copy(repelDir).multiplyScalar(18);
            });
          }
          this.ui.showAnnouncement('⚡ DÉCHARGE EMP DE POIGNET : ANDROÏDES COURT-CIRCUITÉS & XÉNOS PARALYSÉS !');
        } else {
          this.ui.showAnnouncement('⏳ EMP EN RECHARGE CONDENSATEUR...');
        }
      }

      // Netgun Entanglement & Gauntlet Flechette Needler [G Key]
      if (e.code === 'KeyG' && this.player) {
        const distToSkimmer = this.skimmer ? this.player.position.distanceTo(this.skimmer.position) : 999;
        if (this.skimmer && (this.skimmer.isMounted || distToSkimmer < 4.5)) {
          // Boarding or exiting the Yautja Skimmer vehicle
          this.skimmer.mountCooldown = 0;
        } else {
          if (this.player.fireNetgun(this.horde, this.synthetics)) {
            this.ui.showAnnouncement('🕸️ LANCE-FILET NETGUN DÉPLOYÉ : CIBLE ENTOURÉE DE FIL DE DIAMANT TRANCHANT !');
          } else {
            this.fireFlechetteNeedler();
          }
        }
      }

      // Pounce Leap [Shift + Space] / Chantier 4 & Lucas QA (v52.0): Combi-Stick Pole Vault Leap
      if (e.code === 'Space' && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.player) {
        this.player.usedShiftModifier = true;
        if (this.player.activeWeapon === 'combistick' || this.player.poleVaultCooldown <= 0) {
          if (this.player.performCombistickPoleVault(this.horde, this.bosses, this.audio, this.particles, this.ui)) {
            // Vault leaping initiated!
          } else if (this.player.pounceLeap()) {
            this.ui.showAnnouncement('⚡ SUPER-SAUT POUNCE LEAP DÉPLOYÉ !');
          }
        } else if (this.player.pounceLeap()) {
          this.ui.showAnnouncement('⚡ SUPER-SAUT POUNCE LEAP DÉPLOYÉ !');
        }
      }

      // 4 Bio-Mask Vision Modes [V Key] / Chantier 7 (v48): Modular Legendary Yautja Bio-Masks [Shift + V]
      if (e.code === 'KeyV' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.cycleLegendaryBioMask(this.ui);
        } else {
          const mode = this.player.cycleVisionMode();
          if (this.audio && this.audio.playBioMaskVisionCycle) this.audio.playBioMaskVisionCycle();
          this.updateVisionOverlays(mode);
        }
      }

      if (e.code === 'KeyR') {
        const nearSentry = this.sentryGun && this.sentryGun.isDeployed && this.player && this.player.position.distanceTo(this.sentryGun.mesh.position) < 3.5;
        if (nearSentry) {
          const rotY = this.player.mesh ? this.player.mesh.rotation.y : this.player.rotationY;
          if (this.sentryGun.calibrateDirection(this.player.position, rotY)) {
            if (this.audio && this.audio.playSentrySpinUp) this.audio.playSentrySpinUp();
            this.ui.showAnnouncement('🧭 SENTINELLE UA 571-C : ARC DE TIR CALIBRÉ VERS VOTRE VISÉE !');
          }
        } else {
          this.weaponWheel.toggle();
        }
      }

      if (e.code === 'KeyE') this.handlePlayerInteraction(this.player);

      // QA Audit #4 Fix: Deduplicated KeyX — [X] Trax-Net Dart / [Shift + X] Orbital Plasma Strike
      if (e.code === 'KeyX' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          if (this.orbital.triggerStrike(this.player.position, this.horde, this.bosses, this.particles)) {
            this.ui.showAnnouncement('🚀 FRAPPE PLASMA ORBITALE DÉCLENCHÉE !');
          }
        } else {
          const tagged = this.player.fireTraxNetDart(this.horde, this.synthetics, this.bosses);
          if (tagged) {
            this.ui.showAnnouncement('🎯 BALISE TRAX-NET VERROUILLÉE (+25% DÉGÂTS, TÉLÉMÉTRIE MURALE 25S) !');
          } else {
            this.ui.showAnnouncement('⏳ LANCEUR TRAX-NET EN RECHARGE OU AUCUNE CIBLE');
          }
        }
      }

      // [T] Yautja Steel Bear Trap / Chantier 5 (v49.0): [Shift + T] Tracker Predator Sonic Trap Mine
      if (e.code === 'KeyT' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.deploySonicTrapMine(this.ui);
        } else if (this.player.deployBearTrap(this.horde)) {
          this.ui.showAnnouncement('🪤 PIÈGE À LOUP YAUTJA STEEL BEAR TRAP DÉPLOYÉ !');
        }
      }

      // [N] equipped self-destruct; [Shift+N] optional neurotoxin.
      if (e.code === 'KeyN' && this.player && !this.nukeCountingDown) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.throwNeurotoxinCanister?.(this.horde, this.bosses, this.synthetics, this.ui, this.particles, this.env);
        } else if (this.player.hasGadget?.('nuke')) this.triggerNukeCountdownSequence();
        else this.ui.showAnnouncement("Équipez l’autodestruction avant la chasse.");
      }

      // Smart-Disc Throw & Chantier 7 (v54.0): Multi-Lock Ricochet [Shift + B] / Remote Guidance [Ctrl + B]
      if (e.code === 'KeyB' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.performSmartDiscMultiLock(this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui);
          return;
        }
        const activeDisc = this.projectiles.find(p => p.isSmartDisc && p.life > 0.1);
        if (activeDisc) {
          if (this.keys['ControlLeft'] || this.keys['ControlRight']) {
            if (this.player.isSmartDiscGuiding) {
              this.player.stopSmartDiscRemoteGuidance();
              this.ui.updateSmartDiscGuidance(false);
              this.ui.showAnnouncement('🎯 TÉLÉGUIDAGE SMART-DISC DÉSACTIVÉ : RETOUR EN MAIN');
            } else {
              this.player.startSmartDiscRemoteGuidance(activeDisc);
              this.ui.updateSmartDiscGuidance(true);
              this.ui.showAnnouncement('🎯 TÉLÉGUIDAGE SMART-DISC ACTIVÉ : ORIENTATION LASER CONTINUE !');
            }
          } else {
            this.triggerSmartDiscRicochet(activeDisc);
          }
        } else if (this.player.acidSolventCharges > 0 && this.horde.acidPools.length > 0) {
          if (this.player.useAcidSolvent(this.horde)) {
            this.ui.showAnnouncement('🧪 FIOLE DE SOLVANT D\'ACIDE DÉPLOYÉE: SOL PURIFIÉ !');
          }
        } else {
          this.throwSmartDisc();
        }
      }

      // Medicomp Visceral Cauterization [KeyZ] / Chantier 5 (v55.0): Sniper Plasma Tri-Laser Focus Mode [Shift + KeyZ]
      if (e.code === 'KeyZ' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.toggleSniperPlasmaMode(this.renderer.camera, this.audio, this.ui);
        } else if (this.player.useMedicomp()) {
          this.particles.emitMedicompSteam(this.player.position, 24);
          this.ui.showAnnouncement('💉 MEDICOMP CAUTÉRISATION VISCÉRALE: SOIN 450 HP & BIO-VAPEUR ANTISEPTIQUE !');
        } else {
          this.player.toggleSniperPlasmaMode(this.renderer.camera, this.audio, this.ui);
        }
      }

      // QA Audit #4 Fix: Deduplicated KeyM — [M] Scout Ship Beam / [Alt + M] Hybrid Metamorphosis / [Shift + M] Endless Mode
      if (e.code === 'KeyM' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.ui.showAnnouncement('Le mode survie se choisit avant le déploiement, dans la sélection du terrain.');
        } else if (this.keys['AltLeft'] || this.keys['AltRight']) {
          this.player.triggerHybridMetamorphosis();
        } else {
          this.player.triggerScoutShipBeam(this.ui);
        }
      }

      // QA Audit #4 Fix: Deduplicated KeyP — [P] Combi-Stick Throw / [Shift + P] or [Shift + 4] Plasma Pistol 3-Bolt Burst
      if (e.code === 'KeyP' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          const fired = this.player.firePlasmaPistol(this.horde, this.bosses, this.particles, this.env);
          if (fired) {
            this.ui.showAnnouncement('⚡ RAFALE PISTOLET PLASMA TRIPLETTE (AVP-R) : 3x95 DÉGÂTS D\'ÉNERGIE PURE !');
          } else {
            this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE (12 REQUIS) OU RECHARGE EN COURS');
          }
        } else {
          this.throwCombiStick();
        }
      }

      // Photo mode keeps its documented shortcut; the exosuit uses Shift+O.
      if (e.code === 'KeyO' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (this.player.activateCyberExosuit(this.ui, this.particles)) {
            // Exosuit active!
          } else {
            this.ui.showAnnouncement('⏳ EXOSQUELETTE BIONIQUE EN RECHARGE (45S)...');
          }
        } else this.photoMode.toggle(this.player.position);
      }

      if (e.code === 'Backquote' && this.battleSimulation) { e.preventDefault(); this.openCommandMap(); return; }

      if (e.code === 'Tab' && this.player) {
        e.preventDefault();
        this.toggleWeaponWheel();
      }

      // Chantier 4 & Lucas QA (v51.0): Dedicated Wristblade Parry Deflection [KeyF] (AVP 2010 / Hunting Grounds)
      if (e.code === 'KeyF' && this.player) {
        if(e.shiftKey){this.player.usedShiftModifier=true;this.player.performWristbladeParry(this.audio,this.particles,this.ui);}
        else this.player.toggleCloak();
      }

      // Chantier 7 (v45): Yautja Ki'cte Gauntlet Grapple & Seismic Counter-Throw [KeyG] (Concrete Jungle / Prey)
      if (e.code === 'KeyG' && this.player) {
        this.player.performGauntletGrapple(this.horde, this.bosses, this.ui, this.particles, this.env);
      }

      // Chantier 5 (v45): Yautja Pure Energy Plasma Pistol 3-Bolt Burst [Shift+Digit4] (AVP: Requiem 2007)
      if (e.code === 'Digit4' && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.player) {
        this.player.usedShiftModifier = true;
        const fired = this.player.firePlasmaPistol(this.horde, this.bosses, this.particles, this.env);
        if (fired) {
          this.ui.showAnnouncement('⚡ RAFALE PISTOLET PLASMA TRIPLETTE (AVP-R) : 3x95 DÉGÂTS D\'ÉNERGIE PURE !');
        } else {
          this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE (12 REQUIS) OU RECHARGE EN COURS');
        }
      }

      // Chantier 4 (v45): Struggle Against Latched Royal Facehugger
      if (e.code === 'Space' && this.player && this.player.isRoyalFacehuggerLatched) {
        if (this.horde && this.horde.struggleRoyalFacehugger(this.player)) {
          return;
        }
      }

      // Chantier 4 (v46): Exosuit Ground Slam Repulsor Shockwave
      if (e.code === 'Space' && this.player && this.player.isExosuitActive) {
        this.player.performGroundSlam(this.horde, this.bosses, this.synthetics, this.ui, this.particles, this.env);
      }

      if ((e.code === 'Space' && !this.keys['ShiftLeft'] && !this.keys['ShiftRight']) || e.code === 'KeyQ') {
        if (this.player && this.player.triggerMusouOverload()) {
          this.executeMusouOverload();
        }
      }

      if (e.code === 'ShiftLeft' && !this.keys['Space'] && this.player) {
        if (this.player.getWeaponState?.().rangedResource === 'bolts') { this._boltTriggerHeld = true; this.player.usedShiftModifier = false; return; }
        if (!this.player.isChargingPlasma) {
          this.player.isChargingPlasma = true;
          this.player.plasmaChargeTime = 0;
          this.player.usedShiftModifier = false;
          if (this.audio && this.audio.playPlasmaChargeUp) {
            this.audio.playPlasmaChargeUp();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
      if (!this.isPlaying || this.isPaused || this.dropPod.isActive || this.photoMode.isActive || this.weaponWheel.isOpen) { if(this.player)this.player.isChargingPlasma=false;this._boltTriggerHeld=false;return; }
      if (e.code === 'ShiftLeft' && this._boltTriggerHeld) { this._boltTriggerHeld=false; if(!this.player.usedShiftModifier)this.firePlasmaCannon(false);this.player.usedShiftModifier=false;return; }

      if (e.code === 'ShiftLeft' && this.player && this.player.isChargingPlasma) {
        const usedMod = this.player.usedShiftModifier;
        this.player.isChargingPlasma = false;
        this.player.usedShiftModifier = false;
        if (!usedMod) {
          const isCharged = this.player.plasmaChargeTime >= 0.55;
          const fired = this.firePlasmaCannon(isCharged);
          if (fired && isCharged) {
            this.ui.showAnnouncement('💥 TIR PLASMA SURCHARGÉ DÉCHAÎNÉ : VAPORISATION 10M !');
          }
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (e.target.closest?.('button, input, select, textarea, summary, a, [role="button"], .modal-card, .operation-panel')) return;
      if (!this.isPlaying || this.isPaused || this.dropPod.isActive || this.player?.hp <= 0 || this.photoMode.isActive || this.weaponWheel.isOpen) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, input, select, a, .modal-card, .wheel-item')) return;
      if (e.button === 1) {
        e.preventDefault();
        this.weaponWheel.toggle();
      }
      if (e.button === 0) {
        if (this.player && this.player.isMountedSmartgun) {
          this.env.fireSmartgun(this.player, this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui);
          return;
        }
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (this.player) this.player.usedShiftModifier = true;
          if (this.activeLoadout && this.activeLoadout.primary === 'katana') {
            const hits = this.player.performIaijutsuSlash(this.horde, this.synthetics, this.bosses, this.particles);
            if (hits) {
              this.registerHits(hits);
              this.ui.showAnnouncement('⚔️ TRANCHANT ULTRASONIQUE IAIJUTSU DAH\'DT\'DE : DÉCOUPAGE TOTAL !');
            } else {
              this.ui.showAnnouncement('⏳ IAIJUTSU EN RECHARGE...');
            }
          } else {
            this.performSpineWhip();
          }
        } else {
          if (this.player && this.player.isPlasmaScytheActive) {
            this.player.performPlasmaScytheSlash(this.horde, this.bosses, this.synthetics, this.env, this.particles);
            this.triggerCameraShake(0.7, 0.25);
          } else if (this.player && this.player.hasParryRiposte) {
            const hits = this.player.performGuanThweiRiposte(this.horde, this.synthetics, this.bosses, this.particles);
            this.registerHits(hits);
            this.ui.showAnnouncement('⚔️ CONTRE-RIPOSTE GUAN-THWEI : CISAILLEMENT DÉCAPITANT DÉCHAÎNÉ !');
            this.triggerCameraShake(0.85, 0.35);
          } else {
            this.performLightAttack();
          }
        }
      }
      if (e.button === 2) {
        e.preventDefault();
        if (this.player && this.player.isSniperMode) {
          this.player.fireSniperPlasmaLance(this.horde, this.bosses, this.synthetics, this.particles, this.audio, this.ui);
          return;
        }
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (this.player) {
            this.player.usedShiftModifier = true;
            if (this.keys['Space']) {
              // Chantier 6 (v50.0): Dual Plasma Casters Concentrated Overcharge Beam
              this.player.fireDualPlasmaOverchargeBeam(this.horde, this.bosses, this.synthetics, this.particles, this.audio, this.ui);
            } else {
              // Chantier 6: Plasma Glaive Spin Shield & Kinetic Reflection
              this.player.toggleWhirlShield(true);
              this.ui.showAnnouncement('🛡️ BOUCLIER TOURNANT DE PLASMA GLAIVE DÉPLOYÉ (DÉVIATION 90% & RÉFLEXION ACIDE) !');
            }
          }
        } else {
          this.performHeavyAttack();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 && this.player && this.player.isWhirlShieldActive) {
        this.player.toggleWhirlShield(false);
      }
    });

    window.addEventListener('contextmenu', e => {
      if (this.isPlaying && !this.isPaused) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      if (this.isPlaying && !this.photoMode.isActive) this.togglePause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys = {};
        if (this.isPlaying && !this.photoMode.isActive) this.togglePause(true);
      }
    });
  }

  selectChapterLevel(chapter) {
    const level = LEVELS_DATA.find(entry => entry.id === chapter?.levelId);
    if (level) this.ui.selectedLevel = level;
  }

  togglePause(paused = !this.isPaused) {
    if (!this.isPlaying) return;
    this.isPaused = paused;
    this.keys = {};
    this.weaponWheel.close();
    if (paused && this.photoMode.isActive) this.photoMode.toggle(this.player.position);
    this.ui.showScreen(paused ? document.getElementById('pause-menu') : this.ui.inGameHud);
    this.renderer.requestRender();
    this.lastTime = performance.now();
  }

  scheduleMissionTask(callback, delay) {
    this.missionTasks.push({ callback, remaining: delay });
  }

  updateMissionTasks(delta) {
    for (let i = this.missionTasks.length - 1; i >= 0; i--) {
      const task = this.missionTasks[i];
      task.remaining -= delta;
      if (task.remaining <= 0) {
        this.missionTasks.splice(i, 1);
        task.callback();
      }
    }
    for (let i = this.missionEffects.length - 1; i >= 0; i--) {
      const effect = this.missionEffects[i];
      effect.life -= delta;
      if (effect.life <= 0) {
        this.removeEffectMesh(effect.mesh);
        this.missionEffects.splice(i, 1);
      } else effect.update?.(delta, effect.life / effect.maxLife);
    }
  }

  removeEffectMesh(mesh) {
    if (!mesh) return;
    this.renderer.scene.remove(mesh);
    const geometries = new Set();
    const materials = new Set();
    mesh.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      const entries = Array.isArray(child.material) ? child.material : [child.material];
      entries.filter(Boolean).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  removeHoloDecoy(decoy) {
    if (typeof decoy?.dispose === 'function') decoy.dispose();
    else if (decoy?.mesh) this.removeEffectMesh(decoy.mesh);
  }

  clearMissionState() {
    this.ui.clearTransientState?.();
    this.gamepadBridge?.reset();
    disposeBattleOperation(this);
    this._nukeSequence++;
    this.battlefield?.dispose();
    this.battlefield = null;
    this.battlefieldProgression = null;
    this.combatDirector.reset({ graceSeconds: 8 });
    this.ui.updateBattlefieldHUD?.(null);
    this.missionTasks = [];
    this.keys = {};
    this.weaponWheel.close();
    if (this.photoMode.isActive && this.player) this.photoMode.toggle(this.player.position);
    for (const projectile of this.projectiles) this.removeEffectMesh(projectile.mesh);
    this.projectiles = [];
    for (const pool of this.pathogenPools) {
      this.removeEffectMesh(pool.urnMesh);
      this.removeEffectMesh(pool.poolMesh);
    }
    this.pathogenPools = [];
    this.pathogenCooldown = 0;
    for (const decoy of this.holoDecoys) this.removeHoloDecoy(decoy);
    this.holoDecoys = [];
    for (const effect of this.missionEffects) this.removeEffectMesh(effect.mesh);
    this.missionEffects = [];
    this.nukeCountingDown = false;
    this._tacticalModal = null; this.isTimeDilated = false;this._boltTriggerHeld=false;
    document.getElementById('yautja-radial-weapon-wheel')?.classList.add('hidden');
    this.isFirstPerson = false;
    this.lockedTargetPos = null;
    this.motionTrackerTimer = 0;
    this.closestEnemyDist = Infinity;
    this.audio.stopBackgroundMusic();
    this.audio.stopThermalHum();
    this.allies.clearSquad();
    this.marines.clearSquad();
    this.synthetics.clearSquad();
    this.hellHounds.dismissPack();
    this.dropPod.clear();
    this.updateInsertionStatus();
    this._insertionCameraFocus = null;
    this.dropship.clear();
    this.clearAPCSupport();
    this.sentryGun.clear();
    this.falconDrone.clear();
    this.horde.clearWave();
    this.bosses.clear?.();
    this.badBlood.clear?.();
    this.weather.clear?.();
    this.particles.clear?.();
    this.orbital.clear?.();
    this.gore.clear();
    this.skimmer.isMounted = false;
    this.skimmer.mountCooldown = 0;
    this.skimmer.cannonCooldown = 0;
    this.skimmer.mesh.visible = false;
    this.skimmer.clear?.();
    for (const player of [this.player, this.player2]) {
      if (!player) continue;
      player.clearNukeHoloMesh?.();
      if (player.dispose) player.dispose();
      else this.renderer.scene.remove(player.mesh);
    }
    this.player = null;
    this.player2 = null;
    if (this.rewardSessionId && !this._suspendOperation) this.forge.honorLedger?.closeSession(this.rewardSessionId);
    this.rewardSessionId=null;this._suspendOperation=false;
    ['thermal-overlay', 'em-overlay', 'tech-overlay', 'uv-overlay', 'cloak-overlay',
      'first-person-mask-overlay', 'nuke-countdown-overlay', 'true-musou-banner',
      'acid-corrosion-overlay', 'berserker-rage-overlay', 'facehugger-qte-prompt',
      'hud-tri-target-lock', 'execution-prompt', 'hallucination-overlay', 'clan-honor-vault-modal', 'clan-armory-forge-modal', 'mothership-bridge-modal', 'sacred-blood-ritual-overlay', 'honor-duel-qte-overlay', 'command-map-modal'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    this.renderer.requestRender?.();
  }

  returnToMenu() {
    if (this.isPlaying) {
      if(this.battleSimulation&&!this._abandonOperation){this.battleBridge.sync();this.saveOperation();this.observeBattleCampaign();this._suspendOperation=!this.dropPod.isActive;}
      if(!this._suspendOperation)this.ui.recordEndSession(this._sessionDefeats ?? this.horde.deadCount, this.sessionSkulls, this.score, this.rewardSessionId??this.missionRun);
      this._abandonOperation=false;
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.clearMissionState();
    this.pendingChapter = null;
    this.campaign.reset?.();
    this.missionMode = 'hunt';
    this.isCoOp = false;
    this.renderer.setSplitScreen(false);
    this.citadel.hide();
    this.ui.showScreen(this.ui.mainMenu);
  }

  performCoopAttack(code) {
    const player = this.player2;
    if (!player || player.hp <= 0) return;
    if (code === 'NumpadDecimal') return this.firePlasmaCannon(false,player);
    const weapon=player.getWeaponState?.();if(weapon?.action==='projectile')return this.dispatchSelectedProjectile(weapon,code!=='Enter',player);
    const attack = code === 'Enter' ? player.lightAttack() : player.heavyAttack();
    if (!attack) return;
    this.scheduleAttackImpact(player, attack, () => {
      attack.origin = player.position;
      this.registerHits(this.horde.checkMeleeHits(attack));
      this.synthetics.checkHits(attack);
      if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(player.position) <= attack.radius + 2) {
        this.hitBossFromPlayer(attack.damage,player.position,code==='Enter'?'light':'heavy');
      }
    });
  }

  toggleTacticalModal(id) {
    const modal = document.getElementById(id);
    if (!modal) return true;
    if (this._tacticalModal?.id === id) { this.closeTacticalModal(id); return true; }
    if (this._tacticalModal) this.closeTacticalModal();
    this._tacticalModal = { id, wasPaused: this.isPaused };
    this.isPaused = true; this.keys = {}; this.weaponWheel.close();
    if (modal.classList.contains('ui-screen')) this.ui.showScreen(modal);
    else modal.classList.remove('hidden');
    modal.querySelector('button')?.focus();
    return false;
  }

  closeTacticalModal(id = this._tacticalModal?.id) {
    if (!this._tacticalModal || this._tacticalModal.id !== id) return false;
    const state = this._tacticalModal; this._tacticalModal = null;
    document.getElementById(id)?.classList.add('hidden');
    this.isPaused = state.wasPaused;
    this.ui.showScreen(this.isPaused ? document.getElementById('pause-menu') : this.ui.inGameHud);
    this.lastTime = performance.now(); this.renderer.requestRender();
    return true;
  }

  handlePlayerInteraction(player = this.player) {
    if(!this.isPlaying||this.isPaused||this.dropPod.isActive||this.photoMode.isActive||!player||player.hp<=0)return false;
    if (player.isFacehuggerLatched) {
      if (player.struggleQTE()) {
        this.ui.showAnnouncement('💥 FACEHUGGER ARRACHÉ AVEC SUCCÈS !');
      }
    } else if (this.allyRescue?.interact(player).accepted) {
      // A patient keeps its allocated identity throughout the rescue channel.
    } else if (this.env.checkTacticalBridgeInteraction?.(player)) {
      // Physical bridge console, including timed sabotage and repair.
    } else if (this.operationTransport?.interact(player)) {
      // Board or leave the physical operation transport.
    } else if (this.operationObjectives?.interact(player).accepted) {
      // An objective channel is authoritative and uses simulation time.
    } else if (this.battlefield?.interact(player)) {
      // Sector objective has priority over optional nearby props.
    } else if (this.env && this.env.checkPlasmaTerminalInteraction && this.env.checkPlasmaTerminalInteraction(player.position, player, this.audio, this.ui, this.particles)) {
      // Handled Weyland-Yutani Plasma Capacitor Recharge Terminal (v54.0)!
    } else if (this.env && this.env.checkHydraulicLiftInteraction && this.env.checkHydraulicLiftInteraction(player.position, player, this.ui, this.audio)) {
      // Handled USCM Hydraulic Cargo Lift platform activation (v52.0)!
    } else if (this.env && this.env.checkFoundryValveInteraction && this.env.checkFoundryValveInteraction(player, this.audio, this.ui)) {
      // Handled Fiorina 161 Molten Lead Foundry 12-Ton Pouring Vat (Alien 3 1992)!
    } else if (this.env && this.env.checkSmartgunInteraction(player.position, player, this.ui, this.audio)) {
      // Handled USCM M56 Smartgun Turret mounting / dismounting!
    } else if (this.env && this.env.checkCraneConsoleInteraction(player.position, player, this.ui, this.audio, this.particles, this.horde, this.bosses, this.synthetics)) {
      // Handled USCM Cargo Crane 10-Ton Container drop!
    } else if (this.env && this.env.checkAPCInteraction(player.position, player, this.ui, this.audio)) {
      // Handled USCM M577 APC mounting / dismounting!
    } else if (this.env && this.env.checkReactorConsoleInteraction(player.position, player, this.ui, this.audio)) {
      // Handled Colony Reactor meltdown / coolant core purge!
    } else if (this.env && this.env.checkElectricGridInteraction(player.position, player, this.ui, this.audio, this.particles, this.horde)) {
      // Handled High-Voltage Electric Floor Grid activation!
    } else if (this.env && this.env.checkDeconInteraction(player.position, player, this.ui, this.audio, this.particles)) {
      // Handled Med-Lab Decontamination Airlock purge & restoration!
    } else if (this.sentryGun?.reloadSentry(player.position, 250)?.success === true) {
      if (this.audio && this.audio.playSentrySpinUp) this.audio.playSentrySpinUp();
      this.ui.showAnnouncement('🔋 SENTINELLE UA 571-C : CHARGEUR RECHARGÉ (+250 RDS) !');
    } else if (this.env && this.env.checkAirlockConsoleInteraction(player.position, this.ui, this.audio, this.particles)) {
      // Handled Emergency Atmospheric Decompression Airlock!
    } else if (this.env && this.env.checkCocoonInteraction(player.position, player, this.horde, this.ui, this.audio, this.particles)) {
      // Handled Chrysalis Cocoon harvesting or Lurker ambush!
    } else if (this.env && this.env.checkMarineScavengeInteraction(player.position, player, this.sentryGun, this.ui, this.audio)) {
      // Handled USCM Marine salvage!
    } else if (this.env && this.env.checkCryoMedBayInteraction(player.position, player, this.ui, this.audio)) {
      // Handled Weyland-Yutani Autodoc Med-Bay stasis decontamination & embryo purge!
    } else if (this.env && this.env.checkSupplyInteraction(player.position, player, this.ui, this.audio)) {
      // Handled USCM supply cache opening!
    } else if (this.env && this.env.checkCryoVentInteraction && this.env.checkCryoVentInteraction(player.position, player, this.ui, this.audio, this.horde, this.bosses)) {
      // Handled Weyland-Yutani Atmospheric Cooling Tower Cryo-Vent Purge (Alien 3 / Fiorina 161)!
    } else if (this.env && this.env.checkAurigaBreakerInteraction && this.env.checkAurigaBreakerInteraction(player, this.audio, this.ui)) {
      // Handled USM Auriga Flooded Hydro-Cryo Basin 50,000V Breaker (Alien Resurrection 1997)!
    } else if (this.env && this.env.checkAncientShrineInteraction && this.env.checkAncientShrineInteraction(player, this.audio, this.ui)) {
      // Handled Ancient Yautja Shrine of the Ancients Divine Blessing!
    } else if (this.env && this.env.checkRailCannonInteraction && this.env.checkRailCannonInteraction(player, this.audio, this.ui, this.horde, this.bosses, this.particles)) {
      // Handled Weyland-Yutani Coastal Defense 155mm Rail-Cannon Artillery Turret!
    } else if (this.env && this.env.checkCryoPodInteraction && this.env.checkCryoPodInteraction(player, this.audio, this.ui, this.horde, this.bosses, this.particles)) {
      // Handled Weyland-Yutani Cryo-Stasis Laboratory Specimen Pod Shatter!
    } else if (this.env && this.env.checkEngineerSarcophagusInteraction && this.env.checkEngineerSarcophagusInteraction(player.position, this.bosses, this.ui, this.audio, this.particles)) {
      // Handled Space Jockey Dais Sacred Engineer Sarcophagus Awakening!
    } else if (this.env && this.env.checkPowerLoaderInteraction(player.position, player, this.horde, this.ui, this.audio, this.particles)) {
      // Handled Caterpillar Power Loader crushing clamp!
    } else if (this.env && this.env.checkCrucifiedPredatorInteraction && this.env.checkCrucifiedPredatorInteraction(player, this.ui, this.audio, this.particles)) {
      // Handled Classic Predator Crucifixion Liberation & 1987 Plasma Unlock (Predators 2010)!
    } else if (this.env && this.env.checkMudPitInteraction && this.env.checkMudPitInteraction(player, this.ui, this.audio, this.particles)) {
      // Handled Mud Camouflage Riverbank Viscous Squelch (Predator 1987)!
    } else if (this.env && this.env.checkValVerdeRadioInteraction && this.env.checkValVerdeRadioInteraction(player.position, this.ui, this.audio, this.horde)) {
      // Handled Downed Huey Military Radio Static & Ambush Broadcast (Predator 1987)!
    } else if (this.env && this.env.checkPyramidAltarInteraction && this.env.checkPyramidAltarInteraction(player, this.ui, this.audio, this.particles)) {
      // Handled Antarctic Pyramid Ancient Caster Altar Blessing (AVP 2004)!
    } else if (this.env && this.env.checkRomulusZeroGInteraction && this.env.checkRomulusZeroGInteraction(player, this.ui, this.audio, this.particles, this.horde)) {
      // Handled Romulus Renaissance Station Zero-G Chamber Decompression (Alien: Romulus 2024)!
    } else if (this.env && this.env.checkRookConsoleInteraction && this.env.checkRookConsoleInteraction(player, this.ui, this.audio)) {
      // Handled Science Officer Rook Synthetic Android Console (Alien: Romulus 2024)!
    } else if (this.env && this.env.checkRoyalJellyHarvestInteraction && this.env.checkRoyalJellyHarvestInteraction(player, this.ui, this.audio, this.particles)) {
      // Handled Xenomorph Prime Royal Jelly Resin Node Harvesting (Aliens: Earth War)!
    } else if (this.env && this.env.checkCryptReliquaryInteraction && this.env.checkCryptReliquaryInteraction(player, this.ui, this.audio)) {
      // Handled Gunnison Cemetery Crypt Reliquary Vault (AVP: Requiem 2007)!
    } else if (this.env && this.env.checkNeuralInhibitorInteraction && this.env.checkNeuralInhibitorInteraction(player, this.horde, this.ui, this.audio)) {
      // Handled Charon Base Ultrasonic Neural Inhibitor Pylon (Aliens: Rogue 1993)!
    } else if (this.env && this.env.checkBoulderDeadfallInteraction && this.env.checkBoulderDeadfallInteraction(player, this.audio, this.horde, this.bosses, this.particles, this.ui)) {
      // Handled Game Preserve Suspended Boulder Deadfall Trap (Predators 2010)!
    } else if (this.env && this.env.checkDutchLogTrapTrigger && this.env.checkDutchLogTrapTrigger(player.position, false, this.audio, this.horde, this.bosses, this.particles, this.ui)) {
      // Handled Val Verde Major Dutch Schaefer Counterweight Log Trap (Predator 1987)!
    } else if (this.env && this.env.checkBillyMacheteInteraction && this.env.checkBillyMacheteInteraction(player, this.ui, this.audio)) {
      // Handled Billy Sole's Courage Machete Draw on Fallen Log (Predator 1987)!
    } else if (this.env && this.env.checkHopperSatchelInteraction && this.env.checkHopperSatchelInteraction(player, this.ui, this.audio)) {
      // Handled Captain Jim Hopper's Skinned Berets Satchel (Predator 1987)!
    } else if (this.env && this.env.checkOldPainlessInteraction && this.env.checkOldPainlessInteraction(player, this.ui, this.audio, this.horde, this.particles)) {
      // Handled Blain Cooper's M134 Minigun "Old Painless" Deforestation Roar (Predator 1987)!
    } else if (this.env && this.env.checkDutchChallengeRoar && this.env.checkDutchChallengeRoar(player, this.ui, this.audio, this.horde)) {
      // Handled Dutch's Challenge Roar ("KILL ME! I'M HERE!") (Predator 1987)!
    } else if (this.env && this.env.checkExplosiveArrowsInteraction && this.env.checkExplosiveArrowsInteraction(player, this.ui, this.audio)) {
      // Handled Dutch's Primitive Workbench Explosive Arrows Crafting (Predator 1987)!
    } else if (this.env && this.env.checkRebelMapsInteraction && this.env.checkRebelMapsInteraction(player, this.ui, this.audio)) {
      // Handled Anna's Guerrilla Tactical Reconnaissance Maps (Predator 1987)!
    } else if (this.env && this.env.checkRoastingSpitInteraction && this.env.checkRoastingSpitInteraction(player, this.ui, this.audio)) {
      // Handled Wild Javelina Roasting Spit Survival Ration (Predator 1987)!
    } else if (this.env && this.env.checkGlowingBloodInteraction && this.env.checkGlowingBloodInteraction(player, this.ui, this.audio)) {
      // Handled Jungle Hunter Nuclear Blast Crater Glowing Blood Locus (Predator 1987)!
    } else if (this.env && this.env.checkEasternColumbiaLightning && this.env.checkEasternColumbiaLightning(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Eastern Columbia Spire Lightning Rod Supercharge (Predator 2 1990)!
    } else if (this.env && this.env.checkMeatLockerCryoValve && this.env.checkMeatLockerCryoValve(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled OWLF Slaughterhouse Cryogenic Deluge (Predator 2 1990)!
    } else if (this.env && this.env.checkKingWillieAltarInteraction && this.env.checkKingWillieAltarInteraction(player, this.ui, this.audio)) {
      // Handled King Willie's Voodoo Rooftop Altar & Polished Skull (Predator 2 1990)!
    } else if (this.env && this.env.checkDannyBoyNetgunInteraction && this.env.checkDannyBoyNetgunInteraction(player, this.ui, this.audio)) {
      // Handled Danny Boy's Netgun Wire Concrete Wall Embedment (Predator 2 1990)!
    } else if (this.env && this.env.checkLostTribeTrophyInteraction && this.env.checkLostTribeTrophyInteraction(player, this.ui, this.audio)) {
      // Handled Lost Tribe Mother Ship Trophy Dais & Raphael Adolini 1715 Flintlock (Predator 2 1990)!
    } else if (this.env && this.env.checkCityHunterSurgeryInteraction && this.env.checkCityHunterSurgeryInteraction(player, this.ui, this.audio)) {
      // Handled City Hunter's Penthouse Emergency Medi-Kit Cauterization (Predator 2 1990)!
    } else if (this.env && this.env.checkHarriganCruiserLoot && this.env.checkHarriganCruiserLoot(player, this.ui, this.audio)) {
      // Handled Lieutenant Mike Harrigan's LAPD SWAT Cruiser Barricade (Predator 2 1990)!
    } else if (this.env && this.env.checkSmartDiscGirderInteraction && this.env.checkSmartDiscGirderInteraction(player, this.ui, this.audio)) {
      // Handled City Hunter's Dislodged Smart-Disc Girder Retrieval (Predator 2 1990)!
    } else if (this.env && this.env.checkSubwayTrainMassacreInteraction && this.env.checkSubwayTrainMassacreInteraction(player, this.ui, this.audio)) {
      // Handled Subway Metro Car #666 Strobe Light Massacre (Predator 2 1990)!
    } else if (this.env && this.env.checkOWLFVanConsoleInteraction && this.env.checkOWLFVanConsoleInteraction(player, this.ui, this.audio)) {
      // Handled Peter Keyes's OWLF Mobile Surveillance Trailer (Predator 2 1990)!
    } else if (this.env && this.env.checkCartelPenthouseLoot && this.env.checkCartelPenthouseLoot(player, this.ui, this.audio)) {
      // Handled El Scorpio's Colombian Cartel Penthouse Drug Lab (Predator 2 1990)!
    } else if (this.env && this.env.checkPoleVaultLaunchPad && this.env.checkPoleVaultLaunchPad(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Combi-Stick Pole-Vault Catapult Launch to Eastern Columbia (Predator 2 1990)!
    } else if (this.env && this.env.checkNolandHideoutInteraction && this.env.checkNolandHideoutInteraction(player, this.ui, this.audio)) {
      // Handled Ronald Noland's Drilling Rig Subterranean Hideout (Predators 2010)!
    } else if (this.env && this.env.checkTrackerWhistleInteraction && this.env.checkTrackerWhistleInteraction(player, this.ui, this.audio, this.horde, this.hellHounds)) {
      // Handled Tracker Predator's Whistle Totem & Hell-Hound Summon (Predators 2010)!
    } else if (this.env && this.env.checkNikolaiClaymoreInteraction && this.env.checkNikolaiClaymoreInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Nikolai's Dual Claymore Suicide Blast Memorial (Predators 2010)!
    } else if (this.env && this.env.checkHanzoArenaInteraction && this.env.checkHanzoArenaInteraction(player, this.ui, this.audio)) {
      // Handled Hanzo's Yakuza Katana Tall-Grass Duel Arena (Predators 2010)!
    } else if (this.env && this.env.checkAlienFloraHarvest && this.env.checkAlienFloraHarvest(player, this.ui, this.audio)) {
      // Handled Dr. Edwin's Neurotoxin Alien Flora Extraction (Predators 2010)!
    } else if (this.env && this.env.checkRoyceCliffLeapInteraction && this.env.checkRoyceCliffLeapInteraction(player, this.ui, this.audio, this.particles)) {
      // Handled Royce's Free-fall Cliff Leap into Plunge Basin (Predators 2010)!
    } else if (this.env && this.env.checkSuperPredatorShipInteraction && this.env.checkSuperPredatorShipInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Mr. Black Super Predator Scout Ship Propulsion Overload (Predators 2010)!
    } else if (this.env && this.env.checkFalconerRoostInteraction && this.env.checkFalconerRoostInteraction(player, this.ui, this.audio, this.falconDrone)) {
      // Handled Falconer Predator Recon Drone Launch & Hunt Telemetry (Predators 2010)!
    } else if (this.env && this.env.checkCuchilloDecoyInteraction && this.env.checkCuchilloDecoyInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Cuchillo's Booby-Trapped Acoustic Decoy Disarm (Predators 2010)!
    } else if (this.env && this.env.checkBoneGongInteraction && this.env.checkBoneGongInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Royce's Bone Gong Strike & Thermal Flare Braziers (Predators 2010)!
    } else if (this.env && this.env.checkIsabelleSniperStash && this.env.checkIsabelleSniperStash(player, this.ui, this.audio)) {
      // Handled Isabelle's Blaser R93 Precision Sniper Ammo Stash (Predators 2010)!
    } else if (this.env && this.env.checkDillonStandInteraction && this.env.checkDillonStandInteraction(player, this.ui, this.audio)) {
      // Handled Al Dillon's Dual MP5 Last Stand (Predator 1987)!
    } else if (this.env && this.env.checkPonchoStashInteraction && this.env.checkPonchoStashInteraction(player, this.ui, this.audio)) {
      // Handled Poncho Ramirez's 40mm Grenade Cache (Predator 1987)!
    } else if (this.env && this.env.checkHawkinsRelayInteraction && this.env.checkHawkinsRelayInteraction(player, this.ui, this.audio)) {
      // Handled Rick Hawkins' Spec-Ops Radio Relay Beacon (Predator 1987)!
    } else if (this.env && this.env.checkValVerdeMudPlunge && this.env.checkValVerdeMudPlunge(player, this.ui, this.audio)) {
      // Handled Val Verde Waterfall Mud Plunge (Predator 1987)!
    } else if (this.env && this.env.checkStargazerVivisectionInteraction && this.env.checkStargazerVivisectionInteraction(player, this.ui, this.audio)) {
      // Handled Fugitive Predator Vivisection Table (The Predator 2018)!
    } else if (this.env && this.env.checkPredatorKillerPodInteraction && this.env.checkPredatorKillerPodInteraction(player, this.ui, this.audio)) {
      // Handled Predator Killer Nanotech Pod Deployment (The Predator 2018)!
    } else if (this.env && this.env.checkQuinnSniperPerchInteraction && this.env.checkQuinnSniperPerchInteraction(player, this.ui, this.audio)) {
      // Handled Quinn McKenna's TAC-50 Rooftop Perch (The Predator 2018)!
    } else if (this.env && this.env.checkTraegerWeaponsLockerInteraction && this.env.checkTraegerWeaponsLockerInteraction(player, this.ui, this.audio)) {
      // Handled Sean Traeger's Reversed Plasma Cannon Weapons Locker (The Predator 2018)!
    } else if (this.env && this.env.checkLooniesBusInteraction && this.env.checkLooniesBusInteraction(player, this.ui, this.audio)) {
      // Handled Loonies Military Transport Bus & Casey Bracket Medkit (The Predator 2018)!
    } else if (this.env && this.env.checkStargazerShieldGenerator && this.env.checkStargazerShieldGenerator(player, this.ui, this.audio, this.horde)) {
      // Handled Crashed Fugitive Ark Starship Forcefield Shield Overload (The Predator 2018)!
    } else if (this.env && this.env.checkFugitiveLockerInteraction && this.env.checkFugitiveLockerInteraction(player, this.ui, this.audio)) {
      // Handled Fugitive Predator's Gauntlet & Mask Storage Drop (The Predator 2018)!
    } else if (this.env && this.env.checkFriendlyLoboInteraction && this.env.checkFriendlyLoboInteraction(player, this.ui, this.audio)) {
      // Handled "Lobo" Friendly Head-Scarred Predator Hound (The Predator 2018)!
    } else if (this.env && this.env.checkBaxleyCoyleBunkerInteraction && this.env.checkBaxleyCoyleBunkerInteraction(player, this.ui, this.audio)) {
      // Handled Baxley & Coyle's Tourette's / Sniper Defilade Bunker (The Predator 2018)!
    } else if (this.env && this.env.checkNebraskaHarpoonRig && this.env.checkNebraskaHarpoonRig(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Nebraska Williams' Steel Harpoon Tow Cable Rig (The Predator 2018)!
    } else if (this.env && this.env.checkRoryTranslatorInteraction && this.env.checkRoryTranslatorInteraction(player, this.ui, this.audio, this.bosses)) {
      // Handled Rory McKenna's Decoded Star Map & Predator Mask (The Predator 2018)!
    } else if (this.env && this.env.checkTurbineCoreOverload && this.env.checkTurbineCoreOverload(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Crashed Ark Ship Main Plasma Turbine Core Overload (The Predator 2018)!
    } else if (this.env && this.env.checkStargazerDecontamination && this.env.checkStargazerDecontamination(player, this.ui, this.audio)) {
      // Handled Dr. Casey Bracket's Biogenetic Decontamination Airlock (The Predator 2018)!
    } else if (this.env && this.env.checkBoneMaskDecoyInteraction && this.env.checkBoneMaskDecoyInteraction(player, this.ui, this.audio, this.bosses, this.particles)) {
      // Handled Feral Bone Mask & 3-Laser Homing Decoy Rig (Prey 2022)!
    } else if (this.env && this.env.checkOrangeFlowerInteraction && this.env.checkOrangeFlowerInteraction(player, this.ui, this.audio)) {
      // Handled Naru's Orange Flower (Sariska) Meadow (Prey 2022)!
    } else if (this.env && this.env.checkAdoliniPistolInteraction && this.env.checkAdoliniPistolInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled Raphael Adolini 1715 Flintlock Pistol (Prey 2022)!
    } else if (this.env && this.env.checkTaabeWarBowInteraction && this.env.checkTaabeWarBowInteraction(player, this.ui, this.audio)) {
      // Handled Taabe's Comanche War Horse & Rock Overlook (Prey 2022)!
    } else if (this.env && this.env.checkGrizzlyBearTrophyInteraction && this.env.checkGrizzlyBearTrophyInteraction(player, this.ui, this.audio)) {
      // Handled Giant Slain Grizzly Bear Carcass Trophy (Prey 2022)!
    } else if (this.env && this.env.checkNaruTomahawkInteraction && this.env.checkNaruTomahawkInteraction(player, this.ui, this.audio)) {
      // Handled Naru's Tethered Tomahawk in Pine Trunk (Prey 2022)!
    } else if (this.env && this.env.checkTrapperMedicalTentInteraction && this.env.checkTrapperMedicalTentInteraction(player, this.ui, this.audio)) {
      // Handled Trapper Field Medical Tent (Prey 2022)!
    } else if (this.env && this.env.checkFeralArsenalInteraction && this.env.checkFeralArsenalInteraction(player, this.ui, this.audio)) {
      // Handled Archaic Feral Weapon Rack (Prey 2022)!
    } else if (this.env && this.env.checkSariiCompanionInteraction && this.env.checkSariiCompanionInteraction(player, this.ui, this.audio)) {
      // Handled Sarii the Carolina Dog Companion (Prey 2022)!
    } else if (this.env && this.env.checkTrapperBaitTreeInteraction && this.env.checkTrapperBaitTreeInteraction(player, this.ui, this.audio, this.horde, this.bosses, this.particles)) {
      // Handled French Trappers' Bait Tree & Powder Kegs (Prey 2022)!
    } else if (this.env && this.env.checkVoyageurRaftInteraction && this.env.checkVoyageurRaftInteraction(player, this.ui, this.audio)) {
      // Handled French Voyageurs' River Raft (Prey 2022)!
    } else if (this.env && this.env.checkComancheTotemInteraction && this.env.checkComancheTotemInteraction(player, this.ui, this.audio)) {
      // Handled Comanche Sun Dance War Paint Totem Post (Prey 2022)!
    } else if (this.env && this.env.checkLightningPineInteraction && this.env.checkLightningPineInteraction(player, this.ui, this.audio)) {
      // Handled Lightning-Struck Split Hollow Pine Pouch (Prey 2022)!
    } else if (this.env && this.env.checkTrapperCampfireInteraction && this.env.checkTrapperCampfireInteraction(player, this.ui, this.audio, this.horde, this.particles)) {
      // Handled French Trappers' Campfire Cauldron (Prey 2022)!
    } else if (this.env && this.env.checkBuffaloCairnInteraction && this.env.checkBuffaloCairnInteraction(player, this.ui, this.audio)) {
      // Handled Comanche Buffalo Skull Cairn (Prey 2022)!
    } else if (this.env && this.env.checkFeralSeveredGauntletInteraction && this.env.checkFeralSeveredGauntletInteraction(player, this.ui, this.audio)) {
      // Handled Feral Predator's Severed Arm-Gauntlet (Prey 2022)!
    } else if (this.env && this.env.checkStasisTrioAwakeningInteraction && this.env.checkStasisTrioAwakeningInteraction(player, this.ui, this.audio, this.bosses, this.horde, this.particles)) {
      // Handled Trio Cryo-Stasis Pods (Killer of Killers 2025)!
    } else if (this.env && this.env.checkUrsaShieldInteraction && this.env.checkUrsaShieldInteraction(player, this.ui, this.audio)) {
      // Handled Ursa's Viking Shield (The Shield 850)!
    } else if (this.env && this.env.checkUrsaDaneAxeInteraction && this.env.checkUrsaDaneAxeInteraction(player, this.ui, this.audio)) {
      // Handled Ursa's Dane Axe & Runestone (The Shield 850)!
    } else if (this.env && this.env.checkKenjiKatanaInteraction && this.env.checkKenjiKatanaInteraction(player, this.ui, this.audio)) {
      // Handled Kenji's Masamune Katana (The Sabre 1620)!
    } else if (this.env && this.env.checkKenjiBambooDecoyInteraction && this.env.checkKenjiBambooDecoyInteraction(player, this.ui, this.audio, this.horde)) {
      // Handled Kenji's Bamboo Decoy (The Sabre 1620)!
    } else if (this.env && this.env.checkTorresWarhawkInteraction && this.env.checkTorresWarhawkInteraction(player, this.ui, this.audio)) {
      // Handled Torres' Crashed P-40 Warhawk (The Bullet 1943)!
    } else if (this.env && this.env.checkTorresBrowningInteraction && this.env.checkTorresBrowningInteraction(player, this.ui, this.audio, this.horde, this.particles)) {
      // Handled Torres' Browning .50 Cal M2 Machine Gun (The Bullet 1943)!
    } else if (this.env && this.env.checkScoutShipConsoleInteraction && this.env.checkScoutShipConsoleInteraction(player.position, this.ui, this.audio, this.horde, player)) {
      // Handled Crashed Scout Ship Telemetry Scan (AVP: Requiem 2007)!
    } else if (this.env && this.env.checkCharonLabConsoleInteraction && this.env.checkCharonLabConsoleInteraction(player.position, this.horde, this.ui, this.audio)) {
      // Handled Base Charon Mutagen Pheromone Dispersion (Aliens: Rogue 1993)!
    } else if (this.env && this.env.checkFixedSentryInteraction && this.env.checkFixedSentryInteraction(player.position, this.audio, this.ui)) {
      // Handled Fixed UA 571-C Sentry 250-Round Drum Reload (Aliens 1986)!
    } else if (this.checkCatwalkPlungingExecution(player)) {
      // Handled Catwalk Plunging Execution Drop (v53.0)!
    } else {
      this.checkTrophyExecution(player);
    }
    return true;
  }

  setupDeclarativeControls() {
    const playerActions = {
      performCombistickPoleVault: () => this.player.performCombistickPoleVault(this.horde, this.bosses, this.audio, this.particles, this.ui),
      performWristbladeParry: () => this.player.performWristbladeParry(this.audio, this.particles, this.ui),
      triggerVoiceMimicryDecoy: () => this.player.triggerVoiceMimicryDecoy(this.horde, this.audio, this.ui, this.particles),
      performPredatorChestThumpRoar: () => this.player.performPredatorChestThumpRoar(this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui),
      performCombistickCycloneWhirl: () => this.player.performCombistickCycloneWhirl(this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui),
      performSmartDiscMultiLock: () => this.player.performSmartDiscMultiLock(this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui),
      fireBurnerHeavyPlasma: () => this.player.fireBurnerHeavyPlasma(this.horde, this.bosses, this.synthetics, this.particles, this.audio, this.ui),
      toggleSniperPlasmaMode: () => this.player.toggleSniperPlasmaMode(this.renderer.camera, this.audio, this.ui)
    };
    const gameActions = new Set(['inputNukeKeypad', 'abortNukeCountdown', 'toggleClanHonorVaultModal', 'toggleClanForgeModal',
      'toggleMothershipBridgeModal', 'toggleWeaponWheel', 'selectWeaponSlice', 'callPlanetaryOrbitalBarrage', 'callOrbitalDropPodResupply', 'callEldersEmergencyBlessing']);
    const selector = '[data-game-action], [data-player-action], [data-modal-id]';
    document.addEventListener('click', event => {
      const control = event.target.closest?.(selector);
      if (!control) return;
      if (control.dataset.modalId) {
        const modal = document.getElementById(control.dataset.modalId);
        if (control.dataset.modalAction === 'toggle') this.toggleTacticalModal(control.dataset.modalId);
        else if (!this.closeTacticalModal(control.dataset.modalId)) modal?.classList.add('hidden');
        return;
      }
      if (!this.isPlaying || !this.player || this.player.hp <= 0 || this.dropPod.isActive || this.photoMode.isActive) return;
      if (control.dataset.playerAction) {
        if (!this.isPaused) playerActions[control.dataset.playerAction]?.();
      } else if (gameActions.has(control.dataset.gameAction)) {
        let args = [];
        try { args = JSON.parse(control.dataset.gameArgs ?? '[]'); } catch { return; }
        if (Array.isArray(args)) this[control.dataset.gameAction](...args);
      }
    });
    document.addEventListener('keydown', event => {
      const control = event.target.closest?.('div[role="button"]');
      if (control?.matches(selector) && ['Enter', ' '].includes(event.key)) {
        event.preventDefault(); event.stopPropagation(); control.click();
      }
    });
  }

  updateVisionOverlays(mode) {
    const thermal = document.getElementById('thermal-overlay');
    const em = document.getElementById('em-overlay');
    const tech = document.getElementById('tech-overlay');
    const uv = document.getElementById('uv-overlay');
    const sonar = document.getElementById('sonar-overlay');
    const tag = document.getElementById('hud-vision-tag');

    [thermal, em, tech, uv, sonar].forEach(el => { if (el) el.classList.add('hidden'); });

    if (mode === 1) {
      if (thermal) thermal.classList.remove('hidden');
      tag.innerText = 'VISION : THERMIQUE IR';
      tag.style.color = '#ff4d4d';
      this.audio.startThermalHum();
    } else if (mode === 2) {
      if (em) em.classList.remove('hidden');
      tag.innerText = 'VISION : ÉLECTROMAGNÉTIQUE XENO';
      tag.style.color = '#00d2ff';
      this.audio.stopThermalHum();
    } else if (mode === 3) {
      if (tech) tech.classList.remove('hidden');
      tag.innerText = 'VISION : TECH WIREFRAME SCAN';
      tag.style.color = '#39ff14';
      this.audio.stopThermalHum();
    } else if (mode === 4) {
      if (sonar) sonar.classList.remove('hidden');
      tag.innerText = 'VISION : RÉSONANCE ACOUSTIQUE SONAR';
      tag.style.color = '#38bdf8';
      this.audio.stopThermalHum();
    } else {
      if (uv) uv.classList.remove('hidden');
      tag.innerText = 'VISION : NATURELLE ULTRAVIOLETTE';
      tag.style.color = '#ffaa00';
      this.audio.stopThermalHum();
    }
  }

  triggerNukeCountdownSequence() {
    this.nukeCountingDown = true;
    const nukeModal = document.getElementById('nuke-countdown-overlay');
    const timerText = document.getElementById('nuke-timer-seconds');
    if (nukeModal) nukeModal.classList.remove('hidden');

    this.player.triggerNukeSelfDestruct();

    this.nukeTimeLeft = 6;
    if (timerText) timerText.innerText = this.nukeTimeLeft;

    const countdown = ++this._nukeSequence;
    for (let second = 1; second <= 6; second++) this.scheduleMissionTask(() => {
      if (!this.nukeCountingDown || countdown !== this._nukeSequence || !this.player) return;
      this.nukeTimeLeft = 6 - second;
      if (timerText) timerText.innerText = this.nukeTimeLeft;

      // Authentic 1987 Billy's mimicry sardonic laugh right before detonation
      if (this.nukeTimeLeft === 2) {
        if (this.audio && this.audio.playPredatorManicLaugh) {
          this.audio.playPredatorManicLaugh();
        } else if (this.audio && this.audio.playBillyLaugh) {
          this.audio.playBillyLaugh();
        }
      }

      if (this.nukeTimeLeft <= 0) {
        nukeModal?.classList.add('hidden');
        this.nukeCountingDown = false;
        if (this.player && this.player.clearNukeHoloMesh) {
          this.player.clearNukeHoloMesh();
        }

        const hits = this.horde.checkMeleeHits({ origin: this.player.position, radius: 90, damage: 10000 });
        this.registerHits(hits);
        if (this.bosses.activeBoss) this.bosses.takeDamage(10000);
        if (this.badBlood.isActive) this.badBlood.takeDamage(10000);
        this.triggerCameraShake(3.0, 2.5);
        this.ui.showAnnouncement('☢️ ANNIHILATION THERMONUCLÉAIRE PURIFICATRICE 1987 ACCOMPLIE !');
      }
    }, second);
  }

  inputNukeKeypad(glyph) {
    if (this.audio && this.audio.playWristNukeKeypadBeep) {
      this.audio.playWristNukeKeypadBeep();
    }
    const glyphTrack = document.getElementById('nuke-input-glyphs');
    if (glyphTrack) {
      glyphTrack.innerText = `${glyphTrack.innerText.slice(2)} ${glyph}`;
    }

  }

  abortNukeCountdown() {
    if (!this.nukeCountingDown) return;
    if (this.nukeInterval) {
      clearInterval(this.nukeInterval);
      this.nukeInterval = null;
    }
    this.nukeCountingDown = false;
    this._nukeSequence++;
    document.getElementById('nuke-countdown-overlay')?.classList.add('hidden');
    if (this.player && this.player.clearNukeHoloMesh) {
      this.player.clearNukeHoloMesh();
    }
    if (this.audio && this.audio.playShieldBlock) {
      this.audio.playShieldBlock();
    }
    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('🛑 AUTO-DESTRUCTION RITUELLE AVORTÉE ! SYSTÈMES ARMÉS RESTAURÉS.');
    }
  }

  /* === CHANTIER 8 (v53.0): High Catwalk Plunging Execution Drop === */
  checkCatwalkPlungingExecution(player = this.player) {
    if (!player || player.position.y < 3.5) return false;
    let target = null;
    let minDist = 7.0;

    if (this.bosses && this.bosses.activeBoss) {
      const bPos = this.bosses.activeBoss.mesh.position;
      const dHoriz = new THREE.Vector2(player.position.x - bPos.x, player.position.z - bPos.z).length();
      if (dHoriz <= 6.5 && bPos.y <= 1.5) {
        target = this.bosses.activeBoss;
        minDist = dHoriz;
      }
    }

    if (!target && this.horde && this.horde.aliens) {
      this.horde.aliens.forEach(a => {
        if (!a || a.hp <= 0) return;
        const aPos = a.mesh.position;
        const dHoriz = new THREE.Vector2(player.position.x - aPos.x, player.position.z - aPos.z).length();
        if (dHoriz < minDist && aPos.y <= 1.5) {
          minDist = dHoriz;
          target = a;
        }
      });
    }

    if (!target) return false;

    const targetPos = target.mesh ? target.mesh.position.clone() : target.position.clone();
    player.position.copy(targetPos);
    player.position.y = 0;
    if (player.mesh) player.mesh.position.copy(player.position);

    if (this.audio && this.audio.playCombiStickImpale) {
      this.audio.playCombiStickImpale();
    }
    if (this.audio && this.audio.playGroundSlamImpact) {
      this.audio.playGroundSlamImpact();
    }
    if (this.particles && this.particles.emitSparks) {
      this.particles.emitSparks(targetPos, 35);
    }
    this.triggerCameraShake(1.5, 0.45);

    if (target.takeDamage) {
      target.takeDamage(850);
    } else {
      target.hp -= 850;
    }

    if (this.horde) {
      this.horde.checkMeleeHits({ origin: targetPos, radius: 4.5, damage: 300, type: 'heavy' });
    }

    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('⚡ PLONGEON D\'EMBUSCADE VERTICALE : ASSASSINAT DEPUIS LES PASSERELLES (850 DMG) !');
    }
    return true;
  }

  startMission(options = {}) {
    const selectedLevel=this.ui.selectedLevel??LEVELS_DATA[0];
    const sceneOptions=operationSceneOptions(options.resumeOperation,{mapSeed:this.operationMapSeed,difficultyId:this.operationDifficulty});
    this.operationMapSeed=this.missionMode==='fronts'?sceneOptions.mapSeed:0;
    this.operationDifficulty=this.missionMode==='fronts'?sceneOptions.difficultyId:'standard';
    let preparedOperation=null;
    try{
      preparedOperation=this.missionMode==='fronts'?createOperationScene({operationId:this.operationId,level:selectedLevel,players:this.isCoOp?2:1,mapSeed:this.operationMapSeed,difficultyId:this.operationDifficulty}):null;
      this.preparedBossEncounter=preparedOperation?null:prepareBossEncounter({level:selectedLevel,bossType:options.bossType??selectedLevel.bossType,mode:this.missionMode==='sandbox'?'sandbox':'level'});
    }catch{
      this.ui.showAnnouncement('Cet affrontement ne peut pas être préparé : vérifiez le terrain et le boss sélectionnés.');
      return false;
    }
    this.isPlaying = false;
    this.clearMissionState();
    this.missionRun = `mission-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.floor(Math.random() * 1e9)}`}`;
    this.rewardSessionId=this.missionRun;
    this.combatEvents.reset(this.missionRun);
    this._processedHitRecords = new WeakSet(); this._registeredDeathHits.clear(); this._rewardedDeaths.clear();
    this.sacredBloodRitualTriggered = false;
    this.isPlaying = true;
    this.isPaused = false;
    this.waveIndex = 1;
    this.score = 0;
    this.sessionSkulls = options.resumeOperation?.sessionSkulls ?? 0;
    this.score = options.resumeOperation?.score ?? 0;
    this._sessionDefeats = options.resumeOperation?.sessionDefeats ?? 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.bossSpawned = false;
    this.horde.deadCount = 0;
    this.announcedMilestones = {};
    this.ui.selectedLevel ??= LEVELS_DATA[0];
    this.isEndlessMode = this.missionMode === 'survival';
    this.totalWaves = this.missionMode === 'sandbox' ? 1 : this.ui.selectedLevel.waves;
    const fidelityMode = document.getElementById('fidelity-mode-select')?.value ?? 'adapted';
    this.activeLoadout = { ...(this.activeLoadout ?? {primary:'wristblades',secondary:'smart_disc',gadgets:['medicomp','bear_trap']}), fidelityMode };

    this.citadel.hide();
    const variant = this.missionMode === 'fronts' && BATTLE_OPERATIONS.some(operation=>operation.id===this.operationId) ? getBattlefieldMapVariant(BATTLE_OPERATIONS.find(operation=>operation.id===this.operationId).mapId) : null;
    if (variant) this.ui.selectedLevel = LEVELS_DATA.find(level=>level.id===variant.baseLevelId);
    if(preparedOperation)this.ui.selectedLevel=preparedOperation.level;
    this.env.buildLevelEnvironment({ ...this.ui.selectedLevel, mapId: variant?.id, mapSeed:this.operationMapSeed, battlefield: !['sandbox','survival'].includes(this.missionMode), strategicMode: this.missionMode === 'fronts' });
    this.initializeMissionSupports(options.resumeOperation);
    this.renderer.updateLevelEnvironment(this.ui.selectedLevel);
    this.weather.setWeather(this.ui.selectedLevel.weather ?? this.ui.selectedLevel.theme);
    this.weather.spawnSteamVents?.(5);
    this.gore.clear();
    this.bosses.clear();
    this.badBlood.clear();
    if (this.skimmer) {
      this.skimmer.isMounted = false;
      this.skimmer.mountCooldown = 0.5;
    }

    if (this.player) this.renderer.scene.remove(this.player.mesh);
    if (this.player2) this.renderer.scene.remove(this.player2.mesh);

    this.player = new Player(this.renderer.scene, this.ui.selectedChar, this.audio, false, this.particles);
    this.player.setLaserColor?.(Number.parseInt(this.forge.upgrades.laserColor.slice(1), 16));

    // Chantier 9: Apply Tactical Armory Loadout Synergy
    if (!this.activeLoadout) {
      this.activeLoadout = {
        primary: 'wristblades',
        secondary: 'smart_disc',
        gadgets: ['medicomp', 'bear_trap']
      };
    }
    this.player.applyLoadout?.(this.activeLoadout);
    this.forge.applyStatsToPlayer(this.player);
    this.player.position.y=this.env.getPlacementElevationAt?.(this.player.position.x,this.player.position.z)??this.env.getElevationAt?.(this.player.position.x,this.player.position.z)??0;
    this.env.resolveMovement(this.player.position,this.player.radius??.6,this.player.getCollisionHeight?.()??2.4);
    this.player.mesh.position.copy(this.player.position);
    const primName = (this.activeLoadout.primary || 'WRISTBLADES').toUpperCase();
    const secName = (this.activeLoadout.secondary || 'SMART_DISC').toUpperCase();
    this.ui.showAnnouncement(`🎒 LOADOUT ARMURERIE ACTIVÉ : [${primName}] + [${secName}]`);

    if (this.isCoOp) {
      this.player2 = new Player(this.renderer.scene, CHARACTERS_DATA.find(character => character.id !== this.ui.selectedChar.id), this.audio, true, this.particles);
      this.player2.applyLoadout?.(this.activeLoadout ?? {});
      this.forge.applyStatsToPlayer(this.player2);
      this.player2.position.y=this.env.getPlacementElevationAt?.(this.player2.position.x,this.player2.position.z)??this.player.position.y;
      this.env.resolveMovement(this.player2.position,this.player2.radius??.6,this.player2.getCollisionHeight?.()??2.4);
      this.player2.mesh.position.copy(this.player2.position);
    } else {
      this.player2 = null;
    }

    for(const player of [this.player,this.player2].filter(Boolean))player.missionSupportContext=this.missionSupportContext;
    if(options.resumeOperation?.playerStates)for(const[index,player]of[this.player,this.player2].entries())if(player&&options.resumeOperation.playerStates[index])restoreOperationPlayer(player,options.resumeOperation.playerStates[index],this.env);
    if(options.resumeOperation?.preyInteractions&&this.env.restorePreyInteractions?.(options.resumeOperation.preyInteractions)!==true)throw new Error('Incompatible PREY interaction checkpoint');

    // Both players arrive inside their own closed capsule. Combat starts after
    // the complete opening and exit sequence, so insertion never spends grace.
    this.dropPod.triggerDrop(this.player.position, () => {
      this.keys = {};
      for (const player of [this.player, this.player2].filter(Boolean)) player.locomotion?.reset();
      this.combatDirector.reset({ graceSeconds: 7 });
      this.updateInsertionStatus();
      this.ui.showAnnouncement('INSERTION TERMINÉE — PRÉPAREZ VOTRE PREMIÈRE ATTAQUE. [CLIC] FRAPPER · [C] PARER');
    }, { players: [this.player, this.player2].filter(Boolean) });

    this.skimmer.spawnAt(this.player.position.clone().add(new THREE.Vector3(-9, 0, 8)));
    if (this.missionMode === 'fronts' && this.env.battlefieldLayout) {
      this.startBattleOperation(options.resumeOperation);
    } else if (!['sandbox', 'survival'].includes(this.missionMode) && this.env.battlefieldLayout) {
      this.battlefield = new BattlefieldMission({ environment: this.env, horde: this.horde,
        bosses: this.bosses, level: this.ui.selectedLevel,preparedEncounter:this.preparedBossEncounter,
        onAnnouncement: message => this.ui.showAnnouncement(message),
        onSectorEntered: sector => this.enterBattlefieldSector(sector) });
      this.battlefieldProgression = this.battlefield.progression;
      this.totalWaves = this.env.battlefieldLayout.sectors.length;
      this.battlefield.update([this.player, this.player2].filter(Boolean));
    } else {
      const supportPosition = this.player.position.clone().add(new THREE.Vector3(0, 0, 12));
      this.allies.spawnSquad(supportPosition, 3);
      this.marines.spawnSquad(supportPosition, 4);
      this.synthetics.spawnSquad(supportPosition, 3);
      this.weather.spawnGasPipes(6);
      this.horde.spawnWave(options.enemyCount ?? 35, this.player.position);
    }
    this.restoreMissionSupports(options.resumeOperation?.supports);
    this.renderer.camera.position.copy(this.player.position).add(new THREE.Vector3(0, 10, 16));
    this.renderer.cameraP2.position.copy(this.renderer.camera.position);
    this.updateInsertionPresentation(0, true);

    // Initialize Battlefield Morale to 50%
    this.battlefieldMorale = 50.0;
    this.shiftBattlefieldMorale(0);

    this.audio.startBackgroundMusic();
    this.ui.showScreen(this.ui.inGameHud);
    this.ui.showCombo(0);
    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score,{supports:{apc:this.apc.getSupportState(),cheyenne:this.dropship.getSupportState()}});
    this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));
    document.getElementById('hud-weapon-label').innerText = 'ARME: PRINCIPALE';
    const visionTag = document.getElementById('hud-vision-tag');
    if (visionTag) visionTag.innerText = 'VISION : NATURELLE';
    document.getElementById('btn-abandon-operation').classList.toggle('hidden',!this.battleSimulation);
    document.getElementById('btn-hud-map').classList.toggle('hidden',!this.battleSimulation);
    this.lastTime = performance.now();
    this.updateInsertionStatus();
  }

  clearAPCSupport() {
    if (this._apcNavigationCollider) {
      this.env.colliders = this.env.colliders.filter(collider => collider !== this._apcNavigationCollider);
      this._apcNavigationCollider = null;
      this.invalidateSupportNavigation();
    }
    this.apc.clear();
  }

  spawnAPCSupport(position) {
    this.clearAPCSupport();
    this.env.resolveMovement(position, this.apc.navigationRadius);
    position.y=this.env.getPlacementElevationAt?.(position.x,position.z)??position.y;
    if(!this.apc.spawn(position))return false;
    // The navigation system must see the same carrier that stops characters;
    // otherwise ground enemies repeatedly walk into its visible hull.
    this._apcNavigationCollider = this.apc.getNavigationCollider();
    if(this._apcNavigationCollider)this.env.colliders.push(this._apcNavigationCollider);
    this.invalidateSupportNavigation();
    return true;
  }

  invalidateSupportNavigation() {
    this.env.navigation?.gridCache?.clear();
    if(this.env.navigation)this.env.navigation.actorPaths=new WeakMap();
  }

  getSupportCombatants() {
    return [this.apc?.getCombatant(),this.dropship?.getCombatant()].filter(Boolean);
  }

  initializeMissionSupports(saved) {
    const context=createMissionSupportContext({missionId:saved?.campaignRunId??this.missionRun,levelId:this.ui.selectedLevel.id,fidelityMode:this.activeLoadout.fidelityMode,environment:this.env,
      onDestroyed:event=>{if(event.kind==='apc')this.clearAPCSupport();this.ui.showAnnouncement(event.kind==='apc'?'APC M577 DÉTRUIT — APPUI PERDU POUR CETTE MISSION.':'CHEYENNE DÉTRUIT — APPUI PERDU POUR CETTE MISSION.');}});
    this.missionSupportContext=context;
    this.orbital.supportContext=context;
    this.apc.beginMission(context);this.dropship.beginMission(context);
  }

  restoreMissionSupports(saved) {
    if(!saved)return;
    if(saved.version!==1||!this.apc.restore(saved.apc)||!this.dropship.restore(saved.cheyenne))throw new Error('Incompatible support checkpoint');
    if(this._apcNavigationCollider)this.env.colliders=this.env.colliders.filter(collider=>collider!==this._apcNavigationCollider);
    this._apcNavigationCollider=this.apc.getNavigationCollider();
    if(this._apcNavigationCollider)this.env.colliders.push(this._apcNavigationCollider);
    this.invalidateSupportNavigation();
  }

  enterBattlefieldSector(sector) {
    this.waveIndex = sector.index + 1;
    const center = new THREE.Vector3(sector.center[0], 0, sector.center[1]);
    const arrivingPlayer = [this.player, this.player2].find(player => player?.hp > 0 && this.env.getSectorAt(player.position)?.id === sector.id);
    const supportPosition = arrivingPlayer ? arrivingPlayer.position.clone().lerp(center, 0.2) : center;
    this.combatDirector.reset({ graceSeconds: sector.index === 0 ? 8 : 2.5 });
    // The opening fight belongs to the player. Supporting factions join later
    // sectors instead of killing the first six enemies during insertion.
    this.allies.spawnSquad(supportPosition, sector.index === 0 ? 0 : 1);
    if (sector.index === 0) this.marines.clearSquad();
    else this.marines.spawnSquad(supportPosition, 2);
    this.synthetics.spawnSquad(center, sector.index === 0 ? 0 : 2);
    this.badBlood.clear();
    this.weather.spawnGasPipes(4, center);
    this.clearAPCSupport();
    if (sector.index === 3) {
      const vehiclePosition = supportPosition.clone().add(new THREE.Vector3(-8, 0, 6));
      this.spawnAPCSupport(vehiclePosition);
      this.scheduleMissionTask(() => {
        if (this.apc.mesh && this.env.activeSectorId === sector.id) this.ui.showAnnouncement('RENFORT USCM — APC M577 EN POSITION DE SOUTIEN');
      }, 1.5);
    }
    // Resolve the freshly spawned squad against the carrier as well, before
    // the first frame rather than leaving an ally inside its hull.
    for (const actor of [...this.allies.allies, ...this.marines.marines, ...this.synthetics.androids]) this.env.resolveMovement(actor.mesh.position, 1);
    // Keep the skimmer available as the battlefield advances without moving a
    // mounted vehicle out from under either player's controls.
    if (!this.skimmer.isMounted) this.skimmer.spawnAt(center.clone().add(new THREE.Vector3(sector.index === 0 ? -9 : 5, 0, sector.index === 0 ? 8 : 5)));
    if (sector.objective.type === 'boss') this.bossSpawned = true;
  }

  startSandboxMission(config) {
    this.audio.init();
    this.missionMode = 'sandbox';
    this.isCoOp = false;
    this.renderer.setSplitScreen(false);
    const enemyCount = Math.max(1, Math.min(150, Math.round(Number(config.enemyCount) || 60)));
    if(this.startMission({ enemyCount,bossType:config.bossType??'xenomorph_queen' })===false)return false;
    this.bossSpawned = true;
    this.bosses.spawnBoss(config.bossType || 'xenomorph_queen', this.player.position.clone().add(new THREE.Vector3(0, 0, -30)),this.preparedBossEncounter);
    this.ui.showAnnouncement(`ARÈNE SANDBOX : ${enemyCount} ENNEMIS ET UN BOSS. ÉLIMINEZ TOUTES LES CIBLES.`);
  }

  scheduleAttackImpact(owner, attack, resolve) {
    const run = this.missionRun;
    this.scheduleMissionTask(() => {
      if (!this.isPlaying || this.missionRun !== run || owner.hp <= 0 || ![this.player, this.player2].includes(owner)) return;
      if (typeof owner.claimAttackImpact === 'function' && !owner.claimAttackImpact(attack.attackId)) return;
      resolve();
    }, Math.max(0, attack.hitDelay ?? 0));
  }

  dispatchSelectedProjectile(weapon, charged = false, owner = this.player) {
    if (weapon.id === 'smart_disc') return this.throwSmartDisc(owner);
    if (weapon.id === 'shuriken') return this.throwShuriken(owner);
    if (weapon.actionMethod === 'fireCompoundBow' || weapon.id === 'compound_bow' || weapon.id === 'taabe_bow') return this.fireCompoundBow(owner);
    return this.firePlasmaCannon(charged,owner);
  }

  performLightAttack() {
    const owner = this.player;
    if (!owner || owner.hp <= 0) return false;
    const weapon = owner.getWeaponState?.();
    if (weapon?.action === 'projectile') return this.dispatchSelectedProjectile(weapon, false);
    const attack = owner.lightAttack();
    if (!attack) return false;
    this.scheduleAttackImpact(owner, attack, () => this.resolveLightAttack(attack));
    return true;
  }

  resolveLightAttack(attack) {
    if (this.vanguardFrenzyActive) {
      attack.damage *= 1.35;
    }

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 4.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);
    if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(this.player.position) <= attack.radius + 2) {
      this.hitBossFromPlayer(attack.damage,this.player.position,'light');
    }

    // Chantier 2: Predator Cloak Thermal Distortion & Backstab Stealth Execution (Predator 1987 / Prey 2022)
    if (this.player.isCloaked && hits.length > 0) {
      const playerForward = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();
      hits.forEach(hitEnemy => {
        if (hitEnemy && hitEnemy.mesh) {
          const toEnemy = hitEnemy.mesh.position.clone().sub(this.player.position).normalize();
          if (playerForward.dot(toEnemy) > 0.3) {
            hitEnemy.hp -= attack.damage * 2.5; // Additional 2.5x stealth execution damage (total 3.5x)
            if (this.audio && this.audio.playStealthAssassination) {
              this.audio.playStealthAssassination();
            }
            this.player.recordTrophy('Exécution Silencieuse de Proie par Poignardage Dorsal', 150);
            this.score += 150;
            this.ui.showAnnouncement("⚡ ASSASSINAT SILENCIEUX - EXÉCUTION D'HONNEUR (+150 HONNEUR) !");
            if (this.particles && this.particles.emitAlienBloodSpurt) {
              this.particles.emitAlienBloodSpurt(hitEnemy.mesh.position, 16);
            }
          }
        }
      });
    }

    // Environmental Hazard Interactions
    if (this.env) {
      this.env.checkCraneCableHit(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkEggClusterHits(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkSteamConduitHits(this.player.position, 3.8, attack.damage, this.audio, this.particles);
      this.env.checkOvipositorHit(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde, this.bosses);
      this.env.checkNitrogenTankHits(this.player.position, 3.8, attack.damage, this.audio, this.particles);
      this.env.checkWebbingDamage(this.player.position, 3.8, attack.damage, this.particles);
      if (this.env.checkBarrelHits) {
        this.env.checkBarrelHits(attack, this.audio, this.particles, this.horde, this.player, this.synthetics);
      }
      if (this.env.checkStasisTankHits) {
        this.env.checkStasisTankHits(attack, this.audio, this.particles, this.horde);
      }
      if (this.env.checkAmmoniaPipeDamage) {
        this.env.checkAmmoniaPipeDamage(attack, this.audio, this.particles, this.horde);
      }
      if (this.env.checkWaterTowerDamage) {
        this.env.checkWaterTowerDamage(attack, this.audio, this.particles, this.horde, this.synthetics);
      }
      if (this.env.checkGunnisonPowerPoleDamage) {
        this.env.checkGunnisonPowerPoleDamage(attack.origin, attack.damage, this.audio, this.horde, this.particles, this.ui);
      }
      if (this.env.checkBoulderDeadfallDamage) {
        this.env.checkBoulderDeadfallDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkDutchLogTrapTrigger) {
        this.env.checkDutchLogTrapTrigger(attack.origin, true, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkHVACChillerDamage) {
        this.env.checkHVACChillerDamage(attack.origin, attack.damage, this.audio, this.horde, this.particles, this.ui);
      }
      if (this.env.checkRebelFuelBarrelsDamage) {
        this.env.checkRebelFuelBarrelsDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkFlareTripwireTrigger) {
        this.env.checkFlareTripwireTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkNeonTransformerOverload) {
        this.env.checkNeonTransformerOverload(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkBoilingTarSpillDamage) {
        this.env.checkBoilingTarSpillDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkRoyceTripwireTrigger) {
        this.env.checkRoyceTripwireTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkMombassaPunjiTrapTrigger) {
        this.env.checkMombassaPunjiTrapTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkCryoNitrogenTankTrigger) {
        this.env.checkCryoNitrogenTankTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
    }

    // Update Combo Chain Tag
    const tagElem = document.getElementById('combo-chain-indicator');
    if (tagElem) {
      tagElem.innerText = `SÉRIE LÉGÈRE : ÉTAPE ${this.player.comboStep}/5`;
      tagElem.style.color = '#00d2ff';
    }

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.gore.spawnYautjaSeveredHead(this.badBlood.badBlood.mesh.position);
          const tName = 'Masque Souillé & Crâne Décapité de Bad Blood Renégat (Dark Horse Comics 1993)';
          const tHonor = 2200;
          this.player.recordTrophy(tName, tHonor);
          this.score += tHonor;
          this.shiftBattlefieldMorale(20.0);
          this.ui.showAnnouncement(`💀 BAD BLOOD EXÉCUTÉ DANS LE SANG ! ${tName} (+${tHonor} HONNEUR, MORAL +20%) !`);
        }
      }
    }
  }

  performHeavyAttack() {
    const owner = this.player;
    if (!owner || owner.hp <= 0) return false;
    const weapon = owner.getWeaponState?.();
    if (weapon?.action === 'projectile') return this.dispatchSelectedProjectile(weapon, true);
    const attack = owner.heavyAttack();
    if (!attack) return false;
    this.scheduleAttackImpact(owner, attack, () => this.resolveHeavyAttack(attack));
    return true;
  }

  resolveHeavyAttack(attack) {
    if (this.vanguardFrenzyActive) {
      attack.damage *= 1.35;
    }

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 6.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);
    if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(this.player.position) <= attack.radius + 2) {
      this.hitBossFromPlayer(attack.damage,this.player.position,'heavy');
    }

    // Environmental Hazard Interactions
    if (this.env) {
      this.env.checkCraneCableHit(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkEggClusterHits(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkSteamConduitHits(this.player.position, 4.8, attack.damage, this.audio, this.particles);
      this.env.checkOvipositorHit(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde, this.bosses);
      this.env.checkNitrogenTankHits(this.player.position, 4.8, attack.damage, this.audio, this.particles);
      this.env.checkWebbingDamage(this.player.position, 4.8, attack.damage, this.particles);
      if (this.env.checkBarrelHits) {
        this.env.checkBarrelHits(attack, this.audio, this.particles, this.horde, this.player, this.synthetics);
      }
      if (this.env.checkStasisTankHits) {
        this.env.checkStasisTankHits(attack, this.audio, this.particles, this.horde);
      }
      if (this.env.checkAmmoniaPipeDamage) {
        this.env.checkAmmoniaPipeDamage(attack, this.audio, this.particles, this.horde);
      }
      if (this.env.checkWaterTowerDamage) {
        this.env.checkWaterTowerDamage(attack, this.audio, this.particles, this.horde, this.synthetics);
      }
      if (this.env.checkGunnisonPowerPoleDamage) {
        this.env.checkGunnisonPowerPoleDamage(attack.origin, attack.damage, this.audio, this.horde, this.particles, this.ui);
      }
      if (this.env.checkBoulderDeadfallDamage) {
        this.env.checkBoulderDeadfallDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkDutchLogTrapTrigger) {
        this.env.checkDutchLogTrapTrigger(attack.origin, true, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkHVACChillerDamage) {
        this.env.checkHVACChillerDamage(attack.origin, attack.damage, this.audio, this.horde, this.particles, this.ui);
      }
      if (this.env.checkRebelFuelBarrelsDamage) {
        this.env.checkRebelFuelBarrelsDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkFlareTripwireTrigger) {
        this.env.checkFlareTripwireTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkNeonTransformerOverload) {
        this.env.checkNeonTransformerOverload(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkBoilingTarSpillDamage) {
        this.env.checkBoilingTarSpillDamage(attack.origin, attack.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkRoyceTripwireTrigger) {
        this.env.checkRoyceTripwireTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkMombassaPunjiTrapTrigger) {
        this.env.checkMombassaPunjiTrapTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
      if (this.env.checkCryoNitrogenTankTrigger) {
        this.env.checkCryoNitrogenTankTrigger(attack.origin, this.audio, this.horde, this.bosses, this.particles, this.ui);
      }
    }

    // Dynasty Warriors Musou C1-C6 Charge Finisher Announcement & Camera Punch
    if (this.player.currentChargeName) {
      this.ui.showAnnouncement(`⚡ FINISHER CHARGÉ : ${this.player.currentChargeName} !`);
      const tagElem = document.getElementById('combo-chain-indicator');
      if (tagElem) {
        tagElem.innerText = `FINISHER : ${this.player.currentChargeName}`;
        tagElem.style.color = '#ffb703';
      }

      const isC6 = this.player.currentChargeName.includes('C6');
      this.triggerCameraShake(isC6 ? 1.2 : 0.6, isC6 ? 0.45 : 0.25);
      this.triggerCameraFovSurge(isC6 ? 68 : 64, isC6 ? 0.5 : 0.3);
    }

    const badBloodVictim = this.badBlood.badBlood;
    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (badBloodVictim.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.gore.spawnYautjaSeveredHead(badBloodVictim.mesh.position);
          const tName = 'Masque Souillé & Crâne Décapité de Bad Blood Renégat (Dark Horse Comics 1993)';
          const tHonor = 2200;
          this.awardTrophy(badBloodVictim,tName,tHonor);
          this.shiftBattlefieldMorale(20.0);
          this.ui.showAnnouncement(`💀 BAD BLOOD EXÉCUTÉ DANS LE SANG ! ${tName} (+${tHonor} HONNEUR, MORAL +20%) !`);
        }
      }
    }
  }

  createRangedMesh(shot, color = 0x00d2ff) {
    if (shot.projectileKind === 'feral_bolt') {
      const group=new THREE.Group(), metal=new THREE.MeshStandardMaterial({color:0x999b93,metalness:.85,roughness:.32});
      const shaft=new THREE.Mesh(new THREE.CylinderGeometry(.045,.045,1.3,8),metal);shaft.rotation.x=Math.PI/2;group.add(shaft);
      const tip=new THREE.Mesh(new THREE.ConeGeometry(.13,.4,8),metal);tip.rotation.x=Math.PI/2;tip.position.z=.8;group.add(tip);
      for(let i=0;i<3;i++){const fin=new THREE.Mesh(new THREE.BoxGeometry(.32,.025,.3),metal);fin.position.z=-.48;fin.rotation.z=i*Math.PI/3;group.add(fin);}
      group.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),shot.direction.clone().normalize());return group;
    }
    const mesh=new THREE.Mesh(new THREE.SphereGeometry(shot.isCharged?1.2:.5,14,14),new THREE.MeshBasicMaterial({color:shot.isCharged?0xffffff:color}));
    if(shot.isCharged)mesh.add(new THREE.Mesh(new THREE.SphereGeometry(1.65,10,10),new THREE.MeshBasicMaterial({color:0x00e5ff,transparent:true,opacity:.65})));
    return mesh;
  }

  firePlasmaCannon(isCharged = false, player = this.player) {
    if (!player) return false;
    const projData = player.fireRangedShot(isCharged);
    if (!projData) {
      if (player.plasmaEnergy < (isCharged ? 35 : 20)) {
        this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE POUR LE TIR !');
      }
      return false;
    }

    const mesh = this.createRangedMesh(projData, player.laserColorHex || 0x00d2ff);
    mesh.position.copy(projData.position);
    this.renderer.scene.add(mesh);

    this.projectiles.push({owner:player,attackOrigin:player.position.clone(),
      mesh: mesh,
      isSuperCharged: projData.isCharged === true,
      projectileKind: projData.projectileKind,
      direction: projData.direction,
      damage: projData.damage,
      speed: projData.speed ?? (isCharged ? 52 : 45),
      life: 2.6
    });
    return true;
  }

  fireFlechetteNeedler() {
    if (!this.player) return;
    const dartData = this.player.fireFlechetteNeedler();
    if (!dartData) return;

    const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(dartData.position);
    this.renderer.scene.add(mesh);

    this.projectiles.push({
      mesh: mesh,
      direction: dartData.direction,
      damage: dartData.damage,
      speed: dartData.speed,
      life: 1.8
    });
    this.ui.showAnnouncement('🎯 DARD FLECHETTE NEEDLER PROPULSÉ !');
  }

  throwSmartDisc(player = this.player) {
    if (!player) return;
    const discData = player.throwSmartDisc(this.horde);
    if (!discData) return;

    // Build Circular Razor-Sharp Smart-Disc Mesh
    const discGroup = new THREE.Group();
    const discGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.06, 16);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.1
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = Math.PI / 2;
    discGroup.add(discMesh);

    // Glowing Razor Edge
    const edgeGeo = new THREE.TorusGeometry(0.66, 0.03, 8, 24);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    discGroup.add(edgeMesh);

    discGroup.position.copy(discData.startPos);
    this.renderer.scene.add(discGroup);

    this.projectiles.push({owner:player,
      mesh: discGroup,
      isSmartDisc: true,
      startPos: discData.startPos,
      apexPos: discData.apexPos,
      waypoints: discData.waypoints || [],
      damage: discData.damage,
      progress: 0,
      speed: 1.35 * (player.smartDiscSpeedMult || 1.0), // 1.35x base -> faster with loadout perk
      life: 1.8
    });

    const isHoming = discData.waypoints && discData.waypoints.length > 0;
    this.ui.showAnnouncement(isHoming
      ? `🥏 SMART-DISC YAUTJA : VERROUILLAGE HOMING MULTI-CIBLES (${discData.waypoints.length} CIBLES) !`
      : '🥏 SMART-DISC YAUTJA LANCÉ EN ARC BOOMERANG !');
  }

  triggerSmartDiscRicochet(disc) {
    if (!disc || !disc.mesh) return;

    let closestEnemy = null;
    let minD = 26.0;
    this.horde.aliens.forEach(a => {
      const d = a.mesh.position.distanceTo(disc.mesh.position);
      if (d < minD && a.hp > 0) {
        minD = d;
        closestEnemy = a;
      }
    });

    if (closestEnemy) {
      disc.startPos = disc.mesh.position.clone();
      disc.apexPos = closestEnemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      disc.progress = 0;
      disc.life = 1.4;
      disc.damage += 140; // Consecutive ricochet slices deal escalating kinetic damage!
      this.particles.emitSparks(disc.mesh.position, 12);
      if (this.audio && this.audio.playSmartDiscRicochet) {
        this.audio.playSmartDiscRicochet();
      }
      this.ui.showAnnouncement('🎯 SMART-DISC RICOCHET GUIDÉ AU LASER : CIBLE TRANCHÉE (PREDATOR 2) !');
    }
  }

  throwCombiStick() {
    if (!this.player) return;
    const data = this.player.throwCombiStick();
    if (!data) return;

    // 1:1 Canon Combi-Stick Telescopic Javelin Mesh (Predator 2 Lore)
    const spearGroup = new THREE.Group();
    // Central titanium-bronze shaft
    const shaftGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.2
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    spearGroup.add(shaft);

    // Front elongated chrome spearhead
    const bladeGeo = new THREE.ConeGeometry(0.12, 0.8, 4);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.1
    });
    const frontBlade = new THREE.Mesh(bladeGeo, bladeMat);
    frontBlade.position.y = 1.8;
    spearGroup.add(frontBlade);

    // Rear counter-blade spearhead
    const rearBlade = new THREE.Mesh(bladeGeo, bladeMat);
    rearBlade.position.y = -1.8;
    rearBlade.rotation.x = Math.PI;
    spearGroup.add(rearBlade);

    // Luminous plasma energy core rings
    const ringGeo = new THREE.TorusGeometry(0.07, 0.02, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.5;
    spearGroup.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.5;
    spearGroup.add(ring2);

    // Orient spear towards throw trajectory
    spearGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), data.direction);
    spearGroup.position.copy(data.startPos);
    this.renderer.scene.add(spearGroup);

    this.projectiles.push({
      mesh: spearGroup,
      isCombiStick: true,
      direction: data.direction,
      speed: data.speed,
      damage: data.damage,
      pierceRemaining: data.pierceRemaining,
      life: 2.0
    });

    this.ui.showAnnouncement('🔱 JAVELOT COMBI-STICK PROPULSÉ : PERFORATION MULTI-CIBLES !');
  }

  throwShuriken(player = this.player) {
    if (!player) return;
    const data = player.throwShuriken();
    if (!data) return;

    // 1:1 Canon Collapsible 6-Bladed Shuriken (AVP 2004 Celtic / Scar Lore)
    const shurikenGroup = new THREE.Group();
    // Central hexagonal core hub
    const coreGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 6);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    shurikenGroup.add(core);

    // 6 curved crescent steel blades
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.05 });
    for (let b = 0; b < 6; b++) {
      const bladeGeo = new THREE.BoxGeometry(0.12, 0.04, 1.1);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const angle = (b / 6) * Math.PI * 2;
      blade.position.set(Math.sin(angle) * 0.7, 0, Math.cos(angle) * 0.7);
      blade.rotation.y = angle + 0.35; // Curved aerodynamic slant
      shurikenGroup.add(blade);
    }

    // Glowing energy razor perimeter ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.03, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    shurikenGroup.add(ring);

    shurikenGroup.position.copy(data.startPos);
    this.renderer.scene.add(shurikenGroup);

    this.projectiles.push({owner:player,
      mesh: shurikenGroup,
      isShuriken: true,
      direction: data.direction,
      speed: data.speed,
      damage: data.damage,
      pierceRemaining: 6 + (player.shurikenPierceBonus || 0),
      radius: data.radius,
      life: 1.8
    });

    this.ui.showAnnouncement('🥏 SHURIKEN HEXA-LAMES YAUTJA DÉPLOYÉ : DÉCOUPE CIRCULAIRE 360° !');
  }

  performPowerGloveSlam() {
    if (!this.player) return;
    if (this.player.triggerPowerGloveSlam(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 25);
      this.particles.spawnPlasmaScorch(this.player.position);
      this.ui.showAnnouncement('⚡ FRAPPE GANTELET KINETIC POWER GLOVE : ONDE DE CHOC GÉOLOGIQUE 12M !');
    }
  }

  performSpineWhip() {
    if (!this.player) return;
    if (this.player.triggerSpineWhipSlash(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 12);
      this.ui.showAnnouncement('🐍 FOUET SEGMENTÉ RAZOR-WHIP (AVP-R) : BALAYAGE 10M & DÉMEMBREMENT !');
    }
  }

  triggerPathogenUrnStrike() {
    if (this.pathogenCooldown > 0 || !this.player) return;
    this.pathogenCooldown = 15.0;

    this.audio.playEngineerFluteHorn();
    this.ui.showAnnouncement('🏺 BOMBARDEMENT PATHOGÈNE NOIR DES INGÉNIEURS (PROMETHEUS) DÉPLOYÉ !');

    const centerPos = this.player.position.clone();
    const forward = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();

    // Drop 3 Black Urn canisters from orbit
    for (let u = 0; u < 3; u++) {
      this.scheduleMissionTask(() => {
        const urnPos = centerPos.clone()
          .addScaledVector(forward, 10 + u * 6)
          .add(new THREE.Vector3((u - 1) * 6, 0, 0));

        // Create dark obsidian urn mesh
        const urnGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.8, 8);
        const urnMat = new THREE.MeshStandardMaterial({
          color: 0x09090b,
          roughness: 0.1,
          metalness: 0.95
        });
        const urnMesh = new THREE.Mesh(urnGeo, urnMat);
        urnMesh.position.set(urnPos.x, 0.9, urnPos.z);
        this.renderer.scene.add(urnMesh);

        // Pathogen liquid black pool
        const poolGeo = new THREE.CircleGeometry(4.2, 16);
        poolGeo.rotateX(-Math.PI / 2);
        const poolMat = new THREE.MeshBasicMaterial({
          color: 0x050505,
          transparent: true,
          opacity: 0.88,
          depthWrite: false
        });
        const poolMesh = new THREE.Mesh(poolGeo, poolMat);
        poolMesh.position.set(urnPos.x, 0.03, urnPos.z);
        this.renderer.scene.add(poolMesh);

        this.particles.emitSparks(urnPos, 20);

        this.pathogenPools.push({
          urnMesh,
          poolMesh,
          pos: urnPos.clone(),
          life: 8.5,
          damage: 95
        });
      }, u * 0.4);
    }
  }

  triggerLaserGuidedFlechettes() {
    if (!this.player) return;
    const data = this.player.triggerFlechetteVolley(this.targetLockEnemy);
    if (!data) return;

    // Launch 3 aerodynamic flechette bolts (Prey 2022 Feral Predator Canon 1:1)
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.1 });
    const finMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    for (let f = 0; f < data.count; f++) {
      const flechetteGroup = new THREE.Group();

      // Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), shaftMat);
      shaft.rotation.x = Math.PI / 2;
      flechetteGroup.add(shaft);

      // Razor arrowhead
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.65;
      flechetteGroup.add(tip);

      // Stabilizer fins
      for (let w = 0; w < 3; w++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.15, 0.25), finMat);
        fin.rotation.z = (w / 3) * Math.PI * 2;
        fin.position.z = -0.4;
        flechetteGroup.add(fin);
      }

      // Fan-out initial trajectory
      const spreadAngle = (f - 1) * 0.25;
      const initialDir = data.forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle).normalize();

      flechetteGroup.position.copy(data.origin).add(new THREE.Vector3((f - 1) * 0.4, 0, 0));
      flechetteGroup.lookAt(flechetteGroup.position.clone().add(initialDir));
      this.renderer.scene.add(flechetteGroup);

      this.projectiles.push({
        mesh: flechetteGroup,
        isGuidedFlechette: true,
        direction: initialDir,
        target: data.target,
        speed: data.speed,
        damage: data.damage,
        life: 2.2
      });
    }

    this.ui.showAnnouncement('🎯 VOLÉE DE 3 FLÉCHETTES À GUIDAGE LASER PROPULSÉE (PREY 2022) !');
  }

  deploySentryGun() {
    if (!this.player) return;
    const facing = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();
    const deployPos = this.player.position.clone().addScaledVector(facing, 2.5);
    deployPos.y = 0;

    this.sentryGun.deploySentry(deployPos, facing);
    this.particles.emitSparks(deployPos, 15);
    this.audio.playShieldBlock();
    this.ui.showAnnouncement('🤖 TOURELLE AUTOMATIQUE USCM UA 571-C DÉPLOYÉE (500 COUPS 10MM CASSETTE) !');
  }

  launchFalconDrone() {
    if (!this.player) return;
    this.falconDrone.launch(this.player.position);
    this.ui.showAnnouncement('🦅 DRONE FAUCON FALCONER DÉPLOYÉ : PATROUILLE AÉRIENNE & PIQUÉ DE PRÉCISION !');
  }

  performBoneScytheCleave() {
    if (!this.player) return;
    if (this.player.performBoneScytheCleave(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 20);
      this.ui.showAnnouncement('⚔️ FAUX D\'OS PRIMORDIALE DE L\'ALPHA PREDATOR : BALAYAGE CIRCULAIRE 360° 7.5M !');
    }
  }

  fireCompoundBow(player = this.player) {
    if (!player) return false;
    const arrowData = player.fireCompoundBow();
    if (!arrowData) return false;

    const isPrey=arrowData.projectileKind==='taabe_arrow';
    const arrowGroup = isPrey?createPreyArrowMesh():new THREE.Group();
    if(!isPrey){
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), shaftMat);
    shaft.rotation.x = Math.PI / 2;
    arrowGroup.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.0;
    arrowGroup.add(tip);
    }

    arrowGroup.position.copy(arrowData.origin);
    arrowGroup.lookAt(arrowGroup.position.clone().add(arrowData.direction));
    this.renderer.scene.add(arrowGroup);

    this.projectiles.push({owner:player,attackOrigin:player.position.clone(),
      mesh: arrowGroup,
      isChargedArrow: true,
      projectileKind: arrowData.projectileKind,
      direction: arrowData.direction,
      speed: arrowData.speed,
      damage: arrowData.damage,
      pierceRemaining: arrowData.pierceRemaining,
      life: arrowData.life
    });

    this.ui.showAnnouncement(isPrey?`ARC DE TAABE — FLÈCHE DE BOIS, ${player.taabeArrowAmmo} RESTANTES.`:'ARC COMPOSÉ YAUTJA : FLÈCHE PLASMA PERÇANTE DÉCOCHÉE.');
    return true;
  }

  hitBossFromPlayer(damage, origin, attackKind='light', impactOrigin=origin) {
    const boss=this.bosses.activeBoss;
    if(!boss||!origin?.isVector3)return null;
    const from=impactOrigin.clone().add(new THREE.Vector3(0,impactOrigin===origin?1.2:0,0));
    const to=boss.mesh.position.clone().add(new THREE.Vector3(0,1.5,0));
    if(this.env.hasLineOfSight?.(from,to)===false)return null;
    return this.bosses.takeDamage(damage,this.horde,{origin:origin.clone(),attackKind,killerFaction:this.battleSimulation?.config.playerFaction??'player_clan'});
  }

  advancePreyArrow(projectile,delta) {
    const from=projectile.mesh.position.clone(),to=from.clone().addScaledVector(projectile.direction,projectile.speed*delta);
    const targets=[...this.horde.aliens.map(actor=>({actor,kind:'horde'})),...this.synthetics.androids.map(actor=>({actor,kind:'synthetic'})),
      ...[...(this.battleBridge?.actors?.values()??[])].map(({actor})=>({actor,kind:'horde'}))];
    if(this.bosses.activeBoss)targets.unshift({actor:this.bosses.activeBoss,kind:'boss'});
    const faction=this.battleSimulation?.config.playerFaction??'player_clan';
    const impact=traceSingleProjectileImpact(from,to,targets,this.env,actor=>!this.battleSimulation||!actor.factionId||this.battleSimulation.areHostile(faction,actor.factionId));
    projectile.mesh.position.copy(impact?.point??to);
    if(!impact)return projectile.life<=0;
    if(impact.kind==='wall'){this.particles.emitSparks(impact.point,4);return true;}
    const attack={origin:impact.point,radius:2.2,damage:projectile.damage,type:'arrow',targetOnly:impact.actor,killerFaction:faction};
    if(impact.kind==='boss')this.hitBossFromPlayer(projectile.damage,projectile.attackOrigin??projectile.owner.position,'projectile',from);
    else if(impact.kind==='synthetic')this.registerHits(this.synthetics.checkHits(attack));
    else this.registerHits(this.horde.checkMeleeHits(attack));
    this.audio.playArrowPinImpact?.();
    return true;
  }

  deployHoloDecoy() {
    if (!this.player || this.player.hp <= 0) return;
    const decoy = this.player.deployHoloDecoy(this.renderer.scene);
    if (!decoy) return;

    this.holoDecoys.push(decoy);
    this.ui.showAnnouncement('⚡ LEURRE HOLOGRAPHIQUE ACTIVÉ : ATTENTION DE LA RUCHE DÉTOURNÉE !');
  }

  executeMusouOverload() {
    this.ui.showAnnouncement('⚡ VRAIE ATTAQUE MUSOU : DÉVASTATION DU CLAN APEX !');
    this.audio.playOmniPlasmaStorm();

    // Intense Musou Camera Shockwave & Elastic FOV Surge
    this.triggerCameraShake(1.6, 0.7);
    this.triggerCameraFovSurge(74, 1.4);

    // Show True Musou Calligraphy Banner
    const banner = document.getElementById('true-musou-banner');
    if (banner) {
      banner.classList.remove('hidden');
      this.scheduleMissionTask(() => banner.classList.add('hidden'), 2.2);
    }

    // Shift Battlefield Morale toward Clan (+20%)
    this.shiftBattlefieldMorale(20);

    // 8 Omni-directional rotating high-energy plasma beams
    const stormGroup = new THREE.Group();
    stormGroup.position.copy(this.player.position).add(new THREE.Vector3(0, 2.0, 0));
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95 });

    for (let b = 0; b < 12; b++) {
      const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 42, 6);
      beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.y = (b / 12) * Math.PI * 2;
      beam.position.set(Math.cos(beam.rotation.y) * 21.0, 0, Math.sin(beam.rotation.y) * 21.0);
      stormGroup.add(beam);
    }
    this.renderer.scene.add(stormGroup);

    // Animate intense storm rotation and beam pulse
    this.missionEffects.push({ mesh: stormGroup, life: 0.75, maxLife: 0.75,
      update: (delta, remaining) => {
        stormGroup.rotation.y += 9 * delta;
        stormGroup.scale.multiplyScalar(Math.exp(0.8 * delta));
        beamMat.opacity = 0.95 * remaining;
      }
    });

    const attack = {
      origin: this.player.position,
      damage: 1200,
      radius: 40,
      isLauncher: true,
      launchVelY: 28.0,
      knockback: 18.0
    };
    const hits = this.horde.checkMeleeHits(attack);
    this.registerHits(hits);

    // Spawn massive plasma scorched ground decal at center
    this.particles.spawnPlasmaScorch(this.player.position);

    if (this.bosses.activeBoss) this.bosses.takeDamage(1500);
    if (this.badBlood.isActive) this.badBlood.takeDamage(1500);
  }

  triggerCameraShake(intensity = 0.8, duration = 0.35) {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeTimer = duration;
  }

  triggerCameraFovSurge(targetFov = 72, duration = 0.6) {
    this.targetCameraFov = targetFov;
    this.cameraFovTimer = duration;
    this.cameraFovDuration = duration;
  }

  checkTrophyExecution(player = this.player) {
    // 1. Boss Execution (Queen, The Offspring, Predalien)
    if (this.bosses.activeBoss && this.bosses.activeBoss.isStunned && this.bosses.activeBoss.hp <= this.bosses.activeBoss.maxHp * .3 &&
        this.bosses.activeBoss.mesh.position.distanceTo(player.position) <= 8) {
      const victim = this.bosses.activeBoss;
      const death = this.bosses.executeBoss(victim, {player:player,range:8,killerFaction:this.battleSimulation?.config.playerFaction??'player_clan'});
      if (!death) return;
      player.executeSpineRip(victim.type || 'queen');

      // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Camera
      this.bulletTimeTimer = 1.6;
      if (this.audio && this.audio.playExecutionBulletTimeWhoosh) {
        this.audio.playExecutionBulletTimeWhoosh();
      }
      this.triggerCameraFovSurge(48, 1.5);

      const jellyBeforeTrophy = player.royalJellyFlasks;
      const bType = victim.type || 'queen';
      let tName = 'Couronne Chitinense & Colonne Vertébrale de Reine Matriarche (Aliens 1986 / AvP 2004)';
      let tHonor = 2500;
      if (bType === 'predalien_matriarch_titan') {
        tName = 'Couronne Impériale & Quadruples Mandibules de Matriarche Titan Prédalienne (Mythique)';
        tHonor = 5000;
        player.royalJellyFlasks += 4;
      } else if (bType === 'the_offspring') {
        tName = 'Mandibule Hybride & Vertèbres Z-01 de The Offspring (Romulus 2024)';
        tHonor = 3500;
      } else if (bType === 'predalien_abomination') {
        tName = 'Crâne d\'Hybride Yautja-Xénomorphe & Mandibules Monstrueuses (AVP-R Chet Canon)';
        tHonor = 4000;
        player.royalJellyFlasks += 3;
      } else if (bType === 'predalien_queen') {
        tName = 'Mandibules Quadruples & Crâne Hybride de Reine Prédalienne (AVP-R 2007)';
        tHonor = 3000;
      } else if (bType === 'empress_matriarch') {
        tName = 'Ailes Vestigiales & Épine Royale d\'Impératrice de Ruche (Dark Horse Comics)';
        tHonor = 4000;
      } else if (bType === 'trilobite_prime') {
        tName = 'Tentacule Biologique Musculeux de Trilobite Prime (Prometheus 2012)';
        tHonor = 3000;
        if (this.audio && this.audio.playTrilobiteTentacleConstrict) this.audio.playTrilobiteTentacleConstrict();
      } else if (bType === 'awakened_engineer') {
        tName = 'Bio-Masque d\'Éléphant & Vertèbres d\'Ingénieur Mala\'kak (Prometheus / Fire & Stone)';
        tHonor = 6000;
        player.royalJellyFlasks += 5;
        if (this.audio && this.audio.playEngineerBioArmorShatter) this.audio.playEngineerBioArmorShatter();
      } else if (bType === 'rogue_king_prime') {
        tName = 'Couronne Cornue & Mandibules du Rogue King Xenomorph Prime (Aliens: Rogue 1993)';
        tHonor = 7500;
        player.royalJellyFlasks += 5;
        if (this.audio && this.audio.playRogueKingEarthquakeRoar) this.audio.playRogueKingEarthquakeRoar();
      } else if (bType === 'berserker_super_predator') {
        tName = "Masque d'Écorcheur & Mandibule Xéno de Super Predator Berserker (Predators 2010)";
        tHonor = 8000;
        player.royalJellyFlasks += 4;
        if (this.audio && this.audio.playBadBloodBerserkerRoar) this.audio.playBadBloodBerserkerRoar();
      } else if (bType === 'ultimate_upgrade_predator') {
        tName = "Exosquelette Chitinique Dermal & ADN Hybride de l'Ultimate Upgrade Predator (The Predator 2018)";
        tHonor = 9000;
        player.royalJellyFlasks += 5;
        if (this.audio && this.audio.playUltimatePredatorRoar) this.audio.playUltimatePredatorRoar();
      }

      const trophyAwarded = this.awardTrophy(victim,tName,tHonor,player);
      if(trophyAwarded){player.royalJellyFlasks+=2;player.hp=Math.min(player.maxHp,player.hp+500);}
      else player.royalJellyFlasks=jellyBeforeTrophy;

      // Chantier 1 & Elena Immersion QA (v54.0): Cautérisation Rituelle du Sang Acide (Sacred Blood Mark Ritual)
      if (player.triggerSacredBloodMarkRitual) {
        player.triggerSacredBloodMarkRitual(this.audio, this.particles, this.ui);
      }

      // Decisive Battlefield Morale Victory (+35%)
      this.shiftBattlefieldMorale(35.0);

      // Sofia QA Audit #5: Apex Pheromone Repulsion Fear Wave (Drones flee in panic)
      if (this.horde && this.horde.triggerFearPulse) {
        this.horde.triggerFearPulse(player.position, 24.0, 4.5);
      }

      // Record an actual death before removing the encounter. Clearing a
      // living boss alone cannot satisfy the battlefield's final objective.


      if (this.ui.showOfficerDefeatedBanner) {
        this.ui.showOfficerDefeatedBanner(tName);
      }
      if (this.audio && this.audio.playOfficerDefeatedGong) {
        this.audio.playOfficerDefeatedGong();
      }
      this.triggerCameraShake(1.2, 0.6);
      this.ui.showAnnouncement(`🏆 TROPHÉE LÉGENDAIRE RÉCOLTÉ : ${tName} (+${tHonor} HONNEUR, +2 GELÉES ROYALES) !`);
      this.ui.showExecutionPrompt(false);

      // Chantier 10 (v50.0): Sacred Blood Ritual Epilogue & Mothership Orbit Extraction
      if (this.waveIndex >= 5) {
        this.triggerSacredBloodRitualEpilogue();
      }
      return;
    }

    // 2. Sub-Boss Execution (Crusher Titan, Praetorian, Grid Alien, Marvel Alpha, Deacon, Rogue King, Raven, Ancient Predalien, Gestating Matriarch)
    for (let i = this.horde.aliens.length - 1; i >= 0; i--) {
      const a = this.horde.aliens[i];
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien' || a.isMarvelAlpha || a.isDeacon || a.isRogueKing || a.isRaven || a.isAncientPredalien || a.isGestatingMatriarch) && a.isStunned) {
        if (a.mesh.position.distanceTo(player.position) <= 5.8) {
          player.executeSpineRip();

          // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Camera
          this.bulletTimeTimer = 1.4;
          if (this.audio && this.audio.playExecutionBulletTimeWhoosh) {
            this.audio.playExecutionBulletTimeWhoosh();
          }
          if (this.audio && this.audio.playChitinDismembermentSnap) {
            this.audio.playChitinDismembermentSnap();
          }
          this.triggerCameraFovSurge(50, 1.3);

          let tName = a.isGestatingMatriarch
            ? 'Ovipositeur Biomécanique & Couronne de Matriarche Gestante (Aliens 1986 / Infestation)'
            : (a.isAncientPredalien
              ? 'Relique Fossilisée & Mandibules Ancestrales de l\'Ancient Predalien Elder (Primal Hunt)'
              : (a.isRaven
                ? 'Crâne d\'Obsidienne & Ailes Chitineuses du Xenomorph Raven (Colonial Marines)'
                : (a.isRogueKing
                  ? 'Crâne Couronné Dentelé du King Alien Rogue (Légendaire)'
                  : (a.isDeacon
                    ? 'Crâne Pointu Cobalt & Mâchoire Pharyngienne de Deacon Titan (Prometheus 2012)'
                    : (a.isMarvelAlpha
                      ? "Crâne Barbelé Argenté & Colonne Primordiale de l'Alpha Marvel (Epsilon Apex 1:1)"
                      : (a.type === 'crusher'
                        ? 'Bouclier Frontal Blindé de Crusher Titan'
                        : (a.type === 'grid_alien'
                          ? 'Crâne Gravé au Quadrillage Acide de Grid Alien (AVP 2004)'
                          : 'Couronne Royale Éburnéenne de Prétorien')))))));
          let tHonor = a.isGestatingMatriarch ? 4800 : (a.isAncientPredalien ? 4500 : (a.isRaven ? 3800 : (a.isRogueKing ? 4000 : (a.isDeacon ? 3500 : (a.isMarvelAlpha ? 3500 : (a.type === 'crusher' ? 1200 : (a.type === 'grid_alien' ? 1400 : 900)))))));
          if (a.isGestatingMatriarch && this.audio && this.audio.playMatriarchEggLayingSquish) {
            this.audio.playMatriarchEggLayingSquish();
          } else if (a.isAncientPredalien && this.audio && this.audio.playAncientPredalienAwaken) {
            this.audio.playAncientPredalienAwaken();
          } else if (a.isRaven && this.audio && this.audio.playRavenXenoShriek) {
            this.audio.playRavenXenoShriek();
          } else if (a.isRogueKing && this.audio && this.audio.playRogueKingRoar) {
            this.audio.playRogueKingRoar();
          } else if (a.isDeacon && this.audio && this.audio.playDeaconSpineRip) {
            this.audio.playDeaconSpineRip();
          }
          const trophyAwarded = this.awardTrophy(a,tName,tHonor,player);

          if(trophyAwarded){
          if (a.isGestatingMatriarch) {
            player.royalJellyFlasks += 3;
          } else if (a.isAncientPredalien) {
            player.royalJellyFlasks += 3;
          } else if (a.isRaven) {
            player.royalJellyFlasks += 2;
          } else if (a.isRogueKing) {
            player.royalJellyFlasks += 3;
          } else if (a.isDeacon) {
            player.royalJellyFlasks += 2;
          } else if (a.isMarvelAlpha) {
            player.royalJellyFlasks += 2; // Marvel Alpha awards 2 Royal Jelly flasks!
            this.triggerMarvelAlphaHallucination();
          } else if (a.type === 'praetorian') {
            player.royalJellyFlasks += 1; // Praetorian drops 1 Royal Jelly flask!
          } else if (a.type === 'grid_alien') {
            player.royalJellyFlasks += 1;
          }

          player.hp = Math.min(player.maxHp, player.hp + 400);

          }

          // Chantier 1 & Elena Immersion QA (v54.0): Cautérisation Rituelle du Sang Acide (Sacred Blood Mark Ritual)
          if (player.triggerSacredBloodMarkRitual) {
            player.triggerSacredBloodMarkRitual(this.audio, this.particles, this.ui);
          }

          // Sub-Boss Execution Morale Swing (+18% to +25%)
          this.shiftBattlefieldMorale((a.isMarvelAlpha || a.isRogueKing || a.isRaven || a.isAncientPredalien || a.isGestatingMatriarch) ? 25.0 : 18.0);

          // Sofia QA Audit #5: Apex Pheromone Repulsion (Minor Drones flee in panic)
          if (this.horde && this.horde.triggerFearPulse) {
            this.horde.triggerFearPulse(player.position, 16.0, 3.8);
          }

          if (this.gore) {
            this.gore.spawnDismemberment(a.mesh.position, 'spine_rip');
          }
          this.horde.spawnAcidPool(a.mesh.position);
          this.horde.defeatAlien(a, { cause: 'execution', killerFaction: this.battleSimulation?.config.playerFaction ?? 'player_clan' });

          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(tName);
          }
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          this.triggerCameraShake(0.9, 0.5);
          this.ui.showAnnouncement(`🏆 TROPHÉE DE CHASSE : ${tName} (+${tHonor} HONNEUR, MORAL +18%) !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }

    // 3. Chantier 10 (v46): Weyland-Yutani Combat Synthetic & Seegson Android CPU Trophy (+1800 Honor)
    if (this.synthetics && this.synthetics.androids) {
      for (let i = this.synthetics.androids.length - 1; i >= 0; i--) {
        const syn = this.synthetics.androids[i];
        if (!syn || !syn.mesh) continue;
        if ((syn.isBisected || syn.isEMPStunned || syn.hp <= 120) && syn.mesh.position.distanceTo(player.position) <= 4.2) {
          player.executeSpineRip();
          const isJoe = syn.type === 'working_joe';
          const tName = isJoe
            ? "Unité Logique & Yeux Ambrés Seegson Working Joe (Alien: Isolation)"
            : "Cœur Cybernétique & Unité Logique Hyperdyne Systems Weyland-Yutani (Aliens 1986 / Isolation)";
          const tHonor = 1800;
          if(this.awardTrophy(syn,tName,tHonor,player)){
            player.plasmaEnergy=Math.min(player.maxPlasmaEnergy,player.plasmaEnergy+40);
            player.hp=Math.min(player.maxHp,player.hp+200);
          }

          this.synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
          this.synthetics.defeatSynthetic(syn,{cause:'execution',killerFaction:this.battleSimulation?.config.playerFaction??'player_clan'});
          this.shiftBattlefieldMorale(15.0);

          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(tName);
          }
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          this.triggerCameraShake(0.85, 0.4);
          this.ui.showAnnouncement(`🏆 TROPHÉE CYBERNÉTIQUE ARRACHÉ : ${tName} (+${tHonor} HONNEUR, +40 ÉNERGIE) !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }
  }

  /* Chantier 10: Marvel Alpha Spine Trophy Execution & Eldritch Hallucination Pulse (Marvel Alien 2021) */
  triggerMarvelAlphaHallucination() {
    const overlay = document.getElementById('hallucination-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      this.scheduleMissionTask(() => overlay.classList.add('hidden'), 4.5);
    }
    if (this.audio && this.audio.playAlphaCommandRoar) {
      this.audio.playAlphaCommandRoar();
    }
    this.triggerCameraFovSurge(82, 1.2);
    this.triggerCameraShake(1.3, 0.6);
  }

  shiftBattlefieldMorale(deltaClan) {
    this.battlefieldMorale = Math.max(0, Math.min(100, this.battlefieldMorale + deltaClan));
    const clanFill = document.getElementById('morale-clan-fill');
    const hiveFill = document.getElementById('morale-hive-fill');
    const clanVal = document.getElementById('morale-clan-val');
    const hiveVal = document.getElementById('morale-hive-val');

    if (clanFill && hiveFill) {
      const clanPct = Math.round(this.battlefieldMorale);
      const hivePct = 100 - clanPct;
      clanFill.style.width = `${clanPct}%`;
      hiveFill.style.width = `${hivePct}%`;
      if (clanVal) clanVal.innerText = clanPct;
      if (hiveVal) hiveVal.innerText = hivePct;

      // Chantier 10: Vanguard Berserker Frenzy Threshold at 80%+
      if (clanPct >= 80 && !this.vanguardFrenzyActive) {
        this.vanguardFrenzyActive = true;
        clanFill.classList.add('morale-frenzy');
        if (this.audio && this.audio.playWarhorn) this.audio.playWarhorn();
        if (this.audio && this.audio.playMoraleShiftPing) this.audio.playMoraleShiftPing();
        this.ui.showAnnouncement('🔥 FUREUR DE L\'AVANT-GARDE DU CLAN (MORAL >= 80%) : +25% VITESSE & +35% DÉGÂTS !');
      } else if (clanPct < 75 && this.vanguardFrenzyActive) {
        this.vanguardFrenzyActive = false;
        clanFill.classList.remove('morale-frenzy');
        this.ui.showAnnouncement('⚠️ ÉQUILIBRE DU CLAN NORMALISÉ : PRESSION XENOMORPHE ACCRUE');
      }
    }
  }

  onCombatDeath(event) {
    if (!this.isPlaying || event.runId !== this.missionRun || this._rewardedDeaths.has(event.id)) return;
    this._rewardedDeaths.add(event.id);
    this.battleSimulation?.recordDeath(event);
    const unit = this.battleSimulation?.getUnit(event.entityId);
    this.operationObjectives?.recordEvent({ ...event, type: 'unit_died', uniqueId: unit?.uniqueId });
    this.observeBattleCampaign();
    if (event.objectiveCredit === false || ['player_clan', 'clan', 'allied_yautja'].includes(event.factionId) || event.creditPlayer === false) return;
    if (this.battleSimulation && event.killerFaction && !['yautja', 'player_clan', 'clan'].includes(event.killerFaction) && this.battleSimulation.relationship(event.killerFaction, this.battleSimulation.config.playerFaction) !== 'allied') return;
    const reward=combatRewardIdentity(this,event);
    if((this.forge.honorLedger?.hasTransaction(reward.id)||this.forge.honorLedger?.hasPendingReward?.(reward.id)))return;
    this._sessionDefeats = (this._sessionDefeats ?? 0) + 1;
    this.score += event.scoreValue ?? 150;
    this.comboHits++; this.comboTimer = 2.5;
    this.forge.honorLedger?.earn({ ...reward, amount: event.honorValue ?? 100, kind: 'combat', trophy: event.trophyName });
    if (this.player) this.player.musouEnergy = Math.min(this.player.maxMusouEnergy, this.player.musouEnergy + 6);
    this.ui.showCombo(this.comboHits);
    this.checkAnnouncerMilestones();
  }

  registerHits(hits) {
    (hits ?? []).forEach(h => {
      if (!h || typeof h !== 'object' || this._processedHitRecords.has(h)) return;
      this._processedHitRecords.add(h);
      if (h.killed) {
        const event = h.event ?? h.combatDeathEvent;
        if (event?.id && this._registeredDeathHits.has(event.id)) return;
        if (event?.id) this._registeredDeathHits.add(event.id);
      } else {
        this.comboHits++;
        this.comboTimer = 2.5;
        this.score += 25;
        this.player.musouEnergy = Math.min(this.player.maxMusouEnergy, this.player.musouEnergy + 2);
      }

      // QA Audit #3 (Karim): Diegetic Yautja targeting computer hitmarker feedback
      if (this.audio && this.audio.playDiegeticHitmarker) {
        this.audio.playDiegeticHitmarker(h.killed || h.isOfficer);
      }

      // Shift Morale: Kills favor Yautja Clan
      if (h.killed) {
        if (h.isOfficer) {
          // Defeating an officer swings battlefield morale dramatically!
          this.shiftBattlefieldMorale(12.0);
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          const title = h.officerTitle || 'PRAETORIAN ROYAL GUARD';
          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(title);
          } else {
            this.ui.showAnnouncement(`⚔️ OFFICIER VAINCU : ${title} PURGÉ ! ÉQUILIBRE DU CLAN +12% !`);
          }
          this.triggerCameraShake(0.8, 0.45);
        } else {
          this.shiftBattlefieldMorale(0.4);
        }
      }

      if (h.pos) {
        this.particles.emitBlood(h.pos, 8, true);
        this.particles.spawnDamagePopup(h.pos, h.damage, h.killed);
      }
    });

    this.ui.showCombo(this.comboHits);
    if (this.env && this.player) {
      this.env.checkTransformerHits(this.player.position, 3.8, this.synthetics, this.horde, this.audio, this.particles);
      this.env.checkBlastDoorHits(this.player.position, 3.8, 140, this.audio, this.particles);
      this.env.checkFuelLineDamage(this.player.position, 3.8, 75, this.audio, this.particles, this.ui);
    }
    this.checkAnnouncerMilestones();
  }

  checkAnnouncerMilestones() {
    const kos = this._sessionDefeats ?? this.horde.deadCount;
    const milestones = [
      { count: 50, msg: "50 ÉLIMINATIONS CONFIRMÉES — SÉRIE DE COMBAT !" },
      { count: 100, msg: "100 ÉLIMINATIONS CONFIRMÉES — ASSAUT SOUTENU !" },
      { count: 250, msg: "250 ÉLIMINATIONS CONFIRMÉES — PERFORMANCE REMARQUÉE !" },
      { count: 500, msg: "500 ÉLIMINATIONS CONFIRMÉES — RECORD DE MISSION !" },
      { count: 1000, msg: "1000 ÉLIMINATIONS CONFIRMÉES — EXPLOIT DE COMBAT !" }
    ];

    milestones.forEach(m => {
      if (kos >= m.count && !this.announcedMilestones[m.count]) {
        this.announcedMilestones[m.count] = true;
        this.ui.showAnnouncement(m.msg);
        if (this.audio && this.audio.playMusouKOCallout) {
          this.audio.playMusouKOCallout();
        } else {
          this.audio.playAnnouncerTone();
        }
      }
    });
  }

  updateInsertionStatus() {
    const panel = document.getElementById('insertion-status');
    if (!panel) return;
    const active = Boolean(this.dropPod.isActive);
    panel.classList.toggle('hidden', !active);
    document.getElementById('in-game-hud')?.classList.toggle('insertion-active', active);
    if (!active) {
      this._insertionPhase = null;
      return;
    }
    const phases = {
      descending: ['INSERTION ORBITALE', 'Capsule en approche'],
      settling: ['CONTACT AU SOL', 'Stabilisation de la capsule'],
      opening: ['OUVERTURE DE LA CAPSULE', 'Déverrouillage des portes'],
      exiting: ['DÉPLOIEMENT DU CHASSEUR', 'Sortie de la capsule'],
    };
    if (this._insertionPhase !== this.dropPod.phase) {
      this._insertionPhase = this.dropPod.phase;
      const [title, detail] = phases[this.dropPod.phase] ?? phases.descending;
      document.getElementById('insertion-title').textContent = title;
      document.getElementById('insertion-detail').textContent = `${detail} · Commandes après la sortie`;
    }
    document.getElementById('insertion-progress').style.transform = `scaleX(${Math.max(0, Math.min(1, this.dropPod.progress ?? 0))})`;
  }

  updateInsertionPresentation(delta, snap = false) {
    if (!this.dropPod.isActive) return;
    const cameras = [this.renderer.camera, this.renderer.cameraP2];
    this._insertionCameraFocus ??= [];
    const alpha = snap ? 1 : 1 - Math.exp(-8 * delta);
    for (let index = 0; index < (this.player2 ? 2 : 1); index++) {
      const target = this.dropPod.getCameraTarget?.(index) ?? (index ? this.player2 : this.player).position;
      const focus = this._insertionCameraFocus[index] ??= target.clone();
      focus.lerp(target, alpha);
      const position = focus.clone().add(new THREE.Vector3(8, 5, 14));
      cameras[index].position.lerp(position, alpha);
      cameras[index].lookAt(focus);
    }
    this.updateInsertionStatus();
  }

  update(delta) {
    if (!this.isPlaying || !this.player || this.isPaused) return;

    if (this.photoMode.isActive || this.weaponWheel.isOpen) return;

    if (this.dropPod.isActive) {
      this.weather.update?.(delta);
      this.dropPod.update(delta);
      this.updateInsertionPresentation(delta);
      this.env.updateBattlefieldVisibility?.([this.player, this.player2].filter(Boolean));
      this.particles.update(delta, this.renderer.camera);
      this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score,{supports:{apc:this.apc.getSupportState(),cheyenne:this.dropship.getSupportState()}});
      this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));
      return;
    }

    // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Time-Dilation (0.28x Slow-Motion)
    if (this.bulletTimeTimer > 0) {
      this.bulletTimeTimer -= delta;
      delta *= 0.28;
    }

    // Chantier 6 (v51.0): Tactical Weapon Wheel Time Dilation (0.15x Slow-Motion)
    if (this.isTimeDilated) {
      delta *= 0.15;
    }

    this.updateMissionTasks(delta);
    this.dropPod.update?.(delta);
    this.combatDirector.update(delta, [this.player, this.player2].filter(player => player?.hp > 0));
    this.updateBattleOperation(delta);
    if (!this.isPlaying) return;


    const qtePrompt = document.getElementById('facehugger-qte-prompt');
    if (qtePrompt) {
      if (this.player.isFacehuggerLatched) {
        qtePrompt.classList.remove('hidden');
      } else {
        qtePrompt.classList.add('hidden');
      }
    }

    this.gamepadBridge.updateGameplay(delta);
    const moveDirP1 = new THREE.Vector3();
    if (this.keys['KeyW']) moveDirP1.z -= 1;
    if (this.keys['KeyS']) moveDirP1.z += 1;
    if (this.keys['KeyA']) moveDirP1.x -= 1;
    if (this.keys['KeyD']) moveDirP1.x += 1;
    const keyboardP1=moveDirP1.lengthSq()>0, analogP1=this.gamepadBridge.movement(0);
    moveDirP1.x+=analogP1.x;moveDirP1.z-=analogP1.y;
    if ((!this.skimmer.isMounted||this.operationTransport?.driver===this.player2) && !this.player.isDodging && this.player.hp > 0) this.player.move(moveDirP1, delta*this.gamepadBridge.movementScale(0,keyboardP1)*this.gamepadBridge.speedScale(0));
    this.gamepadBridge.applyAim(0);
    this.env.resolveMovement?.(this.player.position);
    this.dropPod.resolveMovement?.(this.player.position);
    this.apc.resolveMovement?.(this.player.position);
    this.player.mesh.position.copy(this.player.position);
    if (this.player.hp > 0) this.player.update(delta, this.horde);
    else this.player.updateDefeatedEffects(delta);
    this.weather.setFocus?.(this.player.hp > 0 ? this.player.position : (this.player2?.position ?? this.player.position));

    // Karim QA Audit #3: Dynamic Surface Footstep Synthesizer (Metal Catwalk, Water Basin, Ash)
    this._footstepClock = Math.max(0, (this._footstepClock ?? 0) - delta);
    if (moveDirP1.lengthSq() > 0.01 && this._footstepClock === 0 && this.audio && this.audio.playFootstepSurface) {
      this._footstepClock = this.player.isSprinting ? .24 : .38;
      let surf = 'metal';
      if (this.env && this.env.aurigaBasin) {
        const dx = Math.abs(this.player.position.x - this.env.aurigaBasin.pos.x);
        const dz = Math.abs(this.player.position.z - this.env.aurigaBasin.pos.z);
        if (dx <= 9.0 && dz <= 7.0) surf = 'water';
      }
      this.audio.playFootstepSurface(surf);
    }

    // Chantier 7 (v44): Sustained Yautja Burner / Incinerator Plasma Flamer Mode
    if (this.player.isFlamerActive) {
      this.player.firePlasmaFlamer(delta, this.horde, this.env, this.particles);
    }

    // Chantier 5 (v47): USCM M41A Underbarrel 30mm HEDP Grenades Flight & Detonation
    if (this.player && this.player.updateM41AGrenades) {
      this.player.updateM41AGrenades(delta, this.horde, this.bosses, this.synthetics, this.env, this.particles);
    }

    // Chantier 1 (v48): Yautja Scout Ship Stratospheric Thermal Beam Strike
    if (this.player && this.player.updateScoutShipBeam) {
      this.player.updateScoutShipBeam(delta, this.horde, this.bosses, this.synthetics, this.particles);
    }

    // Chantier 5 (v49.0): Tracker Predator Biomechanical Sonic Trap Mine Countdown & Acoustic Implosion
    if (this.player && this.player.updateSonicTraps) {
      this.player.updateSonicTraps(delta, this.horde, this.bosses, this.particles);
    }

    // Chantier 6 (v50.0): Dual Plasma Casters Concentrated Overcharge Beam & Napalm Clusters
    if (this.player && this.player.updateDualPlasmaBeam) {
      this.player.updateDualPlasmaBeam(delta, this.horde, this.bosses, this.particles);
    }

    // QA Audit #3 (Karim): Critical Low Health Bio-Telemetry Heartbeat Beep
    if (this.player && this.player.hp > 0 && this.player.hp <= (this.player.maxHp || 1000) * 0.25) {
      this.lowHealthBeepTimer = (this.lowHealthBeepTimer || 0) + delta;
      if (this.lowHealthBeepTimer >= 1.25) {
        this.lowHealthBeepTimer = 0;
        if (this.audio && this.audio.playCriticalLowHealthBeep) {
          this.audio.playCriticalLowHealthBeep();
        }
      }
    } else {
      this.lowHealthBeepTimer = 0;
    }

    // Chantier 6 & 9 (v47) + Chantier 4, 5 & 9 (v48) + Chantier 3, 4 & 9 (v49) Interactive Stations
    if (this.env) {
      if (this.env.updateCoolingTowerCryoVent) {
        this.env.updateCoolingTowerCryoVent(delta, this.player, this.horde, this.bosses, this.particles, this.audio);
      }
      if (this.env.updateMutagenPuddles) {
        this.env.updateMutagenPuddles(delta, this.player, this.horde, this.audio);
      }
      if (this.env.updateMoltenLeadFoundry) {
        this.env.updateMoltenLeadFoundry(delta, this.player, this.horde, this.bosses, this.particles);
      }
      if (this.env.updateReprogrammedAndroids) {
        this.env.updateReprogrammedAndroids(delta, this.player, this.horde, this.bosses, this.audio, this.particles);
      }
      if (this.env.updateVolcanicAshStorm) {
        this.env.updateVolcanicAshStorm(delta, this.player, this.audio, this.ui);
      }
      if (this.env.updateUSCMMissileBattery) {
        this.env.updateUSCMMissileBattery(delta, this.horde, this.bosses, this.audio, this.particles);
      }
      if (this.env.updateAurigaFloodedBasin) {
        this.env.updateAurigaFloodedBasin(delta, this.player, this.horde, this.bosses, this.particles);
      }
      if (this.env.updateAncientShrine) {
        this.env.updateAncientShrine(delta, this.player, this.horde);
      }
      // v50.0 Interactive Systems (155mm Coastal Rail-Cannon, Cryo-Stasis Lab)
      if (this.env.updateCoastalRailCannon) {
        this.env.updateCoastalRailCannon(delta, this.horde, this.bosses, this.audio, this.particles);
      }
      if (this.env.updateCryoStasisSector) {
        this.env.updateCryoStasisSector(delta, this.player, this.horde, this.particles);
      }
      // v51.0 Chantier 7: Pressurized Acid Geysers
      if (this.env.updatePressurizedAcidGeysers) {
        this.env.updatePressurizedAcidGeysers(delta, this.player, this.horde, this.bosses, this.audio, this.particles);
      }
      // Chantier 5 & Sofia QA (v52.0): Hydraulic Cargo Lift & Subterranean Infiltration Vents
      if (this.env.updateHydraulicCargoLift) {
        this.env.updateHydraulicCargoLift(delta, this.player);
      }
      if (this.env.updateSubterraneanVents) {
        this.env.updateSubterraneanVents(delta, this.horde, this.particles, this.audio);
      }
      // Chantier 5 & Sofia QA (v53.0): Weyland-Yutani Breakable Specimen Stasis Vats & Cryo Clouds
      if (this.env.updateStasisTanks) {
        this.env.updateStasisTanks(delta, this.player, this.horde, this.audio, this.particles);
      }
      // Chantier 3, 4, 5 & v56.0 Master Level Design Systems
      if (this.env.updateLevelDesignV56) {
        this.env.updateLevelDesignV56(delta, this.player, this.horde, this.bosses, this.audio, this.particles, this.ui);
      } else if (this.env.updateEnvironmentV55) {
        this.env.updateEnvironmentV55(delta, this.player, this.horde, this.audio, this.particles, this.ui);
      } else if (this.env.updateEnvironmentV54) {
        this.env.updateEnvironmentV54(delta, this.player, this.horde, this.audio, this.particles);
      }
    }

    // Chantier 5 & Marc UI QA (v54.0): Yautja Biometric ECG Holoscan & Z-01 Embryo Monitor
    if (this.player) {
      const bpmElem = document.getElementById('wrist-ecg-bpm');
      if (bpmElem) {
        const hpRatio = this.player.hp / (this.player.maxHp || 1000);
        const bpm = Math.round(72 + (1 - hpRatio) * 85 + (this.player.isSprinting ? 28 : 0));
        bpmElem.innerText = `${bpm} BPM`;
        bpmElem.style.color = bpm > 130 ? '#ef4444' : (bpm > 100 ? '#f59e0b' : '#38bdf8');
      }
      const bloodedBadge = document.getElementById('wrist-blooded-badge');
      if (bloodedBadge) {
        if (this.player.isBloodedWarrior) {
          bloodedBadge.innerText = 'GUERRIER MARQUÉ (BLOODED) ⚜️';
          bloodedBadge.className = 'badge-blooded';
        } else {
          bloodedBadge.innerText = 'INITIÉ';
          bloodedBadge.className = 'badge-unblooded';
        }
      }
      const embryoElem = document.getElementById('wrist-embryo-scan');
      if (embryoElem) {
        if (this.player.isChestbursterImplanted) {
          embryoElem.innerText = '⚠️ ALERTE EMBRYON Z-01 EN INCUBATION VISCÉRALE !';
          embryoElem.className = 'embryo-warning';
        } else {
          embryoElem.innerText = 'AUCUN CORPUS PARASITE DÉTECTÉ';
          embryoElem.className = 'embryo-clean';
        }
      }

      // Trophy chain rattle sound when dashing or sprinting (Karim Audio QA)
      this._chainClock = Math.max(0,(this._chainClock ?? 0)-delta);
      if (this.player.isSprinting && this._chainClock === 0) {
        this._chainClock = .65;
        this.player.triggerTrophyChainRattle(this.audio);
      }
    }

    if (this.isCoOp && this.player2) {
      const moveDirP2 = new THREE.Vector3();
      if (this.keys['ArrowUp']) moveDirP2.z -= 1;
      if (this.keys['ArrowDown']) moveDirP2.z += 1;
      if (this.keys['ArrowLeft']) moveDirP2.x -= 1;
      if (this.keys['ArrowRight']) moveDirP2.x += 1;
      const keyboardP2=moveDirP2.lengthSq()>0,analogP2=this.gamepadBridge.movement(1);
      moveDirP2.x+=analogP2.x;moveDirP2.z-=analogP2.y;
      if (!this.operationTransport?.isPassenger(this.player2) && !this.player2.isDodging && this.player2.hp > 0) this.player2.move(moveDirP2, delta*this.gamepadBridge.movementScale(1,keyboardP2)*this.gamepadBridge.speedScale(1));
      this.gamepadBridge.applyAim(1);
      this.env.resolveMovement?.(this.player2.position);
      this.dropPod.resolveMovement?.(this.player2.position);
      this.apc.resolveMovement?.(this.player2.position);
      this.player2.mesh.position.copy(this.player2.position);
      if (this.player2.hp > 0) this.player2.update(delta, this.horde);
      else this.player2.updateDefeatedEffects(delta);

      const cam2Target = this.player2.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.cameraP2.position.lerp(cam2Target, 5 * delta);
      this.renderer.cameraP2.lookAt(this.player2.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }
    this.env.updateBattlefieldVisibility?.([this.player, this.player2].filter(player => player?.hp > 0));

    const livingTarget = this.player.hp > 0 ? this.player : (this.player2 ?? this.player);
    this.hellHounds.update(delta, livingTarget, this.horde);
    this.synthetics.update(delta, livingTarget, this.horde);
    this.dropship.update(delta, this.horde);
    this.apc.update(delta, this.horde, this.bosses);
    this.sentryGun.update(delta, this.horde);
    this.falconDrone.update(delta, this.player.position, this.horde);
    const driver=this.operationTransport?.driver??this.player,driverIndex=driver===this.player2?1:0;
    const analogDrive=this.gamepadBridge.moves[driverIndex];
    const drivingKeys={...this.keys,KeyW:this.keys.KeyW||analogDrive.y>.2,KeyS:this.keys.KeyS||analogDrive.y<-.2,KeyA:this.keys.KeyA||analogDrive.x<-.2,KeyD:this.keys.KeyD||analogDrive.x>.2,ShiftLeft:this.keys.ShiftLeft||this.gamepadBridge.vehicleFire?.[driverIndex]};
    if(!this.operationTransport?.update(delta,driver,drivingKeys))this.skimmer.update(delta,driver,this.horde,drivingKeys);
    if (this.skimmer.isMounted) {
      this.env.resolveMovement?.(this.skimmer.position, 1.2);
      this.dropPod.resolveMovement?.(this.skimmer.position, 2);
      this.apc.resolveMovement?.(this.skimmer.position, 2);
      this.skimmer.mesh.position.copy(this.skimmer.position);
      this.player.position.copy(this.skimmer.position);
    }
    this.env.resolveMovement?.(this.player.position);
    this.dropPod.resolveMovement?.(this.player.position);
    this.apc.resolveMovement?.(this.player.position);
    this.player.mesh.position.copy(this.player.position);
    this.orbital.update(delta);
    if (this.weather) this.weather.update(delta, this.player ? this.player.position : null, this.renderer, this.audio, this.horde);
    if (this.env) this.env.update(delta, this.horde, this.audio, this.player);
    const tacticalPrompt=document.getElementById('tactical-world-prompt'),tacticalText=this.env.getTacticalWorldPrompt?.(this.player);
    tacticalPrompt?.classList.toggle('hidden',!tacticalText);if(tacticalPrompt&&tacticalText)tacticalPrompt.textContent=tacticalText;
    if (this.renderer) this.renderer.update(delta);
    if (this.citadel) this.citadel.update(delta);

    // Update Engineer Black Pathogen Pools (Prometheus 2012)
    if (this.pathogenCooldown > 0) this.pathogenCooldown -= delta;
    for (let i = this.pathogenPools.length - 1; i >= 0; i--) {
      const p = this.pathogenPools[i];
      p.life -= delta;

      if (this.horde) {
        this.horde.checkMeleeHits({ origin: p.pos, radius: 4.2, damage: p.damage * delta, type: 'pathogen' });
      }
      if (this.synthetics) {
        this.synthetics.checkHits({ origin: p.pos, radius: 4.2, damage: p.damage * delta });
      }
      if (p.life <= 0) {
        this.removeEffectMesh(p.urnMesh);
        this.removeEffectMesh(p.poolMesh);
        this.pathogenPools.splice(i, 1);
      }
    }

    // Update Holographic Decoys (Hunting Grounds Canon)
    for (let i = this.holoDecoys.length - 1; i >= 0; i--) {
      const d = this.holoDecoys[i];
      d.life -= delta;
      d.mesh.position.addScaledVector(d.direction, d.speed * delta);
      d.update?.(delta);

      // Lure horde aggro towards decoy
      if (this.horde && this.horde.aliens) {
        this.horde.aliens.forEach(a => {
          if (a && a.mesh && a.mesh.position.distanceTo(d.mesh.position) < 18.0) {
            const lureDir = d.mesh.position.clone().sub(a.mesh.position).normalize();
            a.mesh.position.addScaledVector(lureDir, 3.5 * delta);
          }
        });
      }

      if (d.life <= 0) {
        this.audio.playHoloDecoyDetonate();
        this.particles.emitSparks(d.mesh.position, 25);
        if (this.horde) {
          this.horde.checkMeleeHits({ origin: d.mesh.position, radius: 8.0, damage: 280, type: 'heavy' });
        }
        this.removeHoloDecoy(d);
        this.holoDecoys.splice(i, 1);
      }
    }

    // Camera positioning: First-Person Bio-Mask vs 3rd Person
    if (this.isFirstPerson) {
      const eyeHeight = this.player.cameraEyeHeight ?? this.player.headMesh?.position.y ?? 3.6;
      const eyePos = this.player.position.clone().add(new THREE.Vector3(0, eyeHeight, 0.2));
      this.renderer.camera.position.lerp(eyePos, 1 - Math.exp(-15 * delta));
      const lookTarget = eyePos.clone().add(new THREE.Vector3(
        Math.sin(this.player.rotationY) * 10,
        this.player.isPerched ? -4 : 0,
        Math.cos(this.player.rotationY) * 10
      ));
      this.renderer.camera.lookAt(lookTarget);
    } else {
      const camTarget = this.player.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.camera.position.lerp(camTarget, 5 * delta);
      this.renderer.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    // Apply Musou Camera Shake
    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer -= delta;
      const shakeAmt = this.cameraShakeIntensity * Math.min(1.0, this.cameraShakeTimer / 0.35) * (document.body.classList.contains('reduced-flashes')?.25:1);
      this.renderer.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.renderer.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.renderer.camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    // Apply Musou FOV Surge & Elastic Snapback
    if(!this.isFirstPerson){const anchor=this.player.position.clone().add(new THREE.Vector3(0,2,0));this.renderer.camera.position.copy(resolveThirdPersonCamera(anchor,this.renderer.camera.position,this.env,{radius:cameraNearPlaneRadius(this.renderer.camera)}).position);this.renderer.camera.lookAt(anchor);}
    if(this.player2){const anchor=this.player2.position.clone().add(new THREE.Vector3(0,2,0));this.renderer.cameraP2.position.copy(resolveThirdPersonCamera(anchor,this.renderer.cameraP2.position,this.env,{radius:cameraNearPlaneRadius(this.renderer.cameraP2)}).position);this.renderer.cameraP2.lookAt(anchor);}

    if (this.cameraFovTimer > 0) {
      this.cameraFovTimer -= delta;
      const t = Math.max(0, this.cameraFovTimer / (this.cameraFovDuration || 0.6));
      this.renderer.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.targetCameraFov, Math.sin(t * Math.PI));
      this.renderer.camera.updateProjectionMatrix();
    } else if (this.renderer.camera.fov !== this.baseFov) {
      this.renderer.camera.fov = this.baseFov;
      this.renderer.camera.updateProjectionMatrix();
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      if (p.projectileKind!=='taabe_arrow' && p.direction?.isVector3 && Number.isFinite(p.speed)) {
        const end=p.mesh.position.clone().addScaledVector(p.direction,p.speed*delta);
        const wall=this.env.traceSegment?.(p.mesh.position,end,{radius:p.projectileKind === 'feral_bolt' ? .06 : .18});
        if(wall){for(const[id]of this.env.tacticalBridges??[])if(wall.collider.owner===id||wall.collider.owner===`${id}-support`)this.env.damageTacticalBridge(id,p.damage,'projectile');this.particles.emitSparks(wall.point,6);this.removeEffectMesh(p.mesh);this.projectiles.splice(i,1);continue;}
      }

      // Alien: Romulus Zero-G Acid Globule Vaporization
      if (this.horde && this.horde.zeroGAcidGlobules) {
        for (let g = this.horde.zeroGAcidGlobules.length - 1; g >= 0; g--) {
          const glob = this.horde.zeroGAcidGlobules[g];
          if (glob && glob.mesh && glob.mesh.position.distanceTo(p.mesh.position) <= 2.2) {
            this.particles.emitSparks(glob.mesh.position, 8);
            if (this.audio && this.audio.playAcidGlobuleHiss) this.audio.playAcidGlobuleHiss();
            this.renderer.scene.remove(glob.mesh);
            this.horde.zeroGAcidGlobules.splice(g, 1);
            break;
          }
        }
      }

      if (p.isSmartDisc) {
        p.progress += p.speed * delta;
        p.mesh.rotation.z += 25 * delta; // Rapid slicing gyro-spin

        // Chantier 4: Periodic high-frequency gyro slicing rotor hum
        p.rotorTimer = (p.rotorTimer || 0) + delta;
        if (p.rotorTimer >= 0.22) {
          p.rotorTimer = 0;
          if (this.audio && this.audio.playSmartDiscRotor) this.audio.playSmartDiscRotor();
        }

        // Multi-Target Waypoint Chain or Quadratic Bezier Curve (Predator 2 Canon)
        let currentPos;
        const playerCurrentHand = (p.owner??this.player).position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));

        if (p.waypoints && p.waypoints.length > 0) {
          const pts = [p.startPos, ...p.waypoints, playerCurrentHand];
          const totalSegments = pts.length - 1;
          const scaledT = Math.min(0.999, p.progress) * totalSegments;
          const segIdx = Math.floor(scaledT);
          const segT = scaledT - segIdx;
          const pA = pts[segIdx];
          const pB = pts[segIdx + 1];
          currentPos = pA.clone().lerp(pB, segT);
        } else {
          const t = Math.min(1.0, p.progress);
          const p0 = p.startPos;
          const p1 = p.apexPos;
          const p2 = playerCurrentHand;
          currentPos = new THREE.Vector3(
            (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
            (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
            (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z
          );
        }
        const discWall=this.env.traceSegment?.(p.mesh.position,currentPos,{radius:.15});
        if(discWall){this.particles.emitSparks(discWall.point,6);this.removeEffectMesh(p.mesh);this.projectiles.splice(i,1);continue;}
        p.mesh.position.copy(currentPos);

        if (this.env) {
          this.env.checkTransformerHits(p.mesh.position, 2.2, this.synthetics, this.horde, this.audio, this.particles);
          this.env.checkBlastDoorHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkCraneCableHit(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
          this.env.checkEggClusterHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
          this.env.checkSteamConduitHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkOvipositorHit(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde, this.bosses);
          this.env.checkNitrogenTankHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkWebbingDamage(p.mesh.position, 2.2, p.damage, this.particles);
          this.env.checkCryoTubeHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
          if (this.env.checkAmmoniaPipeDamage) {
            this.env.checkAmmoniaPipeDamage({ origin: p.mesh.position, radius: 2.2, damage: p.damage }, this.audio, this.particles, this.horde);
          }
          if (this.env.checkWaterTowerDamage) {
            this.env.checkWaterTowerDamage({ origin: p.mesh.position, radius: 2.2, damage: p.damage }, this.audio, this.particles, this.horde, this.synthetics);
          }
          if (this.env.checkGunnisonPowerPoleDamage) {
            this.env.checkGunnisonPowerPoleDamage(p.mesh.position, p.damage, this.audio, this.horde, this.particles, this.ui);
          }
          if (this.env.checkBoulderDeadfallDamage) {
            this.env.checkBoulderDeadfallDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkDutchLogTrapTrigger) {
            this.env.checkDutchLogTrapTrigger(p.mesh.position, true, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkHVACChillerDamage) {
            this.env.checkHVACChillerDamage(p.mesh.position, p.damage, this.audio, this.horde, this.particles, this.ui);
          }
          if (this.env.checkRebelFuelBarrelsDamage) {
            this.env.checkRebelFuelBarrelsDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkFlareTripwireTrigger) {
            this.env.checkFlareTripwireTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkNeonTransformerOverload) {
            this.env.checkNeonTransformerOverload(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkBoilingTarSpillDamage) {
            this.env.checkBoilingTarSpillDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkRoyceTripwireTrigger) {
            this.env.checkRoyceTripwireTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkMombassaPunjiTrapTrigger) {
            this.env.checkMombassaPunjiTrapTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkCryoNitrogenTankTrigger) {
            this.env.checkCryoNitrogenTankTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
        }

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
        if (hits.length > 0) {
          this.particles.emitSparks(p.mesh.position, 6);
          if (this.gore && this.gore.spawnDismemberment) {
            this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
          }
          this.registerHits(hits);
        }

        if (this.bosses && this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.particles.emitSparks(p.mesh.position, 8);
          if (this.gore && this.gore.spawnDismemberment) {
            this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
          }
        }

        if (this.synthetics) {
          const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
          if (synHits.length > 0) {
            this.particles.emitSparks(p.mesh.position, 6);
            if (this.gore && this.gore.spawnDismemberment) {
              this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
            }
          }
        }

        if (p.progress >= 1.0 || p.life <= 0) {
          // Returned to player hand
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
          this.audio.playShieldBlock();
        }
      } else if (p.isCombiStick) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage, type: 'combistick' });
        if (hits.length > 0) {
          hits.forEach((h) => {
            this.audio.playCombiStickImpale();
            this.particles.emitSparks(p.mesh.position, 8);
            if (h.killed && this.gore && this.gore.spawnWallPinnedPart) {
              this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'combistick');
            }
          });
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.audio.playCombiStickImpale();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.5, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playCombiStickImpale();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.isShuriken) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);
        p.mesh.rotation.y += 35 * delta;

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: p.radius || 3.0, damage: p.damage });
        if (hits.length > 0) {
          this.audio.playShurikenSlice();
          this.particles.emitSparks(p.mesh.position, 8);
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.audio.playShurikenSlice();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playShurikenSlice();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.isGuidedFlechette) {
        // Dynamic homing steering towards target or laser reticle
        if (p.target && p.target.mesh && p.target.hp > 0) {
          const targetPos = p.target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
          const steerDir = targetPos.sub(p.mesh.position).normalize();
          p.direction.lerp(steerDir, 9.0 * delta).normalize();
        }
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);
        p.mesh.lookAt(p.mesh.position.clone().add(p.direction));

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 1.8, damage: p.damage, type: 'flechette' });
        if (hits.length > 0 || p.life <= 0) {
          if (hits.length > 0) {
            this.audio.playFlechetteImpale();
            this.particles.emitSparks(p.mesh.position, 8);
            hits.forEach((h) => {
              if (h.killed && this.gore && this.gore.spawnWallPinnedPart && Math.random() < 0.5) {
                this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'arrow');
              }
            });
            this.registerHits(hits);
          }
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.projectileKind==='taabe_arrow') {
        if(this.advancePreyArrow(p,delta)){this.removeEffectMesh(p.mesh);this.projectiles.splice(i,1);}
      } else if (p.isChargedArrow) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage, type: 'arrow' });
        if (hits.length > 0) {
          this.audio.playArrowPinImpact();
          this.particles.emitSparks(p.mesh.position, 10);
          hits.forEach((h) => {
            if (h.killed && this.gore && this.gore.spawnWallPinnedPart) {
              this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'arrow');
            }
          });
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.hitBossFromPlayer(p.damage,p.attackOrigin??p.owner?.position??p.mesh.position,'charged',p.mesh.position);
          this.audio.playArrowPinImpact();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playArrowPinImpact();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        if (this.env) {
          if (this.env.checkWaterTowerDamage) {
            this.env.checkWaterTowerDamage({ origin: p.mesh.position, radius: 2.2, damage: p.damage }, this.audio, this.particles, this.horde, this.synthetics);
          }
          if (this.env.checkGunnisonPowerPoleDamage) {
            this.env.checkGunnisonPowerPoleDamage(p.mesh.position, p.damage, this.audio, this.horde, this.particles, this.ui);
          }
          if (this.env.checkBoulderDeadfallDamage) {
            this.env.checkBoulderDeadfallDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkDutchLogTrapTrigger) {
            this.env.checkDutchLogTrapTrigger(p.mesh.position, true, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkHVACChillerDamage) {
            this.env.checkHVACChillerDamage(p.mesh.position, p.damage, this.audio, this.horde, this.particles, this.ui);
          }
          if (this.env.checkRebelFuelBarrelsDamage) {
            this.env.checkRebelFuelBarrelsDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkFlareTripwireTrigger) {
            this.env.checkFlareTripwireTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkNeonTransformerOverload) {
            this.env.checkNeonTransformerOverload(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkBoilingTarSpillDamage) {
            this.env.checkBoilingTarSpillDamage(p.mesh.position, p.damage, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkRoyceTripwireTrigger) {
            this.env.checkRoyceTripwireTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkMombassaPunjiTrapTrigger) {
            this.env.checkMombassaPunjiTrapTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
          if (this.env.checkCryoNitrogenTankTrigger) {
            this.env.checkCryoNitrogenTankTrigger(p.mesh.position, this.audio, this.horde, this.bosses, this.particles, this.ui);
          }
        }

        if (p.isSuperCharged) {
          p.mesh.rotation.x += 12 * delta;
          p.mesh.rotation.y += 12 * delta;
          if (this.particles) this.particles.emitSparks(p.mesh.position, 2);

          const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 8.5, damage: p.damage, type: 'heavy' });
          if(this.bosses.activeBoss&&this.bosses.activeBoss.mesh.position.distanceTo(p.mesh.position)<=5){const event=this.hitBossFromPlayer(p.damage,p.attackOrigin??p.owner?.position??p.mesh.position,'charged',p.mesh.position);hits.push({damage:p.damage,pos:p.mesh.position.clone(),killed:Boolean(event),event});}
          if (hits.length > 0 || p.life <= 0) {
            this.particles.emitSparks(p.mesh.position, 35);
            if(p.projectileKind!=='feral_bolt')this.particles.spawnPlasmaScorch(p.mesh.position);
            this.triggerCameraShake(1.0, 0.45);
            if (this.audio && this.audio.playC6CataclysmBoom) this.audio.playC6CataclysmBoom();
            this.removeEffectMesh(p.mesh);
            this.projectiles.splice(i, 1);
            if (hits.length > 0) this.registerHits(hits);
          }
        } else {
          const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
          hits.push(...this.synthetics.checkHits({origin:p.mesh.position,radius:2.2,damage:p.damage}));
          if(this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(p.mesh.position)<=3){const event=this.hitBossFromPlayer(p.damage,p.attackOrigin??p.owner?.position??p.mesh.position,'projectile',p.mesh.position);hits.push({damage:p.damage,pos:p.mesh.position.clone(),killed:Boolean(event),event});}
          this.operationWorld?.damageNear(this.operationObjectives,p.mesh.position,2.2,p.damage);
          if (hits.length > 0 || p.life <= 0) {
            this.particles.emitSparks(p.mesh.position, 10);
            if(p.projectileKind!=='feral_bolt')this.particles.spawnPlasmaScorch(p.mesh.position);
            this.removeEffectMesh(p.mesh);
            this.projectiles.splice(i, 1);
            if (hits.length > 0) this.registerHits(hits);
          }
        }
      }
    }

    this.badBlood.update(delta, livingTarget, this.ui, this.gore, this.particles, this);
    this.marines.update(delta, livingTarget, this.horde);
    this.allies.update(delta, livingTarget.position, this.horde);
    this.horde.update(delta, this.player, this.player2);
    this.bosses.update(delta, livingTarget, this.horde);
    this.battleBridge?.sync();
    for (const actor of [...this.horde.aliens, ...this.synthetics.androids, ...this.marines.marines, ...this.allies.allies, ...this.hellHounds.hounds, this.badBlood.badBlood, this.bosses.activeBoss].filter(Boolean)) {
      if (actor.mesh) {
        this.env.resolveMovement(actor.mesh.position, actor.radius ?? 1);
        this.dropPod.resolveMovement?.(actor.mesh.position, actor.radius ?? 1);
        this.apc.resolveMovement?.(actor.mesh.position, actor.radius ?? 1);
      }
    }
    this.battlefield?.update([this.player, this.player2].filter(Boolean));
    this.env.updateBattlefieldObjectives?.(this.battlefieldProgression, delta);
    this.gore.update(delta);
    this.particles.update(delta, this.renderer.camera);
    this.updateTargetLockReticle();

    // Sentry Gun Proximity HUD Prompt (Chantier 5)
    const isNearSentry = this.sentryGun && this.sentryGun.isDeployed && this.player && this.player.position.distanceTo(this.sentryGun.mesh.position) < 3.5;
    this.ui.updateSentryProximityPrompt(isNearSentry, this.sentryGun);

    // Trax-Net Wall-Penetrating Tracker HUD (Chantier 3)
    const traxTargets = [];
    if (this.horde && this.horde.aliens) traxTargets.push(...this.horde.aliens.filter(a => a && a.isTraxTagged));
    if (this.synthetics && this.synthetics.units) traxTargets.push(...this.synthetics.units.filter(s => s && s.isTraxTagged));
    if (this.bosses && this.bosses.activeBoss && this.bosses.activeBoss.isTraxTagged) traxTargets.push(this.bosses.activeBoss);
    this.ui.updateTraxNetTelemetry(traxTargets, this.renderer.camera, this.player);

    // Chantier 3 (v43): Smart-Disc Telemetric Remote Guidance Update
    if (this.player && this.player.isSmartDiscGuiding && this.player.guidedSmartDisc) {
      const cameraDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(cameraDir);
      this.player.updateSmartDiscRemoteGuidance(delta, cameraDir);
    }

    // Chantier 4 (v43): Fallen Marine Scavenge Proximity Prompt
    const nearMarine = this.env && this.env.fallenMarines && this.env.fallenMarines.find(m => !m.isScavenged && this.player && this.player.position.distanceTo(m.pos) <= 2.8);
    this.ui.updateMarineScavengePrompt(!!nearMarine, nearMarine);

    // Chantier 6 (v44): Caterpillar Power Loader Workstation Proximity Prompt
    const isNearLoader = this.env && this.env.powerLoader && this.player && this.player.position.distanceTo(this.env.powerLoader.pos) < 4.8;
    const loaderPrompt = document.getElementById('power-loader-prompt');
    if (loaderPrompt) {
      if (isNearLoader && this.env.powerLoader.clampCooldown <= 0) {
        loaderPrompt.classList.remove('hidden');
      } else {
        loaderPrompt.classList.add('hidden');
      }
    }

    // Chantier 2 (v45): Drivable USCM M577 APC Proximity Prompt
    const isNearAPC = this.env && this.env.drivableAPC && this.player && this.player.position.distanceTo(this.env.drivableAPC.pos) < 4.8;
    const apcPrompt = document.getElementById('apc-mount-prompt');
    if (apcPrompt) {
      if (isNearAPC) apcPrompt.classList.remove('hidden');
      else apcPrompt.classList.add('hidden');
    }

    // Chantier 3 (v45): Reactor Meltdown Console Proximity Prompt
    const isNearReactor = this.env && this.env.reactorConsole && this.player && this.player.position.distanceTo(this.env.reactorConsole.pos) < 4.2;
    const reactorPrompt = document.getElementById('reactor-console-prompt');
    if (reactorPrompt) {
      if (isNearReactor) reactorPrompt.classList.remove('hidden');
      else reactorPrompt.classList.add('hidden');
    }

    // Chantier 6 (v45): Electric Floor Grid Breaker Proximity Prompt
    const isNearGrid = this.env && this.env.electricFloorGrids && this.player && this.env.electricFloorGrids.some(g => !g.isActive && this.player.position.distanceTo(g.pos) < 5.0);
    const gridPrompt = document.getElementById('electric-grid-prompt');
    if (gridPrompt) {
      if (isNearGrid) gridPrompt.classList.remove('hidden');
      else gridPrompt.classList.add('hidden');
    }

    // Chantier 9 (v45): Med-Lab Decontamination Airlock Proximity Prompt
    const isNearDecon = this.env && this.env.deconAirlock && this.player && this.player.position.distanceTo(this.env.deconAirlock.pos) < 3.8;
    const deconPrompt = document.getElementById('decon-airlock-prompt');
    if (deconPrompt) {
      if (isNearDecon && this.env.deconAirlock.cooldown <= 0) deconPrompt.classList.remove('hidden');
      else deconPrompt.classList.add('hidden');
    }

    // Chantier 7 (v45): Ki'cte Gauntlet Grapple Availability Prompt
    const isNearGrappleTarget = this.player && this.player.grappleCooldown <= 0 && this.horde && this.horde.aliens && this.horde.aliens.some(a => a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(this.player.position) <= 3.5);
    const grapplePrompt = document.getElementById('grapple-prompt');
    if (grapplePrompt) {
      if (isNearGrappleTarget) grapplePrompt.classList.remove('hidden');
      else grapplePrompt.classList.add('hidden');
    }

    // USCM M314 Motion Tracker Proximity Sonar Ping
    let nearestDist = Infinity;
    this.horde.aliens.forEach(a => {
      const d = a.mesh.position.distanceTo(this.player.position);
      if (d < nearestDist) nearestDist = d;
    });
    this.closestEnemyDist = nearestDist;

    if (nearestDist < 25.0) {
      // Cadence accelerates as enemies close in: from 1.2s at 25m down to 0.18s at 3m
      const pingInterval = 0.18 + (nearestDist / 25.0) * 0.9;
      this.motionTrackerTimer += delta;
      if (this.motionTrackerTimer >= pingInterval) {
        this.motionTrackerTimer = 0;
        this.audio.playMotionTrackerPing(nearestDist);
      }
    }

    const boss = this.bosses.activeBoss;
    let subBossStunnedNearby = false;
    this.horde.aliens.forEach(a => {
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien' || a.isDeacon || a.isRogueKing || a.isRaven || a.isAncientPredalien) && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.8) {
          subBossStunnedNearby = true;
        }
      }
    });

    let syntheticHarvestNearby = false;
    if (this.synthetics && this.synthetics.androids) {
      this.synthetics.androids.forEach(syn => {
        if ((syn.isBisected || syn.isEMPStunned || syn.hp <= 120) && syn.mesh.position.distanceTo(this.player.position) <= 4.2) {
          syntheticHarvestNearby = true;
        }
      });
    }
    this.ui.showExecutionPrompt((boss && boss.isStunned && boss.hp <= boss.maxHp * .3 && boss.mesh.position.distanceTo(this.player.position) <= 8) || subBossStunnedNearby || syntheticHarvestNearby);

    // v46.0, v47.0, v48.0 & v49.0 Proximity Prompts & Diegetic Telemetry
    if (this.env && this.player) {
      const isNearSmartgun = this.env.mountedSmartgun && this.player.position.distanceTo(this.env.mountedSmartgun.pos) <= 3.2;
      this.ui.updateSmartgunPrompt(isNearSmartgun, this.player.isMountedSmartgun, this.env.mountedSmartgun);

      const isNearCrane = this.env.craneConsole && this.player.position.distanceTo(this.env.craneConsole.pos) <= 3.2;
      this.ui.updateCargoCranePrompt(isNearCrane, this.env.craneConsole);

      const isNearCryoVent = this.env.coolingTowerCryoVent && this.player.position.distanceTo(this.env.coolingTowerCryoVent.consolePos) <= 3.2;
      this.ui.updateCryoVentPrompt(isNearCryoVent, this.env.coolingTowerCryoVent);

      const isNearFoundry = this.env.moltenFoundry && this.player.position.distanceTo(this.env.moltenFoundry.valvePos) <= 4.5;
      if (this.ui.updateFoundryValvePrompt) {
        this.ui.updateFoundryValvePrompt(isNearFoundry, this.env.moltenFoundry);
      }

      // Chantier 4 (v49): USM Auriga Flooded Basin 50,000V Breaker Proximity Prompt
      const isNearAuriga = this.env.aurigaBasin && this.player.position.distanceTo(this.env.aurigaBasin.breakerPos) <= 4.2;
      const aurigaPrompt = document.getElementById('auriga-breaker-prompt');
      if (aurigaPrompt) {
        if (isNearAuriga && !this.env.aurigaBasin.isElectrified && this.env.aurigaBasin.cooldown <= 0) aurigaPrompt.classList.remove('hidden');
        else aurigaPrompt.classList.add('hidden');
      }

      // Chantier 9 (v49): Ancient Yautja Shrine of the Ancients Proximity Prompt
      const isNearShrine = this.env.ancientShrine && this.player.position.distanceTo(this.env.ancientShrine.pos) <= 4.5;
      const shrinePrompt = document.getElementById('ancient-shrine-prompt');
      if (shrinePrompt) {
        if (isNearShrine && this.env.ancientShrine.cooldown <= 0) shrinePrompt.classList.remove('hidden');
        else shrinePrompt.classList.add('hidden');
      }

      // Chantier 2 (v50.0): Coastal Defense 155mm Rail-Cannon Terminal Proximity Prompt
      const isNearCannon = this.env.coastalRailCannon && this.player.position.distanceTo(this.env.coastalRailCannon.terminalPos) <= 4.2;
      const cannonPrompt = document.getElementById('rail-cannon-prompt');
      if (cannonPrompt) {
        if (isNearCannon && this.env.coastalRailCannon.cooldown <= 0) cannonPrompt.classList.remove('hidden');
        else cannonPrompt.classList.add('hidden');
      }

      // Chantier 4 (v50.0): Cryo-Stasis Laboratory Specimen Pod Proximity Prompt
      const isNearCryoLab = this.env.cryoStasisSector && this.player.position.distanceTo(this.env.cryoStasisSector.consolePos) <= 4.2;
      const cryoLabPrompt = document.getElementById('cryo-stasis-pod-prompt');
      if (cryoLabPrompt) {
        if (isNearCryoLab && this.env.cryoStasisSector.cooldown <= 0) cryoLabPrompt.classList.remove('hidden');
        else cryoLabPrompt.classList.add('hidden');
      }

      const isInsideDerelict = this.env.derelictChamber && this.player.position.distanceTo(this.env.derelictChamber.center) <= this.env.derelictChamber.radius;
      this.ui.updateDerelictHud(isInsideDerelict);

      // QA Audit #2 (Elena): Diegetic Wrist Gauntlet Telemetry Update
      if (this.ui.updateDiegeticWristTelemetry) {
        this.ui.updateDiegeticWristTelemetry(this.player, this.env, this.isEndlessMode);
      }

      // Marc QA Audit #1: Dynamic Circular Combat Reticle Charge Update
      const reticleCharge = document.getElementById('reticle-charge-circle');
      if (reticleCharge && this.player) {
        const chargePct = this.player.isChargingPlasma ? Math.min(1.0, this.player.plasmaChargeTime / 0.55) : 0;
        reticleCharge.style.strokeDashoffset = `${100 - chargePct * 100}`;
      }

      // Chantier 10 (v51.0): Engineer Sarcophagus Awakening Prompt
      const isNearCrypt = this.env.engineerSarcophagus && !this.env.engineerSarcophagus.isAwakened && this.player && this.player.position.distanceTo(this.env.engineerSarcophagus.pos) <= 5.2;
      const cryptPrompt = document.getElementById('engineer-crypt-prompt');
      if (cryptPrompt) {
        if (isNearCrypt) cryptPrompt.classList.remove('hidden');
        else cryptPrompt.classList.add('hidden');
      }

      // Chantier 4 & Lucas QA: Counter-Riposte Ready Badge
      const riposteBadge = document.getElementById('counter-riposte-badge');
      if (riposteBadge) {
        if (this.player && this.player.isCounterRiposteReady && this.player.counterRiposteTimer > 0) {
          riposteBadge.classList.remove('hidden');
          riposteBadge.innerText = `⚡ RIPOSTE GUAN-THWEI PRÊTE : ${this.player.counterRiposteTimer.toFixed(1)}S (x4 DÉGÂTS)`;
        } else {
          riposteBadge.classList.add('hidden');
        }
      }

      // Chantier 5 & Sofia QA (v52.0): Hydraulic Cargo Lift Proximity Prompt
      const isNearLift = this.env.hydraulicCargoLift && this.player && this.player.position.distanceTo(this.env.hydraulicCargoLift.pos) <= 4.2;
      const liftPrompt = document.getElementById('hydraulic-lift-prompt');
      if (liftPrompt) {
        if (isNearLift) liftPrompt.classList.remove('hidden');
        else liftPrompt.classList.add('hidden');
      }

      // Marc QA (v56.0): Verticality Telemetry & Hunting Bough Altitude HUD
      const vertEl = document.getElementById('wrist-verticality-hud');
      if (vertEl && this.player) {
        const alt = Math.max(0, this.player.position.y).toFixed(1);
        const isElevated = this.player.isPerched || this.player.position.y >= 2.0;
        const isExtremeHeight = this.player.position.y >= 7.0;
        if (isExtremeHeight) {
          vertEl.innerText = `ALTITUDE: +${alt}m // AFFÛT EXTRÊME DE FAÇADE : DÉGÂTS SNIPER +50% ⚡`;
          vertEl.style.color = '#f59e0b';
        } else if (isElevated) {
          vertEl.innerText = `ALTITUDE: +${alt}m // AFFÛT TACTIQUE EN HAUTEUR : DÉGÂTS SNIPER +35% 🎯`;
          vertEl.style.color = '#38bdf8';
        } else {
          vertEl.innerText = `ALTITUDE: +${alt}m // AU SOL`;
          vertEl.style.color = '#94a3b8';
        }
      }

      // v56.0 Level Design Proximity Prompts
      const isNearScoutShip = this.env.crashedScoutShip && this.player && this.player.position.distanceTo(this.env.crashedScoutShip.consolePos) <= 4.2;
      const scoutPrompt = document.getElementById('scout-ship-prompt');
      if (scoutPrompt) {
        if (isNearScoutShip) scoutPrompt.classList.remove('hidden');
        else scoutPrompt.classList.add('hidden');
      }

      const isNearCharonLab = this.env.charonGeneticsLab && this.player && this.player.position.distanceTo(this.env.charonGeneticsLab.consolePos) <= 4.2;
      const charonPrompt = document.getElementById('charon-lab-prompt');
      if (charonPrompt) {
        if (isNearCharonLab) charonPrompt.classList.remove('hidden');
        else charonPrompt.classList.add('hidden');
      }

      const isNearFixedSentry = this.env.fixedSentryEmplacements && this.player && this.env.fixedSentryEmplacements.some(s => s.pos.distanceTo(this.player.position) <= 3.8);
      const sentryPrompt = document.getElementById('fixed-sentry-prompt');
      if (sentryPrompt) {
        if (isNearFixedSentry) sentryPrompt.classList.remove('hidden');
        else sentryPrompt.classList.add('hidden');
      }

      const isNearCrucified = this.env.gamePreserveCamp && !this.env.gamePreserveCamp.isReleased && this.player && this.player.position.distanceTo(this.env.gamePreserveCamp.totemPos) <= 4.8;
      const crucPrompt = document.getElementById('crucified-predator-prompt');
      if (crucPrompt) {
        if (isNearCrucified) crucPrompt.classList.remove('hidden');
        else crucPrompt.classList.add('hidden');
      }

      // v56.5 Sector Overhaul Proximity Prompts
      const isNearRadio = this.env.valVerdeProps && this.player && this.player.position.distanceTo(this.env.valVerdeProps.radioPos) <= 4.2;
      const radioPrompt = document.getElementById('valverde-radio-prompt');
      if (radioPrompt) {
        if (isNearRadio) radioPrompt.classList.remove('hidden');
        else radioPrompt.classList.add('hidden');
      }

      const isNearMud = this.env.mudPits && this.player && this.env.mudPits.some(p => p.pos.distanceTo(this.player.position) <= p.radius);
      const mudPrompt = document.getElementById('mud-pit-prompt');
      if (mudPrompt) {
        if (isNearMud) mudPrompt.classList.remove('hidden');
        else mudPrompt.classList.add('hidden');
      }

      const isNearAltar = this.env.pyramidSacrificial && this.player && this.player.position.distanceTo(this.env.pyramidSacrificial.daisPos) <= 4.5;
      const altarPrompt = document.getElementById('pyramid-altar-prompt');
      if (altarPrompt) {
        if (isNearAltar) altarPrompt.classList.remove('hidden');
        else altarPrompt.classList.add('hidden');
      }

      const isNearZeroG = this.env.romulusStationExpansion && this.player && this.player.position.distanceTo(this.env.romulusStationExpansion.consolePos) <= 4.2;
      const zeroGPrompt = document.getElementById('romulus-zerog-prompt');
      if (zeroGPrompt) {
        if (isNearZeroG) zeroGPrompt.classList.remove('hidden');
        else zeroGPrompt.classList.add('hidden');
      }

      const isNearRook = this.env.romulusStationExpansion && this.player && this.player.position.distanceTo(this.env.romulusStationExpansion.rookPos) <= 4.2;
      const rookPrompt = document.getElementById('rook-console-prompt');
      if (rookPrompt) {
        if (isNearRook) rookPrompt.classList.remove('hidden');
        else rookPrompt.classList.add('hidden');
      }

      const isNearJelly = this.env.harvestableRoyalJelly && this.player && this.env.harvestableRoyalJelly.some(n => !n.isHarvested && n.pos.distanceTo(this.player.position) <= 3.8);
      const jellyPrompt = document.getElementById('royal-jelly-node-prompt');
      if (jellyPrompt) {
        if (isNearJelly) jellyPrompt.classList.remove('hidden');
        else jellyPrompt.classList.add('hidden');
      }

      // v57.0 Sector Overhaul Proximity Prompts
      const isNearReliquary = this.env.cryptReliquaryVault && !this.env.cryptReliquaryVault.isOpened && this.player && this.player.position.distanceTo(this.env.cryptReliquaryVault.pos) <= 3.8;
      const cryptReliquaryPrompt = document.getElementById('crypt-reliquary-prompt');
      if (cryptReliquaryPrompt) {
        if (isNearReliquary) cryptReliquaryPrompt.classList.remove('hidden');
        else cryptReliquaryPrompt.classList.add('hidden');
      }

      const isNearInhibitor = this.env.neuralInhibitors && this.player && this.env.neuralInhibitors.some(p => p.pos.distanceTo(this.player.position) <= 4.2);
      const inhibitorPrompt = document.getElementById('neural-inhibitor-prompt');
      if (inhibitorPrompt) {
        if (isNearInhibitor) inhibitorPrompt.classList.remove('hidden');
        else inhibitorPrompt.classList.add('hidden');
      }

      const isNearBoulder = this.env.boulderTraps && this.player && this.env.boulderTraps.some(t => !t.isDropped && t.pegPos.distanceTo(this.player.position) <= 3.8);
      const boulderPrompt = document.getElementById('boulder-trap-prompt');
      if (boulderPrompt) {
        if (isNearBoulder) boulderPrompt.classList.remove('hidden');
        else boulderPrompt.classList.add('hidden');
      }

      const isNearDutchLog = this.env.dutchLogTrap && !this.env.dutchLogTrap.isTriggered && this.player && this.player.position.distanceTo(this.env.dutchLogTrap.triggerPos) <= 3.8;
      const dutchLogPrompt = document.getElementById('dutch-log-trap-prompt');
      if (dutchLogPrompt) {
        if (isNearDutchLog) dutchLogPrompt.classList.remove('hidden');
        else dutchLogPrompt.classList.add('hidden');
      }

      // v58.0 Predator 1 (1987) Val Verde Proximity Prompts
      const isNearBilly = this.env.billyLogBridge && !this.env.billyLogBridge.isClaimed && this.player && this.player.position.distanceTo(this.env.billyLogBridge.machetePos) <= 4.2;
      const billyPrompt = document.getElementById('billy-machete-prompt');
      if (billyPrompt) {
        if (isNearBilly) billyPrompt.classList.remove('hidden');
        else billyPrompt.classList.add('hidden');
      }

      const isNearHopper = this.env.hopperExecutionSite && !this.env.hopperExecutionSite.isClaimed && this.player && this.player.position.distanceTo(this.env.hopperExecutionSite.satchelPos) <= 4.2;
      const hopperPrompt = document.getElementById('hopper-satchel-prompt');
      if (hopperPrompt) {
        if (isNearHopper) hopperPrompt.classList.remove('hidden');
        else hopperPrompt.classList.add('hidden');
      }

      const isNearOldPainless = this.env.oldPainlessClearing && this.player && this.player.position.distanceTo(this.env.oldPainlessClearing.gunPos) <= 4.2;
      const painlessPrompt = document.getElementById('old-painless-prompt');
      if (painlessPrompt) {
        if (isNearOldPainless) painlessPrompt.classList.remove('hidden');
        else painlessPrompt.classList.add('hidden');
      }

      // v59.0 Predator 1 (1987) Val Verde Apex Proximity Prompts
      const isNearDutchChallenge = this.env.dutchChallengeRock && this.player && this.player.position.distanceTo(this.env.dutchChallengeRock.pos) <= 4.2;
      const dutchChallengePrompt = document.getElementById('dutch-challenge-prompt');
      if (dutchChallengePrompt) {
        if (isNearDutchChallenge) dutchChallengePrompt.classList.remove('hidden');
        else dutchChallengePrompt.classList.add('hidden');
      }

      const isNearWorkbench = this.env.dutchWorkbench && !this.env.dutchWorkbench.isCrafted && this.player && this.player.position.distanceTo(this.env.dutchWorkbench.pos) <= 4.2;
      const workbenchPrompt = document.getElementById('dutch-workbench-prompt');
      if (workbenchPrompt) {
        if (isNearWorkbench) workbenchPrompt.classList.remove('hidden');
        else workbenchPrompt.classList.add('hidden');
      }

      const isNearAnnaMaps = this.env.annaHostageCage && !this.env.annaHostageCage.isScanned && this.player && this.player.position.distanceTo(this.env.annaHostageCage.mapPos) <= 4.2;
      const annaMapsPrompt = document.getElementById('anna-maps-prompt');
      if (annaMapsPrompt) {
        if (isNearAnnaMaps) annaMapsPrompt.classList.remove('hidden');
        else annaMapsPrompt.classList.add('hidden');
      }

      const isNearWildBoar = this.env.wildBoarRoastSpit && !this.env.wildBoarRoastSpit.isConsumed && this.player && this.player.position.distanceTo(this.env.wildBoarRoastSpit.pos) <= 4.2;
      const wildBoarPrompt = document.getElementById('wild-boar-prompt');
      if (wildBoarPrompt) {
        if (isNearWildBoar) wildBoarPrompt.classList.remove('hidden');
        else wildBoarPrompt.classList.add('hidden');
      }

      const isNearGlowingBlood = this.env.yautjaCraterLocus && !this.env.yautjaCraterLocus.isAnalyzed && this.player && this.player.position.distanceTo(this.env.yautjaCraterLocus.pos) <= 5.0;
      const glowingBloodPrompt = document.getElementById('glowing-blood-prompt');
      if (glowingBloodPrompt) {
        if (isNearGlowingBlood) glowingBloodPrompt.classList.remove('hidden');
        else glowingBloodPrompt.classList.add('hidden');
      }

      // v60.0 Predator 2 (1990) TOITS DE LOS ANGELES Proximity Prompts
      const isNearColumbia = this.env.easternColumbiaSpire && this.player && this.player.position.distanceTo(this.env.easternColumbiaSpire.pos) <= 5.0;
      const columbiaPrompt = document.getElementById('eastern-columbia-prompt');
      if (columbiaPrompt) {
        if (isNearColumbia) columbiaPrompt.classList.remove('hidden');
        else columbiaPrompt.classList.add('hidden');
      }

      const isNearMeatLocker = this.env.meatLockerFacility && this.player && this.player.position.distanceTo(this.env.meatLockerFacility.valvePos) <= 4.2;
      const meatLockerPrompt = document.getElementById('meat-locker-prompt');
      if (meatLockerPrompt) {
        if (isNearMeatLocker) meatLockerPrompt.classList.remove('hidden');
        else meatLockerPrompt.classList.add('hidden');
      }

      const isNearKingWillie = this.env.kingWillieAltar && !this.env.kingWillieAltar.isClaimed && this.player && this.player.position.distanceTo(this.env.kingWillieAltar.pos) <= 4.2;
      const kingWilliePrompt = document.getElementById('king-willie-prompt');
      if (kingWilliePrompt) {
        if (isNearKingWillie) kingWilliePrompt.classList.remove('hidden');
        else kingWilliePrompt.classList.add('hidden');
      }

      const isNearDannyNetgun = this.env.dannyBoyNetgun && !this.env.dannyBoyNetgun.isClaimed && this.player && this.player.position.distanceTo(this.env.dannyBoyNetgun.pos) <= 4.2;
      const dannyNetgunPrompt = document.getElementById('danny-netgun-prompt');
      if (dannyNetgunPrompt) {
        if (isNearDannyNetgun) dannyNetgunPrompt.classList.remove('hidden');
        else dannyNetgunPrompt.classList.add('hidden');
      }

      const isNearLostTribe = this.env.lostTribeShipDais && !this.env.lostTribeShipDais.isClaimed && this.player && this.player.position.distanceTo(this.env.lostTribeShipDais.pos) <= 4.5;
      const lostTribePrompt = document.getElementById('lost-tribe-prompt');
      if (lostTribePrompt) {
        if (isNearLostTribe) lostTribePrompt.classList.remove('hidden');
        else lostTribePrompt.classList.add('hidden');
      }

      const isNearSurgery = this.env.cityHunterSurgery && !this.env.cityHunterSurgery.isUsed && this.player && this.player.position.distanceTo(this.env.cityHunterSurgery.pos) <= 4.2;
      const surgeryPrompt = document.getElementById('city-hunter-surgery-prompt');
      if (surgeryPrompt) {
        if (isNearSurgery) surgeryPrompt.classList.remove('hidden');
        else surgeryPrompt.classList.add('hidden');
      }

      const isNearCruiser = this.env.harriganCruiser && !this.env.harriganCruiser.isLooted && this.player && this.player.position.distanceTo(this.env.harriganCruiser.pos) <= 4.2;
      const cruiserPrompt = document.getElementById('harrigan-cruiser-prompt');
      if (cruiserPrompt) {
        if (isNearCruiser) cruiserPrompt.classList.remove('hidden');
        else cruiserPrompt.classList.add('hidden');
      }

      const isNearSmartDisc = this.env.smartDiscGirder && !this.env.smartDiscGirder.isRetrieved && this.player && this.player.position.distanceTo(this.env.smartDiscGirder.pos) <= 4.2;
      const smartDiscPrompt = document.getElementById('smart-disc-girder-prompt');
      if (smartDiscPrompt) {
        if (isNearSmartDisc) smartDiscPrompt.classList.remove('hidden');
        else smartDiscPrompt.classList.add('hidden');
      }

      const isNearSubway = this.env.subwayCar666 && !this.env.subwayCar666.isClaimed && this.player && this.player.position.distanceTo(this.env.subwayCar666.pos) <= 4.2;
      const subwayPrompt = document.getElementById('subway-massacre-prompt');
      if (subwayPrompt) {
        if (isNearSubway) subwayPrompt.classList.remove('hidden');
        else subwayPrompt.classList.add('hidden');
      }

      const isNearOWLF = this.env.owlfCommandVan && !this.env.owlfCommandVan.isScanned && this.player && this.player.position.distanceTo(this.env.owlfCommandVan.pos) <= 4.2;
      const owlfPrompt = document.getElementById('owlf-van-prompt');
      if (owlfPrompt) {
        if (isNearOWLF) owlfPrompt.classList.remove('hidden');
        else owlfPrompt.classList.add('hidden');
      }

      const isNearCartel = this.env.cartelPenthouse && !this.env.cartelPenthouse.isLooted && this.player && this.player.position.distanceTo(this.env.cartelPenthouse.pos) <= 4.2;
      const cartelPrompt = document.getElementById('cartel-penthouse-prompt');
      if (cartelPrompt) {
        if (isNearCartel) cartelPrompt.classList.remove('hidden');
        else cartelPrompt.classList.add('hidden');
      }

      const isNearVaultPad = this.env.poleVaultPad && this.player && this.player.position.distanceTo(this.env.poleVaultPad.pos) <= 3.8;
      const vaultPadPrompt = document.getElementById('pole-vault-pad-prompt');
      if (vaultPadPrompt) {
        if (isNearVaultPad) vaultPadPrompt.classList.remove('hidden');
        else vaultPadPrompt.classList.add('hidden');
      }

      // v61.0 PREDATORS (2010) GAME PRESERVE PROMPTS
      const isNearNoland = this.env.nolandHideout && !this.env.nolandHideout.isLooted && this.player && this.player.position.distanceTo(this.env.nolandHideout.doorPos) <= 4.8;
      const nolandPrompt = document.getElementById('noland-hideout-prompt');
      if (nolandPrompt) {
        if (isNearNoland) nolandPrompt.classList.remove('hidden');
        else nolandPrompt.classList.add('hidden');
      }

      const isNearWhistle = this.env.hellhoundKennel && !this.env.hellhoundKennel.isUsed && this.player && this.player.position.distanceTo(this.env.hellhoundKennel.whistlePos) <= 4.5;
      const whistlePrompt = document.getElementById('tracker-whistle-prompt');
      if (whistlePrompt) {
        if (isNearWhistle) whistlePrompt.classList.remove('hidden');
        else whistlePrompt.classList.add('hidden');
      }

      const isNearNikolai = this.env.nikolaiBlastMemorial && !this.env.nikolaiBlastMemorial.isDetonated && this.player && this.player.position.distanceTo(this.env.nikolaiBlastMemorial.craterPos) <= 4.2;
      const nikolaiPrompt = document.getElementById('nikolai-claymore-prompt');
      if (nikolaiPrompt) {
        if (isNearNikolai) nikolaiPrompt.classList.remove('hidden');
        else nikolaiPrompt.classList.add('hidden');
      }

      const isNearHanzo = this.env.hanzoDuelArena && !this.env.hanzoDuelArena.isDrawn && this.player && this.player.position.distanceTo(this.env.hanzoDuelArena.katanaPos) <= 4.2;
      const hanzoPrompt = document.getElementById('hanzo-katana-prompt');
      if (hanzoPrompt) {
        if (isNearHanzo) hanzoPrompt.classList.remove('hidden');
        else hanzoPrompt.classList.add('hidden');
      }

      const isNearFlora = this.env.alienFloraPatch && this.player && this.player.position.distanceTo(this.env.alienFloraPatch.harvestPos) <= 4.2;
      const floraPrompt = document.getElementById('alien-flora-prompt');
      if (floraPrompt) {
        if (isNearFlora) floraPrompt.classList.remove('hidden');
        else floraPrompt.classList.add('hidden');
      }

      const isNearCliffLeap = this.env.royceCliffWaterfall && this.player && this.player.position.y >= 7.5 && this.player.position.distanceTo(this.env.royceCliffWaterfall.pos) <= 4.8;
      const cliffLeapPrompt = document.getElementById('royce-cliff-leap-prompt');
      if (cliffLeapPrompt) {
        if (isNearCliffLeap) cliffLeapPrompt.classList.remove('hidden');
        else cliffLeapPrompt.classList.add('hidden');
      }

      const isNearShip = this.env.superPredatorShipDais && !this.env.superPredatorShipDais.isOverloaded && this.player && this.player.position.distanceTo(this.env.superPredatorShipDais.consolePos) <= 4.5;
      const shipPrompt = document.getElementById('super-predator-ship-prompt');
      if (shipPrompt) {
        if (isNearShip) shipPrompt.classList.remove('hidden');
        else shipPrompt.classList.add('hidden');
      }

      const isNearFalconer = this.env.falconerDronePerch && !this.env.falconerDronePerch.isClaimed && this.player && this.player.position.y >= 3.8 && this.player.position.distanceTo(this.env.falconerDronePerch.cradlePos) <= 4.5;
      const falconerPrompt = document.getElementById('falconer-drone-prompt');
      if (falconerPrompt) {
        if (isNearFalconer) falconerPrompt.classList.remove('hidden');
        else falconerPrompt.classList.add('hidden');
      }

      const isNearCuchillo = this.env.cuchilloAcousticDecoy && !this.env.cuchilloAcousticDecoy.isDisarmed && !this.env.cuchilloAcousticDecoy.isDetonated && this.player && this.player.position.distanceTo(this.env.cuchilloAcousticDecoy.decoyPos) <= 4.2;
      const cuchilloPrompt = document.getElementById('cuchillo-decoy-prompt');
      if (cuchilloPrompt) {
        if (isNearCuchillo) cuchilloPrompt.classList.remove('hidden');
        else cuchilloPrompt.classList.add('hidden');
      }

      const isNearBoneGong = this.env.royceBoneGong && this.player && this.player.position.distanceTo(this.env.royceBoneGong.gongPos) <= 4.5;
      const boneGongPrompt = document.getElementById('bone-gong-prompt');
      if (boneGongPrompt) {
        if (isNearBoneGong) boneGongPrompt.classList.remove('hidden');
        else boneGongPrompt.classList.add('hidden');
      }

      const isNearIsabelle = this.env.isabelleSniperStash && !this.env.isabelleSniperStash.isClaimed && this.player && this.player.position.y >= 7.5 && this.player.position.distanceTo(this.env.isabelleSniperStash.stashPos) <= 4.2;
      const isabellePrompt = document.getElementById('isabelle-sniper-prompt');
      if (isabellePrompt) {
        if (isNearIsabelle) isabellePrompt.classList.remove('hidden');
        else isabellePrompt.classList.add('hidden');
      }

      // v63.0 Val Verde Master Prompts (Predator 1987)
      const isNearDillon = this.env.dillonLastStand && !this.env.dillonLastStand.isLooted && this.player && this.player.position.distanceTo(this.env.dillonLastStand.pos) <= 4.2;
      const dillonPrompt = document.getElementById('dillon-mp5-prompt');
      if (dillonPrompt) {
        if (isNearDillon) dillonPrompt.classList.remove('hidden');
        else dillonPrompt.classList.add('hidden');
      }

      const isNearPoncho = this.env.ponchoGrenadeStash && !this.env.ponchoGrenadeStash.isClaimed && this.player && this.player.position.distanceTo(this.env.ponchoGrenadeStash.pos) <= 4.2;
      const ponchoPrompt = document.getElementById('poncho-grenade-prompt');
      if (ponchoPrompt) {
        if (isNearPoncho) ponchoPrompt.classList.remove('hidden');
        else ponchoPrompt.classList.add('hidden');
      }

      const isNearHawkins = this.env.hawkinsRadioBeacon && !this.env.hawkinsRadioBeacon.isActivated && this.player && this.player.position.distanceTo(this.env.hawkinsRadioBeacon.pos) <= 4.2;
      const hawkinsPrompt = document.getElementById('hawkins-relay-prompt');
      if (hawkinsPrompt) {
        if (isNearHawkins) hawkinsPrompt.classList.remove('hidden');
        else hawkinsPrompt.classList.add('hidden');
      }

      const isNearMudWaterfall = this.env.mudWaterfallBasin && this.player && this.player.position.distanceTo(this.env.mudWaterfallBasin.pos) <= 4.5;
      const mudWaterfallPrompt = document.getElementById('mud-waterfall-prompt');
      if (mudWaterfallPrompt) {
        if (isNearMudWaterfall) mudWaterfallPrompt.classList.remove('hidden');
        else mudWaterfallPrompt.classList.add('hidden');
      }

      // v63.0 The Predator (2018) Stargazer Prompts
      const isNearVivisection = this.env.stargazerVivisection && !this.env.stargazerVivisection.isHarvested && this.player && this.player.position.distanceTo(this.env.stargazerVivisection.pos) <= 4.2;
      const vivisectionPrompt = document.getElementById('stargazer-vivisection-prompt');
      if (vivisectionPrompt) {
        if (isNearVivisection) vivisectionPrompt.classList.remove('hidden');
        else vivisectionPrompt.classList.add('hidden');
      }

      const isNearPredatorKiller = this.env.predatorKillerPod && !this.env.predatorKillerPod.isClaimed && this.player && this.player.position.distanceTo(this.env.predatorKillerPod.pos) <= 4.5;
      const killerPrompt = document.getElementById('predator-killer-prompt');
      if (killerPrompt) {
        if (isNearPredatorKiller) killerPrompt.classList.remove('hidden');
        else killerPrompt.classList.add('hidden');
      }

      const isNearQuinn = this.env.quinnSniperPerch && !this.env.quinnSniperPerch.isLooted && this.player && this.player.position.y >= 5.5 && this.player.position.distanceTo(this.env.quinnSniperPerch.pos) <= 4.5;
      const quinnPrompt = document.getElementById('quinn-sniper-prompt');
      if (quinnPrompt) {
        if (isNearQuinn) quinnPrompt.classList.remove('hidden');
        else quinnPrompt.classList.add('hidden');
      }

      const isNearTraeger = this.env.traegerWeaponLocker && !this.env.traegerWeaponLocker.isLooted && this.player && this.player.position.distanceTo(this.env.traegerWeaponLocker.pos) <= 4.2;
      const traegerPrompt = document.getElementById('traeger-weapon-prompt');
      if (traegerPrompt) {
        if (isNearTraeger) traegerPrompt.classList.remove('hidden');
        else traegerPrompt.classList.add('hidden');
      }

      const isNearLoonies = this.env.looniesTransportBus && !this.env.looniesTransportBus.isClaimed && this.player && this.player.position.distanceTo(this.env.looniesTransportBus.pos) <= 4.8;
      const looniesPrompt = document.getElementById('loonies-bus-prompt');
      if (looniesPrompt) {
        if (isNearLoonies) looniesPrompt.classList.remove('hidden');
        else looniesPrompt.classList.add('hidden');
      }

      const isNearArk = this.env.crashedArkStarship && !this.env.crashedArkStarship.isShieldOverloaded && this.player && this.player.position.y >= 4.5 && this.player.position.distanceTo(this.env.crashedArkStarship.pos) <= 4.8;
      const arkPrompt = document.getElementById('crashed-ark-prompt');
      if (arkPrompt) {
        if (isNearArk) arkPrompt.classList.remove('hidden');
        else arkPrompt.classList.add('hidden');
      }

      const isNearFugitiveLocker = this.env.fugitiveGauntletLocker && !this.env.fugitiveGauntletLocker.isClaimed && this.player && this.player.position.distanceTo(this.env.fugitiveGauntletLocker.pos) <= 4.2;
      const fugitivePrompt = document.getElementById('fugitive-gauntlet-prompt');
      if (fugitivePrompt) {
        if (isNearFugitiveLocker) fugitivePrompt.classList.remove('hidden');
        else fugitivePrompt.classList.add('hidden');
      }

      const isNearLobo = this.env.friendlyLoboHound && !this.env.friendlyLoboHound.isTamed && this.player && this.player.position.distanceTo(this.env.friendlyLoboHound.pos) <= 4.5;
      const loboPrompt = document.getElementById('friendly-lobo-prompt');
      if (loboPrompt) {
        if (isNearLobo) loboPrompt.classList.remove('hidden');
        else loboPrompt.classList.add('hidden');
      }

      const isNearBaxleyCoyle = this.env.baxleyCoyleBunker && !this.env.baxleyCoyleBunker.isLooted && this.player && this.player.position.distanceTo(this.env.baxleyCoyleBunker.pos) <= 4.5;
      const baxleyPrompt = document.getElementById('baxley-coyle-prompt');
      if (baxleyPrompt) {
        if (isNearBaxleyCoyle) baxleyPrompt.classList.remove('hidden');
        else baxleyPrompt.classList.add('hidden');
      }

      const isNearNebraska = this.env.nebraskaHarpoonRig && !this.env.nebraskaHarpoonRig.isFired && this.player && this.player.position.distanceTo(this.env.nebraskaHarpoonRig.pos) <= 4.2;
      const nebraskaPrompt = document.getElementById('nebraska-harpoon-prompt');
      if (nebraskaPrompt) {
        if (isNearNebraska) nebraskaPrompt.classList.remove('hidden');
        else nebraskaPrompt.classList.add('hidden');
      }

      const isNearRory = this.env.roryTranslatorDesk && !this.env.roryTranslatorDesk.isDecoded && this.player && this.player.position.distanceTo(this.env.roryTranslatorDesk.pos) <= 4.2;
      const roryPrompt = document.getElementById('rory-translator-prompt');
      if (roryPrompt) {
        if (isNearRory) roryPrompt.classList.remove('hidden');
        else roryPrompt.classList.add('hidden');
      }

      const isNearTurbine = this.env.crashedArkTurbine && !this.env.crashedArkTurbine.isDetonated && this.player && this.player.position.y >= 4.5 && this.player.position.distanceTo(this.env.crashedArkTurbine.pos) <= 4.8;
      const turbinePrompt = document.getElementById('crashed-ark-turbine-prompt');
      if (turbinePrompt) {
        if (isNearTurbine) turbinePrompt.classList.remove('hidden');
        else turbinePrompt.classList.add('hidden');
      }

      const isNearDecon = this.env.caseyDeconStation && !this.env.caseyDeconStation.isUsed && this.player && this.player.position.distanceTo(this.env.caseyDeconStation.pos) <= 4.2;
      const deconPrompt = document.getElementById('casey-decon-prompt');
      if (deconPrompt) {
        if (isNearDecon) deconPrompt.classList.remove('hidden');
        else deconPrompt.classList.add('hidden');
      }

      const isNearBoneMask = this.env.boneMaskDecoy && this.env.boneMaskDecoy.isArmed && this.player && this.player.position.distanceTo(this.env.boneMaskDecoy.pos) <= 4.2;
      const maskPrompt = document.getElementById('bone-mask-prompt');
      if (maskPrompt) {
        if (isNearBoneMask) maskPrompt.classList.remove('hidden');
        else maskPrompt.classList.add('hidden');
      }

      const isNearFlower = this.env.orangeFlowerPatch && !this.env.orangeFlowerPatch.isHarvested && this.player && this.player.position.distanceTo(this.env.orangeFlowerPatch.pos) <= 4.2;
      const flowerPrompt = document.getElementById('orange-flower-prompt');
      if (flowerPrompt) {
        if (isNearFlower) flowerPrompt.classList.remove('hidden');
        else flowerPrompt.classList.add('hidden');
      }

      const isNearAdolini = this.env.adoliniPistolPedestal && !this.env.adoliniPistolPedestal.isClaimed && this.player && this.player.position.distanceTo(this.env.adoliniPistolPedestal.pos) <= 4.2;
      const adoliniPrompt = document.getElementById('adolini-pistol-prompt');
      if (adoliniPrompt) {
        if (isNearAdolini) adoliniPrompt.classList.remove('hidden');
        else adoliniPrompt.classList.add('hidden');
      }

      const isNearTaabe = this.env.taabeRockPerch && !this.env.taabeRockPerch.isClaimed && this.player && this.player.position.distanceTo(this.env.taabeRockPerch.pos) <= 4.5;
      const taabePrompt = document.getElementById('taabe-bow-prompt');
      if (taabePrompt) {
        if (isNearTaabe) taabePrompt.classList.remove('hidden');
        else taabePrompt.classList.add('hidden');
      }

      const isNearGrizzly = this.env.grizzlyBearCarcass && !this.env.grizzlyBearCarcass.isSkinned && this.player && this.player.position.distanceTo(this.env.grizzlyBearCarcass.pos) <= 4.5;
      const grizzlyPrompt = document.getElementById('grizzly-trophy-prompt');
      if (grizzlyPrompt) {
        if (isNearGrizzly) grizzlyPrompt.classList.remove('hidden');
        else grizzlyPrompt.classList.add('hidden');
      }

      const isNearTomahawk = this.env.naruTomahawkTree && !this.env.naruTomahawkTree.isClaimed && this.player && this.player.position.distanceTo(this.env.naruTomahawkTree.pos) <= 4.2;
      const tomahawkPrompt = document.getElementById('naru-tomahawk-prompt');
      if (tomahawkPrompt) {
        if (isNearTomahawk) tomahawkPrompt.classList.remove('hidden');
        else tomahawkPrompt.classList.add('hidden');
      }

      const isNearMedTent = this.env.trapperMedicalTent && !this.env.trapperMedicalTent.isLooted && this.player && this.player.position.distanceTo(this.env.trapperMedicalTent.pos) <= 4.2;
      const medTentPrompt = document.getElementById('trapper-med-prompt');
      if (medTentPrompt) {
        if (isNearMedTent) medTentPrompt.classList.remove('hidden');
        else medTentPrompt.classList.add('hidden');
      }

      const isNearFeralArsenal = this.env.feralArsenalStation && !this.env.feralArsenalStation.isClaimed && this.player && this.player.position.distanceTo(this.env.feralArsenalStation.pos) <= 4.2;
      const feralArsenalPrompt = document.getElementById('feral-arsenal-prompt');
      if (feralArsenalPrompt) {
        if (isNearFeralArsenal) feralArsenalPrompt.classList.remove('hidden');
        else feralArsenalPrompt.classList.add('hidden');
      }

      const isNearSarii = this.env.sariiCompanion && !this.env.sariiCompanion.wounded && (!this.env.sariiCompanion.isTamed || this.env.sariiCompanion.owner===this.player) && this.player && this.player.position.distanceTo(this.env.sariiCompanion.pos) <= 4.5;
      const sariiPrompt = document.getElementById('sarii-companion-prompt');
      if (sariiPrompt) {
        if (isNearSarii) sariiPrompt.classList.remove('hidden');
        else sariiPrompt.classList.add('hidden');
      }

      const isNearBait = this.env.trapperBaitTree && !this.env.trapperBaitTree.isDetonated && this.player && this.player.position.distanceTo(this.env.trapperBaitTree.pos) <= 4.5;
      const baitPrompt = document.getElementById('trapper-bait-prompt');
      if (baitPrompt) {
        if (isNearBait) baitPrompt.classList.remove('hidden');
        else baitPrompt.classList.add('hidden');
      }

      const isNearRaft = this.env.voyageurRiverRaft && !this.env.voyageurRiverRaft.isLooted && this.player && this.player.position.distanceTo(this.env.voyageurRiverRaft.pos) <= 4.5;
      const raftPrompt = document.getElementById('voyageur-raft-prompt');
      if (raftPrompt) {
        if (isNearRaft) raftPrompt.classList.remove('hidden');
        else raftPrompt.classList.add('hidden');
      }

      const isNearTotem = this.env.comancheTotemPost && !this.env.comancheTotemPost.isClaimed && this.player && this.player.position.distanceTo(this.env.comancheTotemPost.pos) <= 4.5;
      const totemPrompt = document.getElementById('comanche-totem-prompt');
      if (totemPrompt) {
        if (isNearTotem) totemPrompt.classList.remove('hidden');
        else totemPrompt.classList.add('hidden');
      }

      const isNearPine = this.env.lightningSplitPine && !this.env.lightningSplitPine.isClaimed && this.player && this.player.position.distanceTo(this.env.lightningSplitPine.pos) <= 4.5;
      const pinePrompt = document.getElementById('lightning-pine-prompt');
      if (pinePrompt) {
        if (isNearPine) pinePrompt.classList.remove('hidden');
        else pinePrompt.classList.add('hidden');
      }

      const isNearSpit = this.env.trapperCampfireSpit && !this.env.trapperCampfireSpit.isToppled && this.player && this.player.position.distanceTo(this.env.trapperCampfireSpit.pos) <= 4.5;
      const spitPrompt = document.getElementById('trapper-spit-prompt');
      if (spitPrompt) {
        if (isNearSpit) spitPrompt.classList.remove('hidden');
        else spitPrompt.classList.add('hidden');
      }

      const isNearCairn = this.env.buffaloSkullCairn && !this.env.buffaloSkullCairn.isCommuned && this.player && this.player.position.distanceTo(this.env.buffaloSkullCairn.pos) <= 4.5;
      const cairnPrompt = document.getElementById('buffalo-cairn-prompt');
      if (cairnPrompt) {
        if (isNearCairn) cairnPrompt.classList.remove('hidden');
        else cairnPrompt.classList.add('hidden');
      }

      const isNearGauntlet = this.env.feralSeveredGauntlet && !this.env.feralSeveredGauntlet.isClaimed && this.player && this.player.position.distanceTo(this.env.feralSeveredGauntlet.pos) <= 4.2;
      const gauntletPrompt = document.getElementById('severed-gauntlet-prompt');
      if (gauntletPrompt) {
        if (isNearGauntlet) gauntletPrompt.classList.remove('hidden');
        else gauntletPrompt.classList.add('hidden');
      }

      // Predator: Killer of Killers (2025) Prompts
      const isNearStasis = this.env.trioCryoStasisPods && !this.env.trioCryoStasisPods.isAwakened && this.player && this.player.position.distanceTo(this.env.trioCryoStasisPods.pos) <= 4.8;
      const stasisPrompt = document.getElementById('stasis-trio-prompt');
      if (stasisPrompt) {
        if (isNearStasis) stasisPrompt.classList.remove('hidden');
        else stasisPrompt.classList.add('hidden');
      }

      const isNearUrsaShield = this.env.ursaShieldProw && !this.env.ursaShieldProw.isClaimed && this.player && this.player.position.distanceTo(this.env.ursaShieldProw.pos) <= 4.2;
      const ursaShieldPrompt = document.getElementById('ursa-shield-prompt');
      if (ursaShieldPrompt) {
        if (isNearUrsaShield) ursaShieldPrompt.classList.remove('hidden');
        else ursaShieldPrompt.classList.add('hidden');
      }

      const isNearUrsaAxe = this.env.ursaDaneAxeAltar && !this.env.ursaDaneAxeAltar.isClaimed && this.player && this.player.position.distanceTo(this.env.ursaDaneAxeAltar.pos) <= 4.2;
      const ursaAxePrompt = document.getElementById('ursa-axe-prompt');
      if (ursaAxePrompt) {
        if (isNearUrsaAxe) ursaAxePrompt.classList.remove('hidden');
        else ursaAxePrompt.classList.add('hidden');
      }

      const isNearKenjiKatana = this.env.kenjiKatanaStand && !this.env.kenjiKatanaStand.isClaimed && this.player && this.player.position.distanceTo(this.env.kenjiKatanaStand.pos) <= 4.2;
      const kenjiKatanaPrompt = document.getElementById('kenji-katana-prompt');
      if (kenjiKatanaPrompt) {
        if (isNearKenjiKatana) kenjiKatanaPrompt.classList.remove('hidden');
        else kenjiKatanaPrompt.classList.add('hidden');
      }

      const isNearKenjiDecoy = this.env.kenjiBambooDecoy && !this.env.kenjiBambooDecoy.isTriggered && this.player && this.player.position.distanceTo(this.env.kenjiBambooDecoy.pos) <= 4.2;
      const kenjiDecoyPrompt = document.getElementById('kenji-decoy-prompt');
      if (kenjiDecoyPrompt) {
        if (isNearKenjiDecoy) kenjiDecoyPrompt.classList.remove('hidden');
        else kenjiDecoyPrompt.classList.add('hidden');
      }

      const isNearTorresPlane = this.env.torresWarhawkWreck && !this.env.torresWarhawkWreck.isClaimed && this.player && this.player.position.distanceTo(this.env.torresWarhawkWreck.pos) <= 4.2;
      const torresPlanePrompt = document.getElementById('torres-plane-prompt');
      if (torresPlanePrompt) {
        if (isNearTorresPlane) torresPlanePrompt.classList.remove('hidden');
        else torresPlanePrompt.classList.add('hidden');
      }

      const isNearTorresGun = this.env.torresBrowningNest && !this.env.torresBrowningNest.isFired && this.player && this.player.position.distanceTo(this.env.torresBrowningNest.pos) <= 4.2;
      const torresGunPrompt = document.getElementById('torres-browning-prompt');
      if (torresGunPrompt) {
        if (isNearTorresGun) torresGunPrompt.classList.remove('hidden');
        else torresGunPrompt.classList.add('hidden');
      }
    }

    if (this.player.hp <= 0 && (!this.isCoOp || !this.player2 || this.player2.hp <= 0)) {
      this.endGame(false);
      return;
    }

    if (this.battlefield?.complete) {
      this.endGame(true);
      return;
    }
    if (!this.battlefield && !this.battleSimulation && this.horde.remainingCount === 0 && !this.bosses.activeBoss) {
      if (this.bossSpawned) {
        this.endGame(true);
        return;
      }
      if (this.isEndlessMode || this.waveIndex < this.totalWaves) {
        this.waveIndex++;
        this.horde.spawnWave(30 + this.waveIndex * 10, this.player.position);
        this.ui.showAnnouncement(`VAGUE ${this.waveIndex} APPROCHE ! FORCES DE LA RUCHE DÉPLOYÉES !`);

        // Cheyenne Dropship Airstrike Support on Wave 2 & 4!
        if (this.waveIndex === 2 || this.waveIndex === 4) {
          const request=this.dropship.triggerAirstrike(this.player.position, this.horde);
          this.ui.showAnnouncement(request.accepted?'CHEYENNE UD-4L EN APPROCHE — SIX ROQUETTES ENGAGÉES.':request.message);
          if (request.accepted && this.waveIndex === 2) {
            this.scheduleMissionTask(() => {
              this.sentryGun.deploySentry(this.player.position.clone().add(new THREE.Vector3(3.5, 0, 2)));
              this.ui.showAnnouncement('📦 LARGAGE TACTIQUE : TOURELLE SENTINELLE UA 571-C DÉPLOYÉE EN APPUI !');
            }, 2.5);
          }
        }

        if (this.waveIndex === 3) {
          this.badBlood.spawnAmbush(this.player.position);
          this.ui.showAnnouncement('⚠️ ALERTE : EMBUSCADE D\'UN YAUTJA RENÉGAT "BAD BLOOD" !');
          if(this.spawnAPCSupport(this.player.position.clone().add(new THREE.Vector3(-18, 0, -10))))this.scheduleMissionTask(() => {
            if(this.apc.isSupportActive())this.ui.showAnnouncement('RENFORT BLINDÉ : APC USCM M577 EN POSITION DE TIR.');
          }, 1.8);
          else this.ui.showAnnouncement(this.apc.getSupportState().refusalMessage??'APC indisponible dans ce scénario.');
        }

        // Spawn Predalien Matriarch Titan (10,000 HP) on Wave 5 and every 3 waves in Endless Mode
        if (this.waveIndex === 5 || (this.waveIndex > 5 && this.waveIndex % 3 === 0)) {
          const bType = this.waveIndex === 5 ? 'predalien_matriarch_titan' : (this.ui.selectedLevel.bossType || 'predalien_matriarch_titan');
          if (this.env && !this.env.reactorMeltdownActive && this.waveIndex === 5) {
            this.env.triggerReactorMeltdown(this.ui, this.audio);
          }
          this.bosses.spawnBoss(bType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));
          this.ui.showAnnouncement('👑 SURGISSEMENT DU BOSS SUPRÊME : MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE (10 000 PV) !');
          this.shiftBattlefieldMorale(-25.0);
        }
      } else if (!this.bosses.activeBoss) {
        const bType = this.ui.selectedLevel.bossType;
        this.bossSpawned = true;
        this.bosses.spawnBoss(bType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));

        let bossTitle = 'MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE (AVP EXTINCTION / AVP-R)';
        if (bType === 'the_offspring') bossTitle = 'HYBRIDE GÉNOTYPIQUE THE OFFSPRING (ROMULUS 2024)';
        else if (bType === 'trilobite_prime') bossTitle = 'TRILOBITE CÉPHALOPODE PRIME (PROMETHEUS 2012)';
        else if (bType === 'predalien_abomination') bossTitle = 'ABOMINATION PRÉDALIENNE GESTANTE (AVP-R 2007 CHET)';
        else if (bType === 'predalien_queen') bossTitle = 'REINE PRÉDALIENNE ABOMINATION DU CLAN (AVP-R 2007)';
        else if (bType === 'empress_matriarch') bossTitle = 'IMPÉRATRICE VOLANTE DE LA RUCHE PRIMORDIALE (DARK HORSE)';
        else if (bType === 'rogue_king_prime') bossTitle = 'ROGUE KING XENOMORPH PRIME (ALIENS: ROGUE 1993)';
        else if (bType === 'awakened_engineer') bossTitle = 'INGÉNIEUR MALA\'KAK ÉVEILLÉ (PROMETHEUS 2012)';

        this.ui.showAnnouncement(`👑 SURGISSEMENT DU BOSS APEX : ${bossTitle} !`);
        // Shift Morale towards Hive (-25%) upon Apex Boss appearance
        this.shiftBattlefieldMorale(-25.0);
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
        this.ui.showCombo(0);
        const tagElem = document.getElementById('combo-chain-indicator');
        if (tagElem) {
          tagElem.innerText = 'NORMAL COMBO';
          tagElem.style.color = '#00d2ff';
        }
      }
    }

    // Update Plasma Caster Charging State & Tri-Laser Convergence (Predator 1987)
    if (this.player && this.player.isChargingPlasma) {
      this.player.plasmaChargeTime += delta;
      const targetPos = this.player.targetLockEnemy && this.player.targetLockEnemy.mesh ? this.player.targetLockEnemy.mesh.position : null;
      this.player.updateLaserLock(targetPos);
    }

    // Dynamic Tug-of-War Morale update (Alien pressure slowly regains ground if Yautja is idle)
    if (this.battlefieldMorale > 25.0) {
      this.shiftBattlefieldMorale(-0.15 * delta);
    }

    // Chantier 10: Vanguard Berserker Frenzy Golden Aura
    if (this.vanguardFrenzyActive && this.player) {
      this.frenzyAuraTimer = (this.frenzyAuraTimer || 0) + delta;
      if (this.frenzyAuraTimer >= 0.35) {
        this.frenzyAuraTimer = 0;
        if (this.particles && this.particles.emitGoldRageSparks) {
          this.particles.emitGoldRageSparks(this.player.position, 3);
        }
      }
    }

    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score, {
      badBlood: this.badBlood,
      marines: this.marines,
      allies: this.allies,
      synthetics: this.synthetics, sessionDefeats: this._sessionDefeats,
      supports:{apc:this.apc.getSupportState(),cheyenne:this.dropship.getSupportState()}
    });
    this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));

    // Visor Acid Corrosion HUD Overlay Update (Alien: Romulus 2024)
    const acidOverlay = document.getElementById('acid-corrosion-overlay');
    if (acidOverlay) {
      if (this.player && this.player.visorAcidBurn > 0.05) {
        acidOverlay.classList.remove('hidden');
        acidOverlay.style.opacity = Math.min(1.0, this.player.visorAcidBurn);
      } else {
        acidOverlay.classList.add('hidden');
      }
    }

    // Berserker Rage Screen Glow Overlay Update (Aliens: Genocide Lore)
    const rageOverlay = document.getElementById('berserker-rage-overlay');
    if (rageOverlay) {
      if (this.player && this.player.isBerserkerActive) {
        rageOverlay.classList.remove('hidden');
      } else {
        rageOverlay.classList.add('hidden');
      }
    }

    // Update HUD slots for Plasma Glaive and Royal Jelly
    const glaiveSlot = document.getElementById('slot-glaive');
    if (glaiveSlot && this.player) {
      glaiveSlot.classList.toggle('active', this.player.isPlasmaGlaiveActive);
      glaiveSlot.classList.toggle('cooldown', this.player.plasmaGlaiveCooldown > 0);
    }

    const jellySlot = document.getElementById('slot-jelly');
    if (jellySlot && this.player) {
      jellySlot.classList.toggle('active', this.player.isBerserkerActive);
      const label = jellySlot.querySelector('.slot-label');
      if (label) {
        label.innerText = `GELÉE ROYALE (${this.player.royalJellyFlasks})`;
      }
    }

    // Chantier 4 & Lucas QA (v52.0): Combi-Stick Pole Vault Ability Slot
    const poleVaultSlot = document.getElementById('slot-pole-vault');
    if (poleVaultSlot && this.player) {
      poleVaultSlot.classList.toggle('cooldown', this.player.poleVaultCooldown > 0);
      poleVaultSlot.classList.toggle('active', this.player.isPoleVaulting);
    }

    // Chantier 4 & Lucas QA (v53.0): Chest Roar & Cyclone Whirl Slots
    const chestSlot = document.getElementById('slot-chest-roar');
    if (chestSlot && this.player) {
      chestSlot.classList.toggle('cooldown', this.player.chestRoarCooldown > 0);
      chestSlot.classList.toggle('active', this.player.chestRoarBuffTimer > 0);
    }
    const cycloneSlot = document.getElementById('slot-cyclone-whirl');
    if (cycloneSlot && this.player) {
      cycloneSlot.classList.toggle('cooldown', this.player.cycloneWhirlCooldown > 0);
      cycloneSlot.classList.toggle('active', this.player.isCycloneWhirling);
    }

  }

  updateTargetLockReticle() {
    if (!this.player || !this.isPlaying) return;

    const reticleEl = document.getElementById('hud-tri-target-lock');
    const infoEl = document.getElementById('hud-target-info');
    if (!reticleEl || !infoEl) return;

    let bestTarget = null;
    let minDistance = 35.0; // Max lock range 35m

    const playerForward = new THREE.Vector3(
      Math.sin(this.player.rotationY),
      0,
      Math.cos(this.player.rotationY)
    ).normalize();

    // 1. Check Boss first
    if (this.bosses.activeBoss) {
      const bossPos = this.bosses.activeBoss.mesh.position;
      const toBoss = bossPos.clone().sub(this.player.position);
      const d = toBoss.length();
      toBoss.y = 0;
      toBoss.normalize();
      if (d < minDistance && playerForward.dot(toBoss) > 0.45) {
        minDistance = d;
        const name = this.bosses.activeBoss.type === 'predalien_queen' ? 'PREDALIEN QUEEN MATRIARCH' :
                     this.bosses.activeBoss.type === 'empress_matriarch' ? 'EMPRESS MATRIARCH IMPERIAL' :
                     this.bosses.activeBoss.type === 'rogue_king_prime' ? 'ROGUE KING XENOMORPH PRIME' :
                     this.bosses.activeBoss.type === 'berserker_super_predator' ? 'SUPER PREDATOR BERSERKER (MR. BLACK)' :
                     this.bosses.activeBoss.type === 'ultimate_upgrade_predator' ? 'ULTIMATE UPGRADE PREDATOR 3.3M' :
                     this.bosses.activeBoss.type === 'awakened_engineer' ? 'MALA\'KAK ENGINEER' : 'REINE XÉNOMORPHE';
        bestTarget = {
          pos: bossPos.clone().add(new THREE.Vector3(0, 3, 0)),
          dist: d,
          name,
          weakpoint: this.bosses.activeBoss.type === 'ultimate_upgrade_predator' ? "FAIBLESSE : ARTICULATIONS CERVICALES & CARAPACE VENTRALE (3.2X)" :
                     this.bosses.activeBoss.type === 'rogue_king_prime' ? "FAIBLESSE : PLAQUES DORSALES & BASE DES CORNES CRÂNIENNES (3.0X)" : "FAIBLESSE : SAC D'INOCULATION & ÉCUSSON CERVICAL (3.5X)"
        };
      }
    }

    // 2. Check Xenomorph horde
    if (this.horde && this.horde.aliens) {
      for (let a of this.horde.aliens) {
        const toAlien = a.mesh.position.clone().sub(this.player.position);
        const d = toAlien.length();
        toAlien.y = 0;
        toAlien.normalize();
        if (d < minDistance && playerForward.dot(toAlien) > 0.5) {
          minDistance = d;
          let name = 'XENOMORPH DRONE';
          let weakpoint = 'FAIBLESSE : DÔME CRÂNIEN (-40% ARMURE)';
          if (a.type === 'crusher') {
            name = 'BROYEUR CRUSHER TITAN';
            weakpoint = 'FAIBLESSE : ABDOMEN VENTRAL & ARTICULATIONS';
          } else if (a.type === 'praetorian') {
            name = 'GARDE ROYALE PRAETORIEN';
            weakpoint = 'FAIBLESSE : CONDUITS RESPIRATOIRES DORSAL';
          } else if (a.type === 'spitter') {
            name = 'CRACHEUR D\'ACIDE SPITTER';
            weakpoint = 'FAIBLESSE : POCHES GASTRIQUES ACIDIFIÉES';
          } else if (a.type === 'facehugger') {
            name = 'ARACHNIDE FACEHUGGER';
            weakpoint = 'FAIBLESSE : CORPUS EMBRYONNAIRE VITAL';
          } else if (a.type === 'grid_alien') {
            name = 'ALIEN BALAFRÉ (GRID NEMESIS)';
            weakpoint = 'FAIBLESSE : CICATRICES CHITINEUSES FIBREUSES';
          } else if (a.type === 'red_warrior') {
            name = 'GUERRIER KAINDE AMEDHA ÉCARLATE';
            weakpoint = 'FAIBLESSE : ÉCORCE CHITINEUSE CHAUFFÉE';
          }

          bestTarget = {
            pos: a.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            dist: d,
            name,
            weakpoint
          };
        }
      }
    }

    // 3. Check Synthetics
    if (this.synthetics && this.synthetics.androids) {
      for (let syn of this.synthetics.androids) {
        const toSyn = syn.mesh.position.clone().sub(this.player.position);
        const d = toSyn.length();
        toSyn.y = 0;
        toSyn.normalize();
        if (d < minDistance && playerForward.dot(toSyn) > 0.5) {
          minDistance = d;
          bestTarget = {
            pos: syn.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
            dist: d,
            name: 'ANDROÏDE WEYLAND-YUTANI 8800',
            weakpoint: 'FAIBLESSE : CELLULE D\'ALIMENTATION THORACIQUE'
          };
        }
      }
    }

    if (bestTarget) {
      this.player.updateLaserLock(bestTarget.pos);

      // Play lock chime if newly acquired target
      if (!this.lockedTargetPos || this.lockedTargetPos.distanceTo(bestTarget.pos) > 4.0) {
        this.audio.playTargetLockPing();
        this.audio.playRomulusSmartAimPing();
        this.lockedTargetPos = bestTarget.pos.clone();
      }

      // Project 3D target coordinates to 2D screen coordinates
      const screenCoord = bestTarget.pos.clone().project(this.renderer.camera);
      // Check if target is in front of camera
      if (screenCoord.z > -1 && screenCoord.z < 1 && Math.abs(screenCoord.x) <= 1 && Math.abs(screenCoord.y) <= 1) {
        const viewWidth = this.renderer.isSplitScreen ? Math.floor(this.renderer.width / 2) : this.renderer.width;
        const screenX = (screenCoord.x * 0.5 + 0.5) * viewWidth;
        const screenY = (-(screenCoord.y * 0.5) + 0.5) * this.renderer.height;

        reticleEl.style.left = `${screenX}px`;
        reticleEl.style.top = `${screenY}px`;

        const genusEl = document.getElementById('hud-telemetry-genus');
        const statsEl = document.getElementById('hud-telemetry-stats');
        const weakpointEl = document.getElementById('hud-telemetry-weakpoint');

        if (genusEl && statsEl && weakpointEl) {
          genusEl.innerText = `GENUS : ${bestTarget.name}`;
          statsEl.innerText = `DISTANCE : ${bestTarget.dist.toFixed(1)}M | MENACE : ÉLEVÉE`;
          weakpointEl.innerText = bestTarget.weakpoint;
        } else {
          infoEl.innerText = `TRI-LOCK: ${bestTarget.dist.toFixed(1)}m - ${bestTarget.name}`;
        }

        reticleEl.classList.remove('hidden');
      } else {
        reticleEl.classList.add('hidden');
      }
    } else {
      this.player.updateLaserLock(null);
      this.lockedTargetPos = null;
      reticleEl.classList.add('hidden');
    }
  }

  endGame(isVictory) {
    if (!this.isPlaying) return;
    if (this.battleSimulation && !this.battleSimulation.result) this.battleSimulation.finishOperation({outcome:isVictory?'victory':'defeat',reason:isVictory?'objective_complete':'players_defeated'});
    const operationResult = this.battleSimulation?.getHUDState().result;
    const debrief=captureBattleDebrief(this.battleSimulation,this.operationObjectives);
    if(operationResult){this.recordBattleOutcome(operationResult);this.clearOperationCheckpoint();}
    this.isPlaying = false;
    this.isPaused = false;
    this.ui.recordEndSession(this._sessionDefeats ?? this.horde.deadCount, this.sessionSkulls, this.score, this.rewardSessionId??this.missionRun);

    let title = isVictory ? 'VICTOIRE GLORIEUSE !' : 'CHASSE TERMINÉE';
    let subtitle = isVictory
      ? "La ruche a été anéantie. Votre clan honore cette victoire."
      : "Votre Yautja est tombé au combat. Préparez une nouvelle chasse.";
    if (operationResult) subtitle = debrief?.reason ?? (isVictory ? 'Les objectifs ont été accomplis.' : 'Les chasseurs ont été vaincus.');
    let replayLabel = 'REJOUER LA MISSION';
    if (isVictory && this.missionMode === 'campaign') {
      const progress = this.campaign.completeChapter();
      if (progress.nextChapter) {
        this.pendingChapter = progress.nextChapter;
        title = 'CHAPITRE ACCOMPLI';
        subtitle = `Prochaine destination : ${progress.nextChapter.title}`;
        replayLabel = 'CHAPITRE SUIVANT';
      } else {
        title = 'CAMPAGNE ACCOMPLIE !';
        subtitle = 'Les cinq chasses du clan sont terminées. Votre légende est gravée dans la pierre.';
        replayLabel = 'RECOMMENCER LA CAMPAGNE';
      }
    }
    this.clearMissionState();
    this.ui.renderBattleDebrief(debrief);
    document.getElementById('end-title').innerText = title;
    document.getElementById('end-subtitle').innerText = subtitle;
    document.getElementById('btn-replay').innerText = replayLabel;
    this.ui.showScreen(this.ui.gameOverScreen);
  }

  /* === CHANTIER 9 (v50.0): Persistent Clan Honor Vault & Trophy Armory LocalStorage === */
  awardTrophy(victim, name, honor, owner = this.player) {
    if(!this.saveClanHonorVault(name,honor,victim))return false;
    owner.recordTrophy(name,honor);this.sessionSkulls++;this.score+=honor;return true;
  }

  saveClanHonorVault(trophyName = null, honorAdded = 0, victim = null) {
    if (!this.missionRun || !this.isPlaying) return false;
    const identity = victim ? this.combatEvents.entityId(victim) : 'mission-ritual';
    const amount = Math.max(0, Math.floor(Number(honorAdded) || 0));
    return this.forge.honorLedger?.earn({ id: `${this.rewardSessionId??this.missionRun}:trophy:${identity}`, amount,
      kind: 'trophy', trophy: trophyName, sessionId: this.rewardSessionId??this.missionRun }) ?? false;
  }

  toggleClanHonorVaultModal() {
    const modal = document.getElementById('clan-honor-vault-modal');
    if (!modal) return;
    const isHidden = this.toggleTacticalModal(modal.id);
    if (!isHidden) {
      this.forge.honorLedger?.retryPending?.();
      const ledger = this.forge.honorLedger?.getSnapshot() ?? { earned: 0, balance: 0, trophies: [] };
      const data = { lifetimeHonor: ledger.earned, lifetimeSkulls: this.ui.trophyStats.skullsCollected, highestCombo: this.ui.trophyStats.highestCombo, maxWave: this.waveIndex, trophies: ledger.trophies };

      const honorElem = document.getElementById('vault-lifetime-honor');
      if (honorElem) honorElem.innerText = `${(data.lifetimeHonor || 0).toLocaleString()} PTS${ledger.pendingHonor>0?' · '+ledger.pendingHonor+' en attente de crédit':''}`;
      const skullsElem = document.getElementById('vault-lifetime-skulls');
      if (skullsElem) skullsElem.innerText = `${data.lifetimeSkulls || this.sessionSkulls || 0} CRÂNES`;
      const comboElem = document.getElementById('vault-highest-combo');
      if (comboElem) comboElem.innerText = `${Math.max(data.highestCombo || 0, this.comboHits || 0)} HITS`;
      const waveElem = document.getElementById('vault-max-wave');
      if (waveElem) waveElem.innerText = `VAGUE ${Math.max(data.maxWave || 1, this.waveIndex || 1)}`;

      const listElem = document.getElementById('vault-trophies-list');
      if (listElem) {
        listElem.innerHTML = '';
        const allTrophies = data.trophies;
        if (!allTrophies.length) listElem.textContent = 'Aucun trophée récolté.';
        allTrophies.forEach(t => {
          const item = document.createElement('div');
          item.className = 'vault-trophy-item';
          item.innerText = `🏆 ${t}`;
          listElem.appendChild(item);
        });
      }
    }
  }

  /* === CHANTIER 10 (v50.0): Sacred Blood Ritual & Mothership Orbit Extraction Sequence === */
  triggerSacredBloodRitualEpilogue() {
    if (this.sacredBloodRitualTriggered) return;
    this.sacredBloodRitualTriggered = true;

    if (this.audio && this.audio.playClanBloodRitualChant) {
      this.audio.playClanBloodRitualChant();
    }

    const overlay = document.getElementById('sacred-blood-ritual-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      this.scheduleMissionTask(() => overlay.classList.add('hidden'), 7);
    }

    if (this.player && this.player.clanMarkMesh) {
      this.player.clanMarkMesh.visible = true;
    }

    this.shiftBattlefieldMorale(50.0);
    this.saveClanHonorVault('RITUEL DU SANG SACRÉ YAUTJA (AVP 2004 APEX CANON)', 10000);

    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('👑 RITUEL DU SANG SACRÉ GRAVÉ : MAÎTRE DU GRAND CLAN APEX ! EXTRACTION ORBITALE CONFIRMÉE !');
    }
  }

  /* === CHANTIER 1 (v51.0): Clan Weapon Forge Interactive Modal [F3] === */
  toggleClanForgeModal() {
    const modal = document.getElementById('clan-armory-forge-modal');
    if (!modal) return;
    const isHidden = this.toggleTacticalModal(modal.id);
    if (!isHidden) {
      this.refreshClanForgeUI();
    }
  }

  refreshClanForgeUI() {
    if (!this.player) return;
    this.player.loadClanForgeUpgrades();
    const honorEl = document.getElementById('clan-forge-honor-balance');
    if (honorEl) honorEl.innerText = `${this.forge.getBalance().toLocaleString()} PTS`;
    const jellyEl = document.getElementById('forge-jelly-balance');
    if (jellyEl) jellyEl.innerText = `${this.player.royalJellyFlasks || 0} FIOLES`;

    const upgrades = [
      { id: 'btn-forge-combistick', key: 'barbedCombiStick', costHonor: 1500, costJelly: 2 },
      { id: 'btn-forge-smartdisc', key: 'serratedSmartDisc', costHonor: 2000, costJelly: 3 },
      { id: 'btn-forge-plasmacaster', key: 'overchargedCoil', costHonor: 2500, costJelly: 4 },
      { id: 'btn-forge-wristblades', key: 'masterWristblades', costHonor: 3000, costJelly: 5 },
      { id: 'btn-forge-enkidu', key: 'enkiduBattleplate', costHonor: 3000, costJelly: 5 },
      { id: 'btn-forge-burner-coil', key: 'burnerPlasmaCoil', costHonor: 3500, costJelly: 6 },
      { id: 'btn-forge-cauterizing', key: 'cauterizingWristblade', costHonor: 3200, costJelly: 5 },
      { id: 'btn-forge-ceramic-armor', key: 'ceramicThermalArmor', costHonor: 3600, costJelly: 5 },
      { id: 'btn-forge-dlex-targeting', key: 'dlexTargetingHUD', costHonor: 4000, costJelly: 6 }
    ];

    upgrades.forEach(u => {
      const btn = document.getElementById(u.id);
      if (btn) {
        const isForged = this.player.forgeUpgrades && this.player.forgeUpgrades[u.key];
        if (isForged) {
          btn.innerText = 'FORGÉ (ACTIF)';
          btn.disabled = true;
          btn.classList.add('btn-forged');
        } else {
          btn.innerText = `FORGER (${u.costHonor} PTS + ${u.costJelly} GELÉES)`;
          btn.disabled = false;
          btn.classList.remove('btn-forged');
          btn.onclick = () => this.purchaseClanForgeUpgrade(u.key, u.costHonor, u.costJelly);
        }
      }
    });
  }

  purchaseClanForgeUpgrade(key, costHonor, costJelly) {
    if (!this.player || this.player.forgeUpgrades?.[key] || this.forge.getBalance() < costHonor || (this.player.royalJellyFlasks || 0) < costJelly) {
      if (this.ui && this.ui.showAnnouncement) {
        this.ui.showAnnouncement('⚠️ RESSOURCES INSUFFISANTES POUR CETTE FORGE SACRÉE !');
      }
      return;
    }

    if (!this.forge.honorLedger.spend({ id: `clan-forge:${key}`, amount: costHonor, kind: 'clan-upgrade' })) return;
    this.player.royalJellyFlasks -= costJelly;
    this.player.forgeUpgrades[key] = true;

    try {
      localStorage.setItem('yautja_clan_forge', JSON.stringify(this.player.forgeUpgrades));
    } catch (e) {}

    this.player.loadClanForgeUpgrades();

    if (this.audio && this.audio.playClanForgeHammerClang) {
      this.audio.playClanForgeHammerClang();
    }

    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('⚒️ FORGE SACRÉE DU CLAN : AMÉLIORATION RITUELLE GRAVÉE DANS L\'ARSENAL !');
    }
    this.refreshClanForgeUI();
  }

  /* === CHANTIER 6 & MARC QA (v51.0): Radial Weapon Wheel [Tab] === */
  toggleWeaponWheel(show = null) {
    if (show === null) this.weaponWheel.toggle();
    else if (show) this.weaponWheel.open(); else this.weaponWheel.close();
    document.getElementById('yautja-radial-weapon-wheel')?.classList.add('hidden');
    this.isTimeDilated = false;
  }

  selectWeaponSlice(index) {
    const ids = ['wristblades', 'combistick', 'smart_disc', 'crossbow', 'shuriken', 'compound_bow', 'katana', 'viking_axe'];
    const id = ids[index - 1];
    if (id && this.player?.selectWeapon?.(id)) this.ui.showAnnouncement(`ARME : ${id.toUpperCase()}`);
    this.toggleWeaponWheel(false);
  }

  /* === CHANTIER 3 & ELENA QA (v52.0): Mothership Tactical Command Bridge [F4] === */
  toggleMothershipBridgeModal() {
    const modal = document.getElementById('mothership-bridge-modal');
    if (!modal) return;
    const isHidden = this.toggleTacticalModal(modal.id);
    if (!isHidden) {
      if (this.audio && this.audio.playBioMaskVisionCycle) {
        this.audio.playBioMaskVisionCycle();
      }
      this.refreshMothershipBridgeUI();
    }
  }

  refreshMothershipBridgeUI() {
    const currentHonor = this.forge.getBalance();
    const btnBarrage = document.getElementById('btn-orbital-barrage');
    const btnResupply = document.getElementById('btn-drop-pod-resupply');
    const btnBlessing = document.getElementById('btn-elders-blessing');

    if (btnBarrage) {
      btnBarrage.disabled = currentHonor < 4000;
      btnBarrage.style.opacity = currentHonor < 4000 ? '0.5' : '1.0';
    }
    if (btnResupply) {
      btnResupply.disabled = currentHonor < 2500;
      btnResupply.style.opacity = currentHonor < 2500 ? '0.5' : '1.0';
    }
    if (btnBlessing) {
      btnBlessing.disabled = currentHonor < 3000;
      btnBlessing.style.opacity = currentHonor < 3000 ? '0.5' : '1.0';
    }
  }

  callPlanetaryOrbitalBarrage() {
    const cost = 4000;
    if (!this.player || this.forge.getBalance() < cost) {
      if (this.ui && this.ui.showAnnouncement) {
        this.ui.showAnnouncement('⚠️ HONNEUR INSUFFISANT POUR LE BARRAGE PLANÉTAIRE (4000 REQUIS) !');
      }
      return;
    }
    const origin=this.player.position.clone();
    const impacts=Array.from({length:8},(_,index)=>origin.clone().add(new THREE.Vector3(Math.cos(index*Math.PI/4)*25,0,Math.sin(index*Math.PI/4)*25)));
    if(!canAccessLegacyAir(this.missionSupportContext,origin,60)||impacts.some(point=>!canAccessLegacyAir(this.missionSupportContext,point,2))){
      this.ui.showAnnouncement('BARRAGE REFUSÉ : LE SCÉNARIO OU L’ACCÈS PHYSIQUE AU CIEL NE PERMET PAS CETTE FRAPPE.');return false;
    }
    if (!this.forge.honorLedger.spend({ id: `${this.missionRun}:support:${++this._supportTransaction}`, amount: cost, kind: 'support' })) return false;
    this.refreshMothershipBridgeUI();
    this.closeTacticalModal('mothership-bridge-modal');

    if (this.audio && this.audio.playPlanetaryOrbitalBarrage) {
      this.audio.playPlanetaryOrbitalBarrage();
    }
    this.triggerCameraShake(2.5, 2.0);

    // Each actual target also needs its own physical sky access; the area
    // footprint cannot authorize damage through a smaller roof between samples.
    const attack={origin,radius:60,damage:1400,type:'plasma',killerFaction:this.battleSimulation?.config.playerFaction??'player_clan'};
    if (this.horde) {
      const actors=new Set([...(this.horde.aliens??[]),...(this.horde.eggs??[]),...(this.horde.chestbursters??[]),
        ...[...(this.battleBridge?.actors?.values()??[])].filter(entry=>entry.manager!==this.synthetics&&entry.manager!==this.bosses).map(entry=>entry.actor)]);
      for(const actor of actors)if(actor.mesh?.position.distanceTo(origin)<=60&&canHitLegacyAirTarget(this.missionSupportContext,actor))this.registerHits(this.horde.checkMeleeHits({...attack,targetOnly:actor}));
    }
    if (this.bosses?.activeBoss?.mesh.position.distanceTo(origin)<=60&&canHitLegacyAirTarget(this.missionSupportContext,this.bosses.activeBoss)) {
      this.bosses.takeDamage(1400,this.horde,{cause:'orbital-barrage',killerFaction:attack.killerFaction});
    }
    if (this.badBlood?.isActive&&this.badBlood.badBlood?.mesh.position.distanceTo(origin)<=60&&canHitLegacyAirTarget(this.missionSupportContext,this.badBlood.badBlood)) {
      this.badBlood.takeDamage(1400);
    }
    if (this.synthetics) {
      for(const actor of this.synthetics.androids??[])if(actor.mesh?.position.distanceTo(origin)<=60&&canHitLegacyAirTarget(this.missionSupportContext,actor))this.synthetics.checkHits({...attack,targetOnly:actor});
    }
    if (this.particles && this.particles.emitExplosion) {
      for(const point of impacts)this.particles.emitExplosion(point,25);
    }
    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('🚀 BARRAGE PLANÉTAIRE ORBITAL DÉPLOYÉ : 1400 DÉGÂTS DE SATURATION !');
    }
    return true;
  }

  callOrbitalDropPodResupply() {
    const cost = 2500;
    if (!this.player || this.forge.getBalance() < cost) {
      if (this.ui && this.ui.showAnnouncement) {
        this.ui.showAnnouncement('⚠️ HONNEUR INSUFFISANT POUR LA CAPSULE ORBITALE (2500 REQUIS) !');
      }
      return;
    }
    if (!this.forge.honorLedger.spend({ id: `${this.missionRun}:support:${++this._supportTransaction}`, amount: cost, kind: 'support' })) return;
    this.refreshMothershipBridgeUI();
    this.closeTacticalModal('mothership-bridge-modal');

    if (this.env && this.env.spawnOrbitalDropPodResupply) {
      const dropPos = this.player ? this.player.position.clone().add(new THREE.Vector3((Math.random() - 0.5) * 8, 0, (Math.random() - 0.5) * 8)) : new THREE.Vector3(0, 0, 0);
      this.env.spawnOrbitalDropPodResupply(dropPos, this.audio, this.particles, this.ui);
    }
  }

  callEldersEmergencyBlessing() {
    const cost = 3000;
    if (!this.player || this.forge.getBalance() < cost) {
      if (this.ui && this.ui.showAnnouncement) {
        this.ui.showAnnouncement('⚠️ HONNEUR INSUFFISANT POUR LE RITUEL DES ANCIENS (3000 REQUIS) !');
      }
      return;
    }
    if (!this.forge.honorLedger.spend({ id: `${this.missionRun}:support:${++this._supportTransaction}`, amount: cost, kind: 'support' })) return;
    this.refreshMothershipBridgeUI();
    this.closeTacticalModal('mothership-bridge-modal');

    if (this.player) {
      this.player.hp = this.player.maxHp;
      this.player.isFacehuggerLatched = false;
      this.player.isCorrosiveAcidBurned = false;
      this.player.acidBurnTimer = 0;
      this.player.medicompCharges = Math.min(5, (this.player.medicompCharges || 0) + 3);
      this.player.energy = this.player.maxEnergy;
    }

    if (this.audio && this.audio.playWarhornBlast) {
      this.audio.playWarhornBlast();
    }
    if (this.particles && this.particles.emitSparks) {
      this.particles.emitSparks(this.player.position, 40);
    }
    if (this.ui && this.ui.showAnnouncement) {
      this.ui.showAnnouncement('👑 BÉNÉDICTION DU CONSEIL DES ANCIENS : SANTÉ RESTAURÉE À 100% & PURIFICATION !');
    }
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.gamepadBridge.poll(delta);
    this.update(delta);
    // Frozen scenes need no repeated GPU work. Resize, quality and photo-camera
    // changes invalidate a frame; active combat keeps rendering every frame.
    const sceneIsMoving = this.isPlaying && !this.isPaused && !this.photoMode.isActive && !this.weaponWheel.isOpen;
    if (sceneIsMoving || this.renderer.needsRender) this.renderer.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new GameApp();
  } catch (error) {
    console.error('Impossible de démarrer le jeu', error);
    const notice = document.createElement('section');
    notice.className = 'startup-error glass-panel';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, {
      position: 'fixed', inset: '20% 10% auto', padding: '2rem', zIndex: '10000',
      background: '#0b1421', color: '#f1f5f9', border: '1px solid #ffb703', textAlign: 'center'
    });
    const title = document.createElement('h1');
    title.textContent = 'Le jeu ne peut pas démarrer';
    const detail = document.createElement('p');
    detail.textContent = "Vérifiez que WebGL et l’accélération graphique sont activés dans votre navigateur, puis rechargez la page.";
    const retry = document.createElement('button');
    retry.className = 'btn-primary';
    retry.textContent = 'Réessayer';
    retry.addEventListener('click', () => location.reload());
    notice.append(title, detail, retry);
    document.body.append(notice);
    retry.focus();
  }
});
