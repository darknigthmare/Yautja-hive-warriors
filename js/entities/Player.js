/* Playable Yautja: articulated surface model and combat state controller. */

import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';
import { buildHunterModel, createHunterWeaponGeometry } from '../graphics/HunterModel.js';
import { createImportedCharacter } from '../graphics/ImportedCharacter.js';
import { prepareImportedParts } from '../graphics/ImportedPartsPreparation.js';
import { applyMaskedBodyRegions } from '../graphics/MaskedBodyRegions.js';
import { getGeneratedAssetEntry, loadGeneratedAsset } from '../graphics/GeneratedAssetLibrary.js';
import { BIOMASK_GROUP_NAME, composeCharacterWithBiomask, parseBiomaskCalibration } from '../graphics/BiomaskComposition.js';
import { HunterLocomotion } from '../graphics/HunterLocomotion.js';
import { installCityHunterMechanisms } from '../graphics/CityHunterMechanisms.js';
import { CITY_HUNTER_CONSOLE } from '../graphics/CityHunterMechanismsCalibration.js';
import { getHunterGadgetEffects } from '../graphics/HunterGadgetEffects.js';
import { createHunterHologram } from '../graphics/HunterHologram.js';
import { prepareImportedManeTemplate } from '../graphics/ImportedManeRig.js';
import { installCityHunterRightGauntlet } from '../graphics/CityHunterRightGauntlet.js';
import { CITY_HUNTER_RIGHT_GAUNTLET } from '../graphics/CityHunterRightGauntletCalibration.js';
import { HUNTER_WEAPON_PROFILES, HUNTER_ARSENAL_PROFILES, HUNTER_ACTION_EQUIPMENT, resolveHunterLoadout } from '../data/hunterArsenal.js';
import { hunterCombatStyle } from '../data/hunterCombatStyles.js';
import { battleCoordinationDamage } from '../engine/BattleActorSupport.js';
import { canAccessLegacyAir, canHitLegacyAirTarget } from '../engine/LegacyAirstrikePolicy.js';
import { PREY_LEVEL_ID, PREY_WEAPON_PROFILES, createPreyWeaponVisual } from '../graphics/PreyEquipment.js';

const REQUIRED_RIG_BONES = ['hips', 'head', 'leftArm', 'rightArm', 'leftForeArm', 'rightForeArm', 'leftHand', 'rightHand', 'leftLeg', 'rightLeg', 'leftFoot', 'rightFoot'];
const REQUIRED_ACCESSORIES = ['blade1', 'blade2', 'shieldMesh', 'secWeaponMesh', 'plasmaGlaiveMesh', 'clanMarkMesh'];
const SOCKETS = new Set(['leftArm', 'rightArm', 'leftHand', 'rightHand', 'head']);
const surfaceState = material => ({ transparent: material.transparent, opacity: material.opacity,
  roughness: material.roughness, metalness: material.metalness, depthWrite: material.depthWrite });

// Calibrations are authored against the inspected GLB, never guessed from its name.
function importedAccessoryTransforms(rig) {
  const transforms = {};
  for (const name of REQUIRED_ACCESSORIES) {
    const value = rig.accessories?.[name];
    if (!value || !SOCKETS.has(value.socket) || !Array.isArray(value.position) || value.position.length !== 3 ||
      !Array.isArray(value.quaternion) || value.quaternion.length !== 4 || !Array.isArray(value.scale) || value.scale.length !== 3 ||
      ![...value.position, ...value.quaternion, ...value.scale].every(Number.isFinite) || value.scale.some(scale => scale <= 0)) {
      throw new Error(`Generated hunter requires explicit socket calibration: ${name}`);
    }
    const quaternion = new THREE.Quaternion(...value.quaternion);
    if (quaternion.lengthSq() < 1e-12) throw new Error(`Generated hunter has invalid socket rotation: ${name}`);
    transforms[name] = { socket: value.socket, position: new THREE.Vector3(...value.position), quaternion: quaternion.normalize(), scale: new THREE.Vector3(...value.scale) };
  }
  return transforms;
}

export class Player {
  get gameContext() { return globalThis.window?.gameInstance ?? globalThis.window?.game ?? null; }

  get cameraEyeHeight() {
    const imported = this._importedCharacter;
    return ((imported?.cameraEyeHeight ?? this.headMesh?.position.y ?? 3.6) +
      (imported?.adapter.visualGroundOffsetY ?? this._proceduralMotionRoot?.position.y ?? 0)) * (this.mesh?.scale.y ?? 1);
  }

  getCollisionHeight() { return Math.max(2.4, this.cameraEyeHeight + .35); }

  constructor(scene, charData, audioEngine, isPlayer2 = false, particles = null) {
    this.scene = scene;
    this.data = charData;
    this.audioEngine = audioEngine;
    this.isPlayer2 = isPlayer2;
    this.particles = particles;
    this._timers = [];
    this._effects = new Set();
    this._ownedFxDisposers = new Map();
    this._legacyDefeated = new WeakSet();
    this._simulationTime = 0;
    this._disposed = false;
    this._generatedVisualGeneration = 0;
    this.generatedVisualState = 'procedural';
    this.generatedBiomaskState = 'none';
    this.generatedMechanismsState = 'none';
    this.generatedMechanismsError = null;
    this.generatedRightGauntletState = 'none';
    this.generatedRightGauntletError = null;
    this.loadout = { primary: 'wristblades', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'] };
    this.combatStyle = hunterCombatStyle(charData.id);
    this.stamina = 100; this.maxStamina = 100; this.crowdAttackCooldown = 0;
    this.currentAttackId = 0; this.attackWindow = null; this.lastCombatRefusal = null;
    this.fidelityMode = 'adapted';
    this.lastArsenalRefusal = null;
    this.feralBoltAmmo = 12; this.feralBoltCooldown = 0;
    this.hasTaabeBow = false; this.hasNaruAxe = false;
    this.taabeArrowAmmo = 0; this.naruAxeCharges = 0;
    this.preyEquipmentSourceLevel = null;
    this._preyWeaponVisuals = new Map();
    this.orangeFlowerTimer = 0; this.isOrangeFlowerActive = false;
    this.taabeWarTimer = 0; this.isTaabeWarActive = false;
    this.activeWeapon = 'wristblades';
    this.weaponProfile = { damage: 1, reach: 3.8, timing: 1 };
    this.bearTrapCharges = 3;

    // Stats
    this.hp = charData.stats.hp;
    this.maxHp = charData.stats.maxHp;
    this.moveSpeed = charData.stats.moveSpeed * this.combatStyle.mobility;
    this.meleeDamage = charData.stats.meleeDamage;
    this.plasmaDamage = charData.stats.plasmaDamage;
    this.plasmaEnergy = 100;
    this.maxPlasmaEnergy = 100;
    this.musouEnergy = 0;
    this.maxMusouEnergy = 100;
    this.medicompCharges = 3;
    this.medicompHealAmount = 450;
    this.acidSolventCharges = 2;
    this.bearTrapCharges = 2;
    this.attackCooldownFactor = 1.0;
    this.meleeReachMultiplier = 1.0;
    this.meleeArcMultiplier = 1.0;
    this.tacticalLoadout = null;

    // States
    this.position = new THREE.Vector3(isPlayer2 ? 4 : 0, 0, 0);
    this.rotationY = 0;
    this.isAttacking = false;
    this.attackComboStep = 0;
    this.attackTimer = 0;

    // 4 Bio-Mask Vision Modes (0: Normal, 1: Thermal IR, 2: EM Xeno, 3: Tech Scan)
    this.visionMode = 0;

    this.isCloaked = false;
    this.isMusouActive = false;
    this.isSecondaryWeapon = false;
    this.isHybridMutated = false;
    this.isClanBranded = false;
    this.isBlocking = false;
    this.isPerched = false;
    this.warhornBuffTimer = 0;
    this.empCooldown = 0;
    this.cloakShimmerTimer = 0;
    this.combiStickCooldown = 0;
    this.shurikenCooldown = 0;
    this.smartDiscCooldown = 0;
    this.powerGloveCooldown = 0;
    this.spineWhipCooldown = 0;
    this.flechetteCooldown = 0;
    this.boneScytheCooldown = 0;
    this.compoundBowCooldown = 0;
    this.holoDecoyCooldown = 0;
    this.plasmaGlaiveCooldown = 0;
    this.iaijutsuCooldown = 0;
    this.antiGravCooldown = 0;
    this.isPlasmaGlaiveActive = false;
    this.plasmaGlaiveDuration = 0;
    this.plasmaGlaiveMesh = null;
    this.royalJellyFlasks = 1;
    this.isBerserkerActive = false;
    this.berserkerTimer = 0;
    this.berserkerHeartbeatTimer = 0;
    this.trophiesCollected = [];
    this.targetLockEnemy = null;
    this.comboResetTimer = 0;
    this.currentChargeName = null;
    this.visorAcidBurn = 0;
    this.wristNukeHoloMesh = null;
    this.parryTimer = 0;
    this.hasParryRiposte = false;
    this.riposteTimer = 0;
    this.traxNetCooldown = 0;
    this.isWhirlShieldActive = false;
    // v43.0 Systems
    this.tripwireMines = [];
    this.tripwireMineCooldown = 0;
    this.isSmartDiscGuiding = false;
    this.guidedSmartDisc = null;
    this.whirlShieldTimer = 0;
    // v44.0 Systems
    this.isFlamerActive = false;
    this.flamerAudioTimer = 0;
    // v45.0 Systems
    this.isPlasmaPistolMode = false;
    this.plasmaPistolCooldown = 0;
    this.grappleCooldown = 0;
    this.isGrappling = false;
    this.grappleTimer = 0;
    this.isMountedAPC = false;
    this.apcRef = null;
    this.isRoyalFacehuggerLatched = false;
    // v46.0 Systems
    this.isExosuitActive = false;
    this.exosuitTimer = 0;
    this.exosuitCooldown = 0;
    this.exosuitMesh = null;
    this.neurotoxinCooldown = 0;
    this.gravityMultiplier = 1.0;
    this.isMountedSmartgun = false;
    this.smartgunTurretRef = null;
    this.isSyntheticAnkleGrabbed = false;
    this.ankleGrabTimer = 0;
    this.isComancheWarPaintActive = false;
    this.comancheWarPaintTimer = 0;
    this.isMudCoated = false;
    this.mudCoatedTimer = 0;
    this.isFeralClawsActive = false;
    this.feralClawsTimer = 0;
    this.isAncestralTrackingActive = false;
    this.ancestralTrackingTimer = 0;
    this.isUrsaBerserkActive = false;
    this.ursaBerserkTimer = 0;
    this.isKenjiReflexesActive = false;
    this.kenjiReflexesTimer = 0;
    this.isTorresIncendiaryActive = false;
    this.torresIncendiaryTimer = 0;
    // v47.0 Weapon Systems
    this.isPlasmaScytheActive = false;
    this.plasmaScytheMesh = null;
    this.plasmaScytheCooldown = 0;
    this.m41aGrenadeCharges = 4;
    this.m41aGrenadeCooldown = 0;
    this.activeM41AGrenades = [];
    // v48.0 Systems (Scout Ship Orbital Beam, M77 Gauss Railgun, Modular Legendary Bio-Masks)
    this.scoutBeamCooldown = 0;
    this.activeScoutBeam = null;
    this.m77GaussAmmo = 12;
    this.m77GaussCooldown = 0;
    this.bioMaskIndex = 0;
    this.bioMaskName = 'JUNGLE HUNTER (1987)';
    this.baseMoveSpeed = this.moveSpeed;
    this.baseMeleeDamage = this.meleeDamage;
    this.basePlasmaDamage = this.plasmaDamage;
    this.bioMaskCrestGroup = null;
    // v49.0 Systems (Yautja Heavy Maul, Tracker Sonic Trap Mine, Seegson Bolt Gun)
    this.maulCooldown = 0;
    this.seegsonBoltAmmo = 10;
    this.seegsonBoltCooldown = 0;
    this.sonicTrapCooldown = 0;
    this.activeSonicTraps = [];
    // v50.0 Systems (Hunter Shadow Dash I-Frames, Dropship Carpet-Bombing, Dual Plasma Overcharge Beam)
    this.shadowDashCooldown = 0;
    this.isShadowDashing = false;
    this.shadowDashTimer = 0;
    this.dropshipBombingCooldown = 0;
    this.activeDropshipBombs = [];
    this.isDualPlasmaBeamActive = false;
    this.dualPlasmaBeamTimer = 0;
    this.dualPlasmaBeamCooldown = 0;
    this.dualPlasmaMeshGroup = null;

    // Pounce Leap State
    this.isLeaping = false;
    this.leapVelocityY = 0;

    // QTE Facehugger Struggle State
    this.isFacehuggerLatched = false;
    this.qteStrugglePresses = 0;
    this.qteRequiredPresses = 5;

    // Chantier 4: Facehugger Chestburster Incubation Infection State (Alien 1979 / Romulus)
    this.isChestbursterInfected = false;
    this.chestbursterTimer = 0;
    this.chestbursterWarningBeepTimer = 0;

    // Chantier 6: Plasma Caster Charging State (Predator 1987 / AVP 2004)
    this.isChargingPlasma = false;
    this.plasmaChargeTime = 0;

    this.mesh = this.buildYautjaMesh();
    this.mesh.traverse(child => { if (child.isMesh) child.castShadow = true; });
    this.scene.add(this.mesh);

    this.laserColorHex = isPlayer2 ? 0xffaa00 : 0xff0000;
    this.laserGroup = this.buildLaserSight(this.laserColorHex);
    this.mesh.add(this.laserGroup);
    this.locomotion = new HunterLocomotion(this);

    this.radius = 1.2;

    // === v51.0 CHANTIERS 1, 4 & 5 (Parry & Riposte, Voice Mimicry Decoy & Clan Weapon Forge) ===
    this.isParrying = false;
    this.parryTimer = 0;
    this.parryCooldown = 0;
    this.parryWindowDuration = 0.42;
    this.isCounterRiposteReady = false;
    this.counterRiposteTimer = 0;
    this.parryVisualMesh = null;

    this.mimicryCooldown = 0;
    this.activeDecoyBeacon = null;

    // === v52.0 CHANTIER 4: Combi-Stick Pole Vault Leap & Slam Drop (Predator 2 / Hunting Grounds) ===
    this.isPoleVaulting = false;
    this.poleVaultVelocityY = 0;
    this.poleVaultCooldown = 0;

    // === v53.0 CHANTIERS 3, 4, 6 & 10: Chest Roar, Cyclone Whirl, Cloak Flicker, Enkidu Armor ===
    this.chestRoarCooldown = 0;
    this.chestRoarBuffTimer = 0;
    this.cycloneWhirlCooldown = 0;
    this.isCycloneWhirling = false;
    this.cycloneWhirlTimer = 0;
    this.cloakFlickerTimer = 0;
    this.hasEnkiduArmor = false;
    this.acidResistance = 0.0;
    this.gauntletCooldownReduction = 1.0;

    // === v54.0 CHANTIERS 1, 2, 7, 8 & 10: Blooded Sacred Mark, Smart-Disc Multi-Lock, Burner Cannon, Trophy Chain ===
    this.isBloodedWarrior = false;
    this.bloodedDamageResistance = 0.85;
    this.smartDiscMultiLockCooldown = 0;
    this.burnerCooldown = 0;
    this.trophyChainRattleTimer = 0;
    this.hasBurnerCoil = false;
    this.hasCauterizingWristblade = false;
    this.bloodMarkMesh = null;

    // === v55.0 CHANTIERS 1, 2, 5 & 10: Water Cloak Disruption, Sniper Tri-Laser, Netgun Constriction, Ceramic Chitin ===
    this.isWaterSubmerged = false;
    this.waterCloakCooldown = 0;
    this.isSniperMode = false;
    this.sniperChargeTimer = 0;
    this.sniperCooldown = 0;
    this.hasCeramicThermalArmor = false;

    this.forgeUpgrades = {
      barbedCombiStick: false,
      serratedSmartDisc: false,
      overchargedCoil: false,
      masterWristblades: false,
      enkiduBattleplate: false,
      burnerPlasmaCoil: false,
      cauterizingWristblade: false,
      ceramicThermalArmor: false,
      dlexTargetingHUD: false
    };
    this.hasClassic1987Plasma = false;
    this.hasDlexTargetingHUD = false;
    this.orbitalScanTimer = 0;
    this.critChanceBonus = 0;
    this.mudCamouflageTimer = 0;
    this.isMudCamouflaged = false;
    this.billyCourageTimer = 0;
    this.isBillyCourageActive = false;
    // v60.0 Predator 2 (1990) Rooftops Systems
    this.lightningAuraTimer = 0;
    this.isLightningAuraActive = false;
    this.voodooSightTimer = 0;
    this.isVoodooSightActive = false;
    this.flintlockKineticBuffTimer = 0;
    this.isFlintlockKineticActive = false;
    this.jerryLastStandTimer = 0;
    this.isJerryLastStandActive = false;
    this.owlfUltravioletScanTimer = 0;
    this.isOWLFUltravioletActive = false;
    // v61.0 Predators (2010) Game Preserve Systems
    this.hanzoBushidoTimer = 0;
    this.isHanzoBushidoActive = false;
    this.neurotoxinBladeTimer = 0;
    this.isNeurotoxinBladeActive = false;
    this.masterHunterStalkerTimer = 0;
    this.isMasterHunterStalkerActive = false;
    // v63.0 The Predator (2018) & Val Verde Master Systems
    this.isPredatorKillerNanoActive = false;
    this.predatorKillerTimer = 0;
    this.isDillonGritActive = false;
    this.dillonGritTimer = 0;
    this.isHawkinsScanActive = false;
    this.hawkinsScanTimer = 0;
    this.isFriendlyLoboActive = false;
    this.friendlyLoboTimer = 0;
    this.isFugitiveAutoAimActive = false;
    this.fugitiveAutoAimTimer = 0;
    this.loadClanForgeUpgrades();
    this.generatedVisualReady = this.loadGeneratedVisual();
  }

  applyTacticalLoadout(loadout) {
    // One loadout owner; repeated confirmations must not multiply base stats.
    return this.applyLoadout(loadout);
  }

  buildYautjaMesh() {
    return buildHunterModel(this);
  }

  /** Optional calibrated upgrade for this character's own asset. Injectable library permits fixture tests;
   * runtime defaults to the verified same-origin asset cache. */
  async loadGeneratedVisual(library = { getGeneratedAssetEntry, loadGeneratedAsset }) {
    const generation = ++this._generatedVisualGeneration;
    const assetKey = this.data.id;
    if (this._disposed || typeof assetKey !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(assetKey)) return false;
    if (this._importedCharacter) return true;
    let adapter = null;
    let mechanisms = null;
    let rightGauntlet = null;
    let disposeComposition = null;
    let disposePreparation = null;
    try {
      const entry = library.getGeneratedAssetEntry(assetKey);
      if (!entry || entry.status !== 'verified' || entry.characterRig?.calibrated !== true) return false;
      const rig = entry.characterRig, transforms = importedAccessoryTransforms(rig);
      if (rig.cameraEyeHeight !== undefined && (!Number.isFinite(rig.cameraEyeHeight) || rig.cameraEyeHeight <= 0 || rig.cameraEyeHeight > (rig.height ?? 4.31))) throw new Error('Generated hunter has invalid camera eye height');
      if (rig.laserSight && (!Array.isArray(rig.laserSight.origin) || rig.laserSight.origin.length !== 3 || !rig.laserSight.origin.every(Number.isFinite) || !Number.isFinite(rig.laserSight.radius) || rig.laserSight.radius < 0 || rig.laserSight.radius > 0.5)) throw new Error('Generated hunter has invalid laser calibration');
      this.generatedVisualState = 'loading'; this.generatedVisualError = null;
      const bodyTemplate = await library.loadGeneratedAsset(assetKey);
      if (this._disposed || generation !== this._generatedVisualGeneration) return false;
      const mane = prepareImportedManeTemplate(bodyTemplate, rig.maneRig, { sourceSha256: entry.sha256 });
      const preparation = prepareImportedParts(mane.template, rig, { sourceSha256: entry.sha256 });
      disposePreparation = preparation.dispose;
      if (rig.requirePreparation === true) {
        const checks = [
          [rig.partRegions, 'regionsPrepared', 'regionError'],
          [rig.partSkinFilters, 'skinFiltersPrepared', 'skinFilterError'],
          [rig.boneRestCorrections, 'boneRestCorrectionsApplied', 'boneRestCorrectionError'],
          [rig.splitHair, 'hairPrepared', 'hairError']
        ];
        for (const [descriptor, prepared, error] of checks) if (descriptor && preparation.diagnostics[prepared] !== true) {
          throw new Error(`Generated hunter preparation failed: ${preparation.diagnostics[error] ?? prepared}`);
        }
      }
      const preparedBody = preparation.gltf;
      let gltf = preparedBody;
      let biomask = null, biomaskState = rig.biomask ? 'unconfigured' : 'none', biomaskError = null;
      try {
        const calibration = parseBiomaskCalibration(rig.biomask);
        if (calibration) {
          if (calibration.assetKey === assetKey) throw new Error('Biomask must use its own asset key');
          const maskEntry = library.getGeneratedAssetEntry(calibration.assetKey);
          if (!maskEntry || maskEntry.status !== 'verified') throw new Error('Biomask asset is not verified');
          const mask = await library.loadGeneratedAsset(calibration.assetKey);
          if (this._disposed || generation !== this._generatedVisualGeneration) return false;
          gltf = composeCharacterWithBiomask(gltf, mask, calibration, { headBoneName: rig.boneMap?.head });
          disposeComposition = gltf.disposeComposition;
          gltf = applyMaskedBodyRegions(gltf, rig.maskedBodyRegions, { sourceSha256: entry.sha256 });
          biomask = { key: calibration.assetKey, url: maskEntry.url }; biomaskState = 'attached';
        }
      } catch (error) {
        disposeComposition?.(); disposeComposition = null;
        gltf = preparedBody; biomask = null;
        biomaskState = 'unavailable'; biomaskError = error.message;
      }
      if (this._disposed || generation !== this._generatedVisualGeneration) return false;
      // The old rendered fallback may currently be grounded below its actor.
      // Import calibration and its laser baseline always start at visual Y0.
      this.locomotion.resetVisualOffset();
      const baseArticulation = preparation.articulationDescriptor;
      const articulation = mane.articulation ? { ...(baseArticulation ?? { version: 1 }),
        dreadlocks: [...(baseArticulation?.dreadlocks ?? []), ...mane.articulation.dreadlocks] } : baseArticulation;
      const createAdapter = source => createImportedCharacter(this, source, { ...rig, sourceSha256: entry.sha256,
        articulation, requireHeadPartition: true, animateWhenUncontrolled: false });
      try { adapter = createAdapter(gltf); }
      catch (error) {
        if (!biomask) throw error;
        // A malformed optional cosmetic must not suppress a valid body.
        biomask = null; biomaskState = 'unavailable'; biomaskError = error.message;
        adapter = createAdapter(preparedBody);
      }
      const missing = REQUIRED_RIG_BONES.filter(role => !adapter.bones[role]);
      if (missing.length) throw new Error(`Generated hunter rig is incomplete: ${missing.join(', ')}`);
      for (const [name, transform] of Object.entries(transforms)) {
        if (!adapter.sockets[transform.socket] || adapter.diagnostics.socketFallbacks[transform.socket]) throw new Error(`Generated hunter socket is missing: ${name}/${transform.socket}`);
      }
      if (biomask) {
        biomask.root = adapter.model.getObjectByName(BIOMASK_GROUP_NAME);
        const bodyHeadCanHide = adapter.headMeshes.some(mesh => {
          let node = mesh;
          while (node && node !== biomask.root) node = node.parent;
          return node !== biomask.root;
        });
        if (!bodyHeadCanHide) throw new Error('Generated body head cannot be hidden independently of its biomask');
      }
      // Rigid armour is calibrated in the same rest pose as the adapter.
      adapter.update(0, false);
      if (assetKey === 'city_hunter' && entry.sha256 === CITY_HUNTER_RIGHT_GAUNTLET.sourceSha256) {
        try {
          rightGauntlet = installCityHunterRightGauntlet(adapter, { sourceSha256: entry.sha256 });
          this.generatedRightGauntletState = 'ready'; this.generatedRightGauntletError = null;
        } catch (error) {
          this.generatedRightGauntletState = 'unavailable'; this.generatedRightGauntletError = error.message;
        }
      }
      if (assetKey === 'city_hunter' && entry.sha256 === CITY_HUNTER_CONSOLE.sourceSha256) {
        try {
          mechanisms = installCityHunterMechanisms(adapter, { sourceSha256: entry.sha256 });
          this.generatedMechanismsState = 'ready'; this.generatedMechanismsError = null;
        } catch (error) {
          // Optional equipment never suppresses an otherwise verified body.
          this.generatedMechanismsState = 'unavailable'; this.generatedMechanismsError = error.message;
        }
      }
      const imported = { adapter, mechanisms, rightGauntlet, biomask, transforms, cameraEyeHeight: rig.cameraEyeHeight,
        bakedWristblades: rig.bakedWristblades?.calibrated === true && rig.bakedWristblades.mode === 'static',
        preparationDiagnostics: { ...preparation.diagnostics, ...(mane.diagnostics ? { mane: mane.diagnostics } : {}) },
        laserBaseY: this.laserGroup.position.y,
        laserStarts: [], records: [], latest: new Map(), hidden: new Map(),
        skinMaterials: this.skinMaterials, armorMaterials: this.armorMaterials };
      this._importedCharacter = imported; this.mesh.add(adapter.root);
      this._gadgetEffects?.rebind();
      if (rig.laserSight) {
        this.laserGroup.children.forEach((line, index) => {
          const positions = line.geometry.attributes.position;
          imported.laserStarts.push({ positions, start: [positions.getX(0), positions.getY(0), positions.getZ(0)] });
          const angle = index / this.laserGroup.children.length * Math.PI * 2;
          positions.setXYZ(0, rig.laserSight.origin[0] + Math.cos(angle) * rig.laserSight.radius,
            rig.laserSight.origin[1] + Math.sin(angle) * rig.laserSight.radius, rig.laserSight.origin[2]);
          positions.needsUpdate = true;
          line.geometry.computeBoundingSphere();
        });
      }
      this._syncImportedAccessories();
      this._syncWristbladeVisuals();
      // Keep the existing joint controls and root alive for gameplay/effects.
      // Only the existing rendered anatomy is hidden; late effects stay usable.
      this.mesh.traverse(object => {
        if (!object.isMesh) return;
        let ancestor = object;
        while (ancestor && ancestor !== adapter.root && ancestor !== this.laserGroup) ancestor = ancestor.parent;
        if (ancestor) return;
        imported.hidden.set(object, object.visible); object.visible = false;
      });
      this.skinMaterials = [...this.skinMaterials, ...adapter.skinMaterials];
      this.armorMaterials = [...this.armorMaterials, ...adapter.armorMaterials, ...(mechanisms?.materials ?? [])];
      for (const material of new Set([...adapter.materials, ...(mechanisms?.materials ?? [])])) {
        if (this._uncloakedSurfaces) this._uncloakedSurfaces.set(material, surfaceState(material));
        if (this.isCloaked) {
          material.transparent = true; material.opacity = 0.22; material.roughness = 0.08;
          material.metalness = 0.95; material.depthWrite = false; material.needsUpdate = true;
        }
      }
      adapter.update(0, false);
      this.laserGroup.position.y = imported.laserBaseY + (adapter.visualGroundOffsetY ?? 0);
      this.generatedVisualState = 'imported';
      this.generatedBiomaskState = biomaskState; this.generatedBiomaskError = biomaskError;
      this.mesh.userData.generatedAsset = { key: assetKey, url: entry.url,
        ...(biomask ? { biomask: { key: biomask.key, url: biomask.url } } : {}) };
      this.scene.dispatchEvent({ type: 'visual-ready' });
      return true;
    } catch (error) {
      if (this._importedCharacter?.adapter === adapter) this._removeImportedCharacter();
      else { mechanisms?.dispose(); rightGauntlet?.dispose(); adapter?.dispose(); }
      if (!this._disposed && generation === this._generatedVisualGeneration) {
        this.generatedVisualState = 'procedural'; this.generatedVisualError = error.message;
        this.generatedBiomaskState = 'none'; this.generatedBiomaskError = null;
      }
      return false;
    } finally {
      disposeComposition?.();
      disposePreparation?.();
    }
  }

  _syncImportedAccessories() {
    const imported = this._importedCharacter;
    if (!imported) return;
    for (const [name, transform] of Object.entries(imported.transforms)) {
      const object = this[name];
      if (!object?.isObject3D || imported.latest.get(name)?.object === object) continue;
      const previous = imported.latest.get(name);
      if (previous) {
        previous.parent.add(previous.object); previous.object.position.copy(previous.position);
        previous.object.quaternion.copy(previous.quaternion); previous.object.scale.copy(previous.scale); previous.object.visible = false;
      }
      const fallback = name === 'clanMarkMesh' ? this.headMesh : ['shieldMesh', 'secWeaponMesh'].includes(name) ? this.leftArm : this.rightArm;
      const record = { object, parent: object.parent ?? fallback, position: object.position.clone(), quaternion: object.quaternion.clone(), scale: object.scale.clone() };
      imported.records.push(record); imported.latest.set(name, record);
      imported.adapter.sockets[transform.socket].add(object);
      object.position.copy(transform.position); object.quaternion.copy(transform.quaternion); object.scale.copy(transform.scale);
    }
    if (this.clanMarkMesh) this.clanMarkMesh.visible = this.isClanBranded && this.headMesh.visible;
  }

  _syncWristbladeVisuals() {
    const articulation = this._importedCharacter?.adapter.articulation;
    const blades = articulation?.getState().wristblades ?? [];
    const selected = this.activeWeapon === 'wristblades';
    for (const { id } of blades) articulation.setBladeExtension(id, selected ? 1 : 0);
    // A calibrated native blade replaces the procedural weapon, including while
    // it travels into its housing. Bodies without actuators keep their fallback.
    const proceduralVisible = selected && blades.length === 0 && !this._importedCharacter?.bakedWristblades;
    if (this.blade1) this.blade1.visible = proceduralVisible;
    if (this.blade2) this.blade2.visible = proceduralVisible;
  }

  // Component IDs come from the asset's calibrated articulation descriptor.
  // A console lid and a folding shield do not share an implicit gameplay action.
  setWristbladeExtension(id, amount) {
    return this._importedCharacter?.adapter.articulation?.setBladeExtension(id, amount) ?? false;
  }

  setGauntletOpen(id, amount) {
    return Boolean(this._importedCharacter?.mechanisms?.setGauntletOpen(id, amount) ||
      this._importedCharacter?.adapter.articulation?.setGauntletOpen(id, amount));
  }

  _removeImportedCharacter() {
    const imported = this._importedCharacter;
    if (!imported) return;
    // Held props belong to Player, not the replaceable native GLB template.
    for (const visual of this._preyWeaponVisuals.values()) this.mesh.add(visual);
    for (const record of imported.records) {
      record.parent.add(record.object); record.object.position.copy(record.position);
      record.object.quaternion.copy(record.quaternion); record.object.scale.copy(record.scale);
    }
    imported.hidden.forEach((visible, object) => { object.visible = visible; });
    for (const { positions, start } of imported.laserStarts) { positions.setXYZ(0, ...start); positions.needsUpdate = true; }
    this.laserGroup.position.y = imported.laserBaseY;
    this.laserGroup.children.forEach(line => line.geometry.computeBoundingSphere());
    this.skinMaterials = imported.skinMaterials; this.armorMaterials = imported.armorMaterials;
    for (const material of [...imported.adapter.materials, ...(imported.mechanisms?.materials ?? [])]) this._uncloakedSurfaces?.delete(material);
    imported.mechanisms?.dispose();
    imported.rightGauntlet?.dispose();
    imported.adapter.dispose(); this._importedCharacter = null;
    this._gadgetEffects?.rebind();
    this._syncWristbladeVisuals();
    delete this.mesh.userData.generatedAsset;
    this.generatedVisualState = 'procedural';
    this.generatedBiomaskState = 'none'; this.generatedBiomaskError = null;
    this.generatedMechanismsState = 'none'; this.generatedMechanismsError = null;
    this.generatedRightGauntletState = 'none'; this.generatedRightGauntletError = null;
    if (!this._disposed) this.scene.dispatchEvent({ type: 'visual-ready' });
  }

  buildLaserSight(colorHex = 0xff0000) {
    const laserGroup = new THREE.Group();
    const laserMat = new THREE.LineBasicMaterial({ color: colorHex, linewidth: 2 });

    for (let i = 0; i < 3; i++) {
      const points = [];
      const angle = (i / 3) * Math.PI * 2;
      const offsetX = Math.cos(angle) * 0.3;
      const offsetY = Math.sin(angle) * 0.3;

      points.push(new THREE.Vector3(-1.1 + offsetX, 3.4 + offsetY, 0.4));
      points.push(new THREE.Vector3(0, 1.8, 25));

      const geo = new THREE.BufferGeometry().setFromPoints(points);
      const line = new THREE.Line(geo, laserMat);
      laserGroup.add(line);
    }

    return laserGroup;
  }

  updateLaserLock(worldTargetPos) {
    if (!this.laserGroup) return;

    // Convergence delta based on charge state (converges into single point when charging)
    const convergence = this.isChargingPlasma ? Math.max(0.015, 0.12 * (1.0 - Math.min(1.0, this.plasmaChargeTime / 0.6))) : 0.12;

    if (worldTargetPos) {
      const localTarget = this.laserGroup.worldToLocal(worldTargetPos.clone());
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        const angle = (i / 3) * Math.PI * 2;
        // The three dots converge at target with small triangle delta
        posAttr.setXYZ(1, localTarget.x + Math.cos(angle) * convergence, localTarget.y + Math.sin(angle) * convergence, localTarget.z);
        posAttr.needsUpdate = true;
      }
    } else {
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        const angle = (i / 3) * Math.PI * 2;
        posAttr.setXYZ(1, Math.cos(angle) * convergence * 5, 1.8 + Math.sin(angle) * convergence * 5, 25);
        posAttr.needsUpdate = true;
      }
    }
  }

  throwCombiStick() {
    if (!this.canUseArsenalEquipment('combistick')) return false;
    if (this.combiStickCooldown > 0 || this.isFacehuggerLatched) return null;
    this.combiStickCooldown = 3.5;
    this.audioEngine.playCombiStickThrow();

    const isElevated = this.isPerched || this.position.y >= 2.0;
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      isElevated ? -0.32 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.2, 0)).addScaledVector(forward, 1.2);

    return {
      startPos: startPos,
      direction: forward,
      speed: 65,
      damage: 480,
      pierceRemaining: 4
    };
  }

  throwShuriken() {
    if (!this.canUseArsenalEquipment('shuriken')) return false;
    if (this.shurikenCooldown > 0 || this.isFacehuggerLatched) return null;
    this.shurikenCooldown = HUNTER_WEAPON_PROFILES.shuriken.cooldown;
    this.audioEngine.playShurikenOpen();

    const isElevated = this.isPerched || this.position.y >= 2.0;
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      isElevated ? -0.22 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(forward, 1.2);

    return {
      startPos: startPos,
      direction: forward,
      speed: 42,
      damage: HUNTER_WEAPON_PROFILES.shuriken.projectileDamage,
      maxRange: HUNTER_WEAPON_PROFILES.shuriken.projectileRange,
      radius: 3.2
    };
  }

  triggerPowerGloveSlam(horde, synthetics, bosses) {
    if (!this.canUseArsenalEquipment('power_glove')) return false;
    if (this.powerGloveCooldown > 0 || this.isFacehuggerLatched) return false;
    this.powerGloveCooldown = 6.0;

    this.audioEngine.playPowerGloveSlam();

    // Visual ground slam punch animation
    this.rightArm.rotation.x = -Math.PI * 0.85;
    this.position.y = 0;
    this.schedule(() => {
      this.rightArm.rotation.x = 0;
    }, 450);

    const slamAttack = { origin: this.position, radius: 12.0, damage: 450, type: 'heavy' };

    // 1. Pulverize Xenomorphs in 12m radius & knock back
    if (horde) {
      horde.checkMeleeHits(slamAttack);
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a.mesh.position.distanceTo(this.position) <= 12.0) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 7.5);
          a.mesh.position.y = 2.5; // Lifted into air
          this.schedule(() => { a.mesh.position.y = 0; }, 320);
        }
      });
    }

    // 2. Damage synthetics
    if (synthetics) {
      synthetics.checkHits(slamAttack);
    }

    // 3. Stun/damage active boss
    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= 12.0) {
        bosses.takeDamage(550);
      }
    }

    return true;
  }

  triggerSpineWhipSlash(horde, synthetics, bosses) {
    if (!this.canUseArsenalEquipment('plasma_whip')) return false;
    if (this.spineWhipCooldown > 0 || this.isFacehuggerLatched) return false;
    this.spineWhipCooldown = 3.5;

    this.audioEngine.playSpineWhipCrack();

    // Visual whip lash sweep
    this.leftArm.rotation.x = -Math.PI * 0.5;
    this.leftArm.rotation.y = -Math.PI * 0.4;
    this.schedule(() => {
      this.leftArm.rotation.x = 0;
      this.leftArm.rotation.y = 0;
    }, 380);

    const whipAttack = { origin: this.position, radius: 10.5, damage: 420, type: 'spine_whip' };

    // 1. Slash and reel in Xenomorphs
    if (horde) {
      horde.checkMeleeHits(whipAttack);
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        const toPlayer = this.position.clone().sub(a.mesh.position);
        const dist = toPlayer.length();
        if (dist <= 10.5 && dist > 2.0) {
          // Reel enemy towards the hunter!
          toPlayer.y = 0;
          toPlayer.normalize();
          a.mesh.position.addScaledVector(toPlayer, 4.5);
        }
      });
    }

    // 2. Synthetics
    if (synthetics) {
      synthetics.checkHits(whipAttack);
    }

    // 3. Boss
    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= 10.5) {
        bosses.takeDamage(480);
      }
    }

    return true;
  }

  togglePerch() {
    this.isPerched = !this.isPerched;
    if (this.isPerched) {
      // Perch high atop canopy/hunting boughs (12 meters above arena)
      this.position.y = 12.0;
      if (this.audioEngine && this.audioEngine.playBoughJumpWhoosh) {
        this.audioEngine.playBoughJumpWhoosh();
      } else {
        this.audioEngine.playSlash();
      }
    } else {
      // Dive assassination plunge!
      this.position.y = 0;
      if (this.audioEngine && this.audioEngine.playBoughJumpWhoosh) {
        this.audioEngine.playBoughJumpWhoosh();
      }
      this.audioEngine.playPounceImpact();
    }
    this.mesh.position.copy(this.position);
    return this.isPerched;
  }

  toggleShieldBlock() {
    if (!this.isBlocking && !this.cancelAttack('guard')) return false;
    this.isBlocking = !this.isBlocking;
    if (this.shieldMesh) {
      this.shieldMesh.visible = this.isBlocking;
      if (this.isBlocking) {
        this.shieldMesh.scale.set(0.2, 0.2, 0.2);
        let s = 0.2;
        const expandAnim = this.scheduleInterval(() => {
          s += 0.25;
          if (this.shieldMesh) this.shieldMesh.scale.set(s, s, s);
          if (s >= 1.0) this.cancelTimer(expandAnim);
        }, 20);
      }
    }
    if (this.isBlocking) {
      this.parryTimer = 0.35; // 350ms Perfect Parry timing window (Prey 2022 Canon)
      if (this.audioEngine.playFeralShieldDeploy) {
        this.audioEngine.playFeralShieldDeploy();
      } else {
        this.audioEngine.playShieldBlock();
      }
      this.leftArm.rotation.x = -Math.PI * 0.4;
      this.leftArm.position.x = -0.6;
    } else {
      this.leftArm.rotation.x = 0;
      this.leftArm.position.x = this._leftArmRestX ?? -1.2;
    }
    this._syncArsenalVisuals();
    return this.isBlocking;
  }

  soundWarhorn() {
    this.warhornBuffTimer = 10.0;
    this.audioEngine.playWarhorn();
    return true;
  }

  brandClanMark() {
    this.isClanBranded = true;
    if (this.clanMarkMesh) {
      this.clanMarkMesh.visible = true;
    }
    this.audioEngine.playClanMarkSizzle();
  }

  fireFlechetteNeedler() {
    if (!this.canUseArsenalEquipment('speargun')) return false;
    this.audioEngine.playFlechetteDart();
    const origin = this.position.clone().add(new THREE.Vector3(-1.2, 2.0, 0.5));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    return {
      position: origin,
      direction: forward,
      damage: 180,
      speed: 65
    };
  }

  throwSmartDisc(horde) {
    if (!this.canUseArsenalEquipment('smart_disc')) return false;
    if (this._disposed || this.hp <= 0 || this.smartDiscCooldown > 0 || this.isFacehuggerLatched) return null;
    this.smartDiscCooldown = HUNTER_WEAPON_PROFILES.smart_disc.cooldown;
    this.audioEngine.playSmartDiscHum();
    const origin = this.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    // Multi-target forward scan for automated chain homing waypoints (Predator 2 Canon)
    const targets = [];
    if (horde && horde.aliens) {
      const candidates = horde.aliens
        .filter(a => this._canDamageLegacyAlien(horde, a) && a.mesh.position.distanceTo(origin) <= 32.0)
        .sort((a, b) => a.mesh.position.distanceTo(origin) - b.mesh.position.distanceTo(origin));
      for (let c of candidates) {
        const toAlien = c.mesh.position.clone().sub(origin).normalize();
        if (forward.dot(toAlien) > 0.15 && targets.length < 4) {
          targets.push(c.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0)));
        }
      }
    }

    return {
      startPos: origin.clone(),
      apexPos: origin.clone().addScaledVector(forward, 28).addScaledVector(right, 7),
      waypoints: targets,
      damage: HUNTER_WEAPON_PROFILES.smart_disc.projectileDamage,
      speed: 42
    };
  }

  /* Chantier 3: Trax-Net Micro-Beacon Dart Gun (AVP 2 / Concrete Jungle Lore) */
  fireTraxNetDart(horde, synthetics, bosses) {
    if (!this.canUseArsenalEquipment('trax_dart')) return false;
    if (this.traxNetCooldown > 0 || this.isFacehuggerLatched) return null;
    this.traxNetCooldown = 14.0; // 14s tactical cooldown

    if (this.audioEngine && this.audioEngine.playTraxNetBeep) {
      this.audioEngine.playTraxNetBeep();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    let bestTarget = null;
    let bestDist = 36.0;

    // Check boss
    if (bosses && bosses.activeBoss) {
      const bDist = this.position.distanceTo(bosses.activeBoss.mesh.position);
      if (bDist <= bestDist) {
        bestTarget = bosses.activeBoss;
        bestDist = bDist;
      }
    }

    // Check horde
    if (!bestTarget && horde && horde.aliens) {
      for (const a of horde.aliens) {
        if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toA = a.mesh.position.clone().sub(this.position).normalize();
        if (forward.dot(toA) > 0.35) {
          const d = this.position.distanceTo(a.mesh.position);
          if (d < bestDist) {
            bestDist = d;
            bestTarget = a;
          }
        }
      }
    }

    if (bestTarget) {
      bestTarget.isTraxTagged = true;
      bestTarget.traxTimer = 25.0; // 25s wall-penetrating lock & +25% dmg vulnerability
      return { success: true, target: bestTarget };
    }

    return { success: false };
  }

  /* Chantier 6: Plasma Glaive Rotary Spin Shield (Aliens: Fireteam Elite / Xenogenesis) */
  toggleWhirlShield(active = null) {
    if (!this.canUseArsenalEquipment('glaive')) return false;
    if (active === null) {
      this.isWhirlShieldActive = !this.isWhirlShieldActive;
    } else {
      this.isWhirlShieldActive = active;
    }

    if (this.isWhirlShieldActive && this.audioEngine && this.audioEngine.playPlasmaGlaiveWhirl) {
      this.audioEngine.playPlasmaGlaiveWhirl();
    }
    return this.isWhirlShieldActive;
  }

  fireNetgun(horde, synthetics) {
    if (!this.canUseArsenalEquipment('netgun')) return false;
    this.audioEngine.playNetgunLaunch();
    const origin = this.position.clone().add(new THREE.Vector3(0.5, 2.0, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    // Multi-target forward cone scan (up to 3 targets within 24m)
    const targets = [];
    const minAngle = Math.PI / 2.8;

    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!this._canHitLegacyAlien(horde, a)) return;
        if (a.isNetEntangled || a.isNetgunImmune) return;
        const toAlien = a.mesh.position.clone().sub(this.position);
        toAlien.y = 0;
        const dist = toAlien.length();
        if (dist <= 24.0) {
          toAlien.normalize();
          const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(toAlien))));
          if (angle < minAngle && targets.length < 3) {
            targets.push(a);
          }
        }
      });
    }

    if (targets.length > 0) {
      this.audioEngine.playNetWireTighten();

      targets.forEach((target, idx) => {
        target.isNetEntangled = true;
        target.netTimer = 4.5;

        const wallStart = target.mesh.position.clone().add(new THREE.Vector3(0, 1, 0));
        const wallEnd = wallStart.clone().addScaledVector(forward, Math.max(1, target.radius ?? 1) + .8);
        if (this.gameContext?.env?.traceSegment?.(wallStart, wallEnd, { radius: .04 })) {
          target.isPinned = true; target.pinTimer = 4.5;
        }

        // Visual expanding/tightening diamond-mesh net group
        const netGroup = new THREE.Group();
        const rad = target.radius ? target.radius * 1.35 : 1.5;
        const netGeo = new THREE.SphereGeometry(rad, 10, 10);
        const netMat = new THREE.MeshBasicMaterial({
          color: 0x67e8f9, // Electric cyan diamond-wire
          wireframe: true,
          transparent: true,
          opacity: 0.95
        });
        const netMesh = new THREE.Mesh(netGeo, netMat);
        netGroup.add(netMesh);

        // 4 weighted tungsten corner anchors (Predator 2 Canon)
        const anchorMat = new THREE.MeshStandardMaterial({ color: 0x1f2937, metalness: 0.95 });
        for (let a = 0; a < 4; a++) {
          const anchor = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.15, 0.3), anchorMat);
          const aAngle = (a / 4) * Math.PI * 2;
          anchor.position.set(Math.cos(aAngle) * rad, Math.sin(aAngle) * 0.4, Math.sin(aAngle) * rad);
          netGroup.add(anchor);
        }

        netGroup.position.copy(target.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
        this._addOwnedEffect(netGroup);

        // Wire tightening animation interval
        let netLife = 4.5;
        const netAnim = this.scheduleInterval(() => {
          netLife -= 0.1;
          if (!this._canDamageLegacyAlien(horde, target)) {
            target.isNetEntangled = false; target.netTimer = 0; target.isPinned = false; target.pinTimer = 0;
            this.cancelTimer(netAnim); this._removeOwnedEffect(netGroup); return;
          }
          if (target.mesh && target.isNetEntangled) {
            netGroup.position.copy(target.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
            netGroup.scale.multiplyScalar(0.995); // Visible constriction tension
            // Chantier 2 (v55.0): Razor Wire Progressive Constriction Slicing (Predator 2 Canon)
            target.hp -= 8.5; // Progressive slicing through chitin & flesh
            if (this.particles && this.particles.emitAlienBloodSpurt && Math.random() < 0.25) {
              this.particles.emitAlienBloodSpurt(target.mesh.position, 2);
            }
          }
          if (netLife <= 0 || !target.isNetEntangled || target.hp <= 0) {
            target.isNetEntangled = false; target.netTimer = 0; target.isPinned = false; target.pinTimer = 0;
            this.cancelTimer(netAnim);
            this._removeOwnedEffect(netGroup);
            if (this.audioEngine && this.audioEngine.playNetgunConstrictionSlice) {
              this.audioEngine.playNetgunConstrictionSlice();
            }
          }
        }, 100);
      });

      return true;
    }

    return false;
  }

  triggerGauntletEMP(horde, synthetics) {
    if (!this.canUseArsenalEquipment('emp_mine')) return false;
    if (this.empCooldown > 0) return false;
    this.empCooldown = 12.0; // 12 second cooldown
    this._importedCharacter?.mechanisms?.trigger('emp', 1.8);
    this.audioEngine.playGauntletEMP();

    const empRadius = 18.0;

    // 1. Stun and short-circuit Weyland-Yutani synthetics
    if (synthetics) {
      synthetics.androids.forEach(syn => {
        if (syn.mesh.position.distanceTo(this.position) <= empRadius) {
          syn.isEMPStunned = true;
          syn.empStunTimer = 5.0; // 5 second complete shutdown
          synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
          syn.hp -= 90; // High electrical damage to circuitry
        }
      });
    }

    // 2. Shock and paralyze Xenomorph horde
    if (horde) {
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a.mesh.position.distanceTo(this.position) <= empRadius) {
          a.hp -= 75;
          a.speed = Math.max(2, a.speed * 0.3); // Severe nerve disruption
          this.schedule(() => {
            a.speed = a.type === 'facehugger' ? 17 : (a.type === 'crusher' ? 12 : 11);
          }, 4000);
        }
      });
    }

    // Create EMP shockwave visual sphere
    const empGeo = new THREE.SphereGeometry(1, 16, 16);
    const empMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.8,
      wireframe: true
    });
    const shockwaveMesh = new THREE.Mesh(empGeo, empMat);
    shockwaveMesh.position.copy(this.position).add(new THREE.Vector3(0, 1.5, 0));
    this._addOwnedEffect(shockwaveMesh);
    this._effects.add(shockwaveMesh);

    let scale = 1.0;
    const expandAnim = this.scheduleInterval(() => {
      scale += 2.2;
      shockwaveMesh.scale.set(scale, scale, scale);
      shockwaveMesh.material.opacity -= 0.08;
      if (shockwaveMesh.material.opacity <= 0 || scale >= empRadius) {
        this.cancelTimer(expandAnim);
        disposeObject(shockwaveMesh);
        this._effects.delete(shockwaveMesh);
      }
    }, 30);

    return true;
  }

  triggerVoiceMimicry(horde) {
    this.audioEngine.playVoiceMimicry();
    const lurePoint = this.position.clone();

    const tauntLines = [
      '"OVER HERE..." (1987)',
      '"WANT SOME CANDY?" (1990)',
      '"ANYTIME..." (1987)',
      'RIRE SARDONIQUE DE BILLY (1987)'
    ];
    const pickedTaunt = tauntLines[Math.floor(Math.random() * tauntLines.length)];

    horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
      if (a.mesh.position.distanceTo(lurePoint) < 30) {
        a.mesh.position.addScaledVector(lurePoint.clone().sub(a.mesh.position).normalize(), 4.0);
        // Momentary disorientation
        a.speed = Math.max(3, a.speed * 0.5);
        this.schedule(() => {
          a.speed = a.type === 'facehugger' ? 17 : (a.type === 'crusher' ? 12 : 11);
        }, 2500);
      }
    });

    return pickedTaunt;
  }

  cycleVisionMode() {
    this.visionMode = (this.visionMode + 1) % 5;
    this.audioEngine.playVisionSwitch(this.visionMode);
    return this.visionMode;
  }

  pounceLeap() {
    if (this.isLeaping) return false;
    this.isLeaping = true;
    this.leapVelocityY = 18;
    this.audioEngine.playSlash();
    return true;
  }

  executeSpineRip(victimKind = 'human') {
    this.audioEngine.playSpineRip();
    this.audioEngine.playYautjaRoar();
    this.brandClanMark();

    return getHunterGadgetEffects(this).startTrophy({ kind: victimKind });
  }

  triggerFacehuggerLatch() {
    if (this.isBlocking || this.isPerched) {
      this.audioEngine.playShieldBlock();
      return;
    }
    this.isFacehuggerLatched = true;
    this.qteStrugglePresses = 0;
    if (this.audioEngine.playFacehuggerLatch) {
      this.audioEngine.playFacehuggerLatch();
    } else {
      this.audioEngine.playXenoHiss();
    }

    // 3D Arachnoid Facehugger clamped over Bio-Mask Head with 8 skeletal digits
    if (!this.latchedHuggerMesh && this.headMesh) {
      const huggerGroup = new THREE.Group();
      const huggerMat = new THREE.MeshStandardMaterial({ color: 0x8a7355, roughness: 0.6 });
      const body = new THREE.Mesh(new THREE.SphereGeometry(0.35, 6, 6), huggerMat);
      body.position.set(0, 0, 0.45);
      huggerGroup.add(body);

      // 8 Articulated arachnoid clamping finger digits
      for (let f = 0; f < 8; f++) {
        const angle = (f / 8) * Math.PI * 2;
        const finger = new THREE.Mesh(new THREE.CylinderGeometry(0.025, 0.015, 0.45, 4), huggerMat);
        finger.position.set(Math.cos(angle) * 0.32, Math.sin(angle) * 0.32, 0.35);
        finger.rotation.z = angle + Math.PI / 2;
        huggerGroup.add(finger);
      }

      // Muscular tail curled around hunter's throat
      const tail = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.02, 1.2, 5), huggerMat);
      tail.position.set(0, -0.4, 0.2);
      tail.rotation.x = -Math.PI / 3;
      huggerGroup.add(tail);

      this.headMesh.add(huggerGroup);
      this.latchedHuggerMesh = huggerGroup;
    }
  }

  struggleQTE() {
    if (!this.isFacehuggerLatched) return false;
    this.qteStrugglePresses++;
    this.audioEngine.playSkullSnap();

    if (this.qteStrugglePresses >= this.qteRequiredPresses) {
      this.isFacehuggerLatched = false;
      this.qteStrugglePresses = 0;
      this.audioEngine.playYautjaRoar();
      if (this.audioEngine.playAcidSizzle) this.audioEngine.playAcidSizzle();

      if (this.latchedHuggerMesh && this.headMesh) {
        this.headMesh.remove(this.latchedHuggerMesh);
        this.latchedHuggerMesh = null;
      }
      return true;
    }
    return false;
  }

  deployBearTrap(horde) {
    if (this.bearTrapCharges <= 0) return false;
    this.bearTrapCharges--;
    const trapAttack = { origin: this.position, radius: 10, damage: 350 };
    const hits = horde.checkMeleeHits(trapAttack);
    this.audioEngine.playSkullSnap();
    return hits.length > 0;
  }

  useMedicomp() {
    if (this.medicompCharges <= 0 || (this.hp >= this.maxHp && this.visorAcidBurn <= 0)) return false;
    this.medicompCharges--;
    this._importedCharacter?.mechanisms?.trigger('heal', 1.8);
    this.hp = Math.min(this.maxHp, this.hp + (this.medicompHealAmount || 450));
    this.visorAcidBurn = 0; // Medical bio-gel instantly neutralizes acid corrosion
    this.audioEngine.playMedicompCauterize();
    return true;
  }

  inflictVisorAcidBurn(force = false) {
    if (!force && (this.isBlocking || this.isPerched)) return;
    this.visorAcidBurn = 1.0;
    if (this.audioEngine) {
      this.audioEngine.playVisorAcidBurn();
    }
  }

  useAcidSolvent(horde) {
    if (this.acidSolventCharges <= 0) return false;
    this.acidSolventCharges--;
    horde.acidPools.forEach(pool => disposeObject(pool.mesh));
    horde.acidPools = [];
    this.audioEngine.playAcidSizzle();
    return true;
  }

  triggerFlechetteVolley(targetEnemy = null) {
    if (!this.canUseArsenalEquipment('crossbow')) return false;
    if (this.flechetteCooldown > 0 || this.isFacehuggerLatched) return null;
    this.flechetteCooldown = 5.0;

    this.audioEngine.playFlechetteVolleyLaunch();

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 2.0, 0));

    return {
      origin,
      forward,
      target: targetEnemy,
      count: 3,
      damage: 190,
      speed: 46
    };
  }

  performBoneScytheCleave(horde, synthetics, bosses) {
    if (this.boneScytheCooldown > 0 || this.isFacehuggerLatched) return false;
    this.boneScytheCooldown = 5.5;

    this.audioEngine.playBoneScytheCleave();
    this.audioEngine.playYautjaRoar();

    this.mesh.rotation.y += Math.PI * 2;
    this.rightArm.rotation.x = -Math.PI * 0.7;
    this.schedule(() => {
      this.rightArm.rotation.x = 0;
    }, 450);

    const cleaveRadius = 7.5;
    const cleaveDamage = 480;

    if (horde) {
      horde.checkMeleeHits({
        origin: this.position,
        radius: cleaveRadius,
        damage: cleaveDamage,
        type: 'heavy'
      });
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a && a.mesh && a.mesh.position.distanceTo(this.position) <= cleaveRadius) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 4.5);
          // Chantier 7: Alpha Predator Primordial Dragon Bone Sickle Bleed Cleave
          a.bleedTimer = 4.0;
          a.bleedDps = 50.0;
        }
      });
    }

    if (synthetics) {
      synthetics.checkHits({
        origin: this.position,
        radius: cleaveRadius,
        damage: cleaveDamage
      });
    }

    if (bosses && bosses.activeBoss) {
      if (bosses.activeBoss.mesh.position.distanceTo(this.position) <= cleaveRadius) {
        bosses.takeDamage(cleaveDamage);
      }
    }

    return true;
  }

  fireCompoundBow() {
    if (this.activeWeapon === 'taabe_bow') {
      if (this._disposed || this.hp <= 0 || this.isFacehuggerLatched || !this.canUseArsenalEquipment('taabe_bow') || this.compoundBowCooldown > 0 || !Number.isInteger(this.taabeArrowAmmo) || this.taabeArrowAmmo < 1 || this.taabeArrowAmmo > 12) return null;
      this.taabeArrowAmmo--; this.compoundBowCooldown = PREY_WEAPON_PROFILES.taabe_bow.cooldown;
      this.audioEngine.playCompoundBowFire?.();
      return { projectileKind: 'taabe_arrow', origin: this.position.clone().add(new THREE.Vector3(0, Math.min(2.2, this.cameraEyeHeight * .8), 0)),
        direction: new THREE.Vector3(Math.sin(this.rotationY),0,Math.cos(this.rotationY)), speed:48,
        damage:PREY_WEAPON_PROFILES.taabe_bow.projectileDamage, pierceRemaining:0, life:1.5, ammoCost:1, energyCost:0 };
    }
    if (this._disposed || this.hp <= 0) return null;
    if (!this.canUseArsenalEquipment('compound_bow')) return false;
    if (this.compoundBowCooldown > 0 || this.isFacehuggerLatched) return null;
    this.compoundBowCooldown = HUNTER_WEAPON_PROFILES.compound_bow.cooldown;

    this.audioEngine.playCompoundBowFire();

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));

    return {
      origin,
      direction: forward,
      speed: 62,
      damage: HUNTER_WEAPON_PROFILES.compound_bow.projectileDamage,
      pierceRemaining: 5,
      life: 2.2
    };
  }

  deployHoloDecoy(scene) {
    if (this._disposed || this.hp <= 0 || this.holoDecoyCooldown > 0 || this.isFacehuggerLatched) return null;
    let projection;
    try { projection = createHunterHologram(this); }
    catch { return null; }
    this.holoDecoyCooldown = 16.0;
    this.audioEngine.playHoloDecoyDeploy();
    scene.add(projection.mesh);

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    return {
      ...projection,
      direction: forward,
      speed: 7.5,
      life: 6.0,
      detonated: false
    };
  }

  triggerNukeSelfDestruct() {
    if (this.canUseArsenalEquipment?.('nuke') === false) return false;
    this.audioEngine.playPredatorLaughCountdown();
    getHunterGadgetEffects(this).startCountdown();

    return { damage: 10000, radius: 60 };
  }

  clearNukeHoloMesh() {
    this._gadgetEffects?.stopCountdown();
    if (this._importedCharacter?.mechanisms?.getState().mode === 'nuke') this._importedCharacter.mechanisms.trigger('nuke', 0);
    if (this.wristNukeHoloMesh && this.leftArm) {
      disposeObject(this.wristNukeHoloMesh);
      this.wristNukeHoloMesh = null;
    }
  }

  triggerHybridMetamorphosis() {
    if (!this.canUseArsenalEquipment('hybrid_mutation')) return false;
    if (this.isHybridMutated) return;
    this.isHybridMutated = true;
    this.mesh.scale.set(1.8, 1.8, 1.8);
    this.meleeDamage *= 2.0;

    this.audioEngine.playYautjaRoar();

    this.schedule(() => {
      this.isHybridMutated = false;
      this.mesh.scale.set(1.0, 1.0, 1.0);
      this.meleeDamage /= 2.0;
    }, 15000);
  }

  triggerPlasmaGlaive(horde, synthetics, bosses) {
    if (!this.canUseArsenalEquipment('glaive')) return false;
    if (this.plasmaGlaiveCooldown > 0 || this.isPlasmaGlaiveActive || this.isFacehuggerLatched) return false;
    this.plasmaGlaiveCooldown = 13.0;
    this.isPlasmaGlaiveActive = true;
    this.plasmaGlaiveDuration = 3.6;
    if (this.plasmaGlaiveMesh) this.plasmaGlaiveMesh.visible = true;
    this.audioEngine.playPlasmaGlaiveSpin();
    return true;
  }

  /* Chantier 3: Yautja Ceremonial Katana Dah'dt'de Iaijutsu Ultrasonic Slash (Predators 2010 Canon) */
  performIaijutsuSlash(horde, synthetics, bosses, particles) {
    if (!this.canUseArsenalEquipment('katana')) return false;
    if (this.iaijutsuCooldown > 0 || this.isFacehuggerLatched) return null;
    this.iaijutsuCooldown = 3.5;

    if (this.audioEngine && this.audioEngine.playIaijutsuSlice) {
      this.audioEngine.playIaijutsuSlice();
    }

    const fwd = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const dashDist = 8.5;
    const startPos = this.position.clone();
    const endPos = this.position.clone().addScaledVector(fwd, dashDist);

    // Instant forward dash
    this.position.copy(endPos);
    this.mesh.position.copy(endPos);

    // Crescent light blade sweep mesh
    const arcGeo = new THREE.TorusGeometry(3.2, 0.08, 4, 24, Math.PI / 1.3);
    const arcMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.9 });
    const arcMesh = new THREE.Mesh(arcGeo, arcMat);
    arcMesh.position.copy(startPos.clone().add(endPos).multiplyScalar(0.5)).add(new THREE.Vector3(0, 1.4, 0));
    arcMesh.rotation.x = Math.PI / 2;
    arcMesh.rotation.z = -this.rotationY;
    this._addOwnedEffect(arcMesh);

    let fadeTimer = 0.25;
    const fadeAnim = this.scheduleInterval(() => {
      fadeTimer -= 0.05;
      arcMesh.material.opacity = fadeTimer / 0.25;
      if (fadeTimer <= 0) {
        this.cancelTimer(fadeAnim);
        this._removeOwnedEffect(arcMesh);
      }
    }, 50);

    // Corridor strike hit check
    const midPoint = startPos.clone().add(endPos).multiplyScalar(0.5);
    const strikeAttack = {
      origin: midPoint,
      radius: 5.5,
      damage: 420,
      type: 'heavy'
    };

    const hits = horde.checkMeleeHits(strikeAttack);
    if (synthetics) synthetics.checkHits(strikeAttack);
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh.position.distanceTo(midPoint) <= 6.0) {
      bosses.takeDamage(420);
    }

    if (particles) {
      particles.emitSparks(endPos, 20);
    }

    return hits;
  }

  /* Chantier 5: Yautja Anti-Grav Disruptor & Levitation Field (AvP / Concrete Jungle Canon) */
  deployAntiGravDisruptor(horde, synthetics, particles) {
    if (!this.canUseArsenalEquipment('anti_grav')) return false;
    if (this.antiGravCooldown > 0 || this.isFacehuggerLatched) return false;
    this.antiGravCooldown = 14.0;

    if (this.audioEngine && this.audioEngine.playAntiGravHum) {
      this.audioEngine.playAntiGravHum();
    }

    const pos = this.position.clone().add(new THREE.Vector3(0, 1.2, 0));
    const group = new THREE.Group();
    group.position.copy(pos);

    // Gravity core
    const coreGeo = new THREE.SphereGeometry(0.45, 10, 10);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0x818cf8, wireframe: true });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    group.add(coreMesh);

    // Distorted gravity wave rings
    const ringGeo = new THREE.RingGeometry(1.5, 6.0, 16);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xa78bfa, transparent: true, opacity: 0.6, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    group.add(ringMesh);

    this._addOwnedEffect(group);

    // Levitate and suspend Xenomorphs within 12.0m radius
    const radius = 12.0;
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a.hp > 0 && a.mesh.position.distanceTo(this.position) <= radius) {
          a.isAirborne = true;
          a.airborneVelY = 4.2; // Float up!
          a.speed *= 0.2; // Severely slowed
        }
      });
    }

    let duration = 4.5;
    const interval = this.scheduleInterval(() => {
      duration -= 0.1;
      coreMesh.rotation.y += 0.25;
      ringMesh.rotation.z += 0.15;
      const pulse = 1.0 + Math.sin(duration * 10) * 0.25;
      coreMesh.scale.set(pulse, pulse, pulse);

      if (duration <= 0) {
        this.cancelTimer(interval);
        this._removeOwnedEffect(group);
      }
    }, 100);

    if (particles) {
      particles.emitSparks(pos, 25);
    }
    return true;
  }

  consumeRoyalJelly() {
    if (!this.canUseArsenalEquipment('royal_jelly')) return false;
    if (this.royalJellyFlasks <= 0 || this.isBerserkerActive || this.isFacehuggerLatched) return false;
    this.royalJellyFlasks--;
    this.isBerserkerActive = true;
    this.berserkerTimer = 12.0;
    this.hp = Math.min(this.maxHp, this.hp + 250);
    this.visorAcidBurn = 0;
    this.audioEngine.playBerserkerRoar();
    return true;
  }

  recordTrophy(trophyName, honorPoints) {
    const trophy = {
      name: trophyName,
      honor: honorPoints,
      timestamp: new Date().toLocaleTimeString()
    };
    this.trophiesCollected.push(trophy);
    if (this.audioEngine && this.audioEngine.playTrophyClaim) {
      this.audioEngine.playTrophyClaim();
    }
    return trophy;
  }

  _addOwnedEffect(object, disposer = null, parent = this.scene) {
    if (!object?.isObject3D) return object;
    if (this._disposed) { if (disposer) disposer(); else disposeObject(object); return object; }
    object.userData.playerTransientEffect = true;
    this._effects.add(object);
    if (disposer) this._ownedFxDisposers.set(object, disposer);
    parent.add(object);
    return object;
  }

  _removeOwnedEffect(object) {
    if (!object) return;
    if (!this._effects.has(object)) { object.removeFromParent?.(); return; }
    this._effects.delete(object);
    const dispose = this._ownedFxDisposers.get(object);
    this._ownedFxDisposers.delete(object);
    if (dispose) dispose(); else disposeObject(object);
  }

  _canDamageLegacyAlien(horde, actor) {
    if (!actor || actor.hp <= 0) return false;
    const simulation = horde?.battleSimulation;
    return !simulation || !actor.factionId || simulation.areHostile(simulation.config.playerFaction, actor.factionId);
  }

  _canHitLegacyAlien(horde, actor, origin = null, environment = this.gameContext?.env) {
    if (!this._canDamageLegacyAlien(horde, actor)) return false;
    return this._hasLegacyLineOfSight(actor, origin, environment);
  }

  _hasLegacyLineOfSight(actor, origin = null, environment = this.gameContext?.env) {
    const visual = actor.mesh ?? actor.group;
    if (!environment?.hasLineOfSight || !visual) return true;
    const from = origin ?? this.position.clone().add(new THREE.Vector3(0, 2, 0));
    const target = visual.position.clone().add(new THREE.Vector3(0, actor.type === 'facehugger' ? .2 : 1.2, 0));
    return environment.hasLineOfSight(from, target, { radius: .03 });
  }

  _defeatLegacyAlien(horde, actor, cause) {
    if (!actor || actor.hp > 0) return null;
    const killerFaction = horde?.battleSimulation?.config.playerFaction ?? 'yautja';
    if (horde?.defeatAlien) return horde.defeatAlien(actor, { cause, killerFaction });
    // Tiny injected managers used by integrations/tests may lack the full owner.
    // Real gameplay always uses the central manager above.
    if (this._legacyDefeated.has(actor)) return null;
    this._legacyDefeated.add(actor);
    const event = horde?.recordDefeat?.(actor, { cause, killerFaction });
    for (const key of ['aliens', 'chestbursters']) {
      const index = horde?.[key]?.indexOf(actor) ?? -1;
      if (index >= 0) horde[key].splice(index, 1);
    }
    actor.mesh?.removeFromParent();
    if (!event && horde) horde.deadCount = (horde.deadCount ?? 0) + 1;
    return event ?? { type: 'death', cause, killerFaction };
  }

  schedule(callback, delay, interval = 0) {
    const timer = { callback, time: delay / 1000, interval: interval / 1000 };
    if (!this._disposed) this._timers.push(timer);
    return timer;
  }

  scheduleInterval(callback, delay) { return this.schedule(callback, delay, delay); }

  cancelTimer(timer) {
    const index = this._timers.indexOf(timer);
    if (index !== -1) this._timers.splice(index, 1);
  }

  dispose() {
    if (this._disposed) return;
    this._disposed = true;
    this._generatedVisualGeneration++;
    this._timers = [];
    this._gadgetEffects?.dispose();
    this._gadgetEffects = null;
    [...this._effects].forEach(effect => this._removeOwnedEffect(effect));
    this._effects.clear(); this._ownedFxDisposers.clear();
    this.tripwireMines.length = 0; this.activeDropshipBombs.length = 0;
    this.activeSonicTraps.length = 0; this.activeM41AGrenades.length = 0;
    this.locomotion.dispose();
    this._removeImportedCharacter();
    disposeObject(this.mesh);
    this._preyWeaponVisuals.clear();
  }

  applyLoadout(config = {}) {
    const resolved = resolveHunterLoadout(this.data.id, config);
    this.fidelityMode = resolved.fidelityMode;
    this.loadout = { primary: resolved.primary, secondary: resolved.secondary, gadgets: resolved.gadgets };
    this.tacticalLoadout = { ...this.loadout, fidelityMode: this.fidelityMode };
    this.preferredSecondaryWeapon = resolved.secondary;
    this.activePrimary = resolved.primary; this.activeSecondary = resolved.secondary;
    this.medicompCharges = resolved.gadgets.includes('medicomp') ? 3 : 0;
    this.acidSolventCharges = resolved.gadgets.includes('acid_solvent') ? 2 : 0;
    this.bearTrapCharges = resolved.gadgets.includes('bear_trap') ? 3 : 0;
    this.selectWeapon(resolved.primary, false);
    this._syncArsenalVisuals();
    return this.getArsenalState();
  }

  canUseArsenalEquipment(id) {
    if (PREY_WEAPON_PROFILES[id]) return this._canUsePreyEquipment(id);
    if (this.fidelityMode !== 'faithful') return true;
    const reference = HUNTER_ARSENAL_PROFILES[this.data.id];
    if (reference?.weapons.includes(id) || this.loadout.gadgets.includes(id)) return true;
    this.lastArsenalRefusal = { equipment: id, reason: 'unattested_in_reference_kit', message: 'Équipement indisponible dans ce kit de référence.' };
    return false;
  }

  getArsenalState() {
    const reference = HUNTER_ARSENAL_PROFILES[this.data.id];
    return { mode: this.fidelityMode, characterId: this.data.id, referenceKnown: Boolean(reference),
      continuity: reference?.continuity ?? 'unspecified adaptation', fidelity1to1Verified: false,
      weapons: [...(reference?.weapons ?? [])], gadgets: [...this.loadout.gadgets],
      ranged: this.fidelityMode === 'faithful' ? reference?.ranged ?? null : 'plasma_caster',
      actions: Object.entries(HUNTER_ACTION_EQUIPMENT).filter(([, equipment]) => this.fidelityMode !== 'faithful' || reference?.weapons.includes(equipment) || this.loadout.gadgets.includes(equipment)).map(([name]) => name),
      sourceUrls: [...(reference?.sourceUrls ?? [])], lastRefusal: this.lastArsenalRefusal ? { ...this.lastArsenalRefusal } : null };
  }

  getWeaponState() {
    if (PREY_WEAPON_PROFILES[this.activeWeapon]) {
      const bow = this.activeWeapon === 'taabe_bow', profile = this.weaponProfile;
      return { id:this.activeWeapon, fidelityMode:this.fidelityMode, definition:'adapted_human_reference_tool', fidelity1to1Verified:false,
        action:bow?'projectile':'melee', actionMethod:bow?'fireCompoundBow':'lightAttack',
        damage:this.meleeDamage*profile.damage*this.combatStyle.damage, radius:profile.reach*this.combatStyle.reach,
        timing:profile.timing*(this.attackCooldownFactor||1), actionDamage:bow?profile.projectileDamage:this.meleeDamage*profile.damage*this.combatStyle.damage,
        actionRange:bow?profile.projectileRange:profile.reach*this.combatStyle.reach, actionResource:bow?'arrows':'axe_charges',
        actionCost:1, actionAmmo:bow?this.taabeArrowAmmo:this.naruAxeCharges, actionCooldown:bow?profile.cooldown:0,
        actionCooldownRemaining:bow?this.compoundBowCooldown:0, rangedResource:bow?'arrows':'none', rangedCost:bow?1:0,
        plasmaEnergy:this.plasmaEnergy, plasmaCost:0, stamina:this.stamina, lightCost:this.combatStyle.lightCost,
        heavyCost:this.combatStyle.heavyCost*(1+Math.min(5,this.attackComboStep)*.12) };
    }
    const actions = { smart_disc: 'throwSmartDisc', shuriken: 'throwShuriken', compound_bow: 'fireCompoundBow', crossbow: 'fireRangedShot' };
    const actionMethod = actions[this.activeWeapon] ?? 'lightAttack';
    const bolt = this.activeWeapon === 'crossbow' || (this.fidelityMode === 'faithful' && this.data.id === 'feral_predator');
    const projectile = actionMethod !== 'lightAttack';
    const cooldowns = { smart_disc: this.smartDiscCooldown, shuriken: this.shurikenCooldown, compound_bow: this.compoundBowCooldown, crossbow: this.feralBoltCooldown };
    return { id: this.activeWeapon, fidelityMode: this.fidelityMode, action: actionMethod === 'lightAttack' ? 'melee' : 'projectile', actionMethod,
      damage: this.meleeDamage * this.weaponProfile.damage * this.combatStyle.damage, radius: this.weaponProfile.reach * this.combatStyle.reach * (this.meleeReachMultiplier || 1),
      timing: this.weaponProfile.timing * (this.attackCooldownFactor || 1),
      actionDamage: projectile ? this.weaponProfile.projectileDamage ?? this.plasmaDamage : this.meleeDamage * this.weaponProfile.damage * this.combatStyle.damage,
      actionRange: projectile ? this.weaponProfile.projectileRange ?? null : this.weaponProfile.reach * this.combatStyle.reach * (this.meleeReachMultiplier || 1),
      actionResource: projectile ? (this.activeWeapon === 'crossbow' ? 'bolts' : 'cooldown') : 'stamina',
      actionCost: projectile ? (this.activeWeapon === 'crossbow' ? 1 : 0) : this.combatStyle.lightCost,
      actionCooldown: this.weaponProfile.cooldown ?? 0, actionCooldownRemaining: cooldowns[this.activeWeapon] ?? 0,
      boltAmmo: this.feralBoltAmmo, boltCooldown: this.feralBoltCooldown,
      plasmaEnergy: this.plasmaEnergy, plasmaCost: bolt ? 0 : this.data.stats.plasmaEnergyCost,
      rangedResource: bolt ? 'bolts' : 'plasma', rangedCost: bolt ? 1 : this.data.stats.plasmaEnergyCost,
      stamina: this.stamina, lightCost: this.combatStyle.lightCost,
      heavyCost: this.combatStyle.heavyCost * (1 + Math.min(5, this.attackComboStep) * .12) };
  }

  _syncArsenalVisuals() {
    const referenceFeral = this.data.id === 'feral_predator' && this.fidelityMode === 'faithful';
    if (this._plasmaCasterVisual) this._plasmaCasterVisual.visible = !referenceFeral;
    if (this._feralFoldedShield) this._feralFoldedShield.visible = referenceFeral && this.loadout.gadgets.includes('feral_shield') && !this.isBlocking;
    if (this.shieldMesh && this.fidelityMode === 'faithful') this.shieldMesh.visible = this.isBlocking && this.loadout.gadgets.includes('feral_shield');
    this._syncPreyWeaponVisuals();
  }

  _preyContextIsValid(sourceLevelId) {
    const context = this.gameContext;
    if (context) return (context.ui?.selectedLevel?.id ?? context.level?.id ?? context.levelData?.id ?? context.selectedLevel?.id) === PREY_LEVEL_ID;
    return (sourceLevelId ?? this.preyEquipmentSourceLevel) === PREY_LEVEL_ID;
  }

  _canUsePreyEquipment(id, { allowLocked = false, sourceLevelId } = {}) {
    const unlocked = id === 'taabe_bow' ? this.hasTaabeBow : id === 'naru_axe' && this.hasNaruAxe;
    if (!PREY_WEAPON_PROFILES[id] || this._disposed || this.fidelityMode === 'faithful' || !this._preyContextIsValid(sourceLevelId) || (!allowLocked && !unlocked)) {
      this.lastArsenalRefusal = { equipment:id, reason:this.fidelityMode==='faithful'?'unattested_in_reference_kit':'prey_tool_requires_mission_pickup', message:'Outil humain réservé aux trouvailles PREY du mode adapté.' };
      return false;
    }
    return true;
  }

  equipPreyWeapon(id, { sourceLevelId } = {}) {
    if (this.hp <= 0 || !this._canUsePreyEquipment(id,{allowLocked:true,sourceLevelId})) return false;
    this.preyEquipmentSourceLevel = PREY_LEVEL_ID;
    if (id === 'taabe_bow') this.hasTaabeBow = true; else this.hasNaruAxe = true;
    return this.selectWeapon(id, false);
  }

  serializePreyEquipment() {
    return { version:1, sourceLevelId:this.preyEquipmentSourceLevel, hasTaabeBow:this.hasTaabeBow, hasNaruAxe:this.hasNaruAxe,
      taabeArrowAmmo:this.taabeArrowAmmo, naruAxeCharges:this.naruAxeCharges, selected:PREY_WEAPON_PROFILES[this.activeWeapon]?this.activeWeapon:null,
      bowCooldown:Math.max(0,this.compoundBowCooldown), orangeFlowerRemaining:Math.max(0,this.orangeFlowerTimer),
      taabeWarRemaining:Math.max(0,this.taabeWarTimer), mudRemaining:Math.max(0,this.mudCoatedTimer) };
  }

  restorePreyEquipment(saved) {
    if (!saved || saved.version!==1 || this._disposed || (saved.sourceLevelId!==null && saved.sourceLevelId!==PREY_LEVEL_ID) ||
      typeof saved.hasTaabeBow!=='boolean' || typeof saved.hasNaruAxe!=='boolean' ||
      !Number.isInteger(saved.taabeArrowAmmo) || saved.taabeArrowAmmo<0 || saved.taabeArrowAmmo>12 ||
      !Number.isInteger(saved.naruAxeCharges) || saved.naruAxeCharges<0 || saved.naruAxeCharges>4 ||
      (!saved.hasTaabeBow&&saved.taabeArrowAmmo!==0) || (!saved.hasNaruAxe&&saved.naruAxeCharges!==0) ||
      ((saved.hasTaabeBow||saved.hasNaruAxe)&&saved.sourceLevelId!==PREY_LEVEL_ID) ||
      (saved.selected!==null && !PREY_WEAPON_PROFILES[saved.selected]) ||
      (saved.selected==='taabe_bow'&&!saved.hasTaabeBow) || (saved.selected==='naru_axe'&&!saved.hasNaruAxe)) return false;
    const durations = [['bowCooldown',10],['orangeFlowerRemaining',35],['taabeWarRemaining',25],['mudRemaining',30]];
    if (durations.some(([key,max])=>!Number.isFinite(saved[key]??0)||(saved[key]??0)<0||(saved[key]??0)>max)) return false;
    if (saved.sourceLevelId && !this._preyContextIsValid(saved.sourceLevelId)) return false;
    this.preyEquipmentSourceLevel=saved.sourceLevelId; this.hasTaabeBow=saved.hasTaabeBow; this.hasNaruAxe=saved.hasNaruAxe;
    this.taabeArrowAmmo=saved.taabeArrowAmmo; this.naruAxeCharges=saved.naruAxeCharges;
    this.compoundBowCooldown=saved.bowCooldown??0;
    this.orangeFlowerTimer=saved.orangeFlowerRemaining??0; this.isOrangeFlowerActive=this.orangeFlowerTimer>0;
    this.taabeWarTimer=saved.taabeWarRemaining??0; this.isTaabeWarActive=this.taabeWarTimer>0;
    this.mudCoatedTimer=saved.mudRemaining??0; this.isMudCoated=this.mudCoatedTimer>0;
    if (saved.selected && this.fidelityMode!=='faithful') this.selectWeapon(saved.selected,false);
    else if (PREY_WEAPON_PROFILES[this.activeWeapon]) this.selectWeapon(this.loadout.primary,false);
    return true;
  }

  _syncPreyWeaponVisuals() {
    if (!this._preyWeaponVisuals || !this.mesh) return;
    const selected = PREY_WEAPON_PROFILES[this.activeWeapon] && this.fidelityMode!=='faithful' && this._preyContextIsValid() ? this.activeWeapon : null;
    if (selected && !this._preyWeaponVisuals.has(selected)) this._preyWeaponVisuals.set(selected,createPreyWeaponVisual(selected));
    if (selected && this.secWeaponMesh) this.secWeaponMesh.visible=false;
    for (const [id,visual] of this._preyWeaponVisuals) {
      const side=id==='taabe_bow'?'left':'right', native=this._importedCharacter?.adapter.sockets?.[`${side}Hand`];
      const parent=native??this[`${side}Arm`]??this.mesh;
      if (visual.parent!==parent) parent.add(visual);
      visual.position.set(0,native?0:-1.3,native?0:.2); visual.rotation.set(0,0,id==='naru_axe'?-.12:0);
      this.mesh.updateWorldMatrix(true,false); parent.updateWorldMatrix(true,false);
      const parentScale=parent.getWorldScale(new THREE.Vector3()), ownerScale=this.mesh.getWorldScale(new THREE.Vector3());
      visual.scale.set(Math.abs(ownerScale.x/parentScale.x),Math.abs(ownerScale.y/parentScale.y),Math.abs(ownerScale.z/parentScale.z));
      visual.visible=id===selected;
      visual.traverse(part=>{if(part.isMesh)part.visible=true;if(!part.material)return;
        for(const material of(Array.isArray(part.material)?part.material:[part.material])) {
          if(!this.armorMaterials.includes(material))this.armorMaterials.push(material);
          if(this._uncloakedSurfaces&&!this._uncloakedSurfaces.has(material))this._uncloakedSurfaces.set(material,surfaceState(material));
          if(this.isCloaked){material.transparent=true;material.opacity=.22;material.depthWrite=false;}
        }
      });
    }
  }

  fireRangedShot(isCharged = false) {
    const bolt = (this.data.id === 'feral_predator' && this.fidelityMode === 'faithful') || this.activeWeapon === 'crossbow';
    if (!bolt) return this.firePlasmaShot(isCharged);
    if (this._disposed || this.hp <= 0 || this.isFacehuggerLatched || this.feralBoltAmmo <= 0 || this.feralBoltCooldown > 0 || !this.canUseArsenalEquipment('crossbow')) return null;
    // The ranged shortcut also selects the visible physical tool, so state,
    // held equipment and projectile admission agree.
    if (this.activeWeapon !== 'crossbow' && !this.selectWeapon('crossbow', false)) return null;
    this.feralBoltAmmo--; this.feralBoltCooldown = HUNTER_WEAPON_PROFILES.crossbow.cooldown;
    this.lastArsenalRefusal = null;
    this.audioEngine.playFlechetteVolleyLaunch?.();
    this.mesh.updateWorldMatrix(true, true);
    const muzzle = this.secWeaponMesh.localToWorld(new THREE.Vector3(0, 0, 1.13));
    return { projectileKind: 'feral_bolt', position: muzzle,
      direction: new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)),
      damage: this.plasmaDamage, speed: 62, isCharged: false, energyCost: 0, ammoCost: 1 };
  }

  hasGadget(id) { return this.loadout.gadgets.includes(id); }

  setLaserColor(color) {
    this.laserColorHex = color;
    this.laserGroup?.traverse(child => { if (child.material?.color) child.material.color.set(color); });
  }

  selectWeapon(id, playSound = true) {
    const selected = PREY_WEAPON_PROFILES[id] ?? HUNTER_WEAPON_PROFILES[id];
    if (!selected || !this.canUseArsenalEquipment(id)) return false;
    this.lastArsenalRefusal = null;
    this.activeWeapon = id;
    this.weaponProfile = { ...selected };
    this.isSecondaryWeapon = id !== 'wristblades';
    this.secWeaponMesh.visible = this.isSecondaryWeapon;
    this._syncWristbladeVisuals();
    // Give selected melee tools a distinct silhouette without changing shared materials.
    if (!PREY_WEAPON_PROFILES[id]) {
      this.secWeaponMesh.geometry.dispose();
      this.secWeaponMesh.geometry = createHunterWeaponGeometry(id);
    }
    this._syncArsenalVisuals();
    if (playSound) this.audioEngine.playWeaponSwap();
    return true;
  }

  toggleWeaponSwap() {
    const alternate = this.loadout.secondary || 'smart_disc';
    const id = this.activeWeapon === this.loadout.primary ? alternate : this.loadout.primary;
    this.selectWeapon(id);
    return this.isSecondaryWeapon;
  }

  toggleCloak() {
    this.isCloaked = !this.isCloaked;
    if (!this._uncloakedSurfaces) {
      this._uncloakedSurfaces = new Map([...this.skinMaterials, ...this.armorMaterials].map(material => [material, surfaceState(material)]));
    }
    for (const [material, original] of this._uncloakedSurfaces) {
      if (this.isCloaked) {
        material.transparent = true;
        material.opacity = 0.22;
        material.roughness = 0.08;
        material.metalness = 0.95;
        material.depthWrite = false;
      } else Object.assign(material, original);
      material.needsUpdate = true;
    }
    return this.isCloaked;
  }

  move(dir, delta) {
    if (this._disposed || !Number.isFinite(delta) || delta <= 0 || this.isFacehuggerLatched || this.isPerched || this.isMountedSmartgun) return;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      let speedMult = (this.warhornBuffTimer > 0 ? 1.4 : 1.0) * (this.isBerserkerActive ? 1.45 : 1.0);
      if (this.isExosuitActive) speedMult *= 1.25;
      if (this.isComancheWarPaintActive) speedMult *= 1.30; // +30% Comanche War Paint Spirit Agility (Prey 2022)
      if (this.isTaabeWarActive && this.taabeWarTimer > 0) speedMult *= 1.30;
      if (this.isKenjiReflexesActive) speedMult *= 1.25; // +25% Ninja Agility (Killer of Killers 2025)
      if (this.isSyntheticAnkleGrabbed) speedMult *= 0.2;
      const moveDistance = this.moveSpeed * speedMult * delta;
      this.position.addScaledVector(dir, moveDistance);

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * (1 - Math.exp(-12 * delta));
    }

    // Verticality: Adjust elevation smoothly when traversing catwalks and ramps
    if (!this.isLeaping && !this.isPerched) {
      let groundY = 0;
      if (this.gameContext && this.gameContext.env && this.gameContext.env.getElevationAt) {
        groundY = this.gameContext.env.getElevationAt(this.position.x, this.position.z, this.position.y);
      }
      this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, 1 - Math.exp(-18 * delta));
    }

    this.gameContext?.env?.resolveMovement?.(this.position, .75, this.getCollisionHeight());
    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
  }

  _spendCombatStamina(cost) {
    if (!Number.isFinite(cost) || cost < 0 || this.stamina + 1e-9 < cost) { this.lastCombatRefusal = 'stamina'; return false; }
    this.stamina = Math.max(0, this.stamina - cost); this.lastCombatRefusal = null; return true;
  }

  _beginCombatWindow(kind, staminaCost, oldDuration) {
    const style = this.combatStyle, heavy = kind === 'heavy';
    const windup = (heavy ? style.heavyWindup : style.lightWindup) * this.weaponProfile.timing;
    const active = heavy ? style.heavyActive : style.lightActive;
    const recovery = Math.max(.05, oldDuration - windup - active) * (heavy ? style.heavyRecovery : style.lightRecovery);
    const duration = windup + active + recovery;
    this.attackTimer = duration;
    this.currentAttackId++;
    this.attackWindow = { id: this.currentAttackId, kind, phase: 'windup', elapsed: 0, windup, active, recovery, duration, impactConsumed: false, hyperarmor: heavy && style.heavyHyperarmor };
    const target = this.rightArm.quaternion.clone(), side = this.attackComboStep % 2 ? 1 : -1;
    const lead = target.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side * (heavy ? .22 : .14)));
    const follow = target.clone().multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), -side * (heavy ? .78 : .44)));
    const rest = this.locomotion.arms.find(arm => arm.node === this.rightArm)?.rest.clone() ?? new THREE.Quaternion();
    this._attackArmPose = { id: this.currentAttackId, target, lead, follow, rest, applied: target.clone() };
    return { attackId: this.currentAttackId, style: style.id, windup, hitDelay: windup + active * .5, activeDuration: active, recovery, duration, staminaCost };
  }

  _updateAttackArmPose() {
    const pose = this._attackArmPose, window = this.attackWindow;
    if (!this.isAttacking || !pose || pose.id !== this.currentAttackId || !window) return;
    // A trophy, gadget or other authored action can take the arm. Only rewrite
    // a quaternion still owned by this attack, preserving the established rule.
    if (Math.abs(this.rightArm.quaternion.dot(pose.applied)) < 1 - 1e-9) return;
    const smooth = value => { const t = THREE.MathUtils.clamp(value, 0, 1); return t * t * (3 - 2 * t); };
    if (window.phase === 'windup') this.rightArm.quaternion.slerpQuaternions(pose.target, pose.lead, smooth(window.elapsed / window.windup));
    else if (window.phase === 'active') this.rightArm.quaternion.slerpQuaternions(pose.lead, pose.follow, smooth((window.elapsed - window.windup) / window.active));
    else if (window.phase === 'recovery') this.rightArm.quaternion.slerpQuaternions(pose.follow, pose.rest, smooth((window.elapsed - window.windup - window.active) / window.recovery));
    pose.applied.copy(this.rightArm.quaternion);
  }

  claimAttackImpact(id) {
    const window = this.attackWindow;
    if (this._disposed || this.hp <= 0 || !window || id !== this.currentAttackId || window.phase === 'cancelled' || window.impactConsumed) return false;
    window.impactConsumed = true; return true;
  }

  cancelAttack(reason = 'guard') {
    const window = this.attackWindow;
    if (!this.isAttacking || !window) return true;
    if (reason === 'hit' && window.phase === 'active' && window.hyperarmor) return false;
    if (reason !== 'hit' && window.phase === 'active') return false;
    window.phase = 'cancelled'; this.currentAttackId++; this.attackTimer = 0; this.isAttacking = false;
    this.rightArm.rotation.x = 0; this.rightArm.rotation.y = 0;
    return true;
  }

  getCombatState() {
    return { style: this.combatStyle.id, weakness: this.combatStyle.weakness, stamina: this.stamina, maxStamina: this.maxStamina,
      crowdCooldown: this.crowdAttackCooldown, attackId: this.currentAttackId, window: this.attackWindow ? { ...this.attackWindow } : null,
      lightChainLength: this.combatStyle.lightChainLength, lightCost: this.combatStyle.lightCost,
      nextHeavyCost: this.combatStyle.heavyCost * (1 + Math.min(5, this.attackComboStep) * .12), lastRefusal: this.lastCombatRefusal,
      definition: 'original_gameplay_adaptation', fidelity1to1Verified: false };
  }

  lightAttack() {
    if (this._disposed || this.hp <= 0 || this.isAttacking || this.isBlocking || this.isFacehuggerLatched) return null;
    if (this.activeWeapon==='taabe_bow') { this.lastCombatRefusal='projectile_action_required'; return null; }
    if (this.activeWeapon==='naru_axe' && (!this.canUseArsenalEquipment('naru_axe') || !Number.isInteger(this.naruAxeCharges) || this.naruAxeCharges<1 || this.naruAxeCharges>4)) { this.lastCombatRefusal='axe_charges'; return null; }
    if (!this._spendCombatStamina(this.combatStyle.lightCost)) return null;
    if (this.activeWeapon==='naru_axe') this.naruAxeCharges--;
    this.isAttacking = true;
    this.attackComboStep = (this.attackComboStep % this.combatStyle.lightChainLength) + 1;
    this.attackTimer = 0.28 * this.weaponProfile.timing * (this.attackCooldownFactor || 1);
    this.comboResetTimer = 1.4;

    this.audioEngine.playSlash();

    // Distinct arm postures for 5-tier light string
    const s = this.attackComboStep;
    if (s === 1) {
      this.rightArm.rotation.x = -Math.PI * 0.55;
      this.rightArm.rotation.y = 0.45;
    } else if (s === 2) {
      this.rightArm.rotation.x = -Math.PI * 0.4;
      this.rightArm.rotation.y = -0.55;
    } else if (s === 3) {
      this.rightArm.rotation.x = -Math.PI * 0.65;
      this.rightArm.rotation.y = 0.2;
    } else if (s === 4) {
      this.rightArm.rotation.x = -Math.PI * 0.35;
      this.rightArm.rotation.y = -0.3;
    } else {
      this.rightArm.rotation.x = -Math.PI * 0.75;
      this.rightArm.rotation.y = 0.6;
    }

    const baseDmg = this.meleeDamage * this.weaponProfile.damage;
    const buff = (this.warhornBuffTimer > 0 ? 1.5 : 1.0) * (this.isBerserkerActive ? 2.0 : 1.0);
    const mudMult = this.isMudCamouflaged ? 1.40 : 1.0;
    const billyMult = this.isBillyCourageActive ? 1.50 : 1.0;
    const lightningMult = this.isLightningAuraActive ? 1.35 : 1.0;
    const flintlockMult = this.isFlintlockKineticActive ? 1.40 : 1.0;
    const hanzoMult = this.isHanzoBushidoActive ? 1.60 : 1.0;
    const neuroMult = this.isNeurotoxinBladeActive ? 1.45 : 1.0;
    const stalkerMult = this.isMasterHunterStalkerActive ? 1.50 : 1.0;
    const nanoMult = this.isPredatorKillerNanoActive ? 1.45 : 1.0;
    const dillonMult = this.isDillonGritActive ? 1.40 : 1.0;
    const comancheMult = this.isComancheWarPaintActive ? 1.25 : 1.0;
    const clawsMult = this.isFeralClawsActive ? 1.35 : 1.0;
    const trackingMult = this.isAncestralTrackingActive ? 1.20 : 1.0;
    const ursaMult = this.isUrsaBerserkActive ? 1.30 : 1.0;
    const kenjiMult = this.isKenjiReflexesActive ? 1.35 : 1.0;

    const window = this._beginCombatWindow('light', this.combatStyle.lightCost, this.attackTimer);
    return {
      ...window,
      type: 'light',
      step: this.attackComboStep,
      damage: baseDmg * this.combatStyle.damage * (1 + this.attackComboStep * 0.18) * buff * mudMult * billyMult * lightningMult * flintlockMult * hanzoMult * neuroMult * stalkerMult * nanoMult * dillonMult * comancheMult * clawsMult * trackingMult * ursaMult * kenjiMult,
      radius: this.weaponProfile.reach * this.combatStyle.reach * (this.meleeReachMultiplier || 1.0),
      angle: (Math.PI * 0.65) * (this.meleeArcMultiplier || 1.0)
    };
  }

  heavyAttack() {
    if (this._disposed || this.hp <= 0 || this.isAttacking || this.isBlocking || this.isFacehuggerLatched) return null;
    if (this.activeWeapon==='taabe_bow') { this.lastCombatRefusal='projectile_action_required'; return null; }
    if (this.activeWeapon==='naru_axe') {
      if (!this.canUseArsenalEquipment('naru_axe') || !Number.isInteger(this.naruAxeCharges) || this.naruAxeCharges<1 || this.naruAxeCharges>4) { this.lastCombatRefusal='axe_charges'; return null; }
      const cost=this.combatStyle.heavyCost;
      if(!this._spendCombatStamina(cost))return null;
      this.naruAxeCharges--; this.isAttacking=true; this.attackComboStep=0; this.comboResetTimer=0;
      this.rightArm.rotation.x=-Math.PI*.7; this.rightArm.rotation.y=.2;
      this.audioEngine.playSlash?.();
      const window=this._beginCombatWindow('heavy',cost,.65);
      return {...window,type:'heavy',step:0,chargeType:'prey_axe',chargeName:'HACHE À LIEN — FRAPPE LOURDE',
        damage:this.meleeDamage*this.weaponProfile.damage*this.combatStyle.damage*2,
        radius:this.weaponProfile.reach*this.combatStyle.reach,angle:Math.PI*.65,knockback:2.5};
    }
    const step = this.attackComboStep;
    if (step >= 3 && this.crowdAttackCooldown > 0) { this.lastCombatRefusal = 'crowd_cooldown'; return null; }
    const staminaCost = this.combatStyle.heavyCost * (1 + Math.min(5, step) * .12);
    if (!this._spendCombatStamina(staminaCost)) return null;
    if (step >= 3) this.crowdAttackCooldown = this.combatStyle.crowdCooldown;
    this.isAttacking = true;
    const baseDmg = this.meleeDamage * this.weaponProfile.damage;
    const buff = (this.warhornBuffTimer > 0 ? 1.5 : 1.0) * (this.isBerserkerActive ? 2.0 : 1.0);

    let chargeType = 'c1';
    let chargeName = 'C1 - DISLOCATION CINÉTIQUE (GUARD-BREAK)';
    let dmgMult = 2.0;
    let radius = 7.0;
    let knockback = 9.0;
    let isLauncher = false;
    let launchVelY = 0;
    let isStun = false;
    let stunDuration = 0;

    if (step === 0) {
      // C1: Concussive Guard Break / Launcher thrust (Ki'cte Gauntlet strike)
      this.attackTimer = 0.42;
      this.audioEngine.playSlash();
      this.rightArm.rotation.x = -Math.PI * 0.7;
      chargeType = 'c1';
      chargeName = "C1 - KI'CTE CINÉTIQUE (BRISE-GARDE)";
      dmgMult = 2.0;
      radius = 7.0;
      knockback = 9.5;
    } else if (step === 1) {
      // C2: Vertical Blade Uppercut (Airborne Juggle Launcher - S'yuit-de Upper thrust)
      this.attackTimer = 0.45;
      this.audioEngine.playLauncherWhoosh();
      this.rightArm.rotation.x = -Math.PI * 0.9;
      chargeType = 'c2';
      chargeName = "C2 - PROJECTION CÉLESTE S'YUIT-DE (JUGGLE)";
      dmgMult = 2.6;
      radius = 5.2;
      isLauncher = true;
      launchVelY = 19.0;
    } else if (step === 2) {
      // C3: Hundred-Claw Flurry Stun Barrage (Dahdt-ne Hundred Claws)
      this.attackTimer = 0.55;
      this.audioEngine.playSlash();
      this.audioEngine.playYautjaClick();
      chargeType = 'c3';
      chargeName = "C3 - RAFALE CENT-GRIFFES DAHDT-NE (STUN)";
      dmgMult = 3.5;
      radius = 6.0;
      isStun = true;
      stunDuration = 3.2;
      knockback = 3.5;
    } else if (step === 3) {
      // C4: Tornado Crowd-Clearing Cleave (Guan-thwei Whirlwind)
      this.attackTimer = 0.52;
      this.audioEngine.playSlash();
      this.audioEngine.playYautjaRoar();
      this.mesh.rotation.y += Math.PI * 2;
      chargeType = 'c4';
      chargeName = "C4 - TORNADE DÉMEMBRANTE GUAN-THWEI (300°)";
      dmgMult = 4.4;
      radius = 9.8;
      knockback = 15.0;
    } else if (step === 4) {
      // C5: Geyser Celestial Plasma Vortex (Thwei-mhi Celestial Geyser)
      this.attackTimer = 0.62;
      this.audioEngine.playLauncherWhoosh();
      this.audioEngine.playPlasmaShot();
      chargeType = 'c5';
      chargeName = "C5 - VORTEX CÉLESTE THWEI-MHI (GEYSER)";
      dmgMult = 5.5;
      radius = 11.5;
      isLauncher = true;
      launchVelY = 25.0;
    } else {
      // C6: Apex Seismic Shockwave Cataclysm (Prah'khe Apex Slam)
      this.attackTimer = 0.78;
      this.audioEngine.playC6CataclysmBoom();
      this.audioEngine.playYautjaRoar();
      chargeType = 'c6';
      chargeName = "C6 - CATACLYSME SISMIQUE PRAH'KHE (360°)";
      dmgMult = 7.2;
      radius = 16.5;
      knockback = 18.0;
      isLauncher = true;
      launchVelY = 17.0;
    }

    this.attackTimer *= this.weaponProfile.timing;
    radius *= this.weaponProfile.reach / 3.8;

    // Reset combo string after any Charge finisher
    this.attackComboStep = 0;
    this.comboResetTimer = 0;
    this.currentChargeName = chargeName;
    this.attackTimer *= (this.attackCooldownFactor || 1.0);
    radius *= (this.meleeReachMultiplier || 1.0);

    const mudMult = this.isMudCamouflaged ? 1.40 : 1.0;
    const billyMult = this.isBillyCourageActive ? 1.50 : 1.0;
    const lightningMult = this.isLightningAuraActive ? 1.35 : 1.0;
    const flintlockMult = this.isFlintlockKineticActive ? 1.40 : 1.0;
    const hanzoMult = this.isHanzoBushidoActive ? 1.60 : 1.0;
    const neuroMult = this.isNeurotoxinBladeActive ? 1.45 : 1.0;
    const stalkerMult = this.isMasterHunterStalkerActive ? 1.50 : 1.0;
    const nanoMult = this.isPredatorKillerNanoActive ? 1.45 : 1.0;
    const dillonMult = this.isDillonGritActive ? 1.40 : 1.0;
    const comancheMult = this.isComancheWarPaintActive ? 1.25 : 1.0;
    const clawsMult = this.isFeralClawsActive ? 1.35 : 1.0;
    const trackingMult = this.isAncestralTrackingActive ? 1.20 : 1.0;
    const ursaMult = this.isUrsaBerserkActive ? 1.45 : 1.0;
    const kenjiMult = this.isKenjiReflexesActive ? 1.30 : 1.0;

    const window = this._beginCombatWindow('heavy', staminaCost, this.attackTimer);
    return {
      ...window,
      type: chargeType,
      name: chargeName,
      formationEffect: step === 0 ? 'line_break' : step >= 3 ? 'sweep' : 'single_target',
      damage: baseDmg * this.combatStyle.damage * dmgMult * buff * mudMult * billyMult * lightningMult * flintlockMult * hanzoMult * neuroMult * stalkerMult * nanoMult * dillonMult * comancheMult * clawsMult * trackingMult * ursaMult * kenjiMult,
      radius: radius * this.combatStyle.reach,
      knockback: knockback,
      isLauncher: isLauncher,
      launchVelY: launchVelY,
      isStun: isStun,
      stunDuration: stunDuration,
      angle: Math.PI * 2
    };
  }

  firePlasmaShot(isCharged = false) {
    if (this._disposed || this.hp <= 0 || !this.canUseArsenalEquipment('plasma_caster')) return null;
    let energyCost = isCharged ? 35 : this.data.stats.plasmaEnergyCost;
    if (this.hasDlexTargetingHUD) {
      energyCost = Math.round(energyCost * 0.75); // 25% energy reduction
    }
    if (this.plasmaEnergy < energyCost || this.isFacehuggerLatched) return null;
    this.plasmaEnergy -= energyCost;

    this.audioEngine.playPlasmaShot();
    if (isCharged && this.audioEngine.playC6CataclysmBoom) {
      this.audioEngine.playC6CataclysmBoom();
    }

    const origin = this.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const isElevated = this.isPerched || this.position.y >= 2.0;
    const isExtremeHeight = this.position.y >= 7.0;
    const pitchDown = isElevated ? (isExtremeHeight ? -0.55 : (this.position.y >= 4.0 ? -0.42 : -0.28)) : 0;

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      pitchDown,
      Math.cos(this.rotationY)
    ).normalize();

    let dmg = isCharged ? this.plasmaDamage * 3.4 : this.plasmaDamage;
    let spd = isCharged ? 52 : 45;

    if (this.hasDlexTargetingHUD) {
      dmg *= 1.15;
    }
    if (this.hasClassic1987Plasma) {
      dmg *= 1.20;
      spd *= 1.20;
    }
    if (isElevated) {
      dmg *= isExtremeHeight ? 1.50 : 1.35; // +35% elevated sniping damage, +50% extreme altitude sniping
    }
    if (this.orbitalScanTimer > 0) {
      dmg *= 1.25; // +25% critical scan boost
    }
    if (this.isRoryTelemetryActive) {
      dmg *= 1.35; // +35% decoded Yautja telemetry critical damage boost (The Predator 2018)
    }
    if (this.isComancheWarPaintActive) {
      dmg *= 1.25; // +25% Comanche War Paint kinetic force (Prey 2022)
    }
    if (this.isTorresIncendiaryActive) {
      dmg *= 1.30; // +30% WWII Incendiary Aviator Ammo (Killer of Killers 2025)
    }

    return {
      position: origin,
      direction: forward,
      damage: dmg,
      speed: spd,
      isCharged: isCharged
    };
  }

  triggerMusouOverload() {
    if (this.musouEnergy < 100 || this.isFacehuggerLatched) return false;
    this.musouEnergy = 0;
    this.isMusouActive = true;

    this.audioEngine.playMusouBlast();

    this.schedule(() => {
      this.isMusouActive = false;
    }, 2000);

    return true;
  }

  takeDamage(amount, isAcid = false, attacker = null, attackContext = {}) {
    if (!Number.isFinite(amount) || amount <= 0 || this._disposed) return this.hp;
    if(attacker?.battleUnitId)amount=battleCoordinationDamage(attacker,amount);
    if (!attackContext || typeof attackContext !== 'object') attackContext = {};
    // Chantier 4 & Lucas QA (v51.0): Dedicated Active Wristblade Parry Deflection [F]
    const parryable = !isAcid && attackContext.parryable === true;
    const blockable = !isAcid && attackContext.blockable === true && (!attackContext.blockRequiresShield || this.fidelityMode !== 'faithful' || this.loadout.gadgets.includes('feral_shield'));
    if (this.isParrying && this.parryTimer > 0 && parryable && this._spendCombatStamina(6)) {
      this.isParrying = false;
      this.parryTimer = 0;
      this.hasParryRiposte = true;
      this.isCounterRiposteReady = true;
      this.riposteTimer = (this.forgeUpgrades && this.forgeUpgrades.masterWristblades) ? 4.5 : 3.2;

      if (this.audioEngine && this.audioEngine.playParryClang) {
        this.audioEngine.playParryClang();
      } else if (this.audioEngine && this.audioEngine.playShieldBlock) {
        this.audioEngine.playShieldBlock();
      }

      if (this.particles) {
        this.particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 36);
      }

      if (attacker) {
        attacker.isStunned = true;
        attacker.stunTimer = 3.2;
        if (attacker.mesh) {
          const pushDir = attacker.mesh.position.clone().sub(this.position).normalize();
          attacker.mesh.position.addScaledVector(pushDir, 6.0);
        }
      }

      if (this.gameContext && this.gameContext.ui && this.gameContext.ui.showAnnouncement) {
        this.gameContext.ui.showAnnouncement('⚔️ PARADE DLEX PARFAITE [F] ! CONTRE-RIPOSTE ÉCLAIR (x4 DÉGÂTS CRITIQUES) !');
      }
      return this.hp;
    }

    if ((this.isBlocking || this.isPerched) && blockable && this._spendCombatStamina(8)) {
      if (this.parryTimer > 0 && parryable) {
        // Chantier 2: PERFECT PARRY DEFLECTION (Prey 2022 / Concrete Jungle adaptation)
        this.parryTimer = 0;
        this.hasParryRiposte = true;
        this.riposteTimer = 2.2; // 2.2s window to unleash lethal riposte

        if (this.audioEngine && this.audioEngine.playParryClang) {
          this.audioEngine.playParryClang();
        } else {
          this.audioEngine.playShieldBlock();
        }

        if (this.particles) {
          this.particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.6, 0)), 32);
        }

        if (attacker) {
          attacker.isStunned = true;
          attacker.stunTimer = 3.0;
          if (attacker.mesh) {
            const pushDir = attacker.mesh.position.clone().sub(this.position).normalize();
            attacker.mesh.position.addScaledVector(pushDir, 5.5);
          }
        }

        if (this.gameContext && this.gameContext.ui && this.gameContext.ui.showAnnouncement) {
          this.gameContext.ui.showAnnouncement('🛡️ PARRY PARFAIT ! RIPOSTE GUAN-THWEI DISPONIBLE [CLIC GAUCHE] !');
        }
        return this.hp;
      }

      this.audioEngine.playShieldBlock();
      return this.hp;
    }
    if (this.isWhirlShieldActive && blockable) {
      amount *= 0.10; // 90% frontal damage deflection (Aliens: Fireteam Elite rotary naginata spin)
      if (this.particles) this.particles.emitSparks(this.position, 12);
      if (this.audioEngine && this.audioEngine.playPlasmaGlaiveWhirl) {
        this.audioEngine.playPlasmaGlaiveWhirl();
      }
    }
    if (this.isPlasmaGlaiveActive && blockable) {
      this.audioEngine.playPlasmaGlaiveStrike();
      return this.hp; // Plasma Glaive cyclone barrier completely deflects frontal attacks!
    }
    if (this.isHybridMutated) return this.hp;
    if (this.isExosuitActive) {
      amount *= 0.15; // 85% damage reduction from Cyber-Hunt Bionic Exosuit!
      isAcid = false; // Acid immunity from magnetic forcefield
      if (this.particles && this.particles.emitSparks) {
        this.particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 8);
      }
    }
    if (this.isBerserkerActive) {
      amount *= 0.5; // 50% damage reduction in Berserker Rage
      isAcid = false; // Immune to acid burns in Berserker Rage
    }
    if (this.isCloaked) {
      amount *= 0.5;
      if (this.particles && this.particles.emitCloakSparkFlicker) {
        this.particles.emitCloakSparkFlicker(this.position, 14);
      }
      if (this.audioEngine && this.audioEngine.playCloakFlicker) {
        this.audioEngine.playCloakFlicker();
      }
      this.triggerCloakFlicker(this.audioEngine, this.particles);
    }
    if (isAcid && this.hasEnkiduArmor) {
      amount *= (1.0 - (this.acidResistance || 0.40));
    }
    if (isAcid && this.isMudCoated && this.mudCoatedTimer>0) amount *= .6;
    // Chantier 10 (v54.0): Cauterizing Wristblade 30% Acid Reduction
    if (isAcid && this.hasCauterizingWristblade) {
      amount *= 0.70;
    }
    // Chantier 10 (v55.0): Ceramic Thermal Chitin Weave 50% Acid Deflection & Shielding
    if (isAcid && this.hasCeramicThermalArmor) {
      amount *= 0.50;
      if (this.audioEngine && this.audioEngine.playCeramicArmorDeflection) {
        this.audioEngine.playCeramicArmorDeflection();
      }
      if (this.particles && this.particles.emitSparks) {
        this.particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 8);
      }
    }
    // Chantier 1 & Elena QA (v54.0): Blooded Warrior Sacred Mark 15% Damage Reduction
    if (this.isBloodedWarrior) {
      amount *= (this.bloodedDamageResistance || 0.85);
    }
    this.hp = Math.max(0, this.hp - amount);
    if (amount > 0) this.cancelAttack('hit');

    if (isAcid && !this.isBerserkerActive) {
      this.inflictVisorAcidBurn(true);
    }

    // Luminescent neon green Yautja bio-blood splatter
    if (this.particles && amount > 2) {
      this.particles.emitYautjaPhosphorBlood(this.position, Math.min(20, Math.floor(amount * 0.4)));
    }

    return this.hp;
  }

  updateDefeatedEffects(delta) {
    if (this._disposed || this.hp > 0 || !Number.isFinite(delta) || delta <= 0) return;
    // Co-op can continue after one hunter falls. Existing projections keep
    // their simulation timers without reviving movement, energy or gadgets.
    this._gadgetEffects?.update(delta);
    this._importedCharacter?.mechanisms?.update(delta);
    this._gadgetEffects?.rebind();
  }

  /* Chantier 2: Guan-Thwei Lethal Counter-Riposte (Concrete Jungle / Dark Horse Canon) */
  performGuanThweiRiposte(horde, synthetics, bosses, particles) {
    this.hasParryRiposte = false;
    this.riposteTimer = 0;

    if (this.audioEngine && this.audioEngine.playIaijutsuSlice) {
      this.audioEngine.playIaijutsuSlice();
    } else {
      this.audioEngine.playSlash();
    }

    // 360° Amber/Golden crescent shockwave
    const waveGeo = new THREE.RingGeometry(1.2, 6.5, 24);
    waveGeo.rotateX(-Math.PI / 2);
    const waveMat = new THREE.MeshBasicMaterial({
      color: 0xf59e0b,
      transparent: true,
      opacity: 0.95,
      side: THREE.DoubleSide
    });
    const waveMesh = new THREE.Mesh(waveGeo, waveMat);
    waveMesh.position.copy(this.position).add(new THREE.Vector3(0, 1.2, 0));
    this._addOwnedEffect(waveMesh);

    let fade = 0.25;
    const fAnim = this.scheduleInterval(() => {
      fade -= 0.05;
      waveMesh.scale.multiplyScalar(1.08);
      waveMesh.material.opacity = fade / 0.25;
      if (fade <= 0) {
        this.cancelTimer(fAnim);
        this._removeOwnedEffect(waveMesh);
      }
    }, 40);

    if (particles) {
      particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.4, 0)), 32);
    }

    const attack = {
      origin: this.position,
      radius: 7.2,
      damage: 550,
      type: 'heavy'
    };

    let hits = [];
    if (horde && horde.checkMeleeHits) {
      hits = horde.checkMeleeHits(attack);
    }
    if (synthetics && synthetics.checkHits) {
      synthetics.checkHits(attack);
    }
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh.position.distanceTo(this.position) <= 7.5) {
      bosses.takeDamage(550);
    }

    return hits;
  }

  _syncVisualState(delta = 0) {
    this._gadgetEffects?.update(delta);
    if (this._importedCharacter) {
      this._syncImportedAccessories();
      this._importedCharacter.adapter.update(delta, this.locomotion.state.moving);
      this._importedCharacter.mechanisms?.update(delta);
      this.laserGroup.position.y = this._importedCharacter.laserBaseY + (this._importedCharacter.adapter.visualGroundOffsetY ?? 0);
    }
    this._gadgetEffects?.rebind();
    this._syncArsenalVisuals();
  }

  update(delta, horde = null) {
    if (this._disposed || !Number.isFinite(delta) || delta < 0) return;
    // A paused/photo frame still propagates explicit FPS visibility and pose
    // changes. It must not advance timers, attacks, cooldowns or resources.
    if (delta === 0) { this._syncVisualState(0); return; }
    this._simulationTime += delta;
    this.feralBoltCooldown = Math.max(0, this.feralBoltCooldown - delta);
    this.crowdAttackCooldown = Math.max(0, this.crowdAttackCooldown - delta);
    const idleTime = this.isAttacking ? Math.max(0, delta - Math.max(0, this.attackTimer)) : delta;
    if (!this.isBlocking && this.hp > 0) this.stamina = Math.min(this.maxStamina, this.stamina + this.combatStyle.regeneration * idleTime);
    if (this.attackWindow && !['cancelled', 'complete'].includes(this.attackWindow.phase)) {
      const window = this.attackWindow; window.elapsed += delta;
      window.phase = window.elapsed < window.windup - 1e-9 ? 'windup' : window.elapsed < window.windup + window.active - 1e-9 ? 'active' : window.elapsed < window.duration - 1e-9 ? 'recovery' : 'complete';
    }
    this._updateLegacyStates(delta, horde, this.gameContext?.bosses, this.particles);
    for (const timer of [...this._timers]) {
      timer.time -= delta;
      let ticks = 0;
      while (timer.time <= 1e-9 && this._timers.includes(timer) && !this._disposed && ticks++ < 128) {
        if (timer.interval > 0) timer.time += timer.interval;
        else this.cancelTimer(timer);
        timer.callback();
        if (timer.interval <= 0) break;
      }
      if (ticks >= 128 && timer.time <= 0) timer.time = timer.interval;
    }
    if (this.visorAcidBurn > 0) {
      this.visorAcidBurn = Math.max(0, this.visorAcidBurn - delta * 0.35);
    }

    if (this.warhornBuffTimer > 0) {
      this.warhornBuffTimer -= delta;
    }

    if (this.empCooldown > 0) {
      this.empCooldown = Math.max(0, this.empCooldown - delta);
    }

    if (this.combiStickCooldown > 0) {
      this.combiStickCooldown = Math.max(0, this.combiStickCooldown - delta);
    }

    if (this.smartDiscCooldown > 0) this.smartDiscCooldown = Math.max(0, this.smartDiscCooldown - delta);
    if (this.shurikenCooldown > 0) {
      this.shurikenCooldown = Math.max(0, this.shurikenCooldown - delta);
    }

    if (this.powerGloveCooldown > 0) {
      this.powerGloveCooldown = Math.max(0, this.powerGloveCooldown - delta);
    }

    if (this.spineWhipCooldown > 0) {
      this.spineWhipCooldown = Math.max(0, this.spineWhipCooldown - delta);
    }

    if (this.flechetteCooldown > 0) {
      this.flechetteCooldown = Math.max(0, this.flechetteCooldown - delta);
    }

    if (this.boneScytheCooldown > 0) {
      this.boneScytheCooldown = Math.max(0, this.boneScytheCooldown - delta);
    }

    if (this.compoundBowCooldown > 0) {
      this.compoundBowCooldown = Math.max(0, this.compoundBowCooldown - delta);
    }

    if (this.holoDecoyCooldown > 0) {
      this.holoDecoyCooldown = Math.max(0, this.holoDecoyCooldown - delta);
    }

    if (this.plasmaGlaiveCooldown > 0) {
      this.plasmaGlaiveCooldown = Math.max(0, this.plasmaGlaiveCooldown - delta);
    }

    if (this.iaijutsuCooldown > 0) {
      this.iaijutsuCooldown = Math.max(0, this.iaijutsuCooldown - delta);
    }

    if (this.antiGravCooldown > 0) {
      this.antiGravCooldown = Math.max(0, this.antiGravCooldown - delta);
    }

    if (this.plasmaPistolCooldown > 0) {
      this.plasmaPistolCooldown = Math.max(0, this.plasmaPistolCooldown - delta);
    }

    if (this.grappleCooldown > 0) {
      this.grappleCooldown = Math.max(0, this.grappleCooldown - delta);
    }

    if (this.isGrappling) {
      this.grappleTimer -= delta;
      if (this.grappleTimer <= 0) {
        this.isGrappling = false;
      }
    }

    if (this.isPlasmaGlaiveActive) {
      this.plasmaGlaiveDuration -= delta;
      if (this.plasmaGlaiveMesh) {
        this.plasmaGlaiveMesh.rotation.z += delta * 32.0;
      }

      if (horde) {
        horde.checkMeleeHits({
          origin: this.position,
          radius: 4.8,
          damage: 160 * delta * 5,
          type: 'plasma'
        });

        // Vaporize any zero-G acid globules within whirl barrier
        if (horde.zeroGAcidGlobules) {
          for (let g = horde.zeroGAcidGlobules.length - 1; g >= 0; g--) {
            const glob = horde.zeroGAcidGlobules[g];
            if (glob && glob.mesh && glob.mesh.position.distanceTo(this.position) <= 5.0) {
              if (this.audioEngine) this.audioEngine.playAcidGlobuleHiss();
              horde.scene.remove(glob.mesh);
              horde.zeroGAcidGlobules.splice(g, 1);
            }
          }
        }
      }

      if (this.plasmaGlaiveDuration <= 0) {
        this.isPlasmaGlaiveActive = false;
        if (this.plasmaGlaiveMesh) this.plasmaGlaiveMesh.visible = false;
      }
    }

    if (this.isBerserkerActive) {
      this.berserkerTimer -= delta;
      this.hp = Math.min(this.maxHp, this.hp + 28 * delta);
      this.visorAcidBurn = 0;

      this.berserkerHeartbeatTimer -= delta;
      if (this.berserkerHeartbeatTimer <= 0) {
        this.berserkerHeartbeatTimer = 0.85;
        this.audioEngine.playBerserkerHeartbeat();
      }

      if (this.berserkerTimer <= 0) {
        this.isBerserkerActive = false;
      }
    }

    if (this.isCloaked) {
      this.cloakShimmerTimer += delta * 4;
      const shimmer = 0.2 + Math.sin(this.cloakShimmerTimer) * 0.08;
      this.skinMaterials.forEach(m => { m.opacity = shimmer; });
      this.armorMaterials.forEach(m => { m.opacity = shimmer; });
    }

    if (this.isFacehuggerLatched) {
      this.takeDamage(40 * delta);
    }

    if (this.parryTimer > 0) {
      this.parryTimer = Math.max(0, this.parryTimer - delta);
    }

    if (this.riposteTimer > 0) {
      this.riposteTimer = Math.max(0, this.riposteTimer - delta);
      if (this.riposteTimer <= 0) {
        this.hasParryRiposte = false;
      }
    }

    // Exosuit & Neurotoxin Timers (v46.0)
    if (this.exosuitCooldown > 0) this.exosuitCooldown -= delta;
    if (this.isExosuitActive) {
      this.exosuitTimer -= delta;
      if (this.exosuitMesh) {
        this.exosuitMesh.visible = true;
        this.exosuitMesh.rotation.y += delta * 3.0;
      }
      if (this.exosuitTimer <= 0) {
        this.isExosuitActive = false;
        if (this.exosuitMesh) this.exosuitMesh.visible = false;
        if (this.gameContext && this.gameContext.ui && this.gameContext.ui.showAnnouncement) {
          this.gameContext.ui.showAnnouncement('🦾 EXOSQUELETTE BIONIQUE DÉSACTIVÉ : RECHARGE COMMENCÉE (45S).');
        }
      }
    }

    if (this.neurotoxinCooldown > 0) this.neurotoxinCooldown -= delta;

    if (this.isSyntheticAnkleGrabbed) {
      this.ankleGrabTimer -= delta;
      if (this.ankleGrabTimer <= 0) {
        this.isSyntheticAnkleGrabbed = false;
      }
    }

    if (this.isLeaping) {
      let groundY = 0;
      if (this.gameContext && this.gameContext.env && this.gameContext.env.getElevationAt) {
        groundY = this.gameContext.env.getElevationAt(this.position.x, this.position.z, this.position.y);
      }

      const grav = 36 * (this.gravityMultiplier !== undefined ? this.gravityMultiplier : 1.0);
      const previousY = this.position.y;
      this.leapVelocityY -= grav * delta;
      this.position.y += this.leapVelocityY * delta;
      const vertical = this.gameContext?.env?.resolveVerticalMovement?.(this.position, previousY, this.getCollisionHeight());
      if (vertical?.blocked) { this.position.copy(vertical.point); this.leapVelocityY = 0; }

      if (this.position.y <= groundY) {
        this.position.y = groundY;
        this.isLeaping = false;
        this.audioEngine.playPounceImpact();

        if (horde) {
          horde.checkMeleeHits({
            origin: this.position,
            radius: 8.5,
            damage: this.meleeDamage * 2.0,
            type: 'heavy'
          });
        }
      }
      this.mesh.position.copy(this.position);
    }

    if (this.isAttacking) {
      this.attackTimer -= delta;
      if (this.attackTimer <= 0) {
        this.isAttacking = false;
        this.rightArm.rotation.x = 0;
        this.rightArm.rotation.y = 0;
      }
    }

    if (this.plasmaEnergy < this.maxPlasmaEnergy && !this.isWhirlShieldActive && !this.isFlamerActive && !this.isDualPlasmaBeamActive) {
      this.plasmaEnergy = Math.min(this.maxPlasmaEnergy, this.plasmaEnergy + 15 * delta);
    }
    this._updateAttackArmPose();
    this.locomotion.update(delta);
    this._syncVisualState(delta);

    if (this.traxNetCooldown > 0) {
      this.traxNetCooldown = Math.max(0, this.traxNetCooldown - delta);
    }

    if (this.isWhirlShieldActive) {
      this.whirlShieldTimer = (this.whirlShieldTimer || 0) + delta;
      if (this.plasmaEnergy > 0) {
        this.plasmaEnergy = Math.max(0, this.plasmaEnergy - 12 * delta);
        if (this.plasmaGlaiveMesh) {
          this.plasmaGlaiveMesh.rotation.z += delta * 28.0;
        }
      } else {
        this.isWhirlShieldActive = false;
      }
    }

    // Chantier 4: Facehugger Chestburster Embryo Incubation Warning & Fatal Eruption
    if (this.isChestbursterInfected) {
      this.chestbursterTimer -= delta;
      const beepInterval = Math.max(0.4, (this.chestbursterTimer / 35.0) * 2.5);
      this.chestbursterWarningBeepTimer = (this.chestbursterWarningBeepTimer || 0) + delta;
      if (this.chestbursterWarningBeepTimer >= beepInterval) {
        this.chestbursterWarningBeepTimer = 0;
        const tempo = 1.0 + (1.0 - Math.max(0, this.chestbursterTimer / 35.0)) * 2.0;
        if (this.audioEngine && this.audioEngine.playChestbursterIncubationBeep) {
          this.audioEngine.playChestbursterIncubationBeep(tempo);
        }
      }

      if (this.chestbursterTimer <= 0) {
        this.isChestbursterInfected = false;
        this.takeDamage(99999); // Fatal thoracic eruption!
      }
    }

    // Chantier 9 (v43): Yautja Tripwire Mine Cooldown & Proximity Update
    if (this.tripwireMineCooldown > 0) {
      this.tripwireMineCooldown = Math.max(0, this.tripwireMineCooldown - delta);
    }
    this.updateTripwireMines(delta, horde, this.gameContext?.synthetics, this.particles);
  }

  /* =========================================================================
     v43.0 APEX WEAPON SYSTEMS (Prey / AVP 2 / Predator 2 Canon)
     ========================================================================= */

  /* Chantier 9: Yautja Thermal Plasma Mine / Proximity Tri-Beam Tripwire */
  deployTripwireMine(scene, particles) {
    if (!this.canUseArsenalEquipment('mines')) return false;
    if (this.tripwireMineCooldown > 0 || this.tripwireMines.length >= 3) return false;
    this.tripwireMineCooldown = 4.5;

    const minePos = this.position.clone();
    minePos.y = 0.1;

    const group = new THREE.Group();
    group.position.copy(minePos);

    // Triangular Yautja Mine Body
    const bodyMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.9, roughness: 0.2 });
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xef4444 });

    const base = new THREE.Mesh(new THREE.ConeGeometry(0.35, 0.18, 3), bodyMat);
    group.add(base);

    const core = new THREE.Mesh(new THREE.SphereGeometry(0.08, 6, 6), coreMat);
    core.position.y = 0.12;
    group.add(core);

    // 3 Tri-Beam Red Lasers radiating outwards (7.5m length)
    const beamMat = new THREE.MeshBasicMaterial({ color: 0xff0000, transparent: true, opacity: 0.85 });
    const beams = [];
    for (let b = 0; b < 3; b++) {
      const angle = (b / 3) * Math.PI * 2;
      const beamGeo = new THREE.CylinderGeometry(0.02, 0.02, 7.5, 4);
      beamGeo.rotateX(Math.PI / 2);
      const beamMesh = new THREE.Mesh(beamGeo, beamMat);
      beamMesh.position.set(Math.sin(angle) * 3.75, 0.1, Math.cos(angle) * 3.75);
      beamMesh.rotation.y = angle;
      group.add(beamMesh);
      beams.push({ angle, dir: new THREE.Vector3(Math.sin(angle), 0, Math.cos(angle)) });
    }

    this._addOwnedEffect(group);
    if (this.audioEngine && this.audioEngine.playYautjaClick) {
      this.audioEngine.playYautjaClick();
    }

    this.tripwireMines.push({
      group,
      pos: minePos,
      beams,
      armTimer: 1.0,
      isArmed: false
    });

    return true;
  }

  updateTripwireMines(delta, horde, synthetics, particles) {
    for (let i = this.tripwireMines.length - 1; i >= 0; i--) {
      const mine = this.tripwireMines[i];
      if (!mine.isArmed) {
        mine.armTimer -= delta;
        if (mine.armTimer <= 0) mine.isArmed = true;
        continue;
      }

      // Check proximity trigger against enemies (7.0m trigger radius)
      let triggered = false;
      let triggerPos = null;

      if (horde && horde.aliens) {
        for (const a of horde.aliens) {
        if (!this._canDamageLegacyAlien(horde, a)) continue;
          if (!a || a.hp <= 0 || !a.mesh) continue;
          if (a.mesh.position.distanceTo(mine.pos) <= 7.0) {
            triggered = true;
            triggerPos = a.mesh.position;
            break;
          }
        }
      }

      if (!triggered && synthetics && synthetics.units) {
        for (const s of synthetics.units) {
          if (!s || s.hp <= 0 || !s.mesh) continue;
          if (s.mesh.position.distanceTo(mine.pos) <= 7.0) {
            triggered = true;
            triggerPos = s.mesh.position;
            break;
          }
        }
      }

      if (triggered) {
        // Detonate Plasma Tripwire Mine!
        if (this.audioEngine && this.audioEngine.playM40GrenadeBlast) {
          this.audioEngine.playM40GrenadeBlast();
        }
        if (particles && particles.emitSparks) {
          particles.emitSparks(mine.pos, 35);
        }

        // Deal 550 area plasma damage in 7.5m radius
        if (horde) {
          horde.checkMeleeHits({
            origin: mine.pos,
            radius: 7.5,
            damage: 550,
            type: 'heavy'
          });
        }
        if (synthetics) {
          synthetics.checkHits({
            origin: mine.pos,
            radius: 7.5,
            damage: 550
          });
        }

        if (this.gameContext && this.gameContext.triggerCameraShake) {
          this.gameContext.triggerCameraShake(0.7, 0.3);
        }

        if (this.gameContext && this.gameContext.ui) {
          this.gameContext.ui.showAnnouncement('💥 MINE TRIPWIRE PLASMA YAUTJA DÉTONÉE : DÉFLAGRATION 550 DÉGÂTS !');
        }

        this._removeOwnedEffect(mine.group);
        this.tripwireMines.splice(i, 1);
      }
    }
  }

  /* Chantier 3: Smart-Disc Remote Laser Guidance & Telemetric Hover (Predator 2 / AVP 2010) */
  startSmartDiscRemoteGuidance(disc) {
    if (!this.canUseArsenalEquipment('smart_disc')) return false;
    this.isSmartDiscGuiding = true;
    this.guidedSmartDisc = disc;
    if (this.audioEngine && this.audioEngine.playSmartDiscHoverHum) {
      this.audioEngine.playSmartDiscHoverHum();
    }
  }

  updateSmartDiscRemoteGuidance(delta, cameraForward) {
    if (!this.isSmartDiscGuiding || !this.guidedSmartDisc || !this.guidedSmartDisc.mesh) return;
    const disc = this.guidedSmartDisc;
    // Steer disc along camera orientation
    const steerDir = cameraForward.clone().normalize();
    disc.mesh.position.addScaledVector(steerDir, 24.0 * delta);
    disc.mesh.rotation.y += delta * 35.0; // Rapid gyroscopic spin
  }

  stopSmartDiscRemoteGuidance() {
    this.isSmartDiscGuiding = false;
    this.guidedSmartDisc = null;
  }

  /* Chantier 7: Yautja Burner / Incinerator Plasma Flamer Mode (AvP Lore / Dark Horse adaptation) */
  togglePlasmaFlamer() {
    if (!this.canUseArsenalEquipment('plasma_flamer')) return false;
    this.isFlamerActive = !this.isFlamerActive;
    if (this.isFlamerActive && this.audioEngine && this.audioEngine.playPlasmaFlamerStream) {
      this.audioEngine.playPlasmaFlamerStream();
    }
    return this.isFlamerActive;
  }

  firePlasmaFlamer(delta, horde, environment, particles) {
    if (!this.canUseArsenalEquipment('plasma_flamer')) return false;
    if (!this.isFlamerActive || this.plasmaEnergy < 5.0 || this.isFacehuggerLatched) {
      this.isFlamerActive = false;
      return false;
    }

    // Drain 25 plasma energy per second
    this.plasmaEnergy = Math.max(0, this.plasmaEnergy - 25.0 * delta);

    // Continuous audio loop
    this.flamerAudioTimer = (this.flamerAudioTimer || 0) + delta;
    if (this.flamerAudioTimer >= 0.32) {
      this.flamerAudioTimer = 0;
      if (this.audioEngine && this.audioEngine.playPlasmaFlamerStream) {
        this.audioEngine.playPlasmaFlamerStream();
      }
    }

    const origin = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));
    const isElevated = this.isPerched || this.position.y >= 2.0;
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      isElevated ? -0.38 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    // Visual flame particle jet
    if (particles && particles.emitSparks) {
      const flamePos = origin.clone().addScaledVector(forward, 2.5 + Math.random() * 4.0);
      flamePos.x += (Math.random() - 0.5) * 1.4;
      flamePos.y += (Math.random() - 0.5) * 1.0;
      flamePos.z += (Math.random() - 0.5) * 1.4;
      particles.emitSparks(flamePos, 6);
    }

    // Deal 110 dmg/s in 8.5m cone (dot > 0.65)
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toAlien = a.mesh.position.clone().sub(origin);
        const dist = toAlien.length();
        if (dist <= 8.5) {
          toAlien.normalize();
          const dot = forward.dot(toAlien);
          if (dot > 0.62) {
            if (!this._canHitLegacyAlien(horde, a, origin)) continue;
            a.hp -= 110.0 * delta;
            // Catch fire effect: spark spurts
            if (particles && particles.emitSparks && Math.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              if (this.gameContext && !horde?.centralDeathScoring) {
                this.gameContext.comboHits++;
                this.gameContext.score += 75;
              }
            }
          }
        }
      }

      // Obliterate Micro-Xenomorph Swarms caught in flame cone
      if (horde.microSwarms) {
        for (let s = horde.microSwarms.length - 1; s >= 0; s--) {
          const swarm = horde.microSwarms[s];
          if (swarm.isDead) continue;
          if (!this._canHitLegacyAlien(horde, swarm, origin)) continue;
          if (swarm.group.position.distanceTo(origin) <= 7.5) {
            swarm.hp -= 250.0 * delta; // Super-effective against micro swarms!
            if (swarm.hp <= 0) {
              swarm.isDead = true;
              this._removeOwnedEffect(swarm.group);
              horde.microSwarms.splice(s, 1);
              if (this.gameContext && this.gameContext.ui) {
                this.gameContext.ui.showAnnouncement('🔥 ESSAIM DE MICRO-XÉNOS INCINÉRÉ PAR LE BRÛLEUR PLASMA !');
              }
            }
          }
        }
      }
    }

    // Burn away Queen bio-resin webbings
    if (environment && environment.checkWebbingDamage) {
      const burnHitPos = origin.clone().addScaledVector(forward, 4.0);
      environment.checkWebbingDamage(burnHitPos, 3.5, 120.0 * delta, particles);
    }

    // Damage cryo specimen tubes
    if (environment && environment.checkCryoTubeHits) {
      const burnHitPos = origin.clone().addScaledVector(forward, 4.0);
      environment.checkCryoTubeHits(burnHitPos, 3.0, 100.0 * delta, this.audioEngine, particles, horde);
    }

    return true;
  }

  /* === CHANTIER 5 (v45): Yautja Pure Energy Plasma Pistol Mode (AVP: Requiem Wolf / Predator 2) === */
  firePlasmaPistol(horde, bosses, particles, environment) {
    if (!this.canUseArsenalEquipment('plasma_pistol')) return false;
    if (this.plasmaEnergy < 12 || this.plasmaPistolCooldown > 0) return false;

    this.plasmaEnergy -= 12;
    this.plasmaPistolCooldown = 0.42;

    if (this.audioEngine && this.audioEngine.playPlasmaPistolBurst) {
      this.audioEngine.playPlasmaPistolBurst();
    }

    const isElevated = this.isPerched || this.position.y >= 2.0;
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      isElevated ? -0.32 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const origin = this.position.clone().add(new THREE.Vector3(0.4, 1.8, 0.3));

    // Emit 3 rapid ionized azure/violet plasma burst sparks
    for (let b = 0; b < 3; b++) {
      this.schedule(() => {
        const boltPos = origin.clone().addScaledVector(forward, 24.0);
        const wallHit = environment?.traceSegment?.(origin, boltPos, { radius: .03 });
        const impactFraction = Number.isFinite(wallHit?.t) ? THREE.MathUtils.clamp(wallHit.t, 0, 1) : 1;
        // Custom colliders may supply only t. Keep the effect and interaction
        // on the same finite segment, including a wall immediately at the muzzle.
        const impactPos = origin.clone().lerp(boltPos, impactFraction);
        const boltOrigin = origin.clone().addScaledVector(forward, Math.min(1.5 + b * 0.4, 24 * impactFraction));
        if (particles && particles.emitSparks) {
          particles.emitSparks(boltOrigin, 5);
        }

        // Raycast hit check along trajectory
        let hitTarget = false;

        // Check boss hit
        const boss = bosses?.activeBoss;
        if (boss?.mesh) {
          const bossDist = boss.mesh.position.distanceTo(origin);
          if (bossDist <= 28.0) {
            const toBoss = boss.mesh.position.clone().sub(origin).normalize();
            if (forward.dot(toBoss) > 0.88 && this._hasLegacyLineOfSight(boss, origin, environment)) {
              const isCrit = Math.random() < 0.45;
              const dmg = 95 * (isCrit ? 3.0 : 1.0);
              bosses.takeDamage(dmg, horde);
              hitTarget = true;
              if (particles && particles.emitSparks) particles.emitSparks(boss.mesh.position, 8);
              if (isCrit && this.gameContext && this.gameContext.ui) {
                this.gameContext.ui.showAnnouncement('💥 TIR CRITIQUE PISTOLET PLASMA (AVP-R) : 285 DÉGÂTS D\'ÉNERGIE PURE !');
              }
            }
          }
        }

        // Check horde hits
        if (!hitTarget && horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
            if (!a || a.hp <= 0 || !a.mesh) continue;
            const toAlien = a.mesh.position.clone().sub(origin);
            const dist = toAlien.length();
            if (dist <= 26.0) {
              toAlien.normalize();
              if (forward.dot(toAlien) > 0.88) {
                const isCrit = Math.random() < 0.5;
                const dmg = 95 * (isCrit ? 3.0 : 1.0);
                if (!this._canHitLegacyAlien(horde, a, origin, environment)) continue;
                a.hp -= dmg;
                hitTarget = true;

                if (particles && particles.emitSparks) particles.emitSparks(a.mesh.position, 6);

                if (a.hp <= 0) {
                  if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                  horde.spawnAcidPool(a.mesh.position);
                  this._defeatLegacyAlien(horde, a, 'legacy_weapon');
                  if (this.gameContext && !horde?.centralDeathScoring) {
                    this.gameContext.comboHits++;
                    this.gameContext.score += 85;
                  }
                }
                break;
              }
            }
          }
        }

        // An actor consumes this bolt. Otherwise the grid owner checks the
        // physical impact and visibility to the actual candidate grid.
        if (!hitTarget && environment && environment.checkElectricGridInteraction) {
          environment.checkElectricGridInteraction(impactPos, this, this.gameContext ? this.gameContext.ui : null, this.audioEngine, particles, horde, origin);
        }
      }, b * 85);
    }

    return true;
  }

  /* === CHANTIER 7 (v45): Yautja Ki'cte Gauntlet Grapple & Seismic Counter-Throw (Concrete Jungle / Prey) === */
  performGauntletGrapple(horde, bosses, ui, particles, environment) {
    if (this.grappleCooldown > 0) return false;

    // Scan for nearest Xenomorph within 3.5m
    let targetAlien = null;
    let targetIndex = -1;
    let minDist = 3.6;

    if (horde && horde.aliens) {
      for (let i = 0; i < horde.aliens.length; i++) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const d = this.position.distanceTo(a.mesh.position);
        if (d < minDist) {
          minDist = d;
          targetAlien = a;
          targetIndex = i;
        }
      }
    }

    if (!targetAlien) return false;

    this.grappleCooldown = 4.0;
    this.isGrappling = true;
    this.grappleTimer = 0.5;

    if (this.audioEngine && this.audioEngine.playGauntletGrapple) {
      this.audioEngine.playGauntletGrapple();
    }

    // Execution lift animation: lift target xeno overhead
    targetAlien.mesh.position.y = 2.4;

    this.schedule(() => {
      // Seismic slam into floor
      targetAlien.mesh.position.y = 0;
      if (!this._canDamageLegacyAlien(horde, targetAlien)) return;
      targetAlien.hp -= 260;

      if (this.audioEngine && this.audioEngine.playHeavySlamImpact) {
        this.audioEngine.playHeavySlamImpact();
      }

      if (particles && particles.emitSparks) {
        particles.emitSparks(targetAlien.mesh.position, 12);
      }

      // Radial Seismic Shockwave (5.0m radius, 180 dmg, knocks down surrounding xenos)
      const slamCenter = targetAlien.mesh.position.clone();
      if (horde && horde.aliens) {
        horde.aliens.forEach(otherAlien => {
        if (!this._canDamageLegacyAlien(horde, otherAlien)) return;
          if (!otherAlien || otherAlien.hp <= 0 || !otherAlien.mesh || otherAlien === targetAlien) return;
          const dist = otherAlien.mesh.position.distanceTo(slamCenter);
          if (dist <= 5.2) {
            otherAlien.hp -= 180;
            const pushDir = otherAlien.mesh.position.clone().sub(slamCenter).normalize();
            otherAlien.mesh.position.addScaledVector(pushDir, 5.5);
            otherAlien.isStunned = true;
            otherAlien.stunTimer = 2.5;
          }
        });
      }

      // Check kill on target
      if (targetAlien.hp <= 0 && horde && horde.aliens) {
        if (horde.goreEngine) horde.goreEngine.spawnDismemberment(targetAlien.mesh.position, 'heavy');
        horde.spawnAcidPool(targetAlien.mesh.position);
        this._defeatLegacyAlien(horde, targetAlien, 'gauntlet_grapple');
        if (this.gameContext && !horde?.centralDeathScoring) {
          this.gameContext.comboHits += 2;
          this.gameContext.score += 200;
        }
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🥋 PRISE KI\'CTE : PROJECTION SISMIQUE D\'ÉCRASEMENT AU SOL (180 DÉGÂTS RADIAUX) !');
      }
    }, 220);

    return true;
  }

  /* === CHANTIER 4 (v46): Yautja Bionic Cyber-Hunt Exosuit (Concrete Jungle / The Predator / Marvel) === */
  activateCyberExosuit(ui, particles) {
    if (!this.canUseArsenalEquipment('cyber_exosuit')) return false;
    if (this.exosuitCooldown > 0) return false;

    if (!this.exosuitMesh) {
      const frame = new THREE.Group(); frame.name = 'cyber-exosuit-effect';
      frame.userData.playerTransientEffect = true;
      const material = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: .65 });
      const cage = new THREE.Mesh(new THREE.CylinderGeometry(1.05, .9, 3.8, 16, 8, true), material);
      cage.position.y = 2; frame.add(cage); this.mesh.add(frame);
      this.exosuitMesh = frame;
    }

    this.isExosuitActive = true;
    this.exosuitTimer = 12.0;
    this.exosuitCooldown = 45.0;

    if (this.exosuitMesh) {
      this.exosuitMesh.visible = true;
    }

    if (this.audioEngine && this.audioEngine.playCyberExosuitDeploy) {
      this.audioEngine.playCyberExosuitDeploy();
    }

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.8, 0)), 32);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🦾 EXOSQUELETTE BIONIQUE CYBER-CHASSE DÉPLOYÉ (BOUCLIER MAGNÉTIQUE 85%, IMMUNITÉ ACIDE, +25% VIT) !');
    }

    return true;
  }

  performGroundSlam(horde, bosses, synthetics, ui, particles, environment) {
    this.isLeaping = true;
    this.leapVelocityY = 18.0;

    if (this.audioEngine && this.audioEngine.playGroundSlamImpact) {
      this.audioEngine.playGroundSlamImpact();
    }

    this.schedule(() => {
      const slamCenter = this.position.clone();
      const radius = 10.5;

      // Heavy Radial Shockwave (350 dmg, 3s stun, massive pushback)
      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const dist = a.mesh.position.distanceTo(slamCenter);
          if (dist <= radius) {
            a.hp -= 350;
            const pushDir = a.mesh.position.clone().sub(slamCenter).normalize();
            a.mesh.position.addScaledVector(pushDir, 7.5);
            a.isStunned = true;
            a.stunTimer = 3.0;

            if (particles && particles.emitSparks) {
              particles.emitSparks(a.mesh.position, 6);
            }

            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              if (this.gameContext && !horde?.centralDeathScoring) {
                this.gameContext.comboHits += 2;
                this.gameContext.score += 150;
              }
            }
          }
        }
      }

      // Damage synthetics in radius
      if (synthetics && synthetics.androids) {
        synthetics.androids.forEach(syn => {
          if (syn.mesh.position.distanceTo(slamCenter) <= radius) {
            syn.hp -= 280;
            syn.isEMPStunned = true;
            syn.empStunTimer = 3.5;
            synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
            if (syn.hp <= 110 && !syn.isBisected) {
              synthetics.bisectSynthetic(syn);
            }
          }
        });
      }

      // Damage active boss
      if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        if (bosses.activeBoss.mesh.position.distanceTo(slamCenter) <= radius) {
          bosses.activeBoss.hp -= 300;
          if (particles && particles.emitSparks) particles.emitSparks(bosses.activeBoss.mesh.position, 12);
        }
      }

      if (particles && particles.emitSparks) {
        particles.emitSparks(slamCenter, 36);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('💥 IMPACT RÉPULSEUR CYBERNÉTIQUE : CRATÈRE SISMIQUE & ONDE DE CHOC DÉTONANTE (350 DÉGÂTS) !');
      }
    }, 280);

    return true;
  }

  /* === CHANTIER 5 (v46): Yautja Neurotoxin Gas Canister Spray (Predator 2 / Hunting Grounds) === */
  throwNeurotoxinCanister(horde, bosses, synthetics, ui, particles, environment) {
    if (!this.canUseArsenalEquipment('neurotoxin')) return false;
    if (this.neurotoxinCooldown > 0) return false;

    this.neurotoxinCooldown = 30.0;

    if (this.audioEngine && this.audioEngine.playNeurotoxinHiss) {
      this.audioEngine.playNeurotoxinHiss();
    }

    const forward = new THREE.Vector3(0, 0, 1).applyAxisAngle(new THREE.Vector3(0, 1, 0), this.rotationY);
    const center = this.position.clone().addScaledVector(forward, 12.0);
    center.y = 0.4;

    // Expanding Purple Aerosol Gas Cloud Mesh
    const cloudGeo = new THREE.SphereGeometry(6.0, 12, 12);
    const cloudMat = new THREE.MeshBasicMaterial({
      color: 0xa855f7,
      transparent: true,
      opacity: 0.42
    });
    const cloudMesh = new THREE.Mesh(cloudGeo, cloudMat);
    cloudMesh.position.copy(center);
    this._addOwnedEffect(cloudMesh);

    let gasLife = 8.0;
    const gasInterval = this.scheduleInterval(() => {
      gasLife -= 0.5;
      cloudMesh.scale.multiplyScalar(1.02);
      cloudMat.opacity = Math.max(0.05, cloudMat.opacity - 0.02);

      // Slow down and damage Xenomorphs in cloud
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
          if (!a || a.hp <= 0 || !a.mesh) return;
          if (a.mesh.position.distanceTo(center) <= 7.5) {
            a.hp -= 15; // 30 dmg per second
            a.speed = Math.max(2.5, a.speed * 0.7); // 70% slow down
            if (Math.random() < 0.2 && particles && particles.emitSmoke) {
              particles.emitSmoke(a.mesh.position, 2);
            }
          }
        });
      }

      // Slow synthetics in cloud
      if (synthetics && synthetics.androids) {
        synthetics.androids.forEach(syn => {
          if (syn.mesh.position.distanceTo(center) <= 7.5) {
            syn.hp -= 10;
            syn.speed = Math.max(1.8, syn.speed * 0.7);
          }
        });
      }

      if (gasLife <= 0) {
        this.cancelTimer(gasInterval);
        this._removeOwnedEffect(cloudMesh);
      }
    }, 500);

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🧪 CARTOUCHE DE NEUROTOXINE YAUTJA DÉPLOYÉE : BRUME AÉROSOL HYPNOTIQUE (RALENTISSEMENT 70%) !');
    }

    return true;
  }

  /* === CHANTIER 2 (v47): Ancient Yautja Plasma Scythe (AvP Extinction 2003 Canon) === */
  buildPlasmaScytheMesh() {
    const group = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.9, roughness: 0.25 });
    const emitterMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.95, roughness: 0.15 });
    const plasmaMat = new THREE.MeshStandardMaterial({
      color: 0x00f2fe,
      emissive: 0x0284c7,
      transparent: true,
      opacity: 0.88,
      roughness: 0.1,
      metalness: 0.2
    });

    // 2.4m Haft Polearm
    const haft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 2.4, 8), shaftMat);
    haft.position.y = 1.0;
    group.add(haft);

    // Emitter Socket Collar
    const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.06, 0.35, 6), emitterMat);
    collar.position.y = 2.1;
    group.add(collar);

    // Curved Crescent Plasma Blade (AvP Extinction Scythe)
    const bladeGeo = new THREE.RingGeometry(0.5, 0.9, 16, 1, 0, Math.PI * 0.7);
    const blade = new THREE.Mesh(bladeGeo, plasmaMat);
    blade.position.set(0.45, 2.0, 0);
    blade.rotation.z = -Math.PI / 3;
    group.add(blade);

    // Secondary reverse spike
    const spike = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.4, 4), shaftMat);
    spike.position.set(-0.15, 2.15, 0);
    spike.rotation.z = Math.PI / 3;
    group.add(spike);

    group.position.set(0.65, 0.4, 0.4);
    group.rotation.x = 0.2;
    return group;
  }

  togglePlasmaScythe(ui = null) {
    if (!this.canUseArsenalEquipment('plasma_scythe')) return false;
    this.isPlasmaScytheActive = !this.isPlasmaScytheActive;
    if (this.isPlasmaScytheActive) {
      if (!this.plasmaScytheMesh) {
        this.plasmaScytheMesh = this.buildPlasmaScytheMesh();
        this.mesh.add(this.plasmaScytheMesh);
      }
      this.plasmaScytheMesh.visible = true;

      if (this.audioEngine && this.audioEngine.playPlasmaScytheCleave) {
        this.audioEngine.playPlasmaScytheCleave();
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚡ FAUX PLASMA ANCESTRALE YAUTJA ÉQUIPÉE (AVP EXTINCTION) : TRANCHANT IONIQUE 360° !');
      }
    } else {
      if (this.plasmaScytheMesh) {
        this.plasmaScytheMesh.visible = false;
      }
    }
    return this.isPlasmaScytheActive;
  }

  performPlasmaScytheSlash(horde, bosses, synthetics, environment, particles) {
    if (!this.canUseArsenalEquipment('plasma_scythe')) return false;
    if (this.plasmaEnergy < 25.0) {
      if (this.audioEngine && this.audioEngine.playGauntletGrapple) {
        this.audioEngine.playGauntletGrapple();
      }
      return false;
    }

    this.plasmaEnergy -= 25.0;

    if (this.audioEngine && this.audioEngine.playPlasmaScytheCleave) {
      this.audioEngine.playPlasmaScytheCleave();
    }

    // 360 spin animation of the player avatar
    let spin = 0;
    const spinAnim = this.scheduleInterval(() => {
      spin += 0.55;
      this.mesh.rotation.y += 0.55;
      if (spin >= Math.PI * 2) {
        this.cancelTimer(spinAnim);
        this.mesh.rotation.y = this.rotationY;
      }
    }, 20);

    // Visual expanding ion energy ring
    const ringGeo = new THREE.RingGeometry(1.0, 5.5, 32);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({
      color: 0x00f2fe,
      side: THREE.DoubleSide,
      transparent: true,
      opacity: 0.85
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.copy(this.position);
    ringMesh.position.y = 1.0;
    this._addOwnedEffect(ringMesh);

    let scale = 1.0;
    const ringInterval = this.scheduleInterval(() => {
      scale += 0.45;
      ringMesh.scale.set(scale, 1, scale);
      ringMesh.material.opacity -= 0.12;
      if (ringMesh.material.opacity <= 0) {
        this.cancelTimer(ringInterval);
        this._removeOwnedEffect(ringMesh);
      }
    }, 25);

    const cleaveRadius = 5.5 * (this.meleeReachMultiplier || 1.0);
    const cleaveDmg = 380;

    // Cleave all Xenomorphs within 360° reach
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const d = a.mesh.position.distanceTo(this.position);
        if (d <= cleaveRadius) {
          a.hp -= cleaveDmg;
          if (particles && particles.emitSparks) {
            particles.emitSparks(a.mesh.position, 6);
          }
          if (a.hp <= 0) {
            if (horde.goreEngine && horde.goreEngine.spawnDismemberment) {
              horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            }
            horde.spawnAcidPool(a.mesh.position);
            this._defeatLegacyAlien(horde, a, 'legacy_weapon');
            if (this.gameContext && !horde?.centralDeathScoring) {
              this.gameContext.comboHits = (this.gameContext.comboHits || 0) + 1;
              this.gameContext.score += 150;
            }
          }
        }
      }
    }

    // Cleave active boss if within range
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const bDist = bosses.activeBoss.mesh.position.distanceTo(this.position);
      if (bDist <= (cleaveRadius + 1.5)) {
        bosses.takeDamage(cleaveDmg * 0.85, horde);
      }
    }

    // Cleave synthetics
    if (synthetics && synthetics.androids) {
      synthetics.androids.forEach(syn => {
        if (syn.mesh.position.distanceTo(this.position) <= cleaveRadius) {
          syn.hp -= cleaveDmg;
        }
      });
    }

    // Cleave destructible Engineer urns in environment
    if (environment && environment.checkUrnDamage) {
      environment.checkUrnDamage(this.position, cleaveRadius, cleaveDmg, this.audioEngine);
    }

    return true;
  }

  /* === CHANTIER 5 (v47): USCM M41A Underbarrel U1 Grenade Launcher (Aliens 1986 Canon) === */
  fireM41AGrenade(ui = null) {
    if (!this.canUseArsenalEquipment('m41a')) return false;
    if (this.m41aGrenadeCharges <= 0 || this.m41aGrenadeCooldown > 0) {
      return false;
    }

    this.m41aGrenadeCharges--;
    this.m41aGrenadeCooldown = 1.6;

    if (this.audioEngine && this.audioEngine.playM41AGrenadeLaunch) {
      this.audioEngine.playM41AGrenadeLaunch();
    }

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      0.15,
      Math.cos(this.rotationY)
    ).normalize();

    const origin = this.position.clone().add(new THREE.Vector3(0, 1.6, 0)).addScaledVector(forward, 1.0);

    // 30mm HEDP explosive grenade projectile
    const gGeo = new THREE.CylinderGeometry(0.08, 0.08, 0.32, 8);
    gGeo.rotateX(Math.PI / 2);
    const gMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });
    const gMesh = new THREE.Mesh(gGeo, gMat);
    gMesh.position.copy(origin);
    this._addOwnedEffect(gMesh);

    this.activeM41AGrenades.push({
      mesh: gMesh,
      velocity: forward.clone().multiplyScalar(28.0).add(new THREE.Vector3(0, 4.5, 0)),
      gravity: -24.0,
      damage: 420,
      radius: 7.5,
      life: 3.0
    });

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`💥 GRENADE 30MM HEDP M41A LANCÉE ! RESTANT : ${this.m41aGrenadeCharges}`);
    }

    return true;
  }

  updateM41AGrenades(delta, horde, bosses, synthetics, environment, particles) {
    if (this.m41aGrenadeCooldown > 0) {
      this.m41aGrenadeCooldown -= delta;
    }

    for (let i = this.activeM41AGrenades.length - 1; i >= 0; i--) {
      const g = this.activeM41AGrenades[i];
      g.life -= delta;
      g.velocity.y += g.gravity * delta;
      g.mesh.position.addScaledVector(g.velocity, delta);

      // Trailing smoke
      if (particles && particles.emitSmoke && Math.random() < 0.3) {
        particles.emitSmoke(g.mesh.position, 2);
      }

      let shouldDetonate = g.mesh.position.y <= 0.2 || g.life <= 0;

      // Check collision with enemies
      if (!shouldDetonate && horde && horde.aliens) {
        for (let a = 0; a < horde.aliens.length; a++) {
          if (horde.aliens[a].mesh && g.mesh.position.distanceTo(horde.aliens[a].mesh.position) <= 1.4) {
            shouldDetonate = true;
            break;
          }
        }
      }

      if (shouldDetonate) {
        const detPos = g.mesh.position.clone();
        this._removeOwnedEffect(g.mesh);
        this.activeM41AGrenades.splice(i, 1);

        if (this.audioEngine && this.audioEngine.playHeavySlamImpact) {
          this.audioEngine.playHeavySlamImpact();
        }

        // Explosive blast fireball mesh
        const fbGeo = new THREE.SphereGeometry(1.6, 12, 12);
        const fbMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85, wireframe: true });
        const fbMesh = new THREE.Mesh(fbGeo, fbMat);
        fbMesh.position.copy(detPos);
        this._addOwnedEffect(fbMesh);

        let fbScale = 1.0;
        const fbInterval = this.scheduleInterval(() => {
          fbScale += 0.6;
          fbMesh.scale.set(fbScale, fbScale, fbScale);
          fbMesh.material.opacity -= 0.14;
          if (fbMesh.material.opacity <= 0) {
            this.cancelTimer(fbInterval);
            this._removeOwnedEffect(fbMesh);
          }
        }, 25);

        // Sparks & blast particles
        if (particles && particles.emitSparks) {
          particles.emitSparks(detPos, 14);
        }

        // Blast damage to horde
        if (horde && horde.aliens) {
          for (let j = horde.aliens.length - 1; j >= 0; j--) {
            const al = horde.aliens[j];
          if (!this._canDamageLegacyAlien(horde, al)) continue;
            if (!al || al.hp <= 0 || !al.mesh) continue;
            const d = al.mesh.position.distanceTo(detPos);
            if (d <= g.radius) {
              al.hp -= g.damage;
              const push = al.mesh.position.clone().sub(detPos).normalize();
              al.mesh.position.addScaledVector(push, 4.5);
              if (al.hp <= 0) {
                if (horde.goreEngine && horde.goreEngine.spawnDismemberment) {
                  horde.goreEngine.spawnDismemberment(al.mesh.position, 'heavy');
                }
                horde.spawnAcidPool(al.mesh.position);
                this._defeatLegacyAlien(horde, al, 'legacy_weapon');
                if (this.gameContext && !horde?.centralDeathScoring) {
                  this.gameContext.comboHits = (this.gameContext.comboHits || 0) + 1;
                  this.gameContext.score += 180;
                }
              }
            }
          }
        }

        // Blast damage to boss
        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(detPos) <= g.radius) {
            bosses.takeDamage(g.damage * 0.9, horde);
          }
        }

        // Blast damage to synthetics
        if (synthetics && synthetics.androids) {
          synthetics.androids.forEach(syn => {
            if (syn.mesh.position.distanceTo(detPos) <= g.radius) {
              syn.hp -= g.damage;
            }
          });
        }

        // Detonate destructible urns in blast
        if (environment && environment.checkUrnDamage) {
          environment.checkUrnDamage(detPos, g.radius, g.damage, this.audioEngine);
        }
      }
    }
  }

  /* === CHANTIER 1 (v48): Yautja Scout Ship Stratospheric Thermal Beam Strike (AVP 2004 / Concrete Jungle) === */
  triggerScoutShipBeam(ui = null) {
    if (!this.canUseArsenalEquipment('scout_beam')) return false;
    if (this.scoutBeamCooldown > 0 || this.activeScoutBeam) {
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement(`⏳ VAISSEAU ÉCLAIREUR YAUTJA EN RECHARGE ORBITALE (${Math.ceil(this.scoutBeamCooldown)}S)...`);
      }
      return false;
    }

    this.scoutBeamCooldown = 32.0 * (this.bioMaskIndex === 3 ? 0.7 : 1.0); // Wolf Bio-Mask reduces cooldown by 30%

    if (this.audioEngine && this.audioEngine.playScoutShipOrbitalBeam) {
      this.audioEngine.playScoutShipOrbitalBeam();
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🛸 FRAPPE ORBITALE DU VAISSEAU ÉCLAIREUR YAUTJA (AVP 2004) : FAISCEAU THERMIQUE STRATOSPHÉRIQUE (850 DÉGÂTS/S) !');
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const startPos = this.position.clone().addScaledVector(forward, 6.0);
    startPos.y = 0;

    const beamGroup = new THREE.Group();
    beamGroup.position.copy(startPos);

    // Outer plasma sheath (4.5m diameter, 40m tall)
    const outerGeo = new THREE.CylinderGeometry(2.25, 2.25, 42.0, 16);
    const outerMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.45 });
    const outerMesh = new THREE.Mesh(outerGeo, outerMat);
    outerMesh.position.y = 21.0;
    beamGroup.add(outerMesh);

    // White-hot inner core
    const coreGeo = new THREE.CylinderGeometry(0.95, 0.95, 42.0, 12);
    const coreMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92 });
    const coreMesh = new THREE.Mesh(coreGeo, coreMat);
    coreMesh.position.y = 21.0;
    beamGroup.add(coreMesh);

    // Ground scorch ring
    const ringGeo = new THREE.RingGeometry(1.2, 2.8, 24);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf97316, side: THREE.DoubleSide });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.08;
    beamGroup.add(ringMesh);

    this._addOwnedEffect(beamGroup);

    this.activeScoutBeam = {
      group: beamGroup,
      pos: startPos,
      dir: forward,
      timer: 5.0,
      slagTimer: 0
    };

    return true;
  }

  updateScoutShipBeam(delta, horde, bosses, synthetics, particles) {
    if (this.scoutBeamCooldown > 0) {
      this.scoutBeamCooldown = Math.max(0, this.scoutBeamCooldown - delta);
    }
    if (this.m77GaussCooldown > 0) {
      this.m77GaussCooldown = Math.max(0, this.m77GaussCooldown - delta);
    }

    if (!this.activeScoutBeam) return;
    const beam = this.activeScoutBeam;
    beam.timer -= delta;
    beam.slagTimer -= delta;

    // Sweep forward at 7.5m/s
    beam.pos.addScaledVector(beam.dir, 7.5 * delta);
    beam.group.position.copy(beam.pos);
    beam.group.rotation.y += 4.5 * delta;

    // Leave glowing molten slag decals along the path
    if (beam.slagTimer <= 0) {
      beam.slagTimer = 0.25;
      const slagGeo = new THREE.CircleGeometry(2.1, 12);
      slagGeo.rotateX(-Math.PI / 2);
      const slagMat = new THREE.MeshBasicMaterial({ color: 0xea580c, transparent: true, opacity: 0.75 });
      const slag = new THREE.Mesh(slagGeo, slagMat);
      slag.position.set(beam.pos.x, 0.03, beam.pos.z);
      this._addOwnedEffect(slag);
      this.schedule(() => this._removeOwnedEffect(slag), 4500);
    }

    // Incinerate Xenomorphs within 3.2m radius (850 thermal dmg/s)
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        if (a.mesh.position.distanceTo(beam.pos) <= 3.4) {
          a.hp -= 850 * delta;
          if (particles && particles.emitSparks && Math.random() < 0.35) {
            particles.emitSparks(a.mesh.position, 5);
          }
          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
            this._defeatLegacyAlien(horde, a, 'legacy_weapon');
            if (this.gameContext && !horde?.centralDeathScoring) {
              this.gameContext.comboHits++;
              this.gameContext.score += 180;
            }
          }
        }
      }
    }

    // Damage active boss
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      if (bosses.activeBoss.mesh.position.distanceTo(beam.pos) <= 4.5) {
        bosses.takeDamage(650 * delta, horde);
      }
    }

    // Damage enemy synthetics
    if (synthetics && synthetics.androids) {
      synthetics.androids.forEach(syn => {
        if (syn.mesh && syn.mesh.position.distanceTo(beam.pos) <= 3.4) {
          syn.hp -= 850 * delta;
        }
      });
    }

    if (beam.timer <= 0) {
      this._removeOwnedEffect(beam.group);
      this.activeScoutBeam = null;
    }
  }

  /* === CHANTIER 3 (v48): USCM M77 Gauss / Railgun Hypersonic Rifle (Aliens: Colonial Marines / Dark Horse) === */
  fireM77GaussRifle(horde, bosses, synthetics, environment, particles, ui = null) {
    if (!this.canUseArsenalEquipment('m77_gauss')) return false;
    if (this.m77GaussCooldown > 0) return false;
    if (this.m77GaussAmmo <= 0) {
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚠️ FUSIL HYPERSONIQUE M77 GAUSS : MUNITIONS URANIUM APPAUVRI ÉPUISÉES (0/12) !');
      }
      return false;
    }

    this.m77GaussAmmo--;
    this.m77GaussCooldown = 1.35;

    if (this.audioEngine && this.audioEngine.playM77GaussRailgunFire) {
      this.audioEngine.playM77GaussRailgunFire();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 1.8, 0));

    // 45m Hypersonic Linear Railgun Beam + 6 Blue Ionization Shock Rings
    const railGroup = new THREE.Group();
    const beamGeo = new THREE.CylinderGeometry(0.08, 0.08, 45.0, 8);
    beamGeo.rotateX(Math.PI / 2);
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x38bdf8, transparent: true, opacity: 0.95 });
    const beamMesh = new THREE.Mesh(beamGeo, beamMat);
    beamMesh.position.copy(origin).addScaledVector(forward, 22.5);
    beamMesh.lookAt(origin.clone().addScaledVector(forward, 45.0));
    railGroup.add(beamMesh);

    for (let r = 1; r <= 6; r++) {
      const ringGeo = new THREE.TorusGeometry(0.45 + r * 0.08, 0.04, 6, 16);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.85 });
      const ring = new THREE.Mesh(ringGeo, ringMat);
      ring.position.copy(origin).addScaledVector(forward, r * 6.5);
      ring.lookAt(origin.clone().addScaledVector(forward, 45.0));
      railGroup.add(ring);
    }

    this._addOwnedEffect(railGroup);
    this.schedule(() => this._removeOwnedEffect(railGroup), 220);

    // Pierce up to 15 enemies in a 45m line (550 armor-piercing damage, ignores 100% ballistic armor)
    let piercedCount = 0;
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        if (piercedCount >= 15) break;
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toEnemy = a.mesh.position.clone().sub(this.position);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist <= 45.0) {
          const proj = toEnemy.dot(forward);
          const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
          if (proj > 0 && perpDist <= (a.radius || 1.2) + 0.95) {
            if (!this._canHitLegacyAlien(horde, a, origin)) continue;
            a.hp -= 550;
            piercedCount++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(a.mesh.position, 8);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              if (this.gameContext && !horde?.centralDeathScoring) {
                this.gameContext.comboHits++;
                this.gameContext.score += 190;
              }
            }
          }
        }
      }
    }

    // Pierce active boss
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const toBoss = bosses.activeBoss.mesh.position.clone().sub(this.position);
      toBoss.y = 0;
      const dist = toBoss.length();
      if (dist <= 45.0 && toBoss.normalize().dot(forward) > 0.88) {
        bosses.takeDamage(550, horde);
        piercedCount++;
      }
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`⚡ TIR HYPERSONIQUE M77 GAUSS (MACH 7) : ${piercedCount} CIBLES TRANSPERCÉES ! (${this.m77GaussAmmo}/12)`);
    }

    return true;
  }

  /* === CHANTIER 7 (v48): Modular Legendary Yautja Bio-Masks (1987, Celtic, Scar, Wolf, Berserker, Feral) === */
  cycleLegendaryBioMask(ui = null) {
    const masks = [
      { name: 'JUNGLE HUNTER (1987)', color: 0x94a3b8, desc: '+15% RÉGÉN. PLASMA', speedMult: 1.0, meleeMult: 1.0, plasmaMult: 1.0 },
      { name: 'CELTIC (AVP 2004)', color: 0x64748b, desc: '+25% RÉSISTANCE ACIDE & MÊLÉE', speedMult: 0.96, meleeMult: 1.15, plasmaMult: 1.0 },
      { name: 'SCAR BLOODED (AVP 2004)', color: 0x78716c, desc: '+30% DÉGÂTS PLASMA CASTER', speedMult: 1.02, meleeMult: 1.05, plasmaMult: 1.3 },
      { name: 'WOLF ELITE (AVP-R 2007)', color: 0x475569, desc: '-30% RECHARGE GADGETS & FRAPPE ORBITALE', speedMult: 1.05, meleeMult: 1.15, plasmaMult: 1.15 },
      { name: 'BERSERKER MR. BLACK (2010)', color: 0x18181b, desc: '+35% DÉGÂTS MÊLÉE & MACHOIRE D\'OS', speedMult: 1.05, meleeMult: 1.35, plasmaMult: 1.1 },
      { name: 'FERAL BONE MASK (PREY 2022)', color: 0xd6d3d1, desc: '+20% VITESSE DE CHASSE & BOND', speedMult: 1.2, meleeMult: 1.2, plasmaMult: 0.9 }
    ];

    this.bioMaskIndex = (this.bioMaskIndex + 1) % masks.length;
    const selected = masks[this.bioMaskIndex];
    this.bioMaskName = selected.name;

    // Apply passive stat modifiers
    this.moveSpeed = this.baseMoveSpeed * selected.speedMult;
    this.meleeDamage = this.baseMeleeDamage * selected.meleeMult;
    this.plasmaDamage = this.basePlasmaDamage * selected.plasmaMult;

    // Update 3D Bio-Mask appearance on Player Head
    if (this.headMesh && this.headMesh.material) {
      this.headMesh.material.color.setHex(selected.color);
    }

    // Add/update distinctive 3D crest or jawbone details on the head
    if (this.bioMaskCrestGroup) {
      this.mesh.remove(this.bioMaskCrestGroup);
    }
    this.bioMaskCrestGroup = new THREE.Group();

    if (this.bioMaskIndex === 4) {
      // Berserker Mr. Black Bone Jawbone
      const jawMat = new THREE.MeshStandardMaterial({ color: 0xe7e5e4, roughness: 0.5 });
      const jaw = new THREE.Mesh(new THREE.BoxGeometry(0.75, 0.35, 0.5), jawMat);
      jaw.position.set(0, 3.32, 0.48);
      this.bioMaskCrestGroup.add(jaw);
    } else if (this.bioMaskIndex === 1) {
      // Celtic braided ridge
      const ridgeMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15 });
      const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.95, 0.25, 0.45), ridgeMat);
      ridge.position.set(0, 3.85, 0.42);
      this.bioMaskCrestGroup.add(ridge);
    } else if (this.bioMaskIndex === 2 && this.clanMarkMesh) {
      // Scar glowing acid blood mark visible
      this.clanMarkMesh.visible = true;
    }

    this.mesh.add(this.bioMaskCrestGroup);

    if (this.audioEngine && this.audioEngine.playBioMaskSwitchClick) {
      this.audioEngine.playBioMaskSwitchClick();
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🎭 BIO-MASQUE ÉQUIPÉ : ${selected.name} (${selected.desc}) !`);
    }

    return selected;
  }

  /* === CHANTIER 1 (v49.0): Yautja Heavy Maul / Sledgehammer & Seismic Earthshaker ([Shift+1] / Concrete Jungle / Hunting Grounds) === */
  performMaulEarthshaker(horde, bosses, synthetics, environment, particles, ui = null) {
    if (!this.canUseArsenalEquipment('tri_maul')) return false;
    if (this.maulCooldown > 0) return false;
    this.maulCooldown = 14.0;

    if (this.audioEngine && this.audioEngine.playMaulGravitySlam) {
      this.audioEngine.playMaulGravitySlam();
    }

    // Build transient 3D Yautja Gravity Maul & radial golden-cyan shockwave ring
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const slamPos = this.position.clone().add(forward.clone().multiplyScalar(2.6));
    slamPos.y = 0.15;

    const maulGroup = new THREE.Group();
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.12, 3.8, 8),
      new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.9, roughness: 0.25 })
    );
    shaft.rotation.x = Math.PI / 3;
    shaft.position.set(0, 1.4, -0.6);
    maulGroup.add(shaft);

    const head = new THREE.Mesh(
      new THREE.BoxGeometry(1.6, 0.9, 1.1),
      new THREE.MeshStandardMaterial({ color: 0xd97706, emissive: 0xf59e0b, emissiveIntensity: 0.8, metalness: 0.85, roughness: 0.2 })
    );
    head.position.set(0, 0.55, 0.4);
    maulGroup.add(head);

    const ringGeo = new THREE.RingGeometry(0.6, 1.6, 28);
    ringGeo.rotateX(-Math.PI / 2);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0xf59e0b, side: THREE.DoubleSide, transparent: true, opacity: 0.9 });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.position.y = 0.1;
    maulGroup.add(ringMesh);

    maulGroup.position.copy(slamPos);
    this._addOwnedEffect(maulGroup);

    let ringScale = 1.0;
    const ringInterval = this.scheduleInterval(() => {
      ringScale += 0.75;
      ringMesh.scale.set(ringScale, 1, ringScale);
      ringMat.opacity -= 0.09;
      if (ringMat.opacity <= 0) {
        this.cancelTimer(ringInterval);
        this._removeOwnedEffect(maulGroup);
      }
    }, 28);

    if (particles && particles.emitSparks) {
      particles.emitSparks(slamPos, 24);
    }

    let hitCount = 0;
    const radius = 6.5;
    const damage = 620 * (this.meleeDamage / (this.baseMeleeDamage || 120));

    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const d = a.mesh.position.distanceTo(slamPos);
        if (d <= radius) {
          // Shatters Crusher & Raven frontal chitinous shields permanently!
          // QA Audit #4 (balance): the slam only opens an execution stun once the sub-boss is below 35% HP.
          if (a.isFrontalShielded) {
            a.isFrontalShielded = false;
            if (a.maxHp && a.hp <= a.maxHp * 0.35) {
              a.isStunned = true;
              a.stunTimer = Math.max(a.stunTimer || 0, 5.5);
            }
          }
          a.hp -= damage;
          a.mesh.position.y += 1.4; // Launch airborne briefly
          this.schedule(() => {
            if (a && a.mesh && !a.isFlying) a.mesh.position.y = 0;
          }, 320);
          hitCount++;

          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            horde.spawnAcidPool(a.mesh.position);
            this._defeatLegacyAlien(horde, a, 'legacy_weapon');
            if (this.gameContext && !horde?.centralDeathScoring) {
              this.gameContext.comboHits++;
              this.gameContext.score += 210;
            }
          }
        }
      }
    }

    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      if (bosses.activeBoss.mesh.position.distanceTo(slamPos) <= radius + 1.5) {
        bosses.takeDamage(damage * 0.85, horde);
        hitCount++;
      }
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🔨 MARTEAU GRAVITATIONNEL YAUTJA : ONDE SISMIQUE (${hitCount} CIBLES FRACASSÉES / BOUCLIERS BRISÉS) !`);
    }
    return true;
  }

  /* === CHANTIER 5 (v49.0): Tracker Predator Biomechanical Sonic Trap Mine ([Shift+T] / Predators 2010 / AVP 2010) === */
  deploySonicTrapMine(ui = null) {
    if (!this.canUseArsenalEquipment('sonic_mine')) return false;
    if (this.sonicTrapCooldown > 0) return false;
    this.sonicTrapCooldown = 18.0;

    const trapGroup = new THREE.Group();
    const core = new THREE.Mesh(
      new THREE.OctahedronGeometry(0.55, 1),
      new THREE.MeshStandardMaterial({ color: 0x1e293b, emissive: 0x06b6d4, emissiveIntensity: 1.4, metalness: 0.9, roughness: 0.2 })
    );
    core.position.y = 0.6;
    trapGroup.add(core);

    const waveRingGeo = new THREE.RingGeometry(0.8, 1.2, 24);
    waveRingGeo.rotateX(-Math.PI / 2);
    const waveRingMat = new THREE.MeshBasicMaterial({ color: 0x22d3ee, side: THREE.DoubleSide, transparent: true, opacity: 0.75 });
    const waveRing = new THREE.Mesh(waveRingGeo, waveRingMat);
    waveRing.position.y = 0.12;
    trapGroup.add(waveRing);

    trapGroup.position.copy(this.position);
    trapGroup.position.y = 0;
    this._addOwnedEffect(trapGroup);

    this.activeSonicTraps.push({
      mesh: trapGroup,
      core,
      waveRing,
      position: trapGroup.position.clone(),
      timer: 3.0,
      radius: 16.0
    });

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🔊 PIÈGE SONIQUE TRACKER DÉPLOYÉ : ATTRACTION ACOUSTIQUE (16M) AVANT IMPLOSION !`);
    }
    return true;
  }

  updateSonicTraps(delta, horde, bosses, particles) {
    if (this.maulCooldown > 0) this.maulCooldown = Math.max(0, this.maulCooldown - delta);
    if (this.seegsonBoltCooldown > 0) this.seegsonBoltCooldown = Math.max(0, this.seegsonBoltCooldown - delta);
    if (this.sonicTrapCooldown > 0) this.sonicTrapCooldown = Math.max(0, this.sonicTrapCooldown - delta);

    for (let i = this.activeSonicTraps.length - 1; i >= 0; i--) {
      const trap = this.activeSonicTraps[i];
      trap.timer -= delta;
      trap.core.rotation.y += delta * 6.0;
      const pulse = 1.0 + Math.sin(trap.timer * 14.0) * 3.5;
      trap.waveRing.scale.set(pulse, 1, pulse);

      // Pull nearby Xenomorphs toward the acoustic lure
      if (horde && horde.aliens) {
        for (let j = 0; j < horde.aliens.length; j++) {
          const a = horde.aliens[j];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const d = a.mesh.position.distanceTo(trap.position);
          if (d <= trap.radius && d > 1.2) {
            const pullDir = trap.position.clone().sub(a.mesh.position).normalize();
            a.mesh.position.addScaledVector(pullDir, delta * 9.5);
          }
        }
      }

      if (trap.timer <= 0) {
        if (this.audioEngine && this.audioEngine.playSonicTrapImplosion) {
          this.audioEngine.playSonicTrapImplosion();
        }
        if (particles && particles.emitSparks) {
          particles.emitSparks(trap.position, 22);
        }

        if (horde && horde.aliens) {
          for (let j = horde.aliens.length - 1; j >= 0; j--) {
            const a = horde.aliens[j];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(trap.position) <= 9.5) {
              a.hp -= 520;
              // Acoustic concussion stuns drones only (sub-bosses >= 1500 HP keep their execution threshold intact)
              if (!a.maxHp || a.maxHp < 1500) {
                a.isStunned = true;
                a.stunTimer = Math.max(a.stunTimer || 0, 4.0);
              }
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                horde.spawnAcidPool(a.mesh.position);
                this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(trap.position) <= 10.5) {
            bosses.takeDamage(420, horde);
          }
        }

        this._removeOwnedEffect(trap.mesh);
        this.activeSonicTraps.splice(i, 1);
      }
    }
  }

  /* === CHANTIER 7 (v49.0): Seegson High-Voltage Industrial Bolt Gun ([Shift+3] / Alien: Isolation 2014) === */
  fireSeegsonBoltGun(horde, bosses, synthetics, particles, ui = null) {
    if (!this.canUseArsenalEquipment('seegson_bolt')) return false;
    if (this.seegsonBoltCooldown > 0 || this.seegsonBoltAmmo <= 0) return false;
    this.seegsonBoltCooldown = 1.6;
    this.seegsonBoltAmmo--;

    if (this.audioEngine && this.audioEngine.playSeegsonBoltGunFire) {
      this.audioEngine.playSeegsonBoltGunFire();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.3, 0));

    const range = 38.0;
    const endPos = startPos.clone().addScaledVector(forward, range);
    const wall = this.gameContext?.env?.traceSegment?.(startPos, endPos, { radius: 0.06 });
    // Custom physical colliders may report only the normalized hit fraction.
    const beamLength = wall ? range * Math.max(0, Math.min(1, wall.t)) : range;

    // Incandescent orange-white tungsten spike beam, ending at physical cover.
    if (beamLength > 0) {
      const spikeGeo = new THREE.CylinderGeometry(0.06, 0.06, beamLength, 8);
      spikeGeo.rotateX(Math.PI / 2);
      const spikeMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.95 });
      const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
      spikeMesh.position.copy(startPos).addScaledVector(forward, beamLength / 2);
      spikeMesh.lookAt(endPos);
      this._addOwnedEffect(spikeMesh);

      this.schedule(() => {
        if (spikeMesh.parent) this._removeOwnedEffect(spikeMesh);
      }, 180);
    }

    let hitTarget = false;
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toEnemy = a.mesh.position.clone().sub(this.position);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist <= 38.0) {
          const proj = toEnemy.dot(forward);
          const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
          if (proj > 0 && perpDist <= (a.radius || 1.2) + 0.85) {
            if (!this._canHitLegacyAlien(horde, a, startPos)) continue;
            a.hp -= 680;
            // Cauterizes Ancient Predalien Elder regeneration and bypasses frontal armor!
            a.regenActive = false;
            a.isFrontalShielded = false;
            hitTarget = true;
            if (particles && particles.emitSparks) {
              particles.emitSparks(a.mesh.position, 14);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              if (this.gameContext && !horde?.centralDeathScoring) {
                this.gameContext.comboHits++;
                this.gameContext.score += 240;
              }
            }
            break; // Single ultra-high-impact tungsten bolt
          }
        }
      }
    }

    const boss = bosses?.activeBoss;
    if (!hitTarget && boss?.mesh) {
      const toBoss = boss.mesh.position.clone().sub(this.position);
      toBoss.y = 0;
      if (toBoss.length() <= 38.0 && toBoss.normalize().dot(forward) > 0.86 && this._hasLegacyLineOfSight(boss, startPos)) {
        bosses.takeDamage(680, horde);
        hitTarget = true;
      }
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🔩 SEEGSON BOLT GUN (TUNGSTÈNE HAUTE TENSION) : ${hitTarget ? 'IMPACT CAUTÉRISANT (680 DMG)' : 'TIR À VIDE'} (${this.seegsonBoltAmmo}/10)`);
    }
    return true;
  }

  /* === LUCAS QA AUDIT #4: Tactical Hunter Shadow Dash (I-Frames & Cloaked After-Image) === */
  performHunterShadowDash(particles = null, audio = null) {
    if (this.shadowDashCooldown > 0) return false;
    this.shadowDashCooldown = 1.8;
    this.isShadowDashing = true;
    this.shadowDashTimer = 0.35;
    this.isInvulnerable = true;

    if (audio && audio.playHunterShadowDash) {
      audio.playHunterShadowDash();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    this.position.addScaledVector(forward, 6.5);
    if (this.mesh) this.mesh.position.copy(this.position);

    // Snapshot uses private geometry/skeletons; a shallow mesh.clone would borrow
    // the live actor's skin and GPU buffers and could dispose another actor.
    const snapshot = createHunterHologram(this);
    const afterImage = snapshot.mesh;
    afterImage.position.copy(this.position).addScaledVector(forward, -3);
    this._addOwnedEffect(afterImage, () => snapshot.dispose());

    let op = 0.55;
    const fade = this.scheduleInterval(() => {
      op -= 0.11;
      afterImage.traverse(c => {
        if (c.isMesh && c.material) c.material.opacity = Math.max(0, op);
      });
      if (op <= 0) {
        this.cancelTimer(fade);
        this._removeOwnedEffect(afterImage);
      }
    }, 35);

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position, 12);
    }

    return true;
  }

  /* === CHANTIER 1 (v50.0): Yautja Stealth Infiltration Dropship Carpet-Bombing Protocol ([Shift + J]) === */
  callInfiltrationDropshipBombing(horde, bosses, particles, audio, ui = null) {
    if (!this.canUseArsenalEquipment('dropship_bombing')) return false;
    if (this.dropshipBombingCooldown > 0) return false;
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const startPos = this.position.clone();
    const impacts = Array.from({ length: 6 }, (_, index) => {
      const point = startPos.clone().addScaledVector(forward, (index + 1) * 4.2); point.y = .2; return point;
    });
    if (!impacts.every(point => canAccessLegacyAir(this.missionSupportContext, point, 4.8))) return false;
    this.dropshipBombingCooldown = 28.0;

    if (audio && audio.playYautjaDropshipSwoop) {
      audio.playYautjaDropshipSwoop();
    }

    // Swooping 3D Yautja Stealth Infiltration Dropship
    const dropshipGroup = new THREE.Group();
    const hullMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      emissive: 0x0284c7,
      emissiveIntensity: 0.6,
      metalness: 0.95,
      roughness: 0.1,
      transparent: true,
      opacity: 0.75
    });

    const hull = new THREE.Mesh(new THREE.ConeGeometry(2.4, 7.5, 5), hullMat);
    hull.rotation.x = Math.PI / 2;
    dropshipGroup.add(hull);

    // Delta Wings
    const wingGeo = new THREE.BoxGeometry(8.5, 0.2, 3.2);
    const wings = new THREE.Mesh(wingGeo, hullMat);
    wings.position.set(0, 0, -1.2);
    dropshipGroup.add(wings);

    const shipStart = startPos.clone().sub(forward.clone().multiplyScalar(24.0));
    shipStart.y = 12.0;
    dropshipGroup.position.copy(shipStart);
    dropshipGroup.lookAt(shipStart.clone().add(forward).add(new THREE.Vector3(0, -0.15, 0)));
    this._addOwnedEffect(dropshipGroup);

    // Dropship flyover animation
    let flyDist = 0;
    const flyInterval = this.scheduleInterval(() => {
      flyDist += 3.2;
      dropshipGroup.position.addScaledVector(forward, 3.2);
      dropshipGroup.position.y += Math.sin(flyDist * 0.05) * 0.4;
      if (flyDist >= 68.0) {
        this.cancelTimer(flyInterval);
        this._removeOwnedEffect(dropshipGroup);
      }
    }, 25);

    // Drop 6 plasma cluster bomblets along 25m corridor
    for (let b = 1; b <= 6; b++) {
      this.schedule(() => {
        const bombPos = impacts[b - 1].clone();
        if (!canAccessLegacyAir(this.missionSupportContext, bombPos, 4.8)) return;

        // Plasma napalm fireball explosion
        const fireGeo = new THREE.SphereGeometry(2.4, 12, 12);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.9 });
        const fireMesh = new THREE.Mesh(fireGeo, fireMat);
        fireMesh.position.copy(bombPos);
        this._addOwnedEffect(fireMesh);

        let fScale = 1.0;
        const fInterval = this.scheduleInterval(() => {
          fScale += 0.4;
          fireMesh.scale.set(fScale, fScale, fScale);
          fireMat.opacity -= 0.12;
          if (fireMat.opacity <= 0) {
            this.cancelTimer(fInterval);
            this._removeOwnedEffect(fireMesh);
          }
        }, 30);

        if (particles && particles.emitSparks) particles.emitSparks(bombPos, 22);

        // Persistent 8-second burning plasma napalm patch
        this.activeDropshipBombs.push({
          pos: bombPos.clone(),
          radius: 4.8,
          dps: 180,
          timer: 8.0
        });

        // Instant corridor blast damage
        if (horde && horde.aliens) {
          for (let j = horde.aliens.length - 1; j >= 0; j--) {
            const a = horde.aliens[j];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(bombPos) <= 4.8 && canHitLegacyAirTarget(this.missionSupportContext, a)) {
              a.hp -= 420;
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
                this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(bombPos) <= 5.5 && canHitLegacyAirTarget(this.missionSupportContext, bosses.activeBoss)) {
            bosses.takeDamage(380, horde);
          }
        }
      }, b * 150);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🛸 NAVETTE INFILTRATRICE YAUTJA : RASE-MOTTE & TAPIS DE BOMBES PLASMA (25M) !');
    }
    return true;
  }

  /* === CHANTIER 6 (v50.0): Dual Plasma Casters Concentrated Overcharge Beam ([Shift + RMB / Shift+Space+RMB]) === */
  fireDualPlasmaOverchargeBeam(horde, bosses, synthetics, particles, audio, ui = null) {
    if (!this.canUseArsenalEquipment('dual_caster')) return false;
    if (this.dualPlasmaBeamCooldown > 0 || (this.plasmaEnergy || 0) < 35) return false;
    this.dualPlasmaBeamCooldown = 16.0;
    this.plasmaEnergy = Math.max(0, (this.plasmaEnergy || 100) - 35);
    this.isDualPlasmaBeamActive = true;
    this.dualPlasmaBeamTimer = 3.0;

    if (audio && audio.playDualPlasmaOverchargeBeam) {
      audio.playDualPlasmaOverchargeBeam();
    }

    // Build synchronized twin beam 3D meshes extending from left and right shoulder cannons
    const beamGroup = new THREE.Group();
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.95 });

    [-1.1, 1.1].forEach(bx => {
      const bGeo = new THREE.CylinderGeometry(0.18, 0.24, 38.0, 8);
      bGeo.rotateX(Math.PI / 2);
      const bMesh = new THREE.Mesh(bGeo, beamMat);
      bMesh.position.set(bx, 3.4, 19.0);
      beamGroup.add(bMesh);
    });

    this._addOwnedEffect(beamGroup, null, this.mesh);
    this.dualPlasmaMeshGroup = beamGroup;

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚡ SURCHARGE JUMELÉE DES CANONS PLASMA : RAYON THERMIQUE CONCENTRÉ (920 DMG/S) !');
    }
    return true;
  }

  updateDualPlasmaBeam(delta, horde, bosses, particles) {
    if (this._disposed || !Number.isFinite(delta) || delta <= 0) return;
    const audio = this.audioEngine, ui = this.gameContext?.ui;
    if (this.shadowDashCooldown > 0) this.shadowDashCooldown = Math.max(0, this.shadowDashCooldown - delta);
    if (this.shadowDashTimer > 0) {
      this.shadowDashTimer -= delta;
      if (this.shadowDashTimer <= 0) {
        this.isShadowDashing = false;
        this.isInvulnerable = false;
      }
    }
    if (this.dropshipBombingCooldown > 0) this.dropshipBombingCooldown = Math.max(0, this.dropshipBombingCooldown - delta);
    if (this.dualPlasmaBeamCooldown > 0) this.dualPlasmaBeamCooldown = Math.max(0, this.dualPlasmaBeamCooldown - delta);

    // Update active persistent napalm fire patches
    for (let i = this.activeDropshipBombs.length - 1; i >= 0; i--) {
      const p = this.activeDropshipBombs[i];
      if (!canAccessLegacyAir(this.missionSupportContext, p.pos, p.radius)) { this.activeDropshipBombs.splice(i, 1); continue; }
      p.timer -= delta;
      if (horde && horde.aliens) {
        for (let j = horde.aliens.length - 1; j >= 0; j--) {
          const a = horde.aliens[j];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
          if (!a || a.hp <= 0 || !a.mesh) continue;
          if (a.mesh.position.distanceTo(p.pos) <= p.radius && canHitLegacyAirTarget(this.missionSupportContext, a)) {
            if (!this._canHitLegacyAlien(horde, a, p.pos)) continue;
            a.hp -= p.dps * delta;
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this._defeatLegacyAlien(horde, a, 'legacy_weapon');
            }
          }
        }
      }
      if (p.timer <= 0) this.activeDropshipBombs.splice(i, 1);
    }

    if (this.isDualPlasmaBeamActive) {
      this.dualPlasmaBeamTimer -= delta;
      const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
      const origin = this.position.clone().add(new THREE.Vector3(0, 2.5, 0));

      if (particles && particles.emitSparks) {
        particles.emitSparks(origin.clone().add(forward.clone().multiplyScalar(8.0)), 4);
      }

      // Continuous 920 dmg/s thermal ray
      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const toXeno = a.mesh.position.clone().sub(this.position);
          toXeno.y = 0;
          const dist = toXeno.length();
          if (dist <= 38.0) {
            const proj = toXeno.dot(forward);
            const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
            if (proj > 0 && perpDist <= (a.radius || 1.2) + 1.2) {
              if (!this._canHitLegacyAlien(horde, a, origin)) continue;
              a.hp -= 920 * delta;
              a.isFrontalShielded = false; // Melts frontal shields!
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
                this._defeatLegacyAlien(horde, a, 'legacy_weapon');
              }
            }
          }
        }
      }

      if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
        const toBoss = bosses.activeBoss.mesh.position.clone().sub(this.position);
        toBoss.y = 0;
        if (toBoss.length() <= 38.0 && toBoss.normalize().dot(forward) > 0.82) {
          bosses.takeDamage(920 * delta, horde);
        }
      }

      if (this.dualPlasmaBeamTimer <= 0) {
        this.isDualPlasmaBeamActive = false;
        if (this.dualPlasmaMeshGroup && this.dualPlasmaMeshGroup.parent) {
          this._removeOwnedEffect(this.dualPlasmaMeshGroup);
          this.dualPlasmaMeshGroup = null;
        }
      }
    }

  }

  _updateLegacyStates(delta, horde, bosses, particles) {
    const audio = this.audioEngine, ui = this.gameContext?.ui;
    // === v51.0 Timers (Parry Window & Decoy Beacon) ===
    if (this.parryCooldown > 0) this.parryCooldown -= delta;
    if (this.parryTimer > 0) {
      this.parryTimer -= delta;
      if (this.parryTimer <= 0) {
        this.isParrying = false;
        if (this.parryVisualMesh) this.parryVisualMesh.visible = false;
      }
    }

    if (this.mimicryCooldown > 0) this.mimicryCooldown -= delta;
    if (this.activeDecoyBeacon) {
      this.activeDecoyBeacon.timer -= delta;
      this.activeDecoyBeacon.mesh.rotation.y += 4.0 * delta;
      const s = 1.0 + Math.sin((this._simulationTime * 1000) * 0.012) * 0.25;
      this.activeDecoyBeacon.mesh.scale.set(s, s, s);

      if (this.activeDecoyBeacon.timer <= 0) {
        this._removeOwnedEffect(this.activeDecoyBeacon.mesh);
        this.activeDecoyBeacon = null;
      }
    }

    // === v52.0 CHANTIER 4: Pole Vault Vertical Physics & Crater Slam ===
    if (this.poleVaultCooldown > 0) this.poleVaultCooldown -= delta;
    if (this.isPoleVaulting) {
      this.poleVaultVelocityY -= 48.0 * delta;
      this.position.y += this.poleVaultVelocityY * delta;
      if (this.mesh) this.mesh.position.y = this.position.y;

      if (this.position.y <= 0) {
        this.position.y = 0;
        this.isPoleVaulting = false;
        this.poleVaultVelocityY = 0;
        if (this.mesh) this.mesh.position.y = 0;

        const slamPos = this.position.clone();
        if (audio && audio.playGroundSlamImpact) {
          audio.playGroundSlamImpact();
        }
        if (particles && particles.emitSparks) {
          particles.emitSparks(slamPos, 36);
        }

        const slamRadius = 7.5;
        let killedCount = 0;

        if (horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
          if (!this._canDamageLegacyAlien(horde, a)) continue;
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(slamPos) <= slamRadius) {
              a.hp -= 580;
              a.isStunned = true;
              a.stunTimer = Math.max(a.stunTimer || 0, 2.5);
              const knock = a.mesh.position.clone().sub(slamPos).normalize();
              a.mesh.position.addScaledVector(knock, 6.5);
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                this._defeatLegacyAlien(horde, a, 'legacy_weapon');
                killedCount++;
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(slamPos) <= slamRadius + 1.5) {
            bosses.takeDamage(480, horde);
          }
        }

        if (ui && ui.showAnnouncement) {
          ui.showAnnouncement(`💥 PLONGEON ÉCRASANT AU COMBI-STICK : ONDE SISMIQUE 7.5M (${killedCount} ÉLIMINATIONS, 580 DÉGÂTS) !`);
        }
      }
    }

    // === v53.0 CHANTIERS 3, 4 & 6: Chest Roar Buff, Cyclone Whirl & Cloak Flicker ===
    if (this.chestRoarCooldown > 0) this.chestRoarCooldown -= delta;
    if (this.chestRoarBuffTimer > 0) {
      this.chestRoarBuffTimer -= delta;
      this.attackCooldownFactor = 0.70;
    } else if (this.attackCooldownFactor === 0.70) {
      this.attackCooldownFactor = 1.0;
    }

    if (this.cycloneWhirlCooldown > 0) this.cycloneWhirlCooldown -= delta;
    if (this.cycloneWhirlTimer > 0) {
      this.cycloneWhirlTimer -= delta;
      if (this.mesh) {
        this.mesh.rotation.y += delta * 25.0; // Rapid whirlwind spin visual
      }
      if (this.cycloneWhirlTimer <= 0) {
        this.isCycloneWhirling = false;
      }
    }

    if (this.cloakFlickerTimer > 0) {
      this.cloakFlickerTimer -= delta;
      if (this.mesh) {
        const flicker = Math.sin((this._simulationTime * 1000) * 0.05) > 0;
        this.mesh.visible = flicker;
      }
      if (this.cloakFlickerTimer <= 0 && this.mesh) {
        this.mesh.visible = true;
      }
    }

    // === v54.0 Timers (Smart-Disc Multi-Lock, Burner Cannon, Trophy Chain) ===
    if (this.smartDiscMultiLockCooldown > 0) this.smartDiscMultiLockCooldown -= delta;
    if (this.burnerCooldown > 0) this.burnerCooldown -= delta;
    if (this.trophyChainRattleTimer > 0) this.trophyChainRattleTimer -= delta;

    // === v55.0 Timers (Water Cloak Disruption, Sniper Tri-Laser) ===
    if (this.waterCloakCooldown > 0) this.waterCloakCooldown -= delta;
    if (this.sniperCooldown > 0) this.sniperCooldown -= delta;

    // === v56.0 Level Design Sniping & Telemetry Timers ===
    if (this.orbitalScanTimer > 0) {
      this.orbitalScanTimer -= delta;
      if (this.orbitalScanTimer <= 0) {
        this.critChanceBonus = 0;
      }
    }
    if (this.mudCamouflageTimer > 0) {
      this.mudCamouflageTimer -= delta;
      if (this.mudCamouflageTimer <= 0) {
        this.isMudCamouflaged = false;
      }
    }
    if (this.billyCourageTimer > 0) {
      this.billyCourageTimer -= delta;
      if (this.billyCourageTimer <= 0) {
        this.isBillyCourageActive = false;
      }
    }
    // v60.0 Predator 2 (1990) Buff Timers
    if (this.lightningAuraTimer > 0) {
      this.lightningAuraTimer -= delta;
      if (this.lightningAuraTimer <= 0) this.isLightningAuraActive = false;
    }
    if (this.voodooSightTimer > 0) {
      this.voodooSightTimer -= delta;
      if (this.voodooSightTimer <= 0) this.isVoodooSightActive = false;
    }
    if (this.flintlockKineticBuffTimer > 0) {
      this.flintlockKineticBuffTimer -= delta;
      if (this.flintlockKineticBuffTimer <= 0) this.isFlintlockKineticActive = false;
    }
    if (this.jerryLastStandTimer > 0) {
      this.jerryLastStandTimer -= delta;
      if (this.jerryLastStandTimer <= 0) this.isJerryLastStandActive = false;
    }
    if (this.owlfUltravioletScanTimer > 0) {
      this.owlfUltravioletScanTimer -= delta;
      if (this.owlfUltravioletScanTimer <= 0) this.isOWLFUltravioletActive = false;
    }
    // v61.0 Predators (2010) Game Preserve Buffs
    if (this.hanzoBushidoTimer > 0) {
      this.hanzoBushidoTimer -= delta;
      if (this.hanzoBushidoTimer <= 0) this.isHanzoBushidoActive = false;
    }
    if (this.neurotoxinBladeTimer > 0) {
      this.neurotoxinBladeTimer -= delta;
      if (this.neurotoxinBladeTimer <= 0) this.isNeurotoxinBladeActive = false;
    }
    if (this.masterHunterStalkerTimer > 0) {
      this.masterHunterStalkerTimer -= delta;
      if (this.masterHunterStalkerTimer <= 0) this.isMasterHunterStalkerActive = false;
    }
    // v63.0 The Predator (2018) & Val Verde Master Timers
    if (this.predatorKillerTimer > 0) {
      this.predatorKillerTimer -= delta;
      if (this.predatorKillerTimer <= 0) this.isPredatorKillerNanoActive = false;
    }
    if (this.dillonGritTimer > 0) {
      this.dillonGritTimer -= delta;
      if (this.dillonGritTimer <= 0) this.isDillonGritActive = false;
    }
    if (this.hawkinsScanTimer > 0) {
      this.hawkinsScanTimer -= delta;
      if (this.hawkinsScanTimer <= 0) this.isHawkinsScanActive = false;
    }
    if (this.friendlyLoboTimer > 0) {
      this.friendlyLoboTimer -= delta;
      if (this.friendlyLoboTimer <= 0) this.isFriendlyLoboActive = false;
    }
    if (this.fugitiveAutoAimTimer > 0) {
      this.fugitiveAutoAimTimer -= delta;
      if (this.fugitiveAutoAimTimer <= 0) this.isFugitiveAutoAimActive = false;
    }
    if (this.roryTelemetryTimer > 0) {
      this.roryTelemetryTimer -= delta;
      if (this.roryTelemetryTimer <= 0) this.isRoryTelemetryActive = false;
    }
    if (this.caseyDeconTimer > 0) {
      this.caseyDeconTimer -= delta;
      if (this.caseyDeconTimer <= 0) this.isCaseyDeconActive = false;
    }
    if (this.orangeFlowerTimer > 0) {
      this.orangeFlowerTimer = Math.max(0,this.orangeFlowerTimer-delta);
      if (this.orangeFlowerTimer <= 0) this.isOrangeFlowerActive = false;
    }
    if (this.taabeWarTimer > 0) {
      this.taabeWarTimer = Math.max(0,this.taabeWarTimer-delta);
      if (this.taabeWarTimer <= 0) this.isTaabeWarActive = false;
    }
    if (this.mudCoatedTimer > 0) {
      this.mudCoatedTimer = Math.max(0,this.mudCoatedTimer-delta);
      if (this.mudCoatedTimer <= 0) this.isMudCoated = false;
    }
    if (this.comancheWarPaintTimer > 0) {
      this.comancheWarPaintTimer -= delta;
      if (this.comancheWarPaintTimer <= 0) this.isComancheWarPaintActive = false;
    }
    if (this.feralClawsTimer > 0) {
      this.feralClawsTimer -= delta;
      if (this.feralClawsTimer <= 0) this.isFeralClawsActive = false;
    }
    if (this.ancestralTrackingTimer > 0) {
      this.ancestralTrackingTimer -= delta;
      if (this.ancestralTrackingTimer <= 0) this.isAncestralTrackingActive = false;
    }
    if (this.ursaBerserkTimer > 0) {
      this.ursaBerserkTimer -= delta;
      if (this.ursaBerserkTimer <= 0) this.isUrsaBerserkActive = false;
    }
    if (this.kenjiReflexesTimer > 0) {
      this.kenjiReflexesTimer -= delta;
      if (this.kenjiReflexesTimer <= 0) this.isKenjiReflexesActive = false;
    }
    if (this.torresIncendiaryTimer > 0) {
      this.torresIncendiaryTimer -= delta;
      if (this.torresIncendiaryTimer <= 0) this.isTorresIncendiaryActive = false;
    }
    this.isOnBough = (this.position && this.position.y >= 5.0);
  }

  applyUrsaBerserk(duration = 30.0) {
    this.ursaBerserkTimer = duration;
    this.isUrsaBerserkActive = true;
    this.shield = Math.min(200, (this.shield || 0) + 150);
  }

  applyKenjiReflexes(duration = 30.0) {
    this.kenjiReflexesTimer = duration;
    this.isKenjiReflexesActive = true;
  }

  applyTorresIncendiary(duration = 30.0) {
    this.torresIncendiaryTimer = duration;
    this.isTorresIncendiaryActive = true;
    this.m77GaussAmmo = Math.min(12, (this.m77GaussAmmo || 0) + 6);
  }

  applyFeralClawsBuff(duration = 30.0) {
    this.feralClawsTimer = duration;
    this.isFeralClawsActive = true;
  }

  applyAncestralTrackingBuff(duration = 30.0) {
    this.ancestralTrackingTimer = duration;
    this.isAncestralTrackingActive = true;
  }

  applyComancheWarPaint(duration = 30.0) {
    this.comancheWarPaintTimer = duration;
    this.isComancheWarPaintActive = true;
  }

  applyPreyMudCamouflage(duration = 30.0) {
    if(this._disposed||this.hp<=0||!Number.isFinite(duration)||duration<=0)return false;
    this.mudCoatedTimer = Math.min(30,duration);
    this.isMudCoated = true;
    return true;
  }

  applyOrangeFlowerBuff(duration = 35.0) {
    if(this._disposed||this.hp<=0||!Number.isFinite(duration)||duration<=0)return false;
    this.orangeFlowerTimer = Math.min(35,duration);
    this.isOrangeFlowerActive = true;
    return true;
  }

  applyTaabeWarAgility(duration = 25.0) {
    if(this._disposed||this.hp<=0||!Number.isFinite(duration)||duration<=0)return false;
    this.taabeWarTimer = Math.min(25,duration);
    this.isTaabeWarActive = true;
    return true;
  }

  getThermalSignatureMultiplier() {
    if(this.isOrangeFlowerActive&&this.orangeFlowerTimer>0)return .35;
    if(this.isMudCoated&&this.mudCoatedTimer>0)return .6;
    return 1;
  }

  applyFriendlyLobo(duration = 35.0) {
    this.friendlyLoboTimer = duration;
    this.isFriendlyLoboActive = true;
  }

  applyFugitiveAutoAim(duration = 30.0) {
    this.fugitiveAutoAimTimer = duration;
    this.isFugitiveAutoAimActive = true;
  }

  applyRoryStarMapTelemetry(duration = 30.0) {
    this.roryTelemetryTimer = duration;
    this.isRoryTelemetryActive = true;
  }

  applyCaseyDeconBuff(duration = 35.0) {
    this.caseyDeconTimer = duration;
    this.isCaseyDeconActive = true;
    this.hp = Math.min(this.maxHp || 100, (this.hp || 0) + 75);
    this.shield = Math.min(200, (this.shield || 0) + 100);
  }

  applyPredatorKillerNano(duration = 30.0) {
    this.predatorKillerTimer = duration;
    this.isPredatorKillerNanoActive = true;
    this.shield = Math.min(200, (this.shield || 0) + 100);
  }

  applyDillonGrit(duration = 30.0) {
    this.dillonGritTimer = duration;
    this.isDillonGritActive = true;
  }

  applyHawkinsScan(duration = 35.0) {
    this.hawkinsScanTimer = duration;
    this.isHawkinsScanActive = true;
  }

  applyMasterHunterStalker(duration = 22.0) {
    this.masterHunterStalkerTimer = duration;
    this.isMasterHunterStalkerActive = true;
  }

  applyHanzoBushido(duration = 35.0) {
    this.hanzoBushidoTimer = duration;
    this.isHanzoBushidoActive = true;
  }

  applyNeurotoxinBlade(duration = 30.0) {
    this.neurotoxinBladeTimer = duration;
    this.isNeurotoxinBladeActive = true;
  }

  applyJerryLastStand(duration = 30.0) {
    this.jerryLastStandTimer = duration;
    this.isJerryLastStandActive = true;
  }

  applyOWLFUltravioletScan(duration = 40.0) {
    this.owlfUltravioletScanTimer = duration;
    this.isOWLFUltravioletActive = true;
  }

  applyLightningAura(duration = 20.0) {
    this.lightningAuraTimer = duration;
    this.isLightningAuraActive = true;
  }

  applyVoodooSight(duration = 35.0) {
    this.voodooSightTimer = duration;
    this.isVoodooSightActive = true;
  }

  applyFlintlockKineticBuff(duration = 30.0) {
    this.flintlockKineticBuffTimer = duration;
    this.isFlintlockKineticActive = true;
  }

  applyBillyCourage(duration = 30.0) {
    this.billyCourageTimer = duration;
    this.isBillyCourageActive = true;
  }

  applyMudCamouflage(duration = 25.0) {
    this.mudCamouflageTimer = duration;
    this.isMudCamouflaged = true;
  }

  unlockClassic1987Plasma() {
    this.hasClassic1987Plasma = true;
    this.plasmaChargeMultiplier = 0.70;
  }

  /* === CHANTIER 1 (v51.0): Clan Weapon Forge Persistent Upgrades === */
  loadClanForgeUpgrades() {
    const keys = ['barbedCombiStick', 'serratedSmartDisc', 'overchargedCoil', 'masterWristblades', 'enkiduBattleplate',
      'burnerPlasmaCoil', 'cauterizingWristblade', 'ceramicThermalArmor', 'dlexTargetingHUD'];
    const current = this.forgeUpgrades ?? {};
    const upgrades = Object.fromEntries(keys.map(key => [key, Object.hasOwn(current, key) && current[key] === true]));
    try {
      const saved = typeof localStorage === 'undefined' ? null : localStorage.getItem('yautja_clan_forge');
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
          for (const key of keys) if (Object.hasOwn(parsed, key) && parsed[key] === true) upgrades[key] = true;
        }
      }
    } catch (e) {
      console.warn('Failed to load forge upgrades:', e);
    }
    // The honor debit is committed before the separate clan slot. Its receipt
    // restores a paid upgrade when the second write failed, without charging again.
    const ledger = this.gameContext?.forge?.honorLedger;
    const state = ledger?.getSnapshot?.();
    if (state?.recoveryRequired === false && state.readOnly === false) {
      for (const key of keys) {
        const id = `clan-forge:${key}`;
        const receipt = Object.hasOwn(ledger.transactions, id) ? ledger.transactions[id] : null;
        if (receipt?.kind === 'clan-upgrade' && Number.isSafeInteger(receipt.amount) && receipt.amount < 0) upgrades[key] = true;
      }
    }
    this.forgeUpgrades = upgrades;
    if (upgrades.masterWristblades) this.parryWindowDuration = 0.58;
    if (upgrades.enkiduBattleplate) {
      // Reopening the forge or recovering a save must preserve other HP bonuses.
      if (!this.hasEnkiduArmor) this.maxHp += 250;
      this.hasEnkiduArmor = true;
      this.acidResistance = 0.40;
      this.gauntletCooldownReduction = 0.80;
    }
    if (upgrades.burnerPlasmaCoil) this.hasBurnerCoil = true;
    if (upgrades.cauterizingWristblade) this.hasCauterizingWristblade = true;
    if (upgrades.ceramicThermalArmor) this.hasCeramicThermalArmor = true;
    if (upgrades.dlexTargetingHUD) this.hasDlexTargetingHUD = true;
  }

  /* === CHANTIER 4 & LUCAS QA (v51.0): Dedicated Wristblade Parry Action [F] (AVP 2010 / Hunting Grounds) === */
  performWristbladeParry(audioEngine, particles, ui) {
    if (this.parryCooldown > 0) return false;

    this.isParrying = true;
    this.parryTimer = (this.forgeUpgrades && this.forgeUpgrades.masterWristblades) ? 0.58 : 0.42;
    this.parryCooldown = 1.1;

    if (audioEngine && audioEngine.playWristbladeClash) {
      audioEngine.playWristbladeClash();
    } else if (audioEngine && audioEngine.playShieldBlock) {
      audioEngine.playShieldBlock();
    }

    if (!this.parryVisualMesh) {
      const arcGeo = new THREE.RingGeometry(0.8, 1.4, 16, 1, 0, Math.PI);
      const arcMat = new THREE.MeshBasicMaterial({
        color: 0x00e5ff,
        side: THREE.DoubleSide,
        transparent: true,
        opacity: 0.8
      });
      this.parryVisualMesh = new THREE.Mesh(arcGeo, arcMat);
      this.parryVisualMesh.rotation.x = Math.PI / 2;
      this.parryVisualMesh.position.set(0, 1.6, 1.1);
      this.mesh.add(this.parryVisualMesh);
    } else {
      this.parryVisualMesh.visible = true;
    }

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.6, 1.0)), 14);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚔️ PARADE DLEX ACTIVE [F] : DÉVIEZ L\'ATTAQUE ENNEMIE !');
    }
    return true;
  }

  /* === CHANTIER 5 & ELENA QA (v51.0): Yautja Vocal Mimicry Decoy System [Y] (Predator 1987) === */
  triggerVoiceMimicryDecoy(horde, audioEngine, ui, particles) {
    if (this.mimicryCooldown > 0) return false;
    this.mimicryCooldown = 14.0;

    if (audioEngine && audioEngine.playYautjaMimicryPlayback) {
      audioEngine.playYautjaMimicryPlayback();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY));
    const decoyPos = this.position.clone().addScaledVector(forward, 7.0);

    const beaconGeo = new THREE.OctahedronGeometry(0.7, 1);
    const beaconMat = new THREE.MeshBasicMaterial({
      color: 0x38bdf8,
      wireframe: true,
      transparent: true,
      opacity: 0.85
    });
    const beaconMesh = new THREE.Mesh(beaconGeo, beaconMat);
    beaconMesh.position.copy(decoyPos);
    beaconMesh.position.y = 1.0;
    this._addOwnedEffect(beaconMesh);

    this.activeDecoyBeacon = {
      mesh: beaconMesh,
      pos: decoyPos,
      timer: 5.5
    };

    if (particles && particles.emitSparks) {
      particles.emitSparks(decoyPos, 16);
    }

    if (horde && horde.aliens) {
      let divertedCount = 0;
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (!a || a.hp <= 0 || a.isBoss || a.isOfficer) return;
        if (a.mesh && a.mesh.position.distanceTo(decoyPos) <= 24.0) {
          a.decoyTarget = decoyPos.clone();
          a.decoyTimer = 5.5;
          divertedCount++;
        }
      });
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('📻 LEURRE VOCAL YAUTJA DÉPLOYÉ [Y] : ESSAIMS ENTRAÎNÉS DANS LE PIÈGE !');
    }
    return true;
  }

  /* === CHANTIER 4 & LUCAS QA (v52.0): Combi-Stick Pole Vault Leap & Crater Slam Drop [Shift + Space] === */
  performCombistickPoleVault(horde, bosses, audio, particles, ui) {
    if (!this.canUseArsenalEquipment('combistick')) return false;
    if (this.poleVaultCooldown > 0 || this.isPoleVaulting) return false;
    this.poleVaultCooldown = 6.0;
    this.isPoleVaulting = true;
    this.poleVaultVelocityY = 22.0;

    if (audio && audio.playPredatorCombistickVault) {
      audio.playPredatorCombistickVault();
    } else if (audio && audio.playIaijutsuSlice) {
      audio.playIaijutsuSlice();
    }

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position, 18);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🔱 SAUT À LA PERCHE COMBI-STICK : PROPULSION AÉRIENNE 9M !');
    }
    return true;
  }

  /* === CHANTIER 4 & LUCAS QA (v53.0): Predator Chest-Thumping Martial Challenge Roar [H] === */
  performPredatorChestThumpRoar(horde, bosses, synthetics, audio, particles, ui) {
    if (this.chestRoarCooldown > 0 || this.isFacehuggerLatched) return false;
    this.chestRoarCooldown = 18.0 * (this.gauntletCooldownReduction || 1.0);
    this.chestRoarBuffTimer = 8.0;

    if (audio && audio.playPredatorChestThumpRoar) {
      audio.playPredatorChestThumpRoar();
    } else if (audio && audio.playWarhornBlast) {
      audio.playWarhornBlast();
    }

    if (particles && particles.emitGoldRageSparks) {
      particles.emitGoldRageSparks(this.position, 28);
    }

    // Stun normal xenos in 14m radius for 2.2 seconds
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a && a.mesh && a.mesh.position.distanceTo(this.position) <= 14.0) {
          if (!a.isOfficer && a.type !== 'crusher' && a.type !== 'praetorian') {
            a.isStunned = true;
            a.stunTimer = Math.max(a.stunTimer || 0, 2.2);
          }
        }
      });
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🔥 RUGISSEMENT DE DÉFI PECTORAL YAUTJA [H] : HORDE PÉTRIFIÉE (2.2S) & FUREUR MARTIALE (+30% CADENCE) !');
    }
    return true;
  }

  /* === CHANTIER 3 & LUCAS QA (v53.0): Combi-Stick 360° Cyclone Whirlblade Attack === */
  performCombistickCycloneWhirl(horde, bosses, synthetics, audio, particles, ui) {
    if (!this.canUseArsenalEquipment('combistick')) return false;
    if (this.cycloneWhirlCooldown > 0 || this.isFacehuggerLatched) return false;
    this.cycloneWhirlCooldown = 5.0 * (this.gauntletCooldownReduction || 1.0);
    this.isCycloneWhirling = true;
    this.cycloneWhirlTimer = 0.45;

    if (audio && audio.playCombistickCycloneWhirl) {
      audio.playCombistickCycloneWhirl();
    } else if (audio && audio.playIaijutsuSlice) {
      audio.playIaijutsuSlice();
    }

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position, 22);
    }

    const attack = {
      origin: this.position,
      radius: 5.5,
      damage: 420,
      type: 'combistick',
      knockback: 12.0
    };

    if (horde) {
      horde.checkMeleeHits(attack);
      horde.aliens.forEach(a => {
        if (!this._canDamageLegacyAlien(horde, a)) return;
        if (a && a.mesh && a.mesh.position.distanceTo(this.position) <= 5.5) {
          const push = a.mesh.position.clone().sub(this.position).setY(0).normalize().multiplyScalar(10.0);
          a.mesh.position.add(push);
        }
      });
      if (horde.mantaSwarmers) {
        horde.mantaSwarmers.forEach(m => {
          if (m && m.mesh && m.mesh.position.distanceTo(this.position) <= 6.5) {
            m.hp -= 420;
          }
        });
      }
    }

    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh.position.distanceTo(this.position) <= 5.5) {
      bosses.takeDamage(420);
    }
    if (synthetics) {
      synthetics.checkHits(attack);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🌀 MOULINET CYCLONE COMBI-STICK 360° : BALAYAGE DÉVASTATEUR (420 DÉGÂTS, 5.5M) !');
    }
    return true;
  }

  /* === CHANTIER 6 (v53.0): Optical Cloak Electromagnetic Flicker Feedback === */
  triggerCloakFlicker(audio, particles) {
    if (!this.isCloaked) return;
    this.cloakFlickerTimer = 0.85;
    if (audio && audio.playOpticalCloakFlickerEMP) {
      audio.playOpticalCloakFlickerEMP();
    }
    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position, 8);
    }
  }

  /* === CHANTIER 1 & ELENA QA (v54.0): Blooded Warrior Sacred Acid Mark Ritual (AVP 2004) === */
  triggerSacredBloodMarkRitual(audio, particles, ui) {
    if (this.isBloodedWarrior) return;
    this.isBloodedWarrior = true;
    this.bloodedDamageResistance = 0.85; // 15% passive damage reduction

    if (audio && audio.playAcidBrandingSizzle) {
      audio.playAcidBrandingSizzle();
    }

    if (particles && particles.emitAcidSmoke) {
      particles.emitAcidSmoke(this.position.clone().add(new THREE.Vector3(0, 3.4, 0.4)), 18);
    }

    // Attach neon green glowing sacred blood mark decal on bio-mask cranium
    if (this.headMesh && !this.bloodMarkMesh) {
      const markGeo = new THREE.PlaneGeometry(0.24, 0.28);
      const markMat = new THREE.MeshBasicMaterial({
        color: 0x22c55e,
        transparent: true,
        opacity: 0.9,
        side: THREE.DoubleSide
      });
      this.bloodMarkMesh = new THREE.Mesh(markGeo, markMat);
      this.bloodMarkMesh.position.set(0, 0.22, 0.58);
      this.headMesh.add(this.bloodMarkMesh);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('👑 RITUEL SACRÉ DU GUERRIER INITIÉ ("BLOODED") : RUNE GRAVÉE AU FER ET AU SANG (-15% DÉGÂTS SUBIS) !');
    }
  }

  /* === CHANTIER 2 & LUCAS QA (v54.0): Smart-Disc Multi-Target Lock Ricochet Trajectory === */
  performSmartDiscMultiLock(horde, bosses, synthetics, audio, particles, ui) {
    if (!this.canUseArsenalEquipment('smart_disc')) return false;
    if (this.smartDiscMultiLockCooldown > 0 || this.isFacehuggerLatched) return false;
    this.smartDiscMultiLockCooldown = 8.0 * (this.gauntletCooldownReduction || 1.0);

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const targets = [];

    // Find up to 5 valid targets in front of player within 32m
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const toBoss = bosses.activeBoss.mesh.position.clone().sub(this.position);
      if (toBoss.length() <= 32.0 && forward.dot(toBoss.clone().normalize()) > 0.25) {
        targets.push(bosses.activeBoss);
      }
    }

    if (horde && horde.aliens) {
      for (let a of horde.aliens) {
        if (!this._canDamageLegacyAlien(horde, a)) continue;
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toAlien = a.mesh.position.clone().sub(this.position);
        if (toAlien.length() <= 32.0 && forward.dot(toAlien.clone().normalize()) > 0.25) {
          targets.push(a);
          if (targets.length >= 5) break;
        }
      }
    }

    if (targets.length === 0) {
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('⚠️ SMART-DISC MULTI-CIBLES : AUCUNE PROIE DANS L\'ARC DE VERROUILLAGE (32M) !');
      }
      return false;
    }

    if (audio && audio.playSmartDiscTargetLockSweep) {
      audio.playSmartDiscTargetLockSweep();
    }

    let totalHits = 0;
    targets.forEach((tgt, idx) => {
      this.schedule(() => {
        const tgtPos = tgt.mesh ? tgt.mesh.position.clone() : tgt.position.clone();
        if (tgt.takeDamage) {
          tgt.takeDamage(380);
        } else {
          tgt.hp -= 380;
        }
        totalHits++;

        if (audio && audio.playShurikenSlice) {
          audio.playShurikenSlice();
        }
        if (particles && particles.emitSparks) {
          particles.emitSparks(tgtPos, 16);
        }
        if (horde && horde.goreEngine && horde.goreEngine.spawnDismemberment) {
          horde.goreEngine.spawnDismemberment(tgtPos, 'smart_disc');
        }
      }, idx * 90);
    });

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`🥏 SMART-DISC RICOCHET MULTI-CIBLES : ${targets.length} PROIES VERROUILLÉES & DÉCAPITÉES EN CHAÎNE !`);
    }
    return true;
  }

  /* === CHANTIER 7 (v54.0): Burner Heavy Concentrated Plasma Cannon Blast (Aliens: Genocide) === */
  fireBurnerHeavyPlasma(horde, bosses, synthetics, particles, audio, ui) {
    if (!this.canUseArsenalEquipment('burner_rifle')) return false;
    if (this.burnerCooldown > 0 || (this.plasmaEnergy || 0) < 30 || this.isFacehuggerLatched) return false;
    this.burnerCooldown = 3.5 * (this.gauntletCooldownReduction || 1.0);
    this.plasmaEnergy = Math.max(0, (this.plasmaEnergy || 100) - 30);

    if (audio && audio.playBurnerHeavyPlasmaBlast) {
      audio.playBurnerHeavyPlasmaBlast();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const impactPos = this.position.clone().addScaledVector(forward, 16.0);
    impactPos.y = 0.5;

    if (particles && particles.emitExplosion) {
      particles.emitExplosion(impactPos, 32);
    }
    if (particles && particles.spawnPlasmaScorch) {
      particles.spawnPlasmaScorch(impactPos);
    }

    const blastRadius = this.hasBurnerCoil ? 6.2 : 4.5;
    const directDmg = 680;
    const splashDmg = 340;

    if (horde) {
      horde.checkMeleeHits({ origin: impactPos, radius: blastRadius, damage: directDmg, type: 'plasma' });
    }
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh.position.distanceTo(impactPos) <= blastRadius + 1.5) {
      bosses.takeDamage(directDmg);
    }
    if (synthetics) {
      synthetics.checkHits({ origin: impactPos, radius: blastRadius, damage: splashDmg });
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('🔥 CANON BURNER LOURD DÉCHARGÉ : CONFLAGRATION THERMIQUE DE MASSE (680 DMG) !');
    }
    return true;
  }

  /* === CHANTIER 8 (v54.0): Trophy Chain Reactive Bone Chime === */
  triggerTrophyChainRattle(audio) {
    if (this.trophyChainRattleTimer > 0) return;
    this.trophyChainRattleTimer = 1.2;
    if (audio && audio.playTrophyChainRattle) {
      audio.playTrophyChainRattle();
    }
  }

  /* === CHANTIER 1 & ELENA QA (v55.0): Water Cloaking Disruption & Electrical Short-Circuit === */
  triggerWaterCloakDisruption(audio, particles, ui) {
    if (this.waterCloakCooldown > 0) return;
    this.waterCloakCooldown = 2.0;

    if (this.isCloaked) {
      this.isCloaked = false;
      this.cloakFlickerTimer = 1.2;

      if (audio && audio.playWaterCloakShortCircuit) {
        audio.playWaterCloakShortCircuit();
      }
      if (particles && particles.emitSparks) {
        particles.emitSparks(this.position.clone().add(new THREE.Vector3(0, 1.2, 0)), 28);
      }

      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement("⚡ IMMERSION AQUATIQUE : CAMOUFLAGE COURT-CIRCUITÉ PAR L'EAU (PREDATOR 1987) !", "warning");
      }
    }
  }

  /* === CHANTIER 5 & LUCAS QA (v55.0): Sniper Plasma Tri-Laser Focus Mode ([Z] / [Clic Molette]) === */
  toggleSniperPlasmaMode(camera, audio, ui) {
    if (!this.canUseArsenalEquipment('plasma_caster')) return false;
    this.isSniperMode = !this.isSniperMode;

    if (camera) {
      camera.fov = this.isSniperMode ? 32 : 60;
      camera.updateProjectionMatrix();
    }

    if (this.isSniperMode) {
      if (audio && audio.playSniperPlasmaTriLaserHum) {
        audio.playSniperPlasmaTriLaserHum();
      }
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎯 MODE SNIPER TRI-LASER ACTIVÉ : ZOOM LONGUE PORTÉE & LANCE PLASMA PERFORANTE !');
      }
    } else {
      if (ui && ui.showAnnouncement) {
        ui.showAnnouncement('🎯 MODE SNIPER DÉSACTIVÉ : CHAMP DE VISION STANDARD RESTAURÉ');
      }
    }

    const reticle = globalThis.document?.getElementById('tri-laser-sniper-reticle');
    if (reticle) {
      if (this.isSniperMode) {
        reticle.classList.remove('hidden');
      } else {
        reticle.classList.add('hidden');
      }
    }

    return this.isSniperMode;
  }

  fireSniperPlasmaLance(horde, bosses, synthetics, particles, audio, ui) {
    if (!this.canUseArsenalEquipment('plasma_caster')) return false;
    if (this.sniperCooldown > 0) return false;
    if (this.plasmaEnergy < 35) {
      if (ui && ui.showAnnouncement) ui.showAnnouncement('❌ ÉNERGIE PLASMA INSUFFISANTE POUR LE TIR SNIPER (35 REQUIS) !');
      return false;
    }

    this.plasmaEnergy -= 35;
    this.sniperCooldown = 3.8;

    if (audio) {
      if (audio.playBurnerHeavyPlasmaBlast) audio.playBurnerHeavyPlasmaBlast();
      if (audio.playSniperPlasmaTriLaserHum) audio.playSniperPlasmaTriLaserHum();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const range = 42.0;
    const lanceDamage = 1200;

    // Direct linear piercing beam
    const beamStart = this.position.clone().add(new THREE.Vector3(0, 1.8, 0));
    const beamEnd = beamStart.clone().addScaledVector(forward, range);

    if (particles && particles.emitExplosion) {
      particles.emitExplosion(beamEnd, 24);
    }
    if (particles && particles.emitSparks) {
      for (let step = 1; step <= 8; step++) {
        const p = beamStart.clone().addScaledVector(forward, step * 5.0);
        particles.emitSparks(p, 6);
      }
    }

    let hitsCount = 0;

    // Check piercing hits against horde along line
    if (horde && horde.aliens) {
      horde.aliens.forEach(alien => {
        if (!this._canDamageLegacyAlien(horde, alien)) return;
        if (alien && alien.mesh) {
          const toAlien = alien.mesh.position.clone().sub(beamStart);
          const projDist = toAlien.dot(forward);
          if (projDist > 0 && projDist <= range) {
            const perp = toAlien.clone().subScaledVector(forward, projDist);
            if (perp.length() <= 1.8) {
              if (!this._canHitLegacyAlien(horde, alien, null)) return;
              alien.hp -= lanceDamage;
              hitsCount++;
              if (particles && particles.emitAlienBloodSpurt) {
                particles.emitAlienBloodSpurt(alien.mesh.position, 16);
              }
            }
          }
        }
      });
    }

    // Check piercing hit on boss
    if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const toBoss = bosses.activeBoss.mesh.position.clone().sub(beamStart);
      const projDist = toBoss.dot(forward);
      if (projDist > 0 && projDist <= range) {
        const perp = toBoss.clone().subScaledVector(forward, projDist);
        if (perp.length() <= 3.2) {
          bosses.takeDamage(lanceDamage);
          hitsCount++;
        }
      }
    }

    // Check piercing hit on synthetics
    if (synthetics && synthetics.androids) {
      synthetics.androids.forEach(syn => {
        if (syn && syn.mesh) {
          const toSyn = syn.mesh.position.clone().sub(beamStart);
          const projDist = toSyn.dot(forward);
          if (projDist > 0 && projDist <= range) {
            const perp = toSyn.clone().subScaledVector(forward, projDist);
            if (perp.length() <= 1.8) {
              syn.hp -= lanceDamage;
              hitsCount++;
            }
          }
        }
      });
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`⚡ LANCE PLASMA SNIPER PERFORANTE : ${hitsCount} CIBLES TRANSPERCÉES (1200 DÉGÂTS CRITIQUES) !`);
    }

    return true;
  }
}
