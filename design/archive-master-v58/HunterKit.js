/* Hunter kit (bible: game-concept.md §7, decisions HW-DEC-08 and HW-DEC-35).
 *
 * Common core, the same for every hunter:
 *   move WASD · light attack LMB · heavy attack RMB · plasma caster hold Shift
 *   Musou Space · parry F · dodge Alt · cloak C · weapon swap Q · lock-on Tab
 *   vision V · medicomp Z · interact/execute E · human weapon G · pause Escape
 * Plus four slots on keys 1 to 4, filled per hunter.
 */

import * as THREE from 'three';

// Each ability receives the GameApp instance. It returns false when it could not fire.
export const KIT_ABILITIES = {
  combistick_throw: { label: 'Combistick lancé', icon: '🗡️', use: g => { g.throwCombiStick(); return true; } },
  voice_lure: { label: 'Leurre vocal', icon: '🗣️', use: g => g.player.triggerVoiceMimicryDecoy(g.horde, g.audio, g.ui, g.particles) },
  tripwire_mine: {
    label: 'Mine', icon: '🕸️', use: g => {
      const ok = g.player.deployTripwireMine(g.renderer.scene, g.particles);
      g.ui.showAnnouncement(ok ? '🕸️ MINE PLASMA POSÉE' : '⏳ MINE EN RECHARGE OU 3 MINES DÉJÀ POSÉES');
      return ok;
    }
  },
  nuke: { label: 'Autodestruction', icon: '☢️', use: g => { if (!g.nukeCountingDown) g.triggerNukeCountdownSequence(); return true; } },
  spine_whip: { label: 'Fouet vertébral', icon: '🐍', use: g => { g.performSpineWhip(); return true; } },
  acid_solvent: {
    label: 'Solvant', icon: '🧪', use: g => {
      if (g.player.acidSolventCharges > 0 && g.horde.acidPools.length > 0 && g.player.useAcidSolvent(g.horde)) {
        g.ui.showAnnouncement('🧪 SOLVANT VERSÉ : SOL PURIFIÉ');
        return true;
      }
      g.ui.showAnnouncement('🧪 AUCUNE FLAQUE D\'ACIDE À DISSOUDRE OU FIOLE VIDE');
      return false;
    }
  },
  plasma_pistol: { label: 'Pistolet plasma', icon: '🔫', use: g => g.player.firePlasmaPistol(g.horde, g.bosses, g.particles, g.env) },
  bone_scythe: { label: 'Faux d\'os', icon: '🦴', use: g => { g.performBoneScytheCleave(); return true; } },
  compound_bow: { label: 'Arc', icon: '🏹', use: g => { g.fireCompoundBow(); return true; } },
  bear_trap: {
    label: 'Piège à mâchoires', icon: '🪤', use: g => {
      const p = g.player;
      if ((p.bearTrapCharges || 0) <= 0) { g.ui.showAnnouncement('🪤 PLUS DE PIÈGE À POSER'); return false; }
      p.bearTrapCharges--;
      p.deployBearTrap(g.horde);
      g.ui.showAnnouncement(`🪤 PIÈGE À MÂCHOIRES POSÉ (${p.bearTrapCharges} RESTANT${p.bearTrapCharges > 1 ? 'S' : ''})`);
      return true;
    }
  },
  warhorn: { label: 'Cor de guerre', icon: '📯', cooldown: 20, use: g => { g.player.soundWarhorn(); g.ui.showAnnouncement('📯 COR DE GUERRE : +50 % DE DÉGÂTS ET DE VITESSE'); return true; } },
  shield: {
    label: 'Bouclier', icon: '🛡️', use: g => {
      const up = g.player.toggleShieldBlock();
      g.ui.showAnnouncement(up ? '🛡️ BOUCLIER LEVÉ' : '🛡️ BOUCLIER BAISSÉ');
      return true;
    }
  },
  flechettes: { label: 'Fléchettes guidées', icon: '🎯', use: g => { g.triggerLaserGuidedFlechettes(); return true; } },
  pounce: { label: 'Bond', icon: '⚡', use: g => g.player.pounceLeap() },
  holo_decoy: { label: 'Leurre holographique', icon: '👤', use: g => { g.deployHoloDecoy(); return true; } },
  iaijutsu: {
    label: 'Iaijutsu', icon: '⚔️', use: g => {
      const hits = g.player.performIaijutsuSlash(g.horde, g.synthetics, g.bosses, g.particles);
      if (!hits) { g.ui.showAnnouncement('⏳ IAIJUTSU EN RECHARGE'); return false; }
      g.registerHits(hits);
      return true;
    }
  },
  smart_disc: {
    label: 'Disque', icon: '🛸', use: g => {
      const active = g.projectiles.find(p => p.isSmartDisc && p.life > 0.1);
      if (active) g.triggerSmartDiscRicochet(active); else g.throwSmartDisc();
      return true;
    }
  },
  grapple: { label: 'Grappin', icon: '🪝', use: g => { g.player.performGauntletGrapple(g.horde, g.bosses, g.ui, g.particles, g.env); return true; } },
  maul: { label: 'Maul', icon: '🔨', use: g => { g.player.performMaulEarthshaker(g.horde, g.bosses, g.synthetics, g.env, g.particles, g.ui); return true; } },
  roar: { label: 'Rugissement', icon: '🦁', use: g => { g.player.performPredatorChestThumpRoar(g.horde, g.bosses, g.synthetics, g.audio, g.particles, g.ui); return true; } },
  burner: { label: 'Brûleur', icon: '🔥', use: g => { g.player.fireBurnerHeavyPlasma(g.horde, g.bosses, g.synthetics, g.particles, g.audio, g.ui); return true; } },
  netgun: {
    label: 'Lance-filet', icon: '🕸️', use: g => {
      const ok = g.player.fireNetgun(g.horde, g.synthetics);
      if (!ok) g.ui.showAnnouncement('⏳ LANCE-FILET EN RECHARGE OU AUCUNE CIBLE');
      return ok;
    }
  },
  shuriken: { label: 'Shuriken', icon: '✴️', use: g => { g.throwShuriken(); return true; } },
};

// Default kits from the bible, tab 02_Chasseurs.
export const DEFAULT_KITS = {
  jungle_hunter: ['combistick_throw', 'voice_lure', 'tripwire_mine', 'nuke'],
  wolf_predator: ['spine_whip', 'acid_solvent', 'plasma_pistol', 'tripwire_mine'],
  alpha_predator: ['bone_scythe', 'compound_bow', 'bear_trap', 'warhorn'],
  feral_predator: ['shield', 'flechettes', 'pounce', 'holo_decoy'],
  samurai_predator: ['iaijutsu', 'smart_disc', 'bear_trap', 'grapple'],
  viking_predator: ['maul', 'warhorn', 'roar', 'burner'],
  city_hunter: ['smart_disc', 'netgun', 'combistick_throw', 'shuriken'],
};

export class HunterKit {
  constructor(game) {
    this.game = game;
    this.slots = [];
    this.cooldowns = {};
    this.lockTarget = null;
    this.lockMarker = null;
    this.bar = null;
  }

  equip(charId, chosen = null) {
    const valid = Array.isArray(chosen) && chosen.length >= 1 && chosen.length <= 4 && chosen.every(id => KIT_ABILITIES[id]);
    this.slots = (valid ? chosen : (DEFAULT_KITS[charId] || DEFAULT_KITS.jungle_hunter)).slice(0, 4);
    this.cooldowns = {};
    this.releaseLock();
    this.renderBar();
  }

  useSlot(index) {
    const id = this.slots[index];
    const ability = KIT_ABILITIES[id];
    if (!ability || !this.game.player) return;
    if ((this.cooldowns[id] || 0) > 0) {
      this.game.ui.showAnnouncement(`⏳ ${ability.label.toUpperCase()} EN RECHARGE (${Math.ceil(this.cooldowns[id])} S)`);
      return;
    }
    const ok = ability.use(this.game);
    if (ok !== false && ability.cooldown) this.cooldowns[id] = ability.cooldown;
  }

  /* Human weapon picked up in crates (HW-DEC-13): fires whichever has ammo. */
  fireHumanWeapon() {
    const g = this.game, p = g.player;
    if ((p.m77GaussAmmo || 0) > 0) return p.fireM77GaussRifle(g.horde, g.bosses, g.synthetics, g.env, g.particles, g.ui);
    if ((p.seegsonBoltAmmo || 0) > 0) return p.fireSeegsonBoltGun(g.horde, g.bosses, g.synthetics, g.particles, g.ui);
    if ((p.m41aGrenadeCharges || 0) > 0) return p.fireM41AGrenade(g.ui, g.horde, g.bosses, g.synthetics, g.env, g.particles);
    g.ui.showAnnouncement('📦 AUCUNE ARME HUMAINE : RAMASSEZ UNE CAISSE');
    return false;
  }

  /* Lock-on (HW-DEC-35): Tab locks the boss, else the strongest elite, else the nearest enemy
     within 40 m; pressing Tab again moves to the next candidate. R releases. */
  lockCandidates() {
    const g = this.game, pos = g.player.position;
    const list = [];
    if (g.bosses.activeBoss && g.bosses.activeBoss.mesh && g.bosses.activeBoss.mesh.position.distanceTo(pos) <= 40) {
      list.push({ kind: 'boss', ref: g.bosses.activeBoss, score: Infinity });
    }
    for (const a of g.horde.aliens) {
      if (!a || a.hp <= 0 || !a.mesh) continue;
      const d = a.mesh.position.distanceTo(pos);
      if (d > 40) continue;
      list.push({ kind: 'alien', ref: a, score: (a.maxHp || a.hp) - d * 4 });
    }
    return list.sort((x, y) => y.score - x.score).slice(0, 8);
  }

  toggleLock() {
    const g = this.game;
    const list = this.lockCandidates();
    if (!list.length) { this.releaseLock(); g.ui.showAnnouncement('🎯 AUCUNE CIBLE À VERROUILLER'); return; }
    let next = list[0];
    if (this.lockTarget) {
      const i = list.findIndex(c => c.ref === this.lockTarget.ref);
      next = list[(i + 1) % list.length];
    }
    this.lockTarget = next;
    if (!this.lockMarker) {
      this.lockMarker = new THREE.Mesh(
        new THREE.TorusGeometry(1.4, 0.08, 6, 24),
        new THREE.MeshBasicMaterial({ color: 0xff1a1a, transparent: true, opacity: 0.9 })
      );
      this.lockMarker.rotation.x = Math.PI / 2;
    }
    if (!this.lockMarker.parent) g.renderer.scene.add(this.lockMarker);
    g.ui.showAnnouncement('🎯 CIBLE VERROUILLÉE [TAB : SUIVANTE · R : LIBÉRER]');
  }

  releaseLock() {
    this.lockTarget = null;
    if (this.lockMarker && this.lockMarker.parent) this.lockMarker.parent.remove(this.lockMarker);
  }

  lockedPosition() {
    const t = this.lockTarget;
    if (!t) return null;
    const g = this.game;
    if (t.kind === 'boss') {
      if (g.bosses.activeBoss !== t.ref || !t.ref.mesh) return null;
      return t.ref.mesh.position;
    }
    if (!t.ref || t.ref.hp <= 0 || !t.ref.mesh || !g.horde.aliens.includes(t.ref)) return null;
    return t.ref.mesh.position;
  }

  update(delta) {
    for (const id in this.cooldowns) this.cooldowns[id] = Math.max(0, this.cooldowns[id] - delta);
    const p = this.game.player;
    if (!p) return;
    if (this.lockTarget) {
      const target = this.lockedPosition();
      if (!target || target.distanceTo(p.position) > 55) {
        this.releaseLock();
      } else {
        // Face the locked target so every attack goes its way.
        p.rotationY = Math.atan2(target.x - p.position.x, target.z - p.position.z);
        if (p.mesh) p.mesh.rotation.y = p.rotationY;
        this.lockMarker.position.set(target.x, target.y + 0.15, target.z);
        this.lockMarker.rotation.z += delta * 2.5;
      }
    }
    this.updateBar();
  }

  renderBar() {
    const host = document.getElementById('hud-equipped-slots-container');
    if (!host) return;
    // The old bar listed about 54 abilities; the kit shows the common core and four slots.
    host.querySelectorAll('.ability-slot').forEach(el => { el.hidden = true; });
    if (!this.bar) {
      this.bar = document.createElement('div');
      this.bar.id = 'hunter-kit-bar';
      this.bar.style.cssText = 'display:flex;gap:8px;flex-wrap:wrap;justify-content:center;';
      host.appendChild(this.bar);
    }
    const core = [['ESPACE', 'Musou'], ['F', 'Parade'], ['ALT', 'Esquive'], ['C', 'Camouflage'], ['Q', 'Arme'], ['TAB', 'Verrou'], ['G', 'Arme humaine']];
    const slotHtml = this.slots.map((id, i) => {
      const a = KIT_ABILITIES[id];
      return `<div class="ability-slot kit-slot" data-kit="${id}" style="position:relative;min-width:78px;">
        <span class="slot-key">${i + 1}</span><span class="slot-icon">${a.icon}</span>
        <span class="slot-label" style="font-size:10px;">${a.label}</span>
        <span class="kit-cd" style="position:absolute;top:2px;right:6px;font-size:10px;color:#ffb703;"></span></div>`;
    }).join('');
    const coreHtml = core.map(([k, l]) => `<div class="ability-slot kit-core" style="min-width:64px;opacity:0.8;">
        <span class="slot-key">${k}</span><span class="slot-label" style="font-size:10px;">${l}</span></div>`).join('');
    this.bar.innerHTML = slotHtml + coreHtml;
  }

  updateBar() {
    if (!this.bar) return;
    this.bar.querySelectorAll('.kit-slot').forEach(el => {
      const cd = this.cooldowns[el.dataset.kit] || 0;
      const label = el.querySelector('.kit-cd');
      if (label) label.textContent = cd > 0 ? `${Math.ceil(cd)} s` : '';
      el.style.opacity = cd > 0 ? '0.5' : '1';
    });
  }
}
