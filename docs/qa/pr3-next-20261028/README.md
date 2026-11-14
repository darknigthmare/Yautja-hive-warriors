# Reprise de validation — 28 octobre 2026

Le point de départ conserve **54 critères terminés, 47 à valider et 25 en cours**. Les 72 critères ouverts ne sont pas 72 fonctionnalités inexistantes. Le [plan détaillé](acceptance-plan.json) conserve leur texte d’acceptation historique et leurs limites de preuve au début de cette reprise. Ce plan ne clôt aucun critère.

Les besoins se recouvrent : 20 actions demandent encore une implémentation ou revue de code, 12 demandent une référence externe ou un asset spécifique, 7 comprennent une mesure matérielle et 28 comprennent une revue visuelle ou humaine. Chaque action reste également soumise à une preuve d’intégration appropriée. Ces catégories préparent le travail ; elles ne réécrivent pas les critères et ne constituent pas des blocages automatiques.

Le classeur source et `audit-data.json` restent la photographie historique de la PR #3. Seules les cellules **N7:N132** du classeur de travail peuvent changer. Un résultat automatisé ne certifie ni cinq testeurs humains, ni le rendu des 115 fiches, ni la fidélité géométrique 1:1. Aucun crédit Meshy supplémentaire n’est autorisé dans cette passe.

Après la [revue CPU et des raccordements présents](accepted-cpu-behaviors-20261028.json), AUD-035, AUD-016, AUD-046 et AUD-107 sont terminés pour leurs comportements exacts. La [revue des terrains](world-depth-reviewed.json) clôt ensuite AUD-058 et AUD-064 : 133 tests, 68 constructions semées parcourues et accès d'un vrai USCM, rayons et plafonds des surfaces tactiques enregistrées. Le suivi passe à **67 terminés, 44 à valider et 15 en cours**. Les 83 tests indépendants ont gardé les mêmes sources pendant leur exécution ; la recherche détaillée à 16 puis 32 acteurs est mesurée séparément de la phase entière de combat distant. Le build intégré et sa publication restent un contrôle distinct.

La [revue des rencontres](boss-depth-reviewed.json) clôt AUD-073 et AUD-078 sur les vrais mini-boss coexistants et les menaces de phase avec issues sans remise à zéro. Les 79 tests et treize empreintes sources/artefacts/dépendances ont été vérifiés. La [correction finale de coordination](coordination-feedback-reviewed.json) clôt ensuite AUD-074 avec 24 tests indépendants sur le gel `a2252775` : groupe, front et conséquence65% nommés dans HUD/journal/débrief après un vrai décès de contrôleur. AUD-076 garde sa réserve sur les lectures/réponses individuelles. La [répétition du benchmark après la dernière horde](targeting-benchmark-integrated.json) conserve les choix déterministes et une recherche maximale35,91%→39,06% ; ses temps globaux×3,63 et×3,28 restent indiqués tels qu'observés, sans déduire une accélération globale ni des FPS matériels.

## Critères des lots actifs

| Action | Preuve nécessaire à la clôture | Limite à conserver |
| --- | --- | --- |
| AUD-035 — secours | L’allié rendu devient incapable, cesse de contribuer au groupe, puis un vrai secours rétablit son action ; interruption, mort, pause et reprise gardent la même identité. | Un soin ordinaire ou un nombre de PV restauré ne prouve pas cette boucle. |
| AUD-016 — difficulté | Deux réglages conservent composition, allocations et identités mais changent coordination, ressources ou timings de manière observée. | Augmenter les effectifs ou seulement modifier un libellé ne répond pas au critère. |
| AUD-046 — retraite | Le groupe suit un trajet réel, garde ses pertes et ne repart au combat qu’après un renforcement effectif. | Une remontée de moral seule ne justifie pas le retour. |
| AUD-047 — défaite | La cause affichée correspond au journal, et le délai permet une réaction cohérente avec le trajet physique considéré. | Un délai fixe testé sur une petite carte ne couvre pas tous les grands tracés. |
| AUD-058 — graines | Deux graines d’une même proposition produisent des cartes physiquement différentes, traversables et compatibles avec leur contexte. | Deux noms, couleurs ou aliases d’un même tracé ne suffisent pas. |
| AUD-064 — verticalité | Un véritable acteur utilise l’accès adapté ; dessous, dessus, saut, plafond et tir respectent leurs couches. | Le pont déjà testé ne constitue pas une navigation générale de tous les étages. |
| AUD-067 — guidage | La route principale et un contournement se distinguent par leurs repères et lignes de vue. | Un test de coordonnées seul ne certifie pas la compréhension humaine. |
| AUD-071 — boss | Les onze contextes actuels génèrent le boss annoncé ; une configuration invalide est rejetée avant toute partie. | Le critère historique dit dix cartes ; couvrir onze inclut le contexte ajouté. Ce contrôle ne mesure pas une ressemblance 1:1. |
| AUD-073 — coexistence | Deux mini-boss sur deux fronts gardent état et cible, même quand le majeur apparaît. | Compter deux entrées de tableau sans vérifier leurs acteurs ne suffit pas. |
| AUD-074 — officier | La mort d’un officier change immédiatement une capacité de son groupe ou de son front, avec une annonce liée à cet événement. | Une variation générique de moral ou une annonce sans conséquence ne suffit pas. |
| AUD-076 — contre-jeu | Chaque boss possède une lecture et une réponse distinctes réellement exécutables. | PV, couleur et nom seuls ne distinguent pas une mécanique. |
| AUD-078 — phase stratégique | La menace sur un objectif secondaire possède une issue et ne réinitialise pas les victoires déjà acquises. | Une attaque arbitraire ou un simple changement d’étiquette ne constitue pas cette conséquence. |
| AUD-105 — ressources | Dix relances réelles gardent les compteurs de ressources stables et les textures partagées utilisables. | Les compteurs WebGL ne sont pas des octets de VRAM ; un timeout du harness ou des retainers de diagnostic doivent être distingués d’une fuite du jeu. |
| AUD-107 — recherche | Le benchmark garde ses résultats déterministes lorsque l’effectif double et mesure le poids de la recherche de cibles. | Ce benchmark CPU ne certifie pas un nombre de FPS sur PC ou mobile. |
| AUD-112 — streaming | Traverser trois zones puis revenir garde le terrain, les objectifs et les destructions ; les interruptions sont mesurées. | Les tailles de buffers CPU et leurs événements de libération ne mesurent pas la mémoire du pilote graphique. |
| AUD-126 — interactions Prey | Les dix prompts correspondent aux effets réels : mobilité Taabe, vraies ressources d’arc/hache, pistolet borné et bloqué par les obstacles, boue une fois par entrée avec expiration, souffle distinct du feu ; les éléments non documentés sont annoncés comme adaptations. | Les tests des gestionnaires seuls ne prouvent pas la consommation du vrai Player, le texte intégré des prompts ni une géométrie 1:1. |

## Recettes transverses prévues

1. Secours : perte de contribution à la première chute, aucun décès ou gain prématuré, annulation par dégâts/distance, consommation au succès, blessure persistante à la reprise et mort définitive après expiration ou coup de grâce.
2. Difficulté et retraite : mêmes identités de départ, décisions différentes et annoncées, conservation des pertes et refus d’un retour sans ravitaillement réel.
3. Terrains : mêmes ancrages essentiels, deux graines distinctes, chemins complets et contacts cohérents ; acteur marchant sur l’accès et sous la surface avec les mêmes coordonnées horizontales.
4. Boss : prévalidation négative avant lancement, construction/mise à jour/nettoyage des onze rencontres et coexistence des mini-boss avec le majeur.
5. Ressources : comparer la recette d’origine à un harness dont les délais et références de diagnostic sont libérés, conserver les compteurs et vérifier les textures partagées après relance.

Les scènes et contrôles de navigateur attendent la libération explicite du créneau Chromium par l’agent mémoire. Les suites des agents métier sont complétées par une recette transverse ; leurs résultats seront copiés sous ce répertoire avec leurs commandes, portées et empreintes avant toute clôture.

## Prey : correctifs et preuve intermédiaire

La [preuve CPU des interactions](prey-environment-contracts/report.json) conserve **13/13 tests réussis**, les sources et tests inchangés pendant cette exécution, et la sortie brute. Les dégâts passent par les vrais gestionnaires de horde et de boss et par le registre unique de décès. Les obstacles, la diplomatie, la portée et la visée du pistolet, les rayons distincts du souffle et du feu, l’expiration à 30/60/120 Hz et la libération du mesh de feu sont exercés. La boue exige un volume présent, accepte les deux joueurs et ne se réapplique qu’après sortie puis nouvelle entrée. Le dommage et ralentissement hérités appliqués au centre mondial ont été retirés de cette boue : ils n’étaient pas annoncés.

Le masque conserve son piège de véritable fléchette et Sarii ses ordres/blessures, sans gain de munitions. Les pickups n’appellent plus un `Player.addScore` absent. Les nouveaux tests d’équipement doublent encore les API Player : les vraies consommations d’arc/hache, les buffs de mobilité et la correspondance des prompts intégrés restent nécessaires. Cette preuve intermédiaire ne clôt pas AUD-126 et ne transforme aucun accessoire procédural en reconstruction 1:1.

La revue indépendante a ensuite reproduit un défaut supplémentaire : `Player.shield` n’est pas consommé par les dégâts. Les deux bonus de protection grizzly/arsenal de cette première preuve ne constituaient donc pas une défense réelle. Ils sont remplacés par une récupération bornée de 150/100 PV, explicitement adaptée pour le jeu, avec fléchettes inchangées. Une régression sur le vrai Player vérifie consommation des PV par dégâts et sauvegarde ; les preuves finales de cette correction restent séparées du premier rapport.

La [revue indépendante corrigée](prey-player-reviewed/report.json) conserve **41/41 tests réussis** et quinze sources/tests SHA identiques avant/après. Les vraies consommations des six flèches et quatre frappes, le déplacement multiplié par 1,3, les effets thermique/acide temporaires et la récupération HP réellement consommée et sauvegardée sont maintenant vérifiés. Le [passage précédent de40tests](prey-player-integration/report.json) est conservé comme intermédiaire : tous ses tests passaient, mais une source avait changé pendant l’exécution. Les prompts, le projectile main et la reprise de tous les pickups de scène restent hors de ces deux preuves, donc AUD-126 reste ouvert.

La [preuve de checkpoint](prey-checkpoint-contracts/report.json) ajoute ensuite six cas et repasse les treize contrats/historiques, soit **19/19**, avec empreinte runtime inchangée pendant ce passage. `serializePreyInteractions()` produit un schéma version1 lié au `referenceProfile.id` réel et à la présence exacte des props. `restorePreyInteractions(saved)` retourne un booléen après validation complète, avant toute mutation ; le coordinateur doit refuser une reprise incompatible. L'appel arrive après reconstruction du décor et des deux joueurs, avant le premier update.

Les neuf flags consommables des dix interactions principales et du chaudron restent consommés ; aucune méthode de pickup, aucun dégât de souffle et aucun gain d'inventaire ne sont rejoués. Le feu conserve seulement sa durée restante et sa faction, sans rallonger un feu déjà présent ou épuisé lors d'une restauration en place. Sarii conserve propriétaire J1/J2, ordre, position, blessures/PV et récupération ; la boue conserve l'appartenance à l'entrée, y compris après expiration de son buff. Le guidage laser transitoire du masque est annulé comme les projectiles de boss à la reprise. Les accessoires Prey ultérieurs hors de ces dix interactions et du chaudron ne sont pas inclus dans cette API. La jonction main et la correspondance des prompts restent à prouver sur la version intégrée.

## Outils de recette préparés

`record-cpu-suite.mjs` exécute seulement une liste explicite de tests CPU. Il conserve la sortie TAP et son empreinte, refuse les suites utilisant Playwright, puis compare les sources runtime et les tests avant/après. Un test passé pendant une modification de source reçoit l’état distinct `passed_but_source_changed_during_run` et ne sert pas de clôture finale. Le dossier de sortie ne peut pas être réutilisé silencieusement.

```sh
node docs/qa/pr3-next-20261028/record-cpu-suite.mjs --label secours-integration tests/ally-rescue.test.js
```

Les noms de suites à transmettre seront ceux effectivement livrés par les agents ; l’exemple n’affirme pas que ce fichier existe déjà.

`run-complete-contexts.mjs` attend un build autorisé par ROOT et ne le reconstruit jamais. Il vérifie son index sur disque et sur le port réellement servi, puis son arbre de fichiers avant/après. La recette par défaut couvre les onze contextes : victoire au terme des six secteurs et cinq portes par dégâts de fixture aux vrais adversaires, puis défaite contrôlée après insertion. Les acteurs et gestionnaires fournissent les résultats réels ; aucun graphe Three n’est renvoyé comme diagnostic. Le chargement des visuels possède un délai annulé dans `finally`, pour ne pas recréer le défaut de rétention du précédent harness.

```sh
node docs/qa/pr3-next-20261028/run-complete-contexts.mjs --expected-index SHA_HTML_FIGE --expected-source SHA_GIT_FIGE --output /workspace/qa/pr3-next-20261028/complete-contexts
```

Les deux SHA de cet exemple sont des emplacements à remplacer par les valeurs réelles fournies par ROOT. Le script les refuse avant tout lancement de navigateur s’ils sont absents ou invalides. `--levels identifiant1,identifiant2` limite un préflight et signale alors que les onze contextes ne sont pas tous couverts. Ces parcours assistés ne sont pas des victoires obtenues naturellement par des joueurs humains.

Le [premier essai de production](complete-contexts-initial/report.json), source `a2252775`, conserve **21 chemins réussis et un échec**, avec les sources du helper et la capture négative. Les onze défaites et dix victoires passent ; la victoire LA reste échouée dans ce rapport. Le vrai Player manuel pouvait sortir de l'héliport, mais un vrai Joe suivant une cible au sol restait bloqué : la [reproduction et correction de navigation](helipad-navigation-reviewed.json) distingue ce bug de la cadence accélérée du helper. Aucune de ces preuves négatives n'est requalifiée en réussite.

La recette suivante accepte `--outcomes victory` pour revoir les onze chemins de victoire sur le nouveau build, sans compter les défaites antérieures comme de nouvelles exécutions. Chaque secteur est enregistré séparément. Le helper projette ses pieds et ses buts sur le sol mesuré tout en gardant la vraie navigation, les collisions, portes et capsule ; une correction verticale supérieure à 0,66 est refusée et les maxima sont conservés. Les trois sources de recette sont copiées et empreintées avant lancement, puis vérifiées après fermeture de Chromium. Les résultats gardent explicitement leur source et leurs portées distinctes.

Le [nouvel essai de victoire](complete-contexts-final-victories/report.json) passe **11/11** sur `5089228`, index `643b94…`, en 476,889 s. Les onze boss annoncés sont réellement atteints après six secteurs et cinq portes puis vaincus via leur gestionnaire, avec écran de victoire et nettoyage réels. Le dist et les trois sources de recette restent identiques avant/après, zéro erreur JS/HTTP/externe. Correction de sol maximale0,45 ; pas horizontal maximal0,7. La [revue des liaisons](complete-boss-bindings-reviewed.json) clôt AUD-071 avec le préflight négatif et les833tests CPU du même gel. **Aucune défaite n'est rejouée par ce nouvel essai** ; les onze défaites a225 restent une preuve historique distincte.

## Mise à jour du suivi

Le script `scripts/update-audit-progress.py` vérifie les 126 identifiants, les critères inchangés et les preuves locales épinglées. Un statut `Terminé` exige une revue de la correspondance entre preuve et critère ; le script ne peut pas la déduire de la présence d’un module ou d’une API.

```sh
python3 scripts/update-audit-progress.py --check
python3 scripts/update-audit-progress.py --write --report docs/audits/2026-10-26/implementation-verification.json
node --test tests/audit-progress.test.js
```

Les résultats déjà acquis restent conservés. Une preuve modifiée doit être revue avant que son empreinte soit changée dans le suivi ; les anciens essais et leurs défauts ne sont pas requalifiés en succès.
