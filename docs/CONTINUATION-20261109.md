# Continuation du 9 novembre 2026

Cette passe reprend la continuation GitHub `d08efe97f47bf2f4fcd8cf89f50f56aa1c9d9581`, puis conserve les fusions de développement `3fed0a1521035f10f5d0ac72e88c9473fba78b32`, les outils du dépôt `aa0048d52eb05624eccab45fa98de16e31a15c4d` et la provenance Yautja `9ea0f7313403127516e1874346ba61f5bad283b9`. La branche de travail est `codex/continuation-20261109`. Une date de fusion ne remplace pas l'identification du gameplay ; `master` et `main` ne contiennent pas seuls la dernière continuation.

Le [contrat Musou](development/MUSOU-GAMEPLAY-CONTRACT.md) reste la référence de conception trouvée dans les branches récupérées. L'[inventaire des sources](qa/continuation-20261109/alignment-sources.json) et sa [revue](qa/continuation-20261109/ALIGNMENT.md) rapprochent les Excel, les JSON et les registres CSV effectivement présents. La recherche a ensuite retrouvé dans le dépôt lié Alien_base un [référentiel de continuité ajouté le 8 novembre](development/CANON-REFERENCE-20261108.md), avec 912 notices et six catalogues CSV ouvrables dans Excel. Ses règles ont été lues et rapprochées des corrections ; aucun conflit n’a été relevé. Il ne s’agit pas d’une bible de conception spécifiquement attribuée à ce jeu, et ses notices ne deviennent pas de nouvelles unités.

Les travaux prolongent quatre manques précis de la passe précédente, avec les propriétaires existants :

- Briefing et petits plans : noms de fronts LV-742 lisibles et terrain sélectionné cohérent avec l'opération réelle.
- Carrier : observer la chaîne autonome complète, du ciblage de la Horde au rendu après synchronisation, sans élargir les portées ni créer de parasites.
- Ravager : compléter la preuve rendue par un véritable rechargement du checkpoint de catalepsie.
- Insertion : appliquer les contacts physiques à chaque caméra pendant l'ouverture et la sortie de capsule, sans retirer les branches ou les toits.

Le [rapprochement Alien_base](../ALIEN_BASE_INTEGRATION.md) conserve les sept kits et les 36 entrées d'armurerie actuels. Les 43 identités et 14 références sur douze fiches sont des métadonnées non énumérables, profondément immuables. Leur ajout conserve strictement la sérialisation existante. Le pont de provenance Yautja et le registre public de 773 références gardent leurs espaces de noms et leurs rôles distincts.

Les douze GLB présents ont été [vérifiés contre le manifeste courant](qa/continuation-20261109/model-manifest-check.json) : 264107636 octets, en-têtes et SHA-256 conformes. Aucun nouveau modèle ni crédit Meshy n'est consommé. Aucun testeur humain, fidélité visuelle 1:1 ou résultat de performance sur matériel joueur n'est revendiqué.

Le suivi historique reste à 78 critères terminés, 36 à valider et 12 en cours. Les critères et les quatre sources historiques sont conservés. Les sous-cas de cette passe ne suffisent pas à clôturer globalement toutes les cartes, castes, interfaces, effets ou caméras.

L'état des contrôles de cette nouvelle passe sera consigné avec leurs véritables commits, empreintes, scénarios et assistances. Les résultats de novembre 2 restent des archives ; ils ne sont pas attribués au nouveau build.


## Résultat vérifié

Le code final est `4ecac297e82a84c18e8b968ffbcea0c3693d29ba`. Son build propre porte l’index `70067415028edf40bac7085f72b56a43037f55deae2de7b332524e8f7012795a` et le fingerprint `a214c05a3ad459495d24cd3028e058106b57632aad6a24811b3b8456053f92f5`, pour 193 sources. La [régression finale sélectionnée](qa/continuation-20261109/integration-rescue-fix/cpu-regression.json) passe **300/300 tests dans 39 fichiers**, sans saut ni annulation. Les 13 tests d’outillage ont également été exécutés ; les résultats ciblés des propriétaires se recouvrent avec cette régression et ne sont pas additionnés artificiellement.

Le premier build `94630d8` avait passé ses 275 tests sélectionnés mais échoué à la vraie reprise Ravager. Le [système de secours](qa/continuation-20261109/rescue-phase/README.md) rejetait la catalepsie validée comme un allié sans minuteur ; il pouvait aussi prendre sa posture et ses PV à la rematérialisation. Le propriétaire de phase signé reste désormais seul responsable de cette incapacité. Les faux dossiers médicaux, phases invalides et véritables alliés orphelins restent refusés. La baseline reproduite et le build rejeté restent conservés.

Le [run navigateur final](qa/continuation-20261109/runtime-attempts/runtime-4ecac29-r5/report.json) passe **trois cas dans une seule exécution**, en 179,928 s :

- Les vrais menus AFF-27 et leurs quatre briefings standard/amélioré × deux résolutions conservent les descriptions complètes et la navigation clavier. L’insertion coop réelle de Val Verde conserve ses deux caméras physiques. Le pilote garde ses 132 UID, son ordre, ses ressources et son horloge à la reprise.
- Le Carrier acquiert une cible par 63 vraies mises à jour du jeu, puis consomme un seul des six parasites déjà alloués. Son vol reste au-dessus du sol après la synchronisation, s’arrête en pause et rejoint exactement sa destination. Les 952 UID AFF-27 et le plafond de 32 acteurs sont conservés.
- Le Ravager reprend réellement après rechargement de page et menus : 50 PV, même UID, upgrade consommé et échéance 12,25 s. La rematérialisation conserve sa phase ; le réveil restaure 500 PV, puis le feu produit une seule mort et le nettoyage libère ses acteurs.

Les quatre tentatives précédentes restent globalement en échec dans leurs archives. Les corrections de fixtures End/Home et retour de carte sont déclarées. Le placement précédent du Carrier provoquait sa sortie normale du rendu ; la nouvelle observation respecte ses bornes et sa sélection réelle. Aucun de ces résultats n’est réattribué au nouveau code.

La revue des captures conserve des réserves : toit au premier plan à l’insertion, prompts superposés, pose cataleptique restaurée partiellement masquée par le joueur et la capsule, silhouettes procédurales. Les mesures et captures valident les mécanismes bornés décrits, sans clôturer leur fidélité visuelle globale. Aucun déploiement n’a été soumis dans cette passe.
