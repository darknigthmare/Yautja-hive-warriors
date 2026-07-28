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
        this.onConfirmLoadout({
          primary: this.selectedPrimary,
          secondary: this.selectedSecondary,
          plasma: this.selectedPlasma,
          gadgets: this.selectedGadgets
        });
      });
    }
  }
}
