/* Xenomorph Swarm Engine 3.0 - Crusher, Praetorian, Ovimorph Eggs & Gore */

import * as THREE from 'three';
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
  }

  setGoreEngine(goreEngine) {
    this.goreEngine = goreEngine;
  }

  get pendingSpawnCount() { return this.pendingSpawns.length; }
  get remainingCount() { return this.aliens.length + this.pendingSpawnCount; }

  recordDefeat(enemy) {
    if (enemy?._defeatReported) return;
    if (enemy) enemy._defeatReported = true;
    this.deadCount++;
    this.combatDirector?.release(enemy);
    this._clearAttackCue(enemy);
    this.onDefeated?.({ position: enemy?.mesh?.position.clone(), kind: enemy?.objectiveCommander ? 'commander' : (enemy?.type ?? 'chestburster'), isOfficer: enemy?.isOfficer === true });
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

    this.aliens.push({
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
    const state = this.combatDirector?.getAttackState(enemy);
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
    if (!this.combatDirector) return true;
    const allowed = this.combatDirector.requestAttack(enemy, player, options);
    this._showAttackCue(enemy);
    return allowed;
  }

  _hazardDamage(source, player, amount) {
    if (this.combatDirector) return this.combatDirector.applyHazardDamage(source, player, amount);
    player.takeDamage(amount, true);
    return amount;
  }

  spawnHiveOfficer(playerPos, offsetX = 0, title = 'GARDE DE NŒUD KAINDE AMEDHA') {
    const group = createCreatureModel('officer', this.sharedResources);
    group.position.set(playerPos.x + offsetX, 0, playerPos.z - 30);
    this.scene.add(group);

    this.aliens.push({
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

    this.aliens.push({
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

    this.aliens.push({
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

    this.aliens.push({
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

  createAlienMesh(isFacehugger, isBoiler = false, isNeomorph = false, isPraetomorph = false, isRedSwarm = false, isSpitter = false, isRunner = false) {
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

    for (let i = this.aliens.length - 1; i >= 0; i--) {
      const a = this.aliens[i];
      if (a.isLatched) continue;
      const dist = a.mesh.position.distanceTo(attack.origin);

      if (dist <= attack.radius + (a.radius || 1.0)) {
        a.hp -= attack.damage;
        const killed = a.hp <= 0;

        // Reactive Acid Splashback Physics (slashing xenos sprays pressurized molecular acid back at attacker)
        if (attack.origin) {
          this.spawnAcidSplash(a.mesh.position, attack.origin);
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
            this.detonateBoiler(a, attack.origin);
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
            disposeObject(a.mesh, this.sharedResources);
            this.aliens.splice(i, 1);
            this.recordDefeat(a);
          }
        }
      }
    }

    for (let i = this.eggs.length - 1; i >= 0; i--) {
      const egg = this.eggs[i];
      if (egg.mesh.position.distanceTo(attack.origin) <= attack.radius + 1.0) {
        this.spawnAcidPool(egg.mesh.position);
        disposeObject(egg.mesh, this.sharedResources);
        this.eggs.splice(i, 1);
        hits.push({
          pos: egg.mesh.position.clone(),
          damage: attack.damage,
          killed: true
        });
      }
    }

    for (let i = this.chestbursters.length - 1; i >= 0; i--) {
      const cb = this.chestbursters[i];
      if (cb.mesh.position.distanceTo(attack.origin) > attack.radius + 0.5) continue;
      cb.hp -= attack.damage;
      const killed = cb.hp <= 0;
      hits.push({ pos: cb.mesh.position.clone(), damage: attack.damage, killed });
      if (killed) {
        disposeObject(cb.mesh, this.sharedResources);
        this.chestbursters.splice(i, 1);
        this.recordDefeat(cb);
      }
    }

    return hits;
  }

  limitHazards(list, max) {
    while (list.length >= max) disposeObject(list.shift().mesh, this.sharedResources);
  }

  spawnAcidSplash(originPos, targetPos) {
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
        damage: 18
      });
    }
  }

  spawnChestburster(pos) {
    this.limitHazards(this.chestbursters, 40);
    const mesh = this.createChestbursterMesh();
    mesh.position.copy(pos);
    this.scene.add(mesh);
    this.chestbursters.push({
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
    const livingPlayers = [player, secondaryPlayer].filter(p => p && p.hp !== 0);
    if (!livingPlayers.length) return;
    player = livingPlayers[0];
    if (this.pendingSpawns.length && !this.combatDirector?.isInGrace) {
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
      this.aliens.push({ mesh: facehugger, type: 'facehugger', pressureId: this.spawnSequence++, hp: 40, maxHp: 40,
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
        if (this._requestAttack(cb, targetPlayer, { windup: 0.7, recovery: 1.4 })) targetPlayer.takeDamage(this.combatDirector ? cb.damage : cb.damage * delta);
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
      splash.mesh.position.addScaledVector(splash.vel, delta);

      // A projectile hits the nearest intersected living hunter, including player2.
      const targetPlayer = this._nearestPlayer(splash.mesh.position, livingPlayers);
      if (splash.mesh.position.distanceTo(targetPlayer.position) < 1.6) {
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
        if (targetPlayer.isBlocking) {
          targetPlayer.audioEngine.playShieldBlock();
        } else {
          this._hazardDamage(glob, targetPlayer, 24);
          if (this.audioEngine && this.audioEngine.playAcidGlobuleHiss) {
            this.audioEngine.playAcidGlobuleHiss();
          }
        }
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

    // 4. Horde AI (Crusher, Praetorian, Warriors, Facehuggers, Officers)
    this.aliens.forEach(a => {
      this._showAttackCue(a);
      const targetPlayer = livingPlayers.reduce((nearest, candidate) =>
        candidate.position.distanceToSquared(a.mesh.position) < nearest.position.distanceToSquared(a.mesh.position) ? candidate : nearest
      );
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
          a.mesh.rotation.y += Math.sin(Date.now() * 0.05) * 0.05;
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
        a.mesh.rotation.z = Math.sin(Date.now() * 0.02) * 0.1;
        if (a.stunTimer <= 0) {
          a.isStunned = false;
          a.mesh.rotation.z = 0;
        }
        return;
      }

      const dir = targetPlayer.position.clone().sub(a.mesh.position);
      dir.y = 0;
      const dist = dir.length();
      const engaged = !this.combatDirector || (dist < 22 && this.combatDirector.canEngage(a, targetPlayer));
      if (this.combatDirector && !engaged) {
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
              targetPlayer.takeDamage(35);
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
          this.spawnAcidSplash(a.mesh.position, targetPlayer.position);
        }
      }

      // Spitter Long-Range Acid Artillery AI (Aliens: Colonial Marines Lore)
      if (a.type === 'spitter') {
        a.spitCooldown -= delta;
        if (a.spitCooldown <= 0 && dist >= 7.0 && dist <= 26.0 && this._requestAttack(a, targetPlayer, { kind: 'ranged', windup: 0.9, recovery: 1.6 })) {
          a.spitCooldown = 3.2;
          this.audioEngine.playXenoHiss();
          this.spawnAcidSplash(a.mesh.position, targetPlayer.position);
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

        // If charging against targetPlayer with Feral Shield raised -> STUN CRUSHER!
        if (a.isCharging && dist <= a.radius + 1.2 && targetPlayer.isBlocking) {
          a.isCharging = false;
          a.isStunned = true;
          a.stunTimer = 5.0; // 5-second stun window for execution!
          targetPlayer.audioEngine.playShieldBlock();
          return;
        }
      }

      // Check if low HP sub-boss enters execution stun (Crusher, Praetorian, Grid Alien)
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien') && a.hp <= a.maxHp * 0.25 && !a.isStunned) {
        a.isStunned = true;
        a.stunTimer = 6.0;
      }

      // Boiler suicide kamikaze charge
      if (a.type === 'boiler') {
        a.mesh.children.forEach(c => {
          if (c.name === 'boil') c.scale.setScalar(1.0 + Math.sin(Date.now() * 0.018) * 0.25);
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
        a.mesh.position.addScaledVector(strafe, Math.sin(Date.now() * 0.007) * 4.0 * delta);

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
              if (targetPlayer.isBlocking) {
                targetPlayer.audioEngine.playShieldBlock();
              } else {
                targetPlayer.takeDamage(35);
              }
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
              if (targetPlayer.isBlocking) {
                targetPlayer.audioEngine.playShieldBlock();
              } else {
                targetPlayer.takeDamage(45);
              }
            }
          }
          return;
        }
      }

      // Red Xenomorph Hive Civil War Infighting (Aliens: Genocide 1991)
      if (a.type === 'red_warrior') {
        for (let j = 0; j < this.aliens.length; j++) {
          const other = this.aliens[j];
          if (other !== a && other.type !== 'red_warrior' && other.type !== 'facehugger') {
            const xDist = a.mesh.position.distanceTo(other.mesh.position);
            if (xDist <= 3.2) {
              other.hp -= 40 * delta;
              a.hp -= 25 * delta;
              if (Math.random() < 0.04 && this.audioEngine && this.audioEngine.playRedSwarmHiss) {
                this.audioEngine.playRedSwarmHiss();
              }
              break;
            }
          }
        }
      }

      if (dist > (a.radius || 1.2) + (this.combatDirector ? 1.2 : 0)) {
        dir.normalize();
        a.mesh.position.addScaledVector(dir, a.speed * delta);
        // Only normal ground pursuit skirts solid scenery. Juggles, ceiling
        // ambushes, pounces and active Crusher dashes keep their own movement.
        if (!a.isCharging && a.mesh.position.y <= 0.2) {
          const navigationRadius = Math.max(0.5, Math.min(a.radius || 0.65, 1.2));
          this.environment?.resolveAgentMovement(a.mesh.position, targetPlayer.position, a.speed * delta, navigationRadius);
        }
        a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      } else {
        const granted = this._requestAttack(a, targetPlayer, { windup: a.type === 'facehugger' ? 1 : 0.7, recovery: 1.6 });
        if (!granted) return;
        if (a.type === 'facehugger' && !targetPlayer.isFacehuggerLatched) {
          targetPlayer.triggerFacehuggerLatch();
          a.isLatched = true;
          disposeObject(a.mesh, this.sharedResources);
        } else {
          targetPlayer.takeDamage(this.combatDirector ? a.damage : a.damage * delta);
        }
      }
    });
  }

  detonateBoiler(boiler, targetOrPos) {
    if (this.audioEngine && this.audioEngine.playBoilerDetonation) {
      this.audioEngine.playBoilerDetonation();
    }
    const pos = boiler.mesh.position.clone();
    disposeObject(boiler.mesh, this.sharedResources);
    const idx = this.aliens.indexOf(boiler);
    if (idx !== -1) this.aliens.splice(idx, 1);
    this.recordDefeat(boiler);

    const targetPos = (targetOrPos && targetOrPos.position) ? targetOrPos.position : (targetOrPos || pos);

    // Blast damage in 8.0m radius
    if (targetOrPos && targetOrPos.takeDamage) {
      if (targetPos.distanceTo(pos) <= 8.0) {
        if (targetOrPos.isBlocking) {
          targetOrPos.audioEngine.playShieldBlock();
        } else {
          if (this.combatDirector) this._hazardDamage(boiler, targetOrPos, 75);
          else targetOrPos.takeDamage(75);
        }
      }
    }

    // 5 flying acid droplets and large acid pool
    this.spawnAcidSplash(pos, targetPos);
    this.spawnAcidPool(pos);
  }

  clearWave() {
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
}
