import * as THREE from 'three';

const KNOWN_MAPS = new Set(['gunnison_forest','xenomorph_prime','antarctic_pyramid','la_rooftops','val_verde_jungle','romulus_station','charon_rogue_base','game_preserve_planet','stargazer_facility','prey_comanche_territory','killer_of_killers_arena']);
const FUTURE_MAPS = new Set(['xenomorph_prime','romulus_station','charon_rogue_base']);
const OUTDOOR_MAPS = new Set(['gunnison_forest','la_rooftops','val_verde_jungle','game_preserve_planet','stargazer_facility','prey_comanche_territory']);

// Old saves predate selectable layouts/difficulty. Their world was seed zero
// and standard, regardless of the settings currently shown in the menu.
export function operationSceneOptions(saved, current = {}) {
  const scene = saved ? saved.scene ?? {} : current;
  return { mapSeed: scene.mapSeed ?? 0, difficultyId: scene.difficultyId ?? 'standard' };
}

export function createMissionSupportContext({ missionId, levelId, fidelityMode, factionId = 'player_clan', environment, onDestroyed }) {
  const allowed = KNOWN_MAPS.has(levelId) && (fidelityMode === 'adapted' || fidelityMode === 'faithful' && FUTURE_MAPS.has(levelId));
  return { missionId, allowed, factionId, onDestroyed,
    canFireAt: (from, to) => typeof environment?.hasLineOfSight === 'function' && environment.hasLineOfSight(from, to, { ignoreOwner: 'apc' }) === true,
    canAccessAir: target => {
      if (!allowed || !OUTDOOR_MAPS.has(levelId) || !target?.isVector3 || ![target.x,target.y,target.z].every(Number.isFinite) || typeof environment?.traceSegment !== 'function') return false;
      const from = target.clone().add(new THREE.Vector3(0,.3,0));
      return !environment.traceSegment(from, from.clone().add(new THREE.Vector3(0,180,0)), { radius: .5, ignoreOwner: 'apc' });
    }
  };
}
