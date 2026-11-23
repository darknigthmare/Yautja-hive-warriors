import * as THREE from 'three';
import { eraSupportFor } from '../data/EraSupport.js';

const KNOWN_MAPS = new Set(['gunnison_forest','xenomorph_prime','antarctic_pyramid','la_rooftops','val_verde_jungle','romulus_station','charon_rogue_base','game_preserve_planet','stargazer_facility','prey_comanche_territory','killer_of_killers_arena','lv223_engineer_structures','hadleys_hope_colony','fiorina_161_foundry','nostromo_refinery','usm_auriga_labs','sevastopol_station','gateway_station_labs']);
const FUTURE_MAPS = new Set(['xenomorph_prime','romulus_station','charon_rogue_base','hadleys_hope_colony']);
const OUTDOOR_MAPS = new Set(['gunnison_forest','la_rooftops','val_verde_jungle','game_preserve_planet','stargazer_facility','prey_comanche_territory']);

// Old saves predate selectable layouts/difficulty. Their world was seed zero
// and standard, regardless of the settings currently shown in the menu.
export function operationSceneOptions(saved, current = {}) {
  const scene = saved ? saved.scene ?? {} : current;
  return { mapSeed: scene.mapSeed ?? 0, difficultyId: scene.difficultyId ?? 'standard' };
}

export function createMissionSupportContext({ missionId, levelId, fidelityMode, factionId = 'player_clan', environment, onDestroyed, eraRules = true }) {
  const allowed = KNOWN_MAPS.has(levelId) && (fidelityMode === 'adapted' || fidelityMode === 'faithful' && FUTURE_MAPS.has(levelId));
  // Human support follows the location's era in every mode (EraSupport); the Yautja orbital keeps `allowed`.
  // Catalogue operations own their rosters (eraRules false): they keep the mission-wide flag and the Cheyenne.
  const era = eraRules ? eraSupportFor(levelId) : null;
  const allowedKinds = era ? { apc: allowed && era.ground === 'apc', cheyenne: allowed && Boolean(era.air) } : undefined;
  return { missionId, allowed, allowedKinds, airProfile: era?.air ?? null, factionId, onDestroyed,
    canFireAt: (from, to) => typeof environment?.hasLineOfSight === 'function' && environment.hasLineOfSight(from, to, { ignoreOwner: 'apc' }) === true,
    canAccessAir: target => {
      if (!allowed || !OUTDOOR_MAPS.has(levelId) || !target?.isVector3 || ![target.x,target.y,target.z].every(Number.isFinite) || typeof environment?.traceSegment !== 'function') return false;
      const from = target.clone().add(new THREE.Vector3(0,.3,0));
      return !environment.traceSegment(from, from.clone().add(new THREE.Vector3(0,180,0)), { radius: .5, ignoreOwner: 'apc' });
    }
  };
}
