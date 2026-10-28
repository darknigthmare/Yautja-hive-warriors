Le contrôle PUBLIC NEXT est préparé et **attend le GO après la publication finale sur Vercel**, puis la remise exclusive de Chromium. Aucun navigateur ni appel réseau n’a été lancé pendant cette préparation. Les instructions suivantes ne constituent pas un résultat de QA publique.

Le harness [verify-public.mjs](verify-public.mjs) reprend les 21 contrôles de la publication précédente et ajoute le compteur exact « N FRONTS · RÉSERVES FINIES » après trois secondes d’updates normaux. Les états du corps importé et du masque sont enregistrés. L’invisibilité à l’arrivée, l’ouverture/sortie, 1000 HP conservés, des acteurs matérialisés supérieurs à zéro, le plafond de 32 et la conservation des 132 identités sont contrôlés. L’ordre défensif sur la carte, la photo O, la sauvegarde et le retour au menu utilisent leurs véritables contrôles UI. Les aides de simulation et de focus restent déclarées dans le rapport.

Après le GO de publication et le créneau Chromium exclusif, exécuter depuis `/workspace/Yautja-next-20261028` avec les empreintes du build final :

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
