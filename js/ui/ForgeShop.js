/* Persistent Yautja forge. Honor is earned once, and every purchase is debited. */
import { readStoredNumber, readStoredObject, writeStored } from './storage.js';
import { HonorLedger } from '../engine/HonorLedger.js';
import { renderHonorSaveNotice } from './HonorSaveNotice.js';

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
    let storage; try { storage = globalThis.localStorage; } catch { /* Private browsing can deny storage access. */ }
    this.honorLedger = new HonorLedger({ storage, earned: Math.floor(readStoredNumber('yautja_total_kos') * 100), spent: Math.floor(this.upgrades.spentHonor) });
    this.restorePurchasedUpgrades();
    if (!['#00d2ff', '#ff1a1a', '#39ff14'].includes(this.upgrades.laserColor)) this.upgrades.laserColor = DEFAULT_UPGRADES.laserColor;
    this.shopModal = document.getElementById('forge-modal');
    document.addEventListener('ui-screen-change', event => {
      if (event.detail.screen === 'forge-modal') this.render();
    });
    for (const button of document.querySelectorAll?.('[data-honor-save-retry]') ?? []) {
      button.addEventListener('click', () => this.retryHonorSave());
    }
    this.render();
  }
  save() {
    writeStored('yautja_forge_upgrades', JSON.stringify(this.upgrades));
    this.render();
  }
  getCost(level) { return (level + 1) * 3500; }
  getBalance() {
    return this.honorLedger.balance;
  }
  restorePurchasedUpgrades() {
    if (this.honorLedger.getSnapshot().recoveryRequired) return;
    for (const type of ['hp', 'damage', 'plasma']) for (let level = 1; level <= 5; level++) {
      if (this.honorLedger.hasTransaction(`forge:${type}:${level}`)) this.upgrades[`${type}Level`] = Math.max(this.upgrades[`${type}Level`], level);
    }
  }
  renderSaveStatus() {
    return renderHonorSaveNotice(this.honorLedger.getSnapshot());
  }
  ensureHonorReady() {
    if (!this.honorLedger.getSnapshot().recoveryRequired) return true;
    const notice = this.renderSaveStatus();
    window.game?.ui?.showAnnouncement(notice.message);
    return false;
  }
  retryHonorSave() {
    const recovered = this.honorLedger.retryRecovery();
    this.restorePurchasedUpgrades();
    this.render();
    const game = globalThis.window?.game;
    game?.refreshClanHonorVaultUI?.();
    game?.refreshClanForgeUI?.();
    if (!this.honorLedger.getSnapshot().recoveryRequired) game?.player2?.loadClanForgeUpgrades?.();
    game?.refreshMothershipBridgeUI?.();
    const snapshot = this.honorLedger.getSnapshot();
    game?.ui?.showAnnouncement(recovered && !snapshot.recoveryRequired && snapshot.pendingRewards === 0
      ? 'Registre d’honneur disponible. Les récompenses en attente ont été vérifiées.'
      : 'La sauvegarde reste conservée. La nouvelle tentative n’a pas encore abouti.');
    return recovered;
  }
  buyUpgrade(type, currentScore) {
    if (!['hp', 'damage', 'plasma'].includes(type)) return 0;
    if (!this.ensureHonorReady()) return 0;
    const level = this.upgrades[`${type}Level`];
    const cost = this.getCost(level);
    if (level >= 5) {
      window.game?.ui.showAnnouncement('Amélioration maximale atteinte.');
      return 0;
    }
    if (this.getBalance() < cost) {
      window.game?.ui.showAnnouncement(`Honneur insuffisant : ${cost.toLocaleString('fr-FR')} points nécessaires.`);
      return 0;
    }
    if (!this.honorLedger.spend({ id: `forge:${type}:${level + 1}`, amount: cost })) { this.render(); return 0; }
    this.upgrades[`${type}Level`]++;
    this.upgrades.spentHonor += cost;
    this.save();
    this.audioEngine.playSkullSnap();
    return cost;
  }
  render() {
    const balance = this.getBalance();
    const notice = this.renderSaveStatus();
    const balanceEl = document.getElementById('forge-honor-balance');
    if (balanceEl) balanceEl.textContent = notice.blocked ? 'À RÉCUPÉRER' : `${balance.toLocaleString('fr-FR')} PTS`;
    for (const [type, id] of [['hp', 'btn-buy-hp'], ['damage', 'btn-buy-dmg']]) {
      const btn = document.getElementById(id);
      if (!btn) continue;
      const level = this.upgrades[`${type}Level`];
      const cost = this.getCost(level);
      btn.textContent = level >= 5 ? 'NIVEAU MAXIMUM · 5/5' : `${cost.toLocaleString('fr-FR')} PTS · NIVEAU ${level}/5`;
      btn.disabled = level >= 5 || notice.blocked;
      btn.classList.toggle('unaffordable', balance < cost);
      btn.title = notice.blocked ? 'La sauvegarde d’honneur doit être relue avant un achat'
        : balance < cost ? `Il manque ${(cost - balance).toLocaleString('fr-FR')} points d’honneur` : 'Acheter cette amélioration';
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
