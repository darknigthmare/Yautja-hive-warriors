// Recette REC-012 (audit du 26/10/2026, feuille Validation) — coutures, portes et
// continuité physique. Construit le terrain pilote réel (EnvironmentManager,
// graine figée), traverse chaque liaison dans les deux sens, puis répète après
// capture, sabotage, ouverture/fermeture de porte et changement de phase.
// Les itinéraires stratégiques de chaque faction sont interrogés sur la même
// géométrie. Aucun code source n'est modifié.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from 'three';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { EnvironmentManager } from '../js/entities/Environment.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';

const ID = 'REC-012', SEED = 0;
const ROOT = new URL('../', import.meta.url);
const commit = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const clauses = [], timeline = [], links = [], routeStates = [];
function check(key, attendu, fn) {
  try { const details = fn(); clauses.push({ clause: key, attendu, verdict: 'prouvé', details }); return details; }
  catch (error) { clauses.push({ clause: key, attendu, verdict: 'échec', details: String(error.message).slice(0, 600) }); throw error; }
}
after(() => {
  const out = new URL('docs/qa/recettes-20261114/', ROOT); mkdirSync(out, { recursive: true });
  writeFileSync(new URL(`${ID.toLowerCase()}.json`, out), JSON.stringify({
    id: ID, source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation',
    perimetre: 'Coutures, portes et continuité physique', terrainPilote: "createOperationScene({operationId:'pilot'}) + AFF-06 (LD-18) ; contrôle AFF-14 (LD-23)", seed: SEED, commit,
    date: '2026-11-14', commande: 'node --test tests/recette-rec-012.test.js', preuveVideo: 'non produite — preuve par journal',
    planDesLiaisons: links, etatsPortesEtItineraires: routeStates, chronologie: timeline, clauses,
    nonAutomatisable: [{ element: 'vidéo aller-retour et captures avant/après', raison: 'pas de rendu WebGL en Node ; le journal donne positions, altitudes et états de portes.' },
      { element: 'lecture visuelle d’un même bâtiment depuis les zones voisines', raison: 'seule la persistance des collisions/positions est vérifiable ; l’apparence relève d’une revue visuelle.' }]
  }, null, 2) + '\n');
});

const round = value => Math.round(value * 1000) / 1000;
function build(operationId, seed = SEED) {
  const scene = createOperationScene({ operationId, mapSeed: seed });
  const env = new EnvironmentManager(new THREE.Scene());
  env.buildLevelEnvironment({ ...scene.level, mapId: scene.variant?.id, mapSeed: scene.layout.mapSeed, battlefield: true, strategicMode: true });
  const provider = (route, options) => physicalOperationRouteAvailable(env, route, options);
  const sim = new BattleSimulation(scene.config, { routeAvailabilityProvider: provider });
  return { scene, env, sim, layout: env.battlefieldLayout, dispose() { sim.dispose(); env.clearEnvironment(); } };
}
const gateDir = (layout, gate) => { const a = layout.sectors.find(s => s.id === gate.from), b = layout.sectors.find(s => s.id === gate.to);
  return { a, b, dir: new THREE.Vector3(b.center[0] - a.center[0], 0, b.center[1] - a.center[1]).normalize() }; };
/** Closed door: an actor walking from either sector centre toward the other one
 * is held before the door plane (signed penetration ≤ 0 from its own side). */
function blockedBothSides(env, gate) {
  const { a, b, dir } = gateDir(env.battlefieldLayout, gate), center = new THREE.Vector3(gate.center[0], 0, gate.center[1]), sides = [];
  for (const [from, to, sign] of [[a, b, 1], [b, a, -1]]) {
    const actor = new THREE.Vector3(from.center[0], 0, from.center[1]), goal = new THREE.Vector3(to.center[0], 0, to.center[1]);
    actor.y = env.getPlacementElevationAt(actor.x, actor.z);
    const step = goal.clone().sub(actor).normalize().multiplyScalar(.4); let deepest = -Infinity;
    for (let i = 0, n = Math.ceil(actor.distanceTo(goal) / .4) + 20; i < n; i++) {
      actor.add(step); actor.y = env.getElevationAt(actor.x, actor.z, actor.y); env.resolveMovement(actor);
      deepest = Math.max(deepest, actor.clone().sub(center).dot(dir) * sign);
    }
    sides.push(round(deepest));
  }
  return sides; // both must stay negative: no crossing from either side
}
/** Open door: walk centre → centre with real elevation and collision. */
function walk(env, from, to) {
  const start = new THREE.Vector3(from.center[0], 0, from.center[1]), goal = new THREE.Vector3(to.center[0], 0, to.center[1]);
  const actor = start.clone(); actor.y = env.getPlacementElevationAt(actor.x, actor.z);
  const dir = goal.clone().sub(start).normalize(), steps = Math.ceil(start.distanceTo(goal) / .4) + 20;
  let maxRise = 0, minY = Infinity, maxY = -Infinity;
  for (let step = 0; step < steps; step++) {
    const before = actor.y, remaining = new THREE.Vector3(goal.x - actor.x, 0, goal.z - actor.z);
    if (remaining.length() < .4) { actor.x = goal.x; actor.z = goal.z; } else actor.addScaledVector(dir, .4);
    actor.y = env.getElevationAt(actor.x, actor.z, actor.y); env.resolveMovement(actor);
    maxRise = Math.max(maxRise, Math.abs(actor.y - before)); minY = Math.min(minY, actor.y); maxY = Math.max(maxY, actor.y);
  }
  return { arrivee: round(Math.hypot(actor.x - goal.x, actor.z - goal.z)), sautMaxParPas: round(maxRise), altitudeMin: round(minY), altitudeMax: round(maxY) };
}
/** Geometry/decor signature that must not drift across mission events. */
function snapshot(env) {
  const L = env.battlefieldLayout;
  const colliders = env.colliders.filter(c => !c.gateId).map(c => Object.entries(c).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}:${round(v)}`).join(',')).sort();
  const elevations = L.gates.flatMap(g => { const { dir } = gateDir(L, g); return [-8, 0, 8].map(o => round(env.getPlacementElevationAt(g.center[0] + dir.x * o, g.center[1] + dir.z * o))); });
  return { sectors: L.sectors.map(s => [s.id, s.bounds]), corridors: L.corridors.map(c => [c.id, c.bounds]), gates: L.gates.map(g => [g.id, g.center]),
    elevations, collidersStatiques: colliders.length, colliderHash: colliders.join('|').length + ':' + colliders.slice(0, 5).join('|') + ':' + colliders.slice(-5).join('|'), colliders };
}
const doorState = env => env.battlefieldLayout.gates.map(g => ({ id: g.id, ouverte: env.isGateOpen(g.id), panneauVisible: env.gateVisuals.get(g.id).panel.visible,
  collisionPresente: env.colliders.includes(env.gateVisuals.get(g.id).collider) }));
function crossAll(f, label) {
  const corridorGates = f.layout.gates.filter(g => !g.tactical), rows = [];
  for (const gate of corridorGates) {
    const { a, b } = gateDir(f.layout, gate), forward = walk(f.env, a, b), back = walk(f.env, b, a);
    assert.ok(forward.arrivee < .05, `${label}: ${gate.id} ${a.id}→${b.id} not walkable (${forward.arrivee})`);
    assert.ok(back.arrivee < .05, `${label}: ${gate.id} ${b.id}→${a.id} not walkable (${back.arrivee})`);
    assert.ok(forward.sautMaxParPas < 1.2 && back.sautMaxParPas < 1.2, `${label}: ${gate.id} relief discontinuity`);
    rows.push({ etat: label, porte: gate.id, de: a.id, vers: b.id, aller: forward, retour: back });
  }
  return rows;
}
/** For each faction, ask the strategic graph for the same journey. */
function factionRoutes(sim, from, to) {
  return [...sim.factions.keys()].map(factionId => {
    const group = [...sim.groups.values()].find(g => g.factionId === factionId && g.units.some(id => sim.units.get(id).hp > 0 && sim.units.get(id).state !== 'reserve'));
    const path = sim._path(from, to);
    return { factionId, groupId: group?.id ?? null, chemin: path ? path.map(leg => leg.routeId) : null };
  });
}

test('REC-012 — every link of the pilot terrain is sealed from both sides while closed, then walkable both ways with continuous relief', () => {
  for (const operationId of ['pilot', 'AFF-06']) {
    const f = build(operationId);
    try {
      const reference = snapshot(f.env);
      check(`${operationId}:portes_fermees_deux_cotes`, 'Porte fermée : aucune entrée depuis l’un ou l’autre côté ; panneau visible et collision présente.', () => {
        const rows = f.layout.gates.filter(g => !g.tactical).map(gate => ({ porte: gate.id, retenue: blockedBothSides(f.env, gate) }));
        for (const row of rows) assert.ok(row.retenue.every(side => side < 0), `${row.porte} ${row.retenue}`);
        assert.ok(doorState(f.env).every(d => !d.ouverte && d.panneauVisible && d.collisionPresente));
        for (const route of f.sim.routes.values()) assert.equal(f.sim._routeTraversable(route), false, `${route.id} closed while its doors are closed`);
        routeStates.push({ operation: operationId, etat: 'initial_portes_fermees', portes: doorState(f.env), routes: [...f.sim.routes.values()].map(r => ({ id: r.id, traversable: f.sim._routeTraversable(r), portes: r.physicalGateIds })) });
        return rows;
      });
      for (const gate of f.layout.gates) f.env.openGate(gate.id);
      timeline.push({ operation: operationId, t: f.sim.time, event: 'ouverture_portes', portes: f.layout.gates.length });
      check(`${operationId}:traversee_deux_sens`, 'Chaque liaison est traversée depuis les deux côtés : entrée, sortie et relief concordent.', () => {
        const rows = crossAll(f, 'ouvert'); links.push(...rows.map(row => ({ operation: operationId, ...row })));
        assert.ok(doorState(f.env).every(d => d.ouverte && !d.panneauVisible && !d.collisionPresente));
        return { liaisons: rows.length };
      });
      const events = [
        ['capture', () => f.sim.captureBase([...f.sim.fronts.keys()][1], f.sim.config.playerFaction, 'rec012_capture')],
        ['sabotage', () => f.sim.damageSource([...f.sim.fronts.keys()].at(-1), 1e6, 'rec012_sabotage')],
        ['changement_phase', () => { for (const sector of f.layout.sectors) { f.env.completeSector(sector.id); f.env.setActiveSector(sector.id); } return true; }]
      ];
      for (const [name, act] of events) {
        check(`${operationId}:apres_${name}`, `Après ${name} : relief, limites, emplacement des bâtiments et accès inchangés ; liaisons toujours traversables.`, () => {
          assert.equal(act(), true, `${name} applied`);
          for (let t = 0; t < 1; t += .25) f.sim.update(.25, { players: [] });
          const now = snapshot(f.env);
          assert.deepEqual(now.sectors, reference.sectors); assert.deepEqual(now.corridors, reference.corridors); assert.deepEqual(now.gates, reference.gates);
          assert.deepEqual(now.elevations, reference.elevations); assert.deepEqual(now.colliders, reference.colliders);
          const rows = crossAll(f, name);
          timeline.push({ operation: operationId, t: f.sim.time, event: name, liaisonsTraversees: rows.length, collidersStatiques: now.collidersStatiques });
          return { liaisons: rows.length, collidersStatiques: now.collidersStatiques };
        });
      }
      check(`${operationId}:vue_depuis_voisins`, 'Un bâtiment visible garde son emplacement et ses accès lorsqu’on l’observe depuis chaque zone voisine.', () => {
        const rows = [];
        for (const sector of f.layout.sectors) {
          f.env.updateBattlefieldVisibility([{ x: sector.center[0], z: sector.center[1] }]);
          const now = snapshot(f.env); assert.deepEqual(now.colliders, reference.colliders, `observed from ${sector.id}`);
          rows.push({ depuis: sector.id, collidersStatiques: now.collidersStatiques, secteursVisibles: [...f.env.sectorVisuals].filter(([, v]) => v.visible).map(([k]) => k) });
        }
        return rows;
      });
    } finally { f.dispose(); }
  }
});

test('REC-012 — a physical door change updates the routes of every faction, then reopening restores them', () => {
  const f = build('AFF-06');
  try {
    for (const gate of f.layout.gates) f.env.openGate(gate.id);
    check('AFF-06:itineraires_toutes_factions', 'Les changements physiques actualisent les itinéraires de toutes les factions.', () => {
      const fronts = [...f.sim.fronts.keys()], from = fronts[0], to = fronts.at(-1);
      const main = [...f.sim.routes.values()].find(r => r.physicalGateIds.length && !/flank|outer/.test(r.id));
      const before = factionRoutes(f.sim, from, to);
      assert.ok(before.every(row => row.chemin?.length));
      f.env.closeGate(main.physicalGateIds[0]);
      const detour = factionRoutes(f.sim, from, to);
      assert.ok(detour.every(row => !row.chemin || !row.chemin.includes(main.id)), 'no faction keeps the sealed main route');
      assert.equal(new Set(detour.map(row => JSON.stringify(row.chemin))).size, 1, 'every faction sees the same physical graph');
      for (const gate of f.layout.gates) f.env.closeGate(gate.id);
      const sealed = factionRoutes(f.sim, from, to);
      assert.ok(sealed.every(row => row.chemin === null));
      const orders = [...f.sim.factions.keys()].map(factionId => { const g = [...f.sim.groups.values()].find(x => x.factionId === factionId && x.frontId !== to && x.units.some(id => f.sim.units.get(id).state === 'distant'));
        return { factionId, groupId: g?.id ?? null, reponse: g ? f.sim.issueOrder(g.id, { type: 'attack', frontId: to, issuer: 'rec012' }) : null }; });
      assert.ok(orders.filter(o => o.reponse).every(o => o.reponse.accepted === false && o.reponse.reason === 'no_open_route'));
      for (const gate of f.layout.gates) f.env.openGate(gate.id);
      const reopened = factionRoutes(f.sim, from, to);
      assert.deepEqual(reopened, before);
      routeStates.push({ operation: 'AFF-06', trajet: `${from}→${to}`, avant: before, porteRoutePrincipaleFermee: { porte: main.physicalGateIds[0], chemins: detour },
        toutesPortesFermees: sealed, ordresRefuses: orders.map(o => ({ factionId: o.factionId, groupId: o.groupId, reason: o.reponse?.reason ?? null })), apresReouverture: reopened });
      return { routePrincipale: main.id, detour: detour[0].chemin, ordres: orders.map(o => [o.factionId, o.reponse?.reason]) };
    });
  } finally { f.dispose(); }
});

test('REC-012 — every catalogue route of AFF-14 (Lethe, LD-23) is bound to physical doors', () => {
  const f = build('AFF-14');
  try {
    const unbound = [...f.sim.routes.values()].filter(r => !r.physicalGateIds?.length).map(r => r.id);
    for (const gate of f.layout.gates) if (f.env.isGateOpen(gate.id)) f.env.closeGate(gate.id);
    const traversableWhileSealed = [...f.sim.routes.values()].filter(r => f.sim._routeTraversable(r)).map(r => r.id);
    clauses.push({ clause: 'AFF-14:routes_liees_aux_portes', attendu: 'Les changements physiques (portes) actualisent les itinéraires de toutes les factions (contrôle sur une seconde carte).',
      verdict: unbound.length ? 'échec (défaut)' : 'prouvé', details: { routesSansPorte: unbound, traversablesToutesPortesFermees: traversableWhileSealed,
        fronts: f.scene.config.fronts.length, ancresCarte: f.layout.frontAnchorIds, secteursFronts: f.scene.config.sceneBinding.frontSectorIds,
        reproduction: "createOperationScene({operationId:'AFF-14',mapSeed:0}).config.routes.map(r=>r.physicalGateIds) → [[],[]] (identique avec mapSeed 7)",
        fichiers: ['js/battlefield/BattlefieldOperation.js:26', 'js/battlefield/BattlefieldOperation.js:37-40', 'js/data/BattlefieldMapVariants.js:357-363 (LD-23 fronts: 4)', 'js/data/BattleCatalog.js:261 (count = budget.fronts = 3)'] } });
    assert.deepEqual(unbound, [], 'AFF-14 strategic routes ignore every physical door');
  } finally { f.dispose(); }
});
