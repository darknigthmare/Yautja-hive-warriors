/* Original encounter rules tied to existing source-inspired arsenals. Neither
 * these timings nor the counters certify a film performance or scale. */
const pattern = (mechanic, read, response, extra = {}) => Object.freeze({ mechanic, read, response, ...extra });
export const BOSS_COMBAT_PATTERNS = Object.freeze({
  xenomorph_queen: pattern('circular-tail', 'La queue se prépare tout autour de la reine.', 'Sautez au passage du balayage ou sortez de sa portée.'),
  praetorian: pattern('frontal-carapace', 'La carapace fait face au tireur ; le balayage couvre l’arrière.', 'Attendez la récupération ou frappez un flanc.', { frontalArmor: .45 }),
  predalien: pattern('frontal-tail-pounce', 'La trajectoire du bond est annoncée ; la queue frappe devant.', 'Décalez-vous de côté, puis exploitez la réception.'),
  predalien_queen: pattern('interruptible-brood', 'La régurgitation est préparée avant de libérer une couvée finie.', 'Une attaque lourde pendant cette préparation interrompt la couvée.'),
  imperial_queen: pattern('annular-aftershock', 'Un premier choc proche précède une couronne extérieure.', 'Sautez le premier choc, puis revenez à l’intérieur de la couronne.'),
  empress_matriarch: pattern('directional-gale', 'Le souffle vise un cône fixé pendant la préparation.', 'Sortez latéralement du cône ; un couvert arrête aussi le souffle.'),
  the_offspring: pattern('focused-shriek', 'Le cri vise le secteur annoncé et peut vider l’énergie.', 'Cassez la ligne de vue ou quittez le cône avant le cri.'),
  predalien_abomination: pattern('brood-pounce', 'Le bond verrouille sa trajectoire avant la couvée.', 'Esquivez la réception et utilisez la récupération pour vous replacer.'),
  predalien_matriarch_titan: pattern('three-seismic-pulses', 'Trois impacts concentriques sont espacés.', 'Anticipez le départ vers le bord : le saut ne remplace pas l’évacuation de la zone.'),
  rogue_king_prime: pattern('wall-stagger', 'La charge se fixe sur une trajectoire droite.', 'Attirez la charge vers un obstacle solide : le choc étourdit le roi.'),
  awakened_engineer: pattern('heavy-shield-overload', 'Le bouclier absorbe une partie des impacts.', 'Les attaques lourdes brisent plus vite le bouclier ; évitez ensuite le vortex.'),
  trilobite_prime: pattern('low-constriction', 'L’organisme prépare une saisie au ras du sol.', 'Sautez sa zone de saisie ou reculez avant sa fermeture.'),
  berserker_super_predator: pattern('shared-plasma-burst', 'Trois traits partagent un verrouillage visible.', 'Quittez cette ligne ou prenez un couvert ; la rafale ne cumule pas trois impacts sur vous.', { weapons: Object.freeze(['plasma']) }),
  ultimate_upgrade_predator: pattern('heavy-charge-interrupt', 'L’armure se referme pendant la préparation de charge.', 'Une attaque lourde interrompt cette charge ; sinon sortez de son axe.'),
  feral_predator_boss: pattern('mask-guided-bolt', 'Le masque signale la visée du véritable bolt.', 'Évitez sa trajectoire ou orientez le masque pour renvoyer un bolt.'),
  apex_gladiator_predator: pattern('landing-aftershock', 'Le bond est suivi d’un impact de réception.', 'Évitez le point annoncé, puis sautez l’onde qui suit.'),
  jungle_hunter_boss: pattern('laser-committed-plasma', 'Le triple laser conserve la visée pendant la préparation.', 'Rompez la ligne laser, puis attaquez pendant la récupération.', { weapons: Object.freeze(['plasma']) }),
  city_hunter_boss: pattern('returning-disc', 'Le disque alterne avec le plasma et revient vers son propriétaire.', 'Évitez le trajet aller et le retour ; ne traversez pas trop tôt.', { weapons: Object.freeze(['disc', 'plasma']) })
});

export function getBossCombatPattern(id) {
  const key = id === 'queen' ? 'xenomorph_queen' : id;
  if (!Object.hasOwn(BOSS_COMBAT_PATTERNS, key)) throw new RangeError(`Unknown boss combat pattern: ${String(id)}`);
  return BOSS_COMBAT_PATTERNS[key];
}
