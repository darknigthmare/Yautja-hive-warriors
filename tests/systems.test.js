import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { Player } from '../js/entities/Player.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { BossManager } from '../js/entities/Bosses.js';
import { CheyenneDropship } from '../js/entities/CheyenneDropship.js';
import { DropPodEntrance } from '../js/entities/DropPodEntrance.js';
import { YautjaSkimmer } from '../js/entities/YautjaSkimmer.js';
import { SyntheticsManager } from '../js/entities/Synthetics.js';
import { ParticleSystem } from '../js/engine/ParticleSystem.js';
import { OrbitalStrikeManager } from '../js/engine/OrbitalStrike.js';
import { StoryCampaignManager, CAMPAIGN_CHAPTERS } from '../js/engine/StoryCampaign.js';
import { disposeObject } from '../js/engine/SceneResources.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { CHARACTERS_DATA } from '../js/data/charactersData.js';

const audio = new Proxy({}, { get: () => () => {} });
const origin = () => new THREE.Vector3();
function fighter(position = origin()) {
  return { position, hp: 1000, plasmaEnergy: 100, mesh: new THREE.Group(), audioEngine: audio,
    takeDamage(amount) { this.hp -= amount; }, triggerFacehuggerLatch() { this.isFacehuggerLatched = true; } };
}

test('campaign uses existing levels and completes once after all five bosses', () => {
  assert(CAMPAIGN_CHAPTERS.every(chapter => LEVELS_DATA.some(level => level.id === chapter.levelId)));
  const campaign = new StoryCampaignManager();
  campaign.startCampaign();
  for (let i = 0; i < 4; i++) assert.equal(campaign.completeChapter().nextChapter.chapter, i + 2);
  assert.deepEqual(campaign.completeChapter(), { victory: true });
  assert.equal(campaign.completeChapter(), null);
  assert.equal(campaign.isActive, false);
  campaign.reset();
  assert.equal(campaign.currentChapterIndex, 0);
});

test('sandbox and missions respect requested alien counts, including special enemies', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  for (const count of [0, 1, 5, 20, 35, 55]) {
    horde.spawnWave(count, origin());
    assert.equal(horde.aliens.length, count);
  }
  horde.clearWave();
  assert.equal(horde.scene.children.length, 0);
});

test('allied kills and consumed facehuggers no longer block the next wave', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.spawnWave(2, origin());
  horde.aliens[0].hp = 0;
  horde.aliens[1].isLatched = true;
  horde.update(0, fighter());
  assert.equal(horde.aliens.length, 0);
  assert.equal(horde.deadCount, 1);
});

test('egg hatching advances only during simulation and clearWave cancels it', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.spawnOvimorphEggs(origin(), 1);
  const player = fighter(horde.eggs[0].mesh.position.clone());
  horde.update(0.1, player);
  assert.equal(horde.aliens.length, 0);
  horde.update(0.71, player);
  assert.equal(horde.aliens.length, 1);
  horde.clearWave();
  horde.update(2, player);
  assert.equal(horde.aliens.length, 0);
});

test('each alien targets the nearest living cooperative player', () => {
  const scene = new THREE.Scene();
  const horde = new XenomorphHorde(scene, audio);
  const mesh = new THREE.Group();
  scene.add(mesh);
  horde.aliens.push({ mesh, type: 'warrior', hp: 100, maxHp: 100, speed: 2, damage: 25, radius: 1 });
  const p1 = fighter(new THREE.Vector3(20, 0, 0));
  const p2 = fighter(new THREE.Vector3(0.5, 0, 0));
  horde.update(0.1, p1, p2);
  assert.equal(p1.hp, 1000);
  assert.equal(p2.hp, 997.5);
  p2.hp = 0;
  horde.update(0.1, p1, p2);
  assert(mesh.position.x > 0);
});

test('invalid combat damage cannot heal enemies or poison their health', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.spawnWave(1, origin());
  const alien = horde.aliens[0];
  const hp = alien.hp;
  assert.deepEqual(horde.checkMeleeHits({ origin: alien.mesh.position, damage: NaN, radius: 10 }), []);
  assert.equal(alien.hp, hp);
});

test('boss death clears projectiles and a running tail whip safely', () => {
  const scene = new THREE.Scene();
  const boss = new BossManager(scene, audio);
  const player = fighter(new THREE.Vector3(5, 0, 0));
  boss.spawnBoss('xenomorph_queen', origin());
  boss.triggerTailWhip(player);
  boss.spitAcidMortar(player);
  boss.takeDamage(10000);
  assert.equal(boss.activeBoss, null);
  assert.equal(boss.acidSpitProjectiles.length, 0);
  assert.equal(scene.children.length, 0);
  assert.doesNotThrow(() => boss.update(1, player));
});

test('Offspring drains the actual plasma meter and never refills empty energy', () => {
  const boss = new BossManager(new THREE.Scene(), audio);
  boss.spawnBoss('the_offspring', origin());
  const player = fighter(new THREE.Vector3(5, 0, 0));
  player.plasmaEnergy = 0;
  boss.activeBoss.shriekCooldown = 0.1;
  boss.update(0.2, player);
  assert.equal(player.plasmaEnergy, 0);
  assert.equal('energy' in player, false);
});

test('airstrike snapshots target position and cannot leak napalm into the next mission', () => {
  const scene = new THREE.Scene();
  const ship = new CheyenneDropship(scene, audio);
  let hits = 0;
  const horde = { checkMeleeHits() { hits++; return []; } };
  const target = origin();
  ship.triggerAirstrike(target, horde);
  target.set(100, 0, 100);
  ship.update(0.7, horde);
  assert.equal(ship.napalmPools[0].pos.x, -12);
  assert.equal(ship.napalmPools[0].pos.z, -15);
  ship.clear();
  const before = hits;
  ship.update(10, horde);
  assert.equal(hits, before);
  assert.equal(scene.children.length, 0);
});

test('drop pod insertion uses simulation time and clear cancels its completion callback', () => {
  const scene = new THREE.Scene();
  const pod = new DropPodEntrance(scene, audio);
  let landed = 0;
  pod.triggerDrop(origin(), () => landed++);
  pod.update(0.25);
  assert.ok(pod.podMesh.position.y > 0 && pod.podMesh.position.y < 60);
  pod.clear();
  pod.update(10);
  assert.equal(landed, 0);
  pod.triggerDrop(origin(), () => landed++);
  pod.update(pod.duration);
  assert.equal(landed, 1);
  pod.clear();
  assert.equal(scene.children.length, 0);
});

test('loadout changes real weapon behavior and gadget quantities without stacking stats', () => {
  const player = new Player(new THREE.Scene(), CHARACTERS_DATA[0], audio);
  player.applyLoadout(null);
  const normalDamage = player.lightAttack().damage;
  player.isAttacking = false;
  player.attackComboStep = 0;
  player.applyLoadout({ primary: 'katana', secondary: 'shuriken', gadgets: ['acid_solvent', 'nuke'] });
  assert.equal(player.medicompCharges, 0);
  assert.equal(player.acidSolventCharges, 2);
  assert.equal(player.bearTrapCharges, 0);
  assert.equal(player.hasGadget('nuke'), true);
  assert(player.lightAttack().damage > normalDamage);
  player.applyLoadout({ primary: 'katana', gadgets: [] });
  assert.equal(player.meleeDamage, CHARACTERS_DATA[0].stats.meleeDamage);
  assert.equal(player.selectWeapon('invalid'), false);
  player.dispose();
});

test('medicomp at full health preserves its limited charge', () => {
  const player = new Player(new THREE.Scene(), CHARACTERS_DATA[0], audio);
  assert.equal(player.useMedicomp(), false);
  assert.equal(player.medicompCharges, 3);
  player.hp -= 200;
  assert.equal(player.useMedicomp(), true);
  assert.equal(player.hp, player.maxHp);
  assert.equal(player.medicompCharges, 2);
  player.dispose();
});

test('player disposal cancels delayed abilities and frees external effects', () => {
  const scene = new THREE.Scene();
  const player = new Player(scene, CHARACTERS_DATA[0], audio);
  let called = 0;
  player.schedule(() => called++, 100);
  player.update(0.05);
  assert.equal(called, 0);
  player.dispose();
  player.update(1);
  assert.equal(called, 0);
  assert.equal(scene.children.length, 0);
});

test('particles and decals stay within a bounded resource budget and clear completely', () => {
  const scene = new THREE.Scene();
  const particles = new ParticleSystem(scene);
  particles.emitSparks(origin(), 2000);
  assert.equal(particles.particles.length, 500);
  for (let i = 0; i < 60; i++) particles.spawnPlasmaScorch(origin());
  assert.equal(particles.decals.length, 40);
  particles.update(20, new THREE.PerspectiveCamera());
  assert.equal(particles.particles.length, 0);
  assert.equal(particles.decals.length, 0);
  assert.equal(scene.children.length, 0);
});

test('orbital strike respects boss distance and releases its beam', () => {
  const scene = new THREE.Scene();
  const orbital = new OrbitalStrikeManager(scene, audio);
  let bossDamage = 0;
  const boss = { activeBoss: { mesh: new THREE.Group() }, takeDamage(amount) { bossDamage += amount; } };
  boss.activeBoss.mesh.position.x = 100;
  const horde = { checkMeleeHits: () => [] };
  orbital.triggerStrike(origin(), horde, boss, {});
  assert.equal(bossDamage, 0);
  orbital.clear();
  boss.activeBoss.mesh.position.x = 10;
  orbital.triggerStrike(origin(), horde, boss, {});
  assert.equal(bossDamage, 2000);
  orbital.clear();
  assert.equal(scene.children.length, 0);
  assert.equal(orbital.cooldown, 0);
});

test('GPU cleanup disposes owned resources while retaining manager shared materials', () => {
  const scene = new THREE.Scene();
  const geometry = new THREE.BoxGeometry();
  const material = new THREE.MeshBasicMaterial();
  const mesh = new THREE.Mesh(geometry, material);
  let geometryReleased = 0, materialReleased = 0;
  geometry.addEventListener('dispose', () => geometryReleased++);
  material.addEventListener('dispose', () => materialReleased++);
  scene.add(mesh);
  disposeObject(mesh, new Set([material]));
  assert.equal(geometryReleased, 1);
  assert.equal(materialReleased, 0);
  assert.equal(scene.children.length, 0);
});


test('capsule stays open after insertion then fades and releases the scene', () => {
  const scene = new THREE.Scene();
  const pod = new DropPodEntrance(scene, audio);
  pod.triggerDrop(origin());
  pod.update(pod.duration);
  assert(pod.podMesh);
  assert.equal(pod.doorMesh.userData.opening, 1);
  pod.update(20.5);
  assert(pod.podMesh);
  pod.update(0.6);
  assert.equal(pod.podMesh, null);
  assert.equal(scene.children.length, 0);
});

test('skimmer mount consumes the key and reset restores a fresh vehicle state', () => {
  const skimmer = new YautjaSkimmer(new THREE.Scene(), audio);
  const player = fighter();
  skimmer.spawnAt(origin());
  const keys = { KeyG: true };
  skimmer.update(0.1, player, { aliens: [] }, keys);
  assert.equal(skimmer.isMounted, true);
  assert.equal(keys.KeyG, false);
  skimmer.update(1, player, { aliens: [] }, keys);
  assert.equal(skimmer.isMounted, true);
  skimmer.clear();
  assert.equal(skimmer.isMounted, false);
  assert.equal(skimmer.mesh.visible, false);
});

test('synthetic blood uses bounded simulation lifetimes and clear removes all drops', () => {
  const scene = new THREE.Scene();
  const synthetics = new SyntheticsManager(scene, audio);
  for (let i = 0; i < 100; i++) synthetics.emitWhiteSyntheticBlood(origin());
  assert.equal(synthetics.bloodDrops.length, 80);
  synthetics.clearSquad();
  synthetics.update(1, fighter(), { aliens: [] });
  assert.equal(synthetics.bloodDrops.length, 0);
  assert.equal(scene.children.length, 0);
});


test('chestbursters can be killed rather than remaining invulnerable hazards', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  horde.spawnChestburster(origin());
  const hits = horde.checkMeleeHits({ origin: origin(), radius: 2, damage: 50 });
  assert.equal(hits.length, 1);
  assert.equal(hits[0].killed, true);
  assert.equal(horde.chestbursters.length, 0);
  assert.equal(horde.deadCount, 1);
});

test('repeated acid splashback and kill effects keep bounded hazard counts', () => {
  const horde = new XenomorphHorde(new THREE.Scene(), audio);
  for (let i = 0; i < 200; i++) {
    horde.spawnAcidPool(origin());
    horde.spawnZeroGAcidGlobule(origin());
    horde.spawnAcidSplash(origin(), new THREE.Vector3(1, 0, 0));
  }
  assert.equal(horde.acidPools.length, 80);
  assert.equal(horde.zeroGAcidGlobules.length, 80);
  assert.equal(horde.acidSplashes.length, 160);
  horde.clearWave();
  assert.equal(horde.scene.children.length, 0);
});

test('real horde pursuit skirts a pyramid prop and reaches the nearest cooperative player', async () => {
  const { EnvironmentManager } = await import('../js/entities/Environment.js');
  const scene = new THREE.Scene();
  const environment = new EnvironmentManager(scene);
  environment.buildLevelEnvironment(LEVELS_DATA.find(level => level.id === 'antarctic_pyramid'));
  const horde = new XenomorphHorde(scene, audio);
  horde.environment = environment;
  const mesh = new THREE.Group();
  mesh.position.set(-50, 0, -37);
  scene.add(mesh);
  horde.aliens.push({ mesh, type: 'warrior', hp: 100, maxHp: 100, speed: 6, damage: 25, radius: 1.1 });
  const p1 = fighter(new THREE.Vector3(40, 0, 40));
  const p2 = fighter(new THREE.Vector3(-24, 0, -37));
  const prop = environment.colliders.find(collider => collider.x === -37 && collider.z === -37 && collider.halfWidth);
  assert(prop, 'the selected route must cross a real solid level prop');
  for (let step = 0; step < 400 && p2.hp === 1000; step++) {
    horde.update(0.05, p1, p2);
    assert(!(Math.abs(mesh.position.x - prop.x) < prop.halfWidth && Math.abs(mesh.position.z - prop.z) < prop.halfDepth), 'alien crossed the solid prop');
    assert(mesh.position.toArray().every(Number.isFinite));
    assert.equal(mesh.position.y, 0);
  }
  assert.equal(p1.hp, 1000);
  assert(p2.hp < 1000, 'alien must reach and attack its player rather than stick against the prop');
  assert(mesh.position.distanceTo(p2.position) < 1.2);
  horde.clearWave();
  environment.clearEnvironment();
});

test('ground steering does not clamp airborne enemies or replace active Crusher dashes', () => {
  const scene = new THREE.Scene();
  const horde = new XenomorphHorde(scene, audio);
  let groundResolutions = 0;
  horde.environment = { resolveAgentMovement() { groundResolutions++; } };
  const airborneMesh = new THREE.Group();
  airborneMesh.position.y = 5;
  const crusherMesh = new THREE.Group();
  crusherMesh.position.set(10, 0, 10);
  scene.add(airborneMesh, crusherMesh);
  horde.aliens.push({ mesh: airborneMesh, type: 'warrior', hp: 100, isAirborne: true,
    airborneVelY: 10, airborneVelHoriz: new THREE.Vector3(1, 0, 0) });
  horde.aliens.push({ mesh: crusherMesh, type: 'crusher', hp: 1000, maxHp: 1000,
    isCharging: true, chargeDuration: 2, speed: 22, damage: 40, radius: 2 });
  horde.update(0.05, fighter(new THREE.Vector3(-10, 0, -10)));
  assert.equal(groundResolutions, 0);
  assert(airborneMesh.position.y > 5);
  assert(crusherMesh.position.x < 10);
});
