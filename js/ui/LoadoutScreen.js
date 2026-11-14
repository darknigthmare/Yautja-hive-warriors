/* Pre-Mission Yautja Tactical Loadout Preparation Screen */

import { KIT_ABILITIES, DEFAULT_KITS } from '../systems/HunterKit.js';

export class LoadoutScreen {
  constructor(onConfirmLoadout) {
    this.onConfirmLoadout = onConfirmLoadout;
    this.screen = document.getElementById('loadout-prep-screen');

    this.selectedPrimary = 'wristblades';
    this.selectedSecondary = 'smart_disc';
    this.selectedPlasma = 'single_caster';
    this.selectedGadgets = ['medicomp', 'bear_trap']; // Max 2 gadgets

    this.setupListeners();
  }

  /* Four kit slots, pre-filled with the hunter's default kit (bible, tab 02_Chasseurs). */
  renderKit(charId) {
    this.selectedKit = (DEFAULT_KITS[charId] || DEFAULT_KITS.jungle_hunter).slice(0, 4);
    let section = document.getElementById('loadout-kit-section');
    if (!section) {
      section = document.createElement('div');
      section.id = 'loadout-kit-section';
      section.className = 'loadout-section glass-panel full-grid';
      const grid = this.screen && this.screen.querySelector('.loadout-grid-container');
      if (grid) grid.appendChild(section);
    }
    const options = Object.entries(KIT_ABILITIES)
      .map(([id, a]) => `<option value="${id}">${a.icon} ${a.label}</option>`).join('');
    section.innerHTML = `<h3>4. KIT DU CHASSEUR : EMPLACEMENTS [1] À [4]</h3>
      <div class="loadout-options" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(180px,1fr));gap:10px;">
        ${this.selectedKit.map((id, i) => `<label style="display:flex;flex-direction:column;gap:4px;">
          <span>Touche ${i + 1}</span>
          <select id="kit-slot-${i}" class="loadout-btn" data-slot="${i}">${options}</select></label>`).join('')}
      </div>`;
    this.selectedKit.forEach((id, i) => {
      const sel = section.querySelector(`#kit-slot-${i}`);
      sel.value = id;
      sel.addEventListener('change', () => { this.selectedKit[i] = sel.value; });
    });
  }

  setupListeners() {
    // Primary Radio Buttons
    document.querySelectorAll('.loadout-primary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loadout-primary-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPrimary = btn.dataset.item;
      });
    });

    // Secondary Radio Buttons
    document.querySelectorAll('.loadout-secondary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loadout-secondary-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedSecondary = btn.dataset.item;
      });
    });

    // Gadgets Checkboxes (Max 2)
    document.querySelectorAll('.loadout-gadget-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const item = btn.dataset.item;
        if (this.selectedGadgets.includes(item)) {
          this.selectedGadgets = this.selectedGadgets.filter(g => g !== item);
          btn.classList.remove('selected');
        } else {
          if (this.selectedGadgets.length < 2) {
            this.selectedGadgets.push(item);
            btn.classList.add('selected');
          }
        }
      });
    });

    const btnConfirm = document.getElementById('btn-confirm-loadout');
    if (btnConfirm) {
      btnConfirm.addEventListener('click', () => {
        if (this.screen) this.screen.classList.add('hidden');
        this.onConfirmLoadout({
          primary: this.selectedPrimary,
          secondary: this.selectedSecondary,
          plasma: this.selectedPlasma,
          gadgets: this.selectedGadgets,
          kit: this.selectedKit ? this.selectedKit.slice() : null
        });
      });
    }
  }
}
