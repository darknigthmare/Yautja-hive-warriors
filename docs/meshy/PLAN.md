# Personnages Meshy — état du 22 octobre 2026

Le Hunter démasqué, son biomask séparé et le Big Chap V2 sont intégrés dans la version locale du jeu. Les deux corps utilisent de véritables squelettes importés ; Big Chap reçoit une réparation locale de poids distincte du rig Meshy. Le [contrôle de l’application](../qa/reference-models/game-integration-check.json) a réussi le 22 octobre vers 20 h 41 UTC, avec [capture du jeu](../qa/reference-models/game-models-integration.png). Cette validation locale ne constitue pas une annonce de publication Vercel.

Le [suivi des générations](reference-generation.json) consigne les tâches, fichiers et contrôles. Le [cahier des références](REFERENCES.md) et le [plan appliqué](reference-plan.md) précisent les photos utilisées et leur préparation ; le [plan structuré initial](reference-plan.json) reste l’historique de sélection du 20 octobre. Une fidélité exacte « 1:1 » n’est pas établie.

## Références et préparation

Les sources sont des photos de statues Prime 1 Studio à l’échelle 1/3. Aucun scan des costumes des films n’est utilisé. Ces sculptures, leurs photos et les occultations limitent la comparaison avec les personnages de cinéma ; les vues disponibles ne constituent pas un relevé orthographique complet.

Les originaux sont conservés intacts. Les entrées du Hunter sont des adaptations par IA : certains pixels et détails ont été reconstruits. L’Alien a reçu un détourage classique sur son canevas d’origine, sans redimensionnement ni recadrage ; le biomask a été isolé puis placé sur un canevas neutre. Dans ces préparations classiques, les pixels photographiques du sujet sont conservés, avec composition du fond aux contours. Ces méthodes et leurs limites doivent rester associées aux fichiers de référence.

## Modèles et tâches terminées

Les six tâches ci-dessous ont réussi côté service. Leur réussite ne suffit pas à valider les formes, les déformations ou leur intégration en jeu.

| Élément | Ressource | ID de tâche | Crédits consommés | État d’utilisation |
| --- | --- | --- | ---: | --- |
| Corps du Hunter, guidé par références | `multi-image-to-3d` | `01a159b4-8004-75bd-b39d-cf5184ccf13f` | 30 | Intégré. |
| Rig du Hunter | `rigging` | `01a1651a-500c-757f-b9d6-8339ad63b85a` | 5 | Squelette importé utilisé par le Hunter. |
| Biomask séparé | `multi-image-to-3d` | `01a1651d-69e2-70dd-acdd-433cb66a0492` | 30 | Coque PBR intégrée ; compléments locaux décrits ci-dessous. |
| Big Chap V1 | `multi-image-to-3d` | `01a16527-c3e4-77ab-a0fa-f6feb1849d8b` | 30 | Rejeté : crâne trop vertical. Non activé. |
| Big Chap V2, pose préservée | `image-to-3d` | `01a16539-7fa8-7571-9421-468148325510` | 30 | Intégré comme visuel proche du guerrier, après réparation locale vérifiée. |
| Rig du Big Chap V2 | `rigging` | `01a1653e-d6a2-71c3-ae3f-d71af97d1797` | 5 | Squelette et clips importés ; poids de queue/mollets/pieds corrigés localement. |

Les projets de génération portent les noms suivants ; les tâches de rigging sont reliées à leurs corps dans le suivi structuré :

- `20261020_142616_jungle-hunter-unmasked-referen_01a159b4`
- `20261022_193636_jungle-hunter-biomask-referenc_01a1651d`
- `20261022_194803_big-chap-1979-reference_01a16527`
- `20261022_200731_big-chap-preserved-pose-refere_01a16539`

### Biomask : génération et compléments locaux

Meshy a produit la coque texturée PBR. Des grilles ont ensuite été ajoutées localement derrière ses ouvertures pour contrôler leur apparence dans le jeu. **Ces grilles ne proviennent pas de la génération Meshy.** Elles ne modifient pas le GLB source, dont le SHA reste inchangé ; leur placement et leur rendu appartiennent à l’intégration locale.

### Réparation locale et limites de l’Alien V2

Le rig reçu n’a pas d’os de queue et ses pivots de chevilles provoquaient de longues bandes de géométrie pendant les clips. La correction locale réattribue **36 728 sommets** en trois groupes : queue **28 590 → Hips**, mollet/pied gauche **4 611 → LeftLeg**, mollet/pied droit **3 527 → RightLeg**. Les formes de repos et textures sont conservées ; les deux chevilles ne s’articulent plus indépendamment, et la queue suit rigidement le bassin. Ce travail ne constitue pas un nouveau résultat Meshy ni une nouvelle dépense du service.

Les **33 phases échantillonnées par clip** de marche/course ne présentent plus les longues bandes observées ; la dérive XZ du modèle est nulle et le passage entre import proche et replis procéduraux fonctionne. Une pénétration résiduelle de queue reste admise : minimum Y d’environ **−0,178 en course** et **−0,096 en marche**, pour une hauteur de **3,95** (environ **4,5 % / 2,4 %**). Il n’y a ni articulation caudale indépendante ni IK des pieds. Ces limites artistiques restent visibles malgré la réussite des contrôles.

Le contrôle dans l’application vérifie une vraie vague de horde, les squelettes indépendants, le partage de géométrie corrigée, la locomotion sur place, les LOD proche/lointain et le redémarrage des vagues. Il vérifie aussi le Hunter, le masque en FPS, la coop et le nettoyage. Les résultats de la suite complète et l’état de publication sont consignés séparément dans les preuves finales.

## Essais textuels historiques, non activés

Les deux previews initiales ont été téléchargées et examinées. Leurs formes n’ont pas été retenues ; aucune texture `refine` n’a été engagée pour les sauver.

| Essai | Ressource | ID de tâche | Crédits consommés |
| --- | --- | --- | ---: |
| Hunter textuel initial | `text-to-3d` | `01a1594f-b1a6-738d-bf0d-b87fffcb5000` | 20 |
| Alien textuel initial | `text-to-3d` | `01a1594f-c035-7643-9e61-70bcc112def2` | 20 |

Leurs paramètres et leur historique restent dans [generation-plan.json](generation-plan.json). Ces fichiers ne doivent pas être confondus avec les corps guidés par références et les rigs du tableau précédent.

## Consommation constatée

- Passe guidée par références et ses rigs : **130 crédits**, dont 30 pour le Hunter produit le 20 octobre et 100 pour les cinq tâches du 22 octobre.
- Previews textuelles historiques : **40 crédits**, comptés séparément.
- Total documenté de ces tâches : **170 crédits**.
- Dernier solde vérifié du compte : **2 110 crédits**. Il s’agit d’une lecture du service, pas d’un solde calculé à partir de cet historique partiel.

Ces montants sont les consommations rapportées pour les tâches existantes. Les compléments du masque et la correction locale de la queue n’ajoutent aucune nouvelle génération Meshy. Aucun devis supplémentaire n’est engagé ici.

## Reprise, intégration et publication

Réutiliser la session Meshy configurée et la CLI **0.4.0**, avec `NODE_USE_ENV_PROXY=1` et les certificats de l’environnement. Conserver la ressource et l’ID de chaque tâche : un téléchargement ou une attente se reprend sur cet ID, sans répéter une création payante. Les snapshots contenant des liens signés et les identifiants de connexion restent hors des fichiers publics.

Le groupe du joueur, ses contrôles et les sockets d’armes restent stables. Les corps importés conservent un squelette indépendant par acteur ; les textures partagées ne doivent pas être détruites avec un acteur. Le masquage réel de la tête et du biomask en FPS, le camouflage et la coop font partie des contrôles d’intégration. Les tests synthétiques des adaptateurs complètent les contrôles sur les vrais GLB.

Le statut de publication de cette version figure dans le [README](../../README.md) et les [preuves finales de validation](../qa/validation.json). Le périmètre des tests et les limites matérielles sont décrits dans [QA.md](../../QA.md).
