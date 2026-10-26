/* Pre-Mission Yautja Tactical Loadout Preparation Screen */

export class LoadoutScreen {
  constructor(onConfirmLoadout) {
    this.onConfirmLoadout = onConfirmLoadout;
    this.screen = document.getElementById('loadout-prep-screen');

    this.selectedPrimary = 'wristblades';
    this.selectedSecondary = 'smart_disc';
    this.selectedPlasma = 'single_caster';
    this.selectedGadgets = ['medicomp', 'bear_trap']; // Max 2 gadgets

    this.setupListeners();
    this.syncSelection();
  }

  syncSelection() {
    for (const [selector, selected] of [['.loadout-primary-btn', [this.selectedPrimary]], ['.loadout-secondary-btn', [this.selectedSecondary]], ['.loadout-gadget-btn', this.selectedGadgets]]) {
      document.querySelectorAll(selector).forEach(btn => {
        const active = selected.includes(btn.dataset.item);
        btn.classList.toggle('selected', active);
        btn.setAttribute('aria-pressed', String(active));
      });
    }
    const feedback = document.getElementById('loadout-feedback');
    if (feedback) feedback.textContent = `${this.selectedGadgets.length} gadget${this.selectedGadgets.length === 1 ? '' : 's'} sélectionné${this.selectedGadgets.length === 1 ? '' : 's'} sur 2`;
  }

  setupListeners() {
    // Primary Radio Buttons
    document.querySelectorAll('.loadout-primary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loadout-primary-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedPrimary = btn.dataset.item;
        this.syncSelection();
      });
    });

    // Secondary Radio Buttons
    document.querySelectorAll('.loadout-secondary-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.loadout-secondary-btn').forEach(b => b.classList.remove('selected'));
        btn.classList.add('selected');
        this.selectedSecondary = btn.dataset.item;
        this.syncSelection();
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
          } else {
            const feedback = document.getElementById('loadout-feedback');
            if (feedback) feedback.textContent = 'Deux gadgets maximum. Retirez-en un avant d’en choisir un autre.';
            return;
          }
        }
        this.syncSelection();
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
          gadgets: [...this.selectedGadgets]
        });
      });
    }
  }
}
