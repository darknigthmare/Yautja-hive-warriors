// Recette REC-004 — conservation des effectifs et catégories d'entités.
// Audit 2026-10-26, feuille Validation. Scénarios EFF-03 (opération catalogue
// AFF-18, budget EFF-03) puis EFF-06 (aucune opération du catalogue ne peut
// l'instancier : configuration explicite aux chiffres EFF-06, voir preuve).
// Temps simulé, graine de carte fixe, API existantes uniquement.
import test, { after } from 'node:test';
import assert from 'node:assert/strict';
import { execSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import { createOperationScene } from '../js/battlefield/OperationScene.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { physicalOperationRouteAvailable } from '../js/battlefield/PhysicalRouteAvailability.js';
import { HOST_INFESTATION_RULES } from '../js/battlefield/HostInfestation.js';
import { BATTLE_PROFILES, BATTLE_OPERATIONS, getBattleOperationConfig, getBattleBudget, validateBattleRoster } from '../js/data/BattleCatalog.js';

const ROOT = new URL('..', import.meta.url).pathname;
const COMMIT = execSync('git rev-parse HEAD', { cwd: ROOT }).toString().trim();
const DIRTY = execSync('git status --porcelain -- js', { cwd: ROOT }).toString().split('\n').filter(Boolean);
const OUT = `${ROOT}docs/qa/recettes-20261114/rec-004.json`;
const MAP_SEED = 0, STEP = 0.25;
const STATES = ['active', 'distant', 'reserve', 'dead', 'evacuated', 'captured'];
const evidence = {
  recette: 'REC-004', titre: "Conservation des effectifs et catégories d'entités",
  source: 'docs/audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx#Validation!REC-004',
  dateExecution: '2026-11-14', commit: COMMIT, sourcesJsNonCommitees: DIRTY, graine: { mapSeed: MAP_SEED, pasSimulation: STEP, horloge: 'temps simulé, aucun Math.random dans BattleSimulation' },
  commande: 'node --test tests/recette-rec-004.test.js',
  preuveVideo: 'non produite — preuve par journal de simulation',
  scenarios: {}, clauses: [],
};
const clause = (id, texte, verdict, details = {}) => { evidence.clauses.push({ id, texte, verdict, ...details }); return verdict === 'prouvé'; };
after(() => { mkdirSync(new URL('.', `file://${OUT}`).pathname, { recursive: true }); writeFileSync(OUT, JSON.stringify(evidence, null, 1) + '\n'); });

/* Headless stand-in for BattleActorBridge: it only keeps the HP/position of the
 * exact identities it was handed and returns them on despawn (the real bridge's
 * contract). It never creates an identity. */
function liveBridge(ref) {
  const live = new Map(), log = [];
  return { live, log,
    spawnGroup(group, units) { for (const unit of units) live.set(unit.id, { hp: unit.hp, position: [...unit.position] }); log.push([ref.sim?.time ?? 0, 'spawn', group.id, units.length]); return true; },
    despawnGroup(group, units) { log.push([ref.sim?.time ?? 0, 'despawn', group.id, units.length]); return units.map(unit => { const actor = live.get(unit.id) ?? unit; live.delete(unit.id); return { id: unit.id, hp: actor.hp, position: [...actor.position] }; }); } };
}
function driveActors(sim, bridge, dt, speed = 6) {
  for (const directive of sim.getActorDirectives()) {
    const actor = bridge.live.get(directive.id); if (!actor || directive.incapacitated) continue;
    const [tx, tz] = directive.targetPosition, dx = tx - actor.position[0], dz = tz - actor.position[1], d = Math.hypot(dx, dz);
    if (d < 0.05) continue; const k = Math.min(1, speed * dt / d);
    actor.position = [actor.position[0] + dx * k, actor.position[1] + dz * k]; sim.syncUnit(directive.id, { position: actor.position });
  }
}
const openGates = layout => ({ battlefieldLayout: layout, isGateOpen: () => true, isTacticalRouteAvailable: () => true });

/* Independent ledger: it does not trust assertConservation alone. */
class Ledger {
  constructor(sim, label) {
    this.sim = sim; this.label = label; this.initialIds = new Set(sim.units.keys());
    this.initial = this.counts(); this.state = new Map([...sim.units.values()].map(unit => [unit.id, unit.state]));
    this.hp = new Map([...sim.units.values()].map(unit => [unit.id, unit.hp]));
    this.transitions = []; this.violations = []; this.timeline = []; this.events = [];
    this.retreated = new Set(); this.healEvents = 0;
  }
  counts() {
    const out = {};
    for (const unit of this.sim.units.values()) {
      const row = out[unit.factionId] ??= { allocated: 0, ...Object.fromEntries(STATES.map(state => [state, 0])), wounded: 0, aboardAPC: 0 };
      row.allocated++; row[unit.state]++; if (unit.incapacitated) row.wounded++; if (unit.apcSeat !== undefined || unit.apcCrewRole !== undefined) row.aboardAPC++;
    }
    return out;
  }
  observe(event) {
    this.events.push(event);
    if (event.type === 'group_reconstitution_required') this.retreated.add(event.groupId);
    if (['field_medic_treatment', 'field_technical_repair'].includes(event.type)) this.healEvents++;
  }
  tick() {
    const sim = this.sim, now = sim.time;
    if (sim.units.size !== this.initialIds.size || [...sim.units.keys()].some(id => !this.initialIds.has(id))) this.violations.push([now, 'identity_set_changed']);
    const owners = new Map();
    for (const group of sim.groups.values()) for (const id of group.units) { if (owners.has(id)) this.violations.push([now, 'unit_in_two_groups', id]); owners.set(id, group.id); }
    if (owners.size !== sim.units.size) this.violations.push([now, 'unit_without_group']);
    for (const unit of sim.units.values()) {
      const before = this.state.get(unit.id);
      if (!STATES.includes(unit.state)) this.violations.push([now, 'unknown_state', unit.id, unit.state]);
      if (before !== unit.state) {
        this.transitions.push([now, unit.id, unit.factionId, unit.groupId, before, unit.state]);
        if (['dead', 'evacuated', 'captured'].includes(before)) this.violations.push([now, 'terminal_state_left', unit.id, before, unit.state]);
        if (unit.state === 'reserve') this.violations.push([now, 'returned_to_reserve', unit.id, before]);
        if (before === 'reserve') {
          const arrival = this.events.find(event => event.type === 'reinforcements_arrived' && event.groupId === unit.groupId && Math.abs(event.time - now) < 1e-6);
          const inbound = this.events.find(event => event.type === 'reinforcements_inbound' && event.groupId === unit.groupId && event.time <= now);
          if (!arrival || !inbound || !sim.fronts.get(arrival.sourceId)?.reinforcementSource) this.violations.push([now, 'reserve_left_without_recorded_source', unit.id]);
        }
        this.state.set(unit.id, unit.state);
      }
      if (unit.state === 'dead' && unit.hp !== 0) this.violations.push([now, 'dead_with_hp', unit.id]);
      const previousHp = this.hp.get(unit.id);
      if (unit.hp > previousHp + 1e-9 && this.retreated.has(unit.groupId) && !this.healEvents) this.violations.push([now, 'retreated_unit_healed_without_source', unit.id, previousHp, unit.hp]);
      this.hp.set(unit.id, unit.hp);
    }
    for (const [factionId, row] of Object.entries(this.counts())) {
      const initial = this.initial[factionId], entries = 0;
      const final = row.active + row.distant + row.reserve, losses = row.dead, exits = row.evacuated + row.captured;
      if (initial.allocated + entries !== final + losses + exits) this.violations.push([now, 'reconciliation_failed', factionId]);
      if (row.reserve > initial.reserve) this.violations.push([now, 'reserve_grew', factionId]);
    }
  }
  sample() { this.timeline.push({ t: this.sim.time, parFaction: this.counts() }); }
  reconciliation() {
    const final = this.counts();
    return Object.fromEntries(Object.entries(final).map(([factionId, row]) => {
      const initial = this.initial[factionId];
      const entreesAutorisees = this.events.filter(event => event.type === 'reinforcements_arrived' && this.sim.groups.get(event.groupId).factionId === factionId)
        .reduce((sum, event) => sum + this.sim.groups.get(event.groupId).units.length, 0);
      return [factionId, { initialAlloue: initial.allocated, initialDeploye: initial.distant + initial.active, initialReserve: initial.reserve,
        entreesExterieures: 0, arriveesDepuisReserveEnregistrees: entreesAutorisees,
        etatsFinaux: { present: row.active + row.distant, reserve: row.reserve, blesses: row.wounded, aBordAPC: row.aboardAPC },
        pertes: row.dead, sorties: { evacues: row.evacuated, captures: row.captured },
        equation: `${initial.allocated} + 0 = ${row.active + row.distant + row.reserve} + ${row.dead} + ${row.evacuated + row.captured}`,
        equilibre: initial.allocated === row.active + row.distant + row.reserve + row.dead + row.evacuated + row.captured }];
    }));
  }
  perGroup() {
    return [...this.sim.groups.values()].map(group => {
      const units = group.units.map(id => this.sim.units.get(id));
      return [group.id, group.factionId, group.frontId, ...STATES.map(state => units.filter(unit => unit.state === state).length), units.filter(unit => unit.incapacitated).length];
    });
  }
}

const runs = {};

test('EFF-03 (AFF-18, budget EFF-03) : registre horodaté, rapprochement initial + entrées = états finaux + pertes + sorties', () => {
  const { config, layout } = createOperationScene({ operationId: 'AFF-18', players: 1, mapSeed: MAP_SEED });
  assert.equal(config.budgetId, 'EFF-03');
  const ref = {}, bridge = liveBridge(ref), env = openGates(layout); let ledger;
  const sim = ref.sim = new BattleSimulation(config, { spawnGroup: bridge.spawnGroup, despawnGroup: bridge.despawnGroup,
    routeAvailabilityProvider: (route, options) => physicalOperationRouteAvailable(env, route, options), announce: event => ledger?.observe(event) });
  ledger = new Ledger(sim, 'EFF-03');
  const objectives = new OperationObjectives(config, sim);
  const budget = getBattleBudget('EFF-03');
  const player = { id: 'player1', hp: 100, position: [...sim.fronts.get('front_a').position] };
  const script = [], at = (t, label, action) => script.push({ t, label, action });
  const clanAt = frontId => [...sim.groups.values()].filter(group => group.factionId === 'player_clan' && group.frontId === frontId && group.state !== 'reserve');
  let wounded = null, retreatGroup = null, evacuatedGroup = null, playerKill = null, woundedSnapshot = null;
  at(0, 'retraite d’un groupe engagé sur le front B vers A (traversée de secteur)', () => { retreatGroup = clanAt('front_b')[0].id; return { groupId: retreatGroup, answer: sim.issueOrder(retreatGroup, { type: 'retreat', frontId: 'front_a', issuer: 'player1' }) }; });
  at(0.5, 'blessure et mise hors de combat d’un allié détaillé', () => {
    const unit = [...sim.units.values()].find(u => u.factionId === 'player_clan' && u.state === 'active' && !u.officer);
    bridge.live.get(unit.id).hp = Math.round(unit.maxHp * 0.3); sim.syncUnit(unit.id, { hp: bridge.live.get(unit.id).hp });
    sim.setUnitIncapacitated(unit.id, true); wounded = unit.id; return { unitId: unit.id, hp: unit.hp };
  });
  at(0.75, 'mort confirmée par le joueur (callback acteur, doublé)', () => {
    const unit = [...sim.units.values()].find(u => u.factionId === 'hive' && u.state === 'active');
    playerKill = unit.id; return { unitId: unit.id, accepted: sim.recordDeath({ entityId: unit.id, killerFaction: 'player_clan', cause: 'hunter_melee' }), duplicate: sim.recordDeath({ entityId: unit.id, killerFaction: 'player_clan', cause: 'late_callback' }) };
  });
  at(1, 'relevé du blessé (état comptable et force de combat du groupe)', () => { const unit = sim.getUnit(wounded), group = sim.getGroup(unit.groupId);
    woundedSnapshot = { t: sim.time, unite: { id: unit.id, etat: unit.state, hp: unit.hp, incapacitated: unit.incapacitated }, groupe: { id: group.id, alive: group.alive, combatReady: group.combatReady, incapacitated: group.incapacitated } }; return woundedSnapshot; });
  at(1, 'interaction civils : libérer les réfugiés (GRP-28 au format 8)', () => { const task = objectives.spec.tasks.find(t => t.id === 'refugees'); player.position = [...task.position]; return objectives.interact({ id: 'player1', hp: 100, position: task.position }); });
  at(1.5, 'évacuation d’un groupe allié détaillé du front A (sortie)', () => {
    const group = clanAt('front_a').find(g => g.materialized && !g.units.includes(wounded) && !g.path.length && g.units.every(id => !sim.units.get(id).incapacitated));
    evacuatedGroup = group?.id ?? null; return { groupId: evacuatedGroup, accepted: group ? sim.evacuateGroup(group.id) : false };
  });
  at(200, 'le joueur s’éloigne vers le front B (changement de niveau de détail)', () => { player.position = [...sim.fronts.get('front_b').position]; return { position: player.position }; });
  const DURATION = 600; let next = 0;
  for (let tick = 1; tick * STEP <= DURATION; tick++) {
    while (next < script.length && script[next].t <= sim.time + 1e-9) { const item = script[next++]; ledger.events.push({ type: 'test_script', time: sim.time, label: item.label, result: item.action() }); }
    sim.update(STEP, { players: [player] }); objectives.update(STEP, [player]); driveActors(sim, bridge, STEP);
    ledger.tick(); if (tick % 120 === 0) ledger.sample();
  }
  runs.eff03 = { sim, ledger, objectives, wounded, woundedSnapshot, retreatGroup, evacuatedGroup, playerKill, bridge, budget };
  const reconciliation = ledger.reconciliation();
  evidence.scenarios['EFF-03'] = {
    operation: 'AFF-18', budget: { id: 'EFF-03', ennemi: budget.enemy, allie: budget.ally, joueurs: budget.playerActive }, configDigest: sim.digest, dureeSimulee: sim.time,
    script: ledger.events.filter(event => event.type === 'test_script'),
    avant: ledger.initial, apres: ledger.counts(), rapprochement: reconciliation,
    registreHorodate: ledger.timeline, registreParGroupeFinal: { colonnes: ['groupe', 'faction', 'front', ...STATES, 'blesses'], lignes: ledger.perGroup() },
    transitionsIndividuelles: { colonnes: ['t', 'id', 'faction', 'groupe', 'avant', 'apres'], total: ledger.transitions.length, lignes: ledger.transitions },
    arrivees: ledger.events.filter(event => ['reinforcements_inbound', 'reinforcements_arrived', 'reinforcements_cancelled'].includes(event.type)).map(event => [event.time, event.type, event.groupId, event.sourceId ?? null, event.frontId ?? event.targetFrontId ?? null, event.count ?? null]),
    niveauDeDetail: bridge.log.slice(0, 400), violations: ledger.violations, resultat: sim.getResult(),
    civils: objectives.getHUDState().noncombatants,
  };
  const deadBy = t => ledger.transitions.filter(row => row[5] === 'dead' && row[2] === 'player_clan' && row[0] <= t).length;
  evidence.observations = [
    { id: 'OBS-1', texte: `EFF-03/AFF-18 : ${deadBy(4)} des 48 alliés Yautja meurent en simulation distante dans les 4 premières secondes (${deadBy(12)} à 12 s) ; la conservation reste exacte mais l’équilibre du front A hors bulle relève de REC-022/équilibrage, pas de REC-004.` },
    { id: 'OBS-2', texte: 'Renouvellement du détail sous les yeux du joueur : à t=1,25 s, quatre groupes détaillés du front A sont dématérialisés et remplacés alors que le joueur reste sur ce front ; le blessé AFF-18:player_clan:48:1 devient distant et meurt à t=1,5 s (distant_combat). Analysé comme défaut dans REC-005 (js/battlefield/BattleSimulation.js:522 et :539).',
      journal: bridge.log.slice(0, 16) },
  ];
  assert.deepEqual(ledger.violations, []);
  for (const row of Object.values(reconciliation)) assert.equal(row.equilibre, true);
  assert.equal(sim.assertConservation(), true);
  assert.ok(ledger.transitions.some(row => row[5] === 'dead'), 'des pertes réelles ont été enregistrées');
  assert.ok(ledger.transitions.some(row => row[4] === 'reserve'), 'au moins une arrivée autorisée depuis la réserve');
});

test('EFF-03 : chaque individu dans un seul état comptable ; morts, évacués et retraites ne réapparaissent pas', () => {
  const { sim, ledger, wounded, retreatGroup, evacuatedGroup, playerKill } = runs.eff03;
  const single = ledger.violations.filter(v => ['unit_in_two_groups', 'unit_without_group', 'unknown_state', 'identity_set_changed'].includes(v[1])).length === 0;
  clause('C1', 'Chaque individu appartient à un seul état comptable (EFF-03)', single ? 'prouvé' : 'échec', { scenario: 'EFF-03', unitesSuivies: sim.units.size, controlesParPas: DURATION_TICKS(sim) });
  const noReturn = ledger.violations.filter(v => ['terminal_state_left', 'returned_to_reserve'].includes(v[1])).length === 0;
  const retreated = sim.groups.get(retreatGroup);
  const reconstitutions = ledger.events.filter(event => event.type === 'group_reconstituted');
  clause('C3a', 'Morts et retraites ne réapparaissent pas gratuitement (EFF-03)', noReturn && reconstitutions.every(event => event.newUnitsCreated === 0) ? 'prouvé' : 'échec', {
    scenario: 'EFF-03', mortsTotal: sim.deaths.size, morts: { exemple: playerKill, etat: sim.units.get(playerKill).state, doubleCallbackRefuse: true },
    groupeEnRetraite: { id: retreatGroup, ordre: retreated.order, reconstitution: retreated.reconstitution, survivants: retreated.units.filter(id => sim.units.get(id).hp > 0).length, unitesCreees: 0 },
    reconstitutions: reconstitutions.map(event => ({ t: event.time, groupId: event.groupId, supportGroupId: event.supportGroupId, newUnitsCreated: event.newUnitsCreated })),
    groupeEvacue: evacuatedGroup && { id: evacuatedGroup, etats: sim.groups.get(evacuatedGroup).units.map(id => sim.units.get(id).state) } });
  assert.ok(single); assert.ok(noReturn);
  assert.equal(sim.units.get(playerKill).state, 'dead');
  assert.equal(sim.deaths.get(playerKill).cause, 'hunter_melee', 'le double callback ne remplace pas la cause');
  if (evacuatedGroup) for (const id of sim.groups.get(evacuatedGroup).units) assert.ok(['evacuated', 'dead'].includes(sim.units.get(id).state));
  assert.ok(wounded);
});

function DURATION_TICKS(sim) { return Math.round(sim.time / STEP); }

test('EFF-03 : combattants, joueurs, blessés, civils et matériel sont distingués', () => {
  const { sim, objectives, woundedSnapshot: ws, budget } = runs.eff03;
  const counts = sim.getCounts();
  const playersOutside = !sim.units.has('player1') && counts.player_clan.allocated === budget.ally.total && counts.hive.allocated === budget.enemy.total;
  const woundedDistinct = ws.unite.hp > 0 && ['active', 'distant'].includes(ws.unite.etat) && ws.unite.incapacitated === true && ws.groupe.incapacitated === 1 && ws.groupe.combatReady === ws.groupe.alive - 1;
  const later = sim.getUnit(ws.unite.id), deathOfWounded = sim.deaths.get(ws.unite.id) ?? null;
  const civ = objectives.getHUDState().noncombatants, civIds = [...objectives.entities.values()].flatMap(entity => entity.members.map(member => member.id));
  const civiliansDistinct = civ.allocated === 8 && civIds.every(id => !sim.units.has(id)) && civ.captive + civ.rescued + civ.evacuated + civ.dead === civ.allocated && civ.rescued + civ.evacuated > 0;
  const equipment = BATTLE_PROFILES.find(profile => profile.eligibility.category === 'equipment');
  const civilianProfile = BATTLE_PROFILES.find(profile => profile.eligibility.category === 'civilian');
  const rosterEquipment = validateBattleRoster([{ profileId: equipment.id }]), rosterCivilian = validateBattleRoster([{ profileId: civilianProfile.id }], { reserve: true });
  const materialDistinct = !rosterEquipment.valid && !rosterCivilian.valid && [...sim.units.values()].every(unit => !['equipment', 'vehicle'].includes(unit.role));
  clause('C2a', 'Joueurs comptés hors effectifs PNJ (playersCountedSeparately)', playersOutside ? 'prouvé' : 'échec', { scenario: 'EFF-03', allouesPNJ: { player_clan: counts.player_clan.allocated, hive: counts.hive.allocated }, budget: { allie: budget.ally.total, ennemi: budget.enemy.total, joueurs: budget.playerActive } });
  clause('C2b', 'Blessés distingués : vivants, hors force de combat disponible', woundedDistinct ? 'prouvé' : 'échec', { scenario: 'EFF-03', releve: ws, etatFinal: { etat: later.state, hp: later.hp, mort: deathOfWounded } });
  clause('C2c', 'Civils distingués : registre non combattant séparé (OperationObjectives), hors unités et budgets', civiliansDistinct ? 'prouvé' : 'échec', { scenario: 'EFF-03', civils: civ, identifiants: civIds,
    limite: 'Les civils AFF-18 sont des membres d’entité objectif (8 réfugiés), pas une population GRP-28 simulée (fuite, dispersion) ; cf. C2e.' });
  clause('C2d', 'Matériel et civils ne peuvent pas entrer dans un effectif ou une réserve de combat', materialDistinct ? 'prouvé' : 'échec', { profilMateriel: equipment.id, erreurs: rosterEquipment.errors, profilCivil: civilianProfile.id, erreursCivil: rosterCivilian.errors });
  assert.ok(playersOutside); assert.ok(woundedDistinct); assert.ok(civiliansDistinct); assert.ok(materialDistinct);
});

const unusedTemplates = () => ['GRP-05', 'GRP-16', 'GRP-28'].filter(templateId => !BATTLE_OPERATIONS.some(operation => {
  const config = getBattleOperationConfig(operation.id, { allowHumanController: true });
  return config.groups.some(group => (group.sourceTemplateIds ?? []).includes(templateId));
}));
const missingTemplates = unusedTemplates();
clause('C2e', 'Couvoir GRP-05 (œufs comptés à part), extraction GRP-16 et civils GRP-28 inclus dans EFF-03/EFF-06', missingTemplates.length ? 'échec' : 'prouvé', {
  gabaritsAbsents: missingTemplates, reproduction: "node -e \"import('./js/data/BattleCatalog.js').then(m=>console.log(m.BATTLE_OPERATIONS.some(o=>m.getBattleOperationConfig(o.id,{allowHumanController:true}).groups.some(g=>g.sourceTemplateIds.includes('GRP-05')))))\" → false",
  defaut: 'Lacune de contenu : js/data/BattleCatalog.js:284-318 (getBattleOperationConfig) ne crée des groupes qu’à partir de forceAllocation ; aucune opération n’alloue GRP-05/GRP-16/GRP-28. Les états BattleSimulation (js/battlefield/BattleSimulation.js:24) n’ont pas de catégorie œuf ; les civils n’existent que comme membres d’objectif (js/battlefield/OperationObjectives.js:35-36).',
  etatAudit: 'Feuille Groupes : GRP-05 « À structurer », GRP-16 « À créer », GRP-28 « À créer ».' });
test('EFF-03/EFF-06 incluent couvoir GRP-05, extraction GRP-16 et civils GRP-28', { todo: missingTemplates.length ? `défaut: gabarits ${missingTemplates.join(', ')} jamais instanciés (js/data/BattleCatalog.js:284-318)` : false }, () => {
  assert.deepEqual(missingTemplates, []);
});

test('Croissance biologique : source enregistrée, durée explicite, aucun adulte ni œuf créé (gabarit dédié)', () => {
  // AFF-18 n'a pas de profil parasite ; la règle d'infestation existante est
  // exercée sur une configuration minimale explicite (hors EFF-03).
  const config = { id: 'rec-004-bio', mode: 'original', playerFaction: 'clan', context: { era: 'alternative', works: ['original'], continuities: ['original'] },
    factions: [{ id: 'clan', species: 'yautja' }, { id: 'colonists', species: 'human' }, { id: 'hive', species: 'xenomorph' }],
    relations: [{ a: 'clan', b: 'colonists', state: 'neutral' }, { a: 'clan', b: 'hive', state: 'hostile' }, { a: 'colonists', b: 'hive', state: 'hostile' }],
    fronts: [{ id: 'a', position: [0, 0], radius: 40, owner: 'clan' }, { id: 'b', position: [200, 0], radius: 40, owner: 'hive' }],
    routes: [{ id: 'ab', from: 'a', to: 'b', travelSeconds: 30 }],
    profiles: [{ id: 'hunter', species: 'yautja', maxHp: 300, damage: 0 }, { id: 'colonist', species: 'human', actorType: 'marine', maxHp: 120, damage: 0 },
      { id: 'parasite', species: 'xenomorph', actorType: 'facehugger', maxHp: 20, damage: 0 }],
    groups: [{ id: 'hunters', factionId: 'clan', frontId: 'a', position: [-30, 0], units: [{ id: 'h0', profileId: 'hunter', officer: true }] },
      { id: 'colony', factionId: 'colonists', frontId: 'a', position: [30, 0], units: [{ id: 'c0', profileId: 'colonist', position: [30, 0] }, { id: 'c1', profileId: 'colonist', position: [30, 2] }] },
      { id: 'brood', factionId: 'hive', frontId: 'a', position: [31, 0], units: [{ id: 'f0', profileId: 'parasite', position: [31, 0] }, { id: 'f1', profileId: 'parasite', position: [31, 2] }] }],
    budgets: { active: 8 }, ai: { enabled: false } };
  const events = [], sim = new BattleSimulation(config, { spawnGroup: () => true, announce: event => events.push(event) });
  sim.update(STEP, { players: [{ id: 'p1', hp: 100, position: [0, 0] }] });
  const before = { units: sim.units.size, counts: sim.getCounts() };
  const infection = sim.beginHostInfestation('f0', 'c0');
  for (let i = 0; i < 40; i++) sim.update(STEP, { players: [{ id: 'p1', hp: 100, position: [0, 0] }] });
  const completed = events.find(event => event.type === 'host_infection_completed');
  const ok = infection && sim.deaths.get('f0')?.cause === 'facehugger-implantation' && completed?.adultGenerated === false && completed.facehuggerId === 'f0' &&
    sim.units.size === before.units && sim.getCounts().hive.allocated === 2 && Math.abs(infection.completesAt - infection.startedAt - HOST_INFESTATION_RULES.incubationSeconds) < 1e-9;
  clause('C4', 'Toute croissance biologique ou arrivée extérieure possède une source enregistrée', ok && runs.eff03.ledger.violations.every(v => v[1] !== 'reserve_left_without_recorded_source') ? 'prouvé' : 'échec', {
    scenario: 'gabarit dédié rec-004-bio + EFF-03 (arrivées)', infection, incubationSecondes: HOST_INFESTATION_RULES.incubationSeconds,
    registreMort: [sim.deaths.get('f0'), sim.deaths.get('c0')], evenement: completed, unitesAvant: before.units, unitesApres: sim.units.size,
    arriveesEFF03: 'chaque passage reserve→distant est apparié à reinforcements_inbound puis reinforcements_arrived avec une source reinforcementSource (Ledger.tick)',
    limite: 'Aucun cycle œuf→parasite→adulte n’existe : la croissance se limite à la consommation finie d’identités déjà allouées.' });
  assert.ok(ok);
});

test('EFF-06 : aucune opération du catalogue ne peut sélectionner le budget EFF-06', () => {
  const attempts = BATTLE_OPERATIONS.map(operation => { try { getBattleOperationConfig(operation.id, { budgetId: 'EFF-06', allowHumanController: true }); return [operation.id, 'accepté']; } catch (error) { return [operation.id, error.message]; } });
  const accepted = attempts.filter(([, result]) => result === 'accepté');
  evidence.scenarios['EFF-06-catalogue'] = { tentatives: attempts.length, acceptees: accepted.map(([id]) => id), motif: attempts[0][1],
    constat: 'getBattleOperationConfig refuse EFF-06 (alliés 120 ≠ 48) : js/data/BattleCatalog.js:333 « selected budget changes the proposed finite force ». Le scénario EFF-06 est donc exécuté sur une configuration explicite aux chiffres EFF-06 (test suivant), pas sur une opération jouable.' };
  assert.equal(accepted.length, 0);
});

function eff06Config() {
  const budget = getBattleBudget('EFF-06');
  const fronts = [{ id: 'front_a', label: 'Poste de trêve', position: [0, 0], radius: 45, owner: 'player_clan', reinforcementSource: true, captureThreshold: 60 },
    { id: 'front_b', label: 'Dépôt', position: [300, 0], radius: 45, owner: 'hive', reinforcementSource: true, captureThreshold: 60 },
    { id: 'front_c', label: 'Ruche', position: [300, 300], radius: 45, owner: 'hive', reinforcementSource: true, captureThreshold: 60 }];
  const groups = []; let serial = 0;
  const add = (factionId, frontId, size, state, profile, officerProfile = profile) => {
    const front = fronts.find(f => f.id === frontId), id = `${factionId}:${serial++}`, center = [front.position[0] + (serial % 5) * 6 - 12, front.position[1] + Math.floor(serial / 5) % 5 * 6 - 12];
    groups.push({ id, factionId, frontId, state, position: center, units: Array.from({ length: size }, (_, i) => ({ id: `${id}:${i}`, profileId: i === 0 ? officerProfile : profile, officer: i === 0, position: [center[0] + i % 4, center[1] + Math.floor(i / 4)] })) });
  };
  // Alliés EFF-06 : 4 Yautja + 24 humains proches ; 8 Yautja + 60 humains distants ; 24 humains en réserve.
  add('player_clan', 'front_a', 4, 'distant', 'yautja', 'yautja_officer'); add('player_clan', 'front_b', 4, 'distant', 'yautja', 'yautja_officer'); add('player_clan', 'front_c', 4, 'distant', 'yautja', 'yautja_officer');
  for (let i = 0; i < 3; i++) add('human_allies', 'front_a', 8, 'distant', 'marine', 'marine_officer');
  for (let i = 0; i < 4; i++) add('human_allies', 'front_b', 8, 'distant', 'marine', 'marine_officer');
  for (let i = 0; i < 3; i++) add('human_allies', 'front_c', 8, 'distant', 'marine', 'marine_officer');
  add('human_allies', 'front_c', 4, 'distant', 'marine', 'marine_officer');
  for (let i = 0; i < 3; i++) add('human_allies', 'front_a', 8, 'reserve', 'marine', 'marine_officer');
  // Ennemis EFF-06 : 128 + 512 déployés, 360 en réserve.
  for (let i = 0; i < 16; i++) add('hive', 'front_a', 8, 'distant', 'warrior', 'warrior_lead');
  for (let i = 0; i < 32; i++) add('hive', 'front_b', 8, 'distant', 'warrior', 'warrior_lead');
  for (let i = 0; i < 32; i++) add('hive', 'front_c', 8, 'distant', 'warrior', 'warrior_lead');
  for (let i = 0; i < 45; i++) add('hive', i % 2 ? 'front_b' : 'front_c', 8, 'reserve', 'warrior', 'warrior_lead');
  return { budget, config: { id: 'rec-004-eff-06', label: 'EFF-06 — front humain sous trêve scénarisée (configuration de recette)', mode: 'original', playerFaction: 'player_clan',
    context: { era: 'operation_specific', works: ['original'], continuities: ['original'], allowAdaptations: true },
    factions: [{ id: 'player_clan', species: 'yautja', moraleModel: 'clan_cohesion' }, { id: 'human_allies', species: 'human', moraleModel: 'human_morale' }, { id: 'hive', species: 'xeno', moraleModel: 'hive_coordination' }],
    relations: [{ a: 'player_clan', b: 'human_allies', state: 'allied' }, { a: 'player_clan', b: 'hive', state: 'hostile' }, { a: 'human_allies', b: 'hive', state: 'hostile' }],
    fronts, routes: [{ id: 'ab', from: 'front_a', to: 'front_b', travelSeconds: 40 }, { id: 'bc', from: 'front_b', to: 'front_c', travelSeconds: 40 }, { id: 'ac', from: 'front_a', to: 'front_c', travelSeconds: 60, waypoints: [[0, 0], [0, 300], [300, 300]] }],
    profiles: [{ id: 'yautja', species: 'yautja', actorType: 'clan_hunter', maxHp: 300, damage: 18, attackInterval: 2 }, { id: 'yautja_officer', species: 'yautja', actorType: 'clan_hunter', role: 'officer', maxHp: 480, damage: 32, attackInterval: 2 },
      { id: 'marine', species: 'human', actorType: 'marine', maxHp: 160, damage: 18, attackInterval: 2.4 }, { id: 'marine_officer', species: 'human', actorType: 'marine', role: 'officer', maxHp: 480, damage: 32, attackInterval: 2.4 },
      { id: 'warrior', species: 'xenomorph', actorType: 'warrior', maxHp: 200, damage: 18, attackInterval: 2 }, { id: 'warrior_lead', species: 'xenomorph', actorType: 'warrior', role: 'officer', maxHp: 480, damage: 32, attackInterval: 2 }],
    groups, budgets: { active: 32, byFaction: { player_clan: { active: 4, reserve: 0, total: 12 }, human_allies: { active: 16, reserve: 24, total: 108 }, hive: { active: 16, reserve: 360, total: 1000 } }, spawnInterval: 8, arrivalsPerTick: 8, spawnDistance: 24, announcementSeconds: 3 },
    objectives: { externalVictory: true, loseFronts: ['front_a'], defeatGraceSeconds: 7200 }, ai: { interval: 20 } } };
}

test('EFF-06 (configuration explicite) : trêve, transport M577, retraites et réserves conservent chaque identité', () => {
  const { config, budget } = eff06Config();
  const ref = {}, bridge = liveBridge(ref); let ledger;
  const sim = ref.sim = new BattleSimulation(config, { spawnGroup: bridge.spawnGroup, despawnGroup: bridge.despawnGroup, announce: event => ledger?.observe(event) });
  ledger = new Ledger(sim, 'EFF-06');
  const counts0 = sim.getCounts();
  const allies = counts0.player_clan.allocated + counts0.human_allies.allocated;
  const player = { id: 'player1', hp: 100, position: [0, -60] };
  const script = [], at = (t, label, action) => script.push({ t, label, action });
  let apcGroup = null, retreatGroup = null;
  at(2, 'embarquement M577 d’une section humaine alliée déjà allouée', () => {
    const group = [...sim.groups.values()].find(g => g.factionId === 'human_allies' && g.frontId === 'front_a' && g.state === 'distant' && !g.materialized);
    apcGroup = group.id; return sim.boardAPC(group.id, { ownerFaction: 'human_allies', frontId: 'front_a', position: [...group.position] });
  });
  at(4, 'retraite d’une section humaine du front B', () => { retreatGroup = [...sim.groups.values()].find(g => g.factionId === 'human_allies' && g.frontId === 'front_b').id; return sim.issueOrder(retreatGroup, { type: 'retreat', frontId: 'front_a', issuer: 'player1' }); });
  at(6, 'le joueur rejoint le front A', () => { player.position = [0, 0]; return { position: player.position }; });
  at(120, 'débarquement du M577', () => { const m = sim.getAPCManifest(); return sim.disembarkAPC([...m.crew, ...m.passengers].map((unitId, i) => ({ unitId, position: [m.position[0] + 5 + (i % 4) * 2, m.position[1] + Math.floor(i / 4) * 2] }))); });
  at(300, 'révocation de la trêve (neutralité)', () => ({ changed: sim.setRelationship('player_clan', 'human_allies', 'neutral', 'truce_revoked') }));
  const DURATION = 600; let next = 0;
  for (let tick = 1; tick * STEP <= DURATION; tick++) {
    while (next < script.length && script[next].t <= sim.time + 1e-9) { const item = script[next++]; ledger.events.push({ type: 'test_script', time: sim.time, label: item.label, result: item.action() }); }
    sim.update(STEP, { players: [player] }); driveActors(sim, bridge, STEP);
    ledger.tick(); if (tick % 120 === 0 || Math.abs(sim.time - 60) < 1e-9) ledger.sample();
  }
  const reconciliation = ledger.reconciliation();
  const transport = ledger.timeline.find(row => Math.abs(row.t - 60) < 1e-9)?.parFaction.human_allies;
  runs.eff06 = { sim, ledger };
  evidence.scenarios['EFF-06'] = {
    configuration: 'rec-004-eff-06 (explicite, aux chiffres EFF-06 ; plafond détaillé projet 32)', configDigest: sim.digest, dureeSimulee: sim.time,
    budgetEFF06: { ennemi: budget.enemy, allie: budget.ally, note: budget.notes }, allouesAllies: allies,
    script: ledger.events.filter(event => event.type === 'test_script'), avant: ledger.initial, apres: ledger.counts(), rapprochement: reconciliation,
    transportA60s: transport, relations: [...sim.relations], registreHorodate: ledger.timeline,
    registreParGroupeFinal: { colonnes: ['groupe', 'faction', 'front', ...STATES, 'blesses'], lignes: ledger.perGroup() },
    transitionsIndividuelles: { colonnes: ['t', 'id', 'faction', 'groupe', 'avant', 'apres'], total: ledger.transitions.length, lignes: ledger.transitions },
    violations: ledger.violations, resultat: sim.getResult() };
  assert.equal(allies, budget.ally.total); assert.equal(counts0.hive.allocated, budget.enemy.total);
  assert.equal(counts0.human_allies.reserve + counts0.player_clan.reserve, budget.ally.reserve);
  assert.ok(transport?.aboardAPC > 0, 'passagers comptés une fois, dans leur état distant, pendant le transport');
  assert.deepEqual(ledger.violations, []);
  for (const row of Object.values(reconciliation)) assert.equal(row.equilibre, true);
  const single = ledger.violations.length === 0, noReturn = !ledger.violations.some(v => v[1] === 'terminal_state_left');
  clause('C1-EFF06', 'Chaque individu appartient à un seul état comptable (EFF-06, y compris passagers M577)', single ? 'prouvé' : 'échec', { scenario: 'EFF-06', passagersA60s: transport?.aboardAPC, groupeAPC: apcGroup });
  clause('C3b', 'Morts et retraites ne réapparaissent pas gratuitement (EFF-06)', noReturn ? 'prouvé' : 'échec', { scenario: 'EFF-06', groupeEnRetraite: retreatGroup, morts: sim.deaths.size,
    reconstitutions: ledger.events.filter(event => event.type === 'group_reconstituted').map(event => ({ t: event.time, groupId: event.groupId, newUnitsCreated: event.newUnitsCreated })) });
  clause('C5', 'Rapprochement initial + entrées = états finaux + pertes + sorties (EFF-03 puis EFF-06)', Object.values(reconciliation).every(row => row.equilibre) && Object.values(evidence.scenarios['EFF-03'].rapprochement).every(row => row.equilibre) ? 'prouvé' : 'échec',
    { EFF03: evidence.scenarios['EFF-03'].rapprochement, EFF06: reconciliation });
  clause('C6', 'Trêve EFF-06 révocable, sans alliance automatique avec la ruche', sim.relationship('player_clan', 'human_allies') === 'neutral' && sim.areHostile('hive', 'human_allies') && sim.areHostile('hive', 'player_clan') ? 'prouvé' : 'échec',
    { relations: [...sim.relations], evenement: ledger.events.find(event => event.type === 'relations_changed') });
  assert.equal(sim.relationship('player_clan', 'human_allies'), 'neutral');
  assert.equal(sim.assertConservation(), true);
});

test('Non automatisable : preuve vidéo et contrôle visuel des catégories', () => {
  clause('NA1', 'Lisibilité visuelle des catégories (civil, blessé, œuf, matériel) à l’écran', 'non automatisable', { raison: 'Rendu Three.js et lecture humaine des silhouettes/HUD requis ; aucun rendu WebGL dans node:test.' });
  assert.ok(true);
});
