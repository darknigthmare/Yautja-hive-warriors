/* Xenomorph Swarm Engine 3.0 - Crusher, Praetorian, Ovimorph Eggs & Gore */

import * as THREE from 'three';
import { applyBattleUnit, despawnBattleActor, selectBattleTarget, listBattleTargets, battleHostile, moveBattleOrder, requestNPCStrike, applyBattleFormationHit, maintainBattleFormation } from '../engine/BattleActorSupport.js';
import { requestHostileAttack } from '../engine/HostilePressure.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';
import { disposeObject } from '../engine/SceneResources.js';
import { createCreatureModel, createEggModel, animateCreatureModel } from '../graphics/CreatureModels.js';

export class XenomorphHorde {
  constructor(scene, audioEngine, goreEngine = null) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.goreEngine = goreEngine;
    this.environment = null;
    this.aliens = [];
    this.eggs = [];
    this.chestbursters = [];
    this.acidPools = [];
    this.acidSplashes = [];
    this.zeroGAcidGlobules = [];
    this.deadCount = 0;
    this.combatDirector = null;
    this.spawnPositionProvider = null;
    this.supportTargetsProvider = null;
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    this.spawnSequence = 0;
    this.spawnPlacementSequence = 0;
    this.attackCues = new Map();

    this.acidSplashMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    this.zeroGAcidMat = new THREE.MeshStandardMaterial({
      color: 0x39ff14,
      emissive: 0x22aa00,
      transparent: true,
      opacity: 0.82,
      roughness: 0.2,
      metalness: 0.1
    });
    this.zeroGAcidCoreMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
    this.eggMat = new THREE.MeshStandardMaterial({ color: 0x3d3522, roughness: 0.7, metalness: 0.1 });
    this.eggPetalMat = new THREE.MeshStandardMaterial({ color: 0x5a2d1d, roughness: 0.5, metalness: 0.2 });
    this.crusherMat = new THREE.MeshStandardMaterial({ color: 0x151b24, roughness: 0.2, metalness: 0.9 });
    this.praetorianMat = new THREE.MeshStandardMaterial({ color: 0x0f141c, roughness: 0.3, metalness: 0.85 });
    this.officerMat = new THREE.MeshStandardMaterial({ color: 0x220505, roughness: 0.15, metalness: 0.95 });
    this.attackCueGeometry = new THREE.RingGeometry(0.82, 1, 36);
    this.attackCueGeometry.rotateX(-Math.PI / 2);
    this.attackCueMaterial = new THREE.MeshBasicMaterial({ color: 0xff8c32, transparent: true, opacity: 0.8, depthWrite: false, side: THREE.DoubleSide });
    this.sharedResources = new Set([this.attackCueGeometry, this.attackCueMaterial,
      this.acidSplashMat, this.zeroGAcidMat, this.zeroGAcidCoreMat, this.eggMat,
      this.eggPetalMat, this.crusherMat, this.praetorianMat, this.officerMat
    ]);

    this.spitterMortars = [];
    // Marvel Comics Canon Materials (v44.0)
    this.alphaMat = new THREE.MeshStandardMaterial({ color: 0xd9e2ec, roughness: 0.12, metalness: 0.95 }); // Epsilon Apex Silver Carapace
    this.cryoMat = new THREE.MeshStandardMaterial({ color: 0x93c5fd, roughness: 0.1, metalness: 0.65, transparent: true, opacity: 0.88 }); // Sub-Zero LV-695 Translucent Ice Chitin
    this.cyberMat = new THREE.MeshStandardMaterial({ color: 0x334155, roughness: 0.25, metalness: 0.98 }); // Steel Team Weyland-Yutani Titanium Cyber Plating
    this.microSwarmMat = new THREE.MeshBasicMaterial({ color: 0x0f172a }); // Midge Micro-Xenomorph Chitin

    // Chantier 7 (v46): Chameleon Stalker Optical Cloak Materials (Aliens: Rogue)
    this.chameleonMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.05,
      metalness: 0.95,
      transparent: true,
      opacity: 0.18
    });
    this.chameleonRevealedMat = new THREE.MeshStandardMaterial({
      color: 0x0284c7,
      emissive: 0x00f2fe,
      roughness: 0.2,
      metalness: 0.8
    });

    // Chantier 4 & 7 (v47): The Deacon Titan & Flying Manta Swarmer Materials (Prometheus & Marvel/Kenner)
    this.deaconMat = new THREE.MeshStandardMaterial({ color: 0x1e3a8a, roughness: 0.22, metalness: 0.88 });
    this.mantaMat = new THREE.MeshStandardMaterial({ color: 0x1e152a, roughness: 0.35, metalness: 0.8 });
    this.mantaWingMat = new THREE.MeshStandardMaterial({ color: 0x2e1065, roughness: 0.45, metalness: 0.6, transparent: true, opacity: 0.88, side: THREE.DoubleSide });

    // Chantier 6 (v48): The King Alien / Rogue Titan Material (Aliens: Rogue / Kenner Canon 1:1)
    this.rogueKingMat = new THREE.MeshStandardMaterial({ color: 0x3b0711, roughness: 0.18, metalness: 0.92 });

    // Chantier 2 & 6 (v49): Xenomorph Raven (Obsidian Carapace) & Ancient Predalien Elder (Primal Hunt Fossilized Chitin)
    this.ravenMat = new THREE.MeshStandardMaterial({ color: 0x090d16, roughness: 0.08, metalness: 0.98 });
    this.ancientPredalienMat = new THREE.MeshStandardMaterial({ color: 0x9c8f7a, roughness: 0.38, metalness: 0.65 });
    // Chantier 5 (v50): Gestating Alpha Hive Matriarch & Ovipositor Material (Aliens 1986 / Infestation)
    this.gestatingMatriarchMat = new THREE.MeshStandardMaterial({ color: 0x080c14, roughness: 0.12, metalness: 0.96 });
    this.ovipositorMat = new THREE.MeshStandardMaterial({ color: 0x78350f, emissive: 0x9a3412, emissiveIntensity: 0.45, roughness: 0.3, transparent: true, opacity: 0.85 });

    this.microSwarms = [];
    this.cyberSpineDarts = [];
    this.royalFacehuggers = [];
    this.mantaSwarmers = [];
    this.biomechanicalEggs = [];
    for (const key of ['alphaMat','cryoMat','cyberMat','microSwarmMat','chameleonMat','chameleonRevealedMat','deaconMat','mantaMat','mantaWingMat','rogueKingMat','ravenMat','ancientPredalienMat','gestatingMatriarchMat','ovipositorMat']) this.sharedResources.add(this[key]);
  }


  setGoreEngine(goreEngine) {
    this.goreEngine = goreEngine;
  }


  get pendingSpawnCount() { return this.pendingSpawns.length; }

  get remainingCount() { return this.getActiveCombatants().length + this.pendingSpawnCount; }


  recordDefeat(enemy, details = {}) {
    if (!enemy || enemy._defeatReported) return null;
    const event = recordCombatDeath(this, enemy, { kind: enemy.objectiveCommander ? 'commander' : (enemy.type ?? 'chestburster'), isOfficer: enemy.isOfficer === true, ...details }) ?? enemy.combatDeathEvent;
    if (!event) return null;
    enemy._defeatReported = true;
    this.deadCount++;
    this.combatDirector?.release(enemy);
    this._clearAttackCue(enemy);
    this.onDefeated?.({ ...event, position: enemy.mesh?.position.clone(), event });
    return event;
  }

  defeatAlien(enemy, details = {}) {
    if (!enemy) return null;
    if (enemy.type === 'boiler' && !enemy._boilerDetonated && !enemy._boilerQueued) {
      if(!details.deferEffects)return this.detonateBoiler(enemy, null, details);
      enemy._boilerQueued=true;this.pendingBoilerDetonations ??= [];this.pendingBoilerDetonations.push(enemy);
    }
    const event = this.recordDefeat(enemy, details);
    enemy.hp = 0;
    for (const key of ['aliens', 'chestbursters', 'mantaSwarmers', 'microSwarms', 'royalFacehuggers']) {
      const index = this[key]?.indexOf(enemy) ?? -1;
      if (index >= 0) this[key].splice(index, 1);
    }
    if (!enemy._combatDisposed) { disposeObject(enemy.mesh ?? enemy.group, this.sharedResources); enemy._combatDisposed = true; }
    return event;
  }

  applyDamage(enemy, amount, details = {}) {
    if (!enemy || !(enemy.hp > 0) || !Number.isFinite(amount) || amount <= 0) return null;
    if (this.battleSimulation && details.killerFaction && enemy.factionId && !this.battleSimulation.areHostile(details.killerFaction, enemy.factionId)) return null;
    const dealt = Math.min(enemy.hp, amount); enemy.hp = Math.max(0, enemy.hp - amount);
    enemy.lastDamageFaction = details.killerFaction ?? null;
    const event = enemy.hp === 0 ? this.defeatAlien(enemy, details) : null;
    return { damage: dealt, killed: enemy.hp === 0, event };
  }


  cancelPendingSpawns() {
    const cancelled = this.pendingSpawns.length;
    this.pendingSpawns = []; this.spawnTimer = 0;
    return cancelled;
  }

  // Add a telegraphed counter-attack to the existing encounter. Unlike a new
  // wave, this keeps living enemies, earned kills, hazards and attack turns.

  enqueueReinforcements(count) {
    const requested = Number(count);
    if (!Number.isFinite(requested) || requested <= 0) return 0;
    const accepted = Math.min(Math.floor(requested), Math.max(0, 200 - this.remainingCount));
    if (!accepted) return 0;
    // Finite objective quotas need enemies that remain creditable. A consumed
    // facehugger leaves the encounter without a defeat notification.
    this.pendingSpawns.push(...Array.from({ length: accepted }, () => 'counterattack'));
    // E must leave time to read the warning, even if the prior squad was due.
    this.spawnTimer = Math.max(Number.isFinite(this.spawnTimer) ? this.spawnTimer : 0, 3);
    return accepted;
  }


  _nearestPlayer(position, livingPlayers) {
    return livingPlayers.reduce((nearest, candidate) => !nearest || candidate.position.distanceToSquared(position) < nearest.position.distanceToSquared(position) ? candidate : nearest, null);
  }

  _supportTargets() {
    return (this.supportTargetsProvider?.() ?? []).filter(target => target?.isSupport && target.isBattleNPC && target.hp > 0 &&
      typeof target.takeDamage === 'function' && target.position?.isVector3 && target.position.toArray().every(Number.isFinite));
  }

  _canParasitize(target, royal = false) {
    const actor = target?.actor ?? target;
    return !!target && !target.isSupport && target.canBeFacehugged !== false && actor.canBeFacehugged !== false &&
      !['synthetic', 'weyland_combat', 'working_joe'].includes(actor.type) && (royal || typeof target.triggerFacehuggerLatch === 'function');
  }

  _pursuitTarget(actor, livingPlayers, supports = []) {
    const royal = this.royalFacehuggers.includes(actor), parasite = actor.type === 'facehugger' || royal;
    const eligible = target => (!parasite || this._canParasitize(target, royal)) &&
      (!target.isSupport || !target.isAirborne || this.mantaSwarmers.includes(actor));
    const fallbacks = [...livingPlayers, ...supports].filter(target => eligible(target) && battleHostile(this, actor, target));
    if (!actor.battleUnitId || !this.battleSimulation) return this._nearestPlayer(actor.mesh.position, fallbacks);
    const target = selectBattleTarget(this, actor, fallbacks);
    if (!target || eligible(target)) return target;
    // A shared battle provider may contain vehicles too. Parasites retarget an
    // eligible organic combatant without changing formation/defend constraints.
    const formation = actor.battleFormationTarget, defend = actor.battleOrder?.type === 'defend' ? actor.battleOrderTarget : null;
    return this._nearestPlayer(actor.mesh.position, listBattleTargets(this, actor, fallbacks).filter(candidate => eligible(candidate) &&
      (!Array.isArray(formation) || Math.hypot(candidate.position.x - formation[0], candidate.position.z - formation[1]) <= 28) &&
      (!Array.isArray(defend) || Math.hypot(candidate.position.x - defend[0], candidate.position.z - defend[1]) <= 24)));
  }


  _spawnPosition(playerPos, distance = 34) {
    if (this.spawnPositionProvider) {
      const result = this.spawnPositionProvider(playerPos, distance, this.spawnPlacementSequence++);
      return result?.isVector3 && result.toArray().every(Number.isFinite) ? result.clone().setY(0) : null;
    }
    const angle = Math.random() * Math.PI * 2;
    const radius = distance + Math.random() * 14;
    const position = new THREE.Vector3(playerPos.x + Math.cos(angle) * radius, 0, playerPos.z + Math.sin(angle) * radius);
    this.environment?.resolveMovement?.(position, 1.2);
    return position.distanceToSquared(playerPos) >= 20 * 20 ? position : null;
  }


  spawnWave(count, playerPos) {
    this.clearWave();
    const totalCount = Math.max(0, Math.min(200, Math.floor(Number(count) || 0)));
    this.spawnSequence = 0;
    this.spawnPlacementSequence = 0;
    if (!totalCount) return;
    this.spawnOvimorphEggs(playerPos, Math.min(this.combatDirector ? 2 : 6, Math.ceil(totalCount / 8)));
    const specialKinds = ['crusher', 'praetorian', 'praetorian', 'grid_alien', 'officer', 'officer'].slice(0, Math.floor(totalCount / 8));
    this.pendingSpawns = [
      ...Array.from({ length: totalCount - specialKinds.length }, () => 'regular'),
      ...specialKinds
    ];
    const initialCount = this.combatDirector ? Math.min(6, totalCount) : totalCount;
    for (let i = 0; i < initialCount && this.pendingSpawns.length; i++) {
      if (!this._spawnQueued(playerPos)) break;
    }
    this.spawnTimer = 3;
  }


  _spawnQueued(playerPos) {
    if (!this.pendingSpawns.length) return false;
    const position = this._spawnPosition(playerPos, this.combatDirector ? 34 : 22);
    if (!position) return false;
    const kind = this.pendingSpawns.shift();
    if (kind === 'regular' || kind === 'counterattack') this._spawnRegular(position, { allowFacehuggers: kind !== 'counterattack' });
    else {
      const before = this.aliens.length;
      if (kind === 'crusher') this.spawnCrusher(position);
      else if (kind === 'praetorian') this.spawnPraetorian(position);
      else if (kind === 'grid_alien') this.spawnGridAlien(position);
      else this.spawnHiveOfficer(position);
      const enemy = this.aliens[before];
      enemy.mesh.position.copy(position);
    }
    return true;
  }


  _spawnRegular(position, { allowFacehuggers = true } = {}) {
    const introductory = this.combatDirector && this.spawnSequence < 6;
    const isFacehugger = allowFacehuggers && !introductory && Math.random() < 0.16;
    const isBoiler = !introductory && !isFacehugger && Math.random() < 0.16;
    const isNeomorph = !introductory && !isFacehugger && !isBoiler && Math.random() < 0.16;
    const isPraetomorph = !introductory && !isFacehugger && !isBoiler && !isNeomorph && Math.random() < 0.18;
    const isRedSwarm = !introductory && !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && Math.random() < 0.22;
    const isSpitter = !introductory && !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && Math.random() < 0.25;
    const isRunner = !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && Math.random() < 0.30;
    const alien = this.createAlienMesh(isFacehugger, isBoiler, isNeomorph, isPraetomorph, isRedSwarm, isSpitter, isRunner);

    alien.position.copy(position);

    const isWallStalker = !introductory && !isFacehugger && !isBoiler && !isNeomorph && !isPraetomorph && !isRedSwarm && !isSpitter && !isRunner && Math.random() < 0.22;
    this.scene.add(alien);
    const aType = isFacehugger ? 'facehugger' : (isBoiler ? 'boiler' : (isNeomorph ? 'neomorph' : (isPraetomorph ? 'praetomorph' : (isRedSwarm ? 'red_warrior' : (isSpitter ? 'spitter' : (isRunner ? 'runner' : 'warrior'))))));
    const aHp = isFacehugger ? 40 : (isBoiler ? 80 : (isNeomorph ? 95 : (isPraetomorph ? 160 : (isRedSwarm ? 140 : (isSpitter ? 110 : (isRunner ? 85 : 120))))));
    const aSpeed = isFacehugger ? 17 : (isBoiler ? 14 : (isNeomorph ? 19 : (isPraetomorph ? 16 : (isRedSwarm ? 15.5 : (isSpitter ? 12 : (isRunner ? 21.0 : 11))))));
    const aDmg = isFacehugger ? 15 : (isBoiler ? 50 : (isNeomorph ? 35 : (isPraetomorph ? 42 : (isRedSwarm ? 34 : (isSpitter ? 30 : (isRunner ? 28 : 25))))));

    this.aliens.push({ combatManager: this,
      pressureId: this.spawnSequence++,
      mesh: alien,
      type: aType,
      hp: aHp,
      maxHp: aHp,
      speed: aSpeed,
      damage: aDmg,
      radius: isFacehugger ? 0.6 : (isNeomorph ? 0.9 : (isPraetomorph ? 1.3 : (isRunner ? 0.85 : 1.1))),
      isLatched: false,
      isWallStalker: isWallStalker,
      wallClimbPhase: isWallStalker ? 'climbing' : 'grounded',
      perchHeight: 8.0 + Math.random() * 4.0,
      leapCooldown: (isNeomorph || isPraetomorph) ? 2.0 + Math.random() * 2.0 : 0,
      spitCooldown: isSpitter ? 2.5 + Math.random() * 2.0 : 0,
      isLeaping: false,
      leapVelY: 0,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }


  _clearAttackCue(enemy) {
    const cue = this.attackCues.get(enemy);
    if (cue) { this.scene.remove(cue); this.attackCues.delete(enemy); }
  }


  _showAttackCue(enemy) {
    const state = this.combatDirector?.getAttackState(enemy) ?? (enemy._npcPreparation > 0 ? { phase: 'windup', progress: enemy._npcPreparation / (enemy._npcWindup || 1) } : null);
    if (state?.phase !== 'windup') { this._clearAttackCue(enemy); return; }
    let cue = this.attackCues.get(enemy);
    if (!cue) {
      cue = new THREE.Mesh(this.attackCueGeometry, this.attackCueMaterial);
      cue.name = 'enemy-attack-warning'; this.scene.add(cue); this.attackCues.set(enemy, cue);
    }
    cue.position.copy(enemy.mesh.position); cue.position.y = 0.065;
    cue.scale.setScalar((enemy.radius || 1.1) + 0.7 + state.progress * 0.35);
  }


  _requestAttack(enemy, player, options) {
    const group=this.battleSimulation?.groups?.get(enemy.battleGroupId);
    if((group?.rootUntil ?? 0)>(this.battleSimulation?.time ?? 0))return false;
    if((group?.suppressedUntil ?? 0)>(this.battleSimulation?.time ?? 0))options={...options,windup:(options.windup ?? .8)*1.6};
    if (this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(enemy.mesh.position.clone().add(new THREE.Vector3(0,1.4,0)), player.position.clone().add(new THREE.Vector3(0,1.6,0)), { ignoreOwner: player.isSupport ? player.collisionOwner : undefined })) { this.combatDirector?.release(enemy); this._clearAttackCue(enemy); return false; }
    if (player.isBattleNPC) return requestNPCStrike(enemy, player, this._simulationDelta ?? 1/60, options);
    if (!this.combatDirector) return requestNPCStrike(enemy, player, this._simulationDelta ?? 1/60, options);
    const allowed = this.combatDirector.requestAttack(enemy, player, options);
    this._showAttackCue(enemy);
    return allowed;
  }


  _hazardDamage(source, player, amount) {
    if (player.isSupport) return player.takeDamage(amount, source);
    if (player.isBattleNPC) { player.takeDamage(amount, true, source); return amount; }
    if (this.combatDirector) return this.combatDirector.applyHazardDamage(source, player, amount);
    player.takeDamage(amount, true);
    return amount;
  }


  spawnHiveOfficer(playerPos, offsetX = 0, title = 'GARDE DE NŒUD KAINDE AMEDHA') {
    const group = createCreatureModel('officer', this.sharedResources);
    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'officer',
      pressureId: this.spawnSequence++,
      officerTitle: title,
      isOfficer: true,
      hp: 350,
      maxHp: 350,
      speed: 13.5,
      damage: 38,
      radius: 1.6,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
    return this.aliens[this.aliens.length - 1];
  }


  spawnCrusher(playerPos) {
    const group = createCreatureModel('crusher', this.sharedResources);
    group.position.set(playerPos.x, 0, playerPos.z - 35);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'crusher',
      pressureId: this.spawnSequence++,
      hp: 750,
      maxHp: 750,
      speed: 16,
      damage: 60,
      radius: 2.8,
      isCharging: false,
      chargeTimer: 3.0
    });
  }


  spawnPraetorian(playerPos, offsetX = 0) {
    const group = createCreatureModel('praetorian', this.sharedResources);
    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 28);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'praetorian',
      pressureId: this.spawnSequence++,
      hp: 480,
      maxHp: 480,
      speed: 13,
      damage: 40,
      radius: 1.8,
      spitCooldown: 2.0
    });
  }


  spawnGridAlien(playerPos) {
    const group = createCreatureModel('grid', this.sharedResources);
    group.position.set(playerPos.x + 12, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'grid_alien',
      pressureId: this.spawnSequence++,
      hp: 420,
      maxHp: 420,
      speed: 15,
      damage: 45,
      radius: 1.6,
      isNetgunImmune: true,
      spurtCooldown: 0
    });
  }


  spawnOvimorphEggs(playerPos, count = 5) {
    for (let i = 0; i < count; i++) {
      const angle = (i / count) * Math.PI * 2 + Math.random() * 0.5;
      const radius = (this.combatDirector ? 30 : 15) + Math.random() * 18;
      const x = playerPos.x + Math.cos(angle) * radius;
      const z = playerPos.z + Math.sin(angle) * radius;

      const eggPosition = this.spawnPositionProvider ? this._spawnPosition(playerPos, 30) : new THREE.Vector3(x, 0, z);
      if (!eggPosition) continue;
      const eggGroup = createEggModel(this.sharedResources);
      eggGroup.position.copy(eggPosition);
      const petals = eggGroup.children.filter(part => part.name.startsWith('petal-'));

      this.scene.add(eggGroup);
      this.eggs.push({
        mesh: eggGroup,
        petals,
        isOpen: false,
        hatched: false
      });
    }
  }


  createAlienMesh(isFacehugger, isBoiler = false, isNeomorph = false, isPraetomorph = false, isRedSwarm = false, isSpitter = false, isRunner = false, isCryoXeno = false, isCyberXeno = false, isRoyalFacehugger = false) {
    if (isCryoXeno || isCyberXeno || isRoyalFacehugger) return this.createLegacyAlienMesh(isFacehugger, isBoiler, isNeomorph, isPraetomorph, isRedSwarm, isSpitter, isRunner, isCryoXeno, isCyberXeno, isRoyalFacehugger);
    const kind = isFacehugger ? 'facehugger' : isBoiler ? 'boiler' : isNeomorph ? 'neomorph'
      : isPraetomorph ? 'praetomorph' : isRedSwarm ? 'red_warrior' : isSpitter ? 'spitter' : isRunner ? 'runner' : 'warrior';
    return createCreatureModel(kind, this.sharedResources);
  }


  createChestbursterMesh() {
    return createCreatureModel('chestburster', this.sharedResources);
  }


  checkMeleeHits(attack) {
    const hits = [];
    if (!attack?.origin || !Number.isFinite(attack.damage) || attack.damage <= 0 || !Number.isFinite(attack.radius) || attack.radius < 0) return hits;
    const attackingFaction = attack.killerFaction ?? this.battleSimulation?.config.playerFaction ?? 'player_clan';

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      if (attack.targetOnly && a !== attack.targetOnly) continue;
      if (a.isLatched) continue;
      if (this.battleSimulation && a.factionId && !this.battleSimulation.areHostile(attackingFaction, a.factionId)) continue;
      if (this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(attack.origin.clone().add(new THREE.Vector3(0,1.2,0)), a.mesh.position.clone().add(new THREE.Vector3(0,1.2,0)))) continue;
      if (a.hp <= 0) { this.defeatAlien(a, { cause: 'prior-combat', killerFaction: a.lastDamageFaction }); continue; }
      const dist = a.mesh.position.distanceTo(attack.origin);

      if (dist <= attack.radius + (a.radius || 1.0)) {
        let dealt = applyBattleFormationHit(this,a,attack);
        const thermal = /plasma|flame|fire|incendiary/.test(attack.type ?? '');
        if (a.regenActive && thermal) a.regenActive = false;
        if (a.isFrontalShielded && /ballistic|bullet|rifle|rail/.test(attack.type ?? '')) {
          const toward = attack.origin.clone().sub(a.mesh.position).setY(0).normalize(), forward = new THREE.Vector3(0,0,1).applyQuaternion(a.mesh.quaternion);
          if (toward.dot(forward) > .4) dealt *= .25;
        }
        if (a.isFrontalShielded && (attack.damage >= 250 || attack.isLauncher || thermal)) a.isFrontalShielded = false;
        a.lastDamageFaction = attackingFaction;
        a.hp -= dealt;
        const killed = a.hp <= 0;

        // Reactive Acid Splashback Physics (slashing xenos sprays pressurized molecular acid back at attacker)
        if (attack.origin) {
          this.spawnAcidSplash(a.mesh.position, attack.origin, { source: a });
        }

        // Grid Alien's grid-lattice scars squirt pressurized acid pools when struck!
        if (a.type === 'grid_alien') {
          this.spawnAcidPool(a.mesh.position);
        }

        // Dynasty Warriors Musou Launcher & Knockback Physics
        if (!killed && attack.origin) {
          const knockDir = a.mesh.position.clone().sub(attack.origin).setY(0).normalize();
          if (knockDir.lengthSq() < 0.001) knockDir.set(0, 0, 1);

          if (attack.isLauncher) {
            a.isAirborne = true;
            a.airborneVelY = attack.launchVelY || 18.0;
            a.airborneVelHoriz = knockDir.clone().multiplyScalar(Math.min(attack.knockback || 6.0, 12.0));
          } else if (attack.knockback) {
            a.mesh.position.addScaledVector(knockDir, attack.knockback);
          }
        }

        hits.push({
          pos: a.mesh.position.clone(),
          damage: attack.damage,
          killed: killed,
          isOfficer: a.isOfficer || false,
          officerTitle: a.officerTitle || null
        });

        if (killed) {
          if (a.type === 'boiler') {
            this.detonateBoiler(a, attack.origin, { cause: attack.type ?? 'melee', killerFaction: attackingFaction });
          } else {
            if (this.goreEngine) {
              this.goreEngine.spawnDismemberment(a.mesh.position, attack.type || 'wristblades');
            }

            if (Math.random() < 0.15 && a.type !== 'crusher' && !a.isOfficer) {
              this.spawnChestburster(a.mesh.position);
            }

            this.spawnAcidPool(a.mesh.position);
            // Spawn 1-2 Zero-G Floating Acid Globules (Alien: Romulus 2024 Lore)
            const globCount = Math.floor(1 + Math.random() * 2);
            for (let g = 0; g < globCount; g++) {
              this.spawnZeroGAcidGlobule(a.mesh.position);
            }
            this.defeatAlien(a, { cause: attack.type ?? 'melee', killerFaction: attackingFaction });
          }
          hits[hits.length - 1].event = a.combatDeathEvent;
        }
      }
    }

    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      if (attack.targetOnly && egg !== attack.targetOnly) continue;
      if (egg.mesh.position.distanceTo(attack.origin) <= attack.radius + 1.0) {
        this.spawnAcidPool(egg.mesh.position);
        const event = recordCombatDeath(this, egg, { kind: 'ovimorph', cause: attack.type ?? 'melee', objectiveCredit: false });
        disposeObject(egg.mesh, this.sharedResources);
        this.eggs.splice(i, 1);
        hits.push({
          pos: egg.mesh.position.clone(),
          damage: attack.damage,
          killed: true, event
        });
      }
    }

    for (let i = this.chestbursters.length - 1; i >= 0; i--) {
      const cb = this.chestbursters[i];
      if (attack.targetOnly && cb !== attack.targetOnly) continue;
      if (cb.mesh.position.distanceTo(attack.origin) > attack.radius + 0.5) continue;
      cb.hp -= attack.damage;
      const killed = cb.hp <= 0;
      hits.push({ pos: cb.mesh.position.clone(), damage: attack.damage, killed });
      if (killed) {
        hits[hits.length - 1].event = this.defeatAlien(cb, { cause: attack.type ?? 'melee', killerFaction: attackingFaction });
      }
    }

    return hits;
  }


  limitHazards(list, max) {
    while (list.length >= max) disposeObject(list.shift().mesh, this.sharedResources);
  }


  spawnAcidSplash(originPos, targetPos, { source = null } = {}) {
    const splashDir = targetPos.clone().sub(originPos).normalize();
    // Add realistic arc and spread
    for (let s = 0; s < 3; s++) {
      const spread = splashDir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.3 + Math.random() * 0.3,
        (Math.random() - 0.5) * 0.4
      )).normalize();

      this.limitHazards(this.acidSplashes, 160);
      const dropGeo = new THREE.SphereGeometry(0.12, 6, 6);
      const dropMesh = new THREE.Mesh(dropGeo, this.acidSplashMat);
      dropMesh.position.copy(originPos).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(dropMesh);

      this.acidSplashes.push({
        mesh: dropMesh,
        vel: spread.multiplyScalar(16 + Math.random() * 6),
        gravity: -28,
        life: 0.9,
        damage: 18, sourceFaction: source?.factionId ?? null
      });
    }
  }


  spawnChestburster(pos) {
    if (this.battleSimulation) return null; // Births require a previously allocated strategic identity.
    this.limitHazards(this.chestbursters, 40);
    const mesh = this.createChestbursterMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.chestbursters.push({ combatManager: this,
      mesh,
      hp: 30,
      speed: 18,
      damage: 12
    });
    this.audioEngine.playXenoHiss();
  }


  spawnAcidPool(pos) {
    this.limitHazards(this.acidPools, 80);
    const geo = new THREE.CylinderGeometry(1.8, 1.8, 0.05, 12);
    const mat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.7 });
    const pool = new THREE.Mesh(geo, mat);
    pool.position.set(pos.x, 0.02, pos.z);
    this.scene.add(pool);

    this.acidPools.push({ mesh: pool, life: 10 });
  }


  spawnZeroGAcidGlobule(pos) {
    this.limitHazards(this.zeroGAcidGlobules, 80);
    const group = new THREE.Group();
    const radius = 0.22 + Math.random() * 0.18;
    const sphere = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 12), this.zeroGAcidMat);
    group.add(sphere);

    const core = new THREE.Mesh(new THREE.SphereGeometry(radius * 0.45, 8, 8), this.zeroGAcidCoreMat);
    group.add(core);

    const spawnY = Math.max(0.8, Math.min(3.2, (pos.y || 0) + 1.2 + (Math.random() - 0.5) * 1.0));
    group.position.set(
      pos.x + (Math.random() - 0.5) * 1.5,
      spawnY,
      pos.z + (Math.random() - 0.5) * 1.5
    );

    this.scene.add(group);
    this.zeroGAcidGlobules.push({
      mesh: group,
      baseY: group.position.y,
      floatTime: Math.random() * Math.PI * 2,
      driftVel: new THREE.Vector3((Math.random() - 0.5) * 1.2, (Math.random() - 0.5) * 0.3, (Math.random() - 0.5) * 1.2),
      life: 14.0,
      radius: radius
    });
  }


  update(delta, player, secondaryPlayer = null) {
    if (!Number.isFinite(delta) || delta < 0) return;
    this._livingPlayers = [player, secondaryPlayer].filter(p => p && p.hp !== 0);
    // Environmental, ally, support and legacy weapon damage all converge here.
    for (const actor of [...this.getActiveCombatants()]) if (actor.hp <= 0) this.defeatAlien(actor, { cause: 'combat', killerFaction: actor.lastDamageFaction, deferEffects:delta===0 });
    for(const actor of [...this.aliens])if(actor.isLatched) {
      if(actor.battleUnitId && this.battleSimulation)recordCombatDeath(this,actor,{kind:actor.type,cause:'parasite-consumed',objectiveCredit:false});
      this.combatDirector?.release(actor);this._clearAttackCue(actor);
      if(!actor._combatDisposed){disposeObject(actor.mesh,this.sharedResources);actor._combatDisposed=true;}
      this.aliens.splice(this.aliens.indexOf(actor),1);
    }
    if(delta===0)return; // Settle completed deaths without advancing an attack or timer.
    this._simulationDelta = delta; this.time = (this.time ?? 0) + delta;
    for(const actor of this.pendingBoilerDetonations ?? []){actor._boilerQueued=false;this.detonateBoiler(actor,null,{cause:'deferred-boiler-explosion',killerFaction:actor.lastDamageFaction});}
    this.pendingBoilerDetonations=[];
    const livingPlayers = this._livingPlayers;
    if (!livingPlayers.length) return;
    player = livingPlayers[0];
    if (!this.battleSimulation && this.pendingSpawns.length && !this.combatDirector?.isInGrace) {
      this.spawnTimer -= delta;
      if (this.spawnTimer <= 0) {
        for (let i = 0; i < 4 && this.pendingSpawns.length; i++) if (!this._spawnQueued(player.position)) break;
        this.spawnTimer = 3;
      }
    }
    // Resolve damage from allied AI/net traps, and remove consumed facehuggers.
    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const alien = this.aliens[i];
      if (alien.isLatched) {
        if (alien.battleUnitId && this.battleSimulation) recordCombatDeath(this, alien, {kind:alien.type,cause:'parasite-consumed',objectiveCredit:false});
        this.combatDirector?.release(alien); this._clearAttackCue(alien);
        disposeObject(alien.mesh, this.sharedResources);
        this.aliens.splice(i, 1);
      } else if (alien.hp <= 0) {
        if (alien.type === 'boiler') this.detonateBoiler(alien, player);
        else {
          this.goreEngine?.spawnDismemberment(alien.mesh.position);
          this.spawnAcidPool(alien.mesh.position);
          disposeObject(alien.mesh, this.sharedResources);
          this.aliens.splice(i, 1);
          this.recordDefeat(alien);
        }
      }
    }

    // Egg hatching uses simulation time: pause and clearWave cannot leak new enemies.
    this.eggs.forEach(egg => {
      if (this.battleSimulation) return; // No unallocated local births in a finite operation.
      const eggTarget = this._nearestPlayer(egg.mesh.position, livingPlayers);
      if (!egg.hatched && !egg.isOpen && !this.combatDirector?.isInGrace && egg.mesh.position.distanceTo(eggTarget.position) < 7) {
        egg.isOpen = true;
        egg.hatchTimer = 0.8;
        egg.petals.forEach(p => {
          p.rotation.x *= 2.2;
          p.rotation.z *= 2.2;
        });
        this.audioEngine.playXenoHiss();
      }
      if (egg.hatched || !egg.isOpen) return;
      egg.hatchTimer -= delta;
      if (egg.hatchTimer > 0) return;
      const facehugger = this.createAlienMesh(true);
      facehugger.position.copy(egg.mesh.position).setY(0.5);
      this.scene.add(facehugger);
      this.aliens.push({ combatManager: this, mesh: facehugger, type: 'facehugger', pressureId: this.spawnSequence++, hp: 40, maxHp: 40,
        speed: 17, damage: 15, radius: 0.6, isLatched: false });
      egg.hatched = true;
    });

    // 2. Chestbursters
    for (let i = this.chestbursters.length - 1; i >= 0; i--) {
      const cb = this.chestbursters[i];
      const targetPlayer = this._nearestPlayer(cb.mesh.position, livingPlayers);
      const dir = targetPlayer.position.clone().sub(cb.mesh.position);
      dir.y = 0;
      if (dir.length() > 1.0) {
        dir.normalize();
        cb.mesh.position.addScaledVector(dir, cb.speed * delta);
        if (cb.mesh.position.y <= 0.2) this.environment?.resolveAgentMovement(cb.mesh.position, targetPlayer.position, cb.speed * delta, 0.5);
        cb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        if (this._requestAttack(cb, targetPlayer, { windup: 0.7, recovery: 1.4 })) targetPlayer.takeDamage(cb.damage, false, cb, { attackKind: 'bite', blockable: false, parryable: false });
      }
    }

    // 3. Acid pools
    for (let i = this.acidPools.length - 1; i >= 0; i--) {
      const pool = this.acidPools[i];
      pool.life -= delta;
      for (const targetPlayer of livingPlayers) if (pool.mesh.position.distanceTo(targetPlayer.position) < 1.8) {
        this._hazardDamage(pool, targetPlayer, 15 * delta);
      }
      if (pool.life <= 0) {
        disposeObject(pool.mesh, this.sharedResources);
        this.acidPools.splice(i, 1);
      }
    }

    // 3b. Reactive Acid Splashback Droplets Flying
    for (let i = this.acidSplashes.length - 1; i >= 0; i--) {
      const splash = this.acidSplashes[i];
      splash.life -= delta;
      splash.vel.y += splash.gravity * delta;
      const previous = splash.mesh.position.clone(); splash.mesh.position.addScaledVector(splash.vel, delta);
      const cover = this.environment?.traceSegment?.(previous, splash.mesh.position, {radius:.12});
      if (cover) { disposeObject(splash.mesh, this.sharedResources); this.acidSplashes.splice(i,1); continue; }

      // A projectile hits the nearest intersected living hunter, including player2.
      const targetPlayer = this.battleSimulation && splash.sourceFaction ? selectBattleTarget(this, {mesh:splash.mesh,factionId:splash.sourceFaction}, livingPlayers) : this._nearestPlayer(splash.mesh.position, livingPlayers);
      if (targetPlayer && splash.mesh.position.distanceTo(targetPlayer.position) < 1.6) {
        this._hazardDamage(splash, targetPlayer, splash.damage);
        disposeObject(splash.mesh, this.sharedResources);
        this.acidSplashes.splice(i, 1);
        continue;
      }

      // Check floor collision or life expiry
      if (splash.mesh.position.y <= 0.05 || splash.life <= 0) {
        disposeObject(splash.mesh, this.sharedResources);
        this.acidSplashes.splice(i, 1);
      }
    }

    // 3c. Zero-G Floating Acid Globules (Alien: Romulus 2024 Lore)
    for (let i = this.zeroGAcidGlobules.length - 1; i >= 0; i--) {
      const glob = this.zeroGAcidGlobules[i];
      glob.life -= delta;
      glob.floatTime += delta * 2.2;
      glob.mesh.position.y = glob.baseY + Math.sin(glob.floatTime) * 0.35;
      glob.mesh.position.addScaledVector(glob.driftVel, delta);
      if (glob.mesh.children[0]) {
        glob.mesh.children[0].scale.setScalar(1.0 + Math.sin(glob.floatTime * 3) * 0.12);
      }

      const targetPlayer = this._nearestPlayer(glob.mesh.position, livingPlayers);
      const pDist = glob.mesh.position.distanceTo(targetPlayer.position);
      if (pDist <= 1.4) {
        this._hazardDamage(glob, targetPlayer, 24);
        this.audioEngine?.playAcidGlobuleHiss?.();
        disposeObject(glob.mesh, this.sharedResources);
        this.zeroGAcidGlobules.splice(i, 1);
        continue;
      }

      // Check collision with nearby aliens
      for (let j = 0; j < this.aliens.length; j++) {
        const al = this.aliens[j];
        if (al.mesh.position.distanceTo(glob.mesh.position) < 1.3) {
          al.hp -= 140; // Molecular acid dissolving xenomorph carapace
          if (this.audioEngine && this.audioEngine.playAcidGlobuleHiss) {
            this.audioEngine.playAcidGlobuleHiss();
          }
          disposeObject(glob.mesh, this.sharedResources);
          this.zeroGAcidGlobules.splice(i, 1);
          break;
        }
      }

      if (glob.life <= 0) {
        disposeObject(glob.mesh, this.sharedResources);
        this.zeroGAcidGlobules.splice(i, 1);
      }
    }

    const supportTargets = this._supportTargets();
    this._updateExtraActors(delta, livingPlayers, supportTargets);

    // 4. Horde AI (Crusher, Praetorian, Warriors, Facehuggers, Officers)
    this.aliens.forEach(a => {
      this._showAttackCue(a);
      if(!a.isAirborne && !a.isLeaping && !a.isLatched && maintainBattleFormation(this,a,delta,a.speed))return;
      const targetPlayer = this._pursuitTarget(a, livingPlayers, supportTargets);
      if (!targetPlayer) { this.combatDirector?.release(a); this._clearAttackCue(a); moveBattleOrder(this, a, delta, a.speed); return; }
      if (a.isFeared) { a.fearTimer -= delta; if (a.fearTimer <= 0) a.isFeared = false; else { a.mesh.position.addScaledVector(a.fearDir, a.speed * delta * .7); this.environment?.resolveMovement?.(a.mesh.position, a.radius); return; } }
      if (a.regenActive && a.hp > 0) a.hp = Math.min(a.maxHp, a.hp + 35 * delta);
      if (a.isChameleon) { a.revealTimer = Math.max(0, (a.revealTimer ?? 0) - delta); const visible = a.revealTimer > 0 || a._localAttackPreparation || this.combatDirector?.getAttackState(a)?.phase === 'windup'; a.mesh.traverse(mesh => { if (mesh.isMesh && mesh.material && mesh.material !== this.attackCueMaterial) mesh.material.opacity = visible ? .95 : .28; }); }

      if (a.isLatched) return;
      a.visualPhase = (a.visualPhase || 0) + delta * Math.max(3, (a.speed || 10) * 0.8);
      animateCreatureModel(a.mesh, a.visualPhase, !a.isStunned && !a.isNetEntangled);

      // Airborne Juggling Physics (Dynasty Warriors Musou C2/C5 Launchers)
      if (a.isAirborne) {
        this.combatDirector?.release(a); this._clearAttackCue(a);
        a.airborneVelY -= 36.0 * delta; // Gravity
        a.mesh.position.y += a.airborneVelY * delta;
        if (a.airborneVelHoriz) {
          a.mesh.position.addScaledVector(a.airborneVelHoriz, delta);
        }
        // Ragdoll spin in mid-air
        a.mesh.rotation.x += 8.0 * delta;
        a.mesh.rotation.z += 5.0 * delta;

        // Ground impact
        if (a.mesh.position.y <= 0) {
          a.mesh.position.y = 0;
          a.isAirborne = false;
          a.airborneVelY = 0;
          a.mesh.rotation.x = 0;
          a.mesh.rotation.z = 0;
        }
        return; // Helpless while airborne in juggle arc
      }

      // Netgun Entangled State
      if (a.isNetEntangled) {
        this.combatDirector?.release(a); this._clearAttackCue(a);
        if (a.isNetgunImmune) {
          // Grid Alien (Nethead) has already melted and broken Celtic's net in AVP 2004!
          a.isNetEntangled = false;
        } else {
          a.netTimer -= delta;
          a.hp -= 25 * delta; // Razor wire cuts deep!
          a.mesh.rotation.y += Math.sin(this.time * 50) * delta * 3;
          if (a.netTimer <= 0) {
            a.isNetEntangled = false;
          }
          return; // Completely immobilized
        }
      }

      // Stunned State (Crusher or Praetorian)
      if (a.isStunned) {
        this.combatDirector?.release(a); this._clearAttackCue(a);
        a.stunTimer -= delta;
        a.mesh.rotation.z = Math.sin(this.time * 20) * 0.1;
        if (a.stunTimer <= 0) {
          a.isStunned = false;
          a.mesh.rotation.z = 0;
        }
        return;
      }

      const dir = targetPlayer.position.clone().sub(a.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      const engaged = targetPlayer.isBattleNPC || !this.combatDirector || (dist < 22 && this.combatDirector.canEngage(a, targetPlayer));
      if (this.combatDirector && !targetPlayer.isBattleNPC && !engaged) {
        this.combatDirector.release(a); this._clearAttackCue(a);
        const id = a.pressureId ?? 0;
        const angle = id * 2.399963229728653 + this.combatDirector.time * 0.12;
        const holdingRadius = 6.5 + id % 4 * 1.3;
        const holding = targetPlayer.position.clone().add(new THREE.Vector3(Math.cos(angle) * holdingRadius, 0, Math.sin(angle) * holdingRadius));
        const offset = holding.sub(a.mesh.position).setY(0);
        const distance = offset.length();
        if (distance > 0.5) {
          offset.normalize();
          const step = Math.min(distance, a.speed * delta * (this.combatDirector.isInGrace ? 0.35 : 0.65));
          a.mesh.position.addScaledVector(offset, step);
          this.environment?.resolveAgentMovement(a.mesh.position, targetPlayer.position.clone().addScaledVector(offset, holdingRadius), step, Math.min(a.radius || 1, 1.2));
        }
        a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
        return;
      }

      // Wall-Climbing & Ceiling Drop Ambush AI (Alien 1979 / Aliens 1986 Lore)
      if (a.isWallStalker) {
        if (a.wallClimbPhase === 'climbing') {
          a.mesh.position.y += 6.5 * delta;
          a.mesh.rotation.x = -Math.PI * 0.4;
          if (a.mesh.position.y >= a.perchHeight) {
            a.mesh.position.y = a.perchHeight;
            a.wallClimbPhase = 'perched';
            a.mesh.rotation.x = Math.PI; // Upside down clinging to ceiling
          }
          return;
        } else if (a.wallClimbPhase === 'perched') {
          // Stalk ceiling towards targetPlayer
          if (dist > 8.0) {
            const stalkDir = dir.clone().normalize();
            a.mesh.position.addScaledVector(stalkDir, 5.0 * delta);
          }
          // Surprise drop attack when close enough
          if (dist <= 10.0 && this._requestAttack(a, targetPlayer, { windup: 0.9, recovery: 2 })) {
            a.wallClimbPhase = 'dropping';
            this.audioEngine.playXenoHiss();
          }
          return;
        } else if (a.wallClimbPhase === 'dropping') {
          a.mesh.position.y -= 26.0 * delta; // Plunge straight down
          a.mesh.rotation.x = 0;
          const dropDir = dir.clone().normalize();
          a.mesh.position.addScaledVector(dropDir, 8.0 * delta);

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.wallClimbPhase = 'grounded';
            a.isWallStalker = false;
            if (dist <= 3.5) {
              targetPlayer.takeDamage(35, false, a, { attackKind: 'drop', blockable: false, parryable: false });
            }
          }
          return;
        }
      }

      // Praetorian Royal Acid Spit Attack (medium range: 8m to 20m)
      if (a.type === 'praetorian') {
        a.spitCooldown -= delta;
        if (a.spitCooldown <= 0 && dist >= 8.0 && dist <= 20.0 && this._requestAttack(a, targetPlayer, { kind: 'ranged', windup: 0.9, recovery: 1.6 })) {
          a.spitCooldown = 3.5;
          this.audioEngine.playXenoHiss();
          this.spawnAcidSplash(a.mesh.position, targetPlayer.position, { source: a });
        }
      }

      // Spitter Long-Range Acid Artillery AI (Aliens: Colonial Marines Lore)
      if (a.type === 'spitter') {
        a.spitCooldown -= delta;
        if (a.spitCooldown <= 0 && dist >= 7.0 && dist <= 26.0 && this._requestAttack(a, targetPlayer, { kind: 'ranged', windup: 0.9, recovery: 1.6 })) {
          a.spitCooldown = 3.2;
          this.audioEngine.playXenoHiss();
          this.spawnAcidSplash(a.mesh.position, targetPlayer.position, { source: a });
          this.spawnAcidPool(a.mesh.position);
        }
      }

      if (a.type === 'crusher') {
        // Crusher Battering Ram Charge
        if (a.isCharging) {
          a.chargeDuration -= delta;
          if (a.chargeDuration <= 0) {
            a.isCharging = false;
            a.speed = 12;
            a.chargeTimer = 4;
          }
        } else {
          a.chargeTimer -= delta;
          if (a.chargeTimer <= 0 && this._requestAttack(a, targetPlayer, { kind: 'boss', windup: 1.15, duration: 2, recovery: 2 })) {
            a.isCharging = true;
            a.chargeDuration = 2;
            a.speed = 22;
            this.audioEngine.playXenoHiss();
          }
        }

        if (a.isCharging && !a.chargeDirection) a.chargeDirection = dir.clone().normalize();
        if (a.isCharging) {
          a.mesh.position.addScaledVector(a.chargeDirection, a.speed * delta);
          this.environment?.resolveMovement?.(a.mesh.position, Math.min(a.radius, 1.8));
          if (a.mesh.position.distanceTo(targetPlayer.position) <= a.radius + 1.2) {
            targetPlayer.takeDamage(65, false, a, { attackKind: 'charge', blockable: false, parryable: false });
            a.isCharging = false; a.chargeDirection = null; a.speed = 12; a.chargeTimer = 4;
          }
          return;
        }
        a.chargeDirection = null;
      }

      // Check if low HP sub-boss enters execution stun (Crusher, Praetorian, Grid Alien)
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien') && a.hp <= a.maxHp * 0.25 && !a.isStunned) {
        a.isStunned = true;
        a.stunTimer = 6.0;
      }

      // Boiler suicide kamikaze charge
      if (a.type === 'boiler') {
        a.mesh.children.forEach(c => {
          if (c.name === 'boil') c.scale.setScalar(1.0 + Math.sin(this.time * 18) * 0.25);
        });
        if (dist <= 3.2 && this._requestAttack(a, targetPlayer, { windup: 1.2, recovery: 2 })) {
          this.detonateBoiler(a, targetPlayer);
          return;
        }
      }

      // Neomorph Bloodburster Acrobatic Pounce & Evasive Flanking (Alien: Covenant 2017)
      if (a.type === 'neomorph') {
        if (a.leapCooldown > 0) a.leapCooldown -= delta;

        // Evasive lateral strafe
        const strafe = new THREE.Vector3(-dir.z, 0, dir.x).normalize();
        a.mesh.position.addScaledVector(strafe, Math.sin(this.time * 7) * 4.0 * delta);

        if (!a.isLeaping && dist <= 12.0 && a.leapCooldown <= 0 && this._requestAttack(a, targetPlayer, { windup: 0.9, duration: 1.1, recovery: 1.6 })) {
          a.isLeaping = true;
          a.leapVelY = 13.0;
          a.leapCooldown = 4.5;
          if (this.audioEngine && this.audioEngine.playNeomorphScreech) {
            this.audioEngine.playNeomorphScreech();
          }
        }

        if (a.isLeaping) {
          a.leapVelY -= 32.0 * delta;
          a.mesh.position.y += a.leapVelY * delta;
          a.mesh.rotation.x = -0.5;

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.isLeaping = false;
            a.mesh.rotation.x = 0;
            if (dist <= 3.0) {
              targetPlayer.takeDamage(35, false, a, { attackKind: 'pounce', blockable: false, parryable: false });
            }
          }
          return;
        }
      }

      // Praetomorph Hyper-Aggressive Hunter (Alien: Covenant 2017)
      if (a.type === 'praetomorph') {
        if (a.leapCooldown > 0) a.leapCooldown -= delta;
        if (!a.isLeaping && dist <= 14.0 && a.leapCooldown <= 0 && this._requestAttack(a, targetPlayer, { windup: 1, duration: 1.2, recovery: 1.6 })) {
          a.isLeaping = true;
          a.leapVelY = 15.0;
          a.leapCooldown = 5.0;
          if (this.audioEngine && this.audioEngine.playPraetomorphHiss) {
            this.audioEngine.playPraetomorphHiss();
          }
        }
        if (a.isLeaping) {
          a.leapVelY -= 36.0 * delta;
          a.mesh.position.y += a.leapVelY * delta;
          a.mesh.rotation.x = -0.4;
          const leapDir = dir.clone().normalize();
          a.mesh.position.addScaledVector(leapDir, 16.0 * delta);

          if (a.mesh.position.y <= 0) {
            a.mesh.position.y = 0;
            a.isLeaping = false;
            a.mesh.rotation.x = 0;
            if (dist <= 3.5) {
              targetPlayer.takeDamage(45, false, a, { attackKind: 'pounce', blockable: false, parryable: false });
            }
          }
          return;
        }
      }

      // Hive rivalry uses the same prepared faction-targeted strike as every
      // other NPC engagement. Color never adds a second per-frame damage loop.

      const covered = this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(a.mesh.position.clone().add(new THREE.Vector3(0,1.4,0)), targetPlayer.position.clone().add(new THREE.Vector3(0,1.6,0)), { ignoreOwner: targetPlayer.isSupport ? targetPlayer.collisionOwner : undefined });
      const access = !a.isCharging && this.environment?.getVerticalNavigationTarget?.(a.mesh.position, targetPlayer.position);
      const attackRange = (a.radius || 1.2) + (this.combatDirector ? 1.2 : 0) + (targetPlayer.isSupport ? targetPlayer.radius ?? 0 : 0);
      if (access || a.mesh.position.distanceTo(targetPlayer.position) > attackRange || covered) {
        const previous = a.mesh.position.clone();
        const movement = (access ?? targetPlayer.position).clone().sub(previous).setY(0), step = Math.min(a.speed * delta, movement.length());
        movement.normalize();
        a.mesh.position.addScaledVector(movement, step);
        // Only normal ground pursuit skirts solid scenery. Juggles, ceiling
        // ambushes, pounces and active Crusher dashes keep their own movement.
        if (!a.isCharging) {
          const navigationRadius = Math.max(0.5, Math.min(a.radius || 0.65, 1.2));
          this.environment?.resolveAgentMovement(a.mesh.position, targetPlayer.position, step, navigationRadius, previous);
        }
        this.combatDirector?.release(a); this._clearAttackCue(a); a._npcPreparation = 0;
        a.mesh.rotation.y = Math.atan2(movement.x, movement.z);
      } else {
        const granted = this._requestAttack(a, targetPlayer, { windup: a.type === 'facehugger' ? 1 : 0.7, recovery: 1.6 });
        if (!granted) return;
        if (a.type === 'facehugger' && this._canParasitize(targetPlayer) && !targetPlayer.isFacehuggerLatched) {
          targetPlayer.triggerFacehuggerLatch();
          a.isLatched = true;
          disposeObject(a.mesh, this.sharedResources);
        } else {
          if (targetPlayer.isSupport) targetPlayer.takeDamage(a.damage, a);
          else targetPlayer.takeDamage(a.damage, false, a, { attackKind: 'melee', blockable: !['crusher','rogue_king','gestating_matriarch','deacon_titan'].includes(a.type), parryable: ['warrior','runner','spitter','red_warrior','grid_alien','officer'].includes(a.type) }); a.revealTimer = 2;
        }
      }
    });
  }


  detonateBoiler(boiler, targetOrPos, details = {}) {
    if (!boiler || boiler._boilerDetonated) return null;
    boiler._boilerDetonated = true; boiler.hp = 0;
    if (this.audioEngine && this.audioEngine.playBoilerDetonation) {
      this.audioEngine.playBoilerDetonation();
    }
    const pos = boiler.mesh.position.clone();
    if (!boiler._combatDisposed) { disposeObject(boiler.mesh, this.sharedResources); boiler._combatDisposed = true; }
    const idx = this.aliens.indexOf(boiler);
    if (idx !== -1) this.aliens.splice(idx, 1);
    const event = this.recordDefeat(boiler, details);

    const targetPos = (targetOrPos && targetOrPos.position) ? targetOrPos.position : (targetOrPos || pos);

    // Blast damage in 8.0m radius
    const targets = targetOrPos?.takeDamage ? [targetOrPos] : this.battleSimulation && boiler.factionId ? listBattleTargets(this, boiler, this._livingPlayers ?? []) : this._livingPlayers ?? [];
    for (const target of targets) {
      if (target.hp > 0 && target.position.distanceTo(pos) <= 8.0 &&
          (!this.environment?.hasLineOfSight || this.environment.hasLineOfSight(pos.clone().add(new THREE.Vector3(0,1,0)), target.position.clone().add(new THREE.Vector3(0,1,0))))) {
        if (this.combatDirector || target.isBattleNPC) this._hazardDamage(boiler, target, 75);
        else target.takeDamage(75, true, boiler, { attackKind: 'acid-explosion', blockable: false, parryable: false });
      }
    }

    // 5 flying acid droplets and large acid pool
    this.spawnAcidSplash(pos, targetPos, { source: boiler });
    this.spawnAcidPool(pos);
    return event;
  }


  clearWave() {
    // A menu cleanup also removes players. Do not keep their disposed visual
    // graphs alive through the target list from the last simulation frame.
    this._livingPlayers = [];
    this.pendingBoilerDetonations=[];
    for (const key of ['microSwarms','mantaSwarmers','royalFacehuggers','biomechanicalEggs','cyberSpineDarts','spitterMortars']) {
      for (const actor of this[key] ?? []) { this.combatDirector?.release(actor); this._clearAttackCue(actor); disposeObject(actor.mesh ?? actor.group, this.sharedResources); if (actor.indicatorMesh) disposeObject(actor.indicatorMesh); }
      this[key] = [];
    }
    this.pendingSpawns = [];
    this.spawnTimer = 0;
    for (const enemy of [...this.aliens, ...this.chestbursters]) { this.combatDirector?.release(enemy); this._clearAttackCue(enemy); }
    this.aliens.forEach(a => disposeObject(a.mesh, this.sharedResources));
    this.aliens = [];
    this.eggs.forEach(e => disposeObject(e.mesh, this.sharedResources));
    this.eggs = [];
    this.chestbursters.forEach(c => disposeObject(c.mesh, this.sharedResources));
    this.chestbursters = [];
    this.acidPools.forEach(p => disposeObject(p.mesh, this.sharedResources));
    this.acidPools = [];
    this.acidSplashes.forEach(s => disposeObject(s.mesh, this.sharedResources));
    this.acidSplashes = [];
    this.zeroGAcidGlobules.forEach(g => disposeObject(g.mesh, this.sharedResources));
    this.zeroGAcidGlobules = [];
  }
  spawnMarvelAlpha(playerPos) {
    const group = new THREE.Group();
    const mat = this.alphaMat;
    const barbMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });

    // 3.8m Tall Stature
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 2.6, 8), mat);
    torso.position.y = 1.8;
    group.add(torso);

    // Elongated Barbed Dome Cranium
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.5, 2.4, 8), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 3.0, 0.8);
    group.add(head);

    // Barbed Cranial Crest Spines (Marvel Canon)
    for (let b = 0; b < 6; b++) {
      const barb = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 4), barbMat);
      barb.rotation.x = -Math.PI / 3;
      barb.position.set((b % 2 === 0 ? -0.22 : 0.22), 3.3 + (b * 0.08), 0.2 - (b * 0.35));
      group.add(barb);
    }

    // Glowing Crimson Sensory Slits
    const redEyeMat = new THREE.MeshBasicMaterial({ color: 0xff0044 });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), redEyeMat);
    eyeL.position.set(-0.24, 2.9, 1.6);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.07, 6, 6), redEyeMat);
    eyeR.position.set(0.24, 2.9, 1.6);
    group.add(eyeR);

    // 4 Articulated Dorsal Razor Scythes (Organic Scythe Blades)
    for (let s = 0; s < 4; s++) {
      const scythe = new THREE.Mesh(new THREE.ConeGeometry(0.12, 1.9, 4), mat);
      const isLeft = s % 2 === 0;
      scythe.position.set(isLeft ? -0.55 : 0.55, 2.5 + (s > 1 ? 0.6 : 0), -0.4 - (s > 1 ? 0.3 : 0));
      scythe.rotation.x = -Math.PI / 3.2;
      scythe.rotation.z = isLeft ? -0.45 : 0.45;
      group.add(scythe);
    }

    // Segmented Silver-Chitin Tail with Barbed Stinger
    for (let t = 0; t < 6; t++) {
      const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 - t * 0.01, 0.07 - t * 0.01, 0.55, 6), mat);
      tSeg.position.set(0, 1.1 - t * 0.14, -0.4 - t * 0.38);
      tSeg.rotation.x = -0.5 + t * 0.1;
      group.add(tSeg);
    }
    const alphaStinger = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.55, 4), barbMat);
    alphaStinger.rotation.x = -Math.PI / 2;
    alphaStinger.position.set(0, 0.5, -2.7);
    group.add(alphaStinger);

    group.position.set(playerPos.x - 18, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'marvel_alpha',
      isMarvelAlpha: true,
      isOfficer: true,
      officerTitle: 'ALPHA APEX EPSILON (MARVEL CANON)',
      hp: 1800,
      maxHp: 1800,
      speed: 15.0,
      damage: 65,
      radius: 2.3,
      commandRoarCooldown: 5.0,
      isStunned: false,
      stunTimer: 0,
      isBallisticArmored: true, // 50% ballistic armor
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  /* Chantier 6 (v48): The King Alien / Rogue Titan (Aliens: Rogue / Kenner 1994 Canon 1:1) */

  spawnRogueKingTitan(playerPos) {
    const group = new THREE.Group();
    const scale = 2.3;
    const mat = this.rogueKingMat;
    const hornMat = new THREE.MeshStandardMaterial({ color: 0x09090b, metalness: 0.95, roughness: 0.12 });
    const veinMat = new THREE.MeshStandardMaterial({ color: 0xdc2626, emissive: 0x7f1d1d, roughness: 0.25 });

    // Massive Muscular Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.75 * scale, 0.52 * scale, 2.5 * scale, 8), mat);
    torso.position.y = 1.6 * scale;
    group.add(torso);

    // Jagged Royal Crown Cranium
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.65 * scale, 2.4 * scale), mat);
    head.position.set(0, 2.9 * scale, 0.5 * scale);
    group.add(head);

    // 5 Jagged Crimson-Black Royal Crown Horns (Aliens: Rogue King Silhouette)
    for (let h = -2; h <= 2; h++) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.28 * scale, 2.2 * scale, 5), hornMat);
      horn.position.set(h * 0.42 * scale, 3.4 * scale + Math.cos(h * 0.5) * 0.25 * scale, -0.8 * scale);
      horn.rotation.x = Math.PI / 2.6;
      horn.rotation.z = -h * 0.22;
      group.add(horn);
    }

    // Double Crusher Pincer Claws (Left & Right Heavy Forearms)
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.26 * scale, 0.18 * scale, 1.8 * scale, 6), mat);
      arm.position.set(side * 1.15 * scale, 1.9 * scale, 0.5 * scale);
      arm.rotation.z = side * 0.35;
      arm.rotation.x = 0.45;
      group.add(arm);

      const pincerTop = new THREE.Mesh(new THREE.ConeGeometry(0.18 * scale, 0.95 * scale, 4), hornMat);
      pincerTop.position.set(side * 1.45 * scale, 1.4 * scale, 1.1 * scale);
      pincerTop.rotation.x = Math.PI / 2.2;
      group.add(pincerTop);

      const pincerBot = new THREE.Mesh(new THREE.ConeGeometry(0.15 * scale, 0.85 * scale, 4), veinMat);
      pincerBot.position.set(side * 1.45 * scale, 1.15 * scale, 1.05 * scale);
      pincerBot.rotation.x = Math.PI / 1.9;
      group.add(pincerBot);
    });

    // Heavy Armored Tail with Royal Mace Stinger
    for (let t = 0; t < 6; t++) {
      const tSeg = new THREE.Mesh(new THREE.CylinderGeometry((0.16 - t * 0.015) * scale, (0.13 - t * 0.015) * scale, 0.55 * scale, 6), mat);
      tSeg.position.set(0, (1.1 - t * 0.14) * scale, (-0.5 - t * 0.42) * scale);
      tSeg.rotation.x = -0.45 + t * 0.08;
      group.add(tSeg);
    }

    group.position.set(playerPos.x + 24, 0, playerPos.z - 28);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'rogue_king',
      isRogueKing: true,
      isOfficer: true,
      officerTitle: 'THE KING ALIEN / ROGUE TITAN (ALIENS: ROGUE)',
      hp: 3200,
      maxHp: 3200,
      speed: 13.5,
      damage: 85,
      radius: 2.6,
      kingRoarCooldown: 6.0,
      isStunned: false,
      stunTimer: 0,
      isBallisticArmored: true,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  /* Chantier 2 (v49): Xenomorph Raven / Praetorian Raven (Aliens: Colonial Marines / Fireteam Elite Canon 1:1) */

  spawnRavenXenomorph(playerPos) {
    const group = new THREE.Group();
    const scale = 2.1;
    const mat = this.ravenMat;
    const featherMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.95, roughness: 0.1, side: THREE.DoubleSide });
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8 });

    // Armored Obsidian Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65 * scale, 0.45 * scale, 2.3 * scale, 8), mat);
    torso.position.y = 1.55 * scale;
    group.add(torso);

    // Hooked Beak-Crest Cranium (Raven Silhouette)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.55 * scale, 2.5 * scale, 6), mat);
    head.rotation.x = -Math.PI / 2.1;
    head.position.set(0, 2.8 * scale, 0.4 * scale);
    group.add(head);

    // Scarred Socket Eye (ACM Sewer Raven Battle Scar)
    const scarEye = new THREE.Mesh(new THREE.SphereGeometry(0.09 * scale, 6, 6), eyeMat);
    scarEye.position.set(-0.22 * scale, 2.85 * scale, 1.35 * scale);
    group.add(scarEye);

    // Feathered Chitinous Obsidian Wings (Left & Right)
    [-1, 1].forEach(side => {
      const wingGroup = new THREE.Group();
      wingGroup.position.set(side * 0.65 * scale, 2.1 * scale, -0.2 * scale);
      for (let f = 0; f < 5; f++) {
        const blade = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 0.14 * scale, 0.35 * scale), featherMat);
        blade.position.set(side * (0.7 + f * 0.18) * scale, (0.3 - f * 0.22) * scale, -f * 0.12 * scale);
        blade.rotation.z = side * (-0.25 + f * 0.14);
        wingGroup.add(blade);
      }
      group.add(wingGroup);
    });

    // Scythe Talons
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.12 * scale, 1.6 * scale, 6), mat);
      arm.position.set(side * 0.95 * scale, 1.7 * scale, 0.55 * scale);
      arm.rotation.x = 0.6;
      group.add(arm);
    });

    group.position.set(playerPos.x - 24, 0, playerPos.z + 26);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'xeno_raven',
      isRaven: true,
      isOfficer: true,
      officerTitle: 'XENOMORPH RAVEN OBSIDIAN (COLONIAL MARINES)',
      hp: 2400,
      maxHp: 2400,
      speed: 15.2,
      damage: 72,
      radius: 2.2,
      ravenShriekCooldown: 5.5,
      isFrontalShielded: true, // Deflects 85% frontal ranged attacks until shattered by Maul or flanked
      isBallisticArmored: true,
      isStunned: false,
      stunTimer: 0,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  /* Chantier 6 (v49): Ancient Predalien Elder (Aliens vs. Predator 2: Primal Hunt 2002 Canon 1:1) */

  spawnAncientPredalienElder(playerPos) {
    const group = new THREE.Group();
    const scale = 2.25;
    const mat = this.ancientPredalienMat;
    const relicMat = new THREE.MeshStandardMaterial({ color: 0xf59e0b, metalness: 0.95, roughness: 0.15 });
    const mandibleMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.45 });

    // Calcified Fossilized Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.72 * scale, 0.5 * scale, 2.4 * scale, 8), mat);
    torso.position.y = 1.6 * scale;
    group.add(torso);

    // Elder Crown Cranium
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.82 * scale, 0.65 * scale, 2.3 * scale), mat);
    head.position.set(0, 2.85 * scale, 0.45 * scale);
    group.add(head);

    // 4 Ancient Calcified Yautja Mandibles
    [[-0.45, 2.75], [0.45, 2.75], [-0.38, 2.5], [0.38, 2.5]].forEach(([mx, my]) => {
      const mand = new THREE.Mesh(new THREE.ConeGeometry(0.14 * scale, 0.75 * scale, 5), mandibleMat);
      mand.position.set(mx * scale, my * scale, 1.55 * scale);
      mand.rotation.x = 0.35;
      mand.rotation.z = mx < 0 ? -0.45 : 0.45;
      group.add(mand);
    });

    // 6 Elder Dreadlocks with Golden Clan Relics (Primal Hunt Sarcophagus Guardian)
    for (let d = -3; d <= 3; d++) {
      if (d === 0) continue;
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.07 * scale, 0.04 * scale, 2.1 * scale, 6), mandibleMat);
      dread.position.set(d * 0.24 * scale, 2.65 * scale, -0.75 * scale);
      dread.rotation.x = -0.5;
      group.add(dread);

      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.08 * scale, 0.02 * scale, 4, 8), relicMat);
      ring.position.set(d * 0.24 * scale, 2.55 * scale, -0.75 * scale);
      group.add(ring);
    }

    group.position.set(playerPos.x + 26, 0, playerPos.z + 24);
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'ancient_predalien',
      isAncientPredalien: true,
      isOfficer: true,
      officerTitle: 'ANCIENT PREDALIEN ELDER (AVP2: PRIMAL HUNT)',
      hp: 3600,
      maxHp: 3600,
      speed: 13.8,
      damage: 78,
      radius: 2.4,
      regenActive: true, // Regenerates +35 HP/s until cauterized by thermal/plasma
      elderRoarCooldown: 7.0,
      isBallisticArmored: true,
      isStunned: false,
      stunTimer: 0,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }

  /* === CHANTIER 5 (v50.0): Gestating Alpha Female Hive Matriarch Sub-Boss with Live Egg Laying (Aliens 1986 / Infestation) === */

  spawnGestatingMatriarch(playerPos) {
    const group = new THREE.Group();
    const mat = this.gestatingMatriarchMat;
    const oviMat = this.ovipositorMat;

    // Muscular hunched carapace torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.85, 0.65, 3.2, 8), mat);
    torso.position.y = 2.4;
    torso.rotation.x = 0.45;
    group.add(torso);

    // Fluted Royal Cranial Crest with crimson vein ridges
    const crownGeo = new THREE.BoxGeometry(2.4, 0.5, 3.2);
    const crown = new THREE.Mesh(crownGeo, mat);
    crown.position.set(0, 3.8, -0.6);
    crown.rotation.x = -0.35;
    group.add(crown);

    // Twin Barbed Scythe Claws
    [-1.5, 1.5].forEach(ax => {
      const scythe = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.22, 2.8, 6), mat);
      scythe.position.set(ax, 2.6, 1.2);
      scythe.rotation.x = Math.PI / 3;
      scythe.rotation.z = ax > 0 ? -0.4 : 0.4;
      group.add(scythe);
    });

    // Massive Pulsating Biomechanical Ovipositor Sac (3.8m long)
    const ovi = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 1.5, 3.8, 10), oviMat);
    ovi.position.set(0, 1.4, -2.5);
    ovi.rotation.x = -Math.PI / 4;
    group.add(ovi);

    // Spawn 28m away from player
    const angle = Math.random() * Math.PI * 2;
    group.position.set(
      playerPos.x + Math.sin(angle) * 28.0,
      0,
      playerPos.z + Math.cos(angle) * 28.0
    );
    group.scale.set(2.4, 2.4, 2.4);

    this.scene.add(group);
    this.aliens.push({ combatManager: this,
      mesh: group,
      ovipositorMesh: ovi,
      type: 'gestating_matriarch',
      isGestatingMatriarch: true,
      isOfficer: true,
      officerTitle: 'MATRIARCHE GESTANTE DE LA RUCHE (ALIENS 1986)',
      hp: 4200,
      maxHp: 4200,
      speed: 12.5,
      damage: 85,
      radius: 2.6,
      eggLayCooldown: 6.5,
      isBallisticArmored: true,
      isStunned: false,
      stunTimer: 0,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3()
    });
  }


  spawnBiomechanicalEgg(pos) {
    if (this.battleSimulation) return null;
    const eggGroup = new THREE.Group();
    const eggMat = new THREE.MeshStandardMaterial({ color: 0x451a03, roughness: 0.6, metalness: 0.2 });
    const petalMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.4 });

    const eggBase = new THREE.Mesh(new THREE.SphereGeometry(0.75, 8, 8), eggMat);
    eggBase.scale.set(1.0, 1.4, 1.0);
    eggBase.position.y = 0.9;
    eggGroup.add(eggBase);

    // 4 opening petals
    for (let p = 0; p < 4; p++) {
      const petal = new THREE.Mesh(new THREE.ConeGeometry(0.3, 0.8, 4), petalMat);
      const pAngle = (p / 4) * Math.PI * 2;
      petal.position.set(Math.sin(pAngle) * 0.45, 1.7, Math.cos(pAngle) * 0.45);
      petal.rotation.x = Math.sin(pAngle) * 0.4;
      petal.rotation.z = -Math.cos(pAngle) * 0.4;
      eggGroup.add(petal);
    }

    eggGroup.position.copy(pos);
    eggGroup.position.y = 0;
    this.scene.add(eggGroup);

    this.biomechanicalEggs.push({
      mesh: eggGroup,
      hp: 180,
      hatchTimer: 4.0
    });
  }

  /* Chantier 7 (v46): Chameleon Stalker Xenomorph with Active Camouflage (Aliens: Rogue Canon 1:1) */

  spawnChameleonStalker(playerPos) {
    const group = new THREE.Group();
    const mat = this.chameleonMat;

    // Torso (Agile predatory physique)
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.22, 1.8, 8), mat);
    torso.position.y = 1.2;
    torso.rotation.x = 0.35;
    group.add(torso);

    // Elongated Sleek Translucent Cranial Dome
    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.32, 1.8, 8), mat);
    head.rotation.x = Math.PI / 2;
    head.position.set(0, 1.9, 0.5);
    group.add(head);

    // Barbed Dorsal Exhaust Tubes
    [-0.2, 0.2].forEach(ox => {
      const tube = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.08, 0.7, 6), mat);
      tube.position.set(ox, 1.7, -0.2);
      tube.rotation.x = -0.55;
      group.add(tube);
    });

    // Articulated Chitinous Claws
    [-0.5, 0.5].forEach(ox => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 1.1, 6), mat);
      arm.position.set(ox, 1.3, 0.2);
      arm.rotation.x = 0.45;
      group.add(arm);
    });

    // Flexible Chitin Tail with Barbed Stalker Blade
    for (let t = 0; t < 5; t++) {
      const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.07 - t * 0.01, 0.05 - t * 0.01, 0.45, 6), mat);
      tSeg.position.set(0, 0.7 - t * 0.1, -0.3 - t * 0.3);
      tSeg.rotation.x = -0.4;
      group.add(tSeg);
    }

    const angle = Math.random() * Math.PI * 2;
    const radius = 24 + Math.random() * 8;
    group.position.set(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius
    );
    this.scene.add(group);

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'chameleon_stalker',
      isChameleon: true,
      hp: 420,
      maxHp: 420,
      speed: 13.5,
      damage: 45,
      radius: 1.6,
      pounceCooldown: 3.5,
      cloakFlickerTimer: 0,
      flankAngle: (Math.random() - 0.5) * Math.PI,
      isAirborne: false,
      airborneVelY: 0,
      airborneVelHoriz: new THREE.Vector3(),
      isStunned: false,
      stunTimer: 0
    });
  }

  /* Chantier 4 (v47): The Deacon Titan (Prometheus 2012 Primordial Engineer Alien Canon) */

  spawnDeaconTitan(playerPos) {
    const group = new THREE.Group();
    const deaconMat = this.deaconMat;
    const teethMat = new THREE.MeshStandardMaterial({ color: 0xf8fafc, roughness: 0.15, metalness: 0.1 });
    const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, roughness: 0.3, metalness: 0.85 });

    // 1. Torso & Muscular Primordial Spine
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.42, 2.6, 8), deaconMat);
    torso.position.y = 1.6;
    torso.rotation.x = 0.35;
    group.add(torso);

    // Dorsal rib ridges (No biomechanical tubes - smooth biological body)
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 - r * 0.05, 0.08, 6, 12), deaconMat);
      rib.rotation.x = Math.PI / 2;
      rib.position.set(0, 1.3 + r * 0.25, -0.15 - r * 0.08);
      rib.scale.set(1.1, 0.5, 0.9);
      group.add(rib);
    }

    // 2. Pointed Conical Cranium (Prometheus 2012 1:1 Anatomy)
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.38, 2.4, 8), deaconMat);
    head.rotation.x = Math.PI / 2 + 0.15;
    head.position.set(0, 2.4, 0.7);
    group.add(head);

    // Humanoid outer mouth & decoupled pharyngeal inner jaw
    const outerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.28, 0.65), deaconMat);
    outerJaw.position.set(0, 2.05, 1.25);
    group.add(outerJaw);

    // Inner Pharyngeal Jaw with human-like white enamel teeth
    const innerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.24, 0.18, 0.85), innerJawMat);
    innerJaw.position.set(0, 2.05, 1.55);
    group.add(innerJaw);

    // Humanoid teeth row
    for (let t = -3; t <= 3; t++) {
      const tooth = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.035), teethMat);
      tooth.position.set(t * 0.032, 2.12, 1.9);
      group.add(tooth);

      const toothLower = new THREE.Mesh(new THREE.BoxGeometry(0.028, 0.06, 0.035), teethMat);
      toothLower.position.set(t * 0.032, 1.98, 1.9);
      group.add(toothLower);
    }

    // 3. Quadrupedal Heavy Limbs
    [-0.65, 0.65].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.14, 0.1, 2.2, 6), deaconMat);
      arm.position.set(side, 1.3, 0.6);
      arm.rotation.x = 0.45;
      arm.rotation.z = side * 0.2;
      group.add(arm);

      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.12, 2.4, 6), deaconMat);
      leg.position.set(side * 0.9, 1.0, -0.6);
      leg.rotation.x = -0.3;
      group.add(leg);
    });

    const angle = Math.random() * Math.PI * 2;
    const radius = 28 + Math.random() * 8;
    group.position.set(
      playerPos.x + Math.cos(angle) * radius,
      0,
      playerPos.z + Math.sin(angle) * radius
    );
    this.scene.add(group);

    if (this.audioEngine && this.audioEngine.playDeaconJawHiss) {
      this.audioEngine.playDeaconJawHiss();
    }

    this.aliens.push({ combatManager: this,
      mesh: group,
      type: 'deacon_titan',
      isDeacon: true,
      hp: 2400,
      maxHp: 2400,
      speed: 16.5,
      damage: 65,
      radius: 2.2,
      chompCooldown: 2.5,
      tackleCooldown: 4.5,
      isStunned: false,
      stunTimer: 0,
      canBeTrophyHarvested: false,
      isAirborne: false,
      airborneVelY: 0
    });
  }

  /* Chantier 7 (v47): Flying Xenomorph Manta Swarmer (Aliens Arcade / Kenner / Marvel Comics) */

  spawnMantaSwarmer(spawnPos, targetPlayer = null) {
    const group = new THREE.Group();
    const bodyMat = this.mantaMat;
    const wingMat = this.mantaWingMat;
    const barbMat = new THREE.MeshStandardMaterial({ color: 0x9333ea, metalness: 0.9, roughness: 0.2 });

    // 1. Sleek Aerodynamic Fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 2.2, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    body.position.y = 0;
    group.add(body);

    // Pointed cranial aerodynamic snout
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1, 6), bodyMat);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0, 1.4);
    group.add(head);

    // 2. Wide Aerodynamic Manta Bat-Wings (Span ~ 4.6m)
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), wingMat);
    wingL.rotation.x = -Math.PI / 2;
    wingL.position.set(-1.3, 0.05, 0);
    group.add(wingL);

    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(2.3, 1.4), wingMat);
    wingR.rotation.x = -Math.PI / 2;
    wingR.position.set(1.3, 0.05, 0);
    group.add(wingR);

    // 3. Serrated Whip Stinger Tail
    for (let t = 0; t < 5; t++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 - t * 0.01, 0.04 - t * 0.01, 0.5, 5), bodyMat);
      seg.position.set(0, -0.05 - t * 0.04, -1.2 - t * 0.4);
      seg.rotation.x = 0.2;
      group.add(seg);
    }
    const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.45, 4), barbMat);
    stinger.position.set(0, -0.25, -3.2);
    stinger.rotation.x = Math.PI / 2;
    group.add(stinger);

    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    group.position.copy(spawnPos);
    this.scene.add(group);

    if (this.audioEngine && this.audioEngine.playMantaDiveScreech) {
      this.audioEngine.playMantaDiveScreech();
    }

    this.mantaSwarmers.push({
      mesh: group,
      hp: 320,
      maxHp: 320,
      speed: 15.0,
      diveSpeed: 26.0,
      damage: 65,
      divePhase: 'cruising',
      cruiseAltitude: 8.5 + Math.random() * 3.5,
      diveCooldown: 3.5 + Math.random() * 2.5,
      diveTarget: new THREE.Vector3(),
      flutterPhase: Math.random() * Math.PI * 2
    });
  }

  /* === CHANTIER 2 & SOFIA QA (v53.0): Flying Praetorian Harpy (Aliens: Earth War / Capcom AvP Arcade) === */

  spawnWingedPraetorianHarpy(spawnPos) {
    const group = new THREE.Group();
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1f1635, roughness: 0.22, metalness: 0.92 });
    const wingMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.45, metalness: 0.65, transparent: true, opacity: 0.85, side: THREE.DoubleSide });

    // Armored Praetorian Flier Fuselage
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.48, 3.4, 8), bodyMat);
    body.rotation.x = Math.PI / 2;
    group.add(body);

    // Flared Aerodynamic Cranial Crest
    const crest = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.22, 1.5), bodyMat);
    crest.position.set(0, 0.38, 1.3);
    crest.rotation.x = -0.32;
    group.add(crest);

    // Quadruple Leathery Membrane Wings (Span ~ 6.2m)
    const wingL = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.8), wingMat);
    wingL.rotation.x = -Math.PI / 2;
    wingL.position.set(-1.8, 0.1, 0.2);
    group.add(wingL);

    const wingR = new THREE.Mesh(new THREE.PlaneGeometry(3.1, 1.8), wingMat);
    wingR.rotation.x = -Math.PI / 2;
    wingR.position.set(1.8, 0.1, 0.2);
    group.add(wingR);

    // Barbed Spined Tail
    for (let t = 0; t < 6; t++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 - t * 0.01, 0.06 - t * 0.01, 0.6, 6), bodyMat);
      seg.position.set(0, -0.06 - t * 0.05, -1.8 - t * 0.5);
      seg.rotation.x = 0.25;
      group.add(seg);
    }

    group.userData.wingL = wingL;
    group.userData.wingR = wingR;

    group.position.copy(spawnPos);
    this.scene.add(group);

    if (this.audioEngine && this.audioEngine.playXenoWingFlapDive) {
      this.audioEngine.playXenoWingFlapDive();
    }

    this.mantaSwarmers.push({
      mesh: group,
      hp: 1200,
      maxHp: 1200,
      isPraetorianHarpy: true,
      speed: 13.0,
      diveSpeed: 24.0,
      damage: 120,
      divePhase: 'cruising',
      cruiseAltitude: 9.5,
      diveCooldown: 4.0,
      diveTarget: new THREE.Vector3(),
      flutterPhase: 0
    });
  }

  /* Chantier 2: Mosquito / Midge Micro-Xenomorph Swarm (Marvel Comics Alien: Thaw Canon 1:1) */

  spawnMicroSwarm(playerPos) {
    const swarmGroup = new THREE.Group();
    const wingMat = new THREE.MeshBasicMaterial({ color: 0x94a3b8, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const microUnits = [];

    // Cloud of 12 airborne winged micro-xenomorphs
    for (let u = 0; u < 12; u++) {
      const unitGroup = new THREE.Group();

      // Micro thorax
      const thorax = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), this.microSwarmMat);
      unitGroup.add(thorax);

      // Barbed elongated cranium
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 5), this.microSwarmMat);
      head.rotation.x = Math.PI / 2;
      head.position.z = 0.18;
      unitGroup.add(head);

      // Translucent vibrating insectoid wings
      const wingL = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), wingMat);
      wingL.position.set(-0.14, 0.08, 0);
      wingL.rotation.y = 0.3;
      unitGroup.add(wingL);

      const wingR = new THREE.Mesh(new THREE.PlaneGeometry(0.24, 0.12), wingMat);
      wingR.position.set(0.14, 0.08, 0);
      wingR.rotation.y = -0.3;
      unitGroup.add(wingR);

      // Spread inside cloud sphere
      const ang = (u / 12) * Math.PI * 2;
      const r = 0.6 + (u % 3) * 0.45;
      unitGroup.position.set(Math.cos(ang) * r, 0.2 + (u % 4) * 0.35, Math.sin(ang) * r);
      swarmGroup.add(unitGroup);

      microUnits.push({
        group: unitGroup,
        wingL,
        wingR,
        basePos: unitGroup.position.clone(),
        flutterOffset: Math.random() * Math.PI * 2
      });
    }

    swarmGroup.position.set(playerPos.x + 8, 2.0, playerPos.z + 8);
    this.scene.add(swarmGroup);

    this.microSwarms.push({
      group: swarmGroup,
      units: microUnits,
      hp: 150,
      maxHp: 150,
      damage: 8,
      orbitAngle: 0,
      orbitRadius: 2.4,
      orbitSpeed: 3.5,
      buzzTimer: 0,
      isDead: false
    });
  }


  spawnRoyalFacehugger(spawnPos, targetPlayer = null) {
    const mesh = this.createAlienMesh(false, false, false, false, false, false, false, false, false, true);
    mesh.position.copy(spawnPos);
    this.scene.add(mesh);

    if (this.audioEngine && this.audioEngine.playRoyalFacehuggerShriek) {
      this.audioEngine.playRoyalFacehuggerShriek();
    }

    this.royalFacehuggers.push({
      mesh,
      hp: 140,
      maxHp: 140,
      isGliding: true,
      glideSpeed: 15.0,
      isLatched: false,
      latchTimer: 5.0,
      struggleCount: 0,
      struggleMax: 8,
      flutterPhase: 0
    });
  }


  struggleRoyalFacehugger(player) {
    for (let i = this.royalFacehuggers.length - 1; i >= 0; i--) {
      const rf = this.royalFacehuggers[i];
      if (rf.isLatched) {
        rf.struggleCount++;
        if (globalThis.gameInstance && globalThis.gameInstance.ui) {
          globalThis.gameInstance.ui.showAnnouncement(`⚠️ LUTTE CONTRE LE PARASITE ROYAL : [ESPACE] (${rf.struggleCount}/${rf.struggleMax}) !`);
        }
        if (this.audioEngine && this.audioEngine.playGauntletGrapple) {
          this.audioEngine.playGauntletGrapple();
        }

        if (rf.struggleCount >= rf.struggleMax) {
          if (this.goreEngine && this.goreEngine.spawnDismemberment) {
            this.goreEngine.spawnDismemberment(rf.mesh.position, 'heavy');
          }
          this.spawnAcidPool(player.position);
          this.scene.remove(rf.mesh);
          this.royalFacehuggers.splice(i, 1);
          player.isRoyalFacehuggerLatched = false;

          if (this.audioEngine && this.audioEngine.playHeavySlamImpact) {
            this.audioEngine.playHeavySlamImpact();
          }
          if (globalThis.gameInstance) {
            globalThis.gameInstance.score += 350;
            if (globalThis.gameInstance.ui) {
              globalThis.gameInstance.ui.showAnnouncement('⚔️ PARASITE ROYAL ARRACHÉ DU BIO-MASQUE ET BROYÉ (+350 PTS) !');
            }
          }
          return true;
        }
        return true;
      }
    }
    return false;
  }


  launchSpitterMortar(originPos, targetPos, player) {
    const group = new THREE.Group();
    const spawnPos = originPos.clone().add(new THREE.Vector3(0, 1.8, 0));
    group.position.copy(spawnPos);

    // Glowing acidic mortar payload
    const outerGeo = new THREE.SphereGeometry(0.38, 10, 10);
    const outerMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.85 });
    const outerSphere = new THREE.Mesh(outerGeo, outerMat);
    group.add(outerSphere);

    const innerGeo = new THREE.SphereGeometry(0.2, 8, 8);
    const innerMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
    const innerSphere = new THREE.Mesh(innerGeo, innerMat);
    group.add(innerSphere);

    // Trailing satellite acid droplets
    for (let d = 0; d < 4; d++) {
      const drop = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), outerMat);
      drop.position.set((Math.random() - 0.5) * 0.35, -0.2 - d * 0.12, (Math.random() - 0.5) * 0.35);
      group.add(drop);
    }
    this.scene.add(group);

    // Telegraph hazard indicator on ground at target zone
    const target = targetPos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 2.2, 0.04, (Math.random() - 0.5) * 2.2));
    target.y = 0.04;
    const ringGeo = new THREE.RingGeometry(0.8, 2.4, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xff2200, transparent: true, opacity: 0.55, side: THREE.DoubleSide });
    const indicatorMesh = new THREE.Mesh(ringGeo, ringMat);
    indicatorMesh.position.copy(target);
    this.scene.add(indicatorMesh);

    // Ballistic trajectory: t = 1.8s
    const t = 1.8;
    const gravity = 22.0;
    const dx = target.x - spawnPos.x;
    const dz = target.z - spawnPos.z;
    const vx = dx / t;
    const vz = dz / t;
    const vy = (target.y - spawnPos.y + 0.5 * gravity * t * t) / t;
    const vel = new THREE.Vector3(vx, vy, vz);

    if (this.audioEngine) {
      if (this.audioEngine.playSpitterAcidMortarWhistle) {
        this.audioEngine.playSpitterAcidMortarWhistle();
      } else if (this.audioEngine.playSpitterAcidMortar) {
        this.audioEngine.playSpitterAcidMortar();
      }
    }

    this.spitterMortars.push({
      mesh: group,
      indicatorMesh: indicatorMesh,
      vel: vel,
      gravity: gravity,
      life: 4.0,
      targetPos: target,
      playerRef: player
    });
  }


  triggerFearPulse(origin, radius = 14.0, duration = 3.5) {
    if (!this.aliens) return;
    this.aliens.forEach(a => {
      if (!a || a.hp <= 0 || !a.mesh || a.isOfficer || a.isGestatingMatriarch || a.isRaven || a.isAncientPredalien || a.isRogueKing) return;
      const dist = a.mesh.position.distanceTo(origin);
      if (dist <= radius) {
        a.isFeared = true;
        a.fearTimer = duration;
        a.fearDir = a.mesh.position.clone().sub(origin).normalize();
        a.fearDir.y = 0;
      }
    });
  }


  createLegacyAlienMesh(isFacehugger, isBoiler = false, isNeomorph = false, isPraetomorph = false, isRedSwarm = false, isSpitter = false, isRunner = false, isCryoXeno = false, isCyberXeno = false, isRoyalFacehugger = false) {
    const group = new THREE.Group();

    if (isRoyalFacehugger) {
      const royalMat = new THREE.MeshStandardMaterial({ color: 0x4a3820, roughness: 0.35, metalness: 0.85 });
      const wingMat = new THREE.MeshStandardMaterial({ color: 0x78350f, roughness: 0.6, transparent: true, opacity: 0.82, side: THREE.DoubleSide });

      // Armored Arachnid Body Sac
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.48, 8, 8), royalMat);
      body.position.y = 0.35;
      body.scale.set(1.3, 0.7, 1.5);
      group.add(body);

      // Chitinous carapace dorsal shield
      const shield = new THREE.Mesh(new THREE.BoxGeometry(0.65, 0.15, 0.9), royalMat);
      shield.position.set(0, 0.55, 0);
      group.add(shield);

      // 8 Articulated Knuckled Fingers
      for (let f = 0; f < 8; f++) {
        const side = f < 4 ? -1 : 1;
        const idx = f % 4;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.025, 0.85, 5), royalMat);
        finger.position.set(side * (0.45 + idx * 0.1), 0.25, (idx - 1.5) * 0.28);
        finger.rotation.z = side * 0.8;
        finger.rotation.y = (idx - 1.5) * 0.22;
        group.add(finger);
      }

      // Leathery Gliding Wing Membranes (Patagium connecting knuckle digits on both flanks)
      [-1, 1].forEach(side => {
        const patagium = new THREE.Mesh(new THREE.PlaneGeometry(1.2, 0.9), wingMat);
        patagium.rotation.x = -Math.PI / 2;
        patagium.rotation.z = side * 0.2;
        patagium.position.set(side * 0.85, 0.22, 0);
        group.add(patagium);
      });

      // Serrated Armored Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.03, 1.6, 6), royalMat);
      tail.position.set(0, 0.3, -0.85);
      tail.rotation.x = -Math.PI / 3.2;
      group.add(tail);
      return group;
    }

    const xenoColor = isFacehugger ? 0x8a7355 : (isBoiler ? 0x243528 : (isNeomorph ? 0xf0ece1 : (isPraetomorph ? 0x14181f : (isRedSwarm ? 0xb81414 : (isSpitter ? 0x103a20 : (isCryoXeno ? 0x93c5fd : (isCyberXeno ? 0x334155 : (isRunner ? 0x7c4722 : 0x11161d))))))));
    const mat = new THREE.MeshStandardMaterial({
      color: xenoColor,
      roughness: isNeomorph ? 0.2 : (isPraetomorph ? 0.15 : (isRedSwarm ? 0.25 : (isCryoXeno ? 0.1 : (isCyberXeno ? 0.25 : (isRunner ? 0.4 : 0.3))))),
      metalness: isNeomorph ? 0.05 : (isPraetomorph ? 0.95 : (isRedSwarm ? 0.82 : (isCryoXeno ? 0.65 : (isCyberXeno ? 0.95 : (isRunner ? 0.5 : 0.7))))),
      transparent: isCryoXeno,
      opacity: isCryoXeno ? 0.88 : 1.0
    });

    if (isFacehugger) {
      // Central Arachnid Sac Body
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), mat);
      body.position.y = 0.25;
      body.scale.set(1.2, 0.6, 1.4);
      group.add(body);

      // 8 Articulated Knuckled Arachnid Digits / Fingers (Alien 1979 1:1 Anatomy)
      for (let f = 0; f < 8; f++) {
        const side = f < 4 ? -1 : 1;
        const idx = f % 4;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.65, 5), mat);
        finger.position.set(side * (0.35 + idx * 0.08), 0.2, (idx - 1.5) * 0.22);
        finger.rotation.z = side * 0.75;
        finger.rotation.y = (idx - 1.5) * 0.2;
        group.add(finger);
      }

      // Prehensile Strangling Whip Tail
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 1.2, 6), mat);
      tail.position.set(0, 0.25, -0.65);
      tail.rotation.x = -Math.PI / 3.5;
      group.add(tail);
    } else if (isNeomorph) {
      // Alien: Covenant 2017 Canon Neomorph Bloodburster Anatomy
      // Smooth bulbous pointed cranium (no biomechanical tubes)
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.24, 1.5, 8), mat);
      head.rotation.x = Math.PI / 2 + 0.2;
      head.position.set(0, 1.4, 0.3);
      group.add(head);

      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.18, 0.15, 0.4), mat);
      jaw.position.set(0, 1.25, 0.6);
      group.add(jaw);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.18, 1.5, 8), mat);
      torso.position.y = 1.0;
      torso.rotation.x = 0.3;
      group.add(torso);

      // Sharp dorsal spine quills along the back
      for (let s = 0; s < 4; s++) {
        const spine = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.3, 4), mat);
        spine.rotation.x = -Math.PI / 3;
        spine.position.set(0, 1.3 - s * 0.22, -0.15 - s * 0.08);
        group.add(spine);
      }
    } else if (isPraetomorph) {
      // Alien: Covenant 2017 Canon Praetomorph Anatomy (David's Biomechanical Apex Creation)
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.22, 0.35, 1.8, 8), mat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.9, 0.5);
      group.add(head);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.38, 0.24, 1.8, 8), mat);
      torso.position.y = 1.25;
      group.add(torso);

      // Long aggressive segmented tail
      const tailMat = new THREE.MeshStandardMaterial({ color: 0x0f1217, roughness: 0.2, metalness: 0.9 });
      for (let t = 0; t < 5; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.05, 0.6, 6), tailMat);
        seg.position.set(0, 0.9 - t * 0.15, -0.4 - t * 0.4);
        seg.rotation.x = -0.4;
        group.add(seg);
      }
    } else {
      const head = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.3, 1.4, 8), mat);
      head.rotation.x = Math.PI / 2;
      head.position.set(0, 1.8, 0.4);
      group.add(head);

      // Pharyngeal Inner Jaw Teeth (Alien 1979 / Aliens 1986 H.R. Giger Lore)
      const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
      const innerJaw = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.05, 0.35, 6), innerJawMat);
      innerJaw.rotation.x = Math.PI / 2;
      innerJaw.position.set(0, 1.72, 1.15);
      group.add(innerJaw);

      const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.4, 0.3, 1.6, 8), mat);
      torso.position.y = 1.2;
      group.add(torso);

      // 4 Curved Dorsal Biomechanical Exhaust Pipes (H.R. Giger Canon)
      for (let p = 0; p < 4; p++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.03, 0.9, 5), mat);
        const pX = (p % 2 === 0 ? -0.22 : 0.22);
        const pY = 1.5 + (p > 1 ? 0.3 : 0);
        const pZ = -0.25 - (p > 1 ? 0.15 : 0);
        pipe.position.set(pX, pY, pZ);
        pipe.rotation.x = -Math.PI / 3.5;
        group.add(pipe);
      }

      // Segmented Prehensile Tail with Razor Blade Stinger
      const tailMat = mat;
      for (let t = 0; t < 5; t++) {
        const tSeg = new THREE.Mesh(new THREE.CylinderGeometry(0.06 - t * 0.008, 0.045 - t * 0.006, 0.45, 5), tailMat);
        tSeg.position.set(0, 0.8 - t * 0.1, -0.35 - t * 0.32);
        tSeg.rotation.x = -0.55 + t * 0.12;
        group.add(tSeg);
      }
      const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.35, 4), innerJawMat);
      stinger.rotation.x = -Math.PI / 2;
      stinger.position.set(0, 0.4, -2.0);
      group.add(stinger);

      if (isSpitter) {
        // Encrusted with acidic glands & crest spines (Aliens: Colonial Marines / AvP)
        const acidGlandMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
        for (let g = 0; g < 4; g++) {
          const gland = new THREE.Mesh(new THREE.SphereGeometry(0.12, 6, 6), acidGlandMat);
          gland.position.set((g % 2 === 0 ? -0.25 : 0.25), 1.9, 0.2 + g * 0.25);
          group.add(gland);
        }
      }

      if (isRunner) {
        // Alien 3 Ox / Dog quadruped runner morphology
        torso.rotation.x = 0.55;
        torso.position.y = 0.85;
        head.position.set(0, 1.1, 1.1);
      }

      if (isBoiler) {
        // Encrusted with pulsating luminescent yellow-green acid pustules
        const boilMat = new THREE.MeshBasicMaterial({ color: 0xccff00 });
        for (let b = 0; b < 6; b++) {
          const boil = new THREE.Mesh(new THREE.SphereGeometry(0.18, 6, 6), boilMat);
          boil.name = 'boil';
          const bAngle = (b / 6) * Math.PI * 2;
          boil.position.set(Math.cos(bAngle) * 0.35, 1.3 + (b % 2) * 0.4, Math.sin(bAngle) * 0.35 + 0.2);
          group.add(boil);
        }
      }

      if (isCryoXeno) {
        // Sub-zero frost crystal accretion clusters along head and shoulders (Marvel LV-695 Canon)
        const iceSpikeMat = new THREE.MeshStandardMaterial({ color: 0xe0f2fe, roughness: 0.1, metalness: 0.75 });
        for (let ic = 0; ic < 5; ic++) {
          const iceSpike = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.4, 4), iceSpikeMat);
          iceSpike.rotation.x = -Math.PI / 3.5;
          iceSpike.position.set((ic % 2 === 0 ? -0.18 : 0.18), 1.95 + ic * 0.05, 0.4 - ic * 0.25);
          group.add(iceSpike);
        }
      }

      if (isCyberXeno) {
        // Steel Team Weyland-Yutani cybernetic titanium jaw harness & targeting optic laser
        const cyberPlateMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.98, roughness: 0.2 });
        const jawHarness = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.2, 0.35), cyberPlateMat);
        jawHarness.position.set(0, 1.7, 0.9);
        group.add(jawHarness);

        // Optic targeting diode on head
        const diodeMat = new THREE.MeshBasicMaterial({ color: 0xff0022 });
        const diode = new THREE.Mesh(new THREE.SphereGeometry(0.05, 6, 6), diodeMat);
        diode.position.set(0.12, 1.95, 0.95);
        group.add(diode);

        // Cybernetic back spine battery
        const pack = new THREE.Mesh(new THREE.BoxGeometry(0.35, 0.5, 0.2), cyberPlateMat);
        pack.position.set(0, 1.4, -0.4);
        group.add(pack);
      }
    }

    return group;
  }


  spawnBattleUnit(unit, group) {
    const existing = this.aliens.find(actor => actor.battleUnitId === unit.id);
    if (existing) return existing;
    const type = unit.actorType === 'xenomorph' ? 'warrior' : unit.actorType;
    const allowed = new Set(['warrior','runner','spitter','boiler','neomorph','praetomorph','red_warrior','facehugger','officer','crusher','praetorian','grid_alien','cyber_xeno','cryo_xeno']);
    if (!allowed.has(type)) throw new RangeError(`Unsupported detailed xenomorph profile: ${type}`);
    const mesh = ['officer','crusher','praetorian','grid_alien'].includes(type) ? createCreatureModel(type, this.sharedResources) : this.createAlienMesh(type === 'facehugger', type === 'boiler', type === 'neomorph', type === 'praetomorph', type === 'red_warrior', type === 'spitter', type === 'runner', type === 'cryo_xeno', type === 'cyber_xeno');
    const actor = { mesh, type, pressureId: this.spawnSequence++, speed: type === 'runner' ? 16 : 10,
      damage: unit.officer ? 38 : 25, radius: type === 'facehugger' ? .6 : 1.1, isLatched: false, isWallStalker: false,
      leapCooldown: 3, spitCooldown: 3.5, frostBreathCooldown: 4, cyberDartCooldown: 4, isLeaping: false, leapVelY: 0,
      isAirborne: false, airborneVelY: 0, airborneVelHoriz: new THREE.Vector3() };
    this.aliens.push(applyBattleUnit(this, actor, unit, group));
    return actor;
  }

  despawnBattleUnit(unitOrId) { return despawnBattleActor(this, this.aliens, unitOrId); }


  getActiveCombatants() {
    const actors = [...this.aliens, ...this.chestbursters, ...this.mantaSwarmers, ...this.microSwarms, ...this.royalFacehuggers];
    for (const actor of actors) { actor.mesh ??= actor.group; actor.combatManager ??= this; }
    return actors;
  }

  _updateExtraActors(delta, livingPlayers, supportTargets = []) {
    for (const actor of [...this.mantaSwarmers, ...this.microSwarms, ...this.royalFacehuggers]) {
      actor.mesh ??= actor.group; actor.combatManager = this;
      if (actor.hp <= 0) { this.defeatAlien(actor); continue; }
      const target = this._pursuitTarget(actor, livingPlayers, supportTargets);
      if (!target) { moveBattleOrder(this, actor, delta, actor.speed ?? 10); continue; }
      const position = actor.mesh.position, direction = target.position.clone().sub(position), distance = direction.length();
      if (this.mantaSwarmers.includes(actor)) {
        actor.type ??= actor.isPraetorianHarpy ? 'praetorian_harpy' : 'manta_swarmer';
        actor.diveCooldown = Math.max(0, actor.diveCooldown - delta);
        actor.flutterPhase = (actor.flutterPhase ?? 0) + delta * 9;
        if (actor.divePhase === 'diving') {
          const descent = actor.diveTarget.clone().sub(position), gap = descent.length(), step = actor.diveSpeed * delta;
          position.addScaledVector(descent.normalize(), Math.min(step, gap));
          if (gap <= step + .1) {
            if (target.position.distanceTo(actor.diveTarget) <= 2) {
              if (target.isSupport) target.takeDamage(actor.damage, actor);
              else target.takeDamage(actor.damage, false, actor, { attackKind: 'dive', blockable: false, parryable: false });
            }
            actor.divePhase = 'ascending'; actor.diveCooldown = 5;
          }
        } else if (actor.divePhase === 'ascending') { position.y = Math.min(actor.cruiseAltitude, position.y + 12 * delta); if (position.y >= actor.cruiseAltitude) actor.divePhase = 'cruising'; }
        else {
          position.y = actor.cruiseAltitude + Math.sin(actor.flutterPhase * .4) * .3;
          if (distance < 30 && actor.diveCooldown <= 0 && this._requestAttack(actor, target, { windup: 1.2, duration: 1.2, recovery: 2.2 })) { actor.diveTarget.copy(target.position).add(new THREE.Vector3(0, .6, 0)); actor.divePhase = 'diving'; }
          else if (distance > 12) position.addScaledVector(direction.setY(0).normalize(), (actor.speed ?? 12) * delta * .6);
        }
      } else if (this.royalFacehuggers.includes(actor)) {
        actor.type ??= 'royal_facehugger';
        if (actor.isLatched) { actor.latchTimer -= delta; if (actor.latchTimer <= 0) { if (actor.latchedTo) actor.latchedTo.isRoyalFacehuggerLatched = false; this.defeatAlien(actor, { cause: 'released-parasite', objectiveCredit: false }); } continue; }
        if (distance > 1.2) position.addScaledVector(direction.normalize(), Math.min((actor.glideSpeed ?? 15) * delta, distance - 1.2));
        else if (this._requestAttack(actor, target, { windup: 1.1, recovery: 2 })) { actor.isLatched = true; actor.latchedTo = target; actor.latchTimer = 5; target.isRoyalFacehuggerLatched = true; }
      } else {
        actor.type ??= 'micro_swarm';
        actor.orbitAngle += (actor.orbitSpeed ?? 3.5) * delta;
        if (distance > 3) position.addScaledVector(direction.normalize(), Math.min(9 * delta, distance - 3));
        else if (this._requestAttack(actor, target, { windup: 1, recovery: 1.3 })) target.takeDamage(actor.damage, false, actor, { attackKind: 'swarm', blockable: false, parryable: false });
      }
      this._showAttackCue(actor);
    }
    for (let i = this.spitterMortars.length - 1; i >= 0; i--) {
      const shot = this.spitterMortars[i]; shot.life -= delta; shot.vel.y -= shot.gravity * delta; shot.mesh.position.addScaledVector(shot.vel, delta);
      if (shot.mesh.position.y <= .2 || shot.life <= 0) { for (const target of livingPlayers) if (target.position.distanceTo(shot.targetPos) < 3) this._hazardDamage(shot, target, 45); this.spawnAcidPool(shot.targetPos); disposeObject(shot.mesh); disposeObject(shot.indicatorMesh); this.spitterMortars.splice(i,1); }
    }
  }

}
