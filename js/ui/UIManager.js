/* User Interface Manager & Minimap Renderer */

import confetti from 'canvas-confetti';
import { AccessibilityPreferences, drawAccessibleMarker } from './AccessibilityPreferences.js';
import { readStored, readStoredNumber, writeStored } from './storage.js';
import * as THREE from 'three';
import { CHARACTERS_DATA } from '../data/charactersData.js';
import { LEVELS_DATA } from '../data/levelsData.js';
import { hiveCoordinationFeedback } from './OperationPanel.js';

const bossDisplayNames = {
  xenomorph_queen:'REINE XÉNOMORPHE',queen:'REINE XÉNOMORPHE',praetorian:'PRÉTORIEN',predalien:'PRÉDALIEN',predalien_queen:'PRÉDALIEN — RENCONTRE ADAPTÉE',imperial_queen:'REINE IMPÉRIALE',empress_matriarch:'IMPÉRATRICE DE LA RUCHE',the_offspring:'THE OFFSPRING',predalien_abomination:'ABOMINATION PRÉDALIENNE',predalien_matriarch_titan:'MATRIARCHE TITAN — CRÉATION ORIGINALE',rogue_king_prime:'ROGUE KING',awakened_engineer:'INGÉNIEUR ÉVEILLÉ',trilobite_prime:'TRILOBITE PRIME',berserker_super_predator:'BERSERKER / MR. BLACK',ultimate_upgrade_predator:'UPGRADE PREDATOR',feral_predator_boss:'FERAL PREDATOR',jungle_hunter_boss:'JUNGLE HUNTER',city_hunter_boss:'CITY HUNTER'
};
export const bossHUDLabel = boss => boss?.profileName ?? bossDisplayNames[boss?.type] ?? 'ADVERSAIRE';

const cardinalDirections = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];

// Keep the objective copy and map projection deterministic for UI checks and
// for callers that do not own a DOM (the progression state is read-only here).
export function battlefieldHUDState(progression, layout, player, combatDirector, players = []) {
  if (!progression || !layout?.sectors?.length || !player?.position) return null;
  const sector = progression.currentSector;
  if (!sector) return null;
  const progress = progression.progress;
  const completed = new Set(progression.completedSectorIds);
  const unlocked = new Set(progression.unlockedSectorIds);
  const target = progression.objectivePosition;
  const dx = (target?.x ?? player.position.x) - player.position.x;
  const dz = (target?.z ?? player.position.z) - player.position.z;
  const distance = Math.hypot(dx, dz);
  const direction = cardinalDirections[(Math.round(Math.atan2(dx, -dz) / (Math.PI / 4)) + 8) % 8];
  const primaryCanInteract = Boolean(progression.canInteract?.(player));
  const secondaryCanInteract = players.some(other => other && other !== player && progression.canInteract?.(other));
  const interactionText = primaryCanInteract && secondaryCanInteract ? '[ E / Entrée ] Activer le relais'
    : secondaryCanInteract ? '[ Entrée ] Joueur 2 · Activer le relais' : '[ E ] Activer le relais';
  return {
    sectorId: sector.id,
    sectorName: sector.name,
    sectorCount: `${progress.index + 1} / ${progress.total}`,
    objectiveText: progression.objectiveText,
    navigationText: progression.complete ? 'Toutes les zones sont sécurisées.'
      : `${direction} · ${Math.round(distance)} m${progress.completed ? ' · Passage ouvert' : ' · Objectif'}`,
    canInteract: primaryCanInteract || secondaryCanInteract,
    interactionText,
    relayPhase: sector.objective.type === 'interact' ? (progression.currentState?.relayPhase ?? 'awaiting-activation') : null,
    inGrace: Boolean(combatDirector?.isInGrace),
    steps: layout.sectors.map((item, index) => ({ id: item.id, name: item.name, number: index + 1,
      state: completed.has(item.id) ? 'complete' : item.id === sector.id ? 'active' : unlocked.has(item.id) ? 'unlocked' : 'locked' }))
  };
}

export class UIManager {
  constructor() {
    // Screens
    this.mainMenu = document.getElementById('main-menu');
    this.charSelectMenu = document.getElementById('char-select-menu');
    this.levelSelectMenu = document.getElementById('level-select-menu');
    this.inGameHud = document.getElementById('in-game-hud');
    this.trophyModal = document.getElementById('trophy-modal');
    this.optionsModal = document.getElementById('options-modal');
    this.gameOverScreen = document.getElementById('game-over-screen');

    // Overlays
    this.thermalOverlay = document.getElementById('thermal-overlay');
    this.cloakOverlay = document.getElementById('cloak-overlay');
    this.screenFlash = document.getElementById('screen-flash');

    // HUD Elements
    this.hudPlayerName = document.getElementById('hud-player-name');
    this.hudHpFill = document.getElementById('hud-hp-fill');
    this.hudHpText = document.getElementById('hud-hp-text');
    this.hudPlasmaFill = document.getElementById('hud-plasma-fill');
    this.hudPlasmaText = document.getElementById('hud-plasma-text');
    this.hudMusouFill = document.getElementById('hud-musou-fill');
    this.hudMusouText = document.getElementById('hud-musou-text');
    this.hudKoCount = document.getElementById('hud-ko-count');
    this.hudHonorScore = document.getElementById('hud-honor-score');
    this.hudLevelName = document.getElementById('hud-level-name');
    this.hudWaveCounter = document.getElementById('hud-wave-counter');
    this.battlefieldObjective = document.getElementById('battlefield-objective');
    this.battlefieldSectorName = document.getElementById('battlefield-sector-name');
    this.battlefieldSectorCount = document.getElementById('battlefield-sector-count');
    this.battlefieldSectorProgress = document.getElementById('battlefield-sector-progress');
    this.battlefieldObjectiveText = document.getElementById('battlefield-objective-text');
    this.battlefieldNavigation = document.getElementById('battlefield-navigation');
    this.battlefieldInteraction = document.getElementById('battlefield-interaction');
    this.battlefieldGrace = document.getElementById('battlefield-grace');
    this._battlefieldHUD = null;

    // Prompts
    this.comboDisplay = document.getElementById('combo-display');
    this.comboCount = document.getElementById('combo-count');
    this.executionPrompt = document.getElementById('execution-prompt');
    this.announcementBanner = document.getElementById('ability-announcement');
    this.announcementQueue = [];
    this.isShowingAnnouncement = false;
    this.announcementTimeout = null;

    // Minimap
    this.minimapCanvas = document.getElementById('minimap-canvas');
    this.minimapCtx = this.minimapCanvas ? this.minimapCanvas.getContext('2d') : null;

    // Selections
    this.selectedChar = CHARACTERS_DATA[0];
    this.selectedLevel = LEVELS_DATA[0];

    // Trophy Data Persistent Storage
    this.trophyStats = {
      totalKos: Math.floor(readStoredNumber('yautja_total_kos')),
      skullsCollected: Math.floor(readStoredNumber('yautja_skulls')),
      highestCombo: Math.floor(readStoredNumber('yautja_max_combo'))
    };

    this.initCharacterSelect();
    this.initLevelSelect();
    this.setupAccessibility();
    this.setupSettings();
  }

  showScreen(screenElement) {
    document.querySelectorAll('.ui-screen').forEach(screen => {
      const hidden = screen !== screenElement;
      screen.classList.toggle('hidden', hidden);
      screen.setAttribute('aria-hidden', String(hidden));
    });
    if (!screenElement) return;
    screenElement.scrollTop = 0;
    document.dispatchEvent(new CustomEvent('ui-screen-change', { detail: { screen: screenElement.id } }));
    // Never steal keyboard focus from the game canvas during combat.
    if (!['in-game-hud', 'photo-mode-hud'].includes(screenElement.id)) {
      requestAnimationFrame(() => screenElement.querySelector('button:not(:disabled), input')?.focus({ preventScroll: true }));
    } else if (document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
  }

  setupAccessibility() {
    document.querySelectorAll('.ui-screen').forEach(screen => {
      screen.setAttribute('aria-hidden', String(screen.classList.contains('hidden')));
      const heading = screen.querySelector('h1, h2');
      if (heading && !heading.id) heading.id = `${screen.id}-title`;
      if (heading) screen.setAttribute('aria-labelledby', heading.id);
    });
    document.querySelectorAll('.modal-card').forEach(card => {
      if (card.parentElement.getAttribute('role') !== 'dialog') card.setAttribute('role', 'dialog');
      const heading = card.querySelector('h1, h2');
      if (heading) card.setAttribute('aria-labelledby', heading.id || `${card.parentElement.id}-title`);
    });
    window.addEventListener('keydown', event => {
      const visible = document.querySelector('.ui-screen:not(.hidden)');
      if (event.key === 'Escape' && !window.game?.isPlaying && visible && visible !== this.mainMenu) {
        event.preventDefault();
        this.showScreen(visible.id === 'loadout-prep-screen' ? this.levelSelectMenu : this.mainMenu);
      }
      if (event.key === 'Tab' && visible?.querySelector('.modal-card')) {
        const controls = [...visible.querySelectorAll('button:not(:disabled), input, select, [tabindex="0"]')].filter(e => e.getClientRects().length);
        if (!controls.length) return;
        const target = event.shiftKey && document.activeElement === controls[0] ? controls.at(-1)
          : !event.shiftKey && document.activeElement === controls.at(-1) ? controls[0] : null;
        if (target) { event.preventDefault(); target.focus(); }
      }
    });
  }

  setupSettings() {
    this.presentationPreferences=new AccessibilityPreferences({document});
    const prefControls={palette:document.getElementById('setting-map-palette'),symbols:document.getElementById('setting-marker-symbols'),reducedFlashes:document.getElementById('setting-reduced-flashes')};
    for(const[key,control]of Object.entries(prefControls))if(control){if(key==='palette')control.value=this.presentationPreferences.get()[key];else control.checked=this.presentationPreferences.get()[key];control.addEventListener('change',()=>this.presentationPreferences.set({[key]:key==='palette'?control.value:control.checked}));}

    const graphics = document.getElementById('setting-graphics-quality');
    const graphicsStatus = document.getElementById('graphics-quality-status');
    if (graphics) {
      const saved = readStored('yautja_graphics_quality', 'balanced');
      graphics.value = ['low', 'balanced', 'high'].includes(saved) ? saved : 'balanced';
      const updateStatus = () => {
        const info = window.game?.renderer.getQualityInfo?.();
        if (graphicsStatus) graphicsStatus.textContent = info && info.effective !== info.requested
          ? 'Les effets ont été adaptés pour garder une image fluide.' : '';
      };
      graphics.addEventListener('change', () => {
        writeStored('yautja_graphics_quality', graphics.value);
        window.game?.renderer.setQuality?.(graphics.value);
        updateStatus();
      });
      document.addEventListener('graphics-quality-change', updateStatus);
      document.addEventListener('ui-screen-change', updateStatus);
    }
    const detailedHUD=document.getElementById('setting-detailed-hud');
    if(detailedHUD){detailedHUD.checked=readStored('yautja_detailed_hud','false')==='true';document.body.classList.toggle('hud-detailed',detailedHUD.checked);detailedHUD.addEventListener('change',()=>{document.body.classList.toggle('hud-detailed',detailedHUD.checked);writeStored('yautja_detailed_hud',String(detailedHUD.checked));});}
    const volume = document.getElementById('setting-volume');
    const output = document.getElementById('setting-volume-value');
    if (volume) {
      volume.value = String(Math.round(Math.min(1, readStoredNumber('yautja_audio_volume', 0.5)) * 100));
      output.textContent = `${volume.value} %`;
      volume.addEventListener('input', () => {
        const value = Number(volume.value) / 100;
        output.textContent = `${volume.value} %`;
        writeStored('yautja_audio_volume', value);
        window.game?.audio.setVolume(value);
      });
    }
    const reducedMotion = document.getElementById('setting-reduced-motion');
    if (reducedMotion) {
      reducedMotion.checked = readStored('yautja_reduced_motion', String(matchMedia('(prefers-reduced-motion: reduce)').matches)) === 'true';
      document.body.classList.toggle('reduced-motion', reducedMotion.checked);
      reducedMotion.addEventListener('change', () => {
        document.body.classList.toggle('reduced-motion', reducedMotion.checked);
        writeStored('yautja_reduced_motion', reducedMotion.checked);
      });
    }
  }

  initCharacterSelect() {
    const listContainer = document.getElementById('char-list-buttons');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    CHARACTERS_DATA.forEach((char, index) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.setAttribute('aria-pressed', String(index === 0));
      btn.className = `char-btn-card ${index === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="char-avatar">${char.icon}</div>
        <div class="char-btn-info">
          <h4>${char.name}</h4>
          <p>${char.classTag}</p>
        </div>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.char-btn-card').forEach(c => { c.classList.remove('active'); c.setAttribute('aria-pressed', 'false'); });
        btn.classList.add('active');
        btn.setAttribute('aria-pressed', 'true');
        this.selectCharacter(char);
      });

      listContainer.appendChild(btn);
    });

    this.selectCharacter(CHARACTERS_DATA[0]);
  }

  selectCharacter(char) {
    this.selectedChar = char;
    document.getElementById('char-class-tag').innerText = char.classTag;
    document.getElementById('char-name').innerText = char.name;
    document.getElementById('char-desc').innerText = char.lore;

    document.getElementById('stat-hp').style.width = `${(char.stats.maxHp / 1400) * 100}%`;
    document.getElementById('stat-speed').style.width = `${(char.stats.moveSpeed / 20) * 100}%`;
    document.getElementById('stat-damage').style.width = `${(char.stats.meleeDamage / 200) * 100}%`;
    document.getElementById('stat-plasma').style.width = `${(char.stats.plasmaDamage / 350) * 100}%`;

    document.getElementById('char-weapon-primary').innerText = char.weapons.primary;
    document.getElementById('char-weapon-special').innerText = char.weapons.special;
    document.getElementById('char-ability-unique').innerText = char.weapons.uniqueAbility;
  }

  initLevelSelect() {
    const gridContainer = document.getElementById('levels-grid-container');
    if (!gridContainer) return;

    gridContainer.innerHTML = '';
    LEVELS_DATA.forEach((lvl, index) => {
      const card = document.createElement('button');
      card.type = 'button';
      card.setAttribute('aria-pressed', String(index === 0));
      card.className = `level-card ${index === 0 ? 'selected' : ''}`;
      if (lvl.accentColor) card.style.borderTopColor = lvl.accentColor;
      card.innerHTML = `
        <div class="level-card-icon">${lvl.icon || '🌲'}</div>
        <span class="level-badge ${lvl.difficultyBadge || 'badge-hard'}">${lvl.difficulty || 'ÉLITE'}</span>
        <h3>${lvl.name}</h3>
        <p>${lvl.desc ?? lvl.description}</p>
        ${lvl.battlefield ? '<span class="level-layout-summary">6 zones reliées · Passages à débloquer</span>' : ''}
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.level-card').forEach(c => { c.classList.remove('selected'); c.setAttribute('aria-pressed', 'false'); });
        card.classList.add('selected');
        card.setAttribute('aria-pressed', 'true');
        this.selectedLevel = lvl;
      });

      gridContainer.appendChild(card);
    });
  }

  updateHUD(player, horde, bossManager, waveIndex, totalWaves, score, factions = {}) {
    const playerName = player.data?.name ?? this.selectedChar?.name ?? 'YAUTJA';
    if (this.hudPlayerName && this.hudPlayerName.textContent !== playerName) this.hudPlayerName.textContent = playerName;
    // Player HP
    const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
    this.hudHpFill.style.width = `${hpPct}%`;
    this.hudHpText.innerText = `${Math.ceil(player.hp)} / ${player.maxHp} HP`;

    // Plasma Energy
    const plasmaPct = (player.plasmaEnergy / player.maxPlasmaEnergy) * 100;
    this.hudPlasmaFill.style.width = `${plasmaPct}%`;
    const combat = player.getCombatState?.(), weapon = player.getWeaponState?.();
    this.hudPlasmaText.innerText = weapon?.actionResource === 'arrows' ? `FLÈCHES DE TAABE : ${weapon.actionAmmo}/12` : weapon?.actionResource === 'axe_charges' ? `HACHE DE NARU : ${weapon.actionAmmo}/4 COUPS` : weapon?.rangedResource === 'bolts' ? `BOULONS : ${weapon?.boltAmmo ?? player.boltAmmo ?? 0}` : `ÉNERGIE PLASMA : ${Math.ceil(plasmaPct)}%`;
    if(combat){const staminaFill=document.getElementById('hud-stamina-fill'),staminaText=document.getElementById('hud-stamina-text');if(staminaFill)staminaFill.style.width=`${Math.max(0,combat.stamina/combat.maxStamina*100)}%`;if(staminaText)staminaText.textContent=`ENDURANCE ${Math.ceil(combat.stamina)}/${combat.maxStamina}`;}
    document.getElementById('wrist-ecg-holoscan')?.classList.toggle('is-critical',Boolean(player.isChestbursterImplanted||player.isFacehuggerLatched));
    const activeWeapon=document.getElementById('hud-active-weapon');if(activeWeapon)activeWeapon.textContent=({wristblades:'LAMES DE POIGNET',combistick:'COMBISTICK',smart_disc:'SMART-DISC',crossbow:'LANCE-BOULONS',shuriken:'SHURIKEN',compound_bow:'ARC COMPOSÉ',taabe_bow:'ARC DE TAABE',naru_axe:'HACHE DE NARU',katana:'KATANA',viking_axe:'HACHE',alpha_sickle:'FAUCILLE'})[weapon?.id]??'ARME PRINCIPALE';
    const supportStatus=document.getElementById('hud-support-status');
    if(supportStatus&&factions.supports){const {apc,cheyenne}=factions.supports;
      const label=(state,name,ammunition)=>state.hp<=0?`${name} DÉTRUIT`:!state.allowed?`${name} INDISPONIBLE`:`${name} ${Math.ceil(state.hp)} PV · ${ammunition}${state.lastRefusal?' · Dernier refus : '+state.refusalMessage:''}`;
      supportStatus.textContent=`${label(apc,'APC',`${apc.remaining.rounds}/48 OBUS`)} | ${label(cheyenne,'CHEYENNE',`${cheyenne.remaining.sorties}/2 SORTIES · ${cheyenne.remaining.rockets}/12 ROQUETTES · ${cheyenne.remaining.napalm}/6 INCENDIAIRES`)}`;
    }

    // Musou Gauge
    const musouPct = (player.musouEnergy / player.maxMusouEnergy) * 100;
    this.hudMusouFill.style.width = `${musouPct}%`;
    this.hudMusouText.innerText = musouPct >= 100 ? '⚡ SURCHARGE PRÊTE ! [ESPACE]' : `SURCHARGE MUSOU: ${Math.ceil(musouPct)}%`;

    // Counters & Score
    this.hudKoCount.innerText = factions.sessionDefeats ?? horde.deadCount;
    this.hudHonorScore.innerText = `${score} PTS`;
    this.hudLevelName.innerText = this.selectedLevel.name;
    this.hudWaveCounter.innerText = this._operationHUD
      ? `${this._operationHUD.state.fronts.length} FRONTS · RÉSERVES FINIES`
      : `VAGUE ${waveIndex}/${totalWaves}`;

    // Chantier 1: Grand Musou Boss Health Gauge
    const bossContainer = document.getElementById('hud-boss-container');
    if (bossContainer) {
      if (bossManager && bossManager.activeBoss && bossManager.activeBoss.hp > 0) {
        bossContainer.classList.remove('hidden');
        const b = bossManager.activeBoss;
        const bPct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));

        const bossFill = document.getElementById('hud-boss-hp-fill');
        const bossText = document.getElementById('hud-boss-hp-text');
        const bossName = document.getElementById('hud-boss-name');
        const bossIcon = document.getElementById('hud-boss-icon');
        const bossBadge = document.getElementById('hud-boss-badge');

        if (bossFill) bossFill.style.width = `${bPct}%`;
        if (bossText) bossText.innerText = `${Math.ceil(b.hp)} / ${b.maxHp} HP (${Math.ceil(bPct)}%)`;

        const title = bossHUDLabel(b);
        const icon = /predator|hunter/.test(b.type) ? '⚔️' : '👑';
        if (bossName) bossName.innerText = title;
        if (bossIcon) bossIcon.innerText = icon;

        if (bossBadge) {
          if (b.isStunned && bPct <= 30) {
            bossBadge.innerText = (b.type === 'predalien_abomination') ? '💀 EXÉCUTION DÉCAPITANTE [E] : ARRACHEZ LE CRÂNE HYBRIDE !' : (b.type === 'rogue_king_prime' ? '👑 ÉTOURDI — ARRACHEZ LA COURONNE CORNUE [E] !' : '💥 ÉTOURDI — EXÉCUTION SPIDERIP [E] !');
            bossBadge.style.color = '#ff3300';
            bossBadge.style.borderColor = '#ff3300';
          } else if (bPct < 25 && b.type === 'predalien_abomination') {
            bossBadge.innerText = '💀 SEUIL CRITIQUE D\'ÉPUISEMENT (<25%)';
            bossBadge.style.color = '#f97316';
            bossBadge.style.borderColor = '#f97316';
          } else if (bPct < 45) {
            bossBadge.innerText = (b.type === 'predalien_abomination' || b.type === 'predalien_queen') ? '🩸 FUREUR GESTANTE : CRACHAT D\'ACIDE & COUVÉE !' : (b.type === 'rogue_king_prime' ? '⚡ FUREUR DU ROI XÉNO : CHARGES DÉVASTATRICES & ONDE PHÉROMONE !' : '🔥 ÉTAT ENRAGÉ DÉCHAÎNÉ (<45%) !');
            bossBadge.style.color = '#ef4444';
            bossBadge.style.borderColor = '#ef4444';
          } else if (bPct < 65 && b.type === 'predalien_abomination') {
            bossBadge.innerText = '⚠️ PHASE 2 : DÉGORGEMENT D\'ACIDE CORROSIF';
            bossBadge.style.color = '#84cc16';
            bossBadge.style.borderColor = '#84cc16';
          } else {
            bossBadge.innerText = b.isStunned ? 'DÉSÉQUILIBRÉ — OUVERTURE POUR ATTAQUER' : 'PHASE 1 : COMBAT OUVERT';
            bossBadge.style.color = '#fef08a';
            bossBadge.style.borderColor = '#facc15';
          }
        }
      } else {
        bossContainer.classList.add('hidden');
      }
    }

    // Chantier 10 & Marc QA (v52.0): Colossal Boss Multi-Segment Health HUD
    const colossalHud = document.getElementById('colossal-boss-hud');
    if (colossalHud) {
      if (bossManager && bossManager.activeBoss && bossManager.activeBoss.hp > 0) {
        colossalHud.classList.remove('hidden');
        const b = bossManager.activeBoss;
        const bPct = Math.max(0, Math.min(100, (b.hp / b.maxHp) * 100));
        const fillEl = document.getElementById('colossal-boss-bar-fill');
        const titleEl = document.getElementById('colossal-boss-title');
        const phaseEl = document.getElementById('colossal-boss-phase');
        const hpTextEl = document.getElementById('colossal-boss-hp-text');
        const armorEl = document.getElementById('colossal-boss-armor-status');

        if (fillEl) fillEl.style.width = `${bPct}%`;
        if (hpTextEl) hpTextEl.innerText = `${Math.ceil(b.hp)} / ${b.maxHp} PV (${Math.ceil(bPct)}%)`;

        if (titleEl) titleEl.innerText = bossHUDLabel(b);

        if (phaseEl) {
          if (b.isStunned) {
            phaseEl.innerText = bPct <= 30 ? 'ÉTOURDI — EXÉCUTION [E] À MOINS DE 8 UNITÉS' : 'DÉSÉQUILIBRÉ — OUVERTURE POUR ATTAQUER';
            phaseEl.style.borderColor = '#ff3300';
            phaseEl.style.color = '#ff3300';
          } else if (bPct < 25) {
            phaseEl.innerText = 'PHASE 3 : SEUIL CRITIQUE';
            phaseEl.style.borderColor = '#ef4444';
            phaseEl.style.color = '#ef4444';
          } else if (bPct < 50) {
            phaseEl.innerText = 'PHASE 2 : FUREUR ENRAGÉE';
            phaseEl.style.borderColor = '#f97316';
            phaseEl.style.color = '#f97316';
          } else {
            phaseEl.innerText = 'PHASE 1 : COMBAT OUVERT';
            phaseEl.style.borderColor = '#00ffff';
            phaseEl.style.color = '#00ffff';
          }
        }

        if (armorEl) {
          armorEl.innerText = bPct > 50 ? 'BLINDAGE CHITINEUX : INTACT' : (bPct > 20 ? 'BLINDAGE CHITINEUX : FRACTURÉ (-30%)' : 'BLINDAGE : DÉTRUIT (VULNÉRABLE)');
        }
      } else {
        colossalHud.classList.add('hidden');
      }
    }

    // Chantier 10: Hive Bio-Acoustic Danger & Pressure Meter (Aliens 1986 / Romulus)
    const pContainer = document.getElementById('hud-hive-pressure-container');
    if (pContainer && horde) {
      let nearestDist = 999;
      if (horde.aliens && horde.aliens.length > 0) {
        horde.aliens.forEach(a => {
          if (a.hp > 0) {
            const d = a.mesh.position.distanceTo(player.position);
            if (d < nearestDist) nearestDist = d;
          }
        });
      }

      const countFactor = Math.min(60, (horde.aliens.length / 35) * 60);
      const proxFactor = Math.max(0, (28 - Math.min(28, nearestDist)) / 28) * 40;
      const pressure = Math.min(100, Math.ceil(countFactor + proxFactor));

      const pFill = document.getElementById('hive-pressure-fill');
      const pVal = document.getElementById('hive-pressure-val');
      const pTag = document.getElementById('hive-pressure-tag');
      const pWarn = document.getElementById('hive-pressure-warning');

      if (pFill) pFill.style.width = `${pressure}%`;
      if (pVal) pVal.innerText = `${pressure}%`;

      if (pTag && pWarn) {
        if (pressure >= 80) {
          pTag.innerText = 'DANGER CRITIQUE';
          pTag.className = 'pressure-badge badge-danger';
          pWarn.innerText = 'EMBUSCADE EN MASSE IMMINENTE !';
          pWarn.style.color = '#ef4444';
        } else if (pressure >= 45) {
          pTag.innerText = 'VIGILANCE ACCRUE';
          pTag.className = 'pressure-badge badge-warning';
          pWarn.innerText = 'ACTIVITÉ RUCHE INTENSE';
          pWarn.style.color = '#f59e0b';
        } else {
          pTag.innerText = 'CALME';
          pTag.className = 'pressure-badge badge-calm';
          pWarn.innerText = 'ÉCHO BIO-RADAR STABLE';
          pWarn.style.color = '#34d399';
        }
      }
    }

    // Chantier 8: Render Multi-Faction Minimap
    this._minimapActors = { horde, bossManager, factions };
    if (!this._battlefieldHUD) this.renderMinimap(player, horde, bossManager, factions);
  }

  updateOperationHUD(state, layout, players = [], objectives = null) {
    this._operationHUD = state ? {state,layout,players,objectives} : null;
    if (!state) return;
    this.hudWaveCounter.textContent = `${state.fronts.length} FRONTS · RÉSERVES FINIES`;
    const weapon = this._minimapActors?.player?.getCombatState?.();
    if (weapon) this.hudPlasmaText.textContent += ` · ENDURANCE ${Math.ceil(weapon.stamina ?? 0)}`;
    this.minimapCanvas?.setAttribute('aria-label','Carte des fronts et rapports de positions connus');
    this.renderOperationMap();
  }

  renderOperationMap() {
    if(!this.minimapCtx||!this._operationHUD)return;
    const {state,layout,players,objectives}=this._operationHUD,ctx=this.minimapCtx,{width,height}=this.minimapCanvas;
    const b=layout.bounds,pad=12,scale=Math.min((width-2*pad)/(b.maxX-b.minX),(height-2*pad)/(b.maxZ-b.minZ));
    const project=point=>[width/2+(point[0]-(b.minX+b.maxX)/2)*scale,height/2+(point[1]-(b.minZ+b.maxZ)/2)*scale];
    const colors={player_clan:'#77e4c4',clan:'#77e4c4',hive:'#ef817d',human:'#76b6f0',human_force:'#76b6f0',rival_clan:'#d2a0dc',yautja:'#77e4c4'};
    ctx.clearRect(0,0,width,height);
    for(const sector of layout.sectors){const[x,y]=project([sector.bounds.minX,sector.bounds.minZ]);ctx.fillStyle='#243e39';ctx.fillRect(x,y,(sector.bounds.maxX-sector.bounds.minX)*scale,(sector.bounds.maxZ-sector.bounds.minZ)*scale);}
    for(const route of state.routes){ctx.strokeStyle=route.open?'#6d9e8f':'#9c685d';ctx.lineWidth=2;ctx.beginPath();for(const[index,point]of(route.waypoints??[]).entries()){const[x,y]=project(point);if(index)ctx.lineTo(x,y);else ctx.moveTo(x,y);}ctx.stroke();}
    const dot=(point,color,radius)=>{const[x,y]=project(point);ctx.fillStyle=color;ctx.beginPath();ctx.arc(x,y,radius,0,Math.PI*2);ctx.fill();};
    for(const front of state.fronts){dot(front.position,colors[front.owner]??'#c7bb94',6);const[x,y]=project(front.position);ctx.fillStyle='#edf8f3';ctx.font='9px sans-serif';ctx.textAlign='center';ctx.fillText(front.label,x,y-9);}
    for(const group of state.groups)if(group.alive>0&&group.precisePositionKnown)dot(group.position,colors[group.factionId]??'#bea8e0',2.3);
    for(const task of objectives?.tasks??[])if(task.available&&task.status!=='done')dot(task.position,'#ffe1a0',3);
    for(const player of players)if(player.hp>0)dot(player.position,'#ddffb1',4);
  }

  updateBattlefieldHUD(progression, layout, player, combatDirector, players = []) {
    if (this._operationHUD) { this.renderOperationMap(); return; }
    const state = battlefieldHUDState(progression, layout, player, combatDirector, players);
    this._battlefieldHUD = state ? { progression, layout, player, players, state } : null;
    this.battlefieldObjective?.classList.toggle('hidden', !state);
    this.battlefieldObjective?.setAttribute('data-phase', state?.relayPhase ?? 'encounter');
    if (!state) {
      this._battlefieldStepsKey = null;
      this.minimapCanvas?.setAttribute('aria-label', 'Carte des ennemis à proximité');
      this.minimapCtx?.clearRect(0, 0, this.minimapCanvas.width, this.minimapCanvas.height);
      return;
    }
    const setText = (element, value) => { if (element && element.textContent !== value) element.textContent = value; };
    setText(this.battlefieldSectorName, state.sectorName);
    setText(this.battlefieldSectorCount, state.sectorCount);
    setText(this.battlefieldObjectiveText, state.objectiveText);
    setText(this.battlefieldNavigation, state.navigationText);
    setText(this.battlefieldInteraction, state.interactionText);
    this.battlefieldInteraction?.classList.toggle('hidden', !state.canInteract);
    this.battlefieldGrace?.classList.toggle('hidden', !state.inGrace);
    setText(this.hudWaveCounter, `ZONE ${state.sectorCount}`);
    const stepsKey = state.steps.map(step => `${step.id}:${step.state}`).join('|');
    if (this.battlefieldSectorProgress && this._battlefieldStepsKey !== stepsKey) {
      this._battlefieldStepsKey = stepsKey;
      this.battlefieldSectorProgress.replaceChildren(...state.steps.map(step => {
        const element = document.createElement('span');
        element.className = `battlefield-step ${step.state}`;
        element.textContent = step.state === 'complete' ? '✓' : String(step.number);
        element.title = `${step.number}. ${step.name}`;
        element.setAttribute('aria-label', `${step.name} : ${step.state === 'complete' ? 'sécurisée' : step.state === 'active' ? 'objectif actuel' : step.state === 'unlocked' ? 'accessible' : 'verrouillée'}`);
        return element;
      }));
    }
    this.minimapCanvas?.setAttribute('aria-label', `Champ de bataille : ${state.sectorName}, zone ${state.sectorCount}. ${state.objectiveText}`);
    this.renderMinimap(player, this._minimapActors?.horde ?? { aliens: [] }, this._minimapActors?.bossManager ?? {}, this._minimapActors?.factions ?? {});
  }

  renderMinimap(player, horde, bossManager, factions = {}) {
    if (!this.minimapCtx) return;
    if (this._operationHUD) return this.renderOperationMap();
    if (this._battlefieldHUD) return this.renderBattlefieldMap(player, horde, bossManager);
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const scale = 1.6;
    const cx = w / 2;
    const cy = h / 2;

    // 1. Draw Xenomorph Horde Dots (Red)
    ctx.fillStyle = '#ff1a1a';
    horde.aliens.forEach(xeno => {
      const relX = (xeno.mesh.position.x - player.position.x) * scale;
      const relZ = (xeno.mesh.position.z - player.position.z) * scale;
      if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
        ctx.beginPath();
        ctx.arc(cx + relX, cy + relZ, xeno.isOfficer ? 3.5 : 2.0, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // 2. USCM Colonial Marines (Cobalt Blue)
    if (factions.marines && factions.marines.marines) {
      ctx.fillStyle = '#3b82f6';
      factions.marines.marines.forEach(m => {
        if (m.hp > 0 && m.mesh) {
          const relX = (m.mesh.position.x - player.position.x) * scale;
          const relZ = (m.mesh.position.z - player.position.z) * scale;
          if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
            ctx.beginPath();
            ctx.arc(cx + relX, cy + relZ, 2.5, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // 3. Yautja Clan Allies (Cyan)
    if (factions.allies && factions.allies.allies) {
      ctx.fillStyle = '#06b6d4';
      factions.allies.allies.forEach(a => {
        if (a.hp > 0 && a.mesh) {
          const relX = (a.mesh.position.x - player.position.x) * scale;
          const relZ = (a.mesh.position.z - player.position.z) * scale;
          if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
            ctx.beginPath();
            ctx.arc(cx + relX, cy + relZ, 3.0, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // 4. Weyland-Yutani Synthetics (Clinical White)
    if (factions.synthetics && factions.synthetics.androids) {
      ctx.fillStyle = '#f8fafc';
      factions.synthetics.androids.forEach(s => {
        if (s.hp > 0 && s.mesh) {
          const relX = (s.mesh.position.x - player.position.x) * scale;
          const relZ = (s.mesh.position.z - player.position.z) * scale;
          if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
            ctx.beginPath();
            ctx.arc(cx + relX, cy + relZ, 2.2, 0, Math.PI * 2);
            ctx.fill();
          }
        }
      });
    }

    // 5. Bad Blood Renegade Yautja (Crimson & Purple pulsating skull)
    if (factions.badBlood && factions.badBlood.isActive && factions.badBlood.badBlood) {
      const bb = factions.badBlood.badBlood;
      const relX = (bb.mesh.position.x - player.position.x) * scale;
      const relZ = (bb.mesh.position.z - player.position.z) * scale;
      if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
        ctx.fillStyle = '#dc2626';
        ctx.beginPath();
        ctx.arc(cx + relX, cy + relZ, 5.0, 0, Math.PI * 2);
        ctx.fill();
        ctx.strokeStyle = '#c084fc';
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }
    }

    // 6. Draw Active Boss Dot (Gold with glowing aura ring)
    if (bossManager.activeBoss) {
      const boss = bossManager.activeBoss;
      const relX = (boss.mesh.position.x - player.position.x) * scale;
      const relZ = (boss.mesh.position.z - player.position.z) * scale;

      if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
        // Outer pulsing ring
        const pulse = 7.0 + Math.sin(Date.now() * 0.008) * 2.0;
        ctx.strokeStyle = '#f59e0b';
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(cx + relX, cy + relZ, pulse, 0, Math.PI * 2);
        ctx.stroke();

        ctx.fillStyle = '#fbbf24';
        ctx.beginPath();
        ctx.arc(cx + relX, cy + relZ, 5.5, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    // 7. Draw Player Dot (Green) & Direction Cone
    ctx.fillStyle = '#22c55e';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();

    // Direction arrow
    const pRot = player.rotationY || 0;
    const dirLen = 8;
    ctx.strokeStyle = '#22c55e';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(cx + Math.sin(pRot) * dirLen, cy + Math.cos(pRot) * dirLen);
    ctx.stroke();
  }

  renderBattlefieldMap(player, horde, bossManager) {
    const ctx = this.minimapCtx, { width, height } = this.minimapCanvas;
    const { progression, layout, players } = this._battlefieldHUD;
    const bounds = layout.bounds;
    if (!bounds) return;
    const padding = 12, scale = Math.min((width - padding * 2) / (bounds.maxX - bounds.minX), (height - padding * 2) / (bounds.maxZ - bounds.minZ));
    const centerX = (bounds.minX + bounds.maxX) / 2, centerZ = (bounds.minZ + bounds.maxZ) / 2;
    const project = (x, z) => [width / 2 + (x - centerX) * scale, height / 2 + (z - centerZ) * scale];
    const rectangle = (box, fill, stroke) => {
      const [x, y] = project(box.minX, box.minZ), w = (box.maxX - box.minX) * scale, h = (box.maxZ - box.minZ) * scale;
      ctx.fillStyle = fill; ctx.fillRect(x, y, w, h);
      if (stroke) { ctx.strokeStyle = stroke; ctx.lineWidth = 1; ctx.strokeRect(x, y, w, h); }
    };
    const dot = (position, color, radius) => {
      if (!position || !Number.isFinite(position.x) || !Number.isFinite(position.z)) return;
      const [x, y] = project(position.x, position.z);
      ctx.fillStyle = color; ctx.beginPath(); ctx.arc(x, y, radius, 0, Math.PI * 2); ctx.fill();
    };
    ctx.clearRect(0, 0, width, height);
    const open = new Set(progression.openGateIds), unlocked = new Set(progression.unlockedSectorIds), completed = new Set(progression.completedSectorIds);
    for (const corridor of layout.corridors ?? []) {
      const gate = layout.gates.find(item => item.from === corridor.from && item.to === corridor.to);
      rectangle(corridor.bounds, gate && open.has(gate.id) ? '#527d69' : '#283a3d');
    }
    for (const sector of layout.sectors) {
      const current = sector.id === progression.currentSector.id;
      rectangle(sector.bounds, completed.has(sector.id) ? '#254c40' : current ? '#344c4d' : unlocked.has(sector.id) ? '#243c3e' : '#15262b', current ? '#d8e5c6' : unlocked.has(sector.id) ? '#688f80' : '#37494d');
      const [x, y] = project(...sector.center);
      ctx.fillStyle = current ? '#f2f8e9' : unlocked.has(sector.id) ? '#a3bbaa' : '#77868b';
      ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(String(layout.sectors.indexOf(sector) + 1), x, y);
    }
    for (const gate of layout.gates) {
      if (open.has(gate.id)) continue;
      const [x, y] = project(...gate.center);
      ctx.strokeStyle = '#e7a46f'; ctx.lineWidth = 3; ctx.beginPath();
      if (gate.axis === 'z') { ctx.moveTo(x - 4, y); ctx.lineTo(x + 4, y); }
      else { ctx.moveTo(x, y - 4); ctx.lineTo(x, y + 4); }
      ctx.stroke();
    }
    // A diamond marks the next objective; it remains visible under enemy dots.
    const target = progression.objectivePosition;
    if (target && !progression.complete) {
      const [x, y] = project(target.x, target.z);
      ctx.fillStyle = progression.currentState?.relayPhase === 'counterattack' ? '#ff9b68' : '#ffd879'; ctx.beginPath(); ctx.moveTo(x, y - 5); ctx.lineTo(x + 5, y); ctx.lineTo(x, y + 5); ctx.lineTo(x - 5, y); ctx.closePath(); ctx.fill();
    }
    for (const alien of horde.aliens ?? []) dot(alien.mesh?.position, '#ff7974', 1.5);
    const factionActors=this._minimapActors?.factions??{};
    for(const[actors,role,factionId]of[[factionActors.marines?.marines,'hostile','human_force'],[factionActors.allies?.allies,'ally','player_clan'],[factionActors.synthetics?.androids,'hostile','synthetic']])for(const actor of actors??[])if(actor.hp>0&&actor.mesh){const[x,y]=project(actor.mesh.position.x,actor.mesh.position.z);if(ctx.save)drawAccessibleMarker(ctx,{x,y,size:3,role,factionId,label:role==='ally'?'Allié':'Hostile'},this.presentationPreferences?.get());else dot(actor.mesh.position,role==='ally'?'#75d8b1':'#e08e84',2);}

    if (bossManager.activeBoss) dot(bossManager.activeBoss.mesh?.position, '#ffb703', 4);
    for (const other of players) if (other !== player && other?.hp > 0) dot(other.position, '#80d9ee', 3.5);
    dot(player.position, '#c8ff99', 4);
    const [px, py] = project(player.position.x, player.position.z);
    ctx.strokeStyle = '#071714'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, Math.PI * 2); ctx.stroke();
  }

  showCombo(count) {
    if (count < 2) {
      this.comboDisplay.classList.add('hidden');
      return;
    }
    this.comboDisplay.classList.remove('hidden');
    this.comboCount.innerText = count;

    if (count > this.trophyStats.highestCombo) {
      this.trophyStats.highestCombo = count;
      writeStored('yautja_max_combo', count);
    }
  }

  showExecutionPrompt(show) {
    if (show) {
      this.executionPrompt.classList.remove('hidden');
    } else {
      this.executionPrompt.classList.add('hidden');
    }
  }

  showAnnouncement(msg) {
    if (!msg) return;
    const globalStatus = document.getElementById('global-status');
    if (this.inGameHud.classList.contains('hidden') && globalStatus) {
      clearTimeout(this.announcementTimer); globalStatus.textContent = msg; globalStatus.classList.remove('hidden');
      this.announcementTimer = setTimeout(() => globalStatus.classList.add('hidden'), 3500); return;
    }
    if (!msg) return;
    this.announcementQueue.push(msg);
    if (!this.isShowingAnnouncement) {
      this.processAnnouncementQueue();
    }
  }

  processAnnouncementQueue() {
    if (this.announcementQueue.length === 0) {
      this.isShowingAnnouncement = false;
      return;
    }
    this.isShowingAnnouncement = true;
    const nextMsg = this.announcementQueue.shift();
    if (this.announcementBanner) {
      this.announcementBanner.innerText = nextMsg;
      this.announcementBanner.classList.remove('hidden');
      this.announcementBanner.style.opacity = '1';
      this.announcementBanner.style.transform = 'translateX(-50%) scale(1.04)';

      if (this.announcementTimeout) clearTimeout(this.announcementTimeout);
      this.announcementTimeout = setTimeout(() => {
        if (this.announcementBanner) {
          this.announcementBanner.style.opacity = '0';
          this.announcementBanner.style.transform = 'translateX(-50%) scale(0.96)';
          this.announcementTransitionTimer = setTimeout(() => {
            if (this.announcementBanner) this.announcementBanner.classList.add('hidden');
            this.processAnnouncementQueue();
          }, 240);
        } else {
          this.processAnnouncementQueue();
        }
      }, 2200);
    } else {
      this.isShowingAnnouncement = false;
    }
  }

  showOfficerDefeatedBanner(officerTitle = 'PRAETORIAN ROYAL GUARD') {
    if (!this.officerBanner) {
      this.officerBanner = document.getElementById('officer-defeated-banner');
      this.officerNameEl = document.getElementById('musou-officer-name');
    }
    if (this.officerBanner) {
      if (this.officerNameEl) this.officerNameEl.innerText = officerTitle.toUpperCase();
      this.officerBanner.classList.remove('hidden');
      if (this.officerTimeout) clearTimeout(this.officerTimeout);
      this.officerTimeout = setTimeout(() => {
        this.officerBanner.classList.add('hidden');
      }, 2800);
    }
  }

  clearTransientState() {
    for (const key of ['announcementTimer', 'announcementTimeout', 'announcementTransitionTimer', 'officerTimeout', 'flashTimeout']) {
      clearTimeout(this[key]); this[key] = null;
    }
    this.announcementQueue.length = 0;
    this.isShowingAnnouncement = false;
    this.announcementBanner?.classList.add('hidden');
    this.officerBanner?.classList.add('hidden');
    document.getElementById('global-status')?.classList.add('hidden');
    if (this.screenFlash) this.screenFlash.className = '';
  }

  flashScreen(type) {
    this.screenFlash.style.opacity=document.body.classList.contains('reduced-flashes')?'.08':'';
    this.screenFlash.className = `${type}-flash`;
    clearTimeout(this.flashTimeout);
    this.flashTimeout = setTimeout(() => {
      this.screenFlash.className = '';
    }, 200);
  }

  updateTrophyRoom() {
    document.getElementById('trophy-total-kos').innerText = this.trophyStats.totalKos;
    document.getElementById('trophy-skulls-collected').innerText = this.trophyStats.skullsCollected;
    document.getElementById('trophy-highest-combo').innerText = this.trophyStats.highestCombo;

    const container = document.getElementById('trophies-container');
    if (!container) return;

    const list = [
      { name: 'CHASSEUR NOVICE', desc: 'Éliminer 50 Xenomorphes', req: 50, current: this.trophyStats.totalKos, icon: '💀' },
      { name: 'TUEUR DE LA RUCHE', desc: 'Éliminer 500 Xenomorphes', req: 500, current: this.trophyStats.totalKos, icon: '🔥' },
      { name: 'GRAND AÎNÉ YAUTJA', desc: 'Éliminer 1500 Xenomorphes', req: 1500, current: this.trophyStats.totalKos, icon: '👑' },
      { name: 'SEIGNEUR DU COMBO', desc: 'Atteindre un combo de 50 hits', req: 50, current: this.trophyStats.highestCombo, icon: '⚡' }
    ];

    container.innerHTML = '';
    list.forEach(t => {
      const unlocked = t.current >= t.req;
      const item = document.createElement('div');
      item.className = `trophy-item ${unlocked ? 'unlocked' : ''}`;
      item.innerHTML = `
        <div class="trophy-icon">${t.icon}</div>
        <div>
          <h4 style="color:${unlocked ? '#ffb703' : '#aaa'}">${t.name} ${unlocked ? '✓ UNLOCKED' : ''}</h4>
          <p style="font-size:0.8rem;color:#888">${t.desc}</p>
        </div>
      `;
      container.appendChild(item);
    });
  }

  renderBattleDebrief(debrief) {
    const root=document.getElementById('battle-debrief');root.replaceChildren();root.classList.toggle('hidden',!debrief);if(!debrief)return;
    const title=document.createElement('h3');title.textContent=debrief.label;const reason=document.createElement('p');reason.textContent=debrief.reason;root.append(title,reason);
    const scroll=document.createElement('div');scroll.className='debrief-table-scroll';const table=document.createElement('table');
    const headings=['Camp','Alloués','Détaillés','Distants','Réserves','Pertes','Évacués','Capturés'];const header=document.createElement('tr');for(const text of headings){const cell=document.createElement('th');cell.textContent=text;header.append(cell);}table.append(header);
    for(const row of debrief.rows){const tr=document.createElement('tr');for(const value of[row.label,row.allocated,row.active,row.distant,row.reserve,row.dead,row.evacuated,row.captured]){const cell=document.createElement('td');cell.textContent=value;tr.append(cell);}table.append(tr);}scroll.append(table);root.append(scroll);
    const note=document.createElement('p');note.textContent='Chaque combattant appartient à un seul état. Les changements de niveau de détail ne comptent pas comme des pertes.';root.append(note);
    if(debrief.noncombatants){const n=debrief.noncombatants,p=document.createElement('p');p.textContent=`Non-combattants : ${n.allocated} personnes · ${n.captive} captives · ${n.rescued} secourues · ${n.evacuated} évacuées · ${n.dead} perdues.`;root.append(p);}
    if(debrief.named.length){const p=document.createElement('p');p.textContent='Destins confirmés : '+debrief.named.map(item=>`${item.label} — ${({dead:'vaincu',evacuated:'évacué',captured:'capturé'})[item.state]}`).join(' · ');root.append(p);}
    const details=document.createElement('details'),summary=document.createElement('summary');summary.textContent='Journal des causes connues';details.append(summary);const list=document.createElement('ol');const names={unit_died:'Combattant perdu',base_captured:'Contrôle du front changé',morale_changed:'Cohésion modifiée',source_disabled:'Source de renfort neutralisée',reinforcements_inbound:'Renforts en route',reinforcements_arrived:'Renforts arrivés',route_changed:'Passage modifié',operation_finished:'Résultat confirmé',group_order:'Ordre transmis',tactic_ordered:'Tactique collective',companion_ability:'Action du compagnon'};for(const event of debrief.journal.filter(item=>item.priority>=1).slice(-24)){const li=document.createElement('li');li.textContent=`${Math.floor(event.time/60)}:${String(Math.floor(event.time%60)).padStart(2,'0')} · ${hiveCoordinationFeedback(event)??`${names[event.type]??'Rapport de mission'}${event.before!==undefined?' · '+Math.round(event.before)+' → '+Math.round(event.after):''}`}`;list.append(li);}details.append(list);root.append(details);
  }

  recordEndSession(kos, skulls, honor, sessionId) {
    this._recordedSessions ??= new Set();
    if (sessionId !== undefined && this._recordedSessions.has(sessionId)) return false;
    if (sessionId !== undefined) this._recordedSessions.add(sessionId);
    kos = Math.max(0, Math.floor(Number(kos) || 0));
    skulls = Math.max(0, Math.floor(Number(skulls) || 0));
    this.trophyStats.totalKos += kos;
    this.trophyStats.skullsCollected += skulls;
    writeStored('yautja_total_kos', this.trophyStats.totalKos);
    writeStored('yautja_skulls', this.trophyStats.skullsCollected);

    document.getElementById('end-ko-count').innerText = kos;
    document.getElementById('end-honor-pts').innerText = honor;
    document.getElementById('end-trophies').innerText = skulls;

    if (kos > 20 && !document.body.classList.contains('reduced-motion')) {
      confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }

  /* Chantier 10: Bio-Mask Target Lock Telemetry & Weakpoint Scanning Reticle */
  updateTargetLockTelemetry(target, camera, player, visionMode = 0) {
    const reticleElem = document.getElementById('hud-tri-target-lock');
    if (!reticleElem) return;

    if (!target || !target.mesh || target.hp <= 0 || !camera) {
      reticleElem.classList.add('hidden');
      return;
    }

    // Project 3D enemy world position to 2D screen coordinates
    const targetPos = target.mesh.position.clone();
    targetPos.y += (target.height || 1.4) * 0.7;

    const projected = targetPos.clone().project(camera);
    if (projected.z > 1.0) {
      // Behind camera view frustum
      reticleElem.classList.add('hidden');
      return;
    }

    const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
    const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;

    reticleElem.style.left = `${screenX}px`;
    reticleElem.style.top = `${screenY}px`;
    reticleElem.classList.remove('hidden');

    // Genus & Threat Classification
    let genus = 'GENUS : XX121 GUERRIER XÉNOMORPHE';
    let weakpoint = 'FAIBLESSE : DÔME CRÂNIEN (-40% ARMURE)';
    let threat = 'ÉLEVÉE';

    if (target.type === 'queen') {
      genus = 'GENUS : REINE GESTANTE MATRIARCH';
      weakpoint = 'FAIBLESSE : SAC D\'INOCULATION & ÉCUSSON CERVICAL';
      threat = 'EXTRÊME / NIVEAU OMEGA';
    } else if (target.type === 'praetorian') {
      genus = 'GENUS : GARDE ROYALE PRAETORIEN';
      weakpoint = 'FAIBLESSE : TUBES RESPIRATOIRES DORSAL';
      threat = 'LÉTALE';
    } else if (target.type === 'crusher') {
      genus = 'GENUS : BROYEUR BLINDÉ (CRUSHER)';
      weakpoint = 'FAIBLESSE : FLANC & ARTICULATIONS POSTÉRIEURES';
      threat = 'MAXIMALE';
    } else if (target.type === 'facehugger') {
      genus = 'GENUS : ARACHNIDE PARASITE (FACEHUGGER)';
      weakpoint = 'FAIBLESSE : CORPUS EMBRYONNAIRE VITAL';
      threat = 'IMMÉDIATE';
    } else if (target.type === 'grid_alien') {
      genus = 'GENUS : ALIEN BALAFRÉ (GRID CELTIC NEMESIS)';
      weakpoint = 'FAIBLESSE : CICATRICES CARAPACE (BRÈCHES FIBREUSES)';
      threat = 'APEX';
    } else if (target.type === 'spitter') {
      genus = 'GENUS : CRACHEUR D\'ACIDE SPITTER';
      weakpoint = 'FAIBLESSE : POCHES GASTRIQUES ACIDIFIÉES';
      threat = 'DISTANCE HAUTE';
    } else if (target.type === 'red_warrior') {
      genus = 'GENUS : GUERRIER KAINDE AMEDHA ÉCARLATE';
      weakpoint = 'FAIBLESSE : ÉCORCE CHITINEUSE CHAUFFÉE';
      threat = 'FRENZY';
    } else if (target.isMarvelAlpha || target.type === 'marvel_alpha') {
      genus = 'GENUS : ALPHA EPSILON APEX (MARVEL CANON)';
      weakpoint = 'FAIBLESSE : FAUX DORSALES & ÉPINE CENTRALE';
      threat = 'COMMANDEMENT / APEX CRITIQUE';
    } else if (target.type === 'cryo_xeno') {
      genus = 'GENUS : XÉNOMORPHE CRYO-SUBZÉRO (LV-695)';
      weakpoint = 'FAIBLESSE : CRISTAUX DE GIVRE (VULNÉRABLE AU PLASMA)';
      threat = 'GLACIALE / RALENTISSEMENT';
    } else if (target.type === 'cyber_xeno') {
      genus = 'GENUS : CYBORG XÉNOMORPHE STEEL TEAM (W-Y ICARUS)';
      weakpoint = 'FAIBLESSE : HARNAIS TITANE & DIODE OPTIQUE';
      threat = 'BALISTIQUE / ARTIFICIELLE';
    }

    const dist = player && player.position ? player.position.distanceTo(target.mesh.position).toFixed(1) : '12.0';

    const genusElem = document.getElementById('hud-telemetry-genus');
    const statsElem = document.getElementById('hud-telemetry-stats');
    const weakpointElem = document.getElementById('hud-telemetry-weakpoint');

    if (genusElem) genusElem.innerText = genus;
    if (statsElem) statsElem.innerText = `DISTANCE : ${dist}M | MENACE : ${threat}`;
    if (weakpointElem) weakpointElem.innerText = weakpoint;
  }

  /* Chantier 3: Trax-Net Micro-Beacon Dart Gun Wall-Penetrating Tracker HUD */
  updateTraxNetTelemetry(taggedTargets, camera, player) {
    const container = document.getElementById('trax-net-container');
    if (!container) return;

    if (!taggedTargets || taggedTargets.length === 0 || !camera) {
      container.innerHTML = '';
      return;
    }

    let html = '';
    taggedTargets.forEach(target => {
      if (!target || !target.mesh || target.hp <= 0) return;
      const pos = target.mesh.position.clone();
      pos.y += (target.height || 1.5) * 0.5;

      const projected = pos.clone().project(camera);
      if (projected.z > 1.0) return; // Behind camera

      const screenX = (projected.x * 0.5 + 0.5) * window.innerWidth;
      const screenY = (-(projected.y * 0.5) + 0.5) * window.innerHeight;
      const dist = player && player.position ? player.position.distanceTo(target.mesh.position).toFixed(1) : '10.0';
      const timeLeft = target.traxTimer ? target.traxTimer.toFixed(1) : '20.0';

      html += `
        <div class="trax-net-bracket" style="left: ${screenX}px; top: ${screenY}px;">
          <div class="trax-net-diamond"></div>
          <div class="trax-net-tag">
            <span class="trax-title">🎯 TRAX-NET // ${timeLeft}s</span>
            <span class="trax-meta">${dist}m | VULNÉRABILITÉ +25%</span>
          </div>
        </div>
      `;
    });
    container.innerHTML = html;
  }

  /* Chantier 5: Sentry Gun Reload & Calibration Proximity Prompt */
  updateSentryProximityPrompt(isNear, sentry) {
    const promptElem = document.getElementById('sentry-proximity-prompt');
    if (!promptElem) return;
    if (isNear && sentry && sentry.isDeployed) {
      promptElem.classList.remove('hidden');
      const ammoElem = document.getElementById('sentry-prompt-ammo');
      if (ammoElem) ammoElem.innerText = `${sentry.ammo} / ${sentry.maxAmmo || 500} RDS`;
    } else {
      promptElem.classList.add('hidden');
    }
  }

  /* Chantier 3 (v43): Smart-Disc Remote Laser Guidance HUD */
  updateSmartDiscGuidance(isGuiding) {
    const hud = document.getElementById('smartdisc-guidance-hud');
    if (!hud) return;
    if (isGuiding) {
      hud.classList.remove('hidden');
    } else {
      hud.classList.add('hidden');
    }
  }

  /* Chantier 4 (v43): Fallen Marine Scavenge Proximity Prompt */
  updateMarineScavengePrompt(isNear, marine) {
    const prompt = document.getElementById('marine-scavenge-prompt');
    if (!prompt) return;
    if (isNear && marine && !marine.isScavenged) {
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }

  /* === CHANTIER 1 (v46): USCM M56 Smartgun Turret Proximity & Mount Prompt === */
  updateSmartgunPrompt(isNear, isMounted, smartgun) {
    const prompt = document.getElementById('smartgun-turret-prompt');
    if (!prompt) return;
    if (isNear || isMounted) {
      prompt.classList.remove('hidden');
      const textElem = prompt.querySelector('.smartgun-text');
      if (textElem && smartgun) {
        textElem.innerText = isMounted
          ? `TOURELLE M56 ACTIVE // [CLIC GAUCHE] TIRER (${smartgun.ammo}/${smartgun.maxAmmo} RDS) | [E] DÉMONTER`
          : `MONTER LA TOURELLE M56 SMARTGUN (${smartgun.ammo}/${smartgun.maxAmmo} RDS)`;
      }
    } else {
      prompt.classList.add('hidden');
    }
  }

  /* === CHANTIER 9 (v46): USCM Cargo Crane Operator Console Prompt === */
  updateCargoCranePrompt(isNear, craneConsole) {
    const prompt = document.getElementById('cargo-crane-prompt');
    if (!prompt) return;
    if (isNear && craneConsole && !craneConsole.isUsed) {
      prompt.classList.remove('hidden');
    } else {
      prompt.classList.add('hidden');
    }
  }

  /* === CHANTIER 2 (v46): Derelict LV-426 Low Gravity & Laser Mist HUD Banner === */
  updateDerelictHud(isInside) {
    const banner = document.getElementById('derelict-atmosphere-hud');
    if (!banner) return;
    if (isInside) {
      banner.classList.remove('hidden');
    } else {
      banner.classList.add('hidden');
    }
  }

  /* === CHANTIER 6 (v47): Weyland-Yutani Atmospheric Cooling Tower Cryo-Vent Purge Prompt === */
  updateCryoVentPrompt(isNear, cryoVent) {
    const prompt = document.getElementById('cryo-vent-prompt');
    if (!prompt) return;
    if (isNear && cryoVent) {
      prompt.classList.remove('hidden');
      const textElem = prompt.querySelector('.cryo-vent-text');
      if (textElem) {
        if (cryoVent.cooldown > 0) {
          textElem.innerText = `PURGE EN RECHARGE CRYOGÉNIQUE (${Math.ceil(cryoVent.cooldown)}S)`;
          prompt.style.borderColor = '#64748b';
        } else {
          textElem.innerText = `[E] PURGE D'AZOTE LIQUIDE (ZONE 18M, SHATTER X3)`;
          prompt.style.borderColor = '#38bdf8';
        }
      }
    } else {
      prompt.classList.add('hidden');
    }
  }

  /* === CHANTIER 4 (v48): Fiorina 161 Molten Lead Foundry Valve Prompt === */
  updateFoundryValvePrompt(isNear, foundry) {
    const prompt = document.getElementById('foundry-valve-prompt');
    if (!prompt) return;
    if (isNear && foundry) {
      prompt.classList.remove('hidden');
      const textElem = prompt.querySelector('.foundry-valve-text');
      if (textElem) {
        if (foundry.isPouring) {
          textElem.innerText = `COULÉE EN COURS : 12 TONNES DE PLOMB 1200°C (${Math.ceil(foundry.pourTimer)}S)`;
          prompt.style.borderColor = '#ff5500';
        } else if (foundry.cooldown > 0) {
          textElem.innerText = `CREUSET EN RECHARGE THERMIQUE (${Math.ceil(foundry.cooldown)}S)`;
          prompt.style.borderColor = '#64748b';
        } else {
          textElem.innerText = `[E] DÉVERSER 12 TONNES DE PLOMB EN FUSION 1200°C (CANAL 14M, 280 DÉGÂTS/S)`;
          prompt.style.borderColor = '#f97316';
        }
      }
    } else {
      prompt.classList.add('hidden');
    }
  }

  /* === QA AUDIT #2 (Elena - Diegetic Yautja Immersion): Wrist Gauntlet Telemetry HUD === */
  updateDiegeticWristTelemetry(player, env, isEndless = false) {
    const hud = document.getElementById('diegetic-wrist-gauntlet-hud');
    if (!hud || !player) return;

    const maskElem = document.getElementById('wrist-mask-name');
    if (maskElem) {
      maskElem.innerText = player.bioMaskName || 'JUNGLE HUNTER (1987)';
    }

    const blessingElem = document.getElementById('wrist-blessing-tag');
    if (blessingElem) {
      if (env && env.ancientShrine && env.ancientShrine.blessingActive) {
        const names = ["KOS'KANTI (ENERGIE)", "FUREUR PAYA (+50% DMG)", "SOUFFLE CETANU (AURA)"];
        const bName = names[env.ancientShrine.blessingIndex] || 'ACTIVE';
        blessingElem.innerText = `${bName} (${Math.ceil(env.ancientShrine.blessingTimer)}S)`;
        blessingElem.style.color = '#38bdf8';
      } else {
        blessingElem.innerText = 'AUCUNE BÉNÉDICTION';
        blessingElem.style.color = '#64748b';
      }
    }

    const glyphsElem = document.getElementById('wrist-matrix-glyphs');
    if (glyphsElem) {
      // Yautja red countdown matrix glyph sequence (Predator 1987 Wrist Computer Lore)
      const glyphChars = ['⋈','⋉','⋊','⋐','⋑','⋒','⋓','⋔','⋕','⋖','⋗','⟢','⟣','⟤','⟥'];
      const tick = Math.floor(Date.now() / 140);
      const g1 = glyphChars[tick % glyphChars.length];
      const g2 = glyphChars[(tick + 3) % glyphChars.length];
      const g3 = glyphChars[(tick + 7) % glyphChars.length];
      const g4 = glyphChars[(tick + 11) % glyphChars.length];
      glyphsElem.innerText = `${g1} ${g2} : ${g3} ${g4}`;
    }

    const ammoGauss = document.getElementById('wrist-ammo-gauss');
    if (ammoGauss) ammoGauss.innerText = `M77: ${player.m77GaussAmmo ?? 12}/12`;

    const ammoBolt = document.getElementById('wrist-ammo-bolt');
    if (ammoBolt) ammoBolt.innerText = `BOLT: ${player.seegsonBoltAmmo ?? 10}/10`;

    const ammoGrenade = document.getElementById('wrist-ammo-grenades');
    if (ammoGrenade) ammoGrenade.innerText = `HEDP: ${player.m41aGrenadeCharges ?? 4}/6`;
  }
}
