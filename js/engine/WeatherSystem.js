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

    for (let i = 0; i < count; i++) {
      const geo = new THREE.CylinderGeometry(0.6, 0.6, 6, 8);
      const mesh = new THREE.Mesh(geo, this.pipeMat);
      mesh.position.set((Math.random() - 0.5) * 60, 3, (Math.random() - 0.5) * 60);
      this.scene.add(mesh);

      this.pipes.push({
        mesh: mesh,
        hp: 50,
        pos: mesh.position.clone()
      });
    }
  }

  checkExplosions(attackPos, radius, horde, particleSystem) {
    for (let i = this.pipes.length - 1; i >= 0; i--) {
      const pipe = this.pipes[i];
      if (attackPos.distanceTo(pipe.pos) < radius) {
        // Trigger massive gas explosion!
        particleSystem.emitSparks(pipe.pos, 30);
        this.scene.remove(pipe.mesh);
        this.pipes.splice(i, 1);

        // Wipe nearby Xenomorphs in 15m radius
        const expAttack = { origin: pipe.pos, radius: 15, damage: 800 };
        horde.checkMeleeHits(expAttack);
      }
    }
  }
}
