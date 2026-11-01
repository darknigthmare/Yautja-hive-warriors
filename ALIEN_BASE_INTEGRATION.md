# Liaison Yautja Hive Warriors → Alien_base v1

La branche comporte un pont sans réseau (pas de token, ni asset privé) vers `darknigthmare/alien_base` PR #4 : **36 armes/gadgets** et **7 personnages Yautja**. Les données historiques/ludiques existantes (origine, couleurs, HP, coups, vitesse, abilities, loadouts) restent propriété du jeu ; aucune valeur ne devient « canonique » dans la base.

Après import de `js/data/charactersData.js`, les 43 entrées portent un `sharedEntityId` non énumérable, exploitable par un codex, un inventaire ou un futur éditeur sans altérer la sérialisation. La fonction `resolveAlienBaseIdentityV1(group,localId)` est exportée. `npm test` vérifie les mappings.

Les origines indiquées par le jeu sont conservées comme labels de provenance **à vérifier** ; ni arme composite, ni équipement original ne devient un accessoire officiel par assimilation.
