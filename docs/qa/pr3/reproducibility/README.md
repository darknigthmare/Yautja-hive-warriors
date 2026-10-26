Deux installations propres et deux builds de production indépendants ont réussi avec Node `v24.19.0`, npm `11.9.0`, le commit `48b5bd5aa9d35fd3919ade38cf2aef55389bec5b` et la branche `codex/complete-pr3-20261026`.

Chaque sortie contient **30 fichiers**, dont **12 GLB**. Les 30 tailles et SHA256 de chaque clone correspondent exactement au stage figé et à l'autre clone. `build-info.json` est identique octet par octet, avec `sourceTreeDirty:false`, le même fingerprint, le même commit et sa date de référence. Le SHA256 de l'index est `124d7735003c245bc60814e6004c35ace77bd4011b31d448a6aa6c4c41dad185`.

Les clones ont été créés localement dans `/tmp/pr3-repro-a` et `/tmp/pr3-repro-b` :

```sh
git clone --shared --branch codex/complete-pr3-20261026 /workspace/Yautja-hive-warriors /tmp/pr3-repro-a
git clone --shared --branch codex/complete-pr3-20261026 /workspace/Yautja-hive-warriors /tmp/pr3-repro-b
```

Le contrôleur vérifie leur commit, leur branche et leur propreté avant chaque installation. Dans chacun des deux clones, il exécute les commandes suivantes avec un cache npm standard partagé, puis conserve leurs codes de sortie, durées, journaux et digests :

```sh
npm ci --cache /tmp/pr3-npm-repro-cache --no-audit --no-fund
npm run build
```

`SOURCE_DATE_EPOCH` est absent dans ces deux processus afin de laisser le plugin utiliser la date du commit `1793022277`, comme le build original. Les deux installations et les deux builds ont renvoyé le code zéro ; leurs arbres suivis sont propres avant et après. Les avertissements Vite sur la taille des bundles figurent dans les journaux.

Le rapport [report.json](./report.json) contient la liste et le SHA256 de **chaque fichier** pour le stage et les deux clones. Il confirme aussi que `dist` du dépôt original et le stage sont restés inchangés. [run-reproduction.py](./run-reproduction.py) permet de répéter la comparaison et les commandes dans ces deux clones seulement. Les journaux durables utilisent l'extension `.txt` pour être suivis normalement, sans forcer l'ajout de journaux ignorés.

Cette preuve couvre deux installations/builds propres sur le même hôte Linux. Elle ne certifie ni les autres systèmes d'exploitation, ni les performances matérielles, ni des tests humains. Aucun build du dépôt original, navigateur, déploiement ou Git distant n'a été exécuté dans cette vérification.
