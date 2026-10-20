/* User Interface Manager & Minimap Renderer */

import * as THREE from 'three';
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
      totalKos: parseInt(localStorage.getItem('yautja_total_kos') || '0'),
      skullsCollected: parseInt(localStorage.getItem('yautja_skulls') || '0'),
      highestCombo: parseInt(localStorage.getItem('yautja_max_combo') || '0')
    };

    this.initCharacterSelect();
    this.initLevelSelect();
  }

  showScreen(screenElement) {
    document.querySelectorAll('.ui-screen').forEach(s => {
      s.classList.add('hidden');
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

  updateHUD(player, horde, bossManager, waveIndex, totalWaves, score, factions = {}) {
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

        let title = 'REINE XÉNOMORPHE DE LA RUCHE';
        let icon = '👑';
        if (b.type === 'empress_matriarch') {
          title = 'MATRIARCHE VOLANTE EMPRESS (ALIENS: ROGUE)';
          icon = '🦇';
        } else if (b.type === 'imperial_queen') {
          title = 'REINE IMPÉRIALE DE LA RUCHE (GENOCIDE)';
          icon = '👑';
        } else if (b.type === 'the_offspring') {
          title = 'HYBRIDE MAUDIT Z-01 : THE OFFSPRING (ROMULUS)';
          icon = '🧬';
        } else if (b.type === 'predalien_abomination') {
          title = 'ABOMINATION PRÉDALIENNE GESTANTE (AVP: REQUIEM CHET)';
          icon = '☣️';
        } else if (b.type === 'predalien_queen') {
          title = 'ABOMINATION PREDALIEN MATRIARCHE (AVP: REQUIEM)';
          icon = '💀';
        } else if (b.type === 'rogue_king_prime') {
          title = 'ROGUE KING XENOMORPH PRIME (ALIENS: ROGUE 1993)';
          icon = '👑';
        } else if (b.type === 'awakened_engineer') {
          title = 'INGÉNIEUR MALA\'KAK ÉVEILLÉ (PROMETHEUS 2012)';
          icon = '🏛️';
        } else if (b.type === 'predalien_matriarch_titan') {
          title = 'MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE (AVP EXTINCTION)';
          icon = '👑';
        }

        if (bossName) bossName.innerText = title;
        if (bossIcon) bossIcon.innerText = icon;

        if (bossBadge) {
          if (b.isStunned) {
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
            bossBadge.innerText = b.type === 'rogue_king_prime' ? 'PHASE 1 : BÉLIER CARAPACE LOURDE' : 'PHASE 1 : GESTANTE ACTIVE';
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

        let bTitle = 'REINE XÉNOMORPHE';
        if (b.type === 'rogue_king_prime') bTitle = 'ROGUE KING XENOMORPH PRIME (ALIENS: ROGUE)';
        else if (b.type === 'awakened_engineer') bTitle = 'INGÉNIEUR MALA\'KAK ÉVEILLÉ (PROMETHEUS)';
        else if (b.type === 'predalien_matriarch_titan') bTitle = 'MATRIARCHE TITAN PRÉDALIENNE IMPÉRIALE';
        else if (b.type === 'the_offspring') bTitle = 'HYBRIDE THE OFFSPRING (ROMULUS)';
        else if (b.type === 'trilobite_prime') bTitle = 'TRILOBITE CÉPHALOPODE PRIME (PROMETHEUS)';
        else if (b.type === 'predalien_queen') bTitle = 'REINE PRÉDALIENNE (AVP: REQUIEM)';

        if (titleEl) titleEl.innerText = bTitle;

        if (phaseEl) {
          if (b.isStunned) {
            phaseEl.innerText = 'ÉTOURDI - EXÉCUTION [E]';
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
            phaseEl.innerText = 'PHASE 1 : CARAPACE INTACTE';
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
    this.renderMinimap(player, horde, bossManager, factions);
  }

  renderMinimap(player, horde, bossManager, factions = {}) {
    if (!this.minimapCtx) return;
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
    if (factions.marines && factions.marines.squad) {
      ctx.fillStyle = '#3b82f6';
      factions.marines.squad.forEach(m => {
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
    if (factions.allies && factions.allies.squad) {
      ctx.fillStyle = '#06b6d4';
      factions.allies.squad.forEach(a => {
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
    if (factions.synthetics && factions.synthetics.synthetics) {
      ctx.fillStyle = '#f8fafc';
      factions.synthetics.synthetics.forEach(s => {
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
          setTimeout(() => {
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
        blessingElem.innerText = 'AUCUNE BÃ‰NÃ‰DICTION';
        blessingElem.style.color = '#64748b';
      }
    }

    const glyphsElem = document.getElementById('wrist-matrix-glyphs');
    if (glyphsElem) {
      // Yautja red countdown matrix glyph sequence (Predator 1987 Wrist Computer Lore)
      const glyphChars = ['â‹ˆ', 'â‹‰', 'â‹Š', 'â‹', 'â‹‘', 'â‹’', 'â‹“', 'â‹”', 'â‹•', 'â‹–', 'â‹—', 'âŸ¢', 'âŸ£', 'âŸ¤', 'âŸ¥'];
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