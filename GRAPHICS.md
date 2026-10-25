# Modèles importés, sculptures procédurales et surfaces

La [passe d'insertion du 23 octobre](docs/INSERTION.md) ajoute une capsule creuse avec portes articulées et sortie du personnage, puis reprend les détails, l'orientation et la propulsion des véhicules de soutien. Son [rapport dédié](docs/qa/insertion-validation.json) distingue les contrôles de la géométrie, de la séquence et du rendu. Ces améliorations locales ne certifient pas une copie exacte des accessoires de film.

La reprise du 24 octobre poursuit les mécanismes et leur intégration : [locomotion mesurée après collisions](docs/LOCOMOTION.md), [M577 APC anguleux et tourelle sur rail](docs/APC.md), console de relais détaillée et contre-attaque progressive. Les comptes historiques de triangles ci-dessous restent ceux des passes indiquées ; augmenter ce compte ne mesure pas, à lui seul, la ressemblance.

La passe guidée par références ajoute de vrais GLB Meshy aux sculptures procédurales du jeu. Le Hunter démasqué riggé, son biomask séparé et Big Chap V2 sont intégrés dans la version locale. La réparation locale de poids du Big Chap est distincte du résultat de rigging Meshy. Le [contrôle de l’application](docs/qa/reference-models/game-integration-check.json) et sa [capture](docs/qa/reference-models/game-models-integration.png) attestent leur chargement et leur fonctionnement dans le jeu. Les états et consommations sont consignés dans [le suivi des générations](docs/meshy/reference-generation.json), distinct des [essais textuels historiques](docs/meshy/generation-plan.json).

Les références sont des photographies de statues Prime 1 Studio au 1/3. Les entrées du Hunter ont été adaptées par IA ; celles du masque et du Big Chap ont reçu une préparation classique. Ces opérations et leurs limites sont distinguées dans [REFERENCES.md](docs/meshy/REFERENCES.md) et [le plan appliqué](docs/meshy/reference-plan.md). Les modèles sont des reconstructions interprétées ; davantage de triangles et des cartes 4K ne démontrent pas une ressemblance exacte « 1:1 ».

## GLB de la passe par références

| Asset reçu | Triangles mesurés | Surfaces et articulation |
| --- | ---: | --- |
| Hunter démasqué | 206 591 | Couleur/normales 4096², métal/rugosité 2048² ; squelette et clips Meshy, adaptés aux contrôles du joueur. |
| Coque du biomask | 51 284 | GLB PBR rigide séparé, attaché à l’os de tête. |
| Filtres oculaires locaux | 326 | Deux surfaces opaques ajustées à la coque, avec petite grille partagée de 128². |
| Big Chap V2 | 205 259 | Couleur/normales 4096², métal/rugosité 2048² ; rig humanoïde de 24 joints et clips marche/course. |

Les dimensions sont celles des images réellement inspectées, pas une résolution identique pour toutes les cartes PBR. Le paramètre de texture 4K est distinct d’une passe de géométrie Ultra ; les générations ont utilisé la géométrie standard. Les UV et textures sont livrés dans les fichiers locaux, sans dépendance à une URL Meshy signée au runtime.

Le corps Hunter reste démasqué dans son asset source. Le projet compose son biomask séparé, puis clone le squelette et les matériaux nécessaires à chaque joueur. La tête skinnée, la coque et les filtres sont masqués ensemble en FPS ; les sockets des armes et les états de camouflage conservent leurs contrôles. Une scène de calibration avec les accessoires présents mesure 260 709 triangles ; ce total dépend de l’équipement et ne remplace pas les comptes des fichiers sources.

La **coque Meshy ne contient pas les grilles locales**. Ses ports oculaires sont ouverts malgré les surfaces d’yeux conservées dans les références. Deux filtres et de courts retours de bord ont été ajustés à la géométrie réelle pour occulter les ouvertures sur les vues examinées. La coque source conserve son SHA ; le runtime ajoute ces éléments sur son clone. Le GLB assemblé de 51 610 triangles est un export dérivé « coque Meshy + filtres locaux », pas une nouvelle génération du service. Les mesures face/profil ne constituent pas une preuve de couverture sur tous les angles.

Le Hunter animé conserve certaines limites : visage et petits détails simplifiés, doigts sans articulation individuelle, une large lame intégrée dans la géométrie source et armes alternatives procédurales. Sa marche de jeu utilise les contrôles existants appliqués au rig ; la livraison de clips Meshy n’équivaut pas à leur emploi pour chaque action ni à un IK des pieds.

Le Big Chap V1 guidé par deux vues a été écarté, avec un crâne trop vertical. V2 utilise une seule image préparée sans A-pose imposée et avec `image_enhancement:false`. Son crâne est plus horizontal, mais mâchoire et pieds restent simplifiés. Le rig reçu n’a pas d’os de queue ; ses poids et pivots de chevilles produisaient des bandes de géométrie avec les jambes. La première correction locale conserve les formes de repos et réattribue **36 728 sommets** : **28 590** de queue sur `Hips`, **4 611** de mollet/pied gauche sur `LeftLeg`, **3 527** de mollet/pied droit sur `RightLeg`. Les deux chevilles ne sont plus articulées individuellement.

La reprise du 24 octobre ajoute à cette région de queue une véritable chaîne de **neuf os pondérés**, propre à chaque acteur. Les géométries, UV et textures sources restent inchangés. Une enveloppe de contact conservatrice ajuste la courbure au sol ; elle n'évalue pas les 28 590 sommets à chaque image. Les **66 phases** de marche/course contrôlées passent. Le build final ajoute une compensation visuelle bornée des pieds, calculée sur 515 supports convexes des 8 138 sommets de mollets/pieds. Avec ces appuis et à la même phase de course, la comparaison dans l'application fait passer le minimum de queue de **−0,1599** à **+0,0221 unité**, sans changer le corps entre les deux vues. À l'arrêt, le corps revient à sa pose source et la queue conserve son mouvement indépendant. Les détails et les limites sont consignés dans [la fiche d'articulation](docs/BIG-CHAP-TAIL.md) et les [captures finales](docs/qa/open-work/README.md) ; ce contact ne constitue pas une IK des chevilles.

## Historique procédural : géométrie et anatomie

La seconde passe procédurale du 20 octobre reprenait corps trapus, muscles en sphères séparées, membres cylindriques, armures en boîtes et reflets uniformes. Torse, nuque et membres utilisent des profils continus avec des volumes anatomiques sculptés. Les chiffres et captures historiques ci-dessous décrivent cette construction et ses modèles de repli ; ils ne mesurent pas les nouveaux GLB importés.

Les chiffres comptent les triangles des modèles proches, accessoires masqués inclus. Ils comparent cette passe à la version graphique précédente, et non aux tout premiers modèles du dépôt.

| Modèle | Version précédente | Passe procédurale proche du 20 octobre |
| --- | ---: | ---: |
| Chasseur Jungle | 32 812 | 160 448 |
| Guerrier xénomorphe | 6 960 | 42 512 |
| Reine | 23 428 | 93 544 |
| Offspring | 14 480 | 61 632 |
| Marine | 4 232 | 41 004 |
| Garde du clan | 4 436 | 42 680 |
| APC | 5 932 | 32 264 |

Le chasseur mesure 4,31 unités, avec un crâne de 0,599 unité : environ **7,2 têtes de haut**, contre environ cinq auparavant. Les volumes de peau sont continus, les épaulières et gantelets suivent le corps, les doigts et pieds sont anatomiques et le masque a des arcades, des joues, des fentes et un museau sculptés. Le filet est projeté sur la surface réelle du torse pour éviter de traverser les pectoraux. Les coutures, bords de plaques, rivets, harnais, dreadlocks et armes restent attachés aux articulations. Le modèle Jungle utilise 47 meshes ; les variantes les plus détaillées restent sous 170 000 triangles.

Les créatures possèdent des crânes allongés et étroits, une taille marquée, des jambes digitigrades, des mains, une queue effilée et des côtes calculées sur la surface du thorax. La reine possède une crête épaisse, arquée et striée reliée à l'occiput. Les profils couvrent les variantes de guerriers, Predalien, Offspring, facehuggers, œufs et autres créatures.

Les humains et gardes de soutien utilisent des corps sculptés aux proportions adultes, des paupières, lèvres, nez, oreilles et mains distincts. Les vêtements et armures ont des enveloppes séparées. Les véhicules ont des coques profilées, des pneus sculptés, des verrières et des éléments mécaniques ajustés ; portes, tourelles et autres pivots conservent leur fonctionnement.

## Surfaces procédurales et éclairage

Treize familles de surfaces sont produites localement et partagent leurs cartes de couleur, normales et rugosité :

- **2048 × 2048** : peau du chasseur, chitine et armure.
- **1024 × 1024** : peau humaine, sol, pierre, métal et écorce.
- **512 × 512** : tissu, cuir, os et feuilles ; filet détouré en 256 × 256.

La peau humaine utilise des pores et des variations de couleur discrètes, séparés de la pigmentation du chasseur. Les rayures, stries et différences de rugosité sont propres à chaque famille. La rugosité de la texture module celle du matériau ; elle a été recalibrée pour éviter que les surfaces deviennent involontairement chromées. La peau, le métal et la chitine utilisent aussi des intensités de réflexion et de normales distinctes. Le tissage des vêtements est plus fin et moins contrasté.

Ces cartes procédurales utilisent mipmaps et anisotropie, sans téléchargement externe. Leur cache de données sources est borné à **224 Mio**. Cette limite ne couvre pas les atlas des GLB importés ni toute la mémoire GPU : copies selon les répétitions UV, mipmaps, buffers de géométrie, squelettes, ombres et effets s’y ajoutent. La génération procédurale et le chargement des assets augmentent aussi le coût initial.

Le remplissage hémisphérique et le contre-jour ont été réduits, avec des couleurs plus neutres pour mieux séparer les plans du corps. Le retour visuel de corrosion reste visible, avec une vignette moins saturée.

## Décors

Les arbres comportent fûts courbes, racines, branches et petites feuilles courbes orientées sur plusieurs plans. Les fougères ont rachis et folioles ; les rochers utilisent une surface sculptée indexée à normales continues. Les frontières forestières sont des talus et blocs naturels. Les sentiers ont des bords érodés et une transition de couleur vers le terrain. Le pad métallique ajoute joints et boulons.

Les autres biomes ont aussi reçu des surfaces et détails adaptés : colonnes organiques, obélisques érodés, capsules arrondies et équipement industriel. La forêt représente environ 435 488 triangles de décor pour 74 soumissions de mesh potentielles. Les instances et regroupements évitent une soumission par feuille. Les collisions, points d'insertion et voies de circulation restent préservés ; le sol et les chemins conservent une tuile de texture par cinq unités.

## Distance, qualités de rendu et mode photo

Les créatures procédurales adaptent leur géométrie à la caméra la plus proche, y compris en coop :

| Modèle | Proche, moins de 18 unités | Moyen, jusqu'à 38 | Éloigné |
| --- | ---: | ---: | ---: |
| Guerrier | 42 512 | 12 742 | 4 832 |
| Reine | 93 544 | 29 068 | 9 732 |

Les trois géométries gardent les mêmes parties et pivots. Les buffers sont partagés entre acteurs et conservés entre les vagues. Un contrôle sur 200 guerriers éloignés vérifie un total inférieur à un million de triangles, contre plus de huit millions si tous utilisaient leur géométrie proche.

L’import Big Chap remplace le visuel proche du guerrier. Les niveaux moyen et lointain utilisent les géométries procédurales ; les autres types de créatures conservent leurs modèles propres. Le passage entre import et repli change la silhouette, sans fondu automatique. Les textures et géométries mises en cache sont partagées ; chaque acteur animé garde son propre squelette. Le contrôle d’une vraie vague vérifie ce partage, les LOD et le redémarrage ; ces économies ne prouvent pas le débit d’une horde sur matériel réel.

Les réglages **Fluide**, **Équilibrée** et **Élevée** conservent les textures détaillées. Ils adaptent les ombres et les effets : rendu direct, puis bloom discret et FXAA, puis SSAO. Les ombres sont limitées à 512 sur le rendu logiciel ; la coop utilise deux vues indépendantes en rendu direct. Aucune fréquence d'images sur matériel réel n'est garantie par ces budgets.

Le mode photo permet de tourner autour du modèle par glissement, de zoomer à la molette et de déplacer le cadrage au bouton droit. La caméra de jeu est restaurée à la sortie. Une scène en pause ou en photo conserve son image sans relancer continuellement le GPU ; une interaction, un redimensionnement ou un changement de qualité demande une nouvelle image. L'export PNG encode le rendu final de façon asynchrone.

## Captures et validation

| Comparaison contrôlée | Version précédente | Nouvelle version |
| --- | --- | --- |
| Chasseur dans la carte | [Avant](docs/qa/sculpt-before-hunter.png) | [Après](docs/qa/after-hunter.png) |
| Environnement | [Avant](docs/qa/sculpt-before-environment.png) | [Après](docs/qa/after-environment.png) |
| Créatures dans la carte | [Avant](docs/qa/sculpt-before-creatures.png) | [Après](docs/qa/after-creatures.png) |

Les vues de carte utilisent des caméras identiques, la simulation en pause et les acteurs de présentation disposés explicitement. Elles comparent les graphismes et ne constituent pas un combat ou un playtest humain.

Les gros plans utilisent une scène de contrôle avec les modèles, textures et lumières du jeu, sur un sol et un fond neutres : [chasseur de face](docs/qa/sculpt-hunter-front.png), [de profil](docs/qa/sculpt-hunter-profile.png), [masque et armure](docs/qa/sculpt-hunter-head.png), [guerrier](docs/qa/sculpt-warrior-front.png), [profil du guerrier](docs/qa/sculpt-warrior-profile.png), [reine](docs/qa/sculpt-queen.png), [Marine](docs/qa/sculpt-marine.png) et [visage du Marine](docs/qa/sculpt-marine-face.png). La [capture de mission](docs/qa/mission.png) conserve au contraire les acteurs et le HUD d'une vraie partie lancée dans l'interface.

`npm test` compile la production et vérifie géométrie, normales, UV, anatomie, cache, LOD, articulations, libération des ressources, rendu et parcours de jeu. Les résultats finaux et empreintes du build sont consignés dans [validation.json](docs/qa/validation.json).

Les comparatifs de cette section restent ceux de la passe procédurale du 20 octobre. Les revues des GLB et de leur calibration constituent des preuves séparées dans le suivi de références ; seules les vérifications finales de l’application attestent leur activation. Les sculptures procédurales, les reconstructions Meshy et les corrections locales ne démontrent ni une qualité de production photoréaliste, ni une topologie de studio, ni une fidélité exacte « 1:1 ». Les contrôles dans Chromium logiciel ne remplacent pas un playtest humain ou des mesures sur carte graphique réelle.
