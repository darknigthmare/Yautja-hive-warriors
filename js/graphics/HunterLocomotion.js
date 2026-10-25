/* Distance-driven player gait. The procedural fallback has rigid legs: its
 * measured sole hull can ground the rendered body, but this is not foot IK. */
import * as THREE from 'three';

const TAU = Math.PI * 2;
const X_AXIS = new THREE.Vector3(1, 0, 0);
const clamp01 = value => Math.max(0, Math.min(1, value));
const damp = (current, target, rate, delta) => target + (current - target) * Math.exp(-rate * delta);
const closeRotation = (a, b) => Math.abs(a.dot(b)) > 1 - 1e-10;

function hullYZ(points) {
  const sorted = points.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const unique = sorted.filter((point, i) => !i || point[0] !== sorted[i - 1][0] || point[1] !== sorted[i - 1][1]);
  const cross = (a, b, c) => (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
  const lower = [], upper = [];
  for (const point of unique) { while (lower.length > 1 && cross(lower.at(-2), lower.at(-1), point) <= 0) lower.pop(); lower.push(point); }
  for (const point of [...unique].reverse()) { while (upper.length > 1 && cross(upper.at(-2), upper.at(-1), point) <= 0) upper.pop(); upper.push(point); }
  return lower.slice(0, -1).concat(upper.slice(0, -1));
}

function legSupport(leg) {
  const points = [], point = new THREE.Vector3(), relative = new THREE.Matrix4();
  leg.updateWorldMatrix(true, true);
  const inverse = leg.matrixWorld.clone().invert();
  leg.traverse(mesh => {
    if (!mesh.isMesh || mesh.isSkinnedMesh) return;
    const positions = mesh.geometry.attributes.position;
    relative.multiplyMatrices(inverse, mesh.matrixWorld);
    for (let index = 0; index < positions.count; index++) {
      point.fromBufferAttribute(positions, index).applyMatrix4(relative);
      points.push([point.y, point.z]);
    }
  });
  return { leg, hull: hullYZ(points), rest: leg.quaternion.clone() };
}

export class HunterLocomotion {
  constructor(owner, { cycleDistance = 6.4, maxVisualOffset = 0.15 } = {}) {
    if (!Number.isFinite(cycleDistance) || cycleDistance <= 0) throw new Error('HunterLocomotion requires a positive cycle distance');
    if (!Number.isFinite(maxVisualOffset) || maxVisualOffset <= 0 || maxVisualOffset > 0.15) throw new Error('HunterLocomotion visual contact must stay within .15 game units');
    this.owner = owner;
    this.lastPosition = owner.position.clone();
    this.maxVisualOffset = maxVisualOffset;
    this.state = { phase: 0, strength: 0, speed: 0, cycleDistance, moving: false, runBlend: 0,
      travelledDistance: 0, stepCount: 0, visualOffsetY: 0, supportMinimumY: null, grounded: true, teleports: 0 };
    this.visualRoot = new THREE.Group(); this.visualRoot.name = 'procedural-hunter-visual';
    for (const child of [...owner.mesh.children]) if (child !== owner.laserGroup) this.visualRoot.add(child);
    owner.mesh.add(this.visualRoot); owner._proceduralMotionRoot = this.visualRoot;
    this.legs = [owner.leftLeg, owner.rightLeg].filter(Boolean).map(legSupport);
    this.arms = [owner.leftArm, owner.rightArm].filter(Boolean).map(node => ({ node, rest: node.quaternion.clone(), applied: null }));
    this.diagnostics = { supportVertices: this.legs.map(region => region.hull.length), maxObservedVisualOffset: 0, contactRefusals: 0, lastContactError: null };
    this._rotation = new THREE.Quaternion();
    this._disposed = false;
  }

  resetVisualOffset() {
    this.visualRoot.position.y = 0;
    this.state.visualOffsetY = 0; this.state.supportMinimumY = null;
    if (this.owner.laserGroup) {
      const imported = this.owner._importedCharacter;
      this.owner.laserGroup.position.y = imported ? (imported.laserBaseY ?? 0) + (imported.adapter.visualGroundOffsetY ?? 0) : 0;
    }
  }

  reset(position = this.owner.position) {
    this.lastPosition.copy(position);
    for (const region of this.legs) region.leg.quaternion.copy(region.rest);
    for (const arm of this.arms) {
      if (arm.applied && closeRotation(arm.node.quaternion, arm.applied)) arm.node.quaternion.copy(arm.rest);
      arm.applied = null;
    }
    Object.assign(this.state, { phase: 0, strength: 0, speed: 0, moving: false, runBlend: 0,
      travelledDistance: 0, stepCount: 0, grounded: true, teleports: 0 });
    this.resetVisualOffset();
  }

  _poseArms(swing) {
    const owner = this.owner;
    const blocked = owner.isAttacking || owner.isBlocking || owner.isMusouActive || owner.isLeaping ||
      owner.isPerched || owner.isFacehuggerLatched || owner.isPlasmaGlaiveActive;
    for (let index = 0; index < this.arms.length; index++) {
      const arm = this.arms[index];
      const owned = arm.applied && closeRotation(arm.node.quaternion, arm.applied);
      // A gadget, execution or attack can author a pose between simulation
      // updates. Only remove our own previous contribution; never erase it.
      if (owned) arm.node.quaternion.copy(arm.rest);
      arm.applied = null;
      if (blocked || !closeRotation(arm.node.quaternion, arm.rest)) continue;
      this._rotation.setFromAxisAngle(X_AXIS, swing * (index ? 1 : -1) * 0.48);
      arm.node.quaternion.copy(arm.rest).multiply(this._rotation);
      arm.applied = arm.node.quaternion.clone();
    }
  }

  _contact() {
    const owner = this.owner;
    if (owner._importedCharacter || !this.state.grounded || this.legs.length !== 2) {
      this.resetVisualOffset(); return;
    }
    let minimum = Infinity;
    for (const { leg, hull } of this.legs) {
      leg.updateMatrix();
      const e = leg.matrix.elements;
      if (Math.abs(e[1]) > 1e-8) { this._refuseContact('leg Y projection depends on unmeasured X'); return; }
      for (const [y, z] of hull) minimum = Math.min(minimum, e[5] * y + e[9] * z + e[13]);
    }
    const desired = -minimum;
    if (!Number.isFinite(desired) || Math.abs(desired) > this.maxVisualOffset) { this._refuseContact('required sole offset exceeds visual bound'); return; }
    this.visualRoot.position.y = desired; this.state.visualOffsetY = desired;
    this.state.supportMinimumY = minimum + desired;
    this.diagnostics.maxObservedVisualOffset = Math.max(this.diagnostics.maxObservedVisualOffset, Math.abs(desired));
    this.diagnostics.lastContactError = null;
    if (owner.laserGroup) owner.laserGroup.position.y = desired;
  }

  _refuseContact(reason) {
    this.resetVisualOffset(); this.diagnostics.contactRefusals++;
    this.diagnostics.lastContactError = reason;
  }

  update(delta) {
    if (this._disposed || !Number.isFinite(delta) || delta <= 0) return false;
    const owner = this.owner, state = this.state;
    const distance = Math.hypot(owner.position.x - this.lastPosition.x, owner.position.z - this.lastPosition.z);
    this.lastPosition.copy(owner.position);
    state.grounded = !owner.isLeaping && !owner.isPerched && Math.abs(owner.position.y) < 0.05;
    const teleported = distance > Math.max(2, Math.max(1, owner.moveSpeed) * delta * 3);
    if (teleported) state.teleports++;
    const allowed = !owner.isFacehuggerLatched && !owner.isPerched && !owner.isLeaping && owner.mesh.visible !== false;
    state.speed = allowed && !teleported ? distance / delta : 0;
    state.moving = state.speed > 0.2;
    if (state.moving) {
      state.travelledDistance += distance;
      state.phase = state.travelledDistance / state.cycleDistance * TAU % TAU;
      if (state.phase < 1e-10 || TAU - state.phase < 1e-10) state.phase = 0;
      state.stepCount = Math.floor(state.travelledDistance / state.cycleDistance * 2 + 1e-10);
    }
    state.strength = damp(state.strength, state.moving ? 1 : 0, state.moving ? 14 : 12, delta);
    state.runBlend = damp(state.runBlend, clamp01(state.speed / Math.max(1, owner.moveSpeed) * 1.4 - 0.4), 8, delta);
    if (state.strength < 1e-5) state.strength = 0;
    const swing = Math.sin(state.phase) * (0.22 + state.runBlend * 0.26) * state.strength;
    for (let index = 0; index < this.legs.length; index++) {
      const region = this.legs[index];
      this._rotation.setFromAxisAngle(X_AXIS, swing * (index ? -1 : 1));
      region.leg.quaternion.copy(region.rest).multiply(this._rotation);
    }
    this._poseArms(swing);
    this._contact();
    return true;
  }

  dispose() { if (this._disposed) return; this.reset(); this._disposed = true; }
}
