# Liaison Yautja Hive Warriors → Alien_base v1

Le jeu comporte un pont documentaire sans réseau (pas de token, ni asset privé) vers le snapshot `darknigthmare/alien_base` PR #4 : **36 armes/gadgets** et **7 personnages Yautja**. Les données ludiques et les kits de référence actuels (origine affichée, couleurs, HP, coups, vitesse, abilities, loadouts) restent propriété du jeu ; aucune valeur ne devient « canonique » dans la base.

Après import de `js/data/charactersData.js`, les 43 entrées portent un `sharedEntityId` non énumérable, exploitable par un codex, un inventaire ou un futur éditeur sans altérer la sérialisation. La fonction `resolveAlienBaseIdentityV1(group,localId)` est exportée. `npm test` vérifie les mappings.

Les origines indiquées par le jeu sont conservées comme labels de provenance **à vérifier** ; ni arme composite, ni équipement original ne devient un accessoire officiel par assimilation.

## Réconciliation de provenance — 2 novembre 2026

La photographie documentaire de la proposition de registre consolidé [Alien_base #25](https://github.com/darknigthmare/alien_base/pull/25), au commit `57689c2dd2dcadb3572e81ed6f3179dbad27f450`, compte 652 identités et porte le statut **non fusionnée**. Ce statut décrit ce snapshot ; il ne constitue pas une vérification en direct de la PR. La comparaison avec le registre v1 confirme les **43 mêmes correspondances d'ID** pour ce jeu : 36 armes/gadgets et 7 personnages ; aucune migration ou modification des stats n'est justifiée.

La base apporte toutefois **14 nouvelles références de sources** pour **12 fiches déjà existantes** : 7 Yautja, 5 équipements. Le module `js/data/alien-base-v2-crossrefs.js` les expose par `getAlienBaseCrossReferencesV2(sharedEntityId)`, avec repo, chemin, ID local, empreinte Git blob. Ces sources relient les dossiers à `yautja-la-longue-chasse` ou `yautja-apex-hunt` ; elles ne certifient ni canon, ni modèle visuel 1:1, ni date de publication.

Les tableaux gardent leurs 43 entrées, et `sharedSourceRefsV2` est ajouté seulement en propriété **non énumérable** sur les 12 éléments concernés. Gameplay, sauvegardes, palettes, mouvements et équipements inchangés. Le registre v1 reste la référence active ; la v2 est une **prévisualisation documentaire**, pas une fusion de `main`.

## Intégration sur le gameplay courant — 9 novembre 2026

La branche de provenance `9ea0f7313403127516e1874346ba61f5bad283b9` a été rapprochée du gameplay de la continuation du 2 novembre et des fusions GitHub du 4 novembre. L'intégration conserve les cartes produites par `getHunterReferenceCard` et les permissions de `hunterArsenal.js`. Les anciens libellés du snapshot v1 restent des métadonnées historiques : ils ne réintroduisent ni pistolet de Wolf chez City Hunter, ni arme d'une autre incarnation dans un kit.

Les identités `character.yautja.*` et `item.yautja.*` de ce pont sont distinctes des IDs `yhw:*` du [registre public de bataille](docs/audits/2026-11-01/ALIEN_BASE_SYNC.md), qui conserve ses 773 lignes de suivi. Aucun rapprochement par nom, admission de combattant, contenu privé ou modification de cet export n'est effectué. Le premier pont décrit les 43 entrées de l'interface Yautja ; l'autre porte les dossiers de bataille et leurs propres espaces de noms.

Les snapshots et leurs références sont profondément immuables. Les résolveurs rejettent les clés héritées et les valeurs non textuelles ; les propriétés ajoutées aux fiches restent en lecture seule et absentes de JSON comme de l'expansion d'objet. Les [preuves de cette passe](docs/qa/continuation-20261109/provenance/) distinguent l'échec initial d'export manquant, la conservation de la sérialisation et les contrôles exécutés après fusion. Cette intégration ne certifie ni rendu, ni performance matérielle, ni fidélité visuelle 1:1.
