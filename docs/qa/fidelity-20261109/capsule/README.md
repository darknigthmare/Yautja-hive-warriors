# Capsule d’insertion — détails et articulation

Révision du modèle local à partir de `a8f9c759a30bc97c5400ce48709f6ad10856003d`, avec conservation du passage, du profil physique et de l’arrivée cachée. Les sources de conception disponibles sont `docs/INSERTION.md` et `docs/qa/insertion-reference-review.md` : elles définissent une interprétation originale de capsule Yautja. Aucune photographie vérifiée d’un accessoire de film ne certifie ici une fidélité 1:1. Aucun crédit Meshy n’a été dépensé.

## Changement visible

- Couronne en neuf panneaux de blindage épais, avec de vrais interstices sur une coque opaque continue, et un collier métallique ajusté.
- Cadres de verrouillage, inserts sombres opaques et boulons sur les deux portes ; joint souple derrière chaque lèvre, dans l’enveloppe existante.
- Deux vérins raccordés aux portes : fûts fixes, tiges qui coulissent, colliers et axes différenciés. Leur géométrie suit la rotation réelle des deux battants.
- Supports de charnières fixés par boulons, rembourrage segmenté dans le berceau, peinture mate, métal nu et matériau souple distincts. Les témoins ambrés baissent pendant l’ouverture.

Le module ne fournit pas de nouvel éclairage ponctuel ni de grande surface lumineuse. Il conserve ses deux battants opaques ; l’acteur reste occulté pendant l’arrivée et n’emprunte aucun trou ajouté pour le rendre visible.

## Mesures

| Donnée | Base mesurée | Révision |
| --- | ---: | ---: |
| Triangles par capsule | 43 504 | 63 808 |
| Meshes/draws de surface par capsule | 11 | 14 |
| Nouvelles géométries dynamiques | 0 | 1 |
| Capsules temporaires maximum en coop | 2 | 2 |
| Siège | `[0, 0, 0]` | identique |
| Sortie | `[0, 0, 4.2]` | identique |
| Profil de collision et axes des portes | base | identiques |
| Boîtes englobantes fermée et ouverte | base | identiques, composante par composante |

La hausse de 20 304 triangles (+46,7 %) est limitée aux deux capsules temporaires de la cinématique. Les surfaces statiques restent fusionnées par matériau ; les huit sections des deux vérins partagent un seul mesh et un seul buffer dynamique privé à chaque capsule. Les portes utilisent chacune un matériau souple supplémentaire. Le plafond retenu est de 65 000 triangles et 14 meshes par capsule. Ces comptes concernent les surfaces du modèle ; ils ne constituent pas une mesure des passes d’ombre ou des appels GPU de la scène entière.

Les positions et normales des vérins sont mises à jour seulement quand l’ouverture change. Aucun mesh, géométrie, matériau, tableau de suivi ou buffer d’instances n’est créé par mise à jour. La boîte de culling fixe contient tous leurs sommets sur 1 001 poses. Une mesure Node après échauffement donne environ 0,31 ms par mise à jour et par capsule ; elle exclut rendu WebGL, transfert GPU et reste de la scène. Il ne s’agit pas d’une garantie de temps d’image.

Les valeurs détaillées et les empreintes du fichier source figurent dans [baseline.json](baseline.json) et [final-model-metrics.json](final-model-metrics.json).

## Vérification

La commande suivante passe 25 tests ; la sortie brute est conservée dans [targeted-tests.txt](targeted-tests.txt).

```sh
node --test tests/insertion-pod-model.test.js tests/insertion-pod-detail.test.js tests/drop-pod-entrance.test.js tests/insertion-camera-collision.test.js
```

Les tests couvrent l’occultation du joueur à l’arrivée, le passage debout ouvert, le seuil à hauteur du sol, la séparation des deux capsules, les charnières fixes, les caméras d’insertion et la collision de canopée, l’annulation, le nettoyage, le fond opaque derrière les panneaux de couronne, les extrémités physiques des vérins, les normales, l’indépendance des buffers et la libération de chaque ressource possédée sans détruire les textures partagées. Aucun test de collision ou de visibilité existant n’a été assoupli.

La revue visuelle studio et en situation reste à rapprocher de ces mesures par l’agent principal : avant fermé, après fermé, trois quarts ouvert avec berceau et vérins visibles, puis ouverture réelle avec les deux caméras. Elle est nécessaire pour juger le bénéfice graphique des nouveaux panneaux et finitions ; les tests géométriques seuls ne prouvent pas la qualité visuelle.
