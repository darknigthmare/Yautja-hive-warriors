# Références et transformations des personnages

État documentaire du **22 octobre 2026**. Les sources visuelles sont des photographies promotionnelles officielles de statues **Prime 1 Studio à l’échelle 1/3**, pas des scans ni des relevés des costumes de tournage. Une ressemblance géométrique exacte « 1:1 » n’est pas validée.

La sélection initiale du 20 octobre contient onze originaux, examinés et conservés sans modification dans le pack de références livré séparément. Son manifeste `sources.json` conserve sources, dimensions et SHA-256. Le [plan structuré initial](reference-plan.json) reste un historique de cette sélection ; ses états « à préparer » ne décrivent pas l’avancement actuel. Le [plan appliqué](reference-plan.md) et le [suivi des tâches](reference-generation.json) distinguent depuis les originaux, les entrées préparées et les fichiers 3D.

## Jungle Hunter de 1987, corps démasqué

Source : [Prime 1 Studio MMPR-01DXS — Jungle Hunter Predator Deluxe Bonus Version](https://www.prime1studio.com/pr-jungle-hunter-predator/MMPR-01DXS.html).

Les cinq photos du corps démasqué sont trois vues du corps (`a0026`, `b0024`, `b0022`) et deux détails du visage (`b0010`, `b0030`). Le portrait Classic est privilégié. Les variantes Roaring, Sculpt Update et mains alternatives ne sont pas fusionnées dans cette sélection du corps. Le feuillage masque une partie de l’arrière ; il n’existe pas de série orthographique complète face/profil/dos dans les vues retenues.

Les deux entrées effectivement envoyées à Meshy sont des **adaptations produites par IA pour isoler le Hunter**. Elles ont été examinées, mais leurs pixels et petits détails sont reconstruits : ce ne sont pas des détourages photographiques sans perte. Les photos originales restent intactes. Le modèle généré peut donc cumuler les approximations de ces adaptations et celles de la reconstruction 3D.

Le corps a été généré le 20 octobre, puis articulé le 22. Son GLB texturé compte **206 591 triangles**. Les cartes inspectées sont de **4096² pour la couleur et les normales**, et de **2048² pour métal/rugosité**. Le rig et les clips fournis sont des résultats distincts de la génération de géométrie. L’adaptation au jeu conserve ses propres contrôles de déplacement et de combat : la présence des clips ne signifie pas qu’ils pilotent tous les mouvements du joueur.

## Biomask séparé : sources et assemblage local

La photo `b0060` du pack initial servait de repère ; elle n’est pas une vue d’un masque isolé. Les deux entrées finales viennent de deux autres photographies de la même galerie : `a0004-00-15-01` (presque de face) et `b0007-15` (trois-quarts latéral), identifiées **SCULPT UPDATE**. Ce choix complémentaire est distinct du portrait Classic utilisé pour le corps ; il ne prouve pas une correspondance métrique entre ces variantes.

Ces entrées ont reçu une **préparation classique du contour extérieur**. Les surfaces oculaires visibles, leurs RGB, leurs grilles et leurs reflets ont été conservés opaques ; les yeux n’ont pas été évidés dans les images ni remplacés par une peinture noire. Les sources photographiques restent inchangées. Le profil est perspectif, pas orthographique ; intérieur, attaches arrière et épaisseur réelle de l’accessoire ne sont pas établis.

Le résultat Meshy est une **coque PBR de 51 284 triangles**. Malgré les surfaces oculaires présentes dans les entrées, cette coque contient de véritables ouvertures au niveau des yeux. Le projet ajoute donc **deux filtres opaques locaux**, avec leur grille et leurs retours de bord ajustés à la géométrie mesurée. Ces 326 triangles supplémentaires viennent du code du projet, pas d’une nouvelle génération Meshy. La coque source conserve son SHA ; le runtime compose coque et filtres sur l’os de tête.

Un export assemblé peut réunir les deux dans un GLB dérivé de **51 610 triangles**. Il doit être désigné comme **« coque Meshy + filtres locaux »**, jamais comme un nouveau résultat Meshy. Les contrôles de couverture et les vues face/profil valident les angles examinés, pas tous les angles possibles ni une fidélité canonique exacte. La profondeur et les formes de la coque générée restent des approximations.

## Big Chap d’Alien (1979)

Source : [Prime 1 Studio MMXLAL-04S — Big Chap Xenomorph Regular Ver. Bonus Version](https://www.prime1studio.com/al1-big-chap-xenomorph-regular-ver/MMXLAL-04S.html).

Les cinq photos sélectionnées sont les corps en trois-quarts avant/arrière (`a015`, `a016`), les détails du crâne (`a018`, `a020`) et le profil partiel `a014`, dont le mur cache le bas du corps. La tête retenue est **Wide Shot / Giger** ; la variante Close-Up / Rambaldi reste distincte. Les jambes et pieds doivent suivre l’anatomie visible, sans imposer celle du Runner ou l’hypothèse digitigrade de l’ancien prompt textuel.

Après le refus des retouches par le service d’images, l’utilisateur a autorisé la préparation classique. Les deux détourages conservent le canevas **1060 × 1500**, sans redimensionnement ni reconstruction des parties cachées. Dans les PNG transparents, les RGB sont ceux du JPEG original décodé ; seul l’alpha change. Les entrées sur fond gris compositent ce fond aux bords. Les jambes, chevilles et pointes de pieds visibles ont été revues ; les occultations par un membre, la queue ou le socle ne deviennent pas des informations connues.

La première génération multi-image, forcée en A-pose, a produit un crâne trop vertical et une bouche peu lisible. Elle est conservée comme essai **écarté de l’activation** ; aucun rig n’est annoncé pour cette V1.

La variante autorisée suivante, **`big_chap_preserved_pose`**, utilise une seule entrée photographique préparée, sans A-pose imposée et avec `image_enhancement:false`. Elle retrouve un crâne plus horizontal ; ce réglage réduit une transformation demandée au service, sans garantir la conservation exacte des formes de la photo. Son GLB texturé compte **205 259 triangles** ; couleur/normales 4096² et métal/rugosité 2048². Le rig reçu contient **24 joints** et des clips de marche/course.

Le rig humanoïde ne possède pas d’os de queue : ses influences d’origine entraînaient des portions de queue avec les jambes. La réparation **locale**, distincte du résultat Meshy, réattribue 36 728 sommets : queue 28 590 vers `Hips`, mollet/pied gauche 4 611 vers `LeftLeg`, droit 3 527 vers `RightLeg`. Les formes de repos sont conservées ; la queue suit le bassin et les deux chevilles ne sont plus articulées séparément. Sur 33 phases par clip, les longues bandes ont disparu et la dérive XZ est nulle. Une pénétration résiduelle de queue persiste : environ 0,178 en course / 0,096 en marche pour une hauteur de 3,95, soit 4,5 % / 2,4 %.

La V2 réparée est intégrée au guerrier proche. Le [contrôle de l’application](../qa/reference-models/game-integration-check.json) et sa [capture](../qa/reference-models/game-models-integration.png) attestent les trois assets, les clones, les LOD et le redémarrage. Les poids réparés et leurs limites ne doivent pas être attribués au service Meshy brut. Les résultats de la suite complète et la publication restent documentés séparément ; une réussite de tâche ou la présence d’un squelette ne suffit pas à valider toute l’animation.

## Coûts et portée des preuves

Les six tâches de la passe par références rapportent **130 crédits réels** : 30 pour le corps Hunter du 20 octobre, puis **100 le 22 octobre** pour son rig, la coque du masque, Big Chap V1, Big Chap V2 et le rig de V2. Les deux essais textuels antérieurs représentent **40 crédits distincts**, soit **170 crédits documentés** sur ces deux historiques. Le solde final relu est **2 110 crédits** ; c’est une mesure du compte, pas une déduction à partir de ces seuls travaux. Les IDs et ressources sont dans [PLAN.md](PLAN.md). Les grilles du masque, la calibration et la correction locale du rig n’ajoutent aucune tâche Meshy payante.

Les photographies de statues, les adaptations IA, les détourages, la génération PBR, le rigging et les corrections locales constituent des étapes différentes. Le nombre de polygones et la résolution des cartes n’établissent ni une topologie de studio, ni un rendu photoréaliste, ni une correspondance exacte au film. Les images et sculptures gardent leur attribution fabricant ; leur consultation et leur transformation ne constituent pas une licence générale de réutilisation.
