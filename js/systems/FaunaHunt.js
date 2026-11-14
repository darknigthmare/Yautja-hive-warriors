/* Fauna hunts of the Unblooded campaign (bible: campagne-unblooded.md, decisions HW-DEC-48 to 79).
 *
 * The pack hunts zone by zone. Each zone holds a herd and its leader; killing the leader takes
 * the zone and opens the next. The last zone holds the world's great prey: stun it, execute it,
 * and the hunt is won. Animals live in the horde's alien list with `isFauna`, so the hunter's
 * attacks, the kit and the allies reach them without special cases.
 */

import * as THREE from 'three';

// Vara-Kesh (Bible V6 atlas PLAN03): dense jungle, canopy, roots and ravines.
export const FAUNA_WORLDS = {
  vara_kesh: {
    herd: { name: 'Coureur de lianes', hp: 90, speed: 13, bite: 10, radius: 0.9, color: 0x5b6b2f, size: 0.9 },
    leader: { name: 'Mâle dominant', hp: 700, speed: 11, bite: 45, charge: 120, radius: 1.6, color: 0x3f4a1e, size: 1.7 },
    zones: [
      { center: [-38, -32], herd: 10, line: 'SAAR : « Approche. » La première harde broute sous les racines.' },
      { center: [36, -30], herd: 12, line: 'SAAR : « Vers le filet ! » Une harde plus nerveuse, dans la ravine.' },
      { center: [34, 34], herd: 14, line: 'SAAR : « Regarde ses pattes. » Le mâle de cette harde charge avant de mordre.' },
    ],
    prey: { center: [-34, 38], line: 'SAAR : « Il est là-haut. » Le Faucheur de Vara-Kesh descend des branches fortes.' },
  },
};

export class FaunaHunt {
  constructor(game) {
    this.game = game;
    this.active = false;
  }

  start(worldId) {
    const g = this.game;
    this.world = FAUNA_WORLDS[worldId] || FAUNA_WORLDS.vara_kesh;
    this.zoneIndex = -1;
    this.zoneTimer = 0;
    this.preySpawned = false;
    this.preyPhase = false;
    this.active = true;
    this.leader = null;
    this.clearMarker();
    this.activateZone(0);
    g.ui.showAnnouncement('🌿 VARA-KESH : LA MEUTE EST DÉPOSÉE. TROIS HARDES, PUIS LA GRANDE PROIE.');
  }

  stop() {
    this.active = false;
    this.clearMarker();
  }

  activateZone(index) {
    const g = this.game;
    this.zoneIndex = index;
    const zone = this.world.zones[index];
    const [cx, cz] = zone.center;
    const center = new THREE.Vector3(cx, 0, cz);
    this.placeMarker(center);
    for (let i = 0; i < zone.herd; i++) {
      const angle = (i / zone.herd) * Math.PI * 2;
      const pos = center.clone().add(new THREE.Vector3(Math.cos(angle) * (4 + Math.random() * 6), 0, Math.sin(angle) * (4 + Math.random() * 6)));
      this.spawnAnimal('herd', pos, center);
    }
    this.leader = this.spawnAnimal('leader', center.clone(), center);
    g.ui.showAnnouncement(`🎯 ZONE ${index + 1}/${this.world.zones.length} — ${zone.line}`);
  }

  spawnAnimal(role, pos, home) {
    const g = this.game;
    const spec = this.world[role];
    const mesh = this.buildMesh(spec, role === 'leader');
    mesh.position.copy(pos);
    g.renderer.scene.add(mesh);
    const animal = {
      isFauna: true,
      role,
      type: role === 'leader' ? 'fauna_leader' : 'fauna_herd',
      name: spec.name,
      mesh,
      hp: spec.hp,
      maxHp: spec.hp,
      speed: spec.speed,
      damage: spec.bite,
      radius: spec.radius,
      home,
      biteTimer: Math.random(),
      chargeTimer: 4 + Math.random() * 2,
      chargeLeft: 0,
      isFleeing: false,
      wanderAngle: Math.random() * Math.PI * 2,
    };
    animal.faunaUpdate = (delta, player) => this.updateAnimal(animal, delta, player);
    g.horde.aliens.push(animal);
    return animal;
  }

  buildMesh(spec, isLeader) {
    const group = new THREE.Group();
    const s = spec.size;
    const hide = new THREE.MeshStandardMaterial({ color: spec.color, roughness: 0.85 });
    const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f10, roughness: 0.9 });
    const body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.7 * s, 1.8 * s), hide);
    body.position.y = 0.9 * s;
    group.add(body);
    const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.5 * s, 0.7 * s), hide);
    head.position.set(0, 1.15 * s, 1.15 * s);
    group.add(head);
    [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]].forEach(([x, z]) => {
      const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.07 * s, 0.9 * s, 5), dark);
      leg.position.set(x * s, 0.45 * s, z * s);
      group.add(leg);
    });
    if (isLeader) {
      // Bone crest that marks the herd's leader from afar.
      const crest = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, 0.9 * s, 5), new THREE.MeshStandardMaterial({ color: 0xd9d0b4, roughness: 0.6 }));
      crest.position.set(0, 1.75 * s, 0.6 * s);
      crest.rotation.x = -0.5;
      group.add(crest);
    }
    return group;
  }

  updateAnimal(a, delta, player) {
    const g = this.game;
    const pos = a.mesh.position;
    const toPlayer = player.position.clone().sub(pos).setY(0);
    const dist = toPlayer.length();
    const step = (dir, speed) => {
      dir.setY(0);
      if (dir.lengthSq() < 0.0001) return;
      dir.normalize();
      pos.addScaledVector(dir, speed * delta);
      a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      pos.x = THREE.MathUtils.clamp(pos.x, -66, 66);
      pos.z = THREE.MathUtils.clamp(pos.z, -66, 66);
    };

    // Unaware (stealth opening) or far from the hunter: graze around home.
    const unaware = g.horde.isAlerted === false;
    if (a.isFleeing) {
      step(toPlayer.clone().negate(), a.speed * 1.2);
      if (dist > 45) a.hp = 0; // gone into the canopy
      return;
    }
    // A badly wounded herd animal breaks and runs: hitting it brings no honour.
    if (a.role === 'herd' && a.hp < a.maxHp * 0.35) {
      a.isFleeing = true;
      return;
    }
    const aggro = a.role === 'leader' ? 30 : 22;
    if (unaware || dist > aggro) {
      a.wanderAngle += (Math.random() - 0.5) * delta * 2;
      const target = a.home.clone().add(new THREE.Vector3(Math.cos(a.wanderAngle) * 6, 0, Math.sin(a.wanderAngle) * 6));
      step(target.sub(pos), a.speed * 0.25);
      return;
    }

    if (a.role === 'leader') {
      a.chargeTimer -= delta;
      if (a.chargeLeft > 0) {
        a.chargeLeft -= delta;
        step(a.chargeDir.clone(), a.speed * 2.4);
        if (dist < 2.6) {
          player.takeDamage(this.world.leader.charge, false, a);
          a.chargeLeft = 0;
        }
        return;
      }
      if (a.chargeTimer <= 0 && dist > 6 && dist < 24) {
        a.chargeTimer = 6.5;
        a.chargeLeft = 1.0;
        a.chargeDir = toPlayer.clone().normalize();
        g.ui.showAnnouncement(`⚠️ LE ${a.name.toUpperCase()} CHARGE : ESQUIVEZ [ALT] !`);
        return;
      }
    }

    if (dist > 2.2) {
      step(toPlayer.clone(), a.speed);
    } else {
      a.biteTimer -= delta;
      if (a.biteTimer <= 0) {
        a.biteTimer = a.role === 'leader' ? 1.4 : 1.0;
        player.takeDamage(a.damage, false, a);
      }
    }
  }

  update(delta) {
    if (!this.active) return;
    const g = this.game;
    if (this.markerMesh) this.markerMesh.rotation.y += delta;

    if (this.preyPhase) {
      if (this.preySpawned && !g.bosses.activeBoss) {
        this.stop();
        g.huntVictoryText = 'Le Faucheur de Vara-Kesh est tombé. Son crâne rejoindra le mur de La Lame Patiente.';
        g.endGame(true);
      }
      return;
    }

    if (this.zoneTimer > 0) {
      this.zoneTimer -= delta;
      if (this.zoneTimer <= 0) this.nextZone();
      return;
    }

    const leaderAlive = this.leader && this.leader.hp > 0 && g.horde.aliens.includes(this.leader);
    if (!leaderAlive) this.captureZone();
  }

  captureZone() {
    const g = this.game;
    // The herd scatters once its leader falls.
    g.horde.aliens.forEach(a => { if (a.isFauna && a.role === 'herd') a.isFleeing = true; });
    g.score += 500;
    g.shiftBattlefieldMorale(10);
    g.ui.showAnnouncement(`✅ ZONE ${this.zoneIndex + 1} PRISE : LE MENEUR EST TOMBÉ, LA HARDE SE DISPERSE (+500 HONNEUR)`);
    this.leader = null;
    this.clearMarker();
    this.zoneTimer = 3.5;
  }

  nextZone() {
    const g = this.game;
    if (this.zoneIndex + 1 < this.world.zones.length) {
      this.activateZone(this.zoneIndex + 1);
      return;
    }
    // Great prey.
    const [cx, cz] = this.world.prey.center;
    const pos = new THREE.Vector3(cx, 0, cz);
    this.placeMarker(pos);
    g.bosses.spawnBoss(g.ui.selectedLevel.bossType, pos, g.ui.selectedLevel.bossHp || null);
    this.preySpawned = true;
    this.preyPhase = true;
    g.ui.showAnnouncement(`👑 GRANDE PROIE — ${this.world.prey.line}`);
  }

  placeMarker(pos) {
    const g = this.game;
    this.clearMarker();
    const beam = new THREE.Mesh(
      new THREE.CylinderGeometry(0.35, 0.35, 40, 8, 1, true),
      new THREE.MeshBasicMaterial({ color: 0xffb703, transparent: true, opacity: 0.28, side: THREE.DoubleSide })
    );
    beam.position.set(pos.x, 20, pos.z);
    g.renderer.scene.add(beam);
    this.markerMesh = beam;
  }

  clearMarker() {
    if (this.markerMesh && this.markerMesh.parent) this.markerMesh.parent.remove(this.markerMesh);
    this.markerMesh = null;
  }
}
