# Reprise du build validé du 25 octobre

Le script vise uniquement le build final `8683a627c08e1c2647913aa29dc375df8cdde08c69da18895981de2b5c5fae6f`. Il ne compile rien et utilise le staging immuable de cette session dans `/workspace/qa/development-20261025/vercel-static-prebuilt-v2`. La précédente version publique est le build `9fdd1916…`, publié et vérifié le 25 octobre.

Le mode par défaut vérifie les 29 fichiers, les 12 GLB, le projet et les en-têtes, sans appel réseau :

```sh
node scripts/resume-verified-publication.mjs --check-only
```

Tout workflow distant exige le [rapport QA](../docs/qa/development-validation.json) final : build exact, 360 tests CPU réussis, contrôle des derniers changements d'environnement réussi, régression navigateur et contrôle des modèles réels réussis. Le statut doit être `passed_locally_waiting_publication` ou `published_and_verified`. Les octets et le rapport sont revérifiés avant création et promotion.

Un candidat a déjà été créé pour ce build. Pour le vérifier sans nouvelle création :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deployment dpl_85Br8dxkvi4Ji87BjgQUQ9CnTCcb
```

Après réussite de la QA, la reprise de promotion utilise le même identifiant :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deployment dpl_85Br8dxkvi4Ji87BjgQUQ9CnTCcb --promote
```

Le script refuse de remplacer un build canonique inconnu. Il contrôle ensuite les octets, empreintes et en-têtes de tous les fichiers publics. Il ne lit pas les fichiers d'identifiants, ne change pas la facturation et ne relance pas automatiquement une création refusée. Une vérification navigateur publique reste nécessaire après promotion. Les résultats actuels de publication figurent dans le rapport QA ; ces instructions ne déclarent pas, à elles seules, une publication.
