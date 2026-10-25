# Masque Wolf : sculpture procédurale guidée par références

Le fallback Wolf utilise désormais une coque spécifique. Les autres masques et les GLB importés ne sont pas remplacés. Il s’agit d’une interprétation visuelle, sans scan du costume ni validation métrique 1:1.

## Références effectivement inspectées

Photos promotionnelles officielles du prototype **Prime 1 Studio REMAVP-01DXS**, Wolf Predator, *Aliens vs. Predator: Requiem* (2007), statue commerciale à l’échelle 1/3. [Page produit](https://www.prime1studio.com/avpr-wolf-predator/REMAVP-01DXS.html).

| Photo | Lecture retenue | SHA-256 du fichier inspecté |
| --- | --- | --- |
| [b158, trois quarts](https://www.prime1studio.com/on/demandware.static/-/Sites-p1s-master-catalog/default/dw4ddbdd58/images/REMAVP-01DXS/catalog/b158-FePJW4LO.jpg) | Dôme large, bord supérieur relevé, petits goujons, nez long et joues creuses. | `63d225cc160bb56fdbeb11951ddcafd8c28dc69fc139d607fb79f61c05f81c9f` |
| [b191, face presque frontale](https://www.prime1studio.com/on/demandware.static/-/Sites-p1s-master-catalog/default/dw8cb86be4/images/REMAVP-01DXS/catalog/b191-WfqrcV0J.jpg) | Couronne large avec cran central, six petits goujons visibles par bord, position des yeux dans la moitié inférieure du masque. | `00a7d5a2987a2544c6cdd07d9d600b3eff1ce9dcc107c0f10f678a08de44c8ac` |
| [b195, trois quarts rapproché](https://www.prime1studio.com/on/demandware.static/-/Sites-p1s-master-catalog/default/dwa4101f4f/images/REMAVP-01DXS/catalog/b195-5sime7UF.jpg) | Maillage des lentilles, arcade inclinée vers le pont central, rainures du museau et petites entailles du front. | `b43caba9d131c5841981bdadae3e0ff6be8c88febed70a4f3cf7d7756f5880bf` |
| [b196, face oblique opposée](https://www.prime1studio.com/on/demandware.static/-/Sites-p1s-master-catalog/default/dw47ca815c/images/REMAVP-01DXS/catalog/b196-emXxATFR.jpg) | Deux yeux distincts et opaques, creux sous-oculaires, nez trapézoïdal s’élargissant vers la base, gravures de joue. | `083d191a735e5f58e194090e36e370cbd43ae6d2ca065530e45ac813fa8d930e` |

Les fichiers inspectés se trouvent dans le dossier QA externe `qa/yautja-expansion-20261023/references/wolf_predator/originals/`. Les reflets cyan/blanc et les diodes photographiées sont des effets d’éclairage de la statue ; ils ne deviennent pas des lentilles émissives. Ces photos portées et en perspective ne permettent pas de mesurer l’intérieur, les fixations ou le profil orthographique exact. Les douze petits goujons du fallback suivent les deux bords visibles de la statue ; leur géométrie n’est pas une mesure du costume original.

## Changements contrôlables

`js/graphics/WolfBiomask.js` décrit la coque par dix sections et une sculpture continue : couronne large avec cran central, arcade, puits des yeux, joues creuses, flasques inférieures et arête nasale. Les lentilles en amande, leur grille métallique, le bord de couronne et les gravures se projettent sur les vrais triangles de la coque. Le masque générique et ses huit barres de ventilation sont retirés pour Wolf. Le matériau conserve les cartes PBR communes, avec une rugosité accrue et des normales plus présentes pour se rapprocher du métal patiné photographié.

Le module conserve le socket de tête `[0, 4.02, 0.02]`, une coque d’environ 0,60 unité de haut, les matériaux PBR existants et la visibilité de toute la tête en FPS. Le batching par matériau conserve 47 meshes sur le personnage de référence. Mesure avant les autres modifications concurrentes : **167 632 → 169 560 triangles**, dont 15 432 pour la nouvelle coque, les lentilles et leurs détails. Aucun crédit Meshy, aucun nouvel asset payant, aucune modification de GLB.

## Vérification

`node --test --test-concurrency=1 tests/wolf-biomask.test.js tests/hunter-visual.test.js` : 12 tests passent. Ils couvrent la silhouette couronne/mâchoire, la projection du nez, les deux lentilles et leurs écarts à la surface par raycast, les attributs UV/normales finis, le budget, les matériaux opaques non émissifs, la propriété des ressources, le socket et le masquage FPS. Les tests généraux conservent les proportions adultes et la géométrie des autres variantes.

La comparaison GPU est produite par le script QA externe `qa/development-20261025/wolf-biomask-next/capture.mjs`, avec source antérieure `8e343fa`, caméra et lumière identiques pour les vues face, trois quarts, profil et FPS. Les captures et `report.json` sont des preuves de rendu automatisées ; elles ne représentent pas des testeurs humains ni une certification 1:1.

La seconde revue IA indépendante accepte l’amélioration du fallback : arcade en V, lentilles maillées, museau plus compact et métal moins poli. Elle conserve des limites précises : le haut reste plus rectangulaire et vertical que sur certaines photos ; le museau est encore plus large et lisse ; le martelage, les piqûres et les griffures photographiées restent atténués. Le corps et la chevelure Wolf restent les versions procédurales existantes. Aucun écart bloquant nouveau n’a été relevé pour cette passe. La première itération GPU est conservée dans `iteration-1/` ; la capture finale correspond au SHA-256 `181c6eb69836c73c4bb289eb98d6ca0380532948b5297b6125960e1122d3423c` du module.
