# Application des guides gamedev — sauvegardes et récupération

Date : 29 octobre 2026. Projet : Yautja Hive Warriors. PR : [#5](https://github.com/darknigthmare/Yautja-hive-warriors/pull/5).

## Résultat vérifié

**72 tests Node réussis, 0 échec, 0 ignoré**, sur les six suites indiquées ci-dessous. Les 12 fichiers JavaScript concernés par ces vérifications passent également le contrôle de syntaxe Node.

Cette passe applique les guides **save-systems** et **game-ui-ux**, lus à la révision amont **19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9**. La base du jeu est le commit **23649bf92d2132ca0d1b59f0b10e83feb6c809f5** de la PR #5. Les empreintes des fichiers effectivement testés figurent dans [validation.json](validation.json), avec les références exactes des guides.

## Comportements corrigés

### Honneur et trophées

Le chargement ne réécrit plus immédiatement un registre partiel, illisible ou d’une version inconnue. Il distingue une clé absente d’une lecture refusée. Les octets d’origine restent conservés ; les trophées dont les noms sont valides restent visibles ; les achats sont suspendus tant que le registre ne peut pas être validé.

Les nouvelles récompenses restent en attente en mémoire. Le bouton de nouvelle tentative relit le stockage et réconcilie ces récompenses avec les reçus et les sessions déjà clôturées, pour éviter un double crédit. Il peut aussi réessayer une écriture initiale refusée par le quota. Un échec ne déclenche pas un message de succès. Les champs additionnels d’une sauvegarde v1 sont conservés lors d’une écriture ultérieure.

La récupération ne répare pas automatiquement du JSON corrompu. Il faut qu’une relecture rende des données valides ou que l’écriture redevienne possible. Fermer l’onglet avant un enregistrement réussi peut perdre les nouvelles récompenses encore en mémoire ; l’ancienne sauvegarde reste protégée.

### Achats et interface

Un état lisible et une nouvelle tentative apparaissent dans la Forge, la forge du clan, le panthéon et la passerelle. Les méthodes d’achat et de soutien vérifient le registre avant leurs effets ; les refus ne consomment ni honneur ni gelée royale. Le mode volontairement limité à la session est annoncé sans proposer une fausse récupération persistante.

Les reçus restaurent les niveaux Forge après une récupération en cours de session. Pour le clan, les neuf améliorations reconnues sont reconstruites depuis les reçus de débit valides même si l’enregistrement séparé **yautja_clan_forge** a échoué. Les anciens achats booléens du slot clan restent acceptés. Un registre d’honneur invalide ne constitue pas une preuve d’achat.

L’effet de l’armure Enkidu ajoute ses 250 PV maximum une seule fois : les relectures préservent le bonus Forge, les PV actuels et les dégâts. La nouvelle tentative rafraîchit aussi le second joueur en coopération.

### Sauvegardes de bataille

Les tactiques de prise en tenaille et de repli émettent immédiatement une formation normalisée. La reprise migre uniquement les anciens alias connus **flank** et **column**, sans modifier l’objet d’entrée. Les valeurs inconnues restent refusées. Les tests continuent deux fronts après reprise et vérifient pertes, blessure, réserves, trajets et identités.

À la fin d’une bataille, le temps résiduel est vidé avant les callbacks de résultat. Un checkpoint créé par ces callbacks est donc rechargeable, même si l’API de simulation reçoit un delta de plusieurs pas. La boucle de rendu actuelle plafonne son delta à 0,1 ; ce test ne prouve pas un défaut de sa cadence normale. Les anciens checkpoints terminaux ayant déjà un accumulateur invalide ne sont pas réparés.

## Vérifications exécutées

| Suite | Réussites | Couverture |
| --- | ---: | --- |
| honor-ledger.test.js | 24 | Migration initiale, données invalides, trophées, quota, accès refusé, récompenses en attente, reçus |
| battle-simulation.test.js | 28 | Checkpoints tactiques et terminaux, identités finies, pertes, réserves, horloges |
| battle-strategy-depth.test.js | 8 | Délais, retraite, routes, difficulté et coordination de ruche |
| forge-ledger-integration.test.js | 1 | Achats réels, débit persistant et reprise |
| honor-save-recovery-ui.test.js | 5 | Quatre panneaux, gardes des achats/soutiens, retry et restauration des menus |
| clan-forge-recovery.test.js | 6 | Échec du second enregistrement, restauration en session/reload, coop, bonus HP et données malformées |
| **Total** | **72** | **Aucun échec, aucun test ignoré** |

Le [journal complet](targeted-tests.txt) contient la commande et ses sorties. Le [contrôle de syntaxe](syntax-checks.txt) est distinct. Les nouvelles régressions ont aussi été exécutées avant correction : 18 cas HonorLedger, 5 cas BattleSimulation et 5 des 6 cas clan échouaient sur leurs sources initiales. Ces reproductions proviennent des sorties d’outils de la session ; leurs logs bruts ne sont pas tous archivés dans ce dossier.

Les tests UI et clan exécutent les véritables méthodes de production dans un environnement DOM simulé, sans construire une scène WebGL. Les tests de simulation utilisent le cœur officiel Three.js r160, identique à la distribution 0.160.1. Le descripteur local utilisé pour ces tests n’est pas une installation complète npm ci, et aucune dépendance du dépôt n’a été modifiée.

## Suivi et limites

**AUD-118 reste « À valider », avec acceptanceVerified: false.** Cette preuve partielle est ajoutée au suivi sans modifier son critère, les 125 autres actions, les statuts ou les classeurs historiques. Aucun statut de cellule Excel ne change.

Cette passe n’est ni une recette humaine, ni un benchmark matériel, ni une certification de fidélité 1:1. Aucun build Vite local ou parcours WebGL dans un navigateur n’est revendiqué par ces fichiers. Les vérifications de l’aperçu Vercel effectuées après publication doivent identifier leur propre commit dans la PR ; un statut READY ne suffit pas à valider le combat.

Les guides orientent ici la validation des formats, les migrations limitées aux cas connus, la conservation des preuves d’achat et le retour d’information au joueur. L’architecture du jeu, sa version Three.js, les budgets des armées et les règles des factions sont conservés.
