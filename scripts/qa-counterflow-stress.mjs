#!/usr/bin/env node
/* AUD-063 full sweep: every gated corridor of every level (6-room battlefield), then every flank and
 * outer route in strategic mode, plus the LD-01 bridge variant. 16 assault agents and 8 evacuees in
 * opposite directions. Writes a JSON record; exits non-zero if any agent is stuck.
 * Usage: node scripts/qa-counterflow-stress.mjs [--out path.json] */
import { writeFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { LEVELS_DATA } from '../js/data/levelsData.js';
import { buildBattlefield, corridorCounterflow, routeCounterflow, strategicRoutes, gatedCorridors } from './lib/counterflow-stress.mjs';

const outIndex = process.argv.indexOf('--out'), out = outIndex > 0 ? process.argv[outIndex + 1] : null;
const git = command => { try { return execSync(command, { encoding: 'utf8' }).trim(); } catch { return null; } };
const cases = [];
for (const level of LEVELS_DATA) {
  const env = buildBattlefield(level.id);
  for (const corridor of gatedCorridors(env)) cases.push({ kind: 'corridor', level: level.id, id: corridor.id, ...corridorCounterflow(env, corridor) });
}
for (const [levelId, mapId] of [...LEVELS_DATA.map(level => [level.id, undefined]), [LEVELS_DATA[0].id, 'LD-01']]) {
  const env = buildBattlefield(levelId, { mapId, strategicMode: true });
  for (const route of strategicRoutes(env)) {
    cases.push({ kind: 'route', level: levelId, mapId: mapId ?? null, id: route.id, bridge: env.tacticalBridges.size > 0, ...routeCounterflow(env, route) });
  }
}
for (const item of cases) console.log(item.stuck.length ? 'STUCK' : 'ok   ', item.kind, item.level, item.mapId ?? '', item.id, `${item.arrived}/${item.agents}`, `last ${item.lastArrival}s`, `worstStill ${item.worstStill}s`);
const failed = cases.filter(item => item.stuck.length || item.worstStill >= 3);
const record = {
  action: 'AUD-063', date: new Date().toISOString().slice(0, 10), commit: git('git rev-parse HEAD'),
  uncommittedSources: (git('git status --porcelain -- js scripts') ?? '').split('\n').filter(Boolean),
  method: '16 assault + 8 evacuation agents, radius 0.75, 8 m/s, 1/15 s steps, moveSquadActor on the real built level with gates open. Actor-to-actor collision is not simulated by the game and is not measured.',
  criteria: 'every agent arrives (6 m of the last point); none stands still 3 s or more',
  cases: cases.length, failed: failed.length, results: cases
};
if (out) writeFileSync(out, `${JSON.stringify(record, null, 1)}\n`);
console.log(`${cases.length} cases, ${failed.length} failed`);
process.exitCode = failed.length ? 1 : 0;
