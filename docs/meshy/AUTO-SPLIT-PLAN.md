# Pilote Auto Split pour les Yautja

Vérifié le 23 octobre 2026. Ce document prépare les opérations ; il ne prouve ni un
découpage réussi, ni une fidélité 1:1, ni une autorisation de dépense pour le lot.

## Premier essai retenu

Réutiliser le Jungle Hunter existant, sans générer de nouveau corps, pour tester
**un seul découpage estimé à 10 crédits**. Examiner son résultat avant de chiffrer
et lancer City Hunter puis les cinq autres variantes. Aucun retexturage, rigging,
nouveau masque ou second découpage ne fait partie de ce premier essai.

- Source : `multi-image-to-3d`, `01a159b4-8004-75bd-b39d-cf5184ccf13f`.
- Une lecture gratuite du flux de cette tâche a confirmé `SUCCEEDED`, progression
  100, le 23 octobre. Les 30 crédits indiqués dans cette réponse appartiennent à
  la génération historique, pas à une nouvelle dépense.
- Le payload de génération historique indique `ai_model: latest`, géométrie
  `standard`. Le modèle inspecté compte 206 591 triangles.
- Le modèle source reste inchangé et le résultat du pilote reste à part du jeu.
- Payload préparé, non soumis lors de la rédaction :
  `meshy_output/yautja-expansion-20261023/jungle-hunter-split-pilot.payload.json`.
- Huit noms, 175 caractères : groupe des dreadlocks, deux lames droites,
  gantelet droit, couvercle gauche, boîtier gauche, canon d'épaule, corps.
  Un nom ne garantit pas que la pièce existe distinctement dans le modèle.
- `mode: by_parts`, `layout: assembled`, `connectors: false`, formats `glb`.
  L'API accepte 1 à 10 noms, 600 caractères au maximum ; les éléments non nommés
  peuvent constituer une pièce restante.
- L'entrée est un identifiant de tâche : aucun modèle n'est téléversé. La limite
  CLI de 50 Mio pour un fichier local ne s'applique donc pas à cette soumission.

## Ce que le découpage fournit et modifie

[Auto Split](https://docs.meshy.ai/api/auto-split) prend une tâche réussie
Image/Multi-Image to 3D, Text to 3D preview, Remesh, Convert ou Resize, produite
avec Meshy 6/7/7.1/`latest`, avec au plus 8 millions de faces. Les modèles Smart
Topology T2/T2.5 ne sont pas acceptés. Une tâche de rigging n'est pas une entrée
documentée : utiliser la génération d'origine, pas le GLB articulé du jeu.

Le GLB exporte les pièces comme objets séparés et `assembled` conserve leur
placement. Auto Split **reconstruit les pièces, renforce les zones fines et
supprime les fragments effondrés**. Le résultat n'est donc pas une segmentation
sans modification du maillage. Il perd les textures d'origine : les objets ont
des couleurs de sommets unies. Les textures PBR, les UV, les poids et la hiérarchie
du modèle d'entrée ne sont pas garantis conservés.

Un découpage ne crée ni un accessoire absent, ni les faces cachées documentées,
ni des chaînes d'os. Le corps City Hunter préparé est sans masque : il faudra
toujours produire son masque à partir de sa référence propre. Un groupe de
dreadlocks séparé reste un groupe ; il faut ensuite identifier et articuler
chaque mèche avec des poids réels. Les lames nécessitent leurs propres objets,
axes et courses, et le couvercle son pivot. Il faut retirer les doublons du corps
avant de monter des accessoires séparés.

## Exécution avec le CLI 0.4.0

`meshy resources` ne répertorie pas Auto Split, et `meshy auto-split create
--help` retourne l'aide générale. Il n'existe pas de `wait` générique acceptant
un chemin d'API. Le CLI fournit cependant le passage documenté `meshy api`.

Malgré son libellé « JSON only », le code de `api` lit aussi un corps texte et le
retourne sans le convertir s'il ne s'agit pas de JSON. Une vérification gratuite
sur le flux de la génération Jungle Hunter a réellement terminé avec code 0,
HTTP 200 et un corps SSE de 4 953 caractères. Preuves privées :
`meshy_output/yautja-expansion-20261023/records/readonly-body-stream-cli.json`
et `readonly-body-stream-probe.json`. Aucun secret n'a été lu ou affiché.

Employer le runner 0.4.0, les options communes `--output-schema v1 --format json
--no-update-check`, et `--workspace /workspace/Yautja-hive-warriors` pour les
écritures. Conserver le proxy et les certificats configurés.

Séquence revue, à exécuter uniquement par l'agent principal dans le périmètre
autorisé :

1. Vérifier le solde gratuit et enregistrer l'intention, le hash du payload,
   l'heure de soumission et la source dans le dossier privé du pilote.
2. Soumettre **une fois** avec `meshy api POST /print/split --data @PAYLOAD
   --save-json CREATE_RESPONSE`, puis conserver immédiatement le `result` de la
   réponse brute comme identifiant. Ce passage brut ne fournit pas le journal
   `--operation-id` des commandes `create` classiques.
3. Attendre dans **un seul processus CLI**, avec
   `MESHY_READ_TIMEOUT_MS=600000 meshy api GET /print/split/ID/stream
   --save-json STREAM_RESPONSE`. Le CLI bufferise le flux jusqu'à sa fermeture ;
   il ne montre pas ses événements progressivement. L'API documente ce flux SSE.
   Conserver la session d'exécution et commenter les changements utiles.
4. Lire les événements `message`, distinguer les événements `error` et exiger un
   état terminal. Un code 0 HTTP ne suffit pas : une fermeture précoce du flux
   pourrait ne pas contenir le résultat final. Après timeout ou fermeture
   incomplète, reprendre **le même identifiant**, sans autre POST.
5. Obtenir le snapshot final par `meshy api GET /print/split/ID --save-json
   TASK_JSON`, puis utiliser `meshy download --task-json TASK_JSON --list`.
   Télécharger le GLB et l'aperçu présents avec les sélecteurs effectivement
   listés ; ouvrir l'aperçu et examiner le maillage dans le projet local.
6. En cas de soumission à résultat incertain, ne pas recommencer le POST. Lire
   la liste `/print/split` avec le CLI et rapprocher les heures et les tâches
   enregistrées ; l'objet Auto Split ne renvoie pas le prompt ni un identifiant
   de source documenté, donc une ambiguïté peut nécessiter un examen manuel.
7. Relever `consumed_credits`, le nombre réel de pièces et `prompt_ignored`.
   Ne pas considérer un choix automatique du service comme une découpe validée
   des pièces demandées.

La commande de flux a été validée sur la génération historique, pas encore sur
une tâche Auto Split réelle. L'appel de découpage n'a pas été effectué par
l'agent qui a rédigé cette note.

## Contrôles avant la suite

- Comparer la silhouette et les proportions, y compris les deux pieds, mains,
  mandibules, extrémités des mèches et pointes des lames, à la source existante.
- Inventorier les objets et leurs limites : deux lames réelles, boîtiers,
  couvercle si présent, groupe des cheveux et corps. Un nombre de pièces élevé
  ne suffit pas à valider leur signification.
- Refuser tout épaississement gênant, lame raccourcie, mèche disparue, fusion ou
  trou important. Aucun résultat dégradé ne doit remplacer le modèle publié.
- Mesurer la densité, l'échelle, les coordonnées d'assemblage et les matériaux.
  Photographier plusieurs angles ; un rendu seul ne démontre pas la topologie.
- Examiner ensuite la faisabilité du transfert local des textures ou d'un
  retexturage. Le pilote ne paie ni cette étape ni un rigging.

## Textures, rigging et coût des personnages suivants

[Retexture](https://docs.meshy.ai/api/retexture) accepte un GLB fourni via
`model_url`, ou une tâche réussie produisant un modèle. Auto Split n'est pas cité
explicitement parmi ses exemples. Le GLB est donc la voie documentée si cet
identifiant n'est pas accepté directement. Le service ne promet pas de conserver
les objets, leur nom ou les poids après retexturage : vérifier le résultat avant
de considérer les pièces comme prêtes pour l'animation.

Choisir `enable_original_uv` selon les UV **réellement présents** après la
reconstruction ; ne pas supposer que les UV d'origine ont survécu. Une ou quatre
références peuvent guider les textures ; `multiview_image_urls` exige
explicitement `ai_model: meshy-7`. Les références doivent montrer le même objet.

[Rigging](https://docs.meshy.ai/api/rigging) exige un humanoïde texturé avec des
membres lisibles, orienté vers +Z. L'API actuelle indique 320 000 faces ; conserver
la marge du workflow de 300 000 triangles. Riguer le corps puis rattacher les
accessoires mesurés évite de demander au rig humanoïde d'articuler les lames. Il
n'y a aucune promesse d'os de cheveux ou de préservation d'un découpage multipart.
Le rigging inclut les clips de marche et de course : aucun `animate` payant n'est
nécessaire pour ces deux clips de base.

[Tarifs publiés](https://docs.meshy.ai/api/pricing), lus le 23 octobre 2026 :

| Étape | Estimation en crédits |
| --- | ---: |
| Pilote : découper le Jungle Hunter existant | 10 |
| Nouveau corps standard, géométrie seule | 20 |
| Auto Split du nouveau corps | 10 |
| Retexturage 4K/PBR d'un modèle | 10 |
| Rig humanoïde | 5 |
| Masque séparé depuis référence, standard + textures 4K | 30 |

La chaîne théorique d'un nouveau corps séparé, texturé et articulé est de
**45 crédits** (20 + 10 + 10 + 5), si un seul retexturage suffit et conserve un
résultat exploitable. Un masque absent du corps porte cet exemple City Hunter à
**75 crédits**. La chaîne « corps déjà texturé 30, split 10, retexture 10, rig 5 »
coûterait 55 pour le corps et jetterait ses premières textures ; elle n'est pas le
choix par défaut. Un transfert local réussi pourrait éviter un retexturage, mais
il n'est pas démontré et ne doit pas être promis.

Ces montants ne sont pas un plafond validé pour les six variantes : leurs pièces,
références et besoins de textures diffèrent, et les passages multipart restent à
tester. Chaque tâche terminée doit fournir son coût réel. La proposition initiale
de 750 crédits est suspendue. Pas de relance automatique ni de génération
d'accessoire supplémentaire sans proposition de coût préalable.

## Smart Topology, alternative distincte

[Image to 3D](https://docs.meshy.ai/api/image-to-3d) décrit `meshy-t2` comme ayant
des pièces séparées natives, entre 100 et **15 000 triangles**. `meshy-t2.5`
annonce davantage de détail pour le jeu, entre 100 et **30 000 triangles**, sans
la même promesse explicite sur les pièces dans la documentation examinée. Ni l'un
ni l'autre n'est un simple outil de découpage du modèle dense existant, et ils ne
sont pas compatibles avec Auto Split. Le prix image + textures 4K est 15 crédits,
mais ce prix et une topologie plus propre ne prouvent pas la fidélité demandée.
Ne pas substituer silencieusement une génération basse densité au personnage
haute définition pour obtenir des pièces.
