# État réel du jeu à la v58

> Bible du jeu, document 3 sur 3. Constat daté du 13 novembre 2026.
> Il dit ce que le code fait vraiment, par opposition à la cible de [game-concept.md](game-concept.md).

## 1. Le fait principal

**Le jeu ne se chargeait plus depuis la v34.** La dernière version dont tous les fichiers étaient valides est la v33.0.

| Versions | Fichier en erreur de syntaxe |
|---|---|
| v34 à v38 | `js/entities/BadBloodEncounter.js` |
| v39 à v58 | `js/engine/GoreEngine.js` (accolade manquante) |
| v44 et v45 | aussi `js/entities/XenomorphHorde.js` |
| v57 et v58 | aussi `js/main.js` (variable déclarée deux fois) |

`main.js` importe ces fichiers : une seule erreur empêche tout le jeu de démarrer. Les ajouts des versions 34 à 58, soit 25 versions, n'avaient donc jamais tourné. Méthode : vérification de syntaxe de chaque fichier sur chacun des 60 commits.

## 2. Correctifs livrés

Cinq corrections minimales (commits `1242f66` et suivant) :
1. `GoreEngine.js` : accolade fermante rétablie.
2. `main.js` : seconde variable `isNearCrypt` renommée.
3. `Player.js` : le gestionnaire de synthétiques est transmis au lieu d'un nom non défini.
4. `Environment.js` : le système de particules est résolu au lieu d'un nom non défini.
5. `main.js:2973` : le monte-charge était lu par un champ inexistant (`switchPos` au lieu de `pos`).

Seuls les deux premiers étaient demandés. Les trois autres se sont révélés une fois le jeu chargé : chacun levait une erreur à chaque image. Le cinquième arrêtait chaque image **avant le rendu 3D, la progression des vagues et le test de défaite** : l'écran restait noir derrière l'interface.

## 3. Ce qui a été vérifié en jeu

Essai automatisé dans Chromium le 13 novembre 2026, 40 secondes par arène, saisies clavier et clics en boucle.

| Vérifié | Résultat |
|---|---|
| Construction (`vite build`) | Réussie |
| Menu, choix du chasseur, de l'arène, préparation | Fonctionnent |
| Lancement d'une mission dans les 8 arènes | Fonctionne |
| Rendu 3D | Fonctionne (capture en jeu à Val Verde) |
| Attaques, combos, score | Fonctionnent (score de 7 775 à 20 150, combos de 58 à 156) |
| Progression des vagues | Fonctionne (vague 2 atteinte dans 5 arènes, vague 3 dans une) |
| Défaite et écran de fin | Fonctionnent dans les 8 arènes |
| Erreurs en console | Aucune sur les 8 essais |

**Non vérifié** : les boss, les exécutions, la vague 4 et au-delà, les soutiens, la forge, la coopération, le son, les performances sur une vraie carte graphique.

**Observé sans en connaître la cause** : le chasseur meurt en moins de 40 secondes dans les 8 arènes sous des saisies automatiques ; des confettis sont tirés sur l'écran de défaite ; le filtre de vision reste affiché derrière cet écran.

## 4. Ce que le jeu fait aujourd'hui

### Déroulement
- Menu → chasseur → arène → préparation → mission.
- Au départ : 55 ennemis, 16 unités fixes, 3 alliés Yautja, 4 marines, 3 synthétiques, un planeur.
- Vague suivante quand il reste moins de 10 ennemis : 45 + 15 par numéro de vague.
- Vagues 2 et 4 : frappe aérienne. Vague 3 : Bad Blood et blindé. Vague 5 : toujours le même boss (Matriarche Predalien, 10 000 points de vie), quelle que soit l'arène.
- **Le mode sans fin est actif par défaut, et il n'existe aucune victoire.**
- Défaite à zéro point de vie. Pas de pause.

### Combat (socle)
- Attaque légère en 5 temps de 0,28 s ; dégâts = mêlée × (1 + temps × 0,18).
- Six finitions lourdes, de ×2,0 à ×7,2.
- Musou à 100 : 1200 de dégâts dans un rayon de 40 (1500 sur un boss), identique pour tous.
- Canon plasma : 100 d'énergie, +15 par seconde ; tir chargé à 0,55 s (×3,4).
- Moral du champ de bataille de 0 à 100 ; « frénésie d'avant-garde » à 80.

### Contenu
Chasseurs, armes, ennemis, boss, arènes, factions et progression sont détaillés dans les onglets `02` à `10`.

## 5. Les incohérences qui structurent le tri

1. **Trois boss d'arène n'existent pas.** `praetorian`, `predalien` et `xenomorph_queen` retombent sur une reine générique de 3000 points de vie. Quatre boss codés ne servent à aucune arène.
2. **Les arènes partagent environ 45 éléments de décor.** Val Verde contient un réacteur, un Space Jockey et un sarcophage d'Ingénieur. Les décors propres à chaque arène (v56 à v58) sont, eux, soignés.
3. **Le registre des 36 armes n'est lu par aucun code.** Les deux roues d'armes n'affichent qu'une annonce. 17 armes ont un comportement réel, par touche directe.
4. **Environ 54 capacités toujours disponibles**, avec conflits : G déclenche deux actions, Maj+4 tire et pose une tourelle, Espace lance trois effets.
5. **Le camouflage n'a plus de touche** depuis la v51 ; le code d'élimination furtive est inaccessible.
6. **`window.gameInstance` est lu 182 fois et n'existe pas** (l'objet s'appelle `window.game`). Tout ce qui en dépend est inerte.
7. **Un boss ne meurt pas par les dégâts** : seule l'exécution le retire. Des ennemis à zéro point de vie restent actifs.
8. **Deux forges, deux roues d'armes, deux parades, deux tourelles** : chaque ajout a doublé un système au lieu de l'étendre.
9. **La campagne en cinq chapitres est un titre affiché** : quatre niveaux sur cinq n'existent pas.
10. **Six numéros de version différents** selon le fichier.

La liste priorisée est dans l'onglet `11_P0_Defauts`.

## 6. Ordre de travail proposé

1. **Stabiliser** : zéro erreur en console sur une chasse complète, boss compris (HW-BUG-06, 08, 09).
2. **Donner une fin** : victoire par exécution du boss d'arène, pause, retour au menu (HW-BUG-07, 13, 14).
3. **Rendre chaque arène à elle-même** : trois boss manquants, décor générique réparti (HW-BUG-15).
4. **Resserrer le kit** : tronc commun, quatre emplacements, Musou par chasseur (HW-BUG-10, 11).
5. **Unifier** : une forge, une roue, un numéro de version.

Aucun contenu nouveau avant la fin de l'étape 2.

## 7. Outils de projet

- Spec Kit et Claude Code Game Studios sont appliqués au dépôt ; Superpowers 7.0.0 est activé en portée projet (la révision documentée dans `.ai-tools/sources.json` est la 7.0.2).
- `project.yaml` n'existe pas : le moteur réel (three.js, sans moteur de jeu) n'est pas encore déclaré à Game Studios.
- Aucun test de jeu, aucune intégration continue.
