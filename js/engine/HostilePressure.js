import * as THREE from 'three';

const warningWorldPosition = new THREE.Vector3();
const warningWorldScale = new THREE.Vector3();

// Shared by hostile factions: director owns concurrent attacks, while each
// manager keeps its own attack/recovery cadence. A standalone manager still
// prepares attacks using simulation time instead of render-frame probability.
export function selectHostileTarget(manager, origin, fallback) {
  return manager.combatDirector?.selectTarget(origin, fallback) ?? fallback;
}

export function requestHostileAttack(manager, attacker, target, delta, options) {
  if (!target || target.hp <= 0) return false;
  if (manager.combatDirector) return manager.combatDirector.requestAttack(attacker, target, options);
  const current = attacker._localAttackPreparation;
  if (!current || current.target !== target || current.kind !== options.kind) {
    attacker._localAttackPreparation = { target, kind: options.kind, elapsed: 0, windup: options.windup ?? 0.65 };
    return false;
  }
  current.elapsed += delta;
  if (current.elapsed + 1e-8 < current.windup) return false;
  attacker._localAttackPreparation = null;
  return true;
}

export function syncHostileWarning(manager, attacker, radius = 1.3) {
  const local = attacker._localAttackPreparation;
  const state = manager.combatDirector?.getAttackState(attacker) ?? (local ? { phase: 'windup', progress: local.elapsed / local.windup } : null);
  const preparing = state?.phase === 'windup';
  attacker.mesh.userData.attackTelegraph = preparing;
  if (!preparing) {
    if (attacker.attackWarning) attacker.attackWarning.visible = false;
    return;
  }
  if (!attacker.attackWarning) {
    const material = new THREE.MeshBasicMaterial({ color: 0xffb547, transparent: true, opacity: 0.7, side: THREE.DoubleSide, depthWrite: false, toneMapped: false });
    const warning = new THREE.Mesh(new THREE.RingGeometry(radius * 0.82, radius, 28), material);
    warning.name = 'hostile-attack-warning'; warning.rotation.x = -Math.PI / 2;
    warning.renderOrder = 2; warning.castShadow = warning.receiveShadow = false;
    attacker.mesh.add(warning); attacker.attackWarning = warning;
  }
  const warning = attacker.attackWarning;
  attacker.mesh.getWorldPosition(warningWorldPosition);
  attacker.mesh.getWorldScale(warningWorldScale);
  warning.visible = true; warning.position.y = (0.035 - warningWorldPosition.y) / warningWorldScale.y;
  const progress = Math.max(0, Math.min(1, state.progress ?? 0));
  warning.scale.setScalar((1 + progress * 0.15) / warningWorldScale.x);
  warning.material.opacity = 0.4 + progress * 0.5;
}

export function releaseHostileAttack(manager, attacker) {
  if (!attacker) return;
  manager.combatDirector?.release(attacker);
  attacker._localAttackPreparation = null;
  if (attacker.mesh) attacker.mesh.userData.attackTelegraph = false;
  if (attacker.attackWarning) {
    attacker.attackWarning.removeFromParent();
    attacker.attackWarning.geometry.dispose(); attacker.attackWarning.material.dispose();
    attacker.attackWarning = null;
  }
}
