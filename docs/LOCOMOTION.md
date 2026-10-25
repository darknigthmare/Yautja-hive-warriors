# Locomotion du joueur — 24 octobre 2026

La phase des jambes utilise maintenant la distance réellement parcourue après résolution des collisions. L'ancienne oscillation `Date.now()` et le retour au repos multiplié par `0.8` à chaque image ont été supprimés. La marche ne change donc pas de phase pendant une pause et un joueur bloqué contre une paroi ne continue pas à courir sur place. Les transitions vers la marche, la course et le repos sont amorties en secondes de simulation. La rotation vers la direction demandée utilise également un amortissement exponentiel, sans dépassement de la cible à faible fréquence d'images.

Les bras accompagnent les pas tant que leur pose est libre. Une attaque, une parade, une exécution ou un gadget qui écrit sa propre pose garde la priorité ; le contrôleur ne supprime que sa propre contribution précédente. Les deux joueurs ont des états, phases et poses indépendants.

## Contact visuel du modèle procédural

L'anatomie procédurale est regroupée sous `procedural-hunter-visual`, avec le même acteur physique et les mêmes coordonnées de collision. Un contour convexe Y/Z est mesuré sur les véritables sommets de chaque jambe rigide. Après la pose, son support le plus bas détermine uniquement la hauteur du groupe visuel. Les sommets, triangles, UV, normales et matières restent inchangés.

Le déplacement visuel est borné à ±0,15 unité ; une pose hors du domaine mesuré est refusée. Le laser et la hauteur de vue suivent le même décalage. Le contrôleur ne compense pas les personnages en l'air ou perchés. Il s'agit du contact de la semelle la plus basse, **pas d'une IK des deux pieds** : les jambes procédurales restent rigides, sans nouveau genou articulé, et le glissement horizontal des pieds n'est pas corrigé.

## Modèles importés

Le groupe procédural revient à Y0 lorsqu'un corps importé est actif. Les commandes de jambes et de bras sont propagées au squelette existant ; la calibration, les matériaux et les poses de repos des GLB ne sont pas réécrits. City Hunter conserve son gain de mouvement de 20 % et sa compensation de semelle mesurée. Les clips fournisseur précédemment rejetés restent exclus : cette passe n'introduit pas une lecture de marche/course incompatible avec le corps corrigé.

Un reset de locomotion lors du transfert des commandes après insertion empêche de compter le déplacement cinématique comme des pas. Le laser importé conserve sa hauteur calibrée, augmentée de son décalage de contact actuel, pendant ce reset.

Le suivi de la caméra FPS utilise aussi un amortissement exponentiel. Son ancien coefficient `15 × delta` dépassait 1 à faible fréquence d'images et pouvait faire osciller la vue de part et d'autre de la tête. Le contrôle réel à 10, 30, 60 et 120 images par seconde vérifie une cible stable, aucun dépassement et la même convergence après une seconde.

## Contrôles

`tests/hunter-locomotion.test.js` couvre 30, 60 et 120 images/seconde, l'absence de lecture de l'horloge murale, le temps nul/invalide, les collisions qui annulent un déplacement, les téléportations, l'amortissement, la priorité des poses de combat, les deux joueurs et le reset. Un vrai modèle procédural Wolf est échantillonné sur 90 poses : les semelles sont mesurées sur leurs sommets exacts, l'acteur physique reste à Y0 et le laser suit la tête rendue. Les rotations de direction sont comparées aux trois fréquences.

La passe ciblée de 60 cas inclut également les corps, masques, imports, variantes, lasers et capsules ; elle a réussi. Les huit cas de locomotion et la sentinelle du reset importé ont été réexécutés après les derniers ajustements. La régression complète et les contrôles navigateur du build de livraison sont consignés séparément par l'intégration. Aucun playtest humain, performance matérielle garantie ou fidélité cinématographique 1:1 n'est déclaré.
