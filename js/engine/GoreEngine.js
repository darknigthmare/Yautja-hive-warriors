/* Gore & Dismemberment Engine 2.0 - 1:1 Lore Body Part Severing Physics */

import * as THREE from 'three';

export class GoreEngine {
  constructor(scene) {
    this.scene = scene;
    this.severedParts = [];
    this.acidGibs = [];
    this.pinnedParts = [];
    this.acidSlagDecals = [];

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

  spawnYautjaBloodSplatter(pos) {
    const splashGeo = new THREE.CylinderGeometry(1.4 + Math.random() * 0.6, 1.4 + Math.random() * 0.6, 0.03, 10);
    const splash = new THREE.Mesh(splashGeo, this.yautjaBloodMat);
    splash.position.set(pos.x + (Math.random() - 0.5) * 2, 0.025, pos.z + (Math.random() - 0.5) * 2);
    this.scene.add(splash);

    this.acidGibs.push({
      mesh: splash,
      life: 12
    });
  }

  spawnYautjaSeveredHead(pos) {
    const group = new THREE.Group();
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x8a7051, roughness: 0.7, metalness: 0.1 });
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.8 });
    const bandMat = new THREE.MeshStandardMaterial({ color: 0xd97706, metalness: 0.9, roughness: 0.2 });
    const tuskMat = new THREE.MeshStandardMaterial({ color: 0xfef08a, roughness: 0.5 });

    // Cranium
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.45, 10, 10), skinMat);
    head.scale.set(1.0, 1.15, 1.1);
    group.add(head);

    // Mandibles (4 flared predatory tusks)
    [[-0.22, -0.15, 0.35], [0.22, -0.15, 0.35], [-0.15, -0.28, 0.38], [0.15, -0.28, 0.38]].forEach((tp, idx) => {
      const tusk = new THREE.Mesh(new THREE.ConeGeometry(0.04, 0.22, 5), tuskMat);
      tusk.position.set(...tp);
      tusk.rotation.x = 0.5;
      tusk.rotation.z = (idx % 2 === 0 ? -0.4 : 0.4);
      group.add(tusk);
    });

    // 12 Braided Dreadlocks with decorative copper trophy rings
    for (let d = 0; d < 12; d++) {
      const angle = (d / 12) * Math.PI - Math.PI * 0.5;
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.02, 0.85, 6), dreadMat);
      dread.position.set(Math.sin(angle) * 0.38, 0.1 - Math.abs(angle) * 0.1, -0.25 - Math.cos(angle) * 0.2);
      dread.rotation.x = -0.6;
      dread.rotation.z = Math.sin(angle) * 0.4;
      group.add(dread);

      // Gold/copper band
      const band = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 6), bandMat);
      band.position.copy(dread.position);
      band.rotation.copy(dread.rotation);
      group.add(band);
    }

    // Glowing phosphor-green Yautja blood neck stump
    const stump = new THREE.Mesh(new THREE.CircleGeometry(0.24, 8), this.yautjaBloodMat);
    stump.position.set(0, -0.42, 0);
    stump.rotation.x = Math.PI / 2;
    group.add(stump);

    group.position.copy(pos);
    group.position.y += 1.5;

    const velocity = new THREE.Vector3(
      (Math.random() - 0.5) * 10,
      8.5 + Math.random() * 4.0,
      (Math.random() - 0.5) * 10
    );
    const rotSpeed = new THREE.Vector3(
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14,
      (Math.random() - 0.5) * 14
    );

    this.scene.add(group);
    this.severedParts.push({
      mesh: group,
      velocity,
      rotSpeed,
      life: 20,
      onGround: false,
      isYautja: true
    });

    this.spawnYautjaBloodSplatter(pos);
  }

  spawnAcidMeltCorpse(pos) {
    const meltGeo = new THREE.CylinderGeometry(1.6, 1.8, 0.25, 10);
    const meltMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      roughness: 0.9,
      metalness: 0.1
    });
    const slag = new THREE.Mesh(meltGeo, meltMat);
    slag.position.set(pos.x, 0.12, pos.z);
    this.scene.add(slag);

    // Glowing acid veins in melting slag
    const veinGeo = new THREE.RingGeometry(0.4, 1.3, 10);
    veinGeo.rotateX(-Math.PI / 2);
    const vein = new THREE.Mesh(veinGeo, this.acidGlowMat);
    vein.position.set(pos.x, 0.14, pos.z);
    this.scene.add(vein);

    this.acidGibs.push({
      mesh: slag,
      veinMesh: vein,
      life: 10
    });
  }

  /* Chantier 8: Wall-Pinning & Impalement Physics (Predator 2 / AvP: Requiem Lore) */
  spawnWallPinnedPart(pos, dir = null, weaponType = 'combistick') {
    const pinnedGroup = new THREE.Group();
    const pinY = Math.max(1.7, Math.min(2.8, pos.y > 0.5 ? pos.y : 1.9));
    pinnedGroup.position.set(pos.x, pinY, pos.z);

    // Severed upper torso & head pinned in agony
    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.32, 0.24, 1.1, 8), this.xenoFleshMat);
    pinnedGroup.add(torso);

    const head = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.28, 1.1, 8), this.xenoFleshMat);
    head.rotation.x = Math.PI / 2.2;
    head.position.set(0, 0.35, 0.25);
    pinnedGroup.add(head);

    // Pharyngeal inner jaw agape
    const innerJawMat = new THREE.MeshStandardMaterial({ color: 0x94a3b8, metalness: 0.9, roughness: 0.1 });
    const innerJaw = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.05, 0.35), innerJawMat);
    innerJaw.position.set(0, 0.32, 0.85);
    pinnedGroup.add(innerJaw);

    // Telescopic Combi-Stick or Arrow shaft driven straight through torso
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.95, roughness: 0.15 });
    const shaftLength = weaponType === 'arrow' ? 1.8 : 2.7;
    const shaftRadius = weaponType === 'arrow' ? 0.025 : 0.045;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(shaftRadius, shaftRadius, shaftLength, 8), shaftMat);
    shaft.rotation.x = Math.PI / 2;
    pinnedGroup.add(shaft);

    // Barbed spearheads
    const tipMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.1 });
    const frontTip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.38, 4), tipMat);
    frontTip.rotation.x = -Math.PI / 2;
    frontTip.position.set(0, 0, shaftLength * 0.5 + 0.15);
    pinnedGroup.add(frontTip);

    if (weaponType === 'combistick') {
      const rearTip = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.32, 4), tipMat);
      rearTip.rotation.x = Math.PI / 2;
      rearTip.position.set(0, 0, -shaftLength * 0.5 - 0.12);
      pinnedGroup.add(rearTip);
    }

    // Vertical acid drip running down the wall to the floor
    const dripGeo = new THREE.PlaneGeometry(0.22, pinY);
    const dripMat = new THREE.MeshBasicMaterial({ color: 0x39ff14, transparent: true, opacity: 0.75, side: THREE.DoubleSide });
    const dripMesh = new THREE.Mesh(dripGeo, dripMat);
    dripMesh.position.set(0, -pinY / 2, 0.02);
    pinnedGroup.add(dripMesh);

    // Acid puddle on floor beneath the impalement
    const puddleGeo = new THREE.RingGeometry(0.15, 0.85, 8);
    puddleGeo.rotateX(-Math.PI / 2);
    const puddle = new THREE.Mesh(puddleGeo, this.acidGlowMat);
    puddle.position.set(0, -pinY + 0.03, 0);
    pinnedGroup.add(puddle);

    if (dir && (dir.x !== 0 || dir.z !== 0)) {
      const targetDir = new THREE.Vector3(dir.x, 0, dir.z).normalize();
      pinnedGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), targetDir);
    }

    this.scene.add(pinnedGroup);
    this.pinnedParts.push({
      group: pinnedGroup,
      dripMesh: dripMesh,
      life: 20
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
          if (part.isYautja) {
            this.spawnYautjaBloodSplatter(part.mesh.position);
          } else {
            this.spawnAcidSplatter(part.mesh.position);
          }
        }
      }

      if (part.life <= 0) {
        this.scene.remove(part.mesh);
        this.severedParts.splice(i, 1);
      }
    }

  /* Chantier 6: Molecular Acid Metallic Floor Corrosion & Slag Decals */
  spawnAcidSlagDecal(pos, radius = 2.4, audioEngine = null) {
    const group = new THREE.Group();
    group.position.set(pos.x, 0.03, pos.z);

    // Deep caustic crater on metallic floor
    const craterGeo = new THREE.RingGeometry(0.2, radius, 16);
    craterGeo.rotateX(-Math.PI / 2);
    const craterMat = new THREE.MeshStandardMaterial({
      color: 0x080c10,
      roughness: 0.95,
      metalness: 0.7
    });
    const crater = new THREE.Mesh(craterGeo, craterMat);
    group.add(crater);

    // Sizzling acid fluorescent erosion veins
    const veinGeo = new THREE.RingGeometry(0.1, radius * 0.75, 12);
    veinGeo.rotateX(-Math.PI / 2);
    const vein = new THREE.Mesh(veinGeo, this.acidGlowMat);
    vein.position.y = 0.01;
    group.add(vein);

    // Rising vapor wisps
    const wisps = [];
    const wispMat = new THREE.MeshBasicMaterial({ color: 0x84cc16, transparent: true, opacity: 0.5 });
    for (let w = 0; w < 3; w++) {
      const wisp = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.12, 1.6, 6), wispMat);
      const angle = (w / 3) * Math.PI * 2;
      wisp.position.set(Math.cos(angle) * (radius * 0.4), 0.8, Math.sin(angle) * (radius * 0.4));
      group.add(wisp);
      wisps.push(wisp);
    }

    this.scene.add(group);
    this.acidSlagDecals.push({
      group: group,
      vein: vein,
      wisps: wisps,
      life: 18.0
    });

    if (audioEngine && audioEngine.playAcidFloorHiss) {
      audioEngine.playAcidFloorHiss();
    }
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
          if (part.isYautja) {
            this.spawnYautjaBloodSplatter(part.mesh.position);
          } else {
            this.spawnAcidSplatter(part.mesh.position);
          }
        }
      }

      if (part.life <= 0) {
        this.scene.remove(part.mesh);
        this.severedParts.splice(i, 1);
      }
    }

    // Update acid splatter & melting corpses dissipation
    for (let i = this.acidGibs.length - 1; i >= 0; i--) {
      const gib = this.acidGibs[i];
      gib.life -= delta;
      if (gib.life <= 0) {
        this.scene.remove(gib.mesh);
        if (gib.veinMesh) this.scene.remove(gib.veinMesh);
        this.acidGibs.splice(i, 1);
      }
    }

    // Update wall pinned impaled victims (Chantier 8)
    for (let i = this.pinnedParts.length - 1; i >= 0; i--) {
      const pin = this.pinnedParts[i];
      pin.life -= delta;
      if (pin.dripMesh && pin.dripMesh.material) {
        pin.dripMesh.material.opacity = 0.55 + Math.sin(Date.now() * 0.007) * 0.25;
      }
      if (pin.life <= 0) {
        this.scene.remove(pin.group);
        this.pinnedParts.splice(i, 1);
      }
    }

    // Update molecular acid floor slag decals (Chantier 6)
    for (let i = this.acidSlagDecals.length - 1; i >= 0; i--) {
      const slag = this.acidSlagDecals[i];
      slag.life -= delta;
      if (slag.vein && slag.vein.material) {
        slag.vein.material.opacity = Math.min(0.85, slag.life / 18.0) * (0.6 + Math.sin(Date.now() * 0.009) * 0.2);
      }
      if (slag.wisps) {
        slag.wisps.forEach((w, wIdx) => {
          w.rotation.y += delta * 2;
          w.position.y = 0.8 + Math.sin(Date.now() * 0.004 + wIdx) * 0.25;
        });
      }
      if (slag.life <= 0) {
        this.scene.remove(slag.group);
        this.acidSlagDecals.splice(i, 1);
      }
    }
  }

  clear() {
    this.severedParts.forEach(p => this.scene.remove(p.mesh));
    this.severedParts = [];
    this.acidGibs.forEach(g => {
      this.scene.remove(g.mesh);
      if (g.veinMesh) this.scene.remove(g.veinMesh);
    });
    this.acidGibs = [];
    this.pinnedParts.forEach(p => this.scene.remove(p.group));
    this.pinnedParts = [];
    this.acidSlagDecals.forEach(s => this.scene.remove(s.group));
    this.acidSlagDecals = [];
  }
}
