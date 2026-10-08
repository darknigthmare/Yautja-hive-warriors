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
    const isHeavyCut = weaponType === 'heavy' || weaponType === 'smart_disc' || weaponType === 'bone_scythe' || weaponType === 'spine_rip';
    const partsCount = isHeavyCut ? 3 : 2;

    for (let i = 0; i < partsCount; i++) {
      let partType = 'head';
      if (i === 1) partType = 'arm';
      else if (i === 2) partType = isHeavyCut && Math.random() < 0.5 ? 'torso_bisected' : 'tail';

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

      // Pharyngeal Inner Jaw extending from severed head
      const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
      const innerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.08, 0.06, 0.4), innerJawMat);
      innerJaw.position.set(0, 0, 0.7);
      group.add(innerJaw);

      // Sizzling acid neck gore stump
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

      // Claws on forearm
      const clawMat = new THREE.MeshStandardMaterial({ color: 0x0a0e14, metalness: 0.95 });
      for (let c = 0; c < 3; c++) {
        const claw = new THREE.Mesh(new THREE.ConeGeometry(0.025, 0.18, 4), clawMat);
        claw.position.set(-0.35 + c * 0.04, -0.4, 0);
        group.add(claw);
      }
    } else if (type === 'torso_bisected') {
      // Bisected alien torso with exposed ribs and glowing acid viscera
      const halfTorso = new THREE.Mesh(new THREE.CylinderGeometry(0.35, 0.25, 0.9, 8), this.xenoFleshMat);
      group.add(halfTorso);

      const viscera = new THREE.Mesh(new THREE.CircleGeometry(0.3, 8), this.acidGlowMat);
      viscera.position.y = -0.45;
      viscera.rotation.x = Math.PI / 2;
      group.add(viscera);
    } else {
      // Articulated Segmented Tail with Diamond Stinger
      const tailGroup = new THREE.Group();
      for (let t = 0; t < 4; t++) {
        const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.07 - t * 0.012, 0.05 - t * 0.012, 0.35, 6), this.xenoFleshMat);
        seg.position.set(0, 0, t * 0.32);
        seg.rotation.x = Math.PI / 2 + t * 0.08;
        tailGroup.add(seg);
      }
      const stinger = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.3, 4), this.xenoFleshMat);
      stinger.position.set(0, 0, 1.35);
      stinger.rotation.x = Math.PI / 2;
      tailGroup.add(stinger);

      group.add(tailGroup);
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
