# Contrat de gameplay — Yautja Hive Warriors = ACTION MUSOU

Date : 30 octobre 2026 · PR #6.

## Décision structurante (à préserver)

**Yautja Hive Warriors est un jeu d'action Musou / Dynasty Warriors-like.**
Un Yautja jouable traverse des champs de bataille, affronte des
foules, sauve ses officiers et alliés, défait des commandants,
prend des objectifs et fait basculer les fronts **en temps réel**.
L'IA et les armées se battent en parallèle lorsque le joueur
ne les regarde pas. Les deux joueurs en coopération locale
sont deux combattants de cette bataille, **pas** deux joueurs
d'un STR séparé.

Les œuvres *Alien / Predator*, notamment *AVP: Extinction*,
sont **des sources de contenu et de capacités de créatures**,
pas des modèles de boucle de gameplay. Il faut conserver
les rôles, noms, espèces, variantes, équipements, propriétés
biologiques, lieux et identités propres à leur continuité,
puis les convertir en comportements **observables dans un
Musou** : une ruche protège ses voies, un Facehugger
parasite un humain, un CommTech répare un synthétique, un
SADAR tire un missile, une Reine tient un front.

### Ce que nous empruntons à chaque référence

| Référence | Utilisation | À ne pas copier |
|---|---|---|
| Dynasty Warriors / Origins | Joueur 1 vs armées, action, officiers, front, moral, grosses formations, objectifs, tactiques d'appui | Personnages, histoire, armes ou cartes de la Chine des Trois Royaumes |
| Predator / AVP films, jeux et comics | Apparence et différences de Yautja, équipements, clans, véhicules, ennemis, terrains et chronologie selon la source | Variantes d'une autre continuité greffées sans justification |
| *Aliens versus Predator: Extinction* | Castes, équipements USCM, synthétiques, Drone, Hive Node, Hive-Space, Spore Sight, vulnérabilité Facehugger, rôles du Praetorian et de la Queen | Boucle de construction RTS, sélection d'unités à la souris, économie de joueurs STR et commandes reproduites à l'identique |
| Autres films/séries/jeux *Alien* | Noms, armes, organisations, créatures, décors et règles spécifiques documentés | Des capacités non attestées, ou une présence géographique/chronologique impossible |

Référence principale de la mécanique Musou :
[Omega Force, Dynasty Warriors: Origins — Systems](https://www.koeitecmoamerica.com/dw_origins/us/system/)
et [PlayStation Blog (janvier 2025) — combats 1 vs 1 000, grands corps et moral](https://blog.playstation.com/2025/01/13/dynasty-warriors-origins-hands-on-report-2/).

Référence du contenu *Extinction* :
[manuel PS2, castes et Hive-Space](https://gamingalexandria.com/ps2/Aliens%20Versus%20Predator%20Extinction/Aliens%20Versus%20Predator%20Extinction%20-%20Manual.pdf).

## Règles implémentées dans cette passe

`MusouBattleFlow.js` n'ajoute **aucune** unité ni ressource :
- un **officier ennemi réellement vaincu** sous `BattleSimulation.recordDeath`
  donne au plus **8 points de moral** (paramètre original de
  gameplay) aux groupes vivants **du camp vainqueur et
  alliés**, présents sur le même front et non en transit ;
- les groupes lointains, ennemis et réservistes ne reçoivent
  aucun bonus, et le journal de mort empêche le même officier
  de récompenser deux fois ;
- le score n'est pas un « nombre de kills virtuels » ;
  `musou_officer_broken` publie la rupture de ligne ;
- le HUD classe au plus **trois fronts** par danger réel :
  front critique, capitaine allié blessé, bataille
  contestée, puis objectif / reconnaissance. Il calcule
  la distance au Yautja actif et **n'affiche jamais les
  effectifs exacts non révélés** de l'adversaire ;
- les ordres de groupes demeurent disponibles dans
  `OperationPanel`, mais **repliés comme tactiques
  facultatives**. Le centre de l'écran donne la priorité
  au héros et à ses objectifs, pas à la gestion de
  stocks et de bâtiments.

Ces changements utilisent les mêmes PV, factions,
fronts, états, armées, `configDigest`, réserves et
checkpoints que le système actuel. Les anciennes
sauvegardes n'ont pas de migration à effectuer pour
afficher le nouveau flux Musou.

## Distinction entre simulation de masse et rendu

La simulation actuelle a un plafond **initial de 32
acteurs détaillés simultanément**. Les effectifs
restants continuent d'exister sur les fronts
distants et les réserves ; cette architecture
ne prouve **pas** que 1 000 personnages sont
actuellement dessinés en même temps.

Les 27 scénarios du catalogue source déclarent
**12 816 PNJ ennemis et 708 PNJ alliés cumulés
entre scénarios**, soit **13 524 allocations**,
pas dans une seule bataille. Ces effectifs
incluent cinq opérations où le catalogue
retombe sur une répartition automatique
par budgets (**AFF-06 à AFF-10**), faute de
compositions détaillées par front. On ne
présente donc pas leurs troupes de secours
comme une formation canonique. Leurs
noms, gabarits,
biomes, castes et chefs restent à certifier
source par source. Un nombre d'entrées de
catalogue n'est jamais un modèle 3D livré.

## Grille de complétude

Le fichier
`docs/audits/2026-10-30/musou-crossmedia-gaps.json`
recense les **27 opérations** avec leur carte,
groupes alliés/ennemis, boss nommés et budgets
par état, et signale explicitement ce qui reste
**non certifié** :

- exactitude visuelle et topologique du terrain
  (planète, altitude, passages, météo, ambiance),
  cohérence de chaque lieu et continuité ;
- matériel des Marines/CommTech/Synthetics
  distinct d'une autre faction ;
- skin/model/masque/armes et animations Yautja
  précis par film, jeu, comic ou série ;
- modèles différenciés des castes et du
  cycle d'hôte, avec provenance ;
- véritables réactions et capacités de boss,
  mini-boss, grosses armées et escouades ;
- validation des objectifs Musou et des
  deux joueurs sur **tous** les environnements ;
- performances observées sur du matériel
  réel, FPS, occlusion, bruitage, collisions
  et synchronisation des vues physiques/distance.

Les opérations **AFF-06, AFF-07, AFF-08, AFF-09
et AFF-10** ont des budgets source cohérents
mais pas de `forceAllocation` explicite par
front dans le JSON historique. Le jeu les
génère par défaut. La matrice distingue
donc `budget-fallback-no-source-front-composition`
de `source-front-allocation-present`.
La prochaine passe dédiée devra établir
les castes/équipes, commandements et
positions de chaque front, avec une
traçabilité média, sans casser les
sauvegardes existantes.

Les champs `false` signifient « non certifié
par cet audit », pas automatiquement « absent ».
La fidélité 1:1 est un **critère source/asset**
à démontrer, pas une promesse d'avoir reproduit
le moteur/STR original.

## Tests et acceptation

Le lot ajoute `tests/musou-battle-flow.test.js` :
- genre Musou contractuel, AVP limité au contenu ;
- rupture d'un vrai officier avec bonus de moral
  local unique, conservation de tous les IDs et
  de la sauvegarde ;
- aucune récompense sur soldat ordinaire, mort
  sans attribution ou faction inconnue ;
- priorité des fronts critiques, capitaines,
  contestations et protection des inconnus ;
- vérification structurelle sur les 27 opérations
  sans modification du catalogue.

`npm ci && npm run build && node --test --test-concurrency=1
tests/musou-battle-flow.test.js` puis `npm test`.
L'exécution effective de ces nouveaux tests
doit être vérifiée via GitHub Actions sur le
SHA qui contient le changement. Ne pas
réutiliser les chiffres de QA d'un ancien commit
pour certifier celui-ci.

**Conclusion : le système directeur est un
Musou ; Extinction fournit des contenus
identifiables et des comportements de
creatures, jamais le gameplay principal.**
