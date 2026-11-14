Le contrôle PUBLIC NEXT est préparé, puis **gelé par le quota quotidien Vercel** `api-deployments-free-per-day` : le fournisseur a refusé la première tentative de déploiement NEXT après dépassement de la limite gratuite de 100 déploiements API par jour. Aucun ID de déploiement de production NEXT n’a été créé et aucune promotion n’a eu lieu. Ces informations sont transmises par root ; cette préparation n’a lancé aucun appel Vercel, réseau public ou Chromium.

La version publique précédemment vérifiée reste `48b5bd5aa9d35fd3919ade38cf2aef55389bec5b`, avec l’index SHA256 `124d7735003c245bc60814e6004c35ace77bd4011b31d448a6aa6c4c41dad185`. La nouvelle source `5089228a12ac2985ef03e72782fd29e8687f6b33` **n’est pas publiée en production**. Le [statut de préparation](pending-publication.json) conserve donc `deployment: null` et `result: null`.

Une preview Git distincte existe : `dpl_3cEiD4t4XxRBVHqhrXU7bU4c51x5`, [yautja-hive-warriors-qd6rxocpz-darknigthmares-projects.vercel.app](https://yautja-hive-warriors-qd6rxocpz-darknigthmares-projects.vercel.app). Root l’a observée en lecture seule à l’état **QUEUED**, en file depuis 10:22 UTC. Elle n’est ni READY, ni validée, ni candidate à la production. Aucun contrôle public NEXT n’a été exécuté et aucun résultat public n’est revendiqué pour cette preview.

Le harness [verify-public.mjs](verify-public.mjs) conserve la préparation des **22 contrôles** : les 21 de la publication précédente et le compteur exact « N FRONTS · RÉSERVES FINIES » après trois secondes d’updates normaux. Lors d’un futur passage autorisé, les états du corps importé et du masque seront enregistrés. L’invisibilité à l’arrivée, l’ouverture/sortie, 1000 HP conservés, des acteurs matérialisés supérieurs à zéro, le plafond de 32 et la conservation des 132 identités seront contrôlés. L’ordre défensif sur la carte, la photo O, la sauvegarde et le retour au menu utiliseront leurs véritables contrôles UI. Les aides de simulation et de focus seront déclarées dans le rapport.

Ne pas exécuter le contrôle pendant ce blocage. Uniquement après le GO de root suivant une véritable promotion Vercel et la remise exclusive de Chromium, exécuter depuis `/workspace/Yautja-next-20261028` avec les empreintes du build final :

```sh
NODE_USE_ENV_PROXY=1 node docs/qa/pr3-next-20261028/public-live/verify-public.mjs \
  --commit SOURCE_SHA40 \
  --index-sha256 INDEX_SHA64 \
  --build-info-sha256 BUILD_INFO_SHA64 \
  --deployment dpl_ID
```

Ajouter `--check-config` valide les paramètres sans réseau, navigateur ou écriture. `--help` décrit les options. Les paramètres sont obligatoires ; aucun ancien commit ou hash n’est utilisé par défaut. La cible est fixée à `https://yautja-hive-warriors.vercel.app`. Le dist local doit lui aussi correspondre aux paramètres explicites avant l’ouverture du navigateur.

Le passage produit un rapport JSON borné, un maximum de deux captures cibles, les compteurs d’erreurs JS/HTTP/réseau/externe et la preuve d’intégrité du dist. La clé publique de la CA configurée du proxy est épinglée ; les vérifications globales de certificats et TLS restent actives. Chromium est fermé dans le bloc de nettoyage, même en cas d’échec. Aucun graphe Three.js n’est sérialisé. Le passage ne modifie ni runtime, ni Git, ni build, ni déploiement ou autre service distant ; la sauvegarde de test est dans le stockage local du contexte de navigateur jetable.

Les résultats ne revendiquent aucun testeur humain, FPS matériel, fidélité 1:1 ou victoire complète.
