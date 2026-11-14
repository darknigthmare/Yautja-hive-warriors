# Évolution du jeu — 28 octobre 2026

Cette passe prolonge le build PR3 publié avec des cartes physiquement variées, des combats mieux reliés à la stratégie et des ressources persistantes. Le [rapport intégré](qa/pr3-next-validation.json) indique l'état réel des vérifications et de la publication ; les résultats des composants ne le remplacent pas.

- **Terrains :** choix de variantes semées en mode fronts, accès par de vraies rampes, plafonds et couches de circulation cohérents avec les collisions et les tirs ; repères de parcours et restauration du terrain après éloignement. La graine zéro conserve les cartes des anciennes sauvegardes.
- **Combat stratégique :** trois difficultés changent les décisions et les timings en conservant effectifs, identités et budget d'acteurs. Les délais de reprise des fronts tiennent compte des trajets ; une retraite exige des renforts réels avant une reconstitution.
- **Alliés :** un premier coup mortel peut mettre un Yautja à terre. Un secours de trois secondes consomme un médicomp au succès ; les interruptions, l'expiration et les pertes restent liées à son identité, y compris hors écran et après sauvegarde.
- **Boss :** prévalidation des rencontres, pieds ancrés au sol, attaques et avertissements distincts, interruptions et réponses de combat, menaces sur d'autres fronts. Les phases et réserves survivent à la projection distante et aux checkpoints sans soigner les blessures.
- **Équipement Prey :** arc de Taabe et hache de Naru possèdent leurs vrais stocks et modèles d'équipement. Une flèche rencontre le premier obstacle ou acteur ; mobilité, signature thermique et résistance à l'acide expirent. Les consommables du décor restent consommés après reprise.
- **Appuis :** l'APC et le Cheyenne ont des PV, munitions et réserves finis. Ils peuvent être détruits, sont ciblés comme appuis et restent exclus du parasitage. Le contexte, les obstacles et l'accès au ciel conditionnent leur emploi.
- **Nettoyage :** les références de joueurs de l'ancienne horde sont libérées. Les délais des programmes de QA sont annulés pour distinguer leurs propres rétentions de celles du jeu.

La recette intégrée a également révélé puis corrigé deux défauts concrets : les NPC pouvaient revenir vers le centre de l'héliport de Los Angeles au lieu de suivre leur route, et un refus de rechargement de tourelle interceptait la touche E avant les objets Prey. Les frappes orbitales et le bombardement hérités vérifient désormais aussi le ciel avant leurs coûts et leurs impacts retardés.

Les [preuves des boss](audits/2026-10-28/BOSS-ENCOUNTERS.md), du [monde](WORLD-DEPTH.md), des [cibles et accès](ACTOR-TARGETING.md) et de la [stratégie](BATTLE-STRATEGY-DEPTH.md) précisent leurs portées. Le [classeur de suivi](audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx) conserve les critères encore ouverts ; seul son suivi est modifié, pas les exigences historiques.

Les douze fichiers GLB existants ne sont pas remplacés par cette passe. Les autres personnages et plusieurs décors restent procéduraux. Aucun nouveau crédit Meshy n'est dépensé, aucun testeur humain n'est revendiqué et les tests automatisés ne certifient ni une fidélité 1:1 aux films, ni les performances d'une machine de joueur. Les parcours assistés sont identifiés dans leurs rapports.
