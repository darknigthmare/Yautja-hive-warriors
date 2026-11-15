/* Actor-owned temporary equipment visuals. Anchors follow the actual rendered
 * rig; all clocks are simulation seconds and every new GPU resource is private.
 * The projected countdown is a local effect, not a recovered film mechanism. */
import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import { createSkullTrophy } from './SupportModels.js';
import { createSurfaceMaterial } from './SurfaceLibrary.js';
import { CITY_HUNTER_CONSOLE } from './CityHunterMechanismsCalibration.js';
import { sculptCreature } from './CreatureSculpt.js';

const COUNTDOWN_SECONDS = 6;
const TROPHY_SECONDS = 3.5;
const UP = new THREE.Vector3(0, 1, 0);
const FORWARD = new THREE.Vector3(0, 0, 1);
const closeRotation = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-10;
const finiteDuration = (value, maximum) => Number.isFinite(value) && value > 0 && value <= maximum;

function textureAtlas() {
  // Seven separate etched countdown signs. Their index follows the remaining
  // simulation second; there is no browser font or provider image dependency.
  const signs = [
    ['11111','10001','10101','10101','10001','11111','00000','00100','11111'],
    ['00100','00100','11100','00100','00100','00100','00100','00100','11111'],
    ['11110','00010','11010','10010','11110','10000','10000','10000','11111'],
    ['11110','00010','11010','00010','11110','00010','00010','00010','11110'],
    ['10010','10010','10010','11111','00010','00010','11010','00010','00010'],
    ['11111','10000','10110','10000','11110','00010','00010','00010','11110'],
    ['11111','10000','10100','10000','11110','10010','10110','10010','11110']
  ];
  const width = 256, height = 64, bytes = new Uint8Array(width * height * 4);
  signs.forEach((rows, sign) => rows.forEach((row, y) => [...row].forEach((pixel, x) => {
    if (pixel !== '1') return;
    for (let dy = 0; dy < 4; dy++) for (let dx = 0; dx < 4; dx++) {
      const at = ((10 + y * 5 + dy) * width + sign * 32 + 6 + x * 4 + dx) * 4;
      bytes[at] = bytes[at + 1] = bytes[at + 2] = bytes[at + 3] = 255;
    }
  })));
  const texture = new THREE.DataTexture(bytes, width, height);
  texture.name = 'hunter-countdown-local-signs'; texture.colorSpace = THREE.SRGBColorSpace;
  texture.magFilter = THREE.LinearFilter; texture.minFilter = THREE.LinearFilter;
  texture.generateMipmaps = false; texture.needsUpdate = true;
  return texture;
}

function ownEffect(root, extraTextures = []) {
  root.userData.playerTransientEffect = true;
  const geometries = new Set(), materials = new Set();
  root.traverse(node => {
    if (!node.isMesh && !node.isLine) return;
    if (node.geometry) geometries.add(node.geometry);
    for (const material of Array.isArray(node.material) ? node.material : [node.material]) if (material) materials.add(material);
  });
  return { root, geometries, materials, textures: new Set(extraTextures), elapsed: 0, released: false };
}

function release(effect) {
  if (!effect || effect.released) return;
  effect.released = true; effect.root.removeFromParent();
  effect.geometries.forEach(value => value.dispose());
  effect.materials.forEach(value => value.dispose());
  effect.textures.forEach(value => value.dispose());
}

function buildCountdown() {
  const root = new THREE.Group(); root.name = 'hunter-wrist-countdown-effect';
  const atlas = textureAtlas();
  const glow = new THREE.MeshBasicMaterial({ color: 0xff5938, map: atlas, transparent: true, opacity: 0.94,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const line = new THREE.MeshBasicMaterial({ color: 0xff482b, transparent: true, opacity: 0.7,
    depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false });
  const glass = new THREE.MeshBasicMaterial({ color: 0x1d0704, transparent: true, opacity: 0.32,
    depthWrite: false, side: THREE.DoubleSide });
  const backing = new THREE.Mesh(new THREE.PlaneGeometry(0.46, 0.24), glass); backing.position.z = -0.006;
  backing.name = 'countdown-projection-plane'; root.add(backing);
  const glyph = new THREE.Mesh(new THREE.PlaneGeometry(0.15, 0.22), glow);
  glyph.name = 'countdown-remaining-sign'; root.add(glyph);
  const arc = new THREE.Mesh(new THREE.RingGeometry(0.158, 0.166, 64), line);
  arc.position.z = 0.002; arc.name = 'countdown-progress-arc'; root.add(arc);
  // Flanking marks keep the display visually distinct from floating numerals.
  const marks = [];
  for (const side of [-1, 1]) for (let row = 0; row < 3; row++) {
    const geometry = new THREE.BoxGeometry(0.04 + row % 2 * 0.025, 0.009, 0.002);
    geometry.translate(side * 0.2, (row - 1) * 0.044, 0.001); marks.push(geometry);
  }
  const merged = mergeGeometries(marks, false); marks.forEach(value => value.dispose());
  const rails = new THREE.Mesh(merged, line); rails.name = 'countdown-calibration-marks'; root.add(rails);
  const effect = ownEffect(root, [atlas]);
  Object.assign(effect, { duration: COUNTDOWN_SECONDS, glyph, arc, glow, line, glass, displaySecond: -1, mechanism: null });
  return effect;
}

function trophyFamily(kind) {
  const value = typeof kind === 'string' ? kind.toLowerCase() : 'human';
  if (/queen|empress|royal|matriarch/.test(value)) return 'queen';
  if (/engineer|offspring/.test(value)) return 'engineer';
  if (/human|marine|synthetic/.test(value)) return 'human';
  return 'warrior';
}

function filteredHeadTeeth(geometry, minimumY) {
  const vertices = geometry.attributes.position, selected = [];
  const count = geometry.index?.count ?? vertices.count;
  for (let start = 0; start < count; start += 3) {
    const ids = [0, 1, 2].map(corner => geometry.index?.getX(start + corner) ?? start + corner);
    if (ids.every(vertex => vertices.getY(vertex) >= minimumY)) selected.push(...ids);
  }
  const result = new THREE.BufferGeometry();
  for (const [name, attribute] of Object.entries(geometry.attributes)) {
    const values = new Float32Array(selected.length * attribute.itemSize);
    selected.forEach((vertex, at) => { for (let component = 0; component < attribute.itemSize; component++) values[at * attribute.itemSize + component] = attribute.getComponent(vertex, component); });
    result.setAttribute(name, new THREE.BufferAttribute(values, attribute.itemSize));
  }
  result.computeBoundingBox(); result.computeBoundingSphere(); return result;
}

function buildWarriorSkull(bone) {
  // Reuse this game's elongated cranium and actual head teeth, never its hand
  // or foot claws. These fresh procedural surfaces belong solely to the prop.
  const sculpt = sculptCreature('warrior', 0.7), skull = new THREE.Group();
  const cranium = sculpt.parts.find(part => part.name === 'cranium');
  cranium.geometry.computeBoundingBox();
  const bounds = cranium.geometry.boundingBox, center = bounds.getCenter(new THREE.Vector3());
  const tooth = createSurfaceMaterial('bone', { color: 0xbfc3ae, roughness: 0.56, metalness: 0.03 });
  const cavity = createSurfaceMaterial('bone', { color: 0x171d1b, roughness: 0.85, metalness: 0.01 });
  for (const part of sculpt.parts) {
    if (!['cranium', 'teeth-and-claws', 'mouth-cavities'].includes(part.name)) { part.geometry.dispose(); continue; }
    const geometry = part.name === 'teeth-and-claws' ? filteredHeadTeeth(part.geometry, bounds.min.y - 0.12) : part.geometry;
    if (geometry !== part.geometry) part.geometry.dispose();
    geometry.translate(-center.x, -center.y, -center.z);
    const mesh = new THREE.Mesh(geometry, part.name === 'mouth-cavities' ? cavity : part.name === 'teeth-and-claws' ? tooth : bone);
    mesh.name = `execution-warrior-${part.name}`; mesh.castShadow = mesh.receiveShadow = true; skull.add(mesh);
  }
  return skull;
}

function buildTrophy(kind) {
  const family = trophyFamily(kind);
  const root = new THREE.Group(); root.name = 'hunter-spine-trophy-effect';
  root.userData.victimKind = kind; root.userData.trophyFamily = family;
  const bone = createSurfaceMaterial('bone', { color: family === 'warrior' || family === 'queen' ? 0x747b70 : 0xd6c4a1, roughness: 0.68, metalness: 0.01 });
  bone.name = 'execution-trophy-private-bone';
  const skull = family === 'warrior' ? buildWarriorSkull(bone) : createSkullTrophy(family, bone);
  skull.name = 'execution-anatomical-skull'; skull.userData.trophyFamily = family;
  skull.scale.setScalar(family === 'warrior' ? 0.62 : family === 'queen' ? 0.43 : 0.43);
  skull.position.set(0, family === 'queen' ? 0.2 : 0.22, 0);
  root.add(skull);
  const dark = new THREE.MeshStandardMaterial({ color: 0x3f1711, roughness: 0.82, metalness: 0.02 });
  dark.name = 'execution-trophy-private-disc';
  const vertebrae = [], discs = [];
  for (let joint = 0; joint < 9; joint++) {
    const y = -0.08 - joint * 0.1, width = 0.048 + joint * 0.0015;
    const core = new THREE.CylinderGeometry(width, width * 0.92, 0.064, 12); core.translate(0, y, 0); vertebrae.push(core);
    const arch = new THREE.TorusGeometry(width * 0.94, 0.014, 6, 14, Math.PI * 1.5);
    arch.rotateX(Math.PI / 2); arch.translate(0, y, -0.035); vertebrae.push(arch);
    for (const side of [-1, 1]) {
      const process = new THREE.ConeGeometry(0.021, width * 1.9, 7);
      process.rotateZ(-side * Math.PI / 2); process.translate(side * width * 1.3, y, -0.012); vertebrae.push(process);
    }
    const posterior = new THREE.ConeGeometry(0.022, 0.083, 7); posterior.rotateX(-Math.PI / 2);
    posterior.translate(0, y, -0.071); vertebrae.push(posterior);
    if (joint < 8) {
      const disc = new THREE.CylinderGeometry(width * 0.91, width * 0.91, 0.025, 12); disc.translate(0, y - 0.048, 0); discs.push(disc);
    }
  }
  for (const [name, pieces, material] of [['vertebrae', vertebrae, bone], ['discs', discs, dark]]) {
    const geometry = mergeGeometries(pieces, false); pieces.forEach(value => value.dispose());
    const mesh = new THREE.Mesh(geometry, material); mesh.name = `execution-trophy-${name}`;
    mesh.castShadow = mesh.receiveShadow = true; root.add(mesh);
  }
  const effect = ownEffect(root);
  Object.assign(effect, { duration: TROPHY_SECONDS, family, victimKind: kind, pose: null }); return effect;
}

function localPoint(owner, object, point = new THREE.Vector3()) {
  object.updateWorldMatrix(true, false);
  return owner.mesh.worldToLocal(point.clone().applyMatrix4(object.matrixWorld));
}

function localAxis(owner, object, axis) {
  object.updateWorldMatrix(true, false);
  const inverse = owner.mesh.matrixWorld.clone().invert();
  return axis.clone().transformDirection(object.matrixWorld).transformDirection(inverse).normalize();
}

function frameFromAxes(position, x, y, z, kind, source) {
  return { position, quaternion: new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(x, y, z)).normalize(), kind, source };
}

function countdownFrame(owner) {
  const imported = owner._importedCharacter, mechanism = imported?.mechanisms;
  if (mechanism?.consoleRoot?.parent && mechanism.diagnostics?.sourceSha256 === CITY_HUNTER_CONSOLE.sourceSha256) {
    const measured = CITY_HUNTER_CONSOLE, board = mechanism.consoleRoot;
    const native = new THREE.Vector3(...measured.center)
      .addScaledVector(new THREE.Vector3(...measured.u), measured.interior.u)
      .addScaledVector(new THREE.Vector3(...measured.v), measured.interior.v)
      .addScaledVector(new THREE.Vector3(...measured.n), measured.interior.n - 0.0042);
    const x = localAxis(owner, board, new THREE.Vector3(...measured.u).negate());
    const y = localAxis(owner, board, new THREE.Vector3(...measured.v));
    const z = localAxis(owner, board, new THREE.Vector3(...measured.n).negate());
    return frameFromAxes(localPoint(owner, board, native).addScaledVector(z, 0.12), x, y, z, 'measured-city-console', board);
  }
  const bones = imported?.adapter?.bones;
  if (bones?.leftHand && bones?.leftForeArm) {
    const wrist = localPoint(owner, bones.leftHand), elbow = localPoint(owner, bones.leftForeArm);
    const y = elbow.clone().sub(wrist).normalize();
    if (y.lengthSq() < 1e-8) y.copy(UP);
    const z = FORWARD.clone().projectOnPlane(y);
    if (z.lengthSq() < 1e-8) z.copy(UP).projectOnPlane(y);
    z.normalize(); const x = y.clone().cross(z).normalize();
    return frameFromAxes(elbow.lerp(wrist, 0.76).addScaledVector(z, 0.16), x, y, z, 'mapped-left-forearm', bones.leftForeArm);
  }
  const arm = owner.leftArm;
  return frameFromAxes(localPoint(owner, arm, new THREE.Vector3(-0.035, -0.995, 0.31)),
    localAxis(owner, arm, new THREE.Vector3(1, 0, 0)), localAxis(owner, arm, UP), localAxis(owner, arm, FORWARD), 'procedural-left-gauntlet', arm);
}

function trophyFrame(owner, elapsed) {
  const hand = owner._importedCharacter?.adapter?.sockets?.rightHand ?? owner._importedCharacter?.adapter?.bones?.rightHand;
  const position = hand ? localPoint(owner, hand) : localPoint(owner, owner.rightArm, new THREE.Vector3(0.045, -1.5, 0.04));
  // The grip follows the hand while the hanging column keeps the actor's up
  // direction. This avoids inheriting provider-specific hand bind-axis twists.
  const quaternion = new THREE.Quaternion().setFromEuler(new THREE.Euler(Math.sin(elapsed * 3.1) * 0.045, 0, Math.sin(elapsed * 2.3) * 0.035));
  return { position, quaternion, kind: hand ? 'imported-right-hand' : 'procedural-right-hand', source: hand ?? owner.rightArm };
}

export function getHunterGadgetEffects(owner) {
  if (!owner?.mesh?.isObject3D || !owner.leftArm?.isObject3D || !owner.rightArm?.isObject3D) throw new Error('HunterGadgetEffects requires a rendered player and arm controls');
  if (owner._gadgetEffects) return owner._gadgetEffects;
  let countdown = null, trophy = null, disposed = false;
  const transform = new THREE.Matrix4(), inverse = new THREE.Matrix4();
  const attach = (effect, frame) => {
    owner.mesh.updateWorldMatrix(true, true);
    const parent = owner._importedCharacter?.adapter?.root ?? owner._proceduralMotionRoot ?? owner.mesh;
    if (effect.root.parent !== parent) parent.add(effect.root);
    parent.updateWorldMatrix(true, false);
    transform.compose(frame.position, frame.quaternion, new THREE.Vector3(1, 1, 1));
    transform.premultiply(owner.mesh.matrixWorld);
    inverse.copy(parent.matrixWorld).invert(); transform.premultiply(inverse);
    transform.decompose(effect.root.position, effect.root.quaternion, effect.root.scale);
    effect.root.visible = true; effect.root.updateMatrixWorld(true); effect.anchor = frame.kind;
    effect.anchorObjectName = frame.source?.name ?? null;
  };
  const syncCountdown = () => {
    if (!countdown) return;
    const mechanism = owner._importedCharacter?.mechanisms;
    if (mechanism && mechanism !== countdown.mechanism) {
      mechanism.trigger('nuke', Math.max(0, countdown.duration - countdown.elapsed)); countdown.mechanism = mechanism;
    }
    attach(countdown, countdownFrame(owner));
    const remaining = Math.max(0, countdown.duration - countdown.elapsed), second = Math.ceil(remaining - 1e-10);
    if (second !== countdown.displaySecond) {
      countdown.displaySecond = second;
      const uv = countdown.glyph.geometry.attributes.uv, tile = Math.max(0, Math.min(6, second));
      uv.setXY(0, tile / 8, 1); uv.setXY(1, (tile + 1) / 8, 1);
      uv.setXY(2, tile / 8, 0); uv.setXY(3, (tile + 1) / 8, 0); uv.needsUpdate = true;
    }
    countdown.arc.geometry.setDrawRange(0, Math.ceil(remaining / countdown.duration * 64) * 6);
    const pulse = 0.72 + Math.sin(countdown.elapsed * (remaining <= 2 ? 18 : 7)) * 0.2, cloak = owner.isCloaked ? 0.22 : 1;
    countdown.glow.opacity = pulse * cloak; countdown.line.opacity = 0.6 * cloak; countdown.glass.opacity = 0.32 * cloak;
    countdown.root.userData.remainingSeconds = remaining; countdown.root.userData.displaySeconds = second;
  };
  const syncTrophy = () => {
    if (!trophy) return;
    attach(trophy, trophyFrame(owner, trophy.elapsed));
    for (const material of trophy.materials) {
      const transparent = !!owner.isCloaked;
      if (material.transparent !== transparent) {
        material.transparent = transparent;
        material.needsUpdate = true;
      }
      material.opacity = owner.isCloaked ? 0.22 : 1;
      material.depthWrite = !owner.isCloaked;
    }
  };
  const stopCountdown = () => {
    if (owner._importedCharacter?.mechanisms?.getState().mode === 'nuke') owner._importedCharacter.mechanisms.trigger('nuke', 0);
    if (!countdown) return false;
    if (owner.wristNukeHoloMesh === countdown.root) owner.wristNukeHoloMesh = null;
    release(countdown); countdown = null; return true;
  };
  const stopTrophy = () => {
    if (!trophy) return false;
    const pose = trophy.pose;
    if (pose && closeRotation(owner.rightArm.quaternion, pose.applied)) owner.rightArm.quaternion.copy(pose.original);
    release(trophy); trophy = null; return true;
  };
  const rebind = () => { if (disposed) return false; owner.mesh.updateWorldMatrix(true, true); syncCountdown(); syncTrophy(); return true; };
  const controller = {
    startCountdown({ duration = COUNTDOWN_SECONDS } = {}) {
      if (disposed || owner._disposed || !finiteDuration(duration, COUNTDOWN_SECONDS)) return false;
      stopCountdown(); countdown = buildCountdown(); countdown.duration = duration;
      owner.wristNukeHoloMesh = countdown.root; rebind(); return true;
    },
    stopCountdown,
    startTrophy({ duration = TROPHY_SECONDS, kind = 'human' } = {}) {
      if (disposed || owner._disposed || !finiteDuration(duration, TROPHY_SECONDS)) return false;
      stopTrophy(); trophy = buildTrophy(kind); trophy.duration = duration;
      // A captured mid-stride swing stops being owned by locomotion while the
      // execution pose is active. Restore its authored rest rather than that
      // stale swing, so the next gait can take ownership again.
      const gaitArm = owner.locomotion?.arms?.find(arm => arm.node === owner.rightArm);
      const gaitOwned = gaitArm?.rest?.isQuaternion && gaitArm.applied && closeRotation(owner.rightArm.quaternion, gaitArm.applied);
      const original = (gaitOwned ? gaitArm.rest : owner.rightArm.quaternion).clone();
      owner.rightArm.rotation.x = -Math.PI * 0.8;
      trophy.pose = { original, applied: owner.rightArm.quaternion.clone() }; rebind(); return true;
    },
    stopTrophy, rebind,
    update(delta, { paused = false } = {}) {
      if (disposed || owner._disposed || paused || !Number.isFinite(delta) || delta <= 0) return false;
      if (countdown) { countdown.elapsed = Math.min(countdown.duration, countdown.elapsed + delta); if (countdown.elapsed >= countdown.duration - 1e-10) stopCountdown(); }
      if (trophy) { trophy.elapsed = Math.min(trophy.duration, trophy.elapsed + delta); if (trophy.elapsed >= trophy.duration - 1e-10) stopTrophy(); }
      rebind(); return true;
    },
    dispose() { if (disposed) return; stopCountdown(); stopTrophy(); disposed = true; },
    getState() { return { disposed, countdown: countdown ? { remainingSeconds: Math.max(0, countdown.duration - countdown.elapsed), displaySeconds: countdown.displaySecond, elapsed: countdown.elapsed, anchor: countdown.anchor, anchorObjectName: countdown.anchorObjectName } : null,
      trophy: trophy ? { elapsed: trophy.elapsed, remainingSeconds: Math.max(0, trophy.duration - trophy.elapsed), anchor: trophy.anchor, anchorObjectName: trophy.anchorObjectName, family: trophy.family, victimKind: trophy.victimKind } : null }; }
  };
  owner._gadgetEffects = controller; return controller;
}
