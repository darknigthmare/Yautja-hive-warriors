# Assemblage optionnel des pièces Yautja

`js/graphics/SplitYautjaAssembly.js` assemble **en mémoire** un GLB déjà découpé.
Il ne génère, ne téléverse, ne texture et n'articule aucun corps avec Meshy.
Aucun personnage du manifeste n'active ce module pour l'instant.

## Contrat

```js
import {
  createSplitYautjaAssembly,
  jungleHunterSplitPilotDescriptor
} from './SplitYautjaAssembly.js';

const descriptor = jungleHunterSplitPilotDescriptor();
const assembly = createSplitYautjaAssembly(loadedGltf, descriptor);
actor.add(assembly.root);
```

L'entrée est un GLB **non articulé** : aucun `Bone`, `SkinnedMesh` ou
`InstancedMesh`. Le descripteur de version 1 déclare les noms des vrais objets :

- `anatomy.parts` : tous les fragments anatomiques. `anatomy.requiredParts`
  désigne trois noms distincts, `body`, `leftHand` et `rightHand`, présents dans
  cette liste. Ces rôles sont des déclarations explicites, pas une reconnaissance
  automatique de l'anatomie.
- `equipment` et `hair` : listes de `{ id, label, parts, parent?, pivot? }`.
  Les noms ne sont jamais déduits de la couleur d'une pièce ou de `model_partN`.
- `parent` : identifiant d'un autre composant ou `anatomy`, `equipment`, `hair`.
  Les cycles sont refusés. Par défaut, le composant appartient à sa catégorie.
- `pivot` : point explicite `[x,y,z]` dans les coordonnées de l'assemblage source.
  Son absence signifie une simple origine de groupe, sans calibration mécanique.
  Aucun centre de boîte englobante n'est utilisé comme charnière implicite.
- `sockets` : liste de `{ id, label?, parent?, position }`. `position` utilise le
  même repère source. Les sockets sont des repères vides, pas des os de corps.

Chaque mesh source doit être affecté **exactement une fois**. Une main absente de
la liste anatomique, un objet oublié, un doublon ou un nom inconnu bloque
l'assemblage. Le module ne fabrique aucune surface pour remplir les coupes.

Le repère source est celui de la scène chargée, sous un parent d'acteur identité,
avec la transformation propre de cette scène incluse. Les matrices des meshes
sont conservées intégralement ; `matrixAutoUpdate=false` maintient même un
cisaillement provenant de parents transformés. Positions, indices, UV, couleurs,
groupes de triangles et plages de rendu ne sont pas modifiés.

## Objets renvoyés

| Propriété | Usage |
| --- | --- |
| `root` | Groupe à attacher à l'acteur |
| `anatomyRoot` | Tous les fragments anatomiques, mains comprises |
| `equipmentRoot`, `hairRoot` | Conteneurs des équipements et cheveux |
| `parts` | `Map<nom source, Mesh>` privé |
| `equipment`, `hair` | `Map<id, { root, label, parts }>` |
| `sockets` | `Map<id, Group>` de positions déclarées |
| `measurements` | État initial : limites, centres, tailles, sommets et triangles |
| `diagnostics` | Couverture des pièces, rôles déclarés et limites de l'assemblage |
| `measureBounds(names)` | Limites courantes dans le repère d'assemblage |
| `measureProjection(names, axis)` | Intervalle projeté sur un axe normalisé |
| `articulationDescriptor` | Mécanismes explicitement configurés pour `YautjaArticulation` |
| `replacePart(name, mesh)` | Remplacement privé, par exemple par un skin de cheveux |
| `dispose()` | Retrait et libération des ressources appartenant à l'assemblage |

Les mesures excluent la translation, la rotation et l'échelle mondiales de
l'acteur. Les mesures initiales restent des instantanés ; utiliser les méthodes
pour lire une pose ultérieure. Une transformation d'acteur singulière est refusée.

## Lames et couvercles

Un équipement peut déclarer un mécanisme déjà calibré :

```js
// validatedRail est propre au modèle : axe, course et état initial vérifiés.
descriptor.equipment.find(part => part.id === 'right-blade-assembly').mechanism = validatedRail;
```

Un rail a la forme
`{kind:'slider', axis:[x,y,z], travel, speed?, restState:'extended'|'retracted'}`.
Une charnière a la forme
`{kind:'hinge', axis:[x,y,z], angle, speed?, restState:'open'|'closed'}`.
Axes et déplacements suivent le repère **local du parent**, conformément à
`YautjaArticulation`. La charnière tourne autour du `pivot` déclaré du groupe.
Les dimensions, axes, courses et positions ne sont pas inventés par le module.

L'assemblage ne lance aucun moteur. Le propriétaire peut passer
`assembly.articulationDescriptor` à `createYautjaArticulation`, puis appeler les
commandes et `update` après la pose corporelle. Un descripteur sans mécanisme ni
chaîne ne doit pas être passé au contrôleur : il refuse les animations vides.

Le descripteur du pilote reste volontairement **statique**. Sur son vrai GLB :

- `model_part13` est une pièce courbe indépendante du gantelet `model_part18`.
  Un rail local peut donc la déplacer sans déplacer le gantelet ni la main.
  Cela ne transforme pas la pièce existante en deux lames canoniques.
- `model_part9` est une plaque de console candidate. Le module ne prétend pas
  connaître sa charnière ni son intérieur.
- Les cheveux `2,3,5,12,15,16,20,21` restent des fragments et des bouquets.
  Les noms des groupes ne constituent ni des chaînes d'os ni des poids de skin.
- L'anatomie rassemble `7,10,14,22`. Riguer `22` seul omettrait les mains et un
  segment de bras. Aucun squelette corporel n'est fourni ici.

## Cheveux et propriété des ressources

`replacePart` accepte un nouveau mesh non parenté et conserve son parent, sa
matrice exacte, sa visibilité et son nom de partie. Les positions au repos,
indices, groupes de triangles et `drawRange` doivent être identiques ; l'ajout
de poids ou d'os est possible sans reconstruire la géométrie. Un remplacement
`SkinnedMesh` utilise une visibilité conservative : `frustumCulled=false` jusqu'à
la définition de limites adaptées à l'animation.

Le constructeur clone les objets, géométries et matériaux. Deux acteurs peuvent
modifier leurs poses, géométries et matériaux indépendamment. Les textures du
cache restent partagées et ne sont jamais détruites par l'assemblage.

Un constructeur de skin, par exemple `SplitDreadlockRig`, possède sa nouvelle
géométrie et son squelette. Il peut conserver le matériau privé de l'assemblage.
Ordre de destruction : contrôleur physique, skins de cheveux, puis assemblage.
L'assemblage ne détruit pas la géométrie apportée par un remplaçant externe ; son
propriétaire doit la libérer. `dispose` est idempotent.

## Vérifications effectuées

Les sept tests dédiés vérifient la conservation de chaque sommet sous des
transformations imbriquées, l'indépendance lame/gantelet/main, le pivot d'une
plaque, le repère des mesures, la propriété des ressources, le remplacement d'un
skin et le refus d'un assemblage incomplet. Les tests utilisent des fixtures
synthétiques et ne certifient aucune ressemblance.

Le contrôle local du **vrai GLB pilote** est conservé dans
`/workspace/qa/yautja-expansion-20261023/split-review/assembly-check.json` :
23 meshes, 217 798 triangles, écart maximal de position au repos **0**, données
source inchangées. Un déplacement de test de 0,01 unité sur `part13` laisse le
gantelet et les mains immobiles. C'est une preuve d'indépendance en mémoire,
**pas une course de rétraction validée pour la production**. Le GLB source et le
manifeste publié restent inchangés.
