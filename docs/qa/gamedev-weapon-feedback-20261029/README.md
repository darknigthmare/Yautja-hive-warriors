# Visuels des tirs et activation des grilles électriques

Date : 29 octobre 2026. Projet : Yautja Hive Warriors. [PR #5](https://github.com/darknigthmare/Yautja-hive-warriors/pull/5).

## Résultat

**46 tests CPU réussis, aucun échec, aucun test ignoré.** Quatre fichiers JavaScript modifiés ou ajoutés passent aussi le contrôle de syntaxe.

La passe prolonge le correctif des dégâts directs de 570e443 en traitant deux limites qui y étaient explicitement conservées : le faisceau Seegson traversant visuellement le décor et l'activation électrique distante du pistolet.

Base : **570e443109cde26f63a8d9024213f1b4ed997aa0**, arbre **3dd1a7393391fe3947fe5e8d78e9cd99fee3a7aa**. Les empreintes des sources exécutées sont dans [validation.json](validation.json).

Guides appliqués : **physics-tuning** et **game-feel**, à **19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9**, également revérifié comme dernière révision amont pendant cette passe. Application : déterminer le premier contact physique, conserver les origines réelles et rattacher les effets/interactions au trajet accessible.

## Faisceau Seegson

Le cylindre lumineux était toujours créé avec une longueur de 38 unités, même lorsqu'un mur protégeait la cible contre les dégâts.

La méthode recherche maintenant le premier obstacle physique sur ce segment, depuis sa véritable origine à Y + 2.3 et avec le rayon du faisceau, **0.06**. Sa longueur est calculée à partir de la fraction d'impact t ; les obstacles personnalisés qui ne renvoient ni point ni distance restent compatibles.

Le cylindre commence toujours à la sortie du tir et son centre se situe à la moitié de la longueur disponible. Une origine déjà dans un obstacle ne crée ni maillage de longueur nulle ni minuterie de nettoyage. En espace libre, les 38 unités restent disponibles.

Couleur, transparence, épaisseur, coût d'une munition, délai de 1.6 seconde et nettoyage après 180 ms sont conservés. Les dégâts restent à 680.

Les **neuf tests** mesurent les vrais sommets du cylindre Three en coordonnées monde. Ils couvrent les murs proches, tournés, cylindriques, masqués au rendu, trop bas ou trop hauts, les obstacles désactivés ou hors portée, le rayon du faisceau, une position de joueur décalée, les impacts t seuls et le nettoyage isolé.

Avant correction : **3 réussites, 6 échecs**. Après : **9 réussites**. Ces mesures de maillage ne constituent pas une capture WebGL.

## Pistolet et grilles électriques

### Défauts reproduits

Le pistolet transmettait systématiquement un point virtuel situé à 24 unités au mécanisme électrique, même après avoir touché un acteur ou rencontré une paroi. Ce mécanisme recherchait une grille inactive dans un rayon 3D de 5.5 unités autour du point, sans contrôle de visibilité.

Une grille pouvait donc s'activer derrière un mur et infliger réellement **280 dégâts**, un étourdissement de **4 secondes** et une activité de **6 secondes**. Une paroi latérale pouvait aussi masquer une grille pourtant proche de l'axe du tir. Les trois étincelles cosmétiques pouvaient dépasser une paroi très proche de la sortie du tir.

### Correction

Chaque tir de la rafale retrace le segment physique depuis l'origine réelle jusqu'à 24 unités, avec un rayon de 0.03. Le premier contact borne à la fois le point transmis au mécanisme et la position de son étincelle. Sans obstacle, les positions et les instants historiques sont conservés.

Un acteur touché consomme **ce tir** : il n'active pas simultanément une grille distante. Les tirs suivants restent indépendants ; ils peuvent atteindre une grille si le boss touché auparavant a été vaincu entre-temps. Le retour null d'un impact non létal n'est pas interprété comme un refus.

La sélection reste dans le système propriétaire des grilles. Un paramètre final optionnel, projectileOrigin, lui permet de vérifier la visibilité vers chaque grille candidate. Une candidate masquée est ignorée et la recherche peut continuer vers une autre grille visible.

Cette combinaison autorise une grille devant le premier mur, même si l'ancienne extrémité à 24 unités était inaccessible. Elle empêche l'activation d'une grille située juste derrière ce mur ou masquée latéralement.

Les interactions manuelles sans origine de projectile conservent leurs règles. Le rayon 3D de 5.5 unités, l'ordre de recherche, l'exclusion des grilles actives, les paramètres électriques, le coût de 12 unités d'énergie et les instants **0 / 85 / 170 ms** restent inchangés.

Les **14 tests** exécutent les vraies méthodes du pistolet, du mécanisme de grille, de l'environnement et des dégâts du boss, avec CombatGeometry. Ils vérifient également les changements d'obstacle entre deux tirs, les points reconstruits depuis t et les dégâts électriques réellement appliqués.

Avant correction : **3 réussites, 11 échecs**. Après : **14 réussites**.

## Vérification consolidée

| Suite | Réussites | Portée |
| --- | ---: | --- |
| seegson-beam-cover.test.js | 9 | Sommets, dimensions, couvert et durée de l'effet |
| plasma-pistol-electric-grid.test.js | 14 | Impacts, étincelles, choix de grille et effets électriques |
| legacy-hitscan-cover.test.js | 17 | Régression des dégâts directs, origines, alliés, coûts et retours d'impact |
| clan-forge-recovery.test.js | 6 | Régression des autres modifications de Player, dont le bonus Enkidu |
| **Total** | **46** | **23 nouveaux cas et 23 cas existants rejoués ; aucun échec** |

Une revue indépendante du code et des tests a contrôlé les transformations du maillage, les rayons, les interactions manuelles, le cycle de vie des effets et les valeurs conservées. Elle n'est pas présentée comme une seconde exécution facultative de toute la suite.

- [Commande et journal des 46 tests](targeted-tests.txt).
- [Régressions sur les sources initiales](baseline-regressions.txt) : 17 cas en échec répartis entre les deux nouvelles suites, sans assimilation à 17 défauts indépendants.
- [Contrôles de syntaxe](syntax-checks.txt).
- [Tentative de build local](build-attempt.txt).
- [Sources, empreintes et limites](validation.json).

## Suivi et limites

Les preuves sont ajoutées à **AUD-090**, qui reste **À valider**, avec acceptanceVerified=false. Les 126 critères et statuts sont conservés : 67 Terminé, 44 À valider, 15 En cours. Les 125 autres actions, les métadonnées et les classeurs historiques restent identiques.

Les deux fichiers de production modifiés sont Player.js et ReferenceEnvironmentMechanisms.js ; dans le second, seules la signature et une condition du mécanisme électrique changent. main.js, les dépendances et le verrou sont conservés.

Cette passe ne modifie pas les cônes de visée ni la priorité historique entre acteurs ; elle n'établit pas une balistique générale du premier acteur. Elle ne revoit pas les dégâts de zone électriques une fois la grille activée, les interactions manuelles, le M77, le sniper ou les autres gadgets.

Les vérifications sont CPU : véritables méthodes et géométrie, avec services contrôlés de son, rendu et minuterie. Elles ne certifient pas l'apparence dans un navigateur, la sensation de combat, les performances matérielles ou la fidélité aux références.

Node 24.22.1 et le cœur officiel Three.js r160/0.160.1 ont été utilisés. Le build local a été tenté et échoue avec **vite: not found** (code 127) ; Vite 8.3.4 verrouillé est absent. Aucune dépendance ni configuration réseau n'a été changée pour contourner cette limite.

Ce rapport décrit les contrôles avant publication. **L'état de l'aperçu du nouveau commit et le résultat de la vérification navigateur sont consignés séparément dans la PR après publication.** Le dernier essai sur 570e443 était bloqué par un contexte WebGL indisponible dans le navigateur de test. Aucun test humain ni déploiement en production n'est revendiqué.
