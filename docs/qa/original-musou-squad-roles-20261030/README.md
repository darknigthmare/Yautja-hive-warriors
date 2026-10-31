# Musou : escouades originales AFF-06 à AFF-10 — rôles individuels

Date : 30 octobre 2026 · Suite de la PR #6.

## Principe

Ces cinq batailles sont **des scénarios originaux du
jeu Yautja Hive Warriors**, structurés comme des combats
Musou. Elles n'appartiennent pas à la campagne RTS
d'AVP: Extinction et n'utilisent pas ses commandes
ou son économie de construction.

L'audit 2026-10-26 décrit neuf **modèles de groupes
originaux** : escouades de capture, sécurité
industrielle, Marines coloniaux, sûreté orbitale,
cordon militaire, commandement, assaut Yautja,
éclaireurs et appuis plasma.

Il n'existait pas de `forceAllocation` détaillé
par front pour AFF-06 à AFF-10. Le constructeur
`BattleCatalog.proposedAllocation` utilisait
une **traduction revue des effectifs et de la
prose** pour préserver les budgets. Les compositions
de rôle étaient restées invisibles : tous les
personnages portaient un intitulé générique.

## Fonctionnement appliqué

`js/data/OriginalMusouSquadRoles.js` associe
**un rôle nominatif à chaque position de l'escouade
déjà allouée**, sans générer de nouveau soldat.

Le résolveur consulte le catalogue d'origine
`simulation.config.groups[].sourceTemplateIds`,
le groupe actif et l'index de l'unité. Il
conserve absolument les profils persistants,
`actorType`, armes, PV, alignements, nombre
de soldats, `configDigest` et toutes les
sauvegardes déjà existantes.

`BattleActorBridge.spawnGroup` place le nom du
rôle sur l'acteur physique et son attribut
`mesh.userData.originalMusouRole` quand la
projection est disponible.

Un chef unique nommé et référencé par le
catalogue conserve toujours **son nom et son
identité de boss**, plutôt que le rôle
générique « Commandant ».

Le résolveur est limité aux cinq opérations.
Les films, jeux et batailles de ruche situés
ailleurs ne reçoivent aucun costume ni rôle
de ces scénarios originaux.

### Rôles couverts

| Source | Effectif par groupe | Identités |
|---|---:|---|
| GRP-37 | 8 | Chef, 4 fusiliers, 2 capture, 1 radio |
| GRP-38 | 8 | Chef, 4 fusiliers, appui, sapeur, observateur |
| GRP-39 | 8 | Chef, 4 fusiliers, smartgunner, brèche, radio |
| GRP-40 | 8 | Chef, 4 fusiliers, garde bouclier, technicien, observateur |
| GRP-41 | 8 | Chef, 4 fusiliers, observateur, radio, appui léger |
| GRP-42 | 8 | Commandant, 2 radios, 2 gardes, contre-surveillance, technicien, liaison |
| GRP-11 | 8 | Vétéran + 7 chasseurs Yautja |
| GRP-12 | 2 | 2 éclaireurs Yautja |
| GRP-13 | 4 | 2 tireurs plasma + 2 protecteurs Yautja |

Ce sont des **rôles de l'opération Musou
originale**, pas des uniformes, équipements
ou figurines sous licence déclarés exacts.

## Couverture inspectée

Sur les **configurations réelles** des cinq
opérations, le résolveur a trouvé :

| Opération | Unités allouées | Rôles résolus | Chefs uniques préservés |
|---|---:|---:|---:|
| AFF-06 | 264 | 263 | 1 |
| AFF-07 | 264 | 263 | 1 |
| AFF-08 | 800 | 799 | 1 |
| AFF-09 | 800 | 799 | 1 |
| AFF-10 | 800 | 799 | 1 |
| **Total inter-scénarios** | **2 928** | **2 923** | **5** |

Les totaux sont **cumulés entre cinq
opérations**, pas simultanés dans une
bataille et pas des objets rendus 3D
en parallèle.

## Validation et limites

`tests/original-musou-squad-roles.test.js`
vérifie la correspondance réelle de chacune
des cinq opérations, le refus d'écraser un
chef unique, l'absence de ces rôles sur AFF-27,
la conservation de l'identité d'un acteur
dans `BattleActorBridge`, les tailles
des neuf templates et les checkpoints.

**La présence des labels ne signifie pas que
leurs modèles/armes/animations sont terminés.**
Le rendu des forces contemporaines d'AFF-06/07,
des boucliers orbitaux, sapeurs, capteurs,
radios, armures et gestes de capture
reste un chantier d'assets à développer
avec des références cohérentes avec
l'époque et la carte.

`visualFidelity1to1Verified` et
`abilitiesImplemented` restent `false`
sur ces nouvelles annotations.
Les cinq tests d'intégration ont été
rédigés ; leur exécution doit être
confirmée sur le SHA GitHub Actions
de la PR #6.

## Suite des manquants

1. Uniformes humains contemporains distincts
   de l'USCM futuriste sur AFF-06/07.
2. Spécialiste de capture avec équipements
   physiques et interaction adaptée Musou ;
   ne pas inventer un dispositif de film.
3. Appui bouclier / sûreté orbitale et
   spécialistes du port de AFF-09/10.
4. Dreadlocks, masque, peau et armure par
   rôle Yautja, sans reproduire le STR d'Extinction.
5. Accès aux hangars, quais, rues, cloisons
   et routes ; collision et couverture
   réelles, sans géographie 1:1 revendiquée.
6. Affrontements multigroupes en caméra proche,
   réserve finie, deux joueurs et boss
   uniques avec réactions de l'IA.

L'identité du jeu reste **Musou en 3D**,
et les spécificités des œuvres restent
des contenus à transposer, jamais
la boucle de gameplay d'un RTS.

## Passe graphique complémentaire — accessoires originaux

`js/graphics/OriginalMusouFieldGear.js`
ajoute des **géométries Three.js réelles** aux
acteurs humains des cinq opérations, selon
leur poste d'escouade déjà résolu :

- AFF-06/07 : gilet/harnais et bandeau de casque
  d'une sécurité contemporaine originale,
  pour distinguer visuellement le contexte
  du port et de l'industrie des Marines
  coloniaux futuristes ;
- spécialistes de capture : outil de
  contention et accessoires de terrain ;
- radio et chefs : sac, antenne, microphone,
  marqueurs de commandement ;
- sapeurs / techniciens : équipements de
  maintenance et terminal de poignet ;
- observateurs : jumelles/système optique ;
- appui/smartgunner : réserve de munitions ;
- sûreté orbitale : **prototype de bouclier**
  porté, sans simulation de blocage ;
- agent de liaison : sacoche de mission.

Chaque accessoire :
- est enfant du **maillage existant** ;
- ne crée aucune unité ni source de dégât ;
- ne modifie ni `BattleSimulation`,
  `configDigest`, `actorType`, PV ou
  comportement du soldat ;
- n'est installé qu'une fois sur l'acteur,
  même après une tentative répétée ;
- est libéré lorsque le modèle propriétaire
  disparaît ;
- conserve `visualFidelity1to1Verified:false`
  et `operationalAbilityImplemented:false`.

Les figurines Yautja ne reçoivent pas
automatiquement d'accessoires humains :
leurs armes, masques, armures et peaux doivent
rester rattachés à leur source et à leurs
futurs GLB/PNG distincts, sans doublons.

Quatre tests dans
`tests/original-musou-field-gear.test.js`
vérifient les silhouettes de capture/radio,
le bouclier orbital, les exclusions
d'espèce/continuité, et l'installation dans
`BattleActorBridge` en utilisant de vrais
`THREE.Group`. Leur réussite CI doit encore
être confirmée sur le commit de publication.

**Limite :** l'équipement est un habillage
procédural de la base de Marine actuelle ;
le remplacement complet de la coupe USCM
par un modèle contemporain anatomiquement
cohérent pour AFF-06/07 reste à faire.
La présente passe ne fournit aucun
asset officiel 1:1.
