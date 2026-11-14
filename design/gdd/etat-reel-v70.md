# État réel du jeu à la v70

> Bible du jeu, document 3 bis. Constat du 14 novembre 2026, après la fusion `4a65844`.
> Il remplace [etat-reel-v58.md](etat-reel-v58.md), qui décrivait `master`, et non le dernier état du projet. Ce dernier document est conservé comme archive.

## 1. Ce qui s'est passé

Le dernier travail du projet vivait sur `codex/fidelity-20261109` : 152 commits et environ 2 000 fichiers de plus que `master`, jamais fusionnés. La session du 12 au 14 novembre a d'abord travaillé sur `master` (v58). Sur décision de l'auteur (HW-DEC-81), la v70 est la référence : elle a été fusionnée dans la branche de travail, et son code de jeu l'emporte.

Les branches `codex/*` sont toutes contenues dans `codex/fidelity-20261109`, sauf un commit de `codex/gamedev-guides-20261029` et le commit de fusion de `main`. La PR n° 8 (Alien_base v1) est déjà contenue dans la v70.

## 2. La v70 en bref

Sources : `REPRISE.md`, `README.md`, `QA.md`, `docs/development/MUSOU-GAMEPLAY-CONTRACT.md`, `docs/development/CANON-REFERENCE-20261108.md`.

- **Genre** : Musou à la Dynasty Warriors, un Yautja contre des armées organisées en fronts, avec officiers, moral et objectifs ; les armées combattent hors caméra.
- **Modes** : chasse, campagne de cinq chapitres, fronts, survie, bac à sable, coopération locale à deux.
- **Contenu** : sept chasseurs, 36 entrées d'armurerie, 27 opérations (13 524 allocations cumulées), dix cartes et 34 terrains selon l'audit.
- **Règles fortes** : 32 acteurs détaillés au plus en même temps ; toute mort passe par `BattleSimulation.recordDeath` ; un officier vaincu donne au plus 8 points de moral ; aucune unité ni ressource créée par le déroulé des batailles ; identités finies et immuables.
- **Qualité** : 482 tests sur 69 fichiers selon `REPRISE.md` pour le build `v70-fidelity-20261109`. Publication Vercel décrite dans le README pour un build antérieur ; aucune publication de la v70 n'a été soumise.

## 3. Les classeurs du dépôt (HW-DEC-82)

Audit du 26 octobre, feuille `Manquants`, colonne `Suivi` (la seule que le writer du projet a le droit de modifier) :

| Suivi | Nombre |
|---|---|
| Terminé | 78, dont les 14 P0 |
| À valider | 36 |
| En cours | 12 |

Restent ouverts **hors de cette feuille** :
- **15 recettes P0 « À exécuter »** dans la feuille `Validation` (REC-001 à 008, 010, 012, 016, 019, 021 à 023) ;
- **LOT-0 et LOT-1** de la feuille `Feuille_route`, jamais mis à jour (LOT-0 semble atteint) ;
- **CTRL-001, CTRL-002, CTRL-082** du contrôle du 27 octobre : synthétiques et Working Joes remplacés par des humains, rôles Extinction remplacés par des Marines génériques ; le suivi du 1er novembre les dit vérifiés côté répartition, à valider en mission.

Le détail des points ouverts, avec leur nature (code, observation, testeur, matériel, modèle, documentation), est dans [points-ouverts-v70.md](points-ouverts-v70.md).

## 4. Ce que devient le travail de la session

| Travail v58 | Sort |
|---|---|
| Correctifs de syntaxe et d'exécution | Déjà faits autrement en v70 |
| Victoire, pause, retour au menu, modes | Déjà en v70 |
| Prétorien à Val Verde, courbe de PV | Non porté : la v70 a le Jungle Hunter pour boss de Val Verde et fixe les PV par identité de boss |
| Appuis par arène, décor par arène | Déjà en v70, sous une autre forme |
| Garde nationale, caisses d'armes humaines, ouverture furtive | À porter sur les systèmes v70 (HW-DEC-87) |
| Kit à quatre emplacements, nouvelles touches | Non porté : commandes v70 conservées (HW-DEC-85) |
| Musou propre à chaque chasseur, caméra à la souris, verrouillage | À porter sans casser coop ni manette (HW-DEC-85) |
| Fenêtres vides du menu, nom du chasseur au HUD | Déjà corrigés en v70 |
| Listes de commandes F1 et Options | À aligner sur les commandes v70 |
| Campagne de l'Unblooded | Mode à part « Ascension », après les P0 et P1 (HW-DEC-86) |
| Plafond de 120 ennemis par vague | Inutile : la v70 plafonne à 200 avec apparitions étalées, et à 32 acteurs détaillés |

Les modules v58 sont archivés dans `design/archive-master-v58/`.
