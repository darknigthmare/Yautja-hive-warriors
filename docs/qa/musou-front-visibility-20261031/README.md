# Affrontements parallèles Musou — visibilité des fronts avec quatre lots instanciés

Date : 31 octobre 2026
Branche : `codex/hive-nodes-ci-20261030` — PR #6
Base : `c631052d556538e606cff038971d0f5bd5b074a3`

## Défaut corrigé

Le jeu reste un **Musou d'action façon Dynasty Warriors**.
Le système `BattleCrowdProjection` affichait déjà jusqu'à
**320 soldats préalloués en quatre `InstancedMesh`**, mais
sélectionnait toujours les 80 individus les plus proches
dans chaque espèce, sans distinguer leur front stratégique.

Un premier front dense (par exemple 220 guerriers à 70 unités
du joueur) masquait donc entièrement une autre bataille en
cours plus loin, même si ses 35 combattants étaient encore
dans la distance de visibilité (175 unités).

Ce n'était pas une erreur de calcul de l'effectif, mais une
erreur de **représentation de plusieurs batailles parallèles**
— élément central de notre gameplay Musou, pas du RTS
*AVP: Extinction*.

## Modifications

Le module pur `js/graphics/MusouFrontVisibility.js` reçoit
des candidats **déjà comptabilisés**, et l'identité de leur
front vient exclusivement du dictionnaire des groupes de
`BattleSimulation` :

- Par espèce, chaque front visible reçoit une petite réserve
  **d'au plus 8 places** afin de ne pas disparaître
  derrière une armée voisine. S'il y a de nombreux fronts,
  le quota s'adapte pour rester sous la limite de 80.
- Toutes les places non utilisées reviennent aux combattants
  de cette espèce les plus proches des joueurs, triés
  de façon stable par distance puis ID.
- En coopération, la distance employée est toujours la
  **plus petite distance à l'un des joueurs**. Les
  silhouettes situées à moins de 34 unités d'un seul
  des deux joueurs sont masquées pour ne pas dupliquer
  les personnages de combat physiques.
- Une silhouette dont le sol est absent ou non praticable
  n'occupe aucune place : l'algorithme peut essayer les
  candidats suivants. Les sondages physiques sont
  **limités à 320 par espèce et par rafraîchissement**,
  afin que les scènes à plusieurs milliers d'unités
  ne multiplient pas sans borne les tests de collision.
- Le système ne déclenche ni aggro, ni dégât, ni ordre
  stratégique, ni visibilité secrète. Il n'expose
  aucune reconnaissance nouvelle au joueur.

La cadence reste **2,5 Hz**, les couleurs/castes
restent celles de la passe précédente, et le total
des `drawCallsAtMost` reste **4**. Aucun
nouveau mesh, matériau, ID, soldat ou ressource n'est
alloué en conséquence de la sélection.

## QA et performances

`getStats` fournit deux compteurs non intrusifs :
`byFront` pour la représentation de chaque
espèce sur chaque front, et `floorProbes`
pour le travail géométrique du dernier
rafraîchissement. Ce sont des métriques de
rendu local, **pas des effectifs supplémentaires**.

Cinq tests Node/Three dans
`tests/musou-front-visibility.test.js` couvrent :

1. 220 combattants d'un front proche et
   35 d'un second front plus loin :
   **80 silhouettes**, avec au moins 8 de
   la seconde bataille, toujours quatre lots ;
2. comportement historique pour une
   représentation sans métadonnées de groupe,
   et tri d'identités déterministe ;
3. 83 positions de troupe bloquées par le décor
   et 45 valides derrière : aucune place
   consommée par un sol invalide, sondages bornés ;
4. deux joueurs en coopération : masquage
   immédiat du front qui devient proche du
   second chasseur ;
5. plus de **1 200 soldats** enregistrés,
   30 réservistes, sol entièrement non praticable :
   zéro proxy flottant et au plus 320 sondages
   pour l'espèce Xénomorphe.

Ces tests sont ajoutés à GitHub Actions aux
tests de castes, de `BattleSimulation` et aux
parcours Chromium. Les cas de logique pure ont
été validés en JavaScript isolé avec une
répartition **72/8** sur les deux fronts.
**L'exécution intégrée sur Three.js verrouillé
reste à vérifier sur le nouveau SHA.**

## Fidélité 1:1 et limites

La répartition reflète enfin plusieurs
fronts réellement actifs dans le jeu, mais
les modèles visibles sont encore des
capsules procédurales. Les **vraies apparences
1:1** de Queen, Runner, Drone, Prétorien,
USCM, synthétiques et Yautja restent à
modéliser, rigguer, texturer et vérifier
pour chaque média source.

La mesure de FPS GPU sur des milliers de
combattants et les occlusions 3D des
étages/passages n'est pas certifiée.
Le plafond de 320 silhouettes n'est
pas une promesse de 320 personnages
physiques détaillés et animés en même temps.
