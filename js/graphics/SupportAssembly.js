/* Shared support mesh batching; each finished actor owns its buffers. */
import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';

export class Assembly {
  constructor(name) { this.name = name; this.parts = new Map(); }
  add(geometry, material, position = [0, 0, 0], scale = [1, 1, 1], rotation = [0, 0, 0]) {
    const transform = new THREE.Matrix4().compose(new THREE.Vector3(...position), new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)), new THREE.Vector3(...scale));
    const prepared = geometry.index ? geometry.toNonIndexed() : geometry.clone();
    geometry.dispose();
    prepared.applyMatrix4(transform);
    if (!this.parts.has(material)) this.parts.set(material, []);
    this.parts.get(material).push(prepared);
    return this;
  }
  box(material, position, size, rounded = false, rotation = [0, 0, 0]) {
    const geometry = rounded ? new RoundedBoxGeometry(1, 1, 1, 3, 0.14) : new THREE.BoxGeometry(1, 1, 1);
    return this.add(geometry, material, position, size, rotation);
  }
  sphere(material, position, scale, segments = 28) {
    const radius = Math.max(...scale);
    const widthSegments = radius < 0.08 ? 12 : radius < 0.2 ? 20 : Math.max(24, segments);
    const heightSegments = radius < 0.08 ? 8 : radius < 0.2 ? 12 : 20;
    return this.add(new THREE.SphereGeometry(1, widthSegments, heightSegments), material, position, scale);
  }
  cylinder(material, position, radii, height, rotation = [0, 0, 0], segments = 24) {
    return this.add(new THREE.CylinderGeometry(radii[0], radii[1], height, Math.max(16, segments)), material, position, [1, 1, 1], rotation);
  }
  bone(material, from, to, radius, endRadius = radius * 0.9, segments = 10) {
    const a = new THREE.Vector3(...from), b = new THREE.Vector3(...to), direction = b.clone().sub(a);
    const quaternion = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());
    return this.add(new THREE.CylinderGeometry(endRadius, radius, direction.length(), segments), material, a.clone().add(b).multiplyScalar(0.5).toArray(), [1, 1, 1], new THREE.Euler().setFromQuaternion(quaternion).toArray().slice(0, 3));
  }
  tube(material, points, radius, segments = 20, radialSegments = 10) {
    return this.add(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(p => new THREE.Vector3(...p))), segments, radius, radialSegments, false), material);
  }
  finish() {
    const group = new THREE.Group(); group.name = this.name;
    for (const [material, parts] of this.parts) {
      const geometry = mergeGeometries(parts, false);
      parts.forEach(part => part.dispose());
      geometry.computeBoundingSphere();
      const mesh = new THREE.Mesh(geometry, material);
      mesh.castShadow = true; mesh.receiveShadow = true;
      mesh.name = `${this.name}-${material.name || 'surface'}`;
      group.add(mesh);
    }
    this.parts.clear();
    return group;
  }
}

