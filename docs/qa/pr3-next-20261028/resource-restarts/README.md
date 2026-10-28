Deux passes finales distinctes sont conservées sur le build 5089228 :

- **A : cinq échauffements + dix mesures — échec strict**, géométries GPU de 95 à 102. Voir [le constat original](final-5089228/README.md). Ses preuves restent intactes.
- **B : protocole historique vingt échauffements + dix mesures 21–30 — réussite dans cette fenêtre**, GPU 115/50/17 stables, six textures partagées intactes, références joueur libérées. Voir [le comparatif](historical20-5089228/README.md) et [les données A/B](historical20-5089228/comparison.json).

La trace B observe les premiers uploads de géométries LOD retenues en cache ; la cause exacte des sept buffers A reste non établie. Les snapshots 20/30 B gardent les comptes Three strictement identiques et aucun Player ; le heap GC croît encore de 400 124 octets. Aucune absence générale de fuite ou stabilité après cinq échauffements n’est certifiée. Les deux navigateurs et serveurs sont fermés. Aucun cache n’a été vidé, aucun compteur, HP, budget ou spawn forcé, aucune source runtime modifiée. Le RNG natif est conservé.

La préparation CPU originale (9 tests réussis) reste dans [preparation-README.md](preparation-README.md). Les arguments --expected-index et --expected-source du harness restent obligatoires, sans ancien pin par défaut.
