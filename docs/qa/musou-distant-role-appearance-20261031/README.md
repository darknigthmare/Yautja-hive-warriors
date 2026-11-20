# Yautja Hive Warriors — rôles visibles dans les armées lointaines

Date : 31 octobre 2026
PR #6, parent `6081e18633fd9de605b59f862ed20a30728c9459`.

## Pourquoi distinguer les silhouettes ?

Le mode principal est un **Musou façon Dynasty Warriors** :
le joueur combat réellement au cœur d'une bataille dont les autres
fronts évoluent en parallèle. `BattleCrowdProjection` affiche déjà
jusqu'à 320 silhouettes de soldats **déjà alloués** sous forme de
quatre `InstancedMesh` (Yautja, Xénomorphes, Humains, Synthétiques).

Ces silhouettes partageaient auparavant la même hauteur, largeur
et couleur pour toutes les castes de la même espèce. Une Queen,
un Facehugger ou un Runner pouvait ainsi sembler être un Warrior.
Les spécialistes Marines et les Working Joes n'étaient pas
distinguables des autres types de leur grande famille.

## Ce qui est effectivement ajouté

`js/graphics/DistantCrowdRoleAppearance.js` conserve une table
**immuable et mise en cache** de **25 profils de forme/couleur**
pour les quatre espèces. Elle résout les castes et spécialistes
**à partir de leur identité/profil source déjà présents**, y
compris les rôles Drone, Medic, CommTech, Sniper, SADAR et
Exosuit encodés dans les formations Extinction.

- **Xénomorphes** : Warrior de base ; Runner plus petit,
  Drone distinct, Spitter, Prétorien élargi, Queen plus haute
  et Facehugger proche du sol.
- **Humains** : Marines, Smartgunners, Flametroopers,
  Medic, CommTech, Sniper, SADAR, Exosuit et officiers.
- **Synthétiques** : Working Joe coloris industriel
  distingué du Weyland-Yutani Combat Synthetic.
- **Yautja** : combattants courants et officiers
  présents dans les effectifs de l'opération.

Les variations modifient uniquement les matrices
d'instances et leur `instanceColor`. Le matériau de
base est blanc pour autoriser les teintes. Les couleurs
Three.js sont mises en cache, sans nouvelle ressource par
PNJ. Le nombre de lots de rendu reste **quatre**, le
plafond reste **80 individus par espèce**, et le rafraîchissement
reste fixé à **2,5 Hz**. Les objets restent sans ombre
et sans raycast, donc impossibles à attaquer ou sélectionner
comme de véritables adversaires.

## Aucun renfort caché

La seule source des silhouettes est le dictionnaire
`BattleSimulation.units` en état `distant`. Les morts,
captifs, réservistes et combattants physiques actifs n'en
reçoivent pas. Une transition vers le combat proche retire
la silhouette sans changer l'identité du PNJ.

La méthode `getStats` expose désormais `byRole` à des fins
de QA, en plus des quatre compteurs `bySpecies`.
Le combat, les attaques, les statistiques, l'économie et
les checkpoints sont inchangés.

## Vérifications

Quatre nouveaux tests Node/Three :
1. castes Xénomorphes à hauteur et couleurs distinctes ;
2. rôles USCM et Seegson visuellement différenciés ;
3. les matrices/teintes réellement mises sur les
   `InstancedMesh`, disparition des unités mortes
   et **4 lots** toujours présents ;
4. 800 Xénomorphes alloués dont **80 rendus**, palette
   mise en cache et aucun nouveau combattant.

Le module pur a été exercé isolément sur les profils
Queen, Facehugger, Drone, Exosuit, Working Joe et
officier Yautja. Le test complet avec la version
`three` verrouillée attend la CI du nouveau commit.

## Limites de fidélité

Ces silhouettes restent des **capsules procédurales
colorées**, pas des meshes ou animations 1:1 des films,
comics, séries et jeux. Les variations de dimensions
sont des réglages de lisibilité de notre jeu, **pas des
mensurations officielles**. Un objet `InstancedMesh`
n'a pas encore de cycle d'animation de caste, d'état
d'armure ou d'arme propre au plan distant.

Les prochains travaux 1:1 demandent de remplacer
ces capsules par des modèles riggés par médias,
des armes et tenues référencées, puis de mesurer
coûts GPU/CPU sur des centaines de combattants,
notamment avec deux joueurs.
