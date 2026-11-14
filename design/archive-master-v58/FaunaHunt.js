/* Fauna hunts of the Unblooded campaign (bible: campagne-unblooded.md, decisions HW-DEC-48 to 79).
 *
 * The pack hunts zone by zone. Each zone holds a herd and its leader; killing the leader takes
 * the zone and opens the next. The last zone holds the world's great prey: stun it, execute it,
 * and the hunt is won. Animals live in the horde's alien list with `isFauna`, so the hunter's
 * attacks, the kit and the allies reach them without special cases.
 */

import * as THREE from 'three';

// The eight worlds of the Unblooded campaign (bible tab 22_RegionsFaune). Great prey with a Bible V6
// ID come from its fauna sheet; herds, leaders and the other prey are creations of Hive Warriors.
// Numbers are first guesses, to tune after play.
const Z = (a, b, c) => [{ center: [-38, -32], herd: a }, { center: [36, -30], herd: b }, { center: [34, 34], herd: c }];
const withLines = (zones, lines) => zones.map((z, i) => ({ ...z, line: lines[i] }));

export const FAUNA_WORLDS = {
  vara_kesh: {
    title: 'VARA-KESH',
    herd: { name: 'Coureur de lianes', hp: 90, speed: 13, bite: 10, radius: 0.9, color: 0x5b6b2f, size: 0.9 },
    leader: { name: 'Mâle dominant', hp: 700, speed: 11, bite: 45, charge: 120, radius: 1.6, color: 0x3f4a1e, size: 1.7 },
    zones: withLines(Z(10, 12, 14), [
      'SAAR : « Approche. » La première harde broute sous les racines.',
      'SAAR : « Vers le filet ! » Une harde plus nerveuse, dans la ravine.',
      'SAAR : « Regarde ses pattes. » Le mâle de cette harde charge avant de mordre.']),
    prey: { center: [-34, 38], line: 'Le Faucheur de Vara-Kesh descend des branches fortes : attirez-le sur un passage dégagé.' },
    reward: { ability: 'netgun', label: 'Lance-filet' },
    victory: 'Le Faucheur de Vara-Kesh est tombé. Saar vous remet un lance-filet.',
  },
  eshra: {
    title: 'ESHRA',
    herd: { name: 'Rampeur de vase', hp: 110, speed: 9, bite: 12, radius: 1.0, color: 0x4a4a3a, size: 1.0 },
    leader: { name: 'Matrone de vase', hp: 900, speed: 5, bite: 40, radius: 2.0, color: 0x2e3326, size: 2.0, spawns: 6 },
    zones: withLines(Z(10, 12, 14), [
      'SAAR : « Elle pond tant qu\'elle vit. » Tuez la matrone d\'abord.',
      'SAAR : « Les chenaux ralentissent. Restez sur les îlots. »',
      'SAAR : « Trois matrones ont nourri ce marais. Celle-ci est la dernière. »']),
    prey: { center: [-34, 38], line: 'L\'Hydre sort de la brume : chaque tête abattue l\'affaiblit.' },
    reward: { ability: 'bear_trap', label: 'Piège à mâchoires' },
    victory: 'L\'Hydre d\'Eshra est tombée. Saar vous confie des pièges à mâchoires.',
  },
  kharuun: {
    title: 'KHARUUN',
    herd: { name: 'Coureur des canyons', hp: 100, speed: 16, bite: 12, radius: 0.9, color: 0x8a6a45, size: 0.95 },
    leader: { name: 'Fouisseur géant', hp: 1000, speed: 10, bite: 55, radius: 1.8, color: 0x6b5236, size: 1.9, burrows: true },
    zones: withLines(Z(12, 14, 16), [
      'SAAR : « Lisez le sol. » Le fouisseur laisse des sillons.',
      'SAAR : « Restez sur la roche quand il plonge. »',
      'SAAR : « Le vent efface les pistes. Pas celle-ci. »']),
    prey: { center: [-34, 38], line: 'La Gueule des sables ne se touche que lorsqu\'elle émerge : la bête qui efface sa piste dans le vent.' },
    reward: { ability: 'voice_lure', label: 'Leurre sonore' },
    victory: 'La Gueule des sables est tombée. Saar vous apprend le leurre sonore.',
  },
  terek_va: {
    title: 'TEREK-VA',
    herd: { name: 'Nuée des puits', hp: 50, speed: 15, bite: 8, radius: 0.7, color: 0x6e3b3b, size: 0.7 },
    leader: { name: 'Nœud de nuée', hp: 1100, speed: 0, bite: 0, radius: 2.2, color: 0x4b1f2a, size: 2.2, spawns: 4, stationary: true },
    zones: withLines(Z(24, 28, 32), [
      'SAAR : « Une seule voix commande la nuée. Trouvez le nœud. »',
      'SAAR : « Tenez la galerie. Ils viendront par dizaines. »',
      'SAAR : « Retenez ce que vous ressentez. Vous le reverrez. »']),
    prey: { center: [-34, 38], line: 'L\'Esprit de ruche des profondeurs : traversez sa nuée pour l\'atteindre.' },
    reward: { ability: 'tripwire_mine', label: 'Mines' },
    victory: 'L\'Esprit de ruche est tombé. Saar vous confie des mines.',
  },
  nereth: {
    title: 'NERETH',
    herd: { name: 'Rôdeur blanc', hp: 120, speed: 14, bite: 16, radius: 1.0, color: 0xdfe8ee, size: 1.0, faint: true },
    leader: { name: 'Femelle alpha', hp: 1200, speed: 13, bite: 55, charge: 140, radius: 1.8, color: 0xc2ccd4, size: 1.8 },
    zones: withLines(Z(12, 14, 16), [
      'SAAR : « Ils sont blancs sur blanc. Changez de vision [V]. »',
      'SAAR : « Elle fait encercler. Ne restez pas seul. »',
      'Une mue de Xénomorphe est prise dans la glace. Saar ne la commente pas.']),
    prey: { center: [-34, 38], line: 'La Mâchoire de Nereth attaque depuis un couloir gelé.' },
    reward: { ability: 'smart_disc', label: 'Disque' },
    victory: 'La Mâchoire de Nereth est tombée. Saar vous remet un disque.',
  },
  oshara: {
    title: 'OSHARA',
    herd: { name: 'Pince de récif', hp: 170, speed: 7, bite: 20, radius: 1.1, color: 0x8a3b2b, size: 1.1 },
    leader: { name: 'Vieux mâle cuirassé', hp: 1400, speed: 6, bite: 70, radius: 2.1, color: 0x5e2a20, size: 2.1 },
    zones: withLines(Z(10, 12, 14), [
      'SAAR : « La marée monte. Ne traînez pas. »',
      'SAAR : « Frappez-les de loin, ou par-dessous. »',
      'De la résine noire couvre la paroi d\'une grotte côtière.']),
    prey: { center: [-34, 38], line: 'Le Nageur d\'Oshara change de rive après chaque immersion.' },
    reward: { ability: 'flechettes', label: 'Fléchettes' },
    victory: 'Le Nageur d\'Oshara est tombé. Saar vous apprend les fléchettes.',
  },
  rukh_tal: {
    title: 'RUKH TAL',
    herd: { name: 'Lézard de cendre', hp: 140, speed: 12, bite: 18, radius: 1.0, color: 0x3a3330, size: 1.0 },
    leader: { name: 'Lézard cuirassé', hp: 1500, speed: 10, bite: 65, charge: 160, radius: 2.0, color: 0x241f1d, size: 2.0 },
    zones: withLines(Z(12, 14, 16), [
      'KAEDH : « Pas encore. » Un Bad Blood rôde : l\'Elite quitte son poste. Personne ne vous relèvera.',
      'Une carcasse ouverte de l\'intérieur gît au bord d\'une coulée.',
      'SAAR : « Comptez les cycles de vapeur. »']),
    prey: { center: [-34, 38], line: 'L\'Éperon de Rukh Tal charge à la fin d\'un cycle de vapeur.' },
    reward: { ability: 'cloak', label: 'Camouflage' },
    victory: 'L\'Éperon de Rukh Tal est tombé. Kaedh revient : il vous apprend le camouflage.',
  },
  dharos: {
    title: 'DHAROS',
    herd: { name: 'Charognard des rues', hp: 150, speed: 15, bite: 20, radius: 1.0, color: 0x55524a, size: 1.0 },
    leader: { name: 'Sentinelle', hp: 1600, speed: 8, bite: 70, radius: 2.0, color: 0x3a3833, size: 2.0, spawns: 8 },
    zones: withLines(Z(14, 16, 18), [
      'SAAR : « Tout le kit, maintenant. »',
      'SAAR : « Elles réveillent le quartier. Faites vite. »',
      'Un œuf éclos, vide, au fond d\'un sous-sol. Saar dit seulement que la prochaine chasse sera différente.']),
    prey: { center: [-34, 38], line: 'Le Guetteur de Dharos observe depuis une fenêtre avant de descendre.' },
    reward: { ability: 'shuriken', label: 'Shuriken' },
    victory: 'Le Guetteur de Dharos est tombé. Saar vous remet un shuriken. Le rite vous attend.',
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
    g.ui.showAnnouncement(`🌿 ${this.world.title} : LA MEUTE EST DÉPOSÉE PAR LA LAME PATIENTE. TROIS HARDES, PUIS LA GRANDE PROIE.`);
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
      spawnTimer: spec.spawns || 0,
      burrowTimer: 5 + Math.random() * 3,
      burrowLeft: 0,
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
    if (spec.faint) {
      // Near-invisible against snow unless the hunter switches vision.
      group.traverse(o => { if (o.material) { o.material = o.material.clone(); o.material.transparent = true; o.material.opacity = 0.18; } });
    }
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
      if (dir.lengthSq() < 0.0001 || speed <= 0) return;
      dir.normalize();
      pos.addScaledVector(dir, speed * delta);
      a.mesh.rotation.y = Math.atan2(dir.x, dir.z);
      pos.x = THREE.MathUtils.clamp(pos.x, -66, 66);
      pos.z = THREE.MathUtils.clamp(pos.z, -66, 66);
    };
    const unaware = g.horde.isAlerted === false;

    if (a.isFleeing) {
      step(toPlayer.clone().negate(), a.speed * 1.2 || 10);
      if (dist > 45) a.hp = 0; // gone into the wild
      return;
    }
    // A badly wounded herd animal breaks and runs: hitting it brings no honour.
    if (a.role === 'herd' && a.hp < a.maxHp * 0.35) {
      a.isFleeing = true;
      return;
    }

    if (a.role === 'leader' && !unaware) {
      const spec = this.world.leader;
      // Some leaders keep feeding their herd while they live.
      if (spec.spawns) {
        a.spawnTimer -= delta;
        const herdCount = g.horde.aliens.filter(x => x.isFauna && x.role === 'herd' && !x.isFleeing).length;
        if (a.spawnTimer <= 0 && herdCount < 30) {
          a.spawnTimer = spec.spawns;
          this.spawnAnimal('herd', pos.clone().add(new THREE.Vector3((Math.random() - 0.5) * 4, 0, (Math.random() - 0.5) * 4)), a.home);
        }
      }
      if (spec.stationary) {
        a.mesh.rotation.y += delta * 0.6;
        return;
      }
    }

    const aggro = a.role === 'leader' ? 30 : 22;
    if (unaware || dist > aggro) {
      a.wanderAngle += (Math.random() - 0.5) * delta * 2;
      const target = a.home.clone().add(new THREE.Vector3(Math.cos(a.wanderAngle) * 6, 0, Math.sin(a.wanderAngle) * 6));
      step(target.sub(pos), a.speed * 0.25);
      return;
    }

    if (a.role === 'leader') {
      const spec = this.world.leader;
      // Burrowers dive, travel under the sand and erupt under the hunter.
      if (spec.burrows) {
        if (a.burrowLeft > 0) {
          a.burrowLeft -= delta;
          step(toPlayer.clone(), a.speed * 1.6);
          if (a.burrowLeft <= 0) {
            a.mesh.visible = true;
            if (dist < 4) player.takeDamage(90, false, a);
          }
          return;
        }
        a.burrowTimer -= delta;
        if (a.burrowTimer <= 0 && dist > 6) {
          a.burrowTimer = 8;
          a.burrowLeft = 2.2;
          a.mesh.visible = false;
          g.ui.showAnnouncement(`⚠️ LE ${a.name.toUpperCase()} PLONGE SOUS LE SABLE : RESTEZ EN MOUVEMENT !`);
          return;
        }
      }
      a.chargeTimer -= delta;
      if (a.chargeLeft > 0) {
        a.chargeLeft -= delta;
        step(a.chargeDir.clone(), a.speed * 2.4);
        if (dist < 2.6) {
          player.takeDamage(spec.charge || spec.bite, false, a);
          a.chargeLeft = 0;
        }
        return;
      }
      if (spec.charge && a.chargeTimer <= 0 && dist > 6 && dist < 24) {
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
        g.huntVictoryText = this.world.victory;
        if (g.onFaunaHuntWon) g.onFaunaHuntWon(this.world);
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
