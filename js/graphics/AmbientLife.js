/* Ambient life per biome (spec 003, US4): decoration only. Nothing here collides, can be hit,
 * is counted or appears on a tracker; it never stands in for an actor of the simulation (the
 * Ascension fauna are real horde actors, these are not). Birds and bats weave low over the field,
 * in view of the third-person camera, and climb out of sight when a fight comes close; fireflies drift around the hunter; searchlights sweep the
 * LA skyline; emergency beacons blink in stations. One instanced mesh or one point cloud per
 * effect, a few draw calls in all, disposed with the mission. */
import * as THREE from 'three';

export const AMBIENT_LIFE = Object.freeze({
  jungle:  { flock: { count: 22, height: 7, radius: 26, color: 0x1a1a14, size: .9 }, fireflies: { count: 90, color: 0xd9ff7a } },
  plains:  { flock: { count: 16, height: 8, radius: 32, color: 0x221d18, size: 1.1 }, fireflies: { count: 40, color: 0xffe9a0 } },
  rain:    { flock: { count: 18, height: 6, radius: 22, color: 0x0d0d10, size: .7, bats: true } },
  city:    { searchlights: 4, beacons: { color: 0xff2230, height: [5, 7], at: 'landmarks' } },
  station: { beacons: { color: 0xff6a10, height: [4, 5.5], at: 'landmarks' } },
  hive: {}, snow: {}, arena: {}, ship: {}
});

/** Danger from 0 to 1 makes a flock climb and widen; returns the flock's altitude and radius gain. */
export function flockResponse(danger) {
  const value = Math.max(0, Math.min(1, Number(danger) || 0));
  return { lift: value * 22, spread: 1 + value * .8 };
}

export class AmbientLife {
  constructor(scene) { this.scene = scene; this.root = null; this.time = 0; this.danger = 0; }

  start(biome, { layout = null, focus = new THREE.Vector3(), reducedMotion = false } = {}) {
    this.clear();
    const profile = AMBIENT_LIFE[biome] ?? {};
    this.root = new THREE.Group(); this.root.name = 'ambient-life'; this.root.userData.decorationOnly = true;
    this.scene.add(this.root); this.disposables = []; this.reducedMotion = reducedMotion; this.focus = focus.clone();
    if (profile.flock) this._flock(profile.flock);
    if (profile.fireflies) this._fireflies(profile.fireflies);
    if (profile.searchlights) this._searchlights(profile.searchlights, layout);
    if (profile.beacons) this._beacons(profile.beacons, layout);
    return this.root.children.length;
  }

  _keep(...items) { this.disposables.push(...items); return items[0]; }

  _flock({ count, height, radius, color, size, bats = false }) {
    // Two wing triangles meeting at the body; the flap is a per-instance scale on Y.
    const geometry = this._keep(new THREE.BufferGeometry());
    geometry.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, .25, -1, .05, -.2, 0, 0, -.35, 0, 0, .25, 0, 0, -.35, 1, .05, -.2], 3));
    geometry.computeVertexNormals();
    const material = this._keep(new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, fog: true }));
    const mesh = new THREE.InstancedMesh(geometry, material, count); mesh.frustumCulled = false; mesh.name = bats ? 'ambient-bats' : 'ambient-birds';
    this.root.add(mesh);
    this.flock = { mesh, count, height, radius, size, bats, center: this.focus.clone(),
      birds: Array.from({ length: count }, (_, i) => ({ phase: i / count * Math.PI * 2, ring: .55 + (i % 5) * .11, speed: (bats ? .45 : .22) * (.85 + (i % 3) * .12), bob: Math.random() * 6, flap: Math.random() * 6 })) };
  }

  _fireflies({ count, color }) {
    const positions = new Float32Array(count * 3);
    this.fireflySeeds = Array.from({ length: count }, () => [Math.random() * 40 - 20, .4 + Math.random() * 2.6, Math.random() * 40 - 20, Math.random() * 6]);
    const geometry = this._keep(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const material = this._keep(new THREE.PointsMaterial({ color, size: .14, transparent: true, opacity: .85, depthWrite: false, blending: THREE.AdditiveBlending }));
    this.fireflies = new THREE.Points(geometry, material); this.fireflies.frustumCulled = false; this.fireflies.name = 'ambient-fireflies'; this.root.add(this.fireflies);
  }

  _anchors(layout, count, inset = 4) {
    const sectors = layout?.sectors ?? [];
    if (!sectors.length) return Array.from({ length: count }, (_, i) => [Math.cos(i) * 60, Math.sin(i) * 60]);
    const points = [];
    // Spread along each sector's walls, not only at its corners.
    const perSector = Math.max(1, Math.ceil(count / sectors.length));
    for (let i = 0; i < count; i++) {
      const b = sectors[i % sectors.length].bounds, k = Math.floor(i / sectors.length), t = ((k + .5) / perSector) * 4;
      const side = Math.floor(t) % 4, f = t % 1, x0 = b.minX + inset, x1 = b.maxX - inset, z0 = b.minZ + inset, z1 = b.maxZ - inset;
      points.push(side === 0 ? [x0 + (x1 - x0) * f, z0] : side === 1 ? [x1, z0 + (z1 - z0) * f] : side === 2 ? [x1 - (x1 - x0) * f, z1] : [x0, z1 - (z1 - z0) * f]);
    }
    return points;
  }

  /** Gate frames (both posts) and each sector's objective: the places a player actually passes. */
  _landmarks(layout) {
    const points = [];
    for (const gate of layout?.gates ?? []) {
      const b = gate.bounds, alongX = gate.axis === 'z';
      if (alongX) points.push([b.minX - .6, gate.center[1]], [b.maxX + .6, gate.center[1]]);
      else points.push([gate.center[0], b.minZ - .6], [gate.center[0], b.maxZ + .6]);
    }
    for (const sector of layout?.sectors ?? []) {
      const position = sector.objective?.position; if (!position) continue;
      for (const [dx, dz] of [[3, 3], [-3, -3]]) points.push([position[0] + dx, position[1] + dz]);
    }
    return points;
  }

  _beacons({ count, color, height, at }, layout) {
    // A glowing halo reads from 80 m away. Normal blending: an additive glow vanishes over a bright station floor.
    const canvas = globalThis.document?.createElement?.('canvas');
    let texture = null;
    if (canvas?.getContext) {
      canvas.width = canvas.height = 64; const g = canvas.getContext('2d');
      const gradient = g.createRadialGradient(32, 32, 0, 32, 32, 32); gradient.addColorStop(0, 'rgba(255,255,255,1)'); gradient.addColorStop(.25, 'rgba(255,255,255,.75)'); gradient.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gradient; g.fillRect(0, 0, 64, 64); texture = this._keep(new THREE.CanvasTexture(canvas));
    }
    // Two point clouds (one per blink phase): two draw calls for every beacon of the map.
    const anchors = at === 'landmarks' ? this._landmarks(layout) : this._anchors(layout, count);
    if (!anchors.length) return;
    this.beaconMaterials = [0, 1].map(phase => {
      const material = this._keep(new THREE.PointsMaterial({ color, map: texture, size: 1.8, sizeAttenuation: true, transparent: true, opacity: 1, depthWrite: false, fog: true }));
      const positions = anchors.filter((_, i) => i % 2 === phase).flatMap(([x, z], i) => [x, height[0] + ((i * 2 + phase) * 7.3 % 1) * (height[1] - height[0]), z]);
      const geometry = this._keep(new THREE.BufferGeometry()); geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
      const points = new THREE.Points(geometry, material); points.name = 'ambient-beacon'; points.frustumCulled = false; this.root.add(points);
      return material;
    });
  }

  _searchlights(count, layout) {
    // Tip on the ground, opening upward into the sky.
    const cone = this._keep(new THREE.ConeGeometry(4.5, 90, 18, 1, true)); cone.rotateX(Math.PI); cone.translate(0, 45, 0);
    const material = this._keep(new THREE.MeshBasicMaterial({ color: 0xcfe2ff, transparent: true, opacity: .16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false }));
    this.searchlights = this._anchors(layout, count, -18).map(([x, z], i) => {
      const beam = new THREE.Mesh(cone, material); beam.position.set(x, 4, z); beam.name = 'ambient-searchlight';
      beam.userData = { phase: i * 2.1, tilt: .5 + i * .08 }; this.root.add(beam); return beam;
    });
  }

  /** Danger from 0 to 1 (the music's danger) lifts and widens the flock. */
  update(delta, focus, danger = 0) {
    if (!this.root) return;
    this.time += delta; this.danger += (danger - this.danger) * Math.min(1, delta * 1.5);
    const calm = this.reducedMotion;
    if (this.flock) {
      const f = this.flock, response = flockResponse(this.danger), matrix = new THREE.Matrix4(), quaternion = new THREE.Quaternion(), position = new THREE.Vector3(), scale = new THREE.Vector3();
      if (focus) f.center.lerp(focus, Math.min(1, delta * .05));
      f.birds.forEach((bird, i) => {
        const angle = bird.phase + this.time * bird.speed * (1 + this.danger * .8), r = f.radius * bird.ring * response.spread;
        position.set(f.center.x + Math.cos(angle) * r, f.height + response.lift + Math.sin(this.time * .4 + bird.bob) * 1.5, f.center.z + Math.sin(angle) * r);
        quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), -angle);
        const flap = calm ? .6 : .35 + Math.abs(Math.sin(this.time * (f.bats ? 14 : 7) + bird.flap)) * .9;
        scale.set(f.size, f.size * flap, f.size); matrix.compose(position, quaternion, scale); f.mesh.setMatrixAt(i, matrix);
      });
      f.mesh.instanceMatrix.needsUpdate = true;
    }
    if (this.fireflies && focus) {
      const array = this.fireflies.geometry.attributes.position.array;
      this.fireflySeeds.forEach(([x, y, z, seed], i) => {
        array[i * 3] = focus.x + x + Math.sin(this.time * .3 + seed) * 1.5;
        array[i * 3 + 1] = y + Math.sin(this.time * .7 + seed * 2) * .4;
        array[i * 3 + 2] = focus.z + z + Math.cos(this.time * .25 + seed) * 1.5;
      });
      this.fireflies.geometry.attributes.position.needsUpdate = true;
      this.fireflies.material.opacity = .55 + Math.sin(this.time * 2.2) * .3;
    }
    if (this.beaconMaterials) this.beaconMaterials.forEach((material, i) => { material.opacity = calm ? .8 : (Math.sin(this.time * 3.2 + i * Math.PI) > .2 ? 1 : .15); });
    for (const beam of this.searchlights ?? []) {
      const { phase, tilt } = beam.userData; beam.rotation.set(Math.sin(this.time * .23 + phase) * tilt, 0, Math.cos(this.time * .17 + phase) * tilt);
    }
  }

  clear() {
    if (this.root) this.scene.remove(this.root);
    for (const item of this.disposables ?? []) item.dispose?.();
    this.root = null; this.disposables = []; this.flock = null; this.fireflies = null; this.fireflySeeds = null; this.beaconMaterials = null; this.searchlights = null; this.danger = 0;
  }
}
