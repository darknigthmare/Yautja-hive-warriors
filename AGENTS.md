# Développer Yautja Hive Warriors

Ces consignes concernent `darknigthmare/Yautja-hive-warriors`, le jeu d'action 3D dans le navigateur. Les demandes de l'utilisateur et les contrats du code priment sur les exemples génériques des guides.

## Retrouver la bonne base

- Lire `REPRISE.md`, `docs/DEPTH-RELEASE-20261028.md`, puis la documentation du système modifié.
- La base gameplay examinée le 29 octobre 2026 est `codex/depth-pr3-20261028` à `e66e51e9759db970dec30fba51bade16c0873d26`. Le contrôle documentaire du 27 octobre vient de `codex/complete-pr3-20261026` à `2fa875e0cbf80d42a0d197874dbb9b24131882fd`.
- Cette intégration conserve le gameplay de la première branche et les trois fichiers de l'audit de la seconde. Pour une reprise ultérieure, vérifier les références Git présentes : cette photographie ne remplace pas une vérification de leur évolution.
- `master`, `main`, la branche de développement et le site Vercel peuvent avoir des contenus différents. Une date de commit de fusion ou une URL publique ne suffit pas à identifier le dernier gameplay.

## Moteur et guides

Le projet utilise JavaScript ES modules, Three.js et Vite. Lire `package.json` et `package-lock.json` avant de choisir une API. Au point de départ vérifié : Three.js **0.160.1 / r160**, Vite **8.3.4**, Playwright **1.64.1** ; Node 24 recommandé par `.nvmrc` et le README.

Utiliser [le mode de travail](docs/development/GAMEDEV-WORKFLOW.md) et [le registre des sources épinglées](docs/development/gamedev-guides.lock.json). Ce registre renvoie à des guides externes consultés à la demande ; il ne déclare aucune installation globale.

Avant un chantier, choisir le plus petit ensemble pertinent, annoncer son usage, puis lire les fichiers sources épinglés. Les guides Three.js externes ciblent r186 : adapter leurs principes au code r160 et vérifier chaque API. Une migration de moteur, de version ou vers WebGPU constitue un chantier distinct, à justifier dans son propre périmètre.

| Chantier | Guides à consulter | Points d'entrée existants |
| --- | --- | --- |
| Rendu, boucle, ressources | `threejs-scene-setup`, `performance-optimization` | `js/engine/Renderer.js`, `FrameTelemetry.js`, `SceneResources.js` |
| Simulation, groupes, décisions | `game-ai` ; ajouter `ai-behavior-trees-utility-ai` si le changement le nécessite | `js/battlefield/BattleSimulation.js`, `BattleStrategy.js`, `BattleActorBridge.js` |
| Cartes et déplacement | `level-design`, `game-ai` ; `physics-tuning` pour les contacts | `js/engine/BattlefieldNavigation.js`, `js/data/BattlefieldMapVariants.js` |
| Combat, boss, retours | `game-feel` ; `camera-systems` ou `audio-design` selon le besoin | `js/engine/CombatDirector.js`, `js/entities/Bosses.js`, `js/battlefield/BossPhasePressure.js` |
| Modèles et équipements | `create-game-assets`, `threejs-gltf-loading` | `js/graphics/GeneratedAssetManifest.js`, importeurs existants et `docs/meshy/` |
| Sauvegarde et reprise | `save-systems` | `js/battlefield/BattleCampaignRecord.js`, `OperationPlayerState.js`, `js/ui/storage.js` |
| Commandes et HUD | `input-systems`, `game-ui-ux` | `js/engine/GamepadControls.js`, `GamepadGameBridge.js`, `js/ui/UIManager.js` |
| Variantes de terrain | `procedural-gen`, `level-design` | `js/data/BattlefieldMapVariants.js`, `js/graphics/WorldGeometryStreaming.js` |

Le catalogue externe ne fournit pas de système musou prêt à intégrer. Conserver la structure du projet et ses règles de faction ; utiliser les guides comme méthode de développement.

## Contrats du jeu à préserver

1. **Identités et effectifs finis.** La simulation possède les unités ; leur représentation locale conserve leurs identifiants, PV, pertes, ressources et phases. Un changement de secteur ou une reprise ne doit ni dupliquer un soldat, ni ressusciter un mort, ni inventer un renfort.
2. **Détail et armée globale.** Le plafond courant de 32 acteurs détaillés est distinct des unités simulées à distance et des réserves. Il est provisoire et n'est pas une mesure de capacité matérielle. Garder les budgets sources ; toute modification du plafond demande une comparaison reproductible.
3. **Stratégie.** La difficulté tactique change décisions et délais, sans modifier les allocations, identités, PV ou dégâts. Une reconstitution après retraite mobilise des réserves déjà allouées ; les renforts combattent aux côtés des survivants et conservent leurs identités.
4. **Factions.** Distinguer espèce, faction, clan, rôle, incarnation et continuité. USCM, USM, humains civils, forces corporatives et synthétiques ne sont pas interchangeables. La ruche utilise une coordination, pas une peur humaine implicite.
5. **Géométrie et gameplay.** Relier routes, rampes, plafonds, couvertures, obstacles et accès aériens au déplacement et aux tirs réels. La décoration seule ne prouve pas qu'un lieu est construit ou praticable.
6. **Combat lisible.** Préserver les annonces, fenêtres d'attaque, interruptions et budgets d'engagement du `CombatDirector`, ainsi que leur comportement en coopération. Un nouvel effet ne doit pas masquer l'attaque ni bloquer globalement chaque impact d'une foule.
7. **Persistance.** Conserver blessures, secours, boss, objectifs, consommables, appuis finis et terrains modifiés après éloignement et sauvegarde. Vérifier l'identité du propriétaire des ressources lors du nettoyage.
8. **Fidélité.** Rattacher chaque ajout à sa source et à son incarnation ; expliciter l'adaptation de gameplay. Une fiche du catalogue, un fichier GLB ou un test réussi ne certifie pas une fidélité 1:1.

## Suivi et validation

- L'audit du 26 octobre est une source historique ; le suivi courant est `docs/audits/2026-10-26/implementation-progress.json`. Préserver les 126 identifiants et leurs critères. Utiliser le writer existant pour les seules cellules de suivi autorisées `N7:N132`, colonne `Suivi` de la feuille `Manquants`.
- L'audit de complétude du 27 octobre est un document distinct. Ses 270 fiches ne constituent pas 270 combattants intégrés. Sa conservation ne met pas automatiquement à jour ses anciens constats de code.
- Reproduire le comportement concerné, modifier le système qui en est propriétaire, puis vérifier le cas réel et les régressions pertinentes. Réutiliser les tests existants ; ajouter un test seulement s'il couvre un risque concret.
- Pour un changement exclusivement documentaire : vérifier sources, chemins, JSON et diff. Ne pas relancer toute la QA ni prétendre à de nouvelles performances.
- Pour le gameplay : `npm ci` si nécessaire, tests Node ciblés, puis build et scénario navigateur pertinent. `npm test` lance le build puis la suite existante en série ; l'utiliser pour une intégration qui justifie ce périmètre.
- Pour catalogue/suivi : `node scripts/sync-battle-catalog.mjs --check` et `python3 scripts/update-audit-progress.py --check`, avec les tests concernés.
- Pour les performances : conserver scénario, graine, réglages, machine, navigateur, commit et échauffement. Comparer avant/après sur la même base. `FrameTelemetry` fournit des temps CPU, intervalles d'image et compteurs ; `gpuTimeAvailable: false` interdit d'en déduire un temps GPU.
- Rapporter séparément tests exécutés maintenant, preuves archivées, parcours assistés, revue visuelle et mesure matérielle. Un contrôle `READY` ou un build réussi ne valide pas un combat.
- Pour une publication autorisée, suivre les scripts et preuves de livraison existants. L'échec de quota du 28 octobre dans `REPRISE.md` est historique : vérifier l'état actuel avant de reprendre, sans effacer les registres ni contourner leurs gardes.
