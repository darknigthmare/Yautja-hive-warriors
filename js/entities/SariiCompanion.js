/* One source-inspired Sarii companion, with explicit orders and persistent
 * mission injuries. Joining never produces futuristic ammunition or score. */
import * as THREE from 'three';

const ORDERS = ['follow', 'hold', 'guard', 'retreat'];
export function prepareSarii(state) {
  if (!state) return null;
  state.id = 'sarii'; if (state.group) state.group.userData.uniqueNpcId = 'sarii'; state.maxHp = 120; state.hp ??= 120;
  state.order ??= 'follow'; state.wounded ??= false;
  state.home ??= state.pos.clone(); state.holdPosition ??= state.pos.clone();
  state.biteCooldown ??= .8; state.injuryCooldown ??= .75;
  state.withdrawals ??= 0;
  return state;
}

export function orderSarii(environment, owner, order = null) {
  const state = prepareSarii(environment.sariiCompanion);
  if (!state || !owner?.position || owner.hp <= 0 || !state.group?.visible) return false;
  if (!state.isTamed) { state.isTamed = true; state.owner = owner; state.order = 'follow'; }
  else {
    if (state.owner !== owner || state.wounded) return false;
    const next = order ?? ORDERS[(ORDERS.indexOf(state.order) + 1) % ORDERS.length];
    if (!ORDERS.includes(next)) return false;
    state.order = next;
  }
  if (state.order === 'hold') state.holdPosition.copy(state.pos);
  state.group.userData.companion = { id: state.id, order: state.order, hp: state.hp, wounded: state.wounded };
  return true;
}

export function damageSarii(environment, amount) {
  const state = prepareSarii(environment.sariiCompanion);
  if (!state?.isTamed || !Number.isFinite(amount) || amount <= 0 || state.hp <= 0) return false;
  state.hp = Math.max(0, state.hp - amount);
  if (state.hp <= state.maxHp * .35 && !state.wounded) {
    state.wounded = true; state.order = 'retreat'; state.withdrawals++;
    environment.onCompanionEvent?.({ type: 'companion-withdrawal', id: 'sarii', hp: state.hp });
  }
  return true;
}

const target = new THREE.Vector3(), next = new THREE.Vector3();
export function updateSarii(environment, delta, player, horde) {
  const state = prepareSarii(environment.sariiCompanion);
  if (!state?.isTamed || !state.group || !Number.isFinite(delta) || delta <= 0) return;
  const owner = state.owner ?? player;
  if (!owner?.position || owner.hp <= 0) state.order = 'retreat';
  state.biteCooldown = Math.max(0, state.biteCooldown - delta);
  state.injuryCooldown = Math.max(0, state.injuryCooldown - delta);
  const battle = environment.game?.battleSimulation;
  const hostile = alien => !alien.factionId || !battle?.areHostile || battle.areHostile('player_clan', alien.factionId);
  let nearest = null, distance = Infinity;
  for (const alien of horde?.aliens ?? []) {
    if (!alien?.mesh?.position || alien.hp <= 0 || !hostile(alien)) continue;
    const d = alien.mesh.position.distanceTo(state.pos);
    if (d < distance) { nearest = alien; distance = d; }
  }
  if (nearest && distance < 1.7 && state.order !== 'retreat' && state.injuryCooldown <= 1e-9) {
    damageSarii(environment, 8); state.injuryCooldown = .75;
  }
  if (state.order === 'retreat') target.copy(state.home);
  else if (state.order === 'hold') target.copy(state.holdPosition);
  else if (state.order === 'guard' && nearest && owner?.position && nearest.mesh.position.distanceTo(owner.position) < 5) target.copy(nearest.mesh.position);
  else target.copy(owner.position).add(new THREE.Vector3(1.8, 0, 1.4));
  target.y = .45;
  const d = state.pos.distanceTo(target), step = Math.min(d, (state.wounded ? 2.3 : 5.2) * delta);
  if (step > 1e-8) {
    next.copy(state.pos).lerp(target, step / d);
    environment.resolveMovement?.(next, .32);
    environment.resolveAgentMovement?.(next, target, step, .32);
    next.y = .45; state.pos.copy(next); state.group.position.copy(next);
    state.group.lookAt(target.x, .45, target.z);
  }
  if (state.order === 'guard' && !state.wounded && nearest && state.pos.distanceTo(nearest.mesh.position) < 1.65 && state.biteCooldown <= 1e-9) {
    // One bite, one target, one shared death/credit path; never an unbounded AoE.
    horde.applyDamage?.(nearest, 18, { cause: 'sarii', killerFaction: 'player_clan' });
    state.biteCooldown = .8;
  }
  if (state.order === 'retreat' && state.pos.distanceTo(state.home) < .6) state.retired = true;
  state.group.userData.companion = { id: state.id, order: state.order, hp: state.hp, wounded: state.wounded, retired: !!state.retired };
}
