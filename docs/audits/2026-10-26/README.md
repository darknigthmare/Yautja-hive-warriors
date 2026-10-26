# Audit Yautja Hive Warriors — batailles de masse et fidélité

**Photographie de l’état observé le 26 octobre 2026.** Cet audit compare le code récent, la version publiée sur Vercel et les mécanismes documentés de Dynasty Warriors afin de définir les travaux nécessaires à des batailles de masse cohérentes avec Alien / Predator.

## Livrables

- [Classeur Excel](./Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx) : 13 onglets, critères de validation, preuves, hypothèses modifiables et suivi des actions.
- [Données de l’audit](./audit-data.json) : contenu textuel et numérique du classeur, liens de preuve et schéma des tableaux, lisibles dans une revue Git.

L’audit contient **126 actions** : **14 P0**, **88 P1** et **24 P2**. Elles comprennent **63 éléments à créer, 26 partiels, 20 à réconcilier, 11 à corriger et 6 à valider**. Il ne s’agit donc pas de 126 fonctionnalités toutes absentes. La priorité décrit l’ordre de travail ; le constat décrit ce qui existe ; la colonne « Suivi » sert au pilotage ultérieur.

## Complément : guerres de clans et affrontements humains

Le nouvel onglet **`Affrontements`** contient **12 opérations détaillées** : cinq conflits entre clans Yautja, cinq missions contre différentes forces humaines et deux conflits à plusieurs camps. Chaque fiche relie sa carte, son scénario de fronts, son budget d’effectifs, ses groupes et ses commandants. Elle précise le déploiement, les renforts, les objectifs, les conditions de victoire et de défaite, ainsi que les conséquences des fronts éloignés.

L’ajout apporte **8 cartes, 12 scénarios de fronts, 12 modèles de groupes, 6 fiches de commandants et 5 budgets**. Le catalogue atteint ainsi **21 cartes, 25 scénarios de fronts, 42 groupes, 31 fiches de boss/élites/dispositifs et 13 budgets**. Les 126 constats techniques restent ceux de l’audit v65.5 ; les nouvelles fiches sont des propositions de conception.

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

Les cellules Yautja nouvelles sont des groupes de **quatre PNJ**, les groupes humains nouveaux des formations de **huit**. Les commandants occupent une place dans ces groupes. Les deux opérations mixtes ventilent leurs 384 adversaires en **48 Yautja + 336 humains**, ou **96 Yautja + 288 humains**. Une trêve modifie les relations des unités existantes sans créer de nouvelles unités.

Les **Cendres Veilleuses**, les **Lames de Basalte**, leurs commandants et les huit lieux supplémentaires sont des créations originales pour le projet. Leurs conflits et accords ne définissent pas des règles universelles de la franchise. Les périodes contemporaines et futures restent séparées. Si une campagne relie les opérations, elle conserve la mort, la capture et le retrait des personnages au lieu de recréer un chef déjà éliminé.

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

Les treize gabarits de l’onglet `Effectifs` séparent donc les ennemis actifs, alliés PNJ actifs, joueurs, forces distantes déjà déployées et réserves non déployées. Les totaux sont calculés par formule, sans double comptage des joueurs, des réserves ou d’un groupe visible par deux caméras.

**Exemple proposé, EFF-03 :** 128 ennemis proches + 512 déployés au loin + 360 en réserve = **1 000 ennemis alloués** ; 16 alliés PNJ proches + 24 au loin + 8 en réserve = **48 alliés PNJ**, auxquels s’ajoute le joueur ; **trois fronts**. Il s’agit d’un objectif de conception pour une guerre originale du clan, soumis au profilage, et non d’une capacité déjà démontrée ou d’un effectif de film.

### 4. Adapter chaque groupe à son œuvre et à son lieu

Les compositions proposées décrivent le rôle, le chef ou la coordination, l’origine des renforts et les restrictions. Les Yautja ne deviennent pas automatiquement des soldats anonymes par centaines ; les Marines ne sont pas automatiquement alliés ; les synthétiques ne sont pas tous des combattants équivalents ; les personnages nommés et les créatures uniques ne deviennent pas des clones de vague.

Les groupes de *Prey* sont séparés des factions et armements futuristes. Les adaptations de guerre, rencontres inventées et mélanges d’œuvres sont identifiés comme tels. Un commentaire de code « canon 1:1 » n’est pas une preuve de fidélité.

### 5. Agrandir par la topologie et les objectifs

Les 21 fiches de terrain couvrent les dix lieux déclarés dans la v65.5 et onze terrains proposés. Elles décrivent les secteurs, voies, goulets, repères, zones variables, fronts et critères de navigation.

Les dimensions cibles vont de **700 × 900 à 2 000 × 2 400 unités de jeu**. Elles désignent des emprises de conception ; toute l’emprise n’est pas nécessairement praticable. Elles ne sont pas converties en mètres, ne reproduisent pas un plan canonique certifié et restent à calibrer avec les vitesses, les trajets, le streaming et les performances.

### 6. Relier boss, mini-boss et bataille

Les 31 fiches couvrent des profils déjà présents et des rôles à concevoir. Elles distinguent les chefs de groupe, élites, mini-boss, chasseurs uniques, boss majeurs et structures de rencontre. Quinze identifiants de boss du code sont examinés dans l’inventaire ; ces deux nombres ne désignent pas la même chose.

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

## Organisation des 13 onglets

| Onglet | Contenu |
|---|---|
| `Synthese` | Indicateurs calculés, répartition des priorités, états et domaines, constats et mode d’emploi. |
| `Effectifs` | 13 gabarits avec hypothèses modifiables et totaux calculés. |
| `Manquants` | 126 actions avec état par branche, cible, critère de validation, priorité, dépendances, preuves et suivi. |
| `Comparatif_DW` | 40 mécanismes sourcés et leur adaptation au projet. |
| `Groupes` | 42 compositions et rôles cohérents par faction et contexte. |
| `Fronts` | 25 scénarios de bataille sur plusieurs fronts, événements et conséquences. |
| `Cartes_zones` | 21 fiches de terrain et de circulation, dont 11 propositions originales. |
| `Boss_et_elites` | 31 fiches de boss, mini-boss, élites et dispositifs, contre-jeu et conséquences sur la bataille. |
| `Fidelite` | 47 règles, périmètres d’œuvre, contrôles d’arsenal et limites des sources. |
| `Validation` | 24 procédures à exécuter, avec preuves attendues ; aucun résultat futur déclaré réussi. |
| `Feuille_route` | 6 lots successifs avec prérequis et critères de sortie. |
| `Etat_verifie` | Relevés de versions, inventaire, architecture, historique Vercel, références et limites de vérification. |
| `Affrontements` | 12 opérations détaillées contre des clans rivaux, des forces humaines ou plusieurs camps, avec références aux autres onglets. |

## Utilisation et validation

Commencer par `Synthese`, puis filtrer `Manquants` sur `P0`. Modifier les hypothèses signalées dans `Effectifs` et la colonne « Suivi » sans écraser les constats ni les preuves. Les lots proposés commencent par une base unique compilable, puis une bataille pilote à trois fronts ; la montée en charge suit la mesure sur le matériel cible.

Le menu de production a été observé dans le navigateur. Cette session d’audit n’avait pas de contexte WebGL utilisable (`GL_VENDOR` et `GL_RENDERER` désactivés) : aucun résultat de combat, FPS ou comparaison visuelle exhaustive n’est certifié. Cette limite de l’environnement d’audit ne démontre pas un défaut WebGL du jeu sur les machines des joueurs.

La vérification du livrable Excel comprend la cohérence des nombres, des références d’actions, des formules de synthèse et des budgets, ainsi qu’un rendu visuel des onglets. Les 24 recettes du jeu restent à exécuter après intégration des changements de gameplay.

**Portée de la PR :** ajout du classeur, de ses données lisibles et de cette notice. Aucune modification du gameplay ni fusion automatique des branches. Le point d’ancrage de l’audit reste `0f37cc52`, même si `main` évolue après sa publication.
