# Ressources et mémoire après les relances — 28 octobre 2026

Le contrôle a identifié deux causes distinctes : un délai du programme de test qui n’était jamais annulé, et une liste de joueurs conservée par la horde après leur nettoyage. Le correctif du jeu vide `_livingPlayers` dans `XenomorphHorde.clearWave()`. Le test couvre les références de deux joueurs, le nettoyage répété et le remplacement par les seuls joueurs de la nouvelle session ; les sept tests ciblés passent.

## Effet du programme de test

L’ancien test lançait pour chaque attente d’assets un `Promise.race` avec un délai de 120 secondes. Le délai continuait à vivre après le chargement. La première recette entière durait 83 secondes : ses douze délais étaient donc encore présents aux mesures.

Une ablation sur le build historique a reproduit douze cycles, puis annulé uniquement ces délais. Le heap JavaScript après GC est passé immédiatement de **17 567 156 à 16 429 036 octets**, soit **1 138 120 octets libérés**. Les dix cycles suivants annulaient leur délai dans un `finally`. Le rapport conserve les mesures de chaque phase. Ce résultat explique une partie de la hausse observée sans l’attribuer arbitrairement au jeu.

## Correctif et contrôle des ressources

Un build diagnostique isolé reprend exactement le runtime `48b5bd5` et ajoute uniquement les trois lignes de libération du cache de joueurs. Son `sourceCommit` est nul : il ne constitue pas un artefact publiable. Le dossier `isolated-patch.json` décrit précisément le delta. Le build intégré de la nouvelle branche doit encore recevoir sa validation finale par le coordinateur.

La recette corrigée effectue vingt préchauffages puis dix relances mesurées de la même configuration City Hunter / Los Angeles / un adversaire. La caméra de mesure est fixe ; le RNG reste natif. L’insertion est avancée par pas de simulation, les personnages sont réellement rendus et le retour au menu utilise la vraie méthode du jeu. Aucun dégât, compteur d’acteurs ou résultat de mission n’est forcé.

Les dix nettoyages donnent tous **110 géométries GPU, 50 textures GPU, 17 programmes et 12 enfants de scène**. La horde ne conserve plus aucun joueur. Les six textures partagées du modèle importé ont les mêmes UUID sur les dix cycles ; elles gardent des dimensions positives, restent chargées pour le rendu et n’ont reçu aucun événement de libération. Les chiffres de géométrie ne se comparent pas directement à la première recette : le préchauffage et la caméra sont différents.

Deux snapshots V8 après nettoyage, aux cycles 20 et 30, donnent exactement les mêmes effectifs d’objets Three encore atteignables : 810 Object3D, 456 Mesh, 290 Bone, 164 Material, 61 Texture, 352 BufferGeometry, 1 601 BufferAttribute et 46 structures de squelette. Aucun objet ayant les propriétés d’un Player ne reste présent dans ces snapshots. Les caches partagés sont inclus.

Le heap total n’est pas parfaitement constant : il passe de **16 367 128 à 16 851 760 octets** entre les dix relances mesurées. Les tailles propres supplémentaires des snapshots concernent surtout le code compilé et les métadonnées natives V8 ; cette observation ne démontre pas l’absence de toute fuite. Les compteurs de rendu ne mesurent ni la VRAM du pilote, ni les performances des machines des joueurs. Aucun test humain ou certificat visuel 1:1 n’est revendiqué.

## Preuves

- `analysis.json` : bilan borné, empreintes et assertions.
- `timer-ablation/report.json` : annulation des délais sur le build historique.
- `cache-release-corrected/report.json` et `harness.mjs` : trente relances et propriétés des textures.
- `heap-summary.json` et `structural-heap-counts.json` : synthèses des snapshots ; les gros fichiers bruts restent sous `/workspace/qa/pr3-20261028/memory-residency/`.
- `cache-release-tests.txt` : sept contrôles ciblés passés.
- `original-build-restoration.json` : traçabilité d’une erreur de répertoire de build. Seul le manifeste du build original avait changé ; il a été restauré immédiatement depuis le stage. Les trente fichiers originaux ont ensuite été vérifiés identiques, sans publication.

Les anciens rapports du 26 octobre sont préservés. Les nouvelles preuves ne doivent pas être présentées comme une exécution de la branche intégrée finale.
