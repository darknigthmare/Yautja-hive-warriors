# Diagnostic de la capture R3 : Carrier retiré du détail

Le cas rendu R3 sur le runtime `94630d8` observe huit secondes de `Game.update`, mais seulement quatorze requêtes de lancement. Toutes sont refusées pour `target_outside_carrier_arc` : la distance passe de 39,1307 à 37,5057 unités. Le rapport ne conserve ni le temps de chaque requête ni l'état final de projection du Carrier. Il ne permet donc pas, seul, d'attribuer ce faible déplacement à un blocage de navigation.

La préparation matérialise le groupe depuis le joueur `[63.2284, 0, 1.1481]`, puis déplace le joueur à `[-2.5, 0, 0]`, près du centre de sa consigne `[-7.5, 0]`. La physique observée place ensuite ce joueur à `[-2.9652, 0, 0.2622]`. Le Carrier commence à `[36.1213, 0, 2.1213]`.

La [reproduction isolée du sélecteur](r3-selection-diagnostic.json), avec la vraie `BattleSimulation` et les positions R3, retrouve les mêmes dix-huit unités actives et les mêmes trois groupes à `t=0,25`. Le Carrier est dématérialisé au pas suivant, `t=0,5`, et reste distant jusqu'à `t=8,25`. Ses six passagers et les 952 identités sont conservés. Les quatorze premières images de Horde avant ce prochain pas de simulation correspondent précisément à la faible distance observée. La politique de détail réévalue les groupes par proximité au joueur et plafond de faction/global ; la téléportation de préparation change cette sélection.

Ce diagnostic emploie des callbacks qui enregistrent les groupes choisis sans construire de meshes. Il isole la sélection autoritative ; il ne prétend pas reconstituer la géométrie, les tirs ou le combat de la capture rendue. Le journal rendu du prochain essai doit également relever la présence du mesh, son UUID, l'état de l'unité et `group.materialized` pour confirmer sa trajectoire effective.

La [recherche de 144 positions](r3-player-candidate-diagnostic.json) conserve la même simulation, les limites de consigne et les budgets. Les candidats suivants gardent le Carrier détaillé pendant les 32 pas de sélection couvrant huit secondes :

| Position du joueur | Distance initiale au Carrier | Distance au centre tactique |
| --- | ---: | ---: |
| `[15.5, 0, 0]` | 20,7301 | 23 |
| `[14.7163, 0, 5.9528]` | 21,7452 | 23 |
| `[13.5, 0, 0]` | 22,7206 | 21 |
| `[14.7163, 0, -5.9528]` | 22,8772 | 23 |

Ces positions ne sont utilisables dans le helper rendu qu'après validation de la navigation, du sol, des collisions et de la ligne de vue de la vraie carte. Trier les candidats physiquement valides par proximité au Carrier permet de l'observer dans sa zone défendue. Il n'est pas nécessaire d'élargir sa portée, de changer l'allocateur, de déplacer les PNJ ou d'allonger arbitrairement la durée du test.

Les scripts de reproduction sont [diagnose-r3-selection.mjs](diagnose-r3-selection.mjs) et [diagnose-r3-candidates.mjs](diagnose-r3-candidates.mjs). Aucun navigateur, build ou changement du runtime n'est exécuté par ce diagnostic. R3 demeure une exécution négative conservée ; un éventuel essai ultérieur constitue une preuve distincte.
