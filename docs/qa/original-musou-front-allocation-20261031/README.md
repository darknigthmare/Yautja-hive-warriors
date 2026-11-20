# AFF-06 à AFF-10 — déploiement des fronts Musou, fondé sur l'audit original

Date : 31 octobre 2026
Branche de travail : `codex/hive-nodes-ci-20261030` (PR #6).
Base avant correctif : `f03a30a4080a81cfa42a2366a6205ca6fcdb13b9`.

## Contrat de gameplay inchangé

**Yautja Hive Warriors est un jeu d'action Musou/Dynasty Warriors-like.**
Les factions alliées et ennemies se combattent sur de grands fronts
pendant que le héros Yautja poursuit ses objectifs physiques.
Les groupes comptabilisés sont des escouades finies qui demeurent
actives ou simulées en parallèle, pas des pions sélectionnables
dans une reproduction du RTS *AVP: Extinction*.

Ces cinq opérations sont des **scénarios originaux** et non des
lieux ou des batailles attestés dans un film, un comic ou un jeu.
La fidélité est d'abord **au contrat chiffré et narratif de
notre propre audit**, pas une prétention de fidélité canonique.

## De la répartition implicite à un plan vérifiable

L'ancien `BattleCatalog.proposedAllocation` lisait un
budget, puis fabriquait un plan déterministe : il utilisait
déjà les **bons nombres et les bons fronts de commande**
pour ces cinq opérations. Le problème était l'absence d'un
registre **explicite et contrôlable indépendamment** par
opération : compositions et incarnations de commandants
restaient implicites dans une traduction générique.

`js/data/OriginalMusouFrontAllocations.js` déclare désormais
chaque front A/B/C/D, ses détachements, la position de la
cellule de commandement `GRP-42`, les réserves
et les alliés ; la même unité de combat (huit pour les
détachements militaires, deux pour GRP-12, quatre pour GRP-13)
continue à être utilisée.

| Opération | Cadre et groupes source | Commandant déjà compté | Effectifs adverses | Alliés Yautja PNJ |
|---|---|---|---:|---:|
| AFF-06 — matériel au port | contemporain, GRP-37 / GRP-42 | BOS-29 en C, cellule active de 8 | 256 | 8 |
| AFF-07 — livraison industrielle | contemporain, GRP-38 / GRP-42 | BOS-30 en A, cellule active de 8 | 256 | 8 |
| AFF-08 — installation coloniale | futur original, GRP-39 / GRP-42 | BOS-31 en A, cellule active de 8 | 768 | 32 |
| AFF-09 — chantier orbital | futur original, GRP-40 / GRP-42 | BOS-30 en A, cellule active de 8 | 768 | 32 |
| AFF-10 — extraction en cité-port | futur original, GRP-41 / GRP-42 | BOS-31 en B, cellule active de 8 | 768 | 32 |

### AFF-06 / AFF-07 : trois fronts

- Actifs : ennemis A **32**, B **16**, C **16** ;
  alliés **4** sur A (GRP-13).
- Déployés distants : ennemis A **32**, B **48**, C **48** ;
  alliés **2** sur B et **2** sur C (GRP-12).
- Réserve : **64** ennemis, aucun nouvel allié.
- Équipes : 31 sections de combat de 8 et une
  cellule de commandement de 8. Le chasseur
  joueur est séparé des huit PNJ alliés.

### AFF-08 / AFF-09 / AFF-10 : quatre fronts

- Actifs : ennemis A **48**, B **32**, C **24**, D **24** ;
  alliés **8** en A (GRP-11) et **4** en B (GRP-13).
- Distants : **96** ennemis en A, B, C et D ;
  alliés **8** en C et **4** en D.
- Réserve : **256** adversaires et **8** alliés
  déjà inscrits à l'effectif. Les distances et
  routes doivent correspondre au terrain réel ;
  les volumes sources demeurent des gabarits.
- La cellule `GRP-42` est incluse dans les actifs
  de A, sauf AFF-10 où elle est sur B. Les 768
  ennemis incluent déjà leurs officiers.

## La bonne identité de chaque officier original

Le profil source `BOS-30` décrit deux
incarnations **distinctes** : directeur de
sécurité contemporain (AFF-07) et officier
orbital du futur (AFF-09). De même `BOS-31`
regroupe des rôles de commandement originaux
non interchangeables à travers les opérations.

Sur une **nouvelle partie**, les identités
stratégiques sont donc
`AFF-07:BOS-30`, `AFF-09:BOS-30`,
`AFF-08:BOS-31` et `AFF-10:BOS-31`.
Le `sourceBossId` du profil continue de
rattacher le personnage à son archétype,
sans inventer de cinquième officier.
`BOS-29` conserve son ID propre sur AFF-06.

Les profils, musiques, tenues et capacités
ne sont pas déclarés fidèles à un film :
ce sont **des personnages originaux**.

## Sauvegardes et absence de duplication

Une nouvelle mission utilise
`deploymentPlan:'authored'`. La sauvegarde
écrit cet indicateur dans `scene`.

Les anciennes sauvegardes, qui ne
possèdent pas encore cet indicateur,
reprennent avec
`deploymentPlan:'historical-fallback'`
et leurs **IDs, positions de front, PV,
profils, réserves et signature de contrat
originaux**. La stratégie de reprise
`legacyRoster` déjà existante reste
disponible pour les tout premiers
checkpoints génériques.

L'ensemble des **27 opérations** a été
comparé en isolat : les cinq nouveaux
plans produisent les **mêmes IDs de
groupes et de membres, même budget et même
position des escouades** que la
répartition chiffrée antérieure ; les
22 autres configurations restent
identiques. Le changement voulu
porte sur le **contrat de provenance**
et l'identité distincte des officiers
répétés. Aucun civil, véhicule,
personnage ou combattant n'a été ajouté.

## Vérifications

`tests/original-musou-front-allocation.test.js`
réalise sept contrôles :
- sommes exactes par état, faction et opération ;
- commandants positionnés dans le bon groupe
  actif, sans neuvième militaire ;
- conservation intégrale des IDs et des
  effectifs historiques ;
- véritable restauration de checkpoints
  blessés sur la variante historique et
  refus d'un mauvais digest ;
- séparation des officiers réutilisant
  le même archétype original ;
- lien entre scène construite, front,
  niveau, objectifs et version du plan ;
- absence de changement sur les
  22 opérations hors périmètre.

Le workflow GitHub Actions Node 24/Vite/
Chromium exécute ces tests après
`npm ci`. **Un test écrit n'est pas
présenté comme réussi tant que le nouveau
commit n'a pas terminé la CI.**

### Limites et prochain travail prioritaire

La position physique exacte des docks, halls,
coursives et quartiers urbains n'est **pas**
mesurée contre un modèle canonique.
Les chronologies des 5 scénarios sont
originales ; un autre lieu de film ne doit
pas être projeté sur ces cartes sous prétexte
de partager un biome.

Les véhicules/transferts, alarmes, portes,
communications de commandement, voies
d'extraction, civils neutres et capitaines
doivent encore être rejoués en simulation
visuelle et en coopération. Les personnages
originaux ont besoin de maillages et
animations documentés, plutôt que d'assets
provenant d'œuvres non liées.

**Le gameplay reste Musou : officiers,
alliés, grandes batailles, contre-attaques
et objectifs du héros. Aucune économie,
sélection ou boucle RTS d'AVP: Extinction
n'a été transposée dans ce lot.**
