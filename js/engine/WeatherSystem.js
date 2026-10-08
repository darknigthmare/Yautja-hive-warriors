/* Dynamic Environmental Weather & Explosive Hazards Manager */

import * as THREE from 'three';

export class WeatherSystem {
  constructor(scene) {
    this.scene = scene;
    this.pipes = [];
    this.weatherType = 'none';

    this.pipeMat = new THREE.MeshStandardMaterial({ color: 0xffaa00, metalness: 0.8 });
  }

  setWeather(type) {
    this.weatherType = type;
  }

  spawnGasPipes(count = 6) {
    this.pipes.forEach(p => this.scene.remove(p.mesh));
    this.pipes = [];

    const bandMat = new THREE.MeshBasicMaterial({ color: 0x111111 }); // Black hazard stripes
    const flangeMat = new THREE.MeshStandardMaterial({ color: 0x475569, metalness: 0.9, roughness: 0.2 });

    for (let i = 0; i < count; i++) {
      const group = new THREE.Group();

      const geo = new THREE.CylinderGeometry(0.5, 0.5, 6, 8);
      const mainPipe = new THREE.Mesh(geo, this.pipeMat);
      group.add(mainPipe);

      // Flange rings at top, center and bottom
      [-2.6, 0, 2.6].forEach(y => {
        const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.65, 0.65, 0.25, 8), flangeMat);
        flange.position.y = y;
        group.add(flange);
      });

      // Hazard warning black bands
      [-1.3, 1.3].forEach(y => {
        const band = new THREE.Mesh(new THREE.CylinderGeometry(0.52, 0.52, 0.35, 8), bandMat);
        band.position.y = y;
        group.add(band);
      });

      group.position.set((Math.random() - 0.5) * 60, 3, (Math.random() - 0.5) * 60);
      this.scene.add(group);

      this.pipes.push({
        mesh: group,
        hp: 50,
        pos: group.position.clone()
      });
    }
  }

  checkExplosions(attackPos, radius, horde, particleSystem) {
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      if (attackPos.distanceTo(pipe.pos) < radius) {
        // Trigger fiery methane / gas explosion fireball!
        particleSystem.emitSparks(pipe.pos, 45);

        // Visual expanding orange-red fireball
        const fireballGeo = new THREE.SphereGeometry(2.0, 10, 10);
        const fireballMat = new THREE.MeshBasicMaterial({
          color: 0xff3300,
          transparent: true,
          opacity: 0.85
        });
        const fireball = new THREE.Mesh(fireballGeo, fireballMat);
        fireball.position.copy(pipe.pos);
        this.scene.add(fireball);

        let scale = 1.0;
        const fireAnim = setInterval(() => {
          scale += 0.8;
          fireball.scale.set(scale, scale, scale);
          fireball.material.opacity -= 0.12;
          if (fireball.material.opacity <= 0) {
            clearInterval(fireAnim);
            this.scene.remove(fireball);
          }
        }, 30);

        this.scene.remove(pipe.mesh);
        this.pipes.splice(i, 1);

        // Wipe nearby Xenomorphs in 15m radius
        const expAttack = { origin: pipe.pos, radius: 15, damage: 850 };
        horde.checkMeleeHits(expAttack);
      }
    }
  }
}
