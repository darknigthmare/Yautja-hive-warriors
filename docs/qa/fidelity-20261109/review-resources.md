# Revue indépendante — ressources et intégration des acteurs

Revue du code par l’agent capsule, comparée au checkout `/workspace/Yautja-continue-20261109`, confirmé par l’agent principal comme la base `a8f9c75`. Deux régressions reproductibles ont été identifiées et transmises aux propriétaires des fichiers ; le reviewer n’a modifié aucun fichier de production. Un test d’intégration réel a été ajouté après autorisation de l’agent principal.

## Régressions trouvées

1. **P2 — pose calculée avant la collision finale.** L’appel initial ajouté dans `YautjaAllies.update()` enregistrait une position antérieure à `battleBridge.sync()` et aux corrections de collision de `main.js`. Avec le vrai `APCVehicle`, l’allié bloqué reste à `z=-7.517601311206818`, mais les deltas `[.016, .1, .016, .033, .016]` faisaient avancer sa phase de marche de `0` à `.5750`, `3.4982`, `4.0898`, puis `4.6814`. Sa foulée était donc calculée sur une tentative de mouvement rejetée. Correction confiée aux propriétaires : séparer `updateVisuals(delta)` du manager et l’appeler dans `main.js` après la dernière correction physique, sans appel préalable. Le nouveau test `tests/clan-hunter-apc-integration.test.js` reproduit ce chemin avec l’APC réel et vérifie également un seul avancement d’horloge.
2. **P2 — double libération des instances de roues APC.** L’ajout de la libération centralisée dans `SceneResources.js` doublait les appels manuels à `wheelInstances.dispose()` de `APCVehicle.spawn()` et `APCVehicle.clear()`. Le test existant `tests/apc-convoy-road.test.js:238` échouait avec `2 !== 1` ; un `clear()` isolé produisait également deux événements. Les deux appels manuels ont été retirés par l’agent principal afin de laisser un propriétaire de libération unique.

## Résultats

| Périmètre | Résultat et preuve |
| --- | --- |
| `SceneResources.js:7–20` | La libération des `InstancedMesh` appelle leur méthode Three `dispose()` puis libère chaque géométrie et matériau possédé une seule fois. Les surfaces retenues restent protégées. Ce chemin correspond au listener `onInstancedMeshDispose` de Three r160, qui retire `instanceMatrix` et `instanceColor` indépendamment des géométries. Aucune méthode `dispose` arbitraire n’est appelée sur les meshes ordinaires. |
| `SupportAssembly.js:6` | Extraction strictement identique au corps de l’ancienne classe après retrait du mot `export` : 2 778 caractères identiques. Les transforms, la fusion par matériau, la propriété des buffers et la libération des géométries temporaires restent identiques. |
| `SupportModels.js`, factories publiques | Les wrappers APC/capsule transmettent toujours la même classe `Assembly`. Le wrapper Honor Guard transmet son index à son nouveau builder. Les arguments booléens et les huit noms des rôles Marine conservent leur interprétation. Les équipements spécialisés et les métadonnées de fidélité non vérifiée sont préservés. |
| `YautjaAllies.js`, orchestration de pose | La séparation de la pose est nécessaire pour inclure les collisions finales de `main.js`, au-delà de la navigation interne du manager. Les branches formation, suivi sans cible et couverture ne doivent pas créer d’appel de pose anticipé. La garde existante sur delta bloque toute animation si delta est nul, négatif ou non fini. Voir la régression P2 et le test d’intégration ci-dessus. |
| `ClanHunterModel.js:284–299`, appelé par le manager | La pose ne touche pas au root physique. Le delta positif met à jour la dernière position même si l’acteur est à terre ou en récupération, ce qui évite une longue foulée au réveil. Une relocalisation de plus de 3 unités remet les poids de marche à zéro sans avancer la phase. Le seuil est supérieur au déplacement normal maximal d’une frame de jeu : delta est plafonné à 0,1 dans `main.js`, soit 1,45 unité au maximum pour un allié à 14,5 unités/s. Les matrices de dreadlocks et les morphs sont privés à chaque acteur. |
| Source kits / allocations | Les factories de présentation ne changent ni classe stratégique, ID, digest, stock, nombre d’unités ni template source. Les tests vérifient les 27 opérations et les huit kits Marine distincts ; les contrôles de stock limité et de sauvegarde passent. |

## Vérification exécutée

```sh
node --test tests/instanced-resource-lifecycle.test.js tests/clan-hunter-visual.test.js tests/source-actor-presentation.test.js tests/source-specialist-combat.test.js tests/source-battle-roster.test.js
```

Premier résultat : **29 tests réussis, 0 échec**, environ 10,7 secondes. Cela couvre les instances, la rétention des surfaces, l’indépendance des poses, la pause, la récupération, la relocalisation, l’intégration du manager, les identités source, les kits et les stocks limités. Cette première sélection ne couvrait pas les deux régressions d’intégration trouvées ensuite ; leur validation finale est consignée ci-dessous.

Un contrôle Node supplémentaire a importé le vrai module Three r160 `WebGLObjects`, avec des adaptateurs d’attributs simulés : deux acteurs instanciés avaient chacun `instanceMatrix` et `instanceColor`. La suppression du premier n’a retiré que ses deux attributs ; ceux du second ont été retirés lors de sa suppression propre. Ce contrôle vérifie le branchement du listener réel du renderer, au-delà du simple comptage d’événements `dispose` des tests unitaires. Il ne mesure pas la mémoire d’un contexte WebGL réel.

Limites : aucune capture navigateur, mesure GPU ni revue artistique supplémentaire dans cette tâche. Les déplacements courts imposés de l’extérieur, inférieurs au seuil de téléportation de 3 unités, sont volontairement interprétés comme un mouvement par l’animation ; aucun appel réel contredisant ce contrat n’a été trouvé dans le périmètre.

## Validation après corrections

Les deux P2 sont corrigés par les propriétaires des fichiers. `YautjaAllies.updateVisuals(delta)` est appelé une seule fois après `battleBridge.sync()` et la boucle finale des contacts environnement/capsule/APC dans `main.js`. Les libérations manuelles des instances de roues ont été retirées de `APCVehicle`.

```sh
node --test tests/clan-hunter-apc-integration.test.js tests/clan-hunter-visual.test.js tests/apc-convoy-road.test.js tests/instanced-resource-lifecycle.test.js
```

Résultat final : **29 tests réussis, 0 échec**, environ 3,9 secondes. Le test avec le M577 réel conserve la même position de contact, une phase de marche inchangée et un stride nul malgré les tentatives de navigation et des deltas variables. L’horloge de pose avance exactement une fois. Le test existant de remplacement/nettoyage APC vérifie de nouveau une seule libération de chaque instance de roues.

La nouvelle mise en cache CPU bornée du modèle Clan Hunter a également été relue : neuf géométries de template jamais ajoutées à une scène, géométries/morphs/matrices/materials privés pour chaque acteur. Le test de destruction/respawn et d’indépendance des buffers passe dans ce même lot. Aucun problème restant n’a été identifié dans le périmètre de cette revue.
