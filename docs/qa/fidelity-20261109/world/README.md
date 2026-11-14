# Val Verde — décor et visibilité de l’insertion

Périmètre : campagne originale en secteurs, inspirée d’un camp de guérilla de jungle. La topographie, les emplacements, l’architecture et les végétaux ne constituent pas une reconstruction 1:1 certifiée du tournage de *Predator* (1987). Les modifications ne créent aucun achat ni actif Meshy.

## Défaut reproduit avant modification

Sur la source de départ `a8f9c75`, seed 1, les rayons vers le bas du corps traversaient réellement la baraque et les pieds du mirador. Les captures R5 de la passe précédente montraient le même type d’occultation ; leurs pixels restent des preuves de leur propre version, pas de cette source.

| Rayon de diagnostic, coordonnées en mètres | Géométrie rencontrée avant modification | Premier contact |
| --- | --- | --- |
| `[8,6,17]` → `[0,.5,4.2]` | Toit 5 × .15 × 5 à `[2,2.6,10]`, puis mur 4.5 × 2.6 × 4.5 | `[3.164,2.675,9.262]` |
| `[14,6,17]` → `[6,2,4.2]` | Pied de mirador cylindrique, centre monde `[6.2,3.1,4.2]` | `[6.135,2.067,4.416]` |

Ces deux rayons fixes servent de témoins supplémentaires. Le test de non-régression parcourt aussi les méthodes réelles `GameApp.update` et `updateInsertionPresentation`, pour les deux caméras, pendant toute l’ouverture et la sortie : six points du corps par joueur et par frame. Il vérifie l’absence d’occultation par ces deux structures ; il ne prétend pas mesurer toute occultation possible par la capsule elle-même.

La recherche de géométrie exactement superposée, par paramètres de source et matrice monde, n’a trouvé **aucun doublon** dans les entrées de batches avant modification. Un seul toit et un seul cube formaient la baraque. Le profil appelait une fois `buildValVerdeProps`, puis une fois `buildValVerdeMasterExpansionProps`. Une texture ou l’ombre peut expliquer certaines zébrures ; la présence de doublons de construction n’a pas été démontrée. Aucun biais d’ombre global n’a été modifié ici.

## Résultat construit

- Baraque déplacée avec son état `shackPos` à `[14,0,14]` : cinq sections de murs avec de vraies planches et joints, porte de 1.6 m, ouverture arrière, charpente, assemblages, antenne radio. Les cinq enveloppes de collision correspondent aux murs visibles. La surface `wood` utilise un grain scié longitudinal, orienté par les UV de chaque planche.
- Mirador déplacé avec `pos` et `platformPos` à `[-14,0,-14]` : quatre piliers réels, contreventements, solives, plancher à 5.59 m, sacs arrondis et échelle à marches en bois. Les quatre piliers restent des obstacles physiques. Une encoche de 1.6 m dans la première planche et un vrai dernier palier de 30 cm assurent une arrivée et une descente continues ; les sacs dégagent cette entrée.
- Toiture conservée : deux pans, 60 ondulations géométriques de 85 mm, amplitude 14 mm, faîtage, rives et chevrons. Ce profil est plausible pour une tôle légère et ne provient pas d’une mesure du film. La hauteur de support interpole les mêmes 500 échantillons que les 6 000 triangles de tôle ; les tirs utilisent les triangles réels.
- Accès du mirador : 18 marches physiques fusionnées en un mesh, montées de 31 cm, sans boîte verticale supplémentaire. Le tag `referenceWalkContactOnly` est respecté par `ReferenceWorldContacts` pour éviter ce second faux obstacle. Les triangles mesurés remplacent la pente abstraite héritée. Le déplacement réel `Player.move` utilise des sous-pas horizontaux de 5 cm uniquement près des marches mesurées ; les pieds suivent leurs appuis réels, dans les deux sens, sans augmenter la limite globale de 65 cm. Saut, perte d’appui latérale, pause, retrait des objets et téléportation conservent leurs chemins habituels.
- Aucune hauteur de toit ou de mirador ne subsiste aux anciennes coordonnées d’insertion. Les acteurs au sol ne sont pas téléportés sur les nouvelles surfaces élevées. Les surfaces conservent leurs contacts quand le rendu distant est masqué.
- Les couronnes tropicales ont des feuilles asymétriques à cinq sections, un pli central plus lisible et une courbure réelle. Les fougères tropicales passent à sept frondes et 98 folioles. Les positions, 40 arbres instanciés, graines, tirages PRNG, contacts des troncs, nombre d’instances, silhouettes tempérées et géométries lointaines restent inchangés. Aucun palmier n’a été ajouté.

Les deux poches diagonales restent hors des sorties des joueurs, des voies cardinales et de l’anneau de circulation. Les routes, objectifs, portes, sauvegardes et destruction du dépôt de carburant gardent leurs règles ; le carburant lui-même reste à `[14,0,4]`.

## Contrôles

Tests propriétaires : [val-verde-world-fidelity.test.js](../../../../tests/val-verde-world-fidelity.test.js). Ils couvrent rayons de rendu, deux caméras réelles, contacts de murs et piliers, sorties, voies cardinales, visibilité physique, nettoyage, seed 1/7/23, montée de chaque marche, appui sur le deck/toit réel et absence des anciennes hauteurs fantômes. Les 60 combinaisons de déplacement réel croisent vitesses 14/16/19, pas de temps 10/20/30/60/120 Hz (cap réel 100 ms), deux hauteurs de collision et activation ou non de deux bonus de vitesse. Toutes montent jusqu’au deck et redescendent jusqu’au sol. Le retrait désactive immédiatement les trois surfaces, leurs tirs et leurs routes verticales, tandis qu’une reconstruction à partir du seed et de l’état tactique sérialisés recrée des contacts neufs sans doublons. Les wrappers de masquage distant gardent les contacts physiques.

Régressions exécutées : `insertion-camera-collision`, `world-route-weather-regression`, `reference-walk-surfaces`, `battlefield-map-variants`, `world-depth-seeds`, `world-geometry-streaming`, `environment-visual`. Résultats : **6/6** tests propriétaires sur la source finale, **16/16** contrôles ciblés et **91/91** contrôles élargis sur la version intermédiaire ; les commandes et limites de source sont consignées dans [regression-results.json](regression-results.json). La vérification globale après le dernier correctif d’accès est centralisée par l’agent principal. Les budgets et comparaisons de géométrie sont dans [measurements.json](measurements.json). La revue d’images avant/après et la vérification du cadrage final sont centralisées par l’agent QA ; aucune QA humaine ni matérielle n’est revendiquée ici.

Guides appliqués : `/tmp/yautja-guides-20261109` au commit `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`, disciplines level-design, physics-tuning et performance-optimization. Contrats locaux relus : `AGENTS.md`, `docs/INSERTION.md`, `docs/SECTOR-ARCHITECTURE.md`, `docs/WORLD-DEPTH.md`.
