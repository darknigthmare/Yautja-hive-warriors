# Combat : dégâts et impacts sur les boss protégés par le décor

Date : 29 octobre 2026. Projet : Yautja Hive Warriors. [PR #5](https://github.com/darknigthmare/Yautja-hive-warriors/pull/5).

## Résultat et périmètre

**56 tests CPU réussis, aucun échec, aucun test ignoré.** Les cinq fichiers JavaScript directement modifiés ou ajoutés passent le contrôle de syntaxe.

Base de cette passe : **c6ebf48b772b8293cdad35ab1302406e73c957ec**, arbre **830a2b920b029d01d451493f5714880f28ad4765**. Les [empreintes des sources exécutées](validation.json) rattachent la preuve au code exact.

La correction porte sur les dégâts directs et les effets d'impact de cinq armes : pistolet plasma, Seegson Bolt Gun, smart disc, combistick et shuriken. Les coûts, portées, dégâts et trajectoires existants sont préservés.

Guides appliqués : **physics-tuning** et **game-feel**, épinglés à **19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9**. La branche principale du dépôt de guides a été relue pendant cette passe et pointe encore sur cette révision. Leur application consiste à utiliser les vraies origines des segments de collision et à conditionner le feedback de cible à un impact autorisé.

## 1. Pistolet plasma et Seegson

### Défaut reproduit

Le pistolet contrôlait le décor pour les aliens, mais pas pour le boss. Dans le scénario de référence, le tir part de (0.4, 1.8, 0.3), la cible se trouve en (0, 0, 10) et une paroi de hauteur 4 occupe z = 5.

Avec trois impacts non critiques de 95 dégâts, le boss recevait **285 dégâts malgré la paroi**, sans requête de visibilité. Le même mur protégeait l'alien, qui recevait zéro dégât. Le Seegson présentait également une branche de dégâts au boss sans contrôle du décor.

Un second cas montrait que le pistolet utilisait les points visuels des étincelles, situés devant la sortie du tir, pour contrôler les aliens. Une paroi très proche pouvait se retrouver derrière ces points et être ignorée.

### Correction

La requête géométrique existante est partagée dans Player.js. Le contrôle des factions alliées et les valeurs par défaut des autres armes restent conservés.

Le pistolet vérifie le boss et les aliens depuis **l'origine réelle du tir**, dans l'environnement explicitement reçu. Chaque impact retardé réévalue le décor. Un boss masqué ne consomme plus un impact qui peut atteindre un alien visible.

Le Seegson vérifie les deux types de cible depuis son vrai point de départ, à **2.3 unités de hauteur**. La dépense d'une munition, le délai de 1.6 seconde, les 680 dégâts et la portée de 38 unités restent identiques.

Le pistolet conserve aussi la référence du boss touché pendant l'application des dégâts. Si cet impact tue le boss et que le gestionnaire vide activeBoss, les étincelles de cible ne provoquent plus d'accès à une référence absente.

### Preuves

Les 17 tests exécutent les méthodes réelles des armes et de dégâts du boss, avec CombatGeometry et Three.js r160. Ils couvrent les murs proches, les obstacles en hauteur, le couvert bas, la paroi au-delà de la cible, les coûts, les limites de portée, l'exclusion des alliés, l'apparition d'un mur entre deux impacts et le nettoyage d'un boss vaincu.

Avant correction : **9 réussites et 8 échecs**. Après correction : **17 réussites**.

## 2. Smart disc, combistick et shuriken

### Défaut reproduit

La boucle vérifiait déjà les murs traversés par le déplacement du projectile. Elle autorisait ensuite un impact sur tout boss à moins de quatre unités, sans vérifier le couvert entre cette position et le boss.

Le projectile pouvait donc être encore devant un mur et faire passer le boss situé derrière de **1 000 à 925 PV**. Le défaut était également reproduit avec une paroi tournée et avec un projectile bas protégé par un mur bas.

### Correction

Un prédicat commun conserve la portée de quatre unités et contrôle la visibilité depuis **la position et la hauteur réelles du projectile**. Il ne relève pas artificiellement cette origine comme pour une attaque de mêlée.

Le refus empêche aussi les sons d'impact, les étincelles, les effets de découpe et la consommation d'une perforation liés au boss. Un tir en espace libre conserve ses dégâts et ses effets. Le retour de takeDamage n'est pas utilisé comme booléen : un impact non létal valide peut retourner null, car aucun événement de mort n'a été produit.

Le contrôle déjà présent sur les murs réellement traversés reste actif. La perforation multicible du combistick ne devient pas une autorisation de traverser une paroi.

### Preuves

Les tests exécutent la boucle réelle de main.js, la vraie classe BossManager et les segments de CombatGeometry. Les trois armes sont vérifiées contre un couvert plein, tourné, bas, désactivé ou placé derrière le projectile, ainsi que lors de la traversée effective d'un mur.

Avant correction : **6 réussites et 6 échecs**. Après correction : **12 réussites**.

## Vérification consolidée

| Suite ou sélection | Réussites | Portée |
| --- | ---: | --- |
| legacy-hitscan-cover.test.js | 17 | Deux armes instantanées, origines, couvert, coûts et feedback |
| projectile-boss-cover.test.js | 12 | Trois projectiles, portée de proximité, couvert et effets |
| co-op-keyboard-interactions.test.js | 15 | Non-régression des interactions, exécutions, QTE et gardes J2 |
| clan-forge-recovery.test.js | 6 | Non-régression de la récupération clan et du bonus Enkidu dans Player |
| Cas existants sélectionnés | 6 | Cinq cas de CombatGeometry et premier impact physique de la flèche |
| **Total** | **56** | **0 échec, 0 ignoré** |

Les six cas existants sélectionnés sont exécutés sans réécrire leurs blocs de test. Le [runner conservé](replay-existing-collision-checks.mjs) vérifie les empreintes des deux fichiers de test et des deux modules. Il sélectionne cinq cas de combat-geometry.test.js, hors construction de l'APC, et le cas de balayage de flèche de runtime-final-wiring.test.js. **Les deux suites complètes, dont le cas APC, ne sont pas déclarées exécutées.**

Les nouvelles suites ont aussi été relues et exécutées indépendamment. La revue a vérifié les origines, les coûts, le contrôle des alliés et l'absence de confusion entre impact accepté et événement de mort.

- [Commande consolidée et journal des 56 tests](targeted-tests.txt).
- [Régressions sur les sources initiales](baseline-regressions.txt) : 14 cas en échec dans les deux nouvelles suites, soit 8 + 6 ; ce nombre ne désigne pas 14 défauts indépendants.
- [Contrôles de syntaxe](syntax-checks.txt).
- [Tentative de build local](build-attempt.txt).
- [Sources, empreintes, environnement et limites](validation.json).

## Suivi d'audit

Les preuves sont ajoutées à **AUD-090**, qui reste **À valider**, avec acceptanceVerified=false. La passe couvre ces cinq chemins de dégâts directs ; elle ne certifie pas toutes les armes, toutes les interactions de décor ou toutes les limites de perforation.

Les 126 identifiants, critères et statuts sont conservés : **67 Terminé, 44 À valider, 15 En cours**. Les 125 autres actions restent identiques, ainsi que les métadonnées historiques. Aucune cellule des classeurs historiques n'est modifiée.

## Limites restantes

La validation porte sur la logique CPU et les effets demandés par cette logique. Elle utilise des environnements contrôlés et des services de rendu/son simulés ; elle ne constitue pas un parcours WebGL, une observation visuelle ou une mesure de sensations de combat.

Le **faisceau visuel Seegson conserve sa longueur de 38 unités**. Le pistolet conserve son appel environnemental à checkElectricGridInteraction au point distant de 24 unités, sans ajout de contrôle d'occlusion pour cette interaction. Les corrections des dégâts directs ne doivent pas être étendues à ces deux comportements.

Les branches du M77 et du sniper, les interactions avec les synthétiques et les autres anciens gadgets restent des pistes de vérification hors de cette passe. Aucun résultat d'exhaustivité ne découle des 56 tests.

Node 24.22.1 et le cœur officiel Three.js r160 ont été utilisés. Le build Three de test conserve les octets de la distribution 0.160.1 ; le descripteur local n'est pas une installation complète npm ci. Les dépendances et le verrou du projet sont inchangés.

Le build local a été tenté et échoue avec **vite: not found** (code 127). Vite 8.3.4 verrouillé n'est pas installé et aucun navigateur exécutable local n'est disponible. Les limites d'accès au registre constatées précédemment n'ont pas été contournées et aucune version n'a été substituée.

L'état de l'aperçu Git Vercel du nouveau commit sera consigné dans la PR après publication. Cette passe ne revendique aucun build distant réussi, aucun test humain, aucune mesure matérielle et aucune certification de fidélité 1:1.
