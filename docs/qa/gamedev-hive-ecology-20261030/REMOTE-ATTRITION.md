# Fronts distants — Hive Nodes attaquables sans duplication (30 octobre 2026)

## Référence et périmètre
Dépôt `darknigthmare/Yautja-hive-warriors`, PR #5, branche `codex/gamedev-guides-20261029`.
Base de ce lot : `f549f051ba520f171e0d460058af85167aa7a5e0`,
après la passe Hive Nodes et la correction des cooldowns des checkpoints.

Ce lot est une **adaptation stratégique de gameplay**, pas une copie
mesurée de *Aliens versus Predator: Extinction*.

## Défaut corrigé

Les Hive Nodes avaient bien des PV et pouvaient être attaqués dans
le rendu 3D, mais **une bataille entièrement hors caméra ignorait
les nodules**. Un nodule pouvait rester éternellement intact au
milieu d'un front perdu, même sans aucun Alien pour le défendre.

En outre, l'essai initial d'une attaque par tous les soldats
du front a supprimé un nodule de 280 PV en un pas fixe.
L'implémentation retient donc un budget explicite d'attrition
des structures.

## Correction de l'autorité

Dans `BattleSimulation._remoteCombat()` :

- Les unités distantes continuent de cibler les **combattants
  hostiles existants** avant une structure. Un nodule n'est visé
  que si la liste des combattants ennemis distants sur ce front
  est vide. L'armée ne reçoit pas un second tir gratuit.
- L'attaquant doit être dans son **front** et à moins de
  20 à 24 unités du nodule selon sa classe et sa portée.
  Une unité dont le tir est en cooldown ou dont le stock est
  épuisé est exclue.
- **Quatre attaquants au maximum par nodule et par pas de
  simulation fixe de 0,25 s** peuvent consacrer leur
  attaque à une structure. Les autres n'usent pas leurs
  munitions ni leur cooldown contre elle.
- Dégâts combinés plafonnés à **32 PV par pas** pour un
  même Hive Node ; il faut au minimum plusieurs pas pour
  détruire ses 280 PV.
- La simulation utilise `damageHiveNode()` et ses règles
  de faction : les tirs alliés sont interdits ; la destruction
  ne crée **aucune perte de soldat ou récompense de kill**.
- Sniper/SADAR consomment la même munition finie en
  combat distant que lorsqu'ils sont détaillés.
- La destruction et la perte de PV persistent dans
  `hiveEcology` à la sauvegarde. Les 952 identités
  de combattants d'AFF-27 sont conservées.

**Limites** : les trajectoires physiques, missiles et
obstacles sont simulés dans le rendu de proximité,
**pas** individuellement dans l'abstraction distante.
Les dégâts de structures sont donc une règle tactique
sur un front avec rayon, pas une ligne de visée
multizone certifiée 1:1.

## Reproductions exécutées

Une vérification V8 a invoqué la méthode réelle
`_remoteCombat()` et les méthodes de structure, avec
candidats/structures de test :

| Scénario | Résultat |
|---|---|
| 22 tireurs humains sur un même nodule | 4 attaques admises, nodule de 280 à 248 PV |
| Déduction des consommables | Sniper : 6→5 ; SADAR : 4→3 |
| Tireurs sans créneau | Pas de cooldown et pas de munition perdue |
| Défense de soldats xénomorphes au même front | Priorité aux troupes ; nodule reste à 248 PV |
| Nodule placé à distance du front | Aucun tir ; nodule intact |

Les cas utilisent les vrais corps des méthodes du commit
mais un cadre de données isolé. **Ce ne sont pas des tests
WebGL ni un benchmark de 22 modèles 3D.**

Deux tests Node sont ajoutés dans
`tests/hive-node-remote-combat.test.js` : un test
d'attrition / priorité / munitions avec la vraie configuration
AFF-27 et un test de checkpoint après destruction
partielle, sans nouvelle attribution d'infestation.
**Ces deux tests d'intégration ne sont pas revendiqués
réussis tant que le workflow GitHub ne les a pas exécutés.**

## Validation GitHub Actions et correction connexe

Un workflow `.github/workflows/yhw-fidelity.yml` a été
publié sur le commit `f549f051ba520f171e0d460058af85167aa7a5e0`
avec permission GitHub `contents:read`. Son premier
job a validé :

- `npm ci` ; `npm run build` ; source du catalogue
  synchronisée ; contrôle d'audit / Excel préservé.
- **68 tests de bataille réussis sur 69** dans les
  suites ciblées. Le job a échoué sur le dernier,
  un assert du CommTech : **50 PV réellement manquants**
  étaient comparés à une valeur codée en dur de 40.
  Le correctif compare maintenant au manque actuel de PV.
- Le job navigateur Chromium a été **skipped** à cause
  de ce seul échec antérieur. Il sera relancé
  automatiquement avec la nouvelle version de la
  branche si les workflows sont autorisés.

Run vérifié : https://github.com/darknigthmare/Yautja-hive-warriors/actions/runs/41090535126

## Refaire la validation

```sh
npm ci
npm run build
node --test --test-concurrency=1 \
  tests/hive-node-remote-combat.test.js \
  tests/hive-node-ecology.test.js \
  tests/source-specialist-combat.test.js \
  tests/source-actor-presentation.test.js \
  tests/source-battle-roster.test.js \
  tests/battle-simulation.test.js \
  tests/battle-catalog.test.js
npm test
```

### Manquants de fidélité

La capture d'hôtes, la gestation, les œufs persistants,
les transporteurs et Hive Nodes par type de terrain
restent hors de cette passe. La position et l'attaque
physique d'un nodule peuvent encore nécessiter des
ajustements dans les niveaux et rampes réels. Les
modèles et textures n'ont pas été validés 1:1.
