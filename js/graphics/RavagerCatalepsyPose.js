/* Local visual response to the existing strategic phase. Only actor-owned
 * transforms move: cached geometry/materials and the collision root stay put.
 * This procedural fall/get-up is an adaptation, not source animation capture. */
import * as THREE from 'three';

const poses = new WeakMap();
const ease = x => { const t = Math.max(0, Math.min(1, x)); return t * t * (3 - 2 * t); };

export function updateRavagerCatalepsyPose(actor, phase, time) {
  const visual = actor.ravagerVisual;
  if (!visual || !Number.isFinite(time)) return;
  let pose = poses.get(actor);
  if (phase && !pose) {
    pose = { position: visual.position.clone(), rotation: visual.rotation.clone(),
      bounds: new THREE.Box3(), recoverStartedAt: null };
    poses.set(actor, pose);
  }
  if (!pose) return;
  let fallen;
  if (phase) {
    pose.recoverStartedAt = null;
    fallen = ease((time - phase.startedAt) / .55);
  } else {
    pose.recoverStartedAt ??= time;
    fallen = 1 - ease((time - pose.recoverStartedAt) / .6);
  }
  visual.position.copy(pose.position);
  visual.rotation.copy(pose.rotation);
  visual.rotation.z -= Math.PI * .5 * fallen;
  visual.rotation.x += .08 * fallen;
  if (fallen > 0) {
    actor.mesh.updateMatrixWorld(true);
    pose.bounds.setFromObject(visual);
    // Keep the fallen anatomy above the SAME floor as its collision root.
    // This changes neither the saved XZ position nor the detailed actor count.
    visual.position.y += actor.mesh.position.y - pose.bounds.min.y;
  }
  visual.userData.ravagerCatalepsyPose = fallen > 0;
  if (!phase && fallen === 0) poses.delete(actor);
}
