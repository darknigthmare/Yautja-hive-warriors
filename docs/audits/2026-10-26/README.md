# Audit Yautja Hive Warriors — batailles de masse et fidélité

**Photographie du code et de Vercel arrêtée à l’audit initial du 26 octobre 2026, enrichie de propositions de conception le même jour.** Cet audit compare le code récent, la version publiée sur Vercel et les mécanismes documentés de Dynasty Warriors afin de définir les travaux nécessaires à des batailles de masse cohérentes avec Alien / Predator.

## Livrables

- [Classeur Excel](./Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx) : 15 onglets, critères de validation, preuves, hypothèses modifiables et suivi des actions.
- [Données de l’audit](./audit-data.json) : contenu textuel et numérique du classeur, liens de preuve et schéma des tableaux, lisibles dans une revue Git.

L’audit contient **126 actions** : **14 P0**, **88 P1** et **24 P2**. Elles comprennent **63 éléments à créer, 26 partiels, 20 à réconcilier, 11 à corriger et 6 à valider**. Il ne s’agit donc pas de 126 fonctionnalités toutes absentes. La priorité décrit l’ordre de travail ; le constat décrit ce qui existe ; la colonne « Suivi » sert au pilotage ultérieur.

## Premier complément : guerres de clans et affrontements humains

Le premier complément a ajouté **12 opérations détaillées** dans **`Affrontements`** : cinq conflits entre clans Yautja, cinq missions contre différentes forces humaines et deux conflits à plusieurs camps. Chaque fiche relie sa carte, son scénario de fronts, son budget d’effectifs, ses groupes et ses commandants. Elle précise le déploiement, les renforts, les objectifs, les conditions de victoire et de défaite, ainsi que les conséquences des fronts éloignés.

L’ajout apporte **8 cartes, 12 scénarios de fronts, 12 modèles de groupes, 6 fiches de commandants et 5 budgets**. À cette étape, le catalogue atteignait **21 cartes, 25 scénarios de fronts, 42 groupes, 31 fiches de boss/élites/dispositifs et 13 budgets**. Les 126 constats techniques restent ceux de l’audit v65.5 ; les nouvelles fiches sont des propositions de conception.

### Nouvelles cartes

| ID | Carte | Type d’opération | Fronts |
|---|---|---|---:|
| LD-14 | Anneau des Trois Docks | Raid entre clans pour récupérer des archives et s’extraire | 3 |
| LD-15 | Ravines du Convoi gris | Poursuite, interception de fret et protection des voies de retrait | 3 |
| LD-16 | Col des Deux Balises | Conflit de frontière, identification et désescalade | 3 |
| LD-17 | Plateau des Arches silencieuses | Duel négocié pendant que les groupes se retirent sur les autres fronts | 3 |
| LD-18 | Port de récupération | Affrontement contre une force de capture humaine contemporaine | 3 |
| LD-19 | Bassin industriel sous contrat | Sabotage d’une livraison protégée par des mercenaires | 3 |
| LD-20 | Chantier orbital | Reprise d’une navette et affrontement contre une sûreté humaine du futur | 4 |
| LD-21 | Cité-port en évacuation | Extraction d’un captif au milieu d’un confinement militaire | 4 |

Les cartes **LD-11, colonie**, et **LD-12, citadelle**, reçoivent aussi des opérations supplémentaires. Deux scénarios y mettent simultanément en présence le clan du joueur, un clan rival et une force humaine indépendante. Leurs relations et leurs réserves sont suivies séparément.

### Effectifs des nouvelles opérations

| Budget | Ennemis actifs | Alliés PNJ actifs | Ennemis distants | Alliés distants | Réserve ennemie | Réserve alliée | Forces allouées E / A | Fronts |
|---|---:|---:|---:|---:|---:|---:|---:|---:|
| EFF-09 — Escarmouche entre clans | 16 | 8 | 32 | 8 | 16 | 4 | 64 / 20 | 3 |
| EFF-10 — Siège de clan | 32 | 16 | 64 | 32 | 32 | 16 | 128 / 64 | 4 |
| EFF-11 — Force humaine contemporaine | 64 | 4 | 128 | 4 | 64 | 0 | 256 / 8 | 3 |
| EFF-12 — Opération humaine du futur | 128 | 12 | 384 | 12 | 256 | 8 | 768 / 32 | 4 |
| EFF-13 — Plusieurs camps | 96 | 12 | 192 | 12 | 96 | 8 | 384 / 32 | 4 |

Chaque ligne ajoute **un joueur**, compté séparément. Les états actif, distant et réserve sont exclusifs. « Actif » désigne une simulation détaillée, pas nécessairement une unité visible à l’écran ; les fronts partagent les plafonds globaux. Les véhicules, civils et personnes blessées non combattantes sont suivis à part, et leur représentation doit être incluse dans le profilage de la scène complète.

Dans ce premier complément, les cellules Yautja nouvelles sont des groupes de **quatre PNJ**, les groupes humains nouveaux des formations de **huit**. Les commandants occupent une place dans ces groupes. Les deux opérations mixtes ventilent leurs 384 adversaires en **48 Yautja + 336 humains**, ou **96 Yautja + 288 humains**. Une trêve modifie les relations des unités existantes sans créer de nouvelles unités.

Les **Cendres Veilleuses**, les **Lames de Basalte**, leurs commandants et les huit lieux supplémentaires sont des créations originales pour le projet. Leurs conflits et accords ne définissent pas des règles universelles de la franchise. Les périodes contemporaines et futures restent séparées. Si une campagne relie les opérations, elle conserve la mort, la capture et le retrait des personnages au lieu de recréer un chef déjà éliminé.

## Deuxième complément : profils et lieux issus des médias

Les deux nouveaux onglets contiennent **115 fiches de profils** et **27 fiches de lieux ou de secteurs sourcés**. La répartition est de **37 fiches xénomorphes ou autres organismes associés, 37 fiches Yautja et matériel associé, 41 fiches humaines, synthétiques, technologiques ou de matériel piloté**. Ces nombres décrivent des fiches de conception : ils ne signifient pas 115 castes biologiques ni 115 unités totalement absentes.

Le catalogue cite **66 URL de sources primaires distinctes**, organisées en 70 références de travail. Les sources comprennent studios, éditeurs, développeurs, manuel officiel archivé et créateurs d’effets. Les fiches officielles de figurines sont limitées à ce qu’elles attestent effectivement, notamment nom ou représentation ; elles ne prouvent pas toutes les aptitudes ou une chronologie universelle.

Chaque fiche précise l’œuvre, le média, la continuité, le fait attesté, le niveau de preuve, le rôle proposé, l’état du code au SHA figé, les éléments manquants, les règles de groupe, les affrontements et lieux compatibles, les restrictions et les URL. Le statut « unique » ou « exclu du spawn » reste distinct de la priorité de développement.

### Règles de fidélité

- Stades de vie, castes propres à un jeu, variations d’hôte et individus nommés restent distincts.
- Les profils du Pathogène, Neomorph, Deacon, Trilobite et Eye Midge ne sont pas automatiquement tous traités comme des castes xénomorphes.
- Les classes Yautja d’Extinction ou de Hunting Grounds ne deviennent pas une hiérarchie universelle. Young Blood et Blooded sont des statuts contextualisés ; les seuils de KOs ou droits d’armement du projet restent des mécaniques à justifier.
- Les humains ont des factions, fonctions et classes de jeu. Cyborg, synthétique à IA et hybride de conscience humaine ne sont pas des catégories interchangeables.
- Un personnage unique n’est jamais ajouté à une réserve de clones. Un événement Steel Team exige une composition vérifiée et une réallocation à budget constant avant activation.
- Une présence Yautja dans un lieu d’Alien est annoncée comme scénario original lorsque l’œuvre source ne l’atteste pas. Les sources d’un lieu ne valident pas les plans ou populations imaginés pour le mode musou.

### Nouveaux terrains et opérations

L’ajout comprend **13 cartes, 15 opérations détaillées et leurs 15 plans de fronts, 20 modèles de groupes, 8 fiches de rencontres et 4 budgets**. Le total du classeur atteint **34 cartes, 27 opérations détaillées, 40 plans de fronts, 62 groupes, 39 fiches de rencontres et 17 budgets**. Les deux modes humains sont des variantes secondaires proposées ; ils demandent un contrôleur humain jouable qui n’est pas établi par l’audit.

| Carte | Terrain | Opérations proposées |
|---|---|---|
| LD-22 | Sevastopol — réseaux publics et techniques | AFF-13 — Y-X avec réseau synthétique tiers |
| LD-23 | Lethe — colonie, usine et accès de ruche | AFF-14 — Y-X, humains secourus neutres ; AFF-25 — X-H, mode humain secondaire optionnel |
| LD-24 | Freya Prospect — complexe, ruines et extraction | AFF-15 — X-Y-H, trois camps indépendants |
| LD-25 | LV-895 — périphérie industrielle et ruines | AFF-16 — X-Y-H, synthétiques corporatistes indépendants |
| LD-26 | Prodigy City — cordon autour du Maginot | AFF-17 — X-Y-H, variante de guerre de 2120 |
| LD-27 | Tobler-9 — avant-poste, refuge et sous-sol | AFF-18 — Y-X, pacte local avec les survivants ; AFF-26 — X-H, humains et coopération synthétique scénarisée |
| LD-28 | Station Epsilon — sas, laboratoires et quai | AFF-19 — X-Y-H, infiltration localisée |
| LD-29 | Neonopolis — récupération technologique dans les quartiers industriels | AFF-20 — Yautja contre sécurité humaine ; raid de grande ampleur original |
| LD-30 | Genna — trois voies de récupération d’une balise de clan | AFF-21 — Yautja contre Yautja ; conflit original sur lieu de film |
| LD-31 | Réserve de The Last Hunt — opération de libération alternative | AFF-22 — Yautja contre ravisseurs Yautja ; humains à secourir |
| LD-32 | Planète de toundra — épave de Theta et approche de l’avant-poste | AFF-23 — Traque Yautja/humains restreinte ; trêve locale possible |
| LD-33 | Lune des Spinners — habitat et terraformation | AFF-24 — Y-X, colonie humaine à évacuer |
| LD-34 | LV-742 — bassin atmosphérique et ruche des failles | AFF-27 — Guerre à trois espèces — sabotage logistique, rivalité de routes et assaut de ruche |

Chaque carte décrit des zones de tailles différentes, des routes terrestres ou verticales, des goulets, des repères fixes, les causes de variation et les contrôles de navigation. Les objectifs changent l’état de la bataille sans déplacer arbitrairement les lieux.

### Exemple à trois espèces : LV-742

Le [manuel officiel d’AVP: Extinction](https://gamingalexandria.com/ps2/Aliens%20Versus%20Predator%20Extinction/Aliens%20Versus%20Predator%20Extinction%20-%20Manual.pdf) fournit le cadre de LV-742. **AFF-27** en propose une nouvelle opération musou, avec quatre fronts : installations atmosphériques et atterrissage, col logistique, ruche, sanctuaire et extraction. Son plan et ses nombres sont originaux.

| Camp | Actifs | Distants | Réserve | Total alloué |
|---|---:|---:|---:|---:|
| Xénomorphes | 96 | 384 | 256 | 736 |
| Force humaine, soutien synthétique et pilotes compris | 32 | 96 | 64 | 192 |
| Alliés Yautja PNJ | 8 | 8 | 8 | 24 |
| Joueur | 1 | 0 | 0 | 1 |

Cela donne **953 combattants alloués**, dont **137 actifs au plafond proposé**, à profiler. Les forces distantes et de réserve ne sont pas toutes simulées en détail. La reine remplace un membre de sa cellule ; les Predguns, sentries, Shrine, transports et objets biologiques ont des plafonds matériels séparés. Les deux camps adverses conservent leurs objectifs et peuvent s’affronter sans le joueur.

Sevastopol et la toundra de Theta utilisent des budgets nettement plus faibles. Le théâtre et son rythme déterminent la densité ; les mêmes centaines d’unités ne sont pas ajoutées indistinctement à chaque lieu.

### Sources de référence du complément

- [Cold Iron — Fireteam Elite, notes de version](https://www.aliensfireteamelite.com/en/releasenotes/) et [Pathogen](https://www.aliensfireteamelite.com/en/community/pathogen-deep-dive-an-exhilarating-new-story/).
- [Focus — Dark Descent, histoire et cadre](https://www.focus-entmt.com/en/news/tindalos-and-focus-reveal-story-trailer-for-aliens-dark-descent).
- [IllFonic — classes humaines de Hunting Grounds](https://predator.illfonic.com/the-fireteam/).
- [FX — personnages d’Alien: Earth](https://www.fxnetworks.com/shows/alien-earth/characters).
- [Disney — Predator: Badlands](https://www.disneyplus.com/explore/articles/predator-badlands-movie).
- [Marvel — Alien (2022) #3](https://www.marvel.com/comics/issue/103780/read), [Alien (2021) #10](https://www.marvel.com/comics/issue/89581/alien_2021_10) et [Predator (2022) #2](https://www.marvel.com/comics/issue/89619/predator).
- [Legacy Effects — créatures d’Alien: Romulus](https://www.legacyefx.com/alien-romulus).

La sélection vise les profils et théâtres utiles au projet. Les dossiers incomplets restent identifiables ; elle ne prétend pas épuiser tous les comics, variantes ou apparitions de la franchise.

## Versions réellement comparées

| État | Référence | Observation |
|---|---|---|
| Point d’arrêt de l’audit sur `main`, v65.5 | [`0f37cc52f9d83a4abecc17b80f7bfc67701677cf`](https://github.com/darknigthmare/Yautja-hive-warriors/commit/0f37cc52f9d83a4abecc17b80f7bfc67701677cf) | Dix cartes déclarées, dont le territoire de *Prey* ; déploiement Vercel encore `QUEUED` au contrôle ; syntaxe locale bloquante. |
| Branche d’architecture et de gameplay validés | [`1d52d9ff91dbe85c08256f44f8b72086ab65200a`](https://github.com/darknigthmare/Yautja-hive-warriors/commit/1d52d9ff91dbe85c08256f44f8b72086ab65200a) | Secteurs, directeur de combat, navigation et correctifs spécifiques à conserver lors d’une réconciliation. |
| Branche par défaut `master` | [`f91562b86ef61c9ef7e65087b4beb109036f8dd8`](https://github.com/darknigthmare/Yautja-hive-warriors/commit/f91562b86ef61c9ef7e65087b4beb109036f8dd8) | État plus ancien ; la PR documentaire cible `main`. |
| Production publique | [yautja-hive-warriors.vercel.app](https://yautja-hive-warriors.vercel.app/) | HTTP 200, déploiement `dpl_39FAHCh8Z68e8d6vHt4ZXg3ZSbaY`, état `READY`, source CLI. |

Les v65 et v65.5 sont arrivées pendant l’audit. Les différentiels depuis la v64 (`5ca5b3451d331eed368e2cf22f4a2baa4bb1d585`) ont été intégrés avant le gel des données. La v65.5 ajoute notamment Sarii, de la boue et des éléments de décor à *Prey*. Le périmètre est figé sur `0f37cc52` pour rester vérifiable si le dépôt continue d’évoluer.

L’empreinte SHA-256 du HTML de production, `cb19eded36c19e20a5c50b94daad56d1d8550cf1c9ddff08df6d0167d7a03910` pour 35 309 octets, correspond exactement au [rapport de livraison de la branche validée](https://github.com/darknigthmare/Yautja-hive-warriors/blob/1d52d9ff91dbe85c08256f44f8b72086ab65200a/docs/qa/fidelity/vercel-delivery.json). Cela relie le contenu publié au build documenté ; les métadonnées du déploiement CLI ne prouvent pas directement un SHA Git.

## Constats structurants

### 1. Réconcilier la base avant d’agrandir les batailles

La v65.5 et la branche validée contiennent des acquis différents. Les recopier sans analyse risquerait de perdre les cartes récentes ou les correctifs de la branche validée. Les actions `AUD-001` à `AUD-008`, puis les actions spécialisées, précisent les comportements à conserver.

Les contrôles de syntaxe ont relevé deux redéclarations bloquantes dans le code v65.5 :

- [`js/main.js:3258`](https://github.com/darknigthmare/Yautja-hive-warriors/blob/0f37cc52f9d83a4abecc17b80f7bfc67701677cf/js/main.js#L3258), `isNearCrypt` ; la même erreur était observée à la ligne 3254 dans les [logs du build Vercel v65](https://vercel.com/darknigthmares-projects/yautja-hive-warriors/6acNdggyWabN5EVPsCB2E8Z8rSFk).
- [`js/entities/Environment.js:10689`](https://github.com/darknigthmare/Yautja-hive-warriors/blob/0f37cc52f9d83a4abecc17b80f7bfc67701677cf/js/entities/Environment.js#L10689), `blueLight`.

Le dernier build Vercel terminé inspecté est `dpl_6acNdggyWabN5EVPsCB2E8Z8rSFk`, associé à la v65 `f1a503c`, en `ERROR`. Le déploiement v65.5 `dpl_EajNYsgsBjjTmTHGUE1Wm6rPTggR` était encore `QUEUED` lors du contrôle : son résultat n’est pas inventé à partir du test local. Les défauts de syntaxe précèdent cette PR, qui ajoute uniquement des documents.

### 2. Une guerre parallèle exige une simulation persistante

Le code récent présente des vagues et des arènes. La branche validée apporte six secteurs par biome, mais leur activation est séquentielle. Aucun système complet de fronts autonomes persistants n’a été vérifié dans ces deux états.

Le résultat visé est une carte où un groupe éloigné continue sa mission, consomme ses réserves, gagne ou perd du terrain et appelle de l’aide pendant que le joueur agit ailleurs. Les renforts doivent venir de routes et de ressources connues. Une victoire sur un front doit modifier les autres fronts et le boss final.

### 3. Distinguer les états de population

L’appel initial `spawnWave(55)` du code récent conduit à **75 agents ou groupes hors œufs**, selon le comptage détaillé dans `Etat_verifie` : 69 entrées dans la collection principale, deux facehuggers royaux, trois volants et un groupe de microswarm. Les six œufs et les éléments visuels du microswarm ne sont pas comptés comme autant de soldats indépendants. Ce relevé décrit le code, pas une mesure de performance.

Le plafond de 200 de la branche validée concerne le total d’un encounter, incluant les unités en attente ; il ne certifie pas 200 combattants simultanément actifs.

Les dix-sept gabarits de l’onglet `Effectifs` séparent donc les ennemis actifs, alliés PNJ actifs, joueurs, forces distantes déjà déployées et réserves non déployées. Les totaux sont calculés par formule, sans double comptage des joueurs, des réserves ou d’un groupe visible par deux caméras.

**Exemple proposé, EFF-03 :** 128 ennemis proches + 512 déployés au loin + 360 en réserve = **1 000 ennemis alloués** ; 16 alliés PNJ proches + 24 au loin + 8 en réserve = **48 alliés PNJ**, auxquels s’ajoute le joueur ; **trois fronts**. Il s’agit d’un objectif de conception pour une guerre originale du clan, soumis au profilage, et non d’une capacité déjà démontrée ou d’un effectif de film.

### 4. Adapter chaque groupe à son œuvre et à son lieu

Les compositions proposées décrivent le rôle, le chef ou la coordination, l’origine des renforts et les restrictions. Les Yautja ne deviennent pas automatiquement des soldats anonymes par centaines ; les Marines ne sont pas automatiquement alliés ; les synthétiques ne sont pas tous des combattants équivalents ; les personnages nommés et les créatures uniques ne deviennent pas des clones de vague.

Les groupes de *Prey* sont séparés des factions et armements futuristes. Les adaptations de guerre, rencontres inventées et mélanges d’œuvres sont identifiés comme tels. Un commentaire de code « canon 1:1 » n’est pas une preuve de fidélité.

### 5. Agrandir par la topologie et les objectifs

Les 34 fiches de terrain comprennent les dix lieux déclarés dans la v65.5, les propositions initiales et 13 terrains supplémentaires fondés sur les médias. Les 27 fiches de provenance de `Lieux_medias` peuvent décrire plusieurs secteurs ou angles d’un même lieu ; elles ne représentent pas 27 planètes différentes. Elles décrivent les secteurs, voies, goulets, repères, zones variables, fronts et critères de navigation.

Les dimensions cibles sont propres à chaque terrain et exprimées en **unités de jeu** dans `Cartes_zones`. Elles désignent des emprises de conception ; toute l’emprise n’est pas nécessairement praticable. Elles ne sont pas converties en mètres, ne reproduisent pas un plan canonique certifié et restent à calibrer avec les vitesses, les trajets, le streaming et les performances.

### 6. Relier boss, mini-boss et bataille

Les 39 fiches couvrent des profils déjà présents et des rôles à concevoir. Elles distinguent les chefs de groupe, élites, mini-boss, chasseurs uniques, boss majeurs et structures de rencontre. Quinze identifiants de boss du code sont examinés dans l’inventaire ; ces deux nombres ne désignent pas la même chose.

Le Feral ajouté en v65 possède un constructeur et 8 600 PV de gameplay. Son combat reste à corriger : appel `spawnAcidSpit` sans définition trouvée, héritage d’attaques génériques d’acide et de queue, piège du masque appliquant directement des dégâts. Les interactions Prey sont également à comparer à leurs annonces et aux scènes sources (`AUD-123` à `AUD-126`).

Dans le complément v65.5, Sarii suit le premier joueur et applique des dégâts de proximité ; les ordres, blessures et conséquences tactiques restent à définir. La « branche du puma » ne contient pas de puma construit ni d’IA dédiée. Une seconde déclaration de `applyMudCamouflage` écrase la nouvelle méthode : les effets annoncés doivent être rapprochés du comportement réellement appelé. Ces constats enrichissent les actions existantes sans gonfler le nombre d’actions.

## Références Dynasty Warriors retenues

| Référence | Rôle dans l’audit |
|---|---|
| [Dynasty Warriors 3: Complete Edition Remastered](https://www.koeitecmoamerica.com/news/witness-a-warrior-reignited-in-dynasty-warriors-3-complete-edition-remastered-out-now/), sorti le 1er octobre 2026 | Dernière sortie constatée au jour de l’audit, retour aux fondements de la série et contexte de coopération. |
| [Dynasty Warriors: Origins](https://www.koeitecmoamerica.com/dw_origins/us/system/), sorti le 17 janvier 2025 | Référence principale de gameplay moderne : tactiques, grandes forces, moral, zones de bataille, officiers, duels et lecture du champ de bataille. |
| [Visions of Four Heroes](https://www.koeitecmoamerica.com/news/dive-into-the-action-of-dynasty-warriors-origins-with-the-nintendo-switch-2-version-and-large-scale-dlc-available-now/), sorti le 22 janvier 2026 | Extension récente d’Origins prise en compte dans le périmètre. |
| Dynasty Warriors 9 Empires | Complément pour objectifs, bases, siège et articulation stratégique. |

Les sources officielles parlent de batailles contre des milliers d’ennemis et du concept « un contre mille ». Cela ne suffit pas à certifier un nombre universel d’agents entièrement simulés à chaque image. Aucun tel plafond n’est inventé dans le classeur. Les sources et leurs limites sont jointes aux 40 comparaisons, chacune reliée aux actions de l’audit.

## Organisation des 15 onglets

| Onglet | Contenu |
|---|---|
| `Synthese` | Indicateurs calculés, répartition des priorités, états et domaines, constats et mode d’emploi. |
| `Effectifs` | 17 gabarits avec hypothèses modifiables et totaux calculés. |
| `Manquants` | 126 actions avec état par branche, cible, critère de validation, priorité, dépendances, preuves et suivi. |
| `Comparatif_DW` | 40 mécanismes sourcés et leur adaptation au projet. |
| `Groupes` | 62 compositions et rôles cohérents par faction et contexte. |
| `Fronts` | 40 scénarios de bataille sur plusieurs fronts, événements et conséquences. |
| `Cartes_zones` | 34 fiches de terrain, secteurs variables, circulation et critères de navigation ; source du lieu distincte du plan proposé. |
| `Boss_et_elites` | 39 fiches de boss, mini-boss, élites et dispositifs, contre-jeu et conséquences sur la bataille. |
| `Fidelite` | 47 règles, périmètres d’œuvre, contrôles d’arsenal et limites des sources. |
| `Validation` | 24 procédures à exécuter, avec preuves attendues ; aucun résultat futur déclaré réussi. |
| `Feuille_route` | 6 lots successifs avec prérequis et critères de sortie. |
| `Etat_verifie` | Relevés de versions, inventaire, architecture, historique Vercel, références et limites de vérification. |
| `Affrontements` | 27 opérations détaillées Y-X, Y-H, Y-Y, X-Y-H et variantes X-H optionnelles, avec références aux autres onglets. |
| `Bestiaire_medias` | 115 fiches : stades, castes de jeux, rôles, classes, matériel et individus ; preuves, état du code, travail manquant et éligibilité. |
| `Lieux_medias` | 27 fiches de provenance et de compatibilité : œuvre, continuité, fait attesté, topologie proposée et restrictions. |

## Utilisation et validation

Commencer par `Synthese`, puis filtrer `Manquants` sur `P0`. Pour ce complément, ouvrir `Bestiaire_medias` et filtrer l’œuvre, le type et l’éligibilité ; utiliser ensuite `Lieux_medias`, `Cartes_zones` et `Affrontements` pour choisir un théâtre et ses forces. Modifier les hypothèses signalées dans `Effectifs` et la colonne « Suivi » sans écraser les constats ni les preuves. Les lots proposés commencent par une base unique compilable, puis une bataille pilote à trois fronts ; la montée en charge suit la mesure sur le matériel cible.

Le menu de production a été observé dans le navigateur. Cette session d’audit n’avait pas de contexte WebGL utilisable (`GL_VENDOR` et `GL_RENDERER` désactivés) : aucun résultat de combat, FPS ou comparaison visuelle exhaustive n’est certifié. Cette limite de l’environnement d’audit ne démontre pas un défaut WebGL du jeu sur les machines des joueurs.

Le classeur totalise 677 lignes détaillées. Le contrôle XML confirme 15 feuilles, 14 tableaux filtrables et 142 formules, sans cellule d’erreur. Les 460 lignes antérieures, leurs valeurs, styles, dimensions, volets figés, validations et formats conditionnels restent préservés. La vérification comprend également les références d’actions, les budgets et les rendus visuels des ajouts. Les 24 recettes du jeu restent à exécuter après intégration des changements de gameplay.

**Portée de la PR :** ajout du classeur, de ses données lisibles et de cette notice. Aucune modification du gameplay ni fusion automatique des branches. Le point d’ancrage de l’audit reste `0f37cc52`, même si `main` évolue après sa publication.
