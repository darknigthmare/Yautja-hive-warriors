# Terrains et mécanismes intégrés

La fusion conserve les onze contextes de v67 et les relie aux sols PBR, à la gestion des ressources et aux six secteurs connectés de la branche validée. Les identifiants des niveaux restent stables. Les boss de Val Verde et de Los Angeles sont respectivement `jungle_hunter_boss` et `city_hunter_boss`. Le contexte de Los Angeles est 1997, distinct de la sortie du film en 1990.

| Niveau | Biome | Météo |
| --- | --- | --- |
| Gunnison | forêt | `rain` |
| Xenomorph Prime | ruche | `spores` |
| Pyramide antarctique | temple | `snow` |
| Los Angeles | toits | `rain` |
| Val Verde | jungle | `pollen` |
| Romulus | station | `dust` |
| Charon | station | `none` |
| Réserve des chasseurs | jungle | `pollen` |
| Stargazer | forêt | `autumn_gale` |
| Territoire comanche | forêt | `morning_haze` |
| Arène des captifs | temple | `stasis_aurora` |

Les listes de `ReferenceLevelMechanisms.js` sélectionnent les repères et interactions compatibles avec chaque contexte. Elles évitent notamment de disperser des caches USCM, terminaux de recharge et laboratoires futuristes dans les terrains de *Prey*. Les commentaires historiques « 1:1 » du code v67 ne constituent pas une vérification photographique.

## Trente-quatre variantes réellement construites

`BattlefieldMapVariants.js` décrit les 34 cartes de l'Excel. Chacune possède un tracé physique distinct, avec 9 à 20 salles de dimensions variables, 3 à 5 fronts, des couloirs de 18 à 26 unités et deux contournements extérieurs. L'orientation, la grille, l'espacement et les dimensions changent selon la fiche. Les sols, frontières, points d'objectif, portes et déplacements utilisent ces coordonnées. Les contextes partagent une bibliothèque de biomes ; ce ne sont pas 34 jeux d'assets uniques.

Construction : conserver l'identifiant technique du biome dans `level.id`, puis fournir `mapId: 'LD-xx'` et `strategicMode: true`. Les chasses ordinaires conservent leur progression à six secteurs et cinq portes, sans contournement prématuré. Chaque variante porte explicitement la mention « reconstruction originale non mesurée ». Les lieux et œuvres servent de références ; leurs plans, dimensions et accessoires ne sont pas certifiés conformes aux scènes.

Les routes stratégiques exposent des polylignes orthogonales et leurs `physicalGateIds`. Les portes des deux flancs sont indépendantes. `setOperationRouteOpen(routeId, boolean)` ou `setGateOpen(gateId, boolean)` masque/restaure le panneau, retire/restaure son collider et invalide la navigation. Ouvrir une porte en mode fronts ne complète pas artificiellement un secteur. La navigation des accompagnants suit les centres des salles et couloirs, puis contourne localement les groupes de couverts.

## Rendu, contacts et cycle de vie

Les surfaces opaques compatibles reçoivent albédo, normales et rugosité locales. Les primitives statiques sont normalisées puis instanciées avec leurs dimensions, rotations, couleurs et transformations parentales. Les maillages directement manipulés par les mécanismes restent indépendants. Les petites parties éloignées sont filtrées par distance avec prise en compte des deux joueurs ; les portes éloignées sont également filtrées et leurs cadres sont regroupés par matériau. Les volumes physiques restent actifs hors caméra. La destruction ou la collecte d'un objet peut explicitement désactiver son contact.

Les petits détails, surfaces transparentes, objets en hauteur et accessoires intersectant les voies réservées ne sont pas automatiquement transformés en murs. Les couverts physiques générés sont donc conservateurs : tous les objets décoratifs ne constituent pas des couverts exacts. Les poses élevées utilisent des volumes avec une base verticale ; cela ne remplace pas un navmesh complet des passerelles.

Les effets temporisés utilisent le temps simulé du niveau et sont annulés au nettoyage. Les géométries et matériaux partagés sont libérés une seule fois, y compris après instancing et retrait d'un groupe. Les morts environnementales passent par le registre de mort du gestionnaire de horde ; elles n'attribuent pas automatiquement des éliminations au joueur.

## Prey

Sarii existe une seule fois. Le premier joueur peut lui donner les ordres suivre, tenir, protéger et se retirer. Il mord une cible hostile à la fois avec une cadence limitée, peut subir des blessures persistantes et se retire lorsqu'il est blessé. Le rejoindre ne fournit pas de munitions futuristes ni de score gratuit. Ce comportement reste une adaptation de compagnon, et son animation procédurale ne constitue pas une reconstitution des performances du chien à l'écran.

Le masque osseux montre trois rayons dirigés vers la cible capturée et arme le mécanisme du boss. Son activation ne retire aucun PV : seul un véritable projectile physique du Feral, redirigé puis entré en collision, peut le blesser. La branche associée au puma est un accessoire. Aucun puma animé ou doté d'une IA n'a été construit ; ce point reste partiel.

## Vérifications

Les tests construisent les 34 variantes, parcourent chaque segment de leurs routes, vérifient les sols et collisions, puis contrôlent le nettoyage des ressources. Les tests des onze biomes conservent leurs seuils de géométrie et de soumissions potentielles. Les tests supplémentaires contrôlent les poses instanciées, les couleurs, les parents mobiles, les contacts hors caméra, les portes réversibles, les temporisations et un accompagnant parcourant deux changements de direction. Les tests Prey contrôlent les ordres et blessures de Sarii, sa cadence à 30/60/120 Hz et l'absence de dégâts instantanés du masque.

Ces contrôles CPU ne constituent ni une mesure de fréquence d'affichage sur les machines des joueurs, ni cinq recettes humaines, ni une certification visuelle 1:1. La recette de rendu et le déploiement appartiennent à la validation globale de la branche.

## Complément : pont, transport et résidence GPU

LD-01 en mode fronts comporte désormais un pont tactique original sur le premier contournement. Deux rampes relient le sol à un tablier situé à Y3 ; le sol du couloir est réellement découpé sous la traversée. Les piétons utilisent sa hauteur continue, les rayons de combat rencontrent les triangles du tablier et des rampes, et un saut sous le tablier rencontre son plafond. `getElevationAt(x,z,currentY)` distingue le dessous de la surface supérieure ; l'argument de hauteur reste optionnel pour le placement initial. La navigation locale sépare ses grilles selon la couche de hauteur. Cela fournit une traversée verticale testée et ne généralise pas les étages à tous les accessoires hérités.

Le dispositif d'accès permet un sabotage de trois secondes ou une reconstruction de six secondes, interrompus si l'opérateur s'éloigne. La destruction ferme la route stratégique et interdit les nouveaux passages au bord de la fosse. Les acteurs présents au-dessus chutent avec une accélération vers le fond à Y−5, sans téléportation latérale ; une chute applique des dégâts. Un joueur dans la fosse conserve son saut pour en sortir. Les groupes des deux camps disposent du trajet principal restant ; une tentative de réouverture par un objectif est refusée tant que le pont reste détruit. Une reconstruction restaure les mêmes volumes et le même tracé. Les HP et la destruction sont sérialisables. Ce pont et sa reconstruction sont des mécanismes originaux de jeu.

`OperationTransport` réutilise le skimmer montable existant. L'assistance nécessite des fronts de départ, d'arrivée et de transit alliés, non contestés, reliés par des routes physiques ouvertes. Elle prévoit deux secondes d'embarquement puis déplace le véritable véhicule à vitesse bornée le long des couloirs ; le temps du combat continue. Un ennemi proche, une route fermée, la perte d'un front ou une intervention du pilote interrompt l'assistance à sa position courante. Le conducteur conserve le contrôle manuel. Les tests mesurent le temps, la distance parcourue et chaque pas : aucun déplacement direct entre les fronts n'est utilisé. Cette assistance n'est pas une reproduction d'un moyen de transport d'une œuvre précise.

`WorldGeometryStreaming` gère les buffers des zones proches des deux joueurs et conserve de l'avance sur la zone effectivement dessinée. Les zones lointaines déclenchent `BufferGeometry.dispose()` et, pour les matrices/couleurs des instances, `InstancedMesh.dispose()`. Three libère ainsi leurs allocations GPU. Les tableaux typés CPU restent intacts ; au retour, les mêmes attributs sont marqués pour un nouvel envoi avant le prochain dessin. Un objet partagé reste résident lorsqu'une autre zone proche en a besoin. Les matériaux, textures communes et frontières grossières restent partagés. Les contacts et le cycle de vie des mécanismes sont indépendants de cette résidence graphique.

Les tests contrôlent douze cycles d'éloignement/retour, l'identité des tableaux CPU, les événements de libération, la restauration des attributs, l'union des deux vues et la persistance d'un pont détruit. `getWorldStreamingStats()` expose des tailles de buffers CPU éligibles à un envoi GPU et des compteurs de libération/restauration. Ces valeurs ne mesurent pas la mémoire réelle du pilote graphique. La totalité du décor reste construite en mémoire CPU ; ce complément ne fournit pas de chargement réseau asynchrone des assets. Les coûts d'envoi et les temps de frame doivent être mesurés par la recette GPU globale.
