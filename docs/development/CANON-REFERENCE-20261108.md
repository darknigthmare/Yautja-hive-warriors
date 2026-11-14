# Référentiel de continuité du 8 novembre 2026

Cette revue complète les sources de la continuation du 9 novembre. Le dépôt lié `darknigthmare/alien_base` contient une évolution documentaire récente sur `feat/gaska-canon-reference-20261108`, au commit **`4523008b777055177c10747148d111d92226d148`**, daté du 8 novembre à 19:50:39 CET. Les documents examinés sont épinglés ci-dessous ; leur contenu intégral et les données du dépôt maître ne sont pas recopiés dans le jeu.

L'[index de cette révision](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/INDEX.md#L10) décrit **912 notices et 1105 rattachements à des références**. Ses [six catalogues CSV](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/INDEX.md#L28) s'ouvrent dans Excel. Ces ajouts peuvent correspondre au référentiel récent évoqué par l'utilisateur ; cette correspondance reste à confirmer. Aucune bible de conception explicitement destinée à Yautja Hive Warriors n'a été retrouvée dans la recherche bornée.

Le [contrat Musou du jeu](MUSOU-GAMEPLAY-CONTRACT.md) conserve son rôle de référence de conception. Le référentiel lié classe des sources et des recherches : il ne prescrit pas la boucle de gameplay, les statistiques ou le level design de tous les jeux Alien/Predator. Les 912 notices ne remplacent pas les 773 lignes du snapshot public contrôlé déjà intégré au jeu.

## Règles applicables

Les citations suivantes sont des extraits courts des [règles épinglées](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/RULES.md#L7). Leur application demeure limitée au périmètre décrit.

| Règle de la révision | Application à Yautja Hive Warriors |
| --- | --- |
| « Alien, Predator et AVP restent distincts dans cette grille. » — [ligne 7](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/RULES.md#L7) | Une caste ou une capacité empruntée à *Aliens versus Predator: Extinction* reste rattachée à cette source. Elle n'est pas attribuée automatiquement aux créatures des films Alien ou Predator. |
| « Identifier le support exact. » — [ligne 8](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/RULES.md#L8) | Garder distincts film, montage, roman, comic et jeu, ainsi que les incarnations et équipements du roster. |
| « Vérifier le fait dans son contenu. » — [ligne 10](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/RULES.md#L10) | Un lien de provenance ou une fiche de recherche ne valide pas à lui seul une apparence, un nom, une capacité ou une certification 1:1. |
| « Préserver les données de jeu. » — [ligne 11](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/canon/RULES.md#L11) | Les PV, dégâts, distances, délais et budgets du Musou restent des réglages de ce projet. Leur source documentaire ne les rend pas universels. |

La [spécification de la couche documentaire](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/CANON_REFERENCE_EXPANSION.md#L13) précise aussi : « Une notice documentaire n'est pas une nouvelle identité de personnage ni une nouvelle unité jouable. » Aucun nouveau combattant, aucune renumérotation et aucun import de catalogue ne sont effectués dans cette passe à partir de ces notices.

Le [périmètre de classement](https://github.com/darknigthmare/alien_base/blob/4523008b777055177c10747148d111d92226d148/docs/CANON_REFERENCE_EXPANSION.md#L7) distingue une référence nommée d'un rattachement descriptif à une franchise. Cette lecture ne déduit aucun tier individuel nouveau pour *Extinction*, ni une attestation que chaque titre AVP a été examiné dans l'article d'origine. L'article amont de Gaska n'a pas été reconsulté pendant cette recherche.

## Compatibilité des corrections de cette passe

| Périmètre vérifié en lecture | Résultat de cohérence |
| --- | --- |
| Terrain de l'opération et petits plans | Les opérations conservent leurs identités et descriptions. Les repères numérotés n'altèrent pas leurs données. Le terrain lié à AFF-27 reste explicitement une adaptation sur `xenomorph_prime`, avec géographie 1:1 non vérifiée. |
| Caméras d'insertion | Le solveur physique change la position d'observation, sans ajouter de lieu, d'incarnation ou de propriété biologique. Les toits et branches sont conservés ; aucune fidélité de décor n'en est déduite. |
| Vol du Carrier | La capacité reste limitée à la variante Extinction signée. Le lancement consomme l'un des six UID déjà alloués, avec les mêmes portées tactiques et budgets. La capacité améliorée de douze ne crée pas six individus supplémentaires. |
| Catalepsie du Ravager et secours allié | La phase de Résilience colossale conserve son propriétaire biologique et sa source signée. Le système médical Yautja ne lui impose pas un minuteur ou un coût de secours. Les douze secondes et le retour à 50 % de PV restent des adaptations Musou. |

Aucune contradiction de continuité ou de provenance n'a été identifiée pour ces corrections. Ce résultat est une revue de cohérence documentaire ; la validation d'exécution appartient aux [preuves de la continuation](../qa/continuation-20261109-validation.json). Il ne certifie ni tous les classements du référentiel, ni les modèles, les animations, les géométries, la compréhension humaine ou les performances matérielles.

## Traçabilité et limites

La [recherche bornée](../qa/continuation-20261109/bible-discovery.json) conserve les commits, chemins, Git blobs et SHA-256 des documents lus. Elle examine les métadonnées des trente branches du dépôt lié, sans télécharger ses classeurs, assets ou dumps. Le Wiki Git du jeu n'a pas été accessible ; ce résultat ne prouve pas l'absence d'une bible sous un autre titre, dans un autre dépôt ou dans une modification non poussée.

Les sources historiques des audits et l'inventaire initial de 23 documents restent inchangés. Les données de référence du jeu ne sont pas régénérées. Une future admission de contenu ou mise à jour du snapshot public nécessite sa propre comparaison contrôlée et les validations prévues par le contrat du jeu.
