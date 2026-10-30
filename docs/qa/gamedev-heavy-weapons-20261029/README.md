# M77 et sniper : tirs, couvert et attribution des impacts

Date : 29 octobre 2026. Projet : Yautja Hive Warriors. PR de travail : [#5](https://github.com/darknigthmare/Yautja-hive-warriors/pull/5).

## Résultat vérifié

**121 tests CPU réussis, aucun échec, aucun test ignoré.** Cinq fichiers JavaScript passent le contrôle de syntaxe. Le build a été tenté et reste bloqué par l'absence de Vite 8.3.4 : code 127, `vite: not found`.

Base publiée : **492e732dee45715d2fc2ece9ead05621b02aa272**, arbre **83d592f0be348281f9841e0cbf4c3a13e1a4e4f3**. Le lot M77/sniper de la reprise précédente était resté local. Ses corrections, tests de propriété des effets, protections de faction et crédit des éliminations sont réunis avec les contrôles supplémentaires de cette passe.

Guides consultés : **physics-tuning** et **game-feel**, à **19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9**. Leur application locale consiste à tracer le contact physique depuis l'origine réelle du tir, puis à en dériver les dégâts admissibles et les points des effets. Le moteur reste Three.js r160 ; aucune API r186 ni migration n'est introduite.

## M77 Gauss

Le boss pouvait recevoir 550 dégâts à travers une paroi, alors que les aliens bénéficiaient déjà d'un contrôle de visibilité. L'environnement passé en argument n'était pas utilisé par toutes les vérifications. Le faisceau et les six anneaux restaient affichés sur toute leur portée.

Le M77 utilise maintenant l'environnement fourni, avec repli sur celui du contexte, et trace depuis sa bouche réelle à Y + 1.8. Le rayon du rail est **0.08**, la portée libre **45 unités**. La première fraction de contact physique borne le cylindre, la position de son centre et la distance longitudinale admissible des acteurs. Chaque acteur conserve en plus sa propre vérification de visibilité.

Les anneaux gardent leurs dimensions, leurs couleurs et leurs positions historiques en espace libre. Un anneau dépassant le contact est omis. Une enveloppe balayée plus large empêche également les anneaux de traverser une paroi latérale : cette approximation est volontairement conservatrice et peut supprimer un anneau dont la position finale seule serait libre. Elle ne change pas le rayon ni les dégâts du rail.

Une origine déjà dans un obstacle ne crée aucun effet ni minuterie. Le nettoyage à **220 ms** reste confié au propriétaire des ressources, même lorsque le groupe a été détaché de la scène avant l'échéance. Une seconde demande de retrait ne détruit pas deux fois les mêmes ressources.

Les règles conservées sont : une munition par tir, délai de **1.35 seconde**, dégâts **550**, sélection historique en ordre inverse avec un maximum de **15 aliens**, puis un boss traité séparément. Les synthétiques ne sont toujours pas des cibles de cette méthode M77 ; ce comportement hérité reste hors du lot.

## Lance plasma sniper

Trois appels à `Vector3.subScaledVector`, absent du cœur r160, provoquaient une exception dès qu'un acteur entrait dans la sélection. Ils utilisent maintenant `addScaledVector` avec la projection négative.

Le tir part de sa véritable origine à **Y + 1.8**, avec une portée libre de **42 unités** et une trace de rayon **0.03**. Le premier obstacle borne les positions d'émission de l'explosion, des étincelles et la portée longitudinale des dégâts. Une trajectoire de longueur nulle ne produit aucun de ces effets. Les huit stations d'étincelles historiques restent disponibles en espace libre.

Aliens, boss et synthétiques passent leur contrôle de visibilité depuis cette origine. Les synthétiques alliés ou neutres sont exclus selon la simulation qui les possède. Seul un impact admis remplace leur crédit précédent ; les aliens touchés reçoivent également la faction du joueur. Les cibles mortes, protégées ou amicales conservent leur état et leur attribution.

La bisection, le torse survivant et la désactivation finale des synthétiques restent traités par leur gestionnaire. Les tests exécutent cette chaîne réelle et vérifient une seule mort avec le bon crédit. Le sniper transmet aussi la horde au gestionnaire de boss, notamment pour les changements de phase du Predalien.

Les paramètres conservés sont : énergie **35**, délai **3.8 secondes**, dégâts **1 200**, sélection perpendiculaire en 3D de **1.8** pour aliens/synthétiques et **3.2** pour le boss, et perforation de plusieurs cibles admissibles.

## Décision de comportement explicite

Les deux armes peuvent traverser leurs cibles admissibles, mais leur trajet s'arrête au premier obstacle physique. Une cible décalée sur le côté, ou surélevée, ne peut plus recevoir un tir au-delà de cet obstacle, même si sa ligne individuelle vers la bouche serait libre. Les cônes et largeurs de sélection restent ceux du jeu ; la distance accessible constitue une borne supplémentaire.

Le lot local retrouvé autorisait encore explicitement un boss latéral au-delà du contact central. Son test permissif est remplacé par un test du trajet borné, avec commentaire. Les nouveaux cas isolent cette différence de comportement et conservent aussi les contrôles de visibilité latérale avant le mur. Cette évolution ne définit pas une nouvelle priorité entre les acteurs ni un modèle général de balistique pour les autres armes.

## Preuves de validation

| Suite | Tests réussis |
| --- | ---: |
| M77 : lot retrouvé, propriété réelle et géométrie | 17 |
| M77 : couvert, axes, origine, ressources et régressions complémentaires | 21 |
| Sniper : lot retrouvé, factions et chaîne de désactivation | 17 |
| Sniper : trajectoire, origine, contextes boss et régressions complémentaires | 20 |
| Seegson : géométrie et effets | 9 |
| Pistolet : grilles, impacts et étincelles | 14 |
| Dégâts directs hérités | 17 |
| Récupération Forge/clan | 6 |
| **Total exécuté sur le candidat final** | **121** |

Les **75 cas M77/sniper** ont également été exécutés sur la source exacte de Player.js publiée à 492e732 : **18 réussites et 57 échecs**. Ce nombre décrit les assertions de comportement en échec, pas 57 défauts indépendants. Le résultat final comprend 75 cas de ce lot et 46 régressions existantes ; les anciens comptes rendus ne sont pas additionnés.

- [Journal final des 121 tests](targeted-tests.txt).
- [Reproduction sur la source publiée](baseline-regressions.txt).
- [Syntaxe](syntax-checks.txt).
- [Tentative du build](build-attempt.txt).
- [Commandes et métadonnées d'exécution](run-metadata.json).
- [Empreintes des sources et périmètre](validation.json).

Les vraies méthodes des armes et des gestionnaires, le cœur officiel Three.js r160 et CombatGeometry sont exécutés. Les sommets des maillages M77 sont contrôlés en coordonnées monde. La scène, l'horloge, le son et certains services restent contrôlés dans les fixtures ; ce sont des tests CPU, pas des captures WebGL.

## Suivi et limites

Les preuves de ce lot sont ajoutées à **AUD-090**, qui reste **À valider** et `acceptanceVerified: false`. Les 126 critères, leurs statuts, les 125 autres actions et les classeurs sont conservés. Les preuves historiques restent distinctes de l'exécution actuelle.

Le seul fichier de production modifié dans ce lot est Player.js, limité aux deux méthodes d'arme. Les coûts, versions, dépendances, géométries de niveau, sources d'assets et autres méthodes sont préservés.

La vérification des particules concerne leurs **points d'émission**, pas leur expansion ou leur mouvement après émission. L'enveloppe des anneaux est conservatrice. Les tests de bisection portent sur le gestionnaire synthétique ; une recette complète du score de tous les acteurs et de toute la bataille reste distincte.

**Build et recette dans le jeu restent à valider.** Le cœur Three utilisé pour les tests est identique aux octets officiels r160/0.160.1, avec un descripteur local destiné aux tests ; ce n'est pas une installation complète par npm ci. Vite 8.3.4 est absent et n'est pas disponible dans le cache local. Aucune dépendance n'est remplacée.

L'état de l'aperçu du nouveau commit est contrôlé séparément après publication dans la PR. L'échec de quota Vercel constaté sur 492e732 et l'aperçu ancien de 570e443 ne constituent pas une validation du nouveau code. Aucune fusion, publication en production, certification de performances matérielles ou fidélité 1:1 n'est revendiquée.
