# Pyramide de Bouvetøya : mise à jour (23 novembre 2026)

Demande de l’auteur : enrichir la pyramide antarctique (*Alien vs. Predator*, 2004) plutôt que créer un nouveau lieu.

## Ajouts

Ce sont des mécanismes qui existaient déjà dans le code, sans être construits ici.

| Mécanisme | Lien avec le film | Effet en jeu |
| --- | --- | --- |
| `buildShrineOfTheAncients` | chambre des armes Yautja | sanctuaire |
| `buildEggNurseries` | chambre sacrificielle où les œufs sont déposés | œufs |
| `buildQueenOvipositor` | la Reine enchaînée et son ovipositeur | frapper l’ovipositeur inflige 600 dégâts à la Reine et l’enrage |
| `buildLiquidNitrogenTanks` | la Reine tenue en sommeil cryogénique | cuves |

La pyramide gardait déjà ses murs modulaires, ses éléments sacrificiels, ses passerelles, ses portes blindées et ses évents.

La Reine passe aussi à 7 500 PV, décision d’équilibrage du même jour. Voir `docs/qa/boss-balance-20261123/`.

## Vérification

- **Suite Node complète** : 1 715 réussis, 0 échec, 1 ignoré. Cela inclut le budget de rendu de l’environnement, la navigation et l’emplacement du boss final.
- **Dans Chromium** :
  - chasse lancée depuis le menu, sans erreur de page ;
  - 184 appels de dessin à l’insertion ;
  - dans le secteur final, la Reine s’approche et frappe.
- **Capture** : `pyramid-insertion.jpg`, vue fixe.

La mise en scène et la fidélité restent des adaptations ; la topologie de la pyramide est propre au jeu.
