# Fronts physiques Musou — déploiement sans superposition des armées

Date : 31 octobre 2026. Base : PR #6, commit `ec31b9ece33f81311c39095200c70e0050e3a166`.

## Pourquoi cette passe

Les cinq missions originales AFF-06 à AFF-10 disposent désormais
d'un plan A/B/C/D explicite, avec rôles et effectifs exacts.
Le problème restant était **spatial** : le vieux binder de
`BattlefieldOperation` plaçait chaque groupe sur le même anneau
de **34 unités de rayon** autour du front, en décalant uniquement
l'angle par rang. Avec 20 à 60 escouades au même front, leurs
points initiaux pouvaient se superposer ou être proches d'un
terminal, même si les 264/800 unités étaient bien comptées.

Le résultat attendu est toujours un **Musou** : l'avatar Yautja
combat directement des groupes et des officiers pendant que
les autres fronts progressent en parallèle. Aucune nouvelle
sélection de troupe RTS, commande de construction ou économie
d'AVP: Extinction n'a été introduite.

## Correctif effectivement développé

`js/battlefield/OriginalMusouStaging.js` reçoit une copie de la
configuration de scène, les secteurs physiques construits et leurs
fronts d'ancrage. Il réserve des emplacements **déterministes**
sur un quadrillage intérieur de l'actuelle zone de gameplay :

- Cellules espacées de **12 unités** entre groupes, avec un retrait
  de 9 unités des bords de secteur.
- Chaque formation de 8 a ses membres placés sur un anneau
  de **3,1 unités**, dans la limite de sa cellule et du sol
  borné. Ce n'est pas un changement de taille de sprite,
  de hitbox, de profil ou de dégâts.
- Un groupe ne peut pas occuper le centre d'une interaction
  déclarée dans `sector.objective`, ni un passage de porte
  connu dans `layout.gates`. La passe de contrôle suivante
  réserve également les **zones d'interaction narrative**
  (`operationObjectives.tasks`) : leurs offsets sont projetés
  sur les centres de front physiques et les escouades restent
  au-delà du rayon d'action + 6,1 unités.
  Les obstacles bâtis **non exposés à ce layout**
  restent à contrôler en scène.
- Un groupe allié est préféré sur une aile et un groupe
  hostile sur l'autre ; les réservistes sont placés
  après les combattants actifs et distants, sans être
  matériellement apparus avant leur événement d'arrivée.
- Chaque cellule n'est attribuée qu'une fois par front ;
  si une pièce est réellement trop petite, la construction
  **échoue explicitement** plutôt que de faire apparaître
  des soldats en dehors du sol.
- Les coordonnées proviennent des **vrais bounds générés**
  par `BattlefieldLayouts`, après choix de variante
  `LD-18/19/11/20/21`, orientation, carte et seed.
  L'algorithme n'invente pas de plan de bâtiment canonique.

Le binder dans `BattlefieldOperation` n'appelle ce staging
**que** si le contrat de front est
`original-audit-front-v1; not canon` (cinq opérations nouvelles
avec `deploymentPlan:'authored'`). Toutes les autres opérations
et les anciens checkpoints au plan
`historical-fallback` conservent **à l'identique**
l'anneau historique, les coordonnées et le digest.

`sceneBinding.musouStaging` précise la version
`original-musou-sector-grid-v1`, les numéros de secteur,
le nombre d'escouades placées, la capacité des cellules et
le statut non certifié des collisions internes de props.

## Pas d'effet parasite

Le placement ne touche **aucune** identité, blessure, mort,
ressource, caste, faction, boss, ordre, renfort, PV ou réserve.
Les cartes disposent toujours de leurs couloirs,
gates, routes et objectifs existants. Les deux Yautja en
coopération restent des combattants séparés des PNJ, sans
nouvel acteur ni unité simulée. Le plafond de **32 acteurs
physiques détaillés simultanément** reste provisoire et
les autres continuent leur simulation de fronts.

## Preuve et recette

Un essai autonome V8 du module a placé **55 escouades**
sur 86 cellules sûres d'une zone synthétique de taille
comparable, avec 55 centres uniques et tous dans le sol
borné. Le parseur du module est passé.

Six tests de régression réels, déclarés dans
`tests/original-musou-staging.test.js` :
- les **cinq opérations et trois seeds** générés sur les
  layouts réels, avec points et membres distincts ;
- distance minimale entre escouades et exclusion du centre
  d'objectif, pas de soldats hors des bounds ;
- déterminisme à seed identique et variation à seed différente ;
- vraies sauvegardes `historical-fallback` avec
  blessures, digest inchangé et reprise ;
- non-modification de quatre autres opérations,
  notamment celle de LV-742 et du contenu unique d'Extinction ;
- refus d'une zone synthétique trop petite et
  conservation des disclaimers géographiques.

Ces tests ont été **ajoutés au workflow Node 24 / Vite / Chromium**.
Le résultat de la CI sur le commit du correctif doit être
consulté avant de les déclarer exécutés/réussis.

### Restant ouvert pour le vrai 1:1

1. Intégrer la géométrie intérieure des décors, caisses,
   piliers et sas aux emplacements autorisés (navmesh /
   collision physique complète), y compris plusieurs hauteurs.
2. Faire passer les renforts et véhicules par des gates
   ouverts et leurs véritables routes, sans traverser les murs.
3. Ajuster les escouades à la topographie de chaque planète,
   navette et ville ; les zones originales ne sont **pas**
   des scans ou plans du média canonique.
4. Tester les assauts, objectifs actifs et sauvetages sur
   plusieurs heures de combat Musou, la dématérialisation,
   deux joueurs, FPS et mémoire GPU.
5. Compléter les castes/tenues/armes spécifiques des
   médias et leurs animations sur les modèles 3D.

**Conclusion :** cette passe règle un problème d'implantation
spatiale concret tout en préservant le combat Musou et
les contrats chiffrés. Aucune fidélité visuelle ou
géographique 1:1 n'est certifiée sur les cinq niveaux.
