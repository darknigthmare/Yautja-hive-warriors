/* PREDATOR: HIVE WARRIORS - Main Game Router (v12.0 Apex Transcendent Edition) */

import * as THREE from 'three';
import { EngineRenderer } from './engine/Renderer.js';
import { AudioEngine } from './engine/AudioEngine.js';
import { ParticleSystem } from './engine/ParticleSystem.js';
import { GoreEngine } from './engine/GoreEngine.js';
import { OrbitalStrikeManager } from './engine/OrbitalStrike.js';
import { StoryCampaignManager } from './engine/StoryCampaign.js';
import { CombatDirector } from './engine/CombatDirector.js';
import { BattlefieldMission } from './engine/BattlefieldMission.js';
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
import { LEVELS_DATA } from './data/levelsData.js';
import { disposeObject } from './engine/SceneResources.js';

class GameApp {
  constructor() {
    this.container = document.getElementById('canvas-container');
    this.renderer = new EngineRenderer(this.container);
    this.audio = new AudioEngine();
    this.particles = new ParticleSystem(this.renderer.scene);
    this.gore = new GoreEngine(this.renderer.scene);
    this.orbital = new OrbitalStrikeManager(this.renderer.scene, this.audio);
    this.weather = new WeatherSystem(this.renderer.scene);
    this.forge = new ForgeShop(this.audio);
    this.ui = new UIManager();
    this.campaign = new StoryCampaignManager(this.ui);
    this.photoMode = new PhotoMode(this.renderer, this.renderer.scene, this.renderer.camera);
    this.citadel = new YautjaCitadel(this.renderer.scene);
    this.codex = new LoreCodexManager();
    this.env = new EnvironmentManager(this.renderer.scene);
    this.horde = new XenomorphHorde(this.renderer.scene, this.audio, this.gore);
    this.horde.environment = this.env;
    this.bosses = new BossManager(this.renderer.scene, this.audio);
    this.allies = new YautjaAlliesManager(this.renderer.scene, this.audio);
    this.skimmer = new YautjaSkimmer(this.renderer.scene, this.audio);
    this.marines = new ColonialMarinesManager(this.renderer.scene, this.audio);
    this.synthetics = new SyntheticsManager(this.renderer.scene, this.audio, this.particles);
    this.badBlood = new BadBloodManager(this.renderer.scene, this.audio);
    this.combatDirector = new CombatDirector({ graceSeconds: 8 });
    for (const manager of [this.horde, this.bosses, this.marines, this.synthetics, this.badBlood]) {
      manager.combatDirector = this.combatDirector;
      manager.environment = this.env;
    }
    this.battlefield = null;
    this.battlefieldProgression = null;
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
      this.player?.selectWeapon?.(weaponId);
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
    this.missionMode = 'hunt';
    this.pendingChapter = null;
    this.bossSpawned = false;
    this.missionTasks = [];
    this.missionEffects = [];

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
    this.closestEnemyDist = Infinity;
    this.battlefieldMorale = 50.0; // 0 to 100% (50 = balanced tug-of-war)
    this.trueMusouActive = false;

    this.keys = {};
    this.setupEventListeners();
    this.lastTime = performance.now();
    this.animate();
  }

  setupEventListeners() {
    document.getElementById('btn-start-game').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'hunt';
      this.campaign.reset?.();
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      this.ui.showScreen(this.ui.charSelectMenu);
    });

    document.getElementById('btn-open-citadel').addEventListener('click', () => {
      this.audio.init();
      this.citadel.buildCitadelRoom(this.ui.trophyStats.skullsCollected);
      this.citadel.show();
      this.renderer.requestRender();
      this.ui.showAnnouncement('🏰 CITADELLE YAUTJA: STATION DE POLISSAGE DES TROPHÉES AU LASER');
    });

    document.getElementById('btn-open-story').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'campaign';
      this.isCoOp = false;
      this.renderer.setSplitScreen(false);
      this.citadel.hide();
      const firstChapter = this.campaign.startCampaign();
      this.selectChapterLevel(firstChapter);
      this.ui.showAnnouncement(firstChapter.title);
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-open-coop').addEventListener('click', () => {
      this.audio.init();
      this.missionMode = 'hunt';
      this.campaign.reset?.();
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
      this.missionMode = 'sandbox';
      this.campaign.reset?.();
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
      this.ui.showScreen(this.isPlaying ? document.getElementById('pause-menu') : this.ui.mainMenu);
    });

    document.getElementById('btn-replay').addEventListener('click', () => {
      if (this.pendingChapter) {
        this.selectChapterLevel(this.pendingChapter);
        this.pendingChapter = null;
      } else if (this.missionMode === 'campaign' && !this.campaign.isActive) {
        this.selectChapterLevel(this.campaign.startCampaign());
      }
      if (this.missionMode === 'sandbox') {
        this.ui.showScreen(document.getElementById('sandbox-modal'));
        return;
      }
      this.ui.showScreen(document.getElementById('loadout-prep-screen'));
    });

    document.getElementById('btn-menu-return').addEventListener('click', () => {
      this.returnToMenu();
    });

    document.getElementById('btn-pause-game')?.addEventListener('click', () => this.togglePause(true));
    document.getElementById('btn-resume-game')?.addEventListener('click', () => this.togglePause(false));
    document.getElementById('btn-pause-menu-return')?.addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-pause-options')?.addEventListener('click', () => this.ui.showScreen(this.ui.optionsModal));
    document.getElementById('btn-back-to-menu')?.addEventListener('click', () => this.returnToMenu());
    document.getElementById('btn-back-to-levels')?.addEventListener('click', () => {
      this.ui.showScreen(this.missionMode === 'campaign' ? this.ui.mainMenu : this.ui.levelSelectMenu);
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
      if (e.target instanceof HTMLElement && e.target.matches('input, select, textarea, [contenteditable="true"]')) return;
      if (e.code === 'Escape' && this.isPlaying) {
        e.preventDefault();
        if (this.photoMode.isActive) this.photoMode.toggle(this.player.position);
        else if (this.weaponWheel.isOpen) this.weaponWheel.close();
        else this.togglePause(!this.isPaused);
        return;
      }
      if (this.isPlaying && this.dropPod.isActive) {
        if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
        return;
      }
      this.keys[e.code] = true;

      if (!this.isPlaying || this.isPaused) return;
      if (['Space', 'Tab', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
      if (e.repeat) return;
      if (this.photoMode.isActive) {
        if (e.code === 'KeyO') this.photoMode.toggle(this.player.position);
        return;
      }
      if (this.weaponWheel.isOpen && e.code !== 'KeyR') return;
      if (this.isCoOp && this.player2 && ['Enter', 'Numpad0', 'NumpadDecimal'].includes(e.code)) {
        e.preventDefault();
        if (e.code === 'Enter' && this.battlefield?.interact(this.player2)) return;
        this.performCoopAttack(e.code);
        return;
      }
      if (this.player?.hp <= 0) return;
      if (this.skimmer.isMounted && ['Space', 'ShiftLeft', 'ShiftRight', 'KeyG'].includes(e.code)) return;

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

      // Segmented Spine Whip [Digit 1 or Shift + Left Click] (AVP: Requiem 2007)
      if ((e.code === 'Digit1' || e.code === 'Numpad1') && this.player) {
        this.performSpineWhip();
      }

      // Engineer Black Pathogen Mutagen Urn Bombardment [Digit 2] (Prometheus 2012)
      if ((e.code === 'Digit2' || e.code === 'Numpad2') && this.player) {
        this.triggerPathogenUrnStrike();
      }

      // Laser-Guided Flechette Volley [Digit 3] (Prey 2022 Feral Predator)
      if ((e.code === 'Digit3' || e.code === 'Numpad3') && this.player) {
        this.triggerLaserGuidedFlechettes();
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

      // Yautja Charged Compound Bow [Digit 7] (Concrete Jungle / Dark Horse)
      if ((e.code === 'Digit7' || e.code === 'Numpad7') && this.player) {
        this.fireCompoundBow();
      }

      // Holographic Decoy Gauntlet Pulse [Digit 8] (Hunting Grounds Canon)
      if ((e.code === 'Digit8' || e.code === 'Numpad8') && this.player) {
        this.deployHoloDecoy();
      }

      // Yautja Dual-Bladed Plasma Glaive Cyclone [Digit 9] (AVP Patriarch / Concrete Jungle)
      if ((e.code === 'Digit9' || e.code === 'Numpad9') && this.player) {
        if (this.player.triggerPlasmaGlaive(this.horde, this.synthetics, this.bosses)) {
          this.ui.showAnnouncement('⚡ TOURBILLON DE PLASMA GLAIVE ACTIVÉ : CYCLONE DÉFLECTEUR 360° !');
        } else {
          this.ui.showAnnouncement('⏳ PLASMA GLAIVE EN RECHARGE...');
        }
      }

      // Royal Jelly Berserker Rage Stimulant [Digit 0] (Aliens: Genocide / AvP 1999)
      if ((e.code === 'Digit0' || e.code === 'Numpad0') && this.player) {
        if (this.player.consumeRoyalJelly()) {
          this.ui.showAnnouncement('👑 GELÉE ROYALE CONSOMMÉE : FUREUR BERSERKER YAUTJA ACTIVÉE (+45% VIT, +100% DÉGÂTS) !');
          this.particles.emitGoldRageSparks(this.player.position, 25);
        } else if (this.player.isBerserkerActive) {
          this.ui.showAnnouncement('🔥 RAGE BERSERKER DÉJÀ ACTIVE !');
        } else {
          this.ui.showAnnouncement('❌ AUCUNE FLASQUE DE GELÉE ROYALE DISPONIBLE');
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
      if (e.code === 'KeyG' && this.player &&
          !this.skimmer.isMounted && this.skimmer.position.distanceTo(this.player.position) >= 4) {
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
        } else if (!this.battlefield?.interact(this.player)) {
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
        if (this.player.hasGadget?.('nuke')) this.triggerNukeCountdownSequence();
        else this.ui.showAnnouncement("Équipez l’autodestruction dans votre équipement avant la chasse.");
      }

      if (e.code === 'KeyB' && this.player) {
        const activeDisc = this.projectiles.find(p => p.isSmartDisc && p.life > 0.1);
        if (activeDisc) {
          this.triggerSmartDiscRicochet(activeDisc);
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
      if (!this.isPlaying || this.isPaused || this.dropPod.isActive || this.player?.hp <= 0 || this.photoMode.isActive || this.weaponWheel.isOpen) return;
      if (e.target instanceof HTMLElement && e.target.closest('button, input, select, a, .modal-card, .wheel-item')) return;
      if (e.button === 1) {
        e.preventDefault();
        this.weaponWheel.toggle();
      }
      if (e.button === 0) {
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.performSpineWhip();
        } else {
          this.performLightAttack();
        }
      }
      if (e.button === 2) {
        e.preventDefault();
        if (this.keys['ShiftLeft'] || this.keys['ShiftRight']) {
          this.performPowerGloveSlam();
        } else {
          this.performHeavyAttack();
        }
      }
    });

    window.addEventListener('contextmenu', e => {
      if (this.isPlaying && !this.isPaused) e.preventDefault();
    });
    window.addEventListener('blur', () => {
      this.keys = {};
      if (this.isPlaying && !this.photoMode.isActive) this.togglePause(true);
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.keys = {};
        if (this.isPlaying && !this.photoMode.isActive) this.togglePause(true);
      }
    });
  }

  selectChapterLevel(chapter) {
    const level = LEVELS_DATA.find(entry => entry.id === chapter?.levelId);
    if (level) this.ui.selectedLevel = level;
  }

  togglePause(paused = !this.isPaused) {
    if (!this.isPlaying) return;
    this.isPaused = paused;
    this.keys = {};
    this.weaponWheel.close();
    if (paused && this.photoMode.isActive) this.photoMode.toggle(this.player.position);
    this.ui.showScreen(paused ? document.getElementById('pause-menu') : this.ui.inGameHud);
    this.renderer.requestRender();
    this.lastTime = performance.now();
  }

  scheduleMissionTask(callback, delay) {
    this.missionTasks.push({ callback, remaining: delay });
  }

  updateMissionTasks(delta) {
    for (let i = this.missionTasks.length - 1; i >= 0; i--) {
      const task = this.missionTasks[i];
      task.remaining -= delta;
      if (task.remaining <= 0) {
        this.missionTasks.splice(i, 1);
        task.callback();
      }
    }
    for (let i = this.missionEffects.length - 1; i >= 0; i--) {
      const effect = this.missionEffects[i];
      effect.life -= delta;
      if (effect.life <= 0) {
        this.removeEffectMesh(effect.mesh);
        this.missionEffects.splice(i, 1);
      } else effect.update?.(delta, effect.life / effect.maxLife);
    }
  }

  removeEffectMesh(mesh) {
    if (!mesh) return;
    this.renderer.scene.remove(mesh);
    const geometries = new Set();
    const materials = new Set();
    mesh.traverse(child => {
      if (child.geometry) geometries.add(child.geometry);
      const entries = Array.isArray(child.material) ? child.material : [child.material];
      entries.filter(Boolean).forEach(material => materials.add(material));
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
  }

  removeHoloDecoy(decoy) {
    if (typeof decoy?.dispose === 'function') decoy.dispose();
    else if (decoy?.mesh) this.removeEffectMesh(decoy.mesh);
  }

  clearMissionState() {
    this.battlefield?.dispose();
    this.battlefield = null;
    this.battlefieldProgression = null;
    this.combatDirector.reset({ graceSeconds: 8 });
    this.ui.updateBattlefieldHUD?.(null);
    this.missionTasks = [];
    this.keys = {};
    this.weaponWheel.close();
    if (this.photoMode.isActive && this.player) this.photoMode.toggle(this.player.position);
    for (const projectile of this.projectiles) this.removeEffectMesh(projectile.mesh);
    this.projectiles = [];
    for (const pool of this.pathogenPools) {
      this.removeEffectMesh(pool.urnMesh);
      this.removeEffectMesh(pool.poolMesh);
    }
    this.pathogenPools = [];
    this.pathogenCooldown = 0;
    for (const decoy of this.holoDecoys) this.removeHoloDecoy(decoy);
    this.holoDecoys = [];
    for (const effect of this.missionEffects) this.removeEffectMesh(effect.mesh);
    this.missionEffects = [];
    this.nukeCountingDown = false;
    this.isFirstPerson = false;
    this.lockedTargetPos = null;
    this.motionTrackerTimer = 0;
    this.closestEnemyDist = Infinity;
    this.audio.stopBackgroundMusic();
    this.audio.stopThermalHum();
    this.allies.clearSquad();
    this.marines.clearSquad();
    this.synthetics.clearSquad();
    this.hellHounds.dismissPack();
    this.dropPod.clear();
    this.updateInsertionStatus();
    this._insertionCameraFocus = null;
    this.dropship.clear();
    this.clearAPCSupport();
    this.sentryGun.clear();
    this.falconDrone.clear();
    this.horde.clearWave();
    this.bosses.clear?.();
    this.badBlood.clear?.();
    this.weather.clear?.();
    this.particles.clear?.();
    this.orbital.clear?.();
    this.gore.clear();
    this.skimmer.isMounted = false;
    this.skimmer.mountCooldown = 0;
    this.skimmer.cannonCooldown = 0;
    this.skimmer.mesh.visible = false;
    this.skimmer.clear?.();
    for (const player of [this.player, this.player2]) {
      if (!player) continue;
      player.clearNukeHoloMesh?.();
      if (player.dispose) player.dispose();
      else this.renderer.scene.remove(player.mesh);
    }
    this.player = null;
    this.player2 = null;
    ['thermal-overlay', 'em-overlay', 'tech-overlay', 'uv-overlay', 'cloak-overlay',
      'first-person-mask-overlay', 'nuke-countdown-overlay', 'true-musou-banner',
      'acid-corrosion-overlay', 'berserker-rage-overlay', 'facehugger-qte-prompt',
      'hud-tri-target-lock', 'execution-prompt'].forEach(id => document.getElementById(id)?.classList.add('hidden'));
    this.renderer.requestRender?.();
  }

  returnToMenu() {
    if (this.isPlaying) {
      this.ui.recordEndSession(this.horde.deadCount, this.sessionSkulls, this.score);
    }
    this.isPlaying = false;
    this.isPaused = false;
    this.clearMissionState();
    this.pendingChapter = null;
    this.campaign.reset?.();
    this.missionMode = 'hunt';
    this.isCoOp = false;
    this.renderer.setSplitScreen(false);
    this.citadel.hide();
    this.ui.showScreen(this.ui.mainMenu);
  }

  performCoopAttack(code) {
    const player = this.player2;
    if (!player || player.hp <= 0) return;
    if (code === 'NumpadDecimal') {
      const shot = player.firePlasmaShot();
      if (!shot) return;
      const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.5, 10, 10), new THREE.MeshBasicMaterial({ color: 0xffb703 }));
      mesh.position.copy(shot.position);
      this.renderer.scene.add(mesh);
      this.projectiles.push({ mesh, direction: shot.direction, damage: shot.damage, speed: 45, life: 2.5 });
      return;
    }
    const attack = code === 'Enter' ? player.lightAttack() : player.heavyAttack();
    if (!attack) return;
    attack.origin = player.position;
    this.registerHits(this.horde.checkMeleeHits(attack));
    this.synthetics.checkHits(attack);
    if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(player.position) <= attack.radius + 2) {
      this.bosses.takeDamage(attack.damage);
    }
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

    for (let second = 1; second <= 6; second++) this.scheduleMissionTask(() => {
      timeLeft = 6 - second;
      if (timerText) timerText.innerText = timeLeft;

      // Authentic 1987 Billy's mimicry sardonic laugh right before detonation
      if (timeLeft === 2) {
        if (this.audio && this.audio.playBillyLaugh) {
          this.audio.playBillyLaugh();
        }
      }

      if (timeLeft <= 0) {
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
    }, second);
  }

  startMission(options = {}) {
    this.isPlaying = false;
    this.clearMissionState();
    this.isPlaying = true;
    this.isPaused = false;
    this.waveIndex = 1;
    this.score = 0;
    this.sessionSkulls = 0;
    this.comboHits = 0;
    this.comboTimer = 0;
    this.bossSpawned = false;
    this.horde.deadCount = 0;
    this.announcedMilestones = {};
    this.totalWaves = this.missionMode === 'sandbox' ? 1 : this.ui.selectedLevel.waves;

    this.citadel.hide();
    this.env.buildLevelEnvironment({ ...this.ui.selectedLevel, battlefield: this.missionMode !== 'sandbox' });
    this.renderer.updateLevelEnvironment(this.ui.selectedLevel);
    this.weather.setWeather(this.ui.selectedLevel.theme);
    this.gore.clear();

    if (this.player) this.renderer.scene.remove(this.player.mesh);
    if (this.player2) this.renderer.scene.remove(this.player2.mesh);

    this.player = new Player(this.renderer.scene, this.ui.selectedChar, this.audio, false, this.particles);
    this.player.applyLoadout?.(this.activeLoadout ?? {});
    this.forge.applyStatsToPlayer(this.player);
    this.player.setLaserColor?.(Number.parseInt(this.forge.upgrades.laserColor.slice(1), 16));

    if (this.isCoOp) {
      this.player2 = new Player(this.renderer.scene, CHARACTERS_DATA[1], this.audio, true, this.particles);
      this.player2.applyLoadout?.(this.activeLoadout ?? {});
    } else {
      this.player2 = null;
    }

    // Both players arrive inside their own closed capsule. Combat starts after
    // the complete opening and exit sequence, so insertion never spends grace.
    this.dropPod.triggerDrop(this.player.position, () => {
      this.keys = {};
      for (const player of [this.player, this.player2].filter(Boolean)) player.locomotion?.reset();
      this.combatDirector.reset({ graceSeconds: 7 });
      this.updateInsertionStatus();
      this.ui.showAnnouncement('INSERTION TERMINÉE — PRÉPAREZ VOTRE PREMIÈRE ATTAQUE. [CLIC] FRAPPER · [C] PARER');
    }, { players: [this.player, this.player2].filter(Boolean) });

    this.skimmer.spawnAt(this.player.position.clone().add(new THREE.Vector3(-9, 0, 8)));
    if (this.missionMode !== 'sandbox' && this.env.battlefieldLayout) {
      this.battlefield = new BattlefieldMission({ environment: this.env, horde: this.horde,
        bosses: this.bosses, level: this.ui.selectedLevel,
        onAnnouncement: message => this.ui.showAnnouncement(message),
        onSectorEntered: sector => this.enterBattlefieldSector(sector) });
      this.battlefieldProgression = this.battlefield.progression;
      this.totalWaves = this.env.battlefieldLayout.sectors.length;
      this.battlefield.update([this.player, this.player2].filter(Boolean));
    } else {
      const supportPosition = this.player.position.clone().add(new THREE.Vector3(0, 0, 12));
      this.allies.spawnSquad(supportPosition, 3);
      this.marines.spawnSquad(supportPosition, 4);
      this.synthetics.spawnSquad(supportPosition, 3);
      this.weather.spawnGasPipes(6);
      this.horde.spawnWave(options.enemyCount ?? 35, this.player.position);
    }
    this.renderer.camera.position.copy(this.player.position).add(new THREE.Vector3(0, 10, 16));
    this.renderer.cameraP2.position.copy(this.renderer.camera.position);
    this.updateInsertionPresentation(0, true);

    // Initialize Battlefield Morale to 50%
    this.battlefieldMorale = 50.0;
    this.shiftBattlefieldMorale(0);

    this.audio.startBackgroundMusic();
    this.ui.showScreen(this.ui.inGameHud);
    this.ui.showCombo(0);
    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score);
    this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));
    document.getElementById('hud-weapon-label').innerText = 'ARME: PRINCIPALE';
    const visionTag = document.getElementById('hud-vision-tag');
    if (visionTag) visionTag.innerText = 'VISION : NATURELLE';
    this.lastTime = performance.now();
    this.updateInsertionStatus();
  }

  clearAPCSupport() {
    if (this._apcNavigationCollider) {
      this.env.colliders = this.env.colliders.filter(collider => collider !== this._apcNavigationCollider);
      this._apcNavigationCollider = null;
    }
    this.apc.clear();
  }

  spawnAPCSupport(position) {
    this.clearAPCSupport();
    this.env.resolveMovement(position, this.apc.navigationRadius);
    this.apc.spawn(position);
    // The navigation system must see the same carrier that stops characters;
    // otherwise ground enemies repeatedly walk into its visible hull.
    this._apcNavigationCollider = this.apc.getNavigationCollider();
    this.env.colliders.push(this._apcNavigationCollider);
  }

  enterBattlefieldSector(sector) {
    this.waveIndex = sector.index + 1;
    const center = new THREE.Vector3(sector.center[0], 0, sector.center[1]);
    const arrivingPlayer = [this.player, this.player2].find(player => player?.hp > 0 && this.env.getSectorAt(player.position)?.id === sector.id);
    const supportPosition = arrivingPlayer ? arrivingPlayer.position.clone().lerp(center, 0.2) : center;
    this.combatDirector.reset({ graceSeconds: sector.index === 0 ? 8 : 2.5 });
    // The opening fight belongs to the player. Supporting factions join later
    // sectors instead of killing the first six enemies during insertion.
    this.allies.spawnSquad(supportPosition, sector.index === 0 ? 0 : 1);
    if (sector.index === 0) this.marines.clearSquad();
    else this.marines.spawnSquad(supportPosition, 2);
    this.synthetics.spawnSquad(center, sector.index === 0 ? 0 : 2);
    this.badBlood.clear();
    this.weather.spawnGasPipes(4, center);
    this.clearAPCSupport();
    if (sector.index === 3) {
      const vehiclePosition = supportPosition.clone().add(new THREE.Vector3(-8, 0, 6));
      this.spawnAPCSupport(vehiclePosition);
      this.scheduleMissionTask(() => {
        if (this.apc.mesh && this.env.activeSectorId === sector.id) this.ui.showAnnouncement('RENFORT USCM — APC M577 EN POSITION DE SOUTIEN');
      }, 1.5);
    }
    // Resolve the freshly spawned squad against the carrier as well, before
    // the first frame rather than leaving an ally inside its hull.
    for (const actor of [...this.allies.allies, ...this.marines.marines, ...this.synthetics.androids]) this.env.resolveMovement(actor.mesh.position, 1);
    // Keep the skimmer available as the battlefield advances without moving a
    // mounted vehicle out from under either player's controls.
    if (!this.skimmer.isMounted) this.skimmer.spawnAt(center.clone().add(new THREE.Vector3(sector.index === 0 ? -9 : 5, 0, sector.index === 0 ? 8 : 5)));
    if (sector.objective.type === 'boss') this.bossSpawned = true;
  }

  startSandboxMission(config) {
    this.audio.init();
    this.missionMode = 'sandbox';
    this.isCoOp = false;
    this.renderer.setSplitScreen(false);
    const enemyCount = Math.max(1, Math.min(150, Math.round(Number(config.enemyCount) || 60)));
    this.startMission({ enemyCount });
    this.bossSpawned = true;
    this.bosses.spawnBoss(config.bossType || 'xenomorph_queen', this.player.position.clone().add(new THREE.Vector3(0, 0, -30)));
    this.ui.showAnnouncement(`ARÈNE SANDBOX : ${enemyCount} ENNEMIS ET UN BOSS. ÉLIMINEZ TOUTES LES CIBLES.`);
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
    if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(this.player.position) <= attack.radius + 2) {
      this.bosses.takeDamage(attack.damage);
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
    if (!attack) return;

    attack.origin = this.player.position;
    const hits = this.horde.checkMeleeHits(attack);
    if (hits.length > 0) this.registerHits(hits);
    this.weather.checkExplosions(this.player.position, 6.0, this.horde, this.particles);
    this.synthetics.checkHits(attack);
    if (this.bosses.activeBoss && this.bosses.activeBoss.mesh.position.distanceTo(this.player.position) <= attack.radius + 2) {
      this.bosses.takeDamage(attack.damage);
    }

    // Dynasty Warriors Musou C1-C6 Charge Finisher Announcement
    if (this.player.currentChargeName) {
      this.ui.showAnnouncement(`⚡ FINISHER CHARGÉ : ${this.player.currentChargeName} !`);
      const tagElem = document.getElementById('combo-chain-indicator');
      if (tagElem) {
        tagElem.innerText = `FINISHER : ${this.player.currentChargeName}`;
        tagElem.style.color = '#ffb703';
      }
    }

    if (this.badBlood.isActive && this.badBlood.badBlood) {
      if (this.badBlood.badBlood.mesh.position.distanceTo(this.player.position) <= attack.radius) {
        if (this.badBlood.takeDamage(attack.damage)) {
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
      pierceRemaining: 6,
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
      this.scheduleMissionTask(() => {
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
      }, u * 0.4);
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
    if (!this.player || this.player.hp <= 0) return;
    const decoy = this.player.deployHoloDecoy(this.renderer.scene);
    if (!decoy) return;

    this.holoDecoys.push(decoy);
    this.ui.showAnnouncement('⚡ LEURRE HOLOGRAPHIQUE ACTIVÉ : ATTENTION DE LA RUCHE DÉTOURNÉE !');
  }

  executeMusouOverload() {
    this.ui.showAnnouncement('⚡ VRAIE ATTAQUE MUSOU : DÉVASTATION DU CLAN APEX !');
    this.audio.playOmniPlasmaStorm();

    // Show True Musou Calligraphy Banner
    const banner = document.getElementById('true-musou-banner');
    if (banner) {
      banner.classList.remove('hidden');
      this.scheduleMissionTask(() => banner.classList.add('hidden'), 2.2);
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
    this.missionEffects.push({ mesh: stormGroup, life: 0.75, maxLife: 0.75,
      update: (delta, remaining) => {
        stormGroup.rotation.y += 9 * delta;
        stormGroup.scale.multiplyScalar(Math.exp(0.8 * delta));
        beamMat.opacity = 0.95 * remaining;
      }
    });

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

  checkTrophyExecution() {
    // 1. Boss Execution (Queen, The Offspring, Predalien)
    if (this.bosses.activeBoss && this.bosses.activeBoss.isStunned &&
        this.bosses.activeBoss.mesh.position.distanceTo(this.player.position) <= 8.5) {
      this.player.executeSpineRip(this.bosses.activeBoss.type || 'queen');

      const bType = this.bosses.activeBoss.type || 'queen';
      let tName = 'Couronne Chitinense & Colonne Vertébrale de Reine Matriarche (Aliens 1986 / AvP 2004)';
      let tHonor = 2500;
      if (bType === 'the_offspring') {
        tName = 'Mandibule Hybride & Vertèbres Z-01 de The Offspring (Romulus 2024)';
        tHonor = 3500;
      } else if (bType === 'predalien_queen') {
        tName = 'Mandibules Quadruples & Crâne Hybride de Reine Prédalienne (AVP-R 2007)';
        tHonor = 3000;
      } else if (bType === 'empress_matriarch') {
        tName = 'Ailes Vestigiales & Épine Royale d\'Impératrice de Ruche (Dark Horse Comics)';
        tHonor = 4000;
      }

      this.player.recordTrophy(tName, tHonor);
      this.player.royalJellyFlasks += 2; // Queen grants 2 Royal Jelly flasks!
      this.sessionSkulls++;
      this.score += tHonor;
      this.player.hp = Math.min(this.player.maxHp, this.player.hp + 500);

      // Decisive Battlefield Morale Victory (+35%)
      this.shiftBattlefieldMorale(35.0);

      // Record an actual death before removing the encounter. Clearing a
      // living boss alone cannot satisfy the battlefield's final objective.
      this.bosses.takeDamage(this.bosses.activeBoss.hp);

      this.ui.showAnnouncement(`🏆 TROPHÉE LÉGENDAIRE RÉCOLTÉ : ${tName} (+${tHonor} HONNEUR, +2 GELÉES ROYALES) !`);
      this.ui.showExecutionPrompt(false);
      return;
    }

    // 2. Sub-Boss Execution (Crusher Titan or Praetorian Royal Guard)
    for (let i = this.horde.aliens.length - 1; i >= 0; i--) {
      const a = this.horde.aliens[i];
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien') && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.5) {
          this.player.executeSpineRip(a.type);
          this.sessionSkulls++;

          let tName = a.type === 'crusher'
            ? 'Bouclier Frontal Blindé de Crusher Titan'
            : (a.type === 'grid_alien'
              ? 'Crâne Gravé au Quadrillage Acide de Grid Alien (AVP 2004)'
              : 'Couronne Royale Éburnéenne de Prétorien');
          let tHonor = a.type === 'crusher' ? 1200 : (a.type === 'grid_alien' ? 1400 : 900);
          this.player.recordTrophy(tName, tHonor);

          if (a.type === 'praetorian') {
            this.player.royalJellyFlasks += 1; // Praetorian drops 1 Royal Jelly flask!
          } else if (a.type === 'grid_alien') {
            this.player.royalJellyFlasks += 1;
          }

          this.score += tHonor;
          this.player.hp = Math.min(this.player.maxHp, this.player.hp + 300);

          // Sub-Boss Execution Morale Swing (+18%)
          this.shiftBattlefieldMorale(18.0);

          if (this.gore) {
            this.gore.spawnDismemberment(a.mesh.position, 'spine_rip');
          }
          this.horde.spawnAcidPool(a.mesh.position);
          this.horde.recordDefeat(a);
          disposeObject(a.mesh, this.horde.sharedResources);
          this.horde.aliens.splice(i, 1);

          this.ui.showAnnouncement(`🏆 TROPHÉE DE CHASSE : ${tName} (+${tHonor} HONNEUR, MORAL +18%) !`);
          this.ui.showExecutionPrompt(false);
          return;
        }
      }
    }
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
    }
  }

  registerHits(hits) {
    hits.forEach(h => {
      this.comboHits++;
      this.comboTimer = 2.5;
      this.score += h.killed ? 150 : 25;
      this.player.musouEnergy = Math.min(this.player.maxMusouEnergy, this.player.musouEnergy + (h.killed ? 6 : 2));

      // Shift Morale: Kills favor Yautja Clan
      if (h.killed) {
        if (h.isOfficer) {
          // Defeating an officer swings battlefield morale dramatically!
          this.shiftBattlefieldMorale(12.0);
          if (this.audio && this.audio.playOfficerDefeatedGong) {
            this.audio.playOfficerDefeatedGong();
          }
          this.ui.showAnnouncement(`⚔️ OFFICIER VAINCU : ${h.officerTitle || 'GARDE DE NŒUD KAINDE AMEDHA'} PURGÉ ! ÉQUILIBRE DU CLAN +12% !`);
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

  updateInsertionStatus() {
    const panel = document.getElementById('insertion-status');
    if (!panel) return;
    const active = Boolean(this.dropPod.isActive);
    panel.classList.toggle('hidden', !active);
    document.getElementById('in-game-hud')?.classList.toggle('insertion-active', active);
    if (!active) {
      this._insertionPhase = null;
      return;
    }
    const phases = {
      descending: ['INSERTION ORBITALE', 'Capsule en approche'],
      settling: ['CONTACT AU SOL', 'Stabilisation de la capsule'],
      opening: ['OUVERTURE DE LA CAPSULE', 'Déverrouillage des portes'],
      exiting: ['DÉPLOIEMENT DU CHASSEUR', 'Sortie de la capsule'],
    };
    if (this._insertionPhase !== this.dropPod.phase) {
      this._insertionPhase = this.dropPod.phase;
      const [title, detail] = phases[this.dropPod.phase] ?? phases.descending;
      document.getElementById('insertion-title').textContent = title;
      document.getElementById('insertion-detail').textContent = `${detail} · Commandes après la sortie`;
    }
    document.getElementById('insertion-progress').style.transform = `scaleX(${Math.max(0, Math.min(1, this.dropPod.progress ?? 0))})`;
  }

  updateInsertionPresentation(delta, snap = false) {
    if (!this.dropPod.isActive) return;
    const cameras = [this.renderer.camera, this.renderer.cameraP2];
    this._insertionCameraFocus ??= [];
    const alpha = snap ? 1 : 1 - Math.exp(-8 * delta);
    for (let index = 0; index < (this.player2 ? 2 : 1); index++) {
      const target = this.dropPod.getCameraTarget?.(index) ?? (index ? this.player2 : this.player).position;
      const focus = this._insertionCameraFocus[index] ??= target.clone();
      focus.lerp(target, alpha);
      const position = focus.clone().add(new THREE.Vector3(8, 5, 14));
      cameras[index].position.lerp(position, alpha);
      cameras[index].lookAt(focus);
    }
    this.updateInsertionStatus();
  }

  update(delta) {
    if (!this.isPlaying || !this.player || this.isPaused) return;

    if (this.photoMode.isActive || this.weaponWheel.isOpen) return;

    if (this.dropPod.isActive) {
      this.weather.update?.(delta);
      this.dropPod.update(delta);
      this.updateInsertionPresentation(delta);
      this.env.updateBattlefieldVisibility?.([this.player, this.player2].filter(Boolean));
      this.particles.update(delta, this.renderer.camera);
      this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score);
      this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));
      return;
    }

    this.updateMissionTasks(delta);
    this.weather.update?.(delta);
    this.dropPod.update?.(delta);
    this.combatDirector.update(delta, [this.player, this.player2].filter(player => player?.hp > 0));

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
    if (!this.skimmer.isMounted && this.player.hp > 0) this.player.move(moveDirP1, delta);
    this.env.resolveMovement?.(this.player.position);
    this.dropPod.resolveMovement?.(this.player.position);
    this.apc.resolveMovement?.(this.player.position);
    this.player.mesh.position.copy(this.player.position);
    if (this.player.hp > 0) this.player.update(delta, this.horde);
    else this.player.updateDefeatedEffects(delta);
    this.weather.setFocus?.(this.player.hp > 0 ? this.player.position : (this.player2?.position ?? this.player.position));

    if (this.isCoOp && this.player2) {
      const moveDirP2 = new THREE.Vector3();
      if (this.keys['ArrowUp']) moveDirP2.z -= 1;
      if (this.keys['ArrowDown']) moveDirP2.z += 1;
      if (this.keys['ArrowLeft']) moveDirP2.x -= 1;
      if (this.keys['ArrowRight']) moveDirP2.x += 1;
      if (this.player2.hp > 0) this.player2.move(moveDirP2, delta);
      this.env.resolveMovement?.(this.player2.position);
      this.dropPod.resolveMovement?.(this.player2.position);
      this.apc.resolveMovement?.(this.player2.position);
      this.player2.mesh.position.copy(this.player2.position);
      if (this.player2.hp > 0) this.player2.update(delta, this.horde);
      else this.player2.updateDefeatedEffects(delta);

      const cam2Target = this.player2.position.clone().add(new THREE.Vector3(0, 10, 16));
      this.renderer.cameraP2.position.lerp(cam2Target, 5 * delta);
      this.renderer.cameraP2.lookAt(this.player2.position.clone().add(new THREE.Vector3(0, 2, 0)));
    }
    this.env.updateBattlefieldVisibility?.([this.player, this.player2].filter(player => player?.hp > 0));

    const livingTarget = this.player.hp > 0 ? this.player : (this.player2 ?? this.player);
    this.hellHounds.update(delta, livingTarget, this.horde);
    this.synthetics.update(delta, livingTarget, this.horde);
    this.dropship.update(delta, this.horde);
    this.apc.update(delta, this.horde);
    this.sentryGun.update(delta, this.horde);
    this.falconDrone.update(delta, this.player.position, this.horde);
    this.skimmer.update(delta, this.player, this.horde, this.keys);
    if (this.skimmer.isMounted) {
      this.env.resolveMovement?.(this.skimmer.position, 1.2);
      this.dropPod.resolveMovement?.(this.skimmer.position, 2);
      this.apc.resolveMovement?.(this.skimmer.position, 2);
      this.skimmer.mesh.position.copy(this.skimmer.position);
      this.player.position.copy(this.skimmer.position);
    }
    this.env.resolveMovement?.(this.player.position);
    this.dropPod.resolveMovement?.(this.player.position);
    this.apc.resolveMovement?.(this.player.position);
    this.player.mesh.position.copy(this.player.position);
    this.orbital.update(delta);

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
        this.removeEffectMesh(p.urnMesh);
        this.removeEffectMesh(p.poolMesh);
        this.pathogenPools.splice(i, 1);
      }
    }

    // Update Holographic Decoys (Hunting Grounds Canon)
    for (let i = this.holoDecoys.length - 1; i >= 0; i--) {
      const d = this.holoDecoys[i];
      d.life -= delta;
      d.mesh.position.addScaledVector(d.direction, d.speed * delta);
      d.update?.(delta);

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
        this.removeHoloDecoy(d);
        this.holoDecoys.splice(i, 1);
      }
    }

    // Camera positioning: First-Person Bio-Mask vs 3rd Person
    if (this.isFirstPerson) {
      const eyeHeight = this.player.cameraEyeHeight ?? this.player.headMesh?.position.y ?? 3.6;
      const eyePos = this.player.position.clone().add(new THREE.Vector3(0, eyeHeight, 0.2));
      this.renderer.camera.position.lerp(eyePos, 1 - Math.exp(-15 * delta));
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
          this.removeEffectMesh(p.mesh);
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
          this.removeEffectMesh(p.mesh);
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
          this.removeEffectMesh(p.mesh);
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

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 1.8, damage: p.damage });
        if (hits.length > 0 || p.life <= 0) {
          if (hits.length > 0) {
            this.audio.playFlechetteImpale();
            this.particles.emitSparks(p.mesh.position, 8);
            this.registerHits(hits);
          }
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else if (p.isChargedArrow) {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (hits.length > 0) {
          this.audio.playArrowPinImpact();
          this.particles.emitSparks(p.mesh.position, 10);
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
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
        }
      } else {
        p.mesh.position.addScaledVector(p.direction, p.speed * delta);

        const hits = this.horde.checkMeleeHits({ origin: p.mesh.position, radius: 2.2, damage: p.damage });
        if (hits.length > 0 || p.life <= 0) {
          this.particles.emitSparks(p.mesh.position, 10);
          this.particles.spawnPlasmaScorch(p.mesh.position);
          this.removeEffectMesh(p.mesh);
          this.projectiles.splice(i, 1);
          if (hits.length > 0) this.registerHits(hits);
        }
      }
    }

    this.badBlood.update(delta, livingTarget);
    this.marines.update(delta, livingTarget, this.horde);
    this.allies.update(delta, livingTarget.position, this.horde);
    this.horde.update(delta, this.player, this.player2);
    this.bosses.update(delta, livingTarget, this.horde);
    for (const actor of [...this.horde.aliens, ...this.synthetics.androids, ...this.marines.marines, ...this.allies.allies, ...this.hellHounds.hounds, this.badBlood.badBlood, this.bosses.activeBoss].filter(Boolean)) {
      if (actor.mesh) {
        this.env.resolveMovement(actor.mesh.position, actor.radius ?? 1);
        this.dropPod.resolveMovement?.(actor.mesh.position, actor.radius ?? 1);
        this.apc.resolveMovement?.(actor.mesh.position, actor.radius ?? 1);
      }
    }
    this.battlefield?.update([this.player, this.player2].filter(Boolean));
    this.env.updateBattlefieldObjectives?.(this.battlefieldProgression, delta);
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
      if ((a.type === 'crusher' || a.type === 'praetorian' || a.type === 'grid_alien') && a.isStunned) {
        if (a.mesh.position.distanceTo(this.player.position) <= 5.5) {
          subBossStunnedNearby = true;
        }
      }
    });
    this.ui.showExecutionPrompt((boss && boss.isStunned && boss.mesh.position.distanceTo(this.player.position) <= 8.5) || subBossStunnedNearby);

    if (this.player.hp <= 0 && (!this.isCoOp || !this.player2 || this.player2.hp <= 0)) {
      this.endGame(false);
      return;
    }

    if (this.battlefield?.complete) {
      this.endGame(true);
      return;
    }
    if (!this.battlefield && this.horde.remainingCount === 0 && !this.bosses.activeBoss) {
      if (this.bossSpawned) {
        this.endGame(true);
        return;
      }
      if (this.waveIndex < this.totalWaves) {
        this.waveIndex++;
        this.horde.spawnWave(30 + this.waveIndex * 10, this.player.position);
        this.ui.showAnnouncement(`VAGUE ${this.waveIndex} APPROCHE ! FORCES DE LA RUCHE DÉPLOYÉES !`);

        // Cheyenne Dropship Airstrike Support on Wave 2 & 4!
        if (this.waveIndex === 2 || this.waveIndex === 4) {
          this.dropship.triggerAirstrike(this.player.position, this.horde);
          this.ui.showAnnouncement('✈️ DROPSHIP CHEYENNE UD-4L DÉPLOYÉ : SALVE DE ROQUETTES 70MM !');
          if (this.waveIndex === 2) {
            this.scheduleMissionTask(() => {
              this.sentryGun.deploySentry(this.player.position.clone().add(new THREE.Vector3(3.5, 0, 2)));
              this.ui.showAnnouncement('📦 LARGAGE TACTIQUE : TOURELLE SENTINELLE UA 571-C DÉPLOYÉE EN APPUI !');
            }, 2.5);
          }
        }

        if (this.waveIndex === 3) {
          this.badBlood.spawnAmbush(this.player.position);
          this.ui.showAnnouncement('⚠️ ALERTE : EMBUSCADE D\'UN YAUTJA RENÉGAT "BAD BLOOD" !');
          this.spawnAPCSupport(this.player.position.clone().add(new THREE.Vector3(-18, 0, -10)));
          this.scheduleMissionTask(() => {
            this.ui.showAnnouncement('🛡️ RENFORT BLINDÉ : BLINDÉ USCM M577 APC EN POSITION DE TIR !');
          }, 1.8);
        }
      } else if (!this.bosses.activeBoss) {
        const bType = this.ui.selectedLevel.bossType;
        this.bossSpawned = true;
        this.bosses.spawnBoss(bType, this.player.position.clone().add(new THREE.Vector3(0, 0, -25)));
        
        let bossTitle = 'REINE MATRIARCHE KAINDE AMEDHA (ALIENS 1986)';
        if (bType === 'the_offspring') bossTitle = 'HYBRIDE GÉNOTYPIQUE THE OFFSPRING (ROMULUS 2024)';
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

    // Dynamic Tug-of-War Morale update (Alien pressure slowly regains ground if Yautja is idle)
    if (this.battlefieldMorale > 25.0) {
      this.shiftBattlefieldMorale(-0.15 * delta);
    }

    this.ui.updateHUD(this.player, this.horde, this.bosses, this.waveIndex, this.totalWaves, this.score);
    this.ui.updateBattlefieldHUD(this.battlefieldProgression, this.env.battlefieldLayout, this.player, this.combatDirector, [this.player, this.player2].filter(Boolean));

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
        this.audio.playRomulusSmartAimPing();
        this.lockedTargetPos = bestTarget.pos.clone();
      }

      // Project 3D target coordinates to 2D screen coordinates
      const screenCoord = bestTarget.pos.clone().project(this.renderer.camera);
      // Check if target is in front of camera
      if (screenCoord.z > -1 && screenCoord.z < 1 && Math.abs(screenCoord.x) <= 1 && Math.abs(screenCoord.y) <= 1) {
        const viewWidth = this.renderer.isSplitScreen ? Math.floor(this.renderer.width / 2) : this.renderer.width;
        const screenX = (screenCoord.x * 0.5 + 0.5) * viewWidth;
        const screenY = (-(screenCoord.y * 0.5) + 0.5) * this.renderer.height;

        reticleEl.style.left = `${screenX}px`;
        reticleEl.style.top = `${screenY}px`;
        infoEl.innerText = `TRI-LOCK: ${bestTarget.dist.toFixed(1)}m - ${bestTarget.name} // WEY-YU F44AA [98.4%]`;
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
    if (!this.isPlaying) return;
    this.isPlaying = false;
    this.isPaused = false;
    this.ui.recordEndSession(this.horde.deadCount, this.sessionSkulls, this.score);

    let title = isVictory ? 'VICTOIRE GLORIEUSE !' : 'CHASSE TERMINÉE';
    let subtitle = isVictory
      ? "La ruche a été anéantie. Votre clan honore cette victoire."
      : "Votre Yautja est tombé au combat. Préparez une nouvelle chasse.";
    let replayLabel = 'REJOUER LA MISSION';
    if (isVictory && this.missionMode === 'campaign') {
      const progress = this.campaign.completeChapter();
      if (progress.nextChapter) {
        this.pendingChapter = progress.nextChapter;
        title = 'CHAPITRE ACCOMPLI';
        subtitle = `Prochaine destination : ${progress.nextChapter.title}`;
        replayLabel = 'CHAPITRE SUIVANT';
      } else {
        title = 'CAMPAGNE ACCOMPLIE !';
        subtitle = 'Les cinq chasses du clan sont terminées. Votre légende est gravée dans la pierre.';
        replayLabel = 'RECOMMENCER LA CAMPAGNE';
      }
    }
    this.clearMissionState();
    document.getElementById('end-title').innerText = title;
    document.getElementById('end-subtitle').innerText = subtitle;
    document.getElementById('btn-replay').innerText = replayLabel;
    this.ui.showScreen(this.ui.gameOverScreen);
  }

  animate() {
    requestAnimationFrame(() => this.animate());

    const now = performance.now();
    const delta = Math.min((now - this.lastTime) / 1000, 0.1);
    this.lastTime = now;

    this.update(delta);
    // Frozen scenes need no repeated GPU work. Resize, quality and photo-camera
    // changes invalidate a frame; active combat keeps rendering every frame.
    const sceneIsMoving = this.isPlaying && !this.isPaused && !this.photoMode.isActive && !this.weaponWheel.isOpen;
    if (sceneIsMoving || this.renderer.needsRender) this.renderer.render();
  }
}

window.addEventListener('DOMContentLoaded', () => {
  try {
    window.game = new GameApp();
  } catch (error) {
    console.error('Impossible de démarrer le jeu', error);
    const notice = document.createElement('section');
    notice.className = 'startup-error glass-panel';
    notice.setAttribute('role', 'alert');
    Object.assign(notice.style, {
      position: 'fixed', inset: '20% 10% auto', padding: '2rem', zIndex: '10000',
      background: '#0b1421', color: '#f1f5f9', border: '1px solid #ffb703', textAlign: 'center'
    });
    const title = document.createElement('h1');
    title.textContent = 'Le jeu ne peut pas démarrer';
    const detail = document.createElement('p');
    detail.textContent = "Vérifiez que WebGL et l’accélération graphique sont activés dans votre navigateur, puis rechargez la page.";
    const retry = document.createElement('button');
    retry.className = 'btn-primary';
    retry.textContent = 'Réessayer';
    retry.addEventListener('click', () => location.reload());
    notice.append(title, detail, retry);
    document.body.append(notice);
    retry.focus();
  }
});
