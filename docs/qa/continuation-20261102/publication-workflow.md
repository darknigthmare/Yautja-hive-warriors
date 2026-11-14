Le profil `continuation-20261102` prépare une nouvelle livraison du code consolidé. Les quatre profils antérieurs, leurs pins, stages et registres restent distincts ; le profil par défaut reste `pr3-20261026`. Le refus du candidat a800 est conservé.

| Élément | Chemin du nouveau profil |
| --- | --- |
| QA externe | `/workspace/qa/continuation-20261102` |
| Pins, à créer par le coordinateur après QA | `docs/qa/continuation-20261102-publication-pins.json` |
| Rapport final, à créer par le coordinateur | `docs/qa/continuation-20261102-validation.json` |
| Stage immuable, à créer après vérification | `/workspace/qa/continuation-20261102/vercel-static-prebuilt` |
| CLI existant délégué | `/workspace/qa/continuation-20261102/vercel-cli.sh` |

Le wrapper exécutable délègue au wrapper autorisé du profil précédent, sans lire ses secrets ni changer le flux d’authentification. Son [texte reproductible](vercel-cli-wrapper.sh) ne contient aucun credential. Les preuves actuelles en [lecture seule](publication-before/) ne prouvent pas la réouverture du quota.

Les [13 tests ciblés](publication-targeted-tests.txt) vérifient profils, archives, défauts, pins et gardes avec des fichiers temporaires. Les [neuf prévols du helper](public-helper-preflight.json) vérifient syntaxe et arguments sans navigateur, réseau ni artefact public. Aucun pins réel, rapport final ou stage n’est créé par ces tests. La [revue de configuration](configuration-review.json) précise leur portée et leurs empreintes.

Après publication effective et contrôle des octets, le coordinateur peut accorder le créneau Chromium exclusif :

```sh
NODE_USE_ENV_PROXY=1 node docs/qa/continuation-20261102/verify-public.mjs \
  --commit SOURCE_SHA40 --index-sha256 INDEX_SHA64 \
  --build-info-sha256 BUILD_INFO_SHA64 --deployment dpl_ID --root-browser-go
```

`--help` et `--check-config` restent sans effets. L’exécution exige les quatre valeurs explicites et le flag du coordinateur. Elle compare d’abord le dist propre et les octets publics, puis charge Playwright depuis le nouveau dépôt. Les vrais clics de carte gardent la simulation pausée selon la correction r2 ; les touches photo/menu sont réellement pressées après contrôle du focus.

Chaque exécution conserve rapport, captures, sources des helpers et manifeste dans un dossier propre à sa tentative. Les 22 contrôles attendus restent distincts de toute victoire naturelle, validation humaine, performance matérielle ou certification 1:1. Le helper public n’a pas encore été exécuté sur le nouveau build.
