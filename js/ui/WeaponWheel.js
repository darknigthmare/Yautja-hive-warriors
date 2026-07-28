/* 360° Radial Holo-Weapon Wheel Manager */

export class WeaponWheel {
  constructor(onSelectWeapon) {
    this.onSelectWeapon = onSelectWeapon;
    this.isOpen = false;
    this.overlay = document.getElementById('weapon-wheel-overlay');
    this.wheelContainer = document.getElementById('wheel-items-container');

    this.weapons = [
      { id: 'wristblades', label: '🔪 Wristblades' },
      { id: 'combistick', label: '🗡️ Combistick Spear' },
      { id: 'smart_disc', label: '🛸 Smart-Disc' },
      { id: 'shuriken', label: '☸️ 6-Blade Shuriken' },
      { id: 'katana', label: '⚔️ Samurai Katana' },
      { id: 'alpha_sickle', label: '🦴 Alpha Bone Sickle' },
      { id: 'viking_axe', label: '🪓 Viking Axe' },
      { id: 'compound_bow', label: '🏹 Compound Bow' }
    ];

    this.buildWheel();
  }

  buildWheel() {
    if (!this.wheelContainer) return;
    this.wheelContainer.innerHTML = '';
    const count = this.weapons.length;
    const radius = 120;

    this.weapons.forEach((w, idx) => {
      const angle = (idx / count) * Math.PI * 2 - Math.PI / 2;
      const x = Math.cos(angle) * radius;
      const y = Math.sin(angle) * radius;

      const item = document.createElement('div');
      item.className = 'wheel-item';
      item.style.left = `calc(50% + ${x}px)`;
      item.style.top = `calc(50% + ${y}px)`;
      item.innerText = w.label;

      item.addEventListener('click', () => {
        this.onSelectWeapon(w.id);
        this.close();
      });

      this.wheelContainer.appendChild(item);
    });
  }

  open() {
    this.isOpen = true;
    if (this.overlay) this.overlay.classList.remove('hidden');
  }

  close() {
    this.isOpen = false;
    if (this.overlay) this.overlay.classList.add('hidden');
  }

  toggle() {
    if (this.isOpen) this.close();
    else this.open();
  }
}
