# Appuis lourds finis — 28 octobre 2026

Les capacités suivantes sont des limites de gameplay originales. Elles ne sont pas des caractéristiques mesurées des véhicules de cinéma.

L’APC dispose de 2 500 HP et de 48 obus, consommés deux par deux pour au plus 24 salves. Le Cheyenne dispose de 1 800 HP, de deux sorties, de douze roquettes et de six charges de napalm au total. La première sortie réserve six roquettes et jusqu’à quatre charges ; la seconde utilise les charges restantes. Les projectiles, impacts et feux existants restent réellement exécutés dans les budgets annoncés.

`beginMission(context)` doit recevoir un identifiant de run persistant et une autorisation explicite du scénario. Sans contexte, le déploiement est refusé. Un contexte refusant les appuis empêche leur apparition, notamment lorsque le lieu ou l’époque ne les autorise pas. Répéter le même identifiant, rappeler un modèle ou appeler `clear()` ne répare pas les HP et ne recharge pas les munitions. Seule une nouvelle mission explicite initialise de nouveaux stocks.

Le Cheyenne exige `canAccessAir(target) === true` pour toutes les empreintes d’impact avant de réserver sa charge. Un callback absent, ambigu ou en erreur refuse la demande. Le terrain est vérifié de nouveau avant chaque émission et chaque impact de roquette. Fermer un toit annule donc les frappes qui ne peuvent plus atteindre le terrain. Les ressources réservées restent dépensées ; une annulation ne les rend pas disponibles à nouveau. Des feux déjà présents au sol continuent de brûler jusqu’à leur durée normale, sauf destruction ou nettoyage de l’appui.

L’APC accepte en outre un callback `canFireAt(fromMuzzle, toTarget)` pour utiliser les couverts physiques du lieu. Lorsqu’il est fourni, une réponse différente de `true` bloque la salve sans consommer d’obus. Les tests de géométrie et de visuel utilisent un scénario explicitement déclaré ouvert.

Les deux appareils exposent `getCombatant()`, une cible vivante dont les HP diminuent réellement par `takeDamage()`. À zéro HP, les tirs et effets contrôlés sont annulés, le modèle est retiré et l’appui reste détruit pour le run. L’ancien collider de l’APC devient inactif par `isCollisionActive()` ; ses rayons et sa résolution physique ne bloquent plus un passage vide. Le caller reçoit aussi `onDestroyed` pour enlever le collider enregistré et invalider les chemins locaux calculés avant sa disparition.

## Contrat d’intégration

```js
support.beginMission({
  missionId: persistentCheckpointRunId,
  allowed: scenarioAllowsThisSupport,
  factionId: playerFaction,
  canAccessAir: target => environmentHasOpenSkyAt(target),
  canFireAt: (from, to) => physicalLineIsClear(from, to),
  onDestroyed: () => removeRegisteredColliderAndInvalidateNavigation()
});
```

Le caller doit calculer la compatibilité du lieu et de l’époque, puis tester les vrais volumes de toit. Ces callbacks ne sont pas remplacés par un simple nom de carte dans les véhicules. `spawn()` de l’APC retourne un booléen ; le caller ne doit enregistrer un collider que si le déploiement réussit. `triggerAirstrike()` retourne `{ accepted, reason, message }`, avec un message français utilisable dans l’interface.

`serialize()` retourne uniquement des données simples. `restore()` exige le même identifiant de run. Sur une instance existante, il ne peut augmenter ni les HP ni les stocks, et il ne raccourcit pas un cooldown. Sur une instance neuve correctement configurée, il adopte les valeurs sauvegardées. Une sortie aérienne interrompue est annulée à la reprise ; ses ressources réservées restent consommées et son délai est conservé. Cette approche évite de rejouer des impacts déjà survenus. Elle ne reconstitue pas le vol à la même seconde.

Le contexte de reprise doit utiliser l’ID persistant du checkpoint, et non le nouvel identifiant d’une projection visuelle. Les callbacks de collision et les références de scène ne sont pas sérialisés.

## Vérifications

La suite vérifie les plafonds réels de salves et d’impacts, les refus sous un vrai volume de toit, les fermetures après acceptation et après lancement, les dégâts à une cible effectivement rendue, l’inactivation physique à la destruction, l’absence de réparation/rechargement par rappel ou restauration ancienne et les sauvegardes dépensées. Les régressions de géométrie, d’aim, de recul et de ressources restent incluses.

Ces tests CPU ne constituent pas une recette humaine, une mesure matérielle ou une certification visuelle 1:1. Le branchement final à l’interface, aux ennemis et aux checkpoints du jeu complet appartient au coordinateur.
