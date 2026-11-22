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

/** AUD-026/031: a clan cell leader reads without colour — a long cloak on the back and a trophy
 * totem rising above the right shoulder. Visual only; added in world units under the model scale. */
export function decorateClanOfficer(mesh) {
  if (!mesh || mesh.getObjectByName('clan-officer-mark')) return false;
  const scale = mesh.scale?.x || 1, group = new THREE.Group(); group.name = 'clan-officer-mark'; group.scale.setScalar(1 / scale);
  const hide = new THREE.MeshStandardMaterial({ color: 0x3b2a20, roughness: .95 }), bone = new THREE.MeshStandardMaterial({ color: 0xc8b48a, roughness: .55 });
  const cloak = new THREE.Mesh(new THREE.BoxGeometry(1.4, 2.7, .08), hide); cloak.position.set(0, 2.2, -.75); cloak.rotation.x = .28; group.add(cloak);
  for (const side of [-1, 1]) {
    const trophy = new THREE.Mesh(new THREE.ConeGeometry(.12, .9, 8), bone); trophy.position.set(side * .95, 3.35, 0); trophy.rotation.z = -side * 1.15; group.add(trophy);
    const pauldron = new THREE.Mesh(new THREE.SphereGeometry(.26, 10, 8), bone); pauldron.scale.set(1.2, .7, 1); pauldron.position.set(side * .68, 3.2, 0); group.add(pauldron);
  }
  const pole = new THREE.Mesh(new THREE.CylinderGeometry(.05, .05, 2.2, 8), bone); pole.position.set(.42, 3.7, -.42); group.add(pole);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.22, 12, 10), bone); skull.scale.set(1, .85, 1.25); skull.position.set(.42, 4.85, -.42); group.add(skull);
  for (const side of [-1, 1]) { const horn = new THREE.Mesh(new THREE.ConeGeometry(.06, .45, 8), bone); horn.position.set(.42 + side * .2, 5.05, -.42); horn.rotation.z = -side * .6; group.add(horn); }
  mesh.add(group); return true;
}
