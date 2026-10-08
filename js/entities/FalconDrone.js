/* Falconer Super Predator Biomechanical Falcon Drone - Predators 2010 Canon 1:1 */

import * as THREE from 'three';

export class FalconDrone {
  constructor(scene, audioEngine, particles = null) {
    this.scene = scene;
    this.audioEngine = audioEngine;
    this.particles = particles;

    this.mesh = null;
    this.leftWing = null;
    this.rightWing = null;
    this.thrusterLight = null;

    this.isActive = false;
    this.flightTimer = 0;
    this.orbitAngle = 0;
    this.orbitRadius = 14.0;
    this.cruiseAltitude = 11.0;
    this.currentPos = new THREE.Vector3();

    this.isDiving = false;
    this.diveTarget = null;
    this.diveTimer = 0;
    this.fireCooldown = 0;

    this.buildDroneMesh();
  }

  buildDroneMesh() {
    this.mesh = new THREE.Group();

    const titaniumMat = new THREE.MeshStandardMaterial({
      color: 0x1e293b,
      metalness: 0.95,
      roughness: 0.15
    });

    const darkMat = new THREE.MeshStandardMaterial({
      color: 0x0f172a,
      metalness: 0.9,
      roughness: 0.25
    });

    const energyMat = new THREE.MeshBasicMaterial({ color: 0x00d2ff });

    // Fuselage / Central Body
    const bodyGeo = new THREE.ConeGeometry(0.35, 1.8, 6);
    bodyGeo.rotateX(Math.PI / 2);
    const body = new THREE.Mesh(bodyGeo, titaniumMat);
    this.mesh.add(body);

    // Raptor Beak Head & Optical Sensor Eye
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.18, 0.7, 5), darkMat);
    head.rotation.x = -Math.PI / 2;
    head.position.set(0, 0, 1.1);
    this.mesh.add(head);

    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.06, 6, 6), new THREE.MeshBasicMaterial({ color: 0xff0033 }));
    eye.position.set(0, 0.08, 1.25);
    this.mesh.add(eye);

    // Left Swept Wing
    this.leftWing = new THREE.Group();
    this.leftWing.position.set(-0.25, 0, 0.2);
    const wingGeoL = new THREE.BoxGeometry(1.6, 0.04, 0.6);
    const wingMeshL = new THREE.Mesh(wingGeoL, titaniumMat);
    wingMeshL.position.set(-0.8, 0, -0.2);
    wingMeshL.rotation.y = 0.35;
    this.leftWing.add(wingMeshL);
    // Tip Thruster
    const tipL = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.3), energyMat);
    tipL.position.set(-1.6, 0, -0.3);
    this.leftWing.add(tipL);
    this.mesh.add(this.leftWing);

    // Right Swept Wing
    this.rightWing = new THREE.Group();
    this.rightWing.position.set(0.25, 0, 0.2);
    const wingGeoR = new THREE.BoxGeometry(1.6, 0.04, 0.6);
    const wingMeshR = new THREE.Mesh(wingGeoR, titaniumMat);
    wingMeshR.position.set(0.8, 0, -0.2);
    wingMeshR.rotation.y = -0.35;
    this.rightWing.add(wingMeshR);
    // Tip Thruster
    const tipR = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.06, 0.3), energyMat);
    tipR.position.set(1.6, 0, -0.3);
    this.rightWing.add(tipR);
    this.mesh.add(this.rightWing);

    // Split V-Tail Fins
    const tailL = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.6), darkMat);
    tailL.position.set(-0.35, 0.25, -0.8);
    tailL.rotation.z = -0.5;
    this.mesh.add(tailL);

    const tailR = new THREE.Mesh(new THREE.BoxGeometry(0.04, 0.5, 0.6), darkMat);
    tailR.position.set(0.35, 0.25, -0.8);
    tailR.rotation.z = 0.5;
    this.mesh.add(tailR);

    // Twin Micro Plasma Cannons
    const gunGeo = new THREE.CylinderGeometry(0.04, 0.04, 0.6, 6);
    gunGeo.rotateX(Math.PI / 2);
    const gunL = new THREE.Mesh(gunGeo, darkMat);
    gunL.position.set(-0.25, -0.15, 0.4);
    this.mesh.add(gunL);

    const gunR = new THREE.Mesh(gunGeo, darkMat);
    gunR.position.set(0.25, -0.15, 0.4);
    this.mesh.add(gunR);

    // Rear Jet Thruster Light
    this.thrusterLight = new THREE.PointLight(0x00d2ff, 2.5, 8);
    this.thrusterLight.position.set(0, 0, -0.9);
    this.mesh.add(this.thrusterLight);

    this.mesh.visible = false;
    this.scene.add(this.mesh);
  }

  launch(playerPos) {
    this.isActive = true;
    this.flightTimer = 26.0; // 26 seconds active aerial support
    this.orbitAngle = Math.random() * Math.PI * 2;
    this.currentPos.copy(playerPos).add(new THREE.Vector3(0, 2.5, 0));
    this.mesh.position.copy(this.currentPos);
    this.mesh.visible = true;

    this.audioEngine.playFalconDroneLaunch();
    if (this.particles) {
      this.particles.emitSparks(playerPos, 15);
    }
  }

  update(delta, playerPos, horde) {
    if (!this.isActive) return;

    this.flightTimer -= delta;
    if (this.flightTimer <= 0) {
      this.clear();
      return;
    }

    if (this.fireCooldown > 0) {
      this.fireCooldown -= delta;
    }

    // Wing Flapping Animation
    const wingFlap = Math.sin(Date.now() * 0.015) * 0.15;
    this.leftWing.rotation.z = wingFlap;
    this.rightWing.rotation.z = -wingFlap;

    // Dive / Strafing AI Logic
    if (this.isDiving) {
      this.diveTimer -= delta;
      if (this.diveTarget && this.diveTarget.mesh) {
        const targetPos = this.diveTarget.mesh.position.clone().add(new THREE.Vector3(0, 1.2, 0));
        const toTarget = targetPos.sub(this.mesh.position);
        const dist = toTarget.length();

        if (dist > 3.0 && this.diveTimer > 0) {
          toTarget.normalize();
          this.mesh.position.addScaledVector(toTarget, 32.0 * delta);
          this.mesh.lookAt(this.mesh.position.clone().add(toTarget));

          // Fire dual plasma bolts mid-dive
          if (dist < 12.0 && this.fireCooldown <= 0) {
            this.firePlasmaStrafing(this.diveTarget, horde);
          }
        } else {
          // Pull up!
          this.isDiving = false;
          this.diveTarget = null;
        }
      } else {
        this.isDiving = false;
      }
    } else {
      // High-Altitude Orbit Patrol
      this.orbitAngle += 0.8 * delta;
      const targetPos = playerPos.clone().add(new THREE.Vector3(
        Math.cos(this.orbitAngle) * this.orbitRadius,
        this.cruiseAltitude + Math.sin(Date.now() * 0.003) * 1.5,
        Math.sin(this.orbitAngle) * this.orbitRadius
      ));

      const dir = targetPos.clone().sub(this.mesh.position);
      this.mesh.position.addScaledVector(dir, 6.0 * delta);

      // Look along orbit tangent
      const forwardDir = new THREE.Vector3(
        -Math.sin(this.orbitAngle),
        0,
        Math.cos(this.orbitAngle)
      ).normalize();
      this.mesh.lookAt(this.mesh.position.clone().add(forwardDir));

      // Scan for potential dive targets
      if (horde && horde.aliens && horde.aliens.length > 0 && this.fireCooldown <= 0) {
        let nearestAlien = null;
        let nearestDist = 35.0;
        horde.aliens.forEach(a => {
          if (a && a.mesh && a.hp > 0) {
            const d = a.mesh.position.distanceTo(playerPos);
            if (d < nearestDist) {
              nearestDist = d;
              nearestAlien = a;
            }
          }
        });

        if (nearestAlien && Math.random() < 0.6) {
          this.initiateDive(nearestAlien);
        }
      }
    }
  }

  initiateDive(target) {
    this.isDiving = true;
    this.diveTarget = target;
    this.diveTimer = 2.0;
    this.audioEngine.playFalconDiveScreech();
  }

  firePlasmaStrafing(target, horde) {
    this.fireCooldown = 1.2;
    this.audioEngine.playPlasmaShot();

    if (this.particles) {
      this.particles.emitSparks(this.mesh.position, 10);
    }

    if (target && target.mesh) {
      target.hp -= 150;
      if (this.particles) {
        this.particles.emitSparks(target.mesh.position, 15);
      }

      if (target.hp <= 0) {
        const idx = horde.aliens.indexOf(target);
        if (idx !== -1) {
          if (horde.goreEngine) {
            horde.goreEngine.spawnDismemberment(target.mesh.position, 'heavy');
          }
          horde.spawnAcidPool(target.mesh.position);
          this.scene.remove(target.mesh);
          horde.aliens.splice(idx, 1);
          horde.deadCount++;
        }
      }
    }
  }

  clear() {
    this.isActive = false;
    this.mesh.visible = false;
    this.isDiving = false;
    this.diveTarget = null;
  }
}
