# Runner de Fiorina : références Meshy (23 novembre 2026)

Deux références, chacune approuvée par l’auteur avant son appel payant. Solde Meshy : 1 736 crédits avant, 1 730 après (2 images, 3 crédits chacune).

| Fichier | Rôle | Méthode | Entrée |
| --- | --- | --- | --- |
| `runner-film-reference.jpg` | Runner fidèle au film, demandé par l’auteur | `image-to-image`, `nano-banana` (tâche `01a20836-4d69-7032-bdbb-79f78e135564`) | photo de profil de la figurine NECA *Ultimate Dog Alien* (*Alien 3*), publiée par Toyark (`https://www.toyark.com/wp-content/uploads/2019/07/NECA-Ultimate-Dog-Alien-012.jpg`) |
| `runner-original-variant.jpg` | Variante originale, gardée comme alternative du Runner | `text-to-image`, `nano-banana` (tâche `01a20808-5cb2-7060-976c-f49c178ad5ba`) | description originale (`original-t2i-request.json`) |

La consigne envoyée pour l’image fidèle est dans `film-i2i-request.json`. La photo y est remplacée par son adresse : elle a été transmise en base64.

## Limites

- **Une interprétation, pas un relevé.** La référence fidèle est l’interprétation d’une figurine commerciale par Meshy. Ce n’est ni un relevé de la créature du film, ni une fidélité 1:1.
- **Rien n’est encore en jeu.** Le jeu utilise toujours le runner procédural. Aucun modèle 3D n’est généré. Il faudra un nouvel accord : modèle environ 30 crédits, essai de rig environ 5. Le rig automatique de Meshy vise les bipèdes, alors que le Runner est quadrupède.
