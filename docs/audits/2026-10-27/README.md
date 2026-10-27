# Contrôle de complétude du catalogue — 27 octobre 2026

Ce contrôle poursuit l’audit Musou et le catalogue de médias de la PR #3. Il répond à la demande de vérifier les castes, formes, classes, individus, clans et forces humaines ou synthétiques oubliés dans la dernière version de travail.

**Résultat : 102 fiches documentées ajoutées aux 115 fiches existantes, soit 217 fiches.** Le nouveau registre conserve également **31 dossiers à documenter**, **7 exclusions du socle** et le terme utilisateur **« Isco » à préciser**. Ces résultats ne constituent pas une certification d’exhaustivité de tous les médias Alien / Predator.

## Livrables

- [Excel révisé — 16 onglets](Yautja_Hive_Warriors_Controle_Completude_2026-10-27.xlsx)
- [Données du contrôle et inventaire de code](completeness-audit.json)
- [Classeur historique et audit du 26 octobre](../2026-10-26/README.md)

Le nouvel onglet **Controle_roster** rassemble 80 contrôles : écarts de code, corrections d’identité, preuves manquantes, limites et couverture des œuvres. **Bestiaire_medias** contient les 217 fiches avec leur œuvre, niveau de preuve, sources, éligibilité au spawn, règles de groupe, lieux compatibles et travail restant. **Synthese** ajoute un bloc de contrôle daté sans remplacer la synthèse historique.

## Version examinée

| Élément | Référence vérifiée |
|---|---|
| Branche de travail la plus récente examinée | `codex/complete-pr3-20261026` |
| Commit audité | [`39871c450379225de8174711237632e6aa883f04`](https://github.com/darknigthmare/Yautja-hive-warriors/tree/39871c450379225de8174711237632e6aa883f04) |
| `main` lors du contrôle | `af90000169256bd8781536ba7eca45d843d4173c` ; PR #3 fusionnée |
| Production Vercel | [`yautja-hive-warriors.vercel.app`](https://yautja-hive-warriors.vercel.app), déploiement `dpl_39FAHCh8Z68e8d6vHt4ZXg3ZSbaY`, état `READY`, origine `cli` |

Le déploiement de production ne fournit pas de SHA Git permettant de le rattacher au commit audité. Le présent contrôle ne certifie donc pas que le nouveau catalogue ou la dernière branche est déjà en production. Aucune nouvelle session WebGL ni mesure de performance matérielle n’a été réalisée pour cette révision documentaire.

La PR de ce dossier cible `codex/complete-pr3-20261026` afin de présenter uniquement les trois nouveaux fichiers du contrôle. Les fichiers historiques, le JSON consommé par le jeu et le gameplay restent ceux de cette branche.

## Ajouts documentés

| Famille de fiches | Avant | Ajouts | Total |
|---|---:|---:|---:|
| Xénomorphes, formes et organismes examinés avec ce registre | 37 | 26 | 63 |
| Yautja, classes, individus et groupes | 37 | 27 | 64 |
| Humains, synthétiques, groupes et matériels | 41 | 43 | 84 |
| Autres organismes associés | 0 | 6 | 6 |
| **Total** | **115** | **102** | **217** |

Ces totaux comptent des **fiches**, pas des espèces, des races, des modèles 3D ni des combattants rendus. Les préfixes servent au rangement documentaire : les organismes non xénomorphes et les taxonomies non résolues gardent une famille explicite dans leur fiche.

### Yautja

Seize fiches de classes de *Predator: Hunting Grounds* manquaient au sens retenu par ce catalogue : Valkyrie, Cleopatra, Exiled, Captured, Emissary, Bionic, Amazon, Pirate, Gladiator, Anubis, Exalted, Witch, Oni, Jotun, Father et Elder. La classe Elder est séparée de l’individu Greyback de *Predator 2* ; leur identité commune n’est pas présumée. Father reste un individu unique, même lorsqu’il dirige un clan.

Les autres ajouts comprennent notamment Kwei, Ahab, Broken Tusk, Hornhead et une fiche de groupe pour la Lost Tribe. Les crossovers et les créations de produits licenciés concernés sont signalés comme extensions optionnelles. L’appellation d’une classe, d’un équipement, d’un statut ou d’un personnage ne devient pas automatiquement une race biologique.

### Xénomorphes et organismes

Les ajouts comprennent les profils nommés de *Fireteam Elite 2*, Xenoborg, Empress d’*AVP2*, Queen Mother d’*Earth War*, des formes liées à *Alien 3*, Hammerpede, les organismes distincts d’*Alien: Earth*, Lurker / Spitter / Raven de *Colonial Marines* et les adversaires Razor Claws / Chrysalis / Arachnoid de l’arcade. Une source de figurine licenciée n’établit que les éléments explicitement attestés ; les montages du film et les mécaniques restent à contrôler lorsque la fiche le précise.

Le Titan de *Dark Descent* est enregistré comme menace nommée à identifier, avec spawn bloqué tant que son modèle et sa taxonomie ne sont pas vérifiés. Le cadre XEN-037 n’ajoute aucun acteur : il sélectionne les incarnations locales déjà documentées.

### Humains, Weyland-Yutani et synthétiques

Le registre distingue les sous-types synthétiques attestés, les classes de Colonial Marines, les commandos Weyland-Yutani et variantes d’armement, les mercenaires Corporate, OWLF, Stargazer, les équipements et les personnages uniques. Ash, David, Walter, Bishop, Annalee Call, Andy et Rook reçoivent des fiches narratives distinctes ; leur statut synthétique ne suffit pas à les traiter tous comme ennemis Weyland-Yutani.

**Synth Warden d’AFE1 et Warden xénomorphe d’AFE2 restent deux profils différents.** Les noms identiques entre jeux ne transfèrent automatiquement ni biologie, ni équipement, ni comportement.

## Écarts prioritaires constatés dans le code

La construction des configurations des **27 opérations** a été exécutée sans exception. L’option `allowHumanController: true` a uniquement permis d’inspecter les deux configurations humaines optionnelles. Cette vérification de configuration ne valide ni un contrôleur humain jouable, ni le rendu, ni les combats.

| Priorité | Cas | Constat reproductible | Travail requis |
|---|---|---|---|
| P0 | AFF-13 / GRP-50 — Working Joes | Les profils produits sont `original_human_soldier` et `original_human_officer`, avec `actorType: marine` et `species: human`. Aucun `working_joe` ou `synthetic` dans les profils de l’opération. | Conserver le type du groupe lors de l’allocation et sélectionner un acteur synthétique compatible. |
| P0 | AFF-16 / GRP-46 — synthétiques WY | Même conversion vers des profils Marines humains ; aucun `synthetic` ou `weyland_combat` dans les profils de l’opération. | Lier le profil du catalogue, son espèce et le gestionnaire d’acteurs, puis vérifier la composition générée. |
| P1 | Spécialisation des acteurs | Les registres acceptent quelques catégories génériques. Ils ne démontrent pas tous les sous-types ou individus du catalogue. | Établir une correspondance explicite profil → acteur → source et vérifier les différences réelles. |
| P1 | Relations entre camps | Le constructeur initialise les paires de factions comme hostiles. | Définir les alliances et hostilités par scénario, notamment pour les rencontres à trois camps. |

Preuves figées : [allocation des camps et profils génériques](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/data/BattleCatalog.js#L145-L175), [relations et groupes](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/data/BattleCatalog.js#L225-L265), [types synthétiques acceptés](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/entities/Synthetics.js#L298-L307), [types humains acceptés](https://github.com/darknigthmare/Yautja-hive-warriors/blob/39871c450379225de8174711237632e6aa883f04/js/entities/ColonialMarines.js#L190-L200).

Le code audité conserve **115 profils source, 7 personnages jouables et 18 entrées de boss**. Les 102 ajouts documentaires ne sont pas des unités nouvellement implémentées. Les noms de boss ou les commentaires « canon 1:1 » ne prouvent pas à eux seuls l’identité, les animations et le comportement d’une incarnation.

## Cohérence et limites explicites

Les sources sont conservées par fiche : **150 références, représentant 135 URL primaires distinctes**, avec leur portée et leur limite. Une œuvre officiellement publiée ou un produit licencié atteste sa propre incarnation ; cela ne démontre pas une continuité universelle entre tous les médias.

Les règles d’adaptation séparent espèce, stade biologique, mutation, classe de jeu, rang, clan, individu, groupe et matériel. Les individus nommés ne fournissent pas de réserves de clones. Un ajout remplace une place du budget de bataille alloué ; il ne crée pas automatiquement de renforts. Les alliances, lieux et compositions dépendent du preset choisi. Les rencontres originales réunissant plusieurs univers sont indiquées comme propositions d’adaptation.

Les **31 dossiers à documenter** comprennent notamment certains sous-types synthétiques d’AFE1, le roster précis des PMC de *Colonial Marines*, les synthétiques d’*AVP 2010*, Darwin Era, les factions de *Three World War*, plusieurs variantes royales de comics et les Amengi. Un dossier non résolu ne signifie pas que l’entité est inexistante : il identifie la preuve primaire manquante avant de promettre une fidélité 1:1.

Les **7 exclusions du socle** concernent des généralisations non démontrées ou des limites de périmètre : hiérarchie universelle de rangs, « Clan Apex » universel, classes traitées comme races, concepts non diffusés, variantes exclusivement issues de figurines, fusion de toutes les formes en une caste et Abe dans une scène supprimée. Ces exclusions sont distinctes des **5 nouvelles fiches optionnelles**, conservées dans le catalogue avec activation hors socle par défaut.

Le terme **« Isco »** n’a pas été identifié dans le code ou les sources consultées. Il reste dans CTRL-007. Les xénomorphes, Colonial Marines et forces corporatives ont été examinés séparément sans attribuer arbitrairement un sens à ce terme.

## Conservation du travail antérieur et vérification

Les **126 actions historiques** conservent leurs statuts : **54 « Terminé », 47 « À valider », 25 « En cours »**. Les 17 budgets, 62 groupes, 40 plans de fronts, 34 cartes, 39 rencontres et 27 batailles du précédent classeur sont conservés. Le total de lignes détaillées passe de 677 à **859** après les 102 ajouts et 80 contrôles.

La vérification finale du classeur est consignée dans `completeness-audit.json`, section `validation`. Elle contrôle les données enregistrées, les comptes, les identifiants, les formules, les tables, les filtres, les validations, les styles conditionnels et la conservation des feuilles historiques. Les vues modifiées sont contrôlées visuellement. Aucun lancement de Microsoft Excel natif n’est revendiqué.
