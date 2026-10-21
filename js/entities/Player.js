/* Playable Yautja 3D Mesh Generator & State Controller (Primordial 1:1 Lore Edition) */

import * as THREE from 'three';

export class Player {
  constructor(scene, charData, audioEngine, isPlayer2 = false, particles = null) {
    this.scene = scene;
    this.data = charData;
    this.audioEngine = audioEngine;
    this.isPlayer2 = isPlayer2;
    this.particles = particles;

    // Stats
    this.hp = charData.stats.hp;
    this.maxHp = charData.stats.maxHp;
    this.moveSpeed = charData.stats.moveSpeed;
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
    this.scene.add(this.mesh);

    this.laserColorHex = isPlayer2 ? 0xffaa00 : 0xff0000;
    this.laserGroup = this.buildLaserSight(this.laserColorHex);
    this.mesh.add(this.laserGroup);

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

    this.forgeUpgrades = {
      barbedCombiStick: false,
      serratedSmartDisc: false,
      overchargedCoil: false,
      masterWristblades: false,
      enkiduBattleplate: false,
      burnerPlasmaCoil: false,
      cauterizingWristblade: false
    };
    this.loadClanForgeUpgrades();
  }

  applyTacticalLoadout(loadout) {
    if (!loadout) return;
    this.tacticalLoadout = loadout;

    // 1. Primary Weapon Perks
    if (loadout.primary === 'wristblades') {
      this.meleeDamage *= 1.15;
      this.attackCooldownFactor = 0.82; // Faster slicing recovery
    } else if (loadout.primary === 'combistick') {
      this.meleeReachMultiplier = 1.35;
      this.meleeDamage *= 1.25;
    } else if (loadout.primary === 'katana') {
      this.moveSpeed *= 1.18;
      this.meleeArcMultiplier = 1.35;
    } else if (loadout.primary === 'alpha_sickle') {
      this.meleeDamage *= 1.38;
      this.dismembermentBoost = 1.5;
    }

    // 2. Secondary Weapon Perks
    if (loadout.secondary === 'smart_disc') {
      this.smartDiscSpeedMult = 1.3;
    } else if (loadout.secondary === 'shuriken') {
      this.shurikenPierceBonus = 4;
    } else if (loadout.secondary === 'compound_bow') {
      this.bowDamageMult = 1.4;
    } else if (loadout.secondary === 'plasma_whip') {
      this.whipStunDuration = 2.5;
    }

    // 3. Gadgets Perks
    if (loadout.gadgets && Array.isArray(loadout.gadgets)) {
      if (loadout.gadgets.includes('medicomp')) {
        this.medicompCharges += 2; // Total 5 charges
        this.medicompHealAmount = 550;
      }
      if (loadout.gadgets.includes('bear_trap')) {
        this.bearTrapCharges = (this.bearTrapCharges || 2) + 2;
      }
      if (loadout.gadgets.includes('acid_solvent')) {
        this.acidSolventCharges += 3; // Total 5 charges
      }
      if (loadout.gadgets.includes('nuke')) {
        this.nukeBlastBonus = true;
      }
    }
  }

  buildYautjaMesh() {
    const group = new THREE.Group();
    const colors = this.data.colors;

    const skinMat = new THREE.MeshStandardMaterial({ color: colors.skin, roughness: 0.6, metalness: 0.1 });
    const armorMat = new THREE.MeshStandardMaterial({ color: colors.armor, metalness: 0.8, roughness: 0.3 });
    const maskMat = new THREE.MeshStandardMaterial({ color: colors.mask, metalness: 0.9, roughness: 0.2 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.6, 2.2, 8), skinMat);
    torso.position.y = 2.2;
    group.add(torso);

    const chestArmor = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.2, 1.2), armorMat);
    chestArmor.position.y = 2.4;
    group.add(chestArmor);

    // Bio-Mask Head
    this.headMesh = new THREE.Mesh(new THREE.SphereGeometry(0.65, 12, 12), maskMat);
    this.headMesh.position.set(0, 3.6, 0.1);
    group.add(this.headMesh);

    // Clan Acid Mark Glyph on Forehead (AVP 2004 Lore - lightning bolt)
    const clanMarkGeo = new THREE.PlaneGeometry(0.25, 0.35);
    const clanMarkMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, side: THREE.DoubleSide });
    this.clanMarkMesh = new THREE.Mesh(clanMarkGeo, clanMarkMat);
    this.clanMarkMesh.position.set(0, 3.8, 0.68);
    this.clanMarkMesh.visible = false;
    group.add(this.clanMarkMesh);

    const dreadMat = new THREE.MeshStandardMaterial({ color: colors.dreads, roughness: 0.9 });
    for (let i = -4; i <= 4; i++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.04, 1.4, 6), dreadMat);
      const angle = (i / 4) * Math.PI * 0.5;
      dread.position.set(Math.sin(angle) * 0.5, 3.4, -0.4 - Math.cos(angle) * 0.2);
      dread.rotation.x = -0.3;
      dread.rotation.z = angle * 0.5;
      group.add(dread);
    }

    const plasmaGeo = new THREE.CylinderGeometry(0.12, 0.15, 0.8, 8);
    const leftCannon = new THREE.Mesh(plasmaGeo, armorMat);
    leftCannon.rotation.x = Math.PI / 2;
    leftCannon.position.set(-1.1, 3.4, 0.2);
    group.add(leftCannon);

    const rightCannon = new THREE.Mesh(plasmaGeo, armorMat);
    rightCannon.rotation.x = Math.PI / 2;
    rightCannon.position.set(1.1, 3.4, 0.2);
    group.add(rightCannon);

    const armGeo = new THREE.CylinderGeometry(0.28, 0.22, 1.6, 8);
    this.leftArm = new THREE.Mesh(armGeo, skinMat);
    this.leftArm.position.set(-1.2, 2.2, 0);
    group.add(this.leftArm);

    this.rightArm = new THREE.Mesh(armGeo, skinMat);
    this.rightArm.position.set(1.2, 2.2, 0);
    group.add(this.rightArm);

    // Left Forearm: Feral Biometric Expanding Bone Fan Shield (Prey 2022 Canon 1:1)
    const shieldGroup = new THREE.Group();
    const shieldMat = new THREE.MeshStandardMaterial({ color: 0x3d3024, roughness: 0.4, metalness: 0.75 });
    const shieldRimMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff, side: THREE.DoubleSide });

    // Central biometric hexagonal boss plate
    const centerPlate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.09, 6), shieldMat);
    shieldGroup.add(centerPlate);

    // 6 Interlocking fan-folding osteo-plates
    for (let f = 0; f < 6; f++) {
      const angle = (f / 6) * Math.PI * 2;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.8, 0.06, 0.4), shieldMat);
      blade.position.set(Math.cos(angle) * 0.7, 0, Math.sin(angle) * 0.7);
      blade.rotation.y = angle;
      shieldGroup.add(blade);
    }

    // Glowing cyan plasma cutting edge perimeter rim
    const energyRim = new THREE.Mesh(new THREE.RingGeometry(1.2, 1.3, 6), shieldRimMat);
    energyRim.rotation.x = Math.PI / 2;
    shieldGroup.add(energyRim);

    shieldGroup.position.set(-0.2, -0.2, 0.6);
    shieldGroup.rotation.x = Math.PI / 2;
    shieldGroup.visible = false;
    this.shieldMesh = shieldGroup;
    this.leftArm.add(this.shieldMesh);

    const rightGauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.8, 0.5), armorMat);
    rightGauntlet.position.set(1.2, 1.8, 0);
    group.add(rightGauntlet);

    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xdddddd, metalness: 0.95, roughness: 0.1 });
    // Dual parallel extensible wristblades (1:1 Canon Predator 1987)
    this.blade1 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.02), bladeMat);
    this.blade1.position.set(1.23, 1.8, 0.8);
    this.blade1.rotation.x = Math.PI / 2;
    group.add(this.blade1);

    this.blade2 = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.4, 0.02), bladeMat);
    this.blade2.position.set(1.37, 1.8, 0.8);
    this.blade2.rotation.x = Math.PI / 2;
    group.add(this.blade2);

    this.secWeaponMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.6, 0.6, 0.05, 12), bladeMat);
    this.secWeaponMesh.position.set(-1.2, 1.8, 0.6);
    this.secWeaponMesh.visible = false;
    group.add(this.secWeaponMesh);

    // Dual-Bladed Plasma Glaive / Naginata (AVP Clan Patriarch / Concrete Jungle Lore)
    const glaiveGroup = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x3d3124, roughness: 0.5, metalness: 0.85 });
    const plasmaBladeMat = new THREE.MeshStandardMaterial({
      color: 0x00ffff,
      emissive: 0x00d2ff,
      emissiveIntensity: 1.2,
      roughness: 0.1,
      metalness: 0.95
    });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 3.4, 8), shaftMat);
    glaiveGroup.add(shaft);

    const bladeTop = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.22), plasmaBladeMat);
    bladeTop.position.y = 1.9;
    glaiveGroup.add(bladeTop);

    const bladeBottom = new THREE.Mesh(new THREE.BoxGeometry(0.06, 1.2, 0.22), plasmaBladeMat);
    bladeBottom.position.y = -1.9;
    glaiveGroup.add(bladeBottom);

    // Energy rings around center grip
    const ringGeo = new THREE.TorusGeometry(0.09, 0.02, 6, 16);
    const ring1 = new THREE.Mesh(ringGeo, plasmaBladeMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.4;
    glaiveGroup.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, plasmaBladeMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.4;
    glaiveGroup.add(ring2);

    glaiveGroup.position.set(1.4, 1.8, 0.4);
    glaiveGroup.rotation.x = Math.PI / 2;
    glaiveGroup.visible = false;
    group.add(glaiveGroup);
    this.plasmaGlaiveMesh = glaiveGroup;

    const legGeo = new THREE.CylinderGeometry(0.35, 0.25, 1.8, 8);
    this.leftLeg = new THREE.Mesh(legGeo, skinMat);
    this.leftLeg.position.set(-0.5, 0.9, 0);
    group.add(this.leftLeg);

    this.rightLeg = new THREE.Mesh(legGeo, skinMat);
    this.rightLeg.position.set(0.5, 0.9, 0);
    group.add(this.rightLeg);

    this.skinMaterials = [skinMat];
    this.armorMaterials = [armorMat, maskMat];

    // Chantier 4 (v46): Yautja Cyber-Hunt Bionic Exosuit Magnetic Forcefield & Cage
    const exosuitGroup = new THREE.Group();
    const exoMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, wireframe: true, transparent: true, opacity: 0.65 });
    const exoPlates = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.0, 3.8, 8, 4, true), exoMat);
    exoPlates.position.y = 2.0;
    exosuitGroup.add(exoPlates);
    exosuitGroup.visible = false;
    group.add(exosuitGroup);
    this.exosuitMesh = exosuitGroup;

    return group;
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
      const localTarget = this.mesh.worldToLocal(worldTargetPos.clone());
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
    if (this.combiStickCooldown > 0 || this.isFacehuggerLatched) return null;
    this.combiStickCooldown = 3.5;
    this.audioEngine.playCombiStickThrow();

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.35 : 0,
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
    if (this.shurikenCooldown > 0 || this.isFacehuggerLatched) return null;
    this.shurikenCooldown = 4.0;
    this.audioEngine.playShurikenOpen();

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.2 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.0, 0)).addScaledVector(forward, 1.2);

    return {
      startPos: startPos,
      direction: forward,
      speed: 42,
      damage: 550,
      maxRange: 32,
      radius: 3.2
    };
  }

  triggerPowerGloveSlam(horde, synthetics, bosses) {
    if (this.powerGloveCooldown > 0 || this.isFacehuggerLatched) return false;
    this.powerGloveCooldown = 6.0;

    this.audioEngine.playPowerGloveSlam();

    // Visual ground slam punch animation
    this.rightArm.rotation.x = -Math.PI * 0.85;
    this.position.y = 0;
    setTimeout(() => {
      this.rightArm.rotation.x = 0;
    }, 450);

    const slamAttack = { origin: this.position, radius: 12.0, damage: 450, type: 'heavy' };

    // 1. Pulverize Xenomorphs in 12m radius & knock back
    if (horde) {
      horde.checkMeleeHits(slamAttack);
      horde.aliens.forEach(a => {
        if (a.mesh.position.distanceTo(this.position) <= 12.0) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 7.5);
          a.mesh.position.y = 2.5; // Lifted into air
          setTimeout(() => { a.mesh.position.y = 0; }, 320);
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
    if (this.spineWhipCooldown > 0 || this.isFacehuggerLatched) return false;
    this.spineWhipCooldown = 3.5;

    this.audioEngine.playSpineWhipCrack();

    // Visual whip lash sweep
    this.leftArm.rotation.x = -Math.PI * 0.5;
    this.leftArm.rotation.y = -Math.PI * 0.4;
    setTimeout(() => {
      this.leftArm.rotation.x = 0;
      this.leftArm.rotation.y = 0;
    }, 380);

    const whipAttack = { origin: this.position, radius: 10.5, damage: 420, type: 'spine_whip' };

    // 1. Slash and reel in Xenomorphs
    if (horde) {
      horde.checkMeleeHits(whipAttack);
      horde.aliens.forEach(a => {
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
      // Perch high atop canopy/pillars (12 meters above arena)
      this.position.y = 12.0;
      this.audioEngine.playSlash();
    } else {
      // Dive assassination plunge!
      this.position.y = 0;
      this.audioEngine.playPounceImpact();
    }
    this.mesh.position.copy(this.position);
    return this.isPerched;
  }

  toggleShieldBlock() {
    this.isBlocking = !this.isBlocking;
    if (this.shieldMesh) {
      this.shieldMesh.visible = this.isBlocking;
      if (this.isBlocking) {
        this.shieldMesh.scale.set(0.2, 0.2, 0.2);
        let s = 0.2;
        const expandAnim = setInterval(() => {
          s += 0.25;
          if (this.shieldMesh) this.shieldMesh.scale.set(s, s, s);
          if (s >= 1.0) clearInterval(expandAnim);
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
      this.leftArm.position.x = -1.2;
    }
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
    this.audioEngine.playSmartDiscHum();
    const origin = this.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    // Multi-target forward scan for automated chain homing waypoints (Predator 2 Canon)
    const targets = [];
    if (horde && horde.aliens) {
      const candidates = horde.aliens
        .filter(a => a.hp > 0 && a.mesh.position.distanceTo(origin) <= 32.0)
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
      damage: 340,
      speed: 42
    };
  }

  /* Chantier 3: Trax-Net Micro-Beacon Dart Gun (AVP 2 / Concrete Jungle Lore) */
  fireTraxNetDart(horde, synthetics, bosses) {
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
    this.audioEngine.playNetgunLaunch();
    const origin = this.position.clone().add(new THREE.Vector3(0.5, 2.0, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    // Multi-target forward cone scan (up to 3 targets within 24m)
    const targets = [];
    const minAngle = Math.PI / 2.8;

    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
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

        // Chantier 6: Yautja Netgun Wall-Pinning & Diamond-Wire Guillotine Tension (Predator 2 Canon)
        if (target.mesh && (Math.abs(target.mesh.position.x) >= 63 || Math.abs(target.mesh.position.z) >= 63 || target.mesh.position.distanceTo(new THREE.Vector3(0, 0, 0)) >= 64)) {
          target.isPinned = true;
          target.pinTimer = 6.0;
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
        this.scene.add(netGroup);

        // Wire tightening animation interval
        let netLife = 4.5;
        const netAnim = setInterval(() => {
          netLife -= 0.1;
          if (target.mesh && target.isNetEntangled) {
            netGroup.position.copy(target.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
            netGroup.scale.multiplyScalar(0.995); // Visible constriction tension
          }
          if (netLife <= 0 || !target.isNetEntangled) {
            clearInterval(netAnim);
            this.scene.remove(netGroup);
          }
        }, 100);
      });

      return true;
    }

    return false;
  }

  triggerGauntletEMP(horde, synthetics) {
    if (this.empCooldown > 0) return false;
    this.empCooldown = 12.0; // 12 second cooldown
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
        if (a.mesh.position.distanceTo(this.position) <= empRadius) {
          a.hp -= 75;
          a.speed = Math.max(2, a.speed * 0.3); // Severe nerve disruption
          setTimeout(() => {
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
    this.scene.add(shockwaveMesh);

    let scale = 1.0;
    const expandAnim = setInterval(() => {
      scale += 2.2;
      shockwaveMesh.scale.set(scale, scale, scale);
      shockwaveMesh.material.opacity -= 0.08;
      if (shockwaveMesh.material.opacity <= 0 || scale >= empRadius) {
        clearInterval(expandAnim);
        this.scene.remove(shockwaveMesh);
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
      if (a.mesh.position.distanceTo(lurePoint) < 30) {
        a.mesh.position.addScaledVector(lurePoint.clone().sub(a.mesh.position).normalize(), 4.0);
        // Momentary disorientation
        a.speed = Math.max(3, a.speed * 0.5);
        setTimeout(() => {
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

  executeSpineRip() {
    this.audioEngine.playSpineRip();
    this.audioEngine.playYautjaRoar();
    this.brandClanMark();

    const spineGroup = new THREE.Group();
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xddddcc, roughness: 0.5 });
    const bloodMat = new THREE.MeshBasicMaterial({ color: 0x880000 });

    const skull = new THREE.Mesh(new THREE.SphereGeometry(0.35, 8, 8), boneMat);
    skull.position.y = 1.6;
    spineGroup.add(skull);

    for (let v = 0; v < 8; v++) {
      const vert = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.08, 0.18, 6), v % 2 === 0 ? boneMat : bloodMat);
      vert.position.y = 1.4 - v * 0.2;
      spineGroup.add(vert);
    }

    this.rightArm.add(spineGroup);
    this.rightArm.rotation.x = -Math.PI * 0.8;

    setTimeout(() => {
      this.rightArm.remove(spineGroup);
      this.rightArm.rotation.x = 0;
    }, 3500);

    return true;
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
    const trapAttack = { origin: this.position, radius: 10, damage: 350 };
    const hits = horde.checkMeleeHits(trapAttack);
    this.audioEngine.playSkullSnap();
    return hits.length > 0;
  }

  useMedicomp() {
    if (this.medicompCharges <= 0) return false;
    this.medicompCharges--;
    this.hp = Math.min(this.maxHp, this.hp + (this.medicompHealAmount || 450));
    this.visorAcidBurn = 0; // Medical bio-gel instantly neutralizes acid corrosion
    this.audioEngine.playMedicompCauterize();
    return true;
  }

  inflictVisorAcidBurn() {
    if (this.isBlocking || this.isPerched) return;
    this.visorAcidBurn = 1.0;
    if (this.audioEngine) {
      this.audioEngine.playVisorAcidBurn();
    }
  }

  useAcidSolvent(horde) {
    if (this.acidSolventCharges <= 0) return false;
    this.acidSolventCharges--;
    horde.acidPools.forEach(pool => horde.scene.remove(pool.mesh));
    horde.acidPools = [];
    this.audioEngine.playAcidSizzle();
    return true;
  }

  triggerFlechetteVolley(targetEnemy = null) {
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
    setTimeout(() => {
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
    if (this.compoundBowCooldown > 0 || this.isFacehuggerLatched) return null;
    this.compoundBowCooldown = 4.2;

    this.audioEngine.playCompoundBowFire();

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const origin = this.position.clone().add(new THREE.Vector3(0, 2.2, 0));

    return {
      origin,
      direction: forward,
      speed: 62,
      damage: 520,
      pierceRemaining: 5,
      life: 2.2
    };
  }

  deployHoloDecoy(scene) {
    if (this.holoDecoyCooldown > 0 || this.isFacehuggerLatched) return null;
    this.holoDecoyCooldown = 16.0;

    this.audioEngine.playHoloDecoyDeploy();

    // Create Holographic Cyan Translucent Clone Mesh
    const decoyGroup = new THREE.Group();
    decoyGroup.position.copy(this.position);
    decoyGroup.rotation.y = this.rotationY;

    const holoMat = new THREE.MeshBasicMaterial({
      color: 0x00ffff,
      transparent: true,
      opacity: 0.6,
      wireframe: true
    });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.45, 1.9, 8), holoMat);
    torso.position.y = 1.9;
    decoyGroup.add(torso);

    const head = new THREE.Mesh(new THREE.SphereGeometry(0.5, 8, 8), holoMat);
    head.position.set(0, 3.2, 0);
    decoyGroup.add(head);

    scene.add(decoyGroup);

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    return {
      mesh: decoyGroup,
      direction: forward,
      speed: 7.5,
      life: 6.0,
      detonated: false
    };
  }

  triggerNukeSelfDestruct() {
    this.audioEngine.playPredatorLaughCountdown();

    // 3D Holographic Yautja Glyphs Ring over left gauntlet (1987 canon)
    if (!this.wristNukeHoloMesh && this.leftArm) {
      const holoGroup = new THREE.Group();
      const ringGeo = new THREE.TorusGeometry(0.55, 0.03, 8, 24);
      const ringMat = new THREE.MeshBasicMaterial({ color: 0xff0033, wireframe: true, transparent: true, opacity: 0.85 });
      const ringMesh = new THREE.Mesh(ringGeo, ringMat);
      ringMesh.rotation.x = Math.PI / 2;
      holoGroup.add(ringMesh);

      // 3 Glowing Yautja glyph prisms
      for (let g = 0; g < 3; g++) {
        const glyph = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.25, 3), new THREE.MeshBasicMaterial({ color: 0xff1144 }));
        const angle = (g / 3) * Math.PI * 2;
        glyph.position.set(Math.cos(angle) * 0.45, 0.08, Math.sin(angle) * 0.45);
        holoGroup.add(glyph);
      }
      holoGroup.position.set(0, -0.6, 0.35);
      this.leftArm.add(holoGroup);
      this.wristNukeHoloMesh = holoGroup;
    }

    return { damage: 10000, radius: 60 };
  }

  clearNukeHoloMesh() {
    if (this.wristNukeHoloMesh && this.leftArm) {
      this.leftArm.remove(this.wristNukeHoloMesh);
      this.wristNukeHoloMesh = null;
    }
  }

  triggerHybridMetamorphosis() {
    if (this.isHybridMutated) return;
    this.isHybridMutated = true;
    this.mesh.scale.set(1.8, 1.8, 1.8);
    this.meleeDamage *= 2.0;

    this.audioEngine.playYautjaRoar();

    setTimeout(() => {
      this.isHybridMutated = false;
      this.mesh.scale.set(1.0, 1.0, 1.0);
      this.meleeDamage /= 2.0;
    }, 15000);
  }

  triggerPlasmaGlaive(horde, synthetics, bosses) {
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
    this.scene.add(arcMesh);

    let fadeTimer = 0.25;
    const fadeAnim = setInterval(() => {
      fadeTimer -= 0.05;
      arcMesh.material.opacity = fadeTimer / 0.25;
      if (fadeTimer <= 0) {
        clearInterval(fadeAnim);
        this.scene.remove(arcMesh);
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

    this.scene.add(group);

    // Levitate and suspend Xenomorphs within 12.0m radius
    const radius = 12.0;
    if (horde && horde.aliens) {
      horde.aliens.forEach(a => {
        if (a.hp > 0 && a.mesh.position.distanceTo(this.position) <= radius) {
          a.isAirborne = true;
          a.airborneVelY = 4.2; // Float up!
          a.speed *= 0.2; // Severely slowed
        }
      });
    }

    let duration = 4.5;
    const interval = setInterval(() => {
      duration -= 0.1;
      coreMesh.rotation.y += 0.25;
      ringMesh.rotation.z += 0.15;
      const pulse = 1.0 + Math.sin(duration * 10) * 0.25;
      coreMesh.scale.set(pulse, pulse, pulse);

      if (duration <= 0) {
        clearInterval(interval);
        this.scene.remove(group);
      }
    }, 100);

    if (particles) {
      particles.emitSparks(pos, 25);
    }
    return true;
  }

  consumeRoyalJelly() {
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

  toggleWeaponSwap() {
    this.isSecondaryWeapon = !this.isSecondaryWeapon;
    this.secWeaponMesh.visible = this.isSecondaryWeapon;
    this.blade1.visible = !this.isSecondaryWeapon;
    if (this.blade2) this.blade2.visible = !this.isSecondaryWeapon;
    this.audioEngine.playWeaponSwap();
    return this.isSecondaryWeapon;
  }

  toggleCloak() {
    this.isCloaked = !this.isCloaked;
    const opacity = this.isCloaked ? 0.22 : 1.0;
    const transparent = this.isCloaked;

    this.skinMaterials.forEach(m => {
      m.transparent = transparent;
      m.opacity = opacity;
      if (this.isCloaked) {
        m.roughness = 0.1;
        m.metalness = 0.95;
      } else {
        m.roughness = 0.7;
        m.metalness = 0.1;
      }
    });

    this.armorMaterials.forEach(m => {
      m.transparent = transparent;
      m.opacity = opacity;
      if (this.isCloaked) {
        m.roughness = 0.05;
        m.metalness = 0.98;
      } else {
        m.roughness = 0.3;
        m.metalness = 0.8;
      }
    });

    return this.isCloaked;
  }

  move(dir, delta) {
    if (this.isFacehuggerLatched || this.isPerched || this.isMountedSmartgun) return;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      let speedMult = (this.warhornBuffTimer > 0 ? 1.4 : 1.0) * (this.isBerserkerActive ? 1.45 : 1.0);
      if (this.isExosuitActive) speedMult *= 1.25;
      if (this.isSyntheticAnkleGrabbed) speedMult *= 0.2;
      const moveDistance = this.moveSpeed * speedMult * delta;
      this.position.addScaledVector(dir, moveDistance);

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * 12 * delta;

      const stride = Math.sin(Date.now() * 0.015) * 0.5;
      this.leftLeg.rotation.x = stride;
      this.rightLeg.rotation.x = -stride;
    } else {
      this.leftLeg.rotation.x *= 0.8;
      this.rightLeg.rotation.x *= 0.8;
    }

    // Verticality: Adjust elevation smoothly when traversing catwalks and ramps
    if (!this.isLeaping && !this.isPerched) {
      let groundY = 0;
      if (window.gameInstance && window.gameInstance.env && window.gameInstance.env.getElevationAt) {
        groundY = window.gameInstance.env.getElevationAt(this.position.x, this.position.z);
      }
      this.position.y = THREE.MathUtils.lerp(this.position.y, groundY, 18 * delta);
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
  }

  lightAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;
    this.attackComboStep = (this.attackComboStep % 5) + 1;
    this.attackTimer = 0.28 * (this.attackCooldownFactor || 1.0);
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

    const baseDmg = this.isSecondaryWeapon ? this.meleeDamage * 1.3 : this.meleeDamage;
    const buff = (this.warhornBuffTimer > 0 ? 1.5 : 1.0) * (this.isBerserkerActive ? 2.0 : 1.0);

    return {
      type: 'light',
      step: this.attackComboStep,
      damage: baseDmg * (1 + this.attackComboStep * 0.18) * buff,
      radius: (this.isSecondaryWeapon ? 4.8 : 3.8) * (this.meleeReachMultiplier || 1.0),
      angle: (Math.PI * 0.65) * (this.meleeArcMultiplier || 1.0)
    };
  }

  heavyAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;

    const step = this.attackComboStep;
    const baseDmg = this.isSecondaryWeapon ? this.meleeDamage * 1.3 : this.meleeDamage;
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

    // Reset combo string after any Charge finisher
    this.attackComboStep = 0;
    this.comboResetTimer = 0;
    this.currentChargeName = chargeName;
    this.attackTimer *= (this.attackCooldownFactor || 1.0);
    radius *= (this.meleeReachMultiplier || 1.0);

    return {
      type: chargeType,
      name: chargeName,
      damage: baseDmg * dmgMult * buff,
      radius: radius,
      knockback: knockback,
      isLauncher: isLauncher,
      launchVelY: launchVelY,
      isStun: isStun,
      stunDuration: stunDuration,
      angle: Math.PI * 2
    };
  }

  firePlasmaShot(isCharged = false) {
    const energyCost = isCharged ? 35 : this.data.stats.plasmaEnergyCost;
    if (this.plasmaEnergy < energyCost || this.isFacehuggerLatched) return null;
    this.plasmaEnergy -= energyCost;

    this.audioEngine.playPlasmaShot();
    if (isCharged && this.audioEngine.playC6CataclysmBoom) {
      this.audioEngine.playC6CataclysmBoom();
    }

    const origin = this.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.4 : 0, // Aim downwards when perched!
      Math.cos(this.rotationY)
    ).normalize();

    return {
      position: origin,
      direction: forward,
      damage: isCharged ? this.plasmaDamage * 3.4 : this.plasmaDamage,
      speed: isCharged ? 52 : 45,
      isCharged: isCharged
    };
  }

  triggerMusouOverload() {
    if (this.musouEnergy < 100 || this.isFacehuggerLatched) return false;
    this.musouEnergy = 0;
    this.isMusouActive = true;

    this.audioEngine.playMusouBlast();

    setTimeout(() => {
      this.isMusouActive = false;
    }, 2000);

    return true;
  }

  takeDamage(amount, isAcid = false, attacker = null) {
    // Chantier 4 & Lucas QA (v51.0): Dedicated Active Wristblade Parry Deflection [F]
    if (this.isParrying && this.parryTimer > 0) {
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

      if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
        window.gameInstance.ui.showAnnouncement('⚔️ PARADE DLEX PARFAITE [F] ! CONTRE-RIPOSTE ÉCLAIR (x4 DÉGÂTS CRITIQUES) !');
      }
      return this.hp;
    }

    if (this.isBlocking || this.isPerched) {
      if (this.parryTimer > 0) {
        // Chantier 2: PERFECT PARRY DEFLECTION (Prey 2022 / Concrete Jungle Canon 1:1)
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

        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🛡️ PARRY PARFAIT ! RIPOSTE GUAN-THWEI DISPONIBLE [CLIC GAUCHE] !');
        }
        return this.hp;
      }

      this.audioEngine.playShieldBlock();
      return this.hp;
    }
    if (this.isWhirlShieldActive) {
      amount *= 0.10; // 90% frontal damage deflection (Aliens: Fireteam Elite rotary naginata spin)
      if (this.particles) this.particles.emitSparks(this.position, 12);
      if (this.audioEngine && this.audioEngine.playPlasmaGlaiveWhirl) {
        this.audioEngine.playPlasmaGlaiveWhirl();
      }
    }
    if (this.isPlasmaGlaiveActive) {
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
    // Chantier 1 & Elena QA (v54.0): Blooded Warrior Sacred Mark 15% Damage Reduction
    if (this.isBloodedWarrior) {
      amount *= (this.bloodedDamageResistance || 0.85);
    }
    this.hp = Math.max(0, this.hp - amount);

    if (isAcid && !this.isBerserkerActive) {
      this.inflictVisorAcidBurn();
    }

    // Luminescent neon green Yautja bio-blood splatter
    if (this.particles && amount > 2) {
      this.particles.emitYautjaPhosphorBlood(this.position, Math.min(20, Math.floor(amount * 0.4)));
    }

    return this.hp;
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
    this.scene.add(waveMesh);

    let fade = 0.25;
    const fAnim = setInterval(() => {
      fade -= 0.05;
      waveMesh.scale.multiplyScalar(1.08);
      waveMesh.material.opacity = fade / 0.25;
      if (fade <= 0) {
        clearInterval(fAnim);
        this.scene.remove(waveMesh);
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

  update(delta, horde = null) {
    if (this.visorAcidBurn > 0) {
      this.visorAcidBurn = Math.max(0, this.visorAcidBurn - delta * 0.35);
    }

    if (this.wristNukeHoloMesh) {
      this.wristNukeHoloMesh.rotation.y += delta * 4.5;
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
        if (window.gameInstance && window.gameInstance.ui && window.gameInstance.ui.showAnnouncement) {
          window.gameInstance.ui.showAnnouncement('🦾 EXOSQUELETTE BIONIQUE DÉSACTIVÉ : RECHARGE COMMENCÉE (45S).');
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
      if (window.gameInstance && window.gameInstance.env && window.gameInstance.env.getElevationAt) {
        groundY = window.gameInstance.env.getElevationAt(this.position.x, this.position.z);
      }

      const grav = 36 * (this.gravityMultiplier !== undefined ? this.gravityMultiplier : 1.0);
      this.leapVelocityY -= grav * delta;
      this.position.y += this.leapVelocityY * delta;

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

    if (this.plasmaEnergy < this.maxPlasmaEnergy) {
      this.plasmaEnergy = Math.min(this.maxPlasmaEnergy, this.plasmaEnergy + 15 * delta);
    }

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
    this.updateTripwireMines(delta, horde, synthetics, window.gameInstance ? window.gameInstance.particles : null);
  }

  /* =========================================================================
     v43.0 APEX WEAPON SYSTEMS (Prey / AVP 2 / Predator 2 Canon)
     ========================================================================= */

  /* Chantier 9: Yautja Thermal Plasma Mine / Proximity Tri-Beam Tripwire */
  deployTripwireMine(scene, particles) {
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

    scene.add(group);
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

        if (window.gameInstance && window.gameInstance.triggerCameraShake) {
          window.gameInstance.triggerCameraShake(0.7, 0.3);
        }

        if (window.gameInstance && window.gameInstance.ui) {
          window.gameInstance.ui.showAnnouncement('💥 MINE TRIPWIRE PLASMA YAUTJA DÉTONÉE : DÉFLAGRATION 550 DÉGÂTS !');
        }

        window.gameInstance.renderer.scene.remove(mine.group);
        this.tripwireMines.splice(i, 1);
      }
    }
  }

  /* Chantier 3: Smart-Disc Remote Laser Guidance & Telemetric Hover (Predator 2 / AVP 2010) */
  startSmartDiscRemoteGuidance(disc) {
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

  /* Chantier 7: Yautja Burner / Incinerator Plasma Flamer Mode (AvP Lore / Dark Horse Canon 1:1) */
  togglePlasmaFlamer() {
    this.isFlamerActive = !this.isFlamerActive;
    if (this.isFlamerActive && this.audioEngine && this.audioEngine.playPlasmaFlamerStream) {
      this.audioEngine.playPlasmaFlamerStream();
    }
    return this.isFlamerActive;
  }

  firePlasmaFlamer(delta, horde, environment, particles) {
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
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.4 : 0,
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
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toAlien = a.mesh.position.clone().sub(origin);
        const dist = toAlien.length();
        if (dist <= 8.5) {
          toAlien.normalize();
          const dot = forward.dot(toAlien);
          if (dot > 0.62) {
            a.hp -= 110.0 * delta;
            // Catch fire effect: spark spurts
            if (particles && particles.emitSparks && Math.random() < 0.25) {
              particles.emitSparks(a.mesh.position, 4);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.comboHits++;
                window.gameInstance.score += 75;
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
          if (swarm.group.position.distanceTo(origin) <= 7.5) {
            swarm.hp -= 250.0 * delta; // Super-effective against micro swarms!
            if (swarm.hp <= 0) {
              swarm.isDead = true;
              this.scene.remove(swarm.group);
              horde.microSwarms.splice(s, 1);
              if (window.gameInstance && window.gameInstance.ui) {
                window.gameInstance.ui.showAnnouncement('🔥 ESSAIM DE MICRO-XÉNOS INCINÉRÉ PAR LE BRÛLEUR PLASMA !');
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
    if (this.plasmaEnergy < 12 || this.plasmaPistolCooldown > 0) return false;

    this.plasmaEnergy -= 12;
    this.plasmaPistolCooldown = 0.42;

    if (this.audioEngine && this.audioEngine.playPlasmaPistolBurst) {
      this.audioEngine.playPlasmaPistolBurst();
    }

    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.35 : 0,
      Math.cos(this.rotationY)
    ).normalize();

    const origin = this.position.clone().add(new THREE.Vector3(0.4, 1.8, 0.3));

    // Emit 3 rapid ionized azure/violet plasma burst sparks
    for (let b = 0; b < 3; b++) {
      setTimeout(() => {
        const boltOrigin = origin.clone().addScaledVector(forward, 1.5 + b * 0.4);
        if (particles && particles.emitSparks) {
          particles.emitSparks(boltOrigin, 5);
        }

        // Raycast hit check along trajectory
        let hitTarget = false;
        const boltPos = origin.clone().addScaledVector(forward, 24.0);

        // Check boss hit
        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          const bossDist = bosses.activeBoss.mesh.position.distanceTo(origin);
          if (bossDist <= 28.0) {
            const toBoss = bosses.activeBoss.mesh.position.clone().sub(origin).normalize();
            if (forward.dot(toBoss) > 0.88) {
              const isCrit = Math.random() < 0.45;
              const dmg = 95 * (isCrit ? 3.0 : 1.0);
              bosses.takeDamage(dmg, horde);
              hitTarget = true;
              if (particles && particles.emitSparks) particles.emitSparks(bosses.activeBoss.mesh.position, 8);
              if (isCrit && window.gameInstance && window.gameInstance.ui) {
                window.gameInstance.ui.showAnnouncement('💥 TIR CRITIQUE PISTOLET PLASMA (AVP-R) : 285 DÉGÂTS D\'ÉNERGIE PURE !');
              }
            }
          }
        }

        // Check horde hits
        if (!hitTarget && horde && horde.aliens) {
          for (let i = horde.aliens.length - 1; i >= 0; i--) {
            const a = horde.aliens[i];
            if (!a || a.hp <= 0 || !a.mesh) continue;
            const toAlien = a.mesh.position.clone().sub(origin);
            const dist = toAlien.length();
            if (dist <= 26.0) {
              toAlien.normalize();
              if (forward.dot(toAlien) > 0.88) {
                const isCrit = Math.random() < 0.5;
                const dmg = 95 * (isCrit ? 3.0 : 1.0);
                a.hp -= dmg;
                hitTarget = true;

                if (particles && particles.emitSparks) particles.emitSparks(a.mesh.position, 6);

                if (a.hp <= 0) {
                  if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                  horde.spawnAcidPool(a.mesh.position);
                  this.scene.remove(a.mesh);
                  horde.aliens.splice(i, 1);
                  horde.deadCount++;
                  if (window.gameInstance) {
                    window.gameInstance.comboHits++;
                    window.gameInstance.score += 85;
                  }
                }
                break;
              }
            }
          }
        }

        // Trigger electric floor grid if bolt lands on it
        if (environment && environment.checkElectricGridInteraction) {
          environment.checkElectricGridInteraction(boltPos, this, window.gameInstance ? window.gameInstance.ui : null, this.audioEngine, particles, horde);
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

    setTimeout(() => {
      // Seismic slam into floor
      targetAlien.mesh.position.y = 0;
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
        this.scene.remove(targetAlien.mesh);
        const idx = horde.aliens.indexOf(targetAlien);
        if (idx !== -1) horde.aliens.splice(idx, 1);
        horde.deadCount++;
        if (window.gameInstance) {
          window.gameInstance.comboHits += 2;
          window.gameInstance.score += 200;
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
    if (this.exosuitCooldown > 0) return false;

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

    setTimeout(() => {
      const slamCenter = this.position.clone();
      const radius = 10.5;

      // Heavy Radial Shockwave (350 dmg, 3s stun, massive pushback)
      if (horde && horde.aliens) {
        for (let i = horde.aliens.length - 1; i >= 0; i--) {
          const a = horde.aliens[i];
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
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.comboHits += 2;
                window.gameInstance.score += 150;
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
    this.scene.add(cloudMesh);

    let gasLife = 8.0;
    const gasInterval = setInterval(() => {
      gasLife -= 0.5;
      cloudMesh.scale.multiplyScalar(1.02);
      cloudMat.opacity = Math.max(0.05, cloudMat.opacity - 0.02);

      // Slow down and damage Xenomorphs in cloud
      if (horde && horde.aliens) {
        horde.aliens.forEach(a => {
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
        clearInterval(gasInterval);
        this.scene.remove(cloudMesh);
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
    const spinAnim = setInterval(() => {
      spin += 0.55;
      this.mesh.rotation.y += 0.55;
      if (spin >= Math.PI * 2) {
        clearInterval(spinAnim);
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
    this.scene.add(ringMesh);

    let scale = 1.0;
    const ringInterval = setInterval(() => {
      scale += 0.45;
      ringMesh.scale.set(scale, 1, scale);
      ringMesh.material.opacity -= 0.12;
      if (ringMesh.material.opacity <= 0) {
        clearInterval(ringInterval);
        this.scene.remove(ringMesh);
      }
    }, 25);

    const cleaveRadius = 5.5 * (this.meleeReachMultiplier || 1.0);
    const cleaveDmg = 380;

    // Cleave all Xenomorphs within 360° reach
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
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
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
            if (window.gameInstance) {
              window.gameInstance.comboHits = (window.gameInstance.comboHits || 0) + 1;
              window.gameInstance.score += 150;
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
    this.scene.add(gMesh);

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
        this.scene.remove(g.mesh);
        this.activeM41AGrenades.splice(i, 1);

        if (this.audioEngine && this.audioEngine.playHeavySlamImpact) {
          this.audioEngine.playHeavySlamImpact();
        }

        // Explosive blast fireball mesh
        const fbGeo = new THREE.SphereGeometry(1.6, 12, 12);
        const fbMat = new THREE.MeshBasicMaterial({ color: 0xf97316, transparent: true, opacity: 0.85, wireframe: true });
        const fbMesh = new THREE.Mesh(fbGeo, fbMat);
        fbMesh.position.copy(detPos);
        this.scene.add(fbMesh);

        let fbScale = 1.0;
        const fbInterval = setInterval(() => {
          fbScale += 0.6;
          fbMesh.scale.set(fbScale, fbScale, fbScale);
          fbMesh.material.opacity -= 0.14;
          if (fbMesh.material.opacity <= 0) {
            clearInterval(fbInterval);
            this.scene.remove(fbMesh);
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
                this.scene.remove(al.mesh);
                horde.aliens.splice(j, 1);
                horde.deadCount++;
                if (window.gameInstance) {
                  window.gameInstance.comboHits = (window.gameInstance.comboHits || 0) + 1;
                  window.gameInstance.score += 180;
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

    this.scene.add(beamGroup);

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
      this.scene.add(slag);
      setTimeout(() => this.scene.remove(slag), 4500);
    }

    // Incinerate Xenomorphs within 3.2m radius (850 thermal dmg/s)
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        if (a.mesh.position.distanceTo(beam.pos) <= 3.4) {
          a.hp -= 850 * delta;
          if (particles && particles.emitSparks && Math.random() < 0.35) {
            particles.emitSparks(a.mesh.position, 5);
          }
          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
            if (window.gameInstance) {
              window.gameInstance.comboHits++;
              window.gameInstance.score += 180;
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
      this.scene.remove(beam.group);
      this.activeScoutBeam = null;
    }
  }

  /* === CHANTIER 3 (v48): USCM M77 Gauss / Railgun Hypersonic Rifle (Aliens: Colonial Marines / Dark Horse) === */
  fireM77GaussRifle(horde, bosses, synthetics, environment, particles, ui = null) {
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

    this.scene.add(railGroup);
    setTimeout(() => this.scene.remove(railGroup), 220);

    // Pierce up to 15 enemies in a 45m line (550 armor-piercing damage, ignores 100% ballistic armor)
    let piercedCount = 0;
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        if (piercedCount >= 15) break;
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toEnemy = a.mesh.position.clone().sub(this.position);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist <= 45.0) {
          const proj = toEnemy.dot(forward);
          const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
          if (proj > 0 && perpDist <= (a.radius || 1.2) + 0.95) {
            a.hp -= 550;
            piercedCount++;
            if (particles && particles.emitSparks) {
              particles.emitSparks(a.mesh.position, 8);
            }
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
              horde.spawnAcidPool(a.mesh.position);
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.comboHits++;
                window.gameInstance.score += 190;
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
    this.scene.add(maulGroup);

    let ringScale = 1.0;
    const ringInterval = setInterval(() => {
      ringScale += 0.75;
      ringMesh.scale.set(ringScale, 1, ringScale);
      ringMat.opacity -= 0.09;
      if (ringMat.opacity <= 0) {
        clearInterval(ringInterval);
        this.scene.remove(maulGroup);
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
          setTimeout(() => {
            if (a && a.mesh && !a.isFlying) a.mesh.position.y = 0;
          }, 320);
          hitCount++;

          if (a.hp <= 0) {
            if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
            horde.spawnAcidPool(a.mesh.position);
            this.scene.remove(a.mesh);
            horde.aliens.splice(i, 1);
            horde.deadCount++;
            if (window.gameInstance) {
              window.gameInstance.comboHits++;
              window.gameInstance.score += 210;
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
    this.scene.add(trapGroup);

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
                this.scene.remove(a.mesh);
                horde.aliens.splice(j, 1);
                horde.deadCount++;
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(trap.position) <= 10.5) {
            bosses.takeDamage(420, horde);
          }
        }

        this.scene.remove(trap.mesh);
        this.activeSonicTraps.splice(i, 1);
      }
    }
  }

  /* === CHANTIER 7 (v49.0): Seegson High-Voltage Industrial Bolt Gun ([Shift+3] / Alien: Isolation 2014) === */
  fireSeegsonBoltGun(horde, bosses, synthetics, particles, ui = null) {
    if (this.seegsonBoltCooldown > 0 || this.seegsonBoltAmmo <= 0) return false;
    this.seegsonBoltCooldown = 1.6;
    this.seegsonBoltAmmo--;

    if (this.audioEngine && this.audioEngine.playSeegsonBoltGunFire) {
      this.audioEngine.playSeegsonBoltGunFire();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const startPos = this.position.clone().add(new THREE.Vector3(0, 2.3, 0));

    // Incandescent orange-white tungsten spike beam
    const spikeGeo = new THREE.CylinderGeometry(0.06, 0.06, 38.0, 8);
    spikeGeo.rotateX(Math.PI / 2);
    const spikeMat = new THREE.MeshBasicMaterial({ color: 0xfb923c, transparent: true, opacity: 0.95 });
    const spikeMesh = new THREE.Mesh(spikeGeo, spikeMat);
    spikeMesh.position.copy(startPos).add(forward.clone().multiplyScalar(19.0));
    spikeMesh.lookAt(startPos.clone().add(forward.clone().multiplyScalar(38.0)));
    this.scene.add(spikeMesh);

    setTimeout(() => {
      if (spikeMesh.parent) this.scene.remove(spikeMesh);
    }, 180);

    let hitTarget = false;
    if (horde && horde.aliens) {
      for (let i = horde.aliens.length - 1; i >= 0; i--) {
        const a = horde.aliens[i];
        if (!a || a.hp <= 0 || !a.mesh) continue;
        const toEnemy = a.mesh.position.clone().sub(this.position);
        toEnemy.y = 0;
        const dist = toEnemy.length();
        if (dist <= 38.0) {
          const proj = toEnemy.dot(forward);
          const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
          if (proj > 0 && perpDist <= (a.radius || 1.2) + 0.85) {
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
              this.scene.remove(a.mesh);
              horde.aliens.splice(i, 1);
              horde.deadCount++;
              if (window.gameInstance) {
                window.gameInstance.comboHits++;
                window.gameInstance.score += 240;
              }
            }
            break; // Single ultra-high-impact tungsten bolt
          }
        }
      }
    }

    if (!hitTarget && bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
      const toBoss = bosses.activeBoss.mesh.position.clone().sub(this.position);
      toBoss.y = 0;
      if (toBoss.length() <= 38.0 && toBoss.normalize().dot(forward) > 0.86) {
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

    // Spawn transient optical cloaked after-image mesh
    const afterImage = this.mesh.clone();
    afterImage.position.copy(this.position).sub(forward.clone().multiplyScalar(3.0));
    afterImage.traverse(c => {
      if (c.isMesh && c.material) {
        c.material = new THREE.MeshBasicMaterial({
          color: 0x00d2ff,
          transparent: true,
          opacity: 0.55,
          wireframe: true
        });
      }
    });
    this.scene.add(afterImage);

    let op = 0.55;
    const fade = setInterval(() => {
      op -= 0.11;
      afterImage.traverse(c => {
        if (c.isMesh && c.material) c.material.opacity = Math.max(0, op);
      });
      if (op <= 0) {
        clearInterval(fade);
        this.scene.remove(afterImage);
      }
    }, 35);

    if (particles && particles.emitSparks) {
      particles.emitSparks(this.position, 12);
    }

    return true;
  }

  /* === CHANTIER 1 (v50.0): Yautja Stealth Infiltration Dropship Carpet-Bombing Protocol ([Shift + J]) === */
  callInfiltrationDropshipBombing(horde, bosses, particles, audio, ui = null) {
    if (this.dropshipBombingCooldown > 0) return false;
    this.dropshipBombingCooldown = 28.0;

    if (audio && audio.playYautjaDropshipSwoop) {
      audio.playYautjaDropshipSwoop();
    }

    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const startPos = this.position.clone();

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
    this.scene.add(dropshipGroup);

    // Dropship flyover animation
    let flyDist = 0;
    const flyInterval = setInterval(() => {
      flyDist += 3.2;
      dropshipGroup.position.addScaledVector(forward, 3.2);
      dropshipGroup.position.y += Math.sin(flyDist * 0.05) * 0.4;
      if (flyDist >= 68.0) {
        clearInterval(flyInterval);
        this.scene.remove(dropshipGroup);
      }
    }, 25);

    // Drop 6 plasma cluster bomblets along 25m corridor
    for (let b = 1; b <= 6; b++) {
      setTimeout(() => {
        const bombPos = startPos.clone().add(forward.clone().multiplyScalar(b * 4.2));
        bombPos.y = 0.2;

        // Plasma napalm fireball explosion
        const fireGeo = new THREE.SphereGeometry(2.4, 12, 12);
        const fireMat = new THREE.MeshBasicMaterial({ color: 0x00f2fe, transparent: true, opacity: 0.9 });
        const fireMesh = new THREE.Mesh(fireGeo, fireMat);
        fireMesh.position.copy(bombPos);
        this.scene.add(fireMesh);

        let fScale = 1.0;
        const fInterval = setInterval(() => {
          fScale += 0.4;
          fireMesh.scale.set(fScale, fScale, fScale);
          fireMat.opacity -= 0.12;
          if (fireMat.opacity <= 0) {
            clearInterval(fInterval);
            this.scene.remove(fireMesh);
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
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(bombPos) <= 4.8) {
              a.hp -= 420;
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
                this.scene.remove(a.mesh);
                horde.aliens.splice(j, 1);
                horde.deadCount++;
              }
            }
          }
        }

        if (bosses && bosses.activeBoss && bosses.activeBoss.mesh) {
          if (bosses.activeBoss.mesh.position.distanceTo(bombPos) <= 5.5) {
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

    this.mesh.add(beamGroup);
    this.dualPlasmaMeshGroup = beamGroup;

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚡ SURCHARGE JUMELÉE DES CANONS PLASMA : RAYON THERMIQUE CONCENTRÉ (920 DMG/S) !');
    }
    return true;
  }

  updateDualPlasmaBeam(delta, horde, bosses, particles) {
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
      p.timer -= delta;
      if (horde && horde.aliens) {
        for (let j = horde.aliens.length - 1; j >= 0; j--) {
          const a = horde.aliens[j];
          if (!a || a.hp <= 0 || !a.mesh) continue;
          if (a.mesh.position.distanceTo(p.pos) <= p.radius) {
            a.hp -= p.dps * delta;
            if (a.hp <= 0) {
              if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
              this.scene.remove(a.mesh);
              horde.aliens.splice(j, 1);
              horde.deadCount++;
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
          if (!a || a.hp <= 0 || !a.mesh) continue;
          const toXeno = a.mesh.position.clone().sub(this.position);
          toXeno.y = 0;
          const dist = toXeno.length();
          if (dist <= 38.0) {
            const proj = toXeno.dot(forward);
            const perpDist = Math.sqrt(Math.max(0, dist * dist - proj * proj));
            if (proj > 0 && perpDist <= (a.radius || 1.2) + 1.2) {
              a.hp -= 920 * delta;
              a.isFrontalShielded = false; // Melts frontal shields!
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'plasma');
                this.scene.remove(a.mesh);
                horde.aliens.splice(i, 1);
                horde.deadCount++;
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
          this.dualPlasmaMeshGroup.parent.remove(this.dualPlasmaMeshGroup);
          this.dualPlasmaMeshGroup = null;
        }
      }
    }

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
      const s = 1.0 + Math.sin(Date.now() * 0.012) * 0.25;
      this.activeDecoyBeacon.mesh.scale.set(s, s, s);

      if (this.activeDecoyBeacon.timer <= 0) {
        this.scene.remove(this.activeDecoyBeacon.mesh);
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
            if (!a || a.hp <= 0 || !a.mesh) continue;
            if (a.mesh.position.distanceTo(slamPos) <= slamRadius) {
              a.hp -= 580;
              a.isStunned = true;
              a.stunTimer = Math.max(a.stunTimer || 0, 2.5);
              const knock = a.mesh.position.clone().sub(slamPos).normalize();
              a.mesh.position.addScaledVector(knock, 6.5);
              if (a.hp <= 0) {
                if (horde.goreEngine) horde.goreEngine.spawnDismemberment(a.mesh.position, 'heavy');
                this.scene.remove(a.mesh);
                horde.aliens.splice(i, 1);
                horde.deadCount++;
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
        const flicker = Math.sin(Date.now() * 0.05) > 0;
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
  }

  /* === CHANTIER 1 (v51.0): Clan Weapon Forge Persistent Upgrades === */
  loadClanForgeUpgrades() {
    try {
      const saved = localStorage.getItem('yautja_clan_forge');
      if (saved) {
        const parsed = JSON.parse(saved);
        this.forgeUpgrades = { ...this.forgeUpgrades, ...parsed };
        if (this.forgeUpgrades.masterWristblades) {
          this.parryWindowDuration = 0.58;
        }
        if (this.forgeUpgrades.enkiduBattleplate) {
          this.hasEnkiduArmor = true;
          this.acidResistance = 0.40;
          this.gauntletCooldownReduction = 0.80;
          this.maxHp = (this.data && this.data.stats && this.data.stats.maxHp ? this.data.stats.maxHp : 1000) + 250;
        }
        if (this.forgeUpgrades.burnerPlasmaCoil) {
          this.hasBurnerCoil = true;
        }
        if (this.forgeUpgrades.cauterizingWristblade) {
          this.hasCauterizingWristblade = true;
        }
      }
    } catch (e) {
      console.warn('Failed to load forge upgrades:', e);
    }
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
    this.scene.add(beaconMesh);

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
      setTimeout(() => {
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
}


