/* Orbital insertion is one simulation-clock sequence, including the handoff to play. */
import * as THREE from 'three';
import { createDropPodModel } from '../graphics/SupportModels.js';
import { disposeObject } from '../engine/SceneResources.js';

export const INSERTION_TIMING = Object.freeze({ descending: 1.1, settling: 0.4, opening: 1.45, exiting: 1.8, linger: 20, fade: 1 });
const DESCENT_END = INSERTION_TIMING.descending;
const SETTLE_END = DESCENT_END + INSERTION_TIMING.settling;
const OPEN_END = SETTLE_END + INSERTION_TIMING.opening;
const SEQUENCE_END = OPEN_END + INSERTION_TIMING.exiting;
const UP = new THREE.Vector3(0, 1, 0);
const X_AXIS = new THREE.Vector3(1, 0, 0);
const clamp = value => THREE.MathUtils.clamp(value, 0, 1);
const smooth = value => { const t = clamp(value); return t * t * (3 - 2 * t); };
const localPosition = (value, fallback) => value?.isVector3 ? value.clone() : Array.isArray(value) ? new THREE.Vector3(...value) : new THREE.Vector3(...fallback);

export class DropPodEntrance {
  constructor(scene, audioEngine, particles, { modelFactory = createDropPodModel } = {}) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;
    this.modelFactory = modelFactory;
    this.pods = [];
    this.podMesh = null;
    this.doorMesh = null;
    this.phase = 'idle';
    this.isActive = false;
    this.isLanding = false;
    this.elapsed = 0;
    this.duration = SEQUENCE_END;
    this.openingProgress = 0;
    this.lingerLife = 0;
    this.velocityY = 0;
    this._generation = 0;
  }

  get progress() { return clamp(this.elapsed / SEQUENCE_END); }

  get phaseProgress() {
    const times = { descending: [0, DESCENT_END], settling: [DESCENT_END, SETTLE_END], opening: [SETTLE_END, OPEN_END], exiting: [OPEN_END, SEQUENCE_END] };
    const range = times[this.phase];
    return range ? clamp((this.elapsed - range[0]) / (range[1] - range[0])) : this.phase === 'complete' ? 1 : 0;
  }

  triggerDrop(targetPos, onComplete, { players = [], rotationY = 0 } = {}) {
    this.clear();
    const actors = [...new Set(players.filter(player => player?.mesh && player?.position))];
    const firstPosition = actors[0]?.position.clone() ?? targetPos.clone();
    const heading = Number.isFinite(rotationY) ? rotationY : 0;
    const origins = [];
    for (let index = 0; index < Math.max(1, actors.length); index++) {
      const player = actors[index] ?? null;
      const targetPosition = targetPos.clone();
      if (player) targetPosition.add(player.position.clone().sub(firstPosition));
      targetPosition.y = targetPos.y;
      // Leave a player-width passage between the two single-occupant cabins.
      for (const origin of origins) {
        const separation = targetPosition.clone().sub(origin).setY(0);
        if (separation.length() < 6) {
          if (separation.lengthSq() < 1e-8) separation.set(1, 0, 0);
          targetPosition.copy(origin).add(separation.normalize().multiplyScalar(6));
          targetPosition.y = targetPos.y;
        }
      }
      origins.push(targetPosition);
      const model = this.modelFactory();
      model.group.position.copy(targetPosition).addScaledVector(UP, 60);
      model.group.rotation.y = heading;
      this.scene.add(model.group);
      const record = { model, group: model.group, player, targetPosition, heading, sparkBudget: 0,
        seatPosition: localPosition(model.seatPosition, [0, 0, 0]), exitPosition: localPosition(model.exitPosition, [0, 0, 4.2]),
        owned: Boolean(player), materials: new Map() };
      if (player) {
        record.original = { visible: player.mesh.visible, position: player.position.clone(), meshPosition: player.mesh.position.clone(),
          meshQuaternion: player.mesh.quaternion.clone(), rotationY: player.rotationY,
          pose: ['leftLeg', 'rightLeg', 'leftArm', 'rightArm'].flatMap(name => player[name]?.quaternion ? [{ node: player[name], quaternion: player[name].quaternion.clone(), name }] : []) };
        player.mesh.visible = false;
      }
      this.pods.push(record);
    }
    this.podMesh = this.pods[0].group;
    this.doorMesh = this.pods[0].model.door ?? null;
    this.onComplete = typeof onComplete === 'function' ? onComplete : null;
    this.elapsed = 0;
    this.phase = 'descending';
    this.isActive = true;
    this.isLanding = true;
    this.openingProgress = 0;
    this.velocityY = -60 / DESCENT_END;
    this._impactPlayed = false;
    this._openingPlayed = false;
    this._renderSequence(0);
  }

  // Camera focus does not move the hidden gameplay actor into the sky.
  getCameraTarget(playerIndex = 0) {
    const record = this.pods[playerIndex] ?? this.pods[0];
    if (!record) return null;
    if (this.phase === 'exiting' || this.phase === 'complete') {
      return (record.player?.position ?? this._worldPoint(record, record.exitPosition)).clone().add(new THREE.Vector3(0, 2.3, 0));
    }
    return record.group.position.clone().add(new THREE.Vector3(0, 2.5, 0));
  }

  _worldPoint(record, local) { return local.clone().applyAxisAngle(UP, record.heading).add(record.targetPosition); }

  // Thin wall segments preserve the hollow cabin and its open front. A solid
  // capsule bounding box would trap the occupant at the end of the sequence.
  resolveMovement(position, radius = 0.8) {
    if (!position?.isVector3 || !Number.isFinite(radius) || radius < 0 || this.elapsed < DESCENT_END) return position;
    for (const record of this.pods) {
      if (position.y > record.targetPosition.y + 6.9) continue;
      const local = position.clone().sub(record.targetPosition).applyAxisAngle(UP, -record.heading);
      const sourceProfile = record.model.collisionProfile;
      const profile = sourceProfile ? { radiusX: sourceProfile.shellRadiusX, radiusZ: sourceProfile.shellRadiusZ,
        openingAngle: sourceProfile.shellOpeningAngle, hingeX: sourceProfile.hingeX, hingeZ: sourceProfile.hingeZ, leafWidth: sourceProfile.doorLength } :
        { radiusX: 2.05, radiusZ: 1.8, openingAngle: Math.PI * 0.285, hingeX: 1.55, hingeZ: 1.46, leafWidth: 1.53 };
      const segments = [];
      for (let i = 0; i < 24; i++) {
        const angle = profile.openingAngle + i / 24 * (Math.PI * 2 - profile.openingAngle * 2);
        const next = profile.openingAngle + (i + 1) / 24 * (Math.PI * 2 - profile.openingAngle * 2);
        segments.push([Math.sin(angle) * profile.radiusX, Math.cos(angle) * profile.radiusZ, Math.sin(next) * profile.radiusX, Math.cos(next) * profile.radiusZ]);
      }
      for (const side of [-1, 1]) {
        const angle = side * this.openingProgress * Math.PI * 0.625;
        const inward = -side * profile.leafWidth;
        segments.push([side * profile.hingeX, profile.hingeZ, side * profile.hingeX + Math.cos(angle) * inward, profile.hingeZ - Math.sin(angle) * inward]);
      }
      const clearance = radius + 0.12;
      for (let iteration = 0; iteration < 3; iteration++) for (const [ax, az, bx, bz] of segments) {
        const vx = bx - ax, vz = bz - az;
        const t = clamp(((local.x - ax) * vx + (local.z - az) * vz) / (vx * vx + vz * vz));
        const px = ax + vx * t, pz = az + vz * t;
        let dx = local.x - px, dz = local.z - pz;
        const length = Math.hypot(dx, dz);
        if (length >= clearance) continue;
        if (length < 1e-8) { dx = -vz; dz = vx; }
        const scale = (clearance - length) / Math.hypot(dx, dz);
        local.x += dx * scale; local.z += dz * scale;
      }
      position.copy(local.applyAxisAngle(UP, record.heading).add(record.targetPosition));
    }
    return position;
  }

  _animatePlayer(record, walking, progress, delta) {
    const player = record.player;
    if (!player || !record.owned) return;
    const stride = walking ? Math.sin(progress * Math.PI * 4) * 0.32 * Math.sin(Math.PI * clamp(progress)) : 0;
    // A ready combat stance points the two long wristblades through the closed
    // hatch. Lower the actual weapon arm while inside, then relax it as the
    // occupant steps clear. City Hunter's fused native blades keep their
    // inspected imported pose; hidden fallback blades must not alter it.
    const hasVisibleBlades = !player._importedCharacter?.bakedWristblades && [player.blade1, player.blade2].some(blade => {
      if (!blade) return false;
      let node = blade;
      while (node && node !== player.mesh) { if (!node.visible) return false; node = node.parent; }
      return node === player.mesh;
    });
    const cabinArmLowering = this.isActive && hasVisibleBlades ? 0.55 * (1 - smooth(progress / 0.4)) : 0;
    for (const pose of record.original.pose) {
      pose.node.quaternion.copy(pose.quaternion);
      const amplitude = (pose.name.startsWith('left') ? 1 : -1) * (pose.name.endsWith('Leg') ? 1 : -0.42);
      pose.node.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, stride * amplitude));
      if (pose.name === 'rightArm' && cabinArmLowering > 0) pose.node.quaternion.multiply(new THREE.Quaternion().setFromAxisAngle(X_AXIS, cabinArmLowering));
    }
    // Pose only: Player.update would also advance combat timers and passive damage.
    player._syncImportedAccessories?.();
    const imported = player._importedCharacter;
    imported?.adapter.update(Math.min(delta, 0.1), walking);
    if (imported && player.laserGroup) player.laserGroup.position.y = imported.laserBaseY + (imported.adapter.visualGroundOffsetY ?? 0);
  }

  _renderSequence(delta) {
    const t = this.elapsed;
    this.phase = t < DESCENT_END ? 'descending' : t < SETTLE_END ? 'settling' : t < OPEN_END ? 'opening' : t < SEQUENCE_END ? 'exiting' : 'complete';
    this.isLanding = this.phase === 'descending';
    this.openingProgress = smooth((t - SETTLE_END) / INSERTION_TIMING.opening);
    for (const record of this.pods) {
      const fall = clamp(t / DESCENT_END);
      record.group.position.copy(record.targetPosition);
      // Constant approach followed by a short braking curve, ending exactly at the floor.
      if (t < DESCENT_END) record.group.position.y += 60 * Math.pow(1 - fall, 1.25);
      if (this.phase === 'settling') {
        const settle = (t - DESCENT_END) / INSERTION_TIMING.settling;
        record.group.rotation.z = Math.sin(settle * Math.PI * 4) * 0.018 * (1 - settle);
      } else record.group.rotation.z = 0;
      const setOpening = record.model.updateOpening ?? record.model.setOpening;
      setOpening?.call(record.model, this.openingProgress);
      if (this.phase === 'descending') {
        record.sparkBudget += delta * 24;
        const sparks = Math.floor(record.sparkBudget);
        if (sparks > 0) { this.particles?.emitSparks?.(record.group.position, sparks); record.sparkBudget -= sparks; }
      }
      if (!record.player || !record.owned) continue;
      const exitProgress = clamp((t - OPEN_END) / INSERTION_TIMING.exiting);
      const local = record.seatPosition.clone().lerp(record.exitPosition, smooth(exitProgress));
      record.player.position.copy(this._worldPoint(record, local));
      record.player.mesh.position.copy(record.player.position);
      record.player.rotationY = record.heading;
      record.player.mesh.rotation.y = record.heading;
      // Reveal the landed occupant behind the closed leaves as they begin to
      // open, so the cabin never appears empty before a sudden body pop-in.
      record.player.mesh.visible = t >= SETTLE_END && record.original.visible;
      this._animatePlayer(record, t >= OPEN_END && t < SEQUENCE_END, exitProgress, delta);
    }
  }

  _restorePlayer(record, cancelled = false) {
    if (!record.player || !record.owned) return;
    this._animatePlayer(record, false, 0, 0);
    const player = record.player;
    player.mesh.visible = record.original.visible;
    if (cancelled) {
      player.position.copy(record.original.position);
      player.mesh.position.copy(record.original.meshPosition);
      player.mesh.quaternion.copy(record.original.meshQuaternion);
      player.rotationY = record.original.rotationY;
    }
    player.locomotion?.reset(player.position);
    record.owned = false;
  }

  update(delta) {
    if (!Number.isFinite(delta) || delta <= 0 || !this.pods.length) return;
    let remainder = delta;
    if (this.isActive) {
      const generation = this._generation;
      const step = Math.min(delta, SEQUENCE_END - this.elapsed);
      this.elapsed = Math.min(SEQUENCE_END, this.elapsed + step);
      this._renderSequence(step);
      if (!this._impactPlayed && this.elapsed >= DESCENT_END) {
        this._impactPlayed = true;
        this.audioEngine?.playDropPodImpact?.();
        for (const record of this.pods) this.particles?.emitSparks?.(record.targetPosition, 12);
      }
      if (!this._openingPlayed && this.elapsed >= SETTLE_END) {
        this._openingPlayed = true;
        this.audioEngine?.playCryoVentHiss?.();
      }
      if (this.elapsed < SEQUENCE_END) return;
      this.isActive = false;
      this.isLanding = false;
      this.velocityY = 0;
      this.phase = 'complete';
      this.lingerLife = INSERTION_TIMING.linger;
      for (const record of this.pods) this._restorePlayer(record);
      const callback = this.onComplete;
      this.onComplete = null;
      callback?.();
      // Completion may synchronously start another mission or clear the scene.
      if (generation !== this._generation) return;
      remainder -= step;
    }
    if (remainder <= 0) return;
    this.lingerLife -= remainder;
    if (this.lingerLife > 0) return;
    const fade = clamp(-this.lingerLife / INSERTION_TIMING.fade);
    for (const record of this.pods) record.group.traverse(object => {
      if (!object.isMesh) return;
      object.castShadow = false;
      for (const material of Array.isArray(object.material) ? object.material : [object.material]) {
        if (!record.materials.has(material)) record.materials.set(material, material.opacity);
        material.transparent = true;
        material.depthWrite = false;
        material.opacity = record.materials.get(material) * (1 - fade);
      }
    });
    if (this.lingerLife <= -INSERTION_TIMING.fade + 1e-9) this.clear();
  }

  clear() {
    this._generation++;
    this.isActive = false;
    this.isLanding = false;
    this.onComplete = null;
    for (const record of this.pods) {
      this._restorePlayer(record, true);
      disposeObject(record.group);
    }
    this.pods.length = 0;
    this.podMesh = null;
    this.doorMesh = null;
    this.phase = 'idle';
    this.elapsed = 0;
    this.openingProgress = 0;
    this.lingerLife = 0;
    this.velocityY = 0;
  }
}
