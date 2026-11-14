# Plan appliqué aux références et aux modèles

Ce guide du **22 octobre 2026** complète le [plan de sélection initial](reference-plan.json), conservé comme historique du 20 octobre. Les tâches, consommations et vérifications courantes sont dans [reference-generation.json](reference-generation.json). Les sources et limites sont détaillées dans [REFERENCES.md](REFERENCES.md).

## Séparer les sources des résultats

| Étape | Contenu réel | Ce qu’elle ne prouve pas |
| --- | --- | --- |
| Photographies source | Statues Prime 1 Studio au 1/3 ; originaux, variantes, dimensions et SHA conservés. | Mesures du costume de tournage ou vues orthographiques absentes. |
| Entrées Hunter | Deux adaptations IA isolant un corps Classic démasqué. | Pixels originaux conservés ou petits détails identiques aux photos. |
| Entrées biomask | Deux contours classiques de photos SCULPT UPDATE ; surfaces oculaires d’origine conservées. | Intérieur, attaches et épaisseur du masque réel. |
| Entrées Big Chap | Détourages classiques sans reconstruction ; canevas d’origine et RGB conservés. | Parties cachées par la queue, les membres ou le socle. |
| Génération 3D PBR | Géométrie reconstruite, UV et cartes inspectées sur le vrai GLB. | Fidélité exacte par la seule présence de textures 4K. |
| Rig Meshy | Squelette humanoïde et clips fournis séparément. | Poids corrects sur une queue ou toute autre anatomie non humaine. |
| Adaptation locale | Orientation, échelle, contrôles, sockets, filtres de masque et corrections de rig. | Nouveau résultat du service ou nouvelle dépense de génération. |

## Parcours effectivement retenus

1. **Hunter démasqué** : deux images adaptées, `multi-image-to-3d`, textures PBR 4K, cible de remesh intégrée de 200 000 faces, puis rigging. Le fichier réel compte 206 591 triangles ; la cible n’est pas un compte exact. Le modèle dense initial reste une sortie non texturée, distincte du modèle joué.
2. **Biomask** : deux détourages photographiques, `multi-image-to-3d`, cible de 50 000 faces, aucun squelette nécessaire pour cette coque rigide. Le GLB réel de 51 284 triangles est attaché à l’os de tête du Hunter. Ses ouvertures oculaires sont couvertes par deux filtres locaux opaques ; le GLB source n’est pas présenté comme ayant fourni ces filtres.
3. **Big Chap V1** : deux détourages, `multi-image-to-3d` avec A-pose. La revue constate un crâne trop vertical ; cette variante est conservée hors jeu, sans paiement de rig pour cette V1.
4. **Big Chap V2** : une entrée préparée, `image-to-3d`, pose source sans A-pose imposée et `image_enhancement:false`, puis rigging. Le résultat de 205 259 triangles et 24 joints est intégré après une réparation locale des influences de queue/mollets/pieds. La réparation et sa validation ne sont pas assimilées à une génération supplémentaire.

Les textures inspectées comportent une couleur et des normales de 4096², ainsi qu’une carte métal/rugosité de 2048². Le réglage de texture **4K** est distinct d’une passe de géométrie **Ultra** : les générations ont utilisé `geometry_resolution:standard`. Les contrôles détaillés de résolution et de rig sont ceux des fichiers reçus, pas une garantie déduite du payload.

## Vérifications avant activation

- Comparer plusieurs vues du GLB aux entrées réellement utilisées ; conserver les défauts observés dans la revue.
- Vérifier les fichiers, SHA, textures intégrées, géométrie et squelette depuis les vrais assets ; un rendu seul ne donne pas ces mesures.
- Pour le joueur, conserver les contrôles de combat, les sockets, le camouflage, les clones coop et le masquage réel de la tête/du biomask en FPS.
- Pour Big Chap, vérifier les phases de marche/course, la queue, les pieds, le bassin et le passage entre modèle proche importé et LOD procéduraux. Un test mécanique sans erreur n’annule pas une déformation visible.
- Activer uniquement les entrées locales vérifiées du manifeste. En cas d’échec de chargement ou de rig, conserver le repli procédural.
- Contrôler l’application et la publication séparément. La réussite de Meshy ou d’un build ne signifie pas qu’un déploiement Vercel est READY.

La correction du Big Chap porte sur **trois groupes, 36 728 sommets** : queue 28 590 vers `Hips`, mollet/pied gauche 4 611 vers `LeftLeg`, droit 3 527 vers `RightLeg`. Les formes de repos sont préservées. Ce choix stabilise les zones déformées mais conserve une queue rigide au bassin et supprime l’articulation indépendante des deux chevilles. Sur 33 phases par clip, marche/course et LOD passent le contrôle avec dérive XZ nulle. Une pénétration résiduelle de queue d’environ 0,178 en course / 0,096 en marche reste admise, pour une hauteur de 3,95 (4,5 % / 2,4 %).

Le [contrôle de l’application](../qa/reference-models/game-integration-check.json), terminé le 22 octobre vers 20 h 41 UTC, et sa [capture](../qa/reference-models/game-models-integration.png) vérifient les trois assets, une vraie vague de horde, les clones, la vue FPS et le redémarrage. Ces vérifications sont distinctes des résultats de la suite complète, publiés dans [QA.md](../../QA.md) et [validation.json](../qa/validation.json), et de la publication Vercel. Les anciens comparatifs procéduraux restent des preuves historiques du 20 octobre. Aucun de ces documents n’atteste une conformité « 1:1 », un playtest humain ou une fréquence d’images sur carte graphique réelle.

## Comptabilité et reprise

La passe par références comporte six tâches terminées, **130 crédits consommés** : 30 pour le Hunter du 20 octobre et 100 pour les opérations du 22 octobre. Les **40 crédits d’essais textuels** restent dans un historique séparé. Les IDs et les ressources de [PLAN.md](PLAN.md) permettent de récupérer les mêmes fichiers sans relancer leur génération.

Le devis initial de 60 crédits pour deux corps ne décrit pas à lui seul les coûts du masque, des rigs et de la variante ultérieure : les autorisations et les consommations de chaque étape sont conservées dans le suivi courant. Une variante supplémentaire ou une opération payante distincte doit suivre son propre accord ; une erreur locale, un timeout ou un téléchargement expiré ne justifie pas une répétition silencieuse de `create`.
