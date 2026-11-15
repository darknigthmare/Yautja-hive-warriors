import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { BattlefieldMission } from '../js/engine/BattlefieldMission.js';
import { createBattlefieldLayout } from '../js/data/BattlefieldLayouts.js';
import { LEVELS_DATA } from '../js/data/levelsData.js';

const vector = pair => new THREE.Vector3(pair[0], 0, pair[1]);
const livingAt = pair => ({ hp: 100, position: vector(pair) });

function fixture({ createBoss = true } = {}) {
  const level = LEVELS_DATA[0], layout = createBattlefieldLayout(level);
  const calls = { waves: [], enqueued: [], cleared: 0, cancelled: 0, openGates: [], entered: [], completed: [], announcements: [], previousDeaths: [], spawnRequests: [], bosses: [] };
  const previousDeath = record => calls.previousDeaths.push(record);
  const previousProvider = () => new THREE.Vector3(999, 0, 999);
  const environment = {
    battlefieldLayout: layout,
    setActiveSector(id) { this.activeSectorId = id; calls.entered.push(id); },
    completeSector(id) { calls.completed.push(id); },
    openGate(id) { calls.openGates.push(id); },
    getSpawnPoint(id, index, playerPosition, distance) {
      calls.spawnRequests.push({ id, index, playerPosition, distance });
      const sector = layout.sectors.find(value => value.id === id);
      return vector(sector.center).add(new THREE.Vector3(28 + (index ?? 0), 0, 20));
    }
  };
  const horde = {
    aliens: [], pendingSpawnCount: 0, onDefeated: previousDeath, spawnPositionProvider: previousProvider,
    clearWave() { calls.cleared++; this.aliens = []; this.pendingSpawnCount = 0; },
    cancelPendingSpawns() { calls.cancelled++; this.pendingSpawnCount = 0; },
    enqueueReinforcements(count) { calls.enqueued.push(count); this.pendingSpawnCount += count; return count; },
    spawnWave(count, position) {
      calls.waves.push({ count, position: position.clone() });
      this.pendingSpawnCount = Math.max(0, count - 1);
      const mesh = new THREE.Object3D(); mesh.position.copy(position);
      this.aliens.push({ type: 'regular', mesh });
    },
    spawnHiveOfficer(position) {
      const mesh = new THREE.Object3D(); mesh.position.copy(position);
      const alien = { type: 'hive_officer', mesh }; this.aliens.push(alien); return alien;
    }
  };
  const bosses = {
    activeBoss: null,
    spawnBoss(type, position) {
      calls.bosses.push({ type, position: position.clone() });
      if (createBoss) this.activeBoss = { type, hp: 1000, mesh: new THREE.Object3D() };
      return this.activeBoss;
    }
  };
  const mission = new BattlefieldMission({ environment, horde, bosses, level,
    onAnnouncement: text => calls.announcements.push(text), onSectorEntered: sector => { calls.lastEnteredCallback = sector.id; } });
  return { mission, level, layout, environment, horde, bosses, calls, previousDeath, previousProvider };
}

function defeatCurrent(f) {
  const sector = f.mission.progression.currentSector;
  if (sector.objective.type === 'kills') {
    for (let count = 0; count < sector.objective.target; count++) f.horde.onDefeated({ kind: 'regular', position: vector(sector.center), sectorId: sector.id });
  } else if (sector.objective.type === 'commander') {
    const commander = f.horde.aliens.find(alien => alien.objectiveCommander);
    assert.ok(commander, 'mission must spawn an actual marked commander');
    f.horde.onDefeated({ kind: 'commander', position: commander.mesh.position.clone(), sectorId: commander.battlefieldSectorId });
  } else if (sector.objective.type === 'interact') {
    assert.equal(f.mission.interact({ hp: 100, position: vector(sector.objective.position) }), true);
    for (let count = 0; count < (sector.objective.defenseTarget ?? 0); count++) f.horde.onDefeated({ kind: 'regular', position: vector(sector.center), sectorId: sector.id });
  } else { f.bosses.activeBoss.hp = 0; f.bosses.activeBoss = null; }
  f.mission.update([livingAt(sector.center)]);
}

function reachFinal(f) {
  for (const sector of f.layout.sectors) {
    f.mission.update([livingAt(sector.center)]);
    if (sector.objective.type === 'boss') return sector;
    defeatCurrent(f);
  }
  throw new Error('No final boss sector');
}

test('mission opens real gates from death/action callbacks and starts the next encounter only after walking in', () => {
  const f = fixture(), first = f.layout.sectors[0];
  assert.equal(f.calls.waves.length, 0, 'constructing a mission does not populate an unvisited map');
  f.mission.update([livingAt(f.layout.sectors.at(-1).center)]);
  assert.equal(f.calls.waves.length, 0, 'a locked distant player cannot spawn the final encounter');
  for (const [index, sector] of f.layout.sectors.entries()) {
    f.mission.update([livingAt(sector.center)]);
    assert.equal(f.calls.waves.length, index + 1);
    assert.equal(f.environment.activeSectorId, sector.id);
    assert.equal(f.calls.lastEnteredCallback, sector.id);
    assert.ok(f.horde.pendingSpawnCount > 0);
    f.horde.spawnPositionProvider(vector(sector.center), 32, 0);
    assert.equal(f.calls.spawnRequests.at(-1).id, sector.id, 'queued reinforcements use the newly visited sector');
    if (sector.objective.type === 'boss') {
      assert.ok(f.bosses.activeBoss);
      assert.equal(f.mission.complete, false, 'an active final boss blocks victory');
      f.mission.update([livingAt(sector.center)]);
      assert.equal(f.mission.complete, false);
    }
    defeatCurrent(f);
    assert.equal(f.mission.progression.currentState.completed, true);
    assert.equal(f.horde.pendingSpawnCount, 0, 'completing an objective cancels queued pressure before the next room');
    if (index < f.layout.sectors.length - 1) {
      assert.equal(f.calls.openGates.length, index + 1);
      assert.equal(f.calls.openGates.at(-1), f.layout.gates[index].id);
      f.mission.update([livingAt(sector.center)]);
      f.mission.update([livingAt(f.layout.corridors[index].center)]);
      assert.equal(f.calls.waves.length, index + 1, 'gate unlock and corridor travel do not remotely create a new wave');
      assert.equal(f.mission.complete, false);
    }
  }
  assert.equal(f.mission.complete, true);
  assert.equal(f.calls.bosses.length, 1);
  assert.equal(f.calls.bosses[0].type, f.level.bossType);
  assert.equal(f.calls.completed.length, 6);
  assert.equal(f.calls.cleared, 6, 'departing encounters are cleaned once per actual sector entry');
  assert.ok(f.calls.previousDeaths.length > first.objective.target, 'existing defeat observers still receive real deaths');
  const prior = { waves: f.calls.waves.length, gates: f.calls.openGates.length, completed: f.calls.completed.length };
  f.mission.update([livingAt(f.layout.sectors.at(-1).center)]);
  assert.deepEqual({ waves: f.calls.waves.length, gates: f.calls.openGates.length, completed: f.calls.completed.length }, prior);
  f.mission.dispose();
});

test('relay requires a living player in range and accepts the second co-op player without premature boss victory', () => {
  const f = fixture();
  f.mission.update([livingAt(f.layout.sectors[0].center)]); defeatCurrent(f);
  f.mission.update([livingAt(f.layout.sectors[1].center)]); defeatCurrent(f);
  const relay = f.layout.sectors[2], target = vector(relay.objective.position);
  f.mission.update([{ hp: 100, position: vector(f.layout.sectors[1].center) }, { hp: 100, position: vector(relay.center) }]);
  assert.equal(f.mission.progression.currentSector.id, relay.id);
  assert.equal(f.mission.interact({ hp: 0, position: target }), false);
  assert.equal(f.mission.interact({ hp: 100, position: target.clone().add(new THREE.Vector3(20, 0, 0)) }), false);
  assert.equal(f.calls.openGates.length, 2);
  assert.equal(f.mission.interact({ hp: 100, position: target }), true);
  assert.equal(f.calls.openGates.length, 2, 'activation announces a counter-attack instead of bypassing the encounter');
  assert.equal(f.mission.progression.currentState.relayPhase, 'counterattack');
  assert.deepEqual(f.calls.enqueued, [relay.objective.defenseTarget + 4]);
  assert.match(f.calls.announcements.at(-1), /CONTRE-ATTAQUE/);
  assert.equal(f.mission.interact({ hp: 100, position: target }), false, 'holding the action key cannot repeat an objective');
  for (let count = 0; count < relay.objective.defenseTarget; count++) f.horde.onDefeated({ kind: 'regular', position: target, sectorId: relay.id });
  f.mission.update([livingAt(relay.center)]);
  assert.equal(f.calls.openGates.length, 3);
  assert.equal(f.mission.complete, false, 'a null BossManager before entering the nest does not imply victory');
  f.mission.dispose();
});

test('relay activation preserves living defenders and schedules a single bounded counter-attack after pre-activation kills', () => {
  const f = fixture();
  f.mission.update([livingAt(f.layout.sectors[0].center)]); defeatCurrent(f);
  f.mission.update([livingAt(f.layout.sectors[1].center)]); defeatCurrent(f);
  const sector = f.layout.sectors[2];
  f.mission.update([livingAt(sector.center)]);
  const defender = f.horde.aliens[0], clearCount = f.calls.cleared, priorPending = f.horde.pendingSpawnCount;
  f.horde.onDefeated({ kind: 'regular', count: 100, sectorId: sector.id, position: vector(sector.center) });
  assert.equal(f.mission.progression.currentState.defenseKills, 0, 'earlier kills cannot pre-complete an unactivated relay');
  assert.equal(f.mission.interact(livingAt(sector.objective.position)), true);
  assert.equal(f.calls.cleared, clearCount);
  assert.equal(f.horde.aliens[0], defender);
  assert.equal(f.horde.pendingSpawnCount, priorPending + sector.objective.defenseTarget + 4);
  assert.equal(f.mission.interact(livingAt(sector.objective.position)), false);
  assert.equal(f.calls.enqueued.length, 1);
  f.horde.onDefeated({ kind: 'regular', count: sector.objective.defenseTarget, sectorId: sector.id, position: new THREE.Vector3(999, 0, 999) });
  f.mission.update([livingAt(sector.center)]);
  assert.equal(f.mission.progression.currentState.completed, true, 'kiting known encounter enemies cannot make the defense quota impossible');
  assert.equal(f.horde.pendingSpawnCount, 0, 'the remaining response queue is cancelled after the relay is secured');
  f.mission.dispose();
});

test('a final boss that never appeared cannot be interpreted as defeated', () => {
  const f = fixture({ createBoss: false });
  assert.throws(() => reachFinal(f), /boss could not be created/);
  assert.equal(f.calls.bosses.length, 1);
  assert.equal(f.bosses.activeBoss, null);
  f.mission.update([livingAt(f.layout.sectors.at(-1).center)]);
  assert.equal(f.mission.complete, false, 'a successful encounter must have been observed before its disappearance counts');
  f.mission.dispose();
});

test('removing a living boss is not victory and real death of the observed encounter completes the mission once', () => {
  const f = fixture(), final = reachFinal(f), boss = f.bosses.activeBoss;
  assert.ok(boss.hp > 0);
  f.bosses.activeBoss = null;
  f.mission.update([livingAt(final.center)]);
  assert.equal(f.mission.complete, false, 'cleanup or a temporarily absent manager reference cannot count as a kill');
  f.bosses.activeBoss = boss;
  f.mission.update([livingAt(final.center)]);
  boss.hp = 0;
  f.bosses.activeBoss = null;
  f.mission.update([livingAt(final.center)]);
  assert.equal(f.mission.complete, true);
  const completed = f.calls.completed.length;
  f.mission.update([livingAt(final.center)]);
  assert.equal(f.calls.completed.length, completed);
  f.mission.dispose();
});

test('reinforcement provider respects both co-op players and refuses a position when every sample is too close', () => {
  const f = fixture(), first = f.layout.sectors[0];
  const player1 = livingAt(first.center), player2 = livingAt([first.center[0] + 28, first.center[1] + 20]);
  f.mission.update([player1, player2]);
  const rejected = f.horde.spawnPositionProvider(player1.position, 32, 0);
  assert.equal(rejected, null, 'sample safety must not consider only the player passed to spawnWave');
  assert.ok(f.calls.spawnRequests.length >= 16);
  player2.position.set(1000, 0, 1000);
  f.mission.update([player1, player2]);
  const accepted = f.horde.spawnPositionProvider(player1.position, 32, 0);
  assert.ok(accepted);
  assert.ok(accepted.distanceTo(player1.position) >= 24);
  assert.ok(accepted.distanceTo(player2.position) >= 24);
  f.mission.dispose();
});

test('disposal restores previous observers/providers, cancels pressure and refuses stale actions', () => {
  const f = fixture();
  f.mission.update([livingAt(f.layout.sectors[0].center)]);
  const staleDeath = f.horde.onDefeated;
  f.mission.dispose(); f.mission.dispose();
  assert.equal(f.horde.onDefeated, f.previousDeath);
  assert.equal(f.horde.spawnPositionProvider, f.previousProvider);
  assert.equal(f.horde.pendingSpawnCount, 0);
  const killsBefore = f.mission.progression.currentState.kills;
  staleDeath({ kind: 'regular', count: 100, sectorId: f.layout.sectors[0].id });
  f.mission.update([livingAt(f.layout.sectors[1].center)]);
  assert.equal(f.mission.progression.currentState.kills, killsBefore);
  assert.equal(f.mission.interact(vector(f.layout.sectors[2].objective.position)), false);
  assert.equal(f.calls.waves.length, 1);
});

test('disposal preserves a newer callback owner rather than undoing its integration', () => {
  const f = fixture();
  const newerDeath = () => {}, newerProvider = () => new THREE.Vector3();
  f.horde.onDefeated = newerDeath; f.horde.spawnPositionProvider = newerProvider;
  f.mission.dispose();
  assert.equal(f.horde.onDefeated, newerDeath);
  assert.equal(f.horde.spawnPositionProvider, newerProvider);
});
