# Passe écologie Facehugger — protection Hive-Space et usure hors ruche

Dépôt : `darknigthmare/Yautja-hive-warriors`
PR : [#6](https://github.com/darknigthmare/Yautja-hive-warriors/pull/6)
Référence de base : `a51f97c119c34fcf3d00f38e295bb53d9770f8a9`
Date : 30 octobre 2026.

## Règle source (ne pas confondre avec les chiffres adaptés)

Le **manuel PlayStation 2 d'Aliens versus Predator: Extinction**
précise que les Facehuggers sont vulnérables lorsqu'ils ne
sont pas sur le Hive-Space ; ils peuvent s'y déplacer sans
perdre de santé. Le Hive Node est créé par le Drone et le
Hive-Space protège la ruche.

Source primaire :
https://gamingalexandria.com/ps2/Aliens%20Versus%20Predator%20Extinction/Aliens%20Versus%20Predator%20Extinction%20-%20Manual.pdf

**L'usure chiffrée de 0,8 PV/seconde** est un choix
d'équilibrage de Hive Warriors, **pas une statistique
certifiée du jeu de 2003**.

Une autre différence reste volontairement documentée :
la ressource d'infestation dans le jeu original récompense
en particulier l'implantation d'hôtes ; le code actuel de
Hive Warriors la crédite pour les pertes ennemies
confirmées, y compris à l'issue d'une incubation.
Ce **choix d'adaptation reste à réconcilier** avec une
économie d'hôtes canonique. Référence :
https://strategywiki.org/wiki/Aliens_versus_Predator%3A_Extinction/Walkthrough

## Travail intégré dans le code

`js/battlefield/FacehuggerExposure.js` propose une règle
pure et déterministe, sans allocations, tirs ni timers externes.
Elle cible uniquement un Xénomorphe `actorType=facehugger`,
vivant, en combat actif ou distant, sur les opérations où
l'écologie Extinction est activée (AFF-27).

- **Dans le Hive-Space de sa faction**, le Facehugger ne perd
  rien au titre de l'exposition. Les nodules ennemis ne le
  protègent pas.
- **Hors du Hive-Space**, il perd 0,8 PV par seconde de
  simulation, y compris sur les fronts lointains. La règle
  est indépendante de la fréquence de rendu et des FPS.
- Réserves, morts et autres castes/espèces ne subissent
  pas cette usure. La pause empêche l'avancée du temps.
- Les dégâts sont inscrits sur l'identité réelle de
  `BattleSimulation`, `damageTaken` et ses PV.
  Le gestionnaire de scène reçoit les nouveaux PV via
  le même callback de synchronisation que les soins,
  pour éviter de restaurer arbitrairement des PV
  depuis un avatar local.
- Si les PV atteignent 0, le Facehugger est déclaré
  **mort une fois** par `recordDeath`, avec une cause
  distincte (`facehugger_outside_hive_space`) et
  `killerFaction:null`. Il n'y a donc ni récompense
  d'ennemi tué ni naissance gratuite.
- La sauvegarde existante transporte déjà les PV,
  `damageTaken`, états et pertes. Le changement
  n'ajoute aucun champ requis et ne modifie
  ni `configDigest`, ni budgets, ni identités
  ni cartes de l'opération.

Le système d'infection persistante du commit
`aa9df7f3` reste séparé : un parasite déjà consommé
pour l'implantation est mort et n'est plus affecté
par l'exposition extérieure.

## Tests et limites de validation

Cinq tests Node ont été créés dans
`tests/facehugger-exposure.test.js` :

1. Facehugger dans sa zone, hors zone et sous un
   nodule d'une autre ruche ;
2. Mort par exposition, perte unique, aucune
   infestation gagnée, nombre d'unités constant ;
3. exclusion des réserves, morts, humains,
   synthétiques et autres castes ;
4. aucune activation hors d'AFF-27, pause et
   limites temporelles, reprise d'un ancien
   checkpoint sans nodule ;
5. un pas de simulation sur la vraie AFF-27,
   sauvegarde/reprise avec PV persistants et
   IDs strictement conservés.

Le workflow GitHub Actions `yhw-fidelity.yml`
inclut ce fichier dans la suite Node ciblée.
**Le nouveau lot n'est pas encore déclaré
réussi en CI tant qu'il n'a pas été exécuté**.

La suite complète du commit parent avait révélé
deux anciennes fixtures de bombardement orbital
qui ne simulaient pas `forge.ensureHonorReady` :
**1106 tests réussis sur 1108**. Le correctif
`a51f97c` expose la méthode dans les fixtures
et ajoute un test qui vérifie que la protection
des dépenses ne peut être contournée.

## Travail restant pour 1:1

- Vraie production d'œufs, capture/transport des
  hôtes, cocons et conversion biologique par caste ;
- économie de points d'infestation depuis
  l'implantation d'hôtes, sans crédits gratuits
  ni rupture des anciens checkpoints ;
- spores émis par Hive Nodes, Runners,
  Praetorians et Queen avec suivi des proies ;
- positionnement de nodules validé face aux
  collisions, aux rampes et aux terrains ;
- animations d'affaiblissement, de couvée et de
  croissance, modèles/images mesurés depuis les
  références de chaque œuvre et recette
  navigateur/WebGL avec mesures de performance.

**Cette passe améliore la cohérence de la
physiologie ; elle ne certifie aucun rendu ou
portage intégral 1:1 du jeu original.**
