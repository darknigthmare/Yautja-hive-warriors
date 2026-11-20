// CPU-only repeatable investigation. No browser, renderer, FPS or hardware certification.
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { Session } from 'node:inspector/promises';
import * as THREE from 'three';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { XenomorphHorde } from '../js/entities/XenomorphHorde.js';
import { ColonialMarinesManager } from '../js/entities/ColonialMarines.js';
import { CombatDirector } from '../js/engine/CombatDirector.js';
import { selectBattleTarget } from '../js/engine/BattleActorSupport.js';

const sha = value => createHash('sha256').update(typeof value === 'string' || value instanceof Uint8Array ? value : JSON.stringify(value)).digest('hex');
const median = rows => [...rows].sort((a, b) => a - b)[Math.floor(rows.length / 2)];
const audio = new Proxy({}, { get: () => () => {} });
const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');

export function targetingConfiguration(total, frontCount = 8) {
  assert.ok(Number.isInteger(total) && total % 16 === 0 && total <= 4096);
  const fronts = Array.from({ length: frontCount }, (_, index) => ({ id: `f${index}`, position: [index * 500, 0], radius: 70,
    owner: null, captureThreshold: 30, reinforcementSource: false }));
  const groups = Array.from({ length: total / 8 }, (_, index) => {
    const faction = index % 2 ? 'hive' : 'human', front = fronts[Math.floor(index / 2) % frontCount];
    return { id: `g${index}`, factionId: faction, frontId: front.id, position: [front.position[0] + (index % 2 ? 10 : -10), 0],
      units: Array.from({ length: 8 }, (_, at) => ({ id: `g${index}:u${at}`, profileId: faction })) };
  });
  return { id: `cpu-targets-${total}`, mode: 'original', playerFaction: 'human', factions: [{ id: 'human', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'human', b: 'hive', state: 'hostile' }], fronts, routes: fronts.slice(1).map((front, index) => ({ id: `r${index}`, from: fronts[index].id, to: front.id, travelSeconds: 50 })),
    groups, profiles: [{ id: 'human', species: 'human', actorType: 'marine', maxHp: 100000, damage: 1, attackInterval: .25 },
      { id: 'hive', species: 'xenomorph', actorType: 'warrior', maxHp: 100000, damage: 1, attackInterval: .25 }],
    budgets: { active: 32 }, objectives: { externalVictory: true }, ai: { enabled: false } };
}

function stateFingerprint(simulation) {
  return sha({ time: simulation.time, units: [...simulation.units.values()].map(unit => [unit.id, unit.hp, unit.state, unit.position]),
    fronts: [...simulation.fronts.values()].map(front => [front.id, front.owner, front.capture]) });
}

function remoteSample(Constructor, total, ticks) {
  const simulation = new Constructor(targetingConfiguration(total));
  let remoteCombatMs = 0;
  const remote = simulation._remoteCombat.bind(simulation);
  simulation._remoteCombat = () => { const start = performance.now(); remote(); remoteCombatMs += performance.now() - start; };
  const start = performance.now();
  for (let tick = 0; tick < ticks; tick++) simulation.update(.25);
  const totalMs = performance.now() - start, hash = stateFingerprint(simulation), counters = simulation.getTargetingCounters?.() ?? null;
  assert.equal(simulation.assertConservation(), true); simulation.dispose();
  return { totalMs, remoteCombatMs, remoteCombatShare: remoteCombatMs / totalMs, hash, counters };
}

function seededRandom(seed) { let state = seed >>> 0; return () => ((state = Math.imul(state, 1664525) + 1013904223 >>> 0) / 4294967296); }

function detailedFixture(total) {
  const configuration = targetingConfiguration(total, 2);
  configuration.groups.forEach((group, index) => {
    group.frontId = 'f0'; group.position = [index % 2 ? 8 : -8, 0];
    group.units.forEach((unit, at) => { unit.position = [index % 2 ? 8 : -8, ((Math.floor(index / 2) * 8 + at) - total / 4) * 2]; });
  });
  const simulation = new BattleSimulation(configuration), scene = new THREE.Scene();
  const horde = new XenomorphHorde(scene, audio), marines = new ColonialMarinesManager(scene, audio);
  const director = new CombatDirector({ graceSeconds: 0 }), actors = [];
  for (const manager of [horde, marines]) { manager.battleSimulation = simulation; manager.combatDirector = director; manager.combatActorsProvider = () => actors; }
  for (const group of simulation.groups.values()) {
    group.materialized = true; group.state = 'active';
    const manager = group.factionId === 'hive' ? horde : marines;
    for (const id of group.units) {
      const unit = simulation.units.get(id); unit.state = 'active';
      const actor = manager.spawnBattleUnit(unit, simulation.getGroup(group.id));
      actor.grenadeCooldown = 1e9; actors.push(actor);
    }
  }
  const player = { hp: 100000, factionId: 'human', position: new THREE.Vector3(10000, 0, 10000), takeDamage() {} };
  return { simulation, horde, marines, actors, player, update() { director.update(1 / 60, [player]); horde.update(1 / 60, player); marines.update(1 / 60, player, horde); },
    clear() { horde.clearWave(); marines.clearSquad(); simulation.dispose(); } };
}

function sampledShare(profile, name) {
  const nodes = new Map(profile.nodes.map(node => [node.id, node])), parents = new Map();
  for (const node of profile.nodes) for (const child of node.children ?? []) parents.set(child, node.id);
  const samples = profile.samples ?? [], deltas = profile.timeDeltas ?? samples.map(() => 1);
  let selected = 0, total = 0, selectedSamples = 0;
  for (let at = 0; at < samples.length; at++) {
    total += deltas[at] ?? 0;
    let id = samples[at], matches = false;
    while (id) { if (nodes.get(id)?.callFrame.functionName === name) { matches = true; break; } id = parents.get(id); }
    if (matches) { selected += deltas[at] ?? 0; selectedSamples++; }
  }
  return { sampledMicroseconds: selected, totalSampledMicroseconds: total, share: total ? selected / total : null, selectedSamples, samples: samples.length };
}

async function detailedSample(total, frames) {
  const originalRandom = Math.random; let fixture, session;
  try {
    Math.random = seededRandom(20528); fixture = detailedFixture(total); Math.random = seededRandom(20528);
    for (let frame = 0; frame < 120; frame++) fixture.update();
    session = new Session(); session.connect();
    await session.post('Profiler.enable'); await session.post('Profiler.setSamplingInterval', { interval: 100 });
    await session.post('Profiler.start');
    const start = performance.now();
    for (let frame = 0; frame < frames; frame++) fixture.update();
    const managersMs = performance.now() - start;
    const { profile } = await session.post('Profiler.stop'); await session.post('Profiler.disable');
    const choices = fixture.actors.map(actor => [actor.battleUnitId,
      selectBattleTarget(actor.combatManager, actor, fixture.player, fixture.horde.aliens)?.actor?.battleUnitId ?? null]);
    const state = fixture.actors.map(actor => [actor.battleUnitId, actor.hp, ...actor.mesh.position.toArray()]);
    return { actors: total, detailedCap: fixture.simulation.budgets.active, frames, managersMs,
      targetSearch: sampledShare(profile, 'selectBattleTarget'), targetSelectionHash: sha(choices), stateHash: sha(state), actorsStillAlive: fixture.actors.filter(actor => actor.hp > 0).length };
  } finally { session?.disconnect(); fixture?.clear(); Math.random = originalRandom; }
}

export async function main(argv = process.argv.slice(2)) {
  let output = resolve(root, 'docs/qa/strategic-depth-20261028/targeting-benchmark.json'), baselinePath = null;
  for (let index = 0; index < argv.length; index++) {
    if (argv[index] === '--output') output = resolve(argv[++index]);
    else if (argv[index] === '--baseline') baselinePath = resolve(argv[++index]);
    else throw new Error('Unknown option ' + argv[index]);
  }
  const baseline = baselinePath ? (await import(pathToFileURL(baselinePath))).BattleSimulation : null;
  const report = { version: 2, startedAt: new Date().toISOString(), scope: 'CPU strategic ticks and real detailed manager updates; procedural meshes, no WebGL, GPU timing, FPS or human certification',
    measurementScope: { remoteCombat: 'entire _remoteCombat phase including target selection, damage, HP and death updates', detailedTargetSearch: 'inspector inclusive selectBattleTarget share of actual Horde/Marine manager updates' },
    seed: 20528, hardwareCertified: false, node: process.version, remote: [], detailed: [], baseline: baselinePath ? [] : null };
  if (baselinePath) report.baselineSourceSha256 = sha(await readFile(baselinePath));
  const sourceFiles = ['js/battlefield/BattleSimulation.js', 'js/battlefield/BattleIntel.js', 'js/engine/BattleActorSupport.js', 'js/entities/XenomorphHorde.js', 'js/entities/ColonialMarines.js'];
  report.sourceHashesBefore = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, sha(await readFile(resolve(root, path)))])));
  for (const count of [512, 1024]) {
    remoteSample(BattleSimulation, count, 40);
    const runs = Array.from({ length: 5 }, () => remoteSample(BattleSimulation, count, 240));
    assert.equal(new Set(runs.map(run => run.hash)).size, 1, 'remote outcomes must be deterministic');
    report.remote.push({ units: count, fixedTicks: 240, runs, medianMs: median(runs.map(run => run.totalMs)), medianRemoteCombatShare: median(runs.map(run => run.remoteCombatShare)) });
    if (baseline) {
      remoteSample(baseline, count, 40);
      const previous = Array.from({ length: 5 }, () => remoteSample(baseline, count, 240));
      assert.equal(new Set(previous.map(run => run.hash)).size, 1); assert.equal(previous[0].hash, runs[0].hash, 'indexing preserves real reciprocal combat outcomes');
      report.baseline.push({ units: count, runs: previous, medianMs: median(previous.map(run => run.totalMs)) });
    }
  }
  for (const count of [16, 32]) {
    const runs = [await detailedSample(count, 2400), await detailedSample(count, 2400)];
    assert.equal(runs[0].stateHash, runs[1].stateHash, 'detailed combat outcomes must repeat under the declared seed');
    assert.equal(runs[0].targetSelectionHash, runs[1].targetSelectionHash, 'detailed targets must repeat');
    report.detailed.push({ actors: count, runs, medianManagersMs: median(runs.map(run => run.managersMs)),
      maximumTargetSearchShare: Math.max(...runs.map(run => run.targetSearch.share ?? 0)) });
  }
  report.detailedTargetSearchBelowHalfInMeasuredRuns = report.detailed.every(row => row.maximumTargetSearchShare < .5);
  report.remoteDoublingRatio = report.remote[1].medianMs / report.remote[0].medianMs;
  report.detailedDoublingRatio = report.detailed[1].medianManagersMs / report.detailed[0].medianManagersMs;
  report.sourceHashesAfter = Object.fromEntries(await Promise.all(sourceFiles.map(async path => [path, sha(await readFile(resolve(root, path)))])));
  report.sourceUnchangedDuringMeasurement = JSON.stringify(report.sourceHashesBefore) === JSON.stringify(report.sourceHashesAfter);
  report.status = !report.sourceUnchangedDuringMeasurement ? 'source_changed_repeat_measurement' : report.detailedTargetSearchBelowHalfInMeasuredRuns ? 'passed' : 'measured_target_search_still_dominates';
  report.completedAt = new Date().toISOString();
  await mkdir(dirname(output), { recursive: true }); await writeFile(output, JSON.stringify(report, null, 2) + '\n');
  console.log(JSON.stringify({ status: report.status, remoteDoublingRatio: report.remoteDoublingRatio, detailedDoublingRatio: report.detailedDoublingRatio,
    detailedSearchShares: report.detailed.map(row => [row.actors, row.maximumTargetSearchShare]), output }));
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) main().catch(error => { console.error(error.stack); process.exitCode = 1; });
