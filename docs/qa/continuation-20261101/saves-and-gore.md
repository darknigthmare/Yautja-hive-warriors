# Sauvegardes et ressources de gore — reprise du 1er novembre

La base relue est `03f37b4`, après intégration de la PR #5. Les migrations et la récupération de `HonorLedger` sont déjà corrigées dans cette base ; elles ne sont pas réécrites pendant cette passe. Les guides épinglés `save-systems` et `performance-optimization`, révision `19d93f97c9c1ea0f8b306e77aa81e0d3e352d3e9`, orientent la validation conservatrice et la propriété des ressources ; aucune API d’un autre moteur n’est intégrée.

## Défauts reproduits et correction

Un appel de stress de 100 décals d’acide puis 40 démembrements lourds, sans mise à jour temporelle, produit avant correction 100 décals, 93 membres et 40 projections. Le nettoyage déclenche 178 événements de destruction de matériaux pourtant partagés et réutilisés par le gestionnaire.

`GoreEngine` conserve désormais au maximum 24 décals, 90 membres et 100 projections. La réservation porte sur tout le nouvel impact, qui reste visible lorsque le budget est atteint ; les plus anciens effets quittent la scène et libèrent leurs ressources privées. Le même stress produit 24 décals, 90 membres, 40 projections et **zéro destruction de matériau partagé** au nettoyage. Le gestionnaire peut ensuite servir une autre mission.

Le fondu d’un décal utilise son matériau privé : il ne modifie plus les nouvelles flaques ni les projections qui partagent le matériau d’acide. Les effets posés à une hauteur de contact élevée retombent sur cette hauteur, au lieu de disparaître sous la plateforme. Ces effets décoratifs ne créent ni zone de dégâts, ni état de gameplay supplémentaire. L’ancien commentaire revendiquant une anatomie « 1:1 » est remplacé par une description d’adaptation.

Les démembrements et le nettoyage sont réellement appelés par le combat et les transitions de mission. L’API des décals `spawnAcidSlagDecal` n’a pas d’appelant dans le runtime actuel : son bornage est une correction préventive de cette API, pas la preuve qu’elle provoquait déjà une accumulation pendant une partie.

## Vérifications exécutées

[78 tests Node passent](save-gore-targeted-tests.txt), sans échec ni cas ignoré. Trois nouvelles régressions couvrent saturation et éviction, destruction exacte des ressources privées et réutilisation des matériaux communs, puis fondus indépendants et sol élevé. Les suites existantes revalident aussi honneur, reprise dans les menus, achats Forge/clan, checkpoints des joueurs, boss, tactiques, simulation et consommables Prey. Les empreintes et la mesure avant/après figurent dans [save-gore-validation.json](save-gore-validation.json).

Cette mesure porte sur des objets et événements de destruction Three.js côté CPU. Elle ne mesure ni FPS, ni temps GPU, ni consommation mémoire d’une longue partie. AUD-109 ne devient pas automatiquement terminé.

## Recette navigateur préparée

[verify-save-startup.mjs](verify-save-startup.mjs) prépare cinq démarrages réels : compteurs historiques, registre v1 partiel, version future, solde invalide et checkpoint d’opération illisible. Il contrôle les octets protégés, les trophées lisibles, le menu de repli et une insertion jouable, sur un index et un commit obligatoirement fournis par le coordinateur. Cette recette n’était pas encore exécutée lors de la validation CPU décrite ci-dessus. Elle utilise le helper d’insertion existant, avec avancement de simulation déclaré ; elle ne prétend ni à une victoire ni à un test humain.

Elle a ensuite passé **5/5 cas sur le gel final `e524c2b`**, en 126,228 s. Les cinq joueurs terminent leur insertion visibles et vivants, à 1000 PV. Les preuves et helpers exacts sont conservés dans [le dossier final des démarrages](../continuation-final-20261101/save-startup-e524c2b/report.json), avec dist et helpers inchangés, zéro erreur JavaScript, requête échouée ou accès externe.

La [recette finale de streaming](../continuation-final-20261101/world-streaming-e524c2b/report.json) passe six jambes à travers trois secteurs et leurs retours : 453 images réellement rendues, 1807 pas respectant les collisions, 180 évictions et 162 restaurations, mêmes buffers CPU, vraie porte détruite et objectifs gagnés conservés. Le test dure 661,706 s sous SwiftShader. Il pause la simulation, accélère les déplacements et interroge synchroniquement `gl.getError` après chaque image ; les intervalles observés incluent cette sonde et ne mesurent pas les FPS du jeu non instrumenté. [L’analyse](../continuation-final-20261101/world-streaming-e524c2b-analysis.json) conserve ces limites et les durées brutes. Aucune fluidité sur matériel cible n’est certifiée.

Le parcours des onze cartes accepte déjà les deux issues via `docs/qa/pr3-next-20261028/run-complete-contexts.mjs --outcomes victory,defeat`. Il faut le rejouer sur le candidat final gelé pour obtenir des preuves récentes des deux issues ; les captures des anciens commits ne sont pas réattribuées au nouveau code.

AUD-118 conserve encore la portée partielle des migrations effectivement reconnues ; cette passe ne prétend pas réparer arbitrairement toutes les anciennes sauvegardes. Aucun classeur, critère historique, profil de livraison ou crédit Meshy n’est modifié ici.
