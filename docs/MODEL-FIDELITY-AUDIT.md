# Revue des modèles et mécanismes — 24 octobre 2026

Cette revue concerne les chantiers encore visibles autour des véhicules et des personnages. La capsule et sa séquence d'insertion sont contrôlées séparément. Les images sources sont des photographies promotionnelles de miniatures ou de statues : elles ne constituent pas un relevé complet des accessoires de cinéma. Aucune fidélité géométrique exacte « 1:1 » n'est établie.

## Véhicules corrigés dans cette passe

Le skimmer avait un défaut d'orientation : son nez et ses canons pointaient vers −Z, tandis que le contrôleur avançait et tirait vers +Z. Un enfant visuel réoriente maintenant toute la coque ; le pivot physique conserve les conventions du jeu. Les canons, le déplacement et les attaques partagent donc le même avant. Le modèle ajoute des carénages, anneaux de canon, conduites, plaques fixées, quatre buses de sustentation et une tuyère à ailettes. La poussée et la lumière des armes réagissent au déplacement et au tir. L'oscillation reste sur l'enfant de rendu et ne déplace pas la collision, le joueur ou la caméra. Il s'agit d'un véhicule interprété ; aucune référence officielle équivalente n'a été identifiée.

Le Cheyenne ajoute les prises d'air aux épaules, les cadres latéraux du cockpit, des panneaux d'accès avec leurs fixations et une queue bifide à surfaces effilées. Ces éléments remplacent notamment les deux grands panneaux verticaux rectangulaires de l'ancien modèle. Les silhouettes ont été comparées à la [photo officielle NECA du UD-4L](https://necaonline.com/2016/05/cinemachines-die-cast-collectibles-ud-4l-cheyenne-dropship-aliens/). Les proportions générales, le train et les nacelles restent simplifiés ; cette passe ne reconstitue pas tous les mécanismes repliables de la miniature.

| Modèle | Triangles proches mesurés | Surfaces de dessin | Capture examinée |
| --- | ---: | ---: | --- |
| Skimmer | 33 464 | 7 | [Trois quarts](qa/vehicle-detail/skimmer-quarter.png) |
| Cheyenne | 28 956 | 8 | [Trois quarts](qa/vehicle-detail/cheyenne-quarter.png) |
| APC M577 | 27 578, flash masqué compris | 14 | [Trois quarts](qa/apc-detail/apc-quarter.png) |

Le [M577](APC.md) reprend la coque basse et anguleuse de la miniature NECA : baie avant en retrait, roues couvertes, portes encastrées, fixations et tourelle sur rail. Le chariot se déploie avant tir, la tourelle vise depuis son pivot effectif et les tubes reculent. La collision physique suit les flancs et les épaules de roues ; le contour de navigation ne doit pas devenir une paroi invisible élargie. Il rejoint le quatrième territoire comme soutien USCM. Le rangement arrière complet de la tourelle, la suspension roulante et l'intérieur habitable restent simplifiés.

Les captures utilisent le modèle et ses matériaux réels dans une scène de contrôle éclairée. Elles ne représentent pas un combat ni une performance sur matériel de jeu. Le [rapport de rendu](qa/vehicle-detail/render-report.json) relève zéro erreur JavaScript dans cette scène. Le [relevé des sources](qa/vehicle-detail/reference-sources.json) conserve les URL et empreintes des deux photos consultées.

`tests/skimmer-details.test.js` vérifie l'alignement réel des surfaces de canon avec le mouvement et les tirs, la séparation entre animation visuelle et position physique, la remise à zéro, l'indépendance de fréquence du moteur visuel et les budgets de géométrie. Ses quatre cas ont réussi. Quatre cas ciblés de `tests/support-visual.test.js` ont également réussi pour les budgets des deux véhicules, le cycle de vie des soutiens et l'annulation d'une frappe aérienne.

## Écarts encore ouverts

| Élément | État observé et suite nécessaire |
| --- | --- |
| City Hunter | Deux pièces de cheveux pondérées et la véritable plaque de console gauche ont une animation indépendante. La charnière et l'électronique sont modélisées localement ; voir [la console](meshy/CITY-HUNTER-CONSOLE.md). Les lames complètes et le gantelet droit restent fixes, et le visage diffère encore des photos. Voir [CITY-HUNTER.md](meshy/CITY-HUNTER.md). |
| Jungle Hunter importé | Biomask séparé et filtres oculaires locaux présents. La grande lame intégrée et les détails du visage restent simplifiés ; les géométries procédurales d'armes ne doivent pas être confondues avec une séparation du modèle source. Voir [GRAPHICS.md](../GRAPHICS.md). |
| Big Chap | Neuf os locaux pondèrent maintenant la queue et corrigent son contact au sol dans les phases contrôlées. Les pieds et la mâchoire restent simplifiés, sans IK des chevilles ni correction du glissement horizontal. Voir [la fiche d'articulation](BIG-CHAP-TAIL.md). |
| APC | La silhouette et le mécanisme de toit ont été repris suivant la [photo officielle NECA M577](https://necaonline.com/2015/11/cinemachines-die-cast-collectibles-series-1-assortment/). Le rangement complet derrière la caisse et la suspension restent ouverts ; [les preuves et limites](APC.md) distinguent ces fonctions du simple coulissement de toit livré. |
| Cinq autres Yautja | Les références et plans existent, mais leurs générations ne font pas partie des 75 crédits approuvés pour City Hunter. Aucune nouvelle tâche Meshy payante n'a été lancée dans cette passe. |

Les vérifications de cette passe sont des contrôles automatisés et des revues visuelles d'agents IA. Aucun testeur humain n'est déclaré.
