# M577 — empreinte physique complète (novembre 2026)

L'ancien convoi validait le sol en 9 points, puis balayait ces 9 points
sur le pas. Un poteau au milieu d'une **maille** pouvait ne toucher aucun
point : le véhicule entier traversait donc un objet immobile.

`APCHullFootprint.js` ajoute une détection du chevauchement entre
l'enveloppe conservatrice réelle du M577 (`APC_NAVIGATION`, y compris
décalage du centre), des cylindres et des boîtes tournées déclarés
dans les colliders du terrain : projection sur quatre axes séparateurs.
Les tests de sol/rampe/porte, l'écologie, la coop et la vérification des
vagues Musou restent **inchangés** et continuent à s'exécuter pour chaque
pose et chaque pas.

Les collisions `navigationTest` spécifiques restent soumises à leur
prédicat de navigation ; la couverture totale des géométries
complexes par le maillage n'est pas revendiquée. C'est une
approximation de sécurité du gabarit, non une collision triangle-triangle
du prop cinématographique. Aucun nouveau soldat ni changement de
sauvegarde/roster.


La détection d'empreinte conservatrice **ne remplace jamais** les colliders à prédicat dynamique (`isNavigationActive` / `navigationTest`) : les ponts, portes et étages laissent la décision à leur système de navigation autoritaire. Un test vérifie qu'une porte ouverte n'est pas retransformée en obstacle solide par la nouvelle empreinte.
