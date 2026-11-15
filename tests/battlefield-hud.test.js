import test from 'node:test';
import assert from 'node:assert/strict';
import { BattlefieldProgression } from '../js/engine/BattlefieldProgression.js';
import { battlefieldHUDState, UIManager } from '../js/ui/UIManager.js';

function fixture(defenseTarget) {
  const sectors = [
    { id: 'insertion', name: 'Zone d’insertion', center: [0, 0], bounds: { minX: -66, maxX: 66, minZ: -66, maxZ: 66 }, objective: { type: 'kills', target: 2, label: 'Sécurisez la zone' } },
    { id: 'relay', name: 'Relais extérieur', center: [0, -170], bounds: { minX: -66, maxX: 66, minZ: -236, maxZ: -104 }, objective: { type: 'interact', label: 'Activez le relais', position: [12, -170], radius: 5 } },
    { id: 'nest', name: 'Nid', center: [170, -170], bounds: { minX: 104, maxX: 236, minZ: -236, maxZ: -104 }, objective: { type: 'boss', label: 'Abattez la reine' } }
  ];
  const layout = { sectors, entrySectorId: 'insertion', bounds: { minX: -66, maxX: 236, minZ: -236, maxZ: 66 },
    gates: [{ id: 'gate-a', from: 'insertion', to: 'relay', center: [0, -85], axis: 'z' }, { id: 'gate-b', from: 'relay', to: 'nest', center: [85, -170], axis: 'x' }],
    corridors: [{ from: 'insertion', to: 'relay', bounds: { minX: -9, maxX: 9, minZ: -104, maxZ: -66 } }, { from: 'relay', to: 'nest', bounds: { minX: 66, maxX: 104, minZ: -179, maxZ: -161 } }] };
  if (defenseTarget) sectors[1].objective.defenseTarget = defenseTarget;
  const progression = new BattlefieldProgression(layout);
  const player = { hp: 500, position: { x: 0, z: 0 } };
  progression.update([player]);
  return { layout, progression, player };
}

test('persistent HUD follows real objective progress, open passage and the next destination without mutating progression', () => {
  const { layout, progression, player } = fixture();
  let state = battlefieldHUDState(progression, layout, player, { isInGrace: true });
  assert.equal(state.sectorCount, '1 / 3');
  assert.match(state.objectiveText, /0\/2/);
  assert.equal(state.inGrace, true);
  assert.deepEqual(state.steps.map(item => item.state), ['active', 'locked', 'locked']);
  progression.recordKill({ count: 2, position: player.position });
  const before = JSON.stringify({ progress: progression.progress, events: progression._events });
  state = battlefieldHUDState(progression, layout, player, { isInGrace: false });
  assert.match(state.objectiveText, /PASSAGE OUVERT/);
  assert.match(state.navigationText, /^N · 170 m · Passage ouvert$/);
  assert.deepEqual(state.steps.map(item => item.state), ['complete', 'unlocked', 'locked']);
  assert.equal(JSON.stringify({ progress: progression.progress, events: progression._events }), before, 'HUD must never consume events or advance objectives');
});

test('relay prompt requires actual proximity and clears after interaction; reset removes the battlefield HUD', () => {
  const { layout, progression, player } = fixture();
  progression.recordKill({ count: 2 });
  player.position = { x: 0, z: -170 }; progression.update([player]);
  assert.equal(battlefieldHUDState(progression, layout, player).canInteract, false);
  player.position.x = 12;
  let state = battlefieldHUDState(progression, layout, player);
  assert.equal(state.canInteract, true);
  assert.equal(state.sectorCount, '2 / 3');
  progression.interact(player);
  state = battlefieldHUDState(progression, layout, player);
  assert.equal(state.canInteract, false);
  assert.deepEqual(state.steps.map(item => item.state), ['complete', 'complete', 'unlocked']);
  assert.equal(battlefieldHUDState(null, layout, player), null);
});

test('whole battlefield map projects distant rooms, enemies and co-op players inside its canvas', () => {
  const { layout, progression, player } = fixture();
  const arcs = [], labels = [], rectangles = [];
  const ctx = new Proxy({ arc: (...args) => arcs.push(args), fillText: (...args) => labels.push(args), fillRect: (...args) => rectangles.push(args) }, { get: (target, key) => target[key] ?? (() => {}), set: (target, key, value) => { target[key] = value; return true; } });
  const other = { hp: 500, position: { x: 170, z: -170 } };
  const ui = { minimapCtx: ctx, minimapCanvas: { width: 224, height: 224 }, _battlefieldHUD: { progression, layout, players: [player, other] } };
  UIManager.prototype.renderBattlefieldMap.call(ui, player, { aliens: [{ mesh: { position: { x: 220, z: -220 } } }] }, {});
  assert.equal(labels.length, 3, 'every room remains identifiable on the global map');
  assert.equal(rectangles.length, 5, 'rooms and connecting corridors are rendered');
  assert.ok(arcs.length >= 4, 'enemy, co-op partner, player and player outline are drawn');
  for (const [x, y] of arcs) assert.ok(x >= 8 && x <= 216 && y >= 8 && y <= 216, 'markers fit the complete battlefield extent');
  assert.notDeepEqual(arcs.at(-1).slice(0, 2), [112, 112], 'player location follows world coordinates rather than a fixed radar center');
});

test('relay HUD advertises the real co-op interaction key when only player two is in range', () => {
  const { layout, progression, player } = fixture();
  progression.recordKill({ count: 2 });
  const other = { hp: 500, isPlayer2: true, position: { x: 12, z: -170 } };
  progression.update([player, other]);
  let state = battlefieldHUDState(progression, layout, player, null, [player, other]);
  assert.equal(state.canInteract, true);
  assert.equal(state.interactionText, '[ Entrée ] Joueur 2 · Activer le relais');
  player.position = { x: 12, z: -170 };
  state = battlefieldHUDState(progression, layout, player, null, [player, other]);
  assert.equal(state.interactionText, '[ E / Entrée ] Activer le relais');
  other.hp = 0; player.position.x = 30;
  assert.equal(battlefieldHUDState(progression, layout, player, null, [player, other]).canInteract, false, 'a dead co-op player cannot advertise interaction');
});

test('relay counterattack stays in the HUD until the actual post-activation quota opens its passage', () => {
  const { layout, progression, player } = fixture(8);
  progression.recordKill({ count: 2 });
  player.position = { x: 12, z: -170 }; progression.update([player]);
  assert.equal(battlefieldHUDState(progression, layout, player).canInteract, true);
  progression.interact(player);
  let state = battlefieldHUDState(progression, layout, player);
  assert.equal(state.canInteract, false);
  assert.equal(state.relayPhase, 'counterattack');
  assert.match(state.objectiveText, /0\/8/);
  assert.equal(state.steps[2].state, 'locked');
  progression.recordKill({ sectorId: 'relay', count: 8 });
  state = battlefieldHUDState(progression, layout, player);
  assert.equal(state.relayPhase, 'secured');
  assert.equal(state.steps[2].state, 'unlocked');
});
