# Mise en œuvre de l'audit

Le classeur et `audit-data.json` proviennent de la PR #3, commit `0435827e`. Leurs constats restent arrêtés au code `0f37cc52` (v65.5). La reprise intègre aussi les ajouts v66–v67 du `main` récent `9c18c19` et les fondations jouables de `1d52d9f` ; elle ne remplace pas ces branches par une copie du seul audit.

`Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.source.xlsx` conserve les octets originaux. Le fichier sans suffixe `.source` reçoit uniquement les cellules **N7:N132, Suivi**, après contrôle des preuves. Les constats, critères, références, styles, autres feuilles, 14 tableaux et 142 formules restent intacts. Le JSON d'audit demeure la source historique ; le suivi courant est `implementation-progress.json`.

## Catalogue consommable

`js/data/BattleCatalog.js` expose 115 profils sourcés, 34 propositions de cartes, 27 opérations, 62 modèles de groupes, 17 budgets, 40 scénarios de fronts, 39 rencontres et 70 références. `scripts/sync-battle-catalog.mjs --check` vérifie sa reproduction depuis l'audit préservé. Ce catalogue ne constitue ni 115 modèles rendus ni 34 cartes construites ou certifiées 1:1.

Les profils distinguent individu unique, stade de vie, combattant générique, civil, matériel, classe contextualisée et élément exclu ou non documenté. La validation refuse notamment les individus nommés dans une réserve générique, les clones de reine, les cadres de classification pris pour soldats et les rosters non documentés. Les règles d'arsenal séparent Jungle, City, Wolf, Feral et les classes Hunting Grounds ; elles restent des adaptations conservatrices liées aux références, pas une certification scène par scène.

`getBattleOperationConfig(id, options)` produit une configuration mutable privée pour le moteur : factions, relations, réserves finies, groupes et identités, fronts, routes et conditions. Les opérations sont marquées originales. Les allocations structurées sont conservées exactement ; les cinq lignes AFF-06 à AFF-10, qui expriment leurs comptes seulement en prose, sont traduites explicitement. Commandants, pilotes et personnages nommés remplacent des places allouées au lieu d'ajouter des combattants. Les civils et véhicules restent séparés du budget militaire.

Le plafond courant est provisoirement limité à **32 acteurs détaillés**, sans effacer les armées distantes. Le budget souhaité de l'Excel reste dans `desiredDetailedBudget` et `sourceDetailedBudget` ; les réserves et tous les IDs restent identiques. AFF-11 passe ainsi de 108 souhaités à 32 détaillés, AFF-27 de 136 à 32, tandis qu'AFF-01 garde ses 24. Dépasser 32 exige l'option expérimentale explicite ; ce plafond ne constitue pas un profilage matériel.

Les deux variantes humaines AFF-25 et AFF-26 exigent un contrôleur humain réellement disponible. Une proposition dépourvue de scène construite reste signalée comme terrain de biome adapté. Les objectifs narratifs sources restent distincts de leur mise en œuvre ; les critères d'origine ne deviennent pas automatiquement « terminés » parce qu'une configuration existe.

## Objectifs narratifs exécutables

`OperationObjectiveSpecs.js` traduit les 27 propositions en plans différents. `OperationObjectives.js` exécute les actions de proximité, canalisations à la touche E, archives transportées, interceptions de convois, sabotages des vraies sources, activations, libérations, escortes, défenses chronométrées, duels, trêves limitées et extractions. Le mode narratif désactive la victoire générique par capture des fronts. Une destruction de source, une capture ou une négociation modifie le moteur, et les différentes stratégies consultent ces états réels.

La mort d'un porteur laisse son chargement récupérable à sa dernière position ; elle ne crée pas un second gain d'objectif. Les personnes libérées conservent des identités et des PV séparés des soldats et suivent le chemin effectivement parcouru par leur guide. Les convois concatènent les couloirs du graphe physique, dans le bon sens, et refusent un trajet déconnecté. Le contrôleur appelle la résolution de mouvement du décor avec l'origine, la destination et le pas ; une extraction exige l'arrivée réelle du groupe. Une sauvegarde conserve canalisations, chargements, personnes, chemins et résultat sans rejouer les effets.

Les terminaux de déverrouillage choisissent des portes de contournement réelles, fermées au départ. La fermeture est refusée si elle couperait le graphe principal : le joueur peut toujours rejoindre le terminal par une autre voie. L'événement de réussite fournit les IDs de route et de portes au décor. Deux terminaux d'une même opération commandent des voies différentes, avec une conséquence physique et stratégique.

Chaque plan possède aussi une contre-offensive liée à une action précise. Le contrôleur l'annonce douze secondes avant le départ d'un groupe déjà alloué. Une trêve ou l'absence de forces/route annule la réaction ; elle ne crée aucun combattant. Les réserves de huit unités disposent d'une autorisation d'arrivée suffisante pour le groupe entier, avec cadence et plafond actif inchangés. Le budget trop petit aurait sinon bloqué leurs renforts définitivement.

`tests/operation-objectives.test.js` exécute les 27 plans avec le vrai moteur, puis vérifie annulation par dégâts/distance, pause, récupération en coopération, sabotage et trêve, contre-offensive causale, convoi avec coude, concaténation de routes indirectes, portes de contournement, escorte autour de deux murs à angle droit, registre des civils et reprise de sauvegarde. Les captures génériques seules ne gagnent aucune de ces opérations. Le rapport CPU `catalog-objectives-test.txt` inclut ces onze cas et les treize contrôles du catalogue et du classeur, dont les arrivées finies des 27 configurations initiales ravitaillées. Ce sont des tests automatisés, pas 27 parcours humains ni une certification de ressemblance visuelle.

## Suivi avec preuves

Le registre conserve chaque critère d'origine et un des états `À faire`, `En cours`, `À valider`, `Terminé`, `Bloqué`. Un état `Terminé` exige `acceptanceVerified: true` et au moins une preuve locale avec `kind` (`test`, `runtime` ou `review`), `path`, `sha256` et `scope`. La portée explique quel comportement du critère a été vérifié. Le script vérifie l'identité des 126 actions, leurs critères inchangés, l'existence et l'empreinte des preuves ; la responsabilité de la correspondance entre preuve et critère demeure celle de la revue.

```sh
node scripts/sync-battle-catalog.mjs --check
python3 scripts/update-audit-progress.py --check
python3 scripts/update-audit-progress.py --write --report docs/audits/2026-10-26/implementation-verification.json
node --max-old-space-size=2048 --test --test-concurrency=1 tests/battle-catalog.test.js tests/audit-progress.test.js tests/operation-objectives.test.js
```

Le script Python utilise uniquement sa bibliothèque standard. Il refuse d'écraser une autre modification du classeur, un critère réécrit ou une preuve dont les octets ont changé. Aucun test humain, mesure de performance sur le matériel des joueurs ou certification graphique 1:1 n'est déduit de ces vérifications structurelles.

## Reprise du 28 octobre

Le suivi courant contient **67 critères terminés, 44 à valider et 15 en cours**. La [revue des comportements CPU](../../qa/pr3-next-20261028/accepted-cpu-behaviors-20261028.json) clôt AUD-035, AUD-016, AUD-046 et AUD-107 après un passage indépendant de 83 tests avec sources inchangées pendant l’exécution et inspection des raccordements présents dans le produit. Il s’agit du secours réel d’un allié, des difficultés à allocation identique, de la retraite suivie d’un renforcement fini obligatoire et du benchmark déterministe de recherche sur les vrais gestionnaires détaillés à 16 puis 32 acteurs. La [revue des terrains](../../qa/pr3-next-20261028/world-depth-reviewed.json) clôt ensuite AUD-058 et AUD-064 après 133 tests, 68 constructions semées parcourues et vérification des accès, couches physiques, rayons et plafonds des surfaces tactiques enregistrées ; elle ne prétend pas fournir un navmesh universel d'accessoires décoratifs.

La mesure de recherche reste sous 50 % du temps CPU échantillonné dans ce cas Node ; le temps de combat distant comprend aussi dégâts et décès et possède un libellé distinct. Ces critères ne certifient ni un budget FPS matériel, ni des testeurs humains, ni des modèles 1:1. AUD-071 est clôturé après onze vraies liaisons carte/boss et leurs parcours assistés sur le gel5089228. AUD-105 est clôturé pour le protocole de référence B : vingt échauffements puis dix relances mesurées strictement stables ; l'échec du protocole court A et la hausse résiduelle du heap restent documentés. Aucun P0 ne reste ouvert. AUD-126 est clôturé après revue des prompts, stocks, effets et quatre scénarios intégrés ; ses défauts historiques, les adaptations explicites et les preuves intermédiaires restent conservés.

La [revue des rencontres](../../qa/pr3-next-20261028/boss-depth-reviewed.json) clôt AUD-073 et AUD-078 : deux mini-boss gardent leurs acteurs/états/cibles avec le majeur, et les phases peuvent menacer un front secondaire par des groupes déjà alloués, avec des issues et sans effacer les objectifs accomplis. Le checkpoint Prey et ses neuf flags consommables, Sarii, entrée de boue et feu restant sont également testés ; les derniers libellés et la recette intégrée restent distincts. La répétition de recherche après la nouvelle horde conserve les choix déterministes sous50% dans ce cas, mais ses temps globaux×3,63/×3,28 ne sont pas présentés comme une accélération générale.

La [revue finale de coordination](../../qa/pr3-next-20261028/coordination-feedback-reviewed.json) clôt AUD-074 après 24 tests indépendants sur le commit `a2252775`, avec sources/tests inchangés. Un vrai décès de contrôleur de ruche réduit sa coordination à65% et l'annonce nomme cette conséquence, le groupe et le front dans HUD/carte/débrief. Les mêmes régressions confirment qu'un allié déjà secouru devenu mort, capturé ou évacué à distance ne conserve pas un faux statut vivant à la reprise. Le compteur du HUD distingue désormais fronts et vagues ; la capture de production appartient à la recette intégrée.

Le classeur source et les critères historiques restent intacts. Le [rapport du writer](implementation-verification.json) contrôle les 126 actions et ne permet de changer que les cellules Suivi N7:N132. Le build, les preuves et les comptes de la livraison antérieure ci-dessous restent une photographie distincte.

## État vérifié avant la reprise du 28 octobre

Le suivi courant contient **54 critères terminés, 47 à valider et 25 en cours**. Chaque critère terminé possède une portée et des preuves locales épinglées. Les clôtures valident des comportements, contrats, raccordements ou revues selon leur critère ; elles ne signifient pas que tous les personnages sont reconstruits à l'identique. Les deux P0 restant à valider concernent les rencontres finales de tous les lieux/configurations avant lancement (AUD-071) et dix relances identiques instrumentées (AUD-105). Deux installations propres et builds identiques sont désormais prouvés pour AUD-114 ; les gardes de publication sont locales, aucune protection GitHub/CI distante n’est revendiquée.

La suite finale comprend **653 tests CPU réussis**. Le rapport `qa/runtime-c518-11-biomes-4-ops.json` conserve onze démarrages/insertion/nettoyage, puis quatre smokes d'opération. Les premières rencontres des onze lieux utilisent explicitement une fixture d'un combattant ; aucune victoire de mission n'est revendiquée. La reprise du registre, les commandes de carte, le plafond et les identités, ainsi que la Queen via son vrai manager, sont vérifiés dans le navigateur.

Le rapport incrémental `qa/runtime-48b5-incremental-charon-4-ops-photo.json` couvre Charon, les quatre opérations, l'ouverture/fermeture de la photo avec O et le bilan traduit après les correctifs d'interface. Il conserve l'empreinte du dist avant/après et zéro erreur JavaScript, requête échouée ou accès externe. Les onze lieux antérieurs restent une preuve distincte : ils ne sont pas recomptés comme onze nouveaux parcours sur chaque changement d'interface.

La négociation AFF-11 démarre avec la vraie touche E, mais les dégâts interrompent sa canalisation. Le camouflage est activé avec F ; il ne rend pas le joueur invulnérable. La complétion de cette négociation est donc vérifiée côté CPU seulement, et non présentée comme une réussite complète dans le navigateur. Le bilan Queen provient d'une mort du joueur assistée pour tester la défaite et la réconciliation des états ; aucun boss vaincu n'est fabriqué.

Les rapports `catalog-objectives-test.txt` et `catalog-objectives-verification.json` gardent le contrôle historique de 24 composants avant l'ajout du plafond provisoire. Pour le candidat final, se reporter aux preuves CPU, aux rapports de navigateur et aux empreintes de `implementation-progress.json` / `implementation-verification.json`.
