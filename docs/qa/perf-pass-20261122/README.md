# Passe de performances CPU du 22 novembre 2026

## Ce qui est mesuré, et ce qui ne l'est pas

Mesuré : le temps CPU de `game.update` (logique du jeu, sans rendu), dans un scénario figé, avant et après chaque changement, sur la même machine et avec le même navigateur.

Pas mesuré :
- le temps GPU (`gpuTimeAvailable: false`) ;
- le temps de rendu : dans ce conteneur, SwiftShader exécute le rendu sur le processeur, ce qui fausserait la mesure ;
- les images par seconde sur la machine de l'auteur.

Ces chiffres comparent deux versions du code. Ils ne décrivent pas les performances du jeu chez un joueur.

## Scénario

Le script de mesure est conservé hors dépôt : `perf.mjs`, dans le dossier de travail de la session.

- **Build** : production servie par `vite preview` dans Chromium sans interface (SwiftShader), conteneur de la session.
- **Opération** : AFF-08, l'une des plus denses, lancée depuis le menu.
- **Figé pour la mesure** : boucle du navigateur arrêtée, `Math.random` à graine fixe.
- **Joueur** : placé à 30 unités d'un front hostile, PV restaurés à chaque mise à jour.
- **Échauffement** : 300 mises à jour de 1/60 s.
- **Mesure** : 900 mises à jour de 1/60 s.
- **Charge observée** : 27 acteurs détaillés, 845 maillages dans la scène.
- **Profil** : CPU par le protocole DevTools, échantillonnage toutes les 200 µs.

## Profil de départ

| Fonction | Temps propre |
| --- | ---: |
| `Environment.resolveMovement` | 35,2 % |
| `resolveAgentMovementXZ` | 6,2 % |
| Dessin des marqueurs de minicarte (`drawAccessibleMarker`) | ≈ 8,5 % (build non minifié) |
| `traceCombatSegment` (ligne de vue) | ≈ 8,4 % (build non minifié) |

`resolveMovement` parcourait deux fois tous les colliders de la carte (plusieurs centaines) pour chaque acteur, à chaque mise à jour. La ligne de vue et l'évitement des agents faisaient le même parcours complet.

## Changements

1. **`ColliderBroadphase`** : une grille uniforme de cases de 24 unités reçoit les colliders statiques.
   - Les colliders dynamiques sont toujours testés : ceux qui résolvent leur propre forme, qui peuvent s'éteindre ou dont la position est un accesseur.
   - Les candidats sont rendus dans l'ordre croissant de la liste : les poussées s'appliquent dans le même ordre qu'avant.
   - Si une poussée déplace l'acteur au-delà de la demi-marge, la requête est refaite.
   - La grille n'est reconstruite que si la liste change ou si un collider statique a bougé (contrôle à chaque image de l'environnement).
2. La grille sert aussi à l'évitement des agents (`resolveAgentMovementXZ`) et aux tracés de segment (`traceSegment`, `hasLineOfSight`). On ne passe au tracé que les colliders dont l'emprise peut toucher le segment, dans l'ordre de la liste.
3. **Minicarte** : les redessins de chaque image sont limités à 10 par seconde. Un appel direct redessine toujours.

## Résultats (ms par mise à jour, 900 échantillons)

| Étape | Moyenne | Médiane | 95e centile |
| --- | ---: | ---: | ---: |
| Avant | 19,18 | 15,6 | 28,3 |
| Grille pour `resolveMovement`, reconstruite à chaque image | 17,38 | 14,2 | 24,0 |
| Grille reconstruite seulement si un collider bouge | 10,85 | 7,9 | 13,5 |
| Lignes de vue et minicarte | 8,24 | 5,4 | 12,0 |
| Évitement des agents | **7,81** | **4,8** | **9,2** |

La moyenne baisse de 59 %, la médiane de 69 %, le 95e centile de 67 %.

Une mise à jour isolée d'environ 2 s apparaît dans toutes les mesures, avant comme après. Elle n'est pas traitée ici.

## Preuve d'équivalence

`tests/collider-broadphase.test.js` compare chaque résultat, bit pour bit, à l'ancien parcours complet :
- `resolveMovement` : 7 500 positions aléatoires sur cinq cartes ;
- tracés de segment et lignes de vue : 2 400 segments sur trois cartes ;
- évitement des agents : 1 200 pas sur deux cartes.

L'échantillon contient de vraies poussées et de vrais segments bloqués. Le test de contre-flux AUD-063 et les suites complètes sont relancés sur ce commit.
