
# Combat spécialisé LV-742 — correctifs du 30 octobre 2026

Base vérifiée : commit `f903758a025f50a9053b56a81577c518fe53e38d`
du brouillon GitHub PR #5.

## Portée et règle de conservation

Cette passe concerne les **acteurs détaillés** de GRP-60 dans AFF-27.
Elle ne réécrit ni `BattleCatalog.js`, ni `SourceBattleRoster.js`,
ni les identités, espèces, profils ou effectifs persistants. Le nombre
d'Exosuits pilotes reste **un** pour chaque unité source.

Les quatre mécanismes sont de nouvelles interprétations de gameplay
de *Aliens versus Predator: Extinction* (2003). Les noms et fonctions
des spécialistes proviennent du jeu ; **les statistiques, stocks et
temps de recharge de cette adaptation ne sont pas les valeurs
certifiées du jeu source**.

### Capacités réellement appliquées

| Rôle | Ressource finie par unité | Réalisation en combat | Sources et différences |
|---|---:|---|---|
| CommTech | 3 pièces | Réparation de 100 PV max sur un synthétique ou Exosuit vivant, du même camp et à 8 unités maximum, sous ligne de vue ; vérification atomique dans la simulation | Le jeu original prévoit aussi réparation de sentinelles et processeurs atmosphériques et commandes de ravitaillement. **Non réalisées** |
| Sniper | 6 cartouches | Portée 36, arrêt 24, dégâts tactiques 75, délai 3,2 s ; tir soumis à la visibilité et aux factions | Projectile perforant et version améliorée multi-cibles **non réalisés** ; tir principal instantané |
| SADAR | 4 missiles | Projectile réel visible, guidage itératif vers une cible mobile, collision testée à chaque pas, portée 28, vitesse 26, dégâts directs 72 et souffle 30 / rayon 3,6 sur ennemis exposés uniquement ; durée et ressources bornées | Le SADAR AMAG à ogives multiples **non réalisé** ; pas de calcul balistique de missile d'époque certifié |
| Exosuit/pilote | 100 points de blindage | Un seul individu stratégique, vitesse locale 5, armure absorbant au plus 50 % de chaque impact avant épuisement, y compris combats PNJ et impacts du joueur dans les chemins physiques inspectés | Canon M103 double amélioré, articulations motorisées et physique complète **non réalisés** |

**Les effets n'inventent aucun soldat** : missiles et blindage ne
sont pas des renforts. Les dégâts de souffle emploient
`applyBattleSplashDamage` avec filtrage de faction, exclusion de la
cible directe déjà touchée, exclusion des morts, visibilité propre à
chaque acteur et anti-double comptage.

La simulation tient les champs `repairParts`, `sniperRounds`,
`sadarMissiles`, `exosuitArmor` sur les identités préallouées. Les
effets sont lus et déduits de la ressource stratégique avant le
rendu. Une désactivation ou une sortie de front ne crée aucun stock
nouveau.

### Fronts parallèles et unités distantes

Le simulateur stratégique `_remoteCombat` consulte désormais la même
`SourceSpecialistCombat` pour les unités spécialisées. Les Snipers et
SADAR déduisent réellement une cartouche ou un missile à chaque tir
distant, et cessent d'attaquer quand leur stock atteint zéro. Les
cadences et dégâts reflètent leur rôle ; un Medic et un CommTech
tirent moins fort et moins loin qu'un combattant lourd.

Le blindage `exosuitArmor` fonctionne également sur les dégâts
distants, **avec le même compteur** que les coups du mode détaillé.
Le passage d'une vue 3D à un autre front ne recharge plus
l'artillerie et ne restaure pas le blindage.

Limite explicitée : la résolution stratégique à distance ne
simule pas un missile 3D et son souffle individuel ; elle
comptabilise une attaque SADAR abstraite sur une cible du front,
avec la consommation de la munition associée. Les scènes proches
emploient le projectile guidé et les contrôles de terrain réels.

## Sauvegardes et sécurité des profils

Les nouveaux champs se sauvegardent avec les unités, sans changer
`configDigest` ni `actorType`. Les anciennes sauvegardes
source-v1 ne contenaient pas ces champs : elles reprennent avec
**zéro** et n'obtiennent pas des recharges gratuites. La validation
rejette les quantités négatives, fractionnaires, supérieures au
plafond et tout stock attribué au mauvais rôle. Les blessés de
l'équipe ne peuvent pas devenir des synthétiques pour être réparés.

Les dommages d'Exosuit passent par
`BattleActorSupport.targetView` (PNJ contre PNJ) et
`BattleActorBridge.hitOtherHostiles` (dégâts physiques du joueur).
Les autres canaux historiques doivent encore être inventoriés en
recette intégrée ; **l'exhaustivité défensive n'est pas certifiée**.

L'équipier CommTech vérifie la santé et les positions de l'avatar
physique et les transmet à `BattleSimulation` avant la réparation.
Les soins du Medic précédents ne sont pas modifiés.

## Correction visuelle spécifique

Le rendu du **Medic** ne montre plus à tort un fusil d'infanterie
comme arme principale : il porte une étude géométrique de pistolet
M4A3. Le **CommTech** porte une étude compacte de MP9 plutôt qu'un
fusil long. Leurs portées (13 et 18) et dégâts locaux (12 et 16)
sont désormais distincts de ceux du fusilier. Les maillages sont
originaux et leurs proportions ne sont pas garanties identiques
aux références.

## Validation limitée mais reproductible

Contrôles **effectivement exécutés dans un isolat JavaScript**,
sur les corps exacts des méthodes proposées :

- **28 cas** de stock initial, consommation de munitions
  plus refus d'épuisement et de mauvais rôle, réparations, blessés
  hors de portée et ennemis, blindage consommable et contrôle de
  sauvegardes falsifiées ; **28 réussis**.
- **1 scénario de souffle** sur la fonction réelle : un ennemi
  exposé touché, les doublons, amis, cibles déjà touchées, morts,
  obstacles et cibles éloignées préservés.
- **2 scénarios du missile** avec les vraies méthodes
  `queueSadarMissile` et `updateSpecialistMissiles` :
  impact retardé après déplacement, suppression au contact d'un
  mur et aucune blessure à travers le mur. Moteur 3D remplacé par
  un substitut de vecteurs dans cet essai ciblé.
- **1 scénario de fronts distants** sur le véritable `_remoteCombat` extrait : six consommations de Sniper, pas de septième tir, puis usure du blindage distant de l'Exosuit. Les unités sont placées dans un front minimal de test.
- **7 fichiers JS** (code + tests) analysés sans erreur syntaxique par le parseur V8 après retrait des déclarations d'import/export ; pas de build complet.
- **Neuf nouveaux tests d'intégration Node** ont été enregistrés
  dans `tests/source-specialist-combat.test.js`. **Ils n'ont pas
  été exécutés** dans cette passe car le checkout complet, Three
  et Vite ne sont pas disponibles dans le processus de validation.
  Ils doivent être rejoués sous la version de Node et les dépendances
  verrouillées par le dépôt.

### Commandes à exécuter après checkout complet

```bash
npm ci
node --test --test-concurrency=1 tests/source-specialist-combat.test.js \
  tests/source-actor-presentation.test.js tests/source-battle-roster.test.js
node scripts/sync-battle-catalog.mjs --check
python3 scripts/update-audit-progress.py --check
npm run build
```

Le test physique d'une partie AFF-27, le replay d'un checkpoint
ancien, le navigateur WebGL, la vérification des LOD et la mesure
réelle des performances **restent à faire**. Aucun résultat
précédent d'un autre commit ne doit être additionné à ceux-ci.

## Références de la fonctionnalité, pas des dégâts

- GameSpot, examen du gameplay d'*Aliens versus Predator: Extinction* :
  https://www.gamespot.com/reviews/aliens-versus-predator-extinction-review/1900-6072952/
- GameFAQs, guide CommTech / SADAR / Exosuit et mécanismes de terrain :
  https://gamefaqs.gamespot.com/ps2/589665-aliens-versus-predator-extinction/faqs/34175
- Manuel du titre (version PS2) :
  https://gamingalexandria.com/ps2/Aliens%20Versus%20Predator%20Extinction/Aliens%20Versus%20Predator%20Extinction%20-%20Manual.pdf

Les sources corroborent fonctions et familles de matériel ;
**les paramètres 3D, statistiques et trajectoires restent des
réglages de jeu**, non des mesures certifiées. L'environnement
n'a produit ni scan, ni texture PNG, ni GLB 1:1 dans cette passe.

## Manquants priorisés après ce lot

1. Drone : Hive Nodes payés via infestation, guérison sur hive-space,
   collecte d'hôtes et compte de population persistant.
2. CommTech : sentinelles, processeurs atmosphériques,
   repérage/ordres, crédits et dropship lié à des unités
   réellement préallouées.
3. Sniper : tir perforant et différenciation d'amélioration.
4. SADAR : missiles AMAG, simulation d'explosion plus complexe,
   animations de verrouillage et sécurité avancée des volumes.
5. Exosuit : pilotage, collisions de mécanique articulée,
   canon M103 et états d'immobilisation.
6. Textures, proportions et topologie 1:1 par œuvre (films, comics,
   jeux) ; comparaisons multi-angles documentées, contrôle humain
   et performances réelles.

**Statut : mécanique jouable ciblée en code, sans certification
complète ni promesse de reproduction visuelle 1:1.**
