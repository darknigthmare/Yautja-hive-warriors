# Yautja Hive Warriors — garde-fous de navigation physique des armées
Date : 31 octobre 2026
Base : `65bc58d6f17fcb61732261883c880662f945744b` · PR #6.

## But : mouvement Musou, jamais contrôle RTS d'Extinction

Le jeu conserve son action Musou : le joueur combat en personne,
les alliés avancent et les fronts adverses évoluent en parallèle.
Les castes et armes de l'univers Alien/Predator sont source-scoped,
mais l'algorithme de navigation est original au jeu.

Cette passe traite la **sécurité des trajets physiques** des
PNJ déjà existants. Elle n'ajoute aucun soldat, renfort, boss,
modèle, carte ni état de sauvegarde.

## Bug corrigé dans BattlefieldNavigation

Avant cette passe, `waypoint` décidait qu'une route était directe
dès lors que la **ligne géométrique ne rencontrait pas de
collider**, sans vérifier qu'elle restait sur un sol construit.
Surtout, si un obstacle divisait entièrement la salle et que
la recherche A* échouait, l'expression
`cached.points[0]?.clone() ?? goal.clone()`
renvoyait **la destination interdite**.

Selon le gestionnaire de mouvement, cela pouvait faire insister
l'acteur contre le mur, couper un passage ou masquer un chemin
réellement impossible par des tentatives répétées.

Le correctif modifie **le routeur local uniquement** :

- une arête du maillage de navigation est valide si elle
  traverse réellement l'union des pièces et corridors
  déclarés, avec marge de capsule ;
- les cellules sans sol ne sont plus considérées libres
  par le maillage A*, même si elles n'ont pas de collision
  visible ;
- le raccordement d'un acteur aux cellules vérifie
  également le sol entre sa position et la cellule ;
- le raccourci direct doit à la fois être **sans collision**
  et **entièrement supporté par le sol** ;
- lorsqu'un obstacle vient de se fermer, le prochain point
  du chemin cache est revérifié ; si nécessaire la recherche
  locale est refaite ;
- si aucun détour réel n'existe, la méthode renvoie la
  **position actuelle** et ne force plus un passage à
  travers un mur ou un vide ;
- lorsqu'un petit obstacle possède un chemin de
  contournement praticable, les unités restent capables
  de le suivre : l'IA n'est pas immobilisée par défaut.

Les règles existantes de hauteur et de passerelle,
de portes physiques et de mouvements verticaux ne sont
pas effacées. La modification se limite à
`js/engine/BattlefieldNavigation.js` et ne touche
pas à `BattleSimulation.configDigest`.

## Tests reproductibles

`tests/battlefield-nav-safety.test.js` ajoute cinq tests
Three.js/Node :

1. mur occupant toute la largeur d'une pièce :
   l'agent reste en place puis repart après retrait
   effectif du mur ;
2. absence de sol entre deux zones pourtant
   visuellement dégagées : aucun saut de plancher ;
3. caisson convexe contournable : l'agent rejoint
   sa cible par des déplacements courts et
   sans pénétration du caisson ;
4. couloir séparé par une porte :
   interdiction tant qu'elle est fermée,
   parcours autorisé lorsqu'elle est ouverte ;
5. destination invalide et scène simple :
   le mouvement existant reste correct.

Ces cas ont été **répétés en V8 isolé sur le corps
exact de BattlefieldNavigation**, avec un
`Vector3` minimal : mur impossible et dalle
discontinue ont conduit à un arrêt ; petit
obstacle contourné en 73 pas, sans collision ;
porte fermée refusée puis passage ouvert.
Ce sont des contrôles de logique, **pas**
une recette WebGL ou GPU.

Le workflow `.github/workflows/yhw-fidelity.yml`
exécutera en amont les nouveaux tests
ainsi que la suite `helipad-navigation-regression`,
qui utilise un véritable EnvironmentManager avec
une rampe, des colliders, une porte et un
couloir réel. Le résultat CI doit être lu sur
le nouveau commit avant d'être déclaré réussi.

Avant ce correctif, sur le SHA `65bc58d6`,
les contrôles GitHub Actions ont terminé :
**122/122 tests ciblés et 1 151/1 151 tests
Node/Chromium complets réussis**, zéro échec
et zéro test ignoré.

## Invariants préservés

- Aucun groupe n'est ajouté : les 27 opérations
  Musou gardent leurs budgets et leurs réserves.
- Les soldats morts, captivés et blessés ne sont
  pas réinitialisés par un échec de navigation.
- Les anciennes cartes et sauvegardes conservent
  leurs IDs, fronts, profils et `configDigest`.
- Les portes fermées, les rampes et les obstacles
  physiques restent autoritaires ; la navigation
  n'est pas une commande RTS en vue dessus.

## Éléments encore incomplets

La connexion entre **toutes** les routes lointaines et
les volumes à plusieurs hauteurs, la détection des
murs dynamiques à l'intérieur des voies de renfort,
la collision avec de grands véhicules et la
navigation simultanée de dizaines d'acteurs
doivent encore être évaluées en scène. Il faut
également comparer les modèles, armes, mouvements
et textures à leurs incarnations media et tenir
les preuves de performance GPU. Cette passe ne
revendique **aucune conformité 1:1** de décor,
armes ou silhouette.

## Exécution sur checkout complet

```bash
npm ci
node --test --test-concurrency=1 \
  tests/battlefield-nav-safety.test.js \
  tests/helipad-navigation-regression.test.js \
  tests/original-musou-staging.test.js \
  tests/operation-scene-integration.test.js
npm run build
npm test
```

## Deuxième passe — matérialisation dans le décor réellement construit

Le placement logique de `OriginalMusouStaging` fonctionne dans
les bornes des secteurs, mais certains **piliers, caisses,
mécanismes et portes fermées** ne sont installés que lors de
`Environment.buildLevelEnvironment`. Un point situé sur
le sol du secteur peut donc rester bloqué par un objet 3D.

Pour les **nouveaux scénarios AFF-06..10 en
`deploymentPlan:'authored'` uniquement**, le
`BattleActorBridge.spawnGroup` consulte maintenant
`BattlefieldNavigation.safeSpawnNear` :

- Contrôle la présence réelle du sol et la hauteur locale.
- Contrôle les obstacles/colliders physiques actuellement actifs,
  y compris les portes fermées et les tranchées dangereuses.
- Réserve l'empreinte des autres acteurs déjà matérialisés,
  sur le même niveau, pour éviter leur chevauchement.
- Recherche une solution déterministe **dans le même secteur**,
  au plus à **18 unités** de l'emplacement prévu. Les
  positions de groupe et d'unité signées par la simulation
  ne sont jamais éditées en secret ; seule la position
  de l'acteur physique nouvellement matérialisé est adaptée,
  avant la synchronisation normale de ses coordonnées.
- Si aucune place légale n'existe, la matérialisation du
  **groupe entier échoue atomiquement**, tous les acteurs
  déjà créés dans cette tentative sont supprimés, et la
  simulation conserve ses identités distantes pour une
  nouvelle tentative. Aucun PNJ n'est jeté dans un mur.

Ce contrôle est **exclu des checkpoints
`historical-fallback`** pour ne pas modifier leurs
anciennes positions ou leur logique. Les autres
opérations ne changent pas.

### Preuves additionnelles

- Un test V8 isolé utilisant les véritables corps
  `BattlefieldNavigation.safeSpawnNear` et
  `BattleActorBridge.spawnGroup` a projeté
  **4 combattants originaux** autour d'un pilier
  de 6 × 6 unités, conservé les positions
  stratégiques et vérifié la distance entre
  les acteurs (**2,44 unités minimum observées**).
- Le même essai avec une pièce intégralement
  obstruée a déclenché un **refus complet et
  rollback sans aucun acteur résiduel**.
- **5 tests Three.js** sont ajoutés dans
  `tests/musou-spawn-clearance.test.js` :
  placement physique autour d'un pilier,
  rollback complet, maintien d'un point déjà
  libre, non-migration historique et
  conformité aux portes réellement fermées.
  Ils doivent passer la CI complète du
  nouveau commit avant toute affirmation
  de validation intégrée.

Ces solutions sont des règles de mouvement
originales pour un Musou et non une reproduction
du contrôle RTS d'*AVP: Extinction*. La présence
de plusieurs niveaux, les plateformes suspendues,
les volumineux véhicules et les boucles de groupe
sur des routes longues nécessitent une vérification
WebGL et des tests avec du vrai matériel.
