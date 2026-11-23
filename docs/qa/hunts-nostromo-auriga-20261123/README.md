# Chasses du Nostromo et de l’USM Auriga (23 novembre 2026)

Suite des chasses Alien choisie par l’auteur. Aucun crédit Meshy utilisé.

| | Nostromo | USM Auriga |
| --- | --- | --- |
| Source | *Alien* (1979), 2122 | *Alien Resurrection* (1997), 2381 |
| Identifiant | `nostromo_refinery` | `usm_auriga_labs` |
| Boss | Xénomorphe du Nostromo (`nostromo_drone`) : modèle existant de guerrier, mis à la taille du boss | Reine xénomorphe, déjà au registre |
| Échelle des secteurs | 0,85 (coursives) | 0,95 |
| Mécanismes | passerelles, vapeur de la salle des machines, cloisons étanches, transformateurs | cuves de laboratoire, sas de décontamination, cloisons, passerelles, résine et œufs |
| Appui humain | aucun : équipage civil de sept personnes | aucun : l’USM n’est pas l’USCM |
| Marines coloniaux, caches d’armes | aucun | aucun |

## Ce qui est une adaptation

- **Les chasses Yautja.** Aucun des deux films ne montre de Yautja.
- **La ruche du Nostromo.** Le film ne montre qu’un seul Xénomorphe.
- **Le Nouveau-né d’*Alien Resurrection*.** Il n’est pas représenté.
- **Le rythme du Xénomorphe du Nostromo** (`vent-ambush`) :
  - après une morsure, il disparaît 3,2 s dans les conduits, et rien ne l’atteint pendant ce temps ;
  - 1,1 s avant sa chute, un anneau marque le point de chute, à 7 unités derrière le chasseur ;
  - un chasseur resté dans l’anneau est mordu ; celui qui en sort n’est pas touché ;
  - après la chute, il reste exposé 1,3 s.

  Ces valeurs sont des choix de jeu.

## Vérification

- **Matrice des contre-jeux, cas `nostromo_drone`** : morsure, disparition, aucun dégât reçu dans les conduits, anneau annoncé, chute au point exact, morsure seulement si le chasseur reste dans l’anneau.
- **Contrôle des phases de boss** (`boss-preflight-depth`). Il attend désormais que le boss ressorte avant de le frapper : on ne frappe pas à travers les conduits.
- **`hadley-fiorina-hunts`** : couvre aussi ces deux chasses, y compris l’absence de Marines et de caches.
- **Suite Node complète** : 1 688 réussis, 0 échec, 1 ignoré. Catalogue vérifié.
- **Approche des boss dans Chromium.** Secteur final, portes ouvertes, ouverture furtive de l’insertion retirée, 12 s :
  - la Reine (Hadley’s Hope), l’Ingénieur (LV-223), le Runner (Fiorina) et le Xénomorphe du Nostromo s’approchent et mordent ;
  - le Runner rompt le contact jusqu’à 24 unités.

  Une première sonde semblait montrer des boss immobiles. C’étaient deux artefacts de la sonde : les portes fermées ramenaient le joueur et le boss dans le secteur d’insertion, et le joueur restait caché par l’ouverture furtive. Ce n’étaient pas des défauts du jeu.
- **Captures** : vues fixes de l’insertion, sans erreur de page.

**Cadence du Xénomorphe du Nostromo** (vérifiée le 23 novembre, après réglage de la chute). La sonde lit chaque demi-seconde le créneau d’attaque du `CombatDirector` :
- pendant les 7 premières secondes, la grâce de début de combat du `CombatDirector` bloque toute attaque, comme pour tous les boss ;
- vers 7 s : morsure (−35), puis enfouissement ;
- vers 10,5 s : morsure de chute sur le chasseur resté immobile (−55).

Aucun autre attaquant ne tenait le créneau. Ce n’est pas un défaut : la « morsure unique en 12 s » venait de cette grâce.
