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
