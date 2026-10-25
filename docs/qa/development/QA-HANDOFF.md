# QA de la reprise du 25 octobre 2026

Validation automatisée, revue d'images par agent IA. Aucun testeur humain, aucune certification de fidélité cinématographique 1:1 ou de fréquence d'images matérielle.

## Build local final

Index SHA-256 : `8683a627c08e1c2647913aa29dc375df8cdde08c69da18895981de2b5c5fae6f`.

- Suite navigateur complète : **15/15 PASS**, zéro échec, test ignoré ou annulation ; 599,7406 secondes. `final-browser-tests.log`.
- Le cas de mêlée/exécution vérifie désormais la mort effective du boss, la famille `queen` du trophée, la vraie victoire finale et la libération de toutes les ressources du trophée à la fin de mission.
- Harness détaillé : **PASS**, dix captures, zéro erreur JavaScript/shader/chargement et aucune requête externe. `runtime-report.json`.
- Comparatifs d'architecture finaux : **PASS**, quinze captures sur le même build. `after-report.json`. Caméras identiques au relevé initial pour les vues larges ; gros plans supplémentaires explicitement séparés.

## Vérifications du harness détaillé

Le parcours réel des toits complète les cinq secteurs précédant le boss final, avec cinq portes physiquement ouvertes ; ce biome ne figure pas dans la campagne de cinq cartes. L'inspection trouve les dix groupes d'architecture attendus, valide vingt-quatre apparitions hors obstacles, le détail autour des deux joueurs et la libération unique de quarante et une géométries au changement de carte.

Les projections City Hunter, Jungle Hunter et Wolf utilisent leurs vraies silhouettes, avec tête FPS restaurée et camouflage de la source préservé. Leurs positions, géométries, matériaux, squelettes et horloges restent indépendants. Expiration, pause, double destruction et retour au menu sont exercés dans la boucle du jeu. Les textures ne sont pas copiées. Le budget mesuré est de 310 789 triangles visibles et 29 624 868 octets de géométrie pour City ; 258 313 et 34 572 608 pour Jungle ; 165 236 et 15 940 608 pour Wolf. Il s'agit de copies privées de pose, pas de clips de marche inventés.

Une projection reste intacte quand son acteur source retire puis recharge son modèle importé ; ses trente-neuf géométries privées sont ensuite libérées exactement une fois. Deux projections issues de deux joueurs ont des ressources et horloges distinctes.

Le compte à rebours est comparé au vrai plan calibré de console City sous trois poses de bras et une échelle de 1,8. L'écart maximal vaut 2,98×10⁻¹⁵ unité du jeu. Les six secondes, la pause et la libération de quatre géométries, trois matériaux et une texture sont contrôlées. Un Yautja tombé en coopération ne peut pas créer de nouveau leurre ; son compte à rebours armé suit encore le HUD de 5 à 0 sans déplacer ni recharger l'acteur.

Le trophée royal suit la vraie main importée sans écart mesuré. Son expiration à 3,5 secondes et son nettoyage idempotent libèrent quatre géométries et trois matériaux. Les images vérifient aussi le camouflage après compilation du matériau opaque : versions de shader incrémentées, transparence réelle, puis retour opaque.

## Revue visuelle et essais conservés

`before-report.json` concerne la base `9fdd1916…` : onze vues et un ancien leurre de seulement deux maillages/144 triangles. Le champ `nuke.distance` compare l'origine du groupe de console, pas son plan calibré ; il ne faut pas le citer comme erreur d'ancrage.

V1 `2a7084a0…` a été refusé sur la densité visuelle : deux petits sites périphériques ne suffisaient pas à développer les grandes salles. Les images et rapports sont conservés dans `v1-2a708/`.

V2 `3c8739bf…` place quatre ensembles plus centraux. Le gros plan a révélé une boîte de collision rendue par erreur dans la pile de grumes ; ces images sont conservées dans `v2-3c8739/`.

V3 conserve les quatre ensembles, retire le rendu du proxy des grumes et utilise des bouts bois. La pile est à présent identifiable, et les derniers plans de forêt, ruche, temple et station ont été examinés. Le sol de combat reste Y0, les axes principaux et objectifs restent libres. Les détails, la topologie et les matériaux demeurent une modélisation locale ; l'ensemble ne reproduit pas intégralement les décors de films.

Le premier lancement du nouveau harness a été interrompu par un défaut de fixture : retourner `Promise.all` avec des adaptateurs Three.js complets dépassait la limite de chaîne de transport Playwright. `runtime-attempt1-transport.log` est conservé. Le harness attend désormais ces promesses sans retourner leurs objets. Aucune production ni assertion fonctionnelle n'a été modifiée pour cette correction.

## Publication

La base précédente `9fdd1916…` a passé un smoke HTTPS indépendant : `public-base/report.json`.

Le smoke HTTPS du build final `8683a627…` est **PASS**, avec trois captures : `public-final/report.json`. Il valide le vrai City Hunter et son masque, la descente cachée puis la sortie visible avec HP850/850, énergie100 et sept secondes de grâce. Le parcours physique atteint le quatrième territoire, ses quatre ensembles d'architecture et l'APC. La projection complète, le compte à rebours correctement ancré et le trophée royal s'affichent sur le site publié ; pause et nettoyage passent. Zéro erreur JavaScript/shader/CSP/chargement et aucune requête externe. Les captures de projection et de console ont été examinées. Les empreintes complètes des vingt-neuf fichiers publics sont vérifiées par l'agent de livraison, pas par ce harness.
