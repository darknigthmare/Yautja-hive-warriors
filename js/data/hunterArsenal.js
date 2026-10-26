/* Reference-scoped kits. They restrict equipment; game statistics and moves
 * remain adaptations, and a licensed photograph is not a film-prop scan. */
const freeze = value => { for (const item of Object.values(value)) if (item && typeof item === 'object') freeze(item); return Object.freeze(value); };

export const HUNTER_WEAPON_PROFILES = freeze({
  wristblades: { damage: 1, reach: 3.8, timing: 1 },
  combistick: { damage: 1.05, reach: 5.4, timing: 1.15 },
  katana: { damage: 1.15, reach: 4.2, timing: .9 },
  alpha_sickle: { damage: 1.2, reach: 4.4, timing: 1.1 },
  viking_axe: { damage: 1.4, reach: 4.5, timing: 1.5 },
  smart_disc: { damage: 1.1, reach: 4.8, timing: 1, projectileDamage: 340, projectileRange: 32, cooldown: 3.2 },
  shuriken: { damage: 1.05, reach: 4.2, timing: .85, projectileDamage: 550, projectileRange: 32, cooldown: 4 },
  compound_bow: { damage: .9, reach: 4.6, timing: 1, projectileDamage: 520, projectileRange: 136.4, cooldown: 4.2 },
  plasma_whip: { damage: 1.1, reach: 5.8, timing: 1.2 },
  crossbow: { damage: .85, reach: 3.5, timing: 1.1, cooldown: .8 }
});
const PHG = 'https://predator.illfonic.com/the-predator/';
const profile = (continuity, weapons, gadgets, ranged, sourceUrls, defaults) => ({ continuity, weapons, gadgets, ranged, sourceUrls, defaults,
  evidence: 'licensed visual reference or documented game equipment; not an exhaustive scene inventory', fidelity1to1Verified: false });
export const HUNTER_ARSENAL_PROFILES = freeze({
  jungle_hunter: profile('Predator (1987)', ['wristblades', 'plasma_caster', 'audio_lure'], ['medicomp', 'nuke'], 'plasma_caster',
    ['https://store.necaonline.com/products/predator-ultimate-jungle-hunter-7-scale-action-figure'], { primary: 'wristblades', secondary: 'wristblades', gadgets: ['medicomp', 'nuke'] }),
  city_hunter: profile('Predator 2 — Los Angeles 1997', ['wristblades', 'combistick', 'smart_disc', 'netgun', 'plasma_caster'], ['medicomp', 'nuke'], 'plasma_caster',
    ['https://store.necaonline.com/blogs/news/shipping-this-week-predator-2-ultimate-city-hunter-action-figure'], { primary: 'combistick', secondary: 'smart_disc', gadgets: ['medicomp', 'nuke'] }),
  wolf_predator: profile('AVP: Requiem (2007)', ['wristblades', 'combistick', 'shuriken', 'plasma_whip', 'plasma_caster', 'dual_caster', 'plasma_pistol'], ['medicomp', 'acid_solvent', 'mines'], 'dual_caster',
    ['https://www.prime1studio.com/avpr-wolf-predator/REMAVP-01DXS.html'], { primary: 'wristblades', secondary: 'plasma_whip', gadgets: ['medicomp', 'acid_solvent'] }),
  feral_predator: profile('Prey — Northern Great Plains 1719', ['wristblades', 'combistick', 'crossbow', 'feral_shield'], ['medicomp', 'feral_shield'], 'crossbow',
    ['https://www.prime1studio.com/fp-feral-predator/MMPR-07DXS.html', 'https://store.necaonline.com/collections/pre-orders/products/prey-ultramate-feral-predator-7-inch-scale-action-figure'], { primary: 'wristblades', secondary: 'crossbow', gadgets: ['medicomp', 'feral_shield'] }),
  alpha_predator: profile('Predator: Hunting Grounds — game adaptation', ['wristblades', 'alpha_sickle', 'compound_bow', 'plasma_caster', 'smart_disc', 'combistick'], ['medicomp', 'bear_trap', 'mines'], 'plasma_caster', [PHG], { primary: 'alpha_sickle', secondary: 'compound_bow', gadgets: ['medicomp', 'bear_trap'] }),
  samurai_predator: profile('Predator: Hunting Grounds — game adaptation', ['wristblades', 'katana', 'smart_disc', 'combistick', 'plasma_caster'], ['medicomp', 'bear_trap', 'mines'], 'plasma_caster', [PHG], { primary: 'katana', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'] }),
  viking_predator: profile('Predator: Hunting Grounds — game adaptation', ['wristblades', 'viking_axe', 'smart_disc', 'combistick', 'plasma_caster'], ['medicomp', 'bear_trap', 'mines'], 'plasma_caster', [PHG], { primary: 'viking_axe', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'] })
});
export const ADAPTED_GADGETS = Object.freeze(['medicomp', 'bear_trap', 'acid_solvent', 'nuke', 'mines', 'feral_shield']);
export function resolveHunterLoadout(characterId, configuration = {}) {
  const config = configuration && typeof configuration === 'object' ? configuration : {};
  const fidelityMode = config.fidelityMode === 'faithful' ? 'faithful' : 'adapted';
  const reference = HUNTER_ARSENAL_PROFILES[characterId] ?? null;
  const strict = fidelityMode === 'faithful', allowed = strict ? reference?.weapons ?? ['wristblades'] : Object.keys(HUNTER_WEAPON_PROFILES);
  const defaults = strict ? reference?.defaults ?? { primary: 'wristblades', secondary: 'wristblades', gadgets: [] } : { primary: 'wristblades', secondary: 'smart_disc', gadgets: ['medicomp', 'bear_trap'] };
  const choose = (value, fallback) => Object.hasOwn(HUNTER_WEAPON_PROFILES, value) && allowed.includes(value) ? value : fallback;
  const permittedGadgets = strict ? reference?.gadgets ?? [] : ADAPTED_GADGETS;
  const requested = Array.isArray(config.gadgets) ? config.gadgets : defaults.gadgets;
  return { fidelityMode, primary: choose(config.primary, defaults.primary), secondary: choose(config.secondary, defaults.secondary),
    gadgets: [...new Set(requested.filter(id => permittedGadgets.includes(id)))].slice(0, 2),
    ranged: strict ? reference?.ranged ?? null : 'plasma_caster', referenceKnown: reference !== null };
}

// All additions remain callable in the explicit adapted kit; reference kits
// reject undocumented technologies before consuming resources or creating FX.
export const HUNTER_ACTION_EQUIPMENT = freeze({
  triggerNukeSelfDestruct: 'nuke', triggerHybridMetamorphosis: 'hybrid_mutation', consumeRoyalJelly: 'royal_jelly',
  throwCombiStick: 'combistick', throwShuriken: 'shuriken', throwSmartDisc: 'smart_disc', fireNetgun: 'netgun',
  fireFlechetteNeedler: 'speargun', triggerFlechetteVolley: 'crossbow', fireCompoundBow: 'compound_bow',
  triggerSpineWhipSlash: 'plasma_whip', triggerPowerGloveSlam: 'power_glove', triggerGauntletEMP: 'emp_mine',
  triggerPlasmaGlaive: 'glaive', performIaijutsuSlash: 'katana', deployAntiGravDisruptor: 'anti_grav',
  fireTraxNetDart: 'trax_dart', toggleWhirlShield: 'glaive', deployTripwireMine: 'mines',
  startSmartDiscRemoteGuidance: 'smart_disc', togglePlasmaFlamer: 'plasma_flamer', firePlasmaFlamer: 'plasma_flamer',
  firePlasmaPistol: 'plasma_pistol', activateCyberExosuit: 'cyber_exosuit', throwNeurotoxinCanister: 'neurotoxin',
  togglePlasmaScythe: 'plasma_scythe', performPlasmaScytheSlash: 'plasma_scythe', fireM41AGrenade: 'm41a',
  triggerScoutShipBeam: 'scout_beam', fireM77GaussRifle: 'm77_gauss', performMaulEarthshaker: 'tri_maul',
  deploySonicTrapMine: 'sonic_mine', fireSeegsonBoltGun: 'seegson_bolt', callInfiltrationDropshipBombing: 'dropship_bombing',
  fireDualPlasmaOverchargeBeam: 'dual_caster', performCombistickPoleVault: 'combistick', performCombistickCycloneWhirl: 'combistick',
  performSmartDiscMultiLock: 'smart_disc', fireBurnerHeavyPlasma: 'burner_rifle', toggleSniperPlasmaMode: 'plasma_caster', fireSniperPlasmaLance: 'plasma_caster'
});
