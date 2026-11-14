# Poursuite verticale et cibles d’appui — 28 octobre 2026

Le Warrior au sol et les androïdes utilisent `getVerticalNavigationTarget(position,target)` avant de décider de leur déplacement. La portée d’une frappe conserve la vraie distance 3D et les tests de visibilité. L’origine du pas est transmise à `resolveAgentMovement` pour éviter de consommer deux pas pendant un contournement. Les phases de charge, de bond, de chute et les ordres de formation conservent leurs chemins de traitement dédiés.

`horde.supportTargetsProvider` fournit des combattants d’appui actifs, endommageables, de position finie et marqués `isSupport`/`isBattleNPC`. Ils participent à la sélection hostile et à la préparation des frappes NPC. La liste des chasseurs vivants et les ancrages de renforts continuent de contenir les joueurs. Les unités au sol visent les appuis au sol ; les mantas peuvent viser les appareils en vol.

Un appui utilise son vrai rayon de contact et le contrat `takeDamage(amount,source)`, qui conserve le crédit de faction lors de sa destruction. `collisionOwner` permet d’écarter seulement sa propre coque du rayon de visibilité vers son centre ; les autres obstacles restent bloquants. Les facehuggers ordinaires et royaux choisissent un hôte organique éligible et n’ajoutent aucune méthode d’accrochage aux véhicules.

Les requêtes `Horde.checkMeleeHits` et `Synthetics.checkHits` acceptent aussi `targetOnly`, l’identité exacte de l’acteur touché. Les collections historiques de la Horde concernées sont les aliens, œufs et chestbursters. Cette option sert notamment à appliquer le premier impact d’une flèche à un seul acteur.

La suite dédiée utilise les modèles et gestionnaires réels : montée depuis le dessous d’une passerelle par un Warrior et un Working Joe, premier impact uniquement à la bonne altitude, destruction complète d’un APC de 2 500 HP, reprise de cible sur P2, mur distinct qui bloque un androïde, deux sortes de parasites devant APC/Cheyenne et impact individuel. Les régressions couvrent la grâce d’insertion, les quotas d’attaque coopératifs, les formations, les identités de combat, les ressources d’appui et la libération des cibles au nettoyage.

49 tests CPU passent. Journaux, commandes et empreintes sont dans `docs/qa/pr3-next-20261028/actor-targeting/`. Ce contrôle ne constitue pas une validation visuelle humaine ou GPU et complète le lot monde précédemment figé.
