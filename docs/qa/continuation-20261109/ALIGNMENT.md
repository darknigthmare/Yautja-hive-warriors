# Alignement des sources — 9 novembre 2026

La lecture porte sur les documents du worktree repris par le coordinateur, après consolidation de la continuation du 2 novembre, des fusions récentes de développement et des consignes d'outillage du dépôt. L'[inventaire](alignment-sources.json) conserve 23 chemins, leurs tailles et SHA-256, les feuilles des trois classeurs et les critères pertinents. Cette revue n'a exécuté ni Git, build, navigateur, publication ou commande Meshy.

Le contrat de conception présent est [MUSOU-GAMEPLAY-CONTRACT.md](../../development/MUSOU-GAMEPLAY-CONTRACT.md) : action Musou, fronts autonomes, identités finies et deux combattants en coopération. Extinction fournit des contenus et propriétés de créatures ; il n'introduit pas une boucle de STR. Aucun autre document nommé « bible » n'a été identifié dans les sources examinées ; le coordinateur demande son chemin à l'utilisateur. Il ne faut pas présenter ce document éventuel comme lu.

Les **126 identifiants et critères** du suivi actuel correspondent exactement au classeur source du 26 octobre. Les 126 cellules de suivi du classeur de travail correspondent au JSON courant : **78 terminés, 36 à valider, 12 en cours**. Le classeur source est conforme à son SHA déclaré. Le contrôle distinct du 27 octobre reste à **270 fiches documentaires et 132 contrôles** ; ses anciens statuts ne sont pas remplacés par ceux du suivi courant. Les CSV contiennent 27 opérations, 29 profils Extinction, 14 exigences M577/Cheyenne et 773 références partagées. Ces lignes ne comptent pas des modèles rendus.

Quatre travaux bornés prolongent les manques effectivement conservés dans les preuves précédentes :

| Travail | Critères concernés | Résultat précis à rechercher |
| --- | --- | --- |
| Briefing et HUD LV-742 | AUD-103, AUD-032 | Distinguer les fronts malgré leurs longs noms ; faire correspondre le terrain visuellement sélectionné au terrain réellement lié à AFF-27 ; vérifier les vraies sélections à 800×600 et 1280×720. |
| Lâcher autonome du Carrier | AUD-025, AUD-024 | Observer le callback naturel de la Horde sur une cible hostile éligible dans ses bornes tactiques, puis le vol et l'atterrissage d'un des six UID existants, sans demande explicite de lancement. |
| Reprise de catalepsie du Ravager | AUD-014, AUD-091 | Sauvegarder puis réellement recharger la phase dans le navigateur ; conserver UID, PV, échéance, usage consommé et retour fini, puis vérifier la mort par feu unique. |
| Caméra à l'insertion Val Verde | AUD-104, AUD-067 | Contrôler la visibilité du joueur et de la première route avec la caméra normale autour du toit au premier plan, à l'arrivée, l'ouverture et la sortie de capsule. |

Le cas Carrier est d'abord **un manque de preuve**. Le code courant appelle déjà le lancement dans `XenomorphHorde.update`. La capture du 2 novembre avait observé un seul tick sans demande, sans relever les bornes de formation/défense de sa cible d'inspection. Elle ne confirme pas un défaut d'IA. La reproduction doit enregistrer ces conditions avant d'envisager un changement ; élargir les enveloppes pour faire passer la capture fausserait le diagnostic.

Le cas Ravager précédent écrit un véritable checkpoint de phase mais ne le recharge pas dans cette même observation rendue. Le compléter ne nécessite pas de modifier une persistance qui fonctionne déjà dans les tests CPU. Les limites de lisibilité LV-742 et de toit Val Verde sont, elles, explicitement observées dans les revues rendues du 2 novembre.

Aucun statut n'est fermé par cet inventaire. Chacun de ces travaux ne couvre qu'une partie du critère global : tous les profils visuels, toutes les castes, toutes les combinaisons d'effets, tous les passages et toutes les phases de boss restent des périmètres distincts. Zéro testeur humain, aucune certification de fidélité 1:1 ou de performance matérielle.
