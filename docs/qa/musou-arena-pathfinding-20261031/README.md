# Musou — navigation des arènes et contact avec les véhicules

État de départ : PR #6 `d24407289bffce5f5e331a7ccd05f6e19446f05f`.
Date : 31 octobre 2026.

## Régression constatée avec la suite complète

Le nouveau système de transport à dénivelés et les silhouettes
instanciées des fronts distants sont déjà dans la branche.
Le job Vite/Node ciblé est vert et la preview Vercel a été
déployée. La suite intégrale sur ce SHA a toutefois relevé
**1176/1178 tests réussis** :

- un Working Joe du scénario de test n'a pas réussi à
  endommager l'APC (l'APC a gardé ses 2500 PV) ;
- sur `xenomorph_prime`, un parcours de l'IA depuis
  une direction du périmètre n'a pas atteint la cible
  dans le nombre de pas prévu.

Aucun de ces échecs n'est masqué ni retiré des tests.
Ils sont ajoutés au **job ciblé** avec leurs diagnostics
de position et de préparation d'attaque, de manière à
réparer réellement le problème avant un nouveau merge.

## Cause structurelle traitée

Le routeur `BattlefieldNavigation` utilisait A* pour
les cartes divisées en secteurs, mais renvoyait directement
`[target.clone()]` depuis `localPath` dans les arènes
classiques (sans `battlefieldLayout`). Depuis l'ajout
du garde qui refuse de traverser un mur, ce fallback
pouvait laisser un poursuivant immobile face au décor.

Le nouveau calcul :

- crée un maillage A* **borné** pour les arènes
  classiques. Il utilise l'arène complète à taille
  habituelle et une fenêtre locale pour les grandes
  zones d'essai, afin de ne jamais griller une grille
  500 × 500 inutilement ;
- conserve la règle qu'aucun waypoint ne franchit
  un sol absent ou un collider actif ;
- permet de s'approcher de l'**extérieur d'un
  collider** lorsque la cible se trouve au centre
  d'une machine ou d'un pilier. Le waypoint final
  reste réellement praticable, jamais à l'intérieur
  de la coque ;
- conserve l'immobilisation si un mur ferme
  effectivement tout l'accès ;
- ne modifie pas les routes du mode guerre, les
  budgets, les factions ni les sauvegardes.

Les Working Joes attaquant un appui matériel
mesurent désormais leur **écart à la surface
de collision réelle** (rectangle orienté ou
cercle), pas simplement le centre de l'APC.
L'attaque reste conditionnée à l'hostilité et
à la ligne de vue du moteur ; un mur indépendant
ne peut pas être ignoré par `collisionOwner:'apc'`.
Cela protège la carrosserie sans autoriser les
attaques à travers le décor.

## Validation préparée

- Quatre nouveaux tests Node/Three dans
  `tests/arena-local-navigation.test.js` :
  obstacle contourné, coque inaccessible
  avec point de contact valide, mur fermé,
  et Working Joe contre APC avec protection
  par un vrai mur.
- Les tests historiques `levels.test.js`
  et `actor-vertical-support-targets.test.js`
  restent intacts sur le fond. Seuls leurs
  messages d'échec détaillent désormais la
  position réelle et la préparation de l'IA.
- Ces **trois fichiers** sont dans le job
  ciblé GitHub Actions, ce qui permet de
  détecter les deux régressions avant le
  job Chromium long.
- Le code et le rapport ne prétendent pas
  que les tests ont réussi avant exécution.

## Suite restant à compléter

La logique de contact physique est maintenant
unitaire, mais la cohérence absolue de
plusieurs hauteurs et grands véhicules
requiert encore la vraie recette WebGL.
Les 4 pools d'instances des armées distantes
sont des silhouettes originales économiques :
leur création ne remplace pas les sprites,
modèles, textures et animations 1:1 de
chaque œuvre *Alien/Predator*.

Le gameplay principal reste un **Musou
façon Dynasty Warriors**, pas une copie du
RTS *Aliens versus Predator: Extinction*.
