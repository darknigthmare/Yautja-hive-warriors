/* User Interface Manager & Minimap Renderer */

import { CHARACTERS_DATA } from '../data/charactersData.js';
import { LEVELS_DATA } from '../data/levelsData.js';

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
      totalKos: parseInt(localStorage.getItem('yautja_total_kos') || '0'),
      skullsCollected: parseInt(localStorage.getItem('yautja_skulls') || '0'),
      highestCombo: parseInt(localStorage.getItem('yautja_max_combo') || '0')
    };

    this.initCharacterSelect();
    this.initLevelSelect();
  }

  showScreen(screenElement) {
    [this.mainMenu, this.charSelectMenu, this.levelSelectMenu, this.inGameHud, this.trophyModal, this.optionsModal, this.gameOverScreen].forEach(s => {
      if (s) s.classList.add('hidden');
    });
    if (screenElement) screenElement.classList.remove('hidden');
  }

  initCharacterSelect() {
    const listContainer = document.getElementById('char-list-buttons');
    if (!listContainer) return;

    listContainer.innerHTML = '';
    CHARACTERS_DATA.forEach((char, index) => {
      const btn = document.createElement('div');
      btn.className = `char-btn-card ${index === 0 ? 'active' : ''}`;
      btn.innerHTML = `
        <div class="char-avatar">${char.icon}</div>
        <div class="char-btn-info">
          <h4>${char.name}</h4>
          <p>${char.classTag}</p>
        </div>
      `;

      btn.addEventListener('click', () => {
        document.querySelectorAll('.char-btn-card').forEach(c => c.classList.remove('active'));
        btn.classList.add('active');
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
      const card = document.createElement('div');
      card.className = `level-card ${index === 0 ? 'selected' : ''}`;
      card.innerHTML = `
        <div class="level-card-icon">${lvl.icon}</div>
        <span class="level-badge ${lvl.difficultyBadge}">${lvl.difficulty}</span>
        <h3>${lvl.name}</h3>
        <p>${lvl.description}</p>
      `;

      card.addEventListener('click', () => {
        document.querySelectorAll('.level-card').forEach(c => c.classList.remove('selected'));
        card.classList.add('selected');
        this.selectedLevel = lvl;
      });

      gridContainer.appendChild(card);
    });
  }

  updateHUD(player, horde, bossManager, waveIndex, totalWaves, score) {
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
    this.hudMusouText.innerText = musouPct >= 100 ? '⚡ SURCHARGE MUSOU PRÊTE ! [Q / ESPACE]' : `SURCHARGE MUSOU: ${Math.ceil(musouPct)}%`;

    // Counters & Score
    this.hudKoCount.innerText = horde.deadCount;
    this.hudHonorScore.innerText = `${score} PTS`;
    this.hudLevelName.innerText = this.selectedLevel.name;
    this.hudWaveCounter.innerText = `VAGUE ${waveIndex}/${totalWaves}`;

    // Render Minimap
    this.renderMinimap(player, horde, bossManager);
  }

  renderMinimap(player, horde, bossManager) {
    if (!this.minimapCtx) return;
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

  showCombo(count) {
    if (count < 2) {
      this.comboDisplay.classList.add('hidden');
      return;
    }
    this.comboDisplay.classList.remove('hidden');
    this.comboCount.innerText = count;

    if (count > this.trophyStats.highestCombo) {
      this.trophyStats.highestCombo = count;
      localStorage.setItem('yautja_max_combo', count);
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
    this.announcementBanner.innerText = msg;
    this.announcementBanner.classList.remove('hidden');
    setTimeout(() => {
      this.announcementBanner.classList.add('hidden');
    }, 2500);
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
    this.trophyStats.totalKos += kos;
    this.trophyStats.skullsCollected += skulls;
    localStorage.setItem('yautja_total_kos', this.trophyStats.totalKos);
    localStorage.setItem('yautja_skulls', this.trophyStats.skullsCollected);

    document.getElementById('end-ko-count').innerText = kos;
    document.getElementById('end-honor-pts').innerText = honor;
    document.getElementById('end-trophies').innerText = skulls;

    if (window.confetti && kos > 20) {
      window.confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
    }
  }
}
