// Read-only runtime diagnosis, no browser and no app mutation. Replays the
// authoritative selector with R3 player positions. Callbacks record selection
// but do not construct physical actors; this isolates selection, not level nav.
import { createOperationScene } from '../../../../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../../../../js/battlefield/BattleSimulation.js';
import { writeFile, readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
const reportPath = '/workspace/qa/continuation-20261109/runtime-94630d8-r3/report.json';
const bytes = await readFile(reportPath), rendered = JSON.parse(bytes);
const row = rendered.cases.find(item => item.id === 'carrier-autonomous-main-update-flight');
const start = row.materialization.trials.at(-1).playerPosition;
const selected = row.observationPosition.after;
const afterPhysics = row.acquisition.attempts[0].before.target.position;
function replay(playerPosition) {
  const config = createOperationScene({ operationId: 'AFF-27', extinctionVariant: 'carrier-ravager-enhanced', mapSeed: 0 }).config;
  const events = [], activeGroups = new Map();
  let sim;
  sim = new BattleSimulation(config, {
    spawnGroup(group, units) { activeGroups.set(group.id, units.map(unit => unit.id));
      events.push({ type: 'materialize', time: sim.time, groupId: group.id, count: units.length }); return true; },
    despawnGroup(group, units) { activeGroups.delete(group.id);
      events.push({ type: 'dematerialize', time: sim.time, groupId: group.id, count: units.length });
      return units.map(unit => ({ id: unit.id, hp: unit.hp, position: [...unit.position] })); }
  });
  try {
    const carrier = [...sim.units.values()].find(unit => unit.actorType === 'carrier'), groupId = carrier.groupId;
    const snapshot = () => ({ time: sim.time, carrierState: carrier.state,
      materialized: sim.groups.get(groupId).materialized, groupPosition: [...sim.groups.get(groupId).position],
      active: sim.getActiveUnits().length, activeGroups: [...activeGroups.keys()],
      carrierHP: carrier.hp, cargo: carrier.carrierCargoIds?.length ?? 0 });
    const player = position => [{ id: 'player1', hp: 1000, position: [position[0], position[2]] }];
    sim.update(.25, { players: player(start) }); const before = snapshot();
    const checkpoints = [];
    for (let frame = 1; frame <= 480; frame++) {
      sim.update(1 / 60, { players: player(playerPosition) });
      if (frame === 1 || frame === 14 || frame === 15 || frame === 16 || frame % 60 === 0) checkpoints.push({ frame, ...snapshot() });
    }
    return { playerPosition, before, checkpoints,
      carrierSelectionEvents: events.filter(event => event.groupId === groupId),
      conserved: sim.assertConservation(), final: snapshot() };
  } finally { sim.dispose(); }
}
const result = { schemaVersion: 1, status: 'diagnostic_complete', generatedAt: new Date().toISOString(),
  sourceCommit: execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim(),
  renderedReport: reportPath, renderedReportSha256: createHash('sha256').update(bytes).digest('hex'),
  scope: 'Authoritative BattleSimulation selection only; synthetic spawn callbacks record selected groups and do not certify physical nav, combat, collision or final rendered behavior.',
  r3Evidence: { startPlayer: start, observationPlayer: selected, playerAfterPhysics: afterPhysics,
    startCarrierPosition: row.before.actor.position, orderTarget: row.observationPosition.orderTarget,
    frames: row.acquisition.ticks, attempts: row.acquisition.attempts.length,
    gapFirst: row.acquisition.attempts[0].before.target.gap, gapLast: row.acquisition.attempts.at(-1).before.target.gap,
    everyReason: [...new Set(row.acquisition.attempts.map(attempt => attempt.result.reason))],
    attemptTimesRecorded: false, activeBefore: row.before.inventory.active,
    cap: row.before.inventory.cap, carrierStateAfterObservationRecorded: false },
  selectedPositionReplay: replay(selected), physicalPositionReplay: replay(afterPhysics),
  browserLaunched: false, runtimeModified: false, fidelity1to1Verified: false, humanTesters: 0 };
const output = new URL('./r3-selection-diagnostic.json', import.meta.url);
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, before: result.physicalPositionReplay.before,
  carrierEvents: result.physicalPositionReplay.carrierSelectionEvents,
  final: result.physicalPositionReplay.final, output: output.pathname }));
