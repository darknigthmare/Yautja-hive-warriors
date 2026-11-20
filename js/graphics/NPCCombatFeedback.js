import * as THREE from 'three';
import { disposeObject } from '../engine/SceneResources.js';

// Feedback is emitted only after the manager grants a real, terrain-tested hit.
// It owns no combatants, target references or score and never deals damage.
export function emitNPCShot(manager, from, to, kind = 'ballistic') {
  const effects = manager.npcShotEffects ??= [];
  if (effects.length >= 16) disposeObject(effects.shift().mesh);
  const group = new THREE.Group(); group.name = 'npc-confirmed-shot';
  const color = kind === 'fire' ? 0xff872d : 0xf5df9a;
  const material = new THREE.LineBasicMaterial({ color, transparent: true, opacity: .85, depthWrite: false, toneMapped: false });
  const tracer = new THREE.Line(new THREE.BufferGeometry().setFromPoints([from, to]), material);
  tracer.name = 'npc-shot-tracer'; group.add(tracer);
  const impact = new THREE.Mesh(new THREE.SphereGeometry(kind === 'fire' ? .22 : .12, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: .9, depthWrite: false, toneMapped: false }));
  impact.name = 'npc-shot-impact'; impact.position.copy(to); group.add(impact);
  manager.scene.add(group); effects.push({ mesh: group, life: kind === 'fire' ? .22 : .14 });
}

export function updateNPCShots(manager, delta) {
  const effects = manager.npcShotEffects;
  if (!effects) return;
  for (let i = effects.length - 1; i >= 0; i--) {
    effects[i].life -= delta;
    if (effects[i].life <= 0) { disposeObject(effects[i].mesh); effects.splice(i, 1); }
  }
}

export function clearNPCShots(manager) {
  for (const effect of manager.npcShotEffects ?? []) disposeObject(effect.mesh);
  manager.npcShotEffects = [];
}
