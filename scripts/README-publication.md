# Reprise du build fidélité validé du 25 octobre

Le script vise uniquement le build V2 `cb19eded36c19e20a5c50b94daad56d1d8550cf1c9ddff08df6d0167d7a03910`. Il ne compile rien et utilise le stage immuable `/workspace/qa/fidelity-20261025/vercel-static-prebuilt-v2`. La version publique précédente est `8683a627…`. Le candidat local V1 a été écarté avant tout déploiement pour corriger la sélection des cibles APC ; ses preuves restent distinctes de la validation finale V2.

Le mode par défaut vérifie les 29 fichiers, les 12 GLB, le projet et les en-têtes sans appel réseau :

```sh
node scripts/resume-verified-publication.mjs --check-only
```

Le [rapport QA](../docs/qa/fidelity-validation.json) doit porter le statut `passed_locally_waiting_publication` ou `published_and_verified` avant toute action distante. Le garde-fou exige le build exact, **386 tests CPU** réussis sans échec ni test ignoré ou annulé, **15 tests navigateur** réussis sur ce même build, puis un contrôle réel sans erreur JavaScript, chargement ou requête externe. La régression de cible APC doit être vérifiée dans la horde réelle. L’empreinte des 92 sources gelées est conservée dans le rapport : `b91f13167902defdf12e3fc42e9604dd02ef8c6e5369b2ba61cf5cef59bdc349`.

Une QA encore en cours apparaît dans `globalQa.pendingChecks` en mode local ; elle bloque les commandes distantes. Les octets et le rapport sont revérifiés avant création et promotion. Le build V2 est publié via `dpl_39FAHCh8Z68e8d6vHt4ZXg3ZSbaY` sur [yautja-hive-warriors.vercel.app](https://yautja-hive-warriors.vercel.app). Les 29 fichiers publics, dont les 12 GLB et les cinq bundles, correspondent aux octets, empreintes et en-têtes du stage V2. Pour revérifier ce même déploiement, réutiliser son identifiant :

```sh
NODE_USE_ENV_PROXY=1 node scripts/resume-verified-publication.mjs --deployment dpl_39FAHCh8Z68e8d6vHt4ZXg3ZSbaY --promote
```

Si la création est mise en file d’attente, reprendre avec `--deployment` suivi du véritable identifiant `dpl_…` enregistré dans `/workspace/qa/fidelity-20261025/vercel-delivery-status.json`, et ajouter `--promote`. Ne pas relancer `--deploy` pour le même candidat. Le candidat est passé READY, sa vérification HTTP a réussi, puis il a été promu et contrôlé publiquement. Ces preuves sont conservées dans `vercel-delivery-status.json`, `vercel-candidate-verification.json` et `vercel-public-verification.json` sous le dossier QA de cette passe.

Le script refuse de remplacer un build canonique inconnu. Il contrôle ensuite les octets, empreintes et en-têtes de tous les fichiers publics. Il utilise la session CLI existante sans lire ses fichiers d’identifiants, ne change pas la facturation et ne relance pas automatiquement une création refusée. Une vérification navigateur publique reste nécessaire après promotion ; les instructions seules ne déclarent pas une publication.
