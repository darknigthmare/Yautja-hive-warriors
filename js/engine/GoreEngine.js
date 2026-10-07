/* Gore & Dismemberment Engine 2.0 - 1:1 Lore Body Part Severing Physics */

import * as THREE from 'three';

export class GoreEngine {
  constructor(scene) {
    this.scene = scene;
    this.severedParts = [];
    this.acidGibs = [];

    // Materials
    this.xenoFleshMat = new THREE.MeshStandardMaterial({
      color: 0x11161d,
      roughness: 0.3,
      metalness: 0.8
    });
    this.acidGlowMat = new THREE.MeshBasicMaterial({
      color: 0x39ff14,
      transparent: true,
      opacity: 0.85
    });
    this.yautjaBloodMat = new THREE.MeshBasicMaterial({
      color: 0x76ff03,
      transparent: true,
      opacity: 0.9
    });
  }

  spawnDismemberment(pos, weaponType = 'wristblades') {
    const partsCount = weaponType === 'heavy' || weaponType === 'smart_disc' ? 3 : 2;

    for (let i = 0; i < partsCount; i++) {
      const partType = i === 0 ? 'head' : (i === 1 ? 'arm' : 'tail');
      const mesh = this.createPartMesh(partType);
      mesh.position.copy(pos);
      mesh.position.y += 0.8 + Math.random() * 0.5;

      const velocity = new THREE.Vector3(
        (Math.random() - 0.5) * 12,
        6 + Math.random() * 8,
        (Math.random() - 0.5) * 12
      );
      const rotSpeed = new THREE.Vector3(
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15,
        (Math.random() - 0.5) * 15
      );

      this.scene.add(mesh);
      this.severedParts.push({
        mesh,
        velocity,
        rotSpeed,
        life: 15,
        onGround: false
      });
    }

    // Spawn sizzling acid spray
    this.spawnAcidSplatter(pos);
  }

  createPartMesh(type) {
    const group = new THREE.Group();

    if (type === 'head') {
      const head = new THREE.Mesh(
        new THREE.CylinderGeometry(0.18, 0.28, 1.2, 8),
        this.xenoFleshMat
      );
      head.rotation.x = Math.PI / 2;
      group.add(head);

      // Acid gore stump
      const stump = new THREE.Mesh(
        new THREE.CircleGeometry(0.2, 8),
        this.acidGlowMat
      );
      stump.position.z = -0.6;
      group.add(stump);
    } else if (type === 'arm') {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.08, 0.05, 0.9, 6),
        this.xenoFleshMat
      );
      arm.rotation.z = Math.PI / 3;
      group.add(arm);
    } else {
      // Tail
      const tail = new THREE.Mesh(
        new THREE.CylinderGeometry(0.06, 0.02, 1.4, 6),
        this.xenoFleshMat
      );
      tail.rotation.x = Math.PI / 4;
      group.add(tail);
    }

    return group;
  }

  spawnAcidSplatter(pos) {
    const splashGeo = new THREE.CylinderGeometry(1.2 + Math.random() * 0.8, 1.2 + Math.random() * 0.8, 0.03, 10);
    const splash = new THREE.Mesh(splashGeo, this.acidGlowMat);
    splash.position.set(pos.x + (Math.random() - 0.5) * 2, 0.02, pos.z + (Math.random() - 0.5) * 2);
    this.scene.add(splash);

    this.acidGibs.push({
      mesh: splash,
      life: 8
    });
  }

  update(delta) {
    // Update flying severed body parts
    for (let i = this.severedParts.length - 1; i >= 0; i--) {
      const part = this.severedParts[i];
      part.life -= delta;

      if (!part.onGround) {
        part.velocity.y -= 25 * delta; // Gravity
        part.mesh.position.addScaledVector(part.velocity, delta);
        part.mesh.rotation.x += part.rotSpeed.x * delta;
        part.mesh.rotation.y += part.rotSpeed.y * delta;
        part.mesh.rotation.z += part.rotSpeed.z * delta;

        if (part.mesh.position.y <= 0.2) {
          part.mesh.position.y = 0.2;
          part.onGround = true;
          part.velocity.set(0, 0, 0);
          this.spawnAcidSplatter(part.mesh.position);
        }
      }

      if (part.life <= 0) {
        this.scene.remove(part.mesh);
        this.severedParts.splice(i, 1);
      }
    }

    // Update acid splatter dissipation
    for (let i = this.acidGibs.length - 1; i >= 0; i--) {
      const gib = this.acidGibs[i];
      gib.life -= delta;
      if (gib.life <= 0) {
        this.scene.remove(gib.mesh);
        this.acidGibs.splice(i, 1);
      }
    }
  }

  clear() {
    this.severedParts.forEach(p => this.scene.remove(p.mesh));
    this.severedParts = [];
    this.acidGibs.forEach(g => this.scene.remove(g.mesh));
    this.acidGibs = [];
  }
}
