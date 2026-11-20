# Terrains, accès verticaux et résidence des buffers — 28 octobre 2026

Les 34 propositions de cartes acceptent désormais `mapSeed`, un entier non signé sur 32 bits. La valeur zéro conserve le tracé historique. Les autres graines changent les distances entre colonnes et rangées ; les connexions restent orthogonales et leurs couloirs demeurent physiques. L’ancre d’insertion `[0,0]`, les identifiants de secteurs, portes et fronts restent stables. `layout.mapSeed` et `layout.generation` décrivent la génération. Le checkpoint doit conserver cette graine et la fournir aussi bien à la scène stratégique qu’au constructeur du décor. Les coordonnées et plans restent des constructions originales en unités de jeu, sans conformité géographique 1:1 certifiée.

## Surfaces et accès

`ReferenceWalkSurfaces` enregistre explicitement les tabliers, les rampes industrielles, l’héliport et les passerelles de résine. Les triangles rendus servent aux rayons, aux plafonds et à la mesure des pieds. Les anciennes rampes inclinées étaient trop courtes pour atteindre leurs hauteurs annoncées ; leur géométrie est désormais un volume fermé dont les sommets correspondent à la fonction d’élévation.

`getElevationAt(x,z,currentY)` conserve le personnage sous un tablier lorsqu’il est au sol. `getPlacementElevationAt(x,z)` choisit le sol réel ou une surface explicitement enregistrée pour les placements initiaux ; il écarte les anciennes hauteurs nominales de perchoirs décoratifs sans accès validé. L’insertion doit placer la capsule et son occupant à la même altitude. L’héliport solide dispose de quatre accès physiques pour relier les chemins cardinaux de son secteur. Les passerelles de résine ont été décalées hors de l’espace d’insertion et du circuit de circulation réservé de rayon 28 ; elles disposent de deux accès et leur intersection conserve un trajet sur le tablier.

`getVerticalNavigationTarget(position,target)` fournit le pied ou le sommet d’un accès nécessaire. La position réelle de la cible reste nécessaire pour la portée et la visibilité des attaques. Le Marine utilise une portée 3D et cette cible de déplacement lorsqu’il doit rejoindre l’étage. Les accès comportent une approche latérale : une unité qui se trouve sous le tablier contourne le dessous de la rampe avant d’y monter.

`resolveAgentMovement(position,target,stepDistance,radius,previousPosition?)` conserve le pas réel et ajuste les pieds sur les surfaces parcourues. Le dernier argument évite une estimation de l’origine quand le gestionnaire a déjà avancé vers un waypoint. `resolveMovement(position,radius,bodyHeight)` accepte une hauteur de corps explicite ; les anciens appels conservent la valeur historique par défaut. `resolveVerticalMovement` traite le plafond des surfaces enregistrées. Les états aériens continuent d’appartenir au contrôleur du personnage.

La circulation centrale des cartes à secteurs dispose aussi d’un caillebotis physique au-dessus de chaque tranchée d’acide. Les six grilles de ce contexte ont leur altitude supérieure mesurée à 0,355. Les unités au sol planifient leur franchissement avant de tomber dans les fosses ; les intersections avec leurs rectangles de danger sont calculées sur le segment complet pour éviter les oscillations à leurs angles. Les grilles de navigation sont séparées par altitude et mode d’accès, avec un maximum de 32 en cache. Les poteaux décoratifs de corridors s’écartent également des itinéraires principaux ou tactiques qui les croisent.

Il ne s’agit pas d’un navmesh universel de tous les accessoires hérités. Les perchoirs et décors non enregistrés restent sujets à leur validation individuelle. Les volumes de navigation, de caméra et les dimensions des modèles ne deviennent pas des mesures de costumes ou de plateaux de tournage.

## Guidage et Stargazer

Les passages principaux reçoivent des chevrons simples et les contournements des chevrons appariés. Ces tracés sont de vrais maillages dans le décor, projetés sur la surface, avec une seule soumission supplémentaire. Ils restent indépendants des marqueurs de l’interface. Leurs différences de forme ne dépendent pas uniquement de la couleur. La compréhension par des joueurs sans aide n’est pas certifiée par les tests CPU.

Le dôme Stargazer de l’ancienne petite arène appliquait une projection radiale à tous les acteurs situés au-delà de 41,5 unités, ramenant les fronts distants dans la zone d’insertion. Cette clôture globale est désormais désactivée et masquée dans les cartes à secteurs. Les frontières physiques de leurs salles et corridors restent actives. Le comportement de confinement est conservé pour l’ancien contexte autonome ; sa présence ne prétend pas établir l’existence d’un tel dispositif dans l’œuvre.

## Streaming

Les ressources hors des zones des deux joueurs sont libérées avec leurs allocations Three, en conservant les mêmes tableaux CPU. Le travail de restauration en avance sur la vue respecte un budget par appel (2 MiB par défaut). Une surface déjà nécessaire à une vue est restaurée immédiatement, même si cela dépasse ce budget ; les octets de cette exception sont comptés séparément pour ne jamais cacher l’absence d’un sol.

Les statistiques exposent les ressources en attente, les octets préparés, le travail obligatoire et les durées CPU des mises à jour. Il s’agit de préparation des attributs et d’éligibilité à l’envoi GPU ; le pilote réalise l’envoi au rendu. Ces valeurs ne mesurent pas la VRAM réelle et ne prouvent pas une absence de pause sur les appareils des joueurs.

## Preuves

Les nouveaux tests exécutent 68 constructions physiques (deux graines par carte), parcourent les routes, vérifient les ancrages et le nettoyage, puis contrôlent la montée et la descente d’un vrai acteur USCM, les plafonds, les couches de hauteur et les contacts après masquage au rendu. Le parcours de trois zones puis retour conserve un pont détruit et un secteur terminé. Des tests séparés imposent un budget de restauration nul pour vérifier que le préchargement attend, mais que les deux vues obtiennent immédiatement leurs surfaces.

Les journaux et leur portée sont conservés dans `docs/qa/pr3-next-20261028/world-depth/`. Aucun navigateur, testeur humain ou matériel GPU n’a été utilisé pour ces preuves CPU. La recette intégrée de la nouvelle version doit encore contrôler les scènes rendues et le franchissement des zones.
