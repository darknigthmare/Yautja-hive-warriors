# Architecture des territoires et passages — 25 octobre 2026

Les six territoires reliés gardent leurs dimensions, leur progression et leur sol de combat à Y0. La reprise traite surtout les cinq territoires qui suivaient l'insertion : leur décor se limitait auparavant à quelques arbres ou quatre blocs répétés. Elle ajoute quatre ensembles de repères dans chaque territoire et habille les deux approches de chacun des cinq sas. Le décor d'insertion déjà détaillé est conservé.

## Repères selon le lieu et le rôle

- Forêt : abris de campagne sur poteaux, bâches à deux pans, caisses cerclées, équipement radio, antennes et atelier de grumes empilées. Le territoire final laisse apparaître la résine de la ruche.
- Jungle et temple : pylônes gravés, linteaux brisés, autels, atelier de pierre et masses de bastion plus hautes. Les détails utilisent les matériaux de pierre déjà présents ; les glyphes locaux ne prétendent pas reproduire une inscription du film.
- Ruche : noyaux de résine, conduits dorsaux, côtes courbes et couronnes plus hautes dans les territoires de commandement et du nid.
- Station et toits : bancs de machines à panneaux encastrés, évents, fixations, conduites, antennes de relais, pupitres et trois nacelles de confinement dans le territoire final. Ce sont des volumes de décor, pas des ennemis supplémentaires ou de nouvelles consoles interactives.

Les passages ajoutent poteaux, cadres, nervures de résine ou structures ouvertes selon le biome. Les drains et joints au sol indiquent leur direction. Les cadres se placent de part et d'autre du véritable sas ; ils ne remplacent ni sa barrière ni sa collision de progression.

Les anciens mâts répétitifs et les lignes de panneaux devenus redondants sont retirés des territoires qui possèdent quatre nouveaux ensembles. Dans la station, les petites pièces de drain des passages partagent la peinture de structure ; les bords et les signaux lumineux gardent leurs matériaux distincts. Le tas de grumes conserve un proxy physique sans boîte noire visible entre les troncs, et ses extrémités utilisent le matériau du bois.

Ces ensembles sont une conception locale adaptée aux biomes existants. Ils ne sont pas issus d'une génération payante, d'un scan d'accessoire ou d'une mesure géométrique 1:1.

## Circulation et volumes solides

Les positions sont déterministes : un repère par quadrant, vers ±25 unités du centre. Le repère proche d'un objectif peut glisser jusqu'à 36 unités ; aucun n'est relégué aux coins lointains. Chaque ensemble est agrandi d'un facteur uniforme de 1,2, avec un rayon réservé de onze unités. Il conserve les grandes voies cardinales à ±11 unités du centre ainsi qu'un rayon de dix unités autour de l'objectif. L'architecture est posée avant la végétation et les anciennes couvertures, qui évitent ses emprises au lieu de repousser les nouveaux ensembles hors du champ de jeu. Des pads très fins, culminant sous 0,004 unité, rendent leurs emprises lisibles sans créer de nouvel étage de déplacement.

Les volumes principaux et les poteaux sont enregistrés dans les collisions de l'environnement, avec leur orientation et leur échelle réelles. Une couverture surélevée n'est pas transformée en boîte pleine du sol jusqu'au toit : l'espace sous les abris reste libre entre les poteaux.

Le noyau de résine dépasse sa base rectangulaire. Il utilise donc sa véritable empreinte elliptique locale de 3,6 × 2,6 unités, avec la même échelle 1,2 que son rendu : la résolution physique calcule le contact entre le cercle de l'acteur et l'ellipse tournée. Le rectangle conservateur sert uniquement à l'évitement et aux apparitions. Il n'ajoute pas de mur invisible aux coins. Les acteurs au-dessus du volume restent libres.

Les petites nervures, fils, gravures et surfaces de toiture ne disposent pas chacun d'un obstacle. Aucun étage parcourable, escalier physique, intérieur habitable complet ou système de plafond n'est ajouté. La compensation de pieds existante reste donc compatible avec le plan de déplacement Y0.

## Ressources et visibilité

`buildBattlefieldSectorDetails(environment, sector, parent)` crée un groupe sous le territoire et retourne `null` pour l'insertion. `buildBattlefieldCorridorDetails(environment, corridor, parent)` crée le groupe de passage. Les deux fonctions sont idempotentes pour un parent donné.

Les noms stables sont `battlefield-sector-architecture-ID` et `battlefield-corridor-architecture-ID`. Leurs diagnostics contiennent le nombre de triangles, de lots de rendu, de pièces modelées et de collisions. Les surfaces sont regroupées par matériau, avec des UV proportionnels aux dimensions. Les cartes PBR locales sont réutilisées ; aucune requête externe n'est nécessaire.

Géométries et matériaux appartiennent aux registres de l'environnement et sont libérés à sa remise à zéro. Les repères suivent la visibilité de leur territoire ; les passages disposent d'un groupe séparé, visible à moins de 130 unités de l'un des joueurs. Les sols, les murs de progression et les sas restent gérés séparément. La coopération peut conserver deux lieux détaillés à la fois.

## Contrôles

Le lot ciblé de **26 cas** réussit : huit nouveaux contrôles d'architecture, les six parcours de carte existants et douze contrôles de décor et de ressources. Il vérifie notamment :

- quatre emplacements centraux, un par quadrant, des silhouettes variées, des attributs PBR finis et des géométries possédées ;
- voies cardinales et objectifs dégagés, trois lignes de déplacement dans les passages, orientation des structures et apparitions sûres ;
- contact elliptique avec la résine, absence de collision rectangulaire aux coins et liberté au-dessus du volume ;
- visibilité autour des deux joueurs, absence de duplication et libération exactement une fois lors d'une relance.

Les plafonds contrôlés sont de 14 000 triangles et six lots par territoire ajouté, 6 000 triangles et quatre lots par passage, et 100 000 triangles additionnels sur l'ensemble du réseau. Les budgets globaux existants restent respectés : moins de 500 000 triangles visibles, 1,2 million résidents et 230 soumissions potentielles dans les scènes de contrôle. Ces nombres ne constituent pas une mesure de fréquence d'images sur le matériel d'un joueur.

Le dernier lot vérifie aussi chaque territoire actif en solo puis en coopération avec un second lieu distant, avant d'ouvrir les barrières pour ne pas sous-compter leurs surfaces. Les maxima de scène partagée mesurés sont :

| Biome | Triangles visibles potentiels | Soumissions potentielles |
| --- | ---: | ---: |
| Forêt | 465 786 | 171 |
| Ruche | 110 598 | 225 |
| Temple | 67 406 | 221 |
| Toits | 89 150 | 199 |
| Jungle | 355 054 | 167 |
| Station | 115 454 | 229 |

Ces comptes ne sont pas les appels réellement soumis après culling de chaque caméra. Les [preuves CPU](qa/sector-architecture/validation.json) conservent le dernier lot de 26 réussites et distinguent les premières versions qui demandaient encore une reprise visuelle.

Les contrôles du build complet et les comparaisons de captures sont suivis séparément par la QA d'intégration. Aucun playtest humain ou rendu 1:1 n'est déclaré.
