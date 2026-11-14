# Recette CPU du lot stratégie — 28 octobre 2026

Le runtime de ce lot est figé avant la revue indépendante. Ce dossier documente les mécanismes stratégiques et la recherche de cibles ; l'intégration du menu, du HUD, du Bridge et la recette navigateur relèvent du lot principal.

## Suites métier

[strategy-83-tests.txt](strategy-83-tests.txt) : **83 tests réussis**, zéro échec, annulation ou test ignoré. La commande couvre les nouveaux contrats, leurs restaurations et les régressions existantes :

```sh
node --max-old-space-size=2048 --test \
  tests/battle-target-index.test.js \
  tests/battle-strategy-depth.test.js \
  tests/battle-simulation.test.js \
  tests/battle-intel.test.js \
  tests/formation-companions.test.js \
  tests/combat-identity.test.js \
  tests/ally-rescue.test.js \
  tests/boss-registry.test.js
```

Les cas ajoutés vérifient les 34 cartes, des détours et déconnexions de routes, les délais par front, la pause et la sauvegarde, la retraite physique, les pertes conservées, l'épuisement des réserves, la présence réelle du renfort, les sources coupées, les trois difficultés à allocation identique, les incapacités et le plafond détaillé, la coordination de ruche, les invalidations du fournisseur de cibles et les changements diplomatiques en direct.

## Mesures reproductibles

La preuve complète est [targeting-benchmark.json](targeting-benchmark.json). La version 2 des noms de champs précise la portée sans modifier les observations initiales. Les empreintes SHA-256 des sources mesurées avant et après sont identiques (`sourceUnchangedDuringMeasurement: true`).

```sh
node scripts/benchmark-battle-targeting.mjs \
  --baseline /workspace/Yautja-hive-warriors/js/battlefield/BattleSimulation.js \
  --output docs/qa/strategic-depth-20261028/targeting-benchmark.json
```

| Mesure | Petit effectif | Effectif doublé | Observation |
| --- | ---: | ---: | --- |
| Moteur distant, médiane de 5 × 240 ticks | 512 : 60,30 ms | 1024 : 109,13 ms | Temps × 1,81 ; résultats identiques à la base |
| Part de la phase complète de combat distant | 61,78 % | 63,75 % | Comprend sélection, dégâts, PV et morts |
| Recherche détaillée, maximum des 2 répétitions | 16 acteurs : 33,46 % | 32 acteurs : 42,61 % | Profil inclusif `selectBattleTarget` |
| Temps des gestionnaires détaillés | Référence 16 acteurs | 32 acteurs : × 1,80 | 2400 mises à jour par répétition |

Le champ `detailedTargetSearchBelowHalfInMeasuredRuns` concerne uniquement les acteurs détaillés. La part de la phase distante n'est pas une mesure de recherche seule ; son dépassement de 50 % ne doit être interprété ni comme une domination de recherche, ni comme une preuve contraire.

La mesure détaillée exécute les vrais gestionnaires Horde et Marines, avec maillages procéduraux, combats PNJ et graine 20528. Les grenades sont désactivées pour isoler ce chemin de combat, les PV sont élevés pour conserver le même effectif, et le joueur reste hors portée. L'inspecteur Node échantillonne toutes les 100 µs. Les deux répétitions conservent exactement les mêmes empreintes d'état et de choix de cible. Le compteur opérationnel du moteur distant double proportionnellement aux identités du cas déterministe ; le plafond d'acteurs détaillés reste **32**.

Ces mesures portent sur ce processus Node et ce cas de charge. Elles ne sont ni un budget FPS, ni une mesure WebGL/GPU/VRAM, ni une validation de toute scène, de tout manager ou de toute machine. Les parts échantillonnées peuvent varier entre exécutions. La configuration historique n'est lue que pour la comparaison CPU ; aucun fichier de sa source ou de son build n'est modifié.

## Portée des critères

- **AUD016** : les profils modifient cadence, garnison, risque et priorité d'objectif ; allocation et identités inchangées. Le choix visible dans le produit est vérifié par le lot principal.
- **AUD046** : trajet réel vers regroupement, pertes conservées, retour bloqué tant qu'un renfort fini n'est pas réellement arrivé et ravitaillé. Aucune guérison automatique ni création de troupes.
- **AUD047** : délais calibrés sur les routes physiques, indépendants par front, sauvegardés et allongés en cas de détour. Les fronts totalement déconnectés restent explicitement signalés ; leur retour n'est pas certifié avant réouverture d'une route. L'affichage et la lisibilité des annonces exigent la recette du lot principal.
- **AUD107** : le cas détaillé 16→32 conserve des résultats déterministes et une part de recherche observée sous 50 %, sans augmenter le plafond. Le benchmark distant mesure une phase plus large ; il ne suffit pas à prouver la part de recherche de tous les acteurs détaillés.

Le [contrat des API](../../BATTLE-STRATEGY-DEPTH.md) détaille les conditions de reconstitution, les valeurs de calibration et les limites de chaque mécanisme.
