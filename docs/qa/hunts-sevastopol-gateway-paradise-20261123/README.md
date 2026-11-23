# Chasses de Sevastopol, Gateway et Paradise (23 novembre 2026)

Les lieux suivent l’ordre choisi par l’auteur. Les boss sont réutilisés, sauf à Paradise.

| | Sevastopol | Gateway | Paradise |
| --- | --- | --- | --- |
| Source | *Alien: Isolation* (jeu, 2014), 2137 | *Aliens* (1986), 2179 : lieu du film, scénario créé | *Alien: Covenant* (2017), 2104 |
| Identifiant | `sevastopol_station` | `gateway_station_labs` | `paradise_covenant` |
| Boss | Xénomorphe du Nostromo (réutilisé, embuscade par les conduits) | Prétorien (registre existant) | **Néomorphe de Paradise** (nouveau, modèle existant de Néomorphe) |
| Troisième faction | Working Joes de Seegson, hostiles aux intrus (3 par secteur actif) | synthétiques de combat Weyland-Yutani (2 par secteur actif) | aucune |
| USCM, appui aérien, caches | aucun | aucun | aucun |
| Mécanismes | passerelles, cloisons, vapeur, transformateurs, résine | cuves de spécimens (facehuggers en nombre fini), cuves de labo, sas, cloisons, passerelles | nécropole des Ingénieurs, urnes du pathogène, flaques, paratonnerres |

Les synthétiques d’un lieu sont tous du même fabricant. Les sites existants (Romulus, Charon…) gardent leur escouade mixte. Les Working Joes, les synthétiques Weyland-Yutani et l’USCM restent des factions distinctes.

## Néomorphe de Paradise : nuage de spores

- À chaque réception de bond, un nuage de spores de rayon 5 apparaît. Son anneau pâle s’affiche 0,6 s avant qu’il ne devienne nocif.
- Il dure 4,6 s. Un chasseur resté dedans perd 12 PV toutes les 0,5 s, dans la limite du budget de dangers du `CombatDirector`.
- La parade : sortir du cercle, puis frapper de l’extérieur.

Toutes ces valeurs sont des choix de jeu.

## Les lieux déjà livrés aujourd’hui reçoivent leurs mécanismes propres

Ces mécanismes existaient dans le code, sans être utilisés par ces chasses :

| Chasse | Mécanisme ajouté | Effet |
| --- | --- | --- |
| Hadley’s Hope | décor de colonie | — |
| Fiorina 161 | fonderie de plomb en fusion | le plomb blesse aussi le boss, comme dans le dénouement du film |
| USM Auriga | bassin inondé | — |
| Gateway | cuves de spécimens | facehuggers en nombre fini |

Un ancien constructeur de flore alienne (`buildAlienFloraPatchProps`) plantait la construction de Paradise. Il a été retiré de la liste de Paradise.

## Vérification

- **Tests ajoutés** :
  - cas `paradise_neomorph` dans la matrice des contre-jeux : nuage annoncé, dégâts si l’on reste dedans, aucun si l’on sort ;
  - `hadley-fiorina-hunts`, étendu : source, boss, mécanismes et fabricant des synthétiques de chaque lieu ; aucune présence USCM.
- **Suite Node complète** : 1 715 réussis, 0 échec, 1 ignoré.
- **Dans Chromium**, depuis le menu : Sevastopol, Gateway, Paradise, Fiorina et l’Auriga se chargent sans erreur de page. Dans le secteur final, portes ouvertes, chaque boss s’approche et frappe en 12 s.
- **Captures** : vues fixes de l’insertion.

Non vérifié : une partie complète jouée par un humain.
