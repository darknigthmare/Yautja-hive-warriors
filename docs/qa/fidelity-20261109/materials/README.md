# Matériaux procéduraux — 9 novembre 2026

Base examinée : `a8f9c759a30bc97c5400ce48709f6ad10856003d`, Three.js 0.160.1/r160 et Node 24.19.0. Périmètre : [SurfaceLibrary.js](../../../../js/graphics/SurfaceLibrary.js), ses tests et ce relevé. Les guides `threejs-materials-lighting`, `create-game-assets` et `performance-optimization` ont été consultés à la révision `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`, puis adaptés à r160. Les [contrats de continuité](../../../development/CANON-REFERENCE-20261108.md) sont conservés : ces surfaces communes n'ajoutent ni insigne, ni camouflage de faction, ni incarnation.

## Changements

- **Bois** : nouveau type `wood`, 512 × 512, pour les planches sciées. Fibres longues selon V, grain fin à faible contraste et relief distinct de `bark`. L'écorce abandonne les 28 grandes crêtes sinusoïdales uniformes au profit de fissures irrégulières ; les pierres utilisent des fractures discontinues plutôt qu'une grande sinusoïde.
- **Métaux et peinture** : brossage, piqûres et marques discontinues ; grain d'armure distinct du métal étiré. Trois finitions facultatives changent les propriétés physiques sans créer de cartes supplémentaires. Les bords usés doivent être placés par le modèle avec une pièce de métal exposé : une texture répétée ne connaît pas les arêtes de la géométrie.
- **Tissu** : trame entrelacée de 128 paires de fils par tuile à 512², variation de teinture et de roughness. L'ancienne trame de 192 cycles était plus proche de la limite d'échantillonnage ; sa roughness restait constante.
- **Peaux et cuir** : pores humains séparés des plis de cuir, relief de cuir irrégulier et pigment cutané sans motif de clan. La chitine utilise une réflexion diélectrique satinée et une roughness variable, avec stries fines irrégulières.
- **Microrelief** : dérivées de hauteur ramenées à une tuile de référence de 512 texels. Les reliefs fins sont calibrés pour survivre à l'encodage RGB8 ; les amplitudes du sol, de la pierre et de l'écorce ne sont pas augmentées par cette normalisation. Les `normalScale` explicites des modèles gardent leur priorité.

Ce sont des matériaux procéduraux de support. Leur génération, leurs dimensions ou les tests ne certifient pas une reproduction photographique 1:1. Les captures comparatives des personnages et de Val Verde sont prises par la QA d'intégration avec les mêmes caméras et lumières.

## API et durée de vie

```js
createSurfaceMaterial('wood', { color: 0xc3b18e, repeat: [1, 1] });
createSurfaceMaterial('armor', { color: 0x596260, finish: 'painted' });
createSurfaceMaterial('metal', { finish: 'bare' });
createSurfaceMaterial('metal', { finish: 'matte' });
```

`finish` est réservé à `armor` et `metal`. `painted` représente une peinture principalement diélectrique ; `matte` un revêtement terne. Pour un métal nu très rugueux, utiliser `finish: 'bare'` puis une roughness explicite. Les finitions appliquent ces **défauts**, toujours surchargeables par les paramètres existants :

| Finition | Metalness | Roughness | Intensité de réflexion |
| --- | ---: | ---: | ---: |
| `painted` | 0,08 | 0,82 | 0,45 |
| `bare` | 0,88 | 0,52 | 0,72 |
| `matte` | 0,12 | 0,91 | 0,35 |

La carte de roughness multiplie la roughness scalaire conformément à `MeshStandardMaterial`. Les textures d'albédo restent sRGB ; normales et roughness restent linéaires. Les cartes utilisent `RepeatWrapping`, mipmaps et filtre `LinearMipmapLinearFilter`. L'anisotropie reste limitée à 8 et aux capacités choisies par le renderer.

L'échelle physique dépend des UV du modèle. Sur un torse de 0,5–0,7 m qui occupe UV 0…1, répéter la tuile de tissu 3 ou 4 fois place les fils près du millimètre ; une répétition unique produit une trame plus grossière. Le bois des nouvelles baraques utilise des UV par mètre avec V longitudinal. Une augmentation de résolution ne corrigerait pas une échelle UV incohérente.

Les matières sont propres à chaque appel. Les cartes sont empruntées au cache pour toute la durée de vie du jeu : détruire une matière ou un acteur ne doit pas détruire ses cartes. Deux répétitions différentes possèdent leurs propres transformations UV, mais partagent maintenant aussi le même objet `THREE.Source`, en plus du tableau RGBA. Les répétitions identiques réutilisent la même vue comme avant. Choisir `repeat` à la création ; modifier directement une vue empruntée affecterait ses autres utilisateurs.

Ce partage suit le cache r160 de [WebGLTextures.js](https://github.com/mrdoob/three.js/blob/r160/src/renderers/webgl/WebGLTextures.js) : texture native par identité de `Source` et paramètres d'échantillonnage. La répétition n'entre pas dans cette clé. Aucun changement de propriétaire ou nettoyage par acteur n'est ajouté.

## Relevé reproductible

Commande :

```sh
node docs/qa/fidelity-20261109/materials/measure-surfaces.mjs output.json
node --test tests/surfaces.test.js
```

Le probe importe les cartes dans Node, sans canvas ni WebGL. Il mesure les octets RGBA uniques, les identités de `THREE.Source`, la génération à froid, les distributions de pixels, les sauts de couture et les normales encodées. Les fichiers [before.json](before.json) et [after.json](after.json) contiennent les empreintes SHA256 de SurfaceLibrary et les détails par type. Le script accepte l'ancienne version sans `wood` ; le relevé avant conserve les 13 types présents à la base.

| Mesure Node | Avant | Après |
| --- | ---: | ---: |
| Types de surface | 13 | 14 |
| Octets RGBA sources | 227 278 848 / 216,75 Mio | 230 424 576 / 219,75 Mio |
| Vues pour 3 répétitions par type | 117 | 126 |
| `THREE.Source` uniques pour ces vues | 117 | 42 |
| Chaînes mip RGBA estimées par source unique de ce probe | ≈ 867 Mio | ≈ 293 Mio |
| Génération totale à froid, un échantillon | 5 589 ms | 5 951 ms |
| Dont nouveau bois scié | — | 84 ms |
| Écart-type rouge, écorce | 30,68 / 255 | 14,48 / 255 |
| Canal roughness du tissu, min…max | 224…224 | 219…244 |

Aucune résolution existante n'augmente. Les trois nouvelles cartes de bois coûtent 3 Mio ; le cache complet reste sous 224 Mio. Les dimensions existantes sont conservées : 2048² pour armor/chitin/skin, 1024² pour soil/stone/metal/bark/humanSkin, 512² pour fabric/leather/bone/leaf et 256² pour net. Les chaînes mip du tableau sont une estimation de données RGBA non compressées, **pas une mesure de VRAM** ; le cas de trois répétitions est synthétique. Aucune mesure de draw calls, FPS ou temps GPU n'est issue de ce probe. Les temps Node uniques, pris dans l'environnement partagé, ne constituent pas une étude de performances matérielles.

Les normales de peau, chitine et métal n'étaient souvent encodées qu'avec des composantes 127/128 presque plates. La normalisation et le calibrage rétablissent le détail sans grossir les images :

| Carte | Inclinaison moyenne encodée avant | Après |
| --- | ---: | ---: |
| Human skin | 0,408° | 2,328° |
| Skin | 0,363° | 2,575° |
| Chitin | 0,613° | 2,816° |
| Armor | 0,395° | 2,523° |
| Metal | 0,512° | 1,464° |

Ces angles précèdent `normalScale`. Les longueurs des vecteurs décodés restent dans la tolérance RGB8. Pour le bois, le contraste adjacent transversal est ≈ 6,5 fois celui du sens longitudinal ; la couture ne dépasse pas les transitions internes. Les tests couvrent le partage des sources, l'indépendance des répétitions, les cartes empruntées après destruction d'une matière, les espaces de couleur, les finitions/surcharges, le budget mémoire, le grain scié et la survie du relief fin à RGB8. Résultat ciblé : **7 tests réussis**, journal [node-surfaces.tap](node-surfaces.tap).

## Limite du diagnostic des zébrures

Plusieurs anciennes baraques de `ReferenceEnvironmentMechanisms.js` utilisaient du bois `MeshStandardMaterial` sans carte. Le contrôle des textures ne peut donc pas attribuer toutes les anciennes bandes claires au grain d'écorce : les ombres ou la géométrie doivent être examinées séparément. Ce travail ne modifie ni les lumières, ni les shadow bias, ni les matériaux de continuité propres aux personnages.
