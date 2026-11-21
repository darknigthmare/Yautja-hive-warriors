# Espaces des boss (AUD-066) : mesure et correction du 21 novembre 2026

Critère d'AUD-066 :
- aucune attaque ni caméra ne traverse un volume majeur ;
- le joueur peut lire le boss et se déplacer pendant toutes ses phases.

Ce document rend compte d'une mesure du code et d'une correction. Il ne remplace pas l'examen des phases de chaque affrontement en jeu.

## Mesure de départ

Script de mesure : l'environnement réel (`EnvironmentManager.buildLevelEnvironment`) a été construit en Node pour les 11 niveaux à boss du mode campagne et pour les 34 cartes de bataille `LD-01` à `LD-34`.

| Constat | Résultat |
| --- | --- |
| Collisions à moins de 22 unités du point du boss final | Aucune sur les 45 cartes |
| Géométrie à moins de 12 unités du boss (calcul par sommet, maillages fusionnés inclus) | Seulement les deux poteaux du marqueur d'objectif : 2,9 unités du centre, 3,6 de haut, sans collision. Le boss s'y tenait. |
| Rayon de collision du boss en marche | Fixe : 1,8 en marche et en poursuite, 2,0 en charge. Identique pour un chasseur de 4,6 de haut et pour le Roi de Charon de 7,5. |
| Rayon en ordre de bataille (`moveBattleOrder`) | Plafonné à 1,3 pour tous les acteurs, boss compris |
| Apparition en mode bac à sable et en survie | Fixée à 25 ou 30 unités du joueur, sans vérifier la place : un boss pouvait naître dans un décor |

## Correction

Fichiers modifiés :
- `js/entities/Bosses.js` ;
- `js/engine/BattleActorSupport.js` ;
- `js/entities/Environment.js`.

1. **Empreinte mesurée.** `measureBossFootprint` prend le 80e centile des distances horizontales des sommets du modèle normalisé, multiplié par 1,35 et borné entre 1,8 et 3,4 unités.
   - Les queues, crêtes et ailes fines peuvent dépasser au-dessus d'un couvert sans y faire entrer le corps.
   - Le plancher de 1,8 conserve le rayon d'avant ; le plafond de 3,4 laisse passer un couloir de 18 unités.
2. **Déplacements.** La marche, la poursuite, les charges et les ordres de bataille utilisent cette empreinte. Les charges passent aussi la hauteur du boss au résolveur de collisions.
3. **Apparition.** `findBossArenaPosition` garde le point demandé si le corps y tient, avec une marge de 0,6.
   - Sinon, le boss prend le point libre le plus proche sur des anneaux croissants (12 au plus).
   - La même fonction de collision que le déplacement en décide.
   - L'état `boss.arena` garde le point demandé, le point retenu et l'indicateur `moved`.
4. **Marqueur.** Un objectif de boss garde son anneau au sol mais n'a plus de poteaux : le boss est lui-même le repère.

Ce qui ne change pas :
- PV, dégâts, phases et délais ;
- la portée du Musou, qui lit toujours `boss.radius` ;
- le point de duel de chaque carte, qui reste exactement le même puisqu'il était déjà libre.

## Empreintes obtenues (unités de jeu)

| Boss | Hauteur | Empreinte |
| --- | ---: | ---: |
| `xenomorph_queen`, `praetorian`, `predalien`, `predalien_queen`, `the_offspring`, `jungle_hunter_boss`, `city_hunter_boss` | 4,6 à 6,2 | 1,80 (plancher) |
| `berserker_super_predator`, `apex_gladiator_predator` | 5,2 et 5,8 | 1,80 |
| `feral_predator_boss` | 4,6 | 1,88 |
| `ultimate_upgrade_predator` | 6,2 | 1,89 |
| `imperial_queen` | 8,2 | 1,90 |
| `trilobite_prime` | 4,7 | 2,17 |
| `awakened_engineer` | 5,8 | 2,23 |
| `empress_matriarch` | 7,5 | 2,60 |
| `predalien_abomination` | 6,2 | 2,65 |
| `predalien_matriarch_titan` | 8,0 | 3,34 |
| `rogue_king_prime` | 7,5 | 3,40 (plafond) |
| Grandes proies d'Ascension | 3,4 à 4,2 | 2,46 à 3,04 |

## Vérification

- `tests/boss-arena.test.js` : 4 tests.
  - Empreinte de chaque boss dans les bornes.
  - Point de duel conservé et libre sur les 11 niveaux, sans poteaux.
  - Boss demandé dans un décor de Romulus et replacé sur un point libre.
  - Marche, poursuite et charge résolues avec l'empreinte.
- Tests de boss, de champ de bataille et de pression hostile : 215 sur 215.
- Suite Node complète : 1 579 réussis, 0 échec, 1 ignoré.

## Ce qui reste à examiner pour clore AUD-066

- **Phases en jeu.** Lisibilité et caméra de chaque phase des 18 affrontements, en combat réel et en coopération. Ce travail n'a pas été fait ici.
- **Plafonds.** Les cartes de bataille sont à ciel ouvert, et aucun plafond ne limite les boss sur le point de duel. Les intérieurs de référence, comme la crypte de l'Ingénieur, n'ont pas été mesurés.
- **Statut.** Le suivi d'AUD-066 reste « À valider ».
