/* User Interface Manager & Minimap Renderer */

import confetti from 'canvas-confetti';
import { readStored, readStoredNumber, writeStored } from './storage.js';
import { CHARACTERS_DATA } from '../data/charactersData.js';
import { LEVELS_DATA } from '../data/levelsData.js';

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
        <div class="level-card-icon">${lvl.icon}</div>
        <span class="level-badge ${lvl.difficultyBadge}">${lvl.difficulty}</span>
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

  updateHUD(player, horde, bossManager, waveIndex, totalWaves, score) {
    const playerName = player.data?.name ?? this.selectedChar?.name ?? 'YAUTJA';
    if (this.hudPlayerName && this.hudPlayerName.textContent !== playerName) this.hudPlayerName.textContent = playerName;
    // Player HP
    const hpPct = Math.max(0, (player.hp / player.maxHp) * 100);
    this.hudHpFill.style.width = `${hpPct}%`;
    this.hudHpText.innerText = `${Math.ceil(player.hp)} / ${player.maxHp} HP`;

    // Plasma Energy
    const plasmaPct = (player.plasmaEnergy / player.maxPlasmaEnergy) * 100;
    this.hudPlasmaFill.style.width = `${plasmaPct}%`;
    this.hudPlasmaText.innerText = `ÉNERGIE PLASMA: ${Math.ceil(plasmaPct)}%`;

    // Musou Gauge
    const musouPct = (player.musouEnergy / player.maxMusouEnergy) * 100;
    this.hudMusouFill.style.width = `${musouPct}%`;
    this.hudMusouText.innerText = musouPct >= 100 ? '⚡ SURCHARGE PRÊTE ! [ESPACE]' : `SURCHARGE MUSOU: ${Math.ceil(musouPct)}%`;

    // Counters & Score
    this.hudKoCount.innerText = horde.deadCount;
    this.hudHonorScore.innerText = `${score} PTS`;
    this.hudLevelName.innerText = this.selectedLevel.name;
    this.hudWaveCounter.innerText = `VAGUE ${waveIndex}/${totalWaves}`;

    // Render Minimap
    this._minimapActors = { horde, bossManager };
    if (!this._battlefieldHUD) this.renderMinimap(player, horde, bossManager);
  }

  updateBattlefieldHUD(progression, layout, player, combatDirector, players = []) {
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
    this.renderMinimap(player, this._minimapActors?.horde ?? { aliens: [] }, this._minimapActors?.bossManager ?? {});
  }

  renderMinimap(player, horde, bossManager) {
    if (!this.minimapCtx) return;
    if (this._battlefieldHUD) return this.renderBattlefieldMap(player, horde, bossManager);
    const ctx = this.minimapCtx;
    const w = this.minimapCanvas.width;
    const h = this.minimapCanvas.height;

    ctx.clearRect(0, 0, w, h);

    const scale = 1.6;
    const cx = w / 2;
    const cy = h / 2;

    // Draw Xenomorph Horde Dots
    ctx.fillStyle = '#ff1a1a';
    horde.aliens.forEach(xeno => {
      const relX = (xeno.mesh.position.x - player.position.x) * scale;
      const relZ = (xeno.mesh.position.z - player.position.z) * scale;
      if (Math.abs(relX) < cx && Math.abs(relZ) < cy) {
        ctx.beginPath();
        ctx.arc(cx + relX, cy + relZ, 2.5, 0, Math.PI * 2);
        ctx.fill();
      }
    });

    // Draw Active Boss Dot
    if (bossManager.activeBoss) {
      const boss = bossManager.activeBoss;
      const relX = (boss.mesh.position.x - player.position.x) * scale;
      const relZ = (boss.mesh.position.z - player.position.z) * scale;

      ctx.fillStyle = '#ffb703';
      ctx.beginPath();
      ctx.arc(cx + relX, cy + relZ, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw Player Dot (Green)
    ctx.fillStyle = '#39ff14';
    ctx.beginPath();
    ctx.arc(cx, cy, 4, 0, Math.PI * 2);
    ctx.fill();
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
    clearTimeout(this.announcementTimer);
    const globalStatus = document.getElementById('global-status');
    globalStatus?.classList.add('hidden');
    this.announcementBanner.classList.add('hidden');
    const target = this.inGameHud.classList.contains('hidden') ? globalStatus : this.announcementBanner;
    if (!target) return;
    target.textContent = msg;
    target.classList.remove('hidden');
    this.announcementTimer = setTimeout(() => target.classList.add('hidden'), 3500);
  }

  flashScreen(type) {
    this.screenFlash.className = `${type}-flash`;
    setTimeout(() => {
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

  recordEndSession(kos, skulls, honor) {
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
}
