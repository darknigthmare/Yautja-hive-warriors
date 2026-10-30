# Passe de fidélité — Drone, spécialistes LV-742 et Medic à réserve finie
Date de rédaction : 30 octobre 2026
Base Git contrôlée : `49fe27c5a0b111909ae2787264ba6ad8ce2bcb62` (PR #5, draft).

## Périmètre réellement développé

Cette passe **ne change pas le catalogue d'opérations, les affectations, les
identités, les noms de profils persistés, les PV ou les budgets initiaux**.
`js/data/SourceActorPresentation.js` détermine le modèle de détail d'après
le `profileId` de l'escouade source : seuls les Drones de GRP-58/59 et les
spécialistes de GRP-60 sur LV-742 reçoivent ces nouveaux rendus.
Les modèles génériques hors de ce périmètre sont inchangés.

### 1. Drone xénomorphe d'Extinction

- Son modèle n'est plus un Warrior exactement identique. Le sculpteur produit un
  crâne allongé à voûte lisse, un thorax légèrement plus étroit, des matériaux
  distincts et une locomotion propre. Les niveaux de détail haut, moyen et loin
  contiennent les mêmes parties anatomiques avec des densités adaptées.
- Le gestionnaire `XenomorphHorde` choisit `createCreatureModel('drone')` pour
  le rôle de Drone de LV-742, en gardant l'identité de combat stratégique
  `actorType:'warrior'` **dans les sauvegardes déjà existantes**.
- Le Drone conserve provisoirement l'attaque de mêlée du Warrior. Les systèmes
  de capture d'hôtes, production et nodules de ruche propres à Extinction
  **ne sont pas développés ici**. Le maillage est un modèle original
  procédural, **pas une reconstruction mesurée 1:1**.
- La documentation du jeu source décrit un Drone relativement vulnérable,
  spécialiste de la capture d'hôtes et de la construction de nodules. Ces
  fonctions ne sont pas transposées sans logique d'hôtes et de population.

### 2. Cinq silhouettes Marines distinctes

- `Medic` : sac et poches médicaux, réserves identifiables, fusil de défense.
- `CommTech` : liaison dorsale, antenne, écran de poignet et fusil de défense.
- `Sniper` : canon long, lunette et bipied sur la silhouette du fusil.
- `SADAR` : tube d'épaule, culasse et visée propre ; sa logique de fusée,
  explosion et stock de munitions n'est pas encore implémentée.
- `Exosuit` : pilote unique encadré par des membres mécaniques et blindages ;
  aucune unité supplémentaire n'est créée. Physique de l'exosquelette,
  manœuvres motorisées et armement propre restent à développer.

Ces modèles sont construits dans `SupportModels.js` et renvoient
`visualFidelity1to1Verified:false` et `behaviorFidelity1to1Verified:false`.
Le système de tir existant reste actif tant que chaque spécialisation n'a
pas de logique de munitions et d'impacts certifiée.

### 3. Medic — une capacité jouable et finie

- Chaque unité Medic **nouvellement allouée** reçoit exactement deux
  `medicalSupply` dans `BattleSimulation`.
- Le Medic cherche un soldat humain du même camp réellement blessé dans les
  dix unités du monde, non mort et non incapacitated, avec ligne de vue.
- Le gestionnaire synchronise les PV et positions physiques avant de demander
  au modèle stratégique un traitement atomique de 90 PV maximum.
- La simulation vérifie à nouveau l'identité du Medic, sa faction, son stock,
  les deux états actifs, la distance et la santé du patient avant de retirer
  une charge ; le patient est alors soigné. Aucun soin sur les morts, les
  synthétiques, un ennemi ou un soldat distant. Reprise après six secondes
  de cooldown local.
- Le stock est sauvegardé avec l'identité du Medic et ne se recharge pas quand
  l'acteur disparaît de la caméra. Les sauvegardes **source-v1** antérieures
  dépourvues du champ sont acceptées avec zéro charge initiale, plutôt que
  de recréer artificiellement deux soins à chaque chargement. La restauration
  refuse un stock falsifié (négatif, fractionnaire ou supérieur à deux)
  et interdit un stock médical chez les non-Medics.

## Conservation des anciens systèmes

- Les neuf modèles d'escouades `GRP-39/44/45/46/50/58/59/60/61`,
  les budgets et la configuration `getBattleOperationConfig` ne sont pas modifiés.
- Aucune nouvelle race, caste stratégique, personnage nommé, soldat ou
  réserve n'est ajoutée. Les identités de la Reine et des commandants restent
  soumises au même système de perte et de sauvegarde.
- Les `profileId` et `actorType` d'origine sont maintenus pour préserver le
  `configDigest`. Les noms de rôle inscrits dans les anciennes sauvegardes,
  dont les annotations « visual proxy », restent volontairement inchangés.

## Preuves et niveaux de validation

- **Huit fichiers JS / MJS** (code et nouveau test) ont été parsés par
  `new Function` après suppression de leurs déclarations ES-module :
  aucun échec syntaxique. Il s'agit d'un contrôle de parseur,
  **pas d'un build Vite ni d'une exécution du jeu**.
- **14 cas d'affectation de modèles** (Drone, Medic, CommTech, Sniper, SADAR,
  Exosuit, limites d'espèce et faux profils) exécutés sur le
  `SourceActorPresentation` réel : tous correspondent aux valeurs attendues.
- **Six contrôles de soins atomiques** exécutés sur la méthode réelle
  `BattleSimulation.applyMedicHeal` extraite et injectée dans un fixture :
  90 PV, puis 30 PV, épuisement du stock ; refus ennemi, hors portée et
  incapacité. Deux événements de soins ont été émis.
- **Six tests Node intégrés supplémentaires** enregistrés dans
  `tests/source-actor-presentation.test.js`, couvrant les maillages réels,
  le rôle en jeu, la sauvegarde/reprise, les refus et les allocations.
  **Ils ne sont pas revendiqués comme exécutés dans cette passe** :
  l'environnement d'édition n'a pas le paquet `three`, Vite ou
  l'installation complète du projet.
- Pas de recette WebGL, benchmark CPU/GPU à l'écran ni validation de
  proportions ou de droits sur des scans canoniques.

### Reproduction sur un checkout complet

```sh
npm ci
node --test --test-concurrency=1 tests/source-actor-presentation.test.js tests/source-battle-roster.test.js
node scripts/sync-battle-catalog.mjs --check
python3 scripts/update-audit-progress.py --check
npm run build
```

### Prochaines étapes conditionnées à la recette

1. Implémenter pour le Drone la capture d'hôtes / croissance/nodules,
   avec population et hôtes déduits de réserves existantes, sans spawn gratuit.
2. CommTech : réparations et systèmes de communication avec coûts réels.
3. Sniper et SADAR : chargement de munition, trajectoires et couvert physique,
   dégâts de proximité autorisant les bonnes factions.
4. Exosuit : collision, animation articulée, armes et pilotage ; vérifier
   qu'un Exosuit et son pilote ne deviennent jamais deux soldats.
5. Rejouer AFF-27 avec les autres factions, pertes, deux joueurs et checkpoint ;
   contrôler trois LOD du Drone et les silhouettes en caméra proche.
6. Comparer silhouettes et proportions sur plusieurs vues d'œuvres précises.
   Les références visuelles extérieures ne sont ni copiées ni embarquées.

## Références de travail

- *Aliens versus Predator: Extinction*, manuel :
  https://db.hfsplay.fr/files/2019/09/19/Aliens_Versus_Predator_-_Extinction_001_kgcGTen.pdf
- Creative Assembly, description de l'animation et de la locomotion du
  Xénomorphe dans *Alien: Isolation* (autre continuité) :
  https://blog.playstation.com/archive/2014/10/07/creative-assembly-brought-iconic-monster-life-alien-isolation
- `visual-manifest.json` : état et provenance des six études de modèles
  procéduraux réalisées, avec leurs limites fonctionnelles.

**Statut : amélioration réelle de la distinction visuelle et soin Medic limité ;
fidélité 1:1 non certifiée. Aucun contenu sous licence prélevé directement.**
