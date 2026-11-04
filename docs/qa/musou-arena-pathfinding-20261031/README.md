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

## Révision diagnostiquée après le premier job ciblé

Le commit initial de réparation a validé le build, le catalogue et
**187 tests sur 189**, mais les deux scénarios historiques étaient
encore rouges. Les nouveaux diagnostics montrent précisément :

- Le Working Joe restait à **(7,2 ; 14,62)**, sans aucune phase de
  préparation d'attaque, face à l'APC de 2500 PV.
- La poursuite sur `xenomorph_prime` restait bloquée à
  **(36,19 ; 13,27)** en visant (20 ; 0).

Deux causes ont été identifiées dans le vrai routeur :

1. **Cache périmé après retrait d'un obstacle physique** : les
   cellules libres d'A* correspondaient encore au mur supprimé.
   Le routeur invalide maintenant le cache et les chemins d'acteurs
   dès que le nombre/l'état des colliders actifs change, notamment
   lors de la destruction de véhicules. Il tient compte des
   déplacements approximatifs des colliders dynamiques.
2. **Approche du mauvais côté d'un obstacle** : plusieurs cellules
   sont aussi proches du centre d'un APC. L'ancien tri par ordre du
   tableau choisissait celle du côté opposé au poursuivant. Les
   égalités sont désormais tranchées selon la **distance depuis
   l'attaquant**, afin d'approcher la coque par sa face atteignable.
3. **Contact de quelques centimètres avec une rampe relevée** :
   le Xénomorphe se trouvait juste hors du bord de la rampe sud de
   la ruche (environ x=36,19 au lieu de la limite x=36,8).
   Une marge de navigation du collider pouvait encore déclarer
   son point de départ bloqué. La trajectoire est autorisée
   **seulement si la capsule quitte cette marge dans les 0,1
   première unité du mouvement**. Entrer dans la rampe par le mur
   ou traverser une cloison reste interdit.
4. Les arènes sans secteurs disposent maintenant d'une résolution
   de maillage **2 unités**, au lieu de 3, pour mieux reconnaître
   les intervalles étroits entre les structures de ruche.

Les méthodes exactes ont été essayées en JavaScript isolé avec
vecteurs compatibles Three.js : un chemin derrière un mur
reste bloqué et se réouvre quand le mur disparaît ; l'approche
de l'APC choisit sa face proche ; une capsule au bord de la
rampe se dégage vers le sol libre sans entrer dans la partie
élevée. Un test de rampe supplémentaire est ajouté dans
`arena-local-navigation.test.js`.

**Le nouveau run CI Node/Three doit confirmer ces changements sur
le vrai moteur : les essais isolés ne suffisent pas à certifier
les anciennes régressions résolues.**

## Fin de l'analyse de portée APC après le second run

Le commit `199264dd` a permis d'obtenir **189 tests réussis sur
190** : le parcours de `xenomorph_prime` est désormais **vert**
dans la véritable scène, et seul le Working Joe contre APC
restait rouge. L'androïde atteignait maintenant une **cellule
praticable (x=5,z=1)**, mais le calcul de portée mesurait
la distance entre son centre et la carrosserie.

Or les unités physiques possèdent déjà une **capsule de
collision de rayon 0,9**. À (5,1) près de la coque orientée
APC, le centre de l'androïde est à 2,48 unités de sa surface,
mais sa capsule n'est plus qu'à **1,58 unité** de celle-ci :
il est bien à portée de sa frappe nominale de 2,1 unités.
Le calcul `supportSurfaceGap` soustrait désormais le rayon de
la capsule attaquante de la distance au hull, en conservant
la différence d'altitude. Les rayons et colliders de l'APC
ne changent pas ; le test de **ligne de vue vers le support**
continue de vérifier séparément les murs et obstacles
indépendants, qui restent bloquants.

Cette troisième passe vise précisément le dernier cas rouge,
sans ajouter de dégâts, de munitions ou de portée magique.
Le dernier état Node/Three et Chromium doit être contrôlé
sur son propre SHA avant certification de ces régressions.
