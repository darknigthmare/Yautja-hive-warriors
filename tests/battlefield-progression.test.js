import test from 'node:test';
import assert from 'node:assert/strict';
import { BattlefieldProgression } from '../js/engine/BattlefieldProgression.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

function fixture() {
  const types = ['kills', 'commander', 'interact', 'kills', 'commander', 'boss'];
  const sectors = types.map((type, index) => ({
    id: `sector-${index}`, name: `ZONE ${index + 1}`, center: [index * 100, 0],
    bounds: { minX: index * 100 - 25, maxX: index * 100 + 25, minZ: -25, maxZ: 25 },
    objective: { type, target: type === 'kills' ? 4 : 1, label: `OBJECTIF ${index + 1}`, position: [index * 100, 0], radius: 5 }
  }));
  const gates = sectors.slice(1).map((sector, index) => ({ id: `gate-${index}`, from: sectors[index].id, to: sector.id, center: [index * 100 + 50, 0] }));
  return { entrySectorId: sectors[0].id, sectors, gates };
}

const enter = (progression, index, extraPlayers = []) => progression.update([{ x: index * 100, z: 0 }, ...extraPlayers]);
const clear = (progression, index) => {
  const type = progression.currentSector.objective.type;
  if (type === 'interact') progression.interact({ x: index * 100, z: 0 });
  else if (type === 'boss') progression.recordBossDefeat({ sectorId: `sector-${index}` });
  else progression.recordKill({ sectorId: `sector-${index}`, count: type === 'kills' ? 4 : 1, kind: type === 'commander' ? 'commander' : 'regular' });
};

test('connected battlefield requires visit, quota, officer, proximity action and final boss in order', () => {
  const progression = new BattlefieldProgression(fixture());
  assert.equal(progression.currentSector.id, 'sector-0');
  assert.match(progression.objectiveText, /REJOIGNEZ/);
  assert.deepEqual(progression.recordKill({ count: 99 }), [], 'kills before entering the battlefield cannot open a gate');
  assert.deepEqual(enter(progression, 5), [], 'teleporting to the locked nest cannot skip the route');
  for (let index = 0; index < 6; index++) {
    enter(progression, index);
    assert.equal(progression.currentSector.id, `sector-${index}`);
    assert.equal(progression.currentState.entered, true);
    if (index === 0) {
      progression.recordKill({ count: 3 });
      assert.deepEqual(progression.openGateIds, []);
      assert.match(progression.objectiveText, /3\/4/);
      progression.recordKill({ count: 1 });
    } else clear(progression, index);
    assert.equal(progression.currentState.completed, true);
    if (index < 5) {
      assert.equal(progression.isGateOpen(`gate-${index}`), true);
      assert.equal(progression.isSectorUnlocked(`sector-${index + 1}`), true);
      assert.equal(progression.currentSector.id, `sector-${index}`, 'opening a gate does not move the current sector remotely');
      assert.equal(progression.nextSector.id, `sector-${index + 1}`);
      assert.match(progression.objectiveText, /PASSAGE OUVERT/);
    }
  }
  assert.equal(progression.complete, true);
  assert.equal(progression.completedSectorIds.length, 6);
  assert.match(progression.objectiveText, /SÉCURISÉ/);
  const events = progression.drainEvents();
  assert.equal(events.filter(event => event.type === 'sector-entered').length, 6);
  assert.equal(events.filter(event => event.type === 'sector-completed').length, 6);
  assert.equal(events.filter(event => event.type === 'gate-opened').length, 5);
  assert.equal(events.filter(event => event.type === 'battlefield-completed').length, 1);
  progression.recordBossDefeat(); progression.interact({ x: 500, z: 0 }); progression.update([{ x: 500, z: 0 }]);
  assert.deepEqual(progression.drainEvents(), [], 'repeated final notifications do not reopen gates or win twice');
});

test('co-op shares progress while locked, dead and out-of-zone actors cannot complete objectives remotely', () => {
  const progression = new BattlefieldProgression(fixture());
  progression.update([{ hp: 0, position: { x: 0, z: 0 } }, { position: { x: 100, z: 0 } }]);
  assert.equal(progression.currentState.entered, false);
  enter(progression, 0);
  progression.recordKill({ position: { x: 100, z: 0 }, count: 4 });
  assert.equal(progression.currentState.kills, 0);
  progression.recordKill({ position: { x: -10, z: 0 }, count: 2 });
  progression.recordKill({ position: { x: 15, z: 0 }, count: 2 });
  assert.equal(progression.currentState.kills, 4, 'both players contribute to one quota');
  progression.update([{ x: 0, z: 0 }, { x: 100, z: 0 }]);
  assert.equal(progression.currentSector.id, 'sector-1', 'one player can lead the shared advance');
  progression.recordKill({ sectorId: 'sector-0', count: 100, kind: 'commander' });
  progression.recordKill({ sectorId: 'sector-1', kind: 'regular' });
  progression.recordKill({ sectorId: 'sector-2', kind: 'commander' });
  assert.equal(progression.currentState.completed, false);
  progression.recordKill({ sectorId: 'sector-1', position: { x: 50, z: 0 }, kind: 'commander' });
  assert.equal(progression.currentState.completed, true, 'a known officer kited into an open corridor still counts for its original zone');
  enter(progression, 2);
  assert.equal(progression.canInteract({ x: 206, z: 0 }), false);
  assert.deepEqual(progression.interact({ x: 206, z: 0 }), []);
  assert.equal(progression.canInteract({ hp: -1, position: { x: 200, z: 0 } }), false);
  assert.deepEqual(progression.interact({ hp: 0, position: { x: 200, z: 0 } }), []);
  assert.equal(progression.canInteract({ hp: 100, position: { x: 200, z: 0 } }), true);
  progression.interact({ hp: 100, position: { x: 200, z: 0 } });
  assert.equal(progression.currentState.interacted, true);
  assert.equal(progression.isGateOpen('gate-2'), true);
});

test('replay resets every gate and objective without mutating layout or exposing writable state', () => {
  const layout = fixture(), initial = structuredClone(layout);
  const progression = new BattlefieldProgression(layout);
  enter(progression, 0); clear(progression, 0); enter(progression, 1);
  const state = progression.currentState; state.completed = true;
  const open = progression.openGateIds; open.push('gate-4');
  assert.equal(progression.currentState.completed, false);
  assert.equal(progression.isGateOpen('gate-4'), false);
  progression.reset();
  assert.equal(progression.complete, false);
  assert.equal(progression.currentSector.id, 'sector-0');
  assert.equal(progression.currentState.entered, false);
  assert.deepEqual(progression.openGateIds, []);
  assert.deepEqual(progression.completedSectorIds, []);
  assert.deepEqual(progression.unlockedSectorIds, ['sector-0']);
  assert.deepEqual(progression.drainEvents(), []);
  assert.deepEqual(layout, initial);
  layout.sectors[0].objective.target = 999;
  enter(progression, 0); clear(progression, 0);
  assert.equal(progression.currentState.completed, true, 'caller changes cannot alter active mission rules');
});

test('invalid unreachable zones, duplicate gates and remote terminals fail before starting a mission', () => {
  const bad = mutate => { const layout = fixture(); mutate(layout); assert.throws(() => new BattlefieldProgression(layout), /BattlefieldProgression/); };
  bad(layout => layout.gates.pop());
  bad(layout => { layout.gates[1].id = layout.gates[0].id; });
  bad(layout => { layout.sectors[2].objective.position = [5000, 0]; });
  bad(layout => { layout.sectors[0].objective.target = 0; });
  bad(layout => { layout.sectors[2].objective.radius = NaN; });
  bad(layout => { layout.sectors[2].objective.position = [NaN, 0]; });
  for (const defenseTarget of [0, -1, 1.5, NaN, Infinity, 201]) bad(layout => { layout.sectors[2].objective.defenseTarget = defenseTarget; });
  bad(layout => { layout.sectors[0].objective.defenseTarget = 8; });
});

for (const level of LEVELS_DATA) {
  test(`${level.id}: real rotated battlefield is completable through every objective and gate`, () => {
    const layout = createBattlefieldLayout(level), progression = new BattlefieldProgression(layout);
    for (const sector of layout.sectors) {
      progression.update([sector.center]);
      assert.equal(progression.currentSector.id, sector.id);
      assert.equal(progression.currentState.entered, true);
      if (sector.objective.type === 'interact') {
        assert.equal(progression.canInteract(sector.objective.position), true);
        progression.interact(sector.objective.position);
        if (sector.objective.defenseTarget) {
          assert.equal(progression.currentState.completed, false, 'a relay activation must be followed by its counter-attack');
          progression.recordKill({ sectorId: sector.id, count: sector.objective.defenseTarget });
        }
      } else if (sector.objective.type === 'boss') progression.recordBossDefeat({ sectorId: sector.id });
      else progression.recordKill({ sectorId: sector.id, kind: sector.objective.type === 'commander' ? 'commander' : 'regular', count: sector.objective.target });
      assert.equal(progression.currentState.completed, true);
      for (const gate of layout.gates.filter(gate => gate.from === sector.id)) assert.equal(progression.isGateOpen(gate.id), true);
    }
    assert.equal(progression.complete, true);
    assert.equal(progression.openGateIds.length, 5);
  });
}

test('relay has explicit activation and counter-attack phases with no early kill credit or repeatable interaction', () => {
  const layout = fixture(); layout.sectors[2].objective.defenseTarget = 3;
  const progression = new BattlefieldProgression(layout);
  enter(progression, 0); clear(progression, 0); enter(progression, 1); clear(progression, 1); enter(progression, 2);
  assert.equal(progression.currentState.relayPhase, 'awaiting-activation');
  assert.match(progression.objectiveText, /CONTRE-ATTAQUE : 3/);
  progression.recordKill({ sectorId: 'sector-2', count: 100 });
  assert.equal(progression.currentState.defenseKills, 0);
  assert.equal(progression.canInteract({ x: 200, z: 0 }), true);
  const activation = progression.interact({ x: 200, z: 0 });
  assert.equal(activation.length, 1); assert.equal(activation[0].type, 'relay-activated');
  assert.equal(progression.currentState.relayPhase, 'counterattack');
  assert.equal(progression.currentState.completed, false);
  assert.deepEqual([progression.progress.current, progression.progress.target], [0, 3]);
  assert.equal(progression.canInteract({ x: 200, z: 0 }), false);
  assert.deepEqual(progression.interact({ x: 200, z: 0 }), []);
  assert.equal(progression.isGateOpen('gate-2'), false);
  progression.recordKill({ sectorId: 'sector-1', count: 99 });
  progression.recordKill({ position: { x: 999, z: 0 }, count: 99 });
  assert.equal(progression.currentState.defenseKills, 0, 'wrong encounters and unassigned remote deaths cannot complete the defense');
  progression.recordKill({ sectorId: 'sector-2', position: { x: 150, z: 0 }, count: 2 });
  assert.deepEqual([progression.progress.current, progression.progress.target], [2, 3]);
  assert.match(progression.objectiveText, /CONTRE-ATTAQUE.*2\/3/);
  const deaths = progression.recordKill({ sectorId: 'sector-2', count: 99 });
  assert.equal(progression.currentState.defenseKills, 3, 'the quota is capped, even if one hit defeats several enemies');
  assert.equal(progression.currentState.relayPhase, 'secured');
  assert.equal(progression.isGateOpen('gate-2'), true);
  assert.equal(deaths.filter(event => event.type === 'gate-opened').length, 1);
  progression.reset();
  assert.equal(progression.getSectorState('sector-2').interacted, false);
  assert.equal(progression.getSectorState('sector-2').defenseKills, 0);
  assert.equal(progression.getSectorState('sector-2').relayPhase, 'awaiting-activation');
});
