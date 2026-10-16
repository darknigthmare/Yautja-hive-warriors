/* Bad Blood Rogue Yautja Encounter System - Renegade Predator Ambush */

import * as THREE from 'three';

export class BadBloodManager {
  constructor(scene, audioEngine) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.badBlood = null;
    this.isActive = false;
  }

  spawnAmbush(playerPos) {
    if (this.badBlood) {
      this.scene.remove(this.badBlood.mesh);
    }

    const mesh = this.createBadBloodMesh();
    // Spawn 20m behind player
    mesh.position.set(playerPos.x + (Math.random() - 0.5) * 15, 0, playerPos.z + 18);
    this.scene.add(mesh);

    this.badBlood = {
      mesh,
      hp: 2200,
      maxHp: 2200,
      speed: 16,
      damage: 75,
      isCloaked: true,
      cloakTimer: 4.0,
      attackCooldown: 0
    };
    this.isActive = true;

    this.audioEngine.playYautjaRoar();
  }

  createBadBloodMesh() {
    const group = new THREE.Group();
    const armorMat = new THREE.MeshStandardMaterial({ color: 0x221111, metalness: 0.8, roughness: 0.3 }); // Dark crimson armor
    const skinMat = new THREE.MeshStandardMaterial({ color: 0x5a4835, roughness: 0.6 });

    const torso = new THREE.Mesh(new THREE.CylinderGeometry(0.95, 0.65, 2.3, 8), skinMat);
    torso.position.y = 2.2;
    group.add(torso);

    const chest = new THREE.Mesh(new THREE.BoxGeometry(1.6, 1.3, 1.3), armorMat);
    chest.position.y = 2.4;
    group.add(chest);

    // Defiled Bone Mask
    const mask = new THREE.Mesh(new THREE.SphereGeometry(0.68, 10, 10), new THREE.MeshStandardMaterial({ color: 0xddccaa, roughness: 0.5 }));
    mask.position.set(0, 3.6, 0.1);
    group.add(mask);

    // Dual Serrated Blood-Stained Wristblades (Barbaric Jagged Edges)
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0x991b1b, metalness: 0.95, roughness: 0.2 });
    [-1.25, 1.25].forEach(side => {
      const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.2, 1.6, 6), skinMat);
      arm.position.set(side, 2.2, 0);
      group.add(arm);

      const gauntlet = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.6, 0.4), armorMat);
      gauntlet.position.set(side, 1.6, 0.1);
      group.add(gauntlet);

      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.08, 1.6, 0.04), bladeMat);
      blade.position.set(side, 1.6, 0.9);
      blade.rotation.x = Math.PI / 2;
      group.add(blade);
    });

    // Dreadlocks with bone quills (Wild unkempt renegade hair)
    const dreadMat = new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.9 });
    for (let d = -4; d <= 4; d++) {
      const dread = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.04, 1.8, 6), dreadMat);
      const angle = (d / 4) * Math.PI * 0.45;
      dread.position.set(Math.sin(angle) * 0.6, 3.3, -0.4 - Math.cos(angle) * 0.25);
      dread.rotation.x = -0.4;
      dread.rotation.z = angle * 0.4;
      group.add(dread);
    }

    // Severed Skull Trophies Clustered at Belt (Taboo dishonor trophies - Dark Horse Comics 1993)
    const boneMat = new THREE.MeshStandardMaterial({ color: 0xd4cdb4, roughness: 0.6 });
    for (let s = 0; s < 3; s++) {
      const skull = new THREE.Mesh(new THREE.SphereGeometry(0.2, 6, 6), boneMat);
      skull.position.set((s - 1) * 0.45, 1.2, 0.7);
      group.add(skull);
    }

    // Plasma Caster Cannon on shoulder
    const casterMat = new THREE.MeshStandardMaterial({ color: 0x1c1917, metalness: 0.9 });
    const caster = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.8, 6), casterMat);
    caster.rotation.x = Math.PI / 2;
    caster.position.set(-1.1, 3.4, 0.2);
    group.add(caster);

    return group;
  }

  update(delta, player, ui = null, gore = null, particles = null, game = null) {
    if (!this.isActive || !this.badBlood) return;

    // Handle Active Clashing Blades Honor Duel (Chantier 10)
    if (this.isDueling) {
      this.updateDuel(delta, player, ui, gore, particles, game);
      return;
    }

    const bb = this.badBlood;

    // Trigger Honor Duel when Bad Blood is bloodied (< 40% HP) and in close quarters
    if (bb.hp <= 850 && !this.duelTriggered && player.position.distanceTo(bb.mesh.position) <= 4.5) {
      this.startHonorDuel(player, ui);
      return;
    }

    // Cloaking flicker
    bb.cloakTimer -= delta;
    if (bb.cloakTimer <= 0) {
      bb.isCloaked = !bb.isCloaked;
      bb.cloakTimer = bb.isCloaked ? 3.5 : 5.0;
      bb.mesh.traverse(child => {
        if (child.isMesh) {
          child.material.transparent = bb.isCloaked;
          child.material.opacity = bb.isCloaked ? 0.35 : 1.0;
        }
      });
      this.audioEngine.playYautjaClick();
    }

    // Aggressive dash & strike
    const dir = player.position.clone().sub(bb.mesh.position);
    dir.y = 0;
    const dist = dir.length();

    // Plasma Caster Cannon shot at medium distance (6m - 18m)
    if (!bb.plasmaTimer) bb.plasmaTimer = 3.0;
    bb.plasmaTimer -= delta;
    if (dist >= 6.0 && dist <= 18.0 && bb.plasmaTimer <= 0) {
      bb.plasmaTimer = 4.2;
      this.audioEngine.playPlasmaShot();
      if (!player.isBlocking) {
        player.takeDamage(55);
      } else {
        player.audioEngine.playShieldBlock();
      }
    }

    if (dist > 2.2) {
      dir.normalize();
      bb.mesh.position.addScaledVector(dir, bb.speed * delta);
      bb.mesh.rotation.y = Math.atan2(dir.x, dir.z);
    } else {
      if (bb.attackCooldown <= 0) {
        bb.attackCooldown = 0.8;
        this.audioEngine.playSlash();
        player.takeDamage(bb.damage);
      }
    }

    if (bb.attackCooldown > 0) {
      bb.attackCooldown -= delta;
    }
  }

  /* Chantier 10: Dynamic Predator Honor Code Duels & Clashing Blades 3-Stage QTE */
  startHonorDuel(player, ui) {
    if (!this.badBlood || this.isDueling) return;
    this.isDueling = true;
    this.duelTriggered = true;
    this.duelStage = 1;
    this.duelTimer = 2.4;
    this.duelKey = 'KeyF';
    this.duelKeyLabel = 'F';
    this.duelPromptText = 'PARADE ÉCLAIR DE LAMES';

    // Position Bad Blood face-to-face with player
    const lookDir = player.position.clone().sub(this.badBlood.mesh.position).normalize();
    lookDir.y = 0;
    this.badBlood.mesh.position.copy(player.position).addScaledVector(lookDir, -1.8);
    this.badBlood.mesh.rotation.y = Math.atan2(lookDir.x, lookDir.z);

    this.audioEngine.playYautjaRoar();
    if (this.audioEngine.playShieldBlock) this.audioEngine.playShieldBlock();

    this.showDuelUI(ui);
  }

  showDuelUI(ui) {
    const duelBanner = document.getElementById('clashing-blades-prompt');
    const letterboxTop = document.getElementById('duel-letterbox-top');
    const letterboxBottom = document.getElementById('duel-letterbox-bottom');
    if (letterboxTop) letterboxTop.classList.remove('hidden');
    if (letterboxBottom) letterboxBottom.classList.remove('hidden');

    if (duelBanner) {
      duelBanner.classList.remove('hidden');
      const keyElem = document.getElementById('duel-qte-key');
      const actionElem = document.getElementById('duel-qte-action');
      const stageElem = document.getElementById('duel-qte-stage');
      const timerBar = document.getElementById('duel-qte-timer-fill');

      if (keyElem) keyElem.innerText = this.duelKeyLabel;
      if (actionElem) actionElem.innerText = this.duelPromptText;
      if (stageElem) stageElem.innerText = `DUEL D'HONNEUR YAUTJA : PHASE ${this.duelStage}/3`;
      if (timerBar) timerBar.style.width = '100%';
    }
    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`⚔️ DUEL D'HONNEUR YAUTJA ! APPUYEZ SUR [${this.duelKeyLabel}] POUR CLASHER LES LAMES !`);
    }
  }

  updateDuel(delta, player, ui, gore, particles, game) {
    if (!this.isDueling || !this.badBlood) return;

    this.duelTimer -= delta;
    const timerBar = document.getElementById('duel-qte-timer-fill');
    if (timerBar) {
      const pct = Math.max(0, (this.duelTimer / 2.4) * 100);
      timerBar.style.width = `${pct}%`;
    }

    // Spark effect between blades during lock
    if (particles && particles.emitSparks && Math.random() < 0.4) {
      const midPoint = player.position.clone().add(this.badBlood.mesh.position).multiplyScalar(0.5);
      midPoint.y = 1.8;
      particles.emitSparks(midPoint, 4);
    }

    if (this.duelTimer <= 0) {
      // Duel QTE timeout - Bad Blood counters
      this.failHonorDuel(player, ui);
    }
  }

  handleDuelInput(eCode, player, ui, gore, particles, game) {
    if (!this.isDueling || !this.badBlood) return false;

    if (eCode === this.duelKey) {
      // Successful clash stage
      if (this.audioEngine.playShieldBlock) this.audioEngine.playShieldBlock();
      if (particles && particles.emitSparks) {
        const midPoint = player.position.clone().add(this.badBlood.mesh.position).multiplyScalar(0.5);
        midPoint.y = 1.8;
        particles.emitSparks(midPoint, 15);
      }
      if (game && game.triggerCameraShake) {
        game.triggerCameraShake(0.8, 0.25);
      }

      this.duelStage++;
      if (this.duelStage === 2) {
        this.duelTimer = 2.2;
        this.duelKey = 'Space';
        this.duelKeyLabel = 'ESPACE';
        this.duelPromptText = 'ÉPREUVE DE FORCE AU BRAS';
        this.showDuelUI(ui);
        return true;
      } else if (this.duelStage === 3) {
        this.duelTimer = 2.0;
        this.duelKey = 'KeyE';
        this.duelKeyLabel = 'E';
        this.duelPromptText = 'TRANCHE-GORGERET DÉCAPITANT !';
        this.showDuelUI(ui);
        return true;
      } else {
        // Stage 3 complete -> GLORIOUS DECAPITATION EXECUTION
        this.completeHonorDuelExecution(player, ui, gore, particles, game);
        return true;
      }
    } else {
      // Pressed wrong key -> fail duel
      this.failHonorDuel(player, ui);
      return false;
    }
  }

  completeHonorDuelExecution(player, ui, gore, particles, game) {
    this.endDuelUI();
    const bbPos = this.badBlood.mesh.position.clone();

    if (this.audioEngine.playSlash) this.audioEngine.playSlash();
    this.audioEngine.playYautjaRoar();

    if (particles && particles.emitAlienBloodSpurt) {
      particles.emitAlienBloodSpurt(bbPos, 35);
    }
    if (gore && gore.spawnYautjaSeveredHead) {
      gore.spawnYautjaSeveredHead(bbPos);
    }

    // Award +3000 Honor & Taboo Trophy
    const tName = 'Masque Cérémoniel & Tête Décapitée du Bad Blood Renégat (Duel d\'Honneur 1:1)';
    const tHonor = 3000;
    if (player && player.recordTrophy) player.recordTrophy(tName, tHonor);
    if (game) {
      game.sessionSkulls = (game.sessionSkulls || 0) + 1;
      game.score = (game.score || 0) + tHonor;
      if (game.shiftBattlefieldMorale) game.shiftBattlefieldMorale(35.0);
      if (game.triggerCameraShake) game.triggerCameraShake(1.5, 0.6);
      if (game.triggerCameraFovSurge) game.triggerCameraFovSurge(72, 0.6);
    }

    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement(`👑 VICTOIRE DUEL D'HONNEUR ! ${tName} (+${tHonor} HONNEUR, MORAL +35%) !`);
    }

    this.scene.remove(this.badBlood.mesh);
    this.badBlood = null;
    this.isActive = false;
    this.isDueling = false;
  }

  failHonorDuel(player, ui) {
    this.endDuelUI();
    this.isDueling = false;
    if (this.audioEngine.playSlash) this.audioEngine.playSlash();
    if (player) {
      player.takeDamage(65);
      const knock = player.position.clone().sub(this.badBlood.mesh.position).normalize();
      player.position.addScaledVector(knock, 6.0);
      if (player.mesh) player.mesh.position.copy(player.position);
    }
    if (ui && ui.showAnnouncement) {
      ui.showAnnouncement('⚠️ DUEL D\'HONNEUR ROMPU : CONTRE-ATTAQUE DU BAD BLOOD (-65 PV) !');
    }
  }

  endDuelUI() {
    const duelBanner = document.getElementById('clashing-blades-prompt');
    const letterboxTop = document.getElementById('duel-letterbox-top');
    const letterboxBottom = document.getElementById('duel-letterbox-bottom');
    if (letterboxTop) letterboxTop.classList.add('hidden');
    if (letterboxBottom) letterboxBottom.classList.add('hidden');
    if (duelBanner) duelBanner.classList.add('hidden');
  }

  takeDamage(amount) {
    if (!this.badBlood || this.isDueling) return false;
    this.badBlood.hp -= amount;
    if (this.badBlood.hp <= 0) {
      this.scene.remove(this.badBlood.mesh);
      this.badBlood = null;
      this.isActive = false;
      this.audioEngine.playYautjaRoar();
      return true; // Killed Bad Blood!
    }
    return false;
  }

  clear() {
    this.endDuelUI();
    if (this.badBlood) {
      this.scene.remove(this.badBlood.mesh);
      this.badBlood = null;
    }
    this.isActive = false;
    this.isDueling = false;
  }
}
