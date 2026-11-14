# Points ouverts du dépôt (v70)

> Relevé du 14 novembre 2026 dans les classeurs `docs/audits/`, mis à jour après l'automatisation des recettes P0 le même jour.
> Nature : **Code** (fonctionnalité ou bogue), **Obs** (observation en jeu, automatisable en partie), **Hum** (testeur humain), **Mat** (matériel réel), **Asset** (modèles), **Doc**.

## P0

Les preuves sont dans `docs/qa/recettes-20261114/` (un JSON par recette) et les tests dans `tests/recette-*.test.js`. Ce sont des tests sans rendu, en temps simulé et avec des graines fixes. Aucune vidéo n'a été produite : les revues visuelles demandées par le classeur restent ouvertes.

| ID | Sujet | Nature | État au 14 nov. |
|---|---|---|---|
| REC-001 | Trois fronts autonomes hors caméra pendant 20 min | Obs | Prouvé sans rendu. Reste la vidéo |
| REC-002 | Choix d'intervention et conséquences | Obs | Prouvé sans rendu. Renforts étalés par vagues (HW-DEC-91) |
| REC-003 | Alertes et délai de secours | Obs | Prouvé ; défaut corrigé : le passage coupé est annoncé |
| REC-004 | Conservation des effectifs | Obs | Prouvé, couvoir, extraction et civils compris (HW-DEC-90) |
| REC-005 | Bascule combat proche / simulation distante | Obs | Prouvé ; défaut corrigé : la bulle ne renouvelle plus ses groupes sous le joueur |
| REC-006 | Renforts physiques et réserves de ruche | Obs | Prouvé ; réserve d'adultes assumée comme adaptation (HW-DEC-89) |
| REC-007 | Compatibilité des factions par preset | Obs | Prouvé ; défaut corrigé : le mode hypothétique signale ses écarts |
| REC-008 | Personnages nommés et unicité | Obs + Hum | Prouvé sans rendu ; validation humaine à l'auteur |
| REC-010 | Ordres alliés | Obs | Prouvé ; défaut corrigé : un groupe à reconstituer ne compte plus comme garnison |
| REC-012 | Coutures et portes | Obs | Prouvé ; défaut corrigé : les routes de Lethe (AFF-14) passent par les portes |
| REC-016 | Sauvegarde d'une guerre répartie | Obs | Prouvé ; défaut corrigé : la reprise ne décale plus les groupes d'un pas |
| REC-019 | Boss dépendant de la bataille | Obs | Prouvé, conséquences locales ; AFF-14 n'appartient à aucun arc |
| REC-021 | Densité et performances sur matériel déclaré | Mat | À l'auteur |
| REC-022 | Profil faible capacité | Mat | À l'auteur |
| REC-023 | Deux joueurs sur deux fronts | Obs | Prouvé sans rendu ; reste la capture des deux vues |
| LOT-0 | Base unique et compilable | Doc | Atteint : une branche de référence, build réussi |
| LOT-1 | Bataille pilote persistante | Obs | Couvert par REC-001 et REC-016 |
| CTRL-001 | Synthétiques de combat d'AFF-16 | Obs | Prouvé : 192 `weyland_combat`, aucun humain |
| CTRL-002 | Working Joes d'AFF-13 | Obs | Prouvé : 32 `working_joe` |
| CTRL-082 | Rôles Extinction d'AFF-27 | Obs | Prouvé ; défaut corrigé : chaque place porte son profil HUM du catalogue |

### Ce que les recettes ont changé dans le jeu

- **Tir à distance concentré** (HW-DEC-92). Avec la même graine, sur 20 minutes : la ruche perdait 0 unité contre 48 pour les humains ; elle en perd maintenant 22, contre 43.
- **Renforts par vagues** (HW-DEC-91). Une perte est remplacée au rythme habituel ; sinon une vague part toutes les 45 s. Fermer une source tôt retient une vraie part des réserves.
- **Anciennes sauvegardes.** Trois variantes de reprise reconstruisent l'ancien effectif, l'ancien tracé des routes et l'ancien lien au catalogue. Les empreintes d'AFF-14 et d'AFF-27 d'avant ces changements sont reproduites à l'identique.

### Observations sans décision

- Avec les sauvegardes antérieures au 1er novembre, la reprise reconstruit encore les synthétiques d'AFF-13 et d'AFF-16 sous des profils humains (`legacyRoster`). Ce repli est volontaire.
- Le synthétique USCM d'Extinction est rendu avec le modèle `weyland_combat`.
- EFF-06 est porté par ADP-01, variante de trêve d'AFF-18. Elle s'ajoute hors catalogue aux 27 opérations de l'audit (HW-DEC-99). Ses survivants subissent de lourdes pertes à distance (88 sur 108 en 5 minutes avec la graine 0) : c'est à équilibrer en jeu.
- La cible EFF-07, 64 ennemis par bulle en coopération, n'est pas atteinte, à cause du plafond provisoire de 32 acteurs détaillés (contrat 2).

## P1 et P2

36 points « À valider » et 12 « En cours » de la feuille `Manquants`, 9 recettes P1, les lots 2 à 5 et des contrôles documentaires. Ceux que le code peut faire avancer : AUD-025, 026, 028, 060, 063, 090, 091, 103, 123 et CTRL-009, 010, 083, 084, 086. Les autres demandent des testeurs, du matériel réel ou des modèles.

## Règle de suivi

Selon `AGENTS.md`, seules les cellules `N7:N132` de la feuille `Manquants` peuvent être modifiées, par le writer du projet. Les recettes de la feuille `Validation` ne sont donc pas marquées dans le classeur : leurs preuves sont rangées dans `docs/qa/recettes-20261114/`.
