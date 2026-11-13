# Predator: Hive Warriors — Vision et conception

> Bible du jeu, document 1 sur 3. Statut : **cible validée par l'auteur le 12 novembre 2026** (décisions HW-DEC-01 à 16).
> Ce document dit ce que le jeu doit être. Ce qu'il est réellement aujourd'hui est dans [etat-reel-v58.md](etat-reel-v58.md).
> Les chiffres et listes sont dans [annexes-tables.md](annexes-tables.md) et dans le classeur `design/Yautja_HiveWarriors_V58_Bible.xlsx`.

## 1. En une phrase

Un chasseur Yautja de légende, seul contre des centaines de Xénomorphes, dans huit lieux mythiques de la saga : on taille la horde, on charge la jauge Musou, on arrache le trophée du boss.

## 2. Identité

| | |
|---|---|
| Genre | Musou 3D à la troisième personne (« un contre cent ») |
| Plateforme | Navigateur de bureau, clavier et souris |
| Technique | three.js 0.160, vite 5, son entièrement synthétisé, aucune ressource graphique ou sonore externe |
| Langue | Français |
| Durée d'une chasse | 10 à 15 minutes |
| Place dans l'univers | Jeu frère de « Yautja : La Longue Chasse » (2D), classé **chroniques légendaires** : hors canon de la campagne commune, voir [canon-et-regles-editoriales.md](canon-et-regles-editoriales.md) |
| Diffusion | Projet de fan non commercial (HW-DEC-09) |

## 3. Le fantasme du joueur

Être le chasseur que les films ne montrent qu'un instant : celui qui entre dans la ruche et en ressort avec le crâne de la reine. La puissance est immédiate, la horde est innombrable, et la récompense est un trophée arraché à la main.

## 4. Les piliers

L'ordre compte : quand deux idées s'opposent, le pilier le plus haut l'emporte.

### Pilier 1 — Un contre cent
Le joueur affronte des dizaines d'ennemis à la fois et les balaie par des enchaînements larges.
- Test : une attaque légère touche-t-elle plusieurs ennemis ? Une vague compte-t-elle au moins 50 ennemis ?
- Conséquence : les alliés, véhicules et soutiens sont conservés (HW-DEC-12), mais ils ne doivent jamais faire le travail à la place du joueur : la horde reste assez nombreuse pour que le chasseur en élimine la plus grande part.

### Pilier 2 — L'arsenal du chasseur d'abord
Chaque chasseur a un kit Yautja court et reconnaissable. Les armes humaines (M41A, Gauss M77, Seegson) sont conservées comme armes prises à l'ennemi (HW-DEC-12).
- Test : le cœur du kit existe-t-il au poignet, à l'épaule ou à la ceinture d'un Yautja ?
- Conséquence : une arme humaine complète le kit, elle ne le remplace pas. La métamorphose hybride sort du jeu : elle contredit le canon.

### Pilier 3 — Le trophée se mérite
Un boss ne tombe pas à zéro point de vie : il chancelle, et le joueur l'exécute. C'est l'exécution qui gagne la chasse.
- Test : la victoire passe-t-elle par un geste du joueur au contact ?
- Conséquence : le jeu a une fin par chasse, et la mise en scène du trophée est le sommet de chaque arène.

### Pilier 4 — Chaque lieu est une chronique
Chaque arène évoque un lieu précis de la saga, avec son boss, ses repères et ses dangers propres.
- Test : reconnaît-on l'arène sans lire son nom ? Y trouve-t-on quelque chose qui n'existe nulle part ailleurs ?
- Conséquence : les éléments de décor génériques posés partout (réacteur, Space Jockey, sarcophage) sont rendus à leur arène d'origine.

### Ce que le jeu n'est pas
- **Pas un jeu d'infiltration.** Camouflage et visions servent d'ouverture et de respiration, jamais de condition de réussite.
- **Pas un jeu de gestion d'armées.** Alliés, marines, blindés et frappes peuplent le champ de bataille ; le joueur ne les commande pas en détail.
- **Pas une reproduction certifiée des films.** Les lieux et chasseurs sont des hommages, « inspirés de », jamais « 1:1 ».
- **Pas un jeu de collection de 54 touches.** Ce qui ne tient pas dans le kit n'est pas dans le jeu.

## 5. Boucles de jeu

- **30 secondes** : enchaîner des attaques légères (5 temps), placer une finition lourde, voir la horde voler, la jauge Musou monter (+2 par coup, +6 par élimination).
- **5 minutes** : nettoyer une vague, dépenser le Musou à 100, utiliser un emplacement sur une unité d'élite, parer et riposter.
- **Une chasse (10 à 15 minutes)** : 5 ou 6 vagues, puis le boss de l'arène ; le faire chanceler, l'exécuter, emporter le trophée.
- **Long terme** : 8 chasses dans l'ordre de la campagne ; chaque arène terminée ouvre son mode sans fin pour le score ; l'honneur gagné améliore le chasseur à la forge.

## 6. Structure cible

### Campagne : huit chasses
Une chasse par arène, dans l'ordre de l'onglet `08_Arenes` (HW-DEC-16) : Val Verde, Los Angeles, Gunnison, pyramide antarctique, réserve de chasse, base Charon, station Renaissance, Xenomorph Prime. Les points de vie des boss seront recalés en courbe croissante. Règles :
1. La chasse compte le nombre de vagues déclaré pour l'arène (5 ou 6).
2. Une vague suivante arrive quand il reste moins de 10 ennemis.
3. Après la dernière vague apparaît **le boss propre à l'arène**, et lui seul.
4. Sous un seuil de points de vie, le boss est étourdi ; le joueur l'exécute au contact. **L'exécution termine la chasse en victoire.**
5. La défaite survient à zéro point de vie du chasseur.
6. Terminer une chasse ouvre la suivante et le mode sans fin de l'arène.

La campagne actuelle en cinq chapitres (`StoryCampaign.js`) est remplacée par cette structure : quatre de ses cinq niveaux n'existent pas.

### Mode sans fin
Par arène, une fois la chasse terminée. Vagues croissantes (45 + 15 par vague aujourd'hui), boss de l'arène toutes les trois vagues, classement au score et à la vague atteinte.

### Bac à sable et mode photo
Conservés comme outils secondaires, sans priorité.

## 7. Le chasseur

### Tronc commun (identique pour les sept chasseurs)
Attaque légère, attaque lourde, canon plasma, Musou, parade, esquive, camouflage, vision, medicomp, interaction et exécution. Touches proposées dans l'onglet `05_Controles`.

### Quatre emplacements
Choisis à l'écran de préparation parmi les capacités retenues (onglets `03_Arsenal36` et `04_HorsRegistre`). Un kit par défaut est proposé pour chaque chasseur dans l'onglet `02_Chasseurs`. Ces kits sont des **propositions à valider** : le code ne les contient pas.

### Un Musou par chasseur
Les sept noms existent déjà dans les fiches (Surcharge Plasma, Solvant d'Acide, Massacre à la Faux, Charge de Bouclier, Entaille du Dragon, Frénésie du Valhalla, Tempête de Disques). Aujourd'hui tous déclenchent le même effet (1200 de dégâts dans un rayon de 40). La cible est un effet distinct par chasseur.

### Différences entre chasseurs
Points de vie 850 à 1350, vitesse 14 à 19, mêlée 100 à 175, plasma 180 à 280. Le City Hunter est le plus fragile et rapide, le Viking le plus lent et résistant.

## 8. La horde

- **La masse** : drones, coureurs, facehuggers, cracheurs. Ils meurent en un ou deux coups et alimentent le Musou.
- **Les élites** : broyeur, prétoriens, officiers de ruche. Un par vague ou presque ; ils demandent un emplacement, une parade ou une finition.
- **Le boss** : un par arène.

Le code fait aujourd'hui apparaître 16 unités fixes à chaque vague, dont six titans de 1200 à 4200 points de vie. La cible est de les répartir : chaque arène reçoit les élites qui lui correspondent, pas toutes à la fois.

## 9. Progression

- **Honneur** : le score de la chasse (25 par coup, 150 par élimination, 900 à 8000 par exécution) devient une monnaie réellement dépensée.
- **Forge** : une seule forge au lieu de deux (celle du menu et celle de la touche F3 font doublon).
- **Trophées** : un trophée par boss exécuté, exposé dans la citadelle du menu.
- **Bio-masques** : débloqués par la campagne ; ils gardent leurs bonus de combat, comme la forge (HW-DEC-11).
- **Clan** : le clan du joueur reste anonyme (HW-DEC-10).
- **Coopération locale** : conservée (HW-DEC-12) ; le second joueur doit recevoir le même kit que le premier.
- **Armes humaines** : ramassées sur le champ de bataille, munitions limitées (HW-DEC-13).
- **Soutiens** : présents selon l'arène, plus jamais partout (HW-DEC-14, onglet `15_Soutiens`).
- **Lien avec La Longue Chasse** : Hive Warriors lit la progression de La Longue Chasse sans rien y écrire, et débloque du contenu propre à ce jeu, comme ses personnages originaux (HW-DEC-15, onglet `16_Deblocages`). Le moyen technique de cette lecture reste à choisir (Q11).

## 10. Direction visuelle et sonore

- Palette de l'interface : rouge `#ff1a1a`, or `#ffb703`, vert acide `#39ff14`, cyan plasma `#00d2ff`, fond `#07090e`, panneaux translucides. Polices Orbitron et Rajdhani.
- Tout est modelé en géométrie simple dans le code : pas de modèles ni de textures importés.
- Son : 100 % synthétisé (environ 257 sons). Aucun son de film, conformément à la règle héritée de La Longue Chasse. La musique se réduit aujourd'hui à un bourdon à 55 Hz ; une vraie direction musicale reste à écrire.
- Cinq modes de vision (normal, thermique, électromagnétique, technique, sonar), rendus par des filtres d'écran.

## 11. Risques

| Risque | Nature | Parade |
|---|---|---|
| Le code a grandi de v34 à v58 sans jamais s'exécuter | Technique | Stabiliser avant tout ajout ; essai en navigateur à chaque version |
| Aucune limite d'ennemis ni mise en commun des maillages | Performance | Plafond d'ennemis et instanciation avant d'augmenter les vagues |
| Périmètre : 54 capacités, 26 types d'ennemis, 10 boss | Périmètre | Tri de l'onglet `04_HorsRegistre` ; rien de neuf tant que les 8 chasses ne se terminent pas |
| Noms, personnages et lieux sous licence | Droits | Non commercial ; vocabulaire « inspiré de » |

## 12. Première version visée

Une version est « jouable » quand :
1. les 8 chasses se lancent, se gagnent par exécution du boss et se perdent à zéro point de vie ;
2. aucune erreur n'apparaît dans la console pendant une chasse complète ;
3. le tronc commun et quatre emplacements fonctionnent pour les sept chasseurs, sans conflit de touches, y compris pour le second joueur ;
4. la pause et le retour au menu existent ;
5. le numéro de version est le même partout.

Les questions encore ouvertes sont dans l'onglet `13_Questions`.
