# Branche publiée — 25 octobre 2026

Le travail validé est poussé sur [`codex/validated-gameplay-20261025`](https://github.com/darknigthmare/Yautja-hive-warriors/tree/codex/validated-gameplay-20261025). Le premier snapshot est `5e8c03a498dcbaff30d1b9c6de0a3a5d50f40da8` ; la même branche reçoit la reprise suivante après validation.

La passe de fidélité est poussée au commit [`447e5cc`](https://github.com/darknigthmare/Yautja-hive-warriors/commit/447e5cc083564ce942080d755607f8dc555146c5) : articulations City/Big Chap, masque Wolf, mécanisme M577, tests et comparaisons. Ses 386 tests CPU et 15 tests navigateur passent sur le build `cb19eded…`. L'[empreinte des sources gelées](qa/fidelity/frozen-source-v2.json) relie les 92 fichiers au build ; le [rapport de livraison](qa/fidelity-validation.json) suit séparément la publication Vercel.

Au début de cette reprise, `master` distant était à `f91562b86ef61c9ef7e65087b4beb109036f8dd8`, avec 26 commits supplémentaires par rapport à la base locale `54c5eeb`. La fusion simulée signale 21 conflits de contenu, notamment dans les niveaux, personnages, combat, audio et interface. Aucun push forcé ni remplacement de `master` n'a été effectué.

L'intégration de ces deux développements reste une opération distincte : elle doit préserver le contenu distant et les modèles, corrections et tests de cette branche. Le déploiement Vercel manuel utilise les octets du build vérifié et ne prouve pas qu'une fusion Git a eu lieu.
