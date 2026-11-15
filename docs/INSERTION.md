# Insertion et véhicules — 23 octobre 2026

L'insertion suit une séquence de 4,75 secondes sur l'horloge de simulation : descente (1,1 s), stabilisation (0,4 s), ouverture (1,45 s), puis sortie (1,8 s). Le personnage est caché pendant le vol et le contact au sol. Il devient visible dans la cabine lorsque les portes commencent à s'ouvrir, puis avance par l'ouverture dégagée. Les mouvements de membres accompagnent la sortie ; ce n'est pas un nouveau clip de mocap.

Le bras portant les lames séparées est abaissé dans la cabine, puis revient progressivement à sa pose de combat pendant les premiers pas. Les sept variantes procédurales conservent ainsi leurs véritables lames derrière la porte, sans les cacher ni les redimensionner. Cette correction ne change pas la pose contrôlée des lames fusionnées du City Hunter.

Les attaques, déplacements libres, gadgets, mode photo et roue d'armes sont suspendus pendant l'insertion. Échap reste disponible pour mettre la séquence en pause. Les ennemis, renforts, objectifs et tâches de combat attendent la sortie ; les sept secondes de protection commencent ensuite. Une partie en coopération utilise deux capsules individuelles espacées de six unités, avec deux sorties et deux caméras.

La capsule a une coque épaisse et creuse, une couronne profilée, un support dorsal, des câbles, des verrous, des charnières et deux portes indépendantes. Les surfaces utilisent les matériaux PBR locaux. Le plancher et le seuil sont alignés avec le sol des personnages. Les côtés, l'arrière et les portes possèdent des collisions ; le passage avant reste libre après l'ouverture. La capsule reste vingt secondes après la sortie, puis disparaît progressivement en une seconde. Retour au menu, relance et annulation libèrent ses ressources sans déclencher une fin d'insertion périmée.

| Modèle | Triangles | Maillages de rendu | Changements |
| --- | ---: | ---: | --- |
| Capsule | 43 504 | 11 | Cabine réelle, deux portes autour de leurs charnières, intérieur et matériaux différenciés. |
| Skimmer | 33 464 | 7 | Canons alignés sur l'avant du déplacement et du tir, panneaux et propulsion détaillés, poussée et recul lumineux, oscillation du seul visuel. |
| Cheyenne | 28 956 | 8 | Prises d'air, cockpit, panneaux et silhouette de queue repris après comparaison visuelle. |

La caméra du déploiement suit la capsule, puis le personnage qui en sort, avant de revenir au suivi normal. Le skimmer est stationné à l'écart des sorties ; les soutiens du bac à sable attendent plus loin.

Les contrôles de fonctionnement et de rendu sont consignés dans [le rapport de validation](qa/insertion-validation.json). Les tests de géométrie vérifient l'occlusion de la porte fermée, le passage ouvert, les pivots, le seuil et l'espacement entre les capsules. Les tests de séquence et de navigateur contrôlent les phases, la visibilité, les entrées, la pause, les deux joueurs et les relances. Ces contrôles sont automatisés, sans participation de testeurs humains.

Les captures du build réel montrent [la capsule fermée au sol](qa/insertion/city-touchdown.png), [le tout début de l'ouverture](qa/insertion/city-unlocking.png), [City Hunter pendant l'ouverture](qa/insertion/city-opening.png), [sa sortie](qa/insertion/city-exiting.png) et [les deux sorties en coopération](qa/insertion/coop-exiting.png). Elles sont prises à des phases contrôlées avec la simulation suspendue, après chargement du corps et du masque, en conservant le HUD. Le [relevé des états](qa/insertion/cinematic-report.json) conserve phases, positions, visibilité, portes, santé et horloge de combat.

Le Jungle Hunter importé a également été contrôlé [au déverrouillage](qa/insertion/jungle-unlocking.png) et [pendant sa sortie](qa/insertion/jungle-exiting.png), avec son corps et son masque réellement chargés. Les mesures des lames séparées dans le repère de la cabine sont conservées dans [son relevé](qa/insertion/jungle-cinematic-report.json).

La capsule et le skimmer sont des interprétations locales : aucune référence de capsule film suffisamment fiable n'a été validée pour certifier leur fidélité « 1:1 ». Le [contrôle des références](qa/insertion-reference-review.md) distingue les sources réellement examinées des images indisponibles. Les autres chantiers de personnages y restent identifiés, notamment les lames/gantelets fixes de City Hunter, sa chevelure partiellement articulée et la queue du Big Chap. Aucun nouveau crédit Meshy n'est consommé par cette passe.

## Trois entrées et leurs effets — 15 novembre 2026

Le déploiement suit toujours la même chronologie de 4,75 s : descente, stabilisation, ouverture, sortie. Seuls le véhicule et ses effets changent.

| Entrée | Source examinée | Repris de la source | Adaptation de jeu |
| --- | --- | --- | --- |
| Capsule (`pod`) | *Alien vs. Predator* (2004), image `avp2004-bluray-271` (« Drop Pod ») de la page [AvP Galaxy — Yautja Spacecraft](https://www.avpgalaxy.net/predator/spacecrafts/) ; description « sleek black/silver capsules which have three “wings” on the end and some sort of thruster ». | Coque longue et sombre à nervures longitudinales, trois grandes pales courbes en queue, trois feux rouges de propulseurs. | La capsule se pose debout sur ses pales. Sa trappe avant et sa cabine sont celles du jeu, que l'image ne montre pas. |
| Vaisseau éclaireur (`scout`) | *Aliens vs. Predator: Requiem* (2007), images `avpr-bluray-0235` et `0236` de la même page ; description « a single thruster on the rear and prongs on the front, resembling petals on a flower ». | Petite coque sombre, propulseur arrière unique et lumineux, pointes en pétales à l'avant, traînée orange d'entrée atmosphérique. | Le vaisseau reste en vol stationnaire, lâche le chasseur par sa soute, puis repart. |
| Faisceau (`beam`) | *Alien vs. Predator* (2004) : le vaisseau-mère perce la glace avec un faisceau bleu (même page). | Colonne de lumière bleue venue du ciel. | Le chasseur descend dans la colonne, ce que le film ne montre pas. |

**Effets** (`js/entities/InsertionEffects.js`), uniquement visuels et sonores :
- **Entrée** : traînée incandescente, coque rouge sombre qui refroidit en une seconde, bang supersonique.
- **Impact** : cratère brûlé, onde de choc, poussière à la couleur du biome (neige, boue, béton, étincelles…), débris et secousse de caméra.
- **Ouverture** : trois verrous libérés l'un après l'autre, voyants rouges clignotants, vapeur s'échappant de la jointure.
- **Sortie** : le chasseur sort camouflé, puis se découvre avec un crépitement bleu. Un Unblooded qui n'a pas encore appris le camouflage sort visible.

**Choix de l'entrée** :
- Gunnison (*Requiem*) utilise le vaisseau éclaireur.
- La pyramide antarctique (2004) utilise la capsule.
- Les autres mondes alternent les trois entrées d'une mission à l'autre.
- Avec « Cinématiques : désactivées », ou sous automatisation sans `?intro=1`, la capsule seule est jouée, sans effets ni camouflage. C'est la séquence de jeu d'origine.

**Contrats conservés** : la cabine creuse, les deux portes, le profil de collision, le siège, la sortie et l'espacement de six unités en coopération restent ceux de la base mesurée. Le budget est de 60 884 triangles et 14 maillages, dans les limites de 65 000 et 14. Le vaisseau et le faisceau n'ont pas de collision : l'un vole au-dessus du chasseur, l'autre n'est que de la lumière.

Une image de film ne certifie pas une fidélité 1:1 : `filmPropFidelity1to1Verified` et `fidelity1to1Verified` restent à `false`. Les images de référence ont été consultées, sans être copiées dans le dépôt.
