/* PREDATOR: HIVE WARRIORS - Main Game Router (v12.0 Apex Transcendent Edition) */

import * as THREE from 'three';
import { EngineRenderer } from './engine/Renderer.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { GoreEngine } from './engine/GoreEngine.js';
import { OrbitalStrikeManager } from './engine/OrbitalStrike.js';
import { StoryCampaignManager } from './engine/StoryCampaign.js';
import { WeatherSystem } from './engine/WeatherSystem.js';
import { UIManager } from './ui/UIManager.js';
import { ForgeShop } from './ui/ForgeShop.js';
import { SandboxEditor } from './ui/SandboxEditor.js';
import { PhotoMode } from './ui/PhotoMode.js';
import { LoadoutScreen } from './ui/LoadoutScreen.js';
import { WeaponWheel } from './ui/WeaponWheel.js';
import { LoreCodexManager } from './ui/LoreCodex.js';
import { Player } from './entities/Player.js';
import { XenomorphHorde } from './entities/XenomorphHorde.js';
import { BossManager } from './entities/Bosses.js';
import { YautjaAlliesManager } from './entities/YautjaAllies.js';
import { YautjaSkimmer } from './entities/YautjaSkimmer.js';
import { YautjaCitadel } from './entities/YautjaCitadel.js';
import { ColonialMarinesManager } from './entities/ColonialMarines.js';
import { SyntheticsManager } from './entities/Synthetics.js';
import { BadBloodManager } from './entities/BadBloodEncounter.js';
import { HellHoundsManager } from './entities/HellHounds.js';
import { DropPodEntrance } from './entities/DropPodEntrance.js';
import { CheyenneDropship } from './entities/CheyenneDropship.js';
import { EnvironmentManager } from './entities/Environment.js';
import { CHARACTERS_DATA } from './data/charactersData.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.renderer = new EngineRenderer(this.container);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem(this.renderer.scene);
    this.gore = new GoreEngine(this.renderer.scene);
    this.orbital = new OrbitalStrikeManager(this.renderer.scene, this.audio);
    this.campaign = new StoryCampaignManager(this.ui);
    this.weather = new WeatherSystem(this.renderer.scene);
    this.forge = new ForgeShop(this.audio);
    this.ui = new UIManager();
    this.photoMode = new PhotoMode(this.renderer, this.renderer.scene, this.renderer.camera);
    this.citadel = new YautjaCitadel(this.renderer.scene);
    this.codex = new LoreCodexManager();
    this.env = new EnvironmentManager(this.renderer.scene);
    this.horde = new XenomorphHorde(this.renderer.scene, this.audio, this.gore);
    this.bosses = new BossManager(this.renderer.scene, this.audio);
    this.allies = new YautjaAlliesManager(this.renderer.scene, this.audio);
    this.skimmer = new YautjaSkimmer(this.renderer.scene, this.audio);
    this.marines = new ColonialMarinesManager(this.renderer.scene, this.audio);
    this.synthetics = new SyntheticsManager(this.renderer.scene, this.audio, this.particles);
    this.badBlood = new BadBloodManager(this.renderer.scene, this.audio);
    this.hellHounds = new HellHoundsManager(this.renderer.scene, this.audio);
    this.dropPod = new DropPodEntrance(this.renderer.scene, this.audio, this.particles);
    this.dropship = new CheyenneDropship(this.renderer.scene, this.audio, this.particles);

    this.weaponWheel = new WeaponWheel((weaponId) => {
      this.ui.showAnnouncement(`ARME SÉLECTIONNÉE: ${weaponId.toUpperCase()}`);
    });

    this.loadoutScreen = new LoadoutScreen((loadoutConfig) => {
      this.activeLoadout = loadoutConfig;
      this.startMission();
    });

    this.sandbox = new SandboxEditor((config) => this.startSandboxMission(config));

    this.player = null;
    this.player2 = null;
    this.isCoOp = false;
    this.activeLoadout = null;
    this.isFirstPerson = false;

    this.projectiles = [];
    this.isPlaying = false;
    this.isPaused = false;

    this.waveIndex = 1;
    this.totalWaves = 5;
    this.score = 0;
    this.sessionSkulls = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.announcedMilestones = {};
    this.nukeCountingDown = false;
    this.motionTrackerTimer = 0;
    this.closestEnemyDist = Infinity;

    this.keys = {};
    this.setupEventListeners();
    this.lastTime = performance.now();
    this.animate();
  }

  setupEventListeners() {
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-open-citadel').addEventListener('click', () => {
      this.audio.init();
      this.citadel.buildCitadelRoom(this.ui.trophyStats.skulls);
      this.citadel.show();
      this.ui.showAnnouncement('🏰 CITADELLE YAUTJA: STATION DE POLISSAGE DES TROPHÉES AU LASER');
    });

    document.getElementById('btn-open-story').addEventListener('click', () => {
      this.audio.init();
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      const firstChapter = this.campaign.startCampaign();
      this.ui.showAnnouncement(firstChapter.title);
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-open-coop').addEventListener('click', () => {
      this.audio.init();
      this.isCoOp = true;
      this.renderer.setSplitScreen(true);
      this.citadel.hide();
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-confirm-char').addEventListener('click', () => {
      this.ui.showScreen(this.ui.levelSelectMenu);
    });

    document.getElementById('btn-back-to-char').addEventListener('click', () => {
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-launch-mission').addEventListener('click', () => {
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-open-sandbox').addEventListener('click', () => {
      this.ui.showScreen(document.getElementById('sandbox-modal'));
    });

    document.getElementById('btn-close-sandbox').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-forge').addEventListener('click', () => {
      this.ui.showScreen(document.getElementById('forge-modal'));
    });

    document.getElementById('btn-close-forge').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-trophies').addEventListener('click', () => {
      this.ui.updateTrophyRoom();
      this.ui.showScreen(this.ui.trophyModal);
    });

    document.getElementById('btn-close-trophies').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-open-options').addEventListener('click', () => {
      this.ui.showScreen(this.ui.optionsModal);
    });

    document.getElementById('btn-close-options').addEventListener('click', () => {
      this.ui.showScreen(this.ui.mainMenu);
    });

    document.getElementById('btn-replay').addEventListener('click', () => {
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-menu-return').addEventListener('click', () => {
      this.endGame(false);
    });

    document.getElementById('btn-snap-photo').addEventListener('click', () => {
      this.photoMode.takeSnapshot();
    });

    document.getElementById('btn-exit-photo').addEventListener('click', () => {
      if (this.player) this.photoMode.toggle(this.player.position);
    });

    document.getElementById('btn-buy-hp').addEventListener('click', () => {
      const cost = this.forge.buyUpgrade('hp', this.ui.trophyStats.totalKos * 100);
      if (cost > 0) this.ui.showAnnouncement('🛡️ SANTÉ AMÉLIORÉE AU MAXIMUM !');
    });

    document.getElementById('btn-buy-dmg').addEventListener('click', () => {
      const cost = this.forge.buyUpgrade('damage', this.ui.trophyStats.totalKos * 100);
      if (cost > 0) this.ui.showAnnouncement('⚔️ DÉGÂTS DÉVASTATEURS BOOSTÉS !');
    });

    document.getElementById('btn-laser-cyan').addEventListener('click', () => {
      this.forge.selectLaserColor('#00d2ff');
      if (this.player) this.player.setLaserColor(0x00d2ff);
    });

    document.getElementById('btn-laser-red').addEventListener('click', () => {
      this.forge.selectLaserColor('#ff1a1a');
      if (this.player) this.player.setLaserColor(0xff1a1a);
    });

    document.getElementById('btn-laser-green').addEventListener('click', () => {
      this.forge.selectLaserColor('#39ff14');
      if (this.player) this.player.setLaserColor(0x39ff14);
    });

    // Hotkeys
    window.addEventListener('keydown', (e) => {
      this.keys[e.code] = true;

      if (!this.isPlaying || this.isPaused) return;

      // First-Person Bio-Mask View Toggle [I Key]
      if (e.code === 'KeyI' && this.player) {
        this.isFirstPerson = !this.isFirstPerson;
        const fpsOverlay = document.getElementById('first-person-mask-overlay');
        if (this.isFirstPerson) {
          fpsOverlay.classList.remove('hidden');
          this.player.headMesh.visible = false;
          this.ui.showAnnouncement('🎭 VUE PREMIÈRE PERSONNE BIO-MASQUE ACTIVÉE');
        } else {
          fpsOverlay.classList.add('hidden');
          this.player.headMesh.visible = true;
          this.ui.showAnnouncement('🎭 VUE TROISIÈME PERSONNE RESTAURÉE');
        }
      }

      // Prowl Roosting Perch Mode [J Key]
      if (e.code === 'KeyJ' && this.player) {
        const isPerched = this.player.togglePerch();
        this.ui.showAnnouncement(isPerched ? '🌲 AFFÛT PERCHÉ EN HAUTEUR : DOMINANCE VERTICALE' : '⚡ PLONGEON D\'ASSASSINAT FURTIF AU SOL !');
      }

      // Feral Hex-Shield [C Key]
      if (e.code === 'KeyC' && this.player) {
        const isBlock = this.player.toggleShieldBlock();
        this.ui.showAnnouncement(isBlock ? '🛡️ BOUCLIER HEXAGONAL FERAL DÉPLOYÉ (PARADE 100%)' : '🛡️ BOUCLIER RÉTRACTÉ');
      }

      // Clan Warhorn [K Key]
      if (e.code === 'KeyK' && this.player) {
        this.player.soundWarhorn();
        this.ui.showAnnouncement('📯 COR DE GUERRE ANCESTRAL DU CLAN : FRAPPE +50% & VITESSE !');
      }

      // Hell-Hounds Companion Pack [H Key]
      if (e.code === 'KeyH' && this.player) {
        this.hellHounds.summonPack(this.player.position, 2);
        this.ui.showAnnouncement('🐕 MEUTE DE CHIENS DE CHASSE HELL-HOUNDS DÉPLOYÉE !');
      }

      // Audio Mimicry Voice Lure [Y Key]
      if (e.code === 'KeyY' && this.player) {
        const taunt = this.player.triggerVoiceMimicry(this.horde);
        this.ui.showAnnouncement(`📻 LEURRE VOCAL AUDIO MIMICRY DIFFUSÉ : ${taunt}`);
      }

      // Gauntlet EMP Overcharge Pulse [U Key]
      if (e.code === 'KeyU' && this.player) {
        if (this.player.triggerGauntletEMP(this.horde, this.synthetics)) {
          this.ui.showAnnouncement('⚡ DÉCHARGE EMP DE POIGNET : ANDROÏDES COURT-CIRCUITÉS & XÉNOS PARALYSÉS !');
        } else {
          this.ui.showAnnouncement('⏳ EMP EN RECHARGE CONDENSATEUR...');
        }
      }

      // Netgun Entanglement & Gauntlet Flechette Needler [G Key]
      if (e.code === 'KeyG' && this.player) {
        if (this.player.fireNetgun(this.horde, this.synthetics)) {
          this.ui.showAnnouncement('🕸️ LANCE-FILET NETGUN DÉPLOYÉ : CIBLE ENTOURÉE DE FIL DE DIAMANT TRANCHANT !');
        } else {
          this.fireFlechetteNeedler();
        }
      }

      // Pounce Leap [Shift + Space]
      if (e.code === 'Space' && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.player) {
        if (this.player.pounceLeap()) {
          this.ui.showAnnouncement('⚡ SUPER-SAUT POUNCE LEAP DÉPLOYÉ !');
        }
      }

      // 4 Bio-Mask Vision Modes [V Key]
      if (e.code === 'KeyV' && this.player) {
        const mode = this.player.cycleVisionMode();
        this.updateVisionOverlays(mode);
      }

      if (e.code === 'KeyR') {
        this.weaponWheel.toggle();
      }

      if (e.code === 'KeyE' && this.player) {
        if (this.player.isFacehuggerLatched) {
          if (this.player.struggleQTE()) {
            this.ui.showAnnouncement('💥 FACEHUGGER ARRACHÉ AVEC SUCCÈS !');
          }
        } else {
          this.checkTrophyExecution();
        }
      }

      if (e.code === 'KeyT' && this.player) {
        if (this.player.deployBearTrap(this.horde)) {
          this.ui.showAnnouncement('🪤 PIÈGE À LOUP YAUTJA STEEL BEAR TRAP DÉPLOYÉ !');
        }
      }

      // 1987 Wrist Computer Nuke Countdown [N Key]
      if (e.code === 'KeyN' && this.player && !this.nukeCountingDown) {
        this.triggerNukeCountdownSequence();
      }

      if (e.code === 'KeyB' && this.player) {
        if (this.player.acidSolventCharges > 0 && this.horde.acidPools.length > 0) {
          if (this.player.useAcidSolvent(this.horde)) {
            this.ui.showAnnouncement('🧪 FIOLE DE SOLVANT D\'ACIDE DÉPLOYÉE: SOL PURIFIÉ !');
          }
        } else {
          this.throwSmartDisc();
        }
      }

      if (e.code === 'KeyZ' && this.player) {
        if (this.player.useMedicomp()) {
          this.ui.showAnnouncement('💉 MEDICOMP CAUTÉRISATION VISCÉRALE: BLINDAGE RESTAURÉ !');
        }
      }

      if (e.code === 'KeyM' && this.player) {
        this.player.triggerHybridMetamorphosis();
        this.ui.showAnnouncement('🧬 MÉTAMORPHOSE ADN HYBRIDE ACTIVÉE !');
      }

      if (e.code === 'KeyP' && this.player) {
        this.throwCombiStick();
      }

      if (e.code === 'KeyO' && this.player) {
        this.photoMode.toggle(this.player.position);
      }

      if (e.code === 'KeyX' && this.player) {
        if (this.orbital.triggerStrike(this.player.position, this.horde, this.bosses, this.particles)) {
          this.ui.showAnnouncement('🚀 FRAPPE PLASMA ORBITALE DÉCLENCHÉE !');
        }
      }

      if (e.code === 'Tab' && this.player) {
        e.preventDefault();
        const isSec = this.player.toggleWeaponSwap();
        document.getElementById('hud-weapon-label').innerText = isSec ? 'ARME: SECONDAIRE' : 'ARME: PRINCIPALE';
      }

      if (e.code === 'KeyF' && this.player) {
        const active = this.player.toggleCloak();
        this.audio.playYautjaClick();
        this.ui.cloakOverlay.className = active ? '' : 'hidden';
      }

      if ((e.code === 'Space' && !this.keys['ShiftLeft'] && !this.keys['ShiftRight']) || e.code === 'KeyQ') {
        if (this.player && this.player.triggerMusouOverload()) {
          this.executeMusouOverload();
        }
      }

      if (e.code === 'ShiftLeft' && !this.keys['Space']) {
        this.firePlasmaCannon();
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || this.photoMode.isActive) return;
      if (e.button === 1) {
        e.preventDefault();
        this.weaponWheel.toggle();
      }
      if (e.button === 0) this.performLightAttack();
      if (e.button === 2) {
        e.preventDefault();
        this.performHeavyAttack();
      }
    });

    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  updateVisionOverlays(mode) {
    const thermal = document.getElementById('thermal-overlay');
    const em = document.getElementById('em-overlay');
    const tech = document.getElementById('tech-overlay');
    const uv = document.getElementById('uv-overlay');
    const tag = document.getElementById('hud-vision-tag');

    [thermal, em, tech, uv].forEach(el => el.classList.add('hidden'));

    if (mode === 1) {
      thermal.classList.remove('hidden');
      tag.innerText = 'VISION : THERMIQUE IR';
      tag.style.color = '#ff4d4d';
      this.audio.startThermalHum();
    } else if (mode === 2) {
      em.classList.remove('hidden');
      tag.innerText = 'VISION : ÉLECTROMAGNÉTIQUE XENO';
      tag.style.color = '#00d2ff';
      this.audio.stopThermalHum();
    } else if (mode === 3) {
      tech.classList.remove('hidden');
      tag.innerText = 'VISION : TECH WIREFRAME SCAN';
      tag.style.color = '#39ff14';
      this.audio.stopThermalHum();
    } else {
      uv.classList.remove('hidden');
      tag.innerText = 'VISION : NATURELLE ULTRAVIOLETTE';
      tag.style.color = '#ffaa00';
      this.audio.stopThermalHum();
    }
  }

  triggerNukeCountdownSequence() {
    this.nukeCountingDown = true;
    const nukeModal = document.getElementById('nuke-countdown-overlay');
    const timerText = document.getElementById('nuke-timer-seconds');
    nukeModal.classList.remove('hidden');

    this.player.triggerNukeSelfDestruct();

    let timeLeft = 6;
    timerText.innerText = timeLeft;

    const interval = setInterval(() => {
      timeLeft--;
      if (timerText) timerText.innerText = timeLeft;

      if (timeLeft <= 0) {
        clearInterval(interval);
        nukeModal.classList.add('hidden');
        this.nukeCountingDown = false;

        const hits = this.horde.checkMeleeHits({ origin: this.player.position, radius: 70, damage: 10000 });
        this.registerHits(hits);
        if (this.bosses.activeBoss) this.bosses.takeDamage(10000);
        if (this.badBlood.isActive) this.badBlood.takeDamage(10000);
        this.ui.showAnnouncement('☢️ ANNIHILATION NUCLÉAIRE PURIFICATRICE ACCOMPLIE !');
      }
    }, 1000);
  }

  startMission() {
    this.isPlaying = true;
    this.isPaused = false;
    this.waveIndex = 1;
    this.score = 0;
    this.sessionSkulls = 0;
    this.comboHits = 0;
    this.horde.deadCount = 0;
    this.announcedMilestones = {};
    this.totalWaves = this.ui.selectedLevel.waves;

    this.citadel.hide();
    this.env.buildLevelEnvironment(this.ui.selectedLevel);
    this.renderer.updateLevelEnvironment(this.ui.selectedLevel);
    this.weather.spawnGasPipes(6);
    this.gore.clear();

    if (this.player) this.renderer.scene.remove(this.player.mesh);
    if (this.player2) this.renderer.scene.remove(this.player2.mesh);

    this.player = new Player(this.renderer.scene, this.ui.selectedChar, this.audio, false, this.particles);
    this.forge.applyStatsToPlayer(this.player);

    if (this.isCoOp) {
      this.player2 = new Player(this.renderer.scene, CHARACTERS_DATA[1], this.audio, true, this.particles);
    } else {
      this.player2 = null;
    }

    // Trigger Cinematic Yautja Orbital Drop Pod Entrance!
    this.dropPod.triggerDrop(this.player.position, () => {
      this.ui.showAnnouncement('🚀 CAPSULE D\'INSERTION YAUTJA : SAS ÉJECTÉ ! LA CHASSE COMMENCE !');
    });

    this.skimmer.spawnAt(this.player.position.clone().add(new THREE.Vector3(5, 0, 5)));
    this.allies.spawnSquad(this.player.position, 3);
    this.marines.spawnSquad(this.player.position, 4);
    this.synthetics.spawnSquad(this.player.position, 3);
    this.horde.spawnWave(25, this.player.position);

    this.audio.startBackgroundMusic();
    this.ui.showScreen(this.ui.inGameHud);
    this.ui.showAnnouncement(`MISSION DÉPLOYÉE: ${this.ui.selectedLevel.name}`);
  }

  startSandboxMission(config) {
    this.startMission();
    this.horde.spawnWave(config.enemyCount, this.player.position);
    this.bosses.spawnBoss('empress_matriarch', this.player.position.clone().add(new THREE.Vector3(0, 0, -30)));
    this.ui.showAnnouncement('⚠️ ARÈNE SANDBOX: REINE MATRIARCHE VOLANTE 20M APPARAÎT !');
  }

  performLightAttack() {
    if (!this.player) return;
    const attack = this.player.lightAttack();
    if (!attack) return;

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 4.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.ui.showAnnouncement('💀 BAD BLOOD ÉLIMINÉ DANS L\'HONNEUR !');
        }
      }
    }
  }

  performHeavyAttack() {
    if (!this.player) return;
    const attack = this.player.heavyAttack();
    if (!attack) return;

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 6.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.ui.showAnnouncement('💀 BAD BLOOD ÉLIMINÉ DANS L\'HONNEUR !');
        }
      }
    }
  }

  firePlasmaCannon() {
    if (!this.player) return;
    const projData = this.player.firePlasmaShot();
    if (!projData) return;

    const geo = new THREE.SphereGeometry(0.5, 12, 12);
    const mat = new THREE.MeshBasicMaterial({ color: this.player.laserColorHex || 0x00d2ff });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.copy(projData.position);
    this.renderer.scene.add(mesh);

    this.projectiles.push({
      mesh: mesh,
      direction: projData.direction,
      damage: projData.damage,
      speed: 45,
      life: 2.5
    });
  }

  fireFlechetteNeedler() {
    if (!this.player) return;
    const dartData = this.player.fireFlechetteNeedler();
    if (!dartData) return;

    const geo = new THREE.CylinderGeometry(0.04, 0.04, 0.8, 6);
    const mat = new THREE.MeshBasicMaterial({ color: 0xcccccc });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.rotation.x = Math.PI / 2;
    mesh.position.copy(dartData.position);
    this.renderer.scene.add(mesh);

    this.projectiles.push({
      mesh: mesh,
      direction: dartData.direction,
      damage: dartData.damage,
      speed: dartData.speed,
      life: 1.8
    });
    this.ui.showAnnouncement('🎯 DARD FLECHETTE NEEDLER PROPULSÉ !');
  }

  throwSmartDisc() {
    if (!this.player) return;
    const discData = this.player.throwSmartDisc();
    if (!discData) return;

    // Build Circular Razor-Sharp Smart-Disc Mesh
    const discGroup = new THREE.Group();
    const discGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.06, 16);
    const discMat = new THREE.MeshStandardMaterial({
      color: 0x94a3b8,
      metalness: 0.95,
      roughness: 0.1
    });
    const discMesh = new THREE.Mesh(discGeo, discMat);
    discMesh.rotation.x = Math.PI / 2;
    discGroup.add(discMesh);

    // Glowing Razor Edge
    const edgeGeo = new THREE.TorusGeometry(0.66, 0.03, 8, 24);
    const edgeMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });
    const edgeMesh = new THREE.Mesh(edgeGeo, edgeMat);
    discGroup.add(edgeMesh);

    discGroup.position.copy(discData.startPos);
    this.renderer.scene.add(discGroup);

    this.projectiles.push({
      mesh: discGroup,
      isSmartDisc: true,
      startPos: discData.startPos,
      apexPos: discData.apexPos,
      damage: discData.damage,
      progress: 0,
      speed: 1.35, // 1.35x per second -> ~0.74s roundtrip
      life: 1.6
    });

    this.ui.showAnnouncement('🥏 SMART-DISC YAUTJA LANCÉ EN ARC BOOMERANG !');
  }

  throwCombiStick() {
    if (!this.player) return;
    const data = this.player.throwCombiStick();
    if (!data) return;

    // 1:1 Canon Combi-Stick Telescopic Javelin Mesh (Predator 2 Lore)
    const spearGroup = new THREE.Group();
    // Central titanium-bronze shaft
    const shaftGeo = new THREE.CylinderGeometry(0.045, 0.045, 3.2, 8);
    const shaftMat = new THREE.MeshStandardMaterial({
      color: 0x334155,
      metalness: 0.95,
      roughness: 0.2
    });
    const shaft = new THREE.Mesh(shaftGeo, shaftMat);
    spearGroup.add(shaft);

    // Front elongated chrome spearhead
    const bladeGeo = new THREE.ConeGeometry(0.12, 0.8, 4);
    const bladeMat = new THREE.MeshStandardMaterial({
      color: 0xe2e8f0,
      metalness: 0.98,
      roughness: 0.1
    });
    const frontBlade = new THREE.Mesh(bladeGeo, bladeMat);
    frontBlade.position.y = 1.8;
    spearGroup.add(frontBlade);

    // Rear counter-blade spearhead
    const rearBlade = new THREE.Mesh(bladeGeo, bladeMat);
    rearBlade.position.y = -1.8;
    rearBlade.rotation.x = Math.PI;
    spearGroup.add(rearBlade);

    // Luminous plasma energy core rings
    const ringGeo = new THREE.TorusGeometry(0.07, 0.02, 6, 16);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ring1 = new THREE.Mesh(ringGeo, ringMat);
    ring1.rotation.x = Math.PI / 2;
    ring1.position.y = 0.5;
    spearGroup.add(ring1);
    const ring2 = new THREE.Mesh(ringGeo, ringMat);
    ring2.rotation.x = Math.PI / 2;
    ring2.position.y = -0.5;
    spearGroup.add(ring2);

    // Orient spear towards throw trajectory
    spearGroup.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), data.direction);
    spearGroup.position.copy(data.startPos);
    this.renderer.scene.add(spearGroup);

    this.projectiles.push({
      mesh: spearGroup,
      isCombiStick: true,
      direction: data.direction,
      speed: data.speed,
      damage: data.damage,
      pierceRemaining: data.pierceRemaining,
      life: 2.0
    });

    this.ui.showAnnouncement('🔱 JAVELOT COMBI-STICK PROPULSÉ : PERFORATION MULTI-CIBLES !');
  }

  executeMusouOverload() {
    this.ui.showAnnouncement('⚡ SURCHARGE MUSOU PLASMA ENCLENCHÉE ! ONDES DE CHOC & TEMPETE CYCLONIQUE');
    this.audio.playOmniPlasmaStorm();

    // 8 Omni-directional rotating high-energy plasma beams
    const stormGroup = new THREE.Group();
    stormGroup.position.copy(this.player.position).add(new THREE.Vector3(0, 2.0, 0));
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.9 });

    for (let b = 0; b < 8; b++) {
      const beamGeo = new THREE.CylinderGeometry(0.12, 0.12, 35, 6);
      beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.y = (b / 8) * Math.PI * 2;
      beam.position.set(Math.cos(beam.rotation.y) * 17.5, 0, Math.sin(beam.rotation.y) * 17.5);
      stormGroup.add(beam);
    }
    this.renderer.scene.add(stormGroup);

    // Animate intense storm rotation and beam pulse
    let spinAngle = 0;
    const stormAnim = setInterval(() => {
      spinAngle += 0.25;
      stormGroup.rotation.y = spinAngle;
      stormGroup.scale.multiplyScalar(1.02);
      beamMat.opacity -= 0.045;
      if (beamMat.opacity <= 0) {
        clearInterval(stormAnim);
        this.renderer.scene.remove(stormGroup);
      }
    }, 30);

    const attack = { origin: this.player.position, damage: 1000, radius: 35 };
    const hits = this.horde.checkMeleeHits(attack);
    this.registerHits(hits);

    // Spawn massive plasma scorched ground decal at center
    this.particles.spawnPlasmaScorch(this.player.position);

    if (this.bosses.activeBoss) this.bosses.takeDamage(1200);
    if (this.badBlood.isActive) this.badBlood.takeDamage(1200);
  }

  checkTrophyExecution() {
    // 1. Boss Execution (Queen, Empress, Predalien)
    if (this.bosses.activeBoss && this.bosses.activeBoss.isStunned) {
      this.player.executeSpineRip();

      this.sessionSkulls++;
      this.score += 2500;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 500);

      this.renderer.scene.remove(this.bosses.activeBoss.mesh);
      this.bosses.activeBoss = null;

      this.ui.showAnnouncement('💀 SPINE RIP EXÉCUTÉ ! RANG ELITE CONSACRÉ AU SANG ACIDE');
      this.ui.showExecutionPrompt(false);
      return;
    }

    // 2. Sub-Boss Execution (Crusher Titan or Praetorian Royal Guard)
    for (let i = this.horde.aliens.length - 1; i >= 0; i--) {
      const a = this.horde.aliens[i];
      if ((a.type === 'crusher' || a.type === 'praetorian') && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.5) {
          this.player.executeSpineRip();
          this.sessionSkulls++;
          this.score += a.type === 'crusher' ? 1200 : 800;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 300);

          if (this.gore) {
            this.gore.spawnDismemberment(a.mesh.position, 'spine_rip');
          }
          this.horde.spawnAcidPool(a.mesh.position);
          this.renderer.scene.remove(a.mesh);
          this.horde.aliens.splice(i, 1);
          this.horde.deadCount++;

          const title = a.type === 'crusher' ? 'TITAN CRUSHER' : 'GARDE ROYAL PRÉTORIEN';
          this.ui.showAnnouncement(`💀 DÉCAPITATION TROPHÉE : CRÂNE DE ${title} ARRACHÉ !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }
  }

  registerHits(hits) {
    hits.forEach(h => {
      this.comboHits++;
      this.comboTimer = 2.5;
      this.score += h.killed ? 150 : 25;
      this.player.musouEnergy = Math.min(this.player.maxMusouEnergy, this.player.musouEnergy + (h.killed ? 6 : 2));

      if (h.pos) {
        this.particles.emitBlood(h.pos, 8, true);
        this.particles.spawnDamagePopup(h.pos, h.damage, h.killed);
      }
    });

    this.ui.showCombo(this.comboHits);
    this.checkAnnouncerMilestones();
  }

  checkAnnouncerMilestones() {
    const kos = this.horde.deadCount;
    const milestones = [
      { count: 50, msg: '50 KOS - CHASSEUR D\'ÉLITE !' },
      { count: 100, msg: '100 KOS - GUERRIER SANGUINAIRE !' },
      { count: 250, msg: '250 KOS - MAÎTRE DU CARNAGE !' },
      { count: 500, msg: '500 KOS - FLÉAU DE LA RUCHE !' },
      { count: 1000, msg: '1000 KOS - LÉGENDE DU CLAN YAUTJA !' }
    ];

    milestones.forEach(m => {
      if (kos >= m.count && !this.announcedMilestones[m.count]) {
        this.announcedMilestones[m.count] = true;
        this.ui.showAnnouncement(m.msg);
        this.audio.playAnnouncerTone();
      }
    });
  }

  update(delta) {
    if (!this.isPlaying || !this.player || this.isPaused) return;

    if (this.photoMode.isActive) return;

    const qtePrompt = document.getElementById('facehugger-qte-prompt');
    if (qtePrompt) {
      if (this.player.isFacehuggerLatched) {
        qtePrompt.classList.remove('hidden');
      } else {
        qtePrompt.classList.add('hidden');
      }
    }

    const moveDirP1 = new THREE.Vector3();
    if (this.keys['KeyW']) moveDirP1.z -= 1;
    if (this.keys['KeyS']) moveDirP1.z += 1;
    if (this.keys['KeyA']) moveDirP1.x -= 1;
    if (this.keys['KeyD']) moveDirP1.x += 1;
    this.player.move(moveDirP1, delta);
    this.player.update(delta, this.horde);

    if (this.isCoOp && this.player2) {
      const moveDirP2 = new THREE.Vector3();
      if (this.keys['ArrowUp']) moveDirP2.z -= 1;
      if (this.keys['ArrowDown']) moveDirP2.z += 1;
      if (this.keys['ArrowLeft']) moveDirP2.x -= 1;
      if (this.keys['ArrowRight']) moveDirP2.x += 1;
      this.player2.move(moveDirP2, delta);
      this.player2.update(delta, this.horde);

      const cam2Target = this.player2.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.cameraP2.position.lerp(cam2Target, 5 * delta);
      this.renderer.cameraP2.lookAt(this.player2.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    this.hellHounds.update(delta, this.player, this.horde);
    this.synthetics.update(delta, this.player, this.horde);
    this.dropship.update(delta);
    this.skimmer.update(delta, this.player, this.horde, this.keys);
    this.orbital.update(delta);

    // Camera positioning: First-Person Bio-Mask vs 3rd Person
    if (this.isFirstPerson) {
      const eyePos = this.player.position.clone().add(new THREE.Vector3(0, 3.6, 0.2));
      this.renderer.camera.position.lerp(eyePos, 15 * delta);
      const lookTarget = eyePos.clone().add(new THREE.Vector3(
        Math.sin(this.player.rotationY) * 10,
        this.player.isPerched ? -4 : 0,
        Math.cos(this.player.rotationY) * 10
      ));
      this.renderer.camera.lookAt(lookTarget);
    } else {
      const camTarget = this.player.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.camera.position.lerp(camTarget, 5 * delta);
      this.renderer.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      if (p.isSmartDisc) {
        p.progress += p.speed * delta;
        p.mesh.rotation.z += 25 * delta; // Rapid slicing gyro-spin

        // Quadratic Bezier Curve from start -> apex -> player current position!
        const t = Math.min(1.0, p.progress);
        const playerCurrentHand = this.player.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));
        const p0 = p.startPos;
        const p1 = p.apexPos;
        const p2 = playerCurrentHand;

        const currentPos = new THREE.Vector3(
          (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
          (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
          (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z
        );
        p.mesh.position.copy(currentPos);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
        if (hits.length > 0) {
          this.particles.emitSparks(p.mesh.position, 6);
          this.registerHits(hits);
        }

        if (p.progress >= 1.0 || p.life <= 0) {
          // Returned to player hand
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          this.audio.playShieldBlock();
        }
      } else if (p.isCombiStick) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (hits.length > 0) {
          hits.forEach(() => {
            this.audio.playCombiStickImpale();
            this.particles.emitSparks(p.mesh.position, 8);
          });
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.audio.playCombiStickImpale();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.5, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playCombiStickImpale();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (hits.length > 0 || p.life <= 0) {
          this.particles.emitSparks(p.mesh.position, 10);
          this.particles.spawnPlasmaScorch(p.mesh.position);
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          if (hits.length > 0) this.registerHits(hits);
        }
      }
    }

    this.badBlood.update(delta, this.player);
    this.marines.update(delta, this.player, this.horde);
    this.allies.update(delta, this.player.position, this.horde);
    this.horde.update(delta, this.player);
    this.bosses.update(delta, this.player, this.horde);
    this.gore.update(delta);
    this.particles.update(delta, this.renderer.camera);
    this.updateTargetLockReticle();

    // USCM M314 Motion Tracker Proximity Sonar Ping
    let nearestDist = Infinity;
    this.horde.aliens.forEach(a => {
      const d = a.mesh.position.distanceTo(this.player.position);
      if (d < nearestDist) nearestDist = d;
    });
    this.closestEnemyDist = nearestDist;

    if (nearestDist < 25.0) {
      // Cadence accelerates as enemies close in: from 1.2s at 25m down to 0.18s at 3m
      const pingInterval = 0.18 + (nearestDist / 25.0) * 0.9;
      this.motionTrackerTimer += delta;
      if (this.motionTrackerTimer >= pingInterval) {
        this.motionTrackerTimer = 0;
        this.audio.playMotionTrackerPing(nearestDist);
      }
    }

    const boss = this.bosses.activeBoss;
    let subBossStunnedNearby = false;
    this.horde.aliens.forEach(a => {
      if ((a.type === 'crusher' || a.type === 'praetorian') && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.5) {
          subBossStunnedNearby = true;
        }
      }
    });
    this.ui.showExecutionPrompt((boss && boss.isStunned) || subBossStunnedNearby);

    if (this.horde.aliens.length < 8 && !this.bosses.activeBoss) {
      if (this.waveIndex < this.totalWaves) {
        this.waveIndex++;
        this.horde.spawnWave(20 + this.waveIndex * 10, this.player.position);
        this.ui.showAnnouncement(`VAGUE ${this.waveIndex} APPROCHE !`);

        // Cheyenne Dropship Airstrike Support on Wave 2 & 4!
        if (this.waveIndex === 2 || this.waveIndex === 4) {
          this.dropship.triggerAirstrike(this.player.position, this.horde);
          this.ui.showAnnouncement('✈️ DROPSHIP CHEYENNE UD-4L DÉPLOYÉ : SALVE DE ROQUETTES 70MM !');
        }

        if (this.waveIndex === 3) {
          this.badBlood.spawnAmbush(this.player.position);
          this.ui.showAnnouncement('⚠️ ALERTE : EMBUSCADE D\'UN YAUTJA RENÉGAT "BAD BLOOD" !');
        }
      } else if (!this.bosses.activeBoss) {
        this.bosses.spawnBoss(this.ui.selectedLevel.bossType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));
        this.ui.showAnnouncement('⚠️ ALERTE BOSS: LA REINE XENOMORPHE APPARAÎT !');
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
        this.ui.showCombo(0);
      }
    }

    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score);

    if (this.player.hp <= 0) {
      this.endGame(false);
    }
  }

  updateTargetLockReticle() {
    if (!this.player || !this.isPlaying) return;

    const reticleEl = document.getElementById('hud-tri-target-lock');
    const infoEl = document.getElementById('hud-target-info');
    if (!reticleEl || !infoEl) return;

    let bestTarget = null;
    let minDistance = 35.0; // Max lock range 35m

    const playerForward = new THREE.Vector3(
      Math.sin(this.player.rotationY),
      0,
      Math.cos(this.player.rotationY)
    ).normalize();

    // 1. Check Boss first
    if (this.bosses.activeBoss) {
      const bossPos = this.bosses.activeBoss.mesh.position;
      const toBoss = bossPos.clone().sub(this.player.position);
      const d = toBoss.length();
      toBoss.y = 0;
      toBoss.normalize();
      if (d < minDistance && playerForward.dot(toBoss) > 0.45) {
        minDistance = d;
        const name = this.bosses.activeBoss.type === 'predalien_queen' ? 'PREDALIEN QUEEN' :
                     this.bosses.activeBoss.type === 'empress_matriarch' ? 'EMPRESS MATRIARCH' : 'REINE XENOMORPHE';
        bestTarget = { pos: bossPos.clone().add(new THREE.Vector3(0, 3, 0)), dist: d, name };
      }
    }

    // 2. Check Xenomorph horde
    if (this.horde && this.horde.aliens) {
      for (let a of this.horde.aliens) {
        const toAlien = a.mesh.position.clone().sub(this.player.position);
        const d = toAlien.length();
        toAlien.y = 0;
        toAlien.normalize();
        if (d < minDistance && playerForward.dot(toAlien) > 0.5) {
          minDistance = d;
          const name = a.type === 'crusher' ? 'CRUSHER TITAN' :
                       a.type === 'praetorian' ? 'PRAETORIAN' :
                       a.type === 'spitter' ? 'SPITTER' : 'XENOMORPH DRONE';
          bestTarget = { pos: a.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)), dist: d, name };
        }
      }
    }

    // 3. Check Synthetics
    if (this.synthetics && this.synthetics.androids) {
      for (let syn of this.synthetics.androids) {
        const toSyn = syn.mesh.position.clone().sub(this.player.position);
        const d = toSyn.length();
        toSyn.y = 0;
        toSyn.normalize();
        if (d < minDistance && playerForward.dot(toSyn) > 0.5) {
          minDistance = d;
          bestTarget = { pos: syn.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)), dist: d, name: 'ANDROÏDE W-Y' };
        }
      }
    }

    if (bestTarget) {
      this.player.updateLaserLock(bestTarget.pos);

      // Play lock chime if newly acquired target
      if (!this.lockedTargetPos || this.lockedTargetPos.distanceTo(bestTarget.pos) > 4.0) {
        this.audio.playTargetLockPing();
        this.lockedTargetPos = bestTarget.pos.clone();
      }

      // Project 3D target coordinates to 2D screen coordinates
      const screenCoord = bestTarget.pos.clone().project(this.renderer.camera);
      // Check if target is in front of camera
      if (screenCoord.z < 1.0) {
        const screenX = (screenCoord.x * 0.5 + 0.5) * window.innerWidth;
        const screenY = (-(screenCoord.y * 0.5) + 0.5) * window.innerHeight;

        reticleEl.style.left = `${screenX}px`;
        reticleEl.style.top = `${screenY}px`;
        infoEl.innerText = `TRI-LOCK: ${bestTarget.dist.toFixed(1)}m - ${bestTarget.name}`;
        reticleEl.classList.remove('hidden');
      } else {
        reticleEl.classList.add('hidden');
      }
    } else {
      this.player.updateLaserLock(null);
      this.lockedTargetPos = null;
      reticleEl.classList.add('hidden');
    }
  }

  endGame(isVictory) {
    this.isPlaying = false;
    this.audio.stopBackgroundMusic();
    this.audio.stopThermalHum();
    this.allies.clearSquad();
    this.marines.clearSquad();
    this.synthetics.clearSquad();
    this.hellHounds.dismissPack();
    this.dropPod.clear();
    this.dropship.clear();

    this.ui.recordEndSession(this.horde.deadCount, this.sessionSkulls, this.score);

    document.getElementById('end-title').innerText = isVictory ? 'VICTOIRE GLORIEUSE !' : 'CHASSE TERMINÉE';
    document.getElementById('end-subtitle').innerText = isVictory ? 'La ruche Xenomorphe a été complètement anéantie dans l\'honneur Yautja.' : 'Votre Yautja est tombé au combat face à la ruche.';

    this.ui.showScreen(this.ui.gameOverScreen);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(delta);
    this.renderer.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  window.game = new GameApp();
});
