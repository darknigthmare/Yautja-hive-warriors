/* Optional, rigged GLTF enemy visual. No asset is bundled or fabricated here. */
import * as THREE from 'three';
import { clone as cloneSkeleton } from 'three/addons/utils/SkeletonUtils.js';
import { getCorrectedCreatureTemplate } from './CreatureSkinCorrections.js';
import { prepareImportedTailTemplate, createImportedTailController } from './ImportedTailRig.js';
import { createImportedCreatureGrounding } from './ImportedCreatureGrounding.js';
import { prepareImportedAnkleTemplate, createImportedAnkleController } from './ImportedAnkleRig.js';

const COMPONENTS = ['getX', 'getY', 'getZ', 'getW'];
const LOCOMOTION_ROLES = ['leftLeg', 'rightLeg', 'leftArm', 'rightArm'];
const checkedTemplates = new WeakMap();
const fail = message => { throw new Error(`ImportedCreature: ${message}`); };

function inspectTemplate(gltf) {
  if (!gltf?.scene?.isObject3D) fail('a loaded glTF scene is required');
  if (checkedTemplates.has(gltf)) return checkedTemplates.get(gltf);
  const nodes = new Set(), resources = new Set(), skeletons = new Set();
  gltf.scene.traverse(node => nodes.add(node));
  let skinned = 0, triangles = 0, vertices = 0, drawCalls = 0;
  gltf.scene.traverse(mesh => {
    if (!mesh.isMesh) return;
    const geometry = mesh.geometry, positions = geometry?.attributes.position;
    if (!positions || positions.itemSize !== 3) fail('mesh has no 3D positions');
    if (!resources.has(geometry)) {
      vertices += positions.count;
      if (vertices > 750_000) fail('asset exceeds the enemy vertex budget');
      for (let i = 0; i < positions.count; i++) for (let j = 0; j < 3; j++) {
        if (!Number.isFinite(positions[COMPONENTS[j]](i))) fail('non-finite mesh position');
      }
    }
    resources.add(geometry);
    const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
    for (const material of materials) {
      if (!material?.isMaterial) fail('mesh has no material');
      resources.add(material);
      for (const value of Object.values(material)) if (value?.isTexture) resources.add(value);
    }
    triangles += (geometry.index?.count ?? positions.count) / 3;
    drawCalls += geometry.groups.length || 1;
    if (!mesh.isSkinnedMesh) return;
    const bones = mesh.skeleton?.bones, indices = geometry.attributes.skinIndex, weights = geometry.attributes.skinWeight;
    if (!bones?.length || bones.some(bone => !bone?.isBone || !nodes.has(bone))) fail('skeleton must be contained in gltf.scene');
    if (!indices || !weights || indices.itemSize !== 4 || weights.itemSize !== 4 || indices.count !== positions.count || weights.count !== positions.count) fail('invalid skin attributes');
    for (let i = 0; i < positions.count; i++) {
      let total = 0;
      for (let slot = 0; slot < 4; slot++) {
        const weight = weights[COMPONENTS[slot]](i), index = indices[COMPONENTS[slot]](i);
        if (!Number.isFinite(weight) || weight < 0 || (weight > 0 && (!Number.isInteger(index) || index < 0 || index >= bones.length))) fail('invalid skin influence');
        total += weight;
      }
      if (total <= 0 || !Number.isFinite(total)) fail('vertex has no skin influence');
    }
    skeletons.add(mesh.skeleton); skinned++;
  });
  if (!skinned) fail('static GLB cannot replace an animated enemy');
  const result = { resources, skeletons, triangles, drawCalls };
  checkedTemplates.set(gltf, result);
  return result;
}

function namedBone(model, name) {
  if (typeof name !== 'string') return null;
  const bone = model.getObjectByName(name);
  return bone?.isBone ? bone : null;
}

const canonicalBoneName = name => name.toLowerCase().replace(/^.*[:|/]/, '').replace(/[^a-z0-9]/g, '')
  .replace(/^(?:mixamorig\d*|meshy|bip\d*|ccbase|armature)/, '');

function commonBoneAncestor(bones) {
  if (bones.length < 2) return null;
  let ancestor = bones[0];
  while (ancestor) {
    if (ancestor.isBone && bones.every(bone => {
      let node = bone;
      while (node && node !== ancestor) node = node.parent;
      return node === ancestor;
    })) return ancestor;
    ancestor = ancestor.parent;
  }
  return null;
}

function inferPelvis(skeletons, mappedBones) {
  if (mappedBones.hips) return mappedBones.hips;
  const joints = new Set([...skeletons].flatMap(skeleton => skeleton.bones));
  const mappedLegs = [mappedBones.leftLeg, mappedBones.rightLeg].filter(Boolean);
  const mappedPelvis = commonBoneAncestor(mappedLegs);
  if (mappedPelvis) return mappedPelvis;
  const named = [...joints].filter(bone => /^(?:hips|hip|pelvis)$/.test(canonicalBoneName(bone.name)));
  if (named.length === 1) return named[0];
  if (named.length > 1) fail('ambiguous pelvis; provide bones.hips');
  const parentJoint = bone => {
    let node = bone.parent;
    while (node && !joints.has(node)) node = node.parent;
    return node;
  };
  const children = new Map([...joints].map(bone => [bone, []]));
  const roots = [];
  for (const bone of joints) {
    const parent = parentJoint(bone);
    if (parent) children.get(parent).push(bone);
    else roots.push(bone);
  }
  if (roots.length !== 1) fail('cannot infer pelvis across separate skeleton roots; provide bones.hips');
  // Unknown joint names remain supported: skip unary Armature/Root wrappers to
  // the first branching joint instead of assuming skeleton.bones[0] is hips.
  let pelvis = roots[0];
  while (children.get(pelvis).length === 1) pelvis = children.get(pelvis)[0];
  return pelvis;
}

function skeletalClip(clip, model, { locomotion = false, motionNodes = new Set() } = {}) {
  return Number.isFinite(clip?.duration) && clip.duration > 0 && clip.tracks.some(track => {
    try {
      const parsed = THREE.PropertyBinding.parseTrackName(track.name);
      const node = THREE.PropertyBinding.findNode(model, parsed.nodeName);
      const bone = parsed.objectName === 'bones' ? node?.skeleton?.getBoneByName(parsed.objectIndex) : node;
      if (!bone?.isBone || !['quaternion', 'rotation'].includes(parsed.propertyName)) return false;
      // A rotating Armature/Root or torso alone is not limb articulation.
      // Descendant joints with unfamiliar names remain valid; calibrated rigs
      // do not need a particular naming convention to play their real clips.
      if (locomotion && (motionNodes.has(bone) || /^(?:root|rootmotion|global|master|hips|hip|pelvis|spine\d*|chest\d*|neck\d*|head\d*)$/.test(canonicalBoneName(bone.name)))) return false;
      const width = track.getValueSize();
      // A translated root or constant rest-pose clip is not articulated gait.
      // Root motion is removed below, so accepting it alone would hide the
      // animated procedural visual behind an effectively static imported mesh.
      if (width < 3 || !track.values.every(Number.isFinite)) return false;
      return track.values.some((value, i) => i >= width && Math.abs(value - track.values[i % width]) > 1e-5);
    } catch { return false; }
  });
}

function selectClip(clips, model, exact, pattern, options) {
  const clip = exact ? clips.find(candidate => candidate.name === exact) : clips.find(candidate => pattern.test(candidate.name) && skeletalClip(candidate, model, options));
  if (exact && !skeletalClip(clip, model, options)) fail(`animation ${exact} is not a skeletal clip`);
  return skeletalClip(clip, model, options) ? clip : null;
}

function localStandingHeight(actor) {
  const profileHeight = actor.userData.visualProfile?.standingHeight;
  if (Number.isFinite(profileHeight) && profileHeight > 0) return profileHeight;
  const bounds = new THREE.Box3(), matrix = new THREE.Matrix4(), neutral = new THREE.Quaternion();
  for (const name of ['carapace', 'cranium', 'leg-left', 'leg-right']) {
    const mesh = actor._creatureRig?.[name];
    if (!mesh?.geometry) continue;
    mesh.geometry.computeBoundingBox();
    matrix.compose(mesh.position, neutral, mesh.scale);
    bounds.union(mesh.geometry.boundingBox.clone().applyMatrix4(matrix));
  }
  const height = bounds.max.y - Math.min(0, bounds.min.y);
  if (!Number.isFinite(height) || height <= 0) fail('procedural standing height is missing');
  return height;
}

/**
 * Clone a real skinned template. The cache keeps geometry/material/maps; this
 * instance owns only bones, skeleton GPU data, transforms and AnimationMixer.
 * entry.creatureRig may provide forwardAxis, clips {run,walk,idle}, and exact
 * bones {hips,leftLeg,rightLeg,leftArm,rightArm}. Without skeletal locomotion
 * clips, all four limb mappings must be explicit before activation. A mapping
 * can also be {name,axis:[x,y,z],sign:1} for calibrated bone-local gait axes.
 * Optional skinCorrections select measured vertex ranges in an exact source
 * geometry. The helper owns a shared corrected template; actors retain its
 * surfaces and still clone their own bones. The original GLB stays untouched.
 * Real bone names and forward orientation still require asset review.
 */
export function createImportedCreature(actor, gltf, entry = {}, retained = new Set()) {
  const config = entry.creatureRig ?? {};
  const prepared = getCorrectedCreatureTemplate(gltf, config.skinCorrections);
  const articulated = prepareImportedTailTemplate(prepared.template, config.tailRig, { sourceSha256: entry.sha256 });
  const ankled = prepareImportedAnkleTemplate(articulated.template, config.ankleRig, { sourceSha256: entry.sha256 });
  const template = ankled.template, inspected = inspectTemplate(template);
  const forwardAxis = config.forwardAxis ?? '+z';
  const yaw = { '+z': 0, '-z': Math.PI, '+x': -Math.PI / 2, '-x': Math.PI / 2 }[forwardAxis];
  if (yaw === undefined) fail('forwardAxis must be +z, -z, +x or -x');
  const root = new THREE.Group(); root.name = 'imported-creature';
  const orientation = new THREE.Group(); orientation.rotation.y = yaw; root.add(orientation);
  const model = cloneSkeleton(template.scene); orientation.add(model);
  const skeletons = new Set(), rest = [], bindings = [], bones = {};
  model.traverse(node => {
    if (node.isBone) rest.push({ bone: node, quaternion: node.quaternion.clone(), position: node.position.clone(), scale: node.scale.clone() });
    if (!node.isMesh) return;
    node.castShadow = true; node.receiveShadow = true;
    if (node.isSkinnedMesh) {
      skeletons.add(node.skeleton);
      // Animated bounds are not the static GLB bounds. LOD already bounds the
      // number of nearby imported actors; avoid clipping articulated limbs.
      node.frustumCulled = false;
    }
  });
  let mixer = null, disposed = false, activeAction = null, ankleRig = null;
  const dispose = () => {
    if (disposed) return;
    disposed = true;
    ankleRig?.dispose();
    mixer?.stopAllAction(); mixer?.uncacheRoot(model);
    skeletons.forEach(skeleton => skeleton.dispose());
    root.visible = false;
    // Leave children attached: SceneResources traverses after the owner emits
    // removed. Shared cache resources have already been retained by its manager.
  };
  try {
    for (const [role, value] of Object.entries(config.bones ?? {})) {
      const name = typeof value === 'string' ? value : value?.name;
      const bone = namedBone(model, name);
      if (!bone) fail(`mapped bone ${role} does not exist: ${name}`);
      bones[role] = bone;
      if (!LOCOMOTION_ROLES.includes(role)) continue;
      const axis = new THREE.Vector3().fromArray(value?.axis ?? [1, 0, 0]);
      if (!axis.toArray().every(Number.isFinite) || axis.lengthSq() < 1e-8) fail(`invalid gait axis for ${role}`);
      const sign = typeof value === 'object' ? value.sign ?? 1 : 1;
      if (!Number.isFinite(sign)) fail(`invalid gait sign for ${role}`);
      bindings.push({ role, bone, axis: axis.normalize(), sign, rest: bone.quaternion.clone() });
    }
    if (new Set(LOCOMOTION_ROLES.map(role => bones[role]).filter(Boolean)).size !== bindings.length) fail('gait roles must use distinct bones');
    const centerBone = inferPelvis(skeletons, bones);
    bones.hips ??= centerBone;
    const motionNodes = new Set([centerBone, model]);
    for (const skeleton of skeletons) for (const bone of skeleton.bones) {
      if (bone.parent?.isBone) continue;
      let node = bone;
      while (node && node !== orientation) { motionNodes.add(node); node = node.parent; }
    }
    // Also include every ancestor of an inferred pelvis. A root wrapper and
    // its Hips child can both carry planar motion in an imported clip.
    let ancestor = centerBone.parent;
    while (ancestor && ancestor !== orientation) { motionNodes.add(ancestor); ancestor = ancestor.parent; }
    const clips = template.animations ?? [], names = config.clips ?? {};
    const locomotion = { locomotion: true, motionNodes };
    const moveClip = selectClip(clips, model, names.run, /run|sprint/i, locomotion) ?? selectClip(clips, model, names.walk, /walk|locomotion/i, locomotion);
    const idleClip = selectClip(clips, model, names.idle, /idle|breath/i);
    if (!moveClip && !LOCOMOTION_ROLES.every(role => bones[role])) fail('no skeletal locomotion clip or calibrated limb rig');
    if (moveClip || idleClip) mixer = new THREE.AnimationMixer(model);
    const moveAction = moveClip ? mixer.clipAction(moveClip) : null, idleAction = idleClip ? mixer.clipAction(idleClip) : null;
    root.updateMatrixWorld(true);
    skeletons.forEach(skeleton => skeleton.update());
    const bounds = new THREE.Box3().setFromObject(root, true), size = bounds.getSize(new THREE.Vector3());
    if (![...bounds.min.toArray(), ...bounds.max.toArray()].every(Number.isFinite) || size.y <= 1e-7) fail('asset has no finite standing height');
    const height = localStandingHeight(actor), scale = height / size.y;
    const center = centerBone.getWorldPosition(new THREE.Vector3());
    const motionRest = [...motionNodes].map(node => ({ node, x: node.position.x, z: node.position.z }));
    orientation.scale.setScalar(scale);
    orientation.position.set(-center.x * scale, -bounds.min.y * scale, -center.z * scale);
    root.updateMatrixWorld(true);
    const tailRig = createImportedTailController(root, model, articulated.tail);
    ankleRig = createImportedAnkleController(root, orientation, model, ankled.ankles);
    const footGrounding = ankleRig ? null : createImportedCreatureGrounding(root, orientation, model, config.footGrounding, { sourceSha256: entry.sha256 });
    inspected.resources.forEach(resource => retained.add(resource));
    const deltaQ = new THREE.Quaternion();
    const restoreRest = () => {
      for (const item of rest) {
        item.bone.quaternion.copy(item.quaternion); item.bone.position.copy(item.position); item.bone.scale.copy(item.scale);
      }
    };
    const setDetailLevel = level => {
      if (disposed) return;
      root.visible = level === 0;
      ankleRig?.setDetailLevel(level);
      for (const mesh of Object.values(actor._creatureRig ?? {})) mesh.visible = level !== 0;
      actor.userData.visualSource = level === 0 ? 'generated-rigged' : 'procedural';
    };
    const update = (phase, moving = true) => {
      if (disposed || !root.visible || !Number.isFinite(phase)) return;
      const action = moving ? moveAction : idleAction;
      if (action !== activeAction) {
        mixer?.stopAllAction(); restoreRest(); activeAction = action;
        action?.reset().play();
      }
      if (action) {
        // Game phase is simulation time, so pause and slow motion remain correct.
        // setTime also handles pooled actors and non-monotonic phase resets.
        mixer.setTime(Math.max(0, phase) * action.getClip().duration / (Math.PI * 2));
      } else if (moving) {
        for (const binding of bindings) {
          const side = binding.role.startsWith('left') ? 1 : -1;
          const amplitude = binding.role.endsWith('Leg') ? 0.35 : -0.18;
          deltaQ.setFromAxisAngle(binding.axis, Math.sin(phase) * side * amplitude * binding.sign);
          binding.bone.quaternion.copy(binding.rest).multiply(deltaQ);
        }
      } else restoreRest();
      // Imported locomotion must stay at its gameplay actor. Preserve vertical
      // gait bounce, but remove planar root motion without editing cached clips.
      for (const item of motionRest) { item.node.position.x = item.x; item.node.position.z = item.z; }
      root.updateMatrixWorld(true); skeletons.forEach(skeleton => skeleton.update());
      footGrounding?.update();
      ankleRig?.update(action?.getClip().name, moving);
      tailRig?.update(phase, moving);
    };
    return { root, model, bones, skeletons, tailRig, footGrounding, ankleRig, update, setDetailLevel, dispose,
      diagnostics: { triangles: inspected.triangles, drawCalls: inspected.drawCalls, height, normalizationScale: scale,
        forwardAxis, rootMotion: 'in-place', motionRootBone: centerBone.name,
        locomotion: moveClip?.name ?? 'calibrated-bones', idle: idleClip?.name ?? null,
        ...(tailRig ? { tailRig: tailRig.diagnostics } : {}),
        ...(footGrounding ? { footGrounding: footGrounding.diagnostics } : {}),
        ...(ankleRig ? { ankleRig: ankleRig.diagnostics } : {}),
        ...(prepared.diagnostics ? { skinCorrections: prepared.diagnostics } : {}) } };
  } catch (error) { dispose(); throw error; }
}

/**
 * Opportunistic attachment. Only a real manifest entry is passed by the caller.
 * A resolved request waits for its actor to enter the scene; a removed actor is
 * permanently cancelled, including when a wave is cleared before loading ends.
 * Errors preserve the procedural visual and resolve ready with null.
 */
export function requestImportedCreature(actor, { key, entry, loadTemplate, retained = new Set() }) {
  if (actor._importedCreatureRequest) return actor._importedCreatureRequest;
  let cancelled = false, template = null, adapter = null, settled = false, resolveReady;
  const ready = new Promise(resolve => { resolveReady = resolve; });
  const finish = value => { if (!settled) { settled = true; resolveReady(value); } };
  const state = { key, status: 'loading' }; actor.userData.importedCreature = state;
  const cancel = () => {
    if (cancelled) return;
    cancelled = true; state.status = 'cancelled';
    adapter?.dispose();
    for (const mesh of Object.values(actor._creatureRig ?? {})) mesh.visible = true;
    actor.userData.visualSource = 'procedural';
    actor.removeEventListener('added', attach); actor.removeEventListener('removed', cancel);
    finish(null);
  };
  const attach = () => {
    if (cancelled || adapter || !template || !actor.parent) return;
    try {
      adapter = createImportedCreature(actor, template, entry, retained);
      actor._importedCreatureAdapter = adapter;
      actor.add(adapter.root);
      adapter.setDetailLevel(actor.userData.detailLevel ?? 0);
      state.status = 'ready'; state.diagnostics = adapter.diagnostics;
      actor.removeEventListener('added', attach);
      let scene = actor.parent;
      while (scene && !scene.isScene) scene = scene.parent;
      scene?.dispatchEvent({ type: 'visual-ready' });
      finish(adapter);
    } catch (error) {
      state.status = 'rejected'; state.reason = error.message;
      actor.removeEventListener('added', attach); finish(null);
    }
  };
  actor.addEventListener('added', attach); actor.addEventListener('removed', cancel);
  const loaded = Promise.resolve().then(loadTemplate).then(result => {
    if (cancelled) return;
    template = result; state.status = 'loaded'; attach();
  }).catch(error => {
    if (cancelled) return;
    state.status = 'load-error'; state.reason = error.message;
    actor.removeEventListener('added', attach); finish(null);
  });
  const request = { ready, loaded, cancel };
  actor._importedCreatureRequest = request;
  return request;
}
