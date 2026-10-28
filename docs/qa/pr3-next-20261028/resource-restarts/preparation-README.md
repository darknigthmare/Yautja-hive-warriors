Le harness est préparé pour le build final de la branche NEXT. **Aucune passe navigateur de ce lot n’a encore été exécutée.** Le coordinateur réserve Chromium aux régressions, aux onze contextes puis aux fonctions intégrées avant de donner le GO exclusif à ce test.

La commande exige le SHA256 de l’index et le commit source final avant toute création de preview ou de navigateur. Le chemin de travail du serveur est dérivé du harness, donc fixé au nouveau worktree `/workspace/Yautja-next-20261028`. Aucune commande de build ou Git n’est exécutée. Le port est strict et l’index effectivement servi est comparé au pin avant Chromium. Chaque réexécution doit choisir un nouveau dossier de sortie ; un dossier existant n’est pas écrasé.

Après GO, renseigner les deux variables à partir du nouveau gel communiqué par root ; aucun ancien pin n’est repris automatiquement :

```sh
node docs/qa/pr3-next-20261028/resource-restarts/harness.mjs \
  --expected-index "$FINAL_INDEX_SHA256" \
  --expected-source "$FINAL_SOURCE_COMMIT" \
  --output /workspace/qa/pr3-next-20261028/resource-restarts-final
```

La configuration fixe est City Hunter, Los Angeles, sandbox, un ennemi, qualité basse et viewport 480×320. Chaque cycle construit une vraie mission, attend les imports, termine la vraie insertion par des updates assistées, simule 0,25 seconde de jeu, rend la scène active, appelle `returnToMenu`, rend deux fois le nettoyage puis mesure le heap après GC CDP explicite. Il n’y a ni invincibilité, ni remplacement des dégâts, ni victoire revendiquée. Le RNG natif reste actif et les types adverses sont consignés.

Cinq échauffements sont retenus par défaut pour cette configuration répétée et pour limiter le coût sous SwiftShader. Ce choix n’implique pas que les caches aient forcément fini de chauffer : les **dix** mesures suivantes doivent toutes être strictement identiques pour chaque compteur GPU et chaque compteur de scène retenu. Toute variation est conservée et fait échouer ce constat ; la fenêtre n’est pas raccourcie ni déplacée après coup. `--warmups` accepte de 2 à 20 si le coordinateur choisit un autre plan avant une nouvelle passe.

Les textures réellement utilisées par les matériaux du corps importé sont suivies par UUID : mêmes UUID pendant les dix missions, dimensions positives, upload WebGL présent et aucun événement dispose, y compris après retour au menu. Les diagnostics conservent uniquement des WeakSet/WeakRef vers les ressources et des chaînes d’UUID partagés ; les textures procédurales détruites à chaque cycle n’ajoutent pas une liste persistante d’UUID. Aucun graphe Three.js ou résultat d’import n’est retourné au processus Node. Le délai perdant de chargement est annulé dans `finally`, ses références sont vidées, les entrées de console CDP sont libérées avant GC et le watchdog est annulé à la fermeture.

Le cache `horde._livingPlayers`, le joueur courant et les acteurs des managers doivent être vides après nettoyage. Les comptes de géométries, textures, programmes, nœuds, matériaux et événements dispose sont consignés séparément. Les caches et le niveau conservé derrière le menu restent inclus ; ils ne sont pas artificiellement vidés par le harness.

Le heap GC est une observation CPU bornée à cette fenêtre. Sa variation exacte est publiée même si les compteurs de ressources passent ; aucune stabilité générale du heap n’est inférée. Les compteurs du renderer ne donnent pas les octets de VRAM. Aucun test humain, performance matérielle, normalité de toutes les parties, absence générale de fuite ou fidélité visuelle 1:1 n’est certifié.

Les contrôles de préparation sont exclusivement CPU :

```sh
node --check docs/qa/pr3-next-20261028/resource-restarts/harness.mjs
node --check docs/qa/pr3-next-20261028/resource-restarts/harness-lib.mjs
node --test --test-concurrency=1 docs/qa/pr3-next-20261028/resource-restarts/cpu-checks.mjs
```
