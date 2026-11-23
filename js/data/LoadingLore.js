/* Loading screen texts (spec 003, US2). Each world carries a short original lore card written for
 * this fan game: it situates the hunt without quoting films and states when the place is an
 * adaptation. Tips name the real controls of the controls dossier (index.html, [F1]). */

export const LOADING_LORE = Object.freeze({
  gunnison_forest: { tag: 'TERRE · 2004 · ADAPTATION', lines: [
    'L’orage noie la forêt et couvre les pas. Ici, la pluie efface les traces aussi vite que le sang.',
    'Six secteurs reliés par des chemins forestiers : la carte est une adaptation jouable, pas un relevé du lieu.'] },
  xenomorph_prime: { tag: 'MONDE-RUCHE · CRÉATION', lines: [
    'Les couloirs respirent. La résine vivante se referme derrière ceux qui s’y attardent.',
    'Un monde imaginé pour le jeu : chaque galerie mène plus profond vers la reine.'] },
  antarctic_pyramid: { tag: 'ANTARCTIQUE · 2004 · ADAPTATION', lines: [
    'Sous la glace, la pyramide rejoue son rite : ses murs coulissent et redessinent les chemins.',
    'Les chambres sont recomposées pour le jeu ; le froid, lui, est bien réel.'] },
  la_rooftops: { tag: 'LOS ANGELES · RÉCIT EN 1997 · ADAPTATION', lines: [
    'Canicule, orage et néons : la ville se bat contre elle-même, et quelqu’un chasse au-dessus.',
    'Les toits forment six secteurs jouables reliés par des passerelles ; la topologie est adaptée.'] },
  val_verde_jungle: { tag: 'VAL VERDE · 1987 · ADAPTATION', lines: [
    'La chaleur brouille l’air. Dans la canopée, une silhouette observe sans être vue.',
    'Six secteurs de jungle dense : une adaptation jouable du premier terrain de chasse.'] },
  romulus_station: { tag: 'STATION EN DÉRIVE · 2142 · ADAPTATION', lines: [
    'La station tombe lentement vers les anneaux. Les laboratoires n’ont pas été vidés.',
    'Baie cryogénique et laboratoires sont recomposés en secteurs jouables.'] },
  charon_rogue_base: { tag: 'BASE CHARON · ADAPTATION', lines: [
    'Derrière les blindages, une expérience a dépassé ceux qui la menaient.',
    'Le complexe fortifié est adapté en six secteurs ; ses noms et ses dimensions sont réinterprétés.'] },
  game_preserve_planet: { tag: 'PLANÈTE-RÉSERVE · 2010 · ADAPTATION', lines: [
    'Une jungle qui n’est pas sur Terre, et des chasseurs qui ne chassent plus selon le code.',
    'Totems et pièges jalonnent six secteurs adaptés pour le jeu.'] },
  stargazer_facility: { tag: 'PROJET STARGAZER · 2018 · ADAPTATION', lines: [
    'Forêt d’automne, base souterraine et carcasse en feu : la nuit sera longue.',
    'Les lieux sont recomposés en secteurs jouables autour de l’épave.'] },
  prey_comanche_territory: { tag: 'GRANDES PLAINES · 1719 · ADAPTATION', lines: [
    'Les plaines sentent la fumée des trappeurs. La boue garde les traces de ce qui est passé.',
    'Le profil 1719 exclut tout groupe et tout objet hors d’époque ; la carte est adaptée.'] },
  killer_of_killers_arena: { tag: 'ARÈNE YAUTJA · 2025 · ADAPTATION', lines: [
    'Trois époques de captifs, un seul colisée. Ici, on ne survit qu’en étant digne d’être chassé.',
    'L’arène réunit des époques différentes : ce mélange est assumé par sa source.'] },
  lv223_engineer_structures: { tag: 'LV-223 · 2093 · ADAPTATION', lines: [
    'Sous la tempête de silice, les galeries des Ingénieurs respirent encore. Ne touchez pas aux urnes.',
    'Le film ne montre aucune ruche sur LV-223 : celle-ci est une adaptation de jeu, comme le bouclier de l’Ingénieur.'] },
  hadleys_hope_colony: { tag: 'LV-426 · 2179 · ADAPTATION', lines: [
    'La tempête d’Acheron couvre les balises. Le processeur atmosphérique gronde au cœur de la ruche.',
    'Le film ne montre aucun Yautja à Hadley’s Hope : cette chasse est une adaptation de jeu.'] },
  fiorina_161_foundry: { tag: 'FIORINA 161 · 2179 · ADAPTATION', lines: [
    'Plomb, rouille et suie : la fonderie du pénitencier ne s’éteint jamais tout à fait.',
    'Le film ne montre qu’un seul Xénomorphe : la ruche et le rythme du Runner sont des adaptations.'] },
  nostromo_refinery: { tag: 'NOSTROMO · 2122 · ADAPTATION', lines: [
    'Les coursives ruissellent de condensation. Quelque chose se déplace dans les conduits d’aération.',
    'Le film ne montre qu’un seul Xénomorphe et aucun Yautja : la ruche et la chasse sont des adaptations.'] },
  usm_auriga_labs: { tag: 'USM AURIGA · 2381 · ADAPTATION', lines: [
    'Les cuves des laboratoires sont ouvertes. La Reine clonée a déjà pondu.',
    'Le film ne montre aucun Yautja à bord ; le Nouveau-né n’est pas représenté dans cette chasse.'] },
  sevastopol_station: { tag: 'SEVASTOPOL · 2137 · ADAPTATION', lines: [
    'Les Working Joes de Seegson patrouillent encore. Ils ne distinguent plus un chasseur d’un intrus.',
    'Source : un jeu vidéo. La ruche et le boss repris du Nostromo sont des adaptations.'] },
  gateway_station_labs: { tag: 'GATEWAY · 2179 · CRÉATION', lines: [
    'Le laboratoire de la compagnie a cédé. La sécurité synthétique de Weyland-Yutani tire sur tout ce qui bouge.',
    'Le film ne montre aucun spécimen à bord de Gateway : ce scénario est une création du jeu.'] },
  paradise_covenant: { tag: 'PARADISE · 2104 · ADAPTATION', lines: [
    'Le blé noir couvre la nécropole. Les spores dérivent dans l’orage ; ne les respirez pas.',
    'La ruche et le Néomorphe agrandi en boss sont des adaptations de jeu.'] },
  gunnison_town: { tag: 'GUNNISON · 2007 · ADAPTATION', lines: [
    'Le courant saute dans toute la ville. La Garde nationale tient l’hôpital ; la ruche tient les égouts.',
    'La topologie de la ville est propre au jeu.'] },
  prodigy_city_maginot: { tag: 'PRODIGY CITY · 2120 · ADAPTATION', lines: [
    'L’épave du Maginot fume encore dans la tour. Ses spécimens n’attendaient que l’impact.',
    'Source : une série. La ruche et le boss repris du Nostromo sont des adaptations.'] },
  yautja_clan_ship: { tag: 'VAISSEAU DE CLAN · CRÉATION', lines: [
    'La cale de trophées est devenue une ruche. Un hybride né d’un des vôtres règne sur le pont.',
    'Ce vaisseau et son Predalien sont des créations de Hive Warriors.'] },
  ascension_ship: { tag: 'LA LAME PATIENTE · CRÉATION', lines: [
    'Le vaisseau de l’Elite Kaedh dérive entre deux mondes. Saar attend vos ordres en silence.',
    'Le pont est interdit aux Unblooded. Le rite, lui, vous attend au bout des huit chasses.'] }
});

export const LOADING_TIPS = Object.freeze([
  '[Q] verrouille une cible, puis la suivante.',
  '[ESPACE] déclenche le Musou quand la jauge est pleine.',
  '[E] exécute un ennemi chancelant et prend son trophée.',
  '[F] active le camouflage ; [⇧ + F] prépare une parade de lames.',
  '[V] fait défiler les modes de vision du bio-masque.',
  '[ALT] esquive ; [⇧ + ESPACE] bondit.',
  '[MAJ] maintenu tire au canon plasma d’épaule, si votre rang le permet.',
  '[TAB] ou [R] ouvre la roue d’armes, et ralentit le temps.',
  '[Z] utilise le Medicomp quand vos PV baissent.',
  '[²] ouvre la carte de commandement sur les fronts.',
  '[O] passe en mode photo ; le temps s’arrête.',
  '[F1] affiche tout le dossier des commandes.',
  'Un chef abattu fait fuir sa harde, mais une bête qui fuit reste dans le monde.',
  'Les renforts ennemis sont finis : chaque mort compte, de part et d’autre.'
]);

export function loadingCard(levelId, { shipHub = false, seed = Date.now() } = {}) {
  const lore = LOADING_LORE[shipHub ? 'ascension_ship' : levelId] ?? null;
  const tip = LOADING_TIPS[Math.abs(Math.floor(seed)) % LOADING_TIPS.length];
  return { lore, tip };
}
