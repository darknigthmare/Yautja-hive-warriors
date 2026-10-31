# Extinction — spores et poursuite stratégique de la ruche

Date : 30 octobre 2026
Base : PR #6, commit `ad3528abfcbfbd20cfefbb227511eb40d3120840`.

## Source canonique et portée du correctif

Le manuel de *Aliens versus Predator: Extinction* (PS2, 2003)
décrit **Spore Sight** : les **Hive Nodes, Runners,
Praetorians et Queens** émettent des spores qui se
déposent sur les organismes vivants et permettent de
conserver leurs traces pendant un temps limité.

[Manuel PlayStation 2 — Motion Detection / Spore Sight](https://gamingalexandria.com/ps2/Aliens%20Versus%20Predator%20Extinction/Aliens%20Versus%20Predator%20Extinction%20-%20Manual.pdf)

Les chiffres ci-dessous sont des **choix de gameplay de
Yautja Hive Warriors**, et non des distances ou délais
certifiés du titre original.

| Émetteur | Rayon proposé (unités jeu) |
|---|---:|
| Hive Node | 18 |
| Runner | 12 |
| Praetorian | 16 |
| Queen | 22 |

Mémoire de la trace : **10 secondes** de simulation.
Échantillonnage : **4 pas fixes = 1 seconde**.
Mémoire maximale : **96 ennemis distincts par ruche**,
192 émetteurs examinés par ruche et par prélèvement.

## Raccord des systèmes réellement réalisé

`js/battlefield/HiveSporeSight.js` génère des
**positions observées à un instant donné**, au lieu de
divulguer une position ennemie mise à jour en permanence :

- seuls les émetteurs xénomorphes **déjà alloués**,
  vivants, réellement déployés et présents sur le bon
  front produisent des traces ;
- une structure Hive Node encore existante émet
  elle aussi à partir de sa **position statique**,
  indépendamment de l'endroit où son ancien
  constructeur s'est ensuite déplacé ;
- seules les cibles vivantes **biologiques et hostiles**
  (humains, Yautja et autres Xénomorphes ennemis)
  peuvent être tracées. Working Joes, synthétiques,
  morts et unités d'un autre front ne sont pas
  transformés en proies biologiques ;
- la dernière position observée reste **figée**
  lorsque la cible sort de portée, puis disparaît
  à échéance. Le système n'a jamais le droit
  de lire de nouvelles coordonnées d'une cible
  distante via une observation périmée ;
- les observations appartiennent à la faction
  `hive`. Elles **ne sont pas injectées
  dans les rapports du clan Yautja**. Le joueur
  ne récupère pas gratuitement le radar ennemi.

### IA stratégique : effet concret

Dans `BattleSimulation._strategicOrders`, un officier
de ruche choisissant parmi des fronts voisins
recevables privilégie un front où les spores
signalent encore un ennemi. Il conserve les
contraintes de force, de garrison, de routes,
de factions hostiles et d'officier vivant.
Le journal explique le choix avec
`spore_tracked_hostile_front`.

En l'absence de trace récente, l'IA retrouve
son classement préexistant. Le système ne
crée **ni unité, ni renfort, ni dégât, ni
révélation omnisciente**, et n'ajoute pas
de raccourci de navigation.

### Sauvegarde, sécurité et performances

Les traces sont enregistrées dans
`hiveEcology.spores` : faction propriétaire,
ID de la proie, espèce/faction cible, front,
émetteur, dernière position observée, date,
expiration. La restauration refuse un
organisme synthétique, un ID inventé, un
faux émetteur, des coordonnées non bornées,
les duplications, des expirations impossibles
et des dépassements de mémoire.

Un checkpoint plus ancien, dépourvu de
`spores`, reprend avec une **mémoire de
traces vide**. Les identités des soldats,
les PV, les ressources, les budgets, les
routes, les unités de réserve et le
`configDigest` restent inchangés.

La représentation `HiveNodeWorld` ne
reçoit plus un clone intégral des traces
à chaque frame : elle appelle
`getHiveNodeState({nodesOnly:true})`,
qui fournit uniquement les structures 3D
existantes. Les traces ne sont copiées que
par les lectures stratégiques et le
checkpoint. L'échantillonnage d'une seconde
évite un scan 3D complet à 60 FPS.

## Tests

Les huit tests de
`tests/hive-spore-sight.test.js` vérifient :

1. uniquement des proies organiques
   proches et sur le même front ;
2. position historique figée, délai puis expiration ;
3. émissions des quatre émetteurs autorisés ;
4. limite de 96 traces malgré 140 cibles ;
5. falsifications et doublons refusés ;
6. vraie configuration AFF-27, reprise de
   checkpoint et conservation des IDs ;
7. aucune activité hors d'AFF-27 ;
8. choix d'un front par la vraie méthode
   `BattleSimulation._strategicOrders`
   puis retour au classement normal.

Les cas de logique pure et de choix stratégique
ont été exécutés dans un environnement JS isolé.
Les tests Node/Three intégrés sont **rédigés** ;
leur réussite définitive dépend du job GitHub
Actions du nouveau commit et n'est pas présumée.

La passe précédente d'exposition des Facehuggers
a obtenu **85/85 tests Node ciblés et build Vite
réussi** sur le commit `ad3528ab`.
Le contrôle navigateur complet doit être
observé séparément.

## Éléments toujours manquants à la fidélité 1:1

- animation/matière des spores réellement
  déposées sur chaque cible en 3D ;
- détection des deux **joueurs** lors des
  attaques de ruche et intégration aux modes
  de vision (les contacts de la présente
  passe se limitent aux unités de la simulation) ;
- ligne de vue et volume physique des spores
  autour des obstacles verticaux, escaliers,
  tunnels et mezzanines. Pour éviter la
  détection à travers des zones parallèles,
  la passe actuelle restreint au même front,
  mais ne calcule pas une propagation 3D ;
- variantes Cystic de chaque caste,
  améliorations de spoor tracking et
  comportement IA par difficulté ;
- conversion d'hôtes et économie d'infestation
  basée sur l'implantation, encore distincte
  du système courant ;
- revue visuelle multi-vues / contrôle humains
  et performances GPU réelles.

**Statut : suivi tactique borné et sauvegardé,
orientation IA réellement modifiée ; pas de
reconstitution visuelle ou mécanique 1:1
certifiée.**
