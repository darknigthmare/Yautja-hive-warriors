/* 32 squad actors ordered across rooms, 600 steps; median ms per frame over 5 runs. */
const root = process.argv[2];
const THREE = await import(`${root}/node_modules/three/build/three.module.js`);
const { EnvironmentManager } = await import(`${root}/js/entities/Environment.js`);
const { LEVELS_DATA } = await import(`${root}/js/data/levelsData.js`);
const { moveSquadActor } = await import(`${root}/js/engine/FactionSquadRoles.js`);
const results = {};
for (const levelId of ['val_verde_jungle', 'romulus_station']) {
  const env = new EnvironmentManager(new THREE.Scene()); env.buildLevelEnvironment({ ...LEVELS_DATA.find(l => l.id === levelId), battlefield: true });
  for (const g of env.battlefieldLayout.gates) env.openGate(g.id);
  const S = env.battlefieldLayout.sectors, runs = [];
  for (let r = 0; r < 5; r++) {
    const actors = Array.from({ length: 32 }, (_, i) => { const from = S[i % 3], p = new THREE.Vector3(from.center[0] + (i % 4) * 3 - 4.5, 0, from.center[1] + Math.floor(i / 4) % 4 * 3); env.resolveMovement(p, .75); return { mesh: { position: p, rotation: { y: 0 } }, radius: .75, goal: new THREE.Vector3(S[(i % 3) + 2].center[0], 0, S[(i % 3) + 2].center[1]) }; });
    const t = process.hrtime.bigint();
    for (let s = 0; s < 600; s++) for (const a of actors) moveSquadActor({ environment: env }, a, a.goal, 1 / 60, 8);
    runs.push(Number(process.hrtime.bigint() - t) / 1e6 / 600);
  }
  runs.sort((a, b) => a - b); results[levelId] = +runs[2].toFixed(3);
}
console.log(JSON.stringify(results));
