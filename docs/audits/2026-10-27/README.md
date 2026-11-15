# Contrôle de complétude — révision USCM du 27 octobre 2026

La précision utilisateur **« Isco » = USCM** est intégrée. Cette révision poursuit l’audit Musou, les affrontements entre clans Yautja et le catalogue de médias des PR #3 et #4, en contrôlant les classes, individus, organismes, forces militaires, synthétiques et matériels manquants.

**Résultat : 270 fiches documentaires, soit 53 ajouts depuis la première version de la PR #4 et 35 fiches existantes complétées.** Le contrôle comprend désormais **132 entrées**, dont **43 dossiers à documenter**, ainsi que **69 propositions de groupes** et **34 lieux documentés**. La liste des dossiers ouverts rend les limites vérifiables ; ces résultats ne certifient pas l’exhaustivité de tous les médias Alien / Predator.

## Livrables

- [Excel révisé — 16 onglets](Yautja_Hive_Warriors_Controle_Completude_2026-10-27.xlsx)
- [Données, sources et preuves du contrôle](completeness-audit.json)
- [Audit Musou et classeur historique du 26 octobre](../2026-10-26/README.md)

**Bestiaire_medias** contient les 270 fiches avec leur œuvre, niveau de preuve, sources, éligibilité au spawn, composition de groupe, lieux compatibles et travail restant. **Controle_roster** regroupe les écarts de code, corrections d’identité, équipements par œuvre et dossiers ouverts. **Groupes** et **Lieux_medias** reçoivent chacun sept propositions supplémentaires. Le nouveau bloc USCM de **Synthese** est séparé du bloc initial à 217 fiches, conservé comme historique daté.

## Dernière version vérifiée

| Élément | Référence |
|---|---|
| Dernier état documentaire examiné avant cette révision | `codex/catalogue-completeness-20261027` à [`527cd1164a4160df95d96963cd6efab263d9227e`](https://github.com/darknigthmare/Yautja-hive-warriors/tree/527cd1164a4160df95d96963cd6efab263d9227e) |
| Code de jeu examiné, inchangé dans la PR documentaire | [`39871c450379225de8174711237632e6aa883f04`](https://github.com/darknigthmare/Yautja-hive-warriors/tree/39871c450379225de8174711237632e6aa883f04), branche `codex/complete-pr3-20261026` |
| `main` lors du contrôle | `af90000169256bd8781536ba7eca45d843d4173c` ; PR #3 fusionnée |
| Aperçu Vercel associé au commit documentaire `527cd116` | [`yautja-hive-warriors-inyjy460v-darknigthmares-projects.vercel.app`](https://yautja-hive-warriors-inyjy460v-darknigthmares-projects.vercel.app), `dpl_XQuU9MdpwdYepZ5LpNfWK9UfdwCv`, état `READY` |
| Production Vercel | [`yautja-hive-warriors.vercel.app`](https://yautja-hive-warriors.vercel.app), `dpl_39FAHCh8Z68e8d6vHt4ZXg3ZSbaY`, état `READY`, origine `cli`, sans SHA Git fourni |

La PR #4 cible `codex/complete-pr3-20261026` et ne contient que les trois fichiers de ce dossier. La production ne peut pas être rattachée au code examiné à partir des métadonnées disponibles. Aucune nouvelle session de combat WebGL, mesure de performance matérielle, campagne USCM jouable ou géométrie construite n’est validée par cette révision documentaire.

## Comptage des fiches

| Famille documentaire | Catalogue initial | Première révision | Ajouts USCM | Total révisé |
|---|---:|---:|---:|---:|
| Xénomorphes, formes et organismes du registre | 37 | 63 | 4 | 67 |
| Yautja, classes, individus et groupes | 37 | 64 | 5 | 69 |
| Humains, synthétiques, groupes et matériels | 41 | 84 | 43 | 127 |
| Autres organismes associés | 0 | 6 | 1 | 7 |
| **Total** | **115** | **217** | **53** | **270** |

Les 155 ajouts cumulés et ces totaux comptent des **fiches**, pas des espèces, races biologiques, modèles 3D ou combattants rendus. Les préfixes servent au classement ; chaque fiche précise sa famille réelle. Les 43 ajouts HUM ne sont donc pas 43 nouvelles classes USCM.

## USCM, humains et forces Weyland-Yutani

### Classes et jeux

Les quatre fiches manquantes **Gunner, Medic, Recon et Tecker de Dark Descent** complètent Sergeant. L’ARC, le drone tactique et le synthétique récupéré disposent de fiches distinctes. Les cinq classes disponibles alimentent une sélection de quatre places dans la proposition GRP-53 ; elles ne créent pas une cinquième place automatique. Les capacités précises, équipements et états de progression encore insuffisamment établis restent signalés.

Les **sept kits d’AFE1**, les **six kits d’AFE2** et les **neuf unités humaines d’AVP: Extinction** avaient déjà leurs fiches : ils sont revérifiés et conservés par jeu. Les variantes FPS d’une arme ne sont pas transférées aux unités du RTS. Les 22 contrôles d’arsenal ajoutés cette passe précisent l’œuvre, la preuve et l’usage proposé sans fabriquer une classe supplémentaire pour chaque arme.

Les identités ajoutées comprennent Rookie d’AVP 2010, Winter, Cruz, O’Neal, Bella et Reid de Colonial Marines, Zula Hendricks, Davis 01, Ben Carver, ainsi que Dutch et Linn de l’arcade Capcom. Les incarnations restent séparées par œuvre. **Zula, Davis 01 et Hicks conservent chacun une seule identité documentaire**, avec plusieurs incarnations lorsqu’elles sont établies.

Sources principales : [annonces et correctifs du développeur Dark Descent](https://steamcommunity.com/app/1150440/allnews/), [présentation de Colonial Marines par SEGA](https://blog.playstation.com/archive/2013/02/13/aliens-colonial-marines-bursts-onto-psn-today-with-plus-discount), [présentation de Rogue Incursion par Survios](https://survios.com/studio/pre-order-alien-rogue-incursion/). Les autres sources et leurs limites sont conservées dans les fiches.

### Films, comics, véhicules et affiliations

Douze identités de Marines d’**Aliens** sont ajoutées : Gorman, Hicks, Hudson, Vasquez, Frost, Apone, Crowe, Wierzbowski, Dietrich, Drake, Ferro et Spunkmeyer. Le relevé s’appuie notamment sur les matériels licenciés GF9 et NECA ; il ne remplace pas le contrôle de chaque scène, arme et animation du film. Ripley, Burke et Newt reçoivent des fiches civiles séparées. Newt n’alimente aucun groupe d’infanterie.

Le catalogue ajoute Alec Brand, Captain Paget, les Davis reprogrammés hostiles, le M577, le P-5000, le Cheyenne et les matériels ou classes propres aux adaptations licenciées. Les **Davis reprogrammés ne sont pas des clones du Davis 01 allié**. Un pilote déjà alloué n’est pas recompté lors de l’embarquement. Exosuit d’Extinction, P-5000 et Exosuit WY de Hot Landing Zone restent des matériels distincts.

La règle d’affiliation distingue **USCM**, **USM**, forces corporatives et civils. Une mission de Paget pour Weyland-Yutani ne transforme pas son détachement USCM en commandos privés. Les synthétiques sont classés selon leur modèle, leur rôle et leur allégeance locale. Ash, David, Walter, Bishop, Call, Andy et Rook ne deviennent pas tous des ennemis WY par leur seule nature synthétique.

Le module Hot Landing Zone ajoute ses propres **Heavy Marine, WY Commando Captain et WY Exosuit**. Les règles de cette adaptation ne définissent pas une hiérarchie universelle de tous les films et jeux. **Synth Warden d’AFE1 et Warden xénomorphe d’AFE2** restent distincts.

Sources de référence : [livret GF9 Aliens](https://www.gf9games.com/aliens/wp-content/uploads/2023/02/Aliens-Rulebook-2023-LR.pdf), [livret Ultimate Badasses, document primaire reproduit](https://tesera.ru/images/items/1765424/Aliens-UB-Rulebook.pdf), [règles Prodos Hot Landing Zone](https://prodosgames.com/sites/prodosgames.com/files/files/AvP_HLZ_rulebook_v1.pdf).

## Yautja, xénomorphes et autres organismes

La passe ajoute **Serpent Hunter / Alien Head Predator**, **Predator Hunter**, **Predator Warrior** et **Mad Predator** dans leurs incarnations AVP 2010 ou arcade Capcom. Leurs noms ne constituent pas quatre races nouvelles.

Le texte photographié de l’emballage NECA Alpha établit, dans ce récit licencié, les **Hish-qu-Ten**, les **Amengi**, la révolte et l’appellation **First Hunter**. Il permet d’ajouter deux fiches optionnelles et de préciser Alpha, sans étendre cette généalogie à tous les films ou à Hunting Grounds. La photographie ne confirme pas le nom Kaail. [Document primaire inspecté : dos de l’emballage NECA, reproduit par Toy Wizards](https://toy-wizards.com/wp-content/uploads/2020/05/95894107_3128871713841859_5922811062834429952_o.jpg).

Les quatre formes **Alien Brute, Guard, Scout et Skulker** de GF9 Five by Five sont conservées **hors socle par défaut**. Leurs règles et silhouettes de plateau ne prouvent pas une caste filmique ; leurs éventuelles animations 3D seraient des créations d’adaptation. Les fiches Queen Facehugger et Bambi Burster conservent leurs limites de provenance et de montage. [Livret Five by Five, document primaire reproduit](https://www.tesera.ru/images/items/2364137/Aliens-5x5-Rulebook-WEB.pdf).

Les ajouts précédents restent présents : classes Hunting Grounds manquantes, Yautja nommés et Lost Tribe, formes de jeux et comics, organismes d’Alien: Earth, Prometheus et films associés. Les types, rangs, clans, individus, stades biologiques et mutations restent explicitement séparés. Les **11 fiches optionnelles** cumulées sont distinctes des **7 exclusions de périmètre**.

## Sept lieux et sept groupes supplémentaires

Les lieux ajoutés sont **Hadley’s Hope / LV-426**, **USS Sulaco**, **Tartarus**, **Europa**, **Legato**, **Purdan / LV-354 — Castor’s Cradle** et **USS Sephora**. Les variantes film, jeu et comic sont délimitées. Purdan, LV-354 et son installation ne forment pas trois planètes différentes. Les sept fiches décrivent des zones, objectifs et rencontres possibles ; elles ne représentent pas sept cartes déjà construites et ne revendiquent aucune superficie officielle ou topographie 1:1.

Les groupes ajoutés couvrent le détachement nommé d’Aliens, la mission Sephora, le binôme Zula / Davis 01, l’équipage Cheyenne, un détachement original sous Paget, un contingent de Davis reprogrammés et une configuration de quatre Marines AFE2. Les effectifs sont des **propositions de conception**, adaptées aux quotas du projet. Les personnages nommés sont uniques, les pertes persistent et les réserves sont finies. Les scènes à trois camps et les rencontres supplémentaires sont annoncées comme adaptations lorsqu’elles ne sont pas attestées.

Les affrontements entre clans Yautja, contre les humains ou les xénomorphes et à trois camps du précédent audit restent dans leurs onglets. Les sept lieux ne modifient pas les 34 plans existants de **Cartes_zones**.

## Écarts prioritaires du code

La construction des **27 configurations d’opération** a été exécutée sans exception. `allowHumanController: true` sert uniquement à inspecter les configurations optionnelles AFF-25 et AFF-26 ; ce contrôle ne démontre pas l’existence d’un contrôleur humain jouable.

| Priorité | Cas | Constat | Travail requis |
|---|---|---|---|
| P0 | AFF-27 / GRP-60 — Extinction | Les 22 sections H-LIGNE et 2 H-APPUI allouent 192 places, dont 24 Synthetic et 2 Exosuits pilotés. Le constructeur produit 24 officiers et 168 soldats génériques, tous `actorType: marine`. | Conserver les neuf rôles et leur profil source dans l’allocation ; choisir le bon acteur, l’espèce et le matériel. |
| P0 | AFF-13 / GRP-50 — Working Joes | Les profils générés restent des soldats/officiers humains de type Marine. | Raccorder le groupe à un acteur synthétique compatible. |
| P0 | AFF-16 / GRP-46 — synthétiques WY | Même conversion des profils synthétiques en Marines humains. | Préserver espèce, modèle et affiliation lors de la génération. |
| P1 | AFF-25 / GRP-53 — Dark Descent | Les 32 places générées n’utilisent pas les cinq classes locales documentées. | Définir les sélections de classes puis les relier aux acteurs. |
| P1 | Spécialisation Marine | `marine`, `human` et `smartgunner` empruntent la même branche ; `flametrooper` est la seule autre variante examinée. | Relier les armes, fonctions et modèles propres au preset. |
| P1 | USCM contre force corporative | `allocatedCamp` regroupe les ennemis humains sous `human_force`. | Séparer affiliation, espèce et relations de scénario. |
| P2 | GRP-47 — Fireteam Elite | Aucune des 27 configurations ne référence ce groupe pourtant catalogué. | Créer son raccord d’opération si la proposition est retenue. |

Les **192 places** sont le budget proposé par le projet, réparti entre unités actives, distantes et réserves ; ce n’est ni un nombre canonique du RTS ni une mesure de personnages affichés simultanément.

Preuves figées : [construction des groupes](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/data/BattleCatalog.js#L240-L265), [camp humain](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/data/BattleCatalog.js#L144-L150), [gestionnaire Marine](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/entities/ColonialMarines.js#L190-L197), [variantes du modèle](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/graphics/SupportModels.js#L170-L187), [garde du contrôleur humain](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/data/BattleCatalog.js#L212-L222).

Le code conserve **115 profils source, 7 personnages jouables et 18 entrées de boss**. Les ajouts documentaires ne sont pas des unités implémentées. Ces défauts restent des travaux à réaliser dans une modification de gameplay distincte.

## Dossiers ouverts et fidélité

Les sources comprennent **212 références / 183 URL distinctes de documents primaires**, parfois reproduits par un autre hébergeur. Chaque fiche précise la portée de la preuve. Une publication sous licence atteste son incarnation ; elle ne prouve pas une continuité universelle entre tous les médias.

Les **43 dossiers à documenter** comprennent notamment les sous-types synthétiques d’AFE1, les PMC / Hazmat / Heavy de Colonial Marines, les synthétiques d’AVP 2010, Darwin Era, les rosters complets d’Infestation et de plusieurs comics, les unités RPG, les variantes royales, certains clans et les plans détaillés de lieux. Certains dossiers disposent déjà d’une preuve partielle mais nécessitent encore le relevé du roster, des scènes ou des capacités. Le dossier Hish restant ouvert concerne aussi ses autres incarnations et clans ; les deux fiches issues du récit NECA ne le closent pas entièrement.

Le nombre de dossiers ouverts augmente par rapport à la première passe parce que la couverture USCM s’élargit et que les preuves partielles sont normalisées sous le même statut. CTRL-007 est désormais résolu par la précision utilisateur. Les dossiers arcade documentés et Amengi/NECA sont également mis à jour, avec leurs limites conservées.

La fidélité quasi 1:1 reste un objectif à vérifier **par incarnation** : source, silhouette, équipement, attaques, mobilité, comportement, affiliation, décor et conditions de rencontre. Les adaptations Musou des effectifs, réserves et fronts simultanés sont explicitement des choix de conception du projet.

## Conservation et vérification du classeur

Les **126 actions historiques** conservent **54 « Terminé », 47 « À valider » et 25 « En cours »**. Les 17 budgets, 40 plans de fronts, 34 plans de cartes, 39 rencontres et 27 batailles restent conservés. Les 62 groupes précédents sont conservés, avec six règles/compositions précisées, et sept groupes sont ajoutés. Les 27 lieux précédents restent présents ; sept sont ajoutés. Le total de lignes détaillées passe de **859 à 978**.

La validation finale est consignée dans `completeness-audit.json`, section `validation`. Elle compare les données sauvegardées aux matrices attendues, contrôle les identifiants, calculs de synthèse, tables, filtres, validations, mises en forme conditionnelles et la conservation des cellules hors périmètre. Les 148 formules antérieures sont conservées et six formules USCM ajoutées. Les vues modifiées font l’objet d’un contrôle visuel. Aucun lancement de Microsoft Excel natif n’est revendiqué.
