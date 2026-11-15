# Intégration de la v67 et du plan de la PR #3

La candidate `codex/complete-pr3-20261026` réconcilie `main` v67 (`9c18c19`), la branche jouable validée (`1d52d9f`) et le classeur de la PR #3 (`0435827`). Le catalogue historique et ses critères restent conservés ; les 126 lignes de suivi sont mises à jour séparément avec des preuves. Le bilan courant est dans [implementation-progress.json](audits/2026-10-26/implementation-progress.json), le [classeur](audits/2026-10-26/Yautja_Hive_Warriors_Audit_Dynasty_Warriors_2026-10-26.xlsx) et [sa vérification](audits/2026-10-26/implementation-verification.json).

## Batailles persistantes

Les groupes possèdent des identités, des réserves finies, des pertes et des positions persistantes. La simulation distante continue sur les autres fronts. Les promotions en acteurs détaillés conservent ces identités, leurs PV et leurs ressources. Les grandes opérations utilisent un plafond de 32 acteurs détaillés par défaut ; les allocations théoriques de l'Excel ne sont pas supprimées pour respecter ce plafond. Les engagements proches restent régulés par le directeur de combat.

Le catalogue comporte 27 opérations originales, dont 25 jouables avec un Yautja. Les deux variantes demandant un contrôleur humain restent explicitement indisponibles. Les 34 variantes de terrain possèdent des tracés physiques distincts, des fronts et des contournements. Les onze biomes de la v67 conservent leur identité et leurs mécanismes compatibles avec leur contexte.

Les opérations exécutent des objectifs différents : archives à transporter, convois, sabotages, défense, escorte, accords limités et extraction. Les actions canalisées sont interrompues par les impacts ou l'éloignement. Les contre-offensives sont annoncées et prélèvent des groupes déjà alloués. Les sauvegardes conservent pertes, chargements, objectifs, ressources et identités des récompenses.

La carte de commandement propose ordres, formations, délégation, tactiques et réserves. Le renseignement distingue observations, positions anciennes, inconnues et rapports alliés retardés. Les compagnons emploient des ressources finies. Une continuité originale AFF01–05 et un scénario séparé de conflit entre ruches complètent les opérations ; ils ne sont pas présentés comme des événements des films.

## Combat, décor et présentation

Les sept chasseurs disposent de fenêtres d'attaque, coûts d'endurance et récupérations distincts. Les kits de référence filtrent les équipements ; Feral utilise des bolts physiques et son masque arme un piège sans infliger de dégâts instantanés. Les boss proviennent d'un registre explicite, et la reine d'une opération utilise un véritable acteur du gestionnaire de boss.

Les tirs, les acteurs et les portes utilisent des contacts physiques partagés. Un pont tactique original possède rampes, tablier, plafond, fosse, destruction et réparation. Le skimmer peut suivre une route alliée avec un déplacement continu interrompu par les menaces. Les zones lointaines libèrent leurs buffers Three et restaurent les mêmes données CPU à l'approche d'un joueur ; les collisions demeurent indépendantes de leur visibilité.

Les palettes des onze biomes, les météos, l'APC, les micro-roquettes du Cheyenne et les insertions occupées sont intégrés. La télémétrie de rendu compte une frame entière, y compris ombres, post-traitement et deux vues. Elle mesure le temps CPU et les intervalles observés, sans prétendre mesurer le temps GPU. Les commandes manette P1/P2, les formes et lettres des marqueurs, les couleurs accessibles et les flashes réduits ont leurs contrôles et préférences propres.

L'honneur utilise un registre de crédits et de dépenses idempotentes. Un achat ne peut pas être financé par un score fourni par l'interface. Un crédit refusé temporairement par le stockage est conservé en attente dans la page et retenté avant un achat, la clôture d'une session ou l'ouverture du coffre. Ces crédits ne financent pas un achat avant leur enregistrement. Une fermeture du navigateur pendant une panne de stockage ne peut pas fournir une garantie de persistance.

## Portée des preuves

[pr3-validation.json](qa/pr3-validation.json) relie la recette finale au SHA Git, au fingerprint source et aux octets du build. [build-info.json](https://yautja-hive-warriors.vercel.app/build-info.json) expose l'identité du code servi. La publication utilise un stage immuable et contrôle tous ses fichiers avant et après promotion.

Les tests CPU, les essais Chromium contrôlés et leurs captures sont des vérifications automatisées. Les déplacements assistés ou les pas de simulation utilisés dans certaines recettes sont déclarés dans les rapports. Ils ne constituent pas cinq testeurs humains, des campagnes intégrales jouées à la main ou une mesure de performance sur les appareils des joueurs.

Les douze GLB existants sont préservés octet pour octet. Aucun crédit Meshy supplémentaire n'a été engagé pendant cette intégration. Les cinq autres corps, les articulations nécessitant une pondération spécifique et les références métriques manquantes ne deviennent pas des modèles certifiés par un changement de code. Les 115 fiches du catalogue ne représentent pas 115 modèles rendus ; les 34 variantes restent des constructions originales en unités de jeu. La fidélité géométrique, les textures et les animations ne sont pas certifiées « 1:1 ».
