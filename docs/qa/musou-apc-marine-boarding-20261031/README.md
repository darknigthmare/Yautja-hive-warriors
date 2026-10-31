# M577 — embarquement de section USCM à effectifs constants (31 octobre 2026)

**PR #6** : `codex/hive-nodes-ci-20261030`
**Base** : `51ea97546c9381a4c2e82e021900fd0cc8d41fde`

## Contrat source et adaptation

Le **M577** des *Aliens* est un transport de Marines équipé d'une
station tactique et de tourelles. Les références, notamment le
*Aliens Colonial Marines Technical Manual*, décrivent **12 places
passagers** et **2 postes d'équipage**. Ces places ne sont pas
des unités militaires supplémentaires.

Références :
- https://www.avpcentral.com/m577-apc
- https://www.avpgalaxy.net/games/aliens-dark-descent/vehicles/
- https://anyflip.com/voqqd/rcai/basic/51-100

La répartition automatique d'un synthétique de soutien comme
chauffeur, lorsqu'une section d'Extinction en contient un, est
**une adaptation originale à Yautja Hive Warriors**, pas une
reconstitution d'une scène précise du film.

**Notre gameplay reste un Musou façon Dynasty Warriors** :
les groupes existants combattent en parallèle, et l'APC
est un support physique, pas un bâtiment RTS produisant des Marines.

## Ce qui est développé

### 1. Section embarquée réellement finie

`js/battlefield/APCSectionManifest.js` distingue
**2 postes d'équipage** (chauffeur/chef de section) des
**12 sièges passagers**, avec validation de type,
faction, état et capacité.

Seules les unités **déjà allouées** du camp USCM peuvent
embarquer. Les Marines, Smartgunners, Flametroopers,
Medic, CommTech ou Snipers existants utilisent leurs
vraies identités ; un Synthetic de la section peut
tenir un poste d'équipage. Un Exosuit plus volumineux,
un hôte infesté, un blessé incapable de marcher, une
réserve non sortie ou un soldat d'une faction hostile
est refusé.

Pour l'opération originale **AFF-27 / LV-742**,
une section `GRP-60 H-LIGNE` comportant déjà
**8 combattants** embarque avec **2 postes d'équipage
et 6 passagers**. Ce ne sont pas 8 unités nouvellement
créées : les 8 identifiants ont toujours leur nombre,
PV, rôle, caste, matériel et groupe d'origine.

### 2. Autorité du combat et protection

`BattleSimulation.boardAPC` :
- vérifie une section vivante, disponible, non infiltrée,
  proche du vrai blindé et du bon front ;
- retire au besoin sa matérialisation 3D **sans créer
  de mort ni perdre ses blessures** ;
- marque ses vrais sièges/équipage sur les identités
  déjà allouées, et enregistre le manifeste ;
- empêche ces unités de tirer hors caméra, capturer
  un front, suivre des ordres de troupe en marchant
  ou se rematérialiser à côté du M577.

Une seule section est embarquée par véhicule dans
cette première passe. Elle ne reçoit aucun
ravitaillement ou soin artificiel. Une attaque de
soldat ne peut pas transpercer le blindage en
appelant directement `recordDeath` : les pertes
doivent passer par le système du véhicule.

Lors d'une **destruction effective du M577**, l'état
d'occupation est vidé et chaque membre embarqué
est comptabilisé **une seule fois** comme perte
à l'identité et au journal existants.
Aucun respawn, aucune place de réserve magique.

### 3. Débarquement au sol

`APCMarineService.disembark` cherche des places
de sortie autour de la porte et de l'arrière du
véhicule en tenant compte :
- de la hauteur du plancher et de la différence
  entre deux étages ;
- des colliders réellement actifs, des portes
  et de la visibilité des sorties ;
- de la capsule de chaque membre et des autres
  acteurs déjà présents dans le secteur.

Le débarquement est **atomique**. Si une seule
personne n'a pas de place sûre, aucune n'est
déposée dans le vide ou un mur et la section
reste embarquée. La sortie réussie réattribue
des coordonnées légales aux mêmes huit identités.

Les commandes **USCM M577 : EMBARQUER /
DÉBARQUER** sont ajoutées à la zone
`TACTIQUES D'APPUI (OPTIONNELLES)`.
Un chasseur Yautja ne peut les utiliser que
si le véhicule est disponible, proche et
autorisé par la relation entre les factions.
Une section USCM hostile ne devient jamais
une unité contrôlable gratuitement par le joueur.

### 4. Sauvegardes sans nouveau roster

`BattleSimulation.saveState` enregistre
`apcManifest` : IDs du groupe, équipage,
passagers, positions, propriétaire, front et
date d'embarquement. Le `configDigest`
reste **strictement identique**.

`BattleSimulation.fromState` rejette notamment
les sièges inventés, ID inconnus, doubles
passagers, faux chauffeur, autre espèce ou
faction, usurpation de groupe, coordonnées
hors de portée et dates futures. Une ancienne
sauvegarde **sans manifeste** reste valide.
Si la sauvegarde prétend contenir des passagers
mais que son APC support est déjà détruit ou
absent à la reprise, le chargement est refusé,
plutôt que ressusciter un véhicule inexistant.

### 5. Tests

Le fichier `tests/apc-marine-section.test.js`
contient **9 scénarios Node/Three** :

- capacité de section et de l'équipage ;
- absence de tirs, de capture ou de duplication
  pendant l'embarquement ;
- sauvegarde/reprise avec groupe, réserves et
  `configDigest` constants ;
- refus d'un manifeste modifié ou falsifié ;
- immunité des groupes hostiles/incompatibles ;
- embarquement et débarquement réels
  de la section sur un sol autorisé ;
- arrêt complet du débarquement bloqué ;
- perte unique des passagers lors de la
  destruction du support ;
- position de la section synchronisée à
  l'APC sans saut de plusieurs fronts.

Ces tests sont ajoutés au workflow GitHub
Actions Node 24, puis à `npm test`
avec Chromium. **Ne pas déclarer leur réussite
avant de consulter le run du commit.**

## Ce qui n'est PAS encore terminé

- Le **M577 de support actuel est stationnaire** :
  ce lot pose les fondations de chargement et
  de sauvegarde d'une section. La conduite
  du lourd blindé sur des routes physiques
  d'une zone à une autre, sa suspension, ses
  roues et son animation de déplacement sont
  encore à développer.
- Pas d'animation complète des portes, bancs,
  consoles, harnais, pilote/commandant, ni
  vue intérieure 1:1. Les deux postes
  d'équipage sont une logique de gameplay,
  pas des meshes identiques au plateau
  du film.
- Le transport **UD-4 Cheyenne** d'un APC
  chargé et les opérations multi-étages avec
  ascenseurs restent à réaliser.
- Plusieurs sections dans des M577 distincts
  nécessiteront des véhicules et des manifests
  explicitement alloués : la première passe
  ne duplique jamais un véhicule.
- Les références du M577 proviennent
  d'ouvrages et médias différents dont
  les détails peuvent varier. Pour les
  versions exactes de 1986, 2003 et autres,
  les différences seront consignées avant
  d'utiliser une texture ou un modèle 1:1.

**Statut : fondation d'embarquement/protection/
débarquement et persistance, pas encore
transport routier complet ni fidélité visuelle 1:1.**
