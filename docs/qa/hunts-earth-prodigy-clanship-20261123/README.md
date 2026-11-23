# Chasses de Gunnison (ville), Prodigy City et du vaisseau de clan (23 novembre 2026)

**Choix de l’auteur, « mixte »** : la Terre et Prodigy City réutilisent des boss, le vaisseau de clan reçoit un boss nouveau.

| | Gunnison — la ville | Prodigy City — épave du Maginot | Vaisseau de clan infesté |
| --- | --- | --- | --- |
| Source | *Aliens vs. Predator: Requiem* (2007) | *Alien: Earth* (série, 2025), 2120 | création de Hive Warriors |
| Identifiant | `gunnison_town` | `prodigy_city_maginot` | `yautja_clan_ship` |
| Boss | Predalien de Gunnison (réutilisé) | Xénomorphe du Nostromo (réutilisé, embuscade par les conduits) | **Predalien de la cale** (nouveau, modèle existant de Predalien) |
| Humains | Garde nationale du Colorado (4 par secteur actif) ; appui Black Hawk | aucun (ville corporative, pas l’USCM) | aucun |
| Mécanismes | flaques, transformateurs, barils explosifs, résine des égouts | cuves de spécimens (facehuggers en nombre fini), planchers effondrables, transformateurs, cloisons, flaques | sanctuaire des armes, terminaux de recharge plasma, grilles de pont électrifiées, cloisons, résine, œufs |

## Predalien de la cale : couloir de pont

- Après chaque coup au corps à corps, il fend le pont devant lui : un couloir de 18 × 3 unités.
- Le couloir rougeoie 0,7 s avant de cracher du plasma, puis brûle 15 PV toutes les 0,5 s, jusqu’à 3,7 s, dans la limite du budget de dangers du `CombatDirector`.
- La parade : s’écarter sur le côté.

Ces valeurs sont des choix de jeu.

## Constructeurs écartés

Deux constructeurs, `buildSuperPredatorShipDaisProps` et `buildHellhoundKennelProps`, sont des sous-parties d’un décor plus grand : ils attendent un groupe parent. Ils ont été retirés de la liste du vaisseau.

## Vérification

- **Matrice des contre-jeux, cas `hold_predalien`** : couloir annoncé ; brûlure si l’on y reste ; aucune après un pas de côté.
- **`hadley-fiorina-hunts`, étendu** : sources, boss, mécanismes ; Garde nationale à Gunnison ; aucun humain sur le vaisseau ni à Prodigy City.
- **Suite Node complète** : 1 742 réussis, 0 échec, 1 ignoré.
- **Dans Chromium** : les trois chasses se chargent depuis le menu, sans erreur. Dans le secteur final, portes ouvertes, chaque boss s’approche et frappe.
- **Captures** : vues fixes de l’insertion.
