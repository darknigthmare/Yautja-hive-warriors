import test from 'node:test';
import assert from 'node:assert/strict';
import { BattleCampaignRecord, CLAN_CAMPAIGN_ARC_ID as arcId } from '../js/battlefield/BattleCampaignRecord.js';
import { BattleSimulation } from '../js/battlefield/BattleSimulation.js';
import { OperationObjectives } from '../js/battlefield/OperationObjectives.js';
import { getBattleOperationConfig } from '../js/data/BattleCatalog.js';
import { buildClanServiceEvidence, getClanRecognition } from '../js/battlefield/ClanRecognition.js';

function operation(id) {
  const config = getBattleOperationConfig(id), sim = new BattleSimulation(config), objectives = new OperationObjectives(config, sim), player = { id: 'player1', hp: 1000, position: [0, 0] };
  const tick = seconds => { for (let remaining = seconds; remaining > 0; remaining -= .25) objectives.update(Math.min(.25, remaining), [player]); };
  function use(id) { const task = objectives.getHUDState().tasks.find(task => task.id === id); player.position = [...task.position]; objectives.update(.01, [player]); const answer = objectives.interact(player); assert.equal(answer.accepted, true, answer.feedback); tick(task.duration); }
  return { config, sim, objectives, player, tick, use };
}

test('real recovered evidence earns an original mission commendation; kill counts never promote canonical rank or give stats', () => {
  const current = operation('AFF-01'), book = new BattleCampaignRecord();
  current.sim.captureBase(current.config.operationObjectives.tasks.find(task => task.id === 'depart').frontId, current.config.playerFaction);
  current.use('register'); current.use('depart');
  assert.equal(current.sim.getResult().outcome, 'victory');
  const before = current.sim.getCounts();
  const outcome = book.recordOutcome(current.config, current.sim, { ...current.sim.getResult(), kills: 10000 }, { arcId, runId: 'archives-actual', characterId: 'jungle_hunter', narrative: current.objectives });
  assert.equal(outcome.receipt.serviceEvidence.narrativeVerified, true); assert.deepEqual(outcome.receipt.serviceEvidence.extractedCargo, ['register']);
  const social = book.getDebrief().social;
  assert.equal(social.completedMissions, 1); assert.ok(social.commendations.some(item => item.id === 'evidence_recovered'));
  assert.equal(social.narrativeRankChanged, false); assert.equal(social.statBonuses, null); assert.equal(social.honorWalletDelta, 0); assert.equal(social.trophiesGranted, 0);
  assert.deepEqual(current.sim.getCounts(), before); assert.equal(current.sim.assertConservation(), true);
  book.recordOutcome(current.config, current.sim, current.sim.getResult(), { arcId, runId: 'archives-actual', characterId: 'jungle_hunter', narrative: current.objectives });
  assert.deepEqual(book.getDebrief().social, social);
});

test('a fake task list cannot mint defence, rescue, archive or diplomatic recognition', () => {
  const current = operation('AFF-01'); current.sim.finishOperation({ outcome: 'victory', reason: 'external-confirmed' });
  const proof = buildClanServiceEvidence(current.config, current.sim, current.sim.getResult(), { tasks: [{ type: 'defend', status: 'done', id: 'forged', frontId: 'front_a' }], noncombatants: { evacuated: 9000 } });
  assert.equal(proof.narrativeVerified, false); assert.deepEqual(proof.taskIds, []); assert.deepEqual(proof.rescuedIndividualIds, []);
  const social = getClanRecognition([{ runId: 'only-confirmed-mission', characterId: 'city_hunter', serviceEvidence: proof }]);
  assert.deepEqual(social.commendations.map(item => item.id), ['mission_service']); assert.equal(social.prestige, 2);
  assert.equal(getClanRecognition([{ serviceEvidence: { ...proof, completedMission: false } }]).prestige, 0);
});

test('character briefings and debriefs react to the selected hunter, real local agreement and persistent named consequences', () => {
  const values = new Map(), storage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) };
  const book = new BattleCampaignRecord({ storage }), first = operation('AFF-01');
  const named = [...first.sim.units.values()].find(unit => unit.uniqueId === 'BOS-26'); first.sim.recordDeath({ entityId: named.id }); book.observe(first.config, first.sim, { arcId, runId: 'named-consequence' });
  const second = operation('AFF-04'); second.use('evidence'); second.use('false_alarm'); second.use('agreement');
  book.recordOutcome(second.config, second.sim, second.sim.getResult(), { arcId, runId: 'local-agreement', characterId: 'city_hunter', narrative: second.objectives });
  const loaded = new BattleCampaignRecord({ storage }), next = getBattleOperationConfig('AFF-03');
  const briefing = loaded.getCharacterBriefing(next, { arcId, characterId: 'city_hunter' });
  assert.equal(briefing.continuityEnabled, true); assert.equal(briefing.characterId, 'city_hunter');
  assert.equal(briefing.relevantNamedConsequences[0].state, 'dead'); assert.equal(briefing.recognition.completedMissions, 1);
  assert.ok(briefing.recognition.commendations.some(item => item.id === 'local_agreement'));
  assert.equal(loaded.getCharacterBriefing(next, { arcId, characterId: 'jungle_hunter' }).recognition.completedMissions, 0);
  assert.equal(loaded.getCharacterBriefing(next, { characterId: 'city_hunter' }).continuityEnabled, false);
  assert.equal(loaded.getDebrief().characterRecognition.length, 1); assert.equal(loaded.getDebrief().characterRecognition[0].narrativeRankChanged, false);
});
