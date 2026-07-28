/* Yautja Anti-Gravity Skimmer Vehicle Engine */

import * as THREE from 'three';

export class YautjaSkimmer {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;

    this.mesh = this.buildSkimmerMesh();
    this.position = new THREE.Vector3(0, 0.5, 0);
    this.rotationY = 0;
    this.isMounted = false;
    this.speed = 32;

    this.scene.add(this.mesh);
  }

  buildSkimmerMesh() {
    const group = new THREE.Group();
    const metalMat = new THREE.MeshStandardMaterial({ color: 0x222a36, metalness: 0.9, roughness: 0.2 });
    const glowMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    // Sleek Anti-Gravity Fuselage
    const bodyGeo = new THREE.BoxGeometry(1.6, 0.8, 4.5);
    const body = new THREE.Mesh(bodyGeo, metalMat);
    body.position.y = 0.6;
    group.add(body);

    // Front Plasma Twin Cannons
    const cannonGeo = new THREE.CylinderGeometry(0.12, 0.12, 1.8, 8);
    cannonGeo.rotateX(Math.PI / 2);

    const leftCannon = new THREE.Mesh(cannonGeo, metalMat);
    leftCannon.position.set(-0.7, 0.6, -2.2);
    group.add(leftCannon);

    const rightCannon = new THREE.Mesh(cannonGeo, metalMat);
    rightCannon.position.set(0.7, 0.6, -2.2);
    group.add(rightCannon);

    // Anti-Gravity Thruster Glow Engines
    const engineGeo = new THREE.CylinderGeometry(0.4, 0.4, 0.6, 8);
    engineGeo.rotateX(Math.PI / 2);

    const engine = new THREE.Mesh(engineGeo, glowMat);
    engine.position.set(0, 0.6, 2.2);
    group.add(engine);

    return group;
  }

  spawnAt(pos) {
    this.position.copy(pos);
    this.mesh.position.copy(this.position);
    this.mesh.visible = true;
  }

  update(delta, player, horde, keys) {
    if (!this.isMounted) {
      // Check player mounting range
      if (player && player.position.distanceTo(this.position) < 3.5 && keys['KeyG']) {
        this.isMounted = true;
        player.mesh.visible = false; // Hide walking mesh when inside vehicle
      }
      return;
    }

    // Vehicle Controls (WASD)
    const dir = new THREE.Vector3();
    if (keys['KeyW'] || keys['ArrowUp']) dir.z -= 1;
    if (keys['KeyS'] || keys['ArrowDown']) dir.z += 1;
    if (keys['KeyA'] || keys['ArrowLeft']) dir.x -= 1;
    if (keys['KeyD'] || keys['ArrowRight']) dir.x += 1;

    if (dir.lengthSq() > 0) {
      dir.normalize();
      this.position.addScaledVector(dir, this.speed * delta);
      this.rotationY = Math.atan2(dir.x, dir.z);

      this.mesh.position.copy(this.position);
      this.mesh.rotation.y = this.rotationY;

      player.position.copy(this.position); // Keep player synced

      // Ramming Xenomorphs at high speed!
      const ramAttack = { origin: this.position, radius: 3.5, damage: 300 };
      const hits = horde.checkMeleeHits(ramAttack);
      if (hits.length > 0) {
        this.audioEngine.playSlash();
      }
    }

    // Dismount Key (G)
    if (keys['KeyG']) {
      this.isMounted = false;
      player.mesh.visible = true;
    }
  }
}
