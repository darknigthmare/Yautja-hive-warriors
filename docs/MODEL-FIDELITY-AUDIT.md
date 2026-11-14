# Revue des modèles et mécanismes — 25 octobre 2026

Cette revue concerne les chantiers encore visibles autour des véhicules et des personnages. La capsule et sa séquence d'insertion sont contrôlées séparément. Les images sources sont des photographies promotionnelles de miniatures ou de statues : elles ne constituent pas un relevé complet des accessoires de cinéma. Aucune fidélité géométrique exacte « 1:1 » n'est établie.

## Nouvelle passe de fidélité

Cette passe corrige les articulations et les silhouettes identifiables dans les références disponibles. Les douze GLB source restent inchangés ; aucun crédit Meshy supplémentaire n'est dépensé.

- **City Hunter :** les trois vraies pièces du boîtier droit deviennent une armure rigide sur l'avant-bras, avec conservation du repos, des normales, tangentes et UV. Les dix extrémités libres mesurées de la chevelure reçoivent quarante os privés supplémentaires ; les deux chaînes existantes sont conservées. Les gros faisceaux soudés restent fixes. Voir [le gantelet et les lames](meshy/NATIVE-WRISTBLADE-REVIEW.md) et [les mèches mesurées](meshy/CITY-HUNTER-MEASURED-MANE.md).
- **Big Chap :** quatre nouveaux pivots mesurés articulent les chevilles et les orteils. Les coutures du mollet restent ancrées, les clips réels commandent les articulations et les supports de contact couvrent les 8 138 sommets concernés. Le squelette passe de 33 à 37 os, sans ajout de triangles. Voir [les chevilles](BIG-CHAP-ANKLES.md).
- **Wolf :** le masque procédural reçoit une sculpture propre guidée par quatre photographies Prime 1 : couronne et douze goujons, arcade en V, lentilles opaques, museau trapézoïdal, joues et gravures projetées sur la coque. Voir [les références et limites](WOLF-BIOMASK.md).
- **M577 :** l'affût suit maintenant un rail continu depuis l'arrière bas jusqu'au toit. L'élévation entraîne tout son carénage ; les collisions suivent ses volumes mobiles et le contour de navigation couvre les poses. Le flanc opposé reçoit les panneaux techniques observés. Voir [le mécanisme et les cotes interprétées](APC.md).

La recherche de séparation des lames natives est conservée, mais son candidat non fermé est rejeté : les pièces 8 et 9 ne sont pas deux lames complètes. Les animer comme telles aurait produit un résultat incorrect. Le [rapport de cette passe](qa/fidelity-validation.json) et la [galerie comparative](qa/fidelity/README.md) distinguent les améliorations livrées des limites restantes.

## Véhicules de la passe précédente

Le skimmer avait un défaut d'orientation : son nez et ses canons pointaient vers −Z, tandis que le contrôleur avançait et tirait vers +Z. Un enfant visuel réoriente maintenant toute la coque ; le pivot physique conserve les conventions du jeu. Les canons, le déplacement et les attaques partagent donc le même avant. Le modèle ajoute des carénages, anneaux de canon, conduites, plaques fixées, quatre buses de sustentation et une tuyère à ailettes. La poussée et la lumière des armes réagissent au déplacement et au tir. L'oscillation reste sur l'enfant de rendu et ne déplace pas la collision, le joueur ou la caméra. Il s'agit d'un véhicule interprété ; aucune référence officielle équivalente n'a été identifiée.

Le Cheyenne ajoute les prises d'air aux épaules, les cadres latéraux du cockpit, des panneaux d'accès avec leurs fixations et une queue bifide à surfaces effilées. Ces éléments remplacent notamment les deux grands panneaux verticaux rectangulaires de l'ancien modèle. Les silhouettes ont été comparées à la [photo officielle NECA du UD-4L](https://necaonline.com/2016/05/cinemachines-die-cast-collectibles-ud-4l-cheyenne-dropship-aliens/). Les proportions générales, le train et les nacelles restent simplifiés ; cette passe ne reconstitue pas tous les mécanismes repliables de la miniature.

| Modèle | Triangles proches mesurés | Surfaces de dessin | Capture examinée |
| --- | ---: | ---: | --- |
| Skimmer | 33 464 | 7 | [Trois quarts](qa/vehicle-detail/skimmer-quarter.png) |
| Cheyenne | 28 956 | 8 | [Trois quarts](qa/vehicle-detail/cheyenne-quarter.png) |
| APC M577 | Voir le [relevé du 25 octobre](qa/apc-mechanisms/validation.json), flash masqué compris | 14 | [Trois quarts](qa/apc-mechanisms/apc-quarter.png) |

Le [M577](APC.md) ajoute le 25 octobre un rangement bas derrière la caisse : le chariot remonte le rail arrière, tourne au coin et rejoint le toit avant de pouvoir tirer. Deux photos NECA supplémentaires confirment les flancs asymétriques et l'élévation de tout le carénage ; le profil symétrique effilé, les grilles techniques et les tubes compacts ont été repris. La visée utilise les deux axes et les vraies bouches. Les collisions suivent les volumes mobiles et le contour de navigation couvre toutes les poses. Le rayon du rail, les cotes du rangement et les butées sont une reconstruction locale ; les photos ne suffisent pas à établir leurs mesures exactes. Le soutien rejoint toujours le quatrième territoire, sans changement de PV ni de dégâts/cadence après son déploiement de 2,2 secondes. La suspension roulante et l'intérieur restent simplifiés.

Les captures utilisent le modèle et ses matériaux réels dans une scène de contrôle éclairée. Elles ne représentent pas un combat ni une performance sur matériel de jeu. Le [rapport de rendu](qa/vehicle-detail/render-report.json) relève zéro erreur JavaScript dans cette scène. Le [relevé des sources](qa/vehicle-detail/reference-sources.json) conserve les URL et empreintes des deux photos consultées.

`tests/skimmer-details.test.js` vérifie l'alignement réel des surfaces de canon avec le mouvement et les tirs, la séparation entre animation visuelle et position physique, la remise à zéro, l'indépendance de fréquence du moteur visuel et les budgets de géométrie. Ses quatre cas ont réussi. Quatre cas ciblés de `tests/support-visual.test.js` ont également réussi pour les budgets des deux véhicules, le cycle de vie des soutiens et l'annulation d'une frappe aérienne.

## Écarts encore ouverts

| Élément | État observé et suite nécessaire |
| --- | --- |
| City Hunter | Le boîtier droit est rigide et dix extrémités libres s'ajoutent aux deux chaînes existantes. Les lames complètes restent fusionnées avec le bras et la main ; leur séparation automatique a échoué au contrôle de fermeture. Les gros faisceaux soudés et le visage demandent encore une reconstruction. Voir [les mesures](meshy/NATIVE-WRISTBLADE-REVIEW.md). |
| Jungle Hunter importé | Biomask séparé et filtres oculaires locaux présents. La grande lame intégrée et les détails du visage restent simplifiés ; les géométries procédurales d'armes ne doivent pas être confondues avec une séparation du modèle source. Voir [GRAPHICS.md](../GRAPHICS.md). |
| Big Chap | Neuf os de queue et quatre nouveaux pivots cheville/orteils articulent les surfaces existantes. Le crâne, les mains, la mâchoire et les proportions restent ceux de la génération ; il n'y a pas d'IK de pied planté, de terrain incliné ou de correction du glissement horizontal. Voir [les chevilles](BIG-CHAP-ANKLES.md). |
| Wolf procédural | Masque spécifique d'après les photos de statue. Le visage, les racines de chevelure, l'armure corporelle et leurs dimensions ne constituent pas une reconstruction complète du costume. Voir [le masque](WOLF-BIOMASK.md). |
| APC | Rangement derrière la caisse, retour du rail, pointage complet et flancs asymétriques ajoutés le 25 octobre d'après trois [photos officielles NECA](https://necaonline.com/2015/11/cinemachines-die-cast-collectibles-series-1-assortment/). Les [preuves et limites](APC.md) distinguent les détails photographiés des cotes reconstruites. Suspension, intérieur et véritable embarquement dans le Cheyenne restent ouverts. |
| Cinq autres Yautja | Les références et plans existent, mais leurs générations ne font pas partie des 75 crédits approuvés pour City Hunter. Aucune nouvelle tâche Meshy payante n'a été lancée dans cette passe. |

Les vérifications de cette passe sont des contrôles automatisés et des revues visuelles d'agents IA. Aucun testeur humain n'est déclaré.
