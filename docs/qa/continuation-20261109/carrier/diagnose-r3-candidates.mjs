// Selector-only candidates. No geometry claims: the rendered helper must still
// validate safeSpawnNear, canStand, floor and LOS on the actual constructed map.
import { createOperationScene } from '../../../../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../../../../js/battlefield/BattleSimulation.js';
import { readFile, writeFile } from 'node:fs/promises';
const path = '/workspace/qa/continuation-20261109/runtime-94630d8-r3/report.json';
const row = JSON.parse(await readFile(path, 'utf8')).cases.find(item => item.id === 'carrier-autonomous-main-update-flight');
const source = row.before.actor.position, center = row.observationPosition.orderTarget;
const initial = row.materialization.trials.at(-1).playerPosition;
const template = createOperationScene({ operationId: 'AFF-27', extinctionVariant: 'carrier-ravager-enhanced', mapSeed: 0 }).config;
const candidates = [];
for (const radius of [5, 9, 13, 17, 21, 23]) for (let i = 0; i < 24; i++) {
  const position = [center[0] + Math.cos(i * Math.PI / 12) * radius, 0, center[1] + Math.sin(i * Math.PI / 12) * radius];
  const events = []; let sim;
  sim = new BattleSimulation(template, {
    spawnGroup(group) { events.push({ type: 'materialize', groupId: group.id, time: sim.time }); return true; },
    despawnGroup(group, units) { events.push({ type: 'dematerialize', groupId: group.id, time: sim.time });
      return units.map(unit => ({ id: unit.id, hp: unit.hp, position: [...unit.position] })); }
  });
  try {
    const carrier = [...sim.units.values()].find(unit => unit.actorType === 'carrier'), group = sim.groups.get(carrier.groupId);
    const player = p => [{ id: 'player1', hp: 1000, position: [p[0], p[2]] }];
    sim.update(.25, { players: player(initial) });
    let detailSteps = 0;
    for (let tick = 1; tick <= 32; tick++) { sim.update(.25, { players: player(position) }); if (group.materialized) detailSteps++; }
    candidates.push({ position, radius, angle: i * 15,
      gapToInitialCarrier: Math.hypot(position[0] - source[0], position[2] - source[2]),
      tacticalDistance: radius, materializedDetailSteps: detailSteps, totalDetailSteps: 32,
      finalState: carrier.state, finalHP: carrier.hp,
      selectionEvents: events.filter(event => event.groupId === group.id), conserved: sim.assertConservation() });
  } finally { sim.dispose(); }
}
candidates.sort((a, b) => b.materializedDetailSteps - a.materializedDetailSteps || a.gapToInitialCarrier - b.gapToInitialCarrier);
const result = { schemaVersion: 1, status: 'selector_candidate_diagnostic_complete', checkedAt: new Date().toISOString(),
  sourceRenderedReport: path, sourceCarrierPosition: source, initialPlayerPosition: initial, tacticalCenter: center,
  capUnchanged: 32, allocationsUnchanged: 952,
  scope: 'Authoritative finite selection for 144 player-only observation candidates, without Horde motion or actual level nav. Select candidates in the actual rendered helper only after real physical validation; no runtime behavior is modified.',
  topCandidates: candidates.slice(0, 16), candidates,
  runtimeModified: false, browserLaunched: false, completeMissionVerified: false };
const output = new URL('./r3-player-candidate-diagnostic.json', import.meta.url);
await writeFile(output, JSON.stringify(result, null, 2) + '\n');
console.log(JSON.stringify({ status: result.status, candidates: candidates.length, topCandidates: result.topCandidates.slice(0, 6), output: output.pathname }));
