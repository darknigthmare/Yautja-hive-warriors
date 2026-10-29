# Développer Yautja Hive Warriors avec les guides gamedev

## 1. Périmètre et références

Ce document adapte des méthodes de développement aux systèmes du jeu déjà présents.
Il sert à choisir un chantier, préserver ses contrats et produire une preuve vérifiable.
L'ajout de ce guide ne modifie ni le gameplay ni un déploiement Vercel.

| Référence | État retenu |
| --- | --- |
| Base de gameplay | `e66e51e9759db970dec30fba51bade16c0873d26` |
| Complément d'audit conservé | Trois fichiers repris à l'identique de `2fa875e0cbf80d42a0d197874dbb9b24131882fd` |
| Three.js verrouillé | `0.160.1`, révision `r160` |
| Vite verrouillé | `8.3.4` |
| Environnement recommandé | Node.js 24 ; respecter le verrouillage des dépendances |
| Guides gamedev de référence | Commit `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9` |

Relire les métadonnées du dépôt avant un prochain changement : ces références décrivent cette intégration.
Le catalogue gamedev ne fournit pas de guide musou ni de simulation Alien/Predator prête à intégrer.
Les règles de bataille, de factions et de continuité ci-dessous restent propres à ce projet.
Le fichier REPRISE évoquant un quota le 28 octobre est un historique, pas une preuve d'accès actuelle.

## 2. Choisir les guides selon le changement

Lire seulement les guides utiles au chantier ; leurs exemples doivent être adaptés à Three.js r160.
Les guides Three.js amont ciblent r186 : leurs nouvelles API ne sont pas présumées disponibles dans le jeu.
Ne pas remplacer une API fonctionnelle ni changer de moteur pour correspondre à un exemple amont.
Une migration de dépendance demande un chantier distinct, avec ses effets et sa validation explicites.

| Chantier | Guides à consulter | Application au jeu |
| --- | --- | --- |
| Identifier le moteur et la tâche | [Routeur][router] | Conserver la stack et le point d'entrée réels |
| Décisions et déplacements | [Game AI][ai] | Séparer intentions, navigation et exécution |
| Choix complexes des unités | [Arbres et Utility AI][utility] | États persistants, priorités et décisions stables |
| Densité et temps d'image | [Performance][performance] | Mesurer le coût avant de choisir une optimisation |
| Secteurs et affrontements | [Level design][levels] | Vérifier accès, distances et objectifs avant décoration |
| Impacts et lisibilité | [Game feel][feel] | Retour proportionné à l'événement sans bloquer les commandes |
| Castes, équipements et décors | [Création d'assets][assets] | Manifeste, familles visuelles et contrôle dans le jeu |
| Boucle et résolution du rendu | [Scène Three.js][three] | Traduire les recommandations vers les API de r160 |
| Reprise de partie | [Sauvegardes][saves] | État versionné et restitution des identités |

Les guides n'établissent ni l'exhaustivité du contenu ni sa fidélité à une œuvre.
L'apparence doit être contrôlée sur références et à l'échelle du jeu ; ne pas certifier une fidélité 1:1 sans preuve.

## 3. Contrats des systèmes existants

| Système | Responsabilité à préserver | Contrôle attendu lors d'une modification |
| --- | --- | --- |
| `BattleSimulation` | État, décisions et objectifs des forces de bataille | Fronts explicables ; identités, morts, pertes et réserves cohérentes |
| `BattleStrategy` | Paramètres de difficulté et délais de reprise des fronts | Allocations inchangées, délai compatible avec les routes |
| `BattleActorBridge` | Correspondance entre simulation et acteurs détaillés | Aucun doublon ou changement d'identité lors des transitions |
| `CombatDirector` | Orchestration des affrontements et de leur pression | Déclenchements bornés et retour à un état stable |
| `BattlefieldNavigation` | Itinéraires et déplacement sur le champ de bataille | Obstacles respectés ; blocages détectables et récupérables |
| `BossRegistry` / `BossPhasePressure` | Définition des boss et pression de leurs phases | Phase, mort et réinitialisation cohérentes |
| `FrameTelemetry` / `Renderer` | Observation du temps d'image et rendu | Mesures contextualisées, sans confondre logique CPU et coût graphique |
| `WorldGeometryStreaming` | Présence de la géométrie selon les secteurs | Aucun trou de parcours ou raccord visuel après déplacement |
| `GeneratedAssetManifest` | Traçabilité des ressources générées | Entrée reliée à un fichier utilisable et à son état de validation |

Ces responsabilités guident les changements ; vérifier les interfaces réellement présentes avant de les modifier.
Ne pas créer un second gestionnaire d'état lorsque l'un de ces systèmes possède déjà la donnée concernée.

### Identités, effectifs et fronts

- Le plafond actuel est de **32 acteurs détaillés** ; ce n'est pas le total de troupes simulées.
- Comptabiliser séparément acteurs détaillés, unités simulées, réserves et pertes.
- Entrer dans un secteur matérialise des unités existantes ; cela ne crée pas de nouvelles identités de troupe.
- Sortir du secteur ne ressuscite pas les morts et ne remet pas les réserves à leur valeur initiale.
- Un événement de renfort mobilise des unités déjà allouées dans une réserve identifiée, sans accroître le budget.
- Les allers-retours entre secteurs ne doivent produire ni renforts infinis ni récompenses répétées.
- Le résultat d'un front éloigné doit rester explicable par l'état et les règles de simulation.
- Toute augmentation du plafond détaillé constitue un changement mesuré, pas un simple ajout de contenu.

### Difficulté et cohérence des comportements

- Faire varier la difficulté par les décisions, la coordination et les délais d'action.
- Ne pas la modifier indirectement en gonflant PV, dégâts ou effectifs.
- Pour la ruche, modéliser la coordination et les priorités ; ne pas lui appliquer une peur humaine générique.
- Séparer faction, clan, caste, rôle tactique et continuité : ce ne sont pas des champs interchangeables.
- Garder les choix d'équipement et d'alliance compatibles avec la situation et la continuité retenues.
- Associer à chaque entrée une source vérifiable, sa continuité et un statut d'adaptation.
- Un élément proposé sans source doit rester signalé comme création ou adaptation, jamais comme fait canonique.

## 4. Boucle de travail pour chaque chantier

1. Identifier le commit de départ, les fichiers concernés et les changements déjà en cours.
2. Lire l'interface du système propriétaire et les tests existants qui couvrent le comportement visé.
3. Décrire le problème observé ou le manque précis, avec un scénario pour le retrouver.
4. Choisir le guide pertinent et écrire les critères d'acceptation avant de modifier le comportement.
5. Réaliser le plus petit changement cohérent dans les systèmes existants.
6. Exécuter les vérifications proportionnées au risque et noter leurs résultats exacts.
7. Mettre à jour le suivi avec la preuve : fichier, test, capture ou mesure selon le cas.

Une fiche de travail doit contenir : objectif, système propriétaire, invariants, scénario, résultat et limite restante.
Une refonte, un changement de moteur ou une hausse de densité ne sont pas des prérequis implicites.
Un modèle d'IA complexe n'est utile que si les décisions attendues dépassent les états déjà disponibles.
Découpler la fréquence des décisions de celle du rendu lorsque les mesures justifient ce changement.
Réutiliser les chemins valides et contrôler les blocages avant d'ajouter une nouvelle couche de navigation.

## 5. Suivi de contenu et historique Excel

Conserver le suivi historique du **26 octobre 2026** et ses identifiants.
Utiliser `docs/audits/2026-10-26/implementation-progress.json` pour consigner l'évolution des réalisations et leurs preuves.
Le writer du classeur historique reste limité aux cellules **`N7:N132`**, colonne **`Suivi`** de la feuille **`Manquants`**.
Ne pas modifier d'autres cellules, formules, feuilles ou états historiques par effet de bord.
Vérifier la plage réellement modifiée avant d'annoncer une mise à jour du classeur.

L'audit du **27 octobre 2026** compte **270 fiches** : ce nombre ne décrit pas 270 éléments rendus et jouables.
Ses trois fichiers sont conservés à l'identique avec la base de gameplay ; leurs anciens constats ne sont pas réévalués par cette intégration documentaire.
Garder une correspondance explicite entre fiche, identifiant de contenu, fichiers et preuve d'intégration.

Les niveaux ci-dessous expliquent la nature des preuves. Ils ne remplacent pas les statuts existants du registre : `À faire`, `En cours`, `À valider`, `Terminé`, `Bloqué`.

| Niveau de réalisation | Preuve minimale |
| --- | --- |
| Prévu | Besoin décrit, source et critères définis |
| Données ajoutées | Identifiant et définition présents, contrôlés contre les doublons |
| Intégré | Ressource ou logique effectivement référencée par le jeu |
| Jouable | Scénario exécuté jusqu'au résultat attendu |
| Vérifié | Résultat documenté et périmètre du contrôle indiqué |

Une fiche, une entrée de manifeste ou une image générée ne suffit pas à établir les deux derniers états.
Conserver séparément complétude des données, qualité visuelle, jouabilité et performances.

## 6. Scénario de référence proposé

Cette section définit une **méthodologie à exécuter** ; elle ne rapporte aucune mesure déjà réalisée.
Choisir dans les données existantes une carte et une configuration autorisant trois factions et deux fronts.
Si aucune configuration ne le permet, consigner ce manque avant de créer un scénario adapté.

### Préparer une exécution reproductible

- Noter commit, carte, scénario, difficulté, paramètres de rendu et version de sauvegarde.
- Fixer la graine si le système l'expose ; sinon conserver l'état initial et documenter l'aléa restant.
- Choisir un camp yautja, une ruche et une force humaine identifiée : USCM ou Weyland selon la continuité.
- Définir deux objectifs simultanés : front A suivi par le joueur, front B observé dans la simulation.
- Enregistrer identifiants, effectifs initiaux, réserves, objectifs et boss sélectionné dans le registre.
- Décrire le trajet et les actions du joueur pour pouvoir répéter la même séquence.

### Séquence de validation

1. Démarrer au front A et contrôler l'état initial des trois camps.
2. Déclencher un affrontement et un renfort prévu ; relever leur origine et les réserves restantes.
3. Rejoindre le front B pendant que le front A continue d'évoluer.
4. Revenir au front A et comparer identités, morts, pertes, objectifs et réserves.
5. Répéter un aller-retour pour rechercher un doublon ou une réinitialisation indue.
6. Déclencher le boss prévu, traverser ses phases puis vérifier sa mort et la fin de sa pression.
7. Sauvegarder à un point défini, recharger et comparer les états persistants attendus.
8. Atteindre une issue de bataille, puis relancer pour vérifier la remise à zéro de la nouvelle session.

Contrôler les acteurs détaillés à chaque étape : le plafond de 32 reste distinct des effectifs de simulation.
Comparer les fronts selon leurs règles, sans exiger une identité de résultat si l'aléa n'est pas maîtrisé.
Documenter tout écart de sauvegarde : donnée volontairement transitoire ou défaut de restitution.

### Mesurer sans surinterpréter

- Utiliser une phase d'échauffement après le chargement des ressources avant la fenêtre de mesure.
- Répéter la même durée de parcours et conserver les pics, pas seulement une moyenne de FPS.
- Relier les observations de `FrameTelemetry` au nombre d'acteurs détaillés et au contexte du rendu.
- Séparer temps de simulation CPU, soumission graphique et coût GPU quand les outils les exposent.
- Une mesure CPU seule ne prouve ni fluidité du rendu ni respect d'un budget GPU.
- Une baisse de résolution ne résout pas un coût dominant de décisions ou de navigation CPU.
- Comparer avant/après sur le même matériel, navigateur, résolution et configuration.
- Si le matériel cible n'est pas disponible, indiquer cette limite au lieu de généraliser le résultat.

## 7. Validation proportionnée et compte rendu

Pour ce patch documentaire : relire liens, versions, contrats et cohérence avec les sources du dépôt.
Ne pas ajouter de script ni de test uniquement pour recopier ou valider le texte de ce guide.
Pour une modification de logique : commencer par les tests existants liés au système concerné.
Pour une modification de scène, caméra, interface ou asset : ajouter une inspection dans le navigateur.
Pour une affirmation de performances : produire une mesure sur matériel identifié et scénario documenté.
N'étendre les tests que pour résoudre un risque restant ou satisfaire une vérification requise du dépôt.

### Tests existants à sélectionner

Ces correspondances orientent la lecture des tests ; elles ne déclarent aucune nouvelle exécution.

| Contrat modifié | Fichiers de test existants dans `tests/` |
| --- | --- |
| Allocation, fronts, projection et difficulté | `battle-simulation.test.js`, `battle-actor-bridge.test.js`, `battle-strategy-depth.test.js` |
| Routes, surfaces et variantes | `world-depth-seeds.test.js`, `reference-walk-surfaces.test.js`, `helipad-navigation-regression.test.js` |
| Boss et persistance des phases | `boss-preflight-depth.test.js`, `boss-counterplay-depth.test.js`, `boss-engine-checkpoint.test.js` |
| Secours et ressources d'appui | `ally-rescue.test.js`, `finite-supports.test.js` |
| Mesures et nettoyage | `frame-telemetry.test.js`, `world-depth-streaming.test.js`, `horde-player-cache-release.test.js` |
| Manette et interface | `gamepad-controls.test.js`, `gamepad-menu-roots.test.js`, `battlefield-hud.test.js` |
| Catalogue et suivi | `battle-catalog.test.js`, `audit-progress.test.js` |

| Type de preuve | Ce qu'elle permet d'affirmer | Ce qu'elle ne suffit pas à affirmer |
| --- | --- | --- |
| Tests de logique CPU | Contrats testés et absence des régressions couvertes | Qualité visuelle ou fluidité graphique |
| Exécution dans un navigateur | Parcours exécuté et rendu observé dans cet environnement | Performances sur tous les matériels |
| Mesure sur matériel identifié | Résultat du scénario et des réglages mesurés | Garantie générale de FPS |
| Comparaison avec références | Points d'apparence ou de continuité effectivement contrôlés | Fidélité 1:1 ou exhaustivité non vérifiées |

Le compte rendu indique ce qui a changé, pourquoi, les preuves obtenues et les éléments encore non vérifiés.
Ne pas annoncer « terminé », « optimisé » ou « fidèle » sur la seule présence de données ou de guides.

## 8. Prochaines actions mesurables

1. Choisir un critère encore ouvert dans le suivi courant et revalider son constat sur le code actuel.
2. Sélectionner dans la table précédente les tests et le scénario réel correspondant à ce critère.
3. Exécuter le scénario de référence ; conserver son état initial, ses étapes et ses résultats.
4. Choisir le premier défaut reproductible ou coût dominant observé et le corriger dans son système propriétaire.
5. Rejouer la vérification concernée puis actualiser le suivi avec la preuve et son périmètre.

## Sources amont figées

[router]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/router/SKILL.md
[ai]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/game-ai/SKILL.md
[utility]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/ai-behavior-trees-utility-ai/SKILL.md
[performance]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/performance-optimization/SKILL.md
[levels]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/level-design/SKILL.md
[feel]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/game-feel/SKILL.md
[assets]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/create-game-assets/SKILL.md
[three]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/web-engines/threejs-scene-setup/SKILL.md
[saves]: https://github.com/gamedev-skills/awesome-gamedev-agent-skills/blob/19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9/skills/disciplines/save-systems/SKILL.md
