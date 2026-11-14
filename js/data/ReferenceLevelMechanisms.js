/* Content inherited from v67, selected by work/era instead of placing every
 * Alien/USCM/Engineer interaction in every historical Predator location.
 * These sets preserve implementations, not a certificate of screen accuracy. */
import { buildReferenceContacts, buildReferenceInterest } from '../graphics/ReferenceWorldContacts.js';
import { batchReferenceLandmarks } from '../graphics/ReferenceLandmarkBatching.js';

const PROFILE_DEFINITIONS = {
  gunnison_forest: ['buildCrashedScoutShipProps', 'buildGunnisonForestExpansionProps'],
  xenomorph_prime: ['buildHiveWorldExpansionProps', 'buildBiomechanicalWallResin', 'buildEggNurseries', 'buildChrysalisCocoons', 'buildQueenOvipositor', 'buildResinWebbings', 'buildAcidTrenches', 'buildPressurizedAcidGeysers'],
  antarctic_pyramid: ['buildModularPyramidWalls', 'buildPyramidSacrificialProps', 'buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildSubterraneanVents'],
  la_rooftops: ['buildLARooftopExpansionProps', 'buildIndustrialCatwalks', 'buildElectricalTransformers'],
  val_verde_jungle: ['buildValVerdeProps', 'buildValVerdeMasterExpansionProps'],
  romulus_station: ['buildRomulusCryoProps', 'buildRomulusStationExpansionProps', 'buildIndustrialCatwalks', 'buildElectricalTransformers', 'buildHydraulicBlastDoors', 'buildCryoMedBays', 'buildCargoCrane', 'buildDecompressionAirlock', 'buildSteamConduits', 'buildCryoSpecimenTubes', 'buildSpecimenStasisTanks', 'buildPlasmaRechargeTerminals', 'buildDecontaminationAirlock', 'buildSubterraneanVents'],
  charon_rogue_base: ['buildCharonGeneticsLabProps', 'buildCharonBaseExpansionProps', 'buildIndustrialCatwalks', 'buildElectricalTransformers', 'buildUSCMSupplyCaches', 'buildHydraulicBlastDoors', 'buildCryoMedBays', 'buildCargoCrane', 'buildSteamConduits', 'buildCryoSpecimenTubes', 'buildPowerLoader', 'buildDrivableAPC', 'buildReactorMeltdownConsole', 'buildElectricFloorGrids', 'buildMountedSmartgun', 'buildFuelLines', 'buildCargoCraneConsole', 'buildCryoStasisSector', 'buildHydraulicCargoLift', 'buildSpecimenStasisTanks', 'buildExplosiveBarrels', 'buildPlasmaRechargeTerminals', 'buildFixedSentryEmplacements', 'buildAmmoniaCoolantPipes', 'buildCollapsibleFloorGrates', 'buildTacticalCoverObstacles'],
  game_preserve_planet: ['buildGamePreserveProps', 'buildGamePreserveExpansionProps'],
  stargazer_facility: ['buildStargazerLabProps', 'buildStargazerFacilityExpansionProps'],
  prey_comanche_territory: ['buildPreyComancheProps', 'buildPreyTerritoryExpansionProps'],
  killer_of_killers_arena: ['buildKillerOfKillersProps', 'buildKillerOfKillersExpansionProps']
};

export const REFERENCE_LEVEL_MECHANISMS = Object.freeze(Object.fromEntries(
  Object.entries(PROFILE_DEFINITIONS).map(([id, builders]) => [id, Object.freeze({ id,
    builders: Object.freeze(builders), fidelity: 'source-inspired gameplay adaptation',
    geography: 'original connected-sector layout in game units',
    replacedGenericGeometry: Object.freeze(['small enclosed arena', 'untextured generic vegetation/props']),
  })])
));

const MAP_BUILDERS = {
  'LD-11': ['buildIndustrialCatwalks', 'buildElectricalTransformers', 'buildHydraulicBlastDoors', 'buildSteamConduits', 'buildReactorMeltdownConsole', 'buildCargoCrane', 'buildTacticalCoverObstacles'],
  'LD-12': ['buildShrineOfTheAncients', 'buildModularPyramidWalls'],
  'LD-13': ['buildBiomechanicalWallResin', 'buildEggNurseries', 'buildResinWebbings', 'buildAcidTrenches'],
  'LD-14': ['buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildCargoCrane'],
  'LD-15': [], 'LD-16': [], 'LD-17': [],
  'LD-18': ['buildTacticalCoverObstacles', 'buildCargoCrane'],
  'LD-19': ['buildIndustrialCatwalks', 'buildElectricalTransformers', 'buildSteamConduits', 'buildFuelLines'],
  'LD-20': ['buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildCargoCrane', 'buildDecompressionAirlock'],
  'LD-21': ['buildCryoMedBays', 'buildTacticalCoverObstacles', 'buildElectricalTransformers'],
  'LD-22': ['buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildSteamConduits', 'buildSubterraneanVents'],
  'LD-23': ['buildIndustrialCatwalks', 'buildUSCMSupplyCaches', 'buildMountedSmartgun', 'buildElectricalTransformers', 'buildTacticalCoverObstacles'],
  'LD-24': ['buildModularPyramidWalls', 'buildIndustrialCatwalks'],
  'LD-25': ['buildIndustrialCatwalks', 'buildEngineerCityRuins', 'buildElectricalTransformers'],
  'LD-26': ['buildTacticalCoverObstacles', 'buildElectricalTransformers'],
  'LD-27': ['buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildSubterraneanVents'],
  'LD-28': ['buildIndustrialCatwalks', 'buildHydraulicBlastDoors', 'buildDecontaminationAirlock'],
  'LD-29': ['buildIndustrialCatwalks', 'buildElectricalTransformers', 'buildTacticalCoverObstacles'],
  'LD-30': [], 'LD-31': [], 'LD-32': [], 'LD-33': [],
  'LD-34': ['buildBiomechanicalWallResin', 'buildEggNurseries', 'buildAcidTrenches']
};

export function referenceLevelProfile(id, mapId = null) {
  if (MAP_BUILDERS[mapId]) return Object.freeze({ id: mapId, builders: MAP_BUILDERS[mapId],
    fidelity: 'original interpreted variant; generic compatible assets, no borrowed named scene' });
  return REFERENCE_LEVEL_MECHANISMS[id] ?? null;
}

export function buildReferenceLevelMechanisms(environment, level) {
  const profile = referenceLevelProfile(level.id, level.mapId ?? level.auditMapId);
  const built = [];
  for (const name of profile?.builders ?? []) {
    if (typeof environment[name] !== 'function') throw new Error(`Missing reference mechanism ${name}`);
    if (name === 'buildModularPyramidWalls') environment[name](environment.wallMat);
    else if (name === 'buildIndustrialCatwalks') environment[name](level.environmentType === 'temple');
    else if (name === 'buildElectricalTransformers') environment[name](4);
    else if (name === 'buildUSCMSupplyCaches' || name === 'buildCryoMedBays') environment[name](2);
    else if (name === 'buildSteamConduits') environment[name](6);
    else environment[name]();
    built.push(name);
  }
  environment.referenceRoot.updateMatrixWorld(true);
  if (environment.sariiCompanion?.group) {
    environment.root.attach(environment.sariiCompanion.group);
    environment.trackReferenceObject(environment.sariiCompanion.group);
  }
  const contactCount = buildReferenceContacts(environment);
  const interestCells = buildReferenceInterest(environment);
  const batching = batchReferenceLandmarks(environment);
  environment.referenceRoot.userData.referenceContent = { id: level.id,
    sourceCommit: '9c18c19', contactCount, interestCells, mode: level.operationMode ?? 'adaptation', built, ...batching };
  return environment.referenceRoot.userData.referenceContent;
}
