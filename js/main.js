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
import { APCVehicle } from './entities/APCVehicle.js';
import { SentryGun } from './entities/SentryGun.js';
import { FalconDrone } from './entities/FalconDrone.js';
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
    this.ui = new UIManager();
    this.campaign = new StoryCampaignManager(this.ui);
    this.weather = new WeatherSystem(this.renderer.scene);
    this.forge = new ForgeShop(this.audio);
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
    this.apc = new APCVehicle(this.renderer.scene, this.audio, this.particles);
    this.sentryGun = new SentryGun(this.renderer.scene, this.audio, this.particles);
    this.falconDrone = new FalconDrone(this.renderer.scene, this.audio, this.particles);
    this.pathogenPools = [];
    this.pathogenCooldown = 0;
    this.holoDecoys = [];

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
    this.announcedMilestones = {};
    this.nukeCountingDown = false;
    this.motionTrackerTimer = 0;
    this.battlefieldMorale = 50.0; // 0 to 100% (50 = balanced tug-of-war)
    this.trueMusouActive = false;
    this.vanguardFrenzyActive = false;

    // Musou Dynamic Camera & Screen Impact
    this.cameraShakeIntensity = 0;
    this.cameraShakeTimer = 0;
    this.cameraFovTimer = 0;
    this.cameraFovDuration = 0;
    this.targetCameraFov = 60;
    this.baseFov = 60;
    // v48.0 Bullet-Time Camera & Endless Musou Mode
    this.bulletTimeTimer = 0;
    this.isEndlessMode = true; // Endless Musou Mode "Survival of the Worthy" enabled by default with toggle [Shift+M]

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

      // Chantier 10: Bad Blood Honor Duel Clashing Blades QTE Input Interception
      if (this.badBlood && this.badBlood.isDueling) {
        if (this.badBlood.handleDuelInput(e.code, this.player, this.ui, this.gore, this.particles, this)) {
          return;
        }
      }

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

      // Audio Mimicry Voice Lure [Shift + Y] / Yautja Thermal Plasma Tripwire Mine [Y Key] (Chantier 9)
      if (e.code === 'KeyY' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          const taunt = this.player.triggerVoiceMimicry(this.horde);
          this.ui.showAnnouncement(`📻 LEURRE VOCAL AUDIO MIMICRY DIFFUSÉ : ${taunt}`);
        } else {
          if (this.player.deployTripwireMine(this.renderer.scene, this.particles)) {
            this.ui.showAnnouncement('🕸️ MINE TRIPWIRE PLASMA YAUTJA DÉPLOYÉE (3 FAISCEAUX LASER) !');
          } else {
            this.ui.showAnnouncement('⏳ MINE EN RECHARGE OU MAXIMUM DE 3 MINES ATTEINT');
          }
        }
      }

      // QA Audit #1 Fix: Toggle Tactical Keybind Reference Overlay [F1 Key]
      if (e.code === 'F1') {
        e.preventDefault();
        const helpOverlay = document.getElementById('qa-tactical-help-overlay');
        if (helpOverlay) helpOverlay.classList.toggle('hidden');
      }

      // Segmented Spine Whip [Digit 1] / Chantier 1 (v49.0): Yautja Heavy Gravity Maul [Shift + Digit 1]
      if ((e.code === 'Digit1' || e.code === 'Numpad1') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.performMaulEarthshaker(this.horde, this.bosses, this.synthetics, this.env, this.particles, this.ui);
        } else {
          this.performSpineWhip();
        }
      }

      // Engineer Black Pathogen Mutagen Urn Bombardment [Digit 2] (Prometheus 2012)
      if ((e.code === 'Digit2' || e.code === 'Numpad2') && this.player) {
        this.triggerPathogenUrnStrike();
      }

      // Laser-Guided Flechette Volley [Digit 3] / Chantier 7 (v49.0): Seegson High-Voltage Bolt Gun [Shift + Digit 3]
      if ((e.code === 'Digit3' || e.code === 'Numpad3') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireSeegsonBoltGun(this.horde, this.bosses, this.synthetics, this.particles, this.ui);
        } else {
          this.triggerLaserGuidedFlechettes();
        }
      }

      // UA 571-C Automated Remote Sentry Gun [Digit 4] (Aliens 1986 Special Edition)
      if ((e.code === 'Digit4' || e.code === 'Numpad4') && this.player) {
        this.deploySentryGun();
      }

      // Falconer Biomechanical Falcon Drone [Digit 5] (Predators 2010 Canon 1:1)
      if ((e.code === 'Digit5' || e.code === 'Numpad5') && this.player) {
        this.launchFalconDrone();
      }

      // Alpha Predator Primordial Dragon Bone Scythe [Digit 6] (NECA / Hunting Grounds Lore)
      if ((e.code === 'Digit6' || e.code === 'Numpad6') && this.player) {
        this.performBoneScytheCleave();
      }

      // Yautja Charged Compound Bow [Digit 7] / Chantier 3 (v48): USCM M77 Gauss Railgun Rifle [Shift + Digit 7]
      if ((e.code === 'Digit7' || e.code === 'Numpad7') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireM77GaussRifle(this.horde, this.bosses, this.synthetics, this.env, this.particles, this.ui);
        } else {
          this.fireCompoundBow();
        }
      }

      // Holographic Decoy [Digit 8] / Chantier 5 (v48): Bishop Reprogrammed Android Squad & Anti-Grav Disruptor [Shift + Digit 8]
      if ((e.code === 'Digit8' || e.code === 'Numpad8') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          if (this.env && this.env.deployReprogrammedAndroidSquad) {
            this.env.deployReprogrammedAndroidSquad(this.player, this.audio, this.ui);
          }
          this.player.deployAntiGravDisruptor(this.horde, this.synthetics, this.particles);
        } else {
          this.deployHoloDecoy();
        }
      }

      // Chantier 2 (v47): Ancient Yautja Plasma Scythe [Shift + Digit 6] (AvP Extinction 2003)
      if ((e.code === 'Digit6' || e.code === 'Numpad6') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.togglePlasmaScythe(this.ui);
        }
      }

      // Yautja Dual-Bladed Plasma Glaive Cyclone [Digit 9] / Chantier 5 (v47): USCM M41A Underbarrel 30mm HEDP Grenade [Shift + Digit 9]
      if ((e.code === 'Digit9' || e.code === 'Numpad9') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.fireM41AGrenade(this.ui, this.horde, this.bosses, this.synthetics, this.env, this.particles);
        } else {
          if (this.player.triggerPlasmaGlaive(this.horde, this.synthetics, this.bosses)) {
            this.ui.showAnnouncement('⚡ TOURBILLON DE PLASMA GLAIVE ACTIVÉ : CYCLONE DÉFLECTEUR 360° !');
          } else {
            this.ui.showAnnouncement('⏳ PLASMA GLAIVE EN RECHARGE...');
          }
        }
      }

      // Royal Jelly Berserker Rage Stimulant [Digit 0] / Chantier 7: Yautja Burner Plasma Flamer Mode [Shift + Digit 0]
      if ((e.code === 'Digit0' || e.code === 'Numpad0') && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          const flamerActive = this.player.togglePlasmaFlamer();
          this.ui.showAnnouncement(flamerActive ? '🔥 BRÛLEUR PLASMA INCINÉRATEUR ACTIVÉ (CÔNE NAPALM SOUTENU) !' : '🔥 BRÛLEUR PLASMA RÉTRACTÉ');
        } else {
          if (this.player.consumeRoyalJelly()) {
            this.ui.showAnnouncement('👑 GELÉE ROYALE CONSOMMÉE : FUREUR BERSERKER YAUTJA ACTIVÉE (+45% VIT, +100% DÉGÂTS) !');
            this.particles.emitGoldRageSparks(this.player.position, 25);
          } else if (this.player.isBerserkerActive) {
            this.ui.showAnnouncement('🔥 RAGE BERSERKER DÉJÀ ACTIVE !');
          } else {
            this.ui.showAnnouncement('❌ AUCUNE FLASQUE DE GELÉE ROYALE DISPONIBLE');
          }
        }
      }

      // Collapsible 6-Blade Shuriken [L Key] (AVP 2004 Celtic / Scar Lore)
      if (e.code === 'KeyL' && this.player) {
        this.throwShuriken();
      }

      // Gauntlet EMP Overcharge Pulse [U Key]
      if (e.code === 'KeyU' && this.player) {
        if (this.player.triggerGauntletEMP(this.horde, this.synthetics)) {
          if (this.horde && this.horde.zeroGAcidGlobules) {
            this.horde.zeroGAcidGlobules.forEach(g => {
              const repelDir = g.mesh.position.clone().sub(this.player.position).normalize();
              g.driftVel.copy(repelDir).multiplyScalar(18);
            });
          }
          this.ui.showAnnouncement('⚡ DÉCHARGE EMP DE POIGNET : ANDROÏDES COURT-CIRCUITÉS & XÉNOS PARALYSÉS !');
        } else {
          this.ui.showAnnouncement('⏳ EMP EN RECHARGE CONDENSATEUR...');
        }
      }

      // Netgun Entanglement & Gauntlet Flechette Needler [G Key]
      if (e.code === 'KeyG' && this.player) {
        const distToSkimmer = this.skimmer ? this.player.position.distanceTo(this.skimmer.position) : 999;
        if (this.skimmer && (this.skimmer.isMounted || distToSkimmer < 4.5)) {
          // Boarding or exiting the Yautja Skimmer vehicle
          this.skimmer.mountCooldown = 0;
        } else {
          if (this.player.fireNetgun(this.horde, this.synthetics)) {
            this.ui.showAnnouncement('🕸️ LANCE-FILET NETGUN DÉPLOYÉ : CIBLE ENTOURÉE DE FIL DE DIAMANT TRANCHANT !');
          } else {
            this.fireFlechetteNeedler();
          }
        }
      }

      // Pounce Leap [Shift + Space]
      if (e.code === 'Space' && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.player) {
        this.player.usedShiftModifier = true;
        if (this.player.pounceLeap()) {
          this.ui.showAnnouncement('⚡ SUPER-SAUT POUNCE LEAP DÉPLOYÉ !');
        }
      }

      // 4 Bio-Mask Vision Modes [V Key] / Chantier 7 (v48): Modular Legendary Yautja Bio-Masks [Shift + V]
      if (e.code === 'KeyV' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.cycleLegendaryBioMask(this.ui);
        } else {
          const mode = this.player.cycleVisionMode();
          this.updateVisionOverlays(mode);
        }
      }

      if (e.code === 'KeyR') {
        const nearSentry = this.sentryGun && this.sentryGun.isDeployed && this.player && this.player.position.distanceTo(this.sentryGun.mesh.position) < 3.5;
        if (nearSentry) {
          const rotY = this.player.mesh ? this.player.mesh.rotation.y : this.player.rotationY;
          if (this.sentryGun.calibrateDirection(this.player.position, rotY)) {
            if (this.audio && this.audio.playSentrySpinUp) this.audio.playSentrySpinUp();
            this.ui.showAnnouncement('🧭 SENTINELLE UA 571-C : ARC DE TIR CALIBRÉ VERS VOTRE VISÉE !');
          }
        } else {
          this.weaponWheel.toggle();
        }
      }

      if (e.code === 'KeyE' && this.player) {
        if (this.player.isFacehuggerLatched) {
          if (this.player.struggleQTE()) {
            this.ui.showAnnouncement('💥 FACEHUGGER ARRACHÉ AVEC SUCCÈS !');
          }
        } else if (this.env && this.env.checkFoundryValveInteraction && this.env.checkFoundryValveInteraction(this.player, this.audio, this.ui)) {
          // Handled Fiorina 161 Molten Lead Foundry 12-Ton Pouring Vat (Alien 3 1992)!
        } else if (this.env && this.env.checkSmartgunInteraction(this.player.position, this.player, this.ui, this.audio)) {
          // Handled USCM M56 Smartgun Turret mounting / dismounting!
        } else if (this.env && this.env.checkCraneConsoleInteraction(this.player.position, this.player, this.ui, this.audio, this.particles, this.horde, this.bosses, this.synthetics)) {
          // Handled USCM Cargo Crane 10-Ton Container drop!
        } else if (this.env && this.env.checkAPCInteraction(this.player.position, this.player, this.ui, this.audio)) {
          // Handled USCM M577 APC mounting / dismounting!
        } else if (this.env && this.env.checkReactorConsoleInteraction(this.player.position, this.player, this.ui, this.audio)) {
          // Handled Colony Reactor meltdown / coolant core purge!
        } else if (this.env && this.env.checkElectricGridInteraction(this.player.position, this.player, this.ui, this.audio, this.particles, this.horde)) {
          // Handled High-Voltage Electric Floor Grid activation!
        } else if (this.env && this.env.checkDeconInteraction(this.player.position, this.player, this.ui, this.audio, this.particles)) {
          // Handled Med-Lab Decontamination Airlock purge & restoration!
        } else if (this.sentryGun && this.sentryGun.reloadSentry(this.player.position, 250)) {
          if (this.audio && this.audio.playSentrySpinUp) this.audio.playSentrySpinUp();
          this.ui.showAnnouncement('🔋 SENTINELLE UA 571-C : CHARGEUR RECHARGÉ (+250 RDS) !');
        } else if (this.env && this.env.checkAirlockConsoleInteraction(this.player.position, this.ui, this.audio, this.particles)) {
          // Handled Emergency Atmospheric Decompression Airlock!
        } else if (this.env && this.env.checkCocoonInteraction(this.player.position, this.player, this.horde, this.ui, this.audio, this.particles)) {
          // Handled Chrysalis Cocoon harvesting or Lurker ambush!
        } else if (this.env && this.env.checkMarineScavengeInteraction(this.player.position, this.player, this.sentryGun, this.ui, this.audio)) {
          // Handled USCM Marine salvage!
        } else if (this.env && this.env.checkCryoMedBayInteraction(this.player.position, this.player, this.ui, this.audio)) {
          // Handled Weyland-Yutani Autodoc Med-Bay stasis decontamination & embryo purge!
        } else if (this.env && this.env.checkSupplyInteraction(this.player.position, this.player, this.ui, this.audio)) {
          // Handled USCM supply cache opening!
        } else if (this.env && this.env.checkCryoVentInteraction && this.env.checkCryoVentInteraction(this.player.position, this.player, this.ui, this.audio, this.horde, this.bosses)) {
          // Handled Weyland-Yutani Atmospheric Cooling Tower Cryo-Vent Purge (Alien 3 / Fiorina 161)!
        } else if (this.env && this.env.checkAurigaBreakerInteraction && this.env.checkAurigaBreakerInteraction(this.player, this.audio, this.ui)) {
          // Handled USM Auriga Flooded Hydro-Cryo Basin 50,000V Breaker (Alien Resurrection 1997)!
        } else if (this.env && this.env.checkAncientShrineInteraction && this.env.checkAncientShrineInteraction(this.player, this.audio, this.ui)) {
          // Handled Ancient Yautja Shrine of the Ancients Divine Blessing!
        } else if (this.env && this.env.checkPowerLoaderInteraction(this.player.position, this.player, this.horde, this.ui, this.audio, this.particles)) {
          // Handled Caterpillar Power Loader crushing clamp!
        } else {
          this.checkTrophyExecution();
        }
      }

      // QA Audit #4 Fix: Deduplicated KeyX — [X] Trax-Net Dart / [Shift + X] Orbital Plasma Strike
      if (e.code === 'KeyX' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          if (this.orbital.triggerStrike(this.player.position, this.horde, this.bosses, this.particles)) {
            this.ui.showAnnouncement('🚀 FRAPPE PLASMA ORBITALE DÉCLENCHÉE !');
          }
        } else {
          const tagged = this.player.fireTraxNetDart(this.horde, this.synthetics, this.bosses);
          if (tagged) {
            this.ui.showAnnouncement('🎯 BALISE TRAX-NET VERROUILLÉE (+25% DÉGÂTS, TÉLÉMÉTRIE MURALE 25S) !');
          } else {
            this.ui.showAnnouncement('⏳ LANCEUR TRAX-NET EN RECHARGE OU AUCUNE CIBLE');
          }
        }
      }

      // [T] Yautja Steel Bear Trap / Chantier 5 (v49.0): [Shift + T] Tracker Predator Sonic Trap Mine
      if (e.code === 'KeyT' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.player.deploySonicTrapMine(this.ui);
        } else if (this.player.deployBearTrap(this.horde)) {
          this.ui.showAnnouncement('🪤 PIÈGE À LOUP YAUTJA STEEL BEAR TRAP DÉPLOYÉ !');
        }
      }

      // Chantier 5 (v46): Yautja Neurotoxin Canister [N Key] / 1987 Wrist Computer Nuke Countdown [Shift + N Key]
      if (e.code === 'KeyN' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (!this.nukeCountingDown) {
            this.triggerNukeCountdownSequence();
          }
        } else {
          if (this.player.throwNeurotoxinCanister(this.horde, this.bosses, this.synthetics, this.ui, this.particles, this.env)) {
            // Canister thrown!
          } else {
            this.ui.showAnnouncement('⏳ CARTOUCHE DE NEUROTOXINE EN RECHARGE (30S)...');
          }
        }
      }

      // Smart-Disc Throw & Chantier 3 (v43): Remote Guidance Mode Toggle [Ctrl/Shift + B]
      if (e.code === 'KeyB' && this.player) {
        const activeDisc = this.projectiles.find(p => p.isSmartDisc && p.life > 0.1);
        if (activeDisc) {
          if (this.keys['ShiftLeft'] || this.keys['ShiftRight'] || this.keys['ControlLeft']) {
            if (this.player.isSmartDiscGuiding) {
              this.player.stopSmartDiscRemoteGuidance();
              this.ui.updateSmartDiscGuidance(false);
              this.ui.showAnnouncement('🎯 TÉLÉGUIDAGE SMART-DISC DÉSACTIVÉ : RETOUR EN MAIN');
            } else {
              this.player.startSmartDiscRemoteGuidance(activeDisc);
              this.ui.updateSmartDiscGuidance(true);
              this.ui.showAnnouncement('🎯 TÉLÉGUIDAGE SMART-DISC ACTIVÉ : ORIENTATION LASER CONTINUE !');
            }
          } else {
            this.triggerSmartDiscRicochet(activeDisc);
          }
        } else if (this.player.acidSolventCharges > 0 && this.horde.acidPools.length > 0) {
          if (this.player.useAcidSolvent(this.horde)) {
            this.ui.showAnnouncement('🧪 FIOLE DE SOLVANT D\'ACIDE DÉPLOYÉE: SOL PURIFIÉ !');
          }
        } else {
          this.throwSmartDisc();
        }
      }

      if (e.code === 'KeyZ' && this.player) {
        if (this.player.useMedicomp()) {
          this.particles.emitMedicompSteam(this.player.position, 24);
          this.ui.showAnnouncement('💉 MEDICOMP CAUTÉRISATION VISCÉRALE: SOIN 450 HP & BIO-VAPEUR ANTISEPTIQUE !');
        }
      }

      // QA Audit #4 Fix: Deduplicated KeyM — [M] Scout Ship Beam / [Alt + M] Hybrid Metamorphosis / [Shift + M] Endless Mode
      if (e.code === 'KeyM' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          this.isEndlessMode = !this.isEndlessMode;
          this.ui.showAnnouncement(this.isEndlessMode
            ? '♾️ MODE SURVIE INFINIE "SURVIVAL OF THE WORTHY" ACTIVÉ : VAGUES MUTAGÈNES ILLIMITÉES !'
            : '🏁 MODE CAMPAGNE STANDARD RESTAURÉ (5 VAGUES)');
        } else if (this.keys['AltLeft'] || this.keys['AltRight']) {
          this.player.triggerHybridMetamorphosis();
        } else {
          this.player.triggerScoutShipBeam(this.ui);
        }
      }

      // QA Audit #4 Fix: Deduplicated KeyP — [P] Combi-Stick Throw / [Shift + P] or [Shift + 4] Plasma Pistol 3-Bolt Burst
      if (e.code === 'KeyP' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.player.usedShiftModifier = true;
          const fired = this.player.firePlasmaPistol(this.horde, this.bosses, this.particles, this.env);
          if (fired) {
            this.ui.showAnnouncement('⚡ RAFALE PISTOLET PLASMA TRIPLETTE (AVP-R) : 3x95 DÉGÂTS D\'ÉNERGIE PURE !');
          } else {
            this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE (12 REQUIS) OU RECHARGE EN COURS');
          }
        } else {
          this.throwCombiStick();
        }
      }

      // Chantier 4 (v46): Yautja Cyber-Hunt Bionic Exosuit [O Key] / Photo Mode [Shift + O Key]
      if (e.code === 'KeyO' && this.player) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.photoMode.toggle(this.player.position);
        } else {
          if (this.player.activateCyberExosuit(this.ui, this.particles)) {
            // Exosuit active!
          } else {
            this.ui.showAnnouncement('⏳ EXOSQUELETTE BIONIQUE EN RECHARGE (45S)...');
          }
        }
      }

      if (e.code === 'Tab' && this.player) {
        e.preventDefault();
        const isSec = this.player.toggleWeaponSwap();
        document.getElementById('hud-weapon-label').innerText = isSec ? 'ARME: SECONDAIRE' : 'ARME: PRINCIPALE';
      }

      // Chantier 7 (v45): Yautja Ki'cte Gauntlet Grapple & Seismic Counter-Throw [KeyF / KeyG] (Concrete Jungle / Prey)
      if ((e.code === 'KeyF' || e.code === 'KeyG') && this.player) {
        const grappled = this.player.performGauntletGrapple(this.horde, this.bosses, this.ui, this.particles, this.env);
        if (!grappled && e.code === 'KeyF') {
          const active = this.player.toggleCloak();
          this.audio.playYautjaClick();
          this.ui.cloakOverlay.className = active ? '' : 'hidden';
        }
      }

      // Chantier 5 (v45): Yautja Pure Energy Plasma Pistol 3-Bolt Burst [Shift+Digit4] (AVP: Requiem 2007)
      if (e.code === 'Digit4' && (this.keys['ShiftLeft'] || this.keys['ShiftRight']) && this.player) {
        this.player.usedShiftModifier = true;
        const fired = this.player.firePlasmaPistol(this.horde, this.bosses, this.particles, this.env);
        if (fired) {
          this.ui.showAnnouncement('⚡ RAFALE PISTOLET PLASMA TRIPLETTE (AVP-R) : 3x95 DÉGÂTS D\'ÉNERGIE PURE !');
        } else {
          this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE (12 REQUIS) OU RECHARGE EN COURS');
        }
      }

      // Chantier 4 (v45): Struggle Against Latched Royal Facehugger
      if (e.code === 'Space' && this.player && this.player.isRoyalFacehuggerLatched) {
        if (this.horde && this.horde.struggleRoyalFacehugger(this.player)) {
          return;
        }
      }

      // Chantier 4 (v46): Exosuit Ground Slam Repulsor Shockwave
      if (e.code === 'Space' && this.player && this.player.isExosuitActive) {
        this.player.performGroundSlam(this.horde, this.bosses, this.synthetics, this.ui, this.particles, this.env);
      }

      if ((e.code === 'Space' && !this.keys['ShiftLeft'] && !this.keys['ShiftRight']) || e.code === 'KeyQ') {
        if (this.player && this.player.triggerMusouOverload()) {
          this.executeMusouOverload();
        }
      }

      if (e.code === 'ShiftLeft' && !this.keys['Space'] && this.player) {
        if (!this.player.isChargingPlasma) {
          this.player.isChargingPlasma = true;
          this.player.plasmaChargeTime = 0;
          this.player.usedShiftModifier = false;
          if (this.audio && this.audio.playPlasmaChargeUp) {
            this.audio.playPlasmaChargeUp();
          }
        }
      }
    });

    window.addEventListener('keyup', (e) => {
      this.keys[e.code] = false;

      if (e.code === 'ShiftLeft' && this.player && this.player.isChargingPlasma) {
        const usedMod = this.player.usedShiftModifier;
        this.player.isChargingPlasma = false;
        this.player.usedShiftModifier = false;
        if (!usedMod) {
          const isCharged = this.player.plasmaChargeTime >= 0.55;
          const fired = this.firePlasmaCannon(isCharged);
          if (fired && isCharged) {
            this.ui.showAnnouncement('💥 TIR PLASMA SURCHARGÉ DÉCHAÎNÉ : VAPORISATION 10M !');
          }
        }
      }
    });

    window.addEventListener('mousedown', (e) => {
      if (!this.isPlaying || this.photoMode.isActive) return;
      if (e.button === 1) {
        e.preventDefault();
        this.weaponWheel.toggle();
      }
      if (e.button === 0) {
        if (this.player && this.player.isMountedSmartgun) {
          this.env.fireSmartgun(this.player, this.horde, this.bosses, this.synthetics, this.audio, this.particles, this.ui);
          return;
        }
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (this.player) this.player.usedShiftModifier = true;
          if (this.activeLoadout && this.activeLoadout.primary === 'katana') {
            const hits = this.player.performIaijutsuSlash(this.horde, this.synthetics, this.bosses, this.particles);
            if (hits) {
              this.registerHits(hits);
              this.ui.showAnnouncement('⚔️ TRANCHANT ULTRASONIQUE IAIJUTSU DAH\'DT\'DE : DÉCOUPAGE TOTAL !');
            } else {
              this.ui.showAnnouncement('⏳ IAIJUTSU EN RECHARGE...');
            }
          } else {
            this.performSpineWhip();
          }
        } else {
          if (this.player && this.player.isPlasmaScytheActive) {
            this.player.performPlasmaScytheSlash(this.horde, this.bosses, this.synthetics, this.env, this.particles);
            this.triggerCameraShake(0.7, 0.25);
          } else if (this.player && this.player.hasParryRiposte) {
            const hits = this.player.performGuanThweiRiposte(this.horde, this.synthetics, this.bosses, this.particles);
            this.registerHits(hits);
            this.ui.showAnnouncement('⚔️ CONTRE-RIPOSTE GUAN-THWEI : CISAILLEMENT DÉCAPITANT DÉCHAÎNÉ !');
            this.triggerCameraShake(0.85, 0.35);
          } else {
            this.performLightAttack();
          }
        }
      }
      if (e.button === 2) {
        e.preventDefault();
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          if (this.player) {
            this.player.usedShiftModifier = true;
            // Chantier 6: Plasma Glaive Spin Shield & Kinetic Reflection
            this.player.toggleWhirlShield(true);
            this.ui.showAnnouncement('🛡️ BOUCLIER TOURNANT DE PLASMA GLAIVE DÉPLOYÉ (DÉVIATION 90% & RÉFLEXION ACIDE) !');
          }
        } else {
          this.performHeavyAttack();
        }
      }
    });

    window.addEventListener('mouseup', (e) => {
      if (e.button === 2 && this.player && this.player.isWhirlShieldActive) {
        this.player.toggleWhirlShield(false);
      }
    });

    window.addEventListener('contextmenu', e => e.preventDefault());
  }

  updateVisionOverlays(mode) {
    const thermal = document.getElementById('thermal-overlay');
    const em = document.getElementById('em-overlay');
    const tech = document.getElementById('tech-overlay');
    const uv = document.getElementById('uv-overlay');
    const sonar = document.getElementById('sonar-overlay');
    const tag = document.getElementById('hud-vision-tag');

    [thermal, em, tech, uv, sonar].forEach(el => { if (el) el.classList.add('hidden'); });

    if (mode === 1) {
      if (thermal) thermal.classList.remove('hidden');
      tag.innerText = 'VISION : THERMIQUE IR';
      tag.style.color = '#ff4d4d';
      this.audio.startThermalHum();
    } else if (mode === 2) {
      if (em) em.classList.remove('hidden');
      tag.innerText = 'VISION : ÉLECTROMAGNÉTIQUE XENO';
      tag.style.color = '#00d2ff';
      this.audio.stopThermalHum();
    } else if (mode === 3) {
      if (tech) tech.classList.remove('hidden');
      tag.innerText = 'VISION : TECH WIREFRAME SCAN';
      tag.style.color = '#39ff14';
      this.audio.stopThermalHum();
    } else if (mode === 4) {
      if (sonar) sonar.classList.remove('hidden');
      tag.innerText = 'VISION : RÉSONANCE ACOUSTIQUE SONAR';
      tag.style.color = '#38bdf8';
      this.audio.stopThermalHum();
    } else {
      if (uv) uv.classList.remove('hidden');
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

      // Authentic 1987 Billy's mimicry sardonic laugh right before detonation
      if (timeLeft === 2) {
        if (this.audio && this.audio.playBillyLaugh) {
          this.audio.playBillyLaugh();
        }
      }

      if (timeLeft <= 0) {
        clearInterval(interval);
        nukeModal.classList.add('hidden');
        this.nukeCountingDown = false;
        if (this.player && this.player.clearNukeHoloMesh) {
          this.player.clearNukeHoloMesh();
        }

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

    this.citadel.hide();
    this.ui.showScreen(this.ui.inGameHud);
    const loadoutModal = document.getElementById('loadout-prep-screen');
    if (loadoutModal) loadoutModal.classList.add('hidden');

    if (!this.ui.selectedLevel) {
      this.ui.selectedLevel = LEVELS_DATA[0];
    }
    this.totalWaves = this.ui.selectedLevel.waves;

    this.env.buildLevelEnvironment(this.ui.selectedLevel);
    this.renderer.updateLevelEnvironment(this.ui.selectedLevel);
    this.weather.setWeather(this.ui.selectedLevel.weatherType || 'none');
    this.weather.spawnGasPipes(6);
    this.weather.spawnSteamVents(5);
    this.gore.clear();
    this.bosses.clear();
    this.badBlood.clear();
    if (this.skimmer) {
      this.skimmer.isMounted = false;
      this.skimmer.mountCooldown = 0.5;
    }

    if (this.player) this.renderer.scene.remove(this.player.mesh);
    if (this.player2) this.renderer.scene.remove(this.player2.mesh);

    this.player = new Player(this.renderer.scene, this.ui.selectedChar, this.audio, false, this.particles);
    this.forge.applyStatsToPlayer(this.player);

    // Chantier 9: Apply Tactical Armory Loadout Synergy
    if (!this.activeLoadout) {
      this.activeLoadout = {
        primary: 'wristblades',
        secondary: 'smart_disc',
        gadgets: ['medicomp', 'bear_trap']
      };
    }
    this.player.applyTacticalLoadout(this.activeLoadout);
    const primName = (this.activeLoadout.primary || 'WRISTBLADES').toUpperCase();
    const secName = (this.activeLoadout.secondary || 'SMART_DISC').toUpperCase();
    this.ui.showAnnouncement(`🎒 LOADOUT ARMURERIE ACTIVÉ : [${primName}] + [${secName}]`);

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
    this.horde.spawnWave(55, this.player.position);

    // Initialize Battlefield Morale to 50%
    this.battlefieldMorale = 50.0;
    this.shiftBattlefieldMorale(0);

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

    if (this.vanguardFrenzyActive) {
      attack.damage *= 1.35;
    }

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 4.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);

    // Chantier 2: Predator Cloak Thermal Distortion & Backstab Stealth Execution (Predator 1987 / Prey 2022)
    if (this.player.isCloaked && hits.length > 0) {
      const playerForward = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();
      hits.forEach(hitEnemy => {
        if (hitEnemy && hitEnemy.mesh) {
          const toEnemy = hitEnemy.mesh.position.clone().sub(this.player.position).normalize();
          if (playerForward.dot(toEnemy) > 0.3) {
            hitEnemy.hp -= attack.damage * 2.5; // Additional 2.5x stealth execution damage (total 3.5x)
            if (this.audio && this.audio.playStealthAssassination) {
              this.audio.playStealthAssassination();
            }
            this.player.recordTrophy('Exécution Silencieuse de Proie par Poignardage Dorsal', 150);
            this.score += 150;
            this.ui.showAnnouncement("⚡ ASSASSINAT SILENCIEUX - EXÉCUTION D'HONNEUR (+150 HONNEUR) !");
            if (this.particles && this.particles.emitAlienBloodSpurt) {
              this.particles.emitAlienBloodSpurt(hitEnemy.mesh.position, 16);
            }
          }
        }
      });
    }

    // Environmental Hazard Interactions
    if (this.env) {
      this.env.checkCraneCableHit(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkEggClusterHits(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkSteamConduitHits(this.player.position, 3.8, attack.damage, this.audio, this.particles);
      this.env.checkOvipositorHit(this.player.position, 3.8, attack.damage, this.audio, this.particles, this.horde, this.bosses);
      this.env.checkNitrogenTankHits(this.player.position, 3.8, attack.damage, this.audio, this.particles);
      this.env.checkWebbingDamage(this.player.position, 3.8, attack.damage, this.particles);
    }

    // Update Combo Chain Tag
    const tagElem = document.getElementById('combo-chain-indicator');
    if (tagElem) {
      tagElem.innerText = `SÉRIE LÉGÈRE : ÉTAPE ${this.player.comboStep}/5`;
      tagElem.style.color = '#00d2ff';
    }

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.gore.spawnYautjaSeveredHead(this.badBlood.badBlood.mesh.position);
          const tName = 'Masque Souillé & Crâne Décapité de Bad Blood Renégat (Dark Horse Comics 1993)';
          const tHonor = 2200;
          this.player.recordTrophy(tName, tHonor);
          this.sessionSkulls++;
          this.score += tHonor;
          this.shiftBattlefieldMorale(20.0);
          this.ui.showAnnouncement(`💀 BAD BLOOD EXÉCUTÉ DANS LE SANG ! ${tName} (+${tHonor} HONNEUR, MORAL +20%) !`);
        }
      }
    }
  }

  performHeavyAttack() {
    if (!this.player) return;
    const attack = this.player.heavyAttack();
    if (this.vanguardFrenzyActive) {
      attack.damage *= 1.35;
    }

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 6.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);

    // Environmental Hazard Interactions
    if (this.env) {
      this.env.checkCraneCableHit(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkEggClusterHits(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde);
      this.env.checkSteamConduitHits(this.player.position, 4.8, attack.damage, this.audio, this.particles);
      this.env.checkOvipositorHit(this.player.position, 4.8, attack.damage, this.audio, this.particles, this.horde, this.bosses);
      this.env.checkNitrogenTankHits(this.player.position, 4.8, attack.damage, this.audio, this.particles);
      this.env.checkWebbingDamage(this.player.position, 4.8, attack.damage, this.particles);
    }

    // Dynasty Warriors Musou C1-C6 Charge Finisher Announcement & Camera Punch
    if (this.player.currentChargeName) {
      this.ui.showAnnouncement(`⚡ FINISHER CHARGÉ : ${this.player.currentChargeName} !`);
      const tagElem = document.getElementById('combo-chain-indicator');
      if (tagElem) {
        tagElem.innerText = `FINISHER : ${this.player.currentChargeName}`;
        tagElem.style.color = '#ffb703';
      }

      const isC6 = this.player.currentChargeName.includes('C6');
      this.triggerCameraShake(isC6 ? 1.2 : 0.6, isC6 ? 0.45 : 0.25);
      this.triggerCameraFovSurge(isC6 ? 68 : 64, isC6 ? 0.5 : 0.3);
    }

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
          this.gore.spawnYautjaSeveredHead(this.badBlood.badBlood.mesh.position);
          const tName = 'Masque Souillé & Crâne Décapité de Bad Blood Renégat (Dark Horse Comics 1993)';
          const tHonor = 2200;
          this.player.recordTrophy(tName, tHonor);
          this.sessionSkulls++;
          this.score += tHonor;
          this.shiftBattlefieldMorale(20.0);
          this.ui.showAnnouncement(`💀 BAD BLOOD EXÉCUTÉ DANS LE SANG ! ${tName} (+${tHonor} HONNEUR, MORAL +20%) !`);
        }
      }
    }
  }

  firePlasmaCannon(isCharged = false) {
    if (!this.player) return false;
    const projData = this.player.firePlasmaShot(isCharged);
    if (!projData) {
      if (this.player.plasmaEnergy < (isCharged ? 35 : 20)) {
        this.ui.showAnnouncement('⚠️ ÉNERGIE PLASMA INSUFFISANTE POUR LE TIR !');
      }
      return false;
    }

    const radius = isCharged ? 1.2 : 0.5;
    const geo = new THREE.SphereGeometry(radius, 14, 14);
    const mat = new THREE.MeshBasicMaterial({ color: isCharged ? 0xffffff : (this.player.laserColorHex || 0x00d2ff) });
    const mesh = new THREE.Mesh(geo, mat);

    if (isCharged) {
      const coronaGeo = new THREE.SphereGeometry(1.65, 10, 10);
      const coronaMat = new THREE.MeshBasicMaterial({ color: 0x00e5ff, transparent: true, opacity: 0.65 });
      mesh.add(new THREE.Mesh(coronaGeo, coronaMat));
    }

    mesh.position.copy(projData.position);
    this.renderer.scene.add(mesh);

    this.projectiles.push({
      mesh: mesh,
      isSuperCharged: isCharged,
      direction: projData.direction,
      damage: projData.damage,
      speed: isCharged ? 52 : 45,
      life: 2.6
    });
    return true;
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
    const discData = this.player.throwSmartDisc(this.horde);
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
      waypoints: discData.waypoints || [],
      damage: discData.damage,
      progress: 0,
      speed: 1.35 * (this.player.smartDiscSpeedMult || 1.0), // 1.35x base -> faster with loadout perk
      life: 1.8
    });

    const isHoming = discData.waypoints && discData.waypoints.length > 0;
    this.ui.showAnnouncement(isHoming 
      ? `🥏 SMART-DISC YAUTJA : VERROUILLAGE HOMING MULTI-CIBLES (${discData.waypoints.length} CIBLES) !` 
      : '🥏 SMART-DISC YAUTJA LANCÉ EN ARC BOOMERANG !');
  }

  triggerSmartDiscRicochet(disc) {
    if (!disc || !disc.mesh) return;

    let closestEnemy = null;
    let minD = 26.0;
    this.horde.aliens.forEach(a => {
      const d = a.mesh.position.distanceTo(disc.mesh.position);
      if (d < minD && a.hp > 0) {
        minD = d;
        closestEnemy = a;
      }
    });

    if (closestEnemy) {
      disc.startPos = disc.mesh.position.clone();
      disc.apexPos = closestEnemy.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
      disc.progress = 0;
      disc.life = 1.4;
      disc.damage += 140; // Consecutive ricochet slices deal escalating kinetic damage!
      this.particles.emitSparks(disc.mesh.position, 12);
      if (this.audio && this.audio.playSmartDiscRicochet) {
        this.audio.playSmartDiscRicochet();
      }
      this.ui.showAnnouncement('🎯 SMART-DISC RICOCHET GUIDÉ AU LASER : CIBLE TRANCHÉE (PREDATOR 2) !');
    }
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

  throwShuriken() {
    if (!this.player) return;
    const data = this.player.throwShuriken();
    if (!data) return;

    // 1:1 Canon Collapsible 6-Bladed Shuriken (AVP 2004 Celtic / Scar Lore)
    const shurikenGroup = new THREE.Group();
    // Central hexagonal core hub
    const coreGeo = new THREE.CylinderGeometry(0.35, 0.35, 0.1, 6);
    const coreMat = new THREE.MeshStandardMaterial({ color: 0x334155, metalness: 0.95, roughness: 0.15 });
    const core = new THREE.Mesh(coreGeo, coreMat);
    shurikenGroup.add(core);

    // 6 curved crescent steel blades
    const bladeMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.05 });
    for (let b = 0; b < 6; b++) {
      const bladeGeo = new THREE.BoxGeometry(0.12, 0.04, 1.1);
      const blade = new THREE.Mesh(bladeGeo, bladeMat);
      const angle = (b / 6) * Math.PI * 2;
      blade.position.set(Math.sin(angle) * 0.7, 0, Math.cos(angle) * 0.7);
      blade.rotation.y = angle + 0.35; // Curved aerodynamic slant
      shurikenGroup.add(blade);
    }

    // Glowing energy razor perimeter ring
    const ringGeo = new THREE.TorusGeometry(1.2, 0.03, 6, 24);
    const ringMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2;
    shurikenGroup.add(ring);

    shurikenGroup.position.copy(data.startPos);
    this.renderer.scene.add(shurikenGroup);

    this.projectiles.push({
      mesh: shurikenGroup,
      isShuriken: true,
      direction: data.direction,
      speed: data.speed,
      damage: data.damage,
      pierceRemaining: 6 + (this.player.shurikenPierceBonus || 0),
      radius: data.radius,
      life: 1.8
    });

    this.ui.showAnnouncement('🥏 SHURIKEN HEXA-LAMES YAUTJA DÉPLOYÉ : DÉCOUPE CIRCULAIRE 360° !');
  }

  performPowerGloveSlam() {
    if (!this.player) return;
    if (this.player.triggerPowerGloveSlam(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 25);
      this.particles.spawnPlasmaScorch(this.player.position);
      this.ui.showAnnouncement('⚡ FRAPPE GANTELET KINETIC POWER GLOVE : ONDE DE CHOC GÉOLOGIQUE 12M !');
    }
  }

  performSpineWhip() {
    if (!this.player) return;
    if (this.player.triggerSpineWhipSlash(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 12);
      this.ui.showAnnouncement('🐍 FOUET SEGMENTÉ RAZOR-WHIP (AVP-R) : BALAYAGE 10M & DÉMEMBREMENT !');
    }
  }

  triggerPathogenUrnStrike() {
    if (this.pathogenCooldown > 0 || !this.player) return;
    this.pathogenCooldown = 15.0;

    this.audio.playEngineerFluteHorn();
    this.ui.showAnnouncement('🏺 BOMBARDEMENT PATHOGÈNE NOIR DES INGÉNIEURS (PROMETHEUS) DÉPLOYÉ !');

    const centerPos = this.player.position.clone();
    const forward = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();

    // Drop 3 Black Urn canisters from orbit
    for (let u = 0; u < 3; u++) {
      setTimeout(() => {
        const urnPos = centerPos.clone()
          .addScaledVector(forward, 10 + u * 6)
          .add(new THREE.Vector3((u - 1) * 6, 0, 0));

        // Create dark obsidian urn mesh
        const urnGeo = new THREE.CylinderGeometry(0.35, 0.45, 1.8, 8);
        const urnMat = new THREE.MeshStandardMaterial({
          color: 0x09090b,
          roughness: 0.1,
          metalness: 0.95
        });
        const urnMesh = new THREE.Mesh(urnGeo, urnMat);
        urnMesh.position.set(urnPos.x, 0.9, urnPos.z);
        this.renderer.scene.add(urnMesh);

        // Pathogen liquid black pool
        const poolGeo = new THREE.CircleGeometry(4.2, 16);
        poolGeo.rotateX(-Math.PI / 2);
        const poolMat = new THREE.MeshBasicMaterial({
          color: 0x050505,
          transparent: true,
          opacity: 0.88,
          depthWrite: false
        });
        const poolMesh = new THREE.Mesh(poolGeo, poolMat);
        poolMesh.position.set(urnPos.x, 0.03, urnPos.z);
        this.renderer.scene.add(poolMesh);

        this.particles.emitSparks(urnPos, 20);

        this.pathogenPools.push({
          urnMesh,
          poolMesh,
          pos: urnPos.clone(),
          life: 8.5,
          damage: 95
        });
      }, u * 400);
    }
  }

  triggerLaserGuidedFlechettes() {
    if (!this.player) return;
    const data = this.player.triggerFlechetteVolley(this.targetLockEnemy);
    if (!data) return;

    // Launch 3 aerodynamic flechette bolts (Prey 2022 Feral Predator Canon 1:1)
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.8, roughness: 0.3 });
    const tipMat = new THREE.MeshStandardMaterial({ color: 0xf1f5f9, metalness: 0.98, roughness: 0.1 });
    const finMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    for (let f = 0; f < data.count; f++) {
      const flechetteGroup = new THREE.Group();

      // Shaft
      const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 6), shaftMat);
      shaft.rotation.x = Math.PI / 2;
      flechetteGroup.add(shaft);

      // Razor arrowhead
      const tip = new THREE.Mesh(new THREE.ConeGeometry(0.08, 0.35, 4), tipMat);
      tip.rotation.x = Math.PI / 2;
      tip.position.z = 0.65;
      flechetteGroup.add(tip);

      // Stabilizer fins
      for (let w = 0; w < 3; w++) {
        const fin = new THREE.Mesh(new THREE.BoxGeometry(0.015, 0.15, 0.25), finMat);
        fin.rotation.z = (w / 3) * Math.PI * 2;
        fin.position.z = -0.4;
        flechetteGroup.add(fin);
      }

      // Fan-out initial trajectory
      const spreadAngle = (f - 1) * 0.25;
      const initialDir = data.forward.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), spreadAngle).normalize();

      flechetteGroup.position.copy(data.origin).add(new THREE.Vector3((f - 1) * 0.4, 0, 0));
      flechetteGroup.lookAt(flechetteGroup.position.clone().add(initialDir));
      this.renderer.scene.add(flechetteGroup);

      this.projectiles.push({
        mesh: flechetteGroup,
        isGuidedFlechette: true,
        direction: initialDir,
        target: data.target,
        speed: data.speed,
        damage: data.damage,
        life: 2.2
      });
    }

    this.ui.showAnnouncement('🎯 VOLÉE DE 3 FLÉCHETTES À GUIDAGE LASER PROPULSÉE (PREY 2022) !');
  }

  deploySentryGun() {
    if (!this.player) return;
    const facing = new THREE.Vector3(Math.sin(this.player.rotationY), 0, Math.cos(this.player.rotationY)).normalize();
    const deployPos = this.player.position.clone().addScaledVector(facing, 2.5);
    deployPos.y = 0;

    this.sentryGun.deploySentry(deployPos, facing);
    this.particles.emitSparks(deployPos, 15);
    this.audio.playShieldBlock();
    this.ui.showAnnouncement('🤖 TOURELLE AUTOMATIQUE USCM UA 571-C DÉPLOYÉE (500 COUPS 10MM CASSETTE) !');
  }

  launchFalconDrone() {
    if (!this.player) return;
    this.falconDrone.launch(this.player.position);
    this.ui.showAnnouncement('🦅 DRONE FAUCON FALCONER DÉPLOYÉ : PATROUILLE AÉRIENNE & PIQUÉ DE PRÉCISION !');
  }

  performBoneScytheCleave() {
    if (!this.player) return;
    if (this.player.performBoneScytheCleave(this.horde, this.synthetics, this.bosses)) {
      this.particles.emitSparks(this.player.position, 20);
      this.ui.showAnnouncement('⚔️ FAUX D\'OS PRIMORDIALE DE L\'ALPHA PREDATOR : BALAYAGE CIRCULAIRE 360° 7.5M !');
    }
  }

  fireCompoundBow() {
    if (!this.player) return;
    const arrowData = this.player.fireCompoundBow();
    if (!arrowData) return;

    // 3D Charged Hunting Arrow with luminous cyan plasma head
    const arrowGroup = new THREE.Group();
    const shaftMat = new THREE.MeshStandardMaterial({ color: 0x1e293b, metalness: 0.8, roughness: 0.2 });
    const tipMat = new THREE.MeshBasicMaterial({ color: 0x00ffff });

    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 1.8, 6), shaftMat);
    shaft.rotation.x = Math.PI / 2;
    arrowGroup.add(shaft);

    const tip = new THREE.Mesh(new THREE.ConeGeometry(0.12, 0.5, 4), tipMat);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = 1.0;
    arrowGroup.add(tip);

    arrowGroup.position.copy(arrowData.origin);
    arrowGroup.lookAt(arrowGroup.position.clone().add(arrowData.direction));
    this.renderer.scene.add(arrowGroup);

    this.projectiles.push({
      mesh: arrowGroup,
      isChargedArrow: true,
      direction: arrowData.direction,
      speed: arrowData.speed,
      damage: arrowData.damage,
      pierceRemaining: arrowData.pierceRemaining,
      life: arrowData.life
    });

    this.ui.showAnnouncement('🏹 ARC COMPOSÉ YAUTJA : FLÈCHE PLASMA HYPER-VÉLOCITÉ PERÇANTE DÉCOCHÉE !');
  }

  deployHoloDecoy() {
    if (!this.player) return;
    const decoy = this.player.deployHoloDecoy(this.renderer.scene);
    if (!decoy) return;

    this.holoDecoys.push(decoy);
    this.ui.showAnnouncement('⚡ LEURRE HOLOGRAPHIQUE ACTIVÉ : ATTENTION DE LA RUCHE DÉTOURNÉE !');
  }

  executeMusouOverload() {
    this.ui.showAnnouncement('⚡ VRAIE ATTAQUE MUSOU : DÉVASTATION DU CLAN APEX !');
    this.audio.playOmniPlasmaStorm();

    // Intense Musou Camera Shockwave & Elastic FOV Surge
    this.triggerCameraShake(1.6, 0.7);
    this.triggerCameraFovSurge(74, 1.4);

    // Show True Musou Calligraphy Banner
    const banner = document.getElementById('true-musou-banner');
    if (banner) {
      banner.classList.remove('hidden');
      setTimeout(() => banner.classList.add('hidden'), 2200);
    }

    // Shift Battlefield Morale toward Clan (+20%)
    this.shiftBattlefieldMorale(20);

    // 8 Omni-directional rotating high-energy plasma beams
    const stormGroup = new THREE.Group();
    stormGroup.position.copy(this.player.position).add(new THREE.Vector3(0, 2.0, 0));
    const beamMat = new THREE.MeshBasicMaterial({ color: 0x00ffff, transparent: true, opacity: 0.95 });

    for (let b = 0; b < 12; b++) {
      const beamGeo = new THREE.CylinderGeometry(0.14, 0.14, 42, 6);
      beamGeo.rotateZ(Math.PI / 2);
      const beam = new THREE.Mesh(beamGeo, beamMat);
      beam.rotation.y = (b / 12) * Math.PI * 2;
      beam.position.set(Math.cos(beam.rotation.y) * 21.0, 0, Math.sin(beam.rotation.y) * 21.0);
      stormGroup.add(beam);
    }
    this.renderer.scene.add(stormGroup);

    // Animate intense storm rotation and beam pulse
    let spinAngle = 0;
    const stormAnim = setInterval(() => {
      spinAngle += 0.28;
      stormGroup.rotation.y = spinAngle;
      stormGroup.scale.multiplyScalar(1.025);
      beamMat.opacity -= 0.04;
      if (beamMat.opacity <= 0) {
        clearInterval(stormAnim);
        this.renderer.scene.remove(stormGroup);
      }
    }, 30);

    const attack = {
      origin: this.player.position,
      damage: 1200,
      radius: 40,
      isLauncher: true,
      launchVelY: 28.0,
      knockback: 18.0
    };
    const hits = this.horde.checkMeleeHits(attack);
    this.registerHits(hits);

    // Spawn massive plasma scorched ground decal at center
    this.particles.spawnPlasmaScorch(this.player.position);

    if (this.bosses.activeBoss) this.bosses.takeDamage(1500);
    if (this.badBlood.isActive) this.badBlood.takeDamage(1500);
  }

  triggerCameraShake(intensity = 0.8, duration = 0.35) {
    this.cameraShakeIntensity = intensity;
    this.cameraShakeTimer = duration;
  }

  triggerCameraFovSurge(targetFov = 72, duration = 0.6) {
    this.targetCameraFov = targetFov;
    this.cameraFovTimer = duration;
    this.cameraFovDuration = duration;
  }

  checkTrophyExecution() {
    // 1. Boss Execution (Queen, The Offspring, Predalien, Matriarch Titan)
    if (this.bosses.activeBoss && this.bosses.activeBoss.isStunned) {
      this.player.executeSpineRip();

      // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Camera
      this.bulletTimeTimer = 1.6;
      if (this.audio && this.audio.playExecutionBulletTimeWhoosh) {
        this.audio.playExecutionBulletTimeWhoosh();
      }
      this.triggerCameraFovSurge(48, 1.5);

      const bType = this.bosses.activeBoss.type || 'queen';
      let tName = 'Couronne Chitinense & Colonne Vertébrale de Reine Matriarche (Aliens 1986 / AvP 2004)';
      let tHonor = 2500;
      if (bType === 'predalien_matriarch_titan') {
        tName = 'Couronne Impériale & Quadruples Mandibules de Matriarche Titan Prédalienne (Mythique)';
        tHonor = 5000;
        this.player.royalJellyFlasks += 4;
      } else if (bType === 'the_offspring') {
        tName = 'Mandibule Hybride & Vertèbres Z-01 de The Offspring (Romulus 2024)';
        tHonor = 3500;
      } else if (bType === 'predalien_abomination') {
        tName = 'Crâne d\'Hybride Yautja-Xénomorphe & Mandibules Monstrueuses (AVP-R Chet Canon)';
        tHonor = 4000;
        this.player.royalJellyFlasks += 3;
      } else if (bType === 'predalien_queen') {
        tName = 'Mandibules Quadruples & Crâne Hybride de Reine Prédalienne (AVP-R 2007)';
        tHonor = 3000;
      } else if (bType === 'empress_matriarch') {
        tName = 'Ailes Vestigiales & Épine Royale d\'Impératrice de Ruche (Dark Horse Comics)';
        tHonor = 4000;
      } else if (bType === 'trilobite_prime') {
        tName = 'Tentacule Biologique Musculeux de Trilobite Prime (Prometheus 2012)';
        tHonor = 3000;
        if (this.audio && this.audio.playTrilobiteTentacleConstrict) this.audio.playTrilobiteTentacleConstrict();
      }

      this.player.recordTrophy(tName, tHonor);
      this.player.royalJellyFlasks += 2; // Queen grants 2 Royal Jelly flasks!
      this.sessionSkulls++;
      this.score += tHonor;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 500);

      // Decisive Battlefield Morale Victory (+35%)
      this.shiftBattlefieldMorale(35.0);

      this.renderer.scene.remove(this.bosses.activeBoss.mesh);
      this.bosses.activeBoss = null;

      if (this.ui.showOfficerDefeatedBanner) {
        this.ui.showOfficerDefeatedBanner(tName);
      }
      if (this.audio && this.audio.playOfficerDefeatedGong) {
        this.audio.playOfficerDefeatedGong();
      }
      this.triggerCameraShake(1.2, 0.6);
      this.ui.showAnnouncement(`🏆 TROPHÉE LÉGENDAIRE RÉCOLTÉ : ${tName} (+${tHonor} HONNEUR, +2 GELÉES ROYALES) !`);
      this.ui.showExecutionPrompt(false);
      return;
    }

    // 2. Sub-Boss Execution (Crusher Titan, Praetorian, Grid Alien, Marvel Alpha, Deacon, Rogue King, Raven, Ancient Predalien)
    for (let i = this.horde.aliens.length - 1; i >= 0; i--) {
      const a = this.horde.aliens[i];
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien' || a.isMarvelAlpha || a.isDeacon || a.isRogueKing || a.isRaven || a.isAncientPredalien) && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.8) {
          this.player.executeSpineRip();
          this.sessionSkulls++;

          // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Camera
          this.bulletTimeTimer = 1.4;
          if (this.audio && this.audio.playExecutionBulletTimeWhoosh) {
            this.audio.playExecutionBulletTimeWhoosh();
          }
          this.triggerCameraFovSurge(50, 1.3);

          let tName = a.isAncientPredalien
            ? 'Relique Fossilisée & Mandibules Ancestrales de l\'Ancient Predalien Elder (Primal Hunt)'
            : (a.isRaven
              ? 'Crâne d\'Obsidienne & Ailes Chitineuses du Xenomorph Raven (Colonial Marines)'
              : (a.isRogueKing
                ? 'Crâne Couronné Dentelé du King Alien Rogue (Légendaire)'
                : (a.isDeacon
                  ? 'Crâne Pointu Cobalt & Mâchoire Pharyngienne de Deacon Titan (Prometheus 2012)'
                  : (a.isMarvelAlpha
                    ? "Crâne Barbelé Argenté & Colonne Primordiale de l'Alpha Marvel (Epsilon Apex 1:1)"
                    : (a.type === 'crusher'
                      ? 'Bouclier Frontal Blindé de Crusher Titan'
                      : (a.type === 'grid_alien'
                        ? 'Crâne Gravé au Quadrillage Acide de Grid Alien (AVP 2004)'
                        : 'Couronne Royale Éburnéenne de Prétorien'))))));
          let tHonor = a.isAncientPredalien ? 4500 : (a.isRaven ? 3800 : (a.isRogueKing ? 4000 : (a.isDeacon ? 3500 : (a.isMarvelAlpha ? 3500 : (a.type === 'crusher' ? 1200 : (a.type === 'grid_alien' ? 1400 : 900))))));
          if (a.isAncientPredalien && this.audio && this.audio.playAncientPredalienAwaken) {
            this.audio.playAncientPredalienAwaken();
          } else if (a.isRaven && this.audio && this.audio.playRavenXenoShriek) {
            this.audio.playRavenXenoShriek();
          } else if (a.isRogueKing && this.audio && this.audio.playRogueKingRoar) {
            this.audio.playRogueKingRoar();
          } else if (a.isDeacon && this.audio && this.audio.playDeaconSpineRip) {
            this.audio.playDeaconSpineRip();
          }
          this.player.recordTrophy(tName, tHonor);

          if (a.isAncientPredalien) {
            this.player.royalJellyFlasks += 3;
          } else if (a.isRaven) {
            this.player.royalJellyFlasks += 2;
          } else if (a.isRogueKing) {
            this.player.royalJellyFlasks += 3;
          } else if (a.isDeacon) {
            this.player.royalJellyFlasks += 2;
          } else if (a.isMarvelAlpha) {
            this.player.royalJellyFlasks += 2; // Marvel Alpha awards 2 Royal Jelly flasks!
            this.triggerMarvelAlphaHallucination();
          } else if (a.type === 'praetorian') {
            this.player.royalJellyFlasks += 1; // Praetorian drops 1 Royal Jelly flask!
          } else if (a.type === 'grid_alien') {
            this.player.royalJellyFlasks += 1;
          }

          this.score += tHonor;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 400);

          // Sub-Boss Execution Morale Swing (+18% to +25%)
          this.shiftBattlefieldMorale((a.isMarvelAlpha || a.isRogueKing || a.isRaven || a.isAncientPredalien) ? 25.0 : 18.0);

          if (this.gore) {
            this.gore.spawnDismemberment(a.mesh.position, 'spine_rip');
          }
          this.horde.spawnAcidPool(a.mesh.position);
          this.renderer.scene.remove(a.mesh);
          this.horde.aliens.splice(i, 1);
          this.horde.deadCount++;

          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(tName);
          }
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          this.triggerCameraShake(0.9, 0.5);
          this.ui.showAnnouncement(`🏆 TROPHÉE DE CHASSE : ${tName} (+${tHonor} HONNEUR, MORAL +18%) !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }

    // 3. Chantier 10 (v46): Weyland-Yutani Combat Synthetic & Seegson Android CPU Trophy (+1800 Honor)
    if (this.synthetics && this.synthetics.androids) {
      for (let i = this.synthetics.androids.length - 1; i >= 0; i--) {
        const syn = this.synthetics.androids[i];
        if (!syn || !syn.mesh) continue;
        if ((syn.isBisected || syn.isEMPStunned || syn.hp <= 120) && syn.mesh.position.distanceTo(this.player.position) <= 4.2) {
          this.player.executeSpineRip();
          this.sessionSkulls++;
          const isJoe = syn.type === 'working_joe';
          const tName = isJoe
            ? "Unité Logique & Yeux Ambrés Seegson Working Joe (Alien: Isolation)"
            : "Cœur Cybernétique & Unité Logique Hyperdyne Systems Weyland-Yutani (Aliens 1986 / Isolation)";
          const tHonor = 1800;
          this.player.recordTrophy(tName, tHonor);
          this.score += tHonor;
          this.player.plasmaEnergy = Math.min(this.player.maxPlasmaEnergy, (this.player.plasmaEnergy || 100) + 40);
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 200);

          this.synthetics.emitWhiteSyntheticBlood(syn.mesh.position);
          this.renderer.scene.remove(syn.mesh);
          this.synthetics.androids.splice(i, 1);
          this.shiftBattlefieldMorale(15.0);

          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(tName);
          }
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          this.triggerCameraShake(0.85, 0.4);
          this.ui.showAnnouncement(`🏆 TROPHÉE CYBERNÉTIQUE ARRACHÉ : ${tName} (+${tHonor} HONNEUR, +40 ÉNERGIE) !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }
  }

  /* Chantier 10: Marvel Alpha Spine Trophy Execution & Eldritch Hallucination Pulse (Marvel Alien 2021) */
  triggerMarvelAlphaHallucination() {
    const overlay = document.getElementById('hallucination-overlay');
    if (overlay) {
      overlay.classList.remove('hidden');
      setTimeout(() => {
        overlay.classList.add('hidden');
      }, 4500);
    }
    if (this.audio && this.audio.playAlphaCommandRoar) {
      this.audio.playAlphaCommandRoar();
    }
    this.triggerCameraFovSurge(82, 1.2);
    this.triggerCameraShake(1.3, 0.6);
  }

  shiftBattlefieldMorale(deltaClan) {
    this.battlefieldMorale = Math.max(0, Math.min(100, this.battlefieldMorale + deltaClan));
    const clanFill = document.getElementById('morale-clan-fill');
    const hiveFill = document.getElementById('morale-hive-fill');
    const clanVal = document.getElementById('morale-clan-val');
    const hiveVal = document.getElementById('morale-hive-val');

    if (clanFill && hiveFill) {
      const clanPct = Math.round(this.battlefieldMorale);
      const hivePct = 100 - clanPct;
      clanFill.style.width = `${clanPct}%`;
      hiveFill.style.width = `${hivePct}%`;
      if (clanVal) clanVal.innerText = clanPct;
      if (hiveVal) hiveVal.innerText = hivePct;

      // Chantier 10: Vanguard Berserker Frenzy Threshold at 80%+
      if (clanPct >= 80 && !this.vanguardFrenzyActive) {
        this.vanguardFrenzyActive = true;
        clanFill.classList.add('morale-frenzy');
        if (this.audio && this.audio.playWarhorn) this.audio.playWarhorn();
        if (this.audio && this.audio.playMoraleShiftPing) this.audio.playMoraleShiftPing();
        this.ui.showAnnouncement('🔥 FUREUR DE L\'AVANT-GARDE DU CLAN (MORAL >= 80%) : +25% VITESSE & +35% DÉGÂTS !');
      } else if (clanPct < 75 && this.vanguardFrenzyActive) {
        this.vanguardFrenzyActive = false;
        clanFill.classList.remove('morale-frenzy');
        this.ui.showAnnouncement('⚠️ ÉQUILIBRE DU CLAN NORMALISÉ : PRESSION XENOMORPHE ACCRUE');
      }
    }
  }

  registerHits(hits) {
    hits.forEach(h => {
      this.comboHits++;
      this.comboTimer = 2.5;
      this.score += h.killed ? 150 : 25;
      this.player.musouEnergy = Math.min(this.player.maxMusouEnergy, this.player.musouEnergy + (h.killed ? 6 : 2));

      // QA Audit #3 (Karim): Diegetic Yautja targeting computer hitmarker feedback
      if (this.audio && this.audio.playDiegeticHitmarker) {
        this.audio.playDiegeticHitmarker(h.killed || h.isOfficer);
      }

      // Shift Morale: Kills favor Yautja Clan
      if (h.killed) {
        if (h.isOfficer) {
          // Defeating an officer swings battlefield morale dramatically!
          this.shiftBattlefieldMorale(12.0);
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          const title = h.officerTitle || 'PRAETORIAN ROYAL GUARD';
          if (this.ui.showOfficerDefeatedBanner) {
            this.ui.showOfficerDefeatedBanner(title);
          } else {
            this.ui.showAnnouncement(`⚔️ OFFICIER VAINCU : ${title} PURGÉ ! ÉQUILIBRE DU CLAN +12% !`);
          }
          this.triggerCameraShake(0.8, 0.45);
        } else {
          this.shiftBattlefieldMorale(0.4);
        }
      }

      if (h.pos) {
        this.particles.emitBlood(h.pos, 8, true);
        this.particles.spawnDamagePopup(h.pos, h.damage, h.killed);
      }
    });

    this.ui.showCombo(this.comboHits);
    if (this.env && this.player) {
      this.env.checkTransformerHits(this.player.position, 3.8, this.synthetics, this.horde, this.audio, this.particles);
      this.env.checkBlastDoorHits(this.player.position, 3.8, 140, this.audio, this.particles);
      this.env.checkFuelLineDamage(this.player.position, 3.8, 75, this.audio, this.particles, this.ui);
    }
    this.checkAnnouncerMilestones();
  }

  checkAnnouncerMilestones() {
    const kos = this.horde.deadCount;
    const milestones = [
      { count: 50, msg: "50 KOS - JEUNE GUERRIER EN INITIATION (YOUNG BLOOD) !" },
      { count: 100, msg: "100 KOS - CHASSEUR BALAFRÉ DANS LE SANG (BLOODED WARRIOR) !" },
      { count: 250, msg: "250 KOS - MAÎTRE CHASSEUR D'ÉLITE DU CLAN (ELITE HUNTER) !" },
      { count: 500, msg: "500 KOS - CHEF DE GUERRE DU GRAND CLAN (CLAN LEADER) !" },
      { count: 1000, msg: "1000 KOS - LÉGENDE VIVANTE DES ANCIENS APEX (ANCIENT YAUTJA) !" }
    ];

    milestones.forEach(m => {
      if (kos >= m.count && !this.announcedMilestones[m.count]) {
        this.announcedMilestones[m.count] = true;
        this.ui.showAnnouncement(`🏆 ${m.count} TROPHÉES ! ${m.msg}`);
        if (this.audio && this.audio.playMusouKOCallout) {
          this.audio.playMusouKOCallout();
        } else {
          this.audio.playAnnouncerTone();
        }
      }
    });
  }

  update(delta) {
    if (!this.isPlaying || !this.player || this.isPaused) return;

    if (this.photoMode.isActive) return;

    // Chantier 9 (v48): Bullet-Time 360° Trophy Execution Time-Dilation (0.28x Slow-Motion)
    if (this.bulletTimeTimer > 0) {
      this.bulletTimeTimer -= delta;
      delta *= 0.28;
    }

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

    // Chantier 7 (v44): Sustained Yautja Burner / Incinerator Plasma Flamer Mode
    if (this.player.isFlamerActive) {
      this.player.firePlasmaFlamer(delta, this.horde, this.env, this.particles);
    }

    // Chantier 5 (v47): USCM M41A Underbarrel 30mm HEDP Grenades Flight & Detonation
    if (this.player && this.player.updateM41AGrenades) {
      this.player.updateM41AGrenades(delta, this.horde, this.bosses, this.synthetics, this.env, this.particles);
    }

    // Chantier 1 (v48): Yautja Scout Ship Stratospheric Thermal Beam Strike
    if (this.player && this.player.updateScoutShipBeam) {
      this.player.updateScoutShipBeam(delta, this.horde, this.bosses, this.synthetics, this.particles);
    }

    // Chantier 5 (v49.0): Tracker Predator Biomechanical Sonic Trap Mine Countdown & Acoustic Implosion
    if (this.player && this.player.updateSonicTraps) {
      this.player.updateSonicTraps(delta, this.horde, this.bosses, this.particles);
    }

    // QA Audit #3 (Karim): Critical Low Health Bio-Telemetry Heartbeat Beep
    if (this.player && this.player.hp > 0 && this.player.hp <= (this.player.maxHp || 1000) * 0.25) {
      this.lowHealthBeepTimer = (this.lowHealthBeepTimer || 0) + delta;
      if (this.lowHealthBeepTimer >= 1.25) {
        this.lowHealthBeepTimer = 0;
        if (this.audio && this.audio.playCriticalLowHealthBeep) {
          this.audio.playCriticalLowHealthBeep();
        }
      }
    } else {
      this.lowHealthBeepTimer = 0;
    }

    // Chantier 6 & 9 (v47) + Chantier 4, 5 & 9 (v48) + Chantier 3, 4 & 9 (v49) Interactive Stations
    if (this.env) {
      if (this.env.updateCoolingTowerCryoVent) {
        this.env.updateCoolingTowerCryoVent(delta, this.player, this.horde, this.bosses, this.particles, this.audio);
      }
      if (this.env.updateMutagenPuddles) {
        this.env.updateMutagenPuddles(delta, this.player, this.horde, this.audio);
      }
      if (this.env.updateMoltenLeadFoundry) {
        this.env.updateMoltenLeadFoundry(delta, this.player, this.horde, this.bosses, this.particles);
      }
      if (this.env.updateReprogrammedAndroids) {
        this.env.updateReprogrammedAndroids(delta, this.player, this.horde, this.bosses, this.audio, this.particles);
      }
      if (this.env.updateVolcanicAshStorm) {
        this.env.updateVolcanicAshStorm(delta, this.player, this.audio, this.ui);
      }
      if (this.env.updateUSCMMissileBattery) {
        this.env.updateUSCMMissileBattery(delta, this.horde, this.bosses, this.audio, this.particles);
      }
      if (this.env.updateAurigaFloodedBasin) {
        this.env.updateAurigaFloodedBasin(delta, this.player, this.horde, this.bosses, this.particles);
      }
      if (this.env.updateAncientShrine) {
        this.env.updateAncientShrine(delta, this.player, this.horde);
      }
    }

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
    this.dropship.update(delta, this.horde);
    this.apc.update(delta, this.horde, this.bosses);
    this.sentryGun.update(delta, this.horde);
    this.falconDrone.update(delta, this.player.position, this.horde);
    this.skimmer.update(delta, this.player, this.horde, this.keys);
    this.orbital.update(delta);
    if (this.weather) this.weather.update(delta, this.player ? this.player.position : null, this.renderer, this.audio, this.horde);
    if (this.env) this.env.update(delta, this.horde, this.audio, this.player);
    if (this.renderer) this.renderer.update(delta);
    if (this.citadel) this.citadel.update(delta);

    // Update Engineer Black Pathogen Pools (Prometheus 2012)
    if (this.pathogenCooldown > 0) this.pathogenCooldown -= delta;
    for (let i = this.pathogenPools.length - 1; i >= 0; i--) {
      const p = this.pathogenPools[i];
      p.life -= delta;
      if (this.horde) {
        this.horde.checkMeleeHits({ origin: p.pos, radius: 4.2, damage: p.damage * delta, type: 'pathogen' });
      }
      if (this.synthetics) {
        this.synthetics.checkHits({ origin: p.pos, radius: 4.2, damage: p.damage * delta });
      }
      if (p.life <= 0) {
        this.renderer.scene.remove(p.urnMesh);
        this.renderer.scene.remove(p.poolMesh);
        this.pathogenPools.splice(i, 1);
      }
    }

    // Update Holographic Decoys (Hunting Grounds Canon)
    for (let i = this.holoDecoys.length - 1; i >= 0; i--) {
      const d = this.holoDecoys[i];
      d.life -= delta;
      d.mesh.position.addScaledVector(d.direction, d.speed * delta);
      d.mesh.children.forEach(c => {
        if (c.material) c.material.opacity = 0.4 + Math.sin(Date.now() * 0.03) * 0.25;
      });

      // Lure horde aggro towards decoy
      if (this.horde && this.horde.aliens) {
        this.horde.aliens.forEach(a => {
          if (a && a.mesh && a.mesh.position.distanceTo(d.mesh.position) < 18.0) {
            const lureDir = d.mesh.position.clone().sub(a.mesh.position).normalize();
            a.mesh.position.addScaledVector(lureDir, 3.5 * delta);
          }
        });
      }

      if (d.life <= 0) {
        this.audio.playHoloDecoyDetonate();
        this.particles.emitSparks(d.mesh.position, 25);
        if (this.horde) {
          this.horde.checkMeleeHits({ origin: d.mesh.position, radius: 8.0, damage: 280, type: 'heavy' });
        }
        this.renderer.scene.remove(d.mesh);
        this.holoDecoys.splice(i, 1);
      }
    }

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

    // Apply Musou Camera Shake
    if (this.cameraShakeTimer > 0) {
      this.cameraShakeTimer -= delta;
      const shakeAmt = this.cameraShakeIntensity * Math.min(1.0, this.cameraShakeTimer / 0.35);
      this.renderer.camera.position.x += (Math.random() - 0.5) * shakeAmt;
      this.renderer.camera.position.y += (Math.random() - 0.5) * shakeAmt;
      this.renderer.camera.position.z += (Math.random() - 0.5) * shakeAmt;
    }

    // Apply Musou FOV Surge & Elastic Snapback
    if (this.cameraFovTimer > 0) {
      this.cameraFovTimer -= delta;
      const t = Math.max(0, this.cameraFovTimer / (this.cameraFovDuration || 0.6));
      this.renderer.camera.fov = THREE.MathUtils.lerp(this.baseFov, this.targetCameraFov, Math.sin(t * Math.PI));
      this.renderer.camera.updateProjectionMatrix();
    } else if (this.renderer.camera.fov !== this.baseFov) {
      this.renderer.camera.fov = this.baseFov;
      this.renderer.camera.updateProjectionMatrix();
    }

    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i];
      p.life -= delta;

      // Alien: Romulus Zero-G Acid Globule Vaporization
      if (this.horde && this.horde.zeroGAcidGlobules) {
        for (let g = this.horde.zeroGAcidGlobules.length - 1; g >= 0; g--) {
          const glob = this.horde.zeroGAcidGlobules[g];
          if (glob && glob.mesh && glob.mesh.position.distanceTo(p.mesh.position) <= 2.2) {
            this.particles.emitSparks(glob.mesh.position, 8);
            if (this.audio && this.audio.playAcidGlobuleHiss) this.audio.playAcidGlobuleHiss();
            this.renderer.scene.remove(glob.mesh);
            this.horde.zeroGAcidGlobules.splice(g, 1);
            break;
          }
        }
      }

      if (p.isSmartDisc) {
        p.progress += p.speed * delta;
        p.mesh.rotation.z += 25 * delta; // Rapid slicing gyro-spin

        // Chantier 4: Periodic high-frequency gyro slicing rotor hum
        p.rotorTimer = (p.rotorTimer || 0) + delta;
        if (p.rotorTimer >= 0.22) {
          p.rotorTimer = 0;
          if (this.audio && this.audio.playSmartDiscRotor) this.audio.playSmartDiscRotor();
        }

        // Multi-Target Waypoint Chain or Quadratic Bezier Curve (Predator 2 Canon)
        let currentPos;
        const playerCurrentHand = this.player.position.clone().add(new THREE.Vector3(0.8, 1.8, 0.4));

        if (p.waypoints && p.waypoints.length > 0) {
          const pts = [p.startPos, ...p.waypoints, playerCurrentHand];
          const totalSegments = pts.length - 1;
          const scaledT = Math.min(0.999, p.progress) * totalSegments;
          const segIdx = Math.floor(scaledT);
          const segT = scaledT - segIdx;
          const pA = pts[segIdx];
          const pB = pts[segIdx + 1];
          currentPos = pA.clone().lerp(pB, segT);
        } else {
          const t = Math.min(1.0, p.progress);
          const p0 = p.startPos;
          const p1 = p.apexPos;
          const p2 = playerCurrentHand;
          currentPos = new THREE.Vector3(
            (1 - t) * (1 - t) * p0.x + 2 * (1 - t) * t * p1.x + t * t * p2.x,
            (1 - t) * (1 - t) * p0.y + 2 * (1 - t) * t * p1.y + t * t * p2.y,
            (1 - t) * (1 - t) * p0.z + 2 * (1 - t) * t * p1.z + t * t * p2.z
          );
        }
        p.mesh.position.copy(currentPos);

        if (this.env) {
          this.env.checkTransformerHits(p.mesh.position, 2.2, this.synthetics, this.horde, this.audio, this.particles);
          this.env.checkBlastDoorHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkCraneCableHit(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
          this.env.checkEggClusterHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
          this.env.checkSteamConduitHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkOvipositorHit(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde, this.bosses);
          this.env.checkNitrogenTankHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles);
          this.env.checkWebbingDamage(p.mesh.position, 2.2, p.damage, this.particles);
          this.env.checkCryoTubeHits(p.mesh.position, 2.2, p.damage, this.audio, this.particles, this.horde);
        }

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
        if (hits.length > 0) {
          this.particles.emitSparks(p.mesh.position, 6);
          if (this.gore && this.gore.spawnDismemberment) {
            this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
          }
          this.registerHits(hits);
        }

        if (this.bosses && this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.particles.emitSparks(p.mesh.position, 8);
          if (this.gore && this.gore.spawnDismemberment) {
            this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
          }
        }

        if (this.synthetics) {
          const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
          if (synHits.length > 0) {
            this.particles.emitSparks(p.mesh.position, 6);
            if (this.gore && this.gore.spawnDismemberment) {
              this.gore.spawnDismemberment(p.mesh.position, 'smart_disc');
            }
          }
        }

        if (p.progress >= 1.0 || p.life <= 0) {
          // Returned to player hand
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
          this.audio.playShieldBlock();
        }
      } else if (p.isCombiStick) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage, type: 'combistick' });
        if (hits.length > 0) {
          hits.forEach((h) => {
            this.audio.playCombiStickImpale();
            this.particles.emitSparks(p.mesh.position, 8);
            if (h.killed && this.gore && this.gore.spawnWallPinnedPart) {
              this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'combistick');
            }
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
      } else if (p.isShuriken) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);
        p.mesh.rotation.y += 35 * delta;

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: p.radius || 3.0, damage: p.damage });
        if (hits.length > 0) {
          this.audio.playShurikenSlice();
          this.particles.emitSparks(p.mesh.position, 8);
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.audio.playShurikenSlice();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.8, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playShurikenSlice();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.isGuidedFlechette) {
        // Dynamic homing steering towards target or laser reticle
        if (p.target && p.target.mesh && p.target.hp > 0) {
          const targetPos = p.target.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
          const steerDir = targetPos.sub(p.mesh.position).normalize();
          p.direction.lerp(steerDir, 9.0 * delta).normalize();
        }
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);
        p.mesh.lookAt(p.mesh.position.clone().add(p.direction));

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 1.8, damage: p.damage, type: 'flechette' });
        if (hits.length > 0 || p.life <= 0) {
          if (hits.length > 0) {
            this.audio.playFlechetteImpale();
            this.particles.emitSparks(p.mesh.position, 8);
            hits.forEach((h) => {
              if (h.killed && this.gore && this.gore.spawnWallPinnedPart && Math.random() < 0.5) {
                this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'arrow');
              }
            });
            this.registerHits(hits);
          }
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.isChargedArrow) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage, type: 'arrow' });
        if (hits.length > 0) {
          this.audio.playArrowPinImpact();
          this.particles.emitSparks(p.mesh.position, 10);
          hits.forEach((h) => {
            if (h.killed && this.gore && this.gore.spawnWallPinnedPart) {
              this.gore.spawnWallPinnedPart(p.mesh.position, p.direction, 'arrow');
            }
          });
          this.registerHits(hits);
          p.pierceRemaining -= hits.length;
        }

        if (this.bosses.activeBoss && p.mesh.position.distanceTo(this.bosses.activeBoss.mesh.position) <= 4.0) {
          this.bosses.takeDamage(p.damage);
          this.audio.playArrowPinImpact();
          p.pierceRemaining--;
        }

        const synHits = this.synthetics.checkHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (synHits.length > 0) {
          p.pierceRemaining -= synHits.length;
          this.audio.playArrowPinImpact();
        }

        if (p.pierceRemaining <= 0 || p.life <= 0) {
          this.renderer.scene.remove(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        if (p.isSuperCharged) {
          p.mesh.rotation.x += 12 * delta;
          p.mesh.rotation.y += 12 * delta;
          if (this.particles) this.particles.emitSparks(p.mesh.position, 2);

          const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 8.5, damage: p.damage, type: 'heavy' });
          if (hits.length > 0 || p.life <= 0) {
            this.particles.emitSparks(p.mesh.position, 35);
            this.particles.spawnPlasmaScorch(p.mesh.position);
            this.triggerCameraShake(1.0, 0.45);
            if (this.audio && this.audio.playC6CataclysmBoom) this.audio.playC6CataclysmBoom();
            this.renderer.scene.remove(p.mesh);
            this.projectiles.splice(i, 1);
            if (hits.length > 0) this.registerHits(hits);
          }
        } else {
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
    }

    this.badBlood.update(delta, this.player, this.ui, this.gore, this.particles, this);
    this.marines.update(delta, this.player, this.horde);
    this.allies.update(delta, this.player.position, this.horde);
    this.horde.update(delta, this.player);
    this.bosses.update(delta, this.player, this.horde);
    this.gore.update(delta);
    this.particles.update(delta, this.renderer.camera);
    this.updateTargetLockReticle();

    // Sentry Gun Proximity HUD Prompt (Chantier 5)
    const isNearSentry = this.sentryGun && this.sentryGun.isDeployed && this.player && this.player.position.distanceTo(this.sentryGun.mesh.position) < 3.5;
    this.ui.updateSentryProximityPrompt(isNearSentry, this.sentryGun);

    // Trax-Net Wall-Penetrating Tracker HUD (Chantier 3)
    const traxTargets = [];
    if (this.horde && this.horde.aliens) traxTargets.push(...this.horde.aliens.filter(a => a && a.isTraxTagged));
    if (this.synthetics && this.synthetics.units) traxTargets.push(...this.synthetics.units.filter(s => s && s.isTraxTagged));
    if (this.bosses && this.bosses.activeBoss && this.bosses.activeBoss.isTraxTagged) traxTargets.push(this.bosses.activeBoss);
    this.ui.updateTraxNetTelemetry(traxTargets, this.renderer.camera, this.player);

    // Chantier 3 (v43): Smart-Disc Telemetric Remote Guidance Update
    if (this.player && this.player.isSmartDiscGuiding && this.player.guidedSmartDisc) {
      const cameraDir = new THREE.Vector3();
      this.renderer.camera.getWorldDirection(cameraDir);
      this.player.updateSmartDiscRemoteGuidance(delta, cameraDir);
    }

    // Chantier 4 (v43): Fallen Marine Scavenge Proximity Prompt
    const nearMarine = this.env && this.env.fallenMarines && this.env.fallenMarines.find(m => !m.isScavenged && this.player && this.player.position.distanceTo(m.pos) <= 2.8);
    this.ui.updateMarineScavengePrompt(!!nearMarine, nearMarine);

    // Chantier 6 (v44): Caterpillar Power Loader Workstation Proximity Prompt
    const isNearLoader = this.env && this.env.powerLoader && this.player && this.player.position.distanceTo(this.env.powerLoader.pos) < 4.8;
    const loaderPrompt = document.getElementById('power-loader-prompt');
    if (loaderPrompt) {
      if (isNearLoader && this.env.powerLoader.clampCooldown <= 0) {
        loaderPrompt.classList.remove('hidden');
      } else {
        loaderPrompt.classList.add('hidden');
      }
    }

    // Chantier 2 (v45): Drivable USCM M577 APC Proximity Prompt
    const isNearAPC = this.env && this.env.drivableAPC && this.player && this.player.position.distanceTo(this.env.drivableAPC.pos) < 4.8;
    const apcPrompt = document.getElementById('apc-mount-prompt');
    if (apcPrompt) {
      if (isNearAPC) apcPrompt.classList.remove('hidden');
      else apcPrompt.classList.add('hidden');
    }

    // Chantier 3 (v45): Reactor Meltdown Console Proximity Prompt
    const isNearReactor = this.env && this.env.reactorConsole && this.player && this.player.position.distanceTo(this.env.reactorConsole.pos) < 4.2;
    const reactorPrompt = document.getElementById('reactor-console-prompt');
    if (reactorPrompt) {
      if (isNearReactor) reactorPrompt.classList.remove('hidden');
      else reactorPrompt.classList.add('hidden');
    }

    // Chantier 6 (v45): Electric Floor Grid Breaker Proximity Prompt
    const isNearGrid = this.env && this.env.electricFloorGrids && this.player && this.env.electricFloorGrids.some(g => !g.isActive && this.player.position.distanceTo(g.pos) < 5.0);
    const gridPrompt = document.getElementById('electric-grid-prompt');
    if (gridPrompt) {
      if (isNearGrid) gridPrompt.classList.remove('hidden');
      else gridPrompt.classList.add('hidden');
    }

    // Chantier 9 (v45): Med-Lab Decontamination Airlock Proximity Prompt
    const isNearDecon = this.env && this.env.deconAirlock && this.player && this.player.position.distanceTo(this.env.deconAirlock.pos) < 3.8;
    const deconPrompt = document.getElementById('decon-airlock-prompt');
    if (deconPrompt) {
      if (isNearDecon && this.env.deconAirlock.cooldown <= 0) deconPrompt.classList.remove('hidden');
      else deconPrompt.classList.add('hidden');
    }

    // Chantier 7 (v45): Ki'cte Gauntlet Grapple Availability Prompt
    const isNearGrappleTarget = this.player && this.player.grappleCooldown <= 0 && this.horde && this.horde.aliens && this.horde.aliens.some(a => a && a.hp > 0 && a.mesh && a.mesh.position.distanceTo(this.player.position) <= 3.5);
    const grapplePrompt = document.getElementById('grapple-prompt');
    if (grapplePrompt) {
      if (isNearGrappleTarget) grapplePrompt.classList.remove('hidden');
      else grapplePrompt.classList.add('hidden');
    }

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
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien' || a.isDeacon || a.isRogueKing || a.isRaven || a.isAncientPredalien) && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.8) {
          subBossStunnedNearby = true;
        }
      }
    });

    let syntheticHarvestNearby = false;
    if (this.synthetics && this.synthetics.androids) {
      this.synthetics.androids.forEach(syn => {
        if ((syn.isBisected || syn.isEMPStunned || syn.hp <= 120) && syn.mesh.position.distanceTo(this.player.position) <= 4.2) {
          syntheticHarvestNearby = true;
        }
      });
    }
    this.ui.showExecutionPrompt((boss && boss.isStunned) || subBossStunnedNearby || syntheticHarvestNearby);

    // v46.0, v47.0, v48.0 & v49.0 Proximity Prompts & Diegetic Telemetry
    if (this.env && this.player) {
      const isNearSmartgun = this.env.mountedSmartgun && this.player.position.distanceTo(this.env.mountedSmartgun.pos) <= 3.2;
      this.ui.updateSmartgunPrompt(isNearSmartgun, this.player.isMountedSmartgun, this.env.mountedSmartgun);

      const isNearCrane = this.env.craneConsole && this.player.position.distanceTo(this.env.craneConsole.pos) <= 3.2;
      this.ui.updateCargoCranePrompt(isNearCrane, this.env.craneConsole);

      const isNearCryoVent = this.env.coolingTowerCryoVent && this.player.position.distanceTo(this.env.coolingTowerCryoVent.consolePos) <= 3.2;
      this.ui.updateCryoVentPrompt(isNearCryoVent, this.env.coolingTowerCryoVent);

      const isNearFoundry = this.env.moltenFoundry && this.player.position.distanceTo(this.env.moltenFoundry.valvePos) <= 4.5;
      if (this.ui.updateFoundryValvePrompt) {
        this.ui.updateFoundryValvePrompt(isNearFoundry, this.env.moltenFoundry);
      }

      // Chantier 4 (v49): USM Auriga Flooded Basin 50,000V Breaker Proximity Prompt
      const isNearAuriga = this.env.aurigaBasin && this.player.position.distanceTo(this.env.aurigaBasin.breakerPos) <= 4.2;
      const aurigaPrompt = document.getElementById('auriga-breaker-prompt');
      if (aurigaPrompt) {
        if (isNearAuriga && !this.env.aurigaBasin.isElectrified && this.env.aurigaBasin.cooldown <= 0) aurigaPrompt.classList.remove('hidden');
        else aurigaPrompt.classList.add('hidden');
      }

      // Chantier 9 (v49): Ancient Yautja Shrine of the Ancients Proximity Prompt
      const isNearShrine = this.env.ancientShrine && this.player.position.distanceTo(this.env.ancientShrine.pos) <= 4.5;
      const shrinePrompt = document.getElementById('ancient-shrine-prompt');
      if (shrinePrompt) {
        if (isNearShrine && this.env.ancientShrine.cooldown <= 0) shrinePrompt.classList.remove('hidden');
        else shrinePrompt.classList.add('hidden');
      }

      const isInsideDerelict = this.env.derelictChamber && this.player.position.distanceTo(this.env.derelictChamber.center) <= this.env.derelictChamber.radius;
      this.ui.updateDerelictHud(isInsideDerelict);

      // QA Audit #2 (Elena): Diegetic Wrist Gauntlet Telemetry Update
      if (this.ui.updateDiegeticWristTelemetry) {
        this.ui.updateDiegeticWristTelemetry(this.player, this.env, this.isEndlessMode);
      }
    }

    if (this.horde.aliens.length < 10 && !this.bosses.activeBoss) {
      if (this.waveIndex < this.totalWaves || this.isEndlessMode) {
        this.waveIndex++;

        // QA Audit #5 (Sofia): Tactical Wave Munition Dropship Resupply
        if (this.player) {
          this.player.m41aGrenadeCharges = Math.min(6, (this.player.m41aGrenadeCharges || 0) + 2);
          this.player.m77GaussAmmo = Math.min(12, (this.player.m77GaussAmmo || 0) + 4);
          this.player.seegsonBoltAmmo = Math.min(10, (this.player.seegsonBoltAmmo || 0) + 3);
          this.player.medicompCharges = Math.min(5, (this.player.medicompCharges || 0) + 1);
        }

        this.horde.spawnWave(45 + this.waveIndex * 15, this.player.position);
        this.ui.showAnnouncement(this.waveIndex > this.totalWaves
          ? `♾️ VAGUE SURVIE INFINIE ${this.waveIndex} ("SURVIVAL OF THE WORTHY") DÉPLOYÉE !`
          : `VAGUE ${this.waveIndex} APPROCHE ! FORCES DE LA RUCHE DÉPLOYÉES !`);

        // Cheyenne Dropship Airstrike Support on Wave 2 & 4!
        if (this.waveIndex === 2 || this.waveIndex === 4) {
          this.dropship.triggerAirstrike(this.player.position, this.horde);
          this.ui.showAnnouncement('✈️ DROPSHIP CHEYENNE UD-4L DÉPLOYÉ : SALVE DE ROQUETTES 70MM !');
          if (this.waveIndex === 2) {
            setTimeout(() => {
              this.sentryGun.deploySentry(this.player.position.clone().add(new THREE.Vector3(3.5, 0, 2)));
              this.ui.showAnnouncement('📦 LARGAGE TACTIQUE : TOURELLE SENTINELLE UA 571-C DÉPLOYÉE EN APPUI !');
            }, 2500);
          }
        }

        if (this.waveIndex === 3) {
          this.badBlood.spawnAmbush(this.player.position);
          this.ui.showAnnouncement('⚠️ ALERTE : EMBUSCADE D\'UN YAUTJA RENÉGAT "BAD BLOOD" !');
          this.apc.spawn(this.player.position.clone().add(new THREE.Vector3(-18, 0, -10)));
          setTimeout(() => {
            this.ui.showAnnouncement('🛡️ RENFORT BLINDÉ : BLINDÉ USCM M577 APC EN POSITION DE TIR !');
          }, 1800);
        }

        // Spawn Predalien Matriarch Titan (10,000 HP) on Wave 5 and every 3 waves in Endless Mode
        if (this.waveIndex === 5 || (this.waveIndex > 5 && this.waveIndex % 3 === 0)) {
          const bType = this.waveIndex === 5 ? 'predalien_matriarch_titan' : (this.ui.selectedLevel.bossType || 'predalien_matriarch_titan');
          if (this.env && !this.env.reactorMeltdownActive && this.waveIndex === 5) {
            this.env.triggerReactorMeltdown(this.ui, this.audio);
          }
          this.bosses.spawnBoss(bType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));
          this.ui.showAnnouncement('👑 SURGISSEMENT DU BOSS SUPRÊME : MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE (10 000 PV) !');
          this.shiftBattlefieldMorale(-25.0);
        }
      } else if (!this.bosses.activeBoss) {
        let bType = this.ui.selectedLevel.bossType || 'predalien_matriarch_titan';
        if (this.waveIndex === 5 || bType === 'predalien_abomination') {
          bType = 'predalien_matriarch_titan';
          if (this.env && !this.env.reactorMeltdownActive) {
            this.env.triggerReactorMeltdown(this.ui, this.audio);
          }
        }
        this.bosses.spawnBoss(bType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));
        
        let bossTitle = 'MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE (AVP EXTINCTION / AVP-R)';
        if (bType === 'the_offspring') bossTitle = 'HYBRIDE GÉNOTYPIQUE THE OFFSPRING (ROMULUS 2024)';
        else if (bType === 'trilobite_prime') bossTitle = 'TRILOBITE CÉPHALOPODE PRIME (PROMETHEUS 2012)';
        else if (bType === 'predalien_abomination') bossTitle = 'ABOMINATION PRÉDALIENNE GESTANTE (AVP-R 2007 CHET)';
        else if (bType === 'predalien_queen') bossTitle = 'REINE PRÉDALIENNE ABOMINATION DU CLAN (AVP-R 2007)';
        else if (bType === 'empress_matriarch') bossTitle = 'IMPÉRATRICE VOLANTE DE LA RUCHE PRIMORDIALE (DARK HORSE)';

        this.ui.showAnnouncement(`👑 SURGISSEMENT DU BOSS APEX : ${bossTitle} !`);
        // Shift Morale towards Hive (-25%) upon Apex Boss appearance
        this.shiftBattlefieldMorale(-25.0);
      }
    }

    if (this.comboTimer > 0) {
      this.comboTimer -= delta;
      if (this.comboTimer <= 0) {
        this.comboHits = 0;
        this.ui.showCombo(0);
        const tagElem = document.getElementById('combo-chain-indicator');
        if (tagElem) {
          tagElem.innerText = 'NORMAL COMBO';
          tagElem.style.color = '#00d2ff';
        }
      }
    }

    // Update Plasma Caster Charging State & Tri-Laser Convergence (Predator 1987)
    if (this.player && this.player.isChargingPlasma) {
      this.player.plasmaChargeTime += delta;
      const targetPos = this.player.targetLockEnemy && this.player.targetLockEnemy.mesh ? this.player.targetLockEnemy.mesh.position : null;
      this.player.updateLaserLock(targetPos);
    }

    // Dynamic Tug-of-War Morale update (Alien pressure slowly regains ground if Yautja is idle)
    if (this.battlefieldMorale > 25.0) {
      this.shiftBattlefieldMorale(-0.15 * delta);
    }

    // Chantier 10: Vanguard Berserker Frenzy Golden Aura
    if (this.vanguardFrenzyActive && this.player) {
      this.frenzyAuraTimer = (this.frenzyAuraTimer || 0) + delta;
      if (this.frenzyAuraTimer >= 0.35) {
        this.frenzyAuraTimer = 0;
        if (this.particles && this.particles.emitGoldRageSparks) {
          this.particles.emitGoldRageSparks(this.player.position, 3);
        }
      }
    }

    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score, {
      badBlood: this.badBlood,
      marines: this.marines,
      allies: this.allies,
      synthetics: this.synthetics
    });

    // Visor Acid Corrosion HUD Overlay Update (Alien: Romulus 2024)
    const acidOverlay = document.getElementById('acid-corrosion-overlay');
    if (acidOverlay) {
      if (this.player && this.player.visorAcidBurn > 0.05) {
        acidOverlay.classList.remove('hidden');
        acidOverlay.style.opacity = Math.min(1.0, this.player.visorAcidBurn);
      } else {
        acidOverlay.classList.add('hidden');
      }
    }

    // Berserker Rage Screen Glow Overlay Update (Aliens: Genocide Lore)
    const rageOverlay = document.getElementById('berserker-rage-overlay');
    if (rageOverlay) {
      if (this.player && this.player.isBerserkerActive) {
        rageOverlay.classList.remove('hidden');
      } else {
        rageOverlay.classList.add('hidden');
      }
    }

    // Update HUD slots for Plasma Glaive and Royal Jelly
    const glaiveSlot = document.getElementById('slot-glaive');
    if (glaiveSlot && this.player) {
      glaiveSlot.classList.toggle('active', this.player.isPlasmaGlaiveActive);
      glaiveSlot.classList.toggle('cooldown', this.player.plasmaGlaiveCooldown > 0);
    }

    const jellySlot = document.getElementById('slot-jelly');
    if (jellySlot && this.player) {
      jellySlot.classList.toggle('active', this.player.isBerserkerActive);
      const label = jellySlot.querySelector('.slot-label');
      if (label) {
        label.innerText = `GELÉE ROYALE (${this.player.royalJellyFlasks})`;
      }
    }

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
        const name = this.bosses.activeBoss.type === 'predalien_queen' ? 'PREDALIEN QUEEN MATRIARCH' :
                     this.bosses.activeBoss.type === 'empress_matriarch' ? 'EMPRESS MATRIARCH IMPERIAL' : 'REINE XÉNOMORPHE';
        bestTarget = {
          pos: bossPos.clone().add(new THREE.Vector3(0, 3, 0)),
          dist: d,
          name,
          weakpoint: "FAIBLESSE : SAC D'INOCULATION & ÉCUSSON CERVICAL (3.5X)"
        };
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
          let name = 'XENOMORPH DRONE';
          let weakpoint = 'FAIBLESSE : DÔME CRÂNIEN (-40% ARMURE)';
          if (a.type === 'crusher') {
            name = 'BROYEUR CRUSHER TITAN';
            weakpoint = 'FAIBLESSE : ABDOMEN VENTRAL & ARTICULATIONS';
          } else if (a.type === 'praetorian') {
            name = 'GARDE ROYALE PRAETORIEN';
            weakpoint = 'FAIBLESSE : CONDUITS RESPIRATOIRES DORSAL';
          } else if (a.type === 'spitter') {
            name = 'CRACHEUR D\'ACIDE SPITTER';
            weakpoint = 'FAIBLESSE : POCHES GASTRIQUES ACIDIFIÉES';
          } else if (a.type === 'facehugger') {
            name = 'ARACHNIDE FACEHUGGER';
            weakpoint = 'FAIBLESSE : CORPUS EMBRYONNAIRE VITAL';
          } else if (a.type === 'grid_alien') {
            name = 'ALIEN BALAFRÉ (GRID NEMESIS)';
            weakpoint = 'FAIBLESSE : CICATRICES CHITINEUSES FIBREUSES';
          } else if (a.type === 'red_warrior') {
            name = 'GUERRIER KAINDE AMEDHA ÉCARLATE';
            weakpoint = 'FAIBLESSE : ÉCORCE CHITINEUSE CHAUFFÉE';
          }

          bestTarget = {
            pos: a.mesh.position.clone().add(new THREE.Vector3(0, 1.4, 0)),
            dist: d,
            name,
            weakpoint
          };
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
          bestTarget = {
            pos: syn.mesh.position.clone().add(new THREE.Vector3(0, 1.6, 0)),
            dist: d,
            name: 'ANDROÏDE WEYLAND-YUTANI 8800',
            weakpoint: 'FAIBLESSE : CELLULE D\'ALIMENTATION THORACIQUE'
          };
        }
      }
    }

    if (bestTarget) {
      this.player.updateLaserLock(bestTarget.pos);

      // Play lock chime if newly acquired target
      if (!this.lockedTargetPos || this.lockedTargetPos.distanceTo(bestTarget.pos) > 4.0) {
        this.audio.playTargetLockPing();
        this.audio.playRomulusSmartAimPing();
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

        const genusEl = document.getElementById('hud-telemetry-genus');
        const statsEl = document.getElementById('hud-telemetry-stats');
        const weakpointEl = document.getElementById('hud-telemetry-weakpoint');

        if (genusEl && statsEl && weakpointEl) {
          genusEl.innerText = `GENUS : ${bestTarget.name}`;
          statsEl.innerText = `DISTANCE : ${bestTarget.dist.toFixed(1)}M | MENACE : ÉLEVÉE`;
          weakpointEl.innerText = bestTarget.weakpoint;
        } else {
          infoEl.innerText = `TRI-LOCK: ${bestTarget.dist.toFixed(1)}m - ${bestTarget.name}`;
        }

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
    this.apc.clear();
    this.sentryGun.clear();
    this.falconDrone.clear();
    if (this.bosses) this.bosses.clear();
    if (this.badBlood) this.badBlood.clear();
    if (this.weather) this.weather.clear();
    if (this.skimmer) {
      this.skimmer.isMounted = false;
      this.skimmer.mountCooldown = 0.5;
    }
    if (this.player && this.player.mesh) this.player.mesh.visible = true;
    for (const pool of this.pathogenPools) {
      if (pool.mesh) this.renderer.scene.remove(pool.mesh);
    }
    this.pathogenPools = [];
    for (const d of this.holoDecoys) {
      if (d.mesh) this.renderer.scene.remove(d.mesh);
    }
    this.holoDecoys = [];
    if (this.player && this.player.clearNukeHoloMesh) {
      this.player.clearNukeHoloMesh();
    }

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
