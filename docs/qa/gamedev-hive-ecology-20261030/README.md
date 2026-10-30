# Hive Nodes / Drone — écologie finie et sauvegardes (30 octobre 2026)

**Référence de travail** : PR #5 `codex/gamedev-guides-20261029`,
parent `da572ab22e3a089c7b9525ebbdaa2ae3abd9cafd`.
Ce lot ajoute une **adaptation jouable documentée**, pas une géométrie ni
une campagne certifiées 1:1.

## Fonction source vérifiée

*Aliens versus Predator: Extinction* (2003) distingue le **Drone**
d'un Warrior : il peut créer des **Hive Nodes** en consommant des
points d'infestation ; ces nodules génèrent un **Hive-Space** qui
permet la régénération des Xénomorphes. Les cycles d'hôtes,
d'œufs, de Facehuggers et d'infection constituent des systèmes
différents. Sources :

- GameSpot, description du cycle d'hôtes et du Drone construit à partir
  des Oswocs : https://www.gamespot.com/reviews/aliens-versus-predator-extinction-review/1900-6072952/
- StrategyWiki, revenus d'infestation à partir des hôtes :
  https://strategywiki.org/wiki/Aliens_versus_Predator%3A_Extinction/Walkthrough
- Xenopedia, bestiaire *Extinction* (Drone, nodule et guérison) :
  https://avp.fandom.com/wiki/Aliens_versus_Predator%3A_Extinction_Bestiary

**Différences délibérées avec le RTS** : le joueur du mode AFF-27
est un Yautja. Les Drones PNJ du camp xénomorphe posent donc leur
premier nodule **automatiquement** après collecte de ressources.
Les points sont attribués pour des morts ennemies confirmées, sans
mécanique de capture d'hôtes inventée. Le nombre de points, le
coût, les PV et les distances suivants sont des **valeurs de
gameplay Yautja Hive Warriors**, pas des statistiques revendiquées
du titre original.

## Ce qui fonctionne dans le code

### 1. Constructeur et ressource de ruche

`js/battlefield/HiveNodeEcology.js` définit une logique indépendante
de Three.js :

| Variable | Valeur de cette adaptation |
|---|---:|
| Infestation gagnée par mort hostile validée et créditée à la ruche | 1 |
| Réserve maximale de points par ruche | 12 |
| Coût par Hive Node | 3 |
| Hive Nodes actifs par ruche au maximum | 3 |
| Construction par Drone distinct | 1 |
| Espacement minimum entre deux nodules | 16 unités |
| PV du nodule | 280 |
| Rayon du Hive-Space | 11 unités |
| Régénération dans la zone | 8 PV/seconde |

Un nodule est **une structure**, jamais une nouvelle unité. La
simulation ne change pas les 952 soldats de l'opération AFF-27,
ne crée pas de Facehugger et ne reconstitue pas une réserve morte.
Seuls les personnages source reconnus comme **Drones déjà alloués**
sont autorisés à construire. Une utilisation est enregistrée pour
chaque constructeur et ne se réinitialise pas à la destruction.

Les créances d'infestation sont ajoutées uniquement par
`BattleSimulation.recordDeath` sur une vraie identité ennemie,
une fois. Un `recordDeath` dupliqué, une mort de soldat de la
même faction ou un ennemi neutre ne fournit rien.

### 2. Guérison locale sans résurrection

À chaque pas fixe de simulation, les Xénomorphes blessés,
vivants et effectivement **déployés** à proximité d'un Hive Node
actif regagnent progressivement des PV. Les morts, blessés
incapacités, unités de réserve et autres espèces sont exclus.

La synchronisation `healBattleUnit` transmet la valeur au modèle
physique materialisé, afin que la prochaine projection 3D ne
remplace pas le soin par d'anciens PV. Hors caméra, les mêmes
identités se soignent dans la simulation. Ni ressources
gratuites ni nouveau combattant n'entrent dans le système.

### 3. Nodule 3D, dégâts et nettoyage

`js/battlefield/HiveNodeWorld.js` génère une structure en résine
originale : coque organique, bourgeon central, huit excroissances,
spores et anneau lumineux représentant le rayon réel du
Hive-Space. Les PV, positions et IDs demeurent propriétaires
de `BattleSimulation`.

Les nœuds alimentent le fournisseur de cibles des PNJ.
`BattleActorSupport.targetView` conserve la faction de l'attaquant
pour leur infliger les dégâts. Les attaques de mêlée via
`BattleActorBridge.hitOtherHostiles` vérifient la distance, les
factions, le couvert et l'identité de l'attaque (une fois par
objet attaque). Une destruction émet un événement de structure ;
elle ne crée **aucune mort ou récompense de soldat**.

`BattleOperationLifecycle` libère tous les objets lors du
retour au menu ou d'un changement d'opération. Le code
ne modifie aucune géométrie de niveau ni l'algorithme de
navigation existant : **les collisions du nodule contre les
joueurs et la dynamique de destruction hors caméra restent
encore à intégrer**.

### 4. Sauvegardes et modèle de confiance

`BattleSimulation.saveState` contient `hiveEcology` : banques
d'infestation, dépenses, numérotation des nodules, bâtisseurs
déjà utilisés, nœuds et PV. Il conserve le même
`configDigest`, les mêmes effectifs, unités, statuts et profils.

`BattleSimulation.fromState` rejette les sommes de points
incohérentes, l'origine inconnue d'un nodule, les PV ou positions
non valides, les constructions excessives, les constructeurs
répétés, le chevauchement des nœuds et les crédits d'infestation
supérieurs au nombre de morts ennemies réellement créditées
dans le journal. Les checkpoints antérieurs, sans
`hiveEcology`, reprennent avec une ruche **vide et sans
ressource gratuite**.

## Contrôles exécutés sur les sources exactes

**Contrôles isolés dans V8, sans Three.js installé** :

- 27/27 configurations d'opérations générées depuis le catalogue
  conservé, sans erreur.
- 27/27 **vraies instances de BattleSimulation** construites
  en chargeant les règles réelles de formation, d'intelligence
  tactique et de stratégie (validation des boss non sollicitée
  dans ces tests d'état initial). Les budgets et identités
  sont conservés. AFF-27 = **952 combattants, 122 groupes**.
- Sur AFF-27, **3 morts humaines créditées à la ruche** déclenchent
  la construction d'un nodule après coût de 3 ; contrôle des
  PV soignés, conservation des 952 identités, sauvegarde/reprise,
  restauration d'un ancien checkpoint sans nodule et rejet
  d'une banque falsifiée.
- Module pur : maximum de trois nodules, constructeurs uniques,
  récupération impossible des ressources après destruction,
  placement et espacement, régénération réservée aux Aliens,
  **9 mutations frauduleuses rejetées**.
- Projection de monde testée avec des objets et vecteurs
  substitués : cible PNJ avec vraie faction de l'attaquant,
  attaque du joueur, blocage par obstacle, anti-double-impact,
  destruction et nettoyage — **réussis**.

### Régression de checkpoint détectée et corrigée

Un contrôle supplémentaire du **vrai pas fixe de combat AFF-27** a
révélé un défaut antérieur : `BattleSimulation.fromState`
n'acceptait que le cooldown générique du profil, alors que
les Snipers/SADAR distants disposent d'un délai de tir spécialisé
plus long. Une sauvegarde produite après un tir réel
pouvait être rejetée avec `invalid saved unit state`.

La borne de validation de `nextAttack` prend maintenant le
maximum entre le délai normal et le cooldown spécialiste ;
**une horloge falsifiée au-delà de cette borne reste refusée**.
Les essais isolés avec les vraies méthodes de simulation ont
fait avancer `BattleSimulation.update(.25)`, puis ont sauvegardé
et rechargé AFF-27, AFF-16, AFF-13 et AFF-25 avec succès,
en conservant le nodule de LV-742.

Les **8 tests Node/Three** supplémentaires se trouvent dans
`tests/hive-node-ecology.test.js`. Leur **exécution complète
dans le navigateur, la présence du package Three sur ce
checkout et un build Vite ne sont pas démontrés ici**.
Ne pas additionner ces essais isolés aux tests historiques
d'autres commits.

## Reproduction avec dépendances installées

```bash
npm ci
node --test --test-concurrency=1 \
  tests/hive-node-ecology.test.js \
  tests/source-specialist-combat.test.js \
  tests/source-actor-presentation.test.js \
  tests/source-battle-roster.test.js
node scripts/sync-battle-catalog.mjs --check
python3 scripts/update-audit-progress.py --check
npm run build
```

## Limites et suite prioritaire

- Un **Drone Extinction 1:1** suppose encore un vrai cycle
  d'hôtes Oswoc et d'implantation, le transport physique
  des œufs, des ouvriers et des captifs, les contraintes
  d'espace, ainsi que la gestion des mutations par hôte.
  **Ces actions ne sont pas inventées dans ce lot**.
- Les Hive Nodes sont destructibles **dans les combats
  physiques où ils sont ciblés**, mais l'attrition des
  bâtiments dans les conflits purement distants, leurs
  collisions avec la navigation et leurs dégâts
  environnementaux restent ouverts.
- Le mesh procédural est une étude visuelle originale, non
  un modèle mesuré, texturé et validé multi-angles du
  bestiaire du jeu de 2003.
- Continuité des sauvegardes, gameplay 3D réel en split-screen,
  comportement des PNJ, performances CPU/GPU sur matériel
  et contrôle visuel humain nécessitent une recette intégrée.

**Aucune fidélité visuelle ou mécanique intégrale 1:1 n'est
certifiée. Aucun asset sous licence ni nouvelle race n'est
fourni par ce correctif.**
