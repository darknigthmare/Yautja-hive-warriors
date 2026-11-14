# Rencontres de boss — 28 octobre 2026

Cette passe traite les identités, les contacts, les contre-jeux et la persistance des rencontres. Les échelles, statistiques et nouvelles règles de combat sont des adaptations de jeu. Les modèles ne sont pas des scans ; la géométrie, les textures et la chorégraphie ne sont pas certifiées 1:1.

## Validation avant lancement

`js/data/BossEncounterValidation.js` fournit :

- `prepareBossEncounter({ level, bossType = level.bossType, mode: 'level' })` : refuse une identité inconnue, un boss différent de celui annoncé et un boss non attribué à ce contexte. Le DTO lie `bossType`, `modelId`, `combatId`, libellé, hauteur et HP. Les modes `sandbox`, `operation` et `crossover` doivent être explicites pour autoriser un contexte alternatif.
- `validateOperationBossConfiguration(config, level)` : contrôle les profils et identités allouées, le renderer des rares et la présence d'une seule place de boss majeur. Les Prétoriens intermédiaires restent dans le gestionnaire de horde ; ils ne partagent pas la variable `activeBoss` du majeur.
- `validateBossCombatState(state, { bossType, battleUnitId, maxHp })` : validation pure et bornée utilisée par le moteur pour la sauvegarde des métadonnées de combat d'une Queen allouée.

`BossManager.spawnBoss(type, position, prepared?)` vérifie le DTO lorsqu'il est fourni, construit le nouveau modèle avant de retirer l'ancien et normalise l'alias historique `queen` vers `xenomorph_queen`. Une erreur de modèle ou de configuration ne détruit donc pas la rencontre en cours. Le raccord main/UI doit appeler la préparation avant de changer de scène ; le registre seul ne prouve pas ce raccord.

## Pieds physiques et modèles

Le constructeur visuel devient l'enfant `visualModel` d'une racine physique, conservée au niveau des pieds. Il reçoit une mise à l'échelle uniforme et un décalage de repos ; les sommets et les données de skin ne sont pas réécrits. Les attaques, projectiles, collisions et changements de couche utilisent la racine physique. Les animations de créature continuent sur le véritable enfant visuel.

Avant cette correction, les surfaces basses du Trilobite se situaient environ 2,87 unités sous sa position de jeu, celles du Roi de Charon 0,55 et celles de l'Ingénieur 0,24. Les dix-huit constructeurs CPU ont maintenant une boîte de repos allant du sol fourni à ce sol plus la hauteur du registre. Ces mesures sont en unités du jeu ; elles ne valident pas les tailles des costumes ou des acteurs. Les imports natifs asynchrones des deux chasseurs demandent encore la recette graphique globale.

Le relevé [boss-model-metrics.json](qa/boss-model-metrics.json) conserve le nombre de meshes et de triangles de chaque constructeur, sans convertir la présence d'une géométrie en certificat de qualité artistique. Certains constructeurs hérités restent peu détaillés.

## Contre-jeux et corrections physiques

Chaque rencontre expose `BossManager.getEncounterReadout()` : lecture, réponse, action préparée, vulnérabilité et phase. Les règles complètes sont dans `BossCombatPatterns.js`.

| Rencontre | Comportement distinct traité |
|---|---|
| Reine xénomorphe | Balayage circulaire évitable en hauteur ; alerte couvrant la portée réelle. |
| Prétorien | Carapace frontale ; dégâts normaux sur le flanc ou pendant la récupération. |
| Predalien | Bond fixé sur une trajectoire et balayage frontal. |
| Predalien de Gunnison | Une frappe lourde interrompt la préparation de la couvée. |
| Reine impériale | Premier impact proche puis couronne extérieure, dont l'intérieur reste sûr. |
| Impératrice | Cône de souffle fixé pendant la préparation ; déplacement repoussé résolu contre le décor. |
| Offspring | Cri orienté ; aucun retrait d'énergie si le couvert a empêché l'impact. |
| Abomination prédalienne | Bond suivi du jeu de couvée, distinct du simple tir d'acide. |
| Titan prédalien | Trois impacts séparés ; la sortie de zone reste une réponse possible. |
| Roi de Charon | Une charge arrêtée par un couvert ouvre une vraie récupération. |
| Ingénieur | Les attaques lourdes usent le bouclier plus vite ; le vortex respecte couvert et collisions. |
| Trilobite | Saisie basse préparée, évitable en quittant sa zone ou en sautant. |
| Berserker | Trois projectiles physiques différés partagent visée et quota d'un impact par cible. |
| Upgrade | Une frappe lourde interrompt la charge préparée. |
| Feral | Bolt physique, masque et signature thermique atténuable, avec proximité et vision directe conservées. |
| Gladiateur | Bond puis onde de réception différée. |
| Jungle Hunter | Triple laser de préparation dont la visée est fixée. |
| City Hunter | Alternance réelle disque/plasma ; disque aller-retour, sans second dégât gratuit sur la même cible. |

Les tests exercent des mécanismes représentatifs et les phases des onze contextes ; ce tableau ne remplace pas dix-huit parcours humains complets. Les cas identifiés comme adaptations dans le registre gardent cette qualification.

La hauteur des attaques au sol est relative à leur sol de départ. Un combattant sur un pont peut être touché au niveau du pont et un saut peut éviter l'effet ; les anciennes comparaisons au Y mondial ne l'immunisent plus artificiellement. Les cercles d'avertissement des attaques de zone couvrent leur portée effective. Les effets et séries différées avancent sur le temps simulé et sont annulés au nettoyage.

Le Prétorien utilise l'origine de l'attaque pour reconnaître le flanc. Le raccordeur fournit donc `takeDamage(damage, horde, { origin: attacker.position, attackKind: 'heavy' | 'charged' | 'light', killerFaction })`. Les anciens appels sans origine restent compatibles et ne prétendent pas reconnaître un flanc.

## Phases et front secondaire

`BossPhasePressure({ simulation, getBoss, secondaryFrontIds?, warningSeconds: 12, announce? })` réagit une fois aux passages en phases 2 et 3. Il choisit un front secondaire allié non critique et un groupe hostile déjà déployé, avec une route existante. Il exclut le groupe personnel du boss, les réserves et les groupes en repli. Douze secondes précèdent la demande d'un véritable ordre d'attaque.

Une route coupée, une trêve, l'élimination du groupe ou un ordre refusé arrêtent explicitement la réaction. Après le départ, le groupe utilise la navigation, les pertes et la capture du moteur. La disparition du modèle du boss par LOD ne suffit pas à annuler une menace si son identité allouée reste vivante. La mort réelle du boss annule une réaction qui n'est pas encore partie.

Aucun combattant n'est créé et aucune tâche accomplie n'est remise à zéro. La perte éventuelle du front modifie son véritable propriétaire et ses ressources. En l'absence de front optionnel ou de groupe admissible, la phase n'invente aucune attaque secondaire. `serialize()` / `restore()` conservent annonces, échéances, identités et résultats sans répéter les ordres ; `dispose()` libère les références.

## Sauvegarde et LOD

`BossManager.serializeCombatState()` produit une photo bornée de HP, phase, bouclier, stock de couvée, index de tir et cooldowns. Le Bridge transmet cette photo au `syncUnit` du moteur. Le moteur l'accepte uniquement pour un profil Queen compatible et la valide aussi au chargement.

Le retour d'un boss depuis une zone distante utilise les HP actuels du moteur, même si les HP de la photo sont plus élevés. Les cooldowns diminuent selon le temps stratégique écoulé. Les stocks ne se remplissent pas. Un passage en phase 3 causé par de véritables dégâts distants n'est pas annulé par la matérialisation.

Les projectiles et charges déjà consommés sont annulés à une reprise de checkpoint ; ils ne sont ni remboursés ni rejoués. Cette API ne revendique pas la sauvegarde exacte de toutes les trajectoires en vol. Un test passe par le vrai BossManager, le vrai Bridge, la dématérialisation, de vrais dégâts distants, une nouvelle simulation et un nouveau gestionnaire pour contrôler ce contrat.

## Preuves et portée

La suite ciblée combine registre, onze contextes, préflight des vingt-cinq opérations jouables, contre-jeux, sauvegarde/LOD, Bridge, identités de combat et régressions des systèmes. Le rapport de livraison et ses empreintes se trouvent dans `qa/boss-encounters-verification.json`. Les deux modes demandant un contrôleur humain restent explicitement indisponibles ; ils ne sont pas comptés comme des missions jouables.

Les rencontres de test utilisent des positions et des dégâts contrôlés, via les vrais gestionnaires, pour raccourcir le parcours. Elles n'établissent pas une difficulté humaine, la lisibilité de tous les avertissements, une fréquence d'affichage matérielle ou une fidélité visuelle 1:1. Aucune génération Meshy payante, modification du dist original ou action Vercel/Git distante n'a été effectuée par ce lot.
