# Batailles persistantes : groupes, fronts et réserves

`js/battlefield/BattleSimulation.js` conserve les identités d'une armée finie pendant une opération. Les états **actif**, **distant**, **réserve**, **mort**, **évacué** et **capturé** sont exclusifs. Le total de ces états reste égal à l'allocation initiale de chaque faction. Un officier occupe une place du groupe ; il n'est pas ajouté au-dessus de l'effectif annoncé. Le joueur est compté séparément.

Ce système est une adaptation de jeu. Ses nombres, vitesses, rôles génériques et règles de moral ne constituent ni un ordre de bataille canonique ni une certification visuelle 1:1.

## Deux sources de configuration

- `createBattlefieldOperation(layout, options)` construit un scénario original à trois camps et trois fronts : **20 Yautja alliés, 64 xénomorphes et 48 humains**, dont des réserves finies. Le plafond de détail est global et partagé entre les deux joueurs ; il est réglable indépendamment du nombre de combattants distants.
- `getBattleOperationConfig(id)` lit les 27 propositions du catalogue. `bindBattleOperationToLayout(config, layout)` les place dans les salles et passages effectivement construits, en conservant leur effectif et leurs IDs. Le binding conserve dans `sceneBinding` la proposition initiale et indique explicitement qu'une adaptation de scène n'est pas un relevé géographique certifié.

Les 34 variantes de terrain exposent leurs ancrages et leurs vraies routes stratégiques. Les routes utilisent des polylignes dans les secteurs et couloirs. Le moteur choisit le trajet ouvert de moindre durée ; il ne remplace pas un détour par une diagonale à travers le décor. Un groupe déployé dans une salle rejoint d'abord son ancrage avant de prendre le couloir. Une fermeture en cours de traversée immobilise le groupe à sa position, sans retour instantané au front précédent ; la cause de blocage est enregistrée.

## Autorité et représentation

`spawnGroup(group, units)` matérialise les mêmes IDs dans les vrais gestionnaires d'acteurs. Cette opération doit être atomique : si un acteur ne peut pas être créé, l'adaptateur retire ceux déjà créés et retourne `false`. Le moteur retente après trois secondes ; il n'invente pas de renfort pour remplir le budget.

`despawnGroup(group, units)` retire seulement la représentation détaillée et peut retourner les PV et positions réelles. Il ne doit pas appeler le traitement de mort, ajouter du score ou supprimer l'identité stratégique. Le moteur garde les blessés, les chefs et les pertes lorsque le joueur change de front. Il ne matérialise pas une nouvelle unité à moins de 24 unités de l'un des joueurs vivants. Les groupes sur deux fronts se partagent les créneaux de détail par rotation, au lieu de donner tout le budget au premier joueur.

Le combat distant applique simultanément les attaques des deux camps en présence, selon leur matrice de relations, leur profil, leur ordre et leur cohésion. **Il ne cible ni le joueur ni une unité matérialisée.** Les unités détaillées reçoivent les dégâts du jeu réel et leurs décès sont remontés par `recordDeath`. Le moteur distant est une abstraction stratégique : il ne reproduit pas la trajectoire de chaque projectile ni les collisions détaillées.

## Réserves, bases et causalité

Un groupe de réserve existe dès le lancement. Son arrivée nécessite une source vivante appartenant à sa faction et un trajet ouvert. L'annonce précède l'arrivée d'au moins trois secondes. La perte de la source ou du passage annule une arrivée encore en route, en laissant les unités dans la réserve. Aucune réserve ne devient négative et une réserve épuisée n'est pas recréée.

Une base sans défense hostile peut être capturée par une présence prolongée. Une base contestée n'avance pas sa capture. Changer de propriétaire modifie les sources, les routes disponibles et la cohésion locale. Perdre un front critique annonce un délai de réaction ; le reprendre annule ce délai. Saboter une source ne crédite aucun mort fictif.

Les factions humaines utilisent un moral, les cellules Yautja une cohésion et les xénomorphes une pression de coordination de ruche. Une perte d'officier affecte son groupe et les groupes de sa faction sur le même front. Les xénomorphes ne reçoivent pas automatiquement une peur ou une retraite humaine : la perte de leurs sources modifie leur coordination et leur efficacité distante.

Un capitaine vivant peut recevoir une délégation. Les officiers ennemis et les groupes délégués prennent des décisions périodiques, gardent une garnison et progressent par les routes ouvertes. Les ordres explicites remplacent l'ordre précédent une seule fois, avec leur auteur ; deux joueurs ne créent pas deux chemins contradictoires à chaque frame. Les tactiques `pincer`, `hold_line`, `ambush` et `fallback` modifient formation, cible et efficacité, avec durée et recharge bornées. Leur impact local dépend de l'adaptateur d'acteurs qui applique ces directives.

## Objectifs narratifs et fin de partie

Un scénario simple peut gagner par contrôle de fronts ou par une stratégie alternative explicite. Les opérations narratives du catalogue placent `objectives.externalVictory = true`. Dans ce cas, une capture générique ne termine pas la partie avant les archives, l'extraction ou le convoi exigé par `OperationObjectives`. Les défaites stratégiques et les délais restent contrôlés par la simulation. Le contrôleur narratif valide ensuite la victoire avec `finishOperation({outcome, reason})`.

Un décès porte un ID stable et n'est enregistré qu'une fois, qu'il vienne d'un joueur, d'un allié, d'un piège ou du combat distant. Le journal des pertes reste borné par l'effectif initial. Les rapports courants conservent les 512 derniers événements, avec un compteur explicite des événements plus anciens ; les pertes individuelles restent conservées séparément.

## Sauvegarde et contexte

`saveState()` sérialise les identités, PV, groupes, ordres, routes, diplomatie, fronts, réserves annoncées, horloges, pertes et résultat. `BattleSimulation.fromState(config, saved, callbacks)` exige le même identifiant et l'empreinte de configuration. Il refuse les duplications, allocations incompatibles, routes réécrites, états invalides, compteurs non réconciliés et horloges non finies. Les représentations actives redeviennent temporairement distantes lors du rechargement ; les mêmes IDs sont rematérialisés sous le plafond du moteur, avec leurs PV conservés.

`getCampaignConsequences()` conserve notamment les individus uniques vaincus. Une opération suivante recevant cet historique ne recrée pas ces individus. Les pertes héritées sont distinguées des pertes de l'opération en cours.

Les modes `reconstruction`, `clan_war`, `original` et `crossover` sont explicites. Les contextes d'œuvre, d'époque et de continuité, les profils exclus du spawn et les individus uniques sont validés avant de créer un acteur. Un profil original ne devient pas une reconstitution vérifiée simplement parce qu'il est chargé dans un lieu de film. Les 115 fiches du catalogue restent des fiches sourcées, distinctes des modèles 3D réellement disponibles.

## Vérification reproductible

```sh
node --max-old-space-size=2048 --test --test-concurrency=1 tests/battle-simulation.test.js
```

Les tests couvrent les allocations des 27 opérations, les polylignes praticables des 34 variantes, deux fronts visibles, le passage proche/distant d'unités blessées, les trêves, les morts dupliquées, les réserves finies, le sabotage d'une arrivée, les passages fermés, les stratégies, les commandes, les tactiques, la coordination de ruche et les sauvegardes invalides.

## Renseignements, formations et continuité originale

`BattleIntel` sépare les données réelles de la connaissance tactique. `getHUDState()` omet les groupes hostiles inconnus et conserve la dernière position effectivement observée des groupes hors contact. `intelState` distingue `unknown`, `observed`, `detected`, `reported`, `stale` et le bilan `debrief` ; `observedAt`, `receivedAt`, `reportSource` et `reportAge` indiquent l'âge réel de l'information. Les rapports alliés sont observés toutes les huit secondes puis acheminés après quatre secondes de temps de jeu. Recevoir un rapport ancien ne rafraîchit pas ses PV ou sa position. Les informations derrière un mur sont refusées lorsque le pont de jeu fournit `callbacks.canObserve(value, observer)` avec la visibilité de l'environnement.

`revealGroup(id,{duration,source})` donne une détection temporaire, sans créer d'acteur ni causer de dégâts. Les compagnons paient leurs charges dans leur propre système ; cette API de simulation ne crée aucune monnaie. La pause suspend l'observation, les transmissions et la durée de reconnaissance. Les rapports en route et les positions connues sont sérialisés. `intelCounts` est destiné à l'affichage partiel des effectifs ennemis ; `getCounts()` reste la comptabilité complète de référence. Le journal tactique `getTacticalJournal()` ne divulgue un événement éloigné qu'après observation ou rapport. Les fronts et leurs périmètres connus restent disponibles dans `intelligence.regions` pour une carte avec information vieillissante.

Les formations `wedge`, `line`, `phalanx` et `dispersed` produisent de vraies destinations individuelles de déplacement. Elles ne téléportent pas les acteurs. Les impacts de balayage, rupture de ligne, tir de couverture et flanc modifient la cohésion avec une déduplication par attaque ; une immobilisation brève et une suppression ont une échéance finie. Le rétablissement dépend d'un officier vivant. `setFormation` peut planifier pendant la pause, sans avancer les acteurs. Les PV de l'officier figurent dans le groupe HUD. Un pont détruit peut refuser sa réouverture grâce à `routeAvailabilityProvider`, même si un terminal est activé ensuite.

`BattleCampaignRecord` propose uniquement l'arc original explicitement choisi AFF-01 à AFF-05. Les presets indépendants ne reçoivent aucune chronologie commune par défaut. Les morts et captures nommées confirmées sont persistantes, y compris avant la fin de l'opération ; un vieux checkpoint ne peut pas ressusciter une personne déjà confirmée morte. Revenir au menu suspend la partie, alors qu'un abandon explicite finalise le run. Soixante-quatre bilans détaillés et 512 identifiants de finalisation évitent le double enregistrement ; une fois le budget atteint, un nouveau reçu est refusé plutôt que de supprimer l'historique d'idempotence. Un stockage corrompu reste intact jusqu'à la réinitialisation explicite de cet arc.

La reconnaissance sociale `ClanRecognition` utilise des résultats confirmés et les preuves du véritable contrôleur d'objectifs : service de mission, défense, extraction de preuves ou accord local. Le briefing et le débrief réagissent au personnage choisi et aux pertes nommées pertinentes. Ces distinctions sont des règles originales du projet : elles ne promeuvent pas automatiquement un chasseur à un rang canonique à partir des KOs. Aucun bonus de statistiques, point d'honneur ou trophée n'est accordé par ce registre. Les clés de stockage de l'honneur et des trophées ne sont jamais modifiées.

Tests ciblés supplémentaires : `tests/battle-intel.test.js`, `tests/battle-campaign-record.test.js` et `tests/clan-recognition.test.js`. Ces parcours CPU vérifient les composants et leurs contrats ; ils ne constituent pas une victoire jouée dans le navigateur ou une validation visuelle humaine.

Une simulation de **20 minutes accélérées** de 952 PNJ vérifie la conservation des identités et les combats réciproques. Un autre scénario produit le même état à 30, 60 et 120 FPS simulés. Ces contrôles CPU ne constituent pas un playtest humain de 60 minutes, une mesure de FPS sur matériel de jeu ou une preuve de fidélité visuelle 1:1. Les combats détaillés, les commandes HUD et les performances de rendu doivent être contrôlés dans le build intégré.
