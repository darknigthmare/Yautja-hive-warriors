/* Prevent source-only biological castes from silently appearing on
 * unrelated Alien/Predator media or through a fake profile name. No
 * default campaign budgets, digests or unit IDs are altered here. */
export const EXTINCTION_CASTE_PROFILES = Object.freeze({
  carrier: Object.freeze({ profileId:'XEN-009', origin:'Aliens versus Predator: Extinction',
    cargoCapacity:6, upgradeCapacity:12, visualFidelity1to1Verified:false }),
  ravager: Object.freeze({ profileId:'XEN-010', origin:'Aliens versus Predator: Extinction',
    upgradedCatalepsisImplemented:false, visualFidelity1to1Verified:false })
});
export function validExtinctionCasteUnit(unit, operationId) {
  const spec=EXTINCTION_CASTE_PROFILES[unit?.actorType];
  return !!spec && operationId==='AFF-27' &&
    unit.profileId===spec.profileId && unit.species==='xeno' &&
    typeof unit.id==='string' && unit.id.length>0;
}
export function allowsDetailedXenomorphProfile(profile,operationId) {
  const spec=EXTINCTION_CASTE_PROFILES[profile?.actorType];
  return !spec||operationId==='AFF-27'&&profile.id===spec.profileId&&
    profile.species==='xeno';
}
