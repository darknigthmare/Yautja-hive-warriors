La passe PR3 utilise ses propres pins, son rapport final et son dossier QA. Les preuves de `fidelity-20261025` restent intactes. Seul son lanceur CLI existant est réutilisé pour la session Vercel ; aucun script ne lit ou n'affiche les identifiants de connexion.

Le coordinateur termine le commit de code et le build, puis relève les valeurs exactes de `dist/index.html` et `dist/build-info.json`. Dans `docs/qa/pr3-publication-pins.json`, il renseigne `sourceCommit`, `sourceFingerprint`, `indexSha256` et `buildInfoSha256` depuis ce build déjà vérifié. `previousPublicIndexSha256` doit être le hash de la version publique réellement constatée. Les champs restants peuvent encore être vides à la préparation.

```sh
node scripts/prepare-verified-pr3.mjs
```

Cette commande ne lance ni build, ni Git, ni navigateur, ni requête distante. Elle crée exclusivement `/workspace/qa/pr3-20261026/vercel-static-prebuilt`, refuse d'écraser un stage existant et vérifie tous les fichiers, `build-info.json` compris. Chaque GLB est comparé au manifeste source des modèles et animations. Le nombre de fichiers, modèles et bundles est calculé à partir du build ; aucun nombre historique n'est imposé. Une préparation interrompue doit être inspectée avant toute suppression manuelle ; un candidat déjà créé ne doit jamais être remplacé en supprimant son stage.

Le résultat `/workspace/qa/pr3-20261026/publication-pins.proposed.json` contient les hashes exacts du manifeste d'artefacts, de la configuration Output API et du lien du projet. Le coordinateur transfère ces valeurs dans les pins du dépôt, termine le vrai rapport `docs/qa/pr3-validation.json`, en calcule `qaReportSha256`, renseigne les comptes CPU/régression exacts et les IDs des contrôles runtime réellement mesurés, puis choisit `status: "frozen"`. Une vérification absente ou échouée ne doit pas être rebaptisée « passed » pour franchir le garde-fou.

Le rapport QA attendu contient ces champs (les `null` ci-dessous sont des emplacements à renseigner, pas une validation) :

```json
{
  "status": "passed_locally_waiting_publication",
  "build": {
    "success": true,
    "source_commit": null,
    "source_fingerprint": null,
    "index_sha256": null,
    "build_info_sha256": null
  },
  "cpu": {
    "status": "passed", "passed": null, "failed": 0, "skipped": 0,
    "cancelled": 0, "index_sha256": null
  },
  "browser": {
    "final_regression": {
      "status": "passed", "passed": null, "failed": 0, "skipped": 0,
      "cancelled": 0, "index_sha256": null
    },
    "final_runtime": {
      "status": "passed", "index_sha256": null, "errors": 0,
      "failed_requests": 0, "external_requests": 0,
      "checks": [{ "id": "ID_D_UN_VRAI_CONTROLE", "status": "passed" }]
    }
  }
}
```

La vérification locale finale recompare le build et le stage octet par octet, le rapport QA épinglé et le fingerprint du code présent. `build-info.json` doit indiquer un arbre de code propre et le commit épinglé. Une vérification Git en lecture seule confirme que ce commit est un ancêtre du HEAD actuel : des commits ultérieurs de documentation sont admis, tandis que tout changement du code runtime échoue sur le fingerprint. Le publieur ne fait aucun commit ni build.

```sh
node scripts/publish-verified-pr3.mjs --check-only
```

Après cette vérification, le coordinateur peut créer **un seul** candidat de production sans changer le domaine, attendre son état READY et contrôler en HTTP authentifié **tous** ses fichiers, y compris chaque GLB et le build-info :

```sh
NODE_USE_ENV_PROXY=1 node scripts/publish-verified-pr3.mjs --deploy
```

Le candidat reste sans promotion. Pour le promouvoir après les contrôles, reprendre son véritable ID enregistré dans `/workspace/qa/pr3-20261026/vercel-delivery-status.json` :

```sh
NODE_USE_ENV_PROXY=1 node scripts/publish-verified-pr3.mjs --deployment dpl_ID_REEL --promote
```

Une exécution unique `--deploy --promote` réalise également cette séquence complète. Elle soumet avec `--prebuilt --prod --skip-domain`, attend READY, compare les octets et les en-têtes de tous les fichiers, revérifie les garde-fous locaux, puis promeut. Elle contrôle ensuite les mêmes octets et en-têtes sur le domaine canonique sans authentification ni redirection, build-info compris. Elle ne lance jamais Chromium et ne revendique aucun test humain.

Après un délai READY, une panne réseau, une limite de déploiement ou une réponse de soumission ambiguë, le script ne crée aucun candidat de remplacement automatiquement. Reprendre avec `--deployment` dès que son ID réel a été identifié. Un verrou `publication-remote.lock` empêche deux soumissions parallèles ; s'il subsiste après un arrêt brutal, le coordinateur doit d'abord vérifier si un candidat a été créé avant de lever le verrou. Une version publique ayant changé vers un hash non prévu bloque la promotion.

Les preuves de chaque exécution ont un nom unique `publication-<date>.json`, `http-candidate-<date>/report.json` et `http-public-<date>/report.json`. Les fichiers `vercel-*-verification.json` et `vercel-delivery-status.json` désignent l'état le plus récent. Les corps des modèles sont entièrement hachés puis retirés du cache de vérification ; les digests, tailles et en-têtes restent dans les preuves. Le rapport QA épinglé n'est jamais réécrit par une publication.

Les petits lanceurs sous `/workspace/qa/pr3-20261026/` délèguent à ces scripts versionnés. Ils n'apportent aucun changement aux anciens fichiers de preuves. Les contrôles des scripts eux-mêmes se font avec `node --check` et `node --test tests/pr3-publication.test.mjs`, sans réseau, Git, build ou navigateur.
