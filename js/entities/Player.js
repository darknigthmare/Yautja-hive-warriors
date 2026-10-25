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
  get cameraEyeHeight() {
    const imported = this._importedCharacter;
    return ((imported?.cameraEyeHeight ?? this.headMesh?.position.y ?? 3.6) +
      (imported?.adapter.visualGroundOffsetY ?? this._proceduralMotionRoot?.position.y ?? 0)) * (this.mesh?.scale.y ?? 1);
  }

  constructor(scene, charData, audioEngine, isPlayer2 = false, particles = null) {
    this.scene = scene;
    this.data = charData;
    this.audioEngine = audioEngine;
    this.isPlayer2 = isPlayer2;
    this.particles = particles;
    this._timers = [];
    this._effects = new Set();
    this._disposed = false;
    this._generatedVisualGeneration = 0;
    this.generatedVisualState = 'procedural';
    this.generatedBiomaskState = 'none';
    this.generatedMechanismsState = 'none';
    this.generatedMechanismsError = null;
    this.loadout = { primary: 'wristblades', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'] };
    this.activeWeapon = 'wristblades';
    this.weaponProfile = { damage: 1, reach: 3.8, timing: 1 };
    this.bearTrapCharges = 3;

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
    this.acidSolventCharges = 2;

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

    // Pounce Leap State
    this.isLeaping = false;
    this.leapVelocityY = 0;

    // QTE Facehugger Struggle State
    this.isFacehuggerLatched = false;
    this.qteStrugglePresses = 0;
    this.qteRequiredPresses = 5;

    this.mesh = this.buildYautjaMesh();
    this.mesh.traverse(child => { if (child.isMesh) child.castShadow = true; });
    this.scene.add(this.mesh);

    this.laserColorHex = isPlayer2 ? 0xffaa00 : 0xff0000;
    this.laserGroup = this.buildLaserSight(this.laserColorHex);
    this.mesh.add(this.laserGroup);
    this.locomotion = new HunterLocomotion(this);

    this.radius = 1.2;
    // An empty verified manifest performs no fetch and keeps the current model.
    this.generatedVisualReady = this.loadGeneratedVisual();
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
      const preparation = prepareImportedParts(bodyTemplate, rig, { sourceSha256: entry.sha256 });
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
      const createAdapter = source => createImportedCharacter(this, source, { ...rig, sourceSha256: entry.sha256,
        articulation: preparation.articulationDescriptor, requireHeadPartition: true, animateWhenUncontrolled: false });
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
      if (assetKey === 'city_hunter' && entry.sha256 === CITY_HUNTER_CONSOLE.sourceSha256) {
        try {
          mechanisms = installCityHunterMechanisms(adapter, { sourceSha256: entry.sha256 });
          this.generatedMechanismsState = 'ready'; this.generatedMechanismsError = null;
        } catch (error) {
          // Optional equipment never suppresses an otherwise verified body.
          this.generatedMechanismsState = 'unavailable'; this.generatedMechanismsError = error.message;
        }
      }
      const imported = { adapter, mechanisms, biomask, transforms, cameraEyeHeight: rig.cameraEyeHeight,
        bakedWristblades: rig.bakedWristblades?.calibrated === true && rig.bakedWristblades.mode === 'static',
        preparationDiagnostics: preparation.diagnostics,
        laserBaseY: this.laserGroup.position.y,
        laserStarts: [], records: [], latest: new Map(), hidden: new Map(),
        skinMaterials: this.skinMaterials, armorMaterials: this.armorMaterials };
      this._importedCharacter = imported; this.mesh.add(adapter.root);
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
      else { mechanisms?.dispose(); adapter?.dispose(); }
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
    imported.adapter.dispose(); this._importedCharacter = null;
    this._syncWristbladeVisuals();
    delete this.mesh.userData.generatedAsset;
    this.generatedVisualState = 'procedural';
    this.generatedBiomaskState = 'none'; this.generatedBiomaskError = null;
    this.generatedMechanismsState = 'none'; this.generatedMechanismsError = null;
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

    if (worldTargetPos) {
      const localTarget = this.laserGroup.worldToLocal(worldTargetPos.clone());
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        const angle = (i / 3) * Math.PI * 2;
        // The three dots converge at target with small triangle delta
        posAttr.setXYZ(1, localTarget.x + Math.cos(angle) * 0.12, localTarget.y + Math.sin(angle) * 0.12, localTarget.z);
        posAttr.needsUpdate = true;
      }
    } else {
      for (let i = 0; i < this.laserGroup.children.length; i++) {
        const line = this.laserGroup.children[i];
        const posAttr = line.geometry.attributes.position;
        posAttr.setXYZ(1, 0, 1.8, 25);
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
    this.schedule(() => {
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
    }
    if (this.isBlocking) {
      this.audioEngine.playShieldBlock();
      this.leftArm.rotation.x = -Math.PI * 0.4;
      this.leftArm.position.x = -0.6;
    } else {
      this.leftArm.rotation.x = 0;
      this.leftArm.position.x = this._leftArmRestX ?? -1.2;
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

  throwSmartDisc() {
    this.audioEngine.playSmartDiscHum();
    const origin = this.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
    const right = new THREE.Vector3(-forward.z, 0, forward.x);

    return {
      startPos: origin.clone(),
      apexPos: origin.clone().addScaledVector(forward, 28).addScaledVector(right, 7),
      damage: 320,
      speed: 40
    };
  }

  fireNetgun(horde, synthetics) {
    this.audioEngine.playNetgunLaunch();
    const origin = this.position.clone().add(new THREE.Vector3(0.5, 2.0, 0.4));
    const forward = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();

    // Find nearest target in forward cone (up to 22m)
    let bestTarget = null;
    let minAngle = Math.PI / 3;

    if (horde) {
      horde.aliens.forEach(a => {
        const toAlien = a.mesh.position.clone().sub(this.position);
        toAlien.y = 0;
        const dist = toAlien.length();
        if (dist <= 22.0) {
          toAlien.normalize();
          const angle = Math.acos(Math.max(-1, Math.min(1, forward.dot(toAlien))));
          if (angle < minAngle) {
            minAngle = angle;
            bestTarget = a;
          }
        }
      });
    }

    if (bestTarget) {
      bestTarget.isNetEntangled = true;
      bestTarget.netTimer = 4.0;
      this.audioEngine.playNetWireTighten();

      // Create visual expanding wire net mesh over the trapped target
      const netGeo = new THREE.SphereGeometry(bestTarget.radius ? bestTarget.radius * 1.3 : 1.4, 10, 10);
      const netMat = new THREE.MeshBasicMaterial({
        color: 0xcccccc,
        wireframe: true,
        transparent: true,
        opacity: 0.95
      });
      const netMesh = new THREE.Mesh(netGeo, netMat);
      netMesh.position.copy(bestTarget.mesh.position).add(new THREE.Vector3(0, 1.2, 0));
      this.scene.add(netMesh);
      this._effects.add(netMesh);

      this.schedule(() => {
        disposeObject(netMesh);
        this._effects.delete(netMesh);
      }, 4000);
      return true;
    }

    return false;
  }

  triggerGauntletEMP(horde, synthetics) {
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
    this.scene.add(shockwaveMesh);
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
    this.visionMode = (this.visionMode + 1) % 4;
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

    this.schedule(() => {
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
    this.audioEngine.playXenoHiss();
  }

  struggleQTE() {
    if (!this.isFacehuggerLatched) return false;
    this.qteStrugglePresses++;
    this.audioEngine.playSkullSnap();

    if (this.qteStrugglePresses >= this.qteRequiredPresses) {
      this.isFacehuggerLatched = false;
      this.qteStrugglePresses = 0;
      this.audioEngine.playYautjaRoar();
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
    this.hp = Math.min(this.maxHp, this.hp + 450);
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
    horde.acidPools.forEach(pool => disposeObject(pool.mesh));
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
        if (a && a.mesh && a.mesh.position.distanceTo(this.position) <= cleaveRadius) {
          const knockDir = a.mesh.position.clone().sub(this.position).normalize();
          a.mesh.position.addScaledVector(knockDir, 4.5);
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
    this._importedCharacter?.mechanisms?.trigger('nuke', 10);

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
    if (this._importedCharacter?.mechanisms?.getState().mode === 'nuke') this._importedCharacter.mechanisms.trigger('nuke', 0);
    if (this.wristNukeHoloMesh && this.leftArm) {
      disposeObject(this.wristNukeHoloMesh);
      this.wristNukeHoloMesh = null;
    }
  }

  triggerHybridMetamorphosis() {
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
    if (this.plasmaGlaiveCooldown > 0 || this.isPlasmaGlaiveActive || this.isFacehuggerLatched) return false;
    this.plasmaGlaiveCooldown = 13.0;
    this.isPlasmaGlaiveActive = true;
    this.plasmaGlaiveDuration = 3.6;
    if (this.plasmaGlaiveMesh) this.plasmaGlaiveMesh.visible = true;
    this.audioEngine.playPlasmaGlaiveSpin();
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
    this._effects.forEach(effect => disposeObject(effect));
    this._effects.clear();
    this.locomotion.dispose();
    this._removeImportedCharacter();
    disposeObject(this.mesh);
  }

  applyLoadout(config = {}) {
    config ||= {};
    const primary = ['wristblades', 'combistick', 'katana', 'alpha_sickle', 'viking_axe'].includes(config.primary) ? config.primary : 'wristblades';
    const secondary = ['smart_disc', 'shuriken', 'compound_bow', 'plasma_whip'].includes(config.secondary) ? config.secondary : 'smart_disc';
    const gadgets = Array.isArray(config.gadgets)
      ? [...new Set(config.gadgets.filter(g => ['medicomp', 'bear_trap', 'acid_solvent', 'nuke', 'mines'].includes(g)))].slice(0, 2)
      : ['medicomp', 'bear_trap'];
    this.loadout = { primary, secondary, gadgets };
    this.preferredSecondaryWeapon = secondary;
    this.medicompCharges = gadgets.includes('medicomp') ? 3 : 0;
    this.acidSolventCharges = gadgets.includes('acid_solvent') ? 2 : 0;
    this.bearTrapCharges = gadgets.includes('bear_trap') ? 3 : 0;
    this.selectWeapon(primary, false);
  }

  hasGadget(id) { return this.loadout.gadgets.includes(id); }

  setLaserColor(color) {
    this.laserColorHex = color;
    this.laserGroup?.traverse(child => { if (child.material?.color) child.material.color.set(color); });
  }

  selectWeapon(id, playSound = true) {
    const profiles = {
      wristblades: { damage: 1, reach: 3.8, timing: 1 },
      combistick: { damage: 1.05, reach: 5.4, timing: 1.15 },
      katana: { damage: 1.15, reach: 4.2, timing: 0.9 },
      alpha_sickle: { damage: 1.2, reach: 4.4, timing: 1.1 },
      viking_axe: { damage: 1.4, reach: 4.5, timing: 1.5 },
      smart_disc: { damage: 1.1, reach: 4.8, timing: 1 },
      shuriken: { damage: 1.05, reach: 4.2, timing: 0.85 },
      compound_bow: { damage: 0.9, reach: 4.6, timing: 1 },
      plasma_whip: { damage: 1.1, reach: 5.8, timing: 1.2 }
    };
    if (!profiles[id]) return false;
    this.activeWeapon = id;
    this.weaponProfile = profiles[id];
    this.isSecondaryWeapon = id !== 'wristblades';
    this.secWeaponMesh.visible = this.isSecondaryWeapon;
    this._syncWristbladeVisuals();
    // Give selected melee tools a distinct silhouette without changing shared materials.
    this.secWeaponMesh.geometry.dispose();
    this.secWeaponMesh.geometry = createHunterWeaponGeometry(id);
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
    if (this._disposed || !Number.isFinite(delta) || delta <= 0 || this.isFacehuggerLatched || this.isPerched) return;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      const speedMult = (this.warhornBuffTimer > 0 ? 1.4 : 1.0) * (this.isBerserkerActive ? 1.45 : 1.0);
      const moveDistance = this.moveSpeed * speedMult * delta;
      this.position.addScaledVector(dir, moveDistance);

      const targetAngle = Math.atan2(dir.x, dir.z);
      let diff = targetAngle - this.rotationY;
      while (diff < -Math.PI) diff += Math.PI * 2;
      while (diff > Math.PI) diff -= Math.PI * 2;
      this.rotationY += diff * (1 - Math.exp(-12 * delta));
    }

    this.mesh.position.copy(this.position);
    this.mesh.rotation.y = this.rotationY;
  }

  lightAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;
    this.attackComboStep = (this.attackComboStep % 5) + 1;
    this.attackTimer = 0.28 * this.weaponProfile.timing;
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

    return {
      type: 'light',
      step: this.attackComboStep,
      damage: baseDmg * (1 + this.attackComboStep * 0.18) * buff,
      radius: this.weaponProfile.reach,
      angle: Math.PI * 0.65
    };
  }

  heavyAttack() {
    if (this.isAttacking || this.isFacehuggerLatched) return null;
    this.isAttacking = true;

    const step = this.attackComboStep;
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

  firePlasmaShot() {
    if (this.plasmaEnergy < this.data.stats.plasmaEnergyCost || this.isFacehuggerLatched) return null;
    this.plasmaEnergy -= this.data.stats.plasmaEnergyCost;

    this.audioEngine.playPlasmaShot();

    const origin = this.position.clone().add(new THREE.Vector3(0, 2.5, 0));
    const forward = new THREE.Vector3(
      Math.sin(this.rotationY),
      this.isPerched ? -0.4 : 0, // Aim downwards when perched!
      Math.cos(this.rotationY)
    ).normalize();

    return {
      position: origin,
      direction: forward,
      damage: this.plasmaDamage,
      speed: 45
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

  takeDamage(amount, isAcid = false) {
    if (!Number.isFinite(amount) || amount <= 0 || this._disposed) return this.hp;
    if (this.isBlocking || this.isPerched) {
      this.audioEngine.playShieldBlock();
      return this.hp;
    }
    if (this.isPlasmaGlaiveActive) {
      this.audioEngine.playPlasmaGlaiveStrike();
      return this.hp; // Plasma Glaive cyclone barrier completely deflects frontal attacks!
    }
    if (this.isHybridMutated) return this.hp;
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

  update(delta, horde = null) {
    if (this._disposed) return;
    for (const timer of [...this._timers]) {
      timer.time -= delta;
      if (timer.time > 0) continue;
      if (timer.interval > 0) timer.time += timer.interval;
      else this.cancelTimer(timer);
      timer.callback();
    }
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

    if (this.isLeaping) {
      this.leapVelocityY -= 36 * delta;
      this.position.y += this.leapVelocityY * delta;

      if (this.position.y <= 0) {
        this.position.y = 0;
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
    this.locomotion.update(delta);
    if (this._importedCharacter) {
      this._syncImportedAccessories();
      this._importedCharacter.adapter.update(delta, this.locomotion.state.moving);
      this._importedCharacter.mechanisms?.update(delta);
      this.laserGroup.position.y = this._importedCharacter.laserBaseY + (this._importedCharacter.adapter.visualGroundOffsetY ?? 0);
    }
  }
}
