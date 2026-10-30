/* Runtime presentation for pre-allocated Extinction squads.
 * The strategic actorType/profileId/digest are intentionally unchanged:
 * visual upgrades must not invalidate source-v1 checkpoints. */
const MARINE_VISUALS = Object.freeze({
  'H-LIGNE': Object.freeze({ 5: 'medic', 6: 'commtech' }),
  'H-APPUI': Object.freeze({ 2: 'sniper', 3: 'sadar', 4: 'exosuit', 5: 'medic', 6: 'commtech' })
});
export const SOURCE_PRESENTATION_STATUS = Object.freeze({
  drone: 'procedural_distinct_unverified',
  medic: 'procedural_specialist_unverified',
  commtech: 'procedural_specialist_unverified',
  sniper: 'procedural_specialist_unverified',
  sadar: 'procedural_launcher_unverified',
  exosuit: 'procedural_pilot_frame_unverified'
});
export function sourceUnitVisualKind(unit) {
  if (!unit || typeof unit.profileId !== 'string' || typeof unit.actorType !== 'string') return null;
  if (unit.species === 'xenomorph' && unit.actorType === 'warrior') {
    // LV-742: index 6 of GRP-58, indices 4-5 of GRP-59.
    if (/_GRP-58_default_6$/.test(unit.profileId) ||
        /_GRP-59_(?:garde|C-QUEEN|default)_[45]$/.test(unit.profileId)) return 'drone';
  }
  if (unit.species === 'human' && unit.actorType === 'marine') {
    const match = /_GRP-60_(H-LIGNE|H-APPUI)_([0-7])$/.exec(unit.profileId);
    if (match) return MARINE_VISUALS[match[1]][Number(match[2])] ?? null;
  }
  return null;
}
