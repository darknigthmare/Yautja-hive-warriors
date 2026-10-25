La publication du 24 octobre est bloquée par le quota Vercel `api-deployments-free-per-day`. Aucun candidat final v2 n'a été créé et le domaine public conserve la version précédente. Le candidat intermédiaire v1 ne doit pas être promu.

Le script de reprise utilise uniquement le build figé dont l'index porte le SHA256 `9fdd19169a75d324dbde0e77bddbac90167e81ca19bfb06880084246a4bad6d6`. Il ne compile rien. Il nécessite les fichiers de cette session cloud, notamment `/workspace/qa/open-work-20261024/vercel-static-prebuilt-v2`, les vérificateurs HTTP et la session CLI déjà configurée. Il ne lit pas les fichiers d'identifiants.

Le contrôle par défaut compare tous les octets de `dist` et du staging avec le manifeste figé, ainsi que la configuration des en-têtes et le lien du projet Vercel. Il n'effectue aucun appel réseau et préserve le rapport du blocage quota :

```sh
node scripts/resume-verified-publication.mjs --check-only
```

Avant tout workflow distant, le rapport `docs/qa/open-work-validation.json` doit avoir le statut `passed_locally_deployment_blocked_quota`, le SHA du build figé, 336 tests CPU réussis sans échec, et les statuts `passed` pour `browser.final_targeted` et `browser.final_runtime`. Tant que le responsable n'a pas enregistré ces résultats réels, le script refuse la publication. Il vérifie à nouveau ce rapport avant la création et avant la promotion.

Lorsque le quota permet une nouvelle création, soumettre une seule fois ce build, sans changer le domaine :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deploy
```

Le script conserve l'identifiant du candidat, attend READY pendant une durée bornée et vérifie ses fichiers JS/CSS, l'index et les en-têtes HTTP. Il ne relance jamais automatiquement une soumission refusée. Si le candidat existe déjà, reprendre avec son véritable identifiant pour éviter une nouvelle création :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deployment dpl_IDENTIFIANT_REEL
```

La promotion nécessite le drapeau explicite suivant, après validation du candidat :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deployment dpl_IDENTIFIANT_REEL --promote
```

La promotion est refusée si les octets figés, le rapport QA ou le domaine canonique ont changé vers un autre build. Le script vérifie ensuite, sans authentification, les octets, SHA256 et en-têtes de tous les fichiers publics, dont les 12 GLB. Les rapports et journaux sont enregistrés dans `/workspace/qa/open-work-20261024/`. Ces contrôles HTTP ne remplacent pas une vérification navigateur sur le domaine public.

Si le build attendu est déjà public, le script évite de créer un autre candidat et contrôle les fichiers publics. Un identifiant de déploiement inconnu est enregistré comme `null` avec le libellé explicite `already-public-id-not-resolved` ; aucun identifiant Vercel n'est inventé.
