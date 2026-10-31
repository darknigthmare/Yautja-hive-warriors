# Armées Musou — silhouettes lointaines instanciées, sans nouveau soldat

Date : 31 octobre 2026. PR #6.
Base : `95532dc4a810879bb287ff4b6f7fe2129ed49aae`.

## Pourquoi cette approche est fidèle au principe du jeu

**Yautja Hive Warriors conserve l'action-Musou de Dynasty Warriors** :
le personnage jouable attaque directement les soldats et officiers,
les alliances et les fronts changent au même moment. Les
caractéristiques propres à Alien/Predator viennent enrichir
ce noyau, et l'économie/commandement RTS d'AVP: Extinction
n'est pas copié.

Les missions allouent déjà des centaines de soldats par
bataille, mais le nombre d'acteurs physiques détaillés
simultanément est plafonné par la simulation.
L'enjeu est de **voir des armées au loin** sans faire
tourner des centaines de rigs, navmeshes, projectiles,
IA et mises à jour à chaque frame.

## Réalisation `BattleCrowdProjection`

`js/graphics/BattleCrowdProjection.js` regroupe
les **unités stratégiques déjà existantes dont
l'état est `distant`** dans quatre
`THREE.InstancedMesh` légers :

| Silhouette de faction | Nombre maximal de copies VISUELLES |
|---|---:|
| Yautja | 80 |
| Xénomorphes | 80 |
| Humains | 80 |
| Synthétiques | 80 |
| **Total simultané** | **320** |

Un `InstancedMesh` est un rendu instancié,
pas un PNJ de jeu supplémentaire. Il ne reçoit
aucun `battleUnitId` nouveau, n'apparaît
pas dans `BattleActorBridge.actors`,
ne peut pas être frappé ou sélectionné, n'a
aucune IA, aucune attaque, aucun score de mort
et aucune réserve.

L'instance disparaît du lot si l'identité
change d'état (`active`, `reserve`,
`dead`, etc.), notamment lors de la
matérialisation de son vrai modèle 3D.
Ainsi un soldat ne doit jamais être visible
simultanément sous forme détaillée ET comme
copie lointaine.

### Limites de rendu et performance

- Une silhouette ne se dessine qu'entre
  **34 et 205 unités** d'au moins un des
  joueurs vivants : les bulles des deux
  joueurs coopératifs s'appliquent
  simultanément, sans silhouette fantôme
  dans la zone de combat au corps à corps.
- Le rafraîchissement des matrices est
  limité à **2,5 Hz** (une fois toutes les
  0,4 s), indépendamment du taux de FPS.
- Quatre draw calls au maximum pour ce
  système, une géométrie peu détaillée
  partagée et quatre matériaux sobres,
  sans ombres supplémentaires.
- Les positions/altitudes viennent de
  la simulation et de `EnvironmentManager`
  (contrôle du sol physique lorsqu'il est
  disponible). Un sol invalide ne produit
  pas une silhouette flottante.
- Un nombre maximal de 80 silhouettes
  par espèce est choisi de manière
  déterministe selon la distance et l'ID.
- Les nouvelles données ne sont pas
  sauvegardées, car elles peuvent être
  reconstruites depuis les soldats
  préalloués ; aucun changement de
  digest, de contenu de partie, de
  nombre d'alliés ou de boss.
- `BattleOperationLifecycle` libère la
  géométrie, les matériaux et les objets
  instanciés au retour au menu ou lors
  du lancement d'une nouvelle opération.

Ces valeurs sont un **premier budget visuel
évolutif**, pas une mesure définitive de
performance console ou mobile.

### Provenance et fidélité visuelle

Les silhouettes sont des **formes originales
provisoires** (capsules à quelques polygones,
variées en dimensions/couleurs). Elles
ne sont **pas** des reproductions mesurées
des modèles de Jungle Hunter, Wolf, Feral,
Working Joe, des Marines ou des castes
xénomorphes. Leur but est de combler
visuellement le monde jusqu'au remplacement
par des LOD propres à chaque incarnation.

`visualFidelity1to1Verified:false`
est conservé sur tous les lots.
La fidélité visuelle réelle doit être
comparée à des références par œuvre
et vérifiée sur plusieurs distances.

## Tests

Six tests Node/Three sont ajoutés dans
`tests/musou-distant-crowd.test.js` :

1. centaines d'identités existantes,
   quatre InstancedMesh, 320 copies
   maximales et zéro nouvel acteur ;
2. disparition lors d'un passage
   en détail, mort ou entrée en
   réserve et exclusion de la zone proche ;
3. deux joueurs / bulles de proximité ;
4. fréquence de mise à jour et
   interdiction des silhouettes
   flottantes sur un sol absent ;
5. libération mémoire et absence de
   nouveaux IDs après disposal ;
6. vraie simulation AFF-27 : conservation
   de ses **952 unités**, du digest et
   de ses budgets.

Le test est intégré au workflow GitHub
Actions Node 24 / Vite / Chromium. La
réussite est à confirmer sur le
**nouveau commit**, pas à déduire
du résultat du commit précédent.

### Évolutions restant à faire

- Remplacer les capsules par des
  modèles de LOD réellement distincts
  selon caste, costume et équipement,
  sans confondre les supports humains,
  les Xénos et les clans Yautja.
- Transition lissée entre visuels
  instanciés et véritable modèle proche,
  dans les deux vues coopératives.
- Animation de mouvement des armées
  à partir des routes, formations et
  cadences réelles.
- Occlusion par les bâtiments sur
  plusieurs hauteurs, streaming des
  silhouettes et cache des collisions.
- Benchmarks matériels (CPU, GPU,
  draw calls, FPS, heap) en plein
  combat de grande taille et test
  de la densité lors de l'AC-130,
  navettes et arrivées massives.
- Coop, bots en combat, véhicules
  et cinématiques de la franchise
  doivent rester cohérents avec
  le déplacement de leurs groupes.

**Statut : amélioration du rendu lointain
à faible coût GPU, aucune fidélité
visuelle 1:1 certifiée.**
