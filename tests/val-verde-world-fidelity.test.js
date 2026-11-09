import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import * as THREE from 'three';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { DropPodEntrance } from '../js/entities/DropPodEntrance.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { cameraNearPlaneRadius, resolveThirdPersonCamera } from '../js/engine/CameraCollision.js';
import { corrugatedRoofGeometry, moveMeasuredStairTraversal, VAL_VERDE_FIELD_PLACEMENT } from '../js/graphics/ValVerdeFieldStructures.js';
import { sculptedTreeCrownGeometry, sculptedFernGeometry } from '../js/graphics/EnvironmentSculpt.js';
import { updateReferenceContacts } from '../js/graphics/ReferenceWorldContacts.js';
import { referenceAccessWaypoint } from '../js/entities/ReferenceWalkSurfaces.js';
import { Player } from '../js/entities/Player.js';

const source = readFileSync(new URL('../js/main.js', import.meta.url), 'utf8');
const GameApp = vm.runInNewContext(`${source.slice(source.indexOf('class GameApp'), source.indexOf("window.addEventListener('DOMContentLoaded'"))};GameApp`,
  { THREE, cameraNearPlaneRadius, resolveThirdPersonCamera });
const valVerde = LEVELS_DATA.find(level => level.id === 'val_verde_jungle');

function insertionGame(environment) {
  const actor = x => { const mesh = new THREE.Group(); mesh.position.x = x; return { mesh, position: mesh.position.clone(), rotationY: 0 }; };
  const game = Object.create(GameApp.prototype);
  Object.assign(game, { env: environment, player: actor(0), player2: actor(6),
    isPlaying: true, isPaused: false, photoMode: { isActive: false }, weaponWheel: { isOpen: false },
    renderer: { camera: new THREE.PerspectiveCamera(56, 16 / 9, .15, 600), cameraP2: new THREE.PerspectiveCamera(56, 8 / 9, .15, 600) },
    weather: { update() {} }, particles: { update() {} }, ui: { updateHUD() {}, updateBattlefieldHUD() {} },
    apc: { getSupportState() {} }, dropship: { getSupportState() {} }, updateInsertionStatus() {} });
  const modelFactory = () => ({ group: new THREE.Group(), seatPosition: new THREE.Vector3(), exitPosition: new THREE.Vector3(0, 0, 4.2), updateOpening() {} });
  game.dropPod = new DropPodEntrance(new THREE.Scene(), null, null, { modelFactory });
  game.dropPod.triggerDrop(new THREE.Vector3(), null, { players: [game.player, game.player2] });
  game.updateInsertionPresentation(0, true);
  return game;
}

function belongsToEnvironmentProp(environment, hit, group) {
  let node = hit.object;
  if (node.isInstancedMesh) node = environment.referenceBatches.find(record => record.mesh === node)?.entries[hit.instanceId]?.parent;
  while (node) { if (node === group) return true; node = node.parent; }
  return false;
}

function renderHits(environment, from, to) {
  const delta = to.clone().sub(from), ray = new THREE.Raycaster(from, delta.clone().normalize(), .01, delta.length() - .01);
  return ray.intersectObject(environment.root, true);
}

test('two real insertion cameras retain body sightlines past the relocated camp structures throughout opening and exit', () => {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
  environment.buildLevelEnvironment({ ...valVerde, strategicMode: true, mapSeed: 1 });
  const game = insertionGame(environment);
  let rays = 0;
  try {
    const shack = environment.rebelFuelDepot.shackGroup, tower = environment.guerrillaWatchtower.group;
    for (let frame = 0; frame < 320 && game.dropPod.isActive; frame++) {
      game.update(1 / 60); scene.updateMatrixWorld(true);
      if (!['opening', 'exiting'].includes(game.dropPod.phase)) continue;
      for (const [player, camera] of [[game.player, game.renderer.camera], [game.player2, game.renderer.cameraP2]]) {
        for (const height of [.4, 1.4, 2.4]) for (const side of [-.35, .35]) {
          const target = player.mesh.position.clone().add(new THREE.Vector3(side, height, 0));
          const hits = renderHits(environment, camera.position, target);
          assert.equal(hits.some(hit => belongsToEnvironmentProp(environment, hit, shack) || belongsToEnvironmentProp(environment, hit, tower)), false,
            `camp geometry occludes body in ${game.dropPod.phase} at ${game.dropPod.elapsed}`);
          rays++;
        }
      }
    }
    assert.ok(rays > 2000, `actual camera samples: ${rays}`);
    // Regression witnesses from the old screenshot, including the lower legs.
    for (const [from, to] of [[[8, 6, 17], [0, .5, 4.2]], [[14, 6, 17], [6, 2, 4.2]], [[0, 10, 20.2], [0, .5, 4.2]], [[6, 10, 20.2], [6, .5, 4.2]]]) {
      assert.equal(renderHits(environment, new THREE.Vector3(...from), new THREE.Vector3(...to))
        .some(hit => belongsToEnvironmentProp(environment, hit, shack) || belongsToEnvironmentProp(environment, hit, tower)), false);
    }
    assert.deepEqual(game.player.position.toArray(), [0, 0, 4.2]);
    assert.deepEqual(game.player2.position.toArray(), [6, 0, 4.2]);
  } finally { game.dropPod.clear(); environment.clearEnvironment(); }
});

test('moved walls and timber posts retain real collision, culling-independent cover and clear insertion/cardinal routes', () => {
  for (const mapSeed of [1, 7, 23]) {
    const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
    try {
      environment.buildLevelEnvironment({ ...valVerde, strategicMode: true, mapSeed }); scene.updateMatrixWorld(true);
      const shack = environment.rebelFuelDepot.shackGroup, tower = environment.guerrillaWatchtower.group;
      assert.deepEqual(shack.position.toArray(), VAL_VERDE_FIELD_PLACEMENT.shack);
      assert.deepEqual(environment.rebelFuelDepot.shackPos.toArray(), shack.position.toArray());
      assert.deepEqual(tower.position.toArray(), VAL_VERDE_FIELD_PLACEMENT.watchtower);
      assert.deepEqual(environment.guerrillaWatchtower.pos.toArray(), tower.position.toArray());
      const contacts = environment.referenceContacts.filter(contact => contact.parent === shack || contact.parent === tower);
      assert.equal(contacts.filter(contact => contact.mesh.name.startsWith('shack-')).length, 5);
      assert.equal(contacts.filter(contact => contact.mesh.name === 'watchtower-grounded-post').length, 4);
      for (const { collider, localBounds, parent, mesh } of contacts) {
        const box = localBounds.clone().applyMatrix4(parent.matrixWorld.clone().multiply(mesh.matrix));
        assert.ok(Math.abs(collider.x - (box.min.x + box.max.x) / 2) < 1e-7);
        assert.ok(Math.abs(collider.halfWidth - (box.max.x - box.min.x) / 2) < 1e-7);
        const from = new THREE.Vector3(collider.x, .8, collider.z - collider.halfDepth - .5);
        const to = new THREE.Vector3(collider.x, .8, collider.z + collider.halfDepth + .5);
        assert.ok(environment.traceSegment(from, to), `${mesh.name}: projectile cover`);
        const inside = new THREE.Vector3(collider.x, 0, collider.z), prior = inside.clone();
        environment.resolveMovement(inside, .65); assert.ok(inside.distanceTo(prior) > .1, `${mesh.name}: actor cover`);
      }
      for (const x of [0, 6]) for (const z of [0, 1.4, 2.8, 4.2, 6]) {
        const point = new THREE.Vector3(x, 0, z), prior = point.clone();
        environment.resolveMovement(point, .65); assert.ok(point.distanceTo(prior) < 1e-7, 'both full exit lanes remain physical free space');
      }
      for (const x of [-35, -25, -15, 15, 25, 35]) {
        const point = new THREE.Vector3(x, 0, 0), prior = point.clone();
        environment.resolveMovement(point, .65); assert.ok(point.distanceTo(prior) < 1e-7, 'east/west primary lane');
      }
      // Render interest is allowed to cull a distant building; physical cover
      // must remain, then follow a genuine mechanism visibility change.
      const interest = environment.referenceInterest.find(record => { let parent = shack.parent; while (parent) { if (parent === record.wrapper) return true; parent = parent.parent; } return false; });
      assert.ok(interest);
      interest.wrapper.visible = false; updateReferenceContacts(environment);
      assert.ok(contacts.every(contact => contact.collider.enabled));
      shack.visible = false; updateReferenceContacts(environment);
      assert.ok(contacts.filter(contact => contact.parent === shack).every(contact => !contact.collider.enabled));
      assert.ok(contacts.filter(contact => contact.parent === tower).every(contact => contact.collider.enabled));
    } finally { environment.clearEnvironment(); }
    assert.equal(scene.children.length, 0);
    assert.equal(environment.colliders.length, 0);
  }
});

test('profiled roof and botanical silhouettes have bounded, finite geometry with non-tropical branches preserved', () => {
  const roof = corrugatedRoofGeometry(), broadleaf = sculptedTreeCrownGeometry(true), distant = sculptedTreeCrownGeometry(true, true);
  const tropicalFern = sculptedFernGeometry(true), temperateFern = sculptedFernGeometry(false), temperateCrown = sculptedTreeCrownGeometry(false);
  try {
    assert.equal(roof.userData.fieldStructure, 'pitched-corrugated-tin');
    assert.equal(roof.index.count / 3, 6000);
    assert.ok(roof.userData.corrugationPitchMetres > .084 && roof.userData.corrugationPitchMetres < .086);
    assert.equal(roof.userData.roofProfile.amplitude, .014);
    const position = roof.attributes.position;
    const ridgeHeights = new Set(Array.from({ length: roof.userData.roofProfile.columns + 1 }, (_, index) => position.getY(index).toFixed(4)));
    assert.ok(ridgeHeights.size > 3, 'sheet profile is geometry, not a flat roof with a normal-map label');
    assert.equal(broadleaf.userData.leafCount, 384);
    assert.equal(broadleaf.index.count / 3, 4608);
    assert.equal(distant.index.count / 3, 576, 'the distant crown remains cheaper');
    assert.equal(tropicalFern.userData.leafCount, 98);
    assert.equal(temperateFern.userData.leafCount, 50);
    assert.equal(temperateCrown.index.count / 3, 4704);
    for (const geometry of [roof, broadleaf, distant, tropicalFern, temperateFern, temperateCrown]) {
      for (const attribute of Object.values(geometry.attributes)) assert.ok(attribute.array.every(Number.isFinite));
      assert.ok(geometry.index.array.every(index => index < geometry.attributes.position.count));
    }
  } finally { [roof, broadleaf, distant, tropicalFern, temperateFern, temperateCrown].forEach(geometry => geometry.dispose()); }
});

test('relocated deck, timber ladder treads and corrugated roof use their visible upper triangles with no old phantom floors', () => {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
  try {
    environment.buildLevelEnvironment({ ...valVerde, strategicMode: true, mapSeed: 1 }); scene.updateMatrixWorld(true);
    const tower = environment.guerrillaWatchtower.group, shack = environment.rebelFuelDepot.shackGroup;
    const deck = environment.referenceWalkSurfaces.find(surface => surface.id === 'val-verde-watchtower-deck');
    const ladder = environment.referenceWalkSurfaces.find(surface => surface.id === 'val-verde-watchtower-treads');
    const roof = environment.referenceWalkSurfaces.find(surface => surface.id === 'val-verde-shack-roof');
    assert.ok(deck && ladder && roof);
    assert.ok(ladder.mesh.userData.referenceWalkContactOnly);
    assert.equal(environment.referenceContacts.some(contact => contact.mesh === ladder.mesh), false, 'a stair flight cannot get a duplicate solid vertical AABB');
    assert.equal(environment.getElevationAt(8, 6), 0, 'old tower position has no ghost deck');
    assert.equal(environment.getElevationAt(2, 10), 0, 'old communications shack has no ghost roof');
    assert.equal(environment.getElevationAt(tower.position.x, tower.position.z, 0), 0, 'a raised deck cannot teleport an actor from below');
    assert.equal(environment.getPlacementElevationAt(tower.position.x, tower.position.z), 0);
    const actor = new THREE.Vector3(tower.position.x, 0, ladder.bounds.minZ - .12);
    let raisedSteps = 0;
    while (actor.z < tower.position.z) {
      const before = actor.clone(); actor.z += .025;
      actor.y = environment.getElevationAt(actor.x, actor.z, before.y);
      const expected = actor.clone(); environment.resolveMovement(actor, .65);
      assert.ok(actor.distanceTo(expected) < 1e-7, `actual timber access obstructed at ${actor.toArray()}`);
      assert.ok(actor.y - before.y <= .65, 'no invisible steep ramp or unsupported jump');
      if (actor.y > before.y + .1) raisedSteps++;
    }
    assert.ok(raisedSteps >= 17);
    assert.ok(Math.abs(actor.y - 5.59) < 1e-7);
    for (const surface of [deck, ladder, roof]) {
      const samples = surface === ladder ? ladder.mesh.userData.ladderSteps.map(step => [tower.position.x, tower.position.z + (step.minZ + step.maxZ) / 2])
        : surface === roof ? [[-.91, -.72], [.13, 1.18], [1.43, -1.37], [2.19, .22]].map(([x, z]) => [shack.position.x + x, shack.position.z + z])
          : [[tower.position.x + .4, tower.position.z + .15]];
      for (const [x, z] of samples) {
        const expected = surface.heightAt(x, z);
        const hit = surface.collider.traceSegment(new THREE.Vector3(x, expected + .3, z), new THREE.Vector3(x, expected - .3, z));
        assert.ok(hit, `${surface.id}: rendered triangles supply cover`);
        assert.ok(Math.abs(hit.point.y - expected) < 1e-5, `${surface.id}: visible top and support height must agree`);
      }
    }
    environment.referenceRoot.visible = false;
    assert.ok(deck.collider.traceSegment(new THREE.Vector3(actor.x, 6, tower.position.z + .15), new THREE.Vector3(actor.x, 5, tower.position.z + .15)), 'render culling keeps the true deck contact');
  } finally { environment.clearEnvironment(); }
});

test('removing either field structure immediately removes its floors and vertical route, then a seeded saved-world rebuild restores fresh measured surfaces', () => {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
  const config = { ...valVerde, mapId: 'LD-05', strategicMode: true, mapSeed: 23 };
  try {
    environment.buildLevelEnvironment(config); scene.updateMatrixWorld(true);
    const tower = environment.guerrillaWatchtower.group, shack = environment.rebelFuelDepot.shackGroup;
    const surfaces = environment.referenceWalkSurfaces.filter(surface => surface.id.startsWith('val-verde-watchtower-') || surface.id === 'val-verde-shack-roof');
    assert.equal(surfaces.length, 3);
    const deck = surfaces.find(surface => surface.id === 'val-verde-watchtower-deck');
    const from = tower.position.clone().add(new THREE.Vector3(0, 0, -5));
    const target = tower.position.clone().add(new THREE.Vector3(0, 5.59, .15));
    assert.ok(environment.getVerticalNavigationTarget(from, target));
    environment.referenceRoot.visible = false;
    assert.ok(surfaces.every(surface => surface.collider.isCollisionActive()), 'render root culling cannot remove physical support');
    environment.referenceRoot.visible = true;
    deck.mesh.visible = false;
    assert.equal(deck.collider.isCollisionActive(), false, 'a genuinely removed render surface has no support');
    deck.mesh.visible = true; deck.mesh.userData.physicsRemoved = true;
    assert.equal(deck.collider.isCollisionActive(), false);
    delete deck.mesh.userData.physicsRemoved;
    const saved = JSON.parse(JSON.stringify({ levelId: valVerde.id, mapId: 'LD-05', scene: { mapSeed: 23 },
      tacticalWorld: environment.serializeTacticalWorld(), upperActorPosition: target.toArray() }));
    const before = { shack: shack.position.toArray(), tower: tower.position.toArray(), contacts: environment.colliders.length,
      sectorCenters: environment.battlefieldLayout.sectors.map(sector => sector.center) };
    environment.removeReferenceObject(tower, shack);
    assert.equal(tower.parent, null); assert.equal(shack.parent, null);
    assert.ok(surfaces.every(surface => !surface.collider.isCollisionActive()));
    assert.equal(environment.getElevationAt(target.x, target.z, target.y), 0);
    assert.equal(environment.getElevationAt(shack.position.x, shack.position.z, 3.3), 0);
    assert.equal(referenceAccessWaypoint(environment, from, target), null);
    assert.equal(environment.getVerticalNavigationTarget(from, target), null);
    for (const surface of surfaces) {
      const x = (surface.bounds.minX + surface.bounds.maxX) / 2, z = (surface.bounds.minZ + surface.bounds.maxZ) / 2;
      assert.equal(surface.collider.traceSegment(new THREE.Vector3(x, 9, z), new THREE.Vector3(x, -1, z)), null);
    }
    environment.clearEnvironment();
    assert.equal(scene.children.length, 0); assert.equal(environment.referenceWalkSurfaces.length, 0);
    environment.buildLevelEnvironment({ ...valVerde, mapId: saved.mapId, strategicMode: true, mapSeed: saved.scene.mapSeed });
    assert.equal(environment.restoreTacticalWorld(saved.tacticalWorld), true);
    assert.deepEqual(environment.serializeTacticalWorld(), saved.tacticalWorld);
    assert.deepEqual(environment.rebelFuelDepot.shackGroup.position.toArray(), before.shack);
    assert.deepEqual(environment.guerrillaWatchtower.group.position.toArray(), before.tower);
    assert.deepEqual(environment.battlefieldLayout.sectors.map(sector => sector.center), before.sectorCenters);
    assert.equal(environment.colliders.length, before.contacts, 'rebuild cannot accumulate collider copies');
    const rebuilt = environment.referenceWalkSurfaces.filter(surface => surface.id.startsWith('val-verde-watchtower-') || surface.id === 'val-verde-shack-roof');
    assert.equal(rebuilt.length, 3);
    assert.ok(rebuilt.every(surface => surface.collider.isCollisionActive() && !surfaces.some(old => old.mesh === surface.mesh)));
    const restoredActor = new THREE.Vector3(...saved.upperActorPosition);
    assert.equal(environment.getElevationAt(restoredActor.x, restoredActor.z, restoredActor.y), 5.59);
    assert.ok(environment.getVerticalNavigationTarget(from, restoredActor));
  } finally { environment.clearEnvironment(); environment.clearEnvironment(); }
  assert.equal(scene.children.length, 0); assert.equal(environment.colliders.length, 0);
});

test('real Player.move climbs and lands on measured timber treads at game speeds and frame caps, with normal jump, pause and teleport paths preserved', () => {
  const scene = new THREE.Scene(), environment = new EnvironmentManager(scene);
  try {
    environment.buildLevelEnvironment({ ...valVerde, strategicMode: true, mapSeed: 1 });
    const tower = environment.guerrillaWatchtower.group;
    const ladder = environment.referenceWalkSurfaces.find(surface => surface.id === 'val-verde-watchtower-treads');
    const actor = (speed, y = 0, z = ladder.bounds.minZ - .12) => {
      const player = Object.assign(Object.create(Player.prototype), {
        position: new THREE.Vector3(tower.position.x, y, z), mesh: new THREE.Group(), moveSpeed: speed, rotationY: 0
      });
      Object.defineProperties(player, { cameraEyeHeight: { value: 2.05, configurable: true }, gameContext: { value: { env: environment } } });
      return player;
    };
    for (const speed of [14, 16, 19]) for (const fps of [10, 20, 30, 60, 120]) for (const tall of [false, true]) for (const buffed of [false, true]) {
      const player = actor(speed), delta = Math.min(.1, 1 / fps);
      if (tall) Object.defineProperty(player, 'cameraEyeHeight', { value: 3.6 });
      if (buffed) { player.warhornBuffTimer = 1; player.isBerserkerActive = true; }
      let highest = 0;
      for (let frame = 0; frame < fps * 4 && player.position.z < tower.position.z - .4; frame++) {
        player.move(new THREE.Vector3(0, 0, 1), delta);
        highest = Math.max(highest, player.position.y);
      }
      assert.ok(Math.abs(highest - 5.59) < 1e-5, `real Player.move speed${speed}/${fps}FPS failed to reach the deck: ${player.position.toArray()}`);
      assert.ok(Math.abs(player.position.x - tower.position.x) < 1e-7, 'the landing cannot push a climber sideways');
      for (let frame = 0; frame < fps * 4 && player.position.z > ladder.bounds.minZ - .12; frame++) player.move(new THREE.Vector3(0, 0, -1), delta);
      assert.ok(Math.abs(player.position.y) < 1e-5, `real descent and landing speed${speed}/${fps}FPS`);
      const paused = player.position.clone(); player.move(new THREE.Vector3(0, 0, 1), 0);
      assert.deepEqual(player.position.toArray(), paused.toArray());
    }
    const jumping = actor(19, 6.59, tower.position.z);
    jumping.isLeaping = true; jumping.move(new THREE.Vector3(0, 0, 1), .02);
    assert.equal(jumping.position.y, 6.59, 'stair traversal cannot ground a real leap');
    const falling = actor(19, 9, ladder.bounds.minZ + .5);
    const before = falling.position.clone();
    assert.equal(moveMeasuredStairTraversal(environment, falling.position, new THREE.Vector3(0, 0, .2), .1), false);
    assert.deepEqual(falling.position.toArray(), before.toArray(), 'declining an airborne move is mutation-free');
    const grounded = actor(19), stable = grounded.position.clone();
    assert.equal(moveMeasuredStairTraversal(environment, grounded.position, new THREE.Vector3(0, 0, 13), .1), false);
    assert.deepEqual(grounded.position.toArray(), stable.toArray(), 'a teleport is never reconstructed as a stair climb');
    assert.equal(moveMeasuredStairTraversal(environment, grounded.position, new THREE.Vector3(0, 0, .2), 0), false);
    assert.deepEqual(grounded.position.toArray(), stable.toArray());
    const middleZ = (ladder.bounds.minZ + ladder.bounds.maxZ) / 2;
    const steppingOff = actor(19, ladder.heightAt(tower.position.x, middleZ), middleZ), priorHeight = steppingOff.position.y;
    steppingOff.move(new THREE.Vector3(1, 0, 0), .1);
    assert.ok(steppingOff.position.x > ladder.bounds.maxX && steppingOff.position.y <= priorHeight, 'a side exit loses its actual support instead of sticking to an invented slope');
    for (let frame = 0; frame < 20; frame++) steppingOff.move(new THREE.Vector3(), .1);
    assert.ok(steppingOff.position.y < 1e-5, 'ordinary falling lands on the real ground after leaving the flight');
  } finally { environment.clearEnvironment(); }
});
