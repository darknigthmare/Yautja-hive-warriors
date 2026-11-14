# Big Chap — queue articulée et appuis mesurés

Le Big Chap importé possède désormais une chaîne de queue de **9 os**, avec des poids continus sur **28 590 sommets**. La queue suit le mouvement du bassin tout en bougeant indépendamment. Une contrainte de sol corrige ses articulations sans allonger les segments ni déplacer la racine de gameplay.

La correction de pieds utilise séparément les régions rigides déjà calibrées des deux mollets/pieds. Elle ajuste uniquement la hauteur du modèle visuel près du sol. Elle ne crée pas d'articulations de cheville et ne constitue pas un système d'IK.

## Source et conservation

- GLB source : `public/models/big-chap-rigged.glb`, SHA-256 `202b5d7d635cdb14fcf8af430faba3207d5668f43f85d9d9dca1f81cc0d8a97e`.
- Source : 211 185 sommets, 205 259 triangles, 24 os initiaux ; instance proche : 33 os.
- Positions, normales, UV, tangentes, indices, textures et fichiers GLB restent inchangés. Les poids du corps hors queue restent identiques à la correction de skin précédente.
- La courbe provient de la région de queue explicitement vérifiée et d'une distance géodésique sur ses triangles. Les 6 premiers pour cent du collier restent ancrés. Les paramètres 16 bits produisent un mélange continu entre deux os voisins.
- Les matrices de repos des nouveaux os reproduisent exactement la matrice de skin du bassin, y compris les échelles inhabituelles des inverse binds du fournisseur. Erreur mondiale maximale mesurée sur tous les sommets au repos : **3,92 × 10⁻⁸** unité.

## Mouvement et appuis

La queue reçoit une petite oscillation analytique, moins active à l'arrêt. Son état dépend de la phase de simulation ; aucune énergie ne s'accumule entre les images. Le solveur utilise 257 enveloppes conservatrices incluant l'incertitude du mélange des poids, au maximum 9 itérations et 0,35 radian de correction par articulation. Le collier conserve son attache.

Pour les pieds, **515 sommets de supports convexes** représentent exactement les minima des **8 138 sommets** des deux régions rigides sous leurs transformations articulaires. La correction verticale est limitée à ±0,18 unité ; l'appui visé est à +0,005 unité. L'attraction s'atténue entre 0,06 et 0,16 unité et s'annule quand les deux pieds sont réellement en l'air. L'orientation d'escalade désactive cette correction de hauteur. Le modèle immobile conserve une hauteur constante.

Les données de surface préparées sont mises en cache et partagées. Chaque acteur possède ses propres os et diagnostics ; l'animation d'un pair coopératif ne modifie pas l'autre. Le LOD procédural moyen/éloigné reste utilisé. La destruction libère une seule fois la texture d'os privée et conserve les ressources de surface partagées.

## Vérification reproductible

```sh
node --test tests/imported-tail-rig.test.js tests/imported-creature-grounding.test.js tests/imported-creature.test.js
```

Les **23 tests** couvrent le vrai GLB, les véritables clips de marche/course, 33 phases par clip, tous les sommets de queue et de pieds, les sommets corporels témoins, le repos complet, les empreintes source, les fréquences 12/120, pause, LOD, réinitialisation, transformations parentes, coopération et nettoyage. Les calibrations non correspondantes ou non bornées sont rejetées.

| Mesure sur 33 phases réelles, en unités du jeu | Marche | Course |
| --- | ---: | ---: |
| Minimum queue auparavant rigide | −0,09586 | −0,17812 |
| Minimum queue articulée seule | +0,01944 | +0,02227 |
| Minimum queue avec appuis des pieds | +0,02074 | +0,02212 |
| Minimum pieds avec correction | +0,00500 | +0,00500 |
| Correction visuelle verticale absolue maximale | 0,09520 | 0,11117 |
| Phases atteignant une limite de solveur | 0 | 0 |

La QA indépendante a chargé deux véritables acteurs dans l'application et comparé l'ancienne queue rigide avec la queue articulée à la même pose/caméra. Au pire échantillon de course : −0,17812 avant, +0,02738 après, avec une pose corporelle inchangée. L'inspection des images n'a montré ni rupture ni étirement apparent. Il s'agit de vérifications automatisées et de revues d'images, sans testeurs humains revendiqués.

Les résultats CPU détaillés et le journal des tests se trouvent dans [les preuves d'articulation](qa/big-chap-articulation/). Les mesures CPU utilisent une hauteur normalisée de 3,9536638259887695 unités ; les chiffres du runtime peuvent différer selon la présentation et la normalisation de l'acteur.

## Contrat d'intégration et limites

`creatureRig.tailRig = BIG_CHAP_TAIL_RIG` active la chaîne ; `creatureRig.footGrounding = BIG_CHAP_FOOT_GROUNDING` active les appuis. Les propriétés optionnelles absentes conservent l'adaptateur antérieur. `adapter.tailRig` expose `bones`, `mesh`, `diagnostics`, `update` et `reset` ; `adapter.footGrounding` expose `diagnostics`, `update` et `reset`. Les diagnostics permettent de détecter les limites de solveur et les corrections de hauteur. `reset()` restaure la transformation de repos, sans recalculer les diagnostics du dernier mouvement.

La contrainte porte sur le plan mondial **Y = 0**. Elle ne traite pas les marches, les obstacles, les collisions queue/corps ou queue/jambes. Les pieds restent solidaires de leurs mollets ; leur contact ne répare pas la forme de la démarche source. Une pénétration plus grande que les limites expose un diagnostic `limited`/`groundLimited` et demande une calibration distincte. L'ensemble conserve la géométrie générée existante et ne prouve aucune fidélité anatomique ou cinématographique « 1:1 ».
