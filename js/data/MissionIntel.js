/* Mission intel (spec 003, US3, author decision of 15 Nov 2026): who speaks depends on the mode.
 * Free hunt and campaign: the clan Elder. Ascension: Kaedh, with Saar for logistics. Fronts: an
 * intercepted radio of the human faction actually present in the operation, decoded by the
 * bio-mask; the Elder closes. Every line is built from the mission's real data (level, sectors,
 * first objective, boss, factions); nothing announces what the mission will not contain. */

export const BOSS_LABELS = Object.freeze({
  xenomorph_queen: 'la Reine xénomorphe', praetorian: 'un Prétorien', predalien: 'le Predalien', predalien_queen: 'le Predalien de la meute',
  imperial_queen: 'la Reine impériale', empress_matriarch: 'la Matriarche impératrice', the_offspring: 'le Rejeton', predalien_abomination: 'l’Abomination predalien',
  predalien_matriarch_titan: 'la Matriarche titan', rogue_king_prime: 'le Rogue King', fiorina_runner: 'le Runner de Fiorina', awakened_engineer: 'l’Ingénieur éveillé', trilobite_prime: 'le Trilobite primordial',
  berserker_super_predator: 'le Berserker', ultimate_upgrade_predator: 'le Predator Ultime', feral_predator_boss: 'le Feral', apex_gladiator_predator: 'le gladiateur Apex',
  jungle_hunter_boss: 'le Chasseur de la jungle', city_hunter_boss: 'le Chasseur de la ville'
});

const ELDER = { speaker: 'ANCIEN DU CLAN', side: 'clan' };

/** Returns { lines: [{ speaker, side, text }], focus: [[x, z], ...] } or null when no intel applies. */
export function buildMissionIntel({ mode = 'hunt', level = null, layout = null, bossType = null, ascensionWorld = null, factions = [], playerFaction = null } = {}) {
  if (mode === 'ascension_hub' || !level) return null;
  const sectors = layout?.sectors ?? [], first = sectors[0]?.objective?.label, boss = BOSS_LABELS[bossType] ?? null;
  const focus = sectors.map(sector => sector.center);
  const lines = [];
  if (mode === 'ascension' && ascensionWorld) {
    lines.push({ speaker: 'KAEDH', side: 'clan', text: `${ascensionWorld.title}. Tu chasses seul ce monde, Unblooded. Ta meute observe.` });
    const saar = ascensionWorld.lines?.[0]?.replace(/^SAAR\s*:\s*/, '');
    if (saar) lines.push({ speaker: 'SAAR', side: 'clan', text: saar });
    if (ascensionWorld.preyLine) lines.push({ speaker: 'KAEDH', side: 'clan', text: ascensionWorld.preyLine });
    return { lines, focus };
  }
  if (mode === 'ascension_rite') {
    lines.push({ speaker: 'KAEDH', side: 'clan', text: 'Le rite. La pyramide s’ouvre à ta triade, et à elle seule.' });
    lines.push({ speaker: 'KAEDH', side: 'clan', text: 'Aucune arme à énergie. Revenez marqués, ou ne revenez pas.' });
    return { lines, focus };
  }
  if (mode === 'fronts') {
    const humans = factions.filter(faction => faction.species === 'human' && faction.id !== playerFaction);
    if (humans.length) {
      const label = (humans[0].label ?? humans[0].id).toUpperCase();
      lines.push({ speaker: `RADIO · ${label}`, side: 'intercept', text: `Tous les postes : activité hostile confirmée sur ${sectors.length || 'plusieurs'} secteurs. Tenez vos positions.` });
      if (first) lines.push({ speaker: `RADIO · ${label}`, side: 'intercept', text: `Premier secteur : ${first.charAt(0).toLowerCase()}${first.slice(1)}. On ne voit rien sur les capteurs… rien du tout.` });
    }
    lines.push({ ...ELDER, text: humans.length ? 'Ils ne vous voient pas encore. Choisissez votre front et frappez où ils ne regardent pas.' : `${level.name}. La ruche tient ${sectors.length} secteurs : choisissez votre front.` });
    return { lines, focus };
  }
  lines.push({ ...ELDER, text: `${level.name}. ${sectors.length ? `${sectors.length} secteurs vous séparent de la proie.` : 'Le terrain de chasse vous attend.'}` });
  if (first) lines.push({ ...ELDER, text: `Premier secteur : ${first.charAt(0).toLowerCase()}${first.slice(1)}. Chaque passage reste scellé tant que son secteur n’est pas soumis.` });
  if (boss) lines.push({ ...ELDER, text: `Au cœur du dernier secteur attend ${boss}. Rapportez son crâne.` });
  return { lines, focus };
}
