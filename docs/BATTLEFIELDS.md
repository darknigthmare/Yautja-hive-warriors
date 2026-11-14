# Champs de bataille à secteurs — 24 octobre 2026

Les six biomes conservent leurs identifiants de sauvegarde. En chasse et en campagne, chacun contient maintenant six territoires de 132 × 132 unités reliés par cinq passages de 18 unités de large. L’empreinte mesure 302 × 642 unités, ou 642 × 302 selon le biome, contre 132 × 132 auparavant. Les coordonnées désignent les unités du jeu ; elles ne prouvent pas une échelle physique du monde réel. Le mode arène personnalisée conserve son terrain libre sans verrouillage de progression.

Le parcours alterne les directions et les lieux : insertion, avant-poste, relais, atelier ou ruines, poste de commandement et nid final. Les orientations et les noms changent entre forêt, jungle, ruche, temple, toits et station. Les sorties sont réellement ouvertes dans les murs : les passages ne traversent pas une ancienne clôture invisible. Les cartes comportent des repères, de la couverture et des matériaux PBR adaptés au biome.

| Territoire | Déblocage du passage suivant |
| --- | --- |
| Insertion | Éliminer 12 ennemis dans la zone. |
| Avant-poste | Vaincre le commandant. |
| Relais | Activer le mécanisme indiqué, puis repousser sa contre-attaque de 8 à 12 ennemis. |
| Atelier / ruines | Éliminer 30 ennemis dans la zone. |
| Commandement | Vaincre le gardien. |
| Nid final | Vaincre le boss pour terminer. |

Les sas fermés ont une barrière visible et une collision. Le saut et le véhicule ne permettent pas de contourner un territoire verrouillé. L’ouverture enlève la barrière et son obstacle ; le portique reste un repère. Les marqueurs des territoires terminés deviennent verts. Le relais dispose d’une console et d’un anneau au véritable emplacement de l’action.

L'activation du relais ne termine plus instantanément son secteur. Avant l'action, le HUD annonce la contre-attaque et son quota ; après l'action, il affiche les éliminations restantes. Les défenseurs déjà présents restent sur place et des renforts sont ajoutés à leur file, avec au moins trois secondes de préavis, puis au rythme existant de quatre arrivées par lot. Il ne s'agit pas d'une nouvelle vague apparue au contact du joueur : les positions sûres, les tours d'attaque et les protections du directeur de combat restent appliqués.

Les six mécanismes varient avec leur lieu : transmission de surveillance en forêt, radio du camp en jungle, surcharge synaptique dans la ruche, glyphes du temple, relais des terrasses ou alimentation du sas. Leurs positions sont propres au biome et suivent sa rotation réelle. La défense demande huit éliminations en forêt et sur les toits, dix en jungle et au temple, douze dans la ruche et la station. Seules les éliminations postérieures à l'activation comptent ; un ennemi connu du secteur reste crédité lorsqu'il est attiré dans un couloir, pour éviter de rendre le quota impossible. L'action ne se répète pas et la file résiduelle est annulée dès l'objectif accompli.

Les renforts du relais excluent les facehuggers, qui peuvent disparaître après une accroche sans être comptés comme une élimination. Les vagues ordinaires gardent cette variété. Si une vague est entièrement épuisée avant un quota d'éliminations, le jeu ajoute seulement l'opposition manquante, avec le même préavis et la même cadence. Aucun point n'est attribué automatiquement et une file encore présente n'est pas réapprovisionnée en boucle.

Le mécanisme possède un meuble réel avec collision, une face de commande, des fixations, des antennes et douze segments de progression au sol. Le modèle utilise des pièces industrielles, des côtes organiques ou un autel suivant le biome. Les états attente, contre-attaque et secteur sécurisé pilotent ensemble l'écran, les voyants, l'anneau et le HUD. L'approche d'interaction reste libre devant le meuble ; sa collision n'occupe pas tout l'anneau.

Le quatrième territoire accueille désormais un [APC M577 de soutien](APC.md). Sa position est résolue contre le décor et les alliés sont replacés hors de sa coque avant leur première image. Ennemis et joueurs rencontrent le même véhicule solide, tandis que la navigation conserve une marge pour le contourner.

Le sol principal reste à Y = 0, comme la surface de déplacement. Les petites irrégularités sont rendues par les normales PBR. Les murs des secteurs et des couloirs portent des UV calculés en unités du monde pour éviter l’étirement d’une seule texture sur une grande longueur.

Les nouveaux territoires partagent leurs géométries et utilisent des instances pour les arbres, les fougères et les éléments de couverture. Le détail s’active à proximité de chaque joueur ; les sols, les limites et les portiques du réseau restent présents. Il ne s’agit pas de multiplier six fois tout le décor initial. En coopération, les deux positions sont prises en compte.

Le schéma est défini dans `js/data/BattlefieldLayouts.js`. `EnvironmentManager` fournit notamment `getSectorAt`, `getSpawnPoint`, `openGate`, `isGateOpen`, `completeSector` et `updateBattlefieldVisibility`. Les nouvelles apparitions sont choisies dans le territoire courant, loin du joueur et hors des obstacles, y compris les boîtes tournées.

La vérification CPU initiale des niveaux du 23 octobre comptait **31 tests réussis** : six parcours complets, portes fermées et ouvertes, impossibilité de contourner les sas par saut, traversée continue des couloirs, apparitions sûres, détails autour des deux joueurs, remise à zéro et contrôles antérieurs des biomes. La passe relais du 24 octobre ajoute les contrôles d'activation, de quota, de coopération et de renforts progressifs ; son lot ciblé de **38 tests** réussit, incluant un combat réel de la horde qui gagne le passage par ses notifications de mort. Les tests de budget comptent les surfaces effectivement visibles tout en conservant un plafond sur l’ensemble du réseau résident. Ces nombres ne constituent pas une mesure d’images par seconde sur une carte graphique réelle ; les contrôles navigateur et la publication sont suivis séparément.
