# Points ouverts du dépôt (v70)

> Relevé du 14 novembre 2026 dans les classeurs `docs/audits/`. Nature : **Code** (fonctionnalité ou bogue), **Obs** (observation en jeu, automatisable en partie), **Hum** (testeur humain), **Mat** (matériel réel), **Asset** (modèles), **Doc**.

## P0

| ID | Sujet | Nature | Plan (HW-DEC-88) |
|---|---|---|---|
| REC-001 | Trois fronts autonomes hors caméra pendant 20 min | Obs | Preuve automatisée |
| REC-002 | Choix d'intervention et conséquences | Obs | Preuve automatisée |
| REC-003 | Alertes et délai de secours | Obs | Preuve automatisée |
| REC-004 | Conservation des effectifs | Obs | Preuve automatisée |
| REC-005 | Bascule combat proche / simulation distante | Obs | Preuve automatisée |
| REC-006 | Renforts physiques et réserves de ruche | Obs | Preuve automatisée |
| REC-007 | Compatibilité des factions par preset | Obs | Preuve automatisée |
| REC-008 | Personnages nommés et unicité | Obs + Hum | Preuve automatisée ; validation humaine à l'auteur |
| REC-010 | Ordres alliés | Obs | Preuve automatisée |
| REC-012 | Coutures et portes | Obs | Preuve automatisée |
| REC-016 | Sauvegarde d'une guerre répartie | Obs | Preuve automatisée |
| REC-019 | Boss dépendant de la bataille | Obs | Preuve automatisée |
| REC-021 | Densité et performances sur matériel déclaré | Mat | À l'auteur |
| REC-022 | Profil faible capacité | Mat | À l'auteur |
| REC-023 | Deux joueurs sur deux fronts | Obs | Preuve automatisée |
| LOT-0 | Base unique et compilable | Doc | Constater |
| LOT-1 | Bataille pilote persistante | Obs | Couvert par REC-001 |
| CTRL-001, 002, 082 | Synthétiques et rôles Extinction remplacés par des humains | Obs | Vérification en mission |

## P1 et P2

36 points « À valider » et 12 « En cours » de la feuille `Manquants`, 9 recettes P1, les lots 2 à 5 et des contrôles documentaires. Ceux que le code peut faire avancer : AUD-025, 026, 028, 060, 063, 090, 091, 103, 123 et CTRL-009, 010, 083, 084, 086. Les autres demandent des testeurs, du matériel réel ou des modèles.

## Règle de suivi

Selon `AGENTS.md`, seules les cellules `N7:N132` de la feuille `Manquants` peuvent être modifiées, par le writer du projet. Les recettes de la feuille `Validation` ne sont donc pas marquées dans le classeur : leurs preuves sont rangées dans `docs/qa/recettes-20261114/`.
