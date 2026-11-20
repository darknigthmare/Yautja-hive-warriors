/* The two other ways a hunter reaches the field (author request of 15 Nov 2026).
 *
 * Scout ship: after Wolf's ship in Aliens vs. Predator: Requiem (2007), AvP Galaxy frames
 * avpr-bluray-0235/0236: a small dark ship with a single bright thruster at the rear and
 * prongs at the front "resembling petals on a flower", entering the atmosphere on a long
 * incandescent trail. In the film Wolf's arrival differs; dropping the hunter from a hover,
 * then leaving, is a game adaptation.
 *
 * Mothership beam: Alien vs. Predator (2004) shows the mothership's powerful blue beam
 * boring through the ice. Setting a hunter down inside that column is a game adaptation;
 * the film does not show it.
 *
 * Both share the capsule's interface (group, seatPosition, exitPosition, updateOpening) and
 * have no collision: the ship hovers above the hunter, the beam is light. Not 1:1 replicas. */
import * as THREE from 'three';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { loftGeometry, sweptLimb } from './SupportSculpt.js';
import { Assembly } from './SupportAssembly.js';

// High enough that a 4.3 m hunter hangs under the belly, then drops to the ground.
export const SCOUT_HOVER = 8.6;

export function createScoutShipModel() {
  const armor = createSurfaceMaterial('armor', { color: 0x30363a, finish: 'painted', repeat: [2, 2] });
  const dark = createSurfaceMaterial('metal', { color: 0x16191b, finish: 'matte', repeat: [2, 2] });
  const trim = createSurfaceMaterial('metal', { color: 0x7d858a, finish: 'bare', repeat: [2, 2] });
  const thrust = new THREE.MeshStandardMaterial({ color: 0xffe2b0, emissive: 0xffc070, emissiveIntensity: 2.4, roughness: .4 });
  for (const [name, material] of Object.entries({ armor, dark, trim, thrust })) material.name = `scout-${name}`;
  const parts = new Assembly('wolf-scout-ship');
  // Teardrop hull along Z: the nose (+Z) carries the petal prongs, the tail (-Z) the thruster.
  parts.add(loftGeometry([[-4.2, .55, .5], [-3.4, 1.15, .95], [-1.6, 1.55, 1.2], [.6, 1.5, 1.15], [2.4, 1.15, .9], [3.6, .6, .5], [4.1, .12, .1]], { axis: 'z', radial: 40, rows: 40, superellipse: 2.4 }), armor);
  for (let rib = 0; rib < 6; rib++) {
    const angle = rib / 6 * Math.PI * 2, x = Math.cos(angle), y = Math.sin(angle);
    parts.add(sweptLimb([[x * .56, y * .5, -4.1, .05], [x * 1.18, y * .98, -3.3, .07], [x * 1.58, y * 1.24, -1.4, .07], [x * 1.52, y * 1.18, .8, .06], [x * 1.16, y * .92, 2.4, .045]], 10, 22), rib % 3 ? dark : trim);
  }
  // Four curved prongs open around the nose like petals.
  for (let petal = 0; petal < 4; petal++) {
    const angle = Math.PI / 4 + petal * Math.PI / 2, x = Math.cos(angle), y = Math.sin(angle);
    parts.add(sweptLimb([[x * .7, y * .6, 3.2, .16, .07], [x * 1.25, y * 1.05, 4.3, .12, .05], [x * 1.45, y * 1.2, 5.3, .07, .03], [x * 1.2, y * 1.0, 6.0, .01, .01]], 12, 20), dark);
  }
  // Single rear thruster: a deep nozzle with its glowing core.
  parts.cylinder(dark, [0, 0, -4.35], [.62, .5], .6, [Math.PI / 2, 0, 0], 32);
  parts.add(new THREE.TorusGeometry(.58, .06, 8, 32), trim, [0, 0, -4.66]);
  parts.cylinder(thrust, [0, 0, -4.55], [.42, .42], .03, [Math.PI / 2, 0, 0], 32);
  // Belly hatch frame under the cabin.
  parts.box(trim, [0, -1.2, .1], [1.4, .06, 1.9], true);
  const group = new THREE.Group(); group.name = 'wolf-scout-ship';
  const visual = parts.finish(); visual.name = 'scout-visual'; visual.position.y = SCOUT_HOVER; group.add(visual);
  // Two belly plates swing down to release the hunter.
  const plates = [-1, 1].map(side => {
    const plate = new THREE.Mesh(new THREE.BoxGeometry(.66, .06, 1.8), armor); plate.name = 'scout-belly-plate';
    const pivot = new THREE.Group(); pivot.position.set(side * .7, SCOUT_HOVER - 1.24, .1); plate.position.x = -side * .33; pivot.add(plate); group.add(pivot);
    return { pivot, side };
  });
  const updateOpening = value => { const opening = THREE.MathUtils.clamp(Number(value) || 0, 0, 1); for (const { pivot, side } of plates) pivot.rotation.z = side * opening * Math.PI * .55; };
  updateOpening(0);
  group.userData.insertionVariant = { entry: 'scout', reference: 'Aliens vs. Predator: Requiem (2007), frames avpr-bluray-0235/0236, AvP Galaxy spacecraft page', fidelity1to1Verified: false };
  return { group, visual, thrust, updateOpening, setOpening: updateOpening, entry: 'scout', noCollision: true, cameraHeight: 6,
    seatPosition: new THREE.Vector3(0, SCOUT_HOVER - 1.3 - 4.4, .1), exitPosition: new THREE.Vector3(0, 0, 3.4),
    /** After the exit, the ship climbs, noses forward and leaves. */
    updateDeparture(seconds) { const t = Math.max(0, seconds); visual.position.set(0, SCOUT_HOVER + t * t * 2.2, t * t * 4); visual.rotation.x = -Math.min(.5, t * .25); } };
}

export function createBeamModel() {
  const column = new THREE.MeshBasicMaterial({ color: 0x1f78ff, transparent: true, opacity: 0, depthWrite: false, blending: THREE.AdditiveBlending, side: THREE.DoubleSide, fog: false });
  const core = column.clone(); core.color.set(0x7cc8ff);
  const ring = column.clone(); ring.color.set(0x7fd8ff);
  for (const [name, material] of Object.entries({ column, core, ring })) material.name = `beam-${name}`;
  const group = new THREE.Group(); group.name = 'mothership-beam';
  const outer = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 1.7, 160, 32, 1, true), column); outer.position.y = 80; outer.name = 'beam-column';
  const inner = new THREE.Mesh(new THREE.CylinderGeometry(.5, .35, 160, 16, 1, true), core); inner.position.y = 80; inner.name = 'beam-core';
  const ground = new THREE.Mesh(new THREE.RingGeometry(1.2, 3.6, 48), ring); ground.rotation.x = -Math.PI / 2; ground.position.y = .04; ground.name = 'beam-ground-ring';
  group.add(outer, inner, ground);
  const setPower = power => { const p = THREE.MathUtils.clamp(power, 0, 1); column.opacity = .2 * p; core.opacity = .5 * p; ring.opacity = .5 * p; ground.scale.setScalar(.6 + p * .4); };
  setPower(0);
  group.userData.insertionVariant = { entry: 'beam', reference: 'Alien vs. Predator (2004): the mothership’s blue beam bores the ice; carrying a hunter is an adaptation', fidelity1to1Verified: false };
  return { group, setPower, updateOpening() {}, entry: 'beam', noCollision: true, anchored: true,
    seatPosition: new THREE.Vector3(0, 7, 0), exitPosition: new THREE.Vector3(0, 0, 1.8) };
}
