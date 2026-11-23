# Modèles Meshy des boss réutilisés (23 novembre 2026)

L’auteur a approuvé les trois chaînes : image, modèle 3D et rig. Solde : 1 695 crédits avant, 1 581 après, soit 114 dépensés (3 × 38). Identifiants des tâches : `meshy-tasks.json`.

| Boss | Référence | Résultat | En jeu |
| --- | --- | --- | --- |
| Néomorphe de Paradise | photo de la figurine NECA *Alien: Covenant* Neomorph (Toyark, galerie Alien Covenant, image 046) → `image-to-image` | fidèle à la figurine ; la marche est bonne | **oui** (`boss_paradise_neomorph`) |
| Reine xénomorphe | deux photos de la figurine NECA *Aliens* Alien Queen (Toyark, galerie de 2015, images 014 et 020) → `image-to-image` | silhouette reconnaissable, mais Meshy a perdu les petits bras secondaires et réduit la crête ; sac ovigère volontairement absent | **oui** (`boss_xenomorph_queen`) : pyramide, Hadley’s Hope, Auriga |
| Prétorien | aucune figurine NECA ; description d’après les jeux *Aliens versus Predator* → `text-to-image` | modèle correct, mais la queue, tendue en diagonale sur l’image, est liée aux os du bras : elle s’étire avec la main pendant la marche (`walk-cycles.jpg`, rangée du bas) | **non** : le Prétorien procédural reste en jeu |

## Limites

- **Ce sont des interprétations de figurines**, pas des relevés des films (`fidelity_1_to_1_verified: false`).
- **Rig bipède à 24 os** : la queue n’a pas d’os propre et suit le bassin.
- **Taille de la Reine.** Elle est mise à la hauteur du registre (6,2 unités, crête comprise), soit environ 1,4 fois le chasseur.
- **Repli.** Le modèle procédural reste dessous jusqu’au chargement, et en cas d’échec. Le combat ne dépend jamais du modèle.

## Vérifié dans Chromium

Secteur final de Paradise et de Hadley’s Hope : modèle chargé (`ready`), actions `walk` et `run`, aucune erreur de page. Vues fixes : `ingame-paradise.jpg`, `ingame-hadley.jpg`.

## Prétorien : pour corriger

Il faut une nouvelle image avec la queue pendante derrière le corps, puis un nouveau modèle et un nouveau rig : environ 38 crédits. C’est une décision de l’auteur.
