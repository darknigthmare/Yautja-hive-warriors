import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';
import { HUNTER_ARSENAL_PROFILES, resolveHunterLoadout } from '../js/data/hunterArsenal.js';
import { HUNTER_COMBAT_STYLES } from '../js/data/hunterCombatStyles.js';
import { createHunterWeaponGeometry } from '../js/graphics/HunterModel.js';

const audio = new Proxy({}, { get: () => () => {} });
class OfflinePlayer extends Player { loadGeneratedVisual() { return Promise.resolve(false); } }
const actor = (id = 'jungle_hunter') => new OfflinePlayer(new THREE.Scene(), CHARACTERS_DATA.find(data => data.id === id), audio);

test('reference kits preserve their own sources and reject undocumented equipment while adapted kits retain crossovers', () => {
  for (const [id, reference] of Object.entries(HUNTER_ARSENAL_PROFILES)) {
    const resolved = resolveHunterLoadout(id, { fidelityMode: 'faithful', primary: 'viking_axe', secondary: 'compound_bow', gadgets: ['acid_solvent', 'nuke', 'bear_trap'] });
    assert.ok(reference.weapons.includes(resolved.primary)); assert.ok(reference.weapons.includes(resolved.secondary));
    assert.ok(resolved.gadgets.every(gadget => reference.gadgets.includes(gadget))); assert.ok(resolved.gadgets.length <= 2);
    assert.equal(reference.fidelity1to1Verified, false); assert.ok(reference.sourceUrls.every(url => url.startsWith('https://')));
  }
  assert.equal(resolveHunterLoadout('feral_predator', { fidelityMode: 'faithful' }).ranged, 'crossbow');
  assert.equal(resolveHunterLoadout('feral_predator', { fidelityMode: 'adapted', primary: 'viking_axe' }).primary, 'viking_axe');
  assert.equal(resolveHunterLoadout('unknown', { fidelityMode: 'faithful' }).ranged, null);
});

test('Feral reference mode hides its crossover cannon and fires finite solid bolts without plasma energy or charged plasma', () => {
  const player = actor('feral_predator');
  try {
    player.applyLoadout({ fidelityMode: 'faithful' });
    assert.equal(player._plasmaCasterVisual.visible, false); assert.equal(player._feralFoldedShield.visible, true);
    const energy = player.plasmaEnergy, children = player.scene.children.length;
    assert.equal(player.firePlasmaShot(true), null); assert.equal(player.plasmaEnergy, energy);
    assert.equal(player.firePlasmaPistol(), false); assert.equal(player.activateCyberExosuit(), false);
    assert.equal(player.scene.children.length, children);
    const shot = player.fireRangedShot(true);
    assert.equal(player.activeWeapon, 'crossbow'); assert.equal(player.secWeaponMesh.visible, true);
    assert.equal(shot.projectileKind, 'feral_bolt'); assert.equal(shot.isCharged, false);
    assert.equal(shot.energyCost, 0); assert.equal(shot.ammoCost, 1); assert.equal(player.feralBoltAmmo, 11);
    assert.equal(player.fireRangedShot(), null); player.update(.4); assert.equal(player.fireRangedShot(), null);
    player.update(.4); assert.ok(player.fireRangedShot()); assert.equal(player.plasmaEnergy, energy);
    const state = player.getWeaponState(); assert.equal(state.rangedResource, 'bolts'); assert.equal(state.rangedCost, 1); assert.equal(state.plasmaCost, 0);
    player.toggleShieldBlock(); assert.equal(player._feralFoldedShield.visible, false); assert.equal(player.shieldMesh.visible, true);
    player.toggleShieldBlock(); player.applyLoadout({ fidelityMode: 'adapted' });
    assert.equal(player._plasmaCasterVisual.visible, true); assert.equal(player._feralFoldedShield.visible, false);
    assert.ok(player.firePlasmaShot());
  } finally { player.dispose(); }
});

test('all wheel weapons have one selected state, explicit projectile actions and repeatable loadouts without stacked statistics', () => {
  const player = actor();
  try {
    const baseDamage = player.meleeDamage, baseSpeed = player.moveSpeed;
    player.applyTacticalLoadout({ primary: 'combistick', secondary: 'shuriken', gadgets: ['medicomp'] });
    player.applyTacticalLoadout({ primary: 'combistick', secondary: 'shuriken', gadgets: ['medicomp'] });
    assert.equal(player.meleeDamage, baseDamage); assert.equal(player.moveSpeed, baseSpeed); assert.equal(player.medicompCharges, 3);
    for (const id of ['wristblades', 'combistick', 'smart_disc', 'shuriken', 'katana', 'alpha_sickle', 'viking_axe', 'compound_bow', 'crossbow']) {
      assert.equal(player.selectWeapon(id, false), true); const state = player.getWeaponState();
      assert.equal(state.id, player.activeWeapon); assert.equal(player.secWeaponMesh.visible, id !== 'wristblades');
      assert.equal(state.action, ['smart_disc', 'shuriken', 'compound_bow', 'crossbow'].includes(id) ? 'projectile' : 'melee');
    }
    const selected = player.activeWeapon; assert.equal(player.selectWeapon('unknown'), false); assert.equal(player.activeWeapon, selected);
    player.applyLoadout({ fidelityMode: 'faithful' }); const first = player.activeWeapon;
    assert.equal(player.selectWeapon('viking_axe'), false); assert.equal(player.activeWeapon, first);
  } finally { player.dispose(); }
});

test('the seven hunters have distinct committed timings, costs, reach, mobility and finite light/heavy chains', () => {
  const signatures = new Set();
  for (const id of Object.keys(HUNTER_COMBAT_STYLES)) {
    const player = actor(id);
    try {
      const light = player.lightAttack(), afterLight = player.stamina;
      assert.ok(light.hitDelay > 0 && light.activeDuration > 0 && light.recovery > 0);
      assert.equal(light.duration, light.windup + light.activeDuration + light.recovery);
      assert.ok(light.hitDelay > light.windup && light.hitDelay < light.windup + light.activeDuration);
      assert.equal(player.stamina, 100 - light.staminaCost);
      assert.equal(player.lightAttack(), null); assert.equal(player.stamina, afterLight);
      player.update(light.duration + .01);
      const heavy = player.heavyAttack(); assert.ok(heavy && heavy.staminaCost > light.staminaCost);
      assert.equal(heavy.attackId, player.currentAttackId); assert.ok(heavy.hitDelay > 0);
      assert.equal(player.claimAttackImpact(heavy.attackId), true); assert.equal(player.claimAttackImpact(heavy.attackId), false);
      signatures.add([light.hitDelay, light.recovery, heavy.hitDelay, heavy.recovery, heavy.staminaCost, heavy.radius].join(','));
      assert.equal(player.getCombatState().definition, 'original_gameplay_adaptation');
    } finally { player.dispose(); }
  }
  assert.equal(signatures.size, 7);
});

test('attack phases, cancellation and stamina recovery use simulation seconds consistently at 30, 60 and 120 fps', () => {
  const results = [];
  for (const fps of [30, 60, 120]) {
    const player = actor();
    try {
      const attack = player.lightAttack(); const phases = new Set();
      for (let step = 0; step < fps; step++) { player.update(1 / fps); phases.add(player.getCombatState().window.phase); }
      assert.ok(phases.has('active') && phases.has('recovery') && phases.has('complete'));
      results.push(player.stamina);
      const next = player.lightAttack(); assert.ok(player.cancelAttack('guard')); assert.equal(player.claimAttackImpact(next.attackId), false);
      const stamina = player.stamina; player.update(0); player.update(NaN); assert.equal(player.stamina, stamina);
    } finally { player.dispose(); }
  }
  assert.ok(Math.max(...results) - Math.min(...results) < 1e-6);
});

test('mass finishers cannot bypass endurance or their style cooldown', () => {
  const player = actor('city_hunter');
  try {
    player.attackComboStep = 3; const first = player.heavyAttack(); assert.ok(first);
    player.update(first.duration + .01); player.attackComboStep = 3;
    const before = player.stamina; assert.equal(player.heavyAttack(), null); assert.equal(player.stamina, before);
    player.update(4); player.stamina = 0; assert.equal(player.heavyAttack(), null);
  } finally { player.dispose(); }
});

test('selected projectile profiles match actual admitted damage, resources and cooldowns', () => {
  const player = actor('wolf_predator');
  try {
    for (const id of ['smart_disc', 'shuriken', 'compound_bow']) {
      player.selectWeapon(id, false);
      const before = player.getWeaponState(), method = before.actionMethod;
      const shot = player[method]({ aliens: [] }); assert.ok(shot);
      assert.equal(shot.damage, before.actionDamage); assert.equal(before.actionResource, 'cooldown');
      assert.equal(before.actionCost, 0); assert.ok(before.actionCooldown > 0);
      assert.equal(player[method]({ aliens: [] }), null);
      assert.equal(player.getWeaponState().actionCooldownRemaining, before.actionCooldown);
      player.update(before.actionCooldown + .01); assert.ok(player[method]({ aliens: [] }));
    }
  } finally { player.dispose(); }
});

test('parry and shield require the attack context, spend reserves and cannot negate Queen-like hits or acid', () => {
  const player = actor('feral_predator');
  try {
    player.applyLoadout({ fidelityMode: 'faithful' }); player.toggleShieldBlock();
    const before = player.hp, stamina = player.stamina;
    player.takeDamage(100, false, null, { attackKind: 'bullet', blockable: true, parryable: false, blockRequiresShield: true });
    assert.equal(player.hp, before); assert.equal(player.stamina, stamina - 8);
    player.takeDamage(100, false, null, { attackKind: 'queen_tail', blockable: false, parryable: false });
    assert.equal(player.hp, before - 100);
    player.takeDamage(30, true, null, { attackKind: 'acid', blockable: false, parryable: false });
    assert.equal(player.hp, before - 130); assert.ok(player.visorAcidBurn > 0);
    player.toggleShieldBlock(); player.performWristbladeParry(audio, null, null);
    const attacker = { mesh: new THREE.Group(), hp: 100 };
    const hp = player.hp; player.takeDamage(50, false, attacker, { attackKind: 'yautja_blade', blockable: true, parryable: true });
    assert.equal(player.hp, hp); assert.equal(attacker.isStunned, true);
    player.update(1); assert.equal(player.parryTimer <= 0, true);
  } finally { player.dispose(); }
});

test('legacy timers and afterimages stop with their owner and never dispose live actor geometry', () => {
  const player = actor();
  try {
    const geometry = player.mesh.getObjectByName('continuous-anatomical-torso')?.geometry ?? (() => { let result; player.mesh.traverse(node => { if (!result && node.isMesh) result = node.geometry; }); return result; })();
    let sourceDisposals = 0, ticks = 0; geometry.addEventListener('dispose', () => sourceDisposals++);
    player.scheduleInterval(() => ticks++, 100); player.update(.35); assert.equal(ticks, 3);
    player.performHunterShadowDash(null, audio, null); assert.ok(player._effects.size > 0);
    player.update(.3); assert.equal(sourceDisposals, 0);
    player.dispose(); const savedTicks = ticks; player.update(1);
    assert.equal(ticks, savedTicks); assert.equal(player._effects.size, 0); assert.equal(player._timers.length, 0);
    assert.equal(sourceDisposals, 1);
  } finally { player.dispose(); }
});

test('legacy ranged damage obeys physical cover and faction relations before changing HP', () => {
  const player = actor(), previousWindow = globalThis.window;
  const makeTarget = factionId => ({ factionId, hp: 1000, type: 'warrior', mesh: new THREE.Group() });
  const enemy = makeTarget('hive'), ally = makeTarget('clan');
  enemy.mesh.position.set(0, 0, 4); ally.mesh.position.set(0, 0, 5);
  const horde = { aliens: [enemy, ally], battleSimulation: { config: { playerFaction: 'clan' }, areHostile: (a, b) => a !== b } };
  let visible = false, raycasts = 0;
  globalThis.window = { gameInstance: { env: { hasLineOfSight: () => { raycasts++; return visible; } } } };
  try {
    player.isFlamerActive = true; player.firePlasmaFlamer(.1, horde, null, null);
    assert.equal(enemy.hp, 1000); assert.equal(ally.hp, 1000); assert.ok(raycasts > 0);
    visible = true; player.firePlasmaFlamer(.1, horde, null, null);
    assert.equal(enemy.hp, 989); assert.equal(ally.hp, 1000);
    horde.battleSimulation.areHostile = () => false;
    player.firePlasmaFlamer(.1, horde, null, null); assert.equal(enemy.hp, 989);
  } finally { globalThis.window = previousWindow; player.dispose(); }
});

test('net pinning uses nearby physical walls on expanded maps and releases when a truce begins', () => {
  const player = actor('city_hunter'), previousWindow = globalThis.window;
  player.position.z = 120;
  const target = { hp: 1000, factionId: 'hive', mesh: new THREE.Group(), radius: 1 };
  target.mesh.position.set(0, 0, 125);
  const horde = { aliens: [target], battleSimulation: { config: { playerFaction: 'clan' }, areHostile: () => true } };
  let nearWall = false;
  globalThis.window = { gameInstance: { env: { hasLineOfSight: () => true, traceSegment: () => nearWall ? { distance: .6 } : null } } };
  try {
    assert.equal(player.fireNetgun(horde), true); assert.notEqual(target.isPinned, true);
    player.update(4.6); assert.equal(target.isNetEntangled, false);
    nearWall = true; assert.equal(player.fireNetgun(horde), true); assert.equal(target.isPinned, true);
    const hp = target.hp; horde.battleSimulation.areHostile = () => false; player.update(.1);
    assert.equal(target.hp, hp); assert.equal(target.isNetEntangled, false); assert.equal(target.isPinned, false);
  } finally { globalThis.window = previousWindow; player.dispose(); }
});

test('player elevation supplies its layer and an ascending jump stops at the shared physical ceiling', () => {
  const player = actor(), previousWindow = globalThis.window, layers = [];
  globalThis.window = { gameInstance: { env: {
    getElevationAt: (x, z, y) => { layers.push(y); return 0; },
    resolveVerticalMovement: (position, previousY, height) => { assert.equal(height, player.getCollisionHeight()); assert.ok(height >= player.cameraEyeHeight + .35); return position.y > previousY ? { blocked: true, point: new THREE.Vector3(position.x, 1, position.z) } : { blocked: false, point: position.clone() }; }
  } } };
  try {
    player.position.y = .5; player.move(new THREE.Vector3(), .01); assert.equal(layers[0], .5);
    player.position.y = .5; player.isLeaping = true; player.leapVelocityY = 18; player.update(.1);
    assert.equal(layers.at(-1), .5); assert.equal(player.position.y, 1); assert.equal(player.leapVelocityY, 0); assert.equal(player.isLeaping, true);
  } finally { globalThis.window = previousWindow; player.dispose(); }
});

test('bow, sickle, whip and physical bolt launcher are distinct finite silhouettes with bounded geometry', () => {
  const signatures = new Set();
  for (const id of ['compound_bow', 'alpha_sickle', 'plasma_whip', 'crossbow']) {
    const geometry = createHunterWeaponGeometry(id);
    try {
      geometry.computeBoundingBox(); const size = geometry.boundingBox.getSize(new THREE.Vector3());
      assert.ok(size.toArray().every(Number.isFinite)); assert.ok(geometry.attributes.position.array.every(Number.isFinite));
      assert.ok((geometry.index?.count ?? geometry.attributes.position.count) / 3 < 12000);
      signatures.add(size.toArray().map(value => value.toFixed(4)).join(','));
    } finally { geometry.dispose(); }
  }
  assert.equal(signatures.size, 4);
});
