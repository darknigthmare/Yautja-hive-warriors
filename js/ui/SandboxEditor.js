/* Custom Battle Arena Sandbox Editor */

export class SandboxEditor {
  constructor(onLaunchSandbox) {
    this.onLaunchSandbox = onLaunchSandbox;
    this.modal = document.getElementById('sandbox-modal');

    this.config = {
      enemyCount: 60,
      enemySpeed: 1.0,
      acidDensity: 1.0,
      bossType: 'queen'
    };

    this.setupListeners();
  }

  setupListeners() {
    const sliderCount = document.getElementById('slider-sandbox-count');
    const valCount = document.getElementById('val-sandbox-count');

    if (sliderCount && valCount) {
      sliderCount.addEventListener('input', (e) => {
        this.config.enemyCount = parseInt(e.target.value);
        valCount.innerText = e.target.value;
      });
    }

    const btnLaunch = document.getElementById('btn-launch-sandbox');
    if (btnLaunch) {
      btnLaunch.addEventListener('click', () => {
        this.onLaunchSandbox(this.config);
      });
    }
  }
}
