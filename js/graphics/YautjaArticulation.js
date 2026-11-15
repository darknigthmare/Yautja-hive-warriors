/* Secondary articulation for measured, separated Yautja components. No asset loading. */
import * as THREE from 'three';

const CLAIMS = new WeakMap();
const IDENTITY = new THREE.Quaternion();
const COMPONENT = ['getX', 'getY', 'getZ', 'getW'];
const bodyBone = node => node.isBone && /^(?:head|neck\d*|hips|pelvis|root|spine\d*|chest|(?:left|right)(?:shoulder|arm|forearm|hand|upleg|leg|foot)|(?:upperarm|forearm|hand|thigh|calf|foot)[lr])$/i.test(node.name.replace(/[^a-z0-9]/ig, '').replace(/^mixamorig\d*/i, ''));
const fail = message => { throw new Error(`YautjaArticulation: ${message}`); };
const number = (value, fallback, low, high, name) => {
  value ??= fallback;
  if (!Number.isFinite(value) || value < low || value > high) fail(`invalid ${name}`);
  return value;
};
const vector = (value, name, fallback) => {
  value ??= fallback;
  if (!Array.isArray(value) || value.length !== 3 || !value.every(Number.isFinite)) fail(`invalid ${name}`);
  return new THREE.Vector3(...value);
};

/**
 * createYautjaArticulation(renderedActorRoot, descriptor, options={})
 *
 * Descriptor.version=1. All node names must be unique below this rendered clone;
 * Object3D references are also accepted, but nodes of cached/other actors fail.
 * - dreadlocks:[{id,nodes:[rootBone,...,tipBone],stiffness=45,damping=5,
 *     gravityScale=1,maxAngle=.75}]. Each consecutive node is a direct child.
 *   At least TWO non-tip bones must actually influence a rendered skinned mesh.
 * - wristblades:[{id,nodes:[meshOrPivot,...],axis:[x,y,z],travel,speed=3,
 *     restState:'extended'|'retracted'}]. Travel/axis are PARENT-LOCAL units.
 * - gauntlets:[{id,node:pivot,axis:[x,y,z],angle,speed=3,
 *     restState:'open'|'closed'}]. Angle is radians about a PARENT-LOCAL axis.
 * - colliders:[{node,center:[x,y,z],radius}]: optional measured spheres, in that
 *   node's local units. Contact is approximate; this is not rigid-body physics.
 *
 * options.gravity=[0,-9.81,0] is WORLD acceleration in game units; fixedStep=1/120,
 * maxSubsteps=8, iterations=4, maxDelta=.1, teleportDistance=2.5. Motor time is
 * capped separately from the strand solver's substep budget. Uniform world scale
 * is required for strand length constraints. forbiddenNodes should include the
 * body's animation-controlled bones (adapter.bones), especially Head/Neck.
 *
 * Call update(simulationDelta,{paused,detailLevel:0|1|2,headVisible,wind:[x,y,z]})
 * AFTER the body's clip/controller pose. Delta0 and pause do not advance/apply
 * animation. At LOD2 or hidden head, strands rest and their velocities reset;
 * sliders/hinges still work. Returning to near detail starts without stale force.
 * setBladeExtension(id,0..1) and setGauntletOpen(id,0..1) command separate motors.
 * reset() restores authored rest states (also use on spawn/teleport/restart).
 * dispose() restores transforms once; no geometries/materials/textures are owned.
 *
 * This does not extract baked geometry, add bones/weights, or hide head triangles.
 * Compose/exclude the measured components BEFORE createImportedCharacter, whose
 * FPS partition and private materials remain responsible for FPS/camouflage.
 * No manifest activation or model-quality claim is implied.
 */
export function createYautjaArticulation(root, descriptor, options = {}) {
  if (!root?.isObject3D || descriptor?.version !== 1) fail('a rendered actor root and descriptor version1 are required');
  const fixedStep = number(options.fixedStep, 1 / 120, 1 / 240, 1 / 30, 'fixedStep');
  const maxSubsteps = number(options.maxSubsteps, 8, 1, 16, 'maxSubsteps');
  const iterations = number(options.iterations, 4, 1, 12, 'iterations');
  if (!Number.isInteger(maxSubsteps) || !Number.isInteger(iterations)) fail('solver budgets must be integers');
  const teleportDistance = number(options.teleportDistance, 2.5, 0.01, 1000, 'teleportDistance');
  const maxDelta = number(options.maxDelta, 0.1, 1e-4, 0.25, 'maxDelta');
  const gravity = vector(options.gravity, 'gravity', [0, -9.81, 0]);
  const present = new Set(), names = new Map(), weightedBones = new Set(), skeletons = new Set();
  root.traverse(node => {
    present.add(node);
    const named = names.get(node.name) ?? []; named.push(node); names.set(node.name, named);
    if (!node.isSkinnedMesh) return;
    const indices = node.geometry.attributes.skinIndex, weights = node.geometry.attributes.skinWeight;
    if (!indices || !weights || !node.skeleton) return;
    skeletons.add(node.skeleton);
    const geometry = node.geometry, count = geometry.index?.count ?? geometry.attributes.position.count;
    const start = Math.min(count, geometry.drawRange.start), end = Math.min(count, start + geometry.drawRange.count);
    const ranges = Array.isArray(node.material) ? geometry.groups : [{ start, count: end - start }];
    const used = new Set();
    for (const range of ranges) for (let at = Math.max(start, range.start); at < Math.min(end, range.start + range.count); at++) {
      const vertex = geometry.index ? geometry.index.getX(at) : at;
      if (used.has(vertex)) continue;
      used.add(vertex);
      for (let slot = 0; slot < Math.min(4, weights.itemSize); slot++) {
        if (weights[COMPONENT[slot]](vertex) > 0) weightedBones.add(node.skeleton.bones[indices[COMPONENT[slot]](vertex)]);
      }
    }
  });
  const resolve = value => {
    const matches = typeof value === 'string' ? names.get(value) ?? [] : [value];
    if (matches.length !== 1 || !present.has(matches[0]) || matches[0] === root) fail(`missing, ambiguous or foreign node: ${typeof value === 'string' ? value : value?.name}`);
    return matches[0];
  };
  const lists = [descriptor.dreadlocks ?? [], descriptor.wristblades ?? [], descriptor.gauntlets ?? [], descriptor.colliders ?? []];
  if (lists.some(list => !Array.isArray(list)) || lists[0].length > 64 || lists[1].length > 16 || lists[2].length > 16 || lists[3].length > 32) fail('component budgets exceeded');
  if (!lists[0].length && !lists[1].length && !lists[2].length) fail('no independently articulated components');
  const ids = new Set(), borrowed = new Map(), forbidden = new Set(options.forbiddenNodes ?? []);
  const id = value => {
    if (typeof value !== 'string' || !value || ids.has(value)) fail('component ids must be unique nonempty strings');
    ids.add(value); return value;
  };
  const borrow = node => {
    if (borrowed.has(node) || CLAIMS.has(node)) fail(`node is shared by articulation components: ${node.name}`);
    if (forbidden.has(node) || bodyBone(node)) fail(`body animation owns node: ${node.name}`);
    borrowed.set(node, { position: node.position.clone(), quaternion: node.quaternion.clone() });
    return node;
  };
  const direction = (value, name) => {
    const axis = vector(value, name);
    if (axis.lengthSq() < 1e-12) fail(`zero ${name}`);
    return axis.normalize();
  };
  const visibleGeometry = node => {
    let found = weightedBones.has(node);
    node.traverse(child => { if (child.isMesh && child.geometry?.attributes.position?.count) found = true; });
    return found;
  };
  const chains = lists[0].map(value => {
    if (!Array.isArray(value.nodes) || value.nodes.length < 3 || value.nodes.length > 16) fail('a dreadlock requires3..16 chain nodes');
    const nodes = value.nodes.map(resolve);
    for (let i = 0; i < nodes.length; i++) {
      const node = nodes[i];
      if (!node.isBone || forbidden.has(node) || /^(?:mixamorig:?)?(?:head|neck|hips|root)$/i.test(node.name)) fail(`body/helper node cannot stand in for a dreadlock: ${node.name}`);
      if (i && node.parent !== nodes[i - 1]) fail('dreadlock nodes must form a direct parent/child chain');
      borrow(node);
    }
    if (nodes.slice(0, -1).filter(node => weightedBones.has(node)).length < 2) fail('dreadlock requires at least2 genuinely weighted segments');
    return { id: id(value.id), nodes, stiffness: number(value.stiffness, 45, 0, 1000, 'stiffness'),
      damping: number(value.damping, 5, 0, 100, 'damping'), gravityScale: number(value.gravityScale, 1, 0, 4, 'gravityScale'),
      maxAngle: number(value.maxAngle, 0.75, 0, Math.PI, 'maxAngle'), points: [], previous: [], rest: [], lengths: [], lastAnchor: new THREE.Vector3() };
  });
  const sliders = lists[1].map(value => {
    if (!Array.isArray(value.nodes) || !value.nodes.length || value.nodes.length > 8 || !['extended', 'retracted'].includes(value.restState)) fail('blade nodes and explicit restState are required');
    const nodes = value.nodes.map(node => borrow(resolve(node)));
    if (nodes.some(node => !visibleGeometry(node))) fail('wristblade has no independently bound surface');
    const rest = value.restState === 'extended' ? 1 : 0;
    return { id: id(value.id), nodes, axis: direction(value.axis, 'blade axis'), travel: number(value.travel, undefined, 1e-7, 1e5, 'blade travel'),
      speed: number(value.speed, 3, 0.001, 1000, 'blade speed'), rest, amount: rest, target: rest };
  });
  const hinges = lists[2].map(value => {
    if (!['open', 'closed'].includes(value.restState)) fail('gauntlet explicit restState is required');
    const node = borrow(resolve(value.node));
    if (!visibleGeometry(node)) fail('gauntlet has no independently bound surface');
    const rest = value.restState === 'open' ? 1 : 0;
    return { id: id(value.id), node, axis: direction(value.axis, 'hinge axis'), angle: number(value.angle, undefined, -Math.PI * 2, Math.PI * 2, 'hinge angle'),
      speed: number(value.speed, 3, 0.001, 1000, 'hinge speed'), rest, amount: rest, target: rest };
  });
  const colliders = lists[3].map(value => ({ node: resolve(value.node), center: vector(value.center, 'collider center', [0, 0, 0]),
    radius: number(value.radius, undefined, 1e-7, 1e5, 'collider radius'), worldCenter: new THREE.Vector3(), worldRadius: 0 }));
  const token = {}, scale = new THREE.Vector3(), difference = new THREE.Vector3(), restDirection = new THREE.Vector3();
  const force = new THREE.Vector3(), scratch = new THREE.Vector3(), desired = new THREE.Vector3();
  const parentInverse = new THREE.Matrix4(), parentLinear = new THREE.Matrix3(), swing = new THREE.Quaternion();
  let disposed = false, accumulator = 0, hairActive = true, lastDetail = 0;
  const updateWorld = () => { root.updateWorldMatrix(true, false); root.updateMatrixWorld(true); };
  const uniformScale = () => {
    root.getWorldScale(scale);
    if (Math.min(scale.x, scale.y, scale.z) <= 0 || Math.max(scale.x, scale.y, scale.z) - Math.min(scale.x, scale.y, scale.z) > Math.max(scale.x, scale.y, scale.z) * 1e-4) fail('strand physics requires positive uniform world scale');
    for (const chain of chains) for (const node of chain.nodes) {
      let ancestor = node;
      while (ancestor && ancestor !== root) {
        const s = ancestor.scale, high = Math.max(s.x, s.y, s.z), low = Math.min(s.x, s.y, s.z);
        if (low <= 0 || high - low > high * 1e-4) fail('strand hierarchy requires uniform positive scales');
        ancestor = ancestor.parent;
      }
    }
  };
  const restChains = () => {
    for (const chain of chains) for (const node of chain.nodes) node.quaternion.copy(borrowed.get(node).quaternion);
    updateWorld();
    for (const chain of chains) {
      chain.nodes.forEach((node, i) => {
        chain.rest[i] ??= new THREE.Vector3(); node.getWorldPosition(chain.rest[i]);
      });
    }
  };
  const rebase = chain => {
    chain.rest.forEach((point, i) => {
      (chain.points[i] ??= new THREE.Vector3()).copy(point);
      (chain.previous[i] ??= new THREE.Vector3()).copy(point);
      if (i) {
        const length = point.distanceTo(chain.rest[i - 1]);
        if (!Number.isFinite(length) || length < 1e-7) fail('zero-length or invalid dreadlock segment');
        chain.lengths[i - 1] = length;
      }
    });
    chain.lastAnchor.copy(chain.rest[0]);
  };
  const motors = delta => {
    const advance = motor => {
      const distance = motor.target - motor.amount, step = motor.speed * delta;
      motor.amount = Math.abs(distance) <= step + 1e-12 ? motor.target : motor.amount + Math.sign(distance) * step;
    };
    for (const slider of sliders) {
      advance(slider);
      for (const node of slider.nodes) node.position.copy(borrowed.get(node).position).addScaledVector(slider.axis, slider.travel * (slider.amount - slider.rest));
    }
    for (const hinge of hinges) {
      advance(hinge);
      swing.setFromAxisAngle(hinge.axis, hinge.angle * (hinge.amount - hinge.rest));
      hinge.node.quaternion.copy(swing).multiply(borrowed.get(hinge.node).quaternion);
    }
  };
  const solve = (chain, step, wind, passes) => {
    const drag = Math.exp(-chain.damping * step);
    chain.points[0].copy(chain.rest[0]);
    for (let i = 1; i < chain.points.length; i++) {
      const point = chain.points[i], previous = chain.previous[i];
      difference.copy(point).sub(previous).multiplyScalar(drag); previous.copy(point);
      force.copy(chain.rest[i]).sub(point).multiplyScalar(chain.stiffness).addScaledVector(gravity, chain.gravityScale).add(wind);
      point.add(difference).addScaledVector(force, step * step);
    }
    for (let pass = 0; pass < passes; pass++) {
      chain.points[0].copy(chain.rest[0]);
      for (let i = 0; i < chain.lengths.length; i++) {
        difference.copy(chain.points[i + 1]).sub(chain.points[i]);
        const length = difference.length();
        if (length > 1e-10) {
          difference.multiplyScalar((length - chain.lengths[i]) / length);
          if (i) { chain.points[i].addScaledVector(difference, 0.5); chain.points[i + 1].addScaledVector(difference, -0.5); }
          else chain.points[i + 1].sub(difference);
        }
      }
      for (let i = 1; i < chain.points.length; i++) for (const collider of colliders) {
        difference.copy(chain.points[i]).sub(collider.worldCenter);
        const distance = difference.length();
        if (distance < collider.worldRadius) {
          if (distance < 1e-10) difference.set(0, 0, 1); else difference.divideScalar(distance);
          chain.points[i].copy(collider.worldCenter).addScaledVector(difference, collider.worldRadius);
        }
      }
    }
    // A final forward projection preserves each segment's exact world length and
    // bounds swing against the authored curve instead of turning the whole head.
    chain.points[0].copy(chain.rest[0]);
    for (let i = 0; i < chain.lengths.length; i++) {
      restDirection.copy(chain.rest[i + 1]).sub(chain.rest[i]).normalize();
      difference.copy(chain.points[i + 1]).sub(chain.points[i]).normalize();
      if (difference.lengthSq() < 1e-12) difference.copy(restDirection);
      const angle = Math.acos(THREE.MathUtils.clamp(restDirection.dot(difference), -1, 1));
      if (angle > chain.maxAngle) {
        swing.setFromUnitVectors(restDirection, difference).slerp(IDENTITY, 1 - chain.maxAngle / angle);
        difference.copy(restDirection).applyQuaternion(swing);
      }
      chain.points[i + 1].copy(chain.points[i]).addScaledVector(difference, chain.lengths[i]);
    }
  };
  const applyChains = () => {
    for (const chain of chains) for (let i = 0; i < chain.nodes.length - 1; i++) {
      const node = chain.nodes[i], child = chain.nodes[i + 1];
      parentInverse.copy(node.parent.matrixWorld).invert(); parentLinear.setFromMatrix4(parentInverse);
      desired.copy(chain.points[i + 1]).sub(chain.points[i]).applyMatrix3(parentLinear).normalize();
      restDirection.copy(child.position).multiply(node.scale).applyQuaternion(borrowed.get(node).quaternion).normalize();
      swing.setFromUnitVectors(restDirection, desired);
      node.quaternion.copy(swing).multiply(borrowed.get(node).quaternion); node.updateMatrixWorld(true);
    }
  };
  const reset = () => {
    if (disposed) return false;
    borrowed.forEach((rest, node) => { node.position.copy(rest.position); node.quaternion.copy(rest.quaternion); });
    for (const motor of [...sliders, ...hinges]) motor.amount = motor.target = motor.rest;
    accumulator = 0; restChains(); for (const chain of chains) rebase(chain); skeletons.forEach(skeleton => skeleton.update()); return true;
  };
  // Validate every binding before claiming nodes or changing any authored pose.
  if (chains.length) uniformScale();
  updateWorld();
  for (const chain of chains) {
    chain.nodes.forEach((node, i) => { chain.rest[i] = node.getWorldPosition(new THREE.Vector3()); }); rebase(chain);
  }
  borrowed.forEach((_, node) => CLAIMS.set(node, token));
  const update = (delta, state = {}) => {
    if (disposed) return false;
    if (!Number.isFinite(delta) || delta < 0) fail('simulation delta must be finite and nonnegative');
    if (!delta || state.paused) return false;
    const detail = number(state.detailLevel, 0, 0, 2, 'detailLevel');
    if (!Number.isInteger(detail)) fail('detailLevel must be0,1 or2');
    const wind = vector(state.wind, 'wind', [0, 0, 0]);
    const bounded = Math.min(delta, maxDelta);
    motors(bounded);
    const active = detail < 2 && state.headVisible !== false;
    if (chains.length && (active || hairActive || detail !== lastDetail)) {
      uniformScale(); restChains();
      if (!active || !hairActive || detail !== lastDetail) {
        for (const chain of chains) rebase(chain);
        accumulator = 0;
      }
      if (active) {
        for (const chain of chains) {
          let changedScale = false;
          for (let i = 0; i < chain.lengths.length; i++) {
            const length = chain.rest[i + 1].distanceTo(chain.rest[i]);
            if (Math.abs(length / chain.lengths[i] - 1) > 0.05) changedScale = true;
            chain.lengths[i] = length;
          }
          if (changedScale || chain.lastAnchor.distanceTo(chain.rest[0]) > teleportDistance) rebase(chain);
          chain.lastAnchor.copy(chain.rest[0]);
        }
        for (const collider of colliders) {
          collider.node.updateWorldMatrix(true, false); collider.worldCenter.copy(collider.center).applyMatrix4(collider.node.matrixWorld);
          collider.node.getWorldScale(scale); collider.worldRadius = collider.radius * Math.max(scale.x, scale.y, scale.z);
        }
        const step = detail === 1 ? fixedStep * 2 : fixedStep;
        accumulator += Math.min(bounded, step * maxSubsteps);
        let steps = 0;
        while (accumulator + 1e-10 >= step && steps < maxSubsteps) {
          for (const chain of chains) solve(chain, step, wind, detail === 1 ? Math.max(1, iterations - 2) : iterations);
          accumulator = Math.max(0, accumulator - step); steps++;
        }
        applyChains();
      }
    }
    hairActive = active; lastDetail = detail; updateWorld(); skeletons.forEach(skeleton => skeleton.update()); return true;
  };
  const command = (list, id, amount) => {
    if (disposed) return false;
    const motor = list.find(value => value.id === id);
    if (!motor) fail(`unknown component: ${id}`);
    motor.target = number(amount, undefined, 0, 1, 'motor target'); return true;
  };
  const dispose = () => {
    if (disposed) return;
    reset(); disposed = true;
    borrowed.forEach((_, node) => { if (CLAIMS.get(node) === token) CLAIMS.delete(node); });
  };
  return { update, reset, dispose,
    setBladeExtension: (id, amount) => command(sliders, id, amount),
    setGauntletOpen: (id, amount) => command(hinges, id, amount),
    stats: Object.freeze({ dreadlocks: chains.length, simulatedSegments: chains.reduce((sum, chain) => sum + chain.nodes.length - 1, 0), wristbladeActuators: sliders.length, gauntletHinges: hinges.length }),
    getState: () => ({ disposed, detailLevel: lastDetail, hairActive,
      wristblades: sliders.map(({ id, amount, target }) => ({ id, amount, target })),
      gauntlets: hinges.map(({ id, amount, target }) => ({ id, amount, target })) }) };
}
