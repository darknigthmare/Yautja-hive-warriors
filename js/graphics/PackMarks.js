/* Distinctive marks of the Unblooded pack (campagne-unblooded.md §3), added to the shared clan
 * hunter model: Harek's red war marks, Yena's combistick on her back, Tov's coiled ropes.
 * Creations of Hive Warriors, not Bible V6 models. */
import * as THREE from 'three';

export function decorateCompanion(mesh, name) {
  if (!mesh || !name || mesh.getObjectByName(`pack-mark-${name}`)) return false;
  const group = new THREE.Group(); group.name = `pack-mark-${name}`;
  if (name === 'Harek') {
    const paint = new THREE.MeshStandardMaterial({ color: 0xb3261e, emissive: 0x3a0806, roughness: .7 });
    for (const side of [-1, 1]) { const stripe = new THREE.Mesh(new THREE.BoxGeometry(.08, .5, .06), paint); stripe.position.set(side * .32, 2.3, .28); stripe.rotation.z = side * .35; group.add(stripe); }
    const band = new THREE.Mesh(new THREE.TorusGeometry(.2, .035, 6, 14), paint); band.position.set(.42, 1.95, 0); band.rotation.y = Math.PI / 2; group.add(band);
  } else if (name === 'Yena') {
    const metal = new THREE.MeshStandardMaterial({ color: 0x8a8f94, metalness: .7, roughness: .35 });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, 2.4, 8), metal); shaft.position.set(0, 2, -.35); shaft.rotation.z = .55; group.add(shaft);
    for (const end of [-1, 1]) { const tip = new THREE.Mesh(new THREE.ConeGeometry(.07, .3, 6), metal); tip.position.set(end * .62, 2 + end * 1.03, -.35); tip.rotation.z = end > 0 ? .55 : .55 + Math.PI; group.add(tip); }
  } else if (name === 'Tov') {
    const rope = new THREE.MeshStandardMaterial({ color: 0x8b6d45, roughness: .95 });
    for (let turn = 0; turn < 3; turn++) { const coil = new THREE.Mesh(new THREE.TorusGeometry(.26 - turn * .02, .03, 6, 18), rope); coil.position.set(-.42, 1.15 + turn * .07, 0); coil.rotation.y = Math.PI / 2; group.add(coil); }
  } else return false;
  group.userData.visualFidelity1to1Verified = false;
  mesh.add(group); return true;
}
