# Liaison Yautja Hive Warriors → Alien_base v1

La branche comporte un pont sans réseau (pas de token, ni asset privé) vers `darknigthmare/alien_base` PR #4 : **36 armes/gadgets** et **7 personnages Yautja**. Les données historiques/ludiques existantes (origine, couleurs, HP, coups, vitesse, abilities, loadouts) restent propriété du jeu ; aucune valeur ne devient « canonique » dans la base.

Après import de `js/data/charactersData.js`, les 43 entrées portent un `sharedEntityId` non énumérable, exploitable par un codex, un inventaire ou un futur éditeur sans altérer la sérialisation. La fonction `resolveAlienBaseIdentityV1(group,localId)` est exportée. `npm test` vérifie les mappings.

Les origines indiquées par le jeu sont conservées comme labels de provenance **à vérifier** ; ni arme composite, ni équipement original ne devient un accessoire officiel par assimilation.

## Réconciliation de provenance — 2 novembre 2026

La proposition de registre consolidé [Alien_base #25](https://github.com/darknigthmare/alien_base/pull/25) compte 652 identités, mais est **toujours non fusionnée**. La comparaison avec le registre v1 confirme les **43 mêmes correspondances d'ID** pour ce jeu : 36 armes/gadgets et 7 personnages ; aucune migration ou modification des stats n'est justifiée.

La base apporte toutefois **14 nouvelles références de sources** pour **12 fiches déjà existantes** : 7 Yautja, 5 équipements. Le module `js/data/alien-base-v2-crossrefs.js` les expose par `getAlienBaseCrossReferencesV2(sharedEntityId)`, avec repo, chemin, ID local, empreinte Git blob. Ces sources relient les dossiers à `yautja-la-longue-chasse` ou `yautja-apex-hunt` ; elles ne certifient ni canon, ni modèle visuel 1:1, ni date de publication.

Les tableaux gardent leurs 43 entrées, et `sharedSourceRefsV2` est ajouté seulement en propriété **non énumérable** sur les 12 éléments concernés. Gameplay, sauvegardes, palettes, mouvements et équipements inchangés. Le registre v1 reste la référence active ; la v2 est une **prévisualisation documentaire**, pas une fusion de `main`.
