/* Yautja Forge Shop & Upgrades Manager */

export class ForgeShop {
  constructor(audioEngine) {
    this.audioEngine = audioEngine;

    // Saved Upgrades State in localStorage
    this.upgrades = JSON.parse(localStorage.getItem('yautja_forge_upgrades') || JSON.stringify({
      hpLevel: 0,
      damageLevel: 0,
      plasmaLevel: 0,
      activeMask: 'classic',
      laserColor: '#00d2ff'
    }));

    this.shopModal = document.getElementById('forge-modal');
  }

  save() {
    localStorage.setItem('yautja_forge_upgrades', JSON.stringify(this.upgrades));
  }

  getCost(level) {
    return (level + 1) * 3500; // Honor points cost
  }

  buyUpgrade(type, currentScore) {
    const cost = this.getCost(this.upgrades[type + 'Level']);
    if (currentScore >= cost && this.upgrades[type + 'Level'] < 5) {
      this.upgrades[type + 'Level']++;
      this.save();
      this.audioEngine.playSkullSnap();
      return cost;
    }
    return 0;
  }

  selectMask(maskId) {
    this.upgrades.activeMask = maskId;
    this.save();
  }

  selectLaserColor(colorHex) {
    this.upgrades.laserColor = colorHex;
    this.save();
  }

  applyStatsToPlayer(player) {
    // Stat Bonuses
    const hpBonus = this.upgrades.hpLevel * 200;
    player.maxHp += hpBonus;
    player.hp += hpBonus;

    const damageMultiplier = 1 + (this.upgrades.damageLevel * 0.25);
    player.meleeDamage *= damageMultiplier;
    player.plasmaDamage *= damageMultiplier;
  }
}
