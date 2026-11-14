# Gantelet droit City Hunter et limites des lames natives — 25 octobre 2026

Le vrai boîtier droit conserve maintenant sa forme d’armure pendant les mouvements du bras et du poignet. Les trois surfaces déjà séparées `model_part2`, `model_part8` et `model_part9` suivent rigidement `RightForeArm`, avec leurs triangles, UV et matériaux PBR d’origine. Aucun visage, bras, main ou triangle de lame n’est coupé. Les fichiers GLB restent inchangés.

Cette correction concerne **3 254 sommets / 3 221 triangles**. Les parties 8 et 9 sont des bandes du boîtier ; elles ne sont pas deux lames complètes.

## Intégration et propriété

`installCityHunterRightGauntlet(adapter, { sourceSha256 })`, dans `js/graphics/CityHunterRightGauntlet.js`, s’installe sur l’adaptateur privé au repos, après `adapter.update(0, false)`. La calibration exporte `CITY_HUNTER_RIGHT_GAUNTLET` depuis `CityHunterRightGauntletCalibration.js`.

L’installateur vérifie le SHA du corps corrigé, les noms uniques, les topologies, les bornes et la conservation du repos. Il convertit trois clones de géométrie vers le repère du vrai os d’avant-bras et masque les trois surfaces sources. Il ne modifie ni leurs buffers ni leurs poids, ni le cache partagé. Les matériaux de l’acteur sont empruntés sans modification.

Le retour expose `group`, `parts`, `setEnabled(bool)`, `getState()`, `diagnostics` et `dispose()`. Aucun calcul par frame n’est nécessaire. `dispose()` doit précéder celui de l’adaptateur ; il rétablit les visibilités originales et libère uniquement les trois géométries privées, une seule fois. `fullWristbladeSeparation` reste explicitement `false`.

## Vérifications réalisées

| Contrôle sur le véritable corps corrigé | Résultat |
| --- | --- |
| GLB contrôlé | SHA-256 `0e297a50400f885f06595f2fb59c85aed5118517a03c140f0f3aefa5288b564b` |
| Erreur maximale de position au repos, rendu d’essai | `1,408850784847858 × 10⁻⁷` unité jeu |
| Normales et tangentes au repos | Erreur vectorielle `< 2 × 10⁻⁶`, handedness conservée |
| UV et indices | Copies identiques, sans nouveau dépliage |
| Rendu PBR original / corrigé | 26 appels, 235 918 triangles dans les deux cas |
| Comparaison repos, 935 000 pixels | 281 pixels différents ; écart moyen par canal `0,000214 / 255` |
| Poses | Vrai os `RightHand` plié, bras et avant-bras en plusieurs positions |
| Propriété / nettoyage | Deux acteurs indépendants, cache intact, matériaux empruntés non libérés, restauration et destruction idempotente |

Les cinq tests de `tests/city-hunter-right-gauntlet.test.js` passent. Ils calculent également les directions après skinning, afin de vérifier les normales et tangentes telles que le shader les utilise. Le contrôle du vrai os de main est explicite : les contrôles de main ne figurent actuellement pas dans `ImportedCharacter.ROLES`.

Les cinq captures PBR contrôlées sont dans `/workspace/qa/native-blades-fidelity-20261025/` : `original-rest.png`, `rigid-rest.png`, `original-wrist-flex.png`, `rigid-wrist-flex.png` et `elbow.png`. Le boîtier corrigé reste rigide ; le repos paraît inchangé. La comparaison n’est pas annoncée comme strictement identique pixel par pixel. Ce contrôle automatisé ne constitue ni un test humain ni une certification de fidélité cinématographique.

## Vraies lames : recherche arrêtée avant une extraction incorrecte

Le corps City contient les vraies projections distales dans `model_part1`, avec le bras et la main : **6 743 triangles / 6 566 sommets, une seule composante soudée** après regroupement à `10⁻⁶`. Les bandes 8 et 9 restent entre `y = 1,3018` et `1,5505` ; elles ne contiennent pas les extrémités visibles du modèle. Les projections natives présentent plusieurs formes métalliques voisines ; leur attribution à deux lames complètes correspondant à la photographie de référence n’a pas été certifiée.

Le Jungle Hunter riggé est lui aussi une seule composante soudée : **206 591 triangles / 222 422 sommets**. La pièce courbe 13 du précédent Auto Split appartient à une reconstruction différente ; elle ne peut pas servir de preuve d’extraction fidèle du GLB riggé.

Un essai de coupe planaire dans la sortie droite City a été calculé localement, sans animation ni modification du runtime. Il conserve chaque face source une seule fois entre sélection et reste, mais **échoue au contrôle de fermeture** :

- 1 585 triangles sélectionnés et 5 158 retenus ;
- 94 arêtes de coupe, 99 sommets de bord ;
- 10 sommets de bord sous la limite inférieure du boîtier isolé connu ;
- 48 sommets de bord au-delà de sa limite en Z.

Ces nombres ne prouvent pas qu’aucune reconstruction manuelle n’est possible. Ils prouvent que cette coupe ne fournit pas deux composants complets et fermés dont les racines seraient toutes couvertes par l’armure. Elle pourrait laisser une ouverture visible et entraîner une surface du poignet. Le candidat est marqué `rejected-diagnostic-cut`, `productionEnabled: false`. Aucune rétraction des lames natives n’est donc activée.

La prochaine étape concrète consiste à identifier les deux surfaces complètes sur plusieurs vues de la référence, reconstruire leurs racines et les deux sorties du boîtier, puis démontrer que toutes les faces enlevées sont du métal couvert et qu’aucune peau ne manque. Le contrôle doit comparer repos fermé, lames sorties, lames rétractées, UV/normales et conservation de la main avant toute intégration. Ajouter des polygones aux fragments actuels ne résout pas ce problème d’identité et de topologie.

## Reproduction sans GPU ni dépense Meshy

```sh
node --max-old-space-size=2048 --test --test-concurrency=1 tests/city-hunter-right-gauntlet.test.js
node --max-old-space-size=2048 scripts/audit-native-wristblades.mjs /tmp/wristblade-audit
```

Le second outil vérifie les SHA et composantes des deux GLB, puis écrit les mesures et plages de faces du seul candidat diagnostique. Il ne génère aucun modèle, n’écrase aucun GLB et n’envoie aucune requête Meshy.
