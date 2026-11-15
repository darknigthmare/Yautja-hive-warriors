import test from 'node:test';
import assert from 'node:assert/strict';
import { buildBattlefield, corridorCounterflow, routeCounterflow, strategicRoutes } from '../scripts/lib/counterflow-stress.mjs';

/* AUD-063: an assault crosses a choke point while an evacuation goes the other way on the real
 * built level. Every agent must arrive and none may stay stuck. The full sweep over every gate and
 * route of every map is scripts/qa-counterflow-stress.mjs; these cases keep its regressions. */
function assertFlow(result, label) {
  assert.deepEqual(result.stuck, [], `${label}: every agent arrives within ${result.limitSeconds} s`);
  assert.ok(result.worstStill < 3, `${label}: no agent stands still more than 3 s (worst ${result.worstStill} s)`);
}

for (const levelId of ['val_verde_jungle', 'gunnison_forest', 'antarctic_pyramid', 'la_rooftops']) {
  test(`${levelId}: an assault and an opposite evacuation both cross the first gate without a lasting block`, () => {
    const env = buildBattlefield(levelId);
    assertFlow(corridorCounterflow(env, env.battlefieldLayout.corridors[0]), levelId);
  });
}

/* Strategic fronts: a flank that overlaps the main corridor line (LA rooftops), an L-shaped outer
 * route through several rooms (Val Verde), and the LD-01 raised bridge. */
for (const [levelId, mapId, routeSuffix] of [['la_rooftops', undefined, '-flank'], ['val_verde_jungle', undefined, '-outer'], ['gunnison_forest', 'LD-01', '-flank']]) {
  test(`${levelId}${mapId ? ` ${mapId}` : ''}: opposite columns complete the ${routeSuffix.slice(1)} route through its tactical gate`, () => {
    const env = buildBattlefield(levelId, { mapId, strategicMode: true });
    const route = strategicRoutes(env).find(item => item.id.endsWith(routeSuffix));
    const result = routeCounterflow(env, route, { assault: 4, evacuation: 2 });
    assertFlow(result, route.id);
    if (env.tacticalBridges.size) assert.ok(result.highest > 2.5, 'the column crosses the raised bridge deck, not the gap');
  });
}
