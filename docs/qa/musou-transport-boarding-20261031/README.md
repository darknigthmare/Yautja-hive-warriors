# Musou — embarquement et débarquement Yautja à la bonne hauteur

Date : 31 octobre 2026
PR : [#6](https://github.com/darknigthmare/Yautja-hive-warriors/pull/6)
Base vérifiée : `9be0c421690abdb6753dbfd7f596e960d9de91bf`

## Contrat de gameplay

Yautja Hive Warriors reste un **jeu d'action Musou** dans lequel
le Skimmer est conduit par le personnage Yautja pendant que des
armées déjà allouées s'affrontent en parallèle.

Les véhicules ne sont pas des unités produites ou sélectionnées
dans une boucle RTS à la manière d'*Aliens versus Predator:
Extinction*. Les valeurs de distance et de hauteur ci-dessous
sont des réglages originaux, non des spécifications canoniques.

## Bug de navigation verticale corrigé

L'ancien `OperationTransport.interact` acceptait un joueur à
moins de 4,5 unités **horizontalement**, même lorsqu'il était
debout plusieurs mètres au-dessus du véhicule. Après un trajet,
le débarquement créait directement un point à +3 unités en X,
appliquait une poussée de collision, puis projetait la hauteur
sans refuser un obstacle, un vide ou une différence entre étages.

Un joueur pouvait alors monter à travers une mezzanine, ou
descendre du Skimmer en sautant d'un étage à l'autre.

### Nouveau comportement dans le monde physique

- L'embarquement exige une différence de hauteur d'au plus
  **1,8 unité**, en plus de la distance et du contrôle d'un
  pilote unique déjà appliqués.
- Le débarquement cherche quatre espaces proches autour
  du Skimmer selon son orientation. Il interroge
  `Environment.getElevationAt(x,z,skimmerY)` pour choisir le
  **bon étage**.
- La position n'est admissible que si le dénivelé entre le
  Skimmer et le sol est dans la limite prévue ; un Skimmer
  arrêté à plusieurs mètres au-dessus du sol **ne peut pas
  déposer instantanément son pilote en bas**.
- Quand `BattlefieldNavigation` est présent, les candidats
  doivent être praticables via `canStand`, puis peuvent
  être ajustés à l'intérieur d'une petite zone par
  `safeSpawnNear`. La recherche garde la protection
  contre les murs, les portes et les autres capsules.
- S'il n'existe aucun sol praticable, **aucun état n'est
  perdu** : le pilote reste monté, son modèle demeure
  caché dans la monture, et un message indique
  `no_safe_dismount`. Le joueur peut reprendre le
  pilotage ou rejoindre une zone de débarquement valide.
- Lors d'un débarquement valide, la position du modèle
  et la position de gameplay sont synchronisées au même
  `Vector3` choisi par le moteur.

### Conservations

Aucun nouvel acteur, ennemi, allié, support, véhicule ou
équipement n'est créé. Les ressources, soldes, checkpoint
`configDigest`, contrats de factions, points d'honneur,
positions des armées et comportements des renforts
restent inchangés.

## Tests

Le fichier `tests/musou-transport-boarding.test.js`
contient **six tests Node/Three** :

1. refus d'embarquer depuis un étage trop haut ;
2. débarquement sur la vraie passerelle à 4,7 unités ;
3. refus de débarquer au-dessus du vide, sans perte du pilote ;
4. recherche de la première aire latérale praticable ;
5. échec sûr lorsque les quatre côtés sont obstrués ;
6. embarquement et débarquement classiques préservés.

Les anciens tests `operation-transport.test.js` et
`operation-transport-vertical.test.js` restent intacts.
Le nouveau fichier est ajouté à GitHub Actions avec
`npm ci`, `npm run build`, tests Node ciblés puis
suite Chromium complète.

Une vérification **isolée** de la méthode a confirmé :
sol y=0, passerelle y=4,7, et hover y=8,5 au-dessus du sol.
Ces cas ne sont **pas** présentés comme une validation
intégrée tant que le workflow GitHub de ce SHA n'a pas fini.

## Restant à vérifier

- Entrées/sorties d'une navette close et d'un grand APC ;
- portes à plusieurs étages, variations de gravité et
  plateformes mouvantes ;
- rampes et routes aériennes 3D détaillées ;
- animations de montée et de descente fidèles aux
  différents personnages et Skimmers ;
- synchronisation exacte en coopération locale et
  réglage du niveau de détail pour plusieurs joueurs.

**Le Skimmer est jouable, mais son modèle et ses animations
ne sont pas certifiés visuellement 1:1.**
