# City Hunter : extrémités libres de la chevelure

Cette amélioration ajoute dix **extrémités de mèches**, avec un mouvement local
réel, aux deux petites surfaces déjà articulées. Elle ne transforme pas la
nappe soudée en dix mèches complètes. Les gros faisceaux latéraux restent
fusionnés et leur géométrie reste identique. Aucune nouvelle génération Meshy,
texture, triangulation ou dépense n'est nécessaire.

## Source et sélection

- Source : `public/models/city-hunter-body-corrected.glb`.
- SHA256 : `0e297a50400f885f06595f2fb59c85aed5118517a03c140f0f3aefa5288b564b`.
- Surface : `model_part17`, 91 075 sommets, 84 720 triangles ; 42 484 positions
  après rapprochement à 1e-6 pour la seule analyse topologique.
- Dix composantes distales réellement distinctes sous leurs hauteurs d'attache
  mesurées. La sélection suit les arêtes des triangles, sans secteurs angulaires.
- 3 190 sommets sélectionnés, soit 3,50 % du bouquet ; 887 sommets de colliers
  gardent exactement leurs attributs de peau ; 2 303 sommets, soit 2,53 %, reçoivent
  les nouvelles influences. Aucun sommet de visage, nuque ou armure n'est inclus.

Les positions identiques aux coutures UV reçoivent les mêmes données. Les
sommets sur une arête menant à la surface non sélectionnée sont immobiles.
Chaque courbe possède quatre articulations tirées des centres de sections
mesurées. Les 22 premiers pour cent de hauteur libre restent fixes, puis une
transition `smoothstep` de 24 % apporte progressivement les influences locales.
La tête conserve son animation habituelle ; aucun mouvement de tête n'est ajouté
pour simuler une chevelure indépendante.

## Préparation et animation

`prepareImportedManeTemplate(gltf, calibration, { sourceSha256 })` renvoie
`{ template, articulation, diagnostics }`. Une calibration absente est un simple
passage. Le SHA source, les empreintes exactes des quatre attributs concernés,
les IDs, les tables, les colliers et les limites de mouvement sont contrôlés
avant toute préparation.

Le template est mis en cache par glTF source et calibration. Seule la géométrie
de la surface concernée est clonée et ses influences de peau sont modifiées.
Les nouveaux inverse binds reproduisent exactement la matrice de peau Head
d'origine, même avec les unités d'articulation du fournisseur. Positions,
triangles, normales, UV, tangentes, matériaux, textures et anciennes articulations
restent intacts. Les tables compactes contiennent des IDs de sommets explicites,
un paramètre de courbe 16 bits et un coefficient de transition 8 bits.

L'intégration ajoute le tableau `articulation.dreadlocks` renvoyé au descripteur
du personnage avant `createImportedCharacter`. Les clones d'acteurs disposent
de leurs propres os et textures de squelette. `YautjaArticulation` apporte le
pas fixe, la pause, les LOD, la visibilité de tête en FPS, les réinitialisations
et la libération des ressources. La préparation ne touche aucun matériau ni
état de camouflage, hologramme ou autre effet de rôle.

Le supplément est borné : dix chaînes, quarante os, trente segments simulés,
angle maximal de 0,24 radian. Les deux chaînes historiques demeurent : douze
chaînes et trente-huit segments au total pour City Hunter.

## Validation CPU du 25 octobre 2026

`NODE_OPTIONS=--max-old-space-size=2048 node --test --test-concurrency=1 tests/imported-mane-rig.test.js`

Six tests couvrent tous les sommets au repos, les zones non sélectionnées et
les colliers en mouvement, les dix surfaces distales, les autres articulations,
les cadences 30/60/120 Hz, la pause, le FPS, les LOD, les acteurs indépendants,
les ressources, le pipeline de préparation des pièces, la tête en mouvement,
les transformations d'acteur, les téléportations et les refus de calibrations
incompatibles. L'erreur maximale de
position au repos mesurée sur la surface complète est de **9,24e-8 unité source**.

Pour la hauteur du personnage de 4,31 unités de jeu, les courbes rendues mesurent
0,162 à 0,443 unité, soit **3,76 à 10,28 %** de cette hauteur. Ces valeurs décrivent
l'échelle du jeu ; elles ne certifient aucune dimension physique ou fidélité 1:1.
Sous le vent constant du test, les déplacements maximaux des dix régions vont
de 0,007 à 0,027 unité de jeu. Les colliers et toute la surface non sélectionnée
restent identiques à la version de référence.

Un microbenchmark Node de l'adaptateur seul, 600 échantillons après échauffement,
mesure une médiane de 0,100 ms pour les deux chaînes historiques, 0,180 ms avec
les dix nouvelles et 0,103 ms en LOD 2 avec tête masquée. Il ne constitue pas une
mesure de FPS du rendu.

Neuf vues comparatives ont ensuite été capturées avec le vrai Player, le
GLTFLoader, le masque et les matériaux du jeu : trois caméras avant, au repos
préparé et sous mouvement. La silhouette au repos reste conservée ; seules les
extrémités libres bougent, sans nouvelle rupture constatée aux colliers. Le
masquage FPS et le grounding restent fonctionnels, sans erreur de modèle ni
requête manquante. Le rapport dev brut finit cependant en échec sur son assertion
console : quatre messages HMR proviennent du blocage volontaire du WebSocket
Vite pour empêcher les rechargements pendant les éditions parallèles. Ces quatre
messages restent consignés ; ils ne remplacent pas le contrôle du build final
figé, qui doit s'exécuter sans cette infrastructure de développement.

Le générateur CPU est reproductible :
`NODE_OPTIONS=--max-old-space-size=2048 node scripts/calibrate-city-mane.mjs --write`.
Il refuse une autre source et vérifie les composantes libres et leurs frontières
fixes avant d'écrire la calibration. Les contrôles effectués sont automatisés ;
aucun testeur humain ni certification 1:1 n'est revendiqué.
