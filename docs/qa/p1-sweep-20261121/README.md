# Passe P1 du 21 novembre 2026

Les 14 P0 sont terminés. Il reste 35 P1 : 24 « À valider » et 11 « En cours ». La plupart demandent une observation en jeu ou une mesure sur la machine de l'auteur.

Cette passe traite ce qu'une mesure automatique peut établir ou corriger. Aucun statut du suivi n'est changé ici.

## 1. Bataille distante d'une heure (AUD-014, AUD-019, AUD-024, AUD-042, AUD-121)

### Méthode

- Pour chacune des 25 opérations jouables, `BattleSimulation` tourne une heure simulée, par pas de 0,5 s.
- Le joueur reste à 4 000 unités de tout front. Seule la bataille distante est donc en jeu.
- Chaque minute simulée, le banc vérifie :
  - `assertConservation` : identités, budgets et états ;
  - qu'aucune unité morte ne revient ;
  - le nombre de fronts disputés en même temps.
- La taille de la sauvegarde est relevée à 30 et à 60 minutes.

Test permanent : `tests/long-battle-invariants.test.js` (26 tests, environ 19 s).

### Résultats

- **Aucune violation sur les 25 opérations.** Aucune unité n'est créée, aucune morte ne revient, aucun budget n'est dépassé.
- **Sauvegarde bornée.** La taille ne croît plus après la fin de la bataille : AFF-01 passe de 96 451 octets à 30 min à 96 470 à 60 min.
- **Combats simultanés.** Au moins deux fronts sont disputés en même temps dans toutes les opérations, et jusqu'à quatre.
- **Réciprocité.** Les deux camps infligent des pertes dans 23 des 25 opérations.
  - Les écarts suivent les rapports de force des scénarios. Les règles de combat distant sont symétriques : seuls l'ordre (défense ×0,85, attaque ×1), le moral et la formation pèsent.
  - AFF-06 et AFF-07 placent 64 soldats humains contre 4 Yautja sur le front du joueur. Sans lui, ce front tombe en quelques secondes : c'est le scénario, pas un défaut.
- **Contrôle avec le joueur sur son front.** Avec le joueur posté sur son front de départ, la même heure ne produit aucune violation non plus.

| Opération | Morts | Fronts disputés au maximum | Fin sans joueur | Pertes infligées / subies par le clan du joueur |
| --- | ---: | ---: | --- | --- |
| AFF-01 | 23 | 3 | défaite à 9 min | 3 / 20 |
| AFF-02 | 76 | 4 | défaite à 14 min | 20 / 56 |
| AFF-06 | 8 | 3 | défaite à 9 min | 0 / 8 |
| AFF-08 | 37 | 4 | défaite à 20 min | 5 / 32 |
| AFF-12 | 237 | 4 | défaite à 13 min | 6 / 32 |
| AFF-15 | 178 | 4 | défaite à 28 min | 1 / 24 |
| AFF-20 | 34 | 4 | défaite à 39 min | 2 / 32 |
| AFF-27 | 298 | 4 | défaite à 20 min | 3 / 24 |

Sans joueur, chaque opération finit par une défaite : le clan du joueur a besoin de lui.

### Limites

- Le combat rapproché des acteurs 3D n'est pas simulé en Node.
- AUD-121 demande encore une session interactive instrumentée de 60 minutes.

## 2. Pouvoirs de zone contre le boss à travers les murs (AUD-090) : corrigé

### Défaut

Quinze pouvoirs du chasseur blessaient le boss sur la seule distance, à travers murs et couverts :
- coup de gantelet, fouet vertébral, faux d'os, iaijutsu, riposte ;
- faux à plasma, grenades M41A, rayon du vaisseau éclaireur ;
- séisme de la masse, pièges soniques, tourbillon du combistick ;
- plasma lourd, frappes héritées, bombe aérienne.

Les mêmes pouvoirs respectaient déjà les couverts contre tous les autres ennemis.

L'exécution d'un boss étourdi, à moins de 8 unités, ne vérifiait pas non plus la ligne de vue.

### Correction

- `Player.bossInReach(bosses, origin, radius)` exige d'abord le rayon. Elle vérifie ensuite la ligne de vue de l'environnement, de 1,2 au-dessus de l'impact jusqu'au corps du boss.
- Les 15 branches passent par elle.
- L'exécution d'un boss (`main.js`) vérifie aussi la ligne de vue.
- Dégâts, rayons et coûts sont inchangés.

Test : `tests/boss-cover-reach.test.js`. Il couvre le rayon, le mur, l'absence de boss et la hauteur de la ligne. Un garde-fou vérifie aussi qu'aucun `bosses.activeBoss.mesh.position.distanceTo(` ne reste dans `Player.js`.

## 3. Code servi en production (AUD-004) : écart constaté

Le 21 novembre, `https://yautja-hive-warriors.vercel.app/build-info.json` renvoie :
- `contentVersion` : `v67-pr3-integration` ;
- `sourceFiles` : 139 ;
- `sourceCommit` : `null`.

Le build de `master`, au commit `6e0b45c`, donne `v70-fidelity-20261109`, 220 fichiers sources et son commit.

**La production ne sert donc pas `master`.** Les fusions du 20 et du 21 novembre ne l'ont pas mise à jour. Le projet publie par ses scripts de livraison (`scripts/publish-verified-pr3.mjs`), pas par un déploiement automatique depuis `master`.

Le compte Vercel connecté à cette session ne voit pas le projet. La publication ou le réglage de la branche de production reste à faire par l'auteur. Le build local fait 343 Mo, dont 339 Mo de modèles GLB.

## 4. Arrivées des renforts (AUD-013) : revue du code

`BattleActorBridge.spawnGroup` place chaque acteur matérialisé dans cet ordre :
1. un point sûr (`navigation.safeSpawnNear`) ;
2. la résolution des collisions ;
3. l'altitude du sol.

Une apparition à moins de 24 unités d'un joueur vivant est refusée. Les tests existants couvrent ces cas, par exemple `musou-spawn-clearance`.

Rien à corriger. La vérification visuelle des arrivées reste à faire.

## Vérification de cette passe

- Nouveaux tests : `long-battle-invariants` (26), `boss-cover-reach` (2).
- Suite Node complète et navigateur : voir le message de commit.
