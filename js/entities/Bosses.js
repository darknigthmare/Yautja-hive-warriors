/* Mythic Boss Raid Manager (Predalien Queen & Flying Empress Matriarch) */

import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';
import { selectHostileTarget, requestHostileAttack, syncHostileWarning, releaseHostileAttack } from '../engine/HostilePressure.js';
import { createCreatureModel, animateCreatureModel } from '../graphics/CreatureModels.js';
import { buildHunterModel } from '../graphics/HunterModel.js';
import { CHARACTERS_DATA } from '../data/charactersData.js';
import { getBossDefinition, bossCanAttack } from '../data/BossRegistry.js';
import { applyBattleUnit, selectBattleTarget, listBattleTargets, moveBattleOrder, requestNPCStrike } from '../engine/BattleActorSupport.js';
import { recordCombatDeath } from '../engine/CombatEvents.js';

export class BossManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.activeBoss = null;
    this.sharedResources = new Set();
    this.acidSpitProjectiles = [];
    this.embryoProjectiles = [];
    this.pendingHatches = [];
    this.weaponProjectiles = [];
    this.pendingActions = [];
    this.effects = [];
    this.time = 0;
  }


  spawnBoss(type, spawnPos) {
    const definition = getBossDefinition(type); // Validate before clearing a live encounter.
    if (!spawnPos?.isVector3 || !spawnPos.toArray().every(Number.isFinite)) throw new TypeError('Boss spawn position must be finite');
    this.clear();
    const mesh = this.createBossMesh(type);
    mesh.position.copy(spawnPos);
    mesh.traverse(child => { if (child.isMesh) child.castShadow = true; });
    mesh.updateMatrixWorld(true);
    const bounds = new THREE.Box3().setFromObject(mesh, true), height = bounds.max.y - bounds.min.y;
    if (Number.isFinite(height) && height > 1e-5) mesh.scale.multiplyScalar(definition.height / height);
    mesh.userData.encounterProfile = definition.id; mesh.userData.assetFidelity = definition.assetFidelity;
    this.scene.add(mesh);
    this.activeBoss = { type, definition, mesh, hp: definition.hp, maxHp: definition.hp,
      phase: 1, isStunned: false, stunTimer: 0, hasEnteredStun: false,
      contactCooldown: 1.4, tailWhipCooldown: 3.5, spitCooldown: 4,
      regurgitateCooldown: 5, shriekCooldown: 4, specialCooldown: 5,
      phaseShieldHp: 1800, hasPhaseShield: false, broodAllowance: 6, shieldUntil: 0 };
    this.activeBoss.combatManager = this;
    this.activeBoss.takeDamage = (amount, details = {}) => this.takeDamage(amount, null, { killerFaction: 'player_clan', ...details });
    const cue = type === 'feral_predator_boss' ? 'playFeralPredatorPrimalRoar'
      : type === 'the_offspring' ? 'playOffspringShriek' : 'playYautjaRoar';
    this.audioEngine?.[cue]?.();
    return this.activeBoss;
  }

  createBossMesh(type) {
    const definition = getBossDefinition(type);
    if (definition.hunterProfile) {
      const data = CHARACTERS_DATA.find(profile => profile.id === definition.hunterProfile);
      const owner = { data }; const mesh = buildHunterModel(owner); mesh._bossHunterOwner = owner; return mesh;
    }
    if (type === 'xenomorph_queen') type = 'queen';
    if (!['the_offspring', 'empress_matriarch', 'predalien_queen', 'imperial_queen', 'praetorian', 'predalien', 'queen'].includes(type)) return this.createRecentBossMesh(type);
    const kind = type === 'the_offspring' ? 'offspring' : type === 'empress_matriarch' ? 'empress'
      : type === 'predalien_queen' ? 'predalien' : type === 'imperial_queen' ? 'imperial'
      : type === 'praetorian' ? 'praetorian' : type === 'predalien' ? 'predalien' : 'queen';
    return createCreatureModel(kind, this.sharedResources);
  }


  regurgitateChestbursters(player, horde) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'embryos')) return false;
    this.audioEngine.playPredalienRegurgitate();

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 3.2, 0));
    const target = player.position.clone();
    const dir = target.clone().sub(origin).normalize();

    // A volley may hit each player once; overlapping pods never stack three
    // unavoidable damage events in the same frame.
    const volley = { hitPlayers: new Set() };
    // Launch embryonic Chestburster pods
    for (let i = 0; i < 3; i++) {
      const spreadDir = dir.clone().add(new THREE.Vector3(
        (Math.random() - 0.5) * 0.4,
        0.25 + Math.random() * 0.2,
        (Math.random() - 0.5) * 0.4
      )).normalize();

      const embryoGeo = new THREE.SphereGeometry(0.35, 8, 8);
      const embryoMat = new THREE.MeshStandardMaterial({ color: 0xef4444, roughness: 0.2, metalness: 0.1 });
      const embryoMesh = new THREE.Mesh(embryoGeo, embryoMat);
      embryoMesh.position.copy(origin);
      this.scene.add(embryoMesh);

      this.embryoProjectiles.push({
        mesh: embryoMesh,
        velocity: spreadDir.multiplyScalar(24),
        gravity: -20,
        damage: 60,
        life: 2.5,
        volley
      });
    }

    // Spawn a live Chestburster directly into horde
    if (horde && horde.spawnChestburster && this.activeBoss.broodAllowance > 0) {
      this.activeBoss.broodAllowance--;
      this.pendingHatches.push({ life: 0.35, pos: origin, horde });
    }
  }


  takeDamage(amount, horde = null, details = {}) {
    const boss = this.activeBoss;
    if (!boss || boss.hp <= 0 || !Number.isFinite(amount) || amount <= 0) return null;
    if (boss.hasPhaseShield) {
      const absorbed = Math.min(boss.phaseShieldHp, amount * .6);
      boss.phaseShieldHp -= absorbed; amount -= absorbed;
      if (boss.phaseShieldHp <= 0) { boss.hasPhaseShield = false; if (boss.mesh.userData.phaseShield) boss.mesh.userData.phaseShield.visible = false; this.audioEngine?.playEngineerBioArmorShatter?.(); }
    }
    if (boss.definition?.shield && this.time < boss.shieldUntil && details.cause !== 'reflected-bolt') amount *= .45;
    boss.hp = Math.max(0, boss.hp - amount);
    if (boss.hp === 0) {
      const event = recordCombatDeath(this, boss, { kind: boss.type, isBoss: true, cause: details.cause ?? 'combat', ...details });
      this.lastDeathEvent = event; this.onDefeated?.(event); this.clear(); return event;
    }
    const nextPhase = boss.hp <= boss.maxHp * .3 ? 3 : boss.hp <= boss.maxHp * .65 ? 2 : 1;
    if (nextPhase > boss.phase) {
      boss.phase = nextPhase;
      if (boss.type === 'awakened_engineer' && nextPhase === 2) { boss.hasPhaseShield = true; if (boss.mesh.userData.phaseShield) boss.mesh.userData.phaseShield.visible = true; }
      if (boss.type.includes('predalien') && horde) this.triggerPregnantBurstFrenzy(horde);
    }
    if (nextPhase === 3 && !boss.hasEnteredStun) { boss.isStunned = true; boss.hasEnteredStun = true; boss.stunTimer = 3.5; }
    return null;
  }

  executeBoss(victim, { player, range = 6, killerFaction = 'player_clan' } = {}) {
    if (!victim || victim !== this.activeBoss || victim.hp <= 0 || victim.executionConsumed || victim.hp > victim.maxHp * .3 ||
        !player?.position?.isVector3 || !(player.hp > 0) || player.isFacehuggerLatched || player.isRoyalFacehuggerLatched ||
        !Number.isFinite(range) || range <= 0 || range > 8 || player.position.distanceTo(victim.mesh.position) > range) return null;
    victim.executionConsumed = true;
    victim.hp = 0; victim.hasPhaseShield = false; victim.phaseShieldHp = 0;
    const event = recordCombatDeath(this, victim, { kind: victim.type, isBoss: true, cause: 'execution', killerFaction });
    this.lastDeathEvent = event;
    if (event) this.onDefeated?.(event);
    this.clear();
    return event;
  }

  triggerTailWhip(player) {
    const boss = this.activeBoss;
    if (!boss || !bossCanAttack(boss.type, 'tail')) return false;
    this.audioEngine?.playQueenTailWhip?.(); boss.tailSpinLife = .32;
    if (boss.mesh.position.distanceTo(player.position) <= 8.5) {
      this.applyBossDamage(player, 100, 'tail', boss);
      const direction = player.position.clone().sub(boss.mesh.position).setY(0).normalize();
      player.position.addScaledVector(direction, 4); player.mesh?.position.copy(player.position);
    }
    return true;
  }

  spitAcidMortar(player) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'spit')) return false;
    this.audioEngine.playQueenAcidSpit();

    const origin = this.activeBoss.mesh.position.clone().add(new THREE.Vector3(0, 4.0, 0));
    const target = player.position.clone();
    const spitDir = target.clone().sub(origin).normalize();

    const acidGeo = new THREE.SphereGeometry(0.4, 8, 8);
    const acidMat = new THREE.MeshBasicMaterial({ color: 0x39ff14 });
    const acidMesh = new THREE.Mesh(acidGeo, acidMat);
    acidMesh.position.copy(origin);
    this.scene.add(acidMesh);

    this.acidSpitProjectiles.push({
      mesh: acidMesh,
      velocity: spitDir.multiplyScalar(22).add(new THREE.Vector3(0, 8, 0)),
      gravity: -24,
      damage: 75,
      life: 2.5
    });
  }


  clear() {
    releaseHostileAttack(this, this.activeBoss);
    disposeObject(this.activeBoss?.mesh, this.sharedResources);
    this.activeBoss = null;
    for (const list of [this.acidSpitProjectiles, this.embryoProjectiles, this.weaponProjectiles, this.effects]) for (const item of list ?? []) disposeObject(item.mesh);
    this.acidSpitProjectiles = []; this.embryoProjectiles = []; this.weaponProjectiles = []; this.effects = [];
    this.pendingHatches = []; this.pendingActions = []; this.maskTarget = null;
  }

  update(delta, player, horde = null) {
    if (!this.activeBoss || !Number.isFinite(delta) || delta <= 0) return;
    this.time += delta;
    const boss = this.activeBoss;
    if (boss.hp <= 0) { const event = recordCombatDeath(this, boss, { kind: boss.type, isBoss: true, killerFaction: boss.lastDamageFaction }); this.lastDeathEvent = event; if (event) this.onDefeated?.(event); this.clear(); return; }
    const living = this.combatDirector?.livingPlayers?.length ? this.combatDirector.livingPlayers : (Array.isArray(player) ? player : [player]);
    const players = boss.battleUnitId && this.battleSimulation ? listBattleTargets(this, boss, living) : living.filter(target => target?.hp > 0 && target.position);
    const collisionTarget = (position, radius) => players.filter(target => position.distanceTo(target.position) < radius)
      .sort((a, b) => position.distanceToSquared(a.position) - position.distanceToSquared(b.position))[0];
    this._updateWeaponProjectiles(delta, players);
    if (this.activeBoss !== boss) return;
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const fx = this.effects[i]; fx.life -= delta;
      if (fx.mesh.material?.opacity !== undefined) fx.mesh.material.opacity = Math.max(0, fx.life / fx.duration) * .65;
      if (fx.expands) fx.mesh.scale.setScalar(1 + (fx.duration - fx.life) * 8);
      if (fx.life <= 0) { disposeObject(fx.mesh); this.effects.splice(i, 1); }
    }
    for (let i = this.pendingHatches.length - 1; i >= 0; i--) {
      const hatch = this.pendingHatches[i]; hatch.life -= delta;
      if (hatch.life <= 0) { if (this.activeBoss === boss) hatch.horde.spawnChestburster(hatch.pos); this.pendingHatches.splice(i, 1); }
    }
    for (const key of ['acidSpitProjectiles', 'embryoProjectiles']) for (let i = this[key].length - 1; i >= 0; i--) {
      const projectile = this[key][i]; projectile.life -= delta;
      const previous = projectile.mesh.position.clone();
      projectile.velocity.y += projectile.gravity * delta; projectile.mesh.position.addScaledVector(projectile.velocity, delta);
      const cover = this.environment?.traceSegment?.(previous, projectile.mesh.position, { radius: .35 });
      if (cover) projectile.mesh.position.copy(cover.point);
      const target = cover ? null : collisionTarget(projectile.mesh.position, key === 'embryoProjectiles' ? 2 : 2.2);
      if (target && !projectile.volley?.hitPlayers.has(target)) { target.takeDamage(projectile.damage, true, boss, { attackKind: 'acid', blockable: false, parryable: false }); projectile.volley?.hitPlayers.add(target); }
      if (target || cover || projectile.mesh.position.y <= .1 || projectile.life <= 0) { disposeObject(projectile.mesh); this[key].splice(i, 1); }
    }
    player = boss.battleUnitId && this.battleSimulation ? selectBattleTarget(this, boss, living) : selectHostileTarget(this, boss.mesh.position, Array.isArray(player) ? players[0] : player);
    if (this.maskTarget) { this.maskTarget.life -= delta; if (this.maskTarget.life <= 0) this.maskTarget = null; }
    if (boss.charge) {
      const charge = boss.charge; charge.life -= delta;
      const before = boss.mesh.position.clone();
      boss.mesh.position.addScaledVector(charge.direction, charge.speed * delta);
      if (charge.kind === 'leap') boss.mesh.position.y = charge.startY + Math.sin(Math.PI * Math.min(1, 1 - charge.life / charge.duration)) * 2.4;
      this.environment?.resolveMovement?.(boss.mesh.position, 2.0);
      const path = new THREE.Line3(before, boss.mesh.position), nearest = new THREE.Vector3();
      for (const target of players) if (!charge.hit.has(target)) {
        path.closestPointToPoint(target.position, true, nearest);
        if (nearest.distanceTo(target.position) <= 2.5 && target.position.y < 1.4) { charge.hit.add(target); this.applyBossDamage(target, charge.damage, charge.kind, boss); }
      }
      if (charge.life <= 0) { if (charge.kind === 'leap') boss.mesh.position.y = charge.startY; boss.charge = null; }
      return;
    }
    if (!player || player.hp <= 0) { releaseHostileAttack(this, boss); if (boss.battleUnitId) moveBattleOrder(this, boss, delta, 7.5); return; }
    if (boss.isStunned) { releaseHostileAttack(this, boss); boss.pressureAction = null; boss.stunTimer -= delta; if (boss.stunTimer <= 0) boss.isStunned = false; return; }
    for (const [key, initial] of [['tailWhipCooldown', 3.5], ['spitCooldown', 4], ['regurgitateCooldown', 5], ['shriekCooldown', 4], ['contactCooldown', 1.4], ['specialCooldown', 5]]) boss[key] = Math.max(0, (boss[key] ?? initial) - delta);
    const dir = player.position.clone().sub(boss.mesh.position); dir.y = 0;
    boss.weaponRecovery = Math.max(0, (boss.weaponRecovery ?? 0) - delta);
    const distance = dir.length(), allowed = boss.definition.attacks;
    const choose = action => allowed.includes(action);
    if (!boss.pressureAction) {
      if (distance <= 8.5 && boss.tailWhipCooldown <= 0 && choose('tail')) boss.pressureAction = 'tail';
      else if (distance <= 11 && boss.specialCooldown <= 0 && choose('gale')) boss.pressureAction = 'gale';
      else if (distance <= 10 && boss.specialCooldown <= 0 && choose('slam')) boss.pressureAction = 'slam';
      else if (distance <= 14 && boss.specialCooldown <= 0 && choose('vortex')) boss.pressureAction = 'vortex';
      else if (distance <= 6 && boss.specialCooldown <= 0 && choose('constrict')) boss.pressureAction = 'constrict';
      else if (distance <= 16 && boss.shriekCooldown <= 0 && choose('shriek')) boss.pressureAction = 'shriek';
      else if (distance > 6 && distance < 24 && boss.specialCooldown <= 0 && (choose('charge') || choose('leap'))) boss.pressureAction = choose('charge') ? 'charge' : 'leap';
      else if (distance > 5 && distance < 28 && boss.regurgitateCooldown <= 0 && choose('embryos')) boss.pressureAction = 'embryos';
      else if (distance > 7 && distance < 35 && boss.spitCooldown <= 0) boss.pressureAction = ['bolt', 'plasma', 'disc', 'spit'].find(choose) ?? null;
      else if (distance <= 3.8 && boss.contactCooldown <= 0) boss.pressureAction = 'melee';
    }
    const action = boss.pressureAction;
    const ranges = { tail: 8.5, gale: 11, slam: 10, vortex: 14, constrict: 6, shriek: 16, charge: 24, leap: 24, embryos: 28, bolt: 35, plasma: 35, disc: 35, spit: 35, melee: 4.5 };
    if (action && distance > ranges[action] + 1) { releaseHostileAttack(this, boss); boss.pressureAction = null; }
    else if (action && (player.isBattleNPC ? requestNPCStrike(boss, player, delta, {windup: action === 'melee' ? .95 : 1.25, recovery:1.8}) : requestHostileAttack(this, boss, player, delta, { kind: 'boss', windup: action === 'melee' ? .95 : 1.25, recovery: 1.8, duration: ['spit', 'embryos', 'bolt', 'plasma', 'disc'].includes(action) ? 2.5 : .65 }))) {
      if (action === 'tail') { boss.tailWhipCooldown = 4.8; this.triggerTailWhip(player); }
      else if (action === 'gale') { boss.specialCooldown = 7; this.triggerEmpressGale(player, horde); }
      else if (action === 'spit') { boss.spitCooldown = 5; this.spitAcidMortar(player); }
      else if (action === 'embryos') { boss.regurgitateCooldown = 7; this.regurgitateChestbursters(player, horde); }
      else if (['bolt', 'plasma', 'disc'].includes(action)) { boss.spitCooldown = action === 'bolt' ? 5 : 5.8; this.fireBossWeapon(player, action); }
      else if (action === 'slam') { boss.specialCooldown = 7; this.triggerMatriarchRoyalSlam(player, horde); }
      else if (action === 'vortex') { boss.specialCooldown = 8; this.triggerEngineerGravitationalVortex(player, horde); }
      else if (action === 'constrict') { boss.specialCooldown = 6; this.triggerTrilobiteConstrict(player); }
      else if (action === 'charge' || action === 'leap') { const duration = action === 'leap' ? .85 : .7; boss.specialCooldown = 7; boss.charge = { kind: action, direction: dir.normalize(), life: duration, duration, startY: boss.mesh.position.y, speed: action === 'leap' ? Math.min(26, Math.max(12, distance / duration)) : 16, damage: 70, hit: new Set() }; }
      else if (action === 'shriek') { boss.shriekCooldown = 6; this.audioEngine?.playOffspringShriek?.(); if (distance <= 10 && player.position.y < 1.2) { this.applyBossDamage(player, 60, 'shriek', boss); if (Number.isFinite(player.plasmaEnergy)) player.plasmaEnergy = Math.max(0, player.plasmaEnergy - 25); } }
      else { boss.contactCooldown = 2.1; boss.shieldUntil = this.time + .85; if (distance <= 4.5) this.applyBossDamage(player, boss.definition.species === 'yautja' ? 65 : boss.type === 'the_offspring' ? 50 : 35, 'melee', boss); }
      boss.pressureAction = null;
    }
    syncHostileWarning(this, boss, 3.2);
    const preparing = this.combatDirector?.getAttackState(boss)?.phase === 'windup' || boss._localAttackPreparation;
    const moving = distance > 3.1 && !preparing && boss.weaponRecovery <= 0;
    boss.visualPhase = (boss.visualPhase || 0) + delta * 5;
    animateCreatureModel(boss.mesh, boss.visualPhase, moving);
    const owner = boss.mesh._bossHunterOwner;
    if (owner) for (const [role, sign] of [['leftArm',-1],['rightArm',1],['leftLeg',1],['rightLeg',-1]]) if (owner[role]) owner[role].rotation.x = moving ? Math.sin(boss.visualPhase) * sign * .22 : 0;
    if (boss.tailSpinLife > 0) { boss.tailSpinLife = Math.max(0, boss.tailSpinLife - delta); boss.mesh.rotation.y += Math.PI * 2 * delta / .32; }
    if (moving) { const speed = (boss.definition.species === 'yautja' ? 8.5 : boss.type === 'the_offspring' ? 10.5 : 7.5) * (boss.phase === 3 ? 1.15 : 1); boss.mesh.position.addScaledVector(dir.normalize(), Math.min(speed * delta, distance - 3.1)); this.environment?.resolveAgentMovement?.(boss.mesh.position, player.position, speed * delta, 1.8); if (!(boss.tailSpinLife > 0)) boss.mesh.rotation.y = Math.atan2(dir.x, dir.z); }
  }

  buildTrilobiteMesh(scale = 2.6) {
    const group = new THREE.Group();

    // Pale leathery cephalopod texture with subtle translucency (Prometheus 2012)
    const mantleMat = new THREE.MeshStandardMaterial({
      color: 0xe5e2da,
      roughness: 0.55,
      metalness: 0.05
    });
    const foldMat = new THREE.MeshStandardMaterial({
      color: 0xcdc9bd,
      roughness: 0.65,
      metalness: 0.08
    });
    const visceralMat = new THREE.MeshStandardMaterial({
      color: 0x9f1239,
      roughness: 0.35,
      metalness: 0.2
    });
    const suckerMat = new THREE.MeshStandardMaterial({
      color: 0xf43f5e,
      roughness: 0.25,
      metalness: 0.1
    });
    const beakMat = new THREE.MeshStandardMaterial({
      color: 0x18181b,
      roughness: 0.2,
      metalness: 0.85
    });

    // 1. Central Mantle Dome (flattened bulbous cephalopod body)
    const mantle = new THREE.Mesh(new THREE.SphereGeometry(1.5 * scale, 16, 14), mantleMat);
    mantle.scale.set(1.4, 0.75, 1.6);
    mantle.position.y = 1.6 * scale;
    group.add(mantle);

    // Ribbed dorsal folds across the mantle
    for (let r = 0; r < 5; r++) {
      const fold = new THREE.Mesh(new THREE.TorusGeometry((1.2 - r * 0.15) * scale, 0.12 * scale, 6, 16), foldMat);
      fold.rotation.x = Math.PI / 2;
      fold.position.set(0, (1.8 + r * 0.12) * scale, (-0.6 + r * 0.35) * scale);
      fold.scale.set(1.3, 0.6, 1.0);
      group.add(fold);
    }

    // 2. Underside Oral Beak & Sphincter Cavity
    const sphincter = new THREE.Mesh(new THREE.TorusGeometry(0.55 * scale, 0.18 * scale, 8, 16), visceralMat);
    sphincter.rotation.x = Math.PI / 2;
    sphincter.position.set(0, 0.9 * scale, 0.2 * scale);
    group.add(sphincter);

    // Quad-Keratin Beak Teeth (Radial biting mandibles inside mouth)
    for (let b = 0; b < 4; b++) {
      const ang = (b / 4) * Math.PI * 2;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.38 * scale, 4), beakMat);
      tooth.position.set(Math.cos(ang) * 0.35 * scale, 0.9 * scale, 0.2 * scale + Math.sin(ang) * 0.35 * scale);
      tooth.rotation.z = -Math.cos(ang) * 0.7;
      tooth.rotation.x = Math.sin(ang) * 0.7;
      group.add(tooth);
    }

    // 3. 7 Articulated Muscular Cephalopod Tentacles (Prometheus 2012 1:1 Canon)
    const tentacles = [];
    const tentacleAngles = [0, 0.9, 1.8, 2.7, 3.6, 4.5, 5.4]; // 7 distinct radial tentacle roots

    tentacleAngles.forEach((ang, tIdx) => {
      const tentRoot = new THREE.Group();
      const rootX = Math.cos(ang) * 1.3 * scale;
      const rootZ = Math.sin(ang) * 1.4 * scale;
      tentRoot.position.set(rootX, 1.2 * scale, rootZ);

      const segments = [];
      let parentGroup = tentRoot;
      const numSegments = 5;

      for (let s = 0; s < numSegments; s++) {
        const segGroup = new THREE.Group();
        const segRadius = (0.24 - s * 0.035) * scale;
        const segLength = (1.5 - s * 0.12) * scale;

        const segMesh = new THREE.Mesh(new THREE.CylinderGeometry(segRadius * 0.8, segRadius, segLength, 8), mantleMat);
        segMesh.position.y = -segLength / 2;
        segGroup.add(segMesh);

        // Suction cup rings along the underside
        for (let u = 0; u < 2; u++) {
          const sucker = new THREE.Mesh(new THREE.TorusGeometry(segRadius * 0.35, segRadius * 0.1, 4, 8), suckerMat);
          sucker.position.set(0, -segLength * (0.3 + u * 0.4), segRadius * 0.75);
          sucker.rotation.x = Math.PI / 2;
          segGroup.add(sucker);
        }

        if (s === 0) {
          segGroup.rotation.y = ang;
          segGroup.rotation.z = 0.55;
        } else {
          segGroup.position.y = -segLength;
          segGroup.rotation.z = -0.15;
        }

        parentGroup.add(segGroup);
        parentGroup = segGroup;
        segments.push(segGroup);
      }

      group.add(tentRoot);
      tentacles.push({ root: tentRoot, segments });
    });

    group.userData.tentacles = tentacles;
    return group;
  }

  /* === CHANTIER 3 (v51.0): Mala'kak Awakened Engineer Titan Boss Mesh (Prometheus 2012 / Fire & Stone) === */

  buildEngineerTitanMesh(scale = 2.7) {
    const group = new THREE.Group();

    // Biomechanical pressure suit materials (dark ribbed obsidian alloy)
    const suitMat = new THREE.MeshStandardMaterial({
      color: 0x1f242c,
      metalness: 0.88,
      roughness: 0.25
    });

    // Pale alabaster marble flesh material (Prometheus Mala'kak phenotype)
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0xdde0e6,
      metalness: 0.1,
      roughness: 0.45
    });

    // Flexible corrugated breathing hose material
    const pipeMat = new THREE.MeshStandardMaterial({
      color: 0x11141a,
      metalness: 0.95,
      roughness: 0.15
    });

    // Gravitational resonance staff alloy
    const staffMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.92,
      roughness: 0.2
    });

    // Glowing Gravimetric Core Orb
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x38bdf8,
      emissive: 0x0284c7,
      emissiveIntensity: 1.4,
      metalness: 0.2,
      roughness: 0.1,
      transparent: true,
      opacity: 0.95
    });

    // 1. Muscular Torso & Ribbed Abdominal Armor
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.7 * scale, 0.5 * scale, 1.8 * scale, 10), suitMat);
    torso.position.y = 2.4 * scale;
    group.add(torso);

    // Ribbed chest plates
    for (let r = 0; r < 5; r++) {
      const rib = new THREE.Mesh(new THREE.TorusGeometry(0.55 * scale - r * 0.03 * scale, 0.04 * scale, 6, 12, Math.PI), pipeMat);
      rib.position.set(0, 2.7 * scale - r * 0.18 * scale, 0.25 * scale);
      rib.rotation.x = Math.PI / 2;
      group.add(rib);
    }

    // 2. Head with Classical Sculpted Face & Bald Cranium
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.38 * scale, 14, 14), skinMat);
    head.position.set(0, 3.55 * scale, 0.08 * scale);
    head.scale.set(0.9, 1.15, 0.95);
    group.add(head);

    // Dark void eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0x05070a });
    const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), eyeMat);
    eyeL.position.set(-0.12 * scale, 3.65 * scale, 0.38 * scale);
    group.add(eyeL);
    const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.06 * scale, 6, 6), eyeMat);
    eyeR.position.set(0.12 * scale, 3.65 * scale, 0.38 * scale);
    group.add(eyeR);

    // 3. Iconic Biomechanical Elephantine Breathing Trunk / Helmet Hose
    const trunkSegments = 7;
    for (let i = 0; i < trunkSegments; i++) {
      const tProgress = i / trunkSegments;
      const tGeo = new THREE.CylinderGeometry((0.1 - tProgress * 0.03) * scale, (0.09 - tProgress * 0.03) * scale, 0.18 * scale, 8);
      const tMesh = new THREE.Mesh(tGeo, pipeMat);
      const angle = Math.PI * 0.45 * tProgress;
      tMesh.position.set(0, 3.4 * scale - i * 0.14 * scale, 0.35 * scale + Math.sin(angle) * 0.22 * scale);
      tMesh.rotation.x = 0.35 - tProgress * 0.7;
      group.add(tMesh);
    }

    // 4. Massive Shoulders and Pauldrons
    const pauldronGeo = new THREE.SphereGeometry(0.42 * scale, 8, 8);
    const pauldronL = new THREE.Mesh(pauldronGeo, suitMat);
    pauldronL.position.set(-0.85 * scale, 3.0 * scale, 0);
    group.add(pauldronL);
    const pauldronR = new THREE.Mesh(pauldronGeo, suitMat);
    pauldronR.position.set(0.85 * scale, 3.0 * scale, 0);
    group.add(pauldronR);

    // 5. Massive Armored Legs
    const legGeo = new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.6 * scale, 8);
    const legL = new THREE.Mesh(legGeo, suitMat);
    legL.position.set(-0.35 * scale, 0.8 * scale, 0);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, suitMat);
    legR.position.set(0.35 * scale, 0.8 * scale, 0);
    group.add(legR);

    // 6. Right Arm Holding Gravitational Resonance Staff
    const armR = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.15 * scale, 1.4 * scale, 8), suitMat);
    armR.position.set(0.85 * scale, 2.2 * scale, 0.3 * scale);
    armR.rotation.x = -0.4;
    group.add(armR);

    // The Gravitational Resonance Staff (3.6m tall)
    const staffGroup = new THREE.Group();
    staffGroup.position.set(0.95 * scale, 1.9 * scale, 0.85 * scale);

    const staffShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.05 * scale, 3.8 * scale, 8), staffMat);
    staffGroup.add(staffShaft);

    // Staff top concentric gravimetric rings
    const ring1 = new THREE.Mesh(new THREE.TorusGeometry(0.25 * scale, 0.03 * scale, 6, 16), staffMat);
    ring1.position.y = 1.7 * scale;
    ring1.rotation.x = Math.PI / 2;
    staffGroup.add(ring1);

    const ring2 = new THREE.Mesh(new THREE.TorusGeometry(0.18 * scale, 0.025 * scale, 6, 16), staffMat);
    ring2.position.y = 1.7 * scale;
    ring2.rotation.y = Math.PI / 2;
    staffGroup.add(ring2);

    // Central Pulsating Gravimetric Singularity Orb
    const orb = new THREE.Mesh(new THREE.SphereGeometry(0.14 * scale, 12, 12), coreMat);
    orb.position.y = 1.7 * scale;
    staffGroup.add(orb);

    group.add(staffGroup);
    group.userData.staffGroup = staffGroup;
    group.userData.staffOrb = orb;

    // 7. Biomechanical Phase Shield (Translucent cyan dodecahedron)
    const shieldGeo = new THREE.DodecahedronGeometry(2.4 * scale, 1);
    const shieldMat = new THREE.MeshBasicMaterial({
      color: 0x00e5ff,
      wireframe: true,
      transparent: true,
      opacity: 0.4
    });
    const phaseShield = new THREE.Mesh(shieldGeo, shieldMat);
    phaseShield.position.y = 2.2 * scale;
    phaseShield.visible = false;
    group.add(phaseShield);
    group.userData.phaseShield = phaseShield;

    return group;
  }

  /* === CHANTIER 7 (v55.0): Bad Blood Berserker Super Predator Boss Mesh (Predators 2010 Mr. Black Canon) === */

  buildBerserkerPredatorMesh(scale = 2.6) {
    const group = new THREE.Group();

    // Reptilian scaly skin material
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x333b26, // Dark olive-moss mottled reptilian flesh
      roughness: 0.65,
      metalness: 0.25
    });

    // Dark gunmetal armor material
    const armorMat = new THREE.MeshStandardMaterial({
      color: 0x1f2421,
      roughness: 0.35,
      metalness: 0.85
    });

    // Bone jawbone material
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xe2ded2, // Carved bleached Xenomorph mandible
      roughness: 0.45,
      metalness: 0.15
    });

    // 1. Muscular Torso & Spiked Cuirass
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.8 * scale, 1.0 * scale), armorMat);
    torso.position.y = 2.4 * scale;
    group.add(torso);

    // 2. Distinctive Mr. Black Bio-Mask
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 1.1 * scale, 0.9 * scale), armorMat);
    head.position.set(0, 3.6 * scale, 0.2 * scale);
    group.add(head);

    // Flayed Xenomorph Lower Jawbone attached to chin
    const jawbone = new THREE.Mesh(new THREE.TorusGeometry(0.48 * scale, 0.1 * scale, 6, 12, Math.PI), boneMat);
    jawbone.rotation.x = Math.PI / 2;
    jawbone.position.set(0, 3.25 * scale, 0.45 * scale);
    group.add(jawbone);

    // Red Tri-Laser Eye Visor
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff0033 });
    const eyeLens = new THREE.Mesh(new THREE.BoxGeometry(0.55 * scale, 0.12 * scale, 0.08 * scale), eyeMat);
    eyeLens.position.set(0, 3.65 * scale, 0.68 * scale);
    group.add(eyeLens);

    // 3. Thick Crimson & Charcoal Dreadlocks
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x1a0505, roughness: 0.8 });
    for (let d = 0; d < 14; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.04 * scale, 1.6 * scale, 5), dreadMat);
      const angle = (d / 14) * Math.PI - Math.PI / 2;
      dread.position.set(Math.cos(angle) * 0.45 * scale, 3.4 * scale, -0.45 * scale);
      dread.rotation.set(-0.6, 0, Math.sin(angle) * 0.4);
      group.add(dread);
    }

    // 4. Shoulder Rotary Gatling Plasma Caster
    const gunGroup = new THREE.Group();
    gunGroup.position.set(-0.75 * scale, 3.5 * scale, -0.2 * scale);
    const gunBase = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 0.35 * scale, 0.6 * scale), armorMat);
    gunGroup.add(gunBase);
    const barrelMat = new THREE.MeshStandardMaterial({ color: 0x0f172a, metalness: 0.9 });
    for (let b = 0; b < 3; b++) {
      const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.8 * scale, 6), barrelMat);
      barrel.rotation.x = Math.PI / 2;
      const bAngle = (b / 3) * Math.PI * 2;
      barrel.position.set(Math.cos(bAngle) * 0.08 * scale, Math.sin(bAngle) * 0.08 * scale, 0.4 * scale);
      gunGroup.add(barrel);
    }
    group.add(gunGroup);

    // 5. Right Arm with Colossal Extended Wristblade
    const armR = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 1.4 * scale, 0.4 * scale), skinMat);
    armR.position.set(0.95 * scale, 2.5 * scale, 0.2 * scale);
    group.add(armR);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.95, roughness: 0.1 });
    const wristblade = new THREE.Mesh(new THREE.BoxGeometry(0.12 * scale, 0.04 * scale, 2.8 * scale), bladeMat);
    wristblade.position.set(1.05 * scale, 1.8 * scale, 1.5 * scale);
    group.add(wristblade);

    // Left Arm
    const armL = new THREE.Mesh(new THREE.BoxGeometry(0.35 * scale, 1.4 * scale, 0.4 * scale), skinMat);
    armL.position.set(-0.95 * scale, 2.5 * scale, 0.2 * scale);
    group.add(armL);

    // 6. Heavy Legs & Greaves
    const legL = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.8 * scale, 6), armorMat);
    legL.position.set(-0.45 * scale, 0.9 * scale, 0);
    group.add(legL);

    const legR = new THREE.Mesh(new THREE.CylinderGeometry(0.24 * scale, 0.18 * scale, 1.8 * scale, 6), armorMat);
    legR.position.set(0.45 * scale, 0.9 * scale, 0);
    group.add(legR);

    return group;
  }

  /* === PREY (2022): 3.1m Feral Predator Primordial Archaic Hunter Boss Mesh === */

  buildFeralPredatorMesh(scale = 2.9) {
    const group = new THREE.Group();

    // Pale leathery reptilian flesh
    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x4a4738,
      roughness: 0.72,
      metalness: 0.2
    });

    // Primitive carved bone skull mask
    const boneMat = new THREE.MeshStandardMaterial({
      color: 0xd6d3d1,
      roughness: 0.45,
      metalness: 0.15
    });

    // Dark obsidian volcanic glass
    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x09090b,
      roughness: 0.08,
      metalness: 0.95
    });

    const leatherMat = new THREE.MeshStandardMaterial({
      color: 0x271c14,
      roughness: 0.85
    });

    // 1. Muscular Torso & Dorsal Spine Ridges
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.8 * scale, 0.95 * scale), skinMat);
    torso.position.y = 2.2 * scale;
    torso.castShadow = true;
    group.add(torso);

    for (let s = 0; s < 5; s++) {
      const spine = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.35 * scale, 4), boneMat);
      spine.rotation.x = -Math.PI / 3;
      spine.position.set(0, (1.6 + s * 0.3) * scale, -0.52 * scale);
      group.add(spine);
    }

    // 2. Feral Head, Exposed Animalistic Lower Mandibles & Carved Bone Skull Mask
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.9 * scale, 0.85 * scale), skinMat);
    head.position.set(0, 3.4 * scale, 0.15 * scale);
    group.add(head);

    const boneMask = new THREE.Mesh(new THREE.BoxGeometry(0.82 * scale, 0.55 * scale, 0.65 * scale), boneMat);
    boneMask.position.set(0, 3.6 * scale, 0.32 * scale);
    group.add(boneMask);

    [-0.28, 0.28].forEach(mx => {
      const mand = new THREE.Mesh(new THREE.ConeGeometry(0.08 * scale, 0.45 * scale, 4), boneMat);
      mand.rotation.x = Math.PI / 4;
      mand.rotation.z = mx > 0 ? -0.4 : 0.4;
      mand.position.set(mx * scale, 3.1 * scale, 0.48 * scale);
      group.add(mand);
    });

    const laserAperture = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.04 * scale, 0.15 * scale, 6), new THREE.MeshBasicMaterial({ color: 0xef4444 }));
    laserAperture.rotation.x = Math.PI / 2;
    laserAperture.position.set(-0.35 * scale, 3.65 * scale, 0.62 * scale);
    group.add(laserAperture);

    // 3. Right Arm: Telescopic Obsidian Spear / Cut Blade
    const rightArm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.45 * scale), skinMat);
    rightArm.position.set(0.95 * scale, 2.1 * scale, 0);
    group.add(rightArm);

    const spearShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.05 * scale, 0.05 * scale, 2.6 * scale, 8), leatherMat);
    spearShaft.position.set(1.05 * scale, 2.0 * scale, 0.3 * scale);
    spearShaft.rotation.x = Math.PI / 3;
    group.add(spearShaft);

    const spearTip = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.8 * scale, 4), obsidianMat);
    spearTip.position.set(1.05 * scale, 2.9 * scale, 0.9 * scale);
    spearTip.rotation.x = Math.PI / 3;
    group.add(spearTip);

    // 4. Left Arm: Folding Expanding Bone Fan Shield on Forearm
    const leftArm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.5 * scale, 0.45 * scale), skinMat);
    leftArm.position.set(-0.95 * scale, 2.1 * scale, 0);
    group.add(leftArm);

    const shieldPlate = new THREE.Mesh(new THREE.BoxGeometry(0.18 * scale, 1.2 * scale, 0.85 * scale), boneMat);
    shieldPlate.position.set(-1.18 * scale, 1.8 * scale, 0.25 * scale);
    group.add(shieldPlate);

    // 5. Powerful Digigrade Legs & Archaic Loincloth
    [-0.45, 0.45].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.48 * scale, 1.8 * scale, 0.52 * scale), skinMat);
      leg.position.set(lx * scale, 0.9 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    const loincloth = new THREE.Mesh(new THREE.BoxGeometry(1.1 * scale, 0.8 * scale, 0.65 * scale), leatherMat);
    loincloth.position.set(0, 1.4 * scale, 0);
    group.add(loincloth);

    group.castShadow = true;
    return group;
  }

  /* === PREDATOR: KILLER OF KILLERS (2025): 3.2m Apex Gladiator Grandmaster Predator Boss Mesh === */

  buildApexGladiatorMesh(scale = 3.2) {
    const group = new THREE.Group();

    const skinMat = new THREE.MeshStandardMaterial({
      color: 0x2e2d29,
      roughness: 0.65,
      metalness: 0.25
    });

    const armorMat = new THREE.MeshStandardMaterial({
      color: 0xd97706, // Regal Gold Ancient Armor
      roughness: 0.28,
      metalness: 0.88
    });

    const obsidianMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      roughness: 0.15,
      metalness: 0.92
    });

    const plasmaGlowMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8
    });

    // 1. Massive Colosseum Armor Torso & Royal Pauldrons
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.5 * scale, 1.8 * scale, 1.1 * scale), armorMat);
    torso.position.y = 2.4 * scale;
    torso.castShadow = true;
    group.add(torso);

    [-0.95, 0.95].forEach(px => {
      const pauldron = new THREE.Mesh(new THREE.BoxGeometry(0.75 * scale, 0.45 * scale, 0.85 * scale), armorMat);
      pauldron.position.set(px * scale, 3.1 * scale, 0);
      group.add(pauldron);
    });

    // 2. Ceremonial Battle Skirt / Cape (Imperial Purple)
    const capeMat = new THREE.MeshStandardMaterial({ color: 0x4c1d95, roughness: 0.85 });
    const cape = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.6 * scale, 0.15 * scale), capeMat);
    cape.position.set(0, 1.7 * scale, -0.55 * scale);
    group.add(cape);

    // 3. Ancient Bio-Mask with Horned Crest & 3 Red Optic Lenses
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.85 * scale, 0.95 * scale, 0.95 * scale), obsidianMat);
    head.position.set(0, 3.45 * scale, 0.2 * scale);
    group.add(head);

    [-0.35, 0.35].forEach(hx => {
      const horn = new THREE.Mesh(new THREE.CylinderGeometry(0.04 * scale, 0.12 * scale, 0.8 * scale, 6), armorMat);
      horn.position.set(hx * scale, 4.0 * scale, -0.1 * scale);
      horn.rotation.z = hx < 0 ? -0.5 : 0.5;
      group.add(horn);
    });

    // Tri-Laser Optics
    const triLaserLight = new THREE.PointLight(0xef4444, 2.0, 8.0);
    triLaserLight.position.set(0, 3.45 * scale, 0.7 * scale);
    group.add(triLaserLight);

    // Dreadlocks (Heavy Golden Ring Clamps)
    for (let d = -4; d <= 4; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06 * scale, 0.04 * scale, 1.5 * scale, 6), skinMat);
      dread.position.set((d * 0.14) * scale, 3.0 * scale, -0.45 * scale);
      dread.rotation.x = -0.3;
      group.add(dread);
    }

    // 4. Dual Forearm Plasma Glaives (Left & Right)
    [-0.95, 0.95].forEach(ax => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.42 * scale, 1.4 * scale, 0.45 * scale), skinMat);
      arm.position.set(ax * scale, 2.3 * scale, 0);
      group.add(arm);

      // Curved Double-Edged Plasma Glaive
      const glaive = new THREE.Mesh(new THREE.BoxGeometry(0.08 * scale, 1.9 * scale, 0.22 * scale), obsidianMat);
      glaive.position.set(ax * scale, 2.2 * scale, 0.55 * scale);
      group.add(glaive);

      const edgeGlow = new THREE.Mesh(new THREE.BoxGeometry(0.04 * scale, 1.8 * scale, 0.05 * scale), plasmaGlowMat);
      edgeGlow.position.set(ax * scale, 2.2 * scale, 0.68 * scale);
      group.add(edgeGlow);
    });

    // 5. Heavy Armored Legs & Greaves
    [-0.45, 0.45].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.BoxGeometry(0.52 * scale, 1.9 * scale, 0.55 * scale), armorMat);
      leg.position.set(lx * scale, 0.95 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    group.castShadow = true;
    return group;
  }

  /* === THE PREDATOR (2018): 3.3m Ultimate Upgrade Genetically Hybridized Predator Boss Mesh === */

  buildUltimatePredatorMesh(scale = 3.3) {
    const group = new THREE.Group();

    // Genetically modified armored dermal exoskeleton
    const dermalMat = new THREE.MeshStandardMaterial({
      color: 0x1e2024,
      roughness: 0.42,
      metalness: 0.65
    });

    // Dark carbonized chitin carapace plates
    const carapaceMat = new THREE.MeshStandardMaterial({
      color: 0x111317,
      roughness: 0.28,
      metalness: 0.85
    });

    // Bone / razor tooth material
    const fangMat = new THREE.MeshStandardMaterial({
      color: 0xf3f4f6,
      roughness: 0.35,
      metalness: 0.1
    });

    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xa1a1aa,
      metalness: 0.95,
      roughness: 0.15
    });

    const brassMat = new THREE.MeshStandardMaterial({
      color: 0xd97706,
      metalness: 0.9,
      roughness: 0.2
    });

    // 1. Colossal Muscular Torso & Armored Dermal Carapace
    const torso = new THREE.Mesh(new THREE.BoxGeometry(1.6 * scale, 2.0 * scale, 1.1 * scale), dermalMat);
    torso.position.y = 2.4 * scale;
    torso.castShadow = true;
    group.add(torso);

    const chestPlates = new THREE.Mesh(new THREE.BoxGeometry(1.4 * scale, 1.2 * scale, 0.3 * scale), carapaceMat);
    chestPlates.position.set(0, 2.7 * scale, 0.6 * scale);
    group.add(chestPlates);

    // 2. Unmasked Terrifying Genetic Head & Flared Mandibles
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.9 * scale, 1.1 * scale, 1.0 * scale), dermalMat);
    head.position.set(0, 3.7 * scale, 0.2 * scale);
    group.add(head);

    // 4 Flared Mandibles
    [
      { x: -0.38, y: 3.35, z: 0.55, rx: 0.4, ry: 0.5 },
      { x: 0.38, y: 3.35, z: 0.55, rx: 0.4, ry: -0.5 },
      { x: -0.42, y: 3.15, z: 0.5, rx: -0.3, ry: 0.4 },
      { x: 0.42, y: 3.15, z: 0.5, rx: -0.3, ry: -0.4 }
    ].forEach(m => {
      const mand = new THREE.Mesh(new THREE.ConeGeometry(0.12 * scale, 0.55 * scale, 5), fangMat);
      mand.position.set(m.x * scale, m.y * scale, m.z * scale);
      mand.rotation.set(m.rx, m.ry, 0);
      group.add(mand);
    });

    // Glowing Piercing Amber Eyes
    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b });
    [-0.22, 0.22].forEach(ex => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.07 * scale, 6, 6), eyeMat);
      eye.position.set(ex * scale, 3.8 * scale, 0.72 * scale);
      group.add(eye);
    });

    // 3. Thick Heavy Dreadlocks with Tribal Brass Clasps
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x09090b, roughness: 0.75 });
    for (let d = 0; d < 18; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.065 * scale, 0.04 * scale, 1.8 * scale, 6), dreadMat);
      const angle = (d / 18) * Math.PI - Math.PI / 2;
      dread.position.set(Math.cos(angle) * 0.52 * scale, 3.5 * scale, -0.4 * scale);
      dread.rotation.set(-0.55, 0, Math.sin(angle) * 0.4);
      group.add(dread);

      if (d % 3 === 0) {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.07 * scale, 0.02 * scale, 4, 8), brassMat);
        ring.position.set(Math.cos(angle) * 0.52 * scale, 3.1 * scale, -0.55 * scale);
        group.add(ring);
      }
    }

    // 4. Heavy Shoulder Plasma Cannon Mount
    const gunPod = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 0.35 * scale, 0.8 * scale), carapaceMat);
    gunPod.position.set(-0.85 * scale, 3.5 * scale, -0.1 * scale);
    group.add(gunPod);

    const gunBarrel = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.08 * scale, 1.0 * scale, 8), carapaceMat);
    gunBarrel.rotation.x = Math.PI / 2;
    gunBarrel.position.set(-0.85 * scale, 3.5 * scale, 0.45 * scale);
    group.add(gunBarrel);

    // 5. Dual Forearms with Integrated Retractable Heavy Blades
    [-1, 1].forEach(side => {
      const arm = new THREE.Mesh(new THREE.BoxGeometry(0.4 * scale, 1.6 * scale, 0.45 * scale), dermalMat);
      arm.position.set(side * 1.05 * scale, 2.5 * scale, 0.2 * scale);
      group.add(arm);

      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.46 * scale, 0.8 * scale, 0.5 * scale), carapaceMat);
      gauntlet.position.set(side * 1.05 * scale, 2.0 * scale, 0.2 * scale);
      group.add(gauntlet);

      const dualBlade = new THREE.Mesh(new THREE.BoxGeometry(0.1 * scale, 0.04 * scale, 2.4 * scale), bladeMat);
      dualBlade.position.set(side * 1.15 * scale, 1.8 * scale, 1.4 * scale);
      group.add(dualBlade);
    });

    // 6. Colossal Muscular Legs & Armored Greaves
    [-0.5, 0.5].forEach(lx => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.28 * scale, 0.2 * scale, 2.0 * scale, 8), carapaceMat);
      leg.position.set(lx * scale, 1.0 * scale, 0);
      leg.castShadow = true;
      group.add(leg);
    });

    return group;
  }

  /* === CHANTIER 2 (v52.0): Rogue King Xenomorph Prime Boss Mesh (Aliens: Rogue 1993 Lore) === */

  buildRogueKingMesh(scale = 3.2) {
    const group = new THREE.Group();

    // Dark lustrous obsidian biomechanical chitin
    const bodyMat = new THREE.MeshStandardMaterial({
      color: 0x090d14,
      metalness: 0.92,
      roughness: 0.16
    });

    // Barbed Horn & Crest Material
    const hornMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.12
    });

    // 1. Massive Armored Skull & Flared Horned Crown
    const headGeo = new THREE.BoxGeometry(1.3 * scale, 0.9 * scale, 3.8 * scale);
    const head = new THREE.Mesh(headGeo, bodyMat);
    head.position.set(0, 3.6 * scale, 0.6 * scale);
    group.add(head);

    // Flared Hexagonal King Crown
    const crownGeo = new THREE.ConeGeometry(2.6 * scale, 4.0 * scale, 6);
    const crown = new THREE.Mesh(crownGeo, hornMat);
    crown.rotation.x = Math.PI / 2.25;
    crown.position.set(0, 4.4 * scale, -1.9 * scale);
    group.add(crown);

    // 4 Backward-Curving Heavy Horns on Crown
    const hornAngles = [-0.8, -0.28, 0.28, 0.8];
    hornAngles.forEach((ang, idx) => {
      const hornGeo = new THREE.ConeGeometry(0.18 * scale, 1.8 * scale, 6);
      const horn = new THREE.Mesh(hornGeo, hornMat);
      horn.position.set(ang * scale, 4.8 * scale + (idx === 1 || idx === 2 ? 0.3 * scale : 0), -2.2 * scale - (idx === 1 || idx === 2 ? 0.4 * scale : 0));
      horn.rotation.set(-0.8, 0, ang * 0.35);
      group.add(horn);
    });

    // 6 Massive Dorsal Exhaust Siphons
    for (let s = 0; s < 6; s++) {
      const pipeGeo = new THREE.CylinderGeometry(0.14 * scale, 0.09 * scale, 2.5 * scale, 6);
      const pipe = new THREE.Mesh(pipeGeo, hornMat);
      const side = s % 2 === 0 ? -0.75 : 0.75;
      const row = Math.floor(s / 2);
      pipe.position.set(side * scale, (3.4 - row * 0.45) * scale, (-1.0 - row * 0.45) * scale);
      pipe.rotation.x = -Math.PI / 4;
      pipe.rotation.z = side * -0.2;
      group.add(pipe);
    }

    // 2. Colossal Muscular Torso
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(1.1 * scale, 0.85 * scale, 4.2 * scale, 8), bodyMat);
    torso.position.y = 2.1 * scale;
    group.add(torso);

    // 3. Four Arms (2 Heavy Primary + 2 Smaller Secondary)
    const armGeo = new THREE.CylinderGeometry(0.18 * scale, 0.12 * scale, 2.2 * scale, 6);
    const armL = new THREE.Mesh(armGeo, bodyMat);
    armL.position.set(-1.1 * scale, 2.6 * scale, 0.6 * scale);
    armL.rotation.set(0.4, 0, -0.4);
    group.add(armL);

    const armR = new THREE.Mesh(armGeo, bodyMat);
    armR.position.set(1.1 * scale, 2.6 * scale, 0.6 * scale);
    armR.rotation.set(0.4, 0, 0.4);
    group.add(armR);

    // 4. Heavy Legs
    const legGeo = new THREE.CylinderGeometry(0.26 * scale, 0.18 * scale, 2.4 * scale, 6);
    const legL = new THREE.Mesh(legGeo, bodyMat);
    legL.position.set(-0.6 * scale, 1.1 * scale, -0.3 * scale);
    group.add(legL);
    const legR = new THREE.Mesh(legGeo, bodyMat);
    legR.position.set(0.6 * scale, 1.1 * scale, -0.3 * scale);
    group.add(legR);

    // 5. Tail ending in Trident Scythe Blade
    const tailGroup = new THREE.Group();
    tailGroup.position.set(0, 1.4 * scale, -1.8 * scale);
    const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.16 * scale, 0.08 * scale, 4.5 * scale, 6), bodyMat);
    tail.rotation.x = Math.PI / 2.5;
    tailGroup.add(tail);

    const scytheGeo = new THREE.ConeGeometry(0.4 * scale, 1.5 * scale, 4);
    const scythe = new THREE.Mesh(scytheGeo, hornMat);
    scythe.position.set(0, -1.2 * scale, -3.8 * scale);
    scythe.rotation.x = -Math.PI / 3;
    tailGroup.add(scythe);
    group.add(tailGroup);

    return group;
  }


  triggerPregnantBurstFrenzy(horde) {
    const boss = this.activeBoss;
    if (!boss || !bossCanAttack(boss.type, 'embryos') || !horde?.spawnChestburster) return;
    const count = Math.min(2, boss.broodAllowance); boss.broodAllowance -= count;
    for (let i = 0; i < count; i++) this.pendingHatches.push({ life: .35 + i * .25, pos: boss.mesh.position.clone().add(new THREE.Vector3(i ? 1.5 : -1.5, 0, 1)), horde });
  }

  regurgitateBellyVomit(player, horde) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'embryos')) return false;
    this.regurgitateChestbursters(player, horde); return true;
  }

  triggerEngineerGravitationalVortex(player, horde) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'vortex')) return false;
    this.audioEngine?.playEngineerGravitationalVortex?.();
    const distance = player.position.distanceTo(this.activeBoss.mesh.position);
    if (distance > 3 && distance <= 14) { const direction = this.activeBoss.mesh.position.clone().sub(player.position).setY(0).normalize(); player.position.addScaledVector(direction, Math.min(2.5, distance - 3)); player.mesh?.position.copy(player.position); }
    return this._shockwave(player, 6, 75, 0x70afbd);
  }

  triggerEngineerSeismicStomp(player) { return this._shockwave(player, 8, 85, 0x70afbd); }

  triggerMatriarchRoyalSlam(player, horde) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'slam')) return false;
    this.audioEngine?.playRogueKingEarthquakeRoar?.();
    return this._shockwave(player, 9, 85, 0xc38e62);
  }

  triggerTrilobiteConstrict(player) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'constrict')) return false;
    return this._shockwave(player, 5, 65, 0xe8d9bd);
  }

  spitMutagenSludge(player) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'spit')) return false;
    return this.spitAcidMortar(player);
  }

  triggerTailSkewer(player) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'tail')) return false;
    return this.triggerTailWhip(player);
  }

  triggerEmpressGale(player, horde) {
    if (!this.activeBoss || !bossCanAttack(this.activeBoss.type, 'gale')) return false;
    this.audioEngine?.playQueenTailWhip?.();
    return this._shockwave(player, 11, 65, 0xb880d4);
  }

  createRecentBossMesh(type) {
    if (type === 'rogue_king_prime') {
      return this.buildRogueKingMesh(3.2);
    }
    if (type === 'awakened_engineer') {
      return this.buildEngineerTitanMesh(2.7);
    }
    if (type === 'trilobite_prime') {
      return this.buildTrilobiteMesh(2.6);
    }
    if (type === 'berserker_super_predator') {
      return this.buildBerserkerPredatorMesh(2.6);
    }
    if (type === 'ultimate_upgrade_predator') {
      return this.buildUltimatePredatorMesh(3.3);
    }
    if (type === 'feral_predator_boss') {
      return this.buildFeralPredatorMesh(2.9);
    }
    if (type === 'apex_gladiator_predator') {
      return this.buildApexGladiatorMesh(3.2);
    }

    const group = new THREE.Group();
    const isMatriarchTitan = type === 'predalien_matriarch_titan';
    const isEmpress = type === 'empress_matriarch';
    const isPredalien = type === 'predalien_queen' || type === 'predalien_abomination' || isMatriarchTitan;
    const isAbomination = type === 'predalien_abomination' || isMatriarchTitan;
    const isOffspring = type === 'the_offspring';
    const scale = isMatriarchTitan ? 3.0 : (type === 'imperial_queen' ? 2.8 : (isEmpress ? 2.5 : (isAbomination ? 2.4 : (type === 'predalien_queen' ? 2.1 : (isOffspring ? 2.2 : 2.0)))));

    const mat = new THREE.MeshStandardMaterial({
      color: isOffspring ? 0xe2dfd2 : (isMatriarchTitan ? 0x6b4c28 : (isAbomination ? 0x524330 : (isPredalien ? 0x5a4632 : (isEmpress ? 0x2b0d3d : 0x11161d)))),
      metalness: isOffspring ? 0.1 : (isMatriarchTitan ? 0.85 : (isAbomination ? 0.75 : 0.8)),
      roughness: isOffspring ? 0.35 : (isMatriarchTitan ? 0.22 : (isAbomination ? 0.3 : 0.25))
    });

    // Elongated Alien Cranium
    const headGeo = new THREE.BoxGeometry(1.2 * scale, 0.8 * scale, 3.5 * scale);
    const head = new THREE.Mesh(headGeo, mat);
    head.position.set(0, 3.5 * scale, 0.5);
    group.add(head);

    // 1:1 Canon Xenomorph Queen / Empress Flared Armored Head Crest (Aliens 1986 / AvP 2004 / AvP Extinction)
    if (!isOffspring) {
      const crownMat = new THREE.MeshStandardMaterial({
        color: isMatriarchTitan ? 0xb45309 : (isPredalien ? 0x4a3b2c : (isEmpress ? 0x3b1254 : 0x0a0e14)),
        metalness: isMatriarchTitan ? 0.92 : 0.85,
        roughness: isMatriarchTitan ? 0.15 : 0.2
      });
      // Flared hexagonal crown fan
      const crownGeo = new THREE.ConeGeometry(2.4 * scale, 3.8 * scale, 6);
      const crown = new THREE.Mesh(crownGeo, crownMat);
      crown.rotation.x = Math.PI / 2.3;
      crown.position.set(0, 4.3 * scale, -1.8 * scale);
      group.add(crown);

      // 4 Heavy Dorsal Biomechanical Exhaust Siphons
      for (let s = 0; s < 4; s++) {
        const pipe = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 2.2 * scale, 6), crownMat);
        pipe.position.set((s % 2 === 0 ? -0.7 : 0.7) * scale, 3.2 * scale + (s > 1 ? 0.6 : 0) * scale, -1.2 * scale - (s > 1 ? 0.4 : 0) * scale);
        pipe.rotation.x = -Math.PI / 4;
        group.add(pipe);
      }

      // Secondary Smaller Chest Arms (Queen Anatomical Characteristic)
      const secArmGeo = new THREE.CylinderGeometry(0.08 * scale, 0.06 * scale, 1.2 * scale, 5);
      const armL = new THREE.Mesh(secArmGeo, crownMat);
      armL.position.set(-0.5 * scale, 2.3 * scale, 0.9 * scale);
      armL.rotation.set(0.6, 0, -0.4);
      group.add(armL);

      const armR = new THREE.Mesh(secArmGeo, crownMat);
      armR.position.set(0.5 * scale, 2.3 * scale, 0.9 * scale);
      armR.rotation.set(0.6, 0, 0.4);
      group.add(armR);
    }

    const torsoGeo = new THREE.CylinderGeometry(1.0 * scale, 0.8 * scale, 4.0 * scale, 8);
    const torso = new THREE.Mesh(torsoGeo, mat);
    torso.position.y = 2.0 * scale;
    group.add(torso);

    if (isOffspring) {
      // Canon 1:1 The Offspring Anatomy (Alien: Romulus 2024)
      // Pale albaster humanoid face with black void eyes & pharyngeal inner jaw
      const faceMat = new THREE.MeshStandardMaterial({ color: 0xe8e5dc, roughness: 0.4, metalness: 0.05 });
      const face = new THREE.Mesh(new THREE.SphereGeometry(0.7 * scale, 12, 12), faceMat);
      face.position.set(0, 3.8 * scale, 1.2 * scale);
      face.scale.set(0.8, 1.2, 0.9);
      group.add(face);

      // Sunken black void eyes
      const eyeMat = new THREE.MeshBasicMaterial({ color: 0x000000 });
      const eyeL = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 6, 6), eyeMat);
      eyeL.position.set(-0.25 * scale, 4.0 * scale, 1.8 * scale);
      group.add(eyeL);

      const eyeR = new THREE.Mesh(new THREE.SphereGeometry(0.12 * scale, 6, 6), eyeMat);
      eyeR.position.set(0.25 * scale, 4.0 * scale, 1.8 * scale);
      group.add(eyeR);

      // Pharyngeal Inner Jaw extending from humanoid mouth
      const jawMat = new THREE.MeshStandardMaterial({ color: 0x18181b, metalness: 0.9, roughness: 0.2 });
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.25 * scale, 0.2 * scale, 1.3 * scale), jawMat);
      jaw.position.set(0, 3.4 * scale, 2.0 * scale);
      group.add(jaw);

      // Segmented Biomechanical Stinger Tail
      const tailMat = new THREE.MeshStandardMaterial({ color: 0x27272a, roughness: 0.3, metalness: 0.8 });
      for (let t = 0; t < 7; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.18 * scale, 0.14 * scale, 0.7 * scale, 6), tailMat);
        seg.position.set(0, 1.5 * scale - t * 0.25 * scale, -1.2 * scale - t * 0.5 * scale);
        seg.rotation.x = -Math.PI / 3 + t * 0.15;
        group.add(seg);
      }
      const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.16 * scale, 0.8 * scale, 4), tailMat);
      stinger.rotation.x = -Math.PI / 2;
      stinger.position.set(0, 0.8 * scale, -4.5 * scale);
      group.add(stinger);

      // Elongated Slender Humanoid-Engineer Limbs & Claws (Romulus 2024 Canon)
      const limbMat = new THREE.MeshStandardMaterial({ color: 0xd8d4c7, roughness: 0.5, metalness: 0.1 });
      [-1, 1].forEach(side => {
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.12 * scale, 0.08 * scale, 3.2 * scale, 6), limbMat);
        arm.position.set(side * 1.4 * scale, 2.2 * scale, 0.4 * scale);
        arm.rotation.z = side * 0.35;
        arm.rotation.x = 0.2;
        group.add(arm);

        // Long skeletal talons
        for (let f = 0; f < 4; f++) {
          const claw = new THREE.Mesh(new THREE.ConeGeometry(0.04 * scale, 0.45 * scale, 4), limbMat);
          claw.position.set(side * 1.8 * scale + (f - 1.5) * 0.08 * scale, 0.5 * scale, 0.6 * scale);
          claw.rotation.x = Math.PI / 3;
          group.add(claw);
        }
      });
    }

    if (isPredalien) {
      // Canon 1:1 Predalien Anatomy (AVP Requiem 2007 / AvP Extinction Matriarch Titan)
      // 1. Four articulable Yautja mandibles on the jaws
      const mandibleMat = new THREE.MeshStandardMaterial({ color: 0x92400e, roughness: 0.4, metalness: 0.2 });
      const mandibleGeo = new THREE.ConeGeometry(0.18 * scale, 0.9 * scale, 5);

      const mUL = new THREE.Mesh(mandibleGeo, mandibleMat);
      mUL.position.set(-0.65 * scale, 3.3 * scale, 2.1 * scale);
      mUL.rotation.set(0.4, 0, -0.6);
      group.add(mUL);

      const mUR = new THREE.Mesh(mandibleGeo, mandibleMat);
      mUR.position.set(0.65 * scale, 3.3 * scale, 2.1 * scale);
      mUR.rotation.set(0.4, 0, 0.6);
      group.add(mUR);

      const mLL = new THREE.Mesh(mandibleGeo, mandibleMat);
      mLL.position.set(-0.5 * scale, 2.9 * scale, 2.2 * scale);
      mLL.rotation.set(0.2, 0, -0.4);
      group.add(mLL);

      const mLR = new THREE.Mesh(mandibleGeo, mandibleMat);
      mLR.position.set(0.5 * scale, 2.9 * scale, 2.2 * scale);
      mLR.rotation.set(0.2, 0, 0.4);
      group.add(mLR);

      // 2. Thick Yautja Dreadlocks crown trailing behind the biomechanical skull
      const dreadMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, roughness: 0.85 });
      const ringMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
      const dreadCount = isMatriarchTitan ? 8 : (isAbomination ? 6 : 4);
      for (let d = -dreadCount; d <= dreadCount; d++) {
        const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * scale, 0.05 * scale, 2.6 * scale, 6), dreadMat);
        const ang = (d / dreadCount) * Math.PI * 0.45;
        dread.position.set(Math.sin(ang) * 0.85 * scale, 3.3 * scale, -1.0 * scale - Math.cos(ang) * 0.35 * scale);
        dread.rotation.x = -0.55;
        dread.rotation.z = ang * 0.35;
        group.add(dread);

        if ((isAbomination || isMatriarchTitan) && Math.abs(d) % 2 === 0) {
          const ring = new THREE.Mesh(new THREE.TorusGeometry(0.09 * scale, 0.02 * scale, 4, 8), ringMat);
          ring.position.set(Math.sin(ang) * 0.85 * scale, 3.1 * scale, -1.0 * scale - Math.cos(ang) * 0.35 * scale);
          group.add(ring);
        }
      }

      // 3. Swollen Pregnant Biomechanical Belly Organ (AVP-R Chet / Matriarch Twin Brood Sacs)
      if (isAbomination || isPredalien) {
        const bellyMat = new THREE.MeshStandardMaterial({
          color: 0x65a30d,
          emissive: 0x3f6212,
          roughness: 0.25,
          metalness: 0.15,
          transparent: true,
          opacity: 0.85
        });
        if (isMatriarchTitan) {
          // Twin glowing brood sacs for Predalien Matriarch Titan
          [-0.45, 0.45].forEach(bx => {
            const sac = new THREE.Mesh(new THREE.SphereGeometry(0.75 * scale, 10, 10), bellyMat);
            sac.position.set(bx * scale, 1.85 * scale, 0.72 * scale);
            sac.scale.set(0.85, 1.3, 1.1);
            group.add(sac);
          });
        } else {
          const belly = new THREE.Mesh(new THREE.SphereGeometry(0.85 * scale, 10, 10), bellyMat);
          belly.position.set(0, 1.8 * scale, 0.65 * scale);
          belly.scale.set(0.9, 1.25, 1.05);
          group.add(belly);
        }
      }
    }

    if (isEmpress) {
      // Massive Flying Wings
      const wingMat = new THREE.MeshBasicMaterial({ color: 0x581c87, side: THREE.DoubleSide, transparent: true, opacity: 0.7 });
      const leftWing = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wingMat);
      leftWing.position.set(-4, 4, 0);
      group.add(leftWing);

      const rightWing = new THREE.Mesh(new THREE.PlaneGeometry(8, 4), wingMat);
      rightWing.position.set(4, 4, 0);
      group.add(rightWing);
    }

    return group;
  }


  armFeralMaskTrap(position, aimPosition = null) {
    const boss = this.activeBoss;
    if (boss?.type !== 'feral_predator_boss' || !position?.isVector3 || !position.toArray().every(Number.isFinite)) return false;
    const aim = aimPosition?.isVector3 ? aimPosition.clone() : boss.mesh.position.clone().add(new THREE.Vector3(0, 2.1, 0));
    this.maskTarget = { position: position.clone(), aim, life: 16 };
    boss.mesh.userData.maskGuidanceArmed = true;
    this.audioEngine?.playFeralBoltLaserLock?.();
    return true; // Signal only. Damage requires a later, visible bolt collision.
  }

  fireBossWeapon(player, kind = 'bolt') {
    const boss = this.activeBoss;
    if (!boss || !bossCanAttack(boss.type, kind)) return false;
    const mesh = kind === 'bolt' ? new THREE.Mesh(new THREE.CylinderGeometry(.055, .055, .9, 8), new THREE.MeshStandardMaterial({ color: 0xa8b0b3, metalness: .8, roughness: .3 }))
      : kind === 'disc' ? new THREE.Mesh(new THREE.TorusGeometry(.35, .065, 8, 24), new THREE.MeshStandardMaterial({ color: 0xc8c1a0, metalness: .85, roughness: .3 }))
      : new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 8), new THREE.MeshBasicMaterial({ color: 0x6fd9ff }));
    const target = player.position.clone().add(new THREE.Vector3(0, 1.7, 0));
    const origin = boss.mesh.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    const direction = target.sub(origin).normalize(); mesh.position.copy(origin);
    if (kind === 'bolt') mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), direction);
    this.scene.add(mesh);
    boss.weaponRecovery = .95;
    this.weaponProjectiles.push({ mesh, velocity: direction.multiplyScalar(kind === 'bolt' ? 22 : 19), kind, life: 3, age: 0, damage: kind === 'bolt' ? 55 : 60, radius: .25,
      owner: boss, hitPlayers: new Set(), redirected: false, guidance: kind === 'bolt' && this.maskTarget ? this.maskTarget.aim.clone() : null });
    this.audioEngine?.[kind === 'bolt' ? 'playFeralPredatorBoltFire' : 'playPlasmaShot']?.();
    return true;
  }

  _updateWeaponProjectiles(delta, players) {
    const segment = new THREE.Line3(), nearest = new THREE.Vector3(), body = new THREE.Vector3();
    for (let i = this.weaponProjectiles.length - 1; i >= 0; i--) {
      const shot = this.weaponProjectiles[i]; shot.life -= delta; shot.age += delta;
      if (shot.guidance && !shot.redirected && shot.age >= .35) { shot.velocity.copy(shot.guidance).sub(shot.mesh.position).normalize().multiplyScalar(22); shot.redirected = true; }
      segment.start.copy(shot.mesh.position); shot.mesh.position.addScaledVector(shot.velocity, delta); segment.end.copy(shot.mesh.position);
      const cover = this.environment?.traceSegment?.(segment.start, segment.end, { radius: shot.radius });
      if (cover) { segment.end.copy(cover.point); shot.mesh.position.copy(cover.point); }
      if (shot.kind === 'bolt' && shot.velocity.lengthSq() > 0) shot.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0), shot.velocity.clone().normalize());
      let consumed = false;
      if (shot.redirected && this.activeBoss === shot.owner) {
        body.copy(shot.owner.mesh.position).add(new THREE.Vector3(0, 2.1, 0)); segment.closestPointToPoint(body, true, nearest);
        if (nearest.distanceTo(body) < 1.1) { const boss = shot.owner; this.takeDamage(1200, null, { cause: 'reflected-bolt', killerFaction: 'player_clan' }); if (this.activeBoss !== boss) return; boss.isStunned = true; boss.stunTimer = 2.2; consumed = true; }
      }
      if (!consumed) for (const player of players) if (!shot.hitPlayers.has(player)) {
        body.copy(player.position).add(new THREE.Vector3(0, 1.6, 0)); segment.closestPointToPoint(body, true, nearest);
        if (nearest.distanceTo(body) <= (player.radius ?? 1) * .65 + shot.radius) { shot.hitPlayers.add(player); this.applyBossDamage(player, shot.damage, shot.kind, shot.owner); consumed = true; break; }
      }
      if (consumed || cover || shot.life <= 1e-8 || shot.mesh.position.y < -.1) { disposeObject(shot.mesh); const index = this.weaponProjectiles.indexOf(shot); if (index >= 0) this.weaponProjectiles.splice(index, 1); }
    }
  }

  _shockwave(player, radius, damage, color = 0xb99969) {
    const boss = this.activeBoss; if (!boss) return false;
    const mesh = new THREE.Mesh(new THREE.RingGeometry(radius * .9, radius, 48), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, transparent: true, opacity: .65, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2; mesh.position.copy(boss.mesh.position); mesh.position.y = .05; this.scene.add(mesh);
    this.effects.push({ mesh, life: .5, duration: .5 });
    if (player?.hp > 0 && player.position.y < 1.2 && boss.mesh.position.distanceTo(player.position) <= radius ) this.applyBossDamage(player, damage, 'shockwave', boss);
    return true;
  }

  applyBossDamage(player, amount, attackKind, boss = this.activeBoss) {
    if (!boss || !player || player.hp <= 0) return false;
    const from = boss.mesh.position.clone().add(new THREE.Vector3(0, 1.8, 0)), to = player.position.clone().add(new THREE.Vector3(0, 1.6, 0));
    if (this.environment?.hasLineOfSight && !this.environment.hasLineOfSight(from, to)) return false;
    const smallMelee = attackKind === 'melee' && boss.definition.species === 'yautja' && boss.definition.height <= 5.2;
    const shieldBolt = attackKind === 'bolt';
    player.takeDamage(amount, false, boss, { attackKind,
      blockable: smallMelee || shieldBolt, parryable: smallMelee,
      ...(shieldBolt ? { blockRequiresShield: true } : {}) });
    return true;
  }

  spawnBattleUnit(unit, group) {
    const type = unit.sourceBossType ?? unit.bossType ?? unit.actorType;
    getBossDefinition(type);
    if (this.activeBoss) return this.activeBoss.battleUnitId === unit.id ? this.activeBoss : null;
    const actor = this.spawnBoss(type, new THREE.Vector3(unit.position[0], 0, unit.position[1]));
    applyBattleUnit(this, actor, unit, group);
    return actor;
  }

  despawnBattleUnit(unitOrId) {
    const id = typeof unitOrId === 'string' ? unitOrId : unitOrId?.id;
    if (this.activeBoss?.battleUnitId !== id) return null;
    const actor = this.activeBoss, snapshot = { id, hp: Math.max(0, actor.hp), position: [actor.mesh.position.x, actor.mesh.position.z] };
    if (actor.hp <= 0) {
      const event = recordCombatDeath(this, actor, { kind: actor.type, isBoss: true, cause: 'synchronized-actor-death', killerFaction: actor.lastDamageFaction });
      if (event) { this.lastDeathEvent = event; this.onDefeated?.(event); }
    }
    this.clear(); return snapshot;
  }

}
