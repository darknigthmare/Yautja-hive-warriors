# Alliés Yautja — passe visuelle du 9 novembre 2026

Le garde de clan remplace le torse et les jambes génériques humains par une anatomie Yautja : crâne large, taille resserrée, cuisses puissantes, peau ocre marbrée, pectoraux/abdominaux sculptés dans une seule enveloppe continue, filet ajusté au tronc et aux cuisses, pieds à trois griffes, épaulière gauche en plaques, rotules carénées, gantelets et deux lames de poignet. Le biomask a un front large, des joues et une mâchoire effilée, des yeux opaques et des évents visibles devant la coque. Les 16 dreadlocks portent 48 bagues et ont des orientations indépendantes.

Il s'agit toujours du garde de clan original du jeu. Les [sources photographiques et leurs limites](references.json) guident l'anatomie ; elles ne certifient aucune reproduction 1:1 d'une tenue de film. Les 12 GLB existants, les incarnations nommées et les kits sources restent hors de ce changement. Aucun crédit de génération n'a été dépensé.

## Mesures de géométrie

Mesures Node sur la base `a8f9c75` puis les nouveaux modules, Three.js r160. Les triangles incluent toutes les instances de dreadlocks/bagues. Les buffers comptent positions, normales, UV, couleurs, indices, deux cibles de morphing et matrices d'instances ; les textures communes, les objets JS et le travail GPU sont exclus.

| Mesure par acteur | Avant | Après |
| --- | ---: | ---: |
| Triangles soumis | 42 680 | 46 616 |
| Meshes de dessin | 7 | 9 |
| Matériaux possédés | 7 | 7 |
| Buffers possédés, octets | 4 097 280 | 2 403 676 |
| Sommet Y | 4,092 | 4,100 |
| Pied le plus bas Y | 0,0117 | 0,0060 |
| Largeur conservatrice animée | 1,810 | 2,047 |
| Dreadlocks / bagues | 14 / 14 | 16 / 48 |

Les surfaces restent dans le budget existant de **54 000 triangles / 9 meshes**. La réindexation des sept lots de matériaux diminue les buffers malgré l'ajout du morphing. Le rayon physique demeure **1,3**, l'échelle racine **1,2** et le sommet **4,1**. Les boîtes de géométrie englobent les deux poses complètes ; elles n'ajoutent aucune collision. Reproduire : `node docs/qa/fidelity-20261109/yautja/measure.mjs`.

Un gabarit CPU constant contient uniquement neuf géométries (2 401 628 octets), sans `Mesh`, matériau, texture ni pose rendue retenus. Chaque matérialisation clone profondément positions, normales, couleurs, UV, indices et cibles de morphing ; les dreadlocks possèdent aussi leurs matrices privées. Détruire un acteur puis en récréer un ne modifie ni les buffers ni les matériaux d'un autre acteur. Les observations de construction Node sont consignées dans [construction.json](construction.json) ; elles ne mesurent pas le rendu GPU.

## Animation et propriété

La marche repose sur la distance X/Z réellement parcourue après navigation/formation/combat et après les dernières corrections physiques de l'environnement, de l'APC et de la capsule. Le hook `YautjaAlliesManager.updateVisuals(delta)` est appelé une fois à la fin de ces corrections dans la boucle principale. Un acteur repoussé par un APC ne déroule pas des pas imaginaires. Deux cibles GPU opposées déplacent uniquement les bras et jambes autour de leurs attaches locales ; elles ne déplacent jamais la racine. La longueur des pas est une adaptation visuelle, sans squelette de film ni cinématique inverse des pieds. Les dreadlocks utilisent deux `InstancedMesh` et des matrices indépendantes par acteur, sans simulation physique de mèches ni collision capillaire.

La pause (`delta <= 0`), la mise à terre et le rétablissement gèlent la pose. Le pivot `ally-rescue-posture` conserve sa propriété et sa rotation. Une téléportation de plus de trois unités réinitialise l'amplitude de marche sans fabriquer un long pas. Tous les buffers, matériaux et matrices d'instances sont possédés par chaque acteur ; seules les textures PBR existantes sont empruntées au cache commun. Aucun squelette, `boneTexture` ni matériau de profondeur supplémentaire n'est créé.

## Vérification

`node --test --test-concurrency=1 tests/clan-hunter-visual.test.js tests/clan-hunter-apc-integration.test.js tests/support-visual.test.js tests/ally-rescue.test.js tests/ally-rescue-ravager-checkpoint.test.js tests/battle-actor-bridge.test.js`

Les nouveaux tests vérifient le budget effectif des instances, les coordonnées finies, la mémoire des buffers, la hauteur et le contact au sol, la visibilité des yeux/évents par rayons, le déplacement réel, la propriété indépendante des poses, les attaches fixes des dreadlocks, l'absence de mouvement racine, la pause et la compatibilité du secours. Les tests existants couvrent le cycle de vie des appuis et la persistance médicale. Les 58 tests courants passent ; le résultat, le journal et les empreintes sources sont liés dans [validation.json](validation.json). Le [premier essai intermédiaire](validation-before-integration.json) conserve son échec initial du budget de la capsule, corrigé ensuite dans l'intégration.

La revue studio centrale R2 a accepté le thorax/abdomen continu, les rotules plates, le filet ajusté, les attaches moins coupées et les jambes/pieds complets (`/workspace/qa/fidelity-20261109/exploratory-r2/honor-guard-front.png` et `honor-guard-quarter.png`). Les captures de comparaison finales et la scène de jeu restent la responsabilité de la QA centrale. Ces contrôles Node ne constituent ni une mesure matérielle de performances ni une certification 1:1.
