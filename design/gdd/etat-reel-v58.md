> **Archive.** Ce constat porte sur `master` v58. La référence est la v70 depuis le 14 novembre 2026 : voir [etat-reel-v70.md](etat-reel-v70.md).

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

Neuf corrections minimales, les 12 et 13 novembre 2026 :

| N° | Fichier | Correction | Effet |
|---|---|---|---|
| 1 | `GoreEngine.js` | Accolade fermante rétablie | Le module se charge |
| 2 | `main.js` | Seconde variable `isNearCrypt` renommée | Le module se charge |
| 3 | `Player.js` | Gestionnaire de synthétiques transmis | Plus d'erreur à chaque image |
| 4 | `Environment.js` | Système de particules résolu | Plus d'erreur à chaque image |
| 5 | `main.js` | Monte-charge lu par son vrai champ (`pos`) | Le rendu 3D, les vagues et la défaite fonctionnent |
| 6 | `main.js` | Alias `window.gameInstance` défini | Les 182 lectures de ce nom trouvent le jeu |
| 7 | `Bosses.js` | À zéro, le boss reste à terre à 1 point de vie jusqu'à l'exécution | Un boss ne bloque plus les vagues ; conforme au pilier 3 |
| 8 | `XenomorphHorde.js` | Balayage des ennemis à zéro point de vie | Plus d'ennemis morts encore actifs |
| 9 | `Bosses.js` | Fonction de tir du Berserker écrite | Sa rafale ne lève plus d'erreur |

Seuls les deux premiers étaient demandés au départ ; les autres relèvent de la phase 0, validée ensuite (HW-DEC-52). Le tir du Berserker inflige 60 de dégâts : c'est une valeur provisoire de ma part.

## 3. Ce qui a été vérifié en jeu

Essais automatisés dans Chromium le 13 novembre 2026.

| Vérifié | Résultat |
|---|---|
| Construction (`vite build`) | Réussie |
| Menu, choix du chasseur, de l'arène, préparation | Fonctionnent |
| 8 arènes, 45 secondes chacune, 7 chasseurs | Aucune erreur en console |
| Rendu 3D | Fonctionne (capture en jeu à Val Verde) |
| Vagues | Jusqu'à la vague 5 |
| Défaite et écran de fin | Fonctionnent |
| 11 types de boss, 25 secondes de combat chacun | Aucune erreur ; les phases 2 se déclenchent |
| 11 types de boss, mise à terre puis exécution | Tous restent étourdis à 1 point de vie, l'exécution les retire et donne de 2 500 à 8 000 d'honneur |

### Phase 1, codée le 13 novembre 2026

| Ajout | Vérifié dans les 8 arènes |
|---|---|
| Mode campagne par défaut ; mode sans fin sur Maj+M | Oui |
| Après la dernière vague, le boss propre à l'arène apparaît, une seule fois | Oui : le boss apparu est celui déclaré |
| Exécuter ce boss termine la chasse en victoire | Oui : écran « Victoire glorieuse » |
| Pause par Échap, avec reprise ou abandon | Oui |
| Bouton « Menu principal » de l'écran de fin | Oui : il ramène au menu |
| Los Angeles et la pyramide ont un vrai boss (Abomination Predalien, Reine impériale) | Oui |
| Cartes d'arène lisibles (nombre de vagues, description) | Oui |
| Confettis réservés à la victoire | Codé |
| Version v58.1 dans le titre, le sous-titre et `package.json` | Codé |

Pour ces essais, la dernière vague a été atteinte par une commande de test, puis le boss mis à terre et exécuté par commande.

### Suite de la phase 1, codée le 13 novembre 2026

| Ajout | Vérifié dans les 8 arènes |
|---|---|
| Prétorien de garde, boss de Val Verde : la collerette encaisse 60 % des coups de face, charges, dos exposé | Oui |
| Points de vie des boss selon la courbe provisoire (3 500 à 10 000) | Oui : chaque boss a la valeur de sa chasse |
| Soutiens selon l'arène (onglet `15_Soutiens`) | Oui : alliés, marines, synthétiques présents seulement là où prévu |
| Garde nationale à Gunnison | Oui : 4 soldats en gris-vert, sans tourelle |
| Armes humaines à ramasser : 4 caisses au départ, 1 par vague, munitions à zéro sinon | Oui, dans les arènes à caisses |
| Décor générique rendu à son arène | Oui : aucune erreur |

Choix de ma part : le Bad Blood de la vague 3 n'apparaît plus que dans la réserve de chasse ; le Prétorien a 3 500 points de vie et ses charges infligent 260. Les décors de LV-426, LV-223, Planète 4, Fiorina 161 et de l'Auriga restent dans le code mais ne sont plus construits : ils attendent les lieux futurs.

**Effet observé** : sans les soutiens et sans les décors utiles (bornes de recharge, baies médicales) dans la plupart des arènes, le chasseur seul meurt dès la vague 1 ou 2 sous saisies automatiques dans les 8 arènes. L'équilibrage est à faire avec un vrai joueur.

**Reste de la phase 1** : l'équilibrage, et une chasse jouée par un humain.

### Phase 2, codée le 14 novembre 2026

Le combat a été refait autour du kit du chasseur (`js/systems/HunterKit.js`) : tronc commun, quatre emplacements par chasseur, un Musou propre à chacun, verrouillage, changement d'arme, camouflage, mises à mort contextuelles et ouverture furtive. Commandes dans l'onglet `05_Controles`.

Vérifié par essais automatisés pour les sept chasseurs : chaque emplacement, le camouflage, le changement d'arme, le verrouillage, l'arme humaine, le medicomp et chaque Musou se déclenchent sans erreur ; la ruche reste inerte pendant l'ouverture furtive, une mise à mort silencieuse ne l'alerte pas, retirer le camouflage l'alerte, une élite blessée s'exécute.

Choix de ma part, à corriger après essais : les dégâts et rayons des sept Musou, les recharges, les 25 secondes d'ouverture furtive, le seuil de 25 % pour exécuter une élite.

**Limites de ces essais.** Les boss ont été appelés par une commande de test, pas atteints en jouant. Le chasseur était rendu invulnérable pendant les combats de boss. Les saisies sont automatiques : rien ne dit que le jeu est agréable ni équilibré.

**Non vérifié** : une chasse jouée de bout en bout par un humain, les soutiens, la forge, la coopération, le son, les performances sur une vraie carte graphique.

**Observé** :
- Depuis le correctif 6, des systèmes qui n'avaient jamais tourné s'exécutent. Sous saisies automatiques, une partie atteint la vague 5 et 490 éliminations en 45 secondes ; avant, elle plafonnait à la vague 2. L'équilibrage est à reprendre entièrement.
- Dans 3 arènes sur 8, le chasseur meurt dès la vague 1.
- Des confettis sont tirés sur l'écran de défaite, et le filtre de vision reste affiché derrière.

## 4. Ce que le jeu fait aujourd'hui

### Déroulement
- Menu → chasseur → arène → préparation → mission.
- Au départ : 55 ennemis, 16 unités fixes, 3 alliés Yautja, 4 marines, 3 synthétiques, un planeur.
- Vague suivante quand il reste moins de 10 ennemis : 45 + 15 par numéro de vague.
- Vagues 2 et 4 : frappe aérienne. Vague 3 : Bad Blood et blindé. Vague 5 : toujours le même boss (Matriarche Predalien, 10 000 points de vie), quelle que soit l'arène.
- La campagne est le mode par défaut : après la dernière vague vient le boss de l'arène, et son exécution donne la victoire. Le mode sans fin s'active par Maj+M.
- Défaite à zéro point de vie. Pause par Échap.

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
6. **`window.gameInstance` était lu 182 fois et n'existait pas** (l'objet s'appelle `window.game`). Corrigé : tout ce qui en dépendait tourne désormais, pour la première fois.
7. **Un boss ne mourait pas par les dégâts et pouvait se relever** ; des ennemis à zéro point de vie restaient actifs. Corrigé.
8. **Deux forges, deux roues d'armes, deux parades, deux tourelles** : chaque ajout a doublé un système au lieu de l'étendre.
9. **La campagne en cinq chapitres est un titre affiché** : quatre niveaux sur cinq n'existent pas.
10. **Six numéros de version différents** selon le fichier.

La liste priorisée est dans l'onglet `11_P0_Defauts`.

## 6. Ordre de travail proposé

1. **Stabiliser** : fait pour les erreurs ; reste une chasse jouée de bout en bout par un humain, et l'équilibrage (HW-BUG-21, 23).
2. **Donner une fin** : fait le 13 novembre (victoire par exécution du boss d'arène, pause, retour au menu).
3. **Rendre chaque arène à elle-même** : trois boss manquants, décor générique réparti (HW-BUG-15).
4. **Resserrer le kit** : tronc commun, quatre emplacements, Musou par chasseur (HW-BUG-10, 11).
5. **Unifier** : une forge, une roue, un numéro de version.

Aucun contenu nouveau avant la fin de l'étape 2.

## 7. Outils de projet

- Spec Kit et Claude Code Game Studios sont appliqués au dépôt ; Superpowers 7.0.0 est activé en portée projet (la révision documentée dans `.ai-tools/sources.json` est la 7.0.2).
- `project.yaml` n'existe pas : le moteur réel (three.js, sans moteur de jeu) n'est pas encore déclaré à Game Studios.
- Aucun test de jeu, aucune intégration continue.
