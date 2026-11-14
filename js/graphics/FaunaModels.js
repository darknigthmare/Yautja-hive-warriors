/* Procedural fauna of the Ascension worlds (creations, not Bible V6 models): a quadruped
 * body scaled per species, with a bone crest for herd leaders and great prey. */
import * as THREE from 'three';

export function createFaunaModel({ color = 0x5b6b2f, size = 1, faint = false } = {}, { crest = false, prey = false } = {}) {
  const group = new THREE.Group(), s = size;
  const hide = new THREE.MeshStandardMaterial({ color, roughness: 0.85 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x1b1f10, roughness: 0.9 });
  const body = new THREE.Mesh(new THREE.BoxGeometry(0.9 * s, 0.7 * s, 1.8 * s), hide); body.position.y = 0.9 * s; group.add(body);
  const head = new THREE.Mesh(new THREE.BoxGeometry(0.6 * s, 0.5 * s, 0.7 * s), hide); head.position.set(0, 1.15 * s, 1.15 * s); group.add(head);
  for (const [x, z] of [[-0.35, 0.6], [0.35, 0.6], [-0.35, -0.6], [0.35, -0.6]]) {
    const leg = new THREE.Mesh(new THREE.CylinderGeometry(0.09 * s, 0.07 * s, 0.9 * s, 5), dark); leg.position.set(x * s, 0.45 * s, z * s); group.add(leg);
  }
  if (crest || prey) {
    const bone = new THREE.MeshStandardMaterial({ color: 0xd9d0b4, roughness: 0.6 });
    const ridge = new THREE.Mesh(new THREE.ConeGeometry(0.35 * s, 0.9 * s, 5), bone); ridge.position.set(0, 1.75 * s, 0.6 * s); ridge.rotation.x = -0.5; group.add(ridge);
    if (prey) for (const side of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(0.12 * s, 0.7 * s, 5), bone); horn.position.set(0.28 * s * side, 1.45 * s, 1.45 * s); horn.rotation.x = 1.1; group.add(horn); }
  }
  if (faint) group.traverse(node => { if (node.material) { node.material = node.material.clone(); node.material.transparent = true; node.material.opacity = 0.18; } });
  group.userData.fauna = true; group.userData.visualFidelity1to1Verified = false;
  return group;
}
