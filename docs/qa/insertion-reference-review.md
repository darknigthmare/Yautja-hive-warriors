# Capsule et modèles — contrôle des références du 23 octobre 2026

Cette revue a été réalisée par un agent IA. Elle distingue les sources effectivement consultées des images indisponibles. Aucun testeur humain, scan du costume ou résultat de génération supplémentaire n'est déclaré.

## Capsule d'insertion

La recherche n'a pas permis de valider une série photographique ou un plan de capsule cinématographique. Les recherches Bing « Predator drop pod », « Predator escape pod » et « Yautja drop pod » ont retourné surtout des résultats génériques ; elles ne constituent pas des références de forme. Aucune image de capsule n'a été envoyée à Meshy.

Le nouveau modèle doit donc être présenté comme une **capsule d'insertion interprétée**. Les capsules individuelles d'AVP, le module d'évacuation de Wolf et les véhicules de Predators ne doivent pas être assimilés à un même objet. La fonction jouable — arrivée fermée, impact, ouverture articulée, sortie puis reprise des commandes — peut être vérifiée indépendamment d'une ressemblance au film. Une trappe, un siège, un vérin ou des panneaux ajoutés localement ne deviennent pas des détails canoniques par leur seule présence.

Points à contrôler sur les captures de la passe d'insertion : coque fermée pendant la descente ; absence de personnage affiché à l'extérieur avant l'arrivée ; continuité du mouvement de porte ; dégagement de la tête et des épaules ; seuil traversable ; pieds au sol ; absence d'intersection avec le second module en coopération ; retour des commandes après la sortie. Ce sont des critères de revue, pas des résultats préremplis.

Les nouvelles vues locales `pod-front.png` et `pod-quarter.png` dans `/workspace/qa/insertion-capsule-20261023/` ont ensuite été réellement ouvertes. Elles montrent une coque allongée continue, deux battants distincts, une cavité avec dossier et commandes, ainsi que des charnières visibles. Ces vues de modèle sans occupant établissent la lisibilité de ces éléments ; elles ne vérifient pas encore le passage du personnage ni l'animation dans la mission.

## Véhicules et provenance

Deux pages officielles NECA ont été consultées :

- [Blade Fighter — fiche produit](https://necaonline.com/2014/04/predator-vehicle-blade-fighter/) : décrit explicitement un hommage au jouet Kenner de 1993, un cockpit articulé, des canons sur rotules, des lames et armes amovibles.
- [Blade Fighter — présentation et emballage](https://necaonline.com/2014/12/closer-look-predator-blade-fighter-vehicle-and-packaging/) : confirme la commercialisation du véhicule et présente une galerie.

Les photos de ces pages sont servies par `eadn-wc04-13179453.nxedge.io`, hôte refusé par le proxy de cette session. Elles n'ont pas été ouvertes. Le texte confirme la provenance du produit, pas la silhouette exacte du skimmer du jeu. Les enrichissements locaux de cockpit, propulsion et panneaux restent une interprétation ; ils ne prouvent pas une correspondance au Blade Fighter ou à un vaisseau de film.

## Personnages : chantiers restant ouverts

La photo Prime 1 Studio City Hunter `mmpr-02uts_a08-01.jpg` et deux captures existantes du modèle corrigé ont été réellement ouvertes pendant cette revue. La source est la [statue MMPR-02UTS](https://www.prime1studio.com/pr2-city-hunter-predator/MMPR-02UTS.html), une interprétation commerciale à l'échelle 1/3. Le corps de la photo est complet et présente une pose asymétrique, une lance à gauche et les lames droites sorties. Cette photo ne renseigne pas les surfaces cachées ni le mouvement des mécanismes.

| Chantier | État constaté dans les fichiers et les preuves existantes | Travail restant pour une fidélité supérieure |
| --- | --- | --- |
| City Hunter, visage et proportions | Corps corrigé actif, textures PBR et biomask séparé ; les volumes ne sont pas un scan. | Comparaison de vues cohérentes du visage et du masque, puis sculpture mesurée des écarts. Ajouter des triangles seuls ne rétablit pas la forme. |
| City Hunter, dreadlocks | Deux mèches isolées ont des chaînes indépendantes. Le bouquet principal suit Head rigidement. | Séparer et vérifier les autres mèches, racines et collisions avant de leur attribuer des chaînes. |
| City Hunter, wristblades et gantelets | Lames encore fusionnées au bras et gantelets fixes. | Extraire des lames complètes, vérifier axes/course et surfaces cachées ; les fragments AutoSplit ne suffisent pas à certifier la rétraction. |
| City Hunter, locomotion | Les clips fournisseur sont conservés pour retouche et exclus de la lecture automatique ; petite amplitude visuelle et compensation du pied le plus bas. | Retouche d'animation et contact des pieds ; la compensation actuelle ne remplace pas une IK et ne supprime pas le glissement horizontal. |
| Jungle Hunter | Corps/masque intégrés ; prototype de deux pièces de cheveux décrit séparément. | Le prototype ne prouve pas l'articulation de toute la chevelure du personnage joué. Référence/poids/masque restent à contrôler par région. |
| Big Chap | Correction locale de poids active. Queue liée rigidement au bassin ; chevilles non indépendantes. | Rig/animation de queue et pieds ; les preuves existantes signalent encore une pénétration ponctuelle de queue dans le sol. |
| Wolf, Feral, Alpha, Samurai, Viking | Recherches de références et variantes procédurales ; pas de nouveaux corps photographiques générés dans cette passe. | Références cohérentes, découpe contrôlée, puis géométrie et articulation propres à chaque variante. |

Les détails ci-dessus sont corroborés par [CITY-HUNTER.md](../meshy/CITY-HUNTER.md), [le manifeste actif](../../js/graphics/GeneratedAssetManifest.js), [CityHunterRig.js](../../js/graphics/CityHunterRig.js) et [GRAPHICS.md](../../GRAPHICS.md). Les captures historiques examinées ne remplacent pas les nouvelles captures de la séquence d'insertion.

Aucune fidélité exacte « 1:1 » n'est validée par cette revue. Les nouveaux contrôles de fonctionnement et de rendu doivent être consignés avec leurs propres résultats.
