## Reprise du 15 novembre 2026 — branche `claude/fervent-volta-hmhdfw`

Cette branche porte le travail des 14 et 15 novembre vers `master` par la PR n° 9. Elle prolonge la base décrite plus bas. Vérifier les références Git présentes avant de reprendre : cette photographie ne remplace pas leur état réel.

- **Gameplay et audit**
  - P0 et P1 traités autant que le code le permet, avec les décisions HW-DEC-81 à 123 (`tools/bible/build_bible.py`).
  - AUD-063 : balayage d'assaut et d'évacuation croisés sur 79 portes et routes, 0 échec, dans `docs/qa/counterflow-stress-20261115/`. Il reste « À valider » : les collisions entre acteurs ne sont pas simulées par le jeu.
  - Suivi `implementation-progress.json` : 78 terminés, 36 à valider, 12 en cours.
- **Mode Ascension** (spec 002) : huit mondes, *La Lame Patiente*, rite, sauvegarde du compte. La vraie connexion au compte reste à essayer par l'auteur.
- **Présentation cinématique** (spec 003, `specs/003-presentation-cinematique/spec.md`) :
  - avant-menu, écran titre, fond de menu tournant, musique procédurale avec emplacements pour l'auteur (`docs/audio/MUSIQUE-GOOGLE-FLOW.md`), ambiances ;
  - écran de chargement, intel, outros, crédits, caméra de mise à mort et vie ambiante.
- **Insertion** (`docs/INSERTION.md`) : capsule d'AVP 2004, vaisseau de Wolf et faisceau du vaisseau-mère, avec leurs effets et une sortie camouflée. Les références sont tirées d'AvP Galaxy ; aucune fidélité 1:1 n'est revendiquée.
- **Automatisation** : les cinématiques, le gel de chargement et les effets d'insertion sont coupés pendant les tests, sauf avec `?intro=1`.
- **Tests au 15 novembre** : suite Node complète et 16 scénarios navigateur Playwright verts. Aucune mesure matérielle ni revue visuelle humaine n'est revendiquée.

## Reprise précédente (archive)

La reprise courante est **`codex/fidelity-20261109`**, avec le code testé figé au commit **`1a6eeb84445d5b01b13db7f4165f4d17499377e3`**. Elle prolonge `a8f9c75` et sa continuation de novembre, sans repartir de `master` seul. Lire [la passe graphique](docs/FIDELITY-20261109.md), le [rapport intégré](docs/qa/fidelity-20261109-validation.json) et le [comparatif de 15 paires](docs/qa/fidelity-20261109/comparison.html).

Le garde de clan, les huit corps humains de soutien, les capsules d’insertion et les structures proches de l’arrivée de Val Verde sont améliorés. Les mains tiennent leurs armes, les yeux suivent la surface du visage, les armures sont ajustées et les dreadlocks disposent de poses indépendantes. Les ouvertures et les vérins de capsule conservent le passage et les dimensions physiques. Baraque et mirador quittent les deux vues de départ avec leurs contacts ; les sols détachés et les anciens appuis invisibles sont retirés. Les marches réelles et leur palier fonctionnent en montée et descente aux vitesses et pas du vrai `Player.move`, sans remplacer l’accès par un plan invisible.

Les surfaces PBR distinguent davantage peau, chitine, textile, bois et métal peint/brut. Aucune résolution existante n’augmente. Le cache partage les `THREE.Source` entre répétitions ; les modèles Yautja ont un gabarit CPU constant et des clones privés. Les ressources des instances sont libérées par un seul propriétaire, y compris les roues du M577. Les coûts supplémentaires de géométrie et de rendu restent indiqués dans les preuves : ces optimisations ne prouvent pas un gain de FPS global.

Le build **`v70-fidelity-20261109`** comprend **197 sources, 30 fichiers et les douze GLB inchangés**. Fingerprint : `3d32ced7f9ed824653c77a03ec10505c3ae44e44a8beec6603f70889510b2cb2`. Index : `a8526c19acfa8c5199fdb780e1da44eae352491cd45f4c7ea6b4def7104abf9d`. Le dist est figé ; les commits documentaires ultérieurs ne demandent pas sa reconstruction.

La régression sélectionnée passe **482/482 tests dans 69 fichiers**, sans échec, saut ou annulation. La comparaison à éclairage et cadrage identiques comporte 15 paires natives et un échantillon de bois nouveau séparé ; le lancement coopératif réel montre les deux joueurs après leur sortie et l’absence d’obstacle décoratif aux points contrôlés. Les trois scénarios navigateur passent dans une seule exécution : menus/commande/reprise coop, Carrier autonome et vol dans `Game.update`, puis checkpoint/récupération/feu Ravager. Les 16 captures de la passe finale et 21 de la régression sont archivées avec leurs SHA. Les tentatives intermédiaires restent distinctes.

Le [contrat Musou](docs/development/MUSOU-GAMEPLAY-CONTRACT.md), le [référentiel de continuité](docs/development/CANON-REFERENCE-20261108.md), les kits, identités finies et le plafond de 32 acteurs détaillés sont préservés. Les fichiers d’audit et Excel restent inchangés : **78 terminés, 36 à valider, 12 en cours**. Aucun critère global n’est clôturé par cette seule passe.

La fidélité visuelle 1:1 reste non certifiée : il s’agit de modèles de soutien procéduraux et d’interprétations originales, guidés par des photographies documentées. Aucun nouveau crédit Meshy, testeur humain ou résultat de performance matérielle n’est revendiqué. Aucun déploiement manuel de production n’a été soumis pendant cette passe ; un push ou une preview automatique ne suffit pas à prouver une publication vérifiée.

La [reprise avant cette passe](docs/qa/fidelity-20261109/reprise-before.txt) et les preuves de v69 sont conservées comme archives, avec leurs propres commits.
