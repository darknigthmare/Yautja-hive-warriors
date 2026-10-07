/* PREDATOR: HIVE WARRIORS - Main Game Router (v7.0 Apex Overlord Edition) */

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
      this.ui.showAnnouncement('🏰 CITADELLE YAUTJA: PIÉDESTAL DE L\'INGÉNIEUR & CODEX');
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

      if (e.code === 'KeyN' && this.player) {
        const nukeAttack = this.player.triggerNukeSelfDestruct();
        const hits = this.horde.checkMeleeHits({ origin: this.player.position, radius: nukeAttack.radius, damage: nukeAttack.damage });
        this.registerHits(hits);
        this.ui.showAnnouncement('☢️ AUTO-DESTRUCTION NUCLÉAIRE DÉCLENCHÉE !');
      }

      if (e.code === 'KeyB' && this.player) {
        if (this.player.useAcidSolvent(this.horde)) {
          this.ui.showAnnouncement('🧪 FIOLE DE SOLVANT D\'ACIDE DÉPLOYÉE: SOL PURIFIÉ !');
        }
      }

      if (e.code === 'KeyZ' && this.player) {
        if (this.player.useMedicomp()) {
          this.ui.showAnnouncement('💉 INJECTION MEDICOMP BIO-GEL: SANTÉ RESTAURÉE !');
        }
      }

      if (e.code === 'KeyM' && this.player) {
        this.player.triggerHybridMetamorphosis();
        this.ui.showAnnouncement('🧬 MÉTAMORPHOSE ADN HYBRIDE ACTIVÉE !');
      }

      if (e.code === 'KeyP' && this.player) {
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

      if (e.code === 'KeyV' && this.player) {
        const active = this.player.toggleThermal();
        this.audio.playYautjaClick();
        if (active) {
          this.audio.startThermalHum();
        } else {
          this.audio.stopThermalHum();
        }
        this.ui.thermalOverlay.className = active ? '' : 'hidden';
      }

      if (e.code === 'KeyF' && this.player) {
        const active = this.player.toggleCloak();
        this.audio.playYautjaClick();
        this.ui.cloakOverlay.className = active ? '' : 'hidden';
      }

      if ((e.code === 'Space' || e.code === 'KeyQ') && this.player) {
        if (this.player.triggerMusouOverload()) {
          this.executeMusouOverload();
        }
      }

      if (e.code === 'ShiftLeft') {
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

    this.player = new Player(this.renderer.scene, this.ui.selectedChar, this.audio, false);
    this.forge.applyStatsToPlayer(this.player);

    if (this.isCoOp) {
      this.player2 = new Player(this.renderer.scene, CHARACTERS_DATA[1], this.audio, true);
    } else {
      this.player2 = null;
    }

    this.skimmer.spawnAt(this.player.position.clone().add(new THREE.Vector3(5, 0, 5)));
    this.allies.spawnSquad(this.player.position, 3);
    this.marines.spawnSquad(this.player.position, 4);
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
  }

  performHeavyAttack() {
    if (!this.player) return;
    const attack = this.player.heavyAttack();
    if (!attack) return;

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 6.0, this.horde, this.particles);
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

  executeMusouOverload() {
    this.ui.showAnnouncement('⚡ SURCHARGE MUSOU PLASMA ENCLENCHÉE !');
    const attack = { origin: this.player.position, damage: 1000, radius: 35 };
    const hits = this.horde.checkMeleeHits(attack);
    this.registerHits(hits);

    if (this.bosses.activeBoss) this.bosses.takeDamage(1200);
  }

  checkTrophyExecution() {
    if (this.bosses.activeBoss && this.bosses.activeBoss.isStunned) {
      this.audio.playSkullSnap();
      this.audio.playYautjaRoar();

      this.sessionSkulls++;
      this.score += 2000;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 400);

      this.renderer.scene.remove(this.bosses.activeBoss.mesh);
      this.bosses.activeBoss = null;

      this.ui.showAnnouncement('💀 TROPHÉE ARRACHÉ ! SANTÉ RESTAURÉE');
      this.ui.showExecutionPrompt(false);
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

    // Facehugger QTE HUD prompt update
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
    this.player.update(delta);

    if (this.isCoOp && this.player2) {
      const moveDirP2 = new THREE.Vector3();
      if (this.keys['ArrowUp']) moveDirP2.z -= 1;
      if (this.keys['ArrowDown']) moveDirP2.z += 1;
      if (this.keys['ArrowLeft']) moveDirP2.x -= 1;
      if (this.keys['ArrowRight']) moveDirP2.x += 1;
      this.player2.move(moveDirP2, delta);
      this.player2.update(delta);

      const cam2Target = this.player2.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.cameraP2.position.lerp(cam2Target, 5 * delta);
      this.renderer.cameraP2.lookAt(this.player2.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }

    this.skimmer.update(delta, this.player, this.horde, this.keys);
    this.orbital.update(delta);

    const camTarget = this.player.position.clone().add(new THREE.Vector3(0, 10, 16));
    this.renderer.camera.position.lerp(camTarget, 5 * delta);
    this.renderer.camera.lookAt(this.player.position.clone().add(new THREE.Vector3(0, 2, 0)));

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;
      p.mesh.position.addScaledVector(p.direction, p.speed * delta);

      const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
      if (hits.length > 0 || p.life <= 0) {
        this.particles.emitSparks(p.mesh.position, 10);
        this.renderer.scene.remove(p.mesh);
        this.projectiles.splice(i, 1);
        if (hits.length > 0) this.registerHits(hits);
      }
    }

    this.marines.update(delta, this.player, this.horde);
    this.allies.update(delta, this.player.position, this.horde);
    this.horde.update(delta, this.player);
    this.bosses.update(delta, this.player);
    this.gore.update(delta);
    this.particles.update(delta, this.renderer.camera);

    const boss = this.bosses.activeBoss;
    this.ui.showExecutionPrompt(boss && boss.isStunned);

    if (this.horde.aliens.length < 8 && !this.bosses.activeBoss) {
      if (this.waveIndex < this.totalWaves) {
        this.waveIndex++;
        this.horde.spawnWave(20 + this.waveIndex * 10, this.player.position);
        this.ui.showAnnouncement(`VAGUE ${this.waveIndex} APPROCHE !`);
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

  endGame(isVictory) {
    this.isPlaying = false;
    this.audio.stopBackgroundMusic();
    this.audio.stopThermalHum();
    this.allies.clearSquad();
    this.marines.clearSquad();

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
