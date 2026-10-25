/* Persistent Yautja forge. Honor is earned once, and every purchase is debited. */
import { readStoredNumber, readStoredObject, writeStored } from './storage.js';

const DEFAULT_UPGRADES = { hpLevel: 0, damageLevel: 0, plasmaLevel: 0, activeMask: 'classic', laserColor: '#00d2ff', spentHonor: 0 };
export class ForgeShop {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;
    this.upgrades = { ...DEFAULT_UPGRADES, ...readStoredObject('yautja_forge_upgrades', DEFAULT_UPGRADES) };
    for (const field of ['hpLevel', 'damageLevel', 'plasmaLevel']) {
      const value = Number(this.upgrades[field]);
      this.upgrades[field] = Number.isFinite(value) ? Math.max(0, Math.min(5, Math.floor(value))) : 0;
    }
    this.upgrades.spentHonor = Number.isFinite(Number(this.upgrades.spentHonor)) ? Math.max(0, Number(this.upgrades.spentHonor)) : 0;
    if (!['#00d2ff', '#ff1a1a', '#39ff14'].includes(this.upgrades.laserColor)) this.upgrades.laserColor = DEFAULT_UPGRADES.laserColor;
    this.shopModal = document.getElementById('forge-modal');
    document.addEventListener('ui-screen-change', event => {
      if (event.detail.screen === 'forge-modal') this.render();
    });
    this.render();
  }
  save() {
    writeStored('yautja_forge_upgrades', JSON.stringify(this.upgrades));
    this.render();
  }
  getCost(level) { return (level + 1) * 3500; }
  getBalance(earnedHonor = readStoredNumber('yautja_total_kos') * 100) {
    return Math.max(0, earnedHonor - this.upgrades.spentHonor);
  }
  buyUpgrade(type, currentScore) {
    if (!['hp', 'damage', 'plasma'].includes(type)) return 0;
    const level = this.upgrades[`${type}Level`];
    const cost = this.getCost(level);
    if (level >= 5) {
      window.game?.ui.showAnnouncement('Amélioration maximale atteinte.');
      return 0;
    }
    if (this.getBalance(currentScore) < cost) {
      window.game?.ui.showAnnouncement(`Honneur insuffisant : ${cost.toLocaleString('fr-FR')} points nécessaires.`);
      return 0;
    }
    this.upgrades[`${type}Level`]++;
    this.upgrades.spentHonor += cost;
    this.save();
    this.audioEngine.playSkullSnap();
    return cost;
  }
  render() {
    const balance = this.getBalance();
    const balanceEl = document.getElementById('forge-honor-balance');
    if (balanceEl) balanceEl.textContent = `${balance.toLocaleString('fr-FR')} PTS`;
    for (const [type, id] of [['hp', 'btn-buy-hp'], ['damage', 'btn-buy-dmg']]) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      const level = this.upgrades[`${type}Level`];
      const cost = this.getCost(level);
      btn.textContent = level >= 5 ? 'NIVEAU MAXIMUM · 5/5' : `${cost.toLocaleString('fr-FR')} PTS · NIVEAU ${level}/5`;
      btn.disabled = level >= 5;
      btn.classList.toggle('unaffordable', balance < cost);
      btn.title = balance < cost ? `Il manque ${(cost - balance).toLocaleString('fr-FR')} points d’honneur` : 'Acheter cette amélioration';
    }
    for (const [color, id] of [['#00d2ff', 'btn-laser-cyan'], ['#ff1a1a', 'btn-laser-red'], ['#39ff14', 'btn-laser-green']]) {
      const btn = document.getElementById(id);
      if (btn) btn.setAttribute('aria-pressed', String(color === this.upgrades.laserColor));
    }
  }
  selectMask(maskId) {
    this.upgrades.activeMask = maskId;
    this.save();
  }
  selectLaserColor(colorHex) {
    if (!['#00d2ff', '#ff1a1a', '#39ff14'].includes(colorHex)) return;
    this.upgrades.laserColor = colorHex;
    this.save();
    window.game?.ui.showAnnouncement('Couleur du laser enregistrée.');
  }
  applyStatsToPlayer(player) {
    const hpBonus = this.upgrades.hpLevel * 200;
    player.maxHp += hpBonus;
    player.hp += hpBonus;
    const damageMultiplier = 1 + this.upgrades.damageLevel * 0.25;
    player.meleeDamage *= damageMultiplier;
    player.plasmaDamage *= damageMultiplier;
  }
}
