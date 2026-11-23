# Runner de Fiorina : références Meshy (23 novembre 2026)

Deux références, chacune approuvée par l’auteur avant son appel payant. Solde Meshy : 1 736 crédits avant, 1 730 après (2 images, 3 crédits chacune).

| Fichier | Rôle | Méthode | Entrée |
| --- | --- | --- | --- |
| `runner-film-reference.jpg` | Runner fidèle au film, demandé par l’auteur | `image-to-image`, `nano-banana` (tâche `01a20836-4d69-7032-bdbb-79f78e135564`) | photo de profil de la figurine NECA *Ultimate Dog Alien* (*Alien 3*), publiée par Toyark (`https://www.toyark.com/wp-content/uploads/2019/07/NECA-Ultimate-Dog-Alien-012.jpg`) |
| `runner-original-variant.jpg` | Variante originale, gardée comme alternative du Runner | `text-to-image`, `nano-banana` (tâche `01a20808-5cb2-7060-976c-f49c178ad5ba`) | description originale (`original-t2i-request.json`) |

La consigne envoyée pour l’image fidèle est dans `film-i2i-request.json`. La photo y est remplacée par son adresse : elle a été transmise en base64.

## Limites

- **Une interprétation, pas un relevé.** La référence fidèle est l’interprétation d’une figurine commerciale par Meshy. Ce n’est ni un relevé de la créature du film, ni une fidélité 1:1.
- **Modèle et rig.** Après accord de l’auteur :
  - modèle 3D `image-to-3d` (tâche `01a20842-c059-7472-8bd0-eb033dfee3bb`) ;
  - rig `meshyrig` (tâche `01a20844-7248-7664-8d15-11c8f684c0d1`).

  Solde : 1 730 crédits avant, 1 695 après (35 dépensés).
- **Le rig est bipède**, sur un quadrupède. Les « bras » servent de pattes avant. La marche bipède de Meshy donne une démarche de traque où les quatre pattes alternent (`runner-walk-cycle.jpg`) : c’est acceptable, mais pas un cycle de marche quadrupède mesuré.
- **En jeu.** Le boss `fiorina_runner` charge `public/models/fiorina-runner-rigged.glb` avec la marche et la course (entrée `fiorina_runner` du manifeste). Le runner procédural reste dessous tant que le modèle n’est pas chargé, et en cas d’échec. Collisions et combat ne dépendent pas du modèle.
- **Vérifié dans Chromium** (`runner-ingame-fiorina.jpg`) : modèle chargé, actions `walk` et `run`, aucune erreur de page. Vue fixe prise par script, pas une partie jouée.
