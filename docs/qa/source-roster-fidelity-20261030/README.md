# Yautja Hive Warriors — roster source, acteurs et fidélité (30 octobre 2026)

Base : `e00500bc7e9240e6bd16275327cbbc4430aa466f`. Branche PR #5 :
`codex/gamedev-guides-20261029`.

## Ce qui change dans les nouvelles opérations

La simulation reste propriétaire des IDs, des PV, des pertes, des réserves et des
groupes. `SourceBattleRoster.js` associe des positions **déjà allouées** à leurs
types d'acteurs et à des rôles par modèle de détachement. Aucun soldat supplémentaire
n'est créé ; le plafond d'acteurs détaillés et les budgets ne changent pas.

| Source d'escouade | Composition encodée | Portée de la fidélité |
|---|---|---|
| GRP-39 | 1 chef, 4 fusiliers, 1 smartgunner, 1 brèche, 1 radio | Smartgunner distinct ; brèche/radio sont encore des fusiliers provisoires |
| GRP-44 (LV-895) | 7 Runners + 1 Spitter | Acteurs de combat distincts, variations visuelles encore à comparer |
| GRP-45 (Lethe) | 1 Praetorian + 7 adultes | Praetorian rendu comme tel, boss BOS-32 remplace ce créneau |
| GRP-46 (LV-895) | 8 synthétiques de combat WY | Plus de Marines à la place des synthétiques |
| GRP-50 (Sevastopol) | 2 Working Joes | Maillage Seegson sans arme de Marine, distinct de WY |
| GRP-58 (LV-742) | 4 Warriors + 2 Runners + 1 Drone + 1 Facehugger | Le Drone emploie encore une représentation Warrior |
| GRP-59 (LV-742) | 4 Warriors + 2 Drones + 2 Praetorians | C-QUEEN : BOS-39 remplace **le second Praetorian**, pas le chef Warrior |
| GRP-60 (LV-742) | H-LIGNE / H-APPUI : huit fonctions par section | Le Synthetic est désormais synthétique ; Medic/CommTech/SADAR/Exosuit restent des proxys |
| GRP-61 (LV-742) | Y-CHASSE / Y-APPUI : quatre rôles par cellule | Les rôles sont identifiés mais utilisent encore le modèle de clan partagé |

Les trois silhouettes militaires détaillées sont désormais **fusilier**, **smartgunner**,
**lance-flammes**. Le lance-flammes a un réservoir dorsal, un flexible et une
bouche spécifiques dans `SupportModels.js`. Ces volumes sont des interprétations
originales en unités de jeu, et non des numérisations d'accessoires de film.

Les boss nommés s'affectent d'abord au camp d'espèce correspondant, au lieu
d'alterner arbitrairement les factions selon leur ordre dans un tableau. Dans
AFF-16 le Spitter BOS-33 occupe le créneau Spitter existant ; dans AFF-27,
la reine BOS-39 remplace le Praetorian de la cellule C-QUEEN. Le chef ne crée
jamais un neuvième soldat.

À Sevastopol, les Working Joes et la ruche ne sont **pas automatiquement hostiles**
dans cette opération adaptée. Les forces synthétiques d'AFF-13 et AFF-16 sont
déclarées synthétiques, tout en conservant l'identifiant budgétaire historique
`human_force` pour maintenir les allocations. Leur modèle de moral tactique reste
un substitut et ne reproduit pas un protocole comportemental d'androïde.

## Sauvegardes et compatibilité

`getBattleOperationConfig(...,{rosterDetail:'legacy'})` reconstruit la composition
générique de l'ancienne version. Si une sauvegarde valide ne correspond pas au
nouveau digest de configuration, le chargement retente le **catalogue historique**
et laisse `BattleSimulation.fromState` vérifier le digest, les identités et le
contenu de l'ancien checkpoint. Il n'y a ni migration qui réécrit les morts ni
ajout de troupes à la reprise. Un checkpoint incompatible reste refusé.

## Vérifications et limite de cette passe

Le contrôle autonome de l'audit source (JSON préservé) a parcouru 27 opérations
et 62 descriptions de groupes. Il a compté 2 256 places dans les neuf modèles
d'escouades concernés **en cumulant les opérations**, sans anomalie de taille
(squads × membres = effectif annoncé) ; il ne s'agit pas de 2 256 combattants
simultanés ou d'un effectif canonique.

Le nouveau fichier `tests/source-battle-roster.test.js` fournit sept tests
automatisables : conservation de tous les ID/budgets entre catalogues, profils
et acteurs admis, groupes et boss de Sevastopol/Lethe/LV-895/LV-742,
relations, et séparation des digests de sauvegarde. Le test existant des
relations triangulaires a été mis en accord avec la neutralité locale
Seegson–ruche. **Ces nouveaux tests intégrés ne sont pas déclarés exécutés**
tant qu'un environnement complet n'a pas installé les dépendances du jeu.
Le contrôle JSON autonome est distinct de ces tests et de toute recette WebGL.

## Fidélité à poursuivre

1. Construire un Drone spécifique (crâne, posture et animation), pas renommer un Warrior.
2. Modéliser réellement les spécificités Medic, CommTech, Sniper, SADAR,
   Exosuit/pilote et les rôles de détachement Yautja.
3. Distinguer comportement protocolaire des synthétiques, coopération et
   relations locales : leur simulation tactique n'est pas un portage d'Extinction.
4. Mesurer tailles, tenues et proportions de chaque incarnation contre une
   référence utilisable, avec ressources et droits tracés.
5. Rejouer les 27 opérations avec scénarios de front, boss, réserves et sauvegardes,
   puis inspecter les scènes rendues et les performances d'un matériel réel.

Les lieux et les groupes sont des **adaptations** des œuvres, pas une
reconstitution géographique ou visuelle 1:1. `visualFidelity1to1Verified`
reste `false`. Aucun GLB importé, classe non existante, boss ni classe
cinématographique supplémentaire n'est déclaré livré dans cette passe.

## Sources de portée différente

- Catalogue de source du projet : `docs/audits/2026-10-26/audit-data.json`,
  pour la proposition chiffrée des opérations et compositions.
- Focus Entertainment, *Aliens: Fireteam Elite* :
  https://www.focus-entmt.com/fr/games/aliens-fireteam-elite —
  confirme la distinction entre Xénomorphes et synthétiques WY.
- GameSpot, *Aliens Versus Predator: Extinction Review* :
  https://www.gamespot.com/reviews/aliens-versus-predator-extinction-review/1900-6072952/ —
  décrit les rôles Marine, Medic, Synthetic et CommTech.
- Jeu de référence *Alien: Isolation* : distinction Seegson/Working Joe
  déjà portée par le catalogue ; cette passe ne certifie ni son IA ni son mesh.

Guides utilisés : `game-ai`, `level-design` et `create-game-assets`,
révision de travail épinglée dans `docs/development/gamedev-guides.lock.json`.
