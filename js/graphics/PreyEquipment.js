import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';

export const PREY_LEVEL_ID = 'prey_comanche_territory';
// Human tools are an explicit crossover for the adapted kit. These authored
// silhouettes and game values are not scans or a verified 1:1 reproduction.
export const PREY_WEAPON_PROFILES = Object.freeze({
  taabe_bow: Object.freeze({ damage: .7, reach: 2.8, timing: 1.1, projectileDamage: 240, projectileRange: 72, cooldown: .9 }),
  naru_axe: Object.freeze({ damage: 1.1, reach: 3.5, timing: 1.08 })
});

function mesh(parent, geometry, material, name, position) {
  const part = new THREE.Mesh(geometry, material); part.name = name;
  if (position) part.position.set(...position);
  part.castShadow = true; part.receiveShadow = true; parent.add(part); return part;
}

function tube(parent, points, radius, material, name, segments = 48) {
  return mesh(parent, new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points.map(point => new THREE.Vector3(...point))), segments, radius, 10, false), material, name);
}

export function createPreyWeaponVisual(id) {
  if (!PREY_WEAPON_PROFILES[id]) throw new Error(`Unknown Prey tool: ${id}`);
  const group = new THREE.Group(); group.name = `prey-held-${id}`;
  group.userData = { equipmentId: id, definition: 'authored_gameplay_adaptation', fidelity1to1Verified: false };
  const wood = createSurfaceMaterial('bark', { color: 0x8b6744, repeat: [1, 3], roughness: .86 });
  const leather = createSurfaceMaterial('leather', { color: 0x574334, repeat: [2, 1] });
  const fiber = createSurfaceMaterial('bone', { color: 0xb7a784, roughness: .94 });
  if (id === 'taabe_bow') {
    // Grip at the origin, vertical limbs, tendon string behind the stave.
    tube(group, [[0,-1.24,.13],[0,-.98,-.05],[0,-.54,-.17],[0,0,0],[0,.54,-.17],[0,.98,-.05],[0,1.24,.13]], .045, wood, 'wooden-bow-stave', 80);
    tube(group, [[0,-1.24,.13],[0,0,.19],[0,1.24,.13]], .009, fiber, 'tendon-bowstring', 24);
    for (let i = 0; i < 16; i++) {
      const wrap = mesh(group, new THREE.TorusGeometry(.052, .008, 5, 16), leather, 'bound-bow-grip', [0, -.16 + i * .021, .005]);
      wrap.rotation.x = Math.PI / 2;
    }
    for (const side of [-1, 1]) mesh(group, new THREE.SphereGeometry(.053, 12, 8), fiber, 'reinforced-string-nock', [0, side * 1.24, .13]);
  } else {
    tube(group, [[0,-.38,.01],[.015,0,0],[.025,.34,-.035],[.065,.66,-.06]], .043, wood, 'carved-tomahawk-haft', 36);
    const head = new THREE.Shape();
    head.moveTo(-.09,.48); head.lineTo(.13,.48); head.lineTo(.42,.54); head.lineTo(.45,.78); head.lineTo(.15,.82); head.lineTo(-.1,.73); head.closePath();
    const blade = mesh(group, new THREE.ExtrudeGeometry(head, { depth: .075, bevelEnabled: true, bevelSegments: 3, steps: 1, bevelSize: .024, bevelThickness: .014 }), createSurfaceMaterial('stone', { color: 0x66655c, roughness: .7 }), 'flaked-tomahawk-head', [0,0,-.09]);
    blade.geometry.computeVertexNormals();
    for (let i = 0; i < 9; i++) {
      const wrap = mesh(group, new THREE.TorusGeometry(.057, .009, 5, 16), leather, 'haft-binding', [.04,.43+i*.026,-.04]); wrap.rotation.x = Math.PI / 2;
    }
    const coil = [];
    for (let i = 0; i <= 80; i++) { const angle = i / 80 * Math.PI * 7; coil.push([.11*Math.cos(angle), -.25 + i*.002, .11*Math.sin(angle)]); }
    tube(group, coil, .012, fiber, 'coiled-retrieval-tether', 100);
    tube(group, [[.1,-.24,0],[.22,-.5,.02],[.15,-.68,.04],[0,-.55,.06]], .012, fiber, 'secured-wrist-tether', 28);
  }
  return group;
}

export function createPreyArrowMesh() {
  // One owned Mesh, aligned with local +Z, so the projectile cleanup releases
  // all geometry/materials exactly as it does for the other solid projectiles.
  const pieces = [];
  const add = (geometry, color, transform) => {
    const source = geometry.index ? geometry.toNonIndexed() : geometry;
    if (source !== geometry) geometry.dispose();
    if (transform) source.applyMatrix4(transform);
    const rgb = new THREE.Color(color), colors = new Float32Array(source.attributes.position.count * 3);
    for (let i = 0; i < colors.length; i += 3) { colors[i] = rgb.r; colors[i+1] = rgb.g; colors[i+2] = rgb.b; }
    source.setAttribute('color', new THREE.BufferAttribute(colors, 3)); pieces.push(source);
  };
  const shaft = new THREE.CylinderGeometry(.018,.022,1.45,10); shaft.rotateX(Math.PI/2); add(shaft,0x9a7848);
  const tip = new THREE.ConeGeometry(.075,.24,4); tip.rotateX(Math.PI/2); tip.translate(0,0,.83); add(tip,0x77776a);
  for (let i = 0; i < 3; i++) {
    const feather = new THREE.BoxGeometry(.006,.11,.27); feather.translate(0,.055,-.55); feather.rotateZ(i*Math.PI*2/3); add(feather,0xb9b3a2);
  }
  const geometry = mergeGeometries(pieces); pieces.forEach(piece => piece.dispose());
  const arrow = new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({vertexColors:true,roughness:.84,metalness:.02}));
  arrow.name='taabe-wooden-arrow'; arrow.castShadow=true; arrow.userData.projectileKind='taabe_arrow'; return arrow;
}
