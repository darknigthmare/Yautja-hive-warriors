/* Yautja Anti-Gravity Skimmer Vehicle Engine */

import * as THREE from 'three';
import { createSkimmerModel } from '../graphics/SupportModels.js';

export class YautjaSkimmer {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;

    this.mesh = this.buildSkimmerMesh();
    this.position = new THREE.Vector3(0, 0.5, 0);
    this.rotationY = 0;
    this.isMounted = false;
    this.speed = 32;

    this.mesh.visible = false;
    this.scene.add(this.mesh);
    this.mountCooldown = 0;
    this.cannonCooldown = 0;
    this.visual = this.mesh.getObjectByName('skimmer-visual');
    this.propulsionMaterials = new Map();
    this.mesh.traverse(node => {
      if (node.isMesh && node.material?.name?.startsWith('skimmer-')) this.propulsionMaterials.set(node.material.name, node.material);
    });
    this.animationTime = 0;
    this.throttle = 0;
    this.weaponFlash = 0;
  }

  buildSkimmerMesh() {
    return createSkimmerModel();
  }

  clear() {
    this.isMounted = false;
    this.mountCooldown = 0;
    this.cannonCooldown = 0;
    this.animationTime = 0;
    this.throttle = 0;
    this.weaponFlash = 0;
    if (this.visual) this.visual.position.y = 0;
    const exhaust = this.propulsionMaterials?.get('skimmer-exhaust');
    const cannon = this.propulsionMaterials?.get('skimmer-cannon-charge');
    if (exhaust) exhaust.emissiveIntensity = 0.65;
    if (cannon) cannon.emissiveIntensity = 0.2;
    this.mesh.visible = false;
  }

  spawnAt(pos) {
    this.clear();
    this.position.copy(pos);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
  }

  updateVisual(delta, moving = false) {
    if (!Number.isFinite(delta) || delta <= 0) return;
    this.animationTime += delta;
    this.throttle += ((moving ? 1 : 0) - this.throttle) * (1 - Math.exp(-8 * delta));
    this.weaponFlash *= Math.exp(-14 * delta);
    // Only the render child hovers; contact, interaction range and player/camera
    // position stay on the stable gameplay root.
    if (this.visual) this.visual.position.y = Math.sin(this.animationTime * 2.4) * 0.035;
    const exhaust = this.propulsionMaterials.get('skimmer-exhaust');
    const cannon = this.propulsionMaterials.get('skimmer-cannon-charge');
    if (exhaust) exhaust.emissiveIntensity = 0.65 + this.throttle * 1.5;
    if (cannon) cannon.emissiveIntensity = 0.2 + this.weaponFlash * 3;
  }

  update(delta, player, horde, keys) {
    if (!this.mesh.visible || !player || player.hp <= 0) return;
    if (this.mountCooldown > 0) this.mountCooldown -= delta;
    if (this.cannonCooldown > 0) this.cannonCooldown -= delta;

    if (!this.isMounted) {
      this.updateVisual(delta);
      // Check player mounting range
      if (player && player.position.distanceTo(this.position) < 4.0 && keys['KeyG'] && this.mountCooldown <= 0) {
        keys['KeyG'] = false;
        this.isMounted = true;
        this.mountCooldown = 0.5;
        player.mesh.visible = false; // Hide walking mesh when inside vehicle
      }
      return;
    }

    // Vehicle Controls (WASD)
    const dir = new THREE.Vector3();
    if (keys['KeyW']) dir.z -= 1;
    if (keys['KeyS']) dir.z += 1;
    if (keys['KeyA']) dir.x -= 1;
    if (keys['KeyD']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.position.addScaledVector(dir, this.speed * delta);
      this.rotationY = Math.atan2(dir.x, dir.z);

      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;

      player.position.copy(this.position); // Keep player synced

      // Ramming Xenomorphs at high speed!
      const ramAttack = { origin: this.position, radius: 3.5, damage: 320 * delta };
      const hits = horde.checkMeleeHits(ramAttack);
      if (hits.length > 0) {
        this.audioEngine.playSlash();
      }
    }

    // Vehicle Dual Plasma Cannons (Space or Shift while mounted)
    if ((keys['Space'] || keys['ShiftLeft']) && this.cannonCooldown <= 0) {
      this.cannonCooldown = 0.28;
      this.audioEngine.playPlasmaShot();
      this.weaponFlash = 1;
      const fwd = new THREE.Vector3(Math.sin(this.rotationY), 0, Math.cos(this.rotationY)).normalize();
      const fireAttack = {
        origin: this.position.clone().addScaledVector(fwd, 4.0),
        radius: 4.5,
        damage: 260
      };
      horde.checkMeleeHits(fireAttack);
    }
    this.updateVisual(delta, dir.lengthSq() > 0);

    // Dismount Key (G)
    if (keys['KeyG'] && this.mountCooldown <= 0) {
      keys['KeyG'] = false;
      this.isMounted = false;
      this.mountCooldown = 0.5;
      player.mesh.visible = true;
    }
  }
}
