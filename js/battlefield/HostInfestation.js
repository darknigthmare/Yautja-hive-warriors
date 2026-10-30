/* The Extinction-style host / Facehugger contract for already allocated
 * battle identities. No new xenomorphs, eggs or actors are minted by this module.
 * Full caste/host reproduction is a separate, source-scoped system. */
import { sourceUnitVisualKind } from '../data/SourceActorPresentation.js';

export const HOST_INFESTATION_RULES = Object.freeze({
  captureDistance: 5, incubationSeconds: 8,
  immuneActorTypes: Object.freeze(['synthetic','weyland_combat','working_joe','flametrooper']),
});

const distance=(a,b)=>Math.hypot(a[0]-b[0],a[1]-b[1]);
const finite=(p)=>Array.isArray(p)&&p.length===2&&p.every(Number.isFinite);
const alive=u=>u&&u.hp>0&&['active','distant'].includes(u.state);
const fail=()=>{throw new RangeError('invalid saved host infestation');};

export function canInfestHost(sim, source, host) {
  if (!sim || sim.disposed || sim.paused || sim.result ||
      !alive(source) || !alive(host) || source.state!=='active' || host.state!=='active' ||
      source.species!=='xenomorph' || source.actorType!=='facehugger' ||
      host.species!=='human' || source.factionId===host.factionId ||
      !sim.areHostile(source.factionId,host.factionId) ||
      host.incapacitated || host.infection ||
      HOST_INFESTATION_RULES.immuneActorTypes.includes(host.actorType) ||
      sourceUnitVisualKind(host)==='exosuit' ||
      !finite(source.position) || !finite(host.position) ||
      distance(source.position,host.position)>HOST_INFESTATION_RULES.captureDistance) return false;
  return true;
}

export function infectHost(sim, facehuggerId, hostId) {
  const parasite=sim?.units?.get(facehuggerId), host=sim?.units?.get(hostId);
  if (!canInfestHost(sim,parasite,host)) return null;
  const previous=host.incapacitated;
  const infection={ sourceUnitId:parasite.id, sourceFaction:parasite.factionId,
    startedAt:sim.time, completesAt:sim.time+HOST_INFESTATION_RULES.incubationSeconds };
  host.infection=infection;host.incapacitated=true;
  if (!sim.recordDeath({entityId:parasite.id,killerFaction:null,
    cause:'facehugger-implantation'})) {
    delete host.infection; host.incapacitated=previous; return null;
  }
  sim._emit('host_infection_started',{hostId:host.id,
    facehuggerId:parasite.id, completesAt:infection.completesAt},2);
  return {...infection};
}

export function completeHostInfections(sim) {
  if (!sim || sim.disposed || sim.result) return 0;
  let completed=0;
  for(const host of sim.units.values()) {
    const infection=host.infection;
    if (!infection || !alive(host) || infection.completesAt>sim.time) continue;
    delete host.infection;
    if (sim.recordDeath({entityId:host.id,killerFaction:infection.sourceFaction,
      cause:'facehugger-incubation'})) {
      completed++;
      sim._emit('host_infection_completed',{hostId:host.id,
        facehuggerId:infection.sourceUnitId,adultGenerated:false},2);
    }
  }
  return completed;
}

export function validateHostInfestation(unit, originals, allSavedUnits, savedTime, deathLedger = []) {
  const infection=unit?.infection;
  if (infection===undefined) return;
  const original=originals.get(unit.id);
  const parasite=allSavedUnits.get(infection?.sourceUnitId);
  const originalParasite=originals.get(infection?.sourceUnitId);
  const consumption=Array.isArray(deathLedger)
    ? deathLedger.find(death=>death.entityId===infection?.sourceUnitId)
    : null;
  if (!infection || !original || !parasite || !originalParasite ||
      original.species!=='human' ||
      originalParasite.species!=='xenomorph' || originalParasite.actorType!=='facehugger' ||
      infection.sourceFaction!==originalParasite.factionId ||
      original.factionId===originalParasite.factionId ||
      !consumption || consumption.cause!=='facehugger-implantation' ||
      consumption.killerFaction!==null ||
      consumption.time!==infection.startedAt ||
      parasite.state!=='dead' ||
      !['active','distant'].includes(unit.state) || unit.incapacitated!==true || !(unit.hp>0) ||
      HOST_INFESTATION_RULES.immuneActorTypes.includes(original.actorType) ||
      sourceUnitVisualKind(original)==='exosuit' ||
      !Number.isFinite(infection.startedAt)||infection.startedAt<0||infection.startedAt>savedTime ||
      !Number.isFinite(infection.completesAt)||infection.completesAt<savedTime||
      Math.abs(infection.completesAt-infection.startedAt-HOST_INFESTATION_RULES.incubationSeconds)>1e-7) fail();
}
