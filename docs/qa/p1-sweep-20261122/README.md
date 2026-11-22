# Passe P1 du 22 novembre 2026

Cette passe suit celle du 21 novembre (`docs/qa/p1-sweep-20261121/`). Aucun statut du suivi n'est changé ici : chaque point reste « À valider » ou « En cours » tant qu'une partie réelle ne l'a pas confirmé.

## Ce qui a changé

| Point | Constat | Changement | Preuve |
| --- | --- | --- | --- |
| AUD-031 silhouettes | Aucun test ne comparait les rôles sans couleur. Le mitrailleur (lourd) avait exactement la silhouette du marine (0,96). | Test `role-silhouettes` : rendu noir et blanc, de face et de profil, à une échelle fixe. Le mitrailleur reçoit batterie, bras de soutien et arme volumineuse ; l'infirmier un brancard roulé ; le technicien un mât et une antenne. | Le test échoue sur l'ancien modèle et passe sur le nouveau. Chaque paire de rôles d'une même faction est à 0,77 au plus. |
| AUD-031 / AUD-025 chef de la ruche | 567 guerriers xénomorphes qui mènent leur groupe avaient le modèle du guerrier ordinaire. | Un guerrier chef porte le modèle d'officier de la ruche. Type, stats et comportement sont inchangés. | `hive-officer-visual` |
| AUD-031 / AUD-026 chef de cellule Yautja | Environ 360 chefs de cellule, dans les deux clans, avaient la figure de leurs soldats. | Cape, totem à trophée au-dessus de l'épaule et épaulières d'os (visuel seulement). | `role-silhouettes` (ligne et chef Yautja) ; capture dans AFF-01 : 5 chefs marqués sur 17 chasseurs de clan, aucune erreur |
| AUD-031 chef humain | Aucun modèle détaillé d'officier humain. | Modèle Meshy d'officier pour les officiers génériques et USCM. Les chefs nommés et corporatifs gardent le leur. | `officer-model` ; capture dans AFF-08 |
| AUD-124 Feral | La taille du boss n'était mesurée ni face au joueur ni face aux accès. | Mesure : 4,60 contre 4,31 pour les chasseurs jouables (+7 %, plafonné à 10 %). Le corps de 3,76 passe dans chaque couloir de la carte Prey. | `feral-scale` |
| AUD-123 Prey 1719 | Le mode fidèle chargeait encore la ruche xénomorphe, que le film ne contient pas. | En mode fidèle, la chasse du Territoire Comanche ne contient que des loups gris menés par un grizzly. Le Feral reste le boss final et l'appui USCM reste exclu. L'option de fidélité nomme la variante. | `prey-1719-faithful` ; dans Chromium : seulement des « Loup gris » au premier secteur, aucune erreur |

Les animaux de 1719 utilisent les silhouettes génériques de faune du jeu : ce ne sont pas des loups ni des ours modélisés.

## AUD-057 : échelle des batailles par lieu

Mesures tirées de `createBattlefieldLayout` et du plan de secteurs :
- densité voulue en combattants pour 1 000 unités² ;
- temps de trajet sans opposition entre deux centres de secteur, à la vitesse du Jungle Hunter.

| Lieux | Secteurs | Emprise (unités) | Densité min – max | Trajet entre secteurs (s) | Trajet total (s) |
| --- | ---: | --- | --- | --- | ---: |
| Les 12 lieux de chasse, LV-223 compris | 6 | 302 × 642 | 0,92 – 2,18 | 10,6 | 53 |
| Cartes de bataille LD-01 à LD-34 | 9 à 20 | 724 × 928 à 2 432 × 3 020 | 0,61 – 2,33 | 13,9 à 70,9 | 155 à 1 101 |

**Constat.** Les douze lieux de chasse ont exactement la même échelle : mêmes dimensions, même densité, mêmes trajets. Un toit de Los Angeles, la pyramide antarctique et la jungle de Val Verde ne se distinguent que par leur décor. Les cartes de bataille varient, elles, de 9 à 20 secteurs.

**Pas de correction ici.** Donner une échelle propre à chaque lieu de chasse changerait la durée et la densité de toutes les chasses ; c'est une décision de conception, laissée à l'auteur. La durée visée par la feuille de route (5 à 8 minutes par chasse) reste compatible avec 53 s de trajet sans opposition.

## Vérification

Avant chaque avancée de `master`, sur le même commit :
- suite Node complète : 1 635 tests réussis, 0 échec, 1 ignoré, sur `c513fa1` ;
- tests navigateur : 16 sur 16.

Les captures en jeu sont des vues fixes prises par script, pas des parties jouées.
