# Contrôle d’une référence avant génération

Le [plan d’extension Yautja](yautja-expansion-plan.json) est une préparation de références. Ses six personnages ne désignent pas six références validées ni six modèles prêts. Le contrôle décrit ici ne crée aucune tâche Meshy et n’autorise aucune dépense : une référence éligible doit encore appartenir au périmètre et au budget acceptés.

Le script [audit-reference-cutout.py](../../scripts/audit-reference-cutout.py) combine des contrôles de pixels avec **trois revues visuelles IA distinctes**. Pillow et numpy servent uniquement à cet outillage de préparation des assets ; ils ne sont pas des dépendances du jeu, de Vite ou de son rendu navigateur.

## Fichiers figés et contrôles de pixels

Chaque manifeste désigne trois fichiers : l’original sélectionné (`source`), son détourage RGBA (`cutout`) et l’image RGB sur fond déclaré destinée à la génération (`composite`). Les chemins relatifs sont résolus depuis le répertoire où la commande est exécutée, pas depuis celui du manifeste.

- Les trois canevas doivent avoir exactement les mêmes dimensions. Aucun redimensionnement ni nouveau recadrage du sujet n’est accepté dans ce parcours. Un original avec orientation EXIF non normalisée nécessite une normalisation sans perte, documentée séparément avant sa sélection et son gel.
- Le détourage doit avoir un canal alpha explicite. Pour **chaque pixel où alpha > 0**, ses RGB doivent être exactement ceux de l’original décodé en RGB. Cette vérification concerne les pixels du sujet, pas l’identité binaire JPEG/PNG ni les RGB cachés sous alpha zéro.
- L’alpha doit conserver du sujet et retirer du fond. Aucun pixel du sujet ne doit toucher le bord du canevas : ce cas demande une reprise ou une revue du risque de coupe.
- Le composite doit correspondre aux RGB source, au même alpha et au `background_rgb` déclaré, avec un écart maximal de **1 par canal** dû à l’arrondi. Le fond par défaut est `[128, 128, 128]`.
- Les SHA-256 des **trois fichiers** sont figés avant les revues. Une modification ultérieure des pixels, de l’alpha, du fond ou des octets du fichier invalide leur liaison aux anciennes revues.

Une silhouette peut perdre un pied tout en conservant parfaitement les pixels restants. Les contrôles de pixels ne suffisent donc pas à accepter le détourage.

## Points protégés et structure des yeux

Les coordonnées `x`, `y` utilisent la grille de l’original : origine en haut à gauche, indices à partir de zéro. `radius` vaut **1 par défaut** ; le script vérifie tout le carré de côté `2 × radius + 1`, qui doit rester dans l’image. Il n’identifie pas lui-même l’anatomie : les points doivent être placés et examinés sur la vraie photo.

| Valeur de `component` | Noms de points obligatoires |
| --- | --- |
| `body` | `left-foot`, `right-foot`, `left-hand`, `right-hand`, `head`, `dread-tip` |
| `biomask` avec `opaque_filters` ou `open_apertures` | `left-eye`, `right-eye` |
| `biomask` avec `continuous_bone` | `left-bone-panel`, `right-bone-panel`, `bone-bridge`, `lower-opening` |
| Autre composant, par exemple `gauntlet` ou `wristblade` | `proximal-end`, `distal-end` |

Gauche et droite désignent les côtés anatomiques documentés. Ajouter d’autres points pour les doigts, pointes de dreadlocks ou bords fragiles visibles ; les seuls noms obligatoires ne prouvent pas la conservation de toute la silhouette.

Pour `biomask`, `eye_structure` est obligatoire et suit **la variante réellement montrée** :

- `opaque_filters` : les points oculaires attendent un alpha de **255**. Les grilles, lentilles et reflets de l’original restent des surfaces opaques ; une zone sombre n’est pas un trou.
- `open_apertures` : les points `left-eye` et `right-eye` attendent un alpha de **0**, uniquement lorsque la photo établit de vraies ouvertures à ces emplacements.
- `continuous_bone` : les points `left-bone-panel`, `right-bone-panel` et `bone-bridge` attendent un alpha de **255**. Le point `lower-opening` doit déclarer explicitement `"expected_alpha": 0` sur une ouverture inférieure réellement visible. C’est le cas de la référence Feral examinée, identifiée `a49` : coque osseuse continue et échancrures mandibulaires inférieures. Aucun trou d’œil ne doit être ajouté à cette coque. L’hypothèse initiale d’orbites ouvertes a été corrigée avant tout envoi.

`expected_alpha` peut préciser **0 ou 255** pour un point. À défaut, il vaut 255, sauf les deux points oculaires d’un biomask déclaré `open_apertures`. Ne pas utiliser cette précision pour contredire la photo ou masquer une mauvaise déclaration de structure. Le script vérifie l’alpha déclaré ; il ne peut pas décider si une surface photographiée est une grille, un reflet, un visage derrière le masque ou une ouverture réelle.

## Trois revues réelles sur les mêmes fichiers

Prévoir une première lecture par l’IA de préparation, une contre-revue par une autre IA et une validation finale par une troisième. Chaque revue ouvre réellement l’original, le détourage et le composite, examine les détails nécessaires et conserve ses observations dans `evidence`. Copier un avis sous trois noms ne constitue pas trois revues indépendantes.

Les quatre identifiants de contrôle requis, écrits exactement ainsi, sont :

- `identity` : bon personnage, version et composant ; pour Samurai/Viking, vérifier le DLC **Predator: Hunting Grounds**, sans lui substituer une statue homonyme.
- `complete_silhouette` : toutes les parties visibles nécessaires restent présentes, avec attention aux pieds, doigts, dreadlocks et extrémités mécaniques.
- `cutout_edges` : contours, creux, petites pièces et ombres de contact examinés ; pas de membre amputé par le retrait du socle ou du décor.
- `component_readability` : composant et surfaces suffisamment lisibles pour le découpage prévu, notamment yeux du masque et équipement de chaque avant-bras.

Une revue ne compte pour le script que si `reviewer` est un identifiant non vide, `passed` vaut exactement `true`, `sha256` correspond exactement aux trois fichiers courants, les quatre contrôles figurent dans `checks`, et `evidence` est une liste non vide. Au moins **trois identifiants distincts** conformes sont nécessaires. Le script contrôle ces déclarations et leur fraîcheur ; il ne prouve pas à lui seul que les images ont été ouvertes, que les intervenants sont indépendants ou que le contenu de leurs observations est juste. Ce sont des revues IA, pas des tests humains.

## Format JSON consommé par le script

Le manifeste suivant donne les noms et la structure des champs réellement lus. C’est un **gabarit volontairement non éligible** : remplacer chemins, SHA et coordonnées après sélection des vrais fichiers. Les trois avis restent `passed:false` tant que leurs revues n’ont pas eu lieu ; aucune approbation n’est préremplie.

```json
{
  "asset_id": "personnage-composant-vue-version",
  "component": "body",
  "source": "chemin/source-original.jpg",
  "cutout": "chemin/detourage-rgba.png",
  "composite": "chemin/composite-gris.png",
  "background_rgb": [128, 128, 128],
  "expected_sha256": {
    "source": "SHA256_SOURCE_A_REMPLACER",
    "cutout": "SHA256_CUTOUT_A_REMPLACER",
    "composite": "SHA256_COMPOSITE_A_REMPLACER"
  },
  "protected_points": [
    {"name": "left-foot", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "right-foot", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "left-hand", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "right-hand", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "head", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "dread-tip", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255}
  ],
  "visual_reviews": [
    {
      "reviewer": "preparation-ia",
      "passed": false,
      "sha256": {
        "source": "SHA256_SOURCE_A_REMPLACER",
        "cutout": "SHA256_CUTOUT_A_REMPLACER",
        "composite": "SHA256_COMPOSITE_A_REMPLACER"
      },
      "checks": ["identity", "complete_silhouette", "cutout_edges", "component_readability"],
      "evidence": []
    },
    {
      "reviewer": "contre-revue-ia",
      "passed": false,
      "sha256": {
        "source": "SHA256_SOURCE_A_REMPLACER",
        "cutout": "SHA256_CUTOUT_A_REMPLACER",
        "composite": "SHA256_COMPOSITE_A_REMPLACER"
      },
      "checks": ["identity", "complete_silhouette", "cutout_edges", "component_readability"],
      "evidence": []
    },
    {
      "reviewer": "validation-finale-ia",
      "passed": false,
      "sha256": {
        "source": "SHA256_SOURCE_A_REMPLACER",
        "cutout": "SHA256_CUTOUT_A_REMPLACER",
        "composite": "SHA256_COMPOSITE_A_REMPLACER"
      },
      "checks": ["identity", "complete_silhouette", "cutout_edges", "component_readability"],
      "evidence": []
    }
  ]
}
```

Pour un biomask avec filtres opaques ou véritables ouvertures oculaires, remplacer `component` par `biomask`, ajouter `"eye_structure":"opaque_filters"` ou `"eye_structure":"open_apertures"` selon la photo, et employer les deux points oculaires. Pour une coque osseuse continue comme la référence Feral `a49`, remplacer les champs correspondants du manifeste par ce fragment, puis mesurer les coordonnées sur la photo :

```json
{
  "component": "biomask",
  "eye_structure": "continuous_bone",
  "protected_points": [
    {"name": "left-bone-panel", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "right-bone-panel", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "bone-bridge", "x": 0, "y": 0, "radius": 1, "expected_alpha": 255},
    {"name": "lower-opening", "x": 0, "y": 0, "radius": 1, "expected_alpha": 0}
  ]
}
```

Le fragment ne remplace pas les chemins, SHA et trois revues du manifeste complet. L’alpha zéro de `lower-opening` est explicite : le défaut du script serait 255 pour ce point. Pour les autres équipements, employer les deux points d’extrémité. Les coordonnées zéro des gabarits ne sont pas des mesures anatomiques : elles doivent être remplacées. `asset_id` identifie la référence dans le rapport ; le script ne vérifie pas son identité à partir de ce texte.

Les trois clés `source`, `cutout`, `composite` de `expected_sha256` doivent toutes être présentes, sans clé supplémentaire. Les SHA de chaque revue utilisent exactement le même dictionnaire. Les dimensions, comptes de pixels et résultats sont calculés dans la sortie : ils ne sont pas à déclarer comme validations dans l’entrée.

## Commande et lecture du résultat

Depuis la racine du dépôt, avec les dépendances Python de préparation disponibles et un dossier de sortie déjà créé :

```sh
python3 scripts/audit-reference-cutout.py \
  /chemin/manifest-reference.json \
  --output /chemin/rapport-reference.json
```

Le rapport est également écrit sur la sortie standard. Lire notamment `pixel_checks_passed`, `eligible_for_paid_submission`, `errors`, `sha256`, `protected_landmarks`, `independent_visual_reviewers` et `visual_review_pending`. Les sept auto-tests synthétiques du script peuvent être lancés séparément ; ils incluent la protection de la coque continue contre l’ajout de faux trous d’yeux :

```sh
python3 scripts/audit-reference-cutout.py --self-test
```

- **Code 0** : la référence passe les contrôles et possède les trois revues conformes aux SHA courants. Ce n’est pas une autorisation de dépense.
- **Code 2**, dans le parcours normal d’audit : **référence pas encore prête**, parce que des pixels/points échouent ou que les revues conformes manquent. Ce n’est pas un échec API : aucune requête Meshy n’a eu lieu. Une erreur d’arguments peut aussi afficher l’usage et retourner 2 ; lire alors ce diagnostic.
- Une erreur de fichier ou de JSON doit être corrigée avant d’interpréter un résultat de contrôle. Les auto-tests sont des fixtures logicielles, pas six références ou six modèles validés.

Les pixels contrôlés ne révèlent pas les surfaces cachées par un membre, un masque, une queue ou le décor. Ils ne prouvent ni la complétude du dos, ni la topologie 3D, ni le bon fonctionnement de futures chaînes de dreadlocks ou pièces mécaniques. Une partie occultée doit rester signalée comme inconnue ; l’acceptation de la référence ne constitue jamais une attestation de fidélité « 1:1 ».
