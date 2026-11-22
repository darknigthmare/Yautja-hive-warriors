/* AUD-123: the faithful 1719 version of the Comanche Territory hunt (Prey, 2022). The film shows
 * no xenomorph and no Colonial Marines: in "faithful" mode the sectors hold period wildlife
 * (grey wolves, a grizzly leading each pack) and the Feral remains the final boss. The animals use
 * the game's generic fauna silhouettes; their numbers and stats are gameplay choices. */
export const PREY_1719_LEVEL_ID = 'prey_comanche_territory';

export const PREY_1719_FAITHFUL = Object.freeze({
  id: 'prey_1719_faithful',
  title: 'TERRITOIRE COMANCHE 1719 — VERSION FIDÈLE',
  herd: Object.freeze({ name: 'Loup gris', hp: 80, speed: 14, bite: 12, radius: 0.85, color: 0x6e6b66, size: 0.85 }),
  leader: Object.freeze({ name: 'Grizzly', hp: 1100, speed: 9, bite: 55, charge: 130, radius: 1.8, color: 0x5a4632, size: 1.9 }),
  herdSizes: Object.freeze([8, 10, 12]),
  lines: Object.freeze([
    'ANCIEN DU CLAN : « Version fidèle de 1719. Ni ruche, ni soldats des étoiles : seulement les bêtes de ces plaines. »',
    'ANCIEN DU CLAN : « Les loups chassent en meute. Le grizzly les mène : abats-le pour ouvrir le passage. »',
    'ANCIEN DU CLAN : « Les traces fraîches mènent plus loin. Quelque chose d’autre chasse ici. »'
  ]),
  preyLine: 'ANCIEN DU CLAN : « Le Feral t’attend. Il n’a pas de maître et ne connaît pas l’honneur. »',
  excluded: Object.freeze(['xenomorph hive', 'USCM support (APC, Cheyenne)', 'out-of-period equipment'])
});

/** The faithful variant applies to a hunt on the Comanche Territory chosen in "faithful" mode. */
export const usesPrey1719Faithful = ({ missionMode, fidelityMode, levelId }) =>
  missionMode === 'hunt' && fidelityMode === 'faithful' && levelId === PREY_1719_LEVEL_ID;
