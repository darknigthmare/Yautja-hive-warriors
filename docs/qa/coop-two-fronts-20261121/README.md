# Coopération sur deux fronts (AUD-108) : correction du 21 novembre 2026

Critère d'AUD-108 : J1 et J2 peuvent combattre sur deux fronts, avec des menaces équitables, des objectifs partagés et un budget mesuré.

## Défaut reproduit

Scénario mesuré directement sur `BattleSimulation`, avec la vraie configuration de chaque opération (`createOperationScene`, deux joueurs) :
1. J1 et J2 combattent 20 s sur le même front hostile ;
2. J2 part vers un autre front hostile et y entre à pied, de 90 unités jusqu'au centre, à 6 unités par seconde ;
3. on compte pendant 30 s les ennemis détaillés à moins de 70 unités de chaque joueur.

**Avant correction, J2 ne trouvait aucun ennemi détaillé dans 21 des 25 opérations jouables**, pendant toute la mesure. J1 gardait de 4 à 28 ennemis.

Exemple AFF-01 : budget détaillé de 24, dont 16 pour le clan rival. Les 16 places du rival étaient prises sur le front de J1. La règle qui garde leur place aux groupes déjà affichés (REC-005, contre le clignotement) empêchait tout groupe d'apparaître sur le front de J2.

## Correction

Fichier modifié : `js/battlefield/BattleSimulation.js`, méthode `_detailStep`.

Quand les joueurs vivants occupent au moins deux fronts différents, chaque front occupé reçoit d'abord une part égale du budget :
- par faction : plafond de la faction divisé par le nombre de fronts occupés ;
- au total : budget actif divisé par le nombre de fronts occupés.

Les groupes de ces parts sont examinés en premier, puis tous les autres dans l'ordre existant : groupes nommés, blessés à secourir, groupes déjà affichés, distance.

Ce qui ne change pas :
- les plafonds global et par faction ;
- la distance minimale d'apparition autour d'un joueur ;
- les identités, PV, réserves et allocations.

En solo, ou avec deux joueurs sur le même front, le comportement est strictement inchangé.

## Résultat (ennemis détaillés près de J1 / près de J2, 10 s après l'arrivée de J2)

| Opération | Avant | Après |
| --- | --- | --- |
| AFF-01 | 16 / 0 | 8 / 8 |
| AFF-04 | 16 / 0 | 8 / 8 |
| AFF-08 | 24 / 0 | 16 / 8 |
| AFF-11 | 28 / 0 | 17 / 10 |
| AFF-12 | 28 / 0 | 17 / 11 |
| AFF-13 | 12 / 0 | 6 / 5 |
| AFF-17 | 28 / 0 | 12 / 11 |
| AFF-22 | 12 / 4 | 8 / 8 |
| AFF-27 | 24 / 0 | 8 / 10 (12 / 10 après 15 s) |

**Après correction, J2 rencontre des ennemis en 5 à 10 s dans les 25 opérations jouables.** Le total des acteurs détaillés ne dépasse jamais le budget de l'opération. Le partage est inégal quand un front porte plusieurs factions, par exemple 16 / 8 : chaque faction a sa propre part.

AFF-25 et AFF-26 ne peuvent pas être mesurées. Le catalogue les déclare non jouables, en solo comme en coopération (« optional human controller is not implemented »).

## Vérification

- `tests/coop-two-fronts.test.js` sur AFF-01, AFF-08 et AFF-17 vérifie :
  - un ennemi sur chaque front ;
  - le budget respecté ;
  - aucune unité inventée ;
  - le plafond de chaque faction respecté.
- Le premier test échoue sur le code d'avant (« AFF-01: second front has no detailed threat ») et réussit après.

## Limites

- **Placement simulé.** J2 se déplace par positions simulées, sans jeu réel. Le rendu en écran partagé et la mesure de performance sur une vraie machine restent à faire.
- **Statut.** AUD-108 reste « À valider ».
