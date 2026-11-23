/* Scripted boss balance probe (run from the repo root). A fixed duel, not a played fight:
 * the hunter stands at 8 units, hits the boss from the front every 0.5 s for 100 (heavy every 4th),
 * and never dodges. Reports what each boss deals and how long it takes to fall under that pressure. */
const THREE = await import(process.cwd() + '/node_modules/three/build/three.module.js');
const root = process.cwd() + '/';
const { BossManager } = await import(root + 'js/entities/Bosses.js');
const { BOSS_REGISTRY } = await import(root + 'js/data/BossRegistry.js');
class Probe extends BossManager { createBossMesh() { return new THREE.Group(); } }
const audio = new Proxy({}, { get: () => () => {} });
const rows = [];
for (const def of Object.values(BOSS_REGISTRY)) {
  const manager = new Probe(new THREE.Scene(), audio); manager.spawnBoss(def.id, new THREE.Vector3());
  const boss = manager.activeBoss; let dealt = 0, hits = 0, exposed = 0, hidden = 0, t = 0, strikes = 0, killedAt = null;
  const hunter = { hp: 1e9, position: new THREE.Vector3(0, 0, 8), mesh: new THREE.Group(), radius: 1, plasmaEnergy: 100,
    takeDamage(amount) { dealt += amount; hits++; } };
  const horde = { spawnChestburster() {}, aliens: [], checkMeleeHits() { return []; } };
  for (let frame = 0; frame < 60 * 180 && manager.activeBoss; frame++) {
    manager.update(1 / 60, hunter, horde); t += 1 / 60;
    if (!manager.activeBoss) break;
    if (boss.exposedUntil > manager.time) exposed += 1 / 60;
    if (boss.ventUntil > 0 || boss.burrowed || boss.diving) hidden += 1 / 60;
    if (frame % 30 === 0 && boss.hp > 0) { strikes++; const ev = manager.takeDamage(100, horde, { attackKind: strikes % 4 ? 'melee' : 'heavy', origin: hunter.position.clone() }); if (!manager.activeBoss) { killedAt = t; break; } }
  }
  rows.push({ id: def.id, ascension: !!def.ascension, hp: def.hp, height: def.height, ttk: killedAt ? +killedAt.toFixed(1) : null, dps: +(dealt / Math.min(t, 180)).toFixed(1), hits, exposedPct: Math.round(100 * exposed / t), hiddenPct: Math.round(100 * hidden / t) });
  manager.clear();
}
console.log(JSON.stringify(rows));
